/**
 * KayKit Resource Bits as camp/boat/dock wealth — stack size from counts.
 * Extends locationInventory / mission resources. Not a second bag.
 */
import * as THREE from 'three';
import { loadGltfProduction } from '@/lib/threeProductionLoader';
import {
  KAYKIT_BITS_CDN,
  KAYKIT_BITS_LOCAL,
  CAMP_WEALTH_KINDS,
  BOAT_WEALTH_KINDS,
  DOCK_WEALTH_KINDS,
  bitFor,
  kaykitBitUuid,
  wealthTier,
  type ResourceWealthKind,
} from '@shared/gameDefinitions/kaykitResourceBits';

const packCache = new Map<string, THREE.Object3D>();

export async function loadKaykitBitsPack(): Promise<THREE.Object3D> {
  const hit = packCache.get(KAYKIT_BITS_LOCAL);
  if (hit) return hit;
  let gltf;
  try {
    gltf = await loadGltfProduction(KAYKIT_BITS_LOCAL);
  } catch {
    gltf = await loadGltfProduction(KAYKIT_BITS_CDN);
  }
  packCache.set(KAYKIT_BITS_LOCAL, gltf.scene);
  return gltf.scene;
}

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

function isolateBit(pack: THREE.Object3D, node: string): THREE.Group {
  const g = new THREE.Group();
  g.name = node;
  g.userData.assetUuid = kaykitBitUuid(node);
  const src = findNamed(pack, node);
  if (!src) return g;
  const c = src.clone(true);
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  g.add(c);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

const KIND_SLOT: Record<ResourceWealthKind, { x: number; z: number }> = {
  wood: { x: -1.7, z: 0.4 },
  stone: { x: 1.7, z: 0.4 },
  hemp: { x: -1.7, z: -1.6 },
  ore: { x: 1.7, z: -1.6 },
  gold: { x: 0, z: 1.8 },
  fuel: { x: 1.4, z: -0.2 },
  parts: { x: -1.4, z: -0.2 },
};

export type WealthLayout = 'camp' | 'boat' | 'dock';

const LAYOUT_KINDS: Record<WealthLayout, readonly ResourceWealthKind[]> = {
  camp: CAMP_WEALTH_KINDS,
  boat: BOAT_WEALTH_KINDS,
  dock: DOCK_WEALTH_KINDS,
};

export function mountResourceWealth(
  pack: THREE.Object3D,
  origin: THREE.Vector3,
  resources: Record<string, number>,
  layout: WealthLayout,
): THREE.Group {
  const root = new THREE.Group();
  root.name = `resource_wealth_${layout}`;
  root.position.copy(origin);
  const kinds = LAYOUT_KINDS[layout];
  const scale = layout === 'boat' ? 0.55 : 1;
  kinds.forEach((kind) => {
    const slot = KIND_SLOT[kind];
    const hold = new THREE.Group();
    hold.name = `wealth_${kind}`;
    hold.position.set(slot.x * scale, 0, slot.z * scale);
    hold.scale.setScalar(scale);
    hold.userData.kind = kind;
    for (const tier of [1, 2, 3] as const) {
      const def = bitFor(kind, tier);
      if (!def) continue;
      const mesh = isolateBit(pack, def.node);
      mesh.userData.tier = tier;
      mesh.visible = false;
      hold.add(mesh);
    }
    root.add(hold);
  });
  applyResourceWealth(root, resources);
  return root;
}

export function applyResourceWealth(root: THREE.Group, resources: Record<string, number>): void {
  root.children.forEach((hold) => {
    const kind = hold.userData.kind as ResourceWealthKind | undefined;
    if (!kind) return;
    const tier = wealthTier(resources[kind] ?? 0);
    hold.children.forEach((child) => {
      child.visible = (child.userData.tier as number) === tier;
    });
  });
}
