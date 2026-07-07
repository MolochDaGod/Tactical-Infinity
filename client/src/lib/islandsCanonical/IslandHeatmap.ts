/**
 * IslandHeatmap — pathfinding cost grid for AI movement on an island.
 *
 * Builds a 2D Float32 cost grid by sampling the heightmap and applying:
 *   • slope penalty   — steep terrain costs more to traverse
 *   • water penalty   — cells below sea level are very expensive
 *   • beach bonus     — the SHORE band is cheap (preferred coast paths)
 *   • peak penalty    — AIR_HIGH cells are slightly costlier (steep climbs)
 *
 * Pre-computed once per island and read by Yuka behaviours, A*, or any
 * cost-aware pather. **Do not walk the heightmap directly per AI tick** —
 * use this and `costAt(x, z)`.
 *
 * See `.agents/skills/islands-and-terrain/SKILL.md` §7.
 */

import type { IslandHeightmap } from './IslandHeightmap';
import { bandFor } from './depthBands';

export interface IslandHeatmapOptions {
  heightmap: IslandHeightmap;
  /** Side length of the heightmap in world units. */
  worldSize: number;
  /**
   * Resolution of the cost grid. Should be ≤ heightmap.resolution; lower
   * values speed up A* at the price of granularity. Default 128.
   */
  resolution?: number;
  /** Multiplier applied to the per-cell slope (rise/run). Default 4.0. */
  slopePenalty?: number;
  /** Cost added to cells where height < 0 (water). Default 50.0. */
  waterPenalty?: number;
  /** Bonus (negative cost) applied to SHORE-band cells. Default -0.3. */
  beachBonus?: number;
  /** Multiplier on AIR_HIGH cells. Default 1.5. */
  peakPenalty?: number;
  /** Base cost per cell before modifiers. Default 1.0. */
  baseCost?: number;
}

export interface IslandHeatmap {
  /** Row-major cost values; index = z * resolution + x. */
  data: Float32Array;
  resolution: number;
  worldSize: number;
  /** Bilinearly sample the cost at world position (x, z). +Infinity if out of bounds. */
  costAt(worldX: number, worldZ: number): number;
  /** Min/max cost across all cells, useful for normalising debug overlays. */
  bounds: { min: number; max: number };
}

const DEFAULTS = {
  resolution: 128,
  slopePenalty: 4.0,
  waterPenalty: 50.0,
  beachBonus: -0.3,
  peakPenalty: 1.5,
  baseCost: 1.0,
};

export function buildIslandHeatmap(opts: IslandHeatmapOptions): IslandHeatmap {
  const {
    heightmap,
    worldSize,
    resolution    = DEFAULTS.resolution,
    slopePenalty  = DEFAULTS.slopePenalty,
    waterPenalty  = DEFAULTS.waterPenalty,
    beachBonus    = DEFAULTS.beachBonus,
    peakPenalty   = DEFAULTS.peakPenalty,
    baseCost      = DEFAULTS.baseCost,
  } = opts;

  const r = resolution;
  const data = new Float32Array(r * r);
  const cellWorld = worldSize / r;
  const half = worldSize / 2;
  const eps = cellWorld; // gradient sampling step

  let minCost =  Infinity;
  let maxCost = -Infinity;

  for (let z = 0; z < r; z++) {
    for (let x = 0; x < r; x++) {
      const wx = -half + (x + 0.5) * cellWorld;
      const wz = -half + (z + 0.5) * cellWorld;
      const h  = heightmap.getHeightAt(wx, wz);

      // slope from 4-cell central differences
      const hPx = heightmap.getHeightAt(wx + eps, wz);
      const hMx = heightmap.getHeightAt(wx - eps, wz);
      const hPz = heightmap.getHeightAt(wx, wz + eps);
      const hMz = heightmap.getHeightAt(wx, wz - eps);
      const gx = (hPx - hMx) / (2 * eps);
      const gz = (hPz - hMz) / (2 * eps);
      const slope = Math.hypot(gx, gz);

      let cost = baseCost + slope * slopePenalty;

      const band = bandFor(h);
      if (band === 'SHORE') cost += beachBonus;
      else if (band === 'AIR_HIGH') cost *= peakPenalty;
      else if (band === 'SHALLOW' || band === 'MID' || band === 'DEEP') cost += waterPenalty;

      // Anything in water is also slope-irrelevant — flatten to base+water.
      if (h < 0) cost = baseCost + waterPenalty;

      data[z * r + x] = cost;
      if (cost < minCost) minCost = cost;
      if (cost > maxCost) maxCost = cost;
    }
  }

  function costAt(worldX: number, worldZ: number): number {
    // World → grid (in fractional cell coords, cell-centered).
    const gx = (worldX + half) / cellWorld - 0.5;
    const gz = (worldZ + half) / cellWorld - 0.5;
    if (gx < 0 || gz < 0 || gx > r - 1 || gz > r - 1) return Infinity;

    const x0 = Math.floor(gx), z0 = Math.floor(gz);
    const x1 = Math.min(r - 1, x0 + 1);
    const z1 = Math.min(r - 1, z0 + 1);
    const fx = gx - x0, fz = gz - z0;

    const c00 = data[z0 * r + x0];
    const c10 = data[z0 * r + x1];
    const c01 = data[z1 * r + x0];
    const c11 = data[z1 * r + x1];

    return (c00 * (1 - fx) + c10 * fx) * (1 - fz) +
           (c01 * (1 - fx) + c11 * fx) * fz;
  }

  return { data, resolution: r, worldSize, costAt, bounds: { min: minCost, max: maxCost } };
}
