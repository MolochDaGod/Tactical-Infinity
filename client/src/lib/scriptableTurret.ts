import * as THREE from 'three';

export type ProjectileType = 'arrow' | 'bolt' | 'bullet' | 'cannonball' | 'magic_missile' | 'fireball' | 'ice_shard' | 'lightning';
export type TrajectoryType = 'straight' | 'ballistic' | 'homing' | 'beam' | 'spline' | 'wave' | 'spiral' | 'boomerang' | 'seeking';
export type SplineCurveType = 'catmullrom' | 'centripetal' | 'chordal';
export type TurretType = 'bow' | 'crossbow' | 'gun' | 'cannon' | 'magic_staff' | 'magic_tome' | 'guard_tower' | 'ship_cannon';

export interface SplineTrajectoryConfig {
  curveType: SplineCurveType;
  tension: number;
  arcHeight: number;
  controlPointOffset: number;
  showPath: boolean;
  pathColor: number;
  pathSegments: number;
}

export interface WaveTrajectoryConfig {
  amplitude: number;
  frequency: number;
  axis: 'horizontal' | 'vertical' | 'both';
}

export interface SpiralTrajectoryConfig {
  radius: number;
  rotationSpeed: number;
  expansionRate: number;
}

export interface BoomerangConfig {
  returnDelay: number;
  curveRadius: number;
  spinSpeed: number;
}

export interface SeekingConfig {
  turnRate: number;
  acceleration: number;
  maxSpeed: number;
  predictionTime: number;
}

export type ScatterPattern = 'cone' | 'sphere' | 'ring' | 'random';

export interface ScatterConfig {
  enabled: boolean;
  splitDistance: number;
  splitTime?: number;
  childCount: number;
  spreadAngle: number;
  pattern: ScatterPattern;
  childScale: number;
  childDamage: number;
  childSpeed: number;
  childTrajectory: TrajectoryType;
  childColor?: number;
  inheritVelocity: boolean;
  chainScatter?: boolean;
}

export interface ProjectileConfig {
  type: ProjectileType;
  trajectory: TrajectoryType;
  speed: number;
  damage: number;
  damageType: 'physical' | 'fire' | 'ice' | 'lightning' | 'arcane';
  splashRadius?: number;
  gravity?: number;
  homingStrength?: number;
  splineConfig?: SplineTrajectoryConfig;
  waveConfig?: WaveTrajectoryConfig;
  spiralConfig?: SpiralTrajectoryConfig;
  boomerangConfig?: BoomerangConfig;
  seekingConfig?: SeekingConfig;
  scatterConfig?: ScatterConfig;
  trailEffect?: string;
  impactEffect?: string;
  muzzleEffect?: string;
  modelPath?: string;
  scale: number;
  color: number;
  isScatterChild?: boolean;
  trailEnabled?: boolean;
  trailLength?: number;
  trailWidth?: number;
  glowIntensity?: number;
  spinRate?: number;
}

export interface TurretConfig {
  type: TurretType;
  range: number;
  fireRate: number;
  rotationSpeed: number;
  projectile: ProjectileConfig;
  targetPriority: 'nearest' | 'furthest' | 'weakest' | 'strongest' | 'first';
  leadTarget: boolean;
  elevationMin: number;
  elevationMax: number;
  azimuthMin: number;
  azimuthMax: number;
  canTargetAir: boolean;
  canTargetGround: boolean;
  warmupTime: number;
  cooldownTime: number;
}

export interface Target {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  isAirborne: boolean;
  radius: number;
}

export interface SplineProjectileData {
  curve: THREE.CatmullRomCurve3;
  pathLine?: THREE.Line;
  totalLength: number;
  distanceTraveled: number;
}

export interface ActiveProjectile {
  id: string;
  mesh: THREE.Object3D;
  config: ProjectileConfig;
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetId?: string;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  hasHit: boolean;
  hasSplit: boolean;
  splineData?: SplineProjectileData;
  wavePhase?: number;
  spiralAngle?: number;
  isReturning?: boolean;
  returnStartTime?: number;
  trail?: THREE.Line;
  trailPositions?: THREE.Vector3[];
  currentSpeed?: number;
  baseDirection?: THREE.Vector3;
}

const PROJECTILE_CONFIGS: Record<ProjectileType, Partial<ProjectileConfig>> = {
  arrow: {
    trajectory: 'ballistic',
    speed: 40,
    damage: 15,
    damageType: 'physical',
    gravity: 9.8,
    scale: 0.3,
    color: 0x8B4513,
    trailEffect: 'arrow_trail',
    impactEffect: 'impact_arrow',
  },
  bolt: {
    trajectory: 'straight',
    speed: 60,
    damage: 25,
    damageType: 'physical',
    scale: 0.25,
    color: 0x4A4A4A,
    trailEffect: 'arrow_trail',
    impactEffect: 'impact_bullet',
  },
  bullet: {
    trajectory: 'straight',
    speed: 100,
    damage: 35,
    damageType: 'physical',
    scale: 0.1,
    color: 0xFFD700,
    muzzleEffect: 'muzzle_flash',
    impactEffect: 'impact_bullet',
  },
  cannonball: {
    trajectory: 'ballistic',
    speed: 25,
    damage: 100,
    damageType: 'physical',
    gravity: 15,
    splashRadius: 3,
    scale: 0.5,
    color: 0x2F2F2F,
    muzzleEffect: 'cannon_smoke',
    trailEffect: 'fire_trail',
    impactEffect: 'explosion',
  },
  magic_missile: {
    trajectory: 'homing',
    speed: 20,
    damage: 20,
    damageType: 'arcane',
    homingStrength: 5,
    scale: 0.2,
    color: 0x9B59B6,
    trailEffect: 'magic_trail',
    impactEffect: 'arcane_burst',
  },
  fireball: {
    trajectory: 'ballistic',
    speed: 15,
    damage: 50,
    damageType: 'fire',
    gravity: 3,
    splashRadius: 2,
    scale: 0.4,
    color: 0xFF4500,
    trailEffect: 'fire_trail',
    impactEffect: 'fire_explosion',
  },
  ice_shard: {
    trajectory: 'straight',
    speed: 35,
    damage: 30,
    damageType: 'ice',
    scale: 0.3,
    color: 0x00CED1,
    trailEffect: 'magic_trail',
    impactEffect: 'ice_shatter',
  },
  lightning: {
    trajectory: 'beam',
    speed: 1000,
    damage: 45,
    damageType: 'lightning',
    scale: 0.1,
    color: 0xFFFF00,
    impactEffect: 'lightning_strike',
  },
};

