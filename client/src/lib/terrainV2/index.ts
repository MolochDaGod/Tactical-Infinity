/**
 * Terrain v2 — public API
 *
 * High-quality island heightmaps composed from multiple algorithms.
 * Inspired by THREE.Terrain (MIT, IceCreamYou) — concepts only, fresh
 * implementations tuned for Tethical's Aethermoor world.
 *
 *   import { generateIslandTerrainV2 } from '@/lib/terrainV2';
 *
 *   const t = generateIslandTerrainV2({
 *     size: 400, segments: 256, seed: 42,
 *     biome: 'tropical',
 *     dock: { side: 'south' },
 *   });
 *   applyHeightmapToPlane(geometry, t.heightmap);
 *   const h = t.getHeightAt(x, z);
 */

import * as THREE from 'three';
import { Heightmap } from './heightmap';
import {
  diamondSquare, hill, layeredPerlin, ridged,
  smoothHeightmap, clampIslandEdges,
} from './algorithms';
import { Easing, applyEasing, type EasingFn } from './easing';
import { applyInfluences, type Influence } from './influences';
import { applyHeightmapToPlane } from './apply';
import { attachBVH, type AttachBVHOptions } from '../terrain/raycast';

export { Heightmap } from './heightmap';
export {
  diamondSquare, hill, layeredPerlin, ridged,
  smoothHeightmap, clampIslandEdges, mulberry32,
} from './algorithms';
export { Easing, applyEasing } from './easing';
export type { EasingFn } from './easing';
export { applyInfluences } from './influences';
export type { Influence, InfluenceShape, InfluenceMode } from './influences';
export { applyHeightmapToPlane } from './apply';

// ───────────────────────────────────────────────────────────────────────────
// Biome presets
// ───────────────────────────────────────────────────────────────────────────

export type IslandBiomeV2 =
  | 'tropical'
  | 'volcanic'
  | 'temperate'
  | 'arctic'
  | 'desert'
  | 'haunted'
  | 'archipelago';

interface BiomeProfile {
  hillCount: number;
  hillRadius: [number, number];
  ridgeStrength: number;
  perlinAmplitude: number;
  diamondAmplitude: number;
  diamondRoughness: number;
  domainWarp: number;
  smoothRadius: number;
  smoothIterations: number;
  ease: EasingFn;
  edgeInner: number;     // fraction of half-size
  edgeOuter: number;
  edgeExponent: number;
  /** Optional volcano caldera in the center. */
  caldera?: boolean;
}

