export type GridSize = '1x1' | '1x2' | '2x1' | '2x2' | '2x3' | '3x2' | '3x3' | '4x4';
export type AssetCategory = 'building' | 'resource' | 'crafting' | 'decoration';

export interface GameAsset {
  id: string;
  name: string;
  category: AssetCategory;
  subcategory: string;
  gridSize: GridSize;
  harvestable?: boolean;
  harvestYield?: string;
  xpReward?: number;
  respawnMs?: number;
}

export const GRID_SIZE_DIMENSIONS: Record<GridSize, { width: number; height: number }> = {
  '1x1': { width: 1, height: 1 },
  '1x2': { width: 1, height: 2 },
  '2x1': { width: 2, height: 1 },
  '2x2': { width: 2, height: 2 },
  '2x3': { width: 2, height: 3 },
  '3x2': { width: 3, height: 2 },
  '3x3': { width: 3, height: 3 },
  '4x4': { width: 4, height: 4 },
};

export const BUILDINGS: GameAsset[] = [
  { id: 'house_small', name: 'Small House', category: 'building', subcategory: 'residential', gridSize: '2x2' },
  { id: 'house_medium', name: 'Medium House', category: 'building', subcategory: 'residential', gridSize: '3x2' },
  { id: 'house_large', name: 'Large House', category: 'building', subcategory: 'residential', gridSize: '3x3' },
  { id: 'barracks', name: 'Barracks', category: 'building', subcategory: 'military', gridSize: '3x3' },
  { id: 'archery_range', name: 'Archery Range', category: 'building', subcategory: 'military', gridSize: '2x3' },
  { id: 'market_stall', name: 'Market Stall', category: 'building', subcategory: 'commerce', gridSize: '2x2' },
  { id: 'warehouse', name: 'Warehouse', category: 'building', subcategory: 'storage', gridSize: '3x3' },
  { id: 'dock', name: 'Dock', category: 'building', subcategory: 'harbor', gridSize: '2x3' },
  { id: 'watchtower', name: 'Watch Tower', category: 'building', subcategory: 'defense', gridSize: '2x2' },
  { id: 'temple', name: 'Temple', category: 'building', subcategory: 'religious', gridSize: '4x4' },
  { id: 'farm', name: 'Farm', category: 'building', subcategory: 'production', gridSize: '3x3' },
  { id: 'windmill', name: 'Windmill', category: 'building', subcategory: 'production', gridSize: '2x2' },
];

export const HARVESTABLE_RESOURCES: GameAsset[] = [
  { id: 'ore_copper', name: 'Copper Vein', category: 'resource', subcategory: 'mining', gridSize: '1x1', harvestable: true, harvestYield: 'copper_ore', xpReward: 10, respawnMs: 300000 },
  { id: 'ore_iron', name: 'Iron Vein', category: 'resource', subcategory: 'mining', gridSize: '1x1', harvestable: true, harvestYield: 'iron_ore', xpReward: 15, respawnMs: 300000 },
  { id: 'ore_mithril', name: 'Mithril Vein', category: 'resource', subcategory: 'mining', gridSize: '1x1', harvestable: true, harvestYield: 'mithril_ore', xpReward: 25, respawnMs: 600000 },
  { id: 'ore_rare', name: 'Rare Ore Deposit', category: 'resource', subcategory: 'mining', gridSize: '2x2', harvestable: true, harvestYield: 'rare_ore', xpReward: 50, respawnMs: 900000 },
  { id: 'herb_silverleaf', name: 'Silverleaf', category: 'resource', subcategory: 'herbalism', gridSize: '1x1', harvestable: true, harvestYield: 'silverleaf', xpReward: 8, respawnMs: 180000 },
  { id: 'herb_mageroyal', name: 'Mageroyal', category: 'resource', subcategory: 'herbalism', gridSize: '1x1', harvestable: true, harvestYield: 'mageroyal', xpReward: 12, respawnMs: 240000 },
  { id: 'herb_fadeleaf', name: 'Fadeleaf', category: 'resource', subcategory: 'herbalism', gridSize: '1x1', harvestable: true, harvestYield: 'fadeleaf', xpReward: 20, respawnMs: 360000 },
  { id: 'tree_oak', name: 'Oak Tree', category: 'resource', subcategory: 'woodcutting', gridSize: '2x2', harvestable: true, harvestYield: 'oak_log', xpReward: 12, respawnMs: 600000 },
  { id: 'tree_birch', name: 'Birch Tree', category: 'resource', subcategory: 'woodcutting', gridSize: '2x2', harvestable: true, harvestYield: 'birch_log', xpReward: 10, respawnMs: 480000 },
  { id: 'tree_ancient', name: 'Ancient Tree', category: 'resource', subcategory: 'woodcutting', gridSize: '3x3', harvestable: true, harvestYield: 'ancient_wood', xpReward: 75, respawnMs: 1800000 },
  { id: 'fish_spot_shallow', name: 'Shallow Fishing Spot', category: 'resource', subcategory: 'fishing', gridSize: '1x1', harvestable: true, harvestYield: 'raw_fish', xpReward: 8, respawnMs: 120000 },
  { id: 'fish_spot_deep', name: 'Deep Fishing Spot', category: 'resource', subcategory: 'fishing', gridSize: '2x1', harvestable: true, harvestYield: 'deep_fish', xpReward: 18, respawnMs: 240000 },
  { id: 'crystal_small', name: 'Crystal Cluster', category: 'resource', subcategory: 'mining', gridSize: '1x1', harvestable: true, harvestYield: 'crystal_shard', xpReward: 25, respawnMs: 720000 },
  { id: 'ley_line', name: 'Ley Line Node', category: 'resource', subcategory: 'arcane', gridSize: '2x2', harvestable: true, harvestYield: 'mana_essence', xpReward: 100, respawnMs: 1200000 },
];

export const CRAFTING_STATIONS: GameAsset[] = [
  { id: 'forge', name: 'Forge', category: 'crafting', subcategory: 'blacksmithing', gridSize: '2x2' },
  { id: 'anvil', name: 'Anvil', category: 'crafting', subcategory: 'blacksmithing', gridSize: '1x1' },
  { id: 'alchemy_table', name: 'Alchemy Table', category: 'crafting', subcategory: 'alchemy', gridSize: '2x2' },
  { id: 'cauldron', name: 'Cauldron', category: 'crafting', subcategory: 'alchemy', gridSize: '1x1' },
  { id: 'workbench', name: 'Workbench', category: 'crafting', subcategory: 'carpentry', gridSize: '2x1' },
  { id: 'loom', name: 'Loom', category: 'crafting', subcategory: 'tailoring', gridSize: '2x2' },
  { id: 'cooking_fire', name: 'Cooking Fire', category: 'crafting', subcategory: 'cooking', gridSize: '1x1' },
  { id: 'enchanting_table', name: 'Enchanting Table', category: 'crafting', subcategory: 'enchanting', gridSize: '2x2' },
  { id: 'jewelers_bench', name: "Jeweler's Bench", category: 'crafting', subcategory: 'jewelcrafting', gridSize: '2x1' },
  { id: 'tanning_rack', name: 'Tanning Rack', category: 'crafting', subcategory: 'leatherworking', gridSize: '2x2' },
];

export const ALL_ASSETS: GameAsset[] = [
  ...BUILDINGS,
  ...HARVESTABLE_RESOURCES,
  ...CRAFTING_STATIONS,
];
