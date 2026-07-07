import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type CreatureType =
  | 'shark' | 'whale' | 'manta' | 'dolphin'
  | 'fish1' | 'fish2' | 'fish3'
  | 'kraken' | 'tentacle'
  // Underwater menagerie — added Apr 2026
  | 'seaTurtle' | 'squid' | 'tropicalFish' | 'schoolOfFish';

export interface CreatureBehavior {
  aggressive: boolean;
  aggressionRadius: number;
  fleeRadius: number;
  speed: number;
  turnSpeed: number;
  attackDamage: number;
  health: number;
  rarity: number; // 0-1, lower = more rare
  isBoss?: boolean;
  damagesHull?: boolean;
  bounceOnCollision?: boolean;
  lootDrop?: string;
  /** Hunts other creatures (not just the player). Sharks only. */
  predator?: boolean;
  /** Cannot leave the water — y must always stay below this value. */
  staysSubmerged?: boolean;
  /** Considered "fish" for prey/biome rules (cannot beach, cannot sub-seabed). */
  isFish?: boolean;
}

export const CREATURE_DEFINITIONS: Record<CreatureType, {
  path: string;
  scale: number;
  behavior: CreatureBehavior;
  depthRange: [number, number];
}> = {
  shark: {
    path: '/models/creatures/stylized_shark_1777027209918.glb',
    scale: 1.4,
    behavior: {
      aggressive: true,
      aggressionRadius: 60,
      fleeRadius: 0,
      speed: 10,
      turnSpeed: 2.0,
      attackDamage: 35,
      health: 120,
      rarity: 0.08,
      damagesHull: true,
      bounceOnCollision: true,
      predator: true,
      staysSubmerged: true,
      isFish: true,
    },
    depthRange: [-3, -16],
  },
  whale: {
    path: '/models/sea_creatures/Whale.fbx',
    scale: 0.04,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 30,
      speed: 4,
      turnSpeed: 0.5,
      attackDamage: 50, // Collision damage if provoked
      health: 500,
      rarity: 0.02,
    },
    depthRange: [-10, -40],
  },
  manta: {
    path: '/models/sea_creatures/Manta ray.fbx',
    scale: 0.025,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 20,
      speed: 5,
      turnSpeed: 1.0,
      attackDamage: 0,
      health: 80,
      rarity: 0.08,
    },
    depthRange: [-5, -25],
  },
  dolphin: {
    path: '/models/sea_creatures/Dolphin.fbx',
    scale: 0.015,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 15,
      speed: 10,
      turnSpeed: 2.0,
      attackDamage: 5,
      health: 60,
      rarity: 0.15,
    },
    depthRange: [-2, -10],
  },
  fish1: {
    path: '/models/sea_creatures/Fish1.fbx',
    scale: 0.008,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 8,
      speed: 3,
      turnSpeed: 3.0,
      attackDamage: 0,
      health: 10,
      rarity: 0.6,
    },
    depthRange: [-1, -8],
  },
  fish2: {
    path: '/models/sea_creatures/Fish2.fbx',
    scale: 0.008,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 8,
      speed: 3.5,
      turnSpeed: 3.0,
      attackDamage: 0,
      health: 10,
      rarity: 0.6,
    },
    depthRange: [-1, -8],
  },
  fish3: {
    path: '/models/sea_creatures/Fish3.fbx',
    scale: 0.008,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 8,
      speed: 2.5,
      turnSpeed: 3.0,
      attackDamage: 0,
      health: 10,
      rarity: 0.6,
    },
    depthRange: [-1, -8],
  },
  kraken: {
    path: '/models/sea_creatures/octopus.glb',
    scale: 2.5,
    behavior: {
      aggressive: true,
      aggressionRadius: 100,
      fleeRadius: 0,
      speed: 6,
      turnSpeed: 0.8,
      attackDamage: 75,
      health: 1500,
      rarity: 0.005,
      isBoss: true,
      damagesHull: true,
      lootDrop: '/models/sea_creatures/tentacle_drop.glb',
    },
    depthRange: [-8, -30],
  },
  tentacle: {
    path: '/models/sea_creatures/tentacle.glb',
    scale: 1.5,
    behavior: {
      aggressive: true,
      aggressionRadius: 40,
      fleeRadius: 0,
      speed: 0,
      turnSpeed: 2.0,
      attackDamage: 40,
      health: 200,
      rarity: 0,
      damagesHull: true,
    },
    depthRange: [-2, -5],
  },

  // ─── Underwater menagerie (Apr 2026) ───────────────────────────────
  seaTurtle: {
    path: '/models/creatures/model_46a_-_subadult_green_sea_turtle_1777027213351.glb',
    scale: 1.0,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 12,
      speed: 3,
      turnSpeed: 1.0,
      attackDamage: 0,
      health: 80,
      rarity: 0.18,
      staysSubmerged: true,
    },
    depthRange: [-2, -10],
  },
  squid: {
    path: '/models/creatures/squidunderwater-_eindopdracht3dvisualisatiejaar2_1777027226276.glb',
    scale: 0.8,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 14,
      speed: 4.5,
      turnSpeed: 2.5,
      attackDamage: 0,
      health: 30,
      rarity: 0.15,
      staysSubmerged: true,
    },
    depthRange: [-6, -22],
  },
  tropicalFish: {
    path: '/models/creatures/fish_1777027257512.glb',
    scale: 0.6,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 6,
      speed: 3.5,
      turnSpeed: 3.5,
      attackDamage: 0,
      health: 8,
      rarity: 0.45,
      staysSubmerged: true,
      isFish: true,
    },
    depthRange: [-1.5, -10],
  },
  schoolOfFish: {
    path: '/models/creatures/school_of_fish_1777027260934.glb',
    scale: 1.0,
    behavior: {
      aggressive: false,
      aggressionRadius: 0,
      fleeRadius: 18,
      speed: 4.0,
      turnSpeed: 3.0,
      attackDamage: 0,
      health: 20,
      rarity: 0.22,
      staysSubmerged: true,
      isFish: true,
    },
    depthRange: [-2, -14],
  },
};

