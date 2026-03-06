import { z } from "zod";

// Unit Classes (Warrior, Ranger, Mage, Worge)
export const unitClasses = ["warrior", "ranger", "mage", "worge"] as const;
export type UnitClass = typeof unitClasses[number];

// Terrain Types
export const terrainTypes = ["grass", "stone", "water", "forest", "mountain", "sand"] as const;
export type TerrainType = typeof terrainTypes[number];

// Factions (Crusade, Fabled, Legion)
export const factions = ["crusade", "fabled", "legion"] as const;
export type Faction = typeof factions[number];

// Races within each faction
export const races = ["human", "barbarian", "dwarf", "elf", "orc", "undead"] as const;
export type Race = typeof races[number];

// Faction-Race mapping
export const factionRaces: Record<Faction, Race[]> = {
  crusade: ["human", "barbarian"],
  fabled: ["dwarf", "elf"],
  legion: ["orc", "undead"],
};

// Biome Types for islands
export const biomeTypes = ["temperate", "arctic", "desert", "tropical", "volcanic", "mountain"] as const;
export type BiomeType = typeof biomeTypes[number];

// Resource Types
export const resourceTypes = ["wood", "stone", "ore", "herbs", "crystal", "gold", "fish", "food"] as const;
export type ResourceType = typeof resourceTypes[number];

// Ability Types
export const abilityTypes = ["attack", "heal", "buff", "debuff", "movement"] as const;
export type AbilityType = typeof abilityTypes[number];

// Equipment Slots
export const equipmentSlots = ["weapon", "offhand", "head", "chest", "hands", "feet", "shoulders"] as const;
export type EquipmentSlot = typeof equipmentSlots[number];

// Weapon Types
export const weaponTypes = ["sword", "axe", "dagger", "hammer", "bow", "crossbow", "gun", "staff", "tome"] as const;
export type WeaponType = typeof weaponTypes[number];

// Armor Types
export const armorTypes = ["plate", "leather", "cloth"] as const;
export type ArmorType = typeof armorTypes[number];

// Equipment Tiers (0-8)
export const equipmentTiers = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export type EquipmentTier = typeof equipmentTiers[number];

// Equipment Item Schema
export const equipmentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.enum(equipmentSlots),
  tier: z.number().min(0).max(8),
  weaponType: z.enum(weaponTypes).optional(),
  armorType: z.enum(armorTypes).optional(),
  spritePath: z.string().optional(),
});
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;

// Character Equipment (all slots)
export const characterEquipmentSchema = z.object({
  weapon: equipmentItemSchema.optional(),
  offhand: equipmentItemSchema.optional(),
  head: equipmentItemSchema.optional(),
  chest: equipmentItemSchema.optional(),
  hands: equipmentItemSchema.optional(),
  feet: equipmentItemSchema.optional(),
  shoulders: equipmentItemSchema.optional(),
});
export type CharacterEquipment = z.infer<typeof characterEquipmentSchema>;

// Sprite Configuration for modular character rendering
export const spriteConfigSchema = z.object({
  baseSprite: z.string(),
  frameWidth: z.number().default(64),
  frameHeight: z.number().default(64),
  animations: z.record(z.object({
    frames: z.number(),
    fps: z.number(),
    row: z.number().optional(),
  })).optional(),
});
export type SpriteConfig = z.infer<typeof spriteConfigSchema>;

// ============================================================
// HERO STATS & ATTRIBUTES SYSTEM
// ============================================================

// The 8 Core Attributes
export const attributeNames = ["strength", "vitality", "endurance", "intellect", "wisdom", "dexterity", "agility", "tactics"] as const;
export type AttributeName = typeof attributeNames[number];

// Hero Attributes Schema (the 8 base attributes)
export const heroAttributesSchema = z.object({
  strength: z.number().min(0).default(5),     // Tank / Melee DPS
  vitality: z.number().min(0).default(5),     // Tank / Survivability
  endurance: z.number().min(0).default(5),    // Defensive Specialist
  intellect: z.number().min(0).default(5),    // Mage / Caster
  wisdom: z.number().min(0).default(5),       // Healer / Support
  dexterity: z.number().min(0).default(5),    // Rogue / Precision Fighter
  agility: z.number().min(0).default(5),      // Mobile DPS / Dodge Tank
  tactics: z.number().min(0).default(5),      // Strategic Fighter / Commander
});
export type HeroAttributes = z.infer<typeof heroAttributesSchema>;

// Combat Factors Schema (percentages/multipliers)
export const combatFactorsSchema = z.object({
  blockChance: z.number().min(0).max(0.75).default(0.05),      // Cap: 75%
  blockFactor: z.number().min(0).max(0.90).default(0.30),      // Cap: 90% damage reduction when blocked
  criticalChance: z.number().min(0).max(0.75).default(0.05),   // Cap: 75%
  criticalFactor: z.number().min(1).max(3).default(1.5),       // Cap: 300% (3x damage)
  accuracy: z.number().min(0).max(0.95).default(0.85),         // Cap: 95%
  resistance: z.number().min(0).max(0.95).default(0.10),       // Cap: 95%
  drainHealth: z.number().min(0).max(0.50).default(0),         // Lifesteal, Cap: 50%
  drainMana: z.number().min(0).max(0.50).default(0),           // Manasteal, Cap: 50%
  reflectFactor: z.number().min(0).max(0.50).default(0),       // Damage reflect, Cap: 50%
  absorbHealth: z.number().min(0).max(0.50).default(0),        // Health regen from damage taken, Cap: 50%
  absorbMana: z.number().min(0).max(0.50).default(0),          // Mana regen from damage taken, Cap: 50%
  defenseBreak: z.number().min(0).max(0.50).default(0),        // Reduce target defense, Cap: 50%
  blockBreak: z.number().min(0).max(0.50).default(0),          // Reduce target block chance, Cap: 50%
  critEvasion: z.number().min(0).max(0.50).default(0),         // Reduce incoming crit chance, Cap: 50%
});
export type CombatFactors = z.infer<typeof combatFactorsSchema>;

