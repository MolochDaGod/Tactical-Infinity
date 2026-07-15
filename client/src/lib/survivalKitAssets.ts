/**
 * Free Survival Asset Kit — per-mesh isolation from a multi-mesh GLB pack.
 *
 * Source: free_survival_asset_kit.glb (Kenney-style survival props)
 * CDN:   https://assets.grudge-studio.com/models/survival/free_survival_asset_kit.glb
 * Local: /models/survival/free_survival_asset_kit.glb
 *
 * HARD RULE: never place the whole pack. Always isolate by node name
 * (parent group under RootNode: tentHalf, campfire, workbench, …).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';

export const SURVIVAL_KIT_URL =
  'https://assets.grudge-studio.com/models/survival/free_survival_asset_kit.glb';

/** Local fallback when CDN offline (staged under client/public). */
export const SURVIVAL_KIT_LOCAL = '/models/survival/free_survival_asset_kit.glb';

/**
 * Camp / profession build roles → RootNode child names in the pack.
 * Tent progression: half frame → closed → open camp tent.
 */
export const SURVIVAL_KIT_NODES = {
  // Camp tent stages
  tentStage1: 'tentHalf',      // poles + half cloth
  tentStage2: 'tentClosed',    // fully closed tent
  tentStage3: 'tent',          // open camp tent
  // Fireplace / cooking
  campfire: 'campfire',        // fire + wood + ring rocks + bucket
  cookingBench: 'fishingStand', // outdoor prep / cooking stand
  // Workbench (box-table with hammer + paper note)
  workbench: 'workbench',
  // Profession stations
  grindWheel: 'workbenchGrind', // sharpening wheel — miner
  anvil: 'workbenchAnvil',      // anvil + hammer — engineer
  // Support props
  floor: 'floor',
  fence: 'fence',
  fenceFortified: 'fenceFortified',
  chest: 'chest',
  bedroll: 'bedroll',
  barrel: 'barrel',
  box: 'box',
  boxOpen: 'boxOpen',
  structureBase: 'structureBase',
  structureRoof: 'structureRoof',
  structureCloth: 'structureCloth',
  structure: 'structure',
  // Tools (hand props / harvest visuals)
  toolAxe: 'toolAxe',
  toolPickaxe: 'toolPickaxe',
  toolShovel: 'toolShovel',
  toolHoe: 'toolHoe',
  // Nature (optional scatter)
  tree: 'tree',
  treeLarge: 'treeLarge',
  rockA: 'rockA',
  rockB: 'rockB',
  rockC: 'rockC',
  resourceWood: 'resourceWood',
  resourceStone: 'resourceStone',
} as const;

export type SurvivalKitNodeId = (typeof SURVIVAL_KIT_NODES)[keyof typeof SURVIVAL_KIT_NODES];

export interface SurvivalBuildStage {
  id: string;
  label: string;
  /** Profession / system that owns this station */
  profession?: 'camp' | 'cook' | 'craft' | 'miner' | 'engineer';
  nodeName: SurvivalKitNodeId;
  /** Suggested target height in metres after normalize */
  targetHeightM: number;
  description: string;
}

