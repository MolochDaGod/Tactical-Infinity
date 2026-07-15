/**
 * note_of_arms multipack — isolate by node (Chain_V1…V8). Never place whole pack.
 *
 * Chain uses:
 *  - anchor: ship → seabed
 *  - build_link: placeable chain
 *  - harpoon_trail: multi-segment trail
 *
 * Scale: normalize each isolated mesh to segmentLengthM (metres) once.
 * Stretch: non-uniform scale along chain axis via quaternion (no rotateX accumulation).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';
import { normalizeToMetres } from './modelNormalize';
import { resolveWarlordsUrl } from './warlordsAssetCatalog';

export const NOTE_OF_ARMS_URL = resolveWarlordsUrl(
  'models/environment/note-of-arms/note_of_arms_v2.glb',
);
export const NOTE_OF_ARMS_URL_LEGACY = resolveWarlordsUrl(
  'models/environment/note-of-arms/note_of_arms_environment_assets_set_1.glb',
);

export const NOTE_OF_ARMS_NODES = {
  chains: [
    'Chain_V1',
    'Chain_V2',
    'Chain_V3',
    'Chain_V4',
    'Chain_V5',
    'Chain_V6',
    'Chain_V7',
    'Chain_V8',
  ],
  campfires: ['Campfire_V1', 'Campfire_V2', 'Campfire_V3', 'Campfire_V4', 'Campfire_V5'],
  barrels: ['Barrel'],
  boards: ['Boards_V1', 'Boards_V2', 'Boards_V3'],
  candles: ['Candle_V1', 'Candle_V2', 'Candle_V3'],
  crates: ['Crate_V1', 'Crate_V2', 'Crate_V3', 'Crate_V4', 'Crate_V5'],
  crystals: [
    'Crystal_V1',
    'Crystal_V2',
    'Crystal_V3',
    'Crystal_V4',
    'Crystal_V5',
    'Crystal_V6',
  ],
} as const;

export type ChainUse = 'anchor' | 'build_link' | 'harpoon_trail';

export interface ChainAssetUse {
  nodeName: string;
  use: ChainUse;
  label: string;
  /** Rest length in metres after normalize (before stretch) */
  segmentLengthM: number;
}

export const CHAIN_USES: ChainAssetUse[] = [
  { nodeName: 'Chain_V1', use: 'anchor', label: 'Anchor chain (short)', segmentLengthM: 1.2 },
  { nodeName: 'Chain_V2', use: 'anchor', label: 'Anchor chain (medium)', segmentLengthM: 1.6 },
  { nodeName: 'Chain_V3', use: 'build_link', label: 'Buildable chain link A', segmentLengthM: 1.0 },
  { nodeName: 'Chain_V4', use: 'build_link', label: 'Buildable chain link B', segmentLengthM: 1.1 },
  { nodeName: 'Chain_V5', use: 'harpoon_trail', label: 'Harpoon trail fine', segmentLengthM: 0.65 },
  { nodeName: 'Chain_V6', use: 'harpoon_trail', label: 'Harpoon trail med', segmentLengthM: 0.85 },
  { nodeName: 'Chain_V7', use: 'anchor', label: 'Heavy anchor chain', segmentLengthM: 2.0 },
  { nodeName: 'Chain_V8', use: 'build_link', label: 'Heavy build chain', segmentLengthM: 1.4 },
];

const loader = new GLTFLoader();
let packRoot: THREE.Group | null = null;
let packLoad: Promise<THREE.Group | null> | null = null;

const _yAxis = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

async function loadPackRoot(): Promise<THREE.Group | null> {
  if (packRoot) return packRoot;
  if (packLoad) return packLoad;

  packLoad = (async () => {
    const urls = [
      NOTE_OF_ARMS_URL,
      NOTE_OF_ARMS_URL_LEGACY,
      resolveGrudgeAssetUrl(NOTE_OF_ARMS_URL),
    ];
    for (const url of urls) {
      try {
        const gltf = await loader.loadAsync(url);
        packRoot = gltf.scene as THREE.Group;
        console.log('[NoteOfArms] pack loaded from', url);
        return packRoot;
      } catch (e) {
        console.warn('[NoteOfArms] load failed', url, e);
      }
    }
    return null;
  })();

  return packLoad;
}

function findNamedNode(root: THREE.Object3D, nodeName: string): THREE.Object3D | null {
  let exact: THREE.Object3D | null = null;
  let prefix: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (exact) return;
    if (o.name === nodeName) {
      exact = o;
      return;
    }
    if (!prefix && (o.name.startsWith(nodeName + '_') || o.name === nodeName)) {
      prefix = o;
    }
  });
  return exact ?? prefix;
}

/**
 * Isolate one named prop. Never returns the whole pack.
 * `targetSizeM` = max bbox dim in metres (segment rest length for chains).
 */
