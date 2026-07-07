// Canonical character builder — the single source of truth for turning a
// Grudge race + weapon style + armor selection into an animated 3D character.
//
// Used by /battle, /barracks, /equipment and the race preview so there is ONE
// code path: load the race's Toon-RTS Biped mesh (bare-loadout filtered), apply
// its TGA texture + normalized scale, attach an AnimationMixer, retarget the
// semantic grudge6 clip set onto the skeleton at runtime, attach the weapon set
// for the chosen style to the hand bones, and expose a clean play/equip API.
//
// Modular armor: the Toon-RTS character FBX ships every cosmetic variant
// (helmets, pauldrons, gauntlets, capes, ...) as submeshes already skinned to
// the rig. `applyBareLoadout` hides them; this builder catalogs them per slot so
// equipping a piece simply toggles the matching submesh visible — it deforms
// with the animation automatically, no separate skinning needed.
//
// Constraints (see .agents/skills/character-animation/SKILL.md):
//  - each source clip is loaded once (grudgeClips cache) and retargeted once per
//    race here; crossfade with fadeOut -> reset().fadeIn().play().
//  - callers own the renderer; this class owns only the character subtree.

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { applyBareLoadout } from '@/lib/characterMeshFilter';
import { applyLoadout3D, findHeadBone, type Rig3D } from '@/lib/gear/rig3d';
import type { ResolvedLoadout } from '@/lib/gear/loadout';
import { retargetClipTPose } from '@/lib/animationRetargeting';
import {
  type Race, RACE_MODELS, RACE_TEXTURES,
  WEAPON_STYLE_CONFIGS, getWeaponFBXForRace, type WeaponStyle,
} from '@/data/toonRTSAssets';
import {
  type CharState, stateClipKeys, clipKeysForStyle, loadClipSources, getSourceClip,
} from './grudgeClips';

export const CHAR_SCALE = 0.012;

export type ArmorSlot = 'head' | 'shoulders' | 'chest' | 'hands' | 'feet' | 'cape';
export const ARMOR_SLOTS: ArmorSlot[] = ['head', 'shoulders', 'chest', 'hands', 'feet', 'cape'];

const ARMOR_SLOT_PATTERNS: Record<ArmorSlot, RegExp> = {
  head: /helmet|hood|hat|crown|mask|cap_/i,
  shoulders: /pauldron|shoulder|mantle/i,
  chest: /breastplate|chestplate|cuirass|platearmor|armorplate|chainmail|scalemail|robe|tunic_armor/i,
  hands: /gauntlet|glove|vambrace|bracer/i,
  feet: /greaves|bootsarmor|boot/i,
  cape: /cloak|cape_/i,
};

const FALLBACK_COLORS: Record<Race, number> = {
  human: 0xd4a574, barbarian: 0xc4956a,
  dwarf: 0xb8956a, elf: 0xe8d4b8,
  orc: 0x5a8a4a, undead: 0x8a8a7a,
};

interface BlendConfig { fadeIn: number; fadeOut: number; loop: boolean; timeScale: number; clamp: boolean; }
const DEFAULT_BLEND: BlendConfig = { fadeIn: 0.25, fadeOut: 0.25, loop: true, timeScale: 1, clamp: false };
const STATE_BLEND: Partial<Record<CharState, Partial<BlendConfig>>> = {
  idle: { fadeIn: 0.3, loop: true },
  walk: { fadeIn: 0.2, loop: true },
  run: { fadeIn: 0.15, loop: true },
  attack: { fadeIn: 0.12, fadeOut: 0.2, loop: false, timeScale: 1.1, clamp: true },
  block: { fadeIn: 0.1, loop: false, clamp: true },
  cast: { fadeIn: 0.15, loop: false, clamp: true },
  jump: { fadeIn: 0.12, loop: false, clamp: true },
  death: { fadeIn: 0.3, loop: false, clamp: true, timeScale: 0.8 },
};
function blendFor(state: CharState): BlendConfig {
  return { ...DEFAULT_BLEND, ...(STATE_BLEND[state] ?? {}) };
}

function findBone(root: THREE.Object3D, patterns: string[]): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((child) => {
    if (found) return;
    if (child instanceof THREE.Bone) {
      const lower = child.name.toLowerCase();
      for (const pat of patterns) if (lower.includes(pat)) { found = child; return; }
    }
  });
  return found;
}

const MATERIAL_MAP_KEYS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap',
  'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap',
] as const;

