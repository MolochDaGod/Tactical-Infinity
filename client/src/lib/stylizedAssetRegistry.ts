import * as THREE from 'three';
import { stylizedPacks, MeshPredicate } from './stylizedPackLoader';
import { prepareAsset, prepareAnimal } from './assetPipeline';

/**
 * Stylized Asset Registry
 * ───────────────────────
 * Single source of truth for every stylized GLB pack the world generator
 * can pull from. Each entry knows:
 *   – which pack file it lives in,
 *   – which sub-meshes inside that pack make it up (predicate or pool),
 *   – which biomes it belongs in (with weights),
 *   – its scatter role / density / cluster rules,
 *   – default scale.
 *
 * Generation code (biomeFeatureScatter, generationLibrary, landscapeAssets,
 * islandAnimals) pulls from this registry instead of hard-coding paths,
 * so adding a new pack is a one-place change.
 */

// ─── Biome enum (matches IslandGenerator's biome strings, post-alias) ────
export type Biome = 'tropical' | 'volcanic' | 'temperate' | 'arctic' | 'desert';

// ─── Pack definitions ────────────────────────────────────────────────
const PACK_BASE = '/models/stylized';

export const STYLIZED_PACKS = [
  // ─ Tree packs (small, eager) ─
  { id: 'tropical_trees',     url: `${PACK_BASE}/stylized_tropical_pack_1777028896380.glb` },
  { id: 'leafy_trees',        url: `${PACK_BASE}/stylize2d_tree_pack_1777028874403.glb` },
  { id: 'oak_tree',           url: `${PACK_BASE}/stylize22d_tree_1777028906728.glb` },
  { id: 'autumn_trees',       url: `${PACK_BASE}/stylized_aumtumn_trees_pack_animation_baked_1777028910494.glb` },
  { id: 'dead_trees_psx',     url: `${PACK_BASE}/psx_dead_tree_pack_1777029006640.glb` },
  { id: 'snowy_pines',        url: `${PACK_BASE}/snowy_pine_trees_pack__ps1_low_poly_1777029062494.glb` },
  { id: 'stylized_trees_v2',  url: `${PACK_BASE}/stylized_tree_pack_1777029067306.glb` },

  // ─ Tree packs (large, lazy) ─
  { id: 'trees_set_a',        url: `${PACK_BASE}/trees_set_a_1777029116006.glb`,                                  lazy: true },

  // ─ Rock packs ─
  { id: 'rocks_pack',         url: `${PACK_BASE}/stylised_rocks_asset_pack_1777029112319.glb`,                    lazy: true },

  // ─ Gem pack ─
  { id: 'gem_pack',           url: `${PACK_BASE}/stylized_crystal_gem_pack_-_handpainted_1777028892288.glb` },

  // ─ Arctic features ─
  { id: 'ice_cluster',        url: `${PACK_BASE}/ice_cluster_free_1777028822992.glb` },
  { id: 'ice_shards',         url: `${PACK_BASE}/stylized_ice_shard_1777028843856.glb`,                           lazy: true },
  { id: 'frozen_log',         url: `${PACK_BASE}/old_tree_trunk_by_the_frozen_river_1777028791564.glb`,           lazy: true },

  // ─ Volcanic features ─
  { id: 'fire_loop',          url: `${PACK_BASE}/stylized_fire_animation_perfect_loop_1777028837108.glb`,         lazy: true },
  { id: 'fire_tornado',       url: `${PACK_BASE}/stylized_fire_tornado_1777028840668.glb` },

  // ─ Shore debris (driftwood / shipwreck planks) ─
  { id: 'wood_debris',        url: `${PACK_BASE}/simple_wood_planks_debris_pack_1777029123948.glb`,               lazy: true },

  // ─ Animals (skinned) ─
  { id: 'anim_boar',          url: `${PACK_BASE}/wild_boar_from_cotw_game_1777027479693.glb`,         lazy: true, skinned: true },
  { id: 'anim_ibex',          url: `${PACK_BASE}/cotw_goat_beceite_ibex_1777027497766.glb`,           lazy: true, skinned: true },
  { id: 'anim_crab',          url: `${PACK_BASE}/crab_walk_1777027508481.glb`,                                    skinned: true },
  { id: 'anim_rabbit',        url: `${PACK_BASE}/rabbit_rigged_1777027512189.glb`,                                skinned: true },
  { id: 'anim_wolf',          url: `${PACK_BASE}/wolf_1777027517511.glb`,                                         skinned: true },
  { id: 'anim_crocodile',     url: `${PACK_BASE}/nile_crocodile_swimming_1777027544073.glb`,          lazy: true, skinned: true },
];

