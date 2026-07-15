/**
 * Open-world ocean fish under boats.
 * Quaternius Fish Pack (CDN FBX) — depth -2…-15 m by size; metre-normalized scale.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  FISH_BEHAVIORS,
  SKITTISHNESS_CONFIG,
  type Skittishness,
  getFleeParameters,
} from '@shared/gameDefinitions/fishing';
import { getFishWeightOverrides } from './adminOverrides';
import {
  QUATERNIUS_FISH,
  type QuaterniusFishDef,
} from './quaterniusFish';
import {
  normalizeToMetres,
  resolveOceanDepthBand,
  clampOceanDepth,
  OCEAN_SURFACE_Y,
  OCEAN_MAX_DEPTH_Y,
} from './modelNormalize';

interface Fish {
  id: string;
  mesh: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  swimSpeed: number;
  turnSpeed: number;
  /** lo = deeper (more negative), hi = shallower */
  depthRange: { lo: number; hi: number };
  schoolId: number;
  speciesName: string;
  skittishness: Skittishness;
  fleeDistance: number;
  fleeSpeed: number;
  animationSpeedMultiplier: number;
  schoolingTightness: number;
  isFleeing: boolean;
  fleeTarget: THREE.Vector3 | null;
  catchable: boolean;
  harpoonable: boolean;
  catchXp: number;
  rarity: string;
  bodyLengthM: number;
}

interface LoadedFishModel {
  /** Already metre-normalized template (do not re-scale clones) */
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
  bodyLengthM: number;
}

export class FishManager {
  private scene: THREE.Scene;
  private fbxLoader: FBXLoader;
  private loadedModels: Map<string, LoadedFishModel> = new Map();
  private fish: Fish[] = [];
  private maxFish: number = 140;
  private worldSize: number;
  private islandPositions: THREE.Vector3[] = [];
  private getOceanFloorDepth: (x: number, z: number) => number;
  private isInitialized: boolean = false;

