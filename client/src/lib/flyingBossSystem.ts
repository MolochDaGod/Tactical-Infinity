import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface FlyingBoss {
  id: string;
  name: string;
  mesh: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  animations: Map<string, THREE.AnimationAction>;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  state: 'soaring' | 'circling' | 'diving' | 'attacking' | 'retreating' | 'fireball';
  target: { type: 'ship' | 'creature' | 'none'; position: THREE.Vector3; id?: string } | null;
  altitude: number;
  targetAltitude: number;
  circleCenter: THREE.Vector3;
  circleRadius: number;
  circleAngle: number;
  diveSpeed: number;
  attackCooldown: number;
  fireballCooldown: number;
  lastAttackTime: number;
  lastFireballTime: number;
  wingFlapPhase: number;
  spawnTime: number;
  aggroRange: number;
  deathTime: number | null;
}

export interface Fireball {
  id: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  lifeTime: number;
  maxLifeTime: number;
  trail: THREE.Points | null;
}

export interface FlyingBossConfig {
  name: string;
  modelPath: string;
  scale: number;
  health: number;
  damage: number;
  fireballDamage: number;
  speed: number;
  diveSpeed: number;
  soarAltitude: number;
  attackAltitude: number;
  aggroRange: number;
  attackCooldown: number;
  fireballCooldown: number;
  spawnChance: number;
}

const BOSS_CONFIGS: Record<string, FlyingBossConfig> = {
  skyterror: {
    name: 'Sky Terror',
    modelPath: '/models/scenes/meta_ridley/scene.gltf',
    scale: 15,
    health: 500,
    damage: 80,
    fireballDamage: 40,
    speed: 60,
    diveSpeed: 120,
    soarAltitude: 200,
    attackAltitude: 30,
    aggroRange: 500,
    attackCooldown: 8,
    fireballCooldown: 4,
    spawnChance: 0.001,
  }
};

export class FlyingBossSystem {
  private scene: THREE.Scene;
  private bosses: Map<string, FlyingBoss> = new Map();
  private fireballs: Map<string, Fireball> = new Map();
  private bossModel: THREE.Group | null = null;
  private bossAnimations: THREE.AnimationClip[] = [];
  private modelLoaded = false;
  private onBossAttack: ((bossId: string, targetType: string, targetId: string, damage: number) => void) | null = null;
  private onFireballHit: ((fireballId: string, targetType: string, targetId: string, damage: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadBossModel();
  }

  private async loadBossModel(): Promise<void> {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(BOSS_CONFIGS.skyterror.modelPath);
      this.bossModel = gltf.scene;
      this.bossAnimations = gltf.animations;
      this.modelLoaded = true;
      console.log('[FlyingBoss] Model loaded with', this.bossAnimations.length, 'animations');
    } catch (error) {
      console.error('[FlyingBoss] Failed to load model:', error);
      this.createFallbackModel();
    }
  }

  private createFallbackModel(): void {
    const group = new THREE.Group();
    
    const bodyGeom = new THREE.ConeGeometry(3, 12, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a0080, metalness: 0.6, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    
    const wingGeom = new THREE.PlaneGeometry(20, 6);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x6a0090, side: THREE.DoubleSide });
    const leftWing = new THREE.Mesh(wingGeom, wingMat);
    leftWing.position.set(-8, 0, 0);
    leftWing.rotation.z = 0.2;
    group.add(leftWing);
    
    const rightWing = new THREE.Mesh(wingGeom, wingMat);
    rightWing.position.set(8, 0, 0);
    rightWing.rotation.z = -0.2;
    group.add(rightWing);
    
