/**
 * usePlayerHudState
 *
 * Returns a `PlayerHudState` derived from whatever live game systems are
 * available at runtime. Order of precedence:
 *
 *   1. Optional `override` arg (test / scene-specific values)
 *   2. The active captain on `captainManager` (race + name)
 *   3. A safe placeholder default so the HUD always renders
 *
 * The hook never throws — it degrades gracefully when nothing is wired,
 * so dropping <CinzelOverlay /> into any scene "just works" while richer
 * bindings are added later.
 */

import { useEffect, useState } from 'react';
import type { PlayerHudState, Race, Faction, HotbarSlot } from './types';

export const RACE_TO_FACTION: Record<Race, Faction> = {
  human:     'crusade',
  barbarian: 'crusade',
  dwarf:     'fabled',
  elf:       'fabled',
  orc:       'legion',
  undead:    'legion',
};

export const RACE_GLYPH: Record<Race, string> = {
  human:     '⚔',
  barbarian: '🪓',
  dwarf:     '🛠',
  elf:       '🏹',
  orc:       '☠',
  undead:    '💀',
};

const DEFAULT_HOTBAR: HotbarSlot[] = [
  { key: 1, name: 'Power Strike', icon: '⚔' },
  { key: 2, name: 'Shield Bash',  icon: '🛡' },
  { key: 3, name: 'War Cry',      icon: '📯' },
  { key: 4, name: 'Cleave',       icon: '💥' },
  { key: 5, name: 'Empty',        icon: '',   disabled: true },
  { key: 6, name: 'Ration',       icon: '🍖' },
  { key: 7, name: 'Potion',       icon: '🧪' },
  { key: 8, name: 'Sigil',        icon: '✨' },
  { key: 9, name: 'Empty',        icon: '',   disabled: true },
];

const PLACEHOLDER: PlayerHudState = {
  name:          'Captain',
  classLine:     'Lv.1 Warlord',
  race:          'human',
  portraitGlyph: '⚔',
  faction:       'crusade',
  hp:   { current: 780, max: 1000 },
  mp:   { current: 310, max: 500  },
  sp:   { current: 91,  max: 100  },
  hotbar:   DEFAULT_HOTBAR,
  equipped: [
    { slot: 'weapon', name: 'Bloodfeud Blade', icon: '⚔' },
    { slot: 'armor',  name: 'Bulwark Plate',   icon: '🛡' },
  ],
  chat: [
    { id: 1, text: 'Welcome, Warlord. The grudge is yours to settle.',
      kind: 'system' },
  ],
};

export interface PlayerHudOverrides extends Partial<PlayerHudState> {}

/**
 * Returns a fully-populated `PlayerHudState`. Callers may pass an `override`
 * containing any subset of fields; the rest fall back to the placeholder so
 * the HUD always renders something sensible. To bind to a captain, build a
 * `PlayerHudOverrides` from your captain instance in the host component and
 * pass it in — the hook then keeps state in sync via the effect below.
 */
export function usePlayerHudState(override?: PlayerHudOverrides): PlayerHudState {
  const [state, setState] = useState<PlayerHudState>(() => ({
    ...PLACEHOLDER,
    ...(override || {}),
  }));

  // Re-merge override changes without dropping live state.
  useEffect(() => {
    if (!override) return;
    setState(prev => ({ ...prev, ...override }));
  }, [override]);

  return state;
}