export interface SeaCreature {
  id: string;
  type: CreatureType;
  mesh: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'huntCreature';
  health: number;
  lastAttackTime: number;
  wanderAngle: number;
  homePosition: THREE.Vector3;
  /** Sharks only: who they're currently hunting (other creature). */
  predatorTarget: SeaCreature | null;
  /** Sharks only: when (perf.now ms) the next 5%-roll happens. */
  nextHuntRollAt: number;
  /** Sharks only: when this hunt times out if no kill yet. */
  huntEndsAt: number;
}

export interface ShipCollider {
  position: THREE.Vector3;
  radius: number;
  onHullDamage?: (damage: number, creatureType: CreatureType) => void;
}

export interface LootDrop {
  type: CreatureType;
  position: THREE.Vector3;
  modelPath: string;
}

export class SeaCreatureSystem {
  private creatures: SeaCreature[] = [];
  private scene: THREE.Scene;
  private fbxLoader: FBXLoader;
  private gltfLoader: GLTFLoader;
  private modelCache: Map<CreatureType, THREE.Group> = new Map();
  private spawnRadius: number = 150;
  private maxCreatures: number = 30;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  private playerVelocity: THREE.Vector3 = new THREE.Vector3();
  private shipCollider: ShipCollider | null = null;
  private lootDrops: LootDrop[] = [];
  private onKrakenDefeated?: (lootDrop: LootDrop) => void;
  private getOceanFloorDepth: ((x: number, z: number) => number) | null = null;
  private isPointOnLand: ((x: number, z: number) => boolean) | null = null;

