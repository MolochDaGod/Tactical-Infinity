/**
 * Camp / RTS build SSOT (claim radius, palette costs, train recipes).
 *
 * Minimal production stub so Barracks + build hammer can ship while the full
 * shared/camp catalog is restored. Costs are permissive; claim is localStorage.
 */

export type CampResourceBag = Record<string, number>;

export interface CampBuildingRow {
  id: string;
  name: string;
  description: string;
  emoji: string;
  cost: CampResourceBag;
  claimGated?: boolean;
  /** Optional bridge to PlaceableBuildingType / registry name. */
  legacyId?: string;
}

export interface CampClaim {
  x: number;
  z: number;
  radiusM: number;
  plantedAt: number;
}

const CLAIM_KEY = 'gw-camp-claim-v1';
const DEFAULT_RADIUS_M = 48;

let claim: CampClaim | null = null;
const claimListeners = new Set<() => void>();

function notifyClaim() {
  for (const l of claimListeners) l();
}

export function loadClaimFromStorage(): CampClaim | null {
  try {
    const raw = localStorage.getItem(CLAIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampClaim;
    if (typeof parsed?.radiusM === 'number') {
      claim = parsed;
      return claim;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getClaim(): CampClaim | null {
  if (claim) return claim;
  return loadClaimFromStorage();
}

export function subscribeClaim(onStoreChange: () => void): () => void {
  claimListeners.add(onStoreChange);
  return () => claimListeners.delete(onStoreChange);
}

export function plantClaimFlag(x: number, z: number, radiusM = DEFAULT_RADIUS_M): CampClaim {
  claim = { x, z, radiusM, plantedAt: Date.now() };
  try {
    localStorage.setItem(CLAIM_KEY, JSON.stringify(claim));
  } catch {
    /* ignore */
  }
  notifyClaim();
  return claim;
}

export function registerPlacedOnClaim(_buildingId: string): void {
  // Full SSOT tracks placements per claim; stub is a no-op.
}

export function inClaimBuildRadius(x: number, z: number): boolean {
  const c = getClaim();
  if (!c) return true; // permissive until claim system is fully wired
  const dx = x - c.x;
  const dz = z - c.z;
  return dx * dx + dz * dz <= c.radiusM * c.radiusM;
}

export function validateBuildAt(
  x: number,
  z: number,
  opts?: { requireClaim?: boolean },
): { ok: boolean; reason?: string } {
  if (opts?.requireClaim && !getClaim()) {
    return { ok: false, reason: 'Plant a claim flag first' };
  }
  if (getClaim() && !inClaimBuildRadius(x, z)) {
    return { ok: false, reason: 'Outside claim radius' };
  }
  return { ok: true };
}

export function canAfford(cost: CampResourceBag, bag: CampResourceBag): boolean {
  for (const [k, v] of Object.entries(cost || {})) {
    if ((bag[k] ?? 0) < (v ?? 0)) return false;
  }
  return true;
}

/** Alias used by BuildHammerUI / registry re-exports. */
export const canAffordSsot = canAfford;

const DEFAULT_PALETTE: CampBuildingRow[] = [
  {
    id: 'camp_tc',
    name: 'Town Center',
    description: 'Core camp hub',
    emoji: '🏛️',
    cost: { wood: 50, stone: 20 },
    legacyId: 'rts_town_center',
    claimGated: false,
  },
  {
    id: 'camp_barracks',
    name: 'Barracks',
    description: 'Train melee units',
    emoji: '⚔️',
    cost: { wood: 40, stone: 15 },
    legacyId: 'rts_barracks',
    claimGated: true,
  },
  {
    id: 'camp_archery',
    name: 'Archery',
    description: 'Train ranged units',
    emoji: '🏹',
    cost: { wood: 35, fiber: 10 },
    legacyId: 'rts_archery',
    claimGated: true,
  },
  {
    id: 'camp_farm',
    name: 'Farm',
    description: 'Food production',
    emoji: '🌾',
    cost: { wood: 20 },
    legacyId: 'rts_farm',
    claimGated: true,
  },
  {
    id: 'camp_dock',
    name: 'Boat Dock',
    description: 'Launch rafts and hulls',
    emoji: '⚓',
    cost: { wood: 60, ore: 10 },
    legacyId: 'boat_dock',
    claimGated: true,
  },
  {
    id: 'camp_workbench',
    name: 'Workbench',
    description: 'Craft station',
    emoji: '🔨',
    cost: { wood: 15 },
    legacyId: 'workbench',
  },
  {
    id: 'camp_forge',
    name: 'Forge',
    description: 'Metalwork',
    emoji: '🔥',
    cost: { stone: 25, ore: 15 },
    legacyId: 'forge',
    claimGated: true,
  },
  {
    id: 'camp_tower',
    name: 'Watchtower',
    description: 'Defense',
    emoji: '🗼',
    cost: { wood: 30, stone: 30 },
    legacyId: 'tower',
    claimGated: true,
  },
];

export function buildingPaletteRows(_faction: string = 'any'): CampBuildingRow[] {
  return DEFAULT_PALETTE.slice();
}

export function getBuilding(id: string): CampBuildingRow | undefined {
  return DEFAULT_PALETTE.find((b) => b.id === id || b.legacyId === id);
}

export function resolveBuilding(idOrLegacy: string): CampBuildingRow | undefined {
  return getBuilding(idOrLegacy);
}

export function recipesForBuilding(_id: string): unknown[] {
  return [];
}

export function unitsTrainedAt(_id: string): unknown[] {
  return [];
}
