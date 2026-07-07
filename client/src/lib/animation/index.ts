/**
 * Barrel for the shared animation pipeline.
 *
 * The big picture:
 *
 *   1. `SharedClipLibrary` holds every AnimationClip you ever load, keyed by
 *      a SEMANTIC name (`'idle'`, `'attack_1h'`, `'crusade/samba'`).
 *   2. Each character has its own `THREE.AnimationMixer`.
 *   3. The mixer creates an `AnimationAction` per character × clip.
 *   4. You crossfade between actions: `lastAction.fadeOut(0.5)` →
 *      `newAction.reset().fadeIn(0.5).play()`.
 *
 * `CharacterAnimationController` (in `../animationLoader`) wraps that pattern.
 * `bindLibraryClip()` (added there) lets a controller pull a clip out of the
 * shared library by name and register it as one of its own actions. From the
 * controller's perspective the clip might as well have been local — the
 * difference is that EVERY character sharing the rig also reuses the same
 * clip object, so memory and parse time are paid exactly once.
 */

export {
  registerClipFromFile,
  registerNamedClipFromFile,
  registerAllClipsFromFile,
  registerClip,
  getClip,
  hasClip,
  listClips,
  clearLibrary,
  type ClipTransform,
} from './SharedClipLibrary';

export {
  stripRootMotion,
  filterClipToBones,
  filterClipToNormalizedBones,
  cloneClipWithName,
} from './clipUtils';