// Full Hero Stats Schema (derived from attributes + equipment + level)
export const heroStatsSchema = z.object({
  // Primary Resources
  hp: z.number().default(100),
  maxHp: z.number().default(100),
  mana: z.number().default(50),
  maxMana: z.number().default(50),
  stamina: z.number().default(100),
  maxStamina: z.number().default(100),
  
  // Combat Stats
  damage: z.number().default(10),
  defense: z.number().default(10),
  
  // Movement (for tactical grid)
  speed: z.number().default(10),      // Turn order priority
  movement: z.number().default(3),    // Grid tiles per turn
  range: z.number().default(1),       // Attack range in tiles
  
  // Combat Factors
  combatFactors: combatFactorsSchema.default({}),
});
export type HeroStats = z.infer<typeof heroStatsSchema>;

// Unit Stats Schema (simplified for tactical combat, derived from HeroStats)
export const unitStatsSchema = z.object({
  hp: z.number(),
  maxHp: z.number(),
  mana: z.number().default(50),
  maxMana: z.number().default(50),
  attack: z.number(),
  defense: z.number(),
  speed: z.number(),
  movement: z.number(),
  range: z.number(),
  // Combat factors for tactical battles
  blockChance: z.number().default(0.05),
  critChance: z.number().default(0.05),
  critFactor: z.number().default(1.5),
});
export type UnitStats = z.infer<typeof unitStatsSchema>;

// Attribute Bonus Definition (flat + percent per point)
export interface AttributeBonus {
  flat: number;
  percent: number;
}

// Each attribute's effect on stats
export const ATTRIBUTE_BONUSES: Record<AttributeName, Partial<Record<string, AttributeBonus>>> = {
  strength: {
    health: { flat: 26, percent: 0.008 },
    damage: { flat: 3, percent: 0.02 },
    defense: { flat: 12, percent: 0.015 },
    blockChance: { flat: 0.005, percent: 0.05 },
    criticalChance: { flat: 0.0032, percent: 0.07 },
    blockFactor: { flat: 0.0085, percent: 0.263 },
    criticalFactor: { flat: 0.011, percent: 0.015 },
  },
  vitality: {
    health: { flat: 25, percent: 0.005 },
    mana: { flat: 2, percent: 0.002 },
    stamina: { flat: 5, percent: 0.001 },
    damage: { flat: 2, percent: 0.001 },
    defense: { flat: 12, percent: 0 },
    blockFactor: { flat: 0.003, percent: 0.17 },
    resistance: { flat: 0.005, percent: 0 },
  },
  endurance: {
    health: { flat: 10, percent: 0.001 },
    stamina: { flat: 1, percent: 0.003 },
    defense: { flat: 12, percent: 0.12 },
    blockChance: { flat: 0.0011, percent: 0.735 },
    blockFactor: { flat: 0.0027, percent: 0 },
    resistance: { flat: 0.0046, percent: 0 },
  },
  intellect: {
    mana: { flat: 5, percent: 0.05 },
    damage: { flat: 4, percent: 0.025 },
    defense: { flat: 2, percent: 0 },
    criticalChance: { flat: 0.0023, percent: 0.001 },
    accuracy: { flat: 0.0012, percent: 0.338 },
    resistance: { flat: 0.0038, percent: 0.17 },
  },
  wisdom: {
    health: { flat: 10, percent: 0 },
    mana: { flat: 20, percent: 0.03 },
    damage: { flat: 2, percent: 0.015 },
    defense: { flat: 2, percent: 0 },
    criticalChance: { flat: 0.005, percent: 0.0015 },
    resistance: { flat: 0.005, percent: 0 },
  },
  dexterity: {
    damage: { flat: 3, percent: 0.018 },
    defense: { flat: 10, percent: 0.01 },
    blockChance: { flat: 0.0041, percent: 0.01 },
    criticalChance: { flat: 0.005, percent: 0.012 },
    accuracy: { flat: 0.007, percent: 0.015 },
  },
  agility: {
    health: { flat: 2, percent: 0.006 },
    stamina: { flat: 5, percent: 0.005 },
    damage: { flat: 3, percent: 0.016 },
    defense: { flat: 5, percent: 0.008 },
    criticalChance: { flat: 0.0042, percent: 0.01 },
  },
  tactics: {
    health: { flat: 10, percent: 0.084 },
    mana: { flat: 0, percent: 0.082 },
    stamina: { flat: 1, percent: 0 },
    damage: { flat: 3, percent: 0.002 },
    defense: { flat: 5, percent: 0.005 },
    blockChance: { flat: 0.0027, percent: 0.008 },
  },
};

