import * as THREE from 'three';
import type { AssetRole } from './stylizedAssetRegistry';

/**
 * Asset Pipeline
 * ──────────────
 * One pre-pass that every freshly-extracted GLB sub-mesh goes through before
 * it ever hits the scene. Responsibilities:
 *
 *   1. **Material dedup**: a global cache keyed by texture URL + base colour
 *      ensures 184 rocks pulled from the same pack share one MeshStandardMaterial
 *      instead of 184 copies. Big GPU memory + draw-call win.
 *   2. **Leaf alpha fix**: GLB exports often have leaves as `transparent=true`
 *      with no alphaTest, which sorts wrong and bleeds the sky through. We
 *      promote those to `alphaTest=0.45, transparent=false` so they cut
 *      cleanly and get shadowed.
 *   3. **Shadow flags by role**: canopies cast & receive, gems / fire don't
 *      cast (saves shadowmap fill), rocks cast & receive.
 *   4. **Bounding info**: ensure each mesh has a bounding box + sphere so
 *      Three's frustum culler does its job on instances.
 *   5. **Optional uniform fit**: scale a group to a target footprint based
 *      on its role — a safety net for unfamiliar packs whose registry scale
 *      hasn't been hand-tuned yet.
 *
 * The pipeline is idempotent — calling it twice on the same group is a no-op
 * after the first pass (we tag it with `__pipelineProcessed`).
 */

// ─── Material dedup cache ────────────────────────────────────────────
type MaterialKey = string;
const materialCache = new Map<MaterialKey, THREE.Material>();

function keyForMaterial(mat: THREE.Material): MaterialKey {
  if (!mat) return 'null';
  const m = mat as THREE.MeshStandardMaterial;
  const tex = (t: THREE.Texture | null | undefined) => (t?.image as any)?.src || (t?.uuid ?? '');
  const color = m.color ? `${m.color.getHexString()}` : '';
  return [
    mat.type,
    color,
    tex(m.map),
    tex(m.normalMap),
    tex(m.roughnessMap),
    tex(m.metalnessMap),
    tex((m as any).emissiveMap),
    m.side,
    m.transparent ? 't' : 'o',
  ].join('|');
}

function dedupMaterial(mat: THREE.Material): THREE.Material {
  const key = keyForMaterial(mat);
  const cached = materialCache.get(key);
  if (cached) return cached;
  materialCache.set(key, mat);
  return mat;
}

// ─── Leaf detection (heuristic — name or transparent map) ────────────
function looksLikeLeaves(mesh: THREE.Mesh): boolean {
  const n = (mesh.name || '').toLowerCase();
  const matName = ((mesh.material as THREE.Material)?.name || '').toLowerCase();
  if (/(leaf|leaves|foliage|folha|canop|grass|bush)/.test(n)) return true;
  if (/(leaf|leaves|foliage|folha|canop)/.test(matName)) return true;
  const m = mesh.material as THREE.MeshStandardMaterial;
  if (m && m.transparent && m.map) return true;
  return false;
}

function fixLeafMaterial(mat: THREE.MeshStandardMaterial) {
  if (!mat) return;
  if (mat.map) {
    mat.alphaTest = mat.alphaTest > 0 ? mat.alphaTest : 0.45;
    mat.transparent = false;
    mat.depthWrite = true;
    mat.side = THREE.DoubleSide;       // leaves visible from underside
  }
}

// ─── Role-based shadow / fit defaults ────────────────────────────────
const ROLE_DEFAULTS: Record<AssetRole, { cast: boolean; receive: boolean; targetHeight?: number; maxHeight?: number }> = {
  canopy:        { cast: true,  receive: true,  maxHeight: 18 },
  understory:    { cast: true,  receive: true,  maxHeight: 4  },
  rock:          { cast: true,  receive: true,  maxHeight: 6  },
  gem:           { cast: false, receive: true,  maxHeight: 2  },
  ice_prop:      { cast: true,  receive: true,  maxHeight: 4  },
  ice_landmark:  { cast: true,  receive: true,  maxHeight: 12 },
  frozen_log:    { cast: true,  receive: true,  maxHeight: 3  },
  fire_landmark: { cast: false, receive: false, maxHeight: 8  },
  shore_debris:  { cast: true,  receive: true,  maxHeight: 1.5 },
  critter:       { cast: true,  receive: true,  maxHeight: 1.2 },
  predator:      { cast: true,  receive: true,  maxHeight: 1.6 },
  big_critter:   { cast: true,  receive: true,  maxHeight: 1.4 },
};

// ─── Public API ──────────────────────────────────────────────────────

export interface PrepareOptions {
  /** Optional asset role — turns on shadow tuning + max-height clamp. */
  role?: AssetRole;
  /** When true, force a uniform scale so the group's bbox fits the role's maxHeight. */
  fitToRole?: boolean;
}

/** Run the asset pipeline on a freshly extracted group. Idempotent. */
export function prepareAsset(group: THREE.Group, opts: PrepareOptions = {}): THREE.Group {
  if (!group) return group;
  if ((group as any).userData?.__pipelineProcessed) return group;

  const defaults = opts.role ? ROLE_DEFAULTS[opts.role] : null;

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    // Material processing
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => {
        if (looksLikeLeaves(mesh)) fixLeafMaterial(m as THREE.MeshStandardMaterial);
        return dedupMaterial(m);
      });
    } else if (mesh.material) {
      if (looksLikeLeaves(mesh)) fixLeafMaterial(mesh.material as THREE.MeshStandardMaterial);
      mesh.material = dedupMaterial(mesh.material);
    }

    // Shadow flags (role overrides)
    if (defaults) {
      mesh.castShadow    = defaults.cast;
      mesh.receiveShadow = defaults.receive;
    }

    // Ensure bounding info exists for frustum culling
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (geom) {
      if (!geom.boundingBox)    geom.computeBoundingBox();
      if (!geom.boundingSphere) geom.computeBoundingSphere();
    }
  });

  // Optional uniform fit-to-role
  if (opts.fitToRole && defaults?.maxHeight) {
    const box = new THREE.Box3().setFromObject(group);
    const h = box.max.y - box.min.y;
    if (isFinite(h) && h > defaults.maxHeight) {
      const s = defaults.maxHeight / h;
      group.scale.multiplyScalar(s);
    }
  }

  (group.userData as any).__pipelineProcessed = true;
  return group;
}

/**
 * Shareable shadow-cast tuning for a SkinnedMesh group (animals).
 * Skinned meshes need their own bone-based bounding sphere refresh, which
 * we enable here so they don't pop in/out at the screen edges.
 */
export function prepareAnimal(scene: THREE.Group, role: AssetRole = 'critter'): THREE.Group {
  if (!scene) return scene;
  if ((scene as any).userData?.__pipelineProcessed) return scene;
  const defaults = ROLE_DEFAULTS[role];
  scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = defaults.cast;
      m.receiveShadow = defaults.receive;
      // Skinned meshes need this for proper culling once animated.
      const sk = m as THREE.SkinnedMesh;
      if (sk.isSkinnedMesh) {
        sk.frustumCulled = false; // simpler than maintaining bone bounds
      }
      const g = m.geometry as THREE.BufferGeometry;
      if (g && !g.boundingSphere) g.computeBoundingSphere();
    }
  });
  (scene.userData as any).__pipelineProcessed = true;
  return scene;
}

/** Diagnostic: how many unique materials are currently shared across all assets. */
export function getMaterialDedupStats() {
  return { uniqueMaterials: materialCache.size };
}
