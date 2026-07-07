import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type HomeType = 'cottage' | 'farmhouse' | 'manor' | 'cabin' | 'tavern' | 'shop';

export interface HomeInteriorTheme {
  type: HomeType;
  name: string;
  description: string;
  ambientColor: number;
  lightIntensity: number;
  fogColor: number;
  fogDensity: number;
  materialOverrides: {
    walls?: number;
    floor?: number;
    ceiling?: number;
    furniture?: number;
    accent?: number;
  };
}

export const homeInteriorThemes: Record<HomeType, HomeInteriorTheme> = {
  cottage: {
    type: 'cottage',
    name: 'Cozy Cottage',
    description: 'A warm, humble dwelling with rustic charm',
    ambientColor: 0xffe4b5,
    lightIntensity: 0.8,
    fogColor: 0x2a1f0f,
    fogDensity: 0.02,
    materialOverrides: {
      walls: 0x8b7355,
      floor: 0x654321,
      furniture: 0x5c4033,
      accent: 0xdaa520
    }
  },
  farmhouse: {
    type: 'farmhouse',
    name: 'Country Farmhouse',
    description: 'A spacious home with agricultural roots',
    ambientColor: 0xfff8dc,
    lightIntensity: 0.9,
    fogColor: 0x3d2b1f,
    fogDensity: 0.015,
    materialOverrides: {
      walls: 0xf5deb3,
      floor: 0x8b4513,
      furniture: 0xa0522d,
      accent: 0x228b22
    }
  },
  manor: {
    type: 'manor',
    name: 'Noble Manor',
    description: 'An elegant estate befitting nobility',
    ambientColor: 0xf0e68c,
    lightIntensity: 1.0,
    fogColor: 0x1a1a2e,
    fogDensity: 0.01,
    materialOverrides: {
      walls: 0x4a4a4a,
      floor: 0x2f1810,
      furniture: 0x722f37,
      accent: 0xffd700
    }
  },
  cabin: {
    type: 'cabin',
    name: 'Mountain Cabin',
    description: 'A rugged shelter in the wilderness',
    ambientColor: 0xdeb887,
    lightIntensity: 0.6,
    fogColor: 0x1a0f0a,
    fogDensity: 0.025,
    materialOverrides: {
      walls: 0x4a3728,
      floor: 0x3d2817,
      furniture: 0x5d4e37,
      accent: 0xcd853f
    }
  },
  tavern: {
    type: 'tavern',
    name: 'Rustic Tavern',
    description: 'A lively establishment for travelers',
    ambientColor: 0xffa500,
    lightIntensity: 0.7,
    fogColor: 0x2a1810,
    fogDensity: 0.02,
    materialOverrides: {
      walls: 0x6b4423,
      floor: 0x3c280d,
      furniture: 0x8b5a2b,
      accent: 0xb8860b
    }
  },
  shop: {
    type: 'shop',
    name: 'Merchant Shop',
    description: 'A well-stocked trading establishment',
    ambientColor: 0xf5f5dc,
    lightIntensity: 0.85,
    fogColor: 0x2a2a2a,
    fogDensity: 0.015,
    materialOverrides: {
      walls: 0xd2b48c,
      floor: 0x654321,
      furniture: 0x8b4513,
      accent: 0xc0c0c0
    }
  }
};

export interface LoadedInterior {
  scene: THREE.Group;
  type: HomeType;
  theme: HomeInteriorTheme;
  bounds: THREE.Box3;
  entryPoint: THREE.Vector3;
}

export class HomeInteriorManager {
  private loader: GLTFLoader;
  private baseInteriorScene: THREE.Group | null = null;
  private loadedInteriors: Map<string, LoadedInterior> = new Map();
  private isLoading: boolean = false;
  
  constructor() {
    this.loader = new GLTFLoader();
  }
  
