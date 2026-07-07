import * as THREE from 'three';
import { createToonOceanPlane, updateToonWater } from './toonWaterShader';
import { enhanceWithGrassShader } from './grassTerrainMaterial';
import {
  generateIslandTerrainV2,
  type IslandBiomeV2,
  type DockSide,
  type Influence as TerrainV2Influence,
} from './terrainV2';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TerrainConfig {
  radius: number;
  segments: number;
  maxHeight: number;
  noiseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  seed: number;
  beachWidth: number;
  waterLevel: number;
  // New
  ridgeStrength: number;
  domainWarpStrength: number;
  terraceCount: number;
  terraceStrength: number;
  // ── Circular bathymetry (units = "feet", same scale as maxHeight) ──
  /** Max seafloor depth, in feet. Negative number. Default -20. */
  seafloorDepth: number;
  /** Width of the descending shelf past shoreline, in WORLD units.
   *  Anything farther sits at seafloorDepth (with mild noise).
   *  Default = radius * 0.45 (computed at generation time if undefined). */
  bathymetryWidth?: number;
  // ── Terrain v2 (THREE.Terrain-inspired) opt-in ──
  /** When true, replaces the v1 noise loop with the terrainV2 generator. */
  useTerrainV2?: boolean;
  /** Required when useTerrainV2 is true. */
  biomeV2?: IslandBiomeV2;
  /** Optional dock pad carved by v2 directly into the heightmap. */
  dockSide?: DockSide;
  /** Optional v2 influences (calderas, peaks, lakes, flat pads). */
  influencesV2?: TerrainV2Influence[];
}

export interface TerrainData {
  mesh: THREE.Mesh;
  heightMap: Float32Array;
  segments: number;
  radius: number;
  getHeightAt: (x: number, z: number) => number;
  getNormalAt: (x: number, z: number) => THREE.Vector3;
  getSlopeAt: (x: number, z: number) => number;
}

export const DEFAULT_CONFIG: TerrainConfig = {
  radius: 200,
  segments: 192,
  maxHeight: 38,
  noiseScale: 0.014,
  octaves: 6,
  persistence: 0.48,
  lacunarity: 2.1,
  seed: Math.random() * 10000,
  beachWidth: 18,
  waterLevel: 0,
  ridgeStrength: 0.45,
  domainWarpStrength: 0.55,
  terraceCount: 5,
  terraceStrength: 0.35,
  seafloorDepth: -20,
};

// ─────────────────────────────────────────────────────────────────────────────
// Perlin noise (improved gradient table)
// ─────────────────────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0);
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0);
    s = s ^ (s >>> 16);
    return (s >>> 0) / 0x100000000;
  };
}

const GRAD2 = [
  [ 1,  1], [-1,  1], [ 1, -1], [-1, -1],
  [ 1,  0], [-1,  0], [ 0,  1], [ 0, -1],
  [ 0.7071,  0.7071], [-0.7071,  0.7071],
  [ 0.7071, -0.7071], [-0.7071, -0.7071],
  [ 0.9239,  0.3827], [-0.9239,  0.3827],
  [ 0.9239, -0.3827], [-0.9239, -0.3827],
];

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

