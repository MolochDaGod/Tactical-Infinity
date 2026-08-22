/**
 * Parent→child mesh tree for editor selection.
 * Walks the live Object3D graph — not a second scene index.
 */
import * as THREE from 'three';

export interface HierarchyNode {
  uuid: string;
  name: string;
  kind: 'mesh' | 'group' | 'other';
  /** D1 definition UUID (fleetMeshUuid) — not THREE.uuid, not player grudge_uuid. */
  assetUuid?: string;
  xyz?: [number, number, number];
  childCount: number;
  children: HierarchyNode[];
}

const SKIP =
  /^(TransformControls|GridHelper|AxesHelper|HemisphereLight|DirectionalLight|AmbientLight|PerspectiveCamera|label_)/i;

function skip(o: THREE.Object3D): boolean {
  if (o.userData?.editorIgnore || o.userData?.editorCollider) return true;
  if ((o as THREE.Light).isLight) return true;
  if ((o as THREE.Camera).isCamera) return true;
  if (SKIP.test(o.name) || o.name.startsWith('TransformControls')) return true;
  if ((o as any).isTransformControls) return true;
  return false;
}

function kindOf(o: THREE.Object3D): HierarchyNode['kind'] {
  if ((o as THREE.Mesh).isMesh) return 'mesh';
  if (o.children.length) return 'group';
  return 'other';
}

function label(o: THREE.Object3D): string {
  const n = o.name?.trim();
  if (n) return n;
  if ((o as THREE.Mesh).isMesh) return `Mesh ${o.id}`;
  return o.type || `Node ${o.id}`;
}

function walk(o: THREE.Object3D): HierarchyNode | null {
  if (skip(o)) return null;
  const kids: HierarchyNode[] = [];
  for (const c of o.children) {
    const n = walk(c);
    if (n) kids.push(n);
  }
  if (!o.name && !(o as THREE.Mesh).isMesh && kids.length === 0) return null;
  const loc = o.userData?.location as { xyz?: [number, number, number] } | undefined;
  const assetUuid = typeof o.userData?.assetUuid === 'string' ? o.userData.assetUuid : undefined;
  return {
    uuid: o.uuid,
    name: label(o),
    kind: kindOf(o),
    assetUuid,
    xyz: loc?.xyz,
    childCount: kids.length,
    children: kids,
  };
}

export function buildSceneHierarchy(roots: THREE.Object3D | THREE.Object3D[]): HierarchyNode[] {
  const list = Array.isArray(roots) ? roots : [roots];
  const out: HierarchyNode[] = [];
  for (const r of list) {
    if (skip(r)) {
      for (const c of r.children) {
        const n = walk(c);
        if (n) out.push(n);
      }
      continue;
    }
    const n = walk(r);
    if (n) out.push(n);
  }
  return out;
}

export function findByUuid(root: THREE.Object3D, uuid: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && o.uuid === uuid) hit = o;
  });
  return hit;
}

export function countHierarchy(nodes: HierarchyNode[]): { nodes: number; meshes: number } {
  let n = 0;
  let m = 0;
  const visit = (row: HierarchyNode) => {
    n += 1;
    if (row.kind === 'mesh') m += 1;
    row.children.forEach(visit);
  };
  nodes.forEach(visit);
  return { nodes: n, meshes: m };
}
