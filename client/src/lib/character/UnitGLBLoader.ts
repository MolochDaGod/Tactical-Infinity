/**
 * UnitGLBLoader — loads a baked-GLB starting-build unit and drives its
 * animations following the character-animation SKILL:
 *
 *   • Each unit GLB carries its OWN Bip001 skeleton + baked clips (idle/walk/
 *     run/attack/…). Those are played directly on the unit's OWN mixer.
 *   • The shared `anim-bank.glb` (123 clips, same Bip001 bone names) is loaded
 *     exactly ONCE into `SharedClipLibrary` (keyed `bank/<name>`), then bound
 *     to any unit's mixer on demand — no retargeting needed since the rig is
 *     shared.
 *   • Crossfade is the sbcode idiom: prev.fadeOut → next.reset().fadeIn().play().
 *
 * See `.agents/skills/character-animation/SKILL.md`.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { registerClip, getClip, listClips } from '@/lib/animation';
import { ANIM_BANK_PATH } from '@/data/factionUnits';
import { applyLoadout3D, disposeLoadout3D, findHandBone, findHeadBone, type Rig3D } from '@/lib/gear/rig3d';
import type { ResolvedLoadout } from '@/lib/gear/loadout';

export interface ClipInfo {
  /** Key used with `play()`. Baked clips use their raw name; bank clips are `bank/<name>`. */
  key: string;
  /** Short display label. */
  label: string;
  /** Where the clip came from. */
  source: 'baked' | 'bank';
  /** Category (prefix before `/`) for bank clips; `baked` otherwise. */
  category: string;
}

export interface PlayOptions {
  loop?: boolean;
  fade?: number;
  /** Playback speed multiplier. */
  timeScale?: number;
}

const gltfLoader = new GLTFLoader();

// ── Shared anim-bank: loaded once, process-wide ───────────────────────────────
let bankPromise: Promise<string[]> | null = null;

/**
 * Load `anim-bank.glb` exactly once and register every clip in
 * `SharedClipLibrary` under `bank/<clipName>`. Returns the list of bank keys.
 * Idempotent + de-duped.
 */
export async function loadAnimBank(): Promise<string[]> {
  if (bankPromise) return bankPromise;
  bankPromise = (async () => {
    try {
      const gltf = await gltfLoader.loadAsync(ANIM_BANK_PATH);
      const keys: string[] = [];
      for (const clip of gltf.animations ?? []) {
        const key = `bank/${clip.name}`;
        registerClip(key, clip, undefined, ANIM_BANK_PATH);
        keys.push(key);
      }
      return keys;
    } catch (err) {
      console.warn('[UnitGLBLoader] Failed to load anim bank:', err);
      bankPromise = null;
      return [];
    }
  })();
  return bankPromise;
}

/** All bank keys currently registered (after `loadAnimBank()` has resolved). */
export function bankClipKeys(): string[] {
  return listClips().filter((k) => k.startsWith('bank/'));
}

export interface UnitLoadOptions {
  /** Target world-space height in metres (auto-fit). Default 1.8. */
  targetHeight?: number;
  /** Also load + expose the shared anim-bank clips. Default true. */
  includeBank?: boolean;
  /** Optional env map applied to the unit's materials. */
  envMap?: THREE.Texture | null;
  /**
   * Strip horizontal (X/Z) root translation from baked clips so locomotion
   * (walk/run/sprint) plays IN PLACE instead of driving the character off in
   * whatever direction the clip was authored. Use for stationary previews
   * (barracks lineup, viewers). Default false. Only baked (per-instance) clips
   * are touched — shared bank clips are never mutated.
   */
  stripRootMotion?: boolean;
}

/**
 * Neutralise horizontal root motion on a clip by holding every `.position`
 * track's X and Z at their first-frame value (vertical bob on Y is preserved).
 * Mutates the clip in place — only safe on per-instance (baked) clips.
 */
function stripHorizontalRootMotion(clip: THREE.AnimationClip): void {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const values = track.values;
    if (values.length < 3) continue;
    const x0 = values[0];
    const z0 = values[2];
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0;     // X
      values[i + 2] = z0; // Z
    }
  }
}

export class UnitCharacter {
  readonly object: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly clips: ClipInfo[];
  /** Uniform scale applied to auto-fit to the target height. */
  readonly fitScale: number;

  private actions = new Map<string, THREE.AnimationAction>();
  private clipByKey = new Map<string, THREE.AnimationClip>();
  private current: THREE.AnimationAction | null = null;

  private rightHand: THREE.Bone | null = null;
  private leftHand: THREE.Bone | null = null;
  private headBone: THREE.Bone | null = null;
  private bonesResolved = false;
  private disposedFlag = false;

  /** Persistent post-animation rotation offset for the right hand (weapon) bone. */
  private rightHandOffset: THREE.Quaternion | null = null;
  private rightHandOffsetBone: THREE.Bone | null = null;
  private rightHandOffsetResolved = false;

