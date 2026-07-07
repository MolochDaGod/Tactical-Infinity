import * as THREE from 'three';
import {
  STYLIZED_ASSETS,
  STYLIZED_ANIMALS,
  Biome,
  StylizedAsset,
  AssetRole,
  pickWeighted,
} from './stylizedAssetRegistry';
import { stylizedPacks } from './stylizedPackLoader';
import { addBiomeFeaturesToIsland, HeightSampler } from './biomeFeatureScatter';
import { loadGroundTextureSet, BIOME_GROUND_TEXTURES, LoadedGroundTextureSet } from './groundTextures';

/**
 * Generation Library — front door for procedural island content.
 * ──────────────────────────────────────────────────────────────
 * One declarative `BIOME_RECIPES` table describes everything the
 * world generator should sprinkle on a given biome:
 *   – which roles to scatter (canopies, rocks, gems, ice, fire, debris…)
 *   – ambient critter slots (animals from the skinned packs)
 *   – ground texture choice
 *   – landmark slots
 *
 * Callers use `populateIsland(opts)` instead of touching individual
 * scatter routines. Adding a new biome or adjusting density is a
 * one-place change here.
 */

export const BIOME_ALIAS: Record<string, Biome> = {
  forest: 'temperate',
  haunted: 'volcanic',
  beach: 'tropical',
  tropical: 'tropical',
  volcanic: 'volcanic',
  temperate: 'temperate',
  arctic: 'arctic',
  desert: 'desert',
};

export interface BiomeRecipe {
  /** Scatter roles to actively pull from the registry, with a multiplier on density. */
  roles: Partial<Record<AssetRole, number>>;
  /** Animal slots — { animalId: numberPerIsland }. */
  animals?: Partial<Record<string, number>>;
  /** Notes for designers / dev tools — not used by runtime. */
  notes?: string;
}

/**
 * Recipes per canonical biome. Multipliers default to 1.0 if omitted.
 * Setting a role to 0 disables it on that biome even if the asset says
 * otherwise.
 */
export const BIOME_RECIPES: Record<Biome, BiomeRecipe> = {
  tropical: {
    roles: {
      canopy: 1.1,           // lush palms + leafy
      gem: 0.6,
      rock: 0.8,
      shore_debris: 1.2,     // more driftwood on tropical beaches
    },
    animals: { crab: 4, crocodile: 1, rabbit_v2: 2 },
    notes: 'Beaches, palms, coral floor, driftwood. Crabs are the signature critter.',
  },
  temperate: {
    roles: {
      canopy: 1.2,           // strongest forest density
      understory: 1.0,
      rock: 1.0,
      gem: 0.5,
      shore_debris: 0.6,
    },
    animals: { wild_boar: 3, rabbit_v2: 4, ibex: 1, wolf: 1 },
    notes: 'Quaternius forest variety + leafy stylized + oaks. Boars and rabbits, occasional wolf.',
  },
  volcanic: {
    roles: {
      canopy: 0.6,           // sparse dead trees + dead-pack
      rock: 1.4,
      gem: 1.2,              // crystal-rich
      fire_landmark: 1.0,
      shore_debris: 0.4,
    },
    animals: {},
    notes: 'Dead trees, rocks, crystal veins, fire vents/tornadoes. No critters.',
  },
  arctic: {
    roles: {
      canopy: 0.8,           // snowy pines
      ice_prop: 1.2,
      ice_landmark: 1.0,
      frozen_log: 1.0,
      rock: 0.7,
      gem: 0.6,
      shore_debris: 0.3,
    },
    animals: { ibex: 3, wolf: 1 },
    notes: 'Snowy pines, ice clusters, ice spire landmarks, frozen log near shore.',
  },
  desert: {
    roles: {
      canopy: 0.4,           // very sparse trees
      rock: 1.5,
      gem: 0.5,
    },
    animals: { ibex: 2 },
    notes: 'Mostly rocks and sand, sparse vegetation, ibex herds.',
  },
};

export function resolveBiome(raw: string): Biome {
  return BIOME_ALIAS[raw] ?? 'tropical';
}

export interface PopulateIslandOpts {
  /** Container that all scattered features will be parented under. */
  group: THREE.Group;
  /** Island center (in the same coordinate space the group lives in). */
  centerX?: number;
  centerZ?: number;
  /** Approximate island radius — drives how many props get scattered. */
  radius: number;
  /** Raw biome string from IslandConfig (will be aliased internally). */
  biome: string;
  /** Optional deterministic RNG (Math.random by default). */
  rand?: () => number;
  /** Sampler so features sit on the terrain surface. */
  getHeightAt?: HeightSampler;
  /** Subscribe per-frame updaters (used by fire-loop / future skinned-anim mixers). */
  onUpdater?: (fn: (dt: number) => void) => void;
}

/**
 * Single entry point for populating a freshly-generated island.
 * Currently this delegates to `addBiomeFeaturesToIsland` (which already
 * handles every static asset role + lazy-pack landmarks). The recipe
 * table above is the place to tune density per biome going forward —
 * future revisions can pass per-role multipliers down to the scatter
 * pass instead of hard-coding asset-level density.
 */
export async function populateIsland(opts: PopulateIslandOpts): Promise<void> {
  await addBiomeFeaturesToIsland(opts);
}

/**
 * Inventory query — useful for dev-tools / island editor:
 * returns every registered asset that can spawn on a biome, grouped
 * by role.
 */
export function getBiomeInventory(biome: string): Record<AssetRole, StylizedAsset[]> {
  const b = resolveBiome(biome);
  const out = {} as Record<AssetRole, StylizedAsset[]>;
  for (const a of STYLIZED_ASSETS) {
    if ((a.biomes[b] ?? 0) <= 0) continue;
    (out[a.role] ||= []).push(a);
  }
  return out;
}

/**
 * Quick top-level summary of what's available per biome — for logs / dev-tools.
 */
export function getGenerationManifest(): Record<Biome, {
  canopy: number;
  rock: number;
  gem: number;
  landmarks: number;
  animals: number;
  groundTexture: string | null;
}> {
  const out = {} as ReturnType<typeof getGenerationManifest>;
  (Object.keys(BIOME_RECIPES) as Biome[]).forEach((b) => {
    const inv = getBiomeInventory(b);
    out[b] = {
      canopy: (inv.canopy?.length ?? 0) + (inv.understory?.length ?? 0),
      rock: inv.rock?.length ?? 0,
      gem: inv.gem?.length ?? 0,
      landmarks: (inv.ice_landmark?.length ?? 0) + (inv.fire_landmark?.length ?? 0) + (inv.frozen_log?.length ?? 0),
      animals: STYLIZED_ANIMALS.filter((a) => (a.biomes[b] ?? 0) > 0).length,
      groundTexture: BIOME_GROUND_TEXTURES[b]?.primary?.diffuse ?? null,
    };
  });
  return out;
}

// Re-exports so callers only need this one module.
export {
  STYLIZED_ASSETS,
  STYLIZED_ANIMALS,
  pickWeighted,
  loadGroundTextureSet,
  stylizedPacks,
};
export type { Biome, AssetRole, StylizedAsset, LoadedGroundTextureSet };
