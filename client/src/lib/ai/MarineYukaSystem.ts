/**
 * MarineYukaSystem — Yuka.js-driven AI for marine creatures.
 *
 * Parallel to `yukaEnemyAI.ts` (which handles land enemies) but specialized
 * for water:
 *
 *   • Two roles:
 *       - 'wanderer'  — normal fish. Yuka WanderBehavior + occasional
 *         SeekBehavior toward a random WaterNode in their assigned band.
 *       - 'predator'  — sharks etc. Same wander base, BUT every
 *         HUNT_ROLL_INTERVAL_MS (5 minutes) rolls HUNT_ROLL_CHANCE (5%) to
 *         enter a hunt: pick the nearest non-shark target inside
 *         `huntRadius` and SeekBehavior it. Returns to wander on kill,
 *         loss-of-target, or huntTimeoutMs.
 *
 *   • Each entity is depth-band-locked. Their wander ANCHOR is a WaterNode
 *     in their band; their position is clamped vertically to the band's
 *     range so a SHALLOW reef fish never drifts into the abyss.
 *
 * The numbers (5 % / 5 min) match the user's spec verbatim and intentionally
 * mirror the constants in `seaCreatureSystem.ts` so behavior stays
 * consistent if both systems run on the same scene.
 *
 * See `.agents/skills/islands-and-terrain/SKILL.md` §13 for the playbook.
 */

import * as THREE from 'three';
import * as YUKA from 'yuka';
import { DEPTH_BANDS } from '../islandsCanonical/depthBands';
import {
  type WaterNode,
  type WaterBand,
  nodesByBand,
} from '../islandsCanonical/WaterNodes';
import { mulberry32, fnv1a, randomId } from '../ids';

export type MarineRole = 'wanderer' | 'predator';

export interface MarineRegisterOptions {
  /** Visual mesh — its position is synced from the Yuka vehicle every tick. */
  mesh: THREE.Object3D;
  /** Behavioral role. */
  role: MarineRole;
  /** Depth band this entity lives in. Wander anchors are restricted to it. */
  band: WaterBand;
  /** Max forward speed (units/sec). Defaults: wanderer 2, predator 5. */
  maxSpeed?: number;
  /** Max steering force. Higher = sharper turns. Default 1.5. */
  maxForce?: number;
  /** Predator only: max distance from current anchor to consider a target. */
  huntRadius?: number;
  /** Predator only: how long to commit to a hunt before giving up. */
  huntTimeoutMs?: number;
  /** Optional damage callback — predator calls this on contact (≤ 1.5 m). */
  onPredatorHit?: (target: MarineEntity) => void;
  /** Optional id (defaults to a session-random id — fish are ephemeral). */
  id?: string;
}

export interface MarineEntity {
  id: string;
  role: MarineRole;
  band: WaterBand;
  mesh: THREE.Object3D;
  vehicle: YUKA.Vehicle;
  /** Current wander/seek anchor (a WaterNode position or hunt target). */
  anchor: THREE.Vector3;
  /** Predator state — null for wanderers. */
  predatorState: PredatorState | null;
  options: Required<Omit<MarineRegisterOptions, 'mesh' | 'role' | 'band' | 'onPredatorHit' | 'id'>> & {
    onPredatorHit: ((t: MarineEntity) => void) | undefined;
  };
}

interface PredatorState {
  /** Wall-clock time at which the next 5-min hunt-roll fires. */
  nextHuntRollAt: number;
  /** Currently-pursued prey, or null when wandering. */
  target: MarineEntity | null;
  /** Wall-clock time at which a chase started; used for timeout. */
  huntStartedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────
// Match seaCreatureSystem.ts exactly so dual systems behave identically.
export const HUNT_ROLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const HUNT_ROLL_CHANCE      = 0.05;          // 5% per roll
const DEFAULT_HUNT_RADIUS          = 80;
const DEFAULT_HUNT_TIMEOUT_MS      = 30_000;
const PREDATOR_KILL_RANGE          = 1.5;

// ── Manager ───────────────────────────────────────────────────────────────

export class MarineYukaSystem {
  private entityManager = new YUKA.EntityManager();
  private entities = new Map<string, MarineEntity>();
  private waterNodes: WaterNode[] = [];
  private rng: () => number;

