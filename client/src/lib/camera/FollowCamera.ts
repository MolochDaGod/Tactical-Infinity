/**
 * FollowCamera — unified third-person follow camera
 * ====================================================
 *
 * Single source of truth for every "follow an entity" camera in the project.
 * Replaces the three previous ad-hoc implementations:
 *   - CharacterController.ThirdPersonCamera (captain on island/world)
 *   - islandExploreManager (inline cameraAngle/cameraPitch/cameraDistance)
 *   - IslandBattlePage (inline yawRef/pitchRef + spherical math)
 *
 * Design (sbcode third-person pattern, adapted for our scene roots):
 *   • A target Object3D — what we follow (character, mount, fish, anything)
 *   • Yaw + pitch + distance — spherical orbit around the target
 *   • Smooth lerp on camera position so the camera glides instead of snapping
 *   • Smooth target swap — when setTarget() is called mid-flight, no teleport
 *   • Optional terrain clamp — accepts getGroundY(x,z) so the camera never
 *     sinks underground
 *   • Right-mouse-drag OR pointer-lock for yaw/pitch input
 *   • Wheel zoom with min/max distance
 *   • Keyboard yaw nudge (Q/E) preserved for the captain controls
 *
 * Public API matches the old ThirdPersonCamera so existing call sites keep
 * working — `camera.update(dt, targetWorldPos)` still works.
 *
 * NOT a React component. Construct once per scene, dispose when the scene
 * unmounts.
 */
import * as THREE from "three";

export interface FollowCameraConfig {
  /** Initial orbit distance (default 8). Clamped to [minDistance, maxDistance]. */
  distance?: number;
  /** Initial yaw in radians (default Math.PI = camera behind target on -Z look). */
  yaw?: number;
  /** Initial pitch in radians (default 0.3 ≈ 17°). */
  pitch?: number;
  /** Vertical offset added to target world position when computing lookAt. */
  lookAtHeight?: number;
  /** Lerp factor 0..1; higher = snappier (default 0.12). */
  smoothness?: number;
  /** Pitch clamp lo (default -0.5 ≈ -28° looking up). */
  minPitch?: number;
  /** Pitch clamp hi (default 1.2 ≈ 69° looking down). */
  maxPitch?: number;
  /** Wheel-zoom clamp lo (default 2). */
  minDistance?: number;
  /** Wheel-zoom clamp hi (default 30). */
  maxDistance?: number;
  /** Mouse sensitivity (default 0.005 rad/px). */
  mouseSensitivity?: number;
  /** Wheel-zoom step (default 0.01 units/deltaY). */
  wheelSensitivity?: number;
  /**
   * Optional ground sampler — receives world (x,z), returns world Y of
   * terrain. If provided, the camera never goes below `groundClearance` above
   * that height. Use this to prevent the camera from clipping into hills.
   */
  getGroundY?: (x: number, z: number) => number;
  /** Min vertical clearance above ground when getGroundY is provided. */
  groundClearance?: number;
  /**
   * Input mode:
   *   'right-drag' — yaw/pitch only while right mouse button is held (default)
   *   'pointer-lock' — yaw/pitch from any mouse movement (call requestLock())
   *   'always' — yaw/pitch from any movement (no button required)
   *   'none' — programmatic only; no input listeners attached
   */
  inputMode?: "right-drag" | "pointer-lock" | "always" | "none";
  /** DOM element to attach mouse/wheel listeners to (default window). */
  domElement?: HTMLElement;
  /** Enable Q/E keyboard yaw nudge (default true). */
  keyboardYaw?: boolean;
  /** Q/E rotation speed in rad/sec (default 2.5). */
  keyboardYawSpeed?: number;
}

const DEFAULTS: Required<Omit<FollowCameraConfig, "getGroundY" | "domElement">> = {
  distance: 8,
  yaw: Math.PI,
  pitch: 0.3,
  lookAtHeight: 1,
  smoothness: 0.12,
  minPitch: -0.5,
  maxPitch: 1.2,
  minDistance: 2,
  maxDistance: 30,
  mouseSensitivity: 0.005,
  wheelSensitivity: 0.01,
  groundClearance: 0.5,
  inputMode: "right-drag",
  keyboardYaw: true,
  keyboardYawSpeed: 2.5,
};

export class FollowCamera {
  public readonly camera: THREE.PerspectiveCamera;

