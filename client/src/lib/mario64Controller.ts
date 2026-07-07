import * as THREE from 'three';

/**
 * Mario 64-style Third Person Controller
 * 
 * Key concepts from SM64:
 * - Camera orbits around the character (Lakitu style)
 * - Analog stick movement is relative to camera facing direction
 * - Character smoothly rotates toward intended movement direction
 * - Forward velocity-based movement with acceleration/deceleration
 * - C-button (right stick) camera rotation
 * - Smooth camera interpolation (CAM_FLAG_SMOOTH_MOVEMENT)
 */

// SM64-style angle utilities (s16 angles in SM64, we use radians)
const DEGREES = (x: number) => x * Math.PI / 180;

export interface Mario64ControllerConfig {
  // Movement
  maxSpeed: number;           // Maximum forward velocity
  acceleration: number;       // How fast to accelerate
  deceleration: number;       // How fast to decelerate (friction)
  turnSpeed: number;          // How fast character rotates toward intended direction
  
  // Camera
  cameraDistance: number;     // Distance from character
  cameraHeight: number;       // Height offset from character
  cameraPitch: number;        // Default pitch angle (looking down)
  cameraSensitivity: number;  // Right-stick camera rotation speed
  cameraSmoothing: number;    // Lakitu-style smooth movement (0-1, higher = more smooth)
  minPitch: number;           // Minimum camera pitch (looking up limit)
  maxPitch: number;           // Maximum camera pitch (looking down limit)
  
  // Physics  
  gravity: number;            // Gravity acceleration
  jumpVelocity: number;       // Initial jump velocity
  groundDrag: number;         // Ground friction factor
  airDrag: number;            // Air resistance factor
}

export const DEFAULT_MARIO64_CONFIG: Mario64ControllerConfig = {
  // Movement (SM64-inspired values, scaled for our world)
  maxSpeed: 32,               // SM64: 32 units/frame at 30fps
  acceleration: 1.5,          // SM64 uses gradual acceleration
  deceleration: 0.92,         // SM64 friction on regular surfaces
  turnSpeed: 8,               // Radians per second
  
  // Camera (SM64 Lakitu camera)
  cameraDistance: 800,        // SM64: varies by mode, ~800-1000
  cameraHeight: 300,          // SM64: varies, typically 200-400
  cameraPitch: 0.3,           // Default look-down angle
  cameraSensitivity: 2.5,     // Right stick sensitivity
  cameraSmoothing: 0.08,      // Lakitu smoothing (lower = more lag)
  minPitch: -0.8,             // Can look up
  maxPitch: 1.2,              // Can look down
  
  // Physics (SM64 values, scaled)
  gravity: 40,                // SM64: ~4.0 per frame (scaled to per-second)
  jumpVelocity: 52,           // SM64: initial jump vel ~52
  groundDrag: 0.96,           // Ground friction
  airDrag: 0.99,              // Air drag
};

export interface Mario64Input {
  // Left stick / WASD - movement relative to camera
  moveX: number;      // -1 to 1 (left/right)
  moveY: number;      // -1 to 1 (back/forward)
  
  // Right stick / mouse - camera rotation
  cameraX: number;    // -1 to 1 (rotate camera left/right)
  cameraY: number;    // -1 to 1 (rotate camera up/down)
  
  // Buttons
  jump: boolean;      // A button / Space
  attack: boolean;    // Left click - melee combo
  action: boolean;    // Right click - dive bomb / dodge / slide
  
  // C-Buttons (SM64 style camera adjustment)
  cUp: boolean;
  cDown: boolean;
  cLeft: boolean;
  cRight: boolean;
}

export interface CharacterState {
  // Position
  position: THREE.Vector3;
  
  // Velocity (SM64 decomposes into forwardVel and vel[])
  velocity: THREE.Vector3;
  forwardVel: number;         // Forward velocity in facing direction
  
  // Rotation
  faceAngle: number;          // Character's facing angle (yaw)
  intendedYaw: number;        // The direction player wants to move
  intendedMag: number;        // Magnitude of stick input (0-1)
  
  // State
  isGrounded: boolean;
  isJumping: boolean;
  isFalling: boolean;
  
  // Jump combo system (Mario-style single/double/triple jump)
  jumpCount: number;          // 0 = no jump, 1 = single, 2 = double, 3 = triple
  jumpComboTimer: number;     // Timer to reset combo if too slow
  lastLandTime: number;       // When we last landed (for combo timing)
  
  // Attack system
  isAttacking: boolean;
  attackCombo: number;        // 0 = none, 1-3 = combo stage
  attackTimer: number;        // Current attack animation time
  attackCooldown: number;     // Time until next attack allowed
  
