/**
 * metricSizing — normalize loaded assets to real-world metres.
 *
 * Canonical /islands world: **1 unit = 1 metre**.
 *
 * Architecture SSOT (human-scale):
 *   • Player captain height     ≈ 2.00 m
 *   • Doorway clear height        = 2.75 m  (walk-through clearance)
 *   • Exterior wall storey height ≈ 3.20 m  (door + lintel + header)
 *
 * The open-world map is sized so terrain, trees, and structures feel large
 * relative to the 2 m captain — not toy-scale.
 */
import * as THREE from 'three';

/** Captain / player reference height (metres). */
export const PLAYER_HEIGHT_M = 2.0;

/**
 * Clear doorway height (metres). All cabin/shop/build doors must match this
 * so a 2 m character walks through with headroom.
 */
export const DOORWAY_HEIGHT_M = 2.75;

/** Typical door leaf width (metres). */
export const DOORWAY_WIDTH_M = 1.15;

/** Exterior wall storey height: door + lintel + plate. */
export const WALL_STOREY_HEIGHT_M = 3.2;

/**
 * Horizontal world scale multiplier vs the original ~1 km islands.
 * Applied via `IslandConfig.worldSize` (not a runtime mesh scale).
 */
export const ISLAND_MAP_SCALE = 2.5;

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
 *   axis 'y'   → match height (trees, animals, plants, doors)
 *   axis 'max' → match largest dimension (chunky boulders)
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

/**
 * Metric target ranges (metres) per scatter category.
 * Trees are real forest scale; harvestables stay below doorway/player height.
 */
export const METRIC_TARGETS = {
  /** Mature forest canopy — overhead vs 2 m captain / 2.75 m doors. */
  tree:    [8.0, 18.0] as [number, number],
  /** Scenery rocks — mostly under door height. */
  boulder: [0.5, 2.0] as [number, number],
  /** Crystal harvest clusters — chest height max. */
  crystal: [0.4, 1.0] as [number, number],
  /** Ore / stone harvest nodes — knee to waist. */
  harvest: [0.45, 1.05] as [number, number],
  plant:   [0.25, 1.0] as [number, number],
  flower:  [0.12, 0.4] as [number, number],
  scrap:   [0.35, 0.9] as [number, number],
} as const;

export type MetricCategory = keyof typeof METRIC_TARGETS;

/** Animal heights (metres) relative to ~2 m player. */
export const ANIMAL_SIZE_M = {
  rabbit: 0.4,
  fox:    0.6,
  boar:   1.0,
  wolf:   1.1,
  deer:   1.7,
  bear:   2.2,
} as const;

/**
 * Normalize prototype to range midpoint; return scale jitter for instancing.
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

/** Build a door slab mesh at the canonical 2.75 m clear height. */
export function createDoorwayMesh(
  color = 0x2d1810,
  opts?: { widthM?: number; thicknessM?: number },
): THREE.Mesh {
  const w = opts?.widthM ?? DOORWAY_WIDTH_M;
  const t = opts?.thicknessM ?? 0.12;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, DOORWAY_HEIGHT_M, t),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }),
  );
  // Pivot at ground: center of box is halfway up the door.
  mesh.position.y = DOORWAY_HEIGHT_M * 0.5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'doorway';
  mesh.userData.doorwayHeightM = DOORWAY_HEIGHT_M;
  return mesh;
}