function disposeMaterial(m: THREE.Material | undefined): void {
  if (!m) return;
  const rec = m as unknown as Record<string, THREE.Texture | undefined>;
  for (const key of MATERIAL_MAP_KEYS) rec[key]?.dispose?.();
  m.dispose?.();
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry?.dispose?.();
      const m = c.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => disposeMaterial(x));
      else disposeMaterial(m);
    }
  });
}

function ancestryName(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let cur: THREE.Object3D | null = obj;
  while (cur) { if (cur.name) parts.push(cur.name); cur = cur.parent; }
  return parts.join('/');
}

let tgaFBXLoader: FBXLoader | null = null;
function tgaAwareFBXLoader(): FBXLoader {
  if (tgaFBXLoader) return tgaFBXLoader;
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.tga$/i, new TGALoader(manager));
  tgaFBXLoader = new FBXLoader(manager);
  return tgaFBXLoader;
}

export interface CharacterBuilderOptions {
  race: Race;
  weaponStyle?: WeaponStyle;
  envMap?: THREE.Texture | null;
  scale?: number;
}

export class CharacterBuilder {
  readonly group: THREE.Group;
  readonly race: Race;
  weaponStyle: WeaponStyle;

  private readonly envMap: THREE.Texture | null;
  private readonly scale: number;
  private readonly fbxLoader = tgaAwareFBXLoader();
  private readonly tgaLoader = new TGALoader();

  private fbx: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  /** retargeted actions keyed by SOURCE clip key. */
  private actions = new Map<string, THREE.AnimationAction>();
  private currentState: CharState | null = null;
  private currentKey = '';

  private bodyTexture: THREE.Texture | null = null;
  private rightHand: THREE.Bone | null = null;
  private leftHand: THREE.Bone | null = null;
  private mainHandWeapon: THREE.Object3D | null = null;
  private offHandWeapon: THREE.Object3D | null = null;
  private equipToken = 0;

  /** slot -> submeshes belonging to that armor slot (initially hidden). */
  private armorCatalog = new Map<ArmorSlot, THREE.Mesh[]>();
  private equippedArmor: Partial<Record<ArmorSlot, number | null>> = {};

  private disposed = false;
  ready = false;

  constructor(opts: CharacterBuilderOptions) {
    this.race = opts.race;
    this.weaponStyle = opts.weaponStyle ?? 'sword_shield';
    this.envMap = opts.envMap ?? null;
    this.scale = opts.scale ?? CHAR_SCALE;
    this.group = new THREE.Group();
    this.group.name = `character-${this.race}`;
  }

  /** Load mesh, texture, animations and the initial weapon set. */
  async load(): Promise<this> {
    const modelPath = RACE_MODELS[this.race].character;
    const texturePath = RACE_TEXTURES[this.race].standard;

    const fbx = await new Promise<THREE.Group>((resolve, reject) => {
      this.fbxLoader.load(modelPath, (g) => resolve(g as THREE.Group), undefined, reject);
    });
    if (this.disposed) { disposeObject(fbx); return this; }

    fbx.scale.setScalar(this.scale);
    this.fbx = fbx;

    applyBareLoadout(fbx, { log: false, label: this.race });
    this.buildArmorCatalog(fbx);
    this.applyBodyMaterial(fbx, null);
    this.loadTexture(texturePath);

    this.rightHand = findBone(fbx, ['righthand', 'right_hand', 'r_hand', 'hand_r', 'r hand']);
    this.leftHand = findBone(fbx, ['lefthand', 'left_hand', 'l_hand', 'hand_l', 'l hand']);

    this.mixer = new THREE.AnimationMixer(fbx);
    this.group.add(fbx);

    // Retarget the clip set BEFORE any mixer.update() runs (rest pose intact).
    await this.ensureClips(clipKeysForStyle(this.weaponStyle));
    this.equipWeaponSet(this.weaponStyle);

    this.ready = true;
    this.play('idle');
    return this;
  }

  // ── Animation ──────────────────────────────────────────────────────────────
  private async ensureClips(keys: string[]): Promise<void> {
    await loadClipSources(keys);
    if (this.disposed || !this.fbx || !this.mixer) return;
    for (const key of keys) {
      if (this.actions.has(key)) continue;
      const src = getSourceClip(key);
      if (!src) continue;
      try {
        const retargeted = retargetClipTPose(src.clip, src.sourceFBX, this.fbx);
        retargeted.name = key;
        this.actions.set(key, this.mixer.clipAction(retargeted));
      } catch (e) {
        console.warn(`[CharacterBuilder] retarget ${key} -> ${this.race} failed:`, e);
      }
    }
  }