    const headGeom = new THREE.SphereGeometry(2, 8, 8);
    const head = new THREE.Mesh(headGeom, bodyMat);
    head.position.set(0, 0, 7);
    group.add(head);
    
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.5), eyeMat);
    leftEye.position.set(-1, 0.5, 8);
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.5), eyeMat);
    rightEye.position.set(1, 0.5, 8);
    group.add(rightEye);
    
    this.bossModel = group;
    this.modelLoaded = true;
  }

  setAttackCallback(callback: (bossId: string, targetType: string, targetId: string, damage: number) => void): void {
    this.onBossAttack = callback;
  }

  setFireballHitCallback(callback: (fireballId: string, targetType: string, targetId: string, damage: number) => void): void {
    this.onFireballHit = callback;
  }

  spawnBoss(position: THREE.Vector3, type: string = 'skyterror'): FlyingBoss | null {
    if (!this.modelLoaded || !this.bossModel) return null;
    
    const config = BOSS_CONFIGS[type];
    if (!config) return null;
    
    const id = `boss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mesh = this.bossModel.clone();
    mesh.scale.setScalar(config.scale);
    
    const spawnPos = position.clone();
    spawnPos.y = config.soarAltitude;
    mesh.position.copy(spawnPos);
    
    let mixer: THREE.AnimationMixer | null = null;
    const animations = new Map<string, THREE.AnimationAction>();
    
    if (this.bossAnimations.length > 0) {
      mixer = new THREE.AnimationMixer(mesh);
      this.bossAnimations.forEach(clip => {
        const action = mixer!.clipAction(clip);
        animations.set(clip.name.toLowerCase(), action);
      });
    }
    
    const boss: FlyingBoss = {
      id,
      name: config.name,
      mesh,
      mixer,
      animations,
      position: spawnPos.clone(),
      velocity: new THREE.Vector3(),
      health: config.health,
      maxHealth: config.health,
      state: 'soaring',
      target: null,
      altitude: config.soarAltitude,
      targetAltitude: config.soarAltitude,
      circleCenter: position.clone(),
      circleRadius: 200 + Math.random() * 100,
      circleAngle: Math.random() * Math.PI * 2,
      diveSpeed: config.diveSpeed,
      attackCooldown: config.attackCooldown,
      fireballCooldown: config.fireballCooldown,
      lastAttackTime: 0,
      lastFireballTime: 0,
      wingFlapPhase: Math.random() * Math.PI * 2,
      spawnTime: Date.now(),
      aggroRange: config.aggroRange,
      deathTime: null,
    };
    
    this.scene.add(mesh);
    this.bosses.set(id, boss);
    console.log(`[FlyingBoss] Spawned ${config.name} at`, spawnPos);
    
    return boss;
  }

  private createFireball(boss: FlyingBoss, targetPos: THREE.Vector3): Fireball {
    const id = `fireball_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const geometry = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    mesh.add(innerGlow);
    
    const startPos = boss.position.clone();
    startPos.y -= 5;
    mesh.position.copy(startPos);
    
    const direction = targetPos.clone().sub(startPos).normalize();
    const speed = 80;
    
    const trailGeom = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(30 * 3);
    for (let i = 0; i < 30; i++) {
      trailPositions[i * 3] = startPos.x;
      trailPositions[i * 3 + 1] = startPos.y;
      trailPositions[i * 3 + 2] = startPos.z;
    }
    trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    
    const trailMat = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 3,
      transparent: true,
      opacity: 0.6,
    });
    const trail = new THREE.Points(trailGeom, trailMat);
    
    this.scene.add(mesh);
    this.scene.add(trail);
    
    const fireball: Fireball = {
      id,
      mesh,
      position: startPos.clone(),
      velocity: direction.multiplyScalar(speed),
      damage: BOSS_CONFIGS.skyterror.fireballDamage,
      lifeTime: 0,
      maxLifeTime: 8,
      trail,
    };
    
    this.fireballs.set(id, fireball);
    return fireball;
  }

  update(
    delta: number,
    playerShipPos: THREE.Vector3 | null,
    npcShips: Array<{ id: string; position: THREE.Vector3 }>,
    seaCreatures: Array<{ id: string; position: THREE.Vector3; type: string }>
  ): void {
    const currentTime = Date.now() / 1000;
    
    this.bosses.forEach((boss, id) => {
      if (boss.deathTime !== null) {
        this.updateDeathAnimation(boss, delta);
        return;
      }
      
      if (boss.mixer) {
        boss.mixer.update(delta);
      }
      
      boss.wingFlapPhase += delta * 3;
      
      this.findTarget(boss, playerShipPos, npcShips, seaCreatures);
      
      switch (boss.state) {
        case 'soaring':
          this.updateSoaring(boss, delta, currentTime);
          break;
        case 'circling':
          this.updateCircling(boss, delta, currentTime);
          break;
        case 'diving':
          this.updateDiving(boss, delta);
          break;
        case 'attacking':
          this.updateAttacking(boss, delta, currentTime);
          break;
        case 'retreating':
          this.updateRetreating(boss, delta);
          break;
        case 'fireball':
          this.updateFireballState(boss, delta, currentTime);
          break;
      }
      
      boss.position.add(boss.velocity.clone().multiplyScalar(delta));
      boss.mesh.position.copy(boss.position);
      
      this.updateOrientation(boss, delta);
    });
    
    this.updateFireballs(delta, playerShipPos, npcShips, seaCreatures);
  }

  private findTarget(
    boss: FlyingBoss,
    playerShipPos: THREE.Vector3 | null,
    npcShips: Array<{ id: string; position: THREE.Vector3 }>,
    seaCreatures: Array<{ id: string; position: THREE.Vector3; type: string }>
  ): void {
    if (boss.target && boss.state !== 'soaring') return;
    
    let closestTarget: FlyingBoss['target'] = null;
    let closestDist = boss.aggroRange;
    
    if (playerShipPos) {
      const dist = boss.position.distanceTo(playerShipPos);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = { type: 'ship', position: playerShipPos.clone(), id: 'player' };
      }
    }
    
    npcShips.forEach(ship => {
      const dist = boss.position.distanceTo(ship.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = { type: 'ship', position: ship.position.clone(), id: ship.id };
      }
    });
    
    seaCreatures.forEach(creature => {
      if (creature.type === 'kraken' || creature.type === 'megalodon' || creature.type === 'great_white') {
        const dist = boss.position.distanceTo(creature.position);
        if (dist < closestDist) {
          closestDist = dist;
          closestTarget = { type: 'creature', position: creature.position.clone(), id: creature.id };
        }
      }
    });
    
    if (closestTarget) {
      boss.target = closestTarget;
      boss.circleCenter.copy(closestTarget.position);
      boss.state = 'circling';
    }
  }

  private updateSoaring(boss: FlyingBoss, delta: number, currentTime: number): void {
    const config = BOSS_CONFIGS.skyterror;
    
    boss.circleAngle += delta * 0.3;
    const targetX = boss.circleCenter.x + Math.cos(boss.circleAngle) * boss.circleRadius;
    const targetZ = boss.circleCenter.z + Math.sin(boss.circleAngle) * boss.circleRadius;
    
    const targetPos = new THREE.Vector3(targetX, config.soarAltitude, targetZ);
    const direction = targetPos.clone().sub(boss.position).normalize();
    
    boss.velocity.lerp(direction.multiplyScalar(config.speed * 0.5), delta * 2);
    boss.targetAltitude = config.soarAltitude;
    
    const altDiff = boss.targetAltitude - boss.position.y;
    boss.velocity.y = altDiff * 0.5;
  }

  private updateCircling(boss: FlyingBoss, delta: number, currentTime: number): void {
    if (!boss.target) {
      boss.state = 'soaring';
      return;
    }
    
    const config = BOSS_CONFIGS.skyterror;
    
    boss.circleCenter.lerp(boss.target.position, delta * 0.5);
    boss.circleAngle += delta * 0.8;
    
    const circleAlt = config.soarAltitude * 0.7;
    const targetX = boss.circleCenter.x + Math.cos(boss.circleAngle) * 150;
    const targetZ = boss.circleCenter.z + Math.sin(boss.circleAngle) * 150;
    
    const targetPos = new THREE.Vector3(targetX, circleAlt, targetZ);
    const direction = targetPos.clone().sub(boss.position).normalize();
    
    boss.velocity.lerp(direction.multiplyScalar(config.speed * 0.7), delta * 3);
    
    const altDiff = circleAlt - boss.position.y;
    boss.velocity.y = altDiff * 0.5;
    
    const distToTarget = new THREE.Vector2(
      boss.position.x - boss.target.position.x,
      boss.position.z - boss.target.position.z
    ).length();
    
    if (currentTime - boss.lastFireballTime > boss.fireballCooldown && distToTarget < 300) {
      boss.state = 'fireball';
      boss.lastFireballTime = currentTime;
    } else if (currentTime - boss.lastAttackTime > boss.attackCooldown && distToTarget < 200) {
      boss.state = 'diving';
      boss.lastAttackTime = currentTime;
    }
  }

  private updateDiving(boss: FlyingBoss, delta: number): void {
    if (!boss.target) {
      boss.state = 'retreating';
      return;
    }
    
    const config = BOSS_CONFIGS.skyterror;
    
    const targetPos = boss.target.position.clone();
    targetPos.y = config.attackAltitude;
    
    const direction = targetPos.clone().sub(boss.position).normalize();
    boss.velocity.lerp(direction.multiplyScalar(config.diveSpeed), delta * 5);
    
    const distToTarget = boss.position.distanceTo(boss.target.position);
    
    if (distToTarget < 40) {
      boss.state = 'attacking';
      this.playAnimation(boss, 'attack');
    }
    
    if (boss.position.y < config.attackAltitude) {
      boss.position.y = config.attackAltitude;
      boss.velocity.y = 0;
    }
  }

  private updateAttacking(boss: FlyingBoss, delta: number, currentTime: number): void {
    if (!boss.target) {
      boss.state = 'retreating';
      return;
    }
    
    const config = BOSS_CONFIGS.skyterror;
    
    const distToTarget = boss.position.distanceTo(boss.target.position);
    
    if (distToTarget < 30) {
      if (this.onBossAttack && boss.target.id) {
        this.onBossAttack(boss.id, boss.target.type, boss.target.id, config.damage);
      }
      boss.state = 'retreating';
    }
    
    const direction = boss.target.position.clone().sub(boss.position).normalize();
    boss.velocity.lerp(direction.multiplyScalar(config.diveSpeed * 0.8), delta * 4);
    
    if (boss.position.y < 10) {
      boss.state = 'retreating';
    }
  }

  private updateRetreating(boss: FlyingBoss, delta: number): void {
    const config = BOSS_CONFIGS.skyterror;
    
    const retreatDir = new THREE.Vector3(
      Math.sin(boss.circleAngle) * 0.5,
      1,
      Math.cos(boss.circleAngle) * 0.5
    ).normalize();
    
    boss.velocity.lerp(retreatDir.multiplyScalar(config.speed), delta * 3);
    
    if (boss.position.y >= config.soarAltitude * 0.8) {
      boss.state = boss.target ? 'circling' : 'soaring';
    }
  }

  private updateFireballState(boss: FlyingBoss, delta: number, currentTime: number): void {
    if (!boss.target) {
      boss.state = 'circling';
      return;
    }
    
    boss.velocity.multiplyScalar(0.9);
    
    const leadTime = boss.position.distanceTo(boss.target.position) / 80;
    const predictedPos = boss.target.position.clone();
    
    this.createFireball(boss, predictedPos);
    
    boss.state = 'circling';
  }

  private updateDeathAnimation(boss: FlyingBoss, delta: number): void {
    boss.velocity.y -= 30 * delta;
    boss.position.add(boss.velocity.clone().multiplyScalar(delta));
    boss.mesh.position.copy(boss.position);
    
    boss.mesh.rotation.x += delta * 2;
    boss.mesh.rotation.z += delta * 1.5;
    
    if (boss.position.y < -50) {
      this.scene.remove(boss.mesh);
      this.bosses.delete(boss.id);
    }
  }

  private updateOrientation(boss: FlyingBoss, delta: number): void {
    if (boss.velocity.lengthSq() > 0.01) {
      const lookDir = boss.velocity.clone().normalize();
      const targetRotation = Math.atan2(lookDir.x, lookDir.z);
      
      let currentY = boss.mesh.rotation.y;
      const diff = targetRotation - currentY;
      const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
      boss.mesh.rotation.y += normalizedDiff * delta * 3;
      
      const pitchTarget = boss.state === 'diving' ? -0.5 : 
                          boss.state === 'retreating' ? 0.3 : 0;
      boss.mesh.rotation.x = THREE.MathUtils.lerp(boss.mesh.rotation.x, pitchTarget, delta * 2);
      
      const bankAngle = Math.sin(boss.wingFlapPhase) * 0.1;
      boss.mesh.rotation.z = bankAngle;
    }
  }

  private playAnimation(boss: FlyingBoss, name: string): void {
    const action = boss.animations.get(name.toLowerCase());
    if (action) {
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }
  }

  private updateFireballs(
    delta: number,
    playerShipPos: THREE.Vector3 | null,
    npcShips: Array<{ id: string; position: THREE.Vector3 }>,
    seaCreatures: Array<{ id: string; position: THREE.Vector3; type: string }>
  ): void {
    const toRemove: string[] = [];
    
    this.fireballs.forEach((fireball, id) => {
      fireball.lifeTime += delta;
      fireball.position.add(fireball.velocity.clone().multiplyScalar(delta));
      fireball.mesh.position.copy(fireball.position);
      
      fireball.velocity.y -= 5 * delta;
      
      fireball.mesh.rotation.x += delta * 5;
      fireball.mesh.rotation.y += delta * 3;
      
      if (fireball.trail) {
        const positions = fireball.trail.geometry.attributes.position.array as Float32Array;
        for (let i = positions.length - 3; i >= 3; i -= 3) {
          positions[i] = positions[i - 3];
          positions[i + 1] = positions[i - 2];
          positions[i + 2] = positions[i - 1];
        }
        positions[0] = fireball.position.x;
        positions[1] = fireball.position.y;
        positions[2] = fireball.position.z;
        fireball.trail.geometry.attributes.position.needsUpdate = true;
      }
      
      const hitRadius = 15;
      
      if (playerShipPos && fireball.position.distanceTo(playerShipPos) < hitRadius) {
        if (this.onFireballHit) {
          this.onFireballHit(id, 'ship', 'player', fireball.damage);
        }
        toRemove.push(id);
        return;
      }
      
      for (const ship of npcShips) {
        if (fireball.position.distanceTo(ship.position) < hitRadius) {
          if (this.onFireballHit) {
            this.onFireballHit(id, 'ship', ship.id, fireball.damage);
          }
          toRemove.push(id);
          return;
        }
      }
      
      for (const creature of seaCreatures) {
        if (fireball.position.distanceTo(creature.position) < hitRadius * 1.5) {
          if (this.onFireballHit) {
            this.onFireballHit(id, 'creature', creature.id, fireball.damage);
          }
          toRemove.push(id);
          return;
        }
      }
      
      if (fireball.lifeTime > fireball.maxLifeTime || fireball.position.y < 0) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => {
      const fireball = this.fireballs.get(id);
      if (fireball) {
        this.scene.remove(fireball.mesh);
        if (fireball.trail) {
          this.scene.remove(fireball.trail);
        }
        this.fireballs.delete(id);
      }
    });
  }

  damageBoss(bossId: string, damage: number): boolean {
    const boss = this.bosses.get(bossId);
    if (!boss || boss.deathTime !== null) return false;
    
    boss.health -= damage;
    
    if (boss.health <= 0) {
      boss.deathTime = Date.now();
      boss.velocity.set(
        (Math.random() - 0.5) * 20,
        -10,
        (Math.random() - 0.5) * 20
      );
      return true;
    }
    
    return false;
  }

  getBosses(): FlyingBoss[] {
    return Array.from(this.bosses.values());
  }

  getFireballs(): Fireball[] {
    return Array.from(this.fireballs.values());
  }

  trySpawnBoss(position: THREE.Vector3): FlyingBoss | null {
    if (Math.random() < BOSS_CONFIGS.skyterror.spawnChance) {
      return this.spawnBoss(position);
    }
    return null;
  }

  forceSpawnBoss(position: THREE.Vector3): FlyingBoss | null {
    return this.spawnBoss(position);
  }

  dispose(): void {
    this.bosses.forEach(boss => {
      this.scene.remove(boss.mesh);
    });
    this.bosses.clear();
    
    this.fireballs.forEach(fireball => {
      this.scene.remove(fireball.mesh);
      if (fireball.trail) {
        this.scene.remove(fireball.trail);
      }
    });
    this.fireballs.clear();
  }
}
