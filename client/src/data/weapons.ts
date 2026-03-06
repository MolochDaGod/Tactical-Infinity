// Weapon definitions with tiered stats for GRUDGE tactical game
// Stats scale with tier (T1-T8)

export interface WeaponStats {
  damageBase: number;
  damagePerTier: number;
  speedBase: number;
  speedPerTier: number;
  comboBase: number;
  comboPerTier: number;
  critBase: number;
  critPerTier: number;
  blockBase: number;
  blockPerTier: number;
  defenseBase: number;
  defensePerTier: number;
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  category: WeaponCategory;
  stats: WeaponStats;
  basicAbility: string;
  signatureAbility: string;
  passives: string[];
  lore: string;
  craftedBy: Profession;
}

export type WeaponType = 
  | "Sword" | "Axe" | "Dagger" | "Hammer1h" | "Hammer2h" 
  | "Greatsword" | "Greataxe" | "Bow" | "Crossbow" | "Gun"
  | "Fire Staff" | "Frost Staff" | "Nature Staff" | "Holy Staff" 
  | "Arcane Staff" | "Lightning Staff"
  | "Fire Tome" | "Frost Tome" | "Nature Tome" | "Holy Tome" 
  | "Arcane Tome" | "Lightning Tome";

export type WeaponCategory = "Melee1h" | "Melee2h" | "Ranged" | "Magic" | "Tome";

export type Profession = "Blacksmith" | "Bowyer" | "Enchanter" | "Alchemist";

// Tier labels for equipment progression (T1-T8)
export const TIER_LABELS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

// Calculate weapon stat at specific tier
export function getWeaponStatAtTier(base: number, perTier: number, tier: number): number {
  return Math.round(base + perTier * tier);
}

