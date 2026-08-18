/**
 * Low-poly forest pack harvest SSOT.
 * Pack: public/models/fleet/harvest/low_poly_forest_pack.glb
 * Isolate by Sketchfab node name — never place the whole pack.
 *
 * 5 tree types × 3 examples. Cut-down: shake → fall → stump + logs.
 * Full set scatters on the existing home island. island (1) is the coastal islet only.
 */

export const FOREST_PACK_URL = '/models/fleet/harvest/low_poly_forest_pack.glb';

export type ForestTreeType = 'oak' | 'oak_old' | 'pine' | 'spruce' | 'birch';
export type ForestHarvestKind =
  | 'tree'
  | 'mushroom'
  | 'flower'
  | 'fern'
  | 'stone'
  | 'bush';

export type ForestYieldId = 'wood' | 'stone' | 'hemp' | 'fiber' | 'cloth' | 'food';

export interface ForestPart {
  /** Substring match on Object3D.name */
  node: string;
  kind: ForestHarvestKind;
  treeType?: ForestTreeType;
  yield: ForestYieldId;
  yieldAmt: number;
  hits: number;
  heightM: number;
}

/** Live trees — 5 types, 3 examples each. */
export const FOREST_TREES: readonly ForestPart[] = [
  { node: 'oak_Tree_Trunk_1', kind: 'tree', treeType: 'oak', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 9 },
  { node: 'oak_Tree_Trunk.001_10', kind: 'tree', treeType: 'oak', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 9 },
  { node: 'oak_Tree_Trunk.002_12', kind: 'tree', treeType: 'oak', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 8.5 },
  { node: 'oak_Tree_Trunk.003_14', kind: 'tree', treeType: 'oak_old', yield: 'wood', yieldAmt: 4, hits: 4, heightM: 10 },
  { node: 'oak_Tree_Trunk.004_16', kind: 'tree', treeType: 'oak_old', yield: 'wood', yieldAmt: 4, hits: 4, heightM: 10 },
  { node: 'oak_Tree_Trunk.005_18', kind: 'tree', treeType: 'oak_old', yield: 'wood', yieldAmt: 4, hits: 4, heightM: 9.5 },
  { node: 'pine_Tree_Trunk.006_20', kind: 'tree', treeType: 'pine', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 11 },
  { node: 'pine_Tree_Trunk.007_22', kind: 'tree', treeType: 'pine', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 11 },
  { node: 'pine_Tree_Trunk.008_24', kind: 'tree', treeType: 'pine', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 10.5 },
  { node: 'Tree_Trunk.009_26', kind: 'tree', treeType: 'spruce', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 10 },
  { node: 'Tree_Trunk.010_28', kind: 'tree', treeType: 'spruce', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 10 },
  { node: 'Tree_Trunk.011_30', kind: 'tree', treeType: 'spruce', yield: 'wood', yieldAmt: 3, hits: 3, heightM: 10 },
  { node: 'birch_Tree_Trunk.012_32', kind: 'tree', treeType: 'birch', yield: 'wood', yieldAmt: 2, hits: 2, heightM: 8 },
  { node: 'birch_Tree_Trunk.013_34', kind: 'tree', treeType: 'birch', yield: 'wood', yieldAmt: 2, hits: 2, heightM: 8 },
  { node: 'birch_Tree_Trunk.014_36', kind: 'tree', treeType: 'birch', yield: 'wood', yieldAmt: 2, hits: 2, heightM: 8 },
];

export const FOREST_STUMPS: Record<ForestTreeType, readonly string[]> = {
  oak: ['oak_stump.003_44', 'oak_stump.004_45'],
  oak_old: ['oak_stump.004_45', 'oak_stump.003_44'],
  pine: ['pine_stump_41', 'pine_stump.001_42'],
  spruce: ['pine_stump_41', 'pine_stump.001_42'],
  birch: ['birch_stump.002_43'],
};

export const FOREST_LOGS: Record<ForestTreeType, readonly string[]> = {
  oak: ['log.003_53'],
  oak_old: ['log.003_53'],
  pine: ['pine_log_40', 'pine_log.001_39'],
  spruce: ['pine_log_40', 'pine_log.001_39'],
  birch: ['birch_log.002_52'],
};

