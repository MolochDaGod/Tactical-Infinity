/**
 * Island fleet shells + redwood trees + green-area plants — SSOT for
 * sectors, improved islands, events, beaches.
 *
 * HARD RULE: multipacks (islands_pack, chicken_gun_islands, redwood, plants)
 * must isolate meshName. Whole-shell GLBs (tropical_island, low_poly_island)
 * may load as single landmass with targetHeightM.
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

// ── Island shells ──────────────────────────────────────────────────────────

export const ISLAND_SHELLS = {
  tropical: {
    key: "tropical_island",
    r2Key: "models/islands/shells/tropical_island.glb",
    cdn: `${WARLORDS_CDN}/models/islands/shells/tropical_island.glb`,
    local: "/models/islands/shells/tropical_island.glb",
    targetHeightM: 16,
    roles: ["sector", "event", "beach", "reward", "improved"],
  },
  lowpoly: {
    key: "low_poly_island",
    r2Key: "models/islands/shells/low_poly_island.glb",
    cdn: `${WARLORDS_CDN}/models/islands/shells/low_poly_island.glb`,
    local: "/models/islands/shells/low_poly_island.glb",
    targetHeightM: 14,
    roles: ["sector", "event", "improved"],
  },
  islandsPack: {
    key: "islands_pack",
    r2Key: "models/islands/shells/islands_pack.glb",
    cdn: `${WARLORDS_CDN}/models/islands/shells/islands_pack.glb`,
    local: "/models/islands/shells/islands_pack.glb",
    targetHeightM: 12,
    roles: ["sector", "beach", "event"],
    /** Isolate one mesh per placement */
    meshNames: [
      "Island 1",
      "Island 2",
      "Island 3",
      "Island 4",
      "Island 5",
      "Island 6",
      "Island 2 trees",
      "Island 3.001",
      "Island 4.001",
      "Iceberg 1",
      "Iceberg 2",
      "New Rock 1",
      "New Rock 2",
      "New Rock 3",
    ],
  },
  chickenGun: {
    key: "chicken_gun_islands",
    r2Key: "models/islands/shells/chicken_gun_islands.glb",
    cdn: `${WARLORDS_CDN}/models/islands/shells/chicken_gun_islands.glb`,
    local: "/models/islands/shells/chicken_gun_islands.glb",
    targetHeightM: 14,
    roles: ["sector", "beach", "event", "improved"],
    meshNames: {
      islands: [
        "island_base",
        "island_small",
        "island_tiny",
        "island_round_tiny",
        "island_sand_tiny",
        "island_cave_large__1_",
        "island_vulcano",
        "island_spikes__1_",
        "island_spikes__2_",
      ],
      palms: [
        "palm",
        "palm_small",
        "palm_round",
        "palm_high",
        "palm_angle",
        "tree_palm_01__5_",
      ],
      ships: [
        "ship_pirate",
        "boat",
        "ship_colonial_small",
        "ship_pirate_vreck_front",
      ],
    },
  },
  tavern: {
    key: "shallowstead_pirate_tavern",
    r2Key: "models/islands/landmarks/shallowstead_pirate_tavern.glb",
    cdn: `${WARLORDS_CDN}/models/islands/landmarks/shallowstead_pirate_tavern.glb`,
    local: "/models/islands/landmarks/shallowstead_pirate_tavern.glb",
    targetHeightM: 8,
    roles: ["event", "sector", "village", "landmark"],
  },
} as const;

// ── Redwood trees (4–8 m tall) ─────────────────────────────────────────────

export const REDWOOD_PACK = {
  key: "stylised_redwood_trees",
  r2Key: "models/nature/stylized/biome/stylised_redwood_trees.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/biome/stylised_redwood_trees.glb`,
  local: "/models/nature/stylized/biome/stylised_redwood_trees.glb",
  /** Target height range for scatter (user request: 4–8 m) */
  heightMinM: 4,
  heightMaxM: 8,
  /** Isolation prefixes — clone Wood + TreeBranch pair by tree id */
  variants: [
    {
      id: "TreeBig001",
      wood: "TreePackDisplayScene_TreeBig001:Wood_0",
      branch: "TreePackDisplayScene_TreeBig001:TreeBranch_0",
      heightM: 7.5,
    },
    {
      id: "TreeBig002",
      wood: "TreePackDisplayScene_TreeBig002:Wood_0",
      branch: "TreePackDisplayScene_TreeBig002:TreeBranch_0",
      heightM: 8.0,
    },
    {
      id: "TreeBig003",
      wood: "TreePackDisplayScene_TreeBig003:Wood_0",
      branch: "TreePackDisplayScene_TreeBig003:TreeBranch_0",
      heightM: 7.2,
    },
    {
      id: "TreeMedium001",
      wood: "TreePackDisplayScene_TreeMedium001:Wood_0",
      branch: "TreePackDisplayScene_TreeMedium001:TreeBranch_0",
      heightM: 5.5,
    },
    {
      id: "TreeMedium002",
      wood: "TreePackDisplayScene_TreeMedium002:Wood_0",
      branch: "TreePackDisplayScene_TreeMedium002:TreeBranch_0",
      heightM: 5.0,
    },
    {
      id: "TreeMedium003",
      wood: "TreePackDisplayScene_TreeMedium003:Wood_0",
      branch: "TreePackDisplayScene_TreeMedium003:TreeBranch_0",
      heightM: 5.8,
    },
    {
      id: "TreeMedium004",
      wood: "TreePackDisplayScene_TreeMedium004:Wood_0",
      branch: "TreePackDisplayScene_TreeMedium004:TreeBranch_0",
      heightM: 4.8,
    },
    {
      id: "TreeSmall001",
      wood: "TreePackDisplayScene_TreeSmall001:Wood_0",
      branch: "TreePackDisplayScene_TreeSmall001:TreeBranch_0",
      heightM: 4.0,
    },
  ],
} as const;