  // Falcon kick dive attack
  isDiving: boolean;          // Performing falcon kick
  diveSpeed: number;          // Dive velocity
  
  // Swimming state
  isSwimming: boolean;        // In water
  swimDepth: number;          // How deep in water (0 = surface)
  
  // Animation state (for external use)
  animationState: 'idle' | 'walk' | 'run' | 'jump' | 'double_jump' | 'triple_jump' | 'fall' | 'land' | 'attack1' | 'attack2' | 'attack3' | 'dive' | 'swim' | 'swim_idle';
}

export interface CameraState {
  // Position (SM64: Lakitu's actual position)
  position: THREE.Vector3;
  focus: THREE.Vector3;       // Where camera looks (typically character position)
  
  // Goal position (SM64: where Lakitu wants to be)
  goalPosition: THREE.Vector3;
  goalFocus: THREE.Vector3;
  
  // Orbital parameters
  yaw: number;                // Horizontal rotation around character
  pitch: number;              // Vertical tilt
  distance: number;           // Distance from character
  
  // Mode (SM64 has many camera modes)
  mode: 'behind' | 'radial' | 'fixed' | 'free';
}

export class Mario64Controller {
  public config: Mario64ControllerConfig;
  public character: CharacterState;
  public camera: CameraState;
  
  // Input state
  private input: Mario64Input;
  private prevInput: Mario64Input;
  
  // Keyboard state
  private keys: Set<string> = new Set();
  private mouseMovement: { x: number, y: number } = { x: 0, y: 0 };
  private isPointerLocked: boolean = false;
  private useExternalInput: boolean = false;
  
  constructor(config: Partial<Mario64ControllerConfig> = {}) {
    this.config = { ...DEFAULT_MARIO64_CONFIG, ...config };
    
    // Initialize character state
    this.character = {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      forwardVel: 0,
      faceAngle: 0,
      intendedYaw: 0,
      intendedMag: 0,
      isGrounded: true,
      isJumping: false,
      isFalling: false,
      // Jump combo
      jumpCount: 0,
      jumpComboTimer: 0,
      lastLandTime: 0,
      // Attack system
      isAttacking: false,
      attackCombo: 0,
      attackTimer: 0,
      attackCooldown: 0,
      // Falcon kick
      isDiving: false,
      diveSpeed: 0,
      // Swimming
      isSwimming: false,
      swimDepth: 0,
      animationState: 'idle',
    };
    
    // Initialize camera state (SM64 Lakitu style)
    this.camera = {
      position: new THREE.Vector3(0, this.config.cameraHeight, this.config.cameraDistance),
      focus: new THREE.Vector3(0, 0, 0),
      goalPosition: new THREE.Vector3(0, this.config.cameraHeight, this.config.cameraDistance),
      goalFocus: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: this.config.cameraPitch,
      distance: this.config.cameraDistance,
      mode: 'behind',
    };
    
    // Initialize input
    this.input = this.createEmptyInput();
    this.prevInput = this.createEmptyInput();
  }
  
  private createEmptyInput(): Mario64Input {
    return {
      moveX: 0,
      moveY: 0,
      cameraX: 0,
      cameraY: 0,
      jump: false,
      attack: false,
      action: false,
      cUp: false,
      cDown: false,
      cLeft: false,
      cRight: false,
    };
  }
  
  // Set external input (for use when not using built-in keyboard listeners)
  // This also sets a flag to skip internal keyboard handling in update()
  setInput(input: Partial<Mario64Input>) {
    this.useExternalInput = true;
    Object.assign(this.input, input);
  }
  
  // Enable or disable external input mode
  setExternalInputMode(enabled: boolean) {
    this.useExternalInput = enabled;
  }
  
  // Get current input state
  getInput(): Mario64Input {
    return { ...this.input };
  }
  
