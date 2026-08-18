/**
 * Rapier open-sea combat — fleet SSOT physics for ships & cannonballs.
 *
 * Reference gameplay (feel, not engine):
 *   - threejs-games physics-cannon (projectiles + smashable targets)
 *   - model-viewer presentation for clean ship framing
 *
 * Engine: **@dimforge/rapier3d-compat only** (never Cannon.js / Ammo).
 *
 * Design:
 *   - Player/NPC hulls = **kinematic** cuboids (sailing sim owns position)
 *   - Cannonballs = **dynamic** spheres + CCD (real impacts)
 *   - Water = soft clamp + splash at y≈0 (buoyancy forces optional)
 *   - Hit → damage callback → ShipPartsManager destroy/repair
 *   - Destroyed parts can spawn dynamic debris bodies
 */

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export type RapierShipKind = "player" | "npc";

export interface RapierShipHull {
  id: string;
  kind: RapierShipKind;
  /** Half-extents (m) — SI scale, typical sloop ~ (4, 1.2, 10) */
  halfExtents: THREE.Vector3;
  /** World transform driven by sailing sim */
  position: THREE.Vector3;
  /** Yaw only (rad) */
  yaw: number;
}

export interface CannonballSpawn {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ownerId: string;
  damage: number;
  radius?: number;
  lifetime?: number;
}

export interface BallHitEvent {
  ballId: string;
  shipId: string;
  damage: number;
  point: THREE.Vector3;
  ownerId: string;
}

export interface DebrisSpawn {
  id: string;
  position: THREE.Vector3;
  halfExtents: THREE.Vector3;
  impulse: THREE.Vector3;
  color?: number;
}

const PROJECTILE_GROUP = 0x0002;
const HULL_GROUP = 0x0001;
const DEBRIS_GROUP = 0x0004;
const WATER_GROUP = 0x0008;

/** membership | filter — see rapier collision groups */
function groups(membership: number, filter: number): number {
  return (membership << 16) | filter;
}

export class RapierOpenSeaCombat {
  private world: RAPIER.World | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;

  private hullBodies = new Map<string, RAPIER.RigidBody>();
  private hullColliders = new Map<string, RAPIER.Collider>();
  /** RigidBody handle → ship id */
  private bodyHandleToShip = new Map<number, string>();
  private ballBodies = new Map<string, RAPIER.RigidBody>();
  /** RigidBody handle → ball id */
  private bodyHandleToBall = new Map<number, string>();
  private ballMeta = new Map<
    string,
    { ownerId: string; damage: number; lifetime: number; radius: number }
  >();
  private debrisBodies = new Map<
    string,
    { body: RAPIER.RigidBody; mesh: THREE.Mesh; life: number }
  >();

  private eventQueue: RAPIER.EventQueue | null = null;
  private pendingHits: BallHitEvent[] = [];
  private scene: THREE.Scene | null = null;

