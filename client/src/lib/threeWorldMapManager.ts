import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IslandGenerator } from './islandGenerator';
import { ClothSimulation, createClothGeometry, updateClothGeometry, type WindForce } from './clothPhysics';
import { OceanFloorManager } from './oceanFloorManager';
import { FishManager } from './fishManager';
import { CannonballEffects } from './cannonballEffects';
import { SHIP_PREFAB_CONFIGS, DEFAULT_SHIP_CONFIG, applyShipTextures, SHIP_TEXTURE_PATHS, loadShipTexture, getSharedSailMaterial, createSailMaterial } from './shipPrefabs';
import { ShipPartsManager, type DamageableShip } from './shipPartsManager';
import { OCEAN_PRESETS, DEFAULT_OCEAN_PRESET, type OceanColorPreset } from '@shared/gameDefinitions/oceanConfig';
import { Mario64Controller, DEFAULT_MARIO64_CONFIG, type Mario64Input, type Mario64ControllerConfig } from './mario64Controller';
import { captainManager } from './captainManager';
import { MeshyCharacterController } from './meshyCharacterController';
import { ShipPhysics, getWeatherSeverityLevel, type ShipPhysicsState } from './shipPhysics';
import { FlyingBossSystem, type FlyingBoss } from './flyingBossSystem';
import { SeaCreatureSystem } from './seaCreatureSystem';
import type { WeatherConfig } from './weatherSystem';
import type { Race } from '@shared/schema';
import { loadBoatTemplate } from './boatAssetLoader';
import { resolveBoatId } from '@shared/gameDefinitions/boatRegistry';

export type CameraMode = 'third-person' | 'birds-eye' | 'chase';

export interface WindState {
  direction: number;
  speed: number;
  gustFactor: number;
}

export type SailPosition = 0 | 1 | 2 | 3; // 0=furled, 1=partial, 2=deployed, 3=full

// Additional sail for multi-mast ships
export interface AdditionalSail {
  clothSim: ClothSimulation;
  clothGeometry: THREE.BufferGeometry;
  clothMesh: THREE.Mesh;
  boomMesh: THREE.Mesh;
  gaffMesh: THREE.Mesh;
  mastMesh: THREE.Mesh;
  mastOffset: number; // Z offset from center
  gaffY: number; // fixed top-yard height for this mast
  boomDeployedY: number; // boom height when fully lowered
  boomFurledY: number; // boom height when fully raised (bundled near the gaff)
}

export interface Ship3D {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  rotation: number;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  isPlayer: boolean;
  name: string;
  level: number;
  sailAngle: number;
  sailPosition: SailPosition;
  sailMesh?: THREE.Mesh;
  sailGroup?: THREE.Group;
  windMagicActive?: boolean;
  additionalSails?: AdditionalSail[]; // Multiple sails for bigger ships
  windPennant?: THREE.Group; // Masthead pennant that streams downwind (wind-direction cue)
  windMagicTimer?: number;
  clothSim?: ClothSimulation;
  clothGeometry?: THREE.BufferGeometry;
  clothMesh?: THREE.Mesh;
  // Boom and gaff wooden bars
  boomMesh?: THREE.Mesh;
  gaffMesh?: THREE.Mesh;
  // Smooth sail deployment (0-1 continuous value for blending)
  currentSailDeployment?: number;
  targetSailDeployment?: number;
  // Momentum physics
  momentum?: THREE.Vector3;
  // Ship physics system for wave interaction
  physics?: ShipPhysics;
  physicsState?: ShipPhysicsState;
  shipType?: string;
}

export interface Island3D {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  name: string;
  biome: string;
  discovered: boolean;
  faction?: string;
  hostility?: 'friendly' | 'neutral' | 'hostile' | 'contested';
  tier?: number;
  // Gameplay features
  gameplayType?: 'safe' | 'trading_post' | 'hostile' | 'claimable' | 'capital';
  hasTradingPost?: boolean;
  isClaimable?: boolean;
  isClaimed?: boolean;
  enemyCount?: number;
  hasBoss?: boolean;
  description?: string;
}

export interface Cannonball3D {
  id: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ownerId: string;
  damage: number;
  lifetime: number;
}

export interface Treasure3D {
  id: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  value: number;
  collected: boolean;
}

export interface TargetInfo {
  type: 'ship' | 'island' | 'treasure' | 'fish' | 'none';
  id: string;
  name: string;
  distance: number;
  health?: number;
  maxHealth?: number;
  value?: number;
  biome?: string;
  species?: string;
}

