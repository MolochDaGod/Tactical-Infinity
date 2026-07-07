import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface PackDefinition {
  id: string;
  url: string;
  lazy?: boolean;
  skinned?: boolean;
}

interface LoadedPack {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  meshIndex: Map<string, THREE.Mesh>;
}

export type MeshPredicate = (name: string) => boolean;

export class StylizedPackLoader {
  private static _instance: StylizedPackLoader | null = null;
  static get instance(): StylizedPackLoader {
    if (!this._instance) this._instance = new StylizedPackLoader();
    return this._instance;
  }

  private loader = new GLTFLoader();
  private packs = new Map<string, PackDefinition>();
  private cache = new Map<string, LoadedPack>();
  private inflight = new Map<string, Promise<LoadedPack>>();
  /**
   * URLs that 404'd or returned non-GLB content (e.g. the SPA's index.html
   * fallback). Once a pack is in here we never try to fetch it again — the
   * caller gets `null` and uses its procedural fallback. Keeps the dev
   * console quiet when assets get rotated out of `attached_assets/`.
   */
  private knownDead = new Set<string>();

  registerPack(def: PackDefinition): void {
    this.packs.set(def.id, def);
  }

  registerPacks(defs: PackDefinition[]): void {
    for (const d of defs) this.registerPack(d);
  }

  isLoaded(id: string): boolean {
    return this.cache.has(id);
  }

  /** True if this pack URL has been confirmed missing / serving HTML. */
  isDead(id: string): boolean {
    const def = this.packs.get(id);
    return !!def && this.knownDead.has(def.url);
  }

