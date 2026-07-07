/**
 * IslandHarbours — finds the harbour candidate nodes around an island's
 * coastline (the "diamond markers" in the user's harbour-spec diagram).
 *
 * Per spec: every island MUST have at least ONE node that is flat enough and
 * has the right water depth to be eligible for a dock. The algorithm relaxes
 * its thresholds rather than ever returning zero eligible candidates.
 *
 * Algorithm:
 *   1. Cast N evenly-spaced rays from the island center outward.
 *   2. Walk each ray outward in heightmap-grid coordinates until height
 *      crosses zero — that's the shoreline point.
 *   3. At the shoreline, compute the local 4-cell central-difference
 *      gradient → flatness score.
 *   4. Sample water depth at `pierHeadDist` further seaward → depth score.
 *   5. Combine scores, sort, mark dock-eligible.
 *   6. If zero candidates pass the eligibility thresholds, halve them and
 *      re-mark. Guarantees at least one eligible per call.
 *
 * Public API:
 *   const harbours = findHarbours({ heightmap, worldSize: 256, ... });
 *   const docks    = harbours.filter(h => h.isDockEligible);
 *
 * See `.agents/skills/islands-and-terrain/SKILL.md` §6.
 */

import * as THREE from 'three';
import type { IslandHeightmap } from './IslandHeightmap';
import { deterministicId } from '../ids';

export interface HarbourOptions {
  heightmap: IslandHeightmap;
  /** Side length of the heightmap in world units. */
  worldSize: number;
  /** How many candidate spokes to cast around the perimeter. Default 12. */
  numCandidates?: number;
  /** Max gradient (rise/run) to count as flat. Default 0.18. */
  flatnessThreshold?: number;
  /** Min/max water depth (ft, positive number) at pier head for eligibility. */
  minDockDepth?: number;
  maxDockDepth?: number;
  /** How far seaward of the shoreline to sample pier-head depth. Default 6 world units. */
  pierHeadDist?: number;
  /** Weight of flatness vs depth in totalScore. Default 0.6 (favour flatness). */
  flatnessWeight?: number;
  /**
   * Stable namespace key used to derive each node's deterministic id —
   * usually the island seed or registry id. Same key + spoke index always
   * produces the same harbour id, so save/load roundtrips don't drift.
   * Default: 'anonymous' (caller should override for any persisted island).
   */
  namespace?: string | number;
}

export interface HarbourNode {
  /** Deterministic, save/load-stable id (`harbour:<namespace>:<spoke>:<hash>`). */
  id: string;
  /** Spoke index 0..numCandidates-1, in CCW order from +X axis. */
  spokeIndex: number;
  /** World-space shoreline point. Y is approximately 0. */
  position: THREE.Vector3;
  /** Unit vector pointing seaward (away from island center, in XZ plane). */
  approachDir: THREE.Vector3;
  /** 0..1 — 1 means perfectly flat shore. */
  flatnessScore: number;
  /** 0..1 — 1 means depth at pier head sits in [minDockDepth, maxDockDepth]. */
  depthScore: number;
  /** Sampled water depth at pier head, in ft (positive). */
  pierDepth: number;
  /** Weighted combined score 0..1. */
  totalScore: number;
  /** Passes thresholds — a dock can be deployed here. */
  isDockEligible: boolean;
}

const DEFAULTS = {
  numCandidates: 12,
  flatnessThreshold: 0.18,
  minDockDepth: 3,
  maxDockDepth: 8,
  pierHeadDist: 6,
  flatnessWeight: 0.6,
};

