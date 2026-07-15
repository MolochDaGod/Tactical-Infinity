import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { loadSurvivalKitNode } from '@/lib/survivalKitAssets';
import { loadNoteOfArmsNode } from '@/lib/noteOfArmsAssets';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { resolveWarlordsUrl } from '@/lib/warlordsAssetCatalog';

export type PlaceableBuildingType = 
  | 'wall'
  | 'spiked_wall'
  | 'floor'
  | 'ramp'
  | 'workbench'
  | 'forge'
  | 'tower'
  | 'campfire'
  | 'storage_chest'
  | 'farming_plot'
  | 'fence'
  /** Survival kit — camp tent stages + profession stations */
  | 'tent_stage_1'
  | 'tent_stage_2'
  | 'tent_stage_3'
  | 'cooking_bench'
  | 'grind_wheel'
  | 'anvil'
  | 'stone_quarry'
  | 'rts_town_center'
  | 'rts_barracks'
  | 'rts_archery'
  | 'rts_farm'
  | 'rts_wheat_field'
  | 'rts_temple'
  /** note_of_arms Chain_V* — buildable chain link / connection tool */
  | 'chain'
  | 'window_thin_flat'
  | 'window_thin_round'
  | 'window_wide_flat'
  | 'window_wide_round'
  | 'window_roof_thin'
  | 'window_roof_wide'
  | 'shutters_thin_flat_closed'
  | 'shutters_thin_flat_open'
  | 'shutters_thin_round_closed'
  | 'shutters_thin_round_open'
  | 'shutters_wide_flat_closed'
  | 'shutters_wide_flat_open'
  | 'shutters_wide_round_closed'
  | 'shutters_wide_round_open'
  | 'medieval_inn'
  | 'medieval_blacksmith'
  | 'medieval_mill'
  | 'medieval_sawmill'
  | 'medieval_stable'
  | 'medieval_bell_tower'
  | 'medieval_house_1'
  | 'medieval_house_2'
  | 'medieval_house_3'
  | 'medieval_house_4'
  | 'medieval_well'
  | 'medieval_market_stand'
  | 'medieval_gazebo'
  | 'ruins_wall'
  | 'ruins_wall_broken'
  | 'ruins_floor'
  | 'ruins_column'
  | 'ruins_arch'
  | 'ruins_stairs';

export interface BuildingCost {
  wood?: number;
  stone?: number;
  ore?: number;
  gold?: number;
  leather?: number;
  fiber?: number;
}

export interface PlaceableBuildingDefinition {
  type: PlaceableBuildingType;
  name: string;
  description: string;
  category: 'structure' | 'production' | 'defense' | 'decoration' | 'farming';
  cost: BuildingCost;
  cellSize: { width: number; height: number };
  rotatable: boolean;
  placementOffset?: { x: number; y: number; z: number };
  modelUrl?: string;
  /**
   * Node name inside free_survival_asset_kit.glb (RootNode child).
   * When set, loader isolates that mesh group only — never the whole pack.
   */
  survivalKitNode?: string;
  /**
   * Node name inside note_of_arms_environment_assets_set_1.glb.
   * Isolate only — never place the whole multipack.
   */
  noteOfArmsNode?: string;
  /** Target height in metres when normalizing kit meshes */
  kitTargetHeightM?: number;
  fallbackGeometry?: 'box' | 'cylinder' | 'plane';
  fallbackColor?: number;
  scale?: number;
}

export interface PlacedBuilding {
  id: string;
  type: PlaceableBuildingType;
  position: THREE.Vector3;
  rotation: number;
  mesh: THREE.Group;
  cellsOccupied: string[];
  isConstructing: boolean;
  health: number;
  maxHealth: number;
}