  /**
   * Predator-vs-creature cycle:
   *   every 5 minutes a shark rolls a 5% chance to start hunting another creature.
   *   On success it pursues the nearest non-shark prey for up to 60s using
   *   Yuka-style velocity-prediction pursuit (see threejs-games /pursue/ ref).
   *   On failure it waits another 5 minutes and rolls again.
   */
  static readonly HUNT_ROLL_INTERVAL_MS = 5 * 60 * 1000;
  static readonly HUNT_ROLL_CHANCE      = 0.05;
  static readonly HUNT_TIMEOUT_MS       = 60 * 1000;
  static readonly HUNT_RANGE            = 80;
  static readonly HUNT_KILL_RANGE       = 3;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.fbxLoader = new FBXLoader();
    this.gltfLoader = new GLTFLoader();
  }

  setShipCollider(collider: ShipCollider): void {
    this.shipCollider = collider;
  }

  /**
   * Provide a getter for the seabed height at any (x,z). When set, every
   * creature is clamped to never sink below it — and, over islands where the
   * getter returns terrain height, never lifted above the waterline either.
   */
  setOceanFloorDepth(getter: (x: number, z: number) => number): void {
    this.getOceanFloorDepth = getter;
  }

  /**
   * Provide a "is this point on land / above water" check. Every sea creature
   * (fish and non-fish alike) is bounced back into water when it would step
   * onto a land cell, and spawns are rejected on land.
   */
  setIsPointOnLand(check: (x: number, z: number) => boolean): void {
    this.isPointOnLand = check;
  }

  /**
   * Pick a spawn point on open water around `center` at the given depth (Y).
   * Rejects points that fall on an island (when a land check is wired) so a
   * creature never spawns inside terrain where it would bounce-lock. Returns
   * null if no open-water point was found after a few tries.
   */
  private findWaterSpawnXZ(center: THREE.Vector3, depth: number): THREE.Vector3 | null {
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * this.spawnRadius;
      const x = center.x + Math.cos(angle) * distance;
      const z = center.z + Math.sin(angle) * distance;
      if (!this.isPointOnLand || !this.isPointOnLand(x, z)) {
        return new THREE.Vector3(x, depth, z);
      }
    }
    return null;
  }

  setOnKrakenDefeated(callback: (lootDrop: LootDrop) => void): void {
    this.onKrakenDefeated = callback;
  }

  async preloadModels(): Promise<void> {
    const types: CreatureType[] = [
      'shark', 'whale', 'manta', 'dolphin',
      'fish1', 'fish2', 'fish3',
      'kraken', 'tentacle',
      'seaTurtle', 'squid', 'tropicalFish', 'schoolOfFish',
    ];
    
    for (const type of types) {
      try {
        const def = CREATURE_DEFINITIONS[type];
        let model: THREE.Group;
        
        if (def.path.endsWith('.glb') || def.path.endsWith('.gltf')) {
          const gltf = await this.gltfLoader.loadAsync(def.path);
          model = gltf.scene as THREE.Group;
          if (gltf.animations.length > 0) {
            (model as any).animations = gltf.animations;
          }
        } else {
          model = await this.fbxLoader.loadAsync(def.path);
        }
        
        model.scale.setScalar(def.scale);
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.modelCache.set(type, model);
      } catch (e) {
        console.warn(`Failed to load sea creature: ${type}`, e);
      }
    }
  }

  private cloneModel(type: CreatureType): THREE.Group | null {
    const cached = this.modelCache.get(type);
    if (!cached) return null;
    return cached.clone();
  }

  spawnCreature(type: CreatureType, position: THREE.Vector3): SeaCreature | null {
    const model = this.cloneModel(type);
    if (!model) return null;

    const def = CREATURE_DEFINITIONS[type];
    model.position.copy(position);

    // Setup animation mixer
    let mixer: THREE.AnimationMixer | null = null;
    const cached = this.modelCache.get(type);
    if (cached && cached.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      const clip = cached.animations[0];
      const action = mixer.clipAction(clip);
      action.play();
    }

    const creature: SeaCreature = {
      id: `creature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      mesh: model,
      mixer,
      velocity: new THREE.Vector3(),
      targetPosition: position.clone(),
      state: 'patrol',
      health: def.behavior.health,
      lastAttackTime: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      homePosition: position.clone(),
      predatorTarget: null,
      // Stagger initial roll so a fresh school of sharks doesn't all roll at once.
      nextHuntRollAt: performance.now() + (def.behavior.predator
        ? Math.random() * SeaCreatureSystem.HUNT_ROLL_INTERVAL_MS
        : 0),
      huntEndsAt: 0,
    };

    this.scene.add(model);
    this.creatures.push(creature);
    return creature;
  }

  spawnRandomCreatures(count: number, centerPosition: THREE.Vector3): void {
    const types: CreatureType[] = [
      'shark', 'whale', 'manta', 'dolphin',
      'seaTurtle', 'squid', 'tropicalFish', 'schoolOfFish',
      'fish1', 'fish2', 'fish3',
    ];
    
    for (let i = 0; i < count && this.creatures.length < this.maxCreatures; i++) {
      // Weight selection by rarity
      const roll = Math.random();
      let cumulative = 0;
      let selectedType: CreatureType = 'fish1';
      
      for (const type of types) {
        cumulative += CREATURE_DEFINITIONS[type].behavior.rarity;
        if (roll < cumulative) {
          selectedType = type;
          break;
        }
      }

      const def = CREATURE_DEFINITIONS[selectedType];
      const depth = def.depthRange[0] + Math.random() * (def.depthRange[1] - def.depthRange[0]);

      const position = this.findWaterSpawnXZ(centerPosition, depth);
      if (!position) continue; // no open water found — skip this creature

      this.spawnCreature(selectedType, position);
    }
  }

  setPlayerPosition(position: THREE.Vector3, velocity?: THREE.Vector3): void {
    this.playerPosition.copy(position);
    if (velocity) {
      this.playerVelocity.copy(velocity);
    }
  }

  update(deltaTime: number): void {
    const now = performance.now();

    for (const creature of this.creatures) {
      // Update animation
      if (creature.mixer) {
        creature.mixer.update(deltaTime);
      }

      // Update AI behavior
      this.updateCreatureBehavior(creature, deltaTime, now);
      
      // Apply physics
      this.applyPhysics(creature, deltaTime);
    }
  }

  private updateCreatureBehavior(creature: SeaCreature, dt: number, now: number): void {
    const def = CREATURE_DEFINITIONS[creature.type];
    const behavior = def.behavior;
    const creaturePos = creature.mesh.position;
    const distanceToPlayer = creaturePos.distanceTo(this.playerPosition);

    // ─── Predator hunt cycle (sharks vs other creatures) ───────────────
    // Player aggression always wins — we only roll for creature-hunt when
    // the player isn't nearby.
    if (behavior.predator && distanceToPlayer >= behavior.aggressionRadius) {
      // Validate any existing hunt — if prey was removed, was killed,
      // or hunt has timed out, abandon it.
      if (creature.predatorTarget) {
        const prey = creature.predatorTarget;
        const preyAlive = this.creatures.includes(prey) && prey.health > 0;
        if (!preyAlive || now > creature.huntEndsAt) {
          creature.predatorTarget = null;
          creature.state = 'patrol';
        }
      }

      // Time to roll? Only when not already hunting.
      if (!creature.predatorTarget && now >= creature.nextHuntRollAt) {
        creature.nextHuntRollAt = now + SeaCreatureSystem.HUNT_ROLL_INTERVAL_MS;
        if (Math.random() < SeaCreatureSystem.HUNT_ROLL_CHANCE) {
          // Pick the nearest non-shark, non-boss creature within range.
          let best: SeaCreature | null = null;
          let bestDistSq = SeaCreatureSystem.HUNT_RANGE * SeaCreatureSystem.HUNT_RANGE;
          for (const other of this.creatures) {
            if (other === creature) continue;
            const otherDef = CREATURE_DEFINITIONS[other.type];
            if (otherDef.behavior.predator) continue;     // sharks don't eat each other
            if (otherDef.behavior.isBoss)   continue;     // sharks don't eat the kraken
            const dSq = creaturePos.distanceToSquared(other.mesh.position);
            if (dSq < bestDistSq) { bestDistSq = dSq; best = other; }
          }
          if (best) {
            creature.predatorTarget = best;
            creature.huntEndsAt = now + SeaCreatureSystem.HUNT_TIMEOUT_MS;
            creature.state = 'huntCreature';
          }
        }
      }
    }

    // ─── Standard state machine ────────────────────────────────────────
    if (creature.state === 'huntCreature' && creature.predatorTarget) {
      // stay in this state — handled below
    } else if (behavior.aggressive) {
      // Aggressive creature (shark) toward player
      if (distanceToPlayer < behavior.aggressionRadius) {
        creature.state = 'chase';
      } else if (creature.state !== 'huntCreature') {
        creature.state = 'patrol';
      }

      if (distanceToPlayer < 5 && creature.state === 'chase') {
        creature.state = 'attack';
      }
    } else {
      // Passive creature flees player when close.
      if (distanceToPlayer < behavior.fleeRadius) {
        creature.state = 'flee';
      } else {
        creature.state = 'patrol';
      }
    }

    // Calculate desired velocity based on state
    const desired = new THREE.Vector3();

    switch (creature.state) {
      case 'chase':
        // Pursuit behavior - predict where player will be
        const predictTime = distanceToPlayer / behavior.speed;
        const predictedPos = this.playerPosition.clone().add(
          this.playerVelocity.clone().multiplyScalar(Math.min(predictTime, 2))
        );
        desired.subVectors(predictedPos, creaturePos).normalize().multiplyScalar(behavior.speed);
        break;

      case 'attack':
        // Ram toward player
        desired.subVectors(this.playerPosition, creaturePos).normalize().multiplyScalar(behavior.speed * 1.5);
        
        // Deal damage periodically
        if (now - creature.lastAttackTime > 2000) {
          creature.lastAttackTime = now;
          // Emit attack event (could be handled by game system)
          console.log(`${creature.type} attacks for ${behavior.attackDamage} damage!`);
        }
        break;

      case 'huntCreature': {
        // Yuka-style Pursue: aim at where the prey will be after `t` seconds,
        // where t scales with distance / pursuer speed.  Same shape as the
        // threejs-games /pursue/ example.
        const prey = creature.predatorTarget;
        if (!prey) { creature.state = 'patrol'; break; }
        const preyPos = prey.mesh.position;
        const distToPrey = creaturePos.distanceTo(preyPos);
        const preyPredictT = Math.min(distToPrey / behavior.speed, 1.5);
        const preyPredicted = preyPos.clone().add(
          prey.velocity.clone().multiplyScalar(preyPredictT)
        );
        desired.subVectors(preyPredicted, creaturePos).normalize().multiplyScalar(behavior.speed * 1.2);

        // Close-range bite: kill prey, drop hunt.
        if (distToPrey < SeaCreatureSystem.HUNT_KILL_RANGE) {
          if (now - creature.lastAttackTime > 600) {
            creature.lastAttackTime = now;
            const lethal = this.damageCreature(prey, behavior.attackDamage * 1.5);
            if (lethal) {
              creature.predatorTarget = null;
              creature.state = 'patrol';
            }
          }
        }
        break;
      }

      case 'flee':
        // Flee behavior - run away from player
        desired.subVectors(creaturePos, this.playerPosition).normalize().multiplyScalar(behavior.speed * 1.2);
        break;

      case 'patrol':
      default:
        // Wander behavior with perlin-like smooth motion
        creature.wanderAngle += (Math.random() - 0.5) * 0.5 * dt;
        
        const wanderRadius = 20;
        const wanderDistance = 30;
        
        // Calculate wander target
        const circleCenter = creaturePos.clone().add(
          creature.velocity.clone().normalize().multiplyScalar(wanderDistance)
        );
        
        if (circleCenter.length() === 0) {
          circleCenter.set(
            creaturePos.x + Math.cos(creature.wanderAngle) * wanderDistance,
            creaturePos.y,
            creaturePos.z + Math.sin(creature.wanderAngle) * wanderDistance
          );
        }
        
        const wanderTarget = new THREE.Vector3(
          circleCenter.x + Math.cos(creature.wanderAngle) * wanderRadius,
          creaturePos.y + Math.sin(creature.wanderAngle * 0.5) * 2, // Subtle vertical bobbing
          circleCenter.z + Math.sin(creature.wanderAngle) * wanderRadius
        );
        
        desired.subVectors(wanderTarget, creaturePos).normalize().multiplyScalar(behavior.speed * 0.5);
        
        // Add homing tendency to stay near spawn area
        const homeDistance = creaturePos.distanceTo(creature.homePosition);
        if (homeDistance > 80) {
          const homeForce = new THREE.Vector3()
            .subVectors(creature.homePosition, creaturePos)
            .normalize()
            .multiplyScalar(behavior.speed * 0.3);
          desired.add(homeForce);
        }
        break;
    }

    // Keep creature within depth bounds
    const [minDepth, maxDepth] = def.depthRange;
    if (creaturePos.y > minDepth) {
      desired.y = -Math.abs(desired.y) - 1;
    } else if (creaturePos.y < maxDepth) {
      desired.y = Math.abs(desired.y) + 1;
    }

    // Steering = desired - current velocity
    const steering = desired.clone().sub(creature.velocity);
    
    // Limit steering force
    const maxForce = behavior.turnSpeed * 5;
    if (steering.length() > maxForce) {
      steering.normalize().multiplyScalar(maxForce);
    }

    // Apply steering to velocity
    creature.velocity.add(steering.multiplyScalar(dt));
    
    // Limit speed
    if (creature.velocity.length() > behavior.speed) {
      creature.velocity.normalize().multiplyScalar(behavior.speed);
    }
  }

  private applyPhysics(creature: SeaCreature, dt: number): void {
    const mesh = creature.mesh;
    const def = CREATURE_DEFINITIONS[creature.type];
    const behavior = def.behavior;

    // Capture pre-step position so we can revert if the step would push
    // the creature onto land.
    const prevX = mesh.position.x;
    const prevZ = mesh.position.z;

    // Update position
    mesh.position.add(creature.velocity.clone().multiplyScalar(dt));

    // ─── Land constraint: no sea creature can beach itself ───────────
    // If ANY creature (incl. non-fish whale / manta / dolphin / kraken)
    // would step into a "land" cell, undo the horizontal step and bounce
    // velocity away from land. This was previously gated to `isFish`,
    // which let the big non-fish creatures drift over islands — where the
    // seabed clamp below then lifted them on top of the terrain, giving
    // the "huge fish sitting on the island" bug.
    if (this.isPointOnLand) {
      if (this.isPointOnLand(mesh.position.x, mesh.position.z)) {
        const awayX = prevX - mesh.position.x;
        const awayZ = prevZ - mesh.position.z;
        mesh.position.x = prevX;
        mesh.position.z = prevZ;
        const len = Math.hypot(awayX, awayZ);
        if (len > 1e-4) {
          creature.velocity.x = (awayX / len) * Math.abs(creature.velocity.x) * 0.7;
          creature.velocity.z = (awayZ / len) * Math.abs(creature.velocity.z) * 0.7;
        } else {
          creature.velocity.x *= -0.7;
          creature.velocity.z *= -0.7;
        }
      }
    }

    // ─── Vertical constraints ────────────────────────────────────────
    // Surface ceiling — applied to EVERY sea creature, not just those
    // flagged `staysSubmerged`. Prior to this, large creatures without
    // the flag (whale / manta / dolphin / kraken) could drift above the
    // waterline via the wander code's vertical bob and end up rendering
    // as "huge fish flying in the sky" on the world map. Sea creatures
    // are sea creatures — none of them should breach. (Dolphins still
    // get a higher surfaceCap so they sit closer to the surface.)
    const surfaceCap = creature.type === 'dolphin' ? -0.3 : -0.5;
    if (mesh.position.y > surfaceCap) {
      mesh.position.y = surfaceCap;
      if (creature.velocity.y > 0) creature.velocity.y *= -0.4;
    }

    // Seabed clamp: when a host has provided a floor-height getter, no
    // creature can sink below floor + 1.5 (a comfortable swim clearance).
    if (this.getOceanFloorDepth) {
      // Never let the seabed clamp push a creature above the waterline. Over
      // an island the floor getter returns the island's *terrain* height
      // (positive, above water); without this cap it would lift whales /
      // krakens up to sit on top of the island. Cap the effective floor at
      // the surface ceiling so creatures stay submerged even at island edges.
      const floor = Math.min(
        this.getOceanFloorDepth(mesh.position.x, mesh.position.z) + 1.5,
        surfaceCap,
      );
      if (mesh.position.y < floor) {
        mesh.position.y = floor;
        if (creature.velocity.y < 0) creature.velocity.y *= -0.4;
      }
    }

    // Ship collision detection for creatures that can damage hull
    if (this.shipCollider && (behavior.damagesHull || behavior.bounceOnCollision)) {
      const distToShip = mesh.position.distanceTo(this.shipCollider.position);
      const collisionRadius = this.shipCollider.radius + 3;
      
      if (distToShip < collisionRadius) {
        if (behavior.bounceOnCollision) {
          const bounceDir = new THREE.Vector3()
            .subVectors(mesh.position, this.shipCollider.position)
            .normalize();
          
          mesh.position.add(bounceDir.clone().multiplyScalar(collisionRadius - distToShip + 1));
          
          const dot = creature.velocity.dot(bounceDir);
          if (dot < 0) {
            creature.velocity.reflect(bounceDir).multiplyScalar(0.7);
          }
        }
        
        if (behavior.damagesHull && this.shipCollider.onHullDamage) {
          const now = performance.now();
          if (now - creature.lastAttackTime > 2000) {
            creature.lastAttackTime = now;
            this.shipCollider.onHullDamage(behavior.attackDamage, creature.type);
          }
        }
      }
    }

    // Rotate to face velocity direction (smooth banking turn)
    if (creature.velocity.length() > 0.1) {
      const targetQuat = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const forward = creature.velocity.clone().normalize();
      
      // Create rotation matrix looking at velocity direction
      const rotMatrix = new THREE.Matrix4();
      rotMatrix.lookAt(new THREE.Vector3(), forward, up);
      targetQuat.setFromRotationMatrix(rotMatrix);
      
      // Add banking effect for turns
      const turnRate = creature.velocity.clone().cross(up).length();
      const bankAngle = Math.min(turnRate * 0.1, 0.3);
      const bankQuat = new THREE.Quaternion().setFromAxisAngle(forward, bankAngle);
      targetQuat.multiply(bankQuat);
      
      // Smooth interpolation
      mesh.quaternion.slerp(targetQuat, 0.05);
    }

    // Water resistance (drag)
    creature.velocity.multiplyScalar(0.99);
  }

  removeCreature(creature: SeaCreature): void {
    const idx = this.creatures.indexOf(creature);
    if (idx !== -1) {
      this.scene.remove(creature.mesh);
      this.creatures.splice(idx, 1);
    }
  }

  getCreatures(): SeaCreature[] {
    return this.creatures;
  }

  getAggressiveCreaturesNearPlayer(radius: number): SeaCreature[] {
    return this.creatures.filter(c => {
      const def = CREATURE_DEFINITIONS[c.type];
      return def.behavior.aggressive && 
             c.mesh.position.distanceTo(this.playerPosition) < radius;
    });
  }

  spawnKrakenEncounter(centerPosition: THREE.Vector3): SeaCreature | null {
    const krakenDef = CREATURE_DEFINITIONS.kraken;
    const krakenDepth =
      krakenDef.depthRange[0] + Math.random() * (krakenDef.depthRange[1] - krakenDef.depthRange[0]);

    // Keep the kraken (and its ring of tentacles) off island terrain.
    let krakenPos: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = centerPosition.x + (Math.random() - 0.5) * 40;
      const z = centerPosition.z + (Math.random() - 0.5) * 40;
      if (!this.isPointOnLand || !this.isPointOnLand(x, z)) {
        krakenPos = new THREE.Vector3(x, krakenDepth, z);
        break;
      }
    }
    if (!krakenPos) return null;

    const kraken = this.spawnCreature('kraken', krakenPos);
    
    if (kraken) {
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const tentaclePos = new THREE.Vector3(
          krakenPos.x + Math.cos(angle) * 15,
          -3,
          krakenPos.z + Math.sin(angle) * 15
        );
        this.spawnCreature('tentacle', tentaclePos);
      }
    }
    
    return kraken;
  }

  damageCreature(creature: SeaCreature, damage: number): boolean {
    creature.health -= damage;
    
    if (creature.health <= 0) {
      const def = CREATURE_DEFINITIONS[creature.type];
      
      if (def.behavior.isBoss && def.behavior.lootDrop && this.onKrakenDefeated) {
        const lootDrop: LootDrop = {
          type: creature.type,
          position: creature.mesh.position.clone(),
          modelPath: def.behavior.lootDrop
        };
        this.lootDrops.push(lootDrop);
        this.onKrakenDefeated(lootDrop);
      }
      
      this.removeCreature(creature);
      return true;
    }
    
    return false;
  }

  getLootDrops(): LootDrop[] {
    return this.lootDrops;
  }

  collectLootDrop(lootDrop: LootDrop): boolean {
    const idx = this.lootDrops.indexOf(lootDrop);
    if (idx !== -1) {
      this.lootDrops.splice(idx, 1);
      return true;
    }
    return false;
  }

  dispose(): void {
    for (const creature of this.creatures) {
      this.scene.remove(creature.mesh);
    }
    this.creatures = [];
    this.lootDrops = [];
    this.modelCache.clear();
  }
}
