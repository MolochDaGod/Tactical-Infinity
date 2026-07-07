import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Race } from '@shared/schema';
import { retargetClipTPose, buildTargetBoneMap } from './animationRetargeting';
import { applyBareLoadout } from './characterMeshFilter';

const TOON_RTS_BASE = '/toon_rts/Toon_RTS';

interface RaceModelConfig {
  folder: string;
  prefix: string;
  modelFile: string;
  animationFolder: string;
  color: number;
}

const RACE_CONFIGS: Record<Race, RaceModelConfig> = {
  human: {
    folder: 'WesternKingdoms',
    prefix: 'WK',
    modelFile: 'WK_Characters_customizable.FBX',
    animationFolder: 'Cavalry',
    color: 0x8B7355,
  },
  barbarian: {
    folder: 'Barbarians',
    prefix: 'BRB',
    modelFile: 'BRB_Characters_customizable.FBX',
    animationFolder: 'Spearman',
    color: 0xA0522D,
  },
  dwarf: {
    folder: 'Dwarves',
    prefix: 'DWF',
    modelFile: 'DWF_Characters_customizable.FBX',
    animationFolder: 'Worker',
    color: 0x7A6048,
  },
  elf: {
    folder: 'Elves',
    prefix: 'ELF',
    modelFile: 'ELF_Characters_customizable.FBX',
    animationFolder: 'Infantry',
    color: 0x4A7C59,
  },
  orc: {
    folder: 'Orcs',
    prefix: 'ORC',
    modelFile: 'ORC_Characters_Customizable.FBX',
    animationFolder: 'Cavalry',
    color: 0x4A6741,
  },
  undead: {
    folder: 'Undead',
    prefix: 'UD',
    modelFile: 'UD_Characters_customizable.FBX',
    animationFolder: 'Infantry',
    color: 0x5D4E6D,
  },
};

interface CaptainAnimations {
  idle?: THREE.AnimationClip;
  run?: THREE.AnimationClip;
  attack?: THREE.AnimationClip;
  death?: THREE.AnimationClip;
}

interface LoadedCaptain {
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: CaptainAnimations;
  currentAction: THREE.AnimationAction | null;
  race: Race;
}

interface CachedRaceModel {
  model: THREE.Group;
  animations: CaptainAnimations;
}

export class CaptainManager {
  private fbxLoader: FBXLoader;
  private modelCache: Map<Race, CachedRaceModel> = new Map();
  private loadingPromises: Map<Race, Promise<CachedRaceModel>> = new Map();
  private activeCaptains: Map<string, LoadedCaptain> = new Map();
  private texturesBase: string;

  constructor() {
    const loadingManager = new THREE.LoadingManager();
    
    this.texturesBase = `${TOON_RTS_BASE}/WesternKingdoms/models/Materials/textures/`;
    
    loadingManager.setURLModifier((url) => {
      if (url.includes('.tga') || url.includes('.png') || url.includes('.jpg')) {
        const filename = url.split('/').pop();
        if (filename) {
          return this.texturesBase + filename;
        }
      }
      return url;
    });
    
    loadingManager.addHandler(/\.tga$/i, new TGALoader(loadingManager));
    
    this.fbxLoader = new FBXLoader(loadingManager);
  }

  private getModelPath(race: Race): string {
    const config = RACE_CONFIGS[race];
    return `${TOON_RTS_BASE}/${config.folder}/models/${config.modelFile}`;
  }

  private getAnimationPath(race: Race, animType: string): string {
    const config = RACE_CONFIGS[race];
    
    if (race === 'dwarf') {
      if (animType === 'idle') {
        return `${TOON_RTS_BASE}/${config.folder}/animation/Worker/_idle.FBX`;
      } else if (animType === 'run') {
        return `${TOON_RTS_BASE}/${config.folder}/animation/Worker/run.FBX`;
      } else if (animType === 'attack') {
        return `${TOON_RTS_BASE}/${config.folder}/animation/Worker/DWF_worker_07_attack.FBX`;
      } else if (animType === 'death') {
        return `${TOON_RTS_BASE}/${config.folder}/animation/Worker/DWF_worker_10_death_B.FBX`;
      }
    }
    
    const animFolder = config.animationFolder;
    const prefix = config.prefix.toLowerCase();
    const folderLower = animFolder.toLowerCase();
    
    const animMap: Record<string, string> = {
      idle: `${config.prefix}_${folderLower}_01_idle.FBX`,
      run: `${config.prefix}_${folderLower}_03_run.FBX`,
      attack: `${config.prefix}_${folderLower}_07_attack.FBX`,
      death: `${config.prefix}_${folderLower}_10_death_B.FBX`,
    };
    
    return `${TOON_RTS_BASE}/${config.folder}/animation/${animFolder}/${animMap[animType] || animMap.idle}`;
  }

