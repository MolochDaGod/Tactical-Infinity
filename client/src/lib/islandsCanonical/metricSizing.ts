/**
 * metricSizing — normalize loaded assets to real-world metres.
 *
 * Source GLB/FBX packs ship at wildly different intrinsic scales (some are
 * authored in centimetres, some in arbitrary blender units). Rather than
 * hand-tuning a magic `scale` per asset, we measure the world-space bounding
 * box and rescale uniformly so a chosen axis matches a target size in metres.
 *
 * The canonical /islands world treats 1 unit = 1 metre and the player
 * character is ~2 m tall, so every scattered prop and animal is sized
 * RELATIVE to that:
 *   • trees      2–4 m
 *   • boulders   1–5 m
 *   • crystals   1–3 m
 *   • plants     0.3–1.2 m
 *   • flowers    0.15–0.5 m
 *   • animals    species-specific (rabbit 0.4 m … bear 2.4 m)
 */
import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/** Measure the world-space size (after current transform) of an object. */
export function measureSize(obj: THREE.Object3D): THREE.Vector3 {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  return _box.getSize(new THREE.Vector3());
}

/**
 * Uniformly rescale `obj` so its chosen axis equals `targetMeters`.
 *   axis 'y'   → match height (default; correct for trees, animals, plants)
 *   axis 'max' → match the largest dimension (good for chunky boulders)
 * Returns the scale factor applied (1 if the object had no measurable size).
 */
export function normalizeToMetricSize(
  obj: THREE.Object3D,
  targetMeters: number,
  axis: 'y' | 'max' = 'y',
): number {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  _box.getSize(_size);
  const cur = axis === 'y' ? _size.y : Math.max(_size.x, _size.y, _size.z);
  if (!isFinite(cur) || cur <= 1e-4) return 1;
  const factor = targetMeters / cur;
  obj.scale.multiplyScalar(factor);
  obj.updateMatrixWorld(true);
  return factor;
}

/** Metric target ranges (metres) per scatter category. */
export const METRIC_TARGETS = {
  tree:    [2.0, 4.0] as [number, number],
  boulder: [1.0, 5.0] as [number, number],
  crystal: [1.0, 3.0] as [number, number],
  plant:   [0.3, 1.2] as [number, number],
  flower:  [0.15, 0.5] as [number, number],
  scrap:   [0.6, 1.4] as [number, number],
} as const;

export type MetricCategory = keyof typeof METRIC_TARGETS;

/** Animal heights in metres, sized relative to the ~2 m player character. */
export const ANIMAL_SIZE_M = {
  rabbit: 0.4,
  fox:    0.6,
  boar:   1.0,
  wolf:   1.1,
  deer:   1.8,
  bear:   2.4,
} as const;

/**
 * Given a metric [min,max] range, normalize the prototype to the range
 * midpoint and return the jitter `scaleRange` to feed instancing so the final
 * placed sizes span the requested metric band.
 */
export function metricRangeToScaleJitter(
  proto: THREE.Object3D,
  range: [number, number],
  axis: 'y' | 'max' = 'y',
): [number, number] {
  const mid = (range[0] + range[1]) * 0.5;
  normalizeToMetricSize(proto, mid, axis);
  return [range[0] / mid, range[1] / mid];
}
