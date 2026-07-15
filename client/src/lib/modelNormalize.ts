/**
 * Shared world-scale normalization for FBX/GLB props, fauna, chains.
 *
 * Authoring packs (Quaternius, Ultimate Fantasy RTS, Sketchfab multipacks)
 * are usually centimetre-scale or arbitrary. Gameplay world uses metres
 * (player ~1.8 m tall, sea surface y≈0).
 *
 * Always: fit bbox → target metres, optional ground feet, store applied scale.
 */

import * as THREE from 'three';

export type FitAxis = 'height' | 'length' | 'max';

export interface NormalizeOptions {
  /** Desired size in metres along the chosen axis */
  targetSizeM: number;
  /**
   * height → fit bbox Y
   * length → fit max(X, Z) (good for fish / chain links)
   * max    → fit max(X, Y, Z)
   */
  axis?: FitAxis;
  /** Seat lowest point at y=0 (buildings, livestock) */
  ground?: boolean;
  /** Center XZ on origin */
  centerXZ?: boolean;
  /** Center fully on origin (ocean fish) */
  center?: boolean;
}

export interface NormalizeResult {
  scale: number;
  size: THREE.Vector3;
}

function axisSize(size: THREE.Vector3, axis: FitAxis): number {
  if (axis === 'height') return Math.max(size.y, 0.001);
  if (axis === 'length') return Math.max(size.x, size.z, 0.001);
  return Math.max(size.x, size.y, size.z, 0.001);
}

/**
 * Uniform-scale `root` so its world bbox matches `targetSizeM` on `axis`.
 * Resets root scale to 1 first — nest content under a child if you need
 * non-uniform stretch later (chains).
 */
export function normalizeToMetres(
  root: THREE.Object3D,
  opts: NormalizeOptions,
): NormalizeResult {
  const axis = opts.axis ?? 'height';
  const target = Math.max(opts.targetSizeM, 0.01);

  // Clear prior normalize so re-fit is stable
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!isFinite(size.x) || size.lengthSq() < 1e-12) {
    return { scale: 1, size };
  }

  const s = target / axisSize(size, axis);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(root);
  const size2 = new THREE.Vector3();
  box2.getSize(size2);
  const center = new THREE.Vector3();
  box2.getCenter(center);

  if (opts.center) {
    root.position.sub(center);
  } else {
    if (opts.centerXZ) {
      root.position.x -= center.x;
      root.position.z -= center.z;
    }
    if (opts.ground) {
      root.position.y -= box2.min.y;
    }
  }

  root.userData.normalizeScale = s;
  root.userData.normalizeTargetM = target;
  root.userData.normalizeAxis = axis;
  root.userData.normalizedSize = size2.clone();

  return { scale: s, size: size2 };
}

/**
 * Ocean fish depth band.
 * y is more negative deeper. Hard clamp [-15, -2].
 * Floor: cannot go below floorDepth + margin.
 */
export const OCEAN_SURFACE_Y = -2;
export const OCEAN_MAX_DEPTH_Y = -15;
export const OCEAN_FLOOR_MARGIN = 1.5;

export function resolveOceanDepthBand(
  bodyLengthM: number,
  floorDepth: number,
  speciesLo?: number,
  speciesHi?: number,
): { lo: number; hi: number } | null {
  // Body length → preferred band (small shallow, large deep)
  const t = Math.min(1, Math.max(0, (bodyLengthM - 0.25) / 7.5));
  const center = OCEAN_SURFACE_Y + t * (OCEAN_MAX_DEPTH_Y - OCEAN_SURFACE_Y);
  const half = 1.0 + t * 2.2;
  let prefLo = Math.max(OCEAN_MAX_DEPTH_Y, center - half);
  let prefHi = Math.min(OCEAN_SURFACE_Y, center + half * 0.45);

  if (speciesLo !== undefined) prefLo = Math.max(prefLo, speciesLo);
  if (speciesHi !== undefined) prefHi = Math.min(prefHi, speciesHi);

  const deepestAllowed = Math.max(OCEAN_MAX_DEPTH_Y, floorDepth + OCEAN_FLOOR_MARGIN);
  const shallowestAllowed = OCEAN_SURFACE_Y;

  // Intersect preferred with physical limits
  let lo = Math.max(prefLo, deepestAllowed);
  let hi = Math.min(prefHi, shallowestAllowed);

  if (lo > hi) {
    // Preferred band invalid (e.g. shallow shelf) — use physical water column if any
    lo = deepestAllowed;
    hi = shallowestAllowed;
    if (lo > hi) return null; // no water column for fish
  }

  return { lo, hi };
}

export function clampOceanDepth(y: number, lo: number, hi: number): number {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const deep = Math.max(OCEAN_MAX_DEPTH_Y, a);
  const shallow = Math.min(OCEAN_SURFACE_Y, b);
  return Math.min(shallow, Math.max(deep, y));
}
