/**
 * rig3d.ts — the single, reusable "apply a gear loadout to a 3D character"
 * helper. Works for BOTH character rigs:
 *   • Toon-RTS FBX rig (`CharacterBuilder`) — huge-unit Biped skeleton.
 *   • Faction Unit GLB rig (`UnitCharacter`) — Bip001 skeleton, GLTF units.
 *
 * The two rigs have wildly different bone/world scales, so weapon sizing here
 * is **rig-independent**: we measure the target bone's world scale and the
 * weapon GLB's native bounding box, then scale the weapon so its final WORLD
 * size matches a per-style target (a sword ends up ~0.85 world units long on
 * any rig). Rotation/grip offsets are scale-free and configured per style.
 *
 * Per-target state is kept in a WeakMap so re-applying a loadout disposes the
 * previous attachments (idempotent, leak-free).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ArmorMeshSlot, GearItem, WeaponStyleId } from '@shared/gameDefinitions/gear';
import { ARMOR_MESH_SLOTS } from '@shared/gameDefinitions/gear';
import type { ResolvedLoadout } from './loadout';

const gltfLoader = new GLTFLoader();

// ── Bone / armor discovery ─────────────────────────────────────────────────

const HAND_NAMES: Record<'right' | 'left', string[]> = {
  right: ['righthand', 'right_hand', 'r_hand', 'hand_r', 'r hand', 'bip001 r hand', 'mixamorigrighthand'],
  left: ['lefthand', 'left_hand', 'l_hand', 'hand_l', 'l hand', 'bip001 l hand', 'mixamoriglefthand'],
};
const HEAD_NAMES = ['bip001 head', 'head', 'mixamorighead', 'b_head'];

function norm(s: string): string {
  return s.toLowerCase().replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function findBoneByNames(root: THREE.Object3D, names: string[]): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((obj) => {
    if (found) return;
    const b = obj as THREE.Bone;
    if (!(b as any).isBone) return;
    const n = norm(b.name);
    if (names.some((cand) => n === cand || n.includes(cand))) found = b;
  });
  return found;
}

export function findHandBone(root: THREE.Object3D, side: 'right' | 'left'): THREE.Bone | null {
  return findBoneByNames(root, HAND_NAMES[side]);
}

export function findHeadBone(root: THREE.Object3D): THREE.Bone | null {
  return findBoneByNames(root, HEAD_NAMES);
}

const ARMOR_PATTERNS: Record<ArmorMeshSlot, RegExp> = {
  head: /(helmet|helm|hood|hat|crown|coif|cap[\s_]|mask)/i,
  shoulders: /(shoulder|pauldron|spaulder|epaulet)/i,
  chest: /(chest|breast|cuirass|torso|body[\s_]?armor|plate|robe|tunic|mail|vest)/i,
  hands: /(gauntlet|glove|vambrace|bracer|hand[\s_]?armor)/i,
  feet: /(boot|greave|sabaton|feet[\s_]?armor|shoe)/i,
  cape: /(cape|cloak|mantle|back[\s_]?armor)/i,
};

function ancestryName(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let cur: THREE.Object3D | null = obj;
  while (cur) { if (cur.name) parts.push(cur.name); cur = cur.parent; }
  return parts.join('/');
}

/** Group built-in skinned submeshes by the armor slot their name matches. */
export function buildArmorMeshCatalog(root: THREE.Object3D): Map<ArmorMeshSlot, THREE.Mesh[]> {
  const cat = new Map<ArmorMeshSlot, THREE.Mesh[]>();
  for (const s of ARMOR_MESH_SLOTS) cat.set(s, []);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = ancestryName(mesh);
    for (const slot of ARMOR_MESH_SLOTS) {
      if (ARMOR_PATTERNS[slot].test(name)) { cat.get(slot)!.push(mesh); break; }
    }
  });
  return cat;
}

// ── Per-style attach config (rig-independent) ──────────────────────────────
//
// Orientation is expressed in CHARACTER space, not as a fixed bone-local
// rotation. The two supported rigs (FBX Biped + GLB Bip001) have different
// rest-pose hand frames, so a single fixed local rotation cannot look correct
// on both. Instead we point the weapon's longest axis (grip → tip) along a
// desired direction *relative to the character root* and solve for the local
// rotation at attach time (see `attachModel`). The model is also re-centered on
// its grip point so the handle sits in the palm instead of floating away — the
// raw GLBs carry large, inconsistent origin offsets.

