/**
 * Canonical camp / RTS building catalog (subset — expand from UF RTS + Grudge registry).
 * Consumers: Tactical Infinity IslandBuildingSystem, RTS-Grudge useBuildSystem, Open claim hub.
 */
import type { BuildingCatalogEntry } from "./types";
import { PIRATE_MESH, PIRATE_PACK_CDN } from "./piratePack";

const UF = "https://assets.grudge-studio.com/models/rts/ultimate-fantasy/fbx";
const Q = "/models/rts_quaternius";
const PIRATE = PIRATE_PACK_CDN;

/** Core camp loop buildings — pattern-accurate for gameplay. */
export const MASTER_BUILDINGS: BuildingCatalogEntry[] = [
  // ── Claim / hub ──────────────────────────────────────────────────────────
  {
    id: "bld.claim_flag",
    aliases: ["claim_flag", "camp_flag"],
    name: "Claim Flag",
    description: "Plants camp rights. Structures and train queues require this.",
    category: "special",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 10, stone: 5 },
    sizeCells: [1, 1],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/survival/free_survival_asset_kit.glb",
      targetHeightM: 2.2,
      meshName: "flag",
    },
    functions: [{ kind: "claim_anchor", radiusM: 48 }],
    claimGated: false,
    fieldQuickCraft: true,
    ui: { emoji: "🚩", tab: "camp", sort: 0 },
  },
  {
    id: "bld.camp.l1",
    aliases: ["camp", "player_camp"],
    name: "Camp",
    description: "Base camp. Spawns workers that auto-harvest nearby resources.",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 20, stone: 10 },
    sizeCells: [4, 4],
    mesh: {
      importer: "gltf",
      path: `${Q}/Farm_FirstAge_Level1.glb`,
      targetHeightM: 4,
    },
    functions: [
      { kind: "spawn_units", unitIds: ["unit.farmer"], count: 2 },
      {
        kind: "spawn_resources",
        nodes: [
          { type: "berry", count: 4 },
          { type: "fiber", count: 3 },
          { type: "herb", count: 2 },
        ],
      },
      { kind: "assign_role", roles: ["harvest", "craft", "defend"] },
      { kind: "storage", slots: 24 },
    ],
    claimGated: true,
    ui: { emoji: "⛺", tab: "camp", sort: 1 },
  },
  {
    id: "bld.town_center.first.l1",
    aliases: ["towncenter_1a_l1", "rts_town_center"],
    name: "Town Center",
    description: "Central hub. Unlocks Second Age buildings.",
    category: "special",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 3,
    cost: { wood: 100, stone: 60, gold: 30 },
    sizeCells: [6, 6],
    mesh: {
      importer: "fbx",
      path: `${UF}/TownCenter_FirstAge_Level1.fbx`,
      targetHeightM: 12,
    },
    functions: [
      { kind: "spawn_units", unitIds: ["unit.worker"], count: 3 },
      { kind: "storage", slots: 48 },
      { kind: "assign_role", roles: ["harvest", "defend"] },
    ],
    claimGated: true,
    unlockRequirement: "claim_flag",
    ui: { emoji: "🏛️", tab: "special", sort: 10 },
  },

  // ── Economy / food ───────────────────────────────────────────────────────
  {
    id: "bld.farm.first.l1",
    aliases: ["farm_1a_l1", "rts_farm", "farm"],
    name: "Farm",
    description: "Produces food. Grows herbs and berries around it.",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 3,
    cost: { wood: 30, stone: 10, gold: 5 },
    sizeCells: [4, 4],
    mesh: {
      importer: "fbx",
      path: `${UF}/Farm_FirstAge_Level1.fbx`,
      targetHeightM: 3.5,
    },
    functions: [
      { kind: "food", foodPerMinute: 4 },
      {
        kind: "spawn_resources",
        nodes: [
          { type: "herb", count: 3 },
          { type: "berry", count: 3 },
        ],
      },
      { kind: "produce_items", recipeIds: ["cook_stew", "cook_bread"] },
    ],
    claimGated: true,
    ui: { emoji: "🌾", tab: "economy", sort: 20 },
  },
  {
    id: "bld.lumber_camp",
    aliases: ["lumber_camp"],
    name: "Lumber Camp",
    description: "Forestry camp. Spawns wood and fiber nodes; workers auto-chop.",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 35, stone: 15, gold: 5 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: `${Q}/Storage_FirstAge_Level1.glb`,
      targetHeightM: 4,
    },
    functions: [
      {
        kind: "spawn_resources",
        nodes: [
          { type: "wood", count: 6 },
          { type: "fiber", count: 3 },
        ],
      },
      { kind: "assign_role", roles: ["harvest"] },
      { kind: "spawn_units", unitIds: ["unit.farmer"], count: 1 },
    ],
    claimGated: true,
    ui: { emoji: "🪓", tab: "economy", sort: 21 },
  },
  {
    id: "bld.mining_outpost",
    aliases: ["mining_outpost"],
    name: "Mining Outpost",
    description: "Spawns stone and iron ore; miners auto-gather.",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 30, stone: 30, gold: 10 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: `${Q}/Storage_FirstAge_Level1.glb`,
      targetHeightM: 4,
    },
    functions: [
      {
        kind: "spawn_resources",
        nodes: [
          { type: "stone", count: 4 },
          { type: "iron_ore", count: 3 },
        ],
      },
      { kind: "assign_role", roles: ["harvest"] },
    ],
    claimGated: true,
    ui: { emoji: "⛏️", tab: "economy", sort: 22 },
  },
  {
    id: "bld.warehouse",
    aliases: ["storage_1a_l1", "warehouse", "storage_chest"],
    name: "Warehouse",
    description: "Stores resources and production output.",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 3,
    cost: { wood: 30, stone: 15, gold: 5 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: `${Q}/Storage_FirstAge_Level1.glb`,
      targetHeightM: 5,
    },
    functions: [{ kind: "storage", slots: 64 }],
    claimGated: true,
    ui: { emoji: "📦", tab: "economy", sort: 23 },
  },
  {
    id: "bld.dock",
    aliases: ["boat_dock", "dock", "port_1a"],
    name: "Boat Dock",
    description: "Builds rafts and light ships. Vehicle delivery.",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 60, stone: 20, gold: 15 },
    sizeCells: [2, 3],
    mesh: {
      importer: "fbx",
      path: `${UF}/Dock_FirstAge.fbx`,
      targetHeightM: 3,
    },
    functions: [
      {
        kind: "vehicle",
        vehicleIds: ["veh.home_raft", "veh.dock_boat", "veh.upgraded_raft"],
      },
    ],
    claimGated: true,
    ui: { emoji: "⚓", tab: "economy", sort: 24 },
  },
  {
    id: "bld.viking_fisherman_dock",
    aliases: [
      "viking_fisherman_house",
      "fisherman_dock",
      "viking_dock",
      "town_dock",
    ],
    name: "Viking Fisherman Dock",
    description:
      "House + pier for island towns. Neutral NPCs path yard → fish rack → dock → boat (nav graph in vikingFishermanDock).",
    category: "economy",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 80, stone: 30, gold: 20 },
    sizeCells: [4, 5],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/docks/viking_fisherman_house.glb",
      targetHeightM: 8,
      meshName: "DAE_Villages",
    },
    functions: [
      {
        kind: "vehicle",
        vehicleIds: ["veh.dock_boat", "veh.home_raft"],
      },
      { kind: "assign_role", roles: ["harvest", "patrol", "craft"] },
      {
        kind: "produce_items",
        recipeIds: ["cook_fish", "craft_net", "craft_pirate_fishing_rod"],
      },
    ],
    claimGated: true,
    ui: { emoji: "🏠", tab: "economy", sort: 26 },
  },
  {
    id: "bld.net_dock",
    aliases: ["net_dock", "fishing_stand_net", "pirate_net_dock"],
    name: "Net Dock",
    description:
      "Shore fishing stand with nets (low-poly pirate pack). Cook fish + craft nets.",
    category: "economy",
    faction: "pirate",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 35, fiber: 10, gold: 5 },
    sizeCells: [2, 2],
    mesh: {
      importer: "gltf",
      path: PIRATE,
      targetHeightM: 2.2,
      meshName: PIRATE_MESH.netDock,
    },
    functions: [
      {
        kind: "produce_items",
        recipeIds: [
          "cook_fish",
          "craft_net",
          "craft_pirate_fishing_rod",
          "craft_pirate_fishing_rod_line",
        ],
      },
      { kind: "food", foodPerMinute: 2 },
    ],
    claimGated: true,
    ui: { emoji: "🕸️", tab: "economy", sort: 25 },
  },

  // ── Production stations ──────────────────────────────────────────────────
  {
    id: "bld.campfire",
    aliases: ["campfire", "cooking_fire", "fire_pit"],
    name: "Campfire",
    description: "Cooks food. Field quick-craft — no claim required.",
    category: "production",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 8 },
    sizeCells: [1, 1],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/survival/free_survival_asset_kit.glb",
      targetHeightM: 0.9,
      meshName: "campfire",
    },
    functions: [
      { kind: "produce_items", recipeIds: ["cook_meat", "cook_stew", "cook_berries"] },
      { kind: "food", foodPerMinute: 1 },
    ],
    claimGated: false,
    fieldQuickCraft: true,
    ui: { emoji: "🔥", tab: "camp", sort: 5 },
  },
  {
    id: "bld.workbench",
    aliases: ["workbench", "workbench_advanced", "crafting_table"],
    name: "Workbench",
    description: "Crafts tools and kits. Timed production queue.",
    category: "production",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 25, stone: 10 },
    sizeCells: [2, 1],
    mesh: {
      importer: "gltf",
      path: "/assets/stations/workbench_advanced.glb",
      targetHeightM: 1.1,
    },
    functions: [
      {
        kind: "produce_items",
        recipeIds: [
          "craft_stone_axe",
          "craft_stone_pick",
          "craft_bandage",
          "workbench_advanced",
          "craft_pirate_fishing_rod",
          "craft_pirate_fishing_rod_line",
          "craft_pirate_shovel",
          "craft_net",
        ],
      },
      { kind: "assign_role", roles: ["craft"] },
    ],
    claimGated: true,
    ui: { emoji: "🪚", tab: "camp", sort: 6 },
  },
  {
    id: "bld.forge",
    aliases: ["forge", "furnace", "smeltery", "blacksmith"],
    name: "Forge",
    description:
      "Smelts ore and forges weapons. Mesh: stylized smeltery setup (faction blacksmith yard).",
    category: "production",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 20, stone: 40, gold: 10 },
    sizeCells: [2, 2],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/smeltery/stylized_smeltery_setup.glb",
      targetHeightM: 5.5,
      // Full yard; clients may isolate Toolsmith.* / Barrel_* for props
      meshName: "Cube.437",
    },
    functions: [
      { kind: "produce_items", recipeIds: ["smelt_iron", "forge_sword"] },
      { kind: "assign_role", roles: ["craft"] },
    ],
    claimGated: true,
    ui: { emoji: "⚒️", tab: "camp", sort: 7 },
  },
  // Faction blacksmith aliases (same mesh, faction tint via environmentPacks.factionSmeltery)
  {
    id: "bld.forge.crusade",
    aliases: ["forge_crusade", "blacksmith_crusade"],
    name: "Crusade Smeltery",
    description: "Faction forge for Crusade camps.",
    category: "production",
    faction: "crusade",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 25, stone: 45, gold: 15 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/smeltery/stylized_smeltery_setup.glb",
      targetHeightM: 5.5,
    },
    functions: [
      { kind: "produce_items", recipeIds: ["smelt_iron", "forge_sword"] },
      { kind: "assign_role", roles: ["craft"] },
    ],
    claimGated: true,
    ui: { emoji: "⚒️", tab: "camp", sort: 8 },
  },
  {
    id: "bld.forge.fabled",
    aliases: ["forge_fabled", "blacksmith_fabled"],
    name: "Fabled Smeltery",
    description: "Faction forge for Fabled camps.",
    category: "production",
    faction: "fabled",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 25, stone: 45, gold: 15 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/smeltery/stylized_smeltery_setup.glb",
      targetHeightM: 5.5,
    },
    functions: [
      { kind: "produce_items", recipeIds: ["smelt_iron", "forge_sword"] },
      { kind: "assign_role", roles: ["craft"] },
    ],
    claimGated: true,
    ui: { emoji: "⚒️", tab: "camp", sort: 9 },
  },
  {
    id: "bld.forge.legion",
    aliases: ["forge_legion", "blacksmith_legion"],
    name: "Legion Smeltery",
    description: "Faction forge for Legion camps.",
    category: "production",
    faction: "legion",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 25, stone: 45, gold: 15 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/smeltery/stylized_smeltery_setup.glb",
      targetHeightM: 5.5,
    },
    functions: [
      { kind: "produce_items", recipeIds: ["smelt_iron", "forge_sword"] },
      { kind: "assign_role", roles: ["craft"] },
    ],
    claimGated: true,
    ui: { emoji: "⚒️", tab: "camp", sort: 10 },
  },
  {
    id: "bld.forge.pirate",
    aliases: ["forge_pirate", "blacksmith_pirate"],
    name: "Pirate Smeltery",
    description: "Faction forge for Pirate camps.",
    category: "production",
    faction: "pirate",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 25, stone: 45, gold: 15 },
    sizeCells: [3, 3],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/smeltery/stylized_smeltery_setup.glb",
      targetHeightM: 5.5,
    },
    functions: [
      { kind: "produce_items", recipeIds: ["smelt_iron", "forge_sword"] },
      { kind: "assign_role", roles: ["craft"] },
    ],
    claimGated: true,
    ui: { emoji: "⚒️", tab: "camp", sort: 11 },
  },

  // ── Military / train ─────────────────────────────────────────────────────
  {
    id: "bld.barracks.crusade.first.l1",
    aliases: ["barracks_1a_l1", "rts_barracks", "barracks"],
    name: "Barracks",
    description: "Trains soldiers. Assign defend / patrol.",
    category: "military",
    faction: "crusade",
    age: "first",
    level: 1,
    maxLevel: 3,
    cost: { wood: 80, stone: 40, gold: 20 },
    sizeCells: [5, 5],
    mesh: {
      importer: "fbx",
      path: `${UF}/Barracks_FirstAge_Level1.fbx`,
      targetHeightM: 8,
    },
    functions: [
      {
        kind: "spawn_units",
        unitIds: ["unit.soldier", "unit.knight"],
        count: 2,
        trainTimeSec: 45,
        trainCost: { wood: 10, gold: 15 },
      },
      { kind: "assign_role", roles: ["defend", "patrol", "follow"] },
    ],
    claimGated: true,
    ui: { emoji: "🏰", tab: "military", sort: 30 },
  },
  {
    id: "bld.archery.fabled.first.l1",
    aliases: ["archery_1a_l1", "rts_archery", "archery_range"],
    name: "Archery Range",
    description: "Trains archers and rangers.",
    category: "military",
    faction: "fabled",
    age: "first",
    level: 1,
    maxLevel: 3,
    cost: { wood: 70, stone: 30, gold: 25 },
    sizeCells: [2, 3],
    mesh: {
      importer: "fbx",
      path: `${UF}/Archery_FirstAge_Level1.fbx`,
      targetHeightM: 6,
    },
    functions: [
      {
        kind: "spawn_units",
        unitIds: ["unit.archer", "unit.ranger"],
        trainTimeSec: 40,
        trainCost: { wood: 15, gold: 12 },
      },
      { kind: "assign_role", roles: ["defend", "patrol"] },
    ],
    claimGated: true,
    ui: { emoji: "🏹", tab: "military", sort: 31 },
  },
  {
    id: "bld.elven_treehouse",
    aliases: [
      "elven_treehouse",
      "treehouse",
      "fabled_treehouse",
      "dark_elf_treehouse",
    ],
    name: "Elven Treehouse",
    description:
      "LOTR-style treehouse for Fabled / elven islands and dark-elf event zones. Platform + stairs + host tree.",
    category: "housing",
    faction: "fabled",
    age: "first",
    level: 1,
    maxLevel: 2,
    cost: { wood: 90, stone: 20, gold: 25 },
    sizeCells: [4, 4],
    mesh: {
      importer: "gltf",
      path: "https://assets.grudge-studio.com/models/buildings/elven/elven_treehouse.glb",
      targetHeightM: 14,
      meshName: "Stairs_and_Treehouse",
    },
    functions: [
      { kind: "assign_role", roles: ["patrol", "defend", "harvest"] },
      { kind: "storage", slots: 24 },
    ],
    claimGated: true,
    ui: { emoji: "🌲", tab: "housing", sort: 20 },
  },

  // ── Defense ──────────────────────────────────────────────────────────────
  {
    id: "bld.watchtower.first.l1",
    aliases: ["watchtower_1a_l1", "watchtower", "tower"],
    name: "Watch Tower",
    description: "Defensive tower. Auto-fires on hostiles in range.",
    category: "defense",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 3,
    cost: { wood: 50, stone: 30, gold: 10 },
    sizeCells: [2, 2],
    mesh: {
      importer: "fbx",
      path: `${UF}/WatchTower_FirstAge_Level1.fbx`,
      targetHeightM: 10,
    },
    functions: [
      { kind: "turret", profileId: "watchtower_bow" },
      { kind: "assign_role", roles: ["defend"] },
    ],
    claimGated: true,
    ui: { emoji: "🗼", tab: "defense", sort: 40 },
  },
  {
    id: "bld.wall.first",
    aliases: ["wall_1a", "wall", "stone_wall"],
    name: "Stone Wall",
    description: "Basic wall segment for claim perimeter.",
    category: "defense",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 10, stone: 20 },
    sizeCells: [4, 1],
    mesh: {
      importer: "fbx",
      path: `${UF}/Wall_FirstAge.fbx`,
      targetHeightM: 4,
    },
    functions: [],
    claimGated: true,
    ui: { emoji: "🧱", tab: "defense", sort: 41 },
  },
  {
    id: "bld.shore_cannon",
    aliases: ["shore_cannon", "cannon", "pirate_cannon"],
    name: "Shore Cannon",
    description:
      "Coastal battery — pirate pack cannon barrel. Mount on Cannon Base.",
    category: "defense",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 40, stone: 60, gold: 40 },
    sizeCells: [2, 2],
    mesh: {
      importer: "gltf",
      path: PIRATE,
      targetHeightM: 1.2,
      meshName: PIRATE_MESH.cannon,
    },
    functions: [{ kind: "turret", profileId: "shore_cannon" }],
    claimGated: true,
    ui: { emoji: "💣", tab: "defense", sort: 42 },
  },
  {
    id: "bld.cannon_base",
    aliases: ["cannon_base", "cannon_stand", "pirate_cannon_base"],
    name: "Cannon Base",
    description:
      "Cannon carriage / stand from low-poly pirate pack. Place under Shore Cannon.",
    category: "defense",
    faction: "neutral",
    age: "first",
    level: 1,
    maxLevel: 1,
    cost: { wood: 25, stone: 30, gold: 10 },
    sizeCells: [2, 2],
    mesh: {
      importer: "gltf",
      path: PIRATE,
      targetHeightM: 0.9,
      meshName: PIRATE_MESH.cannonBase,
    },
    functions: [],
    claimGated: true,
    ui: { emoji: "🪵", tab: "defense", sort: 43 },
  },
];