// Register them all on the loader
stylizedPacks.registerPacks(STYLIZED_PACKS);

// ─── Asset roles ─────────────────────────────────────────────────────
export type AssetRole =
  | 'canopy'        // tall tree (counts toward forest density)
  | 'understory'    // shrub-height tree
  | 'gem'           // crystal/gem cluster prop
  | 'rock'          // rocky boulder / outcrop
  | 'ice_prop'      // single ice piece
  | 'ice_landmark'  // big ice spire (lazy, sparse)
  | 'frozen_log'    // landmark log (lazy, sparse)
  | 'fire_landmark' // fire vent / tornado (lazy, sparse)
  | 'shore_debris'  // driftwood / planks at the waterline
  | 'critter'       // ambient animal (rabbit, ibex)
  | 'predator'      // hostile animal (wolf, croc)
  | 'big_critter';  // mid-size aggressive (boar)

// ─── Stylized asset entry ────────────────────────────────────────────
export interface StylizedAsset {
  id: string;
  packId: string;
  /**
   * Either a fixed predicate over mesh names OR a `pool` for picking one
   * member from a numbered family per instantiation.
   */
  meshPredicate?: MeshPredicate;
  pool?: { prefixes: string[]; range: [number, number] };
  role: AssetRole;
  biomes: Partial<Record<Biome, number>>;
  scale: number;
  scaleJitter?: number;
  randomYRotation?: boolean;
  /** Density per 100m² for the dense biome-scatter pass. */
  density?: number;
  /** For sparse landmark assets, how many to place per island. */
  perIslandCount?: number;
  /** Where on the island this prefers to sit. */
  placement?: 'shore' | 'inland' | 'highland' | 'any';
  /** Frame-sequence helper: visibility-cycled animation prefix. */
  frameSequencePrefix?: string;
}

// Helpers for predicates
const startsWith = (...prefixes: string[]): MeshPredicate =>
  (n) => prefixes.some((p) => n.startsWith(p));
const includes = (...frags: string[]): MeshPredicate =>
  (n) => frags.some((f) => n.includes(f));