  constructor(seed: number | string = 'marine') {
    this.rng = mulberry32(typeof seed === 'string' ? fnv1a(seed) : seed);
  }

  /** Update the available water-node anchors. Call when a new island loads. */
  setWaterNodes(nodes: readonly WaterNode[]): void {
    this.waterNodes = [...nodes];
    // Reassign anchors that no longer belong to a valid band.
    for (const e of this.entities.values()) {
      if (!nodesByBand(this.waterNodes, e.band).length) continue;
      this.assignWanderAnchor(e);
    }
  }

  register(opts: MarineRegisterOptions): MarineEntity {
    const id = opts.id ?? randomId();
    const maxSpeed = opts.maxSpeed ?? (opts.role === 'predator' ? 5 : 2);

    const vehicle = new YUKA.Vehicle();
    vehicle.maxSpeed = maxSpeed;
    vehicle.maxForce = opts.maxForce ?? 1.5;
    vehicle.position.set(opts.mesh.position.x, opts.mesh.position.y, opts.mesh.position.z);

    const wander = new YUKA.WanderBehavior();
    wander.distance = 6;
    wander.jitter = 1.5;
    wander.radius = 3;
    vehicle.steering.add(wander);

    this.entityManager.add(vehicle);

    const entity: MarineEntity = {
      id,
      role: opts.role,
      band: opts.band,
      mesh: opts.mesh,
      vehicle,
      anchor: new THREE.Vector3(),
      predatorState: opts.role === 'predator' ? {
        nextHuntRollAt: performance.now() + HUNT_ROLL_INTERVAL_MS * (0.5 + this.rng() * 0.5),
        target: null,
        huntStartedAt: 0,
      } : null,
      options: {
        maxSpeed,
        maxForce: opts.maxForce ?? 1.5,
        huntRadius: opts.huntRadius ?? DEFAULT_HUNT_RADIUS,
        huntTimeoutMs: opts.huntTimeoutMs ?? DEFAULT_HUNT_TIMEOUT_MS,
        onPredatorHit: opts.onPredatorHit,
      },
    };

    this.assignWanderAnchor(entity);
    this.entities.set(id, entity);
    return entity;
  }

  unregister(id: string): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entityManager.remove(e.vehicle);
    this.entities.delete(id);
  }

