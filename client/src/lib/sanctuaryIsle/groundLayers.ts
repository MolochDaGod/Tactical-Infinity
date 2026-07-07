/**
 * sanctuaryIsle/groundLayers.ts
 *
 * Typed registry of PBR ground packs that may be slotted into the Sanctuary
 * terrain shader (`SanctuaryTerrainMaterial`). Each pack lives at
 *   /textures/sanctuary/ground/<packId>/<packId>_<channel>_4k.jpg
 * and was sourced from PolyHaven (CC0). The registry only describes the
 * available channels per pack — wiring is done by the material module.
 *
 * Bands describe the altitude/slope niche the artist intended:
 *   - 'beach'   — at/below the waterline, exposed shore sand
 *   - 'shore'   — wet/dry transition, wave-tossed sand + small rocks
 *   - 'lowland' — flat valley + meadow floor (geology, not vegetation)
 *   - 'hill'    — ridges and slopes
 *   - 'cliff'   — exposed bedrock and steep faces
 *
 * Vegetation overlays (grass / grass_old / grass_rock / tile_dark) live in
 * `SanctuaryTerrainMaterial` directly because they are stylised, not PBR.
 */

import * as THREE from 'three';

export type GroundChannel = 'albedo' | 'normal' | 'roughness' | 'arm' | 'spec';
export type GroundBand    = 'beach' | 'shore' | 'lowland' | 'hill' | 'cliff';

export interface GroundLayerDef {
  id:        string;
  label:     string;
  /** Folder name under /textures/sanctuary/ground/. */
  folder:    string;
  /** Declared channels. Only present channels will be loaded. */
  channels:  Partial<Record<GroundChannel, string>>;
  /** Niche the pack was selected for. */
  defaultBand: GroundBand;
  /** Suggested cosine-of-slope range where this pack reads best. */
  slopeRange: [number, number];
  /** Suggested UV repeat count, relative to 32 base. */
  repeat:    number;
  /** Source attribution. */
  source:    string;
}

const BASE = '/textures/sanctuary/ground';
const PH   = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k';