// Stat Caps
export const STAT_CAPS = {
  blockChance: 0.75,
  blockFactor: 0.90,
  criticalChance: 0.75,
  criticalFactor: 3.0,
  accuracy: 0.95,
  resistance: 0.95,
  drainHealth: 0.50,
  drainMana: 0.50,
  reflectFactor: 0.50,
  absorbHealth: 0.50,
  absorbMana: 0.50,
  defenseBreak: 0.50,
  blockBreak: 0.50,
  critEvasion: 0.50,
};

// Diminishing Returns Configuration
export const DIMINISHING_RETURNS_CONFIG = {
  enabled: true,
  threshold: 25,           // When DR kicks in
  tier1Efficiency: 0.5,    // 50% efficiency (points 26-50)
  tier2Efficiency: 0.25,   // 25% efficiency (points 51+)
};

// Calculate effective attribute points (with diminishing returns)
export function getEffectivePoints(points: number): number {
  if (!DIMINISHING_RETURNS_CONFIG.enabled) return points;
  
  const { threshold, tier1Efficiency, tier2Efficiency } = DIMINISHING_RETURNS_CONFIG;
  
  if (points <= threshold) {
    return points;
  } else if (points <= threshold * 2) {
    const excess = points - threshold;
    return threshold + (excess * tier1Efficiency);
  } else {
    const tier1Points = threshold * tier1Efficiency;
    const tier2Points = (points - threshold * 2) * tier2Efficiency;
    return threshold + tier1Points + tier2Points;
  }
}

// Calculate stat bonus from a single attribute
export function calculateAttributeBonus(
  attributeName: AttributeName,
  points: number,
  baseStat: number,
  statName: string
): number {
  const bonuses = ATTRIBUTE_BONUSES[attributeName];
  const bonus = bonuses[statName];
  if (!bonus) return 0;
  
  const effectivePoints = getEffectivePoints(points);
  const flatBonus = bonus.flat * effectivePoints;
  const percentBonus = baseStat * bonus.percent * effectivePoints;
  
  return flatBonus + percentBonus;
}

// Calculate all stats from attributes
export function calculateHeroStats(
  level: number,
  attributes: HeroAttributes,
  baseStats?: Partial<HeroStats>
): HeroStats {
  // Base stats from level
  const baseHealth = 100 + (level * 10);
  const baseMana = 50 + (level * 5);
  const baseStamina = 100 + (level * 5);
  const baseDamage = 10 + (level * 2);
  const baseDefense = 10 + (level * 1);
  
  // Calculate total bonuses from all attributes
  let healthBonus = 0, manaBonus = 0, staminaBonus = 0;
  let damageBonus = 0, defenseBonus = 0;
  let blockChanceBonus = 0, blockFactorBonus = 0;
  let critChanceBonus = 0, critFactorBonus = 0;
  let accuracyBonus = 0, resistanceBonus = 0;
  
  for (const attrName of attributeNames) {
    const points = attributes[attrName] || 0;
    healthBonus += calculateAttributeBonus(attrName, points, baseHealth, "health");
    manaBonus += calculateAttributeBonus(attrName, points, baseMana, "mana");
    staminaBonus += calculateAttributeBonus(attrName, points, baseStamina, "stamina");
    damageBonus += calculateAttributeBonus(attrName, points, baseDamage, "damage");
    defenseBonus += calculateAttributeBonus(attrName, points, baseDefense, "defense");
    blockChanceBonus += calculateAttributeBonus(attrName, points, 0.05, "blockChance");
    blockFactorBonus += calculateAttributeBonus(attrName, points, 0.30, "blockFactor");
    critChanceBonus += calculateAttributeBonus(attrName, points, 0.05, "criticalChance");
    critFactorBonus += calculateAttributeBonus(attrName, points, 1.5, "criticalFactor");
    accuracyBonus += calculateAttributeBonus(attrName, points, 0.85, "accuracy");
    resistanceBonus += calculateAttributeBonus(attrName, points, 0.10, "resistance");
  }
  
  // Apply caps
  const capValue = (value: number, cap: number) => Math.min(value, cap);
  
  const maxHp = Math.floor(baseHealth + healthBonus);
  const maxMana = Math.floor(baseMana + manaBonus);
  const maxStamina = Math.floor(baseStamina + staminaBonus);
  
  return {
    hp: baseStats?.hp ?? maxHp,
    maxHp,
    mana: baseStats?.mana ?? maxMana,
    maxMana,
    stamina: baseStats?.stamina ?? maxStamina,
    maxStamina,
    damage: Math.floor(baseDamage + damageBonus),
    defense: Math.floor(baseDefense + defenseBonus),
    speed: 10 + Math.floor(attributes.agility / 2),
    movement: 3 + Math.floor(attributes.agility / 10),
    range: 1,
    combatFactors: {
      blockChance: capValue(0.05 + blockChanceBonus, STAT_CAPS.blockChance),
      blockFactor: capValue(0.30 + blockFactorBonus, STAT_CAPS.blockFactor),
      criticalChance: capValue(0.05 + critChanceBonus, STAT_CAPS.criticalChance),
      criticalFactor: capValue(1.5 + critFactorBonus, STAT_CAPS.criticalFactor),
      accuracy: capValue(0.85 + accuracyBonus, STAT_CAPS.accuracy),
      resistance: capValue(0.10 + resistanceBonus, STAT_CAPS.resistance),
      drainHealth: 0,
      drainMana: 0,
      reflectFactor: 0,
      absorbHealth: 0,
      absorbMana: 0,
      defenseBreak: 0,
      blockBreak: 0,
      critEvasion: 0,
    },
  };
}

