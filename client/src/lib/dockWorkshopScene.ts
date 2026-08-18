/**
 * Dock-workshop backdrop — the boatbuilder three.js-editor scene
 * (compressed production bake of scene (10).glb).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { SeascapeOcean } from '@/lib/islandsCanonical/SeascapeOcean';

export const DOCK_WORKSHOP_SCENE = '/models/fleet/scenes/dock_workshop_scene.glb';

export interface DockWorkshopScene {
  group: THREE.Group;
  ocean: SeascapeOcean;
  berth: THREE.Vector3;
  lookAt: THREE.Vector3;
  dispose(): void;
}

export async function loadDockWorkshopScene(scene: THREE.Scene): Promise<DockWorkshopScene> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
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

  const gltf = await loader.loadAsync(DOCK_WORKSHOP_SCENE);
  const root = gltf.scene;
  root.name = 'boatbuilder_scene';
  root.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (n === 'water' || n.includes('water')) {
      o.visible = false;
      o.userData.editorIgnore = true;
    }
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  // Author AABB is ~275 m — SI workshop pad, not 100× ocean dump.
  normalizeToMetres(root, { targetSizeM: 42, axis: 'max', ground: true, centerXZ: true });
  group.add(root);
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const berth = new THREE.Vector3(center.x + size.x * 0.18, 0.28, box.max.z - size.z * 0.12);
  const lookAt = new THREE.Vector3(center.x, Math.max(1.2, center.y), center.z + size.z * 0.08);

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
