/**
 * Isolate + cut-down for the low-poly forest pack.
 * Extends IslandStarterMission harvest — does not replace it.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';
import { patchGltfMissingMaps } from '@/lib/gltfMissingMaps';
import { normalizeToMetres } from '@/lib/modelNormalize';
import {
  ALL_FOREST_PARTS,
  FOREST_LOGS,
  FOREST_PACK_URL,
  FOREST_STUMPS,
  FOREST_TREES,
  type ForestPart,
  type ForestTreeType,
} from '@shared/gameDefinitions/forestHarvestCatalog';

const gltfMgr = new LoadingManager();
patchGltfMissingMaps(gltfMgr);
const loader = new GLTFLoader(gltfMgr);
let packRoot: THREE.Group | null = null;
let packPromise: Promise<THREE.Group | null> | null = null;

export async function loadForestPack(): Promise<THREE.Group | null> {
  if (packRoot) return packRoot;
  if (packPromise) return packPromise;
  packPromise = loader
    .loadAsync(FOREST_PACK_URL)
    .then((g) => {
      packRoot = g.scene as THREE.Group;
      return packRoot;
    })
    .catch((e) => {
      console.warn('[forestHarvest] pack load failed', e);
      packPromise = null;
      return null;
    });
  return packPromise;
}

function findNamed(root: THREE.Object3D, needle: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (hit) return;
    if (o.name === needle || o.name.includes(needle)) hit = o;
  });
  return hit;
}

export function isolateForestPart(root: THREE.Group, part: ForestPart): THREE.Group {
  const src = findNamed(root, part.node);
  const g = new THREE.Group();
  g.name = `forest_${part.node}`;
  g.userData.forestPart = part;
  if (!src) return g;
  const clone = src.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  g.add(clone);
  normalizeToMetres(g, { targetSizeM: part.heightM, axis: 'height', ground: true, centerXZ: true });
  g.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

export function isolateNamed(root: THREE.Group, node: string, heightM: number): THREE.Group {
  const src = findNamed(root, node);
  const g = new THREE.Group();
  g.name = `forest_${node}`;
  if (!src) return g;
  const clone = src.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  g.add(clone);
  normalizeToMetres(g, { targetSizeM: heightM, axis: 'height', ground: true, centerXZ: true });
  return g;
}

export interface CutDownResult {
  stump: THREE.Group | null;
  logs: THREE.Group[];
}

/** After last hit: hide standing tree, plant stump + 1–2 logs. */
export function spawnCutDown(
  scene: THREE.Scene,
  pack: THREE.Group,
  treeType: ForestTreeType,
  worldPos: THREE.Vector3,
  yaw: number,
): CutDownResult {
  const stumpName = FOREST_STUMPS[treeType][0];
  const stump = isolateNamed(pack, stumpName, 0.7);
  if (stump.children.length) {
    stump.position.copy(worldPos);
    stump.rotation.y = yaw;
    scene.add(stump);
  }
  const logs: THREE.Group[] = [];
  const logNames = FOREST_LOGS[treeType];
  const n = Math.min(2, logNames.length);
  for (let i = 0; i < n; i++) {
    const log = isolateNamed(pack, logNames[i % logNames.length], 0.45);
    if (!log.children.length) continue;
    log.position.copy(worldPos);
    log.position.x += Math.cos(yaw + i * 1.2) * (0.9 + i * 0.4);
    log.position.z += Math.sin(yaw + i * 1.2) * (0.9 + i * 0.4);
    log.position.y += 0.12;
    log.rotation.y = yaw + i;
    log.rotation.z = Math.PI / 2;
    scene.add(log);
    logs.push(log);
  }
  return { stump: stump.children.length ? stump : null, logs };
}

export function allTreeParts(): ForestPart[] {
  return [...FOREST_TREES];
}

export function pickParts<T extends ForestPart>(list: readonly T[], n: number, seed = 1): T[] {
  const out: T[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(list[s % list.length]);
  }
  return out;
}

export { ALL_FOREST_PARTS };
