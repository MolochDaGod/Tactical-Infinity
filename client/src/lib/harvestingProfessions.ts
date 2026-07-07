import * as THREE from 'three';

export type HarvestingProfession = 
  | 'woodcutting'
  | 'mining'
  | 'quarrying'
  | 'skinning'
  | 'herbalism'
  | 'fishing';

export type ResourceType = 
  | 'wood'
  | 'stone'
  | 'ore_iron'
  | 'ore_copper'
  | 'ore_gold'
  | 'ore_mythril'
  | 'leather'
  | 'hide'
  | 'bone'
  | 'fiber'
  | 'herb_healing'
  | 'herb_mana'
  | 'herb_stamina'
  | 'fish_common'
  | 'fish_rare';

export interface HarvestingTool {
  id: string;
  name: string;
  profession: HarvestingProfession;
  tier: number;
  harvestSpeed: number;
  durability: number;
  maxDurability: number;
}

export interface ResourceNode {
  id: string;
  type: ResourceType;
  profession: HarvestingProfession;
  position: THREE.Vector3;
  rotation: number;
  mesh: THREE.Group | null;
  health: number;
  maxHealth: number;
  respawnTime: number;
  lastHarvested: number;
  isActive: boolean;
  yieldMin: number;
  yieldMax: number;
  tier: number;
  xpReward: number;
}

export interface HarvestingProfessionLevel {
  level: number;
  xp: number;
  xpToNextLevel: number;
}

export interface PlayerHarvestingStats {
  woodcutting: HarvestingProfessionLevel;
  mining: HarvestingProfessionLevel;
  quarrying: HarvestingProfessionLevel;
  skinning: HarvestingProfessionLevel;
  herbalism: HarvestingProfessionLevel;
  fishing: HarvestingProfessionLevel;
}

export interface HarvestResult {
  success: boolean;
  resourceType: ResourceType;
  amount: number;
  xpGained: number;
  nodeDestroyed: boolean;
  message: string;
}

export type ProfessionIconType = 'axe' | 'pickaxe' | 'rock' | 'knife' | 'leaf' | 'fish';

export const professionDefinitions: Record<HarvestingProfession, {
  name: string;
  description: string;
  iconType: ProfessionIconType;
  resourceTypes: ResourceType[];
  requiredTool: string;
}> = {
  woodcutting: {
    name: 'Woodcutting',
    description: 'Chop trees to gather wood for construction and crafting',
    iconType: 'axe',
    resourceTypes: ['wood'],
    requiredTool: 'axe'
  },
  mining: {
    name: 'Mining',
    description: 'Mine ore veins to gather metals for smithing',
    iconType: 'pickaxe',
    resourceTypes: ['ore_iron', 'ore_copper', 'ore_gold', 'ore_mythril'],
    requiredTool: 'pickaxe'
  },
  quarrying: {
    name: 'Quarrying',
    description: 'Break rocks to gather stone for building',
    iconType: 'rock',
    resourceTypes: ['stone'],
    requiredTool: 'pickaxe'
  },
  skinning: {
    name: 'Skinning',
    description: 'Skin animals to gather leather and hides',
    iconType: 'knife',
    resourceTypes: ['leather', 'hide', 'bone'],
    requiredTool: 'skinning_knife'
  },
  herbalism: {
    name: 'Herbalism',
    description: 'Gather herbs and plants for alchemy',
    iconType: 'leaf',
    resourceTypes: ['fiber', 'herb_healing', 'herb_mana', 'herb_stamina'],
    requiredTool: 'none'
  },
  fishing: {
    name: 'Fishing',
    description: 'Catch fish from water sources',
    iconType: 'fish',
    resourceTypes: ['fish_common', 'fish_rare'],
    requiredTool: 'fishing_rod'
  }
};

