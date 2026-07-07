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

export interface DiminishingReturnsConfig {
  enabled: boolean;
  threshold: number;
  tier1Efficiency: number;
  tier2Efficiency: number;
}

export const DIMINISHING_RETURNS: DiminishingReturnsConfig = {
  enabled: true,
  threshold: 25,
  tier1Efficiency: 0.5,
  tier2Efficiency: 0.25,
};

export function getEffectivePoints(actualPoints: number, config = DIMINISHING_RETURNS): number {
  if (!config.enabled) return actualPoints;
  
  const { threshold, tier1Efficiency, tier2Efficiency } = config;
  const tier1Max = threshold * 2;
  
  if (actualPoints <= threshold) {
    return actualPoints;
  } else if (actualPoints <= tier1Max) {
    return threshold + (actualPoints - threshold) * tier1Efficiency;
  } else {
    const tier1Bonus = (tier1Max - threshold) * tier1Efficiency;
    return threshold + tier1Bonus + (actualPoints - tier1Max) * tier2Efficiency;
  }
}

export interface StatCaps {
  blockChance: number;
  critChance: number;
  blockFactor: number;
  critFactor: number;
  accuracy: number;
  resistance: number;
  drainHealth: number;
  drainMana: number;
  reflectDamage: number;
  absorbHealth: number;
  absorbMana: number;
}

export const STAT_CAPS: StatCaps = {
  blockChance: 0.75,
  critChance: 0.75,
  blockFactor: 0.90,
  critFactor: 3.0,
  accuracy: 0.95,
  resistance: 0.95,
  drainHealth: 0.50,
  drainMana: 0.50,
  reflectDamage: 0.50,
  absorbHealth: 0.50,
  absorbMana: 0.50,
};

export function clampStat(stat: keyof StatCaps, value: number): number {
  return Math.min(value, STAT_CAPS[stat]);
}

export interface CombatFormulas {
  damageVariance: number;
  defenseFormula: 'sqrt' | 'flat';
}

export const COMBAT_CONFIG: CombatFormulas = {
  damageVariance: 0.25,
  defenseFormula: 'sqrt',
};

export function calculateDefenseMitigation(defense: number): number {
  if (COMBAT_CONFIG.defenseFormula === 'sqrt') {
    return (100 - Math.sqrt(defense)) / 100;
  }
  return Math.max(0, 1 - defense / 1000);
}

export function calculateDamageAfterDefense(incomingDamage: number, defense: number): number {
  const mitigation = calculateDefenseMitigation(defense);
  return incomingDamage * mitigation;
}

export function applyDamageVariance(baseDamage: number): number {
  const variance = COMBAT_CONFIG.damageVariance;
  const multiplier = 1 + (Math.random() * 2 - 1) * variance;
  return baseDamage * multiplier;
}

export function rollBlock(blockChance: number, blockFactor: number, damage: number): { blocked: boolean; damage: number } {
  const cappedChance = clampStat('blockChance', blockChance);
  const cappedFactor = clampStat('blockFactor', blockFactor);
  
  if (Math.random() < cappedChance) {
    return { blocked: true, damage: damage * (1 - cappedFactor) };
  }
  return { blocked: false, damage };
}

export function rollCritical(critChance: number, critFactor: number, damage: number): { critical: boolean; damage: number } {
  const cappedChance = clampStat('critChance', critChance);
  const cappedFactor = Math.min(critFactor, STAT_CAPS.critFactor);
  
  if (Math.random() < cappedChance) {
    return { critical: true, damage: damage * cappedFactor };
  }
  return { critical: false, damage };
}

export interface CombatResult {
  baseDamage: number;
  afterDefense: number;
  afterVariance: number;
  blocked: boolean;
  critical: boolean;
  finalDamage: number;
  healthDrained: number;
  manaDrained: number;
  damageReflected: number;
}

