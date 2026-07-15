/**
 * Load + register Animated Base Character pack into SharedClipLibrary.
 *
 * 1) Load GLB once
 * 2) Register each semantic role under `base/*` with stripRoot as needed
 * 3) Optional: retarget onto a live skeleton (Mixamo / Bip001)
 * 4) Optional: static bone-name bake for offline packs
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BASE_CHARACTER_GLB,
  BASE_ROLE_DEFS,
  type BaseSemanticRole,
  baseLibraryKey,
} from "./baseCharacterClips";
import { registerClip, getClip, hasClip, listClips } from "./SharedClipLibrary";
import { stripRootMotion, filterClipToNormalizedBones, cloneClipWithName } from "./clipUtils";
import { retargetClip } from "../animationRetargeting";
import { DEF_TO_MIXAMO, DEF_TO_BIP001, type BakeTarget, boneMapFor } from "./boneRemapBase";

const UPPER_BODY = new Set([
  "spine",
  "spine1",
  "spine2",
  "neck",
  "head",
  "leftshoulder",
  "leftarm",
  "leftforearm",
  "lefthand",
  "rightshoulder",
  "rightarm",
  "rightforearm",
  "righthand",
  "lshoulder",
  "larm",
  "lforearm",
  "lhand",
  "rshoulder",
  "rarm",
  "rforearm",
  "rhand",
]);

let loadPromise: Promise<boolean> | null = null;
let loaded = false;

const gltfLoader = new GLTFLoader();

function findClip(clips: THREE.AnimationClip[], glbName: string): THREE.AnimationClip | null {
  const exact = clips.find((c) => c.name === glbName);
  if (exact) return exact;
  const tail = glbName.includes("|") ? glbName.slice(glbName.lastIndexOf("|") + 1) : glbName;
  return clips.find((c) => c.name.endsWith(tail) || c.name.includes(tail)) ?? null;
}

/** Rewrite track bone leaves via static map. */
export function remapClipBones(
  clip: THREE.AnimationClip,
  map: Record<string, string>,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) continue;
    const bonePath = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const sep = Math.max(bonePath.lastIndexOf("/"), bonePath.lastIndexOf("|"));
    const leaf = sep >= 0 ? bonePath.slice(sep + 1) : bonePath;
    const target = map[leaf];
    if (!target) continue;
    const cloned = track.clone();
    cloned.name = target + prop;
    tracks.push(cloned);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/**
 * Load the base pack into the shared library (idempotent).
 * Registers `base/<role>` for every known semantic role.
 */
export async function loadBaseCharacterPack(
  url: string = BASE_CHARACTER_GLB,
): Promise<boolean> {
  if (loaded) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const gltf = await gltfLoader.loadAsync(url);
      const clips = gltf.animations ?? [];
      if (!clips.length) {
        console.warn("[BaseClipPack] no animations in", url);
        return false;
      }

      for (const [role, def] of Object.entries(BASE_ROLE_DEFS) as [
        BaseSemanticRole,
        (typeof BASE_ROLE_DEFS)[BaseSemanticRole],
      ][]) {
        const raw = findClip(clips, def.glbName);
        if (!raw) {
          console.warn(`[BaseClipPack] missing clip ${def.glbName} (${role})`);
          continue;
        }
        let clip = cloneClipWithName(raw, def.libraryKey);
        if (def.stripRoot) clip = stripRootMotion(clip);
        registerClip(def.libraryKey, clip, undefined, url);
        // Upper-body variant for moving combat overlays
        if (def.upperBody) {
          const upper = filterClipToNormalizedBones(clip, UPPER_BODY);
          if (upper.tracks.length) {
            registerClip(`${def.libraryKey}/upper`, upper, undefined, url);
          }
        }
      }

      loaded = true;
      console.info(
        `[BaseClipPack] registered ${listClips().filter((k) => k.startsWith("base/")).length} base/* clips from ${url}`,
      );
      return true;
    } catch (e) {
      console.warn("[BaseClipPack] load failed", url, e);
      loadPromise = null;
      return false;
    }
  })();

  return loadPromise;
}

export function isBasePackLoaded(): boolean {
  return loaded;
}

/** Get a base role clip (must loadBaseCharacterPack first). */
export function getBaseClip(role: BaseSemanticRole): THREE.AnimationClip | null {
  return getClip(baseLibraryKey(role));
}

export function hasBaseClip(role: BaseSemanticRole): boolean {
  return hasClip(baseLibraryKey(role));
}

/**
 * Retarget a base role onto a live skeleton (Mixamo / Bip001 / any humanoid).
 * Prefer this at character spawn over static maps when possible.
 */
export function retargetBaseRole(
  role: BaseSemanticRole,
  targetRoot: THREE.Object3D,
  opts?: { upperBody?: boolean },
): THREE.AnimationClip | null {
  const key = opts?.upperBody ? `${baseLibraryKey(role)}/upper` : baseLibraryKey(role);
  const src = getClip(key) ?? getClip(baseLibraryKey(role));
  if (!src) return null;
  return retargetClip(src, targetRoot);
}

/**
 * Static bake: produce a name-remapped clone for mixamo or bip001 without a live skeleton.
 * Used by offline scripts and as a fallback when target bones match standard names.
 */
export function bakeBaseRole(
  role: BaseSemanticRole,
  target: BakeTarget,
): THREE.AnimationClip | null {
  const src = getBaseClip(role);
  if (!src) return null;
  const map = boneMapFor(target);
  return remapClipBones(src, map);
}

/** Bake all registered base roles → map of libraryKey → remapped clip. */
export function bakeAllBaseRoles(target: BakeTarget): Map<string, THREE.AnimationClip> {
  const out = new Map<string, THREE.AnimationClip>();
  for (const role of Object.keys(BASE_ROLE_DEFS) as BaseSemanticRole[]) {
    const c = bakeBaseRole(role, target);
    if (c) out.set(baseLibraryKey(role), c);
  }
  return out;
}

export { DEF_TO_MIXAMO, DEF_TO_BIP001, UPPER_BODY };
