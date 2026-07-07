/**
 * loadout.ts — per-character equipment persistence.
 *
 * A loadout maps canonical `GearSlot`s to gear ids. Loadouts are keyed by a
 * stable character id (captain id, ally id, enemy id, or a preview key like
 * `preview:human:mage`) and persisted to localStorage so equipment survives
 * scene changes and reloads. Subscribers are notified on any change so 3D
 * views can re-apply the loadout live.
 */

import type { GearItem, GearSlot } from '@shared/gameDefinitions/gear';
import { gearById } from './catalogue';

export type Loadout = Partial<Record<GearSlot, string>>;
export type ResolvedLoadout = Partial<Record<GearSlot, GearItem>>;

/**
 * Canonical loadout key for the local player. Shared by the equipment manager
 * UI and the in-game 3D player so editing gear in one drives the other.
 */
export const PLAYER_LOADOUT_ID = 'player';

const STORAGE_KEY = 'gw-loadouts-v1';

type Store = Record<string, Loadout>;

let store: Store | null = null;
const listeners = new Set<(characterId: string, loadout: Loadout) => void>();

function read(): Store {
  if (store) return store;
  if (typeof window === 'undefined') { store = {}; return store; }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    store = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    store = {};
  }
  return store;
}

function persist(): void {
  if (typeof window === 'undefined' || !store) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / disabled — in-memory still works this session */
  }
}

function emit(characterId: string, loadout: Loadout): void {
  for (const cb of listeners) {
    try { cb(characterId, loadout); } catch { /* isolate listener errors */ }
  }
}

/** Get the loadout for a character (empty object if none). */
export function getLoadout(characterId: string): Loadout {
  return { ...(read()[characterId] ?? {}) };
}

/** Equip (gearId) or unequip (null) a single slot. */
export function setSlot(characterId: string, slot: GearSlot, gearId: string | null): Loadout {
  const s = read();
  const current: Loadout = { ...(s[characterId] ?? {}) };
  if (gearId) current[slot] = gearId;
  else delete current[slot];
  s[characterId] = current;
  persist();
  emit(characterId, current);
  return { ...current };
}

/** Replace an entire loadout. */
export function setLoadout(characterId: string, loadout: Loadout): void {
  const s = read();
  s[characterId] = { ...loadout };
  persist();
  emit(characterId, { ...loadout });
}

/** Seed a default loadout only if the character has none yet. */
export function ensureLoadout(characterId: string, defaults: Loadout): Loadout {
  const s = read();
  if (!s[characterId] || Object.keys(s[characterId]).length === 0) {
    s[characterId] = { ...defaults };
    persist();
    emit(characterId, { ...defaults });
  }
  return { ...s[characterId] };
}

/** Resolve a loadout's gear ids to concrete `GearItem`s against a catalogue. */
export function resolveLoadout(loadout: Loadout, catalogue: GearItem[]): ResolvedLoadout {
  const out: ResolvedLoadout = {};
  for (const [slot, id] of Object.entries(loadout)) {
    const item = gearById(catalogue, id);
    if (item) out[slot as GearSlot] = item;
  }
  return out;
}

/** Subscribe to loadout changes. Returns an unsubscribe fn. */
export function subscribeLoadout(cb: (characterId: string, loadout: Loadout) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