// ── Plants for green areas ─────────────────────────────────────────────────

export const PLANTS_PACK = {
  key: "plants_asset_set",
  r2Key: "models/nature/stylized/harvest/plants_asset_set.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/harvest/plants_asset_set.glb`,
  local: "/models/nature/stylized/harvest/plants_asset_set.glb",
  targetHeightM: 0.9,
  meshNames: Array.from({ length: 16 }, (_, i) => `Object_${i + 2}`),
  roles: ["green", "sector", "home", "event", "beach_edge"],
} as const;

// ── Role → shell / scatter mapping ─────────────────────────────────────────

export type IslandFleetRole =
  | "sector"
  | "event"
  | "beach"
  | "reward"
  | "improved"
  | "village"
  | "landmark";

/** Preferred shell model keys (modelCatalog) per fleet role. */
export const SHELL_BY_ROLE: Record<IslandFleetRole, string[]> = {
  sector: [
    "tropical_island",
    "low_poly_island",
    "islands_pack",
    "chicken_gun_islands",
  ],
  event: [
    "tropical_island",
    "chicken_gun_islands",
    "shallowstead_pirate_tavern",
    "islands_pack",
  ],
  beach: ["tropical_island", "islands_pack", "chicken_gun_islands"],
  reward: ["tropical_island", "chicken_gun_islands"],
  improved: ["tropical_island", "low_poly_island", "chicken_gun_islands"],
  village: ["shallowstead_pirate_tavern", "low_poly_island"],
  landmark: ["shallowstead_pirate_tavern"],
};

/**
 * Sector index 1–9 → improved shell model key (replaces or augments baked shells).
 */
export function sectorShellKey(index: number): string {
  const map: Record<number, string> = {
    1: "islands_pack", // home reef — pack Island 1
    2: "tropical_island",
    3: "low_poly_island",
    4: "chicken_gun_islands", // docks — has ships
    5: "low_poly_island",
    6: "tropical_island", // beach
    7: "shallowstead_pirate_tavern", // settlement landmark
    8: "chicken_gun_islands", // volcanic / dramatic
    9: "islands_pack",
  };
  return map[index] ?? "tropical_island";
}

/** Mesh isolation for multipack shells when placing sector n. */
export function sectorShellMeshName(index: number): string | undefined {
  switch (index) {
    case 1:
      return "Island 1";
    case 4:
      return "island_small";
    case 8:
      return "island_vulcano";
    case 9:
      return "Island 5";
    default:
      return undefined;
  }
}

export function pickRedwood(
  index: number,
  rand = Math.random,
): (typeof REDWOOD_PACK.variants)[number] {
  const v = REDWOOD_PACK.variants[index % REDWOOD_PACK.variants.length]!;
  // jitter height within 4–8 m while keeping variant proportions
  const t = rand();
  const h =
    REDWOOD_PACK.heightMinM +
    t * (REDWOOD_PACK.heightMaxM - REDWOOD_PACK.heightMinM);
  return { ...v, heightM: Math.min(8, Math.max(4, h)) };
}

export function pickPlantMesh(index: number): string {
  return PLANTS_PACK.meshNames[index % PLANTS_PACK.meshNames.length]!;
}

/** Beach palm isolations from chicken_gun pack. */
export const BEACH_PALM_MESHES = ISLAND_SHELLS.chickenGun.meshNames.palms;

export function allIslandFleetR2Keys(): {
  r2Key: string;
  name: string;
  layer: string;
  meshNames?: string[];
}[] {
  return [
    {
      r2Key: ISLAND_SHELLS.tropical.r2Key,
      name: "tropical_island",
      layer: "islands",
    },
    {
      r2Key: ISLAND_SHELLS.lowpoly.r2Key,
      name: "low_poly_island",
      layer: "islands",
    },
    {
      r2Key: ISLAND_SHELLS.islandsPack.r2Key,
      name: "islands_pack",
      layer: "islands",
      meshNames: [...ISLAND_SHELLS.islandsPack.meshNames],
    },
    {
      r2Key: ISLAND_SHELLS.chickenGun.r2Key,
      name: "chicken_gun_islands",
      layer: "islands",
      meshNames: [
        ...ISLAND_SHELLS.chickenGun.meshNames.islands,
        ...ISLAND_SHELLS.chickenGun.meshNames.palms,
      ],
    },
    {
      r2Key: ISLAND_SHELLS.tavern.r2Key,
      name: "shallowstead_pirate_tavern",
      layer: "landmarks",
    },
    {
      r2Key: REDWOOD_PACK.r2Key,
      name: "stylised_redwood_trees",
      layer: "nature",
      meshNames: REDWOOD_PACK.variants.flatMap((v) => [v.wood, v.branch]),
    },
    {
      r2Key: PLANTS_PACK.r2Key,
      name: "plants_asset_set",
      layer: "harvest",
      meshNames: [...PLANTS_PACK.meshNames],
    },
  ];
}
