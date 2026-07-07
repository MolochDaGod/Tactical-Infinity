/**
 * SharedClipLibrary — the sbcode pattern, made global and reusable.
 *
 * One process-wide registry of `name -> AnimationClip`. Load each clip ONCE
 * (from a GLB or FBX), then bind it to as many `THREE.AnimationMixer`s as
 * you have characters. Every Crusade swordsman shares the same `attack_1h`
 * AnimationClip — the mixer creates per-character AnimationActions on
 * demand.
 *
 * Why this exists:
 *   - `animationLoader.ts` caches clips PER FILE PATH. Callers must know the
 *     URL to fetch a clip. That's leaky; controllers shouldn't care whether
 *     "samba" lives in `/animations/dance/samba.glb` or somewhere else.
 *   - The sbcode tutorial keeps `animationClips: { [name]: AnimationClip }`
 *     and applies it via `mixer.clipAction(animationClips[name])`. We
 *     formalize that here as a singleton + helper API.
 *
 * See `.agents/skills/character-animation/SKILL.md` §3 for the playbook.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  stripRootMotion,
  filterClipToBones,
  filterClipToNormalizedBones,
} from './clipUtils';

export interface ClipTransform {
  /** Strip root-bone position tracks (treadmill / in-place play). */
  stripRoot?: boolean;
  /** Keep only tracks for bones whose raw name starts with one of these. */
  filterBones?: readonly string[];
  /** Like `filterBones` but matches against normalized bone tokens. */
  filterNormalized?: ReadonlySet<string>;
}

interface ClipSourceEntry {
  /** The (possibly transformed) clip stored under this name. */
  clip: THREE.AnimationClip;
  /** Source URL — purely informational; used in warnings. */
  source: string;
}

const registry = new Map<string, ClipSourceEntry>();
const inflight = new Map<string, Promise<THREE.AnimationClip[]>>();

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

/** Apply optional transforms to a freshly loaded clip. */
function transform(clip: THREE.AnimationClip, t: ClipTransform | undefined): THREE.AnimationClip {
  let out = clip;
  if (t?.stripRoot) out = stripRootMotion(out);
  if (t?.filterBones) out = filterClipToBones(out, t.filterBones);
  if (t?.filterNormalized) out = filterClipToNormalizedBones(out, t.filterNormalized);
  return out;
}

/** Load every clip in a GLB/FBX once, keyed by URL. Idempotent + de-duped. */
async function loadAllClipsRaw(url: string): Promise<THREE.AnimationClip[]> {
  if (inflight.has(url)) return inflight.get(url)!;

  const isFbx = url.toLowerCase().endsWith('.fbx');
  const promise = (async () => {
    try {
      if (isFbx) {
        const fbx = await fbxLoader.loadAsync(url);
        return fbx.animations ?? [];
      }
      const gltf = await gltfLoader.loadAsync(url);
      return gltf.animations ?? [];
    } catch (err) {
      console.warn(`[SharedClipLibrary] Failed to load ${url}:`, err);
      inflight.delete(url);
      return [];
    }
  })();

  inflight.set(url, promise);
  return promise;
}

/**
 * Register one clip from a single-clip GLB/FBX under a semantic name.
 *
 *   await registerClipFromFile('samba', '/animations/dance/samba.glb');
 *   await registerClipFromFile('idle',  '/animations/idle/idle.glb', { stripRoot: true });
 */
export async function registerClipFromFile(
  name: string,
  url: string,
  options?: ClipTransform,
): Promise<THREE.AnimationClip | null> {
  if (registry.has(name)) return registry.get(name)!.clip;

  const clips = await loadAllClipsRaw(url);
  if (clips.length === 0) {
    console.warn(`[SharedClipLibrary] ${url} contains no animation clips.`);
    return null;
  }

  const transformed = transform(clips[0], options);
  registry.set(name, { clip: transformed, source: url });
  return transformed;
}

/**
 * Register a SPECIFIC named clip from a multi-clip file.
 *
 *   await registerNamedClipFromFile('attack_1h', '/animations/combat.glb', 'mixamo.com_attack');
 */
export async function registerNamedClipFromFile(
  registerAs: string,
  url: string,
  clipName: string,
  options?: ClipTransform,
): Promise<THREE.AnimationClip | null> {
  if (registry.has(registerAs)) return registry.get(registerAs)!.clip;

  const clips = await loadAllClipsRaw(url);
  const found = clips.find(c => c.name === clipName);
  if (!found) {
    console.warn(
      `[SharedClipLibrary] Clip "${clipName}" not in ${url}. ` +
      `Available: [${clips.map(c => c.name).join(', ')}]`,
    );
    return null;
  }

  const transformed = transform(found, options);
  registry.set(registerAs, { clip: transformed, source: url });
  return transformed;
}

/**
 * Register every clip in a multi-clip file under `${prefix}/${clip.name}`.
 * Useful for combat/locomotion sets shipped as one GLB.
 *
 *   await registerAllClipsFromFile('crusade', '/animations/combat/crusade.glb');
 *   // → 'crusade/attack_1h', 'crusade/block', 'crusade/idle', ...
 */
export async function registerAllClipsFromFile(
  prefix: string,
  url: string,
  options?: ClipTransform,
): Promise<string[]> {
  const clips = await loadAllClipsRaw(url);
  const registered: string[] = [];

  for (const c of clips) {
    const key = `${prefix}/${c.name}`;
    if (registry.has(key)) continue;
    const transformed = transform(c, options);
    registry.set(key, { clip: transformed, source: url });
    registered.push(key);
  }

  return registered;
}

/**
 * Manually register an already-loaded clip. Useful when you obtained a clip
 * via the GLTF that ALSO contains your character mesh — the mesh loader
 * gives you `gltf.animations`, you keep the mesh, you donate the clips here.
 */
export function registerClip(
  name: string,
  clip: THREE.AnimationClip,
  options?: ClipTransform,
  source = '<inline>',
): THREE.AnimationClip {
  if (registry.has(name)) return registry.get(name)!.clip;
  const transformed = transform(clip, options);
  registry.set(name, { clip: transformed, source });
  return transformed;
}

/** Read accessor — returns the clip or `null` if not registered. */
export function getClip(name: string): THREE.AnimationClip | null {
  return registry.get(name)?.clip ?? null;
}

export function hasClip(name: string): boolean {
  return registry.has(name);
}

export function listClips(): string[] {
  return Array.from(registry.keys()).sort();
}

/** TEST USE ONLY — clears the registry. Don't call in production code. */
export function clearLibrary(): void {
  registry.clear();
  inflight.clear();
}