  // Setup keyboard/mouse input handling
  setupInputListeners(container: HTMLElement) {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    
    // Mouse movement for camera (when pointer locked)
    container.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseMovement.x += e.movementX;
        this.mouseMovement.y += e.movementY;
      }
    });
    
    // Click to lock pointer
    container.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        container.requestPointerLock();
      }
    });
    
    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === container;
    });
  }
  
  // Convert keyboard/mouse to SM64-style input
  private updateInputFromKeyboard(delta: number) {
    // WASD movement
    let moveX = 0;
    let moveY = 0;
    
    if (this.keys.has('w') || this.keys.has('arrowup')) moveY = 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) moveY = -1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) moveX = -1;
    if (this.keys.has('d') || this.keys.has('arrowright')) moveX = 1;
    
    // Normalize diagonal movement
    const mag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }
    
    this.input.moveX = moveX;
    this.input.moveY = moveY;
    
    // Jump
    this.input.jump = this.keys.has(' ');
    
    // Action
    this.input.action = this.keys.has('e') || this.keys.has('f');
    
    // C-buttons (IJKL or mouse)
    this.input.cUp = this.keys.has('i');
    this.input.cDown = this.keys.has('k');
    this.input.cLeft = this.keys.has('j');
    this.input.cRight = this.keys.has('l');
    
    // Mouse camera rotation
    const mouseSensitivity = 0.002;
    this.input.cameraX = this.mouseMovement.x * mouseSensitivity;
    this.input.cameraY = this.mouseMovement.y * mouseSensitivity;
    
    // Reset mouse movement
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }
  
  // Main update function - call this each frame
  // waterLevel: Y height of water surface (undefined = no water)
  update(delta: number, groundHeight: number = 0, waterLevel?: number) {
    this.prevInput = { ...this.input };
    
    // Only update from keyboard if not using external input
    if (!this.useExternalInput) {
      this.updateInputFromKeyboard(delta);
    }
    
    // Update camera rotation from input
    this.updateCameraRotation(delta);
    
    // Calculate intended movement direction (SM64: intendedYaw)
    this.calculateIntendedDirection();
    
    // Check if character is in water
    const char = this.character;
    if (waterLevel !== undefined && char.position.y < waterLevel) {
      const wasSwimming = char.isSwimming;
      char.isSwimming = true;
      char.swimDepth = waterLevel - char.position.y;
      
      // Handle transition into water
      if (!wasSwimming) {
        char.velocity.y *= 0.3; // Splash dampening
        char.isDiving = false;
        char.isJumping = false;
        char.forwardVel *= 0.5; // Water resistance
      }
      
      // Swimming movement (handled separately)
      this.updateSwimming(delta, waterLevel, groundHeight);
    } else {
      char.isSwimming = false;
      char.swimDepth = 0;
      
      // Update character movement (SM64: mario_execute_action)
      this.updateCharacterMovement(delta, groundHeight);
    }
    
    // Update camera position (SM64: update_lakitu)
    this.updateCameraPosition(delta);
    
    // Update animation state
    this.updateAnimationState();
  }
  
  // Swimming physics (Mario 64 water movement)
  private updateSwimming(delta: number, waterLevel: number, groundHeight: number) {
    const char = this.character;
    const SWIM_SPEED = 8;
    const SWIM_ACCEL = 15;
    const WATER_DRAG = 3;
    const BUOYANCY = 4; // Upward force keeping character at surface
    const SURFACE_OFFSET = 0.5; // Keep head above water
    
    // Swimming horizontal movement
    if (char.intendedMag > 0.1) {
      // Turn toward intended direction (slower in water)
      let angleDiff = char.intendedYaw - char.faceAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      const maxTurn = this.config.turnSpeed * 0.5 * delta;
      if (Math.abs(angleDiff) < maxTurn) {
        char.faceAngle = char.intendedYaw;
      } else {
        char.faceAngle += Math.sign(angleDiff) * maxTurn;
      }
      
      // Accelerate forward
      char.forwardVel = Math.min(char.forwardVel + SWIM_ACCEL * delta, SWIM_SPEED);
    } else {
      // Decelerate in water
      char.forwardVel *= Math.pow(0.1, delta);
    }
    
    // Apply water drag
    char.forwardVel = Math.max(0, char.forwardVel - WATER_DRAG * delta);
    
    // Apply horizontal velocity
    char.velocity.x = Math.sin(char.faceAngle) * char.forwardVel;
    char.velocity.z = Math.cos(char.faceAngle) * char.forwardVel;
    
    // Vertical movement - buoyancy pulls toward surface
    const targetY = waterLevel - SURFACE_OFFSET;
    const vertDiff = targetY - char.position.y;
    char.velocity.y += vertDiff * BUOYANCY * delta;
    
    // Jump to exit water
    if (this.input.jump && !this.prevInput.jump && char.position.y > waterLevel - 1) {
      char.velocity.y = this.config.jumpVelocity * 0.8; // Reduced jump from water
      char.isSwimming = false;
    }
    
    // Apply drag to vertical velocity
    char.velocity.y *= Math.pow(0.5, delta);
    
    // Update position
    char.position.x += char.velocity.x * delta;
    char.position.y += char.velocity.y * delta;
    char.position.z += char.velocity.z * delta;
    
    // Don't sink below water floor
    if (char.position.y < groundHeight + 0.5) {
      char.position.y = groundHeight + 0.5;
      char.velocity.y = Math.max(0, char.velocity.y);
    }
  }
  
  // SM64-style camera rotation with C-buttons and right stick
  private updateCameraRotation(delta: number) {
    const { cameraSensitivity } = this.config;
    
    // Right stick / mouse rotation
    this.camera.yaw -= this.input.cameraX * cameraSensitivity;
    this.camera.pitch += this.input.cameraY * cameraSensitivity;
    
    // C-button rotation (SM64 style - 45 degree snaps)
    const cButtonSpeed = DEGREES(90) * delta;
    if (this.input.cLeft && !this.prevInput.cLeft) {
      this.camera.yaw += DEGREES(45);
    }
    if (this.input.cRight && !this.prevInput.cRight) {
      this.camera.yaw -= DEGREES(45);
    }
    if (this.input.cUp && !this.prevInput.cUp) {
      this.camera.pitch -= DEGREES(15);
    }
    if (this.input.cDown && !this.prevInput.cDown) {
      this.camera.pitch += DEGREES(15);
    }
    
    // Clamp pitch
    this.camera.pitch = Math.max(this.config.minPitch, Math.min(this.config.maxPitch, this.camera.pitch));
    
    // Wrap yaw
    if (this.camera.yaw > Math.PI) this.camera.yaw -= Math.PI * 2;
    if (this.camera.yaw < -Math.PI) this.camera.yaw += Math.PI * 2;
  }
  
  // SM64: Calculate intended direction from stick input relative to camera
  private calculateIntendedDirection() {
    const { moveX, moveY } = this.input;
    
    // Magnitude of input (SM64: intendedMag)
    this.character.intendedMag = Math.sqrt(moveX * moveX + moveY * moveY);
    
    if (this.character.intendedMag > 0.1) {
      // Camera yaw = angle from character TO camera (0 = camera at +Z)
      // We want: W = move away from camera, D = move right of camera view
      // stickAngle mapping: W=0, D=-PI/2, S=PI, A=PI/2
      const stickAngle = Math.atan2(-moveX, moveY);
      // Add PI so forward (W) moves opposite to camera direction
      this.character.intendedYaw = this.camera.yaw + stickAngle + Math.PI;
    }
  }
  
  // SM64-style character movement with jump combos and attacks
  private updateCharacterMovement(delta: number, groundHeight: number) {
    const { 
      maxSpeed, acceleration, deceleration, turnSpeed,
      gravity, jumpVelocity, groundDrag, airDrag 
    } = this.config;
    
    const char = this.character;
    const now = performance.now();
    
    // Jump combo settings (Mario 64 style)
    const DOUBLE_JUMP_MULTIPLIER = 1.3;   // Higher than single jump
    const TRIPLE_JUMP_MULTIPLIER = 1.7;   // Highest jump
    const JUMP_COMBO_WINDOW = 400;        // ms to chain jumps
    const ATTACK_DURATION = 0.25;         // seconds per attack
    const ATTACK_COMBO_WINDOW = 0.4;      // seconds to chain attacks
    const FALCON_KICK_SPEED = 35;         // Dive velocity
    
    // Ground check
    const wasGrounded = char.isGrounded;
    char.isGrounded = char.position.y <= groundHeight + 0.1;
    
    // Just landed
    if (char.isGrounded && !wasGrounded) {
      char.velocity.y = 0;
      char.position.y = groundHeight;
      char.isJumping = false;
      char.isFalling = false;
      char.lastLandTime = now;
      
      // End dive attack on landing
      if (char.isDiving) {
        char.isDiving = false;
        char.diveSpeed = 0;
        // Could trigger landing impact effect here
      }
    }
    
    // Update jump combo timer - reset if too long since landing
    if (char.isGrounded && now - char.lastLandTime > JUMP_COMBO_WINDOW) {
      char.jumpCount = 0;
    }
    
    // Update attack cooldown
    if (char.attackCooldown > 0) {
      char.attackCooldown -= delta;
    }
    if (char.attackTimer > 0) {
      char.attackTimer -= delta;
      if (char.attackTimer <= 0) {
        char.isAttacking = false;
      }
    }
    
    // JUMP INPUT - Mario-style single/double/triple jump combo
    // Combo is tracked by jumpCount and time-based window (not velocity)
    if (this.input.jump && !this.prevInput.jump) {
      if (char.isGrounded && !char.isAttacking) {
        // Check if we're in combo window for chained jumps (based on time, not velocity)
        const timeSinceLand = now - char.lastLandTime;
        const canCombo = timeSinceLand < JUMP_COMBO_WINDOW && char.jumpCount > 0;
        
        if (canCombo && char.jumpCount === 1) {
          // Double jump - higher with spin
          char.velocity.y = jumpVelocity * DOUBLE_JUMP_MULTIPLIER;
          char.jumpCount = 2;
        } else if (canCombo && char.jumpCount === 2) {
          // Triple jump - highest with flip
          char.velocity.y = jumpVelocity * TRIPLE_JUMP_MULTIPLIER;
          char.jumpCount = 3;
        } else {
          // Single jump (or reset after triple)
          char.velocity.y = jumpVelocity;
          char.jumpCount = 1;
        }
        
        char.isJumping = true;
        char.isGrounded = false;
      }
    }
    
    // LEFT CLICK - Melee combo attack (ground only)
    if (this.input.attack && !this.prevInput.attack) {
      if (char.isGrounded && !char.isAttacking) {
        // Ground attack combo (3-hit combo)
        if (char.attackCooldown <= 0) {
          char.isAttacking = true;
          char.attackTimer = ATTACK_DURATION;
          
          // Progress combo or reset
          if (char.attackCombo < 3) {
            char.attackCombo++;
          } else {
            char.attackCombo = 1;
          }
          
          // Longer cooldown after combo 3
          char.attackCooldown = char.attackCombo === 3 ? ATTACK_COMBO_WINDOW * 2 : ATTACK_COMBO_WINDOW;
          
          // Small forward lunge with attacks
          char.forwardVel += 5 * char.attackCombo;
        }
      }
    }
    
    // RIGHT CLICK - Action: Dive bomb (air), sliding attack/dodge (ground)
    if (this.input.action && !this.prevInput.action) {
      if (!char.isGrounded && !char.isDiving) {
        // Air: FALCON KICK! Dive straight down at angle
        char.isDiving = true;
        char.diveSpeed = FALCON_KICK_SPEED;
        char.isJumping = false;
        char.isFalling = false;
        
        // Slight forward momentum
        char.forwardVel = Math.max(char.forwardVel, 8);
      } else if (char.isGrounded && !char.isAttacking && !char.isDiving) {
        // Ground: Sliding attack / dodge roll
        char.isDiving = true; // Reuse dive state for slide
        char.diveSpeed = 0; // No vertical component
        char.forwardVel = 25; // Fast horizontal slide
        char.isAttacking = true;
        char.attackTimer = 0.3; // Slide duration
        char.attackCombo = 0; // Not a combo hit
      }
    }
    
    // Handle diving (falcon kick)
    if (char.isDiving) {
      // Dive downward fast, slight forward
      char.velocity.y = -char.diveSpeed;
      char.velocity.x = Math.sin(char.faceAngle) * (char.forwardVel * 0.5);
      char.velocity.z = Math.cos(char.faceAngle) * (char.forwardVel * 0.5);
      
      // Update position during dive
      char.position.x += char.velocity.x * delta;
      char.position.y += char.velocity.y * delta;
      char.position.z += char.velocity.z * delta;
      
      // Clamp to ground
      if (char.position.y < groundHeight) {
        char.position.y = groundHeight;
        char.velocity.y = 0;
        char.isGrounded = true;
        char.isDiving = false;
        char.diveSpeed = 0;
      }
      return; // Skip normal movement during dive
    }
    
    // Horizontal movement (SM64 style)
    if (char.isGrounded && !char.isAttacking) {
      // SM64: Turn toward intended direction
      if (char.intendedMag > 0.1) {
        // Calculate angle difference
        let angleDiff = char.intendedYaw - char.faceAngle;
        
        // Normalize to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // SM64-style gradual turning
        const maxTurn = turnSpeed * delta;
        if (Math.abs(angleDiff) < maxTurn) {
          char.faceAngle = char.intendedYaw;
        } else {
          char.faceAngle += Math.sign(angleDiff) * maxTurn;
        }
        
        // Accelerate in facing direction (SM64: forwardVel)
        char.forwardVel += acceleration * char.intendedMag;
        if (char.forwardVel > maxSpeed * char.intendedMag) {
          char.forwardVel = maxSpeed * char.intendedMag;
        }
      } else {
        // Decelerate when no input (SM64: friction)
        char.forwardVel *= deceleration;
        if (Math.abs(char.forwardVel) < 0.5) {
          char.forwardVel = 0;
        }
      }
      
      // Apply ground drag
      char.forwardVel *= Math.pow(groundDrag, delta * 60);
      
    } else if (!char.isGrounded) {
      // Air movement (limited control)
      if (char.intendedMag > 0.1) {
        // SM64: Can slightly adjust direction in air
        const airControl = 0.3;
        char.forwardVel += acceleration * airControl * char.intendedMag;
        
        // Turn slower in air
        let angleDiff = char.intendedYaw - char.faceAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const maxTurn = turnSpeed * 0.3 * delta;
        if (Math.abs(angleDiff) < maxTurn) {
          char.faceAngle = char.intendedYaw;
        } else {
          char.faceAngle += Math.sign(angleDiff) * maxTurn;
        }
      }
      
      // Apply air drag
      char.forwardVel *= Math.pow(airDrag, delta * 60);
    }
    
    // Convert forward velocity to velocity vector (SM64: slideVelX/Z)
    char.velocity.x = Math.sin(char.faceAngle) * char.forwardVel;
    char.velocity.z = Math.cos(char.faceAngle) * char.forwardVel;
    
    // Apply gravity
    if (!char.isGrounded) {
      char.velocity.y -= gravity * delta;
      
      // Detect falling
      if (char.velocity.y < 0 && !char.isFalling) {
        char.isFalling = true;
        char.isJumping = false;
      }
    }
    
    // Update position
    char.position.x += char.velocity.x * delta;
    char.position.y += char.velocity.y * delta;
    char.position.z += char.velocity.z * delta;
    
    // Clamp to ground
    if (char.position.y < groundHeight) {
      char.position.y = groundHeight;
      char.velocity.y = 0;
      char.isGrounded = true;
    }
  }
  
  // SM64: update_lakitu - smooth camera following
  private updateCameraPosition(delta: number) {
    const { cameraDistance, cameraHeight, cameraSmoothing } = this.config;
    const char = this.character;
    
    // Calculate goal position (where camera wants to be)
    // SM64: Camera orbits behind character at distance/height
    const goalYaw = this.camera.yaw;
    const goalPitch = this.camera.pitch;
    const dist = cameraDistance;
    
    // Spherical coordinates to Cartesian
    const offsetX = Math.sin(goalYaw) * Math.cos(goalPitch) * dist;
    const offsetY = Math.sin(goalPitch) * dist + cameraHeight;
    const offsetZ = Math.cos(goalYaw) * Math.cos(goalPitch) * dist;
    
    this.camera.goalPosition.set(
      char.position.x + offsetX,
      char.position.y + offsetY,
      char.position.z + offsetZ
    );
    
    // Goal focus (slightly above character)
    this.camera.goalFocus.set(
      char.position.x,
      char.position.y + cameraHeight * 0.3,
      char.position.z
    );
    
    // SM64: Smooth interpolation (Lakitu flying to goal)
    // Lower smoothing = faster camera, higher = more lag
    const smoothFactor = 1 - Math.pow(cameraSmoothing, delta * 60);
    
    this.camera.position.lerp(this.camera.goalPosition, smoothFactor);
    this.camera.focus.lerp(this.camera.goalFocus, smoothFactor);
  }
  
  // Update animation state based on movement
  private updateAnimationState() {
    const char = this.character;
    const speed = Math.abs(char.forwardVel);
    
    // Swimming takes priority when in water
    if (char.isSwimming) {
      if (char.intendedMag > 0.1) {
        char.animationState = 'swim';
      } else {
        char.animationState = 'swim_idle';
      }
      return;
    }
    
    // Dive attack takes priority
    if (char.isDiving) {
      char.animationState = 'dive';
    }
    // Ground attack animations
    else if (char.isAttacking) {
      if (char.attackCombo === 1) char.animationState = 'attack1';
      else if (char.attackCombo === 2) char.animationState = 'attack2';
      else char.animationState = 'attack3';
    }
    // Jump animations based on combo
    else if (char.isJumping) {
      if (char.jumpCount === 3) char.animationState = 'triple_jump';
      else if (char.jumpCount === 2) char.animationState = 'double_jump';
      else char.animationState = 'jump';
    } else if (char.isFalling) {
      char.animationState = 'fall';
    } else if (!char.isGrounded) {
      char.animationState = char.velocity.y > 0 ? 'jump' : 'fall';
    } else if (speed > 15) {
      char.animationState = 'run';
    } else if (speed > 1) {
      char.animationState = 'walk';
    } else {
      char.animationState = 'idle';
    }
  }
  
  // Apply controller state to Three.js camera
  applyToCamera(camera: THREE.Camera) {
    camera.position.copy(this.camera.position);
    camera.lookAt(this.camera.focus);
  }
  
  // Apply controller state to a character mesh
  applyToCharacter(mesh: THREE.Object3D) {
    mesh.position.copy(this.character.position);
    mesh.rotation.y = this.character.faceAngle;
  }
  
  // Set character position
  setPosition(x: number, y: number, z: number) {
    this.character.position.set(x, y, z);
  }
  
  // Reset camera behind character
  resetCamera() {
    this.camera.yaw = this.character.faceAngle + Math.PI;
    this.camera.pitch = this.config.cameraPitch;
  }
}

