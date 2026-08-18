/**
 * Production / delivery queues — items, units, vehicles, food.
 * Pattern shared by camp stations + RTS train buildings.
 */
import type { ProductionJob, ResourceCost } from "./types";
import { getBuilding } from "./masterBuildings";
import { getUnit } from "./units";

export interface ItemRecipe {
  id: string;
  label: string;
  emoji: string;
  durationSec: number;
  ingredients: { itemId: string; qty: number }[];
  resourceCost?: ResourceCost;
  result: { itemId: string; name: string; emoji: string; qty: number };
  stationBuildingIds: string[];
}

export const ITEM_RECIPES: ItemRecipe[] = [
  {
    id: "cook_meat",
    label: "Cook Meat",
    emoji: "🍖",
    durationSec: 20,
    ingredients: [{ itemId: "raw_meat", qty: 1 }],
    result: { itemId: "cooked_meat", name: "Cooked Meat", emoji: "🍖", qty: 1 },
    stationBuildingIds: ["bld.campfire"],
  },
  {
    id: "cook_stew",
    label: "Meat Stew",
    emoji: "🍲",
    durationSec: 45,
    ingredients: [
      { itemId: "raw_meat", qty: 2 },
      { itemId: "herb", qty: 1 },
    ],
    result: { itemId: "meat_stew", name: "Meat Stew", emoji: "🍲", qty: 1 },
    stationBuildingIds: ["bld.campfire", "bld.farm.first.l1"],
  },
  {
    id: "cook_berries",
    label: "Berry Bowl",
    emoji: "🫐",
    durationSec: 12,
    ingredients: [{ itemId: "berry", qty: 4 }],
    result: { itemId: "berry_bowl", name: "Berry Bowl", emoji: "🫐", qty: 1 },
    stationBuildingIds: ["bld.campfire"],
  },
  {
    id: "cook_bread",
    label: "Bread",
    emoji: "🍞",
    durationSec: 30,
    ingredients: [{ itemId: "wheat", qty: 2 }],
    result: { itemId: "bread", name: "Bread", emoji: "🍞", qty: 2 },
    stationBuildingIds: ["bld.farm.first.l1"],
  },
  {
    id: "craft_stone_axe",
    label: "Stone Axe",
    emoji: "🪓",
    durationSec: 30,
    ingredients: [
      { itemId: "stone", qty: 2 },
      { itemId: "wood", qty: 3 },
    ],
    result: { itemId: "stone_axe", name: "Stone Axe", emoji: "🪓", qty: 1 },
    stationBuildingIds: ["bld.workbench"],
  },
  {
    id: "craft_stone_pick",
    label: "Stone Pickaxe",
    emoji: "⛏️",
    durationSec: 30,
    ingredients: [
      { itemId: "stone", qty: 3 },
      { itemId: "wood", qty: 2 },
    ],
    result: { itemId: "stone_pickaxe", name: "Stone Pickaxe", emoji: "⛏️", qty: 1 },
    stationBuildingIds: ["bld.workbench"],
  },
  {
    id: "craft_bandage",
    label: "Bandage",
    emoji: "🩹",
    durationSec: 20,
    ingredients: [{ itemId: "fiber", qty: 3 }],
    result: { itemId: "bandage", name: "Bandage", emoji: "🩹", qty: 1 },
    stationBuildingIds: ["bld.workbench"],
  },
  {
    id: "smelt_iron",
    label: "Smelt Iron",
    emoji: "⚙️",
    durationSec: 60,
    ingredients: [
      { itemId: "iron_ore", qty: 2 },
      { itemId: "wood", qty: 1 },
    ],
    result: { itemId: "iron_ingot", name: "Iron Ingot", emoji: "🔩", qty: 1 },
    stationBuildingIds: ["bld.forge"],
  },
  {
    id: "forge_sword",
    label: "Forge Sword",
    emoji: "🗡️",
    durationSec: 90,
    ingredients: [
      { itemId: "iron_ingot", qty: 2 },
      { itemId: "wood", qty: 1 },
    ],
    resourceCost: { gold: 5 },
    result: { itemId: "iron_sword", name: "Iron Sword", emoji: "🗡️", qty: 1 },
    stationBuildingIds: ["bld.forge"],
  },

  // ── Pirate pack tools + shore station ────────────────────────────────────
  {
    id: "craft_pirate_fishing_rod",
    label: "Pirate Fishing Pole",
    emoji: "🎣",
    durationSec: 35,
    ingredients: [
      { itemId: "wood", qty: 4 },
      { itemId: "fiber", qty: 2 },
    ],
    result: {
      itemId: "pirate_fishing_rod",
      name: "Pirate Fishing Pole",
      emoji: "🎣",
      qty: 1,
    },
    stationBuildingIds: ["bld.workbench", "bld.net_dock"],
  },
  {
    id: "craft_pirate_fishing_rod_line",
    label: "Fishing Pole with Line",
    emoji: "🎣",
    durationSec: 50,
    ingredients: [
      { itemId: "pirate_fishing_rod", qty: 1 },
      { itemId: "fiber", qty: 3 },
      { itemId: "wood", qty: 1 },
    ],
    result: {
      itemId: "pirate_fishing_rod_line",
      name: "Fishing Pole with Line",
      emoji: "🎣",
      qty: 1,
    },
    stationBuildingIds: ["bld.workbench", "bld.net_dock"],
  },
  {
    id: "craft_pirate_shovel",
    label: "Pirate Shovel",
    emoji: "🪏",
    durationSec: 40,
    ingredients: [
      { itemId: "wood", qty: 3 },
      { itemId: "iron_ingot", qty: 1 },
    ],
    // fallback when no ingot yet
    resourceCost: { wood: 3, stone: 2 },
    result: {
      itemId: "pirate_shovel",
      name: "Pirate Shovel",
      emoji: "🪏",
      qty: 1,
    },
    stationBuildingIds: ["bld.workbench", "bld.forge"],
  },
  {
    id: "craft_net",
    label: "Fishing Net",
    emoji: "🕸️",
    durationSec: 25,
    ingredients: [
      { itemId: "fiber", qty: 6 },
      { itemId: "wood", qty: 1 },
    ],
    result: {
      itemId: "fishing_net",
      name: "Fishing Net",
      emoji: "🕸️",
      qty: 1,
    },
    stationBuildingIds: ["bld.workbench", "bld.net_dock"],
  },
  {
    id: "cook_fish",
    label: "Cook Fish",
    emoji: "🐟",
    durationSec: 18,
    ingredients: [{ itemId: "raw_fish", qty: 1 }],
    result: {
      itemId: "cooked_fish",
      name: "Cooked Fish",
      emoji: "🐟",
      qty: 1,
    },
    stationBuildingIds: ["bld.campfire", "bld.net_dock"],
  },
];