const TURRET_PRESETS: Record<TurretType, Partial<TurretConfig>> = {
  bow: {
    range: 25,
    fireRate: 1.2,
    rotationSpeed: 180,
    targetPriority: 'nearest',
    leadTarget: true,
    elevationMin: -10,
    elevationMax: 60,
    azimuthMin: -180,
    azimuthMax: 180,
    canTargetAir: true,
    canTargetGround: true,
    warmupTime: 0.3,
    cooldownTime: 0.1,
  },
  crossbow: {
    range: 35,
    fireRate: 0.8,
    rotationSpeed: 120,
    targetPriority: 'strongest',
    leadTarget: true,
    elevationMin: -5,
    elevationMax: 45,
    azimuthMin: -180,
    azimuthMax: 180,
    canTargetAir: true,
    canTargetGround: true,
    warmupTime: 0.5,
    cooldownTime: 0.3,
  },
  gun: {
    range: 40,
    fireRate: 0.5,
    rotationSpeed: 90,
    targetPriority: 'nearest',
    leadTarget: false,
    elevationMin: -5,
    elevationMax: 30,
    azimuthMin: -180,
    azimuthMax: 180,
    canTargetAir: false,
    canTargetGround: true,
    warmupTime: 0.2,
    cooldownTime: 0.5,
  },
  cannon: {
    range: 50,
    fireRate: 0.3,
    rotationSpeed: 30,
    targetPriority: 'strongest',
    leadTarget: true,
    elevationMin: 5,
    elevationMax: 45,
    azimuthMin: -90,
    azimuthMax: 90,
    canTargetAir: false,
    canTargetGround: true,
    warmupTime: 0.8,
    cooldownTime: 1.0,
  },
  magic_staff: {
    range: 30,
    fireRate: 1.5,
    rotationSpeed: 200,
    targetPriority: 'weakest',
    leadTarget: false,
    elevationMin: -20,
    elevationMax: 80,
    azimuthMin: -180,
    azimuthMax: 180,
    canTargetAir: true,
    canTargetGround: true,
    warmupTime: 0.4,
    cooldownTime: 0.1,
  },
  magic_tome: {
    range: 25,
    fireRate: 2.0,
    rotationSpeed: 250,
    targetPriority: 'nearest',
    leadTarget: false,
    elevationMin: -30,
    elevationMax: 90,
    azimuthMin: -180,
    azimuthMax: 180,
    canTargetAir: true,
    canTargetGround: true,
    warmupTime: 0.2,
    cooldownTime: 0.05,
  },
  guard_tower: {
    range: 40,
    fireRate: 1.0,
    rotationSpeed: 60,
    targetPriority: 'first',
    leadTarget: true,
    elevationMin: -30,
    elevationMax: 60,
    azimuthMin: -180,
    azimuthMax: 180,
    canTargetAir: true,
    canTargetGround: true,
    warmupTime: 0.1,
    cooldownTime: 0.2,
  },
  ship_cannon: {
    range: 60,
    fireRate: 0.25,
    rotationSpeed: 20,
    targetPriority: 'strongest',
    leadTarget: true,
    elevationMin: 0,
    elevationMax: 35,
    azimuthMin: -45,
    azimuthMax: 45,
    canTargetAir: false,
    canTargetGround: true,
    warmupTime: 1.0,
    cooldownTime: 1.5,
  },
};

export function createProjectileConfig(type: ProjectileType, overrides?: Partial<ProjectileConfig>): ProjectileConfig {
  const base = PROJECTILE_CONFIGS[type];
  return {
    type,
    trajectory: base.trajectory || 'straight',
    speed: base.speed || 30,
    damage: base.damage || 10,
    damageType: base.damageType || 'physical',
    splashRadius: base.splashRadius,
    gravity: base.gravity,
    homingStrength: base.homingStrength,
    trailEffect: base.trailEffect,
    impactEffect: base.impactEffect,
    muzzleEffect: base.muzzleEffect,
    scale: base.scale || 0.2,
    color: base.color || 0xFFFFFF,
    ...overrides,
  };
}

export function createTurretConfig(type: TurretType, projectileType?: ProjectileType, overrides?: Partial<TurretConfig>): TurretConfig {
  const base = TURRET_PRESETS[type];
  
  const defaultProjectileMap: Record<TurretType, ProjectileType> = {
    bow: 'arrow',
    crossbow: 'bolt',
    gun: 'bullet',
    cannon: 'cannonball',
    magic_staff: 'fireball',
    magic_tome: 'magic_missile',
    guard_tower: 'arrow',
    ship_cannon: 'cannonball',
  };
  
  const projType = projectileType || defaultProjectileMap[type];
  
  return {
    type,
    range: base.range || 30,
    fireRate: base.fireRate || 1,
    rotationSpeed: base.rotationSpeed || 90,
    projectile: createProjectileConfig(projType),
    targetPriority: base.targetPriority || 'nearest',
    leadTarget: base.leadTarget ?? true,
    elevationMin: base.elevationMin ?? -30,
    elevationMax: base.elevationMax ?? 60,
    azimuthMin: base.azimuthMin ?? -180,
    azimuthMax: base.azimuthMax ?? 180,
    canTargetAir: base.canTargetAir ?? true,
    canTargetGround: base.canTargetGround ?? true,
    warmupTime: base.warmupTime ?? 0.2,
    cooldownTime: base.cooldownTime ?? 0.1,
    ...overrides,
  };
}