  /** Current yaw (rad). Mutate freely; the next update() will use it. */
  public yaw: number;
  /** Current pitch (rad). */
  public pitch: number;
  /** Current orbit distance (world units). Wheel zoom modifies this. */
  public distance: number;

  private cfg: typeof DEFAULTS & Pick<FollowCameraConfig, "getGroundY" | "domElement">;

  /** What we're following. May be null (no follow); position is sampled each frame. */
  private target: THREE.Object3D | null = null;

  /** Smoothed target position — interpolates toward `target.position` to defeat target jitter. */
  private smoothTargetPos = new THREE.Vector3();

  /** Smoothed camera position — what we actually copy into camera.position. */
  private smoothCameraPos = new THREE.Vector3();

  /** True until we've received our first update; prevents an initial lerp from origin. */
  private freshTarget = true;

  // --- input state ---
  private rightDown = false;
  private pointerLocked = false;
  private keys = new Set<string>();
  private cleanupFns: Array<() => void> = [];

  constructor(camera: THREE.PerspectiveCamera, config: FollowCameraConfig = {}) {
    this.camera = camera;
    this.cfg = { ...DEFAULTS, ...config };
    this.yaw = this.cfg.yaw;
    this.pitch = this.cfg.pitch;
    this.distance = this.cfg.distance;
    this.smoothCameraPos.copy(camera.position);
    if (this.cfg.inputMode !== "none") this.attachInput();
  }

  // ────────────────────────────────────────────────────────────
  // Public — target management
  // ────────────────────────────────────────────────────────────

  /**
   * Set what to follow. Pass `null` to stop following (camera freezes in place).
   *
   * Smooth-swap: when changing targets at runtime (e.g. editor "follow this
   * fish" → "follow that boar") we do NOT teleport the smoothed positions.
   * The camera glides from its current spot toward the new target.
   */
  public setTarget(target: THREE.Object3D | null): void {
    this.target = target;
    if (target && this.freshTarget) {
      target.getWorldPosition(this.smoothTargetPos);
      this.freshTarget = false;
    }
  }

  public getTarget(): THREE.Object3D | null {
    return this.target;
  }

  /** Hard-snap the camera to its ideal position behind the current target. No lerp. */
  public snapToTarget(): void {
    if (!this.target) return;
    this.target.getWorldPosition(this.smoothTargetPos);
    this.computeIdealCameraPos(this.smoothTargetPos, this.smoothCameraPos);
    this.camera.position.copy(this.smoothCameraPos);
    this.applyLookAt(this.smoothTargetPos);
  }

  // ────────────────────────────────────────────────────────────
  // Public — per-frame
  // ────────────────────────────────────────────────────────────

  /**
   * Per-frame update.
   *
   * Call signature kept compatible with the old ThirdPersonCamera:
   *   - update(dt) — uses currently set target
   *   - update(dt, worldPos) — overrides target this frame (for callers that
   *     pass a Vector3 directly, like the existing CharacterController glue)
   */
  public update(delta: number, overrideTargetPos?: THREE.Vector3): void {
    // Keyboard yaw nudge (Q/E) — preserves CharacterController's original behavior
    if (this.cfg.keyboardYaw) {
      if (this.keys.has("q")) this.yaw += this.cfg.keyboardYawSpeed * delta;
      if (this.keys.has("e")) this.yaw -= this.cfg.keyboardYawSpeed * delta;
    }

    // Resolve target world position
    const targetWorld = _tmpVecA;
    if (overrideTargetPos) {
      targetWorld.copy(overrideTargetPos);
    } else if (this.target) {
      this.target.getWorldPosition(targetWorld);
    } else {
      // No target — just keep the camera where it is
      return;
    }

    if (this.freshTarget) {
      this.smoothTargetPos.copy(targetWorld);
      this.freshTarget = false;
    } else {
      this.smoothTargetPos.lerp(targetWorld, Math.min(1, this.cfg.smoothness * 1.5));
    }

    // Compute ideal camera position from yaw/pitch/distance
    const ideal = _tmpVecB;
    this.computeIdealCameraPos(this.smoothTargetPos, ideal);

    // Optional terrain clearance
    if (this.cfg.getGroundY) {
      const groundY = this.cfg.getGroundY(ideal.x, ideal.z);
      const minY = groundY + this.cfg.groundClearance;
      if (ideal.y < minY) ideal.y = minY;
    }

    this.smoothCameraPos.lerp(ideal, this.cfg.smoothness);
    this.camera.position.copy(this.smoothCameraPos);
    this.applyLookAt(this.smoothTargetPos);
  }

