/**
 * Turtle Event — Discworld-style A'Tuin event map.
 *
 * Binary: models/events/turtle/turtle_event.glb
 * Arena:  models/events/arena/arena3.glb (sector-held combat pad)
 *
 * Smart meshes (isolate — never place whole multipack as one entity without root):
 *   ATuin.005_Turtle_0          — turtle body (physics collider)
 *   RootTurtle_0250             — skeleton root for rise/animate
 *   OnlyFlatWorld1_World_0      — island disc (walkable land)
 *   OnlyFlatWorld1_Water_0      — water plane (shader/texture)
 *   OnlyFlatWorld1_Magic_0      — magic rim
 *   Plane.097_SemiTransparent_0 — water / atmosphere plane
 *   Discworld                   — compound disc group
 *
 * Sectors: event is launched from held ocean sectors; turtle rises from water
 * with islands (treasures, bosses, crystal / rare resource nodes) on the disc.
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

export const TURTLE_EVENT_PACK = {
  key: "turtle_event",
  r2Key: "models/events/turtle/turtle_event.glb",
  cdn: `${WARLORDS_CDN}/models/events/turtle/turtle_event.glb`,
  local: "/models/events/turtle/turtle_event.glb",
  targetHeightM: 28,
  roles: ["event", "turtle", "island", "sector", "boss", "water"],
  meshes: {
    turtleBody: "ATuin.005_Turtle_0",
    turtleRoot: "RootTurtle_0250",
    islandDisc: "OnlyFlatWorld1_World_0",
    water: "OnlyFlatWorld1_Water_0",
    magicRim: "OnlyFlatWorld1_Magic_0",
    bottom: "OnlyFlatWorld1_BottomOfFlatWorld_0",
    waterPlane: "Plane.097_SemiTransparent_0",
    discworld: "Discworld",
  },
} as const;

export const ARENA3_PACK = {
  key: "arena3",
  r2Key: "models/events/arena/arena3.glb",
  cdn: `${WARLORDS_CDN}/models/events/arena/arena3.glb`,
  local: "/models/events/arena/arena3.glb",
  targetHeightM: 12,
  roles: ["event", "arena", "sector", "pvp", "boss"],
} as const;

// ── Rise animation (physics-friendly Y offset) ─────────────────────────────

export type TurtleRisePhase =
  | "submerged"
  | "rising"
  | "breaching"
  | "surface"
  | "held";

export interface TurtleRiseConfig {
  /** Seconds fully underwater before rise starts */
  holdSubmergedSec: number;
  /** Seconds to surface */
  riseDurationSec: number;
  /** Local Y of shell when submerged (below water plane) */
  submergedY: number;
  /** Local Y when fully up (islands playable) */
  surfaceY: number;
  /** Water plane local Y (shader) */
  waterY: number;
  /** Optional bob amplitude once held */
  surfaceBobM: number;
  surfaceBobHz: number;
}

export const DEFAULT_TURTLE_RISE: TurtleRiseConfig = {
  holdSubmergedSec: 2,
  riseDurationSec: 18,
  submergedY: -14,
  surfaceY: 0,
  waterY: -0.5,
  surfaceBobM: 0.35,
  surfaceBobHz: 0.08,
};

export function turtleRisePhase(
  elapsedSec: number,
  cfg: TurtleRiseConfig = DEFAULT_TURTLE_RISE,
): TurtleRisePhase {
  if (elapsedSec < cfg.holdSubmergedSec) return "submerged";
  const t = elapsedSec - cfg.holdSubmergedSec;
  if (t < cfg.riseDurationSec * 0.55) return "rising";
  if (t < cfg.riseDurationSec) return "breaching";
  if (t < cfg.riseDurationSec + 3) return "surface";
  return "held";
}

/**
 * Smoothstep rise of turtle root Y. Physics bodies should track this Y each tick.
 */
export function turtleRiseY(
  elapsedSec: number,
  cfg: TurtleRiseConfig = DEFAULT_TURTLE_RISE,
): number {
  if (elapsedSec <= cfg.holdSubmergedSec) return cfg.submergedY;
  const t = (elapsedSec - cfg.holdSubmergedSec) / cfg.riseDurationSec;
  if (t >= 1) {
    const bob =
      Math.sin(elapsedSec * Math.PI * 2 * cfg.surfaceBobHz) * cfg.surfaceBobM;
    return cfg.surfaceY + bob;
  }
  // smoothstep
  const s = t * t * (3 - 2 * t);
  return cfg.submergedY + (cfg.surfaceY - cfg.submergedY) * s;
}

// ── Island pads on the disc (local m from disc center) ──────────────────────

export type TurtleIslandPad = {
  id: string;
  label: string;
  /** Local XZ on flat world disc */
  pos: { x: number; z: number };
  radiusM: number;
  /** Content seeds */
  treasures: number;
  bosses: number;
  /** Harvest def ids */
  resourceNodes: string[];
  rareChance: number;
};

