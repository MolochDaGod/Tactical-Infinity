// ============================================================
// CANONICAL BOAT REGISTRY — single source of truth for every
// PLAYABLE boat at runtime (rendering + physics + gunnery).
// ============================================================
// One entry per boat, keyed by the canonical id set:
//     raft → skiff → sloop → brigantine → galleon
// This set is shared by the gameplay systems that were previously
// scattered and inconsistent:
//   - SHIP_TYPES         (stats: crew/cargo/speed/durability/name/tier)
//   - SHIP_CANNON_CONFIGS (gunnery mounts + armor + turn bonus)
//   - SHIP_POLAR_PROFILES (sailing polars)
//   - ship model GLB paths
//   - ship physics profiles
//
// `getBoat(id)` returns ONE object carrying everything a consumer
// needs. Every legacy / alternate name (pirateSmall, medium, large,
// warship, frigate, manOWar, flotsam, dinghy, ghost, wreck, small…)
// maps onto a canonical id via LEGACY_BOAT_ALIASES + resolveBoatId,
// so any historical id still resolves to a real, spawnable boat.
//
// NOTE: the richer persistence/tier ladder in `shipTiers.ts`
// (flotsam…manOWar with anchor rigs + build costs) is the DB /
// progression layer. Runtime spawn (OpenWaterSailing, ShipEditor,
// physics, NPC ships) resolves through THIS file. The two are bridged
// by the alias map below.

import {
  SHIP_TYPES,
  SHIP_CANNON_CONFIGS,
  type Ship,
  type ShipCannonConfig,
} from './sailing';

export type BoatId = 'raft' | 'skiff' | 'sloop' | 'brigantine' | 'galleon';

export const BOAT_IDS: readonly BoatId[] = ['raft', 'skiff', 'sloop', 'brigantine', 'galleon'] as const;

/** The boat every player gets when nothing else is specified. */
export const DEFAULT_BOAT_ID: BoatId = 'sloop';

// Plain-data physics profile (mirrors ShipPhysicsConfig in
// client/src/lib/shipPhysics.ts). Kept here so the ONE registry owns
// the physics numbers; shipPhysics.ts merges these over its defaults.
export interface BoatPhysicsProfile {
  mass?: number;
  stability?: number;
  capsizeThreshold?: number;
  capsizeRecoveryRate?: number;
  waterResistance?: number;
  rollDamping?: number;
  pitchDamping?: number;
  waveResponseScale?: number;
  maxRollAngle?: number;
  maxPitchAngle?: number;
  keelBallastWeight?: number;
  keelDepthFraction?: number;
}

// Render + physics layer, per canonical boat. Stats/cannon/name/tier
// are composed from sailing.ts so we never duplicate those literals.
interface BoatRenderProfile {
  /** GLB under public/ — verified to exist on disk. */
  modelPath: string;
  /** Uniform scale applied to the loaded model in the sailing scene. */
  modelScale: number;
  physics: BoatPhysicsProfile;
}

const BOAT_RENDER: Record<BoatId, BoatRenderProfile> = {
  raft: {
    modelPath: '/models/ships/ship-small.glb',
    modelScale: 2.5,
    physics: {
      mass: 300,
      stability: 0.8,
      waveResponseScale: 1.1,
      capsizeThreshold: Math.PI / 3.5,
      rollDamping: 0.9,
      capsizeRecoveryRate: 0.75,
      keelBallastWeight: 0.1,
      keelDepthFraction: 0.1,
    },
  },
  skiff: {
    modelPath: '/models/ships/ship-pirate-small.glb',
    modelScale: 3,
    physics: {
      mass: 500,
      stability: 0.85,
      waveResponseScale: 0.95,
      capsizeThreshold: Math.PI / 3.2,
      rollDamping: 0.92,
      capsizeRecoveryRate: 0.72,
      keelBallastWeight: 0.18,
      keelDepthFraction: 0.15,
    },
  },
  sloop: {
    modelPath: '/models/ships/ship-medium.glb',
    modelScale: 3,
    physics: {
      mass: 800,
      stability: 0.88,
      waveResponseScale: 0.8,
      capsizeThreshold: Math.PI / 3,
      rollDamping: 0.94,
      capsizeRecoveryRate: 0.7,
      keelBallastWeight: 0.25,
      keelDepthFraction: 0.2,
    },
  },
  brigantine: {
    modelPath: '/models/ships/ship-pirate-medium.glb',
    modelScale: 3,
    physics: {
      mass: 1500,
      stability: 0.85,
      waveResponseScale: 0.9,
      capsizeThreshold: Math.PI / 3,
      keelBallastWeight: 0.3,
      keelDepthFraction: 0.2,
    },
  },
  galleon: {
    modelPath: '/models/ships/ship-large.glb',
    modelScale: 3.2,
    physics: {
      mass: 3000,
      stability: 0.95,
      waveResponseScale: 0.6,
      capsizeThreshold: Math.PI / 2.5,
      keelBallastWeight: 0.4,
      keelDepthFraction: 0.2,
    },
  },
};