export const resourceDefinitions: Record<ResourceType, {
  name: string;
  description: string;
  profession: HarvestingProfession;
  tier: number;
  stackSize: number;
  baseValue: number;
}> = {
  wood: {
    name: 'Wood',
    description: 'Basic building material from trees',
    profession: 'woodcutting',
    tier: 1,
    stackSize: 100,
    baseValue: 1
  },
  stone: {
    name: 'Stone',
    description: 'Building material from rocks',
    profession: 'quarrying',
    tier: 1,
    stackSize: 100,
    baseValue: 2
  },
  ore_iron: {
    name: 'Iron Ore',
    description: 'Common metal ore for smithing',
    profession: 'mining',
    tier: 1,
    stackSize: 50,
    baseValue: 5
  },
  ore_copper: {
    name: 'Copper Ore',
    description: 'Soft metal ore for basic items',
    profession: 'mining',
    tier: 1,
    stackSize: 50,
    baseValue: 3
  },
  ore_gold: {
    name: 'Gold Ore',
    description: 'Precious metal ore',
    profession: 'mining',
    tier: 3,
    stackSize: 25,
    baseValue: 25
  },
  ore_mythril: {
    name: 'Mythril Ore',
    description: 'Rare magical metal ore',
    profession: 'mining',
    tier: 5,
    stackSize: 10,
    baseValue: 100
  },
  leather: {
    name: 'Leather',
    description: 'Processed animal hide',
    profession: 'skinning',
    tier: 2,
    stackSize: 50,
    baseValue: 8
  },
  hide: {
    name: 'Raw Hide',
    description: 'Unprocessed animal skin',
    profession: 'skinning',
    tier: 1,
    stackSize: 50,
    baseValue: 3
  },
  bone: {
    name: 'Bone',
    description: 'Animal bones for crafting',
    profession: 'skinning',
    tier: 1,
    stackSize: 50,
    baseValue: 2
  },
  fiber: {
    name: 'Plant Fiber',
    description: 'Raw plant material for rope and cloth',
    profession: 'herbalism',
    tier: 1,
    stackSize: 100,
    baseValue: 1
  },
  herb_healing: {
    name: 'Healing Herb',
    description: 'Used for health potions',
    profession: 'herbalism',
    tier: 2,
    stackSize: 25,
    baseValue: 10
  },
  herb_mana: {
    name: 'Mana Herb',
    description: 'Used for mana potions',
    profession: 'herbalism',
    tier: 2,
    stackSize: 25,
    baseValue: 12
  },
  herb_stamina: {
    name: 'Stamina Herb',
    description: 'Used for stamina potions',
    profession: 'herbalism',
    tier: 2,
    stackSize: 25,
    baseValue: 8
  },
  fish_common: {
    name: 'Common Fish',
    description: 'Standard edible fish',
    profession: 'fishing',
    tier: 1,
    stackSize: 25,
    baseValue: 5
  },
  fish_rare: {
    name: 'Rare Fish',
    description: 'Valuable exotic fish',
    profession: 'fishing',
    tier: 3,
    stackSize: 10,
    baseValue: 25
  }
};

export function calculateXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function calculateHarvestDamage(
  toolTier: number, 
  professionLevel: number, 
  nodeTier: number
): number {
  const baseDamage = 10;
  const tierBonus = toolTier * 5;
  const levelBonus = Math.floor(professionLevel / 5);
  const nodePenalty = Math.max(0, (nodeTier - toolTier) * 5);
  
  return Math.max(1, baseDamage + tierBonus + levelBonus - nodePenalty);
}

export function calculateHarvestYield(
  baseMin: number,
  baseMax: number,
  professionLevel: number,
  toolTier: number
): number {
  const levelBonus = 1 + (professionLevel * 0.02);
  const tierBonus = 1 + (toolTier * 0.1);
  
  const adjustedMin = Math.floor(baseMin * levelBonus * tierBonus);
  const adjustedMax = Math.floor(baseMax * levelBonus * tierBonus);
  
  return Math.floor(Math.random() * (adjustedMax - adjustedMin + 1)) + adjustedMin;
}

export function createDefaultPlayerHarvestingStats(): PlayerHarvestingStats {
  return {
    woodcutting: { level: 1, xp: 0, xpToNextLevel: 100 },
    mining: { level: 1, xp: 0, xpToNextLevel: 100 },
    quarrying: { level: 1, xp: 0, xpToNextLevel: 100 },
    skinning: { level: 1, xp: 0, xpToNextLevel: 100 },
    herbalism: { level: 1, xp: 0, xpToNextLevel: 100 },
    fishing: { level: 1, xp: 0, xpToNextLevel: 100 }
  };
}

export class HarvestingSystem {
  private playerStats: PlayerHarvestingStats;
  private equippedTool: HarvestingTool | null = null;
  private resourceNodes: Map<string, ResourceNode> = new Map();
  private harvestCooldown: number = 0;
  private readonly HARVEST_COOLDOWN_MS = 500;

