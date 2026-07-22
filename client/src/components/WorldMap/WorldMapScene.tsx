import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeWorldMapManager, CameraMode, Island3D, WindState, TargetInfo } from '@/lib/threeWorldMapManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Camera, Crosshair, Heart, Coins, Anchor, Fish, Swords, Target, Ship, MapPin, Gem, Settings, User, Pause, Play } from 'lucide-react';
import { ShipTestingPanel } from '@/components/game/ShipTestingPanel';
import { FishingSettingsPanel } from '@/components/game/FishingSettingsPanel';
import { AdminPanel, type GizmoMode, type EditableObject } from '@/components/game/AdminPanel';
import { WorldMapOverlay } from '@/components/WorldMap/WorldMapOverlay';
import { Minimap } from '@/components/game/Minimap';
import { type SlotDef, type VitalBarDef } from '@/components/game/GameHUD';
import { SailingHUD } from '@/components/game/SailingHUD';
import { useToast } from '@/hooks/use-toast';
import type { Race } from '@shared/schema';
import { WORLD_ISLANDS, WORLD_ENEMY_SHIPS, type WorldIslandData, type EnemyShipData } from '@/lib/worldMapData';
import { globalWeather } from '@/lib/weatherSystem';
import { decorateStartingArea, IntroCinematic, type StartingArea } from '@/lib/worldMapStartingArea';
import { resolvePlayerBoatId } from '@/lib/captainBuild';
import { preloadSailingBoats } from '@/lib/boatAssetLoader';

interface WorldMapSceneProps {
  onBackToMenu: () => void;
  onLandOnIsland?: (islandId: string) => void;
}

interface AbilityState {
  id: string;
  name: string;
  cooldown: number;
  maxCooldown: number;
  key: string;
}

interface HUDState {
  playerHealth: number;
  playerMaxHealth: number;
  gold: number;
  combatXP: number;
  fishingXP: number;
  cannonCooldown: number;
  nearbyIsland: Island3D | null;
  canLand: boolean;
  combatTimer: number;
  wind: WindState;
  sailAngle: number;
  speedMultiplier: number;
  isAiming: boolean;
  abilities: AbilityState[];
  sailsDeployed: boolean;
  inNoSailZone: boolean;
  windAngleDegrees: number;
  weather: string;
  timeOfDay: number;
  sailEfficiency: number;
  optimalAngle: boolean;
  fps: number;
  frameTime: number;
  shipStability: number;
  shipWarnings: string[];
  weatherSeverity: string;
  weatherDescription: string;
}

interface MutableGameState {
  playerPosition: THREE.Vector3;
  playerRotation: number;
  playerHealth: number;
  gold: number;
  combatXP: number;
  fishingXP: number;
  cannonCooldown: number;
  combatTimer: number;
  repairCooldown: number;
  sailsDeployed: boolean;
}

const INITIAL_ABILITIES: AbilityState[] = [
  { id: 'repair', name: 'Repair', cooldown: 0, maxCooldown: 120, key: '1' },
  { id: 'windmagic', name: 'Wind Magic', cooldown: 0, maxCooldown: 60, key: '2' },
  { id: 'shield', name: 'Hull Shield', cooldown: 0, maxCooldown: 90, key: '3' },
  { id: 'multishot', name: 'Multi-Shot', cooldown: 0, maxCooldown: 45, key: '4' },
  { id: 'special', name: 'Special', cooldown: 0, maxCooldown: 180, key: '5' },
];

const INITIAL_HUD_STATE: HUDState = {
  playerHealth: 100,
  playerMaxHealth: 100,
  gold: 100,
  combatXP: 0,
  fishingXP: 0,
  cannonCooldown: 0,
  nearbyIsland: null,
  canLand: false,
  combatTimer: 0,
  wind: { direction: 0, speed: 15, gustFactor: 1 },
  sailAngle: 0,
  speedMultiplier: 1,
  isAiming: false,
  abilities: INITIAL_ABILITIES,
  sailsDeployed: false,
  inNoSailZone: false,
  windAngleDegrees: 0,
  weather: 'clear',
  timeOfDay: 0.3,
  sailEfficiency: 0,
  optimalAngle: false,
  fps: 60,
  frameTime: 16.67,
  shipStability: 100,
  shipWarnings: [],
  weatherSeverity: 'calm',
  weatherDescription: 'Calm seas, ideal sailing conditions'
};

const HUD_UPDATE_INTERVAL = 100;

// Use lore-accurate world data from worldMapData.ts
// WORLD_ISLANDS and WORLD_ENEMY_SHIPS contain faction-aligned locations

// FPS capping configuration
const MAX_FPS = 60;  // Maximum frames per second (capped for stable perf)
const MIN_FPS = 30;  // Minimum frames per second (max delta capped to this)
const MIN_FRAME_TIME = 1000 / MAX_FPS;  // ~11.11ms between frames
const MAX_FRAME_TIME = 1000 / MIN_FPS;  // ~33.33ms max delta

