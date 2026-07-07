import * as THREE from 'three';
import * as YUKA from 'yuka';
import type { UnifiedNavSystem, NavLayerKind } from './nav';
import { cloneAnimatedEnemy, type AnimatedEnemyInstance } from './animatedEnemyLoader';

export interface AIEnemyConfig {
  name: string;
  level: number;
  position: THREE.Vector3;
  faction: 'raider' | 'undead' | 'beast' | 'bandit' | 'legion';
  aggroRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  moveSpeed: number;
  hp: number;
  /** When true the unit fights *for* the player: it hunts hostile enemies,
   *  follows the player when there's nothing to fight, and is excluded from
   *  the player's target list + wave-clear counting. */
  isAlly?: boolean;
}

export interface AIEnemy {
  id: number;
  config: AIEnemyConfig;
  entity: YUKA.Vehicle;
  mesh: THREE.Group;
  ring: THREE.Mesh;
  hp: number;
  maxHp: number;
  alive: boolean;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';
  attackTimer: number;
  memory: {
    lastSeenPlayer: YUKA.Vector3 | null;
    lastSeenTime: number;
    timesHit: number;
    hasBeenAggro: boolean;
  };
  navPath: { waypoints: THREE.Vector3[]; idx: number; refreshAt: number; targetSnapshot: THREE.Vector3 } | null;
  /** Present when the enemy uses a real Toon-RTS rig + animation mixer. */
  animated: AnimatedEnemyInstance | null;
  /** Seconds remaining until a corpse is removed from the scene. */
  corpseTimer: number;
  /** True for player-friendly units (see AIEnemyConfig.isAlly). */
  isAlly: boolean;
}

let nextId = 1;

const FACTION_COLORS: Record<string, number> = {
  raider: 0xAA3322,
  undead: 0x6644AA,
  beast: 0x228833,
  bandit: 0x886622,
};

