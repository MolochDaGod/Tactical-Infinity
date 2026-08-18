/**
 * Foliage growth SSOT — florida_foliage + plant_generation_only_leaves.
 *
 * Use cases:
 *  1. Animated green growth **on rocks** over world time (moss / creep)
 *  2. **Respawn trees** — leaf stages from plant_generation_only_leaves
 *  3. Wind-sway shaders on foliage instances
 *
 * Binaries (CDN):
 *   models/nature/stylized/harvest/florida_foliage.glb
 *   models/nature/stylized/harvest/plant_generation_only_leaves.glb
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

export const FLORIDA_FOLIAGE_PACK = {
  key: "florida_foliage",
  r2Key: "models/nature/stylized/harvest/florida_foliage.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/harvest/florida_foliage.glb`,
  local: "/models/nature/stylized/harvest/florida_foliage.glb",
  variants: [
    { id: "fern", meshName: "fern_3", targetHeightM: 0.85, role: "ground" as const },
    { id: "fern1", meshName: "fern1_5", targetHeightM: 0.9, role: "ground" as const },
    { id: "leaves_bush", meshName: "leaves02_7", targetHeightM: 1.1, role: "bush" as const },
    { id: "palm_plant", meshName: "palm_plant03_13", targetHeightM: 1.4, role: "tropical" as const },
    { id: "trunk_small", meshName: "trunk01_10", targetHeightM: 2.2, role: "trunk" as const },
    { id: "trunk_palm", meshName: "trunk03_15", targetHeightM: 2.8, role: "trunk" as const },
  ],
} as const;

/**
 * Ivy / leaf generation multipack — ~288 leaf meshes (gwIvy001_mesh_2_N).
 * Use as **regrow canopy stages** for trees and green creep on rocks.
 */
export const LEAF_GENERATION_PACK = {
  key: "plant_generation_only_leaves",
  r2Key: "models/nature/stylized/harvest/plant_generation_only_leaves.glb",
  cdn: `${WARLORDS_CDN}/models/nature/stylized/harvest/plant_generation_only_leaves.glb`,
  local: "/models/nature/stylized/harvest/plant_generation_only_leaves.glb",
  /** Prefixed leaf isolations */
  meshPrefix: "gwIvy001_mesh_2_",
  leafCount: 288,
  targetHeightM: 0.6,
} as const;

export function leafMeshName(index: number): string {
  const i = ((index % LEAF_GENERATION_PACK.leafCount) + LEAF_GENERATION_PACK.leafCount) %
    LEAF_GENERATION_PACK.leafCount;
  return `${LEAF_GENERATION_PACK.meshPrefix}${i}`;
}

/** Sample N leaf mesh names for a regrow stage (0..1). */
export function leavesForRegrowStage(
  stage01: number,
  seed = 0,
  maxLeaves = 12,
): string[] {
  const t = Math.max(0, Math.min(1, stage01));
  // Stage 0: bare stump (0 leaves); stage 1: full canopy
  const count = Math.max(0, Math.round(t * maxLeaves));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(leafMeshName(seed * 17 + i * 3 + Math.floor(t * 40)));
  }
  return out;
}

// ── Moss / green growth on rocks over world time ───────────────────────────

export type MossGrowthConfig = {
  /** Seconds of world time from bare rock → full moss */
  growDurationSec: number;
  /** Peak green tint (linear RGB) */
  mossColor: [number, number, number];
  /** Wind sway amplitude on moss layer */
  wind: number;
  /** How much leaf-mesh overlay to spawn at full growth */
  leafOverlayAtFull: number;
};

export const DEFAULT_MOSS_GROWTH: MossGrowthConfig = {
  growDurationSec: 180, // 3 min full creep (gameplay-friendly)
  mossColor: [0.18, 0.42, 0.16],
  wind: 0.22,
  leafOverlayAtFull: 4,
};