export class ThreeWorldMapManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private mainCamera: THREE.PerspectiveCamera;
  private birdsEyeCamera: THREE.OrthographicCamera;
  private activeCamera: THREE.Camera;
  private cameraMode: CameraMode = 'third-person';
  
  private water: THREE.Mesh | null = null;
  private sky: Sky | null = null;
  private sun: THREE.Vector3;
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private baseLightingState = { ambientIntensity: 0.5, directionalIntensity: 1.5, ambientColor: 0x404060 };
  private lightningFlashActive = false;
  
  private playerShip: Ship3D | null = null;
  private npcShips: Map<string, Ship3D> = new Map();
  private islands: Map<string, Island3D> = new Map();
  private cannonballs: Map<string, Cannonball3D> = new Map();
  private treasures: Map<string, Treasure3D> = new Map();
  
  private clock: THREE.Clock = new THREE.Clock();
  private container: HTMLElement | null = null;
  
  private cameraOffset = new THREE.Vector3(0, 15, -30);
  private cameraLookOffset = new THREE.Vector3(0, 0, 20);
  
  // Orbital camera controls (left click held)
  private orbitalCameraActive: boolean = false;
  private orbitalCameraAngle: number = 0;  // Horizontal angle offset
  private orbitalCameraPitch: number = 0;  // Vertical angle offset
  private orbitalCameraDistance: number = 35;
  private orbitalCameraReturning: boolean = false;
  private orbitalMouseDown: boolean = false;
  private orbitalLastMouseX: number = 0;
  private orbitalLastMouseY: number = 0;
  private orbitalBoundMouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private orbitalBoundMouseUpHandler: ((e: MouseEvent) => void) | null = null;
  private orbitalBoundMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private orbitalBoundMouseLeaveHandler: ((e: MouseEvent) => void) | null = null;
  
  private worldSize = 9000;  // 3x larger world
  
  // Day/night and weather systems
  private timeOfDay = 0.3;  // 0-1, 0.3 = morning
  private daySpeed = 0.01;  // Speed of day/night cycle
  private weatherState: 'clear' | 'cloudy' | 'stormy' | 'foggy' = 'clear';
  private weatherTimer = 300;  // Seconds until next weather change
  
  // Current weather config for ship physics
  private currentWeatherConfig: WeatherConfig = {
    state: 'clear',
    windDirection: 0,
    windStrength: 5,
    waveHeight: 0.2,
    waveFrequency: 0.8,
    rainIntensity: 0,
    cloudDensity: 0.05,
    visibility: 1.0,
    lightningFrequency: 0,
    fogDensity: 0,
  };
  
  // Sea life entities
  private seaLife: THREE.Group[] = [];
  private windStreaks: THREE.Points | null = null;
  private windStreakPositions: Float32Array | null = null;
  private windStreakOpacities: Float32Array | null = null;
  private waveTime = 0;
  private waveFoamParticles: THREE.Points | null = null;
  private waveFoamPositions: Float32Array | null = null;
  private waveFoamPhases: Float32Array | null = null;
  private rainParticles: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private rainVelocities: Float32Array | null = null;
  private lightningTimer: number = 0;
  private lightningFlashMesh: THREE.Mesh | null = null;
  
  // Enhanced ocean systems
  private oceanFloorManager: OceanFloorManager | null = null;
  private fishManager: FishManager | null = null;
  private cannonballEffects: CannonballEffects;
  private shipPartsManager: ShipPartsManager;
  private gltfLoader: GLTFLoader;
  private meshyShipLoaded: boolean = false;
  private meshyShipData: DamageableShip | null = null;
  private waterSurface: Water | null = null;
  
  // Enemy ship models cache
  private enemyShipModels: Map<string, THREE.Group> = new Map();
  private goblinModel: THREE.Group | null = null;
  private enemyShipModelsLoading: boolean = false;
  private goblinModelLoading: boolean = false;
  
  // Island enemy system
  private islandEnemyModels: Map<string, THREE.Group> = new Map();
  private islandEnemies: Map<string, { mesh: THREE.Group; islandId: string; type: string; position: THREE.Vector3; wanderTarget: THREE.Vector3; wanderTimer: number; mixer?: THREE.AnimationMixer }> = new Map();
  private islandEnemyModelsLoading: boolean = false;
  
  // Admin mode properties
  private importedObjects: Map<string, { mesh: THREE.Group; name: string; type: 'imported' }> = new Map();
  private selectedObjectId: string | null = null;
  private adminMode: boolean = false;
  
  // Chase camera mode - Mario 64 style character controller
  private chaseMode: boolean = false;
  private chaseController: Mario64Controller | null = null;
  private chaseCharacter: THREE.Group | null = null;
  private chaseCaptainId: string = 'chase-captain';
  private chaseCaptainRace: Race = 'human';
  /** Production default: grudge6 / fleet boats — Meshy is opt-in admin only. */
  private useMeshyCharacter: boolean = false;
  private meshyCharacterController: MeshyCharacterController | null = null;
  
  // Flying boss system
  private flyingBossSystem: FlyingBossSystem | null = null;
  private seaCreatureSystem: SeaCreatureSystem | null = null;
  private flyingBossSpawnTimer: number = 0;
  private flyingBossSpawnInterval: number = 120; // Try spawning every 2 minutes
  private chaseInput: Mario64Input = {
    moveX: 0, moveY: 0, cameraX: 0, cameraY: 0,
    jump: false, attack: false, action: false,
    cUp: false, cDown: false, cLeft: false, cRight: false
  };
  private chaseKeyState: { [key: string]: boolean } = {};
  private chaseBoundKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private chaseBoundKeyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private chaseBoundMouseHandler: ((e: MouseEvent) => void) | null = null;
  private chaseBoundMouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private chaseBoundMouseUpHandler: ((e: MouseEvent) => void) | null = null;
  
  private wind: WindState = {
    direction: Math.PI / 4,
    speed: 15,
    gustFactor: 1.0
  };
  
  // Dynamic wind system - targets for smooth transitions
  private windTargets = {
    direction: Math.random() * Math.PI * 2,  // Random starting direction
    speed: 10 + Math.random() * 15,           // Random starting speed (10-25)
    changeTimer: 0,                           // Timer until next wind change
    directionChangeInterval: 20 + Math.random() * 40,  // 20-60 seconds between direction changes
    speedChangeInterval: 8 + Math.random() * 12        // 8-20 seconds between speed changes
  };
  
  private aimingState: {
    isAiming: boolean;
    arcMesh: THREE.Line | null;
    targetMesh: THREE.Mesh | null;
    aimDirection: THREE.Vector3;
  } = {
    isAiming: false,
    arcMesh: null,
    targetMesh: null,
    aimDirection: new THREE.Vector3(0, 0, 1)
  };
  
  private islandGenerator: IslandGenerator;
  
  // Performance settings - reduced distances for better FPS
  private performanceConfig = {
    maxDelta: 1 / 15, // Cap delta to prevent physics explosions on lag spikes
    enableFrustumCulling: true,
    lodDistances: { near: 80, mid: 200, far: 400 },
    updateDistances: { fish: 250, effects: 350, npcAI: 400 },
    fogNear: 50,
    fogFar: 800,
    cameraFar: 900
  };
  
  // FPS tracking
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsAccumulator = 0;
  private currentFPS = 60;
  private frameTimes: number[] = [];
  
  public webglFailed = false;

  constructor() {
    this.islandGenerator = new IslandGenerator();
    try {
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
      });
    } catch {
      this.webglFailed = true;
      this.renderer = null as any;
    }
    if (this.webglFailed) {
      this.scene = new THREE.Scene();
      this.mainCamera = new THREE.PerspectiveCamera();
      this.birdsEyeCamera = new THREE.OrthographicCamera();
      this.activeCamera = this.mainCamera;
      this.sun = new THREE.Vector3();
      this.cannonballEffects = null as any;
      this.shipPartsManager = null as any;
      this.gltfLoader = null as any;
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.sortObjects = true;
    
    this.scene = new THREE.Scene();
    // Reduced fog distance for better performance - creates atmospheric effect
    this.scene.fog = new THREE.Fog(0x87ceeb, this.performanceConfig.fogNear, this.performanceConfig.fogFar);
    
    this.cannonballEffects = new CannonballEffects(this.scene);
    this.shipPartsManager = new ShipPartsManager(this.scene);
    this.gltfLoader = new GLTFLoader();
    
    this.mainCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      this.performanceConfig.cameraFar
    );
    this.mainCamera.position.set(0, 15, 30);
    
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 200;
    this.birdsEyeCamera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      2000
    );
    this.birdsEyeCamera.position.set(0, 500, 0);
    this.birdsEyeCamera.lookAt(0, 0, 0);
    
    this.activeCamera = this.mainCamera;
    
    this.sun = new THREE.Vector3();
    this.clock = new THREE.Clock();
    
    this.setupLighting();
    this.setupSkybox();
    this.setupOcean();
    
    // Initialize flying boss system
    this.flyingBossSystem = new FlyingBossSystem(this.scene);
    this.flyingBossSystem.setAttackCallback((bossId, targetType, targetId, damage) => {
      this.handleFlyingBossAttack(bossId, targetType, targetId, damage);
    });
    this.flyingBossSystem.setFireballHitCallback((fireballId, targetType, targetId, damage) => {
      this.handleFireballHit(fireballId, targetType, targetId, damage);
    });
    
    this.seaCreatureSystem = new SeaCreatureSystem(this.scene);
    this.seaCreatureSystem.preloadModels().catch(err => console.warn('[SeaCreatures] Failed to preload:', err));
    // Wire the canonical seabed-depth + land checks so the SeaCreatureSystem
    // clamps creatures the same way it does on /sailing and /island.
    // Without this, fish-class creatures had no floor and large creatures
    // (whale/manta/kraken) had neither floor nor any way to detect land —
    // they would drift up through the surface and beach themselves on
    // islands. The world map already maintains an oceanFloorManager with
    // island data, so we just hand it through.
    this.seaCreatureSystem.setOceanFloorDepth((x, z) => this.getOceanFloorDepth(x, z));
    this.seaCreatureSystem.setIsPointOnLand((x, z) => {
      for (const island of this.islands.values()) {
        const dx = x - island.position.x;
        const dz = z - island.position.z;
        if (dx * dx + dz * dz < island.radius * island.radius) return true;
      }
      return false;
    });
    
    this.createRainSystem();
  }
  
  private handleFlyingBossAttack(bossId: string, targetType: string, targetId: string, damage: number): void {
    if (targetType === 'ship') {
      if (targetId === 'player' && this.playerShip) {
        this.playerShip.health = Math.max(0, this.playerShip.health - damage);
        console.log(`[FlyingBoss] ${bossId} dive attacked player for ${damage} damage`);
      } else {
        const npc = this.npcShips.get(targetId);
        if (npc) {
          npc.health = Math.max(0, npc.health - damage);
          console.log(`[FlyingBoss] ${bossId} dive attacked ${targetId} for ${damage} damage`);
        }
      }
    }
  }
  
  private handleFireballHit(fireballId: string, targetType: string, targetId: string, damage: number): void {
    if (targetType === 'ship') {
      if (targetId === 'player' && this.playerShip) {
        this.playerShip.health = Math.max(0, this.playerShip.health - damage);
        console.log(`[FlyingBoss] Fireball hit player for ${damage} damage`);
      } else {
        const npc = this.npcShips.get(targetId);
        if (npc) {
          npc.health = Math.max(0, npc.health - damage);
          console.log(`[FlyingBoss] Fireball hit ${targetId} for ${damage} damage`);
        }
      }
    }
  }
  
  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x88aacc, 0.55);
    this.scene.add(this.ambientLight);
    
    this.directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.7);
    this.directionalLight.position.set(100, 100, 50);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 500;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.scene.add(this.directionalLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x1a3a5a, 0.4);
    this.scene.add(hemisphereLight);
  }
  
  private setupSkybox() {
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    this.scene.add(this.sky);
    
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;
    
    const phi = THREE.MathUtils.degToRad(88);
    const theta = THREE.MathUtils.degToRad(180);
    this.sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(this.sun);
  }
  
  private oceanPreset = DEFAULT_OCEAN_PRESET;
  
  private getOceanPreset(): OceanColorPreset {
    return OCEAN_PRESETS[this.oceanPreset] || OCEAN_PRESETS[DEFAULT_OCEAN_PRESET];
  }
  
  setOceanPreset(presetId: string): void {
    if (OCEAN_PRESETS[presetId]) {
      this.oceanPreset = presetId;
      this.updateOceanVisuals();
    }
  }
  
  private updateOceanVisuals(): void {
    const preset = this.getOceanPreset();
    
    if (this.waterSurface) {
      const uniforms = (this.waterSurface.material as THREE.ShaderMaterial).uniforms;
      uniforms['waterColor'].value.setHex(preset.waterColor);
      uniforms['sunColor'].value.setHex(preset.sunColor);
      uniforms['distortionScale'].value = preset.distortionScale;
      (this.waterSurface.material as THREE.ShaderMaterial).opacity = preset.alpha;
    }
    
    if (this.water) {
      const mat = this.water.material as THREE.MeshStandardMaterial;
      mat.color.setHex(preset.waterColorDeep);
      mat.opacity = preset.secondaryOpacity;
    }
    
    this.scene.fog = new THREE.Fog(preset.fogColor, preset.fogNear, preset.fogFar);
  }
  
  getAvailableOceanPresets(): string[] {
    return Object.keys(OCEAN_PRESETS);
  }
  
  getCurrentOceanPreset(): string {
    return this.oceanPreset;
  }
  
  private setupOcean() {
    // Initialize ocean floor manager with variable depth
    this.oceanFloorManager = new OceanFloorManager(this.scene, this.worldSize);
    
    // Get ocean preset for beautiful visuals (inline to avoid method binding issues in constructor)
    const preset = OCEAN_PRESETS[this.oceanPreset] || OCEAN_PRESETS[DEFAULT_OCEAN_PRESET];
    
    // Create water surface using Three.js Water shader with improved settings
    const waterGeometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 128, 128);
    
    this.waterSurface = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/waternormals.jpg',
        (texture) => {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(6, 6);
          // Crisper specular/reflection detail across the swell at grazing angles
          texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          texture.needsUpdate = true;
        }
      ),
      sunDirection: this.sun.clone().normalize(),
      sunColor: preset.sunColor,
      waterColor: preset.waterColor,
      distortionScale: preset.distortionScale,
      fog: true,
      alpha: preset.alpha,
    });
    
    this.waterSurface.rotation.x = -Math.PI / 2;
    this.waterSurface.position.y = -0.05;
    const waterMat = this.waterSurface.material as THREE.ShaderMaterial;
    waterMat.transparent = true;
    waterMat.opacity = preset.alpha;
    waterMat.uniforms['size'].value = 4.0;
    // Push reflector slightly back in depth so terrain shorelines win z-fights
    waterMat.polygonOffset = true;
    waterMat.polygonOffsetFactor = 1;
    waterMat.polygonOffsetUnits = 1;
    this.scene.add(this.waterSurface);
    
    // Set up fog for atmospheric depth
    this.scene.fog = new THREE.Fog(preset.fogColor, preset.fogNear, preset.fogFar);
    
    // Wave silhouette layer — sits just above the reflector and provides the
    // geometric wave shapes the user sees from the side. Translucent so the
    // reflection from the Water shader still reads through.
    const waveWaterGeometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 128, 128);
    const waveWaterMaterial = new THREE.MeshStandardMaterial({
      color: preset.waterColor,
      metalness: 0.05,
      roughness: 0.55,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      envMapIntensity: 0.6,
      depthWrite: false,
    });
    
    this.water = new THREE.Mesh(waveWaterGeometry, waveWaterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.05;
    this.water.renderOrder = 1;
    this.scene.add(this.water);
    
    // Create gentle wave foam particles with white borders
    this.createWaveFoamParticles(preset);
    
    // Create wind streak particles for visual wind effect
    this.createWindStreaks();
    
    // Grid helper adjusted for larger world
    const gridHelper = new THREE.GridHelper(this.worldSize, 180, 0x003366, 0x004488);
    gridHelper.position.y = 0.1;
    (gridHelper.material as THREE.Material).opacity = 0.08;
    (gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(gridHelper);
    
    // Initialize fish manager with depth function
    this.fishManager = new FishManager(
      this.scene,
      this.worldSize,
      (x: number, z: number) => this.getOceanFloorDepth(x, z)
    );
  }
  
  getOceanFloorDepth(x: number, z: number): number {
    if (this.oceanFloorManager) {
      return this.oceanFloorManager.getDepthAt(x, z);
    }
    return -30;
  }
  
  async initializeOceanLife(): Promise<void> {
    // Collect island positions for floor and fish managers
    const islandPositions: Array<{ position: THREE.Vector3; radius: number; biome?: string }> = [];
    this.islands.forEach((island) => {
      islandPositions.push({
        position: island.position.clone(),
        radius: island.radius,
        biome: island.biome,
      });
    });
    
    // Set island data and create floor mesh
    if (this.oceanFloorManager) {
      this.oceanFloorManager.setIslands(islandPositions);
      this.oceanFloorManager.createFloorMesh();
    }
    
    // Initialize Quaternius ocean fish (depth -2…-15 m, catchable + harpoonable)
    if (this.fishManager) {
      this.fishManager.setIslandPositions(
        islandPositions.map(i => i.position)
      );
      await this.fishManager.initialize();
    }

    // 9-sector ship tier showcases (raft + dock hull assets across the map)
    try {
      const { spawnAllSectorShipAssets } = await import('@/lib/oceanSectorAssets');
      await spawnAllSectorShipAssets(this.scene);
    } catch (e) {
      console.warn('[WorldMap] sector ship assets', e);
    }
  }

  /** Open-world fish under the boat (Quaternius CDN pack). */
  getFishManager(): FishManager | null {
    return this.fishManager;
  }

  /**
   * Rod catch: nearest catchable fish within radius of player/ship.
   * Returns XP payload or null.
   */
  tryCatchFishNear(pos: THREE.Vector3, radius = 12): {
    speciesName: string;
    catchXp: number;
  } | null {
    if (!this.fishManager) return null;
    const targets = this.fishManager.getCatchableNear(pos, radius);
    if (!targets.length) return null;
    // Prefer closest
    targets.sort(
      (a, b) => a.mesh.position.distanceToSquared(pos) - b.mesh.position.distanceToSquared(pos),
    );
    const hit = this.fishManager.harvestFish(targets[0]!.id);
    if (!hit) return null;
    return { speciesName: hit.speciesName, catchXp: hit.catchXp };
  }

  /**
   * Harpoon: nearest harpoonable fish within range (larger apex predators included).
   */
  tryHarpoonFishNear(pos: THREE.Vector3, radius = 40): {
    speciesName: string;
    catchXp: number;
  } | null {
    if (!this.fishManager) return null;
    const targets = this.fishManager.getHarpoonableNear(pos, radius);
    if (!targets.length) return null;
    targets.sort(
      (a, b) => a.mesh.position.distanceToSquared(pos) - b.mesh.position.distanceToSquared(pos),
    );
    const hit = this.fishManager.harvestFish(targets[0]!.id);
    if (!hit) return null;
    return { speciesName: hit.speciesName, catchXp: hit.catchXp };
  }
  
  private createSeaLife() {
    // Fish are now managed by FishManager with GLB models and boids behavior
    // This method only creates jellyfish for ambient underwater life
    
    // Create jellyfish
    for (let i = 0; i < 15; i++) {
      const jellyGroup = new THREE.Group();
      
      // Bell
      const bellGeometry = new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const bellMaterial = new THREE.MeshStandardMaterial({
        color: 0xff88ff,
        transparent: true,
        opacity: 0.6,
        metalness: 0.1,
        roughness: 0.3,
      });
      const bell = new THREE.Mesh(bellGeometry, bellMaterial);
      jellyGroup.add(bell);
      
      // Tentacles
      for (let t = 0; t < 8; t++) {
        const tentacleGeometry = new THREE.CylinderGeometry(0.05, 0.02, 3, 4);
        const tentacle = new THREE.Mesh(tentacleGeometry, bellMaterial);
        const angle = (t / 8) * Math.PI * 2;
        tentacle.position.set(
          Math.cos(angle) * 0.8,
          -1.5,
          Math.sin(angle) * 0.8
        );
        jellyGroup.add(tentacle);
      }
      
      jellyGroup.position.set(
        (Math.random() - 0.5) * this.worldSize * 0.6,
        -5 - Math.random() * 6,
        (Math.random() - 0.5) * this.worldSize * 0.6
      );
      (jellyGroup as any).floatOffset = Math.random() * Math.PI * 2;
      (jellyGroup as any).floatSpeed = 0.5 + Math.random() * 0.5;
      
      this.scene.add(jellyGroup);
      this.seaLife.push(jellyGroup);
    }
  }
  
  private createWaveFoamParticles(preset: OceanColorPreset) {
    const particleCount = 3000;
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const alphas = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.worldSize * 0.9;
      positions[i * 3 + 1] = 0.05 + Math.random() * 0.1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.worldSize * 0.9;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 2.0 + Math.random() * 4.0;
      alphas[i] = 0.3 + Math.random() * 0.4;
    }
    
    this.waveFoamPositions = positions;
    this.waveFoamPhases = phases;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        foamColor: { value: new THREE.Color(preset.foamColor) },
        waveHeight: { value: preset.waveHeight },
        waveSpeed: { value: preset.waveSpeed },
        // Synced with updateOceanWaves so foam sits on actual crests
        windDirX: { value: 0 },
        windDirZ: { value: 1 },
        windStrength: { value: 1.0 },
        weatherAmp: { value: 1.0 },
        weatherFreq: { value: 1.0 },
      },
      vertexShader: `
        attribute float phase;
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        varying float vEdge;
        uniform float time;
        uniform float waveHeight;
        uniform float waveSpeed;
        uniform float windDirX;
        uniform float windDirZ;
        uniform float windStrength;
        uniform float weatherAmp;
        uniform float weatherFreq;
        
        void main() {
          vec3 pos = position;
          // Mirror updateOceanWaves so the foam sits on real wave crests
          float windPhase  = (pos.x * windDirX + pos.z * windDirZ) * 0.012;
          float crossPhase = (pos.x * windDirZ - pos.z * windDirX) * 0.018;
          float w1 = sin(windPhase  + time * 0.6 * weatherFreq) * 0.9 * windStrength;
          float w2 = sin(crossPhase + time * 0.4 * weatherFreq) * 0.4 * weatherAmp;
          float w3 = sin((pos.x + pos.z) * 0.005 + time * 0.2) * 1.2 * weatherAmp;
          float ripple = sin(pos.x * 0.04 + pos.z * 0.03 + time * 1.5 * weatherFreq) * 0.18 * windStrength;
          float crest = w1 + w2 + w3 + ripple;
          // Sit just above the crest
          pos.y = 0.12 + crest;

          // Crests get bright foam, troughs fade out — this is what makes it look like real whitecaps
          float crestMask = smoothstep(0.6, 1.6, crest);
          float pulseAlpha = 0.5 + 0.5 * sin(time * 1.5 + phase);
          vAlpha = alpha * pulseAlpha * crestMask;
          vEdge = 0.3 + 0.7 * sin(time * 2.0 + phase * 2.0);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vEdge;
        uniform vec3 foamColor;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          float innerCircle = smoothstep(0.35, 0.25, dist);
          float outerRing = smoothstep(0.5, 0.4, dist) - smoothstep(0.4, 0.3, dist);
          
          vec3 innerColor = foamColor * 0.9;
          vec3 borderColor = vec3(1.0, 1.0, 1.0);
          
          vec3 finalColor = mix(innerColor, borderColor, outerRing * vEdge);
          float finalAlpha = vAlpha * (innerCircle + outerRing * 0.8);
          
          gl_FragColor = vec4(finalColor, finalAlpha * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.waveFoamParticles = new THREE.Points(geometry, material);
    this.scene.add(this.waveFoamParticles);
  }
  
  private createWindStreaks() {
    const streakCount = 1500;
    const positions = new Float32Array(streakCount * 3);
    const phases = new Float32Array(streakCount);
    const speeds = new Float32Array(streakCount);
    
    for (let i = 0; i < streakCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.worldSize * 0.8;
      positions[i * 3 + 1] = 0.3 + Math.random() * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.worldSize * 0.8;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.4 + Math.random() * 0.6;
    }
    
    this.windStreakPositions = positions;
    this.windStreakOpacities = phases;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) },
        windAngle: { value: 0.0 },
        windSpeed: { value: 15.0 },
        time: { value: 0 },
        worldHalfSize: { value: this.worldSize * 0.4 },
      },
      vertexShader: `
        attribute float phase;
        attribute float speed;
        varying float vOpacity;
        uniform float time;
        uniform float windAngle;
        uniform float windSpeed;
        uniform float worldHalfSize;
        
        void main() {
          float t = time * speed + phase;
          float fadePhase = mod(t, 6.283185);
          vOpacity = sin(fadePhase) * 0.5 + 0.5;
          
          vec3 pos = position;
          float windDirX = sin(windAngle);
          float windDirZ = cos(windAngle);
          float drift = mod(t * windSpeed * 0.5, worldHalfSize * 2.0);
          pos.x += windDirX * drift;
          pos.z += windDirZ * drift;
          
          pos.x = mod(pos.x + worldHalfSize, worldHalfSize * 2.0) - worldHalfSize;
          pos.z = mod(pos.z + worldHalfSize, worldHalfSize * 2.0) - worldHalfSize;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          float distFactor = 1.0 - clamp(length(pos.xz) / worldHalfSize, 0.0, 1.0);
          gl_PointSize = 3.0 + distFactor * 2.0;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        uniform vec3 color;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = vOpacity * 0.35 * smoothstep(0.5, 0.1, dist);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.windStreaks = new THREE.Points(geometry, material);
    this.scene.add(this.windStreaks);
  }
  
  private updateWindStreaks(delta: number) {
    if (!this.windStreaks) return;
    
    const material = this.windStreaks.material as THREE.ShaderMaterial;
    material.uniforms.time.value += delta;
    material.uniforms.windAngle.value = this.wind.direction;
    material.uniforms.windSpeed.value = this.wind.speed;
    
    // Adjust streak color based on wind intensity
    const windIntensity = this.wind.speed / 25;
    material.uniforms.color.value.setRGB(
      0.85 + windIntensity * 0.15,
      0.92 + windIntensity * 0.08,
      1.0
    );
  }
  
  private shoreFoamRings: THREE.Mesh[] = [];
  
  private createShoreFoamRing(radius: number): THREE.Mesh {
    // Flat ring sitting just above the water plane around an island. The shader
    // produces a soft animated wash that visually blends sand → water and hides
    // the harsh terrain/water seam that causes apparent z-fighting at the beach.
    const innerR = radius * 0.95;
    const outerR = radius * 1.55;
    const geom = new THREE.RingGeometry(innerR, outerR, 96, 1);
    geom.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time:      { value: 0 },
        innerR:    { value: innerR },
        outerR:    { value: outerR },
        foamColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        varying vec2 vLocalXZ;
        void main() {
          vLocalXZ = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vLocalXZ;
        uniform float time;
        uniform float innerR;
        uniform float outerR;
        uniform vec3 foamColor;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i + vec2(1,0)),
                c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          float r = length(vLocalXZ);
          float t = (r - innerR) / max(0.001, (outerR - innerR));
          if (t < 0.0 || t > 1.0) discard;

          // Inner edge: brightest wash; fades to open water
          float edge = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.55, 1.0, t));

          // Animated foam: slow outward sweep + tangential noise breakup
          float ang = atan(vLocalXZ.y, vLocalXZ.x);
          float sweep = sin(t * 8.0 - time * 0.9 + ang * 3.0) * 0.5 + 0.5;
          float n = noise(vec2(ang * 4.0, t * 6.0 + time * 0.4));
          float foam = edge * mix(0.55, 1.0, n) * (0.55 + 0.45 * sweep);

          // Tint blue-green at outer fade so it blends into the water
          vec3 col = mix(vec3(0.55, 0.78, 0.85), foamColor, smoothstep(0.0, 0.4, edge));
          gl_FragColor = vec4(col, foam * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(geom, mat);
    ring.renderOrder = 2; // draw on top of water silhouette layer
    this.shoreFoamRings.push(ring);
    return ring;
  }

  private updateShoreFoamRings(delta: number) {
    for (const ring of this.shoreFoamRings) {
      const m = ring.material as THREE.ShaderMaterial;
      if (m.uniforms?.time) m.uniforms.time.value += delta;
    }
  }
  
  private updateWaveFoamParticles(delta: number) {
    if (!this.waveFoamParticles) return;
    
    const material = this.waveFoamParticles.material as THREE.ShaderMaterial;
    material.uniforms.time.value += delta;
    // Pipe live wave parameters into foam shader so foam clings to real crests
    const wp = (this as any)._waveParams;
    if (wp) {
      material.uniforms.windDirX.value    = wp.windDirX;
      material.uniforms.windDirZ.value    = wp.windDirZ;
      material.uniforms.windStrength.value = wp.windStrength;
      material.uniforms.weatherAmp.value  = wp.amp;
      material.uniforms.weatherFreq.value = wp.freq;
    }
  }
  
  updateOceanWaves(delta: number) {
    this.waveTime += delta;
    
    // Update animated wind streaks
    this.updateWindStreaks(delta);
    
    // Update wave foam particles
    this.updateWaveFoamParticles(delta);
    
    // Weather amplifier — storms grow waves and choppiness
    const weatherAmp = 1.0 + (this.currentWeatherConfig?.waveHeight || 0) * 1.6;
    const weatherFreq = 1.0 + (this.currentWeatherConfig?.waveFrequency || 0) * 0.5;

    // Update Water shader time uniform with wind- and weather-influenced speed
    if (this.waterSurface) {
      const windFactor = 0.8 + (this.wind.speed / 25) * 0.4;
      const wmat = this.waterSurface.material as THREE.ShaderMaterial;
      wmat.uniforms['time'].value += delta * windFactor * weatherFreq;
      // Crank distortion + ripple size with weather
      if (wmat.uniforms['distortionScale']) {
        const baseDist = (this as any)._baseDistortion ?? wmat.uniforms['distortionScale'].value;
        (this as any)._baseDistortion = baseDist;
        const targetDist = baseDist * (1 + (this.currentWeatherConfig?.waveHeight || 0) * 1.8);
        wmat.uniforms['distortionScale'].value += (targetDist - wmat.uniforms['distortionScale'].value) * Math.min(1, delta * 1.5);
      }
    }
    
    if (!this.water) return;
    
    const geometry = this.water.geometry as THREE.PlaneGeometry;
    const positions = geometry.attributes.position.array as Float32Array;
    const vertexCount = positions.length / 3;
    
    // Wind-influenced wave direction
    const windDirX = Math.sin(this.wind.direction);
    const windDirZ = Math.cos(this.wind.direction);
    const windStrength = (this.wind.speed / 15) * weatherAmp;
    
    // Cache wave params for foam-particle sync (keep in step with water surface)
    (this as any)._waveParams = {
      windDirX, windDirZ, windStrength,
      time: this.waveTime, freq: weatherFreq, amp: weatherAmp,
    };

    // Multi-frequency Gerstner-style waves; every vertex (128² grid budget)
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      
      // Wind-aligned primary wave
      const windPhase = (x * windDirX + y * windDirZ) * 0.012;
      const wave1 = Math.sin(windPhase + this.waveTime * 0.6 * weatherFreq) * 0.9 * windStrength;
      
      // Cross-wind secondary wave (perpendicular)
      const crossPhase = (x * windDirZ - y * windDirX) * 0.018;
      const wave2 = Math.sin(crossPhase + this.waveTime * 0.4 * weatherFreq) * 0.4 * weatherAmp;
      
      // Low-frequency ground swell
      const wave3 = Math.sin((x + y) * 0.005 + this.waveTime * 0.2) * 1.2 * weatherAmp;
      
      // High-frequency wind-chop
      const ripple = Math.sin((x * 0.04 + y * 0.03) + this.waveTime * 1.5 * weatherFreq) * 0.18 * windStrength;
      
      // Sharper crests via mild cubic peakedness (Gerstner-style profile)
      const combined = wave1 + wave2 + wave3 + ripple;
      const sharp = combined + 0.18 * combined * Math.abs(combined) * 0.25;
      
      positions[i * 3 + 2] = sharp;
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Update fish manager with boids behavior
    if (this.fishManager) {
      const playerPos = this.playerShip?.position;
      this.fishManager.update(delta, playerPos);
    }
    
    // Animate jellyfish (legacy sea life that remain)
    this.seaLife.forEach((entity) => {
      const floatOffset = (entity as any).floatOffset || 0;
      const floatSpeed = (entity as any).floatSpeed || 0.5;
      const depth = this.getOceanFloorDepth(entity.position.x, entity.position.z);
      entity.position.y = Math.max(depth + 2, -5 + Math.sin(this.waveTime * floatSpeed + floatOffset) * 2);
      entity.rotation.y += delta * 0.2;
    });
  }
  
  updateDayNightCycle(delta: number) {
    this.timeOfDay = (this.timeOfDay + delta * this.daySpeed) % 1;
    
    if (!this.sky) return;
    
    const skyUniforms = this.sky.material.uniforms;
    
    // Sun position based on time of day (0=midnight, 0.5=noon)
    const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const elevation = Math.sin(sunAngle);
    const phi = THREE.MathUtils.degToRad(90 - elevation * 80);
    const theta = THREE.MathUtils.degToRad(180 + this.timeOfDay * 360);
    
    this.sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(this.sun);
    
    // Adjust sky colors based on time
    if (this.timeOfDay < 0.25 || this.timeOfDay > 0.75) {
      // Night
      skyUniforms['turbidity'].value = 2;
      skyUniforms['rayleigh'].value = 0.5;
      this.renderer.toneMappingExposure = 0.4;
      this.scene.fog = new THREE.Fog(0x0a0a20, 100, 2000);
    } else if (this.timeOfDay < 0.35 || this.timeOfDay > 0.65) {
      // Dawn/Dusk
      skyUniforms['turbidity'].value = 15;
      skyUniforms['rayleigh'].value = 4;
      this.renderer.toneMappingExposure = 0.7;
      this.scene.fog = new THREE.Fog(0xff8844, 150, 3000);
    } else {
      // Day
      skyUniforms['turbidity'].value = 10;
      skyUniforms['rayleigh'].value = 2;
      this.renderer.toneMappingExposure = 0.95;
      this.scene.fog = new THREE.Fog(0x87ceeb, 200, 4500);
    }
  }
  
  updateWeather(delta: number) {
    this.weatherTimer -= delta;
    
    if (this.weatherTimer <= 0) {
      // Change weather
      const weathers: Array<'clear' | 'cloudy' | 'stormy' | 'foggy'> = ['clear', 'cloudy', 'stormy', 'foggy'];
      const weights = [0.5, 0.25, 0.15, 0.1];  // Clear is most common
      const rand = Math.random();
      let cumWeight = 0;
      for (let i = 0; i < weathers.length; i++) {
        cumWeight += weights[i];
        if (rand < cumWeight) {
          this.weatherState = weathers[i];
          break;
        }
      }
      this.weatherTimer = 120 + Math.random() * 300;  // 2-7 minutes
    }
    
    // Apply weather effects
    switch (this.weatherState) {
      case 'stormy':
        this.wind.speed = 25 + Math.random() * 10;
        this.wind.gustFactor = 1.2 + Math.random() * 0.5;
        break;
      case 'cloudy':
        this.wind.speed = 12 + Math.random() * 5;
        this.wind.gustFactor = 0.9 + Math.random() * 0.2;
        break;
      case 'foggy':
        this.wind.speed = 5 + Math.random() * 5;
        this.scene.fog = new THREE.Fog(0x888888, 50, 500);
        break;
      default:
        this.wind.speed = 15;
        this.wind.gustFactor = 0.9 + Math.random() * 0.2;
    }
    
    if (this.rainParticles && this.rainPositions && this.rainVelocities) {
      const isRaining = this.weatherState === 'stormy';
      this.rainParticles.visible = isRaining;
      
      if (isRaining && this.playerShip) {
        const playerPos = this.playerShip.position;
        
        for (let i = 0; i < this.rainVelocities.length; i++) {
          this.rainPositions[i * 3 + 1] -= this.rainVelocities[i] * delta;
          
          if (this.rainPositions[i * 3 + 1] < -5) {
            this.rainPositions[i * 3] = playerPos.x + (Math.random() - 0.5) * 400;
            this.rainPositions[i * 3 + 1] = 100 + Math.random() * 100;
            this.rainPositions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 400;
          }
        }
        
        (this.rainParticles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    }
    
    if (this.ambientLight && this.directionalLight) {
      if (this.weatherState === 'stormy') {
        this.ambientLight.intensity = 0.2;
        this.directionalLight.intensity = 0.4;
        this.scene.fog = new THREE.Fog(0x333344, 30, 400);
      } else if (this.weatherState === 'foggy') {
        this.ambientLight.intensity = 0.35;
        this.directionalLight.intensity = 0.8;
      } else if (this.weatherState === 'cloudy') {
        this.ambientLight.intensity = 0.4;
        this.directionalLight.intensity = 1.0;
        this.scene.fog = new THREE.Fog(0x778899, 100, 600);
      } else {
        this.ambientLight.intensity = 0.5;
        this.directionalLight.intensity = 1.5;
        this.scene.fog = new THREE.Fog(0x87ceeb, this.performanceConfig.fogNear, this.performanceConfig.fogFar);
      }
    }
    
    if (this.weatherState === 'stormy') {
      this.lightningTimer -= delta;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 3 + Math.random() * 8;
        this.triggerLightningFlash();
      }
    }
  }
  
  private triggerLightningFlash(): void {
    if (this.ambientLight) {
      const originalIntensity = this.ambientLight.intensity;
      this.ambientLight.intensity = 3.0;
      this.ambientLight.color.setHex(0xccccff);
      
      setTimeout(() => {
        if (this.ambientLight) {
          this.ambientLight.intensity = 0.2;
          this.ambientLight.color.setHex(0x404060);
        }
      }, 100);
      
      setTimeout(() => {
        if (this.ambientLight) {
          this.ambientLight.intensity = 2.0;
          this.ambientLight.color.setHex(0xccccff);
        }
      }, 200);
      
      setTimeout(() => {
        if (this.ambientLight) {
          this.ambientLight.intensity = originalIntensity;
          this.ambientLight.color.setHex(0x404060);
        }
      }, 300);
    }
  }
  
  private createRainSystem(): void {
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 400;
      positions[i * 3 + 1] = Math.random() * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
      velocities[i] = 30 + Math.random() * 20;
    }
    
    this.rainPositions = positions;
    this.rainVelocities = velocities;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xaaaacc,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    
    this.rainParticles = new THREE.Points(geometry, material);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }
  
  getWeatherState() {
    return this.weatherState;
  }
  
  getTimeOfDay() {
    return this.timeOfDay;
  }
  
  mount(container: HTMLElement) {
    this.container = container;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    
    this.updateCameraAspect(container.clientWidth, container.clientHeight);
    
    window.addEventListener('resize', this.handleResize);
    this.setupOrbitalCameraHandlers();
  }
  
  unmount() {
    window.removeEventListener('resize', this.handleResize);
    this.cleanupOrbitalCameraHandlers();
    
    if (this.container && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.container = null;
  }
  
  private setupOrbitalCameraHandlers(): void {
    this.orbitalBoundMouseDownHandler = (e: MouseEvent) => {
      if (e.button === 0 && this.cameraMode === 'third-person' && !this.chaseMode) {
        this.orbitalMouseDown = true;
        this.orbitalCameraActive = true;
        this.orbitalCameraReturning = false;
        this.orbitalLastMouseX = e.clientX;
        this.orbitalLastMouseY = e.clientY;
        e.preventDefault();
      }
    };
    
    this.orbitalBoundMouseUpHandler = (e: MouseEvent) => {
      if (e.button === 0 && this.orbitalMouseDown) {
        this.orbitalMouseDown = false;
        this.orbitalCameraReturning = true;
      }
    };
    
    this.orbitalBoundMouseMoveHandler = (e: MouseEvent) => {
      if (this.orbitalMouseDown && this.orbitalCameraActive) {
        const deltaX = e.clientX - this.orbitalLastMouseX;
        const deltaY = e.clientY - this.orbitalLastMouseY;
        
        this.orbitalCameraAngle -= deltaX * 0.005;
        this.orbitalCameraPitch = Math.max(-0.8, Math.min(0.8, this.orbitalCameraPitch - deltaY * 0.003));
        
        this.orbitalLastMouseX = e.clientX;
        this.orbitalLastMouseY = e.clientY;
      }
    };
    
    this.orbitalBoundMouseLeaveHandler = () => {
      if (this.orbitalMouseDown) {
        this.orbitalMouseDown = false;
        this.orbitalCameraReturning = true;
      }
    };
    
    if (this.container) {
      this.container.addEventListener('mousedown', this.orbitalBoundMouseDownHandler);
      this.container.addEventListener('mouseup', this.orbitalBoundMouseUpHandler);
      this.container.addEventListener('mousemove', this.orbitalBoundMouseMoveHandler);
      this.container.addEventListener('mouseleave', this.orbitalBoundMouseLeaveHandler);
    }
  }
  
  private cleanupOrbitalCameraHandlers(): void {
    if (this.container) {
      if (this.orbitalBoundMouseDownHandler) {
        this.container.removeEventListener('mousedown', this.orbitalBoundMouseDownHandler);
      }
      if (this.orbitalBoundMouseUpHandler) {
        this.container.removeEventListener('mouseup', this.orbitalBoundMouseUpHandler);
      }
      if (this.orbitalBoundMouseMoveHandler) {
        this.container.removeEventListener('mousemove', this.orbitalBoundMouseMoveHandler);
      }
      if (this.orbitalBoundMouseLeaveHandler) {
        this.container.removeEventListener('mouseleave', this.orbitalBoundMouseLeaveHandler);
      }
    }
    this.orbitalBoundMouseDownHandler = null;
    this.orbitalBoundMouseUpHandler = null;
    this.orbitalBoundMouseMoveHandler = null;
    this.orbitalBoundMouseLeaveHandler = null;
  }
  
  private handleResize = () => {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.renderer.setSize(width, height);
    this.updateCameraAspect(width, height);
  };
  
  private updateCameraAspect(width: number, height: number) {
    this.mainCamera.aspect = width / height;
    this.mainCamera.updateProjectionMatrix();
    
    const aspect = width / height;
    const frustumSize = 200;
    this.birdsEyeCamera.left = -frustumSize * aspect / 2;
    this.birdsEyeCamera.right = frustumSize * aspect / 2;
    this.birdsEyeCamera.top = frustumSize / 2;
    this.birdsEyeCamera.bottom = -frustumSize / 2;
    this.birdsEyeCamera.updateProjectionMatrix();
  }
  
  setCameraMode(mode: CameraMode) {
    const previousMode = this.cameraMode;
    this.cameraMode = mode;
    
    if (mode === 'chase') {
      this.enterChaseMode();
      this.activeCamera = this.mainCamera;
    } else {
      if (previousMode === 'chase') {
        this.exitChaseMode();
      }
      this.activeCamera = mode === 'third-person' ? this.mainCamera : this.birdsEyeCamera;
    }
  }
  
  getCameraMode(): CameraMode {
    return this.cameraMode;
  }
  
  isInChaseMode(): boolean {
    return this.chaseMode;
  }
  
  toggleChaseMode(): void {
    if (this.chaseMode) {
      this.setCameraMode('third-person');
    } else {
      this.setCameraMode('chase');
    }
  }
  
  private enterChaseMode(): void {
    if (!this.playerShip || this.chaseMode) return;
    
    this.chaseMode = true;
    
    // Create character on ship deck
    this.createChaseCharacter();
    
    // Get ship config for appropriate scaling
    const prefabConfig = SHIP_PREFAB_CONFIGS[this.playerShip.shipType ?? 'sloop'] || SHIP_PREFAB_CONFIGS.sloop;
    const shipLength = prefabConfig.hullScale.z;
    
    // Scale camera based on ship size - smaller character needs closer camera
    const cameraDistance = Math.max(3, shipLength * 0.25);
    const cameraHeight = Math.max(1.5, shipLength * 0.12);
    
    // Initialize Mario64 controller with scaled config for ship deck
    const shipConfig: Mario64ControllerConfig = {
      ...DEFAULT_MARIO64_CONFIG,
      maxSpeed: 2.5,              // Slower walking for small character
      cameraDistance: cameraDistance,
      cameraHeight: cameraHeight,
      cameraPitch: 0.5,
      gravity: 15,
      jumpVelocity: 6,
    };
    
    this.chaseController = new Mario64Controller(shipConfig);
    
    // Position character at center of ship deck
    const shipPos = this.playerShip.mesh.position;
    const deckHeight = prefabConfig.hullScale.y + 0.3;
    this.chaseController.character.position.set(shipPos.x, shipPos.y + deckHeight, shipPos.z);
    this.chaseController.camera.yaw = this.playerShip.rotation;
    
    // Set up input handlers
    this.setupChaseInputHandlers();
    
    // Request pointer lock for mouse camera control
    if (this.container) {
      this.container.requestPointerLock();
    }
  }
  
  private exitChaseMode(): void {
    this.chaseMode = false;
    
    // Remove character from scene and clean up captain
    if (this.chaseCharacter) {
      this.scene.remove(this.chaseCharacter);
      this.chaseCharacter = null;
      captainManager.removeCaptain(this.chaseCaptainId);
    }
    
    // Clean up Meshy character controller
    if (this.meshyCharacterController) {
      this.meshyCharacterController.dispose();
      this.meshyCharacterController = null;
    }
    
    // Clean up controller
    this.chaseController = null;
    
    // Remove input handlers
    this.cleanupChaseInputHandlers();
    
    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  
  toggleMeshyCharacter(): void {
    this.useMeshyCharacter = !this.useMeshyCharacter;
    console.log(`Meshy character ${this.useMeshyCharacter ? 'enabled' : 'disabled'}`);
    if (this.chaseMode) {
      this.createChaseCharacter();
    }
  }
  
  isUsingMeshyCharacter(): boolean {
    return this.useMeshyCharacter;
  }
  
  setCaptainRace(race: Race): void {
    this.chaseCaptainRace = race;
    if (this.chaseMode && this.chaseCharacter) {
      this.createChaseCharacter();
    }
    console.log(`Captain race set to: ${race}`);
  }
  
  getCaptainRace(): Race {
    return this.chaseCaptainRace;
  }
  
  cycleCaptainRace(): Race {
    const races: Race[] = ['human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead'];
    const currentIndex = races.indexOf(this.chaseCaptainRace);
    const nextIndex = (currentIndex + 1) % races.length;
    const nextRace = races[nextIndex];
    this.setCaptainRace(nextRace);
    return nextRace;
  }
  
  async preloadCaptainModels(): Promise<void> {
    await captainManager.preloadAllRaces();
  }
  
  private async createChaseCharacter(): Promise<void> {
    if (this.chaseCharacter) {
      this.scene.remove(this.chaseCharacter);
      captainManager.removeCaptain(this.chaseCaptainId);
    }
    
    if (this.meshyCharacterController) {
      this.meshyCharacterController.dispose();
      this.meshyCharacterController = null;
    }
    
    if (this.useMeshyCharacter) {
      try {
        this.meshyCharacterController = new MeshyCharacterController();
        const model = await this.meshyCharacterController.load();
        
        if (model && this.playerShip) {
          this.chaseCharacter = model;
          
          const shipPos = this.playerShip.mesh.position;
          const prefabConfig = SHIP_PREFAB_CONFIGS[this.playerShip.shipType ?? 'sloop'] || SHIP_PREFAB_CONFIGS.sloop;
          const deckHeight = prefabConfig.hullScale.y + 0.3;
          this.meshyCharacterController.setPosition(
            new THREE.Vector3(shipPos.x, shipPos.y + deckHeight, shipPos.z)
          );
          this.meshyCharacterController.setRotation(this.playerShip.rotation);
          
          this.scene.add(this.chaseCharacter);
          console.log('Created Meshy AI character with animations:', 
            this.meshyCharacterController.getAnimationNames());
          return;
        }
      } catch (error) {
        console.warn('Failed to load Meshy character, falling back to captain:', error);
      }
    }
    
    try {
      const captain = await captainManager.createCaptain(this.chaseCaptainId, this.chaseCaptainRace);
      this.chaseCharacter = captain.model;
      
      // Small captain scale proportional to ship
      this.chaseCharacter.scale.setScalar(0.4);
      
      this.scene.add(this.chaseCharacter);
      
      console.log(`Created chase captain with race: ${this.chaseCaptainRace}`);
    } catch (error) {
      console.warn('Failed to load FBX captain, using fallback:', error);
      this.createFallbackChaseCharacter();
    }
  }
  
  private createFallbackChaseCharacter(): void {
    const character = new THREE.Group();
    character.scale.setScalar(0.35);  // Small captain on deck
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x442200 });
    
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.5),
      bodyMat
    );
    torso.position.y = 1.8;
    character.add(torso);
    
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      skinMat
    );
    head.position.y = 2.8;
    character.add(head);
    
    const hatBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8),
      hatMat
    );
    hatBrim.position.y = 3.1;
    character.add(hatBrim);
    
    const hatTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.35, 0.3, 8),
      hatMat
    );
    hatTop.position.y = 3.3;
    character.add(hatTop);
    
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.55, 1.8, 0);
    leftArm.rotation.z = 0.2;
    character.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo.clone(), bodyMat);
    rightArm.position.set(0.55, 1.8, 0);
    rightArm.rotation.z = -0.2;
    character.add(rightArm);
    
    const legGeo = new THREE.CylinderGeometry(0.15, 0.12, 1, 8);
    const leftLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    leftLeg.position.set(-0.2, 0.6, 0);
    character.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    rightLeg.position.set(0.2, 0.6, 0);
    character.add(rightLeg);
    
    const bootGeo = new THREE.BoxGeometry(0.2, 0.15, 0.35);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.2, 0.08, 0.05);
    character.add(leftBoot);
    
    const rightBoot = new THREE.Mesh(bootGeo.clone(), bootMat);
    rightBoot.position.set(0.2, 0.08, 0.05);
    character.add(rightBoot);
    
    this.chaseCharacter = character;
    this.scene.add(character);
  }
  
  private setupChaseInputHandlers(): void {
    this.cleanupChaseInputHandlers();
    
    this.chaseBoundKeyHandler = (e: KeyboardEvent) => {
      this.chaseKeyState[e.code] = true;
      this.updateChaseInput();
      
      // Space for jump
      if (e.code === 'Space') {
        this.chaseInput.jump = true;
      }
      
      // Tab to exit chase mode
      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleChaseMode();
      }
    };
    
    this.chaseBoundKeyUpHandler = (e: KeyboardEvent) => {
      this.chaseKeyState[e.code] = false;
      this.updateChaseInput();
      
      if (e.code === 'Space') {
        this.chaseInput.jump = false;
      }
    };
    
    this.chaseBoundMouseHandler = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      
      this.chaseInput.cameraX = e.movementX * 0.002;
      this.chaseInput.cameraY = e.movementY * 0.002;
    };
    
    // Mouse buttons for attack/action
    this.chaseBoundMouseDownHandler = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left click = melee combo attack
        this.chaseInput.attack = true;
      } else if (e.button === 2) {
        // Right click = action (dive bomb / slide / dodge)
        this.chaseInput.action = true;
      }
    };
    
    this.chaseBoundMouseUpHandler = (e: MouseEvent) => {
      if (e.button === 0) {
        this.chaseInput.attack = false;
      } else if (e.button === 2) {
        this.chaseInput.action = false;
      }
    };
    
    window.addEventListener('keydown', this.chaseBoundKeyHandler);
    window.addEventListener('keyup', this.chaseBoundKeyUpHandler);
    window.addEventListener('mousemove', this.chaseBoundMouseHandler);
    window.addEventListener('mousedown', this.chaseBoundMouseDownHandler);
    window.addEventListener('mouseup', this.chaseBoundMouseUpHandler);
  }
  
  private cleanupChaseInputHandlers(): void {
    if (this.chaseBoundKeyHandler) {
      window.removeEventListener('keydown', this.chaseBoundKeyHandler);
      this.chaseBoundKeyHandler = null;
    }
    if (this.chaseBoundKeyUpHandler) {
      window.removeEventListener('keyup', this.chaseBoundKeyUpHandler);
      this.chaseBoundKeyUpHandler = null;
    }
    if (this.chaseBoundMouseHandler) {
      window.removeEventListener('mousemove', this.chaseBoundMouseHandler);
      this.chaseBoundMouseHandler = null;
    }
    if (this.chaseBoundMouseDownHandler) {
      window.removeEventListener('mousedown', this.chaseBoundMouseDownHandler);
      this.chaseBoundMouseDownHandler = null;
    }
    if (this.chaseBoundMouseUpHandler) {
      window.removeEventListener('mouseup', this.chaseBoundMouseUpHandler);
      this.chaseBoundMouseUpHandler = null;
    }
    this.chaseKeyState = {};
  }
  
  private updateChaseInput(): void {
    const ks = this.chaseKeyState;
    
    // WASD / Arrow movement
    this.chaseInput.moveX = 0;
    this.chaseInput.moveY = 0;
    
    if (ks['KeyW'] || ks['ArrowUp']) this.chaseInput.moveY = 1;
    if (ks['KeyS'] || ks['ArrowDown']) this.chaseInput.moveY = -1;
    if (ks['KeyA'] || ks['ArrowLeft']) this.chaseInput.moveX = -1;
    if (ks['KeyD'] || ks['ArrowRight']) this.chaseInput.moveX = 1;
    
    // C-buttons for camera (IJKL)
    this.chaseInput.cUp = ks['KeyI'] || false;
    this.chaseInput.cDown = ks['KeyK'] || false;
    this.chaseInput.cLeft = ks['KeyJ'] || false;
    this.chaseInput.cRight = ks['KeyL'] || false;
  }
  
  private updateChaseCamera(delta: number): void {
    if (!this.chaseController || !this.chaseCharacter || !this.playerShip) return;
    
    const shipPos = this.playerShip.mesh.position;
    const shipConfig = SHIP_PREFAB_CONFIGS[this.playerShip.shipType ?? 'sloop'] || SHIP_PREFAB_CONFIGS.sloop;
    const deckHeight = shipConfig.hullScale.y + 0.3;
    const deckY = shipPos.y + deckHeight;
    const halfWidth = (shipConfig?.hullScale?.x || 4) / 2;
    const halfLength = (shipConfig?.hullScale?.z || 12) / 2;
    
    // Water level is at Y=0 (sea level)
    const waterLevel = 0;
    const oceanFloor = -10; // Arbitrary ocean floor depth
    
    const isMoving = Math.abs(this.chaseInput.moveX) > 0.1 || Math.abs(this.chaseInput.moveY) > 0.1;
    const isRunning = this.chaseKeyState['ShiftLeft'] || this.chaseKeyState['ShiftRight'] || false;
    
    const charState = this.chaseController.character;
    
    // Check if character is on the ship deck (within ship bounds)
    const localX = charState.position.x - shipPos.x;
    const localZ = charState.position.z - shipPos.z;
    const isOnShip = Math.abs(localX) <= halfWidth && Math.abs(localZ) <= halfLength;
    
    // Determine ground height - deck if on ship, ocean floor if in water
    const groundY = isOnShip ? deckY : oceanFloor;
    
    if (this.meshyCharacterController && this.meshyCharacterController.isLoaded()) {
      this.meshyCharacterController.update(delta, {
        moveX: this.chaseInput.moveX,
        moveY: this.chaseInput.moveY,
        isRunning: isRunning,
        turnAmount: 0
      });
      
      const charPos = this.meshyCharacterController.getPosition();
      const mLocalX = charPos.x - shipPos.x;
      const mLocalZ = charPos.z - shipPos.z;
      
      // Only constrain if on ship
      if (Math.abs(mLocalX) <= halfWidth && Math.abs(mLocalZ) <= halfLength) {
        charPos.y = deckY;
        this.meshyCharacterController.setPosition(charPos);
      }
      
      this.chaseController.character.position.copy(this.meshyCharacterController.getPosition());
      this.chaseController.character.faceAngle = this.meshyCharacterController.getRotation();
    } else {
      this.chaseController.setInput(this.chaseInput);
      
      // Pass water level for swimming detection
      this.chaseController.update(delta, groundY, waterLevel);
      
      // If on ship deck, constrain position and set to deck height
      if (isOnShip && charState.isGrounded) {
        charState.position.y = deckY;
      }
      
      // Allow falling off ship - character will fall into water
      // If swimming, let them move freely and climb back onto ship
      if (charState.isSwimming) {
        // If character swims back under ship, check if they can climb up
        const nearShip = Math.abs(localX) <= halfWidth + 1 && Math.abs(localZ) <= halfLength + 1;
        if (nearShip && charState.position.y >= deckY - 0.5) {
          // Teleport onto deck if close enough and at deck height
          charState.position.y = deckY;
          charState.isSwimming = false;
          charState.velocity.y = 0;
          charState.isGrounded = true;
        }
      }
      
      this.chaseCharacter.position.copy(charState.position);
      this.chaseCharacter.rotation.y = charState.faceAngle;
      
      // Update captain animations based on state
      const captain = captainManager.getCaptain(this.chaseCaptainId);
      if (captain) {
        const currentAnim = captain.currentAction?.getClip().name;
        
        // Check swimming state first
        if (charState.isSwimming) {
          if (isMoving && currentAnim !== 'run') {
            // Use run animation for swimming (if no swim animation available)
            captainManager.playAnimation(this.chaseCaptainId, 'run', 0.2);
          } else if (!isMoving && currentAnim !== 'idle') {
            captainManager.playAnimation(this.chaseCaptainId, 'idle', 0.2);
          }
        } else if (isMoving && currentAnim !== 'run') {
          captainManager.playAnimation(this.chaseCaptainId, 'run', 0.2);
        } else if (!isMoving && currentAnim !== 'idle') {
          captainManager.playAnimation(this.chaseCaptainId, 'idle', 0.2);
        }
      }
    }
    
    this.chaseInput.cameraX = 0;
    this.chaseInput.cameraY = 0;
    
    this.chaseController.setInput(this.chaseInput);
    
    const camState = this.chaseController.camera;
    this.mainCamera.position.copy(camState.position);
    this.mainCamera.lookAt(camState.focus);
  }
  
  createPlayerShip(id: string, position: THREE.Vector3, name: string = 'Captain', shipType: string = 'sloop'): Ship3D {
    const config = SHIP_PREFAB_CONFIGS[shipType] || SHIP_PREFAB_CONFIGS.sloop;
    
    const shipGroup = new THREE.Group();
    const innerGroup = new THREE.Group();
    
    const hullGeometry = new THREE.BoxGeometry(
      config.hullScale.x,
      config.hullScale.y,
      config.hullScale.z
    );
    const hullMaterial = new THREE.MeshStandardMaterial({ 
      color: config.hullColor,
      roughness: 0.8,
      metalness: 0.1
    });
    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    hull.position.y = config.hullScale.y / 2;
    innerGroup.add(hull);
    
    const deckGeometry = new THREE.BoxGeometry(
      config.hullScale.x * 0.9,
      0.3,
      config.hullScale.z * 0.9
    );
    const deckMaterial = new THREE.MeshStandardMaterial({ 
      color: config.deckColor,
      roughness: 0.9
    });
    const deck = new THREE.Mesh(deckGeometry, deckMaterial);
    deck.position.y = config.hullScale.y + 0.15;
    innerGroup.add(deck);
    
    const mastGeometry = new THREE.CylinderGeometry(
      config.mastRadius * 0.7,
      config.mastRadius,
      config.mastHeight,
      8
    );
    const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.set(0, config.hullScale.y + config.mastHeight / 2, 0);
    innerGroup.add(mast);
    
    // Full mainsail: the canvas runs the length of the center beam — from just
    // above the deck up to just below the crow's nest — so it spans the whole
    // mast. The cloth height is sized to that span so it hangs at rest (no
    // stretching) when fully lowered, and reacts naturally to wind.
    const deckY = config.hullScale.y;
    const crowsNestY = config.hullScale.y + config.mastHeight + 0.5;
    const boomY = deckY + 0.4;        // boom sits just above the deck (fully lowered)
    const gaffY = crowsNestY - 0.5;   // top yard just below the crow's nest
    const sailSpan = gaffY - boomY;   // canvas height == center-beam length

    const clothSim = new ClothSimulation(
      config.sailWidth,
      sailSpan,
      config.sailSegmentsX,
      config.sailSegmentsY
    );
    
    clothSim.pinForGaffRig();
    clothSim.setGaffRigPositions(gaffY, boomY);
    
    const clothGeometry = createClothGeometry(clothSim);
    
    // Create temporary sail material, will be replaced with textured one
    const sailMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      side: THREE.DoubleSide,
      roughness: 0.9
    });
    
    const clothMesh = new THREE.Mesh(clothGeometry, sailMaterial);
    clothMesh.name = 'cloth_sail'; // Name it so it won't be hidden
    
    // Apply textured sail material asynchronously
    createSailMaterial().then(texturedMat => {
      clothMesh.material = texturedMat;
    });
    clothMesh.position.set(0, 0, 0);
    clothMesh.rotation.y = Math.PI / 2; // Rotate to align local X with world Z (boom/gaff direction)
    innerGroup.add(clothMesh);
    
    // Create boom (bottom wooden bar) and gaff (top wooden bar)
    const boomLength = config.sailWidth * 1.1;
    const boomRadius = config.mastRadius * 0.6;
    const boomGeometry = new THREE.CylinderGeometry(boomRadius * 0.8, boomRadius, boomLength, 8);
    boomGeometry.rotateX(Math.PI / 2); // Rotate to be horizontal
    const boomMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4328 });
    
    const boomMesh = new THREE.Mesh(boomGeometry, boomMaterial);
    boomMesh.position.set(0, boomY, boomLength / 2); // Extends from mast outward
    innerGroup.add(boomMesh);
    
    const gaffGeometry = new THREE.CylinderGeometry(boomRadius * 0.7, boomRadius * 0.9, boomLength * 0.9, 8);
    gaffGeometry.rotateX(Math.PI / 2);
    const gaffMesh = new THREE.Mesh(gaffGeometry, boomMaterial.clone());
    gaffMesh.position.set(0, gaffY, (boomLength * 0.9) / 2);
    innerGroup.add(gaffMesh);
    
    // Create crow's nest with lantern at top of mast (crowsNestY defined above)
    
    // Crow's nest platform (circular wooden platform)
    const nestPlatformGeometry = new THREE.CylinderGeometry(0.8, 0.6, 0.3, 12);
    const nestMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const nestPlatform = new THREE.Mesh(nestPlatformGeometry, nestMaterial);
    nestPlatform.position.set(0, crowsNestY, 0);
    innerGroup.add(nestPlatform);
    
    // Crow's nest railing (ring around platform)
    const railingGeometry = new THREE.TorusGeometry(0.75, 0.05, 8, 16);
    const railingMesh = new THREE.Mesh(railingGeometry, nestMaterial.clone());
    railingMesh.position.set(0, crowsNestY + 0.4, 0);
    railingMesh.rotation.x = Math.PI / 2;
    innerGroup.add(railingMesh);
    
    // Lantern post
    const lanternPostGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
    const lanternPostMesh = new THREE.Mesh(lanternPostGeometry, nestMaterial.clone());
    lanternPostMesh.position.set(0, crowsNestY + 0.75, 0);
    innerGroup.add(lanternPostMesh);
    
    // Lantern housing (octagonal shape)
    const lanternHousingGeometry = new THREE.CylinderGeometry(0.15, 0.18, 0.4, 8);
    const lanternHousingMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a,
      metalness: 0.6,
      roughness: 0.4
    });
    const lanternHousing = new THREE.Mesh(lanternHousingGeometry, lanternHousingMaterial);
    lanternHousing.position.set(0, crowsNestY + 1.5, 0);
    innerGroup.add(lanternHousing);
    
    // Lantern glass (glowing center)
    const lanternGlassGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    const lanternGlassMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffaa44,
      emissive: 0xffaa44,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9
    });
    const lanternGlass = new THREE.Mesh(lanternGlassGeometry, lanternGlassMaterial);
    lanternGlass.position.set(0, crowsNestY + 1.5, 0);
    innerGroup.add(lanternGlass);
    
    // Lantern top cap
    const lanternCapGeometry = new THREE.ConeGeometry(0.12, 0.15, 8);
    const lanternCap = new THREE.Mesh(lanternCapGeometry, lanternHousingMaterial.clone());
    lanternCap.position.set(0, crowsNestY + 1.75, 0);
    innerGroup.add(lanternCap);
    
    // Point light for the lantern (illuminates at night)
    const lanternLight = new THREE.PointLight(0xffaa44, 15, 50, 2);
    lanternLight.position.set(0, crowsNestY + 1.5, 0);
    lanternLight.castShadow = false;
    innerGroup.add(lanternLight);
    
    const sailGeometry = new THREE.PlaneGeometry(config.sailWidth, config.sailHeight);
    const sail = new THREE.Mesh(sailGeometry, sailMaterial.clone());
    sail.position.set(0, config.hullScale.y + config.mastHeight * 0.5, 0.5);
    sail.rotation.y = Math.PI / 2;
    sail.visible = false;
    innerGroup.add(sail);
    
    if (config.hasFlag) {
      const flagGeometry = new THREE.PlaneGeometry(2, 1.5);
      const flagMaterial = new THREE.MeshStandardMaterial({ 
        color: config.sailColor,
        side: THREE.DoubleSide 
      });
      const flag = new THREE.Mesh(flagGeometry, flagMaterial);
      flag.position.set(0, config.hullScale.y + config.mastHeight + 1, 0);
      innerGroup.add(flag);
    }
    
    if (config.numCannons > 0) {
      const cannonsPerSide = Math.floor(config.numCannons / 2);
      for (let i = 0; i < cannonsPerSide; i++) {
        const zPos = -config.hullScale.z / 3 + (i / cannonsPerSide) * (config.hullScale.z * 0.6);
        
        const cannonGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
        cannonGeo.rotateZ(Math.PI / 2);
        const cannonMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
        
        const leftCannon = new THREE.Mesh(cannonGeo, cannonMat);
        leftCannon.position.set(-config.hullScale.x / 2 - 0.3, config.hullScale.y, zPos);
        innerGroup.add(leftCannon);
        
        const rightCannon = new THREE.Mesh(cannonGeo.clone(), cannonMat);
        rightCannon.position.set(config.hullScale.x / 2 + 0.3, config.hullScale.y, zPos);
        innerGroup.add(rightCannon);
      }
    }
    
    // Create additional sails for multi-mast ships (brigantine: 2 masts, galleon: 3 masts)
    const additionalSails: AdditionalSail[] = [];
    const numMasts = shipType === 'galleon' ? 3 : shipType === 'brigantine' ? 2 : shipType === 'large' ? 3 : 1;
    
    if (numMasts > 1) {
      // The main mast already exists at z=0. Place the additional masts at
      // evenly spaced offsets stepping outward and alternating fore/aft, so
      // every sail sits on its own post and no two masts overlap (the old
      // formula put the first extra mast back at z=0, stacking all sails on
      // the main mast for 3-mast ships). 2-mast → main + foremast; 3-mast →
      // main flanked symmetrically by fore/aft masts.
      const spacing = config.hullScale.z / (numMasts + 1);
      const additionalOffsets: number[] = [];
      for (let k = 1; k < numMasts; k++) {
        const magnitude = Math.ceil(k / 2) * spacing;
        const sign = k % 2 === 1 ? 1 : -1;
        additionalOffsets.push(sign * magnitude);
      }
      const maxAbsOffset = Math.max(...additionalOffsets.map((o) => Math.abs(o)), 1);
      
      for (const mastOffset of additionalOffsets) {
        // Outer masts taper down slightly by distance from the central main mast.
        const distFactor = Math.abs(mastOffset) / maxAbsOffset;
        const mastScale = 1 - 0.16 * distFactor;
        const sailScale = 1 - 0.12 * distFactor;
        
        // Create additional mast
        const addMastGeometry = new THREE.CylinderGeometry(
          config.mastRadius * 0.6 * mastScale,
          config.mastRadius * 0.9 * mastScale,
          config.mastHeight * mastScale,
          8
        );
        const addMastMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const addMast = new THREE.Mesh(addMastGeometry, addMastMaterial);
        addMast.position.set(0, config.hullScale.y + (config.mastHeight * mastScale) / 2, mastOffset);
        innerGroup.add(addMast);
        
        // Full-span additional sail: deck up to just below this mast's top.
        const addBoomY = config.hullScale.y + 0.4;
        const addGaffY = config.hullScale.y + config.mastHeight * mastScale - 0.2;
        const addSailSpan = addGaffY - addBoomY;

        // Create additional sail cloth simulation
        const addClothSim = new ClothSimulation(
          config.sailWidth * sailScale,
          addSailSpan,
          Math.floor(config.sailSegmentsX * 0.8),
          Math.floor(config.sailSegmentsY * 0.8)
        );
        addClothSim.pinForGaffRig();
        addClothSim.setGaffRigPositions(addGaffY, addBoomY);
        
        const addClothGeometry = createClothGeometry(addClothSim);
        const addClothMesh = new THREE.Mesh(addClothGeometry, sailMaterial.clone());
        addClothMesh.position.set(0, 0, mastOffset);
        addClothMesh.rotation.y = Math.PI / 2;
        innerGroup.add(addClothMesh);
        
        // Create additional boom and gaff
        const addBoomLength = config.sailWidth * sailScale * 1.1;
        const addBoomRadius = config.mastRadius * 0.5 * mastScale;
        
        const addBoomGeometry = new THREE.CylinderGeometry(addBoomRadius * 0.8, addBoomRadius, addBoomLength, 8);
        addBoomGeometry.rotateX(Math.PI / 2);
        const addBoomMesh = new THREE.Mesh(addBoomGeometry, boomMaterial.clone());
        addBoomMesh.position.set(0, addBoomY, mastOffset + addBoomLength / 2);
        innerGroup.add(addBoomMesh);
        
        const addGaffGeometry = new THREE.CylinderGeometry(addBoomRadius * 0.7, addBoomRadius * 0.9, addBoomLength * 0.9, 8);
        addGaffGeometry.rotateX(Math.PI / 2);
        const addGaffMesh = new THREE.Mesh(addGaffGeometry, boomMaterial.clone());
        addGaffMesh.position.set(0, addGaffY, mastOffset + (addBoomLength * 0.9) / 2);
        innerGroup.add(addGaffMesh);
        
        additionalSails.push({
          clothSim: addClothSim,
          clothGeometry: addClothGeometry,
          clothMesh: addClothMesh,
          boomMesh: addBoomMesh,
          gaffMesh: addGaffMesh,
          mastMesh: addMast,
          mastOffset,
          // Per-mast rig anchors so this sail deploys/furls along its OWN mast
          // rather than borrowing the main mast's heights (prevents inversion/
          // over-stretch on shorter outer masts of brigantines/galleons).
          gaffY: addGaffY,
          boomDeployedY: addBoomY,
          boomFurledY: addGaffY - 0.3,
        });
      }
    }
    
    innerGroup.rotation.y = Math.PI;
    shipGroup.add(innerGroup);
    
    // Masthead wind pennant — a streamer that always points downwind so the
    // player can read wind direction at a glance. Attached to shipGroup (not
    // the PI-flipped innerGroup) so it lives in a clean heading frame: its
    // local +Z is the ship's bow, and updateSailVisuals rotates it downwind.
    const windPennant = new THREE.Group();
    windPennant.position.set(0, config.hullScale.y + config.mastHeight + 2.3, 0);
    const pennantPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6);
    const pennantPole = new THREE.Mesh(pennantPoleGeo, nestMaterial.clone());
    pennantPole.position.y = 0.8;
    windPennant.add(pennantPole);
    const pennantPivot = new THREE.Group();
    pennantPivot.name = 'pennant_pivot';
    pennantPivot.position.y = 1.45;
    windPennant.add(pennantPivot);
    const pennantGeo = new THREE.BufferGeometry();
    pennantGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0.0, 0,
      0, -0.5, 0,
      0, -0.25, 2.1,
    ]), 3));
    pennantGeo.setIndex([0, 1, 2]);
    pennantGeo.computeVertexNormals();
    const pennantMat = new THREE.MeshStandardMaterial({
      color: config.sailColor,
      side: THREE.DoubleSide,
      roughness: 0.85,
    });
    const pennantFlag = new THREE.Mesh(pennantGeo, pennantMat);
    pennantPivot.add(pennantFlag);
    shipGroup.add(windPennant);
    
    shipGroup.position.copy(position);
    this.scene.add(shipGroup);
    
    const shipPhysics = new ShipPhysics(shipType);
    
    const ship: Ship3D & { shipType: string } = {
      id,
      mesh: shipGroup,
      position: position.clone(),
      rotation: 0,
      velocity: new THREE.Vector3(),
      health: 100,
      maxHealth: 100,
      isPlayer: true,
      name,
      level: 1,
      sailAngle: 0,
      sailPosition: 0,
      sailMesh: sail,
      windMagicActive: false,
      windMagicTimer: 0,
      clothSim,
      clothGeometry,
      clothMesh,
      boomMesh,
      gaffMesh,
      shipType,
      windPennant,
      additionalSails: additionalSails.length > 0 ? additionalSails : undefined,
      // Smooth sail deployment (0-1 continuous)
      currentSailDeployment: 0,
      targetSailDeployment: 0,
      // Momentum physics
      momentum: new THREE.Vector3(),
      // Ship physics for wave interaction and capsizing
      physics: shipPhysics,
      physicsState: shipPhysics.getState()
    };
    
    this.playerShip = ship;
    
    // Load custom ship model if configured
    if (config.customModelPath) {
      this.loadCustomShipModel(config.customModelPath, innerGroup);
    }
    
    // Apply any saved customizations from the Ship Editor
    this.applySavedShipCustomizations(ship, shipType);
    
    return ship;
  }
  
  // Apply saved ship customizations from localStorage (from Ship Editor)
  applySavedShipCustomizations(ship: Ship3D, shipType: string): void {
    try {
      const savedShips = JSON.parse(localStorage.getItem('tethical_ship_customizations') || '{}');
      const savedData = savedShips[shipType];
      if (!savedData) return;
      
      console.log(`Applying saved customizations for ${shipType}`);
      
      // Apply hull color
      if (savedData.hullColor) {
        ship.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const material = child.material as THREE.MeshStandardMaterial;
            const name = child.name?.toLowerCase() || '';
            if (name.includes('hull') || name.includes('body') || name.includes('ship')) {
              material.color.setHex(savedData.hullColor);
            }
          }
        });
      }
      
      // Apply sail color
      if (savedData.sailColor && ship.clothMesh) {
        const sailMat = ship.clothMesh.material as THREE.MeshStandardMaterial;
        if (sailMat.color) {
          sailMat.color.setHex(savedData.sailColor);
        }
        
        // Apply to additional sails too
        if (ship.additionalSails) {
          ship.additionalSails.forEach(addSail => {
            const mat = addSail.clothMesh.material as THREE.MeshStandardMaterial;
            if (mat.color) {
              mat.color.setHex(savedData.sailColor);
            }
          });
        }
      }
      
      // Apply sail configurations if saved
      if (savedData.sails && savedData.sails.length > 0) {
        const mainSailData = savedData.sails[0];
        if (mainSailData && ship.clothMesh) {
          // Apply scale
          if (mainSailData.scale) {
            ship.clothMesh.scale.setScalar(mainSailData.scale);
          }
          // Apply Y offset
          if (mainSailData.yOffset) {
            ship.clothMesh.position.y += mainSailData.yOffset;
          }
        }
      }
      
    } catch (error) {
      console.warn('Failed to apply saved ship customizations:', error);
    }
  }
  
  // Get the player's preferred ship type from localStorage
  static getPlayerShipType(): string {
    try {
      return localStorage.getItem('tethical_player_ship') || 'sloop';
    } catch {
      return 'sloop';
    }
  }
  
  // Load a custom GLB model for the player ship
  private async loadCustomShipModel(modelPath: string, innerGroup: THREE.Group): Promise<void> {
    try {
      console.log(`Loading custom ship model: ${modelPath}`);
      const gltf = await this.gltfLoader.loadAsync(modelPath);
      const model = gltf.scene;
      
      // Get config for proper scaling
      const shipType = (this.playerShip as any)?.shipType || 'sloop';
      const config = SHIP_PREFAB_CONFIGS[shipType] || SHIP_PREFAB_CONFIGS.sloop;
      
      // Apply realistic wood and cloth textures to the loaded model
      await applyShipTextures(model, shipType);
      
      // Calculate scale to match ship dimensions
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      const targetLength = config.hullScale.z * 1.2;  // Slightly larger than procedural
      const scaleFactor = targetLength / Math.max(size.z, size.x, 0.1);
      model.scale.setScalar(scaleFactor);
      
      // Recalculate bounds after scaling
      box.setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.set(-center.x, 0, -center.z);
      model.position.y = config.hullScale.y * 0.3;  // Position at water level
      
      // Rotate model 180 degrees so bow faces forward
      model.rotation.y = Math.PI;
      
      // Hide sail meshes in the GLB model (we use cloth physics sails instead)
      const sailMeshesToHide: THREE.Mesh[] = [];
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const name = child.name.toLowerCase();
          
          // Allowlist: never hide structural / non-sail parts even if their bbox is thin
          const NON_SAIL = /(hull|deck|mast|spar|boom|gaff|yard|rope|rigging|rail|plank|board|barrel|cannon|wheel|anchor|flag|rudder|keel|bow|stern|cabin|wood|metal|chain|net)/;
          const isStructuralByName = NON_SAIL.test(name);

          // Check for sail-like geometry (thin vertical plane). Tightened heuristic
          // — old `thinRatio > 10` falsely flagged thin hull planks as sails.
          let isSailGeometry = false;
          if (!isStructuralByName && child.geometry) {
            if (!child.geometry.boundingBox) {
              child.geometry.computeBoundingBox();
            }
            if (child.geometry.boundingBox) {
              const size = new THREE.Vector3();
              child.geometry.boundingBox.getSize(size);
              const minDim = Math.min(size.x, size.y, size.z);
              const maxDim = Math.max(size.x, size.y, size.z);
              const thinRatio = maxDim / (minDim + 0.001);
              const isVertical = size.y > size.x * 0.6;
              const isLarge = size.y > 1.5 && maxDim > 2.0;
              isSailGeometry = thinRatio > 14 && isVertical && isLarge;
            }
          }
          
          // Hide if it's clearly a sail (name match always wins; geometry only if not structural)
          const nameMatch = name.includes('sail') || name.includes('canvas');
          // 'cloth' alone is too generic in some packs — require it to also look sail-like
          const clothMatch = name.includes('cloth') && (isSailGeometry || nameMatch);
          if (nameMatch || clothMatch || isSailGeometry) {
            sailMeshesToHide.push(child);
          }
        }
      });
      
      sailMeshesToHide.forEach(sailMesh => {
        sailMesh.visible = false;
        console.log(`[WorldMap] Hiding GLB sail mesh: ${sailMesh.name}`);
      });
      
      // Add model to ship
      innerGroup.add(model);
      
      // Hide procedural meshes (keep cloth sail visible)
      innerGroup.children.forEach(child => {
        if (child !== model && child.type === 'Mesh') {
          const mesh = child as THREE.Mesh;
          // Keep cloth sail and fallback sail visible
          if (!mesh.name?.includes('sail') && !mesh.name?.includes('cloth')) {
            mesh.visible = false;
          }
        }
      });
      
      console.log(`Custom ship model loaded: ${modelPath}, hid ${sailMeshesToHide.length} GLB sail meshes`);
    } catch (error) {
      console.warn(`Failed to load custom ship model: ${modelPath}`, error);
      // Fallback to procedural ship (already visible)
    }
  }
  
  // Apply default pirate ship colors to a loaded GLB model
  private applyDefaultShipColors(model: THREE.Object3D, shipType: string): void {
    // Determine which color set to use based on ship type
    const isGhost = shipType === 'ghost';
    const isWreck = shipType === 'wreck';
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const name = child.name.toLowerCase();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
            // Determine color based on mesh name
            if (name.includes('hull') || name.includes('body')) {
              mat.color.setHex(isGhost ? DEFAULT_SHIP_CONFIG.ghostHullColor : 
                               isWreck ? DEFAULT_SHIP_CONFIG.wreckHullColor : 
                               DEFAULT_SHIP_CONFIG.hullColor);
            } else if (name.includes('bow') || name.includes('front')) {
              mat.color.setHex(DEFAULT_SHIP_CONFIG.bowColor);
            } else if (name.includes('deck') || name.includes('floor')) {
              mat.color.setHex(DEFAULT_SHIP_CONFIG.deckColor);
            } else if (name.includes('mast') || name.includes('pole') || name.includes('wood')) {
              mat.color.setHex(DEFAULT_SHIP_CONFIG.mastColor);
            } else if (name.includes('rail') || name.includes('trim') || name.includes('brass')) {
              mat.color.setHex(DEFAULT_SHIP_CONFIG.trimColor);
            } else if (name.includes('figure') || name.includes('head') || name.includes('ornament')) {
              mat.color.setHex(DEFAULT_SHIP_CONFIG.figureheadColor);
            } else if (name.includes('sail') || name.includes('canvas')) {
              mat.color.setHex(isGhost ? DEFAULT_SHIP_CONFIG.ghostSailColor :
                               isWreck ? DEFAULT_SHIP_CONFIG.wreckSailColor :
                               DEFAULT_SHIP_CONFIG.sailColor);
            } else if (name.includes('flag')) {
              mat.color.setHex(DEFAULT_SHIP_CONFIG.flagColor);
            }
          }
        });
      }
    });
  }

  async loadMeshyShip(glbUrl: string, shipType: string): Promise<{ success: boolean; parts: string[]; error?: string }> {
    if (!this.playerShip) {
      return { success: false, parts: [], error: 'No player ship exists' };
    }

    try {
      console.log(`Loading Meshy ship from: ${glbUrl}`);
      
      const gltf = await this.gltfLoader.loadAsync(glbUrl);
      const loadedModel = gltf.scene;
      
      const partNames: string[] = [];
      loadedModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          partNames.push(`${child.name || 'unnamed'} (${child.type})`);
        }
      });
      console.log('Ship parts found:', partNames);
      
      const damageableShip = this.shipPartsManager.processLoadedShip(
        loadedModel,
        `meshy_${this.playerShip.id}`,
        shipType
      );
      this.meshyShipData = damageableShip;
      
      const config = SHIP_PREFAB_CONFIGS[shipType] || SHIP_PREFAB_CONFIGS.sloop;
      
      const box = new THREE.Box3().setFromObject(loadedModel);
      const size = box.getSize(new THREE.Vector3());
      const targetSize = Math.max(config.hullScale.x, config.hullScale.z) * 1.5;
      const scale = targetSize / Math.max(size.x, size.z);
      loadedModel.scale.setScalar(scale);
      
      const center = box.getCenter(new THREE.Vector3());
      loadedModel.position.sub(center.multiplyScalar(scale));
      loadedModel.position.y = config.hullScale.y * 0.5;
      
      // Rotate model 180 degrees so bow faces forward
      loadedModel.rotation.y = Math.PI;
      
      const oldMesh = this.playerShip.mesh;
      
      const newShipGroup = new THREE.Group();
      newShipGroup.add(loadedModel);
      
      const clothSim = new ClothSimulation(
        config.sailWidth,
        config.sailHeight,
        config.sailSegmentsX,
        config.sailSegmentsY
      );
      clothSim.pinForGaffRig();
      
      const boomY = config.hullScale.y + config.mastHeight * 0.25;
      const gaffY = config.hullScale.y + config.mastHeight * 0.95;
      clothSim.setGaffRigPositions(gaffY, boomY);
      
      const clothGeometry = createClothGeometry(clothSim);
      const sailMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        side: THREE.DoubleSide,
        roughness: 0.9
      });
      
      const clothMesh = new THREE.Mesh(clothGeometry, sailMaterial);
      clothMesh.name = 'cloth_sail'; // Name it so it won't be hidden
      
      // Apply textured sail material asynchronously
      createSailMaterial().then(texturedMat => {
        clothMesh.material = texturedMat;
      });
      clothMesh.position.set(0, 0, 0);
      clothMesh.rotation.y = Math.PI / 2;
      newShipGroup.add(clothMesh);
      
      newShipGroup.position.copy(oldMesh.position);
      newShipGroup.rotation.copy(oldMesh.rotation);
      
      this.scene.remove(oldMesh);
      this.scene.add(newShipGroup);
      
      this.playerShip.mesh = newShipGroup;
      this.playerShip.clothSim = clothSim;
      this.playerShip.clothGeometry = clothGeometry;
      this.playerShip.clothMesh = clothMesh;
      
      this.meshyShipLoaded = true;
      
      console.log(`Meshy ship loaded successfully with ${damageableShip.parts.size} damageable parts`);
      
      return { 
        success: true, 
        parts: Array.from(damageableShip.parts.values()).map(p => `${p.type}: ${p.maxHealth} HP`)
      };
    } catch (error) {
      console.error('Failed to load Meshy ship:', error);
      return { success: false, parts: [], error: String(error) };
    }
  }

  getMeshyShipData(): DamageableShip | null {
    return this.meshyShipData;
  }

  damagePlayerShip(hitPoint: THREE.Vector3, damage: number): { partHit: string | null; partDestroyed: boolean; shipSinking: boolean } {
    if (!this.meshyShipData) {
      if (this.playerShip) {
        this.playerShip.health = Math.max(0, this.playerShip.health - damage);
        return { 
          partHit: null, 
          partDestroyed: false, 
          shipSinking: this.playerShip.health <= 0 
        };
      }
      return { partHit: null, partDestroyed: false, shipSinking: false };
    }
    
    return this.shipPartsManager.damageShipAtPoint(this.meshyShipData.id, hitPoint, damage);
  }

  repairPlayerShip(amount: number): void {
    if (this.meshyShipData) {
      this.shipPartsManager.repairShip(this.meshyShipData.id, amount);
    } else if (this.playerShip) {
      this.playerShip.health = Math.min(this.playerShip.maxHealth, this.playerShip.health + amount);
    }
  }
  
  async loadEnemyShipModels(): Promise<void> {
    if (this.enemyShipModelsLoading || this.enemyShipModels.size > 0) return;
    this.enemyShipModelsLoading = true;

    // Legacy NPC size keys → canonical boat ids (boatRegistry is source of truth).
    const shipBoatIds: Record<string, string> = {
      small: 'skiff',
      medium: 'sloop',
      large: 'galleon',
      ghost: 'brigantine',
    };

    await Promise.all(
      Object.entries(shipBoatIds).map(async ([size, boatId]) => {
        const model = await loadBoatTemplate(boatId);
        if (model) {
          this.enemyShipModels.set(size, model);
          console.log(`Loaded enemy ship model: ${size} (${resolveBoatId(boatId)})`);
        }
      }),
    );

    this.enemyShipModelsLoading = false;
  }
  
  async loadGoblinModel(): Promise<void> {
    if (this.goblinModelLoading || this.goblinModel) return;
    this.goblinModelLoading = true;
    
    try {
      const gltf = await this.gltfLoader.loadAsync('/models/characters/goblin_npc.glb');
      this.goblinModel = gltf.scene.clone();
      this.goblinModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      console.log('Loaded goblin NPC model');
    } catch (error) {
      console.warn('Failed to load goblin model:', error);
    }
    
    this.goblinModelLoading = false;
  }
  
  async loadIslandEnemyModels(): Promise<void> {
    if (this.islandEnemyModelsLoading || this.islandEnemyModels.size > 0) return;
    this.islandEnemyModelsLoading = true;
    
    // Enemy model paths - using available models, map all enemy types to available assets
    const enemyModelPaths: Record<string, string> = {
      goblin: '/models/characters/goblin_npc.glb',
      skeleton: '/models/characters/undead_necro.glb',
      undead_knight: '/models/characters/undead_necro.glb',
      orc: '/models/characters/goblin_npc.glb',
      pirate: '/models/characters/goblin_npc.glb',
      sea_creature: '/models/characters/goblin_npc.glb',
      necromancer: '/models/characters/undead_necro.glb',
      giant_skeleton: '/models/characters/undead_necro.glb',
      pirate_captain: '/models/characters/goblin_npc.glb'
    };
    
    const loadPromises = Object.entries(enemyModelPaths).map(async ([type, path]) => {
      try {
        const gltf = await this.gltfLoader.loadAsync(path);
        const model = gltf.scene.clone();
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.islandEnemyModels.set(type, model);
        console.log(`Loaded island enemy model: ${type}`);
      } catch (error) {
        console.warn(`Failed to load island enemy model ${type}:`, error);
      }
    });
    
    await Promise.all(loadPromises);
    this.islandEnemyModelsLoading = false;
  }
  
  spawnIslandEnemies(islandId: string, position: THREE.Vector3, radius: number, enemyCount: number, enemyTypes: string[], bossType?: string): void {
    if (this.islandEnemyModels.size === 0) {
      console.warn('Island enemy models not loaded yet');
      return;
    }
    
    const island = this.islands.get(islandId);
    if (!island) {
      console.warn(`Island ${islandId} not found for enemy spawning`);
      return;
    }
    
    for (let i = 0; i < enemyCount; i++) {
      const enemyId = `${islandId}-enemy-${i}`;
      
      // Skip if already spawned
      if (this.islandEnemies.has(enemyId)) continue;
      
      // Pick a random enemy type from available, with fallback
      let enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)] || 'goblin';
      if (!this.islandEnemyModels.has(enemyType)) {
        enemyType = 'goblin'; // Fallback to goblin
      }
      
      const model = this.islandEnemyModels.get(enemyType);
      if (!model) continue;
      
      const enemy = model.clone();
      const scale = enemyType.includes('skeleton') || enemyType.includes('undead') ? 0.8 : 
                    enemyType.includes('orc') ? 1.4 : 1.2;
      enemy.scale.setScalar(scale);
      
      // Position randomly on island (LOCAL coordinates relative to island center)
      const angle = (i / enemyCount) * Math.PI * 2 + Math.random() * 0.5;
      const dist = radius * 0.3 + Math.random() * radius * 0.4;
      const localX = Math.cos(angle) * dist;
      const localZ = Math.sin(angle) * dist;
      const localPos = new THREE.Vector3(localX, 2, localZ);
      
      // Add to island group for proper parenting with local coordinates
      island.mesh.add(enemy);
      enemy.position.copy(localPos);
      enemy.rotation.y = Math.random() * Math.PI * 2;
      
      // Store LOCAL coordinates for wandering
      this.islandEnemies.set(enemyId, {
        mesh: enemy,
        islandId,
        type: enemyType,
        position: localPos.clone(), // Local position
        wanderTarget: localPos.clone(), // Local wander target
        wanderTimer: Math.random() * 5
      });
    }
    
    // Spawn boss if specified
    if (bossType && this.islandEnemyModels.has(bossType)) {
      const bossId = `${islandId}-boss`;
      if (!this.islandEnemies.has(bossId)) {
        const bossModel = this.islandEnemyModels.get(bossType);
        if (bossModel) {
          const boss = bossModel.clone();
          const bossScale = bossType.includes('giant') ? 2.5 : 1.8;
          boss.scale.setScalar(bossScale);
          
          // Boss spawns at center of island (LOCAL coordinates)
          const bossLocalPos = new THREE.Vector3(0, 3, 0);
          boss.position.copy(bossLocalPos);
          boss.rotation.y = Math.random() * Math.PI * 2;
          island.mesh.add(boss);
          
          // Store LOCAL coordinates - boss stays near center
          this.islandEnemies.set(bossId, {
            mesh: boss,
            islandId,
            type: bossType,
            position: bossLocalPos.clone(),
            wanderTarget: bossLocalPos.clone(),
            wanderTimer: 10
          });
          console.log(`Spawned boss ${bossType} on island ${islandId}`);
        }
      }
    }
    
    console.log(`Spawned ${enemyCount} enemies on island ${islandId}`);
  }
  
  updateIslandEnemies(delta: number): void {
    const playerPos = this.playerShip?.position;
    this.islandEnemies.forEach((enemy) => {
      const island = this.islands.get(enemy.islandId);
      if (!island) return;

      // Distance cull: while sailing, skip AI + animation mixer for enemies on
      // far-away islands. They only matter once the player is close, so there is
      // no reason to spend CPU driving mixers/movement for distant islands.
      if (playerPos) {
        const dx = island.mesh.position.x - playerPos.x;
        const dz = island.mesh.position.z - playerPos.z;
        const cullDist = island.radius + 500;
        if (dx * dx + dz * dz > cullDist * cullDist) {
          return;
        }
      }

      // Update wander timer
      enemy.wanderTimer -= delta;
      
      // Check if this is a boss - bosses wander in a smaller radius around center
      const isBoss = enemy.type.includes('boss') || enemy.type.includes('necromancer') || 
                     enemy.type.includes('giant') || enemy.type.includes('captain');
      const wanderRadius = isBoss ? island.radius * 0.15 : island.radius * 0.4;
      const baseY = isBoss ? 3 : 2;
      
      if (enemy.wanderTimer <= 0) {
        // Pick new wander target within island radius (LOCAL coordinates)
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * wanderRadius;
        enemy.wanderTarget.set(
          Math.cos(angle) * dist,
          baseY,
          Math.sin(angle) * dist
        );
        enemy.wanderTimer = 3 + Math.random() * 5;
      }
      
      // Move towards wander target (LOCAL coordinates)
      const currentLocal = enemy.mesh.position.clone();
      const toTarget = enemy.wanderTarget.clone().sub(currentLocal);
      toTarget.y = 0;
      const dist = toTarget.length();
      
      if (dist > 0.5) {
        const speed = isBoss ? 1.5 : 2;
        toTarget.normalize().multiplyScalar(delta * speed);
        enemy.mesh.position.add(toTarget);
        enemy.position.copy(enemy.mesh.position); // Keep position in sync
        
        // Face movement direction
        enemy.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
      }
      
      // Update animation mixer if present
      if (enemy.mixer) {
        enemy.mixer.update(delta);
      }
    });
  }
  
  // Update flying boss system
  updateFlyingBosses(delta: number): void {
    if (!this.flyingBossSystem) return;
    
    // Get player position
    const playerPos = this.playerShip?.position || null;
    
    // Get NPC ships
    const npcShips: Array<{ id: string; position: THREE.Vector3 }> = [];
    this.npcShips.forEach((ship, id) => {
      npcShips.push({ id, position: ship.position.clone() });
    });
    
    const seaCreatures: Array<{ id: string; position: THREE.Vector3; type: string }> = [];
    if (this.seaCreatureSystem) {
      const creatures = this.seaCreatureSystem.getCreatures();
      creatures.forEach(c => {
        seaCreatures.push({ id: c.id, position: c.mesh.position.clone(), type: c.type });
      });
    }
    
    // Update all bosses
    this.flyingBossSystem.update(delta, playerPos, npcShips, seaCreatures);
    
    // Try to spawn new boss periodically
    this.flyingBossSpawnTimer += delta;
    if (this.flyingBossSpawnTimer >= this.flyingBossSpawnInterval) {
      this.flyingBossSpawnTimer = 0;
      this.trySpawnFlyingBoss();
    }
  }
  
  private trySpawnFlyingBoss(): void {
    if (!this.flyingBossSystem || !this.playerShip) return;
    
    // Spawn near player but at a distance
    const spawnDist = 300 + Math.random() * 200;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnPos = new THREE.Vector3(
      this.playerShip.position.x + Math.cos(spawnAngle) * spawnDist,
      0,
      this.playerShip.position.z + Math.sin(spawnAngle) * spawnDist
    );
    
    // Very rare spawn chance (handled by the system)
    const boss = this.flyingBossSystem.trySpawnBoss(spawnPos);
    if (boss) {
      console.log(`[FlyingBoss] Rare Sky Terror spawned near player!`);
    }
  }
  
  // Force spawn a flying boss for testing
  forceSpawnFlyingBoss(): FlyingBoss | null {
    if (!this.flyingBossSystem || !this.playerShip) return null;
    
    const spawnDist = 150;
    const spawnAngle = this.playerShip.rotation + Math.PI; // Behind player
    const spawnPos = new THREE.Vector3(
      this.playerShip.position.x + Math.cos(spawnAngle) * spawnDist,
      0,
      this.playerShip.position.z + Math.sin(spawnAngle) * spawnDist
    );
    
    return this.flyingBossSystem.forceSpawnBoss(spawnPos);
  }
  
  // Get flying bosses for UI/HUD
  getFlyingBosses(): FlyingBoss[] {
    return this.flyingBossSystem?.getBosses() || [];
  }
  
  // Damage a flying boss (e.g., from cannon fire)
  damageFlyingBoss(bossId: string, damage: number): boolean {
    return this.flyingBossSystem?.damageBoss(bossId, damage) || false;
  }
  
  private seaCreatureSpawnTimer: number = 0;
  private seaCreatureSpawnInterval: number = 10;
  private seaCreaturesSeeded: boolean = false;
  private krakenSpawnTimer: number = 0;
  private krakenSpawnInterval: number = 180;
  
  updateSeaCreatures(delta: number): void {
    if (!this.seaCreatureSystem || !this.playerShip) return;
    
    this.seaCreatureSystem.setPlayerPosition(this.playerShip.position, this.playerShip.velocity);
    this.seaCreatureSystem.setShipCollider({
      position: this.playerShip.position,
      radius: 8,
      onHullDamage: (damage, creatureType) => {
        if (this.playerShip) {
          this.playerShip.health = Math.max(0, this.playerShip.health - damage);
          console.log(`[SeaCreature] ${creatureType} damaged hull for ${damage}! HP: ${this.playerShip.health}`);
        }
      }
    });
    
    this.seaCreatureSystem.update(delta);
    
    // Seed a batch immediately on first update so the water isn't empty for the
    // first 30s — creatures appear around the player right away.
    if (!this.seaCreaturesSeeded) {
      this.seaCreaturesSeeded = true;
      this.seaCreatureSystem.spawnRandomCreatures(6, this.playerShip.position);
    }
    
    this.seaCreatureSpawnTimer += delta;
    if (this.seaCreatureSpawnTimer >= this.seaCreatureSpawnInterval) {
      this.seaCreatureSpawnTimer = 0;
      const creatures = this.seaCreatureSystem.getCreatures();
      if (creatures.length < 22) {
        this.seaCreatureSystem.spawnRandomCreatures(4, this.playerShip.position);
      }
    }
    
    this.krakenSpawnTimer += delta;
    if (this.krakenSpawnTimer >= this.krakenSpawnInterval) {
      this.krakenSpawnTimer = 0;
      const creatures = this.seaCreatureSystem.getCreatures();
      const hasKraken = creatures.some(c => c.type === 'kraken');
      if (!hasKraken && Math.random() < 0.15) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        const krakenPos = new THREE.Vector3(
          this.playerShip.position.x + Math.cos(angle) * dist,
          -10,
          this.playerShip.position.z + Math.sin(angle) * dist
        );
        this.seaCreatureSystem.spawnCreature('kraken', krakenPos);
        console.log('[SeaCreature] KRAKEN SPAWNED near player!');
      }
    }
  }
  
  private createGoblinOnDeck(shipGroup: THREE.Group, count: number = 1): void {
    if (!this.goblinModel) return;
    
    for (let i = 0; i < count; i++) {
      const goblin = this.goblinModel.clone();
      const scale = 0.8 + Math.random() * 0.3;
      goblin.scale.setScalar(scale);
      const xOffset = (Math.random() - 0.5) * 2;
      const zOffset = (Math.random() - 0.5) * 4;
      goblin.position.set(xOffset, 2.2, zOffset);
      goblin.rotation.y = Math.random() * Math.PI * 2;
      shipGroup.add(goblin);
    }
  }
  
  createNPCShip(
    id: string, 
    position: THREE.Vector3, 
    name: string, 
    level: number,
    shipType?: 'small' | 'medium' | 'large' | 'ghost',
    faction?: string,
    aggressive?: boolean
  ): Ship3D {
    const shipGroup = new THREE.Group();
    const innerGroup = new THREE.Group();
    
    // Use provided shipType or calculate from level
    const shipSize = shipType || (level <= 2 ? 'small' : level <= 5 ? 'medium' : level <= 7 ? 'large' : 'ghost');
    
    // Store faction and aggression data for AI behavior
    (shipGroup as any).faction = faction || 'pirate';
    (shipGroup as any).aggressive = aggressive ?? true;
    const cachedModel = this.enemyShipModels.get(shipSize);
    
    let sail: THREE.Mesh | undefined;
    
    if (cachedModel) {
      const shipModel = cachedModel.clone();
      // Match the player-ship pipeline: scale → bbox-center → drop to water line.
      // Without this the GLB's authored pivot (usually one corner of the model)
      // stays at innerGroup origin, which throws the sail meshes off the mast
      // and makes the whole ship look transformed wrong.
      const scaleFactor = shipSize === 'small' ? 3.5 : shipSize === 'medium' ? 4.5 : 5.5;
      shipModel.scale.setScalar(scaleFactor);
      const bbox = new THREE.Box3().setFromObject(shipModel);
      const bcenter = new THREE.Vector3();
      const bsize = new THREE.Vector3();
      bbox.getCenter(bcenter);
      bbox.getSize(bsize);
      // Center horizontally on the mast axis, then sit hull on the water plane
      // (lift just enough that ~30% of the hull height is below y=0).
      shipModel.position.set(-bcenter.x, -bbox.min.y - bsize.y * 0.3, -bcenter.z);
      innerGroup.add(shipModel);
      
      shipModel.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.toLowerCase().includes('sail')) {
          sail = child;
        }
      });
      
      const goblinCount = shipSize === 'small' ? 1 : shipSize === 'medium' ? 2 : 3;
      this.createGoblinOnDeck(innerGroup, goblinCount);
    } else {
      const hullGeometry = new THREE.BoxGeometry(3.5, 1.8, 9);
      const hullMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d1810,
        roughness: 0.8
      });
      const hull = new THREE.Mesh(hullGeometry, hullMaterial);
      hull.position.y = 0.9;
      innerGroup.add(hull);
      
      const deckGeometry = new THREE.BoxGeometry(3, 0.25, 8);
      const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
      const deck = new THREE.Mesh(deckGeometry, deckMaterial);
      deck.position.y = 1.9;
      innerGroup.add(deck);
      
      const mastGeometry = new THREE.CylinderGeometry(0.15, 0.25, 10, 8);
      const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x2d1810 });
      const mast = new THREE.Mesh(mastGeometry, mastMaterial);
      mast.position.set(0, 6.5, 0);
      innerGroup.add(mast);
      
      const sailGeometry = new THREE.PlaneGeometry(5, 6);
      const sailMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        side: THREE.DoubleSide,
        roughness: 0.9
      });
      sail = new THREE.Mesh(sailGeometry, sailMaterial);
      sail.position.set(0, 7, 0.4);
      sail.rotation.y = Math.PI / 2;
      innerGroup.add(sail);
      
      const skullGeometry = new THREE.SphereGeometry(0.8, 8, 6);
      const skullMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const skull = new THREE.Mesh(skullGeometry, skullMaterial);
      skull.position.set(0, 7, 0.6);
      innerGroup.add(skull);
      
      this.loadEnemyShipModels();
      this.loadGoblinModel();
    }
    
    innerGroup.rotation.y = Math.PI;
    shipGroup.add(innerGroup);
    
    shipGroup.position.copy(position);
    this.scene.add(shipGroup);
    
    const ship: Ship3D = {
      id,
      mesh: shipGroup,
      position: position.clone(),
      rotation: 0,
      velocity: new THREE.Vector3(),
      health: 100,
      maxHealth: 100,
      isPlayer: false,
      name,
      level,
      sailAngle: 0,
      sailPosition: 2,
      sailMesh: sail
    };
    
    this.npcShips.set(id, ship);
    return ship;
  }
  
  async upgradeNPCShipsToRealModels(): Promise<void> {
    await this.loadEnemyShipModels();
    await this.loadGoblinModel();
    
    this.npcShips.forEach((ship) => {
      const oldMesh = ship.mesh;
      const position = oldMesh.position.clone();
      const rotation = oldMesh.rotation.y;
      
      this.scene.remove(oldMesh);
      this.npcShips.delete(ship.id);
      
      const newShip = this.createNPCShip(ship.id, position, ship.name, ship.level);
      newShip.mesh.rotation.y = rotation;
      newShip.rotation = rotation;
      newShip.health = ship.health;
      newShip.maxHealth = ship.maxHealth;
    });
    
    console.log(`Upgraded ${this.npcShips.size} NPC ships to real models with goblins`);
  }
  
  createIsland(
    id: string, 
    position: THREE.Vector3, 
    radius: number, 
    name: string, 
    biome: string,
    faction?: string,
    hostility?: 'friendly' | 'neutral' | 'hostile' | 'contested',
    tier?: number,
    gameplayData?: {
      gameplayType?: 'safe' | 'trading_post' | 'hostile' | 'claimable' | 'capital';
      hasTradingPost?: boolean;
      isClaimable?: boolean;
      enemyCount?: number;
      hasBoss?: boolean;
      description?: string;
    }
  ): Island3D {
    const seed = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 12345);
    
    const generated = this.islandGenerator.generateIsland({
      seed,
      radius,
      biome,
      position
    });
    
    const islandGroup = new THREE.Group();
    islandGroup.add(generated.terrainMesh);
    generated.terrainMesh.position.set(0, 0, 0);
    islandGroup.add(generated.propMeshes);
    generated.propMeshes.position.set(0, 0, 0);
    
    // Add underwater base for visual depth
    generated.underwaterBase.position.set(0, -15, 0);
    islandGroup.add(generated.underwaterBase);
    
    // Add collision mesh for solid collision
    generated.collisionMesh.position.set(0, -10, 0);
    generated.collisionMesh.userData.islandId = id;
    islandGroup.add(generated.collisionMesh);
    
    // Add faction marker/beacon for friendly/hostile islands
    if (faction && faction !== 'neutral') {
      const beaconHeight = 15 + (tier || 1) * 5;
      const beaconColor = hostility === 'friendly' ? 0x00ff00 : 
                          hostility === 'hostile' ? 0xff0000 : 
                          hostility === 'contested' ? 0xffff00 : 0x888888;
      
      const beaconGeometry = new THREE.CylinderGeometry(0.5, 0.5, beaconHeight, 8);
      const beaconMaterial = new THREE.MeshStandardMaterial({ 
        color: beaconColor,
        emissive: beaconColor,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.6
      });
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.set(0, beaconHeight / 2, 0);
      islandGroup.add(beacon);
      
      // Add faction flag indicator
      const flagGeometry = new THREE.PlaneGeometry(4, 3);
      const factionColors: Record<string, number> = {
        crusade: 0xFFD700,
        fabled: 0x00CED1,
        legion: 0x8B0000,
        pirate: 0x2F4F4F,
      };
      const flagMaterial = new THREE.MeshStandardMaterial({
        color: factionColors[faction] || 0xffffff,
        side: THREE.DoubleSide,
        emissive: factionColors[faction] || 0xffffff,
        emissiveIntensity: 0.2
      });
      const flag = new THREE.Mesh(flagGeometry, flagMaterial);
      flag.position.set(0, beaconHeight + 2, 0);
      islandGroup.add(flag);
    }
    
    // Shore foam ring — soft animated wash that hides the hard sand/water seam
    const foamRing = this.createShoreFoamRing(radius);
    foamRing.position.set(0, 0.15, 0);
    islandGroup.add(foamRing);

    islandGroup.position.copy(position);
    this.scene.add(islandGroup);
    
    const island: Island3D = {
      id,
      mesh: islandGroup,
      position: position.clone(),
      radius,
      name,
      biome,
      discovered: false,
      faction,
      hostility,
      tier,
      gameplayType: gameplayData?.gameplayType,
      hasTradingPost: gameplayData?.hasTradingPost,
      isClaimable: gameplayData?.isClaimable,
      enemyCount: gameplayData?.enemyCount,
      hasBoss: gameplayData?.hasBoss,
      description: gameplayData?.description
    };
    
    this.islands.set(id, island);
    return island;
  }

  /**
   * Attach fleet shell seed metadata (CDN shell + meshName + seed) for production
   * island handoff / future shell mesh upgrade. Data from island_fleet_seeds.json.
   */
  tagIslandFleetShell(
    id: string,
    meta: {
      shellKey: string;
      cdn: string;
      r2Key: string;
      meshName?: string;
      seed: number;
      sectorId: string | number;
    },
  ): void {
    const island = this.islands.get(id);
    if (!island) return;
    (island as Island3D & { fleetShell?: typeof meta }).fleetShell = meta;
    island.mesh.userData.fleetShell = meta;
    island.mesh.userData.seed = meta.seed;
  }
  
  createCannonball(id: string, position: THREE.Vector3, velocity: THREE.Vector3, ownerId: string, damage: number): Cannonball3D {
    // Create a more visible cannonball
    const geometry = new THREE.SphereGeometry(0.6, 12, 12);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x552200,
      emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    this.scene.add(mesh);
    
    this.cannonballEffects.startTrail(id);
    
    // Use provided velocity but ensure upward arc for visible trajectory
    const speed = velocity.length();
    const launchVel = velocity.clone();
    
    // If velocity is mostly horizontal, add upward arc
    if (Math.abs(launchVel.y) < speed * 0.3) {
      launchVel.y = speed * 0.4; // Add 40% upward component for arc
    }
    
    const cannonball: Cannonball3D = {
      id,
      mesh,
      position: position.clone(),
      velocity: launchVel,
      ownerId,
      damage,
      lifetime: 8
    };
    
    this.cannonballs.set(id, cannonball);
    return cannonball;
  }
  
  createTreasure(id: string, position: THREE.Vector3, value: number): Treasure3D {
    const chestGroup = new THREE.Group();
    
    const baseGeometry = new THREE.BoxGeometry(2, 1.5, 1.5);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8b4513,
      roughness: 0.7
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.75;
    chestGroup.add(base);
    
    const lidGeometry = new THREE.BoxGeometry(2.1, 0.5, 1.6);
    const lidMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xa0522d,
      roughness: 0.6
    });
    const lid = new THREE.Mesh(lidGeometry, lidMaterial);
    lid.position.y = 1.75;
    chestGroup.add(lid);
    
    const goldGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const goldMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.1
    });
    for (let i = 0; i < 5; i++) {
      const gold = new THREE.Mesh(goldGeometry, goldMaterial);
      gold.position.set(
        (Math.random() - 0.5) * 1.2,
        1.8 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.8
      );
      chestGroup.add(gold);
    }
    
    chestGroup.position.copy(position);
    chestGroup.position.y = 1;
    this.scene.add(chestGroup);
    
    const treasure: Treasure3D = {
      id,
      mesh: chestGroup as unknown as THREE.Mesh,
      position: position.clone(),
      value,
      collected: false
    };
    
    this.treasures.set(id, treasure);
    return treasure;
  }
  
  updatePlayerShip(position: THREE.Vector3, rotation: number, velocity: THREE.Vector3, health: number, delta: number = 0.016) {
    if (!this.playerShip) return;
    
    this.playerShip.position.copy(position);
    this.playerShip.rotation = rotation;
    this.playerShip.velocity.copy(velocity);
    this.playerShip.health = health;
    
    this.playerShip.mesh.position.set(position.x, 0, position.z);
    this.playerShip.mesh.rotation.y = rotation;
    
    // Use advanced ship physics if available
    if (this.playerShip.physics) {
      const physicsResult = this.playerShip.physics.update(
        delta,
        this.currentWeatherConfig,
        position,
        rotation,
        velocity,
        this.playerShip.health,
        this.playerShip.maxHealth
      );
      
      this.playerShip.physicsState = physicsResult.state;
      
      // Apply weather damage
      if (physicsResult.damage > 0) {
        this.playerShip.health = Math.max(0, this.playerShip.health - physicsResult.damage);
      }
      
      // Apply physics transforms to mesh
      this.playerShip.physics.applyMeshTransforms(this.playerShip.mesh, 0);
    } else {
      // Fallback to simple bobbing
      const bobAmount = Math.sin(this.clock.getElapsedTime() * 2) * 0.2;
      const rollAmount = Math.sin(this.clock.getElapsedTime() * 1.5) * 0.02;
      this.playerShip.mesh.position.y = bobAmount;
      this.playerShip.mesh.rotation.z = rollAmount;
    }
  }
  
  // Update weather config for ship physics (clone to avoid mutation issues)
  setWeatherConfig(weather: WeatherConfig): void {
    this.currentWeatherConfig = {
      state: weather.state,
      windDirection: weather.windDirection,
      windStrength: weather.windStrength,
      waveHeight: weather.waveHeight,
      waveFrequency: weather.waveFrequency,
      rainIntensity: weather.rainIntensity,
      cloudDensity: weather.cloudDensity,
      visibility: weather.visibility,
      lightningFrequency: weather.lightningFrequency,
      fogDensity: weather.fogDensity,
    };
  }
  
  // Get current ship physics warnings
  getShipWarnings(): string[] {
    if (this.playerShip?.physics) {
      return this.playerShip.physics.getWarnings();
    }
    return [];
  }
  
  // Get ship stability percentage
  getShipStability(): number {
    if (this.playerShip?.physics) {
      const stability = this.playerShip.physics.getStabilityPercent();
      if (isNaN(stability) || !isFinite(stability)) {
        return 100;
      }
      return stability;
    }
    return 100;
  }
  
  // Get weather severity info
  getWeatherSeverity(): ReturnType<typeof getWeatherSeverityLevel> {
    return getWeatherSeverityLevel(this.currentWeatherConfig);
  }
  
  // Pump water from ship
  pumpShipWater(delta: number): void {
    if (this.playerShip?.physics) {
      this.playerShip.physics.pumpWater(delta, 10);
    }
  }
  
  // Repair ship damage
  repairShip(amount: number): void {
    if (this.playerShip?.physics) {
      this.playerShip.physics.repair(amount);
    }
    if (this.playerShip) {
      this.playerShip.health = Math.min(this.playerShip.maxHealth, this.playerShip.health + amount);
    }
  }
  
  // Apply impact force to ship (from cannonball, collision, etc.)
  applyShipImpact(force: number, direction: number): void {
    if (this.playerShip?.physics) {
      this.playerShip.physics.applyImpact(force, direction);
    }
  }

  // Apply lightning flash effect to scene lighting (additive, non-destructive)
  applyLightningFlash(intensity: number): void {
    if (!this.ambientLight || !this.directionalLight) return;
    
    if (intensity > 0.01) {
      this.lightningFlashActive = true;
      const flashBoost = intensity * 3;
      
      // Additively boost current lighting without overwriting base values
      this.ambientLight.intensity = this.baseLightingState.ambientIntensity + flashBoost;
      this.directionalLight.intensity = this.baseLightingState.directionalIntensity + flashBoost * 0.5;
      
      // Blend ambient color toward bluish-white during intense flashes
      if (intensity > 0.5) {
        this.ambientLight.color.setHex(0xccccff);
      } else {
        const baseColor = new THREE.Color(this.baseLightingState.ambientColor);
        const flashColor = new THREE.Color(0xccccff);
        this.ambientLight.color.copy(baseColor.lerp(flashColor, intensity * 2));
      }
    } else if (this.lightningFlashActive) {
      // Flash ended - restore base lighting
      this.lightningFlashActive = false;
      this.ambientLight.intensity = this.baseLightingState.ambientIntensity;
      this.directionalLight.intensity = this.baseLightingState.directionalIntensity;
      this.ambientLight.color.setHex(this.baseLightingState.ambientColor);
    }
  }

  // Update base lighting state (called by time-of-day/weather systems)
  setBaseLighting(ambientIntensity: number, directionalIntensity: number, ambientColor?: number): void {
    this.baseLightingState.ambientIntensity = ambientIntensity;
    this.baseLightingState.directionalIntensity = directionalIntensity;
    if (ambientColor !== undefined) {
      this.baseLightingState.ambientColor = ambientColor;
    }
    
    // Only apply directly if no flash is active
    if (!this.lightningFlashActive) {
      if (this.ambientLight) {
        this.ambientLight.intensity = ambientIntensity;
        if (ambientColor !== undefined) {
          this.ambientLight.color.setHex(ambientColor);
        }
      }
      if (this.directionalLight) {
        this.directionalLight.intensity = directionalIntensity;
      }
    }
  }
  
  updateNPCShip(id: string, position: THREE.Vector3, rotation: number, health: number, delta: number = 0.016) {
    const ship = this.npcShips.get(id);
    if (!ship) return;
    
    ship.position.copy(position);
    ship.rotation = rotation;
    ship.health = health;
    
    ship.mesh.position.set(position.x, 0, position.z);
    ship.mesh.rotation.y = rotation;
    
    // Use ship physics if available
    if (ship.physics) {
      const physicsResult = ship.physics.update(
        delta,
        this.currentWeatherConfig,
        position,
        rotation,
        ship.velocity,
        ship.health,
        ship.maxHealth
      );
      
      ship.physicsState = physicsResult.state;
      
      // Apply weather damage to NPC ships too
      if (physicsResult.damage > 0) {
        ship.health = Math.max(0, ship.health - physicsResult.damage);
      }
      
      // Apply physics transforms
      ship.physics.applyMeshTransforms(ship.mesh, 0);
    } else {
      // Fallback to simple bobbing with wave-based physics
      const timeOffset = parseInt(id, 36) % 100;
      const waveHeight = this.currentWeatherConfig.waveHeight;
      const waveFreq = this.currentWeatherConfig.waveFrequency;
      const time = this.clock.getElapsedTime();
      
      // Wave-based motion
      const heave = Math.sin((time + timeOffset * 0.1) * waveFreq) * waveHeight;
      const roll = Math.sin((time + timeOffset * 0.15) * waveFreq * 0.7) * waveHeight * 0.1;
      const pitch = Math.sin((time + timeOffset * 0.2) * waveFreq * 0.5) * waveHeight * 0.05;
      
      ship.mesh.position.y = heave;
      ship.mesh.rotation.z = roll;
      ship.mesh.rotation.x = pitch;
    }
  }
  
  removeNPCShip(id: string) {
    const ship = this.npcShips.get(id);
    if (ship) {
      this.scene.remove(ship.mesh);
      this.npcShips.delete(id);
    }
  }
  
  updateCannonballs(delta: number) {
    // Fast arcade-style gravity for snappy cannonball physics
    const gravity = -45; // Much stronger gravity for fast falling
    const airDrag = 0.999; // Less air resistance
    const toRemove: string[] = [];
    
    this.cannonballs.forEach((ball, id) => {
      // Apply gravity to vertical velocity
      ball.velocity.y += gravity * delta;
      
      // Apply slight air drag for realistic deceleration
      ball.velocity.x *= Math.pow(airDrag, delta);
      ball.velocity.z *= Math.pow(airDrag, delta);
      
      // Update position
      ball.position.x += ball.velocity.x * delta;
      ball.position.y += ball.velocity.y * delta;
      ball.position.z += ball.velocity.z * delta;
      
      ball.mesh.position.copy(ball.position);
      
      // Update trail effect (updateTrail only reads/copies — no clone needed)
      this.cannonballEffects.updateTrail(id, ball.position, ball.velocity);
      
      // Spin the cannonball based on velocity
      const speed = ball.velocity.length();
      ball.mesh.rotation.x += delta * speed * 0.08;
      ball.mesh.rotation.z += delta * speed * 0.04;
      
      ball.lifetime -= delta;
      
      // Check for water impact
      if (ball.position.y <= 0) {
        this.cannonballEffects.createSplash(ball.position.clone(), true);
        toRemove.push(id);
      } else if (ball.lifetime <= 0) {
        toRemove.push(id);
      }
      
      // Note: Ship collision detection is handled by checkCollisions() method
    });
    
    toRemove.forEach(id => {
      const ball = this.cannonballs.get(id);
      if (ball) {
        this.cannonballEffects.endTrail(id);
        this.scene.remove(ball.mesh);
        ball.mesh.geometry.dispose();
        (ball.mesh.material as THREE.Material).dispose();
        this.cannonballs.delete(id);
      }
    });
    
    this.cannonballEffects.update(delta);
  }
  
  updateTreasures(delta: number) {
    const time = this.clock.getElapsedTime();
    
    this.treasures.forEach(treasure => {
      if (!treasure.collected) {
        treasure.mesh.position.y = 1 + Math.sin(time * 2) * 0.3;
        treasure.mesh.rotation.y = time * 0.5;
      }
    });
  }
  
  collectTreasure(id: string) {
    const treasure = this.treasures.get(id);
    if (treasure) {
      treasure.collected = true;
      this.scene.remove(treasure.mesh);
      this.treasures.delete(id);
    }
  }
  
  // ── Cinematic camera override (used by intro sweep on world-map entry) ──
  private cinematicPose: { position: THREE.Vector3; lookAt: THREE.Vector3 } | null = null;

  /** Public accessor so decorators (starting-area landmarks, debug helpers,
   * etc.) can attach groups to the world-map scene without fighting the
   * private field. */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /** When set, updateCamera will copy this pose verbatim and skip lerping. */
  setCinematicCamera(pose: { position: THREE.Vector3; lookAt: THREE.Vector3 } | null): void {
    this.cinematicPose = pose
      ? { position: pose.position.clone(), lookAt: pose.lookAt.clone() }
      : null;
  }

  /** Set time-of-day directly (0..1). 0.22 ≈ sunrise, 0.5 = noon, 0.75 = sunset. */
  setTimeOfDay(t: number): void {
    this.timeOfDay = ((t % 1) + 1) % 1;
  }

  /** Adjust how fast the day/night cycle advances. Default 0.01 (full cycle in ~100s). */
  setDaySpeed(speed: number): void {
    this.daySpeed = Math.max(0, speed);
  }

  updateCamera(delta: number = 0.016) {
    if (!this.playerShip) return;

    // Cinematic override wins over any other camera mode while active.
    if (this.cinematicPose && this.activeCamera === this.mainCamera) {
      this.mainCamera.position.copy(this.cinematicPose.position);
      this.mainCamera.lookAt(this.cinematicPose.lookAt);
      return;
    }

    if (this.cameraMode === 'chase') {
      this.updateChaseCamera(delta);
    } else if (this.cameraMode === 'third-person') {
      const shipPos = this.playerShip.mesh.position;
      const shipRotation = this.playerShip.rotation;
      
      if (this.orbitalCameraReturning && !this.orbitalMouseDown) {
        const returnSpeed = 3.0 * delta;
        this.orbitalCameraAngle *= (1 - returnSpeed);
        this.orbitalCameraPitch *= (1 - returnSpeed);
        
        if (Math.abs(this.orbitalCameraAngle) < 0.01 && Math.abs(this.orbitalCameraPitch) < 0.01) {
          this.orbitalCameraAngle = 0;
          this.orbitalCameraPitch = 0;
          this.orbitalCameraReturning = false;
          this.orbitalCameraActive = false;
        }
      }
      
      if (this.orbitalCameraActive || this.orbitalCameraReturning) {
        const totalAngle = shipRotation + this.orbitalCameraAngle;
        const basePitch = 0.35;
        const totalPitch = basePitch + this.orbitalCameraPitch;
        
        const horizontalDist = this.orbitalCameraDistance * Math.cos(totalPitch);
        const verticalDist = this.orbitalCameraDistance * Math.sin(totalPitch) + 8;
        
        const offsetX = -Math.sin(totalAngle) * horizontalDist;
        const offsetZ = -Math.cos(totalAngle) * horizontalDist;
        
        const targetPosition = new THREE.Vector3(
          shipPos.x + offsetX,
          shipPos.y + verticalDist,
          shipPos.z + offsetZ
        );
        
        this.mainCamera.position.lerp(targetPosition, 0.1);
        
        const lookTarget = shipPos.clone();
        lookTarget.y += 5;
        this.mainCamera.lookAt(lookTarget);
      } else {
        const offset = this.cameraOffset.clone();
        
        const rotatedOffset = new THREE.Vector3(
          offset.x * Math.cos(shipRotation) + offset.z * Math.sin(shipRotation),
          offset.y,
          -offset.x * Math.sin(shipRotation) + offset.z * Math.cos(shipRotation)
        );
        
        const targetPosition = shipPos.clone().add(rotatedOffset);
        this.mainCamera.position.lerp(targetPosition, 0.05);
        
        const lookTarget = shipPos.clone();
        lookTarget.y += 5;
        this.mainCamera.lookAt(lookTarget);
      }
    } else {
      this.birdsEyeCamera.position.x = this.playerShip.mesh.position.x;
      this.birdsEyeCamera.position.z = this.playerShip.mesh.position.z;
      this.birdsEyeCamera.lookAt(this.playerShip.mesh.position);
    }
  }
  
  update(): number {
    const now = performance.now();
    let rawDelta = this.clock.getDelta();
    
    // Clamp max delta only to prevent physics instability on lag spikes
    // Max delta = 1/15 (ensures physics stays stable even at low FPS)
    // We do NOT clamp minimum - let high refresh displays run smoothly
    const delta = Math.min(this.performanceConfig.maxDelta, rawDelta);
    
    // Track FPS
    this.frameCount++;
    this.fpsAccumulator += rawDelta;
    if (this.fpsAccumulator >= 1.0) {
      this.currentFPS = Math.round(this.frameCount / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }
    
    // Store frame times for smoothing (rolling average of last 10 frames)
    this.frameTimes.push(rawDelta * 1000);
    if (this.frameTimes.length > 10) {
      this.frameTimes.shift();
    }
    
    // Frustum culling - update visibility based on camera
    if (this.performanceConfig.enableFrustumCulling) {
      this.updateFrustumCulling();
    }
    
    this.updateCannonballs(delta);
    this.updateTreasures(delta);
    this.updateCamera(delta);
    this.updateOceanWaves(delta);
    this.updateShoreFoamRings(delta);
    this.updateDayNightCycle(delta);
    this.updateWeather(delta);
    this.updateSeaCreatures(delta);
    
    captainManager.update(delta);
    
    this.renderer.render(this.scene, this.activeCamera);
    
    this.lastFrameTime = now;
    return delta;
  }
  
  // Frustum culling for performance
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();
  
  private updateFrustumCulling() {
    // Update frustum from active camera
    this.projScreenMatrix.multiplyMatrices(
      this.activeCamera.projectionMatrix,
      this.activeCamera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    
    const playerPos = this.playerShip?.position || new THREE.Vector3();
    
    // Cull distant NPC ships
    this.npcShips.forEach((ship) => {
      const dist = ship.position.distanceTo(playerPos);
      const inFrustum = this.frustum.containsPoint(ship.mesh.position);
      
      // Hide ships that are too far or not in view
      ship.mesh.visible = inFrustum && dist < this.performanceConfig.updateDistances.npcAI;
    });
    
    // Cull distant islands (but keep close ones always visible)
    this.islands.forEach((island) => {
      const dist = island.position.distanceTo(playerPos);
      const inFrustum = this.frustum.containsPoint(island.mesh.position);
      
      // Islands visible if close or in frustum and not too far
      island.mesh.visible = dist < 150 || (inFrustum && dist < this.performanceConfig.lodDistances.far * 2);
    });
  }
  
  // Get current FPS for HUD display
  getCurrentFPS(): number {
    return this.currentFPS;
  }
  
  // Get average frame time in ms
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 16.67;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }
  
  // Performance stats for debugging
  getPerformanceStats(): { fps: number; frameTime: number; drawCalls: number; triangles: number } {
    const info = this.renderer.info;
    return {
      fps: this.currentFPS,
      frameTime: this.getAverageFrameTime(),
      drawCalls: info.render.calls,
      triangles: info.render.triangles
    };
  }
  
  getPlayerShip(): Ship3D | null {
    return this.playerShip;
  }
  
  getNPCShips(): Map<string, Ship3D> {
    return this.npcShips;
  }
  
  getIslands(): Map<string, Island3D> {
    return this.islands;
  }
  
  // Traverse a ship mesh tree and free its per-ship GPU resources so repeated
  // ship swaps don't leak. We dispose geometries and materials (which are
  // cloned per ship) but deliberately NOT textures: ship materials share cached
  // /procedural singleton textures from shipPrefabs, and material.dispose() does
  // not touch its .map, so leaving textures alone avoids breaking other ships.
  private disposeShipMesh(root: THREE.Object3D) {
    const seen = new Set<unknown>();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !seen.has(mesh.geometry)) {
        seen.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const mat = (mesh as any).material;
      if (mat) {
        const materials = Array.isArray(mat) ? mat : [mat];
        for (const m of materials) {
          if (m && !seen.has(m)) {
            seen.add(m);
            m.dispose();
          }
        }
      }
    });
  }
  
  swapPlayerShip(shipType: string): boolean {
    if (!this.playerShip) return false;
    
    const oldPosition = this.playerShip.position.clone();
    const oldRotation = this.playerShip.rotation;
    const oldVelocity = this.playerShip.velocity.clone();
    const oldHealth = this.playerShip.health;
    const oldName = this.playerShip.name;
    const oldMesh = this.playerShip.mesh;
    
    this.scene.remove(oldMesh);
    this.disposeShipMesh(oldMesh);
    
    const newShip = this.createPlayerShip(
      this.playerShip.id,
      oldPosition,
      oldName,
      shipType
    );
    
    newShip.rotation = oldRotation;
    newShip.velocity.copy(oldVelocity);
    newShip.health = oldHealth;
    newShip.mesh.rotation.y = oldRotation;
    
    this.playerShip = newShip;
    
    console.log(`Swapped player ship to: ${shipType}`);
    return true;
  }
  
  getPlayerShipType(): string {
    return (this.playerShip as any)?.shipType || 'sloop';
  }
  
  checkCollisions(): { shipHits: Array<{targetId: string, damage: number}>, treasureCollects: string[] } {
    const shipHits: Array<{targetId: string, damage: number}> = [];
    const treasureCollects: string[] = [];
    
    if (!this.playerShip) return { shipHits, treasureCollects };
    
    this.cannonballs.forEach((ball, ballId) => {
      this.npcShips.forEach((ship, shipId) => {
        if (ball.ownerId !== shipId) {
          const dist = ball.position.distanceTo(new THREE.Vector3(ship.position.x, 0, ship.position.z));
          if (dist < 6) {
            shipHits.push({ targetId: shipId, damage: ball.damage });
            this.cannonballEffects.createImpactExplosion(ball.position.clone());
            this.cannonballEffects.endTrail(ballId);
            this.scene.remove(ball.mesh);
            this.cannonballs.delete(ballId);
          }
        }
      });
      
      if (ball.ownerId !== this.playerShip!.id) {
        const dist = ball.position.distanceTo(new THREE.Vector3(
          this.playerShip!.position.x, 0, this.playerShip!.position.z
        ));
        if (dist < 6) {
          shipHits.push({ targetId: this.playerShip!.id, damage: ball.damage });
          this.cannonballEffects.createImpactExplosion(ball.position.clone());
          this.cannonballEffects.endTrail(ballId);
          this.scene.remove(ball.mesh);
          this.cannonballs.delete(ballId);
        }
      }
    });
    
    this.treasures.forEach((treasure, treasureId) => {
      if (!treasure.collected) {
        const dist = new THREE.Vector2(
          this.playerShip!.position.x - treasure.position.x,
          this.playerShip!.position.z - treasure.position.z
        ).length();
        if (dist < 8) {
          treasureCollects.push(treasureId);
        }
      }
    });
    
    return { shipHits, treasureCollects };
  }
  
  dispose() {
    this.unmount();
    
    this.npcShips.forEach(ship => this.scene.remove(ship.mesh));
    this.islands.forEach(island => this.scene.remove(island.mesh));
    this.cannonballs.forEach(ball => this.scene.remove(ball.mesh));
    this.treasures.forEach(treasure => this.scene.remove(treasure.mesh));
    
    if (this.playerShip) {
      this.scene.remove(this.playerShip.mesh);
    }
    
    if (this.aimingState.arcMesh) this.scene.remove(this.aimingState.arcMesh);
    if (this.aimingState.targetMesh) this.scene.remove(this.aimingState.targetMesh);
    
    // Dispose enhanced ocean systems
    if (this.fishManager) {
      this.fishManager.dispose();
    }
    if (this.oceanFloorManager) {
      this.oceanFloorManager.dispose();
    }
    
    // Dispose cannonball effects
    this.cannonballEffects.dispose();
    
    // Dispose wind streaks
    if (this.windStreaks) {
      this.scene.remove(this.windStreaks);
      this.windStreaks.geometry.dispose();
      (this.windStreaks.material as THREE.Material).dispose();
      this.windStreaks = null;
    }
    
    // Dispose sea life (jellyfish)
    this.seaLife.forEach(entity => this.scene.remove(entity));
    this.seaLife = [];
    
    if (this.seaCreatureSystem) {
      this.seaCreatureSystem.dispose();
      this.seaCreatureSystem = null;
    }
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry.dispose();
      (this.rainParticles.material as THREE.PointsMaterial).dispose();
      this.rainParticles = null;
    }
    
    this.renderer.forceContextLoss();
    this.renderer.dispose();
  }
  
  getWindState(): WindState {
    return { ...this.wind };
  }
  
  updateWind(delta: number) {
    const time = Date.now() * 0.001;
    
    // === DYNAMIC WIND DIRECTION ===
    // Periodically pick a new target wind direction
    this.windTargets.changeTimer += delta;
    
    if (this.windTargets.changeTimer > this.windTargets.directionChangeInterval) {
      // Pick new target direction (can shift up to 90 degrees either way)
      const shift = (Math.random() - 0.5) * Math.PI;  // ±90 degrees
      this.windTargets.direction = this.wind.direction + shift;
      this.windTargets.directionChangeInterval = 20 + Math.random() * 40;  // 20-60 seconds
      this.windTargets.changeTimer = 0;
    }
    
    // Smoothly interpolate towards target direction
    // Use shortest path around the circle
    let dirDiff = this.windTargets.direction - this.wind.direction;
    while (dirDiff > Math.PI) dirDiff -= Math.PI * 2;
    while (dirDiff < -Math.PI) dirDiff += Math.PI * 2;
    this.wind.direction += dirDiff * 0.02 * delta;  // Slow drift
    
    // Add small random drift for natural feel
    this.wind.direction += (Math.random() - 0.5) * 0.01 * delta;
    
    // Keep direction in 0-2PI range
    this.wind.direction = ((this.wind.direction % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    
    // === DYNAMIC WIND SPEED ===
    // Use Perlin-like noise for smooth speed variations
    const speedNoise1 = Math.sin(time * 0.1) * 5;      // Slow major variation (±5)
    const speedNoise2 = Math.sin(time * 0.37) * 3;     // Medium variation (±3)
    const speedNoise3 = Math.sin(time * 1.13) * 2;     // Faster small variation (±2)
    
    // Base speed varies between 5 (light breeze) and 30 (strong wind)
    const baseSpeed = 15 + speedNoise1 + speedNoise2 + speedNoise3;
    
    // Occasional calm periods or strong gusts
    const calmChance = Math.sin(time * 0.03);  // Very slow cycle
    const stormChance = Math.sin(time * 0.05 + 1.5);
    
    let speedModifier = 1.0;
    if (calmChance > 0.85) {
      speedModifier = 0.3 + (1 - calmChance) * 2;  // Calm period (30-50% speed)
    } else if (stormChance > 0.9) {
      speedModifier = 1.5 + stormChance * 0.5;     // Stormy period (150-170% speed)
    }
    
    // Smoothly interpolate to target speed
    const targetSpeed = Math.max(3, Math.min(35, baseSpeed * speedModifier));
    this.wind.speed += (targetSpeed - this.wind.speed) * 0.05 * delta;
    
    // === GUST FACTOR ===
    // Smooth gust variation using multiple sine waves for natural feel
    const gustBase = 0.85 + Math.sin(time * 0.5) * 0.1;
    const gustVariation = Math.sin(time * 1.7) * 0.08 + Math.sin(time * 3.1) * 0.05;
    const randomGust = (Math.random() - 0.5) * 0.03;
    this.wind.gustFactor = Math.max(0.5, Math.min(1.3, gustBase + gustVariation + randomGust));
  }
  
  adjustSailAngle(delta: number) {
    if (!this.playerShip) return;
    
    // Sail rotation range ±90 degrees for proper trim control
    const maxAngle = Math.PI / 2;
    this.playerShip.sailAngle = Math.max(-maxAngle, Math.min(maxAngle, this.playerShip.sailAngle + delta));
    
    this.applySailRotation();
  }
  
  // Apply sail rotation to all sail components (cloth, boom, gaff)
  private applySailRotation() {
    if (!this.playerShip) return;
    
    const sailAngle = this.playerShip.sailAngle;
    
    // Rotate the visible sail mesh
    if (this.playerShip.sailMesh) {
      this.playerShip.sailMesh.rotation.y = Math.PI / 2 + sailAngle;
    }
    
    // Also rotate the cloth sail mesh to match
    if (this.playerShip.clothMesh) {
      this.playerShip.clothMesh.rotation.y = Math.PI / 2 + sailAngle;
    }
    
    // Rotate boom and gaff wooden bars to match sail rotation
    // Boom and gaff also need the same offset as the sail for consistent rotation
    if (this.playerShip.boomMesh) {
      this.playerShip.boomMesh.rotation.y = sailAngle;
    }
    if (this.playerShip.gaffMesh) {
      this.playerShip.gaffMesh.rotation.y = sailAngle;
    }
    
    // Rotate additional sails boom/gaff for multi-mast ships
    if (this.playerShip.additionalSails) {
      for (const addSail of this.playerShip.additionalSails) {
        addSail.clothMesh.rotation.y = Math.PI / 2 + sailAngle;
        addSail.boomMesh.rotation.y = sailAngle;
        addSail.gaffMesh.rotation.y = sailAngle;
      }
    }
  }
  
  // Auto-orient sail towards optimal wind angle (called each frame)
  autoTrimSail(delta: number) {
    if (!this.playerShip) return;
    
    // Calculate wind angle relative to ship
    const shipRotation = this.playerShip.rotation;
    const windAngle = this.wind.direction - shipRotation;
    const normalizedAngle = ((windAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    
    // Calculate optimal sail angle for current wind
    const absWindAngle = Math.abs(normalizedAngle);
    let targetSailAngle = 0;
    
    // Sails naturally swing to leeward side (downwind)
    // Sail angle should be roughly half the wind angle from bow
    if (absWindAngle > Math.PI / 4) { // Not in no-sail zone
      // Sail wants to be perpendicular to wind, but clamped to reasonable range
      // Positive wind from starboard = sail swings to port (negative angle)
      // Negative wind from port = sail swings to starboard (positive angle)
      targetSailAngle = -Math.sign(normalizedAngle) * Math.min(absWindAngle * 0.5, Math.PI / 2);
    }
    
    // Smoothly interpolate current sail angle toward target
    const lerpSpeed = 1.5 * delta; // Sail swing speed
    this.playerShip.sailAngle = THREE.MathUtils.lerp(
      this.playerShip.sailAngle,
      targetSailAngle,
      Math.min(1, lerpSpeed)
    );
    
    // Clamp to max range
    const maxAngle = Math.PI / 2;
    this.playerShip.sailAngle = Math.max(-maxAngle, Math.min(maxAngle, this.playerShip.sailAngle));
    
    this.applySailRotation();
  }
  
  getSailAngle(): number {
    return this.playerShip?.sailAngle ?? 0;
  }
  
  // Alias for adjustSailAngle for easier API
  rotateSail(delta: number) {
    this.adjustSailAngle(delta);
  }
  
  getSailPosition(): SailPosition {
    return this.playerShip?.sailPosition ?? 0;
  }
  
  // Get current smooth sail deployment (0-1 continuous)
  getCurrentSailDeployment(): number {
    return this.playerShip?.currentSailDeployment ?? 0;
  }
  
  // Get target sail deployment (0-1)
  getTargetSailDeployment(): number {
    return this.playerShip?.targetSailDeployment ?? 0;
  }
  
  setSailPosition(position: SailPosition) {
    if (!this.playerShip) return;
    this.playerShip.sailPosition = position;
    
    // Map sail position to target deployment. W raises sails 0→1→2, so those
    // three reachable steps must span the full range (furled → half → full),
    // otherwise keyboard sailing tops out at half speed. Index 3 (wind magic)
    // also maps to full.
    const deploymentTargets = [0, 0.5, 1.0, 1.0];
    this.playerShip.targetSailDeployment = deploymentTargets[position];
    
    this.updateSailVisuals();
  }
  
  // Update smooth sail deployment interpolation (call each frame)
  updateSailDeploymentSmooth(delta: number) {
    if (!this.playerShip) return;
    
    const current = this.playerShip.currentSailDeployment ?? 0;
    const target = this.playerShip.targetSailDeployment ?? 0;
    
    // Smooth interpolation speed (lower = slower animation)
    // Takes ~2 seconds to go from 0% to 100%
    const lerpSpeed = 0.8 * delta;
    
    // Lerp towards target
    const newDeployment = THREE.MathUtils.lerp(current, target, Math.min(1, lerpSpeed * 3));
    
    // Snap to target when very close (avoid endless tiny updates)
    if (Math.abs(newDeployment - target) < 0.001) {
      this.playerShip.currentSailDeployment = target;
    } else {
      this.playerShip.currentSailDeployment = newDeployment;
    }
  }
  
  // Update sail mesh scale and billowing based on sail position
  updateSailVisuals() {
    if (!this.playerShip) return;
    
    const position = this.playerShip.sailPosition;
    // Use smooth deployment for visual animation
    const smoothDeployment = this.playerShip.currentSailDeployment ?? 0;
    const windMagic = this.playerShip.windMagicActive;
    const shipType = (this.playerShip as any).shipType || 'sloop';
    const config = SHIP_PREFAB_CONFIGS[shipType] || SHIP_PREFAB_CONFIGS.sloop;
    
    // Update cloth physics simulation if available
    if (this.playerShip.clothSim && this.playerShip.clothGeometry && this.playerShip.clothMesh) {
      const clothSim = this.playerShip.clothSim;
      const clothGeometry = this.playerShip.clothGeometry;
      const clothMesh = this.playerShip.clothMesh;
      
      // Update boom position based on smooth sail deployment
      const crowsNestY = config.hullScale.y + config.mastHeight + 0.5;
      const gaffY = crowsNestY - 0.5; // top yard just below the crow's nest
      const boomDeployedY = config.hullScale.y + 0.4; // boom drops to the deck when fully lowered
      const boomFurledY = gaffY - 0.3; // Furled sail bundles near top
      
      // Use smooth deployment (0-1) for continuous boom animation
      const currentBoomY = boomFurledY + (boomDeployedY - boomFurledY) * smoothDeployment;
      
      // Update cloth simulation boom position
      clothSim.updateBoomPosition(currentBoomY);
      
      // Update visible boom mesh position
      if (this.playerShip.boomMesh) {
        this.playerShip.boomMesh.position.y = currentBoomY;
      }
      
      // Calculate wind force in ship's local space
      const shipRotation = this.playerShip.rotation;
      const windDir = new THREE.Vector3(
        Math.sin(this.wind.direction - shipRotation),
        0,
        Math.cos(this.wind.direction - shipRotation)
      );
      
      // Wind strength based on smooth deployment (furled = no wind effect)
      // Smooth deployment 0-1 maps to multiplier 0-1.5
      const positionMultiplier = smoothDeployment * 1.5;
      const windStrength = this.wind.speed * this.wind.gustFactor * positionMultiplier * 25;
      
      // Wind magic boost
      const magicBoost = windMagic ? 2.0 : 1.0;
      
      const windForce: WindForce = {
        direction: windDir,
        strength: windStrength * magicBoost,
        turbulence: windMagic ? 1.0 : 4.0 // Higher turbulence for natural flowing
      };
      
      // Apply wind and update simulation
      clothSim.applyWind(windForce);
      clothSim.update(0.016); // Fixed timestep for stability
      updateClothGeometry(clothGeometry, clothSim);
      
      // Wind magic effect on cloth mesh
      if (windMagic) {
        (clothMesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x4488ff);
        (clothMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      } else {
        (clothMesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
        (clothMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      }
      
      // Update additional sails for multi-mast ships
      if (this.playerShip.additionalSails) {
        for (const addSail of this.playerShip.additionalSails) {
          // Apply same wind force to additional sails
          addSail.clothSim.applyWind(windForce);
          addSail.clothSim.update(0.016);
          updateClothGeometry(addSail.clothGeometry, addSail.clothSim);
          
          // Update additional boom positions using this sail's OWN rig anchors,
          // clamped just below its gaff so the boom can never rise above the top
          // yard (which would invert/over-stretch the cloth).
          const addBoomTarget = addSail.boomFurledY + (addSail.boomDeployedY - addSail.boomFurledY) * smoothDeployment;
          const addBoomY = Math.min(addBoomTarget, addSail.gaffY - 0.05);
          addSail.clothSim.updateBoomPosition(addBoomY);
          addSail.boomMesh.position.y = addBoomY;
          
          // Wind magic effect on additional sails
          if (windMagic) {
            (addSail.clothMesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x4488ff);
            (addSail.clothMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
          } else {
            (addSail.clothMesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
            (addSail.clothMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          }
        }
      }
    }
    
    // Fallback simple sail mesh (hidden by default)
    if (this.playerShip.sailMesh) {
      const sail = this.playerShip.sailMesh;
      
      // Sail scale based on smooth deployment (0-1)
      // 0% deployment = furled (small), 100% = full (large)
      const scaleY = 0.1 + smoothDeployment * 1.2;  // 0.1 to 1.3
      const scaleX = 0.3 + smoothDeployment * 0.9;  // 0.3 to 1.2
      
      // Apply scale directly (smooth interpolation handled by currentSailDeployment)
      sail.scale.y = scaleY;
      sail.scale.x = scaleX;
      
      // Wind magic effect - make sail glow
      if (windMagic) {
        (sail.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x4488ff);
        (sail.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      } else {
        (sail.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
        (sail.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      }
      
      // Add billowing effect based on smooth deployment
      const time = Date.now() * 0.003;
      const billowAmount = smoothDeployment * 0.15;
      sail.position.z = 0.5 + Math.sin(time) * billowAmount;
    }
    
    // Orient the masthead pennant so it streams downwind. wind.direction is the
    // direction the wind blows FROM (bow into it = no-sail zone), so downwind is
    // wind.direction + PI. The pennant is a child of the heading frame, so we
    // subtract the ship's heading to get its local rotation.
    if (this.playerShip.windPennant) {
      this.playerShip.windPennant.rotation.y =
        this.wind.direction + Math.PI - this.playerShip.rotation;
      // Gentle flutter on the streamer that grows with wind speed.
      const pivot = this.playerShip.windPennant.getObjectByName('pennant_pivot');
      if (pivot) {
        const t = Date.now() * 0.004;
        const flutter = 0.1 + Math.min(this.wind.speed / 30, 0.22);
        pivot.rotation.x = Math.sin(t) * flutter;
        pivot.rotation.z = Math.sin(t * 1.7) * flutter * 0.5;
      }
    }
  }
  
  // Activate Wind Magic - 100% speed for 5 seconds
  activateWindMagic(): boolean {
    if (!this.playerShip) return false;
    if (this.playerShip.windMagicActive) return false;
    
    this.playerShip.windMagicActive = true;
    this.playerShip.windMagicTimer = 5.0;
    this.playerShip.sailPosition = 3; // Full sail for wind magic
    return true;
  }
  
  isWindMagicActive(): boolean {
    return this.playerShip?.windMagicActive ?? false;
  }
  
  getWindMagicTimer(): number {
    return this.playerShip?.windMagicTimer ?? 0;
  }
  
  updateWindMagic(delta: number) {
    if (!this.playerShip || !this.playerShip.windMagicActive) return;
    
    this.playerShip.windMagicTimer = Math.max(0, (this.playerShip.windMagicTimer ?? 0) - delta);
    
    if (this.playerShip.windMagicTimer <= 0) {
      this.playerShip.windMagicActive = false;
      this.playerShip.sailPosition = 2; // Return to deployed
    }
    
    this.updateSailVisuals();
  }
  
  // Valheim-style wind calculation
  // Returns speed based on wind direction relative to ship heading and sail trim angle
  // Wind from behind = fastest, directly into wind = no movement (no-sail zone)
  calculateWindEffect(shipRotation: number, sailsDeployed: boolean): { 
    speedMultiplier: number; 
    optimalAngle: boolean;
    inNoSailZone: boolean;
    windAngleDegrees: number;
  } {
    // Calculate angle between wind direction and ship heading even when sails are furled
    // This lets the HUD show wind angle information
    const windAngle = this.wind.direction - shipRotation;
    const normalizedAngle = Math.abs(((windAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
    const windAngleDegrees = (normalizedAngle * 180 / Math.PI);
    
    if (!this.playerShip || !sailsDeployed) {
      return { speedMultiplier: 0, optimalAngle: false, inNoSailZone: false, windAngleDegrees };
    }
    
    // Wind Magic override - 100% speed regardless of wind angle
    if (this.playerShip.windMagicActive) {
      return { speedMultiplier: 1.8, optimalAngle: true, inNoSailZone: false, windAngleDegrees };
    }
    
    let speedMultiplier = 0;
    let optimalAngle = false;
    let inNoSailZone = false;
    
    // Valheim-style wind zones:
    // 0-45° from bow (sailing into wind): No-sail zone, can't make progress
    // 45-90° (beam reach / close haul): Good speed, sail angle matters
    // 90-135° (broad reach): Best speed! Optimal sailing
    // 135-180° (running / downwind): Good speed, direct tailwind
    
    if (normalizedAngle < Math.PI / 4) {
      // No-sail zone: sailing directly into wind (0-45°)
      inNoSailZone = true;
      speedMultiplier = 0;  // Cannot sail into the wind
    } else if (normalizedAngle < Math.PI / 2) {
      // Close haul: 45-90° - decent speed
      speedMultiplier = 0.5 + (normalizedAngle - Math.PI/4) / (Math.PI/4) * 0.5;
    } else if (normalizedAngle < 3 * Math.PI / 4) {
      // Broad reach: 90-135° - BEST speed (beam reach is optimal around 50-55° crosswind)
      optimalAngle = true;
      speedMultiplier = 1.5 + Math.sin((normalizedAngle - Math.PI/2) * 2) * 0.3;  // Peak 1.5-1.8x
    } else {
      // Running downwind: 135-180° - good but not optimal
      speedMultiplier = 1.2 - (normalizedAngle - 3*Math.PI/4) / (Math.PI/4) * 0.3;
    }
    
    // Apply sail trim bonus/penalty
    // Optimal sail angle varies by point of sail:
    // - Close haul: sail tight (small angle)
    // - Beam reach: sail at ~45°
    // - Running: sail perpendicular or wing-on-wing
    const sailAngle = this.playerShip.sailAngle;
    const optimalSailAngle = this.calculateOptimalSailAngle(normalizedAngle);
    const sailAngleDiff = Math.abs(sailAngle - optimalSailAngle);
    
    // Sail trim effectiveness: perfect trim = 100%, 60° off = 50%
    const sailTrimEfficiency = Math.max(0.5, 1 - (sailAngleDiff / (Math.PI * 2/3)) * 0.5);
    speedMultiplier *= sailTrimEfficiency;
    
    // Apply smooth sail deployment as speed modifier (0-1 continuous)
    // Uses currentSailDeployment for smooth transitions between positions
    const smoothDeployment = this.playerShip.currentSailDeployment ?? 0;
    speedMultiplier *= smoothDeployment;
    
    // Apply wind intensity and gust factor
    speedMultiplier *= this.wind.gustFactor;
    speedMultiplier *= (this.wind.speed / 15);
    
    return { speedMultiplier, optimalAngle, inNoSailZone, windAngleDegrees };
  }
  
  // Calculate optimal sail angle for a given wind angle
  private calculateOptimalSailAngle(windAngleFromBow: number): number {
    // Close haul: tight sail
    if (windAngleFromBow < Math.PI / 2) {
      return windAngleFromBow * 0.3;  // Small angle
    }
    // Beam reach: moderate angle
    else if (windAngleFromBow < 3 * Math.PI / 4) {
      return Math.PI / 4;  // ~45°
    }
    // Running downwind: wide angle
    else {
      return Math.PI / 2;  // Perpendicular
    }
  }
  
  // Calculate ship movement based on wind with momentum physics (Valheim-style)
  calculateWindMovement(shipRotation: number, sailsDeployed: boolean, delta: number): THREE.Vector3 {
    if (!this.playerShip) return new THREE.Vector3(0, 0, 0);
    
    // Initialize momentum if not present
    if (!this.playerShip.momentum) {
      this.playerShip.momentum = new THREE.Vector3();
    }
    
    const momentum = this.playerShip.momentum;
    
    // Water physics constants
    const WATER_DRAG = 0.985;           // Water resistance per frame (~2% speed loss)
    const ACCELERATION_RATE = 2.0;      // How fast ship accelerates from wind
    const BASE_SPEED = 40;              // Max speed units per second at full sail
    
    // Calculate target velocity from wind
    let targetVelocity = new THREE.Vector3(0, 0, 0);
    
    const windEffect = this.calculateWindEffect(shipRotation, sailsDeployed);
    
    // Only generate thrust if sails can catch wind (not in no-sail zone)
    if (!windEffect.inNoSailZone && windEffect.speedMultiplier > 0) {
      const targetSpeed = BASE_SPEED * windEffect.speedMultiplier;
      
      // Thrust in ship's facing direction
      targetVelocity.set(
        Math.sin(shipRotation) * targetSpeed,
        0,
        Math.cos(shipRotation) * targetSpeed
      );
    }
    
    // Apply water drag to current momentum (always applied)
    // Drag is stronger at higher speeds (quadratic-ish)
    const currentSpeed = momentum.length();
    const dragFactor = Math.pow(WATER_DRAG, 1 + currentSpeed * 0.01);
    momentum.multiplyScalar(dragFactor);
    
    // Accelerate momentum towards target velocity
    // The ship gradually builds up speed, doesn't instantly reach max
    const acceleration = targetVelocity.clone().sub(momentum).multiplyScalar(ACCELERATION_RATE * delta);
    momentum.add(acceleration);
    
    // Clamp minimum speed (stop completely when very slow)
    if (momentum.length() < 0.1) {
      momentum.set(0, 0, 0);
    }
    
    // Return movement delta for this frame
    return momentum.clone().multiplyScalar(delta);
  }
  
  // Get current ship momentum (for HUD display)
  getShipMomentum(): THREE.Vector3 {
    return this.playerShip?.momentum?.clone() ?? new THREE.Vector3();
  }
  
  // Get ship speed from momentum
  getShipSpeed(): number {
    return this.playerShip?.momentum?.length() ?? 0;
  }
  
  startAiming() {
    if (this.aimingState.isAiming) return;
    
    this.aimingState.isAiming = true;
    
    const arcGeometry = new THREE.BufferGeometry();
    const arcMaterial = new THREE.LineBasicMaterial({ 
      color: 0x4488ff, 
      transparent: true, 
      opacity: 0.7,
      linewidth: 2
    });
    this.aimingState.arcMesh = new THREE.Line(arcGeometry, arcMaterial);
    this.scene.add(this.aimingState.arcMesh);
    
    const targetGeometry = new THREE.RingGeometry(3, 5, 32);
    const targetMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4488ff, 
      transparent: true, 
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    this.aimingState.targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    this.aimingState.targetMesh.rotation.x = -Math.PI / 2;
    this.aimingState.targetMesh.position.y = 0.2;
    this.scene.add(this.aimingState.targetMesh);
  }
  
  updateAiming(mouseX: number, mouseY: number, containerWidth: number, containerHeight: number) {
    if (!this.aimingState.isAiming || !this.playerShip) return;
    
    const ndcX = (mouseX / containerWidth) * 2 - 1;
    const ndcY = -(mouseY / containerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.activeCamera);
    
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(waterPlane, targetPoint);
    
    if (!targetPoint) return;
    
    const shipPos = this.playerShip.position.clone();
    shipPos.y = 4;
    
    this.aimingState.aimDirection = targetPoint.clone().sub(shipPos).normalize();
    
    const distance = Math.min(80, shipPos.distanceTo(targetPoint));
    const targetPos = shipPos.clone().add(this.aimingState.aimDirection.clone().multiplyScalar(distance));
    targetPos.y = 0.2;
    
    if (this.aimingState.targetMesh) {
      this.aimingState.targetMesh.position.copy(targetPos);
    }
    
    const arcPoints: THREE.Vector3[] = [];
    const steps = 20;
    const gravity = 9.8;
    const initialVelocity = 60;
    const angle = Math.atan2(distance * gravity, initialVelocity * initialVelocity) / 2;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const horizontalDist = distance * t;
      const height = horizontalDist * Math.tan(angle) - (gravity * horizontalDist * horizontalDist) / (2 * initialVelocity * initialVelocity * Math.cos(angle) * Math.cos(angle));
      
      const point = shipPos.clone().add(
        this.aimingState.aimDirection.clone().multiplyScalar(horizontalDist)
      );
      point.y = Math.max(0, 4 + height * 3);
      arcPoints.push(point);
    }
    
    if (this.aimingState.arcMesh) {
      const positions = new Float32Array(arcPoints.length * 3);
      arcPoints.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      });
      this.aimingState.arcMesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }
  
  stopAiming(fire: boolean): THREE.Vector3 | null {
    if (!this.aimingState.isAiming || !this.playerShip) {
      return null;
    }
    
    let fireVelocity: THREE.Vector3 | null = null;
    
    if (fire) {
      const direction = this.aimingState.aimDirection.clone();
      // Calculate velocity for 9.8 gravity with a good arc
      // Higher initial velocity and proper upward angle for visible trajectory
      const horizontalSpeed = 30; // Horizontal component
      const upwardSpeed = 12;     // Upward component for arc with 9.8 gravity
      direction.y = 0;
      direction.normalize();
      fireVelocity = direction.multiplyScalar(horizontalSpeed);
      fireVelocity.y = upwardSpeed;
    }
    
    if (this.aimingState.arcMesh) {
      this.scene.remove(this.aimingState.arcMesh);
      this.aimingState.arcMesh = null;
    }
    if (this.aimingState.targetMesh) {
      this.scene.remove(this.aimingState.targetMesh);
      this.aimingState.targetMesh = null;
    }
    
    this.aimingState.isAiming = false;
    return fireVelocity;
  }
  
  isAiming(): boolean {
    return this.aimingState.isAiming;
  }
  
  getTargetAtPosition(mouseX: number, mouseY: number, containerWidth: number, containerHeight: number): TargetInfo | null {
    if (!this.playerShip) return null;
    
    const ndcX = (mouseX / containerWidth) * 2 - 1;
    const ndcY = -(mouseY / containerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.activeCamera);
    
    // Collect all targetable meshes
    const targetables: THREE.Object3D[] = [];
    
    // Add islands
    this.islands.forEach((island) => {
      targetables.push(island.mesh);
    });
    
    // Add NPC ships
    this.npcShips.forEach((ship) => {
      targetables.push(ship.mesh);
    });
    
    // Add treasures
    this.treasures.forEach((treasure) => {
      if (!treasure.collected) {
        targetables.push(treasure.mesh);
      }
    });
    
    const intersects = raycaster.intersectObjects(targetables, true);
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitObject = this.findParentMesh(hit.object);
      
      // Check if it's an island
      let foundTarget: TargetInfo | null = null;
      
      this.islands.forEach((island, id) => {
        if (foundTarget) return;
        if (island.mesh === hitObject || island.mesh.getObjectById(hit.object.id)) {
          const distance = this.playerShip!.position.distanceTo(island.position);
          foundTarget = {
            type: 'island',
            id,
            name: island.name,
            distance: Math.round(distance),
            biome: island.biome,
          };
        }
      });
      
      if (foundTarget) return foundTarget;
      
      // Check if it's an NPC ship
      this.npcShips.forEach((ship, id) => {
        if (foundTarget) return;
        if (ship.mesh === hitObject || ship.mesh.getObjectById(hit.object.id)) {
          const distance = this.playerShip!.position.distanceTo(ship.position);
          foundTarget = {
            type: 'ship',
            id,
            name: ship.name,
            distance: Math.round(distance),
            health: ship.health,
            maxHealth: ship.maxHealth,
          };
        }
      });
      
      if (foundTarget) return foundTarget;
      
      // Check if it's a treasure
      this.treasures.forEach((treasure, id) => {
        if (foundTarget) return;
        if (treasure.mesh === hitObject) {
          const distance = this.playerShip!.position.distanceTo(treasure.position);
          foundTarget = {
            type: 'treasure',
            id,
            name: 'Floating Treasure',
            distance: Math.round(distance),
            value: treasure.value,
          };
        }
      });
      
      if (foundTarget) return foundTarget;
    }
    
    return null;
  }
  
  private findParentMesh(object: THREE.Object3D): THREE.Object3D {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.parent === this.scene || current.parent === null) {
        return current;
      }
      current = current.parent;
    }
    return object;
  }
  
  // Admin mode methods
  setAdminMode(enabled: boolean): void {
    this.adminMode = enabled;
  }
  
  isAdminMode(): boolean {
    return this.adminMode;
  }
  
  async importGLBFromFile(file: File, name: string): Promise<{ success: boolean; id?: string; error?: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          
          this.gltfLoader.load(
            url,
            (gltf) => {
              const model = gltf.scene;
              const id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              // Center the model and place it near the player
              const box = new THREE.Box3().setFromObject(model);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              
              model.position.sub(center);
              
              const group = new THREE.Group();
              group.add(model);
              group.name = name;
              group.userData.importedId = id;
              group.userData.originalName = name;
              
              // Place near player ship if exists
              if (this.playerShip) {
                group.position.copy(this.playerShip.position);
                group.position.x += 20;
              }
              
              this.scene.add(group);
              this.importedObjects.set(id, { mesh: group, name, type: 'imported' });
              
              URL.revokeObjectURL(url);
              resolve({ success: true, id });
            },
            undefined,
            (error) => {
              URL.revokeObjectURL(url);
              resolve({ success: false, error: `Failed to load GLB: ${error}` });
            }
          );
        } catch (error) {
          resolve({ success: false, error: `Failed to read file: ${error}` });
        }
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read file' });
      };
      reader.readAsArrayBuffer(file);
    });
  }
  
  getEditableObjects(): Array<{
    id: string;
    name: string;
    type: 'ship' | 'island' | 'prop' | 'imported';
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    visible: boolean;
  }> {
    const objects: Array<{
      id: string;
      name: string;
      type: 'ship' | 'island' | 'prop' | 'imported';
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
      visible: boolean;
    }> = [];
    
    // Add player ship
    if (this.playerShip) {
      objects.push({
        id: 'player-ship',
        name: 'Player Ship',
        type: 'ship',
        position: {
          x: this.playerShip.mesh.position.x,
          y: this.playerShip.mesh.position.y,
          z: this.playerShip.mesh.position.z
        },
        rotation: {
          x: this.playerShip.mesh.rotation.x,
          y: this.playerShip.mesh.rotation.y,
          z: this.playerShip.mesh.rotation.z
        },
        scale: {
          x: this.playerShip.mesh.scale.x,
          y: this.playerShip.mesh.scale.y,
          z: this.playerShip.mesh.scale.z
        },
        visible: this.playerShip.mesh.visible
      });
    }
    
    // Add imported objects
    this.importedObjects.forEach((obj, id) => {
      objects.push({
        id,
        name: obj.name,
        type: 'imported',
        position: {
          x: obj.mesh.position.x,
          y: obj.mesh.position.y,
          z: obj.mesh.position.z
        },
        rotation: {
          x: obj.mesh.rotation.x,
          y: obj.mesh.rotation.y,
          z: obj.mesh.rotation.z
        },
        scale: {
          x: obj.mesh.scale.x,
          y: obj.mesh.scale.y,
          z: obj.mesh.scale.z
        },
        visible: obj.mesh.visible
      });
    });
    
    return objects;
  }
  
  selectObject(id: string | null): void {
    this.selectedObjectId = id;
  }
  
  getSelectedObjectId(): string | null {
    return this.selectedObjectId;
  }
  
  getSelectedMesh(): THREE.Object3D | null {
    if (!this.selectedObjectId) return null;
    
    if (this.selectedObjectId === 'player-ship' && this.playerShip) {
      return this.playerShip.mesh;
    }
    
    const imported = this.importedObjects.get(this.selectedObjectId);
    if (imported) {
      return imported.mesh;
    }
    
    return null;
  }
  
  updateObjectTransform(id: string, transform: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
  }): void {
    let mesh: THREE.Object3D | null = null;
    
    if (id === 'player-ship' && this.playerShip) {
      mesh = this.playerShip.mesh;
    } else {
      const imported = this.importedObjects.get(id);
      if (imported) {
        mesh = imported.mesh;
      }
    }
    
    if (!mesh) return;
    
    if (transform.position) {
      mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
    }
    if (transform.rotation) {
      mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    }
    if (transform.scale) {
      mesh.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }
  }
  
  toggleObjectVisibility(id: string): void {
    let mesh: THREE.Object3D | null = null;
    
    if (id === 'player-ship' && this.playerShip) {
      mesh = this.playerShip.mesh;
    } else {
      const imported = this.importedObjects.get(id);
      if (imported) {
        mesh = imported.mesh;
      }
    }
    
    if (mesh) {
      mesh.visible = !mesh.visible;
    }
  }
  
  deleteObject(id: string): boolean {
    const imported = this.importedObjects.get(id);
    if (imported) {
      this.scene.remove(imported.mesh);
      imported.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.importedObjects.delete(id);
      if (this.selectedObjectId === id) {
        this.selectedObjectId = null;
      }
      return true;
    }
    return false;
  }
  
  async saveEditedObjects(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const edits: Array<{
        id: string;
        name: string;
        type: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
      }> = [];
      
      this.importedObjects.forEach((obj, id) => {
        edits.push({
          id,
          name: obj.name,
          type: 'imported',
          position: {
            x: obj.mesh.position.x,
            y: obj.mesh.position.y,
            z: obj.mesh.position.z
          },
          rotation: {
            x: obj.mesh.rotation.x,
            y: obj.mesh.rotation.y,
            z: obj.mesh.rotation.z
          },
          scale: {
            x: obj.mesh.scale.x,
            y: obj.mesh.scale.y,
            z: obj.mesh.scale.z
          }
        });
      });
      
      const response = await fetch('/api/admin/save-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits })
      });
      
      if (!response.ok) {
        return { success: false, error: 'Failed to save edits' };
      }
      
      return { success: true, data: edits };
    } catch (error) {
      return { success: false, error: `Failed to save: ${error}` };
    }
  }
}
