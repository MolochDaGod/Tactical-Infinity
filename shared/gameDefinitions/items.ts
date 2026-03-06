export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type ItemSlot = 'head' | 'chest' | 'legs' | 'feet' | 'hands' | 'shoulders' | 'back' | 'mainhand' | 'offhand' | 'ring1' | 'ring2' | 'neck' | 'trinket';
export type ArmorType = 'Cloth' | 'Leather' | 'Mail' | 'Plate';

export interface ItemStat {
  stat: string;
  value: number;
}

export interface Item {
  id: string;
  name: string;
  tier: number;
  rarity: ItemRarity;
  slot: ItemSlot;
  armorType?: ArmorType;
  levelRequirement: number;
  stats: ItemStat[];
  description: string;
  craftedBy?: string;
  setId?: string;
}

export interface ItemSet {
  id: string;
  name: string;
  pieces: string[];
  bonuses: { piecesRequired: number; bonus: string }[];
}

export interface Material {
  id: string;
  name: string;
  tier: number;
  type: string;
  source: string;
  description: string;
}

export interface Recipe {
  id: string;
  name: string;
  profession: string;
  levelRequired: number;
  materials: { materialId: string; quantity: number }[];
  output: { itemId: string; quantity: number };
  craftTime: number;
}

export const ITEM_RARITIES: Record<ItemRarity, { color: string; statMultiplier: number }> = {
  Common: { color: '#9ca3af', statMultiplier: 1.0 },
  Uncommon: { color: '#22c55e', statMultiplier: 1.15 },
  Rare: { color: '#3b82f6', statMultiplier: 1.35 },
  Epic: { color: '#a855f7', statMultiplier: 1.60 },
  Legendary: { color: '#f97316', statMultiplier: 2.0 },
};

export const ITEM_TIERS = [
  { tier: 1, levelRange: [1, 10], name: 'Novice' },
  { tier: 2, levelRange: [11, 20], name: 'Apprentice' },
  { tier: 3, levelRange: [21, 30], name: 'Journeyman' },
  { tier: 4, levelRange: [31, 40], name: 'Expert' },
  { tier: 5, levelRange: [41, 50], name: 'Master' },
];

export const EQUIPMENT_SLOTS: Record<ItemSlot, { name: string; icon: string }> = {
  head: { name: 'Head', icon: 'crown' },
  chest: { name: 'Chest', icon: 'shirt' },
  legs: { name: 'Legs', icon: 'trousers' },
  feet: { name: 'Feet', icon: 'footprints' },
  hands: { name: 'Hands', icon: 'hand' },
  shoulders: { name: 'Shoulders', icon: 'chevrons-up' },
  back: { name: 'Back', icon: 'wind' },
  mainhand: { name: 'Main Hand', icon: 'sword' },
  offhand: { name: 'Off Hand', icon: 'shield' },
  ring1: { name: 'Ring 1', icon: 'circle' },
  ring2: { name: 'Ring 2', icon: 'circle' },
  neck: { name: 'Neck', icon: 'gem' },
  trinket: { name: 'Trinket', icon: 'sparkles' },
};