export async function loadNoteOfArmsNode(
  nodeName: string,
  targetSizeM = 1.0,
): Promise<THREE.Group> {
  const out = new THREE.Group();
  out.name = `note_of_arms_${nodeName}`;
  const pack = await loadPackRoot();
  if (!pack) return out;

  const source = findNamedNode(pack, nodeName);
  if (!source) {
    console.warn(`[NoteOfArms] node not found: ${nodeName}`);
    return out;
  }

  const cloned = source.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });

  out.add(cloned);
  // Fit max axis → target metres (chain rest length)
  normalizeToMetres(out, {
    targetSizeM,
    axis: 'max',
    center: true,
  });

  out.userData.kitNode = nodeName;
  out.userData.packUrl = NOTE_OF_ARMS_URL;
  out.userData.restLengthM = targetSizeM;
  out.userData.radialScale = 1;
  return out;
}

export function getChainDef(use: ChainUse, preferHeavy = false): ChainAssetUse {
  const list = CHAIN_USES.filter((c) => c.use === use);
  if (preferHeavy) return list[list.length - 1] ?? CHAIN_USES[0]!;
  return list[0] ?? CHAIN_USES[0]!;
}

export async function loadChainForUse(
  use: ChainUse,
  preferHeavy = false,
): Promise<{ group: THREE.Group; def: ChainAssetUse }> {
  const def = getChainDef(use, preferHeavy);
  const group = await loadNoteOfArmsNode(def.nodeName, def.segmentLengthM);
  group.userData.chainUse = use;
  group.userData.segmentLengthM = def.segmentLengthM;
  group.userData.restLengthM = def.segmentLengthM;
  return { group, def };
}

/**
 * Orient + stretch chain so its local +Y spans `from` → `to`.
 * Sets quaternion absolutely (no rotateX accumulation).
 * Non-uniform scale: Y stretches, XZ keep radial thickness.
 */
export function alignChainBetween(
  chainRoot: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  restLengthM?: number,
): void {
  const rest =
    restLengthM ??
    (chainRoot.userData.restLengthM as number) ??
    (chainRoot.userData.segmentLengthM as number) ??
    1;
  const radial = (chainRoot.userData.radialScale as number) ?? 1;

  _dir.subVectors(to, from);
  const len = _dir.length() || 0.001;
  _dir.multiplyScalar(1 / len);

  chainRoot.position.set(
    (from.x + to.x) * 0.5,
    (from.y + to.y) * 0.5,
    (from.z + to.z) * 0.5,
  );

  // Align local +Y with span direction
  _quat.setFromUnitVectors(_yAxis, _dir);
  chainRoot.quaternion.copy(_quat);

  const stretch = len / Math.max(rest, 0.01);
  chainRoot.scale.set(radial, radial * stretch, radial);
}

export async function createHarpoonTrail(
  segmentCount = 8,
  useFine = true,
): Promise<THREE.Group> {
  const def = getChainDef('harpoon_trail', !useFine);
  const trail = new THREE.Group();
  trail.name = 'harpoon_trail';
  trail.userData.segmentLengthM = def.segmentLengthM;
  trail.userData.restLengthM = def.segmentLengthM;
  trail.userData.segments = [] as THREE.Object3D[];

  // Load one template then clone segments (same scale rest length)
  const first = await loadNoteOfArmsNode(def.nodeName, def.segmentLengthM);
  trail.add(first);
  (trail.userData.segments as THREE.Object3D[]).push(first);
  for (let i = 1; i < segmentCount; i++) {
    const seg = first.clone(true);
    seg.userData.restLengthM = def.segmentLengthM;
    seg.userData.radialScale = 1;
    trail.add(seg);
    (trail.userData.segments as THREE.Object3D[]).push(seg);
  }
  return trail;
}

export function updateHarpoonTrail(
  trail: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const segs = trail.userData.segments as THREE.Object3D[] | undefined;
  if (!segs?.length) return;
  const rest = (trail.userData.restLengthM as number) || 0.7;
  const n = segs.length;
  const span = from.distanceTo(to);
  // Sag proportional to span (metres)
  const sagAmp = Math.min(2.5, span * 0.08);

  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const midT = (t0 + t1) * 0.5;
    const sag = Math.sin(Math.PI * midT) * sagAmp;
    const a = new THREE.Vector3().lerpVectors(from, to, t0);
    const b = new THREE.Vector3().lerpVectors(from, to, t1);
    a.y -= sag;
    b.y -= sag;
    alignChainBetween(segs[i]!, a, b, rest);
  }
}

export async function createAnchorChain(heavy = false): Promise<THREE.Group> {
  const { group, def } = await loadChainForUse('anchor', heavy);
  group.name = 'ship_anchor_chain';
  group.userData.segmentLengthM = def.segmentLengthM;
  group.userData.restLengthM = def.segmentLengthM;
  return group;
}

export function updateAnchorChain(
  chain: THREE.Object3D,
  shipPoint: THREE.Vector3,
  seabedPoint: THREE.Vector3,
): void {
  const rest =
    (chain.userData.restLengthM as number) ||
    (chain.userData.segmentLengthM as number) ||
    1.5;
  alignChainBetween(chain, shipPoint, seabedPoint, rest);
}

export async function preloadNoteOfArms(): Promise<void> {
  await loadPackRoot();
}
