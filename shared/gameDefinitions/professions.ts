/** Six gather trees — do not add a seventh. Fishing matches this set. */
export type HarvestProfessionId =
  | 'mining'
  | 'herbalism'
  | 'woodcutting'
  | 'fishing'
  | 'skinning'
  | 'foraging';

export const HARVEST_PROFESSION_IDS: readonly HarvestProfessionId[] = [
  'mining',
  'herbalism',
  'woodcutting',
  'fishing',
  'skinning',
  'foraging',
] as const;

export interface GatheringProfession {
  id: HarvestProfessionId;
  name: string;
  description: string;
  resourceTypes: string[];
  primaryUse: string[];
  requiredTool: string;
}

export type HarvestUnlockKind = 'tool' | 'station' | 'hull';

export interface HarvestToolTier {
  tier: number;
  levelReq: number;
  id: string;
  name: string;
}

export interface HarvestNodeTier {
  tier: number;
  levelReq: number;
  example: string;
}

export interface HarvestUnlock {
  id: string;
  name: string;
  levelReq: number;
  kind: HarvestUnlockKind;
  /** Fleet / public mesh when this unlock is a hull or station. */
  modelPath?: string;
  notes?: string;
}

export interface HarvestTree {
  profession: GatheringProfession;
  tools: HarvestToolTier[];
  nodes: HarvestNodeTier[];
  unlocks: HarvestUnlock[];
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

export const GATHERING_PROFESSIONS: Record<HarvestProfessionId, GatheringProfession> = {
  mining: {
    id: 'mining',
    name: 'Mining',
    description: 'Extract ores, gems, and minerals from the earth',
    resourceTypes: ['Ores', 'Gems', 'Minerals'],
    primaryUse: ['Metalworking', 'Jewelry'],
    requiredTool: 'pickaxe',
  },
  herbalism: {
    id: 'herbalism',
    name: 'Herbalism',
    description: 'Gather plants, herbs, and flowers',
    resourceTypes: ['Plants', 'Herbs', 'Flowers'],
    primaryUse: ['Alchemy', 'Cooking'],
    requiredTool: 'sickle',
  },
  woodcutting: {
    id: 'woodcutting',
    name: 'Woodcutting',
    description: 'Harvest logs, bark, and sap from trees',
    resourceTypes: ['Logs', 'Bark', 'Sap'],
    primaryUse: ['Carpentry', 'Fletching'],
    requiredTool: 'axe',
  },
  fishing: {
    id: 'fishing',
    name: 'Fishing',
    description: 'Catch fish, shells, and pearls from water',
    resourceTypes: ['Fish', 'Shells', 'Pearls'],
    primaryUse: ['Cooking', 'Alchemy'],
    requiredTool: 'fishing_rod',
  },
  skinning: {
    id: 'skinning',
    name: 'Skinning',
    description: 'Collect hides, leather, and bones from creatures',
    resourceTypes: ['Hides', 'Leather', 'Bones'],
    primaryUse: ['Leatherworking'],
    requiredTool: 'skinning_knife',
  },
  foraging: {
    id: 'foraging',
    name: 'Foraging',
    description: 'Find berries, mushrooms, and roots in the wild',
    resourceTypes: ['Berries', 'Mushrooms', 'Roots'],
    primaryUse: ['Cooking', 'Alchemy'],
    requiredTool: 'none',
  },
};

/** Same 5-band ladder for every gather tree (1 / 11 / 26 / 51 / 76). */
export const HARVEST_TREES: Record<HarvestProfessionId, HarvestTree> = {
  mining: {
    profession: GATHERING_PROFESSIONS.mining,
    tools: [
      { tier: 1, levelReq: 1, id: 'pick_copper', name: 'Copper Pick' },
      { tier: 2, levelReq: 11, id: 'pick_iron', name: 'Iron Pick' },
      { tier: 3, levelReq: 26, id: 'pick_mithril', name: 'Mithril Pick' },
      { tier: 4, levelReq: 51, id: 'pick_thorium', name: 'Thorium Pick' },
      { tier: 5, levelReq: 76, id: 'pick_adamantite', name: 'Adamantite Pick' },
    ],
    nodes: [
      { tier: 1, levelReq: 1, example: 'Copper Ore' },
      { tier: 2, levelReq: 11, example: 'Iron Ore' },
      { tier: 3, levelReq: 26, example: 'Mithril Ore' },
      { tier: 4, levelReq: 51, example: 'Thorium Ore' },
      { tier: 5, levelReq: 76, example: 'Adamantite Ore' },
    ],
    unlocks: [
      { id: 'pick_copper', name: 'Copper Pick', levelReq: 1, kind: 'tool' },
      { id: 'mine_shaft', name: 'Mine Adit', levelReq: 26, kind: 'station' },
    ],
  },
  herbalism: {
    profession: GATHERING_PROFESSIONS.herbalism,
    tools: [
      { tier: 1, levelReq: 1, id: 'hands', name: 'Bare Hands' },
      { tier: 2, levelReq: 11, id: 'sickle_copper', name: 'Copper Sickle' },
      { tier: 3, levelReq: 26, id: 'sickle_iron', name: 'Iron Sickle' },
      { tier: 4, levelReq: 51, id: 'herb_satchel', name: 'Herb Satchel' },
      { tier: 5, levelReq: 76, id: 'alchemist_crook', name: 'Alchemist Crook' },
    ],
    nodes: [
      { tier: 1, levelReq: 1, example: 'Silverleaf' },
      { tier: 2, levelReq: 11, example: 'Mageroyal' },
      { tier: 3, levelReq: 26, example: 'Fadeleaf' },
      { tier: 4, levelReq: 51, example: 'Dreamfoil' },
      { tier: 5, levelReq: 76, example: 'Black Lotus' },
    ],
    unlocks: [
      { id: 'sickle_copper', name: 'Copper Sickle', levelReq: 11, kind: 'tool' },
      { id: 'herb_drying', name: 'Drying Rack', levelReq: 26, kind: 'station' },
    ],
  },
  woodcutting: {
    profession: GATHERING_PROFESSIONS.woodcutting,
    tools: [
      { tier: 1, levelReq: 1, id: 'hatchet', name: 'Hatchet' },
      { tier: 2, levelReq: 11, id: 'axe_iron', name: 'Iron Axe' },
      { tier: 3, levelReq: 26, id: 'axe_steel', name: 'Steel Axe' },
      { tier: 4, levelReq: 51, id: 'felling_axe', name: 'Felling Axe' },
      { tier: 5, levelReq: 76, id: 'master_saw', name: 'Master Saw' },
    ],
    nodes: [
      { tier: 1, levelReq: 1, example: 'Young Pine' },
      { tier: 2, levelReq: 11, example: 'Oak' },
      { tier: 3, levelReq: 26, example: 'Ironwood' },
      { tier: 4, levelReq: 51, example: 'Ancient Trunk' },
      { tier: 5, levelReq: 76, example: 'Heartwood' },
    ],
    unlocks: [
      { id: 'hatchet', name: 'Hatchet', levelReq: 1, kind: 'tool' },
      { id: 'lumber_bench', name: 'Lumber Bench', levelReq: 26, kind: 'station' },
    ],
  },
  fishing: {
    profession: GATHERING_PROFESSIONS.fishing,
    tools: [
      { tier: 1, levelReq: 1, id: 'fishing_rod', name: 'Fishing Pole' },
      { tier: 2, levelReq: 11, id: 'fishing_rod_line', name: 'Pole with Line' },
      { tier: 3, levelReq: 26, id: 'fishermans_boat', name: "Fisherman's Boat" },
      { tier: 4, levelReq: 51, id: 'fishing_net', name: 'Cast Net' },
      { tier: 5, levelReq: 76, id: 'deep_sea_line', name: 'Deep-Sea Line' },
    ],
    nodes: [
      { tier: 1, levelReq: 1, example: 'Shore Minnow' },
      { tier: 2, levelReq: 11, example: 'Reef Snapper' },
      { tier: 3, levelReq: 26, example: 'Coast Tuna' },
      { tier: 4, levelReq: 51, example: 'Rare Grouper' },
      { tier: 5, levelReq: 76, example: 'Abyssal Catch' },
    ],
    unlocks: [
      { id: 'fishing_rod', name: 'Fishing Pole', levelReq: 1, kind: 'tool' },
      { id: 'fishing_rod_line', name: 'Pole with Line', levelReq: 11, kind: 'tool' },
      {
        id: 'fishermans_boat',
        name: "Fisherman's Boat",
        levelReq: 26,
        kind: 'hull',
        modelPath: '/models/fleet/boats/fishermans_boat.glb',
        notes: 'Journeyman fishing hull — upgraded rowboat. Not a warship ladder id.',
      },
      { id: 'fishing_net', name: 'Cast Net', levelReq: 51, kind: 'tool' },
    ],
  },
  skinning: {
    profession: GATHERING_PROFESSIONS.skinning,
    tools: [
      { tier: 1, levelReq: 1, id: 'flint_knife', name: 'Flint Knife' },
      { tier: 2, levelReq: 11, id: 'iron_knife', name: 'Iron Skinning Knife' },
      { tier: 3, levelReq: 26, id: 'steel_knife', name: 'Steel Knife' },
      { tier: 4, levelReq: 51, id: 'specialist_knife', name: 'Specialist Knife' },
      { tier: 5, levelReq: 76, id: 'master_flenser', name: 'Master Flenser' },
    ],
    nodes: [
      { tier: 1, levelReq: 1, example: 'Hare Hide' },
      { tier: 2, levelReq: 11, example: 'Deer Hide' },
      { tier: 3, levelReq: 26, example: 'Boar Hide' },
      { tier: 4, levelReq: 51, example: 'Wolf Pelt' },
      { tier: 5, levelReq: 76, example: 'Rare Hide' },
    ],
    unlocks: [
      { id: 'flint_knife', name: 'Flint Knife', levelReq: 1, kind: 'tool' },
      { id: 'tanning_rack', name: 'Tanning Rack', levelReq: 26, kind: 'station' },
    ],
  },
  foraging: {
    profession: GATHERING_PROFESSIONS.foraging,
    tools: [
      { tier: 1, levelReq: 1, id: 'hands', name: 'Bare Hands' },
      { tier: 2, levelReq: 11, id: 'forage_basket', name: 'Forage Basket' },
      { tier: 3, levelReq: 26, id: 'root_spade', name: 'Root Spade' },
      { tier: 4, levelReq: 51, id: 'field_crate', name: 'Field Crate' },
      { tier: 5, levelReq: 76, id: 'master_pouch', name: 'Master Pouch' },
    ],
    nodes: [
      { tier: 1, levelReq: 1, example: 'Wild Berries' },
      { tier: 2, levelReq: 11, example: 'Field Mushrooms' },
      { tier: 3, levelReq: 26, example: 'River Roots' },
      { tier: 4, levelReq: 51, example: 'Rare Caps' },
      { tier: 5, levelReq: 76, example: 'Heartroot' },
    ],
    unlocks: [
      { id: 'forage_basket', name: 'Forage Basket', levelReq: 11, kind: 'tool' },
      { id: 'drying_rack', name: 'Forage Drying Rack', levelReq: 26, kind: 'station' },
    ],
  },
};

export const FISHERMANS_BOAT_UNLOCK = 'fishermans_boat';
export const FISHERMANS_BOAT_PATH = '/models/fleet/boats/fishermans_boat.glb';
export const FISHERMANS_BOAT_LEVEL = 26;

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

export const PROFESSION_RESOURCE_TIERS = HARVEST_PROFESSION_IDS.map((id) => ({
  profession: id,
  tiers: HARVEST_TREES[id].nodes,
}));

export function getHarvestTree(id: HarvestProfessionId): HarvestTree {
  return HARVEST_TREES[id];
}

export function harvestUnlocksAtLevel(
  id: HarvestProfessionId,
  level: number,
): HarvestUnlock[] {
  return HARVEST_TREES[id].unlocks.filter((u) => level >= u.levelReq);
}

export function isHarvestUnlockReady(
  id: HarvestProfessionId,
  unlockId: string,
  level: number,
): boolean {
  const u = HARVEST_TREES[id].unlocks.find((x) => x.id === unlockId);
  return !!u && level >= u.levelReq;
}

export function toolTierForLevel(id: HarvestProfessionId, level: number): HarvestToolTier {
  const tools = HARVEST_TREES[id].tools;
  let best = tools[0];
  for (const t of tools) if (level >= t.levelReq) best = t;
  return best;
}

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