const BY_ID = new Map(MASTER_BUILDINGS.map((b) => [b.id, b]));
const BY_ALIAS = new Map<string, BuildingCatalogEntry>();
for (const b of MASTER_BUILDINGS) {
  BY_ALIAS.set(b.id, b);
  for (const a of b.aliases ?? []) BY_ALIAS.set(a, b);
}

export function getBuilding(idOrAlias: string): BuildingCatalogEntry | undefined {
  return BY_ID.get(idOrAlias) ?? BY_ALIAS.get(idOrAlias);
}

export function buildingsForTab(
  tab: BuildingCatalogEntry["ui"]["tab"],
): BuildingCatalogEntry[] {
  return MASTER_BUILDINGS.filter((b) => b.ui.tab === tab).sort(
    (a, b) => a.ui.sort - b.ui.sort,
  );
}

export function buildingsForFaction(
  faction: BuildingCatalogEntry["faction"] | "any",
): BuildingCatalogEntry[] {
  if (faction === "any") return MASTER_BUILDINGS.slice();
  return MASTER_BUILDINGS.filter(
    (b) => b.faction === "neutral" || b.faction === faction,
  );
}

export function canAfford(
  cost: BuildingCatalogEntry["cost"],
  bag: Record<string, number>,
): boolean {
  for (const [k, v] of Object.entries(cost)) {
    if ((bag[k] ?? 0) < (v ?? 0)) return false;
  }
  return true;
}

export function spendCost(
  cost: BuildingCatalogEntry["cost"],
  bag: Record<string, number>,
): Record<string, number> | null {
  if (!canAfford(cost, bag)) return null;
  const next = { ...bag };
  for (const [k, v] of Object.entries(cost)) {
    next[k] = (next[k] ?? 0) - (v ?? 0);
  }
  return next;
}
