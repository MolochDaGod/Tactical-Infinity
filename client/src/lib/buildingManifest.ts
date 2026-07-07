import type { Race, UnitClass } from "@shared/schema";

export type BuildingType = 
  | "barracks" 
  | "archery" 
  | "market" 
  | "port" 
  | "storage" 
  | "house" 
  | "wall_tower"
  | "barricade"
  | "farm"
  | "fantasy_house"
  | "hut"
  | "log_cabin";

export type BuildingAge = "first" | "second";

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  description: string;
  category: "military" | "economic" | "residential" | "defensive";
  maxLevel: number;
  ages: BuildingAge[];
  produces?: {
    units?: string[];
    resources?: string[];
  };
  upgrades?: string[];
  crafting?: string[];
  gridSize: { width: number; height: number };
  buildTime: number;
  baseCost: {
    gold: number;
    wood: number;
    stone: number;
  };
}

export interface BuildingInstance {
  id: string;
  type: BuildingType;
  age: BuildingAge;
  level: number;
  position: { x: number; y: number };
  rotation: number;
  isConstructing: boolean;
  constructionProgress: number;
  productionQueue: string[];
}

const BUILDINGS_BASE = "/buildings/FBX";

export const buildingDefinitions: Record<BuildingType, BuildingDefinition> = {
  barracks: {
    type: "barracks",
    name: "Barracks",
    description: "Train infantry units including Warriors, Rogues, and Knights",
    category: "military",
    maxLevel: 3,
    ages: ["first", "second"],
    produces: {
      units: ["warrior", "rogue", "knight"] as string[],
    },
    upgrades: ["armor_smithing", "weapon_forging", "combat_training"],
    gridSize: { width: 3, height: 3 },
    buildTime: 60,
    baseCost: { gold: 200, wood: 150, stone: 100 },
  },
  archery: {
    type: "archery",
    name: "Archery Range",
    description: "Train ranged units including Archers and provide ranged upgrades",
    category: "military",
    maxLevel: 3,
    ages: ["first", "second"],
    produces: {
      units: ["archer"] as string[],
    },
    upgrades: ["precision_arrows", "eagle_eye", "rapid_fire"],
    gridSize: { width: 3, height: 2 },
    buildTime: 45,
    baseCost: { gold: 150, wood: 200, stone: 50 },
  },
  market: {
    type: "market",
    name: "Market",
    description: "Trade resources, craft items, and generate passive gold income",
    category: "economic",
    maxLevel: 3,
    ages: ["first", "second"],
    produces: {
      resources: ["gold"],
    },
    crafting: ["potions", "scrolls", "equipment"],
    gridSize: { width: 4, height: 3 },
    buildTime: 50,
    baseCost: { gold: 300, wood: 100, stone: 100 },
  },
  port: {
    type: "port",
    name: "Port",
    description: "Build ships, trade overseas, and unlock island exploration",
    category: "economic",
    maxLevel: 3,
    ages: ["first", "second"],
    produces: {
      resources: ["trade_goods"],
    },
    upgrades: ["shipbuilding", "navigation", "trade_routes"],
    gridSize: { width: 4, height: 4 },
    buildTime: 90,
    baseCost: { gold: 400, wood: 300, stone: 150 },
  },
  storage: {
    type: "storage",
    name: "Storage",
    description: "Increase resource capacity and protect resources from raids",
    category: "economic",
    maxLevel: 3,
    ages: ["first", "second"],
    upgrades: ["expanded_capacity", "reinforced_walls", "vault"],
    gridSize: { width: 3, height: 3 },
    buildTime: 40,
    baseCost: { gold: 100, wood: 200, stone: 150 },
  },
  house: {
    type: "house",
    name: "House",
    description: "Increase population capacity for more units and workers",
    category: "residential",
    maxLevel: 3,
    ages: ["first", "second"],
    gridSize: { width: 2, height: 2 },
    buildTime: 30,
    baseCost: { gold: 50, wood: 100, stone: 50 },
  },
  wall_tower: {
    type: "wall_tower",
    name: "Wall Tower",
    description: "Defensive structure that protects your island from invaders",
    category: "defensive",
    maxLevel: 1,
    ages: ["first"],
    gridSize: { width: 2, height: 2 },
    buildTime: 60,
    baseCost: { gold: 100, wood: 50, stone: 200 },
  },
  barricade: {
    type: "barricade",
    name: "Tin Barricade",
    description: "Basic defensive barrier to slow enemy advances",
    category: "defensive",
    maxLevel: 1,
    ages: ["first"],
    gridSize: { width: 2, height: 1 },
    buildTime: 20,
    baseCost: { gold: 25, wood: 30, stone: 10 },
  },
  farm: {
    type: "farm",
    name: "Farm",
    description: "Produces food to sustain your population and units",
    category: "economic",
    maxLevel: 3,
    ages: ["first", "second"],
    produces: {
      resources: ["food"],
    },
    gridSize: { width: 3, height: 3 },
    buildTime: 35,
    baseCost: { gold: 75, wood: 120, stone: 25 },
  },
  fantasy_house: {
    type: "fantasy_house",
    name: "Fantasy House",
    description: "Ornate dwelling that increases population capacity significantly",
    category: "residential",
    maxLevel: 2,
    ages: ["first", "second"],
    gridSize: { width: 3, height: 3 },
    buildTime: 45,
    baseCost: { gold: 150, wood: 180, stone: 100 },
  },
  hut: {
    type: "hut",
    name: "Hut",
    description: "Simple shelter for workers and gatherers",
    category: "residential",
    maxLevel: 1,
    ages: ["first"],
    gridSize: { width: 2, height: 2 },
    buildTime: 15,
    baseCost: { gold: 20, wood: 60, stone: 10 },
  },
  log_cabin: {
    type: "log_cabin",
    name: "Log Cabin",
    description: "Sturdy wooden dwelling that provides comfortable housing",
    category: "residential",
    maxLevel: 2,
    ages: ["first", "second"],
    gridSize: { width: 2, height: 3 },
    buildTime: 40,
    baseCost: { gold: 80, wood: 200, stone: 40 },
  },
};

