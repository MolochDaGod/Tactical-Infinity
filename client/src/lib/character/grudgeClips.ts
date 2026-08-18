// Canonical semantic clip registry for the Grudge character pipeline.
//
// Source packs (Mixamo-style FBX + creator melee GLBs) live same-origin under:
//   client/public/animations/grudge6/{locomotion,magic,gun,pistol,action,farming,8way,melee}/
//
// The six Toon-RTS race meshes are 3ds-Max **Biped** rigs. Pack clips are
// **Mixamo** (or Synty) sources. Each clip is loaded ONCE (module-level cache —
// character-animation skill "load each clip once") and its rest-pose skeleton is
// kept so CharacterBuilder can retarget onto every race via retargetClipTPose.
//
// Consumers never touch raw paths — they ask for SEMANTIC states
// (idle/walk/run/attack/…) and a WeaponStyle; stateClipKeys resolves the right
// source key for that style's animation set.
//
// HARD RULE: /animations/grudge6/** is ALWAYS same-origin first. CDN keys for
// these packs historically 404; do not route them through assets CDN rewrite.

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { stripRootMotion } from '@/lib/animation/clipUtils';
import { WEAPON_STYLE_CONFIGS, type WeaponStyle } from '@/data/toonRTSAssets';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';

/** Gameplay states CharacterBuilder / battle controllers request. */
export type CharState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'attack'
  | 'attack_heavy'
  | 'block'
  | 'cast'
  | 'death'
  | 'jump'
  | 'harvest'
  | 'reload'
  | 'strafe_left'
  | 'strafe_right';

const G6 = '/animations/grudge6';

/**
 * Semantic source-clip key → public path.
 * Prefer staged grudge6 packs (Mixamo FBX). Melee attack/death use creator GLBs
 * until a dedicated sword_shield FBX pack is staged.
 */
