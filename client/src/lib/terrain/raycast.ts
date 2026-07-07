/**
 * Terrain raycasting — canonical, BVH-accelerated.
 *
 * three-mesh-bvh gives us O(log n) raycasts against any THREE.BufferGeometry.
 * Vanilla three.js is O(n) per ray and that becomes the frame's bottleneck the
 * moment you have a chunked island (16-64 chunks * 65k tris each) and try to
 * do click-to-move, AI line-of-sight, foot-on-ground placement, or hover-pick.
 *
 * This file is the *only* place in the codebase that touches three-mesh-bvh
 * internals. Everywhere else uses these helpers and the typed `TerrainPicker`
 * so we can swap the implementation without rewriting callers.
 *
 * See `client/src/lib/terrain/RULES.md` for usage conventions.
 */

import * as THREE from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  MeshBVH,
} from 'three-mesh-bvh';

// ── One-time prototype patch ───────────────────────────────────────────────
//
// three-mesh-bvh asks you to monkey-patch THREE so that:
//   geom.computeBoundsTree() / geom.disposeBoundsTree() exist
//   mesh.raycast(...) goes through acceleratedRaycast when a BVH is present
//
// We guard with a module-level flag so this runs exactly once even if the
// module is re-imported via HMR.

let patched = false;
export function ensureBVHPatched(): void {
  if (patched) return;
  (THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  patched = true;
}

// Auto-patch on first import — every call site already imports something from
// this module before doing terrain raycasts, and patching is a no-op after the
// first call.
ensureBVHPatched();

// ── Per-mesh BVH attach / dispose ──────────────────────────────────────────

export interface AttachBVHOptions {
  /**
   * Strategy for tree construction.
   *  - SAH (default): higher build cost, faster ray queries — best for static
   *    terrain that's built once and queried thousands of times per frame.
   *  - CENTER: cheap to build — use for short-lived meshes you raycast a few
   *    times.
   *  - AVERAGE: middle ground.
   */
  strategy?: 'SAH' | 'CENTER' | 'AVERAGE';
  /** Max triangles per leaf. Default 10. Raise for cheaper build. */
  maxLeafSize?: number;
}

const STRATEGY_MAP: Record<NonNullable<AttachBVHOptions['strategy']>, number> = {
  SAH: 1,      // SAH constant from three-mesh-bvh
  CENTER: 0,   // CENTER constant
  AVERAGE: 2,  // AVERAGE constant
};

/**
 * Attach a BVH to a mesh's geometry. Idempotent — calling twice is a no-op
 * unless the geometry has been mutated.
 *
 * After this returns, every raycast against this mesh runs in O(log n).
 */
export function attachBVH(mesh: THREE.Mesh, opts: AttachBVHOptions = {}): void {
  const geom = mesh.geometry as THREE.BufferGeometry & {
    boundsTree?: MeshBVH;
    computeBoundsTree?: (params?: any) => void;
  };
  if (geom.boundsTree) return;
  // Index is required for BVH; build one if missing.
  if (!geom.index) {
    const count = geom.attributes.position.count;
    const idx: number[] = new Array(count);
    for (let i = 0; i < count; i++) idx[i] = i;
    geom.setIndex(idx);
  }
  geom.computeBoundsTree?.({
    strategy: STRATEGY_MAP[opts.strategy ?? 'SAH'],
    maxLeafSize: opts.maxLeafSize ?? 10,
  });
}

/** Dispose a previously-attached BVH (no-op if none). Always call before
 *  disposing the geometry to free the BVH's typed arrays. */
export function detachBVH(mesh: THREE.Mesh): void {
  const geom = mesh.geometry as THREE.BufferGeometry & {
    boundsTree?: MeshBVH;
    disposeBoundsTree?: () => void;
  };
  if (!geom.boundsTree) return;
  geom.disposeBoundsTree?.();
}

/** Bulk-attach BVH to every Mesh under a Group (skips children that already
 *  have one). Use this on a freshly-built island root. */
export function attachBVHToGroup(root: THREE.Object3D, opts: AttachBVHOptions = {}): number {
  let count = 0;
  root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      attachBVH(o as THREE.Mesh, opts);
      count++;
    }
  });
  return count;
}

/** Mirror of attachBVHToGroup. Call before disposing geometry. */
export function detachBVHFromGroup(root: THREE.Object3D): void {
  root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) detachBVH(o as THREE.Mesh);
  });
}

// ── TerrainPicker — high-level API for ground picks ────────────────────────

const _ndc = new THREE.Vector2();

/**
 * Reusable raycaster bound to a set of terrain meshes. Construct once per
 * scene; call `pickFromMouse(...)` from a pointer event listener.
 */
export class TerrainPicker {
  readonly raycaster = new THREE.Raycaster();
  /** Targets the picker will test. Mutate freely. */
  readonly targets: THREE.Object3D[] = [];

  constructor(targets: Iterable<THREE.Object3D> = []) {
    for (const t of targets) this.targets.push(t);
    // Tell three.js to recurse into Groups when we pass them as targets.
    (this.raycaster as any).firstHitOnly = true; // BVH-only: stop at first hit
  }

  add(target: THREE.Object3D): this { this.targets.push(target); return this; }
  clear(): void { this.targets.length = 0; }

  /**
   * Cast a ray from the pointer through the camera into the scene. Returns
   * the first intersection on any registered target, or null.
   *
   * `ev` may be any object with `.clientX` / `.clientY` and a target element
   * with `getBoundingClientRect()`. Or pass an explicit canvas DOMRect via
   * the `rect` arg if you're picking outside an event.
   */
  pickFromMouse(
    ev: { clientX: number; clientY: number },
    camera: THREE.Camera,
    canvas: HTMLElement,
  ): THREE.Intersection | null {
    const rect = canvas.getBoundingClientRect();
    _ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(_ndc, camera);
    const hits = this.raycaster.intersectObjects(this.targets, true);
    return hits.length ? hits[0] : null;
  }

  /**
   * Cast a ray directly. Useful for AI line-of-sight, foot-on-ground checks,
   * etc. The ray is set on the internal raycaster (no allocation).
   */
  pickRay(origin: THREE.Vector3, direction: THREE.Vector3): THREE.Intersection | null {
    this.raycaster.set(origin, direction);
    const hits = this.raycaster.intersectObjects(this.targets, true);
    return hits.length ? hits[0] : null;
  }

  /**
   * Drop a vertical ray at world-space (x, z) and return the ground height.
   * Returns null if there is no terrain under the point.
   *
   *   const y = picker.heightAt(unit.position.x, unit.position.z);
   *   if (y !== null) unit.position.y = y;
   */
  heightAt(x: number, z: number, fromY = 1e4): number | null {
    this.raycaster.set(
      new THREE.Vector3(x, fromY, z),
      new THREE.Vector3(0, -1, 0),
    );
    const hit = this.raycaster.intersectObjects(this.targets, true);
    return hit.length ? hit[0].point.y : null;
  }
}