// All weapons in the game
export const ALL_WEAPONS: Weapon[] = [
  // MELEE 1H WEAPONS
  {
    id: "iron_sword",
    name: "Iron Sword",
    type: "Sword",
    category: "Melee1h",
    stats: {
      damageBase: 20, damagePerTier: 8,
      speedBase: 12, speedPerTier: 2,
      comboBase: 2, comboPerTier: 0.5,
      critBase: 5, critPerTier: 1,
      blockBase: 3, blockPerTier: 0.5,
      defenseBase: 5, defensePerTier: 2,
    },
    basicAbility: "Slash - Quick sword strike dealing weapon damage",
    signatureAbility: "Riposte - Counter next attack and deal 150% damage",
    passives: ["Parry Chance (+5%)", "Critical Strike (+3%)"],
    lore: "The backbone of any warrior's arsenal, reliable and deadly.",
    craftedBy: "Blacksmith",
  },
  {
    id: "battle_axe",
    name: "Battle Axe",
    type: "Axe",
    category: "Melee1h",
    stats: {
      damageBase: 28, damagePerTier: 10,
      speedBase: 8, speedPerTier: 1.5,
      comboBase: 1, comboPerTier: 0.3,
      critBase: 8, critPerTier: 1.5,
      blockBase: 1, blockPerTier: 0.2,
      defenseBase: 2, defensePerTier: 1,
    },
    basicAbility: "Cleave - Heavy swing dealing weapon damage",
    signatureAbility: "Rend - Deep wound causing bleed for 3 turns",
    passives: ["Armor Piercing (+10%)", "Bloodlust (+5% on kill)"],
    lore: "Designed to break through shields and armor alike.",
    craftedBy: "Blacksmith",
  },
  {
    id: "shadow_dagger",
    name: "Shadow Dagger",
    type: "Dagger",
    category: "Melee1h",
    stats: {
      damageBase: 15, damagePerTier: 6,
      speedBase: 18, speedPerTier: 3,
      comboBase: 4, comboPerTier: 0.8,
      critBase: 12, critPerTier: 2,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 0, defensePerTier: 0,
    },
    basicAbility: "Stab - Fast attack with bonus crit chance",
    signatureAbility: "Backstab - 200% damage from stealth",
    passives: ["Stealth Damage (+15%)", "Poison Coating (+DoT)"],
    lore: "Whisper-quiet and deadly, favored by assassins.",
    craftedBy: "Blacksmith",
  },
  {
    id: "war_hammer",
    name: "War Hammer",
    type: "Hammer1h",
    category: "Melee1h",
    stats: {
      damageBase: 25, damagePerTier: 9,
      speedBase: 6, speedPerTier: 1,
      comboBase: 1, comboPerTier: 0.2,
      critBase: 3, critPerTier: 0.5,
      blockBase: 5, blockPerTier: 1,
      defenseBase: 8, defensePerTier: 3,
    },
    basicAbility: "Smash - Crushing blow with stun chance",
    signatureAbility: "Shatter - Break enemy armor for 2 turns",
    passives: ["Stun Chance (+8%)", "Shield Breaker (+20%)"],
    lore: "Built to crush helmets and break bones.",
    craftedBy: "Blacksmith",
  },

  // MELEE 2H WEAPONS
  {
    id: "greatsword",
    name: "Greatsword",
    type: "Greatsword",
    category: "Melee2h",
    stats: {
      damageBase: 40, damagePerTier: 15,
      speedBase: 5, speedPerTier: 0.8,
      comboBase: 2, comboPerTier: 0.3,
      critBase: 6, critPerTier: 1,
      blockBase: 2, blockPerTier: 0.3,
      defenseBase: 3, defensePerTier: 1,
    },
    basicAbility: "Mighty Swing - Wide arc hitting adjacent enemies",
    signatureAbility: "Executioner - 300% damage to enemies below 25% HP",
    passives: ["Cleave (+1 target)", "Momentum (+10% next attack)"],
    lore: "A blade that demands strength and delivers devastation.",
    craftedBy: "Blacksmith",
  },
  {
    id: "greataxe",
    name: "Greataxe",
    type: "Greataxe",
    category: "Melee2h",
    stats: {
      damageBase: 50, damagePerTier: 18,
      speedBase: 4, speedPerTier: 0.5,
      comboBase: 1, comboPerTier: 0.2,
      critBase: 10, critPerTier: 1.5,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 0, defensePerTier: 0,
    },
    basicAbility: "Brutal Chop - Devastating overhead strike",
    signatureAbility: "Whirlwind - Spin attack hitting all adjacent",
    passives: ["Berserker (+15% at low HP)", "Armor Crush (+25%)"],
    lore: "The weapon of barbarian champions and warlords.",
    craftedBy: "Blacksmith",
  },
  {
    id: "maul",
    name: "Maul",
    type: "Hammer2h",
    category: "Melee2h",
    stats: {
      damageBase: 45, damagePerTier: 16,
      speedBase: 3, speedPerTier: 0.3,
      comboBase: 1, comboPerTier: 0.1,
      critBase: 4, critPerTier: 0.8,
      blockBase: 8, blockPerTier: 1.5,
      defenseBase: 12, defensePerTier: 4,
    },
    basicAbility: "Ground Pound - AoE stun in small radius",
    signatureAbility: "Earthquake - Knock down all enemies in 2 tile radius",
    passives: ["Stagger (+15%)", "Fortify (+10 Defense after hit)"],
    lore: "When you need to flatten everything in your path.",
    craftedBy: "Blacksmith",
  },

  // RANGED WEAPONS
  {
    id: "longbow",
    name: "Longbow",
    type: "Bow",
    category: "Ranged",
    stats: {
      damageBase: 22, damagePerTier: 8,
      speedBase: 10, speedPerTier: 2,
      comboBase: 2, comboPerTier: 0.4,
      critBase: 8, critPerTier: 1.5,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 0, defensePerTier: 0,
    },
    basicAbility: "Aimed Shot - Precise shot with extended range",
    signatureAbility: "Rain of Arrows - Barrage hitting 3x3 area",
    passives: ["Range +2", "Piercing Shot (ignore cover)"],
    lore: "The hunter's companion, striking from afar.",
    craftedBy: "Bowyer",
  },
  {
    id: "crossbow",
    name: "Crossbow",
    type: "Crossbow",
    category: "Ranged",
    stats: {
      damageBase: 30, damagePerTier: 11,
      speedBase: 6, speedPerTier: 1,
      comboBase: 1, comboPerTier: 0.2,
      critBase: 6, critPerTier: 1,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 2, defensePerTier: 0.5,
    },
    basicAbility: "Bolt Shot - High damage single target",
    signatureAbility: "Explosive Bolt - AoE damage on impact",
    passives: ["Armor Piercing (+15%)", "Steady Aim (+5% per turn waited)"],
    lore: "Mechanical precision meets raw stopping power.",
    craftedBy: "Bowyer",
  },
  {
    id: "flintlock",
    name: "Flintlock Pistol",
    type: "Gun",
    category: "Ranged",
    stats: {
      damageBase: 35, damagePerTier: 12,
      speedBase: 4, speedPerTier: 0.5,
      comboBase: 1, comboPerTier: 0.1,
      critBase: 15, critPerTier: 2,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 0, defensePerTier: 0,
    },
    basicAbility: "Quick Draw - Fast shot with lower accuracy",
    signatureAbility: "Headshot - Guaranteed critical if target stationary",
    passives: ["Point Blank (+25% at range 1)", "Reload Haste (+1 speed)"],
    lore: "The thunder of progress, one shot at a time.",
    craftedBy: "Blacksmith",
  },

  // MAGIC STAVES
  {
    id: "fire_staff",
    name: "Fire Staff",
    type: "Fire Staff",
    category: "Magic",
    stats: {
      damageBase: 28, damagePerTier: 10,
      speedBase: 8, speedPerTier: 1.5,
      comboBase: 2, comboPerTier: 0.3,
      critBase: 5, critPerTier: 1,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 3, defensePerTier: 1,
    },
    basicAbility: "Firebolt - Single target fire damage",
    signatureAbility: "Inferno - Large AoE burning damage over time",
    passives: ["Burn Duration +1", "Fire Mastery (+15% fire damage)"],
    lore: "Channels the primordial flames of destruction.",
    craftedBy: "Enchanter",
  },
  {
    id: "frost_staff",
    name: "Frost Staff",
    type: "Frost Staff",
    category: "Magic",
    stats: {
      damageBase: 22, damagePerTier: 8,
      speedBase: 10, speedPerTier: 2,
      comboBase: 2, comboPerTier: 0.4,
      critBase: 4, critPerTier: 0.8,
      blockBase: 2, blockPerTier: 0.5,
      defenseBase: 5, defensePerTier: 2,
    },
    basicAbility: "Ice Shard - Slowing projectile attack",
    signatureAbility: "Blizzard - AoE slow and damage over 3 turns",
    passives: ["Slow Duration +1", "Frozen Heart (+10 mana)"],
    lore: "The cold embrace of winter made manifest.",
    craftedBy: "Enchanter",
  },
  {
    id: "nature_staff",
    name: "Nature Staff",
    type: "Nature Staff",
    category: "Magic",
    stats: {
      damageBase: 18, damagePerTier: 6,
      speedBase: 12, speedPerTier: 2,
      comboBase: 3, comboPerTier: 0.5,
      critBase: 3, critPerTier: 0.5,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 8, defensePerTier: 3,
    },
    basicAbility: "Thorns - Damage and create difficult terrain",
    signatureAbility: "Rejuvenation - HoT on ally for 3 turns",
    passives: ["Healing Boost (+20%)", "Nature's Blessing (+5 HP regen)"],
    lore: "Life flows through this staff, nurturing allies.",
    craftedBy: "Enchanter",
  },
  {
    id: "holy_staff",
    name: "Holy Staff",
    type: "Holy Staff",
    category: "Magic",
    stats: {
      damageBase: 15, damagePerTier: 5,
      speedBase: 10, speedPerTier: 2,
      comboBase: 2, comboPerTier: 0.3,
      critBase: 2, critPerTier: 0.5,
      blockBase: 3, blockPerTier: 0.8,
      defenseBase: 10, defensePerTier: 4,
    },
    basicAbility: "Smite - Light damage, extra vs undead",
    signatureAbility: "Divine Shield - Absorb next X damage on ally",
    passives: ["Undead Bane (+50%)", "Blessed Aura (+5 HP to allies)"],
    lore: "Blessed by the divine, a beacon against darkness.",
    craftedBy: "Enchanter",
  },
  {
    id: "arcane_staff",
    name: "Arcane Staff",
    type: "Arcane Staff",
    category: "Magic",
    stats: {
      damageBase: 25, damagePerTier: 9,
      speedBase: 9, speedPerTier: 1.8,
      comboBase: 3, comboPerTier: 0.5,
      critBase: 7, critPerTier: 1.2,
      blockBase: 1, blockPerTier: 0.2,
      defenseBase: 4, defensePerTier: 1.5,
    },
    basicAbility: "Arcane Bolt - Pure magic damage",
    signatureAbility: "Mana Burst - Damage based on current mana",
    passives: ["Mana Efficiency (-10% cost)", "Spell Echo (15% to cast twice)"],
    lore: "Pure arcane energy crystallized into a weapon.",
    craftedBy: "Enchanter",
  },
  {
    id: "lightning_staff",
    name: "Lightning Staff",
    type: "Lightning Staff",
    category: "Magic",
    stats: {
      damageBase: 30, damagePerTier: 11,
      speedBase: 14, speedPerTier: 2.5,
      comboBase: 4, comboPerTier: 0.6,
      critBase: 10, critPerTier: 1.8,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 2, defensePerTier: 0.5,
    },
    basicAbility: "Lightning Bolt - Fast, high crit chance attack",
    signatureAbility: "Chain Lightning - Bounce to 3 additional targets",
    passives: ["Chain Range +1", "Overcharge (+25% crit damage)"],
    lore: "Harness the fury of storms in your hands.",
    craftedBy: "Enchanter",
  },

  // TOMES (offhand magic books)
  {
    id: "fire_tome",
    name: "Tome of Flames",
    type: "Fire Tome",
    category: "Tome",
    stats: {
      damageBase: 10, damagePerTier: 4,
      speedBase: 5, speedPerTier: 1,
      comboBase: 1, comboPerTier: 0.2,
      critBase: 3, critPerTier: 0.6,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 2, defensePerTier: 0.8,
    },
    basicAbility: "Ember - Small fire DoT on attack",
    signatureAbility: "Combustion - Explode all burn effects",
    passives: ["Burn Spread (to adjacent)", "Fire Affinity (+10% fire)"],
    lore: "Ancient knowledge of fire magic contained within.",
    craftedBy: "Enchanter",
  },
  {
    id: "frost_tome",
    name: "Tome of Frost",
    type: "Frost Tome",
    category: "Tome",
    stats: {
      damageBase: 8, damagePerTier: 3,
      speedBase: 6, speedPerTier: 1.2,
      comboBase: 1, comboPerTier: 0.2,
      critBase: 2, critPerTier: 0.4,
      blockBase: 2, blockPerTier: 0.5,
      defenseBase: 4, defensePerTier: 1.5,
    },
    basicAbility: "Chill - Apply slow on spell hit",
    signatureAbility: "Flash Freeze - Immobilize target for 1 turn",
    passives: ["Cold Snap (+freeze chance)", "Ice Armor (+5 defense)"],
    lore: "Pages that never warm, ink that never flows.",
    craftedBy: "Enchanter",
  },
  {
    id: "holy_tome",
    name: "Tome of Light",
    type: "Holy Tome",
    category: "Tome",
    stats: {
      damageBase: 5, damagePerTier: 2,
      speedBase: 8, speedPerTier: 1.5,
      comboBase: 2, comboPerTier: 0.3,
      critBase: 1, critPerTier: 0.3,
      blockBase: 4, blockPerTier: 1,
      defenseBase: 6, defensePerTier: 2,
    },
    basicAbility: "Blessing - Small heal on spell cast",
    signatureAbility: "Resurrection - Revive fallen ally at 25% HP",
    passives: ["Healing Amplify (+15%)", "Light Barrier (absorb 10)"],
    lore: "Words of salvation inscribed by saints.",
    craftedBy: "Enchanter",
  },
];

// Get weapon by ID
export function getWeaponById(id: string): Weapon | undefined {
  return ALL_WEAPONS.find(w => w.id === id);
}

// Get weapons by type
export function getWeaponsByType(type: WeaponType): Weapon[] {
  return ALL_WEAPONS.filter(w => w.type === type);
}

// Get weapons by category
export function getWeaponsByCategory(category: WeaponCategory): Weapon[] {
  return ALL_WEAPONS.filter(w => w.category === category);
}

// Get weapons craftable by profession
export function getWeaponsByProfession(profession: Profession): Weapon[] {
  return ALL_WEAPONS.filter(w => w.craftedBy === profession);
}
