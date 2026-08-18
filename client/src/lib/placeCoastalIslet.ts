/**
 * Place island (1) as a small islet off the existing home-island coast.
 * Home island terrain stays the play surface. The GLB is a look shell in the water.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { normalizeToMetres } from '@/lib/modelNormalize';
import type { TerrainData } from '@/lib/islandHeightmapTerrain';

export const COASTAL_ISLET_URL = '/models/fleet/islands/island_test.glb';

export interface CoastalIslet {
  group: THREE.Group;
  /** World position used for discover / approach. */
  center: THREE.Vector3;
}

/**
 * Sit the test island east of home, in open water past the shoreline.
 */
export async function placeCoastalIslet(
  scene: THREE.Scene,
  terrain: TerrainData,
): Promise<CoastalIslet | null> {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(COASTAL_ISLET_URL);
    const group = gltf.scene;
    group.name = 'coastal_islet';
    normalizeToMetres(group, { targetSizeM: 22, axis: 'max', ground: true, centerXZ: true });

    const r = terrain.radius;
    // Past the home shoreline (~0.95*r) so the islet sits in open water.
    const x = r * 1.18;
    const z = r * 0.12;
    const seaY = 0.05;
    group.position.set(x, seaY, z);
    group.rotation.y = Math.PI * 0.15;
    group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    scene.add(group);
    return { group, center: new THREE.Vector3(x, seaY, z) };
  } catch (e) {
    console.warn('[coastalIslet] load failed', e);
    return null;
  }
}

export function nearIslet(player: THREE.Vector3, islet: CoastalIslet, range = 14): boolean {
  const dx = player.x - islet.center.x;
  const dz = player.z - islet.center.z;
  return Math.sqrt(dx * dx + dz * dz) < range;
}
