// Tiered Crafting System for GRUDGE tactical game
// Equipment tiers T1-T8 with material requirements

export const TIER_LABELS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

export interface CraftingMaterial {
  id: string;
  name: string;
  tier: number;
  type: MaterialType;
  rarity: MaterialRarity;
  description: string;
  gatheredFrom: string;
}

export type MaterialType = "Ore" | "Wood" | "Cloth" | "Leather" | "Gem" | "Essence" | "Reagent";
export type MaterialRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export interface CraftingRecipe {
  id: string;
  resultId: string;
  resultType: "weapon" | "equipment";
  tier: number;
  profession: Profession;
  materials: { materialId: string; quantity: number }[];
  craftingTime: number; // in seconds
  skillRequired: number;
}

export type Profession = "Blacksmith" | "Bowyer" | "Enchanter" | "Alchemist" | "Leatherworker" | "Tailor";

// Profession descriptions
export const PROFESSIONS: Record<Profession, { name: string; description: string; crafts: string[] }> = {
  Blacksmith: {
    name: "Blacksmith",
    description: "Master of metal, forges weapons and heavy armor",
    crafts: ["Swords", "Axes", "Hammers", "Metal Armor", "Shields"],
  },
  Bowyer: {
    name: "Bowyer",
    description: "Crafts ranged weapons from wood and sinew",
    crafts: ["Bows", "Crossbows", "Arrows", "Quivers"],
  },
  Enchanter: {
    name: "Enchanter",
    description: "Weaves magic into staves, tomes, and accessories",
    crafts: ["Staves", "Tomes", "Wands", "Magical Accessories"],
  },
  Alchemist: {
    name: "Alchemist",
    description: "Brews potions, elixirs, and explosive compounds",
    crafts: ["Potions", "Elixirs", "Bombs", "Poisons"],
  },
  Leatherworker: {
    name: "Leatherworker",
    description: "Fashions light armor and accessories from hides",
    crafts: ["Leather Armor", "Bags", "Belts", "Gloves"],
  },
  Tailor: {
    name: "Tailor",
    description: "Creates cloth armor and magical garments",
    crafts: ["Robes", "Cloaks", "Cloth Armor", "Bags"],
  },
};

// Tier multipliers for stat scaling
export const TIER_MULTIPLIERS = {
  1: 1.0,
  2: 1.15,
  3: 1.35,
  4: 1.6,
  5: 1.9,
  6: 2.25,
  7: 2.65,
  8: 3.2,
};