  private resolveKey(state: CharState): string {
    const map = stateClipKeys(this.weaponStyle);
    if (this.actions.has(map[state])) return map[state];
    // graceful fallbacks
    if (this.actions.has(map.idle)) return map.idle;
    if (this.actions.has('idle')) return 'idle';
    return this.actions.keys().next().value ?? '';
  }

  play(state: CharState): void {
    if (!this.mixer) return;
    const key = this.resolveKey(state);
    if (!key || this.currentKey === key) { this.currentState = state; return; }
    const action = this.actions.get(key);
    if (!action) return;

    const cfg = blendFor(state);
    const prev = this.actions.get(this.currentKey);
    if (prev) prev.fadeOut(cfg.fadeOut);

    action.reset();
    action.setLoop(cfg.loop ? THREE.LoopRepeat : THREE.LoopOnce, cfg.loop ? Infinity : 1);
    action.clampWhenFinished = cfg.clamp;
    action.timeScale = cfg.timeScale;
    action.fadeIn(cfg.fadeIn).play();

    this.currentState = state;
    this.currentKey = key;

    if (!cfg.loop && state !== 'death') {
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action === action) {
          this.mixer?.removeEventListener('finished', onFinished);
          this.play('idle');
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }

  getState(): CharState | null { return this.currentState; }

  // ── Weapon style ────────────────────────────────────────────────────────────
  async setWeaponStyle(style: WeaponStyle): Promise<void> {
    if (style === this.weaponStyle && this.mainHandWeapon) return;
    this.weaponStyle = style;
    await this.ensureClips(clipKeysForStyle(style));
    if (this.disposed) return;
    this.equipWeaponSet(style);
    this.currentKey = '';
    this.play('idle');
  }

  private equipWeaponSet(style: WeaponStyle): void {
    const config = WEAPON_STYLE_CONFIGS[style];
    const token = ++this.equipToken;

    if (this.mainHandWeapon) {
      this.mainHandWeapon.parent?.remove(this.mainHandWeapon);
      disposeObject(this.mainHandWeapon);
      this.mainHandWeapon = null;
    }
    if (this.offHandWeapon) {
      this.offHandWeapon.parent?.remove(this.offHandWeapon);
      disposeObject(this.offHandWeapon);
      this.offHandWeapon = null;
    }

    const paths = getWeaponFBXForRace(this.race, style);

    if (paths.mainHand && this.rightHand) {
      this.fbxLoader.load(paths.mainHand, (wpn) => {
        if (this.disposed || this.equipToken !== token) { disposeObject(wpn); return; }
        wpn.scale.setScalar(config.mainHandScale / this.scale);
        wpn.position.set(...config.mainHandOffset);
        wpn.rotation.set(...config.mainHandRotation);
        this.applyWeaponMaterial(wpn);
        this.rightHand!.add(wpn);
        this.mainHandWeapon = wpn;
      }, undefined, (err) => console.warn(`[CharacterBuilder] main-hand load failed (${paths.mainHand}):`, err));
    }

    if (paths.offHand && this.leftHand) {
      this.fbxLoader.load(paths.offHand, (wpn) => {
        if (this.disposed || this.equipToken !== token) { disposeObject(wpn); return; }
        wpn.scale.setScalar(config.offHandScale / this.scale);
        wpn.position.set(...config.offHandOffset);
        wpn.rotation.set(...config.offHandRotation);
        this.applyWeaponMaterial(wpn);
        this.leftHand!.add(wpn);
        this.offHandWeapon = wpn;
      }, undefined, (err) => console.warn(`[CharacterBuilder] off-hand load failed (${paths.offHand}):`, err));
    }
  }

  // ── Modular armor (built-in skinned submeshes toggled per slot) ──────────────
  private buildArmorCatalog(fbx: THREE.Group): void {
    for (const slot of ARMOR_SLOTS) this.armorCatalog.set(slot, []);
    fbx.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = ancestryName(mesh);
      for (const slot of ARMOR_SLOTS) {
        if (ARMOR_SLOT_PATTERNS[slot].test(name)) {
          this.armorCatalog.get(slot)!.push(mesh);
          break;
        }
      }
    });
  }

  /** Visible-name list of available variants for a slot. */
  listArmor(slot: ArmorSlot): string[] {
    return (this.armorCatalog.get(slot) ?? []).map((m) => m.name || '<piece>');
  }

  /** Show variant `index` for a slot (null hides the slot). */
  equipArmorVariant(slot: ArmorSlot, index: number | null): void {
    const meshes = this.armorCatalog.get(slot) ?? [];
    meshes.forEach((m, i) => { m.visible = index !== null && i === index; });
    this.equippedArmor[slot] = index;
  }

  getEquippedArmor(): Partial<Record<ArmorSlot, number | null>> {
    return { ...this.equippedArmor };
  }

  /**
   * Apply a resolved gear loadout via the shared `rig3d` helper: attaches GLB
   * weapon/offhand/accessory models to the hand/head bones and toggles built-in
   * armor submeshes. Reuses this rig's own armor catalog + `equipArmorVariant`.
   * A gear weapon (or offhand) replaces the default FBX weapon set so the
   * character never renders two weapons at once.
   */
  applyGearLoadout(resolved: ResolvedLoadout): void {
    if (!this.fbx) return;
    if (resolved.weapon || resolved.offhand) {
      if (this.mainHandWeapon) {
        this.mainHandWeapon.parent?.remove(this.mainHandWeapon);
        disposeObject(this.mainHandWeapon);
        this.mainHandWeapon = null;
      }
      if (this.offHandWeapon) {
        this.offHandWeapon.parent?.remove(this.offHandWeapon);
        disposeObject(this.offHandWeapon);
        this.offHandWeapon = null;
      }
    }
    const rig: Rig3D = {
      root: this.fbx,
      rightHand: this.rightHand,
      leftHand: this.leftHand,
      headBone: findHeadBone(this.fbx),
      armorCatalog: this.armorCatalog,
      toggleArmor: (slot, equipped) => this.equipArmorVariant(slot as ArmorSlot, equipped ? 0 : null),
      isDisposed: () => this.disposed,
    };
    applyLoadout3D(rig, resolved);
  }

  // ── Materials ────────────────────────────────────────────────────────────────
  private applyBodyMaterial(fbx: THREE.Group, map: THREE.Texture | null): void {
    fbx.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const prev = child.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(prev)) prev.forEach((m) => m.dispose?.());
      else prev?.dispose?.();
      child.material = new THREE.MeshStandardMaterial({
        ...(map ? { map } : { color: FALLBACK_COLORS[this.race] }),
        roughness: 0.6,
        metalness: 0.2,
        ...(this.envMap ? { envMap: this.envMap, envMapIntensity: 0.8 } : {}),
      });
    });
  }

  private loadTexture(texturePath: string): void {
    this.tgaLoader.load(
      texturePath,
      (texture) => {
        if (this.disposed || !this.fbx) { texture.dispose(); return; }
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        if (this.bodyTexture && this.bodyTexture !== texture) this.bodyTexture.dispose();
        this.bodyTexture = texture;
        this.applyBodyMaterial(this.fbx, texture);
      },
      undefined,
      (err) => console.warn(`[CharacterBuilder] TGA load failed for ${this.race} (${texturePath}):`, err),
    );
  }

  private applyWeaponMaterial(wpn: THREE.Object3D): void {
    wpn.traverse((c) => {
      if (!(c instanceof THREE.Mesh)) return;
      c.castShadow = true;
      const prev = c.material as THREE.Material | THREE.Material[] | undefined;
      const existingMap = !Array.isArray(prev) && (prev as unknown as { map?: THREE.Texture })?.map
        ? (prev as unknown as { map: THREE.Texture }).map : null;
      if (Array.isArray(prev)) prev.forEach((m) => m.dispose?.());
      else prev?.dispose?.();
      c.material = new THREE.MeshStandardMaterial({
        map: existingMap,
        color: existingMap ? 0xffffff : 0xbfb59a,
        roughness: 0.55,
        metalness: 0.35,
        ...(this.envMap ? { envMap: this.envMap, envMapIntensity: 0.9 } : {}),
      });
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  update(dt: number): void { this.mixer?.update(dt); }

  setPosition(x: number, y: number, z: number): void { this.group.position.set(x, y, z); }
  setRotationY(rad: number): void { this.group.rotation.y = rad; }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    if (this.mainHandWeapon) disposeObject(this.mainHandWeapon);
    if (this.offHandWeapon) disposeObject(this.offHandWeapon);
    if (this.fbx) disposeObject(this.fbx);
    // The body texture is freed via its material map in disposeObject(fbx);
    // just drop the reference so a late TGA resolve hits the disposed guard.
    this.bodyTexture = null;
    this.group.parent?.remove(this.group);
    this.armorCatalog.clear();
  }
}
