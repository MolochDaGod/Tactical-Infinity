import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';
import {
  STYLIZED,
  STYLIZED_VARIANTS,
} from '@/lib/warlordsNatureCDN';

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const texLoader = new THREE.TextureLoader();

/** Full pack scenes (uncloned root) for mesh isolation. */
const packSceneCache = new Map<string, THREE.Group>();
const modelCache = new Map<string, THREE.Group>();
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(url: string): THREE.Texture {
  const resolved = resolveGrudgeAssetUrl(url);
  if (textureCache.has(resolved)) return textureCache.get(resolved)!;
  const tex = texLoader.load(resolved);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(resolved, tex);
  return tex;
}

function resolveAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return resolveGrudgeAssetUrl(url);
}

async function loadPackScene(url: string): Promise<THREE.Group | null> {
  const resolved = resolveAssetUrl(url);
  if (packSceneCache.has(resolved)) return packSceneCache.get(resolved)!;
  try {
    const gltf = await gltfLoader.loadAsync(resolved);
    const root = gltf.scene as THREE.Group;
    packSceneCache.set(resolved, root);
    return root;
  } catch (e) {
    console.warn(`[IslandAssets] Failed to load pack: ${resolved}`, e);
    return null;
  }
}

/**
 * Isolate one named mesh (or first Mesh) from a multi-mesh Warlords pack.
 * Never returns the whole pack scene.
 *
 * Do NOT force a max-dimension target here. Flat flowers have huge XZ and
 * tiny Y — max-dim normalize + later height normalize balloons them past
 * the player. `metricSizing` owns real-world metres (trees 8–18 m, doors 2.75 m).
 */
export async function loadIsolatedMesh(
  packUrl: string,
  meshNames: readonly string[],
  scale = 1,
): Promise<THREE.Group> {
  const scene = await loadPackScene(packUrl);
  const out = new THREE.Group();
  if (!scene) return out;

  const want = meshNames[Math.floor(Math.random() * Math.max(1, meshNames.length))];
  let source: THREE.Object3D | null = null;
  // Prefer Mesh hits so we don't grab a multi-prop parent group.
  if (want) {
    scene.traverse((o) => {
      if (source) return;
      if (!(o as THREE.Mesh).isMesh) return;
      if (o.name === want || o.name.includes(want)) source = o;
    });
    if (!source) {
      scene.traverse((o) => {
        if (source) return;
        if (o.name === want || o.name.includes(want)) source = o;
      });
    }
  }
  if (!source) {
    scene.traverse((o) => {
      if (source) return;
      if ((o as THREE.Mesh).isMesh) source = o;
    });
  }
  if (!source) return out;

  const cloned = source.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);
  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    }
  });

  if (scale !== 1) cloned.scale.multiplyScalar(scale);

  const box2 = new THREE.Box3().setFromObject(cloned);
  if (isFinite(box2.min.y)) cloned.position.y = -box2.min.y;
  out.add(cloned);
  out.userData.meshName = (source as THREE.Object3D).name;
  out.userData.packUrl = packUrl;
  return out;
}