interface AttachConfig {
  /** Final length of the model's LARGEST extent in WORLD units (footprint control). */
  worldSize: number;
  /** Direction (character space) the primary axis should point, grip → tip. */
  dir: THREE.Vector3;
  /**
   * The model axis to treat as "primary" for orientation + grip (0=X, 1=Y, 2=Z).
   * Omit to auto-pick the longest AABB axis — correct for elongated weapons but
   * WRONG for stubby props (e.g. a crown, whose widest axis is its diameter, not
   * its height), so those set it explicitly.
   */
  axis?: 0 | 1 | 2;
  /** Where the hand grips along the primary axis: 0 = min (butt) end, 1 = tip end. */
  grip: number;
  /** Roll about the primary axis, radians (orients the flat of a blade / bow plane). */
  roll: number;
  /** Extra seating offset in CHARACTER space, world units (usually tiny/zero). */
  lateral: [number, number, number];
}

const UP: [number, number, number] = [0, 1, 0];

const STYLE_ATTACH: Record<WeaponStyleId, AttachConfig> = {
  sword_shield: { worldSize: 0.85, dir: new THREE.Vector3(...UP),        grip: 0.12, roll: 0, lateral: [0, 0, 0] },
  greatsword:   { worldSize: 1.4,  dir: new THREE.Vector3(...UP),        grip: 0.15, roll: 0, lateral: [0, 0, 0] },
  bow:          { worldSize: 1.15, dir: new THREE.Vector3(...UP),        grip: 0.5,  roll: 0, lateral: [0, 0, 0] },
  spear:        { worldSize: 1.9,  dir: new THREE.Vector3(...UP),        grip: 0.33, roll: 0, lateral: [0, 0, 0] },
  staff:        { worldSize: 1.6,  dir: new THREE.Vector3(...UP),        grip: 0.2,  roll: 0, lateral: [0, 0, 0] },
  gun:          { worldSize: 0.5,  dir: new THREE.Vector3(0, 0.4, 1),    grip: 0.5,  roll: 0, lateral: [0, 0, 0] },
  axe:          { worldSize: 0.95, dir: new THREE.Vector3(...UP),        grip: 0.12, roll: 0, lateral: [0, 0, 0] },
  mace_shield:  { worldSize: 0.9,  dir: new THREE.Vector3(...UP),        grip: 0.12, roll: 0, lateral: [0, 0, 0] },
};

const SHIELD_ATTACH: AttachConfig = { worldSize: 0.8, dir: new THREE.Vector3(...UP), grip: 0.5, roll: 0, lateral: [0, 0, 0] };
// A crown's widest AABB axis is its diameter, not its height, so pin the
// primary (vertical) axis explicitly and let worldSize control the diameter.
const CROWN_ATTACH: AttachConfig = { worldSize: 0.28, dir: new THREE.Vector3(...UP), axis: 1, grip: 0.08, roll: 0, lateral: [0, 0.03, 0] };

function attachConfigFor(item: GearItem): AttachConfig {
  if (item.slot === 'offhand') return SHIELD_ATTACH;
  if (item.attachBone === 'head') return CROWN_ATTACH;
  return STYLE_ATTACH[item.weaponStyle ?? 'sword_shield'];
}

// ── Attach a model to a bone with rig-independent sizing + orientation ───────

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _qBone = new THREE.Quaternion();
const _qRoot = new THREE.Quaternion();
const _qRel = new THREE.Quaternion();
const _qRelInv = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _L = new THREE.Vector3();
const _d = new THREE.Vector3();
const _off = new THREE.Vector3();

