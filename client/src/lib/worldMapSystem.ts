import type {
  PlayerShip,
  NpcShip,
  WorldIsland,
  Cannonball,
  FloatingLoot,
  FishingSpot,
  CombatState,
  WorldMapState,
  LootType,
} from "@shared/schema";
import {
  WORLD_MAP_CONFIG,
  PIRATE_NAMES,
  SHIP_TIER_STATS,
  generateLootTable,
  distanceBetween,
  clampValue,
  biomeTypes,
} from "@shared/schema";

const CONFIG = WORLD_MAP_CONFIG;

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createPlayerShip(name: string = "Captain"): PlayerShip {
  const stats = SHIP_TIER_STATS.sloop;
  return {
    id: `player_${randomId()}`,
    name,
    type: "sloop",
    x: CONFIG.MAP_WIDTH / 2,
    y: CONFIG.MAP_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    level: 1,
    cannonCooldown: 0,
    cargoCapacity: stats.cargoCapacity,
    speed: stats.speed,
    cannonDamage: stats.cannonDamage,
    cannonRange: stats.cannonRange,
  };
}

export function generateNpcShips(count: number = CONFIG.NUM_NPC_SHIPS): NpcShip[] {
  const ships: NpcShip[] = [];
  for (let i = 0; i < count; i++) {
    const level = Math.max(1, Math.round(rand(1, 8)));
    const maxHp = 30 + level * 20;
    ships.push({
      id: `npc_${randomId()}`,
      name: PIRATE_NAMES[i % PIRATE_NAMES.length],
      type: level <= 2 ? "sloop" : level <= 4 ? "brigantine" : level <= 6 ? "galleon" : "warship",
      x: rand(100, CONFIG.MAP_WIDTH - 100),
      y: rand(100, CONFIG.MAP_HEIGHT - 100),
      dir: rand(0, Math.PI * 2),
      speed: rand(20, 60) / 100,
      hp: maxHp,
      maxHp,
      level,
      size: Math.round(rand(18, 42)),
      state: "patrol",
      stateTimer: rand(1, 4),
      aggroRange: 400 + level * 20,
      attackRange: 260 + level * 10,
      cannonCooldown: 0,
      lootTable: generateLootTable(level),
    });
  }
  return ships;
}

export function generateIslands(count: number = CONFIG.NUM_ISLANDS): WorldIsland[] {
  const islands: WorldIsland[] = [];
  const biomes = [...biomeTypes];
  
  const islandNames = [
    "Skull Isle", "Tortuga", "Port Royal", "Dead Man's Cove", "Treasure Bay",
    "Serpent's Reef", "Blackbeard's Haven", "Storm's End", "Crystal Shores", "Dragon's Tooth",
    "Moonlight Atoll", "Thunder Peak", "Coral Kingdom", "Shadow Bay", "Golden Sands",
    "Mystic Cove", "Pirate's Rest", "Kraken's Lair", "Emerald Isle", "Skeleton Key",
  ];

  for (let i = 0; i < count; i++) {
    const radius = rand(60, 150);
    let x = rand(radius + 50, CONFIG.MAP_WIDTH - radius - 50);
    let y = rand(radius + 50, CONFIG.MAP_HEIGHT - radius - 50);
    
    let attempts = 0;
    while (attempts < 20) {
      let valid = true;
      for (const existing of islands) {
        const dist = distanceBetween(x, y, existing.x, existing.y);
        if (dist < radius + existing.radius + 100) {
          valid = false;
          break;
        }
      }
      if (valid) break;
      x = rand(radius + 50, CONFIG.MAP_WIDTH - radius - 50);
      y = rand(radius + 50, CONFIG.MAP_HEIGHT - radius - 50);
      attempts++;
    }

    const biome = biomes[Math.floor(rand(0, biomes.length))];
    const resources: WorldIsland["resources"] = [];
    
    if (biome === "temperate" || biome === "tropical") {
      resources.push("wood", "herbs");
    }
    if (biome === "mountain" || biome === "volcanic") {
      resources.push("ore", "stone", "crystal");
    }
    if (biome === "arctic" || biome === "desert") {
      resources.push("gold");
    }
    resources.push("fish");

    islands.push({
      id: `island_${randomId()}`,
      name: islandNames[i % islandNames.length] + (i >= islandNames.length ? ` ${Math.floor(i / islandNames.length) + 1}` : ""),
      x,
      y,
      radius,
      biome,
      isDiscovered: false,
      isOwned: false,
      resources,
      hasPort: rand(0, 1) > 0.7,
      dockPosition: { x: x + radius + 20, y },
    });
  }
  return islands;
}

