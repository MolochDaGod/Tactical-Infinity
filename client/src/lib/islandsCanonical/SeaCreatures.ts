/**
 * SeaCreatures — depth-banded marine life spawner for the canonical island
 * scene. Spawns creatures in concentric rings around the island, with each
 * band tuned to a real depth in feet (matching the design brief):
 *
 *   Crabs   — shore band, y ∈ [   0,   1] ft   (procedural geometry)
 *   Singles — shallows,    y ∈ [  -5,  -1] ft  (loaded fish GLBs)
 *   Squid   — mid water,   y ∈ [ -10,  -5] ft  (procedural geometry)
 *   Schools — mid water,   y ∈ [ -10,  -5] ft  (loaded fish GLBs in flocks)
 *   Whales  — deep water,  y ∈ [ -18, -10] ft  (`Whale.glb`)
 *
 * Open-water seafloor sits at y = -20. The IslandHeightmap should be
 * configured with `minHeight ≤ -22` so the chunked terrain forms a proper
 * basin around the island.
 *
 * Picks a random spawn radius for each creature, biased so they cluster in
 * the band where the actual heightmap is at the right depth. Animation is
 * intentionally cheap: each creature follows a circular path around its
 * spawn centre + a small bob, faces velocity. Schools are a parented Group
 * of 8-15 fish with phase-offset orbits so they read as a flock.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { IslandHeightmap } from './IslandHeightmap';

// All depth bands in *feet*. We treat 1 world unit = 1 ft for visual clarity;
// this matches how players intuit "wading / swimming / diving" depths.
export const CREATURE_BANDS = {
  crabShore:    { yMin:   0, yMax:   1 },
  singleFish:   { yMin:  -5, yMax:  -1 },
  squid:        { yMin: -10, yMax:  -5 },
  schools:      { yMin: -10, yMax:  -5 },
  whales:       { yMin: -18, yMax: -10 },
  openWaterY:   -20,
} as const;

// Curated subset of fish GLBs by usage — keeps loads bounded and avoids
// putting cartoonish freshwater fish next to whales.
const SCHOOL_FISH = [
  '/fish/Blue Tang.glb',
  '/fish/Clownfish.glb',
  '/fish/Cardinal Fish.glb',
  '/fish/Butterfly Fish.glb',
  '/fish/Moorish Idol.glb',
];
const SINGLE_FISH = [
  '/fish/Parrot Fish.glb',
  '/fish/Coral Grouper.glb',
  '/fish/Lionfish.glb',
  '/fish/Puffer.glb',
  '/fish/Mandarin Fish.glb',
];
const WHALE_URL  = '/fish/Whale.glb';

export interface SeaCreaturesOptions {
  /** Counts — sensible defaults that read full but don't tank framerate. */
  whales?: number;
  squid?: number;
  schools?: number;
  schoolSize?: number;
  singles?: number;
  crabs?: number;
  /** Outer radius of the spawn ring (defaults to islandRadius * 2.6). */
  spawnRadiusOuter?: number;
  /** Inner radius — keep creatures off the beach where the seabed isn't deep. */
  spawnRadiusInner?: number;
  /** Override which heightmap to query for the sea-floor. */
  heightmap?: IslandHeightmap;
  /**
   * XZ offset for the centre of the entire spawn ring. Defaults to (0,0).
   * Set this to push all marine life to a specific coastal zone so
   * island terrain doesn't have to be designed around fish at the origin.
   */
  spawnCenter?: { x: number; z: number };
}

interface CreatureAgent {
  group: THREE.Group;
  centre: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  bob: number;     // vertical bob amplitude
  targetY: number; // mean swim depth
  faceVelocity: boolean;
}

export class SeaCreatures {
  readonly group: THREE.Group;
  private agents: CreatureAgent[] = [];
  private loader = new GLTFLoader();
  private cache = new Map<string, THREE.Group>();
  private disposed = false;

  constructor(private opts: SeaCreaturesOptions = {}) {
    this.group = new THREE.Group();
    this.group.name = 'SeaCreatures';
  }

  /** Build the whole population. Async because GLBs need to load. */
  async build(islandRadius: number) {
    const o = this.opts;
    const outer = o.spawnRadiusOuter ?? islandRadius * 2.6;
    const inner = o.spawnRadiusInner ?? islandRadius * 1.05;
    const cx = o.spawnCenter?.x ?? 0;
    const cz = o.spawnCenter?.z ?? 0;

    this.spawnCrabs(o.crabs ?? 18, islandRadius, cx, cz);
    this.spawnSquids(o.squid ?? 6, inner, outer, cx, cz);

    await Promise.all([
      this.spawnSingles(o.singles ?? 14, inner, outer, cx, cz),
      this.spawnSchools(o.schools ?? 4, o.schoolSize ?? 12, inner, outer, cx, cz),
      this.spawnWhales(o.whales ?? 2, inner * 1.4, outer, cx, cz),
    ]);
  }