// ─── Asset definitions ───────────────────────────────────────────────
export const STYLIZED_ASSETS: StylizedAsset[] = [
  // ── TROPICAL TREES (3 trees, single-mesh each)
  ...[0, 1, 2].map<StylizedAsset>((i) => ({
    id: `tropical_tree_${i}`,
    packId: 'tropical_trees',
    meshPredicate: startsWith(`Tree_${i}_`),
    role: 'canopy',
    biomes: { tropical: 1.0 },
    scale: 1.6,
    scaleJitter: 0.25,
    randomYRotation: true,
    density: 0.18,
    placement: 'inland',
  })),

  // ── LEAFY TREES (5 trees, trunk + leaves pairs — main.006..010)
  ...[6, 7, 8, 9, 10].map<StylizedAsset>((i) => {
    const prefix = `main.${String(i).padStart(3, '0')}`;
    return {
      id: `leafy_tree_${i}`,
      packId: 'leafy_trees',
      meshPredicate: startsWith(`${prefix}_tronco`, `${prefix}_folhas`),
      role: 'canopy',
      biomes: { temperate: 0.6, tropical: 0.4 },
      scale: 0.012,             // pack source is huge
      scaleJitter: 0.2,
      randomYRotation: true,
      density: 0.22,
      placement: 'inland',
    };
  }),

  // ── STYLIZED TREES V2 (5 more trunk+leaves pairs — same naming, different pack)
  ...[6, 7, 8, 9, 10].map<StylizedAsset>((i) => {
    const prefix = `main.${String(i).padStart(3, '0')}`;
    return {
      id: `stylized_tree_v2_${i}`,
      packId: 'stylized_trees_v2',
      meshPredicate: startsWith(`${prefix}_tronco`, `${prefix}_folhas`),
      role: 'canopy',
      biomes: { temperate: 0.7, tropical: 0.3 },
      scale: 0.012,
      scaleJitter: 0.2,
      randomYRotation: true,
      density: 0.18,
      placement: 'inland',
    };
  }),

  // ── OAK TREE (single oak comprised of named parts)
  {
    id: 'oak_tree',
    packId: 'oak_tree',
    meshPredicate: includes('oak'),
    role: 'canopy',
    biomes: { temperate: 0.8 },
    scale: 0.014,
    scaleJitter: 0.2,
    randomYRotation: true,
    density: 0.14,
    placement: 'inland',
  },

  // ── AUTUMN TREES (3 trees, baked anim — meshes named "0","1","2")
  ...[0, 1, 2].map<StylizedAsset>((i) => ({
    id: `autumn_tree_${i}`,
    packId: 'autumn_trees',
    meshPredicate: (n) => n === String(i),
    role: 'canopy',
    biomes: { temperate: 0.7 },
    scale: 1.2,
    scaleJitter: 0.25,
    randomYRotation: true,
    density: 0.15,
    placement: 'inland',
  })),

  // ── PSX DEAD TREES (6 trees: Tree1M, Tree2m, Tree3m, Tree 1, Tree2, Tree3)
  // Volcanic + arctic dead-zone variety.
  ...[
    { id: 'psx_dead_tree_a', match: 'Tree1M_' },
    { id: 'psx_dead_tree_b', match: 'Tree2m_' },
    { id: 'psx_dead_tree_c', match: 'Tree3m_' },
    { id: 'psx_dead_tree_d', match: 'Tree 1_' },
    { id: 'psx_dead_tree_e', match: 'Tree2_' },
    { id: 'psx_dead_tree_f', match: 'Tree3_' },
  ].map<StylizedAsset>(({ id, match }) => ({
    id,
    packId: 'dead_trees_psx',
    meshPredicate: (n) => n.startsWith(match),
    role: 'canopy',
    biomes: { volcanic: 0.6, arctic: 0.5, desert: 0.4 },
    scale: 0.6,
    scaleJitter: 0.3,
    randomYRotation: true,
    density: 0.12,
    placement: 'inland',
  })),

  // ── SNOWY PINES (3 PS1 low-poly snowy pines for arctic)
  ...[1, 2, 3].map<StylizedAsset>((i) => ({
    id: `snowy_pine_${i}`,
    packId: 'snowy_pines',
    meshPredicate: startsWith(`Tree_Pine_Snowy_T${i}_`),
    role: 'canopy',
    biomes: { arctic: 1.0 },
    scale: 1.4,
    scaleJitter: 0.25,
    randomYRotation: true,
    density: 0.20,
    placement: 'inland',
  })),

  // ── TREES SET A (lazy 74MB pack — 15 hero trees T1..T15 with bark+leaves)
  // Use POOL so one entry covers all 15 and we pick one at extract time.
  {
    id: 'hero_tree_set_a',
    packId: 'trees_set_a',
    pool: { prefixes: ['T'], range: [1, 15] },
    role: 'canopy',
    biomes: { temperate: 0.5 },
    scale: 0.018,
    scaleJitter: 0.2,
    randomYRotation: true,
    density: 0.10,        // sparse — these are large hero trees
    placement: 'inland',
  },

  // ── ROCKS (lazy 100MB pack — Plain_Rock1..32 + Mossy_Rock1..8)
  {
    id: 'rock_plain',
    packId: 'rocks_pack',
    pool: { prefixes: ['Plain_Rock'], range: [1, 32] },
    role: 'rock',
    biomes: { tropical: 0.6, temperate: 0.7, arctic: 0.7, volcanic: 0.8, desert: 0.9 },
    scale: 0.6,
    scaleJitter: 0.4,
    randomYRotation: true,
    density: 0.08,
    placement: 'highland',
  },
  {
    id: 'rock_mossy',
    packId: 'rocks_pack',
    pool: { prefixes: ['Mossy_Rock'], range: [1, 8] },
    role: 'rock',
    biomes: { temperate: 0.9, tropical: 0.5 },
    scale: 0.6,
    scaleJitter: 0.4,
    randomYRotation: true,
    density: 0.06,
    placement: 'inland',
  },

  // ── GEMS (4 crystals — clustered nodes used as harvestable spawns)
  ...['gem_Material', 'gem004', 'gem005', 'gem006'].map<StylizedAsset>((prefix, idx) => ({
    id: `gem_${idx}`,
    packId: 'gem_pack',
    meshPredicate: (n) => n.startsWith(prefix),
    role: 'gem',
    biomes: { temperate: 0.4, volcanic: 0.7, arctic: 0.5, desert: 0.3 },
    scale: 0.6,
    scaleJitter: 0.3,
    randomYRotation: true,
    density: 0.04,
    placement: 'highland',
  })),

  // ── ICE CLUSTER (Arctic, common)
  {
    id: 'ice_cluster',
    packId: 'ice_cluster',
    meshPredicate: () => true,
    role: 'ice_prop',
    biomes: { arctic: 1.0 },
    scale: 1.0,
    scaleJitter: 0.4,
    randomYRotation: true,
    density: 0.18,
    placement: 'any',
  },

  // ── ICE SHARDS (Arctic landmark, sparse, lazy)
  ...[0, 1, 2, 3, 4].map<StylizedAsset>((i) => ({
    id: `ice_shard_${i}`,
    packId: 'ice_shards',
    meshPredicate: (n) => n === `Object_${i}`,
    role: 'ice_landmark',
    biomes: { arctic: 1.0 },
    scale: 0.6,
    scaleJitter: 0.3,
    randomYRotation: true,
    perIslandCount: 1,
    placement: 'highland',
  })),

  // ── FROZEN LOG (Arctic landmark, very sparse, near shore, lazy)
  {
    id: 'frozen_log',
    packId: 'frozen_log',
    meshPredicate: () => true,
    role: 'frozen_log',
    biomes: { arctic: 1.0 },
    scale: 0.8,
    scaleJitter: 0.2,
    randomYRotation: true,
    perIslandCount: 1,
    placement: 'shore',
  },

  // ── FIRE TORNADO (Volcanic landmark)
  {
    id: 'fire_tornado',
    packId: 'fire_tornado',
    meshPredicate: () => true,
    role: 'fire_landmark',
    biomes: { volcanic: 0.6 },
    scale: 1.2,
    scaleJitter: 0.15,
    randomYRotation: true,
    perIslandCount: 1,
    placement: 'highland',
  },

  // ── FIRE LOOP (Volcanic landmark, frame-sequence, lazy)
  {
    id: 'fire_loop',
    packId: 'fire_loop',
    meshPredicate: (n) => n.startsWith('Cube_003_2_'),
    role: 'fire_landmark',
    biomes: { volcanic: 0.4 },
    scale: 0.8,
    scaleJitter: 0.2,
    perIslandCount: 1,
    placement: 'highland',
    frameSequencePrefix: 'Cube_003_2_',
  },

  // ── WOOD DEBRIS (driftwood / planks at shore — lazy)
  // Pack contains Cube_Material_0..008 — single random pick per spawn.
  {
    id: 'wood_debris',
    packId: 'wood_debris',
    pool: { prefixes: ['Cube_Material', 'Cube_Material.001', 'Cube_Material.002', 'Cube_Material.003', 'Cube_Material.004', 'Cube_Material.005', 'Cube_Material.006', 'Cube_Material.007', 'Cube_Material.008'], range: [0, 8] },
    role: 'shore_debris',
    biomes: { tropical: 0.6, temperate: 0.5, arctic: 0.4, volcanic: 0.3 },
    scale: 0.5,
    scaleJitter: 0.4,
    randomYRotation: true,
    density: 0.05,
    placement: 'shore',
  },
];

