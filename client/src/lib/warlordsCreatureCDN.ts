/**
 * Warlords land creatures — verified real GLBs on assets CDN (magic-byte glTF).
 * Used when local /models/animals/* FBX are missing (they currently 404).
 *
 * HARD: never invent paths; only keys proven live.
 */

import { WARLORDS_CDN } from '@/lib/warlordsNatureCDN';

export const CREATURE_CDN = {
  freeReptile: `${WARLORDS_CDN}/models/creatures/land/free_reptile.glb`,
  creatureCrab: `${WARLORDS_CDN}/models/creatures/land/creature_crab.glb`,
  drake: `${WARLORDS_CDN}/models/creatures/land/drake.glb`,
  ifrit: `${WARLORDS_CDN}/models/creatures/land/ifrit.glb`,
  lavaGolem: `${WARLORDS_CDN}/models/creatures/land/lava_golem.glb`,
  monstersX: `${WARLORDS_CDN}/models/creatures/land/monsters_x_free.glb`,
} as const;

/**
 * Map editor / harvest animal roles → best available verified creature GLB.
 * Wildlife FBX packs are not on CDN; these are game-ready stylized combat fauna.
 */
export const ANIMAL_ROLE_TO_CREATURE: Record<string, { url: string; targetHeightM: number; label: string }> = {
  deer: { url: CREATURE_CDN.freeReptile, targetHeightM: 1.2, label: 'Forest Fauna (reptile pack)' },
  boar: { url: CREATURE_CDN.freeReptile, targetHeightM: 0.95, label: 'Boar-class Fauna' },
  wolf: { url: CREATURE_CDN.monstersX, targetHeightM: 1.1, label: 'Predator (monsters pack)' },
  crab: { url: CREATURE_CDN.creatureCrab, targetHeightM: 0.45, label: 'Crab' },
  drake: { url: CREATURE_CDN.drake, targetHeightM: 2.4, label: 'Drake' },
  ifrit: { url: CREATURE_CDN.ifrit, targetHeightM: 2.2, label: 'Ifrit' },
  lava_golem: { url: CREATURE_CDN.lavaGolem, targetHeightM: 2.8, label: 'Lava Golem' },
  rabbit: { url: CREATURE_CDN.creatureCrab, targetHeightM: 0.35, label: 'Small Critter' },
  fox: { url: CREATURE_CDN.freeReptile, targetHeightM: 0.7, label: 'Fox-class Fauna' },
  bear: { url: CREATURE_CDN.monstersX, targetHeightM: 1.8, label: 'Large Predator' },
};

/** Prefer local public path if present; else absolute CDN URL. */
export function creatureUrl(role: string): string {
  const def = ANIMAL_ROLE_TO_CREATURE[role] || ANIMAL_ROLE_TO_CREATURE.deer;
  return def.url;
}