export function WorldMapScene({ onBackToMenu, onLandOnIsland }: WorldMapSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ThreeWorldMapManager | null>(null);
  const animationRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const lastHUDUpdateRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);  // For FPS capping
  const startingAreaRef = useRef<StartingArea | null>(null);
  const introRef = useRef<IntroCinematic | null>(null);
  const sceneStartTimeRef = useRef<number>(0);

  // Player spawns out at sea SE of Waterfall Isle so the player actually
  // sails IN to the harbour past the buoy line and lighthouse. Old spawn
  // (80, 0, 60) parked them on the sand with nothing to admire.
  const WATERFALL_ISLE_SPAWN = new THREE.Vector3(220, 0, 220);

  const mutableStateRef = useRef<MutableGameState>({
    playerPosition: WATERFALL_ISLE_SPAWN.clone(),
    playerRotation: Math.PI * 1.25, // Facing northwest toward the island center
    playerHealth: 100,
    gold: 100,
    combatXP: 0,
    fishingXP: 0,
    cannonCooldown: 0,
    combatTimer: 0,
    repairCooldown: 0,
    sailsDeployed: false
  });
  
  const abilityCooldownsRef = useRef<number[]>([0, 0, 0, 0, 0]);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const [hudState, setHUDState] = useState<HUDState>(INITIAL_HUD_STATE);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third-person');
  const [isPaused, setIsPaused] = useState(false);
  const [currentShipType, setCurrentShipType] = useState('sloop');
  const [sailDeployment, setSailDeployment] = useState(0);
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);
  const [oceanPreset, setOceanPreset] = useState('caribbean');
  const [availableOceanPresets, setAvailableOceanPresets] = useState<string[]>([]);
  
  // Admin panel state
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('none');
  const [selectedObject, setSelectedObject] = useState<EditableObject | null>(null);
  const [editableObjects, setEditableObjects] = useState<EditableObject[]>([]);
  const [captainRace, setCaptainRace] = useState<Race>('human');
  // Production default OFF — grudge6 fleet assets only; Meshy is admin toggle.
  const [useMeshyCharacter, setUseMeshyCharacter] = useState(false);
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  // Mirror in a ref so the memoized key handler always reads the live value
  // (handleKeyDown is not re-created when worldMapOpen changes).
  const worldMapOpenRef = useRef(false);
  worldMapOpenRef.current = worldMapOpen;
  const { toast } = useToast();
  
  const handleCycleCaptainRace = useCallback(() => {
    if (managerRef.current) {
      const newRace = managerRef.current.cycleCaptainRace();
      setCaptainRace(newRace);
    }
  }, []);
  
  const handleToggleMeshyCharacter = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.toggleMeshyCharacter();
      setUseMeshyCharacter(managerRef.current.isUsingMeshyCharacter());
    }
  }, []);
  
  const [webglError, setWebglError] = useState(false);

  // ── Docking sequence ──────────────────────────────────────────────────────
  // Landing is a two-step, real game moment: the landing card is the dock
  // prompt, and confirming it drops anchor (stops the ship), plays a short
  // docking beat, then hands control to App via onLandOnIsland (which drives
  // the URL/phase so the landed island is shareable + refreshable).
  const [dockingIsland, setDockingIsland] = useState<{ id: string; name: string } | null>(null);
  const dockingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginDocking = useCallback((island: Island3D) => {
    // Drop anchor: retract sails so the boat actually stops rather than
    // drifting on into the island while the dock animation plays.
    mutableStateRef.current.sailsDeployed = false;
    setSailDeployment(0);
    setDockingIsland({ id: island.id, name: island.name });
    if (dockingTimerRef.current) clearTimeout(dockingTimerRef.current);
    dockingTimerRef.current = setTimeout(() => {
      dockingTimerRef.current = null;
      onLandOnIsland?.(island.id);
    }, 1800);
  }, [onLandOnIsland]);

  useEffect(() => {
    return () => {
      if (dockingTimerRef.current) {
        clearTimeout(dockingTimerRef.current);
        dockingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Warm the boat GLB cache before spawning so NPC upgrades don't hitch.
    preloadSailingBoats(resolvePlayerBoatId()).catch(console.warn);
    
    const manager = new ThreeWorldMapManager();
    if (manager.webglFailed) {
      setWebglError(true);
      return;
    }
    managerRef.current = manager;
    manager.mount(containerRef.current);
    
    // Use the spawn position from mutableStateRef (Waterfall Isle sandy coast)
    const playerPos = mutableStateRef.current.playerPosition.clone();
    // Deterministic boat from the saved captain build (falls back to the
    // default boat), resolved through the canonical boat registry so the
    // player always spawns with a real, controllable ship.
    manager.createPlayerShip('player', playerPos, 'Captain', resolvePlayerBoatId());
    
    // Load enemy ship models and goblin NPCs, then create lore-accurate NPC ships
    const initNPCShips = async () => {
      await manager.loadEnemyShipModels();
      await manager.loadGoblinModel();
      
      // Create NPC ships from lore-accurate world data
      for (const shipData of WORLD_ENEMY_SHIPS) {
        // Add patrol position variation
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = Math.random() * shipData.patrolRadius * 0.5;
        const x = shipData.patrolCenter.x + Math.cos(offsetAngle) * offsetDist;
        const z = shipData.patrolCenter.z + Math.sin(offsetAngle) * offsetDist;
        
        manager.createNPCShip(
          shipData.id, 
          new THREE.Vector3(x, 0, z), 
          shipData.name, 
          shipData.level,
          shipData.shipType,
          shipData.faction,
          shipData.aggressive
        );
      }
      // Ambient boats clustered around the player's harbour spawn so the sea
      // isn't empty. The lore patrol ships are 800-3200 units away (beyond the
      // fog/far-plane), so without these the starting area reads as dead water.
      const ambientBoats: Array<{
        id: string; name: string; type: 'small' | 'medium'; faction: string;
        aggressive: boolean; dx: number; dz: number;
      }> = [
        { id: 'fishing_skiff_1', name: "Gull's Catch", type: 'small', faction: 'crusade', aggressive: false, dx: 150, dz: -95 },
        { id: 'fishing_skiff_2', name: 'Tidewife', type: 'small', faction: 'crusade', aggressive: false, dx: -130, dz: 170 },
        { id: 'merchant_1', name: 'Coin & Compass', type: 'medium', faction: 'fabled', aggressive: false, dx: 275, dz: 240 },
        { id: 'harbour_patrol_1', name: 'The Watchman', type: 'medium', faction: 'crusade', aggressive: false, dx: -210, dz: -190 },
        { id: 'lurking_raider_1', name: 'Reef Shark', type: 'small', faction: 'pirate', aggressive: true, dx: 340, dz: -320 },
      ];
      for (const b of ambientBoats) {
        manager.createNPCShip(
          b.id,
          new THREE.Vector3(playerPos.x + b.dx, 0, playerPos.z + b.dz),
          b.name,
          b.aggressive ? 5 : 3,
          b.type,
          b.faction,
          b.aggressive
        );
      }
      console.log(`Loaded ${WORLD_ENEMY_SHIPS.length} lore ships + ${ambientBoats.length} ambient boats near spawn`);
    };
    initNPCShips().catch(console.error);
    
    // Load island enemy models and spawn enemies on hostile islands (after islands are created)
    const initIslandEnemies = async () => {
      await manager.loadIslandEnemyModels();
      
      // Spawn enemies on hostile and claimable islands
      for (const islandData of WORLD_ISLANDS) {
        if (islandData.enemyConfig && islandData.enemyConfig.enemyCount > 0) {
          const enemyTypes = islandData.enemyConfig.enemyTypes || ['goblin', 'skeleton'];
          manager.spawnIslandEnemies(
            islandData.id,
            new THREE.Vector3(islandData.position.x, 0, islandData.position.z),
            islandData.radius,
            islandData.enemyConfig.enemyCount,
            enemyTypes,
            islandData.enemyConfig.bossType
          );
        }
      }
      console.log('Spawned enemies on hostile islands');
    };
    // Delay enemy spawning until after islands are created
    setTimeout(() => initIslandEnemies().catch(console.error), 100);
    
    // Create lore-accurate islands from Aethermoor world data
    // Tag islands with fleet sector shell seeds (canonical CDN shells + meshName + seed).
    void import('@/lib/islandFleetSeeds').then(async ({ loadIslandFleetSeeds, resolveSectorShell }) => {
      try {
        const seeds = await loadIslandFleetSeeds();
        let i = 0;
        for (const islandData of WORLD_ISLANDS) {
          const sectorId = (islandData.tier ?? (i % 9) + 1);
          const resolved = resolveSectorShell(seeds, sectorId);
          if (resolved) {
            manager.tagIslandFleetShell?.(islandData.id, {
              shellKey: resolved.shellKey,
              cdn: resolved.shell.cdn,
              r2Key: resolved.shell.r2Key,
              meshName: resolved.meshName,
              seed: resolved.seed,
              sectorId: resolved.sectorId,
            });
          }
          i++;
        }
        console.log('[WorldMap] fleet island seeds tagged for', WORLD_ISLANDS.length, 'islands');
      } catch (e) {
        console.warn('[WorldMap] fleet seeds', e);
      }
    });

    for (const islandData of WORLD_ISLANDS) {
      manager.createIsland(
        islandData.id, 
        new THREE.Vector3(islandData.position.x, 0, islandData.position.z), 
        islandData.radius, 
        islandData.name, 
        islandData.biome,
        islandData.faction,
        islandData.hostility,
        islandData.tier,
        {
          gameplayType: islandData.gameplayType,
          hasTradingPost: islandData.hasTradingPost,
          isClaimable: islandData.isClaimable,
          enemyCount: islandData.enemyConfig?.enemyCount,
          hasBoss: !!islandData.enemyConfig?.bossType,
          description: islandData.description
        }
      );
    }
    console.log(`Created ${WORLD_ISLANDS.length} lore-accurate islands across Aethermoor`);
    
    // Initialize ocean floor and animated fish after islands are placed
    manager.initializeOceanLife().catch(console.error);
    
    // Set up available ocean presets
    setAvailableOceanPresets(manager.getAvailableOceanPresets());
    setOceanPreset(manager.getCurrentOceanPreset());
    
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 800;
      const z = (Math.random() - 0.5) * 800;
      const value = Math.floor(Math.random() * 50) + 10;
      manager.createTreasure(`treasure-${i}`, new THREE.Vector3(x, 0, z), value);
    }

    // ── Hero starting environment: warm golden-hour lighting + decorated
    // Waterfall Isle (lighthouse, welcome dock, glowing rune circle, buoy
    // approach) + a 4.5s cinematic camera sweep on first arrival. ──
    manager.setOceanPreset('sunset');
    setOceanPreset('sunset');
    manager.setTimeOfDay(0.22);  // soft sunrise
    manager.setDaySpeed(0.0025); // ~6.5 min for a full cycle — golden hour lingers

    // Decorate Waterfall Isle. The dock sits along the SE approach bearing
    // so the player ship spawn (220, 0, 220) sails straight at it.
    startingAreaRef.current = decorateStartingArea(manager.getScene(), {
      islandCenter: new THREE.Vector3(0, 0, 0),
      approachBearing: Math.PI * 0.25, // SE
      islandRadius: 150,
    });

    // Intro: hero shot above and behind the ship, slowly sweeps down to
    // the regular over-the-shoulder follow pose. Gives the player a beat
    // to see the lighthouse, the glowing rune beam, and the dock banner.
    const spawn = WATERFALL_ISLE_SPAWN;
    introRef.current = new IntroCinematic({
      start: {
        position: new THREE.Vector3(spawn.x + 60, 95, spawn.z + 70),
        lookAt: new THREE.Vector3(0, 18, 0), // look at island/rune beam
      },
      end: {
        // Same shape as default cameraOffset (0,15,-30) rotated by
        // shipRotation = 1.25π, behind the ship facing the island.
        position: new THREE.Vector3(
          spawn.x + Math.sin(Math.PI * 1.25) * -30,
          spawn.y + 15,
          spawn.z + Math.cos(Math.PI * 1.25) * -30,
        ),
        lookAt: new THREE.Vector3(spawn.x, spawn.y + 5, spawn.z),
      },
      duration: 4.5,
    });
    sceneStartTimeRef.current = performance.now();

    return () => {
      cancelAnimationFrame(animationRef.current);
      startingAreaRef.current?.dispose();
      startingAreaRef.current = null;
      introRef.current = null;
      manager.setCinematicCamera(null);
      manager.dispose();
      managerRef.current = null;
    };
  }, []);
  
  const gameLoop = useCallback(() => {
    const manager = managerRef.current;
    const now = performance.now();
    
    // FPS capping: Skip frame if running faster than MAX_FPS (90)
    const elapsed = now - lastFrameTimeRef.current;
    if (elapsed < MIN_FRAME_TIME) {
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    lastFrameTimeRef.current = now;
    
    if (!manager || isPaused) {
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    
    // Drive the intro cinematic camera BEFORE manager.update() so the override
    // is in place when manager.updateCamera() runs inside it.
    if (introRef.current) {
      const pose = introRef.current.sample(now);
      if (pose) {
        manager.setCinematicCamera(pose);
      } else {
        manager.setCinematicCamera(null);
        introRef.current = null;
      }
    }

    // Get delta from manager, but cap it to MIN_FPS (30) for physics stability
    let delta = manager.update();
    delta = Math.min(delta, MAX_FRAME_TIME / 1000);  // Convert ms to seconds

    // Animate the decorated starting area (lighthouse beacon, buoys, runes).
    if (startingAreaRef.current) {
      const sceneElapsedSec = (now - sceneStartTimeRef.current) / 1000;
      startingAreaRef.current.update(delta, sceneElapsedSec);
    }

    const state = mutableStateRef.current;
    const keys = keysRef.current;
    
    manager.updateWind(delta);
    manager.updateWindMagic(delta);
    manager.updateSailDeploymentSmooth(delta);
    manager.updateSailVisuals();
    manager.updateIslandEnemies(delta);
    manager.updateFlyingBosses(delta);
    
    // Update weather system and sync to ship physics
    globalWeather.update(delta);
    globalWeather.updateLightning(delta);
    const weatherState = globalWeather.getState();
    manager.setWeatherConfig(weatherState.weather);
    
    // Sync base lighting from weather/time-of-day state
    const ambientIntensity = 0.3 + (1 - weatherState.weather.cloudDensity) * 0.4;
    const directIntensity = 0.8 + (1 - weatherState.weather.cloudDensity) * 0.7;
    manager.setBaseLighting(ambientIntensity, directIntensity, weatherState.ambientLight.getHex());
    
    // Apply lightning flash effect additively (always call to handle flash end restoration)
    const flashIntensity = globalWeather.getFlashIntensity();
    manager.applyLightningFlash(flashIntensity);
    
    // Q/E: Adjust sail angle (manual trim override)
    // When Q/E is pressed, player manually controls sail
    // When released, sail auto-orients to optimal wind angle
    if (keys.has('q')) {
      manager.adjustSailAngle(-4.0 * delta);
      (state as any).manualTrimHold = 1.5;
    } else if (keys.has('e')) {
      manager.adjustSailAngle(4.0 * delta);
      (state as any).manualTrimHold = 1.5;
    } else if (((state as any).manualTrimHold ?? 0) > 0) {
      // Hold the player's manual trim briefly before auto-trim takes back over,
      // so Q/E visibly swings the sail instead of snapping straight back.
      (state as any).manualTrimHold -= delta;
    } else {
      // Auto-trim: sail naturally swings toward optimal wind angle
      manager.autoTrimSail(delta);
    }
    
    // A/D or Arrow keys: Rotate ship
    const rotationSpeed = 2.5 * delta;
    if (keys.has('a') || keys.has('arrowleft')) {
      state.playerRotation += rotationSpeed;
    }
    if (keys.has('d') || keys.has('arrowright')) {
      state.playerRotation -= rotationSpeed;
    }
    
    // Valheim-style sailing: Movement based on wind, not key presses
    // S = raise/hoist sails (toggle handled in key handler)
    // W = lower/furl sails (toggle handled in key handler)
    const windEffect = manager.calculateWindEffect(state.playerRotation, state.sailsDeployed);
    
    // Calculate movement from wind
    const windMovement = manager.calculateWindMovement(state.playerRotation, state.sailsDeployed, delta);
    
    // Apply wind movement
    state.playerPosition.x += windMovement.x;
    state.playerPosition.z += windMovement.z;
    
    // Clamp to world bounds
    const worldHalf = 4400;  // Slightly less than half of 9000
    state.playerPosition.x = Math.max(-worldHalf, Math.min(worldHalf, state.playerPosition.x));
    state.playerPosition.z = Math.max(-worldHalf, Math.min(worldHalf, state.playerPosition.z));
    
    const velocity = new THREE.Vector3(
      windMovement.x / delta,
      0,
      windMovement.z / delta
    );
    
    manager.updatePlayerShip(state.playerPosition, state.playerRotation, velocity, state.playerHealth, delta);
    
    // Sync health from ship physics (weather damage applied there)
    const playerShip = manager.getPlayerShip();
    if (playerShip && playerShip.health < state.playerHealth) {
      state.playerHealth = playerShip.health;
    }
    
    if (manager.isAiming() && containerRef.current) {
      manager.updateAiming(
        mousePosRef.current.x,
        mousePosRef.current.y,
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    }
    
    manager.getNPCShips().forEach((ship, id) => {
      const dx = state.playerPosition.x - ship.position.x;
      const dz = state.playerPosition.z - ship.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      // Ships carry their disposition on the mesh group (set in createNPCShip).
      // Friendly / fishing / merchant boats (aggressive === false) never chase
      // or fire — they idle-wander and gently veer away if you crowd them.
      const isAggressive = (ship.mesh as any).aggressive !== false;
      
      let targetRotation = ship.rotation;
      let speed = 8 * delta;
      
      if (isAggressive) {
        if (dist < 150 && dist > 30) {
          targetRotation = Math.atan2(dx, dz);
        } else if (dist <= 30) {
          speed = 0;
        } else {
          targetRotation += 0.3 * delta;
        }
      } else {
        // Peaceful wander; steer away from the player if they get too close.
        speed = 5 * delta;
        if (dist < 45) {
          targetRotation = Math.atan2(-dx, -dz);
        } else {
          targetRotation += 0.15 * delta;
        }
      }
      
      const moveX = Math.sin(targetRotation) * speed;
      const moveZ = Math.cos(targetRotation) * speed;
      ship.position.x += moveX;
      ship.position.z += moveZ;
      
      ship.velocity.set(moveX / delta, 0, moveZ / delta);
      
      manager.updateNPCShip(id, ship.position, targetRotation, ship.health, delta);
      
      if (isAggressive && dist < 80 && dist > 20 && Math.random() < 0.005) {
        const fireDir = new THREE.Vector3(dx, 2, dz).normalize().multiplyScalar(120);
        manager.createCannonball(
          `npc-ball-${Date.now()}-${id}`,
          new THREE.Vector3(ship.position.x, 3, ship.position.z),
          fireDir,
          id,
          10
        );
      }
    });
    
    const { shipHits, treasureCollects } = manager.checkCollisions();
    
    state.combatTimer = Math.max(0, state.combatTimer - delta);
    state.cannonCooldown = Math.max(0, state.cannonCooldown - delta);
    state.repairCooldown = Math.max(0, state.repairCooldown - delta);
    
    for (let i = 0; i < abilityCooldownsRef.current.length; i++) {
      abilityCooldownsRef.current[i] = Math.max(0, abilityCooldownsRef.current[i] - delta);
    }
    
    shipHits.forEach(hit => {
      if (hit.targetId === 'player') {
        state.playerHealth = Math.max(0, state.playerHealth - hit.damage);
        state.combatTimer = 15;
      } else {
        const ship = manager.getNPCShips().get(hit.targetId);
        if (ship) {
          ship.health -= hit.damage;
          state.combatTimer = 15;
          if (ship.health <= 0) {
            state.gold += 20 + ship.level * 10;
            state.combatXP += ship.level * 25;
            manager.removeNPCShip(hit.targetId);
          }
        }
      }
    });
    
    treasureCollects.forEach(id => {
      manager.collectTreasure(id);
      state.gold += 25;
    });
    
    if (now - lastHUDUpdateRef.current >= HUD_UPDATE_INTERVAL) {
      lastHUDUpdateRef.current = now;
      
      let nearbyIsland: Island3D | null = null;
      manager.getIslands().forEach(island => {
        const dist = Math.sqrt(
          Math.pow(state.playerPosition.x - island.position.x, 2) +
          Math.pow(state.playerPosition.z - island.position.z, 2)
        );
        if (dist < island.radius + 20) {
          nearbyIsland = island;
        }
      });
      
      const updatedAbilities = INITIAL_ABILITIES.map((ability, i) => ({
        ...ability,
        cooldown: abilityCooldownsRef.current[i]
      }));
      
      const weatherSeverity = manager.getWeatherSeverity();
      
      setHUDState({
        playerHealth: state.playerHealth,
        playerMaxHealth: 100,
        gold: state.gold,
        combatXP: state.combatXP,
        fishingXP: state.fishingXP,
        cannonCooldown: state.cannonCooldown,
        nearbyIsland,
        canLand: nearbyIsland !== null && state.combatTimer <= 0,
        combatTimer: state.combatTimer,
        wind: manager.getWindState(),
        sailAngle: manager.getSailAngle(),
        speedMultiplier: windEffect.speedMultiplier,
        isAiming: manager.isAiming(),
        abilities: updatedAbilities,
        sailsDeployed: state.sailsDeployed,
        inNoSailZone: windEffect.inNoSailZone,
        windAngleDegrees: windEffect.windAngleDegrees,
        weather: manager.getWeatherState(),
        timeOfDay: manager.getTimeOfDay(),
        sailEfficiency: windEffect.speedMultiplier,
        optimalAngle: windEffect.optimalAngle,
        fps: manager.getCurrentFPS(),
        frameTime: manager.getAverageFrameTime(),
        shipStability: manager.getShipStability(),
        shipWarnings: manager.getShipWarnings(),
        weatherSeverity: weatherSeverity.level,
        weatherDescription: weatherSeverity.description
      });
    }
    
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [isPaused]);
  
  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);
  
  // Alternate cannon side for realistic broadside firing
  const cannonSideRef = useRef<'port' | 'starboard'>('starboard');
  
  const fireCannon = useCallback((velocity?: THREE.Vector3) => {
    const manager = managerRef.current;
    const state = mutableStateRef.current;
    if (!manager || state.cannonCooldown > 0) return;
    
    const playerShip = manager.getPlayerShip();
    if (!playerShip) return;
    
    // Alternate between port (left) and starboard (right) cannons
    const side = cannonSideRef.current;
    cannonSideRef.current = side === 'starboard' ? 'port' : 'starboard';
    
    // Calculate side offset (perpendicular to ship direction)
    const sideAngle = state.playerRotation + (side === 'starboard' ? Math.PI / 2 : -Math.PI / 2);
    const sideOffset = 4; // Distance from ship center to cannon
    
    // Fire position: ship position + side offset, at cannon height
    const firePos = new THREE.Vector3(
      state.playerPosition.x + Math.sin(sideAngle) * sideOffset,
      3, // Cannon height on deck
      state.playerPosition.z + Math.cos(sideAngle) * sideOffset
    );
    
    // Calculate fire direction (perpendicular to ship - broadside)
    // 3x faster cannonballs: flatter, snappier trajectory (less floaty arc)
    const cannonSpeed = 360; // 3x faster cannonballs
    const launchAngle = 0.12; // Flatter arc so the faster ball reads as a direct shot
    
    const fireVel = velocity || new THREE.Vector3(
      Math.sin(sideAngle) * cannonSpeed * Math.cos(launchAngle),
      cannonSpeed * Math.sin(launchAngle) + 10, // Small upward bias only
      Math.cos(sideAngle) * cannonSpeed * Math.cos(launchAngle)
    );
    
    manager.createCannonball(
      `player-ball-${Date.now()}`,
      firePos,
      fireVel,
      'player',
      25
    );
    
    state.cannonCooldown = 0.8; // Faster cooldown for action
  }, []);
  
  const useRepairAbility = useCallback(() => {
    const state = mutableStateRef.current;
    if (abilityCooldownsRef.current[0] > 0) return;
    if (state.playerHealth >= 100) return;
    
    state.playerHealth = Math.min(100, state.playerHealth + 20);
    abilityCooldownsRef.current[0] = 120;
  }, []);

  const useWindMagic = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (abilityCooldownsRef.current[1] > 0) return;
    
    const activated = manager.activateWindMagic();
    if (activated) {
      abilityCooldownsRef.current[1] = 60; // 60 second cooldown
      mutableStateRef.current.sailsDeployed = true; // Ensure sails deployed
    }
  }, []);
  
  const handleSelectShip = useCallback((shipType: string) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    const success = manager.swapPlayerShip(shipType);
    if (success) {
      setCurrentShipType(shipType);
    }
  }, []);
  
  const handleSetSailDeployment = useCallback((deployment: number) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    setSailDeployment(deployment);
    
    let position: 0 | 1 | 2 | 3 = 0;
    if (deployment >= 100) {
      position = 3;
    } else if (deployment >= 50) {
      position = 2;
    } else if (deployment > 0) {
      position = 1;
    }
    manager.setSailPosition(position);
    mutableStateRef.current.sailsDeployed = deployment > 0;
  }, []);

  // Admin panel handlers
  const refreshEditableObjects = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    const objects = manager.getEditableObjects();
    setEditableObjects(objects);
    
    // Update selected object if it still exists
    if (selectedObject) {
      const updated = objects.find(o => o.id === selectedObject.id);
      setSelectedObject(updated || null);
    }
  }, [selectedObject]);

  const handleAdminToggle = useCallback(() => {
    setAdminPanelOpen(open => {
      const newOpen = !open;
      if (newOpen) {
        managerRef.current?.setAdminMode(true);
        refreshEditableObjects();
      } else {
        managerRef.current?.setAdminMode(false);
        setGizmoMode('none');
      }
      return newOpen;
    });
  }, [refreshEditableObjects]);

  const handleGizmoModeChange = useCallback((mode: GizmoMode) => {
    setGizmoMode(mode);
  }, []);

  const handleSelectAdminObject = useCallback((id: string | null) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    manager.selectObject(id);
    if (id) {
      const objects = manager.getEditableObjects();
      const obj = objects.find(o => o.id === id);
      setSelectedObject(obj || null);
    } else {
      setSelectedObject(null);
    }
  }, []);

  const handleImportGLB = useCallback(async (file: File, name: string) => {
    const manager = managerRef.current;
    if (!manager) return { success: false, error: 'Manager not available' };
    
    const result = await manager.importGLBFromFile(file, name);
    if (result.success) {
      toast({ title: 'Model imported', description: `Successfully imported "${name}"` });
      refreshEditableObjects();
    } else {
      toast({ title: 'Import failed', description: result.error, variant: 'destructive' });
    }
    return result;
  }, [toast, refreshEditableObjects]);

  const handleSaveEdits = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return { success: false, error: 'Manager not available' };
    
    const result = await manager.saveEditedObjects();
    if (result.success) {
      toast({ title: 'Edits saved', description: 'All object edits have been saved' });
    } else {
      toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
    }
    return result;
  }, [toast]);

  const handleDeleteObject = useCallback((id: string) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    if (manager.deleteObject(id)) {
      toast({ title: 'Object deleted' });
      refreshEditableObjects();
      if (selectedObject?.id === id) {
        setSelectedObject(null);
      }
    }
  }, [toast, refreshEditableObjects, selectedObject]);

  const handleTransformChange = useCallback((id: string, transform: Partial<EditableObject>) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    manager.updateObjectTransform(id, transform);
    refreshEditableObjects();
  }, [refreshEditableObjects]);

  const handleToggleVisibility = useCallback((id: string) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    manager.toggleObjectVisibility(id);
    refreshEditableObjects();
  }, [refreshEditableObjects]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysRef.current.add(key);
    
    const isChaseMode = managerRef.current?.getCameraMode() === 'chase';
    
    if (key === 'f1') {
      setCameraMode('third-person');
      managerRef.current?.setCameraMode('third-person');
    } else if (key === 'f2') {
      setCameraMode('birds-eye');
      managerRef.current?.setCameraMode('birds-eye');
    } else if (key === 'tab') {
      e.preventDefault();
      const manager = managerRef.current;
      if (manager) {
        manager.toggleChaseMode();
        setCameraMode(manager.getCameraMode());
      }
    } else if (key === 'escape') {
      if (worldMapOpenRef.current) {
        setWorldMapOpen(false);
      } else {
        setIsPaused(p => !p);
      }
    } else if (key === 'b') {
      // Debug: spawn flying boss
      const manager = managerRef.current;
      if (manager) {
        const boss = manager.forceSpawnFlyingBoss();
        if (boss) {
          toast({ title: 'Sky Terror Spawned!', description: 'A rare flying boss has appeared!' });
        }
      }
    } else if (key === 'r') {
      const manager = managerRef.current;
      if (manager) {
        const newRace = manager.cycleCaptainRace();
        setCaptainRace(newRace);
      }
    }
    
    // Ship controls only when NOT in chase mode
    if (!isChaseMode) {
      if (key === ' ') {
        e.preventDefault();
        if (mutableStateRef.current.cannonCooldown <= 0) {
          fireCannon();
        }
      } else if (key === '1') {
        useRepairAbility();
      } else if (key === '2') {
        useWindMagic();
      } else if (key === 's' || key === 'arrowup') {
        // S raises (hoists) sails one step (0 → 1 → 2). Wind — not the key —
        // then drives the boat forward.
        if (!managerRef.current?.isWindMagicActive()) {
          const currentPos = managerRef.current?.getSailPosition() ?? 0;
          const newPos = Math.min(2, currentPos + 1) as 0 | 1 | 2;
          managerRef.current?.setSailPosition(newPos);
          mutableStateRef.current.sailsDeployed = newPos > 0;
        }
      } else if (key === 'w' || key === 'arrowdown') {
        // W lowers (furls) sails one step (2 → 1 → 0).
        const currentPos = managerRef.current?.getSailPosition() ?? 0;
        const newPos = Math.max(0, currentPos - 1) as 0 | 1 | 2;
        managerRef.current?.setSailPosition(newPos);
        mutableStateRef.current.sailsDeployed = newPos > 0;
      }
      // Q/E handled in game loop for continuous sail trim
    }
  }, [fireCannon, useRepairAbility, useWindMagic]);
  
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase());
  }, []);
  
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Ship aiming only when NOT in chase mode
    const isChaseMode = managerRef.current?.getCameraMode() === 'chase';
    if (e.button === 2 && !isChaseMode) {
      e.preventDefault();
      managerRef.current?.startAiming();
    }
  }, []);
  
  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Ship firing only when NOT in chase mode
    const isChaseMode = managerRef.current?.getCameraMode() === 'chase';
    if (e.button === 2 && !isChaseMode) {
      const velocity = managerRef.current?.stopAiming(true);
      if (velocity && mutableStateRef.current.cannonCooldown <= 0) {
        fireCannon(velocity);
      }
    }
  }, [fireCannon]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
    }
  }, []);
  
  const handleClick = useCallback((e: MouseEvent) => {
    // Left click for pointer lock only in chase mode
    if (e.button === 0 && containerRef.current && managerRef.current) {
      const manager = managerRef.current;
      if (manager.getCameraMode() === 'chase' && !document.pointerLockElement) {
        containerRef.current.requestPointerLock();
      }
    }
    
    // Left click for targeting (button 0)
    if (e.button === 0 && containerRef.current && managerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const target = managerRef.current.getTargetAtPosition(
        mouseX,
        mouseY,
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      
      setTargetInfo(target);
    }
  }, []);
  
  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
  }, []);
  
  useEffect(() => {
    const container = containerRef.current;
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    if (container) {
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('click', handleClick);
      container.addEventListener('contextmenu', handleContextMenu);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      if (container) {
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('click', handleClick);
        container.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleClick, handleContextMenu]);
  
  const healthPercent = (hudState.playerHealth / hudState.playerMaxHealth) * 100;
  const healthColor = healthPercent > 50 ? 'bg-green-500' : healthPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  
  // ── Unified boat HUD payloads (shared GameHUD + WindCompass, same as all boat contexts) ──
  const hudVitals: VitalBarDef[] = [
    { id: 'hull', label: 'Hull', current: hudState.playerHealth, max: hudState.playerMaxHealth, color: '#ef4444', icon: 'heart' },
    { id: 'stability', label: 'Stability', current: hudState.shipStability, max: 100, color: '#38bdf8', icon: 'anchor' },
  ];
  const hudSlots: SlotDef[] = hudState.abilities.map((a) => ({
    id: a.id,
    label: a.name,
    icon: a.id === 'repair' ? '🔧' : a.id === 'windmagic' ? '💨' : a.id === 'shield' ? '🛡️' : a.id === 'multishot' ? '🎯' : '✨',
    hotkey: a.key,
    cooldown: a.cooldown,
    maxCooldown: a.maxCooldown,
    onClick: a.id === 'repair' ? useRepairAbility : a.id === 'windmagic' ? useWindMagic : undefined,
  }));
  const cannonSlot: SlotDef = {
    id: 'cannon', label: 'Fire', icon: '💥', hotkey: 'Spc',
    cooldown: hudState.cannonCooldown, maxCooldown: 3, description: 'Cannon',
    onClick: () => fireCannon(),
  };

  if (webglError) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-gray-900 to-black flex items-center justify-center" data-testid="webgl-error-worldmap">
        <div className="text-center max-w-md mx-4 space-y-6">
          <div className="text-5xl">🗺️</div>
          <h1 className="text-3xl font-serif text-amber-400">WebGL Required</h1>
          <p className="text-white/70 leading-relaxed">
            The 3D world map requires WebGL which isn't available in this viewer.
            Open the game in a full browser tab to explore Aethermoor.
          </p>
          <div className="space-y-3">
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-amber-600 hover:bg-amber-500 text-black font-bold py-3 px-6 rounded-lg transition-colors"
              data-testid="link-open-in-browser-worldmap"
            >
              Open in Browser Tab
            </a>
            <div>
              <button
                onClick={onBackToMenu}
                className="text-white/50 hover:text-white/80 text-sm underline transition-colors"
                data-testid="button-back-to-menu-webgl-worldmap"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        data-testid="canvas-world-map-3d"
      />
      
      <Card className="absolute top-4 left-4 p-4 bg-background/90 backdrop-blur-sm" data-testid="panel-hud-3d">
        <div className="flex items-center gap-2 mb-2">
          <Anchor className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold">Captain</span>
          <Badge variant="secondary">Lv.1</Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${healthColor} transition-all`}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
            <span className="text-xs">{hudState.playerHealth}/{hudState.playerMaxHealth}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span>{hudState.gold}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            <span>Combat XP: {hudState.combatXP}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Fish className="w-4 h-4 text-blue-400" />
            <span>Fishing XP: {hudState.fishingXP}</span>
          </div>
          
          {hudState.cannonCooldown > 0 && (
            <div className="text-orange-400">Reloading...</div>
          )}
          
          {hudState.combatTimer > 0 && (
            <div className="text-red-400">In Combat ({Math.ceil(hudState.combatTimer)}s)</div>
          )}
        </div>
      </Card>
      
      <SailingHUD
        vitals={hudVitals}
        slots={hudSlots}
        cannonSlot={cannonSlot}
        hint="Space Fire · RMB Aim · S Raise / W Lower Sails · A/D Turn · Q/E Rotate · M Map"
        showHotbar={cameraMode !== 'chase'}
        wind={{
          windAngleDeg: hudState.windAngleDegrees,
          windSpeedKts: hudState.wind.speed,
          shipHeadingDeg: mutableStateRef.current.playerRotation * 180 / Math.PI,
          shipSpeedKts: hudState.speedMultiplier * 12,
          sailTrim01: hudState.sailsDeployed ? hudState.sailEfficiency : 0,
          fullSailActive: hudState.sailsDeployed && hudState.optimalAngle,
        }}
        seaState={{
          weather: hudState.weather,
          weatherSeverity: hudState.weatherSeverity,
          timeOfDay: hudState.timeOfDay,
          shipStability: hudState.shipStability,
          shipWarnings: hudState.shipWarnings,
        }}
      />
      
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Card className="p-3 bg-background/90 backdrop-blur-sm" data-testid="panel-controls-3d">
          <div className="text-sm space-y-1">
            <div className="font-bold mb-2">Sailing Controls</div>
            <div>S - Raise Sails (wind moves you)</div>
            <div>W - Lower Sails (Stop)</div>
            <div>A/D - Turn Left/Right</div>
            <div>Q/E - Rotate Sails</div>
            <div className="pt-2 border-t border-border mt-2">
              <div className="font-bold mb-1">Combat</div>
              <div>Space - Fire Cannon</div>
              <div>Right-Click - Aim</div>
              <div>1 - Repair</div>
            </div>
            <div className="pt-2 border-t border-border mt-2 text-xs text-muted-foreground">
              <div>Best speed: 90-135° from wind</div>
              <div>No-sail zone: 0-45° into wind</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-2 bg-background/80 backdrop-blur-sm" data-testid="panel-fps">
          <div className="text-xs font-mono flex items-center gap-3">
            <span className={
              hudState.fps >= 50 ? 'text-green-400' :
              hudState.fps >= 30 ? 'text-yellow-400' : 'text-red-400'
            }>
              {hudState.fps} FPS
            </span>
            <span className="text-muted-foreground">
              {hudState.frameTime.toFixed(1)}ms
            </span>
          </div>
        </Card>
        
        {targetInfo && (
          <Card className="p-3 bg-background/90 backdrop-blur-sm" data-testid="panel-target-info">
            <div className="flex items-center gap-2 mb-2">
              {targetInfo.type === 'island' && <MapPin className="w-4 h-4 text-green-500" />}
              {targetInfo.type === 'ship' && <Ship className="w-4 h-4 text-red-500" />}
              {targetInfo.type === 'treasure' && <Gem className="w-4 h-4 text-yellow-500" />}
              <span className="font-bold text-sm">{targetInfo.name}</span>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="secondary" className="text-xs capitalize">{targetInfo.type}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Distance:</span>
                <span>{targetInfo.distance}m</span>
              </div>
              {targetInfo.biome && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Biome:</span>
                  <span className="capitalize">{targetInfo.biome}</span>
                </div>
              )}
              {targetInfo.health !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Health:</span>
                  <span>{targetInfo.health}/{targetInfo.maxHealth}</span>
                </div>
              )}
              {targetInfo.value !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Value:</span>
                  <span className="text-yellow-500">{targetInfo.value} gold</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => setTargetInfo(null)}
              data-testid="button-clear-target"
            >
              Clear Target
            </Button>
          </Card>
        )}
      </div>
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
        <Button
          variant={isPaused ? 'destructive' : 'default'}
          size="sm"
          onClick={() => {
            const newPaused = !isPaused;
            setIsPaused(newPaused);
            if (newPaused) {
              setAdminPanelOpen(true);
              managerRef.current?.setAdminMode(true);
              refreshEditableObjects();
            } else {
              managerRef.current?.setAdminMode(false);
            }
          }}
          data-testid="button-freeze-game"
        >
          {isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
          {isPaused ? 'Resume' : 'Freeze/Edit'}
        </Button>
        <Button
          variant={cameraMode === 'third-person' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setCameraMode('third-person');
            managerRef.current?.setCameraMode('third-person');
          }}
          data-testid="button-camera-third-person"
        >
          <Camera className="w-4 h-4 mr-1" />
          Third Person
        </Button>
        <Button
          variant={cameraMode === 'birds-eye' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setCameraMode('birds-eye');
            managerRef.current?.setCameraMode('birds-eye');
          }}
          data-testid="button-camera-birds-eye"
        >
          <Eye className="w-4 h-4 mr-1" />
          Bird's Eye
        </Button>
        <Button
          variant={cameraMode === 'chase' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            managerRef.current?.toggleChaseMode();
            setCameraMode(managerRef.current?.getCameraMode() || 'third-person');
          }}
          data-testid="button-camera-chase"
        >
          <User className="w-4 h-4 mr-1" />
          Captain (Tab)
        </Button>
        <Button
          variant={adminPanelOpen ? 'default' : 'outline'}
          size="sm"
          onClick={handleAdminToggle}
          data-testid="button-admin-panel"
        >
          <Settings className="w-4 h-4 mr-1" />
          Admin
        </Button>
      </div>
      
      <AdminPanel
        isOpen={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
        gizmoMode={gizmoMode}
        onGizmoModeChange={handleGizmoModeChange}
        selectedObject={selectedObject}
        editableObjects={editableObjects}
        onSelectObject={handleSelectAdminObject}
        onImportGLB={handleImportGLB}
        onSaveEdits={handleSaveEdits}
        onDeleteObject={handleDeleteObject}
        onTransformChange={handleTransformChange}
        onToggleVisibility={handleToggleVisibility}
      />
      
      
      <Button
        onClick={onBackToMenu}
        variant="outline"
        className="absolute top-20 left-4"
        data-testid="button-back-menu-worldmap-3d"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Menu
      </Button>
      
      <ShipTestingPanel
        currentShipType={currentShipType}
        onSelectShip={handleSelectShip}
        onFireCannons={() => fireCannon()}
        onSetSailDeployment={handleSetSailDeployment}
        sailDeployment={sailDeployment}
        onLoadMeshyShip={async (glbUrl, shipType) => {
          if (managerRef.current) {
            return await managerRef.current.loadMeshyShip(glbUrl, shipType);
          }
          return { success: false, parts: [], error: 'Manager not initialized' };
        }}
        captainRace={captainRace}
        onCycleCaptainRace={handleCycleCaptainRace}
        useMeshyCharacter={useMeshyCharacter}
        onToggleMeshyCharacter={handleToggleMeshyCharacter}
      />
      
      <FishingSettingsPanel
        currentOceanPreset={oceanPreset}
        availablePresets={availableOceanPresets}
        onOceanPresetChange={(presetId) => {
          if (managerRef.current) {
            managerRef.current.setOceanPreset(presetId);
            setOceanPreset(presetId);
          }
        }}
      />
      
      {hudState.canLand && hudState.nearbyIsland && !dockingIsland && (
        <Card className="absolute bottom-20 left-1/2 -translate-x-1/2 p-4 bg-background/95 backdrop-blur-sm w-80" data-testid="panel-island-landing">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-green-500" />
            <h3 className="font-serif font-bold text-lg">{hudState.nearbyIsland.name}</h3>
          </div>
          <div className="text-xs space-y-1 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Biome:</span>
              <Badge variant="secondary" className="capitalize">{hudState.nearbyIsland.biome || 'Unknown'}</Badge>
            </div>
            {hudState.nearbyIsland.faction && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Faction:</span>
                <Badge 
                  variant={hudState.nearbyIsland.hostility === 'friendly' ? 'default' : 
                           hudState.nearbyIsland.hostility === 'hostile' ? 'destructive' : 'secondary'}
                  className="capitalize"
                >
                  {hudState.nearbyIsland.faction}
                </Badge>
              </div>
            )}
            {hudState.nearbyIsland.hostility && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={`capitalize ${
                  hudState.nearbyIsland.hostility === 'friendly' ? 'text-green-500' :
                  hudState.nearbyIsland.hostility === 'hostile' ? 'text-red-500' :
                  hudState.nearbyIsland.hostility === 'contested' ? 'text-yellow-500' : 'text-muted-foreground'
                }`}>
                  {hudState.nearbyIsland.hostility}
                </span>
              </div>
            )}
            {hudState.nearbyIsland.tier && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tier:</span>
                <span className="text-amber-500">{'\u2605'.repeat(hudState.nearbyIsland.tier)}</span>
              </div>
            )}
            {hudState.nearbyIsland.hasTradingPost && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Features:</span>
                <Badge variant="outline" className="text-blue-400 border-blue-400">Trading Post</Badge>
              </div>
            )}
            {hudState.nearbyIsland.isClaimable && !hudState.nearbyIsland.isClaimed && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="text-orange-400 border-orange-400">Claimable</Badge>
              </div>
            )}
            {hudState.nearbyIsland.enemyCount && hudState.nearbyIsland.enemyCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Enemies:</span>
                <span className="text-red-400">{hudState.nearbyIsland.enemyCount} hostile{hudState.nearbyIsland.hasBoss && ' + Boss'}</span>
              </div>
            )}
            {hudState.nearbyIsland.description && (
              <p className="text-muted-foreground italic mt-2">{hudState.nearbyIsland.description}</p>
            )}
          </div>
          <Button
            onClick={() => beginDocking(hudState.nearbyIsland!)}
            size="lg"
            className={`w-full ${hudState.nearbyIsland.hostility === 'hostile' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            data-testid="button-land-island-3d"
          >
            <Anchor className="w-5 h-5 mr-2" />
            {hudState.nearbyIsland.hostility === 'hostile' ? 'Drop Anchor & Raid' : 'Drop Anchor & Dock'}
          </Button>
        </Card>
      )}

      {dockingIsland && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          data-testid="overlay-docking"
        >
          <Card className="p-8 text-center bg-background/95 flex flex-col items-center gap-4 w-80">
            <Anchor className="w-12 h-12 text-primary animate-bounce" />
            <div>
              <h3 className="font-serif font-bold text-xl mb-1">Dropping Anchor</h3>
              <p className="text-sm text-muted-foreground">
                Docking at {dockingIsland.name}…
              </p>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-[dockprogress_1.8s_linear_forwards]" />
            </div>
          </Card>
        </div>
      )}
      
      {hudState.isAiming && (
        <div className="absolute top-24 right-4 pointer-events-none">
          <Badge variant="secondary" className="text-blue-400">
            <Crosshair className="w-4 h-4 mr-1" />
            Aiming
          </Badge>
        </div>
      )}
      
      {isPaused && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-serif font-bold mb-4">Paused</h2>
            <p className="text-muted-foreground mb-4">Press ESC to resume</p>
            <Button onClick={() => setIsPaused(false)} data-testid="button-resume">Resume</Button>
          </Card>
        </div>
      )}
      
      {cameraMode === 'chase' && (
        <Card className="absolute bottom-4 right-4 p-3 bg-background/90 backdrop-blur-sm w-64" data-testid="panel-chase-controls">
          <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Captain Controls
          </h4>
          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Move</span>
              <span className="text-foreground">WASD / Arrows</span>
            </div>
            <div className="flex justify-between">
              <span>Jump (chain for combos)</span>
              <span className="text-foreground">Space</span>
            </div>
            <div className="flex justify-between">
              <span>Melee Combo</span>
              <span className="text-foreground">Left Click</span>
            </div>
            <div className="flex justify-between">
              <span>Dive / Slide / Dodge</span>
              <span className="text-foreground">Right Click</span>
            </div>
            <div className="flex justify-between">
              <span>Camera</span>
              <span className="text-foreground">Mouse Move</span>
            </div>
            <div className="flex justify-between">
              <span>Return to Ship</span>
              <span className="text-foreground">Tab</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
            <p>Left Click: 3-hit melee combo!</p>
            <p>Right Click in air: Falcon Kick dive!</p>
            <p>Right Click on ground: Slide attack!</p>
          </div>
        </Card>
      )}

      {!worldMapOpen && (
        <Minimap
          getViewer={() => ({
            x: mutableStateRef.current.playerPosition.x,
            z: mutableStateRef.current.playerPosition.z,
            rot: mutableStateRef.current.playerRotation,
          })}
          onExpand={() => setWorldMapOpen(true)}
          position="top-right"
        />
      )}

      <WorldMapOverlay
        isOpen={worldMapOpen}
        onClose={() => setWorldMapOpen(false)}
        playerPosition={{ x: mutableStateRef.current.playerPosition.x, z: mutableStateRef.current.playerPosition.z }}
        playerRotation={mutableStateRef.current.playerRotation}
      />
    </div>
  );
}
