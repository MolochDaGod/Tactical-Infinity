/**
 * Animated enemy loader for /battle.
 *
 * Loads the canonical baked-GLB faction characters
 * (`public/models/characters/<faction>/<raceSlug>_<class>.glb`) — each ships its
 * OWN Bip001 skeleton, its weapon BAKED INTO THE MESH, and 47-55 baked clips
 * (idle/walk/run/attack/…). We keep a per-model master template and produce
 * lightweight per-enemy clones via `SkeletonUtils.clone` so each wave spawn has
 * its own `THREE.AnimationMixer` while every `AnimationClip` object is reused
 * (the sbcode shared-clip pattern in `.agents/skills/character-animation`).
 *
 * This replaces the retired Toon-RTS FBX + TGA pipeline. No external weapon
 * attach and no cross-rig retargeting — every enemy plays its OWN baked clips.
 * The public API (`preloadAnimatedEnemyAssets` / `cloneAnimatedEnemy` /
 * `isAnimatedEnemyReady` / `clearAnimatedEnemyCache`) is unchanged, so the Yuka
 * enemy AI driving these instances needs no changes.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Race, Faction } from '@/data/toonRTSAssets';
import { resolveUnitModel } from '@/lib/character/unitModel';
import type { UnitClass } from '@/data/factionUnits';
import type { AIEnemyConfig } from '@/lib/yukaEnemyAI';

/** Every enemy is auto-fit to roughly this world height. */
const TARGET_HEIGHT = 1.7;

// Battle factions in `AIEnemyConfig.faction` predate the strict 3-faction
// model. Map each one to a canonical race so we still get visual variety per
// wave while honoring the 3-faction rule.
export const BATTLE_FACTION_RACE: Record<AIEnemyConfig['faction'], Race> = {
  raider: 'barbarian',  // Crusade — savage berserker
  bandit: 'human',      // Crusade — armored thug
  beast: 'orc',         // Legion — green-skin brute
  legion: 'orc',        // Legion — orc shock troop
  undead: 'undead',     // Legion — skeletal soldier
};

// Which baked class-build (and therefore which baked weapon) each battle faction
// fields. Weapon is baked into the GLB, so this drives the enemy's visible arms.
export const BATTLE_FACTION_CLASS: Record<AIEnemyConfig['faction'], UnitClass> = {
  raider: 'warrior', // greatsword / axe berserker
  bandit: 'knight',  // sword + shield thug
  beast: 'warrior',  // spear / axe brute
  legion: 'knight',  // sword + shield shock troop
  undead: 'mage',    // staff caster
};

const FACTION_BY_RACE: Record<Race, Faction> = {
  human: 'crusade',
  barbarian: 'crusade',
  dwarf: 'fabled',
  elf: 'fabled',
  orc: 'legion',
  undead: 'legion',
};

interface UnitTemplate {
  scene: THREE.Group;                          // Master — never added to a live scene; only cloned
  clipMap: Map<string, THREE.AnimationClip>;   // key: lowercase normalized clip name
  fitScale: number;                            // Uniform scale to reach TARGET_HEIGHT
}

const gltfLoader = new GLTFLoader();

/** Templates keyed by GLB path so factions sharing a model load only once. */
const templates = new Map<string, UnitTemplate>();
let preloadPromise: Promise<void> | null = null;

/** Resolve the GLB path for a battle faction (race + class → baked build). */
function factionModelPath(faction: AIEnemyConfig['faction']): string | null {
  const race = BATTLE_FACTION_RACE[faction];
  const cls = BATTLE_FACTION_CLASS[faction];
  return resolveUnitModel(race, { unitClass: cls })?.path ?? null;
}

/** Strip clip names so 'Armature|Idle_v2' → 'idle v2' (GLB names are usually clean). */
function normalizeClipName(name: string): string {
  return name
    .replace(/^.*?\|/g, '')
    .replace(/[_\-]+/g, ' ')
    .toLowerCase()
    .trim();
}

async function loadUnitTemplate(path: string): Promise<UnitTemplate | null> {
  let scene: THREE.Group;
  let animations: THREE.AnimationClip[];
  try {
    const gltf = await gltfLoader.loadAsync(path);
    scene = gltf.scene as THREE.Group;
    animations = gltf.animations ?? [];
  } catch (err) {
    console.warn(`[animatedEnemyLoader] GLB failed for ${path}:`, err);
    return null;
  }

  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // skinned meshes: bounds move with the skeleton
    }
  });

  // Auto-fit scale so clones stand ~TARGET_HEIGHT tall.
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(scene).getSize(size);
  const fitScale = TARGET_HEIGHT / (size.y || 1);

  // Index every baked clip by normalized name.
  const clipMap = new Map<string, THREE.AnimationClip>();
  animations.forEach((clip) => {
    const key = normalizeClipName(clip.name);
    if (key && !clipMap.has(key)) clipMap.set(key, clip);
  });

  return { scene, clipMap, fitScale };
}

/**
 * Preload every battle faction's baked GLB once, in parallel. Idempotent —
 * repeat calls return the same promise. Call from `IslandBattlePage` before the
 * first wave so `spawnEnemy` can synchronously clone fully-rigged characters.
 */
export function preloadAnimatedEnemyAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  const paths = Array.from(
    new Set(
      (Object.keys(BATTLE_FACTION_RACE) as AIEnemyConfig['faction'][])
        .map(factionModelPath)
        .filter((p): p is string => !!p),
    ),
  );

  preloadPromise = Promise.all(
    paths.map(async (path) => {
      if (templates.has(path)) return;
      const tmpl = await loadUnitTemplate(path);
      if (tmpl) templates.set(path, tmpl);
    }),
  ).then(() => undefined);

  return preloadPromise;
}

export function isAnimatedEnemyReady(): boolean {
  return templates.size > 0;
}

/** Find the first clip whose normalized name contains any of the given tokens. */
function findClip(
  clipMap: Map<string, THREE.AnimationClip>,
  tokens: string[],
): THREE.AnimationClip | null {
  for (const tok of tokens) {
    for (const [key, clip] of clipMap) {
      if (key.includes(tok)) return clip;
    }
  }
  return null;
}

export interface AnimatedEnemyInstance {
  group: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: {
    idle: THREE.AnimationAction | null;
    walk: THREE.AnimationAction | null;
    attack: THREE.AnimationAction | null;
    death: THREE.AnimationAction | null;
  };
  current: THREE.AnimationAction | null;
  /** Crossfade-in `next`, fade-out current. No-op if `next` is null or already current. */
  play(next: THREE.AnimationAction | null, fade?: number): void;
  /** Play `attack` once (clamped) then return to `idle`. Safe to spam. */
  playOnce(action: THREE.AnimationAction | null, onDone?: () => void): void;
  /** Free GPU resources unique to this clone (geometry only — material is shared). */
  dispose(): void;
}

/**
 * Clone a fully-rigged enemy from the preloaded template. The skinned mesh is
 * cloned via SkeletonUtils so each enemy has its own bone matrices, but all
 * `AnimationClip` objects are reused — only the mixer + actions are per-instance.
 *
 * Returns `null` if the template hasn't been preloaded yet (caller should fall
 * back to the primitive enemy mesh).
 */
export function cloneAnimatedEnemy(
  faction: AIEnemyConfig['faction'],
): AnimatedEnemyInstance | null {
  const path = factionModelPath(faction);
  const tmpl = path ? templates.get(path) : null;
  if (!tmpl) return null;

  // Wrapper the AI positions/rotates; the scaled + feet-seated clone lives inside.
  const wrapper = new THREE.Group();
  const cloned = cloneSkinned(tmpl.scene) as THREE.Group;
  cloned.scale.setScalar(tmpl.fitScale);
  const box = new THREE.Box3().setFromObject(cloned);
  cloned.position.y -= box.min.y; // seat feet on the wrapper origin
  wrapper.add(cloned);

  const mixer = new THREE.AnimationMixer(cloned);

  const idleClip   = findClip(tmpl.clipMap, ['idle', 'stand']);
  const walkClip   = findClip(tmpl.clipMap, ['walk', 'run', 'move']);
  const attackClip = findClip(tmpl.clipMap, ['attack', 'slash', 'swing', 'strike', 'punch']);
  const deathClip  = findClip(tmpl.clipMap, ['death', 'die', 'dead', 'defeat']);

  // Fall back to the first available clip so an enemy never stands frozen.
  const anyClip = tmpl.clipMap.values().next().value as THREE.AnimationClip | undefined;

  const mkAction = (clip: THREE.AnimationClip | null, looping: boolean): THREE.AnimationAction | null => {
    const c = clip ?? anyClip ?? null;
    if (!c) return null;
    const a = mixer.clipAction(c);
    if (looping) {
      a.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    return a;
  };

  const actions = {
    idle:   mkAction(idleClip,   true),
    walk:   mkAction(walkClip,   true),
    attack: mkAction(attackClip, false),
    death:  mkAction(deathClip,  false),
  };

  const inst: AnimatedEnemyInstance = {
    group: wrapper,
    mixer,
    actions,
    current: null,
    play(next, fade = 0.2) {
      if (!next || next === inst.current) return;
      if (inst.current) inst.current.fadeOut(fade);
      next.reset().fadeIn(fade).play();
      inst.current = next;
    },
    playOnce(action, onDone) {
      if (!action) return;
      const fade = 0.1;
      if (inst.current && inst.current !== action) inst.current.fadeOut(fade);
      action.reset().fadeIn(fade).play();
      inst.current = action;
      if (onDone) {
        const handler = (ev: { action: THREE.AnimationAction }) => {
          if (ev.action !== action) return;
          mixer.removeEventListener('finished', handler);
          onDone();
        };
        mixer.addEventListener('finished', handler);
      }
    },
    dispose() {
      mixer.stopAllAction();
      cloned.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry && (m.geometry as THREE.BufferGeometry).dispose) {
          // Skinned geometry is per-instance from SkeletonUtils.clone — safe to free.
          (m.geometry as THREE.BufferGeometry).dispose();
        }
      });
    },
  };

  // Auto-start idle so a freshly spawned enemy is never in T-pose.
  if (actions.idle) inst.play(actions.idle, 0);
  return inst;
}

/** Free every cached template. Call on app teardown if memory pressure matters. */
export function clearAnimatedEnemyCache(): void {
  templates.forEach((t) => {
    t.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) (m.geometry as THREE.BufferGeometry).dispose?.();
      const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose?.());
      else mat?.dispose?.();
    });
  });
  templates.clear();
  preloadPromise = null;
}

export { FACTION_BY_RACE };
