// Animation Retargeting
//
// All BRB / Toon_RTS animation FBX files are authored against the BRB master
// skeleton. When you load one of those clips and play it on a *different*
// race's mixer (WK / DWF / ELF / ORC / UD), the clip's track names look like
//   "Bip01_Spine.quaternion"
// but the target skeleton's bones are named
//   "Spine"           (or "WK_Spine" / "DWF_Spine" / "mixamorig:Spine" / ...)
//
// Three.js's PropertyBinding parses each track as "<boneName>.<property>" and
// silently drops the track when no matching bone is found. The visible
// symptom is exactly what the user described: the character renders but the
// animation "has no body attached" — it plays silently because every track
// missed.
//
// This module fixes that with a small bone-name normalizer + a clip
// retargeter that rewrites track names onto the target skeleton.

import * as THREE from "three";

// Normalize a bone name so the same logical bone matches across rigs.
//   "Bip01_Spine"     -> "spine"
//   "mixamorig:Spine" -> "spine"
//   "BRB_Spine_01"    -> "spine01"
//   "Spine"           -> "spine"
const NAMESPACE_PREFIXES = /^(mixamorig:?|bip\d+_?|brb_|wk_|dwf_|elf_|elv_|orc_|ud_|und_)/i;

export function normalizeBoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(NAMESPACE_PREFIXES, "")
    .replace(/[:_\-\s]/g, "");
}

// ── Semantic (cross-vocabulary) bone mapping ───────────────────────────────
//
// `normalizeBoneName` only bridges rigs that use the SAME anatomical words
// (it just strips namespaces + punctuation). It CANNOT bridge:
//
//   3ds Max Biped : "Bip001 L UpperArm"  "Bip001 L Thigh"  "Bip001 Pelvis"
//   Mixamo        : "mixamorig:LeftArm"  "mixamorig:LeftUpLeg" "mixamorig:Hips"
//   KayKit        : "upperarm.l"         "upperleg.l"          "hips"
//
// All three describe the SAME skeleton but with different words
// (UpperArm = Arm, Thigh = UpLeg = upperleg, Calf = Leg = lowerleg,
// Clavicle = Shoulder, Pelvis = Hips, Toe0 = ToeBase). The Toon-RTS race
// meshes are Biped rigs; the complete animation libraries we ship (Mixamo
// locomotion + sword/bow/magic sets) are Mixamo rigs. Without a semantic
// alias every track misses → T-pose. `canonicalBoneName` maps any of the
// three vocabularies onto a single canonical token so the retargeter can
// pair them.

const SEMANTIC_PREFIX = /^(mixamorig:?|bip\d+\s*|brb[ _]?|wk[ _]?|dwf[ _]?|elf[ _]?|elv[ _]?|orc[ _]?|ud[ _]?|und[ _]?)/i;

function detectSide(s: string): "l" | "r" | "" {
  if (/^left/.test(s)) return "l";
  if (/^right/.test(s)) return "r";
  if (/(^|[ ._:\-])l([ ._:\-]|$)/.test(s)) return "l";
  if (/(^|[ ._:\-])r([ ._:\-]|$)/.test(s)) return "r";
  return "";
}

function detectPart(s: string): string {
  const c = s.replace(/[ ._:\-]/g, "");
  // Non-skeletal / helper / attachment / finger nodes we never animate.
  if (!c || /footstep|nub|end$|^bip\d*$|twist|roll|ik$|pole|target/.test(c)) return "";
  if (/index|thumb|pinky|ring|middle|finger/.test(c)) return "";
  if (/slot|container|prop|attach|^bone/.test(c)) return "";
  // Order matters: more specific words first.
  if (/forearm/.test(c)) return "forearm";
  if (/upperarm/.test(c) || /arm/.test(c)) return "arm";
  if (/clavicle|shoulder/.test(c)) return "shoulder";
  if (/hand/.test(c)) return "hand";
  if (/thigh|upleg|upperleg/.test(c)) return "upleg";
  if (/calf|lowerleg/.test(c) || /leg/.test(c)) return "leg";
  if (/foot|ankle/.test(c)) return "foot";
  if (/toe/.test(c)) return "toe";
  if (/pelvis|hips|^hip/.test(c)) return "hips";
  if (/spine2|upperchest|chest/.test(c)) return "spine2";
  if (/spine1/.test(c)) return "spine1";
  if (/spine/.test(c)) return "spine";
  if (/neck/.test(c)) return "neck";
  if (/head/.test(c)) return "head";
  return "";
}

