/**
 * IslandHeightmap — pure-data heightmap synthesis for the canonical
 * `/islands` pipeline.
 *
 * Composition order (intentional):
 *   1. Simplex fBm (broad shape, set by `octaves` and `lacunarity`)
 *   2. Ridge noise pass (1 - |simplex|), gives sharp ridgelines for mountain biomes
 *   3. Radial island falloff (turns a square map into an island shape)
 *   4. Beach smoothing near sea level (avoids visible plane-clip)
 *   5. Optional caldera / volcanic crater stamp
 *
 * The output is a Float32Array of `(size+1)^2` floats, plus query helpers.
 * No THREE.js dependency in here — keep it portable (workerable later).
 */

import {
  generateSimplexLayers,
  applyIslandMask,
  applyBeachSmoothing,
  easeInOut,
  type TerrainOptions,
} from '@/lib/terrainGenerator';

export type IslandShape = 'round' | 'archipelago' | 'horseshoe' | 'volcanic_caldera';

export interface IslandHeightmapOptions {
  /** Number of vertices per side. The actual data array is (size+1)^2. */
  size: number;
  /** World-space side length in metres. */
  worldSize: number;
  seed: number;
  /** Overall vertical exaggeration. Sea level is 0. */
  maxHeight: number;
  /** Sea-floor depth at the map edge. */
  minHeight: number;
  /** Octave count for the simplex fBm pass. */
  octaves: number;
  /** Per-octave amplitude falloff. */
  persistence: number;
  /** Per-octave frequency growth. */
  lacunarity: number;
  /** Base feature size in metres. */
  baseFrequency: number;
  /** Mix factor for ridge noise on top of fBm (0 = none, 1 = pure ridges). */
  ridgeMix: number;
  shape: IslandShape;
}

export const DEFAULT_HEIGHTMAP_OPTIONS: IslandHeightmapOptions = {
  size: 256,
  worldSize: 256,
  seed: 12345,
  maxHeight: 32,
  // -22 puts the seafloor 2 units past our deepest creature band (whales at
  // -18) so chunked terrain forms a proper basin around the island and
  // creatures swim above it rather than poking through.
  minHeight: -22,
  octaves: 6,
  persistence: 0.55,
  lacunarity: 2.05,
  baseFrequency: 1.6,
  ridgeMix: 0.35,
  shape: 'round',
};

export interface IslandHeightmap {
  data: Float32Array;
  /** Edge length of the (size+1) x (size+1) vertex grid. */
  resolution: number;
  worldSize: number;
  options: IslandHeightmapOptions;
  /** World-space height query (interpolated). Returns 0 outside the map. */
  getHeightAt(worldX: number, worldZ: number): number;
  /** Min / max actual heights of the produced field — handy for shaders. */
  bounds: { min: number; max: number };
}

// ── Heightmap ops kept local so we don't have to re-export 1:1 ───────────────

function ridgeNoisePass(g: Float32Array, opts: IslandHeightmapOptions) {
  // Cheap "ridge from fBm" trick: invert |x| → produces creases. Mix back in.
  if (opts.ridgeMix <= 0) return;
  for (let i = 0; i < g.length; i++) {
    const v = g[i];
    const ridge = 1 - Math.abs(v / Math.max(0.001, opts.maxHeight));
    g[i] = v * (1 - opts.ridgeMix) + ridge * opts.maxHeight * opts.ridgeMix;
  }
}

function archipelagoMask(g: Float32Array, size: number) {
  // Subtract a few off-centre dips so the single round island breaks into 3-4
  // smaller isles connected by sandbars.
  const r = size + 1;
  const dips: Array<[number, number, number]> = [
    [0.18, 0.45, 0.18],
    [0.78, 0.55, 0.20],
    [0.45, 0.20, 0.16],
    [0.55, 0.82, 0.14],
  ];
  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      const u = x / size, v = y / size;
      let drop = 0;
      for (const [cx, cy, cr] of dips) {
        const d = Math.hypot(u - cx, v - cy);
        if (d < cr) drop += (1 - d / cr) * 18;
      }
      g[y * r + x] -= drop;
    }
  }
}

function horseshoeMask(g: Float32Array, size: number) {
  // Carve a wedge out of one side (a lagoon) — distance to a chord.
  const r = size + 1;
  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      const u = x / size - 0.5, v = y / size - 0.5;
      const d = Math.hypot(u, v + 0.05);
      const wedge = d < 0.32 && Math.atan2(v, u) > Math.PI * 0.05 && Math.atan2(v, u) < Math.PI * 0.95;
      if (wedge) {
        g[y * r + x] -= 22;
      }
    }
  }
}

/**
 * Single off-centre peak — a mid-size mountain you can actually see, climb,
 * and use as a navigation anchor on otherwise lumpy islands. Position is
 * derived from the seed so a given island keeps the same mountain across
 * reloads. Used for round / horseshoe / archipelago shapes (volcanic gets
 * its own caldera stamp instead).
 */