  /** Tick AI + sync mesh transforms. Pass real seconds. */
  update(deltaSec: number): void {
    const now = performance.now();

    // 1. Predator hunt-roll + target validation.
    for (const e of this.entities.values()) {
      if (e.role !== 'predator' || !e.predatorState) continue;
      const ps = e.predatorState;

      // Roll for new hunt.
      if (!ps.target && now >= ps.nextHuntRollAt) {
        ps.nextHuntRollAt = now + HUNT_ROLL_INTERVAL_MS;
        if (this.rng() < HUNT_ROLL_CHANCE) {
          const prey = this.findClosestPrey(e);
          if (prey) {
            ps.target = prey;
            ps.huntStartedAt = now;
            this.assignSeekAnchor(e, prey.mesh.position);
          }
        }
      }

      // Validate ongoing hunt.
      if (ps.target) {
        const t = ps.target;
        const stillExists = this.entities.has(t.id);
        const timedOut = now - ps.huntStartedAt > e.options.huntTimeoutMs;
        const dist = e.mesh.position.distanceTo(t.mesh.position);

        if (!stillExists || timedOut) {
          ps.target = null;
          this.assignWanderAnchor(e);
        } else if (dist <= PREDATOR_KILL_RANGE) {
          e.options.onPredatorHit?.(t);
          ps.target = null;
          this.assignWanderAnchor(e);
        } else {
          // Track the target each tick.
          this.assignSeekAnchor(e, t.mesh.position);
        }
      }
    }

    // 2. Reach-anchor → pick a new wander anchor (wanderers + non-hunting predators).
    const reachThresholdSq = 4 * 4;
    for (const e of this.entities.values()) {
      const isHunting = e.role === 'predator' && e.predatorState?.target;
      if (isHunting) continue;
      const dxz = (e.vehicle.position.x - e.anchor.x) ** 2 +
                  (e.vehicle.position.z - e.anchor.z) ** 2;
      if (dxz < reachThresholdSq) this.assignWanderAnchor(e);
    }

    // 3. Tick Yuka.
    this.entityManager.update(deltaSec);

    // 4. Sync mesh + clamp Y to band range so fish stay in their stratum.
    for (const e of this.entities.values()) {
      const v = e.vehicle.position;
      const range = DEPTH_BANDS[e.band];
      const clampedY = Math.max(range.yMin + 1, Math.min(range.yMax - 1, v.y));
      v.y = clampedY;

      e.mesh.position.set(v.x, v.y, v.z);

      // Face direction of travel.
      const fwd = e.vehicle.velocity;
      const fwdLenSq = fwd.x * fwd.x + fwd.y * fwd.y + fwd.z * fwd.z;
      if (fwdLenSq > 0.01) {
        const targetYaw = Math.atan2(fwd.x, fwd.z);
        // Smooth heading.
        const cur = e.mesh.rotation.y;
        const diff = wrapAngle(targetYaw - cur);
        e.mesh.rotation.y = cur + diff * Math.min(1, deltaSec * 4);
      }
    }
  }

  /** Pick a fresh wander target — a random WaterNode in this entity's band. */
  private assignWanderAnchor(e: MarineEntity): void {
    const candidates = nodesByBand(this.waterNodes, e.band);
    if (candidates.length === 0) {
      // No nodes? wander in place around current position.
      e.anchor.copy(e.mesh.position);
      return;
    }
    const node = candidates[Math.floor(this.rng() * candidates.length)];
    e.anchor.copy(node.position);

    // Re-orient the vehicle toward the anchor so the WanderBehavior's
    // local jitter immediately feels purposeful. We DON'T teleport — just
    // seed the velocity direction.
    const dx = node.position.x - e.vehicle.position.x;
    const dz = node.position.z - e.vehicle.position.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.01) {
      e.vehicle.velocity.set(
        (dx / len) * e.vehicle.maxSpeed * 0.5,
        e.vehicle.velocity.y,
        (dz / len) * e.vehicle.maxSpeed * 0.5,
      );
    }
  }

  /** Steer toward a moving target (predator hunt). */
  private assignSeekAnchor(e: MarineEntity, targetPos: THREE.Vector3): void {
    e.anchor.set(targetPos.x, targetPos.y, targetPos.z);
    const dx = targetPos.x - e.vehicle.position.x;
    const dz = targetPos.z - e.vehicle.position.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.01) {
      e.vehicle.velocity.set(
        (dx / len) * e.vehicle.maxSpeed,
        (targetPos.y - e.vehicle.position.y) * 0.3,
        (dz / len) * e.vehicle.maxSpeed,
      );
    }
  }

  /** Pick nearest non-predator entity inside huntRadius. */
  private findClosestPrey(predator: MarineEntity): MarineEntity | null {
    let best: MarineEntity | null = null;
    let bestDist = predator.options.huntRadius;
    for (const e of this.entities.values()) {
      if (e === predator || e.role === 'predator') continue;
      const d = predator.mesh.position.distanceTo(e.mesh.position);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  dispose(): void {
    for (const e of this.entities.values()) {
      this.entityManager.remove(e.vehicle);
    }
    this.entities.clear();
    this.waterNodes = [];
  }

  get size(): number { return this.entities.size; }
  get all(): readonly MarineEntity[] { return Array.from(this.entities.values()); }
}

function wrapAngle(a: number): number {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