export const GROUND_LAYER_REGISTRY: Record<string, GroundLayerDef> = {
  coast_sand_01: {
    id: 'coast_sand_01',
    label: 'Clean Coast Sand',
    folder: 'coast_sand_01',
    channels: {
      albedo:    `${BASE}/coast_sand_01/coast_sand_01_diff_4k.jpg`,
      normal:    `${BASE}/coast_sand_01/coast_sand_01_nor_gl_4k.jpg`,
      roughness: `${BASE}/coast_sand_01/coast_sand_01_rough_4k.jpg`,
    },
    defaultBand: 'beach',
    slopeRange:  [0.85, 1.0],
    repeat:      32,
    source:      'PolyHaven · coast_sand_01 · CC0',
  },

  coast_sand_03: {
    id: 'coast_sand_03',
    label: 'Wet Shore Sand',
    folder: 'coast_sand_03',
    channels: {
      albedo: `${BASE}/coast_sand_03/coast_sand_03_diff_4k.jpg`,
      normal: `${BASE}/coast_sand_03/coast_sand_03_nor_gl_4k.jpg`,
      arm:    `${BASE}/coast_sand_03/coast_sand_03_arm_4k.jpg`,
    },
    defaultBand: 'shore',
    slopeRange:  [0.80, 1.0],
    repeat:      28,
    source:      'PolyHaven · coast_sand_03 · CC0',
  },

  coast_sand_rocks_02: {
    id: 'coast_sand_rocks_02',
    label: 'Sand & Pebbles',
    folder: 'coast_sand_rocks_02',
    channels: {
      albedo:    `${BASE}/coast_sand_rocks_02/coast_sand_rocks_02_diff_4k.jpg`,
      normal:    `${BASE}/coast_sand_rocks_02/coast_sand_rocks_02_nor_gl_4k.jpg`,
      roughness: `${BASE}/coast_sand_rocks_02/coast_sand_rocks_02_rough_4k.jpg`,
    },
    defaultBand: 'shore',
    slopeRange:  [0.70, 0.95],
    repeat:      24,
    source:      'PolyHaven · coast_sand_rocks_02 · CC0',
  },

  rock_08: {
    id: 'rock_08',
    label: 'Bare Bedrock',
    folder: 'rock_08',
    channels: {
      albedo:    `${BASE}/rock_08/rock_08_diff_4k.jpg`,
      normal:    `${BASE}/rock_08/rock_08_nor_gl_4k.jpg`,
      roughness: `${BASE}/rock_08/rock_08_rough_4k.jpg`,
    },
    defaultBand: 'cliff',
    slopeRange:  [0.0, 0.6],
    repeat:      18,
    source:      'PolyHaven · rock_08 · CC0',
  },

  rock_pitted_mossy: {
    id: 'rock_pitted_mossy',
    label: 'Mossy Cliff Stone',
    folder: 'rock_pitted_mossy',
    channels: {
      albedo: `${BASE}/rock_pitted_mossy/rock_pitted_mossy_diff_4k.jpg`,
      normal: `${BASE}/rock_pitted_mossy/rock_pitted_mossy_nor_gl_4k.jpg`,
      arm:    `${BASE}/rock_pitted_mossy/rock_pitted_mossy_arm_4k.jpg`,
    },
    defaultBand: 'cliff',
    slopeRange:  [0.0, 0.55],
    repeat:      20,
    source:      'PolyHaven · rock_pitted_mossy · CC0',
  },

  rocky_terrain_02: {
    id: 'rocky_terrain_02',
    label: 'Cracked Rocky Ground',
    folder: 'rocky_terrain_02',
    channels: {
      albedo: `${BASE}/rocky_terrain_02/rocky_terrain_02_diff_4k.jpg`,
      normal: `${BASE}/rocky_terrain_02/rocky_terrain_02_nor_gl_4k.jpg`,
      arm:    `${BASE}/rocky_terrain_02/rocky_terrain_02_arm_4k.jpg`,
      spec:   `${BASE}/rocky_terrain_02/rocky_terrain_02_spec_4k.jpg`,
    },
    defaultBand: 'hill',
    slopeRange:  [0.55, 0.9],
    repeat:      22,
    source:      'PolyHaven · rocky_terrain_02 · CC0',
  },

  snow_field_aerial: {
    id: 'snow_field_aerial',
    label: 'Arctic Snow Field',
    folder: 'snow_field_aerial',
    channels: {
      albedo: `${PH}/snow_field_aerial/snow_field_aerial_diff_2k.jpg`,
      normal: `${PH}/snow_field_aerial/snow_field_aerial_nor_gl_2k.jpg`,
      roughness: `${PH}/snow_field_aerial/snow_field_aerial_rough_2k.jpg`,
    },
    defaultBand: 'lowland',
    slopeRange:  [0.6, 1.0],
    repeat:      28,
    source:      'PolyHaven · snow_field_aerial · CC0',
  },

  lava_rock: {
    id: 'lava_rock',
    label: 'Volcanic Lava Rock',
    folder: 'lava_rock',
    channels: {
      albedo: `${PH}/lava_rock/lava_rock_diff_2k.jpg`,
      normal: `${PH}/lava_rock/lava_rock_nor_gl_2k.jpg`,
      roughness: `${PH}/lava_rock/lava_rock_rough_2k.jpg`,
    },
    defaultBand: 'cliff',
    slopeRange:  [0.0, 0.7],
    repeat:      20,
    source:      'PolyHaven · lava_rock · CC0',
  },

  aerial_grass_rock: {
    id: 'aerial_grass_rock',
    label: 'Lush Grass & Rock',
    folder: 'aerial_grass_rock',
    channels: {
      albedo: `${PH}/aerial_grass_rock/aerial_grass_rock_diff_2k.jpg`,
      normal: `${PH}/aerial_grass_rock/aerial_grass_rock_nor_gl_2k.jpg`,
      roughness: `${PH}/aerial_grass_rock/aerial_grass_rock_rough_2k.jpg`,
    },
    defaultBand: 'lowland',
    slopeRange:  [0.7, 1.0],
    repeat:      26,
    source:      'PolyHaven · aerial_grass_rock · CC0',
  },

  forrest_ground_01: {
    id: 'forrest_ground_01',
    label: 'Forest Floor',
    folder: 'forrest_ground_01',
    channels: {
      albedo: `${PH}/forrest_ground_01/forrest_ground_01_diff_2k.jpg`,
      normal: `${PH}/forrest_ground_01/forrest_ground_01_nor_gl_2k.jpg`,
      roughness: `${PH}/forrest_ground_01/forrest_ground_01_rough_2k.jpg`,
    },
    defaultBand: 'lowland',
    slopeRange:  [0.65, 1.0],
    repeat:      24,
    source:      'PolyHaven · forrest_ground_01 · CC0',
  },

  brown_mud_leaves_01: {
    id: 'brown_mud_leaves_01',
    label: 'Desert Mud & Leaves',
    folder: 'brown_mud_leaves_01',
    channels: {
      albedo: `${PH}/brown_mud_leaves_01/brown_mud_leaves_01_diff_2k.jpg`,
      normal: `${PH}/brown_mud_leaves_01/brown_mud_leaves_01_nor_gl_2k.jpg`,
      roughness: `${PH}/brown_mud_leaves_01/brown_mud_leaves_01_rough_2k.jpg`,
    },
    defaultBand: 'lowland',
    slopeRange:  [0.5, 1.0],
    repeat:      22,
    source:      'PolyHaven · brown_mud_leaves_01 · CC0',
  },
};