export const CLIP_SOURCE_PATHS: Record<string, string> = {
  // ── Base locomotion (grudge6 Locomotion Pack) ───────────────────────────
  idle: `${G6}/locomotion/idle.fbx`,
  walk: `${G6}/locomotion/walking.fbx`,
  run: `${G6}/locomotion/running.fbx`,
  jump: `${G6}/locomotion/jump.fbx`,
  strafe_left: `${G6}/locomotion/strafe-left.fbx`,
  strafe_right: `${G6}/locomotion/strafe-right.fbx`,
  strafe_walk_left: `${G6}/locomotion/strafe-walk-left.fbx`,
  strafe_walk_right: `${G6}/locomotion/strafe-walk-right.fbx`,
  turn_left: `${G6}/locomotion/turn-left.fbx`,
  turn_right: `${G6}/locomotion/turn-right.fbx`,

  // ── Action Adventure (generic combat-ready loco + parkour) ──────────────
  action_idle: `${G6}/action/idle.fbx`,
  action_walk: `${G6}/action/walking.fbx`,
  action_run: `${G6}/action/running.fbx`,
  action_jump: `${G6}/action/jumping-up.fbx`,
  action_fall: `${G6}/action/falling-idle.fbx`,
  action_roll: `${G6}/action/falling-to-roll.fbx`,
  action_land: `${G6}/action/hard-landing.fbx`,
  action_run_stop: `${G6}/action/run-to-stop.fbx`,

  // ── Sword & Shield (Mixamo Pro/Lite pack — SSOT for melee_1h) ───────────
  idle_sword: `${G6}/sword_shield/idle.fbx`,
  walk_sword: `${G6}/sword_shield/walk.fbx`,
  run_sword: `${G6}/sword_shield/run.fbx`,
  jump_sword: `${G6}/sword_shield/jump.fbx`,
  attack: `${G6}/sword_shield/slash.fbx`,
  attack_heavy: `${G6}/sword_shield/attack.fbx`,
  block: `${G6}/sword_shield/block.fbx`,
  cast: `${G6}/sword_shield/casting.fbx`,
  death: `${G6}/sword_shield/death.fbx`,
  kick: `${G6}/sword_shield/kick.fbx`,
  impact: `${G6}/sword_shield/impact.fbx`,
  draw_sword: `${G6}/sword_shield/draw.fbx`,
  sheath_sword: `${G6}/sword_shield/sheath.fbx`,
  // Extra combat variants
  slash_advance: `${G6}/sword_shield/slash-advance.fbx`,
  thrust_slash: `${G6}/sword_shield/thrust-slash.fbx`,
  two_hand_combo: `${G6}/sword_shield/two-hand-combo.fbx`,
  melee_combo: `${G6}/sword_shield/melee-combo-v2.fbx`,

  // ── Great sword (melee_2h) ──────────────────────────────────────────────
  gs_idle: `${G6}/greatsword/idle.fbx`,
  gs_walk: `${G6}/greatsword/walk.fbx`,
  gs_run: `${G6}/greatsword/run.fbx`,
  gs_jump: `${G6}/greatsword/jump.fbx`,
  gs_slash: `${G6}/greatsword/slash.fbx`,
  gs_cast: `${G6}/greatsword/casting.fbx`,
  gs_slide: `${G6}/greatsword/great-sword-slide-attack.fbx`,

  // Creator GLB + Synty fallbacks (kept for non-melee emergencies / tools)
  melee_glb_idle: `${G6}/melee/anim-idle.glb`,
  melee_glb_attack: `${G6}/melee/anim-attack.glb`,
  melee_glb_death: `${G6}/melee/anim-death.glb`,
  synty_idle: `${G6}/melee/synty-idle.fbx`,
  synty_walk: `${G6}/melee/synty-walk.fbx`,
  synty_run: `${G6}/melee/synty-run.fbx`,
  synty_jump: `${G6}/melee/synty-jump.fbx`,

  // ── Magic locomotion (grudge6 Magic Locomotion Pack) ────────────────────
  magic_idle: `${G6}/magic/standing-idle.fbx`,
  magic_walk: `${G6}/magic/standing-walk-forward.fbx`,
  magic_run: `${G6}/magic/standing-run-forward.fbx`,
  magic_sprint: `${G6}/magic/standing-sprint-forward.fbx`,
  magic_walk_back: `${G6}/magic/standing-walk-back.fbx`,
  magic_run_back: `${G6}/magic/standing-run-back.fbx`,
  magic_walk_left: `${G6}/magic/standing-walk-left.fbx`,
  magic_walk_right: `${G6}/magic/standing-walk-right.fbx`,
  magic_run_left: `${G6}/magic/standing-run-left.fbx`,
  magic_run_right: `${G6}/magic/standing-run-right.fbx`,
  magic_jump: `${G6}/magic/standing-jump.fbx`,
  magic_land: `${G6}/magic/standing-land-to-idle.fbx`,

  // ── Gun / rifle (grudge6gun + slim reloading) ───────────────────────────
  gun_idle: `${G6}/gun/rifle-aiming-idle.fbx`,
  gun_walk: `${G6}/gun/walking.fbx`,
  gun_run: `${G6}/gun/rifle-run.fbx`,
  gun_fire: `${G6}/gun/firing-rifle.fbx`,
  gun_reload: `${G6}/gun/reloading.fbx`,
  gun_jump: `${G6}/gun/rifle-jump.fbx`,
  gun_walk_back: `${G6}/gun/walking-backwards.fbx`,
  gun_run_back: `${G6}/gun/run-backwards.fbx`,
  gun_strafe_left: `${G6}/gun/strafe-left.fbx`,
  gun_strafe_right: `${G6}/gun/strafe-right.fbx`,
  gun_hit: `${G6}/gun/hit-reaction.fbx`,
  gun_grenade: `${G6}/gun/toss-grenade.fbx`,

  // ── Pistol (grudgepistol pack) ──────────────────────────────────────────
  pistol_idle: `${G6}/pistol/pistol-idle.fbx`,
  pistol_walk: `${G6}/pistol/pistol-walk.fbx`,
  pistol_run: `${G6}/pistol/pistol-run.fbx`,
  pistol_jump: `${G6}/pistol/pistol-jump.fbx`,
  pistol_walk_back: `${G6}/pistol/pistol-walk-backward.fbx`,
  pistol_run_back: `${G6}/pistol/pistol-run-backward.fbx`,
  pistol_strafe: `${G6}/pistol/pistol-strafe.fbx`,
  pistol_kneel: `${G6}/pistol/pistol-kneeling-idle.fbx`,

  // ── Farming / harvest (grudgeFarming Pack) ──────────────────────────────
  harvest: `${G6}/farming/dig-and-plant-seeds.fbx`,
  harvest_water: `${G6}/farming/watering.fbx`,
  harvest_pull: `${G6}/farming/pull-plant.fbx`,
  harvest_pick: `${G6}/farming/pick-fruit.fbx`,
  harvest_plant: `${G6}/farming/plant-a-plant.fbx`,
  harvest_tree: `${G6}/farming/plant-tree.fbx`,
  hold_idle: `${G6}/farming/holding-idle.fbx`,
  hold_walk: `${G6}/farming/holding-walk.fbx`,
  kneel_idle: `${G6}/farming/kneeling-idle.fbx`,

  // ── Longbow: no dedicated pack yet — use base loco + melee attack pose ──
  idle_bow: `${G6}/locomotion/idle.fbx`,
  run_bow: `${G6}/locomotion/running.fbx`,

  // ── 8-way primary aliases (for advanced controllers) ────────────────────
  '8way_idle': `${G6}/8way/idle.fbx`,
  '8way_walk_f': `${G6}/8way/walk-forward.fbx`,
  '8way_walk_b': `${G6}/8way/walk-backward.fbx`,
  '8way_walk_l': `${G6}/8way/walk-left.fbx`,
  '8way_walk_r': `${G6}/8way/walk-right.fbx`,
  '8way_run_f': `${G6}/8way/run-forward.fbx`,
  '8way_run_b': `${G6}/8way/run-backward.fbx`,
  '8way_sprint_f': `${G6}/8way/sprint-forward.fbx`,
  '8way_death_front': `${G6}/8way/death-from-the-front.fbx`,
};

