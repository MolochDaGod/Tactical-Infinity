import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const texLoader = new THREE.TextureLoader();

type LoadedAsset = THREE.Group | null;

const modelCache = new Map<string, THREE.Group>();
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(url: string): THREE.Texture {
  if (textureCache.has(url)) return textureCache.get(url)!;
  const tex = texLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(url, tex);
  return tex;
}

async function loadGLTF(url: string, scale: number): Promise<THREE.Group> {
  if (modelCache.has(url)) {
    return modelCache.get(url)!.clone();
  }
  try {
    const gltf = await gltfLoader.loadAsync(url);
    const model = gltf.scene;
    model.scale.setScalar(scale);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    modelCache.set(url, model.clone());
    return model;
  } catch (e) {
    console.warn(`[IslandAssets] Failed to load glTF: ${url}`, e);
    return new THREE.Group();
  }
}

async function loadFBX(url: string, scale: number, textureUrl?: string): Promise<THREE.Group> {
  const cacheKey = `${url}__${textureUrl || ''}`;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!.clone();
  }
  try {
    const fbx = await fbxLoader.loadAsync(url);
    const group = new THREE.Group();
    group.add(fbx);
    fbx.scale.setScalar(scale);
    if (textureUrl) {
      const tex = loadTexture(textureUrl);
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            map: tex, roughness: 0.85, metalness: 0.05
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    } else {
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
    modelCache.set(cacheKey, group.clone());
    return group;
  } catch (e) {
    console.warn(`[IslandAssets] Failed to load FBX: ${url}`, e);
    return new THREE.Group();
  }
}

export interface IslandAssetConfig {
  url: string;
  type: 'gltf' | 'fbx';
  scale: number;
  textureUrl?: string;
}

export const NATURE_TREES: Record<string, IslandAssetConfig> = {
  common_1: { url: '/models/nature/CommonTree_1.gltf', type: 'gltf', scale: 1.8 },
  common_2: { url: '/models/nature/CommonTree_2.gltf', type: 'gltf', scale: 1.8 },
  common_3: { url: '/models/nature/CommonTree_3.gltf', type: 'gltf', scale: 1.8 },
  pine_1:   { url: '/models/nature/Pine_1.gltf', type: 'gltf', scale: 1.8 },
  pine_2:   { url: '/models/nature/Pine_2.gltf', type: 'gltf', scale: 1.8 },
  pine_3:   { url: '/models/nature/Pine_3.gltf', type: 'gltf', scale: 1.8 },
  twisted_1:{ url: '/models/nature/TwistedTree_1.gltf', type: 'gltf', scale: 1.6 },
  twisted_2:{ url: '/models/nature/TwistedTree_2.gltf', type: 'gltf', scale: 1.6 },
  dead_1:   { url: '/models/nature/DeadTree_1.gltf', type: 'gltf', scale: 1.5 },
};

export const NATURE_PLANTS: Record<string, IslandAssetConfig> = {
  bush:         { url: '/models/nature/Bush_Common.gltf', type: 'gltf', scale: 1.2 },
  bush_flowers: { url: '/models/nature/Bush_Common_Flowers.gltf', type: 'gltf', scale: 1.2 },
  fern:         { url: '/models/nature/Fern_1.gltf', type: 'gltf', scale: 1.0 },
  plant_1:      { url: '/models/nature/Plant_1.gltf', type: 'gltf', scale: 1.0 },
  clover:       { url: '/models/nature/Clover_1.gltf', type: 'gltf', scale: 1.0 },
  grass_short:  { url: '/models/nature/Grass_Common_Short.gltf', type: 'gltf', scale: 1.0 },
  grass_tall:   { url: '/models/nature/Grass_Common_Tall.gltf', type: 'gltf', scale: 1.0 },
  mushroom:     { url: '/models/nature/Mushroom_Common.gltf', type: 'gltf', scale: 1.2 },
  // New high-detail CC0 plant scans (sized via metric normalization at scatter).
  hemp:         { url: '/models/nature/plants/hemp.glb', type: 'gltf', scale: 1.0 },
  periwinkle:   { url: '/models/nature/plants/periwinkle/periwinkle_plant_2k.gltf', type: 'gltf', scale: 1.0 },
  celandine:    { url: '/models/nature/plants/celandine/celandine_01_2k.gltf', type: 'gltf', scale: 1.0 },
};

