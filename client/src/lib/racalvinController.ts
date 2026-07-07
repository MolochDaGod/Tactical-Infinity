import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface RacalvinControllerConfig {
  maxSpeed: number;
  walkSpeed: number;
  acceleration: number;
  deceleration: number;
  
  turnSpeedFast: number;
  turnSpeedNormal: number;
  turnSpeedSlow: number;
  turnSpeedWater: number;
  
  tiltSpeed: number;
  tiltMax: number;
  
  gravity: number;
  jumpVelocity: number;
  doubleJumpMultiplier: number;
  tripleJumpMultiplier: number;
  
  swimSpeed: number;
  swimAccel: number;
  swimFriction: number;
  wadeDepth: number;
  swimDepth: number;
  
  cameraDistance: number;
  cameraHeight: number;
  cameraPitch: number;
  cameraSensitivity: number;
  cameraSmoothing: number;
  minPitch: number;
  maxPitch: number;
  
  rollSpeed: number;
  rollDuration: number;
  rollCooldown: number;
  rollIframes: number;
  
  ledgeGrabRange: number;
  ledgeClimbSpeed: number;
  
  attackDuration: number;
  attackCooldown: number;
  comboCooldown: number;
  
  hitReactDuration: number;
}

export const DEFAULT_RACALVIN_CONFIG: RacalvinControllerConfig = {
  maxSpeed: 8,
  walkSpeed: 3.2,
  acceleration: 25,
  deceleration: 15,
  
  turnSpeedFast: Math.PI,
  turnSpeedNormal: Math.PI / 2,
  turnSpeedSlow: Math.PI / 3,
  turnSpeedWater: DEG2RAD * 60,
  
  tiltSpeed: DEG2RAD * 37.5,
  tiltMax: DEG2RAD * 12,
  
  gravity: 25,
  jumpVelocity: 10,
  doubleJumpMultiplier: 1.3,
  tripleJumpMultiplier: 1.7,
  
  swimSpeed: 5,
  swimAccel: 8,
  swimFriction: 3,
  wadeDepth: 0.5,
  swimDepth: 1.2,
  
  cameraDistance: 5,
  cameraHeight: 2,
  cameraPitch: 0.3,
  cameraSensitivity: 2.5,
  cameraSmoothing: 0.08,
  minPitch: -0.8,
  maxPitch: 1.2,
  
  rollSpeed: 12,
  rollDuration: 0.5,
  rollCooldown: 0.8,
  rollIframes: 0.4,
  
  ledgeGrabRange: 0.8,
  ledgeClimbSpeed: 3,
  
  attackDuration: 0.5,
  attackCooldown: 1.0,
  comboCooldown: 1.5,
  
  hitReactDuration: 0.4,
};

export type CharacterState = 
  | 'idle' | 'walk' | 'walk_back' | 'run'
  | 'turn_left' | 'turn_right' | 'turn_180'
  | 'jump' | 'double_jump' | 'triple_jump' | 'fall' | 'land'
  | 'attack1' | 'attack2' | 'attack3'
  | 'block' | 'block_hit' | 'strafe_left' | 'strafe_right'
  | 'roll_forward' | 'roll_back' | 'roll_left' | 'roll_right'
  | 'slide' | 'slide_back'
  | 'hang' | 'shimmy_left' | 'shimmy_right' | 'climb_up' | 'climb_down'
  | 'swim' | 'swim_idle' | 'wade' | 'dive'
  | 'hit_front' | 'hit_back' | 'hit_left' | 'hit_right'
  | 'death';

export type HitDirection = 'front' | 'back' | 'left' | 'right';

export interface RacalvinInput {
  moveX: number;
  moveY: number;
  turnLeft: boolean;
  turnRight: boolean;
  shift: boolean;
  cameraX: number;
  cameraY: number;
  jump: boolean;
  attack: boolean;
  block: boolean;
  roll: boolean;
  interact: boolean;
  cUp: boolean;
  cDown: boolean;
  cLeft: boolean;
  cRight: boolean;
}

export interface CharacterData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  forwardVel: number;
  sideVel: number;
  
  faceAngle: number;
  intendedYaw: number;
  intendedMag: number;
  
  bodyTilt: number;
  headTurn: number;
  
  isGrounded: boolean;
  isJumping: boolean;
  isFalling: boolean;
  isInvulnerable: boolean;
  
  jumpCount: number;
  jumpComboTimer: number;
  lastLandTime: number;
  
  attackCombo: number;
  attackTimer: number;
  attackCooldown: number;
  
  rollTimer: number;
  rollCooldown: number;
  rollDirection: THREE.Vector3;
  
  hitReactTimer: number;
  hitDirection: HitDirection;
  
  isHanging: boolean;
  hangLedge: THREE.Vector3 | null;
  hangNormal: THREE.Vector3 | null;
  climbProgress: number;
  
  isSwimming: boolean;
  isWading: boolean;
  swimDepth: number;
  
  isSliding: boolean;
  slideAngle: number;
  
  isBlocking: boolean;
  isWalkingBack: boolean;
  isTurning: boolean;
  turn180Timer: number;
  
  wallContact: THREE.Vector3 | null;
  wallNormal: THREE.Vector3 | null;
  
  state: CharacterState;
  prevState: CharacterState;
  stateTime: number;
}

