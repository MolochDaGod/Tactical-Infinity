/**
 * IslandChunks — split a single high-resolution heightmap into a grid of
 * independent BufferGeometry chunks so the renderer can:
 *
 *   • frustum-cull individual tiles (Three does this per-Mesh);
 *   • upload the whole island once and render only what's visible;
 *   • later swap out per-chunk LOD without rebuilding the whole island.
 *
 * Each chunk shares the same Material instance — you make the Material once,
 * pass it in, and every chunk gets the same shader uniforms (sun, time,
 * weather, fog). This is the bake step the user keeps asking for.
 */

import * as THREE from 'three';
import type { IslandHeightmap } from './IslandHeightmap';
import { attachBVH, detachBVH } from '../terrain/raycast';

export interface IslandChunkOptions {
  /** Number of chunks per side (so total chunks = chunksPerSide ^ 2). */
  chunksPerSide: number;
  /** Material applied to every chunk. */
  material: THREE.Material;
  /** Whether to compute per-vertex normals (slow, but smooth shading). */
  computeNormals: boolean;
  /** If true, also build a low-res billboard mesh (1 quad per chunk) for very-far LOD. */
  buildBillboard: boolean;
}

export interface IslandChunk {
  /** Chunk index. */
  ix: number;
  iy: number;
  /** Mesh, parented to the chunk group. */
  mesh: THREE.Mesh;
  /** Optional far-LOD billboard, hidden by default. */
  billboard?: THREE.Mesh;
  /** World-space bounding box. */
  bbox: THREE.Box3;
}

export interface IslandChunkSet {
  group: THREE.Group;
  chunks: IslandChunk[];
  /** Side length of one chunk in world metres. */
  chunkSize: number;
  /** Refresh per-chunk LOD by camera distance. Call once per frame. */
  updateLOD(cameraPos: THREE.Vector3): void;
  dispose(): void;
}