  /** Per-frame swim animation. Call once a frame. */
  update(elapsedSec: number) {
    for (const a of this.agents) {
      const t = elapsedSec * a.speed + a.phase;
      const x = a.centre.x + Math.cos(t) * a.radius;
      const z = a.centre.z + Math.sin(t) * a.radius;
      const y = a.targetY + Math.sin(elapsedSec * 0.7 + a.phase) * a.bob;
      a.group.position.set(x, y, z);
      if (a.faceVelocity) {
        // dx/dt of the orbit gives the heading.
        const vx = -Math.sin(t) * a.radius;
        const vz =  Math.cos(t) * a.radius;
        a.group.rotation.y = Math.atan2(vx, vz);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry?.dispose();
        const m = c.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      }
    });
  }

  // ── Spawners ───────────────────────────────────────────────────────────

  private spawnCrabs(n: number, islandRadius: number, cx: number, cz: number) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = islandRadius * (0.92 + Math.random() * 0.08);
      const crab = buildCrab();
      const px = cx + Math.cos(angle) * r;
      const pz = cz + Math.sin(angle) * r;
      crab.position.set(px, CREATURE_BANDS.crabShore.yMin + 0.3, pz);
      crab.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(crab);
      this.agents.push({
        group: crab,
        centre: crab.position.clone(),
        radius: 0.6 + Math.random() * 0.6,
        speed:  0.2 + Math.random() * 0.3,
        phase:  Math.random() * Math.PI * 2,
        bob:    0,
        targetY: CREATURE_BANDS.crabShore.yMin + 0.3,
        faceVelocity: true,
      });
    }
  }

  private spawnSquids(n: number, inner: number, outer: number, cx: number, cz: number) {
    for (let i = 0; i < n; i++) {
      const ring = sampleRing(inner * 1.1, outer * 0.85);
      const px = cx + ring.x;
      const pz = cz + ring.z;
      const squid = buildSquid();
      squid.position.set(px, depthIn(CREATURE_BANDS.squid), pz);
      this.group.add(squid);
      this.agents.push({
        group: squid,
        centre: new THREE.Vector3(px, 0, pz),
        radius: 4 + Math.random() * 6,
        speed:  0.3 + Math.random() * 0.3,
        phase:  Math.random() * Math.PI * 2,
        bob:    0.6,
        targetY: depthIn(CREATURE_BANDS.squid),
        faceVelocity: true,
      });
    }
  }

  private async spawnSingles(n: number, inner: number, outer: number, cx: number, cz: number) {
    const models = await Promise.all(SINGLE_FISH.map((u) => this.loadCloned(u)));
    for (let i = 0; i < n; i++) {
      const proto = models[i % models.length];
      if (!proto) continue;
      const fish = proto.clone(true);
      scaleToFitHeight(fish, 0.6 + Math.random() * 0.5);
      const ring = sampleRing(inner, outer);
      const px = cx + ring.x;
      const pz = cz + ring.z;
      fish.position.set(px, depthIn(CREATURE_BANDS.singleFish), pz);
      this.group.add(fish);
      this.agents.push({
        group: fish,
        centre: new THREE.Vector3(px, 0, pz),
        radius: 3 + Math.random() * 5,
        speed:  0.6 + Math.random() * 0.5,
        phase:  Math.random() * Math.PI * 2,
        bob:    0.4,
        targetY: depthIn(CREATURE_BANDS.singleFish),
        faceVelocity: true,
      });
    }
  }

  private async spawnSchools(numSchools: number, schoolSize: number, inner: number, outer: number, cx: number, cz: number) {
    const models = await Promise.all(SCHOOL_FISH.map((u) => this.loadCloned(u)));
    const valid = models.filter(Boolean) as THREE.Group[];
    if (valid.length === 0) return;
    for (let s = 0; s < numSchools; s++) {
      const ring = sampleRing(inner, outer);
      const proto = valid[s % valid.length];
      const baseY = depthIn(CREATURE_BANDS.schools);
      const schoolCentre = new THREE.Vector3(cx + ring.x, 0, cz + ring.z);
      const schoolPhase  = Math.random() * Math.PI * 2;
      const schoolSpeed  = 0.45 + Math.random() * 0.25;
      for (let i = 0; i < schoolSize; i++) {
        const fish = proto.clone(true);
        scaleToFitHeight(fish, 0.25 + Math.random() * 0.15);
        const jitterR = 1.5 + Math.random() * 2.5;
        const jitterA = Math.random() * Math.PI * 2;
        this.group.add(fish);
        this.agents.push({
          group: fish,
          centre: schoolCentre,
          radius: 6 + jitterR,
          speed:  schoolSpeed,
          phase:  schoolPhase + jitterA * 0.25,
          bob:    0.25 + Math.random() * 0.2,
          targetY: baseY + Math.cos(jitterA) * 0.6,
          faceVelocity: true,
        });
      }
    }
  }

  private async spawnWhales(n: number, inner: number, outer: number, cx: number, cz: number) {
    const proto = await this.loadCloned(WHALE_URL);
    if (!proto) return;
    for (let i = 0; i < n; i++) {
      const whale = proto.clone(true);
      scaleToFitHeight(whale, 6 + Math.random() * 2);
      const ring = sampleRing(inner, outer);
      const px = cx + ring.x;
      const pz = cz + ring.z;
      whale.position.set(px, depthIn(CREATURE_BANDS.whales), pz);
      this.group.add(whale);
      this.agents.push({
        group: whale,
        centre: new THREE.Vector3(px, 0, pz),
        radius: 18 + Math.random() * 10,
        speed:  0.10 + Math.random() * 0.06,
        phase:  Math.random() * Math.PI * 2,
        bob:    1.2,
        targetY: depthIn(CREATURE_BANDS.whales),
        faceVelocity: true,
      });
    }
  }

  // ── GLB loader with cache + dispose-aware bailout ──────────────────────

  private loadCloned(url: string): Promise<THREE.Group | null> {
    if (this.cache.has(url)) return Promise.resolve(this.cache.get(url)!.clone(true));
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
          if (this.disposed) { resolve(null); return; }
          const root = gltf.scene;
          root.traverse((c) => {
            if (c instanceof THREE.Mesh) { c.castShadow = false; c.receiveShadow = false; }
          });
          this.cache.set(url, root);
          resolve(root.clone(true));
        },
        undefined,
        () => {
          // Asset missing — not fatal, just skip.
          // eslint-disable-next-line no-console
          console.warn(`[SeaCreatures] failed to load ${url}`);
          resolve(null);
        },
      );
    });
  }
}

