/**
 * Root lock — freeze hips/pelvis local XYZ after mixer updates so the
 * controller owns world position (no clip teleports / hip drift).
 *
 * Policy:
 *   • stripRootMotion at load removes translation tracks when possible
 *   • rootLock is a runtime safety net for residual position tracks
 *   • rotation stays free so turn-in-place and twist still work
 */

import * as THREE from "three";
import { normalizeBoneName } from "../animationRetargeting";

const ROOT_TOKENS = new Set(["hips", "pelvis", "root"]);

export interface RootLockHandle {
  /** Call after every `mixer.update(dt)`. */
  apply(): void;
  /** Re-capture bind pose (e.g. after scale/fit). */
  recapture(): void;
  /** Target bone, if found. */
  bone: THREE.Bone | null;
}

function findRootBone(root: THREE.Object3D): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (found) return;
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    const n = normalizeBoneName(b.name);
    if (ROOT_TOKENS.has(n)) found = b;
  });
  return found;
}

/**
 * Capture the bind-pose local position of the hips/pelvis and re-apply it
 * after animation each frame. Controller continues to own the root Group XYZ.
 */
export function createRootLock(skeletonRoot: THREE.Object3D): RootLockHandle {
  const bone = findRootBone(skeletonRoot);
  const bind = new THREE.Vector3();
  if (bone) bind.copy(bone.position);

  return {
    bone,
    recapture() {
      if (bone) bind.copy(bone.position);
    },
    apply() {
      if (!bone) return;
      bone.position.copy(bind);
    },
  };
}

/**
 * One-shot: lock horizontal (X/Z) root position tracks on a clip to frame 0,
 * preserving vertical bob. Mutates a CLONE — original is untouched.
 */
export function lockHorizontalRootClip(
  clip: THREE.AnimationClip,
  rootTokens: ReadonlySet<string> = ROOT_TOKENS,
): THREE.AnimationClip {
  const out = clip.clone();
  for (const track of out.tracks) {
    if (!track.name.endsWith(".position")) continue;
    const boneName = track.name.slice(0, track.name.lastIndexOf("."));
    const norm = normalizeBoneName(boneName);
    if (!rootTokens.has(norm)) continue;
    const values = track.values;
    if (values.length < 3) continue;
    const x0 = values[0];
    const z0 = values[2];
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0;
      values[i + 2] = z0;
    }
  }
  return out;
}
