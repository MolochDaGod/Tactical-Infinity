export type AssetCategory = 'character' | 'animation' | 'npc' | 'creature' | 'prop' | 'effect';
export type AssetFormat = 'fbx' | 'glb' | 'gltf';

export interface AssetTexture {
  name: string;
  path: string;
  type: 'diffuse' | 'normal' | 'specular' | 'ao' | 'emissive';
}

export interface AssetAnimation {
  name: string;
  path: string;
  duration?: number;
  loop?: boolean;
}

export interface Asset3D {
  id: string;
  name: string;
  category: AssetCategory;
  sourcePath: string;
  glbPath?: string;
  textures: AssetTexture[];
  animations: AssetAnimation[];
  hasSkeleton: boolean;
  skeletonType?: 'humanoid' | 'quadruped' | 'custom';
  scale: number;
  tags: string[];
  license?: string;
  converted: boolean;
}

export const ASSET_REGISTRY: Asset3D[] = [
  {
    id: 'grudge6_human_wk',
    name: 'Western Kingdoms Warlord (grudge6)',
    category: 'character',
    sourcePath: 'https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx',
    textures: [
      { name: 'body', path: '/textures/grudge6/western-kingdoms/WK_Standard_Units.webp', type: 'diffuse' },
    ],
    animations: [],
    hasSkeleton: true,
    skeletonType: 'humanoid',
    scale: 0.012,
    tags: ['hero', 'human', 'warrior', 'crusade', 'player', 'warlords', 'grudge6'],
    license: 'Grudge Studio Warlords',
    converted: true
  },
  {
    id: 'tentacle',
    name: 'Kraken Tentacle',
    category: 'creature',
    sourcePath: '/models/sea_creatures/tentacle.glb',
    glbPath: '/models/sea_creatures/tentacle.glb',
    textures: [],
    animations: [],
    hasSkeleton: false,
    scale: 1,
    tags: ['sea_creature', 'kraken', 'tentacle', 'enemy', 'cinematic'],
    converted: true
  },
  {
    id: 'octopus',
    name: 'Octopus',
    category: 'creature',
    sourcePath: '/models/sea_creatures/octopus.glb',
    glbPath: '/models/sea_creatures/octopus.glb',
    textures: [],
    animations: [],
    hasSkeleton: false,
    scale: 1,
    tags: ['sea_creature', 'octopus', 'enemy'],
    converted: true
  },
  {
    id: 'shark',
    name: 'Shark (Quaternius ocean)',
    category: 'creature',
    // Warlords SSOT — not legacy local /models/sea_creatures (avoids path conflict)
    sourcePath: 'https://assets.grudge-studio.com/models/fauna/fish/Shark.fbx',
    textures: [],
    animations: [],
    hasSkeleton: true,
    skeletonType: 'custom',
    scale: 1, // metre-normalize at load (bodyLengthM ~3.2) — do not use raw FBX scale
    tags: ['sea_creature', 'shark', 'fish', 'harpoon', 'warlords', 'quaternius'],
    converted: true
  },
  {
    id: 'reef_fish_a',
    name: 'Reef Fish A',
    category: 'creature',
    sourcePath: 'https://assets.grudge-studio.com/models/fauna/fish/Fish1.fbx',
    textures: [],
    animations: [],
    hasSkeleton: true,
    skeletonType: 'custom',
    scale: 1,
    tags: ['fish', 'catchable', 'warlords', 'quaternius'],
    converted: true
  },
  {
    id: 'farm_llama',
    name: 'Llama',
    category: 'creature',
    sourcePath: 'https://assets.grudge-studio.com/models/fauna/farm/Llama.fbx',
    textures: [],
    animations: [],
    hasSkeleton: true,
    skeletonType: 'quadruped',
    scale: 1,
    tags: ['farm', 'livestock', 'warlords'],
    converted: true
  },
  {
    id: 'goblin_npc',
    name: 'Goblin NPC',
    category: 'npc',
    sourcePath: '/models/characters/goblin_npc.glb',
    glbPath: '/models/characters/goblin_npc.glb',
    textures: [],
    animations: [
      { name: 'All Animations', path: '/models/characters/goblin_animations.glb', loop: true }
    ],
    hasSkeleton: true,
    skeletonType: 'humanoid',
    scale: 1,
    tags: ['goblin', 'npc', 'enemy', 'monster'],
    converted: true
  },
  {
    id: 'elf_knight',
    name: 'Elf Knight',
    category: 'character',
    sourcePath: '/models/characters/elf_knight.glb',
    glbPath: '/models/characters/elf_knight.glb',
    textures: [],
    animations: [
      { name: 'All Animations', path: '/models/characters/elf_knight_animations.glb', loop: true }
    ],
    hasSkeleton: true,
    skeletonType: 'humanoid',
    scale: 1,
    tags: ['elf', 'knight', 'hero', 'player'],
    converted: true
  },
  {
    id: 'grudge6_orc',
    name: 'Orc Warlord (grudge6)',
    category: 'character',
    sourcePath: 'https://assets.grudge-studio.com/models/grudge6/races/ORC_Characters.fbx',
    textures: [
      { name: 'body', path: '/textures/grudge6/orcs/ORC_StandardUnits.webp', type: 'diffuse' },
    ],
    animations: [],
    hasSkeleton: true,
    skeletonType: 'humanoid',
    scale: 0.012,
    tags: ['character', 'orc', 'player', 'warlords', 'grudge6'],
    converted: true
  },
  {
    id: 'undead_necro',
    name: 'Undead Necromancer',
    category: 'npc',
    sourcePath: '/models/characters/undead_necro.glb',
    glbPath: '/models/characters/undead_necro.glb',
    textures: [],
    animations: [
      { name: 'All Animations', path: '/models/characters/undead_necro_animations.glb', loop: true }
    ],
    hasSkeleton: true,
    skeletonType: 'humanoid',
    scale: 1,
    tags: ['undead', 'necromancer', 'enemy', 'npc'],
    converted: true
  }
];

