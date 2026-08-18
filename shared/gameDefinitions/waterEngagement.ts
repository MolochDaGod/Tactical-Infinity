/**
 * Production water engagement SSOT — raft quick-craft, boat dock shipyard,
 * multi-attachment raft loadout, and the 9 ocean sectors used by lobby +
 * world map.
 *
 * Ladder:
 *   • Raft  = quick craft from the player main panel (not RTS placeable)
 *   • Boat Dock = RTS building; unlocks construction of the other 5 hulls
 *   • Dock hulls: skiff → sloop → brigantine → galleon → manOWar
 */

import type { BoatId } from './boatRegistry';

// ─── Raft quick-craft (main panel) ───────────────────────────────────────────

export interface RaftCraftRecipe {
  wood: number;
  hemp: number;
  stone: number;
  gold?: number;
}

/** Materials for the starter sailed raft (main-panel quick craft). */
export const RAFT_QUICK_CRAFT: RaftCraftRecipe = {
  wood: 5,
  hemp: 2,
  stone: 1,
};

/** Short vs long rafts — basic plank first, upgrades at a boat dock. */
export type RaftHullClass = 'short' | 'long';

export interface RaftHullDef {
  id: string;
  name: string;
  cls: RaftHullClass;
  /** Play ladder order (0 = most basic). */
  tier: number;
  modelPath: string;
  lengthM: number;
  heightM: number;
  craftXp: number;
  cost: RaftCraftRecipe;
  requiresDock: boolean;
  /** If true, hidden until player discovers the recipe (coastal islet). */
  discoverable?: boolean;
  discoverHint?: string;
  notes: string;
}

export const RAFT_HULLS: readonly RaftHullDef[] = [
  {
    id: 'short_plank',
    name: 'Plank Raft',
    cls: 'short',
    tier: 0,
    modelPath: '/models/fleet/rafts/short_plank.glb',
    lengthM: 2.4,
    heightM: 0.5,
    craftXp: 15,
    cost: { wood: 5, hemp: 2, stone: 1 },
    requiresDock: false,
    notes: 'Most basic short raft. Main-panel / beach craft.',
  },
  {
    id: 'short_logs',
    name: 'Log Raft',
    cls: 'short',
    tier: 1,
    modelPath: '/models/fleet/rafts/short_logs.glb',
    lengthM: 3.2,
    heightM: 0.7,
    craftXp: 35,
    cost: { wood: 10, hemp: 3, stone: 2 },
    requiresDock: true,
    notes: 'Short upgrade at a boat dock.',
  },
  {
    id: 'short_sail',
    name: 'Sailed Short Raft',
    cls: 'short',
    tier: 2,
    modelPath: '/models/fleet/rafts/short_sail.glb',
    lengthM: 3.6,
    heightM: 2.4,
    craftXp: 60,
    cost: { wood: 12, hemp: 6, stone: 2 },
    requiresDock: true,
    notes: 'Short hull + mast + sail.',
  },
  {
    id: 'long_complete',
    name: 'Long Work Raft',
    cls: 'long',
    tier: 3,
    modelPath: '/models/fleet/rafts/long_complete.glb',
    lengthM: 6.5,
    heightM: 1.4,
    craftXp: 110,
    cost: { wood: 22, hemp: 8, stone: 4 },
    requiresDock: true,
    notes: 'Long raft — dock workshop upgrade.',
  },
  {
    id: 'orc_long',
    name: 'Orc War Raft',
    cls: 'long',
    tier: 4,
    modelPath: '/models/fleet/rafts/orc_war.glb',
    lengthM: 8.5,
    heightM: 2.2,
    craftXp: 200,
    cost: { wood: 40, hemp: 12, stone: 8 },
    requiresDock: true,
    discoverable: true,
    discoverHint: 'Discover the wreck on the coastal islet east of home island.',
    notes: 'Discoverable recipe. Mesh stays on D:\\Games\\Models\\stylized_orc_raft.glb (148 MB) until isolate — do not ship the fat pack as default.',
  },
];

export function getRaftHull(id: string): RaftHullDef {
  return RAFT_HULLS.find((r) => r.id === id) ?? RAFT_HULLS[0];
}

/** Attachment slots on the raft (multi-option loadout). */
export type RaftAttachmentSlot =
  | 'sail'
  | 'mast'
  | 'storage'
  | 'utility'
  | 'mooring'
  | 'canopy';

