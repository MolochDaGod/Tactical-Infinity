/**
 * SketchbookIslandController — faithful port of swift502/Sketchbook 0.3 character controller.
 *
 * Architecture matches the original:
 *   • Cannon.js capsule (3-sphere compound body) for physics
 *   • VectorSpringSimulator drives velocity toward arcadeVelocityTarget
 *   • RelativeSpringSimulator drives orientation smoothly
 *   • springMovement() + springRotation() + rotateModel() per frame
 *   • setArcadeVelocityTarget(speed) used by states
 *   • setCameraRelativeOrientationTarget() uses camera yaw + WASD
 *   • Ground detection: Cannon.js raycasting downward from capsule centre
 *   • State machine: Idle → Walk → Sprint → JumpIdle → Falling
 *   • CameraOperator: theta/phi spherical orbit matching Sketchbook
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
// @ts-ignore
import * as CANNON from 'cannon-es';
import {
  VectorSpringSimulator,
  RelativeSpringSimulator,
} from './SketchbookSpringMath';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SketchbookIslandConfig {
  moveSpeed:   number;   // base move speed in m/s (walk target = speed * 0.8)
  jumpForce:   number;
  mass:        number;
  capsuleRadius: number;
  capsuleHeight: number;

  // Spring damping/mass (Sketchbook defaults: vel damping 0.8, mass 50)
  velSimMass:     number;
  velSimDamping:  number;
  rotSimMass:     number;
  rotSimDamping:  number;

  // Camera (theta/phi spherical, matching Sketchbook CameraOperator)
  cameraRadius:   number;
  cameraSensX:    number;
  cameraSensY:    number;
  cameraMinPhi:   number;
  cameraMaxPhi:   number;

  // Terrain raycasting
  rayCastLength:  number;   // 0.57 in original
  raySafeOffset:  number;   // 0.03

  modelScale:     number;
  spawnY:         number;
}

export const DEFAULT_SKETCHBOOK_CONFIG: SketchbookIslandConfig = {
  moveSpeed:    4.0,
  jumpForce:    8.0,
  mass:         70,
  capsuleRadius: 0.30,
  capsuleHeight: 0.50,

  velSimMass:    50,
  velSimDamping: 0.8,
  rotSimMass:    10,
  rotSimDamping: 0.5,

  cameraRadius:  4.5,
  cameraSensX:   0.3,
  cameraSensY:   0.3,
  cameraMinPhi:  -35,
  cameraMaxPhi:  75,

  rayCastLength: 2.50,
  raySafeOffset: 0.03,

  modelScale: 0.013,
  spawnY:     0,
};

// ─── State names ──────────────────────────────────────────────────────────────

export type IslandCharacterState =
  | 'idle' | 'walk' | 'sprint'
  | 'jumpIdle' | 'jumpRunning' | 'falling'
  | 'dropIdle' | 'land';

// ─── Mixamo animation paths ───────────────────────────────────────────────────

const MODEL_PATH = '/models/player/Meshy_AI_Orc_Warlord_Render_1220104017_texture_fbx.fbx';
const ANIM_PATHS: Record<string, string> = {
  idle:        '/models/player/sword and shield idle.fbx',
  walk:        '/models/player/sword and shield walk.fbx',
  sprint:      '/models/player/sword and shield run.fbx',
  run:         '/models/player/sword and shield run (2).fbx',
  jump_idle:   '/models/player/sword and shield jump.fbx',
  jump_run:    '/models/player/sword and shield jump (2).fbx',
  falling:     '/models/player/sword and shield jump (2).fbx',
  drop_idle:   '/models/player/sword and shield crouch.fbx',
};

// Max dt to consume per frame — prevents physics explosion after tab switch (frame skip)
const MAX_FRAME_DT = 1 / 20; // 50 ms — skip rather than simulate a huge gap

// ─── Main class ───────────────────────────────────────────────────────────────

export class SketchbookIslandController {
  public config: SketchbookIslandConfig;
  public isLoaded = false;
  public state: IslandCharacterState = 'idle';

  /** Multiplier applied to dt each frame. 0.5 = half speed, 2.0 = double speed. */
  public timeScale = 1.0;

  // Three.js scene objects
  public tiltContainer: THREE.Group   = new THREE.Group();
  public modelContainer: THREE.Group  = new THREE.Group();
  public model: THREE.Group | null    = null;
  public mixer: THREE.AnimationMixer | null = null;
  public animations: THREE.AnimationClip[] = [];

  // Velocity / orientation (Sketchbook naming)
  public velocity:       THREE.Vector3 = new THREE.Vector3();
  public acceleration:   THREE.Vector3 = new THREE.Vector3();
  public velocityTarget: THREE.Vector3 = new THREE.Vector3();
  public orientation:    THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  public orientationTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  public arcadeVelocityIsAdditive = false;
  private arcadeVelocityInfluence: THREE.Vector3 = new THREE.Vector3(1, 0, 1);

  // Spring simulators (faithful Sketchbook instances)
  public velocitySimulator: VectorSpringSimulator;
  public rotationSimulator: RelativeSpringSimulator;

  // Physics
  private physicsWorld!: any;   // CANNON.World
  private capsuleBody!:  any;   // CANNON.Body
  private terrainBody:   any   = null;  // CANNON.Body (heightfield) — set after load
  private propBodies = new Map<string, any>();  // static prop colliders (trees/rocks/buildings)

  // Ground detection
  public rayHasHit   = false;
  public isGrounded  = false;
  private rayRaycaster = new THREE.Raycaster();
  private terrainMeshes: THREE.Mesh[] = [];

  // Jump state
  public wantsToJump   = false;
  private alreadyJumped = false;

  // Position (kept in sync with physics body)
  public position: THREE.Vector3 = new THREE.Vector3();

  // Camera (Sketchbook CameraOperator style: theta/phi spherical)
  public cameraTheta = 0;    // horizontal orbit angle (degrees)
  public cameraPhi   = 20;   // vertical orbit angle (degrees)
  private cameraRadius: number;
  public cameraPos    = new THREE.Vector3();
  public cameraTarget = new THREE.Vector3();

  // Input (matches Sketchbook KeyBinding style)
  public actions = {
    up:    { isPressed: false, justPressed: false, justReleased: false },
    down:  { isPressed: false, justPressed: false, justReleased: false },
    left:  { isPressed: false, justPressed: false, justReleased: false },
    right: { isPressed: false, justPressed: false, justReleased: false },
    run:   { isPressed: false, justPressed: false, justReleased: false },
    jump:  { isPressed: false, justPressed: false, justReleased: false },
  };

  // Mouse drag state (for CameraOperator)
  private isDragging   = false;
  private prevMousePos = new THREE.Vector2();
  private isPointerLocked = false;
  private mouseDelta = { x: 0, y: 0 };

  // Animation
  private currentAction: THREE.AnimationAction | null = null;
  private actionMap = new Map<string, THREE.AnimationAction>();
  private stateTimer = 0;

  // Cleanup
  private _container:   HTMLElement | null = null;
  private _keyDown:     ((e: KeyboardEvent) => void) | null = null;
  private _keyUp:       ((e: KeyboardEvent) => void) | null = null;
  private _mouseDown:   ((e: MouseEvent) => void) | null = null;
  private _mouseUp:     ((e: MouseEvent) => void) | null = null;
  private _mouseMove:   ((e: MouseEvent) => void) | null = null;
  private _plChange:    (() => void) | null = null;
  private _onLoaded?:   () => void;
  private _onProgress?: (pct: number) => void;
  private _onStateChange?: (s: IslandCharacterState) => void;

  constructor(cfg: Partial<SketchbookIslandConfig> = {}) {
    this.config = { ...DEFAULT_SKETCHBOOK_CONFIG, ...cfg };
    this.cameraRadius = this.config.cameraRadius;

    // Spring simulators — fps=60, mass, damping matching Sketchbook defaults
    this.velocitySimulator = new VectorSpringSimulator(60, this.config.velSimMass, this.config.velSimDamping);
    this.rotationSimulator = new RelativeSpringSimulator(60, this.config.rotSimMass, this.config.rotSimDamping);

    // Build the Three.js node hierarchy (Sketchbook: tiltContainer > modelContainer > model)
    this.tiltContainer.add(this.modelContainer);
    this.position.set(0, this.config.spawnY, 0);

    this._initPhysics();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  onLoaded(cb: () => void): this         { this._onLoaded = cb; return this; }
  onProgress(cb: (p: number) => void): this { this._onProgress = cb; return this; }
  onStateChange(cb: (s: IslandCharacterState) => void): this { this._onStateChange = cb; return this; }

  setTerrainMeshes(meshes: THREE.Mesh[]): void { this.terrainMeshes = meshes; }

  /**
   * Supply heightmap data to build a real CANNON.Heightfield terrain body.
   * Call after the terrain has been generated, before the update loop starts.
   * @param matrix  2-D array [xi][zi] = height (from buildHeightfieldData)
   * @param elementSize  world-space cell size (radius*2 / segments)
   * @param originX  world X of matrix corner (usually -radius)
   * @param originZ  world Z of matrix corner (usually -radius)
   */
  setHeightfieldTerrain(
    matrix: number[][],
    elementSize: number,
    originX: number,
    originZ: number
  ): void {
    // Remove the old flat ground plane (first static body added in _initPhysics)
    if (this.terrainBody) {
      this.physicsWorld.remove(this.terrainBody);
    }

    const shape = new CANNON.Heightfield(matrix, { elementSize });
    const body  = new CANNON.Body({ mass: 0 });
    body.addShape(shape, new CANNON.Vec3(originX, 0, originZ));
    // Rotate 180° around Y so CANNON grid aligns with Three.js grid orientation
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);

    this.terrainBody = body;
    this.physicsWorld.addBody(body);
  }

  setSpawnPosition(pos: THREE.Vector3): void {
    // Long downward raycast to find the actual terrain surface — protects against
    // spawn markers that are slightly off the terrain mesh, which previously caused
    // the player to free-fall forever (rayCastLength is only ~0.6 in normal updates).
    let groundY = pos.y;
    if (this.terrainMeshes.length > 0) {
      const probe = new THREE.Raycaster(
        new THREE.Vector3(pos.x, pos.y + 50, pos.z),
        new THREE.Vector3(0, -1, 0),
        0,
        200,
      );
      const hits = probe.intersectObjects(this.terrainMeshes, true);
      if (hits.length > 0) groundY = hits[0].point.y;
    }
    const safePos = new THREE.Vector3(pos.x, groundY + 0.05, pos.z);
    this.position.copy(safePos);
    this.tiltContainer.position.copy(safePos);
    this.capsuleBody.position.set(
      safePos.x,
      safePos.y + this.config.capsuleHeight * 0.5 + this.config.capsuleRadius,
      safePos.z,
    );
    this.capsuleBody.velocity.set(0, 0, 0);
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  async load(scene: THREE.Scene): Promise<void> {
    scene.add(this.tiltContainer);
    const loader = new FBXLoader();

    const fbx = await this._loadFBX(loader, MODEL_PATH);
    fbx.scale.setScalar(this.config.modelScale);
    fbx.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        (c as THREE.Mesh).castShadow = true;
        (c as THREE.Mesh).receiveShadow = true;
      }
    });
    this.model = fbx;
    this.mixer = new THREE.AnimationMixer(fbx);
    this.modelContainer.add(fbx);

    const animKeys = Object.keys(ANIM_PATHS);
    let loaded = 0;
    for (const [key, path] of Object.entries(ANIM_PATHS)) {
      try {
        const animFbx = await this._loadFBX(loader, path);
        if (animFbx.animations.length > 0) {
          const clip = animFbx.animations[0];
          clip.name  = key;
          const act  = this.mixer.clipAction(clip);
          const loop = !key.includes('jump') && key !== 'drop_idle' && key !== 'land';
          act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          if (!loop) act.clampWhenFinished = true;
          this.actionMap.set(key, act);
        }
      } catch (_) { /* non-fatal */ }
      loaded++;
      this._onProgress?.(loaded / animKeys.length);
    }

    this.mixer.addEventListener('finished', (e: any) => {
      const name = e.action.getClip().name;
      if (name === 'drop_idle' || name === 'jump_idle') this._setState('idle');
    });

    this.tiltContainer.position.copy(this.position);
    this._playAnimation('idle', 0.01);
    this.isLoaded = true;
    this._onLoaded?.();
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  setupInput(container: HTMLElement): void {
    this._container = container;

    this._keyDown = (e) => this._onKeyDown(e);
    this._keyUp   = (e) => this._onKeyUp(e);
    this._mouseDown = (e) => {
      if (e.button === 2) { this.isDragging = true; this.prevMousePos.set(e.clientX, e.clientY); }
      else if (!this.isPointerLocked) container.requestPointerLock();
    };
    this._mouseUp   = (e) => { if (e.button === 2) this.isDragging = false; };
    this._mouseMove = (e) => {
      if (this.isPointerLocked) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      } else if (this.isDragging) {
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.prevMousePos.set(e.clientX, e.clientY);
        this._moveCamera(dx, dy);
      }
    };
    this._plChange = () => {
      this.isPointerLocked = document.pointerLockElement === container;
    };

    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup',   this._keyUp);
    container.addEventListener('mousedown', this._mouseDown);
    window.addEventListener('mouseup',  this._mouseUp);
    document.addEventListener('mousemove', this._mouseMove);
    document.addEventListener('pointerlockchange', this._plChange);
  }

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'KeyW') this._press('up');
    if (e.code === 'KeyS') this._press('down');
    if (e.code === 'KeyA') this._press('left');
    if (e.code === 'KeyD') this._press('right');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this._press('run');
    if (e.code === 'Space') { this._press('jump'); this.wantsToJump = true; }
  }

  private _onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'KeyW') this._release('up');
    if (e.code === 'KeyS') this._release('down');
    if (e.code === 'KeyA') this._release('left');
    if (e.code === 'KeyD') this._release('right');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this._release('run');
    if (e.code === 'Space') { this._release('jump'); this.wantsToJump = false; }
  }

  private _press(k: keyof typeof this.actions): void {
    if (!this.actions[k].isPressed) this.actions[k].justPressed = true;
    this.actions[k].isPressed = true;
  }
  private _release(k: keyof typeof this.actions): void {
    if (this.actions[k].isPressed) this.actions[k].justReleased = true;
    this.actions[k].isPressed = false;
  }

  // ── Main Update (called every frame) ─────────────────────────────────────

  /** Change world + animation speed. 1.0 = normal, 0.5 = slow-mo, 2.0 = fast. */
  setTimeScale(ts: number): void { this.timeScale = Math.max(0, ts); }

  update(dt: number): void {
    if (!this.isLoaded) return;
    // Frame-skip guard: clamp to MAX_FRAME_DT before scaling so a tab-switch
    // doesn't explode physics; then apply timeScale for slow/fast motion.
    dt = Math.min(dt, MAX_FRAME_DT) * this.timeScale;

    // Camera rotation from pointer lock delta
    if (this.isPointerLocked) {
      this._moveCamera(this.mouseDelta.x, this.mouseDelta.y);
    }
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    // Step physics world
    this.physicsWorld.step(1 / 60, dt, 3);

    // Sync position from physics
    this.position.set(
      this.capsuleBody.interpolatedPosition.x,
      this.capsuleBody.interpolatedPosition.y - this.config.capsuleHeight * 0.5 - this.config.capsuleRadius,
      this.capsuleBody.interpolatedPosition.z
    );

    // Ground detection (Three.js raycast for precise terrain)
    this._updateGroundDetection();

    // Run state machine
    this._updateState(dt);

    // Sketchbook core: springMovement → springRotation → rotateModel
    this._springMovement(dt);
    this._springRotation(dt);
    this._rotateModel();

    // Apply final position to Three.js hierarchy
    this.tiltContainer.position.copy(this.position);

    // Camera orbit
    this._updateCamera();

    // Mixer
    this.mixer?.update(dt);
    this.stateTimer += dt;

    // Clear justPressed / justReleased flags after one frame
    for (const key of Object.keys(this.actions) as Array<keyof typeof this.actions>) {
      this.actions[key].justPressed  = false;
      this.actions[key].justReleased = false;
    }
  }

  applyCamera(camera: THREE.Camera): void {
    camera.position.copy(this.cameraPos);
    camera.lookAt(this.cameraTarget);
  }

  // ── Sketchbook API (called by states) ────────────────────────────────────

  /** Sets the desired movement speed along the current orientation (0=stop, 0.8=walk, 1.4=sprint) */
  setArcadeVelocityTarget(speed: number): void {
    this.velocityTarget.copy(this.orientation).multiplyScalar(speed * this.config.moveSpeed);
  }

  setArcadeVelocityInfluence(x: number, y: number, z: number): void {
    this.arcadeVelocityInfluence.set(x, y, z);
  }

  /** Aligns the orientation target to the camera-relative WASD input */
  setCameraRelativeOrientationTarget(): void {
    const hasInput = this.actions.up.isPressed || this.actions.down.isPressed ||
                     this.actions.left.isPressed || this.actions.right.isPressed;
    if (!hasInput) return;

    let ix = 0, iz = 0;
    if (this.actions.up.isPressed)    iz += 1;
    if (this.actions.down.isPressed)  iz -= 1;
    if (this.actions.left.isPressed)  ix -= 1;
    if (this.actions.right.isPressed) ix += 1;

    const thetaRad = THREE.MathUtils.degToRad(this.cameraTheta);
    const cos = Math.cos(thetaRad), sin = Math.sin(thetaRad);
    // rotate input by camera yaw
    const wx = ix * cos - iz * sin;
    const wz = ix * sin + iz * cos;
    if (Math.abs(wx) + Math.abs(wz) > 0.01) {
      this.orientationTarget.set(-wx, 0, -wz).normalize();
    }
  }

  /** Performs the physics jump impulse */
  jump(): void {
    this.capsuleBody.velocity.y = this.config.jumpForce;
    this.isGrounded = false;
    this.alreadyJumped = true;
  }

  // ── Ground detection ─────────────────────────────────────────────────────

  private _updateGroundDetection(): void {
    if (this.terrainMeshes.length === 0) {
      this.rayHasHit = this.position.y <= this.config.spawnY + 0.05;
      this.isGrounded = this.rayHasHit;
      if (this.isGrounded) {
        this.position.y = this.config.spawnY;
        this.capsuleBody.velocity.y = Math.max(0, this.capsuleBody.velocity.y);
        this._snapBodyToGround();
      }
      return;
    }

    const origin = new THREE.Vector3(
      this.position.x,
      this.position.y + this.config.rayCastLength + this.config.raySafeOffset,
      this.position.z
    );
    this.rayRaycaster.set(origin, new THREE.Vector3(0, -1, 0));
    this.rayRaycaster.far = this.config.rayCastLength * 2.5;

    const hits = this.rayRaycaster.intersectObjects(this.terrainMeshes, true);
    if (hits.length > 0 && this.capsuleBody.velocity.y <= 0.2) {
      const groundY  = hits[0].point.y;
      const dist     = origin.y - hits[0].distance;
      this.rayHasHit  = dist <= groundY + this.config.raySafeOffset + 0.15;

      if (this.rayHasHit) {
        this.isGrounded = true;
        this.position.y = groundY;
        this.capsuleBody.velocity.y = 0;
        this._snapBodyToGround();
      } else {
        this.isGrounded = false;
      }
    } else {
      this.rayHasHit  = false;
      this.isGrounded = false;
    }
  }

  private _snapBodyToGround(): void {
    const bY = this.position.y + this.config.capsuleHeight * 0.5 + this.config.capsuleRadius;
    this.capsuleBody.position.y             = bY;
    this.capsuleBody.interpolatedPosition.y = bY;
  }

  // ── State machine (simplified Sketchbook states) ──────────────────────────

  private _updateState(dt: number): void {
    switch (this.state) {

      case 'idle':
        this.velocitySimulator.damping = 0.6;
        this.velocitySimulator.mass    = 10;
        this.setArcadeVelocityTarget(0);
        if (this.actions.jump.justPressed)        this._enterJumpIdle();
        else if (this._anyDirection()) {
          const spd = this.velocity.length();
          this._setState(spd > 0.5 ? 'walk' : 'walk');
          this._playAnimation('walk', 0.2);
        }
        this._fallInAir();
        break;

      case 'walk':
        this.setCameraRelativeOrientationTarget();
        this.setArcadeVelocityTarget(0.8);
        if (this.actions.run.isPressed)            { this._setState('sprint'); this._playAnimation('sprint', 0.1); }
        if (!this._anyDirection())                 { this._setState('idle');   this._playAnimation('idle',   0.25); }
        if (this.actions.jump.justPressed)         this._enterJumpRunning();
        this._fallInAir();
        break;

      case 'sprint':
        this.velocitySimulator.mass    = 10;
        this.rotationSimulator.damping = 0.8;
        this.rotationSimulator.mass    = 50;
        this.setCameraRelativeOrientationTarget();
        this.setArcadeVelocityTarget(1.4);
        if (!this.actions.run.isPressed)           { this._setState('walk');   this._playAnimation('walk',   0.15); }
        if (!this._anyDirection())                 { this._setState('idle');   this._playAnimation('idle',   0.25); }
        if (this.actions.jump.justPressed)         this._enterJumpRunning();
        this._fallInAir();
        break;

      case 'jumpIdle': {
        this.velocitySimulator.mass = 50;
        this.setArcadeVelocityTarget(0);
        if (this.stateTimer > 0.2 && !this.alreadyJumped) { this.jump(); }
        if (this.alreadyJumped) {
          this.setCameraRelativeOrientationTarget();
          this.setArcadeVelocityTarget(this._anyDirection() ? 0.8 : 0);
        }
        if (this.capsuleBody.velocity.y < -2 && this.stateTimer > 0.3) {
          this._setState('falling'); this._playAnimation('falling', 0.3);
        }
        if (this.rayHasHit && this.stateTimer > 0.5) this._land();
        break;
      }

      case 'jumpRunning': {
        this.setCameraRelativeOrientationTarget();
        this.setArcadeVelocityTarget(this._anyDirection() ? 0.8 : 0);
        if (this.capsuleBody.velocity.y < -2 && this.stateTimer > 0.2) {
          this._setState('falling'); this._playAnimation('falling', 0.3);
        }
        if (this.rayHasHit && this.stateTimer > 0.4) this._land();
        break;
      }

      case 'falling':
        this.setCameraRelativeOrientationTarget();
        this.setArcadeVelocityTarget(this._anyDirection() ? 0.8 : 0);
        if (this.rayHasHit) this._land();
        break;

      case 'dropIdle':
      case 'land':
        this.setArcadeVelocityTarget(0);
        if (this.stateTimer > 0.3) {
          this._setState('idle');
          this._playAnimation('idle', 0.2);
        }
        break;
    }
  }

  private _fallInAir(): void {
    if (!this.isGrounded && !this.rayHasHit && this.capsuleBody.velocity.y < -1) {
      if (this.state !== 'falling' && this.state !== 'jumpIdle' && this.state !== 'jumpRunning') {
        this._setState('falling');
        this._playAnimation('falling', 0.3);
      }
    }
  }

  private _enterJumpIdle(): void {
    this.alreadyJumped = false;
    this._setState('jumpIdle');
    this._playAnimation('jump_idle', 0.1);
    this.velocitySimulator.mass    = 50;
    this.rotationSimulator.damping = 0.3;
  }

  private _enterJumpRunning(): void {
    this.alreadyJumped = false;
    this._setState('jumpRunning' as IslandCharacterState);
    this._playAnimation('jump_run', 0.1);
    this.jump();
  }

  private _land(): void {
    this._setState('land');
    this._playAnimation('drop_idle', 0.1);
    this.stateTimer = 0;
  }

  // ── springMovement (Sketchbook faithful) ─────────────────────────────────

  private _springMovement(dt: number): void {
    this.velocitySimulator.target.copy(this.velocityTarget);
    this.velocitySimulator.simulate(dt);
    this.velocity.copy(this.velocitySimulator.position);
    this.acceleration.copy(this.velocitySimulator.velocity);

    // Apply horizontal velocity to capsule body via direct override
    // (Sketchbook uses arcade velocity which overrides horizontal only)
    const inf = this.arcadeVelocityInfluence;
    if (!this.arcadeVelocityIsAdditive) {
      if (inf.x !== 0) this.capsuleBody.velocity.x = this.velocity.x * inf.x;
      if (inf.z !== 0) this.capsuleBody.velocity.z = this.velocity.z * inf.z;
    } else {
      if (inf.x !== 0) this.capsuleBody.velocity.x += this.velocity.x * inf.x;
      if (inf.z !== 0) this.capsuleBody.velocity.z += this.velocity.z * inf.z;
    }
  }

  // ── springRotation (Sketchbook faithful) ─────────────────────────────────

  private _springRotation(dt: number): void {
    // Find angle between orientation and orientationTarget
    const angle = this.orientation.angleTo(this.orientationTarget);

    // Set up relative spring target proportional to angle
    if (angle > 0.001) {
      const cross = new THREE.Vector3().crossVectors(this.orientation, this.orientationTarget);
      const sign  = cross.y < 0 ? -1 : 1;
      this.rotationSimulator.target   = sign * angle;
      this.rotationSimulator.simulate(dt);
      const delta = this.rotationSimulator.position;
      this.orientation.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
    }
  }

  // ── rotateModel (Sketchbook faithful) ────────────────────────────────────

  private _rotateModel(): void {
    this.tiltContainer.lookAt(
      this.tiltContainer.position.clone().add(this.orientation)
    );

    // Body tilt (lean) based on velocity for dynamic feel
    const speed    = this.velocity.length();
    const forward  = new THREE.Vector3(0, 0, 1).applyQuaternion(this.tiltContainer.quaternion);
    const velNorm  = this.velocity.clone().normalize();
    const dot      = forward.dot(velNorm);
    const tilt     = dot * speed * 0.025;
    this.modelContainer.rotation.x = THREE.MathUtils.lerp(this.modelContainer.rotation.x, -tilt, 0.3);
  }

  // ── CameraOperator (Sketchbook theta/phi orbit) ───────────────────────────

  private _moveCamera(dx: number, dy: number): void {
    this.cameraTheta -= dx * (this.config.cameraSensX / 2);
    this.cameraTheta  = this.cameraTheta % 360;
    this.cameraPhi    = THREE.MathUtils.clamp(
      this.cameraPhi + dy * (this.config.cameraSensY / 2),
      this.config.cameraMinPhi,
      this.config.cameraMaxPhi
    );
  }

  private _updateCamera(): void {
    const tRad = THREE.MathUtils.degToRad(this.cameraTheta);
    const pRad = THREE.MathUtils.degToRad(this.cameraPhi);
    const r    = this.cameraRadius;

    const goal = new THREE.Vector3(
      this.position.x + r * Math.sin(tRad) * Math.cos(pRad),
      this.position.y + r * Math.sin(pRad) + 1.6,
      this.position.z + r * Math.cos(tRad) * Math.cos(pRad)
    );

    this.cameraPos.lerp(goal, 0.08);
    this.cameraTarget.lerp(
      new THREE.Vector3(this.position.x, this.position.y + 1.0, this.position.z),
      0.08
    );
  }

  // ── Physics init ──────────────────────────────────────────────────────────

  private _initPhysics(): void {
    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -20, 0);
    this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    this.physicsWorld.solver.iterations = 10;

    // Capsule = 3-sphere compound (CapsuleCollider in Sketchbook)
    const mat = new CANNON.Material('capsuleMat');
    mat.friction = 0.0;   // arcade velocity overrides horizontal, so no friction

    this.capsuleBody = new CANNON.Body({
      mass:     this.config.mass,
      material: mat,
    });

    const r = this.config.capsuleRadius;
    const h = this.config.capsuleHeight;
    const sphere = new CANNON.Sphere(r);
    this.capsuleBody.addShape(sphere, new CANNON.Vec3(0,  0,   0));
    this.capsuleBody.addShape(sphere, new CANNON.Vec3(0,  h/2, 0));
    this.capsuleBody.addShape(sphere, new CANNON.Vec3(0, -h/2, 0));
    this.capsuleBody.angularDamping  = 1.0;
    this.capsuleBody.linearDamping   = 0.0;
    this.capsuleBody.position.set(0, this.config.spawnY + h + r, 0);

    this.physicsWorld.addBody(this.capsuleBody);

    // Flat contact ground plane for basic physics support
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.physicsWorld.addBody(groundBody);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _anyDirection(): boolean {
    return this.actions.up.isPressed || this.actions.down.isPressed ||
           this.actions.left.isPressed || this.actions.right.isPressed;
  }

  private _setState(s: IslandCharacterState): void {
    if (s === this.state) return;
    this.state     = s;
    this.stateTimer = 0;
    this._onStateChange?.(s);
  }

  private _playAnimation(name: string, fadeIn: number): void {
    const action = this.actionMap.get(name);
    if (!action) return;
    this.currentAction?.fadeOut(fadeIn);
    action.reset().fadeIn(fadeIn).play();
    this.currentAction = action;
  }

  private _loadFBX(loader: FBXLoader, path: string): Promise<THREE.Group> {
    return new Promise((res, rej) => loader.load(path, res, undefined, rej));
  }

  // ── Hand-bone prop attachment ─────────────────────────────────────────────
  // Attach any Object3D (tool, weapon, prop) to the character's right hand bone.
  // Call attachToHandBone(mesh) before harvesting starts;
  // call detachFromHandBone() when done.

  private _handBone: THREE.Bone | null = null;
  private _handProp: THREE.Object3D | null = null;

  /** Find the right-hand bone in the loaded skeleton (lazy-cached). */
  private _findHandBone(): THREE.Bone | null {
    if (this._handBone) return this._handBone;
    if (!this.model) return null;
    const candidates = [
      'RightHand', 'mixamorig:RightHand', 'Hand_R',
      'hand_r', 'Bip01_R_Hand', 'right_hand',
    ];
    let found: THREE.Bone | null = null;
    this.model.traverse((obj) => {
      if (found) return;
      if ((obj as THREE.Bone).isBone) {
        const n = obj.name;
        if (candidates.some(c => n === c || n.endsWith(c))) {
          found = obj as THREE.Bone;
        }
      }
    });
    // Fallback: first bone in the skeleton
    if (!found) {
      this.model.traverse((obj) => {
        if (!found && (obj as THREE.Bone).isBone) found = obj as THREE.Bone;
      });
    }
    this._handBone = found;
    return found;
  }

  /**
   * Parent `prop` onto the character's right hand bone.
   * The prop is scaled and offset so it looks held naturally.
   * @param prop  Any Three.js Object3D (FBX group, mesh, etc.)
   * @param offset  Local position offset relative to the hand bone (tweak per tool)
   * @param rotation Local rotation (Euler XYZ radians) relative to the hand bone
   * @param scale  Uniform scale applied to the prop
   */
  attachToHandBone(
    prop: THREE.Object3D,
    offset  = new THREE.Vector3(0, 0.05, 0.1),
    rotation = new THREE.Euler(-Math.PI / 2, 0, 0),
    scale   = 0.012,
  ): void {
    this.detachFromHandBone();          // ensure clean slate
    const bone = this._findHandBone();
    if (!bone) {
      console.warn('[SketchbookIslandController] RightHand bone not found – cannot attach prop');
      return;
    }
    prop.scale.setScalar(scale);
    prop.position.copy(offset);
    prop.rotation.copy(rotation);
    bone.add(prop);
    this._handProp = prop;
    console.log(`[SketchbookIslandController] Prop attached to bone: ${bone.name}`);
  }

  /** Remove any previously attached prop from the hand bone. */
  detachFromHandBone(): void {
    if (!this._handProp) return;
    this._handProp.parent?.remove(this._handProp);
    this._handProp = null;
  }

  // ── Static prop colliders ───────────────────────────────────────────────
  // Register solid world props (trees, rocks, placed buildings, …) as static
  // (mass 0) box bodies in the physics world so the capsule can't walk through
  // them. Boxes keep orientation trivial (axis-aligned, no cylinder rotation
  // quirks) and are plenty for a "you can't pass" resolver. Keep the radius
  // below any interaction center-distance cutoff so harvestables stay reachable.
  addStaticProp(
    id: string,
    x: number,
    z: number,
    radius: number,
    yBase: number,
    height: number,
  ): void {
    if (!this.physicsWorld || this.propBodies.has(id)) return;
    const half = new CANNON.Vec3(Math.max(radius, 0.05), Math.max(height, 0.1) * 0.5, Math.max(radius, 0.05));
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(half));
    body.position.set(x, yBase + Math.max(height, 0.1) * 0.5, z);
    this.physicsWorld.addBody(body);
    this.propBodies.set(id, body);
  }

  removeStaticProp(id: string): void {
    const body = this.propBodies.get(id);
    if (!body) return;
    if (this.physicsWorld) this.physicsWorld.removeBody(body);
    this.propBodies.delete(id);
  }

  clearStaticProps(): void {
    if (this.physicsWorld) {
      for (const body of this.propBodies.values()) this.physicsWorld.removeBody(body);
    }
    this.propBodies.clear();
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    this.clearStaticProps();
    if (this._keyDown)   window.removeEventListener('keydown',    this._keyDown);
    if (this._keyUp)     window.removeEventListener('keyup',      this._keyUp);
    if (this._mouseUp)   window.removeEventListener('mouseup',    this._mouseUp);
    if (this._mouseMove) document.removeEventListener('mousemove', this._mouseMove);
    if (this._mouseDown && this._container) this._container.removeEventListener('mousedown', this._mouseDown);
    if (this._plChange)  document.removeEventListener('pointerlockchange', this._plChange);
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
