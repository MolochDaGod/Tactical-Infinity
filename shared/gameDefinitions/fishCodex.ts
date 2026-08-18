/**
 * Fish codex cards — one view model over Quaternius ocean species
 * + FISH_BEHAVIORS lure table. Used by FishCodex UI and ocean spawn.
 */

import { FISH_BEHAVIORS, LURE_TYPES, getBestLureForFish } from './fishing';

export type FishDifficulty = 1 | 2 | 3 | 4 | 5;

export interface FishCodexCard {
  id: string;
  name: string;
  label: string;
  modelUrl: string;
  modelUrlAlt?: string;
  bodyLengthM: number;
  weightKg: number;
  difficulty: FishDifficulty;
  favoriteLureId: string;
  favoriteLureName: string;
  rarity: string;
  depthLo: number;
  depthHi: number;
  swimSpeed: number;
  catchable: boolean;
  harpoonable: boolean;
  catchXp: number;
  temperament: string;
  valueGold: number;
}

function weightFromLength(m: number): number {
  return Math.max(0.2, Math.round(7.2 * m ** 2.75 * 10) / 10);
}

function difficultyOf(rarity: string, lengthM: number): FishDifficulty {
  if (rarity === 'epic' || lengthM >= 6) return 5;
  if (rarity === 'rare' || lengthM >= 2.2) return 4;
  if (lengthM >= 1.2) return 3;
  if (rarity === 'uncommon') return 2;
  return 1;
}

function valueOf(rarity: string, xp: number): number {
  const mul = rarity === 'epic' ? 8 : rarity === 'rare' ? 4 : rarity === 'uncommon' ? 2 : 1;
  return xp * mul;
}

/** Import lazily to avoid circular import with quaterniusFish (client). */
export function buildFishCard(raw: {
  id: string;
  name: string;
  label: string;
  modelUrl: string;
  modelUrlAlt?: string;
  bodyLengthM: number;
  depthLo?: number;
  depthHi?: number;
  swimSpeed: number;
  catchable: boolean;
  harpoonable: boolean;
  catchXp: number;
  rarity: string;
}): FishCodexCard {
  const lureId = getBestLureForFish(raw.name) ?? 'wormBait';
  const lure = LURE_TYPES[lureId];
  const behavior = FISH_BEHAVIORS[raw.name];
  return {
    id: raw.id,
    name: raw.name,
    label: raw.label,
    modelUrl: raw.modelUrl,
    modelUrlAlt: raw.modelUrlAlt,
    bodyLengthM: raw.bodyLengthM,
    weightKg: weightFromLength(raw.bodyLengthM),
    difficulty: difficultyOf(raw.rarity, raw.bodyLengthM),
    favoriteLureId: lureId,
    favoriteLureName: lure?.name ?? lureId,
    rarity: raw.rarity,
    depthLo: raw.depthLo ?? -8,
    depthHi: raw.depthHi ?? -2,
    swimSpeed: raw.swimSpeed,
    catchable: raw.catchable,
    harpoonable: raw.harpoonable,
    catchXp: raw.catchXp,
    temperament: behavior?.skittishness ?? 'cautious',
    valueGold: valueOf(raw.rarity, raw.catchXp),
  };
}
