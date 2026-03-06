import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { TGALoader } from "three/examples/jsm/loaders/TGALoader.js";
import type { Race, UnitClass } from "@shared/schema";

const TOON_RTS_BASE = "/3dassets/Toon_RTS";
const TEXTURES_BASE = `${TOON_RTS_BASE}/WesternKingdoms/models/Materials/textures/`;
const BUILDINGS_BASE = "/3dassets/buildings/FBX";
const GLTF_MODELS_BASE = "/3dassets/gltf";

export interface LoadedModel {
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: Map<string, THREE.AnimationClip>;
  currentAction: THREE.AnimationAction | null;
}

export interface ModelLoadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface CachedCharacterModel {
  model: THREE.Group;
  animations: Map<string, THREE.AnimationClip>;
}

export const raceToFolder: Record<Race, { folder: string; prefix: string }> = {
  human: { folder: "WesternKingdoms", prefix: "WK" },
  barbarian: { folder: "Barbarians", prefix: "BRB" },
  dwarf: { folder: "Dwarves", prefix: "DWF" },
  elf: { folder: "Elves", prefix: "ELV" },
  orc: { folder: "Orcs", prefix: "ORC" },
  undead: { folder: "Undead", prefix: "UND" },
};

export const classToModelType: Record<UnitClass, "character" | "cavalry"> = {
  warrior: "character",
  ranger: "character",
  mage: "character",
  worge: "character",
};

const ANIMATION_TYPES = ["01_idle", "03_run", "07_attack", "10_death"] as const;

const RACE_COLORS: Record<Race, number> = {
  human: 0x8B7355,
  barbarian: 0xA0522D,
  dwarf: 0x7A6048,
  elf: 0x4A7C59,
  orc: 0x4A6741,
  undead: 0x5D4E6D,
};

export class FBXModelLoader {
  private fbxLoader: FBXLoader;
  private gltfLoader: GLTFLoader;
  private characterCache: Map<string, CachedCharacterModel> = new Map();
  private buildingCache: Map<string, THREE.Group> = new Map();
  private animationCache: Map<string, THREE.AnimationClip> = new Map();
  private loadingPromises: Map<string, Promise<CachedCharacterModel>> = new Map();

