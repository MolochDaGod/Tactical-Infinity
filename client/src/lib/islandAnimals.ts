import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { resourceNodeTemplates, ResourceNodeManager } from './resourceNodes';

export type AnimalType =
  | 'lamb' | 'fox' | 'boar' | 'rabbit' | 'deer' | 'goat'
  | 'stag' | 'wolf' | 'bull';

/**
 * Spawn weights for biome-agnostic land fauna. Higher = more common.
 * Per the design spec, the player should mainly see rabbits, deer and
 * boars; the larger/rarer predators (wolf/bull) and stags appear less often.
 *
 * Pass to `IslandAnimalManager.spawnRandomAnimalsOnIsland(...)` via
 * `weights` to bias the random pick.
 */
export const ANIMAL_SPAWN_WEIGHTS: Record<AnimalType, number> = {
  rabbit: 5,
  deer:   4,
  boar:   3,
  goat:   3,
  fox:    2,
  stag:   2,
  wolf:   2,
  bull:   1,
  lamb:   1,
};

/**
 * Real animated glTF models (Quaternius "Ultimate Animated Animals", CC0) for
 * the wild huntable species. Each is self-contained (embedded buffers + baked
 * clips like Idle/Walk/Death). Models are auto-fit to `targetHeight` (world
 * units) and seated so their feet rest at the group origin. Species without an
 * entry fall back to the procedural placeholder mesh.
 */
export interface AnimalModelConfig {
  url: string;
  targetHeight: number;
  idleClips: string[];
}

export const ANIMAL_MODELS: Partial<Record<AnimalType, AnimalModelConfig>> = {
  deer: { url: '/models/animals/deer.gltf', targetHeight: 1.8, idleClips: ['Idle', 'Idle_2'] },
  stag: { url: '/models/animals/stag.gltf', targetHeight: 2.1, idleClips: ['Idle', 'Idle_2'] },
  wolf: { url: '/models/animals/wolf.gltf', targetHeight: 1.1, idleClips: ['Idle', 'Idle_2'] },
  fox:  { url: '/models/animals/fox.gltf',  targetHeight: 0.7, idleClips: ['Idle', 'Idle_2'] },
  bull: { url: '/models/animals/bull.gltf', targetHeight: 1.7, idleClips: ['Idle', 'Idle_2'] },
};

const _animalGLTFLoader = new GLTFLoader();
const _animalModelCache = new Map<string, Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>>();

function loadAnimalGLTF(url: string): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
  let cached = _animalModelCache.get(url);
  if (!cached) {
    cached = _animalGLTFLoader
      .loadAsync(url)
      .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }));
    _animalModelCache.set(url, cached);
  }
  return cached;
}

export interface AnimalTemplate {
  type: AnimalType;
  name: string;
  health: number;
  speed: number;
  fleeSpeed: number;
  fleeDistance: number;
  aggroDistance: number;
  isAggressive: boolean;
  damage: number;
  attackCooldown: number;
  carcassTemplate: string;
  fallbackColor: number;
  scale: number;
}