/**
 * Map a bone name from ANY of our rig vocabularies (Biped / Mixamo / KayKit)
 * onto a single canonical humanoid token (e.g. "larm", "rupleg", "hips",
 * "spine"). Returns "" for non-skeletal helper/finger/attachment nodes so the
 * caller can skip them. Central bones (hips/spine/neck/head) carry no side.
 */
export function canonicalBoneName(name: string): string {
  const s = name.toLowerCase().replace(SEMANTIC_PREFIX, "").trim();
  const part = detectPart(s);
  if (!part) return "";
  const central =
    part === "hips" || part === "spine" || part === "spine1" ||
    part === "spine2" || part === "neck" || part === "head";
  if (central) return part;
  const side = detectSide(s);
  return side ? side + part : part;
}

/**
 * The set of lookup keys for a bone, in priority order: exact-normalized
 * first (so same-vocabulary rigs — e.g. Biped→Biped in captainManager —
 * keep their existing 1:1 behavior), then the cross-vocabulary canonical key
 * as a fallback bridge.
 */
function boneKeys(name: string): string[] {
  const keys: string[] = [];
  const norm = normalizeBoneName(name);
  if (norm) keys.push(norm);
  const canon = canonicalBoneName(name);
  if (canon && canon !== norm) keys.push(canon);
  return keys;
}

