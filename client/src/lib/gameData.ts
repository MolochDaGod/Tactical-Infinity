import type { Unit, Ability, LoreEntry, Tile, BattleMap, UnitClass, Faction, CharacterEquipment, SpriteConfig } from "@shared/schema";
import { generateEquipment, getCharacterSprite } from "./spriteData";

// Skill tree tiers by class - abilities unlock at levels 0, 1, 5, 10, 15, 20
// Distribution: 1@Level 0, 2@Level 1, 2@Level 5, 3@Level 10, 2@Level 15, 2@Level 20
export interface SkillTier {
  level: number;
  name: string;
  skills: Ability[];
}

export const classSkillTrees: Record<UnitClass, SkillTier[]> = {
  worge: [
    { level: 0, name: "Primal Shift", skills: [
      { id: "bear_form", name: "Bear Form", description: "Transform into WorgBear: massive HP/Defense, threat generation, damage reduction", type: "buff", range: 0, cooldown: 10, currentCooldown: 0, manaCost: 30 },
    ]},
    { level: 1, name: "Pack Instincts", skills: [
      { id: "howl", name: "Howl", description: "AoE fear and enemy debuff", type: "debuff", range: 3, cooldown: 4, currentCooldown: 0, manaCost: 15 },
      { id: "pack_hunt", name: "Pack Hunt", description: "Damage bonus while near allies", type: "buff", range: 2, cooldown: 5, currentCooldown: 0, manaCost: 10 },
    ]},
    { level: 5, name: "Primal Mastery", skills: [
      { id: "feral_rage", name: "Feral Rage", description: "Attack speed and damage boost", type: "buff", range: 0, cooldown: 6, currentCooldown: 0, manaCost: 20 },
      { id: "alpha_call", name: "Alpha Call", description: "Summon temporary wolf allies", type: "buff", range: 0, cooldown: 8, currentCooldown: 0, manaCost: 35 },
    ]},
    { level: 10, name: "Advanced Forms", skills: [
      { id: "alpha_bear", name: "Alpha Bear", description: "AoE taunt + tanking buffs while in Bear form", type: "buff", range: 3, cooldown: 5, currentCooldown: 0, manaCost: 25 },
      { id: "raptor_form", name: "Raptor Form", description: "Stealth DPS form focused on critical strikes", type: "buff", range: 0, cooldown: 10, currentCooldown: 0, manaCost: 30 },
      { id: "blood_frenzy", name: "Blood Frenzy", description: "Damage increases as health decreases", type: "buff", range: 0, cooldown: 8, currentCooldown: 0, manaCost: 20 },
    ]},
    { level: 15, name: "Apex Predator", skills: [
      { id: "apex_predator", name: "Apex Predator", description: "Enhanced tracking and bonus damage vs wounded", type: "attack", damage: 40, range: 1, cooldown: 3, currentCooldown: 0, manaCost: 15 },
      { id: "primal_fury", name: "Primal Fury", description: "Temporary massive stat boost that drains health over time", type: "buff", range: 0, cooldown: 12, currentCooldown: 0, manaCost: 40 },
    ]},
    { level: 20, name: "Legendary Choices", skills: [
      { id: "worg_lord", name: "Worg Lord", description: "Ultimate tank: massive defenses, pack summoning, battlefield control", type: "buff", range: 0, cooldown: 20, currentCooldown: 0, manaCost: 60 },
      { id: "primal_avatar", name: "Primal Avatar", description: "Colossal form: huge stat increase and fear aura", type: "buff", range: 0, cooldown: 20, currentCooldown: 0, manaCost: 60 },
    ]},
  ],
  warrior: [
    { level: 0, name: "Invincibility", skills: [
      { id: "invulnerability", name: "Invulnerability", description: "Temporary immunity (1-4s), scales with trait level", type: "buff", range: 0, cooldown: 15, currentCooldown: 0, manaCost: 40 },
    ]},
    { level: 1, name: "Combat Basics", skills: [
      { id: "taunt", name: "Taunt", description: "Force enemies to target you", type: "debuff", range: 3, cooldown: 3, currentCooldown: 0, manaCost: 10 },
      { id: "quick_strike", name: "Quick Strike", description: "Fast attack with speed bonus", type: "attack", damage: 20, range: 1, cooldown: 0, currentCooldown: 0, manaCost: 5 },
    ]},
    { level: 5, name: "Specialization", skills: [
      { id: "damage_surge", name: "Damage Surge", description: "Temporary damage boost", type: "buff", range: 0, cooldown: 6, currentCooldown: 0, manaCost: 20 },
      { id: "guardians_aura", name: "Guardian's Aura", description: "Defense buff for nearby allies", type: "buff", range: 3, cooldown: 8, currentCooldown: 0, manaCost: 25 },
    ]},
    { level: 10, name: "Advanced Combat", skills: [
      { id: "dual_wield", name: "Dual Wield", description: "Attack speed and multi-hit capability", type: "buff", range: 0, cooldown: 10, currentCooldown: 0, manaCost: 30 },
      { id: "shield_specialist", name: "Shield Specialist", description: "Increases block chance and defense", type: "buff", range: 0, cooldown: 8, currentCooldown: 0, manaCost: 20 },
      { id: "life_drain", name: "Life Drain", description: "Damage heals you for a portion of damage dealt", type: "attack", damage: 25, range: 1, cooldown: 4, currentCooldown: 0, manaCost: 15 },
    ]},
    { level: 15, name: "Master Warrior", skills: [
      { id: "execute", name: "Execute", description: "Bonus damage vs low-health enemies", type: "attack", damage: 50, range: 1, cooldown: 5, currentCooldown: 0, manaCost: 25 },
      { id: "double_strike", name: "Double Strike", description: "Two consecutive attacks", type: "attack", damage: 35, range: 1, cooldown: 3, currentCooldown: 0, manaCost: 20 },
    ]},
    { level: 20, name: "Legendary Warrior", skills: [
      { id: "avatar_form", name: "Avatar Form", description: "All stats boosted and increased size", type: "buff", range: 0, cooldown: 20, currentCooldown: 0, manaCost: 60 },
      { id: "perfect_counter", name: "Perfect Counter", description: "Chance to fully counter incoming attacks and retaliate", type: "buff", range: 0, cooldown: 15, currentCooldown: 0, manaCost: 50 },
    ]},
  ],
  mage: [
    { level: 0, name: "Arcane Affinity", skills: [
      { id: "mana_shield", name: "Mana Shield", description: "Passive shield based on mana; Active: 15s massive crit/spell boost", type: "buff", range: 0, cooldown: 12, currentCooldown: 0, manaCost: 35 },
    ]},
    { level: 1, name: "Basic Arts", skills: [
      { id: "magic_missile", name: "Magic Missile", description: "Multi-projectile damage", type: "attack", damage: 18, range: 4, cooldown: 0, currentCooldown: 0, manaCost: 8 },
      { id: "heal", name: "Heal", description: "Direct single-target healing", type: "heal", healing: 30, range: 3, cooldown: 2, currentCooldown: 0, manaCost: 15 },
    ]},
    { level: 5, name: "Specialization", skills: [
      { id: "fireball", name: "Fireball", description: "AoE damage spell", type: "attack", damage: 35, range: 3, cooldown: 3, currentCooldown: 0, manaCost: 25 },
      { id: "greater_heal", name: "Greater Heal", description: "Powerful single-target heal", type: "heal", healing: 50, range: 3, cooldown: 4, currentCooldown: 0, manaCost: 30 },
    ]},
    { level: 10, name: "Advanced Magic", skills: [
      { id: "lightning_chain", name: "Lightning Chain", description: "Chained multi-target damage", type: "attack", damage: 25, range: 4, cooldown: 4, currentCooldown: 0, manaCost: 30 },
      { id: "blink", name: "Blink", description: "10-yard directional teleport", type: "movement", range: 5, cooldown: 6, currentCooldown: 0, manaCost: 20 },
      { id: "group_heal", name: "Group Heal", description: "AoE heal for the party", type: "heal", healing: 25, range: 3, cooldown: 6, currentCooldown: 0, manaCost: 40 },
    ]},
    { level: 15, name: "Master Tier", skills: [
      { id: "meteor", name: "Meteor", description: "Delayed massive AoE damage", type: "attack", damage: 60, range: 4, cooldown: 8, currentCooldown: 0, manaCost: 50 },
      { id: "portal", name: "Portal", description: "Place/connect portals for team teleportation", type: "movement", range: 10, cooldown: 15, currentCooldown: 0, manaCost: 40 },
    ]},
    { level: 20, name: "Legendary Magic", skills: [
      { id: "archmage", name: "Archmage", description: "Massive spell power, reduced cost and cooldowns", type: "buff", range: 0, cooldown: 20, currentCooldown: 0, manaCost: 60 },
      { id: "reality_tear", name: "Reality Tear", description: "Devastating line-of-effect reality-warping damage", type: "attack", damage: 80, range: 5, cooldown: 12, currentCooldown: 0, manaCost: 70 },
    ]},
  ],
  ranger: [
    { level: 0, name: "Hunter's Instinct", skills: [
      { id: "precision", name: "Precision", description: "Passive accuracy/crit & movement speed in natural terrain", type: "buff", range: 0, cooldown: 0, currentCooldown: 0, manaCost: 0 },
    ]},
    { level: 1, name: "Basic Training", skills: [
      { id: "power_shot", name: "Power Shot", description: "High damage ranged attack", type: "attack", damage: 28, range: 5, cooldown: 0, currentCooldown: 0, manaCost: 8 },
      { id: "stealth_strike", name: "Stealth Strike", description: "High-damage melee strike from stealth", type: "attack", damage: 35, range: 1, cooldown: 3, currentCooldown: 0, manaCost: 15 },
    ]},
    { level: 5, name: "Specialization Path", skills: [
      { id: "multi_shot", name: "Multi Shot", description: "Fire multiple arrows/bullets", type: "attack", damage: 20, range: 4, cooldown: 3, currentCooldown: 0, manaCost: 20 },
      { id: "shadow_step", name: "Shadow Step", description: "Short-range teleport behind enemy", type: "movement", range: 3, cooldown: 4, currentCooldown: 0, manaCost: 15 },
    ]},
    { level: 10, name: "Advanced Techniques", skills: [
      { id: "explosive_shot", name: "Explosive Shot", description: "AoE ranged damage", type: "attack", damage: 30, range: 4, cooldown: 5, currentCooldown: 0, manaCost: 25 },
      { id: "poison_blade", name: "Poison Blade", description: "DoT melee attacks", type: "attack", damage: 15, range: 1, cooldown: 2, currentCooldown: 0, manaCost: 12 },
      { id: "trap_mastery", name: "Trap Mastery", description: "Deploy and upgrade traps", type: "debuff", range: 2, cooldown: 6, currentCooldown: 0, manaCost: 20 },
    ]},
    { level: 15, name: "Master Hunter", skills: [
      { id: "rain_of_arrows", name: "Rain of Arrows", description: "Massive AoE arrow barrage", type: "attack", damage: 40, range: 5, cooldown: 8, currentCooldown: 0, manaCost: 45 },
      { id: "assassinate", name: "Assassinate", description: "High-damage stealth execution against marked targets", type: "attack", damage: 70, range: 1, cooldown: 10, currentCooldown: 0, manaCost: 35 },
    ]},
    { level: 20, name: "Legendary Skills", skills: [
      { id: "storm_of_arrows", name: "Storm of Arrows", description: "Ultimate ranged devastation across a wide area", type: "attack", damage: 55, range: 6, cooldown: 12, currentCooldown: 0, manaCost: 60 },
      { id: "shadow_master", name: "Shadow Master", description: "Enhanced stealth with multiple strikes and finishers", type: "buff", range: 0, cooldown: 15, currentCooldown: 0, manaCost: 50 },
    ]},
  ],
};