// Calculate damage with defense mitigation (sqrt formula)
export function calculateDamageWithDefense(incomingDamage: number, defense: number): number {
  const sqrtDefense = Math.sqrt(defense);
  const mitigation = sqrtDefense / 100;
  return Math.floor(incomingDamage * (1 - mitigation));
}

// Full combat damage calculation (8-step pipeline)
export function calculateCombatDamage(
  attacker: { damage: number; combatFactors: CombatFactors },
  defender: { defense: number; combatFactors: CombatFactors },
  randomVariance: boolean = true
): { finalDamage: number; isCritical: boolean; isBlocked: boolean } {
  let damage = attacker.damage;
  
  // Step 1: Base damage is already provided
  
  // Step 2: Apply Defense Break
  const effectiveDefense = defender.defense * (1 - attacker.combatFactors.defenseBreak);
  
  // Step 3: Calculate Mitigation (sqrt formula)
  damage = calculateDamageWithDefense(damage, effectiveDefense);
  
  // Step 4: Apply Random Variance (±25%)
  if (randomVariance) {
    const variance = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    damage = Math.floor(damage * variance);
  }
  
  // Step 5: Check Block
  const effectiveBlockChance = Math.max(0, defender.combatFactors.blockChance - attacker.combatFactors.blockBreak);
  const isBlocked = Math.random() < effectiveBlockChance;
  if (isBlocked) {
    damage = Math.floor(damage * (1 - defender.combatFactors.blockFactor));
  }
  
  // Step 6: Check Critical (only if not blocked)
  let isCritical = false;
  if (!isBlocked) {
    const effectiveCritChance = Math.max(0, attacker.combatFactors.criticalChance - defender.combatFactors.critEvasion);
    isCritical = Math.random() < effectiveCritChance;
    if (isCritical) {
      damage = Math.floor(damage * attacker.combatFactors.criticalFactor);
    }
  }
  
  // Step 7: Ensure minimum 1 damage
  damage = Math.max(1, damage);
  
  return { finalDamage: damage, isCritical, isBlocked };
}

// Ability Schema
export const abilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(abilityTypes),
  damage: z.number().optional(),
  healing: z.number().optional(),
  range: z.number(),
  cooldown: z.number(),
  currentCooldown: z.number().default(0),
  manaCost: z.number().default(0),
});
export type Ability = z.infer<typeof abilitySchema>;

// Unit Schema
export const unitSchema = z.object({
  id: z.string(),
  name: z.string(),
  class: z.enum(unitClasses),
  faction: z.enum(factions),
  level: z.number().default(1),
  stats: unitStatsSchema,
  abilities: z.array(abilitySchema),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  isEnemy: z.boolean().default(false),
  portraitIndex: z.number().default(0),
  equipment: characterEquipmentSchema.optional(),
  spriteConfig: spriteConfigSchema.optional(),
});
export type Unit = z.infer<typeof unitSchema>;

// Tile Schema
export const tileSchema = z.object({
  x: z.number(),
  y: z.number(),
  terrain: z.enum(terrainTypes),
  elevation: z.number().default(0),
  occupiedBy: z.string().optional(),
  isHighlighted: z.boolean().default(false),
  highlightType: z.enum(["movement", "attack", "ability", "selected"]).optional(),
});
export type Tile = z.infer<typeof tileSchema>;

// Battle Map Schema
export const battleMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  tiles: z.array(tileSchema),
});
export type BattleMap = z.infer<typeof battleMapSchema>;

// Battle State Schema
export const battleStateSchema = z.object({
  id: z.string(),
  map: battleMapSchema,
  playerUnits: z.array(unitSchema),
  enemyUnits: z.array(unitSchema),
  turnOrder: z.array(z.string()),
  currentTurnIndex: z.number().default(0),
  turnNumber: z.number().default(1),
  phase: z.enum(["player_turn", "enemy_turn", "combat", "victory", "defeat"]),
  selectedUnitId: z.string().optional(),
  selectedAbilityId: z.string().optional(),
});
export type BattleState = z.infer<typeof battleStateSchema>;

// Lore Entry Schema
export const loreEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["history", "factions", "characters", "bestiary", "locations"]),
  content: z.string(),
  unlocked: z.boolean().default(true),
});
export type LoreEntry = z.infer<typeof loreEntrySchema>;

// Combat Result Schema
export const combatResultSchema = z.object({
  attackerId: z.string(),
  defenderId: z.string(),
  damage: z.number(),
  isCritical: z.boolean(),
  isKill: z.boolean(),
});
export type CombatResult = z.infer<typeof combatResultSchema>;

// Game Save Schema
export const gameSaveSchema = z.object({
  id: z.string(),
  playerRoster: z.array(unitSchema),
  battlesWon: z.number().default(0),
  currentBattle: battleStateSchema.optional(),
  unlockedLore: z.array(z.string()),
});
export type GameSave = z.infer<typeof gameSaveSchema>;

// API Request/Response types
export const createBattleRequestSchema = z.object({
  difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
  mapSize: z.enum(["small", "medium", "large"]).default("medium"),
});
export type CreateBattleRequest = z.infer<typeof createBattleRequestSchema>;

export const moveUnitRequestSchema = z.object({
  unitId: z.string(),
  targetX: z.number(),
  targetY: z.number(),
});
export type MoveUnitRequest = z.infer<typeof moveUnitRequestSchema>;

