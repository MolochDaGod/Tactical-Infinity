/**
 * Extended environment packs — underwater, nature trees, smeltery, ivy, lily, mountain cave.
 * Isolate multipacks by meshName; mountain/smeltery may load as landmark shells.
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

// ── Underwater coral / alien plants ────────────────────────────────────────

export const ALIEN_PLANTS_PACK = {
  key: "alien_plants_kit",
  r2Key: "models/nature/stylized/underwater/alien_plants_kit.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/underwater/alien_plants_kit.glb`,
  local: "/models/nature/stylized/underwater/alien_plants_kit.glb",
  roles: ["underwater", "coral", "reef", "sector", "event", "beach_shallow"],
  /** Parent group names (isolate these, not Material_0 leaves) */
  variants: Array.from({ length: 11 }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    return {
      id: `alien_plant_${n}`,
      meshName: `Alien Plant_${n}_gameasset`,
      targetHeightM: 0.8 + (i % 4) * 0.25,
    };
  }),
} as const;

// ── Stylized nature pack vol.1 trees ───────────────────────────────────────

export const NATURE_PACK_VOL1 = {
  key: "stylized_nature_pack_vol1",
  r2Key: "models/nature/stylized/biome/stylized_nature_pack_vol1.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/biome/stylized_nature_pack_vol1.glb`,
  local: "/models/nature/stylized/biome/stylized_nature_pack_vol1.glb",
  roles: ["island", "event", "map", "sector", "forest"],
  meshNames: ["Object_2", "Object_3", "Object_4", "Object_5", "Object_6"],
  targetHeightM: 5.5,
} as const;

// ── Faction blacksmith / smeltery ──────────────────────────────────────────

export const SMELTERY_PACK = {
  key: "stylized_smeltery_setup",
  r2Key: "models/buildings/smeltery/stylized_smeltery_setup.glb",
  cdn: `${WARLORDS_CDN}/models/buildings/smeltery/stylized_smeltery_setup.glb`,
  local: "/models/buildings/smeltery/stylized_smeltery_setup.glb",
  roles: ["blacksmith", "faction", "production", "landmark"],
  targetHeightM: 6,
  /**
   * Key placeable / isolate groups for forge areas.
   * Full pack can also be placed as a compound blacksmith yard.
   */
  isolations: {
    barrels: ["Barrel_Final.001", "Barrel_Final.004", "Barrel_Final.028"],
    anvilTools: ["Toolsmith.119", "Toolsmith.132", "Toolsmith.139", "Toolsmith.157"],
    structure: ["Cube.437", "Cube.436", "Circle", "Circle.004"],
    crates: ["box_low_poly", "box_low_poly.001"],
    lanterns: ["Lantern.003", "Lantern.004"],
    rocks: ["M_Rock_04.002", "M_Rock_04.003", "M_Rock_04.008"],
  },
  /** Per-faction tint hint (UI / material multiply) */
  factionTints: {
    crusade: "#c9b896",
    fabled: "#7ecb8a",
    legion: "#a05050",
    pirate: "#d4a437",
    barbarian: "#b08050",
    neutral: "#a09080",
  } as Record<string, string>,
} as const;

// ── Game-ready ivy (drape / place / grow) ──────────────────────────────────

export const GAMEREADY_IVY_PACK = {
  key: "gameready_ivy",
  r2Key: "models/nature/stylized/harvest/gameready_ivy.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/harvest/gameready_ivy.glb`,
  local: "/models/nature/stylized/harvest/gameready_ivy.glb",
  roles: ["ivy", "drape", "grow", "island_polish", "texture", "mountain"],
  curves: [
    "IVY_Curve_2",
    "IVY_Curve.001_4",
    "IVY_Curve.002_6",
    "IVY_Curve.003_8",
    "IVY_Curve.004_10",
    "IVY_Curve.005_12",
    "IVY_Curve.006_14",
    "IVY_Curve.007_16",
  ],
  leaves: [
    "IvyLeaf_1",
    "IvyLeaf.001_3",
    "IvyLeaf.002_5",
    "IvyLeaf.003_7",
    "IvyLeaf.004_9",
    "IvyLeaf.005_11",
    "IvyLeaf.006_13",
    "IvyLeaf.007_15",
  ],
  /** Growth stages use more curve segments + leaves over time */
  growthStageCount: 8,
} as const;

/** Ivy segments visible at growth 0..1 */
export function ivyGrowthMeshes(growth01: number): {
  curves: string[];
  leaves: string[];
} {
  const t = Math.max(0, Math.min(1, growth01));
  const n = Math.max(1, Math.round(t * GAMEREADY_IVY_PACK.growthStageCount));
  return {
    curves: GAMEREADY_IVY_PACK.curves.slice(0, n),
    leaves: GAMEREADY_IVY_PACK.leaves.slice(0, n),
  };
}

// ── Asiatic lily (mountain islands without dungeon) ────────────────────────