export function calculateFullCombat(
  baseDamage: number,
  attackerStats: {
    defenseBreak?: number;
    critChance: number;
    critFactor: number;
    drainHealth?: number;
    drainMana?: number;
  },
  defenderStats: {
    defense: number;
    blockChance: number;
    blockFactor: number;
    blockBreakResist?: number;
    critEvasion?: number;
    reflectDamage?: number;
  }
): CombatResult {
  const defenseBreak = attackerStats.defenseBreak ?? 0;
  const effectiveDefense = Math.max(0, defenderStats.defense * (1 - defenseBreak));
  
  const afterDefense = calculateDamageAfterDefense(baseDamage, effectiveDefense);
  const afterVariance = applyDamageVariance(afterDefense);
  
  const blockResult = rollBlock(defenderStats.blockChance, defenderStats.blockFactor, afterVariance);
  
  let finalDamage = blockResult.damage;
  let critical = false;
  
  if (!blockResult.blocked) {
    const critEvasion = defenderStats.critEvasion ?? 0;
    const effectiveCritChance = Math.max(0, attackerStats.critChance - critEvasion);
    const critResult = rollCritical(effectiveCritChance, attackerStats.critFactor, finalDamage);
    finalDamage = critResult.damage;
    critical = critResult.critical;
  }
  
  const drainHealth = clampStat('drainHealth', attackerStats.drainHealth ?? 0);
  const drainMana = clampStat('drainMana', attackerStats.drainMana ?? 0);
  const reflectDamage = blockResult.blocked ? 0 : clampStat('reflectDamage', defenderStats.reflectDamage ?? 0);
  
  return {
    baseDamage,
    afterDefense,
    afterVariance,
    blocked: blockResult.blocked,
    critical,
    finalDamage: Math.round(finalDamage),
    healthDrained: Math.round(finalDamage * drainHealth),
    manaDrained: Math.round(finalDamage * drainMana),
    damageReflected: Math.round(finalDamage * reflectDamage),
  };
}

export const CLASS_STARTING_ATTRIBUTES: Record<string, Record<AttributeId, number>> = {
  warrior: { Strength: 10, Vitality: 5, Endurance: 5, Intellect: 0, Wisdom: 0, Dexterity: 0, Agility: 0, Tactics: 0 },
  mage: { Strength: 0, Vitality: 0, Endurance: 0, Intellect: 10, Wisdom: 10, Dexterity: 0, Agility: 0, Tactics: 0 },
  ranger: { Strength: 3, Vitality: 0, Endurance: 0, Intellect: 0, Wisdom: 0, Dexterity: 10, Agility: 7, Tactics: 0 },
  priest: { Strength: 0, Vitality: 5, Endurance: 0, Intellect: 5, Wisdom: 10, Dexterity: 0, Agility: 0, Tactics: 0 },
};

export function getClassStartingAttributes(classId: string): Record<AttributeId, number> {
  return CLASS_STARTING_ATTRIBUTES[classId] || CLASS_STARTING_ATTRIBUTES.warrior;
}

export interface BaseStats {
  health: number;
  mana: number;
  stamina: number;
  damage: number;
  defense: number;
}

export const BASE_STATS_PER_LEVEL: BaseStats = {
  health: 10,
  mana: 5,
  stamina: 2,
  damage: 2,
  defense: 1,
};

export function calculateBaseStats(level: number): BaseStats {
  return {
    health: 100 + level * BASE_STATS_PER_LEVEL.health,
    mana: 50 + level * BASE_STATS_PER_LEVEL.mana,
    stamina: 20 + level * BASE_STATS_PER_LEVEL.stamina,
    damage: 10 + level * BASE_STATS_PER_LEVEL.damage,
    defense: 5 + level * BASE_STATS_PER_LEVEL.defense,
  };
}

export function calculateAttributeBonus(
  attributePoints: Record<AttributeId, number>,
  stat: string,
  baseStatValue: number
): number {
  let flatTotal = 0;
  let percentTotal = 0;
  
  for (const attrId of ATTRIBUTE_IDS) {
    const effectivePoints = getEffectivePoints(attributePoints[attrId] || 0);
    const attrDef = ATTRIBUTES[attrId];
    
    for (const bonus of attrDef.bonuses) {
      if (bonus.stat === stat) {
        flatTotal += bonus.flatBonus * effectivePoints;
        percentTotal += bonus.percentBonus * effectivePoints;
      }
    }
  }
  
  return flatTotal + (baseStatValue * percentTotal);
}

export function calculateTotalStat(
  stat: string,
  level: number,
  attributePoints: Record<AttributeId, number>,
  equipmentBonus: number = 0,
  traitBonus: number = 0
): number {
  const baseStats = calculateBaseStats(level);
  const baseStat = (baseStats as any)[stat] ?? 0;
  const attrBonus = calculateAttributeBonus(attributePoints, stat, baseStat);
  return baseStat + attrBonus + equipmentBonus + traitBonus;
}
