/**
 * IslandConfig — per-biome registry that replaces hardcoded constants in the
 * canonical pipeline. Each entry holds the world size/area, max terrain
 * height, water depth, and category-keyed asset lists (trees, rocks, plants,
 * land animals, fish, sea creatures) with density per category.
 *
 * Consumed by `IslandSceneBuilder` and `LandScatter`.
 */
import type { IslandBiomePreset } from './IslandSceneBuilder';
import { getIslandConfigOverride } from '../adminOverrides';

export type AnimalSpecies = 'boar' | 'deer' | 'rabbit' | 'fox' | 'bear' | 'wolf';
export type TreeSpecies   = 'common_1' | 'common_2' | 'common_3' | 'pine_1' | 'pine_2' | 'pine_3'
                          | 'twisted_1' | 'twisted_2' | 'dead_1';
export type RockSpecies   = 'rock_1' | 'rock_2' | 'rock_3' | 'cliff_rock' | 'boulder_rock';
export type PlantSpecies  = 'fern' | 'plant_1' | 'bush' | 'bush_flowers' | 'clover'
                          | 'grass_short' | 'grass_tall' | 'mushroom'
                          | 'hemp' | 'periwinkle' | 'celandine';
export type FlowerSpecies = 'flower_3_group' | 'flower_3_single'
                          | 'flower_4_group' | 'flower_4_single';
/**
 * Harvestable resource nodes. Rendered by `HarvestNodeSystem` using real GLB
 * meshes (a crystal-cluster scan for gem/mythril/gold; a chunky boulder scan
 * for stone/iron/copper), metric-normalized and tinted per type. Each node has
 * HP, chips down as it's mined, drops loot, and respawns on a timer. Placement
 * is mountain-biased (steep slope OR upper altitude band) so harvesting feels
 * like proper resource gathering, not foraging.
 */
export type HarvestSpecies = 'stone' | 'iron' | 'copper' | 'gold' | 'mythril' | 'crystal';

export interface IslandAssetCategory<T extends string> {
  /** Allowed species keys for this biome. */
  species: T[];
  /** Approximate count per 100 m². */
  density: number;
  /** Hard min/max for the resulting count. */
  min?: number;
  max?: number;
}

export interface IslandConfig {
  id: IslandBiomePreset;
  label: string;
  /** Side length of the world in metres. */
  worldSize: number;
  /** Approximate land area in m² (used for density math). */
  area: number;
  /** Maximum terrain peak height (above sea level). */
  maxHeight: number;
  /** Maximum water depth in feet (positive number). Seafloor sits at -waterDepth. */
  waterDepth: number;
  /** Asset categories. */
  trees:    IslandAssetCategory<TreeSpecies>;
  rocks:    IslandAssetCategory<RockSpecies>;
  plants:   IslandAssetCategory<PlantSpecies>;
  flowers:  IslandAssetCategory<FlowerSpecies>;
  animals:  IslandAssetCategory<AnimalSpecies>;
  /** Mountain-biased ore deposits (stone, iron, copper, gold, mythril). */
  harvestNodes: IslandAssetCategory<HarvestSpecies>;
  /**
   * Sea creature population — counts per category for `SeaCreatures`. Crabs
   * are procedural; singles/schools/whales come from the curated fish-GLB
   * lists. `schoolSize` is the average member count per school.
   */
  seaCreatures: {
    crabs: number;
    singles: number;
    schools: number;
    schoolSize: number;
    squid: number;
    whales: number;
    spawnCenter?: { x: number; z: number };
  };
  /** PBR pack ids from `sanctuaryIsle/groundLayers` for terrain blending. */
  terrainPacks: { sand: string; ground: string; cliff: string };
}

const DEFAULT_WORLD = 1024;
const DEFAULT_AREA  = Math.PI * (256 * 0.4) ** 2;

