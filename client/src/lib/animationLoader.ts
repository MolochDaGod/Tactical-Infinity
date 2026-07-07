import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AnimationClipRef, LocomotionSet, DirectionalAnimSet, MeleeCombatSet, RangedCombatSet } from '@/data/animationLibrary';
import { getClip as getLibraryClip, type ClipTransform } from '@/lib/animation/SharedClipLibrary';
import { stripRootMotion, filterClipToBones, filterClipToNormalizedBones } from '@/lib/animation/clipUtils';

const clipCache = new Map<string, THREE.AnimationClip[]>();
const loadingPromises = new Map<string, Promise<THREE.AnimationClip[]>>();
const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

export async function loadAnimationClips(ref: AnimationClipRef): Promise<THREE.AnimationClip[]> {
  const cacheKey = ref.path;

  if (clipCache.has(cacheKey)) {
    return clipCache.get(cacheKey)!;
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      let clips: THREE.AnimationClip[];

      if (ref.format === 'glb') {
        const gltf = await gltfLoader.loadAsync(ref.path);
        clips = gltf.animations;
      } else {
        const fbx = await fbxLoader.loadAsync(ref.path);
        clips = fbx.animations;
      }

      clipCache.set(cacheKey, clips);
      return clips;
    } catch (err) {
      console.warn(`[AnimLoader] Failed to load ${ref.path}:`, err);
      loadingPromises.delete(cacheKey);
      return [];
    }
  })();

  loadingPromises.set(cacheKey, promise);
  return promise;
}

export async function loadSingleClip(ref: AnimationClipRef): Promise<THREE.AnimationClip | null> {
  const clips = await loadAnimationClips(ref);
  if (clips.length === 0) return null;

  if (ref.clipName) {
    const found = clips.find(c => c.name === ref.clipName);
    if (found) return found;
    console.warn(`[AnimLoader] Clip "${ref.clipName}" not found in ${ref.path}, available: ${clips.map(c => c.name).join(', ')}`);
  }

  return clips[0];
}

export interface AnimationAction {
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
  ref: AnimationClipRef;
}

export class CharacterAnimationController {
  mixer: THREE.AnimationMixer;
  actions: Map<string, AnimationAction> = new Map();
  currentAction: AnimationAction | null = null;
  fadeDuration = 0.25;

  constructor(target: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(target);
  }

  /**
   * Bind a clip from the shared library under a local key. The clip itself
   * is reused (same JS object across every character that calls this), but
   * each character gets its OWN AnimationAction — so per-character state
   * (time, weight, fade) stays isolated. This is the sbcode pattern: load
   * the clip ONCE globally, play it on N mixers.
   *
   * Optional transforms (`stripRoot`, `filterBones`, `filterNormalized`)
   * apply to a CLONE of the library clip so other characters keep the
   * original. Use this when one character needs an in-place version while
   * another needs the root-motion version of the same animation.
   *
   *   await library.registerClipFromFile('samba', '/anims/samba.glb');
   *   ctrl.bindLibraryClip('samba');                          // shared
   *   ctrl.bindLibraryClip('samba_inplace', 'samba', { stripRoot: true });
   *   ctrl.play('samba_inplace');
   *
   * Returns `null` if the library has no clip under that name (caller must
   * register it first). Idempotent — re-binding under the same key returns
   * the existing action.
   */
  bindLibraryClip(
    localKey: string,
    libraryName?: string,
    transform?: ClipTransform & { loop?: boolean; speed?: number },
  ): AnimationAction | null {
    if (this.actions.has(localKey)) return this.actions.get(localKey)!;

    const sourceName = libraryName ?? localKey;
    const sourceClip = getLibraryClip(sourceName);
    if (!sourceClip) {
      console.warn(`[CharacterAnimationController] No clip "${sourceName}" in shared library.`);
      return null;
    }

    // If a transform is requested, clone-then-transform so other consumers
    // of the same library entry still see the un-transformed original.
    let clip = sourceClip;
    if (transform?.stripRoot) clip = stripRootMotion(clip);
    if (transform?.filterBones) clip = filterClipToBones(clip, transform.filterBones);
    if (transform?.filterNormalized) clip = filterClipToNormalizedBones(clip, transform.filterNormalized);

    const action = this.mixer.clipAction(clip);
    if (transform?.loop === false) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (transform?.speed) action.timeScale = transform.speed;

    const animAction: AnimationAction = {
      clip,
      action,
      ref: { path: `library://${sourceName}`, format: 'glb' } as AnimationClipRef,
    };
    this.actions.set(localKey, animAction);
    return animAction;
  }