export class ScriptableTurret {
  public config: TurretConfig;
  public position: THREE.Vector3;
  public rotation: THREE.Euler;
  public currentTarget: Target | null = null;
  public isActive: boolean = true;
  
  private scene: THREE.Scene;
  private projectiles: ActiveProjectile[] = [];
  private timeSinceLastFire: number = 0;
  private currentAzimuth: number = 0;
  private currentElevation: number = 0;
  private state: 'idle' | 'acquiring' | 'tracking' | 'firing' | 'cooldown' = 'idle';
  private stateTimer: number = 0;
  private projectileIdCounter: number = 0;
  private turretMesh: THREE.Object3D | null = null;
  private barrelMesh: THREE.Object3D | null = null;
  
  private onFireCallback?: (projectile: ActiveProjectile) => void;
  private onHitCallback?: (projectile: ActiveProjectile, target: Target | null, position: THREE.Vector3) => void;
  private onScatterCallback?: (parent: ActiveProjectile, children: ActiveProjectile[]) => void;
  private getTargetsCallback?: () => Target[];
  
  constructor(
    scene: THREE.Scene,
    config: TurretConfig,
    position: THREE.Vector3 = new THREE.Vector3(),
  ) {
    this.scene = scene;
    this.config = config;
    this.position = position.clone();
    this.rotation = new THREE.Euler();
    this.timeSinceLastFire = 1 / config.fireRate;
  }
  
  public setTurretMesh(mesh: THREE.Object3D, barrelMesh?: THREE.Object3D): void {
    this.turretMesh = mesh;
    this.barrelMesh = barrelMesh || null;
  }
  
  public onFire(callback: (projectile: ActiveProjectile) => void): void {
    this.onFireCallback = callback;
  }
  
  public onHit(callback: (projectile: ActiveProjectile, target: Target | null, position: THREE.Vector3) => void): void {
    this.onHitCallback = callback;
  }
  
  public onScatter(callback: (parent: ActiveProjectile, children: ActiveProjectile[]) => void): void {
    this.onScatterCallback = callback;
  }
  
  public setTargetProvider(callback: () => Target[]): void {
    this.getTargetsCallback = callback;
  }
  
  public update(deltaTime: number): void {
    if (!this.isActive) return;
    
    this.timeSinceLastFire += deltaTime;
    this.stateTimer += deltaTime;
    
    this.updateState(deltaTime);
    this.updateProjectiles(deltaTime);
  }
  
  private updateState(deltaTime: number): void {
    switch (this.state) {
      case 'idle':
        this.findTarget();
        if (this.currentTarget) {
          this.state = 'acquiring';
          this.stateTimer = 0;
        }
        break;
        
      case 'acquiring':
        if (!this.currentTarget || !this.isTargetValid(this.currentTarget)) {
          this.currentTarget = null;
          this.state = 'idle';
          break;
        }
        if (this.rotateTowardsTarget(deltaTime)) {
          this.state = 'tracking';
          this.stateTimer = 0;
        }
        break;
        
      case 'tracking':
        if (!this.currentTarget || !this.isTargetValid(this.currentTarget)) {
          this.currentTarget = null;
          this.state = 'idle';
          break;
        }
        this.rotateTowardsTarget(deltaTime);
        if (this.stateTimer >= this.config.warmupTime && this.canFire()) {
          this.fire();
          this.state = 'firing';
          this.stateTimer = 0;
        }
        break;
        
      case 'firing':
        if (this.stateTimer >= 0.1) {
          this.state = 'cooldown';
          this.stateTimer = 0;
        }
        break;
        
      case 'cooldown':
        if (this.stateTimer >= this.config.cooldownTime) {
          if (this.currentTarget && this.isTargetValid(this.currentTarget)) {
            this.state = 'tracking';
          } else {
            this.currentTarget = null;
            this.state = 'idle';
          }
          this.stateTimer = 0;
        }
        break;
    }
  }
  
  private findTarget(): void {
    if (!this.getTargetsCallback) return;
    
    const targets = this.getTargetsCallback();
    const validTargets = targets.filter(t => this.isTargetValid(t));
    
    if (validTargets.length === 0) {
      this.currentTarget = null;
      return;
    }
    
    switch (this.config.targetPriority) {
      case 'nearest':
        validTargets.sort((a, b) => 
          a.position.distanceTo(this.position) - b.position.distanceTo(this.position)
        );
        break;
      case 'furthest':
        validTargets.sort((a, b) => 
          b.position.distanceTo(this.position) - a.position.distanceTo(this.position)
        );
        break;
      case 'weakest':
        validTargets.sort((a, b) => a.health - b.health);
        break;
      case 'strongest':
        validTargets.sort((a, b) => b.health - a.health);
        break;
      case 'first':
        break;
    }
    
    this.currentTarget = validTargets[0];
  }
  
  private isTargetValid(target: Target): boolean {
    const distance = target.position.distanceTo(this.position);
    if (distance > this.config.range) return false;
    if (target.health <= 0) return false;
    if (target.isAirborne && !this.config.canTargetAir) return false;
    if (!target.isAirborne && !this.config.canTargetGround) return false;
    return true;
  }
  