export const MATERIALS: Record<string, Material> = {
  copperOre: { id: 'copperOre', name: 'Copper Ore', tier: 1, type: 'ore', source: 'Mining', description: 'Common ore used in basic crafting' },
  ironOre: { id: 'ironOre', name: 'Iron Ore', tier: 2, type: 'ore', source: 'Mining', description: 'Standard ore for weapons and armor' },
  goldOre: { id: 'goldOre', name: 'Gold Ore', tier: 3, type: 'ore', source: 'Mining', description: 'Precious metal for jewelry' },
  mithrilOre: { id: 'mithrilOre', name: 'Mithril Ore', tier: 4, type: 'ore', source: 'Mining', description: 'Rare magical ore' },
  adamantiteOre: { id: 'adamantiteOre', name: 'Adamantite Ore', tier: 5, type: 'ore', source: 'Mining', description: 'Legendary indestructible ore' },
  oakLog: { id: 'oakLog', name: 'Oak Log', tier: 1, type: 'wood', source: 'Woodcutting', description: 'Common wood for basic items' },
  mapleLog: { id: 'mapleLog', name: 'Maple Log', tier: 2, type: 'wood', source: 'Woodcutting', description: 'Quality wood for bows' },
  ashLog: { id: 'ashLog', name: 'Ash Log', tier: 3, type: 'wood', source: 'Woodcutting', description: 'Strong wood for handles' },
  ironwoodLog: { id: 'ironwoodLog', name: 'Ironwood Log', tier: 4, type: 'wood', source: 'Woodcutting', description: 'Metal-hard wood' },
  worldtreeLog: { id: 'worldtreeLog', name: 'Worldtree Log', tier: 5, type: 'wood', source: 'Woodcutting', description: 'Magical wood from the world tree' },
  silverleaf: { id: 'silverleaf', name: 'Silverleaf', tier: 1, type: 'herb', source: 'Herbalism', description: 'Common healing herb' },
  mageroyal: { id: 'mageroyal', name: 'Mageroyal', tier: 2, type: 'herb', source: 'Herbalism', description: 'Magic-infused flower' },
  fadeleaf: { id: 'fadeleaf', name: 'Fadeleaf', tier: 3, type: 'herb', source: 'Herbalism', description: 'Stealth-enhancing herb' },
  dreamfoil: { id: 'dreamfoil', name: 'Dreamfoil', tier: 4, type: 'herb', source: 'Herbalism', description: 'Potent mana herb' },
  blacklotus: { id: 'blacklotus', name: 'Black Lotus', tier: 5, type: 'herb', source: 'Herbalism', description: 'Legendary flower' },
  leather: { id: 'leather', name: 'Leather', tier: 1, type: 'hide', source: 'Skinning', description: 'Basic leather' },
  thickHide: { id: 'thickHide', name: 'Thick Hide', tier: 2, type: 'hide', source: 'Skinning', description: 'Durable hide' },
  scaleHide: { id: 'scaleHide', name: 'Scale Hide', tier: 3, type: 'hide', source: 'Skinning', description: 'Scaled creature hide' },
  dragonHide: { id: 'dragonHide', name: 'Dragon Hide', tier: 4, type: 'hide', source: 'Skinning', description: 'Dragon skin' },
  voidHide: { id: 'voidHide', name: 'Void Hide', tier: 5, type: 'hide', source: 'Skinning', description: 'Void creature hide' },
};

export const SAMPLE_ITEMS: Record<string, Item> = {
  copperSword: {
    id: 'copperSword',
    name: 'Copper Sword',
    tier: 1,
    rarity: 'Common',
    slot: 'mainhand',
    levelRequirement: 1,
    stats: [{ stat: 'damage', value: 10 }, { stat: 'critChance', value: 0.02 }],
    description: 'A simple copper blade for beginners',
    craftedBy: 'blacksmithing',
  },
  ironHelm: {
    id: 'ironHelm',
    name: 'Iron Helm',
    tier: 2,
    rarity: 'Common',
    slot: 'head',
    armorType: 'Mail',
    levelRequirement: 10,
    stats: [{ stat: 'defense', value: 25 }, { stat: 'health', value: 50 }],
    description: 'Sturdy iron protection for your head',
    craftedBy: 'blacksmithing',
  },
  dragonscalePlate: {
    id: 'dragonscalePlate',
    name: 'Dragonscale Chestplate',
    tier: 4,
    rarity: 'Epic',
    slot: 'chest',
    armorType: 'Plate',
    levelRequirement: 35,
    stats: [
      { stat: 'defense', value: 150 },
      { stat: 'health', value: 200 },
      { stat: 'resistance', value: 0.1 },
    ],
    description: 'Armor forged from dragon scales, radiating heat resistance',
    craftedBy: 'blacksmithing',
    setId: 'dragonslayer',
  },
};

export const SAMPLE_RECIPES: Record<string, Recipe> = {
  copperSword: {
    id: 'recipe_copperSword',
    name: 'Copper Sword',
    profession: 'blacksmithing',
    levelRequired: 1,
    materials: [{ materialId: 'copperOre', quantity: 5 }, { materialId: 'oakLog', quantity: 2 }],
    output: { itemId: 'copperSword', quantity: 1 },
    craftTime: 30,
  },
  ironHelm: {
    id: 'recipe_ironHelm',
    name: 'Iron Helm',
    profession: 'blacksmithing',
    levelRequired: 15,
    materials: [{ materialId: 'ironOre', quantity: 8 }, { materialId: 'leather', quantity: 2 }],
    output: { itemId: 'ironHelm', quantity: 1 },
    craftTime: 60,
  },
  healthPotion: {
    id: 'recipe_healthPotion',
    name: 'Health Potion',
    profession: 'alchemy',
    levelRequired: 1,
    materials: [{ materialId: 'silverleaf', quantity: 3 }],
    output: { itemId: 'healthPotion', quantity: 2 },
    craftTime: 15,
  },
};

export function getMaterialsByTier(tier: number): Material[] {
  return Object.values(MATERIALS).filter(m => m.tier === tier);
}

export function getMaterialsByType(type: string): Material[] {
  return Object.values(MATERIALS).filter(m => m.type === type);
}

export function getItemTier(level: number): number {
  for (const tier of ITEM_TIERS) {
    if (level >= tier.levelRange[0] && level <= tier.levelRange[1]) {
      return tier.tier;
    }
  }
  return 1;
}
