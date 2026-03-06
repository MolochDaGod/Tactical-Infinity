import type { Race, UnitClass } from "@shared/schema";

export type BuildingType = 
  | "barracks" 
  | "archery" 
  | "market" 
  | "port" 
  | "storage" 
  | "house" 
  | "wall_tower";

export type BuildingAge = "first" | "second";

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  description: string;
  category: "military" | "economic" | "residential" | "defensive";
  maxLevel: number;
  ages: BuildingAge[];
  produces?: {
    units?: UnitClass[];
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

const BUILDINGS_BASE = "/3dassets/buildings/FBX";

export const buildingDefinitions: Record<BuildingType, BuildingDefinition> = {
  barracks: {
    type: "barracks",
    name: "Barracks",
    description: "Train infantry units including Warriors, Rogues, and Knights",
    category: "military",
    maxLevel: 3,
    ages: ["first", "second"],
    produces: {
      units: ["warrior", "rogue", "knight"],
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
      units: ["archer"],
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
};

export function getBuildingModelPath(
  type: BuildingType, 
  age: BuildingAge, 
  level: number,
  variant?: number
): string {
  const ageStr = age === "first" ? "FirstAge" : "SecondAge";
  
  switch (type) {
    case "barracks":
      return `${BUILDINGS_BASE}/Barracks_${ageStr}_Level${level}.fbx`;
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
};

export const houseVariants = [1, 2, 3];
