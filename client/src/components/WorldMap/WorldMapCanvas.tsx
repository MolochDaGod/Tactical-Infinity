import { useRef, useEffect, useState, useCallback } from "react";
import type { WorldMapState, WorldIsland, NpcShip, FloatingLoot, FishingSpot } from "@shared/schema";
import { WORLD_MAP_CONFIG, clampValue } from "@shared/schema";
import {
  initializeWorldMapState,
  updatePlayerMovement,
  handleIslandCollisions,
  updateCamera,
  updateNpcShipAI,
  updateCannonballs,
  spawnCannonball,
  generateLoot,
  collectLoot,
  updateCombatState,
  tryFishing,
} from "@/lib/worldMapSystem";

const CONFIG = WORLD_MAP_CONFIG;

interface WorldMapCanvasProps {
  onLandOnIsland?: (island: WorldIsland) => void;
  playerName?: string;
}

export function WorldMapCanvas({ onLandOnIsland, playerName = "Captain" }: WorldMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<WorldMapState>(() => initializeWorldMapState(playerName));
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [npcAggressionTimers, setNpcAggressionTimers] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isFishing, setIsFishing] = useState(false);
  const lastTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number>();

  const addNotification = useCallback((msg: string) => {
    setNotifications(prev => [...prev.slice(-4), msg]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      
      if (e.key.toLowerCase() === "f" && !isFishing) {
        setIsFishing(true);
        setTimeout(() => setIsFishing(false), 1000);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isFishing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left + gameState.camera.x,
        y: e.clientY - rect.top + gameState.camera.y,
      });
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left + gameState.camera.x;
      const clickY = e.clientY - rect.top + gameState.camera.y;

      let clickedNpc: string | null = null;
      for (const ship of gameState.npcShips) {
        const dist = Math.hypot(clickX - ship.x, clickY - ship.y);
        if (dist <= ship.size + 20) {
          clickedNpc = ship.id;
          break;
        }
      }
      setSelectedNpc(clickedNpc);

      if (gameState.playerShip.cannonCooldown <= 0) {
        const newBall = spawnCannonball(gameState.playerShip, clickX, clickY, true);
        setGameState(prev => ({
          ...prev,
          cannonballs: [...prev.cannonballs, newBall],
          playerShip: { ...prev.playerShip, cannonCooldown: CONFIG.CANNON_COOLDOWN },
        }));
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [gameState.camera, gameState.playerShip, gameState.npcShips]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    if (isFishing) {
      const result = tryFishing(gameState.playerShip, gameState.fishingSpots, gameState.fishingXp);
      if (result.success) {
        addNotification(`Caught ${result.fishType}! +${result.xpGained} XP`);
        setGameState(prev => ({
          ...prev,
          fishingXp: result.newXp,
          inventory: {
            ...prev.inventory,
            fish: (prev.inventory.fish || 0) + 1,
          },
        }));
      }
    }
  }, [isFishing, gameState.playerShip, gameState.fishingSpots, gameState.fishingXp, addNotification]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = (timestamp: number) => {
      const dt = Math.min(1 / 15, (timestamp - lastTimeRef.current) / 16.666);
      lastTimeRef.current = timestamp;

      setGameState(prev => {
        let updatedPlayer = updatePlayerMovement(prev.playerShip, keys, dt);
        const { player: collidedPlayer, nearIsland } = handleIslandCollisions(updatedPlayer, prev.islands);
        updatedPlayer = collidedPlayer;

        const newCamera = updateCamera(prev.camera, updatedPlayer, canvas.width, canvas.height);

        let newNpcShips = [...prev.npcShips];
        let newCannonballs = [...prev.cannonballs];
        const updatedAggroTimers = { ...npcAggressionTimers };

        for (let i = 0; i < newNpcShips.length; i++) {
          const aggroTime = updatedAggroTimers[newNpcShips[i].id] || 0;
          const { ship: updatedNpc, newCannonball } = updateNpcShipAI(
            newNpcShips[i],
            updatedPlayer,
            dt,
            newCannonballs,
            aggroTime
          );
          newNpcShips[i] = updatedNpc;
          if (newCannonball) {
            newCannonballs.push(newCannonball);
          }
          if (aggroTime > 0) {
            updatedAggroTimers[newNpcShips[i].id] = aggroTime - dt;
          }
        }

        const { cannonballs: ballsAfterUpdate, playerHit, npcHits } = updateCannonballs(
          newCannonballs,
          updatedPlayer,
          newNpcShips,
          dt
        );

        let justInCombat = false;
        let newFloatingLoot = [...prev.floatingLoot];
        let newCombatXp = prev.combatXp;

        if (playerHit) {
          updatedPlayer = { ...updatedPlayer, hp: updatedPlayer.hp - playerHit.damage };
          justInCombat = true;
          if (updatedPlayer.hp <= 0) {
            updatedPlayer = {
              ...updatedPlayer,
              x: CONFIG.MAP_WIDTH / 2,
              y: CONFIG.MAP_HEIGHT / 2,
              hp: updatedPlayer.maxHp,
            };
            addNotification("Your ship was destroyed! Respawning...");
          }
        }

        for (const hit of npcHits) {
          justInCombat = true;
          const npcIndex = newNpcShips.findIndex(s => s.id === hit.shipId);
          if (npcIndex !== -1) {
            const npc = newNpcShips[npcIndex];
            npc.hp -= hit.damage;
            updatedAggroTimers[npc.id] = 15;
            
            if (npc.hp <= 0) {
              const loot = generateLoot(npc);
              newFloatingLoot.push(...loot);
              newCombatXp += 100 + npc.level * 50;
              addNotification(`Defeated ${npc.name}! +${100 + npc.level * 50} XP`);
              
              npc.x = Math.random() * (CONFIG.MAP_WIDTH - 200) + 100;
              npc.y = Math.random() * (CONFIG.MAP_HEIGHT - 200) + 100;
              npc.hp = npc.maxHp;
              npc.state = "patrol";
            }
          }
        }

        setNpcAggressionTimers(updatedAggroTimers);

        const { loot: remainingLoot, inventory: newInventory, gold: newGold, collected } = collectLoot(
          updatedPlayer,
          newFloatingLoot,
          prev.inventory,
          prev.gold
        );
        
        for (const item of collected) {
          if (item.type === "gold") {
            addNotification(`Collected ${item.amount} gold!`);
          } else {
            addNotification(`Collected ${item.amount} ${item.type}!`);
          }
        }

        const newCombatState = updateCombatState(prev.combatState, nearIsland, justInCombat);

        const newIslands = prev.islands.map(island => {
          if (nearIsland && island.id === nearIsland.id && !island.isDiscovered) {
            addNotification(`Discovered ${island.name}!`);
            return { ...island, isDiscovered: true };
          }
          return island;
        });

        return {
          ...prev,
          playerShip: updatedPlayer,
          npcShips: newNpcShips,
          cannonballs: ballsAfterUpdate,
          floatingLoot: remainingLoot,
          camera: newCamera,
          combatState: newCombatState,
          islands: newIslands,
          inventory: newInventory,
          gold: newGold,
          combatXp: newCombatXp,
        };
      });

      renderGame(ctx, canvas);
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [keys, addNotification, npcAggressionTimers]);

  const renderGame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const { camera, playerShip, npcShips, islands, cannonballs, floatingLoot, fishingSpots } = gameState;

    ctx.save();
    ctx.fillStyle = "#0a2b45";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(-camera.x, -camera.y);

    const tile = 200;
    ctx.fillStyle = "rgba(10,25,50,0.25)";
    for (let x = 0; x < CONFIG.MAP_WIDTH; x += tile) {
      ctx.fillRect(x, 0, 2, CONFIG.MAP_HEIGHT);
    }
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y += tile) {
      ctx.fillRect(0, y, CONFIG.MAP_WIDTH, 2);
    }

    for (const spot of fishingSpots) {
      if (!spot.isActive) continue;
      ctx.fillStyle = "rgba(100,200,255,0.3)";
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(100,200,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const island of islands) {
      const grad = ctx.createLinearGradient(
        island.x - island.radius,
        island.y - island.radius,
        island.x + island.radius,
        island.y + island.radius
      );
      
      const biomeColors: Record<string, [string, string]> = {
        temperate: ["#4a7c59", "#2d5016"],
        tropical: ["#7cb342", "#558b2f"],
        arctic: ["#b0bec5", "#78909c"],
        desert: ["#d4a053", "#a67c00"],
        volcanic: ["#5d4037", "#3e2723"],
        mountain: ["#757575", "#424242"],
      };
      const [c1, c2] = biomeColors[island.biome] || biomeColors.temperate;
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.ellipse(island.x, island.y, island.radius, island.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#b78f4c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(island.x, island.y, island.radius + 5, island.radius * 0.7 + 5, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (island.hasPort) {
        ctx.fillStyle = "#6d4c41";
        ctx.fillRect(island.x + island.radius - 10, island.y - 5, 30, 10);
      }

      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(island.name, island.x, island.y - island.radius - 10);
      ctx.fillText(island.name, island.x, island.y - island.radius - 10);
    }

    for (const loot of floatingLoot) {
      ctx.fillStyle = loot.type === "gold" ? "#ffd700" : "#8b4513";
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const ship of npcShips) {
      if (selectedNpc === ship.id) {
        ctx.save();
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      drawShip(ctx, ship.x, ship.y, ship.dir, "#ff5252", ship.size);
      drawNameAndBar(ctx, ship.x, ship.y - ship.size - 6, ship.name, ship.level, (ship.hp / ship.maxHp) * 100);
    }

    drawShip(ctx, playerShip.x, playerShip.y, playerShip.angle, "#ffd700", 64);
    drawNameAndBar(ctx, playerShip.x, playerShip.y - 70, playerShip.name, playerShip.level, (playerShip.hp / playerShip.maxHp) * 100);

    if (playerShip.cannonCooldown <= 0) {
      ctx.strokeStyle = "rgba(255,100,100,0.4)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playerShip.x, playerShip.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const ball of cannonballs) {
      const shadowAlpha = clampValue(1 - ball.z / 150, 0.25, 0.85);
      const shadowSize = 6 + (1 - clampValue(ball.z / 150, 0, 1)) * 8;
      ctx.fillStyle = `rgba(0,0,0,${0.35 * shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(ball.x, ball.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#222";
      const scale = 1 + ball.z / 120;
      const size = Math.max(3, Math.round(4 * scale));
      ctx.beginPath();
      ctx.arc(ball.x, ball.y - Math.max(0, ball.z), size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [gameState, selectedNpc, mousePos]);

  const handleLand = useCallback(() => {
    if (gameState.combatState.canLand && gameState.combatState.nearIslandId) {
      const island = gameState.islands.find(i => i.id === gameState.combatState.nearIslandId);
      if (island && onLandOnIsland) {
        onLandOnIsland(island);
      }
    }
  }, [gameState.combatState, gameState.islands, onLandOnIsland]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        data-testid="canvas-world-map"
      />
      
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-md space-y-2" data-testid="panel-hud">
        <div className="flex items-center gap-2">
          <span className="font-bold">{gameState.playerShip.name}</span>
          <span className="text-sm text-muted-foreground">Lv.{gameState.playerShip.level}</span>
        </div>
        <div className="w-48">
          <div className="text-xs mb-1">HP: {Math.round(gameState.playerShip.hp)}/{gameState.playerShip.maxHp}</div>
          <div className="h-3 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(gameState.playerShip.hp / gameState.playerShip.maxHp) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-sm">Gold: {gameState.gold}</div>
        <div className="text-sm">Combat XP: {gameState.combatXp}</div>
        <div className="text-sm">Fishing XP: {gameState.fishingXp}</div>
        {gameState.playerShip.cannonCooldown > 0 && (
          <div className="text-xs text-yellow-400">Reloading...</div>
        )}
      </div>

      <div className="absolute top-4 right-4 bg-black/70 text-white p-3 rounded-md text-xs" data-testid="panel-controls">
        <div className="font-bold mb-2">Controls</div>
        <div>WASD - Move</div>
        <div>Click - Fire cannon</div>
        <div>F - Fish (near spots)</div>
        <div>Click ship - Select target</div>
      </div>

      {notifications.length > 0 && (
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 space-y-2" data-testid="panel-notifications">
          {notifications.map((msg, i) => (
            <div key={i} className="bg-black/80 text-yellow-400 px-4 py-2 rounded-md text-sm animate-pulse">
              {msg}
            </div>
          ))}
        </div>
      )}

      {gameState.combatState.canLand && gameState.combatState.nearIslandId && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2" data-testid="panel-land">
          <button
            onClick={handleLand}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
            data-testid="button-land"
          >
            Land on {gameState.islands.find(i => i.id === gameState.combatState.nearIslandId)?.name}
          </button>
        </div>
      )}

      {gameState.combatState.nearIslandId && !gameState.combatState.canLand && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-md" data-testid="text-combat-delay">
          {gameState.combatState.inCombat ? "In Combat - Cannot Land" : "Wait 3 seconds to land..."}
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-black/70 text-white p-3 rounded-md" data-testid="panel-minimap">
        <div className="font-bold text-xs mb-2">Minimap</div>
        <div className="w-32 h-32 bg-blue-900/50 rounded relative border border-blue-500/50">
          <div
            className="absolute w-2 h-2 bg-yellow-400 rounded-full"
            style={{
              left: `${(gameState.playerShip.x / CONFIG.MAP_WIDTH) * 100}%`,
              top: `${(gameState.playerShip.y / CONFIG.MAP_HEIGHT) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
          {gameState.islands.filter(i => i.isDiscovered).map(island => (
            <div
              key={island.id}
              className="absolute w-1.5 h-1.5 bg-green-500 rounded-full"
              style={{
                left: `${(island.x / CONFIG.MAP_WIDTH) * 100}%`,
                top: `${(island.y / CONFIG.MAP_HEIGHT) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
          {gameState.npcShips.map(ship => (
            <div
              key={ship.id}
              className="absolute w-1 h-1 bg-red-500 rounded-full"
              style={{
                left: `${(ship.x / CONFIG.MAP_WIDTH) * 100}%`,
                top: `${(ship.y / CONFIG.MAP_HEIGHT) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, size * 0.6);
  ctx.lineTo(-size * 0.6, -size * 0.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = "#6d4c41";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, -size * 0.4);
  ctx.lineTo(-size * 0.2, size * 0.4);
  ctx.stroke();

  ctx.fillStyle = "#f5f5dc";
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, -size * 0.4);
  ctx.lineTo(size * 0.3, -size * 0.1);
  ctx.lineTo(-size * 0.2, size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawNameAndBar(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, level: number, healthPct: number) {
  const barW = 80;
  const barH = 8;

  ctx.save();
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(`${name} (Lv ${level})`, x, y - 10);
  ctx.fillStyle = "#fff";
  ctx.fillText(`${name} (Lv ${level})`, x, y - 10);

  const bx = x - barW / 2;
  const by = y;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);

  const pct = clampValue(healthPct, 0, 100) / 100;
  const fillW = Math.round(barW * pct);
  const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
  grad.addColorStop(0, "#43a047");
  grad.addColorStop(1, "#c62828");
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, fillW, barH);

  ctx.strokeStyle = "#ffffff33";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);
  ctx.restore();
}
