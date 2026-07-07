/**
 * LandScatter — places trees, rocks, plants, flowers, and land animals on
 * the canonical island terrain. Samples the heightmap for slope + altitude,
 * excludes water and a configurable spawn-pad clearance, and reuses the
 * existing `islandAssetLoader.ts` catalog. Trees/rocks/plants are placed via
 * cloned GLTF Groups (the loader internally caches GLTF roots, so cloning is
 * cheap). Animals spawn as simple wandering FBX models.
 */
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { IslandHeightmap } from './IslandHeightmap';
import type { IslandConfig, AnimalSpecies, TreeSpecies, HarvestSpecies } from './IslandConfig';
import { categoryCount } from './IslandConfig';
import {
  NATURE_TREES, NATURE_ROCKS, NATURE_PLANTS, NATURE_FLOWERS, ANIMALS,
  loadAsset,
} from '@/lib/islandAssetLoader';
import { getPbrTextureSet, type PbrSetName } from './polyHavenLoader';
import { mulberry32, type SceneLayerSet } from './SceneLayers';
import {
  METRIC_TARGETS, ANIMAL_SIZE_M, metricRangeToScaleJitter, normalizeToMetricSize,
} from './metricSizing';
import { HarvestNodeSystem, type HarvestPlacement, type MineResult } from './HarvestNodeSystem';

/**
 * Map each tree species to the most appropriate PolyHaven bark set so
 * conifers don't end up wearing oak bark and dead/twisted trees read as
 * grey/dry instead of fresh brown.
 */
function barkSetForTree(species: TreeSpecies): PbrSetName {
  if (species.startsWith('pine'))    return 'pine_bark';
  if (species.startsWith('dead') ||
      species.startsWith('twisted')) return 'dead_bark';
  return 'tree_bark';
}

/**
 * Replace each mesh material on a prototype with a PBR-textured version
 * sourced from Poly Haven's CDN (with cache + bundled fallback). Runs once
 * per prototype before instancing — the resulting material is shared across
 * all instances/clones, so the cost is paid exactly once per species.
 *
 * If the Poly Haven set fails to load (offline), the prototype keeps its
 * original GLTF material untouched. We tint the new material to whatever
 * color the original material had so painted leaves don't suddenly look
 * like generic grass.
 */
async function applyPolyHavenMaterial(
  proto: THREE.Group | null,
  set: PbrSetName,
  repeat: number,
): Promise<void> {
  if (!proto) return;
  try {
    const pbr = await getPbrTextureSet(set, '2k');
    proto.traverse((c) => {
      if (!(c as THREE.Mesh).isMesh) return;
      const mesh = c as THREE.Mesh;
      const original = mesh.material as THREE.Material | THREE.Material[];
      const tint = !Array.isArray(original) && (original as THREE.MeshStandardMaterial).color
        ? (original as THREE.MeshStandardMaterial).color.clone()
        : new THREE.Color(0xffffff);
      // Clone the textures so per-mesh `repeat` doesn't fight other species
      // sharing the same Poly Haven set at a different tiling.
      const albedo = pbr.albedo.clone();
      albedo.colorSpace = THREE.SRGBColorSpace;
      albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
      albedo.repeat.set(repeat, repeat);
      albedo.needsUpdate = true;
      const normal = pbr.normal?.clone();
      if (normal) { normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(repeat, repeat); normal.needsUpdate = true; }
      const rough = pbr.roughness?.clone();
      if (rough) { rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(repeat, repeat); rough.needsUpdate = true; }
      const ao = pbr.ao?.clone();
      if (ao) { ao.wrapS = ao.wrapT = THREE.RepeatWrapping; ao.repeat.set(repeat, repeat); ao.needsUpdate = true; }
      const newMat = new THREE.MeshStandardMaterial({
        map: albedo,
        normalMap: normal ?? null,
        roughnessMap: rough ?? null,
        aoMap: ao ?? null,
        color: tint,
        roughness: 1.0,
        metalness: 0.0,
        envMapIntensity: 0.6,
      });
      mesh.material = newMat;
    });
  } catch (e) {
    console.warn(`[LandScatter] PolyHaven set "${set}" failed; keeping GLTF material.`, e);
  }
}

