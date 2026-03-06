export interface Ship {
  id: string;
  name: string;
  tier: number;
  crewCapacity: number;
  cargoCapacity: number;
  speed: number;
  durability: number;
  cannons: number;
  description: string;
  buildMaterials: { material: string; quantity: number }[];
}

export interface SeaRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  distance: number;
  dangerLevel: number;
  treasureChance: number;
  encounterTypes: string[];
}

export interface SeaEncounter {
  id: string;
  name: string;
  type: 'combat' | 'treasure' | 'event' | 'storm';
  difficulty: number;
  rewards: string[];
  description: string;
}

export interface WorldRegion {
  id: string;
  name: string;
  biome: string;
  levelRange: [number, number];
  resources: string[];
  dungeons: string[];
  ports: string[];
  description: string;
}

export const SHIP_TYPES: Record<string, Ship> = {
  raft: {
    id: 'raft',
    name: 'Raft',
    tier: 1,
    crewCapacity: 2,
    cargoCapacity: 10,
    speed: 5,
    durability: 50,
    cannons: 0,
    description: 'A simple wooden raft for short coastal trips',
    buildMaterials: [{ material: 'oakLog', quantity: 20 }],
  },
  skiff: {
    id: 'skiff',
    name: 'Skiff',
    tier: 2,
    crewCapacity: 4,
    cargoCapacity: 25,
    speed: 8,
    durability: 100,
    cannons: 0,
    description: 'A small boat for fishing and exploration',
    buildMaterials: [{ material: 'mapleLog', quantity: 40 }, { material: 'ironOre', quantity: 10 }],
  },
  sloop: {
    id: 'sloop',
    name: 'Sloop',
    tier: 3,
    crewCapacity: 8,
    cargoCapacity: 50,
    speed: 12,
    durability: 200,
    cannons: 4,
    description: 'A fast single-masted vessel for trade and light combat',
    buildMaterials: [{ material: 'ashLog', quantity: 80 }, { material: 'ironOre', quantity: 30 }, { material: 'leather', quantity: 20 }],
  },
  brigantine: {
    id: 'brigantine',
    name: 'Brigantine',
    tier: 4,
    crewCapacity: 16,
    cargoCapacity: 100,
    speed: 15,
    durability: 400,
    cannons: 12,
    description: 'A two-masted vessel balanced for speed and firepower',
    buildMaterials: [{ material: 'ironwoodLog', quantity: 150 }, { material: 'mithrilOre', quantity: 20 }, { material: 'scaleHide', quantity: 30 }],
  },
  galleon: {
    id: 'galleon',
    name: 'Galleon',
    tier: 5,
    crewCapacity: 32,
    cargoCapacity: 250,
    speed: 10,
    durability: 800,
    cannons: 24,
    description: 'A massive warship for naval supremacy',
    buildMaterials: [{ material: 'worldtreeLog', quantity: 300 }, { material: 'adamantiteOre', quantity: 50 }, { material: 'dragonHide', quantity: 20 }],
  },
};

export const SEA_ENCOUNTERS: Record<string, SeaEncounter> = {
  pirateAmbush: { id: 'pirateAmbush', name: 'Pirate Ambush', type: 'combat', difficulty: 2, rewards: ['gold', 'supplies', 'maps'], description: 'Pirates attack your vessel seeking plunder' },
  ghostShip: { id: 'ghostShip', name: 'Ghost Ship', type: 'combat', difficulty: 4, rewards: ['cursedGold', 'artifacts', 'souls'], description: 'A spectral vessel emerges from the mist' },
  seaMonster: { id: 'seaMonster', name: 'Sea Monster', type: 'combat', difficulty: 5, rewards: ['scales', 'teeth', 'treasure'], description: 'A massive creature rises from the depths' },
  floatingTreasure: { id: 'floatingTreasure', name: 'Floating Treasure', type: 'treasure', difficulty: 1, rewards: ['gold', 'supplies'], description: 'Wreckage with salvageable goods' },
  merfolk: { id: 'merfolk', name: 'Merfolk Encounter', type: 'event', difficulty: 2, rewards: ['pearls', 'seaweeds', 'maps'], description: 'Merfolk offer trade or challenge' },
  storm: { id: 'storm', name: 'Violent Storm', type: 'storm', difficulty: 3, rewards: [], description: 'Navigate through dangerous weather' },
  whirlpool: { id: 'whirlpool', name: 'Whirlpool', type: 'event', difficulty: 4, rewards: ['deepTreasure'], description: 'A massive whirlpool threatens to swallow the ship' },
};

export const WORLD_REGIONS: Record<string, WorldRegion> = {
  startingIsles: {
    id: 'startingIsles',
    name: 'Starting Isles',
    biome: 'temperate',
    levelRange: [1, 10],
    resources: ['copper', 'oak', 'silverleaf'],
    dungeons: ['forgottenCrypt', 'goblinWarren'],
    ports: ['novicePort'],
    description: 'Safe waters for new adventurers',
  },
  stormyWaters: {
    id: 'stormyWaters',
    name: 'Stormy Waters',
    biome: 'stormy',
    levelRange: [10, 20],
    resources: ['iron', 'maple', 'mageroyal'],
    dungeons: ['ancientLibrary'],
    ports: ['stormHarbor'],
    description: 'Treacherous seas with frequent storms',
  },
  dragonSea: {
    id: 'dragonSea',
    name: 'Dragon Sea',
    biome: 'volcanic',
    levelRange: [30, 40],
    resources: ['mithril', 'ironwood', 'dreamfoil'],
    dungeons: ['dragonLair'],
    ports: ['dragonPort'],
    description: 'Waters patrolled by sea dragons',
  },
  voidExpanse: {
    id: 'voidExpanse',
    name: 'Void Expanse',
    biome: 'void',
    levelRange: [40, 50],
    resources: ['adamantite', 'worldtree', 'blacklotus'],
    dungeons: ['voidRift'],
    ports: ['voidAnchor'],
    description: 'The edge of reality where the void bleeds through',
  },
};

export function getShipsByTier(tier: number): Ship[] {
  return Object.values(SHIP_TYPES).filter(s => s.tier === tier);
}

export function getRegionByLevel(level: number): WorldRegion | undefined {
  return Object.values(WORLD_REGIONS).find(r => level >= r.levelRange[0] && level <= r.levelRange[1]);
}

export function calculateTravelTime(distance: number, shipSpeed: number): number {
  return Math.ceil(distance / shipSpeed * 60);
}
