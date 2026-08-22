/**
 * Aethermoor 3D MMO world build rules — one scale, one layer model.
 * 1 unit = 1 metre. Human 1.8 m. Water surface Y = 0.
 */
export const WORLD_SI = {
  unitMetres: 1,
  humanHeightM: 1.8,
  orcHeightM: 2.0,
  /** Buildings must clear a 2 m player (orc). Door 2.1 · room 2.6 · cottage eave 3.8. */
  playerEntryHeightM: 2.0,
  doorClearanceM: 2.1,
  roomMinHeightM: 2.6,
  cottageHeightM: 3.8,
  waterSurfaceY: 0,
  airshipHoverM: 20,
  fishNodeOffsetM: 14,
  fishSchoolSpreadM: 8,
  harvestNodeRadiusM: 2.4,
  buildGridM: 2,
  claimRadiusM: 48,
  captainPlayScale: 1,
} as const;

export const WORLD_LAYERS = [
  { id: 'sky', yMin: 12, yMax: 400, use: 'airships, weather' },
  { id: 'air', yMin: 2, yMax: 12, use: 'birds, flags' },
  { id: 'land', yMin: 0.05, yMax: 80, use: 'islands, RTS buildings, NPCs' },
  { id: 'shore', yMin: -0.4, yMax: 1.2, use: 'docks, crabs, beach harvest' },
  { id: 'water', yMin: -2, yMax: 0, use: 'boats, pelagic schools' },
  { id: 'mid', yMin: -8, yMax: -2, use: 'reef / mid-water fish' },
  { id: 'deep', yMin: -15, yMax: -8, use: 'predators, abyss' },
  { id: 'seabed', yMin: -80, yMax: -15, use: 'floor scatter' },
] as const;

export type WorldLayerId = (typeof WORLD_LAYERS)[number]['id'];

export function layerForY(y: number): WorldLayerId {
  for (const L of WORLD_LAYERS) {
    if (y >= L.yMin && y < L.yMax) return L.id;
  }
  return y >= 0 ? 'land' : 'seabed';
}