/** All packs grouped by their default band, for quick variant lookup. */
export const GROUND_LAYERS_BY_BAND: Record<GroundBand, GroundLayerDef[]> = (() => {
  const out: Record<GroundBand, GroundLayerDef[]> = {
    beach:   [],
    shore:   [],
    lowland: [],
    hill:    [],
    cliff:   [],
  };
  for (const def of Object.values(GROUND_LAYER_REGISTRY)) out[def.defaultBand].push(def);
  return out;
})();

/** Convenience: ordered list of pack ids for UI pickers. */
export const GROUND_LAYER_IDS = Object.keys(GROUND_LAYER_REGISTRY);

/** A loaded, GPU-ready set of textures for a single pack. */
export interface LoadedGroundLayer {
  def:        GroundLayerDef;
  albedo:     THREE.Texture;
  normal?:    THREE.Texture;
  roughness?: THREE.Texture;
  arm?:       THREE.Texture;
  spec?:      THREE.Texture;
  dispose:    () => void;
}

/**
 * Load one pack's textures and configure them for tiling on a terrain.
 * Albedo is sRGB; everything else is linear data.
 */
export function loadGroundLayer(
  defOrId: GroundLayerDef | string,
  opts: { repeat?: number; anisotropy?: number; loader?: THREE.TextureLoader } = {},
): LoadedGroundLayer {
  const def = typeof defOrId === 'string' ? GROUND_LAYER_REGISTRY[defOrId] : defOrId;
  if (!def) throw new Error(`[groundLayers] Unknown pack id "${defOrId as string}"`);

  const loader     = opts.loader     ?? new THREE.TextureLoader();
  const repeat     = opts.repeat     ?? def.repeat;
  const anisotropy = opts.anisotropy ?? 8;

  const configure = (tex: THREE.Texture, sRGB: boolean): THREE.Texture => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = anisotropy;
    tex.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
  };

  const albedoUrl = def.channels.albedo;
  if (!albedoUrl) {
    throw new Error(`[groundLayers] Pack "${def.id}" has no albedo channel — refusing to load.`);
  }

  const albedo    = configure(loader.load(albedoUrl), true);
  const normal    = def.channels.normal    ? configure(loader.load(def.channels.normal),    false) : undefined;
  const roughness = def.channels.roughness ? configure(loader.load(def.channels.roughness), false) : undefined;
  const arm       = def.channels.arm       ? configure(loader.load(def.channels.arm),       false) : undefined;
  const spec      = def.channels.spec      ? configure(loader.load(def.channels.spec),      false) : undefined;

  return {
    def,
    albedo,
    normal,
    roughness,
    arm,
    spec,
    dispose() {
      albedo.dispose();
      normal?.dispose();
      roughness?.dispose();
      arm?.dispose();
      spec?.dispose();
    },
  };
}

/**
 * Default mapping of the 6 PBR packs onto the 4 splat slots used by
 * `SanctuaryTerrainMaterial`. Picked for stylistic contrast: clean beach →
 * meadow grass → cracked-rock hillside → mossy-stone cliff.
 *
 * The unused packs (`coast_sand_03`, `coast_sand_rocks_02`, `rock_08`) remain
 * in `GROUND_LAYER_REGISTRY` and can be swapped in via the material's options.
 */
export const DEFAULT_SANCTUARY_GROUND_SLOTS = {
  seabedPackId: 'coast_sand_01'      as keyof typeof GROUND_LAYER_REGISTRY,
  rockPackId:   'rocky_terrain_02'   as keyof typeof GROUND_LAYER_REGISTRY,
  cliffPackId:  'rock_pitted_mossy'  as keyof typeof GROUND_LAYER_REGISTRY,
};
