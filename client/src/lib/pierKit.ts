/**
 * Isolate + tile modular wooden pier pieces. Extends islandDockSystem.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { normalizeToMetres } from '@/lib/modelNormalize';
import {
  PIER_KIT_URL,
  PIER_PARTS,
  type PierPartDef,
} from '@shared/gameDefinitions/pierKitCatalog';

const loader = new GLTFLoader();
let pack: THREE.Group | null = null;
let packPromise: Promise<THREE.Group | null> | null = null;

export async function loadPierKit(): Promise<THREE.Group | null> {
  if (pack) return pack;
  if (packPromise) return packPromise;
  packPromise = loader
    .loadAsync(PIER_KIT_URL)
    .then((g) => {
      pack = g.scene as THREE.Group;
      return pack;
    })
    .catch((e) => {
      console.warn('[pierKit] load failed', e);
      packPromise = null;
      return null;
    });
  return packPromise;
}

function findNamed(root: THREE.Object3D, needle: string): THREE.Object3D | null {
  let exact: THREE.Object3D | null = null;
  let fuzzy: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!o.name) return;
    if (o.name === needle) exact = o;
    else if (!fuzzy && (o.name.startsWith(needle + '_') || o.name.endsWith('_' + needle))) fuzzy = o;
  });
  return exact ?? fuzzy;
}

export function isolatePierPart(root: THREE.Group, part: PierPartDef): THREE.Group {
  const src = findNamed(root, part.node);
  const g = new THREE.Group();
  g.name = `pier_${part.id}`;
  g.userData.pierPart = part;
  if (!src) return g;
  const clone = src.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  g.add(clone);
  normalizeToMetres(g, {
    targetSizeM: part.lengthM,
    axis: 'length',
    ground: true,
    centerXZ: true,
  });
  g.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

export function getPierPart(id: string): PierPartDef | undefined {
  return PIER_PARTS.find((p) => p.id === id);
}

/** Straight walkway + end cap along +Z (seaward). */
export function assemblePierRun(
  root: THREE.Group,
  tiles: number,
  straight: PierPartDef,
  end: PierPartDef,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pier_run';
  let z = 0;
  for (let i = 0; i < tiles; i++) {
    const piece = isolatePierPart(root, straight);
    piece.position.z = z + straight.lengthM * 0.5;
    g.add(piece);
    z += straight.lengthM;
  }
  const cap = isolatePierPart(root, end);
  cap.position.z = z + end.lengthM * 0.5;
  g.add(cap);
  return g;
}

export { PIER_PARTS, PIER_KIT_URL };
