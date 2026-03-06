export const ATTRIBUTE_IDS = [
  'Strength',
  'Vitality', 
  'Endurance',
  'Intellect',
  'Wisdom',
  'Dexterity',
  'Agility',
  'Tactics'
] as const;

export type AttributeId = typeof ATTRIBUTE_IDS[number];

export interface AttributeBonus {
  stat: string;
  flatBonus: number;
  percentBonus: number;
}

export interface AttributeDefinition {
  id: AttributeId;
  name: string;
  abbreviation: string;
  description: string;
  role: string;
  bonuses: AttributeBonus[];
}

export const ATTRIBUTES: Record<AttributeId, AttributeDefinition> = {
  Strength: {
    id: 'Strength',
    name: 'Strength',
    abbreviation: 'STR',
    description: 'Physical power and combat prowess',
    role: 'Tank / Melee DPS',
    bonuses: [
      { stat: 'health', flatBonus: 26, percentBonus: 0.008 },
      { stat: 'damage', flatBonus: 3, percentBonus: 0.02 },
      { stat: 'defense', flatBonus: 12, percentBonus: 0.015 },
      { stat: 'blockChance', flatBonus: 0.005, percentBonus: 0.05 },
      { stat: 'critChance', flatBonus: 0.0032, percentBonus: 0.07 },
      { stat: 'blockFactor', flatBonus: 0.0085, percentBonus: 0.263 },
      { stat: 'critFactor', flatBonus: 0.011, percentBonus: 0.015 },
    ]
  },
  Vitality: {
    id: 'Vitality',
    name: 'Vitality',
    abbreviation: 'VIT',
    description: 'Life force and resilience',
    role: 'Tank / Survivability',
    bonuses: [
      { stat: 'health', flatBonus: 25, percentBonus: 0.005 },
      { stat: 'mana', flatBonus: 2, percentBonus: 0.002 },
      { stat: 'stamina', flatBonus: 5, percentBonus: 0.001 },
      { stat: 'damage', flatBonus: 2, percentBonus: 0.001 },
      { stat: 'defense', flatBonus: 12, percentBonus: 0 },
      { stat: 'blockFactor', flatBonus: 0.003, percentBonus: 0.17 },
      { stat: 'resistance', flatBonus: 0.005, percentBonus: 0 },
    ]
  },
  Endurance: {
    id: 'Endurance',
    name: 'Endurance',
    abbreviation: 'END',
    description: 'Stamina and defensive capability',
    role: 'Defensive Specialist',
    bonuses: [
      { stat: 'health', flatBonus: 10, percentBonus: 0.001 },
      { stat: 'stamina', flatBonus: 1, percentBonus: 0.003 },
      { stat: 'defense', flatBonus: 12, percentBonus: 0.12 },
      { stat: 'blockChance', flatBonus: 0.0011, percentBonus: 0.735 },
      { stat: 'blockFactor', flatBonus: 0.0027, percentBonus: 0 },
      { stat: 'resistance', flatBonus: 0.0046, percentBonus: 0 },
    ]
  },
  Intellect: {
    id: 'Intellect',
    name: 'Intellect',
    abbreviation: 'INT',
    description: 'Magical power and spell potency',
    role: 'Mage / Caster',
    bonuses: [
      { stat: 'mana', flatBonus: 5, percentBonus: 0.05 },
      { stat: 'damage', flatBonus: 4, percentBonus: 0.025 },
      { stat: 'defense', flatBonus: 2, percentBonus: 0 },
      { stat: 'critChance', flatBonus: 0.0023, percentBonus: 0.001 },
      { stat: 'accuracy', flatBonus: 0.0012, percentBonus: 0.338 },
      { stat: 'resistance', flatBonus: 0.0038, percentBonus: 0.17 },
    ]
  },
  Wisdom: {
    id: 'Wisdom',
    name: 'Wisdom',
    abbreviation: 'WIS',
    description: 'Spiritual power and mana efficiency',
    role: 'Healer / Support / Mana Efficiency',
    bonuses: [
      { stat: 'health', flatBonus: 10, percentBonus: 0 },
      { stat: 'mana', flatBonus: 20, percentBonus: 0.03 },
      { stat: 'damage', flatBonus: 2, percentBonus: 0.015 },
      { stat: 'defense', flatBonus: 2, percentBonus: 0 },
      { stat: 'critChance', flatBonus: 0.005, percentBonus: 0.0015 },
      { stat: 'resistance', flatBonus: 0.005, percentBonus: 0 },
    ]
  },
  Dexterity: {
    id: 'Dexterity',
    name: 'Dexterity',
    abbreviation: 'DEX',
    description: 'Precision and finesse',
    role: 'Rogue / Precision Fighter',
    bonuses: [
      { stat: 'damage', flatBonus: 3, percentBonus: 0.018 },
      { stat: 'defense', flatBonus: 10, percentBonus: 0.01 },
      { stat: 'blockChance', flatBonus: 0.0041, percentBonus: 0.01 },
      { stat: 'critChance', flatBonus: 0.005, percentBonus: 0.012 },
      { stat: 'accuracy', flatBonus: 0.007, percentBonus: 0.015 },
    ]
  },
  Agility: {
    id: 'Agility',
    name: 'Agility',
    abbreviation: 'AGI',
    description: 'Speed and evasion',
    role: 'Mobile DPS / Dodge Tank',
    bonuses: [
      { stat: 'health', flatBonus: 2, percentBonus: 0.006 },
      { stat: 'stamina', flatBonus: 5, percentBonus: 0.005 },
      { stat: 'damage', flatBonus: 3, percentBonus: 0.016 },
      { stat: 'defense', flatBonus: 5, percentBonus: 0.008 },
      { stat: 'critChance', flatBonus: 0.0042, percentBonus: 0.01 },
    ]
  },
  Tactics: {
    id: 'Tactics',
    name: 'Tactics',
    abbreviation: 'TAC',
    description: 'Strategic thinking and battlefield awareness',
    role: 'Strategic Fighter / Commander',
    bonuses: [
      { stat: 'health', flatBonus: 10, percentBonus: 0.084 },
      { stat: 'mana', flatBonus: 0, percentBonus: 0.082 },
      { stat: 'stamina', flatBonus: 1, percentBonus: 0 },
      { stat: 'damage', flatBonus: 3, percentBonus: 0.002 },
      { stat: 'defense', flatBonus: 5, percentBonus: 0.005 },
      { stat: 'blockChance', flatBonus: 0.0027, percentBonus: 0.008 },
    ]
  },
};

