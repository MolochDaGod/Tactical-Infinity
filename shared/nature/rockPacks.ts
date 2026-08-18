/**
 * Stylized rocks + woods rocks/foliage packs — island harvest seed SSOT.
 *
 * Binaries (R2 / assets.grudge-studio.com):
 *   models/nature/stylized/rocks/stylised_rocks.glb
 *   models/nature/stylized/harvest/rocks_and_foliage_woods.glb
 *
 * HARD RULE: isolate meshName — never place whole multipack as one entity.
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

export const ROCK_PACK = {
  r2Key: "models/nature/stylized/rocks/stylised_rocks.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/rocks/stylised_rocks.glb`,
  local: "/models/nature/stylized/rocks/stylised_rocks.glb",
  name: "stylised_rocks",
} as const;

/**
 * Compact 70-rock multipack — preferred for **dig / mine debris** (small chunks).
 * Mesh names: Object_2 … Object_71
 */
export const ROCKS_70_PACK = {
  r2Key: "models/nature/stylized/rocks/70_stylized_rocks.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/rocks/70_stylized_rocks.glb`,
  local: "/models/nature/stylized/rocks/70_stylized_rocks.glb",
  name: "70_stylized_rocks",
} as const;

/** Object_2 … Object_71 from 70_stylized_rocks.glb */
export const ROCKS_70_MESHES = Array.from(
  { length: 70 },
  (_, i) => `Object_${i + 2}`,
);

export const WOODS_FOLIAGE_PACK = {
  r2Key: "models/nature/stylized/harvest/rocks_and_foliage_woods.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/harvest/rocks_and_foliage_woods.glb`,
  local: "/models/nature/stylized/harvest/rocks_and_foliage_woods.glb",
  name: "rocks_and_foliage_woods",
} as const;

/** Plain rock variants 1–32 (stylised pack). */
export const PLAIN_ROCKS = Array.from(
  { length: 32 },
  (_, i) => `Plain_Rock${i + 1}`,
);

/** Mossy rock variants 1–32. */
export const MOSSY_ROCKS = Array.from(
  { length: 32 },
  (_, i) => `Mossy_Rock${i + 1}`,
);

/** Snowy rock variants (pack has Snowy_Rock1–31 + SnowyRock32-style). */
export const SNOWY_ROCKS = [
  ...Array.from({ length: 31 }, (_, i) => `Snowy_Rock${i + 1}`),
  "SnowyRock32",
].filter(Boolean);

/** Desert rock variants 1–32. */
export const DESERT_ROCKS = Array.from(
  { length: 32 },
  (_, i) => `Desert_Rock${i + 1}`,
);

/** Cluster / group props (landmarks, not per-node harvest preferred). */
export const ROCK_GROUPS = [
  ...Array.from({ length: 14 }, (_, i) => `Plain_Rock_Group${i + 1}`),
  ...Array.from({ length: 14 }, (_, i) => `Mossy_Rock_Group${i + 1}`),
  ...Array.from({ length: 14 }, (_, i) => `Snowy_Rock_Group${i + 1}`),
  ...Array.from({ length: 14 }, (_, i) => `Desert_Rock_Group${i + 1}`),
];

/** Woods project — boulder-like icospheres + cube rocks. */
export const WOODS_ROCKS = [
  "Icosphere",
  "Icosphere.001",
  "Icosphere.002",
  "Icosphere.003",
  "Icosphere.004",
  "Icosphere.005",
  "Icosphere.006",
  "Icosphere.007",
  "Icosphere.008",
  "Icosphere.009",
  "Icosphere.010",
  "Icosphere.011",
  "Icosphere.012",
  "Icosphere.013",
  "Icosphere.014",
  "Icosphere.015",
  "Icosphere.016",
  "Icosphere.017",
  "Icosphere.018",
  "Icosphere.019",
  "Icosphere.020",
  "Icosphere.021",
  "Icosphere.022",
  "Icosphere.036",
  "Cube.001",
  "Cube.002",
  "Cube.003",
  "Cube.005",
  "Cube.008",
  "Cube.015",
  "Cube.022",
  "Cube.023",
];

/** Woods grass / bush / leaf-plane foliage. */
export const WOODS_FOLIAGE = [
  "grass",
  "grass bush",
  "Plane.010",
  "Plane.011",
  "Plane.012",
  "Plane.013",
  "Plane.014",
  "Plane.015",
  "Plane.016",
  "Plane.017",
  "Plane.018",
  "Plane.037",
  "Plane.038",
  "Plane.039",
  "Plane.040",
  "Plane.041",
  "Plane.042",
  "Plane.043",
  "Plane.044",
  "Plane.045",
];

/** Default harvest scatter pool (home / sector beaches — plain + mossy). */
export const HARVEST_ROCK_SEEDS = [
  ...PLAIN_ROCKS.slice(0, 16),
  ...MOSSY_ROCKS.slice(0, 8),
];

/** Home island: denser plain + mossy, some woods boulders. */
export const HOME_ISLAND_ROCK_SEEDS = [
  ...PLAIN_ROCKS.slice(0, 12),
  ...MOSSY_ROCKS.slice(0, 10),
  ...WOODS_ROCKS.slice(0, 6),
];

/** Event islands: dramatic groups + desert/snow accents by rotation. */
export const EVENT_ISLAND_ROCK_SEEDS = [
  ...PLAIN_ROCKS.slice(8, 20),
  ...DESERT_ROCKS.slice(0, 6),
  ...MOSSY_ROCKS.slice(12, 20),
  ...ROCK_GROUPS.slice(0, 4),
];

