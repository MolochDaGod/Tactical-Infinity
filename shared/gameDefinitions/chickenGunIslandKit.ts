/**
 * Chicken Gun Fruzer island kit — isolate SSOT for /island?entry=dock.
 * Source: D:\Games\Models\chicken_gun_fruzer_-_islands (1).glb
 * Runtime: /models/fleet/islands/chicken_gun_islands.glb
 *
 * Never place the whole Sketchfab dump. Purge Water/Cube/Collider/Trigger/
 * Shark/Tralalero/Krossovok. Each non-terrain isolate has a D1 definition UUID.
 */
import { fleetMeshUuid } from './fleetMeshUuid';
import type { WorldLayerId } from './worldBuildRules';

/** Same pack as islandFleetPacks.ISLAND_SHELLS.chickenGun — isolate, never whole dump. */
export const CHICKEN_GUN_ISLAND_URL = '/models/islands/shells/chicken_gun_islands.glb';
export const CHICKEN_GUN_R2_KEY = 'models/islands/shells/chicken_gun_islands.glb';
export const CHICKEN_GUN_ISLAND_CDN =
  'https://assets.grudge-studio.com/models/islands/shells/chicken_gun_islands.glb';

/** Names that must never spawn (meme / collider / water cubes). */
export const CHICKEN_GUN_PURGE =
  /^(Water|Cube|Collider|Trigger|Shark|Tralalero|Krossovok|Fill_Light|Paskhalka|Object_\d+)$/i;

export type ChickenGunKind = 'terrain' | 'dock' | 'boat' | 'harvest' | 'prop' | 'weapon';

export interface ChickenGunIsolate {
  id: string;
  node: string;
  kind: ChickenGunKind;
  layer: WorldLayerId;
  name: string;
  /** Fit length or height in metres after isolate. */
  sizeM: number;
  fitAxis: 'length' | 'height' | 'max';
  assetUuid: string;
}

function iso(
  id: string,
  node: string,
  kind: ChickenGunKind,
  layer: WorldLayerId,
  name: string,
  sizeM: number,
  fitAxis: ChickenGunIsolate['fitAxis'] = 'max',
): ChickenGunIsolate {
  return {
    id,
    node,
    kind,
    layer,
    name,
    sizeM,
    fitAxis,
    assetUuid: fleetMeshUuid(CHICKEN_GUN_R2_KEY, node),
  };
}

/** Terrain shells — home dock island uses island_small. */
export const CHICKEN_GUN_TERRAIN: readonly ChickenGunIsolate[] = [
  iso('cg-island-small', 'island_small', 'terrain', 'land', 'Home islet', 72, 'length'),
  iso('cg-island-sand', 'island_sand_tiny', 'terrain', 'shore', 'Sand spit', 22, 'length'),
];

/** Small wooden dock for boat editor. */
export const CHICKEN_GUN_DOCK: ChickenGunIsolate = iso(
  'cg-dock-wood',
  'dock_wood',
  'dock',
  'shore',
  'Wood dock',
  8,
  'length',
);

/** Small sailed boat at the dock — editor / paint / 0.5 m slots. */
export const CHICKEN_GUN_EDITOR_BOAT: ChickenGunIsolate = iso(
  'cg-boat-colonial-small',
  'ship_colonial_small',
  'boat',
  'water',
  'Colonial small sailboat',
  4.2,
  'length',
);

export const CHICKEN_GUN_HARVEST: readonly ChickenGunIsolate[] = [
  iso('cg-palm-small', 'palm_small', 'harvest', 'land', 'Palm small', 4.2, 'height'),
  iso('cg-palm-round', 'palm_round', 'harvest', 'land', 'Palm round', 3.6, 'height'),
  iso('cg-palm-high', 'palm_high', 'harvest', 'land', 'Palm high', 6.5, 'height'),
  iso('cg-grass', 'grass_clumb', 'harvest', 'land', 'Grass clump', 0.6, 'height'),
  iso('cg-shrub', 'shrub_flowers__1_', 'harvest', 'land', 'Flower shrub', 0.9, 'height'),
  iso('cg-stone-round', 'stone_round', 'harvest', 'land', 'Round stone', 1.2, 'max'),
  iso('cg-stone-01', 'stone_01__1_', 'harvest', 'land', 'Stone 01', 1.1, 'max'),
];

export const CHICKEN_GUN_ROCKS: readonly ChickenGunIsolate[] = [
  iso('cg-stone-round', 'stone_round', 'harvest', 'land', 'Round stone', 1.2, 'max'),
  iso('cg-stone-01', 'stone_01__1_', 'harvest', 'land', 'Stone 01', 1.1, 'max'),
];

export const CHICKEN_GUN_TREES: readonly ChickenGunIsolate[] = [
  iso('cg-palm-small', 'palm_small', 'harvest', 'land', 'Palm small', 4.2, 'height'),
  iso('cg-palm-round', 'palm_round', 'harvest', 'land', 'Palm round', 3.6, 'height'),
  iso('cg-palm-high', 'palm_high', 'harvest', 'land', 'Palm high', 6.5, 'height'),
];

