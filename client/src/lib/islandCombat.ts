import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ChestDropSystem, type ChestTier } from './chestDropSystem';
import { CharacterBuilder, CHAR_SCALE } from '@/lib/character/CharacterBuilder';
import type { CharState } from '@/lib/character/grudgeClips';
import type { Race } from '@/data/toonRTSAssets';

export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'hit' | 'death';
export type PlayerCombatState = 'idle' | 'attacking' | 'dodging' | 'blocking' | 'staggered';

export interface CombatStats {
  maxHealth: number;
  health: number;
  maxStamina: number;
  stamina: number;
  staminaRegen: number;
  attackDamage: number;
  defense: number;
  attackSpeed: number;
  dodgeStaminaCost: number;
  attackStaminaCost: number;
  blockStaminaCost: number;
}

export interface Enemy {
  id: string;
  mesh: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Map<string, THREE.AnimationAction>;
  currentAction: THREE.AnimationAction | null;
  state: EnemyState;
  stats: CombatStats;
  position: THREE.Vector3;
  rotation: number;
  targetRotation: number;
  aggroRadius: number;
  attackRadius: number;
  attackCooldown: number;
  hitStunTimer: number;
  deathTimer: number;
  lootValue: number;
  patrolPoints: THREE.Vector3[];
  patrolIndex: number;
}

export interface LootBox {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  value: number;
  collectRadius: number;
  bobOffset: number;
  collected: boolean;
}

export interface PlayerCombat {
  state: PlayerCombatState;
  stats: CombatStats;
  attackTimer: number;
  dodgeTimer: number;
  invincibleTimer: number;
  comboCount: number;
  lockedTarget: Enemy | null;
}

export interface CombatConfig {
  /** @deprecated Meshy paths ignored — grudge6 CharacterBuilder only */
  enemyModelPath?: string;
  enemyAnimationsPath?: string;
  /** grudge6 race for enemies (default orc) */
  enemyRace?: Race;
  enemyWeaponStyle?: 'sword_shield' | 'axe' | 'greatsword' | 'spear';
}

const DEFAULT_ENEMY_STATS: CombatStats = {
  maxHealth: 100,
  health: 100,
  maxStamina: 50,
  stamina: 50,
  staminaRegen: 10,
  attackDamage: 15,
  defense: 5,
  attackSpeed: 1.0,
  dodgeStaminaCost: 20,
  attackStaminaCost: 15,
  blockStaminaCost: 10,
};

const DEFAULT_PLAYER_STATS: CombatStats = {
  maxHealth: 150,
  health: 150,
  maxStamina: 100,
  stamina: 100,
  staminaRegen: 15,
  attackDamage: 25,
  defense: 10,
  attackSpeed: 1.2,
  dodgeStaminaCost: 25,
  attackStaminaCost: 20,
  blockStaminaCost: 15,
};

export class IslandCombatManager {
  private scene: THREE.Scene;
  private gltfLoader: GLTFLoader;
  private enemies: Map<string, Enemy> = new Map();
  private lootBoxes: Map<string, LootBox> = new Map();
  private playerCombat: PlayerCombat;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  private nextId: number = 0;
  /** Prototype grudge6 builder — cloned per spawn via SkeletonUtils */
  private enemyPrototype: CharacterBuilder | null = null;
  private modelLoaded: boolean = false;
  private config: CombatConfig;
  private chestDropSystem: ChestDropSystem | null = null;
  /** Per-enemy CharacterBuilder for anim updates */
  private enemyBuilders = new Map<string, CharacterBuilder>();

  setChestSystem(system: ChestDropSystem): void {
    this.chestDropSystem = system;
  }

  private readonly DODGE_DURATION = 0.5;
  private readonly ATTACK_DURATION = 0.4;
  private readonly INVINCIBLE_DURATION = 0.3;
  private readonly HITSTUN_DURATION = 0.5;
  private readonly DEATH_DURATION = 2.0;
  private readonly ENEMY_MOVE_SPEED = 3;
  private readonly ENEMY_CHASE_SPEED = 5;

  constructor(scene: THREE.Scene, config?: Partial<CombatConfig>) {
    this.scene = scene;
    this.gltfLoader = new GLTFLoader();
    this.config = {
      enemyRace: 'orc',
      enemyWeaponStyle: 'sword_shield',
      ...config,
    };

    this.playerCombat = {
      state: 'idle',
      stats: { ...DEFAULT_PLAYER_STATS },
      attackTimer: 0,
      dodgeTimer: 0,
      invincibleTimer: 0,
      comboCount: 0,
      lockedTarget: null,
    };
  }

