/**
 * WaterNodes — anchor points in the water around an island, parallel to
 * `IslandHarbours.ts` for land/dock anchors.
 *
 * Each node is a deterministic, save/load-stable point in one of the three
 * underwater depth bands (SHALLOW / MID / DEEP). They serve as:
 *
 *   • Wander targets for marine AI (fish swim toward a random node in their
 *     band, repeat).
 *   • Territory anchors for predators (a shark patrols around its assigned
 *     node, only ranges out to chase prey).
 *   • School spawn centers for shoals (cluster N fish around one MID node).
 *   • Loot/event triggers (sunken chests, kelp forests, hydrothermal vents).
 *
 * Generation is poisson-disk-ish: a stratified jitter grid filtered to keep
 * only points whose seabed depth puts them in the requested band, with a
 * minimum spacing test. Reproducible per (biome, seed) — re-running the
 * generator always yields the same node set.
 *
 * See `.agents/skills/islands-and-terrain/SKILL.md` §13 for the playbook.
 */

import * as THREE from 'three';
import type { IslandHeightmap } from './IslandHeightmap';
import { DEPTH_BANDS, type DepthBand } from './depthBands';
import { deterministicId, mulberry32, fnv1a } from '../ids';

export type WaterBand = Extract<DepthBand, 'SHALLOW' | 'MID' | 'DEEP'>;

export interface WaterNode {
  /** Deterministic id, format `water:<namespace>:<band>:<index>:<hash>`. */
  id: string;
  /** Stable index within its band (not array position — survives re-sorts). */
  bandIndex: number;
  /** Which depth band this node lives in. */
  band: WaterBand;
  /** World-space position. Y is sampled within the band's Y range. */
  position: THREE.Vector3;
  /** Seabed Y at this XZ — useful for "stay X meters above floor" rules. */
  seabedY: number;
  /** Distance to the nearest shoreline point (≈ 0). Useful for predator ranging. */
  nearestShoreDist: number;
}

export interface WaterNodeOptions {
  heightmap: IslandHeightmap;
  /** Side length of the heightmap in world units. */
  worldSize: number;
  /**
   * Stable namespace key — usually `${biome}:${seed}`. Same key always
   * yields the same node ids so save/load roundtrips work without
   * persisting every node.
   */
  namespace?: string | number;
  /** Target nodes per band. Actual count may be lower if water is sparse. */
  perBand?: { SHALLOW?: number; MID?: number; DEEP?: number };
  /** Minimum spacing between nodes in the same band (world units). */
  minSpacing?: number;
  /** Margin from world edge (world units). Default 8. */
  edgeMargin?: number;
}

const DEFAULT_PER_BAND = { SHALLOW: 8, MID: 12, DEEP: 6 } as const;

/**
 * Build all water nodes for an island. Returns nodes pre-sorted by band so
 * callers can `nodesByBand('MID')` cheaply.
 *
 *   const nodes = buildWaterNodes({ heightmap, worldSize, namespace: 'tropical:12345' });
 *   const midNodes = nodes.filter(n => n.band === 'MID');
 *   const fishWander = midNodes[rng() * midNodes.length | 0].position;
 */
