/**
 * Shared editor material families for water lab editors
 * (dock-workshop, fleet-assets, ship-editor, island-editor).
 * PBR params + optional albedo from existing /textures/terrain.
 */

import * as THREE from 'three';

export type EditorMaterialFamilyId =
  | 'cloth'
  | 'canvas'
  | 'leather'
  | 'metal'
  | 'magic'
  | 'water'
  | 'brick'
  | 'stone'
  | 'wood'
  | 'oak'
  | 'teak'
  | 'rope';

export type EditorMapKind = 'none' | 'wood' | 'cloth' | 'leather' | 'brick' | 'stone' | 'water';

export interface EditorMaterialFamily {
  id: EditorMaterialFamilyId;
  label: string;
  color: number;
  roughness: number;
  metalness: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
  doubleSide?: boolean;
  sheen?: number;
  mapKind: EditorMapKind;
  albedoPath?: string;
}

export const EDITOR_MATERIAL_FAMILIES: EditorMaterialFamily[] = [
  {
    id: 'cloth',
    label: 'Cloth',
    color: 0xd4c4a0,
    roughness: 0.88,
    metalness: 0,
    doubleSide: true,
    sheen: 0.45,
    mapKind: 'cloth',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    color: 0xe8dcc4,
    roughness: 0.82,
    metalness: 0,
    doubleSide: true,
    mapKind: 'cloth',
  },
  {
    id: 'leather',
    label: 'Leather',
    color: 0x5c3317,
    roughness: 0.72,
    metalness: 0,
    mapKind: 'leather',
  },
  {
    id: 'metal',
    label: 'Metal',
    color: 0x8a9199,
    roughness: 0.28,
    metalness: 0.92,
    mapKind: 'none',
  },
  {
    id: 'magic',
    label: 'Magic',
    color: 0x6a48d4,
    roughness: 0.32,
    metalness: 0.18,
    emissive: 0x3a18aa,
    emissiveIntensity: 0.55,
    mapKind: 'none',
  },
  {
    id: 'water',
    label: 'Water',
    color: 0x2a7a96,
    roughness: 0.08,
    metalness: 0.04,
    transparent: true,
    opacity: 0.72,
    transmission: 0.55,
    mapKind: 'water',
  },
  {
    id: 'brick',
    label: 'Brick',
    color: 0x9a5644,
    roughness: 0.92,
    metalness: 0,
    mapKind: 'brick',
    albedoPath: '/textures/terrain/stone_albedo.jpg',
  },
  {
    id: 'stone',
    label: 'Stone',
    color: 0x8a8680,
    roughness: 0.9,
    metalness: 0,
    mapKind: 'stone',
    albedoPath: '/textures/terrain/stone_albedo.jpg',
  },
  {
    id: 'wood',
    label: 'Wood',
    color: 0xc4a574,
    roughness: 0.88,
    metalness: 0,
    mapKind: 'wood',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
  },
  {
    id: 'oak',
    label: 'Oak',
    color: 0x8b5a2b,
    roughness: 0.86,
    metalness: 0,
    mapKind: 'wood',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
  },
  {
    id: 'teak',
    label: 'Teak',
    color: 0x6b3a1a,
    roughness: 0.8,
    metalness: 0,
    mapKind: 'wood',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
  },
  {
    id: 'rope',
    label: 'Rope',
    color: 0x9a7b4a,
    roughness: 0.95,
    metalness: 0,
    mapKind: 'cloth',
  },
];

export function getMaterialFamily(id: string): EditorMaterialFamily | undefined {
  return EDITOR_MATERIAL_FAMILIES.find((f) => f.id === id);
}

const loader = new THREE.TextureLoader();
const fileCache = new Map<string, THREE.Texture>();
const procCache = new Map<string, THREE.CanvasTexture>();

