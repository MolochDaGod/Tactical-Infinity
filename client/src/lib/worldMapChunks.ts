/**
 * worldMapChunks.ts
 *
 * Chunked culling + 3-tier LOD for the world map.
 *
 * Why this exists:
 *   The legacy threeWorldMapManager runs frustum.containsPoint() per island
 *   every frame. With 41 islands today and the planned roster expansion,
 *   that scales linearly. This module divides the world into a 4x4 grid of
 *   chunks (16 cells of ~2250 units each over the 9000×9000 world), each
 *   chunk owning an AABB and a list of islands. We frustum-test 16 boxes
 *   instead of N points, and emit the union of islands in visible chunks.
 *
 * Also exposes a per-island LOD computation:
 *   - 'full'      → real GLB / island scene with vegetation + enemies
 *   - 'mid'       → simplified silhouette mesh (cap + base disc)
 *   - 'billboard' → camera-facing sprite with faction tint
 *
 * Pure data + math — no scene mutation. The caller decides what to render
 * for each tier. Wire-up is opt-in; legacy per-island culling continues to
 * work unchanged when this module isn't used.
 */

import * as THREE from 'three';
import { WORLD_ISLANDS } from './worldMapData';
import type { WorldIslandData, IslandSize, Faction } from './worldMapData';

// ── Grid configuration ──────────────────────────────────────────────────────
/** World extent on each axis (matches WORLD_SIZE in worldMapData). */
export const CHUNK_WORLD_EXTENT = 9000;
/** Number of chunks per side (4×4 = 16 total). */
export const CHUNK_GRID_SIZE = 4;
/** World units per chunk (~2250). */
export const CHUNK_SIZE = CHUNK_WORLD_EXTENT / CHUNK_GRID_SIZE;
/** Half-extent so chunk 0 starts at -CHUNK_WORLD_EXTENT/2. */
const HALF_EXTENT = CHUNK_WORLD_EXTENT / 2;

// ── LOD distance bands (world units) ────────────────────────────────────────
/** Below this → render as 'full'.   */ export const LOD_FULL_MAX = 1500;
/** Below this → render as 'mid'.    */ export const LOD_MID_MAX  = 3500;
/** Beyond LOD_MID_MAX → 'billboard'. Also cull beyond CULL_DISTANCE. */
export const CULL_DISTANCE = 7000;

export type LodLevel = 'full' | 'mid' | 'billboard' | 'culled';

// Capitals always promote one tier so they remain readable from far away.
const SIZE_LOD_BIAS: Record<IslandSize, number> = {
  capital: 1500,
  large:    600,
  medium:     0,
  small:   -300,
};

// ── Chunk descriptor ────────────────────────────────────────────────────────
export interface ChunkInfo {
  /** Linear chunk id (row * GRID + col). */
  id:       number;
  /** Grid column (0..GRID-1) along +X. */
  col:      number;
  /** Grid row (0..GRID-1) along +Z.    */
  row:      number;
  /** Chunk AABB in world space (y arbitrary; islands are flattish). */
  bbox:     THREE.Box3;
  /** Centre point of the chunk on the water plane. */
  center:   THREE.Vector3;
  /** Island ids whose centre lies inside this chunk. */
  islands:  string[];
}

// ── Build the grid once at module load ──────────────────────────────────────
function chunkIndexForPosition(x: number, z: number): number {
  const col = THREE.MathUtils.clamp(
    Math.floor((x + HALF_EXTENT) / CHUNK_SIZE), 0, CHUNK_GRID_SIZE - 1,
  );
  const row = THREE.MathUtils.clamp(
    Math.floor((z + HALF_EXTENT) / CHUNK_SIZE), 0, CHUNK_GRID_SIZE - 1,
  );
  return row * CHUNK_GRID_SIZE + col;
}

function buildChunks(islands: WorldIslandData[]): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];
  for (let row = 0; row < CHUNK_GRID_SIZE; row++) {
    for (let col = 0; col < CHUNK_GRID_SIZE; col++) {
      const minX = -HALF_EXTENT + col * CHUNK_SIZE;
      const minZ = -HALF_EXTENT + row * CHUNK_SIZE;
      const maxX = minX + CHUNK_SIZE;
      const maxZ = minZ + CHUNK_SIZE;
      chunks.push({
        id:      row * CHUNK_GRID_SIZE + col,
        col, row,
        bbox:    new THREE.Box3(
          new THREE.Vector3(minX, -200, minZ),
          new THREE.Vector3(maxX,  600, maxZ),
        ),
        center:  new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
        islands: [],
      });
    }
  }
  for (const island of islands) {
    const idx = chunkIndexForPosition(island.position.x, island.position.z);
    chunks[idx].islands.push(island.id);
  }
  return chunks;
}