function lookupBone<T>(map: Map<string, T>, name: string): T | undefined {
  for (const key of boneKeys(name)) {
    const hit = map.get(key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export interface RetargetReport {
  totalTracks: number;
  remapped: number;
  unmatched: string[];
  targetBoneCount: number;
}

/** Build a `normalized -> actual` bone-name map from a target skeleton root. */
export function buildTargetBoneMap(targetRoot: THREE.Object3D): Map<string, string> {
  const map = new Map<string, string>();
  targetRoot.traverse((child) => {
    const isBone = (child as THREE.Bone).isBone === true || child.type === "Bone";
    if (!isBone) return;
    // Register both the exact-normalized key and the cross-vocabulary
    // canonical key so a Mixamo/KayKit clip can resolve onto this Biped rig.
    for (const key of boneKeys(child.name)) {
      if (!map.has(key)) map.set(key, child.name);
    }
  });
  return map;
}

/**
 * Retarget a clip's track names onto a target skeleton.
 * Returns a NEW clip (the original is untouched, so it can be cached and
 * retargeted separately for each race). Tracks whose bone names cannot be
 * matched are kept verbatim — three.js will skip them at bind time the same
 * way it does today.
 */
export function retargetClip(
  clip: THREE.AnimationClip,
  targetRoot: THREE.Object3D,
  report?: RetargetReport,
): THREE.AnimationClip {
  const targetBones = buildTargetBoneMap(targetRoot);
  if (targetBones.size === 0) return clip;

  const newTracks: THREE.KeyframeTrack[] = [];
  let remapped = 0;
  const unmatched: string[] = [];

  for (const track of clip.tracks) {
    // Track name format: "<bonePath>.<property>" or "<bonePath>.<property>[N]"
    // We only need to rewrite the bone path (everything before the LAST dot
    // that precedes a known property). Properties live at the leaf, so the
    // last "." is the safe split point.
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) { newTracks.push(track); continue; }

    const bonePath = track.name.slice(0, dot);
    const property = track.name.slice(dot); // includes leading "."
    // Bone path can be nested ("Armature/Hips/Spine") — we retarget by the
    // LEAF bone, since three.js binds by node name search.
    const slash = bonePath.lastIndexOf("/");
    const leaf = slash >= 0 ? bonePath.slice(slash + 1) : bonePath;

    const targetName = lookupBone(targetBones, leaf);

    if (targetName) {
      if (targetName !== leaf) {
        const cloned = track.clone();
        cloned.name = targetName + property;
        newTracks.push(cloned);
        remapped++;
      } else {
        newTracks.push(track);
      }
    } else {
      // Drop unmatched tracks (fingers, extra spine joints, helper nodes)
      // rather than keep them verbatim — otherwise three.js floods the
      // console with "no target node found" warnings at bind time.
      unmatched.push(leaf);
    }
  }

  if (report) {
    report.totalTracks   = clip.tracks.length;
    report.remapped      = remapped;
    report.unmatched     = unmatched;
    report.targetBoneCount = targetBones.size;
  }

  const out = new THREE.AnimationClip(clip.name, clip.duration, newTracks, clip.blendMode);
  return out;
}

/**
 * Convenience: retarget a whole animation map in place onto a target.
 * Returns a new map; the input is not mutated.
 */
export function retargetClipMap<K extends string>(
  clips: Partial<Record<K, THREE.AnimationClip>>,
  targetRoot: THREE.Object3D,
): Partial<Record<K, THREE.AnimationClip>> {
  const out: Partial<Record<K, THREE.AnimationClip>> = {};
  for (const [name, clip] of Object.entries(clips) as [K, THREE.AnimationClip | undefined][]) {
    if (!clip) continue;
    out[name] = retargetClip(clip, targetRoot);
  }
  return out;
}

// ── T-pose retargeting (Mixamo + BRB rig --> any race) ─────────────────────
//
// All Toon RTS animation FBX files are Mixamo motions baked onto a BRB-shaped
// skeleton (the studio uploaded a BRB character to Mixamo as the source rig).
// Bone NAMES therefore match across races (after normalization) but the rest
// pose ORIENTATIONS do not — a BRB Spine bone may sit at a different local
// quaternion than an ELF Spine in T-pose. Playing a BRB-baked clip raw on an
// ELF mixer makes joints twist around wrong axes.
//
// The fix is the canonical T-pose retargeting formula. For each animated
// bone B with matching name on both sides:
//
//   sRest = source bone B local quat in source T-pose
//   tRest = target bone B local quat in target T-pose
//   sCur  = clip's animated local quat at time t
//
//   tCur  = tRest * sRest⁻¹ * sCur                 (quaternion track)
//   tPos  = tRest_pos + (sPos - sRest_pos) * scale (position track, Hips)
//
// `scale` accounts for size differences between the source skeleton and the
// target (different races have different stature). It's estimated from the
// world-Y span of each skeleton's bones.

function collectBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  root.traverse((child) => {
    const isBone = (child as THREE.Bone).isBone === true || child.type === "Bone";
    if (isBone) bones.push(child as THREE.Bone);
  });
  return bones;
}

function estimateSkeletonHeight(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const bones = collectBones(root);
  if (bones.length === 0) return 1;
  let minY = Infinity;
  let maxY = -Infinity;
  const wp = new THREE.Vector3();
  for (const b of bones) {
    b.getWorldPosition(wp);
    if (wp.y < minY) minY = wp.y;
    if (wp.y > maxY) maxY = wp.y;
  }
  const span = maxY - minY;
  return span > 1e-6 ? span : 1;
}

function rebakeQuaternionTrack(
  track: THREE.QuaternionKeyframeTrack,
  sourceBone: THREE.Bone,
  targetBone: THREE.Bone,
  newName: string,
): THREE.QuaternionKeyframeTrack {
  const sRestInv = sourceBone.quaternion.clone().invert();
  // offset = tRest * sRest⁻¹  (precomputed once per bone)
  const offset = targetBone.quaternion.clone().multiply(sRestInv);

  const src = track.values;
  const out = new Float32Array(src.length);
  const q = new THREE.Quaternion();
  for (let i = 0; i < src.length; i += 4) {
    q.set(src[i], src[i + 1], src[i + 2], src[i + 3]);
    // tCur = offset * sCur = (tRest * sRest⁻¹) * sCur
    q.premultiply(offset);
    out[i]     = q.x;
    out[i + 1] = q.y;
    out[i + 2] = q.z;
    out[i + 3] = q.w;
  }
  // Times array passed as plain array for ctor compatibility across THREE versions
  return new THREE.QuaternionKeyframeTrack(newName, Array.from(track.times), Array.from(out));
}

function rebakePositionTrack(
  track: THREE.VectorKeyframeTrack,
  sourceBone: THREE.Bone,
  targetBone: THREE.Bone,
  scale: number,
  newName: string,
): THREE.VectorKeyframeTrack {
  const sRest = sourceBone.position;
  const tRest = targetBone.position;
  const src = track.values;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    out[i]     = tRest.x + (src[i]     - sRest.x) * scale;
    out[i + 1] = tRest.y + (src[i + 1] - sRest.y) * scale;
    out[i + 2] = tRest.z + (src[i + 2] - sRest.z) * scale;
  }
  return new THREE.VectorKeyframeTrack(newName, Array.from(track.times), Array.from(out));
}

