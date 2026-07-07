/**
 * Clip utilities — pure functions over THREE.AnimationClip.
 *
 * The originals are NEVER mutated. Every helper returns a NEW clip you can
 * safely register in the shared library, mutate further, or discard.
 *
 * See `.agents/skills/character-animation/SKILL.md` for the full pattern
 * (esp. why `tracks.shift()` is fragile and what to do instead).
 */

import * as THREE from 'three';
import { normalizeBoneName } from '../animationRetargeting';

/**
 * Default root-bone identifiers across the rig vocabularies we ship.
 * Mixamo uses `mixamorigHips`, BRB uses `Bip01_Pelvis`, the ToonRTS WK rig
 * uses `WK_Pelvis`, and free Sketchfab models often just use `Hips` or
 * `Root`. All of these normalize via `normalizeBoneName()` to one of the
 * tokens below.
 */
const DEFAULT_ROOT_TOKENS: ReadonlySet<string> = new Set([
  'hips',
  'pelvis',
  'root',
  'armature',
]);

/**
 * Strip root-motion tracks from a clip so the character animates "in place".
 *
 * The sbcode tutorial uses `gltf.animations[0].tracks.shift()` for this. That
 * works exactly when the root POSITION track happens to be `tracks[0]` — and
 * is silently catastrophic when it isn't (you'll delete a wrist rotation and
 * the arm will fly off in T-pose).
 *
 * This helper finds the root POSITION track by **bone name**, normalized via
 * the same rules `animationRetargeting` uses. Rotation tracks are kept so
 * the character still rotates in place; only translation is removed.
 *
 *   const idle  = stripRootMotion(rawIdle);          // safe in-place idle
 *   const walk  = stripRootMotion(rawWalk);          // walk treadmill
 *   const samba = stripRootMotion(rawSamba);         // dance treadmill
 *
 * @returns A NEW clip. Original is untouched and may stay in the library.
 */
export function stripRootMotion(
  clip: THREE.AnimationClip,
  rootTokens: ReadonlySet<string> = DEFAULT_ROOT_TOKENS,
): THREE.AnimationClip {
  const kept = clip.tracks.filter(track => {
    // Track names look like "<boneName>.position" or "<boneName>.quaternion".
    // We only care about ".position" tracks targeting the root bone.
    const dotIdx = track.name.lastIndexOf('.');
    if (dotIdx < 0) return true;

    const property = track.name.slice(dotIdx + 1);
    if (property !== 'position') return true;

    const boneName = track.name.slice(0, dotIdx);
    const norm = normalizeBoneName(boneName);
    return !rootTokens.has(norm);
  });

  return new THREE.AnimationClip(clip.name, clip.duration, kept, clip.blendMode);
}

/**
 * Filter a clip down to only the tracks targeting bones whose names START
 * WITH any of the given prefixes. This is the sbcode "clonedRightArm"
 * pattern, made safe and reusable.
 *
 *   const rightArm = filterClipToBones(samba, [
 *     'mixamorigRightShoulder',
 *     'mixamorigRightArm',
 *     'mixamorigRightForeArm',
 *     'mixamorigRightHand',
 *   ]);
 *   // play rightArm on top of an idle base — the rest of the body keeps idling.
 *
 * Prefix matching uses `String.startsWith` against the RAW bone name (so the
 * caller controls vocabulary). For cross-rig fuzzy matching, see
 * `filterClipToNormalizedBones` below.
 */
export function filterClipToBones(
  clip: THREE.AnimationClip,
  bonePrefixes: readonly string[],
): THREE.AnimationClip {
  const kept = clip.tracks.filter(track => {
    const dotIdx = track.name.lastIndexOf('.');
    const boneName = dotIdx < 0 ? track.name : track.name.slice(0, dotIdx);
    return bonePrefixes.some(p => boneName.startsWith(p));
  });

  return new THREE.AnimationClip(
    `${clip.name}__filtered`,
    clip.duration,
    kept,
    clip.blendMode,
  );
}

/**
 * Filter a clip to bones whose NORMALIZED names match any of the tokens.
 * Rig-agnostic version of `filterClipToBones`. Useful when you want "every
 * upper-body track regardless of which prefix vocabulary the source rig
 * used".
 *
 *   const upper = filterClipToNormalizedBones(swordSwing, new Set([
 *     'spine', 'spine1', 'spine2',
 *     'leftshoulder', 'leftarm', 'leftforearm', 'lefthand',
 *     'rightshoulder', 'rightarm', 'rightforearm', 'righthand',
 *     'neck', 'head',
 *   ]));
 */
export function filterClipToNormalizedBones(
  clip: THREE.AnimationClip,
  normalizedTokens: ReadonlySet<string>,
): THREE.AnimationClip {
  const kept = clip.tracks.filter(track => {
    const dotIdx = track.name.lastIndexOf('.');
    const boneName = dotIdx < 0 ? track.name : track.name.slice(0, dotIdx);
    return normalizedTokens.has(normalizeBoneName(boneName));
  });

  return new THREE.AnimationClip(
    `${clip.name}__upper`,
    clip.duration,
    kept,
    clip.blendMode,
  );
}

/**
 * Clone a clip and rename it. Useful when you want two distinct
 * `clipAction()` instances of "the same" animation — three.js keys actions
 * by clip identity, so re-using the SAME clip on the SAME mixer returns the
 * SAME action.
 */
export function cloneClipWithName(
  clip: THREE.AnimationClip,
  newName: string,
): THREE.AnimationClip {
  const c = clip.clone();
  c.name = newName;
  return c;
}
