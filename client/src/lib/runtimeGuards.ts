/**
 * runtimeGuards — small defensive monkey-patches applied once at app startup.
 *
 * These don't change anything about how the engine works on the happy path.
 * They only stop two long-standing dispose / async-load races from popping
 * the runtime error overlay and breaking the render loop:
 *
 *   1. THREE.Skeleton.update() crashes with
 *      "Cannot read properties of undefined (reading 'elements')"
 *      when a SkinnedMesh's mixer ticks for one frame after the underlying
 *      bones have been disposed (common when a character preview swaps
 *      models, or when a scene unmounts mid-animation). The vanilla
 *      implementation does `bones[i] ? bones[i].matrixWorld : identity`,
 *      which still returns `undefined` if the bone object survived but its
 *      `matrixWorld` was nulled. We swap in a version that falls through to
 *      the identity matrix in that case so the next frame is a no-op
 *      instead of a render-loop crash.
 *
 *   2. THREE.FBXLoader.load() calls its `onError` callback when an embedded
 *      texture fails to fetch, but most call-sites in this project only
 *      pass `onLoad`, leaving `onError` undefined. The minified bundle
 *      then throws "error2 is not a function" from inside an async
 *      success callback, which surfaces as an unhandled promise rejection.
 *      We wrap `load` so a default no-op `onError` is injected when none
 *      was supplied — failures are still console.warn-ed for debugging.
 *
 * Import this module exactly once from `main.tsx` *before* `<App />` is
 * rendered. It is idempotent and safe to import multiple times.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const FLAG = '__tethical_runtime_guards_installed__';

interface FlaggedGlobal {
  [FLAG]?: boolean;
}

export function installRuntimeGuards(): void {
  const g = globalThis as unknown as FlaggedGlobal;
  if (g[FLAG]) return;
  g[FLAG] = true;

  patchSkeletonUpdate();
  patchFbxLoaderLoad();
  patchConsoleWarn();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. console.warn — filter Three.js's unactionable skinning-weight spam
// ─────────────────────────────────────────────────────────────────────────────
// Toon-RTS FBX meshes author >4 bone influences per vertex. Three.js only
// supports 4, so FBXLoader logs "Vertex has more than 4 skinning weights …"
// once per offending mesh during parse — dozens of identical lines that bury
// real errors. The message fires deep inside the loader before any call-site
// sees the result, so the only way to silence it is to drop that exact line.
// We renormalize the surviving weights ourselves (fbxModelLoader.ts), so the
// dropped influences are handled correctly — the warning is pure noise.
function patchConsoleWarn(): void {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('THREE.FBXLoader') &&
      args[0].includes('more than 4 skinning weights')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THREE.Skeleton.update — defensive bone matrix lookup
// ─────────────────────────────────────────────────────────────────────────────
function patchSkeletonUpdate(): void {
  const proto = THREE.Skeleton.prototype as unknown as {
    update: () => void;
    bones: THREE.Bone[];
    boneInverses: THREE.Matrix4[];
    boneMatrices: Float32Array;
    boneTexture?: { needsUpdate: boolean } | null;
  };

  const identity = new THREE.Matrix4();
  const offset   = new THREE.Matrix4();

  proto.update = function patchedSkeletonUpdate() {
    const bones        = this.bones;
    const boneInverses = this.boneInverses;
    const boneMatrices = this.boneMatrices;

    for (let i = 0, il = bones.length; i < il; i++) {
      const bone = bones[i];
      // Defensive: bone may be missing or have a null matrixWorld if its
      // owning mesh was disposed mid-animation. Fall back to identity.
      const matrix = bone && bone.matrixWorld ? bone.matrixWorld : identity;
      const inv    = boneInverses[i] ?? identity;
      offset.multiplyMatrices(matrix, inv);
      offset.toArray(boneMatrices, i * 16);
    }

    if (this.boneTexture) this.boneTexture.needsUpdate = true;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FBXLoader.load — auto-inject a no-op onError when none provided
// ─────────────────────────────────────────────────────────────────────────────
function patchFbxLoaderLoad(): void {
  type LoadFn = (
    url: string,
    onLoad: (group: THREE.Group) => void,
    onProgress?: (e: ProgressEvent<EventTarget>) => void,
    onError?: (e: unknown) => void,
  ) => void;

  const proto = FBXLoader.prototype as unknown as { load: LoadFn };
  const originalLoad: LoadFn = proto.load;

  proto.load = function patchedFbxLoad(url, onLoad, onProgress, onError) {
    const safeOnError = onError ?? ((err: unknown) => {
      // Don't blow up the render loop or surface as unhandled rejection.
      // Failures here are usually missing embedded textures referenced by
      // the FBX; the mesh itself still loads fine.
      console.warn('[FBXLoader] load failed for', url, err);
    });
    return originalLoad.call(this, url, onLoad, onProgress, safeOnError);
  };
}