export const NATURE_FLOWERS: Record<string, IslandAssetConfig> = {
  flower_3_group:  { url: '/models/nature/Flower_3_Group.gltf', type: 'gltf', scale: 1.3 },
  flower_3_single: { url: '/models/nature/Flower_3_Single.gltf', type: 'gltf', scale: 1.3 },
  flower_4_group:  { url: '/models/nature/Flower_4_Group.gltf', type: 'gltf', scale: 1.3 },
  flower_4_single: { url: '/models/nature/Flower_4_Single.gltf', type: 'gltf', scale: 1.3 },
};

export const NATURE_ROCKS: Record<string, IslandAssetConfig> = {
  rock_1: { url: '/models/nature/Rock_Medium_1.gltf', type: 'gltf', scale: 2.0 },
  rock_2: { url: '/models/nature/Rock_Medium_2.gltf', type: 'gltf', scale: 2.0 },
  rock_3: { url: '/models/nature/Rock_Medium_3.gltf', type: 'gltf', scale: 2.0 },
  // New CC0 rock scans — sized via metric normalization at scatter time.
  cliff_rock:   { url: '/models/nature/new/cliff_rock.glb',   type: 'gltf', scale: 1.0 },
  boulder_rock: { url: '/models/nature/new/boulder_rock.glb', type: 'gltf', scale: 1.0 },
};

/**
 * Mineable-node source meshes. `crystal` is the multi-crystal cluster scan
 * (used for gem/mythril/gold veins); `boulder` is a chunky rock (used for
 * stone/iron/copper). Both are metric-normalized per node by HarvestNodeSystem.
 */
export const HARVEST_ASSETS: Record<'crystal' | 'boulder', IslandAssetConfig> = {
  crystal: { url: '/models/nature/new/ore_and_crystals.glb', type: 'gltf', scale: 1.0 },
  boulder: { url: '/models/nature/new/boulder_rock.glb',     type: 'gltf', scale: 1.0 },
};

export const ANIMALS: Record<string, IslandAssetConfig> = {
  boar:   { url: '/models/animals/boar.fbx',   type: 'fbx', scale: 0.012, textureUrl: '/textures/nature/wild_animals_map.png' },
  deer:   { url: '/models/animals/deer_1.fbx', type: 'fbx', scale: 0.012, textureUrl: '/textures/nature/wild_animals_map.png' },
  rabbit: { url: '/models/animals/rabbit.fbx', type: 'fbx', scale: 0.008, textureUrl: '/textures/nature/wild_animals_map.png' },
  fox:    { url: '/models/animals/fox.fbx',    type: 'fbx', scale: 0.010, textureUrl: '/textures/nature/wild_animals_map.png' },
  bear:   { url: '/models/animals/bear.fbx',   type: 'fbx', scale: 0.010, textureUrl: '/textures/nature/wild_animals_map.png' },
  wolf:   { url: '/models/animals/wolf.fbx',   type: 'fbx', scale: 0.010, textureUrl: '/textures/nature/wild_animals_map.png' },
};

export const MOUNTAINS: Record<string, IslandAssetConfig> = {
  hill_1:     { url: '/models/mountains/Hill_temperate_climate_001.fbx',     type: 'fbx', scale: 0.06, textureUrl: '/textures/terrain/T_Mountains_temperate_climate_32.png' },
  hill_2:     { url: '/models/mountains/Hill_temperate_climate_002.fbx',     type: 'fbx', scale: 0.06, textureUrl: '/textures/terrain/T_Mountains_temperate_climate_32.png' },
  mountain_1: { url: '/models/mountains/Mountains_temperate_climate_001.fbx', type: 'fbx', scale: 0.04, textureUrl: '/textures/terrain/T_Mountains_temperate_climate_32.png' },
};

