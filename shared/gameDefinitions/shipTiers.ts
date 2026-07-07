/**
 * PERSISTENCE / PROGRESSION tier ladder (DB `player_ships.tierId`, build costs,
 * anchor rigs). This is NOT the runtime spawn/render source of truth.
 *
 * >>> Runtime spawn, rendering, physics and gunnery resolve through
 * >>> `shared/gameDefinitions/boatRegistry.ts` (getBoat / resolveBoatId).
 * >>> The two layers are bridged by LEGACY_BOAT_ALIASES there
 * >>> (flotsam→raft, dinghy→skiff, manOWar→galleon, …), so every tierId
 * >>> here maps to a real, spawnable boat.
 *
 * Historical ship tier ladder — describes what ships exist for the persistence
 * layer and which 3D model each tier renders as.
 *
 * Supersedes the three older registries that were drifting apart:
 *   - SHIP_TYPES (sailing.ts)              — kept for crew/cargo/durability legacy fields
 *   - shipTypes (schema.ts)                — kept as a Zod enum for older API payloads
 *   - SHIP_PREFAB_CONFIGS (shipPrefabs.ts) — kept for procedural fallback geometry
 *
 * Each tier maps to:
 *   - a model: either a real GLB path or a procedural builder id
 *   - default cannon count, hp, speed, mass (gameplay numbers)
 *   - a polar profile id (already declared in sailing.ts)
 *   - a ShipRig template (anchor placement) — see client/src/lib/shipRig.ts
 *
 * Tier numbering matches the user's verbal spec:
 *   T1 = "raft / debris / anything that floats"
 *   T2 = "simple raft with sail"
 *   T3 = "the small Quaternius pirate boat with side anchor + 4 barrels"
 *   T4..T7 round out the ladder so the data model isn't degenerate.
 */

/**
 * Anchor ids are duplicated here as a string-literal union to avoid `shared/`
 * importing from `client/`. The authoritative list lives in
 * `client/src/lib/shipRig.ts` (`ShipAnchorId`); a runtime CI assertion in
 * that file keeps the two in lockstep. Any drift surfaces at app boot.
 */
type ShipAnchorId =
  | 'deck' | 'woodhp' | 'captain'
  | 'crew1' | 'crew2' | 'crew3' | 'crew4'
  | 'caster1' | 'caster2'
  | 'crowsnest' | 'cameraCaptainOnDeck'
  | 'cannon1' | 'cannon2' | 'cannon3' | 'cannon4' | 'cannon5' | 'cannon6'
  | 'effect1' | 'effect2' | 'effect3'
  | 'animation1' | 'animation2'
  | 'special1' | 'special2' | 'special3' | 'special4'
  | 'flag';

// ─── Hull source ───────────────────────────────────────────────────────────
//
// A tier either points at a GLB file (loaded by GLTFLoader) or names a
// procedural builder that constructs the hull from primitives. Procedural
// builders are registered in client/src/lib/shipPrefabs.ts.

export type HullSource =
  | { kind: 'glb';        path: string }
  | { kind: 'procedural'; builderId: 'flotsam' | 'sailedRaft' };

// ─── Tier definition ───────────────────────────────────────────────────────

export interface ShipTier {
  /** Stable id used in DB rows, save files, network payloads. */
  id:         ShipTierId;
  tier:       number;          // 1..7
  name:       string;          // human-readable
  description:string;
  hull:       HullSource;
  /** Polar profile key in SHIP_POLAR_PROFILES (see sailing.ts). */
  polarProfile: string;
  /** Gameplay numbers used by the combat/economy systems. */
  stats: {
    crewCapacity:  number;     // captain + crew + casters total slots
    cannonSlots:   number;     // 0..6 — drives how many CannonSpec entries
    casterSlots:   0 | 1 | 2;  // how many of the crew slots are casters
    hpHull:        number;     // total wood hp before sinking
    speedBase:     number;     // m/s reference for the polar curve
    mass:          number;     // kg, fed to ShipPhysics
    cargoCap:      number;
  };
  /**
   * Required anchor ids for this tier — the rig validator will warn if a
   * registered ShipRig is missing any of these. Optional anchors (effects,
   * specials) aren't listed here; they're nice-to-have.
   */
  requiredAnchors: readonly ShipAnchorId[];
  /** Construction recipe — references material ids from items.ts. */
  buildCost: readonly { material: string; qty: number }[];
}

export type ShipTierId =
  | 'flotsam' | 'raft' | 'dinghy'
  | 'sloop' | 'brigantine' | 'galleon' | 'manOWar';

// ─── The ladder ────────────────────────────────────────────────────────────

const REQ_BASIC: readonly ShipAnchorId[]     = ['deck', 'captain', 'flag'];
const REQ_BOAT:  readonly ShipAnchorId[]     = ['deck', 'captain', 'flag', 'woodhp', 'cannon1', 'crew1'];
const REQ_SHIP:  readonly ShipAnchorId[]     = [
  'deck', 'captain', 'flag', 'woodhp', 'crowsnest', 'cameraCaptainOnDeck',
  'cannon1', 'cannon2', 'crew1', 'crew2',
];
const REQ_LARGE: readonly ShipAnchorId[]     = [
  ...REQ_SHIP,
  'cannon3', 'cannon4', 'crew3', 'crew4', 'caster1',
];