// Get abilities for a unit based on their level
export function getAbilitiesForLevel(unitClass: UnitClass, level: number): Ability[] {
  const skillTree = classSkillTrees[unitClass];
  if (!skillTree) return [];
  
  const abilities: Ability[] = [];
  for (const tier of skillTree) {
    if (tier.level <= level && tier.skills.length > 0) {
      // Add first skill from each unlocked tier (player would choose one per tier)
      abilities.push(tier.skills[0]);
    }
  }
  return abilities;
}

// Legacy ability templates for backwards compatibility (uses level 0-5 abilities)
export const abilityTemplates: Record<UnitClass, Ability[]> = {
  warrior: [
    ...classSkillTrees.warrior[0].skills,
    ...classSkillTrees.warrior[1].skills,
  ],
  ranger: [
    ...classSkillTrees.ranger[0].skills,
    ...classSkillTrees.ranger[1].skills,
  ],
  mage: [
    ...classSkillTrees.mage[0].skills,
    ...classSkillTrees.mage[1].skills,
  ],
  worge: [
    ...classSkillTrees.worge[0].skills,
    ...classSkillTrees.worge[1].skills,
  ],
};

// Base stats by class
export const baseStats: Record<UnitClass, { hp: number; maxHp: number; attack: number; defense: number; speed: number; movement: number; range: number; mana: number; maxMana: number; blockChance: number; critChance: number; critFactor: number }> = {
  warrior: { hp: 120, maxHp: 120, attack: 28, defense: 22, speed: 12, movement: 3, range: 1, mana: 40, maxMana: 40, blockChance: 0.08, critChance: 0.05, critFactor: 1.5 },
  ranger:  { hp: 80,  maxHp: 80,  attack: 25, defense: 12, speed: 16, movement: 4, range: 4, mana: 50, maxMana: 50, blockChance: 0.04, critChance: 0.10, critFactor: 1.8 },
  mage:    { hp: 70,  maxHp: 70,  attack: 35, defense: 10, speed: 14, movement: 3, range: 3, mana: 90, maxMana: 90, blockChance: 0.02, critChance: 0.08, critFactor: 2.0 },
  worge:   { hp: 100, maxHp: 100, attack: 30, defense: 15, speed: 18, movement: 5, range: 1, mana: 60, maxMana: 60, blockChance: 0.06, critChance: 0.07, critFactor: 1.6 },
};

// Unit name pools by faction and race
const namesByFactionRace: Record<Faction, Record<string, string[]>> = {
  crusade: {
    human: ["Aldric", "Seraphina", "Cedric", "Elara", "Roland", "Isolde", "Marcus", "Helena"],
    barbarian: ["Grok", "Kira", "Ragnar", "Helga", "Ulf", "Freya", "Bjorn", "Astrid"],
  },
  fabled: {
    dwarf: ["Thorin", "Greta", "Durin", "Helga", "Magnus", "Ingrid", "Olaf", "Freya"],
    elf: ["Aelindra", "Thalion", "Elowen", "Caelan", "Sylphira", "Faelen", "Miriel", "Arannis"],
  },
  legion: {
    orc: ["Grommash", "Shulka", "Zugor", "Morkra", "Thrakk", "Gashna", "Brokk", "Vulgra"],
    undead: ["Malachar", "Seraphyx", "Grimholt", "Whisper", "Dreadbone", "Nythera", "Ashveil", "Mortis"],
  },
};

// Legacy name lookup for backward compatibility
const namesByFaction: Record<Faction, string[]> = {
  crusade: [...namesByFactionRace.crusade.human, ...namesByFactionRace.crusade.barbarian],
  fabled: [...namesByFactionRace.fabled.dwarf, ...namesByFactionRace.fabled.elf],
  legion: [...namesByFactionRace.legion.orc, ...namesByFactionRace.legion.undead],
};

// Faction colors for UI (CSS HSL format)
export const factionColors: Record<Faction, { primary: string; secondary: string }> = {
  crusade: { primary: "hsl(45, 90%, 50%)", secondary: "hsl(45, 70%, 85%)" },
  fabled: { primary: "hsl(200, 70%, 45%)", secondary: "hsl(200, 50%, 80%)" },
  legion: { primary: "hsl(0, 60%, 40%)", secondary: "hsl(0, 40%, 75%)" },
};

// Faction colors for 3D rendering (hex format) - consolidated single source of truth
export const factionColorsHex: Record<Faction, { primary: number; secondary: number; accent: number }> = {
  crusade: { primary: 0xc9a227, secondary: 0x8b0000, accent: 0xffd700 },
  fabled: { primary: 0x228b22, secondary: 0x4169e1, accent: 0x00ff7f },
  legion: { primary: 0x4a0080, secondary: 0x1a1a1a, accent: 0x9400d3 }
};

// Race colors for 3D model tinting (CSS HSL format for UI)
export const raceColors: Record<string, { primary: string; secondary: string }> = {
  human: { primary: "hsl(30, 50%, 60%)", secondary: "hsl(30, 40%, 80%)" },
  barbarian: { primary: "hsl(25, 70%, 45%)", secondary: "hsl(25, 50%, 75%)" },
  dwarf: { primary: "hsl(35, 60%, 40%)", secondary: "hsl(35, 50%, 70%)" },
  elf: { primary: "hsl(140, 50%, 50%)", secondary: "hsl(140, 40%, 80%)" },
  orc: { primary: "hsl(100, 60%, 30%)", secondary: "hsl(100, 40%, 60%)" },
  undead: { primary: "hsl(270, 40%, 35%)", secondary: "hsl(270, 30%, 65%)" },
};

// Race tint colors for 3D rendering (hex format) - consolidated single source of truth
export const raceTintsHex: Record<string, number> = {
  human: 0xf5deb3,
  barbarian: 0xcd853f,
  dwarf: 0xd2691e,
  elf: 0xfaf0e6,
  orc: 0x6b8e23,
  undead: 0x708090
};

// Shared material colors used across 3D scenes (wood, stone, etc.)
export const materialColorsHex = {
  // Wood colors
  woodLight: 0x4a3728,    // Light brown wood (most common)
  woodMedium: 0x3d2817,   // Medium brown wood
  woodDark: 0x2a1a0a,     // Dark/aged wood
  woodRich: 0x5c4033,     // Rich mahogany
  // Stone colors
  stoneLight: 0x808080,   // Light grey stone
  stoneDark: 0x505050,    // Dark grey stone
  // Metal colors
  metalIron: 0x606060,    // Iron
  metalGold: 0xffd700,    // Gold
  metalBronze: 0xcd7f32,  // Bronze
} as const;

// Class icons (using unicode symbols)
export const classIcons: Record<UnitClass, string> = {
  warrior: "Sword",
  ranger: "Target",
  mage: "Sparkles",
  worge: "Dog",
};

// Terrain info
export const terrainInfo = {
  grass: { name: "Grassland", moveCost: 1, defenseBonus: 0, color: "bg-green-600 dark:bg-green-700" },
  stone: { name: "Stone Floor", moveCost: 1, defenseBonus: 5, color: "bg-stone-400 dark:bg-stone-600" },
  water: { name: "Water", moveCost: 3, defenseBonus: -5, color: "bg-blue-500 dark:bg-blue-600" },
  forest: { name: "Forest", moveCost: 2, defenseBonus: 15, color: "bg-emerald-700 dark:bg-emerald-800" },
  mountain: { name: "Mountain", moveCost: 4, defenseBonus: 25, color: "bg-slate-500 dark:bg-slate-700" },
  sand: { name: "Desert", moveCost: 2, defenseBonus: -2, color: "bg-amber-300 dark:bg-amber-500" },
};