  constructor() {
    const loadingManager = new THREE.LoadingManager();
    loadingManager.setURLModifier((url) => {
      if (url.includes('.png') || url.includes('.jpg') || url.includes('.tga')) {
        const filename = url.split('/').pop();
        if (filename) {
          return TEXTURES_BASE + filename;
        }
      }
      return url;
    });
    
    loadingManager.addHandler(/\.tga$/i, new TGALoader(loadingManager));
    
    this.fbxLoader = new FBXLoader(loadingManager);
    this.gltfLoader = new GLTFLoader(loadingManager);
    
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  private getRaceColor(race: Race): number {
    return RACE_COLORS[race] || 0x808080;
  }

  private getGLTFModelPath(race: Race, type: "character" | "cavalry"): string {
    const raceInfo = raceToFolder[race];
    const typeSuffix = type === "cavalry" ? "cavalry" : "character";
    return `${GLTF_MODELS_BASE}/${raceInfo.folder}/${typeSuffix}.glb`;
  }

  private async checkFileExists(path: string): Promise<boolean> {
    try {
      const response = await fetch(path, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async loadGLTFModel(path: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          resolve({ scene: gltf.scene, animations: gltf.animations });
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  private getCharacterModelPath(race: Race, type: "character" | "cavalry"): string {
    const raceInfo = raceToFolder[race];
    if (type === "cavalry") {
      return `${TOON_RTS_BASE}/${raceInfo.folder}/models/${raceInfo.prefix}_Cavalry_customizable.FBX`;
    }
    return `${TOON_RTS_BASE}/${raceInfo.folder}/models/${raceInfo.prefix}_Characters_customizable.FBX`;
  }

  private getAnimationPath(race: Race, type: "character" | "cavalry", animNum: string): string {
    const raceInfo = raceToFolder[race];
    const folder = type === "cavalry" ? "Cavalry" : "Worker";
    const prefix = type === "cavalry" ? "cavalry" : "worker";
    return `${TOON_RTS_BASE}/${raceInfo.folder}/animation/${folder}/${raceInfo.prefix}_${prefix}_${animNum}.FBX`;
  }

  private deepCloneGroup(original: THREE.Group): THREE.Group {
    const clone = original.clone(true);
    
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry = mesh.geometry.clone();
        
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(mat => mat.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
    
    return clone;
  }

  private async loadAnimationClip(path: string, name: string): Promise<THREE.AnimationClip | null> {
    if (this.animationCache.has(path)) {
      return this.animationCache.get(path)!;
    }

    return new Promise((resolve) => {
      this.fbxLoader.load(
        path,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0];
            clip.name = name;
            this.animationCache.set(path, clip);
            resolve(clip);
          } else {
            resolve(null);
          }
        },
        undefined,
        () => {
          resolve(null);
        }
      );
    });
  }

  async loadCharacterModel(
    race: Race,
    unitClass: UnitClass,
    onProgress?: (progress: ModelLoadProgress) => void
  ): Promise<LoadedModel> {
    const modelType = classToModelType[unitClass];
    const cacheKey = `${race}-${modelType}`;

    if (this.characterCache.has(cacheKey)) {
      const cached = this.characterCache.get(cacheKey)!;
      const clonedModel = this.deepCloneGroup(cached.model);
      const mixer = new THREE.AnimationMixer(clonedModel);
      
      const animations = new Map<string, THREE.AnimationClip>();
      cached.animations.forEach((clip, name) => {
        animations.set(name, clip);
      });
      
      let currentAction: THREE.AnimationAction | null = null;
      if (animations.has("idle")) {
        currentAction = mixer.clipAction(animations.get("idle")!);
        currentAction.play();
      }
      
      return {
        model: clonedModel,
        mixer,
        animations,
        currentAction,
      };
    }

    if (this.loadingPromises.has(cacheKey)) {
      const cached = await this.loadingPromises.get(cacheKey)!;
      const clonedModel = this.deepCloneGroup(cached.model);
      const mixer = new THREE.AnimationMixer(clonedModel);
      
      const animations = new Map<string, THREE.AnimationClip>();
      cached.animations.forEach((clip, name) => {
        animations.set(name, clip);
      });
      
      let currentAction: THREE.AnimationAction | null = null;
      if (animations.has("idle")) {
        currentAction = mixer.clipAction(animations.get("idle")!);
        currentAction.play();
      }
      
      return {
        model: clonedModel,
        mixer,
        animations,
        currentAction,
      };
    }

    const loadPromise = this.loadCharacterModelInternal(race, modelType, onProgress);
    this.loadingPromises.set(cacheKey, loadPromise);

    const cached = await loadPromise;
    this.characterCache.set(cacheKey, cached);
    this.loadingPromises.delete(cacheKey);

    const mixer = new THREE.AnimationMixer(cached.model);
    
    let currentAction: THREE.AnimationAction | null = null;
    if (cached.animations.has("idle")) {
      currentAction = mixer.clipAction(cached.animations.get("idle")!);
      currentAction.play();
    }

    return {
      model: cached.model,
      mixer,
      animations: new Map(cached.animations),
      currentAction,
    };
  }

  private async loadCharacterModelInternal(
    race: Race,
    modelType: "character" | "cavalry",
    onProgress?: (progress: ModelLoadProgress) => void
  ): Promise<CachedCharacterModel> {
    const modelPath = this.getCharacterModelPath(race, modelType);

    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        modelPath,
        async (fbx) => {
          fbx.scale.setScalar(0.01);

          const raceInfo = raceToFolder[race];
          const raceColor = this.getRaceColor(race);
          
          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const applyDefaultMaterial = (mat: THREE.Material) => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.side = THREE.DoubleSide;
                  if (!mat.map && mat.color.getHex() === 0xffffff) {
                    mat.color.set(raceColor);
                    mat.roughness = 0.6;
                    mat.metalness = 0.2;
                  }
                } else if (mat instanceof THREE.MeshPhongMaterial) {
                  mat.side = THREE.DoubleSide;
                  if (!mat.map && mat.color.getHex() === 0xffffff) {
                    mat.color.set(raceColor);
                    mat.shininess = 30;
                  }
                } else if (mat instanceof THREE.MeshBasicMaterial) {
                  mat.side = THREE.DoubleSide;
                  if (!mat.map && mat.color.getHex() === 0xffffff) {
                    const newMat = new THREE.MeshStandardMaterial({
                      color: raceColor,
                      side: THREE.DoubleSide,
                      roughness: 0.6,
                      metalness: 0.2,
                    });
                    if (Array.isArray(mesh.material)) {
                      const idx = mesh.material.indexOf(mat);
                      if (idx !== -1) mesh.material[idx] = newMat;
                    } else {
                      mesh.material = newMat;
                    }
                  }
                }
              };

              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach(applyDefaultMaterial);
                } else {
                  applyDefaultMaterial(mesh.material);
                }
              }
            }
          });

          const animations = new Map<string, THREE.AnimationClip>();

          if (fbx.animations && fbx.animations.length > 0) {
            fbx.animations.forEach((clip, index) => {
              animations.set(clip.name || `embedded_${index}`, clip);
            });
          }

          const animationPromises = ANIMATION_TYPES.map(async (animType) => {
            const animPath = this.getAnimationPath(race, modelType, animType);
            const animName = animType.includes("idle") ? "idle" :
                            animType.includes("run") ? "run" :
                            animType.includes("attack") ? "attack" : "death";
            const clip = await this.loadAnimationClip(animPath, animName);
            if (clip) {
              animations.set(animName, clip);
            }
          });

          await Promise.all(animationPromises);

          resolve({
            model: fbx,
            animations,
          });
        },
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            onProgress({
              loaded: xhr.loaded,
              total: xhr.total,
              percent: (xhr.loaded / xhr.total) * 100,
            });
          }
        },
        (error) => {
          console.error(`Error loading FBX model: ${modelPath}`, error);
          reject(error);
        }
      );
    });
  }

  async loadBuildingModel(
    buildingType: string,
    age: "first" | "second",
    level: number,
    variant?: number
  ): Promise<THREE.Group> {
    const ageStr = age === "first" ? "FirstAge" : "SecondAge";
    let modelPath: string;

    switch (buildingType) {
      case "barracks":
        const barracksLevel = age === "first" && level === 1 ? 2 : level;
        modelPath = `${BUILDINGS_BASE}/Barracks_${ageStr}_Level${barracksLevel}.fbx`;
        break;
      case "archery":
        modelPath = `${BUILDINGS_BASE}/Archery_${ageStr}_Level${level}.fbx`;
        break;
      case "market":
        modelPath = `${BUILDINGS_BASE}/Market_${ageStr}_Level${level}.fbx`;
        break;
      case "port":
        modelPath = `${BUILDINGS_BASE}/Port_${ageStr}_Level${level}.fbx`;
        break;
      case "storage":
        const lvlStr = level === 3 && age === "first" ? "Leve3" : `Level${level}`;
        modelPath = `${BUILDINGS_BASE}/Storage_${ageStr}_${lvlStr}.fbx`;
        break;
      case "house":
        const v = variant || 1;
        modelPath = `${BUILDINGS_BASE}/Houses_${ageStr}_${v}_Level${level}.fbx`;
        break;
      case "wall_tower":
        modelPath = `${BUILDINGS_BASE}/WallTowers_DoorClosed_FirstAge.fbx`;
        break;
      default:
        modelPath = `${BUILDINGS_BASE}/Houses_FirstAge_1_Level1.fbx`;
    }

    const cacheKey = `building-${buildingType}-${age}-${level}-${variant || 1}`;

    if (this.buildingCache.has(cacheKey)) {
      return this.deepCloneGroup(this.buildingCache.get(cacheKey)!);
    }

    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        modelPath,
        (fbx) => {
          fbx.scale.setScalar(0.01);

          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });

          this.buildingCache.set(cacheKey, fbx);
          resolve(this.deepCloneGroup(fbx));
        },
        undefined,
        (error) => {
          console.error(`Error loading building model: ${modelPath}`, error);
          reject(error);
        }
      );
    });
  }

  playAnimation(
    loadedModel: LoadedModel,
    animationName: string,
    options: {
      loop?: boolean;
      fadeIn?: number;
      speed?: number;
    } = {}
  ): THREE.AnimationAction | null {
    const { loop = true, fadeIn = 0.3, speed = 1 } = options;
    const clip = loadedModel.animations.get(animationName);

    if (!clip) {
      console.warn(`Animation "${animationName}" not found. Available: ${Array.from(loadedModel.animations.keys()).join(", ")}`);
      return null;
    }

    if (loadedModel.currentAction) {
      loadedModel.currentAction.fadeOut(fadeIn);
    }

    const action = loadedModel.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.setEffectiveTimeScale(speed);
    action.reset().fadeIn(fadeIn).play();

    loadedModel.currentAction = action;
    return action;
  }

  crossFadeToAnimation(
    loadedModel: LoadedModel,
    animationName: string,
    duration: number = 0.3
  ): THREE.AnimationAction | null {
    const clip = loadedModel.animations.get(animationName);
    if (!clip) {
      console.warn(`Animation "${animationName}" not found for crossfade`);
      return null;
    }

    const newAction = loadedModel.mixer.clipAction(clip);

    if (loadedModel.currentAction && loadedModel.currentAction !== newAction) {
      loadedModel.currentAction.fadeOut(duration);
    }

    newAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
    loadedModel.currentAction = newAction;
    return newAction;
  }

  disposeInstance(loadedModel: LoadedModel): void {
    if (loadedModel.mixer) {
      loadedModel.mixer.stopAllAction();
    }

    loadedModel.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            const stdMat = mat as THREE.MeshStandardMaterial;
            if (stdMat.map) stdMat.map.dispose();
            mat.dispose();
          });
        } else if (mesh.material) {
          const stdMat = mesh.material as THREE.MeshStandardMaterial;
          if (stdMat.map) stdMat.map.dispose();
          mesh.material.dispose();
        }
      }
    });
  }

  disposeBuilding(buildingGroup: THREE.Group): void {
    buildingGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            const stdMat = mat as THREE.MeshStandardMaterial;
            if (stdMat.map) stdMat.map.dispose();
            mat.dispose();
          });
        } else if (mesh.material) {
          const stdMat = mesh.material as THREE.MeshStandardMaterial;
          if (stdMat.map) stdMat.map.dispose();
          mesh.material.dispose();
        }
      }
    });
  }

  clearCache(): void {
    this.characterCache.clear();
    this.buildingCache.clear();
    this.animationCache.clear();
    this.loadingPromises.clear();
  }
}

export const fbxLoader = new FBXModelLoader();
