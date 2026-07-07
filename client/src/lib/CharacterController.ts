import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { stripRootMotion } from './animation/clipUtils';

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'die' | 'custom';

export interface CharacterControllerConfig {
  modelPath: string;
  /**
   * Optional secondary GLB whose animations are merged onto this character's
   * mixer. Use this when the character mesh ships in T-pose and the clips
   * (idle/walk/run/...) live in a separate file (e.g. `meshy_animations.glb`).
   */
  animationsPath?: string;
  /**
   * If true (default), strip root-bone position tracks from every loaded
   * clip so the character animates "in place". Required when the host scene
   * snaps the character to a heightmap each frame — baked root translation
   * would otherwise fight that snap and produce a sliding/stutter feel.
   */
  stripRootMotion?: boolean;
  scale?: number;
  position?: THREE.Vector3;
  walkSpeed?: number;
  runSpeed?: number;
  rotationSpeed?: number;
  animationMap?: {
    idle?: string | string[];
    walk?: string | string[];
    run?: string | string[];
    jump?: string | string[];
    attack?: string | string[];
    die?: string | string[];
    custom?: string | string[];
  };
  cameraOffset?: THREE.Vector3;
  cameraLookAtOffset?: THREE.Vector3;
  enableShadows?: boolean;
  materialOverride?: THREE.Material;
}

export interface ThirdPersonCameraConfig {
  distance?: number;
  height?: number;
  lookAtHeight?: number;
  smoothness?: number;
  minPitch?: number;
  maxPitch?: number;
}

export class CharacterController {
  public model: THREE.Group | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public currentState: AnimationState = 'idle';
  public position: THREE.Vector3;
  public rotation: number = 0;
  public velocity: THREE.Vector3;
  public isGrounded: boolean = true;
  public isLoaded: boolean = false;

  private scene: THREE.Scene;
  private config: CharacterControllerConfig;
  private animations: Map<string, THREE.AnimationClip> = new Map();
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private previousAction: THREE.AnimationAction | null = null;
  private keys: Set<string> = new Set();
  private clock: THREE.Clock;
  private onLoadCallback?: (controller: CharacterController) => void;

  private walkSpeed: number;
  private runSpeed: number;
  private rotationSpeed: number;
  private isRunning: boolean = false;

  private jumpVelocity: number = 0;
  private jumpSpeed: number = 8;
  private gravity: number = 22;
  private isJumping: boolean = false;
  private groundY: number = 0;
  
  private walkAnimationSpeed: number = 3.2;
  private runAnimationSpeed: number = 6.4;

  constructor(scene: THREE.Scene, config: CharacterControllerConfig) {
    this.scene = scene;
    this.config = config;
    this.position = config.position?.clone() || new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.clock = new THREE.Clock();

    this.walkSpeed = config.walkSpeed ?? 3.2;
    this.runSpeed = config.runSpeed ?? 6.4;
    this.rotationSpeed = config.rotationSpeed ?? 10;

    if (config.modelPath && config.modelPath.length > 0) {
      this.loadModel();
    }
    this.setupInputListeners();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    const stripRoot = this.config.stripRootMotion !== false;

    const charPromise = loader.loadAsync(this.config.modelPath);
    // External animation GLB load is non-fatal: if it fails, we still want
    // the character mesh to appear (even if only T-pose) instead of falling
    // back to the capsule placeholder.
    const animPromise: Promise<{ animations: THREE.AnimationClip[] } | null> =
      this.config.animationsPath
        ? loader.loadAsync(this.config.animationsPath).catch((err) => {
            console.warn(
              `[CharacterController] Failed to load animations from ${this.config.animationsPath}:`,
              err,
            );
            return null;
          })
        : Promise.resolve(null);

    Promise.all([charPromise, animPromise])
      .then(([gltf, animGltf]) => {
        this.model = gltf.scene;
        const scale = this.config.scale ?? 1;
        this.model.scale.set(scale, scale, scale);
        this.model.position.copy(this.position);

        if (this.config.enableShadows !== false) {
          this.model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              if (this.config.materialOverride) {
                mesh.material = this.config.materialOverride.clone();
              }
            }
          });
        }

        this.scene.add(this.model);

        const allClips: THREE.AnimationClip[] = [
          ...(gltf.animations ?? []),
          ...((animGltf?.animations) ?? []),
        ];

        if (allClips.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);

          console.log('Character loaded with animations:', allClips.map(a => a.name));

          allClips.forEach((rawClip) => {
            const clip = stripRoot ? stripRootMotion(rawClip) : rawClip;
            this.animations.set(rawClip.name.toLowerCase(), clip);
            const action = this.mixer!.clipAction(clip);
            this.actions.set(rawClip.name.toLowerCase(), action);
          });