// Base crafting materials by tier
export const CRAFTING_MATERIALS: CraftingMaterial[] = [
  // ORE (T1-T8)
  { id: "copper_ore", name: "Copper Ore", tier: 1, type: "Ore", rarity: "Common", description: "Basic metal ore", gatheredFrom: "Copper Veins" },
  { id: "iron_ore", name: "Iron Ore", tier: 2, type: "Ore", rarity: "Common", description: "Strong forging metal", gatheredFrom: "Iron Deposits" },
  { id: "steel_ingot", name: "Steel Ingot", tier: 3, type: "Ore", rarity: "Uncommon", description: "Refined iron alloy", gatheredFrom: "Smelting Iron" },
  { id: "titanium_ore", name: "Titanium Ore", tier: 4, type: "Ore", rarity: "Uncommon", description: "Lightweight strong metal", gatheredFrom: "Deep Mines" },
  { id: "mithril_ore", name: "Mithril Ore", tier: 5, type: "Ore", rarity: "Rare", description: "Magical silver metal", gatheredFrom: "Ancient Mines" },
  { id: "adamantine_ore", name: "Adamantine Ore", tier: 6, type: "Ore", rarity: "Rare", description: "Nearly indestructible metal", gatheredFrom: "Volcanic Vents" },
  { id: "orichalcum_ore", name: "Orichalcum Ore", tier: 7, type: "Ore", rarity: "Epic", description: "Legendary golden metal", gatheredFrom: "Sunken Temples" },
  { id: "starmetal_ore", name: "Starmetal Ore", tier: 8, type: "Ore", rarity: "Legendary", description: "Fallen from the heavens", gatheredFrom: "Meteor Sites" },

  // WOOD (T1-T8)
  { id: "pine_wood", name: "Pine Wood", tier: 1, type: "Wood", rarity: "Common", description: "Soft common wood", gatheredFrom: "Pine Trees" },
  { id: "oak_wood", name: "Oak Wood", tier: 2, type: "Wood", rarity: "Common", description: "Sturdy hardwood", gatheredFrom: "Oak Groves" },
  { id: "yew_wood", name: "Yew Wood", tier: 3, type: "Wood", rarity: "Uncommon", description: "Flexible bow wood", gatheredFrom: "Yew Trees" },
  { id: "ironwood", name: "Ironwood", tier: 4, type: "Wood", rarity: "Uncommon", description: "Dense as metal", gatheredFrom: "Ancient Forests" },
  { id: "spiritwood", name: "Spiritwood", tier: 5, type: "Wood", rarity: "Rare", description: "Infused with nature magic", gatheredFrom: "Fey Glades" },
  { id: "dragonwood", name: "Dragonwood", tier: 6, type: "Wood", rarity: "Rare", description: "Fire-resistant timber", gatheredFrom: "Dragon Lairs" },
  { id: "worldtree_branch", name: "Worldtree Branch", tier: 7, type: "Wood", rarity: "Epic", description: "From the great tree", gatheredFrom: "Worldtree" },
  { id: "voidwood", name: "Voidwood", tier: 8, type: "Wood", rarity: "Legendary", description: "From between realms", gatheredFrom: "Void Rifts" },

  // CLOTH (T1-T8)
  { id: "linen", name: "Linen Cloth", tier: 1, type: "Cloth", rarity: "Common", description: "Basic cloth", gatheredFrom: "Flax Plants" },
  { id: "cotton", name: "Cotton Cloth", tier: 2, type: "Cloth", rarity: "Common", description: "Soft fabric", gatheredFrom: "Cotton Plants" },
  { id: "silk", name: "Silk Cloth", tier: 3, type: "Cloth", rarity: "Uncommon", description: "Fine spider silk", gatheredFrom: "Spider Nests" },
  { id: "runeweave", name: "Runeweave", tier: 4, type: "Cloth", rarity: "Uncommon", description: "Magically woven", gatheredFrom: "Enchanting" },
  { id: "shadowcloth", name: "Shadowcloth", tier: 5, type: "Cloth", rarity: "Rare", description: "Woven darkness", gatheredFrom: "Shadow Realm" },
  { id: "mooncloth", name: "Mooncloth", tier: 6, type: "Cloth", rarity: "Rare", description: "Lunar-infused fabric", gatheredFrom: "Moonlight Ritual" },
  { id: "celestialweave", name: "Celestialweave", tier: 7, type: "Cloth", rarity: "Epic", description: "Star-touched threads", gatheredFrom: "Celestial Nodes" },
  { id: "primordialcloth", name: "Primordial Cloth", tier: 8, type: "Cloth", rarity: "Legendary", description: "From creation itself", gatheredFrom: "Origin Sites" },

  // LEATHER (T1-T8)
  { id: "rough_leather", name: "Rough Leather", tier: 1, type: "Leather", rarity: "Common", description: "Basic animal hide", gatheredFrom: "Common Beasts" },
  { id: "light_leather", name: "Light Leather", tier: 2, type: "Leather", rarity: "Common", description: "Processed hide", gatheredFrom: "Medium Beasts" },
  { id: "medium_leather", name: "Medium Leather", tier: 3, type: "Leather", rarity: "Uncommon", description: "Quality leather", gatheredFrom: "Large Beasts" },
  { id: "heavy_leather", name: "Heavy Leather", tier: 4, type: "Leather", rarity: "Uncommon", description: "Thick durable hide", gatheredFrom: "Dangerous Beasts" },
  { id: "rugged_leather", name: "Rugged Leather", tier: 5, type: "Leather", rarity: "Rare", description: "Monster hide", gatheredFrom: "Monster Hunts" },
  { id: "dragonscale", name: "Dragonscale", tier: 6, type: "Leather", rarity: "Rare", description: "Dragon hide scales", gatheredFrom: "Dragons" },
  { id: "demonic_hide", name: "Demonic Hide", tier: 7, type: "Leather", rarity: "Epic", description: "Demon leather", gatheredFrom: "Demon Hunts" },
  { id: "elder_hide", name: "Elder Hide", tier: 8, type: "Leather", rarity: "Legendary", description: "Ancient beast leather", gatheredFrom: "Elder Beasts" },

  // GEMS (T1-T8)
  { id: "quartz", name: "Quartz Crystal", tier: 1, type: "Gem", rarity: "Common", description: "Clear focusing gem", gatheredFrom: "Crystal Caves" },
  { id: "amethyst", name: "Amethyst", tier: 2, type: "Gem", rarity: "Common", description: "Purple magic stone", gatheredFrom: "Gem Deposits" },
  { id: "sapphire", name: "Sapphire", tier: 3, type: "Gem", rarity: "Uncommon", description: "Blue wisdom gem", gatheredFrom: "Deep Caves" },
  { id: "emerald", name: "Emerald", tier: 4, type: "Gem", rarity: "Uncommon", description: "Green nature gem", gatheredFrom: "Jungle Caves" },
  { id: "ruby", name: "Ruby", tier: 5, type: "Gem", rarity: "Rare", description: "Red power gem", gatheredFrom: "Volcanic Caves" },
  { id: "diamond", name: "Diamond", tier: 6, type: "Gem", rarity: "Rare", description: "Pure brilliant gem", gatheredFrom: "Deep Earth" },
  { id: "soulstone", name: "Soulstone", tier: 7, type: "Gem", rarity: "Epic", description: "Contains soul energy", gatheredFrom: "Soul Wells" },
  { id: "void_crystal", name: "Void Crystal", tier: 8, type: "Gem", rarity: "Legendary", description: "From the void", gatheredFrom: "Void Portals" },

  // ESSENCES (crafting components)
  { id: "fire_essence", name: "Fire Essence", tier: 3, type: "Essence", rarity: "Uncommon", description: "Captured flame", gatheredFrom: "Fire Elementals" },
  { id: "frost_essence", name: "Frost Essence", tier: 3, type: "Essence", rarity: "Uncommon", description: "Frozen mana", gatheredFrom: "Ice Elementals" },
  { id: "nature_essence", name: "Nature Essence", tier: 3, type: "Essence", rarity: "Uncommon", description: "Life force", gatheredFrom: "Nature Spirits" },
  { id: "arcane_essence", name: "Arcane Essence", tier: 4, type: "Essence", rarity: "Rare", description: "Pure magic", gatheredFrom: "Arcane Nodes" },
  { id: "holy_essence", name: "Holy Essence", tier: 4, type: "Essence", rarity: "Rare", description: "Divine power", gatheredFrom: "Sacred Sites" },
  { id: "shadow_essence", name: "Shadow Essence", tier: 5, type: "Essence", rarity: "Rare", description: "Darkness manifest", gatheredFrom: "Shadow Realm" },
];

// Get materials by tier
export function getMaterialsByTier(tier: number): CraftingMaterial[] {
  return CRAFTING_MATERIALS.filter(m => m.tier === tier);
}

// Get materials by type
export function getMaterialsByType(type: MaterialType): CraftingMaterial[] {
  return CRAFTING_MATERIALS.filter(m => m.type === type);
}

// Calculate crafting cost at tier
export function getCraftingCost(baseCost: number, tier: number): number {
  const multiplier = TIER_MULTIPLIERS[tier as keyof typeof TIER_MULTIPLIERS] || 1;
  return Math.round(baseCost * multiplier);
}