/**
 * Content islands on the turtle's back once surfaced.
 * Harvest defs: crystal + rare materials + bonus ore.
 */
export const TURTLE_ISLAND_PADS: TurtleIslandPad[] = [
  {
    id: "north_spire",
    label: "Crystal Spire",
    pos: { x: 0, z: 12 },
    radiusM: 5,
    treasures: 2,
    bosses: 0,
    resourceNodes: ["crystal_node", "rare_ore_node", "gold_ore_node"],
    rareChance: 0.35,
  },
  {
    id: "east_vault",
    label: "Treasure Vault",
    pos: { x: 14, z: 2 },
    radiusM: 4.5,
    treasures: 3,
    bosses: 0,
    resourceNodes: ["gold_ore_node", "iron_ore_node"],
    rareChance: 0.25,
  },
  {
    id: "south_boss",
    label: "Boss Shell",
    pos: { x: 0, z: -13 },
    radiusM: 6,
    treasures: 1,
    bosses: 1,
    resourceNodes: ["crystal_node", "rare_ore_node"],
    rareChance: 0.4,
  },
  {
    id: "west_garden",
    label: "Bonus Grove",
    pos: { x: -13, z: 0 },
    radiusM: 5,
    treasures: 1,
    bosses: 0,
    resourceNodes: ["herb_moonpetal", "berry_bush", "crystal_node"],
    rareChance: 0.2,
  },
  {
    id: "center_altar",
    label: "Disc Altar",
    pos: { x: 0, z: 0 },
    radiusM: 3.5,
    treasures: 1,
    bosses: 1,
    resourceNodes: ["rare_ore_node", "crystal_node", "gold_ore_node"],
    rareChance: 0.5,
  },
];

/** Boss NPC models for turtle event (catalog keys / placeholders). */
export const TURTLE_EVENT_BOSSES = [
  { id: "turtle_shell_warden", model: "box_hero", name: "Shell Warden", scale: 2.2 },
  { id: "disc_tyrant", model: "box_hero", name: "Disc Tyrant", scale: 2.8 },
] as const;

/** Treasure chest props */
export const TURTLE_TREASURE_PROPS = ["chest", "knights_chest", "dungeon_chest"] as const;

// ── Sector hold → event launch ─────────────────────────────────────────────

/**
 * Sectors that can host / launch the turtle event when "held".
 * Arena3 is the combat pad; turtle_event is the world shell that rises.
 */
export const TURTLE_EVENT_SECTORS = [2, 4, 6, 8] as const;

export function canLaunchTurtleEvent(heldSectorIndex: number): boolean {
  return (TURTLE_EVENT_SECTORS as readonly number[]).includes(heldSectorIndex);
}

export interface TurtleEventLaunch {
  eventId: "event-turtle-islands";
  turtleModel: string;
  arenaModel: string;
  sectorIndex: number;
  rise: TurtleRiseConfig;
  pads: TurtleIslandPad[];
  waterMesh: string;
  turtlePhysicsMesh: string;
  islandWalkMesh: string;
}

export function buildTurtleEventLaunch(sectorIndex: number): TurtleEventLaunch | null {
  if (!canLaunchTurtleEvent(sectorIndex)) return null;
  return {
    eventId: "event-turtle-islands",
    turtleModel: TURTLE_EVENT_PACK.key,
    arenaModel: ARENA3_PACK.key,
    sectorIndex,
    rise: DEFAULT_TURTLE_RISE,
    pads: TURTLE_ISLAND_PADS,
    waterMesh: TURTLE_EVENT_PACK.meshes.water,
    turtlePhysicsMesh: TURTLE_EVENT_PACK.meshes.turtleBody,
    islandWalkMesh: TURTLE_EVENT_PACK.meshes.islandDisc,
  };
}

/** Scatter harvestables for one pad (world positions after disc is up). */
export function padHarvestSpawns(
  pad: TurtleIslandPad,
  discOrigin: { x: number; y: number; z: number },
  yaw = 0,
): { defId: string; x: number; y: number; z: number }[] {
  const out: { defId: string; x: number; y: number; z: number }[] = [];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  pad.resourceNodes.forEach((defId, i) => {
    const a = (i / Math.max(1, pad.resourceNodes.length)) * Math.PI * 2;
    const r = pad.radiusM * 0.55;
    const lx = pad.pos.x + Math.cos(a) * r;
    const lz = pad.pos.z + Math.sin(a) * r;
    out.push({
      defId,
      x: discOrigin.x + lx * c - lz * s,
      y: discOrigin.y + 0.2,
      z: discOrigin.z + lx * s + lz * c,
    });
  });
  return out;
}
