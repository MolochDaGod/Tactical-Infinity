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

export interface WeaponAbility {
  name: string;
  description: string;
}

export interface Weapon {
  id: string;
  name: string;
  type: string;
  category: "1h" | "2h" | "Ranged 2h";
  lore: string;
  stats: WeaponStats;
  basicAbility: string;
  abilities: string[];
  signatureAbility: string;
  passives: string[];
  craftedBy: "Miner" | "Forester" | "Engineer" | "Mystic";
}

function parseWeaponStats(dmg: string, speed: string, combo: string, crit: string, block: string, def: string): WeaponStats {
  const parse = (s: string) => {
    const parts = s.split(" +");
    const base = parseFloat(parts[0]) || 0;
    const perTier = parts.length > 1 ? (parseFloat(parts[1]) || 0) : 0;
    return { base, perTier };
  };
  return {
    damageBase: parse(dmg).base,
    damagePerTier: parse(dmg).perTier,
    speedBase: parse(speed).base,
    speedPerTier: parse(speed).perTier,
    comboBase: parse(combo).base,
    comboPerTier: parse(combo).perTier,
    critBase: parse(crit).base,
    critPerTier: parse(crit).perTier,
    blockBase: parse(block).base,
    blockPerTier: parse(block).perTier,
    defenseBase: parse(def).base,
    defensePerTier: parse(def).perTier,
  };
}

export const WEAPON_TYPES = [
  "Sword", "Axe", "Dagger", "Hammer1h", "Lance", "Mace",
  "Greatsword", "Greataxe", "Hammer2h",
  "Bow", "Crossbow", "Gun",
  "Fire Staff", "Frost Staff", "Nature Staff", "Holy Staff", "Arcane Staff", "Lightning Staff",
  "Fire Tome", "Frost Tome", "Nature Tome", "Holy Tome", "Arcane Tome", "Lightning Tome"
] as const;