// Every historical / alternate ship id → canonical boat.
// Sources: shipPrefabs SHIP_MODEL_PATHS keys, shipPhysics stray ids,
// worldMap NPC types, shipTiers.ts persistence ladder, editor ids.
export const LEGACY_BOAT_ALIASES: Readonly<Record<string, BoatId>> = Object.freeze({
  // shipPrefabs SHIP_MODEL_PATHS keys / worldMap NPC types
  // NOTE: `small` is the ship-small.glb model, which IS the raft hull
  // (raft.modelPath), so it resolves to raft — not skiff.
  small: 'raft',
  medium: 'sloop',
  large: 'galleon',
  pirateSmall: 'skiff',
  pirateMedium: 'brigantine',
  pirateLarge: 'galleon',
  ghost: 'brigantine',
  wreck: 'sloop',
  // rowboats
  rowSmall: 'raft',
  rowLarge: 'raft',
  // shipPhysics stray ids
  warship: 'galleon',
  frigate: 'brigantine',
  manOWar: 'galleon',
  manowar: 'galleon',
  // shipTiers.ts persistence ladder
  flotsam: 'raft',
  dinghy: 'skiff',
});

/** Resolve ANY id (canonical, legacy, unknown, null) to a canonical boat id. */
export function resolveBoatId(id: string | null | undefined): BoatId {
  if (id && (BOAT_IDS as readonly string[]).includes(id)) return id as BoatId;
  if (id && LEGACY_BOAT_ALIASES[id]) return LEGACY_BOAT_ALIASES[id];
  return DEFAULT_BOAT_ID;
}

export interface BoatDef {
  id: BoatId;
  name: string;
  tier: number;
  modelPath: string;
  modelScale: number;
  physics: BoatPhysicsProfile;
  cannon: ShipCannonConfig;
  stats: Ship;
}

/** THE single lookup. Accepts any id/alias; always returns a real boat. */
export function getBoat(id: string | null | undefined): BoatDef {
  const boatId = resolveBoatId(id);
  const render = BOAT_RENDER[boatId];
  const stats = SHIP_TYPES[boatId];
  const cannon = SHIP_CANNON_CONFIGS[boatId] ?? SHIP_CANNON_CONFIGS[DEFAULT_BOAT_ID];
  return {
    id: boatId,
    name: stats?.name ?? boatId,
    tier: stats?.tier ?? 1,
    modelPath: render.modelPath,
    modelScale: render.modelScale,
    physics: render.physics,
    cannon,
    stats,
  };
}

export function getBoatModelPath(id: string | null | undefined): string {
  return BOAT_RENDER[resolveBoatId(id)].modelPath;
}

export function getBoatPhysicsProfile(id: string | null | undefined): BoatPhysicsProfile {
  return BOAT_RENDER[resolveBoatId(id)].physics;
}

/** Ordered list of full boat defs for menus / editors. */
export function allBoats(): BoatDef[] {
  return BOAT_IDS.map((id) => getBoat(id));
}