export const ASIATIC_LILY_PACK = {
  key: "asiatic_lily",
  r2Key: "models/nature/stylized/harvest/asiatic_lily.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/harvest/asiatic_lily.glb`,
  local: "/models/nature/stylized/harvest/asiatic_lily.glb",
  roles: ["mountain", "no_dungeon", "flower", "event"],
  variants: ["GFAL01", "GFAL04", "GFAL05", "GFAL01_dup_2", "GFAL05_dup_2"],
  targetHeightM: 1.1,
} as const;

// ── Rock mountain with cave (dungeon entrance) ─────────────────────────────

export const MOUNTAIN_CAVE_PACK = {
  key: "rock_mountain_with_cave",
  r2Key: "models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb",
  cdn: `${WARLORDS_CDN}/models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb`,
  local: "/models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb",
  roles: ["mountain", "dungeon_entrance", "sector", "event", "instance"],
  meshName:
    "Rock Mountain with cave realistic 85k by JJ_gameasset",
  targetHeightM: 48,
  /** World-space offset hint for dungeon portal relative to mountain origin */
  caveEntranceLocal: { x: 0, y: 4, z: 12 },
} as const;

export type MountainIslandMode = "scenic_lilies" | "dungeon_cave";

/**
 * Mountain island decoration plan.
 * - No dungeon → scatter asiatic lilies + optional ivy
 * - With dungeon → mountain cave shell + entrance marker
 */
export function mountainIslandPlan(mode: MountainIslandMode, seed = 0) {
  if (mode === "dungeon_cave") {
    return {
      mode,
      shell: {
        pack: MOUNTAIN_CAVE_PACK.key,
        meshName: MOUNTAIN_CAVE_PACK.meshName,
        path: MOUNTAIN_CAVE_PACK.cdn,
        targetHeightM: MOUNTAIN_CAVE_PACK.targetHeightM,
      },
      dungeonEntrance: MOUNTAIN_CAVE_PACK.caveEntranceLocal,
      flowers: [] as string[],
      ivyGrowth: 0.35,
    };
  }
  const flowers = ASIATIC_LILY_PACK.variants.map((v, i) => ({
    meshName: v,
    yaw: ((seed + i) * 0.7) % (Math.PI * 2),
  }));
  return {
    mode,
    shell: null,
    dungeonEntrance: null,
    flowers,
    ivyGrowth: 0.55,
  };
}

/** Faction blacksmith placement descriptor */
export function factionSmeltery(faction: string) {
  const tint =
    SMELTERY_PACK.factionTints[faction] ?? SMELTERY_PACK.factionTints.neutral;
  return {
    pack: SMELTERY_PACK.key,
    path: SMELTERY_PACK.cdn,
    targetHeightM: SMELTERY_PACK.targetHeightM,
    faction,
    tint,
    buildingId: "bld.forge",
    isolations: SMELTERY_PACK.isolations,
  };
}

export function allEnvironmentR2Entries() {
  return [
    {
      r2Key: ALIEN_PLANTS_PACK.r2Key,
      name: ALIEN_PLANTS_PACK.key,
      layer: "underwater",
      meshNames: ALIEN_PLANTS_PACK.variants.map((v) => v.meshName),
      roles: ALIEN_PLANTS_PACK.roles,
    },
    {
      r2Key: NATURE_PACK_VOL1.r2Key,
      name: NATURE_PACK_VOL1.key,
      layer: "nature",
      meshNames: [...NATURE_PACK_VOL1.meshNames],
      roles: NATURE_PACK_VOL1.roles,
    },
    {
      r2Key: SMELTERY_PACK.r2Key,
      name: SMELTERY_PACK.key,
      layer: "buildings",
      meshNames: [
        ...SMELTERY_PACK.isolations.barrels,
        ...SMELTERY_PACK.isolations.anvilTools.slice(0, 2),
      ],
      roles: SMELTERY_PACK.roles,
    },
    {
      r2Key: GAMEREADY_IVY_PACK.r2Key,
      name: GAMEREADY_IVY_PACK.key,
      layer: "harvest",
      meshNames: [
        ...GAMEREADY_IVY_PACK.curves,
        ...GAMEREADY_IVY_PACK.leaves,
      ],
      roles: GAMEREADY_IVY_PACK.roles,
    },
    {
      r2Key: ASIATIC_LILY_PACK.r2Key,
      name: ASIATIC_LILY_PACK.key,
      layer: "harvest",
      meshNames: [...ASIATIC_LILY_PACK.variants],
      roles: ASIATIC_LILY_PACK.roles,
    },
    {
      r2Key: MOUNTAIN_CAVE_PACK.r2Key,
      name: MOUNTAIN_CAVE_PACK.key,
      layer: "nature",
      meshNames: [MOUNTAIN_CAVE_PACK.meshName],
      roles: MOUNTAIN_CAVE_PACK.roles,
    },
  ];
}
