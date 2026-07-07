/**
 * grudgeAssetConfig — single source of truth for Grudge Studio production
 * asset URLs, bone attachment points, and scene backdrop presets.
 *
 * Mirrors RTS-Grudge FactionCharacterRegistry + GrudgeBuilder assetUrl() patterns.
 * Every consumer that loads models/textures/backgrounds should resolve paths here
 * so dev serves from `public/` and production serves from assets.grudge-studio.com.
 */

import { GRUDGE_FLEET } from '@shared/grudgeFleetBridge';
import type { SkyTimeOfDay, SkyWeather } from '@/lib/islandsCanonical/IslandSky';

/** Canonical R2 CDN root (grudge-assets bucket). */
export function getAssetsCdnBase(): string {
  const fromEnv = (import.meta.env.VITE_ASSETS_CDN_URL as string | undefined)?.replace(/\/$/, '');
  return fromEnv || GRUDGE_FLEET.assetsCdn;
}

/** True when runtime should prefer CDN over local public/ paths. */
export function useAssetsCdn(): boolean {
  if (import.meta.env.DEV) return import.meta.env.VITE_USE_ASSETS_CDN === 'true';
  return import.meta.env.VITE_USE_ASSETS_CDN !== 'false';
}

/**
 * Resolve a site-relative asset path (`/models/...`, `/toon_rts/...`) to the
 * correct URL for the current environment.
 */
export function resolveGrudgeAssetUrl(localPath: string): string {
  if (!localPath) return localPath;
  if (/^https?:\/\//i.test(localPath)) return localPath;
  const normalized = localPath.startsWith('/') ? localPath : `/${localPath}`;
  if (!useAssetsCdn()) return normalized;
  return `${getAssetsCdnBase()}${normalized}`;
}

/** grudge6 race models + animation packs on the canonical CDN. */
export const GRUDGE6_CDN = `${getAssetsCdnBase()}/models/grudge6`;

/** Toon RTS customizable character + equipment FBX tree. */
export const TOON_RTS_CDN = `${getAssetsCdnBase()}/toon_rts/Toon_RTS`;

/**
 * Bone containers — identical across all 6 grudge6 / Toon-RTS races (Bip001).
 * Weapon/shield meshes attach to these nodes; armor uses prefix-toggled submeshes.
 */
export const BONE_CONTAINERS = {
  rightHand: 'R_hand_container',
  leftHand: 'L_hand_container',
  leftShield: 'L_shield_container',
  bag: 'Bone_bag',
  wood: 'Bone_wood',
  quiver: 'Quiver_container',
} as const;

export type BoneContainerKey = keyof typeof BONE_CONTAINERS;

/** Regex patterns for baked GLB rigid attachment containers (UnitGLBLoader). */
export const GLB_ATTACH_PATTERNS: Record<'weapon' | 'shield', RegExp[]> = {
  weapon: [/^r_hand_container$/i, /r_.*hand.*container/i, /weapon.*container/i],
  shield: [/^l_shield_container$/i, /shield.*container/i, /l_.*shield/i],
};

export interface SceneBackdropPreset {
  weather: SkyWeather;
  timeOfDay: SkyTimeOfDay;
  /** Multiplier on IslandSky fog strength (1 = default). */
  fogScale?: number;
}

/**
 * Canonical IslandSky presets — production game scenes pull backgrounds from here
 * instead of hardcoded `scene.background` hex colours.
 */
export const CANONICAL_BACKDROPS = {
  /** Waterfall Isle home island (ProductionIsland). */
  homeIsland: { weather: 'cloudy', timeOfDay: 'noon', fogScale: 1.0 } satisfies SceneBackdropPreset,
  /** Generic tropical exploration islands. */
  tropicalIsland: { weather: 'clear', timeOfDay: 'noon', fogScale: 0.85 } satisfies SceneBackdropPreset,
  /** Captain creation / barracks studio. */
  captainStudio: { weather: 'clear', timeOfDay: 'dusk', fogScale: 0.6 } satisfies SceneBackdropPreset,
  /** Temperate combat arenas. */
  battleArena: { weather: 'cloudy', timeOfDay: 'noon', fogScale: 1.1 } satisfies SceneBackdropPreset,
} as const;

export type CanonicalBackdropId = keyof typeof CANONICAL_BACKDROPS;

export function getCanonicalBackdrop(id: CanonicalBackdropId): SceneBackdropPreset {
  return CANONICAL_BACKDROPS[id];
}