export const ORE_TEXTURES = {
  stone: {
    baseColor: '/textures/ore/stone_baseColor.png',
    metallicRoughness: '/textures/ore/stone_metallicRoughness.png',
  },
  iron: {
    baseColor: '/textures/ore/iron_baseColor.png',
    metallicRoughness: '/textures/ore/iron_metallicRoughness.png',
  },
  copper: {
    baseColor: '/textures/ore/copper_baseColor.png',
  },
  gold: {
    baseColor: '/textures/ore/gold_baseColor.png',
  },
  overgrown: {
    baseColor: '/textures/ore/overgrown_baseColor.jpg',
    normal: '/textures/ore/overgrown_normal.jpg',
    metallicRoughness: '/textures/ore/overgrown_metallicRoughness.png',
  },
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomAsset(catalog: Record<string, IslandAssetConfig>): IslandAssetConfig {
  const keys = Object.keys(catalog);
  return catalog[keys[Math.floor(Math.random() * keys.length)]];
}

export async function loadAsset(config: IslandAssetConfig | undefined | null): Promise<THREE.Group> {
  // Defensive: a missing catalog entry (e.g. a species key with no config)
  // must degrade to an empty group, never crash the whole scatter pass.
  if (!config || !config.url) {
    console.warn('[IslandAssets] loadAsset called with missing config — skipping');
    return new THREE.Group();
  }
  if (config.type === 'gltf') {
    return loadGLTF(config.url, config.scale);
  }
  return loadFBX(config.url, config.scale, config.textureUrl);
}

export async function loadRandomTree(nodeType: string): Promise<THREE.Group> {
  const isPine = nodeType.includes('pine');
  const catalog = isPine
    ? [NATURE_TREES.pine_1, NATURE_TREES.pine_2, NATURE_TREES.pine_3]
    : [NATURE_TREES.common_1, NATURE_TREES.common_2, NATURE_TREES.common_3, NATURE_TREES.twisted_1];
  return loadAsset(pickRandom(catalog));
}

export async function loadRandomFlower(): Promise<THREE.Group> {
  return loadAsset(pickRandomAsset(NATURE_FLOWERS));
}

export async function loadRandomPlant(): Promise<THREE.Group> {
  const picks = [NATURE_PLANTS.fern, NATURE_PLANTS.plant_1, NATURE_PLANTS.bush, NATURE_PLANTS.clover];
  return loadAsset(pickRandom(picks));
}

export async function loadRandomRock(): Promise<THREE.Group> {
  return loadAsset(pickRandomAsset(NATURE_ROCKS));
}

export async function loadAnimal(animalType: string): Promise<THREE.Group> {
  const key = animalType.includes('boar') ? 'boar'
    : animalType.includes('deer') ? 'deer'
    : animalType.includes('rabbit') ? 'rabbit'
    : animalType.includes('fox') ? 'fox'
    : animalType.includes('bear') ? 'bear'
    : 'wolf';
  const config = ANIMALS[key] || ANIMALS.boar;
  return loadAsset(config);
}

export function createTexturedOreMesh(
  oreType: string,
  scale: number
): THREE.Group {
  const group = new THREE.Group();

  let texConfig: { baseColor: string; metallicRoughness?: string; normal?: string };
  let oreColor = 0x808080;
  let emissiveColor = 0x000000;
  let metalness = 0.1;

  if (oreType.includes('iron')) {
    texConfig = ORE_TEXTURES.iron;
    oreColor = 0x606878;
    emissiveColor = 0x1a1a2a;
    metalness = 0.5;
  } else if (oreType.includes('copper')) {
    texConfig = ORE_TEXTURES.copper;
    oreColor = 0xb87333;
    emissiveColor = 0x2a1508;
    metalness = 0.6;
  } else if (oreType.includes('gold')) {
    texConfig = ORE_TEXTURES.gold;
    oreColor = 0xffd700;
    emissiveColor = 0x332a00;
    metalness = 0.7;
  } else if (oreType.includes('mythril')) {
    texConfig = ORE_TEXTURES.stone;
    oreColor = 0x64b5f6;
    emissiveColor = 0x102840;
    metalness = 0.8;
  } else {
    texConfig = ORE_TEXTURES.stone;
  }

  const baseTex = loadTexture(texConfig.baseColor);
  baseTex.repeat.set(2, 2);
  const baseMat = new THREE.MeshStandardMaterial({
    map: baseTex,
    color: 0x555555,
    roughness: 0.85,
    metalness: 0.05,
  });

  const baseGeo = new THREE.DodecahedronGeometry(scale * 0.55, 1);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = scale * 0.25;
  base.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const veinCount = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < veinCount; i++) {
    const h = scale * (0.2 + Math.random() * 0.4);
    const r = scale * (0.05 + Math.random() * 0.06);
    const geo = new THREE.ConeGeometry(r, h, 5);
    const mat = new THREE.MeshStandardMaterial({
      color: oreColor,
      roughness: 0.2,
      metalness: metalness,
      emissive: emissiveColor,
      emissiveIntensity: 0.25,
    });
    const crystal = new THREE.Mesh(geo, mat);
    const ang = (i / veinCount) * Math.PI * 2 + Math.random() * 0.8;
    const dist = scale * (0.15 + Math.random() * 0.15);
    crystal.position.set(
      Math.cos(ang) * dist,
      scale * 0.35 + Math.random() * scale * 0.2,
      Math.sin(ang) * dist
    );
    crystal.rotation.set(
      (Math.random() - 0.5) * 0.6,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.6
    );
    crystal.castShadow = true;
    group.add(crystal);
  }

  group.userData = { isResourceNode: true, resourceType: oreType };
  return group;
}

