export interface CombatStats {
  health: number;
  mana: number;
  stamina: number;
  damage: number;
  defense: number;
  blockChance: number;
  blockFactor: number;
  critChance: number;
  critFactor: number;
  accuracy: number;
  resistance: number;
  drainHealth: number;
  drainMana: number;
  reflect: number;
  absorbHealth: number;
  absorbMana: number;
  defenseBreak: number;
  blockBreak: number;
  critEvasion: number;
}

export interface CombatResult {
  rawDamage: number;
  mitigatedDamage: number;
  finalDamage: number;
  blocked: boolean;
  critical: boolean;
  healthDrained: number;
  manaDrained: number;
  reflected: number;
  healthAbsorbed: number;
  manaAbsorbed: number;
}

export const STAT_CAPS = {
  blockChance: 0.75,
  critChance: 0.75,
  blockFactor: 0.90,
  critFactor: 3.0,
  accuracy: 0.95,
  resistance: 0.95,
  drainHealth: 0.50,
  drainMana: 0.50,
  reflect: 0.50,
  absorbHealth: 0.50,
  absorbMana: 0.50,
  defenseBreak: 0.75,
  blockBreak: 0.75,
  critEvasion: 0.50,
  defenseReduction: 0.90,
};

export function calculateMitigation(incomingDamage: number, defense: number): number {
  const sqrtDefense = Math.sqrt(defense);
  const reduction = Math.min(sqrtDefense / 100, STAT_CAPS.defenseReduction);
  return incomingDamage * (1 - reduction);
}

export function calculateCombatDamage(
  attacker: Partial<CombatStats>,
  defender: Partial<CombatStats>,
  enableVariance: boolean = true
): CombatResult {
  const atkDamage = attacker.damage || 0;
  const defDefense = defender.defense || 0;
  const atkDefBreak = Math.min(attacker.defenseBreak || 0, STAT_CAPS.defenseBreak);
  const atkBlockBreak = Math.min(attacker.blockBreak || 0, STAT_CAPS.blockBreak);
  
  const effectiveDefense = defDefense * (1 - atkDefBreak);
  
  let damage = calculateMitigation(atkDamage, effectiveDefense);
  
  if (enableVariance) {
    const variance = 0.75 + Math.random() * 0.5;
    damage *= variance;
  }
  
  const effectiveBlockChance = Math.max(0, Math.min(
    (defender.blockChance || 0) - atkBlockBreak,
    STAT_CAPS.blockChance
  ));
  
  let blocked = false;
  if (Math.random() < effectiveBlockChance) {
    blocked = true;
    const blockFactor = Math.min(defender.blockFactor || 0.3, STAT_CAPS.blockFactor);
    damage *= (1 - blockFactor);
  }
  
  let critical = false;
  if (!blocked) {
    const effectiveCritChance = Math.max(0, Math.min(
      (attacker.critChance || 0.05) - (defender.critEvasion || 0),
      STAT_CAPS.critChance
    ));
    
    if (Math.random() < effectiveCritChance) {
      critical = true;
      const critFactor = Math.min(attacker.critFactor || 1.5, STAT_CAPS.critFactor);
      damage *= critFactor;
    }
  }
  
  const finalDamage = Math.max(1, Math.floor(damage));
  
  const drainHealthFactor = Math.min(attacker.drainHealth || 0, STAT_CAPS.drainHealth);
  const drainManaFactor = Math.min(attacker.drainMana || 0, STAT_CAPS.drainMana);
  const healthDrained = Math.floor(finalDamage * drainHealthFactor);
  const manaDrained = Math.floor(finalDamage * drainManaFactor);
  
  let reflected = 0;
  if (!blocked) {
    const reflectFactor = Math.min(defender.reflect || 0, STAT_CAPS.reflect);
    reflected = Math.floor(finalDamage * reflectFactor);
  }
  
  const absorbHealthFactor = Math.min(defender.absorbHealth || 0, STAT_CAPS.absorbHealth);
  const absorbManaFactor = Math.min(defender.absorbMana || 0, STAT_CAPS.absorbMana);
  const healthAbsorbed = Math.floor(finalDamage * absorbHealthFactor);
  const manaAbsorbed = Math.floor(finalDamage * absorbManaFactor);
  
  return {
    rawDamage: atkDamage,
    mitigatedDamage: Math.floor(calculateMitigation(atkDamage, effectiveDefense)),
    finalDamage,
    blocked,
    critical,
    healthDrained,
    manaDrained,
    reflected,
    healthAbsorbed,
    manaAbsorbed,
  };
}

export function checkDebuffSuccess(attackerAccuracy: number, defenderResistance: number): boolean {
  const effectiveChance = Math.max(0.05, Math.min(0.95, attackerAccuracy - defenderResistance));
  return Math.random() < effectiveChance;
}

export const DEFENSE_EXAMPLES = [
  { defense: 100, reduction: 10, example: "100 DMG -> 90 taken" },
  { defense: 400, reduction: 20, example: "100 DMG -> 80 taken" },
  { defense: 900, reduction: 30, example: "100 DMG -> 70 taken" },
  { defense: 2500, reduction: 50, example: "100 DMG -> 50 taken" },
];
