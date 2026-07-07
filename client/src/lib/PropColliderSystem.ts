import * as THREE from 'three';

/**
 * PropColliderSystem
 * ------------------
 * Lightweight, engine-agnostic horizontal collision for static world props
 * (trees, rocks, crystals, resource nodes, buildings, structures, …).
 *
 * Each prop is reduced to an upright cylinder: an XZ circle ({cx, cz, radius})
 * plus a vertical band ({yMin, yMax}). A moving capsule (the player) is pushed
 * out of any cylinder it overlaps. This is intentionally NOT a full physics
 * engine — it is a cheap, deterministic "you can't walk through that model"
 * resolver that any Three.js scene can opt into.
 *
 * Typical usage:
 *   const colliders = new PropColliderSystem();
 *   colliders.rebuildFromScene(scene, isSolidProp);   // throttled, e.g. every 0.4s
 *   const blocked = colliders.resolve(player.position, PLAYER_RADIUS);
 */
export interface PropCollider {
  id: string;
  cx: number;
  cz: number;
  radius: number;
  yMin: number;
  yMax: number;
}

export interface AddFromObjectOptions {
  /** Shrink factor applied to the derived radius so the player can get close. */
  tightness?: number;
  /** Hard clamp on the derived radius (metres). */
  maxRadius?: number;
  /** Ignore props whose footprint radius is below this (tiny grass/flowers). */
  minRadius?: number;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export class PropColliderSystem {
  private colliders = new Map<string, PropCollider>();

  get count(): number {
    return this.colliders.size;
  }

  clear(): void {
    this.colliders.clear();
  }

  remove(id: string): void {
    this.colliders.delete(id);
  }

  add(id: string, cx: number, cz: number, radius: number, yMin = -Infinity, yMax = Infinity): void {
    this.colliders.set(id, { id, cx, cz, radius, yMin, yMax });
  }

  /** Bulk-register upright cylinders (e.g. harvest-node specs from IslandStarterMission). */
  registerMany(
    specs: ReadonlyArray<{ id: string; x: number; z: number; radius: number; yBase: number; height: number }>,
  ): void {
    for (const s of specs) {
      this.add(s.id, s.x, s.z, s.radius, s.yBase, s.yBase + s.height);
    }
  }

  /**
   * Derive a cylinder collider from an object's world-space bounding box.
   * Returns false when the object is too small to be worth colliding with.
   */
  addFromObject3D(id: string, obj: THREE.Object3D, opts: AddFromObjectOptions = {}): boolean {
    const tightness = opts.tightness ?? 0.7;
    const minRadius = opts.minRadius ?? 0.25;
    const maxRadius = opts.maxRadius ?? 12;

    _box.setFromObject(obj);
    if (!isFinite(_box.min.x) || !isFinite(_box.max.x) || _box.isEmpty()) return false;

    _box.getSize(_size);
    _box.getCenter(_center);

    let radius = Math.max(_size.x, _size.z) * 0.5 * tightness;
    if (radius < minRadius) return false;
    radius = Math.min(radius, maxRadius);

    this.add(id, _center.x, _center.z, radius, _box.min.y, _box.max.y);
    return true;
  }

  /**
   * Rebuild the entire collider set by walking a scene graph. When `isSolid`
   * returns true for a node, that node becomes one cylinder and its subtree is
   * NOT descended into (the whole prop is a single collider). This makes the
   * system pick up dynamically spawned / removed props automatically.
   */
  rebuildFromScene(
    root: THREE.Object3D,
    isSolid: (obj: THREE.Object3D) => boolean,
    opts: AddFromObjectOptions | ((obj: THREE.Object3D) => AddFromObjectOptions) = {},
  ): void {
    this.clear();
    let counter = 0;
    const walk = (obj: THREE.Object3D) => {
      if (obj !== root && isSolid(obj)) {
        const id = obj.uuid || `prop_${counter++}`;
        const o = typeof opts === 'function' ? opts(obj) : opts;
        this.addFromObject3D(id, obj, o);
        return; // do not descend into a matched prop
      }
      for (const child of obj.children) walk(child);
    };
    walk(root);
  }

  /**
   * Push `position` (mutated in place) out of every overlapping cylinder.
   * Returns true if any correction was applied. `iterations` lets a capsule
   * wedged between multiple props settle instead of jittering.
   */
  resolve(position: THREE.Vector3, playerRadius: number, iterations = 2): boolean {
    let corrected = false;
    for (let iter = 0; iter < iterations; iter++) {
      let movedThisPass = false;
      for (const c of this.colliders.values()) {
        // Vertical gating: only block while the player overlaps the prop's
        // vertical band (small tolerance so you can stand on top / clear it).
        if (position.y > c.yMax + 0.1 || position.y < c.yMin - 1.5) continue;

        const dx = position.x - c.cx;
        const dz = position.z - c.cz;
        const minDist = c.radius + playerRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist) continue;

        let dist = Math.sqrt(distSq);
        let nx: number;
        let nz: number;
        if (dist < 1e-4) {
          // Dead-centre overlap — pick a deterministic escape direction.
          const a = (c.cx * 12.9898 + c.cz * 78.233) % (Math.PI * 2);
          nx = Math.cos(a);
          nz = Math.sin(a);
          dist = 0;
        } else {
          nx = dx / dist;
          nz = dz / dist;
        }
        position.x = c.cx + nx * minDist;
        position.z = c.cz + nz * minDist;
        corrected = true;
        movedThisPass = true;
      }
      if (!movedThisPass) break;
    }
    return corrected;
  }
}
