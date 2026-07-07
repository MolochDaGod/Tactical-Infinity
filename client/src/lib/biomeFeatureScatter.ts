import * as THREE from 'three';
import {
  STYLIZED_ASSETS,
  StylizedAsset,
  Biome,
  getAssetsForBiome,
  pickWeighted,
  instantiateStaticAsset,
  instantiateFireLoop,
} from './stylizedAssetRegistry';
import { stylizedPacks } from './stylizedPackLoader';

/**
 * Biome Feature Scatter
 * ─────────────────────
 * Adds the new stylized landmark/decor assets (gems, ice clusters, ice
 * shards, frozen logs, fire vents, fire tornadoes) onto a generated
 * island, with placement rules driven by stylizedAssetRegistry.
 *
 * Two passes:
 *   1) DENSE pass – props with `density` > 0 (gems, ice clusters, etc.).
 *      Spawn count = density × island area.
 *   2) LANDMARK pass – props with `perIslandCount` > 0 (ice shards, frozen
 *      logs, fire tornadoes, fire loops). Spawn count = perIslandCount.
 *
 * Lazy packs are loaded on-demand here; this method is async so the host
 * can `await` if it wants.  Caller can also fire-and-forget – features
 * pop in once their pack arrives.
 *
 * The biome alias `forest` is treated as `temperate` so this also works
 * with the existing IslandGenerator biome strings.
 */

const BIOME_ALIAS: Record<string, Biome> = {
  forest: 'temperate',
  haunted: 'volcanic',
  beach: 'tropical',
  tropical: 'tropical',
  volcanic: 'volcanic',
  temperate: 'temperate',
  arctic: 'arctic',
  desert: 'desert',
};

export type HeightSampler = (x: number, z: number) => number;

export interface BiomeScatterOpts {
  group: THREE.Group;          // root container — features are .add()ed here
  centerX?: number;            // island center XZ in world space
  centerZ?: number;
  radius: number;              // island radius
  biome: string;               // raw biome string from IslandConfig
  rand?: () => number;
  getHeightAt?: HeightSampler; // optional: terrain sampler for y placement
  /** Updater registry: features that need per-frame updates push here. */
  onUpdater?: (fn: (dt: number) => void) => void;
}

export async function addBiomeFeaturesToIsland(opts: BiomeScatterOpts): Promise<void> {
  const biome = BIOME_ALIAS[opts.biome] ?? 'tropical';
  const cx = opts.centerX ?? 0;
  const cz = opts.centerZ ?? 0;
  const rand = opts.rand ?? Math.random;
  const radius = Math.max(8, opts.radius);
  const area = Math.PI * radius * radius;

  // ─── Pass 1: DENSE props (gems, ice clusters, etc.) ────────────────
  const denseAssets = STYLIZED_ASSETS.filter(
    (a) => (a.biomes[biome] ?? 0) > 0 && (a.density ?? 0) > 0
  );

  const dueLazyLoads: Promise<unknown>[] = [];
  for (const asset of denseAssets) {
    if (!stylizedPacks.isLoaded(asset.packId)) {
      dueLazyLoads.push(stylizedPacks.loadPack(asset.packId));
    }
  }
  // Don't block the function — fire pack loads in parallel and continue.
  // For dense props, we await because we want to actually scatter them.
  if (dueLazyLoads.length) await Promise.allSettled(dueLazyLoads);

  for (const asset of denseAssets) {
    const count = Math.round((asset.density ?? 0) * (area / 100));
    if (count <= 0) continue;
    for (let i = 0; i < count; i++) {
      const pos = pickPlacement(asset, cx, cz, radius, rand);
      const node = instantiateStaticAsset(asset, rand);
      if (!node) continue;
      placeOnTerrain(node, pos.x, pos.z, opts.getHeightAt);
      opts.group.add(node);
    }
  }

  // ─── Pass 2: LANDMARKS (sparse) ────────────────────────────────────
  const landmarkAssets = STYLIZED_ASSETS.filter(
    (a) => (a.biomes[biome] ?? 0) > 0 && (a.perIslandCount ?? 0) > 0
  );

  for (const asset of landmarkAssets) {
    // Lazy packs: load on demand for the FIRST landmark, then carry on.
    if (!stylizedPacks.isLoaded(asset.packId)) {
      // Don't block the whole island on a 50MB ice shard pack — kick it off
      // and let it pop in once ready.
      stylizedPacks.loadPack(asset.packId).then(() => {
        addLandmarkInstances(asset, opts, biome, rand);
      });
      continue;
    }
    addLandmarkInstances(asset, opts, biome, rand);
  }
}

function addLandmarkInstances(
  asset: StylizedAsset,
  opts: BiomeScatterOpts,
  biome: Biome,
  rand: () => number
): void {
  const count = asset.perIslandCount ?? 1;
  const cx = opts.centerX ?? 0;
  const cz = opts.centerZ ?? 0;
  const radius = Math.max(8, opts.radius);
  for (let i = 0; i < count; i++) {
    const pos = pickPlacement(asset, cx, cz, radius, rand);
    let node: THREE.Group | null;
    if (asset.frameSequencePrefix) {
      node = instantiateFireLoop(asset);
      if (node) {
        const updater = (node.userData as any).update as ((dt: number) => void) | undefined;
        if (updater && opts.onUpdater) opts.onUpdater(updater);
      }
    } else {
      node = instantiateStaticAsset(asset, rand);
    }
    if (!node) continue;
    placeOnTerrain(node, pos.x, pos.z, opts.getHeightAt);
    opts.group.add(node);
  }
}

function pickPlacement(
  asset: StylizedAsset,
  cx: number, cz: number, radius: number,
  rand: () => number
): { x: number; z: number } {
  const place = asset.placement ?? 'any';
  // Fraction of radius for each placement zone.
  const [minF, maxF] = (() => {
    switch (place) {
      case 'shore':    return [0.7, 0.95];
      case 'inland':   return [0.15, 0.65];
      case 'highland': return [0.0,  0.4];
      case 'any':
      default:         return [0.1, 0.85];
    }
  })();
  const angle = rand() * Math.PI * 2;
  const dist = (minF + rand() * (maxF - minF)) * radius;
  return { x: cx + Math.cos(angle) * dist, z: cz + Math.sin(angle) * dist };
}

function placeOnTerrain(
  node: THREE.Group,
  x: number, z: number,
  getHeightAt?: HeightSampler
): void {
  const y = getHeightAt ? getHeightAt(x, z) : 0;
  node.position.set(x, y, z);
}