  private rotateTowardsTarget(deltaTime: number): boolean {
    if (!this.currentTarget) return false;
    
    const targetPos = this.config.leadTarget 
      ? this.predictTargetPosition(this.currentTarget)
      : this.currentTarget.position.clone();
    
    const direction = targetPos.clone().sub(this.position);
    const targetAzimuth = Math.atan2(direction.x, direction.z) * THREE.MathUtils.RAD2DEG;
    const horizontalDist = Math.sqrt(direction.x ** 2 + direction.z ** 2);
    const targetElevation = Math.atan2(direction.y, horizontalDist) * THREE.MathUtils.RAD2DEG;
    
    const maxRotation = this.config.rotationSpeed * deltaTime;
    
    let azimuthDiff = targetAzimuth - this.currentAzimuth;
    while (azimuthDiff > 180) azimuthDiff -= 360;
    while (azimuthDiff < -180) azimuthDiff += 360;
    
    if (Math.abs(azimuthDiff) <= maxRotation) {
      this.currentAzimuth = targetAzimuth;
    } else {
      this.currentAzimuth += Math.sign(azimuthDiff) * maxRotation;
    }
    
    const elevationDiff = targetElevation - this.currentElevation;
    if (Math.abs(elevationDiff) <= maxRotation) {
      this.currentElevation = targetElevation;
    } else {
      this.currentElevation += Math.sign(elevationDiff) * maxRotation;
    }
    
    this.currentElevation = THREE.MathUtils.clamp(
      this.currentElevation, 
      this.config.elevationMin, 
      this.config.elevationMax
    );
    
    if (this.turretMesh) {
      this.turretMesh.rotation.y = this.currentAzimuth * THREE.MathUtils.DEG2RAD;
    }
    if (this.barrelMesh) {
      this.barrelMesh.rotation.x = -this.currentElevation * THREE.MathUtils.DEG2RAD;
    }
    
    const isAimed = Math.abs(azimuthDiff) < 5 && Math.abs(elevationDiff) < 5;
    return isAimed;
  }
  
  private predictTargetPosition(target: Target): THREE.Vector3 {
    const distance = target.position.distanceTo(this.position);
    const projectileSpeed = this.config.projectile.speed;
    const timeToImpact = distance / projectileSpeed;
    
    return target.position.clone().add(
      target.velocity.clone().multiplyScalar(timeToImpact)
    );
  }
  
  private canFire(): boolean {
    return this.timeSinceLastFire >= (1 / this.config.fireRate);
  }
  
  private fire(): void {
    if (!this.currentTarget) return;
    
    this.timeSinceLastFire = 0;
    
    const projectile = this.createProjectile();
    this.projectiles.push(projectile);
    this.scene.add(projectile.mesh);
    
    if (this.onFireCallback) {
      this.onFireCallback(projectile);
    }
  }
  
