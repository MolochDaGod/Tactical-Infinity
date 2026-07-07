/**
 * Helpers for assembling `PlayerHudOverrides` from live scene state.
 *
 * Scenes pass in their player's HP/MP/SP plus an optional captain id; this
 * module reads `captainManager` (when the id resolves), reads URL query
 * params (?race=, ?class=, ?name=, ?level=) as a lightweight override channel,
 * and returns a fully-populated override object.
 *
 * Anything we cannot determine is left undefined so the HUD's placeholder
 * fills it in.
 */

import { captainManager } from '@/lib/captainManager';
import type { PlayerHudOverrides } from './usePlayerHudState';
import { RACE_TO_FACTION, RACE_GLYPH } from './usePlayerHudState';
import type { Race, HotbarSlot } from './types';

const VALID_RACES: ReadonlySet<Race> = new Set<Race>([
  'human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead',
]);

function readUrlParams(): { race?: Race; className?: string; name?: string; level?: number } {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const raceRaw  = (q.get('race') || '').toLowerCase();
  const race     = VALID_RACES.has(raceRaw as Race) ? (raceRaw as Race) : undefined;
  const name     = q.get('name')  || undefined;
  const className = q.get('class') || undefined;
  const levelRaw = q.get('level');
  const level    = levelRaw ? Math.max(1, parseInt(levelRaw, 10) || 1) : undefined;
  return { race, name, className, level };
}

export interface BuildHudOverrideInput {
  /** Live HP — pass current and max from the scene's player state. */
  hp:  { current: number; max: number };
  /** Live MP — optional; many scenes don't track this yet. */
  mp?: { current: number; max: number };
  /** Live SP — optional. */
  sp?: { current: number; max: number };
  /** Optional skill hotbar from the scene (cannon abilities, class skills, etc). */
  hotbar?: HotbarSlot[];
  /** Captain id for `captainManager.getCaptain(id)` lookup. */
  captainId?: string;
  /** Hard-coded fallbacks when neither URL nor captainManager has data. */
  fallback?: { name?: string; race?: Race; className?: string; level?: number };
}

export function buildHudOverride(input: BuildHudOverrideInput): PlayerHudOverrides {
  const url = readUrlParams();
  const cap = input.captainId ? captainManager.getCaptain(input.captainId) : undefined;

  const race: Race =
    url.race
    ?? (cap?.race as Race | undefined)
    ?? input.fallback?.race
    ?? 'human';

  const name      = url.name      ?? input.fallback?.name      ?? 'Captain';
  const className = url.className ?? input.fallback?.className ?? 'Warlord';
  const level     = url.level     ?? input.fallback?.level     ?? 1;

  const out: PlayerHudOverrides = {
    name,
    classLine:     `Lv.${level} ${className.charAt(0).toUpperCase() + className.slice(1)}`,
    race,
    faction:       RACE_TO_FACTION[race],
    portraitGlyph: RACE_GLYPH[race],
    hp:            input.hp,
  };
  if (input.mp)     out.mp     = input.mp;
  if (input.sp)     out.sp     = input.sp;
  if (input.hotbar) out.hotbar = input.hotbar;
  return out;
}

/**
 * Convenience flag check — Cinzel is now the *single* default HUD across
 * character-action scenes (production island, island battle, open-water
 * sailing). Returns true unless the dev escape hatch `?legacyhud=1` is set,
 * which restores the older `GameHUD` for side-by-side comparison.
 */
export function isCinzelHudEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const q = new URLSearchParams(window.location.search);
  const legacy = (q.get('legacyhud') || q.get('classichud') || '').toLowerCase();
  if (legacy === '1' || legacy === 'true') return false;
  return true;
}

/** Inverse helper for scenes that need to know when to render the legacy HUD. */
export function isLegacyHudEnabled(): boolean {
  return !isCinzelHudEnabled();
}