  constructor(
    scene: THREE.Scene,
    worldSize: number,
    getOceanFloorDepth: (x: number, z: number) => number,
  ) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.getOceanFloorDepth = getOceanFloorDepth;
    this.fbxLoader = new FBXLoader();
  }

  async initialize(): Promise<void> {
    await Promise.allSettled(QUATERNIUS_FISH.map((s) => this.loadFishModel(s)));
    this.spawnInitialFish();
    this.isInitialized = true;
    console.log(
      `[FishManager] ${this.fish.length} fish | depth ${OCEAN_MAX_DEPTH_Y}…${OCEAN_SURFACE_Y} m | metre-normalized`,
    );
  }

  private async loadFbx(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(url, (o) => resolve(o as THREE.Group), undefined, reject);
    });
  }

  private async loadFishModel(species: QuaterniusFishDef): Promise<void> {
    const urls = [species.modelUrl, species.modelUrlAlt].filter(Boolean) as string[];
    let lastErr: unknown;
    for (const url of urls) {
      try {
        const obj = await this.loadFbx(url);
        const animations =
          (obj as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations ?? [];

        // Wrap so normalize does not fight FBX internal transforms
        const wrap = new THREE.Group();
        wrap.name = `fish_tpl_${species.name}`;
        wrap.add(obj);

        normalizeToMetres(wrap, {
          targetSizeM: species.bodyLengthM,
          axis: 'max',
          center: true,
        });

        wrap.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            child.frustumCulled = true;
          }
        });

        this.loadedModels.set(species.name, {
          root: wrap,
          animations,
          bodyLengthM: species.bodyLengthM,
        });
        console.log(`[FishManager] loaded ${species.name} → ${species.bodyLengthM}m @ ${url}`);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    console.warn(`[FishManager] failed ${species.name}`, lastErr);
  }

  setIslandPositions(positions: THREE.Vector3[]): void {
    this.islandPositions = positions;
  }

  private spawnInitialFish(): void {
    const speciesWithModels = QUATERNIUS_FISH.filter((s) => this.loadedModels.has(s.name));
    if (speciesWithModels.length === 0) {
      console.warn('[FishManager] no models — procedural fallback');
      this.createProceduralFish();
      return;
    }

    const schoolCount = 28;
    const fishPerSchool = Math.floor(this.maxFish / schoolCount);
    const gridSize = Math.ceil(Math.sqrt(schoolCount));
    const cellSize = (this.worldSize * 0.32) / gridSize;

    const weightOverrides = getFishWeightOverrides();
    const hasWeights = Object.keys(weightOverrides).length > 0;

    const pickSpecies = (schoolId: number): QuaterniusFishDef => {
      if (hasWeights) {
        const total = speciesWithModels.reduce(
          (sum, sp) => sum + Math.max(0, weightOverrides[sp.name] ?? 1),
          0,
        );
        if (total <= 0) return speciesWithModels[schoolId % speciesWithModels.length]!;
        let r = Math.random() * total;
        for (const sp of speciesWithModels) {
          r -= Math.max(0, weightOverrides[sp.name] ?? 1);
          if (r <= 0) return sp;
        }
        return speciesWithModels[speciesWithModels.length - 1]!;
      }
      const catchable = speciesWithModels.filter((s) => s.catchable);
      const large = speciesWithModels.filter((s) => !s.catchable);
      if (schoolId % 10 < 7 && catchable.length) {
        return catchable[schoolId % catchable.length]!;
      }
      if (large.length) return large[schoolId % large.length]!;
      return speciesWithModels[schoolId % speciesWithModels.length]!;
    };

    for (let schoolId = 0; schoolId < schoolCount; schoolId++) {
      const species = pickSpecies(schoolId);
      const gridX = schoolId % gridSize;
      const gridZ = Math.floor(schoolId / gridSize);
      const baseX = (gridX - gridSize / 2 + 0.5) * cellSize;
      const baseZ = (gridZ - gridSize / 2 + 0.5) * cellSize;
      const schoolCenter = new THREE.Vector3(
        baseX + (Math.random() - 0.5) * cellSize * 0.6,
        0,
        baseZ + (Math.random() - 0.5) * cellSize * 0.6,
      );

      const count = species.catchable
        ? fishPerSchool
        : Math.max(1, Math.floor(fishPerSchool * 0.25));

      for (let i = 0; i < count; i++) {
        this.spawnFish(species, schoolCenter, schoolId);
      }
    }

    console.log(`[FishManager] spawned ${this.fish.length} in ${schoolCount} schools`);
  }

  private cloneTemplate(loaded: LoadedFishModel): THREE.Object3D {
    // Skinned FBX needs SkeletonUtils; plain meshes can deep-clone
    let hasSkinned = false;
    loaded.root.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkinned = true;
    });
    const mesh = hasSkinned
      ? (cloneSkinned(loaded.root) as THREE.Object3D)
      : loaded.root.clone(true);
    // Template is already metre-normalized — do not apply another scale
    return mesh;
  }

  private spawnFish(
    species: QuaterniusFishDef,
    schoolCenter: THREE.Vector3,
    schoolId: number,
  ): void {
    const loaded = this.loadedModels.get(species.name);
    if (!loaded) return;

    const mesh = this.cloneTemplate(loaded);

    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 50,
      0,
      (Math.random() - 0.5) * 50,
    );
    const position = schoolCenter.clone().add(offset);
    const floorDepth = this.getOceanFloorDepth(position.x, position.z);

    const band = resolveOceanDepthBand(
      species.bodyLengthM,
      floorDepth,
      species.depthLo,
      species.depthHi,
    );
    if (!band) return; // water too shallow

    const depth = THREE.MathUtils.lerp(band.lo, band.hi, Math.random());
    mesh.position.set(position.x, depth, position.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;

    const mixer = new THREE.AnimationMixer(mesh);
    if (loaded.animations.length > 0) {
      const action = mixer.clipAction(loaded.animations[0]!);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = 0.8 + Math.random() * 0.4;
      action.play();
    }

    const behavior = FISH_BEHAVIORS[species.name];
    const fleeParams = getFleeParameters(species.name);

    this.fish.push({
      id: `fish_${this.fish.length}`,
      mesh,
      mixer,
      velocity: new THREE.Vector3(
        Math.sin(mesh.rotation.y) * species.swimSpeed,
        0,
        Math.cos(mesh.rotation.y) * species.swimSpeed,
      ),
      targetPosition: this.getRandomTarget(position, schoolCenter),
      swimSpeed: species.swimSpeed * (0.8 + Math.random() * 0.4),
      turnSpeed: 1.5 + Math.random(),
      depthRange: { lo: band.lo, hi: band.hi },
      schoolId,
      speciesName: species.name,
      skittishness: behavior?.skittishness ?? (species.catchable ? 'curious' : 'cautious'),
      fleeDistance: fleeParams.distance,
      fleeSpeed: fleeParams.speed,
      animationSpeedMultiplier: behavior?.animationSpeedMultiplier ?? 1.0,
      schoolingTightness: behavior?.schoolingTightness ?? (species.catchable ? 0.9 : 0.4),
      isFleeing: false,
      fleeTarget: null,
      catchable: species.catchable,
      harpoonable: species.harpoonable,
      catchXp: species.catchXp,
      rarity: species.rarity,
      bodyLengthM: species.bodyLengthM,
    });
    this.scene.add(mesh);
  }

  private createProceduralFish(): void {
    const colors = [0xff6600, 0x00ff66, 0x6600ff, 0xffff00, 0x00ffff, 0xff00ff];
    for (let i = 0; i < this.maxFish; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        metalness: 0.3,
        roughness: 0.5,
      });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 8), mat);
      body.rotation.z = Math.PI / 2;
      g.add(body);
      const x = (Math.random() - 0.5) * this.worldSize * 0.7;
      const z = (Math.random() - 0.5) * this.worldSize * 0.7;
      const floorDepth = this.getOceanFloorDepth(x, z);
      const band = resolveOceanDepthBand(0.55, floorDepth);
      if (!band) continue;
      const depth = THREE.MathUtils.lerp(band.lo, band.hi, Math.random());
      g.position.set(x, depth, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      const swimSpeed = 4 + Math.random() * 6;
      this.fish.push({
        id: `fish_${i}`,
        mesh: g,
        mixer: new THREE.AnimationMixer(g),
        velocity: new THREE.Vector3(
          Math.sin(g.rotation.y) * swimSpeed,
          0,
          Math.cos(g.rotation.y) * swimSpeed,
        ),
        targetPosition: new THREE.Vector3(),
        swimSpeed,
        turnSpeed: 1.5 + Math.random(),
        depthRange: band,
        schoolId: Math.floor(i / 8),
        speciesName: 'Procedural',
        skittishness: 'cautious',
        fleeDistance: 15,
        fleeSpeed: 8,
        animationSpeedMultiplier: 1,
        schoolingTightness: 0.8,
        isFleeing: false,
        fleeTarget: null,
        catchable: true,
        harpoonable: true,
        catchXp: 5,
        rarity: 'common',
        bodyLengthM: 0.55,
      });
      this.scene.add(g);
    }
  }

  private getRandomTarget(current: THREE.Vector3, schoolCenter: THREE.Vector3): THREE.Vector3 {
    if (current.distanceTo(schoolCenter) > 100) {
      return schoolCenter
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40));
    }
    return current
      .clone()
      .add(new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60));
  }

  getCatchableNear(pos: THREE.Vector3, radius = 12): Fish[] {
    const r2 = radius * radius;
    return this.fish.filter(
      (f) => f.catchable && f.mesh.visible && f.mesh.position.distanceToSquared(pos) < r2,
    );
  }

  getHarpoonableNear(pos: THREE.Vector3, radius = 40): Fish[] {
    const r2 = radius * radius;
    return this.fish.filter(
      (f) => f.harpoonable && f.mesh.visible && f.mesh.position.distanceToSquared(pos) < r2,
    );
  }

  harvestFish(fishId: string): { speciesName: string; catchXp: number; catchable: boolean } | null {
    const idx = this.fish.findIndex((f) => f.id === fishId);
    if (idx < 0) return null;
    const f = this.fish[idx]!;
    const result = {
      speciesName: f.speciesName,
      catchXp: f.catchXp,
      catchable: f.catchable,
    };
    f.mixer.stopAllAction();
    this.scene.remove(f.mesh);
    this.fish.splice(idx, 1);
    return result;
  }

  update(delta: number, playerPosition?: THREE.Vector3): void {
    if (!this.isInitialized || this.fish.length === 0) return;

    const worldBound = this.worldSize * 0.4;
    const renderDistanceSq = 280 * 280;

    for (const fish of this.fish) {
      if (!playerPosition) {
        fish.mesh.visible = false;
        continue;
      }

      const distSq = fish.mesh.position.distanceToSquared(playerPosition);
      const isVisible = distSq < renderDistanceSq;
      fish.mesh.visible = isVisible;
      if (!isVisible) continue;

      fish.mixer.update(delta * fish.animationSpeedMultiplier);

      const floorDepth = this.getOceanFloorDepth(fish.mesh.position.x, fish.mesh.position.z);
      // Re-intersect spawn band with current floor only (no double species clamp)
      const deepest = Math.max(OCEAN_MAX_DEPTH_Y, floorDepth + 1.5);
      let lo = Math.max(fish.depthRange.lo, deepest);
      let hi = Math.min(fish.depthRange.hi, OCEAN_SURFACE_Y);
      if (lo > hi) {
        lo = deepest;
        hi = OCEAN_SURFACE_Y;
        if (lo > hi) {
          lo = hi - 0.25;
        }
      }

      if (playerPosition) {
        const distToPlayer = fish.mesh.position.distanceTo(playerPosition);
        if (distToPlayer < fish.fleeDistance) {
          fish.isFleeing = true;
          const fleeDir = fish.mesh.position.clone().sub(playerPosition).normalize();
          const fleeForce = fleeDir.multiplyScalar(
            fish.fleeSpeed * (1 - distToPlayer / fish.fleeDistance) * delta * 10,
          );
          fish.velocity.add(fleeForce);
          const config = SKITTISHNESS_CONFIG[fish.skittishness];
          fish.velocity.multiplyScalar(1 + config.fleeMultiplier * 0.3);
        } else if (fish.isFleeing && distToPlayer > fish.fleeDistance * 1.5) {
          fish.isFleeing = false;
          fish.fleeTarget = null;
        }
      }

      const schoolmates = this.fish.filter(
        (f) => f.schoolId === fish.schoolId && f.id !== fish.id && f.mesh.visible,
      );
      const separation = new THREE.Vector3();
      const alignment = new THREE.Vector3();
      const cohesion = new THREE.Vector3();
      let neighborCount = 0;
      const schoolRadius = 15 * fish.schoolingTightness;

      for (const mate of schoolmates) {
        const distance = fish.mesh.position.distanceTo(mate.mesh.position);
        if (distance >= schoolRadius) continue;
        neighborCount++;
        if (distance < 3 * fish.schoolingTightness) {
          const diff = fish.mesh.position.clone().sub(mate.mesh.position);
          diff.divideScalar(Math.max(distance, 0.5));
          separation.add(diff);
        }
        alignment.add(mate.velocity);
        cohesion.add(mate.mesh.position);
        if (mate.isFleeing && !fish.isFleeing) {
          fish.isFleeing = true;
          fish.velocity.add(
            mate.velocity.clone().normalize().multiplyScalar(fish.fleeSpeed * 0.5),
          );
        }
      }

      if (neighborCount > 0 && !fish.isFleeing) {
        alignment.divideScalar(neighborCount);
        cohesion.divideScalar(neighborCount).sub(fish.mesh.position);
        const steer = new THREE.Vector3()
          .add(separation.multiplyScalar(2))
          .add(alignment.normalize().multiplyScalar(1))
          .add(cohesion.normalize().multiplyScalar(0.8 * fish.schoolingTightness));
        fish.velocity.add(steer.multiplyScalar(delta * fish.turnSpeed));
      }

      if (Math.abs(fish.mesh.position.x) > worldBound) {
        fish.velocity.x -= Math.sign(fish.mesh.position.x) * delta * 10;
      }
      if (Math.abs(fish.mesh.position.z) > worldBound) {
        fish.velocity.z -= Math.sign(fish.mesh.position.z) * delta * 10;
      }

      for (const island of this.islandPositions) {
        const dist = fish.mesh.position.distanceTo(island);
        if (dist < 80) {
          const away = fish.mesh.position.clone().sub(island).normalize();
          fish.velocity.add(away.multiplyScalar((delta * 15 * (80 - dist)) / 80));
        }
      }

      const maxSpeed = fish.isFleeing ? fish.fleeSpeed : fish.swimSpeed * 1.5;
      const minSpeed = fish.isFleeing ? fish.fleeSpeed * 0.7 : fish.swimSpeed * 0.5;
      const speed = fish.velocity.length();
      if (speed > maxSpeed) fish.velocity.multiplyScalar(maxSpeed / speed);
      else if (speed < minSpeed && speed > 0.001) fish.velocity.normalize().multiplyScalar(minSpeed);

      fish.mesh.position.add(fish.velocity.clone().multiplyScalar(delta));

      // Mild vertical bob — amplitude only, re-clamp so no depth drift
      const bob = Math.sin(performance.now() * 0.001 + fish.mesh.position.x) * (fish.isFleeing ? 0.05 : 0.12);
      fish.mesh.position.y = clampOceanDepth(fish.mesh.position.y + bob * delta * 2, lo, hi);

      if (fish.velocity.lengthSq() > 0.01) {
        const targetRotation = Math.atan2(fish.velocity.x, fish.velocity.z);
        const lerpSpeed = fish.isFleeing ? delta * fish.turnSpeed * 2 : delta * fish.turnSpeed;
        fish.mesh.rotation.y = THREE.MathUtils.lerp(fish.mesh.rotation.y, targetRotation, lerpSpeed);
      }
    }
  }

  dispose(): void {
    for (const fish of this.fish) {
      fish.mixer.stopAllAction();
      this.scene.remove(fish.mesh);
      fish.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m?.dispose?.());
        }
      });
    }
    this.fish = [];
    this.loadedModels.clear();
  }
}
