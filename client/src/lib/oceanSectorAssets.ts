/**
 * Place / resolve ship + dock assets for lobby and all 9 ocean sectors.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  DOCK_SHIP_RECIPES,
  OCEAN_SECTORS,
  type OceanSector,
  type OceanSectorId,
} from '@shared/gameDefinitions/waterEngagement';
import { getBoat } from '@shared/gameDefinitions/boatRegistry';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';

const loader = new GLTFLoader();
const meshCache = new Map<string, THREE.Group>();

async function loadModel(path: string): Promise<THREE.Group | null> {
  if (meshCache.has(path)) return meshCache.get(path)!.clone(true);
  try {
    const url = resolveGrudgeAssetUrl(path);
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene as THREE.Group;
    root.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    meshCache.set(path, root);
    return root.clone(true);
  } catch (e) {
    console.warn('[oceanSectorAssets] load failed', path, e);
    return null;
  }
}

function fitHeight(group: THREE.Group, targetH: number): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return;
  const s = targetH / size.y;
  group.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(group);
  group.position.y -= box2.min.y;
}

/**
 * Spawn decorative ship tier models around a sector center for lobby / map.
 * Density driven by sector.dockDensity.
 */
export async function spawnSectorShipShowcase(
  scene: THREE.Scene,
  sector: OceanSector,
  opts?: { scale?: number; y?: number },
): Promise<THREE.Group> {
  const root = new THREE.Group();
  root.name = `sector_ships_${sector.id}`;
  root.position.set(sector.center.x, opts?.y ?? 0.5, sector.center.z);
  scene.add(root);

  const density =
    sector.dockDensity === 'capital'
      ? DOCK_SHIP_RECIPES.length
      : sector.dockDensity === 'busy'
        ? 3
        : sector.dockDensity === 'sparse'
          ? 2
          : 1;

  const recipes = DOCK_SHIP_RECIPES.slice(0, density);
  // Always include focus hull if not already
  const focus = DOCK_SHIP_RECIPES.find((r) => r.hull === sector.shipTierFocus);
  if (focus && !recipes.includes(focus)) recipes.push(focus);

  const spacing = 18;
  let i = 0;
  for (const recipe of recipes) {
    const path = recipe.modelPath || getBoat(recipe.hull).modelPath;
    const mesh = await loadModel(path);
    if (!mesh) continue;
    fitHeight(mesh, opts?.scale ?? 6);
    const angle = (i / Math.max(1, recipes.length)) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * spacing, 0, Math.sin(angle) * spacing);
    mesh.rotation.y = -angle + Math.PI / 2;
    mesh.name = `showcase_${recipe.hull}`;
    root.add(mesh);
    i++;
  }

  // Raft placeholder near center for lobby sector
  if (sector.id === 'center' || sector.shipTierFocus === 'raft') {
    const raft = await loadModel(getBoat('raft').modelPath);
    if (raft) {
      fitHeight(raft, 4);
      raft.position.set(0, 0, 0);
      raft.name = 'showcase_raft';
      root.add(raft);
    }
  }

  return root;
}

/** Spawn showcase for every sector (world map init). */
export async function spawnAllSectorShipAssets(scene: THREE.Scene): Promise<Map<OceanSectorId, THREE.Group>> {
  const map = new Map<OceanSectorId, THREE.Group>();
  for (const sector of OCEAN_SECTORS) {
    const g = await spawnSectorShipShowcase(scene, sector);
    map.set(sector.id, g);
  }
  return map;
}

export function listSectors(): readonly OceanSector[] {
  return OCEAN_SECTORS;
}
