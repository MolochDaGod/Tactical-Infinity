/**
 * Quaternius animated fish — open-world ocean fauna under boats.
 * CDN: assets.grudge-studio.com/models/fauna/fish/
 *
 * Depth: hard band Y ∈ [-15, -2]. Larger bodyLengthM → deeper preferred band.
 * Scale: always normalize FBX bbox max-dim → bodyLengthM (metres). Never use raw FBX scale.
 */

import {
  resolveOceanDepthBand,
  clampOceanDepth,
  OCEAN_SURFACE_Y,
  OCEAN_MAX_DEPTH_Y,
} from './modelNormalize';
import { WARLORDS_CDN, resolveWarlordsUrl } from './warlordsAssetCatalog';

export const FAUNA_CDN = `${WARLORDS_CDN}/models/fauna`;

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface QuaterniusFishDef {
  id: string;
  /** FishManager / FISH_BEHAVIORS key */
  name: string;
  label: string;
  modelUrl: string;
  /** Fallback CDN key without spaces (load order: modelUrl then modelUrlAlt) */
  modelUrlAlt?: string;
  /**
   * World length in metres after normalize (max bbox axis).
   * Also drives depth preference — bigger → deeper.
   */
  bodyLengthM: number;
  /** Optional soft depth overrides (more negative = deeper) */
  depthLo?: number;
  depthHi?: number;
  swimSpeed: number;
  catchable: boolean;
  harpoonable: boolean;
  catchXp: number;
  rarity: FishRarity;
}

/** Prefer catalog / CDN r2 keys (hyphenated Manta-ray first). */
const fishUrl = (file: string) => resolveWarlordsUrl(`models/fauna/fish/${file}`);

/**
 * Species table — sizes in metres for open-world under-boat readability.
 * Reef fish stay small near -2…-5; apex predators deeper toward -15.
 */
export const QUATERNIUS_FISH: QuaterniusFishDef[] = [
  {
    id: 'fish1',
    name: 'ReefFishA',
    label: 'Reef Fish A',
    modelUrl: fishUrl('Fish1.fbx'),
    bodyLengthM: 0.55,
    depthLo: -5,
    depthHi: -2,
    swimSpeed: 3.5,
    catchable: true,
    harpoonable: true,
    catchXp: 8,
    rarity: 'common',
  },
  {
    id: 'fish2',
    name: 'ReefFishB',
    label: 'Reef Fish B',
    modelUrl: fishUrl('Fish2.fbx'),
    bodyLengthM: 0.6,
    depthLo: -5.5,
    depthHi: -2.2,
    swimSpeed: 3.8,
    catchable: true,
    harpoonable: true,
    catchXp: 10,
    rarity: 'common',
  },
  {
    id: 'fish3',
    name: 'ReefFishC',
    label: 'Reef Fish C',
    modelUrl: fishUrl('Fish3.fbx'),
    bodyLengthM: 0.5,
    depthLo: -4.5,
    depthHi: -2,
    swimSpeed: 4.0,
    catchable: true,
    harpoonable: true,
    catchXp: 8,
    rarity: 'common',
  },
  {
    id: 'dolphin',
    name: 'Dolphin',
    label: 'Dolphin',
    modelUrl: fishUrl('Dolphin.fbx'),
    bodyLengthM: 2.4,
    depthLo: -9,
    depthHi: -3.5,
    swimSpeed: 7,
    catchable: false,
    harpoonable: true,
    catchXp: 40,
    rarity: 'rare',
  },
  {
    id: 'shark',
    name: 'Shark',
    label: 'Shark',
    modelUrl: fishUrl('Shark.fbx'),
    bodyLengthM: 3.2,
    depthLo: -12,
    depthHi: -5.5,
    swimSpeed: 6,
    catchable: false,
    harpoonable: true,
    catchXp: 55,
    rarity: 'rare',
  },
  {
    id: 'manta',
    name: 'MantaRay',
    label: 'Manta Ray',
    modelUrl: fishUrl('Manta-ray.fbx'),
    modelUrlAlt: fishUrl('Manta ray.fbx'),
    bodyLengthM: 2.8,
    depthLo: -13,
    depthHi: -6,
    swimSpeed: 4.5,
    catchable: false,
    harpoonable: true,
    catchXp: 50,
    rarity: 'rare',
  },
  {
    id: 'whale',
    name: 'Whale',
    label: 'Whale',
    modelUrl: fishUrl('Whale.fbx'),
    bodyLengthM: 7.5,
    depthLo: -15,
    depthHi: -9,
    swimSpeed: 3.2,
    catchable: false,
    harpoonable: true,
    catchXp: 100,
    rarity: 'epic',
  },
];

export const OCEAN_FISH_DEPTH = {
  lo: OCEAN_MAX_DEPTH_Y,
  hi: OCEAN_SURFACE_Y,
} as const;

export function depthBandForBodyLength(bodyLengthM: number): { lo: number; hi: number } {
  return resolveOceanDepthBand(bodyLengthM, -100) ?? { lo: OCEAN_MAX_DEPTH_Y, hi: OCEAN_SURFACE_Y };
}

export { resolveOceanDepthBand, clampOceanDepth as clampFishDepth, OCEAN_SURFACE_Y, OCEAN_MAX_DEPTH_Y };
