/**
 * Tutorial island opening cinema — character arrives on Waterfall / tutorial shore.
 *
 * Three.js production practices:
 *  - ACES + sRGB color management (caller)
 *  - Cinema camera locked (no Orbit fight) until skip / complete
 *  - Real CDN assets only (grudge6 hero, optional ship)
 *  - SI units: human ≈ 1.8 m
 *  - Skippable after 1.2 s
 *
 * Physics: optional Rapier debris at shore (hull planks) — combat uses
 * `naval/rapierOpenSeaCombat` on world map; here we only present.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import RAPIER from "@dimforge/rapier3d-compat";

export type TutorialCinemaPhase =
  | "establish"
  | "approach"
  | "land"
  | "hero_reveal"
  | "handoff"
  | "done";

export interface TutorialCinemaOpts {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Beach spawn feet (world). */
  spawn: THREE.Vector3;
  /** Look target toward island center. */
  islandLook?: THREE.Vector3;
  heroRace?: string;
  heroName?: string;
  /** Skip immediately if true. */
  skip?: boolean;
  onCaption?: (text: string) => void;
  onPhase?: (phase: TutorialCinemaPhase) => void;
  onComplete?: () => void;
}

const HERO_BY_RACE: Record<string, string> = {
  human:
    "https://assets.grudge-studio.com/models/heroes/grudge6/western-kingdoms_warrior.glb",
  orc: "https://assets.grudge-studio.com/models/heroes/grudge6/orcs_warrior.glb",
  elf: "https://assets.grudge-studio.com/models/heroes/grudge6/elves_warrior.glb",
  barbarian:
    "https://assets.grudge-studio.com/models/heroes/grudge6/barbarians_warrior.glb",
  dwarf:
    "https://assets.grudge-studio.com/models/heroes/grudge6/western-kingdoms_warrior.glb",
  undead:
    "https://assets.grudge-studio.com/models/heroes/grudge6/orcs_warrior.glb",
};

const FALLBACK_HERO =
  "https://assets.grudge-studio.com/models/heroes/grudge6/western-kingdoms_warrior.glb";

const SHIP_URL =
  "https://assets.grudge-studio.com/models/ships/galleon.glb";

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function fitHeight(root: THREE.Object3D, targetM = 1.8): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const h = Math.max(box.getSize(new THREE.Vector3()).y, 0.01);
  let s = targetM / h;
  if (h > 50) s = targetM / (h * 0.01);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

export class TutorialIslandOpening {
  private opts: TutorialCinemaOpts;
  private t = 0;
  private phase: TutorialCinemaPhase = "establish";
  private done = false;
  private skipped = false;
  private heroRoot: THREE.Group | null = null;
  private shipRoot: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private letterboxEls: HTMLElement[] = [];
  private debris: Array<{ mesh: THREE.Mesh; body: RAPIER.RigidBody }> = [];
  private world: RAPIER.World | null = null;
  private rapierReady = false;
  private loading = true;

  /** Total cinema length (s) before auto-handoff. */
  readonly durationSec = 11.5;
  readonly skippableAfterSec = 1.2;

  constructor(opts: TutorialCinemaOpts) {
    this.opts = opts;
  }