export const placeableBuildingDefinitions: Record<PlaceableBuildingType, PlaceableBuildingDefinition> = {
  wall: {
    type: 'wall',
    name: 'Wooden Wall',
    description: 'Basic wooden wall for protection and privacy',
    category: 'structure',
    cost: { wood: 10 },
    cellSize: { width: 3, height: 1 },
    rotatable: true,
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  spiked_wall: {
    type: 'spiked_wall',
    name: 'Spiked Wall',
    description: 'Reinforced wall with spikes for extra protection',
    category: 'defense',
    cost: { wood: 15, stone: 5 },
    cellSize: { width: 3, height: 1 },
    rotatable: true,
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  floor: {
    type: 'floor',
    name: 'Wooden Floor',
    description: 'Wooden floor panel for building foundations',
    category: 'structure',
    cost: { wood: 8 },
    cellSize: { width: 4, height: 4 },
    rotatable: false,
    survivalKitNode: 'floor',
    kitTargetHeightM: 0.15,
    fallbackGeometry: 'plane',
    fallbackColor: 0xDEB887,
    scale: 1.0
  },
  ramp: {
    type: 'ramp',
    name: 'Ramp',
    description: 'Sloped ramp for accessing different building levels',
    category: 'structure',
    cost: { wood: 12 },
    cellSize: { width: 3, height: 2 },
    rotatable: true,
    placementOffset: { x: 0, y: 0, z: 0 },
    fallbackGeometry: 'box',
    fallbackColor: 0xA0522D,
    scale: 1.0
  },
  workbench: {
    type: 'workbench',
    name: 'Workbench',
    description: 'Craft table with hammer and paper note (survival kit)',
    category: 'production',
    cost: { wood: 20, stone: 5 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    survivalKitNode: 'workbench',
    kitTargetHeightM: 1.2,
    fallbackGeometry: 'box',
    fallbackColor: 0xCD853F,
    scale: 1.0
  },
  forge: {
    type: 'forge',
    name: 'Forge',
    description: 'Smelt ores and craft metal equipment',
    category: 'production',
    cost: { wood: 15, stone: 30, ore: 10 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    survivalKitNode: 'workbenchAnvil',
    kitTargetHeightM: 1.25,
    fallbackGeometry: 'box',
    fallbackColor: 0x8B0000,
    scale: 1.0
  },
  tower: {
    type: 'tower',
    name: 'Watch Tower',
    description: 'Defensive tower for spotting enemies',
    category: 'defense',
    cost: { wood: 40, stone: 20 },
    cellSize: { width: 2, height: 2 },
    rotatable: false,
    fallbackGeometry: 'cylinder',
    fallbackColor: 0x696969,
    scale: 1.5
  },
  campfire: {
    type: 'campfire',
    name: 'Campfire',
    description: 'Fireplace — ring rocks, wood, cook bucket',
    category: 'production',
    cost: { wood: 5, stone: 3 },
    cellSize: { width: 1, height: 1 },
    rotatable: false,
    survivalKitNode: 'campfire',
    kitTargetHeightM: 0.9,
    fallbackGeometry: 'cylinder',
    fallbackColor: 0xFF4500,
    scale: 0.5
  },
  storage_chest: {
    type: 'storage_chest',
    name: 'Storage Chest',
    description: 'Store resources and items',
    category: 'structure',
    cost: { wood: 15 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    survivalKitNode: 'chest',
    kitTargetHeightM: 0.85,
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 0.6
  },
  farming_plot: {
    type: 'farming_plot',
    name: 'Farming Plot',
    description: 'Grow crops and vegetables',
    category: 'farming',
    cost: { wood: 5 },
    cellSize: { width: 3, height: 3 },
    rotatable: false,
    fallbackGeometry: 'plane',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  fence: {
    type: 'fence',
    name: 'Fence',
    description: 'Simple wooden fence',
    category: 'decoration',
    cost: { wood: 3 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    survivalKitNode: 'fence',
    kitTargetHeightM: 1.1,
    fallbackGeometry: 'box',
    fallbackColor: 0xA0522D,
    scale: 0.5
  },
  tent_stage_1: {
    type: 'tent_stage_1',
    name: 'Tent Frame',
    description: 'Camp stage 1 — half tent / poles',
    category: 'structure',
    cost: { wood: 8, fiber: 4 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    survivalKitNode: 'tentHalf',
    kitTargetHeightM: 2.2,
    fallbackGeometry: 'box',
    fallbackColor: 0xC4A574,
    scale: 1.0
  },
  tent_stage_2: {
    type: 'tent_stage_2',
    name: 'Closed Tent',
    description: 'Camp stage 2 — fully closed tent',
    category: 'structure',
    cost: { wood: 12, fiber: 8 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    survivalKitNode: 'tentClosed',
    kitTargetHeightM: 2.4,
    fallbackGeometry: 'box',
    fallbackColor: 0xB8956A,
    scale: 1.0
  },
  tent_stage_3: {
    type: 'tent_stage_3',
    name: 'Camp Tent',
    description: 'Camp stage 3 — open camp tent',
    category: 'structure',
    cost: { wood: 16, fiber: 12 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    survivalKitNode: 'tent',
    kitTargetHeightM: 2.5,
    fallbackGeometry: 'box',
    fallbackColor: 0xA08050,
    scale: 1.0
  },
  cooking_bench: {
    type: 'cooking_bench',
    name: 'Cooking Bench',
    description: 'Outdoor cooking / prep stand',
    category: 'production',
    cost: { wood: 14, stone: 4 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    survivalKitNode: 'fishingStand',
    kitTargetHeightM: 1.4,
    fallbackGeometry: 'box',
    fallbackColor: 0x8B6914,
    scale: 1.0
  },
  grind_wheel: {
    type: 'grind_wheel',
    name: 'Sharpening Wheel',
    description: 'Miner grind / sharpen station',
    category: 'production',
    cost: { wood: 18, stone: 12, ore: 4 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    survivalKitNode: 'workbenchGrind',
    kitTargetHeightM: 1.3,
    fallbackGeometry: 'box',
    fallbackColor: 0x6B6B6B,
    scale: 1.0
  },
  anvil: {
    type: 'anvil',
    name: 'Anvil',
    description: 'Engineer anvil station',
    category: 'production',
    cost: { wood: 10, stone: 20, ore: 15 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    survivalKitNode: 'workbenchAnvil',
    kitTargetHeightM: 1.2,
    fallbackGeometry: 'box',
    fallbackColor: 0x4A4A4A,
    scale: 1.0
  },
  stone_quarry: {
    type: 'stone_quarry',
    name: 'Stone Quarry',
    description: 'Ultimate Fantasy RTS Mine.fbx — miner-only stone harvest (4s enter)',
    category: 'production',
    cost: { wood: 25, stone: 40 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/Mine.fbx'),
    kitTargetHeightM: 5,
    fallbackGeometry: 'box',
    fallbackColor: 0x6B6B6B,
    scale: 1.0
  },
  rts_town_center: {
    type: 'rts_town_center',
    name: 'Town Center',
    description: 'UF RTS TownCenter — trains workers / basic infantry',
    category: 'structure',
    cost: { wood: 80, stone: 40 },
    cellSize: { width: 4, height: 4 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/TownCenter_FirstAge_Level1.fbx'),
    kitTargetHeightM: 8,
    fallbackGeometry: 'box',
    fallbackColor: 0x8B7355,
    scale: 1.0
  },
  rts_barracks: {
    type: 'rts_barracks',
    name: 'Barracks',
    description: 'UF RTS Barracks — deploys melee units',
    category: 'defense',
    cost: { wood: 50, stone: 25 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/Barracks_FirstAge_Level1.fbx'),
    kitTargetHeightM: 5.5,
    fallbackGeometry: 'box',
    fallbackColor: 0x7A5C3A,
    scale: 1.0
  },
  rts_archery: {
    type: 'rts_archery',
    name: 'Archery Range',
    description: 'UF RTS Archery — deploys archer units',
    category: 'defense',
    cost: { wood: 45, stone: 20 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/Archery_FirstAge_Level1.fbx'),
    kitTargetHeightM: 5.5,
    fallbackGeometry: 'box',
    fallbackColor: 0x5C7A3A,
    scale: 1.0
  },
  rts_farm: {
    type: 'rts_farm',
    name: 'Farm',
    description: 'UF RTS Farm — raises Llama / Pig / Sheep (feed wheat)',
    category: 'farming',
    cost: { wood: 30 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/Farm_FirstAge_Level1.fbx'),
    kitTargetHeightM: 3.5,
    fallbackGeometry: 'plane',
    fallbackColor: 0x8B8B3A,
    scale: 1.0
  },
  rts_wheat_field: {
    type: 'rts_wheat_field',
    name: 'Wheat Field',
    description: 'UF RTS Farm wheat crop — harvest wheat to feed livestock',
    category: 'farming',
    cost: { wood: 15 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/Farm_FirstAge_Level1_Wheat.fbx'),
    kitTargetHeightM: 2.2,
    fallbackGeometry: 'plane',
    fallbackColor: 0xC9B84A,
    scale: 1.0
  },
  chain: {
    type: 'chain',
    name: 'Chain',
    description: 'Buildable chain link (note_of_arms) — connections, barriers, shipyard',
    category: 'structure',
    cost: { ore: 8, stone: 2 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    noteOfArmsNode: 'Chain_V3',
    /** Rest length metres after multipack isolate + normalize */
    kitTargetHeightM: 1.0,
    fallbackGeometry: 'cylinder',
    fallbackColor: 0x6B6B70,
    // No definition.scale — normalize only (avoids double-scale)
  },
  rts_temple: {
    type: 'rts_temple',
    name: 'Temple',
    description: 'UF RTS Temple — support / priest units',
    category: 'structure',
    cost: { wood: 40, stone: 35 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: resolveWarlordsUrl('models/rts/ultimate-fantasy/fbx/Temple_FirstAge_Level1.fbx'),
    kitTargetHeightM: 7,
    fallbackGeometry: 'box',
    fallbackColor: 0x9A8A70,
    scale: 1.0
  },
  window_thin_flat: {
    type: 'window_thin_flat',
    name: 'Thin Flat Window',
    description: 'Narrow flat-topped window frame',
    category: 'decoration',
    cost: { wood: 8, stone: 2 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/Window_Thin_Flat1_1768381130786.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  window_thin_round: {
    type: 'window_thin_round',
    name: 'Thin Round Window',
    description: 'Narrow arched window frame',
    category: 'decoration',
    cost: { wood: 10, stone: 3 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/Window_Thin_Round1_1768381130785.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  window_wide_flat: {
    type: 'window_wide_flat',
    name: 'Wide Flat Window',
    description: 'Wide flat-topped window frame',
    category: 'decoration',
    cost: { wood: 12, stone: 4 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/Window_Wide_Flat1_1768381130785.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  window_wide_round: {
    type: 'window_wide_round',
    name: 'Wide Round Window',
    description: 'Wide arched window frame',
    category: 'decoration',
    cost: { wood: 14, stone: 5 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/Window_Wide_Round1_1768381130784.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  window_roof_thin: {
    type: 'window_roof_thin',
    name: 'Thin Roof Window',
    description: 'Small dormer window for roofs',
    category: 'decoration',
    cost: { wood: 15, stone: 5 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/Window_Roof_Thin_1768381130787.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  window_roof_wide: {
    type: 'window_roof_wide',
    name: 'Wide Roof Window',
    description: 'Large dormer window for roofs',
    category: 'decoration',
    cost: { wood: 20, stone: 8 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/Window_Roof_Wide_1768381130786.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  shutters_thin_flat_closed: {
    type: 'shutters_thin_flat_closed',
    name: 'Thin Flat Shutters (Closed)',
    description: 'Closed shutters for thin flat windows',
    category: 'decoration',
    cost: { wood: 4 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Thin_Flat_Closed_1768381130784.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_thin_flat_open: {
    type: 'shutters_thin_flat_open',
    name: 'Thin Flat Shutters (Open)',
    description: 'Open shutters for thin flat windows',
    category: 'decoration',
    cost: { wood: 4 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Thin_Flat_Open_1768381130783.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_thin_round_closed: {
    type: 'shutters_thin_round_closed',
    name: 'Thin Round Shutters (Closed)',
    description: 'Closed shutters for thin round windows',
    category: 'decoration',
    cost: { wood: 5 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Thin_Round_Closed_1768381130782.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_thin_round_open: {
    type: 'shutters_thin_round_open',
    name: 'Thin Round Shutters (Open)',
    description: 'Open shutters for thin round windows',
    category: 'decoration',
    cost: { wood: 5 },
    cellSize: { width: 1, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Thin_Round_Open_1768381130790.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_wide_flat_closed: {
    type: 'shutters_wide_flat_closed',
    name: 'Wide Flat Shutters (Closed)',
    description: 'Closed shutters for wide flat windows',
    category: 'decoration',
    cost: { wood: 6 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Wide_Flat_Closed_1768381130789.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_wide_flat_open: {
    type: 'shutters_wide_flat_open',
    name: 'Wide Flat Shutters (Open)',
    description: 'Open shutters for wide flat windows',
    category: 'decoration',
    cost: { wood: 6 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Wide_Flat_Open_1768381130789.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_wide_round_closed: {
    type: 'shutters_wide_round_closed',
    name: 'Wide Round Shutters (Closed)',
    description: 'Closed shutters for wide round windows',
    category: 'decoration',
    cost: { wood: 7 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Wide_Round_Closed_1768381130788.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  shutters_wide_round_open: {
    type: 'shutters_wide_round_open',
    name: 'Wide Round Shutters (Open)',
    description: 'Open shutters for wide round windows',
    category: 'decoration',
    cost: { wood: 7 },
    cellSize: { width: 2, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/WindowShutters_Wide_Round_Open_1768381130787.gltf',
    fallbackGeometry: 'box',
    fallbackColor: 0x654321,
    scale: 1.0
  },
  medieval_inn: {
    type: 'medieval_inn',
    name: 'Medieval Inn',
    description: 'A cozy inn for weary travelers',
    category: 'structure',
    cost: { wood: 100, stone: 50 },
    cellSize: { width: 8, height: 8 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/Inn.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  medieval_blacksmith: {
    type: 'medieval_blacksmith',
    name: 'Blacksmith',
    description: 'Forge weapons and armor',
    category: 'production',
    cost: { wood: 60, stone: 80, ore: 20 },
    cellSize: { width: 6, height: 6 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/Blacksmith.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x696969,
    scale: 1.0
  },
  medieval_mill: {
    type: 'medieval_mill',
    name: 'Windmill',
    description: 'Grind grain into flour',
    category: 'production',
    cost: { wood: 80, stone: 40 },
    cellSize: { width: 6, height: 6 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/Mill.fbx',
    fallbackGeometry: 'cylinder',
    fallbackColor: 0xDEB887,
    scale: 1.0
  },
  medieval_sawmill: {
    type: 'medieval_sawmill',
    name: 'Sawmill',
    description: 'Process logs into lumber',
    category: 'production',
    cost: { wood: 50, stone: 20 },
    cellSize: { width: 5, height: 4 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/Sawmill.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0xA0522D,
    scale: 1.0
  },
  medieval_stable: {
    type: 'medieval_stable',
    name: 'Stable',
    description: 'House and breed horses',
    category: 'structure',
    cost: { wood: 70, stone: 30 },
    cellSize: { width: 6, height: 5 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/Stable.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0xCD853F,
    scale: 1.0
  },
  medieval_bell_tower: {
    type: 'medieval_bell_tower',
    name: 'Bell Tower',
    description: 'A tall tower with a bell for announcements',
    category: 'structure',
    cost: { wood: 40, stone: 100 },
    cellSize: { width: 3, height: 3 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/Bell_Tower.fbx',
    fallbackGeometry: 'cylinder',
    fallbackColor: 0x808080,
    scale: 1.0
  },
  medieval_house_1: {
    type: 'medieval_house_1',
    name: 'Small Cottage',
    description: 'A simple peasant dwelling',
    category: 'structure',
    cost: { wood: 40, stone: 20 },
    cellSize: { width: 4, height: 4 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/House_1.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0xDEB887,
    scale: 1.0
  },
  medieval_house_2: {
    type: 'medieval_house_2',
    name: 'Medium House',
    description: 'A comfortable family home',
    category: 'structure',
    cost: { wood: 60, stone: 30 },
    cellSize: { width: 5, height: 5 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/House_2.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0xDEB887,
    scale: 1.0
  },
  medieval_house_3: {
    type: 'medieval_house_3',
    name: 'Large House',
    description: 'A spacious merchant dwelling',
    category: 'structure',
    cost: { wood: 80, stone: 40 },
    cellSize: { width: 6, height: 5 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/House_3.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0xDEB887,
    scale: 1.0
  },
  medieval_house_4: {
    type: 'medieval_house_4',
    name: 'Manor House',
    description: 'A grand noble residence',
    category: 'structure',
    cost: { wood: 100, stone: 60, gold: 20 },
    cellSize: { width: 7, height: 6 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Buildings/FBX/House_4.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0xDEB887,
    scale: 1.0
  },
  medieval_well: {
    type: 'medieval_well',
    name: 'Stone Well',
    description: 'A water source for the village',
    category: 'decoration',
    cost: { stone: 30 },
    cellSize: { width: 2, height: 2 },
    rotatable: false,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Props/FBX/Well.fbx',
    fallbackGeometry: 'cylinder',
    fallbackColor: 0x808080,
    scale: 1.0
  },
  medieval_market_stand: {
    type: 'medieval_market_stand',
    name: 'Market Stand',
    description: 'A stall for trading goods',
    category: 'production',
    cost: { wood: 20 },
    cellSize: { width: 3, height: 2 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Props/FBX/MarketStand_1.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  medieval_gazebo: {
    type: 'medieval_gazebo',
    name: 'Gazebo',
    description: 'An ornamental garden structure',
    category: 'decoration',
    cost: { wood: 40 },
    cellSize: { width: 4, height: 4 },
    rotatable: true,
    modelUrl: '/models/buildings/medieval_village/Medieval Village Pack - Dec 2020/Props/FBX/Gazebo.fbx',
    fallbackGeometry: 'cylinder',
    fallbackColor: 0x8B4513,
    scale: 1.0
  },
  ruins_wall: {
    type: 'ruins_wall',
    name: 'Ruined Wall',
    description: 'Ancient stone wall section',
    category: 'decoration',
    cost: { stone: 15 },
    cellSize: { width: 3, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/modular_ruins/Ultimate Modular Ruins Pack - Aug 2021/FBX/Wall.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x808080,
    scale: 1.0
  },
  ruins_wall_broken: {
    type: 'ruins_wall_broken',
    name: 'Broken Wall',
    description: 'Damaged ancient wall with gaps',
    category: 'decoration',
    cost: { stone: 10 },
    cellSize: { width: 3, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/modular_ruins/Ultimate Modular Ruins Pack - Aug 2021/FBX/Wall_Double_Broken.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x696969,
    scale: 1.0
  },
  ruins_floor: {
    type: 'ruins_floor',
    name: 'Ruined Floor',
    description: 'Ancient stone floor tiles',
    category: 'decoration',
    cost: { stone: 8 },
    cellSize: { width: 4, height: 4 },
    rotatable: false,
    modelUrl: '/models/buildings/modular_ruins/Ultimate Modular Ruins Pack - Aug 2021/FBX/Floor_Standard_Half.fbx',
    fallbackGeometry: 'plane',
    fallbackColor: 0x696969,
    scale: 1.0
  },
  ruins_column: {
    type: 'ruins_column',
    name: 'Stone Column',
    description: 'Ancient decorative column',
    category: 'decoration',
    cost: { stone: 20 },
    cellSize: { width: 1, height: 1 },
    rotatable: false,
    modelUrl: '/models/buildings/modular_ruins/Ultimate Modular Ruins Pack - Aug 2021/FBX/Column_Round.fbx',
    fallbackGeometry: 'cylinder',
    fallbackColor: 0x808080,
    scale: 1.0
  },
  ruins_arch: {
    type: 'ruins_arch',
    name: 'Gothic Arch',
    description: 'Ornate stone archway',
    category: 'decoration',
    cost: { stone: 30 },
    cellSize: { width: 3, height: 1 },
    rotatable: true,
    modelUrl: '/models/buildings/modular_ruins/Ultimate Modular Ruins Pack - Aug 2021/FBX/Arch_Gothic_RoundColumn.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x808080,
    scale: 1.0
  },
  ruins_stairs: {
    type: 'ruins_stairs',
    name: 'Stone Stairs',
    description: 'Ancient staircase section',
    category: 'structure',
    cost: { stone: 25 },
    cellSize: { width: 2, height: 3 },
    rotatable: true,
    modelUrl: '/models/buildings/modular_ruins/Ultimate Modular Ruins Pack - Aug 2021/FBX/Stairs.fbx',
    fallbackGeometry: 'box',
    fallbackColor: 0x808080,
    scale: 1.0
  }
};

export class BuildableObjectsRegistry {
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private loadedMeshes: Map<PlaceableBuildingType, THREE.Group> = new Map();
  private loadingPromises: Map<PlaceableBuildingType, Promise<THREE.Group>> = new Map();
  private placedBuildings: Map<string, PlacedBuilding> = new Map();

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
  }

  async loadBuildingMesh(type: PlaceableBuildingType): Promise<THREE.Group> {
    if (this.loadedMeshes.has(type)) {
      return this.loadedMeshes.get(type)!.clone();
    }

    if (this.loadingPromises.has(type)) {
      const mesh = await this.loadingPromises.get(type)!;
      return mesh.clone();
    }

    const definition = placeableBuildingDefinitions[type];
    
    if (!definition) {
      console.warn(`Building definition not found for type: ${type}, using fallback`);
      const fallbackGroup = new THREE.Group();
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      fallbackGroup.add(mesh);
      return fallbackGroup;
    }
    
    // Survival kit multi-mesh pack — isolate one RootNode child only
    if (definition.survivalKitNode) {
      const loadPromise = loadSurvivalKitNode(
        definition.survivalKitNode,
        definition.kitTargetHeightM ?? 1.5,
      ).then((mesh) => {
        if (mesh.children.length === 0) {
          const fallback = this.createFallbackMesh(definition);
          this.loadedMeshes.set(type, fallback);
          return fallback.clone();
        }
        this.setupMeshProperties(mesh);
        this.loadedMeshes.set(type, mesh);
        return mesh.clone();
      });
      this.loadingPromises.set(type, loadPromise);
      return loadPromise;
    }

    // note_of_arms multipack — isolate Chain_V* / props only
    if (definition.noteOfArmsNode) {
      const loadPromise = loadNoteOfArmsNode(
        definition.noteOfArmsNode,
        definition.kitTargetHeightM ?? 1.0,
      ).then((mesh) => {
        if (mesh.children.length === 0) {
          const fallback = this.createFallbackMesh(definition);
          this.loadedMeshes.set(type, fallback);
          return fallback.clone();
        }
        this.setupMeshProperties(mesh);
        this.loadedMeshes.set(type, mesh);
        return mesh.clone();
      });
      this.loadingPromises.set(type, loadPromise);
      return loadPromise;
    }

    if (definition.modelUrl) {
      const isFBX = definition.modelUrl.toLowerCase().endsWith('.fbx');
      
      const loadPromise = new Promise<THREE.Group>((resolve) => {
        if (isFBX) {
          this.fbxLoader.load(
            definition.modelUrl!,
            (fbx) => {
              const mesh = new THREE.Group();
              mesh.name = `build_${type}`;
              mesh.add(fbx);
              // UF RTS / craftpix FBX are cm-scale — always fit height to metres
              if (definition.kitTargetHeightM && definition.kitTargetHeightM > 0) {
                normalizeToMetres(mesh, {
                  targetSizeM: definition.kitTargetHeightM,
                  axis: 'height',
                  ground: true,
                  centerXZ: true,
                });
              } else if (definition.scale) {
                // Legacy absolute scale only when no target height (avoid double-scale)
                mesh.scale.setScalar(definition.scale);
              }
              this.setupMeshProperties(mesh);
              this.loadedMeshes.set(type, mesh);
              resolve(mesh.clone());
            },
            undefined,
            (error) => {
              console.warn(`Failed to load FBX model for ${type}, using fallback:`, error);
              const fallback = this.createFallbackMesh(definition);
              this.loadedMeshes.set(type, fallback);
              resolve(fallback.clone());
            }
          );
        } else {
          this.gltfLoader.load(
            definition.modelUrl!,
            (gltf) => {
              const mesh = new THREE.Group();
              mesh.name = `build_${type}`;
              mesh.add(gltf.scene);
              if (definition.kitTargetHeightM && definition.kitTargetHeightM > 0) {
                normalizeToMetres(mesh, {
                  targetSizeM: definition.kitTargetHeightM,
                  axis: 'height',
                  ground: true,
                  centerXZ: true,
                });
              } else if (definition.scale) {
                mesh.scale.setScalar(definition.scale);
              }
              this.setupMeshProperties(mesh);
              this.loadedMeshes.set(type, mesh);
              resolve(mesh.clone());
            },
            undefined,
            (error) => {
              console.warn(`Failed to load GLTF model for ${type}, using fallback:`, error);
              const fallback = this.createFallbackMesh(definition);
              this.loadedMeshes.set(type, fallback);
              resolve(fallback.clone());
            }
          );
        }
      });
      
      this.loadingPromises.set(type, loadPromise);
      return loadPromise;
    }

    const fallback = this.createFallbackMesh(definition);
    this.loadedMeshes.set(type, fallback);
    return fallback.clone();
  }

  private createFallbackMesh(definition: PlaceableBuildingDefinition): THREE.Group {
    const group = new THREE.Group();
    group.name = definition.type;
    
    let geometry: THREE.BufferGeometry;
    const cellWidth = definition.cellSize.width * 2;
    const cellHeight = definition.cellSize.height * 2;
    const scale = definition.scale || 1.0;

    switch (definition.fallbackGeometry) {
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          Math.min(cellWidth, cellHeight) * 0.4 * scale,
          Math.min(cellWidth, cellHeight) * 0.4 * scale,
          4 * scale,
          16
        );
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(cellWidth * scale, cellHeight * scale);
        break;
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(
          cellWidth * 0.9 * scale,
          3 * scale,
          cellHeight * 0.9 * scale
        );
        break;
    }

    const material = new THREE.MeshStandardMaterial({
      color: definition.fallbackColor || 0x888888,
      roughness: 0.8,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    if (definition.fallbackGeometry === 'plane') {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.1;
    } else if (definition.fallbackGeometry === 'box') {
      mesh.position.y = 1.5 * scale;
    } else if (definition.fallbackGeometry === 'cylinder') {
      mesh.position.y = 2 * scale;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    group.add(mesh);
    group.userData = { buildingType: definition.type };

    return group;
  }

  private setupMeshProperties(mesh: THREE.Group): void {
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.roughness = 0.8;
          mat.metalness = 0.1;
        }
      }
    });
  }

  getDefinition(type: PlaceableBuildingType): PlaceableBuildingDefinition {
    return placeableBuildingDefinitions[type];
  }

  getAllDefinitions(): PlaceableBuildingDefinition[] {
    return Object.values(placeableBuildingDefinitions);
  }

  getByCategory(category: PlaceableBuildingDefinition['category']): PlaceableBuildingDefinition[] {
    return this.getAllDefinitions().filter(d => d.category === category);
  }

  registerPlacedBuilding(building: PlacedBuilding): void {
    this.placedBuildings.set(building.id, building);
  }

  removePlacedBuilding(id: string): PlacedBuilding | undefined {
    const building = this.placedBuildings.get(id);
    this.placedBuildings.delete(id);
    return building;
  }

  getPlacedBuilding(id: string): PlacedBuilding | undefined {
    return this.placedBuildings.get(id);
  }

  getAllPlacedBuildings(): PlacedBuilding[] {
    return Array.from(this.placedBuildings.values());
  }

  getPlacedBuildingsByType(type: PlaceableBuildingType): PlacedBuilding[] {
    return this.getAllPlacedBuildings().filter(b => b.type === type);
  }

  clearAllPlacedBuildings(): void {
    this.placedBuildings.clear();
  }

  getCost(type: PlaceableBuildingType): BuildingCost {
    return placeableBuildingDefinitions[type].cost;
  }

  getCellSize(type: PlaceableBuildingType): { width: number; height: number } {
    return placeableBuildingDefinitions[type].cellSize;
  }
}

export const buildableObjectsRegistry = new BuildableObjectsRegistry();