export const animalTemplates: Record<AnimalType, AnimalTemplate> = {
  lamb: {
    type: 'lamb',
    name: 'Lamb',
    health: 20,
    speed: 3,
    fleeSpeed: 6,
    fleeDistance: 15,
    aggroDistance: 0,
    isAggressive: false,
    damage: 0,
    attackCooldown: 0,
    carcassTemplate: 'lamb_carcass',
    fallbackColor: 0xFFFFE0,
    scale: 0.5
  },
  fox: {
    type: 'fox',
    name: 'Fox',
    health: 35,
    speed: 5,
    fleeSpeed: 10,
    fleeDistance: 20,
    aggroDistance: 0,
    isAggressive: false,
    damage: 5,
    attackCooldown: 2,
    carcassTemplate: 'fox_carcass',
    fallbackColor: 0xD2691E,
    scale: 0.6
  },
  boar: {
    type: 'boar',
    name: 'Wild Boar',
    health: 60,
    speed: 4,
    fleeSpeed: 8,
    fleeDistance: 0,
    aggroDistance: 10,
    isAggressive: true,
    damage: 12,
    attackCooldown: 1.5,
    carcassTemplate: 'wild_boar',
    fallbackColor: 0x8B4513,
    scale: 0.8
  },
  rabbit: {
    type: 'rabbit',
    name: 'Rabbit',
    health: 10,
    speed: 6,
    fleeSpeed: 12,
    fleeDistance: 25,
    aggroDistance: 0,
    isAggressive: false,
    damage: 0,
    attackCooldown: 0,
    carcassTemplate: 'rabbit_carcass',
    fallbackColor: 0xD2B48C,
    scale: 0.4
  },
  deer: {
    type: 'deer',
    name: 'Deer',
    health: 50,
    speed: 6,
    fleeSpeed: 14,
    fleeDistance: 30,
    aggroDistance: 0,
    isAggressive: false,
    damage: 0,
    attackCooldown: 0,
    carcassTemplate: 'deer_carcass',
    fallbackColor: 0xA0522D,
    scale: 0.9
  },
  goat: {
    type: 'goat',
    name: 'Mountain Goat',
    health: 35,
    speed: 5,
    fleeSpeed: 9,
    fleeDistance: 18,
    aggroDistance: 0,
    isAggressive: false,
    damage: 0,
    attackCooldown: 0,
    carcassTemplate: 'goat_carcass',
    fallbackColor: 0xC8B79E,
    scale: 0.7
  },
  stag: {
    type: 'stag',
    name: 'Stag',
    health: 90,
    speed: 6,
    fleeSpeed: 13,
    fleeDistance: 26,
    aggroDistance: 0,
    isAggressive: false,
    damage: 0,
    attackCooldown: 0,
    carcassTemplate: 'stag_carcass',
    fallbackColor: 0x8B5A2B,
    scale: 1.0
  },
  wolf: {
    type: 'wolf',
    name: 'Wolf',
    health: 55,
    speed: 6,
    fleeSpeed: 10,
    fleeDistance: 0,
    aggroDistance: 14,
    isAggressive: true,
    damage: 14,
    attackCooldown: 1.2,
    carcassTemplate: 'wolf_carcass',
    fallbackColor: 0x6B7280,
    scale: 0.7
  },
  bull: {
    type: 'bull',
    name: 'Wild Bull',
    health: 120,
    speed: 4,
    fleeSpeed: 7,
    fleeDistance: 0,
    aggroDistance: 12,
    isAggressive: true,
    damage: 20,
    attackCooldown: 1.8,
    carcassTemplate: 'bull_carcass',
    fallbackColor: 0x4B3621,
    scale: 1.1
  }
};

export type AnimalState = 'idle' | 'wandering' | 'fleeing' | 'attacking' | 'dead';

export interface LiveAnimal {
  id: string;
  type: AnimalType;
  template: AnimalTemplate;
  position: THREE.Vector3;
  rotation: number;
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  state: AnimalState;
  targetPosition: THREE.Vector3 | null;
  lastStateChange: number;
  lastAttack: number;
  velocity: THREE.Vector3;
  spawnPosition: THREE.Vector3;
  wanderRadius: number;
  mixer?: THREE.AnimationMixer | null;
  modelRoot?: THREE.Object3D | null;
}

export class IslandAnimalManager {
  private scene: THREE.Scene;
  private animals: Map<string, LiveAnimal> = new Map();
  private animalIdCounter: number = 0;
  private resourceNodeManager: ResourceNodeManager | null = null;
  private groundSampler: ((x: number, z: number) => number) | null = null;
  private pendingCarcassTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(scene: THREE.Scene, resourceNodeManager?: ResourceNodeManager) {
    this.scene = scene;
    this.resourceNodeManager = resourceNodeManager || null;
  }

  setResourceNodeManager(manager: ResourceNodeManager): void {
    this.resourceNodeManager = manager;
  }

  /**
   * Provide a terrain-height sampler so animals are seated on the ground both
   * at spawn time and every frame (heightmap-following). Without it animals
   * keep the flat y they were spawned at.
   */
  setGroundSampler(fn: ((x: number, z: number) => number) | null): void {
    this.groundSampler = fn;
  }

  private sampleGround(x: number, z: number, fallbackY: number): number {
    if (!this.groundSampler) return fallbackY;
    const y = this.groundSampler(x, z);
    return Number.isFinite(y) ? y : fallbackY;
  }