  /**
   * Load grudge6 race kit (body filter + equipped weapon style + retargeted anims).
   * No Meshy. No geometric capsules.
   */
  async loadEnemyAssets(): Promise<boolean> {
    try {
      const race = this.config.enemyRace ?? 'orc';
      const style = this.config.enemyWeaponStyle ?? 'sword_shield';
      const builder = new CharacterBuilder({
        race,
        weaponStyle: style as 'sword_shield',
        scale: CHAR_SCALE,
      });
      await builder.load();

      // Art-forward + feet ground on prototype
      const fbx = builder.group.children[0];
      if (fbx) fbx.rotation.y = Math.PI / 2;
      builder.group.position.set(0, 0, 0);
      builder.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(builder.group);
      if (isFinite(box.min.y)) builder.group.position.y = -box.min.y;

      this.enemyPrototype = builder;
      this.modelLoaded = true;
      console.log('[IslandCombat] grudge6 enemy prototype ready', race, style);
      return true;
    } catch (error) {
      console.error('[IslandCombat] grudge6 enemy load FAILED', error);
      this.modelLoaded = false;
      return false;
    }
  }

  /**
   * Spawn one enemy as a full CharacterBuilder instance (equipped gear + anims).
   * Each unit gets its own builder so mixers don't fight.
   */
  spawnEnemy(position: THREE.Vector3, patrolPoints?: THREE.Vector3[]): Enemy | null {
    if (!this.modelLoaded || !this.enemyPrototype) {
      console.warn('[IslandCombat] spawnEnemy before loadEnemyAssets — skip');
      return null;
    }

    const race = this.config.enemyRace ?? 'orc';
    const style = (this.config.enemyWeaponStyle ?? 'sword_shield') as 'sword_shield';
    const id = `enemy-${this.nextId++}`;

    // Fire-and-forget async build — mesh placeholder group until ready
    const mesh = new THREE.Group();
    mesh.name = `grudge6-enemy-${id}`;
    mesh.position.copy(position);
    // Art-forward facing
    mesh.rotation.y = Math.atan2(
      -position.x,
      -position.z,
    );

    const enemy: Enemy = {
      id,
      mesh,
      mixer: null,
      actions: new Map(),
      currentAction: null,
      state: 'idle',
      stats: { ...DEFAULT_ENEMY_STATS },
      position: position.clone(),
      rotation: mesh.rotation.y,
      targetRotation: mesh.rotation.y,
      aggroRadius: 15,
      attackRadius: 2.2,
      attackCooldown: 0,
      hitStunTimer: 0,
      deathTimer: 0,
      lootValue: 50 + Math.floor(Math.random() * 50),
      patrolPoints: patrolPoints || [],
      patrolIndex: 0,
    };

    this.scene.add(mesh);
    this.enemies.set(enemy.id, enemy);

    // Async load full grudge6 unit into the shell group
    void (async () => {
      try {
        const builder = new CharacterBuilder({
          race,
          weaponStyle: style,
          scale: CHAR_SCALE,
        });
        await builder.load();
        const fbx = builder.group.children[0];
        if (fbx) fbx.rotation.y = Math.PI / 2;
        builder.group.position.set(0, 0, 0);
        builder.group.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(builder.group);
        if (isFinite(box.min.y)) builder.group.position.y = -box.min.y;

        mesh.add(builder.group);
        builder.play('idle');
        this.enemyBuilders.set(id, builder);
        enemy.mixer = (builder as unknown as { mixer: THREE.AnimationMixer | null }).mixer ?? null;
      } catch (e) {
        console.warn('[IslandCombat] enemy CharacterBuilder failed', id, e);
      }
    })();

    return enemy;
  }

  private playEnemyAnimation(enemy: Enemy, animName: string): void {
    const builder = this.enemyBuilders.get(enemy.id);
    if (builder) {
      const map: Record<string, CharState> = {
        idle: 'idle',
        walk: 'walk',
        run: 'run',
        attack: 'attack',
        hit: 'block',
        death: 'death',
        chase: 'run',
        patrol: 'walk',
      };
      const state = map[animName.toLowerCase()] ?? 'idle';
      builder.play(state);
      return;
    }
    // Prototype not ready yet — no-op (idle when builder finishes)
  }