// ── Shared animation clip cache for land animals ─────────────────────────────
// We load each animal's FBX exactly once via FBXLoader (so we keep the
// original `.animations` array — the regular `loadAsset()` cache loses
// custom properties when it `.clone()`s the group). All clones reference
// these shared `AnimationClip` instances; per-clone `AnimationMixer`s drive
// playback at independent phases so the herd doesn't move in lockstep.
interface AnimalRig {
  /** Shared root with FBX skeleton + meshes. CLONE before adding to scene. */
  prototype: THREE.Group;
  /** Shared THREE.AnimationClip refs — DO NOT mutate. */
  clips: THREE.AnimationClip[];
}
const animalRigCache = new Map<string, Promise<AnimalRig | null>>();
const fbxLoader = new FBXLoader();
const texLoader = new THREE.TextureLoader();
const animalTexCache = new Map<string, THREE.Texture>();

function getAnimalTexture(url: string): THREE.Texture {
  const cached = animalTexCache.get(url);
  if (cached) return cached;
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  animalTexCache.set(url, t);
  return t;
}

function loadAnimalRig(species: AnimalSpecies): Promise<AnimalRig | null> {
  const cfg = ANIMALS[species];
  if (!cfg) return Promise.resolve(null);
  if (animalRigCache.has(cfg.url)) return animalRigCache.get(cfg.url)!;
  const p = fbxLoader.loadAsync(cfg.url).then((root) => {
    root.scale.setScalar(cfg.scale);
    if (cfg.textureUrl) {
      const tex = getAnimalTexture(cfg.textureUrl);
      root.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            map: tex, roughness: 0.85, metalness: 0.05,
          });
          c.castShadow = true;
          c.receiveShadow = false;
        }
      });
    }
    // Normalize to a real-world height (metres) RELATIVE to the ~2 m player —
    // a rabbit reads as 0.4 m, a bear as 2.4 m — instead of every FBX landing
    // at whatever intrinsic scale its authoring app baked in.
    const targetM = ANIMAL_SIZE_M[species as keyof typeof ANIMAL_SIZE_M];
    if (targetM) normalizeToMetricSize(root, targetM, 'y');
    // FBX skeleton is included on the root; a SkinnedMesh.clone() correctly
    // duplicates the bone hierarchy in 0.182 (we rely on this in the loop).
    return { prototype: root, clips: root.animations ?? [] } as AnimalRig;
  }).catch((e) => {
    console.warn(`[LandScatter] failed to load animal rig ${species}`, e);
    return null;
  });
  animalRigCache.set(cfg.url, p);
  return p;
}

export interface LandScatterOptions {
  heightmap: IslandHeightmap;
  config: IslandConfig;
  /** World-space spawn clearance circle (no scatter inside). */
  spawnPad?: { x: number; z: number; radius: number };
  /**
   * Deterministic seed. Same seed + same config → byte-identical scatter.
   * Falls back to a fixed default so two calls with no seed still match.
   */
  seed?: number;
  /**
   * Optional canonical scene-layer set. When provided, each category is
   * pushed into its dedicated sub-group (trees/plants/flowers/rock/animal/
   * node). When omitted, everything lands in the legacy flat `group`.
   */
  layers?: SceneLayerSet;
}

export interface LandScatterResult {
  group: THREE.Group;
  /** Per-category counts placed (debug overlays). */
  counts: { trees: number; rocks: number; plants: number; flowers: number; animals: number; harvestNodes: number; birds: number };
  animals: ScatteredAnimal[];
  /** Mine the harvest node under the given raycaster (null if none hit). */
  tryMine(raycaster: THREE.Raycaster, power?: number): MineResult | null;
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

interface ScatteredAnimal {
  group: THREE.Group;
  species: AnimalSpecies;
  origin: THREE.Vector3;
  /** Wander target (world XZ). */
  target: THREE.Vector2;
  /** Time until next target retarget. */
  retargetIn: number;
  speed: number;
  /** Per-clone mixer driving the shared idle/walk clip. */
  mixer?: THREE.AnimationMixer;
}

function pickRandom<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Tiny string→int hash so the seed reflects the biome id (xfnv1a). */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Try to express a prototype as a single mesh + transform so the caller
 * can build an `InstancedMesh`. Returns null if the prototype is multi-mesh
 * (e.g. trees with separate trunk/canopy meshes) — those still go down the
 * clone path. We pre-bake the prototype's local transform into the mesh's
 * geometry so an `InstancedMesh.setMatrixAt` per placement gives the same
 * visual as a clone with `position.set(...)` + `rotation.y = ...`.
 */
function tryUnwrapInstancePrototype(proto: THREE.Object3D): { geom: THREE.BufferGeometry; mat: THREE.Material } | null {
  let foundMesh: THREE.Mesh | null = null;
  let multi = false;
  proto.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      if (foundMesh) { multi = true; return; }
      foundMesh = c as THREE.Mesh;
    }
  });
  if (!foundMesh || multi) return null;
  const mesh: THREE.Mesh = foundMesh;
  const baked = mesh.geometry.clone();
  // Bake the entire transform from prototype → mesh into the geometry so
  // matrices set on the InstancedMesh are pure placement matrices.
  proto.updateMatrixWorld(true);
  baked.applyMatrix4(mesh.matrixWorld);
  const m = mesh.material;
  // Materials may be arrays — bail in that case (rare for foliage).
  if (Array.isArray(m)) return null;
  return { geom: baked, mat: m };
}

