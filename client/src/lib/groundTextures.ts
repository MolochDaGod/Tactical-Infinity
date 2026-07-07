import * as THREE from 'three';

/**
 * Ground Texture System
 * ─────────────────────
 * Per-biome PBR texture sets sourced from `attached_assets/seabed_textures/`
 * (originally Quaternius/Polyhaven seabed packs — they tile cleanly and
 * cover the visual range we need for both island floors and beach zones).
 *
 * The user has indicated they will provide custom shaders for the four
 * island types later; this module supplies the texture *inputs* those
 * shaders will sample.
 *
 * Returned textures are cached per-URL and ready for direct use as
 * `MeshStandardMaterial.map / normalMap / roughnessMap`.
 */

const TEXTURE_BASE = '/textures/seabed_textures';

export interface GroundTextureSet {
  diffuse: string;
  normal?: string;
  roughness?: string;
  /** Suggested UV repeat for this material when applied to terrain. */
  repeat: number;
  /** Optional tint applied on top of the diffuse to push a biome read. */
  tint?: number;
}

/**
 * Maps one biome → main inland ground material, plus a secondary
 * (typically beach / shore zone) when relevant.
 */
export const BIOME_GROUND_TEXTURES: Record<string, { primary: GroundTextureSet; shore?: GroundTextureSet }> = {
  tropical: {
    primary: {
      diffuse:   `${TEXTURE_BASE}/coral_ground_02_2k/textures/coral_ground_02_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/coral_ground_02_2k/textures/coral_ground_02_nor_gl_2k.jpg`,
      roughness: `${TEXTURE_BASE}/coral_ground_02_2k/textures/coral_ground_02_rough_2k.jpg`,
      repeat: 8,
    },
    shore: {
      diffuse:   `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_nor_gl_2k.jpg`,
      repeat: 12,
    },
  },
  temperate: {
    primary: {
      diffuse:   `${TEXTURE_BASE}/rock_moss_set_01_2k/textures/rock_moss_set_01_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/rock_moss_set_01_2k/textures/rock_moss_set_01_nor_gl_2k.jpg`,
      roughness: `${TEXTURE_BASE}/rock_moss_set_01_2k/textures/rock_moss_set_01_rough_2k.jpg`,
      repeat: 6,
    },
    shore: {
      diffuse:   `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_nor_gl_2k.jpg`,
      repeat: 10,
    },
  },
  volcanic: {
    primary: {
      diffuse:   `${TEXTURE_BASE}/rock_moss_set_02_2k/textures/rock_moss_set_02_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/rock_moss_set_02_2k/textures/rock_moss_set_02_nor_gl_2k.jpg`,
      roughness: `${TEXTURE_BASE}/rock_moss_set_02_2k/textures/rock_moss_set_02_rough_2k.jpg`,
      repeat: 6,
      tint: 0x6b4030,                 // warm reddish tint to read "volcanic"
    },
  },
  arctic: {
    primary: {
      diffuse:   `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_nor_gl_2k.jpg`,
      repeat: 10,
      tint: 0xd8e8f0,                 // cool blue-white to push snow read
    },
  },
  desert: {
    primary: {
      diffuse:   `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_diff_2k.jpg`,
      normal:    `${TEXTURE_BASE}/gravelly_sand_2k/textures/gravelly_sand_nor_gl_2k.jpg`,
      repeat: 12,
      tint: 0xe8c890,                 // warm sand tint
    },
  },
};

const ALIAS: Record<string, string> = {
  forest: 'temperate',
  haunted: 'volcanic',
  beach: 'tropical',
};

const cache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

function loadTexture(url: string, repeat: number): THREE.Texture {
  let tex = cache.get(url);
  if (tex) return tex;
  tex = loader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(url, tex);
  return tex;
}

export interface LoadedGroundTextureSet {
  diffuse: THREE.Texture;
  normal?: THREE.Texture;
  roughness?: THREE.Texture;
  tint?: THREE.Color;
}

export function loadGroundTextureSet(biome: string): { primary: LoadedGroundTextureSet; shore?: LoadedGroundTextureSet } {
  const key = ALIAS[biome] ?? biome;
  const def = BIOME_GROUND_TEXTURES[key] ?? BIOME_GROUND_TEXTURES.tropical;

  const buildSet = (set: GroundTextureSet): LoadedGroundTextureSet => ({
    diffuse: loadTexture(set.diffuse, set.repeat),
    normal: set.normal ? loadTexture(set.normal, set.repeat) : undefined,
    roughness: set.roughness ? loadTexture(set.roughness, set.repeat) : undefined,
    tint: set.tint !== undefined ? new THREE.Color(set.tint) : undefined,
  });

  return {
    primary: buildSet(def.primary),
    shore: def.shore ? buildSet(def.shore) : undefined,
  };
}

/**
 * Build a ready-to-use MeshStandardMaterial for a biome's primary ground.
 * Caller can switch this in for the existing vertex-colored MeshLambertMaterial
 * when we want full PBR ground (e.g. when shaders ship).
 */
export function buildBiomeGroundMaterial(biome: string): THREE.MeshStandardMaterial {
  const { primary } = loadGroundTextureSet(biome);
  const mat = new THREE.MeshStandardMaterial({
    map: primary.diffuse,
    normalMap: primary.normal,
    roughnessMap: primary.roughness,
    roughness: primary.roughness ? 1.0 : 0.85,
    metalness: 0.0,
    color: primary.tint ?? 0xffffff,
  });
  return mat;
}