const RECIPE_BY_ID = new Map(ITEM_RECIPES.map((r) => [r.id, r]));

export function getRecipe(id: string): ItemRecipe | undefined {
  return RECIPE_BY_ID.get(id);
}

export function recipesForBuilding(buildingIdOrAlias: string): ItemRecipe[] {
  const b = getBuilding(buildingIdOrAlias);
  const id = b?.id ?? buildingIdOrAlias;
  return ITEM_RECIPES.filter((r) => r.stationBuildingIds.includes(id));
}

let _jobSeq = 0;

export function enqueueItemJob(
  buildingInstanceId: string,
  recipeId: string,
  nowMs: number,
  assigneeUnitId?: string,
): ProductionJob | null {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;
  return {
    id: `prod_${++_jobSeq}`,
    buildingInstanceId,
    kind: "item",
    recipeOrUnitId: recipeId,
    startedAt: nowMs,
    endsAt: nowMs + recipe.durationSec * 1000,
    assigneeUnitId,
    status: "running",
  };
}

export function enqueueUnitJob(
  buildingInstanceId: string,
  unitId: string,
  nowMs: number,
): ProductionJob | null {
  const unit = getUnit(unitId);
  if (!unit) return null;
  return {
    id: `train_${++_jobSeq}`,
    buildingInstanceId,
    kind: "unit",
    recipeOrUnitId: unitId,
    startedAt: nowMs,
    endsAt: nowMs + unit.trainTimeSec * 1000,
    status: "running",
  };
}

export function enqueueVehicleJob(
  buildingInstanceId: string,
  vehicleId: string,
  nowMs: number,
  durationSec = 60,
): ProductionJob {
  return {
    id: `veh_${++_jobSeq}`,
    buildingInstanceId,
    kind: "vehicle",
    recipeOrUnitId: vehicleId,
    startedAt: nowMs,
    endsAt: nowMs + durationSec * 1000,
    status: "running",
  };
}

export function tickProduction(
  jobs: ProductionJob[],
  nowMs: number,
): { running: ProductionJob[]; completed: ProductionJob[] } {
  const running: ProductionJob[] = [];
  const completed: ProductionJob[] = [];
  for (const j of jobs) {
    if (j.status !== "running" && j.status !== "queued") continue;
    if (nowMs >= j.endsAt) completed.push({ ...j, status: "done" });
    else running.push(j);
  }
  return { running, completed };
}

export function jobProgress01(job: ProductionJob, nowMs: number): number {
  if (job.status === "done") return 1;
  const span = Math.max(1, job.endsAt - job.startedAt);
  return Math.max(0, Math.min(1, (nowMs - job.startedAt) / span));
}
