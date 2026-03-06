import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  createBattleRequestSchema, 
  moveUnitRequestSchema, 
  useAbilityRequestSchema,
  insertAccountSchema,
  ROLE_PERMISSIONS,
  type AccountRole,
} from "@shared/schema";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get starter roster
  app.get("/api/roster", (_req, res) => {
    const roster = storage.generateStarterRoster();
    res.json(roster);
  });

  // Create a new battle
  app.post("/api/battles", async (req, res) => {
    try {
      const parsed = createBattleRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error });
      }

      const { difficulty, mapSize } = parsed.data;
      
      // Get player units from request or generate default
      const playerUnits = req.body.playerUnits || storage.generateStarterRoster();
      
      const battle = await storage.createBattle(difficulty, playerUnits);
      res.json(battle);
    } catch (error) {
      res.status(500).json({ error: "Failed to create battle" });
    }
  });

  // Get battle state
  app.get("/api/battles/:id", async (req, res) => {
    const battle = await storage.getBattle(req.params.id);
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    res.json(battle);
  });

  // Move unit
  app.post("/api/battles/:id/move", async (req, res) => {
    try {
      const parsed = moveUnitRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error });
      }

      const { unitId, targetX, targetY } = parsed.data;
      const battle = await storage.getBattle(req.params.id);
      
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }

      // Find and update unit position
      const isPlayer = battle.playerUnits.some((u) => u.id === unitId);
      const updateUnits = (units: typeof battle.playerUnits) =>
        units.map((u) =>
          u.id === unitId ? { ...u, position: { x: targetX, y: targetY } } : u
        );

      const updatedBattle = await storage.updateBattle(battle.id, {
        playerUnits: isPlayer ? updateUnits(battle.playerUnits) : battle.playerUnits,
        enemyUnits: !isPlayer ? updateUnits(battle.enemyUnits) : battle.enemyUnits,
      });

      res.json(updatedBattle);
    } catch (error) {
      res.status(500).json({ error: "Failed to move unit" });
    }
  });

  // Use ability / attack
  app.post("/api/battles/:id/action", async (req, res) => {
    try {
      const parsed = useAbilityRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error });
      }

      const { unitId, abilityId, targetX, targetY } = parsed.data;
      const battle = await storage.getBattle(req.params.id);
      
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }

      const allUnits = [...battle.playerUnits, ...battle.enemyUnits];
      const attacker = allUnits.find((u) => u.id === unitId);
      if (!attacker) {
        return res.status(400).json({ error: "Unit not found" });
      }

      const target = allUnits.find(
        (u) => u.position && u.position.x === targetX && u.position.y === targetY
      );
      if (!target) {
        return res.status(400).json({ error: "No target at position" });
      }

      const ability = attacker.abilities.find((a) => a.id === abilityId);
      
      // Calculate damage
      const baseDamage = ability?.damage || attacker.stats.attack;
      const defense = target.stats.defense;
      const damage = Math.max(1, Math.floor(baseDamage * (100 / (100 + defense))));
      const newHp = Math.max(0, target.stats.hp - damage);

      // Update target HP
      const updateUnits = (units: typeof battle.playerUnits) =>
        units.map((u) =>
          u.id === target.id ? { ...u, stats: { ...u.stats, hp: newHp } } : u
        );

      // Update ability cooldown
      const updateAbilities = (units: typeof battle.playerUnits) =>
        units.map((u) =>
          u.id === attacker.id && ability
            ? {
                ...u,
                abilities: u.abilities.map((a) =>
                  a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a
                ),
              }
            : u
        );

      let newPlayerUnits = battle.playerUnits;
      let newEnemyUnits = battle.enemyUnits;

      if (target.isEnemy) {
        newEnemyUnits = updateUnits(newEnemyUnits);
      } else {
        newPlayerUnits = updateUnits(newPlayerUnits);
      }

      if (ability) {
        if (attacker.isEnemy) {
          newEnemyUnits = updateAbilities(newEnemyUnits);
        } else {
          newPlayerUnits = updateAbilities(newPlayerUnits);
        }
      }

      // Check battle end conditions
      const playerAlive = newPlayerUnits.some((u) => u.stats.hp > 0);
      const enemyAlive = newEnemyUnits.some((u) => u.stats.hp > 0);

      let phase = battle.phase;
      if (!playerAlive) phase = "defeat";
      else if (!enemyAlive) phase = "victory";

      const updatedBattle = await storage.updateBattle(battle.id, {
        playerUnits: newPlayerUnits,
        enemyUnits: newEnemyUnits,
        phase,
      });

      res.json({
        battle: updatedBattle,
        combatResult: {
          attackerId: attacker.id,
          defenderId: target.id,
          damage,
          isCritical: false,
          isKill: newHp <= 0,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to perform action" });
    }
  });

  // End turn
  app.post("/api/battles/:id/end-turn", async (req, res) => {
    try {
      const battle = await storage.getBattle(req.params.id);
      
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }

      // Reduce cooldowns
      const reduceCooldowns = (units: typeof battle.playerUnits) =>
        units.map((u) => ({
          ...u,
          abilities: u.abilities.map((a) => ({
            ...a,
            currentCooldown: Math.max(0, a.currentCooldown - 1),
          })),
        }));

      // Calculate next turn
      const aliveTurnOrder = battle.turnOrder.filter((id) => {
        const unit = [...battle.playerUnits, ...battle.enemyUnits].find((u) => u.id === id);
        return unit && unit.stats.hp > 0;
      });

      let newTurnIndex = battle.currentTurnIndex + 1;
      let newTurnNumber = battle.turnNumber;

      if (newTurnIndex >= aliveTurnOrder.length) {
        newTurnIndex = 0;
        newTurnNumber += 1;
      }

      const nextUnitId = aliveTurnOrder[newTurnIndex];
      const allUnits = [...battle.playerUnits, ...battle.enemyUnits];
      const nextUnit = allUnits.find((u) => u.id === nextUnitId);

      const newPhase = nextUnit?.isEnemy ? "enemy_turn" : "player_turn";

      const updatedBattle = await storage.updateBattle(battle.id, {
        turnOrder: aliveTurnOrder,
        currentTurnIndex: newTurnIndex,
        turnNumber: newTurnNumber,
        phase: newPhase as typeof battle.phase,
        selectedUnitId: nextUnitId,
        playerUnits: reduceCooldowns(battle.playerUnits),
        enemyUnits: reduceCooldowns(battle.enemyUnits),
      });

      res.json(updatedBattle);
    } catch (error) {
      res.status(500).json({ error: "Failed to end turn" });
    }
  });

  // Delete battle
  app.delete("/api/battles/:id", async (req, res) => {
    const deleted = await storage.deleteBattle(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Battle not found" });
    }
    res.json({ success: true });
  });

  // ========== HARVESTING API ROUTES ==========

  // Get all resource nodes
  app.get("/api/nodes", async (_req, res) => {
    const nodes = await storage.getNodes();
    res.json(nodes);
  });

  // Get single node
  app.get("/api/nodes/:id", async (req, res) => {
    const node = await storage.getNode(req.params.id);
    if (!node) {
      return res.status(404).json({ error: "Node not found" });
    }
    res.json(node);
  });

  // Get all harvesters
  app.get("/api/harvesters", async (_req, res) => {
    const harvesters = await storage.getHarvesters();
    res.json(harvesters);
  });

  // Get single harvester
  app.get("/api/harvesters/:id", async (req, res) => {
    const harvester = await storage.getHarvester(req.params.id);
    if (!harvester) {
      return res.status(404).json({ error: "Harvester not found" });
    }
    res.json(harvester);
  });

  // Get all assignments
  app.get("/api/assignments", async (_req, res) => {
    const assignments = await storage.getAssignments();
    res.json(assignments);
  });

  // Create assignment (assign harvester to node)
  app.post("/api/assignments", async (req, res) => {
    try {
      const { harvesterId, nodeId } = req.body;
      
      if (!harvesterId || !nodeId) {
        return res.status(400).json({ error: "harvesterId and nodeId are required" });
      }

      const harvester = await storage.getHarvester(harvesterId);
      if (!harvester) {
        return res.status(404).json({ error: "Harvester not found" });
      }

      if (harvester.isAssigned) {
        return res.status(400).json({ error: "Harvester is already assigned" });
      }

      const node = await storage.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ error: "Node not found" });
      }

      const assignment = await storage.createAssignment({
        id: `assignment_${Date.now()}`,
        harvesterId,
        harvesterName: harvester.name,
        harvesterType: harvester.type,
        nodeId,
        nodeType: node.nodeType,
        assignedAt: Date.now(),
        totalHarvested: 0,
      });

      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  // Delete assignment (unassign harvester)
  app.delete("/api/assignments/:id", async (req, res) => {
    const deleted = await storage.deleteAssignment(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    res.json({ success: true });
  });

  // Get profession levels
  app.get("/api/professions", async (_req, res) => {
    const levels = await storage.getProfessionLevels();
    res.json(levels);
  });

  // Get resources
  app.get("/api/resources", async (_req, res) => {
    const resources = await storage.getResources();
    res.json(resources);
  });

  // Perform harvest for all assignments (called every 12 seconds)
  app.post("/api/harvest", async (_req, res) => {
    try {
      const results = await storage.performAllHarvests();
      const resources = await storage.getResources();
      const professions = await storage.getProfessionLevels();
      
      res.json({
        harvests: results,
        resources,
        professions,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to perform harvests" });
    }
  });

  // Perform harvest for single assignment
  app.post("/api/harvest/:assignmentId", async (req, res) => {
    try {
      const result = await storage.performHarvest(req.params.assignmentId);
      if (!result) {
        return res.status(400).json({ error: "Could not perform harvest" });
      }
      
      const resources = await storage.getResources();
      res.json({ harvest: result, resources });
    } catch (error) {
      res.status(500).json({ error: "Failed to perform harvest" });
    }
  });

  // Get harvest history
  app.get("/api/harvest/history", async (_req, res) => {
    const results = await storage.getHarvestResults();
    res.json(results);
  });

  // ========== ACCOUNT API ROUTES ==========

  // Create new account
  app.post("/api/accounts", async (req, res) => {
    try {
      const parsed = insertAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error });
      }

      // Check for existing username
      const existingUsername = await storage.getAccountByUsername(parsed.data.username);
      if (existingUsername) {
        return res.status(409).json({ error: "Username already exists" });
      }

      // Check for existing email if provided
      if (parsed.data.email) {
        const existingEmail = await storage.getAccountByEmail(parsed.data.email);
        if (existingEmail) {
          return res.status(409).json({ error: "Email already registered" });
        }
      }

      const account = await storage.createAccount(parsed.data);
      
      // Don't return sensitive info
      const { ...safeAccount } = account;
      res.status(201).json(safeAccount);
    } catch (error) {
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Get account by GRUDGE UUID
  app.get("/api/accounts/:grudgeUuid", async (req, res) => {
    const account = await storage.getAccount(req.params.grudgeUuid);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  });

  // Get account by username
  app.get("/api/accounts/username/:username", async (req, res) => {
    const account = await storage.getAccountByUsername(req.params.username);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  });

  // Update account
  app.patch("/api/accounts/:grudgeUuid", async (req, res) => {
    try {
      const account = await storage.updateAccount(req.params.grudgeUuid, req.body);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // Delete account
  app.delete("/api/accounts/:grudgeUuid", async (req, res) => {
    const deleted = await storage.deleteAccount(req.params.grudgeUuid);
    if (!deleted) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ success: true });
  });

  // Get all accounts (admin only - should add auth middleware later)
  app.get("/api/admin/accounts", async (_req, res) => {
    const accounts = await storage.getAllAccounts();
    res.json(accounts);
  });

  // Get accounts by role
  app.get("/api/admin/accounts/role/:role", async (req, res) => {
    const role = req.params.role as AccountRole;
    if (!["admin", "developer", "premium", "user", "guest"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const accounts = await storage.getAccountsByRole(role);
    res.json(accounts);
  });

  // Get role permissions
  app.get("/api/accounts/permissions/:role", async (req, res) => {
    const role = req.params.role as AccountRole;
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json(permissions);
  });

  // ========== SESSION API ROUTES ==========

  // Create session (login)
  app.post("/api/sessions", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Username required" });
      }

      const account = await storage.getAccountByUsername(username);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const token = randomUUID();
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      const session = await storage.createSession(account.grudgeUuid, token, expiresAt);
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Get session
  app.get("/api/sessions/:token", async (req, res) => {
    const session = await storage.getSession(req.params.token);
    if (!session) {
      return res.status(404).json({ error: "Session not found or expired" });
    }
    res.json(session);
  });

  // Delete session (logout)
  app.delete("/api/sessions/:token", async (req, res) => {
    const deleted = await storage.deleteSession(req.params.token);
    if (!deleted) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ success: true });
  });

  // ========== UUID LEDGER API ROUTES ==========

  // Get UUID history
  app.get("/api/uuid-ledger/:grudgeUuid", async (req, res) => {
    const history = await storage.getUuidHistory(req.params.grudgeUuid);
    res.json(history);
  });

  // Get ledger entries by account
  app.get("/api/uuid-ledger/account/:accountId", async (req, res) => {
    const entries = await storage.getUuidLedgerByAccount(req.params.accountId);
    res.json(entries);
  });

  // ========== ENTITY REGISTRY API ROUTES ==========

  // Get entity by GRUDGE UUID
  app.get("/api/entities/:grudgeUuid", async (req, res) => {
    const entity = await storage.getEntity(req.params.grudgeUuid);
    if (!entity) {
      return res.status(404).json({ error: "Entity not found" });
    }
    res.json(entity);
  });

  // Get entities by owner
  app.get("/api/entities/owner/:ownerId", async (req, res) => {
    const entities = await storage.getEntitiesByOwner(req.params.ownerId);
    res.json(entities);
  });

  // Get entities by type
  app.get("/api/entities/type/:entityType", async (req, res) => {
    const entities = await storage.getEntitiesByType(req.params.entityType as any);
    res.json(entities);
  });

  return httpServer;
}