  constructor(stats?: PlayerHarvestingStats) {
    this.playerStats = stats || createDefaultPlayerHarvestingStats();
  }

  setEquippedTool(tool: HarvestingTool | null): void {
    this.equippedTool = tool;
  }

  getEquippedTool(): HarvestingTool | null {
    return this.equippedTool;
  }

  registerNode(node: ResourceNode): void {
    this.resourceNodes.set(node.id, node);
  }

  removeNode(id: string): void {
    this.resourceNodes.delete(id);
  }

  getNode(id: string): ResourceNode | undefined {
    return this.resourceNodes.get(id);
  }

  getAllNodes(): ResourceNode[] {
    return Array.from(this.resourceNodes.values());
  }

  getActiveNodes(): ResourceNode[] {
    return this.getAllNodes().filter(node => node.isActive);
  }

  getProfessionLevel(profession: HarvestingProfession): HarvestingProfessionLevel {
    return this.playerStats[profession];
  }

  addXp(profession: HarvestingProfession, amount: number): boolean {
    const level = this.playerStats[profession];
    level.xp += amount;
    
    let leveledUp = false;
    while (level.xp >= level.xpToNextLevel) {
      level.xp -= level.xpToNextLevel;
      level.level++;
      level.xpToNextLevel = calculateXpForLevel(level.level);
      leveledUp = true;
    }
    
    return leveledUp;
  }

  canHarvest(nodeId: string): { canHarvest: boolean; reason: string } {
    const now = Date.now();
    
    if (now - this.harvestCooldown < this.HARVEST_COOLDOWN_MS) {
      return { canHarvest: false, reason: 'Harvesting on cooldown' };
    }

    const node = this.resourceNodes.get(nodeId);
    if (!node) {
      return { canHarvest: false, reason: 'Node not found' };
    }

    if (!node.isActive) {
      const respawnIn = Math.max(0, node.respawnTime - (now - node.lastHarvested));
      return { canHarvest: false, reason: `Respawning in ${Math.ceil(respawnIn / 1000)}s` };
    }

    const resourceDef = resourceDefinitions[node.type];
    const professionDef = professionDefinitions[node.profession];
    
    if (professionDef.requiredTool !== 'none') {
      if (!this.equippedTool || this.equippedTool.profession !== node.profession) {
        return { canHarvest: false, reason: `Requires ${professionDef.requiredTool}` };
      }
    }

    return { canHarvest: true, reason: '' };
  }

  harvest(nodeId: string): HarvestResult | null {
    const checkResult = this.canHarvest(nodeId);
    if (!checkResult.canHarvest) {
      return {
        success: false,
        resourceType: 'wood',
        amount: 0,
        xpGained: 0,
        nodeDestroyed: false,
        message: checkResult.reason
      };
    }

    const node = this.resourceNodes.get(nodeId)!;
    const resourceDef = resourceDefinitions[node.type];
    
    const toolTier = this.equippedTool?.tier || 0;
    const professionLevel = this.playerStats[node.profession].level;
    
    const damage = calculateHarvestDamage(toolTier, professionLevel, node.tier);
    node.health -= damage;
    
    this.harvestCooldown = Date.now();

    if (node.health <= 0) {
      const yield_ = calculateHarvestYield(
        node.yieldMin,
        node.yieldMax,
        professionLevel,
        toolTier
      );
      
      const xpGained = node.xpReward;
      const leveledUp = this.addXp(node.profession, xpGained);
      
      node.isActive = false;
      node.lastHarvested = Date.now();
      
      return {
        success: true,
        resourceType: node.type,
        amount: yield_,
        xpGained,
        nodeDestroyed: true,
        message: leveledUp 
          ? `+${yield_} ${resourceDef.name}! Level up!`
          : `+${yield_} ${resourceDef.name}`
      };
    }

    return {
      success: true,
      resourceType: node.type,
      amount: 0,
      xpGained: 0,
      nodeDestroyed: false,
      message: `${Math.ceil(node.health)}/${node.maxHealth}`
    };
  }

  update(deltaTime: number): void {
    const now = Date.now();
    
    this.resourceNodes.forEach((node) => {
      if (!node.isActive && now - node.lastHarvested >= node.respawnTime) {
        node.isActive = true;
        node.health = node.maxHealth;
      }
    });
  }

  getPlayerStats(): PlayerHarvestingStats {
    return this.playerStats;
  }
}