/** Shore buildings sized for a 2 m player (door ≥ 2.1, room ≥ 2.6, eave ~3.8). */
export const CHICKEN_GUN_HOUSES: readonly ChickenGunIsolate[] = [
  iso('cg-hut', 'pirate_hut_round', 'prop', 'land', 'Pirate hut (vendor)', 3.8, 'height'),
  iso('cg-house-small', 'house_pirate_new_small_1', 'prop', 'land', 'Pirate house small', 4.2, 'height'),
];

export const CHICKEN_GUN_ISLETS: readonly ChickenGunIsolate[] = [
  iso('cg-islet-round', 'island_round_tiny', 'terrain', 'land', 'Round islet', 22, 'length'),
  iso('cg-islet-tiny', 'island_tiny', 'terrain', 'land', 'Tiny islet', 18, 'length'),
  iso('cg-islet-sand', 'island_sand_tiny', 'terrain', 'shore', 'Sand islet', 20, 'length'),
];

/** Isolated Synty dark-fantasy props from chicken_gun_fruzer_graveyard.glb (not the Map dump). */
export const FRUZER_GRAVEYARD_URL = '/models/fleet/graveyard/fruzer_graveyard_kit.glb';
export const FRUZER_GRAVEYARD_R2 = 'models/fleet/graveyard/fruzer_graveyard_kit.glb';

function giso(
  id: string,
  node: string,
  kind: ChickenGunKind,
  layer: WorldLayerId,
  name: string,
  sizeM: number,
  fitAxis: ChickenGunIsolate['fitAxis'] = 'max',
): ChickenGunIsolate {
  return {
    id,
    node,
    kind,
    layer,
    name,
    sizeM,
    fitAxis,
    assetUuid: fleetMeshUuid(FRUZER_GRAVEYARD_R2, node),
  };
}

export const FRUZER_GRAVEYARD: readonly ChickenGunIsolate[] = [
  giso('gy-crypt-01', 'SM_Prop_Crypt_01', 'prop', 'land', 'Crypt 01', 3.6, 'height'),
  giso('gy-crypt-02', 'SM_Prop_Crypt_02', 'prop', 'land', 'Crypt 02', 3.6, 'height'),
  giso('gy-gate', 'SM_Bld_Gates_Cemetary_01', 'prop', 'land', 'Cemetery gate', 3.6, 'height'),
  giso('gy-fence', 'SM_Bld_Fence_Cemetary_01', 'prop', 'land', 'Cemetery fence', 2.2, 'length'),
  giso('gy-pillar', 'SM_Bld_Fence_Pillar_Cemetary_01', 'prop', 'land', 'Cemetery pillar', 2.0, 'height'),
  giso('gy-tree-dead-01', 'SM_Env_Tree_Dead_01', 'harvest', 'land', 'Dead tree 01', 5.5, 'height'),
  giso('gy-tree-dead-02', 'SM_Env_Tree_Dead_02', 'harvest', 'land', 'Dead tree 02', 4.8, 'height'),
  giso('gy-trunk', 'SM_Env_Tree_Trunk_01', 'harvest', 'land', 'Dead trunk', 1.8, 'height'),
  giso('gy-cliff', 'SM_Env_Rock_Cliff_02', 'harvest', 'land', 'Grave cliff rock', 2.4, 'max'),
  giso('gy-crate', 'SM_Prop_Crate_01', 'prop', 'land', 'Dark crate', 0.8, 'max'),
  giso('gy-barrel', 'SM_Prop_Barrel_Open_01', 'prop', 'land', 'Open barrel', 0.7, 'height'),
  giso('gy-flag', 'SM_Prop_Flag_Dark_Damaged_04', 'prop', 'air', 'Damaged dark flag', 2.2, 'height'),
  giso('gy-brazier', 'SM_Prop_Brazier_01', 'prop', 'land', 'Brazier', 0.9, 'height'),
];

export const CHICKEN_GUN_PROPS: readonly ChickenGunIsolate[] = [
  iso('cg-barrel', 'barrel_old', 'prop', 'shore', 'Old barrel', 0.9, 'height'),
  iso('cg-crate', 'crate1_01__7_', 'prop', 'shore', 'Crate', 0.7, 'max'),
  iso('cg-cannon', 'cannon', 'weapon', 'shore', 'Deck cannon', 1.4, 'length'),
];

export const CHICKEN_GUN_ALL: readonly ChickenGunIsolate[] = [
  ...CHICKEN_GUN_TERRAIN,
  CHICKEN_GUN_DOCK,
  CHICKEN_GUN_EDITOR_BOAT,
  ...CHICKEN_GUN_HARVEST,
  ...CHICKEN_GUN_ROCKS,
  ...CHICKEN_GUN_TREES,
  ...CHICKEN_GUN_HOUSES,
  ...CHICKEN_GUN_ISLETS,
  ...CHICKEN_GUN_PROPS,
  ...FRUZER_GRAVEYARD,
];