  async loadBaseInterior(): Promise<void> {
    if (this.baseInteriorScene || this.isLoading) return;
    
    this.isLoading = true;
    
    try {
      const gltf = await this.loader.loadAsync('/models/buildings/house_interiors_1768396262279.glb');
      this.baseInteriorScene = gltf.scene;
      
      this.baseInteriorScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      console.log('Loaded base interior scene with', this.baseInteriorScene.children.length, 'children');
    } catch (error) {
      console.error('Failed to load house interiors:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  async createThemedInterior(homeType: HomeType, instanceId: string): Promise<LoadedInterior | null> {
    await this.loadBaseInterior();
    
    if (!this.baseInteriorScene) {
      console.error('Base interior not loaded');
      return null;
    }
    
    const theme = homeInteriorThemes[homeType];
    const interiorClone = this.baseInteriorScene.clone(true);
    
    this.applyTheme(interiorClone, theme);
    
    const bounds = new THREE.Box3().setFromObject(interiorClone);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    
    const entryPoint = new THREE.Vector3(
      center.x,
      bounds.min.y + 0.1,
      bounds.max.z - 1
    );
    
    const loadedInterior: LoadedInterior = {
      scene: interiorClone,
      type: homeType,
      theme,
      bounds,
      entryPoint
    };
    
    this.loadedInteriors.set(instanceId, loadedInterior);
    
    return loadedInterior;
  }
  
  private applyTheme(scene: THREE.Group, theme: HomeInteriorTheme): void {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      
      const material = child.material as THREE.MeshStandardMaterial;
      if (!material || !material.isMeshStandardMaterial) return;
      
      const name = child.name.toLowerCase();
      const newMaterial = material.clone();
      
      if (name.includes('wall') || name.includes('plaster')) {
        if (theme.materialOverrides.walls) {
          newMaterial.color.setHex(theme.materialOverrides.walls);
        }
      } else if (name.includes('floor') || name.includes('ground') || name.includes('wood')) {
        if (theme.materialOverrides.floor) {
          newMaterial.color.setHex(theme.materialOverrides.floor);
        }
      } else if (name.includes('ceiling') || name.includes('roof')) {
        if (theme.materialOverrides.ceiling) {
          newMaterial.color.setHex(theme.materialOverrides.ceiling);
        }
      } else if (name.includes('furniture') || name.includes('table') || name.includes('chair') || name.includes('bed')) {
        if (theme.materialOverrides.furniture) {
          const furnitureColor = new THREE.Color(theme.materialOverrides.furniture);
          newMaterial.color.lerp(furnitureColor, 0.6);
        }
      } else if (name.includes('trim') || name.includes('accent') || name.includes('frame')) {
        if (theme.materialOverrides.accent) {
          newMaterial.color.setHex(theme.materialOverrides.accent);
        }
      }
      
      child.material = newMaterial;
    });
  }
  
  getInterior(instanceId: string): LoadedInterior | undefined {
    return this.loadedInteriors.get(instanceId);
  }
  
  removeInterior(instanceId: string): void {
    const interior = this.loadedInteriors.get(instanceId);
    if (interior) {
      interior.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this.loadedInteriors.delete(instanceId);
    }
  }
  
  createInteriorLighting(theme: HomeInteriorTheme): THREE.Group {
    const lightGroup = new THREE.Group();
    
    const ambient = new THREE.AmbientLight(theme.ambientColor, theme.lightIntensity * 0.4);
    lightGroup.add(ambient);
    
    const mainLight = new THREE.PointLight(0xffa500, theme.lightIntensity, 15, 2);
    mainLight.position.set(0, 3, 0);
    mainLight.castShadow = true;
    lightGroup.add(mainLight);
    
    const fillLight = new THREE.PointLight(0xffe4c4, theme.lightIntensity * 0.3, 10, 2);
    fillLight.position.set(3, 2, 3);
    lightGroup.add(fillLight);
    
    const fillLight2 = new THREE.PointLight(0xffe4c4, theme.lightIntensity * 0.3, 10, 2);
    fillLight2.position.set(-3, 2, -3);
    lightGroup.add(fillLight2);
    
    return lightGroup;
  }
  
  dispose(): void {
    const ids = Array.from(this.loadedInteriors.keys());
    for (const id of ids) {
      this.removeInterior(id);
    }
    this.baseInteriorScene = null;
  }
}

export const homeInteriorManager = new HomeInteriorManager();
