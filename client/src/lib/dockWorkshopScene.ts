/**
 * Dock-workshop scene process:
 * 1. Load the boatbuilder bake once.
 * 2. Drop duplicate layers (second ocean/island, giant shark, baked player, baked hull).
 * 3. Do NOT fit the fused AABB — the baked dude is already ~1.93 m (SI).
 * 4. Ground remaining meshes to y=0. One Seascape only.
 * 5. Place a 1.8 m yardstick + SI hull at the berth.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LoadingManager } from 'three';
import { patchGltfMissingMaps } from '@/lib/gltfMissingMaps';
import { SeascapeOcean } from '@/lib/islandsCanonical/SeascapeOcean';

export const DOCK_WORKSHOP_SCENE = '/models/fleet/scenes/dock_workshop_scene.glb';
export const HUMAN_HEIGHT_M = 1.8;

/** Extra fused layers that stack on the workshop (author names). */
const DROP_NAME =
  /isola_ocean|atollo_sabbia|squalo|dude000|barca_legno|perspectivecamera|nurbspath|water|ocean/i;

export interface DockWorkshopScene {
  group: THREE.Group;
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  ocean: SeascapeOcean;
  berth: THREE.Vector3;
  lookAt: THREE.Vector3;
  player: THREE.Object3D;
  report: WorkshopScaleReport;
  dispose(): void;
}

export interface WorkshopScaleReport {
  kept: number;
  dropped: string[];
  sceneSizeM: [number, number, number];
  playerHeightM: number;
  waterlineAuthorY: number;
}

function shouldDrop(obj: THREE.Object3D): boolean {
  const n = `${obj.name} ${obj.parent?.name || ''}`;
  if (DROP_NAME.test(n)) return true;
  if (!((obj as THREE.Mesh).isMesh)) return false;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  // Giant leftover from the editor dump — not a dock plank.
  if (size.y > 24 || Math.max(size.x, size.z) > 70) return true;
  return false;
}

/** 1.8 m human capsule — yardstick, not a second mixer hero. */
export function makeSiPlayerYardstick(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'si_player_1_8m';
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.7 }),
  );
  body.position.y = HUMAN_HEIGHT_M / 2;
  body.castShadow = true;
  g.add(body);
  g.userData.siHeightM = HUMAN_HEIGHT_M;
  return g;
}

export function prepareWorkshopLayers(root: THREE.Object3D): WorkshopScaleReport {
  const dropped: string[] = [];
  const toHide: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (shouldDrop(o)) toHide.push(o);
  });
  for (const o of toHide) {
    o.visible = false;
    o.userData.editorIgnore = true;
    if (o.name) dropped.push(o.name);
  }

  root.updateMatrixWorld(true);
  let waterline = Number.POSITIVE_INFINITY;
  let sandHit = false;
  const box = new THREE.Box3();
  let any = false;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    box.expandByObject(m);
    any = true;
    const n = `${m.name} ${m.parent?.name || ''}`.toLowerCase();
    const mb = new THREE.Box3().setFromObject(m);
    if (/sabbia|sand|beach|shore/.test(n)) {
      waterline = Math.min(waterline, mb.min.y);
      sandHit = true;
    } else if (!sandHit && /casetta|shack|hut/.test(n)) {
      waterline = Math.min(waterline, mb.min.y - 0.35);
    }
  });
  if (!isFinite(waterline) && any) waterline = box.min.y;
  if (any && isFinite(waterline)) {
    root.position.y -= waterline;
    root.updateMatrixWorld(true);
    box.translate(new THREE.Vector3(0, -waterline, 0));
  }

  const size = box.getSize(new THREE.Vector3());
  let kept = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.visible) {
      kept += 1;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });

  return {
    kept,
    dropped: [...new Set(dropped)],
    sceneSizeM: [size.x, size.y, size.z],
    playerHeightM: HUMAN_HEIGHT_M,
    waterlineAuthorY: isFinite(waterline) ? waterline : 0,
  };
}

export async function loadDockWorkshopScene(scene: THREE.Scene): Promise<DockWorkshopScene> {
  const mgr = new LoadingManager();
  patchGltfMissingMaps(mgr);
  const loader = new GLTFLoader(mgr);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const group = new THREE.Group();
  group.name = 'dock_workshop_scene';

  const ocean = new SeascapeOcean({
    size: 220,
    segments: 80,
    sunDirection: new THREE.Vector3(0.4, 1, 0.35),
  });
  ocean.mesh.position.y = 0;
  ocean.mesh.userData.editorIgnore = true;
  scene.add(ocean.mesh);

  const gltf = await loader.loadAsync(DOCK_WORKSHOP_SCENE);
  const root = gltf.scene;
  root.name = 'boatbuilder_scene';
  const report = prepareWorkshopLayers(root);
  group.add(root);

  const keepBox = new THREE.Box3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.visible) keepBox.expandByObject(m);
  });
  const center = keepBox.getCenter(new THREE.Vector3());
  const size = keepBox.getSize(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);

  const player = makeSiPlayerYardstick();
  const berth = new THREE.Vector3(size.x * 0.12, 0, size.z * 0.22);
  player.position.set(berth.x - 1.4, 0, berth.z);
  group.add(player);
  scene.add(group);

  const lookAt = new THREE.Vector3(0, 1.6, 0);
  console.info(
    '[dock-workshop] SI',
    `player=${HUMAN_HEIGHT_M}m`,
    `kept=${report.kept}`,
    `dropped=${report.dropped.length}`,
    `pad=${report.sceneSizeM.map((n) => n.toFixed(1)).join('×')}m`,
  );

  return {
    group,
    root,
    clips: gltf.animations ?? [],
    ocean,
    berth,
    lookAt,
    player,
    report,
    dispose() {
      scene.remove(group);
      scene.remove(ocean.mesh);
      ocean.dispose();
    },
  };
}
