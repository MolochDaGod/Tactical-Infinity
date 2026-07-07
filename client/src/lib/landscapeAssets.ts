import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFluffyTreeGroup, kindFromTreeType } from './vendor/fluffytree';
import { stylizedPacks } from './stylizedPackLoader';
import {
  STYLIZED_ASSETS,
  Biome,
  pickWeighted,
  instantiateStaticAsset,
  pruneDeadStylizedPacks,
} from './stylizedAssetRegistry';

// Map TreeType → biomes those trees naturally fit, so we can pick a
// stylized variant when the existing prop loop asks for type X.
const TREE_TYPE_TO_BIOME: Record<string, Biome> = {
  birch: 'temperate',
  normal: 'temperate',
  pine: 'temperate',
  palm: 'tropical',
  dead: 'volcanic',
};

export type TreeType = 'birch' | 'normal' | 'palm' | 'pine' | 'dead';
export type VegetationType = 'bush' | 'bushFlowers' | 'bushLarge' | 'bushLargeFlowers' | 'bushSmall' | 'bushSmallFlowers' | 'grassLarge' | 'grassSmall' | 'flower1' | 'flower2' | 'flowerClump';
export type RockType = 'rock';

export interface LandscapeTextureSet {
  diffuse: THREE.Texture;
  normal?: THREE.Texture;
}

export interface TreeVariant {
  model: THREE.Group;
  type: TreeType;
  variant: number;
}

const TEXTURE_BASE = '/textures/landscape';
const LANDSCAPE_TEXTURES_BASE = TEXTURE_BASE;
const MODEL_BASE = '/models/landscape_models/glTF';

export const TREE_TEXTURE_PATHS: Record<string, { bark: string; barkNormal?: string; leaves: string }> = {
  birch: {
    bark: `${LANDSCAPE_TEXTURES_BASE}/BirchTree_Bark_1768613834508.png`,
    barkNormal: `${LANDSCAPE_TEXTURES_BASE}/BirchTree_Bark_Normal_1768613834508.png`,
    leaves: `${LANDSCAPE_TEXTURES_BASE}/BirchTree_Leaves_1768613834509.png`,
  },
  normal: {
    bark: `${LANDSCAPE_TEXTURES_BASE}/NormalTree_Bark_1768613834510.png`,
    barkNormal: `${LANDSCAPE_TEXTURES_BASE}/NormalTree_Bark_Normal_1768613834510.png`,
    leaves: `${LANDSCAPE_TEXTURES_BASE}/NormalTree_Leaves_1768613834510.png`,
  },
  palm: {
    bark: `${LANDSCAPE_TEXTURES_BASE}/PalmTree_Trunk_1768613834511.png`,
    barkNormal: `${LANDSCAPE_TEXTURES_BASE}/PalmTree_Trunk_Normal_1768613834511.png`,
    leaves: `${LANDSCAPE_TEXTURES_BASE}/PalmTree_Leaves_1768613834511.png`,
  },
  pine: {
    bark: `${LANDSCAPE_TEXTURES_BASE}/PineTree_Bark_1768613834511.png`,
    barkNormal: `${LANDSCAPE_TEXTURES_BASE}/PineTree_Bark_Normal_1768613834512.png`,
    leaves: `${LANDSCAPE_TEXTURES_BASE}/PineTree_Leaves_1768613834512.png`,
  },
};

export const ENVIRONMENT_TEXTURE_PATHS = {
  grass: `${LANDSCAPE_TEXTURES_BASE}/Grass_1768613834509.png`,
  flowers: `${LANDSCAPE_TEXTURES_BASE}/Flowers_1768613834509.png`,
  rocks: `${LANDSCAPE_TEXTURES_BASE}/Rocks_1768613834512.png`,
  bushLeaves: `${LANDSCAPE_TEXTURES_BASE}/Bush_Leaves_1768613834509.png`,
  leavesBW: `${LANDSCAPE_TEXTURES_BASE}/Leaves_BW_1768613834509.png`,
};