  /**
   * One batched HEAD probe across every registered pack URL. Marks any
   * URL that returns non-OK or text/html as dead so subsequent loadPack /
   * isLoaded callers short-circuit silently. Safe to call repeatedly —
   * cached on first run.
   */
  private prunePromise: Promise<void> | null = null;
  async pruneDeadPacks(): Promise<void> {
    if (this.prunePromise) return this.prunePromise;
    this.prunePromise = (async () => {
      const entries = Array.from(this.packs.values());
      await Promise.allSettled(
        entries.map(async (def) => {
          if (this.knownDead.has(def.url)) return;
          try {
            const res = await fetch(def.url, { method: 'HEAD' });
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || ct.includes('text/html')) {
              this.knownDead.add(def.url);
            }
          } catch {
            this.knownDead.add(def.url);
          }
        })
      );
      const deadCount = entries.filter((d) => this.knownDead.has(d.url)).length;
      if (deadCount > 0) {
        console.info(`[StylizedPack] startup prune: ${deadCount}/${entries.length} packs unavailable, falling back to procedural`);
      }
    })();
    return this.prunePromise;
  }

  async loadPack(id: string): Promise<LoadedPack | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const inflight = this.inflight.get(id);
    if (inflight) return inflight;
    const def = this.packs.get(id);
    if (!def) {
      console.warn(`[StylizedPack] Unknown pack id: ${id}`);
      return null;
    }
    if (this.knownDead.has(def.url)) return null;

    // HEAD-probe first so we don't hand a 404'd HTML body to GLTFLoader
    // (the resulting "Unexpected token '<'" parse error is alarming and
    // useless). If the asset is missing, mark it dead silently and let the
    // caller fall back to procedural geometry.
    try {
      const head = await fetch(def.url, { method: 'HEAD' });
      const ct = head.headers.get('content-type') || '';
      if (!head.ok || ct.includes('text/html')) {
        // Mark dead silently — the batched prune (pruneDeadPacks) emits a
        // single aggregate summary, so per-pack logging here would just
        // flood the console with one line per rotated-out asset.
        this.knownDead.add(def.url);
        return null;
      }
    } catch {
      this.knownDead.add(def.url);
      return null;
    }

    const p = new Promise<LoadedPack>((resolve, reject) => {
      this.loader.load(
        def.url,
        (gltf) => {
          const meshIndex = new Map<string, THREE.Mesh>();
          gltf.scene.traverse((child) => {
            const m = child as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
              meshIndex.set(child.name, m);
            }
          });
          const loaded: LoadedPack = {
            scene: gltf.scene,
            clips: gltf.animations || [],
            meshIndex,
          };
          this.cache.set(id, loaded);
          this.inflight.delete(id);
          resolve(loaded);
        },
        undefined,
        (err) => {
          this.inflight.delete(id);
          this.knownDead.add(def.url);
          console.info(`[StylizedPack] decode failed, using fallback: ${def.url}`);
          reject(err);
        }
      );
    });
    this.inflight.set(id, p);
    return p.catch(() => null) as Promise<LoadedPack | null>;
  }

  /** Preload only the non-lazy packs in parallel. */
  async preloadAll(): Promise<void> {
    const toLoad = Array.from(this.packs.values()).filter((p) => !p.lazy);
    await Promise.allSettled(toLoad.map((p) => this.loadPack(p.id)));
  }

  /**
   * Extract one or more meshes from a pack into a fresh group, baking the
   * mesh's world transform into local position/quaternion/scale so the result
   * sits at the origin oriented correctly. Use for STATIC props.
   */
  extractStatic(packId: string, predicate: MeshPredicate): THREE.Group | null {
    const pack = this.cache.get(packId);
    if (!pack) return null;
    pack.scene.updateMatrixWorld(true);
    const out = new THREE.Group();
    out.name = `pack_${packId}`;
    let any = false;
    pack.scene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      if (!predicate(child.name)) return;
      any = true;
      const cloned = m.clone();
      cloned.castShadow = true;
      cloned.receiveShadow = true;
      // Bake world matrix into local TRS, then re-center the group later if asked.
      const wm = new THREE.Matrix4().copy(m.matrixWorld);
      cloned.matrix.copy(wm);
      cloned.matrix.decompose(cloned.position, cloned.quaternion, cloned.scale);
      cloned.matrixAutoUpdate = true;
      out.add(cloned);
    });
    if (!any) return null;
    // Re-center the group at the bottom-front of its bounding box so scatter
    // logic can place it on terrain without trial-and-error y offsets.
    this.centerGroupOnGround(out);
    return out;
  }

  /**
   * Clone a skinned/animated pack root in full (animals: boar, ibex, etc.).
   * Returns the cloned scene and the original animation clips (clips are
   * shareable across clones — feed them straight into AnimationMixer).
   */
  extractAnimated(packId: string): { scene: THREE.Group; clips: THREE.AnimationClip[] } | null {
    const pack = this.cache.get(packId);
    if (!pack) return null;
    const scene = SkeletonUtils.clone(pack.scene) as THREE.Group;
    scene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return { scene, clips: pack.clips };
  }

  /**
   * Frame-pack helper: returns an array of mesh references in numerical order.
   * Use for visibility-frame animations like the stylized fire loop where
   * each frame is a separate mesh named Cube_003_2_NNN.
   */
  extractFrameSequence(packId: string, prefix: string): THREE.Mesh[] | null {
    const pack = this.cache.get(packId);
    if (!pack) return null;
    const matches: { idx: number; mesh: THREE.Mesh }[] = [];
    pack.meshIndex.forEach((mesh, name) => {
      if (!name.startsWith(prefix)) return;
      const tail = name.slice(prefix.length);
      const n = parseInt(tail.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n)) matches.push({ idx: n, mesh });
    });
    matches.sort((a, b) => a.idx - b.idx);
    return matches.length ? matches.map((m) => m.mesh) : null;
  }

  /** Convenience: get raw mesh list from cache (no clone). */
  getMeshNames(packId: string): string[] {
    const pack = this.cache.get(packId);
    if (!pack) return [];
    return Array.from(pack.meshIndex.keys());
  }

  /**
   * Re-center a group so its XZ centroid is at origin and its lowest Y point
   * sits at y=0 — perfect for placing on terrain.
   */
  private centerGroupOnGround(group: THREE.Group): void {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    if (!isFinite(box.min.y) || !isFinite(box.max.y)) return;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const minY = box.min.y;
    group.children.forEach((child) => {
      child.position.x -= cx;
      child.position.z -= cz;
      child.position.y -= minY;
    });
  }
}

export const stylizedPacks = StylizedPackLoader.instance;