// ── Procedural creatures (no GLBs needed) ─────────────────────────────

function buildCrab(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb33a1a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), bodyMat);
  body.scale.set(1.0, 0.55, 1.3);
  g.add(body);
  // Two eyes on stalks.
  for (const sx of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18), bodyMat);
    stalk.position.set(sx * 0.12, 0.18, 0.25);
    stalk.rotation.x = -0.4;
    g.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    eye.position.set(sx * 0.12, 0.30, 0.32);
    g.add(eye);
  }
  // Eight legs (4 per side).
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.03, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x8b2a14, roughness: 0.8 }),
      );
      leg.position.set(sx * 0.32, -0.05, -0.25 + i * 0.18);
      leg.rotation.z = sx * 0.7;
      g.add(leg);
    }
  }
  // Two front claws.
  for (const sx of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bodyMat);
    claw.scale.set(0.7, 0.6, 1.2);
    claw.position.set(sx * 0.45, 0.0, 0.45);
    g.add(claw);
  }
  return g;
}

function buildSquid(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x9a3a78, roughness: 0.6, transparent: true, opacity: 0.9,
  });
  // Mantle (cone) — squid swims tip-first.
  const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 14, 1, true), bodyMat);
  mantle.rotation.x = Math.PI / 2;
  mantle.position.z = 0.3;
  g.add(mantle);
  // Eyes either side of the head.
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0x554020, emissiveIntensity: 0.4 }),
    );
    eye.position.set(sx * 0.42, 0, -0.35);
    g.add(eye);
  }
  // Eight tentacles trailing behind.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.01, 1.1, 6),
      bodyMat,
    );
    t.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.25, -0.55);
    t.rotation.x = Math.PI * 0.55;
    g.add(t);
  }
  return g;
}

// ── helpers ────────────────────────────────────────────────────────────

function depthIn(band: { yMin: number; yMax: number }): number {
  return band.yMin + Math.random() * (band.yMax - band.yMin);
}

function sampleRing(inner: number, outer: number) {
  const a = Math.random() * Math.PI * 2;
  const r = inner + Math.random() * (outer - inner);
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

/** Scale a loaded GLTF model so its bounding-box height matches `target` units. */
function scaleToFitHeight(obj: THREE.Object3D, target: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const h = Math.max(size.y, 0.0001);
  const s = target / h;
  obj.scale.multiplyScalar(s);
}
