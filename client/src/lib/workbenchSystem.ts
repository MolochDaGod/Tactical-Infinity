import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PROFESSION_WORKBENCHES, ProfessionWorkbench, ProfessionType } from '@/data/assetManifest';

export interface WorkbenchInstance {
  id: string;
  workbench: ProfessionWorkbench;
  mesh: THREE.Group;
  position: THREE.Vector3;
  rotation: number;
  isActive: boolean;
  animationMixer?: THREE.AnimationMixer;
  fireParticles?: THREE.Points;
}

export interface WorkbenchInteractionState {
  nearestWorkbench: WorkbenchInstance | null;
  activeWorkbench: WorkbenchInstance | null;
  isInRange: boolean;
  holdProgress: number;
  isModalOpen: boolean;
}

export class WorkbenchManager {
  private workbenches: Map<string, WorkbenchInstance> = new Map();
  private loader: GLTFLoader;
  private scene: THREE.Scene;
  private interactionState: WorkbenchInteractionState = {
    nearestWorkbench: null,
    activeWorkbench: null,
    isInRange: false,
    holdProgress: 0,
    isModalOpen: false,
  };
  
  private fKeyHeld: boolean = false;
  private fKeyHoldStart: number = 0;
  private readonly HOLD_DURATION = 1000;
  
