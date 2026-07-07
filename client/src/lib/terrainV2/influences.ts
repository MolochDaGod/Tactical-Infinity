/**
 * Influences — meta-objects that flatten/raise/lower regions of the
 * heightmap. Inspired by THREE.Terrain's Influences API (MIT, IceCreamYou).
 *
 * Use cases in Tethical:
 *   - Flat dock pad on the south shore
 *   - Volcano caldera (raise rim, depress center)
 *   - Mountain peak with sharp spike
 *   - Lake / freshwater pond depression
 */

import { Heightmap } from './heightmap';

export type InfluenceShape = 'circle' | 'rect';
export type InfluenceMode  = 'set' | 'add' | 'sub' | 'multiply' | 'max' | 'min';

export interface Influence {
  shape: InfluenceShape;
  /** World-space center (x, z). */
  center: { x: number; z: number };
  /** For circle: radius. For rect: half-extents (x, z). */
  size: number | { x: number; z: number };
  /** Target height (or amplitude for add/sub). */
  height: number;
  mode: InfluenceMode;
  /** Easing exponent applied to the falloff (1 = linear, 2 = quadratic). */
  falloff?: number;
  /** Inner fraction (0..1) where the influence is at full strength. */
  plateau?: number;
}

export function applyInfluences(target: Heightmap, influences: Influence[]): void {
  if (!influences.length) return;
  const half = target.size * 0.5;
  const cellSize = target.size / target.segments;

  for (const inf of influences) {
    const cx = inf.center.x;
    const cz = inf.center.z;
    const fall = inf.falloff ?? 2;
    const plateau = Math.min(0.99, Math.max(0, inf.plateau ?? 0));

    let ixMin: number, ixMax: number, izMin: number, izMax: number;
    let containsAndStrength: (wx: number, wz: number) => number;

    if (inf.shape === 'circle') {
      const r = typeof inf.size === 'number' ? inf.size : (inf.size.x + inf.size.z) * 0.5;
      ixMin = Math.max(0, Math.floor((cx - r + half) / cellSize));
      ixMax = Math.min(target.stride - 1, Math.ceil((cx + r + half) / cellSize));
      izMin = Math.max(0, Math.floor((cz - r + half) / cellSize));
      izMax = Math.min(target.stride - 1, Math.ceil((cz + r + half) / cellSize));
      const r2 = r * r;
      const rPlateau = r * plateau;
      const rPlateau2 = rPlateau * rPlateau;
      const rangeR = Math.max(0.0001, r - rPlateau);
      containsAndStrength = (wx, wz) => {
        const dx = wx - cx, dz = wz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r2) return 0;
        if (d2 <= rPlateau2) return 1;
        const t = (Math.sqrt(d2) - rPlateau) / rangeR;
        return Math.pow(1 - t, fall);
      };
    } else {
      const hx = typeof inf.size === 'number' ? inf.size : inf.size.x;
      const hz = typeof inf.size === 'number' ? inf.size : inf.size.z;
      ixMin = Math.max(0, Math.floor((cx - hx + half) / cellSize));
      ixMax = Math.min(target.stride - 1, Math.ceil((cx + hx + half) / cellSize));
      izMin = Math.max(0, Math.floor((cz - hz + half) / cellSize));
      izMax = Math.min(target.stride - 1, Math.ceil((cz + hz + half) / cellSize));
      const hxP = hx * plateau, hzP = hz * plateau;
      const rangeX = Math.max(0.0001, hx - hxP);
      const rangeZ = Math.max(0.0001, hz - hzP);
      containsAndStrength = (wx, wz) => {
        const dx = Math.abs(wx - cx), dz = Math.abs(wz - cz);
        if (dx >= hx || dz >= hz) return 0;
        const tx = dx <= hxP ? 0 : (dx - hxP) / rangeX;
        const tz = dz <= hzP ? 0 : (dz - hzP) / rangeZ;
        const t = Math.max(tx, tz);
        return Math.pow(1 - t, fall);
      };
    }

    for (let iz = izMin; iz <= izMax; iz++) {
      const wz = -half + iz * cellSize;
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const wx = -half + ix * cellSize;
        const s = containsAndStrength(wx, wz);
        if (s <= 0) continue;
        const i = iz * target.stride + ix;
        const cur = target.data[i];
        switch (inf.mode) {
          case 'set':
            target.data[i] = cur * (1 - s) + inf.height * s;
            break;
          case 'add':
            target.data[i] = cur + inf.height * s;
            break;
          case 'sub':
            target.data[i] = cur - inf.height * s;
            break;
          case 'multiply':
            target.data[i] = cur * (1 - s + inf.height * s);
            break;
          case 'max':
            target.data[i] = Math.max(cur, cur * (1 - s) + inf.height * s);
            break;
          case 'min':
            target.data[i] = Math.min(cur, cur * (1 - s) + inf.height * s);
            break;
        }
      }
    }
  }
}