// The legacy `CharacterExport/` standalone animation library and per-race icon
// PNGs were unconverted source-only orphans that lived under `attached_assets/`.
// They were removed during the asset relocation and have no surviving on-disk or
// CDN copy, so these registries are intentionally empty. Re-populate them only
// if/when the source clips are re-imported and converted into `public/`.
export const ANIMATION_REGISTRY: AssetAnimation[] = [];

export const RACE_ICONS: Record<string, string> = {};

export function getAssetsByCategory(category: AssetCategory): Asset3D[] {
  return ASSET_REGISTRY.filter(a => a.category === category);
}

export function getAssetsByTag(tag: string): Asset3D[] {
  return ASSET_REGISTRY.filter(a => a.tags.includes(tag));
}

export function getConvertedAssets(): Asset3D[] {
  return ASSET_REGISTRY.filter(a => a.converted);
}

export function getAnimationsByType(type: 'combat' | 'movement' | 'emote' | 'all'): AssetAnimation[] {
  if (type === 'all') return ANIMATION_REGISTRY;
  
  const combatKeywords = ['sword', 'slash', 'attack', 'combo', 'kick', 'cast', 'spell', 'magic', 'weapon'];
  const movementKeywords = ['idle', 'walk', 'run', 'jump', 'climb', 'swim', 'crouch', 'stand'];
  const emoteKeywords = ['dance', 'hip hop', 'silly', 'taunt', 'sitting', 'patting', 'reacting'];
  
  return ANIMATION_REGISTRY.filter(anim => {
    const name = anim.name.toLowerCase();
    if (type === 'combat') return combatKeywords.some(k => name.includes(k));
    if (type === 'movement') return movementKeywords.some(k => name.includes(k));
    if (type === 'emote') return emoteKeywords.some(k => name.includes(k));
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP ASSET CATALOGS  (added from 6 new asset packs)
// ─────────────────────────────────────────────────────────────────────────────

const PROPS_BASE = '/models/props';

/** Hand-bone harvesting & farm props  (craftpix harvesting_tools_plus) */
export const TOOLS = {
  axe:          `${PROPS_BASE}/tools/Axe.fbx`,
  scythe:       `${PROPS_BASE}/tools/Scythe.fbx`,
  shovel:       `${PROPS_BASE}/tools/Shovel.fbx`,
  rake:         `${PROPS_BASE}/tools/Rake.fbx`,
  fork:         `${PROPS_BASE}/tools/Fork.fbx`,
  bucket:       `${PROPS_BASE}/tools/Bucket.fbx`,
  barrel:       `${PROPS_BASE}/tools/Barrel.fbx`,
  barrelBroken: `${PROPS_BASE}/tools/Barrel_broken.fbx`,
  stump:        `${PROPS_BASE}/tools/Stump.fbx`,
  firewood:     `${PROPS_BASE}/tools/Firewood.fbx`,
  well:         `${PROPS_BASE}/tools/Well.fbx`,
  texture:      `${PROPS_BASE}/tools/T_Medieval_Props.png`,
} as const;

/** Which hand tool equips when harvesting each node type */
export const HARVEST_TOOL_MAP: Record<string, string> = {
  tree: TOOLS.axe,
  rock: TOOLS.shovel,
  hemp: TOOLS.scythe,
};

/** Treasure chests  (craftpix-net-116189, 20 variants – trunk 1-5 copied) */
export const CHESTS = {
  trunk1:  `${PROPS_BASE}/chests/trunk_1.fbx`,
  trunk2:  `${PROPS_BASE}/chests/trunk_2.fbx`,
  trunk3:  `${PROPS_BASE}/chests/trunk_3.fbx`,
  trunk4:  `${PROPS_BASE}/chests/trunk_4.fbx`,
  trunk5:  `${PROPS_BASE}/chests/trunk_5.fbx`,
  texture: `${PROPS_BASE}/chests/Texture_Map_chest.png`,
} as const;

/** Tropical palm trees  (craftpix-788811, 10 of 20 variants) */
export const PALM_TREES = Array.from({ length: 10 }, (_, i) => ({
  id:   `palm_${i + 1}`,
  path: `${PROPS_BASE}/palm_trees/Tree_Tropic_${String(i + 1).padStart(3, '0')}.fbx`,
})) as Array<{ id: string; path: string }>;
export const PALM_TREE_TEXTURE = `${PROPS_BASE}/palm_trees/T_Tree_tropical.png`;

/** Farm animals  (craftpix-781990, 10 animated FBX) */
export const FARM_ANIMALS = {
  bull:    `${PROPS_BASE}/animals/bull.fbx`,
  chicken: `${PROPS_BASE}/animals/chicken.fbx`,
  cow:     `${PROPS_BASE}/animals/cow.fbx`,
  duck:    `${PROPS_BASE}/animals/dack.fbx`,
  dog:     `${PROPS_BASE}/animals/dog.fbx`,
  horse:   `${PROPS_BASE}/animals/horse.fbx`,
  pig:     `${PROPS_BASE}/animals/pig.fbx`,
  ram:     `${PROPS_BASE}/animals/ram.fbx`,
  rooster: `${PROPS_BASE}/animals/rooster.fbx`,
  sheep:   `${PROPS_BASE}/animals/sheep.fbx`,
  texture: `${PROPS_BASE}/animals/texture_animals.png`,
} as const;

/** Mine nodes, picks, saws, wheelbarrows, ore crystals  (craftpix-net-692030) */
export const MINE = {
  stone:               `${PROPS_BASE}/mine/_stone_2.fbx`,
  coal:                `${PROPS_BASE}/mine/_coal_1.fbx`,
  gold:                `${PROPS_BASE}/mine/_gold_1.fbx`,
  sapphire:            `${PROPS_BASE}/mine/_sapfir_1.fbx`,
  crystal:             `${PROPS_BASE}/mine/_crystal_1.fbx`,
  diamond:             `${PROPS_BASE}/mine/_stone_diamond.fbx`,
  emerald:             `${PROPS_BASE}/mine/_stone_emerald.fbx`,
  pick1:               `${PROPS_BASE}/mine/_pick_1.fbx`,
  pick2:               `${PROPS_BASE}/mine/_pick_2.fbx`,
  saw1:                `${PROPS_BASE}/mine/_saw_1.fbx`,
  wheelbarrowEmpty:    `${PROPS_BASE}/mine/_wheelbarrow_empty.fbx`,
  wheelbarrowCoal:     `${PROPS_BASE}/mine/_wheelbarrow_coal.fbx`,
  wheelbarrowGold:     `${PROPS_BASE}/mine/_wheelbarrow_gold.fbx`,
  wheelbarrowDiamonds: `${PROPS_BASE}/mine/_wheelbarrow_diamonds.fbx`,
  wheelbarrowEmerald:  `${PROPS_BASE}/mine/_wheelbarrow_emerald.fbx`,
  mine1:               `${PROPS_BASE}/mine/_mine_1.fbx`,
  mine2:               `${PROPS_BASE}/mine/_mine_2.fbx`,
  woodHouse:           `${PROPS_BASE}/mine/_wood_house.fbx`,
  texture:             `${PROPS_BASE}/mine/Texture_Map_mine.png`,
} as const;

/** Legion faction orc weapons + siege gear  (craftpix-net-441920) */
export const ORC_WEAPONS = {
  axe:          `${PROPS_BASE}/weapons/orc/_AXE.fbx`,
  hammer1:      `${PROPS_BASE}/weapons/orc/_HAMMER_1.fbx`,
  hammer2:      `${PROPS_BASE}/weapons/orc/_HAMMER_2.fbx`,
  mace:         `${PROPS_BASE}/weapons/orc/_MACE.fbx`,
  sword1:       `${PROPS_BASE}/weapons/orc/_SWORD_1.fbx`,
  sword2:       `${PROPS_BASE}/weapons/orc/_SWORD_2.fbx`,
  spear:        `${PROPS_BASE}/weapons/orc/_SPEAR.fbx`,
  shield1:      `${PROPS_BASE}/weapons/orc/_SHIELD_1.fbx`,
  shield2:      `${PROPS_BASE}/weapons/orc/_SHIELD_2.fbx`,
  bow:          `${PROPS_BASE}/weapons/orc/_BOW.fbx`,
  bowArrow:     `${PROPS_BASE}/weapons/orc/BOW_ARROW.fbx`,
  bowQuiver:    `${PROPS_BASE}/weapons/orc/BOW_QUIVER.fbx`,
  catapult:     `${PROPS_BASE}/weapons/orc/_CATAPULT.fbx`,
  batteringRam: `${PROPS_BASE}/weapons/orc/_BETTERING_RAM.fbx`,
  texture:      `${PROPS_BASE}/weapons/orc/Texture_Map_orc.png`,
} as const;

/** Returns primary melee weapon path for a given faction */
export function factionWeapon(faction: 'Crusade' | 'Fabled' | 'Legion'): string {
  switch (faction) {
    case 'Crusade': return TOOLS.axe;
    case 'Fabled':  return ORC_WEAPONS.bow;
    case 'Legion':  return ORC_WEAPONS.axe;
  }
}
