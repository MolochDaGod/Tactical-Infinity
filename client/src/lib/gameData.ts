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
export const baseStats: Record<UnitClass, { hp: number; attack: number; defense: number; speed: number; movement: number; range: number }> = {
  warrior: { hp: 120, attack: 28, defense: 22, speed: 12, movement: 3, range: 1 },
  ranger: { hp: 80, attack: 25, defense: 12, speed: 16, movement: 4, range: 4 },
  mage: { hp: 70, attack: 35, defense: 10, speed: 14, movement: 3, range: 3 },
  worge: { hp: 100, attack: 30, defense: 15, speed: 18, movement: 5, range: 1 },
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

// Faction colors for UI
export const factionColors: Record<Faction, { primary: string; secondary: string }> = {
  crusade: { primary: "hsl(45, 90%, 50%)", secondary: "hsl(45, 70%, 85%)" },
  fabled: { primary: "hsl(200, 70%, 45%)", secondary: "hsl(200, 50%, 80%)" },
  legion: { primary: "hsl(0, 60%, 40%)", secondary: "hsl(0, 40%, 75%)" },
};

// Race colors for 3D model tinting
export const raceColors: Record<string, { primary: string; secondary: string }> = {
  human: { primary: "hsl(30, 50%, 60%)", secondary: "hsl(30, 40%, 80%)" },
  barbarian: { primary: "hsl(25, 70%, 45%)", secondary: "hsl(25, 50%, 75%)" },
  dwarf: { primary: "hsl(35, 60%, 40%)", secondary: "hsl(35, 50%, 70%)" },
  elf: { primary: "hsl(140, 50%, 50%)", secondary: "hsl(140, 40%, 80%)" },
  orc: { primary: "hsl(100, 60%, 30%)", secondary: "hsl(100, 40%, 60%)" },
  undead: { primary: "hsl(270, 40%, 35%)", secondary: "hsl(270, 30%, 65%)" },
};

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
    content: `Long ago, the world of Aethermoor was whole - a realm where magic flowed freely through crystalline ley lines that connected all living things. The five great nations lived in harmony, their borders defined not by walls but by the natural flow of arcane energy.

Then came the Sundering.

No one knows what truly caused it. Some say it was the hubris of the Archmage Council, attempting to harness the power of the World Heart. Others whisper of darker forces, ancient entities from beyond the veil who sought to shatter reality itself.

What we know is this: In a single catastrophic moment, the ley lines ruptured. Magic, once predictable and gentle, became wild and dangerous. The land itself split apart, creating the Fractured Isles we now call home.

From this chaos, four factions emerged, each believing they alone hold the key to restoring or reshaping the world.`,
    unlocked: true,
  },
  {
    id: "lore-2",
    title: "The Lightborn",
    category: "factions",
    content: `The Lightborn are the self-proclaimed protectors of the old ways. Clad in gleaming armor blessed by the remnants of the World Heart's light, they fight to restore Aethermoor to its former glory.

Their capital, the Radiant Citadel, floats above the clouds on a fragment of the original continent, bathed in eternal golden light. Here, their Paladin-Lords train warriors and mages alike in the sacred arts.

The Lightborn believe that unity and righteousness will heal the Fracture. Critics call them naive idealists; their followers call them the last hope.

Led by High Seraph Aldric the Undying, who claims to have witnessed the Sundering itself, the Lightborn march forth with banners of gold and silver, seeking to unite the scattered peoples under one radiant banner.`,
    unlocked: true,
  },
  {
    id: "lore-3",
    title: "The Shadowveil",
    category: "factions",
    content: `In the darkest corners of the Fractured Isles, where the ley lines twist into corrupted spirals, the Shadowveil makes their home. They are assassins, spies, and wielders of shadow magic - and they believe the old world had to die.

To the Shadowveil, the Sundering was not a catastrophe but a liberation. The rigid hierarchies of the old nations were swept away, creating opportunities for those clever enough to seize them.

Their leader, the enigmatic Whisper Queen, rules from the Obsidian Throne in a city that exists in perpetual twilight. No one has seen her face; some say she has none.

The Shadowveil does not seek to restore or destroy - they seek to control. In the chaos of the new world, information is power, and they hoard it like dragons hoard gold.`,
    unlocked: true,
  },
  {
    id: "lore-4",
    title: "The Ironclad",
    category: "factions",
    content: `When the Sundering shattered the world, the mountain holds of the northern realms endured. The Ironclad, master smiths and warriors, emerged from their forges ready to face the new age.

They reject magic entirely. To them, the arcane arts caused the Sundering and continue to corrupt the world. Instead, they rely on superior craftsmanship, steam-powered machinery, and unbreakable discipline.

The Ironclad cities are marvels of engineering - great fortress-factories that belch smoke and ring with the sound of hammers day and night. Their soldiers march in lockstep, clad in mechanized armor that rivals the strength of any spell.

Warchief Thorin Ironheart leads them with an iron fist (literally - he lost his hand to a magical explosion and replaced it with a masterwork prosthetic). His dream: a world purged of magic, built on honest steel and hard work.`,
    unlocked: true,
  },
  {
    id: "lore-5",
    title: "The Wildkin",
    category: "factions",
    content: `Where the ley lines ruptured most violently, the land mutated. Forests grew twisted and strange, animals evolved in impossible ways, and the boundaries between human and beast blurred.

The Wildkin embraced this change.

Part druids, part shapeshifters, wholly dedicated to the new wild magic, the Wildkin believe the Sundering was nature's way of reclaiming the world from civilization's corruption. They seek not to restore or control, but to let the wild magic reshape everything.

Their settlements are living things - trees that grow into homes, rivers that flow uphill, creatures that are half-plant, half-animal serving as guardians and companions.

The Archdruid Thorn speaks for the Wildkin, though "leadership" is a loose concept among them. They follow the will of the land itself, which speaks to them through dreams and visions.`,
    unlocked: true,
  },
  {
    id: "lore-6",
    title: "Warriors",
    category: "bestiary",
    content: `The backbone of any army, Warriors are masters of close-quarters combat. Wielding sword and shield, they form the front line of battle, protecting more vulnerable allies while dealing steady damage.

A skilled Warrior can control the battlefield through positioning and aggression. Their Shield Bash ability creates openings for allies, while War Cry inspires nearby troops to fight harder.

Warriors favor heavy armor and simple, reliable weapons. They train for years to master the fundamentals: stance, footwork, and the perfect strike.

In the Fractured Isles, every faction has their own Warrior tradition:
- Lightborn Paladins channel holy light through their blades
- Shadowveil Executioners strike from ambush
- Ironclad Vanguards are walking tanks
- Wildkin Berserkers fight with primal fury`,
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
- Lightborn Luminaries channel purified light
- Shadowveil Hexers twist darkness into weapons
- Ironclad have no Mages (heresy!)
- Wildkin Shamans draw power from nature spirits`,
    unlocked: true,
  },
  {
    id: "lore-8",
    title: "The Fractured Isles",
    category: "locations",
    content: `Once a single vast continent, Aethermoor was shattered by the Sundering into hundreds of floating islands connected by unstable magical bridges and the occasional mundane chain.

The largest fragments retained some semblance of civilization:

THE RADIANT HIGHLANDS - Home of the Lightborn, perpetually bathed in golden light from the broken World Heart that still floats above.

THE SHADOW REACHES - A constellation of islands shrouded in eternal twilight, where the Shadowveil plots in darkness.

THE IRON MOUNTAINS - Massive floating peaks rich in ore, where the Ironclad have built their fortress-factories.

THE WILDS - Islands consumed by mutated nature, dangerous to all but the Wildkin who call them home.

THE CONTESTED ZONES - Neutral islands where the factions clash for resources and territory. Most battles take place here.

Travel between islands requires airships, magical portals, or the dangerous art of ley-line walking.`,
    unlocked: true,
  },
  {
    id: "lore-9",
    title: "Archers",
    category: "bestiary",
    content: `Masters of ranged combat, Archers control the battlefield from a distance. Their ability to strike from safety makes them invaluable, but they struggle when enemies close the gap.

The best Archers are patient hunters who choose their targets carefully. A well-placed arrow can eliminate an enemy mage or healer before they can act.

The Volley ability allows experienced Archers to rain death on an area, though the damage is spread thin. Poison Arrows add damage over time, weakening enemies for allies to finish.

Movement is key for an Archer. They must constantly reposition to maintain optimal range while avoiding pursuit.

Faction variations:
- Lightborn Sunbows fire arrows of pure light
- Shadowveil Deadeyes strike from impossible hiding spots
- Ironclad Crossbowmen use mechanical repeaters
- Wildkin Stalkers bond with nature to guide their shots`,
    unlocked: true,
  },
  {
    id: "lore-10",
    title: "Healers",
    category: "bestiary",
    content: `In the brutal conflicts of the Fractured Isles, Healers are worth their weight in gold. Their ability to restore health and remove debuffs keeps armies fighting long after they should have fallen.

A single Healer can change the outcome of a battle. Smart commanders protect them at all costs; smart enemies target them first.

The basic Heal spell restores a significant amount of health to one ally. Purify removes harmful effects. Divine Light is the ultimate healing ability, restoring all nearby allies at once.

Healers are poor fighters themselves. They carry light weapons more for self-defense than offense.

Faction variations:
- Lightborn Clerics channel the World Heart's blessing
- Shadowveil Necromancers heal through... questionable means
- Ironclad Medics use surgical tools and stimulants
- Wildkin Druids call upon nature's regenerative power`,
    unlocked: true,
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