/**
 * T-pose retargeter. Both `sourceRoot` and `targetRoot` MUST be in their
 * respective bind poses (Mixamo always exports T-pose, so this holds for any
 * freshly-loaded animation FBX). Walks every track in the clip, finds the
 * matching bone on both sides via normalized-name lookup, and rebakes
 * keyframe values through the per-bone rest offset.
 *
 * Returns a NEW clip — the original (and both skeletons) are not mutated.
 */
export function retargetClipTPose(
  clip: THREE.AnimationClip,
  sourceRoot: THREE.Object3D,
  targetRoot: THREE.Object3D,
  report?: RetargetReport,
): THREE.AnimationClip {
  // Key each skeleton by BOTH the exact-normalized name and the canonical
  // cross-vocabulary token. For same-vocabulary rigs (Biped→Biped, the
  // captainManager case) the normalized key matches 1:1 exactly as before;
  // for Mixamo→Biped the canonical key bridges "LeftArm"↔"Bip001 L UpperArm".
  const sourceByKey = new Map<string, THREE.Bone>();
  for (const b of collectBones(sourceRoot)) {
    for (const k of boneKeys(b.name)) if (!sourceByKey.has(k)) sourceByKey.set(k, b);
  }
  const targetByKey = new Map<string, THREE.Bone>();
  for (const b of collectBones(targetRoot)) {
    for (const k of boneKeys(b.name)) if (!targetByKey.has(k)) targetByKey.set(k, b);
  }

  // Nothing to retarget against — fall back to name-only.
  if (sourceByKey.size === 0 || targetByKey.size === 0) {
    return retargetClip(clip, targetRoot, report);
  }

  const positionScale = estimateSkeletonHeight(targetRoot) / estimateSkeletonHeight(sourceRoot);

  const newTracks: THREE.KeyframeTrack[] = [];
  let remapped = 0;
  const unmatched: string[] = [];

  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) { newTracks.push(track); continue; }

    const bonePath = track.name.slice(0, dot);
    const property = track.name.slice(dot);
    const slash = bonePath.lastIndexOf("/");
    const leaf = slash >= 0 ? bonePath.slice(slash + 1) : bonePath;

    const sourceBone = lookupBone(sourceByKey, leaf);
    const targetBone = lookupBone(targetByKey, leaf);

    if (!targetBone) {
      // Drop unmatched tracks (fingers, extra spine joints) instead of
      // keeping them verbatim — avoids three.js bind-time warning spam.
      unmatched.push(leaf);
      continue;
    }

    const newName = targetBone.name + property;

    // Source bone missing -> can't compute offset; rename only.
    if (!sourceBone) {
      const renamed = track.clone();
      renamed.name = newName;
      newTracks.push(renamed);
      remapped++;
      continue;
    }

    if (property === ".quaternion" && track instanceof THREE.QuaternionKeyframeTrack) {
      newTracks.push(rebakeQuaternionTrack(track, sourceBone, targetBone, newName));
      remapped++;
    } else if (property === ".position" && track instanceof THREE.VectorKeyframeTrack) {
      newTracks.push(rebakePositionTrack(track, sourceBone, targetBone, positionScale, newName));
      remapped++;
    } else {
      // Scale tracks (rare) and any others — just rename.
      const renamed = track.clone();
      renamed.name = newName;
      newTracks.push(renamed);
      remapped++;
    }
  }

  if (report) {
    report.totalTracks   = clip.tracks.length;
    report.remapped      = remapped;
    report.unmatched     = unmatched;
    report.targetBoneCount = targetByKey.size;
  }

  return new THREE.AnimationClip(clip.name, clip.duration, newTracks, clip.blendMode);
}

/**
 * Strip any extra meshes/skeletons that came along inside an animation FBX.
 * Animation FBX files are typically authored with the source rig embedded for
 * preview in a DCC tool. We don't want that geometry — only the AnimationClip
 * tracks. Returns just the clips so the caller can discard the wrapper Group.
 */
export function extractClipsOnly(fbx: THREE.Group): THREE.AnimationClip[] {
  return fbx.animations ?? [];
}
