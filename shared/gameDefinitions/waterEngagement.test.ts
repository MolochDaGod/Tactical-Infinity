import { describe, expect, it } from 'vitest';
import { BOAT_IDS } from './boatRegistry';
import {
  budgetForKind,
  defaultDeckLoadout,
  DECK_STATIONS,
  DOCK_KINDS,
  getDeckStation,
  getDockKind,
  getHullDeckBudget,
  HULL_DECK_BUDGETS,
} from './waterEngagement';

describe('deck stations + dock kinds SSOT', () => {
  it('covers every playable hull', () => {
    for (const id of BOAT_IDS) {
      expect(HULL_DECK_BUDGETS[id].hull).toBe(id);
    }
  });

  it('raft is helm-only; capital hulls get full combat pads', () => {
    const raft = getHullDeckBudget('raft');
    expect(raft.cannon).toBe(0);
    expect(raft.harpoon).toBe(0);
    expect(raft.sniperNest).toBe(0);
    expect(raft.mageSpot).toBe(0);
    expect(raft.helm).toBe(1);

    const war = getHullDeckBudget('manOWar');
    expect(war.cannon).toBe(6);
    expect(war.harpoon).toBe(2);
    expect(war.sniperNest).toBe(1);
    expect(war.mageSpot).toBe(2);
  });

  it('default loadout matches budget counts', () => {
    const load = defaultDeckLoadout('sloop');
    expect(load.filter((s) => s.kind === 'cannon')).toHaveLength(2);
    expect(load.filter((s) => s.kind === 'harpoon')).toHaveLength(1);
    expect(load.filter((s) => s.kind === 'sniper_nest')).toHaveLength(1);
    expect(load.filter((s) => s.kind === 'mage_spot')).toHaveLength(1);
    expect(load.every((s) => s.enabled)).toBe(true);
  });

  it('maps stations to dock crew roles', () => {
    expect(getDeckStation('cannon').crewRole).toBe('gunner');
    expect(getDeckStation('harpoon').crewRole).toBe('sailor');
    expect(getDeckStation('sniper_nest').crewRole).toBe('sailor');
    expect(getDeckStation('mage_spot').crewRole).toBe('weatherman');
    expect(getDeckStation('helm').crewRole).toBe('captain');
    expect(DECK_STATIONS).toHaveLength(5);
  });

  it('budgetForKind stays in lockstep with hull table', () => {
    const b = getHullDeckBudget('galleon');
    expect(budgetForKind(b, 'cannon')).toBe(6);
    expect(budgetForKind(b, 'mage_spot')).toBe(2);
  });

  it('four dock kinds — fishing cannot build hulls; shipyard docks can', () => {
    expect(DOCK_KINDS.map((d) => d.id)).toEqual([
      'fishing_dock',
      'boat_dock',
      'war_dock',
      'capital_dock',
    ]);
    expect(getDockKind('fishing_dock').allowsShipConstruction).toBe(false);
    expect(getDockKind('boat_dock').allowsShipConstruction).toBe(true);
    expect(getDockKind('war_dock').stationPads).toContain('sniper_nest');
    expect(getDockKind('capital_dock').berths).toBe(6);
  });
});