  private createProjectile(): ActiveProjectile {
    const config = this.config.projectile;
    const id = `projectile_${this.projectileIdCounter++}`;
    
    const geometry = this.createProjectileGeometry(config.type);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(config.scale);
    
    const startPos = this.position.clone();
    startPos.y += 1;
    mesh.position.copy(startPos);
    
    const targetPos = this.config.leadTarget && this.currentTarget
      ? this.predictTargetPosition(this.currentTarget)
      : this.currentTarget!.position.clone();
    
    const direction = targetPos.clone().sub(startPos).normalize();
    let velocity: THREE.Vector3;
    let splineData: SplineProjectileData | undefined;
    
    if (config.trajectory === 'ballistic') {
      velocity = this.calculateBallisticVelocity(startPos, targetPos, config);
    } else if (config.trajectory === 'spline') {
      splineData = this.createSplineTrajectory(startPos, targetPos, config);
      velocity = direction.multiplyScalar(config.speed);
    } else {
      velocity = direction.multiplyScalar(config.speed);
    }
    
    mesh.lookAt(mesh.position.clone().add(velocity));
    
    let trail: THREE.Line | undefined;
    if (config.trailEnabled) {
      const trailGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array((config.trailLength || 15) * 3);
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const trailMaterial = new THREE.LineBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.6,
        linewidth: config.trailWidth || 2,
      });
      trail = new THREE.Line(trailGeometry, trailMaterial);
      this.scene.add(trail);
    }
    
    return {
      id,
      mesh,
      config,
      startPosition: startPos,
      targetPosition: targetPos,
      targetId: this.currentTarget?.id,
      velocity,
      age: 0,
      maxAge: 10,
      hasHit: false,
      hasSplit: false,
      splineData,
      trail,
      trailPositions: config.trailEnabled ? [startPos.clone()] : undefined,
      baseDirection: direction.clone(),
      currentSpeed: config.speed,
      wavePhase: 0,
      spiralAngle: 0,
    };
  }
  
  private createSplineTrajectory(start: THREE.Vector3, target: THREE.Vector3, config: ProjectileConfig): SplineProjectileData {
    const splineConfig = config.splineConfig || {
      curveType: 'centripetal' as SplineCurveType,
      tension: 0.5,
      arcHeight: 5,
      controlPointOffset: 0.3,
      showPath: false,
      pathColor: 0x00ff00,
      pathSegments: 50,
    };
    
    const distance = start.distanceTo(target);
    const midPoint = start.clone().lerp(target, 0.5);
    midPoint.y += splineConfig.arcHeight * (distance / 20);
    
    const direction = target.clone().sub(start).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const sideOffset = (Math.random() - 0.5) * splineConfig.controlPointOffset * distance;
    
    const control1 = start.clone().lerp(midPoint, 0.33);
    control1.y += splineConfig.arcHeight * 0.5 * (distance / 20);
    control1.add(perpendicular.clone().multiplyScalar(sideOffset));
    
    const control2 = midPoint.clone().lerp(target, 0.5);
    control2.y += splineConfig.arcHeight * 0.3 * (distance / 20);
    control2.add(perpendicular.clone().multiplyScalar(-sideOffset * 0.5));
    
    const points = [start.clone(), control1, midPoint, control2, target.clone()];
    
    const curve = new THREE.CatmullRomCurve3(points);
    curve.curveType = splineConfig.curveType;
    curve.tension = splineConfig.tension;
    
    let pathLine: THREE.Line | undefined;
    if (splineConfig.showPath) {
      const pathPoints = curve.getPoints(splineConfig.pathSegments);
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
      const pathMaterial = new THREE.LineBasicMaterial({ 
        color: splineConfig.pathColor,
        transparent: true,
        opacity: 0.6,
      });
      pathLine = new THREE.Line(pathGeometry, pathMaterial);
      this.scene.add(pathLine);
    }
    
    return {
      curve,
      pathLine,
      totalLength: curve.getLength(),
      distanceTraveled: 0,
    };
  }
  
  private createProjectileGeometry(type: ProjectileType): THREE.BufferGeometry {
    switch (type) {
      case 'arrow':
      case 'bolt':
        const cone = new THREE.ConeGeometry(0.1, 0.8, 6);
        cone.rotateX(Math.PI / 2);
        return cone;
      case 'bullet':
        return new THREE.CapsuleGeometry(0.05, 0.15, 4, 8);
      case 'cannonball':
        return new THREE.SphereGeometry(0.3, 12, 12);
      case 'magic_missile':
        return new THREE.OctahedronGeometry(0.15);
      case 'fireball':
        return new THREE.IcosahedronGeometry(0.25, 1);
      case 'ice_shard':
        return new THREE.OctahedronGeometry(0.2);
      case 'lightning':
        return new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
      default:
        return new THREE.SphereGeometry(0.1);
    }
  }
  
  private calculateBallisticVelocity(start: THREE.Vector3, target: THREE.Vector3, config: ProjectileConfig): THREE.Vector3 {
    const gravity = config.gravity || 9.8;
    const speed = config.speed;
    
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const dz = target.z - start.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    
    const angle = Math.PI / 4;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    
    const vHorizontal = speed * cosAngle;
    const vVertical = speed * sinAngle;
    
    const horizontalDir = new THREE.Vector2(dx, dz).normalize();
    
    return new THREE.Vector3(
      horizontalDir.x * vHorizontal,
      vVertical,
      horizontalDir.y * vHorizontal
    );
  }
  
  private updateProjectiles(deltaTime: number): void {
    const toRemove: ActiveProjectile[] = [];
    const toAdd: ActiveProjectile[] = [];
    
    for (const projectile of this.projectiles) {
      projectile.age += deltaTime;
      
      if (projectile.age >= projectile.maxAge || projectile.hasHit) {
        toRemove.push(projectile);
        continue;
      }
      
      this.updateProjectileMovement(projectile, deltaTime);
      
      const shouldScatter = this.checkScatterCondition(projectile);
      if (shouldScatter && !projectile.hasSplit) {
        projectile.hasSplit = true;
        const scatterChildren = this.createScatterProjectiles(projectile);
        toAdd.push(...scatterChildren);
        
        if (this.onScatterCallback) {
          this.onScatterCallback(projectile, scatterChildren);
        }
        
        toRemove.push(projectile);
        continue;
      }
      
      const hitResult = this.checkProjectileHit(projectile);
      if (hitResult) {
        projectile.hasHit = true;
        if (this.onHitCallback) {
          this.onHitCallback(projectile, hitResult.target, hitResult.position);
        }
        toRemove.push(projectile);
      }
    }
    
    for (const child of toAdd) {
      this.projectiles.push(child);
      this.scene.add(child.mesh);
    }
    
    for (const projectile of toRemove) {
      this.scene.remove(projectile.mesh);
      if (projectile.mesh instanceof THREE.Mesh) {
        projectile.mesh.geometry.dispose();
        if (projectile.mesh.material instanceof THREE.Material) {
          projectile.mesh.material.dispose();
        }
      }
      if (projectile.splineData?.pathLine) {
        this.scene.remove(projectile.splineData.pathLine);
        projectile.splineData.pathLine.geometry.dispose();
        (projectile.splineData.pathLine.material as THREE.Material).dispose();
      }
      if (projectile.trail) {
        this.scene.remove(projectile.trail);
        projectile.trail.geometry.dispose();
        (projectile.trail.material as THREE.Material).dispose();
      }
      const index = this.projectiles.indexOf(projectile);
      if (index !== -1) {
        this.projectiles.splice(index, 1);
      }
    }
  }
  
  private checkScatterCondition(projectile: ActiveProjectile): boolean {
    const scatter = projectile.config.scatterConfig;
    if (!scatter?.enabled || projectile.config.isScatterChild) return false;
    
    const distTraveled = projectile.mesh.position.distanceTo(projectile.startPosition);
    
    if (scatter.splitTime !== undefined && projectile.age >= scatter.splitTime) {
      return true;
    }
    
    if (distTraveled >= scatter.splitDistance) {
      return true;
    }
    
    return false;
  }
  
  private createScatterProjectiles(parent: ActiveProjectile): ActiveProjectile[] {
    const scatter = parent.config.scatterConfig!;
    const children: ActiveProjectile[] = [];
    const spawnPos = parent.mesh.position.clone();
    const baseDirection = parent.velocity.clone().normalize();
    
    for (let i = 0; i < scatter.childCount; i++) {
      const childDir = this.getScatterDirection(baseDirection, scatter, i, scatter.childCount);
      const child = this.createScatterChild(parent, spawnPos, childDir, scatter);
      children.push(child);
    }
    
    return children;
  }
  
  private getScatterDirection(baseDir: THREE.Vector3, scatter: ScatterConfig, index: number, total: number): THREE.Vector3 {
    const spreadRad = THREE.MathUtils.degToRad(scatter.spreadAngle);
    
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(baseDir, up).normalize();
    if (right.length() < 0.001) {
      right.set(1, 0, 0);
    }
    const realUp = new THREE.Vector3().crossVectors(right, baseDir).normalize();
    
    switch (scatter.pattern) {
      case 'cone': {
        const angle = (index / total) * Math.PI * 2;
        const radius = Math.random() * spreadRad;
        const offsetX = Math.cos(angle) * Math.sin(radius);
        const offsetY = Math.sin(angle) * Math.sin(radius);
        return baseDir.clone()
          .add(right.clone().multiplyScalar(offsetX))
          .add(realUp.clone().multiplyScalar(offsetY))
          .normalize();
      }
      
      case 'ring': {
        const angle = (index / total) * Math.PI * 2;
        const offsetX = Math.cos(angle) * Math.sin(spreadRad);
        const offsetY = Math.sin(angle) * Math.sin(spreadRad);
        return baseDir.clone()
          .add(right.clone().multiplyScalar(offsetX))
          .add(realUp.clone().multiplyScalar(offsetY))
          .normalize();
      }
      
      case 'sphere': {
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        return new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).normalize();
      }
      
      case 'random':
      default: {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomSpread = Math.random() * spreadRad;
        const offsetX = Math.cos(randomAngle) * Math.sin(randomSpread);
        const offsetY = Math.sin(randomAngle) * Math.sin(randomSpread);
        return baseDir.clone()
          .add(right.clone().multiplyScalar(offsetX))
          .add(realUp.clone().multiplyScalar(offsetY))
          .normalize();
      }
    }
  }
  
  private createScatterChild(parent: ActiveProjectile, spawnPos: THREE.Vector3, direction: THREE.Vector3, scatter: ScatterConfig): ActiveProjectile {
    const id = `scatter_${this.projectileIdCounter++}`;
    
    const childConfig: ProjectileConfig = {
      ...parent.config,
      scale: scatter.childScale,
      damage: scatter.childDamage,
      speed: scatter.childSpeed,
      trajectory: scatter.childTrajectory,
      color: scatter.childColor || parent.config.color,
      isScatterChild: true,
      scatterConfig: scatter.chainScatter ? parent.config.scatterConfig : undefined,
    };
    
    const geometry = this.createProjectileGeometry(childConfig.type);
    const material = new THREE.MeshStandardMaterial({
      color: childConfig.color,
      emissive: childConfig.color,
      emissiveIntensity: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(childConfig.scale);
    mesh.position.copy(spawnPos);
    
    let velocity: THREE.Vector3;
    if (scatter.inheritVelocity) {
      velocity = parent.velocity.clone().normalize().lerp(direction, 0.5).normalize().multiplyScalar(childConfig.speed);
    } else {
      velocity = direction.multiplyScalar(childConfig.speed);
    }
    
    if (childConfig.trajectory === 'ballistic') {
      velocity.y += childConfig.speed * 0.3;
    }
    
    mesh.lookAt(mesh.position.clone().add(velocity));
    
    return {
      id,
      mesh,
      config: childConfig,
      startPosition: spawnPos.clone(),
      targetPosition: parent.targetPosition.clone(),
      targetId: parent.targetId,
      velocity,
      age: 0,
      maxAge: 8,
      hasHit: false,
      hasSplit: false,
    };
  }
  
  private updateProjectileMovement(projectile: ActiveProjectile, deltaTime: number): void {
    const config = projectile.config;
    
    if (config.spinRate) {
      projectile.mesh.rotateZ(config.spinRate * deltaTime);
    }
    
    switch (config.trajectory) {
      case 'straight':
        projectile.mesh.position.add(projectile.velocity.clone().multiplyScalar(deltaTime));
        break;
        
      case 'ballistic':
        const gravity = config.gravity || 9.8;
        projectile.velocity.y -= gravity * deltaTime;
        projectile.mesh.position.add(projectile.velocity.clone().multiplyScalar(deltaTime));
        projectile.mesh.lookAt(projectile.mesh.position.clone().add(projectile.velocity));
        break;
        
      case 'homing':
        if (projectile.targetId && this.getTargetsCallback) {
          const targets = this.getTargetsCallback();
          const target = targets.find(t => t.id === projectile.targetId);
          if (target) {
            const toTarget = target.position.clone().sub(projectile.mesh.position).normalize();
            const homingStrength = config.homingStrength || 5;
            projectile.velocity.lerp(toTarget.multiplyScalar(config.speed), homingStrength * deltaTime);
            projectile.velocity.normalize().multiplyScalar(config.speed);
          }
        }
        projectile.mesh.position.add(projectile.velocity.clone().multiplyScalar(deltaTime));
        projectile.mesh.lookAt(projectile.mesh.position.clone().add(projectile.velocity));
        break;
        
      case 'spline':
        if (projectile.splineData) {
          const spline = projectile.splineData;
          spline.distanceTraveled += config.speed * deltaTime;
          const t = Math.min(spline.distanceTraveled / spline.totalLength, 1);
          
          const newPos = spline.curve.getPoint(t);
          const tangent = spline.curve.getTangent(t);
          
          projectile.mesh.position.copy(newPos);
          projectile.mesh.lookAt(newPos.clone().add(tangent));
          
          if (t >= 0.99) {
            projectile.hasHit = true;
          }
        }
        break;
        
      case 'beam':
        projectile.mesh.position.copy(projectile.targetPosition);
        break;
        
      case 'wave':
        this.updateWaveTrajectory(projectile, deltaTime);
        break;
        
      case 'spiral':
        this.updateSpiralTrajectory(projectile, deltaTime);
        break;
        
      case 'boomerang':
        this.updateBoomerangTrajectory(projectile, deltaTime);
        break;
        
      case 'seeking':
        this.updateSeekingTrajectory(projectile, deltaTime);
        break;
    }
    
    if (config.trailEnabled && projectile.trail) {
      this.updateTrail(projectile);
    }
  }
  
  private updateWaveTrajectory(projectile: ActiveProjectile, deltaTime: number): void {
    const config = projectile.config;
    const waveConfig = config.waveConfig || { amplitude: 2, frequency: 4, axis: 'horizontal' };
    
    if (projectile.wavePhase === undefined) projectile.wavePhase = 0;
    if (!projectile.baseDirection) {
      projectile.baseDirection = projectile.velocity.clone().normalize();
    }
    
    projectile.wavePhase += waveConfig.frequency * deltaTime;
    
    const baseMove = projectile.baseDirection.clone().multiplyScalar(config.speed * deltaTime);
    projectile.mesh.position.add(baseMove);
    
    const waveOffset = Math.sin(projectile.wavePhase) * waveConfig.amplitude * deltaTime * 10;
    
    const perpendicular = new THREE.Vector3().crossVectors(projectile.baseDirection, new THREE.Vector3(0, 1, 0)).normalize();
    
    if (waveConfig.axis === 'horizontal' || waveConfig.axis === 'both') {
      const horizontalOffset = perpendicular.clone().multiplyScalar(waveOffset);
      projectile.mesh.position.add(horizontalOffset);
    }
    if (waveConfig.axis === 'vertical' || waveConfig.axis === 'both') {
      projectile.mesh.position.y += waveOffset;
    }
    
    const lookOffset = perpendicular.clone().multiplyScalar(Math.cos(projectile.wavePhase) * 0.3);
    const lookDir = projectile.baseDirection.clone().add(lookOffset);
    projectile.mesh.lookAt(projectile.mesh.position.clone().add(lookDir));
  }
  
  private updateSpiralTrajectory(projectile: ActiveProjectile, deltaTime: number): void {
    const config = projectile.config;
    const spiralConfig = config.spiralConfig || { radius: 1, rotationSpeed: 8, expansionRate: 0.5 };
    
    if (projectile.spiralAngle === undefined) projectile.spiralAngle = 0;
    if (!projectile.baseDirection) {
      projectile.baseDirection = projectile.velocity.clone().normalize();
    }
    
    projectile.spiralAngle += spiralConfig.rotationSpeed * deltaTime;
    const currentRadius = spiralConfig.radius * (1 + projectile.age * spiralConfig.expansionRate);
    
    const baseMove = projectile.baseDirection.clone().multiplyScalar(config.speed * deltaTime);
    projectile.mesh.position.add(baseMove);
    
    const right = new THREE.Vector3().crossVectors(projectile.baseDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    
    const spiralOffset = right.clone().multiplyScalar(Math.cos(projectile.spiralAngle) * currentRadius)
      .add(up.clone().multiplyScalar(Math.sin(projectile.spiralAngle) * currentRadius));
    
    const targetPos = projectile.mesh.position.clone().add(spiralOffset.multiplyScalar(deltaTime * 5));
    projectile.mesh.position.lerp(targetPos, 0.3);
    
    projectile.mesh.lookAt(projectile.mesh.position.clone().add(projectile.baseDirection));
    projectile.mesh.rotateZ(projectile.spiralAngle);
  }
  
  private updateBoomerangTrajectory(projectile: ActiveProjectile, deltaTime: number): void {
    const config = projectile.config;
    const boomerangConfig = config.boomerangConfig || { returnDelay: 0.8, curveRadius: 10, spinSpeed: 15 };
    
    const outboundDuration = projectile.maxAge * boomerangConfig.returnDelay;
    const progress = projectile.age / outboundDuration;
    
    if (!projectile.isReturning && progress < 1) {
      const curveAngle = progress * Math.PI;
      const forward = projectile.targetPosition.clone().sub(projectile.startPosition).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      
      const basePos = projectile.startPosition.clone().lerp(projectile.targetPosition, progress);
      const curveOffset = right.clone().multiplyScalar(Math.sin(curveAngle) * boomerangConfig.curveRadius);
      basePos.add(curveOffset);
      basePos.y += Math.sin(curveAngle) * boomerangConfig.curveRadius * 0.5;
      
      projectile.mesh.position.copy(basePos);
      
      if (progress >= 0.95) {
        projectile.isReturning = true;
        projectile.returnStartTime = projectile.age;
      }
    } else {
      projectile.isReturning = true;
      const returnTime = projectile.age - (projectile.returnStartTime || outboundDuration);
      const returnDuration = outboundDuration * 0.7;
      const returnProgress = Math.min(returnTime / returnDuration, 1);
      
      const returnPos = projectile.mesh.position.clone().lerp(this.position, returnProgress * 0.15);
      projectile.mesh.position.copy(returnPos);
      
      if (projectile.mesh.position.distanceTo(this.position) < 2 || returnProgress >= 1) {
        projectile.hasHit = true;
      }
    }
    
    projectile.mesh.rotateY(boomerangConfig.spinSpeed * deltaTime);
  }
  
  private updateSeekingTrajectory(projectile: ActiveProjectile, deltaTime: number): void {
    const config = projectile.config;
    const seekConfig = config.seekingConfig || { turnRate: 180, acceleration: 20, maxSpeed: 50, predictionTime: 0.5 };
    
    if (projectile.currentSpeed === undefined) projectile.currentSpeed = config.speed * 0.5;
    
    projectile.currentSpeed = Math.min(projectile.currentSpeed + seekConfig.acceleration * deltaTime, seekConfig.maxSpeed);
    
    if (projectile.targetId && this.getTargetsCallback) {
      const targets = this.getTargetsCallback();
      const target = targets.find(t => t.id === projectile.targetId);
      
      if (target) {
        const predictedPos = target.position.clone().add(target.velocity.clone().multiplyScalar(seekConfig.predictionTime));
        const toTarget = predictedPos.sub(projectile.mesh.position).normalize();
        
        const currentDir = projectile.velocity.clone().normalize();
        const turnRadians = seekConfig.turnRate * THREE.MathUtils.DEG2RAD * deltaTime;
        
        const angle = currentDir.angleTo(toTarget);
        if (angle > 0.01) {
          const axis = new THREE.Vector3().crossVectors(currentDir, toTarget).normalize();
          const clampedAngle = Math.min(angle, turnRadians);
          const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, clampedAngle);
          projectile.velocity.applyQuaternion(quaternion);
        }
      }
    }
    
    projectile.velocity.normalize().multiplyScalar(projectile.currentSpeed);
    projectile.mesh.position.add(projectile.velocity.clone().multiplyScalar(deltaTime));
    projectile.mesh.lookAt(projectile.mesh.position.clone().add(projectile.velocity));
  }
  
  private updateTrail(projectile: ActiveProjectile): void {
    if (!projectile.trailPositions) {
      projectile.trailPositions = [];
    }
    
    const maxLength = projectile.config.trailLength || 10;
    projectile.trailPositions.unshift(projectile.mesh.position.clone());
    
    if (projectile.trailPositions.length > maxLength) {
      projectile.trailPositions.pop();
    }
    
    if (projectile.trail && projectile.trailPositions.length > 1) {
      const geometry = projectile.trail.geometry as THREE.BufferGeometry;
      const positions = new Float32Array(projectile.trailPositions.length * 3);
      
      projectile.trailPositions.forEach((pos, i) => {
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
      });
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
    }
  }
  
  private checkProjectileHit(projectile: ActiveProjectile): { target: Target | null; position: THREE.Vector3 } | null {
    if (projectile.mesh.position.y < 0) {
      return { target: null, position: projectile.mesh.position.clone() };
    }
    
    if (!this.getTargetsCallback) return null;
    
    const targets = this.getTargetsCallback();
    const hitRadius = projectile.config.scale * 2;
    
    for (const target of targets) {
      const distance = projectile.mesh.position.distanceTo(target.position);
      if (distance < hitRadius + target.radius) {
        return { target, position: projectile.mesh.position.clone() };
      }
    }
    
    if (projectile.config.trajectory === 'straight') {
      const distFromStart = projectile.mesh.position.distanceTo(projectile.startPosition);
      if (distFromStart > this.config.range * 1.5) {
        return { target: null, position: projectile.mesh.position.clone() };
      }
    }
    
    return null;
  }
  
  public getProjectiles(): ActiveProjectile[] {
    return [...this.projectiles];
  }
  
  public getState(): string {
    return this.state;
  }
  
  public dispose(): void {
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
      if (projectile.mesh instanceof THREE.Mesh) {
        projectile.mesh.geometry.dispose();
        if (projectile.mesh.material instanceof THREE.Material) {
          projectile.mesh.material.dispose();
        }
      }
      if (projectile.splineData?.pathLine) {
        this.scene.remove(projectile.splineData.pathLine);
        projectile.splineData.pathLine.geometry.dispose();
        (projectile.splineData.pathLine.material as THREE.Material).dispose();
      }
      if (projectile.trail) {
        this.scene.remove(projectile.trail);
        projectile.trail.geometry.dispose();
        (projectile.trail.material as THREE.Material).dispose();
      }
    }
    this.projectiles = [];
  }
}