export const useAbilityRequestSchema = z.object({
  unitId: z.string(),
  abilityId: z.string(),
  targetX: z.number(),
  targetY: z.number(),
});
export type UseAbilityRequest = z.infer<typeof useAbilityRequestSchema>;

// Island Resource Node Schema
export const resourceNodeSchema = z.object({
  id: z.string(),
  type: z.enum(resourceTypes),
  x: z.number(),
  y: z.number(),
  quantity: z.number(),
  maxQuantity: z.number(),
  respawnTime: z.number().optional(),
});
export type ResourceNode = z.infer<typeof resourceNodeSchema>;

// Building Types
export const buildingTypes = ["barracks", "archery", "market", "port", "storage", "house", "wall_tower"] as const;
export type BuildingType = typeof buildingTypes[number];

// Building Ages
export const buildingAges = ["first", "second"] as const;
export type BuildingAge = typeof buildingAges[number];

// Island Building Schema
export const islandBuildingSchema = z.object({
  id: z.string(),
  type: z.enum(buildingTypes),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  age: z.enum(buildingAges).default("first"),
  level: z.number().default(1),
  variant: z.number().default(1),
  rotation: z.number().default(0),
  isConstructed: z.boolean().default(false),
  constructionProgress: z.number().default(0),
  productionQueue: z.array(z.string()).default([]),
});
export type IslandBuilding = z.infer<typeof islandBuildingSchema>;

// Island Schema (3x3 grid system)
export const islandSchema = z.object({
  id: z.string(),
  name: z.string(),
  gridX: z.number().min(0).max(2),
  gridY: z.number().min(0).max(2),
  seed: z.number(),
  biome: z.enum(biomeTypes),
  width: z.number().default(10),
  height: z.number().default(10),
  terrain: z.array(z.array(z.number())).optional(),
  buildings: z.array(islandBuildingSchema).default([]),
  resourceNodes: z.array(resourceNodeSchema).default([]),
  campPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  resources: z.object({
    gold: z.number().default(0),
    wood: z.number().default(0),
    stone: z.number().default(0),
    ore: z.number().default(0),
    herbs: z.number().default(0),
    crystal: z.number().default(0),
  }).optional(),
  isDiscovered: z.boolean().default(false),
  isHome: z.boolean().default(false),
});
export type Island = z.infer<typeof islandSchema>;

// 3D Model Configuration for Toon_RTS
export const model3DConfigSchema = z.object({
  race: z.enum(races),
  modelPath: z.string(),
  texturePath: z.string().optional(),
  scale: z.number().default(1),
  animations: z.record(z.string()).optional(),
});
export type Model3DConfig = z.infer<typeof model3DConfigSchema>;

// Extended Unit with race for 3D models
export const raceUnitSchema = unitSchema.extend({
  race: z.enum(races),
  model3D: model3DConfigSchema.optional(),
});
export type RaceUnit = z.infer<typeof raceUnitSchema>;

// Node Types for resource harvesting
export const nodeTypes = ["ore", "herb", "crystal", "wood", "fish", "rare_ore", "ancient_tree", "ley_line"] as const;
export type NodeType = typeof nodeTypes[number];

// Harvester Types
export const harvesterTypes = ["hero", "minion"] as const;
export type HarvesterType = typeof harvesterTypes[number];

// Gathering Professions
export const gatheringProfessions = ["mining", "herbalism", "woodcutting", "fishing"] as const;
export type GatheringProfession = typeof gatheringProfessions[number];

// Node type to profession mapping
export const nodeTypeToProfession: Record<NodeType, GatheringProfession> = {
  ore: "mining",
  rare_ore: "mining",
  crystal: "mining",
  herb: "herbalism",
  wood: "woodcutting",
  ancient_tree: "woodcutting",
  fish: "fishing",
  ley_line: "mining",
};

// Profession Level Schema (1-100)
export const professionLevelSchema = z.object({
  profession: z.enum(gatheringProfessions),
  level: z.number().min(1).max(100).default(1),
  xp: z.number().default(0),
});
export type ProfessionLevel = z.infer<typeof professionLevelSchema>;

// Profession Levels (account-wide)
export const professionLevelsSchema = z.object({
  mining: professionLevelSchema.default({ profession: "mining", level: 1, xp: 0 }),
  herbalism: professionLevelSchema.default({ profession: "herbalism", level: 1, xp: 0 }),
  woodcutting: professionLevelSchema.default({ profession: "woodcutting", level: 1, xp: 0 }),
  fishing: professionLevelSchema.default({ profession: "fishing", level: 1, xp: 0 }),
});
export type ProfessionLevels = z.infer<typeof professionLevelsSchema>;

// Extended Resource Node with tier and harvesting properties
export const harvestableNodeSchema = z.object({
  id: z.string(),
  nodeType: z.enum(nodeTypes),
  x: z.number(),
  y: z.number(),
  tier: z.number().min(1).max(5).default(1),
  currentYield: z.number().default(100),
  maxYield: z.number().default(100),
  respawnTimeMs: z.number().default(300000),
  isActive: z.boolean().default(true),
  harvestYield: z.string(),
  xpReward: z.number().default(10),
  lastHarvestedAt: z.number().optional(),
});
export type HarvestableNode = z.infer<typeof harvestableNodeSchema>;