export const SWORDS: Weapon[] = [
  { id: "sword-bloodfeud", name: "Bloodfeud Blade", type: "Sword", category: "1h", lore: "Forged in endless clan blood feuds", stats: parseWeaponStats("50 +12", "100 +25", "0 +0", "3 +0.5", "5 +1", "20 +6"), basicAbility: "Vengeful Slash (single-target slash, builds 1 Grudge Mark stack, max 3)", abilities: ["Blood Rush (dash forward 8m, AoE damage)", "Iron Grudge (3s damage reduction + reflect)", "Clan Charge (gap-closer charge + 1s stun)", "Heroic Cleave (cone AoE clear)", "Parry Counter (block + counter damage)", "Deep Wound (apply bleed stack)"], signatureAbility: "Crimson Reprisal (large AoE slash, heals per enemy hit)", passives: ["Bloodlust (5% lifesteal)", "Swift Vengeance (+15% atk speed)", "Deep Cuts (+20% bleed dmg)"], craftedBy: "Miner" },
  { id: "sword-wraithfang", name: "Wraithfang", type: "Sword", category: "1h", lore: "Whispers forgotten grudges in the dark", stats: parseWeaponStats("55 +13", "80 +20", "20 +10", "5 +0.8", "3 +0.8", "15 +5"), basicAbility: "Vengeful Slash", abilities: ["Blood Rush", "Iron Grudge", "Clan Charge", "Shadow Edge (dash + stun)", "Execute (bonus dmg <30% HP)", "Bleed Chain (spread bleed)", "Fatal Strike (high single burst)"], signatureAbility: "Night's Judgment (teleport behind + bleed DoT)", passives: ["Life Leech", "Aggressive Rush", "Grudge Explosion"], craftedBy: "Miner" },
  { id: "sword-oathbreaker", name: "Oathbreaker", type: "Sword", category: "1h", lore: "Breaks ancient oaths of peace", stats: parseWeaponStats("48 +11", "120 +30", "0 +0", "2 +0.4", "8 +1.5", "25 +7"), basicAbility: "Vengeful Slash", abilities: ["Lunging Strike (ranged thrust)", "Shadow Dash (mobility dash)", "Fearful Swipe (AoE fear)", "Hamstring (slow + dmg)", "Betrayer's Mark (reduce healing)", "Oathbreak (purge enemy buff)"], signatureAbility: "Ancestral Curse (AoE slow + DoT)", passives: ["Resilience", "Armor Pen", "Block Mastery"], craftedBy: "Miner" },
  { id: "sword-kinrend", name: "Kinrend", type: "Sword", category: "1h", lore: "Rends bonds of blood and kinship", stats: parseWeaponStats("52 +12", "110 +28", "10 +8", "4 +0.6", "4 +1", "18 +6"), basicAbility: "Vengeful Slash", abilities: ["Lunging Strike", "Shadow Dash", "Fearful Swipe", "Kin Strike (single high dmg)", "Ancestral Fury (knockback AoE)", "Family Grudge (stack DoT)", "Root Bind (root on mark)"], signatureAbility: "Wrath of Kin (AoE knockback + dmg)", passives: ["Bloodlust", "Swift Vengeance", "Deep Cuts"], craftedBy: "Miner" },
  { id: "sword-dusksinger", name: "Dusksinger", type: "Sword", category: "1h", lore: "Sings of twilight and ending grudges", stats: parseWeaponStats("53 +12", "90 +22", "30 +15", "6 +1", "4 +0.9", "17 +5"), basicAbility: "Vengeful Slash", abilities: ["Blood Rush", "Iron Grudge", "Clan Charge", "Dusk Blade (invis dash)", "Twilight Fear (AoE fear)", "Bleed Storm (multi bleed)"], signatureAbility: "Duskfall (AoE silence + dmg)", passives: ["Life Leech", "Aggressive Rush", "Grudge Explosion"], craftedBy: "Miner" },
  { id: "sword-emberclad", name: "Emberclad", type: "Sword", category: "1h", lore: "Clad in flames of burning hatred", stats: parseWeaponStats("54 +13", "95 +23", "25 +12", "4 +0.7", "6 +1.2", "22 +6"), basicAbility: "Vengeful Slash", abilities: ["Lunging Strike", "Shadow Dash", "Fearful Swipe", "Flame Slash (burn stack)", "Ember Charge (dash + burn)", "Heroic Burn (AoE DoT)", "Ignite Mark (explode marks)"], signatureAbility: "Ember Wrath (AoE fire nova)", passives: ["Burn Mastery", "Attack Speed", "Life Leech"], craftedBy: "Miner" },
];