  private tierFromValue(value: number): ChestTier {
    if (value >= 500) return 'legendary';
    if (value >= 300) return 'epic';
    if (value >= 150) return 'rare';
    if (value >= 80)  return 'uncommon';
    return 'common';
  }

  private createLootBox(position: THREE.Vector3, value: number, forceTier?: ChestTier): LootBox {
    const chestTier = forceTier ?? this.tierFromValue(value);

    if (this.chestDropSystem) {
      this.chestDropSystem.spawnChest(position.clone(), chestTier);
      const group = new THREE.Group();
      group.position.copy(position);
      const placeholder: LootBox = {
        id: `chest-placeholder-${this.nextId++}`,
        mesh: group,
        position: position.clone(),
        value,
        collectRadius: 999,
        bobOffset: 0,
        collected: true
      };
      return placeholder;
    }

    const group = new THREE.Group();

    const boxGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    group.add(box);

    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);

    group.position.copy(position);
    group.position.y += 0.5;

    const lootBox: LootBox = {
      id: `loot-${this.nextId++}`,
      mesh: group,
      position: position.clone(),
      value,
      collectRadius: 1.5,
      bobOffset: Math.random() * Math.PI * 2,
      collected: false,
    };

    this.scene.add(group);
    this.lootBoxes.set(lootBox.id, lootBox);

