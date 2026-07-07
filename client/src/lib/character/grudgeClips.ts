// Canonical semantic clip registry for the Grudge character pipeline.
//
// The six Toon-RTS race meshes are 3ds-Max **Biped** rigs. The animation
// libraries we ship (grudge6 packs + the legacy /models/player sword set) are
// **Mixamo** rigs. Each *source* FBX is loaded ONCE here (module-level cache,
// per the character-animation skill's "load each clip once" rule) and its
// rest-pose skeleton retained so `CharacterBuilder` can retarget the clip onto
// every race's Biped skeleton via `retargetClipTPose`.
//
// Consumers never touch raw FBX paths — they ask for SEMANTIC states
// (idle/walk/run/attack/...) and a `WeaponStyle`; `stateClipKeys` resolves the
// right source clip for that style's animation set.

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { stripRootMotion } from '@/lib/animation/clipUtils';
import { WEAPON_STYLE_CONFIGS, type WeaponStyle } from '@/data/toonRTSAssets';

export type CharState = 'idle' | 'walk' | 'run' | 'attack' | 'block' | 'cast' | 'death' | 'jump';

/** Semantic source-clip key → FBX path. */
export const CLIP_SOURCE_PATHS: Record<string, string> = {
  // grudge6 base locomotion (Mixamo)
  idle: '/animations/grudge6/locomotion/idle.fbx',
  walk: '/animations/grudge6/locomotion/walking.fbx',
  run: '/animations/grudge6/locomotion/running.fbx',
  jump: '/animations/grudge6/locomotion/jump.fbx',
  // grudge6 magic locomotion
  magic_idle: '/animations/grudge6/magic/standing-idle.fbx',
  magic_walk: '/animations/grudge6/magic/standing-walk-forward.fbx',
  magic_run: '/animations/grudge6/magic/standing-run-forward.fbx',
  // grudge6 gun (rifle)
  gun_idle: '/animations/grudge6/gun/rifle-aiming-idle.fbx',
  gun_run: '/animations/grudge6/gun/rifle-run.fbx',
  gun_fire: '/animations/grudge6/gun/firing-rifle.fbx',
  gun_reload: '/animations/grudge6/gun/reloading.fbx',
  // grudge6 pistol / wand
  pistol_idle: '/animations/grudge6/pistol/pistol-idle.fbx',
  pistol_run: '/animations/grudge6/pistol/pistol-run.fbx',
  // legacy sword & shield action set (no equivalent grudge6 melee attacks)
  idle_sword: '/models/player/sword and shield idle.fbx',
  run_sword: '/models/player/sword and shield run.fbx',
  attack: '/models/player/sword and shield slash.fbx',
  block: '/models/player/sword and shield block.fbx',
  cast: '/models/player/sword and shield casting.fbx',
  death: '/models/player/sword and shield death.fbx',
  // legacy longbow locomotion
  idle_bow: '/animations/locomotion/longbow/standing idle 01.fbx',
  run_bow: '/animations/locomotion/longbow/standing run forward.fbx',
};

// Locomotion clips whose forward/root translation must be removed so the
// character animates in place (the rig is driven by gameplay, not root motion).
const STRIP_ROOT_KEYS = new Set<string>([
  'walk', 'run', 'jump', 'magic_walk', 'magic_run', 'gun_run', 'pistol_run', 'run_sword', 'run_bow',
]);

export interface AnimSourceEntry {
  clip: THREE.AnimationClip;
  /** Rest-pose skeleton kept for retargeting. */
  sourceFBX: THREE.Group;
}

const sourceCache = new Map<string, AnimSourceEntry>();
const sourcePromises = new Map<string, Promise<AnimSourceEntry | null>>();
let sharedLoader: FBXLoader | null = null;

function loader(): FBXLoader {
  if (!sharedLoader) sharedLoader = new FBXLoader();
  return sharedLoader;
}

/** Synchronous accessor — returns null until `loadClipSource` has resolved. */
export function getSourceClip(key: string): AnimSourceEntry | null {
  return sourceCache.get(key) ?? null;
}

/** Load a single source clip FBX once; subsequent calls return the cache. */
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

  const p = new Promise<AnimSourceEntry | null>((resolve) => {
    loader().load(
      path,
      (fbx) => {
        let clip = fbx.animations?.[0];
        if (!clip) {
          console.warn(`[grudgeClips] no animation in ${path}`);
          resolve(null);
          return;
        }
        if (STRIP_ROOT_KEYS.has(key)) clip = stripRootMotion(clip);
        clip.name = key;
        const entry: AnimSourceEntry = { clip, sourceFBX: fbx as THREE.Group };
        sourceCache.set(key, entry);
        resolve(entry);
      },
      undefined,
      (err) => {
        console.warn(`[grudgeClips] failed to load ${path}:`, err);
        resolve(null);
      },
    );
  });
  sourcePromises.set(key, p);
  return p;
}

/** Load many source clips concurrently. */
export async function loadClipSources(keys: string[]): Promise<void> {
  await Promise.all(Array.from(new Set(keys)).map(loadClipSource));
}

/**
 * Resolve every semantic `CharState` to a source-clip key appropriate for the
 * weapon style's animation set. Melee styles share the legacy sword action set;
 * magic uses the grudge6 magic locomotion; bow/gun get ranged variants.
 */
export function stateClipKeys(style: WeaponStyle): Record<CharState, string> {
  const set = WEAPON_STYLE_CONFIGS[style].animationSet;
  switch (set) {
    case 'magic':
      return { idle: 'magic_idle', walk: 'magic_walk', run: 'magic_run', attack: 'cast', block: 'cast', cast: 'cast', death: 'death', jump: 'jump' };
    case 'ranged_bow':
      return { idle: 'idle_bow', walk: 'walk', run: 'run_bow', attack: 'attack', block: 'block', cast: 'cast', death: 'death', jump: 'jump' };
    case 'ranged_1h':
      return { idle: 'gun_idle', walk: 'walk', run: 'gun_run', attack: 'gun_fire', block: 'gun_reload', cast: 'gun_reload', death: 'death', jump: 'jump' };
    default: // melee_1h, melee_2h
      return { idle: 'idle_sword', walk: 'walk', run: 'run_sword', attack: 'attack', block: 'block', cast: 'cast', death: 'death', jump: 'jump' };
  }
}

/** Distinct source keys required to drive every state for a weapon style. */
export function clipKeysForStyle(style: WeaponStyle): string[] {
  return Array.from(new Set(Object.values(stateClipKeys(style))));
}