const CHUNKS: ChunkInfo[] = buildChunks(WORLD_ISLANDS);
const ISLAND_BY_ID: Map<string, WorldIslandData> = new Map(
  WORLD_ISLANDS.map((i: WorldIslandData) => [i.id, i]),
);

// ── Public read-only accessors ──────────────────────────────────────────────
export function getAllChunks(): ReadonlyArray<ChunkInfo> { return CHUNKS; }
export function getChunkForIsland(islandId: string): ChunkInfo | null {
  const island = ISLAND_BY_ID.get(islandId);
  if (!island) return null;
  return CHUNKS[chunkIndexForPosition(island.position.x, island.position.z)] ?? null;
}

// ── Visibility queries ──────────────────────────────────────────────────────

const _projScreen = new THREE.Matrix4();
const _frustum    = new THREE.Frustum();

/** Compute the set of chunks intersecting the camera's frustum. */
export function getVisibleChunks(camera: THREE.Camera): ChunkInfo[] {
  _projScreen.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  _frustum.setFromProjectionMatrix(_projScreen);

  const visible: ChunkInfo[] = [];
  for (const c of CHUNKS) {
    if (_frustum.intersectsBox(c.bbox)) visible.push(c);
  }
  return visible;
}

/** Convenience: flat list of island ids whose chunk is visible. */
export function getVisibleIslandIds(camera: THREE.Camera): string[] {
  const ids: string[] = [];
  for (const chunk of getVisibleChunks(camera)) {
    for (const id of chunk.islands) ids.push(id);
  }
  return ids;
}

/**
 * LOD selection for a single island given camera world position.
 * Returns 'culled' for islands beyond CULL_DISTANCE that are NOT capitals.
 */
export function getLodLevel(islandId: string, cameraPos: THREE.Vector3): LodLevel {
  const island = ISLAND_BY_ID.get(islandId);
  if (!island) return 'culled';

  const dx = island.position.x - cameraPos.x;
  const dz = island.position.z - cameraPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Apply size-based bias so capitals/large stay visible at higher tiers.
  const bias = SIZE_LOD_BIAS[island.size] ?? 0;
  const biasedDist = Math.max(0, dist - bias);

  if (biasedDist < LOD_FULL_MAX) return 'full';
  if (biasedDist < LOD_MID_MAX)  return 'mid';
  if (dist < CULL_DISTANCE || island.size === 'capital') return 'billboard';
  return 'culled';
}

/**
 * Bulk LOD computation for every visible island. Returns a Map keyed by id.
 * Designed to be called once per frame (or every N frames).
 */
export function computeFrameLods(camera: THREE.Camera): Map<string, LodLevel> {
  const cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);

  const result = new Map<string, LodLevel>();
  for (const chunk of getVisibleChunks(camera)) {
    for (const id of chunk.islands) {
      result.set(id, getLodLevel(id, cameraPos));
    }
  }
  return result;
}

// ── Per-faction queries (useful for the territory overlay) ──────────────────

export function getIslandsByFaction(faction: Faction): WorldIslandData[] {
  return WORLD_ISLANDS.filter((i: WorldIslandData) => i.faction === faction);
}

export function getCapitalIsland(faction: Faction): WorldIslandData | null {
  const list = getIslandsByFaction(faction);
  return list.find(i => i.size === 'capital') ?? list[0] ?? null;
}

// ── Debug helpers ───────────────────────────────────────────────────────────

/**
 * Build a wireframe BoxHelper-style mesh for every chunk, with the chunk id
 * encoded in userData. Intended for the dev/admin overlay only.
 */
export function buildChunkDebugMesh(): THREE.LineSegments {
  const positions: number[] = [];
  for (const c of CHUNKS) {
    const { min, max } = c.bbox;
    const y = 5; // hover above water plane for visibility
    // 4 horizontal lines forming a square at y=5
    const x0 = min.x, x1 = max.x, z0 = min.z, z1 = max.z;
    positions.push(
      x0, y, z0,  x1, y, z0,
      x1, y, z0,  x1, y, z1,
      x1, y, z1,  x0, y, z1,
      x0, y, z1,  x0, y, z0,
    );
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat  = new THREE.LineBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.35 });
  const mesh = new THREE.LineSegments(geom, mat);
  mesh.name = 'WorldMapChunks_Debug';
  mesh.renderOrder = 999;
  return mesh;
}
