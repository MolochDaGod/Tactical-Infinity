/**
 * Camp / RTS building SSOT — shared types for Tactical Infinity + RTS-Grudge.
 * Pattern-accurate camp systems: UI, selection, costs, delivery, claim, defense.
 *
 * Layers:
 *   Definitions  → this package (+ ObjectStore master-buildings.json)
 *   Binaries     → assets.grudge-studio.com (UF RTS / grudge6 / nature)
 *   Player state → Railway (claim, placed, roster) — never D1
 */

export type ResourceCost = {
  wood?: number;
  stone?: number;
  gold?: number;
  ore?: number;
  fiber?: number;
  leather?: number;
};

export type BuildingCategory =
  | "defense"
  | "economy"
  | "military"
  | "housing"
  | "production"
  | "special"
  | "structure";

export type BuildingFaction =
  | "neutral"
  | "crusade"
  | "fabled"
  | "legion"
  | "pirate"
  | "barbarian";

export type BuildingAge = "first" | "second" | "third";

export type BuildingFunction =
  | {
      kind: "spawn_units";
      unitIds: string[];
      count?: number;
      trainTimeSec?: number;
      trainCost?: ResourceCost;
    }
  | {
      kind: "produce_items";
      recipeIds: string[];
    }
  | {
      kind: "spawn_resources";
      nodes: { type: string; count: number }[];
    }
  | {
      kind: "turret";
      profileId: string;
    }
  | {
      kind: "storage";
      slots: number;
    }
  | {
      kind: "assign_role";
      roles: Array<"harvest" | "craft" | "defend" | "patrol" | "follow">;
    }
  | {
      kind: "claim_anchor";
      radiusM: number;
    }
  | {
      kind: "food";
      foodPerMinute?: number;
    }
  | {
      kind: "vehicle";
      vehicleIds: string[];
    };

export interface BuildingMeshRef {
  importer: "gltf" | "fbx" | "procedural";
  /** Relative CDN key or local public path */
  path: string;
  targetHeightM: number;
  iconKey?: string;
  /** Multi-mesh pack isolation */
  meshName?: string;
}

export interface BuildingCatalogEntry {
  /** Canonical id: bld.<family>.<age?>.l<level> */
  id: string;
  /** Legacy ids from TI / RTS-Grudge / Open */
  aliases?: string[];
  name: string;
  description: string;
  category: BuildingCategory;
  faction: BuildingFaction;
  age: BuildingAge;
  level: number;
  maxLevel: number;
  cost: ResourceCost;
  /** Grid cells [w, d] */
  sizeCells: [number, number];
  mesh: BuildingMeshRef;
  functions: BuildingFunction[];
  /** Requires claim flag build rights (structures/hub) */
  claimGated: boolean;
  /** Field quick-place (campfire/torch) — never claim-gated */
  fieldQuickCraft?: boolean;
  unlockRequirement?: string;
  ui: {
    emoji: string;
    tab: "camp" | "military" | "economy" | "defense" | "housing" | "special";
    sort: number;
  };
}

export type UnitRole = "melee" | "ranged" | "magic" | "worker" | "cavalry" | "siege" | "captain";

export interface UnitCatalogEntry {
  id: string;
  name: string;
  role: UnitRole;
  faction: BuildingFaction;
  /** Buildings that can train this unit (canonical building ids) */
  trainedAt: string[];
  cost: ResourceCost;
  trainTimeSec: number;
  mesh: BuildingMeshRef;
  /** Profession seeds for auto-harvest / craft */
  defaultProfessions?: string[];
  maxLevel: number;
}

export type TurretProfileId =
  | "shore_cannon"
  | "watchtower_bow"
  | "fire_catapult"
  | "guard_tower";

export interface TurretProfile {
  id: TurretProfileId;
  name: string;
  range: number;
  fireRate: number;
  damage: number;
  projectileSpeed: number;
  rotationSpeed: number;
  warmupTime: number;
  burstCount: number;
  leadTarget: boolean;
}

export type AllyBehavior =
  | "idle"
  | "patrol"
  | "combat"
  | "harvest"
  | "return_to_camp"
  | "follow"
  | "craft"
  | "defend"
  | "sleep";

export interface ClaimFlagState {
  claimId: string;
  ownerAccountId: string;
  islandId: string;
  /** World position of flag */
  pos: { x: number; y: number; z: number };
  radiusM: number;
  buildRights: boolean;
  skills: {
    logistics: number;
    fortify: number;
    muster: number;
    husbandry: number;
    drill: number;
  };
  placedBuildingIds: string[];
  rosterUnitIds: string[];
}

export interface ProductionJob {
  id: string;
  buildingInstanceId: string;
  kind: "item" | "unit" | "vehicle" | "food";
  recipeOrUnitId: string;
  startedAt: number;
  endsAt: number;
  assigneeUnitId?: string;
  status: "queued" | "running" | "done" | "cancelled";
}

export interface DefenseBrainConfig {
  /** Prefer targets inside claim radius first */
  preferClaimThreats: boolean;
  /** Workers flee to claim flag when HP below this fraction */
  workerFleeHp: number;
  /** Defenders hold until threat leaves range * this */
  holdRangeMult: number;
  /** Auto-assign idle military to nearest undefended tower */
  autoGarrison: boolean;
}