  /** Resolved attachment container nodes (shield/weapon) + their authored base pose. */
  private attachNode = new Map<string, THREE.Object3D | null>();
  private attachBase = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();

  private constructor(
    object: THREE.Group,
    mixer: THREE.AnimationMixer,
    clips: ClipInfo[],
    clipByKey: Map<string, THREE.AnimationClip>,
    fitScale: number,
  ) {
    this.object = object;
    this.mixer = mixer;
    this.clips = clips;
    this.clipByKey = clipByKey;
    this.fitScale = fitScale;
  }

  static async load(path: string, opts: UnitLoadOptions = {}): Promise<UnitCharacter> {
    const { targetHeight = 1.8, includeBank = true, envMap = null, stripRootMotion = false } = opts;

    const gltf = await gltfLoader.loadAsync(path);
    const root = gltf.scene as THREE.Group;

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // skinned meshes: bounds move with the skeleton
        if (envMap) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const sm = m as THREE.MeshStandardMaterial;
            if ('envMap' in sm) {
              sm.envMap = envMap;
              sm.envMapIntensity = 0.7;
              sm.needsUpdate = true;
            }
          }
        }
      }
    });

    // Auto-fit: scale so the model is `targetHeight` tall and rests feet-on-floor.
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const rawHeight = size.y || 1;
    const fitScale = targetHeight / rawHeight;
    root.scale.setScalar(fitScale);
    // Re-measure after scaling to seat feet on y=0.
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;

    const mixer = new THREE.AnimationMixer(root);

    const clips: ClipInfo[] = [];
    const clipByKey = new Map<string, THREE.AnimationClip>();

    // Baked clips — dedupe repeated names (some GLBs ship duplicate `idle`/`run`).
    const seen = new Map<string, number>();
    for (const clip of gltf.animations ?? []) {
      let key = clip.name;
      const n = seen.get(clip.name) ?? 0;
      seen.set(clip.name, n + 1);
      if (n > 0) key = `${clip.name}#${n + 1}`;
      if (stripRootMotion) stripHorizontalRootMotion(clip);
      clipByKey.set(key, clip);
      clips.push({ key, label: key, source: 'baked', category: 'baked' });
    }

    // Shared bank clips — loaded once, shared across every unit.
    if (includeBank) {
      const bankKeys = await loadAnimBank();
      for (const key of bankKeys) {
        const clip = getClip(key);
        if (!clip) continue;
        clipByKey.set(key, clip);
        const rest = key.slice('bank/'.length);
        const slash = rest.indexOf('/');
        const category = slash > 0 ? rest.slice(0, slash) : 'misc';
        const label = slash > 0 ? rest.slice(slash + 1) : rest;
        clips.push({ key, label, source: 'bank', category });
      }
    }

    return new UnitCharacter(root, mixer, clips, clipByKey, fitScale);
  }

  /** Lazily build (and cache) the AnimationAction for a clip key. */
  private actionFor(key: string): THREE.AnimationAction | null {
    const existing = this.actions.get(key);
    if (existing) return existing;
    const clip = this.clipByKey.get(key);
    if (!clip) return null;
    const action = this.mixer.clipAction(clip);
    this.actions.set(key, action);
    return action;
  }

  hasClip(key: string): boolean {
    return this.clipByKey.has(key);
  }

  /** Crossfade to a clip. Returns false if the key is unknown. */
  play(key: string, options: PlayOptions = {}): boolean {
    const { loop = true, fade = 0.35, timeScale = 1 } = options;
    const action = this.actionFor(key);
    if (!action) {
      console.warn(`[UnitCharacter] Unknown clip "${key}"`);
      return false;
    }
    action.enabled = true;
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;

    if (this.current && this.current !== action) {
      this.current.fadeOut(fade);
    }
    action.reset().fadeIn(fade).play();
    this.current = action;
    return true;
  }

  /** Play the first available clip from a preference list (e.g. ['idle','fight_idle']). */
  playFirstAvailable(keys: string[], options?: PlayOptions): boolean {
    for (const k of keys) {
      if (this.hasClip(k)) return this.play(k, options);
    }
    return false;
  }

  setPaused(paused: boolean): void {
    this.mixer.timeScale = paused ? 0 : 1;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    // Re-apply the static right-hand offset AFTER the mixer, since the mixer
    // rewrites the bone quaternion from the clip every frame.
    if (this.rightHandOffset) {
      if (!this.rightHandOffsetResolved) {
        this.rightHandOffsetBone = findHandBone(this.object, 'right');
        this.rightHandOffsetResolved = true;
      }
      if (this.rightHandOffsetBone) {
        this.rightHandOffsetBone.quaternion.multiply(this.rightHandOffset);
      }
    }
  }

  /**
   * Set a persistent rotation offset (degrees) applied to the right-hand /
   * weapon bone every frame after animation, so a baked weapon can be angled
   * away from the body (stops it clipping into the character). Pass `null` to
   * clear. Axes are the bone's LOCAL frame; small values (~3°) are typical.
   */
  setRightHandOffset(deg: { x?: number; y?: number; z?: number } | null): void {
    if (!deg) { this.rightHandOffset = null; return; }
    const e = new THREE.Euler(
      THREE.MathUtils.degToRad(deg.x ?? 0),
      THREE.MathUtils.degToRad(deg.y ?? 0),
      THREE.MathUtils.degToRad(deg.z ?? 0),
    );
    this.rightHandOffset = new THREE.Quaternion().setFromEuler(e);
  }

  /** Name patterns for the rigid attachment containers baked into the unit GLBs. */
  private static readonly ATTACH_PATTERNS: Record<string, RegExp[]> = {
    shield: [/^l_shield_container$/i, /shield.*container/i, /l_.*shield/i],
    weapon: [/^r_hand_container$/i, /r_.*hand.*container/i, /weapon.*container/i],
  };

  /** Resolve (and cache) the container node for an attachment slot by name. */
  private resolveAttachment(slot: string): THREE.Object3D | null {
    if (this.attachNode.has(slot)) return this.attachNode.get(slot) ?? null;
    const pats = UnitCharacter.ATTACH_PATTERNS[slot] ?? [];
    let found: THREE.Object3D | null = null;
    this.object.traverse((o) => {
      if (found) return;
      if (pats.some((p) => p.test(o.name))) found = o;
    });
    this.attachNode.set(slot, found);
    return found;
  }

  /**
   * Position/orient a baked rigid attachment relative to its authored pose:
   *   • `shield` → the `L_shield_container` node (shield mesh)
   *   • `weapon` → the `R_hand_container` node (sword/staff/bow mesh)
   * `rot` is in local degrees, `pos` is a local-space nudge in the model's own
   * (pre-fit) units, `scale` multiplies the authored scale. Pass `null` to
   * restore the authored pose. These container nodes are NOT animated by the
   * mixer, so the transform is applied once and simply persists — no per-frame
   * re-apply needed. Returns false if the container isn't present on this unit.
   */
  setAttachmentOffset(
    slot: 'shield' | 'weapon',
    offset: {
      rot?: { x?: number; y?: number; z?: number };
      pos?: { x?: number; y?: number; z?: number };
      scale?: number;
    } | null,
  ): boolean {
    const node = this.resolveAttachment(slot);
    if (!node) return false;
    let base = this.attachBase.get(slot);
    if (!base) {
      base = { p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() };
      this.attachBase.set(slot, base);
    }
    // Reset to the authored pose, then layer the offset on top.
    node.position.copy(base.p);
    node.quaternion.copy(base.q);
    node.scale.copy(base.s);
    if (!offset) return true;
    if (offset.rot) {
      const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(offset.rot.x ?? 0),
        THREE.MathUtils.degToRad(offset.rot.y ?? 0),
        THREE.MathUtils.degToRad(offset.rot.z ?? 0),
      ));
      node.quaternion.multiply(dq);
    }
    if (offset.pos) {
      node.position.add(new THREE.Vector3(offset.pos.x ?? 0, offset.pos.y ?? 0, offset.pos.z ?? 0));
    }
    if (offset.scale !== undefined) node.scale.multiplyScalar(offset.scale);
    return true;
  }

  /**
   * Apply a resolved gear loadout via the shared `rig3d` helper: attaches GLB
   * weapon/offhand/accessory models to the Bip001 hand/head bones and toggles
   * any built-in armor submeshes discovered on this GLB.
   */
  applyGearLoadout(resolved: ResolvedLoadout): void {
    if (!this.bonesResolved) {
      this.rightHand = findHandBone(this.object, 'right');
      this.leftHand = findHandBone(this.object, 'left');
      this.headBone = findHeadBone(this.object);
      this.bonesResolved = true;
    }
    const rig: Rig3D = {
      root: this.object,
      rightHand: this.rightHand,
      leftHand: this.leftHand,
      headBone: this.headBone,
      isDisposed: () => this.disposedFlag,
    };
    applyLoadout3D(rig, resolved);
  }

  /** Stop actions, unbind the mixer, and dispose all owned GPU resources. */
  dispose(): void {
    this.disposedFlag = true;
    disposeLoadout3D(this.object);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.object);
    this.actions.clear();
    this.object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        const anyMat = m as unknown as Record<string, unknown>;
        for (const key of Object.keys(anyMat)) {
          // envMap is an externally-owned shared PMREM texture — never dispose it here,
          // or disposing one character would invalidate the env map for every other
          // character and the scene.
          if (key === 'envMap') continue;
          const val = anyMat[key];
          if (val && val instanceof THREE.Texture) val.dispose();
        }
        m.dispose();
      }
    });
    this.object.removeFromParent();
  }
}