export type RaftAttachmentId =
  | 'sail_patchwork'
  | 'sail_canvas'
  | 'mast_sapling'
  | 'mast_oak'
  | 'barrel_small'
  | 'barrel_double'
  | 'fishing_pole'
  | 'paddle'
  | 'mooring_standard'
  | 'mooring_cross'
  | 'canopy_none'
  | 'canopy_tarp';

export interface RaftAttachmentDef {
  id: RaftAttachmentId;
  slot: RaftAttachmentSlot;
  name: string;
  description: string;
  /** Gold or resource cost to equip after raft is built. */
  cost: { wood?: number; hemp?: number; stone?: number; gold?: number };
  /** Bonus flags for UI / future systems. */
  bonuses?: {
    cargo?: number;
    speed?: number;
    fishChance?: number;
    sailPower?: number;
  };
}

export const RAFT_ATTACHMENTS: readonly RaftAttachmentDef[] = [
  {
    id: 'sail_patchwork',
    slot: 'sail',
    name: 'Patchwork Sail',
    description: 'Ragged hemp cloth. Barely catches wind.',
    cost: { hemp: 2 },
    bonuses: { sailPower: 0.6, speed: 0.5 },
  },
  {
    id: 'sail_canvas',
    slot: 'sail',
    name: 'Canvas Sail',
    description: 'Proper sailcloth for coastal runs.',
    cost: { hemp: 6, gold: 15 },
    bonuses: { sailPower: 1, speed: 1 },
  },
  {
    id: 'mast_sapling',
    slot: 'mast',
    name: 'Sapling Mast',
    description: 'Thin mast — light but flexes in storms.',
    cost: { wood: 3 },
    bonuses: { speed: 0.2 },
  },
  {
    id: 'mast_oak',
    slot: 'mast',
    name: 'Oak Mast',
    description: 'Sturdy mast for heavier canvas.',
    cost: { wood: 12, gold: 10 },
    bonuses: { speed: 0.4, sailPower: 0.15 },
  },
  {
    id: 'barrel_small',
    slot: 'storage',
    name: 'Supply Barrel',
    description: 'One cask of provisions.',
    cost: { wood: 4 },
    bonuses: { cargo: 8 },
  },
  {
    id: 'barrel_double',
    slot: 'storage',
    name: 'Twin Barrels',
    description: 'Paired casks for longer trips.',
    cost: { wood: 8, gold: 5 },
    bonuses: { cargo: 18 },
  },
  {
    id: 'fishing_pole',
    slot: 'utility',
    name: 'Fishing Pole',
    description: 'Cast from the raft while drifting.',
    cost: { wood: 2, hemp: 1 },
    bonuses: { fishChance: 0.25 },
  },
  {
    id: 'paddle',
    slot: 'utility',
    name: 'Oar Pair',
    description: 'Manual propulsion when wind fails.',
    cost: { wood: 4 },
    bonuses: { speed: 0.3 },
  },
  {
    id: 'mooring_standard',
    slot: 'mooring',
    name: 'Admiralty Anchor',
    description: 'Standard iron hook for shallow moor.',
    cost: { stone: 2, gold: 8 },
  },
  {
    id: 'mooring_cross',
    slot: 'mooring',
    name: 'Cross Anchor',
    description: 'Better bite on rocky bottoms.',
    cost: { stone: 4, gold: 18 },
  },
  {
    id: 'canopy_none',
    slot: 'canopy',
    name: 'Open Deck',
    description: 'No cover — full sun.',
    cost: {},
  },
  {
    id: 'canopy_tarp',
    slot: 'canopy',
    name: 'Tarp Canopy',
    description: 'Shade and light rain cover.',
    cost: { hemp: 4, wood: 2 },
  },
] as const;

export const DEFAULT_RAFT_LOADOUT: Record<RaftAttachmentSlot, RaftAttachmentId> = {
  sail: 'sail_patchwork',
  mast: 'mast_sapling',
  storage: 'barrel_small',
  utility: 'paddle',
  mooring: 'mooring_standard',
  canopy: 'canopy_none',
};

export function attachmentsForSlot(slot: RaftAttachmentSlot): RaftAttachmentDef[] {
  return RAFT_ATTACHMENTS.filter((a) => a.slot === slot);
}

export function getRaftAttachment(id: RaftAttachmentId): RaftAttachmentDef | undefined {
  return RAFT_ATTACHMENTS.find((a) => a.id === id);
}