/** Ordered camp tent upgrade path + profession stations. */
export const CAMP_BUILD_STAGES: SurvivalBuildStage[] = [
  {
    id: 'tent_stage_1',
    label: 'Tent Frame',
    profession: 'camp',
    nodeName: SURVIVAL_KIT_NODES.tentStage1,
    targetHeightM: 2.2,
    description: 'First camp stage — half tent / poles',
  },
  {
    id: 'tent_stage_2',
    label: 'Closed Tent',
    profession: 'camp',
    nodeName: SURVIVAL_KIT_NODES.tentStage2,
    targetHeightM: 2.4,
    description: 'Second stage — fully closed tent',
  },
  {
    id: 'tent_stage_3',
    label: 'Camp Tent',
    profession: 'camp',
    nodeName: SURVIVAL_KIT_NODES.tentStage3,
    targetHeightM: 2.5,
    description: 'Final camp tent (open)',
  },
  {
    id: 'fireplace',
    label: 'Campfire',
    profession: 'cook',
    nodeName: SURVIVAL_KIT_NODES.campfire,
    targetHeightM: 0.9,
    description: 'Fireplace — fire ring, wood, cook bucket',
  },
  {
    id: 'cooking_bench',
    label: 'Cooking Bench',
    profession: 'cook',
    nodeName: SURVIVAL_KIT_NODES.cookingBench,
    targetHeightM: 1.4,
    description: 'Cooking / fish-prep stand',
  },
  {
    id: 'workbench',
    label: 'Workbench',
    profession: 'craft',
    nodeName: SURVIVAL_KIT_NODES.workbench,
    targetHeightM: 1.2,
    description: 'Table with hammer and paper note',
  },
  {
    id: 'grind_wheel',
    label: 'Sharpening Wheel',
    profession: 'miner',
    nodeName: SURVIVAL_KIT_NODES.grindWheel,
    targetHeightM: 1.3,
    description: 'Grind / sharpen station for miner',
  },
  {
    id: 'anvil',
    label: 'Anvil',
    profession: 'engineer',
    nodeName: SURVIVAL_KIT_NODES.anvil,
    targetHeightM: 1.2,
    description: 'Anvil station for engineer',
  },
];

const loader = new GLTFLoader();
let packRoot: THREE.Group | null = null;
let packLoad: Promise<THREE.Group | null> | null = null;

async function loadPackRoot(): Promise<THREE.Group | null> {
  if (packRoot) return packRoot;
  if (packLoad) return packLoad;

  packLoad = (async () => {
    const urls = [SURVIVAL_KIT_URL, resolveGrudgeAssetUrl(SURVIVAL_KIT_LOCAL), SURVIVAL_KIT_LOCAL];
    for (const url of urls) {
      try {
        const gltf = await loader.loadAsync(url);
        packRoot = gltf.scene as THREE.Group;
        console.log('[SurvivalKit] pack loaded from', url);
        return packRoot;
      } catch (e) {
        console.warn('[SurvivalKit] load failed', url, e);
      }
    }
    return null;
  })();

  return packLoad;
}

function findNamedNode(root: THREE.Object3D, nodeName: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    if (o.name === nodeName) found = o;
  });
  return found;
}

/**
 * Isolate one logical prop (e.g. "workbenchAnvil") from the multi-mesh kit.
 * Never returns the whole pack.
 */
export async function loadSurvivalKitNode(
  nodeName: string,
  targetHeightM = 1.5,
): Promise<THREE.Group> {
  const out = new THREE.Group();
  out.name = `survival_${nodeName}`;
  const pack = await loadPackRoot();
  if (!pack) return out;

  const source = findNamedNode(pack, nodeName);
  if (!source) {
    console.warn(`[SurvivalKit] node not found: ${nodeName}`);
    return out;
  }

  const cloned = source.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);
  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });

  const box = new THREE.Box3().setFromObject(cloned);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const s = targetHeightM / maxDim;
  cloned.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(cloned);
  cloned.position.y = -box2.min.y;

  out.add(cloned);
  out.userData.kitNode = nodeName;
  out.userData.packUrl = SURVIVAL_KIT_URL;
  return out;
}

export async function loadCampBuildStage(stageId: string): Promise<THREE.Group> {
  const stage = CAMP_BUILD_STAGES.find((s) => s.id === stageId);
  if (!stage) {
    console.warn('[SurvivalKit] unknown stage', stageId);
    return new THREE.Group();
  }
  return loadSurvivalKitNode(stage.nodeName, stage.targetHeightM);
}

/** Preload pack once (call from island boot). */
export async function preloadSurvivalKit(): Promise<void> {
  await loadPackRoot();
}