export function generateFishingSpots(islands: WorldIsland[]): FishingSpot[] {
  const spots: FishingSpot[] = [];
  
  for (let i = 0; i < 30; i++) {
    const tier = Math.ceil(rand(1, 5));
    spots.push({
      id: `fish_${randomId()}`,
      x: rand(100, CONFIG.MAP_WIDTH - 100),
      y: rand(100, CONFIG.MAP_HEIGHT - 100),
      tier,
      isActive: true,
      fishTypes: tier <= 2 ? ["cod", "herring", "mackerel"] : tier <= 4 ? ["tuna", "salmon", "swordfish"] : ["legendary_kraken_bait", "golden_fish"],
      xpReward: 10 * tier,
    });
  }
  return spots;
}

export function initializeWorldMapState(playerName: string = "Captain"): WorldMapState {
  const islands = generateIslands();
  return {
    playerShip: createPlayerShip(playerName),
    npcShips: generateNpcShips(),
    islands,
    cannonballs: [],
    floatingLoot: [],
    fishingSpots: generateFishingSpots(islands),
    camera: { x: 0, y: 0 },
    combatState: {
      inCombat: false,
      lastCombatTime: 0,
      canLand: false,
    },
    inventory: {},
    gold: 100,
    fishingXp: 0,
    combatXp: 0,
  };
}

export function updatePlayerMovement(
  player: PlayerShip,
  keys: Record<string, boolean>,
  dt: number
): PlayerShip {
  const speedMultiplier = Math.max(1, 2 - player.level * 0.08);
  const speed = CONFIG.PLAYER_ACCELERATION * speedMultiplier * 200 * player.speed;

  let moveX = 0;
  let moveY = 0;

  if (keys["w"] || keys["arrowup"]) moveY = -1;
  if (keys["s"] || keys["arrowdown"]) moveY = 1;
  if (keys["a"] || keys["arrowleft"]) moveX = -1;
  if (keys["d"] || keys["arrowright"]) moveX = 1;

  if (moveX !== 0 && moveY !== 0) {
    const len = Math.sqrt(moveX * moveX + moveY * moveY);
    moveX /= len;
    moveY /= len;
  }

  let newVx = player.vx;
  let newVy = player.vy;
  let newAngle = player.angle;

  if (moveX !== 0 || moveY !== 0) {
    newVx = moveX * speed * dt;
    newVy = moveY * speed * dt;
    newAngle = Math.atan2(moveY, moveX);
  } else {
    newVx *= 0.85;
    newVy *= 0.85;
  }

  let newX = player.x + newVx * dt;
  let newY = player.y + newVy * dt;

  newX = clampValue(newX, 0, CONFIG.MAP_WIDTH);
  newY = clampValue(newY, 0, CONFIG.MAP_HEIGHT);

  return {
    ...player,
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
    angle: newAngle,
    cannonCooldown: Math.max(0, player.cannonCooldown - dt),
  };
}

export function handleIslandCollisions(
  player: PlayerShip,
  islands: WorldIsland[]
): { player: PlayerShip; nearIsland: WorldIsland | null } {
  let nearIsland: WorldIsland | null = null;
  let updatedPlayer = { ...player };

  for (const island of islands) {
    const dx = player.x - island.x;
    const dy = player.y - island.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < island.radius + 80) {
      nearIsland = island;
    }

    if (dist < island.radius + 12) {
      const desiredDist = island.radius + 14;
      if (dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        updatedPlayer.x = island.x + nx * desiredDist;
        updatedPlayer.y = island.y + ny * desiredDist;
      } else {
        const ang = Math.random() * Math.PI * 2;
        updatedPlayer.x = island.x + Math.cos(ang) * desiredDist;
        updatedPlayer.y = island.y + Math.sin(ang) * desiredDist;
      }
      updatedPlayer.vx *= 0.2;
      updatedPlayer.vy *= 0.2;
    }
  }

  return { player: updatedPlayer, nearIsland };
}

export function updateCamera(
  camera: { x: number; y: number },
  player: PlayerShip,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: clampValue(player.x - canvasWidth / 2, 0, CONFIG.MAP_WIDTH - canvasWidth),
    y: clampValue(player.y - canvasHeight / 2, 0, CONFIG.MAP_HEIGHT - canvasHeight),
  };
}