// Harvester (can be hero or minion)
export const harvesterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(harvesterTypes),
  faction: z.enum(factions).optional(),
  race: z.enum(races).optional(),
  level: z.number().min(1).max(20).default(1),
  harvestingSkill: z.number().min(0).max(100).default(0),
  isAssigned: z.boolean().default(false),
  assignedNodeId: z.string().optional(),
});
export type Harvester = z.infer<typeof harvesterSchema>;

// Harvester Assignment (links harvester to node)
export const harvesterAssignmentSchema = z.object({
  id: z.string(),
  harvesterId: z.string(),
  harvesterName: z.string(),
  harvesterType: z.enum(harvesterTypes),
  nodeId: z.string(),
  nodeType: z.enum(nodeTypes),
  assignedAt: z.number(),
  lastHarvestAt: z.number().optional(),
  totalHarvested: z.number().default(0),
});
export type HarvesterAssignment = z.infer<typeof harvesterAssignmentSchema>;

// Harvest Result (output of a harvest action)
export const harvestResultSchema = z.object({
  nodeId: z.string(),
  harvesterId: z.string(),
  resourceType: z.string(),
  baseYield: z.number(),
  bonusYield: z.number(),
  totalYield: z.number(),
  xpGained: z.number(),
  timestamp: z.number(),
});
export type HarvestResult = z.infer<typeof harvestResultSchema>;

// Tier multipliers for harvest yields
export const TIER_MULTIPLIERS: Record<number, { yieldMultiplier: number; xpMultiplier: number; name: string }> = {
  1: { yieldMultiplier: 1.0, xpMultiplier: 1.0, name: "Common" },
  2: { yieldMultiplier: 1.25, xpMultiplier: 1.2, name: "Uncommon" },
  3: { yieldMultiplier: 1.5, xpMultiplier: 1.5, name: "Rare" },
  4: { yieldMultiplier: 2.0, xpMultiplier: 2.0, name: "Epic" },
  5: { yieldMultiplier: 3.0, xpMultiplier: 3.0, name: "Legendary" },
};

// Calculate harvest yield based on tier and skill
export function calculateHarvestYield(
  baseYield: number,
  nodeTier: number,
  professionLevel: number,
  harvesterSkill: number
): { baseAmount: number; bonusAmount: number; totalAmount: number } {
  const tierMultiplier = TIER_MULTIPLIERS[nodeTier]?.yieldMultiplier ?? 1.0;
  const skillBonus = 1 + (professionLevel / 100) * 0.5;
  const harvesterBonus = 1 + (harvesterSkill / 100) * 0.3;
  
  const baseAmount = Math.floor(baseYield * tierMultiplier);
  const bonusAmount = Math.floor(baseAmount * (skillBonus + harvesterBonus - 2));
  const totalAmount = baseAmount + bonusAmount;
  
  return { baseAmount, bonusAmount, totalAmount: Math.max(1, totalAmount) };
}

// Account Roles
export const accountRoles = ["admin", "developer", "premium", "user", "guest"] as const;
export type AccountRole = typeof accountRoles[number];

// Account Status
export const accountStatuses = ["active", "suspended", "pending", "banned"] as const;
export type AccountStatus = typeof accountStatuses[number];

// Account Schema (replaces legacy User)
export const accountSchema = z.object({
  grudgeUuid: z.string(),
  username: z.string().min(3).max(32),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  passwordHash: z.string().optional(),
  role: z.enum(accountRoles).default("user"),
  isPremium: z.boolean().default(false),
  puterId: z.string().optional(),
  status: z.enum(accountStatuses).default("active"),
  createdAt: z.number(),
  lastLoginAt: z.number().optional(),
  settings: z.object({
    darkMode: z.boolean().default(true),
    soundEnabled: z.boolean().default(true),
    notificationsEnabled: z.boolean().default(true),
  }).optional(),
});
export type Account = z.infer<typeof accountSchema>;