/** Sector islands: balanced mix for ocean sectors. */
export const SECTOR_ISLAND_ROCK_SEEDS = [
  ...PLAIN_ROCKS.slice(0, 10),
  ...MOSSY_ROCKS.slice(0, 6),
  ...WOODS_ROCKS.slice(0, 4),
  ...WOODS_FOLIAGE.slice(0, 4),
];

export type IslandSeedKind = "home" | "event" | "sector" | "harvest" | "default";

export function rockSeedsForIsland(kind: IslandSeedKind): string[] {
  switch (kind) {
    case "home":
      return HOME_ISLAND_ROCK_SEEDS;
    case "event":
      return EVENT_ISLAND_ROCK_SEEDS;
    case "sector":
      return SECTOR_ISLAND_ROCK_SEEDS;
    case "harvest":
      return HARVEST_ROCK_SEEDS;
    default:
      return HARVEST_ROCK_SEEDS;
  }
}

export function pickRockMesh(
  kind: IslandSeedKind,
  index: number,
  worldSeed = 0,
): string {
  const pool = rockSeedsForIsland(kind);
  const i = (index + (worldSeed % 17)) % pool.length;
  return pool[i]!;
}

/** Biome → preferred rock family mesh list. */
export function rocksForBiome(
  biome: "plains" | "forest" | "snow" | "desert" | "beach" | "tropical",
): string[] {
  switch (biome) {
    case "snow":
      return SNOWY_ROCKS.slice(0, 16);
    case "desert":
      return DESERT_ROCKS.slice(0, 16);
    case "forest":
      return [...MOSSY_ROCKS.slice(0, 12), ...WOODS_ROCKS.slice(0, 8)];
    case "beach":
    case "tropical":
      return PLAIN_ROCKS.slice(0, 16);
    default:
      return HARVEST_ROCK_SEEDS;
  }
}

export const ROCK_PACK_MESH_META = {
  stylised_rocks: {
    ...ROCK_PACK,
    families: {
      plain: PLAIN_ROCKS,
      mossy: MOSSY_ROCKS,
      snowy: SNOWY_ROCKS,
      desert: DESERT_ROCKS,
      groups: ROCK_GROUPS,
    },
  },
  rocks_70: {
    ...ROCKS_70_PACK,
    families: {
      chunks: ROCKS_70_MESHES,
    },
  },
  rocks_and_foliage_woods: {
    ...WOODS_FOLIAGE_PACK,
    families: {
      rocks: WOODS_ROCKS,
      foliage: WOODS_FOLIAGE,
    },
  },
} as const;

// ── Dig / mine debris (smaller than placed harvest rocks) ──────────────────

export type RockDebrisContext = "dig" | "mine" | "harvest_break";

/**
 * Scale in metres for isolated pack meshes when used as flying/resting debris.
 * Placed harvest rocks stay ~1.5–2.5 m; debris is a fraction of that.
 */
export const ROCK_DEBRIS_SCALE: Record<
  RockDebrisContext,
  { min: number; max: number; count: number; impulse: number; life: number }
> = {
  /** Shovel dig / terrain lower — fine grit + pebbles */
  dig: { min: 0.08, max: 0.28, count: 6, impulse: 3.2, life: 4.5 },
  /** Mining out voxel / ore node volume */
  mine: { min: 0.12, max: 0.38, count: 10, impulse: 5.5, life: 5.5 },
  /** Harvest rock_chunk break burst */
  harvest_break: { min: 0.14, max: 0.42, count: 7, impulse: 4.8, life: 5.0 },
};

export type RockDebrisPick = {
  packKey: "70_stylized_rocks" | "stylised_rocks";
  packUrl: string;
  meshName: string;
  /** Uniform world scale for the isolated mesh */
  scale: number;
  targetHeightM: number;
};

/**
 * Pick a small rock mesh for dig/mine debris.
 * Prefers 70-pack Object_* for compact chunks; falls back to Plain_Rock* from stylised pack.
 */
export function pickRockDebrisMesh(
  ctx: RockDebrisContext,
  rand: () => number = Math.random,
): RockDebrisPick {
  const cfg = ROCK_DEBRIS_SCALE[ctx];
  const scale = cfg.min + rand() * (cfg.max - cfg.min);
  // ~70% use compact 70-pack, 30% plain rocks from large stylised pack
  if (rand() < 0.7) {
    const meshName =
      ROCKS_70_MESHES[Math.floor(rand() * ROCKS_70_MESHES.length)]!;
    return {
      packKey: "70_stylized_rocks",
      packUrl: ROCKS_70_PACK.cdn,
      meshName,
      scale,
      targetHeightM: scale,
    };
  }
  // Prefer smaller plain variants for dig grit
  const pool =
    ctx === "dig"
      ? PLAIN_ROCKS.slice(0, 16)
      : [...PLAIN_ROCKS.slice(0, 20), ...MOSSY_ROCKS.slice(0, 8)];
  const meshName = pool[Math.floor(rand() * pool.length)]!;
  return {
    packKey: "stylised_rocks",
    packUrl: ROCK_PACK.cdn,
    meshName,
    scale,
    targetHeightM: scale,
  };
}

/** Spec for DebrisPool.spawnBurst / visual rock debris systems. */
export function rockDebrisBurstSpec(ctx: RockDebrisContext) {
  const c = ROCK_DEBRIS_SCALE[ctx];
  return {
    count: c.count,
    impulse: c.impulse,
    lift: ctx === "mine" ? 1.35 : 1.1,
    life: c.life,
    instanced: true,
    fx: "dust" as const,
    scaleMin: c.min,
    scaleMax: c.max,
    packPreference: ["70_stylized_rocks", "stylised_rocks"] as const,
  };
}
