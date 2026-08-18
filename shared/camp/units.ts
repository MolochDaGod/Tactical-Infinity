import type { UnitCatalogEntry } from "./types";

/** Trainable units — meshes resolve via grudge6 / Toon RTS on CDN. */
export const MASTER_UNITS: UnitCatalogEntry[] = [
  {
    id: "unit.farmer",
    name: "Farmer",
    role: "worker",
    faction: "neutral",
    trainedAt: ["bld.camp.l1", "bld.farm.first.l1", "bld.lumber_camp"],
    cost: { wood: 5, gold: 5 },
    trainTimeSec: 20,
    mesh: {
      importer: "fbx",
      path: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx",
      targetHeightM: 1.8,
    },
    defaultProfessions: ["woodcutting", "farming", "mining"],
    maxLevel: 100,
  },
  {
    id: "unit.worker",
    name: "Worker",
    role: "worker",
    faction: "neutral",
    trainedAt: ["bld.town_center.first.l1"],
    cost: { wood: 8, gold: 8 },
    trainTimeSec: 25,
    mesh: {
      importer: "fbx",
      path: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx",
      targetHeightM: 1.8,
    },
    defaultProfessions: ["building", "woodcutting", "mining"],
    maxLevel: 100,
  },
  {
    id: "unit.soldier",
    name: "Soldier",
    role: "melee",
    faction: "crusade",
    trainedAt: ["bld.barracks.crusade.first.l1"],
    cost: { wood: 10, gold: 15, stone: 5 },
    trainTimeSec: 45,
    mesh: {
      importer: "fbx",
      path: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx",
      targetHeightM: 1.85,
    },
    maxLevel: 100,
  },
  {
    id: "unit.knight",
    name: "Knight",
    role: "melee",
    faction: "crusade",
    trainedAt: ["bld.barracks.crusade.first.l1"],
    cost: { wood: 15, gold: 35, stone: 15 },
    trainTimeSec: 70,
    mesh: {
      importer: "fbx",
      path: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx",
      targetHeightM: 1.9,
    },
    maxLevel: 100,
  },
  {
    id: "unit.archer",
    name: "Archer",
    role: "ranged",
    faction: "fabled",
    trainedAt: ["bld.archery.fabled.first.l1"],
    cost: { wood: 15, gold: 12 },
    trainTimeSec: 40,
    mesh: {
      importer: "fbx",
      path: "https://assets.grudge-studio.com/models/grudge6/races/ELF_Characters.fbx",
      targetHeightM: 1.8,
    },
    maxLevel: 100,
  },
  {
    id: "unit.ranger",
    name: "Ranger",
    role: "ranged",
    faction: "fabled",
    trainedAt: ["bld.archery.fabled.first.l1"],
    cost: { wood: 20, gold: 20 },
    trainTimeSec: 55,
    mesh: {
      importer: "fbx",
      path: "https://assets.grudge-studio.com/models/grudge6/races/ELF_Characters.fbx",
      targetHeightM: 1.85,
    },
    maxLevel: 100,
  },
];

const BY_ID = new Map(MASTER_UNITS.map((u) => [u.id, u]));

export function getUnit(id: string): UnitCatalogEntry | undefined {
  return BY_ID.get(id);
}

export function unitsTrainedAt(buildingId: string): UnitCatalogEntry[] {
  return MASTER_UNITS.filter((u) => u.trainedAt.includes(buildingId));
}