export const AXES: Weapon[] = [
  { id: "axe-gorehowl", name: "Gorehowl", type: "Axe", category: "1h", lore: "Howls with the gore of fallen foes", stats: parseWeaponStats("60 +15", "120 +30", "0 +0", "2 +0.4", "4 +1", "25 +8"), basicAbility: "Rending Chop (single, applies Bleed stack)", abilities: ["Adrenaline Surge (+atk speed buff)", "Whirl of Pain (channeled AoE)", "Bloodletting (AoE bleed apply)", "Carnage Spin (360 AoE refresh bleed)", "Headcracker (single stun)", "Veinreaver (AoE lifesteal)"], signatureAbility: "Apocalypse Cleave (knockback)", passives: ["Bleed Mastery", "Vicious Wounds", "Life Leech"], craftedBy: "Miner" },
  { id: "axe-skullsplitter", name: "Skullsplitter", type: "Axe", category: "1h", lore: "Splits skulls of grudge bearers", stats: parseWeaponStats("62 +16", "110 +28", "10 +5", "3 +0.5", "5 +1.2", "23 +7"), basicAbility: "Rending Chop", abilities: ["Adrenaline Surge", "Whirl of Pain", "Bloodletting", "Headcracker (stun + dmg)", "Ground Rend (AoE slow)", "Ironmaw (armor reduce)"], signatureAbility: "Blood Harvest (AoE heal on hit)", passives: ["Bleed Mastery", "Heavy Hitter", "Resilience"], craftedBy: "Miner" },
  { id: "axe-veinreaver", name: "Veinreaver", type: "Axe", category: "1h", lore: "Reaves veins for blood tribute", stats: parseWeaponStats("58 +14", "130 +35", "0 +0", "4 +0.6", "3 +0.8", "20 +6"), basicAbility: "Rending Chop", abilities: ["Adrenaline Surge", "Whirl of Pain", "Bloodletting", "Blood Harvest (lifesteal AoE)", "Frenzied Chop (burst self-dmg)", "Bonehew (armor break)", "Shatterstrike (AoE shatter)"], signatureAbility: "Carnage Spin (refresh bleed)", passives: ["Life Leech", "Vicious Wounds", "Attack Speed"], craftedBy: "Miner" },
  { id: "axe-ironmaw", name: "Ironmaw", type: "Axe", category: "1h", lore: "Maw of iron that crushes oaths", stats: parseWeaponStats("61 +15", "115 +29", "5 +3", "2 +0.4", "6 +1.3", "28 +8"), basicAbility: "Rending Chop", abilities: ["Lunging Chop (range)", "War Cry (+dmg buff)", "Ground Slam (AoE slow)", "Ground Rend (slow AoE)", "Iron Bite (defense ignore)", "Dreadcleaver (frenzy)"], signatureAbility: "Reaping Slash (massive AoE)", passives: ["Bleed Mastery", "Life Leech", "Heavy Hitter"], craftedBy: "Miner" },
  { id: "axe-dreadcleaver", name: "Dreadcleaver", type: "Axe", category: "1h", lore: "Cleaves dread into enemies", stats: parseWeaponStats("59 +14", "125 +32", "15 +8", "5 +0.7", "4 +1", "22 +7"), basicAbility: "Rending Chop", abilities: ["Adrenaline Surge", "Whirl of Pain", "Bloodletting", "Frenzied Chop (high dmg)", "Shatterstrike (armor break)", "Bonehew (shatter)"], signatureAbility: "Carnage Spin (360 bleed refresh)", passives: ["Vicious Wounds", "Attack Speed", "Bleed Mastery"], craftedBy: "Miner" },
  { id: "axe-bonehew", name: "Bonehew", type: "Axe", category: "1h", lore: "Hews bone from grudge skeletons", stats: parseWeaponStats("63 +16", "105 +27", "0 +0", "3 +0.5", "7 +1.4", "26 +8"), basicAbility: "Rending Chop", abilities: ["Adrenaline Surge", "Whirl of Pain", "Bloodletting", "Bone Break (armor reduce)", "Veinreaver (lifesteal)", "Skullsplitter (stun)", "Ironmaw (slow)"], signatureAbility: "Apocalypse Cleave (knockback)", passives: ["Heavy Hitter", "Resilience", "Block Mastery"], craftedBy: "Miner" },
];