export interface CameraData {
  position: THREE.Vector3;
  focus: THREE.Vector3;
  goalPosition: THREE.Vector3;
  goalFocus: THREE.Vector3;
  yaw: number;
  pitch: number;
  distance: number;
  mode: 'behind' | 'combat' | 'aim' | 'free';
}

export class RacalvinController {
  public config: RacalvinControllerConfig;
  public character: CharacterData;
  public camera: CameraData;
  
  private input: RacalvinInput;
  private prevInput: RacalvinInput;
  private keys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  private mouseMovement = { x: 0, y: 0 };
  private isPointerLocked = false;
  private useExternalInput = false;
  
  private raycaster = new THREE.Raycaster();
  private groundLayers: THREE.Object3D[] = [];
  private wallLayers: THREE.Object3D[] = [];
  private ledgeLayers: THREE.Object3D[] = [];
  
  constructor(config: Partial<RacalvinControllerConfig> = {}) {
    this.config = { ...DEFAULT_RACALVIN_CONFIG, ...config };
    
    this.character = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      forwardVel: 0,
      sideVel: 0,
      faceAngle: 0,
      intendedYaw: 0,
      intendedMag: 0,
      bodyTilt: 0,
      headTurn: 0,
      isGrounded: true,
      isJumping: false,
      isFalling: false,
      isInvulnerable: false,
      jumpCount: 0,
      jumpComboTimer: 0,
      lastLandTime: 0,
      attackCombo: 0,
      attackTimer: 0,
      attackCooldown: 0,
      rollTimer: 0,
      rollCooldown: 0,
      rollDirection: new THREE.Vector3(),
      hitReactTimer: 0,
      hitDirection: 'front',
      isHanging: false,
      hangLedge: null,
      hangNormal: null,
      climbProgress: 0,
      isSwimming: false,
      isWading: false,
      swimDepth: 0,
      isSliding: false,
      slideAngle: 0,
      isBlocking: false,
      isWalkingBack: false,
      isTurning: false,
      turn180Timer: 0,
      wallContact: null,
      wallNormal: null,
      state: 'idle',
      prevState: 'idle',
      stateTime: 0,
    };
    
    this.camera = {
      position: new THREE.Vector3(0, this.config.cameraHeight, this.config.cameraDistance),
      focus: new THREE.Vector3(),
      goalPosition: new THREE.Vector3(),
      goalFocus: new THREE.Vector3(),
      yaw: 0,
      pitch: this.config.cameraPitch,
      distance: this.config.cameraDistance,
      mode: 'behind',
    };
    