/**
 * Build either an InstancedMesh (when the prototype is single-mesh) or a
 * Group of clones (multi-mesh fallback). Pushes whichever it built into
 * `parent` and returns the actual placed count.
 */
function placeWithInstancing(
  parent: THREE.Group,
  protos: (THREE.Group | null)[],
  points: Array<{ x: number; y: number; z: number }>,
  yOffset: number,
  scaleRange: [number, number],
  receiveShadow: boolean,
  rng: () => number = Math.random,
  /** Optional tracker so the caller's dispose() can find what we added. */
  track?: (parent: THREE.Group, obj: THREE.Object3D) => void,
): number {
  if (protos.length === 0 || points.length === 0) return 0;
  // Try unwrapping each prototype; group placements by unwrapped prototype.
  const unwrapped = protos.map((p) => p ? tryUnwrapInstancePrototype(p) : null);
  // If at least one prototype is multi-mesh we keep the clone path for ALL
  // (mixing instanced+cloned in one call adds bookkeeping with no real win).
  const allInstanceable = unwrapped.every((u) => u !== null);
  let placed = 0;

  if (allInstanceable) {
    // Bucket points by which unwrapped prototype they'll use.
    const buckets: Array<{ pts: typeof points }> = unwrapped.map(() => ({ pts: [] }));
    for (const p of points) {
      const idx = Math.floor(rng() * unwrapped.length);
      buckets[idx].pts.push(p);
    }
    const tmp = new THREE.Object3D();
    unwrapped.forEach((u, idx) => {
      if (!u) return;
      const pts = buckets[idx].pts;
      if (pts.length === 0) return;
      const inst = new THREE.InstancedMesh(u.geom, u.mat, pts.length);
      inst.castShadow = true;
      inst.receiveShadow = receiveShadow;
      inst.frustumCulled = true;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const s = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
        tmp.position.set(p.x, p.y + yOffset, p.z);
        tmp.rotation.set(0, rng() * Math.PI * 2, 0);
        tmp.scale.setScalar(s);
        tmp.updateMatrix();
        inst.setMatrixAt(i, tmp.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (track) track(parent, inst); else parent.add(inst);
      placed += pts.length;
    });
    return placed;
  }

  // Multi-mesh fallback: clone the prototype Group per placement.
  for (const p of points) {
    const idx = Math.floor(rng() * protos.length);
    const proto = protos[idx];
    if (!proto) continue;
    const clone = proto.clone(true);
    clone.position.set(p.x, p.y + yOffset, p.z);
    clone.rotation.y = rng() * Math.PI * 2;
    const s = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
    clone.scale.multiplyScalar(s);
    clone.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = receiveShadow; }
    });
    if (track) track(parent, clone); else parent.add(clone);
    placed++;
  }
  return placed;
}

function slopeAt(hm: IslandHeightmap, x: number, z: number, eps = 1.5): number {
  const hPx = hm.getHeightAt(x + eps, z);
  const hMx = hm.getHeightAt(x - eps, z);
  const hPz = hm.getHeightAt(x, z + eps);
  const hMz = hm.getHeightAt(x, z - eps);
  return Math.hypot((hPx - hMx) / (2 * eps), (hPz - hMz) / (2 * eps));
}

interface PlacementFilter {
  minH: number;
  maxH: number;
  maxSlope: number;
  /** Avoid scatter under the player spawn pad. */
  pad?: { x: number; z: number; radius: number };
}

function samplePlacement(
  hm: IslandHeightmap, world: number, n: number, f: PlacementFilter,
  rng: () => number = Math.random,
): Array<{ x: number; y: number; z: number; slope: number }> {
  const out: Array<{ x: number; y: number; z: number; slope: number }> = [];
  const half = world * 0.45; // stay inside the island mask falloff
  const maxTry = n * 30;
  for (let t = 0; t < maxTry && out.length < n; t++) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const y = hm.getHeightAt(x, z);
    if (y < f.minH || y > f.maxH) continue;
    const s = slopeAt(hm, x, z);
    if (s > f.maxSlope) continue;
    if (f.pad) {
      const dx = x - f.pad.x, dz = z - f.pad.z;
      if (dx * dx + dz * dz < f.pad.radius * f.pad.radius) continue;
    }
    out.push({ x, y, z, slope: s });
  }
  return out;
}