export class TurretManager {
  private scene: THREE.Scene;
  private turrets: ScriptableTurret[] = [];
  private targets: Target[] = [];
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  public createTurret(type: TurretType, position: THREE.Vector3, projectileType?: ProjectileType): ScriptableTurret {
    const config = createTurretConfig(type, projectileType);
    const turret = new ScriptableTurret(this.scene, config, position);
    turret.setTargetProvider(() => this.targets);
    this.turrets.push(turret);
    return turret;
  }
  
  public addTurret(turret: ScriptableTurret): void {
    turret.setTargetProvider(() => this.targets);
    this.turrets.push(turret);
  }
  
  public removeTurret(turret: ScriptableTurret): void {
    const index = this.turrets.indexOf(turret);
    if (index !== -1) {
      turret.dispose();
      this.turrets.splice(index, 1);
    }
  }
  
  public setTargets(targets: Target[]): void {
    this.targets = targets;
  }
  
  public addTarget(target: Target): void {
    this.targets.push(target);
  }
  
  public removeTarget(id: string): void {
    const index = this.targets.findIndex(t => t.id === id);
    if (index !== -1) {
      this.targets.splice(index, 1);
    }
  }
  
  public update(deltaTime: number): void {
    for (const turret of this.turrets) {
      turret.update(deltaTime);
    }
  }
  