async function loadGLTF(url: string, scale: number): Promise<THREE.Group> {
  // Warlords packs → isolate one mesh; never clone whole multi-mesh root into world.
  const isPack =
    /nature\/stylized|example_home_island|nature_vegetation|tropical_plants|stylised_rocks|rocks_and_foliage_woods|flowers_pack|ore_nodes|minerals_pack|foliage_pack|plants_asset_set|stylised_redwood|islands_pack|chicken_gun_islands|florida_foliage|plant_generation_only_leaves|alien_plants|nature_pack_vol1|gameready_ivy|asiatic_lily/i.test(
      url,
    );
  if (isPack) {
    let names: readonly string[] = STYLIZED_VARIANTS.vegetationTrees;
    if (/pine|snow/i.test(url)) names = STYLIZED_VARIANTS.vegetationPines;
    if (/tropical_plants/i.test(url)) names = STYLIZED_VARIANTS.tropicalPalms;
    if (/stylised_redwood|redwood/i.test(url)) names = STYLIZED_VARIANTS.redwoodWoods;
    if (/plants_asset_set/i.test(url)) names = STYLIZED_VARIANTS.greenPlants;
    if (/florida_foliage/i.test(url)) names = STYLIZED_VARIANTS.floridaFoliage;
    if (/plant_generation_only_leaves/i.test(url)) names = STYLIZED_VARIANTS.leafRegrow;
    if (/alien_plants/i.test(url)) names = STYLIZED_VARIANTS.alienPlants;
    if (/nature_pack_vol1|stylized_nature_pack_vol1/i.test(url)) names = STYLIZED_VARIANTS.natureVol1Trees;
    if (/gameready_ivy/i.test(url)) names = STYLIZED_VARIANTS.gamereadyIvyCurves;
    if (/asiatic_lily/i.test(url)) names = STYLIZED_VARIANTS.asiaticLily;
    if (/islands_pack/i.test(url)) names = STYLIZED_VARIANTS.islandsPackMeshes;
    if (/chicken_gun_islands/i.test(url)) {
      names = [
        ...STYLIZED_VARIANTS.chickenGunIslandMeshes,
        ...STYLIZED_VARIANTS.chickenGunPalms,
      ];
    }
    if (/rocks_and_foliage_woods/i.test(url)) {
      names = [...STYLIZED_VARIANTS.woodsRocks, ...STYLIZED_VARIANTS.woodsFoliage];
    } else if (/stylised_rocks/i.test(url)) {
      names = [
        ...STYLIZED_VARIANTS.stylizedRocks,
        ...STYLIZED_VARIANTS.mossyRocks,
      ];
    } else if (/rock|example_home/i.test(url) && !/redwood/i.test(url)) {
      names = STYLIZED_VARIANTS.stylizedRocks;
    }
    if (/flower/i.test(url) && !/woods/i.test(url)) names = STYLIZED_VARIANTS.flowers;
    if (/foliage_pack/i.test(url)) names = STYLIZED_VARIANTS.foliage;
    if (/ore/i.test(url)) names = STYLIZED_VARIANTS.oreNodes;
    if (/mineral/i.test(url)) names = STYLIZED_VARIANTS.minerals;
    if (/example_home/i.test(url)) names = STYLIZED_VARIANTS.exampleTrees;
    return loadIsolatedMesh(url, names, scale);
  }

  const resolved = resolveAssetUrl(url);
  if (modelCache.has(resolved)) {
    return modelCache.get(resolved)!.clone();
  }
  try {
    const gltf = await gltfLoader.loadAsync(resolved);
    const model = gltf.scene;
    model.scale.setScalar(scale);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    modelCache.set(resolved, model.clone());
    return model;
  } catch (e) {
    console.warn(`[IslandAssets] Failed to load glTF: ${resolved}`, e);
    return new THREE.Group();
  }
}

async function loadFBX(url: string, scale: number, textureUrl?: string): Promise<THREE.Group> {
  const resolved = resolveGrudgeAssetUrl(url);
  const resolvedTex = textureUrl ? resolveGrudgeAssetUrl(textureUrl) : undefined;
  const cacheKey = `${resolved}__${resolvedTex || ''}`;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!.clone();
  }
  try {
    const fbx = await fbxLoader.loadAsync(resolved);
    const group = new THREE.Group();
    group.add(fbx);
    fbx.scale.setScalar(scale);
    if (resolvedTex) {
      const tex = loadTexture(resolvedTex);
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
    console.warn(`[IslandAssets] Failed to load FBX: ${resolved}`, e);
    return new THREE.Group();
  }
}

export interface IslandAssetConfig {
  url: string;
  type: 'gltf' | 'fbx';
  scale: number;
  textureUrl?: string;
}

/**
 * Warlords CDN stylized packs (absolute). Paths go through resolve only if relative.
 * Placement always isolates one meshName — see loadIsolatedMesh.
 */
export const NATURE_TREES: Record<string, IslandAssetConfig> = {
  common_1: { url: STYLIZED.vegetation, type: 'gltf', scale: 1.0 },
  common_2: { url: STYLIZED.vegetation, type: 'gltf', scale: 1.0 },
  common_3: { url: STYLIZED.plainsTrees, type: 'gltf', scale: 1.0 },
  pine_1:   { url: STYLIZED.vegetation, type: 'gltf', scale: 1.0 },
  pine_2:   { url: STYLIZED.snow, type: 'gltf', scale: 1.0 },
  pine_3:   { url: STYLIZED.vegetation, type: 'gltf', scale: 1.0 },
  twisted_1:{ url: STYLIZED.exampleIsland, type: 'gltf', scale: 1.0 },
  twisted_2:{ url: STYLIZED.exampleIsland, type: 'gltf', scale: 1.0 },
  dead_1:   { url: STYLIZED.exampleIsland, type: 'gltf', scale: 1.0 },
  palm:     { url: STYLIZED.tropical, type: 'gltf', scale: 1.0 },
};