export function buildIslandChunks(
  hm: IslandHeightmap,
  options: Partial<IslandChunkOptions> = {},
): IslandChunkSet {
  const opts: IslandChunkOptions = {
    chunksPerSide: 4,
    material: new THREE.MeshStandardMaterial({ color: 0x6e8a3a, roughness: 0.92 }),
    computeNormals: true,
    buildBillboard: true,
    ...options,
  };

  const N = opts.chunksPerSide;
  const half = hm.worldSize / 2;
  const chunkSize = hm.worldSize / N;
  const vertsPerSide = hm.options.size; // segments per island
  const vertsPerChunk = Math.floor(vertsPerSide / N); // segments per chunk side

  const group = new THREE.Group();
  group.name = 'IslandChunks';
  const chunks: IslandChunk[] = [];

  for (let cy = 0; cy < N; cy++) {
    for (let cx = 0; cx < N; cx++) {
      const geom = buildChunkGeometry(hm, cx, cy, vertsPerChunk, chunkSize, opts.computeNormals);
      const mesh = new THREE.Mesh(geom, opts.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(-half + (cx + 0.5) * chunkSize, 0, -half + (cy + 0.5) * chunkSize);
      mesh.name = `chunk_${cx}_${cy}`;
      mesh.frustumCulled = true;
      // BVH-accelerated raycasts — every chunk geometry is static after build.
      // See `lib/terrain/RULES.md` rule §3.
      attachBVH(mesh, { strategy: 'SAH' });
      group.add(mesh);

      let billboard: THREE.Mesh | undefined;
      if (opts.buildBillboard) {
        billboard = buildChunkBillboard(hm, cx, cy, vertsPerChunk, chunkSize, opts.material);
        billboard.position.copy(mesh.position);
        billboard.visible = false;
        billboard.name = `chunk_${cx}_${cy}_billboard`;
        group.add(billboard);
      }

      const bbox = new THREE.Box3().setFromObject(mesh);
      chunks.push({ ix: cx, iy: cy, mesh, billboard, bbox });
    }
  }

  function updateLOD(cameraPos: THREE.Vector3) {
    // Simple 2-level LOD: full mesh inside `nearRange`, billboard outside.
    const nearRange = chunkSize * 4;
    for (const c of chunks) {
      const cx = c.mesh.position.x, cz = c.mesh.position.z;
      const d = Math.hypot(cameraPos.x - cx, cameraPos.z - cz);
      const useFull = d < nearRange || !c.billboard;
      c.mesh.visible = useFull;
      if (c.billboard) c.billboard.visible = !useFull;
    }
  }

  function dispose() {
    for (const c of chunks) {
      // Free the BVH typed arrays before dropping the geometry.
      detachBVH(c.mesh);
      c.mesh.geometry.dispose();
      if (c.billboard) c.billboard.geometry.dispose();
    }
  }

  return { group, chunks, chunkSize, updateLOD, dispose };
}

// ── Internal builders ──────────────────────────────────────────────────────

function buildChunkGeometry(
  hm: IslandHeightmap,
  cx: number,
  cy: number,
  vertsPerChunk: number,
  chunkSize: number,
  computeNormals: boolean,
): THREE.BufferGeometry {
  // The chunk's vertex grid is (vertsPerChunk + 1)^2 — we stitch by sharing
  // edge vertices across chunks (we re-sample them, the heightmap is shared).
  const r = vertsPerChunk + 1;
  const positions = new Float32Array(r * r * 3);
  const uvs       = new Float32Array(r * r * 2);
  const indices: number[] = [];

  const startX = cx * vertsPerChunk;
  const startY = cy * vertsPerChunk;
  const half = hm.worldSize / 2;
  const cellWorld = hm.worldSize / hm.options.size;

  for (let y = 0; y < r; y++) {
    for (let x = 0; x < r; x++) {
      const gx = startX + x;
      const gy = startY + y;
      // Clamp grid index — chunksPerSide need not divide hm.options.size
      // exactly; falling off the right/bottom edge would otherwise read NaN.
      const igx = gx > hm.options.size ? hm.options.size : gx;
      const igy = gy > hm.options.size ? hm.options.size : gy;
      const raw = hm.data[igy * hm.resolution + igx];
      // Hard guard: if any upstream pass produced a non-finite value (it
      // shouldn't, but cheap insurance) use 0. NaN here would poison
      // computeBoundingSphere and silently break frustum culling for the
      // entire chunk set.
      const h  = Number.isFinite(raw) ? raw : 0;
      // Local space — chunk meshes are positioned at chunk centre.
      const lx = (x - vertsPerChunk * 0.5) * cellWorld;
      const lz = (y - vertsPerChunk * 0.5) * cellWorld;
      const i = (y * r + x) * 3;
      positions[i + 0] = lx;
      positions[i + 1] = h;
      positions[i + 2] = lz;
      const ui = (y * r + x) * 2;
      uvs[ui + 0] = (gx) / hm.options.size;
      uvs[ui + 1] = (gy) / hm.options.size;
    }
  }

  for (let y = 0; y < vertsPerChunk; y++) {
    for (let x = 0; x < vertsPerChunk; x++) {
      const a = y * r + x;
      const b = y * r + x + 1;
      const c = (y + 1) * r + x;
      const d = (y + 1) * r + x + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  if (computeNormals) geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  void half; void chunkSize;
  return geom;
}

function buildChunkBillboard(
  hm: IslandHeightmap,
  cx: number,
  cy: number,
  vertsPerChunk: number,
  chunkSize: number,
  material: THREE.Material,
): THREE.Mesh {
  // Billboard is a single quad whose Y is the chunk's average height — cheap
  // far-LOD stand-in. Used only at distance, so the silhouette mismatch is OK.
  let sum = 0, n = 0;
  const startX = cx * vertsPerChunk, startY = cy * vertsPerChunk;
  for (let y = 0; y <= vertsPerChunk; y++) {
    for (let x = 0; x <= vertsPerChunk; x++) {
      const igx = Math.min(startX + x, hm.options.size);
      const igy = Math.min(startY + y, hm.options.size);
      const v = hm.data[igy * hm.resolution + igx];
      if (Number.isFinite(v)) { sum += v; n++; }
    }
  }
  const avg = n > 0 ? sum / n : 0;
  const geom = new THREE.PlaneGeometry(chunkSize, chunkSize, 1, 1);
  geom.rotateX(-Math.PI / 2);
  // Translate up by avg so it visually overlaps the high-res mesh's mean.
  geom.translate(0, avg, 0);
  return new THREE.Mesh(geom, material);
}