  async loadClip(key: string, ref: AnimationClipRef): Promise<AnimationAction | null> {
    if (this.actions.has(key)) return this.actions.get(key)!;

    const clip = await loadSingleClip(ref);
    if (!clip) return null;

    const action = this.mixer.clipAction(clip);

    if (ref.loop === false) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    if (ref.speed) {
      action.timeScale = ref.speed;
    }

    const animAction: AnimationAction = { clip, action, ref };
    this.actions.set(key, animAction);
    return animAction;
  }

  async loadDirectionalSet(prefix: string, set: DirectionalAnimSet): Promise<void> {
    const entries: [string, AnimationClipRef | undefined][] = [
      [`${prefix}_forward`, set.forward],
      [`${prefix}_backward`, set.backward],
      [`${prefix}_left`, set.left],
      [`${prefix}_right`, set.right],
      [`${prefix}_forwardLeft`, set.forwardLeft],
      [`${prefix}_forwardRight`, set.forwardRight],
      [`${prefix}_backwardLeft`, set.backwardLeft],
      [`${prefix}_backwardRight`, set.backwardRight],
      [`${prefix}_stop`, set.stop],
    ];

    await Promise.all(
      entries
        .filter(([, ref]) => ref !== undefined)
        .map(([key, ref]) => this.loadClip(key, ref!))
    );
  }

  async loadLocomotionSet(set: LocomotionSet): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    tasks.push(this.loadClip('idle', set.idle));
    tasks.push(this.loadDirectionalSet('walk', set.walk));
    tasks.push(this.loadDirectionalSet('run', set.run));

    if (set.sprint) tasks.push(this.loadDirectionalSet('sprint', set.sprint));

    if (set.crouch) {
      const c = set.crouch;
      const crouchEntries: [string, AnimationClipRef | undefined][] = [
        ['crouch_idle', c.idle],
        ['crouch_walkForward', c.walkForward],
        ['crouch_walkBackward', c.walkBackward],
        ['crouch_walkLeft', c.walkLeft],
        ['crouch_walkRight', c.walkRight],
        ['crouch_walkForwardLeft', c.walkForwardLeft],
        ['crouch_walkForwardRight', c.walkForwardRight],
        ['crouch_walkBackwardLeft', c.walkBackwardLeft],
        ['crouch_walkBackwardRight', c.walkBackwardRight],
      ];
      tasks.push(
        Promise.all(
          crouchEntries.filter(([, r]) => r).map(([k, r]) => this.loadClip(k, r!))
        )
      );
    }

    if (set.jump) {
      const j = set.jump;
      const jumpEntries: [string, AnimationClipRef | undefined][] = [
        ['jump_start', j.start],
        ['jump_loop', j.loop],
        ['jump_land', j.land],
        ['jump_up', j.up],
        ['jump_down', j.down],
        ['jump_full', j.full],
        ['jump_fullLong', j.fullLong],
        ['jump_running', j.runningJump],
        ['jump_runningLand', j.runningLand],
      ];
      tasks.push(
        Promise.all(
          jumpEntries.filter(([, r]) => r).map(([k, r]) => this.loadClip(k, r!))
        )
      );
    }

    if (set.turns) {
      const t = set.turns;
      const turnEntries: [string, AnimationClipRef | undefined][] = [
        ['turn_left90', t.left90],
        ['turn_right90', t.right90],
        ['turn_left', t.left],
        ['turn_right', t.right],
      ];
      tasks.push(
        Promise.all(
          turnEntries.filter(([, r]) => r).map(([k, r]) => this.loadClip(k, r!))
        )
      );
    }

    if (set.strafe) {
      const s = set.strafe;
      const strafeEntries: [string, AnimationClipRef | undefined][] = [
        ['strafe_leftRun', s.leftRun],
        ['strafe_rightRun', s.rightRun],
        ['strafe_leftWalk', s.leftWalk],
        ['strafe_rightWalk', s.rightWalk],
      ];
      tasks.push(
        Promise.all(
          strafeEntries.filter(([, r]) => r).map(([k, r]) => this.loadClip(k, r!))
        )
      );
    }

