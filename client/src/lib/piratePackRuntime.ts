/**
 * Isolate / compose pirate-pack prefabs. One GLB load, named meshes.
 * Cannon = stand + barrel. Chests/barrels = closed/open swap on E.
 * Not a second mixer, physics, or bag DB.
 */
import * as THREE from 'three';
import { loadGltfProduction } from '@/lib/threeProductionLoader';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { fleetMeshUuid } from '@shared/gameDefinitions/fleetMeshUuid';
import {
  PIRATE_PACK_CDN,
  PIRATE_PACK_LOCAL,
  PIRATE_PACK_R2_KEY,
  PIRATE_PREFABS,
  rollBuriedTreasure,
  type PiratePrefabDef,
} from '@shared/camp/piratePack';

export interface PirateInspectable {
  prefabId: string;
  group: THREE.Group;
  closed: THREE.Object3D | null;
  open: THREE.Object3D | null;
  opened: boolean;
  prompt: string;
}

let packRoot: THREE.Group | null = null;
let packLoad: Promise<THREE.Group> | null = null;

export async function loadPiratePackRoot(): Promise<THREE.Group> {
  if (packRoot) return packRoot;
  if (packLoad) return packLoad;
  packLoad = (async () => {
    try {
      const gltf = await loadGltfProduction(PIRATE_PACK_LOCAL);
      packRoot = gltf.scene;
    } catch {
      const gltf = await loadGltfProduction(PIRATE_PACK_CDN);
      packRoot = gltf.scene;
    }
    return packRoot;
  })();
  return packLoad;
}

export function isolateNamed(root: THREE.Object3D, nodeName: string): THREE.Group | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && o.name === nodeName) hit = o;
  });
  if (!hit) return null;
  const g = new THREE.Group();
  g.name = nodeName;
  const c = hit.clone(true);
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  g.add(c);
  return g;
}

export function composePiratePrefab(def: PiratePrefabDef, pack: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.name = def.id;
  group.userData.piratePrefab = def.id;
  group.userData.assetUuid = fleetMeshUuid(PIRATE_PACK_R2_KEY, `prefab:${def.id.replace(/^prefab\./, '')}`);
  group.userData.playSafe = def.role !== 'dinghy';

  const parts: Record<string, THREE.Group> = {};
  for (const part of def.parts) {
    const iso = isolateNamed(pack, part.meshName);
    if (!iso) continue;
    iso.userData.partRole = part.role;
    if (part.offset) iso.position.set(part.offset[0], part.offset[1], part.offset[2]);
    group.add(iso);
    parts[part.role] = iso;
  }

  if (def.role === 'cannon' && parts.base && parts.barrel) {
    parts.base.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(parts.base);
    const size = box.getSize(new THREE.Vector3());
    const fit = 0.85 / Math.max(size.y, 0.2);
    parts.base.scale.multiplyScalar(fit);
    parts.base.updateMatrixWorld(true);
    const stand = new THREE.Box3().setFromObject(parts.base);
    parts.barrel.scale.multiplyScalar(fit);
    parts.barrel.position.set(0, stand.max.y - stand.min.y, 0);
  }

  if (def.lid) {
    const closed = parts.closed ?? null;
    const open = parts.open ?? null;
    if (closed) closed.visible = true;
    if (open) open.visible = false;
    group.userData.inspectable = {
      prefabId: def.id,
      group,
      closed,
      open,
      opened: false,
      prompt: def.lid.prompt,
    } satisfies PirateInspectable;
  }

  const axis =
    def.role === 'cannon' || def.role === 'dinghy' || def.role === 'fishing' ? 'length' : 'max';
  const target = axis === 'length' ? def.lengthM : def.heightM;
  normalizeToMetres(group, { targetSizeM: target, axis, ground: true, centerXZ: true });
  return group;
}

export async function spawnPiratePrefab(id: string): Promise<THREE.Group | null> {
  const def = PIRATE_PREFABS.find((p) => p.id === id);
  if (!def) return null;
  const pack = await loadPiratePackRoot();
  return composePiratePrefab(def, pack);
}

export function togglePirateInspect(obj: THREE.Object3D): { opened: boolean; loot: ReturnType<typeof rollBuriedTreasure> | null; prompt: string } | null {
  const data = obj.userData?.inspectable as PirateInspectable | undefined;
  if (!data) return null;
  data.opened = !data.opened;
  if (data.closed) data.closed.visible = !data.opened;
  if (data.open) data.open.visible = data.opened;
  const loot = data.opened ? rollBuriedTreasure() : null;
  return { opened: data.opened, loot, prompt: data.prompt };
}

export function findInspectable(root: THREE.Object3D | null, from: THREE.Vector3, radius = 2.6): THREE.Object3D | null {
  if (!root) return null;
  let best: THREE.Object3D | null = null;
  let bestD = radius;
  const p = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.userData?.inspectable) return;
    o.getWorldPosition(p);
    const d = p.distanceTo(from);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  });
  return best;
}
