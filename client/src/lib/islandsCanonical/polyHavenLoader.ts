/**
 * polyHavenLoader — runtime fetch + cache for Poly Haven CC0 PBR sets.
 *
 * Pipeline (per channel):
 *   1. In-memory `PbrTextureSet` cache keyed by `${name}@${resolution}`.
 *   2. Browser HTTP `Cache` API (`POLYHAVEN_CACHE_NAME`) — survives reloads.
 *   3. Network fetch from `https://dl.polyhaven.org/file/ph-assets/...`
 *      (the public CDN; CC0 license, no auth).
 *   4. Local fallback to bundled CC0 packs under `/textures/sanctuary/ground/`
 *      if the network fails / is offline.
 *
 * The Cache API entry stores the raw bytes (the textures are JPEGs); we
 * convert each cached/network response into an `ObjectURL` and feed it to
 * `THREE.TextureLoader`, then revoke the URL once the texture has decoded.
 *
 * If anything blows up at network or cache layer, we surface it in the
 * console and silently fall back — the site still renders, just from
 * bundled assets, matching the original behaviour.
 */

import * as THREE from 'three';
import { GROUND_LAYER_REGISTRY, loadGroundLayer, type LoadedGroundLayer } from '@/lib/sanctuaryIsle/groundLayers';

export type PbrSetName =
  | 'grass'
  | 'forest_ground'
  | 'rock'
  | 'sand'
  | 'snow'
  | 'lava'
  | 'tree_bark'
  /** Bark for conifers — willow/birch-style banded bark from Poly Haven. */
  | 'pine_bark'
  /** Twisted / dead-tree bark — drier, greyer than `tree_bark`. */
  | 'dead_bark'
  | 'leaves';

export interface PbrTextureSet {
  name: PbrSetName;
  albedo:    THREE.Texture;
  normal?:   THREE.Texture;
  roughness?: THREE.Texture;
  ao?:       THREE.Texture;
  /** True if any channel had to fall back to the bundled local pack. */
  fromFallback: boolean;
  dispose(): void;
}

/** Poly Haven CDN ids, keyed by our logical PBR set name. */
const POLYHAVEN_IDS: Record<PbrSetName, string> = {
  grass:         'aerial_grass_rock',
  forest_ground: 'forrest_ground_01',
  rock:          'rock_pitted_mossy',
  sand:          'coast_sand_01',
  snow:          'snow_field_aerial',
  lava:          'lava_rock',
  tree_bark:     'bark_brown_02',
  pine_bark:     'bark_willow',
  dead_bark:     'bark_brown_02',
  leaves:        'leafy_grass',
};

/** Local bundled-pack fallback for each PBR set. */
const FALLBACK_PACKS: Record<PbrSetName, string> = {
  grass:         'rocky_terrain_02',
  forest_ground: 'rocky_terrain_02',
  rock:          'rock_pitted_mossy',
  sand:          'coast_sand_01',
  snow:          'coast_sand_01',
  lava:          'rock_08',
  tree_bark:     'rock_pitted_mossy',
  pine_bark:     'rock_pitted_mossy',
  dead_bark:     'rock_pitted_mossy',
  leaves:        'rocky_terrain_02',
};

const POLYHAVEN_BASE = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg';
const POLYHAVEN_CACHE_NAME = 'polyhaven-pbr-v1';

const setCache = new Map<string, Promise<PbrTextureSet>>();

interface ChannelSpec {
  url: string;
  /** sRGB for albedo, Linear for everything else. */
  srgb: boolean;
}

function buildPolyHavenUrls(id: string, res: '1k' | '2k' | '4k') {
  return {
    diff:  { url: `${POLYHAVEN_BASE}/${res}/${id}/${id}_diff_${res}.jpg`,   srgb: true  },
    norm:  { url: `${POLYHAVEN_BASE}/${res}/${id}/${id}_nor_gl_${res}.jpg`, srgb: false },
    rough: { url: `${POLYHAVEN_BASE}/${res}/${id}/${id}_rough_${res}.jpg`,  srgb: false },
    ao:    { url: `${POLYHAVEN_BASE}/${res}/${id}/${id}_ao_${res}.jpg`,     srgb: false },
  } as const;
}

/**
 * Resolve a single channel: try cache, then network, populate cache on hit.
 * Returns the Response we should feed into THREE — null on total failure so
 * the caller can fall back to a bundled pack channel.
 */