function mountainStamp(g: Float32Array, size: number, opts: IslandHeightmapOptions) {
  const r = size + 1;
  // Seeded offset in [-0.18, +0.18] from centre so the peak isn't dead-centre.
  // Cheap LCG off the seed — keeps the placement stable per island.
  const s = (opts.seed >>> 0) || 1;
  const sx = ((s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  const sz = (((s ^ 0x9e3779b1) * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  const cx = 0.5 + (sx - 0.5) * 0.36;
  const cz = 0.5 + (sz - 0.5) * 0.36;
  const peakH  = opts.maxHeight * 0.62;
  // Wider footprint than before so the mountain reads as a real massif with
  // walkable lower slopes instead of a narrow spike.
  const radius = 0.30;
  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      const u = x / size - cx, v = y / size - cz;
      const d = Math.hypot(u, v);
      if (d < radius) {
        // Smootherstep falloff (6t^5-15t^4+10t^3): a broad, gently-rounded
        // base that ramps up to a soft summit — climbable angles all the way
        // up instead of the old cubic spike. Ridge noise from the earlier
        // pass still adds craggy detail so it never reads as a smooth dome.
        const t = 1 - d / radius;
        const s = t * t * t * (t * (t * 6 - 15) + 10);
        g[y * r + x] += s * peakH;
      }
    }
  }
}

function volcanicCalderaStamp(g: Float32Array, size: number, opts: IslandHeightmapOptions) {
  // Boost centre into a peak then carve a crater on top.
  const r = size + 1;
  const peakH = opts.maxHeight * 0.85;
  const craterDepth = opts.maxHeight * 0.40;
  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      const u = x / size - 0.5, v = y / size - 0.5;
      const d = Math.hypot(u, v);
      if (d < 0.30) {
        const peak = (1 - d / 0.30) ** 2 * peakH;
        g[y * r + x] += peak;
        if (d < 0.07) {
          const crater = (1 - d / 0.07) * craterDepth;
          g[y * r + x] -= crater;
        }
      }
    }
  }
}

export function generateIslandHeightmap(
  partial: Partial<IslandHeightmapOptions> = {},
): IslandHeightmap {
  const opts: IslandHeightmapOptions = { ...DEFAULT_HEIGHTMAP_OPTIONS, ...partial };
  const r = opts.size + 1;
  const data = new Float32Array(r * r);

  // We funnel into the existing terrainGenerator primitives so we don't fork
  // the noise implementation. They read TerrainOptions, so build a synthetic.
  // NOTE: `generateSimplexLayers` keeps its octave table internally — the
  // public `octaves`/`persistence`/`lacunarity` fields on
  // `IslandHeightmapOptions` are reserved for a future custom noise pass and
  // currently act only as advisory metadata. Tuning the *look* still works
  // through `baseFrequency`, `maxHeight`, `ridgeMix`, and `shape`.
  const terrainOpts: TerrainOptions = {
    xSegments: opts.size,
    ySegments: opts.size,
    xSize: opts.worldSize,
    ySize: opts.worldSize,
    maxHeight: opts.maxHeight,
    minHeight: opts.minHeight,
    frequency: opts.baseFrequency,
    stretch: true,
    steps: 1,
    turbulent: false,
    easing: easeInOut,
    seed: opts.seed,
  };

  // 1. Multi-octave simplex fBm (octave table is baked into the helper).
  generateSimplexLayers(data, terrainOpts);

  // 2. Ridge mix.
  ridgeNoisePass(data, opts);

  // 3. Shape.
  switch (opts.shape) {
    case 'archipelago':
      archipelagoMask(data, opts.size);
      mountainStamp(data, opts.size, opts);
      break;
    case 'horseshoe':
      horseshoeMask(data, opts.size);
      mountainStamp(data, opts.size, opts);
      break;
    case 'volcanic_caldera':
      volcanicCalderaStamp(data, opts.size, opts);
      break;
    case 'round':
      // Round islands always get a single off-centre peak so the player has
      // a real mountain to navigate around / climb. Without it the island
      // reads as a lumpy disc.
      mountainStamp(data, opts.size, opts);
      break;
  }

  // 4. Radial falloff (always — we're islands, not continents).
  applyIslandMask(data, terrainOpts);

  // 5. Beach smoothing right above water.
  applyBeachSmoothing(data, terrainOpts);

  // Bounds.
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const h = data[i];
    if (h < min) min = h;
    if (h > max) max = h;
  }

  // Bilinear height query in world space.
  const half = opts.worldSize / 2;
  function getHeightAt(worldX: number, worldZ: number): number {
    const u = (worldX + half) / opts.worldSize;
    const v = (worldZ + half) / opts.worldSize;
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const fx = u * opts.size, fy = v * opts.size;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, opts.size), y1 = Math.min(y0 + 1, opts.size);
    const sx = fx - x0, sy = fy - y0;
    const h00 = data[y0 * r + x0];
    const h10 = data[y0 * r + x1];
    const h01 = data[y1 * r + x0];
    const h11 = data[y1 * r + x1];
    const a = h00 * (1 - sx) + h10 * sx;
    const b = h01 * (1 - sx) + h11 * sx;
    return a * (1 - sy) + b * sy;
  }

  return { data, resolution: r, worldSize: opts.worldSize, options: opts, bounds: { min, max }, getHeightAt };
}
