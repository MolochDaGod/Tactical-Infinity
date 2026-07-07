/**
 * Heightmap container + grid utilities for terrain v2.
 *
 * A Heightmap is a (segments+1) x (segments+1) grid of height values in
 * world units. Width/depth are the world-space size of the patch.
 */

import * as THREE from 'three';

export interface HeightmapInit {
  segments: number;     // grid cells per side (so vertices = segments+1)
  size: number;         // world-space width/depth (square)
  fill?: number;        // initial fill value, default 0
}

export class Heightmap {
  readonly segments: number;
  readonly size: number;
  readonly stride: number;       // segments + 1
  readonly data: Float32Array;

  constructor({ segments, size, fill = 0 }: HeightmapInit) {
    this.segments = segments;
    this.size = size;
    this.stride = segments + 1;
    this.data = new Float32Array(this.stride * this.stride);
    if (fill !== 0) this.data.fill(fill);
  }

  index(ix: number, iz: number): number {
    return iz * this.stride + ix;
  }

  get(ix: number, iz: number): number {
    if (ix < 0 || ix >= this.stride || iz < 0 || iz >= this.stride) return 0;
    return this.data[iz * this.stride + ix];
  }

  set(ix: number, iz: number, v: number): void {
    if (ix < 0 || ix >= this.stride || iz < 0 || iz >= this.stride) return;
    this.data[iz * this.stride + ix] = v;
  }

  add(ix: number, iz: number, v: number): void {
    if (ix < 0 || ix >= this.stride || iz < 0 || iz >= this.stride) return;
    this.data[iz * this.stride + ix] += v;
  }

  /** Bilinear sample in world space (centered around origin). */
  sampleWorld(x: number, z: number): number {
    const half = this.size * 0.5;
    const u = ((x + half) / this.size) * this.segments;
    const v = ((z + half) / this.size) * this.segments;
    const ix = Math.floor(u);
    const iz = Math.floor(v);
    const fx = u - ix;
    const fz = v - iz;
    const a = this.get(ix,     iz);
    const b = this.get(ix + 1, iz);
    const c = this.get(ix,     iz + 1);
    const d = this.get(ix + 1, iz + 1);
    return (
      a * (1 - fx) * (1 - fz) +
      b * fx * (1 - fz) +
      c * (1 - fx) * fz +
      d * fx * fz
    );
  }

  /** Per-vertex normal via central-difference, returns a unit Vector3. */
  normalAtWorld(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const eps = this.size / this.segments;
    const hL = this.sampleWorld(x - eps, z);
    const hR = this.sampleWorld(x + eps, z);
    const hD = this.sampleWorld(x, z - eps);
    const hU = this.sampleWorld(x, z + eps);
    out.set(hL - hR, 2 * eps, hD - hU).normalize();
    return out;
  }

  slopeAtWorld(x: number, z: number): number {
    const n = this.normalAtWorld(x, z, _tmpN);
    return Math.acos(Math.max(-1, Math.min(1, n.y)));
  }

  /** Compute current min/max in the heightmap. */
  bounds(): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < this.data.length; i++) {
      const v = this.data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  /** Normalize heights into [targetMin, targetMax] in place. */
  normalize(targetMin = 0, targetMax = 1): void {
    const { min, max } = this.bounds();
    const range = max - min || 1;
    const targetRange = targetMax - targetMin;
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = targetMin + ((this.data[i] - min) / range) * targetRange;
    }
  }

  clone(): Heightmap {
    const h = new Heightmap({ segments: this.segments, size: this.size });
    h.data.set(this.data);
    return h;
  }
}

const _tmpN = new THREE.Vector3();
