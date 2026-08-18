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
/** Same-origin copies shipped under public/models/fleet/fish/ */
const localFish = (file: string) => `/models/fleet/fish/${file}`;

/**
 * Species table — sizes in metres for open-world under-boat readability.
 * Reef fish stay small near -2…-5; apex predators deeper toward -15.
 */
export const QUATERNIUS_FISH: QuaterniusFishDef[] = [
  {
    id: 'fish1',
    name: 'ReefFishA',
    label: 'Reef Fish A',
    modelUrl: localFish('Fish1.fbx'),
    modelUrlAlt: fishUrl('Fish1.fbx'),
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
    modelUrl: localFish('Fish2.fbx'),
    modelUrlAlt: fishUrl('Fish2.fbx'),
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
    modelUrl: localFish('Fish3.fbx'),
    modelUrlAlt: fishUrl('Fish3.fbx'),
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
    modelUrl: localFish('Dolphin.fbx'),
    modelUrlAlt: fishUrl('Dolphin.fbx'),
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
    modelUrl: localFish('Shark.fbx'),
    modelUrlAlt: fishUrl('Shark.fbx'),
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
    modelUrl: localFish('Manta-ray.fbx'),
    modelUrlAlt: fishUrl('Manta-ray.fbx'),
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
    modelUrl: localFish('Whale.fbx'),
    modelUrlAlt: fishUrl('Whale.fbx'),
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

/** Quaternius FBX often ships without maps — tropical display colors. */
export const FISH_DISPLAY_COLOR: Record<string, number> = {
  ReefFishA: 0xf4a261,
  ReefFishB: 0xe9c46a,
  ReefFishC: 0x2a9d8f,
  Dolphin: 0x8d99ae,
  Shark: 0x4a5560,
  MantaRay: 0x2d3142,
  Whale: 0x3d5a80,
};

const cute = (file: string) => `/models/fleet/cute-fish/${file}`;

/** Cute Fish Pack (Feb 2020) — per-part Kd materials, no atlas. SI lengths. */
export const CUTE_FISH: QuaterniusFishDef[] = [
  { id: 'cute_tetra', name: 'Tetra', label: 'Tetra', modelUrl: cute('Tetra.fbx'), bodyLengthM: 0.12, depthLo: -4, depthHi: -1.5, swimSpeed: 3.4, catchable: true, harpoonable: false, catchXp: 4, rarity: 'common' },
  { id: 'cute_betta', name: 'Betta', label: 'Betta', modelUrl: cute('Betta.fbx'), bodyLengthM: 0.14, depthLo: -3.5, depthHi: -1.2, swimSpeed: 2.8, catchable: true, harpoonable: false, catchXp: 6, rarity: 'common' },
  { id: 'cute_cardinal', name: 'CardinalFish', label: 'Cardinal Fish', modelUrl: cute('CardinalFish.fbx'), bodyLengthM: 0.13, depthLo: -4, depthHi: -1.5, swimSpeed: 3.2, catchable: true, harpoonable: false, catchXp: 5, rarity: 'common' },
  { id: 'cute_clownfish', name: 'Clownfish', label: 'Clownfish', modelUrl: cute('Clownfish.fbx'), bodyLengthM: 0.16, depthLo: -4, depthHi: -1.4, swimSpeed: 2.6, catchable: true, harpoonable: false, catchXp: 8, rarity: 'common' },
  { id: 'cute_zebraclown', name: 'ZebraClownFish', label: 'Zebra Clown', modelUrl: cute('ZebraClownFish.fbx'), bodyLengthM: 0.16, depthLo: -4, depthHi: -1.4, swimSpeed: 2.5, catchable: true, harpoonable: false, catchXp: 8, rarity: 'common' },
  { id: 'cute_bluetang', name: 'BlueTang', label: 'Blue Tang', modelUrl: cute('BlueTang.fbx'), bodyLengthM: 0.22, depthLo: -5, depthHi: -1.8, swimSpeed: 3.6, catchable: true, harpoonable: false, catchXp: 10, rarity: 'common' },
  { id: 'cute_yellowtang', name: 'YellowTang', label: 'Yellow Tang', modelUrl: cute('YellowTang.fbx'), bodyLengthM: 0.2, depthLo: -5, depthHi: -1.8, swimSpeed: 3.5, catchable: true, harpoonable: false, catchXp: 10, rarity: 'common' },
  { id: 'cute_tang', name: 'Tang', label: 'Tang', modelUrl: cute('Tang.fbx'), bodyLengthM: 0.21, depthLo: -5, depthHi: -1.8, swimSpeed: 3.4, catchable: true, harpoonable: false, catchXp: 10, rarity: 'common' },
  { id: 'cute_butterfly', name: 'ButterflyFish', label: 'Butterfly Fish', modelUrl: cute('ButterflyFish.fbx'), bodyLengthM: 0.2, depthLo: -5, depthHi: -1.6, swimSpeed: 3.0, catchable: true, harpoonable: false, catchXp: 9, rarity: 'uncommon' },
  { id: 'cute_royalgramma', name: 'RoyalGramma', label: 'Royal Gramma', modelUrl: cute('RoyalGramma.fbx'), bodyLengthM: 0.15, depthLo: -6, depthHi: -2, swimSpeed: 2.8, catchable: true, harpoonable: false, catchXp: 8, rarity: 'uncommon' },
  { id: 'cute_goldfish', name: 'Goldfish', label: 'Goldfish', modelUrl: cute('Goldfish.fbx'), bodyLengthM: 0.22, depthLo: -3, depthHi: -0.8, swimSpeed: 2.2, catchable: true, harpoonable: false, catchXp: 7, rarity: 'common' },
  { id: 'cute_bluegoldfish', name: 'BlueGoldfish', label: 'Blue Goldfish', modelUrl: cute('BlueGoldfish.fbx'), bodyLengthM: 0.22, depthLo: -3, depthHi: -0.8, swimSpeed: 2.2, catchable: true, harpoonable: false, catchXp: 8, rarity: 'uncommon' },
  { id: 'cute_koi', name: 'Koi', label: 'Koi', modelUrl: cute('Koi.fbx'), bodyLengthM: 0.45, depthLo: -3.5, depthHi: -0.8, swimSpeed: 2.0, catchable: true, harpoonable: false, catchXp: 14, rarity: 'uncommon' },
  { id: 'cute_cowfish', name: 'Cowfish', label: 'Cowfish', modelUrl: cute('Cowfish.fbx'), bodyLengthM: 0.28, depthLo: -5, depthHi: -1.6, swimSpeed: 1.8, catchable: true, harpoonable: false, catchXp: 11, rarity: 'uncommon' },
  { id: 'cute_puffer', name: 'Puffer', label: 'Puffer', modelUrl: cute('Puffer.fbx'), bodyLengthM: 0.32, depthLo: -5, depthHi: -1.5, swimSpeed: 1.6, catchable: true, harpoonable: true, catchXp: 16, rarity: 'uncommon' },
  { id: 'cute_lionfish', name: 'Lionfish', label: 'Lionfish', modelUrl: cute('Lionfish.fbx'), bodyLengthM: 0.35, depthLo: -7, depthHi: -2, swimSpeed: 2.4, catchable: true, harpoonable: true, catchXp: 18, rarity: 'rare' },
  { id: 'cute_blacklion', name: 'BlackLionFish', label: 'Black Lionfish', modelUrl: cute('BlackLionFish.fbx'), bodyLengthM: 0.36, depthLo: -7, depthHi: -2, swimSpeed: 2.3, catchable: true, harpoonable: true, catchXp: 20, rarity: 'rare' },
  { id: 'cute_mandarin', name: 'MandarinFish', label: 'Mandarin Fish', modelUrl: cute('MandarinFish.fbx'), bodyLengthM: 0.14, depthLo: -4, depthHi: -1.4, swimSpeed: 2.0, catchable: true, harpoonable: false, catchXp: 12, rarity: 'rare' },
  { id: 'cute_moorish', name: 'MoorishIdol', label: 'Moorish Idol', modelUrl: cute('MoorishIdol.fbx'), bodyLengthM: 0.22, depthLo: -5, depthHi: -1.6, swimSpeed: 2.8, catchable: true, harpoonable: false, catchXp: 12, rarity: 'uncommon' },
  { id: 'cute_parrot', name: 'ParrotFish', label: 'Parrot Fish', modelUrl: cute('ParrotFish.fbx'), bodyLengthM: 0.4, depthLo: -6, depthHi: -1.8, swimSpeed: 2.6, catchable: true, harpoonable: false, catchXp: 14, rarity: 'uncommon' },
  { id: 'cute_flowerhorn', name: 'FlowerHorn', label: 'Flower Horn', modelUrl: cute('FlowerHorn.fbx'), bodyLengthM: 0.28, depthLo: -4, depthHi: -1.2, swimSpeed: 2.4, catchable: true, harpoonable: false, catchXp: 13, rarity: 'uncommon' },
  { id: 'cute_flatfish', name: 'Flatfish', label: 'Flatfish', modelUrl: cute('Flatfish.fbx'), bodyLengthM: 0.35, depthLo: -8, depthHi: -2.5, swimSpeed: 1.7, catchable: true, harpoonable: false, catchXp: 10, rarity: 'common' },
  { id: 'cute_turbot', name: 'Turbot', label: 'Turbot', modelUrl: cute('Turbot.fbx'), bodyLengthM: 0.4, depthLo: -8, depthHi: -2.5, swimSpeed: 1.8, catchable: true, harpoonable: false, catchXp: 11, rarity: 'common' },
  { id: 'cute_catfish', name: 'ArmoredCatfish', label: 'Armored Catfish', modelUrl: cute('ArmoredCatfish.fbx'), bodyLengthM: 0.45, depthLo: -7, depthHi: -2, swimSpeed: 1.9, catchable: true, harpoonable: false, catchXp: 12, rarity: 'uncommon' },
  { id: 'cute_blobfish', name: 'Blobfish', label: 'Blobfish', modelUrl: cute('Blobfish.fbx'), bodyLengthM: 0.4, depthLo: -14, depthHi: -8, swimSpeed: 1.2, catchable: true, harpoonable: false, catchXp: 22, rarity: 'rare' },
  { id: 'cute_angler', name: 'Anglerfish', label: 'Anglerfish', modelUrl: cute('Anglerfish.fbx'), bodyLengthM: 0.55, depthLo: -15, depthHi: -8, swimSpeed: 1.4, catchable: true, harpoonable: true, catchXp: 28, rarity: 'rare' },
  { id: 'cute_grouper', name: 'CoralGrouper', label: 'Coral Grouper', modelUrl: cute('CoralGrouper.fbx'), bodyLengthM: 0.7, depthLo: -8, depthHi: -2.5, swimSpeed: 2.2, catchable: true, harpoonable: true, catchXp: 18, rarity: 'uncommon' },
  { id: 'cute_humphead', name: 'Humphead', label: 'Humphead', modelUrl: cute('Humphead.fbx'), bodyLengthM: 0.85, depthLo: -8, depthHi: -2.5, swimSpeed: 2.0, catchable: true, harpoonable: true, catchXp: 22, rarity: 'rare' },
  { id: 'cute_redsnapper', name: 'RedSnapper', label: 'Red Snapper', modelUrl: cute('RedSnapper.fbx'), bodyLengthM: 0.55, depthLo: -7, depthHi: -2, swimSpeed: 3.0, catchable: true, harpoonable: true, catchXp: 16, rarity: 'uncommon' },
  { id: 'cute_piranha', name: 'Piranha', label: 'Piranha', modelUrl: cute('Piranha.fbx'), bodyLengthM: 0.32, depthLo: -5, depthHi: -1.2, swimSpeed: 4.2, catchable: true, harpoonable: true, catchXp: 15, rarity: 'uncommon' },
  { id: 'cute_tuna', name: 'Tuna', label: 'Tuna', modelUrl: cute('Tuna.fbx'), bodyLengthM: 1.4, depthLo: -12, depthHi: -4, swimSpeed: 6.5, catchable: true, harpoonable: true, catchXp: 35, rarity: 'rare' },
  { id: 'cute_swordfish', name: 'Swordfish', label: 'Swordfish', modelUrl: cute('Swordfish.fbx'), bodyLengthM: 2.1, depthLo: -13, depthHi: -5, swimSpeed: 7.2, catchable: false, harpoonable: true, catchXp: 45, rarity: 'rare' },
  { id: 'cute_sunfish', name: 'Sunfish', label: 'Sunfish', modelUrl: cute('Sunfish.fbx'), bodyLengthM: 1.6, depthLo: -10, depthHi: -3, swimSpeed: 1.5, catchable: false, harpoonable: true, catchXp: 40, rarity: 'rare' },
  { id: 'cute_goblinshark', name: 'GoblinShark', label: 'Goblin Shark', modelUrl: cute('GoblinShark.fbx'), bodyLengthM: 2.2, depthLo: -15, depthHi: -8, swimSpeed: 3.4, catchable: false, harpoonable: true, catchXp: 48, rarity: 'epic' },
  { id: 'cute_shark', name: 'CuteShark', label: 'Shark', modelUrl: cute('Shark.fbx'), bodyLengthM: 1.8, depthLo: -12, depthHi: -4, swimSpeed: 5.2, catchable: false, harpoonable: true, catchXp: 42, rarity: 'rare' },
];

/** Codex + spawn table: cute pack first, then Quaternius large fauna. */
export const ALL_OCEAN_FISH: QuaterniusFishDef[] = [...CUTE_FISH, ...QUATERNIUS_FISH];

export const CUTE_DOCK_URLS = {
  long: cute('Dock_Long.fbx'),
  longNoRope: cute('Dock_Long_NoRope.fbx'),
  wide: cute('Dock_Wide.fbx'),
  stairs: cute('Dock_Stairs.fbx'),
} as const;

export const CUTE_ROD_URLS = {
  lvl1: cute('FishingRod_Lvl1.fbx'),
  lvl2: cute('FishingRod_Lvl2.fbx'),
  lvl3: cute('FishingRod_Lvl3.fbx'),
  lvl4: cute('FishingRod_Lvl4.fbx'),
  lvl5: cute('FishingRod_Lvl5.fbx'),
} as const;

/** Hand fishing pole — SI length for a 1.8 m human. */
export const FISHING_POLE_LENGTH_M = 1.55;