function attachModel(
  bone: THREE.Bone,
  root: THREE.Object3D,
  gltfScene: THREE.Object3D,
  cfg: AttachConfig,
): THREE.Object3D {
  const model = gltfScene;
  // A pivot group holds the model so we can rotate/scale about the grip point.
  const pivot = new THREE.Group();
  pivot.add(model);

  // Native bounding box (model has no transform yet → measured in its own space).
  _box.setFromObject(model);
  _box.getSize(_size);
  _box.getCenter(_center);
  const s = [_size.x, _size.y, _size.z];
  // Primary axis drives orientation + grip. Auto = longest AABB axis (right for
  // elongated weapons); overridden by cfg.axis for stubby props like the crown.
  const la = cfg.axis ?? (s[0] >= s[1] && s[0] >= s[2] ? 0 : s[1] >= s[2] ? 1 : 2);
  const laLen = s[la] || 1;
  const nativeMax = Math.max(s[0], s[1], s[2]) || 1; // largest extent → footprint

  // Re-center: bring the grip anchor to the pivot origin. Centered on the two
  // off-axes; a configurable fraction along the primary axis.
  _anchor.copy(_center);
  const minLong = la === 0 ? _box.min.x : la === 1 ? _box.min.y : _box.min.z;
  _anchor.setComponent(la, minLong + cfg.grip * laLen);
  model.position.copy(_anchor).multiplyScalar(-1);

  // Scale so the LARGEST extent ends up cfg.worldSize world units on any rig.
  // Normalizing by the largest extent (not the primary axis) keeps a crown's
  // diameter — not its short height — the thing that matches head size.
  bone.getWorldScale(_sc);
  const boneScaleMax = Math.max(_sc.x, _sc.y, _sc.z) || 1;
  pivot.scale.setScalar(cfg.worldSize / nativeMax / boneScaleMax);

  // Orientation: point the primary axis (grip → tip) along cfg.dir in character
  // space, solved against the bone's current world frame so it is correct on
  // both rigs regardless of their rest-pose hand orientation.
  bone.updateWorldMatrix(true, false);
  root.updateWorldMatrix(true, false);
  bone.getWorldQuaternion(_qBone);
  root.getWorldQuaternion(_qRoot);
  _qRel.copy(_qRoot).invert().multiply(_qBone); // hand orientation relative to root
  _qRelInv.copy(_qRel).invert();
  _L.set(0, 0, 0).setComponent(la, 1);          // weapon long-axis unit vector
  _d.copy(cfg.dir).normalize().applyQuaternion(_qRelInv);
  _qp.setFromUnitVectors(_L, _d.normalize());
  if (cfg.roll) { _qRoll.setFromAxisAngle(_L, cfg.roll); _qp.multiply(_qRoll); }
  pivot.quaternion.copy(_qp);

  // Optional seating nudge, expressed in character space → bone-local.
  if (cfg.lateral[0] || cfg.lateral[1] || cfg.lateral[2]) {
    _off.set(cfg.lateral[0], cfg.lateral[1], cfg.lateral[2])
      .applyQuaternion(_qRoot)                        // char → world
      .applyQuaternion(_qBone.clone().invert())       // world → bone-local
      .divideScalar(boneScaleMax);
    pivot.position.copy(_off);
  }

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }
  });

  bone.add(pivot);
  return pivot;
}

function disposeAttached(obj: THREE.Object3D | null): void {
  if (!obj) return;
  obj.removeFromParent();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.());
    else mat?.dispose?.();
  });
}

// ── Rig descriptor + apply ──────────────────────────────────────────────────

export interface Rig3D {
  root: THREE.Object3D;
  rightHand: THREE.Bone | null;
  leftHand: THREE.Bone | null;
  headBone?: THREE.Bone | null;
  /** Pre-built armor catalog (CharacterBuilder passes its own); auto-built otherwise. */
  armorCatalog?: Map<ArmorMeshSlot, THREE.Mesh[]>;
  /** Optional armor toggle override (CharacterBuilder reuses equipArmorVariant). */
  toggleArmor?: (slot: ArmorMeshSlot, equipped: boolean) => void;
  /** Returns true once the owning rig has been disposed — abort async loads. */
  isDisposed?: () => boolean;
}

interface RigState {
  armorCatalog: Map<ArmorMeshSlot, THREE.Mesh[]>;
  attached: Partial<Record<'weapon' | 'offhand' | 'accessory', THREE.Object3D>>;
  /** monotonically increasing per (rig,mount) to guard against out-of-order loads */
  token: Partial<Record<'weapon' | 'offhand' | 'accessory', number>>;
}