  /**
   * Load the real animated glTF for a species (if configured), fit it to the
   * template's target height, seat its feet at the group origin, and swap it in
   * for the procedural placeholder. Starts an idle clip on a per-animal mixer.
   * No-op (keeps placeholder) for species without a model or on load failure.
   */
  private async attachAnimalModel(animal: LiveAnimal, type: AnimalType): Promise<void> {
    const config = ANIMAL_MODELS[type];
    if (!config) return;
    try {
      const { scene: template, animations } = await loadAnimalGLTF(config.url);
      if (animal.state === 'dead' || !this.animals.has(animal.id)) return;

      const model = cloneSkinned(template) as THREE.Object3D;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const height = size.y || 1;
      const scale = config.targetHeight / height;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.y -= scaledBox.min.y;

      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      for (let i = animal.mesh.children.length - 1; i >= 0; i--) {
        animal.mesh.remove(animal.mesh.children[i]);
      }
      animal.mesh.add(model);
      animal.modelRoot = model;

      if (animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const clip =
          config.idleClips.map((n) => THREE.AnimationClip.findByName(animations, n)).find(Boolean) ||
          animations[0];
        if (clip) mixer.clipAction(clip).play();
        animal.mixer = mixer;
      }
    } catch (e) {
      console.warn(`[IslandAnimals] Failed to load model for ${type}`, e);
    }
  }

  private generateAnimalId(): string {
    return `animal_${++this.animalIdCounter}_${Date.now()}`;
  }

  private createAnimalMesh(template: AnimalTemplate): THREE.Group {
    const group = new THREE.Group();
    
    const bodyGeometry = new THREE.SphereGeometry(0.5 * template.scale, 16, 12);
    bodyGeometry.scale(1.5, 1, 1);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: template.fallbackColor,
      roughness: 0.8,
      metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5 * template.scale;
    body.castShadow = true;
    group.add(body);

    const headGeometry = new THREE.SphereGeometry(0.3 * template.scale, 12, 8);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: template.fallbackColor,
      roughness: 0.8,
      metalness: 0.1
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0.6 * template.scale, 0.7 * template.scale, 0);
    head.castShadow = true;
    group.add(head);