  public getTurrets(): ScriptableTurret[] {
    return [...this.turrets];
  }
  
  public dispose(): void {
    for (const turret of this.turrets) {
      turret.dispose();
    }
    this.turrets = [];
    this.targets = [];
  }
}

export function createCharacterRangedAttack(
  scene: THREE.Scene,
  weaponType: 'bow' | 'crossbow' | 'gun' | 'magic_staff' | 'magic_tome',
  position: THREE.Vector3,
  spellType?: ProjectileType
): ScriptableTurret {
  const projectileMap: Record<string, ProjectileType> = {
    bow: 'arrow',
    crossbow: 'bolt',
    gun: 'bullet',
    magic_staff: spellType || 'fireball',
    magic_tome: spellType || 'magic_missile',
  };
  
  const config = createTurretConfig(weaponType, projectileMap[weaponType], {
    range: weaponType.startsWith('magic') ? 25 : 35,
    azimuthMin: -180,
    azimuthMax: 180,
  });
  
  return new ScriptableTurret(scene, config, position);
}

export function createShipCannon(
  scene: THREE.Scene,
  position: THREE.Vector3,
  side: 'port' | 'starboard'
): ScriptableTurret {
  const azimuthRange = side === 'port' 
    ? { azimuthMin: 180, azimuthMax: 360 } 
    : { azimuthMin: 0, azimuthMax: 180 };
  
  const config = createTurretConfig('ship_cannon', 'cannonball', {
    ...azimuthRange,
    range: 80,
    fireRate: 0.2,
  });
  
  return new ScriptableTurret(scene, config, position);
}

export function createGuardTower(
  scene: THREE.Scene,
  position: THREE.Vector3,
  projectileType: ProjectileType = 'arrow'
): ScriptableTurret {
  const config = createTurretConfig('guard_tower', projectileType, {
    range: 50,
  });
  
  return new ScriptableTurret(scene, config, position);
}