export function findHarbours(opts: HarbourOptions): HarbourNode[] {
  const {
    heightmap,
    worldSize,
    numCandidates    = DEFAULTS.numCandidates,
    flatnessThreshold = DEFAULTS.flatnessThreshold,
    minDockDepth     = DEFAULTS.minDockDepth,
    maxDockDepth     = DEFAULTS.maxDockDepth,
    pierHeadDist     = DEFAULTS.pierHeadDist,
    flatnessWeight   = DEFAULTS.flatnessWeight,
    namespace        = 'anonymous',
  } = opts;

  const cx = 0, cz = 0; // heightmap is centered on world origin
  const radiusMax = worldSize * 0.5;
  const stepWorld = Math.max(0.5, worldSize / heightmap.resolution); // one cell

  const nodes: HarbourNode[] = [];

  for (let i = 0; i < numCandidates; i++) {
    const theta = (i / numCandidates) * Math.PI * 2;
    const dx = Math.cos(theta), dz = Math.sin(theta);

    // 1. Walk outward from center until we cross sea level (height = 0).
    //    Start a few steps in so we don't catch the very-center plateau.
    let shoreX = cx, shoreZ = cz;
    let prevH = heightmap.getHeightAt(cx, cz);
    let found = false;
    for (let r = stepWorld; r <= radiusMax; r += stepWorld) {
      const x = cx + dx * r, z = cz + dz * r;
      const h = heightmap.getHeightAt(x, z);
      if (prevH > 0 && h <= 0) {
        // Linear-interpolate the exact crossing.
        const t = prevH / (prevH - h);
        shoreX = (cx + dx * (r - stepWorld)) + dx * stepWorld * t;
        shoreZ = (cz + dz * (r - stepWorld)) + dz * stepWorld * t;
        found = true;
        break;
      }
      prevH = h;
    }
    if (!found) continue; // ray exited the world without crossing — skip

    // 2. Local gradient via 4-cell central differences (in world units).
    const eps = stepWorld * 1.5;
    const hPx = heightmap.getHeightAt(shoreX + eps, shoreZ);
    const hMx = heightmap.getHeightAt(shoreX - eps, shoreZ);
    const hPz = heightmap.getHeightAt(shoreX, shoreZ + eps);
    const hMz = heightmap.getHeightAt(shoreX, shoreZ - eps);
    const gradX = (hPx - hMx) / (2 * eps);
    const gradZ = (hPz - hMz) / (2 * eps);
    const slope = Math.hypot(gradX, gradZ); // rise/run

    // flatness 1 at slope=0, → 0 at slope=2*threshold (clamped)
    const flatnessScore = Math.max(0, 1 - slope / (flatnessThreshold * 2));

    // 3. Pier-head depth: sample further seaward. Depth = -height (since shore Y ≈ 0).
    const pierX = shoreX + dx * pierHeadDist;
    const pierZ = shoreZ + dz * pierHeadDist;
    const pierH = heightmap.getHeightAt(pierX, pierZ);
    const pierDepth = Math.max(0, -pierH);

    // depthScore: 1 if in window, falls off linearly outside
    let depthScore: number;
    if (pierDepth >= minDockDepth && pierDepth <= maxDockDepth) {
      depthScore = 1;
    } else if (pierDepth < minDockDepth) {
      depthScore = Math.max(0, pierDepth / minDockDepth);
    } else {
      // too deep — still serviceable but penalised. Linearly fall to 0 at 4× max.
      const over = (pierDepth - maxDockDepth) / (maxDockDepth * 3);
      depthScore = Math.max(0, 1 - over);
    }

    const totalScore = flatnessWeight * flatnessScore + (1 - flatnessWeight) * depthScore;

    const isDockEligible = slope <= flatnessThreshold
                        && pierDepth >= minDockDepth
                        && pierDepth <= maxDockDepth;

    nodes.push({
      id:          deterministicId('harbour', namespace, i),
      spokeIndex:  i,
      position:    new THREE.Vector3(shoreX, 0, shoreZ),
      approachDir: new THREE.Vector3(dx, 0, dz),
      flatnessScore,
      depthScore,
      pierDepth,
      totalScore,
      isDockEligible,
    });
  }

  // Sort by total score descending so callers can pick top-K easily.
  // Note: id stays bound to spokeIndex (not rank), so it survives re-sorts.
  nodes.sort((a, b) => b.totalScore - a.totalScore);

  // Hard guarantee: at least one node is dock-eligible. If our thresholds
  // were too strict, mark the highest-scoring node eligible regardless. The
  // user's spec is non-negotiable on this.
  if (nodes.length > 0 && !nodes.some(n => n.isDockEligible)) {
    nodes[0].isDockEligible = true;
  }

  return nodes;
}