  async prepare(): Promise<void> {
    const { scene, spawn, heroRace = "human" } = this.opts;
    const loader = new GLTFLoader();
    try {
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch {
      /* optional */
    }

    // Parallel load hero + optional ship (best-effort)
    const heroUrl = HERO_BY_RACE[heroRace.toLowerCase()] || FALLBACK_HERO;
    const [heroGltf, shipGltf] = await Promise.all([
      loader.loadAsync(heroUrl).catch(() =>
        loader.loadAsync(FALLBACK_HERO).catch(() => null),
      ),
      loader.loadAsync(SHIP_URL).catch(() => null),
    ]);

    if (heroGltf) {
      const g = heroGltf.scene as THREE.Group;
      g.name = "tutorial_hero";
      fitHeight(g, 1.8);
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      g.position.set(spawn.x, spawn.y, spawn.z);
      g.rotation.y = Math.PI; // face inland default
      g.visible = false;
      scene.add(g);
      this.heroRoot = g;
      if (heroGltf.animations?.length) {
        this.mixer = new THREE.AnimationMixer(g);
        const idle =
          heroGltf.animations.find((c) => /idle|stand/i.test(c.name)) ||
          heroGltf.animations[0];
        if (idle) {
          const a = this.mixer.clipAction(idle);
          a.setLoop(THREE.LoopRepeat, Infinity);
          a.play();
        }
      }
    }

    if (shipGltf) {
      const ship = shipGltf.scene as THREE.Group;
      ship.name = "tutorial_wreck_approach";
      // SI-ish galleon — if huge, normalize length ~ 28 m
      ship.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(ship).getSize(new THREE.Vector3());
      const targetLen = 28;
      if (size.z > 0.1) ship.scale.multiplyScalar(targetLen / Math.max(size.z, size.x));
      const offshore = spawn
        .clone()
        .add(new THREE.Vector3(0, 0, 1).multiplyScalar(55));
      ship.position.set(offshore.x, spawn.y + 0.5, offshore.z + 40);
      ship.rotation.y = Math.PI * 0.9;
      ship.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      scene.add(ship);
      this.shipRoot = ship;
    }

    // Rapier debris near shore (real physics, small budget)
    try {
      await RAPIER.init();
      this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      this.world.timestep = 1 / 60;
      // Ground plane at spawn.y
      const ground = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(spawn.x, spawn.y - 0.05, spawn.z),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(80, 0.1, 80),
        ground,
      );
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.12, 1.1),
          new THREE.MeshStandardMaterial({
            color: 0x5c4033,
            roughness: 0.92,
            metalness: 0.05,
          }),
        );
        mesh.castShadow = true;
        const px = spawn.x + (Math.random() - 0.5) * 12;
        const pz = spawn.z + 8 + Math.random() * 10;
        const py = spawn.y + 2 + Math.random() * 2;
        mesh.position.set(px, py, pz);
        scene.add(mesh);
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(px, py, pz)
            .setCcdEnabled(true)
            .setLinearDamping(0.3),
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.25, 0.06, 0.55).setDensity(0.5),
          body,
        );
        this.debris.push({ mesh, body });
      }
      this.rapierReady = true;
    } catch (e) {
      console.warn("[TutorialCinema] Rapier debris skipped", e);
    }

    this.loading = false;
    this.opts.onCaption?.(
      this.opts.heroName
        ? `${this.opts.heroName} washes ashore…`
        : "You wash ashore…",
    );
    this.opts.onPhase?.("establish");
  }

  /** Mount letterbox bars on a host element (absolute overlay). */
  mountLetterbox(host: HTMLElement): void {
    const mk = (side: "top" | "bottom") => {
      const el = document.createElement("div");
      el.dataset.tutorialLetterbox = side;
      el.style.cssText = [
        "position:absolute",
        "left:0",
        "right:0",
        side === "top" ? "top:0" : "bottom:0",
        "height:11%",
        "background:#000",
        "pointer-events:none",
        "z-index:40",
        "transition:height 0.6s ease",
      ].join(";");
      host.appendChild(el);
      this.letterboxEls.push(el);
    };
    mk("top");
    mk("bottom");
  }

  skip(): void {
    if (this.t < this.skippableAfterSec && !this.done) return;
    this.skipped = true;
    this.finish();
  }

  get isDone(): boolean {
    return this.done;
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get elapsed(): number {
    return this.t;
  }

  /**
   * Drive cinema. Returns true when complete (caller unlocks gameplay).
   */
  update(dt: number): boolean {
    if (this.done || this.loading) return this.done;
    this.t += dt;
    const u = Math.min(1, this.t / this.durationSec);
    const cam = this.opts.camera;
    const spawn = this.opts.spawn;
    const look =
      this.opts.islandLook?.clone() ??
      spawn.clone().add(new THREE.Vector3(-8, 1.2, -12));

    // Fixed-step Rapier debris
    if (this.rapierReady && this.world) {
      this.world.timestep = Math.min(dt, 1 / 30);
      this.world.step();
      for (const d of this.debris) {
        const tr = d.body.translation();
        const rot = d.body.rotation();
        d.mesh.position.set(tr.x, tr.y, tr.z);
        d.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      }
    }
    this.mixer?.update(dt);

    // ── Camera beats ──
    if (u < 0.28) {
      // Establish: high offshore look at island
      this.setPhase("establish");
      const p = easeInOut(u / 0.28);
      const far = new THREE.Vector3(
        spawn.x + 48,
        spawn.y + 28,
        spawn.z + 72,
      );
      const mid = new THREE.Vector3(
        spawn.x + 22,
        spawn.y + 12,
        spawn.z + 36,
      );
      cam.position.lerpVectors(far, mid, p);
      cam.lookAt(look.x, look.y + 2, look.z);
      this.opts.onCaption?.("Tutorial Island — Waterfall Isle");
    } else if (u < 0.52) {
      // Approach along wreck line
      this.setPhase("approach");
      const p = easeInOut((u - 0.28) / 0.24);
      const a = new THREE.Vector3(spawn.x + 22, spawn.y + 12, spawn.z + 36);
      const b = new THREE.Vector3(spawn.x + 6, spawn.y + 4.5, spawn.z + 14);
      cam.position.lerpVectors(a, b, p);
      if (this.shipRoot) {
        const s0 = this.shipRoot.position.clone();
        this.shipRoot.position.x = THREE.MathUtils.lerp(s0.x, spawn.x + 4, p * 0.15);
        this.shipRoot.rotation.z = Math.sin(this.t * 1.2) * 0.04;
      }
      cam.lookAt(spawn.x, spawn.y + 1.5, spawn.z);
      this.opts.onCaption?.("Wreckage and wreckwood on the tide…");
    } else if (u < 0.72) {
      // Land — low beach glide
      this.setPhase("land");
      const p = easeInOut((u - 0.52) / 0.2);
      const a = new THREE.Vector3(spawn.x + 6, spawn.y + 4.5, spawn.z + 14);
      const b = new THREE.Vector3(spawn.x + 2.2, spawn.y + 2.1, spawn.z + 5.5);
      cam.position.lerpVectors(a, b, p);
      cam.lookAt(spawn.x, spawn.y + 1.4, spawn.z);
      this.opts.onCaption?.("Make landfall. Survive. Build a raft.");
    } else if (u < 0.92) {
      // Hero reveal
      this.setPhase("hero_reveal");
      if (this.heroRoot) this.heroRoot.visible = true;
      const p = easeInOut((u - 0.72) / 0.2);
      const orbit = 4.2 - p * 0.6;
      const ang = Math.PI * 0.35 + p * 0.4;
      cam.position.set(
        spawn.x + Math.sin(ang) * orbit,
        spawn.y + 1.7 + (1 - p) * 0.8,
        spawn.z + Math.cos(ang) * orbit,
      );
      cam.lookAt(spawn.x, spawn.y + 1.35, spawn.z);
      this.opts.onCaption?.(
        this.opts.heroName ? `${this.opts.heroName} — free at last` : "You stand free",
      );
    } else {
      this.setPhase("handoff");
      // Settle behind hero for third-person handoff
      const p = easeInOut((u - 0.92) / 0.08);
      const from = cam.position.clone();
      const to = new THREE.Vector3(
        spawn.x + Math.sin(Math.PI * 0.75) * 5,
        spawn.y + 2.4,
        spawn.z + Math.cos(Math.PI * 0.75) * 5,
      );
      cam.position.lerpVectors(from, to, Math.min(1, p + 0.2));
      cam.lookAt(spawn.x, spawn.y + 1.4, spawn.z);
      this.opts.onCaption?.("WASD move · mouse look · harvest · build raft");
    }

    if (this.t >= this.durationSec || this.skipped) {
      this.finish();
      return true;
    }
    return false;
  }

  private setPhase(p: TutorialCinemaPhase): void {
    if (this.phase === p) return;
    this.phase = p;
    this.opts.onPhase?.(p);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.setPhase("done");
    // Collapse letterbox
    for (const el of this.letterboxEls) {
      el.style.height = "0";
    }
    // Hide cinema-only ship if present (wreck stays optional)
    if (this.shipRoot) {
      this.shipRoot.visible = false;
    }
    // Hero is owned by cinema — remove so gameplay controller has sole avatar
    if (this.heroRoot) {
      this.opts.scene.remove(this.heroRoot);
      this.heroRoot = null;
    }
    this.opts.onCaption?.("");
    this.opts.onComplete?.();
  }

  dispose(): void {
    this.finish();
    for (const el of this.letterboxEls) el.remove();
    this.letterboxEls = [];
    for (const d of this.debris) {
      this.opts.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    }
    this.debris = [];
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    if (this.shipRoot) {
      this.opts.scene.remove(this.shipRoot);
      this.shipRoot = null;
    }
  }
}
