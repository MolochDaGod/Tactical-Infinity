/**
 * Warlords-era building interiors — templates for shells that have no insides.
 * Same-map XZ, hidden at captains-quarters Y. Not a second scene / interior2/.
 *
 * Sizes from inside-outside-builds skill. Definition UUID = fleetMeshUuid, not
 * player grudge_uuid.
 */
import { fleetMeshUuid } from './fleetMeshUuid';

export const INTERIOR_R2_DIR = 'models/fleet/interiors';
export const INTERIOR_CDN = 'https://assets.grudge-studio.com/models/fleet/interiors';

/** Below seafloor — same band as captains quarters. */
export const INTERIOR_WORLD_Y = -36;

export type WarlordsInteriorId = 'hut' | 'shop' | 'cottage' | 'tavern' | 'hall';

export interface WarlordsInteriorDef {
  id: WarlordsInteriorId;
  name: string;
  /** Inner room metres (door 0.9×2.1, walls 0.12). */
  w: number;
  l: number;
  h: number;
  floorFamily: 'oak' | 'wood' | 'stone';
  wallFamily: 'oak' | 'wood' | 'stone' | 'brick';
  layout: 'hut' | 'shop' | 'cottage' | 'tavern' | 'hall';
  r2Key: string;
  localUrl: string;
  cdnUrl: string;
}

function def(
  id: WarlordsInteriorId,
  name: string,
  w: number,
  l: number,
  h: number,
  floorFamily: WarlordsInteriorDef['floorFamily'],
  wallFamily: WarlordsInteriorDef['wallFamily'],
  layout: WarlordsInteriorDef['layout'],
): WarlordsInteriorDef {
  const r2Key = `${INTERIOR_R2_DIR}/${id}.glb`;
  return {
    id,
    name,
    w,
    l,
    h,
    floorFamily,
    wallFamily,
    layout,
    r2Key,
    localUrl: `/${r2Key}`,
    cdnUrl: `${INTERIOR_CDN}/${id}.glb`,
  };
}

/** Five SI rooms for Warlords shells (hut → hall). Cabin stays captainsQuarters. */
export const WARLORDS_INTERIORS: readonly WarlordsInteriorDef[] = [
  def('hut', 'Pirate hut', 3.2, 3.2, 2.4, 'oak', 'wood', 'hut'),
  def('shop', 'Merchant shop', 4.0, 3.6, 2.6, 'oak', 'wood', 'shop'),
  def('cottage', 'Cottage room', 5.2, 4.4, 2.6, 'wood', 'oak', 'cottage'),
  def('tavern', 'Rustic tavern', 6.0, 5.0, 2.8, 'oak', 'wood', 'tavern'),
  def('hall', 'Stone hall', 8.0, 6.0, 2.8, 'oak', 'stone', 'hall'),
];

export function warlordsInterior(id: WarlordsInteriorId): WarlordsInteriorDef {
  return WARLORDS_INTERIORS.find((d) => d.id === id) ?? WARLORDS_INTERIORS[0]!;
}

export function interiorUuid(id: WarlordsInteriorId, node = 'interior'): string {
  return fleetMeshUuid(`${INTERIOR_R2_DIR}/${id}.glb`, `${id}#${node}`);
}

/** Pick template from exterior AABB (metres). */
export function interiorIdForExterior(widthM: number, depthM: number): WarlordsInteriorId {
  const m = Math.max(widthM, depthM);
  if (m <= 4) return 'hut';
  if (m <= 5.5) return 'shop';
  if (m <= 8) return 'cottage';
  if (m <= 12) return 'tavern';
  return 'hall';
}