/**
 * Clustered placement — instead of scattering N points uniformly across the
 * whole island (which reads as sparse noise), pick a handful of cluster
 * centres and pack points around each one. Produces believable dense forests,
 * rock fields, and plant patches with open ground between them. Falls back to
 * uniform sampling for any points a cluster couldn't satisfy.
 */
function sampleClustered(
  hm: IslandHeightmap, world: number, n: number, f: PlacementFilter,
  rng: () => number, clusterCount: number, spread: number,
): Array<{ x: number; y: number; z: number; slope: number }> {
  const centers = samplePlacement(hm, world, Math.max(1, clusterCount), f, rng);
  if (centers.length === 0) return samplePlacement(hm, world, n, f, rng);
  const out: Array<{ x: number; y: number; z: number; slope: number }> = [];
  const perCluster = Math.ceil(n / centers.length);
  for (const c of centers) {
    for (let k = 0; k < perCluster * 4 && out.length < n; k++) {
      // Concentrate toward the centre: sqrt(rng) biases samples inward.
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * spread;
      const x = c.x + Math.cos(ang) * r;
      const z = c.z + Math.sin(ang) * r;
      const y = hm.getHeightAt(x, z);
      if (y < f.minH || y > f.maxH) continue;
      const s = slopeAt(hm, x, z);
      if (s > f.maxSlope) continue;
      if (f.pad) {
        const dx = x - f.pad.x, dz = z - f.pad.z;
        if (dx * dx + dz * dz < f.pad.radius * f.pad.radius) continue;
      }
      out.push({ x, y, z, slope: s });
    }
  }
  return out;
}

/**
 * Normalize every (non-null) prototype to the midpoint of a metric range and
 * return the shared jitter `scaleRange` to feed `placeWithInstancing`. Because
 * all protos in a category are normalized to the same midpoint, one jitter
 * range correctly spans the metric band for every species in that category.
 */
function metricJitter(
  protos: (THREE.Group | null)[], range: [number, number], axis: 'y' | 'max' = 'y',
): [number, number] {
  let jitter: [number, number] = [1, 1];
  for (const p of protos) {
    if (!p) continue;
    jitter = metricRangeToScaleJitter(p, range, axis);
  }
  return jitter;
}

/** Tree convenience wrapper — 2–4 m tall by height. */
function treeJitter(protos: (THREE.Group | null)[]): [number, number] {
  return metricJitter(protos, METRIC_TARGETS.tree, 'y');
}

// ── Procedural bird flock (AIR domain) ──────────────────────────────────────
interface Bird {
  group: THREE.Group;
  wingL: THREE.Object3D;
  wingR: THREE.Object3D;
  center: THREE.Vector2;
  radius: number;
  angle: number;
  angSpeed: number;
  cruiseY: number;
  state: 'cruise' | 'descend' | 'perch' | 'ascend';
  stateT: number;
  perch: THREE.Vector3;
  flap: number;
}

