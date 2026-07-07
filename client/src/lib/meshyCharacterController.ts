import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LocomotionState {
  moveX: number;
  moveY: number;
  isRunning: boolean;
  turnAmount: number;
}

export interface AnimationClips {
  idle?: THREE.AnimationClip;
  walk?: THREE.AnimationClip;
  run?: THREE.AnimationClip;
  turnLeft?: THREE.AnimationClip;
  turnRight?: THREE.AnimationClip;
  walkLeft?: THREE.AnimationClip;
  walkRight?: THREE.AnimationClip;
  walkBack?: THREE.AnimationClip;
}

export class MeshyCharacterController {
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips: AnimationClips = {};
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentState: string = 'idle';
  private blendTime: number = 0.2;
  private loaded: boolean = false;
  private targetRotation: number = 0;
  private currentRotation: number = 0;
  private turnSpeed: number = 8;
  private moveSpeed: number = 1.5;  // Slower for small character on deck
  private walkAnimationSpeed: number = 1.5;  // Speed walk animation was designed for
  private runAnimationSpeed: number = 2.25;  // Speed run animation was designed for
  private position: THREE.Vector3 = new THREE.Vector3();
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private characterScale: number = 0.35;  // Small captain on deck

  async load(): Promise<THREE.Group | null> {
    const loader = new GLTFLoader();
    
    try {
      const [characterGltf, animationsGltf] = await Promise.all([
        loader.loadAsync('/models/characters/meshy_character.glb'),
        loader.loadAsync('/models/characters/meshy_animations.glb')
      ]);

      this.model = characterGltf.scene;
      this.model.scale.setScalar(this.characterScale);
      
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.mixer = new THREE.AnimationMixer(this.model);
      
      const allClips = [...characterGltf.animations, ...animationsGltf.animations];
      console.log('Meshy character animations:', allClips.map(c => c.name));
      
      this.parseAnimationClips(allClips);
      this.setupActions();
      
      if (this.actions.has('idle')) {
        this.currentAction = this.actions.get('idle')!;
        this.currentAction.play();
      }
      
      this.loaded = true;
      return this.model;
    } catch (error) {
      console.error('Failed to load Meshy character:', error);
      return null;
    }
  }

  private parseAnimationClips(clips: THREE.AnimationClip[]) {
    console.log('Meshy character animations:', clips.map(c => c.name));
    
    for (const clip of clips) {
      const name = clip.name.toLowerCase();
      
      if (name.includes('idle') || name.includes('stand') || name === 'jumping_jacks') {
        if (!this.clips.idle) this.clips.idle = clip;
      } else if (name.includes('running') || name.includes('run') || name.includes('sprint')) {
        if (!this.clips.run) this.clips.run = clip;
      } else if (name.includes('walking') || name.includes('walk')) {
        if (name.includes('left')) {
          this.clips.walkLeft = clip;
        } else if (name.includes('right')) {
          this.clips.walkRight = clip;
        } else if (name.includes('back')) {
          this.clips.walkBack = clip;
        } else if (!this.clips.walk) {
          this.clips.walk = clip;
        }
      } else if (name.includes('turn') && name.includes('left')) {
        this.clips.turnLeft = clip;
      } else if (name.includes('turn') && name.includes('right')) {
        this.clips.turnRight = clip;
      }
    }
    
    if (!this.clips.idle && clips.length > 0) {
      const fallback = clips.find(c => 
        c.name.toLowerCase().includes('guard') || 
        c.name.toLowerCase().includes('jump_rope')
      );
      this.clips.idle = fallback || clips[0];
    }
    if (!this.clips.walk && this.clips.run) {
      this.clips.walk = this.clips.run;
    }
    if (!this.clips.run && this.clips.walk) {
      this.clips.run = this.clips.walk;
    }
  }

  private setupActions() {
    if (!this.mixer) return;
    
    const clipEntries = Object.entries(this.clips) as [string, THREE.AnimationClip | undefined][];
    for (const [name, clip] of clipEntries) {
      if (clip) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        this.actions.set(name, action);
      }
    }
  }

  private crossFadeTo(newState: string) {
    if (newState === this.currentState) return;
    if (!this.actions.has(newState)) return;
    
    const newAction = this.actions.get(newState)!;
    
    if (this.currentAction) {
      newAction.reset();
      newAction.setEffectiveTimeScale(1);
      newAction.setEffectiveWeight(1);
      newAction.crossFadeFrom(this.currentAction, this.blendTime, true);
    }
    
    newAction.play();
    this.currentAction = newAction;
    this.currentState = newState;
  }

  update(delta: number, input: LocomotionState) {
    if (!this.loaded || !this.mixer || !this.model) return;
    
    const moveLength = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
    const isMoving = moveLength > 0.1;
    
    if (isMoving) {
      this.targetRotation = Math.atan2(-input.moveX, -input.moveY);
    }
    
    let rotationDiff = this.targetRotation - this.currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    
    const turnAmount = Math.abs(rotationDiff);
    const isTurning = turnAmount > 0.1;
    
    this.currentRotation += rotationDiff * Math.min(1, delta * this.turnSpeed);
    this.model.rotation.y = this.currentRotation;
    
    let targetState = 'idle';
    
    if (isMoving) {
      if (input.isRunning && moveLength > 0.5) {
        targetState = 'run';
      } else {
        targetState = 'walk';
      }
      
      if (isTurning && turnAmount > 0.5) {
        if (rotationDiff > 0 && this.actions.has('turnLeft')) {
          targetState = 'turnLeft';
        } else if (rotationDiff < 0 && this.actions.has('turnRight')) {
          targetState = 'turnRight';
        }
      }
      
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.currentRotation);
      
      const speed = input.isRunning ? this.moveSpeed * 1.5 : this.moveSpeed;
      this.velocity.copy(forward).multiplyScalar(moveLength * speed * delta);
      this.position.add(this.velocity);
      
      this.model.position.copy(this.position);
    } else {
      targetState = 'idle';
    }
    
    this.crossFadeTo(targetState);
    
    // Sync animation speed with actual movement speed for proper foot placement
    if (this.currentAction) {
      if (isMoving) {
        const actualSpeed = moveLength * (input.isRunning ? this.moveSpeed * 1.5 : this.moveSpeed);
        const referenceSpeed = input.isRunning ? this.runAnimationSpeed : this.walkAnimationSpeed;
        const timeScale = actualSpeed / referenceSpeed;
        this.currentAction.setEffectiveTimeScale(Math.max(0.5, Math.min(2.0, timeScale)));
      } else {
        // Reset to normal speed for idle
        this.currentAction.setEffectiveTimeScale(1.0);
      }
    }
    
    this.mixer.update(delta);
  }

  setPosition(pos: THREE.Vector3) {
    this.position.copy(pos);
    if (this.model) {
      this.model.position.copy(pos);
    }
  }

  setRotation(rotation: number) {
    this.currentRotation = rotation;
    this.targetRotation = rotation;
    if (this.model) {
      this.model.rotation.y = rotation;
    }
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  getRotation(): number {
    return this.currentRotation;
  }

  getModel(): THREE.Group | null {
    return this.model;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getAnimationNames(): string[] {
    return Array.from(this.actions.keys());
  }

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions.clear();
    this.clips = {};
    this.model = null;
    this.loaded = false;
  }
}