export function spawnCannonball(
  owner: PlayerShip | NpcShip,
  targetX: number,
  targetY: number,
  isPlayer: boolean
): Cannonball {
  const ox = owner.x;
  const oy = owner.y;
  const dx = targetX - ox;
  const dy = targetY - oy;
  const dist = Math.hypot(dx, dy);
  const horizSpeed = Math.max(60, 300);

  const travelTime = clampValue(dist / horizSpeed, 0.5, 3.0);
  const initZ = 40 + Math.min(80, dist * 0.03);
  const vz = (initZ + 0.5 * CONFIG.GRAVITY * travelTime * travelTime) / travelTime;

  const vx = dx / travelTime;
  const vy = dy / travelTime;

  const damage = isPlayer
    ? (owner as PlayerShip).cannonDamage + (owner.level || 1) * 4
    : 20 + ((owner as NpcShip).level || 1) * 4;

  return {
    id: `ball_${randomId()}`,
    x: ox,
    y: oy,
    z: initZ,
    vx,
    vy,
    vz,
    ownerId: isPlayer ? "player" : owner.id,
    damage,
    travelTime: 0,
  };
}

export function updateNpcShipAI(
  ship: NpcShip,
  player: PlayerShip,
  dt: number,
  cannonballs: Cannonball[],
  aggressionTimer: number
): { ship: NpcShip; newCannonball: Cannonball | null } {
  let updatedShip = { ...ship };
  updatedShip.cannonCooldown = Math.max(0, updatedShip.cannonCooldown - dt);
  updatedShip.stateTimer = (updatedShip.stateTimer || 0) - dt;

  const dx = player.x - ship.x;
  const dy = player.y - ship.y;
  const dist = Math.hypot(dx, dy);
  const angleToPlayer = Math.atan2(dy, dx);
  const desiredDist = clampValue(220 + (6 - (ship.level || 1)) * 8, 140, 320);
  const wasHitRecently = aggressionTimer > 0;

  if (dist < ship.aggroRange) {
    if (wasHitRecently) {
      updatedShip.state = dist <= ship.attackRange ? "attack" : "chase";
    } else {
      updatedShip.state = "hold";
    }
  } else {
    if (updatedShip.stateTimer <= 0) {
      updatedShip.state = "patrol";
      updatedShip.stateTimer = rand(2, 6);
    }
  }

  let newCannonball: Cannonball | null = null;

  if (updatedShip.state === "hold") {
    updatedShip.dir = angleToPlayer;
  } else if (updatedShip.state === "patrol") {
    updatedShip.dir += rand(-0.02, 0.02) * dt;
    updatedShip.x += Math.cos(updatedShip.dir) * updatedShip.speed * dt * 40;
    updatedShip.y += Math.sin(updatedShip.dir) * updatedShip.speed * dt * 40;
  } else if (updatedShip.state === "chase") {
    const flankAngle = angleToPlayer + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
    const tx = player.x + Math.cos(flankAngle) * desiredDist;
    const ty = player.y + Math.sin(flankAngle) * desiredDist;
    const angToTarget = Math.atan2(ty - ship.y, tx - ship.x);
    updatedShip.dir = angToTarget;
    updatedShip.x += Math.cos(updatedShip.dir) * updatedShip.speed * dt * 80;
    updatedShip.y += Math.sin(updatedShip.dir) * updatedShip.speed * dt * 80;
  } else if (updatedShip.state === "attack") {
    const circlePhase = (Date.now() / 1000) % (Math.PI * 2);
    const circX = player.x + Math.cos(circlePhase) * desiredDist;
    const circY = player.y + Math.sin(circlePhase) * desiredDist;
    const angToCirc = Math.atan2(circY - ship.y, circX - ship.x);
    updatedShip.dir = angToCirc;
    updatedShip.x += Math.cos(updatedShip.dir) * updatedShip.speed * dt * 60;
    updatedShip.y += Math.sin(updatedShip.dir) * updatedShip.speed * dt * 60;

    if (dist < desiredDist - 20) {
      updatedShip.x -= Math.cos(angleToPlayer) * updatedShip.speed * dt * 30;
      updatedShip.y -= Math.sin(angleToPlayer) * updatedShip.speed * dt * 30;
    }

    const angDiff = Math.abs(((updatedShip.dir - angleToPlayer) + Math.PI) % (Math.PI * 2) - Math.PI);
    if (updatedShip.cannonCooldown <= 0 && angDiff > 0.25 && angDiff < 1.6) {
      newCannonball = spawnCannonball(updatedShip, player.x, player.y, false);
      updatedShip.cannonCooldown = 1.4 - Math.min(0.9, (updatedShip.level || 1) * 0.04);
    }
  }

  const keepaway = 40 + (updatedShip.size || 24);
  if (dist < keepaway) {
    updatedShip.x -= (dx / (dist || 1)) * (keepaway - dist) * 0.6;
    updatedShip.y -= (dy / (dist || 1)) * (keepaway - dist) * 0.6;
  }

  updatedShip.x = clampValue(updatedShip.x, 0, CONFIG.MAP_WIDTH);
  updatedShip.y = clampValue(updatedShip.y, 0, CONFIG.MAP_HEIGHT);

  return { ship: updatedShip, newCannonball };
}

