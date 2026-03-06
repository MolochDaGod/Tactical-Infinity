import { randomUUID } from "crypto";
import type {
  Unit,
  BattleState,
  BattleMap,
  Tile,
  Ability,
  UnitClass,
  Faction,
  TerrainType,
  HarvestableNode,
  Harvester,
  HarvesterAssignment,
  HarvestResult,
  ProfessionLevels,
  NodeType,
  Account,
  InsertAccount,
  UuidLedgerEntry,
  InsertUuidLedgerEntry,
  EntityRegistry,
  Session,
  AccountRole,
} from "@shared/schema";
import { calculateHarvestYield, nodeTypeToProfession, TIER_MULTIPLIERS } from "@shared/schema";
import { UuidGenerators } from "@shared/grudgeUuid";

// Ability templates by class
const abilityTemplates: Record<UnitClass, Ability[]> = {
  warrior: [
    { id: "slash", name: "Slash", description: "A powerful sword strike", type: "attack", damage: 25, range: 1, cooldown: 0, currentCooldown: 0, manaCost: 0 },
    { id: "shield_bash", name: "Shield Bash", description: "Stun enemy and deal damage", type: "attack", damage: 15, range: 1, cooldown: 2, currentCooldown: 0, manaCost: 10 },
    { id: "war_cry", name: "War Cry", description: "Boost nearby allies attack", type: "buff", range: 2, cooldown: 3, currentCooldown: 0, manaCost: 15 },
  ],
  ranger: [
    { id: "precise_shot", name: "Precise Shot", description: "A well-aimed arrow", type: "attack", damage: 22, range: 4, cooldown: 0, currentCooldown: 0, manaCost: 0 },
    { id: "volley", name: "Volley", description: "Rain arrows on an area", type: "attack", damage: 18, range: 3, cooldown: 2, currentCooldown: 0, manaCost: 15 },
    { id: "poison_arrow", name: "Poison Arrow", description: "Inflict poison damage over time", type: "debuff", damage: 10, range: 3, cooldown: 2, currentCooldown: 0, manaCost: 12 },
  ],
  mage: [
    { id: "fireball", name: "Fireball", description: "Launch a ball of fire", type: "attack", damage: 35, range: 3, cooldown: 1, currentCooldown: 0, manaCost: 20 },
    { id: "ice_shard", name: "Ice Shard", description: "Freeze and damage enemy", type: "attack", damage: 20, range: 2, cooldown: 0, currentCooldown: 0, manaCost: 10 },
    { id: "arcane_shield", name: "Arcane Shield", description: "Protect an ally", type: "buff", range: 2, cooldown: 3, currentCooldown: 0, manaCost: 25 },
  ],
  worge: [
    { id: "savage_bite", name: "Savage Bite", description: "A ferocious bite attack", type: "attack", damage: 30, range: 1, cooldown: 0, currentCooldown: 0, manaCost: 0 },
    { id: "howl", name: "Howl", description: "Terrify nearby enemies", type: "debuff", range: 2, cooldown: 3, currentCooldown: 0, manaCost: 15 },
    { id: "pack_instinct", name: "Pack Instinct", description: "Boost nearby allies speed", type: "buff", range: 2, cooldown: 3, currentCooldown: 0, manaCost: 20 },
  ],
};

const baseStats: Record<UnitClass, { hp: number; attack: number; defense: number; speed: number; movement: number; range: number }> = {
  warrior: { hp: 120, attack: 28, defense: 22, speed: 12, movement: 3, range: 1 },
  ranger: { hp: 80, attack: 25, defense: 12, speed: 16, movement: 4, range: 4 },
  mage: { hp: 70, attack: 35, defense: 10, speed: 14, movement: 3, range: 3 },
  worge: { hp: 100, attack: 30, defense: 15, speed: 18, movement: 5, range: 1 },
};