// ─── Boat dock (RTS) + 5 ship tiers ──────────────────────────────────────────

/** Hulls built only at a Boat Dock (not main-panel quick craft). */
export const DOCK_SHIP_HULLS = [
  'skiff',
  'sloop',
  'brigantine',
  'galleon',
  'manOWar',
] as const satisfies readonly BoatId[];

export type DockShipHull = (typeof DOCK_SHIP_HULLS)[number];

export interface DockShipRecipe {
  hull: DockShipHull;
  displayName: string;
  description: string;
  /** Tier rank for UI (2..6; raft is tier 1). */
  tier: number;
  /** Model for previews in lobby / sectors. */
  modelPath: string;
  cost: { wood: number; stone: number; ore: number; gold: number; hemp?: number };
  /** Requires previous hull built (chain). */
  requires?: DockShipHull | 'raft';
  buildSeconds: number;
}

export const DOCK_SHIP_RECIPES: readonly DockShipRecipe[] = [
  {
    hull: 'skiff',
    displayName: 'Pirate Skiff',
    description: 'First real hull — side anchor, barrels, light sail.',
    tier: 2,
    modelPath: '/models/ships/ship-pirate-small.glb',
    cost: { wood: 30, stone: 8, ore: 8, gold: 40, hemp: 6 },
    requires: 'raft',
    buildSeconds: 45,
  },
  {
    hull: 'sloop',
    displayName: 'Sloop',
    description: 'Fast single-mast trader with light guns.',
    tier: 3,
    modelPath: '/models/ships/ship-small.glb',
    cost: { wood: 80, stone: 20, ore: 30, gold: 120, hemp: 12 },
    requires: 'skiff',
    buildSeconds: 90,
  },
  {
    hull: 'brigantine',
    displayName: 'Brigantine',
    description: 'Two-mast workhorse with full broadside.',
    tier: 4,
    modelPath: '/models/ships/ship-medium.glb',
    cost: { wood: 150, stone: 40, ore: 50, gold: 280, hemp: 20 },
    requires: 'sloop',
    buildSeconds: 150,
  },
  {
    hull: 'galleon',
    displayName: 'Galleon',
    description: 'Heavy war hull — fortress on the waves.',
    tier: 5,
    modelPath: '/models/ships/ship-large.glb',
    cost: { wood: 300, stone: 80, ore: 100, gold: 600, hemp: 40 },
    requires: 'brigantine',
    buildSeconds: 240,
  },
  {
    hull: 'manOWar',
    displayName: "Man o' War",
    description: 'Capital warship — max loadout and prestige.',
    tier: 6,
    modelPath: '/models/ships/ship-pirate-large.glb',
    cost: { wood: 600, stone: 160, ore: 200, gold: 1400, hemp: 80 },
    requires: 'galleon',
    buildSeconds: 360,
  },
];

export function getDockShipRecipe(hull: DockShipHull): DockShipRecipe {
  return DOCK_SHIP_RECIPES.find((r) => r.hull === hull)!;
}

/** RTS building definition for the boat dock (placeable). */
export const BOAT_DOCK_BUILDING = {
  type: 'boat_dock' as const,
  name: 'Boat Dock',
  description:
    'RTS shipyard pier. Place on a shore — construct Skiff through Man o’ War here. Raft remains a main-panel quick craft.',
  category: 'production' as const,
  cost: { wood: 40, stone: 25, ore: 5, gold: 50 },
  cellSize: { width: 4, height: 6 },
  /** Preview / fallback model path (procedural dock used if missing). */
  modelPath: '/models/ships/ship-small.glb',
  maxShipsQueued: 1,
};

// ─── Nine ocean sectors (3×3 world grid) ─────────────────────────────────────

export type OceanSectorId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'w'
  | 'center'
  | 'e'
  | 'sw'
  | 's'
  | 'se';

export interface OceanSector {
  id: OceanSectorId;
  name: string;
  /** Grid cell in 3×3 (−1..1). */
  grid: { col: -1 | 0 | 1; row: -1 | 0 | 1 };
  /** World-map center (matches WORLD_SIZE 9000). */
  center: { x: number; z: number };
  faction: 'crusade' | 'legion' | 'fabled' | 'neutral' | 'pirate';
  /** Suggested ship tier presence for lobby / NPC fleets. */
  shipTierFocus: DockShipHull | 'raft';
  /** Whether player boat docks are allowed to construct here. */
  allowsShipConstruction: boolean;
  /** Port / dock asset density for sector decoration. */
  dockDensity: 'none' | 'sparse' | 'busy' | 'capital';
  description: string;
}

