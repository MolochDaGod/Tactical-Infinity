import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

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
    description: 'Craft basic items and tools',
    category: 'production',
    cost: { wood: 20, stone: 5 },
    cellSize: { width: 2, height: 2 },
    rotatable: true,
    modelUrl: '/models/buildings/Workbench_1768389550051.glb',
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
    description: 'Provides warmth and allows cooking',
    category: 'production',
    cost: { wood: 5, stone: 3 },
    cellSize: { width: 1, height: 1 },
    rotatable: false,
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
    fallbackGeometry: 'box',
    fallbackColor: 0xA0522D,
    scale: 0.5
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
    
    if (definition.modelUrl) {
      const isFBX = definition.modelUrl.toLowerCase().endsWith('.fbx');
      
      const loadPromise = new Promise<THREE.Group>((resolve) => {
        if (isFBX) {
          this.fbxLoader.load(
            definition.modelUrl!,
            (fbx) => {
              const mesh = new THREE.Group();
              mesh.add(fbx);
              if (definition.scale) {
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
              const mesh = gltf.scene;
              if (definition.scale) {
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