    return lootBox;
  }

  updatePlayerPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }

  playerAttack(): boolean {
    if (this.playerCombat.state !== 'idle') return false;
    if (this.playerCombat.stats.stamina < this.playerCombat.stats.attackStaminaCost) return false;

    this.playerCombat.stats.stamina -= this.playerCombat.stats.attackStaminaCost;
    this.playerCombat.state = 'attacking';
    this.playerCombat.attackTimer = this.ATTACK_DURATION;
    this.playerCombat.comboCount++;

    const attackRange = 2.5;
    const attackAngle = Math.PI / 2;

    this.enemies.forEach((enemy) => {
      if (enemy.state === 'death') return;

      const toEnemy = new THREE.Vector3().subVectors(enemy.position, this.playerPosition);
      const distance = toEnemy.length();

      if (distance < attackRange) {
        this.damageEnemyInternal(enemy, this.playerCombat.stats.attackDamage);
      }
    });

    return true;
  }

  playerDodge(direction: THREE.Vector3): boolean {
    if (this.playerCombat.state !== 'idle') return false;
    if (this.playerCombat.stats.stamina < this.playerCombat.stats.dodgeStaminaCost) return false;

    this.playerCombat.stats.stamina -= this.playerCombat.stats.dodgeStaminaCost;
    this.playerCombat.state = 'dodging';
    this.playerCombat.dodgeTimer = this.DODGE_DURATION;
    this.playerCombat.invincibleTimer = this.INVINCIBLE_DURATION;

    return true;
  }

  playerBlock(isBlocking: boolean): void {
    if (isBlocking && this.playerCombat.state === 'idle') {
      this.playerCombat.state = 'blocking';
    } else if (!isBlocking && this.playerCombat.state === 'blocking') {
      this.playerCombat.state = 'idle';
    }
  }

  toggleLockOn(): void {
    if (this.playerCombat.lockedTarget) {
      this.playerCombat.lockedTarget = null;
      return;
    }

    let closestEnemy: Enemy | null = null;
    let closestDistance = 20;

    this.enemies.forEach((enemy) => {
      if (enemy.state === 'death') return;
      const distance = enemy.position.distanceTo(this.playerPosition);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    });

    this.playerCombat.lockedTarget = closestEnemy;
  }

  private damageEnemyInternal(enemy: Enemy, damage: number): void {
    const actualDamage = Math.max(1, damage - enemy.stats.defense);
    enemy.stats.health -= actualDamage;

    if (enemy.stats.health <= 0) {
      enemy.state = 'death';
      enemy.deathTimer = this.DEATH_DURATION;
      this.playEnemyAnimation(enemy, 'death');
    } else {
      enemy.state = 'hit';
      enemy.hitStunTimer = this.HITSTUN_DURATION;
      this.playEnemyAnimation(enemy, 'hit');
    }
  }

  damagePlayer(damage: number): boolean {
    if (this.playerCombat.invincibleTimer > 0) return false;
    if (this.playerCombat.state === 'dodging') return false;

    if (this.playerCombat.state === 'blocking') {
      const blockDamage = Math.floor(damage * 0.3);
      this.playerCombat.stats.stamina -= this.playerCombat.stats.blockStaminaCost;
      if (this.playerCombat.stats.stamina <= 0) {
        this.playerCombat.state = 'staggered';
        this.playerCombat.stats.health -= damage;
      } else {
        this.playerCombat.stats.health -= blockDamage;
      }
    } else {
      this.playerCombat.stats.health -= damage;
      this.playerCombat.invincibleTimer = this.INVINCIBLE_DURATION;
    }

    return true;
  }

  collectLoot(): number {
    let totalValue = 0;

    this.lootBoxes.forEach((loot, id) => {
      if (loot.collected) return;

      const distance = loot.position.distanceTo(this.playerPosition);
      if (distance < loot.collectRadius) {
        loot.collected = true;
        totalValue += loot.value;
        this.scene.remove(loot.mesh);
        this.lootBoxes.delete(id);
      }
    });

    return totalValue;
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  getAliveCount(): number {
    let count = 0;
    this.enemies.forEach(e => { if (e.state !== 'death') count++; });
    return count;
  }

  despawnAll(): void {
    this.enemies.forEach((enemy) => {
      this.scene.remove(enemy.mesh);
      const b = this.enemyBuilders.get(enemy.id);
      b?.dispose();
      this.enemyBuilders.delete(enemy.id);
    });
    this.lootBoxes.forEach((loot) => {
      this.scene.remove(loot.mesh);
    });
    this.enemies.clear();
    this.lootBoxes.clear();
  }

  checkPlayerAttack(playerPos: THREE.Vector3, range: number): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = range;
    this.enemies.forEach(enemy => {
      if (enemy.state === 'death') return;
      const dist = enemy.position.distanceTo(playerPos);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    });
    return closest;
  }

  checkEnemyAttack(playerPos: THREE.Vector3, range: number): { damage: number; position: THREE.Vector3 } | null {
    let result: { damage: number; position: THREE.Vector3 } | null = null;
    this.enemies.forEach(enemy => {
      if (result) return;
      if (enemy.state !== 'attack') return;
      const dist = enemy.position.distanceTo(playerPos);
      if (dist < range) {
        result = { damage: enemy.stats.attackDamage, position: enemy.position.clone() };
      }
    });
    return result;
  }

  damageEnemy(enemyId: string, damage: number): boolean {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.state === 'death') return false;
    this.damageEnemyInternal(enemy, damage);
    return enemy.stats.health <= 0;
  }

  update(delta: number, playerPos?: THREE.Vector3): void {
    if (playerPos) this.playerPosition.copy(playerPos);
    if (this.playerCombat.attackTimer > 0) {
      this.playerCombat.attackTimer -= delta;
      if (this.playerCombat.attackTimer <= 0) {
        this.playerCombat.state = 'idle';
        this.playerCombat.comboCount = 0;
      }
    }

    if (this.playerCombat.dodgeTimer > 0) {
      this.playerCombat.dodgeTimer -= delta;
      if (this.playerCombat.dodgeTimer <= 0) {
        this.playerCombat.state = 'idle';
      }
    }

    if (this.playerCombat.invincibleTimer > 0) {
      this.playerCombat.invincibleTimer -= delta;
    }

    if (this.playerCombat.state === 'idle' || this.playerCombat.state === 'blocking') {
      this.playerCombat.stats.stamina = Math.min(
        this.playerCombat.stats.maxStamina,
        this.playerCombat.stats.stamina + this.playerCombat.stats.staminaRegen * delta
      );
    }

    this.enemies.forEach((enemy, id) => {
      this.updateEnemy(enemy, delta);

      if (enemy.state === 'death' && enemy.deathTimer <= 0) {
        this.createLootBox(enemy.position, enemy.lootValue);
        this.scene.remove(enemy.mesh);
        const b = this.enemyBuilders.get(id);
        b?.dispose();
        this.enemyBuilders.delete(id);
        this.enemies.delete(id);

        if (this.playerCombat.lockedTarget?.id === id) {
          this.playerCombat.lockedTarget = null;
        }
      }
    });

    const time = Date.now() * 0.003;
    this.lootBoxes.forEach((loot) => {
      if (!loot.collected) {
        loot.mesh.position.y = loot.position.y + 0.5 + Math.sin(time + loot.bobOffset) * 0.15;
        loot.mesh.rotation.y += delta * 2;
      }
    });
  }

  private updateEnemy(enemy: Enemy, delta: number): void {
    // grudge6 CharacterBuilder owns the mixer
    const builder = this.enemyBuilders.get(enemy.id);
    builder?.update(delta);
    if (enemy.mixer && !builder) {
      enemy.mixer.update(delta);
    }

    // Sync mesh transform to AI position + face player when chasing
    enemy.mesh.position.x = enemy.position.x;
    enemy.mesh.position.z = enemy.position.z;
    // Keep Y from spawn/terrain (position.y already set)
    enemy.mesh.position.y = enemy.position.y;
    enemy.mesh.rotation.y = enemy.rotation;

    if (enemy.state === 'death') {
      enemy.deathTimer -= delta;
      return;
    }

    if (enemy.state === 'hit') {
      enemy.hitStunTimer -= delta;
      if (enemy.hitStunTimer <= 0) {
        enemy.state = 'chase';
        this.playEnemyAnimation(enemy, 'run');
      }
      return;
    }

    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown -= delta;
    }

    const distanceToPlayer = enemy.position.distanceTo(this.playerPosition);

    if (distanceToPlayer < enemy.attackRadius && enemy.attackCooldown <= 0) {
      enemy.state = 'attack';
      enemy.attackCooldown = 2.0 / enemy.stats.attackSpeed;
      this.playEnemyAnimation(enemy, 'attack');
      
      setTimeout(() => {
        if (enemy.state !== 'death' && enemy.state !== 'hit') {
          this.damagePlayer(enemy.stats.attackDamage);
        }
      }, 300);
      return;
    }

    if (distanceToPlayer < enemy.aggroRadius) {
      enemy.state = 'chase';
      
      const toPlayer = new THREE.Vector3().subVectors(this.playerPosition, enemy.position);
      toPlayer.y = 0;
      toPlayer.normalize();

      enemy.targetRotation = Math.atan2(toPlayer.x, toPlayer.z);

      let rotDiff = enemy.targetRotation - enemy.rotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      enemy.rotation += rotDiff * Math.min(1, delta * 5);
      enemy.mesh.rotation.y = enemy.rotation;

      if (distanceToPlayer > enemy.attackRadius) {
        enemy.position.add(toPlayer.multiplyScalar(this.ENEMY_CHASE_SPEED * delta));
        enemy.mesh.position.copy(enemy.position);
        this.playEnemyAnimation(enemy, 'run');
      }
    } else if (enemy.patrolPoints.length > 0) {
      enemy.state = 'patrol';
      const target = enemy.patrolPoints[enemy.patrolIndex];
      const toTarget = new THREE.Vector3().subVectors(target, enemy.position);
      toTarget.y = 0;

      if (toTarget.length() < 1) {
        enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrolPoints.length;
      } else {
        toTarget.normalize();
        enemy.targetRotation = Math.atan2(toTarget.x, toTarget.z);
        
        let rotDiff = enemy.targetRotation - enemy.rotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        enemy.rotation += rotDiff * Math.min(1, delta * 3);
        enemy.mesh.rotation.y = enemy.rotation;

        enemy.position.add(toTarget.multiplyScalar(this.ENEMY_MOVE_SPEED * delta));
        enemy.mesh.position.copy(enemy.position);
        this.playEnemyAnimation(enemy, 'walk');
      }
    } else {
      if (enemy.state !== 'idle') {
        enemy.state = 'idle';
        this.playEnemyAnimation(enemy, 'idle');
      }
    }
  }

  getPlayerStats(): CombatStats {
    return this.playerCombat.stats;
  }

  getPlayerState(): PlayerCombatState {
    return this.playerCombat.state;
  }

  getLockedTarget(): Enemy | null {
    return this.playerCombat.lockedTarget;
  }

  getEnemies(): Enemy[] {
    return Array.from(this.enemies.values());
  }

  getLootBoxes(): LootBox[] {
    return Array.from(this.lootBoxes.values());
  }

  isPlayerInvincible(): boolean {
    return this.playerCombat.invincibleTimer > 0 || this.playerCombat.state === 'dodging';
  }

  dispose(): void {
    this.enemies.forEach((enemy) => {
      this.scene.remove(enemy.mesh);
    });
    this.lootBoxes.forEach((loot) => {
      this.scene.remove(loot.mesh);
    });
    this.enemies.clear();
    this.lootBoxes.clear();
  }
}