          const idleAction = this.findAndPlayAnimation('idle');
          if (idleAction) {
            this.currentAction = idleAction;
            this.currentState = 'idle';
            idleAction.reset();
            idleAction.setLoop(THREE.LoopRepeat, Infinity);
            idleAction.play();
          }
        }

        this.isLoaded = true;
        this.clock.start();

        if (this.onLoadCallback) {
          this.onLoadCallback(this);
        }
      })
      .catch((error) => {
        console.error('Failed to load character model:', error);
        this.createFallbackModel();
      });
  }

  private createFallbackModel(): void {
    const group = new THREE.Group();
    
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a7c59,
      roughness: 0.7,
      metalness: 0.2 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x6b8e23,
      roughness: 0.6 
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    const scale = this.config.scale ?? 1;
    group.scale.set(scale, scale, scale);
    group.position.copy(this.position);
    
    this.model = group;
    this.scene.add(this.model);
    this.isLoaded = true;
    this.clock.start();

    if (this.onLoadCallback) {
      this.onLoadCallback(this);
    }
  }

  private findAndPlayAnimation(state: AnimationState): THREE.AnimationAction | null {
    const animMap = this.config.animationMap;
    let animNames: string[] = [];

    if (animMap) {
      const stateKey = state as keyof typeof animMap;
      const mapped = animMap[stateKey];
      if (mapped) {
        animNames = Array.isArray(mapped) ? mapped : [mapped];
      }
    }

    const defaultPatterns: Record<AnimationState, string[]> = {
      idle: ['idle', 'stand', 'breathing', 'rest'],
      walk: ['walk', 'walking', 'move'],
      run: ['run', 'running', 'sprint', 'fast'],
      jump: ['jump', 'jumping', 'leap'],
      attack: ['attack', 'hit', 'punch', 'slash', 'strike', 'intimidate'],
      die: ['die', 'death', 'dead', 'fall'],
      custom: []
    };

    animNames = [...animNames, ...defaultPatterns[state]];

    for (const name of animNames) {
      const entries = Array.from(this.actions.entries());
      for (const [animKey, action] of entries) {
        if (animKey.includes(name.toLowerCase())) {
          return action;
        }
      }
    }

    if (this.actions.size > 0) {
      const firstAction = Array.from(this.actions.values())[0];
      return firstAction || null;
    }

    return null;
  }

  public playAnimation(state: AnimationState, transitionDuration: number = 0.3): void {
    if (!this.mixer) return;

    const newAction = this.findAndPlayAnimation(state);
    if (!newAction) return;

    if (this.currentAction === newAction) return;

    this.previousAction = this.currentAction;
    this.currentAction = newAction;
    this.currentState = state;

    if (this.previousAction) {
      this.previousAction.fadeOut(transitionDuration);
    }

    newAction.reset();
    newAction.setLoop(THREE.LoopRepeat, Infinity);
    newAction.fadeIn(transitionDuration);
    newAction.play();
  }

  public playAnimationOnce(state: AnimationState, transitionDuration: number = 0.2): void {
    if (!this.mixer) return;

    const newAction = this.findAndPlayAnimation(state);
    if (!newAction) return;

    this.previousAction = this.currentAction;
    this.currentAction = newAction;
    this.currentState = state;

    if (this.previousAction) {
      this.previousAction.fadeOut(transitionDuration);
    }

    newAction.reset();
    newAction.setLoop(THREE.LoopOnce, 1);
    newAction.clampWhenFinished = true;
    newAction.fadeIn(transitionDuration);
    newAction.play();

    const onFinished = () => {
      this.mixer?.removeEventListener('finished', onFinished);
      this.playAnimation('idle');
    };
    this.mixer.addEventListener('finished', onFinished);
  }

  private setupInputListeners(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Shift') {
        this.isRunning = true;
      }
      if (e.key === ' ' && this.isGrounded && !this.isJumping) {
        this.isJumping = true;
        this.isGrounded = false;
        this.jumpVelocity = this.jumpSpeed;
        this.playAnimationOnce('jump', 0.15);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase());
      if (e.key === 'Shift') {
        this.isRunning = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    this.cleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }

  private cleanup: () => void = () => {};

  public update(delta: number, cameraAngle: number): void {
    if (!this.isLoaded) return;

    if (this.mixer) {
      this.mixer.update(delta);
    }

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);
    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

    const moveDirection = new THREE.Vector3();
    let isMoving = false;

    if (this.keys.has('w') || this.keys.has('arrowup')) {
      moveDirection.add(forward);
      isMoving = true;
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      moveDirection.sub(forward);
      isMoving = true;
    }
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      moveDirection.sub(right);
      isMoving = true;
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      moveDirection.add(right);
      isMoving = true;
    }

    if (isMoving && moveDirection.length() > 0) {
      moveDirection.normalize();
      
      const speed = this.isRunning ? this.runSpeed : this.walkSpeed;
      this.velocity.copy(moveDirection.multiplyScalar(speed * delta));
      this.position.add(this.velocity);

      const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
      const rotationDiff = targetRotation - this.rotation;
      let adjustedDiff = rotationDiff;
      
      if (adjustedDiff > Math.PI) adjustedDiff -= Math.PI * 2;
      if (adjustedDiff < -Math.PI) adjustedDiff += Math.PI * 2;
      
      this.rotation += adjustedDiff * Math.min(1, this.rotationSpeed * delta);

      if (!this.isJumping) {
        const targetState: AnimationState = this.isRunning ? 'run' : 'walk';
        if (this.currentState !== targetState) {
          this.playAnimation(targetState, 0.2);
        }
      }
      
      if (this.currentAction && !this.isJumping) {
        const referenceSpeed = this.isRunning ? this.runAnimationSpeed : this.walkAnimationSpeed;
        const timeScale = speed / referenceSpeed;
        this.currentAction.setEffectiveTimeScale(Math.max(0.5, Math.min(2.0, timeScale)));
      }
    } else {
      this.velocity.set(0, 0, 0);
      
      if (this.currentState !== 'idle' && this.currentState !== 'attack' && !this.isJumping) {
        this.playAnimation('idle', 0.3);
        if (this.currentAction) {
          this.currentAction.setEffectiveTimeScale(1.0);
        }
      }
    }

    if (this.isJumping) {
      this.jumpVelocity -= this.gravity * delta;
      this.position.y += this.jumpVelocity * delta;
      if (this.position.y <= this.groundY) {
        this.position.y = this.groundY;
        this.isJumping = false;
        this.isGrounded = true;
        this.jumpVelocity = 0;
      }
    }

    if (this.model) {
      this.model.position.copy(this.position);
      this.model.rotation.y = this.rotation;
    }
  }

  public setGroundY(y: number): void {
    this.groundY = y;
    if (!this.isJumping) {
      this.position.y = y;
    }
  }

  public setPosition(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.groundY = pos.y;
    if (this.model) {
      this.model.position.copy(pos);
    }
  }

  public setRotation(angle: number): void {
    this.rotation = angle;
    if (this.model) {
      this.model.rotation.y = angle;
    }
  }

  public onLoad(callback: (controller: CharacterController) => void): void {
    this.onLoadCallback = callback;
    if (this.isLoaded) {
      callback(this);
    }
  }

  public isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  public getAvailableAnimations(): string[] {
    return Array.from(this.animations.keys());
  }

  public dispose(): void {
    this.cleanup();
    
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    }

    this.animations.clear();
    this.actions.clear();
    this.mixer = null;
    this.model = null;
  }
}

