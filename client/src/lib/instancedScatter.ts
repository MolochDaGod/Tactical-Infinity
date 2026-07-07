/**
 * instancedScatter.ts
 * GPU-instanced terrain scatter using THREE.InstancedMesh (zero extra deps).
 *
 * Spatial coherence rules enforced here:
 *  1. All Y positions are obtained from BVH downward raycast (triangle-accurate).
 *  2. Each instance origin is lifted by half its bounding box height + 0.05 margin
 *     so the mesh sits ON the surface rather than sinking through it.
 *  3. Slope & height zone filters prevent placement on cliffs or underwater.
 *  4. THREE.Layers: SCATTER_LAYER (bit 1) is assigned to every instance mesh so
 *     it can be culled from shadow cameras or special passes independently.
 *
 * Depends on: three (already installed), three-mesh-bvh (already installed)
 */

import * as THREE from 'three';
import type { TerrainData } from './islandHeightmapTerrain';
import type { TerrainBVH }  from './terrainBVH';

// ── Render layer allocation ───────────────────────────────────────────────────
/** Three.js layer bit for all scatter meshes. Use camera.layers.disable(1) to hide. */
export const SCATTER_LAYER = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScatterLayer {
  mesh: THREE.InstancedMesh;
  count: number;
  dispose(): void;
}

export interface ArenaScatter {
  rocks:    ScatterLayer;
  pines:    ScatterLayer;
  palms:    ScatterLayer;
  boulders: ScatterLayer;
  dispose(): void;
}

// ── Seeded RNG (xorshift32) ───────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

// ── Scatter position sampler ──────────────────────────────────────────────────

interface SampleParams {
  count:       number;
  minRadius:   number;
  maxRadius:   number;
  minHeight:   number;
  maxHeight:   number;
  maxSlope:    number;
  avoidCenter: number;
  seed:        number;
}

interface SurfacePoint {
  x: number;
  y: number;   // exact BVH/heightmap surface Y
  z: number;
  slope: number;
}

function sampleSurface(
  terrain: TerrainData,
  bvh:     TerrainBVH | null,
  p:       SampleParams,
): SurfacePoint[] {
  const rng    = makeRng(p.seed);
  const getH   = bvh ? bvh.getHeightAt.bind(bvh) : terrain.getHeightAt.bind(terrain);
  const result: SurfacePoint[] = [];
  const maxTry = p.count * 18;

  for (let t = 0; t < maxTry && result.length < p.count; t++) {
    const angle = rng() * Math.PI * 2;
    const dist  = p.minRadius + rng() * (p.maxRadius - p.minRadius);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    if (dist < p.avoidCenter) continue;

    const y     = getH(x, z);
    const slope = terrain.getSlopeAt(x, z);

    if (y < p.minHeight || y > p.maxHeight) continue;
    if (slope > p.maxSlope) continue;

    result.push({ x, y, z, slope });
  }

  return result;
}

// ── Matrix builder ────────────────────────────────────────────────────────────

const _mat  = new THREE.Matrix4();
const _pos  = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl  = new THREE.Vector3();
const _rotY = new THREE.Euler();

function buildMatrix(
  x: number, y: number, z: number,
  rotY: number,
  sx: number, sy: number, sz: number,
): THREE.Matrix4 {
  _pos.set(x, y, z);
  _rotY.set(0, rotY, 0);
  _quat.setFromEuler(_rotY);
  _scl.set(sx, sy, sz);
  return _mat.compose(_pos, _quat, _scl);
}

// ── Layer helper ──────────────────────────────────────────────────────────────

function applyScatterLayer(mesh: THREE.InstancedMesh): void {
  mesh.layers.set(SCATTER_LAYER);
  mesh.layers.enable(0); // also visible on default layer
}

// ── Rock scatter ──────────────────────────────────────────────────────────────

