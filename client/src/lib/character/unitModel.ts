/**
 * unitModel — the single canonical map from a game character (race + class /
 * weaponStyle) to its baked faction GLB, so every consumer resolves the SAME
 * model the SAME way.
 *
 * Reconciles the three vocabularies in the codebase:
 *   • `racesClasses.ts` game classes:  warrior · mage · ranger · rogue · worge
 *   • `captainBuild.ts` ClassKey:       warrior · mage · ranger · worge
 *   • `factionUnits.ts` UnitClass:      knight · mage · ranger · warrior
 *   • `toonRTSAssets.ts` WeaponStyle:   sword_shield · greatsword · bow · spear
 *                                       · staff · gun · axe · mace_shield
 *
 * Each faction GLB is per (race, UnitClass) and ships its weapon BAKED into the
 * mesh (knight = sword+shield, mage = staff, ranger = bow, warrior = greatsword/
 * spear/axe depending on race). So the UnitClass alone determines both the model
 * and the visible weapon — callers never attach an external weapon.
 */

import type { Faction, Race, WeaponStyle } from '@/data/toonRTSAssets';
import {
  FACTION_UNIT_RACES,
  unitGLBPath,
  type UnitClass,
  type UnitRace,
} from '@/data/factionUnits';
import type { ClassKey } from '@/lib/captainBuild';

/** Reverse index: game Race → its faction + faction-unit race descriptor. */
const RACE_TO_UNIT: Record<Race, { faction: Faction; unitRace: UnitRace }> = (() => {
  const out = {} as Record<Race, { faction: Faction; unitRace: UnitRace }>;
  (Object.keys(FACTION_UNIT_RACES) as Faction[]).forEach((faction) => {
    for (const ur of FACTION_UNIT_RACES[faction]) {
      out[ur.race] = { faction, unitRace: ur };
    }
  });
  return out;
})();

/**
 * WeaponStyle → the faction UnitClass whose GLB bakes that weapon.
 *  • staff → mage · bow/gun → ranger · sword_shield/mace_shield → knight
 *  • greatsword/axe/spear → warrior (two-handed melee builds)
 */
export const WEAPON_STYLE_TO_UNIT_CLASS: Record<WeaponStyle, UnitClass> = {
  staff: 'mage',
  bow: 'ranger',
  gun: 'ranger',
  sword_shield: 'knight',
  mace_shield: 'knight',
  greatsword: 'warrior',
  axe: 'warrior',
  spear: 'warrior',
};

/** captainBuild ClassKey → faction UnitClass (worge maps to the warrior build). */
export const CLASS_KEY_TO_UNIT_CLASS: Record<ClassKey, UnitClass> = {
  mage: 'mage',
  warrior: 'warrior',
  ranger: 'ranger',
  worge: 'warrior',
};

/** racesClasses game class id → faction UnitClass. */
export const GAME_CLASS_TO_UNIT_CLASS: Record<string, UnitClass> = {
  warrior: 'warrior',
  mage: 'mage',
  ranger: 'ranger',
  rogue: 'ranger',
  worge: 'warrior',
  knight: 'knight',
};

export interface ResolvedUnitModel {
  faction: Faction;
  /** GLB filename slug, e.g. `western-kingdoms`. */
  raceSlug: string;
  race: Race;
  unitClass: UnitClass;
  /** Absolute public path to the baked GLB. */
  path: string;
}

export interface ResolveUnitOptions {
  weaponStyle?: WeaponStyle | null;
  unitClass?: UnitClass | null;
  classKey?: ClassKey | null;
  /** raw racesClasses game-class id (warrior/mage/ranger/rogue/worge). */
  gameClass?: string | null;
}

/** Pick the UnitClass from whatever the caller knows; defaults to `warrior`. */
export function resolveUnitClass(opts: ResolveUnitOptions = {}): UnitClass {
  if (opts.unitClass) return opts.unitClass;
  if (opts.weaponStyle) return WEAPON_STYLE_TO_UNIT_CLASS[opts.weaponStyle];
  if (opts.classKey) return CLASS_KEY_TO_UNIT_CLASS[opts.classKey];
  if (opts.gameClass) return GAME_CLASS_TO_UNIT_CLASS[opts.gameClass] ?? 'warrior';
  return 'warrior';
}

/** True if the given race has a shipped faction GLB. */
export function hasUnitModel(race: Race): boolean {
  return race in RACE_TO_UNIT;
}

/**
 * Resolve the canonical faction GLB for a race + class/weaponStyle. Returns
 * `null` only if the race is unknown (all 6 canonical races are supported).
 */
export function resolveUnitModel(race: Race, opts: ResolveUnitOptions = {}): ResolvedUnitModel | null {
  const entry = RACE_TO_UNIT[race];
  if (!entry) return null;
  const unitClass = resolveUnitClass(opts);
  return {
    faction: entry.faction,
    raceSlug: entry.unitRace.slug,
    race,
    unitClass,
    path: unitGLBPath(entry.faction, entry.unitRace.slug, unitClass),
  };
}