export function buildWaterNodes(opts: WaterNodeOptions): WaterNode[] {
  const {
    heightmap,
    worldSize,
    namespace = 'anonymous',
    perBand = DEFAULT_PER_BAND,
    minSpacing = 8,
    edgeMargin = 8,
  } = opts;

  const seed = fnv1a(`waternodes:${namespace}`);
  const rng = mulberry32(seed);

  const half = worldSize * 0.5;
  const xMin = -half + edgeMargin;
  const xMax =  half - edgeMargin;
  const zMin = -half + edgeMargin;
  const zMax =  half - edgeMargin;

  // 1. Stratified candidate grid with jitter — gives even coverage without
  // bunching the way pure rng does.
  const candidates: { x: number; z: number; y: number; band: WaterBand | null }[] = [];
  const stride = Math.max(2, Math.floor(worldSize / 24));   // ~24 cells per axis
  for (let x = xMin; x <= xMax; x += stride) {
    for (let z = zMin; z <= zMax; z += stride) {
      const jx = x + (rng() - 0.5) * stride * 0.6;
      const jz = z + (rng() - 0.5) * stride * 0.6;
      const seabedY = heightmap.getHeightAt(jx, jz);
      candidates.push({ x: jx, z: jz, y: seabedY, band: bandFromSeabed(seabedY) });
    }
  }

  // 2. Bucket by band and pick the requested counts with minimum-spacing
  // rejection. We loop bands separately so spacing is per-band (a SHALLOW
  // node next to a DEEP node is fine — they're hundreds of meters apart in
  // the Y axis already).
  const bandTargets: Record<WaterBand, number> = {
    SHALLOW: perBand.SHALLOW ?? DEFAULT_PER_BAND.SHALLOW,
    MID:     perBand.MID     ?? DEFAULT_PER_BAND.MID,
    DEEP:    perBand.DEEP    ?? DEFAULT_PER_BAND.DEEP,
  };
  const minSpacingSq = minSpacing * minSpacing;
  const out: WaterNode[] = [];

  for (const band of ['SHALLOW', 'MID', 'DEEP'] as const) {
    const target = bandTargets[band];
    const pool = candidates.filter(c => c.band === band);
    // Shuffle deterministically.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let bandIndex = 0;
    for (const c of pool) {
      if (bandIndex >= target) break;

      // Minimum spacing within this band.
      let ok = true;
      for (const existing of out) {
        if (existing.band !== band) continue;
        const dx = existing.position.x - c.x;
        const dz = existing.position.z - c.z;
        if (dx * dx + dz * dz < minSpacingSq) { ok = false; break; }
      }
      if (!ok) continue;

      // Pick a Y inside the band's range (slightly off the seabed so AI
      // doesn't clip into terrain). Bands are negative numbers; Y = seabed
      // + a fraction of the band's headroom.
      const range = DEPTH_BANDS[band];
      const headroom = range.yMax - c.y;
      const yOff = Math.min(Math.max(2, headroom * 0.4), Math.abs(range.yMax - range.yMin));
      const y = c.y + yOff;

      const shoreDist = approxShoreDistance(heightmap, c.x, c.z);

      out.push({
        id: deterministicId('water', namespace, band, bandIndex),
        bandIndex,
        band,
        position: new THREE.Vector3(c.x, y, c.z),
        seabedY: c.y,
        nearestShoreDist: shoreDist,
      });
      bandIndex++;
    }
  }

  return out;
}

/** Pick the band a seabed-Y falls into (returns `null` for above-water/air). */
function bandFromSeabed(y: number): WaterBand | null {
  if (y >= DEPTH_BANDS.SHORE.yMin) return null;       // dry land or shoreline
  if (y >= DEPTH_BANDS.SHALLOW.yMin) return 'SHALLOW';
  if (y >= DEPTH_BANDS.MID.yMin)     return 'MID';
  if (y >= DEPTH_BANDS.DEEP.yMin)    return 'DEEP';
  return null;                                       // below seabed (shouldn't happen)
}

/**
 * Cheap shore-distance approximation. We don't BFS the heightmap — instead
 * we walk outward in 8 cardinal directions until we hit y >= 0 (above
 * water) or the world edge, and return the smallest distance. Good enough
 * for "is this node mid-ocean or near a beach?" decisions.
 */
function approxShoreDistance(heightmap: IslandHeightmap, x: number, z: number): number {
  const STEP = 4;
  const MAX_STEPS = 32;
  const dirs: [number, number][] = [
    [ 1, 0], [-1, 0], [0,  1], [0, -1],
    [ 1, 1], [ 1,-1], [-1, 1], [-1,-1],
  ];
  let best = Infinity;
  for (const [dx, dz] of dirs) {
    for (let s = 1; s <= MAX_STEPS; s++) {
      const sx = x + dx * STEP * s;
      const sz = z + dz * STEP * s;
      const h = heightmap.getHeightAt(sx, sz);
      if (h >= 0) {
        const dist = STEP * s * Math.SQRT2 * 0.5; // diagonal vs cardinal compromise
        if (dist < best) best = dist;
        break;
      }
    }
  }
  return Number.isFinite(best) ? best : Infinity;
}

/** Convenience filter: nodes in a given band, optionally near a position. */
export function nodesByBand(
  nodes: readonly WaterNode[],
  band: WaterBand,
  near?: THREE.Vector3,
  withinRadius?: number,
): WaterNode[] {
  let filtered = nodes.filter(n => n.band === band);
  if (near && withinRadius !== undefined) {
    const r2 = withinRadius * withinRadius;
    filtered = filtered.filter(n => n.position.distanceToSquared(near) <= r2);
  }
  return filtered;
}