  private computeIdealCameraPos(targetPos: THREE.Vector3, out: THREE.Vector3): void {
    const horizontal = Math.cos(this.pitch) * this.distance;
    const vertical = Math.sin(this.pitch) * this.distance;
    out.set(
      targetPos.x + Math.sin(this.yaw) * horizontal,
      targetPos.y + vertical + this.cfg.lookAtHeight,
      targetPos.z + Math.cos(this.yaw) * horizontal,
    );
  }

  private applyLookAt(targetPos: THREE.Vector3): void {
    _tmpVecC.copy(targetPos);
    _tmpVecC.y += this.cfg.lookAtHeight;
    this.camera.lookAt(_tmpVecC);
  }

  // ────────────────────────────────────────────────────────────
  // Input handling
  // ────────────────────────────────────────────────────────────

  private attachInput(): void {
    const el: HTMLElement | Window = this.cfg.domElement ?? window;
    const target = el as unknown as Window;

    const onMouseDown = (e: MouseEvent) => {
      if (this.cfg.inputMode === "right-drag" && e.button === 2) this.rightDown = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (this.cfg.inputMode === "right-drag" && e.button === 2) this.rightDown = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const active =
        (this.cfg.inputMode === "right-drag" && this.rightDown) ||
        (this.cfg.inputMode === "pointer-lock" && this.pointerLocked) ||
        this.cfg.inputMode === "always";
      if (!active) return;
      const dx = e.movementX ?? 0;
      const dy = e.movementY ?? 0;
      this.yaw -= dx * this.cfg.mouseSensitivity;
      this.pitch = Math.max(
        this.cfg.minPitch,
        Math.min(this.cfg.maxPitch, this.pitch + dy * this.cfg.mouseSensitivity),
      );
    };
    const onWheel = (e: WheelEvent) => {
      this.distance = Math.max(
        this.cfg.minDistance,
        Math.min(this.cfg.maxDistance, this.distance + e.deltaY * this.cfg.wheelSensitivity),
      );
    };
    const onContext = (e: MouseEvent) => {
      if (this.cfg.inputMode === "right-drag") e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const onPointerLockChange = () => {
      this.pointerLocked =
        document.pointerLockElement === (this.cfg.domElement ?? document.body);
    };

    target.addEventListener("mousedown", onMouseDown as EventListener);
    target.addEventListener("mouseup", onMouseUp as EventListener);
    target.addEventListener("mousemove", onMouseMove as EventListener);
    target.addEventListener("wheel", onWheel as EventListener, { passive: true } as any);
    target.addEventListener("contextmenu", onContext as EventListener);
    target.addEventListener("keydown", onKeyDown as unknown as EventListener);
    target.addEventListener("keyup", onKeyUp as unknown as EventListener);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    this.cleanupFns.push(() => {
      target.removeEventListener("mousedown", onMouseDown as EventListener);
      target.removeEventListener("mouseup", onMouseUp as EventListener);
      target.removeEventListener("mousemove", onMouseMove as EventListener);
      target.removeEventListener("wheel", onWheel as EventListener);
      target.removeEventListener("contextmenu", onContext as EventListener);
      target.removeEventListener("keydown", onKeyDown as unknown as EventListener);
      target.removeEventListener("keyup", onKeyUp as unknown as EventListener);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    });
  }

  /** For pointer-lock mode: ask the browser to lock the pointer to our element. */
  public requestPointerLock(): void {
    if (this.cfg.domElement && this.cfg.inputMode === "pointer-lock") {
      this.cfg.domElement.requestPointerLock?.();
    }
  }

  /** Release all listeners. Safe to call multiple times. */
  public dispose(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns.length = 0;
  }

  // ────────────────────────────────────────────────────────────
  // Convenience aliases (back-compat with old ThirdPersonCamera)
  // ────────────────────────────────────────────────────────────

  /** @deprecated use `yaw` */
  public get angle(): number {
    return this.yaw;
  }
  public set angle(v: number) {
    this.yaw = v;
  }
}

// Reusable scratch vectors — avoid allocating in hot path
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();

export function createFollowCamera(
  camera: THREE.PerspectiveCamera,
  config?: FollowCameraConfig,
): FollowCamera {
  return new FollowCamera(camera, config);
}
