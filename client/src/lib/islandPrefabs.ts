/**
 * islandPrefabs.ts
 *
 * Stable registry that maps each `WorldIslandData.id` from `worldMapData.ts`
 * onto a deterministic *prefab* — a frozen procedural recipe (terrain seed,
 * biome, vegetation profile, resource nodes, NPC spawners, prop placements).
 *
 * The point of this module is reproducibility:
 *
 *   • A captain who docks at Sanctuary Isle today and again next week sees
 *     the same trees in the same places, the same dock, the same shopkeeper.
 *   • Procgen still runs (cheap on the GPU) but is *seeded by the prefab*,
 *     so two clients streaming the same island agree on its layout.
 *   • Designers can override any island by adding an entry here without
 *     touching `worldMapData.ts` or any of the per-scene generators.
 *
 * Anything not registered here is treated as a "wild" island — the caller
 * may fall back to a random seed derived from the island id.
 */

export type PrefabBiome =
  | 'tropical' | 'volcanic' | 'arctic' | 'desert'
  | 'haunted' | 'forest'   | 'swamp'  | 'mountain'
  | 'sanctuary';

export type ResourceKind =
  | 'iron_vein' | 'gold_vein' | 'crystal_vein' | 'mossy_stone'
  | 'oak_grove' | 'pine_grove' | 'palm_grove'
  | 'coral_bed' | 'kelp_forest' | 'sulphur_pool'
  | 'mana_font' | 'starmetal_node';

export type SpawnerKind =
  | 'pirate_band'   | 'undead_patrol'   | 'orc_raiders'
  | 'goblin_camp'   | 'sea_monster'     | 'volcanic_elemental'
  | 'frost_wolves'  | 'haunted_wisps'
  | 'merchant'      | 'questgiver_npc'  | 'shipwright'
  | 'innkeeper'     | 'priestess';

export interface ResourceNodeSpec {
  kind: ResourceKind;
  /** Local-space island position, normalised in [-1..1] across the patchRadius. */
  pos: [number, number];
  /** How many physical instances spawn at this anchor (small clusters look natural). */
  count?: number;
  /** Respawn timer in seconds; default 600. */
  respawnSec?: number;
}

export interface SpawnerSpec {
  kind: SpawnerKind;
  pos: [number, number];
  /** Aggro / interaction radius in metres. */
  radius?: number;
  /** Number of mobs/NPCs at full strength. */
  count?: number;
  /** Respawn cadence for hostile spawners (seconds). */
  respawnSec?: number;
  /** Optional level scalar — for hostile mobs only. */
  level?: number;
}

export interface PropSpec {
  kind: 'dock' | 'tavern' | 'shrine' | 'shop' | 'campfire' | 'totem' | 'shipwreck' | 'tent';
  pos: [number, number];
  yawRad?: number;
}

export interface IslandPrefab {
  /** Must equal a `WorldIslandData.id` so the registry can be looked up by id. */
  id: string;
  /** Display tag — purely for editor tooling, never shown in-game. */
  label: string;
  /** Deterministic seed used by every procgen pass for this island. */
  seed: number;
  biome: PrefabBiome;
  /** Approximate island radius in metres (matches `WorldIslandData.radius`). */
  radius: number;
  /** Vegetation density multiplier; 1.0 = engine default, 0 = bare. */
  vegetationDensity: number;
  /** Whether this island is treated as a safe-zone (no PVP, no aggro). */
  safeZone: boolean;
  resources: ResourceNodeSpec[];
  spawners:  SpawnerSpec[];
  props:     PropSpec[];
}

// ───────────────────────────────────────────────────────────────────────────
// Registry — only "named" islands need an entry. Wild islands are derived.
// ───────────────────────────────────────────────────────────────────────────