/** Cell size for sector centers on the 9000-unit world. */
const SECTOR_STEP = 2800;

function sectorCenter(col: -1 | 0 | 1, row: -1 | 0 | 1): { x: number; z: number } {
  return { x: col * SECTOR_STEP, z: row * SECTOR_STEP };
}

/**
 * All 9 sectors — used by world map markers, lobby ship displays, and
 * water engagement rules (where docks / higher hulls appear).
 */
export const OCEAN_SECTORS: readonly OceanSector[] = [
  {
    id: 'nw',
    name: 'Crusade North-West Reach',
    grid: { col: -1, row: -1 },
    center: sectorCenter(-1, -1),
    faction: 'crusade',
    shipTierFocus: 'sloop',
    allowsShipConstruction: true,
    dockDensity: 'sparse',
    description: 'Cold trade winds; light patrol sloops.',
  },
  {
    id: 'n',
    name: 'Northern Crusade Sea',
    grid: { col: 0, row: -1 },
    center: sectorCenter(0, -1),
    faction: 'crusade',
    shipTierFocus: 'brigantine',
    allowsShipConstruction: true,
    dockDensity: 'busy',
    description: 'Odin’s main naval corridor.',
  },
  {
    id: 'ne',
    name: 'Fabled North-East Isles',
    grid: { col: 1, row: -1 },
    center: sectorCenter(1, -1),
    faction: 'fabled',
    shipTierFocus: 'skiff',
    allowsShipConstruction: true,
    dockDensity: 'sparse',
    description: 'Island-hopping skiff routes.',
  },
  {
    id: 'w',
    name: 'Western Void Margin',
    grid: { col: -1, row: 0 },
    center: sectorCenter(-1, 0),
    faction: 'neutral',
    shipTierFocus: 'raft',
    allowsShipConstruction: true,
    dockDensity: 'sparse',
    description: 'Edge waters — rafts and scavengers.',
  },
  {
    id: 'center',
    name: 'Sanctuary / Lobby Sea',
    grid: { col: 0, row: 0 },
    center: sectorCenter(0, 0),
    faction: 'neutral',
    shipTierFocus: 'raft',
    allowsShipConstruction: true,
    dockDensity: 'capital',
    description: 'Home lobby waters — raft craft + starter boat dock showcase.',
  },
  {
    id: 'e',
    name: 'Eastern Fabled Archipelago',
    grid: { col: 1, row: 0 },
    center: sectorCenter(1, 0),
    faction: 'fabled',
    shipTierFocus: 'galleon',
    allowsShipConstruction: true,
    dockDensity: 'busy',
    description: 'Deep-draft trade galleons.',
  },
  {
    id: 'sw',
    name: 'Legion South-West Caldera',
    grid: { col: -1, row: 1 },
    center: sectorCenter(-1, 1),
    faction: 'legion',
    shipTierFocus: 'brigantine',
    allowsShipConstruction: true,
    dockDensity: 'busy',
    description: 'Ash-choked war lanes.',
  },
  {
    id: 's',
    name: 'Southern Volcanic Front',
    grid: { col: 0, row: 1 },
    center: sectorCenter(0, 1),
    faction: 'legion',
    shipTierFocus: 'manOWar',
    allowsShipConstruction: true,
    dockDensity: 'capital',
    description: 'Capital warships of Madra’s fleet.',
  },
  {
    id: 'se',
    name: 'Pirate South-East Fringe',
    grid: { col: 1, row: 1 },
    center: sectorCenter(1, 1),
    faction: 'pirate',
    shipTierFocus: 'galleon',
    allowsShipConstruction: true,
    dockDensity: 'busy',
    description: 'Lawless prizes and privateer docks.',
  },
];

export function getOceanSector(id: OceanSectorId): OceanSector {
  return OCEAN_SECTORS.find((s) => s.id === id)!;
}