  private onInteractionCallback?: (workbench: ProfessionWorkbench, action: 'quick' | 'modal') => void;
  private onStateChangeCallback?: (state: WorkbenchInteractionState) => void;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
  }
  
  async loadWorkbench(
    profession: ProfessionType,
    position: THREE.Vector3,
    rotation: number = 0
  ): Promise<WorkbenchInstance | null> {
    const workbenchDef = PROFESSION_WORKBENCHES.find(w => w.profession === profession);
    if (!workbenchDef) {
      console.warn(`No workbench found for profession: ${profession}`);
      return null;
    }
    
    try {
      const gltf = await new Promise<THREE.Group>((resolve, reject) => {
        this.loader.load(
          workbenchDef.modelPath,
          (gltfData: GLTF) => resolve(gltfData.scene),
          undefined,
          (error: unknown) => reject(error)
        );
      });
      
      const mesh = gltf;
      mesh.scale.setScalar(workbenchDef.scale);
      mesh.position.copy(position);
      mesh.rotation.y = rotation;
      
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      this.scene.add(mesh);
      
      const id = `${workbenchDef.id}_${Date.now()}`;
      const instance: WorkbenchInstance = {
        id,
        workbench: workbenchDef,
        mesh,
        position: position.clone(),
        rotation,
        isActive: workbenchDef.animationType === 'fire',
      };
      
      if (workbenchDef.hasAnimation && workbenchDef.animationType === 'fire') {
        this.createFireEffect(instance);
      }
      
      this.workbenches.set(id, instance);
      console.log(`Loaded workbench: ${workbenchDef.name} at`, position.toArray());
      return instance;
    } catch (error) {
      console.error(`Failed to load workbench model: ${workbenchDef.modelPath}`, error);
      return null;
    }
  }
  
  private createFireEffect(instance: WorkbenchInstance): void {
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = Math.random() * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      
      const heat = Math.random();
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.3 + heat * 0.5;
      colors[i * 3 + 2] = heat * 0.2;
      
      sizes[i] = 0.05 + Math.random() * 0.1;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.position.copy(instance.position);
    particles.position.y += 0.3;
    
    instance.fireParticles = particles;
    if (instance.isActive) {
      this.scene.add(particles);
    }
  }
  
  toggleWorkbenchAnimation(id: string, active: boolean): void {
    const instance = this.workbenches.get(id);
    if (!instance) return;
    
    instance.isActive = active;
    
    if (instance.fireParticles) {
      if (active) {
        if (!instance.fireParticles.parent) {
          this.scene.add(instance.fireParticles);
        }
      } else {
        this.scene.remove(instance.fireParticles);
      }
    }
  }
  
  update(playerPosition: THREE.Vector3, delta: number): void {
    let nearestDist = Infinity;
    let nearestWorkbench: WorkbenchInstance | null = null;
    
    this.workbenches.forEach((instance) => {
      const dist = playerPosition.distanceTo(instance.position);
      if (dist < instance.workbench.interactionRange && dist < nearestDist) {
        nearestDist = dist;
        nearestWorkbench = instance;
      }
      
      if (instance.isActive && instance.fireParticles) {
        this.updateFireParticles(instance.fireParticles, delta);
      }
    });
    
    const wasInRange = this.interactionState.isInRange;
    this.interactionState.nearestWorkbench = nearestWorkbench;
    this.interactionState.isInRange = nearestWorkbench !== null;
    
    if (this.fKeyHeld && nearestWorkbench !== null) {
      const holdTime = Date.now() - this.fKeyHoldStart;
      this.interactionState.holdProgress = Math.min(holdTime / this.HOLD_DURATION, 1);
      
      if (holdTime >= this.HOLD_DURATION && !this.interactionState.isModalOpen) {
        this.interactionState.isModalOpen = true;
        const wb = nearestWorkbench as WorkbenchInstance;
        this.interactionState.activeWorkbench = wb;
        this.onInteractionCallback?.(wb.workbench, 'modal');
      }
    } else {
      this.interactionState.holdProgress = 0;
    }
    
    if (wasInRange !== this.interactionState.isInRange || this.fKeyHeld) {
      this.onStateChangeCallback?.(this.interactionState);
    }
  }
  
  private updateFireParticles(particles: THREE.Points, delta: number): void {
    const positions = particles.geometry.attributes.position.array as Float32Array;
    const count = positions.length / 3;
    
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += delta * (0.5 + Math.random() * 0.5);
      
      if (positions[i * 3 + 1] > 0.8) {
        positions[i * 3] = (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
  }
  
  handleKeyDown(key: string): void {
    if (key.toLowerCase() === 'f') {
      if (!this.fKeyHeld) {
        this.fKeyHeld = true;
        this.fKeyHoldStart = Date.now();
      }
    }
  }
  
  handleKeyUp(key: string): void {
    if (key.toLowerCase() === 'f') {
      if (this.fKeyHeld) {
        const holdTime = Date.now() - this.fKeyHoldStart;
        
        if (holdTime < this.HOLD_DURATION && this.interactionState.nearestWorkbench) {
          this.onInteractionCallback?.(this.interactionState.nearestWorkbench.workbench, 'quick');
        }
        
        this.fKeyHeld = false;
        this.interactionState.holdProgress = 0;
        this.onStateChangeCallback?.(this.interactionState);
      }
    }
  }
  
  closeModal(): void {
    this.interactionState.isModalOpen = false;
    this.interactionState.activeWorkbench = null;
    this.onStateChangeCallback?.(this.interactionState);
  }
  
  onInteraction(callback: (workbench: ProfessionWorkbench, action: 'quick' | 'modal') => void): void {
    this.onInteractionCallback = callback;
  }
  
  onStateChange(callback: (state: WorkbenchInteractionState) => void): void {
    this.onStateChangeCallback = callback;
  }
  
  getInteractionState(): WorkbenchInteractionState {
    return { ...this.interactionState };
  }
  
  getAllWorkbenches(): WorkbenchInstance[] {
    return Array.from(this.workbenches.values());
  }
  
  getWorkbenchById(id: string): WorkbenchInstance | undefined {
    return this.workbenches.get(id);
  }
  
  removeWorkbench(id: string): void {
    const instance = this.workbenches.get(id);
    if (instance) {
      this.scene.remove(instance.mesh);
      if (instance.fireParticles) {
        this.scene.remove(instance.fireParticles);
      }
      this.workbenches.delete(id);
    }
  }
  
  dispose(): void {
    const ids = Array.from(this.workbenches.keys());
    ids.forEach((id) => this.removeWorkbench(id));
  }
}