const namesByFaction: Record<Faction, string[]> = {
  crusade: ["Aldric", "Seraphina", "Cedric", "Elara", "Roland", "Isolde", "Marcus", "Helena", "Ragnar", "Kael"],
  fabled: ["Thorin", "Greta", "Bjorn", "Helga", "Magnus", "Ingrid", "Sylvana", "Thorn", "Willow", "Fern"],
  legion: ["Grakk", "Nyx", "Shade", "Whisper", "Dusk", "Raven", "Obsidian", "Eclipse", "Mordak", "Zorith"],
};

const mapNames = [
  "Contested Valley",
  "Shattered Plains",
  "Crimson Fields",
  "Twilight Pass",
  "Iron Bridge",
  "Forgotten Ruins",
  "Wildwood Crossing",
  "Storm's Edge",
  "Sunfall Mesa",
  "Shadow Ravine",
];

export interface IStorage {
  createBattle(difficulty: string, playerUnits: Unit[]): Promise<BattleState>;
  getBattle(id: string): Promise<BattleState | undefined>;
  updateBattle(id: string, battle: Partial<BattleState>): Promise<BattleState | undefined>;
  deleteBattle(id: string): Promise<boolean>;
  generateStarterRoster(): Unit[];
  
  getNodes(): Promise<HarvestableNode[]>;
  getNode(id: string): Promise<HarvestableNode | undefined>;
  createNode(node: HarvestableNode): Promise<HarvestableNode>;
  updateNode(id: string, updates: Partial<HarvestableNode>): Promise<HarvestableNode | undefined>;
  deleteNode(id: string): Promise<boolean>;
  
  getHarvesters(): Promise<Harvester[]>;
  getHarvester(id: string): Promise<Harvester | undefined>;
  createHarvester(harvester: Harvester): Promise<Harvester>;
  updateHarvester(id: string, updates: Partial<Harvester>): Promise<Harvester | undefined>;
  deleteHarvester(id: string): Promise<boolean>;
  
  getAssignments(): Promise<HarvesterAssignment[]>;
  getAssignment(id: string): Promise<HarvesterAssignment | undefined>;
  createAssignment(assignment: HarvesterAssignment): Promise<HarvesterAssignment>;
  updateAssignment(id: string, updates: Partial<HarvesterAssignment>): Promise<HarvesterAssignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;
  
  getProfessionLevels(): Promise<ProfessionLevels>;
  updateProfessionLevels(updates: Partial<ProfessionLevels>): Promise<ProfessionLevels>;
  addProfessionXp(profession: string, xp: number): Promise<ProfessionLevels>;
  
  getHarvestResults(): Promise<HarvestResult[]>;
  addHarvestResult(result: HarvestResult): Promise<HarvestResult>;
  
  performHarvest(assignmentId: string): Promise<HarvestResult | null>;
  performAllHarvests(): Promise<HarvestResult[]>;
  
  getResources(): Promise<Record<string, number>>;
  addResource(type: string, amount: number): Promise<Record<string, number>>;
  
  // Account management
  createAccount(data: InsertAccount): Promise<Account>;
  getAccount(grudgeUuid: string): Promise<Account | undefined>;
  getAccountByUsername(username: string): Promise<Account | undefined>;
  getAccountByEmail(email: string): Promise<Account | undefined>;
  getAccountByPuterId(puterId: string): Promise<Account | undefined>;
  updateAccount(grudgeUuid: string, updates: Partial<Account>): Promise<Account | undefined>;
  deleteAccount(grudgeUuid: string): Promise<boolean>;
  getAllAccounts(): Promise<Account[]>;
  getAccountsByRole(role: AccountRole): Promise<Account[]>;
  
  // UUID Ledger
  createUuidLedgerEntry(data: InsertUuidLedgerEntry): Promise<UuidLedgerEntry>;
  getUuidHistory(grudgeUuid: string): Promise<UuidLedgerEntry[]>;
  getUuidLedgerByAccount(accountId: string): Promise<UuidLedgerEntry[]>;
  getUuidLedgerByCharacter(characterId: string): Promise<UuidLedgerEntry[]>;
  
