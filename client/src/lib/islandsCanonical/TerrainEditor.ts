/**
 * TerrainEditor — interactive "shovel" brush for the canonical island.
 *
 * Edits the shared `IslandHeightmap.data` Float32Array in place, then rebuilds
 * only the chunk geometries that overlap the brush footprint. Each rebuilt
 * chunk has its vertex Y values re-sampled from the heightmap, its normals and
 * bounds recomputed, and its BVH detached + reattached so subsequent raycasts
 * (mouse-picking, the brush itself, AI line-of-sight) stay accurate.
 *
 * Coordinate model mirrors IslandHeightmap / IslandChunks exactly:
 *   • grid index  : gx = (worldX + half) / worldSize * size  (0 … size)
 *   • data index  : gy * resolution + gx   (resolution = size + 1)
 *   • chunk owns grid range [ci*vertsPerChunk … ci*vertsPerChunk+vertsPerChunk]
 *
 * See `lib/terrain/RULES.md` §3 — every terrain mesh must carry a BVH; we
 * uphold that by reattaching after every edit.
 */
import * as THREE from 'three';
import type { IslandHeightmap } from './IslandHeightmap';
import type { IslandChunkSet, IslandChunk } from './IslandChunks';
import { attachBVH, detachBVH } from '../terrain/raycast';

export type BrushMode = 'raise' | 'lower' | 'level' | 'smooth';

export interface BrushOptions {
  /** Brush radius in world metres. */
  radius: number;
  /** Strength in metres-per-application at the brush centre. */
  strength: number;
  /** Editing mode. */
  mode: BrushMode;
}

export class TerrainEditor {
  private hm: IslandHeightmap;
  private chunkSet: IslandChunkSet;
  private size: number;
  private res: number;
  private world: number;
  private half: number;
  private N: number;
  private vertsPerChunk: number;
  private minH: number;
  private maxH: number;

  constructor(hm: IslandHeightmap, chunkSet: IslandChunkSet) {
    this.hm = hm;
    this.chunkSet = chunkSet;
    this.size = hm.options.size;
    this.res = hm.resolution;
    this.world = hm.worldSize;
    this.half = hm.worldSize / 2;
    this.N = Math.max(1, Math.round(hm.worldSize / chunkSet.chunkSize));
    this.vertsPerChunk = Math.floor(this.size / this.N);
    // Allow digging a little below sea level, raising up past the natural peak.
    this.minH = -Math.max(8, hm.options.maxHeight * 0.3);
    this.maxH = hm.options.maxHeight * 1.4;
  }

  /** World X → fractional grid X. */
  private gridX(worldX: number): number {
    return ((worldX + this.half) / this.world) * this.size;
  }
  private gridZ(worldZ: number): number {
    return ((worldZ + this.half) / this.world) * this.size;
  }

  /**
   * Apply the brush centred on a world-space point. Returns the set of chunks
   * that were modified (already rebuilt) so callers can react if needed.
   */
  applyAt(worldX: number, worldZ: number, opts: BrushOptions): IslandChunk[] {
    const data = this.hm.data;
    const radiusGrid = (opts.radius / this.world) * this.size;
    const cgx = this.gridX(worldX);
    const cgz = this.gridZ(worldZ);

    const gx0 = Math.max(0, Math.floor(cgx - radiusGrid));
    const gx1 = Math.min(this.size, Math.ceil(cgx + radiusGrid));
    const gy0 = Math.max(0, Math.floor(cgz - radiusGrid));
    const gy1 = Math.min(this.size, Math.ceil(cgz + radiusGrid));
    if (gx0 > gx1 || gy0 > gy1) return [];

    // For "level" we flatten toward the height at the brush centre.
    const targetH = opts.mode === 'level' ? this.hm.getHeightAt(worldX, worldZ) : 0;
    const invR = radiusGrid > 0 ? 1 / radiusGrid : 0;

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const dx = gx - cgx;
        const dy = gy - cgz;
        const dist = Math.hypot(dx, dy) * invR;
        if (dist > 1) continue;
        // Smoothstep falloff — soft edge so brush strokes blend.
        const t = 1 - dist;
        const fall = t * t * (3 - 2 * t);
        const idx = gy * this.res + gx;
        const cur = data[idx];
        let next = cur;
        switch (opts.mode) {
          case 'raise': next = cur + opts.strength * fall; break;
          case 'lower': next = cur - opts.strength * fall; break;
          case 'level': next = cur + (targetH - cur) * fall * 0.5; break;
          case 'smooth': {
            // Average of 4-neighbourhood, blended by falloff.
            const l = data[idx - 1] ?? cur;
            const r = data[idx + 1] ?? cur;
            const u = data[idx - this.res] ?? cur;
            const d = data[idx + this.res] ?? cur;
            const avg = (l + r + u + d) * 0.25;
            next = cur + (avg - cur) * fall;
            break;
          }
        }
        data[idx] = Math.max(this.minH, Math.min(this.maxH, next));
      }
    }

    // Determine which chunks overlap [gx0..gx1, gy0..gy1] and rebuild them.
    const ci0 = Math.max(0, Math.floor(gx0 / this.vertsPerChunk));
    const ci1 = Math.min(this.N - 1, Math.floor(gx1 / this.vertsPerChunk));
    const cj0 = Math.max(0, Math.floor(gy0 / this.vertsPerChunk));
    const cj1 = Math.min(this.N - 1, Math.floor(gy1 / this.vertsPerChunk));

    const touched: IslandChunk[] = [];
    for (const c of this.chunkSet.chunks) {
      if (c.ix >= ci0 && c.ix <= ci1 && c.iy >= cj0 && c.iy <= cj1) {
        this.rebuildChunk(c);
        touched.push(c);
      }
    }
    return touched;
  }

  /** Re-sample a chunk's vertex Y values from the (edited) heightmap. */
  private rebuildChunk(c: IslandChunk) {
    const geom = c.mesh.geometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const r = this.vertsPerChunk + 1;
    const startX = c.ix * this.vertsPerChunk;
    const startY = c.iy * this.vertsPerChunk;
    const arr = pos.array as Float32Array;

    for (let y = 0; y < r; y++) {
      for (let x = 0; x < r; x++) {
        const gx = startX + x;
        const gy = startY + y;
        const igx = gx > this.size ? this.size : gx;
        const igy = gy > this.size ? this.size : gy;
        const raw = this.hm.data[igy * this.res + igx];
        const h = Number.isFinite(raw) ? raw : 0;
        arr[(y * r + x) * 3 + 1] = h;
      }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    // Rebuild the BVH so raycasts hit the new surface (RULES.md §3).
    detachBVH(c.mesh);
    attachBVH(c.mesh, { strategy: 'SAH' });

    // Keep the chunk's cached world bbox in sync for LOD/culling.
    c.bbox.setFromObject(c.mesh);

    // Far-LOD billboards become stale after an edit; hide them so the player
    // always sees the real edited geometry near the brush.
    if (c.billboard) c.billboard.visible = false;
  }
}