/** Locomotion clips that must animate in place (game code drives world position). */
const STRIP_ROOT_KEYS = new Set<string>([
  'walk', 'run', 'jump', 'sprint',
  'strafe_left', 'strafe_right', 'strafe_walk_left', 'strafe_walk_right',
  'action_walk', 'action_run', 'action_jump', 'action_fall', 'action_roll',
  'walk_sword', 'run_sword', 'jump_sword',
  'gs_walk', 'gs_run', 'gs_jump', 'gs_slide',
  'slash_advance', 'thrust_slash',
  'synty_walk', 'synty_run', 'synty_jump',
  'magic_walk', 'magic_run', 'magic_sprint', 'magic_walk_back', 'magic_run_back',
  'magic_walk_left', 'magic_walk_right', 'magic_run_left', 'magic_run_right', 'magic_jump',
  'gun_walk', 'gun_run', 'gun_jump', 'gun_walk_back', 'gun_run_back',
  'gun_strafe_left', 'gun_strafe_right',
  'pistol_walk', 'pistol_run', 'pistol_jump', 'pistol_walk_back', 'pistol_run_back', 'pistol_strafe',
  'hold_walk',
  'run_bow',
  '8way_walk_f', '8way_walk_b', '8way_walk_l', '8way_walk_r',
  '8way_run_f', '8way_run_b', '8way_sprint_f',
]);

export interface AnimSourceEntry {
  clip: THREE.AnimationClip;
  /** Rest-pose skeleton kept for retargeting. */
  sourceFBX: THREE.Group;
}

const sourceCache = new Map<string, AnimSourceEntry>();
const sourcePromises = new Map<string, Promise<AnimSourceEntry | null>>();
let sharedFbxLoader: FBXLoader | null = null;
let sharedGltfLoader: GLTFLoader | null = null;

function fbxLoader(): FBXLoader {
  if (!sharedFbxLoader) sharedFbxLoader = new FBXLoader();
  return sharedFbxLoader;
}
function gltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) sharedGltfLoader = new GLTFLoader();
  return sharedGltfLoader;
}

/**
 * Resolve clip URL. Staged grudge6 packs stay same-origin (CDN 404 history).
 * Other assets may still use the assets CDN rewrite.
 */
export function resolveClipUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/animations/grudge6/')) return normalized;
  return resolveGrudgeAssetUrl(normalized);
}

/** Synchronous accessor — returns null until `loadClipSource` has resolved. */
export function getSourceClip(key: string): AnimSourceEntry | null {
  return sourceCache.get(key) ?? null;
}

function finishEntry(
  key: string,
  path: string,
  clip: THREE.AnimationClip | undefined,
  root: THREE.Group,
  resolve: (e: AnimSourceEntry | null) => void,
): void {
  if (!clip) {
    console.warn(`[grudgeClips] no animation in ${path}`);
    resolve(null);
    return;
  }
  let out = clip;
  if (STRIP_ROOT_KEYS.has(key)) out = stripRootMotion(clip);
  out.name = key;
  const entry: AnimSourceEntry = { clip: out, sourceFBX: root };
  sourceCache.set(key, entry);
  resolve(entry);
}

/** Load a single source clip once; subsequent calls return the cache. */
export function loadClipSource(key: string): Promise<AnimSourceEntry | null> {
  const cached = sourceCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = sourcePromises.get(key);
  if (pending) return pending;

  const path = CLIP_SOURCE_PATHS[key];
  if (!path) {
    console.warn(`[grudgeClips] unknown clip key "${key}"`);
    return Promise.resolve(null);
  }

  const url = resolveClipUrl(path);
  const isGlb = /\.glb($|\?)/i.test(path) || /\.gltf($|\?)/i.test(path);

  const p = new Promise<AnimSourceEntry | null>((resolve) => {
    if (isGlb) {
      gltfLoader().load(
        url,
        (gltf) => {
          const clip = gltf.animations?.[0];
          const root = (gltf.scene as THREE.Group) ?? new THREE.Group();
          finishEntry(key, path, clip, root, resolve);
        },
        undefined,
        (err) => {
          console.warn(`[grudgeClips] failed to load ${url}:`, err);
          resolve(null);
        },
      );
    } else {
      fbxLoader().load(
        url,
        (fbx) => {
          const clip = fbx.animations?.[0];
          finishEntry(key, path, clip, fbx as THREE.Group, resolve);
        },
        undefined,
        (err) => {
          console.warn(`[grudgeClips] failed to load ${url}:`, err);
          resolve(null);
        },
      );
    }
  });
  sourcePromises.set(key, p);
  return p;
}