async function fetchPolyHavenChannel(spec: ChannelSpec): Promise<Response | null> {
  // Cache API may be unavailable (private mode, very old browsers). The
  // fetch path still works without it; we just lose persistence.
  let cache: Cache | null = null;
  try {
    if (typeof caches !== 'undefined') {
      cache = await caches.open(POLYHAVEN_CACHE_NAME);
      const cached = await cache.match(spec.url);
      if (cached) return cached;
    }
  } catch (e) {
    console.warn('[polyHaven] Cache API open failed:', e);
  }

  try {
    const res = await fetch(spec.url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    if (cache) {
      // Clone so we still have an unread body to return.
      try { await cache.put(spec.url, res.clone()); } catch (e) { console.warn('[polyHaven] cache put failed', e); }
    }
    return res;
  } catch (e) {
    console.warn(`[polyHaven] fetch ${spec.url} failed:`, e);
    return null;
  }
}

/** Load a single channel into a THREE.Texture via Object URL. */
async function channelToTexture(spec: ChannelSpec): Promise<THREE.Texture | null> {
  const res = await fetchPolyHavenChannel(spec);
  if (!res) return null;
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  return await new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      objUrl,
      (tex) => {
        if (spec.srgb) tex.colorSpace = THREE.SRGBColorSpace;
        else           tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        // Revoke once the GPU decode is queued.
        URL.revokeObjectURL(objUrl);
        resolve(tex);
      },
      undefined,
      (err) => { URL.revokeObjectURL(objUrl); reject(err); },
    );
  }).catch((e) => { console.warn('[polyHaven] decode failed', e); return null as unknown as THREE.Texture; });
}

/**
 * Public API: fetch a PBR set, with full cache → network → fallback chain.
 * Returns a `PbrTextureSet` ready to apply. The promise resolves immediately
 * once any working source is found.
 */
export function getPbrTextureSet(
  name: PbrSetName,
  resolution: '1k' | '2k' | '4k' = '2k',
): Promise<PbrTextureSet> {
  const key = `${name}@${resolution}`;
  const hit = setCache.get(key);
  if (hit) return hit;

  const promise = (async (): Promise<PbrTextureSet> => {
    const id = POLYHAVEN_IDS[name];
    const urls = buildPolyHavenUrls(id, resolution);

    // Fan out network requests in parallel — channels are independent.
    const [albedo, normal, roughness, ao] = await Promise.all([
      channelToTexture(urls.diff),
      channelToTexture(urls.norm),
      channelToTexture(urls.rough),
      channelToTexture(urls.ao),
    ]);

    // If we got at least the albedo, the set is usable.
    if (albedo) {
      return {
        name, albedo,
        normal:    normal    ?? undefined,
        roughness: roughness ?? undefined,
        ao:        ao        ?? undefined,
        fromFallback: false,
        dispose() {
          albedo.dispose();
          normal?.dispose();
          roughness?.dispose();
          ao?.dispose();
          setCache.delete(key);
        },
      };
    }

    // Total network failure — load the bundled fallback pack synchronously.
    const packId = FALLBACK_PACKS[name];
    const def = GROUND_LAYER_REGISTRY[packId];
    if (!def) throw new Error(`[polyHaven] no fallback pack for "${name}"`);
    const pack: LoadedGroundLayer = loadGroundLayer(def, { repeat: 1, anisotropy: 8 });
    return {
      name,
      albedo:    pack.albedo,
      normal:    pack.normal,
      roughness: pack.roughness,
      ao:        pack.arm,
      fromFallback: true,
      dispose() { pack.dispose(); setCache.delete(key); },
    };
  })();

  setCache.set(key, promise);
  return promise;
}

/** Apply tiling to all maps in a set. */
export function setPbrTiling(set: PbrTextureSet, repeatX: number, repeatY: number) {
  const apply = (tex?: THREE.Texture) => {
    if (!tex) return;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
  };
  apply(set.albedo);
  apply(set.normal);
  apply(set.roughness);
  apply(set.ao);
}

/**
 * Build a `MeshStandardMaterial` from a `PbrTextureSet`. Convenience for
 * callers that just want to drop the set onto a mesh as a material.
 */
export function makePbrMaterial(set: PbrTextureSet): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map:          set.albedo,
    normalMap:    set.normal    ?? null,
    roughnessMap: set.roughness ?? null,
    aoMap:        set.ao        ?? null,
    roughness:    1.0,
    metalness:    0.0,
    envMapIntensity: 0.6,
  });
}