  // Entity Registry
  registerEntity(entity: EntityRegistry): Promise<EntityRegistry>;
  getEntity(grudgeUuid: string): Promise<EntityRegistry | undefined>;
  updateEntityStatus(grudgeUuid: string, status: EntityRegistry['status']): Promise<EntityRegistry | undefined>;
  getEntitiesByOwner(ownerId: string): Promise<EntityRegistry[]>;
  getEntitiesByType(entityType: EntityRegistry['entityType']): Promise<EntityRegistry[]>;
  
  // Sessions
  createSession(accountId: string, token: string, expiresAt: number): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<boolean>;
  deleteSessionsByAccount(accountId: string): Promise<boolean>;
}

const XP_PER_LEVEL = 100;

export class MemStorage implements IStorage {
  private battles: Map<string, BattleState>;
  private nodes: Map<string, HarvestableNode>;
  private harvesters: Map<string, Harvester>;
  private assignments: Map<string, HarvesterAssignment>;
  private harvestResults: HarvestResult[];
  private resources: Record<string, number>;
  private professionLevels: ProfessionLevels;
  
  // Account and UUID tracking
  private accounts: Map<string, Account>;
  private accountsByUsername: Map<string, string>;
  private accountsByEmail: Map<string, string>;
  private accountsByPuterId: Map<string, string>;
  private uuidLedger: UuidLedgerEntry[];
  private entityRegistry: Map<string, EntityRegistry>;
  private sessions: Map<string, Session>;

  constructor() {
    this.battles = new Map();
    this.nodes = new Map();
    this.harvesters = new Map();
    this.assignments = new Map();
    this.harvestResults = [];
    
    // Initialize account/UUID tracking
    this.accounts = new Map();
    this.accountsByUsername = new Map();
    this.accountsByEmail = new Map();
    this.accountsByPuterId = new Map();
    this.uuidLedger = [];
    this.entityRegistry = new Map();
    this.sessions = new Map();
    
    this.resources = {
      iron_ore: 0,
      copper_ore: 0,
      mithril_ore: 0,
      rare_ore: 0,
      herb_bundle: 0,
      silverleaf: 0,
      mageroyal: 0,
      fadeleaf: 0,
      raw_wood: 0,
      oak_log: 0,
      birch_log: 0,
      ancient_wood: 0,
      raw_fish: 0,
      deep_fish: 0,
      crystal_shard: 0,
      mana_essence: 0,
    };
    this.professionLevels = {
      mining: { profession: "mining", level: 1, xp: 0 },
      herbalism: { profession: "herbalism", level: 1, xp: 0 },
      woodcutting: { profession: "woodcutting", level: 1, xp: 0 },
      fishing: { profession: "fishing", level: 1, xp: 0 },
    };
    
    // Storage starts empty - no placeholder data
    // Data is created through gameplay or API calls
  }

  private generateUnit(
    unitClass: UnitClass,
    faction: Faction,
    isEnemy: boolean = false,
    level: number = 1
  ): Unit {
    const names = namesByFaction[faction];
    const name = names[Math.floor(Math.random() * names.length)];
    const stats = { ...baseStats[unitClass] };

    const levelBonus = (level - 1) * 0.1;
    stats.hp = Math.floor(stats.hp * (1 + levelBonus));
    stats.attack = Math.floor(stats.attack * (1 + levelBonus));
    stats.defense = Math.floor(stats.defense * (1 + levelBonus));

    // Use GRUDGE UUID for characters
    const id = UuidGenerators.character(name);

    return {
      id,
      name,
      class: unitClass,
      faction,
      level,
      stats: { ...stats, maxHp: stats.hp },
      abilities: [...abilityTemplates[unitClass]],
      isEnemy,
      portraitIndex: Math.floor(Math.random() * 4),
    };
  }