  private loadAnimationClip(path: string, name: string): Promise<THREE.AnimationClip | null> {
    return new Promise((resolve) => {
      this.fbxLoader.load(
        path,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0].clone();
            clip.name = name;
            resolve(clip);
          } else {
            resolve(null);
          }
        },
        undefined,
        (error) => {
          console.warn(`Failed to load animation ${name} from ${path}:`, error);
          resolve(null);
        }
      );
    });
  }

  // Loads an animation FBX and returns BOTH the clip AND the source-rig
  // group. The source group is required by the T-pose retargeter so it can
  // read each source bone's bind-pose local quaternion (Mixamo always exports
  // T-pose, so the FBX bones are at rest immediately after load).
  private loadAnimationFBX(
    path: string,
    name: string,
  ): Promise<{ clip: THREE.AnimationClip; source: THREE.Group } | null> {
    return new Promise((resolve) => {
      this.fbxLoader.load(
        path,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0].clone();
            clip.name = name;
            resolve({ clip, source: fbx });
          } else {
            resolve(null);
          }
        },
        undefined,
        (error) => {
          console.warn(`Failed to load animation ${name} from ${path}:`, error);
          resolve(null);
        }
      );
    });
  }

  private deepCloneGroup(original: THREE.Group): THREE.Group {
    // Use three's SkeletonUtils.clone which is purpose-built for cloning
    // hierarchies that contain SkinnedMesh: it walks the skeleton, builds a
    // fresh bones[] from the cloned hierarchy, and rebinds each SkinnedMesh
    // to its own new Skeleton (with cloned boneInverses). The previous
    // hand-rolled version returned `oldBone` as a fallback when a bone wasn't
    // found in the cloned tree, which sometimes inserted `undefined` into the
    // bones array and crashed `Skeleton.update()` with "Cannot read properties
    // of undefined (reading 'elements')" — surfaced upstream as
    // `computeBoundingSphere(): NaN` warnings.
    const clone = cloneSkinned(original) as THREE.Group;

    // SkeletonUtils.clone leaves materials and geometry SHARED with the
    // source. We need per-instance copies so captains can hide/show body
    // parts and tint per faction without mutating every other captain.
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.geometry = mesh.geometry.clone();

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((mat) => mat.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });

    return clone;
  }

  private async loadRaceModelInternal(race: Race): Promise<CachedRaceModel> {
    const modelPath = this.getModelPath(race);
    const config = RACE_CONFIGS[race];
    
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        modelPath,
        async (fbx) => {
          fbx.scale.setScalar(0.012);
          
          // Hide bag / wood / spear / axe / shield / helmet / hood and keep
          // only ONE naked head + hair + beard variant. The Toon RTS
          // "_customizable.FBX" packs ship every cosmetic in a single file —
          // without this filter the captain wears every piece of kit at once.
          // Class-appropriate weapons are attached separately to the hand bone.
          applyBareLoadout(fbx, { log: true, label: race });

          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              
              const applyMaterial = (mat: THREE.Material) => {
                if (mat instanceof THREE.MeshStandardMaterial || 
                    mat instanceof THREE.MeshPhongMaterial ||
                    mat instanceof THREE.MeshBasicMaterial) {
                  mat.side = THREE.DoubleSide;
                  
                  if (!mat.map && (mat as any).color?.getHex() === 0xffffff) {
                    (mat as any).color.set(config.color);
                  }
                }
              };
              
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach(applyMaterial);
                } else {
                  applyMaterial(mesh.material);
                }
              }
            }
          });
          
          const animations: CaptainAnimations = {};
          
          if (fbx.animations && fbx.animations.length > 0) {
            const idleClip = fbx.animations.find(a => 
              a.name.toLowerCase().includes('idle') || 
              a.name.toLowerCase().includes('stand')
            );
            if (idleClip) {
              idleClip.name = 'idle';
              animations.idle = idleClip;
            }
          }
          
          const animTypes = ['idle', 'run', 'attack', 'death'] as const;

          // All Toon RTS animation FBX files are Mixamo motions baked onto a
          // BRB-shaped rig. Bone NAMES match across races (after normalize)
          // but rest-pose ORIENTATIONS differ — playing a BRB-baked clip raw
          // on a non-BRB skeleton twists joints around wrong axes (the
          // classic Mixamo retarget jank). T-pose retargeting captures both
          // skeletons in their respective T-pose and rebakes every keyframe
          // through the per-bone rest offset.
          const targetBones = buildTargetBoneMap(fbx);

          for (const animType of animTypes) {
            if (animations[animType]) continue;

            const animPath = this.getAnimationPath(race, animType);
            const loaded = await this.loadAnimationFBX(animPath, animType);
            if (!loaded) continue;

            if (targetBones.size > 0) {
              animations[animType] = retargetClipTPose(loaded.clip, loaded.source, fbx);
            } else {
              animations[animType] = loaded.clip;
            }
          }

          console.log(`Loaded captain model for race: ${race}, animations:`, Object.keys(animations), `(target bones: ${targetBones.size})`);
          
          resolve({
            model: fbx,
            animations,
          });
        },
        undefined,
        (error) => {
          console.error(`Error loading captain model for race ${race}:`, error);
          reject(error);
        }
      );
    });
  }

  async loadRaceModel(race: Race): Promise<CachedRaceModel> {
    if (this.modelCache.has(race)) {
      return this.modelCache.get(race)!;
    }
    
    if (this.loadingPromises.has(race)) {
      return this.loadingPromises.get(race)!;
    }
    
    const promise = this.loadRaceModelInternal(race);
    this.loadingPromises.set(race, promise);
    
    try {
      const cached = await promise;
      this.modelCache.set(race, cached);
      this.loadingPromises.delete(race);
      return cached;
    } catch (error) {
      this.loadingPromises.delete(race);
      throw error;
    }
  }

  async createCaptain(id: string, race: Race): Promise<LoadedCaptain> {
    const cached = await this.loadRaceModel(race);
    
    const model = this.deepCloneGroup(cached.model);
    const mixer = new THREE.AnimationMixer(model);
    
    const animations: CaptainAnimations = { ...cached.animations };
    
    let currentAction: THREE.AnimationAction | null = null;
    
    if (animations.idle) {
      currentAction = mixer.clipAction(animations.idle);
      currentAction.setLoop(THREE.LoopRepeat, Infinity);
      currentAction.play();
    }
    
    const captain: LoadedCaptain = {
      model,
      mixer,
      animations,
      currentAction,
      race,
    };
    
    this.activeCaptains.set(id, captain);
    
    return captain;
  }

  playAnimation(captainId: string, animName: keyof CaptainAnimations, crossFadeDuration: number = 0.3): void {
    const captain = this.activeCaptains.get(captainId);
    if (!captain) return;
    
    const clip = captain.animations[animName];
    if (!clip) return;
    
    const newAction = captain.mixer.clipAction(clip);
    
    if (captain.currentAction && captain.currentAction !== newAction) {
      captain.currentAction.fadeOut(crossFadeDuration);
    }
    
    newAction.reset();
    newAction.fadeIn(crossFadeDuration);
    newAction.play();
    
    captain.currentAction = newAction;
  }

  update(deltaTime: number): void {
    this.activeCaptains.forEach((captain) => {
      captain.mixer.update(deltaTime);
    });
  }

  removeCaptain(id: string): void {
    const captain = this.activeCaptains.get(id);
    if (captain) {
      captain.mixer.stopAllAction();
      
      if (captain.model.parent) {
        captain.model.parent.remove(captain.model);
      }
      
      this.activeCaptains.delete(id);
    }
  }

  getCaptain(id: string): LoadedCaptain | undefined {
    return this.activeCaptains.get(id);
  }

  async preloadAllRaces(): Promise<void> {
    const races: Race[] = ['human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead'];
    
    await Promise.all(races.map(race => this.loadRaceModel(race)));
    
    console.log('All 6 race captain models preloaded');
  }

  dispose(): void {
    const ids = Array.from(this.activeCaptains.keys());
    ids.forEach(id => this.removeCaptain(id));
    
    this.modelCache.clear();
    this.loadingPromises.clear();
  }
}

export const captainManager = new CaptainManager();