// Insert Account Schema
export const insertAccountSchema = accountSchema.omit({ grudgeUuid: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;

// UUID Ledger Event Types
export const uuidEventTypes = ["created", "transferred", "modified", "consumed", "upgraded", "destroyed"] as const;
export type UuidEventType = typeof uuidEventTypes[number];

// UUID Ledger Entry Schema (tracks all entity history)
export const uuidLedgerEntrySchema = z.object({
  id: z.string(),
  grudgeUuid: z.string(),
  eventType: z.enum(uuidEventTypes),
  accountId: z.string().optional(),
  characterId: z.string().optional(),
  relatedUuids: z.array(z.string()).default([]),
  outputUuid: z.string().optional(),
  previousState: z.string().optional(),
  newState: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.number(),
});
export type UuidLedgerEntry = z.infer<typeof uuidLedgerEntrySchema>;

// Insert UUID Ledger Entry (relatedUuids and metadata optional for convenience)
export const insertUuidLedgerEntrySchema = uuidLedgerEntrySchema
  .omit({ id: true, createdAt: true })
  .extend({
    relatedUuids: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  });
export type InsertUuidLedgerEntry = z.infer<typeof insertUuidLedgerEntrySchema>;

// Entity Registry (tracks all GRUDGE UUIDs)
export const entityRegistrySchema = z.object({
  grudgeUuid: z.string(),
  entityType: z.enum(["character", "item", "crafted_item", "island", "recipe", "transaction", "session", "account", "building", "node"]),
  entityName: z.string(),
  ownerId: z.string().optional(),
  tier: z.number().optional(),
  status: z.enum(["active", "consumed", "destroyed", "transferred"]).default("active"),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.any()).default({}),
});
export type EntityRegistry = z.infer<typeof entityRegistrySchema>;

// Character with GRUDGE UUID
export const grudgeCharacterSchema = z.object({
  grudgeUuid: z.string(),
  name: z.string(),
  class: z.enum(unitClasses),
  faction: z.enum(factions),
  race: z.enum(races),
  level: z.number().default(1),
  stats: unitStatsSchema,
  abilities: z.array(abilitySchema),
  equipment: characterEquipmentSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  isEnemy: z.boolean().default(false),
  portraitIndex: z.number().default(0),
  spriteConfig: spriteConfigSchema.optional(),
  model3D: model3DConfigSchema.optional(),
  accountId: z.string().optional(),
  createdAt: z.number(),
});
export type GrudgeCharacter = z.infer<typeof grudgeCharacterSchema>;

// Inventory Item with GRUDGE UUID
export const grudgeItemSchema = z.object({
  grudgeUuid: z.string(),
  itemId: z.string(),
  name: z.string(),
  tier: z.number().min(0).max(8).default(0),
  quantity: z.number().default(1),
  slot: z.enum(equipmentSlots).optional(),
  weaponType: z.enum(weaponTypes).optional(),
  armorType: z.enum(armorTypes).optional(),
  stats: z.record(z.number()).optional(),
  ownerId: z.string().optional(),
  equippedBy: z.string().optional(),
  createdAt: z.number(),
});
export type GrudgeItem = z.infer<typeof grudgeItemSchema>;

// Island with GRUDGE UUID
export const grudgeIslandSchema = islandSchema.extend({
  grudgeUuid: z.string(),
  ownerId: z.string().optional(),
  createdAt: z.number(),
});
export type GrudgeIsland = z.infer<typeof grudgeIslandSchema>;

// Session Schema for auth
export const sessionSchema = z.object({
  grudgeUuid: z.string(),
  accountId: z.string(),
  token: z.string(),
  expiresAt: z.number(),
  createdAt: z.number(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});
export type Session = z.infer<typeof sessionSchema>;

// Role Permissions
export const ROLE_PERMISSIONS: Record<AccountRole, {
  canManageAccounts: boolean;
  canManageContent: boolean;
  canAccessDevTools: boolean;
  canBypassLimits: boolean;
  maxCharacters: number;
  maxIslands: number;
}> = {
  admin: {
    canManageAccounts: true,
    canManageContent: true,
    canAccessDevTools: true,
    canBypassLimits: true,
    maxCharacters: 999,
    maxIslands: 9,
  },
  developer: {
    canManageAccounts: false,
    canManageContent: true,
    canAccessDevTools: true,
    canBypassLimits: true,
    maxCharacters: 50,
    maxIslands: 9,
  },
  premium: {
    canManageAccounts: false,
    canManageContent: false,
    canAccessDevTools: false,
    canBypassLimits: false,
    maxCharacters: 20,
    maxIslands: 9,
  },
  user: {
    canManageAccounts: false,
    canManageContent: false,
    canAccessDevTools: false,
    canBypassLimits: false,
    maxCharacters: 8,
    maxIslands: 3,
  },
  guest: {
    canManageAccounts: false,
    canManageContent: false,
    canAccessDevTools: false,
    canBypassLimits: false,
    maxCharacters: 3,
    maxIslands: 1,
  },
};

// Helper to check permission
export function hasPermission(role: AccountRole, permission: keyof typeof ROLE_PERMISSIONS.admin): boolean {
  return ROLE_PERMISSIONS[role][permission] as boolean;
}

// Legacy User types for compatibility
export interface User {
  id: string;
  username: string;
  password: string;
}

export interface InsertUser {
  username: string;
  password: string;
}

// ============================================================
// WORLD MAP SAILING SYSTEM TYPES
// ============================================================

// World Map Configuration
export const WORLD_MAP_CONFIG = {
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 3000,
  NUM_ISLANDS: 50,
  NUM_NPC_SHIPS: 15,
  GRAVITY: 0.8,
  PLAYER_ACCELERATION: 0.32,
  PLAYER_ROTATION_SPEED: 0.06,
  CANNON_COOLDOWN: 1.5,
  ISLAND_LAND_COMBAT_DELAY: 3000, // 3 seconds out of combat to land
} as const;

// Ship Types
export const shipTypes = ["sloop", "brigantine", "galleon", "warship"] as const;
export type ShipType = typeof shipTypes[number];

// NPC Ship States
export const npcShipStates = ["patrol", "chase", "attack", "hold", "flee"] as const;
export type NpcShipState = typeof npcShipStates[number];

// Loot Types from naval combat
export const lootTypes = ["gold", "cannonballs", "wood", "cloth", "rum", "fish", "treasure_map", "rare_cargo"] as const;
export type LootType = typeof lootTypes[number];

// Player Ship Schema
export const playerShipSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(shipTypes).default("sloop"),
  x: z.number(),
  y: z.number(),
  vx: z.number().default(0),
  vy: z.number().default(0),
  angle: z.number().default(0),
  hp: z.number(),
  maxHp: z.number(),
  level: z.number().default(1),
  cannonCooldown: z.number().default(0),
  cargoCapacity: z.number().default(100),
  speed: z.number().default(1),
  cannonDamage: z.number().default(20),
  cannonRange: z.number().default(400),
});
export type PlayerShip = z.infer<typeof playerShipSchema>;