export class YukaAISystem {
  private entityManager: YUKA.EntityManager;
  private enemies: AIEnemy[] = [];
  private scene: THREE.Scene;
  private playerPos: YUKA.Vector3 = new YUKA.Vector3();
  private nav: UnifiedNavSystem | null = null;
  private navLayer: NavLayerKind = 'land';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.entityManager = new YUKA.EntityManager();
  }

  /** Attach a UnifiedNavSystem so chase/patrol routes path around terrain. */
  setNavSystem(nav: UnifiedNavSystem | null, layer: NavLayerKind = 'land') {
    this.nav = nav;
    this.navLayer = layer;
  }

  get allEnemies(): AIEnemy[] { return this.enemies; }
  /** Alive *hostile* units only — allies are excluded so wave-clear counting,
   *  targeting, and player melee never treat a friendly unit as an enemy. */
  get aliveEnemies(): AIEnemy[] { return this.enemies.filter(e => e.alive && !e.isAlly); }
  get aliveAllies(): AIEnemy[] { return this.enemies.filter(e => e.alive && e.isAlly); }
  get aliveCount(): number { return this.aliveEnemies.length; }

  /** Convenience wrapper: spawn a player-friendly unit through the same rig +
   *  gear pipeline as enemies. */
  spawnAlly(config: AIEnemyConfig): AIEnemy {
    return this.spawnEnemy({ ...config, isAlly: true });
  }

  spawnEnemy(config: AIEnemyConfig): AIEnemy {
    const vehicle = new YUKA.Vehicle();
    vehicle.position.set(config.position.x, config.position.y, config.position.z);
    vehicle.maxSpeed = config.moveSpeed;
    vehicle.maxForce = 8;
    vehicle.mass = 1.2;

    const wanderBehavior = new YUKA.WanderBehavior();
    wanderBehavior.jitter = 5;
    wanderBehavior.radius = 3;
    wanderBehavior.distance = 4;
    wanderBehavior.weight = 0.5;
    vehicle.steering.add(wanderBehavior);

    const seekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
    seekBehavior.weight = 0;
    vehicle.steering.add(seekBehavior);

    const fleeBehavior = new YUKA.FleeBehavior(new YUKA.Vector3(), 6);
    fleeBehavior.weight = 0;
    vehicle.steering.add(fleeBehavior);

    this.entityManager.add(vehicle);

    // Prefer the real Toon-RTS rigged + animated enemy when its assets are
    // already preloaded; otherwise fall back to the legacy primitive mesh
    // so a missed preload never blocks a wave from spawning.
    const animated = cloneAnimatedEnemy(config.faction);
    const mesh = animated ? animated.group : this._buildEnemyMesh(config);
    mesh.position.copy(config.position);
    this.scene.add(mesh);

    const isAlly = config.isAlly ?? false;
    const ringGeo = new THREE.RingGeometry(0.55, 0.65, 24);
    ringGeo.rotateX(-Math.PI / 2);
    // Allies wear a persistent friendly (green) ground ring so the player can
    // tell them apart at a glance; enemy rings are gold and only shown when
    // the player has that enemy targeted.
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: isAlly ? 0x33DD66 : 0xFFD700, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
    }));
    ring.position.y = 0.02;
    ring.visible = isAlly;
    mesh.add(ring);

    const enemy: AIEnemy = {
      id: nextId++,
      config,
      entity: vehicle,
      mesh,
      ring,
      hp: config.hp,
      maxHp: config.hp,
      alive: true,
      state: isAlly ? 'idle' : 'patrol',
      attackTimer: 0,
      memory: {
        lastSeenPlayer: null,
        lastSeenTime: 0,
        timesHit: 0,
        hasBeenAggro: false,
      },
      navPath: null,
      animated,
      corpseTimer: 0,
      isAlly,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  /** Compute or reuse a navmesh waypoint for this enemy targeting `goal`. */
  private _navWaypoint(e: AIEnemy, goalWorld: THREE.Vector3): THREE.Vector3 | null {
    if (!this.nav?.isReady(this.navLayer)) return null;

    const ePos = new THREE.Vector3(e.entity.position.x, e.entity.position.y, e.entity.position.z);
    const now = performance.now();
    const cached = e.navPath;
    const targetMoved = cached ? cached.targetSnapshot.distanceTo(goalWorld) > 2.5 : true;
    const stale = !cached || now > cached.refreshAt || targetMoved;

    if (stale) {
      const path = this.nav.findPath(ePos, goalWorld, { layer: this.navLayer, allowCrossLayer: false });
      const waypoints = path.map(p => p.position);
      e.navPath = {
        waypoints,
        idx: 0,
        refreshAt: now + 600,
        targetSnapshot: goalWorld.clone(),
      };
    }

    const np = e.navPath!;
    if (np.waypoints.length === 0) return null;

    // Advance through waypoints we've reached
    while (np.idx < np.waypoints.length - 1) {
      const wp = np.waypoints[np.idx];
      if (ePos.distanceTo(wp) < 1.2) np.idx++;
      else break;
    }
    return np.waypoints[np.idx];
  }

  /** Steering + attack logic for a friendly (ally) unit. Mirrors the enemy
   *  state machine but targets the nearest hostile and trails the player when
   *  the field is clear. Ally hits are applied directly to enemies here so the
   *  battle loop's `attackingEnemies` list stays player-damage-only. */
  private _updateAlly(
    e: AIEnemy,
    dt: number,
    ePos: YUKA.Vector3,
    wanderB: YUKA.WanderBehavior,
    seekB: YUKA.SeekBehavior,
    fleeB: YUKA.FleeBehavior,
  ): void {
    fleeB.weight = 0;
    const ePosV = new THREE.Vector3(ePos.x, ePos.y, ePos.z);
    const foe = this.findNearest(ePosV);

    if (foe) {
      const foePos = foe.mesh.position;
      const d = ePosV.distanceTo(foePos);
      if (d < e.config.attackRange) {
        e.state = 'attack';
        wanderB.weight = 0;
        seekB.target.set(foePos.x, foePos.y, foePos.z);
        seekB.weight = 0.3;
        e.navPath = null;
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = e.config.attackCooldown;
          this.damageEnemy(foe, e.config.attackDamage);
        }
        return;
      }
      // Allies are relentless — pursue a hostile well past the enemy aggro range.
      if (d < e.config.aggroRange * 3) {
        e.state = 'chase';
        wanderB.weight = 0;
        const goal = new THREE.Vector3(foePos.x, foePos.y, foePos.z);
        const wp = this._navWaypoint(e, goal);
        if (wp) seekB.target.set(wp.x, wp.y, wp.z);
        else seekB.target.set(foePos.x, foePos.y, foePos.z);
        seekB.weight = 2.5;
        return;
      }
    }

    // Nothing to fight (or foe too far): trail the player.
    const toP = (new YUKA.Vector3() as any).subVectors(this.playerPos, ePos);
    const dP = (toP as any).length();
    if (dP > 5) {
      e.state = 'chase';
      wanderB.weight = 0;
      const goal = new THREE.Vector3(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      const wp = this._navWaypoint(e, goal);
      if (wp) seekB.target.set(wp.x, wp.y, wp.z);
      else seekB.target.copy(this.playerPos);
      seekB.weight = 2.0;
    } else {
      e.state = 'idle';
      wanderB.weight = 0.4; seekB.weight = 0;
      e.navPath = null;
    }
  }

  update(dt: number, playerWorldPos: THREE.Vector3): { attackingEnemies: AIEnemy[] } {
    this.playerPos.set(playerWorldPos.x, playerWorldPos.y, playerWorldPos.z);
    const attackingEnemies: AIEnemy[] = [];

    this.enemies.forEach(e => {
      if (!e.alive) return;

      const ePos = e.entity.position;

      const behaviors = (e.entity.steering as any).behaviors;
      const wanderB  = behaviors[0] as YUKA.WanderBehavior;
      const seekB    = behaviors[1] as YUKA.SeekBehavior;
      const fleeB    = behaviors[2] as YUKA.FleeBehavior;

      // Allies fight *for* the player: hunt the nearest hostile, and fall
      // back to trailing the player when the field is clear.
      if (e.isAlly) {
        this._updateAlly(e, dt, ePos, wanderB, seekB, fleeB);
      } else {
      // Enemies pick the nearest hostile target between the player and any
      // alive ally, so a summoned companion can pull aggro and take hits
      // instead of the player always being the sole focus.
      const target = this._nearestHostileTarget(ePos);
      const targetPos = target.pos;
      const targetAlly = target.ally;
      const dist = target.dist;

      // State machine
      const shouldFlee = e.hp < e.maxHp * 0.15;
      const inAggro = dist < e.config.aggroRange;
      const inAttack = dist < e.config.attackRange;

      if (shouldFlee && e.memory.timesHit > 3) {
        e.state = 'flee';
        wanderB.weight = 0; seekB.weight = 0;
        fleeB.target.set(targetPos.x, targetPos.y, targetPos.z);
        fleeB.weight = 3;
      } else if (inAttack) {
        e.state = 'attack';
        wanderB.weight = 0; fleeB.weight = 0;
        seekB.target.set(targetPos.x, targetPos.y, targetPos.z);
        seekB.weight = 0.3;
        e.navPath = null;

        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = e.config.attackCooldown;
          // Ally hits are resolved here so the battle loop's damage list stays
          // player-only; player hits are queued for the caller to resolve.
          if (targetAlly) this.damageEnemy(targetAlly, e.config.attackDamage);
          else attackingEnemies.push(e);
        }
      } else if (inAggro) {
        e.state = 'chase';
        wanderB.weight = 0; fleeB.weight = 0;
        // Route through navmesh if available so enemies path around hills/walls.
        const goal = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
        const wp = this._navWaypoint(e, goal);
        if (wp) seekB.target.set(wp.x, wp.y, wp.z);
        else seekB.target.set(targetPos.x, targetPos.y, targetPos.z);
        seekB.weight = 2.5;
        e.memory.lastSeenPlayer = new YUKA.Vector3(targetPos.x, targetPos.y, targetPos.z);
        e.memory.lastSeenTime = performance.now();
        e.memory.hasBeenAggro = true;
      } else if (e.memory.hasBeenAggro && performance.now() - e.memory.lastSeenTime < 5000) {
        e.state = 'chase';
        if (e.memory.lastSeenPlayer) {
          const goal = new THREE.Vector3(e.memory.lastSeenPlayer.x, e.memory.lastSeenPlayer.y, e.memory.lastSeenPlayer.z);
          const wp = this._navWaypoint(e, goal);
          if (wp) seekB.target.set(wp.x, wp.y, wp.z);
          else seekB.target.copy(e.memory.lastSeenPlayer);
        }
        seekB.weight = 1.5; wanderB.weight = 0.3; fleeB.weight = 0;
      } else {
        e.state = 'patrol';
        wanderB.weight = 0.8; seekB.weight = 0; fleeB.weight = 0;
        e.memory.hasBeenAggro = false;
        e.navPath = null;
      }
      }

      // Clamp to island bounds
      const r2 = ePos.x * ePos.x + ePos.z * ePos.z;
      if (r2 > 20 * 20) {
        const r = Math.sqrt(r2);
        ePos.x = ePos.x / r * 20;
        ePos.z = ePos.z / r * 20;
      }

      // Sync mesh to entity
      e.mesh.position.set(ePos.x, ePos.y, ePos.z);
      const speed2 = (e.entity.velocity as any).squaredLength();
      if (speed2 > 0.01) {
        const vel = e.entity.velocity;
        e.mesh.rotation.y = Math.atan2(vel.x, vel.z);
      }

      // Drive the animated rig: walk while moving, attack on each swing
      // tick, idle otherwise. Falls through silently for primitive enemies.
      if (e.animated) {
        const a = e.animated;
        if (e.state === 'attack' && e.attackTimer >= e.config.attackCooldown - 0.05) {
          // Just kicked off an attack this frame — punch a one-shot, then idle.
          a.playOnce(a.actions.attack ?? a.actions.idle, () => {
            if (e.alive) a.play(a.actions.idle);
          });
        } else if (e.state === 'attack') {
          // Mid-cooldown — hold idle so the rig doesn't slide.
          if (a.current !== a.actions.attack) a.play(a.actions.idle);
        } else if (speed2 > 0.05) {
          a.play(a.actions.walk ?? a.actions.idle);
        } else {
          a.play(a.actions.idle);
        }
        a.mixer.update(dt);
      }

      // Target ring pulse
      if (e.ring.visible) {
        e.ring.scale.setScalar(0.95 + Math.sin(Date.now() * 0.006) * 0.06);
      }
    });

    // Tick down corpse removal for animated enemies that just died.
    this.enemies.forEach(e => {
      if (e.alive || e.corpseTimer <= 0) return;
      e.corpseTimer -= dt;
      if (e.corpseTimer <= 0 && e.mesh.parent) {
        this.scene.remove(e.mesh);
        e.animated?.dispose();
      }
    });

    this.entityManager.update(dt);
    return { attackingEnemies };
  }

  damageEnemy(enemy: AIEnemy, dmg: number): boolean {
    if (!enemy.alive) return false;
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.memory.timesHit++;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.state = 'dead';
      enemy.ring.visible = false;
      this.entityManager.remove(enemy.entity);
      // Animated enemies play a death animation then fade out; primitive
      // enemies just hide immediately (no rig to clamp on the last frame).
      if (enemy.animated) {
        const a = enemy.animated;
        a.playOnce(a.actions.death ?? a.actions.idle);
        enemy.corpseTimer = 3.0;
      } else {
        enemy.mesh.visible = false;
      }
      return true;
    }
    return false;
  }

  setTarget(enemy: AIEnemy | null) {
    this.enemies.forEach(e => { e.ring.visible = false; });
    if (enemy?.alive) enemy.ring.visible = true;
  }

  cycleTarget(currentId: number): AIEnemy | null {
    const alive = this.aliveEnemies;
    if (alive.length === 0) return null;
    const idx = alive.findIndex(e => e.id === currentId);
    const next = alive[(idx + 1) % alive.length];
    this.setTarget(next);
    return next;
  }

  /** Pick the closest hostile target for an enemy: the player, or any alive
   *  ally that happens to be nearer. Returns the target world position, the
   *  ally instance when the target is an ally (so callers apply damage
   *  directly), and the distance from the enemy. */
  private _nearestHostileTarget(ePos: YUKA.Vector3): { pos: THREE.Vector3; ally: AIEnemy | null; dist: number } {
    const ex = ePos.x, ey = ePos.y, ez = ePos.z;
    let bestDist = Math.hypot(this.playerPos.x - ex, this.playerPos.y - ey, this.playerPos.z - ez);
    let bestPos = new THREE.Vector3(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    let bestAlly: AIEnemy | null = null;
    for (const ally of this.aliveAllies) {
      const ap = ally.mesh.position;
      const d = Math.hypot(ap.x - ex, ap.y - ey, ap.z - ez);
      if (d < bestDist) {
        bestDist = d;
        bestPos = new THREE.Vector3(ap.x, ap.y, ap.z);
        bestAlly = ally;
      }
    }
    return { pos: bestPos, ally: bestAlly, dist: bestDist };
  }

  findNearest(pos: THREE.Vector3): AIEnemy | null {
    let closest: AIEnemy | null = null, minDist = Infinity;
    this.aliveEnemies.forEach(e => {
      const d = e.mesh.position.distanceTo(pos);
      if (d < minDist) { minDist = d; closest = e; }
    });
    return closest;
  }

  dispose() {
    this.enemies.forEach(e => {
      this.scene.remove(e.mesh);
      e.animated?.dispose();
    });
    this.enemies = [];
  }

  private _buildEnemyMesh(config: AIEnemyConfig): THREE.Group {
    const g = new THREE.Group();
    const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7 });
    const fc = FACTION_COLORS[config.faction] ?? 0xAA4444;
    const skinColor = config.faction === 'legion' ? 0x6B8B5A : 0xC4956A;
    const skinMat = mat(skinColor);
    const armorMat = mat(fc);
    const darkMat = mat(new THREE.Color(fc).multiplyScalar(0.6).getHex());
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true, roughness: 0.3, metalness: 0.7 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 7), armorMat);
    torso.position.y = 1.05;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.22), armorMat);
    chest.position.y = 1.12;

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.15, 6), darkMat);
    waist.position.y = 0.78;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 6), skinMat);
    neck.position.y = 1.38;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), skinMat);
    head.position.y = 1.56;
    head.scale.set(1, 1.1, 0.95);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), armorMat);
    helmet.position.y = 1.63;

    const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), armorMat);
    lShoulder.position.set(-0.32, 1.22, 0);
    lShoulder.scale.set(1.1, 0.7, 0.9);
    const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), armorMat);
    rShoulder.position.set(0.32, 1.22, 0);
    rShoulder.scale.set(1.1, 0.7, 0.9);

    const armGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.35, 5);
    const lArm = new THREE.Mesh(armGeo, skinMat);
    lArm.position.set(-0.34, 1.0, 0); lArm.rotation.z = 0.25;
    const rArm = new THREE.Mesh(armGeo, skinMat);
    rArm.position.set(0.34, 1.0, 0); rArm.rotation.z = -0.25;

    const handGeo = new THREE.SphereGeometry(0.05, 4, 3);
    const lHand = new THREE.Mesh(handGeo, skinMat);
    lHand.position.set(-0.36, 0.78, 0.06);
    const rHand = new THREE.Mesh(handGeo, skinMat);
    rHand.position.set(0.36, 0.78, 0.06);

    const thighGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.35, 5);
    const lThigh = new THREE.Mesh(thighGeo, darkMat);
    lThigh.position.set(-0.11, 0.52, 0);
    const rThigh = new THREE.Mesh(thighGeo, darkMat);
    rThigh.position.set(0.11, 0.52, 0);

    const shinGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 5);
    const lShin = new THREE.Mesh(shinGeo, armorMat);
    lShin.position.set(-0.11, 0.2, 0);
    const rShin = new THREE.Mesh(shinGeo, armorMat);
    rShin.position.set(0.11, 0.2, 0);

    const bootGeo = new THREE.BoxGeometry(0.12, 0.06, 0.16);
    const lBoot = new THREE.Mesh(bootGeo, darkMat);
    lBoot.position.set(-0.11, 0.04, 0.02);
    const rBoot = new THREE.Mesh(bootGeo, darkMat);
    rBoot.position.set(0.11, 0.04, 0.02);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.03), metalMat);
    blade.position.set(0.38, 1.05, 0.1);
    blade.rotation.z = -0.2;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.06), mat(0xDAA520));
    guard.position.set(0.36, 0.78, 0.1);
    guard.rotation.z = -0.2;

    const parts = [
      torso, chest, waist, neck, head, helmet,
      lShoulder, rShoulder, lArm, rArm, lHand, rHand,
      lThigh, rThigh, lShin, rShin, lBoot, rBoot,
      blade, guard
    ];

    if (config.faction === 'legion') {
      const tusk1 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), mat(0xE8D8C0));
      tusk1.position.set(-0.08, 1.46, 0.14); tusk1.rotation.x = 0.3;
      const tusk2 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), mat(0xE8D8C0));
      tusk2.position.set(0.08, 1.46, 0.14); tusk2.rotation.x = 0.3;
      parts.push(tusk1, tusk2);
    }

    parts.forEach(m => { m.castShadow = true; g.add(m); });

    if (config.level >= 3) {
      const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), mat(0xFFD700));
      diamond.position.y = 2.0;
      g.add(diamond);
    }

    return g;
  }
}
