/**
 * Dwarf / arctic mountain-fortress island — Sketchfab "Low-poly Mountain Fortress".
 * Source: D:\Games\Models\dwarfislands.glb
 * Runtime: /models/islands/shells/dwarfislands.glb
 *
 * Authored AABB ≈ 36.5 × 25 × 62.5 m (already SI). Do NOT hero-fit.
 * No embedded textures — rebind tundra/stone at load.
 * Whole shell as one landmass (like tropical_island). Node roles for nav/harvest.
 */
import { fleetMeshUuid } from './fleetMeshUuid';

export const DWARF_ISLAND_URL = '/models/islands/shells/dwarfislands.glb';
export const DWARF_ISLAND_R2_KEY = 'models/islands/shells/dwarfislands.glb';
export const DWARF_ISLAND_CDN =
  'https://assets.grudge-studio.com/models/islands/shells/dwarfislands.glb';

export type DwarfIslandSkin = 'arctic' | 'dwarf';

/** Authored metres — Warlords 1.8 m human yardstick. */
export const DWARF_ISLAND_SI = {
  lengthM: 36.5,
  beamM: 25.0,
  heightM: 62.5,
  /** Lift so authored min.y (−9.26) sits as underwater skirt. */
  groundLiftM: 9.3,
} as const;

export type DwarfMeshRole = 'terrain' | 'keep' | 'tower' | 'prop' | 'ignore';

export function dwarfMeshRole(name: string): DwarfMeshRole {
  const n = name.replace(/_0$/, '');
  if (/^Lamp/i.test(n) || n === 'Root' || n === 'Sketchfab_model') return 'ignore';
  if (/^Plane/i.test(n)) return 'terrain';
  if (/^Cylinder/i.test(n)) return 'tower';
  if (/^Cube/i.test(n)) return 'keep';
  return 'prop';
}

export const DWARF_HARVEST: Record<
  DwarfIslandSkin,
  readonly { ident: string; yield: string; count: number }[]
> = {
  arctic: [
    { ident: 'pine', yield: 'wood', count: 6 },
    { ident: 'rock', yield: 'stone', count: 8 },
    { ident: 'ore_iron', yield: 'iron', count: 4 },
  ],
  dwarf: [
    { ident: 'rock', yield: 'stone', count: 6 },
    { ident: 'ore_iron', yield: 'iron', count: 8 },
    { ident: 'ore_gold', yield: 'gold', count: 3 },
    { ident: 'crystal', yield: 'mana', count: 2 },
  ],
};

export function dwarfIslandUuid(node = 'shell'): string {
  return fleetMeshUuid(DWARF_ISLAND_R2_KEY, node);
}
