/**
 * Heightmap generation algorithms — fresh implementations inspired by
 * THREE.Terrain (MIT, IceCreamYou) and standard procedural-terrain papers.
 *
 *   - DiamondSquare    : classic plasma fractal, great for varied terrain
 *   - Hill             : additive radial hill stamping, great for islands
 *   - LayeredPerlin    : multi-octave fBm
 *   - Ridged           : 1 - |perlin|, good for mountain spines
 *   - smoothHeightmap  : separable gaussian blur
 *   - clampIslandEdges : radial falloff so the patch reads as an island
 */

import { Heightmap } from './heightmap';

// ───────────────────────────────────────────────────────────────────────────
// Seeded RNG — Mulberry32
// ───────────────────────────────────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Diamond-Square plasma fractal
//
// Requires a power-of-two grid. We pad/clip to a 2^n + 1 grid internally
// then resample into the target heightmap.
// ───────────────────────────────────────────────────────────────────────────

export interface DiamondSquareOpts {
  seed?: number;
  roughness?: number;       // 0..1, higher = more jaggedness, default 0.6
  amplitude?: number;       // height range, default 1
  cornerSeedRange?: number; // initial corner randomness, default 0.5
}

export function diamondSquare(target: Heightmap, opts: DiamondSquareOpts = {}): void {
  const {
    seed = 1234,
    roughness = 0.6,
    amplitude = 1,
    cornerSeedRange = 0.5,
  } = opts;

  // Find next power-of-two segment count >= target.segments
  let pow2 = 1;
  while (pow2 < target.segments) pow2 *= 2;
  const stride = pow2 + 1;

  const rng = mulberry32(seed);
  const grid = new Float32Array(stride * stride);
  const idx = (x: number, y: number) => y * stride + x;

  // Seed corners
  grid[idx(0, 0)]               = (rng() * 2 - 1) * cornerSeedRange;
  grid[idx(pow2, 0)]            = (rng() * 2 - 1) * cornerSeedRange;
  grid[idx(0, pow2)]            = (rng() * 2 - 1) * cornerSeedRange;
  grid[idx(pow2, pow2)]         = (rng() * 2 - 1) * cornerSeedRange;

  let step = pow2;
  let range = 1;
  while (step > 1) {
    const half = step >> 1;

    // Diamond step
    for (let y = half; y < pow2; y += step) {
      for (let x = half; x < pow2; x += step) {
        const avg = 0.25 * (
          grid[idx(x - half, y - half)] +
          grid[idx(x + half, y - half)] +
          grid[idx(x - half, y + half)] +
          grid[idx(x + half, y + half)]
        );
        grid[idx(x, y)] = avg + (rng() * 2 - 1) * range;
      }
    }

    // Square step
    for (let y = 0; y <= pow2; y += half) {
      const xStart = (Math.floor(y / half) % 2 === 0) ? half : 0;
      for (let x = xStart; x <= pow2; x += step) {
        let sum = 0, count = 0;
        if (x - half >= 0)    { sum += grid[idx(x - half, y)]; count++; }
        if (x + half <= pow2) { sum += grid[idx(x + half, y)]; count++; }
        if (y - half >= 0)    { sum += grid[idx(x, y - half)]; count++; }
        if (y + half <= pow2) { sum += grid[idx(x, y + half)]; count++; }
        grid[idx(x, y)] = (sum / count) + (rng() * 2 - 1) * range;
      }
    }

    step = half;
    range *= roughness;
  }

  // Resample power-of-two grid into target heightmap (bilinear)
  const tStride = target.stride;
  for (let ty = 0; ty < tStride; ty++) {
    const sy = (ty / (tStride - 1)) * pow2;
    const iy = Math.floor(sy);
    const fy = sy - iy;
    for (let tx = 0; tx < tStride; tx++) {
      const sx = (tx / (tStride - 1)) * pow2;
      const ix = Math.floor(sx);
      const fx = sx - ix;
      const ix1 = Math.min(ix + 1, pow2);
      const iy1 = Math.min(iy + 1, pow2);
      const a = grid[idx(ix,  iy )];
      const b = grid[idx(ix1, iy )];
      const c = grid[idx(ix,  iy1)];
      const d = grid[idx(ix1, iy1)];
      const v =
        a * (1 - fx) * (1 - fy) +
        b * fx       * (1 - fy) +
        c * (1 - fx) * fy +
        d * fx       * fy;
      target.data[ty * tStride + tx] += v * amplitude;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Hill — additive radial hill stamping. Each hill is a smooth bump.
// ───────────────────────────────────────────────────────────────────────────

export interface HillOpts {
  seed?: number;
  count?: number;
  minRadius?: number;         // fraction of size, default 0.05
  maxRadius?: number;         // fraction of size, default 0.18
  amplitude?: number;
  /** If true, weights placement toward the center (good for islands). */
  centerBias?: number;        // 0 = uniform, 1 = strongly centered
}

export function hill(target: Heightmap, opts: HillOpts = {}): void {
  const {
    seed = 4321,
    count = 80,
    minRadius = 0.05,
    maxRadius = 0.18,
    amplitude = 1,
    centerBias = 0.55,
  } = opts;

  const rng = mulberry32(seed);
  const half = target.size * 0.5;
  const cellSize = target.size / target.segments;

  for (let h = 0; h < count; h++) {
    // Centered placement: re-roll toward the middle for centerBias
    let nx = rng() * 2 - 1;
    let nz = rng() * 2 - 1;
    if (centerBias > 0) {
      const pull = 1 - centerBias;
      nx = Math.sign(nx) * Math.pow(Math.abs(nx), 1 + centerBias * 2);
      nz = Math.sign(nz) * Math.pow(Math.abs(nz), 1 + centerBias * 2);
      nx *= pull + centerBias * 0.85;
      nz *= pull + centerBias * 0.85;
    }
    const cx = nx * half;
    const cz = nz * half;

    const r = (minRadius + rng() * (maxRadius - minRadius)) * target.size;
    const peak = (0.5 + rng() * 0.5) * amplitude;

    const ixMin = Math.max(0, Math.floor((cx - r + half) / cellSize));
    const ixMax = Math.min(target.stride - 1, Math.ceil((cx + r + half) / cellSize));
    const izMin = Math.max(0, Math.floor((cz - r + half) / cellSize));
    const izMax = Math.min(target.stride - 1, Math.ceil((cz + r + half) / cellSize));
    const r2 = r * r;

    for (let iz = izMin; iz <= izMax; iz++) {
      const wz = -half + iz * cellSize;
      const dz = wz - cz;
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const wx = -half + ix * cellSize;
        const dx = wx - cx;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r2) continue;
        const t = 1 - d2 / r2;
        // Smooth cosine bump (Hann window)
        const bump = 0.5 - 0.5 * Math.cos(Math.PI * t);
        target.data[iz * target.stride + ix] += peak * bump;
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Layered Perlin (fBm)
// ───────────────────────────────────────────────────────────────────────────

class _Perlin {
  private perm = new Uint8Array(512);
  constructor(seed: number) {
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  private grad(h: number, x: number, y: number) {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
  }
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const A = this.perm[X] + Y, B = this.perm[X + 1] + Y;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return lerp(
      lerp(this.grad(this.perm[A    ], xf,     yf    ),
           this.grad(this.perm[B    ], xf - 1, yf    ), u),
      lerp(this.grad(this.perm[A + 1], xf,     yf - 1),
           this.grad(this.perm[B + 1], xf - 1, yf - 1), u),
      v,
    ) * 0.7;
  }
}

export interface LayeredPerlinOpts {
  seed?: number;
  octaves?: number;
  frequency?: number;     // base frequency (cycles per heightmap)
  lacunarity?: number;
  persistence?: number;
  amplitude?: number;
  domainWarp?: number;    // 0 disables; small values (~1-3) give organic flow
}

export function layeredPerlin(target: Heightmap, opts: LayeredPerlinOpts = {}): void {
  const {
    seed = 9876,
    octaves = 5,
    frequency = 2.5,
    lacunarity = 2.0,
    persistence = 0.5,
    amplitude = 1,
    domainWarp = 1.5,
  } = opts;

  const noise = new _Perlin(seed);
  const warp = domainWarp > 0 ? new _Perlin(seed ^ 0x9e3779b9) : null;
  const seg = target.segments;

  for (let iz = 0; iz < target.stride; iz++) {
    const v = iz / seg;
    for (let ix = 0; ix < target.stride; ix++) {
      const u = ix / seg;
      let x = u * frequency;
      let y = v * frequency;

      if (warp) {
        x += warp.noise(u * 1.3, v * 1.3) * domainWarp;
        y += warp.noise(u * 1.3 + 5.2, v * 1.3 + 1.3) * domainWarp;
      }

      let val = 0, amp = 1, freq = 1, total = 0;
      for (let o = 0; o < octaves; o++) {
        val += noise.noise(x * freq, y * freq) * amp;
        total += amp;
        freq *= lacunarity;
        amp *= persistence;
      }
      target.data[iz * target.stride + ix] += (val / total) * amplitude;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Ridged noise — emphasizes mountain spines
// ───────────────────────────────────────────────────────────────────────────

export interface RidgedOpts extends LayeredPerlinOpts {
  sharpness?: number; // exponent on (1-|n|), default 2
}

export function ridged(target: Heightmap, opts: RidgedOpts = {}): void {
  const {
    seed = 5555,
    octaves = 4,
    frequency = 2.0,
    lacunarity = 2.0,
    persistence = 0.55,
    amplitude = 1,
    sharpness = 2,
  } = opts;

  const noise = new _Perlin(seed);
  const seg = target.segments;
  for (let iz = 0; iz < target.stride; iz++) {
    const v = iz / seg;
    for (let ix = 0; ix < target.stride; ix++) {
      const u = ix / seg;
      let val = 0, amp = 1, freq = 1, total = 0;
      for (let o = 0; o < octaves; o++) {
        const n = Math.abs(noise.noise(u * frequency * freq, v * frequency * freq));
        val += Math.pow(1 - n, sharpness) * amp;
        total += amp;
        freq *= lacunarity;
        amp *= persistence;
      }
      target.data[iz * target.stride + ix] += (val / total - 0.5) * amplitude;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gaussian smoothing (separable)
// ───────────────────────────────────────────────────────────────────────────

export function smoothHeightmap(target: Heightmap, radius = 1, iterations = 1): void {
  const r = Math.max(1, Math.floor(radius));
  // Build 1D gaussian kernel
  const kernel: number[] = [];
  let sum = 0;
  const sigma = r;
  for (let i = -r; i <= r; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(w);
    sum += w;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const stride = target.stride;
  const tmp = new Float32Array(target.data.length);

  for (let it = 0; it < iterations; it++) {
    // Horizontal pass
    for (let y = 0; y < stride; y++) {
      for (let x = 0; x < stride; x++) {
        let v = 0;
        for (let k = -r; k <= r; k++) {
          const sx = Math.min(stride - 1, Math.max(0, x + k));
          v += target.data[y * stride + sx] * kernel[k + r];
        }
        tmp[y * stride + x] = v;
      }
    }
    // Vertical pass
    for (let y = 0; y < stride; y++) {
      for (let x = 0; x < stride; x++) {
        let v = 0;
        for (let k = -r; k <= r; k++) {
          const sy = Math.min(stride - 1, Math.max(0, y + k));
          v += tmp[sy * stride + x] * kernel[k + r];
        }
        target.data[y * stride + x] = v;
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Edge clamping — radial falloff toward water level
// ───────────────────────────────────────────────────────────────────────────

export interface ClampEdgesOpts {
  shape?: 'radial' | 'square';
  /** Fraction of half-size where the falloff begins. 0..1, default 0.55 */
  innerFraction?: number;
  /** Fraction of half-size where height reaches `targetHeight`. default 1 */
  outerFraction?: number;
  /** Height value at the outer edge, default 0 (sea level) */
  targetHeight?: number;
  /** Easing exponent, default 2 (quadratic) */
  exponent?: number;
}

export function clampIslandEdges(target: Heightmap, opts: ClampEdgesOpts = {}): void {
  const {
    shape = 'radial',
    innerFraction = 0.55,
    outerFraction = 1.0,
    targetHeight = 0,
    exponent = 2,
  } = opts;

  const half = target.size * 0.5;
  const cellSize = target.size / target.segments;
  const innerR = innerFraction * half;
  const outerR = outerFraction * half;
  const range = Math.max(0.0001, outerR - innerR);

  for (let iz = 0; iz < target.stride; iz++) {
    const wz = -half + iz * cellSize;
    for (let ix = 0; ix < target.stride; ix++) {
      const wx = -half + ix * cellSize;
      let d: number;
      if (shape === 'radial') {
        d = Math.sqrt(wx * wx + wz * wz);
      } else {
        d = Math.max(Math.abs(wx), Math.abs(wz));
      }
      if (d <= innerR) continue;
      const t = Math.min(1, (d - innerR) / range);
      const factor = Math.pow(1 - t, exponent);
      const i = iz * target.stride + ix;
      target.data[i] = targetHeight + (target.data[i] - targetHeight) * factor;
    }
  }
}
