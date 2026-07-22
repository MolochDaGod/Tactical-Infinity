/**
 * BoatBoardingSystem — Captain character boarding, deck-walking, and swimming.
 *
 * Modes:
 *   onShip   — character walks in ship-local XZ space; ship's world matrix
 *              drives the character's world position every frame, so roll/pitch/
 *              heave all carry the character naturally without any extra physics.
 *   swimming — simple gravity + wave-buoyancy spring + WASD swim control.
 *   boarding — short animation trigger when transitioning swimming → onShip.
 *
 * Scale contract (matching OpenWaterSailing):
 *   • 1 Three.js unit ≈ 1 metre of game world.
 *   • Ship GLB loaded at scale=3; a pirate sloop ends up ~15-45m depending on model.
 *   • Captain = grudge6 CharacterBuilder (Bip001 + fleet race) — NEVER Meshy.
 *   • deckY (ship-local) defaults to 1.0 — tune upward for taller ship decks.
 */

import * as THREE from 'three';
import { calculateWaveHeightAt } from './shipPhysics';
import type { WeatherConfig } from './weatherSystem';
import { CharacterBuilder, CHAR_SCALE } from '@/lib/character/CharacterBuilder';
import { loadCaptainBuild, CLASS_TO_WEAPON_STYLE } from '@/lib/captainBuild';
import type { Race, WeaponStyle } from '@/data/toonRTSAssets';
import type { CharState } from '@/lib/character/grudgeClips';

// ─── Constants ────────────────────────────────────────────────────────────────

/** ship-local Y where the character stands on deck */
export const DECK_Y_DEFAULT = 1.0;
/** character capsule half-height in world metres */
const CHAR_HALF_H = 0.55;
/** swim speed m/s */
const SWIM_SPEED = 4.5;
/** jump-off initial upward velocity */
const JUMP_OFF_VY = 5.0;
/** jump-off forward velocity */
const JUMP_OFF_VZ = 8.0;
/** gravity m/s² */
const GRAVITY = -20.0;
/** boarding proximity threshold (metres from ship centre) */
const BOARD_DIST = 10.0;
/** walk speed in ship-local metres/s */
const WALK_SPEED = 4.0;
/** sprint multiplier */
const SPRINT_MULT = 1.75;
/** wave buoyancy spring */
const BUOY_SPRING = 8.0;
const BUOY_DAMP   = 0.6;
/** swimming drag */
const SWIM_DRAG   = 0.88;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BoardingMode = 'onShip' | 'swimming' | 'boarding';

export interface BoardingCallbacks {
  onModeChange?: (mode: BoardingMode) => void;
  onPrompt?:     (msg: string | null) => void;   // HUD prompt ("E – jump off", etc.)
  onLoaded?:     () => void;
}

// ─── BoatBoardingSystem ───────────────────────────────────────────────────────

export class BoatBoardingSystem {
  // ── Public state ──────────────────────────────────────────────────────────
  public mode:    BoardingMode = 'onShip';
  public isLoaded = false;

  /** world-space character position (sync from physics each frame) */
  public worldPos = new THREE.Vector3();

  // ── Scene references ──────────────────────────────────────────────────────
  private scene:   THREE.Scene;
  private ship:    THREE.Object3D | null = null;
  private camera:  THREE.PerspectiveCamera;
  private weather: WeatherConfig | null = null;

  // ── Character visual (grudge6 CharacterBuilder) ───────────────────────────
  private charGroup  = new THREE.Group();
  private builder: CharacterBuilder | null = null;
  private currentAnim: CharState = 'idle';

  // ── On-ship state ─────────────────────────────────────────────────────────
  /** Character position in ship-local space */
  private localPos   = new THREE.Vector3(0, DECK_Y_DEFAULT, 0);
  private localYaw   = 0;    // degrees, ship-local orientation
  private deckY      = DECK_Y_DEFAULT;

  // ── Swimming state ────────────────────────────────────────────────────────
  private swimVel    = new THREE.Vector3();
  private swimYaw    = 0;    // world yaw while swimming

  // ── Camera ────────────────────────────────────────────────────────────────
  private camTheta   = Math.PI;   // orbit horizontal
  private camPhi     = 0.3;       // orbit vertical
  private camDist    = 10;
  private camTarget  = new THREE.Vector3();
  private isDragging = false;
  private prevMouse  = new THREE.Vector2();

