import type { Race, WeaponStyle } from "@/data/toonRTSAssets";
import { type BoatId, resolveBoatId, DEFAULT_BOAT_ID } from "@shared/gameDefinitions/boatRegistry";
import { isRaftBuilt, resolveActiveBoatId } from "@/lib/playerProgression";

export type ClassKey = "mage" | "warrior" | "ranger" | "worge";

export interface CaptainBuild {
  race: Race;
  classKey: ClassKey;
  weaponStyle: WeaponStyle;
  archetypeId: string;
  picks: Record<number, string[]>;
  lockedAt: number;
  /** Canonical boat this captain sails. Absent builds default to DEFAULT_BOAT_ID. */
  boatId?: BoatId;
}

/**
 * Deterministically resolve the boat a player should spawn with:
 * saved captain build → canonical boat, otherwise the default boat.
 * Never returns an unknown id, so the sailing scene always has a real boat.
 */
export function resolvePlayerBoatId(): BoatId {
  if (!isRaftBuilt()) return 'raft';
  const build = loadCaptainBuild();
  if (build?.boatId) return resolveBoatId(build.boatId);
  return resolveActiveBoatId() ?? DEFAULT_BOAT_ID;
}

const STORAGE_KEY = "gw-captain-build";

export const CLASS_TO_WEAPON_STYLE: Record<ClassKey, WeaponStyle> = {
  mage: "staff",
  warrior: "sword_shield",
  ranger: "bow",
  worge: "axe",
};

export const CLASS_TO_ARCHETYPE: Record<ClassKey, string> = {
  mage: "mage",
  warrior: "paladin",
  ranger: "ranger",
  worge: "berserker",
};

export const CLASS_LABELS: Record<ClassKey, string> = {
  mage: "Mage Priest",
  warrior: "Warrior",
  ranger: "Ranger Scout",
  worge: "Worg Shapeshifter",
};

export function loadCaptainBuild(): CaptainBuild | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CaptainBuild;
  } catch {
    return null;
  }
}

export function saveCaptainBuild(b: CaptainBuild): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

export function clearCaptainBuild(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function buildCaptainFromClassTree(
  race: Race,
  classKey: ClassKey,
  picks: Record<number, string[]>
): CaptainBuild {
  return {
    race,
    classKey,
    weaponStyle: CLASS_TO_WEAPON_STYLE[classKey],
    archetypeId: CLASS_TO_ARCHETYPE[classKey],
    picks,
    lockedAt: Date.now(),
  };
}