export const TREE_MODEL_VARIANTS: Record<TreeType, string[]> = {
  birch: [
    `${MODEL_BASE}/BirchTree_1.gltf`,
    `${MODEL_BASE}/BirchTree_2.gltf`,
    `${MODEL_BASE}/BirchTree_3.gltf`,
    `${MODEL_BASE}/BirchTree_4.gltf`,
    `${MODEL_BASE}/BirchTree_5.gltf`,
  ],
  normal: [],
  palm: [],
  pine: [],
  dead: [
    `${MODEL_BASE}/DeadTree_1.gltf`,
    `${MODEL_BASE}/DeadTree_2.gltf`,
    `${MODEL_BASE}/DeadTree_3.gltf`,
    `${MODEL_BASE}/DeadTree_4.gltf`,
    `${MODEL_BASE}/DeadTree_5.gltf`,
    `${MODEL_BASE}/DeadTree_6.gltf`,
    `${MODEL_BASE}/DeadTree_7.gltf`,
    `${MODEL_BASE}/DeadTree_8.gltf`,
    `${MODEL_BASE}/DeadTree_9.gltf`,
    `${MODEL_BASE}/DeadTree_10.gltf`,
  ],
};

export function hasModelForTreeType(type: TreeType): boolean {
  const variants = TREE_MODEL_VARIANTS[type];
  return variants && variants.length > 0;
}

export const VEGETATION_MODEL_PATHS: Record<string, string> = {
  bush: `${MODEL_BASE}/Bush.gltf`,
  bushFlowers: `${MODEL_BASE}/Bush_Flowers.gltf`,
  bushLarge: `${MODEL_BASE}/Bush_Large.gltf`,
  bushLargeFlowers: `${MODEL_BASE}/Bush_Large_Flowers.gltf`,
  bushSmall: `${MODEL_BASE}/Bush_Small.gltf`,
  bushSmallFlowers: `${MODEL_BASE}/Bush_Small_Flowers.gltf`,
  grassLarge: `${MODEL_BASE}/Grass_Large.gltf`,
  grassLargeExtruded: `${MODEL_BASE}/Grass_Large_Extruded.gltf`,
  grassSmall: `${MODEL_BASE}/Grass_Small.gltf`,
  flower1: `${MODEL_BASE}/Flower_1.gltf`,
  flower1Clump: `${MODEL_BASE}/Flower_1_Clump.gltf`,
  flower2: `${MODEL_BASE}/Flower_2.gltf`,
  flower2Clump: `${MODEL_BASE}/Flower_2_Clump.gltf`,
  flower3Clump: `${MODEL_BASE}/Flower_3_Clump.gltf`,
  flower4Clump: `${MODEL_BASE}/Flower_4_Clump.gltf`,
  flower5Clump: `${MODEL_BASE}/Flower_5_Clump.gltf`,
};

export class LandscapeAssetManager {
  private static instance: LandscapeAssetManager | null = null;
  
  private textureLoader: THREE.TextureLoader;
  private gltfLoader: GLTFLoader;
  
  private textureCache: Map<string, THREE.Texture> = new Map();
  private modelCache: Map<string, THREE.Group> = new Map();
  
  private loadingPromises: Map<string, Promise<THREE.Texture | THREE.Group>> = new Map();
  private isPreloaded = false;
  /** URLs that 404'd or served the SPA index.html — never retry. */
  private knownDead: Set<string> = new Set();