  // ── Input ─────────────────────────────────────────────────────────────────
  private keys = new Set<string>();
  private _keyDown: ((e: KeyboardEvent) => void) | null = null;
  private _keyUp:   ((e: KeyboardEvent) => void) | null = null;
  private _mDown:   ((e: MouseEvent) => void) | null = null;
  private _mUp:     ((e: MouseEvent) => void) | null = null;
  private _mMove:   ((e: MouseEvent) => void) | null = null;

  // ── Callbacks ──────────────────────────────────────────────────────────────
  private cb: BoardingCallbacks;
  private _container: HTMLElement | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, cb: BoardingCallbacks = {}) {
    this.scene  = scene;
    this.camera = camera;
    this.cb     = cb;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setShip(ship: THREE.Object3D | null): void { this.ship = ship; }
  setWeather(w: WeatherConfig): void          { this.weather = w; }
  setDeckY(y: number): void                   { this.deckY = y; this.localPos.y = y; }

  async load(): Promise<void> {
    // Production: fleet captain race + weapon from captain build (grudge6 CDN).
    const build = loadCaptainBuild();
    let race: Race = build?.race ?? 'human';
    let weaponStyle: WeaponStyle =
      build?.weaponStyle ??
      (build ? CLASS_TO_WEAPON_STYLE[build.classKey] : 'sword_shield');
    try {
      const saved = localStorage.getItem('tethical_captain');
      if (saved) {
        const data = JSON.parse(saved) as { race?: Race };
        if (data.race) race = data.race;
      }
    } catch {
      /* ignore */
    }

    try {
      const builder = new CharacterBuilder({
        race,
        weaponStyle,
        scale: CHAR_SCALE,
      });
      await builder.load();
      this.builder = builder;
      this.charGroup.add(builder.group);
      builder.play('idle');
    } catch (e) {
      // Last-resort: grey captain so boarding still works — never Meshy.
      console.warn('[BoatBoarding] CharacterBuilder failed — metric capsule fallback', e);
      const geo = new THREE.CapsuleGeometry(0.3, 1.1, 4, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x4a6a8a,
        roughness: 0.7,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.y = 0.85;
      this.charGroup.add(mesh);
    }

    this.scene.add(this.charGroup);
    this._playAnim('idle');

    this.isLoaded = true;
    this.cb.onLoaded?.();
  }

  setupInput(container: HTMLElement): void {
    this._container = container;

    this._keyDown = (e) => this.keys.add(e.code);
    this._keyUp   = (e) => this.keys.delete(e.code);

    this._mDown = (e) => {
      if (e.button === 2) {
        this.isDragging = true;
        this.prevMouse.set(e.clientX, e.clientY);
      }
    };
    this._mUp = (e) => { if (e.button === 2) this.isDragging = false; };
    this._mMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse.set(e.clientX, e.clientY);
      this.camTheta += dx * 0.005;
      this.camPhi    = THREE.MathUtils.clamp(this.camPhi + dy * 0.005, 0.1, 1.2);
    };

    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup',   this._keyUp);
    container.addEventListener('mousedown', this._mDown);
    window.addEventListener('mouseup',  this._mUp);
    window.addEventListener('mousemove', this._mMove);
  }

  // ── Master update ─────────────────────────────────────────────────────────

  update(dt: number, elapsed: number): void {
    if (!this.isLoaded) return;
    dt = Math.min(dt, 0.05);

    switch (this.mode) {
      case 'onShip':   this._updateOnShip(dt); break;
      case 'swimming': this._updateSwimming(dt, elapsed); break;
      case 'boarding': this._updateBoarding(dt); break;
    }

    this.builder?.update(dt);
    this._updateCamera();
  }

  /** Call this to apply the camera to the Three.js PerspectiveCamera */
  applyCamera(): void {
    const r   = this.camDist;
    const pos = new THREE.Vector3(
      this.camTarget.x + r * Math.sin(this.camTheta) * Math.cos(this.camPhi),
      this.camTarget.y + r * Math.sin(this.camPhi) + 1.5,
      this.camTarget.z + r * Math.cos(this.camTheta) * Math.cos(this.camPhi)
    );
    this.camera.position.lerp(pos, 0.08);
    this.camera.lookAt(this.camTarget);
  }

  // ── On-ship update ────────────────────────────────────────────────────────

  private _updateOnShip(dt: number): void {
    if (!this.ship) return;

    // --- WASD input in ship-local space ---
    const fwd  = this.keys.has('KeyW') ? 1 : this.keys.has('KeyS') ? -1 : 0;
    const side = this.keys.has('KeyA') ? -1 : this.keys.has('KeyD') ? 1 : 0;
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed  = WALK_SPEED * (sprint ? SPRINT_MULT : 1.0);

    if (fwd !== 0 || side !== 0) {
      // Orient yaw to movement direction (camera-relative in ship-local space)
      const moveAngle = Math.atan2(side, fwd) + this.camTheta;
      this.localYaw = THREE.MathUtils.lerp(this.localYaw, moveAngle, 0.25);

      const dx = Math.sin(moveAngle) * speed * dt;
      const dz = Math.cos(moveAngle) * speed * dt;
      this.localPos.x += dx;
      this.localPos.z -= dz;
      this._playAnim(sprint ? 'run' : 'walk');
    } else {
      this._playAnim('idle');
    }

    // Keep character on deck (no falling through)
    this.localPos.y = this.deckY + CHAR_HALF_H;

    // Soft boundary — ship-local units. At scale=3, localX 2.5→worldX 7.5m, localZ 4→worldZ 12m.
    // Tune these to match the actual ship model deck footprint.
    const halfW = 2.5;   // local half-width  ≈ 7.5m world
    const halfL = 4.0;   // local half-length ≈ 12m world
    this.localPos.x = THREE.MathUtils.clamp(this.localPos.x, -halfW, halfW);
    this.localPos.z = THREE.MathUtils.clamp(this.localPos.z, -halfL, halfL);

    // --- Transform local → world using ship's current matrix (includes roll/pitch/heave) ---
    this.ship.updateWorldMatrix(true, false);
    const worldPos = this.localPos.clone();
    this.ship.localToWorld(worldPos);
    this.worldPos.copy(worldPos);
    this.charGroup.position.copy(this.worldPos);

    // Yaw: ship's world yaw + character's local yaw offset
    const shipWorldYaw = new THREE.Euler().setFromQuaternion(this.ship.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    this.charGroup.rotation.y = shipWorldYaw + this.localYaw;

    // Roll/pitch — inherit from ship (lean with waves)
    const shipQuat = this.ship.getWorldQuaternion(new THREE.Quaternion());
    const euler = new THREE.Euler().setFromQuaternion(shipQuat, 'YXZ');
    this.charGroup.rotation.x = euler.x * 0.6;   // soften lean
    this.charGroup.rotation.z = euler.z * 0.6;

    // --- Jump off (E key) ---
    if (this.keys.has('KeyE')) {
      this._jumpOff();
    }

    // HUD prompt
    this.cb.onPrompt?.('E — jump off');
  }

  private _jumpOff(): void {
    // Compute forward direction in world space
    const fwd = new THREE.Vector3(0, 0, JUMP_OFF_VZ)
      .applyEuler(new THREE.Euler(0, this.charGroup.rotation.y, 0));

    this.swimVel.copy(fwd);
    this.swimVel.y = JUMP_OFF_VY;
    this.swimYaw   = this.charGroup.rotation.y;

    this._setMode('swimming');
    this._playAnim('jump');
  }

  // ── Swimming update ───────────────────────────────────────────────────────

  private _updateSwimming(dt: number, elapsed: number): void {
    // Gravity
    this.swimVel.y += GRAVITY * dt;

    // Wave height at current world pos
    const waveY = this.weather
      ? calculateWaveHeightAt(this.worldPos, elapsed, this.weather)
      : 0;
    const surfaceY = waveY + 0.1;

    // Buoyancy spring when near/below surface
    if (this.worldPos.y < surfaceY + 0.3) {
      const depth  = surfaceY - this.worldPos.y;
      const buoy   = depth * BUOY_SPRING - this.swimVel.y * BUOY_DAMP;
      this.swimVel.y += buoy * dt;
    }

    // WASD swim direction (world yaw follows camera)
    const fwd  = this.keys.has('KeyW') ? 1 : this.keys.has('KeyS') ? -1 : 0;
    const side = this.keys.has('KeyA') ? -1 : this.keys.has('KeyD') ? 1 : 0;
    const inWater = this.worldPos.y < surfaceY + 0.5;

    if (fwd !== 0 || side !== 0) {
      const angle = Math.atan2(side, fwd) + this.camTheta;
      this.swimYaw = THREE.MathUtils.lerp(this.swimYaw, angle, 0.15);

      const spd  = SWIM_SPEED * (inWater ? 1.0 : 1.5);
      this.swimVel.x += Math.sin(angle) * spd * dt * 8;
      this.swimVel.z -= Math.cos(angle) * spd * dt * 8;
      // No dedicated swim clip yet — walk/run read as surface stroke.
      this._playAnim(inWater ? 'walk' : 'run');
    } else {
      this._playAnim(inWater ? 'idle' : 'jump');
    }

    // Horizontal drag
    this.swimVel.x *= Math.pow(SWIM_DRAG, dt * 60);
    this.swimVel.z *= Math.pow(SWIM_DRAG, dt * 60);

    // Clamp horizontal swim speed
    const horizSpeed = Math.sqrt(this.swimVel.x ** 2 + this.swimVel.z ** 2);
    if (horizSpeed > SWIM_SPEED) {
      const s = SWIM_SPEED / horizSpeed;
      this.swimVel.x *= s;
      this.swimVel.z *= s;
    }

    // Integrate
    this.worldPos.addScaledVector(this.swimVel, dt);

    // Hard floor on wave surface
    if (this.worldPos.y < surfaceY - 0.3) this.worldPos.y = surfaceY - 0.3;

    this.charGroup.position.copy(this.worldPos);
    this.charGroup.rotation.y = this.swimYaw;
    this.charGroup.rotation.x = 0;
    this.charGroup.rotation.z = 0;

    // Board prompt
    if (this.ship) {
      const dist = this.worldPos.distanceTo(this.ship.getWorldPosition(new THREE.Vector3()));
      if (dist < BOARD_DIST) {
        this.cb.onPrompt?.('F — board ship');
        if (this.keys.has('KeyF')) this._boardShip();
        return;
      }
    }
    this.cb.onPrompt?.('WASD — swim  |  hold W near ship to board');
  }

  // ── Boarding transition ───────────────────────────────────────────────────

  private _boardShip(): void {
    if (!this.ship) return;

    // Find the ship deck point nearest to the character
    this.ship.updateWorldMatrix(true, false);

    // Snap to deck — find the world position of the deck surface (local origin lifted to deckY)
    const deckWorldPos = new THREE.Vector3(0, this.deckY + CHAR_HALF_H, 0);
    this.ship.localToWorld(deckWorldPos);

    // Project character onto deck
    const invMat = new THREE.Matrix4().copy(this.ship.matrixWorld).invert();
    const localChar = this.worldPos.clone().applyMatrix4(invMat);

    // Keep X/Z from world char pos, Y on deck
    this.localPos.set(
      THREE.MathUtils.clamp(localChar.x, -3, 3),
      this.deckY + CHAR_HALF_H,
      THREE.MathUtils.clamp(localChar.z, -8, 8)
    );

    this.swimVel.set(0, 0, 0);
    this._setMode('boarding');
    this._playAnim('jump');

    // Short boarding delay then snap to onShip
    setTimeout(() => this._setMode('onShip'), 600);
  }

  private _updateBoarding(_dt: number): void {
    if (!this.ship) return;
    // During boarding, just slide character to deck surface
    this.ship.updateWorldMatrix(true, false);
    const worldPos = this.localPos.clone();
    this.ship.localToWorld(worldPos);
    this.charGroup.position.lerp(worldPos, 0.25);
    this._playAnim('walk');
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private _updateCamera(): void {
    // Camera always orbits around the character
    this.camTarget.lerp(this.worldPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0.1);
    this.applyCamera();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _setMode(m: BoardingMode): void {
    if (m === this.mode) return;
    this.mode = m;
    this.cb.onModeChange?.(m);
  }

  private _playAnim(name: string): void {
    const state = (name === 'crouch' ? 'walk' : name) as CharState;
    if (this.currentAnim === state) return;
    this.currentAnim = state;
    this.builder?.play(state);
  }

  // ── Deck probing — auto-detect deck height via raycasting ─────────────────

  /**
   * Casts a ray downward from above the ship centre to find the actual deck surface.
   * Call this after the ship GLB is loaded and positioned to get an accurate deckY.
   */
  probeDeckHeight(ship: THREE.Object3D): number {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(ship.position.x, ship.position.y + 20, ship.position.z),
      new THREE.Vector3(0, -1, 0)
    );
    const meshes: THREE.Mesh[] = [];
    ship.traverse(c => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });

    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      // Convert hit point to ship-local Y
      const localHit = ship.worldToLocal(hits[0].point.clone());
      return localHit.y;
    }
    return DECK_Y_DEFAULT;
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    this.builder?.dispose();
    this.builder = null;
    this.scene.remove(this.charGroup);
    if (this._keyDown) window.removeEventListener('keydown', this._keyDown);
    if (this._keyUp)   window.removeEventListener('keyup',   this._keyUp);
    if (this._mUp)     window.removeEventListener('mouseup',  this._mUp);
    if (this._mMove)   window.removeEventListener('mousemove', this._mMove);
    if (this._mDown && this._container)
      this._container.removeEventListener('mousedown', this._mDown);
  }
}
