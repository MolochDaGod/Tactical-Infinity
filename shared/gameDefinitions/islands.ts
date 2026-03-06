import { generateGrudgeUuid } from '../grudgeUuid';

export type ResourceTier = 1 | 2 | 3 | 4 | 5;

export interface ResourceNode {
  id: string;
  nodeType: string;
  tier: ResourceTier;
  resourceType: string;
  baseYield: number;
  respawnTime: number;
  x: number;
  y: number;
  currentYield: number;
  lastHarvested: number;
}

export interface IslandBuilding {
  id: string;
  buildingType: string;
  level: number;
  x: number;
  y: number;
  isConstructing: boolean;
  constructionEndTime: number;
}

export interface Island {
  id: string;
  ownerId: string;
  name: string;
  gridX: number;
  gridY: number;
  biome: string;
  nodes: ResourceNode[];
  buildings: IslandBuilding[];
  assignedHeroes: string[];
  discoveredAt: number;
}

export const RESOURCE_TIERS: Record<ResourceTier, { name: string; color: string; yieldMultiplier: number }> = {
  1: { name: 'Common', color: '#9ca3af', yieldMultiplier: 1.0 },
  2: { name: 'Uncommon', color: '#22c55e', yieldMultiplier: 1.5 },
  3: { name: 'Rare', color: '#3b82f6', yieldMultiplier: 2.0 },
  4: { name: 'Epic', color: '#a855f7', yieldMultiplier: 3.0 },
  5: { name: 'Legendary', color: '#f97316', yieldMultiplier: 5.0 },
};

export const NODE_TYPES = {
  ore: { id: 'ore', name: 'Ore Vein', baseYield: 5, respawnTime: 120, resourceTypes: ['copper', 'iron', 'gold', 'mithril', 'adamantite'] },
  tree: { id: 'tree', name: 'Tree', baseYield: 8, respawnTime: 90, resourceTypes: ['oak', 'maple', 'ash', 'ironwood', 'worldtree'] },
  herb: { id: 'herb', name: 'Herb Patch', baseYield: 3, respawnTime: 60, resourceTypes: ['silverleaf', 'mageroyal', 'fadeleaf', 'dreamfoil', 'blacklotus'] },
  fish: { id: 'fish', name: 'Fishing Spot', baseYield: 4, respawnTime: 45, resourceTypes: ['trout', 'salmon', 'lobster', 'shark', 'seadragon'] },
  hide: { id: 'hide', name: 'Beast Den', baseYield: 2, respawnTime: 180, resourceTypes: ['leather', 'thickhide', 'scalehide', 'dragonhide', 'voidhide'] },
};

export const BIOMES = {
  forest: { id: 'forest', name: 'Forest', primaryNodes: ['tree', 'herb'], color: '#228b22' },
  mountain: { id: 'mountain', name: 'Mountain', primaryNodes: ['ore'], color: '#696969' },
  plains: { id: 'plains', name: 'Plains', primaryNodes: ['herb', 'hide'], color: '#90ee90' },
  coast: { id: 'coast', name: 'Coast', primaryNodes: ['fish', 'herb'], color: '#00bfff' },
  swamp: { id: 'swamp', name: 'Swamp', primaryNodes: ['herb', 'hide'], color: '#556b2f' },
  volcanic: { id: 'volcanic', name: 'Volcanic', primaryNodes: ['ore'], color: '#dc143c' },
};

export const BUILDING_TYPES = {
  barracks: { id: 'barracks', name: 'Barracks', maxLevel: 3, description: 'Train infantry units' },
  archeryRange: { id: 'archeryRange', name: 'Archery Range', maxLevel: 3, description: 'Train ranged units' },
  market: { id: 'market', name: 'Market', maxLevel: 3, description: 'Trade resources' },
  port: { id: 'port', name: 'Port', maxLevel: 3, description: 'Build ships' },
  storage: { id: 'storage', name: 'Storage', maxLevel: 3, description: 'Store resources' },
  house: { id: 'house', name: 'House', maxLevel: 3, description: 'Increase population' },
  wallTower: { id: 'wallTower', name: 'Wall Tower', maxLevel: 3, description: 'Defensive structure' },
  mineShaft: { id: 'mineShaft', name: 'Mine Shaft', maxLevel: 3, description: 'Auto-harvest ore' },
  sawmill: { id: 'sawmill', name: 'Sawmill', maxLevel: 3, description: 'Auto-harvest wood' },
  forge: { id: 'forge', name: 'Forge', maxLevel: 3, description: 'Craft metal items' },
};

export const HARVEST_INTERVAL_MS = 12000;

export function createResourceNode(
  nodeType: string,
  tier: ResourceTier,
  x: number,
  y: number
): ResourceNode {
  const nodeData = NODE_TYPES[nodeType as keyof typeof NODE_TYPES];
  const tierData = RESOURCE_TIERS[tier];
  const resourceIndex = tier - 1;
  const resourceType = nodeData.resourceTypes[resourceIndex] || nodeData.resourceTypes[0];
  
  return {
    id: generateGrudgeUuid('node'),
    nodeType,
    tier,
    resourceType,
    baseYield: Math.floor(nodeData.baseYield * tierData.yieldMultiplier),
    respawnTime: nodeData.respawnTime,
    x,
    y,
    currentYield: Math.floor(nodeData.baseYield * tierData.yieldMultiplier),
    lastHarvested: 0,
  };
}

export function generateIslandNodes(biome: string, gridSize: number = 9): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  const biomeData = BIOMES[biome as keyof typeof BIOMES] || BIOMES.forest;
  
  const nodeCount = 3 + Math.floor(Math.random() * 4);
  const usedPositions = new Set<string>();
  
  for (let i = 0; i < nodeCount; i++) {
    let x, y, posKey;
    do {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      posKey = `${x},${y}`;
    } while (usedPositions.has(posKey));
    usedPositions.add(posKey);
    
    const nodeType = biomeData.primaryNodes[Math.floor(Math.random() * biomeData.primaryNodes.length)];
    
    const tierRoll = Math.random();
    let tier: ResourceTier = 1;
    if (tierRoll < 0.02) tier = 5;
    else if (tierRoll < 0.08) tier = 4;
    else if (tierRoll < 0.20) tier = 3;
    else if (tierRoll < 0.45) tier = 2;
    
    nodes.push(createResourceNode(nodeType, tier, x, y));
  }
  
  return nodes;
}

export function createIsland(
  ownerId: string,
  name: string,
  gridX: number,
  gridY: number,
  biome: string
): Island {
  return {
    id: generateGrudgeUuid('island'),
    ownerId,
    name,
    gridX,
    gridY,
    biome,
    nodes: generateIslandNodes(biome),
    buildings: [],
    assignedHeroes: [],
    discoveredAt: Date.now(),
  };
}