const PREFABS: Record<string, IslandPrefab> = {
  // The neutral central hub. No PVP. Trades + repairs only.
  waterfall_isle: {
    id:        'waterfall_isle',
    label:     'Waterfall Isle (Sanctuary Hub)',
    seed:      0x5ACC1A,
    biome:     'sanctuary',
    radius:    180,
    vegetationDensity: 0.9,
    safeZone:  true,
    resources: [
      { kind: 'mana_font',  pos: [ 0.0,  0.1], count: 1, respawnSec: 0 },
      { kind: 'oak_grove',  pos: [-0.4,  0.3], count: 6 },
      { kind: 'mossy_stone',pos: [ 0.5, -0.2], count: 4 },
    ],
    spawners: [
      { kind: 'innkeeper',     pos: [ 0.05, -0.1], radius: 4 },
      { kind: 'shipwright',    pos: [ 0.6,   0.0], radius: 4 },
      { kind: 'merchant',      pos: [-0.2,  -0.4], radius: 4 },
      { kind: 'priestess',     pos: [ 0.0,   0.4], radius: 4 },
      { kind: 'questgiver_npc',pos: [-0.5,   0.1], radius: 4 },
    ],
    props: [
      { kind: 'dock',     pos: [ 0.85, 0.0],  yawRad: 0      },
      { kind: 'tavern',   pos: [ 0.0, -0.15], yawRad: 0      },
      { kind: 'shop',     pos: [-0.3, -0.35], yawRad: Math.PI/2 },
      { kind: 'shrine',   pos: [ 0.0,  0.45], yawRad: Math.PI },
      { kind: 'campfire', pos: [-0.05,-0.05] },
    ],
  },

  // Crusade capital — humans/barbarians, gold-banner faction.
  bastion_keep: {
    id:        'bastion_keep',
    label:     'Bastion Keep (Crusade Capital)',
    seed:      0xC1DE01,
    biome:     'mountain',
    radius:    220,
    vegetationDensity: 0.5,
    safeZone:  true,
    resources: [
      { kind: 'iron_vein',  pos: [ 0.6,  0.0], count: 4 },
      { kind: 'starmetal_node', pos: [-0.2, 0.6], count: 1, respawnSec: 1800 },
      { kind: 'pine_grove', pos: [-0.5, -0.3], count: 8 },
    ],
    spawners: [
      { kind: 'merchant',       pos: [-0.1,  0.0], radius: 4 },
      { kind: 'shipwright',     pos: [ 0.7,  0.1], radius: 4 },
      { kind: 'questgiver_npc', pos: [-0.3, -0.1], radius: 4 },
    ],
    props: [
      { kind: 'dock',   pos: [ 0.9, 0.0]  },
      { kind: 'tavern', pos: [ 0.1, 0.0]  },
      { kind: 'shop',   pos: [-0.4, 0.1]  },
      { kind: 'shrine', pos: [ 0.0, 0.7], yawRad: Math.PI },
    ],
  },

  // Fabled capital — dwarves/elves, turquoise-banner faction.
  emerald_grove: {
    id:        'emerald_grove',
    label:     'Emerald Grove (Fabled Capital)',
    seed:      0xFABE00,
    biome:     'forest',
    radius:    200,
    vegetationDensity: 1.4,
    safeZone:  true,
    resources: [
      { kind: 'oak_grove',     pos: [-0.5,  0.0], count: 12 },
      { kind: 'crystal_vein',  pos: [ 0.4,  0.4], count: 3, respawnSec: 1200 },
      { kind: 'mossy_stone',   pos: [ 0.0, -0.3], count: 6 },
      { kind: 'mana_font',     pos: [ 0.2,  0.1], count: 1 },
    ],
    spawners: [
      { kind: 'merchant',       pos: [-0.05, -0.1], radius: 4 },
      { kind: 'priestess',      pos: [ 0.2,   0.5], radius: 4 },
      { kind: 'questgiver_npc', pos: [-0.3,   0.2], radius: 4 },
    ],
    props: [
      { kind: 'dock',   pos: [ 0.85, 0.05] },
      { kind: 'tavern', pos: [ 0.0,  0.0]  },
      { kind: 'shrine', pos: [ 0.3,  0.55] },
    ],
  },

  // Legion capital — orcs/undead, dark-red banner faction.
  ashenforge: {
    id:        'ashenforge',
    label:     'Ashenforge (Legion Capital)',
    seed:      0x7E610A,
    biome:     'volcanic',
    radius:    230,
    vegetationDensity: 0.2,
    safeZone:  true,
    resources: [
      { kind: 'sulphur_pool', pos: [ 0.4, -0.4], count: 2, respawnSec: 900 },
      { kind: 'iron_vein',    pos: [-0.5,  0.1], count: 6 },
      { kind: 'gold_vein',    pos: [ 0.0,  0.5], count: 2, respawnSec: 1500 },
    ],
    spawners: [
      { kind: 'merchant',       pos: [-0.1, 0.0], radius: 4 },
      { kind: 'shipwright',     pos: [ 0.7, 0.0], radius: 4 },
      { kind: 'questgiver_npc', pos: [ 0.1, 0.4], radius: 4 },
    ],
    props: [
      { kind: 'dock',     pos: [ 0.9,  0.0] },
      { kind: 'shop',     pos: [-0.3, -0.1] },
      { kind: 'campfire', pos: [ 0.0,  0.0] },
      { kind: 'totem',    pos: [ 0.0,  0.6], yawRad: 0 },
    ],
  },

  // A wild hostile island with a pirate camp — first-tier challenge.
  bone_skerry: {
    id:        'bone_skerry',
    label:     'Bone Skerry (Wild — Pirates)',
    seed:      0xB07E5C,
    biome:     'tropical',
    radius:    140,
    vegetationDensity: 0.7,
    safeZone:  false,
    resources: [
      { kind: 'palm_grove', pos: [-0.4, 0.3], count: 7 },
      { kind: 'coral_bed',  pos: [ 0.6, 0.0], count: 3, respawnSec: 800 },
    ],
    spawners: [
      { kind: 'pirate_band', pos: [-0.1, -0.1], radius: 18, count: 6, respawnSec: 600, level: 3 },
      { kind: 'sea_monster', pos: [ 0.9,  0.0], radius: 22, count: 1, respawnSec: 1800, level: 5 },
    ],
    props: [
      { kind: 'shipwreck', pos: [ 0.3, -0.5], yawRad: Math.PI / 4 },
      { kind: 'tent',      pos: [-0.2, -0.1] },
      { kind: 'campfire',  pos: [-0.1, -0.05] },
    ],
  },
};

/** Look up a registered prefab by world-island id. */
export function getIslandPrefab(islandId: string): IslandPrefab | undefined {
  return PREFABS[islandId];
}

/** Return every registered prefab — useful for the admin tooling. */
export function listIslandPrefabs(): IslandPrefab[] {
  return Object.values(PREFABS);
}

/**
 * Build a deterministic seed for an *unregistered* island. We hash the id so
 * the same wild island always generates with the same seed across clients.
 */
export function getIslandSeed(islandId: string): number {
  const prefab = PREFABS[islandId];
  if (prefab) return prefab.seed;
  let h = 2166136261;
  for (let i = 0; i < islandId.length; i++) {
    h ^= islandId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Convert a normalised prefab position [-1..1, -1..1] into world-space XZ
 * relative to the island's centre, given the island's effective radius.
 */
export function unpackPrefabPos(p: [number, number], radius: number): { x: number; z: number } {
  return { x: p[0] * radius, z: p[1] * radius };
}