// ─── Animal registry (skinned packs) ─────────────────────────────────
export interface StylizedAnimal {
  id: string;
  packId: string;
  role: 'critter' | 'predator' | 'big_critter';
  biomes: Partial<Record<Biome, number>>;
  scale: number;
  density: number;
  placement?: 'shore' | 'inland' | 'highland' | 'any';
  defaultClip?: string | RegExp;
}

export const STYLIZED_ANIMALS: StylizedAnimal[] = [
  { id: 'wild_boar',  packId: 'anim_boar',      role: 'big_critter', biomes: { temperate: 0.8 },                              scale: 0.9, density: 0.012, placement: 'inland',   defaultClip: /idle|walk/i },
  { id: 'ibex',       packId: 'anim_ibex',      role: 'critter',     biomes: { temperate: 0.4, arctic: 0.7, desert: 0.5 },    scale: 1.0, density: 0.014, placement: 'highland', defaultClip: /idle|stand/i },
  { id: 'crab',       packId: 'anim_crab',      role: 'critter',     biomes: { tropical: 0.7, temperate: 0.4 },               scale: 0.4, density: 0.025, placement: 'shore',    defaultClip: /walk/i },
  { id: 'rabbit_v2',  packId: 'anim_rabbit',    role: 'critter',     biomes: { temperate: 0.8 },                              scale: 0.5, density: 0.028, placement: 'inland',   defaultClip: /take/i },
  { id: 'wolf',       packId: 'anim_wolf',      role: 'predator',    biomes: { temperate: 0.5, arctic: 0.6 },                 scale: 1.0, density: 0.008, placement: 'inland',   defaultClip: /take/i },
  { id: 'crocodile',  packId: 'anim_crocodile', role: 'predator',    biomes: { tropical: 0.5 },                               scale: 1.1, density: 0.005, placement: 'shore',    defaultClip: /swim/i },
];

