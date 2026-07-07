/**
 * Sea Creatures Scatter — places large solitary marine fauna (whales, tuna,
 * schools of fish) at random underwater positions across the open-water sailing
 * world. Each creature gently bobs and drifts in place, like a mining-node
 * landmark you can sail over.
 *
 * Loads three GLBs from /fish/:
 *   - Whale.glb         (3.6 MB)  — rare, deep, slow bob
 *   - TunaFish.glb      (25 MB)   — uncommon, mid-depth, brisk bob
 *   - SchoolOfFish.glb  (22 MB)   — common, shallow, lively bob
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface CreatureSpec {
  name: string;
  path: string;
  count: number;
  scale: number;
  depthRange: [number, number];   // [deepest, shallowest], both negative
  bobAmplitude: number;
  bobSpeed: number;
}

const CREATURE_SPECS: CreatureSpec[] = [
  { name: 'Whale',         path: '/fish/Whale.glb',         count: 6,  scale: 6.0, depthRange: [-26, -10], bobAmplitude: 1.2, bobSpeed: 0.30 },
  { name: 'TunaFish',      path: '/fish/TunaFish.glb',      count: 14, scale: 1.6, depthRange: [-20, -6],  bobAmplitude: 0.6, bobSpeed: 0.55 },
  { name: 'SchoolOfFish',  path: '/fish/SchoolOfFish.glb',  count: 12, scale: 2.4, depthRange: [-16, -4],  bobAmplitude: 0.4, bobSpeed: 0.70 },
];

export interface SeaCreaturesOptions {
  /** Square bounds in scene units. Creatures will be placed in this XZ region. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Optional XZ→Y function returning the sea-floor depth. Creatures stay above floor. */
  oceanFloorFn?: (x: number, z: number) => number;
  /** Islands or features to avoid. */
  exclusionPoints?: { x: number; z: number; r: number }[];
}

interface ScatteredCreature {
  mesh: THREE.Object3D;
  baseY: number;
  bobAmplitude: number;
  bobSpeed: number;
  bobPhase: number;
  driftAngle: number;
  driftSpeed: number;
  mixer: THREE.AnimationMixer | null;
}

export class SeaCreaturesScatter {
  private scene: THREE.Scene;
  private opts: SeaCreaturesOptions;
  private loader = new GLTFLoader();
  private creatures: ScatteredCreature[] = [];
  private isLoaded = false;

  constructor(scene: THREE.Scene, opts: SeaCreaturesOptions) {
    this.scene = scene;
    this.opts = opts;
  }

  async generate(): Promise<void> {
    const loaded = new Map<string, GLTF>();
    await Promise.allSettled(
      CREATURE_SPECS.map(async (s) => {
        try {
          const gltf = await this.loader.loadAsync(s.path);
          loaded.set(s.name, gltf);
        } catch (e) {
          console.warn(`[SeaCreaturesScatter] Failed to load ${s.name}:`, e);
        }
      }),
    );

    for (const spec of CREATURE_SPECS) {
      const gltf = loaded.get(spec.name);
      if (!gltf) continue;

      for (let i = 0; i < spec.count; i++) {
        const pos = this.randomUnderwaterPoint(spec.depthRange);
        if (!pos) continue;

        const clone = gltf.scene.clone(true);
        clone.scale.setScalar(spec.scale);
        clone.position.copy(pos);
        clone.rotation.y = Math.random() * Math.PI * 2;
        clone.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = false;
            mesh.receiveShadow = true;
          }
        });
        this.scene.add(clone);

        let mixer: THREE.AnimationMixer | null = null;
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(clone);
          const action = mixer.clipAction(gltf.animations[0]);
          action.timeScale = 0.6 + Math.random() * 0.4;
          action.play();
        }

        this.creatures.push({
          mesh: clone,
          baseY: pos.y,
          bobAmplitude: spec.bobAmplitude,
          bobSpeed: spec.bobSpeed,
          bobPhase: Math.random() * Math.PI * 2,
          driftAngle: Math.random() * Math.PI * 2,
          driftSpeed: 0.04 + Math.random() * 0.10,
          mixer,
        });
      }
    }

    this.isLoaded = true;
    console.log(`[SeaCreaturesScatter] Placed ${this.creatures.length} creatures across the ocean`);
  }

  private randomUnderwaterPoint(depthRange: [number, number]): THREE.Vector3 | null {
    const { minX, maxX, minZ, maxZ } = this.opts.bounds;
    const exclusions = this.opts.exclusionPoints ?? [];
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);

      let blocked = false;
      for (const ex of exclusions) {
        if (Math.hypot(x - ex.x, z - ex.z) < ex.r) { blocked = true; break; }
      }
      if (blocked) continue;

      let y = depthRange[0] + Math.random() * (depthRange[1] - depthRange[0]);
      if (this.opts.oceanFloorFn) {
        const floorY = this.opts.oceanFloorFn(x, z);
        if (y < floorY + 1.0) y = floorY + 1.0;
      }
      return new THREE.Vector3(x, y, z);
    }
    return null;
  }

  update(dt: number, time: number): void {
    if (!this.isLoaded) return;
    const { minX, maxX, minZ, maxZ } = this.opts.bounds;
    for (const c of this.creatures) {
      c.mesh.position.y = c.baseY + Math.sin(time * c.bobSpeed + c.bobPhase) * c.bobAmplitude;
      c.mesh.position.x += Math.cos(c.driftAngle) * c.driftSpeed * dt;
      c.mesh.position.z += Math.sin(c.driftAngle) * c.driftSpeed * dt;
      // Slow yaw + bound clamping (creatures wrap if they drift past edge)
      c.mesh.rotation.y += dt * 0.06;
      if (c.mesh.position.x < minX) c.mesh.position.x = maxX;
      if (c.mesh.position.x > maxX) c.mesh.position.x = minX;
      if (c.mesh.position.z < minZ) c.mesh.position.z = maxZ;
      if (c.mesh.position.z > maxZ) c.mesh.position.z = minZ;
      c.mixer?.update(dt);
    }
  }

  dispose(): void {
    for (const c of this.creatures) {
      this.scene.remove(c.mesh);
      c.mesh.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    }
    this.creatures = [];
    this.isLoaded = false;
  }
}