/**
 * Create a test skeleton figure for testing the controller
 */
export function createTestSkeleton(): THREE.Group {
  const skeleton = new THREE.Group();
  
  const boneMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xcccccc,
    metalness: 0.3,
    roughness: 0.7 
  });
  
  const jointMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x666666,
    metalness: 0.5,
    roughness: 0.5 
  });
  
  // Body proportions (SM64 Mario-like)
  const scale = 50; // Total height ~150 units
  
  // Torso (capsule-like)
  const torsoGeom = new THREE.CylinderGeometry(scale * 0.3, scale * 0.35, scale * 0.8, 8);
  const torso = new THREE.Mesh(torsoGeom, boneMaterial);
  torso.position.y = scale * 1.1;
  skeleton.add(torso);
  
  // Head (sphere)
  const headGeom = new THREE.SphereGeometry(scale * 0.25, 16, 12);
  const head = new THREE.Mesh(headGeom, boneMaterial);
  head.position.y = scale * 1.75;
  skeleton.add(head);
  
  // Eyes (to show facing direction)
  const eyeGeom = new THREE.SphereGeometry(scale * 0.06, 8, 6);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
  
  const leftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  leftEye.position.set(-scale * 0.1, scale * 1.8, scale * 0.2);
  skeleton.add(leftEye);
  
  const rightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  rightEye.position.set(scale * 0.1, scale * 1.8, scale * 0.2);
  skeleton.add(rightEye);
  
  // Shoulders
  const shoulderGeom = new THREE.SphereGeometry(scale * 0.1, 8, 6);
  const leftShoulder = new THREE.Mesh(shoulderGeom, jointMaterial);
  leftShoulder.position.set(-scale * 0.45, scale * 1.4, 0);
  skeleton.add(leftShoulder);
  
  const rightShoulder = new THREE.Mesh(shoulderGeom, jointMaterial);
  rightShoulder.position.set(scale * 0.45, scale * 1.4, 0);
  skeleton.add(rightShoulder);
  
  // Arms (cylinders)
  const armGeom = new THREE.CylinderGeometry(scale * 0.08, scale * 0.06, scale * 0.5, 6);
  
  const leftUpperArm = new THREE.Mesh(armGeom, boneMaterial);
  leftUpperArm.position.set(-scale * 0.55, scale * 1.15, 0);
  leftUpperArm.rotation.z = 0.2;
  skeleton.add(leftUpperArm);
  
  const rightUpperArm = new THREE.Mesh(armGeom, boneMaterial);
  rightUpperArm.position.set(scale * 0.55, scale * 1.15, 0);
  rightUpperArm.rotation.z = -0.2;
  skeleton.add(rightUpperArm);
  
  // Elbows
  const elbowGeom = new THREE.SphereGeometry(scale * 0.07, 8, 6);
  const leftElbow = new THREE.Mesh(elbowGeom, jointMaterial);
  leftElbow.position.set(-scale * 0.6, scale * 0.9, 0);
  skeleton.add(leftElbow);
  
  const rightElbow = new THREE.Mesh(elbowGeom, jointMaterial);
  rightElbow.position.set(scale * 0.6, scale * 0.9, 0);
  skeleton.add(rightElbow);
  
  // Forearms
  const forearmGeom = new THREE.CylinderGeometry(scale * 0.06, scale * 0.05, scale * 0.45, 6);
  
  const leftForearm = new THREE.Mesh(forearmGeom, boneMaterial);
  leftForearm.position.set(-scale * 0.62, scale * 0.65, 0);
  skeleton.add(leftForearm);
  
  const rightForearm = new THREE.Mesh(forearmGeom, boneMaterial);
  rightForearm.position.set(scale * 0.62, scale * 0.65, 0);
  skeleton.add(rightForearm);
  
  // Hands (spheres)
  const handGeom = new THREE.SphereGeometry(scale * 0.08, 8, 6);
  const leftHand = new THREE.Mesh(handGeom, jointMaterial);
  leftHand.position.set(-scale * 0.62, scale * 0.4, 0);
  skeleton.add(leftHand);
  
  const rightHand = new THREE.Mesh(handGeom, jointMaterial);
  rightHand.position.set(scale * 0.62, scale * 0.4, 0);
  skeleton.add(rightHand);
  
  // Hips
  const hipGeom = new THREE.CylinderGeometry(scale * 0.35, scale * 0.3, scale * 0.15, 8);
  const hips = new THREE.Mesh(hipGeom, boneMaterial);
  hips.position.y = scale * 0.65;
  skeleton.add(hips);
  
  // Hip joints
  const hipJointGeom = new THREE.SphereGeometry(scale * 0.1, 8, 6);
  const leftHip = new THREE.Mesh(hipJointGeom, jointMaterial);
  leftHip.position.set(-scale * 0.2, scale * 0.55, 0);
  skeleton.add(leftHip);
  
  const rightHip = new THREE.Mesh(hipJointGeom, jointMaterial);
  rightHip.position.set(scale * 0.2, scale * 0.55, 0);
  skeleton.add(rightHip);
  
  // Upper legs (thighs)
  const thighGeom = new THREE.CylinderGeometry(scale * 0.1, scale * 0.08, scale * 0.45, 6);
  
  const leftThigh = new THREE.Mesh(thighGeom, boneMaterial);
  leftThigh.position.set(-scale * 0.2, scale * 0.3, 0);
  skeleton.add(leftThigh);
  
  const rightThigh = new THREE.Mesh(thighGeom, boneMaterial);
  rightThigh.position.set(scale * 0.2, scale * 0.3, 0);
  skeleton.add(rightThigh);
  
  // Knees
  const kneeGeom = new THREE.SphereGeometry(scale * 0.08, 8, 6);
  const leftKnee = new THREE.Mesh(kneeGeom, jointMaterial);
  leftKnee.position.set(-scale * 0.2, scale * 0.05, 0);
  skeleton.add(leftKnee);
  
  const rightKnee = new THREE.Mesh(kneeGeom, jointMaterial);
  rightKnee.position.set(scale * 0.2, scale * 0.05, 0);
  skeleton.add(rightKnee);
  
  // Lower legs (shins)
  const shinGeom = new THREE.CylinderGeometry(scale * 0.08, scale * 0.06, scale * 0.45, 6);
  
  const leftShin = new THREE.Mesh(shinGeom, boneMaterial);
  leftShin.position.set(-scale * 0.2, scale * -0.2, 0);
  skeleton.add(leftShin);
  
  const rightShin = new THREE.Mesh(shinGeom, boneMaterial);
  rightShin.position.set(scale * 0.2, scale * -0.2, 0);
  skeleton.add(rightShin);
  
  // Feet (boxes)
  const footGeom = new THREE.BoxGeometry(scale * 0.15, scale * 0.08, scale * 0.25);
  
  const leftFoot = new THREE.Mesh(footGeom, jointMaterial);
  leftFoot.position.set(-scale * 0.2, scale * -0.45, scale * 0.05);
  skeleton.add(leftFoot);
  
  const rightFoot = new THREE.Mesh(footGeom, jointMaterial);
  rightFoot.position.set(scale * 0.2, scale * -0.45, scale * 0.05);
  skeleton.add(rightFoot);
  
  // Center the skeleton so pivot is at feet
  skeleton.children.forEach(child => {
    child.position.y += scale * 0.5;
  });
  
  // Cast shadows
  skeleton.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return skeleton;
}

