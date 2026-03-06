export interface RaceBonus {
  type: string;
  value: number;
  description: string;
}

export interface Race {
  id: string;
  name: string;
  faction: 'crusade' | 'fabled' | 'legion';
  lore: string;
  bonuses: RaceBonus[];
  recommendedClasses: string[];
}

export interface ClassAbility {
  name: string;
  description: string;
}

export interface CharacterClass {
  id: string;
  name: string;
  role: string;
  description: string;
  primaryStats: string[];
  armorTypes: string[];
  weaponTypes: string[];
  resource: string;
  startingAttributes: Record<string, number>;
  abilities: ClassAbility[];
}

export const FACTIONS = {
  crusade: { id: 'crusade', name: 'Crusade', races: ['human', 'barbarian'] },
  fabled: { id: 'fabled', name: 'Fabled', races: ['dwarf', 'elf'] },
  legion: { id: 'legion', name: 'Legion', races: ['orc', 'undead'] },
} as const;

export const RACES: Record<string, Race> = {
  human: {
    id: 'human',
    name: 'Human',
    faction: 'crusade',
    lore: 'Adaptable survivors who thrive in any environment. Known for their resilience and determination.',
    bonuses: [
      { type: 'xpGain', value: 0.10, description: '+10% experience from all sources' },
      { type: 'skillPoints', value: 1, description: '+1 starting skill point' },
      { type: 'diplomacy', value: 0.05, description: 'Better prices from merchants' },
    ],
    recommendedClasses: ['warrior', 'mage', 'rogue', 'cleric'],
  },
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    faction: 'crusade',
    lore: 'Fierce warriors from the northern wastes. Valued for their raw strength and battle rage.',
    bonuses: [
      { type: 'strength', value: 2, description: '+2 starting STR' },
      { type: 'physicalDamage', value: 0.05, description: '+5% physical damage' },
      { type: 'berserk', value: 0.15, description: 'Gain 15% damage when below 30% HP' },
    ],
    recommendedClasses: ['warrior'],
  },
  dwarf: {
    id: 'dwarf',
    name: 'Dwarf',
    faction: 'fabled',
    lore: 'Stout mountain folk, master smiths and defenders. Unmatched endurance in battle.',
    bonuses: [
      { type: 'endurance', value: 2, description: '+2 starting END' },
      { type: 'physicalDefense', value: 0.10, description: '+10% physical defense' },
      { type: 'craftingQuality', value: 0.10, description: '+10% crafting quality bonus' },
    ],
    recommendedClasses: ['warrior', 'cleric'],
  },
  elf: {
    id: 'elf',
    name: 'Elf',
    faction: 'fabled',
    lore: 'Ancient beings with deep connection to magic and nature. Masters of precision and wisdom.',
    bonuses: [
      { type: 'intellect', value: 2, description: '+2 starting INT' },
      { type: 'maxMana', value: 0.10, description: '+10% maximum mana' },
      { type: 'critChance', value: 0.05, description: '+5% critical chance' },
    ],
    recommendedClasses: ['mage', 'rogue'],
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    faction: 'legion',
    lore: 'Fierce warriors from the wastelands. Valued for their raw strength and battle prowess.',
    bonuses: [
      { type: 'strength', value: 2, description: '+2 starting STR' },
      { type: 'physicalDamage', value: 0.08, description: '+8% physical damage' },
      { type: 'intimidate', value: 0.10, description: 'Enemies deal 10% less damage' },
    ],
    recommendedClasses: ['warrior'],
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    faction: 'legion',
    lore: 'Risen souls bound to serve the dark forces. Immune to many ailments of the living.',
    bonuses: [
      { type: 'debuffResistance', value: 0.15, description: '+15% debuff resistance' },
      { type: 'lifesteal', value: 0.05, description: '+5% lifesteal on attacks' },
      { type: 'immortalWill', value: 1, description: 'Can fight at 0 HP briefly' },
    ],
    recommendedClasses: ['warrior', 'mage'],
  },
};

export const CLASSES: Record<string, CharacterClass> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    role: 'Tank / Melee DPS',
    description: 'Front-line combatants specializing in physical damage and damage absorption.',
    primaryStats: ['STR', 'VIT', 'END'],
    armorTypes: ['Mail', 'Plate'],
    weaponTypes: ['Swords', 'Axes', 'Maces', 'Shields'],
    resource: 'Rage',
    startingAttributes: { Strength: 10, Vitality: 5, Endurance: 5 },
    abilities: [
      { name: 'Shield Bash', description: 'Stun target briefly' },
      { name: 'Cleave', description: 'Hit multiple enemies' },
      { name: 'Battle Cry', description: 'Buff allies damage' },
      { name: 'Last Stand', description: 'Damage reduction when low HP' },
    ],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    role: 'Magic DPS / Crowd Control',
    description: 'Wielders of arcane power who deal devastating magical damage from range.',
    primaryStats: ['INT', 'WIS'],
    armorTypes: ['Cloth'],
    weaponTypes: ['Staves', 'Wands', 'Orbs'],
    resource: 'Mana',
    startingAttributes: { Intellect: 10, Wisdom: 10 },
    abilities: [
      { name: 'Fireball', description: 'High damage single target' },
      { name: 'Frost Nova', description: 'AoE slow/freeze' },
      { name: 'Arcane Missiles', description: 'Sustained damage' },
      { name: 'Teleport', description: 'Instant repositioning' },
    ],
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    role: 'Melee DPS / Assassin',
    description: 'Agile fighters who rely on speed, precision, and critical strikes.',
    primaryStats: ['DEX', 'AGI', 'STR'],
    armorTypes: ['Leather'],
    weaponTypes: ['Daggers', 'Swords', 'Bows'],
    resource: 'Energy',
    startingAttributes: { Strength: 6, Dexterity: 7, Agility: 7 },
    abilities: [
      { name: 'Backstab', description: 'High damage from behind' },
      { name: 'Evade', description: 'Dodge incoming attacks' },
      { name: 'Poison Blade', description: 'Apply damage over time' },
      { name: 'Shadow Step', description: 'Teleport behind target' },
    ],
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    role: 'Healer / Support',
    description: 'Divine spellcasters who heal allies and smite enemies.',
    primaryStats: ['WIS', 'VIT', 'INT'],
    armorTypes: ['Cloth', 'Mail'],
    weaponTypes: ['Maces', 'Staves', 'Shields'],
    resource: 'Mana',
    startingAttributes: { Vitality: 5, Intellect: 5, Wisdom: 10 },
    abilities: [
      { name: 'Heal', description: 'Restore ally health' },
      { name: 'Smite', description: 'Holy damage to enemies' },
      { name: 'Blessing', description: 'Buff ally stats' },
      { name: 'Resurrection', description: 'Revive fallen allies' },
    ],
  },
};

export function getRacesByFaction(faction: 'crusade' | 'fabled' | 'legion'): Race[] {
  return Object.values(RACES).filter(r => r.faction === faction);
}

export function getClassById(classId: string): CharacterClass | undefined {
  return CLASSES[classId];
}

export function getRaceById(raceId: string): Race | undefined {
  return RACES[raceId];
}