export const SHIP_TIERS: Readonly<Record<ShipTierId, ShipTier>> = Object.freeze({
  // ── T1 ── Flotsam ──────────────────────────────────────────────────────
  flotsam: {
    id: 'flotsam', tier: 1,
    name: 'Flotsam',
    description: 'Lashed-together driftwood. No sail, no cannons — just enough to not drown.',
    hull: { kind: 'procedural', builderId: 'flotsam' },
    polarProfile: 'sloop',  // degenerate; mostly drifts with current
    stats: { crewCapacity: 1, cannonSlots: 0, casterSlots: 0, hpHull: 30,  speedBase: 2,  mass: 200,  cargoCap: 5 },
    requiredAnchors: REQ_BASIC,
    buildCost: [{ material: 'oakLog', qty: 5 }],
  },

  // ── T2 ── Raft with sail ───────────────────────────────────────────────
  raft: {
    id: 'raft', tier: 2,
    name: 'Sailed Raft',
    description: 'A square of logs with a sapling mast and a patchwork sail. Coastal only.',
    hull: { kind: 'procedural', builderId: 'sailedRaft' },
    polarProfile: 'sloop',
    stats: { crewCapacity: 2, cannonSlots: 0, casterSlots: 0, hpHull: 60,  speedBase: 5,  mass: 400,  cargoCap: 15 },
    requiredAnchors: REQ_BASIC,
    buildCost: [{ material: 'oakLog', qty: 15 }, { material: 'cloth', qty: 4 }],
  },

  // ── T3 ── Dinghy (the Quaternius small pirate boat) ────────────────────
  // The user's spec: "small boat with anchor on its side, and 4 barrels".
  // Quaternius pirate kit ships this as `ship-pirate-small.glb`.
  dinghy: {
    id: 'dinghy', tier: 3,
    name: 'Pirate Dinghy',
    description: 'A single-masted runner with a side anchor and four barrels of supplies. Your first real ship.',
    hull: { kind: 'glb', path: '/models/ships/ship-pirate-small.glb' },
    polarProfile: 'sloop',
    stats: { crewCapacity: 4, cannonSlots: 1, casterSlots: 0, hpHull: 140, speedBase: 9,  mass: 800,  cargoCap: 35 },
    requiredAnchors: REQ_BOAT,
    buildCost: [{ material: 'mapleLog', qty: 30 }, { material: 'ironOre', qty: 8 }, { material: 'cloth', qty: 6 }],
  },

  // ── T4 ── Sloop ────────────────────────────────────────────────────────
  sloop: {
    id: 'sloop', tier: 4,
    name: 'Sloop',
    description: 'Fast single-masted vessel. Two cannons per broadside, room for crew and a magic-user.',
    hull: { kind: 'glb', path: '/models/ships/ship-small.glb' },
    polarProfile: 'sloop',
    stats: { crewCapacity: 6, cannonSlots: 2, casterSlots: 1, hpHull: 240, speedBase: 12, mass: 1500, cargoCap: 60 },
    requiredAnchors: REQ_SHIP,
    buildCost: [{ material: 'ashLog', qty: 80 }, { material: 'ironOre', qty: 30 }, { material: 'leather', qty: 20 }],
  },

  // ── T5 ── Brigantine ───────────────────────────────────────────────────
  brigantine: {
    id: 'brigantine', tier: 5,
    name: 'Brigantine',
    description: 'Two-masted, four cannons, full crew complement. The workhorse of the open sea.',
    hull: { kind: 'glb', path: '/models/ships/ship-medium.glb' },
    polarProfile: 'sloop', // TODO: dedicated brigantine polar curve
    stats: { crewCapacity: 8, cannonSlots: 4, casterSlots: 1, hpHull: 420, speedBase: 14, mass: 2400, cargoCap: 120 },
    requiredAnchors: REQ_LARGE,
    buildCost: [
      { material: 'ironwoodLog', qty: 150 },
      { material: 'mithrilOre',  qty: 20 },
      { material: 'scaleHide',   qty: 30 },
    ],
  },

  // ── T6 ── Galleon ──────────────────────────────────────────────────────
  galleon: {
    id: 'galleon', tier: 6,
    name: 'Galleon',
    description: 'Six cannons, two casters, captain on the wheel. A floating fortress.',
    hull: { kind: 'glb', path: '/models/ships/ship-large.glb' },
    polarProfile: 'sloop',
    stats: { crewCapacity: 10, cannonSlots: 6, casterSlots: 2, hpHull: 720, speedBase: 11, mass: 3800, cargoCap: 240 },
    requiredAnchors: [...REQ_LARGE, 'cannon5', 'cannon6', 'caster2'],
    buildCost: [
      { material: 'worldtreeLog', qty: 300 },
      { material: 'adamantiteOre', qty: 50 },
      { material: 'dragonHide',    qty: 20 },
    ],
  },

  // ── T7 ── Man o' War (endgame) ─────────────────────────────────────────
  manOWar: {
    id: 'manOWar', tier: 7,
    name: "Man o' War",
    description: 'A capital warship. Maximum loadout, capital-ship handling.',
    hull: { kind: 'glb', path: '/models/ships/ship-pirate-large.glb' },
    polarProfile: 'sloop',
    stats: { crewCapacity: 10, cannonSlots: 6, casterSlots: 2, hpHull: 1100, speedBase: 10, mass: 5500, cargoCap: 320 },
    requiredAnchors: [...REQ_LARGE, 'cannon5', 'cannon6', 'caster2', 'special1', 'special2'],
    buildCost: [
      { material: 'worldtreeLog', qty: 600 },
      { material: 'adamantiteOre', qty: 120 },
      { material: 'dragonHide',    qty: 60 },
    ],
  },
});

// ─── Helpers ───────────────────────────────────────────────────────────────

export const SHIP_TIER_IDS: readonly ShipTierId[] =
  Object.keys(SHIP_TIERS) as ShipTierId[];

export function getTier(id: ShipTierId): ShipTier {
  return SHIP_TIERS[id];
}

export function getTiersByLevel(level: number): ShipTier[] {
  return SHIP_TIER_IDS
    .map(id => SHIP_TIERS[id])
    .filter(t => t.tier === level);
}