export function createTexturedRockMesh(scale: number): THREE.Group {
  const group = new THREE.Group();
  const tex = loadTexture(ORE_TEXTURES.overgrown.baseColor);
  tex.repeat.set(1.5, 1.5);
  const normalTex = loadTexture(ORE_TEXTURES.overgrown.normal);
  normalTex.repeat.set(1.5, 1.5);

  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const sz = scale * (0.4 + Math.random() * 0.3);
    const geo = new THREE.DodecahedronGeometry(sz, 2);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      normalMap: normalTex,
      roughness: 0.9,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * scale * 0.3,
      sz * 0.3,
      (Math.random() - 0.5) * scale * 0.3
    );
    mesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData = { isResourceNode: true, resourceType: 'stone' };
  return group;
}

let _preloaded = false;
export async function preloadIslandAssets(): Promise<void> {
  if (_preloaded) return;
  _preloaded = true;

  const loads: Promise<THREE.Group>[] = [
    loadAsset(NATURE_TREES.common_1),
    loadAsset(NATURE_TREES.pine_1),
    loadAsset(NATURE_ROCKS.rock_1),
    loadAsset(NATURE_FLOWERS.flower_3_group),
    loadAsset(NATURE_PLANTS.fern),
    loadAsset(NATURE_PLANTS.bush_flowers),
  ];

  try {
    await Promise.allSettled(loads);
    console.log('[IslandAssets] Core models preloaded');
  } catch (e) {
    console.warn('[IslandAssets] Some models failed to preload', e);
  }
}

export function createCannonFlashTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 200, 80, 0.9)');
  gradient.addColorStop(0.5, 'rgba(255, 120, 20, 0.5)');
  gradient.addColorStop(0.8, 'rgba(180, 60, 10, 0.2)');
  gradient.addColorStop(1, 'rgba(100, 30, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createExplosionTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 220, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 220, 100, 0.95)');
  gradient.addColorStop(0.3, 'rgba(255, 160, 40, 0.8)');
  gradient.addColorStop(0.5, 'rgba(220, 80, 10, 0.5)');
  gradient.addColorStop(0.7, 'rgba(120, 40, 5, 0.25)');
  gradient.addColorStop(0.85, 'rgba(60, 20, 5, 0.1)');
  gradient.addColorStop(1, 'rgba(30, 10, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 6;
    const dist = Math.sqrt((x - size / 2) ** 2 + (y - size / 2) ** 2) / (size / 2);
    if (dist < 0.85) {
      const alpha = (1 - dist) * 0.4;
      ctx.fillStyle = `rgba(255, 200, 60, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createSmokeTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(80, 80, 80, 0.6)');
  gradient.addColorStop(0.4, 'rgba(60, 60, 60, 0.3)');
  gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.1)');
  gradient.addColorStop(1, 'rgba(20, 20, 20, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