    await Promise.all(tasks);
  }

  async loadMeleeCombatSet(set: MeleeCombatSet): Promise<void> {
    const entries: [string, AnimationClipRef | undefined][] = [
      ['melee_attack1', set.attack1],
      ['melee_attack2', set.attack2],
      ['melee_attack3', set.attack3],
      ['melee_idle', set.idle],
      ['melee_block', set.block],
      ['melee_blockAttack', set.blockAttack],
      ['melee_blockHit', set.blockHit],
      ['melee_blocking', set.blocking],
    ];

    await Promise.all(
      entries.filter(([, r]) => r).map(([k, r]) => this.loadClip(k, r!))
    );
  }

  async loadRangedCombatSet(set: RangedCombatSet): Promise<void> {
    const entries: [string, AnimationClipRef | undefined][] = [
      ['ranged_aim', set.aim],
      ['ranged_aimIdle', set.aimIdle],
      ['ranged_shoot', set.shoot],
      ['ranged_shooting', set.shooting],
      ['ranged_reload', set.reload],
      ['ranged_draw', set.draw],
      ['ranged_drawUp', set.drawUp],
      ['ranged_release', set.release],
      ['ranged_releaseUp', set.releaseUp],
      ['ranged_bowIdle', set.bowIdle],
    ];

    await Promise.all(
      entries.filter(([, r]) => r).map(([k, r]) => this.loadClip(k, r!))
    );
  }

  play(key: string, fadeTime?: number): boolean {
    const anim = this.actions.get(key);
    if (!anim) return false;

    const fade = fadeTime ?? this.fadeDuration;

    if (this.currentAction && this.currentAction !== anim) {
      this.currentAction.action.fadeOut(fade);
    }

    anim.action.reset().fadeIn(fade).play();
    this.currentAction = anim;
    return true;
  }

  playOnce(key: string, fadeTime?: number, onComplete?: () => void): boolean {
    const anim = this.actions.get(key);
    if (!anim) return false;

    const fade = fadeTime ?? this.fadeDuration;

    anim.action.setLoop(THREE.LoopOnce, 1);
    anim.action.clampWhenFinished = true;

    if (this.currentAction && this.currentAction !== anim) {
      this.currentAction.action.fadeOut(fade);
    }

    anim.action.reset().fadeIn(fade).play();
    this.currentAction = anim;

    if (onComplete) {
      const handler = (e: { action: THREE.AnimationAction }) => {
        if (e.action === anim.action) {
          this.mixer.removeEventListener('finished', handler);
          onComplete();
        }
      };
      this.mixer.addEventListener('finished', handler);
    }

    return true;
  }

  crossFade(fromKey: string, toKey: string, duration?: number): boolean {
    const from = this.actions.get(fromKey);
    const to = this.actions.get(toKey);
    if (!from || !to) return false;

    const d = duration ?? this.fadeDuration;
    from.action.fadeOut(d);
    to.action.reset().fadeIn(d).play();
    this.currentAction = to;
    return true;
  }

  getDirectionalKey(prefix: string, dx: number, dz: number): string {
    if (Math.abs(dx) < 0.1 && Math.abs(dz) < 0.1) return `${prefix}_forward`;

    const angle = Math.atan2(dx, dz);
    const deg = (angle * 180) / Math.PI;

    if (deg >= -22.5 && deg < 22.5) return `${prefix}_forward`;
    if (deg >= 22.5 && deg < 67.5) return `${prefix}_forwardRight`;
    if (deg >= 67.5 && deg < 112.5) return `${prefix}_right`;
    if (deg >= 112.5 && deg < 157.5) return `${prefix}_backwardRight`;
    if (deg >= 157.5 || deg < -157.5) return `${prefix}_backward`;
    if (deg >= -157.5 && deg < -112.5) return `${prefix}_backwardLeft`;
    if (deg >= -112.5 && deg < -67.5) return `${prefix}_left`;
    if (deg >= -67.5 && deg < -22.5) return `${prefix}_forwardLeft`;

    return `${prefix}_forward`;
  }

  playDirectional(prefix: string, dx: number, dz: number, fadeTime?: number): boolean {
    const key = this.getDirectionalKey(prefix, dx, dz);
    if (this.actions.has(key)) {
      return this.play(key, fadeTime);
    }
    return this.play(`${prefix}_forward`, fadeTime);
  }

  stop(key?: string): void {
    if (key) {
      const anim = this.actions.get(key);
      if (anim) anim.action.stop();
    } else if (this.currentAction) {
      this.currentAction.action.fadeOut(this.fadeDuration);
      this.currentAction = null;
    }
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
    this.currentAction = null;
  }

  get loadedKeys(): string[] {
    return Array.from(this.actions.keys());
  }

  has(key: string): boolean {
    return this.actions.has(key);
  }
}

export function clearAnimationCache(): void {
  clipCache.clear();
  loadingPromises.clear();
}

export async function preloadAnimations(refs: AnimationClipRef[]): Promise<void> {
  await Promise.all(refs.map(ref => loadAnimationClips(ref)));
}