  /** Call once after construction (async WASM). Safe to call multiple times. */
  async init(scene?: THREE.Scene): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.scene = scene ?? null;
    this.initPromise = (async () => {
      await RAPIER.init();
      this.world = new RAPIER.World({ x: 0, y: -45, z: 0 }); // snappy arcade gravity
      this.world.timestep = 1 / 60;
      this.eventQueue = new RAPIER.EventQueue(true);
      this.ready = true;
    })();
    return this.initPromise;
  }

  isReady(): boolean {
    return this.ready && !!this.world;
  }

  /**
   * Upsert kinematic hull collider for a ship (player or NPC).
   * Call every frame with sailing-sim transforms, or after spawn/swap.
   */
  syncShipHull(hull: RapierShipHull): void {
    if (!this.world) return;
    const he = hull.halfExtents;
    let body = this.hullBodies.get(hull.id);

    const rot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      hull.yaw,
    );
    const q = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
    const t = {
      x: hull.position.x,
      y: Math.max(he.y * 0.35, hull.position.y + he.y * 0.5),
      z: hull.position.z,
    };

    if (!body) {
      const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(t.x, t.y, t.z)
        .setRotation(q)
        .setCanSleep(false);
      body = this.world.createRigidBody(desc);
      const colDesc = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
        .setCollisionGroups(groups(HULL_GROUP, PROJECTILE_GROUP | DEBRIS_GROUP | HULL_GROUP))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
        .setRestitution(0.15)
        .setFriction(0.6);
      const col = this.world.createCollider(colDesc, body);
      this.hullBodies.set(hull.id, body);
      this.hullColliders.set(hull.id, col);
      this.bodyHandleToShip.set(body.handle, hull.id);
    } else {
      body.setNextKinematicTranslation(t);
      body.setNextKinematicRotation(q);
    }
  }

  removeShipHull(shipId: string): void {
    if (!this.world) return;
    const body = this.hullBodies.get(shipId);
    if (body) {
      this.bodyHandleToShip.delete(body.handle);
      this.world.removeRigidBody(body);
      this.hullBodies.delete(shipId);
      this.hullColliders.delete(shipId);
    }
  }

  spawnCannonball(spawn: CannonballSpawn): void {
    if (!this.world) return;
    // Replace existing id if re-fired with same key
    if (this.ballBodies.has(spawn.id)) this.removeBall(spawn.id);
    const radius = spawn.radius ?? 0.55;
    const lifetime = spawn.lifetime ?? 8;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.position.x, spawn.position.y, spawn.position.z)
      .setLinvel(spawn.velocity.x, spawn.velocity.y, spawn.velocity.z)
      .setCcdEnabled(true)
      .setCanSleep(false)
      .setLinearDamping(0.05)
      .setAngularDamping(0.2);
    const body = this.world.createRigidBody(desc);
    const colDesc = RAPIER.ColliderDesc.ball(radius)
      .setDensity(8)
      .setRestitution(0.2)
      .setFriction(0.4)
      .setCollisionGroups(
        groups(PROJECTILE_GROUP, HULL_GROUP | WATER_GROUP | DEBRIS_GROUP),
      )
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
      .setActiveCollisionTypes(
        RAPIER.ActiveCollisionTypes.DEFAULT |
          RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED |
          RAPIER.ActiveCollisionTypes.DYNAMIC_KINEMATIC,
      );
    this.world.createCollider(colDesc, body);
    this.ballBodies.set(spawn.id, body);
    this.bodyHandleToBall.set(body.handle, spawn.id);
    this.ballMeta.set(spawn.id, {
      ownerId: spawn.ownerId,
      damage: spawn.damage,
      lifetime,
      radius,
    });
  }

  /**
   * Step physics, drain collision events, sync ball meshes if provided.
   * Returns hits + ball world states for visual sync.
   */
  step(
    dt: number,
    ballMeshes?: Map<string, THREE.Mesh>,
  ): {
    hits: BallHitEvent[];
    ballStates: Map<string, { pos: THREE.Vector3; vel: THREE.Vector3 }>;
    removedBalls: string[];
  } {
    const hits: BallHitEvent[] = [];
    const ballStates = new Map<string, { pos: THREE.Vector3; vel: THREE.Vector3 }>();
    const removedBalls: string[] = [];
    if (!this.world || !this.ready) {
      return { hits, ballStates, removedBalls };
    }

    // Fixed substeps for stability at large dt
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 60))));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.world.timestep = sub;
      this.world.step(this.eventQueue!);
    }

    // Collision events: ball ↔ hull (collider handles)
    this.eventQueue!.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const c1 = this.world!.getCollider(h1);
      const c2 = this.world!.getCollider(h2);
      if (!c1 || !c2) return;
      const b1 = c1.parent();
      const b2 = c2.parent();
      if (!b1 || !b2) return;
      const hit =
        this.resolveBallHullHit(b1.handle, b2.handle) ||
        this.resolveBallHullHit(b2.handle, b1.handle);
      if (hit) hits.push(hit);
    });

    // Sync balls + water kill
    for (const [id, body] of this.ballBodies) {
      const meta = this.ballMeta.get(id);
      if (!meta) continue;
      meta.lifetime -= dt;
      const t = body.translation();
      const v = body.linvel();
      const pos = new THREE.Vector3(t.x, t.y, t.z);
      const vel = new THREE.Vector3(v.x, v.y, v.z);
      ballStates.set(id, { pos, vel });

      const mesh = ballMeshes?.get(id);
      if (mesh) {
        mesh.position.copy(pos);
        const speed = vel.length();
        mesh.rotation.x += dt * speed * 0.08;
        mesh.rotation.z += dt * speed * 0.04;
      }

      if (t.y <= 0.15 || meta.lifetime <= 0) {
        removedBalls.push(id);
      }
    }

    for (const id of removedBalls) {
      this.removeBall(id);
    }

    // Hits remove balls
    for (const h of hits) {
      if (this.ballBodies.has(h.ballId)) {
        this.removeBall(h.ballId);
        if (!removedBalls.includes(h.ballId)) removedBalls.push(h.ballId);
      }
    }

    // Debris lifetime
    for (const [id, entry] of this.debrisBodies) {
      entry.life -= dt;
      const t = entry.body.translation();
      const r = entry.body.rotation();
      entry.mesh.position.set(t.x, t.y, t.z);
      entry.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (entry.life <= 0 || t.y < -5) {
        this.world.removeRigidBody(entry.body);
        this.scene?.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        (entry.mesh.material as THREE.Material).dispose();
        this.debrisBodies.delete(id);
      }
    }

    this.pendingHits = hits;
    return { hits, ballStates, removedBalls };
  }

  private resolveBallHullHit(
    handleA: number,
    handleB: number,
  ): BallHitEvent | null {
    const ballId = this.bodyHandleToBall.get(handleA);
    const shipId = this.bodyHandleToShip.get(handleB);
    if (!ballId || !shipId) return null;
    const meta = this.ballMeta.get(ballId);
    if (!meta) return null;
    if (meta.ownerId === shipId) return null;
    const body = this.ballBodies.get(ballId);
    const t = body?.translation() ?? { x: 0, y: 0, z: 0 };
    return {
      ballId,
      shipId,
      damage: meta.damage,
      point: new THREE.Vector3(t.x, t.y, t.z),
      ownerId: meta.ownerId,
    };
  }

  removeBall(id: string): void {
    if (!this.world) return;
    const body = this.ballBodies.get(id);
    if (body) {
      this.bodyHandleToBall.delete(body.handle);
      this.world.removeRigidBody(body);
      this.ballBodies.delete(id);
    }
    this.ballMeta.delete(id);
  }

  /** Spawn a floating plank/crate chunk when a ship part is destroyed. */
  spawnDebris(opts: DebrisSpawn): void {
    if (!this.world || !this.scene) return;
    const he = opts.halfExtents;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(opts.position.x, opts.position.y, opts.position.z)
      .setCcdEnabled(true)
      .setCanSleep(true)
      .setLinearDamping(0.4)
      .setAngularDamping(0.5);
    const body = this.world.createRigidBody(desc);
    const col = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
      .setDensity(0.4)
      .setRestitution(0.35)
      .setCollisionGroups(groups(DEBRIS_GROUP, HULL_GROUP | PROJECTILE_GROUP | DEBRIS_GROUP));
    this.world.createCollider(col, body);
    body.applyImpulse(
      { x: opts.impulse.x, y: opts.impulse.y, z: opts.impulse.z },
      true,
    );
    body.applyTorqueImpulse(
      {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2,
      },
      true,
    );

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2),
      new THREE.MeshStandardMaterial({
        color: opts.color ?? 0x5c4033,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    mesh.position.copy(opts.position);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.debrisBodies.set(opts.id, { body, mesh, life: 12 });
  }

  /**
   * Default hull half-extents by ship tier name (SI metres).
   */
  static halfExtentsForShipType(shipType?: string): THREE.Vector3 {
    const t = (shipType || "sloop").toLowerCase();
    if (t.includes("raft") || t.includes("skiff") || t.includes("dinghy")) {
      return new THREE.Vector3(1.6, 0.7, 3.2);
    }
    if (t.includes("brig") || t.includes("frigate")) {
      return new THREE.Vector3(5, 1.6, 14);
    }
    if (t.includes("galleon") || t.includes("manowar") || t.includes("warship")) {
      return new THREE.Vector3(6.5, 2.2, 18);
    }
    // sloop / default
    return new THREE.Vector3(3.2, 1.1, 9);
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.hullBodies.clear();
    this.hullColliders.clear();
    this.bodyHandleToShip.clear();
    this.ballBodies.clear();
    this.bodyHandleToBall.clear();
    this.ballMeta.clear();
    for (const [, d] of this.debrisBodies) {
      this.scene?.remove(d.mesh);
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    }
    this.debrisBodies.clear();
    this.eventQueue = null;
    this.ready = false;
    this.initPromise = null;
  }
}
