export interface GatheringProfession {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  primaryUse: string[];
}

export interface CraftingProfession {
  id: string;
  name: string;
  description: string;
  primaryOutput: string[];
  inputMaterials: string[];
}

export interface ProfessionTier {
  level: number;
  name: string;
  xpRequired: number;
}

export const GATHERING_PROFESSIONS: Record<string, GatheringProfession> = {
  mining: {
    id: 'mining',
    name: 'Mining',
    description: 'Extract ores, gems, and minerals from the earth',
    resourceTypes: ['Ores', 'Gems', 'Minerals'],
    primaryUse: ['Metalworking', 'Jewelry'],
  },
  herbalism: {
    id: 'herbalism',
    name: 'Herbalism',
    description: 'Gather plants, herbs, and flowers',
    resourceTypes: ['Plants', 'Herbs', 'Flowers'],
    primaryUse: ['Alchemy', 'Cooking'],
  },
  woodcutting: {
    id: 'woodcutting',
    name: 'Woodcutting',
    description: 'Harvest logs, bark, and sap from trees',
    resourceTypes: ['Logs', 'Bark', 'Sap'],
    primaryUse: ['Carpentry', 'Fletching'],
  },
  fishing: {
    id: 'fishing',
    name: 'Fishing',
    description: 'Catch fish, shells, and pearls from water',
    resourceTypes: ['Fish', 'Shells', 'Pearls'],
    primaryUse: ['Cooking', 'Alchemy'],
  },
  skinning: {
    id: 'skinning',
    name: 'Skinning',
    description: 'Collect hides, leather, and bones from creatures',
    resourceTypes: ['Hides', 'Leather', 'Bones'],
    primaryUse: ['Leatherworking'],
  },
  foraging: {
    id: 'foraging',
    name: 'Foraging',
    description: 'Find berries, mushrooms, and roots in the wild',
    resourceTypes: ['Berries', 'Mushrooms', 'Roots'],
    primaryUse: ['Cooking', 'Alchemy'],
  },
};

export const CRAFTING_PROFESSIONS: Record<string, CraftingProfession> = {
  blacksmithing: {
    id: 'blacksmithing',
    name: 'Blacksmithing',
    description: 'Forge weapons, armor, and tools from metals',
    primaryOutput: ['Weapons', 'Armor', 'Tools'],
    inputMaterials: ['Ores', 'Metals'],
  },
  leatherworking: {
    id: 'leatherworking',
    name: 'Leatherworking',
    description: 'Create light and medium armor, bags from hides',
    primaryOutput: ['Light Armor', 'Medium Armor', 'Bags'],
    inputMaterials: ['Hides', 'Leather'],
  },
  tailoring: {
    id: 'tailoring',
    name: 'Tailoring',
    description: 'Craft cloth armor, bags, and capes',
    primaryOutput: ['Cloth Armor', 'Bags', 'Capes'],
    inputMaterials: ['Fibers', 'Cloth'],
  },
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    description: 'Brew potions, elixirs, and oils',
    primaryOutput: ['Potions', 'Elixirs', 'Oils'],
    inputMaterials: ['Herbs', 'Minerals'],
  },
  cooking: {
    id: 'cooking',
    name: 'Cooking',
    description: 'Prepare food buffs and consumables',
    primaryOutput: ['Food Buffs', 'Consumables'],
    inputMaterials: ['Fish', 'Herbs', 'Produce'],
  },
  enchanting: {
    id: 'enchanting',
    name: 'Enchanting',
    description: 'Apply magical enchantments to items',
    primaryOutput: ['Enchantments'],
    inputMaterials: ['Magical Essences'],
  },
  jewelcrafting: {
    id: 'jewelcrafting',
    name: 'Jewelcrafting',
    description: 'Create rings, necklaces, and gem cuts',
    primaryOutput: ['Rings', 'Necklaces', 'Gems'],
    inputMaterials: ['Gems', 'Metals'],
  },
  carpentry: {
    id: 'carpentry',
    name: 'Carpentry',
    description: 'Build furniture, tools, and bows',
    primaryOutput: ['Furniture', 'Tools', 'Bows'],
    inputMaterials: ['Wood', 'Metals'],
  },
};

export const PROFESSION_TIERS: ProfessionTier[] = [
  { level: 1, name: 'Novice', xpRequired: 0 },
  { level: 10, name: 'Novice', xpRequired: 1000 },
  { level: 25, name: 'Apprentice', xpRequired: 5000 },
  { level: 50, name: 'Journeyman', xpRequired: 25000 },
  { level: 75, name: 'Expert', xpRequired: 75000 },
  { level: 100, name: 'Master', xpRequired: 200000 },
];

export const MAX_PROFESSION_LEVEL = 100;

export const PROFESSION_RESOURCE_TIERS = [
  { tier: 1, levelReq: 1, examples: { mining: 'Copper Ore', herbalism: 'Silverleaf' } },
  { tier: 2, levelReq: 11, examples: { mining: 'Iron Ore', herbalism: 'Mageroyal' } },
  { tier: 3, levelReq: 26, examples: { mining: 'Mithril Ore', herbalism: 'Fadeleaf' } },
  { tier: 4, levelReq: 51, examples: { mining: 'Thorium Ore', herbalism: 'Dreamfoil' } },
  { tier: 5, levelReq: 76, examples: { mining: 'Adamantite Ore', herbalism: 'Black Lotus' } },
];

export const QUALITY_TIERS = [
  { name: 'Poor', statBonus: -0.10, chance: 'Below skill level' },
  { name: 'Normal', statBonus: 0, chance: 'At skill level' },
  { name: 'Good', statBonus: 0.10, chance: 'Above skill level' },
  { name: 'Superior', statBonus: 0.25, chance: 'Master crafter' },
  { name: 'Masterwork', statBonus: 0.50, chance: 'Critical success' },
];

export function getProfessionTier(level: number): ProfessionTier {
  for (let i = PROFESSION_TIERS.length - 1; i >= 0; i--) {
    if (level >= PROFESSION_TIERS[i].level) {
      return PROFESSION_TIERS[i];
    }
  }
  return PROFESSION_TIERS[0];
}
