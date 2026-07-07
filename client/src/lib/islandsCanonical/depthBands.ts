/**
 * depthBands — single source of truth for the layered Z-stack every island
 * conforms to. Asset placement, creature spawning, harbour scoring, and
 * pathfinding all key off these named bands.
 *
 * See `.agents/skills/islands-and-terrain/SKILL.md` §3 for the rationale and
 * the band table the user signed off on.
 *
 * Y values are in world feet (the project's terrain unit). Negative = below
 * sea level. Bands are *closed-open* on the lower side and *open-closed* on
 * the upper side so a Y exactly on a boundary lands in the upper band:
 *
 *   bandFor(0)    === 'AIR_LOW'
 *   bandFor(-0.5) === 'SHORE'
 *   bandFor(-10)  === 'SHALLOW'
 *   bandFor(-30)  === 'MID'
 */

export type DepthBand = 'AIR_HIGH' | 'AIR_LOW' | 'SHORE' | 'SHALLOW' | 'MID' | 'DEEP';

export interface DepthBandSpec {
  id: DepthBand;
  /** Inclusive lower bound (world Y, ft). */
  yMin: number;
  /** Exclusive upper bound (world Y, ft). +Infinity for AIR_HIGH. */
  yMax: number;
  /** Short description for tooling/debug overlays. */
  description: string;
}

// Bands are tuned to a true ~20 ft water depth (seafloor at -20). The DEEP
// band is preserved for open-water scenes that go further down, but on
// /islands the chunked seabed clamps at -22 so MID covers the whale band.
export const DEPTH_BANDS: Record<DepthBand, DepthBandSpec> = {
  AIR_HIGH: { id: 'AIR_HIGH', yMin:   30, yMax:  Infinity, description: 'Mountain peaks, snow line, cloud shadows.' },
  AIR_LOW:  { id: 'AIR_LOW',  yMin:    0, yMax:        30, description: 'Walkable ground; vegetation, units, harvest nodes.' },
  SHORE:    { id: 'SHORE',    yMin:   -1, yMax:         0, description: 'Splash zone. Crabs, beach props, dock pier base.' },
  SHALLOW:  { id: 'SHALLOW',  yMin:   -6, yMax:        -1, description: 'Single fish, squid, dock pile depth, kelp.' },
  MID:      { id: 'MID',      yMin:  -14, yMax:        -6, description: 'Schools of fish, whale band, anchored ship draft.' },
  DEEP:     { id: 'DEEP',     yMin:  -22, yMax:       -14, description: 'Open seabed. Dark ambient, no light penetration.' },
};

/** Iteration helper — bands ordered top to bottom (highest Y first). */
export const DEPTH_BAND_ORDER: DepthBand[] = ['AIR_HIGH', 'AIR_LOW', 'SHORE', 'SHALLOW', 'MID', 'DEEP'];

/** Classify a world-Y into one of the six bands. Returns null for Y < -110. */
export function bandFor(worldY: number): DepthBand | null {
  for (const id of DEPTH_BAND_ORDER) {
    const b = DEPTH_BANDS[id];
    if (worldY >= b.yMin && worldY < b.yMax) return id;
  }
  // Y exactly at +∞ would land here; treat as AIR_HIGH for safety.
  if (worldY >= DEPTH_BANDS.AIR_HIGH.yMin) return 'AIR_HIGH';
  return null;
}

/** Pick a uniform-random Y inside the named band. */
export function randomYInBand(id: DepthBand, rng: () => number = Math.random): number {
  const b = DEPTH_BANDS[id];
  const top = isFinite(b.yMax) ? b.yMax : b.yMin + 30; // AIR_HIGH gets a 30ft dome by default
  return b.yMin + rng() * (top - b.yMin);
}