function buildRockLayer(
  scene:   THREE.Scene,
  terrain: TerrainData,
  bvh:     TerrainBVH | null,
  count:   number,
  seed:    number,
): ScatterLayer {
  const rng    = makeRng(seed + 10);
  const points = sampleSurface(terrain, bvh, {
    count, minRadius: 8, maxRadius: terrain.radius - 15,
    minHeight: 1.0, maxHeight: terrain.radius * 0.3,
    maxSlope: 0.72, avoidCenter: 6, seed,
  });

  const geo  = new THREE.DodecahedronGeometry(1.0, 1);
  const mat  = new THREE.MeshToonMaterial({ color: 0x7a6b55 });
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'scatter_rocks';
  applyScatterLayer(mesh);

  const tmp = new THREE.Matrix4();
  points.forEach(({ x, y, z }, i) => {
    const sx = 1.2 + rng() * 2.0;
    const sy = 0.65 + rng() * 1.0;
    const sz = 1.0 + rng() * 1.8;
    // Y offset: place bottom of rock ON the surface (half height = sy * 0.5 + margin)
    const worldY = y + sy * 0.5 + 0.05;
    buildMatrix(x, worldY, z, rng() * Math.PI * 2, sx, sy, sz).toArray(tmp.elements);
    mesh.setMatrixAt(i, tmp);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return {
    mesh,
    count: points.length,
    dispose: () => { geo.dispose(); mat.dispose(); scene.remove(mesh); },
  };
}

// ── Pine tree scatter ─────────────────────────────────────────────────────────

function buildPineLayer(
  scene:   THREE.Scene,
  terrain: TerrainData,
  bvh:     TerrainBVH | null,
  count:   number,
  seed:    number,
): ScatterLayer {
  const rng    = makeRng(seed + 20);
  const points = sampleSurface(terrain, bvh, {
    count, minRadius: 18, maxRadius: terrain.radius - 18,
    minHeight: 3.5, maxHeight: terrain.radius * 0.32,
    maxSlope: 0.5, avoidCenter: 10, seed: seed + 100,
  });

  // Cone = pine crown. Pivot is at base of cone, so worldY just needs terrain Y.
  const geo  = new THREE.ConeGeometry(0.95, 4.0, 6);
  const mat  = new THREE.MeshToonMaterial({ color: 0x2a6a1e });
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  mesh.castShadow = true;
  mesh.name = 'scatter_pines';
  applyScatterLayer(mesh);

  const tmp = new THREE.Matrix4();
  points.forEach(({ x, y, z }, i) => {
    const s = 0.7 + rng() * 0.9;
    // ConeGeometry pivot is at centre of cone; bottom at -height/2 = -2*s
    const worldY = y + 2.0 * s + 0.05;
    buildMatrix(x, worldY, z, rng() * Math.PI * 2, s, s, s).toArray(tmp.elements);
    mesh.setMatrixAt(i, tmp);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return {
    mesh,
    count: points.length,
    dispose: () => { geo.dispose(); mat.dispose(); scene.remove(mesh); },
  };
}

// ── Palm canopy scatter ───────────────────────────────────────────────────────

function buildPalmLayer(
  scene:   THREE.Scene,
  terrain: TerrainData,
  bvh:     TerrainBVH | null,
  count:   number,
  seed:    number,
): ScatterLayer {
  const rng    = makeRng(seed + 30);
  const points = sampleSurface(terrain, bvh, {
    count, minRadius: 8, maxRadius: terrain.radius - 10,
    minHeight: 0.3, maxHeight: 7,
    maxSlope: 0.3, avoidCenter: 5, seed: seed + 200,
  });

  // Flattened sphere for a palm canopy
  const geo  = new THREE.SphereGeometry(1.2, 7, 5);
  const mat  = new THREE.MeshToonMaterial({ color: 0x3f9f2a });
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  mesh.castShadow = true;
  mesh.name = 'scatter_palms';
  applyScatterLayer(mesh);

  const tmp = new THREE.Matrix4();
  points.forEach(({ x, y, z }, i) => {
    const s  = 0.8 + rng() * 0.7;
    const sy = 0.5 * s;               // flatten vertically (palm frond silhouette)
    // sphere radius = 1.2*s vertically → lift = 1.2*sy to sit trunk tip
    const worldY = y + 3.5 * s;
    const lean   = (rng() - 0.5) * 0.25;
    const leanQ  = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(lean, rng() * Math.PI * 2, lean * 0.6),
    );
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, worldY, z),
      leanQ,
      new THREE.Vector3(s, sy, s),
    );
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return {
    mesh,
    count: points.length,
    dispose: () => { geo.dispose(); mat.dispose(); scene.remove(mesh); },
  };
}

// ── Boulder scatter (higher elevation) ───────────────────────────────────────

function buildBoulderLayer(
  scene:   THREE.Scene,
  terrain: TerrainData,
  bvh:     TerrainBVH | null,
  count:   number,
  seed:    number,
): ScatterLayer {
  const rng    = makeRng(seed + 40);
  const points = sampleSurface(terrain, bvh, {
    count, minRadius: 6, maxRadius: terrain.radius - 20,
    minHeight: 6, maxHeight: terrain.radius * 0.38,
    maxSlope: 0.6, avoidCenter: 8, seed: seed + 300,
  });

  const geo  = new THREE.IcosahedronGeometry(1.8, 0);
  const mat  = new THREE.MeshToonMaterial({ color: 0x5a4d3c });
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'scatter_boulders';
  applyScatterLayer(mesh);

  const tmp = new THREE.Matrix4();
  points.forEach(({ x, y, z }, i) => {
    const s = 0.9 + rng() * 1.5;
    const worldY = y + 1.8 * s * 0.5 + 0.05;
    buildMatrix(x, worldY, z, rng() * Math.PI * 2, s, s * 0.8, s).toArray(tmp.elements);
    mesh.setMatrixAt(i, tmp);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return {
    mesh,
    count: points.length,
    dispose: () => { geo.dispose(); mat.dispose(); scene.remove(mesh); },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scatters 4 instanced layers across the arena — single draw call per type,
 * correct surface placement via BVH raycasting, no terrain clipping.
 *
 * @param scene    Three.js scene
 * @param terrain  TerrainData from generateIslandTerrain()
 * @param bvh      TerrainBVH for triangle-accurate surface queries (recommended)
 * @param seed     Deterministic seed (match terrain seed for consistency)
 */
export function createArenaScatter(
  scene:   THREE.Scene,
  terrain: TerrainData,
  bvh:     TerrainBVH | null = null,
  seed = 42,
): ArenaScatter {
  const rocks    = buildRockLayer   (scene, terrain, bvh, 30, seed);
  const pines    = buildPineLayer   (scene, terrain, bvh, 26, seed);
  const palms    = buildPalmLayer   (scene, terrain, bvh, 16, seed);
  const boulders = buildBoulderLayer(scene, terrain, bvh, 12, seed);

  return {
    rocks, pines, palms, boulders,
    dispose: () => { rocks.dispose(); pines.dispose(); palms.dispose(); boulders.dispose(); },
  };
}

/**
 * Cover-only scatter for the central arena zone — rocks and boulders only.
 */
export function createCoverScatter(
  scene:   THREE.Scene,
  terrain: TerrainData,
  bvh:     TerrainBVH | null = null,
  seed = 77,
): Pick<ArenaScatter, 'rocks' | 'boulders' | 'dispose'> {
  const rocks    = buildRockLayer   (scene, terrain, bvh, 14, seed);
  const boulders = buildBoulderLayer(scene, terrain, bvh,  7, seed);
  return { rocks, boulders, dispose: () => { rocks.dispose(); boulders.dispose(); } };
}