    const legGeometry = new THREE.CylinderGeometry(
      0.05 * template.scale,
      0.05 * template.scale,
      0.4 * template.scale
    );
    const legMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(template.fallbackColor).multiplyScalar(0.7),
      roughness: 0.8
    });

    const legPositions = [
      [-0.3, 0, 0.2],
      [-0.3, 0, -0.2],
      [0.3, 0, 0.2],
      [0.3, 0, -0.2]
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(x * template.scale, 0.2 * template.scale, z * template.scale);
      leg.castShadow = true;
      group.add(leg);
    });

    group.userData.isAnimal = true;
    group.userData.animalType = template.type;

    return group;
  }

  spawnAnimal(
    type: AnimalType,
    position: THREE.Vector3,
    wanderRadius: number = 10
  ): LiveAnimal | null {
    const template = animalTemplates[type];
    if (!template) {
      console.warn(`Animal template not found: ${type}`);
      return null;
    }

    const id = this.generateAnimalId();
    const mesh = this.createAnimalMesh(template);

    const seatedY = this.sampleGround(position.x, position.z, position.y);
    const seated = new THREE.Vector3(position.x, seatedY, position.z);
    mesh.position.copy(seated);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);

    const animal: LiveAnimal = {
      id,
      type,
      template,
      position: seated.clone(),
      rotation: mesh.rotation.y,
      mesh,
      health: template.health,
      maxHealth: template.health,
      state: 'idle',
      targetPosition: null,
      lastStateChange: Date.now(),
      lastAttack: 0,
      velocity: new THREE.Vector3(),
      spawnPosition: seated.clone(),
      wanderRadius,
      mixer: null,
      modelRoot: null
    };

    this.animals.set(id, animal);

    // Swap in the real animated glTF asynchronously (placeholder shows until then).
    void this.attachAnimalModel(animal, type);

    return animal;
  }

  /**
   * Build a weighted pick list. When `weights` is provided, each type is
   * repeated proportional to its weight so common species dominate the roll.
   */
  private buildWeightedPool(
    animalTypes: AnimalType[],
    weights?: Partial<Record<AnimalType, number>>
  ): AnimalType[] {
    if (!weights) return animalTypes;
    const pool: AnimalType[] = [];
    for (const t of animalTypes) {
      const w = Math.max(1, Math.round(weights[t] ?? 1));
      for (let i = 0; i < w; i++) pool.push(t);
    }
    return pool.length > 0 ? pool : animalTypes;
  }

  spawnRandomAnimalsOnIsland(
    center: THREE.Vector3,
    radius: number,
    animalTypes: AnimalType[],
    count: number,
    weights?: Partial<Record<AnimalType, number>>
  ): void {
    const spawnedPositions: THREE.Vector3[] = [];
    const minDistance = 8;
    const pool = this.buildWeightedPool(animalTypes, weights);

    for (let i = 0; i < count; i++) {
      const animalType = pool[Math.floor(Math.random() * pool.length)];
      
      let position: THREE.Vector3;
      let attempts = 0;
      const maxAttempts = 20;

      do {
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * Math.max(5, radius - 20);
        position = new THREE.Vector3(
          center.x + Math.cos(angle) * distance,
          center.y,
          center.z + Math.sin(angle) * distance
        );
        attempts++;
      } while (
        attempts < maxAttempts &&
        spawnedPositions.some(p => p.distanceTo(position) < minDistance)
      );

      if (attempts < maxAttempts) {
        spawnedPositions.push(position);
        this.spawnAnimal(animalType, position, 15);
      }
    }
  }

  damageAnimal(id: string, damage: number, attackerPosition?: THREE.Vector3): boolean {
    const animal = this.animals.get(id);
    if (!animal || animal.state === 'dead') return false;

    animal.health = Math.max(0, animal.health - damage);

    if (animal.health <= 0) {
      this.killAnimal(id);
      return true;
    }

    if (!animal.template.isAggressive && attackerPosition) {
      animal.state = 'fleeing';
      animal.lastStateChange = Date.now();
      const fleeDirection = new THREE.Vector3()
        .subVectors(animal.position, attackerPosition)
        .normalize();
      animal.targetPosition = animal.position.clone().add(
        fleeDirection.multiplyScalar(animal.template.fleeDistance)
      );
    } else if (animal.template.isAggressive && attackerPosition) {
      animal.state = 'attacking';
      animal.lastStateChange = Date.now();
      animal.targetPosition = attackerPosition.clone();
    }

    return false;
  }

  private killAnimal(id: string): void {
    const animal = this.animals.get(id);
    if (!animal) return;

    animal.state = 'dead';
    animal.lastStateChange = Date.now();

    if (animal.mixer) {
      animal.mixer.stopAllAction();
      animal.mixer = null;
    }

    animal.mesh.rotation.z = Math.PI / 2;
    animal.mesh.position.y -= 0.3;

    if (this.resourceNodeManager && animal.template.carcassTemplate) {
      const timer = setTimeout(() => {
        this.pendingCarcassTimers.delete(timer);
        this.resourceNodeManager?.spawnNode(
          animal.template.carcassTemplate,
          animal.position,
          animal.rotation
        );
        this.removeAnimal(id);
      }, 500);
      this.pendingCarcassTimers.add(timer);
    }
  }

  removeAnimal(id: string): void {
    const animal = this.animals.get(id);
    if (animal) {
      this.scene.remove(animal.mesh);
      this.animals.delete(id);
    }
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    this.animals.forEach((animal) => {
      if (animal.mixer) animal.mixer.update(delta);

      if (animal.state === 'dead') return;

      const distanceToPlayer = animal.position.distanceTo(playerPosition);

      if (animal.template.isAggressive && 
          distanceToPlayer < animal.template.aggroDistance &&
          animal.state !== 'attacking') {
        animal.state = 'attacking';
        animal.targetPosition = playerPosition.clone();
        animal.lastStateChange = Date.now();
      }

      if (!animal.template.isAggressive && 
          distanceToPlayer < animal.template.fleeDistance &&
          animal.state !== 'fleeing') {
        animal.state = 'fleeing';
        const fleeDirection = new THREE.Vector3()
          .subVectors(animal.position, playerPosition)
          .normalize();
        animal.targetPosition = animal.position.clone().add(
          fleeDirection.multiplyScalar(animal.template.fleeDistance * 2)
        );
        animal.lastStateChange = Date.now();
      }

      switch (animal.state) {
        case 'idle':
          this.updateIdle(animal, delta);
          break;
        case 'wandering':
          this.updateWandering(animal, delta);
          break;
        case 'fleeing':
          this.updateFleeing(animal, delta, playerPosition);
          break;
        case 'attacking':
          this.updateAttacking(animal, delta, playerPosition);
          break;
      }

      animal.position.y = this.sampleGround(animal.position.x, animal.position.z, animal.position.y);
      animal.mesh.position.copy(animal.position);
      animal.mesh.rotation.y = animal.rotation;
    });
  }

  private updateIdle(animal: LiveAnimal, delta: number): void {
    const idleTime = Date.now() - animal.lastStateChange;
    
    if (idleTime > 2000 + Math.random() * 3000) {
      animal.state = 'wandering';
      animal.lastStateChange = Date.now();
      
      const wanderAngle = Math.random() * Math.PI * 2;
      const wanderDistance = 3 + Math.random() * 5;
      animal.targetPosition = animal.spawnPosition.clone().add(
        new THREE.Vector3(
          Math.cos(wanderAngle) * wanderDistance,
          0,
          Math.sin(wanderAngle) * wanderDistance
        )
      );
    }
  }

  private updateWandering(animal: LiveAnimal, delta: number): void {
    if (!animal.targetPosition) {
      animal.state = 'idle';
      animal.lastStateChange = Date.now();
      return;
    }

    const direction = new THREE.Vector3()
      .subVectors(animal.targetPosition, animal.position)
      .setY(0);
    
    const distance = direction.length();
    
    if (distance < 0.5) {
      animal.state = 'idle';
      animal.lastStateChange = Date.now();
      animal.targetPosition = null;
      return;
    }

    direction.normalize();
    animal.rotation = Math.atan2(direction.x, direction.z);
    
    const moveSpeed = animal.template.speed * delta;
    animal.position.add(direction.multiplyScalar(moveSpeed));
  }

  private updateFleeing(animal: LiveAnimal, delta: number, playerPosition: THREE.Vector3): void {
    const distanceToPlayer = animal.position.distanceTo(playerPosition);
    
    if (distanceToPlayer > animal.template.fleeDistance * 2) {
      animal.state = 'idle';
      animal.lastStateChange = Date.now();
      animal.targetPosition = null;
      return;
    }

    const fleeDirection = new THREE.Vector3()
      .subVectors(animal.position, playerPosition)
      .setY(0)
      .normalize();

    animal.rotation = Math.atan2(fleeDirection.x, fleeDirection.z);
    
    const moveSpeed = animal.template.fleeSpeed * delta;
    animal.position.add(fleeDirection.multiplyScalar(moveSpeed));

    const distanceFromSpawn = animal.position.distanceTo(animal.spawnPosition);
    if (distanceFromSpawn > animal.wanderRadius * 3) {
      const toSpawn = new THREE.Vector3()
        .subVectors(animal.spawnPosition, animal.position)
        .normalize()
        .multiplyScalar(0.3);
      animal.position.add(toSpawn);
    }
  }

  private updateAttacking(animal: LiveAnimal, delta: number, playerPosition: THREE.Vector3): void {
    const distanceToPlayer = animal.position.distanceTo(playerPosition);
    
    if (distanceToPlayer > animal.template.aggroDistance * 2) {
      animal.state = 'idle';
      animal.lastStateChange = Date.now();
      animal.targetPosition = null;
      return;
    }

    const direction = new THREE.Vector3()
      .subVectors(playerPosition, animal.position)
      .setY(0);
    
    if (direction.length() > 1.5) {
      direction.normalize();
      animal.rotation = Math.atan2(direction.x, direction.z);
      const moveSpeed = animal.template.speed * 1.5 * delta;
      animal.position.add(direction.multiplyScalar(moveSpeed));
    }
  }

  getAnimalAtPosition(position: THREE.Vector3, radius: number = 2): LiveAnimal | null {
    let foundAnimal: LiveAnimal | null = null;
    this.animals.forEach((animal) => {
      if (!foundAnimal && animal.state !== 'dead' && animal.position.distanceTo(position) < radius) {
        foundAnimal = animal;
      }
    });
    return foundAnimal;
  }

  getAnimalById(id: string): LiveAnimal | undefined {
    return this.animals.get(id);
  }

  getAllAnimals(): LiveAnimal[] {
    return Array.from(this.animals.values());
  }

  clearAllAnimals(): void {
    this.pendingCarcassTimers.forEach((t) => clearTimeout(t));
    this.pendingCarcassTimers.clear();
    this.animals.forEach((animal) => {
      if (animal.mixer) {
        animal.mixer.stopAllAction();
        animal.mixer = null;
      }
      this.scene.remove(animal.mesh);
    });
    this.animals.clear();
  }

  getAnimalsArray(): LiveAnimal[] {
    const result: LiveAnimal[] = [];
    this.animals.forEach((animal) => {
      result.push(animal);
    });
    return result;
  }
}
