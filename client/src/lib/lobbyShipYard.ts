/**
 * Lobby (home island / production island) shipyard decoration:
 * place a showcase Boat Dock + hull previews near the starter dock.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DOCK_SHIP_RECIPES } from '@shared/gameDefinitions/waterEngagement';
import { getBoat } from '@shared/gameDefinitions/boatRegistry';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';
import { createDock, type DockData } from '@/lib/islandDockSystem';
import type { TerrainData } from '@/lib/islandHeightmapTerrain';

const loader = new GLTFLoader();

async function loadHull(path: string, heightM: number): Promise<THREE.Group | null> {
  try {
    const gltf = await loader.loadAsync(resolveGrudgeAssetUrl(path));
    const g = gltf.scene.clone(true) as THREE.Group;
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.01) g.scale.multiplyScalar(heightM / size.y);
    const box2 = new THREE.Box3().setFromObject(g);
    g.position.y -= box2.min.y;
    g.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return g;
  } catch {
    return null;
  }
}

export interface LobbyShipYard {
  group: THREE.Group;
  dock: DockData | null;
}

/**
 * Build a lobby shipyard near the south dock: 5 tier hulls lined along the pier
 * so players see production water engagement assets on the home island map.
 */
export async function createLobbyShipYard(
  scene: THREE.Scene,
  terrain: TerrainData,
  side: 'north' | 'south' | 'east' | 'west' = 'south',
): Promise<LobbyShipYard> {
  const group = new THREE.Group();
  group.name = 'lobby_ship_yard';
  scene.add(group);

  let dock: DockData | null = null;
  try {
    dock = createDock(terrain, side);
    // Offset a second "shipyard" label pier slightly from the main dock
    group.add(dock.group);
  } catch (e) {
    console.warn('[lobbyShipYard] dock create failed', e);
  }

  const origin = dock?.spawnPoint.clone() ?? new THREE.Vector3(0, 1, terrain.radius * 0.4);
  const lineDir = new THREE.Vector3(1, 0, 0);

  let i = 0;
  for (const recipe of DOCK_SHIP_RECIPES) {
    const mesh = await loadHull(recipe.modelPath, 3.2 + i * 0.35);
    if (!mesh) {
      // procedural fallback box "hull"
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2 + i * 0.4, 1, 4 + i * 0.6),
        new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.9 }),
      );
      box.position.copy(origin).add(lineDir.clone().multiplyScalar((i - 2) * 8));
      box.position.y += 0.5;
      box.name = `lobby_hull_fallback_${recipe.hull}`;
      group.add(box);
    } else {
      mesh.position.copy(origin).add(lineDir.clone().multiplyScalar((i - 2) * 8));
      mesh.position.y += 0.2;
      mesh.rotation.y = Math.PI * 0.5;
      mesh.name = `lobby_hull_${recipe.hull}`;
      group.add(mesh);
    }
    i++;
  }

  // Starter raft near dock mouth
  const raft = await loadHull(getBoat('raft').modelPath, 2.8);
  if (raft) {
    raft.position.copy(origin).add(new THREE.Vector3(0, 0, 6));
    raft.name = 'lobby_hull_raft';
    group.add(raft);
  }

  return { group, dock };
}