const stateMap = new WeakMap<THREE.Object3D, RigState>();

function stateFor(rig: Rig3D): RigState {
  let s = stateMap.get(rig.root);
  if (!s) {
    s = {
      armorCatalog: rig.armorCatalog ?? buildArmorMeshCatalog(rig.root),
      attached: {},
      token: {},
    };
    stateMap.set(rig.root, s);
  } else if (rig.armorCatalog && s.armorCatalog !== rig.armorCatalog) {
    s.armorCatalog = rig.armorCatalog;
  }
  return s;
}

function toggleArmorSlot(rig: Rig3D, state: RigState, slot: ArmorMeshSlot, equipped: boolean): void {
  if (rig.toggleArmor) { rig.toggleArmor(slot, equipped); return; }
  const meshes = state.armorCatalog.get(slot) ?? [];
  meshes.forEach((m) => { m.visible = equipped; });
}

function mountFor(item: GearItem): 'weapon' | 'offhand' | 'accessory' {
  if (item.slot === 'offhand') return 'offhand';
  if (item.slot === 'weapon') return 'weapon';
  return 'accessory';
}

function boneFor(rig: Rig3D, item: GearItem): THREE.Bone | null {
  const which = item.attachBone
    ?? (item.slot === 'offhand' ? 'leftHand' : item.slot === 'weapon' ? 'rightHand' : 'rightHand');
  if (which === 'head') return rig.headBone ?? findHeadBone(rig.root);
  if (which === 'leftHand') return rig.leftHand;
  return rig.rightHand;
}

/**
 * Apply a resolved loadout to a 3D character. Attaches weapon/offhand/accessory
 * models to their bones and toggles built-in armor submeshes. Safe to call
 * repeatedly (diffs against previous state) and safe on partial loadouts.
 */
export function applyLoadout3D(rig: Rig3D, resolved: ResolvedLoadout): void {
  const state = stateFor(rig);

  // ── Bone-attached models: weapon, offhand, accessory ──────────────────────
  const modelSlots: GearItem[] = [];
  for (const slot of ['weapon', 'offhand', 'accessory'] as const) {
    const item = resolved[slot];
    if (item?.modelPath) modelSlots.push(item);
  }

  const wantMounts = new Set(modelSlots.map(mountFor));
  // clear mounts that are no longer wanted
  (['weapon', 'offhand', 'accessory'] as const).forEach((mount) => {
    if (!wantMounts.has(mount) && state.attached[mount]) {
      disposeAttached(state.attached[mount]!);
      state.attached[mount] = undefined;
      state.token[mount] = (state.token[mount] ?? 0) + 1;
    }
  });

  for (const item of modelSlots) {
    const mount = mountFor(item);
    const bone = boneFor(rig, item);
    if (!bone) continue;
    const token = (state.token[mount] ?? 0) + 1;
    state.token[mount] = token;
    // dispose any existing attachment on this mount before loading the new one
    if (state.attached[mount]) {
      disposeAttached(state.attached[mount]!);
      state.attached[mount] = undefined;
    }
    const cfg = attachConfigFor(item);
    gltfLoader.load(
      item.modelPath!,
      (gltf) => {
        if (rig.isDisposed?.() || state.token[mount] !== token) {
          disposeAttached(gltf.scene);
          return;
        }
        state.attached[mount] = attachModel(bone, rig.root, gltf.scene, cfg);
      },
      undefined,
      (err) => console.warn(`[rig3d] failed to load ${item.modelPath}`, err),
    );
  }

  // ── Armor submesh toggles ────────────────────────────────────────────────
  for (const slot of ARMOR_MESH_SLOTS) {
    const equipped = !!resolved[slot];
    toggleArmorSlot(rig, state, slot, equipped);
  }
}

/** Dispose all gear attachments for a rig root (call from rig cleanup). */
export function disposeLoadout3D(root: THREE.Object3D): void {
  const s = stateMap.get(root);
  if (!s) return;
  (['weapon', 'offhand', 'accessory'] as const).forEach((mount) => {
    if (s.attached[mount]) disposeAttached(s.attached[mount]!);
  });
  stateMap.delete(root);
}
