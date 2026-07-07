/**
 * adminOverrides — a single localStorage-backed override store that lets the
 * admin/dev tools push tuning changes into the LIVE game systems.
 *
 * The dev tools (Admin.tsx sprite + weapon tabs, FishingTester, IslandEditor)
 * WRITE here; the live systems (spriteData, AnimatedUnitSprite, battle combat,
 * FishManager spawn, canonical island config) READ here. Everything is keyed
 * under `gw-admin-*` localStorage keys so a fresh checkout with no saved
 * overrides falls back to the shipped defaults (no regression).
 */
import { ALL_WEAPONS } from '@shared/gameDefinitions/weapons';
import type { IslandConfig } from './islandsCanonical/IslandConfig';

const KEYS = {
  sprites: 'gw-admin-sprite-overrides',
  weaponEffects: 'gw-admin-weapon-effects',
  fishWeights: 'gw-admin-fish-weights',
  islands: 'gw-admin-island-overrides',
} as const;

/** Emitted on any override write so live views can re-read if they choose to. */
export const ADMIN_OVERRIDES_EVENT = 'gw-admin-overrides-changed';

export interface SpriteAssignment {
  raceId: string;
  classId: string;
  spriteId: string;
  spritePath: string;
}

export interface WeaponEffectConfig {
  weaponId: string;
  attackEffect: string;
  effectColor: string;
  animationType: 'slash' | 'thrust' | 'swing' | 'projectile' | 'spell';
  attackRange: number;
  attackSpeed: number;
  projectileSpeed: number;
  impactEffect: string;
  soundEffect: string;
}

export interface PublishedIslandOverride {
  name: string;
  maxHeight: number;
  waterDepth: number;
  savedAt: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_OVERRIDES_EVENT, { detail: { key } }));
    }
  } catch {
    // Storage full / unavailable — silently ignore, defaults still apply.
  }
}

// ── Sprites ───────────────────────────────────────────────────────────────
// Stored as a flat `${raceId}:${classId}` → spritePath map so live consumers
// (which usually only know the unit class) can resolve by class alone.

export function saveSpriteOverrides(assignments: SpriteAssignment[]): void {
  const map: Record<string, string> = {};
  for (const a of assignments) {
    if (a.spritePath) map[`${a.raceId}:${a.classId}`] = a.spritePath;
  }
  write(KEYS.sprites, map);
}

export function loadSpriteOverrides(): Record<string, string> {
  return read<Record<string, string>>(KEYS.sprites, {});
}

/**
 * Resolve an overridden sprite path for a class (and optionally a race). Falls
 * back to the first race that has an override for the class, then undefined.
 */
export function getSpriteOverridePath(classId: string, raceId?: string): string | undefined {
  const map = loadSpriteOverrides();
  if (raceId && map[`${raceId}:${classId}`]) return map[`${raceId}:${classId}`];
  const hit = Object.keys(map).find((k) => k.endsWith(`:${classId}`));
  return hit ? map[hit] : undefined;
}

// ── Weapon effects ──────────────────────────────────────────────────────────

export function saveWeaponEffects(configs: WeaponEffectConfig[]): void {
  write(KEYS.weaponEffects, configs);
}

export function loadWeaponEffects(): WeaponEffectConfig[] {
  return read<WeaponEffectConfig[]>(KEYS.weaponEffects, []);
}

let _weaponTypeById: Record<string, string> | null = null;
function weaponTypeById(id: string): string | undefined {
  if (!_weaponTypeById) {
    _weaponTypeById = {};
    for (const w of ALL_WEAPONS) _weaponTypeById[w.id] = w.type;
  }
  return _weaponTypeById[id];
}

/**
 * Resolve a saved weapon-effect config for a live weapon TYPE (e.g. "sword").
 * Live units carry a lowercase weaponType, while the admin tool keys configs by
 * concrete weapon id — so we match case-insensitively against the weapon's type.
 * Returns undefined when nothing has been published (defaults keep applying).
 */
export function getWeaponEffectForType(weaponType: string): WeaponEffectConfig | undefined {
  const configs = loadWeaponEffects();
  if (!configs.length) return undefined;
  const wt = weaponType.toLowerCase();
  return configs.find((c) => {
    const t = weaponTypeById(c.weaponId)?.toLowerCase();
    return !!t && (t === wt || t.includes(wt));
  });
}

// ── Fish loot weights ────────────────────────────────────────────────────────
// Map of real FishManager species name → relative spawn weight.

export function saveFishWeights(weights: Record<string, number>): void {
  write(KEYS.fishWeights, weights);
}

export function getFishWeightOverrides(): Record<string, number> {
  return read<Record<string, number>>(KEYS.fishWeights, {});
}

// ── Island publishing ────────────────────────────────────────────────────────
// The editor publishes canonical-relevant fields (peak height, water depth)
// per biome. getIslandConfig() merges these over the shipped ISLAND_CONFIGS.

export function savePublishedIsland(biome: string, override: PublishedIslandOverride): void {
  const all = read<Record<string, PublishedIslandOverride>>(KEYS.islands, {});
  all[biome] = override;
  write(KEYS.islands, all);
}

export function loadPublishedIslands(): Record<string, PublishedIslandOverride> {
  return read<Record<string, PublishedIslandOverride>>(KEYS.islands, {});
}

export function getIslandConfigOverride(biome: string): Partial<IslandConfig> | undefined {
  const all = loadPublishedIslands();
  const o = all[biome];
  if (!o) return undefined;
  return { maxHeight: o.maxHeight, waterDepth: o.waterDepth };
}