// ─── Lookup helpers ──────────────────────────────────────────────────
export function getAssetsForBiome(biome: Biome, role?: AssetRole): StylizedAsset[] {
  return STYLIZED_ASSETS.filter((a) => {
    if (role && a.role !== role) return false;
    if (stylizedPacks.isDead(a.packId)) return false;
    return (a.biomes[biome] ?? 0) > 0;
  });
}

export function getAnimalsForBiome(biome: Biome): StylizedAnimal[] {
  return STYLIZED_ANIMALS.filter((a) => {
    if (stylizedPacks.isDead(a.packId)) return false;
    return (a.biomes[biome] ?? 0) > 0;
  });
}

/**
 * Batched startup HEAD-probe — call once on app boot so downstream
 * registry lookups (`getAssetsForBiome`, `getAnimalsForBiome`) silently
 * skip packs whose GLBs aren't on disk or in the CDN bucket.
 */
export async function pruneDeadStylizedPacks(): Promise<void> {
  await stylizedPacks.pruneDeadPacks();
}

export function pickWeighted<T extends { biomes: Partial<Record<Biome, number>> }>(
  items: T[], biome: Biome, rand: () => number = Math.random
): T | null {
  if (items.length === 0) return null;
  const weights = items.map((it) => it.biomes[biome] ?? 0);
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return null;
  let pick = rand() * total;
  for (let i = 0; i < items.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Instantiation helpers ───────────────────────────────────────────

/** Build the runtime predicate for an asset, using its pool if defined. */
function resolvePredicate(asset: StylizedAsset, rand: () => number): MeshPredicate {
  if (asset.pool) {
    const [lo, hi] = asset.pool.range;
    const pick = lo + Math.floor(rand() * (hi - lo + 1));
    // Match either "Plain_Rock${n}_" or exact "Cube_Material.${nn}_" patterns.
    return (n) => asset.pool!.prefixes.some((p) => {
      // exact-numbered: "Plain_Rock3_..."
      if (n.startsWith(`${p}${pick}_`)) return true;
      // padded patterns are caller's responsibility; default keeps it simple.
      return false;
    });
  }
  return asset.meshPredicate ?? (() => true);
}

/** Build a clone-ready static prop from a registered asset. */
export function instantiateStaticAsset(asset: StylizedAsset, rand: () => number = Math.random): THREE.Group | null {
  const predicate = resolvePredicate(asset, rand);
  const group = stylizedPacks.extractStatic(asset.packId, predicate);
  if (!group) return null;
  // Run the asset pipeline once per extract: dedup materials, fix leaf alpha,
  // apply role-based shadow flags, ensure bbox/sphere for frustum culling.
  prepareAsset(group, { role: asset.role });
  const jitter = asset.scaleJitter ?? 0;
  const s = asset.scale * (1 + (rand() * 2 - 1) * jitter);
  group.scale.setScalar(s);
  if (asset.randomYRotation) {
    group.rotation.y = rand() * Math.PI * 2;
  }
  return group;
}

/** Build the visibility-frame fire loop as a self-updating Group. */
export function instantiateFireLoop(asset: StylizedAsset, fps = 24): THREE.Group | null {
  if (!asset.frameSequencePrefix) return null;
  const frames = stylizedPacks.extractFrameSequence(asset.packId, asset.frameSequencePrefix);
  if (!frames || frames.length === 0) return null;

  const group = new THREE.Group();
  group.name = 'fire_loop';
  // Cap to first 60 frames (~2.5s loop) so a single landmark stays cheap.
  const useFrames = frames.slice(0, Math.min(60, frames.length));
  const tempScene = new THREE.Group();
  useFrames.forEach((m) => tempScene.add(m.clone()));
  tempScene.children.forEach((c, i) => {
    (c as THREE.Mesh).castShadow = false;
    (c as THREE.Mesh).receiveShadow = false;
    c.visible = i === 0;
    group.add(c);
  });
  group.scale.setScalar(asset.scale);

  let elapsed = 0;
  let current = 0;
  (group.userData as any).update = (dt: number) => {
    elapsed += dt;
    const next = Math.floor(elapsed * fps) % useFrames.length;
    if (next !== current) {
      group.children[current].visible = false;
      group.children[next].visible = true;
      current = next;
    }
  };
  return group;
}

/**
 * Build a clone-ready animated character (boar, ibex, crab, rabbit, wolf,
 * crocodile). Returns the cloned scene, animation clips, and the matching
 * default-clip name for AnimationMixer setup.
 */
export function instantiateAnimal(animal: StylizedAnimal): {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  defaultClipName: string | null;
} | null {
  const result = stylizedPacks.extractAnimated(animal.packId);
  if (!result) return null;
  const { scene, clips } = result;
  prepareAnimal(scene, animal.role);
  scene.scale.setScalar(animal.scale);

  let defaultClipName: string | null = null;
  if (animal.defaultClip && clips.length) {
    const matcher = animal.defaultClip;
    const found = clips.find((c) => {
      if (typeof matcher === 'string') return c.name === matcher;
      return matcher.test(c.name);
    });
    defaultClipName = found?.name ?? clips[0].name;
  } else if (clips.length) {
    defaultClipName = clips[0].name;
  }

  return { scene, clips, defaultClipName };
}