  private generateMap(width: number, height: number): BattleMap {
    const tiles: Tile[] = [];
    const terrainTypes: TerrainType[] = ["grass", "stone", "forest", "sand"];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrain = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
        tiles.push({
          x,
          y,
          terrain,
          elevation: Math.floor(Math.random() * 2),
          isHighlighted: false,
        });
      }
    }

    return {
      id: randomUUID(),
      name: mapNames[Math.floor(Math.random() * mapNames.length)],
      width,
      height,
      tiles,
    };
  }

  private generateEnemyTeam(
    difficulty: string,
    playerLevel: number
  ): Unit[] {
    const enemyFactions: Faction[] = ["crusade", "fabled", "legion"];
    const faction = enemyFactions[Math.floor(Math.random() * enemyFactions.length)];

    const counts: Record<string, number> = {
      easy: 3,
      normal: 4,
      hard: 5,
    };

    const levelBonus: Record<string, number> = {
      easy: -1,
      normal: 0,
      hard: 1,
    };

    const classes: UnitClass[] = ["warrior", "ranger", "mage", "worge"];
    const team: Unit[] = [];

    const count = counts[difficulty] || 4;
    const bonus = levelBonus[difficulty] || 0;

    for (let i = 0; i < count; i++) {
      const unitClass = classes[Math.floor(Math.random() * classes.length)];
      const level = Math.max(1, playerLevel + bonus);
      team.push(this.generateUnit(unitClass, faction, true, level));
    }

    return team;
  }

  generateStarterRoster(): Unit[] {
    return [
      this.generateUnit("warrior", "crusade", false, 1),
      this.generateUnit("ranger", "crusade", false, 1),
      this.generateUnit("mage", "crusade", false, 1),
      this.generateUnit("worge", "crusade", false, 1),
    ];
  }

  async createBattle(difficulty: string, playerUnits: Unit[]): Promise<BattleState> {
    const positionedPlayerUnits = playerUnits.map((unit, index) => ({
      ...unit,
      position: { x: 1, y: index + 2 },
      stats: { ...unit.stats, hp: unit.stats.maxHp },
    }));

    const avgLevel = Math.floor(
      playerUnits.reduce((sum, u) => sum + u.level, 0) / playerUnits.length
    );

    const enemies = this.generateEnemyTeam(difficulty, avgLevel).map((unit, index) => ({
      ...unit,
      position: { x: 8, y: index + 2 },
    }));

    const map = this.generateMap(10, 8);

    const allUnits = [...positionedPlayerUnits, ...enemies];
    const turnOrder = allUnits
      .sort((a, b) => b.stats.speed - a.stats.speed)
      .map((u) => u.id);

    const battle: BattleState = {
      id: randomUUID(),
      map,
      playerUnits: positionedPlayerUnits,
      enemyUnits: enemies,
      turnOrder,
      currentTurnIndex: 0,
      turnNumber: 1,
      phase: "player_turn",
      selectedUnitId: undefined,
      selectedAbilityId: undefined,
    };

    this.battles.set(battle.id, battle);
    return battle;
  }

  async getBattle(id: string): Promise<BattleState | undefined> {
    return this.battles.get(id);
  }

  async updateBattle(
    id: string,
    updates: Partial<BattleState>
  ): Promise<BattleState | undefined> {
    const battle = this.battles.get(id);
    if (!battle) return undefined;

    const updatedBattle = { ...battle, ...updates };
    this.battles.set(id, updatedBattle);
    return updatedBattle;
  }

  async deleteBattle(id: string): Promise<boolean> {
    return this.battles.delete(id);
  }
  
  async getNodes(): Promise<HarvestableNode[]> {
    return Array.from(this.nodes.values());
  }

  async getNode(id: string): Promise<HarvestableNode | undefined> {
    return this.nodes.get(id);
  }

  async createNode(node: HarvestableNode): Promise<HarvestableNode> {
    this.nodes.set(node.id, node);
    return node;
  }

  async updateNode(id: string, updates: Partial<HarvestableNode>): Promise<HarvestableNode | undefined> {
    const node = this.nodes.get(id);
    if (!node) return undefined;
    const updated = { ...node, ...updates };
    this.nodes.set(id, updated);
    return updated;
  }

  async deleteNode(id: string): Promise<boolean> {
    return this.nodes.delete(id);
  }

  async getHarvesters(): Promise<Harvester[]> {
    return Array.from(this.harvesters.values());
  }

  async getHarvester(id: string): Promise<Harvester | undefined> {
    return this.harvesters.get(id);
  }

  async createHarvester(harvester: Harvester): Promise<Harvester> {
    this.harvesters.set(harvester.id, harvester);
    return harvester;
  }

  async updateHarvester(id: string, updates: Partial<Harvester>): Promise<Harvester | undefined> {
    const harvester = this.harvesters.get(id);
    if (!harvester) return undefined;
    const updated = { ...harvester, ...updates };
    this.harvesters.set(id, updated);
    return updated;
  }

  async deleteHarvester(id: string): Promise<boolean> {
    return this.harvesters.delete(id);
  }

  async getAssignments(): Promise<HarvesterAssignment[]> {
    return Array.from(this.assignments.values());
  }

  async getAssignment(id: string): Promise<HarvesterAssignment | undefined> {
    return this.assignments.get(id);
  }

  async createAssignment(assignment: HarvesterAssignment): Promise<HarvesterAssignment> {
    this.assignments.set(assignment.id, assignment);
    const harvester = this.harvesters.get(assignment.harvesterId);
    if (harvester) {
      harvester.isAssigned = true;
      harvester.assignedNodeId = assignment.nodeId;
      this.harvesters.set(harvester.id, harvester);
    }
    return assignment;
  }

  async updateAssignment(id: string, updates: Partial<HarvesterAssignment>): Promise<HarvesterAssignment | undefined> {
    const assignment = this.assignments.get(id);
    if (!assignment) return undefined;
    const updated = { ...assignment, ...updates };
    this.assignments.set(id, updated);
    return updated;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const assignment = this.assignments.get(id);
    if (assignment) {
      const harvester = this.harvesters.get(assignment.harvesterId);
      if (harvester) {
        harvester.isAssigned = false;
        harvester.assignedNodeId = undefined;
        this.harvesters.set(harvester.id, harvester);
      }
    }
    return this.assignments.delete(id);
  }

  async getProfessionLevels(): Promise<ProfessionLevels> {
    return { ...this.professionLevels };
  }

  async updateProfessionLevels(updates: Partial<ProfessionLevels>): Promise<ProfessionLevels> {
    this.professionLevels = { ...this.professionLevels, ...updates };
    return this.professionLevels;
  }

  async addProfessionXp(profession: string, xp: number): Promise<ProfessionLevels> {
    const prof = this.professionLevels[profession as keyof ProfessionLevels];
    if (prof) {
      prof.xp += xp;
      while (prof.xp >= XP_PER_LEVEL && prof.level < 100) {
        prof.xp -= XP_PER_LEVEL;
        prof.level += 1;
      }
      if (prof.level >= 100) {
        prof.level = 100;
        prof.xp = 0;
      }
    }
    return this.professionLevels;
  }

  async getHarvestResults(): Promise<HarvestResult[]> {
    return [...this.harvestResults];
  }

  async addHarvestResult(result: HarvestResult): Promise<HarvestResult> {
    this.harvestResults.push(result);
    if (this.harvestResults.length > 100) {
      this.harvestResults = this.harvestResults.slice(-100);
    }
    return result;
  }

  async performHarvest(assignmentId: string): Promise<HarvestResult | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return null;

    const node = this.nodes.get(assignment.nodeId);
    if (!node || !node.isActive) return null;

    const harvester = this.harvesters.get(assignment.harvesterId);
    if (!harvester) return null;

    const profession = nodeTypeToProfession[node.nodeType];
    const profLevel = this.professionLevels[profession]?.level ?? 1;
    
    const baseYield = 10;
    const { baseAmount, bonusAmount, totalAmount } = calculateHarvestYield(
      baseYield,
      node.tier,
      profLevel,
      harvester.harvestingSkill
    );

    const tierData = TIER_MULTIPLIERS[node.tier] ?? TIER_MULTIPLIERS[1];
    const xpGained = Math.floor(node.xpReward * tierData.xpMultiplier);

    this.resources[node.harvestYield] = (this.resources[node.harvestYield] || 0) + totalAmount;

    await this.addProfessionXp(profession, xpGained);

    const result: HarvestResult = {
      nodeId: node.id,
      harvesterId: harvester.id,
      resourceType: node.harvestYield,
      baseYield: baseAmount,
      bonusYield: bonusAmount,
      totalYield: totalAmount,
      xpGained,
      timestamp: Date.now(),
    };

    assignment.lastHarvestAt = Date.now();
    assignment.totalHarvested += totalAmount;
    this.assignments.set(assignmentId, assignment);

    await this.addHarvestResult(result);
    return result;
  }

  async performAllHarvests(): Promise<HarvestResult[]> {
    const results: HarvestResult[] = [];
    for (const assignment of this.assignments.values()) {
      const result = await this.performHarvest(assignment.id);
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  async getResources(): Promise<Record<string, number>> {
    return { ...this.resources };
  }

  async addResource(type: string, amount: number): Promise<Record<string, number>> {
    this.resources[type] = (this.resources[type] || 0) + amount;
    return this.resources;
  }

  // Account Management
  async createAccount(data: InsertAccount): Promise<Account> {
    const grudgeUuid = UuidGenerators.account(data.username, data.email);
    const account: Account = {
      ...data,
      grudgeUuid,
      createdAt: Date.now(),
      role: data.role || "user",
      isPremium: data.isPremium || false,
      status: data.status || "active",
    };
    
    this.accounts.set(grudgeUuid, account);
    this.accountsByUsername.set(data.username.toLowerCase(), grudgeUuid);
    if (data.email) {
      this.accountsByEmail.set(data.email.toLowerCase(), grudgeUuid);
    }
    if (data.puterId) {
      this.accountsByPuterId.set(data.puterId, grudgeUuid);
    }
    
    // Register entity and log creation
    await this.registerEntity({
      grudgeUuid,
      entityType: "account",
      entityName: data.username,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { role: account.role },
    });
    
    await this.createUuidLedgerEntry({
      grudgeUuid,
      eventType: "created",
      accountId: grudgeUuid,
      metadata: { username: data.username, role: account.role },
    });
    
    return account;
  }

  async getAccount(grudgeUuid: string): Promise<Account | undefined> {
    return this.accounts.get(grudgeUuid);
  }

  async getAccountByUsername(username: string): Promise<Account | undefined> {
    const uuid = this.accountsByUsername.get(username.toLowerCase());
    return uuid ? this.accounts.get(uuid) : undefined;
  }

  async getAccountByEmail(email: string): Promise<Account | undefined> {
    const uuid = this.accountsByEmail.get(email.toLowerCase());
    return uuid ? this.accounts.get(uuid) : undefined;
  }

  async getAccountByPuterId(puterId: string): Promise<Account | undefined> {
    const uuid = this.accountsByPuterId.get(puterId);
    return uuid ? this.accounts.get(uuid) : undefined;
  }

  async updateAccount(grudgeUuid: string, updates: Partial<Account>): Promise<Account | undefined> {
    const account = this.accounts.get(grudgeUuid);
    if (!account) return undefined;
    
    const previousState = { ...account };
    const updated = { ...account, ...updates };
    this.accounts.set(grudgeUuid, updated);
    
    // Update lookup indices if needed
    if (updates.email && updates.email !== account.email) {
      if (account.email) {
        this.accountsByEmail.delete(account.email.toLowerCase());
      }
      this.accountsByEmail.set(updates.email.toLowerCase(), grudgeUuid);
    }
    if (updates.puterId && updates.puterId !== account.puterId) {
      if (account.puterId) {
        this.accountsByPuterId.delete(account.puterId);
      }
      this.accountsByPuterId.set(updates.puterId, grudgeUuid);
    }
    
    // Log modification
    await this.createUuidLedgerEntry({
      grudgeUuid,
      eventType: "modified",
      accountId: grudgeUuid,
      previousState: JSON.stringify(previousState),
      newState: JSON.stringify(updated),
      metadata: { changedFields: Object.keys(updates) },
    });
    
    return updated;
  }

  async deleteAccount(grudgeUuid: string): Promise<boolean> {
    const account = this.accounts.get(grudgeUuid);
    if (!account) return false;
    
    this.accountsByUsername.delete(account.username.toLowerCase());
    if (account.email) {
      this.accountsByEmail.delete(account.email.toLowerCase());
    }
    if (account.puterId) {
      this.accountsByPuterId.delete(account.puterId);
    }
    
    // Log destruction
    await this.createUuidLedgerEntry({
      grudgeUuid,
      eventType: "destroyed",
      accountId: grudgeUuid,
      previousState: "active",
      newState: "deleted",
    });
    
    return this.accounts.delete(grudgeUuid);
  }

  async getAllAccounts(): Promise<Account[]> {
    return Array.from(this.accounts.values());
  }

  async getAccountsByRole(role: AccountRole): Promise<Account[]> {
    return Array.from(this.accounts.values()).filter(a => a.role === role);
  }

  // UUID Ledger
  async createUuidLedgerEntry(data: InsertUuidLedgerEntry): Promise<UuidLedgerEntry> {
    const entry: UuidLedgerEntry = {
      id: randomUUID(),
      ...data,
      relatedUuids: data.relatedUuids || [],
      metadata: data.metadata || {},
      createdAt: Date.now(),
    };
    
    this.uuidLedger.push(entry);
    
    // Keep ledger manageable (last 10000 entries)
    if (this.uuidLedger.length > 10000) {
      this.uuidLedger = this.uuidLedger.slice(-10000);
    }
    
    return entry;
  }

  async getUuidHistory(grudgeUuid: string): Promise<UuidLedgerEntry[]> {
    return this.uuidLedger.filter(e => e.grudgeUuid === grudgeUuid);
  }

  async getUuidLedgerByAccount(accountId: string): Promise<UuidLedgerEntry[]> {
    return this.uuidLedger.filter(e => e.accountId === accountId);
  }

  async getUuidLedgerByCharacter(characterId: string): Promise<UuidLedgerEntry[]> {
    return this.uuidLedger.filter(e => e.characterId === characterId);
  }

  // Entity Registry
  async registerEntity(entity: EntityRegistry): Promise<EntityRegistry> {
    this.entityRegistry.set(entity.grudgeUuid, entity);
    return entity;
  }

  async getEntity(grudgeUuid: string): Promise<EntityRegistry | undefined> {
    return this.entityRegistry.get(grudgeUuid);
  }

  async updateEntityStatus(grudgeUuid: string, status: EntityRegistry['status']): Promise<EntityRegistry | undefined> {
    const entity = this.entityRegistry.get(grudgeUuid);
    if (!entity) return undefined;
    
    const updated = { ...entity, status, updatedAt: Date.now() };
    this.entityRegistry.set(grudgeUuid, updated);
    return updated;
  }

  async getEntitiesByOwner(ownerId: string): Promise<EntityRegistry[]> {
    return Array.from(this.entityRegistry.values()).filter(e => e.ownerId === ownerId);
  }

  async getEntitiesByType(entityType: EntityRegistry['entityType']): Promise<EntityRegistry[]> {
    return Array.from(this.entityRegistry.values()).filter(e => e.entityType === entityType);
  }

  // Sessions
  async createSession(accountId: string, token: string, expiresAt: number): Promise<Session> {
    const grudgeUuid = UuidGenerators.session(accountId);
    const session: Session = {
      grudgeUuid,
      accountId,
      token,
      expiresAt,
      createdAt: Date.now(),
    };
    
    this.sessions.set(token, session);
    return session;
  }

  async getSession(token: string): Promise<Session | undefined> {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    
    // Check expiration
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    
    return session;
  }

  async deleteSession(token: string): Promise<boolean> {
    return this.sessions.delete(token);
  }

  async deleteSessionsByAccount(accountId: string): Promise<boolean> {
    const toDelete: string[] = [];
    for (const [token, session] of this.sessions.entries()) {
      if (session.accountId === accountId) {
        toDelete.push(token);
      }
    }
    for (const token of toDelete) {
      this.sessions.delete(token);
    }
    return toDelete.length > 0;
  }
}

export const storage = new MemStorage();