interface BirdFlock {
  group: THREE.Group;
  count: number;
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

function buildBirdFlock(
  hm: IslandHeightmap, world: number, rng: () => number,
  pad?: { x: number; z: number; radius: number },
): BirdFlock {
  const group = new THREE.Group();
  group.name = 'BirdFlock';
  const n = Math.max(4, Math.min(14, Math.round(world / 180)));
  const half = world * 0.4;
  const birds: Bird[] = [];
  const geoms: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const bodyGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
  bodyGeo.rotateX(Math.PI * 0.5);
  const wingGeo = new THREE.PlaneGeometry(0.7, 0.22);
  geoms.push(bodyGeo, wingGeo);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.8, metalness: 0.05 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x33333d, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide });
  mats.push(bodyMat, wingMat);

  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.32, 0, 0);
    wingR.position.set(0.32, 0, 0);
    g.add(body, wingL, wingR);

    const cx = (rng() * 2 - 1) * half * 0.7;
    const cz = (rng() * 2 - 1) * half * 0.7;
    const groundY = hm.getHeightAt(cx, cz);
    const cruiseY = Math.max(8, groundY) + 18 + rng() * 14;
    birds.push({
      group: g, wingL, wingR,
      center: new THREE.Vector2(cx, cz),
      radius: 12 + rng() * 26,
      angle: rng() * Math.PI * 2,
      angSpeed: (0.25 + rng() * 0.35) * (rng() < 0.5 ? 1 : -1),
      cruiseY,
      state: 'cruise',
      stateT: 4 + rng() * 8,
      perch: new THREE.Vector3(cx, groundY, cz),
      flap: rng() * Math.PI * 2,
    });
    group.add(g);
  }

  function update(dt: number, _elapsed: number) {
    for (const b of birds) {
      b.flap += dt * (b.state === 'perch' ? 0 : 11);
      const flapAng = Math.sin(b.flap) * 0.6;
      b.wingL.rotation.z = flapAng;
      b.wingR.rotation.z = -flapAng;
      b.stateT -= dt;
      const p = b.group.position;

      if (b.state === 'cruise') {
        b.angle += b.angSpeed * dt;
        const tx = b.center.x + Math.cos(b.angle) * b.radius;
        const tz = b.center.y + Math.sin(b.angle) * b.radius;
        const ty = b.cruiseY + Math.sin(b.angle * 2) * 1.5;
        p.set(tx, ty, tz);
        b.group.rotation.y = Math.atan2(-Math.sin(b.angle), -Math.cos(b.angle)) + Math.PI / 2;
        if (b.stateT <= 0) {
          // Occasionally pick a land spot to perch on (avoid spawn pad/water).
          const px = b.center.x + (rng() * 2 - 1) * b.radius;
          const pz = b.center.y + (rng() * 2 - 1) * b.radius;
          const py = hm.getHeightAt(px, pz);
          const inPad = pad && (px - pad.x) ** 2 + (pz - pad.z) ** 2 < pad.radius * pad.radius;
          if (py > 1.0 && !inPad) {
            b.perch.set(px, py + 0.2, pz);
            b.state = 'descend';
          } else {
            b.stateT = 4 + rng() * 6;
          }
        }
      } else if (b.state === 'descend') {
        p.lerp(b.perch, Math.min(1, dt * 1.6));
        if (p.distanceTo(b.perch) < 0.4) {
          b.state = 'perch';
          b.stateT = 3 + rng() * 5;
        }
      } else if (b.state === 'perch') {
        if (b.stateT <= 0) { b.state = 'ascend'; }
      } else { // ascend
        const target = new THREE.Vector3(p.x, b.cruiseY, p.z);
        p.lerp(target, Math.min(1, dt * 1.2));
        if (Math.abs(p.y - b.cruiseY) < 1.2) {
          b.state = 'cruise';
          b.stateT = 6 + rng() * 10;
        }
      }
    }
  }

  function dispose() {
    group.parent?.remove(group);
    for (const g of geoms) g.dispose();
    for (const m of mats) m.dispose();
  }

  return { group, count: birds.length, update, dispose };
}

