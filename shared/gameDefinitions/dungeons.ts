export interface DungeonEncounter {
  type: 'combat' | 'puzzle' | 'trap' | 'treasure' | 'rest';
  difficulty: number;
  description: string;
}

export interface Dungeon {
  id: string;
  name: string;
  tier: number;
  levelRange: [number, number];
  partySize: [number, number];
  floors: number;
  description: string;
  themes: string[];
  bossName: string;
  uniqueMechanic: string;
  loot: string[];
  environment: string;
}

export const DUNGEON_TIERS = [
  { tier: 1, name: 'Common', levelRange: [1, 10], color: 'gray' },
  { tier: 2, name: 'Uncommon', levelRange: [11, 20], color: 'green' },
  { tier: 3, name: 'Rare', levelRange: [21, 30], color: 'blue' },
  { tier: 4, name: 'Epic', levelRange: [31, 40], color: 'purple' },
  { tier: 5, name: 'Legendary', levelRange: [41, 50], color: 'orange' },
];

export const DUNGEONS: Record<string, Dungeon> = {
  forgottenCrypt: {
    id: 'forgottenCrypt',
    name: 'Forgotten Crypt',
    tier: 1,
    levelRange: [1, 5],
    partySize: [1, 4],
    floors: 3,
    description: 'Ancient burial grounds awakened by dark magic.',
    themes: ['Undead', 'Dark', 'Decay'],
    bossName: 'Crypt Lord Vexis',
    uniqueMechanic: 'Darkness zones that drain sanity',
    loot: ['Bone Weapons', 'Cloth Armor', 'Cursed Trinkets'],
    environment: 'Underground tomb with coffins and crypts',
  },
  goblinWarren: {
    id: 'goblinWarren',
    name: 'Goblin Warren',
    tier: 1,
    levelRange: [3, 8],
    partySize: [1, 4],
    floors: 4,
    description: 'Twisting tunnels infested with goblins and their traps.',
    themes: ['Goblins', 'Traps', 'Chaos'],
    bossName: 'Warchief Grotgob',
    uniqueMechanic: 'Random trap rooms with puzzle bypasses',
    loot: ['Crude Weapons', 'Trap Components', 'Stolen Goods'],
    environment: 'Dirty tunnel system with makeshift rooms',
  },
  ancientLibrary: {
    id: 'ancientLibrary',
    name: 'Ancient Library',
    tier: 2,
    levelRange: [10, 15],
    partySize: [2, 4],
    floors: 5,
    description: 'Abandoned repository of forbidden knowledge.',
    themes: ['Arcane', 'Knowledge', 'Constructs'],
    bossName: 'The Keeper of Tomes',
    uniqueMechanic: 'Puzzle rooms requiring knowledge checks',
    loot: ['Spell Scrolls', 'Enchanted Books', 'Arcane Dust'],
    environment: 'Vast library with floating books and magical barriers',
  },
  dragonLair: {
    id: 'dragonLair',
    name: 'Dragon Lair',
    tier: 4,
    levelRange: [35, 40],
    partySize: [4, 6],
    floors: 7,
    description: 'The volcanic home of an ancient wyrm.',
    themes: ['Dragons', 'Fire', 'Treasure'],
    bossName: 'Infernus the Crimson',
    uniqueMechanic: 'Heat damage zones and flying phases',
    loot: ['Dragonscale Armor', 'Flame Weapons', 'Dragon Hoard Gold'],
    environment: 'Volcanic cavern with lava rivers and treasure piles',
  },
  voidRift: {
    id: 'voidRift',
    name: 'Void Rift',
    tier: 5,
    levelRange: [45, 50],
    partySize: [4, 6],
    floors: 10,
    description: 'A tear in reality leading to the void dimension.',
    themes: ['Void', 'Cosmic Horror', 'Reality Warping'],
    bossName: "Zha'krul the Unbinding",
    uniqueMechanic: 'Reality shifts change dungeon layout',
    loot: ['Void-Touched Gear', 'Reality Shards', 'Cosmic Artifacts'],
    environment: 'Floating platforms in void space, reality tears',
  },
};

export const DUNGEON_ENCOUNTER_TYPES = {
  combat: { weight: 50, description: 'Fight enemies' },
  puzzle: { weight: 15, description: 'Solve a puzzle' },
  trap: { weight: 15, description: 'Navigate traps' },
  treasure: { weight: 10, description: 'Find treasure' },
  rest: { weight: 10, description: 'Safe rest area' },
};

export function getDungeonsByTier(tier: number): Dungeon[] {
  return Object.values(DUNGEONS).filter(d => d.tier === tier);
}

export function getDungeonsByLevelRange(level: number): Dungeon[] {
  return Object.values(DUNGEONS).filter(d => level >= d.levelRange[0] && level <= d.levelRange[1]);
}