// Generate a random unit with equipment
export function generateUnit(unitClass: UnitClass, faction: Faction, isEnemy: boolean = false, level: number = 1): Unit {
  const names = namesByFaction[faction];
  const name = names[Math.floor(Math.random() * names.length)];
  const stats = { ...baseStats[unitClass] };
  
  // Level scaling
  const levelBonus = (level - 1) * 0.1;
  stats.hp = Math.floor(stats.hp * (1 + levelBonus));
  stats.attack = Math.floor(stats.attack * (1 + levelBonus));
  stats.defense = Math.floor(stats.defense * (1 + levelBonus));
  
  // Generate equipment tier based on level (tier 0-8, roughly level/3)
  const equipmentTier = Math.min(Math.floor(level / 3), 8);
  const equipment = generateEquipment(unitClass, equipmentTier);
  
  // Get sprite config for this class
  const spriteConfig = getCharacterSprite(unitClass);
  
  return {
    id: `${faction}-${unitClass}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name,
    class: unitClass,
    faction,
    level,
    stats: { ...stats, maxHp: stats.hp },
    abilities: [...abilityTemplates[unitClass]],
    isEnemy,
    portraitIndex: Math.floor(Math.random() * 4),
    equipment,
    spriteConfig,
  };
}

// Generate a random map
export function generateMap(width: number, height: number, name: string = "Battlefield"): BattleMap {
  const tiles: Tile[] = [];
  const terrainTypes = ["grass", "stone", "forest", "sand"] as const;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrain = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      tiles.push({
        x,
        y,
        terrain,
        elevation: Math.floor(Math.random() * 2),
        isHighlighted: false,
      });
    }
  }
  
  return {
    id: `map-${Date.now()}`,
    name,
    width,
    height,
    tiles,
  };
}

// Lore entries
export const loreEntries: LoreEntry[] = [
  {
    id: "lore-1",
    title: "The Age of Fracture",
    category: "history",
    content: `Long ago, the world of Aethermoor was whole - a realm where magic flowed freely through crystalline ley lines that connected all living things. The six great races lived in harmony, their borders defined not by walls but by the natural flow of arcane energy.

Then came the Sundering.

No one knows what truly caused it. Some say it was the hubris of the Archmage Council, attempting to harness the power of the World Heart. Others whisper of the Cosmic Waterfall - Madra's domain expanding, entropy itself given form.

What we know is this: In a single catastrophic moment, the ley lines ruptured. Magic, once predictable and gentle, became wild and dangerous. The land itself split apart, creating the Floating Isles we now call home.

From this chaos, three great factions emerged - the Crusade, the Fabled, and the Legion - each following one of the three gods who still watch over Aethermoor.`,
    unlocked: true,
  },
  {
    id: "lore-race-human",
    title: "Humans",
    category: "races",
    content: `Humans are the most adaptable of all the races in Aethermoor. Neither the strongest nor the wisest, they compensate with determination, ingenuity, and an unshakeable belief in their destiny.

Since the Sundering, Humans have proven remarkably resilient. Where other races clung to ancient traditions, Humans built anew. Their cities rise from the ashes faster than any other, their armies march with renewed purpose, their scholars devise new solutions to old problems.

Odin marked Humanity as his chosen warriors. In return, Humans founded the Crusade alongside the Barbarian tribes, united by Thrax the Savage's prophecy: "The Red Storm shall unite the axes with the swords, or all shall fall to the endless dark."

Human Warriors form the backbone of Crusade forces - disciplined, well-equipped, and utterly devoted to Odin's cause. Their mages channel the All-Father's radiance into devastating solar strikes.`,
    unlocked: true,
  },
  {
    id: "lore-race-barbarian",
    title: "Barbarians",
    category: "races",
    content: `The Barbarian tribes have roamed the wild edges of Aethermoor since before recorded history. They are a fierce people who value strength, honor, and the glory of combat above all else.

Where Humans build walls, Barbarians build legends. Their warriors train from childhood in the brutal arts of war, and their berserkers are feared across all the Floating Isles.

When Thrax the Savage united the tribes and forged the blood-brother bond with Sigurd the Unbreakable, the Barbarians joined the Crusade. This alliance shocked many - the "civilized" Humans fighting alongside the "savage" tribes - but proved unbreakable.

Barbarian Berserkers channel Odin's fury into devastating attacks. They fight with reckless abandon, trusting that the All-Father will welcome them to his eternal halls should they fall. Their war cries - "BLOOD FOR ODIN!" - strike terror into enemy hearts.`,
    unlocked: true,
  },
  {
    id: "lore-race-dwarf",
    title: "Dwarves",
    category: "races",
    content: `Deep within the floating mountain-islands, the Dwarves have built civilizations of stone and steel. They are master craftsmen, their forges producing weapons and armor of legendary quality.

The Omni, the Eternal One, taught the first Dwarves the secrets of the forge - or so they believe. This divine knowledge flows through every Dwarven smith, allowing them to create works that blend craftsmanship with subtle magic.

When the Sundering shattered the world, the Dwarven holds survived better than most. Their underground cities, reinforced by generations of engineering, held firm while surface kingdoms crumbled.

The Fabled alliance paired Dwarves with their ancient friends, the Elves. Together they seek The Omni's vision of balance and harmony. Dwarven Vanguards form impenetrable shield walls, while their Artificers create mechanical wonders that rival any spell.`,
    unlocked: true,
  },
  {
    id: "lore-race-elf",
    title: "Elves",
    category: "races",
    content: `The Elves are the oldest of the mortal races, their civilization stretching back to the dawn of Aethermoor. Long-lived and patient, they see patterns in history that other races cannot perceive.

The Omni blessed the Elves with an innate connection to nature magic. Their forests grow in spiraling patterns that channel arcane energy, their cities are living things of wood and vine, their warriors move with supernatural grace.

Since the Sundering, the Elves have served as the world's memory. Their libraries contain knowledge from before the Fracture, their scholars preserve the wisdom of lost civilizations. This makes them invaluable allies - and dangerous enemies.

Alongside the Dwarves, Elves form the Fabled faction. Their Arcane Archers fire arrows guided by forest spirits, their Druids command nature itself, and their Loremasters can turn an enemy's own magic against them.`,
    unlocked: true,
  },
  {
    id: "lore-race-orc",
    title: "Orcs",
    category: "races",
    content: `Born from volcanic crevices and abyssal zones, the Orcs are a warrior race of tremendous strength and fury. They believe in conquest, power, and the inevitability of conflict.

Orcs follow Madra, the Chaos Mother, who teaches that destruction is the path to true growth. They do not seek to preserve the old world - they seek to tear it down and build something stronger from its ashes.

Orc society is brutally meritocratic. The strongest lead, the weak serve or die, and every Orc dreams of glorious conquest. Their Warbands are engines of destruction, smashing through enemy lines with overwhelming force.

Within the Legion, Orcs serve as the unstoppable vanguard. Their Warlords command through fear and respect, their Shamans channel Madra's chaotic power, and their endless ranks march toward oblivion without hesitation.`,
    unlocked: true,
  },
  {
    id: "lore-race-undead",
    title: "The Undead",
    category: "races",
    content: `The Undead are Madra's greatest gift - or curse, depending on who you ask. When her children die, the Chaos Mother sometimes refuses to let them go, pulling them back from oblivion with twisted immortality.

Not all who die become Undead. Madra chooses those with unfinished purpose, those whose hatred burns bright enough to fuel a second existence, those she simply wishes to keep.

The Undead remember fragments of their former lives - enough to fight, to follow orders, to hate the living with eternal fury. They feel no pain, no fear, no mercy. They are the perfect soldiers.

Within the Legion, the Undead serve alongside their Orc allies. Necromancers raise and command legions of shambling warriors, skeletal mages cast spells from beyond death, and the most powerful Undead retain enough intelligence to lead armies of their own.`,
    unlocked: true,
  },
  {
    id: "lore-6",
    title: "Warriors",
    category: "bestiary",
    content: `The backbone of any army, Warriors are masters of close-quarters combat. Wielding sword and shield, they form the front line of battle, protecting more vulnerable allies while dealing steady damage.

A skilled Warrior can control the battlefield through positioning and aggression. Their Shield Bash ability creates openings for allies, while War Cry inspires nearby troops to fight harder.

Warriors favor heavy armor and simple, reliable weapons. They train for years to master the fundamentals: stance, footwork, and the perfect strike.

Across the Floating Isles, every faction has their own Warrior tradition:
- Crusade Vanguards channel Odin's might through disciplined strikes
- Fabled Defenders form impenetrable shield walls
- Legion Berserkers fight with unstoppable fury`,
    unlocked: true,
  },
  {
    id: "lore-7",
    title: "Mages",
    category: "bestiary",
    content: `Mages are wielders of raw arcane power, capable of devastating attacks from a distance. Their frail bodies belie the destructive force they command.

Since the Sundering, magic has become unpredictable. Mages must constantly adapt their techniques, drawing power from the chaotic ley lines while avoiding corruption.

A battlefield Mage is both a prize asset and a liability. Their Fireball spell can turn the tide of battle, but they require protection from physical attacks.

The Arcane Shield ability allows Mages to protect allies, making them valuable support units as well as damage dealers. Smart commanders position their Mages carefully and guard them well.

Each faction approaches magic differently:
- Crusade Battlemages channel Odin's radiance into solar strikes
- Fabled Loremasters weave ancient spells of protection and nature
- Legion Warlocks twist Madra's chaos into weapons of destruction`,
    unlocked: true,
  },
  {
    id: "lore-8",
    title: "The Floating Isles",
    category: "locations",
    content: `Once a single vast continent, Aethermoor was shattered by the Sundering into hundreds of floating islands drifting through an endless sky, slowly pulled toward the Cosmic Waterfall.

The largest fragments became the homes of the three factions:

THE CRUSADE HIGHLANDS - Fortress-islands where Humans and Barbarians train for war, bathed in golden light that streams from Odin's realm above.

THE FABLED GROVES - Ancient forest-islands where Elves and Dwarves preserve the old knowledge, balanced between creation and destruction.

THE LEGION WASTES - Volcanic and abyssal islands where Orcs and Undead gather strength, closest to Madra's expanding domain.

THE CONTESTED ZONES - Neutral islands where the factions clash for resources and territory. Most battles take place here.

Travel between islands requires ships that sail the sky-seas, magical portals, or the dangerous art of ley-line walking.`,
    unlocked: true,
  },
  {
    id: "lore-9",
    title: "Rangers",
    category: "bestiary",
    content: `Masters of ranged combat, Rangers control the battlefield from a distance. Their ability to strike from safety makes them invaluable, but they struggle when enemies close the gap.

The best Rangers are patient hunters who choose their targets carefully. A well-placed arrow can eliminate an enemy mage or healer before they can act.

The Volley ability allows experienced Rangers to rain death on an area, though the damage is spread thin. Poison Arrows add damage over time, weakening enemies for allies to finish.

Movement is key for a Ranger. They must constantly reposition to maintain optimal range while avoiding pursuit.

Faction variations:
- Crusade Sunbows fire arrows blessed by Odin's light
- Fabled Arcane Archers weave magic into every shot
- Legion Deadeyes strike with cold, undead precision`,
    unlocked: true,
  },
  {
    id: "lore-10",
    title: "Worges",
    category: "bestiary",
    content: `Worges are the healers and support specialists of the battlefield. Their ability to restore health and remove debuffs keeps armies fighting long after they should have fallen.

A single Worge can change the outcome of a battle. Smart commanders protect them at all costs; smart enemies target them first.

The basic Heal spell restores a significant amount of health to one ally. Purify removes harmful effects. Divine Light is the ultimate healing ability, restoring all nearby allies at once.

Worges are poor fighters themselves. They carry light weapons more for self-defense than offense.

Faction variations:
- Crusade Clerics channel Odin's blessing
- Fabled Druids call upon The Omni's balance
- Legion Necromancers heal through dark magic`,
    unlocked: true,
  },
  {
    id: "lore-god-odin",
    title: "Odin - The All-Father",
    category: "history",
    content: `Odin, the All-Father, is the patron of warriors who seek victory through strength and strategy. His domain encompasses War, Wisdom, Fate, and Victory itself.

Legend tells that Odin sacrificed his eye to see all timelines of the Grudge wars - the eternal conflicts that shape our world. His ravens Huginn and Muninn are said to report all activities across the realm, watching from above.

Odin favors those who die gloriously in combat, welcoming them to his eternal halls. His spear Gungnir never misses its mark, and some claim to have heard his voice through crow NPCs scattered across the islands.

The Crusade faction follows his teachings, believing that victory through valor is the highest calling. Though Odin secretly admires The Omni's pursuit of balance, he will never admit it - for he is a god of war first, and compromise second.`,
    unlocked: true,
  },
  {
    id: "lore-god-madra",
    title: "Madra - The Chaos Mother",
    category: "history",
    content: `Madra, the Chaos Mother, is the force of necessary destruction and evolution. Her domain encompasses Entropy, Transformation, Destruction, and Rebirth.

She believes destruction is the only path to true growth. The Cosmic Waterfall that slowly consumes the floating islands is said to be her domain expanding - the ultimate expression of entropy made manifest.

Madra created the Undead by refusing to let her children truly die. She loves her Legion children deeply, but shows her affection through trials and challenges. Her temples appear randomly as islands are consumed, and she speaks in riddles that reveal future catastrophes.

The Legion faction follows her teachings, embracing chaos and transformation. Through destruction, they believe, pure power is reborn.`,
    unlocked: true,
  },
  {
    id: "lore-god-omni",
    title: "The Omni - The Eternal One",
    category: "history",
    content: `The Omni, the Eternal One, is the keeper of cosmic balance who prevents total annihilation. Their domain encompasses Balance, Unity, Infinity, and Harmony.

The Omni is neither male nor female but all things - a being of pure equilibrium. They secretly mourn that balance requires conflict, for they see the necessity of war even as they seek peace.

Their third eye can see a player's true intentions. Dwarves believe The Omni taught them the secrets of the forge, while Elves credit their nature magic to this mysterious deity. The Omni speaks in absolute truths that can be hard to accept.

They created the floating islands to give mortals a chance against the Waterfall's consuming expansion. The Fabled faction follows their teachings of balance and harmony.`,
    unlocked: true,
  },
  {
    id: "lore-faction-crusade",
    title: "The Crusade",
    category: "factions",
    content: `"Victory Through Valor - We March Forward!"

The Crusade is an alliance of Humans and Barbarians who seek victory through strength and honor. They follow Odin's teachings of valor and combat prowess.

The Crusade formed when the Barbarian tribes united with the 'civilized' human kingdoms against the threat of the Cosmic Waterfall and the Legion. United by Thrax the Savage's prophecy - "The Red Storm shall unite the axes with the swords, or all shall fall to the endless dark" - they now stand as the bulwark against darkness.

Their warriors are known for their martial prowess, honorable military traditions, and unwavering dedication to Odin's worship. Human history and Barbarian culture blend together in their traditions, creating a unique martial society.`,
    unlocked: true,
  },
  {
    id: "lore-faction-legion",
    title: "The Legion",
    category: "factions",
    content: `"Through Chaos, We Are Reborn"

The Legion is a coalition of Orcs and Undead who embrace chaos and transformation. They follow Madra's teachings of destruction as the path to growth.

Born from volcanic crevices and abyssal zones, the Legion rises as a coordinated, relentless force. Their creed centers on conquest, entropy, and the reclamation of a 'perfect order' through subjugation of free will.

The undead members were created by Madra refusing to let her children truly die, giving them a twisted immortality. Their aggressive, chaotic nature drives them forward, with knowledge of necromancy, chaos magic, orc culture, and undead lore forming the foundation of their society.

"Destruction is but a prelude to creation!" they cry as they march to war.`,
    unlocked: true,
  },
  {
    id: "lore-faction-fabled",
    title: "The Fabled",
    category: "factions",
    content: `"In Balance, We Find Eternity"

The Fabled is an alliance of Elves and Dwarves who seek balance and harmony. They follow The Omni's teachings of unity and cosmic equilibrium.

As the oldest races, they united under The Omni's guidance to preserve knowledge and maintain the delicate balance between creation and destruction. Dwarves believe The Omni taught them the art of the forge, while Elves credit their nature magic to the Eternal One.

Their wise, diplomatic nature helps them navigate the conflicts between the other factions. Masters of ancient lore, balance, nature magic, and forge craft, they serve as the world's memory and conscience.

"May The Omni's light guide your path," they greet friend and stranger alike.`,
    unlocked: true,
  },
  {
    id: "lore-location-waterfall",
    title: "The Cosmic Waterfall",
    category: "locations",
    content: `The Cosmic Waterfall stands at the edge of existence - a void of pure entropy that slowly consumes islands, pulling them into oblivion.

This is Madra's domain expanding, a manifestation of chaos and destruction made real. All races struggle between power and survival in this eternal migration away from its consuming edge.

The closer to the Waterfall, the stronger the magic flows from the gods. Islands nearest to it hold the most powerful magic but the greatest danger. Some foolish treasure hunters sail close to gather rare materials, but few return.

The Waterfall shapes all politics in Aethermoor - every faction must consider the slow drift toward oblivion in their plans.`,
    unlocked: true,
  },
  {
    id: "lore-location-ocean",
    title: "The Ocean of Echoes",
    category: "locations",
    content: `The Ocean of Echoes is a living sea that records memories of civilizations. Sailors who traverse its depths hear ancestral voices that may guide or misguide explorers.

Beneath the waves lie the Vaults of Memory - submerged and airborne temples that hold the crystallized memories of the old world. Scholars and adventurers alike seek these treasures, for within them lies knowledge from before the Sundering.

The ocean itself seems aware, responding to those who sail upon it. Some claim the voices speak of treasures, while others hear warnings of doom. Only the brave - or the foolish - venture into its deepest reaches.`,
    unlocked: true,
  },
  {
    id: "lore-hero-aurion",
    title: "Aurion the Radiant",
    category: "characters",
    content: `Aurion the Radiant is the most powerful human mage in living memory. Marked by Odin at birth during a solar eclipse, his golden divine energy constantly radiates from his form.

Born as golden light erupted from the sky - Odin himself marking the child. By age 12, he could channel pure solar energy. Now at 34, he leads the Crusade's magical corps with unmatched power.

His power comes from proximity to the Waterfall - the further away he goes, the weaker he becomes. This curse keeps him always near danger, yet he continues to serve the Crusade with noble inspiration.

"The light of Odin guides your path here," he greets those who seek his aid.`,
    unlocked: true,
  },
  {
    id: "lore-hero-sigurd",
    title: "Sigurd the Unbreakable",
    category: "characters",
    content: `Sigurd the Unbreakable is the Supreme Commander of Crusade ground forces. He has never lost a duel, never abandoned a position, never broken a promise.

Born to a blacksmith family, at age 16 he single-handedly held a bridge for three days while his village evacuated. He fought Thrax the Savage for seven hours to a draw, and they became blood brothers.

His legendary stubbornness is both his greatest strength and his tragic flaw. A blunt military man, he values discipline and honor above all else.

"State your business," he greets visitors, wasting no time on pleasantries. Only those who prove themselves in combat earn his respect.`,
    unlocked: true,
  },
  {
    id: "lore-hero-thrax",
    title: "Thrax the Savage",
    category: "characters",
    content: `Thrax the Savage is Odin's Berserker, born of prophecy: "The Red Storm shall unite the axes with the swords, or all shall fall to the endless dark."

At age 18, he challenged and defeated every tribal champion in single combat to unite the Barbarian tribes with the Crusade. He then fought Sigurd for seven hours to a draw, and they became blood brothers - a bond that united Human and Barbarian in common cause.

A fierce warrior with primal fighting style, Thrax channels rage into devastating combat prowess. He speaks simply but truthfully: "Fight together good. Fight apart stupid."

When he screams his battle cry - "BLOOD FOR ODIN!" - even his allies feel a chill run down their spines.`,
    unlocked: true,
  },
  {
    id: "lore-hero-kael",
    title: "Kael the Shadowblade",
    category: "characters",
    content: `Kael the Shadowblade is the Crusade's intelligence master. No one knows his true origin - some whisper he was born in Legion lands and defected. He encourages all rumors equally.

He has prevented seventeen assassination attempts on Crusade leaders, mapped the interior of three Legion fortresses, and once stole a crown directly off an Orc warlord's head - replacing it with a Crusade banner.

His loyalty is absolute, but his morality is flexible. A cryptic, mysterious figure, he trades in information and secrets. His quests often involve stealth, espionage, and the shadowy arts.

"...you saw me. Interesting," he says to those perceptive enough to notice him. Most don't.`,
    unlocked: true,
    image: "/hero-portraits/human_ranger.png",
  },
  {
    id: "lore-hero-theron",
    title: "Theron Wildkin",
    category: "characters",
    content: `Theron Wildkin is the Brother of Beasts, raised by wolves after being lost in the Wildwood at age 5. He walks between civilization and nature, translating for both.

A pack of dire wolves found him and adopted him. He lived as a wolf for twelve years. His wolf-brother Fenrix is not a pet but an equal partner - they share thoughts and even pain through their magical bond.

Speaking in simple, primal terms, Theron can communicate with beasts and track any prey across any terrain. He serves as the Crusade's connection to the natural world.

"*sniff* You smell... uncertain. Speak," he greets visitors, trusting his wolf senses more than words.`,
    unlocked: true,
    tags: ["crusade", "barbarian", "beastmaster"],
    quote: "*sniff* You smell... uncertain. Speak.",
    quoteAuthor: "Theron Wildkin",
  },

  // ── Characters: Fabled & Legion heroes ───────────────────────────────────

  {
    id: "lore-hero-lyrial",
    title: "Lyrial Dawnweave",
    category: "characters",
    content: `Lyrial Dawnweave is the High Loremaster of the Fabled alliance — an elf who has lived through two full centuries of Aethermoor history and personally witnessed the Sundering.

She did not survive it unchanged. The rupture of the ley lines tore through her arcane senses like a scream without end, leaving her permanently sensitive to magical disturbances that others cannot detect.

Lyrial's greatest gift is not raw power but insight: she can read the resonance of an enchanted object and learn its entire history. Her library, assembled over 200 years, contains the most complete record of pre-Sundering civilization in existence.

Cold and clinical, she treats emotion as interference. Yet she mourns the world that was — privately, methodically — recording every detail of what was lost.`,
    unlocked: true,
    tags: ["fabled", "elf", "loremaster", "mage"],
    quote: "The past does not mourn itself. That is our burden.",
    quoteAuthor: "Lyrial Dawnweave",
  },
  {
    id: "lore-hero-bolgrim",
    title: "Bolgrim Ironclad",
    category: "characters",
    content: `Bolgrim Ironclad is the Fabled's Master Engineer — a dwarf whose mechanical constructs have turned the tide of more battles than any spell or blade.

Where other engineers build siege weapons, Bolgrim builds companions. His greatest creation, AURUM-7, is a fully autonomous bronze golem capable of independent tactical decisions. The two argue constantly, which Bolgrim insists makes both of them sharper.

He distrusts magic, despite working alongside elves daily. His philosophy: "If you can't fix it with a hammer, it was never built right to begin with."

Bolgrim has refused promotion to General fourteen times. He prefers the workshop.`,
    unlocked: true,
    tags: ["fabled", "dwarf", "engineer", "crafter"],
    quote: "If you can't fix it with a hammer, it was never built right to begin with.",
    quoteAuthor: "Bolgrim Ironclad",
  },
  {
    id: "lore-hero-volkrath",
    title: "Volkrath the Unending",
    category: "characters",
    content: `Volkrath the Unending is the Legion's supreme warlord — an orc who died in battle at age 40, was raised by Madra herself, and has led the Legion for over three centuries in undead form.

He is the ultimate expression of the Legion's philosophy: through death, he became more than he ever was in life. He feels no pain. He requires no sleep. He forgets nothing.

Volkrath leads not through fear but through absolute conviction. Every soldier in his ranks believes, genuinely, that he will lead them to the world Madra promised: reborn from destruction, stronger and purer.

His greatest weapon is patience. He has outlived every enemy commander he has ever faced.`,
    unlocked: true,
    tags: ["legion", "orc", "undead", "warlord"],
    quote: "I have buried every general who swore to stop me. I have time.",
    quoteAuthor: "Volkrath the Unending",
  },
  {
    id: "lore-hero-seraph",
    title: "Seraph of Ash",
    category: "characters",
    content: `No one knows Seraph's name before she died. She was a young necromancer — Legion-born — who burned to death defending a bridge so her warband could escape.

Madra rebuilt her from the ash. Not as a mindless revenant, but as something new: a being of pure necrotic fire, her flesh replaced with perpetually burning shadow-flame, her consciousness intact but transformed.

She does not command undead — she is one with them. When she raises the dead, they rise knowing exactly why. She shows them what she saw in the moment of her own death: the clarity that comes when everything burns away.

Seraph is the closest thing the Legion has to a prophet.`,
    unlocked: true,
    tags: ["legion", "undead", "necromancer", "prophet"],
    quote: "When everything you were burns away, what remains is what you truly are.",
    quoteAuthor: "Seraph of Ash",
  },

  // ── Locations ─────────────────────────────────────────────────────────────

  {
    id: "lore-location-waterfall-isle",
    title: "Waterfall Isle",
    category: "locations",
    content: `Waterfall Isle is the starting point for all new arrivals in Aethermoor — a mid-sized island ringed by ancient stone circles and watched over by an alien temple older than any of the three factions.

The island is unusual in that it exists in a rare stable zone — it drifts, but slowly, and has remained in the same general region of the sky-sea for over a century. This makes it the natural gathering point for trade, refugees, and adventurers.

The town of Shorefall clings to the eastern cliff face, built in tiers against the rock. Its population is deliberately mixed — all three factions maintain a fragile peace here, enforced by the island's de facto ruler, the Harbor Council.

The waypoint stones at the island's heart are believed to be The Omni's gift — a network of teleportation anchors that bind every traveller, regardless of faction, to a shared starting point.`,
    unlocked: true,
    tags: ["island", "starter", "neutral", "harbor"],
    quote: "Every adventurer in Aethermoor starts at the same place. The stones remind you there's always somewhere to begin again.",
    quoteAuthor: "Harbor Council Proverb",
  },
  {
    id: "lore-location-crusade-highland",
    title: "Crusade Highland Keeps",
    category: "locations",
    content: `The Crusade Highlands are a cluster of fortress-islands that form the military heart of the Crusade alliance. Their peaks are perpetually lit by golden light streaming from Odin's realm — a visible sign of divine favor that never fully fades.

Each island in the cluster has a different purpose. Ironhold is purely military — a training ground where both Human recruits and Barbarian warriors learn to fight side by side. Aurum Keep serves as the administrative center, where the war councils meet beneath a ceiling of hammered gold.

The highest peak, Odin's Eyrie, is a sacred site. No non-Crusade member has set foot there in living memory. It is said the All-Father himself speaks to worthy warriors in visions atop that wind-scoured summit.

Travel between the Highland keeps is by sky-skiff — swift one-masted vessels that sail on artificially maintained ley-line currents between the islands.`,
    unlocked: true,
    tags: ["crusade", "military", "fortress", "sacred"],
  },
  {
    id: "lore-location-fabled-groves",
    title: "The Fabled Groves",
    category: "locations",
    content: `The Fabled Groves are ancient forest-islands where time seems to move differently. Trees that were saplings at the Sundering are now vast enough to house entire elven settlements in their canopy.

The groves are divided into two distinct zones by the resident factions. The upper canopy belongs to the elves — a network of living bridges and treehouse libraries connected by carefully tended vine-paths. Below ground, carved into the roots and rock, are the Dwarven warrens: a labyrinth of workshops, forges, and archives.

At the center of the largest grove stands the Hearthstone — a massive crystal that pre-dates all recorded history. Both races believe it was placed there by The Omni. Neither faction knows what it actually does. Lyrial Dawnweave has been studying it for forty years.

New growth in the groves corresponds to magical activity. When spells are cast nearby, flowers bloom.`,
    unlocked: true,
    tags: ["fabled", "forest", "ancient", "elves", "dwarves"],
    quote: "The forest remembers what the history books forgot.",
    quoteAuthor: "Elven Saying",
  },
  {
    id: "lore-location-legion-wastes",
    title: "The Legion Wastes",
    category: "locations",
    content: `The Legion Wastes are the most inhospitable islands in Aethermoor — volcanic, ashen, scarred by centuries of warfare and dark magic. They drift closer to the Cosmic Waterfall than any other inhabited territory.

This proximity to the Waterfall is not a weakness. For the Legion, it is a source of power. The raw entropy flooding off the Waterfall feeds Madra's magic and amplifies necromantic rituals to unprecedented levels.

The Wastes are geographically hostile: rivers of cooling lava crisscross the lowlands, the sky is perpetually overcast with volcanic ash, and the ambient magical radiation kills most plant life. What does grow here is twisted, dark, and dangerous.

The Legion has adapted perfectly. Their fortresses are built from obsidian and black iron. Their cities are underground, heated by geothermal vents. Volkrath's citadel, the Black Throne, sits at the highest point — visible for miles as a jagged silhouette against the ash-clouds.`,
    unlocked: true,
    tags: ["legion", "volcanic", "wasteland", "stronghold"],
    quote: "The ash does not suffocate us. It feeds us.",
    quoteAuthor: "Legion Warchant",
  },
  {
    id: "lore-location-rift-market",
    title: "The Rift Market",
    category: "locations",
    content: `The Rift Market exists in the gap between three contested islands that orbit each other in a slow gravitational dance. Over centuries, traders built platforms across the void between them, connected by rope bridges, wooden gangways, and eventually iron-reinforced sky-docks.

Today it is the largest neutral trading post in Aethermoor. You can find anything here — weapons from all three factions, forbidden relics from before the Sundering, rare materials from near the Waterfall, and information that could get you killed.

The Market has no formal government. It is run by the Brokers' Conclave — seven merchants who represent the seven major trading guilds. They enforce exactly one rule: no faction violence. The penalty is permanent exile.

They have never had to enforce it twice on the same person.`,
    unlocked: true,
    tags: ["neutral", "trade", "market", "merchants"],
    quote: "If you can't find it at the Rift Market, it doesn't exist. Or it shouldn't.",
    quoteAuthor: "Unknown Merchant",
  },
  {
    id: "lore-location-vault-memory",
    title: "The Vaults of Memory",
    category: "locations",
    content: `Somewhere beneath the Ocean of Echoes, the Vaults of Memory hold the crystallized experiences of entire civilizations — knowledge encoded in pure magical crystal during the final days before the Sundering.

No one has found the Vaults. Dozens have died trying. The ocean's "echo" phenomenon — the voices sailors hear while crossing its surface — are believed to be fragmented transmissions from within, leaking upward through the water.

The Fabled have the most information about the Vaults' likely location, based on 200 years of Lyrial Dawnweave's research. She refuses to share it. Her position: "Humanity is not ready. They would weaponize it before they understood it."

She may be right.`,
    unlocked: true,
    tags: ["ancient", "hidden", "ocean", "knowledge", "mystery"],
  },

  // ── History ───────────────────────────────────────────────────────────────

  {
    id: "lore-history-sundering",
    title: "The Sundering — First-Hand Account",
    category: "history",
    content: `The following is transcribed from a crystal memory-shard recovered near the Rift Market. The voice belongs to an unknown pre-Sundering scholar:

"The ley lines began singing three days before the end. Not the normal harmonic resonance — a scream. A sustained, atonal scream that only those attuned to magic could hear.

On the third day, the World Heart exploded.

I don't know how to describe what followed to someone who wasn't there. Imagine the ground simply... disagrees with being connected. Islands don't fly; they are rejected. The continent did not break apart. It denied cohesion.

The worst part was the silence afterward. All the ley lines, all the ambient magic that had hummed through everything since birth — gone. Just gone. We stood on floating rock in the sky and the world was suddenly very, very quiet."

The crystal ends there.`,
    unlocked: true,
    tags: ["sundering", "first-hand", "rare", "history"],
    quote: "The worst part was the silence afterward.",
    quoteAuthor: "Unknown Pre-Sundering Scholar",
  },
  {
    id: "lore-history-three-gods",
    title: "The Divine Compact",
    category: "history",
    content: `After the Sundering, the three surviving gods — Odin, The Omni, and Madra — made a compact that prevented them from acting directly in the mortal world.

The circumstances of this compact are disputed. Odin's followers claim it was voluntary self-restraint — that the gods recognized direct divine intervention would destabilize the already-fractured world further. The Fabled believe The Omni enforced it as the only way to maintain any balance at all. The Legion believes Madra agreed to terms she has no intention of honoring.

What is agreed upon by all three factions: the gods speak, they influence, they grant power to champions — but they do not manifest physically in Aethermoor. The Divine Compact holds.

For now.`,
    unlocked: true,
    tags: ["gods", "divine", "odin", "omni", "madra", "compact"],
  },
  {
    id: "lore-history-first-grudge",
    title: "The First Grudge War",
    category: "history",
    content: `The name "Grudge" — applied to the eternal conflict between the factions — comes from the First Grudge War, fought approximately forty years after the Sundering.

With the world shattered and resources scarce, the three emerging factions collided for the first time over a cluster of islands rich in crystallized ley-line minerals — the most valuable magical resource in post-Sundering Aethermoor.

The war lasted eleven years. It ended not with victory but with mutual exhaustion. All three factions agreed to the Contested Zone protocol — a set of rules governing how territorial disputes are resolved, centered around structured military engagements rather than total war.

This protocol became the foundation of all future Grudge conflicts. The wars never truly end, but they are, in a sense, contained.`,
    unlocked: true,
    tags: ["grudge", "war", "history", "factions"],
  },

  // ── Bestiary ──────────────────────────────────────────────────────────────

  {
    id: "lore-beast-crushed-king",
    title: "The Crushed King",
    category: "bestiary",
    content: `The Crushed King is the most feared creature in Aethermoor's sky-seas — a colossal cephalopod of the deep void that resembles a kraken, but whose origin is neither natural nor mundane.

Legend holds that it was once an actual pirate king — a human warlord of extraordinary cruelty — who bargained with Madra for power and survival. She gave him exactly what he asked for: the inability to be killed by any blade, the strength to crush any ship, and eternal life at sea. She did not specify he would remain human.

The Crushed King now hunts the sky-sea lanes with nine tentacles, each capable of capsizing a warship. Its skin is encrusted with the wreckage of vessels it has destroyed over centuries — hull planks, masts, cannons, and the anchors of ships that tried to weigh it down.

Its eye, when visible through the wreckage-armor, retains human intelligence. And human rage.`,
    unlocked: true,
    tags: ["boss", "sea creature", "cursed", "legendary"],
    quote: "It does not hunger. It remembers.",
    quoteAuthor: "Aethermoor Sailor's Warning",
  },
  {
    id: "lore-beast-sky-terror",
    title: "The Sky Terror",
    category: "bestiary",
    content: `The Sky Terror is a winged predator of the upper atmosphere — a creature that exists at the boundary between Aethermoor's sky-sea and the void beyond it.

Its wingspan reaches forty meters. Its scales are translucent at the edges, refracting light in ways that make it difficult to see against the sky until it is dangerously close. Sailors call it the "sky terror" not because of what it looks like but because of what its approach sounds like: a low subsonic frequency that causes vertigo and panic in any creature who hears it.

It does not appear to hunt for food in any conventional sense. Scholars who have studied its attack patterns believe it is territorial — protecting something in the upper void that it considers worth defending.

No expedition sent to determine what that is has returned.`,
    unlocked: true,
    tags: ["boss", "flying", "territorial", "air creature"],
  },
  {
    id: "lore-beast-void-wraith",
    title: "Void Wraith",
    category: "bestiary",
    content: `Void Wraiths are entities that exist at the edge of the Cosmic Waterfall — fragments of consciousness belonging to beings consumed by the void, refusing to accept dissolution.

They appear as humanoid shadows with no definable features, flickering between visible and invisible. Physical attacks pass through them ineffectively. They are vulnerable to light magic and strong emotion — positive emotions seem to cause them physical pain.

The Legion recruits them. With the right necromantic rituals, a wraith can be bound to a vessel — usually an object significant to the original person — and deployed as a scout or assassin. The binding is imperfect and always temporary. Wraiths resent captivity.

When a wraith speaks, it sounds like the voice of whoever it once was.`,
    unlocked: true,
    tags: ["undead", "void", "wraith", "incorporeal"],
  },
  {
    id: "lore-beast-stone-colossus",
    title: "Stone Colossus",
    category: "bestiary",
    content: `Stone Colossi are the Fabled's ultimate defensive weapon — ancient constructs created before the Sundering by Dwarven artificers working under The Omni's direct guidance.

They stand twelve meters tall, carved from living stone that has absorbed centuries of ambient magic. They do not move quickly. They do not need to. Their stone bodies absorb enormous amounts of damage, and their fists can reduce fortifications to rubble.

Only seven were ever created. Three were destroyed in the Sundering. Three still stand guard at key Fabled locations. The seventh's location is unknown — it walked away during the Sundering and has not been seen since.

Bolgrim Ironclad has devoted significant engineering resources to attempting to locate the seventh. He believes it is still functional.`,
    unlocked: true,
    tags: ["fabled", "construct", "ancient", "colossus"],
  },
  {
    id: "lore-beast-ley-shark",
    title: "Ley Shark",
    category: "bestiary",
    content: `Ley Sharks are creatures of the sky-sea currents — cartilaginous predators that have adapted to swim through concentrated ley-line energy as easily as a natural shark swims through water.

They are visible only when in areas of high magical concentration, where their bioluminescent undersides glow with absorbed ley energy. When magic is scarce, they are effectively invisible — detectable only by the hum they emit and the interference they cause in nearby spellcasting.

Mages fear Ley Sharks more than most creatures. The shark can sense active spell-working and is drawn to it. Many a mage who has cast a complex ritual in the open sky has found the process suddenly interrupted by several hundred kilograms of magical predator.

They cannot be domesticated. Several people have tried.`,
    unlocked: true,
    tags: ["sea creature", "magical", "predator"],
  },
  {
    id: "lore-beast-berserker-orc",
    title: "Orc Berserker",
    category: "bestiary",
    content: `An Orc who has fully given themselves to Madra's fury is no longer merely an opponent — they are a force of nature that must be respected and planned for.

Orc Berserkers are warriors who have undergone the Rite of Fury — a ritual in which they battle without rest for three days straight, channeling Madra's chaotic energy into their body until it rewrites them at a fundamental level.

After the Rite, berserkers heal faster, hit harder, and feel pain as fuel rather than limitation. The more damage they take, the more dangerous they become. This makes them uniquely difficult to fight conventionally — the instinct to wear them down before delivering killing blows actively works against you.

The trade-off: berserkers have shorter lifespans and reduced capacity for complex strategic thinking. They know this. They consider it a fair exchange.`,
    unlocked: true,
    tags: ["legion", "orc", "warrior", "berserker"],
    quote: "Do not try to tire them. The tired ones are the most dangerous.",
    quoteAuthor: "Crusade Combat Manual, Vol. III",
  },
  {
    id: "lore-beast-elven-arcane-archer",
    title: "Elven Arcane Archer",
    category: "bestiary",
    content: `An Elven Arcane Archer is the product of decades of dual training — the physical discipline of archery and the mental architecture of spellcasting combined into a single devastating combat style.

Their bows are grown, not built — living wood shaped over years to match the archer's magical signature. An arcane archer's bow is attuned to them and essentially useless in the hands of anyone else.

The arrows they fire carry spells embedded in the arrowhead. On impact, the spell deploys. Common loadouts include: concussive disruption bursts (for breaking enemy formations), tracking spirits (which guide arrows around obstacles), and seeker rounds (which can change direction mid-flight to pursue a fleeing target).

The combination makes them the most flexible ranged combatants in Aethermoor — and among the most expensive to equip and train.`,
    unlocked: true,
    tags: ["fabled", "elf", "archer", "spellcaster"],
  },
  {
    id: "lore-hero-racalvin",
    title: "Racalvin The Pirate King",
    category: "characters",
    content: `Racalvin was not born to rule the seas. He took them.

Once a disgraced naval officer of the Crusade, Racalvin was stripped of his rank after questioning the King's orders during the Siege of Ironmoor Cove — an engagement he believed would massacre civilians. Court-martialed and marooned on a supply raft with three days of water, he was left to die.

He didn't.

Within seven years, Racalvin had united four rival pirate fleets under a single banner — the Grudge skull — and declared himself sovereign of the open seas between the major faction territories. His fleet, the Grudge Armada, numbers over forty warships and controls most of the trade routes of the Shattered Basin.

He is not without principles. Racalvin taxes ships rather than sinking them. He pays his crew fairly. He offers asylum to faction deserters regardless of origin. Crusade, Fabled, Legion — he turns none away who swear to his code.

The factions call him a criminal. His crew calls him Captain. The merchants who pay his tolls and arrive safely call him the only reliable force on open water.

The truth is somewhere between all three.`,
    unlocked: true,
    image: "/hero-portraits/pirate_king.png",
    tags: ["pirate", "captain", "neutral", "sea", "grudge", "crusade-exile"],
    quote: "They gave me an ocean and called it a punishment. I called it a kingdom.",
    quoteAuthor: "Racalvin, in a letter to the Crusade High Council",
  },

  // ── Hero Codex: race × class champions of the three factions ──────────────
  // (Kael Shadowblade and Racalvin already have entries above; the rest of
  // the 25-hero codex is recorded here so every race × class slot is named.)

  {
    id: "lore-hero-codex-human-warrior",
    title: "Sir Aldric Valorheart — The Iron Bastion",
    category: "characters",
    content: `Born in the fortified city of Valorheim, Aldric rose through the ranks of the Crusade militia to become its most decorated champion. His unbreakable will and mastery of sword and shield have turned the tide of countless battles against the Legion.

Orphaned during the First Grudge War, young Aldric was raised by the Temple Knights. He forged his first blade at age twelve and took his oath at sixteen. Now he leads the vanguard of every Crusade offensive, his golden armor a beacon of hope.

Combat Profile: Melee Physical Combat. Wields swords, axes, shields and heavy armor. Lawful Good alignment, Beginner difficulty.

Strengths: highest armor and block chance · Invincibility ultimate · flexible tank or DPS builds.
Weaknesses: no ranged attacks · no magic or healing · slow movement speed.

Signature Abilities: Invincibility · Damage Surge · Guardian's Aura · Avatar Form.

Where Aldric stands, the line holds.`,
    unlocked: true,
    image: "/hero-portraits/human_warrior.png",
    tags: ["crusade", "human", "warrior", "common"],
    quote: "The shield breaks before the will does.",
    quoteAuthor: "Sir Aldric Valorheart",
  },
  {
    id: "lore-hero-codex-human-worg",
    title: "Gareth Moonshadow — The Twilight Stalker",
    category: "characters",
    content: `Gareth was a simple huntsman until a dire wolf spirit bonded with his soul during a blood moon ritual. Now he walks between the worlds of man and beast, his primal fury tempered by human discipline.

Once captain of the Crusade rangers, Gareth ventured too deep into the Darkwood seeking a cure for a plague. There, the ancient Wolf Spirit Fenrath chose him as vessel. He returned changed, his eyes gleaming amber in the dark.

Combat Profile: Melee Shapeshifting Combat. Wields claws, fangs and natural weapons. Chaotic Neutral alignment, Advanced difficulty.

Strengths: multiple combat forms · pack summons for numbers advantage · strong self-buffs and frenzy.
Weaknesses: no ranged attacks · no healing spells · form-dependent abilities.

Signature Abilities: Bear Form · Feral Rage · Raptor Form · Worg Lord.

In the space between howl and silence, death waits.`,
    unlocked: true,
    image: "/hero-portraits/human_worg.png",
    tags: ["crusade", "human", "worg", "rare"],
    quote: "The beast within is not my curse. It is my salvation.",
    quoteAuthor: "Gareth Moonshadow",
  },
  {
    id: "lore-hero-codex-human-mage",
    title: "Archmage Elara Brightspire — The Storm Caller",
    category: "characters",
    content: `Elara was the youngest scholar ever admitted to the Arcane Consortium. Her mastery of elemental magic and divine healing makes her invaluable on the battlefield, though her fragile form demands protection.

Raised in the Brightspire Academy, Elara discovered she could channel both arcane destruction and divine healing, a gift unseen in centuries. The Consortium fears her power; the Crusade depends on it.

Combat Profile: Ranged Magic & Healing. Wields staves, wands, orbs and robes. Neutral Good alignment, Intermediate difficulty.

Strengths: powerful AoE damage spells · only class with healing · blink teleport for mobility.
Weaknesses: very fragile in melee · mana dependent · low physical defense.

Signature Abilities: Mana Shield · Fireball · Heal · Lightning Chain.

The sky splits at her command.`,
    unlocked: true,
    image: "/hero-portraits/human_mage.png",
    tags: ["crusade", "human", "mage", "epic"],
    quote: "Knowledge is the flame. I am merely the torch.",
    quoteAuthor: "Archmage Elara Brightspire",
  },
  {
    id: "lore-hero-codex-barbarian-warrior",
    title: "Ulfgar Bonecrusher — The Mountain Breaker",
    category: "characters",
    content: `From the frozen peaks of the Northlands, Ulfgar descends like an avalanche upon his foes. His massive frame and berserker fury make him a force of nature that no shield wall can withstand.

Ulfgar earned his title by literally shattering a mountain pass to prevent a Legion invasion, burying an entire army beneath tons of stone. The act cost him his left eye but saved his entire tribe.

Combat Profile: Melee Physical Combat. Wields great axes, war hammers and fur armor. Chaotic Neutral alignment, Beginner difficulty.

Strengths: highest armor and block chance · Rage damage bonus when wounded · flexible tank or DPS builds.
Weaknesses: no ranged attacks · no magic or healing · slow movement speed.

Signature Abilities: Invincibility · Damage Surge · Guardian's Aura · Avatar Form.

The earth trembles when Ulfgar charges.`,
    unlocked: true,
    image: "/hero-portraits/barbarian_warrior.png",
    tags: ["crusade", "barbarian", "warrior", "uncommon"],
    quote: "I do not fight to survive. I fight because the mountain told me to.",
    quoteAuthor: "Ulfgar Bonecrusher",
  },
  {
    id: "lore-hero-codex-barbarian-worg",
    title: "Hrothgar Fangborn — The Beast of the North",
    category: "characters",
    content: `In the deepest winter, when wolves howl for blood, Hrothgar answers. Half-man, half-beast, he leads a pack of dire wolves across the frozen wastes, hunting Legion scouts with savage precision.

Born during an eclipse, Hrothgar was left in the woods as an omen of doom. Raised by a great wolf mother, he returned to his tribe as a teenager who could speak with beasts and shift his form at will.

Combat Profile: Melee Shapeshifting Combat. Wields claws, fangs and natural weapons. Chaotic Neutral alignment, Expert difficulty.

Strengths: multiple combat forms · Rage synergy with beast forms · strong self-buffs.
Weaknesses: no ranged attacks · no healing spells · form-dependent abilities.

Signature Abilities: Bear Form · Feral Rage · Raptor Form · Worg Lord.

When the north wind howls, it speaks his name.`,
    unlocked: true,
    image: "/hero-portraits/barbarian_worg.png",
    tags: ["crusade", "barbarian", "worg", "legendary"],
    quote: "The pack does not forgive. The pack does not forget.",
    quoteAuthor: "Hrothgar Fangborn",
  },
  {
    id: "lore-hero-codex-barbarian-mage",
    title: "Volka Stormborn — The Frost Witch",
    category: "characters",
    content: `The northern shamans channel magic through primal fury rather than scholarly study. Volka commands blizzards and lightning, her spells fueled by the raw rage of the frozen north.

During a deadly blizzard that buried her village, young Volka discovered she could command the storm itself. The tribal elders named her Stormborn and sent her south to aid the Crusade with her elemental fury.

Combat Profile: Ranged Magic & Healing. Wields totems, bone staves and runic armor. Chaotic Neutral alignment, Advanced difficulty.

Strengths: powerful AoE damage · Rage bonus applies to spells · frost resistance.
Weaknesses: very fragile in melee · mana dependent · low physical defense.

Signature Abilities: Mana Shield · Fireball · Heal · Lightning Chain.

Her anger is the storm. Her mercy is the calm.`,
    unlocked: true,
    image: "/hero-portraits/barbarian_mage.png",
    tags: ["crusade", "barbarian", "mage", "epic"],
    quote: "Winter does not come. I bring it.",
    quoteAuthor: "Volka Stormborn",
  },
  {
    id: "lore-hero-codex-barbarian-ranger",
    title: "Svala Windrider — The Silent Huntress",
    category: "characters",
    content: `No prey escapes Svala. She tracks across frozen tundra, through blinding snowstorms, reading the land like an open book. Her arrows are tipped with the venom of ice serpents.

Svala was the youngest hunter to ever complete the Trial of the Winter Hunt, tracking and slaying a frost drake alone at age fourteen. Now she serves as the Crusade's premier wilderness scout.

Combat Profile: Ranged Physical & Stealth. Wields longbows, ice javelins and leather armor. True Neutral alignment, Intermediate difficulty.

Strengths: longest attack range · Rage bonus when wounded · stealth and evasion.
Weaknesses: low armor and HP · weak in prolonged melee · no healing abilities.

Signature Abilities: Precision · Power Shot · Multi Shot · Rain of Arrows.

She does not miss. She does not warn.`,
    unlocked: true,
    image: "/hero-portraits/barbarian_ranger.png",
    tags: ["crusade", "barbarian", "ranger", "rare"],
    quote: "The wind tells me where you hide.",
    quoteAuthor: "Svala Windrider",
  },
  {
    id: "lore-hero-codex-dwarf-warrior",
    title: "Thane Ironshield — The Mountain Guardian",
    category: "characters",
    content: `The Thane of Ironhold has defended the mountain passes for over a century. His enchanted shield, Aegis of Ancestors, was forged from the heart of the mountain itself and has never been pierced.

Thane Ironshield is the 47th guardian of the Deep Gate, an unbroken lineage stretching back to the founding of Stonehold. When the Grudge Wars began, he sealed the lower mines and marched to war.

Combat Profile: Melee Physical Combat. Wields war hammers, tower shields and runic plate. Lawful Good alignment, Beginner difficulty.

Strengths: highest defense in game · Stoneborn defense bonus stacks · impenetrable tank.
Weaknesses: very slow movement · no ranged attacks · no healing.

Signature Abilities: Invincibility · Damage Surge · Guardian's Aura · Avatar Form.

The mountain does not move. Neither does he.`,
    unlocked: true,
    image: "/hero-portraits/dwarf_warrior.png",
    tags: ["fabled", "dwarf", "warrior", "rare"],
    quote: "Deeper than stone. Harder than iron. We endure.",
    quoteAuthor: "Thane Ironshield",
  },
  {
    id: "lore-hero-codex-dwarf-worg",
    title: "Bromm Earthshaker — The Cavern Beast",
    category: "characters",
    content: `Deep beneath the mountains, Bromm discovered an ancient bear spirit imprisoned in crystal. By freeing it, the spirit merged with his dwarven soul, creating something unprecedented: a shapeshifter of living stone.

Bromm was a miner who broke through into a sealed cavern containing a primordial earth spirit. The merging nearly killed him but left him able to transform into a creature of rock and fury.

Combat Profile: Melee Shapeshifting Combat. Wields stone claws, earth fangs and crystal armor. Neutral Good alignment, Expert difficulty.

Strengths: Bear Form + Stoneborn = unstoppable tank · multiple combat forms · high base defense.
Weaknesses: extremely slow in all forms · no ranged attacks · no healing spells.

Signature Abilities: Bear Form · Feral Rage · Raptor Form · Worg Lord.

The deep places remember. Bromm makes them forget.`,
    unlocked: true,
    image: "/hero-portraits/dwarf_worg.png",
    tags: ["fabled", "dwarf", "worg", "legendary"],
    quote: "The mountain has teeth. I am its bite.",
    quoteAuthor: "Bromm Earthshaker",
  },
  {
    id: "lore-hero-codex-dwarf-mage",
    title: "Runa Forgekeeper — The Runesmith",
    category: "characters",
    content: `Dwarven magic is not the flashy arcana of elves or humans. It is the deep magic of rune and forge, of fire shaped by will and hammer. Runa channels this ancient craft in battle.

Last of the Forgekeeper bloodline, Runa carries the knowledge of runic magic that predates the Grudge Wars. Her forge-spells burn hotter than dragonfire and her rune-shields are nigh unbreakable.

Combat Profile: Ranged Magic & Healing. Wields runic hammers, forge staves and rune armor. Lawful Neutral alignment, Intermediate difficulty.

Strengths: Stoneborn makes her tankier than other mages · powerful forge spells · runic healing.
Weaknesses: slow movement · mana dependent · short range compared to elves.

Signature Abilities: Mana Shield · Fireball · Heal · Lightning Chain.

The forge burns eternal. So does she.`,
    unlocked: true,
    image: "/hero-portraits/dwarf_mage.png",
    tags: ["fabled", "dwarf", "mage", "rare"],
    quote: "Every rune tells a story. Mine tells of fire.",
    quoteAuthor: "Runa Forgekeeper",
  },
  {
    id: "lore-hero-codex-dwarf-ranger",
    title: "Durin Tunnelwatcher — The Deep Scout",
    category: "characters",
    content: `Not all dwarves fight on the front line. Durin patrols the endless tunnels beneath the mountains, his crossbow picking off threats in the dark long before they reach the surface.

Durin lost his squad to a cave-in during a tunnel patrol. Alone in the dark for thirty days, he learned to navigate by echo and smell. He emerged transformed, able to fight in total darkness.

Combat Profile: Ranged Physical & Stealth. Wields heavy crossbows, throwing axes and chain mail. Lawful Neutral alignment, Intermediate difficulty.

Strengths: Stoneborn gives extra survivability · armor-piercing bolts · dark vision.
Weaknesses: slow movement · less range than elf rangers · no healing abilities.

Signature Abilities: Precision · Power Shot · Multi Shot · Rain of Arrows.

He sees in the dark. You do not see him.`,
    unlocked: true,
    image: "/hero-portraits/dwarf_ranger.png",
    tags: ["fabled", "dwarf", "ranger", "uncommon"],
    quote: "In the deep, every sound is a target.",
    quoteAuthor: "Durin Tunnelwatcher",
  },
  {
    id: "lore-hero-codex-elf-warrior",
    title: "Thalion Bladedancer — The Graceful Death",
    category: "characters",
    content: `Elven warriors do not rely on brute force. Thalion's blade moves like water, each stroke a masterwork of precision. He has dueled and defeated opponents twice his size through technique alone.

Trained in the Moonblade Academy for three centuries, Thalion mastered every weapon form before settling on the twin curved blades that earned him his title. His dance-like fighting style is mesmerizing and lethal.

Combat Profile: Melee Physical Combat. Wields curved blades, mithril armor and elven shields. Neutral Good alignment, Intermediate difficulty.

Strengths: highest accuracy of all warriors · fast attack speed · Arcane mana bonus.
Weaknesses: lower HP than other warriors · no ranged attacks · fragile for a tank.

Signature Abilities: Invincibility · Damage Surge · Guardian's Aura · Avatar Form.

His enemies never see the second strike.`,
    unlocked: true,
    image: "/hero-portraits/elf_warrior.png",
    tags: ["fabled", "elf", "warrior", "common"],
    quote: "A blade is a brush. Combat is art.",
    quoteAuthor: "Thalion Bladedancer",
  },
  {
    id: "lore-hero-codex-elf-worg",
    title: "Sylara Wildheart — The Forest Spirit",
    category: "characters",
    content: `Sylara is the last of the Wildheart druids who once protected the great forests. She channels the spirits of ancient beasts through elven magic, her transformations enhanced by centuries of arcane study.

When the Darkwood began to wither from Legion corruption, Sylara performed the ancient Rite of Binding, merging her soul with the forest's guardian spirit. Now she IS the forest's wrath.

Combat Profile: Melee Shapeshifting Combat. Wields nature claws, spirit fangs and living armor. Neutral Good alignment, Expert difficulty.

Strengths: extra mana for more transformations · Keen Senses boost form accuracy · ancient spirit power.
Weaknesses: fragile base form · no ranged attacks · form-dependent abilities.

Signature Abilities: Bear Form · Feral Rage · Raptor Form · Worg Lord.

She wears the shapes of forgotten gods.`,
    unlocked: true,
    image: "/hero-portraits/elf_worg.png",
    tags: ["fabled", "elf", "worg", "epic"],
    quote: "The forest breathes through me. And it is angry.",
    quoteAuthor: "Sylara Wildheart",
  },
  {
    id: "lore-hero-codex-elf-mage",
    title: "Lyra Stormweaver — The Storm Weaver",
    category: "characters",
    content: `Elven mages are the most powerful spellcasters in all the realms. Lyra channels the raw essence of the ley lines, her magic amplified by centuries of study and an innate arcane connection.

Lyra spent four hundred years studying in the Crystal Spire before the Grudge Wars forced her into battle. Her mastery of all eight schools of magic makes her the most versatile caster alive.

Combat Profile: Ranged Magic & Healing. Wields crystal staves, moonstone orbs and silk robes. True Neutral alignment, Advanced difficulty.

Strengths: highest spell power in game · extra mana from Arcane Affinity · spell accuracy from Keen Senses.
Weaknesses: extremely fragile · mana dependent · virtually no melee capability.

Signature Abilities: Mana Shield · Fireball · Heal · Lightning Chain.

The stars whisper their secrets to her alone.`,
    unlocked: true,
    image: "/hero-portraits/elf_mage.png",
    tags: ["fabled", "elf", "mage", "epic"],
    quote: "Magic is not power. It is understanding. I understand everything.",
    quoteAuthor: "Lyra Stormweaver",
  },
  {
    id: "lore-hero-codex-elf-ranger",
    title: "Aelindra Swiftbow — The Wind Walker",
    category: "characters",
    content: `The greatest archer to ever live, Aelindra can split an arrow at three hundred paces while riding at full gallop. Her elven eyes miss nothing, and her enchanted bow never runs dry.

Captain of the Silverglade Sentinels for two centuries, Aelindra has defended the borders of the Fabled lands against every threat. She trained under Lyra Stormweaver and infuses her arrows with arcane energy.

Combat Profile: Ranged Physical & Stealth. Wields enchanted longbows, mithril arrows and leaf armor. Chaotic Good alignment, Advanced difficulty.

Strengths: unmatched accuracy · arcane-enhanced arrows · fastest ranger.
Weaknesses: very fragile · poor melee defense · no healing abilities.

Signature Abilities: Precision · Power Shot · Multi Shot · Rain of Arrows.

Her arrows sing the songs of extinction.`,
    unlocked: true,
    image: "/hero-portraits/elf_ranger.png",
    tags: ["fabled", "elf", "ranger", "uncommon"],
    quote: "I loosed the arrow yesterday. It arrives tomorrow. You die today.",
    quoteAuthor: "Aelindra Swiftbow",
  },
  {
    id: "lore-hero-codex-orc-warrior",
    title: "Grommash Ironjaw — The Warchief",
    category: "characters",
    content: `The mightiest warrior the Legion has ever produced, Grommash earned his chieftainship by defeating every challenger in the Pit of Blood. His massive cleaver has carved a path of destruction across three continents.

Born during a blood eclipse, Grommash was destined for war. At age six he killed his first opponent in the fighting pits. By twenty he had united the warring orc clans under a single banner through sheer force.

Combat Profile: Melee Physical Combat. Wields massive cleavers, spiked armor and war totems. Chaotic Evil alignment, Beginner difficulty.

Strengths: highest raw damage · Bloodrage + crit combo devastating · best warrior for pure DPS.
Weaknesses: no ranged attacks · no healing · reckless combat style.

Signature Abilities: Invincibility · Damage Surge · Guardian's Aura · Avatar Form.

He does not ask for surrender.`,
    unlocked: true,
    image: "/hero-portraits/orc_warrior.png",
    tags: ["legion", "orc", "warrior", "common"],
    quote: "BLOOD AND THUNDER!",
    quoteAuthor: "Grommash Ironjaw",
  },
  {
    id: "lore-hero-codex-orc-worg",
    title: "Fenris Bloodfang — The Alpha",
    category: "characters",
    content: `Fenris challenged the great dire wolf Shadowmaw to single combat and won, absorbing the beast's spirit. Now he commands the Legion's beast packs, his howl freezing enemies in terror.

Exiled from his clan for refusing to kill prisoners, Fenris wandered the Ashlands alone until Shadowmaw found him. Their battle lasted three days. When it ended, they were one being.

Combat Profile: Melee Shapeshifting Combat. Wields blood claws, shadow fangs and bone armor. Chaotic Neutral alignment, Expert difficulty.

Strengths: Bloodrage synergizes with feral forms · crit bonus in all forms · most aggressive worg.
Weaknesses: no ranged attacks · no healing · berserker tendencies.

Signature Abilities: Bear Form · Feral Rage · Raptor Form · Worg Lord.

His shadow has teeth.`,
    unlocked: true,
    image: "/hero-portraits/orc_worg.png",
    tags: ["legion", "orc", "worg", "epic"],
    quote: "I am the alpha. There is no omega.",
    quoteAuthor: "Fenris Bloodfang",
  },
  {
    id: "lore-hero-codex-orc-mage",
    title: "Zul'jin the Hexmaster — The Blood Shaman",
    category: "characters",
    content: `Orc magic is blood magic, raw and dangerous. Zul'jin channels the life force of fallen enemies into devastating hexes and dark healing, growing stronger with every kill.

Born with the gift of blood-sight, Zul'jin was taken by the Legion's war shamans at birth. He learned to weaponize pain itself, turning enemy suffering into fuel for his dark arts.

Combat Profile: Ranged Magic & Healing. Wields skull staves, blood orbs and hex totems. Neutral Evil alignment, Advanced difficulty.

Strengths: Bloodrage boosts spell damage when wounded · critical hit spells · dark healing.
Weaknesses: fragile in melee · blood magic is unstable · mana dependent.

Signature Abilities: Mana Shield · Fireball · Heal · Lightning Chain.

He paints with the colors of agony.`,
    unlocked: true,
    image: "/hero-portraits/orc_mage.png",
    tags: ["legion", "orc", "mage", "rare"],
    quote: "Your blood screams louder than you do.",
    quoteAuthor: "Zul'jin the Hexmaster",
  },
  {
    id: "lore-hero-codex-orc-ranger",
    title: "Razak Deadeye — The Trophy Hunter",
    category: "characters",
    content: `Razak hunts for glory, not survival. His trophy rack holds the heads of legendary beasts, and his poison-tipped bolts bring down prey that should be impossible to kill.

A disgraced warrior who lost his sword arm in battle, Razak reinvented himself as a marksman. His custom war-crossbow fires bolts that can penetrate dragon scale at fifty paces.

Combat Profile: Ranged Physical & Stealth. Wields war crossbows, poison bolts and spiked leather. Chaotic Evil alignment, Intermediate difficulty.

Strengths: crit bonus stacks with Precision · Bloodrage makes him lethal when wounded · armor-piercing.
Weaknesses: low armor · reckless positioning · no healing abilities.

Signature Abilities: Precision · Power Shot · Multi Shot · Rain of Arrows.

His trophies whisper of things that should not die.`,
    unlocked: true,
    image: "/hero-portraits/orc_ranger.png",
    tags: ["legion", "orc", "ranger", "uncommon"],
    quote: "Every head on my wall was once the strongest in its land.",
    quoteAuthor: "Razak Deadeye",
  },
  {
    id: "lore-hero-codex-undead-warrior",
    title: "Lord Malachar — The Deathless Knight",
    category: "characters",
    content: `Once a noble paladin, Malachar was slain and raised by dark necromancy. Now he fights with the skill of his former life but the relentless endurance of undeath, unable to feel pain or fear.

Sir Malachar the Pure was the greatest knight of his age until he fell defending a temple. The necromancer who raised him twisted his devotion into dark loyalty. He remembers fragments of who he was and hates what he has become.

Combat Profile: Melee Physical Combat. Wields cursed blades, bone shields and death plate. Lawful Evil alignment, Intermediate difficulty.

Strengths: highest effective HP from Undying bonus · Fear Aura weakens enemies · cannot be feared.
Weaknesses: slow · vulnerable to holy magic · no healing synergies.

Signature Abilities: Invincibility · Damage Surge · Guardian's Aura · Avatar Form.

Death was just the beginning of his war.`,
    unlocked: true,
    image: "/hero-portraits/undead_warrior.png",
    tags: ["legion", "undead", "warrior", "rare"],
    quote: "I cannot die. I have tried.",
    quoteAuthor: "Lord Malachar",
  },
  {
    id: "lore-hero-codex-undead-worg",
    title: "The Ghoulfather — The Abomination",
    category: "characters",
    content: `A failed necromantic experiment that merged a warrior's corpse with several beast spirits. The result is an abomination that shifts between grotesque forms, each more terrifying than the last.

The Ghoulfather was created when a desperate necromancer tried to bind multiple animal spirits to a single corpse. The spirits fought for dominance, creating an entity that shifts between forms uncontrollably, driven by rage.

Combat Profile: Melee Shapeshifting Combat. Wields bone claws, corpse fangs and stitched armor. Chaotic Evil alignment, Expert difficulty.

Strengths: Undying + Bear Form = massive HP pool · Fear Aura in all forms · terrifying presence.
Weaknesses: uncontrollable · vulnerable to holy · no healing.

Signature Abilities: Bear Form · Feral Rage · Raptor Form · Worg Lord.

It remembers being three different things. None of them were kind.`,
    unlocked: true,
    image: "/hero-portraits/undead_worg.png",
    tags: ["legion", "undead", "worg", "legendary"],
    quote: "We... are... HUNGRY.",
    quoteAuthor: "The Ghoulfather",
  },
  {
    id: "lore-hero-codex-undead-mage",
    title: "Necromancer Vexis — The Soul Harvester",
    category: "characters",
    content: `Vexis died as a scholar of the arcane arts and was raised specifically for her magical knowledge. In undeath, her power has grown beyond mortal limits, fueled by harvested souls.

In life, Vexis was a renowned healer. The irony is not lost on her — she now commands the very forces of death she once fought against. Her soul spells tear the life essence from enemies.

Combat Profile: Ranged Magic & Healing. Wields bone staves, soul gems and shadow robes. Neutral Evil alignment, Advanced difficulty.

Strengths: Undying makes her surprisingly durable for a mage · Fear Aura helps survival · soul magic amplification.
Weaknesses: still fragile to burst damage · holy magic weakness · mana dependent.

Signature Abilities: Mana Shield · Fireball · Heal · Lightning Chain.

She weaves spells from the screams of the fallen.`,
    unlocked: true,
    image: "/hero-portraits/undead_mage.png",
    tags: ["legion", "undead", "mage", "epic"],
    quote: "Death is not the end. It is the door to real power.",
    quoteAuthor: "Necromancer Vexis",
  },
  {
    id: "lore-hero-codex-undead-ranger",
    title: "Shade Whisper — The Phantom Archer",
    category: "characters",
    content: `Once the finest scout in the Crusade, Shade Whisper was killed and raised to serve the very forces she once hunted. Her spectral arrows pass through armor as if it were mist.

In life she was named Elena Brightarrow, and she was beloved by her comrades. Now she hunts them with the same skill, her phantom arrows guided by the memories of a life she can no longer feel.

Combat Profile: Ranged Physical & Stealth. Wields a phantom bow, spirit arrows and a shadow cloak. Neutral Evil alignment, Intermediate difficulty.

Strengths: phase arrows ignore some defense · Fear Aura provides safety · Undying survivability.
Weaknesses: holy magic weakness · haunted by past · no healing abilities.

Signature Abilities: Precision · Power Shot · Multi Shot · Rain of Arrows.

Her arrows carry the weight of a life she can never reclaim.`,
    unlocked: true,
    image: "/hero-portraits/undead_ranger.png",
    tags: ["legion", "undead", "ranger", "uncommon"],
    quote: "I remember your face. I remember all their faces.",
    quoteAuthor: "Shade Whisper",
  },
];


// Get starting player roster
export function getStarterRoster(): Unit[] {
  return [
    generateUnit("warrior", "crusade", false, 1),
    generateUnit("ranger", "crusade", false, 1),
    generateUnit("mage", "crusade", false, 1),
    generateUnit("worge", "crusade", false, 1),
  ];
}

// Generate enemy team based on difficulty
export function generateEnemyTeam(difficulty: "easy" | "normal" | "hard", playerLevel: number): Unit[] {
  const enemyFactions: Faction[] = ["fabled", "legion"];
  const faction = enemyFactions[Math.floor(Math.random() * enemyFactions.length)];
  
  const counts = {
    easy: 3,
    normal: 4,
    hard: 5,
  };
  
  const levelBonus = {
    easy: -1,
    normal: 0,
    hard: 1,
  };
  
  const classes: UnitClass[] = ["warrior", "ranger", "mage", "worge"];
  const team: Unit[] = [];
  
  for (let i = 0; i < counts[difficulty]; i++) {
    const unitClass = classes[Math.floor(Math.random() * classes.length)];
    const level = Math.max(1, playerLevel + levelBonus[difficulty]);
    team.push(generateUnit(unitClass, faction, true, level));
  }
  
  return team;
}