  private async isAssetReachable(path: string): Promise<boolean> {
    if (this.knownDead.has(path)) return false;
    try {
      const res = await fetch(path, { method: 'HEAD' });
      const ct = res.headers.get('content-type') || '';
      const ok = res.ok && !ct.includes('text/html');
      if (!ok) {
        // Mark dead silently — preloadAllAssets emits a single aggregate
        // summary once every asset has been probed, so logging per-path
        // here would flood the console with one line per missing texture.
        this.knownDead.add(path);
      }
      return ok;
    } catch {
      this.knownDead.add(path);
      return false;
    }
  }
  
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
  }
  
  static getInstance(): LandscapeAssetManager {
    if (!LandscapeAssetManager.instance) {
      LandscapeAssetManager.instance = new LandscapeAssetManager();
    }
    return LandscapeAssetManager.instance;
  }
  
  async preloadAllAssets(): Promise<void> {
    if (this.isPreloaded) return;

    // Batched HEAD-probe across every registered stylized pack first, so
    // any pack whose GLB isn't on disk / in the CDN bucket gets marked
    // dead before downstream code iterates the registry. Keeps the
    // procedural fallback path quiet and avoids GLTFLoader "<" errors.
    await pruneDeadStylizedPacks();

    const texturePromises: Promise<THREE.Texture>[] = [];
    const modelPromises: Promise<THREE.Group>[] = [];
    
    for (const treeType of Object.keys(TREE_TEXTURE_PATHS)) {
      const paths = TREE_TEXTURE_PATHS[treeType];
      texturePromises.push(this.loadTexture(paths.bark));
      if (paths.barkNormal) {
        texturePromises.push(this.loadTexture(paths.barkNormal));
      }
      texturePromises.push(this.loadTexture(paths.leaves));
    }
    
    for (const path of Object.values(ENVIRONMENT_TEXTURE_PATHS)) {
      texturePromises.push(this.loadTexture(path));
    }
    
    for (const variants of Object.values(TREE_MODEL_VARIANTS)) {
      for (const path of variants) {
        modelPromises.push(this.loadModel(path));
      }
    }
    
    for (const path of Object.values(VEGETATION_MODEL_PATHS)) {
      modelPromises.push(this.loadModel(path));
    }
    
    await Promise.allSettled([
      ...texturePromises,
      ...modelPromises,
      stylizedPacks.preloadAll(),  // tree/gem/ice packs (skips lazy ones)
    ]);
    this.isPreloaded = true;
    if (this.knownDead.size > 0) {
      console.info(
        `[LandscapeAssets] ${this.knownDead.size} legacy asset(s) unavailable, using procedural fallback`
      );
    }
    console.log('[LandscapeAssets] Preloaded all assets (legacy + stylized packs)');
  }

  /**
   * Try to instantiate a stylized canopy tree appropriate for the requested
   * legacy TreeType. Returns null if no stylized variant is available yet
   * (caller falls back to legacy).
   */
  getStylizedTreeForType(type: TreeType, rand: () => number = Math.random): THREE.Group | null {
    const biome = TREE_TYPE_TO_BIOME[type];
    if (!biome) return null;
    const candidates = STYLIZED_ASSETS.filter(
      (a) => a.role === 'canopy' && (a.biomes[biome] ?? 0) > 0 && stylizedPacks.isLoaded(a.packId)
    );
    if (candidates.length === 0) return null;
    const pick = pickWeighted(candidates, biome, rand);
    if (!pick) return null;
    return instantiateStaticAsset(pick, rand);
  }
  
  async loadTexture(path: string): Promise<THREE.Texture> {
    const cached = this.textureCache.get(path);
    if (cached) return cached;
    if (this.knownDead.has(path)) {
      throw new Error(`asset unavailable: ${path}`);
    }

    const existingPromise = this.loadingPromises.get(path);
    if (existingPromise) return existingPromise as Promise<THREE.Texture>;

    const promise = (async () => {
      const reachable = await this.isAssetReachable(path);
      if (!reachable) throw new Error(`asset unavailable: ${path}`);
      return await new Promise<THREE.Texture>((resolve, reject) => {
        this.textureLoader.load(
          path,
          (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            this.textureCache.set(path, texture);
            resolve(texture);
          },
          undefined,
          (error) => {
            this.knownDead.add(path);
            reject(error);
          }
        );
      });
    })();

    this.loadingPromises.set(path, promise);
    return promise;
  }
  
  async loadModel(path: string): Promise<THREE.Group> {
    const cached = this.modelCache.get(path);
    if (cached) return cached.clone();
    if (this.knownDead.has(path)) {
      throw new Error(`asset unavailable: ${path}`);
    }

    const existingPromise = this.loadingPromises.get(path);
    if (existingPromise) {
      const model = await existingPromise as THREE.Group;
      return model.clone();
    }

    const promise = (async () => {
      const reachable = await this.isAssetReachable(path);
      if (!reachable) throw new Error(`asset unavailable: ${path}`);
      return await new Promise<THREE.Group>((resolve, reject) => {
        this.gltfLoader.load(
          path,
          (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });
            this.modelCache.set(path, model);
            resolve(model.clone());
          },
          undefined,
          (error) => {
            this.knownDead.add(path);
            reject(error);
          }
        );
      });
    })();

    this.loadingPromises.set(path, promise);
    return promise.then((m) => m.clone());
  }
  
  getTexture(path: string): THREE.Texture | null {
    return this.textureCache.get(path) || null;
  }
  
  getModel(path: string): THREE.Group | null {
    const cached = this.modelCache.get(path);
    return cached ? cached.clone() : null;
  }
  
  async getTreeModel(type: TreeType, variantIndex?: number): Promise<THREE.Group | null> {
    const variants = TREE_MODEL_VARIANTS[type];
    if (!variants || variants.length === 0) {
      return this.createProceduralTree(type);
    }
    
    const index = variantIndex !== undefined 
      ? variantIndex % variants.length 
      : Math.floor(Math.random() * variants.length);
    
    try {
      const model = await this.loadModel(variants[index]);
      await this.applyTreeTextures(model, type);
      return model;
    } catch (e) {
      console.warn(`[LandscapeAssets] Failed to load tree ${type} variant ${index}, using procedural`);
      return this.createProceduralTree(type);
    }
  }
  
  getTreeModelSync(type: TreeType, variantIndex?: number): THREE.Group {
    // Prefer a stylized pack tree when one is available for this biome.
    // Roughly 65% chance to use a stylized variant when one is loaded, so
    // the legacy GLTF/procedural variants still appear and provide variety.
    if (Math.random() < 0.65) {
      const stylized = this.getStylizedTreeForType(type);
      if (stylized) return stylized;
    }

    const variants = TREE_MODEL_VARIANTS[type];
    if (!variants || variants.length === 0) {
      return this.createProceduralTree(type);
    }

    const index = variantIndex !== undefined 
      ? variantIndex % variants.length 
      : Math.floor(Math.random() * variants.length);
    
    const cached = this.modelCache.get(variants[index]);
    if (cached) {
      const model = cached.clone();
      this.applyTreeTexturesSync(model, type);
      return model;
    }
    
    return this.createProceduralTree(type);
  }
  
  getVegetationModelSync(type: string): THREE.Group {
    const path = VEGETATION_MODEL_PATHS[type];
    if (!path) {
      return this.createProceduralVegetation(type);
    }
    
    const cached = this.modelCache.get(path);
    if (cached) {
      return cached.clone();
    }
    
    return this.createProceduralVegetation(type);
  }
  
  getRockModelSync(): THREE.Group {
    const rockTexture = this.getTexture(ENVIRONMENT_TEXTURE_PATHS.rocks);
    
    const group = new THREE.Group();
    const geometry = new THREE.DodecahedronGeometry(0.5, 1);
    
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] *= 0.8 + Math.random() * 0.4;
      positions[i + 1] *= 0.6 + Math.random() * 0.4;
      positions[i + 2] *= 0.8 + Math.random() * 0.4;
    }
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      map: rockTexture,
      color: rockTexture ? 0xffffff : 0x666666,
      roughness: 0.95,
      metalness: 0.05,
    });
    
    const rock = new THREE.Mesh(geometry, material);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.name = 'rock';
    group.add(rock);
    group.name = 'rock_group';
    
    return group;
  }
  
  private applyTreeTexturesSync(model: THREE.Group, type: TreeType): void {
    const texturePaths = TREE_TEXTURE_PATHS[type];
    if (!texturePaths) return;
    
    const barkTexture = this.getTexture(texturePaths.bark);
    const leavesTexture = this.getTexture(texturePaths.leaves);
    const barkNormalTexture = texturePaths.barkNormal ? this.getTexture(texturePaths.barkNormal) : null;
    
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();
        
        const isBark = name.includes('bark') || name.includes('trunk') || name.includes('wood') || name.includes('stem');
        const isLeaves = name.includes('leaves') || name.includes('foliage') || name.includes('leaf');
        
        if (isBark && barkTexture) {
          const material = new THREE.MeshStandardMaterial({
            map: barkTexture,
            normalMap: barkNormalTexture || undefined,
            roughness: 0.9,
            metalness: 0.0,
          });
          mesh.material = material;
        } else if (isLeaves && leavesTexture) {
          const material = new THREE.MeshStandardMaterial({
            map: leavesTexture,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.0,
          });
          mesh.material = material;
        } else if (barkTexture || leavesTexture) {
          const texture = barkTexture || leavesTexture;
          const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.85,
            metalness: 0.0,
          });
          mesh.material = material;
        }
      }
    });
  }
  
  private async applyTreeTextures(model: THREE.Group, type: TreeType): Promise<void> {
    const texturePaths = TREE_TEXTURE_PATHS[type];
    if (!texturePaths) return;
    
    try {
      const [barkTexture, leavesTexture, barkNormalTexture] = await Promise.all([
        this.loadTexture(texturePaths.bark).catch(() => null),
        this.loadTexture(texturePaths.leaves).catch(() => null),
        texturePaths.barkNormal ? this.loadTexture(texturePaths.barkNormal).catch(() => null) : null,
      ]);
      
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const name = mesh.name.toLowerCase();
          
          if (name.includes('bark') || name.includes('trunk') || name.includes('wood')) {
            if (barkTexture) {
              const material = new THREE.MeshStandardMaterial({
                map: barkTexture,
                normalMap: barkNormalTexture || undefined,
                roughness: 0.9,
                metalness: 0.0,
              });
              mesh.material = material;
            }
          } else if (name.includes('leaves') || name.includes('foliage') || name.includes('leaf')) {
            if (leavesTexture) {
              const material = new THREE.MeshStandardMaterial({
                map: leavesTexture,
                transparent: true,
                alphaTest: 0.5,
                side: THREE.DoubleSide,
                roughness: 0.8,
                metalness: 0.0,
              });
              mesh.material = material;
            }
          }
        }
      });
    } catch (e) {
      console.warn(`[LandscapeAssets] Error applying textures to tree:`, e);
    }
  }
  
  private createProceduralTree(type: TreeType): THREE.Group {
    // Preferred path: vendored fluffytree generator — produces stylized,
    // biome-appropriate trees with merged geometry and vertex-color leaf
    // palettes. We seed from a hash of (type + a per-call nonce) so distinct
    // calls in the same frame still produce variety.
    try {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      const tree = createFluffyTreeGroup(kindFromTreeType(type), { seed });
      tree.name = `${type}_tree`;
      return tree;
    } catch (e) {
      console.warn(`[LandscapeAssets] FluffyTree failed for "${type}", falling back to legacy geometry:`, e);
    }

    // Legacy fallback (kept verbatim) ────────────────────────────────────────
    const group = new THREE.Group();
    
    const trunkHeight = 3 + Math.random() * 2;
    const trunkRadius = 0.15 + Math.random() * 0.1;
    
    const trunkTexture = this.getTexture(TREE_TEXTURE_PATHS[type]?.bark || TREE_TEXTURE_PATHS.normal.bark);
    const leavesTexture = this.getTexture(TREE_TEXTURE_PATHS[type]?.leaves || TREE_TEXTURE_PATHS.normal.leaves);
    
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      map: trunkTexture,
      color: trunkTexture ? 0xffffff : 0x8b4513,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.name = 'trunk';
    group.add(trunk);
    
    let foliageGeometry: THREE.BufferGeometry;
    let foliageColor = 0x228b22;
    
    switch (type) {
      case 'pine':
        foliageGeometry = new THREE.ConeGeometry(1.5, 4, 8);
        foliageColor = 0x0d5c0d;
        break;
      case 'palm':
        foliageGeometry = new THREE.SphereGeometry(1.5, 8, 6);
        foliageColor = 0x2e8b2e;
        break;
      case 'birch':
        foliageGeometry = new THREE.SphereGeometry(2, 8, 8);
        foliageColor = 0xd4b800;
        break;
      case 'dead':
        group.name = 'dead_tree';
        return group;
      default:
        foliageGeometry = new THREE.SphereGeometry(2, 8, 8);
        foliageColor = 0x228b22;
    }
    
    const foliageMaterial = new THREE.MeshStandardMaterial({
      map: leavesTexture,
      color: leavesTexture ? 0xffffff : foliageColor,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = trunkHeight + 1;
    foliage.castShadow = true;
    foliage.name = 'leaves';
    group.add(foliage);
    
    group.name = `${type}_tree`;
    return group;
  }
  
  async getVegetationModel(type: string): Promise<THREE.Group | null> {
    const path = VEGETATION_MODEL_PATHS[type];
    if (!path) {
      console.warn(`[LandscapeAssets] Unknown vegetation type: ${type}`);
      return null;
    }
    
    try {
      return await this.loadModel(path);
    } catch (e) {
      return this.createProceduralVegetation(type);
    }
  }
  
  private createProceduralVegetation(type: string): THREE.Group {
    const group = new THREE.Group();
    
    if (type.includes('grass')) {
      const grassTexture = this.getTexture(ENVIRONMENT_TEXTURE_PATHS.grass);
      const geometry = new THREE.PlaneGeometry(0.3, 0.5);
      const material = new THREE.MeshStandardMaterial({
        map: grassTexture,
        color: grassTexture ? 0xffffff : 0x4a7c23,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.3,
      });
      
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(geometry, material);
        blade.position.set(
          (Math.random() - 0.5) * 0.3,
          0.25,
          (Math.random() - 0.5) * 0.3
        );
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.z = (Math.random() - 0.5) * 0.2;
        group.add(blade);
      }
    } else if (type.includes('bush')) {
      const bushTexture = this.getTexture(ENVIRONMENT_TEXTURE_PATHS.bushLeaves);
      const geometry = new THREE.SphereGeometry(0.5, 8, 6);
      const material = new THREE.MeshStandardMaterial({
        map: bushTexture,
        color: bushTexture ? 0xffffff : 0x2e7d32,
        roughness: 0.8,
      });
      const bush = new THREE.Mesh(geometry, material);
      bush.position.y = 0.4;
      bush.scale.y = 0.7;
      bush.castShadow = true;
      group.add(bush);
    } else if (type.includes('flower')) {
      const flowerTexture = this.getTexture(ENVIRONMENT_TEXTURE_PATHS.flowers);
      const geometry = new THREE.PlaneGeometry(0.3, 0.4);
      const material = new THREE.MeshStandardMaterial({
        map: flowerTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.3,
      });
      const flower = new THREE.Mesh(geometry, material);
      flower.position.y = 0.2;
      flower.rotation.y = Math.random() * Math.PI;
      group.add(flower);
    }
    
    group.name = `procedural_${type}`;
    return group;
  }
  
  async getRockModel(): Promise<THREE.Group> {
    const rockTexture = this.getTexture(ENVIRONMENT_TEXTURE_PATHS.rocks);
    
    const group = new THREE.Group();
    const geometry = new THREE.DodecahedronGeometry(0.5, 1);
    
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] *= 0.8 + Math.random() * 0.4;
      positions[i + 1] *= 0.6 + Math.random() * 0.4;
      positions[i + 2] *= 0.8 + Math.random() * 0.4;
    }
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      map: rockTexture,
      color: rockTexture ? 0xffffff : 0x666666,
      roughness: 0.95,
      metalness: 0.05,
    });
    
    const rock = new THREE.Mesh(geometry, material);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.name = 'rock';
    group.add(rock);
    group.name = 'rock_group';
    
    return group;
  }
  
  getRandomTreeTypeForBiome(biome: string): TreeType {
    const biomeTreeTypes: Record<string, TreeType[]> = {
      tropical: ['palm', 'normal', 'birch'],
      volcanic: ['dead', 'pine'],
      arctic: ['pine', 'birch'],
      desert: ['palm', 'dead'],
      haunted: ['dead', 'birch'],
      forest: ['normal', 'birch', 'pine'],
      beach: ['palm'],
    };
    
    const types = biomeTreeTypes[biome] || biomeTreeTypes.forest;
    return types[Math.floor(Math.random() * types.length)];
  }
  
  getRandomVegetationTypeForBiome(biome: string): string {
    const biomeVegetation: Record<string, string[]> = {
      tropical: ['bushFlowers', 'bushLarge', 'flower1Clump', 'flower2Clump', 'grassLarge'],
      volcanic: ['grassSmall'],
      arctic: ['grassSmall', 'bushSmall'],
      desert: ['bushSmall', 'grassSmall'],
      haunted: ['bush', 'grassSmall'],
      forest: ['bushLarge', 'bushLargeFlowers', 'flower1Clump', 'grassLarge'],
      beach: ['grassSmall', 'flower3Clump'],
    };
    
    const types = biomeVegetation[biome] || biomeVegetation.forest;
    return types[Math.floor(Math.random() * types.length)];
  }
}

export const landscapeAssets = LandscapeAssetManager.getInstance();