export async function buildLandScatter(opts: LandScatterOptions): Promise<LandScatterResult> {
  const { heightmap, config, layers } = opts;
  const world = config.worldSize;
  // Single deterministic RNG drives every placement decision. Falls back to
  // a fixed seed so two anonymous calls still match. A hash of biome id +
  // seed keeps different biomes visually distinct under the same seed.
  const seedRoot = (opts.seed ?? 0x5eed) ^ hashString(config.id);
  const rng = mulberry32(seedRoot);

  const group = new THREE.Group();
  group.name = `LandScatter:${config.id}`;
  const animals: ScatteredAnimal[] = [];

  // Track every object this scatter pass owns so dispose() can detach +
  // GPU-release them whether they were parented to the flat `group` or
  // into a canonical SceneLayer sub-group.
  const ownedRoots: THREE.Object3D[] = [];
  const ownedInstancedGeoms: THREE.BufferGeometry[] = [];
  const addOwned = (parent: THREE.Group, obj: THREE.Object3D) => {
    parent.add(obj);
    ownedRoots.push(obj);
    obj.traverse((c) => {
      const inst = c as THREE.InstancedMesh;
      if ((inst as unknown as { isInstancedMesh?: boolean }).isInstancedMesh && inst.geometry) {
        ownedInstancedGeoms.push(inst.geometry);
      }
    });
  };

  // When the scene-layer set is provided, push each category into its own
  // canonical bucket so callers can toggle/raycast trees vs rocks vs ore
  // nodes independently. Without layers, everything lands in the legacy
  // flat `group` (kept for backwards compat with older callers).
  const treesParent   = layers?.trees   ?? group;
  const plantsParent  = layers?.plants  ?? group;
  const flowersParent = layers?.flowers ?? group;
  const rockParent    = layers?.rock    ?? group;
  const animalParent  = layers?.animal  ?? group;
  const nodeParent    = layers?.node    ?? group;

  const counts = { trees: 0, rocks: 0, plants: 0, flowers: 0, animals: 0, harvestNodes: 0, birds: 0 };
  /** Tree placements remembered so herd animals (deer) can spawn near woods. */
  let treePoints: Array<{ x: number; y: number; z: number; slope: number }> = [];

  // ── Trees ──
  // Trees are usually multi-mesh GLTFs (separate trunk/canopy meshes), so
  // they take the clone path inside `placeWithInstancing`. Single-mesh tree
  // species automatically pick up GPU instancing. Bark texture is picked
  // *per species* (pine→pine_bark, dead/twisted→dead_bark, else tree_bark)
  // so a temperate forest reads as mixed conifer/broadleaf instead of a
  // single material smear.
  if (config.trees.species.length > 0) {
    const want = categoryCount(config.trees, config.area);
    // Clumped into forests rather than uniform noise (≈1 cluster per 18 trees).
    const points = sampleClustered(heightmap, world, want, {
      minH: 1.5, maxH: config.maxHeight * 0.7, maxSlope: 0.45, pad: opts.spawnPad,
    }, rng, Math.ceil(want / 18), world * 0.05);
    treePoints = points;
    const species = config.trees.species;
    const protos = await Promise.all(species.map(s => loadAsset(NATURE_TREES[s])));
    await Promise.all(protos.map((p, i) => applyPolyHavenMaterial(p, barkSetForTree(species[i]), 2)));
    // Metric-normalize every proto to 2–4 m tall (axis 'y'); the returned
    // jitter spans that band so a forest mixes saplings and mature trees.
    const jitter = treeJitter(protos);
    counts.trees = placeWithInstancing(treesParent, protos, points.map(p => ({ x: p.x, y: p.y - 0.05, z: p.z })),
      0, jitter, true, rng, addOwned);
  }

  // ── Rocks ── (single-mesh — instances every time)
  if (config.rocks.species.length > 0) {
    const want = categoryCount(config.rocks, config.area);
    // Rock fields cluster on hillsides (≈1 cluster per 14 rocks).
    const points = sampleClustered(heightmap, world, want, {
      minH: 0.5, maxH: config.maxHeight, maxSlope: 0.9, pad: opts.spawnPad,
    }, rng, Math.ceil(want / 14), world * 0.045);
    const species = config.rocks.species;
    const protos = await Promise.all(species.map(s => loadAsset(NATURE_ROCKS[s])));
    await Promise.all(protos.map((p) => applyPolyHavenMaterial(p, 'rock', 1)));
    // Boulders sized by largest dimension (chunky) to 1–5 m. Embed into the
    // surface proportionally to slope so they read as half-buried on hillsides.
    const jitter = metricJitter(protos, METRIC_TARGETS.boulder, 'max');
    counts.rocks = placeWithInstancing(rockParent, protos,
      points.map(p => ({ x: p.x, y: p.y - 0.1 - p.slope * 0.7, z: p.z })),
      0, jitter, true, rng, addOwned);
  }

  // ── Plants ──
  if (config.plants.species.length > 0) {
    const want = categoryCount(config.plants, config.area);
    const points = sampleClustered(heightmap, world, want, {
      minH: 1.2, maxH: config.maxHeight * 0.55, maxSlope: 0.55, pad: opts.spawnPad,
    }, rng, Math.ceil(want / 24), world * 0.035);
    const species = config.plants.species;
    const protos = await Promise.all(species.map(s => loadAsset(NATURE_PLANTS[s])));
    await Promise.all(protos.map((p) => applyPolyHavenMaterial(p, 'leaves', 1)));
    const jitter = metricJitter(protos, METRIC_TARGETS.plant, 'y');
    counts.plants = placeWithInstancing(plantsParent, protos, points, 0, jitter, true, rng, addOwned);
  }

  // ── Flowers ── (typically single-mesh — best instancing candidate)
  // Flat-zone only — flowers cling to meadows, not hillsides. Tight slope
  // cap + low altitude band keeps them out of the mountain zone where
  // rocks and harvest nodes live.
  if (config.flowers.species.length > 0) {
    const want = categoryCount(config.flowers, config.area);
    const points = sampleClustered(heightmap, world, want, {
      minH: 1.2, maxH: config.maxHeight * 0.35, maxSlope: 0.22, pad: opts.spawnPad,
    }, rng, Math.ceil(want / 30), world * 0.03);
    const species = config.flowers.species;
    const protos = await Promise.all(species.map(s => loadAsset(NATURE_FLOWERS[s])));
    await Promise.all(protos.map((p) => applyPolyHavenMaterial(p, 'leaves', 1)));
    const jitter = metricJitter(protos, METRIC_TARGETS.flower, 'y');
    counts.flowers = placeWithInstancing(flowersParent, protos, points, 0, jitter, true, rng, addOwned);
  }

  // ── Animals ──
  // Skinned FBXs can't go through InstancedMesh in vanilla three.js (no
  // instanced-skinning), so animals stay as cloned rigs — but they share a
  // single in-memory `AnimationClip` via the rig cache so memory stays bounded
  // regardless of herd size. Each clone gets its own `AnimationMixer` whose
  // playhead is phase-shifted so the population looks alive, not synchronised.
  if (config.animals.species.length > 0) {
    const want = categoryCount(config.animals, config.area);
    // Animals stay in the flat / rolling zone — they wander, so spawning
    // them on cliffs leads to the wander loop trying to walk straight
    // through walls. Cap altitude to the lower-mid band and slope to ~16°.
    const points = samplePlacement(heightmap, world, want, {
      minH: 1.5, maxH: config.maxHeight * 0.55, maxSlope: 0.28, pad: opts.spawnPad,
    }, rng);
    const species = config.animals.species;
    const rigs = new Map<AnimalSpecies, AnimalRig>();
    await Promise.all(species.map(async (sp) => {
      const r = await loadAnimalRig(sp);
      if (r) rigs.set(sp, r);
    }));
    for (const p of points) {
      const sp = pickRandom(species, rng);
      const rig = rigs.get(sp);
      if (!rig) continue;
      // Deer prefer the cover of woods: if we have tree placements, drop the
      // deer a few metres from a random tree instead of out in the open.
      let px = p.x, py = p.y, pz = p.z;
      if (sp === 'deer' && treePoints.length > 0) {
        const t = treePoints[Math.floor(rng() * treePoints.length)];
        const ang = rng() * Math.PI * 2;
        const r = 2 + rng() * 6;
        px = t.x + Math.cos(ang) * r;
        pz = t.z + Math.sin(ang) * r;
        py = heightmap.getHeightAt(px, pz);
      }
      // SkeletonUtils-free clone: THREE.Object3D.clone(true) preserves the
      // skeleton bone refs in r182 for FBXLoader output well enough for our
      // simple wander loop. (For high-fidelity rigging the future plan is to
      // adopt SkeletonUtils.clone — see follow-up #3.)
      const a = rig.prototype.clone(true) as THREE.Group;
      a.position.set(px, py, pz);
      a.rotation.y = rng() * Math.PI * 2;
      addOwned(animalParent, a);

      let mixer: THREE.AnimationMixer | undefined;
      if (rig.clips.length > 0) {
        mixer = new THREE.AnimationMixer(a);
        // Pick the first clip as a generic idle/walk loop. Phase-shift the
        // start time so a herd doesn't move in lockstep.
        const action = mixer.clipAction(rig.clips[0]);
        action.setEffectiveTimeScale(0.85 + rng() * 0.4);
        action.play();
        mixer.setTime(rng() * (rig.clips[0].duration || 1));
      }

      animals.push({
        group: a, species: sp,
        origin: new THREE.Vector3(px, py, pz),
        target: new THREE.Vector2(px, pz),
        retargetIn: 0,
        // Seeded RNG — animal speed is part of deterministic scatter setup, so
        // the same seed + config reproduces an identical herd.
        speed: 1.0 + rng() * 1.2,
        mixer,
      });
      counts.animals++;
    }
  }

  // ── Harvest nodes (mineable resource deposits) ──
  // Mountain-biased: either upper-altitude band OR steep slope, so they read
  // as "go up the mountain to mine" instead of "trip over copper in the
  // meadow". Each node is a real GLB (crystal cluster or boulder) with HP,
  // chip stages, loot drops, and respawn — owned by `HarvestNodeSystem`.
  let harvest: HarvestNodeSystem | null = null;
  if (config.harvestNodes && config.harvestNodes.species.length > 0) {
    const want = categoryCount(config.harvestNodes, config.area);
    // Two passes — favour upper-altitude flat-ish ledges (60%) and steep
    // cliff faces (40%). Combining both into one filter would bias too
    // hard toward the very tops; this gives a more believable distribution.
    const wantHigh = Math.round(want * 0.6);
    const wantSlope = want - wantHigh;
    const highPoints = samplePlacement(heightmap, world, wantHigh, {
      minH: config.maxHeight * 0.40, maxH: config.maxHeight,
      maxSlope: 0.55, pad: opts.spawnPad,
    }, rng);
    const slopePoints = samplePlacement(heightmap, world, wantSlope, {
      minH: config.maxHeight * 0.20, maxH: config.maxHeight,
      maxSlope: 1.2, pad: opts.spawnPad,
    }, rng).filter(p => p.slope > 0.45);
    const species = config.harvestNodes.species;
    const placements: HarvestPlacement[] = [...highPoints, ...slopePoints].map(p => ({
      x: p.x, y: p.y, z: p.z, slope: p.slope,
      type: pickRandom(species, rng) as HarvestSpecies,
    }));
    harvest = await HarvestNodeSystem.create(heightmap, placements, rng);
    nodeParent.add(harvest.group);
    counts.harvestNodes = harvest.count;
  }

  // ── Birds (AIR domain) ──
  // A small procedural flock that circles overhead and occasionally descends
  // to perch on the ground before lifting off again. Cheap billboard-free
  // two-plane wings flap via rotation; no skinned rig, no asset load.
  const birds = buildBirdFlock(heightmap, world, rng, opts.spawnPad);
  if (birds.group.children.length > 0) {
    animalParent.add(birds.group);
    counts.birds = birds.count;
  }

  function update(dt: number, elapsed: number) {
    // Simple wander for animals: pick a target near origin, walk toward it.
    // Wander uses Math.random (not the seeded rng) on purpose — playthrough
    // motion shouldn't be deterministic across two visits to the same island.
    //
    // Land-domain constraint: these are land agents, so every candidate step is
    // validated against the terrain before it is committed. A step is rejected
    // (animal retargets back toward its spawn origin) when the destination is
    // (a) at/below shore level — keeps them out of the ocean/water domain — or
    // (b) on terrain steeper than ~27° — keeps them off cliffs the air/bird
    // domain owns. This is the appropriate domain clamp for Brownian wander;
    // goal-directed agents (battle enemies) use the baked UnifiedNavSystem,
    // and the water domain is owned by the island's MarineYuka sea creatures.
    const LAND_MIN_Y = 0.8;        // shore line — below this is water domain
    const LAND_MAX_SLOPE = 0.5;    // ~27° — above this is cliff (non-land)
    for (const a of animals) {
      a.mixer?.update(dt);
      a.retargetIn -= dt;
      if (a.retargetIn <= 0) {
        const ang = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 12;
        a.target.set(a.origin.x + Math.cos(ang) * r, a.origin.z + Math.sin(ang) * r);
        a.retargetIn = 4 + Math.random() * 6;
      }
      const dx = a.target.x - a.group.position.x;
      const dz = a.target.y - a.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const inv = 1 / d;
        const vx = dx * inv * a.speed;
        const vz = dz * inv * a.speed;
        const nx = a.group.position.x + vx * dt;
        const nz = a.group.position.z + vz * dt;
        const ny = heightmap.getHeightAt(nx, nz);
        // Domain check: reject water (too low) and cliffs (too steep). On a
        // rejected step the animal turns back toward its land spawn origin.
        if (ny < LAND_MIN_Y || slopeAt(heightmap, nx, nz) > LAND_MAX_SLOPE) {
          a.target.set(a.origin.x, a.origin.z);
          a.retargetIn = 2 + Math.random() * 3;
          continue;
        }
        a.group.position.set(nx, ny, nz);
        a.group.rotation.y = Math.atan2(vx, vz);
      }
    }
    harvest?.update(dt, elapsed);
    birds.update(dt, elapsed);
  }

  function tryMine(raycaster: THREE.Raycaster, power = 1): MineResult | null {
    return harvest ? harvest.mine(raycaster, power) : null;
  }

  function dispose() {
    // Stop & detach mixers so their internal action lists release the
    // shared AnimationClip refs and the GC can reclaim per-clone bindings.
    for (const a of animals) {
      a.mixer?.stopAllAction();
      a.mixer?.uncacheRoot(a.group);
    }
    // Detach every owned root from its current parent — covers both the
    // legacy flat `group` path and the layered SceneLayers path.
    for (const obj of ownedRoots) {
      obj.parent?.remove(obj);
    }
    // InstancedMesh geometries were CLONED from the asset loader's cached
    // prototypes (we baked the prototype matrix into them) so they are
    // owned by this scatter pass and must be disposed regardless of where
    // they were parented. Materials are shared with the loader cache and
    // intentionally NOT disposed here.
    for (const geom of ownedInstancedGeoms) {
      geom.dispose();
    }
    harvest?.dispose();
    birds.dispose();
    ownedRoots.length = 0;
    ownedInstancedGeoms.length = 0;
  }

  return { group, counts, animals, tryMine, update, dispose };
}
