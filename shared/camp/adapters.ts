/**
 * Legacy adapters — map TI / RTS-Grudge ids onto canonical catalog entries.
 */
import { MASTER_BUILDINGS, getBuilding } from "./masterBuildings";
import type { BuildingCatalogEntry, ResourceCost } from "./types";

/** Resolve any known id (canonical or alias) → catalog entry. */
export function resolveBuilding(id: string): BuildingCatalogEntry | undefined {
  return getBuilding(id);
}

/** TI IslandBuildingSystem-style cost bag. */
export function toTiCost(cost: ResourceCost): {
  wood?: number;
  stone?: number;
  ore?: number;
  gold?: number;
  leather?: number;
  fiber?: number;
} {
  return { ...cost };
}

/** RTS-Grudge useBuildSystem cost (requires wood/stone/gold numbers). */
export function toRtsCost(cost: ResourceCost): {
  wood: number;
  stone: number;
  gold: number;
} {
  return {
    wood: cost.wood ?? 0,
    stone: cost.stone ?? 0,
    gold: cost.gold ?? 0,
  };
}

/**
 * Minimal BuildingDef-shaped object for RTS-Grudge registry merge.
 * Does not replace the full BUILDING_REGISTRY — use for camp SSOT subset.
 */
export function toRtsBuildingDef(entry: BuildingCatalogEntry) {
  const spawnAllyFn = entry.functions.find((f) => f.kind === "spawn_units");
  const spawnResFn = entry.functions.find((f) => f.kind === "spawn_resources");
  let spawnAlly: string | undefined;
  let allyCount: number | undefined;
  if (spawnAllyFn && spawnAllyFn.kind === "spawn_units") {
    const uid = spawnAllyFn.unitIds[0] ?? "";
    spawnAlly = uid.replace(/^unit\./, "") as string;
    allyCount = spawnAllyFn.count;
  }
  let spawnResources:
    | { type: string; count: number }[]
    | undefined;
  if (spawnResFn && spawnResFn.kind === "spawn_resources") {
    spawnResources = spawnResFn.nodes;
  }
  return {
    id: entry.aliases?.[0] ?? entry.id,
    canonicalId: entry.id,
    name: entry.name,
    category:
      entry.category === "production"
        ? "economy"
        : entry.category === "structure"
          ? "special"
          : entry.category,
    age: entry.age === "third" ? "second" : entry.age,
    level: entry.level,
    maxLevel: entry.maxLevel,
    modelPath: entry.mesh.path,
    cost: toRtsCost(entry.cost),
    size: entry.sizeCells as [number, number],
    description: entry.description,
    unlockRequirement: entry.unlockRequirement,
    spawnAlly,
    allyCount,
    spawnResources,
    faction: entry.faction,
    claimGated: entry.claimGated,
    fieldQuickCraft: entry.fieldQuickCraft,
  };
}

/** All SSOT buildings as RTS-shaped defs (for merge into BUILDING_REGISTRY). */
export function campBuildingsAsRtsDefs() {
  return MASTER_BUILDINGS.map(toRtsBuildingDef);
}

/** UI palette rows for BuildHammer / BuildMenu. */
export function buildingPaletteRows(faction: string = "any") {
  return MASTER_BUILDINGS.filter(
    (b) =>
      faction === "any" ||
      b.faction === "neutral" ||
      b.faction === faction,
  )
    .slice()
    .sort((a, b) => a.ui.sort - b.ui.sort)
    .map((b) => ({
      id: b.id,
      legacyId: b.aliases?.[0] ?? b.id,
      name: b.name,
      emoji: b.ui.emoji,
      tab: b.ui.tab,
      cost: b.cost,
      description: b.description,
      claimGated: b.claimGated,
      sizeCells: b.sizeCells,
      meshPath: b.mesh.path,
    }));
}
