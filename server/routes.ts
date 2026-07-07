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
import * as meshyService from "./meshyService";
import { parseAsepriteFile, getAllAsepriteData } from "./asepriteParser";
import { registerChatRoutes } from "./replit_integrations/chat";
import { mountOpenWorldRoutes } from "./openWorld";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Grudge Open World Server (in-process) ────────────────────────────────
  // Replaces the previous Railway proxy. The world room and WS upgrade are
  // mounted from server/openWorld.ts; routes here keep /api/openworld/* on
  // the same Express app so CORS is a non-issue.
  mountOpenWorldRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "tactical-infinity", ts: Date.now() });
  });

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

  // ========== MESHY AI 3D GENERATION API ROUTES ==========

  // Check if Meshy is configured
  app.get("/api/meshy/status", (_req, res) => {
    res.json({ 
      configured: meshyService.isMeshyConfigured(),
      message: meshyService.isMeshyConfigured() 
        ? "Meshy API is configured and ready" 
        : "MESHY_API_KEY not configured"
    });
  });

  // Generate sail model (async - returns immediately with task ID)
  app.post("/api/meshy/generate-sail", async (_req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const taskId = await meshyService.createTextTo3DPreview({
        prompt: 'medieval sailing ship sail, triangular canvas sail with wooden mast, nautical fabric texture, aged cloth material, rope rigging details',
        artStyle: 'realistic',
        negativePrompt: 'modern, plastic, low quality, blurry',
        shouldRemesh: true
      });
      
      res.json({
        success: true,
        taskId,
        message: "Sail model generation started. Poll /api/meshy/task/:taskId for status."
      });
    } catch (error) {
      console.error("Meshy sail generation error:", error);
      res.status(500).json({ error: "Failed to start sail model generation" });
    }
  });

  // Generate ship model (async - returns immediately with task ID)
  app.post("/api/meshy/generate-ship", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const shipType = req.body.shipType || 'sloop';
      const shipPrompts = meshyService.SHIP_MODEL_PROMPTS;
      const shipPrompt = shipPrompts[shipType] || shipPrompts.sloop;
      
      const taskId = await meshyService.createTextTo3DPreview({
        prompt: shipPrompt.prompt,
        artStyle: 'realistic',
        negativePrompt: shipPrompt.negativePrompt || 'modern, plastic, sails, low quality',
        shouldRemesh: true
      });
      
      res.json({
        success: true,
        taskId,
        shipType,
        message: `${shipType} ship model generation started. Poll /api/meshy/task/:taskId for status.`
      });
    } catch (error) {
      console.error("Meshy ship generation error:", error);
      res.status(500).json({ error: "Failed to start ship model generation" });
    }
  });
  
  // Get available ship types for generation
  app.get("/api/meshy/ship-types", async (_req, res) => {
    const shipTypes = Object.keys(meshyService.SHIP_MODEL_PROMPTS);
    res.json({ shipTypes });
  });

  // Refine a completed preview task
  app.post("/api/meshy/refine/:taskId", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const refineTaskId = await meshyService.refineModel(req.params.taskId, true);
      res.json({
        success: true,
        taskId: refineTaskId,
        message: "Refinement started. Poll /api/meshy/task/:taskId for status."
      });
    } catch (error) {
      console.error("Meshy refine error:", error);
      res.status(500).json({ error: "Failed to start refinement" });
    }
  });

  // Generate custom 3D model
  app.post("/api/meshy/generate", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const { prompt, artStyle, negativePrompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      
      const taskId = await meshyService.createTextTo3DPreview({
        prompt,
        artStyle: artStyle || 'realistic',
        negativePrompt
      });
      
      res.json({
        success: true,
        taskId,
        message: "3D model generation started. Poll /api/meshy/task/:taskId for status."
      });
    } catch (error) {
      console.error("Meshy generation error:", error);
      res.status(500).json({ error: "Failed to start model generation" });
    }
  });

  // Get task status
  app.get("/api/meshy/task/:taskId", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const task = await meshyService.getTaskStatus(req.params.taskId);
      res.json(task);
    } catch (error) {
      console.error("Meshy task status error:", error);
      res.status(500).json({ error: "Failed to get task status" });
    }
  });

  // Character generation endpoints
  app.get("/api/meshy/character-types", async (_req, res) => {
    const races = Object.keys(meshyService.RACE_PROMPTS);
    const classes = Object.keys(meshyService.CLASS_MODIFIERS);
    const hairColors = Object.keys(meshyService.HAIR_MODIFIERS);
    const builds = Object.keys(meshyService.BUILD_MODIFIERS);
    res.json({ races, classes, hairColors, builds });
  });

  // Generate character by race (simple)
  app.post("/api/meshy/generate-character", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const race = req.body.race || req.body.characterType || 'human';
      const racePrompts = meshyService.RACE_PROMPTS;
      const racePrompt = racePrompts[race.toLowerCase()] || racePrompts.human;
      
      // Generate T-pose character model
      const taskId = await meshyService.createCharacterModel({
        prompt: racePrompt.prompt,
        artStyle: racePrompt.artStyle,
        tPose: true,
        heightMeters: racePrompt.heightMeters
      });
      
      res.json({
        success: true,
        taskId,
        race,
        message: `${race} character generation started. Poll /api/meshy/task/:taskId for status, then use /api/meshy/rig/:taskId to auto-rig.`
      });
    } catch (error) {
      console.error("Meshy character generation error:", error);
      res.status(500).json({ error: "Failed to start character generation" });
    }
  });

  // Generate custom character with full customization (name, race, class, hair, build)
  app.post("/api/meshy/generate-custom-character", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const { name, race, characterClass, hairColor, build, additionalDetails } = req.body;
      
      if (!name || !race) {
        return res.status(400).json({ error: "Name and race are required" });
      }
      
      // Build custom prompt
      const customPrompt = meshyService.buildCharacterPrompt({
        name,
        race,
        characterClass,
        hairColor,
        build,
        additionalDetails
      });
      
      const raceConfig = meshyService.RACE_PROMPTS[race.toLowerCase()] || meshyService.RACE_PROMPTS.human;
      
      console.log(`Generating custom character "${name}" (${race} ${characterClass || 'adventurer'})`);
      console.log(`Prompt: ${customPrompt}`);
      
      const taskId = await meshyService.createCharacterModel({
        prompt: customPrompt,
        artStyle: raceConfig.artStyle,
        tPose: true,
        heightMeters: raceConfig.heightMeters
      });
      
      res.json({
        success: true,
        taskId,
        character: { name, race, characterClass, hairColor, build },
        prompt: customPrompt,
        message: `Custom character "${name}" generation started. Poll /api/meshy/task/:taskId for status.`
      });
    } catch (error) {
      console.error("Meshy custom character generation error:", error);
      res.status(500).json({ error: "Failed to start custom character generation" });
    }
  });

  // Generate just the captain face/head bust for quick unique model generation
  app.post("/api/meshy/generate-captain-head", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }

      const { name, race, characterClass, hairColor } = req.body;
      if (!name || !race) {
        return res.status(400).json({ error: "Name and race are required" });
      }

      const headPrompt = meshyService.buildCaptainHeadPrompt({ name, race, characterClass, hairColor });

      console.log(`Generating captain head for "${name}" (${race} ${characterClass || 'adventurer'})`);
      console.log(`Head prompt: ${headPrompt}`);

      const taskId = await meshyService.createTextTo3DPreview({
        prompt: headPrompt,
        artStyle: 'realistic',
        negativePrompt: 'body, torso, arms, legs, feet, full body, background scenery, landscape',
      });

      res.json({
        success: true,
        taskId,
        captain: { name, race, characterClass, hairColor },
        prompt: headPrompt,
        message: `Captain head generation started. Poll /api/meshy/task/${taskId} for status.`,
      });
    } catch (error) {
      console.error("Captain head generation error:", error);
      res.status(500).json({ error: "Failed to start captain head generation" });
    }
  });

  // ── Avatar upload (used by Meshy retexture flow) ───────────────────────────
  // Hardened: size cap, magic-byte validation, per-IP rate limit, TTL cleanup.
  const AVATAR_MAX_BYTES = 3 * 1024 * 1024;     // 3MB after decode
  const AVATAR_TTL_MS    = 24 * 60 * 60 * 1000; // 24h
  const AVATAR_RATE_LIMIT = 20;                 // uploads per IP per hour
  const AVATAR_RATE_WINDOW_MS = 60 * 60 * 1000;
  const avatarRateMap = new Map<string, { count: number; resetAt: number }>();

  function avatarMagicBytesOk(buf: Buffer, ext: string): boolean {
    if (ext === 'png')  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    if (ext === 'jpeg') return buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    if (ext === 'webp') return buf.length > 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    return false;
  }

  async function cleanupExpiredAvatars(dir: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const now = Date.now();
      const entries = await fs.readdir(dir);
      await Promise.all(entries.map(async (e) => {
        if (e === '.gitkeep' || !/\.(png|jpe?g|webp)$/i.test(e)) return;
        try {
          const full = path.join(dir, e);
          const st = await fs.stat(full);
          if (now - st.mtimeMs > AVATAR_TTL_MS) await fs.unlink(full);
        } catch { /* ignore individual file errors */ }
      }));
    } catch { /* ignore */ }
  }

  app.post("/api/meshy/upload-avatar", async (req, res) => {
    try {
      // Per-IP rate limit (sliding hour window).
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      const now = Date.now();
      const bucket = avatarRateMap.get(ip);
      if (!bucket || bucket.resetAt < now) {
        avatarRateMap.set(ip, { count: 1, resetAt: now + AVATAR_RATE_WINDOW_MS });
      } else {
        if (bucket.count >= AVATAR_RATE_LIMIT) {
          return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
        }
        bucket.count += 1;
      }

      const { dataUrl } = req.body as { dataUrl?: string };
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: "dataUrl is required" });
      }
      // Length sanity check before allocating Buffer (base64 ≈ 4/3 of bytes).
      if (dataUrl.length > Math.ceil(AVATAR_MAX_BYTES * 1.4) + 64) {
        return res.status(413).json({ error: "Image exceeds 3MB limit" });
      }
      const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
      if (!m) return res.status(400).json({ error: "Invalid data URL — expected image/{png,jpeg,webp} base64" });
      const ext = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length === 0 || buf.length > AVATAR_MAX_BYTES) {
        return res.status(413).json({ error: "Image exceeds 3MB limit" });
      }
      if (!avatarMagicBytesOk(buf, ext)) {
        return res.status(400).json({ error: "Image content does not match declared format" });
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const { randomUUID } = await import('crypto');
      const dir = path.resolve(import.meta.dirname, '..', 'public', 'avatars');
      await fs.mkdir(dir, { recursive: true });
      // Opportunistic cleanup of files older than TTL (best-effort, non-blocking).
      void cleanupExpiredAvatars(dir);

      const filename = `${randomUUID()}.${ext}`;
      await fs.writeFile(path.join(dir, filename), buf);

      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
      const host  = (req.headers['x-forwarded-host'] as string)?.split(',')[0] || req.get('host');
      const publicUrl = `${proto}://${host}/avatars/${filename}`;
      res.json({ success: true, url: publicUrl, filename, expiresInMs: AVATAR_TTL_MS });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ error: "Failed to upload avatar", details: error.message });
    }
  });

  // Retexture an existing head model using a prompt + optional avatar image.
  app.post("/api/meshy/retexture-head", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      const { modelUrl, objectPrompt, stylePrompt, textureImageUrl, race, characterClass, name } = req.body as {
        modelUrl?: string; objectPrompt?: string; stylePrompt?: string;
        textureImageUrl?: string; race?: string; characterClass?: string; name?: string;
      };
      if (!modelUrl) return res.status(400).json({ error: "modelUrl is required" });

      const obj = objectPrompt
        || `fantasy ${race || 'human'} ${characterClass || 'adventurer'} character head${name ? ` named ${name}` : ''}, head bust, face`;
      const style = stylePrompt
        || `match the provided portrait reference, painterly fantasy RPG game character art, detailed skin, expressive eyes, clean facial features`;

      const taskId = await meshyService.createTextToTexture({
        modelUrl,
        objectPrompt: obj,
        stylePrompt: style,
        textureImageUrl,
        artStyle: 'realistic',
        enablePbr: true,
      });
      res.json({
        success: true,
        taskId,
        message: `Retexture started. Poll /api/meshy/texture-task/${taskId} for status.`,
      });
    } catch (error: any) {
      console.error("Meshy retexture error:", error);
      res.status(500).json({ error: "Failed to start retexture", details: error.message });
    }
  });

  app.get("/api/meshy/texture-task/:taskId", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      const task = await meshyService.getTextureTaskStatus(req.params.taskId);
      res.json(task);
    } catch (error: any) {
      console.error("Texture task status error:", error);
      res.status(500).json({ error: "Failed to get texture task status", details: error.message });
    }
  });

  // Auto-rig a completed character model
  app.post("/api/meshy/rig/:taskId", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const heightMeters = req.body.heightMeters || 1.7;
      const riggingTaskId = await meshyService.rigCharacterByTaskId(req.params.taskId, heightMeters);
      
      res.json({
        success: true,
        taskId: riggingTaskId,
        message: "Auto-rigging started. Poll /api/meshy/rigging-task/:taskId for status and animation URLs."
      });
    } catch (error) {
      console.error("Meshy rigging error:", error);
      res.status(500).json({ error: "Failed to start auto-rigging" });
    }
  });

  // Get rigging task status (includes animation URLs when complete)
  app.get("/api/meshy/rigging-task/:taskId", async (req, res) => {
    try {
      if (!meshyService.isMeshyConfigured()) {
        return res.status(400).json({ error: "Meshy API key not configured" });
      }
      
      const task = await meshyService.getRiggingTaskStatus(req.params.taskId);
      res.json(task);
    } catch (error) {
      console.error("Meshy rigging task status error:", error);
      res.status(500).json({ error: "Failed to get rigging task status" });
    }
  });

  // Get all Aseprite animation data
  app.get("/api/sprites/aseprite", (_req, res) => {
    try {
      const allData = getAllAsepriteData();
      const result: Record<string, any> = {};
      allData.forEach((value, key) => {
        result[key] = value;
      });
      res.json(result);
    } catch (error) {
      console.error("Aseprite data error:", error);
      res.status(500).json({ error: "Failed to get Aseprite data" });
    }
  });

  // Get specific character Aseprite data
  app.get("/api/sprites/aseprite/:character", (req, res) => {
    try {
      const filename = `${req.params.character}.aseprite`;
      const data = parseAsepriteFile(filename);
      if (!data) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(data);
    } catch (error) {
      console.error("Aseprite parse error:", error);
      res.status(500).json({ error: "Failed to parse Aseprite file" });
    }
  });

  // Admin: Save object edits
  app.post("/api/admin/save-edits", (req, res) => {
    try {
      const { edits } = req.body;
      if (!Array.isArray(edits)) {
        return res.status(400).json({ error: "Invalid edits data" });
      }
      
      // Store edits in memory (could persist to file/DB later)
      console.log(`Admin: Saving ${edits.length} object edits`);
      edits.forEach((edit: any) => {
        console.log(`  - ${edit.name} (${edit.type}): pos(${edit.position?.x?.toFixed(2)}, ${edit.position?.y?.toFixed(2)}, ${edit.position?.z?.toFixed(2)})`);
      });
      
      res.json({ success: true, savedCount: edits.length });
    } catch (error) {
      console.error("Admin save error:", error);
      res.status(500).json({ error: "Failed to save edits" });
    }
  });

  // ========== AI CHAT ROUTES ==========
  registerChatRoutes(app);

  return httpServer;
}