export const BOWS: Weapon[] = [
  { id: "bow-wraithbone", name: "Wraithbone Bow", type: "Bow", category: "Ranged 2h", lore: "Carved from bones of wraiths", stats: parseWeaponStats("55 +11", "80 +18", "30 +12", "6 +1", "2 +0.5", "15 +4"), basicAbility: "Grudge Arrow (single, builds Mark)", abilities: ["Volley (cone AoE)", "Swift Shot (mobility dmg)", "Piercing Barrage (channeled)", "Soulstorm Arrows (AoE rain)", "Crimson Shot (bleed single)", "Night Barrage (silence AoE)", "Flame Volley (DoT AoE)"], signatureAbility: "Wraithstrike (massive single-target)", passives: ["Precision", "Attack Speed", "Crit Chance"], craftedBy: "Forester" },
  { id: "bow-bloodstring", name: "Bloodstring Bow", type: "Bow", category: "Ranged 2h", lore: "Strung with strings of blood", stats: parseWeaponStats("57 +12", "85 +20", "25 +10", "7 +1.1", "3 +0.6", "14 +4"), basicAbility: "Grudge Arrow", abilities: ["Volley", "Swift Shot", "Piercing Barrage", "Crimson Shot (high bleed)", "Enchanted Quiver (+speed dmg)", "Rooting Shot (root)", "Demon Arrow (knockback AoE)"], signatureAbility: "Rain of Arrows (large AoE)", passives: ["Attack Speed", "Bleed Mastery", "Life Leech"], craftedBy: "Forester" },
  { id: "bow-shadowflight", name: "Shadowflight Bow", type: "Bow", category: "Ranged 2h", lore: "Flies shadows as arrows", stats: parseWeaponStats("54 +11", "75 +17", "35 +15", "8 +1.2", "1 +0.4", "13 +3"), basicAbility: "Grudge Arrow", abilities: ["Volley", "Swift Shot", "Piercing Barrage", "Night Barrage (AoE silence)", "Phantom Arrows (pierce)", "Enchanted Quiver (buff)"], signatureAbility: "Soulstorm Arrows (rain DoT)", passives: ["Precision", "Crit Chance", "Speed Draw"], craftedBy: "Forester" },
  { id: "bow-emberthorn", name: "Emberthorn Bow", type: "Bow", category: "Ranged 2h", lore: "Thorns of ember fire", stats: parseWeaponStats("56 +12", "90 +22", "20 +8", "5 +0.9", "4 +0.8", "16 +5"), basicAbility: "Grudge Arrow", abilities: ["Explosive Arrows (DoT AoE)", "Speed Shot (mobility)", "Ray of Light (channeled knockback)", "Flame Volley (burn AoE)", "Fire Arrow (ignite)", "Ember Shot (explode mark)"], signatureAbility: "Hellfire Barrage (channeled AoE)", passives: ["Burn Mastery", "Attack Speed", "Precision"], craftedBy: "Forester" },
  { id: "bow-ironvine", name: "Ironvine Bow", type: "Bow", category: "Ranged 2h", lore: "Vines of iron entangle", stats: parseWeaponStats("53 +10", "95 +24", "10 +5", "4 +0.7", "5 +1", "18 +6"), basicAbility: "Grudge Arrow", abilities: ["Volley", "Swift Shot", "Piercing Barrage", "Rooting Shot (single root)", "Iron Barrage (armor reduce)", "Vine Trap (AoE root)", "Long Shot (range bonus)"], signatureAbility: "Rain of Arrows (AoE)", passives: ["Slow Venom", "Precision", "Heavy Draw"], craftedBy: "Forester" },
  { id: "bow-duskreaver", name: "Duskreaver Bow", type: "Bow", category: "Ranged 2h", lore: "Reaves at dusk fall", stats: parseWeaponStats("58 +13", "70 +16", "40 +18", "9 +1.3", "2 +0.5", "12 +3"), basicAbility: "Grudge Arrow", abilities: ["Volley", "Swift Shot", "Piercing Barrage", "Phantom Arrows (pierce)", "Shadow Shot (stealth)", "Dusk Arrow (high crit)"], signatureAbility: "Night's Rain (AoE silence + dmg)", passives: ["Crit Chance", "Speed Draw", "Precision"], craftedBy: "Forester" },
];

export const ALL_WEAPONS = [...SWORDS, ...AXES, ...BOWS];

export function getWeaponById(id: string): Weapon | undefined {
  return ALL_WEAPONS.find(w => w.id === id);
}

export function getWeaponsByType(type: string): Weapon[] {
  return ALL_WEAPONS.filter(w => w.type === type);
}

export function getWeaponsByCategory(category: "1h" | "2h" | "Ranged 2h"): Weapon[] {
  return ALL_WEAPONS.filter(w => w.category === category);
}