/** Load many source clips concurrently. */
export async function loadClipSources(keys: string[]): Promise<void> {
  await Promise.all(Array.from(new Set(keys)).map(loadClipSource));
}

/**
 * Resolve every semantic CharState → source-clip key for a weapon style.
 * Pack mapping (SSOT):
 *   melee_1h  → sword_shield Mixamo pack (idle/walk/run/slash/block/cast/death)
 *   melee_2h  → greatsword pack (slash/run) with sword_shield death fallback
 *   magic     → magic locomotion + sword_shield casting for cast pose
 *   ranged_1h → gun pack (idle/walk/run/fire/reload)
 *   ranged_bow→ base loco + sword slash until longbow pack
 */
export function stateClipKeys(style: WeaponStyle): Record<CharState, string> {
  const set = WEAPON_STYLE_CONFIGS[style].animationSet;
  const base: Record<CharState, string> = {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    sprint: 'run',
    attack: 'attack',
    attack_heavy: 'attack_heavy',
    block: 'block',
    cast: 'cast',
    death: 'death',
    jump: 'jump',
    harvest: 'harvest',
    reload: 'gun_reload',
    strafe_left: 'strafe_left',
    strafe_right: 'strafe_right',
  };

  switch (set) {
    case 'magic':
      return {
        ...base,
        idle: 'magic_idle',
        walk: 'magic_walk',
        run: 'magic_run',
        sprint: 'magic_sprint',
        attack: 'cast',
        attack_heavy: 'cast',
        block: 'magic_idle',
        cast: 'cast',
        jump: 'magic_jump',
        death: 'death',
        strafe_left: 'magic_walk_left',
        strafe_right: 'magic_walk_right',
      };
    case 'ranged_bow':
      return {
        ...base,
        idle: 'idle_bow',
        walk: 'walk',
        run: 'run_bow',
        sprint: 'run_bow',
        attack: 'attack',
        attack_heavy: 'attack_heavy',
      };
    case 'ranged_1h':
      return {
        ...base,
        idle: 'gun_idle',
        walk: 'gun_walk',
        run: 'gun_run',
        sprint: 'gun_run',
        attack: 'gun_fire',
        attack_heavy: 'gun_fire',
        block: 'gun_reload',
        cast: 'gun_grenade',
        jump: 'gun_jump',
        reload: 'gun_reload',
        death: 'death',
        strafe_left: 'gun_strafe_left',
        strafe_right: 'gun_strafe_right',
      };
    case 'melee_2h':
      return {
        ...base,
        idle: 'gs_idle',
        walk: 'gs_walk',
        run: 'gs_run',
        sprint: 'gs_run',
        attack: 'gs_slash',
        attack_heavy: 'gs_slide',
        block: 'block',
        cast: 'gs_cast',
        death: 'death',
        jump: 'gs_jump',
      };
    default: // melee_1h — sword_shield SSOT
      return {
        ...base,
        idle: 'idle_sword',
        walk: 'walk_sword',
        run: 'run_sword',
        sprint: 'run_sword',
        attack: 'attack',
        attack_heavy: 'attack_heavy',
        block: 'block',
        cast: 'cast',
        death: 'death',
        jump: 'jump_sword',
      };
  }
}

/** Distinct source keys required to drive every state for a weapon style. */
export function clipKeysForStyle(style: WeaponStyle): string[] {
  return Array.from(new Set(Object.values(stateClipKeys(style))));
}

/** All registered clip keys (for tools / QA). */
export function listClipKeys(): string[] {
  return Object.keys(CLIP_SOURCE_PATHS);
}

/** Pack folder → description (for admin / deploy docs). */
export const ANIM_PACK_META = {
  locomotion: 'grudge6 Locomotion Pack — base idle/walk/run/jump/strafe',
  magic: 'grudge6 Magic Locomotion Pack — staff/mage gait',
  gun: 'grudge6gun + Slim Shooter reload — rifle aim/fire/reload',
  pistol: 'grudgepistol / wandandpistols — handgun loco',
  action: 'grudge Action Adventure Pack — combat-ready loco + parkour',
  farming: 'grudge Farming Pack — harvest/plant/hold',
  '8way': 'grudge 8-Way Locomotion Pack — full 8-dir + crouch + deaths',
  sword_shield: 'Sword and Shield Pack + Lite death — melee_1h SSOT',
  greatsword: 'Great Sword Pack — melee_2h SSOT',
  melee: 'grudge6-creator GLB + Synty — emergency fallbacks only',
} as const;
