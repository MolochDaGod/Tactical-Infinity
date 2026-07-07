/**
 * MixamoPlayerController — Layered Animator with:
 *
 * Layer 0  Locomotion Blend Tree (full-body, always playing)
 *   1D speed param → blends idle↔walk↔run↔sprint by weight
 *   Direction awareness → strafeLeft / strafeRight / walkBack
 *
 * Layer 1  One-shot Override (jump, dodge, death — full-body crossFade)
 *
 * Layer 2  Upper Body Additive (attacks, blocks, cast)
 *   Tracks filtered to spine-and-above bones at load time
 *   Plays additively over locomotion so feet keep walking during combat
 *
 * Foot IK  Procedural foot placement via downward raycast + bone offset
 *   Blended by grounded weight (fades off while airborne)
 *
 * Idle Cycling  Random idle variant every 8-15 s
 * Transition Guards  minimum dwell time prevents rapid flickering
 * Attack Events  normalised-time hit window callback
 * CrossFade everywhere using THREE.AnimationAction.crossFadeTo()
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';

const PLAYER_MODEL_BASE = '/models/player';
const MODEL_FILE = 'Meshy_AI_Orc_Warlord_Render_1220104017_texture_fbx.fbx';

// ── Animation catalogue ───────────────────────────────────────────────────────

export const PLAYER_ANIMATION_MAP: Record<string, { file: string; loop: boolean; speed: number; category: string }> = {
  idle:    { file: 'sword and shield idle.fbx',           loop: true,  speed: 1.0, category: 'locomotion' },
  idle2:   { file: 'sword and shield idle (2).fbx',        loop: true,  speed: 1.0, category: 'locomotion' },
  idle3:   { file: 'sword and shield idle (3).fbx',        loop: true,  speed: 1.0, category: 'locomotion' },
  idle4:   { file: 'sword and shield idle (4).fbx',        loop: true,  speed: 1.0, category: 'locomotion' },
  walk:         { file: 'sword and shield walk.fbx',        loop: true,  speed: 1.0, category: 'locomotion' },
  walkBack:     { file: 'sword and shield walk (2).fbx',    loop: true,  speed: 1.0, category: 'locomotion' },
  run:          { file: 'sword and shield run.fbx',         loop: true,  speed: 1.0, category: 'locomotion' },
  sprint:       { file: 'sword and shield run (2).fbx',     loop: true,  speed: 1.2, category: 'locomotion' },
  strafeLeft:   { file: 'sword and shield strafe.fbx',      loop: true,  speed: 1.0, category: 'locomotion' },
  strafeRight:  { file: 'sword and shield strafe (2).fbx',  loop: true,  speed: 1.0, category: 'locomotion' },
  strafeLeft2:  { file: 'sword and shield strafe (3).fbx',  loop: true,  speed: 1.0, category: 'locomotion' },
  strafeRight2: { file: 'sword and shield strafe (4).fbx',  loop: true,  speed: 1.0, category: 'locomotion' },
  turnLeft:  { file: 'sword and shield turn.fbx',           loop: false, speed: 1.0, category: 'locomotion' },
  turnRight: { file: 'sword and shield turn (2).fbx',       loop: false, speed: 1.0, category: 'locomotion' },
  turn180:   { file: 'sword and shield 180 turn.fbx',       loop: false, speed: 1.0, category: 'locomotion' },
  turn180_2: { file: 'sword and shield 180 turn (2).fbx',   loop: false, speed: 1.0, category: 'locomotion' },

  attack1: { file: 'sword and shield attack.fbx',     loop: false, speed: 1.0, category: 'combat' },
  attack2: { file: 'sword and shield attack (2).fbx', loop: false, speed: 1.0, category: 'combat' },
  attack3: { file: 'sword and shield attack (3).fbx', loop: false, speed: 1.0, category: 'combat' },
  attack4: { file: 'sword and shield attack (4).fbx', loop: false, speed: 1.0, category: 'combat' },
  slash1:  { file: 'sword and shield slash.fbx',      loop: false, speed: 1.0, category: 'combat' },
  slash2:  { file: 'sword and shield slash (2).fbx',  loop: false, speed: 1.0, category: 'combat' },
  slash3:  { file: 'sword and shield slash (3).fbx',  loop: false, speed: 1.0, category: 'combat' },
  slash4:  { file: 'sword and shield slash (4).fbx',  loop: false, speed: 1.0, category: 'combat' },
  slash5:  { file: 'sword and shield slash (5).fbx',  loop: false, speed: 1.0, category: 'combat' },
  kick:    { file: 'sword and shield kick.fbx',       loop: false, speed: 1.0, category: 'combat' },

  block:          { file: 'sword and shield block.fbx',             loop: false, speed: 1.0, category: 'defense' },
  block2:         { file: 'sword and shield block (2).fbx',         loop: false, speed: 1.0, category: 'defense' },
  blockIdle:      { file: 'sword and shield block idle.fbx',         loop: true,  speed: 1.0, category: 'defense' },
  crouchBlock:    { file: 'sword and shield crouch block.fbx',       loop: false, speed: 1.0, category: 'defense' },
  crouchBlock2:   { file: 'sword and shield crouch block (2).fbx',   loop: false, speed: 1.0, category: 'defense' },
  crouchBlockIdle:{ file: 'sword and shield crouch block idle.fbx',  loop: true,  speed: 1.0, category: 'defense' },

  jump:       { file: 'sword and shield jump.fbx',          loop: false, speed: 1.0, category: 'movement' },
  jump2:      { file: 'sword and shield jump (2).fbx',      loop: false, speed: 1.0, category: 'movement' },
  crouch:     { file: 'sword and shield crouch.fbx',        loop: false, speed: 1.0, category: 'movement' },
  crouchIdle: { file: 'sword and shield crouch idle.fbx',   loop: true,  speed: 1.0, category: 'movement' },
  crouchWalk: { file: 'sword and shield crouching.fbx',     loop: true,  speed: 1.0, category: 'movement' },
  crouchWalk2:{ file: 'sword and shield crouching (2).fbx', loop: true,  speed: 1.0, category: 'movement' },
  crouchWalk3:{ file: 'sword and shield crouching (3).fbx', loop: true,  speed: 1.0, category: 'movement' },
  dodge:      { file: 'sword and shield crouch.fbx',        loop: false, speed: 1.5, category: 'movement' },

  impact1: { file: 'sword and shield impact.fbx',     loop: false, speed: 1.0, category: 'reaction' },
  impact2: { file: 'sword and shield impact (2).fbx', loop: false, speed: 1.0, category: 'reaction' },
  impact3: { file: 'sword and shield impact (3).fbx', loop: false, speed: 1.0, category: 'reaction' },
  death1:  { file: 'sword and shield death.fbx',      loop: false, speed: 1.0, category: 'reaction' },
  death2:  { file: 'sword and shield death (2).fbx',  loop: false, speed: 1.0, category: 'reaction' },

  casting1: { file: 'sword and shield casting.fbx',     loop: false, speed: 1.0, category: 'special' },
  casting2: { file: 'sword and shield casting (2).fbx', loop: false, speed: 1.0, category: 'special' },
  powerUp:  { file: 'sword and shield power up.fbx',    loop: false, speed: 1.0, category: 'special' },
  drawSword1:   { file: 'draw sword 1.fbx',   loop: false, speed: 1.0, category: 'special' },
  drawSword2:   { file: 'draw sword 2.fbx',   loop: false, speed: 1.0, category: 'special' },
  sheathSword1: { file: 'sheath sword 1.fbx', loop: false, speed: 1.0, category: 'special' },
  sheathSword2: { file: 'sheath sword 2.fbx', loop: false, speed: 1.0, category: 'special' },
};

// Hotkey → anim name
const HOTKEY_ANIMATIONS: Record<string, string> = {
  '1': 'casting1', '2': 'casting2', '3': 'powerUp', '4': 'kick',
  '5': 'drawSword1', '6': 'sheathSword1', '7': 'death1', '8': 'death2',
  '9': 'turn180', '0': 'impact1',
};

// Upper-body bone name fragments (Mixamo standard)
const UPPER_BODY_BONE_FRAGMENTS = [
  'spine', 'chest', 'neck', 'head',
  'shoulder', 'arm', 'forearm', 'hand',
  'finger', 'thumb', 'index', 'middle', 'ring', 'pinky',
  'clavicle',
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MixamoPlayerConfig {
  scale: number;
  walkSpeed: number;
  runSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  turnSpeed: number;
  gravity: number;
  jumpForce: number;
  dodgeSpeed: number;
  dodgeDuration: number;
  dodgeCooldown: number;
  attackCooldown: number;
  comboCooldown: number;
  comboWindow: number;
  sprintStaminaDrain: number;  // stamina/sec while sprinting
  dodgeStaminaCost: number;    // stamina spent per dodge
  staminaRegen: number;        // stamina/sec recovered
  staminaRegenDelay: number;   // seconds after use before regen resumes
  cameraDistance: number;
  cameraHeight: number;
  cameraSensitivity: number;
  cameraSmoothing: number;
  minPitch: number;
  maxPitch: number;
  groundY: number;
}

export const DEFAULT_PLAYER_CONFIG: MixamoPlayerConfig = {
  scale: 0.012,
  walkSpeed: 3.0,
  runSpeed: 5.5,
  sprintSpeed: 8.0,
  crouchSpeed: 1.5,
  turnSpeed: Math.PI * 1.5,
  gravity: 25,
  jumpForce: 10,
  dodgeSpeed: 10,
  dodgeDuration: 0.45,
  dodgeCooldown: 0.8,
  attackCooldown: 0.4,
  comboCooldown: 1.2,
  comboWindow: 0.6,
  sprintStaminaDrain: 0.34,
  dodgeStaminaCost: 0.25,
  staminaRegen: 0.32,
  staminaRegenDelay: 0.7,
  cameraDistance: 5,
  cameraHeight: 2.2,
  cameraSensitivity: 2.5,
  cameraSmoothing: 0.08,
  minPitch: -0.8,
  maxPitch: 1.2,
  groundY: 0,
};

export interface PlayerLoadProgress { loaded: number; total: number; currentFile: string; }

export type PlayerState =
  | 'idle' | 'walk' | 'walkBack' | 'run' | 'sprint'
  | 'strafeLeft' | 'strafeRight'
  | 'jump' | 'fall' | 'land'
  | 'attack1' | 'attack2' | 'attack3' | 'attack4' | 'comboAttack'
  | 'slash1' | 'slash2' | 'slash3' | 'slash4' | 'slash5'
  | 'block' | 'blockIdle'
  | 'crouch' | 'crouchIdle' | 'crouchWalk'
  | 'dodge' | 'roll'
  | 'impact' | 'death'
  | 'casting' | 'powerUp'
  | 'drawSword' | 'sheathSword'
  | 'special';

// ── Locomotion blend-tree node names ─────────────────────────────────────────
const LOCO_ANIMS = ['idle', 'walk', 'walkBack', 'strafeLeft', 'strafeRight', 'run', 'sprint'] as const;
type LocoAnim = typeof LOCO_ANIMS[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isUpperBodyTrack(trackName: string): boolean {
  const bone = trackName.split('.')[0].toLowerCase();
  return UPPER_BODY_BONE_FRAGMENTS.some(frag => bone.includes(frag));
}

function makeUpperBodyClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  // Clone each track — makeClipAdditive() mutates track values in place, so the
  // upper-body layer MUST own copies or it would corrupt the shared base clip.
  const tracks = clip.tracks.filter(t => isUpperBodyTrack(t.name)).map(t => t.clone());
  return new THREE.AnimationClip(`${clip.name}_upper`, clip.duration, tracks);
}

// ── Controller class ──────────────────────────────────────────────────────────

export class MixamoPlayerController {
  public config: MixamoPlayerConfig;
  public model: THREE.Group | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public isLoaded = false;
  public state: PlayerState = 'idle';
  public prevState: PlayerState = 'idle';

  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public rotation = 0;

  public cameraYaw = 0;
  public cameraPitch = 0.3;
  public cameraPosition = new THREE.Vector3();
  public cameraTarget = new THREE.Vector3();

  // ── Stamina & combat-target (lock-on) ───────────────────────────────────────
  public stamina = 1;                 // 0..1
  private staminaCooldown = 0;        // delay before regen resumes
  public lockTarget: THREE.Object3D | null = null;
  private cameraObstacles: THREE.Object3D[] = [];
  private camRaycaster = new THREE.Raycaster();
  private cameraShake = 0;
  private _lockWorldPos = new THREE.Vector3();

  // ── Animation assets ────────────────────────────────────────────────────────
  private actions     = new Map<string, THREE.AnimationAction>(); // base-layer actions (full body)
  private upperActions= new Map<string, THREE.AnimationAction>(); // layer-2 actions (upper body only)
  private clips       = new Map<string, THREE.AnimationClip>();

  // Layer 0 — locomotion (all running simultaneously, weights sum to 1)
  private locoWeights = new Map<LocoAnim, number>();
  private locoActive  = new Map<LocoAnim, boolean>(); // whether action.play() has been called

  // Layer 1 — current one-shot override (jump, dodge, death)
  private overrideAction: THREE.AnimationAction | null = null;
  private overrideName = '';

  // Layer 2 — upper body additive (attacks, blocks, cast)
  private upperAction: THREE.AnimationAction | null = null;
  private upperName   = '';

  // Smooth speed parameter (0..1) fed into blend tree
  private speedParam  = 0;
  private dirParam    = 0; // -1=strafe-left, 0=forward/back, +1=strafe-right

  // ── State machine ───────────────────────────────────────────────────────────
  private stateTimer         = 0;
  private inOverrideLayer    = false;
  private inUpperLayer       = false;
  private attackTimer        = 0;
  private comboTimer         = 0;
  private attackCombo        = 0;
  private dodgeTimer         = 0;
  private dodgeCooldownTimer = 0;
  private dodgeDirection     = new THREE.Vector3();
  private onAttackHitCallback: (() => void) | null = null;
  private attackHitFired     = false;

  // ── Idle cycling ───────────────────────────────────────────────────────────
  private idleCycleTimer    = 12;
  private idleVariantWeight = 0;
  private idleVariantAction: THREE.AnimationAction | null = null;
  private readonly IDLE_VARIANTS: LocoAnim[] = ['idle', 'idle2' as LocoAnim, 'idle3' as LocoAnim, 'idle4' as LocoAnim];

  // ── Input ──────────────────────────────────────────────────────────────────
  private keys         = new Set<string>();
  private mouseButtons = new Set<number>();
  private mouseMovement = { x: 0, y: 0 };
  private isPointerLocked = false;

  // ── Physics ────────────────────────────────────────────────────────────────
  private isGrounded    = true;
  private isCrouching   = false;
  private isBlocking    = false;
  private isSprinting   = false;
  private jumpVelocity  = 0;
  private coyoteTimer   = 0;
  private angularVelocity = 0;
  private prevRotation    = 0;
  private bodyLeanX = 0;
  private bodyLeanZ = 0;
  private static readonly VELOCITY_SPRING = 10.0;
  private static readonly BRAKE_SPRING    = 14.0;
  private static readonly LEAN_SPRING     = 6.0;
  private static readonly COYOTE_TIME     = 0.14;

  // ── IK ────────────────────────────────────────────────────────────────────
  private ikSolver: CCDIKSolver | null = null;
  private leftFootBone : THREE.Bone | null = null;
  private rightFootBone: THREE.Bone | null = null;
  private leftFootRestY  = 0;
  private rightFootRestY = 0;
  private leftFootIKY    = 0;
  private rightFootIKY   = 0;
  private ikGroundWeight = 1;
  private ikRaycaster    = new THREE.Raycaster();
  private groundMeshes: THREE.Mesh[] = [];

  // ── Internal refs ──────────────────────────────────────────────────────────
  private scene: THREE.Scene | null = null;
  private container: HTMLElement | null = null;
  private onProgressCallback?: (p: PlayerLoadProgress) => void;
  private onLoadedCallback?: () => void;
  private onStateChangeCallback?: (s: PlayerState, prev: PlayerState) => void;

  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp:   ((e: KeyboardEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp:   ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;
  private boundPointerLockChange: (() => void) | null = null;

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(config: Partial<MixamoPlayerConfig> = {}) {
    this.config = { ...DEFAULT_PLAYER_CONFIG, ...config };
    this.position.y = this.config.groundY;
    LOCO_ANIMS.forEach(name => { this.locoWeights.set(name, 0); this.locoActive.set(name, false); });
    this.locoWeights.set('idle', 1); // start fully in idle
  }

  onProgress(cb: (p: PlayerLoadProgress) => void): this { this.onProgressCallback = cb; return this; }
  onLoaded(cb: () => void): this { this.onLoadedCallback = cb; return this; }
  onStateChange(cb: (s: PlayerState, prev: PlayerState) => void): this { this.onStateChangeCallback = cb; return this; }

  // ── Load ──────────────────────────────────────────────────────────────────

  async load(scene: THREE.Scene): Promise<void> {
    this.scene = scene;
    const loader = new FBXLoader();

    const fbx = await new Promise<THREE.Group>((res, rej) =>
      loader.load(`${PLAYER_MODEL_BASE}/${MODEL_FILE}`, res, undefined, rej)
    );

    fbx.scale.setScalar(this.config.scale);
    fbx.traverse(child => {
      const m = child as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });

    this.model = fbx;
    this.mixer = new THREE.AnimationMixer(fbx);
    scene.add(fbx);

    // Load all animations
    const animEntries = Object.entries(PLAYER_ANIMATION_MAP);
    const total = animEntries.length;
    let loaded = 0;

    for (const [name, info] of animEntries) {
      try {
        const animFbx = await new Promise<THREE.Group>((res, rej) =>
          loader.load(`${PLAYER_MODEL_BASE}/${info.file}`, res, undefined, rej)
        );

        if (animFbx.animations.length > 0) {
          // Base layer uses the clip UNMODIFIED (normal blend mode). The previous
          // code called makeClipAdditive() on this very clip, which mutates it in
          // place — turning every locomotion/override animation into a broken
          // additive delta. Keep the base clip pristine here.
          const baseClip = animFbx.animations[0];
          baseClip.name = name;
          this.clips.set(name, baseClip);

          // Base layer action
          const action = this.mixer.clipAction(baseClip);
          action.setLoop(info.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          if (!info.loop) action.clampWhenFinished = true;
          action.timeScale = info.speed;
          action.weight = 0;
          this.actions.set(name, action);

          // Upper-body masked action (for combat layer). makeUpperBodyClip clones
          // the tracks, so making THIS copy additive cannot corrupt baseClip.
          if (info.category === 'combat' || info.category === 'defense' || info.category === 'special') {
            const upperClip = makeUpperBodyClip(baseClip);
            if (upperClip.tracks.length > 0) {
              THREE.AnimationUtils.makeClipAdditive(upperClip);
              const upperAction = this.mixer.clipAction(upperClip);
              upperAction.setLoop(info.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
              if (!info.loop) upperAction.clampWhenFinished = true;
              upperAction.timeScale = info.speed;
              upperAction.weight = 0;
              // Additive blend mode so it layers over locomotion
              upperAction.blendMode = THREE.AdditiveAnimationBlendMode;
              this.upperActions.set(name, upperAction);
            }
          }
        }
      } catch {
        console.warn(`[Animator] Failed to load: ${name}`);
      }

      loaded++;
      this.onProgressCallback?.({ loaded, total, currentFile: info.file });
    }

    // Start all locomotion actions at weight 0 so mixer is aware of them
    LOCO_ANIMS.forEach(name => {
      const a = this.actions.get(name as string);
      if (a) { a.weight = 0; a.play(); this.locoActive.set(name, true); }
    });

    // Full-weight idle to start
    const idleAction = this.actions.get('idle');
    if (idleAction) idleAction.weight = 1;

    // Listen for one-shot completions
    this.mixer.addEventListener('finished', (e: any) => this._onAnimFinished(e.action));

    this.isLoaded = true;
    this._setupIK();
    this.onLoadedCallback?.();
  }

  // ── IK Setup ──────────────────────────────────────────────────────────────

  private _setupIK(): void {
    if (!this.model) return;

    // Find foot bones by Mixamo naming convention
    this.model.traverse(node => {
      const b = node as THREE.Bone;
      if (!b.isBone) return;
      const lname = b.name.toLowerCase();
      if (lname.includes('leftfoot') || (lname.includes('left') && lname.includes('foot'))) {
        this.leftFootBone = b;
      } else if (lname.includes('rightfoot') || (lname.includes('right') && lname.includes('foot'))) {
        this.rightFootBone = b;
      }
    });

    if (this.leftFootBone) {
      const wp = this.leftFootBone.getWorldPosition(new THREE.Vector3());
      this.leftFootRestY  = wp.y;
      this.leftFootIKY    = wp.y;
    }
    if (this.rightFootBone) {
      const wp = this.rightFootBone.getWorldPosition(new THREE.Vector3());
      this.rightFootRestY = wp.y;
      this.rightFootIKY   = wp.y;
    }

    // CCDIKSolver — attempt to find SkinnedMesh + set up leg chains
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.model.traverse(child => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh && !skinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (skinnedMesh) {
      const skel = (skinnedMesh as THREE.SkinnedMesh).skeleton;
      const boneNames = skel.bones.map(b => b.name.toLowerCase());

      const leftFootIdx  = boneNames.findIndex(n => n.includes('leftfoot'));
      const leftLowIdx   = boneNames.findIndex(n => n.includes('leftleg') && !n.includes('up') && !n.includes('foot') && !n.includes('toe'));
      const leftUpIdx    = boneNames.findIndex(n => n.includes('leftupleg') || (n.includes('left') && n.includes('upleg')));

      const rightFootIdx = boneNames.findIndex(n => n.includes('rightfoot'));
      const rightLowIdx  = boneNames.findIndex(n => n.includes('rightleg') && !n.includes('up') && !n.includes('foot') && !n.includes('toe'));
      const rightUpIdx   = boneNames.findIndex(n => n.includes('rightupleg') || (n.includes('right') && n.includes('upleg')));

      if (leftFootIdx >= 0 && leftLowIdx >= 0 && leftUpIdx >= 0 &&
          rightFootIdx >= 0 && rightLowIdx >= 0 && rightUpIdx >= 0) {
        try {
          // Create IK target bones as children of the mesh
          const lTarget = new THREE.Bone(); lTarget.name = 'IKTargetLeft';
          const rTarget = new THREE.Bone(); rTarget.name = 'IKTargetRight';
          const lTargetIdx = skel.bones.length;
          const rTargetIdx = skel.bones.length + 1;
          skel.bones.push(lTarget, rTarget);
          (skinnedMesh as THREE.SkinnedMesh).add(lTarget, rTarget);

          const iks = [
            { target: lTargetIdx, effector: leftFootIdx,  links: [{ index: leftLowIdx },  { index: leftUpIdx }],  iteration: 4, minAngle: 0, maxAngle: Math.PI * 0.8 },
            { target: rTargetIdx, effector: rightFootIdx, links: [{ index: rightLowIdx }, { index: rightUpIdx }], iteration: 4, minAngle: 0, maxAngle: Math.PI * 0.8 },
          ];
          this.ikSolver = new CCDIKSolver(skinnedMesh as THREE.SkinnedMesh, iks);
          console.log('[IK] CCDIKSolver initialized for both feet');
        } catch (err) {
          console.warn('[IK] CCDIKSolver setup failed:', err);
        }
      } else {
        console.log('[IK] Foot bone chain incomplete, using procedural placement only');
      }
    }
  }

  /** Register ground meshes for foot IK raycasting */
  registerGroundMeshes(meshes: THREE.Mesh[]): void {
    this.groundMeshes = meshes;
  }

  /** Register obstacle meshes the camera should not clip through */
  registerCameraObstacles(meshes: THREE.Object3D[]): void {
    this.cameraObstacles = meshes;
  }

  /** Set (or clear with null) the lock-on target */
  setLockTarget(obj: THREE.Object3D | null): void {
    this.lockTarget = obj;
  }

  /** Add a transient camera shake impulse (0..1-ish) */
  addCameraShake(amount: number): void {
    this.cameraShake = Math.min(1.2, this.cameraShake + amount);
  }

  // ── Input setup ───────────────────────────────────────────────────────────

  setupInput(container: HTMLElement): void {
    this.container = container;

    this.boundKeyDown = (e: KeyboardEvent) => { if (!e.repeat) { this.keys.add(e.code); this._onKeyDown(e); } };
    this.boundKeyUp   = (e: KeyboardEvent) => this.keys.delete(e.code);
    this.boundMouseDown = (e: MouseEvent) => {
      this.mouseButtons.add(e.button);
      if (!this.isPointerLocked) container.requestPointerLock();
      this._onMouseDown(e);
    };
    this.boundMouseUp   = (e: MouseEvent) => this.mouseButtons.delete(e.button);
    this.boundMouseMove = (e: MouseEvent) => {
      if (this.isPointerLocked) { this.mouseMovement.x += e.movementX; this.mouseMovement.y += e.movementY; }
    };
    this.boundContextMenu = (e: Event) => e.preventDefault();
    this.boundPointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === container;
    };

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup',   this.boundKeyUp);
    container.addEventListener('mousedown',   this.boundMouseDown);
    window.addEventListener('mouseup',    this.boundMouseUp);
    window.addEventListener('mousemove',  this.boundMouseMove);
    container.addEventListener('contextmenu', this.boundContextMenu);
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);
  }

  // ── Input handlers ────────────────────────────────────────────────────────

  private _onKeyDown(e: KeyboardEvent): void {
    const digit = e.key;
    if (HOTKEY_ANIMATIONS[digit] && this._isActionable()) {
      this._playSpecial(HOTKEY_ANIMATIONS[digit]);
      return;
    }
    if (e.code === 'Space' && (this.isGrounded || this.coyoteTimer > 0) && this._isActionable()) {
      this.coyoteTimer = 0;
      this._startJump();
    }
    if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && this.dodgeCooldownTimer <= 0 && this._isActionable()) {
      this._startDodge();
    }
    if (e.code === 'KeyC') this.isCrouching = !this.isCrouching;
  }

  private _onMouseDown(e: MouseEvent): void {
    if (e.button === 0 && this._isActionable()) this._startAttack('lmb');
    if (e.button === 2 && this._isActionable()) this._startAttack('rmb');
  }

  // ── State machine guards ──────────────────────────────────────────────────

  private _isActionable(): boolean { return !this._isLocked(); }

  private _isLocked(): boolean {
    return (
      this.state === 'death' ||
      this.state === 'impact' ||
      this.state === 'dodge' ||
      this.state === 'roll' ||
      this.state === 'special' ||
      this.state === 'drawSword' ||
      this.state === 'sheathSword'
    );
  }

  private _isAttacking(): boolean {
    const s = this.state;
    return s === 'attack1' || s === 'attack2' || s === 'attack3' || s === 'attack4' ||
           s === 'comboAttack' || s === 'slash1' || s === 'slash2' || s === 'slash3' ||
           s === 'slash4' || s === 'slash5';
  }

  private _setState(next: PlayerState): void {
    if (next === this.state) return;
    this.prevState = this.state;
    this.state     = next;
    this.stateTimer= 0;
    this.onStateChangeCallback?.(this.state, this.prevState);
  }

  // ── Specific state transitions ────────────────────────────────────────────

  private _startJump(): void {
    this.isGrounded  = false;
    this.jumpVelocity= this.config.jumpForce;
    this._setState('jump');
    this._overrideCrossFade('jump', 0.1);
  }

  private _startDodge(): void {
    if (this.stamina < this.config.dodgeStaminaCost) return; // too winded to dodge
    this.stamina = Math.max(0, this.stamina - this.config.dodgeStaminaCost);
    this.staminaCooldown = this.config.staminaRegenDelay;
    const fwd  = new THREE.Vector3(-Math.sin(this.rotation), 0, -Math.cos(this.rotation));
    const rgt  = new THREE.Vector3(-Math.cos(this.rotation), 0,  Math.sin(this.rotation));
    this.dodgeDirection.set(0, 0, 0);
    if (this.keys.has('KeyW')) this.dodgeDirection.add(fwd);
    if (this.keys.has('KeyS')) this.dodgeDirection.sub(fwd);
    if (this.keys.has('KeyA')) this.dodgeDirection.sub(rgt);
    if (this.keys.has('KeyD')) this.dodgeDirection.add(rgt);
    if (this.dodgeDirection.lengthSq() < 0.01) this.dodgeDirection.copy(fwd);
    this.dodgeDirection.normalize();
    this.dodgeTimer        = this.config.dodgeDuration;
    this.dodgeCooldownTimer= this.config.dodgeCooldown;
    this._setState('dodge');
    this._overrideCrossFade('dodge', 0.1);
  }

  private _startAttack(button: 'lmb' | 'rmb'): void {
    if (this._isAttacking() && this.comboTimer > 0) {
      this.attackCombo = Math.min(this.attackCombo + 1, 4);
    } else {
      this.attackCombo = 0;
    }
    this.attackHitFired = false;

    let nextState: PlayerState;
    let animName: string;

    if (button === 'lmb') {
      const seq: PlayerState[] = ['attack1', 'attack2', 'attack3', 'attack4'];
      nextState = seq[this.attackCombo % seq.length];
      animName  = nextState;
    } else {
      const seq: PlayerState[] = ['slash1', 'slash2', 'slash3', 'slash4', 'slash5'];
      nextState = seq[this.attackCombo % seq.length];
      animName  = nextState;
    }

    this._setState(nextState);
    this.attackTimer = this.config.attackCooldown;
    this.comboTimer  = this.config.comboWindow;

    // Play on upper body layer if walking/running, otherwise full body
    const isMoving = this.speedParam > 0.15;
    if (isMoving) {
      this._upperCrossFade(animName, 0.1);
    } else {
      this._overrideCrossFade(animName, 0.1);
    }
  }

  private _playSpecial(animName: string): void {
    this._setState('special');
    this._overrideCrossFade(animName, 0.15);
  }

  // ── Layered crossFade helpers ─────────────────────────────────────────────

  /**
   * Layer 1 — override crossFade (full body, disables locomotion weighting temporarily)
   */
  private _overrideCrossFade(name: string, duration: number): void {
    const next = this.actions.get(name);
    if (!next) return;
    if (this.overrideAction && this.overrideAction !== next) {
      this.overrideAction.crossFadeTo(next, duration, true);
    } else {
      // Stop upper layer if switching to full override
      if (this.upperAction) { this.upperAction.fadeOut(0.1); this.upperAction = null; this.upperName = ''; }
      next.reset().fadeIn(duration).play();
    }
    this.overrideAction = next;
    this.overrideName   = name;
    this.inOverrideLayer= true;
    // Fade locomotion layer out
    LOCO_ANIMS.forEach(n => { const a = this.actions.get(n as string); if (a) a.fadeOut(duration * 1.5); });
  }

  /**
   * Layer 2 — upper body crossFade (additive over locomotion)
   */
  private _upperCrossFade(name: string, duration: number): void {
    const next = this.upperActions.get(name) || this.actions.get(name);
    if (!next) return;
    if (this.upperAction && this.upperAction !== next) {
      this.upperAction.crossFadeTo(next, duration, true);
    } else {
      next.reset().fadeIn(duration).play();
    }
    this.upperAction = next;
    this.upperName   = name;
    this.inUpperLayer= true;
  }

  /**
   * Return to locomotion blend tree after a one-shot completes
   */
  private _returnToLoco(fadeDuration = 0.25): void {
    this.isCrouching  = false;
    this.isBlocking   = false;
    this.inOverrideLayer = false;

    if (!this.isGrounded) {
      this._setState('fall');
      this._overrideCrossFade('jump2', 0.15);
      return;
    }

    // Re-activate loco layer
    LOCO_ANIMS.forEach(name => {
      const a = this.actions.get(name as string);
      if (a) { a.fadeIn(fadeDuration); if (!this.locoActive.get(name)) { a.play(); this.locoActive.set(name, true); } }
    });

    this.overrideAction = null;
    this.overrideName   = '';

    const moving = this.speedParam > 0.15;
    this._setState(moving ? (this.isSprinting ? 'sprint' : 'run') : 'idle');
  }

  private _exitUpperLayer(fadeDuration = 0.2): void {
    if (this.upperAction) { this.upperAction.fadeOut(fadeDuration); this.upperAction = null; this.upperName = ''; }
    this.inUpperLayer = false;
    if (this._isAttacking()) this._setState(this.speedParam > 0.15 ? 'walk' : 'idle');
  }

  // ── Animation finished listener ───────────────────────────────────────────

  private _onAnimFinished(action: THREE.AnimationAction): void {
    const clip = action.getClip();
    const info = PLAYER_ANIMATION_MAP[clip.name];
    if (!info || info.loop) return;
    if (this.state === 'jump' || this.state === 'fall' || this.state === 'death') return;

    if (action === this.upperAction) {
      this._exitUpperLayer(0.2);
      return;
    }

    if (action === this.overrideAction) {
      this._returnToLoco(0.25);
    }
  }

  // ── Locomotion blend tree ─────────────────────────────────────────────────

  /**
   * Update the 1D blend tree weights every frame.
   * speedParam 0..1 normalized by sprintSpeed.
   * dirParam -1=left, 0=fwd/back, +1=right (for strafing).
   */
  private _updateLocoBlend(speed: number, dirAngle: number): void {
    if (this.inOverrideLayer) return;

    const max    = this.config.sprintSpeed;
    const tSpeed = THREE.MathUtils.clamp(speed / max, 0, 1);

    // Detect direction relative to character facing
    // dirAngle = angle of movement relative to character forward (in radians, -π..π)
    const absFwd  = Math.abs(dirAngle) < 0.6;          // roughly forward
    const absBack = Math.abs(dirAngle) > Math.PI - 0.6; // roughly backward
    const absStrafeL = dirAngle < -0.6 && dirAngle > -(Math.PI - 0.6);
    const absStrafeR = dirAngle >  0.6 && dirAngle <   Math.PI - 0.6;

    // Desired loco weights (0..1, sum to 1)
    const w: Record<LocoAnim, number> = {
      idle: 0, walk: 0, walkBack: 0, strafeLeft: 0, strafeRight: 0, run: 0, sprint: 0,
    };

    if (tSpeed < 0.05) {
      // Fully idle
      w.idle = 1;
    } else if (tSpeed < 0.35) {
      // Idle → walk blend
      const t = (tSpeed - 0.05) / 0.30;
      w.idle = 1 - t;
      if (absBack)     w.walkBack    = t;
      else if (absStrafeL) w.strafeLeft  = t;
      else if (absStrafeR) w.strafeRight = t;
      else             w.walk        = t;
    } else if (tSpeed < 0.65) {
      // Walk → run blend
      const t = (tSpeed - 0.35) / 0.30;
      if (absBack)     { w.walkBack    = 1 - t; }
      else if (absStrafeL) { w.strafeLeft  = 1 - t; }
      else if (absStrafeR) { w.strafeRight = 1 - t; }
      else             { w.walk        = 1 - t; }
      w.run = t;
    } else {
      // Run → sprint blend
      const t = (tSpeed - 0.65) / 0.35;
      w.run    = 1 - t;
      w.sprint = t;
    }

    // Apply weights with damping
    (Object.keys(w) as LocoAnim[]).forEach(name => {
      const action = this.actions.get(name as string);
      if (!action) return;
      const current = this.locoWeights.get(name) ?? 0;
      const target  = w[name];
      const next    = THREE.MathUtils.lerp(current, target, 0.12); // smooth
      this.locoWeights.set(name, next);
      action.weight = next;
      if (next > 0.001 && !this.locoActive.get(name)) { action.play(); this.locoActive.set(name, true); }
    });

    // Update locomotion state label for external consumers
    if (tSpeed < 0.05) {
      if (this.state !== 'idle' && !this._isAttacking() && !this.inOverrideLayer) this._setState('idle');
    } else if (tSpeed < 0.35) {
      const s = absBack ? 'walkBack' : absStrafeL ? 'strafeLeft' : absStrafeR ? 'strafeRight' : 'walk';
      if (this.state !== s && !this._isAttacking() && !this.inOverrideLayer) this._setState(s as PlayerState);
    } else if (tSpeed < 0.65) {
      if (this.state !== 'run' && !this._isAttacking() && !this.inOverrideLayer) this._setState('run');
    } else {
      if (this.state !== 'sprint' && !this._isAttacking() && !this.inOverrideLayer) this._setState('sprint');
    }
  }

  // ── Idle cycling ──────────────────────────────────────────────────────────

  private _updateIdleCycle(dt: number): void {
    if (this.speedParam > 0.08 || this.inOverrideLayer) return;

    this.idleCycleTimer -= dt;
    if (this.idleCycleTimer <= 0) {
      this.idleCycleTimer = 8 + Math.random() * 7;
      const variants = this.IDLE_VARIANTS.slice(1); // idle2/3/4
      const pick = variants[Math.floor(Math.random() * variants.length)];
      const act = this.actions.get(pick as string);
      if (act) {
        if (this.idleVariantAction) this.idleVariantAction.fadeOut(0.4);
        act.reset().fadeIn(0.4).play();
        this.idleVariantAction = act;
        // Fade it out after 3 seconds
        setTimeout(() => { if (act) act.fadeOut(0.5); this.idleVariantAction = null; }, 3000);
      }
    }
  }

  // ── Foot IK ───────────────────────────────────────────────────────────────

  private _updateFootIK(): void {
    if (!this.model) return;

    // Blend IK in/out based on grounded state
    const targetIKWeight = this.isGrounded ? 1 : 0;
    this.ikGroundWeight = THREE.MathUtils.lerp(this.ikGroundWeight, targetIKWeight, 0.1);
    if (this.ikGroundWeight < 0.01) return;

    // CCDIKSolver update if available
    if (this.ikSolver) {
      this.ikSolver.update();
    }

    // Procedural foot snap (works even without CCDIKSolver)
    const snapFoot = (bone: THREE.Bone, restY: number, currentIKY: number): number => {
      const wp = bone.getWorldPosition(new THREE.Vector3());
      const rayOrigin = new THREE.Vector3(wp.x, wp.y + 0.5, wp.z);
      this.ikRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
      this.ikRaycaster.far = 1.5;

      const targets = this.groundMeshes.length > 0 ? this.groundMeshes : [];
      const hits = targets.length > 0 ? this.ikRaycaster.intersectObjects(targets, false) : [];
      const targetY = hits.length > 0 ? hits[0].point.y : restY;

      return THREE.MathUtils.lerp(currentIKY, targetY, 0.15 * this.ikGroundWeight);
    };

    if (this.leftFootBone) {
      this.leftFootIKY = snapFoot(this.leftFootBone, this.leftFootRestY, this.leftFootIKY);
    }
    if (this.rightFootBone) {
      this.rightFootIKY = snapFoot(this.rightFootBone, this.rightFootRestY, this.rightFootIKY);
    }
  }

  // ── Attack hit-window detection ───────────────────────────────────────────

  onAttackHit(cb: () => void): void { this.onAttackHitCallback = cb; }

  private _checkAttackHitWindow(): void {
    if (!this._isAttacking() || this.attackHitFired) return;
    const action = this.overrideAction || this.upperAction;
    if (!action) return;
    const t = action.time / (action.getClip().duration || 1);
    // Hit window: 35%–65% through animation
    if (t >= 0.35 && t <= 0.65) {
      this.attackHitFired = true;
      this.onAttackHitCallback?.();
    }
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(dt: number, camera: THREE.Camera): void {
    if (!this.isLoaded || !this.model || !this.mixer) return;
    dt = Math.min(dt, 0.05);

    this.stateTimer += dt;
    if (this.attackTimer        > 0) this.attackTimer        -= dt;
    if (this.comboTimer         > 0) this.comboTimer         -= dt;
    if (this.dodgeCooldownTimer > 0) this.dodgeCooldownTimer -= dt;
    if (this.cameraShake        > 0) this.cameraShake        = Math.max(0, this.cameraShake - dt * 3);

    // Stamina regen (paused briefly after each use)
    if (this.staminaCooldown > 0) this.staminaCooldown -= dt;
    else if (this.stamina < 1)   this.stamina = Math.min(1, this.stamina + this.config.staminaRegen * dt);

    // Drop a dead/removed lock target automatically
    if (this.lockTarget && (!this.lockTarget.parent || this.lockTarget.userData.dead)) this.lockTarget = null;

    this._updateCamera(dt);
    this._updateLocomotion(dt);
    this._updatePhysics(dt);
    this._updateBlocking();
    this._updateBodyLean(dt);
    this._updateLocoBlend(Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2), this._getMoveDirAngle());
    this._updateIdleCycle(dt);
    this._checkAttackHitWindow();

    // Apply transforms
    this.model.position.copy(this.position);
    this.model.rotation.y = this.rotation;
    this.model.rotation.x = this.bodyLeanX;
    this.model.rotation.z = this.bodyLeanZ;

    this.mixer.update(dt);

    this._updateFootIK();

    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  // ── Sub-updaters ──────────────────────────────────────────────────────────

  private _updateCamera(dt: number): void {
    if (this.isPointerLocked) {
      this.cameraYaw   -= this.mouseMovement.x * this.config.cameraSensitivity * 0.002;
      this.cameraPitch -= this.mouseMovement.y * this.config.cameraSensitivity * 0.002;
      this.cameraPitch  = THREE.MathUtils.clamp(this.cameraPitch, this.config.minPitch, this.config.maxPitch);
    }

    // Lock-on: gently orbit the camera so it sits behind the player looking at
    // the target, while still allowing manual mouse nudges.
    if (this.lockTarget) {
      this.lockTarget.getWorldPosition(this._lockWorldPos);
      const dx = this._lockWorldPos.x - this.position.x;
      const dz = this._lockWorldPos.z - this.position.z;
      const desiredYaw = Math.atan2(-dx, -dz);
      let yd = desiredYaw - this.cameraYaw;
      while (yd >  Math.PI) yd -= Math.PI * 2;
      while (yd < -Math.PI) yd += Math.PI * 2;
      this.cameraYaw += yd * Math.min(1, 3.5 * dt);
    }

    const d = this.config.cameraDistance, h = this.config.cameraHeight;
    const lookY = this.position.y + h * 0.6;
    const goalPos = new THREE.Vector3(
      this.position.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * d,
      this.position.y + h + Math.sin(this.cameraPitch) * d,
      this.position.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * d,
    );

    // Camera collision: raycast from the look point to the desired camera
    // position and pull the camera in if an obstacle (pillar/rock) is in the way.
    let snapIn = false;
    if (this.cameraObstacles.length > 0) {
      const lookPoint = new THREE.Vector3(this.position.x, lookY, this.position.z);
      const toCam = goalPos.clone().sub(lookPoint);
      const dist = toCam.length();
      if (dist > 0.001) {
        this.camRaycaster.set(lookPoint, toCam.clone().normalize());
        this.camRaycaster.far = dist;
        const hits = this.camRaycaster.intersectObjects(this.cameraObstacles, true);
        if (hits.length > 0) {
          const safe = Math.max(0.6, hits[0].distance - 0.35);
          goalPos.copy(lookPoint).addScaledVector(toCam.normalize(), safe);
          snapIn = true; // snap inward fast to avoid clipping through geometry
        }
      }
    }

    const smooth = snapIn ? 0.6 : (1 - Math.pow(this.config.cameraSmoothing, dt));
    this.cameraPosition.lerp(goalPos, smooth);
    this.cameraTarget.lerp(new THREE.Vector3(this.position.x, lookY, this.position.z), 1 - Math.pow(this.config.cameraSmoothing, dt));

    // Apply transient camera shake (combat impacts) as a small positional jitter.
    if (this.cameraShake > 0.001) {
      const s = this.cameraShake * 0.25;
      this.cameraPosition.x += (Math.random() - 0.5) * s;
      this.cameraPosition.y += (Math.random() - 0.5) * s;
      this.cameraPosition.z += (Math.random() - 0.5) * s;
    }
  }

  private _getMoveDirAngle(): number {
    let mx = 0, mz = 0;
    if (this.keys.has('KeyW')) mz += 1;
    if (this.keys.has('KeyS')) mz -= 1;
    if (this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('KeyD')) mx += 1;

    // Angle of movement relative to character facing (not camera)
    const worldAngle = this.cameraYaw + Math.atan2(mx, mz) + Math.PI;
    let relAngle = worldAngle - this.rotation;
    while (relAngle >  Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;
    return relAngle;
  }

  private _updateLocomotion(dt: number): void {
    if (this._isLocked() || (this._isAttacking() && !this.inUpperLayer)) return;

    let mx = 0, mz = 0;
    if (this.keys.has('KeyW')) mz += 1;
    if (this.keys.has('KeyS')) mz -= 1;
    if (this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('KeyD')) mx += 1;

    const inputMag = Math.sqrt(mx * mx + mz * mz);
    // Sprinting requires forward intent AND stamina in the tank.
    this.isSprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && mz > 0 && this.stamina > 0.02;
    if (this.isSprinting && inputMag > 0.01) {
      this.stamina = Math.max(0, this.stamina - this.config.sprintStaminaDrain * dt);
      this.staminaCooldown = this.config.staminaRegenDelay;
    }

    if (inputMag > 0.01 || this.lockTarget) {
      // When locked on, the body always faces the target; otherwise it turns to
      // face the movement direction (camera-relative).
      let targetRot: number;
      if (this.lockTarget) {
        this.lockTarget.getWorldPosition(this._lockWorldPos);
        const dx = this._lockWorldPos.x - this.position.x;
        const dz = this._lockWorldPos.z - this.position.z;
        targetRot = Math.atan2(-dx, -dz);
      } else {
        targetRot = this.cameraYaw + Math.atan2(mx, mz) + Math.PI;
      }
      let diff = targetRot - this.rotation;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rotation += diff * Math.min(1, this.config.turnSpeed * dt);

      const speed = this.isCrouching ? this.config.crouchSpeed
        : this.isSprinting           ? this.config.sprintSpeed
        : (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) ? this.config.runSpeed
        : this.config.walkSpeed;

      const fwd = new THREE.Vector3(-Math.sin(this.rotation), 0, -Math.cos(this.rotation));
      const tgt = speed * Math.min(inputMag, 1);
      this.velocity.x += (fwd.x * tgt - this.velocity.x) * Math.min(1, MixamoPlayerController.VELOCITY_SPRING * dt);
      this.velocity.z += (fwd.z * tgt - this.velocity.z) * Math.min(1, MixamoPlayerController.VELOCITY_SPRING * dt);
    } else {
      this.velocity.x += (0 - this.velocity.x) * Math.min(1, MixamoPlayerController.BRAKE_SPRING * dt);
      this.velocity.z += (0 - this.velocity.z) * Math.min(1, MixamoPlayerController.BRAKE_SPRING * dt);
      if (Math.abs(this.velocity.x) < 0.005) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.005) this.velocity.z = 0;
    }

    // Update speed param (smoothed)
    const rawSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    this.speedParam = THREE.MathUtils.lerp(this.speedParam, rawSpeed, 0.15);

    // Crouch locomotion override
    if (this.isCrouching && this.isGrounded && !this._isAttacking()) {
      if (rawSpeed > 0.1 && this.state !== 'crouchWalk') {
        this._setState('crouchWalk');
        if (!this.inOverrideLayer) this._overrideCrossFade('crouchWalk', 0.2);
      } else if (rawSpeed <= 0.1 && this.state !== 'crouchIdle') {
        this._setState('crouchIdle');
        if (!this.inOverrideLayer) this._overrideCrossFade('crouchIdle', 0.2);
      }
    } else if (this.isCrouching && this.state !== 'crouchIdle' && this.state !== 'crouchWalk') {
      this.isCrouching = false; // reset if no longer grounded
    }

    // Dodge locomotion
    if (this.state === 'dodge') {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) {
        this.dodgeTimer = 0;
        this._returnToLoco(0.2);
        return;
      }
      this.velocity.x = this.dodgeDirection.x * this.config.dodgeSpeed;
      this.velocity.z = this.dodgeDirection.z * this.config.dodgeSpeed;
    }
  }

  private _updateBlocking(): void {
    const wantBlock = this.mouseButtons.has(2) && this.isGrounded && !this._isLocked() && !this._isAttacking();
    if (wantBlock && !this.isBlocking) {
      this.isBlocking = true;
      this._upperCrossFade('blockIdle', 0.15);
      if (this.state !== 'blockIdle') this._setState('blockIdle');
    } else if (!wantBlock && this.isBlocking) {
      this.isBlocking = false;
      this._exitUpperLayer(0.2);
    }
  }

  private _updateBodyLean(dt: number): void {
    const speed    = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    let rotDelta   = this.rotation - this.prevRotation;
    while (rotDelta >  Math.PI) rotDelta -= Math.PI * 2;
    while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
    this.angularVelocity = rotDelta / Math.max(dt, 0.001);
    this.prevRotation    = this.rotation;

    const k = MixamoPlayerController.LEAN_SPRING;
    const tPitch = this.isGrounded ? -speed * 0.018 : 0;
    const tRoll  = this.isGrounded ? -this.angularVelocity * 0.04 : 0;
    this.bodyLeanX += (tPitch - this.bodyLeanX) * Math.min(1, k * dt);
    this.bodyLeanZ += (tRoll  - this.bodyLeanZ) * Math.min(1, k * dt);
    this.bodyLeanX  = THREE.MathUtils.clamp(this.bodyLeanX, -0.12, 0.12);
    this.bodyLeanZ  = THREE.MathUtils.clamp(this.bodyLeanZ, -0.18, 0.18);
  }

  private _updatePhysics(dt: number): void {
    if (!this.isGrounded) {
      if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
      this.jumpVelocity  -= this.config.gravity * dt;
      this.position.y    += this.jumpVelocity * dt;

      if (this.jumpVelocity < -1.5 && this.state === 'jump') {
        this._setState('fall');
        this._overrideCrossFade('jump2', 0.25);
      }

      if (this.position.y <= this.config.groundY) {
        this.position.y    = this.config.groundY;
        this.isGrounded    = true;
        this.coyoteTimer   = 0;
        this.jumpVelocity  = 0;
        if (this.state === 'jump' || this.state === 'fall') this._returnToLoco(0.15);
      }
    } else {
      this.coyoteTimer = MixamoPlayerController.COYOTE_TIME;
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
  }

  // ── Camera apply ──────────────────────────────────────────────────────────

  applyCamera(camera: THREE.Camera): void {
    camera.position.copy(this.cameraPosition);
    camera.lookAt(this.cameraTarget);
  }

  // ── Public utility API ────────────────────────────────────────────────────

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    if (this.model) this.model.position.copy(this.position);
  }

  setRotation(r: number): void {
    this.rotation = r;
    if (this.model) this.model.rotation.y = r;
  }

  getAnimationNames(): string[] { return Array.from(this.actions.keys()); }

  playAnimationByName(name: string, fadeIn = 0.15): void {
    if (this.actions.has(name)) this._overrideCrossFade(name, fadeIn);
  }

  getCurrentAnimationName(): string { return this.overrideName || this.upperName || 'idle'; }

  getDebugInfo() {
    return {
      state: this.state,
      position: { x: +(this.position.x.toFixed(1)), y: +(this.position.y.toFixed(1)), z: +(this.position.z.toFixed(1)) },
      velocity: +(Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2).toFixed(1)),
      isGrounded: this.isGrounded,
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isBlocking: this.isBlocking,
      attackCombo: this.attackCombo,
      currentAnim: this.getCurrentAnimationName(),
      cameraYaw: Math.round((this.cameraYaw * 180 / Math.PI) % 360),
      speedParam: +(this.speedParam.toFixed(2)),
      overrideLayer: this.inOverrideLayer,
      upperLayer: this.inUpperLayer,
      stamina: +(this.stamina.toFixed(2)),
      lockedOn: !!this.lockTarget,
    };
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.boundKeyDown)        window.removeEventListener('keydown',    this.boundKeyDown);
    if (this.boundKeyUp)          window.removeEventListener('keyup',      this.boundKeyUp);
    if (this.boundMouseDown && this.container) this.container.removeEventListener('mousedown', this.boundMouseDown);
    if (this.boundMouseUp)        window.removeEventListener('mouseup',    this.boundMouseUp);
    if (this.boundMouseMove)      window.removeEventListener('mousemove',  this.boundMouseMove);
    if (this.boundContextMenu && this.container) this.container.removeEventListener('contextmenu', this.boundContextMenu);
    if (this.boundPointerLockChange) document.removeEventListener('pointerlockchange', this.boundPointerLockChange);

    if (this.mixer)              this.mixer.stopAllAction();
    if (this.model && this.scene) this.scene.remove(this.model);

    this.actions.clear();
    this.upperActions.clear();
    this.clips.clear();
    this.keys.clear();
    this.mouseButtons.clear();
    this.groundMeshes    = [];
    this.cameraObstacles = [];
    this.lockTarget      = null;
    this.ikSolver     = null;
    this.model        = null;
    this.mixer        = null;
    this.scene        = null;
    this.container    = null;
    this.isLoaded     = false;
  }

  get isPointerLockedState(): boolean { return this.isPointerLocked; }
}