    this.input = this.createEmptyInput();
    this.prevInput = this.createEmptyInput();
  }
  
  private createEmptyInput(): RacalvinInput {
    return {
      moveX: 0,
      moveY: 0,
      turnLeft: false,
      turnRight: false,
      shift: false,
      cameraX: 0,
      cameraY: 0,
      jump: false,
      attack: false,
      block: false,
      roll: false,
      interact: false,
      cUp: false,
      cDown: false,
      cLeft: false,
      cRight: false,
    };
  }
  
  setGroundLayers(layers: THREE.Object3D[]): void {
    this.groundLayers = layers;
  }
  
  setWallLayers(layers: THREE.Object3D[]): void {
    this.wallLayers = layers;
  }
  
  setLedgeLayers(layers: THREE.Object3D[]): void {
    this.ledgeLayers = layers;
  }
  
  setInput(input: Partial<RacalvinInput>): void {
    this.useExternalInput = true;
    Object.assign(this.input, input);
  }
  
  setExternalInputMode(enabled: boolean): void {
    this.useExternalInput = enabled;
  }
  
  setupInputListeners(container: HTMLElement): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code.toLowerCase());
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code.toLowerCase());
    });
    
    container.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(e.button);
    });
    
    container.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(e.button);
    });
    
    container.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseMovement.x += e.movementX;
        this.mouseMovement.y += e.movementY;
      }
    });
    
    container.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        container.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === container;
    });
  }
  
  private updateInputFromKeyboard(): void {
    const shift = this.keys.has('shiftleft') || this.keys.has('shiftright');
    const aKey = this.keys.has('keya') || this.keys.has('arrowleft');
    const dKey = this.keys.has('keyd') || this.keys.has('arrowright');
    
    // Tank controls: W/S for forward/back, A/D for turning (unless blocking)
    let moveY = 0;
    if (this.keys.has('keyw') || this.keys.has('arrowup')) moveY = 1;
    if (this.keys.has('keys') || this.keys.has('arrowdown')) moveY = -1;
    
    // A/D are used for turning, not strafing (unless blocking)
    // When blocking, A/D become strafe
    const isBlocking = this.mouseButtons.has(2);
    
    this.input.moveX = isBlocking ? (aKey ? -1 : dKey ? 1 : 0) : 0;
    this.input.moveY = moveY;
    this.input.turnLeft = aKey && !isBlocking;
    this.input.turnRight = dKey && !isBlocking;
    this.input.shift = shift;
    this.input.jump = this.keys.has('space');
    this.input.attack = this.mouseButtons.has(0);
    this.input.block = isBlocking;
    this.input.roll = shift && moveY !== 0; // Roll only when shift + direction
    this.input.interact = this.keys.has('keye') || this.keys.has('keyf');
    
    this.input.cUp = this.keys.has('keyi');
    this.input.cDown = this.keys.has('keyk');
    this.input.cLeft = this.keys.has('keyj');
    this.input.cRight = this.keys.has('keyl');
    
    const mouseSensitivity = 0.002;
    this.input.cameraX = this.mouseMovement.x * mouseSensitivity;
    this.input.cameraY = this.mouseMovement.y * mouseSensitivity;
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }
  
  update(delta: number, groundHeight: number = 0, waterLevel?: number): void {
    this.prevInput = { ...this.input };
    
    if (!this.useExternalInput) {
      this.updateInputFromKeyboard();
    }
    
    this.updateCamera(delta);
    this.calculateIntendedDirection();
    
    const char = this.character;
    char.stateTime += delta;
    
    if (waterLevel !== undefined && char.position.y < waterLevel) {
      this.updateSwimming(delta, waterLevel, groundHeight);
    } else {
      char.isSwimming = false;
      char.isWading = false;
      char.swimDepth = 0;
      
      if (char.isHanging) {
        this.updateHanging(delta);
      } else if (char.rollTimer > 0) {
        this.updateRoll(delta, groundHeight);
      } else if (char.hitReactTimer > 0) {
        this.updateHitReaction(delta, groundHeight);
      } else {
        this.updateMovement(delta, groundHeight);
      }
    }
    
    this.updateBodyTilt(delta);
    this.updateCameraPosition(delta);
    this.updateState();
  }
  
  private calculateIntendedDirection(): void {
    const { moveX, moveY } = this.input;
    const char = this.character;
    
    // For tank controls: intendedMag is based on forward/back movement only
    // A/D for turning is handled separately in updateMovement
    if (char.isBlocking && moveX !== 0) {
      // When blocking, A/D become strafe - use camera-relative strafing
      char.intendedMag = Math.abs(moveX);
      const stickAngle = Math.atan2(-moveX, 0);
      char.intendedYaw = this.camera.yaw + stickAngle + Math.PI;
    } else {
      // Tank controls: moveY only (forward/back)
      char.intendedMag = Math.abs(moveY);
      char.isWalkingBack = moveY < 0;
    }
  }
  
  private updateCamera(delta: number): void {
    const { cameraSensitivity, minPitch, maxPitch } = this.config;
    
    this.camera.yaw -= this.input.cameraX * cameraSensitivity;
    this.camera.pitch += this.input.cameraY * cameraSensitivity;
    
    const cButtonSpeed = DEG2RAD * 45;
    if (this.input.cLeft && !this.prevInput.cLeft) this.camera.yaw += cButtonSpeed;
    if (this.input.cRight && !this.prevInput.cRight) this.camera.yaw -= cButtonSpeed;
    if (this.input.cUp && !this.prevInput.cUp) this.camera.pitch -= DEG2RAD * 15;
    if (this.input.cDown && !this.prevInput.cDown) this.camera.pitch += DEG2RAD * 15;
    
    this.camera.pitch = Math.max(minPitch, Math.min(maxPitch, this.camera.pitch));
    
    while (this.camera.yaw > Math.PI) this.camera.yaw -= Math.PI * 2;
    while (this.camera.yaw < -Math.PI) this.camera.yaw += Math.PI * 2;
  }
  
  private updateMovement(delta: number, groundHeight: number): void {
    const { 
      maxSpeed, walkSpeed, acceleration, deceleration,
      turnSpeedFast, turnSpeedNormal,
      gravity, jumpVelocity, doubleJumpMultiplier, tripleJumpMultiplier,
      attackDuration, attackCooldown, comboCooldown,
      rollSpeed, rollDuration, rollCooldown
    } = this.config;
    
    const char = this.character;
    const now = performance.now();
    const JUMP_COMBO_WINDOW = 400;
    
    const wasGrounded = char.isGrounded;
    char.isGrounded = char.position.y <= groundHeight + 0.05;
    
    if (char.isGrounded && !wasGrounded) {
      char.velocity.y = 0;
      char.position.y = groundHeight;
      char.isJumping = false;
      char.isFalling = false;
      char.lastLandTime = now;
    }
    
    if (char.isGrounded && now - char.lastLandTime > JUMP_COMBO_WINDOW) {
      char.jumpCount = 0;
    }
    
    if (char.attackCooldown > 0) char.attackCooldown -= delta;
    if (char.attackTimer > 0) {
      char.attackTimer -= delta;
    }
    if (char.rollCooldown > 0) char.rollCooldown -= delta;
    
    if (this.input.jump && !this.prevInput.jump && char.attackTimer <= 0) {
      if (char.isGrounded) {
        const timeSinceLand = now - char.lastLandTime;
        const canCombo = timeSinceLand < JUMP_COMBO_WINDOW && char.jumpCount > 0;
        
        if (canCombo && char.jumpCount === 1) {
          char.velocity.y = jumpVelocity * doubleJumpMultiplier;
          char.jumpCount = 2;
        } else if (canCombo && char.jumpCount === 2) {
          char.velocity.y = jumpVelocity * tripleJumpMultiplier;
          char.jumpCount = 3;
        } else {
          char.velocity.y = jumpVelocity;
          char.jumpCount = 1;
        }
        char.isJumping = true;
        char.isGrounded = false;
      }
    }
    
    if (this.input.attack && !this.prevInput.attack && char.attackTimer <= 0) {
      if (char.isGrounded && char.rollTimer <= 0) {
        char.attackTimer = attackDuration;
        char.attackCombo = char.attackCooldown > 0 && char.attackCombo < 3 ? char.attackCombo + 1 : 1;
        char.attackCooldown = char.attackCombo === 3 ? comboCooldown : attackCooldown;
        char.forwardVel += 2 * char.attackCombo;
      }
    }
    
    char.isBlocking = this.input.block && char.isGrounded && char.attackTimer <= 0 && char.rollTimer <= 0;
    
    if (this.input.roll && !this.prevInput.roll && char.rollCooldown <= 0) {
      if (char.isGrounded && char.attackTimer <= 0) {
        char.rollTimer = rollDuration;
        char.rollCooldown = rollCooldown;
        char.isInvulnerable = true;
        
        if (char.intendedMag > 0.1) {
          char.rollDirection.set(
            Math.sin(char.intendedYaw),
            0,
            Math.cos(char.intendedYaw)
          );
        } else {
          char.rollDirection.set(
            Math.sin(char.faceAngle),
            0,
            Math.cos(char.faceAngle)
          );
        }
      }
    }
    
    // Handle 180 turn (Shift + D)
    if (this.input.shift && this.input.turnRight && !this.prevInput.turnRight && char.turn180Timer <= 0) {
      char.turn180Timer = 0.4; // Duration of 180 turn
      char.isTurning = true;
    }
    
    // Update 180 turn timer
    if (char.turn180Timer > 0) {
      char.turn180Timer -= delta;
      // Rotate 180 degrees over the duration
      char.faceAngle += (Math.PI / 0.4) * delta;
      while (char.faceAngle > Math.PI) char.faceAngle -= Math.PI * 2;
      
      if (char.turn180Timer <= 0) {
        char.turn180Timer = 0;
        char.isTurning = false;
      }
    }
    
    if (char.isGrounded && char.attackTimer <= 0 && !char.isBlocking && char.turn180Timer <= 0) {
      // Tank controls: A/D for turning, not strafing
      // In Three.js: positive Y rotation = counter-clockwise from above
      // A = turn left (add to faceAngle), D = turn right (subtract from faceAngle)
      char.isTurning = this.input.turnLeft || this.input.turnRight;
      
      if (this.input.turnLeft) {
        char.faceAngle += turnSpeedNormal * delta; // Turn left = counter-clockwise = add
      }
      if (this.input.turnRight && !this.input.shift) {
        char.faceAngle -= turnSpeedNormal * delta; // Turn right = clockwise = subtract
      }
      
      // Normalize face angle
      while (char.faceAngle > Math.PI) char.faceAngle -= Math.PI * 2;
      while (char.faceAngle < -Math.PI) char.faceAngle += Math.PI * 2;
      
      if (char.intendedMag > 0.1) {
        const isRunning = char.intendedMag > 0.8 && !char.isWalkingBack;
        const targetSpeed = isRunning ? maxSpeed : walkSpeed;
        
        if (char.isWalkingBack) {
          // Walking backwards - move in opposite direction of face angle
          char.forwardVel -= acceleration * delta;
          if (char.forwardVel < -walkSpeed * 0.6) {
            char.forwardVel = -walkSpeed * 0.6; // Slower backwards
          }
        } else {
          // Moving forward
          char.forwardVel += acceleration * delta;
          if (char.forwardVel > targetSpeed * char.intendedMag) {
            char.forwardVel = targetSpeed * char.intendedMag;
          }
        }
      } else {
        // Decelerate when not moving
        if (char.forwardVel > 0) {
          char.forwardVel = Math.max(0, char.forwardVel - deceleration * delta);
        } else if (char.forwardVel < 0) {
          char.forwardVel = Math.min(0, char.forwardVel + deceleration * delta);
        }
      }
    } else if (char.isBlocking && char.isGrounded) {
      // When blocking, A/D are strafe - use camera-relative movement
      if (char.intendedMag > 0.1) {
        let angleDiff = char.intendedYaw - char.faceAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Strafe sideways while blocking (don't turn)
        char.sideVel = Math.sin(angleDiff) * walkSpeed * 0.7;
      } else {
        char.sideVel = 0;
      }
    } else if (!char.isGrounded) {
      if (char.intendedMag > 0.1) {
        const intendedDYaw = char.intendedYaw - char.faceAngle;
        char.forwardVel += 0.5 * Math.cos(intendedDYaw) * char.intendedMag * delta;
        char.faceAngle += 0.3 * Math.sin(intendedDYaw) * char.intendedMag * delta;
      }
      char.forwardVel *= Math.pow(0.99, delta * 60);
    }
    
    // Apply velocity based on facing direction
    char.velocity.x = Math.sin(char.faceAngle) * char.forwardVel;
    char.velocity.z = Math.cos(char.faceAngle) * char.forwardVel;
    
    // Add strafe velocity for blocking
    if (char.isBlocking) {
      const strafeAngle = char.faceAngle + Math.PI / 2;
      char.velocity.x += Math.sin(strafeAngle) * char.sideVel;
      char.velocity.z += Math.cos(strafeAngle) * char.sideVel;
    }
    
    if (!char.isGrounded) {
      char.velocity.y -= gravity * delta;
      char.isFalling = char.velocity.y < -1;
    }
    
    char.position.x += char.velocity.x * delta;
    char.position.y += char.velocity.y * delta;
    char.position.z += char.velocity.z * delta;
    
    if (char.position.y < groundHeight) {
      char.position.y = groundHeight;
      char.velocity.y = 0;
      char.isGrounded = true;
    }
  }
  
  private updateRoll(delta: number, groundHeight: number): void {
    const char = this.character;
    const { rollSpeed, rollIframes, rollDuration } = this.config;
    
    char.rollTimer -= delta;
    
    if (char.rollTimer < rollDuration - rollIframes) {
      char.isInvulnerable = false;
    }
    
    const rollProgress = 1 - (char.rollTimer / rollDuration);
    const speed = rollSpeed * (1 - rollProgress * 0.5);
    
    char.velocity.x = char.rollDirection.x * speed;
    char.velocity.z = char.rollDirection.z * speed;
    
    char.position.x += char.velocity.x * delta;
    char.position.z += char.velocity.z * delta;
    
    char.faceAngle = Math.atan2(char.rollDirection.x, char.rollDirection.z);
    
    if (char.rollTimer <= 0) {
      char.rollTimer = 0;
      char.isInvulnerable = false;
      char.forwardVel = 0;
    }
  }
  
  private updateHitReaction(delta: number, groundHeight: number): void {
    const char = this.character;
    const { gravity } = this.config;
    
    char.hitReactTimer -= delta;
    
    const knockbackSpeed = 5 * (char.hitReactTimer / this.config.hitReactDuration);
    
    let knockbackAngle = char.faceAngle;
    switch (char.hitDirection) {
      case 'front': knockbackAngle += Math.PI; break;
      case 'back': break;
      case 'left': knockbackAngle -= Math.PI / 2; break;
      case 'right': knockbackAngle += Math.PI / 2; break;
    }
    
    char.velocity.x = Math.sin(knockbackAngle) * knockbackSpeed;
    char.velocity.z = Math.cos(knockbackAngle) * knockbackSpeed;
    
    if (!char.isGrounded) {
      char.velocity.y -= gravity * delta;
    }
    
    char.position.x += char.velocity.x * delta;
    char.position.y += char.velocity.y * delta;
    char.position.z += char.velocity.z * delta;
    
    if (char.position.y < groundHeight) {
      char.position.y = groundHeight;
      char.velocity.y = 0;
      char.isGrounded = true;
    }
    
    if (char.hitReactTimer <= 0) {
      char.hitReactTimer = 0;
    }
  }
  
  private updateHanging(delta: number): void {
    const char = this.character;
    const { ledgeClimbSpeed } = this.config;
    
    if (!char.hangLedge || !char.hangNormal) {
      char.isHanging = false;
      return;
    }
    
    if (this.input.moveY > 0.5) {
      char.climbProgress += ledgeClimbSpeed * delta;
      if (char.climbProgress >= 1) {
        const climbOffset = new THREE.Vector3()
          .copy(char.hangNormal)
          .multiplyScalar(-0.5);
        char.position.copy(char.hangLedge).add(climbOffset);
        char.position.y = char.hangLedge.y + 0.1;
        char.isHanging = false;
        char.hangLedge = null;
        char.hangNormal = null;
        char.climbProgress = 0;
        char.isGrounded = true;
      }
    } else if (this.input.moveY < -0.5) {
      char.isHanging = false;
      char.hangLedge = null;
      char.hangNormal = null;
      char.climbProgress = 0;
      char.velocity.y = -2;
    }
    
    if (this.input.moveX !== 0 && char.hangLedge && char.hangNormal) {
      const shimmy = new THREE.Vector3()
        .crossVectors(char.hangNormal, new THREE.Vector3(0, 1, 0))
        .normalize()
        .multiplyScalar(this.input.moveX * 2 * delta);
      char.hangLedge.add(shimmy);
      char.position.x = char.hangLedge.x + char.hangNormal.x * 0.3;
      char.position.z = char.hangLedge.z + char.hangNormal.z * 0.3;
    }
    
    if (this.input.jump && !this.prevInput.jump) {
      char.isHanging = false;
      char.velocity.y = this.config.jumpVelocity * 0.7;
      char.velocity.x = -char.hangNormal!.x * 5;
      char.velocity.z = -char.hangNormal!.z * 5;
      char.hangLedge = null;
      char.hangNormal = null;
      char.climbProgress = 0;
    }
  }
  
  private updateSwimming(delta: number, waterLevel: number, groundHeight: number): void {
    const char = this.character;
    const { swimSpeed, swimAccel, swimFriction, wadeDepth, swimDepth, turnSpeedWater, gravity } = this.config;
    
    const depth = waterLevel - char.position.y;
    char.swimDepth = depth;
    
    if (depth < wadeDepth) {
      char.isWading = true;
      char.isSwimming = false;
    } else if (depth > swimDepth) {
      char.isSwimming = true;
      char.isWading = false;
    } else {
      char.isWading = true;
      char.isSwimming = false;
    }
    
    if (char.isSwimming) {
      if (char.intendedMag > 0.1) {
        let angleDiff = char.intendedYaw - char.faceAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const maxTurn = turnSpeedWater * delta;
        if (Math.abs(angleDiff) < maxTurn) {
          char.faceAngle = char.intendedYaw;
        } else {
          char.faceAngle += Math.sign(angleDiff) * maxTurn;
        }
        
        char.forwardVel = Math.min(char.forwardVel + swimAccel * delta, swimSpeed);
      } else {
        char.forwardVel *= Math.pow(0.1, delta);
      }
      
      char.forwardVel = Math.max(0, char.forwardVel - swimFriction * delta);
      
      char.velocity.x = Math.sin(char.faceAngle) * char.forwardVel;
      char.velocity.z = Math.cos(char.faceAngle) * char.forwardVel;
      
      const targetY = waterLevel - 0.3;
      const vertDiff = targetY - char.position.y;
      char.velocity.y += vertDiff * 4 * delta;
      
      if (this.input.jump && !this.prevInput.jump && depth < 1) {
        char.velocity.y = this.config.jumpVelocity * 0.8;
      }
      
      char.velocity.y *= Math.pow(0.5, delta);
    } else {
      const speedMod = char.isWading ? 0.6 : 1;
      if (char.intendedMag > 0.1) {
        let angleDiff = char.intendedYaw - char.faceAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const turnSpeed = this.config.turnSpeedNormal * speedMod;
        const maxTurn = turnSpeed * delta;
        if (Math.abs(angleDiff) < maxTurn) {
          char.faceAngle = char.intendedYaw;
        } else {
          char.faceAngle += Math.sign(angleDiff) * maxTurn;
        }
        
        char.forwardVel += this.config.acceleration * speedMod * delta;
        if (char.forwardVel > this.config.walkSpeed * speedMod) {
          char.forwardVel = this.config.walkSpeed * speedMod;
        }
      } else {
        char.forwardVel = Math.max(0, char.forwardVel - this.config.deceleration * delta);
      }
      
      char.velocity.x = Math.sin(char.faceAngle) * char.forwardVel;
      char.velocity.z = Math.cos(char.faceAngle) * char.forwardVel;
      
      if (char.position.y > groundHeight + 0.05) {
        char.velocity.y -= gravity * 0.5 * delta;
      } else {
        char.velocity.y = 0;
        char.isGrounded = true;
      }
    }
    
    char.position.x += char.velocity.x * delta;
    char.position.y += char.velocity.y * delta;
    char.position.z += char.velocity.z * delta;
    
    if (char.position.y < groundHeight) {
      char.position.y = groundHeight;
      char.velocity.y = 0;
    }
  }
  
  private updateBodyTilt(delta: number): void {
    const char = this.character;
    const { tiltSpeed, tiltMax } = this.config;
    
    let targetTilt = 0;
    
    if (char.forwardVel > 1 && char.isGrounded) {
      let angleDiff = char.intendedYaw - char.faceAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      const turnStrength = Math.min(1, Math.abs(angleDiff) / (Math.PI / 4));
      targetTilt = Math.sign(angleDiff) * tiltMax * turnStrength * (char.forwardVel / this.config.maxSpeed);
    }
    
    const tiltDiff = targetTilt - char.bodyTilt;
    char.bodyTilt += Math.sign(tiltDiff) * Math.min(Math.abs(tiltDiff), tiltSpeed * delta);
  }
  
  private updateCameraPosition(delta: number): void {
    const char = this.character;
    const { cameraDistance, cameraHeight, cameraSmoothing } = this.config;
    
    const offset = new THREE.Vector3(
      cameraDistance * Math.sin(this.camera.yaw) * Math.cos(this.camera.pitch),
      cameraDistance * Math.sin(this.camera.pitch) + cameraHeight,
      cameraDistance * Math.cos(this.camera.yaw) * Math.cos(this.camera.pitch)
    );
    
    this.camera.goalFocus.copy(char.position).add(new THREE.Vector3(0, 1.5, 0));
    this.camera.goalPosition.copy(char.position).add(offset);
    
    this.camera.position.lerp(this.camera.goalPosition, cameraSmoothing);
    this.camera.focus.lerp(this.camera.goalFocus, cameraSmoothing);
  }
  
  private updateState(): void {
    const char = this.character;
    const prev = char.state;
    
    if (char.hitReactTimer > 0) {
      char.state = `hit_${char.hitDirection}` as CharacterState;
    } else if (char.rollTimer > 0) {
      char.state = this.getRollDirectionState();
    } else if (char.isHanging) {
      if (char.climbProgress > 0) {
        char.state = 'climb_up';
      } else if (this.input.moveX < 0) {
        char.state = 'shimmy_left';
      } else if (this.input.moveX > 0) {
        char.state = 'shimmy_right';
      } else {
        char.state = 'hang';
      }
    } else if (char.isSwimming) {
      char.state = char.forwardVel > 0.5 ? 'swim' : 'swim_idle';
    } else if (char.isWading) {
      char.state = 'wade';
    } else if (char.attackTimer > 0) {
      char.state = `attack${char.attackCombo}` as CharacterState;
    } else if (char.isBlocking) {
      // Check for strafe during block
      if (this.input.moveX < 0) {
        char.state = 'strafe_left';
      } else if (this.input.moveX > 0) {
        char.state = 'strafe_right';
      } else {
        char.state = 'block';
      }
    } else if (char.turn180Timer > 0) {
      char.state = 'turn_180';
    } else if (char.isSliding) {
      char.state = 'slide';
    } else if (!char.isGrounded) {
      if (char.isJumping) {
        if (char.jumpCount === 3) char.state = 'triple_jump';
        else if (char.jumpCount === 2) char.state = 'double_jump';
        else char.state = 'jump';
      } else if (char.isFalling) {
        char.state = 'fall';
      }
    } else {
      // Ground movement states
      if (char.forwardVel > this.config.walkSpeed + 0.5) {
        char.state = 'run';
      } else if (char.forwardVel > 0.5) {
        char.state = 'walk';
      } else if (char.forwardVel < -0.1) {
        char.state = 'walk_back';
      } else if (char.isTurning && this.input.turnLeft) {
        char.state = 'turn_left';
      } else if (char.isTurning && this.input.turnRight) {
        char.state = 'turn_right';
      } else {
        char.state = 'idle';
      }
    }
    
    if (char.state !== prev) {
      char.prevState = prev;
      char.stateTime = 0;
    }
  }
  
  applyHit(direction: HitDirection, damage: number = 0): void {
    const char = this.character;
    
    if (char.isInvulnerable || char.hitReactTimer > 0) return;
    
    char.hitDirection = direction;
    char.hitReactTimer = this.config.hitReactDuration;
    char.attackTimer = 0;
    char.rollTimer = 0;
  }
  
  tryGrabLedge(ledgePosition: THREE.Vector3, ledgeNormal: THREE.Vector3): boolean {
    const char = this.character;
    
    if (char.isGrounded || char.isSwimming || char.velocity.y > 0) return false;
    
    const toledge = new THREE.Vector3().subVectors(ledgePosition, char.position);
    if (toledge.length() > this.config.ledgeGrabRange) return false;
    
    char.isHanging = true;
    char.hangLedge = ledgePosition.clone();
    char.hangNormal = ledgeNormal.clone().normalize();
    char.climbProgress = 0;
    char.velocity.set(0, 0, 0);
    
    char.faceAngle = Math.atan2(-ledgeNormal.x, -ledgeNormal.z);
    
    char.position.x = ledgePosition.x + ledgeNormal.x * 0.3;
    char.position.y = ledgePosition.y - 1.5;
    char.position.z = ledgePosition.z + ledgeNormal.z * 0.3;
    
    return true;
  }
  
  setPosition(x: number, y: number, z: number): void {
    this.character.position.set(x, y, z);
    this.character.velocity.set(0, 0, 0);
    this.character.forwardVel = 0;
    this.character.isGrounded = true;
  }
  
  applyToCamera(camera: THREE.PerspectiveCamera): void {
    camera.position.copy(this.camera.position);
    camera.lookAt(this.camera.focus);
  }
  
  applyToCharacter(model: THREE.Object3D): void {
    const char = this.character;
    
    model.position.copy(char.position);
    model.rotation.y = char.faceAngle;
    
    if (model.children[0]) {
      model.children[0].rotation.z = char.bodyTilt;
    }
  }
  
  getAnimationName(): string {
    const animMap: Record<CharacterState, string> = {
      'idle': 'Idle',
      'walk': 'Walk',
      'walk_back': 'Walk',
      'run': 'Run',
      'turn_left': 'AALeftTurn',
      'turn_right': 'AARightTurn',
      'turn_180': 'Turn180',
      'jump': 'Jump',
      'double_jump': 'Jump',
      'triple_jump': 'Jump',
      'fall': 'Fall',
      'land': 'Idle',
      'attack1': 'Attack',
      'attack2': 'Attack2',
      'attack3': 'Attack3',
      'block': 'Block',
      'block_hit': 'Block',
      'strafe_left': 'StrafeLeft',
      'strafe_right': 'StrafeRight',
      'roll_forward': 'Roll',
      'roll_back': 'Roll',
      'roll_left': 'Roll',
      'roll_right': 'Roll',
      'slide': 'Roll',
      'slide_back': 'Roll',
      'hang': 'Idle',
      'shimmy_left': 'Walk',
      'shimmy_right': 'Walk',
      'climb_up': 'Jump',
      'climb_down': 'Fall',
      'swim': 'Run',
      'swim_idle': 'Idle',
      'wade': 'Walk',
      'dive': 'Fall',
      'hit_front': 'HitFront',
      'hit_back': 'HitBack',
      'hit_left': 'HitLeft',
      'hit_right': 'HitRight',
      'death': 'Death',
    };
    return animMap[this.character.state] || 'Idle';
  }
  
  getRollDirectionState(): CharacterState {
    const char = this.character;
    const rollAngle = Math.atan2(char.rollDirection.x, char.rollDirection.z);
    let angleDiff = rollAngle - char.faceAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    if (Math.abs(angleDiff) < Math.PI / 4) return 'roll_forward';
    if (Math.abs(angleDiff) > Math.PI * 3 / 4) return 'roll_back';
    if (angleDiff > 0) return 'roll_right';
    return 'roll_left';
  }
  
  canPerformToolHit(): boolean {
    const char = this.character;
    return char.isGrounded && 
           char.attackTimer <= 0 && 
           char.rollTimer <= 0 && 
           !char.isBlocking &&
           char.hitReactTimer <= 0;
  }
  
  playToolHitAnimation(toolType: 'axe' | 'pickaxe' | 'knife' = 'axe'): boolean {
    if (!this.canPerformToolHit()) {
      return false;
    }
    
    const char = this.character;
    const { attackDuration } = this.config;
    
    char.attackTimer = attackDuration * 1.2;
    char.attackCombo = 1;
    char.forwardVel = 0;
    
    return true;
  }
  
  getEquippedTool(): { id: string; type: string } | null {
    return this.equippedTool;
  }
  
  setEquippedTool(tool: { id: string; type: string } | null) {
    this.equippedTool = tool;
  }
  
  private equippedTool: { id: string; type: string } | null = null;
}