/**
 * Moss amount on a rock after `elapsedSec` since last bare / dig.
 * Optional rain / humidity multiplier.
 */
export function mossGrowth01(
  elapsedSec: number,
  cfg: MossGrowthConfig = DEFAULT_MOSS_GROWTH,
  humidity = 1,
): number {
  const d = Math.max(1, cfg.growDurationSec / Math.max(0.25, humidity));
  return Math.max(0, Math.min(1, elapsedSec / d));
}

/**
 * Leaf overlays to attach to a rock at current moss growth
 * (creeping ivy from plant_generation_only_leaves).
 */
export function rockMossLeafMeshes(
  growth01: number,
  rockSeed: number,
  cfg: MossGrowthConfig = DEFAULT_MOSS_GROWTH,
): string[] {
  if (growth01 < 0.15) return [];
  const n = Math.round(growth01 * cfg.leafOverlayAtFull);
  return leavesForRegrowStage(growth01, rockSeed, n);
}

// ── Tree respawn leaf stages ───────────────────────────────────────────────

export type TreeRegrowVisual = {
  /** 0 bare / stump, 1 full canopy */
  stage01: number;
  /** Trunk / base mesh key (redwood wood or florida trunk) */
  trunkMesh?: string;
  trunkPack?: string;
  /** Leaf isolations from plant_generation_only_leaves */
  leafMeshes: string[];
  /** Uniform scale for leaf cluster */
  leafScale: number;
  /** Florida fern understory at late stages */
  understory?: { pack: string; meshName: string; heightM: number }[];
};

/**
 * Build visual plan for a regenerating tree from harvest regrow progress.
 */
export function treeRegrowVisual(
  regrow01: number,
  seed: number,
  opts?: { trunkMesh?: string; trunkPack?: string },
): TreeRegrowVisual {
  const t = Math.max(0, Math.min(1, regrow01));
  const leafMeshes = leavesForRegrowStage(t, seed, 16);
  const understory: TreeRegrowVisual["understory"] = [];
  if (t > 0.45) {
    const fern = FLORIDA_FOLIAGE_PACK.variants[seed % 2]!;
    understory.push({
      pack: FLORIDA_FOLIAGE_PACK.key,
      meshName: fern.meshName,
      heightM: fern.targetHeightM * (0.5 + t * 0.5),
    });
  }
  if (t > 0.7) {
    const bush = FLORIDA_FOLIAGE_PACK.variants[2]!;
    understory.push({
      pack: FLORIDA_FOLIAGE_PACK.key,
      meshName: bush.meshName,
      heightM: bush.targetHeightM * t,
    });
  }
  return {
    stage01: t,
    trunkMesh: opts?.trunkMesh,
    trunkPack: opts?.trunkPack,
    leafMeshes,
    leafScale: 0.35 + t * 0.85,
    understory,
  };
}

/** Harvest regrowStages defaults that match leaf visual bands */
export const FOLIAGE_REGROW_STAGES = [0.2, 0.45, 0.7, 1.0] as const;

export function allFoliageR2Entries() {
  return [
    {
      r2Key: FLORIDA_FOLIAGE_PACK.r2Key,
      name: FLORIDA_FOLIAGE_PACK.key,
      layer: "harvest",
      meshNames: FLORIDA_FOLIAGE_PACK.variants.map((v) => v.meshName),
      roles: ["green", "sector", "moss", "understory"],
    },
    {
      r2Key: LEAF_GENERATION_PACK.r2Key,
      name: LEAF_GENERATION_PACK.key,
      layer: "harvest",
      meshNames: Array.from({ length: 24 }, (_, i) => leafMeshName(i)),
      roles: ["tree_regrow", "moss_creep", "animated_green"],
      metaExtra: {
        leafCount: LEAF_GENERATION_PACK.leafCount,
        meshPrefix: LEAF_GENERATION_PACK.meshPrefix,
      },
    },
  ];
}