export const STARTING_ATTRIBUTE_POINTS = 20;
export const POINTS_PER_LEVEL = 7;
export const MAX_LEVEL = 20;
export const MAX_ATTRIBUTE_POINTS = STARTING_ATTRIBUTE_POINTS + (POINTS_PER_LEVEL * MAX_LEVEL);

export function getTotalAttributePoints(level: number): number {
  return STARTING_ATTRIBUTE_POINTS + (level * POINTS_PER_LEVEL);
}

export function getEffectivePoints(actualPoints: number): number {
  if (actualPoints <= 25) {
    return actualPoints;
  } else if (actualPoints <= 50) {
    return 25 + (actualPoints - 25) * 0.5;
  } else {
    return 25 + 12.5 + (actualPoints - 50) * 0.25;
  }
}

export const CLASS_STARTING_ATTRIBUTES: Record<string, Record<AttributeId, number>> = {
  warrior: { Strength: 10, Vitality: 5, Endurance: 5, Intellect: 0, Wisdom: 0, Dexterity: 0, Agility: 0, Tactics: 0 },
  mage: { Strength: 0, Vitality: 0, Endurance: 0, Intellect: 10, Wisdom: 10, Dexterity: 0, Agility: 0, Tactics: 0 },
  rogue: { Strength: 6, Vitality: 0, Endurance: 0, Intellect: 0, Wisdom: 0, Dexterity: 7, Agility: 7, Tactics: 0 },
  cleric: { Strength: 0, Vitality: 5, Endurance: 0, Intellect: 5, Wisdom: 10, Dexterity: 0, Agility: 0, Tactics: 0 },
};

export function getClassStartingAttributes(classId: string): Record<AttributeId, number> {
  return CLASS_STARTING_ATTRIBUTES[classId] || CLASS_STARTING_ATTRIBUTES.warrior;
}