/** Resolve world XZ → sector (nearest of 9). */
export function sectorAtWorld(x: number, z: number): OceanSector {
  let best = OCEAN_SECTORS[4]; // center
  let bestD = Infinity;
  for (const s of OCEAN_SECTORS) {
    const dx = x - s.center.x;
    const dz = z - s.center.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function allSectorIds(): OceanSectorId[] {
  return OCEAN_SECTORS.map((s) => s.id);
}

// ─── Deck stations (play-mode placement on hulls) ────────────────────────────
// Extends ShipRig anchors + dock crew SSOT. Not a second ocean stack.
//   cannon      → gunner   (cannon1…6)
//   harpoon     → sailor   (harpoon1…2)
//   sniper_nest → sailor   (crowsnest)
//   mage_spot   → weatherman (caster1…2)
//   helm        → captain

export type DeckStationKind =
  | 'cannon'
  | 'harpoon'
  | 'sniper_nest'
  | 'mage_spot'
  | 'helm';

export type DockCrewRole = 'sailor' | 'weatherman' | 'gunner' | 'captain';

export type DeckAnchorFamily =
  | 'cannon'
  | 'harpoon'
  | 'crowsnest'
  | 'caster'
  | 'captain';

export interface DeckStationDef {
  id: DeckStationKind;
  name: string;
  description: string;
  crewRole: DockCrewRole;
  anchorFamily: DeckAnchorFamily;
  /** SI footprint on deck (metres). */
  footprintM: { width: number; depth: number; height: number };
  cost: { wood?: number; ore?: number; stone?: number; gold?: number; hemp?: number };
}

export const DECK_STATIONS: readonly DeckStationDef[] = [
  {
    id: 'helm',
    name: 'Helm',
    description: 'Wheel / tiller — captain steers from here.',
    crewRole: 'captain',
    anchorFamily: 'captain',
    footprintM: { width: 0.8, depth: 0.8, height: 1.2 },
    cost: { wood: 4 },
  },
  {
    id: 'cannon',
    name: 'Cannon',
    description: 'Broadside or swivel gun. Gunner station.',
    crewRole: 'gunner',
    anchorFamily: 'cannon',
    footprintM: { width: 1.2, depth: 1.6, height: 1.1 },
    cost: { wood: 8, ore: 6, gold: 20 },
  },
  {
    id: 'harpoon',
    name: 'Harpoon Gun',
    description: 'Deck harpoon for fish, hooks, and boarding lines. Sailor station.',
    crewRole: 'sailor',
    anchorFamily: 'harpoon',
    footprintM: { width: 0.7, depth: 1.4, height: 1.0 },
    cost: { wood: 5, ore: 4, gold: 12 },
  },
  {
    id: 'sniper_nest',
    name: "Sniper Nest",
    description: "Crow’s nest perch — long-range lookout and rifle. Sailor station.",
    crewRole: 'sailor',
    anchorFamily: 'crowsnest',
    footprintM: { width: 1.0, depth: 1.0, height: 0.6 },
    cost: { wood: 10, hemp: 4, gold: 18 },
  },
  {
    id: 'mage_spot',
    name: 'Mage Spot',
    description: 'Caster pad for wind, barrier, and wave work. Weatherman station.',
    crewRole: 'weatherman',
    anchorFamily: 'caster',
    footprintM: { width: 1.0, depth: 1.0, height: 0.2 },
    cost: { wood: 6, stone: 4, gold: 16 },
  },
];

export function getDeckStation(id: DeckStationKind): DeckStationDef {
  return DECK_STATIONS.find((s) => s.id === id)!;
}

/** How many of each station a hull may carry. Matches shipTiers slot counts. */
export interface HullDeckBudget {
  hull: BoatId;
  helm: 0 | 1;
  cannon: number;
  harpoon: number;
  sniperNest: 0 | 1;
  mageSpot: 0 | 1 | 2;
}

export const HULL_DECK_BUDGETS: Readonly<Record<BoatId, HullDeckBudget>> = {
  raft: { hull: 'raft', helm: 1, cannon: 0, harpoon: 0, sniperNest: 0, mageSpot: 0 },
  skiff: { hull: 'skiff', helm: 1, cannon: 1, harpoon: 1, sniperNest: 0, mageSpot: 0 },
  sloop: { hull: 'sloop', helm: 1, cannon: 2, harpoon: 1, sniperNest: 1, mageSpot: 1 },
  brigantine: { hull: 'brigantine', helm: 1, cannon: 4, harpoon: 2, sniperNest: 1, mageSpot: 1 },
  galleon: { hull: 'galleon', helm: 1, cannon: 6, harpoon: 2, sniperNest: 1, mageSpot: 2 },
  manOWar: { hull: 'manOWar', helm: 1, cannon: 6, harpoon: 2, sniperNest: 1, mageSpot: 2 },
};

export function getHullDeckBudget(hull: BoatId): HullDeckBudget {
  return HULL_DECK_BUDGETS[hull];
}

export function budgetForKind(budget: HullDeckBudget, kind: DeckStationKind): number {
  switch (kind) {
    case 'helm':
      return budget.helm;
    case 'cannon':
      return budget.cannon;
    case 'harpoon':
      return budget.harpoon;
    case 'sniper_nest':
      return budget.sniperNest;
    case 'mage_spot':
      return budget.mageSpot;
  }
}

export interface PlacedDeckStation {
  kind: DeckStationKind;
  slotIndex: number;
  enabled: boolean;
}

/** Default loadout: every budgeted slot enabled. */
export function defaultDeckLoadout(hull: BoatId): PlacedDeckStation[] {
  const b = getHullDeckBudget(hull);
  const out: PlacedDeckStation[] = [];
  const push = (kind: DeckStationKind, n: number) => {
    for (let i = 0; i < n; i++) out.push({ kind, slotIndex: i, enabled: true });
  };
  push('helm', b.helm);
  push('cannon', b.cannon);
  push('harpoon', b.harpoon);
  push('sniper_nest', b.sniperNest);
  push('mage_spot', b.mageSpot);
  return out;
}

// ─── Dock kinds (island / RTS harbor) ───────────────────────────────────────

export type DockKind = 'fishing_dock' | 'boat_dock' | 'war_dock' | 'capital_dock';

export interface DockKindDef {
  id: DockKind;
  name: string;
  description: string;
  /** Number of hull berths along the pier. */
  berths: number;
  allowsShipConstruction: boolean;
  /** Deck-station pads on the pier itself (shore batteries / nests). */
  stationPads: readonly DeckStationKind[];
  lengthM: number;
  widthM: number;
  /** Visual recipe — viking prefab vs authored pier. */
  prefab: 'viking_fisherman' | 'shipyard_pier' | 'war_pier' | 'capital';
  cost: { wood: number; stone: number; ore?: number; gold?: number };
  cellSize: { width: number; height: number };
}

export const DOCK_KINDS: readonly DockKindDef[] = [
  {
    id: 'fishing_dock',
    name: 'Fishing Dock',
    description: 'Viking fisherman house + pier. Harpoon and sailor work. No shipyard.',
    berths: 1,
    allowsShipConstruction: false,
    stationPads: ['harpoon', 'helm'],
    lengthM: 14,
    widthM: 4,
    prefab: 'viking_fisherman',
    cost: { wood: 20, stone: 10 },
    cellSize: { width: 3, height: 5 },
  },
  {
    id: 'boat_dock',
    name: 'Boat Dock',
    description: 'Shipyard pier. Construct Skiff through Man o’ War. Raft stays main-panel craft.',
    berths: 3,
    allowsShipConstruction: true,
    stationPads: ['helm', 'cannon'],
    lengthM: 22,
    widthM: 5,
    prefab: 'shipyard_pier',
    cost: { wood: 40, stone: 25, ore: 5, gold: 50 },
    cellSize: { width: 4, height: 6 },
  },
  {
    id: 'war_dock',
    name: 'War Dock',
    description: 'Wide battery pier — cannon pads, sniper nest, mage spot for open-sea sorties.',
    berths: 4,
    allowsShipConstruction: true,
    stationPads: ['cannon', 'cannon', 'sniper_nest', 'mage_spot', 'harpoon'],
    lengthM: 28,
    widthM: 6.5,
    prefab: 'war_pier',
    cost: { wood: 70, stone: 40, ore: 20, gold: 120 },
    cellSize: { width: 5, height: 8 },
  },
  {
    id: 'capital_dock',
    name: 'Capital Dock',
    description: 'Home-island shipyard: viking house + berths for the full hull ladder.',
    berths: 6,
    allowsShipConstruction: true,
    stationPads: ['cannon', 'harpoon', 'sniper_nest', 'mage_spot', 'helm'],
    lengthM: 32,
    widthM: 7,
    prefab: 'capital',
    cost: { wood: 90, stone: 55, ore: 25, gold: 180 },
    cellSize: { width: 6, height: 9 },
  },
];

export function getDockKind(id: DockKind): DockKindDef {
  return DOCK_KINDS.find((d) => d.id === id)!;
}