function stampTex(tex: THREE.Texture, repeat = 2): THREE.Texture {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeProc(kind: EditorMapKind): THREE.CanvasTexture {
  const hit = procCache.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  if (kind === 'wood') {
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 13) {
      ctx.fillStyle = `rgb(${88 + (y % 22)}, ${52 + (y % 14)}, ${26 + (y % 8)})`;
      ctx.fillRect(0, y, 256, 11);
      ctx.strokeStyle = 'rgba(40,22,10,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, y + 11);
      ctx.lineTo(256, y + 11);
      ctx.stroke();
    }
  } else if (kind === 'cloth') {
    ctx.fillStyle = '#d8cbb0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(90,70,40,0.18)';
    for (let i = 0; i < 256; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  } else if (kind === 'leather') {
    ctx.fillStyle = '#5a3014';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = (i * 47) % 256;
      const y = (i * 91) % 256;
      ctx.fillStyle = `rgba(${70 + (i % 40)}, ${35 + (i % 20)}, ${12}, 0.28)`;
      ctx.fillRect(x, y, 3, 2);
    }
  } else if (kind === 'brick') {
    ctx.fillStyle = '#6a3a2c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#9a5644';
    const bh = 28;
    const bw = 56;
    for (let row = 0; row < 12; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 6; col++) {
        ctx.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
  } else if (kind === 'water') {
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#1a5a72');
    g.addColorStop(0.5, '#2a8aaa');
    g.addColorStop(1, '#154858');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(200,240,255,0.15)';
    for (let y = 16; y < 256; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(128, y - 8, 256, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#888480';
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = stampTex(new THREE.CanvasTexture(c), kind === 'brick' ? 3 : 2) as THREE.CanvasTexture;
  procCache.set(kind, tex);
  return tex;
}

export function loadFamilyAlbedo(family: EditorMaterialFamily): Promise<THREE.Texture | null> {
  if (family.mapKind === 'none') return Promise.resolve(null);
  if (family.albedoPath) {
    const cached = fileCache.get(family.albedoPath);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      loader.load(
        family.albedoPath!,
        (tex) => {
          stampTex(tex, family.mapKind === 'brick' || family.mapKind === 'stone' ? 3 : 2);
          fileCache.set(family.albedoPath!, tex);
          resolve(tex);
        },
        undefined,
        () => resolve(makeProc(family.mapKind)),
      );
    });
  }
  return Promise.resolve(makeProc(family.mapKind));
}

export function loadAlbedoFile(file: File): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    loader.load(
      url,
      (tex) => {
        stampTex(tex, 1);
        resolve(tex);
      },
      undefined,
      () => reject(new Error('texture load failed')),
    );
  });
}

export function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) out.push(m);
  });
  return out;
}

export function ensureStandard(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = src.map((mat) => {
    if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
      return mat.clone();
    }
    const std = new THREE.MeshStandardMaterial();
    const anyMat = mat as THREE.MeshLambertMaterial;
    if (anyMat?.color) std.color.copy(anyMat.color);
    if (anyMat && 'map' in anyMat && anyMat.map) std.map = anyMat.map;
    return std;
  });
  mesh.material = next.length === 1 ? next[0] : next;
  return next;
}

export function applyFamilyToObject(root: THREE.Object3D, family: EditorMaterialFamily, map?: THREE.Texture | null): number {
  const meshes = collectMeshes(root);
  for (const mesh of meshes) {
    if (mesh.userData.editorIgnore) continue;
    const mats = ensureStandard(mesh);
    for (const mat of mats) {
      mat.color.setHex(family.color);
      mat.roughness = family.roughness;
      mat.metalness = family.metalness;
      mat.transparent = !!family.transparent;
      mat.opacity = family.opacity ?? 1;
      mat.side = family.doubleSide ? THREE.DoubleSide : THREE.FrontSide;
      if (family.emissive != null) {
        mat.emissive.setHex(family.emissive);
        mat.emissiveIntensity = family.emissiveIntensity ?? 0.4;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
      if (map) {
        mat.map = map;
      } else if (family.mapKind === 'none') {
        mat.map = null;
      }
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.transmission = family.transmission ?? 0;
        if (family.sheen != null) mat.sheen = family.sheen;
      }
      mat.needsUpdate = true;
    }
  }
  return meshes.length;
}

export function tintObject(root: THREE.Object3D, hex: string): void {
  for (const mesh of collectMeshes(root)) {
    for (const mat of ensureStandard(mesh)) {
      mat.color.setStyle(hex);
      mat.needsUpdate = true;
    }
  }
}

export function setObjectPbr(root: THREE.Object3D, opts: { roughness?: number; metalness?: number; repeat?: number }): void {
  for (const mesh of collectMeshes(root)) {
    for (const mat of ensureStandard(mesh)) {
      if (opts.roughness != null) mat.roughness = opts.roughness;
      if (opts.metalness != null) mat.metalness = opts.metalness;
      if (opts.repeat != null && mat.map) {
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
        mat.map.repeat.set(opts.repeat, opts.repeat);
        mat.map.needsUpdate = true;
      }
      mat.needsUpdate = true;
    }
  }
}