const BIOME_PROFILES: Record<IslandBiomeV2, BiomeProfile> = {
  tropical: {
    hillCount: 60,
    hillRadius: [0.04, 0.16],
    ridgeStrength: 0.18,
    perlinAmplitude: 0.55,
    diamondAmplitude: 0.20,
    diamondRoughness: 0.55,
    domainWarp: 1.4,
    smoothRadius: 1,
    smoothIterations: 1,
    ease: Easing.EaseInWeak,
    edgeInner: 0.50,
    edgeOuter: 0.95,
    edgeExponent: 2.0,
  },
  volcanic: {
    hillCount: 35,
    hillRadius: [0.06, 0.22],
    ridgeStrength: 0.50,
    perlinAmplitude: 0.45,
    diamondAmplitude: 0.30,
    diamondRoughness: 0.65,
    domainWarp: 1.0,
    smoothRadius: 1,
    smoothIterations: 1,
    ease: Easing.EaseInStrong,
    edgeInner: 0.55,
    edgeOuter: 0.98,
    edgeExponent: 2.2,
    caldera: true,
  },
  temperate: {
    hillCount: 70,
    hillRadius: [0.05, 0.18],
    ridgeStrength: 0.30,
    perlinAmplitude: 0.60,
    diamondAmplitude: 0.22,
    diamondRoughness: 0.52,
    domainWarp: 1.6,
    smoothRadius: 1,
    smoothIterations: 2,
    ease: Easing.Smootherstep,
    edgeInner: 0.55,
    edgeOuter: 1.00,
    edgeExponent: 1.8,
  },
  arctic: {
    hillCount: 50,
    hillRadius: [0.06, 0.20],
    ridgeStrength: 0.40,
    perlinAmplitude: 0.50,
    diamondAmplitude: 0.25,
    diamondRoughness: 0.58,
    domainWarp: 0.8,
    smoothRadius: 1,
    smoothIterations: 2,
    ease: Easing.EaseInOut,
    edgeInner: 0.60,
    edgeOuter: 1.00,
    edgeExponent: 2.0,
  },
  desert: {
    hillCount: 40,
    hillRadius: [0.08, 0.24],
    ridgeStrength: 0.10,
    perlinAmplitude: 0.45,
    diamondAmplitude: 0.18,
    diamondRoughness: 0.45,
    domainWarp: 2.2,
    smoothRadius: 2,
    smoothIterations: 2,
    ease: Easing.EaseInWeak,
    edgeInner: 0.45,
    edgeOuter: 1.00,
    edgeExponent: 1.6,
  },
  haunted: {
    hillCount: 55,
    hillRadius: [0.05, 0.18],
    ridgeStrength: 0.45,
    perlinAmplitude: 0.55,
    diamondAmplitude: 0.28,
    diamondRoughness: 0.62,
    domainWarp: 1.8,
    smoothRadius: 1,
    smoothIterations: 1,
    ease: Easing.EaseInOut,
    edgeInner: 0.50,
    edgeOuter: 0.97,
    edgeExponent: 2.0,
  },
  archipelago: {
    hillCount: 18,
    hillRadius: [0.05, 0.12],
    ridgeStrength: 0.20,
    perlinAmplitude: 0.40,
    diamondAmplitude: 0.30,
    diamondRoughness: 0.55,
    domainWarp: 2.0,
    smoothRadius: 1,
    smoothIterations: 1,
    ease: Easing.EaseInWeak,
    edgeInner: 0.30,
    edgeOuter: 1.00,
    edgeExponent: 1.4,
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Composite generator
// ───────────────────────────────────────────────────────────────────────────

export type DockSide = 'north' | 'south' | 'east' | 'west';

export interface IslandTerrainV2Options {
  size: number;
  segments: number;
  seed: number;
  maxHeight: number;
  waterLevel?: number;
  biome: IslandBiomeV2;
  /** If set, carves a flat dock pad on this side of the island. */
  dock?: { side: DockSide; pad?: number; depth?: number };
  /** Optional extra influences (mountain peaks, lakes, etc.). */
  influences?: Influence[];
  /** Override biome profile selectively. */
  profileOverrides?: Partial<BiomeProfile>;
}

export interface IslandTerrainV2Result {
  heightmap: Heightmap;
  size: number;
  segments: number;
  biome: IslandBiomeV2;
  /** Bilinear height query in world space. */
  getHeightAt: (x: number, z: number) => number;
  /** Slope angle (radians) at a world-space point. */
  getSlopeAt: (x: number, z: number) => number;
  /** Surface normal at a world-space point. */
  getNormalAt: (x: number, z: number, out?: THREE.Vector3) => THREE.Vector3;
  /** Apply heightmap to an existing PlaneGeometry. */
  applyTo: (geometry: THREE.PlaneGeometry) => void;
  /**
   * Build a ready-to-render PlaneGeometry mesh with BVH-accelerated raycasts
   * already attached. The returned mesh is rotated so +Y is up and centered
   * on the world origin.
   *
   *   const mesh = result.buildMesh(material);
   *   scene.add(mesh);
   *   const picker = new TerrainPicker([mesh]);
   *
   * See `lib/terrain/RULES.md` rule §3.
   */
  buildMesh: (
    material: THREE.Material,
    bvh?: AttachBVHOptions,
  ) => THREE.Mesh;
}

export function generateIslandTerrainV2(opts: IslandTerrainV2Options): IslandTerrainV2Result {
  const profile = { ...BIOME_PROFILES[opts.biome], ...(opts.profileOverrides ?? {}) };
  const hm = new Heightmap({ segments: opts.segments, size: opts.size });

  // Layer 1 — large radial hills (island bulk)
  hill(hm, {
    seed: opts.seed,
    count: profile.hillCount,
    minRadius: profile.hillRadius[0],
    maxRadius: profile.hillRadius[1],
    amplitude: 0.65,
    centerBias: 0.6,
  });

  // Layer 2 — diamond-square plasma adds varied jaggedness
  diamondSquare(hm, {
    seed: opts.seed ^ 0xa1b2c3d4,
    roughness: profile.diamondRoughness,
    amplitude: profile.diamondAmplitude,
    cornerSeedRange: 0.3,
  });

  // Layer 3 — multi-octave Perlin (organic mid-frequency detail)
  layeredPerlin(hm, {
    seed: opts.seed ^ 0x55aa55aa,
    octaves: 5,
    frequency: 3.0,
    lacunarity: 2.0,
    persistence: 0.5,
    amplitude: profile.perlinAmplitude,
    domainWarp: profile.domainWarp,
  });

  // Layer 4 — ridged noise (mountain spines / dunes)
  if (profile.ridgeStrength > 0.001) {
    ridged(hm, {
      seed: opts.seed ^ 0x33cc33cc,
      octaves: 4,
      frequency: 2.4,
      lacunarity: 2.0,
      persistence: 0.55,
      amplitude: profile.ridgeStrength,
      sharpness: 2.0,
    });
  }

  // Normalize → [0, 1] before easing + edge clamp
  hm.normalize(0, 1);
  applyEasing(hm.data, profile.ease, 0, 1);

  // Stretch to [waterLevel, maxHeight]
  const waterLevel = opts.waterLevel ?? 0;
  const range = opts.maxHeight - waterLevel;
  for (let i = 0; i < hm.data.length; i++) {
    hm.data[i] = waterLevel + hm.data[i] * range;
  }

  // Edge clamp into water
  clampIslandEdges(hm, {
    shape: 'radial',
    innerFraction: profile.edgeInner,
    outerFraction: profile.edgeOuter,
    targetHeight: waterLevel - opts.maxHeight * 0.15, // dip below waterline at the rim
    exponent: profile.edgeExponent,
  });

  // Optional caldera for volcanic
  if (profile.caldera) {
    applyInfluences(hm, [
      // Raised crater rim
      {
        shape: 'circle',
        center: { x: 0, z: 0 },
        size: opts.size * 0.10,
        height: opts.maxHeight * 1.05,
        mode: 'max',
        falloff: 1.4,
        plateau: 0.55,
      },
      // Crater depression
      {
        shape: 'circle',
        center: { x: 0, z: 0 },
        size: opts.size * 0.06,
        height: opts.maxHeight * 0.45,
        mode: 'set',
        falloff: 2.0,
        plateau: 0.35,
      },
    ]);
  }

  // Optional dock pad
  if (opts.dock) {
    const padSize  = opts.dock.pad   ?? opts.size * 0.05;
    const padDepth = opts.dock.depth ?? Math.min(2.5, opts.maxHeight * 0.07);
    const off = opts.size * 0.42;
    const center =
      opts.dock.side === 'north' ? { x: 0,    z: -off } :
      opts.dock.side === 'south' ? { x: 0,    z:  off } :
      opts.dock.side === 'east'  ? { x:  off, z:  0 } :
                                   { x: -off, z:  0 };
    applyInfluences(hm, [{
      shape: 'rect',
      center,
      size: { x: padSize, z: padSize },
      height: waterLevel + padDepth,
      mode: 'set',
      falloff: 1.4,
      plateau: 0.55,
    }]);
  }

  // User-supplied influences
  if (opts.influences && opts.influences.length) {
    applyInfluences(hm, opts.influences);
  }

  // Final smoothing — kills aliasing artifacts from layered noise
  if (profile.smoothRadius > 0 && profile.smoothIterations > 0) {
    smoothHeightmap(hm, profile.smoothRadius, profile.smoothIterations);
  }

  return {
    heightmap: hm,
    size: opts.size,
    segments: opts.segments,
    biome: opts.biome,
    getHeightAt: (x, z) => hm.sampleWorld(x, z),
    getSlopeAt:  (x, z) => hm.slopeAtWorld(x, z),
    getNormalAt: (x, z, out) => hm.normalAtWorld(x, z, out),
    applyTo: (geometry) => applyHeightmapToPlane(geometry, hm),
    buildMesh: (material, bvh) => {
      const geom = new THREE.PlaneGeometry(
        opts.size, opts.size, opts.segments, opts.segments,
      );
      // We want +Y up after rotation, so write displacement to position.z
      // (default) BEFORE rotating.
      applyHeightmapToPlane(geom, hm, /* writeAxisY */ false);
      geom.rotateX(-Math.PI / 2);
      geom.computeVertexNormals();
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
      const mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `terrainV2:${opts.biome}:${opts.seed}`;
      // BVH attach happens last so it sees the final indexed geometry.
      attachBVH(mesh, bvh);
      return mesh;
    },
  };
}