// NPC Ship Schema
export const npcShipSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(shipTypes).default("sloop"),
  x: z.number(),
  y: z.number(),
  dir: z.number().default(0),
  speed: z.number(),
  hp: z.number(),
  maxHp: z.number(),
  level: z.number().default(1),
  size: z.number().default(30),
  state: z.enum(npcShipStates).default("patrol"),
  stateTimer: z.number().default(0),
  aggroRange: z.number().default(400),
  attackRange: z.number().default(260),
  cannonCooldown: z.number().default(0),
  faction: z.enum(factions).optional(),
  lootTable: z.array(z.object({
    type: z.enum(lootTypes),
    minAmount: z.number(),
    maxAmount: z.number(),
    chance: z.number(),
  })).optional(),
});
export type NpcShip = z.infer<typeof npcShipSchema>;

// Cannonball Projectile Schema
export const cannonballSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  vx: z.number(),
  vy: z.number(),
  vz: z.number(),
  ownerId: z.string(),
  damage: z.number(),
  travelTime: z.number().default(0),
});
export type Cannonball = z.infer<typeof cannonballSchema>;

// World Map Island Schema
export const worldIslandSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  radius: z.number(),
  biome: z.enum(biomeTypes),
  isDiscovered: z.boolean().default(false),
  isOwned: z.boolean().default(false),
  ownerId: z.string().optional(),
  dockPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  resources: z.array(z.enum(resourceTypes)).default([]),
  hasPort: z.boolean().default(false),
});
export type WorldIsland = z.infer<typeof worldIslandSchema>;

// Floating Loot Schema
export const floatingLootSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  type: z.enum(lootTypes),
  amount: z.number(),
  expiresAt: z.number(),
});
export type FloatingLoot = z.infer<typeof floatingLootSchema>;

// Fishing Spot Schema
export const fishingSpotSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  tier: z.number().min(1).max(5).default(1),
  isActive: z.boolean().default(true),
  fishTypes: z.array(z.string()),
  xpReward: z.number().default(10),
});
export type FishingSpot = z.infer<typeof fishingSpotSchema>;

// Combat State for tracking 3-second landing delay
export const combatStateSchema = z.object({
  inCombat: z.boolean().default(false),
  lastCombatTime: z.number().default(0),
  nearIslandId: z.string().optional(),
  canLand: z.boolean().default(false),
});
export type CombatState = z.infer<typeof combatStateSchema>;

// World Map Game State
export const worldMapStateSchema = z.object({
  playerShip: playerShipSchema,
  npcShips: z.array(npcShipSchema),
  islands: z.array(worldIslandSchema),
  cannonballs: z.array(cannonballSchema),
  floatingLoot: z.array(floatingLootSchema),
  fishingSpots: z.array(fishingSpotSchema),
  camera: z.object({ x: z.number(), y: z.number() }),
  combatState: combatStateSchema,
  inventory: z.record(z.number()).default({}),
  gold: z.number().default(0),
  fishingXp: z.number().default(0),
  combatXp: z.number().default(0),
});
export type WorldMapState = z.infer<typeof worldMapStateSchema>;

// Pirate Names for NPC ships
export const PIRATE_NAMES = [
  "Blackbeard", "Anne Bonny", "Calico Jack", "Bartholomew Roberts",
  "Henry Morgan", "William Kidd", "Mary Read", "Edward Low",
  "Charles Vane", "Francois l'Olonnais", "Black Caesar", "Samuel Bellamy",
  "Stede Bonnet", "Grace O'Malley", "Ching Shih"
] as const;

// Ship tier stats
export const SHIP_TIER_STATS: Record<ShipType, {
  hp: number;
  speed: number;
  cargoCapacity: number;
  cannonDamage: number;
  cannonRange: number;
}> = {
  sloop: { hp: 100, speed: 1.2, cargoCapacity: 50, cannonDamage: 15, cannonRange: 350 },
  brigantine: { hp: 150, speed: 1.0, cargoCapacity: 100, cannonDamage: 25, cannonRange: 400 },
  galleon: { hp: 250, speed: 0.7, cargoCapacity: 200, cannonDamage: 35, cannonRange: 450 },
  warship: { hp: 350, speed: 0.6, cargoCapacity: 150, cannonDamage: 50, cannonRange: 500 },
};

// Loot drop tables by NPC level
export function generateLootTable(level: number): NpcShip["lootTable"] {
  const baseTable: NpcShip["lootTable"] = [
    { type: "gold", minAmount: 10 * level, maxAmount: 50 * level, chance: 1.0 },
    { type: "cannonballs", minAmount: 5, maxAmount: 15, chance: 0.8 },
    { type: "wood", minAmount: 10, maxAmount: 30, chance: 0.5 },
    { type: "cloth", minAmount: 5, maxAmount: 15, chance: 0.4 },
    { type: "rum", minAmount: 2, maxAmount: 8, chance: 0.3 },
  ];
  
  if (level >= 3) {
    baseTable.push({ type: "treasure_map", minAmount: 1, maxAmount: 1, chance: 0.1 });
  }
  if (level >= 5) {
    baseTable.push({ type: "rare_cargo", minAmount: 1, maxAmount: 3, chance: 0.15 });
  }
  
  return baseTable;
}

// Helper: calculate distance between two points
export function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Helper: clamp value between min and max
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