export function updateCannonballs(
  cannonballs: Cannonball[],
  player: PlayerShip,
  npcShips: NpcShip[],
  dt: number
): {
  cannonballs: Cannonball[];
  playerHit: { damage: number } | null;
  npcHits: { shipId: string; damage: number }[];
} {
  const updatedBalls: Cannonball[] = [];
  let playerHit: { damage: number } | null = null;
  const npcHits: { shipId: string; damage: number }[] = [];

  for (const ball of cannonballs) {
    const newBall = { ...ball };
    newBall.x += newBall.vx * dt * 60;
    newBall.y += newBall.vy * dt * 60;
    newBall.vz -= CONFIG.GRAVITY * dt * 60;
    newBall.z += newBall.vz * dt * 60;
    newBall.travelTime += dt;

    if (newBall.z <= 0) {
      const hitRadius = 28;

      const pd = Math.hypot(newBall.x - player.x, newBall.y - player.y);
      if (pd <= hitRadius && newBall.ownerId !== "player") {
        playerHit = { damage: newBall.damage };
        continue;
      }

      for (const ship of npcShips) {
        const sd = Math.hypot(newBall.x - ship.x, newBall.y - ship.y);
        if (sd <= hitRadius && newBall.ownerId === "player") {
          npcHits.push({ shipId: ship.id, damage: newBall.damage });
          break;
        }
      }
      continue;
    }

    updatedBalls.push(newBall);
  }

  return { cannonballs: updatedBalls, playerHit, npcHits };
}

export function generateLoot(ship: NpcShip): FloatingLoot[] {
  const loot: FloatingLoot[] = [];
  const table = ship.lootTable || generateLootTable(ship.level);

  for (const item of table) {
    if (Math.random() <= item.chance) {
      const amount = Math.floor(rand(item.minAmount, item.maxAmount + 1));
      loot.push({
        id: `loot_${randomId()}`,
        x: ship.x + rand(-30, 30),
        y: ship.y + rand(-30, 30),
        type: item.type,
        amount,
        expiresAt: Date.now() + 60000,
      });
    }
  }

  return loot;
}

export function collectLoot(
  player: PlayerShip,
  loot: FloatingLoot[],
  inventory: Record<string, number>,
  gold: number
): { loot: FloatingLoot[]; inventory: Record<string, number>; gold: number; collected: FloatingLoot[] } {
  const remaining: FloatingLoot[] = [];
  const collected: FloatingLoot[] = [];
  let newInventory = { ...inventory };
  let newGold = gold;

  for (const item of loot) {
    const dist = distanceBetween(player.x, player.y, item.x, item.y);
    if (dist < 50) {
      if (item.type === "gold") {
        newGold += item.amount;
      } else {
        newInventory[item.type] = (newInventory[item.type] || 0) + item.amount;
      }
      collected.push(item);
    } else if (Date.now() < item.expiresAt) {
      remaining.push(item);
    }
  }

  return { loot: remaining, inventory: newInventory, gold: newGold, collected };
}

export function tryFishing(
  player: PlayerShip,
  fishingSpots: FishingSpot[],
  currentXp: number
): { success: boolean; fishType: string | null; xpGained: number; newXp: number } {
  for (const spot of fishingSpots) {
    if (!spot.isActive) continue;
    const dist = distanceBetween(player.x, player.y, spot.x, spot.y);
    if (dist < 60) {
      const fishType = spot.fishTypes[Math.floor(Math.random() * spot.fishTypes.length)];
      const xpGained = spot.xpReward;
      return {
        success: true,
        fishType,
        xpGained,
        newXp: currentXp + xpGained,
      };
    }
  }
  return { success: false, fishType: null, xpGained: 0, newXp: currentXp };
}

export function updateCombatState(
  combatState: CombatState,
  nearIsland: WorldIsland | null,
  justInCombat: boolean
): CombatState {
  const now = Date.now();
  const newState = { ...combatState };

  if (justInCombat) {
    newState.inCombat = true;
    newState.lastCombatTime = now;
    newState.canLand = false;
  } else {
    const timeSinceCombat = now - newState.lastCombatTime;
    if (timeSinceCombat >= CONFIG.ISLAND_LAND_COMBAT_DELAY) {
      newState.inCombat = false;
    }
  }

  if (nearIsland) {
    newState.nearIslandId = nearIsland.id;
    newState.canLand = !newState.inCombat && (now - newState.lastCombatTime >= CONFIG.ISLAND_LAND_COMBAT_DELAY);
  } else {
    newState.nearIslandId = undefined;
    newState.canLand = false;
  }

  return newState;
}