export const ISLAND_CONFIGS: Record<IslandBiomePreset, IslandConfig> = {
  tropical: {
    id: 'tropical', label: 'Tropical Paradise',
    worldSize: DEFAULT_WORLD, area: DEFAULT_AREA, maxHeight: 26, waterDepth: 20,
    trees:   { species: ['common_1','common_2','common_3','twisted_1','twisted_2'], density: 0.18, min: 40, max: 200 },
    rocks:   { species: ['rock_1','rock_2','rock_3','cliff_rock'],                 density: 0.06, min: 12, max: 60 },
    plants:  { species: ['fern','bush','bush_flowers','clover','grass_short','grass_tall','periwinkle','celandine'], density: 0.28, min: 70, max: 320 },
    flowers: { species: ['flower_3_group','flower_4_group','flower_3_single'],     density: 0.10, min: 20, max: 90 },
    animals: { species: ['boar','deer','rabbit','fox'],                            density: 0.005, min: 8, max: 18 },
    harvestNodes: { species: ['stone','copper','iron','crystal'],                  density: 0.014, min: 8, max: 26 },
    seaCreatures: { crabs: 24, singles: 18, schools: 5, schoolSize: 14, squid: 5, whales: 2 },
    terrainPacks: { sand: 'coast_sand_01', ground: 'aerial_grass_rock', cliff: 'rock_pitted_mossy' },
  },
  temperate: {
    id: 'temperate', label: 'Temperate Highlands',
    worldSize: DEFAULT_WORLD, area: DEFAULT_AREA, maxHeight: 36, waterDepth: 20,
    trees:   { species: ['common_1','common_2','pine_1','pine_2','pine_3','dead_1'], density: 0.22, min: 50, max: 220 },
    rocks:   { species: ['rock_1','rock_2','rock_3','cliff_rock','boulder_rock'],    density: 0.10, min: 16, max: 80 },
    plants:  { species: ['fern','bush','bush_flowers','plant_1','grass_tall','mushroom','hemp','periwinkle'], density: 0.22, min: 60, max: 260 },
    flowers: { species: ['flower_3_single','flower_4_single','flower_3_group'],      density: 0.06, min: 12, max: 60 },
    animals: { species: ['deer','rabbit','fox','wolf','bear'],                       density: 0.006, min: 8, max: 20 },
    harvestNodes: { species: ['stone','iron','copper','crystal'],                    density: 0.016, min: 10, max: 30 },
    seaCreatures: { crabs: 16, singles: 12, schools: 3, schoolSize: 10, squid: 4, whales: 2 },
    terrainPacks: { sand: 'coast_sand_03', ground: 'forrest_ground_01', cliff: 'rock_pitted_mossy' },
  },
  volcanic: {
    id: 'volcanic', label: 'Volcanic Wastes',
    worldSize: DEFAULT_WORLD, area: DEFAULT_AREA, maxHeight: 48, waterDepth: 20,
    trees:   { species: ['dead_1','twisted_1','twisted_2'],                         density: 0.05, min: 10, max: 50 },
    rocks:   { species: ['rock_1','rock_2','rock_3','cliff_rock','boulder_rock'],   density: 0.18, min: 30, max: 120 },
    plants:  { species: ['mushroom','grass_short'],                                 density: 0.04, min: 8, max: 40 },
    flowers: { species: [],                                                          density: 0.0, min: 0, max: 0 },
    animals: { species: ['boar','wolf'],                                            density: 0.002, min: 4, max: 8 },
    harvestNodes: { species: ['stone','iron','gold','mythril','crystal'],           density: 0.022, min: 14, max: 40 },
    seaCreatures: { crabs: 6, singles: 4, schools: 1, schoolSize: 6, squid: 2, whales: 1 },
    terrainPacks: { sand: 'rock_08', ground: 'lava_rock', cliff: 'rock_pitted_mossy' },
  },
  arctic: {
    id: 'arctic', label: 'Frozen Expanse',
    worldSize: DEFAULT_WORLD, area: DEFAULT_AREA, maxHeight: 40, waterDepth: 20,
    trees:   { species: ['pine_1','pine_2','pine_3','dead_1'],                      density: 0.12, min: 25, max: 120 },
    rocks:   { species: ['rock_1','rock_2','rock_3','cliff_rock'],                  density: 0.10, min: 18, max: 80 },
    plants:  { species: ['grass_short','clover'],                                   density: 0.06, min: 10, max: 60 },
    flowers: { species: [],                                                          density: 0.0, min: 0, max: 0 },
    animals: { species: ['fox','wolf','bear','rabbit'],                             density: 0.004, min: 6, max: 14 },
    harvestNodes: { species: ['stone','iron'],                                      density: 0.012, min: 6, max: 22 },
    seaCreatures: { crabs: 8, singles: 6, schools: 2, schoolSize: 8, squid: 2, whales: 3 },
    terrainPacks: { sand: 'coast_sand_01', ground: 'snow_field_aerial', cliff: 'rock_08' },
  },
  desert: {
    id: 'desert', label: 'Scorched Sands',
    worldSize: DEFAULT_WORLD, area: DEFAULT_AREA, maxHeight: 22, waterDepth: 20,
    trees:   { species: ['twisted_1','twisted_2','dead_1'],                         density: 0.04, min: 8, max: 30 },
    rocks:   { species: ['rock_1','rock_2','rock_3','cliff_rock','boulder_rock'],   density: 0.12, min: 20, max: 90 },
    plants:  { species: ['grass_short','bush','hemp'],                              density: 0.05, min: 8, max: 40 },
    flowers: { species: [],                                                          density: 0.0, min: 0, max: 0 },
    animals: { species: ['boar','fox','rabbit'],                                    density: 0.003, min: 4, max: 10 },
    harvestNodes: { species: ['stone','copper','gold','crystal'],                   density: 0.016, min: 10, max: 30 },
    seaCreatures: { crabs: 12, singles: 10, schools: 2, schoolSize: 10, squid: 3, whales: 1 },
    terrainPacks: { sand: 'coast_sand_03', ground: 'brown_mud_leaves_01', cliff: 'rock_08' },
  },
};

export function getIslandConfig(biome: IslandBiomePreset): IslandConfig {
  const base = ISLAND_CONFIGS[biome] ?? ISLAND_CONFIGS.tropical;
  const override = getIslandConfigOverride(biome);
  return override ? { ...base, ...override } : base;
}

/** Compute desired count for a category given the island land area. */
export function categoryCount<T extends string>(
  cat: IslandAssetCategory<T>, areaM2: number,
): number {
  const raw = Math.round(cat.density * (areaM2 / 100));
  return Math.max(cat.min ?? 0, Math.min(cat.max ?? 9999, raw));
}
