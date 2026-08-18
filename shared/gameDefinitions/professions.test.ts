import { describe, expect, it } from 'vitest';
import {
  FISHERMANS_BOAT_LEVEL,
  FISHERMANS_BOAT_UNLOCK,
  HARVEST_PROFESSION_IDS,
  HARVEST_TREES,
  harvestUnlocksAtLevel,
  isHarvestUnlockReady,
  toolTierForLevel,
} from './professions';

describe('harvest trees', () => {
  it('has exactly six gathering professions on the same 5-band ladder', () => {
    expect(HARVEST_PROFESSION_IDS).toHaveLength(6);
    for (const id of HARVEST_PROFESSION_IDS) {
      const tree = HARVEST_TREES[id];
      expect(tree.tools).toHaveLength(5);
      expect(tree.nodes).toHaveLength(5);
      expect(tree.tools.map((t) => t.levelReq)).toEqual([1, 11, 26, 51, 76]);
      expect(tree.nodes.map((n) => n.levelReq)).toEqual([1, 11, 26, 51, 76]);
    }
  });

  it('unlocks the fisherman boat at journeyman fishing, not as a warship id', () => {
    expect(isHarvestUnlockReady('fishing', FISHERMANS_BOAT_UNLOCK, 25)).toBe(false);
    expect(isHarvestUnlockReady('fishing', FISHERMANS_BOAT_UNLOCK, FISHERMANS_BOAT_LEVEL)).toBe(
      true,
    );
    const learned = harvestUnlocksAtLevel('fishing', 26).map((u) => u.id);
    expect(learned).toContain(FISHERMANS_BOAT_UNLOCK);
    const hull = HARVEST_TREES.fishing.unlocks.find((u) => u.id === FISHERMANS_BOAT_UNLOCK);
    expect(hull?.kind).toBe('hull');
    expect(hull?.modelPath).toBe('/models/fleet/boats/fishermans_boat.glb');
  });

  it('picks tool tiers by level for every tree', () => {
    expect(toolTierForLevel('mining', 1).id).toBe('pick_copper');
    expect(toolTierForLevel('fishing', 26).id).toBe(FISHERMANS_BOAT_UNLOCK);
    expect(toolTierForLevel('woodcutting', 76).tier).toBe(5);
  });
});