class PerlinNoise2D {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rng = seededRandom(seed | 0);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);

    const g = (h: number, dx: number, dy: number) => {
      const g2 = GRAD2[this.perm[h] & 15];
      return g2[0] * dx + g2[1] * dy;
    };

    const A  = this.perm[X]     + Y;
    const B  = this.perm[X + 1] + Y;

    return lerp(
      lerp(g(this.perm[A],     xf,     yf    ),
           g(this.perm[B],     xf - 1, yf    ), u),
      lerp(g(this.perm[A + 1], xf,     yf - 1),
           g(this.perm[B + 1], xf - 1, yf - 1), u),
      v
    );
  }

  fbm(x: number, y: number, octaves: number, persistence: number, lacunarity: number): number {
    let total = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      total  += this.noise(x * freq, y * freq) * amp;
      maxAmp += amp;
      amp    *= persistence;
      freq   *= lacunarity;
    }
    return total / maxAmp;
  }

  // Ridge noise: inverts absolute value to create sharp ridges
  ridgeNoise(x: number, y: number, octaves: number, persistence: number, lacunarity: number): number {
    let total = 0, amp = 1, freq = 1, maxAmp = 0;
    let prev = 1;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise(x * freq, y * freq));
      total  += n * n * amp * prev;
      prev    = n * n;
      maxAmp += amp;
      amp    *= persistence;
      freq   *= lacunarity;
    }
    return total / maxAmp;
  }

  // Domain-warped fbm: warp the input coordinates with another fbm
  warpedFbm(
    x: number, y: number,
    octaves: number, persistence: number, lacunarity: number,
    warpStrength: number
  ): number {
    const wx = this.fbm(x + 1.7, y + 9.2, 3, persistence, lacunarity) * warpStrength;
    const wy = this.fbm(x + 8.3, y + 2.8, 3, persistence, lacunarity) * warpStrength;
    return this.fbm(x + wx, y + wy, octaves, persistence, lacunarity);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrace function: quantises height into steps with smooth blend edges
// ─────────────────────────────────────────────────────────────────────────────

function terrace(h: number, steps: number, blend: number): number {
  if (steps <= 0 || blend <= 0) return h;
  const quantized = Math.round(h * steps) / steps;
  const frac      = (h * steps) - Math.floor(h * steps);
  const smooth    = frac < 0.5
    ? 2 * frac * frac
    : 1 - 2 * (1 - frac) * (1 - frac);
  return lerp(h, lerp(Math.floor(h * steps) / steps, quantized, smooth), blend);
}

// ─────────────────────────────────────────────────────────────────────────────
// Circular bathymetry
//
// Replaces whatever the raw heightmap had below `waterLevel` outside the
// island shoreline with a clean, RADIAL depth curve. Above-water terrain is
// never touched (any cell with raw height > waterLevel is left alone), so
// "don't change anything about the top" is enforced by construction.
//
// Depth curve (in feet, defaults shown):
//
//   shorelineRad  ──────────  0 ft  ── beach / wading
//   +20% width                -3 ft  ── shallow water
//   +50% width               -10 ft  ── mid shelf
//   +100% width              -20 ft  ── seafloor                ◀ seafloorDepth
//   beyond                   -20 ft  ── flat seafloor + mild noise
//
// The curve is smoothstep-eased between the four anchor points so the
// transition reads as a "natural progression" rather than a hard ramp.
// Because depth depends only on distance-from-center, the underwater
// shape is a perfect circle by construction.
// ─────────────────────────────────────────────────────────────────────────────

interface BathymetryOpts {
  size: number;            // grid stride (segments + 1)
  segments: number;
  radius: number;          // world radius (heightmap covers [-radius..+radius])
  waterLevel: number;      // typically 0
  seafloorDepth: number;   // negative number, e.g. -20
  shelfWidth: number;      // world units past shoreline to reach seafloor
  shorelineRad: number;    // world distance where land hits water
  noise: PerlinNoise2D;    // for mild seafloor variation
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Map a normalized shelf parameter t∈[0,1] to depth (feet, negative). */
function shelfDepth(t: number, seafloor: number): number {
  // Three eased segments: 0..0.20→0..-3, 0.20..0.50→-3..-10, 0.50..1.00→-10..seafloor
  const D1 = -3, D2 = -10, D3 = seafloor;
  if (t <= 0) return 0;
  if (t >= 1) return D3;
  if (t < 0.20) {
    return lerp(0, D1, smoothstep(0, 0.20, t));
  } else if (t < 0.50) {
    return lerp(D1, D2, smoothstep(0.20, 0.50, t));
  } else {
    return lerp(D2, D3, smoothstep(0.50, 1.00, t));
  }
}

function applyCircularBathymetry(heightMap: Float32Array, opts: BathymetryOpts): void {
  const { size, segments, radius, waterLevel, seafloorDepth, shelfWidth, shorelineRad, noise } = opts;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const wx = (i / segments) * radius * 2 - radius;
      const wz = (j / segments) * radius * 2 - radius;
      const dist = Math.sqrt(wx * wx + wz * wz);
      if (dist <= shorelineRad) continue;          // dry land + above-water margin → untouched

      const idx = i * size + j;
      const raw = heightMap[idx];
      if (raw > waterLevel) continue;              // any above-water cell stays as-is

      // Normalize position along the shelf [0..1]
      const t = Math.min(1, (dist - shorelineRad) / shelfWidth);
      let depth = shelfDepth(t, seafloorDepth);

      // Subtle seafloor relief once we're past the visible shelf — keeps it
      // from looking like glass. Only applies in the deep zone (t > 0.5).
      if (t > 0.5) {
        const n = noise.fbm(wx * 0.025, wz * 0.025, 3, 0.5, 2.0); // ~[-1..1]
        const reliefAmp = 1.2;                                     // +/- ~1.2 ft
        const fade = smoothstep(0.5, 0.85, t);                     // grows past mid shelf
        depth += n * reliefAmp * fade;
      }

      // Never let bathymetry push UP into the raw above-water value (already
      // guarded by `raw > waterLevel` early-out, but also guard from below
      // so we don't accidentally raise a deeper raw cell).
      heightMap[idx] = Math.min(raw, depth);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrain generation
// ─────────────────────────────────────────────────────────────────────────────

export function generateIslandTerrain(partialConfig: Partial<TerrainConfig> = {}): TerrainData {
  const config = { ...DEFAULT_CONFIG, ...partialConfig };
  const {
    radius, segments, maxHeight,
    noiseScale, octaves, persistence, lacunarity, seed,
    beachWidth, waterLevel,
    ridgeStrength, domainWarpStrength,
    terraceCount, terraceStrength,
  } = config;

  const perlin = new PerlinNoise2D(seed);
  const perlinB = new PerlinNoise2D(seed + 3333);
  const size = segments + 1;
  const heightMap = new Float32Array(size * size);

  // ── 0. (Opt-in) Terrain v2 path ──────────────────────────────────────────
  // When useTerrainV2 is set, the new THREE.Terrain-inspired generator owns
  // the raw heightmap. We then skip the v1 noise loop and let the existing
  // smoothing / beach / coloring / mesh-build pipeline polish it.
  let v2Took = false;
  if (config.useTerrainV2 && config.biomeV2) {
    const v2 = generateIslandTerrainV2({
      size: radius * 2,
      segments,
      seed,
      maxHeight,
      waterLevel,
      biome: config.biomeV2,
      dock: config.dockSide ? { side: config.dockSide } : undefined,
      influences: config.influencesV2,
    });
    // v2 is row-major (iz * stride + ix); we rewrite into v1's (i, j) order.
    // Both are square (size x size), so we can copy 1:1 with index swap.
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // v1 indexing: heightMap[i*size + j], where (i,j) → world (u,v)
        // v2 indexing: heightmap.data[iz*stride + ix]; we map i↔iz, j↔ix
        heightMap[i * size + j] = v2.heightmap.data[i * size + j];
      }
    }
    v2Took = true;
  }

  // ── 1. Build raw height field (v1 fallback) ──────────────────────────────

  if (!v2Took) for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const u = (i / segments) * 2 - 1;   // [-1, 1]
      const v = (j / segments) * 2 - 1;
      const wx = u * radius;
      const wz = v * radius;

      const distFromCenter  = Math.sqrt(wx * wx + wz * wz);
      const normalizedDist  = distFromCenter / radius;

      // Multi-layer island falloff: radial ellipse + fractal edge noise
      const edgeWarp  = perlinB.fbm(wx * 0.008 + 50, wz * 0.008 + 50, 3, 0.5, 2.0) * 0.3;
      const falloffR  = Math.max(0, 1 - Math.pow(normalizedDist + edgeWarp * 0.4, 2.2));
      const islandFalloff = Math.pow(falloffR, 1.6);

      // Main terrain: domain-warped fbm
      const baseNoise = perlin.warpedFbm(
        wx * noiseScale + 1000,
        wz * noiseScale + 1000,
        octaves, persistence, lacunarity,
        domainWarpStrength
      );

      // Ridge noise (blended in for mountain peaks in the interior)
      const ridgeN = perlin.ridgeNoise(
        wx * noiseScale * 0.8 + 500,
        wz * noiseScale * 0.8 + 500,
        4, persistence, lacunarity
      );

      // Blend: interior uses more ridge, shores use smooth fbm
      const interior = Math.max(0, 1 - normalizedDist * 1.5);
      const combined = lerp(
        (baseNoise + 1) * 0.5,          // fbm mapped to [0,1]
        ridgeN,                         // ridge already [0,1]
        ridgeStrength * interior
      );

      // Terrace the raw height for cliff/step formations
      const terraced = terrace(combined, terraceCount, terraceStrength);

      // Apply island falloff + height scale
      let height = terraced * maxHeight * islandFalloff;

      // Smooth beach slope with gentle gradient into water
      const beachStart = radius - beachWidth;
      const shorelineRad = radius * 0.95;
      if (distFromCenter > beachStart) {
        const beachFactor = (distFromCenter - beachStart) / beachWidth;
        const smoothFall = 1 - beachFactor * beachFactor * (3 - 2 * beachFactor);
        height *= Math.max(0, smoothFall);

        // Create rocky cliff sections on steep parts of the coast
        const coastNoise = perlinB.fbm(wx * 0.03, wz * 0.03, 3, 0.5, 2.0);
        const isCliffCoast = coastNoise > 0.15;
        if (isCliffCoast && height > 3) {
          height = Math.max(height, 2.5 + (coastNoise - 0.15) * 12);
        }
      }

      // Underwater terrain handled in a unified pass below
      // (see applyCircularBathymetry — gives a clean radial shelf 0 → -3 →
      // -10 → -20 ft for both v1 and v2 heightmap origins).
      heightMap[i * size + j] = height;
    }
  }

  // ── 1.5. Circular bathymetry (radial shelf into seafloor at -20ft) ───────
  // Runs for BOTH the v1 and v2 heightmap origins. Above-water cells are
  // never modified; everything past the shoreline gets a clean radial depth
  // curve so the underwater shape is a perfect circle.
  {
    const shorelineRad = radius * 0.95;
    const shelfWidth   = config.bathymetryWidth ?? radius * 0.45;
    applyCircularBathymetry(heightMap, {
      size,
      segments,
      radius,
      waterLevel,
      seafloorDepth: config.seafloorDepth,
      shelfWidth,
      shorelineRad,
      noise: perlinB,
    });
  }

  // ── 2. Multi-pass smoothing (extra in beach zone) ─────────────────────────

  const smoothed = new Float32Array(heightMap);

  const smoothPass = (src: Float32Array, dst: Float32Array, sharpen: number) => {
    for (let i = 1; i < size - 1; i++) {
      for (let j = 1; j < size - 1; j++) {
        const h = src[i * size + j];
        const avg = (
          src[(i-1)*size + j]   + src[(i+1)*size + j] +
          src[i*size + j - 1]   + src[i*size + j + 1] +
          src[(i-1)*size+j-1]   + src[(i+1)*size+j+1] +
          src[(i-1)*size+j+1]   + src[(i+1)*size+j-1]
        ) / 8;
        dst[i * size + j] = h * sharpen + avg * (1 - sharpen);
      }
    }
  };

  smoothPass(heightMap, smoothed, 0.7);

  const beachSmooth = new Float32Array(smoothed);
  for (let pass = 0; pass < 3; pass++) {
    const src = pass === 0 ? smoothed : beachSmooth;
    for (let i = 1; i < size - 1; i++) {
      for (let j = 1; j < size - 1; j++) {
        const wx = (i / segments) * radius * 2 - radius;
        const wz = (j / segments) * radius * 2 - radius;
        const distFromCenter = Math.sqrt(wx * wx + wz * wz);
        const beachBlend = Math.max(0, Math.min(1, (distFromCenter - (radius - beachWidth * 1.5)) / (beachWidth * 1.5)));
        if (beachBlend > 0.01) {
          const h = src[i * size + j];
          const avg = (
            src[(i-1)*size + j]   + src[(i+1)*size + j] +
            src[i*size + j - 1]   + src[i*size + j + 1]
          ) / 4;
          beachSmooth[i * size + j] = lerp(h, avg, beachBlend * 0.6);
        } else {
          beachSmooth[i * size + j] = src[i * size + j];
        }
      }
    }
  }
  smoothed.set(beachSmooth);

  // ── 3. Build geometry ────────────────────────────────────────────────────

  const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position.array as Float32Array;
  const uvs = geometry.attributes.uv.array as Float32Array;
  const colors = new Float32Array(positions.length);

  // ── 4. Compute per-vertex slope (from finite-differences on smoothed map) ─

  const slopeMap = new Float32Array(size * size);
  const cellSize = (radius * 2) / segments;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(size - 1, i + 1);
      const j0 = Math.max(0, j - 1), j1 = Math.min(size - 1, j + 1);
      const dh_dx = (smoothed[i1 * size + j] - smoothed[i0 * size + j]) / ((i1 - i0) * cellSize);
      const dh_dz = (smoothed[i * size + j1] - smoothed[i * size + j0]) / ((j1 - j0) * cellSize);
      slopeMap[i * size + j] = Math.sqrt(dh_dx * dh_dx + dh_dz * dh_dz);
    }
  }

  // ── 5. Apply heights + per-vertex colors ─────────────────────────────────

  const rng = seededRandom(seed + 1);

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const vi = i * size + j;
      const height  = smoothed[vi];
      const slope   = slopeMap[vi];

      positions[vi * 3 + 1] = height;

      const x = positions[vi * 3];
      const z = positions[vi * 3 + 2];
      const distFromCenter = Math.sqrt(x * x + z * z);

      // Fake ambient occlusion: concave valleys are darker
      let aoFactor = 0;
      if (i > 0 && i < size-1 && j > 0 && j < size-1) {
        const hL = smoothed[i*size + (j-1)];
        const hR = smoothed[i*size + (j+1)];
        const hD = smoothed[(i-1)*size + j];
        const hU = smoothed[(i+1)*size + j];
        const avgNeighbour = (hL + hR + hD + hU) * 0.25;
        aoFactor = Math.max(0, Math.min(0.35, (avgNeighbour - height) * 0.015));
      }

      let r: number, g: number, b: number;

      const isSteep = slope > 0.65;
      const isMild  = slope > 0.30;

      if (height < -1.5) {
        // Underwater rock shelf - dark blue-grey
        const depthT = Math.min(1, Math.abs(height + 1.5) / 8);
        r = lerp(0.28, 0.15, depthT);
        g = lerp(0.32, 0.20, depthT);
        b = lerp(0.30, 0.25, depthT);
      } else if (height < 0.3) {
        // Wet sand at waterline - smooth transition
        const wetT = (height + 1.5) / 1.8;
        r = lerp(0.28, 0.68, wetT); g = lerp(0.32, 0.62, wetT); b = lerp(0.30, 0.45, wetT);
      } else if (distFromCenter > radius - beachWidth * 0.7) {
        // Beach / shore - warm sandy
        const beachGrad = Math.min(1, (radius - distFromCenter) / (beachWidth * 0.3));
        r = lerp(0.82, 0.72, beachGrad); g = lerp(0.74, 0.65, beachGrad); b = lerp(0.52, 0.40, beachGrad);
      } else if (height < 2.5) {
        // Wet sand / tidal
        r = 0.74; g = 0.67; b = 0.46;
      } else if (height < 7) {
        if (isSteep) { r = 0.46; g = 0.40; b = 0.32; }
        else         { r = 0.37; g = 0.55; b = 0.24; }
      } else if (height < 16) {
        if (isSteep) { r = 0.42; g = 0.37; b = 0.30; }
        else if (isMild) { r = 0.35; g = 0.48; b = 0.22; }
        else         { r = 0.28; g = 0.45; b = 0.18; }
      } else if (height < 26) {
        if (isSteep) { r = 0.38; g = 0.35; b = 0.30; }
        else if (isMild) { r = 0.45; g = 0.42; b = 0.35; }
        else         { r = 0.33; g = 0.44; b = 0.22; }
      } else if (height < 33) {
        if (isSteep) { r = 0.32; g = 0.30; b = 0.27; }
        else         { r = 0.50; g = 0.46; b = 0.40; }
      } else {
        r = 0.82; g = 0.82; b = 0.84;
      }

      // Cliff face darkening with jagged rock coloring
      if (isSteep && height > 0.5) {
        const cliff = Math.min(1, (slope - 0.65) * 2.5);
        const rockVar = perlinB.noise(x * 0.1, z * 0.1) * 0.08;
        r = lerp(r, 0.30 + rockVar, cliff);
        g = lerp(g, 0.27 + rockVar * 0.5, cliff);
        b = lerp(b, 0.24, cliff);
      }

      // Fake AO darkening
      r = Math.max(0, r - aoFactor);
      g = Math.max(0, g - aoFactor);
      b = Math.max(0, b - aoFactor);

      // Subtle random noise so there's no visible banding
      const jitter = (rng() - 0.5) * 0.04;
      r = Math.max(0, Math.min(1, r + jitter));
      g = Math.max(0, Math.min(1, g + jitter));
      b = Math.max(0, Math.min(1, b + jitter));

      colors[vi * 3]     = r;
      colors[vi * 3 + 1] = g;
      colors[vi * 3 + 2] = b;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  // ── 6. Material: vertex colors with physically-based settings ────────────

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.0,
    flatShading: false,
  });
  // Voronoi grass-blade-tip overlay: breaks up the flat biome green tint
  // with cell-based root→tip shading + soil patches + wind shimmer in the
  // grass areas only. Sand / rock / snow vertex colours pass through.
  enhanceWithGrassShader(material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow   = false;
  mesh.name = 'island_terrain';

  // ── 7. Helper functions ──────────────────────────────────────────────────

  function getHeightAt(worldX: number, worldZ: number): number {
    const u = (worldX / radius + 1) * 0.5;
    const v = (worldZ / radius + 1) * 0.5;
    const i  = u * segments;
    const j  = v * segments;
    const i0 = Math.max(0, Math.min(segments - 1, Math.floor(i)));
    const j0 = Math.max(0, Math.min(segments - 1, Math.floor(j)));
    const i1 = Math.min(segments, i0 + 1);
    const j1 = Math.min(segments, j0 + 1);
    const fi = i - i0, fj = j - j0;
    const h00 = smoothed[i0 * size + j0];
    const h10 = smoothed[i1 * size + j0];
    const h01 = smoothed[i0 * size + j1];
    const h11 = smoothed[i1 * size + j1];
    return lerp(lerp(h00, h10, fi), lerp(h01, h11, fi), fj);
  }

  function getNormalAt(worldX: number, worldZ: number): THREE.Vector3 {
    const d = 1.5;
    const hL = getHeightAt(worldX - d, worldZ);
    const hR = getHeightAt(worldX + d, worldZ);
    const hD = getHeightAt(worldX, worldZ - d);
    const hU = getHeightAt(worldX, worldZ + d);
    return new THREE.Vector3(hL - hR, 2 * d, hD - hU).normalize();
  }

  function getSlopeAt(worldX: number, worldZ: number): number {
    const n = getNormalAt(worldX, worldZ);
    return 1 - n.y;   // 0 = flat, ~1 = vertical cliff
  }

  return { mesh, heightMap: smoothed, segments, radius, getHeightAt, getNormalAt, getSlopeAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toon water plane
// ─────────────────────────────────────────────────────────────────────────────

export function createWaterPlane(radius: number): THREE.Mesh {
  const water = createToonOceanPlane(radius * 3.2, 160, {
    islandRadius: radius * 0.22,
    foamWidth:    radius * 0.14,
    waveAmp:      0.28,
    waveSpeed:    1.0,
    toonBands:    3,
    colorDeep:    0x052e48,
    colorMid:     0x0c5a88,
    colorShallow: 0x1e8ab0,
    colorFoam:    0xd8eff8,
    colorCrest:   0xf0f8ff,
  });
  water.position.y = -0.4;
  water.receiveShadow = true;
  water.name = 'island_water';
  water.userData.isWater = true;
  return water;
}

/** Call once per frame to animate the water. */
export function updateIslandWater(water: THREE.Mesh, elapsed: number): void {
  if (!water.userData.isWater) return;
  updateToonWater(water, elapsed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Collision mesh helper
// ─────────────────────────────────────────────────────────────────────────────

export function createTerrainCollisionMesh(terrainData: TerrainData): THREE.Mesh {
  const geometry = terrainData.mesh.geometry.clone();
  const material = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.isCollisionMesh = true;
  mesh.userData.terrainData     = terrainData;
  return mesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANNON.js Heightfield body factory
//   Returns a plain object (avoids a hard dep on cannon at module-level).
//   Call with the CANNON namespace imported in the consumer.
// ─────────────────────────────────────────────────────────────────────────────

export interface HeightfieldBodyData {
  matrix:      number[][];
  elementSize: number;
  originX:     number;
  originZ:     number;
}

export function buildHeightfieldData(terrain: TerrainData): HeightfieldBodyData {
  const { heightMap, segments, radius } = terrain;
  const size = segments + 1;
  const elementSize = (radius * 2) / segments;

  // CANNON.Heightfield expects matrix[xi][zi] = height
  const matrix: number[][] = [];
  for (let xi = 0; xi < size; xi++) {
    matrix[xi] = [];
    for (let zi = 0; zi < size; zi++) {
      matrix[xi][zi] = Math.max(0, heightMap[xi * size + zi]);
    }
  }

  return {
    matrix,
    elementSize,
    originX: -radius,
    originZ: -radius,
  };
}

/**
 * Creates a static CANNON.Body with a Heightfield shape matching the terrain.
 * Pass in `CANNON` (the cannon import) to avoid a hard module-level dep.
 */
export function createHeightfieldBody(terrain: TerrainData, CANNON: any): any {
  const data = buildHeightfieldData(terrain);

  const heightfieldShape = new CANNON.Heightfield(data.matrix, {
    elementSize: data.elementSize,
  });

  const body = new CANNON.Body({ mass: 0 });
  // Heightfield origin is at corner — rotate and offset to match Three.js geometry centre
  body.addShape(heightfieldShape, new CANNON.Vec3(data.originX, 0, data.originZ));
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);

  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snap / align helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface TerrainSnappedPosition {
  x: number; y: number; z: number;
  normal: THREE.Vector3;
  isOnTerrain: boolean;
  slope: number;
}

export function snapToTerrain(
  terrain: TerrainData,
  x: number, z: number,
  yOffset: number = 0
): TerrainSnappedPosition {
  const distFromCenter = Math.sqrt(x * x + z * z);
  const isOnTerrain = distFromCenter <= terrain.radius;
  const y = isOnTerrain ? terrain.getHeightAt(x, z) + yOffset : yOffset;
  const normal = isOnTerrain ? terrain.getNormalAt(x, z) : new THREE.Vector3(0, 1, 0);
  const slope  = isOnTerrain ? terrain.getSlopeAt(x, z) : 0;
  return { x, y, z, normal, isOnTerrain, slope };
}

export function alignObjectToTerrain(
  object: THREE.Object3D,
  terrain: TerrainData,
  alignToNormal: boolean = false,
  yOffset: number = 0
): void {
  const pos = snapToTerrain(terrain, object.position.x, object.position.z, yOffset);
  object.position.set(pos.x, pos.y, pos.z);
  if (alignToNormal && pos.isOnTerrain) {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.normal);
    object.quaternion.premultiply(q);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource node placement
// ─────────────────────────────────────────────────────────────────────────────

export function generateResourceNodePositions(
  terrain: TerrainData,
  nodeCount: number,
  minSpacing: number = 8
): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  const maxAttempts = nodeCount * 12;
  let attempts = 0;

  while (positions.length < nodeCount && attempts < maxAttempts) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const dist  = Math.pow(Math.random(), 0.5) * (terrain.radius - 20);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = terrain.getHeightAt(x, z);
    const s = terrain.getSlopeAt(x, z);

    if (y < 1.5 || y > terrain.radius * 0.18) continue;
    if (s > 0.55) continue;   // skip cliff faces

    let tooClose = false;
    for (const existing of positions) {
      const dx = existing.x - x, dz = existing.z - z;
      if (dx * dx + dz * dz < minSpacing * minSpacing) { tooClose = true; break; }
    }
    if (!tooClose) positions.push(new THREE.Vector3(x, y, z));
  }

  return positions;
}

export type NodeZone = 'beach' | 'lowland' | 'midland' | 'highland' | 'peak';

export function getNodeZone(terrain: TerrainData, x: number, z: number): NodeZone {
  const h = terrain.getHeightAt(x, z);
  const d = Math.sqrt(x * x + z * z);
  if (d > terrain.radius - 22) return 'beach';
  if (h < 5) return 'beach';
  if (h < 13) return 'lowland';
  if (h < 23) return 'midland';
  if (h < 31) return 'highland';
  return 'peak';
}

export const zoneNodeWeights: Record<NodeZone, Record<string, number>> = {
  beach:    { fiber_plant: 5, healing_herb: 3, stone_boulder: 3, wild_flower: 3, sunbloom: 2 },
  lowland:  { oak_tree: 7, pine_tree: 3, fiber_plant: 4, healing_herb: 3, mana_flower: 2, wild_flower: 3, sunbloom: 2, stone_boulder: 3, copper_vein: 2, iron_vein: 1 },
  midland:  { oak_tree: 4, pine_tree: 7, healing_herb: 2, mana_flower: 3, stone_boulder: 4, granite_rock: 3, iron_vein: 3, copper_vein: 2, wild_flower: 1 },
  highland: { pine_tree: 3, mana_flower: 3, granite_rock: 5, iron_vein: 5, gold_vein: 3, mythril_vein: 1 },
  peak:     { granite_rock: 5, gold_vein: 4, mythril_vein: 3 },
};

export function selectNodeTypeForZone(zone: NodeZone): string {
  const weights = zoneNodeWeights[zone];
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [type, w] of entries) { roll -= w; if (roll <= 0) return type; }
  return entries[0][0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall feature (unchanged API, improved material)
// ─────────────────────────────────────────────────────────────────────────────

export interface WaterfallConfig {
  position: THREE.Vector3;
  width: number;
  height: number;
  direction: THREE.Vector3;
}

export function createWaterfall(config: WaterfallConfig): THREE.Group {
  const group = new THREE.Group();
  group.name  = 'waterfall';
  const { position, width, height, direction } = config;

  // Cliff backing
  const cliffGeo = new THREE.BoxGeometry(width * 2.0, height * 1.3, width * 0.9);
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.95 });
  const cliff = new THREE.Mesh(cliffGeo, cliffMat);
  cliff.position.copy(position);
  cliff.position.y += height * 0.55;
  cliff.position.x -= direction.x * width * 0.5;
  cliff.position.z -= direction.z * width * 0.5;
  cliff.castShadow = cliff.receiveShadow = true;
  group.add(cliff);

  // Animated water plane (updated per-frame)
  const fallGeo = new THREE.PlaneGeometry(width, height, 6, 24);
  const fallMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uColor:   { value: new THREE.Color(0x5bc8f5) },
      uFoamColor: { value: new THREE.Color(0xd4f0fb) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.y * 1.5 + uTime * 4.0) * 0.18
             + cos(p.x * 2.0 + uTime * 3.0) * 0.10;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3  uColor;
      uniform vec3  uFoamColor;
      varying vec2  vUv;
      void main() {
        float stripe = fract(vUv.y * 6.0 - uTime * 2.5);
        float foam   = smoothstep(0.0, 0.15, stripe) * (1.0 - smoothstep(0.15, 0.35, stripe));
        vec3  col    = mix(uColor, uFoamColor, foam * 0.7);
        float alpha  = 0.72 + foam * 0.18;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const fall = new THREE.Mesh(fallGeo, fallMat);
  fall.position.copy(position);
  fall.position.y += height * 0.5;
  const angle = Math.atan2(direction.x, direction.z);
  fall.rotation.y = angle;
  group.add(fall);

  // Mist sphere at base
  const mistGeo = new THREE.SphereGeometry(width * 0.85, 12, 8);
  const mistMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.BackSide,
  });
  const mist = new THREE.Mesh(mistGeo, mistMat);
  mist.position.copy(position);
  mist.position.y += 0.8;
  mist.scale.y = 0.35;
  group.add(mist);

  // Plunge pool
  const poolGeo = new THREE.CircleGeometry(width * 1.6, 28);
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0x0d47a1, transparent: true, opacity: 0.82,
  });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.copy(position);
  pool.position.y += 0.1;
  group.add(pool);

  group.userData = { type: 'waterfall', animationTime: 0 };
  return group;
}

export function updateWaterfallAnimation(waterfall: THREE.Group, delta: number): void {
  if (waterfall.userData?.type !== 'waterfall') return;
  waterfall.userData.animationTime += delta;
  const t = waterfall.userData.animationTime;
  waterfall.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      const mat = mesh.material as THREE.ShaderMaterial;
      if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
    }
  });
}