const GLB_BUILDINGS_BASE = "/models/buildings";

export function getBuildingModelPath(
  type: BuildingType, 
  age: BuildingAge, 
  level: number,
  variant?: number
): string {
  const ageStr = age === "first" ? "FirstAge" : "SecondAge";
  
  switch (type) {
    case "barracks":
      return `${GLB_BUILDINGS_BASE}/Barracks_1768397281811.glb`;
    case "archery":
      return `${BUILDINGS_BASE}/Archery_${ageStr}_Level${level}.fbx`;
    case "market":
      return `${BUILDINGS_BASE}/Market_${ageStr}_Level${level}.fbx`;
    case "port":
      return `${BUILDINGS_BASE}/Port_${ageStr}_Level${level}.fbx`;
    case "storage":
      const levelStr = level === 3 && age === "first" ? "Leve3" : `Level${level}`;
      return `${BUILDINGS_BASE}/Storage_${ageStr}_${levelStr}.fbx`;
    case "house":
      const v = variant || 1;
      return `${BUILDINGS_BASE}/Houses_${ageStr}_${v}_Level${level}.fbx`;
    case "wall_tower":
      return `${BUILDINGS_BASE}/WallTowers_DoorClosed_FirstAge.fbx`;
    case "barricade":
      return `${GLB_BUILDINGS_BASE}/tin_barricade_1768397274861.glb`;
    case "farm":
      return `${GLB_BUILDINGS_BASE}/Farm_1768397388591.glb`;
    case "fantasy_house":
      return `${GLB_BUILDINGS_BASE}/Fantasy_House_1768397390823.glb`;
    case "hut":
      return `${GLB_BUILDINGS_BASE}/Hut_1768397392990.glb`;
    case "log_cabin":
      return `${GLB_BUILDINGS_BASE}/Log_cabin_1768397395368.glb`;
    default:
      return `${BUILDINGS_BASE}/Houses_FirstAge_1_Level1.fbx`;
  }
}

export function getBuildingCost(
  type: BuildingType, 
  level: number
): { gold: number; wood: number; stone: number } {
  const def = buildingDefinitions[type];
  const multiplier = Math.pow(1.5, level - 1);
  return {
    gold: Math.floor(def.baseCost.gold * multiplier),
    wood: Math.floor(def.baseCost.wood * multiplier),
    stone: Math.floor(def.baseCost.stone * multiplier),
  };
}

export function getBuildingBuildTime(type: BuildingType, level: number): number {
  const def = buildingDefinitions[type];
  return Math.floor(def.buildTime * Math.pow(1.3, level - 1));
}

export function canUpgradeBuilding(building: BuildingInstance): boolean {
  const def = buildingDefinitions[building.type];
  if (building.level >= def.maxLevel) return false;
  if (building.age === "first" && building.level === def.maxLevel) {
    return def.ages.includes("second");
  }
  return true;
}

export function getNextUpgrade(building: BuildingInstance): { age: BuildingAge; level: number } | null {
  const def = buildingDefinitions[building.type];
  
  if (building.level < def.maxLevel) {
    return { age: building.age, level: building.level + 1 };
  }
  
  if (building.age === "first" && def.ages.includes("second")) {
    return { age: "second", level: 1 };
  }
  
  return null;
}

export const buildingColors: Record<BuildingType, string> = {
  barracks: "#8B4513",
  archery: "#228B22",
  market: "#DAA520",
  port: "#4682B4",
  storage: "#696969",
  house: "#D2691E",
  wall_tower: "#708090",
  barricade: "#A0522D",
  farm: "#9ACD32",
  fantasy_house: "#9370DB",
  hut: "#DEB887",
  log_cabin: "#654321",
};

export const houseVariants = [1, 2, 3];

export const glbBuildingTypes: BuildingType[] = [
  "barracks",
  "barricade",
  "farm",
  "fantasy_house",
  "hut",
  "log_cabin",
];

export function isGlbBuilding(type: BuildingType): boolean {
  return glbBuildingTypes.includes(type);
}

export interface PlaceableBuildingConfig {
  type: BuildingType;
  scale: number;
  yOffset: number;
}

export const glbBuildingConfigs: Record<string, PlaceableBuildingConfig> = {
  barracks: { type: "barracks", scale: 1.0, yOffset: 0 },
  barricade: { type: "barricade", scale: 0.8, yOffset: 0 },
  farm: { type: "farm", scale: 1.2, yOffset: 0 },
  fantasy_house: { type: "fantasy_house", scale: 1.0, yOffset: 0 },
  hut: { type: "hut", scale: 0.9, yOffset: 0 },
  log_cabin: { type: "log_cabin", scale: 1.0, yOffset: 0 },
};