export const NATURE_PLANTS: Record<string, IslandAssetConfig> = {
  bush:         { url: STYLIZED.vegetation, type: 'gltf', scale: 1.0 },
  bush_flowers: { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  fern:         { url: STYLIZED.tropical, type: 'gltf', scale: 1.0 },
  plant_1:      { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  clover:       { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  grass_short:  { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  grass_tall:   { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  mushroom:     { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  hemp:         { url: STYLIZED.foliage, type: 'gltf', scale: 1.0 },
  periwinkle:   { url: STYLIZED.flowers, type: 'gltf', scale: 1.0 },
  celandine:    { url: STYLIZED.flowers, type: 'gltf', scale: 1.0 },
};

export const NATURE_FLOWERS: Record<string, IslandAssetConfig> = {
  flower_3_group:  { url: STYLIZED.flowers, type: 'gltf', scale: 1.0 },
  flower_3_single: { url: STYLIZED.flowers, type: 'gltf', scale: 1.0 },
  flower_4_group:  { url: STYLIZED.flowers, type: 'gltf', scale: 1.0 },
  flower_4_single: { url: STYLIZED.flowers, type: 'gltf', scale: 1.0 },
};

export const NATURE_ROCKS: Record<string, IslandAssetConfig> = {
  rock_1: { url: STYLIZED.rocks, type: 'gltf', scale: 1.0 },
  rock_2: { url: STYLIZED.rocks, type: 'gltf', scale: 1.0 },
  rock_3: { url: STYLIZED.exampleIsland, type: 'gltf', scale: 1.0 },
  cliff_rock:   { url: STYLIZED.rocks, type: 'gltf', scale: 1.0 },
  boulder_rock: { url: STYLIZED.rocks, type: 'gltf', scale: 1.0 },
};

/** Mineable nodes from canonical ore/mineral packs. */
export const HARVEST_ASSETS: Record<'crystal' | 'boulder', IslandAssetConfig> = {
  crystal: { url: STYLIZED.minerals, type: 'gltf', scale: 1.0 },
  boulder: { url: STYLIZED.oreNodes, type: 'gltf', scale: 1.0 },
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
  if (isPine) {
    return loadIsolatedMesh(STYLIZED.vegetation, STYLIZED_VARIANTS.vegetationPines, 1.1);
  }
  // Mix vegetation + example home-island tree variants (Warlords home island contract).
  const pack = Math.random() < 0.35 ? STYLIZED.exampleIsland : STYLIZED.vegetation;
  const names =
    pack === STYLIZED.exampleIsland
      ? STYLIZED_VARIANTS.exampleTrees
      : STYLIZED_VARIANTS.vegetationTrees;
  return loadIsolatedMesh(pack, names, 1.0);
}

export async function loadRandomFlower(): Promise<THREE.Group> {
  return loadIsolatedMesh(STYLIZED.flowers, STYLIZED_VARIANTS.flowers, 0.45);
}

export async function loadRandomPlant(): Promise<THREE.Group> {
  if (Math.random() < 0.4) {
    return loadIsolatedMesh(STYLIZED.tropical, STYLIZED_VARIANTS.tropicalPlants, 0.7);
  }
  return loadIsolatedMesh(STYLIZED.foliage, STYLIZED_VARIANTS.foliage, 0.55);
}

export async function loadRandomRock(): Promise<THREE.Group> {
  const pack = Math.random() < 0.25 ? STYLIZED.exampleIsland : STYLIZED.rocks;
  const names =
    pack === STYLIZED.exampleIsland
      ? STYLIZED_VARIANTS.exampleRocks
      : STYLIZED_VARIANTS.stylizedRocks;
  return loadIsolatedMesh(pack, names, 0.9);
}

/** Canonical ore / mineral harvest mesh from D1/CDN packs (not primitives). */
export async function loadRandomOre(nodeType: string): Promise<THREE.Group> {
  const isGem = /gold|mythril|crystal|gem/i.test(nodeType);
  if (isGem) {
    return loadIsolatedMesh(STYLIZED.minerals, STYLIZED_VARIANTS.minerals, 0.6);
  }
  return loadIsolatedMesh(STYLIZED.oreNodes, STYLIZED_VARIANTS.oreNodes, 0.75);
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

  // Best-effort: index D1 asset_registry so loaders know what's seeded
  try {
    const { hydrateWarlordsFromD1, getWarlordsCatalogSnapshot, auditCatalogVsD1 } =
      await import('./warlordsAssetDb');
    await hydrateWarlordsFromD1(2);
    const snap = getWarlordsCatalogSnapshot();
    const audit = auditCatalogVsD1();
    console.log(
      `[IslandAssets] Warlords catalog n=${snap.count} D1-indexed=${snap.d1Indexed} missingFromD1=${audit.missing.length}`,
    );
  } catch (e) {
    console.warn('[IslandAssets] D1 hydrate skipped', e);
  }

  const loads: Promise<THREE.Group>[] = [
    loadIsolatedMesh(STYLIZED.vegetation, STYLIZED_VARIANTS.vegetationTrees, 1),
    loadIsolatedMesh(STYLIZED.rocks, STYLIZED_VARIANTS.stylizedRocks, 1),
    loadIsolatedMesh(STYLIZED.flowers, STYLIZED_VARIANTS.flowers, 0.5),
    loadIsolatedMesh(STYLIZED.oreNodes, STYLIZED_VARIANTS.oreNodes, 0.7),
    loadIsolatedMesh(STYLIZED.exampleIsland, STYLIZED_VARIANTS.exampleTrees, 1),
  ];

  try {
    await Promise.allSettled(loads);
    console.log('[IslandAssets] Warlords CDN packs preloaded (isolated meshes)');
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