/**
 * Create a simple ground plane for testing
 */
export function createTestGround(size: number = 2000): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size, 20, 20);
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x4a7c4e,
    roughness: 0.9,
    metalness: 0.1,
  });
  
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  
  return ground;
}

/**
 * Create a test scene with the Mario64 controller
 */
export function createMario64TestScene(container: HTMLElement): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controller: Mario64Controller;
  character: THREE.Group;
  update: (delta: number) => void;
  dispose: () => void;
} {
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 500, 3000);
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 5000);
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 10;
  directionalLight.shadow.camera.far = 1000;
  directionalLight.shadow.camera.left = -500;
  directionalLight.shadow.camera.right = 500;
  directionalLight.shadow.camera.top = 500;
  directionalLight.shadow.camera.bottom = -500;
  scene.add(directionalLight);
  
  // Ground
  const ground = createTestGround();
  scene.add(ground);
  
  // Character
  const character = createTestSkeleton();
  scene.add(character);
  
  // Controller
  const controller = new Mario64Controller({
    cameraDistance: 400,
    cameraHeight: 150,
  });
  controller.setupInputListeners(container);
  controller.setPosition(0, 0, 0);
  
  // Update function
  const update = (delta: number) => {
    controller.update(delta, 0);
    controller.applyToCamera(camera);
    controller.applyToCharacter(character);
    renderer.render(scene, camera);
  };
  
  // Handle resize
  const handleResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', handleResize);
  
  // Dispose function
  const dispose = () => {
    window.removeEventListener('resize', handleResize);
    renderer.forceContextLoss();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
  
  return { scene, camera, renderer, controller, character, update, dispose };
}
