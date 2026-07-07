/**
 * terrainBVH.ts
 * Builds a MeshBVH on the island terrain geometry for fast, accurate raycasting.
 * Replaces the grid-sample approach with actual triangle intersection — important
 * for terraced/ridged terrain where the heightmap grid can skip narrow ledges.
 *
 * Depends on: three-mesh-bvh (already installed)
 */

import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { TerrainData } from './islandHeightmapTerrain';

// ── Patch Three.js Mesh with accelerated raycast once at module load ──────────
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TerrainBVH {
  /** The underlying MeshBVH instance. */
  bvh: MeshBVH;
  /**
   * Returns the exact surface height (Y) at world position (x, z).
   * Falls back to the grid-sampled value from TerrainData if the ray misses.
   */
  getHeightAt(x: number, z: number): number;
  /** Returns the surface normal at world position (x, z). */
  getNormalAt(x: number, z: number): THREE.Vector3;
  /**
   * Fires a ray against the terrain and returns the first intersection,
   * or null if the ray misses.
   */
  intersectRay(origin: THREE.Vector3, direction: THREE.Vector3): THREE.Intersection | null;
  /** Free BVH memory — call when the terrain scene is torn down. */
  dispose(): void;
}

// ── Shared raycaster (reused every query to avoid GC pressure) ────────────────

const _raycaster = new THREE.Raycaster();
(_raycaster as any).firstHitOnly = true;
const DOWN = new THREE.Vector3(0, -1, 0);
const _hits: THREE.Intersection[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// buildTerrainBVH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a BVH for the terrain mesh geometry and returns a TerrainBVH
 * helper with fast height/normal query methods.
 *
 * @param terrain   TerrainData returned by generateIslandTerrain()
 * @param fallback  The original terrain's getHeightAt, used when the ray misses
 */
export function buildTerrainBVH(terrain: TerrainData): TerrainBVH {
  const geometry = terrain.mesh.geometry;

  // computeBoundsTree adds geometry.boundsTree = new MeshBVH(geometry)
  (geometry as any).computeBoundsTree = computeBoundsTree;
  (geometry as any).disposeBoundsTree = disposeBoundsTree;
  (geometry as any).computeBoundsTree();

  const bvh: MeshBVH = (geometry as any).boundsTree;

  // We raycast against the actual terrain mesh (already in scene, matrix is identity)
  const castTarget = terrain.mesh;

  function getHeightAt(x: number, z: number): number {
    _raycaster.set(new THREE.Vector3(x, 300, z), DOWN);
    _hits.length = 0;
    castTarget.raycast(_raycaster, _hits);
    if (_hits.length > 0) return _hits[0].point.y;
    // Fallback to heightmap grid sampling
    return terrain.getHeightAt(x, z);
  }

  function getNormalAt(x: number, z: number): THREE.Vector3 {
    _raycaster.set(new THREE.Vector3(x, 300, z), DOWN);
    _hits.length = 0;
    castTarget.raycast(_raycaster, _hits);
    if (_hits.length > 0 && _hits[0].face) {
      const n = _hits[0].face.normal.clone();
      // Transform normal from local to world space
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(castTarget.matrixWorld);
      n.applyMatrix3(normalMatrix).normalize();
      return n;
    }
    return terrain.getNormalAt(x, z);
  }

  function intersectRay(origin: THREE.Vector3, direction: THREE.Vector3): THREE.Intersection | null {
    _raycaster.set(origin, direction);
    _hits.length = 0;
    castTarget.raycast(_raycaster, _hits);
    return _hits.length > 0 ? _hits[0] : null;
  }

  function dispose(): void {
    if ((geometry as any).disposeBoundsTree) (geometry as any).disposeBoundsTree();
  }

  return { bvh, getHeightAt, getNormalAt, intersectRay, dispose };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: snap any world (x, z) onto the BVH-queried terrain surface
// ─────────────────────────────────────────────────────────────────────────────

export function bvhSnapY(
  bvh: TerrainBVH,
  x: number,
  z: number,
  yOffset = 0,
): number {
  return bvh.getHeightAt(x, z) + yOffset;
}