/**
 * ThirdPersonCamera — thin back-compat wrapper around the unified FollowCamera.
 *
 * The actual camera math lives in `client/src/lib/camera/FollowCamera.ts`
 * (replaces the captain/island/battle ad-hoc cams with one shared rig).
 * This class is preserved purely so existing imports and the `.angle` /
 * `.pitch` / `.update(dt, vec3)` API of CharacterController callers keep
 * compiling. New code should construct FollowCamera directly.
 */
export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  /** Underlying shared camera rig. */
  public readonly rig: import('./camera/FollowCamera').FollowCamera;

  constructor(
    camera: THREE.PerspectiveCamera,
    config: ThirdPersonCameraConfig = {}
  ) {
    this.camera = camera;
    // Lazy-require to avoid touching circular import order at module load.
    // (FollowCamera has no project deps so this is just an ESM import.)
    const { FollowCamera } = require('./camera/FollowCamera') as typeof import('./camera/FollowCamera');
    this.rig = new FollowCamera(camera, {
      distance: config.distance ?? 8,
      lookAtHeight: config.lookAtHeight ?? 1,
      smoothness: config.smoothness ?? 0.08,
      minPitch: config.minPitch ?? -0.5,
      maxPitch: config.maxPitch ?? 1.2,
      // The old config had `height: 4` which got blended into the height
      // formula `height + sin(pitch) * distance * 0.5`. FollowCamera folds
      // that vertical offset into `lookAtHeight` + the natural pitch arc, so
      // we map the legacy `height` onto lookAtHeight when the caller didn't
      // explicitly override lookAtHeight.
      ...(config.lookAtHeight === undefined && config.height !== undefined
        ? { lookAtHeight: config.height * 0.5 }
        : {}),
    });
  }

  public get angle(): number { return this.rig.yaw; }
  public set angle(v: number) { this.rig.yaw = v; }
  public get pitch(): number { return this.rig.pitch; }
  public set pitch(v: number) { this.rig.pitch = v; }

  public update(delta: number, targetPosition: THREE.Vector3): void {
    this.rig.update(delta, targetPosition);
  }

  public dispose(): void {
    this.rig.dispose();
  }
}

export function createCharacterController(
  scene: THREE.Scene,
  config: CharacterControllerConfig
): CharacterController {
  return new CharacterController(scene, config);
}

export function createThirdPersonCamera(
  camera: THREE.PerspectiveCamera,
  config?: ThirdPersonCameraConfig
): ThirdPersonCamera {
  return new ThirdPersonCamera(camera, config);
}