export const FOREST_MUSHROOMS: readonly ForestPart[] = [
  { node: 'fly_agaric_2', kind: 'mushroom', yield: 'food', yieldAmt: 1, hits: 1, heightM: 0.25 },
  { node: 'fly_agaric.001_8', kind: 'mushroom', yield: 'food', yieldAmt: 1, hits: 1, heightM: 0.25 },
  { node: 'ceps.001_6', kind: 'mushroom', yield: 'food', yieldAmt: 1, hits: 1, heightM: 0.2 },
  { node: 'ceps_7', kind: 'mushroom', yield: 'food', yieldAmt: 1, hits: 1, heightM: 0.2 },
  { node: 'honey_mushroom_37', kind: 'mushroom', yield: 'food', yieldAmt: 1, hits: 1, heightM: 0.18 },
  { node: 'chanterelle_38', kind: 'mushroom', yield: 'food', yieldAmt: 1, hits: 1, heightM: 0.16 },
];

export const FOREST_FOLIAGE: readonly ForestPart[] = [
  { node: 'fern.001_3', kind: 'fern', yield: 'fiber', yieldAmt: 1, hits: 1, heightM: 0.6 },
  { node: 'fern.002_4', kind: 'fern', yield: 'fiber', yieldAmt: 1, hits: 1, heightM: 0.6 },
  { node: 'fern_5', kind: 'fern', yield: 'fiber', yieldAmt: 1, hits: 1, heightM: 0.55 },
  { node: 'dandelion_flowers_64', kind: 'flower', yield: 'hemp', yieldAmt: 1, hits: 1, heightM: 0.35 },
];

export const FOREST_STONES: readonly ForestPart[] = [
  { node: 'stone.001_46', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 2, heightM: 0.7 },
  { node: 'stone.002_47', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 2, heightM: 0.75 },
  { node: 'stone.003_48', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 2, heightM: 0.7 },
  { node: 'stone.005_50', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 2, heightM: 0.65 },
  { node: 'mossed_stone.004_49', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 3, heightM: 0.85 },
  { node: 'mossed_stone.006_51', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 3, heightM: 0.9 },
  { node: 'mossed_stone.007_60', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 3, heightM: 0.8 },
  { node: 'mossed_stone.008_61', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 3, heightM: 0.85 },
  { node: 'mossed_stone.009_62', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 3, heightM: 0.8 },
  { node: 'mossed_stone_63', kind: 'stone', yield: 'stone', yieldAmt: 2, hits: 3, heightM: 0.9 },
];

export const FOREST_BUSHES: readonly ForestPart[] = [
  { node: 'light_bush.001_54', kind: 'bush', yield: 'cloth', yieldAmt: 1, hits: 2, heightM: 0.9 },
  { node: 'light_bush.002_55', kind: 'bush', yield: 'cloth', yieldAmt: 1, hits: 2, heightM: 0.9 },
  { node: 'light_bush.003_56', kind: 'bush', yield: 'fiber', yieldAmt: 1, hits: 2, heightM: 0.85 },
  { node: 'light_bush.004_57', kind: 'bush', yield: 'fiber', yieldAmt: 1, hits: 2, heightM: 0.85 },
  { node: 'dark_bush.005_65', kind: 'bush', yield: 'cloth', yieldAmt: 2, hits: 2, heightM: 1.1 },
  { node: 'dark_bush.006_66', kind: 'bush', yield: 'cloth', yieldAmt: 2, hits: 2, heightM: 1.1 },
  { node: 'dark_bush.007_67', kind: 'bush', yield: 'fiber', yieldAmt: 1, hits: 2, heightM: 1.0 },
  { node: 'dark_bush_68', kind: 'bush', yield: 'fiber', yieldAmt: 1, hits: 2, heightM: 1.0 },
];

export const ALL_FOREST_PARTS: readonly ForestPart[] = [
  ...FOREST_TREES,
  ...FOREST_MUSHROOMS,
  ...FOREST_FOLIAGE,
  ...FOREST_STONES,
  ...FOREST_BUSHES,
];

export function treesOfType(t: ForestTreeType): ForestPart[] {
  return FOREST_TREES.filter((p) => p.treeType === t);
}
