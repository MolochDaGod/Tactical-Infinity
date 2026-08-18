/**
 * Fleet asset catalog — boats, rafts, airships, mounts, back-slot items.
 * Viewing SSOT for /fleet-assets. Binaries stay on CDN / existing model paths.
 * Do not dump a second copy of every GLB into git.
 */

export type FleetAssetKind = 'boat' | 'raft' | 'pier' | 'airship' | 'mount' | 'back_slot';

export interface DeckColliderBake {
  /** Box half-extents in metres (X beam, Y thickness, Z length). */
  half: [number, number, number];
  /** Center offset from grounded origin. */
  offset: [number, number, number];
}

export interface FleetAssetEntry {
  id: string;
  kind: FleetAssetKind;
  name: string;
  /** Local public path and/or CDN. Viewer tries local first. */
  url: string;
  cdn?: string;
  /** Isolate this node from a multipack (pier kit). */
  isolateNode?: string;
  /** SI size after normalize. */
  lengthM: number;
  beamM?: number;
  heightM: number;
  /** Fit axis — hulls use length, mounts use height. */
  fitAxis: 'length' | 'height' | 'max';
  deckCollider?: DeckColliderBake;
  notes?: string;
}

const CDN = 'https://assets.grudge-studio.com';

export const FLEET_ASSET_CATALOG: readonly FleetAssetEntry[] = [
  // Rafts — only real raft meshes. ship-small.glb is a boat, not a raft.
  {
    id: 'short_plank',
    kind: 'raft',
    name: 'Plank Raft',
    url: '/models/fleet/rafts/short_plank.glb',
    lengthM: 2.4,
    beamM: 1.2,
    heightM: 0.45,
    fitAxis: 'length',
    deckCollider: { half: [0.52, 0.06, 1.05], offset: [0, 0.38, 0] },
    notes: 'Short · beach craft. Most basic.',
  },
  {
    id: 'short_logs',
    kind: 'raft',
    name: 'Log Raft',
    url: '/models/fleet/rafts/short_logs.glb',
    lengthM: 3.2,
    beamM: 1.45,
    heightM: 0.65,
    fitAxis: 'length',
    deckCollider: { half: [0.62, 0.07, 1.38], offset: [0, 0.46, 0] },
    notes: 'Short · dock upgrade.',
  },
  {
    id: 'short_sail',
    kind: 'raft',
    name: 'Sailed Short Raft',
    url: '/models/fleet/rafts/short_sail.glb',
    lengthM: 3.6,
    beamM: 1.55,
    heightM: 2.4,
    fitAxis: 'length',
    deckCollider: { half: [0.66, 0.07, 1.5], offset: [0, 0.5, 0] },
    notes: 'Short hull + mast + sail.',
  },
  {
    id: 'long_complete',
    kind: 'raft',
    name: 'Long Work Raft',
    url: '/models/fleet/rafts/long_complete.glb',
    lengthM: 6.5,
    beamM: 2.05,
    heightM: 1.35,
    fitAxis: 'length',
    deckCollider: { half: [0.88, 0.08, 2.75], offset: [0, 0.58, 0] },
    notes: 'Long · dock workshop.',
  },

  // Modular pier kit (wooden_pier_22_mb)
  {
    id: 'pier_walk_a',
    kind: 'pier',
    name: 'Pier Walkway A',
    url: '/models/fleet/piers/wooden_pier_kit.glb',
    isolateNode: '01',
    lengthM: 4,
    beamM: 2.2,
    heightM: 1.1,
    fitAxis: 'length',
    deckCollider: { half: [1.0, 0.08, 1.9], offset: [0, 0.72, 0] },
    notes: 'Straight module.',
  },
  {
    id: 'pier_walk_b',
    kind: 'pier',
    name: 'Pier Walkway B',
    url: '/models/fleet/piers/wooden_pier_kit.glb',
    isolateNode: '01_1',
    lengthM: 4,
    beamM: 2.2,
    heightM: 1.1,
    fitAxis: 'length',
    deckCollider: { half: [1.0, 0.08, 1.9], offset: [0, 0.72, 0] },
  },
  {
    id: 'pier_walk_c',
    kind: 'pier',
    name: 'Pier Walkway C',
    url: '/models/fleet/piers/wooden_pier_kit.glb',
    isolateNode: '01_2',
    lengthM: 4,
    beamM: 2.2,
    heightM: 1.1,
    fitAxis: 'length',
    deckCollider: { half: [1.0, 0.08, 1.9], offset: [0, 0.72, 0] },
  },
  {
    id: 'pier_join_a',
    kind: 'pier',
    name: 'Pier Connector A',
    url: '/models/fleet/piers/wooden_pier_kit.glb',
    isolateNode: '02',
    lengthM: 3.2,
    beamM: 2.4,
    heightM: 1.1,
    fitAxis: 'length',
    deckCollider: { half: [1.1, 0.08, 1.5], offset: [0, 0.72, 0] },
    notes: 'Mid / T connector.',
  },
  {
    id: 'pier_end_a',
    kind: 'pier',
    name: 'Pier End A',
    url: '/models/fleet/piers/wooden_pier_kit.glb',
    isolateNode: '03',
    lengthM: 3.4,
    beamM: 2.6,
    heightM: 1.2,
    fitAxis: 'length',
    deckCollider: { half: [1.15, 0.08, 1.55], offset: [0, 0.75, 0] },
    notes: 'Seaward cap.',
  },
  {
    id: 'pier_end_b',
    kind: 'pier',
    name: 'Pier End B',
    url: '/models/fleet/piers/wooden_pier_kit.glb',
    isolateNode: '03_1',
    lengthM: 3.4,
    beamM: 2.6,
    heightM: 1.2,
    fitAxis: 'length',
    deckCollider: { half: [1.15, 0.08, 1.55], offset: [0, 0.75, 0] },
  },

  // Boats
  {
    id: 'rowboat',
    kind: 'boat',
    name: 'Rowboat',
    url: '/models/fleet/boats/rowboat.glb',
    lengthM: 3.6,
    beamM: 1.35,
    heightM: 0.85,
    fitAxis: 'length',
    deckCollider: { half: [0.52, 0.05, 1.35], offset: [0, 0.28, 0] },
    notes: 'Stylized low-poly rowboat + two paddles. Not a raft.',
  },
  {
    id: 'fishermans_boat',
    kind: 'boat',
    name: "Fisherman's Boat",
    url: '/models/fleet/boats/fishermans_boat.glb',
    lengthM: 4.8,
    beamM: 1.6,
    heightM: 1.35,
    fitAxis: 'length',
    deckCollider: { half: [0.68, 0.06, 1.95], offset: [0, 0.42, 0] },
    notes: 'Fishing-profession hull (Journeyman 26). Upgraded rowboat — not a warship ladder id.',
  },
  {
    id: 'skiff',
    kind: 'boat',
    name: 'Pirate Skiff',
    url: '/models/ships/ship-pirate-small.glb',
    lengthM: 8,
    beamM: 2.6,
    heightM: 3.2,
    fitAxis: 'length',
    deckCollider: { half: [1.1, 0.1, 3.2], offset: [0, 1.05, 0] },
  },
  {
    id: 'sloop',
    kind: 'boat',
    name: 'Sloop',
    url: '/models/ships/ship-medium.glb',
    lengthM: 12,
    beamM: 3.4,
    heightM: 4.4,
    fitAxis: 'length',
    deckCollider: { half: [1.4, 0.1, 4.6], offset: [0, 1.2, 0] },
  },
  {
    id: 'brigantine',
    kind: 'boat',
    name: 'Brigantine',
    url: '/models/ships/ship-pirate-medium.glb',
    lengthM: 18,
    beamM: 4.4,
    heightM: 5.6,
    fitAxis: 'length',
    deckCollider: { half: [1.8, 0.12, 7.2], offset: [0, 1.4, 0] },
  },
  {
    id: 'galleon',
    kind: 'boat',
    name: 'Galleon',
    url: '/models/ships/ship-large.glb',
    lengthM: 28,
    beamM: 6.0,
    heightM: 7.2,
    fitAxis: 'length',
    deckCollider: { half: [2.5, 0.14, 11], offset: [0, 1.6, 0] },
  },
  {
    id: 'manOWar',
    kind: 'boat',
    name: "Man o' War",
    url: '/models/ships/ship-pirate-large.glb',
    lengthM: 36,
    beamM: 7.0,
    heightM: 8.5,
    fitAxis: 'length',
    deckCollider: { half: [2.9, 0.16, 14], offset: [0, 1.75, 0] },
  },
  {
    id: 'cinema-pirate',
    kind: 'boat',
    name: 'Cinema Pirate',
    url: '/models/cinema/stylized-pirate-ship.prod.glb',
    lengthM: 14,
    beamM: 4.0,
    heightM: 6,
    fitAxis: 'length',
    deckCollider: { half: [1.6, 0.1, 5.4], offset: [0, 1.3, 0] },
    notes: 'Look mesh — local cinema GLB.',
  },

  // Airships
  {
    id: 'airship-placeholder',
    kind: 'airship',
    name: 'Airship (CDN / pending)',
    url: `${CDN}/models/vehicles/airships/skyship.glb`,
    cdn: `${CDN}/models/vehicles/airships/skyship.glb`,
    lengthM: 18,
    heightM: 8,
    fitAxis: 'length',
    notes: 'CDN pending — not a raft.',
  },

  // Mounts (Toon RTS cavalry)
  {
    id: 'mount-human',
    kind: 'mount',
    name: 'Warhorse',
    url: `${CDN}/models/vehicles/mounts/human/cavalry.glb`,
    cdn: `${CDN}/models/vehicles/mounts/human/cavalry.glb`,
    lengthM: 2.4,
    heightM: 1.9,
    fitAxis: 'height',
  },
  {
    id: 'mount-barbarian',
    kind: 'mount',
    name: 'Clan Steed',
    url: `${CDN}/models/vehicles/mounts/barbarian/cavalry.glb`,
    cdn: `${CDN}/models/vehicles/mounts/barbarian/cavalry.glb`,
    lengthM: 2.5,
    heightM: 1.95,
    fitAxis: 'height',
  },
  {
    id: 'mount-elf',
    kind: 'mount',
    name: 'Elven Steed',
    url: `${CDN}/models/vehicles/mounts/elf/cavalry.glb`,
    cdn: `${CDN}/models/vehicles/mounts/elf/cavalry.glb`,
    lengthM: 2.3,
    heightM: 1.85,
    fitAxis: 'height',
  },
  {
    id: 'mount-dwarf',
    kind: 'mount',
    name: 'Mountain Pony',
    url: `${CDN}/models/vehicles/mounts/dwarf/cavalry.glb`,
    cdn: `${CDN}/models/vehicles/mounts/dwarf/cavalry.glb`,
    lengthM: 2.0,
    heightM: 1.5,
    fitAxis: 'height',
  },
  {
    id: 'mount-orc',
    kind: 'mount',
    name: 'Warg',
    url: `${CDN}/models/vehicles/mounts/orc/cavalry.glb`,
    cdn: `${CDN}/models/vehicles/mounts/orc/cavalry.glb`,
    lengthM: 2.3,
    heightM: 1.8,
    fitAxis: 'height',
  },
  {
    id: 'mount-undead',
    kind: 'mount',
    name: 'Skeletal Steed',
    url: `${CDN}/models/vehicles/mounts/undead/cavalry.glb`,
    cdn: `${CDN}/models/vehicles/mounts/undead/cavalry.glb`,
    lengthM: 2.3,
    heightM: 1.85,
    fitAxis: 'height',
  },

  // Back-slot (display / paperdoll)
  {
    id: 'back-cloak',
    kind: 'back_slot',
    name: 'Cloak',
    url: `${CDN}/models/equipment/back/cloak.glb`,
    lengthM: 0.6,
    heightM: 1.2,
    fitAxis: 'height',
    notes: 'grudge6 back slot — mesh_ids cloak',
  },
  {
    id: 'back-quiver',
    kind: 'back_slot',
    name: 'Quiver',
    url: `${CDN}/models/equipment/back/quiver.glb`,
    lengthM: 0.25,
    heightM: 0.7,
    fitAxis: 'height',
  },
  {
    id: 'back-pack',
    kind: 'back_slot',
    name: 'Travel Pack',
    url: `${CDN}/models/equipment/back/backpack.glb`,
    lengthM: 0.4,
    heightM: 0.6,
    fitAxis: 'height',
  },
];

export const FLEET_ASSET_KINDS: readonly FleetAssetKind[] = [
  'raft',
  'boat',
  'pier',
  'airship',
  'mount',
  'back_slot',
];

export function fleetAssetsByKind(kind: FleetAssetKind): FleetAssetEntry[] {
  return FLEET_ASSET_CATALOG.filter((a) => a.kind === kind);
}

export function getFleetAsset(id: string): FleetAssetEntry | undefined {
  return FLEET_ASSET_CATALOG.find((a) => a.id === id);
}
