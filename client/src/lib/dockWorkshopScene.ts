/**
 * Dock-workshop backdrop — the boatbuilder scene:
 * sea shack + wooden dock props + island (1), on Seascape water.
 * Does not ship the 118 MB fused editor export.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { SeascapeOcean } from '@/lib/islandsCanonical/SeascapeOcean';
import { COASTAL_ISLET_URL } from '@/lib/placeCoastalIslet';

export const DOCK_WORKSHOP_SHACK = '/models/fleet/scenes/sea_shack.glb';
export const DOCK_WORKSHOP_DOCKS = '/models/fleet/scenes/wooden_docks_props.glb';

export interface DockWorkshopScene {
  group: THREE.Group;
  ocean: SeascapeOcean;
  /** World point to park the working hull. */
  berth: THREE.Vector3;
  /** Look-at for the workshop camera. */
  lookAt: THREE.Vector3;
  dispose(): void;
}

function paint(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  });
}

export async function loadDockWorkshopScene(scene: THREE.Scene): Promise<DockWorkshopScene> {
  const loader = new GLTFLoader();
  const group = new THREE.Group();
  group.name = 'dock_workshop_scene';

  const ocean = new SeascapeOcean({
    size: 280,
    segments: 96,
    sunDirection: new THREE.Vector3(0.4, 1, 0.35),
  });
  ocean.mesh.position.y = 0;
  ocean.mesh.userData.editorIgnore = true;
  scene.add(ocean.mesh);

  const [shackGltf, docksGltf, islandGltf] = await Promise.all([
    loader.loadAsync(DOCK_WORKSHOP_SHACK).catch(() => null),
    loader.loadAsync(DOCK_WORKSHOP_DOCKS).catch(() => null),
    loader.loadAsync(COASTAL_ISLET_URL).catch(() => null),
  ]);

  if (islandGltf) {
    const island = islandGltf.scene;
    island.name = 'workshop_island';
    normalizeToMetres(island, { targetSizeM: 36, axis: 'max', ground: true, centerXZ: true });
    island.position.set(-6, 0.02, -8);
    island.rotation.y = Math.PI * 0.2;
    paint(island);
    group.add(island);
  }

  if (shackGltf) {
    const shack = shackGltf.scene;
    shack.name = 'sea_shack';
    normalizeToMetres(shack, { targetSizeM: 8.5, axis: 'max', ground: true, centerXZ: true });
    shack.position.set(-2.2, 0.05, 1.4);
    shack.rotation.y = -Math.PI * 0.15;
    paint(shack);
    group.add(shack);
  }

  if (docksGltf) {
    const docks = docksGltf.scene;
    docks.name = 'wooden_docks';
    normalizeToMetres(docks, { targetSizeM: 14, axis: 'max', ground: true, centerXZ: true });
    docks.position.set(3.2, 0.08, 4.5);
    docks.rotation.y = Math.PI * 0.08;
    paint(docks);
    group.add(docks);
  }

  scene.add(group);

  const berth = new THREE.Vector3(6.2, 0.28, 7.4);
  const lookAt = new THREE.Vector3(2.5, 1.2, 3.5);

  return {
    group,
    ocean,
    berth,
    lookAt,
    dispose() {
      scene.remove(group);
      scene.remove(ocean.mesh);
      ocean.dispose();
    },
  };
}
