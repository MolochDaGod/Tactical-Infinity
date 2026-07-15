import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXModelLoader } from './fbxModelLoader';
import { FollowCamera } from './camera/FollowCamera';
import { IslandCombatManager, type CombatStats, type PlayerCombatState, type Enemy } from './islandCombat';
import { ResourceNodeManager, resourceNodeTemplates } from './resourceNodes';
import { IslandAnimalManager, ANIMAL_SPAWN_WEIGHTS, type LiveAnimal, type AnimalType } from './islandAnimals';
import { generateIslandTerrain, createWaterPlane, getNodeZone, selectNodeTypeForZone, createTerrainCollisionMesh, snapToTerrain, createWaterfall, updateWaterfallAnimation, type TerrainData, type WaterfallConfig } from './islandHeightmapTerrain';
import { homeInteriorManager, type HomeType, type LoadedInterior } from './homeInteriorManager';
import { type BuildingType, getBuildingModelPath, glbBuildingConfigs, isGlbBuilding } from './buildingManifest';
import type { HarvestResult, ResourceNode } from './harvestingProfessions';
import { PropColliderSystem } from './PropColliderSystem';
import type { Race, UnitClass } from '@shared/schema';
import {
  DOORWAY_WIDTH_M,
  WALL_STOREY_HEIGHT_M,
  createDoorwayMesh,
} from './islandsCanonical/metricSizing';

export interface IslandExploreConfig {
  container: HTMLElement;
  onPortalEnter?: (portalId: string, destination: string) => void;
  onExitIsland?: () => void;
  onCombatUpdate?: (stats: CombatStats, state: PlayerCombatState, gold: number) => void;
  onEnemyKilled?: (lootValue: number) => void;
  onPlayerDeath?: () => void;
  onResourceHarvested?: (result: HarvestResult) => void;
  onAnimalKilled?: (animal: LiveAnimal) => void;
}

export interface Portal {
  id: string;
  position: THREE.Vector3;
  destination: string;
  radius: number;
  mesh: THREE.Group;
  glowMesh: THREE.Mesh;
  active: boolean;
}

export interface CharacterState {
  position: THREE.Vector3;
  rotation: number;
  velocity: THREE.Vector3;
  isMoving: boolean;
  isRunning: boolean;
  currentAnimation: string;
}

export class IslandExploreManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private clock: THREE.Clock;
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXModelLoader;
  
  private character: THREE.Group | null = null;
  private characterState: CharacterState;
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Map<string, THREE.AnimationClip> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  
  private portals: Portal[] = [];
  private terrain: THREE.Group | null = null;
  private terrainData: TerrainData | null = null;
  private buildings: THREE.Group[] = [];
  private currentInterior: LoadedInterior | null = null;
  private isInInterior: boolean = false;
  private waterfall: THREE.Group | null = null;
  private islandName: string = '';
  private realisticTrees: THREE.Group[] = [];
  private treeLeaves: THREE.Mesh[] = [];
  private instancedRocks: THREE.InstancedMesh | null = null;
  private propColliders = new PropColliderSystem();
  private colliderRebuildTimer = 0;
  private windTime: number = 0;
  private windUniforms: { time: THREE.IUniform<number>; windStrength: THREE.IUniform<number>; windDirection: THREE.IUniform<THREE.Vector2> }[] = [];
  
  private keys: { [key: string]: boolean } = {};
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  /**
   * Unified follow-camera rig — one of three call sites of FollowCamera
   * (the other two being CharacterController.ThirdPersonCamera and
   * IslandBattlePage). Built lazily after `this.camera` is created so the
   * cameraAngle/cameraPitch/cameraDistance accessors below always have a
   * valid backing rig.
   */
  private followCam!: FollowCamera;
  // Back-compat accessors — the rest of this manager (movement code at
  // lines ~225, ~1316) reads cameraAngle to rotate WASD input relative to
  // the camera. Reading from the rig keeps that code untouched.
  private get cameraAngle(): number { return this.followCam.yaw; }
  private set cameraAngle(v: number) { this.followCam.yaw = v; }
  private get cameraPitch(): number { return this.followCam.pitch; }
  private set cameraPitch(v: number) { this.followCam.pitch = v; }
  private get cameraDistance(): number { return this.followCam.distance; }
  private set cameraDistance(v: number) { this.followCam.distance = v; }
  
  private config: IslandExploreConfig;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  
  private combatManager: IslandCombatManager | null = null;
  private resourceManager: ResourceNodeManager | null = null;
  private animalManager: IslandAnimalManager | null = null;
  private playerGold: number = 0;
  private isDodging: boolean = false;
  private dodgeDirection: THREE.Vector3 = new THREE.Vector3();
  private dodgeSpeed: number = 20;
  private isHarvesting: boolean = false;
  private harvestTarget: ResourceNode | null = null;
  private harvestProgress: number = 0;
  private targetAnimal: LiveAnimal | null = null;
  
  private readonly MOVE_SPEED = 8;
  private readonly RUN_SPEED = 14;
  private readonly ROTATION_SPEED = 5;
  private readonly CAMERA_LERP = 0.08;
  private readonly GRAVITY = -25;
  private readonly PLAYER_RADIUS = 0.6;
  
  constructor(config: IslandExploreConfig) {
    this.config = config;
    this.container = config.container;
    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXModelLoader();
    
    this.characterState = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: 0,
      velocity: new THREE.Vector3(),
      isMoving: false,
      isRunning: false,
      currentAnimation: 'idle'
    };
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 10, 15);

    // Build the unified follow-camera rig — handles right-mouse-drag yaw,
    // wheel zoom, smooth lerp toward target. Replaces the inline math that
    // used to live in handleMouseMove + updateCamera.
    this.followCam = new FollowCamera(this.camera, {
      yaw: 0,
      pitch: 0.3,
      distance: 12,
      lookAtHeight: 1.5,
      smoothness: 0.12,
      minPitch: -0.5,
      maxPitch: 1.2,
      minDistance: 4,
      maxDistance: 40,
      keyboardYaw: false, // movement uses Q/E for other actions in this manager
    });

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    this.setupLighting();
    this.setupEventListeners();
    this.initializeResources();
  }
  
  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.4);
    this.scene.add(hemisphereLight);
  }
  
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('resize', this.handleResize);
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = true;
    if (e.key === 'Shift') this.characterState.isRunning = true;
    
    if (e.code === 'Space') {
      e.preventDefault();
      this.performDodge();
    }

    if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (!this.tryHarvest()) {
        this.tryAttackAnimal();
      }
    }
    
    if (e.code === 'Tab') {
      e.preventDefault();
      this.combatManager?.toggleLockOn();
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = false;
    if (e.key === 'Shift') this.characterState.isRunning = false;
  };
  
  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.combatManager?.playerAttack();
    }
    if (e.button === 2) {
      this.combatManager?.playerBlock(true);
    }
  };
  
  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.combatManager?.playerBlock(false);
    }
  };
  
  private performDodge(): void {
    if (!this.combatManager) return;
    
    let moveX = 0;
    let moveZ = 0;
    if (this.keys['w']) moveZ -= 1;
    if (this.keys['s']) moveZ += 1;
    if (this.keys['a']) moveX -= 1;
    if (this.keys['d']) moveX += 1;
    
    if (moveX === 0 && moveZ === 0) {
      moveZ = -1;
    }
    
    const angle = Math.atan2(moveX, moveZ) + this.cameraAngle;
    this.dodgeDirection.set(Math.sin(angle), 0, Math.cos(angle));
    
    if (this.combatManager.playerDodge(this.dodgeDirection)) {
      this.isDodging = true;
      setTimeout(() => { this.isDodging = false; }, 500);
    }
  };
  
  private handleMouseMove = (_e: MouseEvent): void => {
    // Camera yaw/pitch is now driven by FollowCamera's own listeners.
    // This handler is preserved for any future non-camera mouse logic.
  };
  
  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
  
  async loadIslandTerrain(islandSize: 'small' | 'medium' | 'large' = 'large'): Promise<void> {
    if (this.islandName.toLowerCase().includes('waterfall')) {
      await this.loadStarterPirateIsland();
      return;
    }
    
    const sizeConfigs = {
      small: { radius: 100, maxHeight: 20, nodeCount: 40 },
      medium: { radius: 150, maxHeight: 30, nodeCount: 80 },
      large: { radius: 200, maxHeight: 40, nodeCount: 120 }
    };
    
    const config = sizeConfigs[islandSize];
    const terrainGroup = new THREE.Group();
    
    this.terrainData = generateIslandTerrain({
      radius: config.radius,
      segments: 128,
      maxHeight: config.maxHeight,
      noiseScale: 0.012,
      octaves: 5,
      persistence: 0.5,
      lacunarity: 2.0,
      seed: Math.random() * 10000,
      beachWidth: 20,
      waterLevel: 0
    });
    
    terrainGroup.add(this.terrainData.mesh);
    
    const collisionMesh = createTerrainCollisionMesh(this.terrainData);
    collisionMesh.name = 'terrain_collision';
    terrainGroup.add(collisionMesh);
    
    const water = createWaterPlane(config.radius);
    terrainGroup.add(water);
    
    this.terrain = terrainGroup;
    this.scene.add(terrainGroup);
    
    await this.spawnZonedResourceNodes(config.nodeCount);
    await this.createCabin();
    await this.placeStarterBuildings();
    
    this.scene.fog = new THREE.Fog(0x87ceeb, config.radius * 0.5, config.radius * 1.5);
  }
  
  async loadStarterPirateIsland(): Promise<void> {
    const loader = new GLTFLoader();
    const terrainGroup = new THREE.Group();
    const radius = 150;
    
    return new Promise((resolve, reject) => {
      loader.load(
        '/models/scenes/starter_pirates_island/scene.gltf',
        (gltf) => {
          const island = gltf.scene;
          
          island.scale.setScalar(1);
          island.position.set(0, 0, 0);
          
          let minY = Infinity;
          let maxY = -Infinity;
          let bounds = new THREE.Box3().setFromObject(island);
          minY = bounds.min.y;
          maxY = bounds.max.y;
          
          island.position.y = -minY;
          
          island.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              // Perf: the terrain body is a large, complex GLTF. Having every
              // sub-mesh cast shadows is the single biggest shadow-map cost on
              // this island. Keep receiveShadow (so trees/rocks still shadow
              // onto the ground) but stop the terrain from casting onto itself.
              mesh.castShadow = false;
              mesh.receiveShadow = true;
              
              mesh.userData.isNavmeshSurface = true;
              mesh.userData.isCollider = true;
            }
          });
          
          this.enhanceWaterfallTerrain(island);
          
          island.userData = { type: 'starter_pirate_island', isNavmeshSource: true };
          terrainGroup.add(island);
          
          const water = createWaterPlane(radius);
          water.position.y = 0;
          terrainGroup.add(water);
          
          const collisionGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 32, 32);
          const collisionMaterial = new THREE.MeshBasicMaterial({ visible: false });
          const groundPlane = new THREE.Mesh(collisionGeometry, collisionMaterial);
          groundPlane.rotation.x = -Math.PI / 2;
          groundPlane.position.y = 0.1;
          groundPlane.name = 'terrain_collision';
          groundPlane.userData.isCollider = true;
          terrainGroup.add(groundPlane);
          
          const segments = 128;
          const heightMap = new Float32Array(segments * segments);
          
          this.terrainData = {
            mesh: groundPlane,
            heightMap: heightMap,
            segments: segments,
            radius: radius,
            getHeightAt: (x: number, z: number) => {
              const raycaster = new THREE.Raycaster();
              raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
              const intersects = raycaster.intersectObject(island, true);
              if (intersects.length > 0) {
                return intersects[0].point.y;
              }
              return 0;
            },
            getNormalAt: (x: number, z: number) => {
              return new THREE.Vector3(0, 1, 0);
            },
            getSlopeAt: (_x: number, _z: number) => {
              return 0;
            },
          };
          
          this.terrain = terrainGroup;
          this.scene.add(terrainGroup);
          
          this.scene.fog = new THREE.Fog(0x87ceeb, radius * 0.5, radius * 1.5);
          
          console.log('Loaded Starter Pirate Island (Waterfall Isle core)');
          
          this.generateNavmeshFromIsland(island);
          
          this.scatterInstancedRocks();
          
          this.loadRealisticTrees().then(() => {
            console.log('Realistic trees loaded on Waterfall Isle');
          });
          
          resolve();
        },
        (progress) => {
          console.log(`Loading starter pirate island: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
        },
        (error) => {
          console.error('Failed to load starter pirate island:', error);
          reject(error);
        }
      );
    });
  }
  
  private generateNavmeshFromIsland(island: THREE.Object3D): void {
    const navmeshGroup = new THREE.Group();
    navmeshGroup.name = 'island_navmesh';
    
    const walkableMeshes: THREE.Mesh[] = [];
    island.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();
        if (name.includes('ground') || name.includes('floor') || name.includes('path') ||
            name.includes('walk') || name.includes('terrain') || name.includes('beach') ||
            name.includes('dock') || name.includes('platform') || !name.includes('tree')) {
          walkableMeshes.push(mesh);
        }
      }
    });
    
    walkableMeshes.forEach((mesh) => {
      mesh.userData.isNavmeshSurface = true;
      mesh.userData.walkable = true;
    });
    
    console.log(`Generated navmesh markers for ${walkableMeshes.length} walkable surfaces`);
  }
  
  setIslandName(name: string): void {
    this.islandName = name;
  }
  
  private addWaterfall(): void {
    if (!this.terrainData || !this.terrain) return;
    
    const highestPoint = { x: 0, z: 0, y: 0 };
    const samplePoints = 50;
    
    for (let i = 0; i < samplePoints; i++) {
      const angle = (i / samplePoints) * Math.PI * 2;
      const dist = this.terrainData.radius * 0.4;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrainData.getHeightAt(x, z);
      
      if (y > highestPoint.y) {
        highestPoint.x = x;
        highestPoint.z = z;
        highestPoint.y = y;
      }
    }
    
    const direction = new THREE.Vector3(
      -highestPoint.x,
      0,
      -highestPoint.z
    ).normalize();
    
    const waterfallConfig: WaterfallConfig = {
      position: new THREE.Vector3(
        highestPoint.x + direction.x * 5,
        highestPoint.y - 5,
        highestPoint.z + direction.z * 5
      ),
      width: 15,
      height: 25,
      direction
    };
    
    this.waterfall = createWaterfall(waterfallConfig);
    this.terrain.add(this.waterfall);
    
    console.log('Added massive waterfall to The Waterfall island');
  }
  
  private async placeCamp(): Promise<void> {
    if (!this.terrainData) return;
    
    const loader = new GLTFLoader();
    
    await Promise.all([
      this.loadWaterfallDiorama(loader),
      this.loadLoopingWaterfall(loader),
      this.loadEpicTemple(loader),
      this.loadPiratePetes(loader),
      this.loadWaypoint(loader),
      this.loadSpawnPoint(loader)
    ]);
    
    console.log('Placed all Waterfall Isle structures');
  }
  
  private async loadWaterfallDiorama(loader: GLTFLoader): Promise<void> {
    if (!this.terrainData) return;
    
    return new Promise((resolve) => {
      loader.load(
        '/models/scenes/waterfall_diorama/scene.gltf',
        (gltf) => {
          const diorama = gltf.scene;
          
          const highX = 0;
          const highZ = -this.terrainData!.radius * 0.4;
          const highY = this.terrainData!.getHeightAt(highX, highZ) + 40;
          
          diorama.scale.setScalar(8);
          diorama.position.set(highX, highY, highZ);
          diorama.rotation.y = Math.PI;
          
          diorama.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          if (gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(diorama);
            gltf.animations.forEach((clip) => {
              mixer.clipAction(clip).play();
            });
            diorama.userData.mixer = mixer;
          }
          
          diorama.userData = { type: 'waterfall_diorama' };
          this.buildings.push(diorama);
          this.scene.add(diorama);
          
          console.log('Placed waterfall diorama (floating island source)');
          resolve();
        },
        undefined,
        () => resolve()
      );
    });
  }
  
  private async loadLoopingWaterfall(loader: GLTFLoader): Promise<void> {
    if (!this.terrainData) return;
    
    const positions = [
      { x: 0, z: -this.terrainData.radius * 0.3, scale: 15, opacity: 0.9 },
      { x: 5, z: -this.terrainData.radius * 0.25, scale: 12, opacity: 0.7 },
      { x: -5, z: -this.terrainData.radius * 0.28, scale: 10, opacity: 0.6 },
      { x: 3, z: -this.terrainData.radius * 0.35, scale: 8, opacity: 0.5 },
    ];
    
    for (const pos of positions) {
      await new Promise<void>((resolve) => {
        loader.load(
          '/models/scenes/looping_waterfall/scene.gltf',
          (gltf) => {
            const waterfall = gltf.scene.clone();
            
            const terrainY = this.terrainData!.getHeightAt(pos.x, pos.z);
            
            waterfall.scale.setScalar(pos.scale);
            waterfall.position.set(pos.x, terrainY + 20, pos.z);
            
            waterfall.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                  const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
                  mat.transparent = true;
                  mat.opacity = pos.opacity;
                  mesh.material = mat;
                }
              }
            });
            
            if (gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(waterfall);
              gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                action.timeScale = 0.8 + Math.random() * 0.4;
                action.play();
              });
              waterfall.userData.mixer = mixer;
            }
            
            waterfall.userData = { type: 'looping_waterfall' };
            this.buildings.push(waterfall);
            this.scene.add(waterfall);
            resolve();
          },
          undefined,
          () => resolve()
        );
      });
    }
    
    console.log('Placed looping waterfall particles at multiple scales');
  }
  
  private async loadEpicTemple(loader: GLTFLoader): Promise<void> {
    if (!this.terrainData) return;
    
    return new Promise((resolve) => {
      loader.load(
        '/models/scenes/epic_alien_temple/scene.gltf',
        (gltf) => {
          const temple = gltf.scene;
          
          const templeX = -20;
          const templeZ = -this.terrainData!.radius * 0.15;
          const templeY = this.terrainData!.getHeightAt(templeX, templeZ);
          
          temple.scale.setScalar(3);
          temple.position.set(templeX, templeY, templeZ);
          temple.rotation.y = Math.PI * 0.25;
          
          temple.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          if (gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(temple);
            gltf.animations.forEach((clip) => {
              mixer.clipAction(clip).play();
            });
            temple.userData.mixer = mixer;
          }
          
          temple.userData = { type: 'epic_temple', interactable: true };
          this.buildings.push(temple);
          this.scene.add(temple);
          
          console.log('Placed epic alien temple near waterfall landing');
          resolve();
        },
        undefined,
        () => resolve()
      );
    });
  }
  
  private async loadPiratePetes(loader: GLTFLoader): Promise<void> {
    if (!this.terrainData) return;
    
    return new Promise((resolve) => {
      loader.load(
        '/models/scenes/pirate_petes/scene.gltf',
        (gltf) => {
          const shop = gltf.scene;
          
          const shopX = this.terrainData!.radius * 0.5;
          const shopZ = this.terrainData!.radius * 0.2;
          const shopY = Math.max(this.terrainData!.getHeightAt(shopX, shopZ), 0);
          
          shop.scale.setScalar(5);
          shop.position.set(shopX, shopY, shopZ);
          shop.rotation.y = -Math.PI * 0.7;
          
          shop.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          shop.userData = { type: 'pirate_shop', interactable: true, shopName: 'Docks & Shop' };
          this.buildings.push(shop);
          this.scene.add(shop);
          
          console.log('Placed docks and shop near coast');
          resolve();
        },
        undefined,
        () => resolve()
      );
    });
  }
  
  private async loadWaypoint(loader: GLTFLoader): Promise<void> {
    if (!this.terrainData) return;
    
    const waypointGeometry = new THREE.RingGeometry(2, 3, 32);
    const waypointMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      emissive: 0x2244aa,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const waypointRing = new THREE.Mesh(waypointGeometry, waypointMaterial);
    
    const wpX = 25;
    const wpZ = 15;
    const wpY = this.terrainData.getHeightAt(wpX, wpZ) + 0.1;
    
    waypointRing.position.set(wpX, wpY, wpZ);
    waypointRing.rotation.x = -Math.PI / 2;
    
    const stoneCount = 8;
    const stoneGroup = new THREE.Group();
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const stoneGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6);
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(angle) * 2.5, 0.75, Math.sin(angle) * 2.5);
      stone.castShadow = true;
      stoneGroup.add(stone);
    }
    stoneGroup.position.set(wpX, wpY, wpZ);
    
    stoneGroup.userData = { type: 'waypoint', interactable: true, destination: 'world_map' };
    this.buildings.push(stoneGroup);
    this.scene.add(waypointRing);
    this.scene.add(stoneGroup);
    
    console.log('Placed waypoint stone circle for teleportation');
  }
  
  private async loadSpawnPoint(loader: GLTFLoader): Promise<void> {
    if (!this.terrainData) return;
    
    return new Promise((resolve) => {
      loader.load(
        '/models/scenes/stylized_spawn/scene.gltf',
        (gltf) => {
          const spawn = gltf.scene;
          
          const spawnX = this.terrainData!.radius * 0.3 + 5;
          const spawnZ = 3;
          const spawnY = this.terrainData!.getHeightAt(spawnX, spawnZ);
          
          spawn.scale.setScalar(3);
          spawn.position.set(spawnX, spawnY, spawnZ);
          
          spawn.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          spawn.userData = { type: 'spawn_point' };
          this.buildings.push(spawn);
          this.scene.add(spawn);
          
          console.log('Placed stylized spawn point');
          resolve();
        },
        undefined,
        () => resolve()
      );
    });
  }
  
  private async spawnZonedResourceNodes(targetCount: number): Promise<void> {
    if (!this.terrainData || !this.resourceManager) return;
    
    const minSpacing = 10;
    const positions: THREE.Vector3[] = [];
    const maxAttempts = targetCount * 15;
    let attempts = 0;
    let spawned = 0;
    
    while (spawned < targetCount && attempts < maxAttempts) {
      attempts++;
      
      const angle = Math.random() * Math.PI * 2;
      const distFactor = Math.pow(Math.random(), 0.6);
      const dist = distFactor * (this.terrainData.radius - 25);
      
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrainData.getHeightAt(x, z);
      
      if (y < 1.5) continue;
      
      let tooClose = false;
      for (const existing of positions) {
        const dx = existing.x - x;
        const dz = existing.z - z;
        if (dx * dx + dz * dz < minSpacing * minSpacing) {
          tooClose = true;
          break;
        }
      }
      
      if (tooClose) continue;
      
      const zone = getNodeZone(this.terrainData, x, z);
      const nodeType = selectNodeTypeForZone(zone);
      
      if (!resourceNodeTemplates[nodeType]) continue;
      
      const position = new THREE.Vector3(x, y, z);
      positions.push(position);
      
      await this.resourceManager.spawnNode(nodeType, position, Math.random() * Math.PI * 2);
      spawned++;
    }
    
    console.log(`Spawned ${spawned} resource nodes across island`);
  }
  
  private async loadIslandProps(): Promise<void> {
    const treePositions = [
      { x: 15, z: 10 },
      { x: -20, z: 5 },
      { x: 10, z: -15 },
      { x: -15, z: -20 },
      { x: 25, z: -5 },
      { x: -10, z: 25 },
    ];
    
    for (const pos of treePositions) {
      const tree = this.createSimpleTree();
      tree.position.set(pos.x, 0, pos.z);
      tree.scale.setScalar(0.8 + Math.random() * 0.4);
      this.scene.add(tree);
    }
    
    const rockPositions = [
      { x: 5, z: 20 },
      { x: -25, z: -10 },
      { x: 30, z: 15 },
    ];
    
    for (const pos of rockPositions) {
      const rock = this.createSimpleRock();
      rock.position.set(pos.x, 0.5, pos.z);
      this.scene.add(rock);
    }
  }
  
  private createSimpleTree(): THREE.Group {
    const tree = new THREE.Group();
    
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);
    
    const foliageGeometry = new THREE.ConeGeometry(3, 6, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 6;
    foliage.castShadow = true;
    tree.add(foliage);
    
    return tree;
  }
  
  private createSimpleRock(): THREE.Mesh {
    const geometry = new THREE.DodecahedronGeometry(1.5, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.9,
      flatShading: true
    });
    const rock = new THREE.Mesh(geometry, material);
    rock.scale.set(1, 0.6, 1.2);
    rock.castShadow = true;
    return rock;
  }

  /**
   * Give the Waterfall Isle a crisper, more natural ground by re-texturing the
   * largest ground mesh of the GLTF with a tiling grassland PBR set, and by
   * bumping anisotropy on the model's existing baked textures so they stay
   * sharp at grazing camera angles. Shares one material + one texture set, so
   * it adds no meaningful per-frame cost.
   */
  private enhanceWaterfallTerrain(island: THREE.Group): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const texLoader = new THREE.TextureLoader();

    const loadTiled = (url: string, srgb: boolean): THREE.Texture => {
      const tex = texLoader.load(url);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(24, 24);
      tex.anisotropy = maxAniso;
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    // Find the mesh with the largest horizontal footprint — that's the ground.
    let groundMesh: THREE.Mesh | null = null;
    let groundArea = 0;
    const box = new THREE.Box3();
    const size = new THREE.Vector3();

    island.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      // Sharpen every existing baked texture on the model.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const map = (m as THREE.MeshStandardMaterial)?.map;
        if (map) map.anisotropy = maxAniso;
      }

      box.setFromObject(mesh);
      box.getSize(size);
      const footprint = size.x * size.z;
      if (footprint > groundArea) {
        groundArea = footprint;
        groundMesh = mesh;
      }
    });

    if (groundMesh) {
      const grassMat = new THREE.MeshStandardMaterial({
        map: loadTiled('/textures/ground/grassland/grass_diff.jpg', true),
        normalMap: loadTiled('/textures/ground/grassland/grass_nor.jpg', false),
        roughnessMap: loadTiled('/textures/ground/grassland/grass_rough.jpg', false),
        aoMap: loadTiled('/textures/ground/grassland/grass_ao.jpg', false),
        roughness: 1.0,
        metalness: 0.0,
      });
      (groundMesh as THREE.Mesh).material = grassMat;
      (groundMesh as THREE.Mesh).receiveShadow = true;
      console.log('[WaterfallIsle] Re-textured ground mesh with tiling grassland PBR');
    }
  }

  /**
   * Scatter rocks around the island as a single InstancedMesh — one draw call,
   * one geometry, one material for all rocks, so it's essentially free.
   */
  private scatterInstancedRocks(count = 28): void {
    if (!this.terrainData) return;

    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8a8178,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });

    const rocks = new THREE.InstancedMesh(geometry, material, count);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    rocks.name = 'instanced_rocks';

    const dummy = new THREE.Object3D();
    const radius = this.terrainData.radius * 0.42;
    let placed = 0;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * radius;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrainData.getHeightAt(x, z);
      if (!isFinite(y) || y < 0.4) continue; // skip water / off-island

      const s = 0.6 + Math.random() * 1.8;
      dummy.position.set(x, y + s * 0.3, z);
      dummy.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.4);
      dummy.scale.set(s, s * (0.55 + Math.random() * 0.3), s * (0.9 + Math.random() * 0.4));
      dummy.updateMatrix();
      rocks.setMatrixAt(placed++, dummy.matrix);
    }

    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    this.instancedRocks = rocks;
    this.scene.add(rocks);
    console.log(`[WaterfallIsle] Scattered ${placed} instanced rocks (1 draw call)`);
  }
  
  private async loadRealisticTrees(): Promise<void> {
    const loader = new GLTFLoader();
    const treePositions = [
      { x: 20, z: 15, scale: 0.015 },
      { x: -25, z: 10, scale: 0.012 },
      { x: 15, z: -20, scale: 0.018 },
      { x: -18, z: -25, scale: 0.014 },
      { x: 30, z: -8, scale: 0.016 },
      { x: -12, z: 30, scale: 0.013 },
      { x: 35, z: 25, scale: 0.011 },
      { x: -30, z: -15, scale: 0.017 },
      { x: 8, z: 35, scale: 0.014 },
      { x: -35, z: 20, scale: 0.015 },
      { x: 40, z: 5, scale: 0.016 },
      { x: -40, z: -5, scale: 0.013 },
      { x: 22, z: 38, scale: 0.015 },
      { x: -22, z: 40, scale: 0.014 },
      { x: 45, z: -25, scale: 0.017 },
      { x: -45, z: 30, scale: 0.012 },
      { x: 12, z: -38, scale: 0.016 },
      { x: -8, z: -42, scale: 0.014 },
    ];
    
    const loadTree = (path: string, positions: typeof treePositions): Promise<void> => {
      return new Promise((resolve) => {
        loader.load(
          path,
          (gltf) => {
            const treeTemplate = gltf.scene;
            
            for (const pos of positions) {
              const tree = treeTemplate.clone();
              tree.scale.setScalar(pos.scale);
              
              let groundY = 0;
              if (this.terrainData) {
                groundY = this.terrainData.getHeightAt(pos.x, pos.z);
                if (!isFinite(groundY) || groundY < 0.5) groundY = 0.5;
              }
              
              tree.position.set(pos.x, groundY, pos.z);
              tree.rotation.y = Math.random() * Math.PI * 2;
              
              tree.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  let isLeaf = false;
                  
                  if (mesh.material) {
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    if (mat.name && (mat.name.toLowerCase().includes('leaf') || mat.name.toLowerCase().includes('leaves'))) {
                      isLeaf = true;
                      mesh.userData.isLeaf = true;
                      // Cache leaf meshes so the per-frame wind loop iterates a
                      // flat list instead of traversing every tree each frame.
                      this.treeLeaves.push(mesh);
                    }
                  }
                  
                  // Perf: leaves are dense/alpha-tested; skip them as shadow
                  // casters. Trunks still cast so trees read as grounded.
                  mesh.castShadow = !isLeaf;
                  mesh.receiveShadow = false;
                }
              });
              
              this.realisticTrees.push(tree);
              this.scene.add(tree);
            }
            
            console.log(`Loaded realistic trees from ${path}`);
            resolve();
          },
          undefined,
          (error) => {
            console.warn(`Failed to load realistic trees from ${path}:`, error);
            resolve();
          }
        );
      });
    };
    
    const treePaths = [
      '/models/scenes/realistic_trees_extracted/scene.gltf',
      '/models/scenes/tree_wind_extracted/scene.gltf',
    ];
    
    const halfPositions = Math.ceil(treePositions.length / 2);
    
    await Promise.all([
      loadTree(treePaths[0], treePositions.slice(0, halfPositions)),
      loadTree(treePaths[1], treePositions.slice(halfPositions)),
    ]);
    
    console.log(`Placed ${this.realisticTrees.length} realistic trees on island`);
  }
  
  private updateWindAnimation(delta: number): void {
    this.windTime += delta;
    
    const windStrength = 0.3 + Math.sin(this.windTime * 0.5) * 0.15;
    
    // Perf: iterate the pre-cached flat list of leaf meshes instead of calling
    // tree.traverse() on every tree every frame (which walked every sub-mesh).
    for (const mesh of this.treeLeaves) {
      mesh.rotation.x = Math.sin(this.windTime * 2 + mesh.position.x * 0.1) * windStrength * 0.02;
      mesh.rotation.z = Math.cos(this.windTime * 2.3 + mesh.position.z * 0.1) * windStrength * 0.02;
    }
    
    for (const tree of this.realisticTrees) {
      tree.rotation.z = Math.sin(this.windTime * 0.8 + tree.position.x * 0.05) * windStrength * 0.005;
    }
  }
  
  private async createCabin(): Promise<void> {
    const cabin = new THREE.Group();
    // Architecture SSOT: doorway clear height 2.75 m, walls ~3.2 m storey.
    const wallH = WALL_STOREY_HEIGHT_M;
    const wallsGeometry = new THREE.BoxGeometry(10, wallH, 7.5);
    const wallsMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const walls = new THREE.Mesh(wallsGeometry, wallsMaterial);
    walls.position.y = wallH * 0.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    cabin.add(walls);
    
    const roofGeometry = new THREE.ConeGeometry(7.5, 3.5, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = wallH + 1.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    cabin.add(roof);
    
    // 2.75 m clear doorway (not a short prop door).
    const doorFrame = createDoorwayMesh(0x2d1810, {
      widthM: DOORWAY_WIDTH_M,
      thicknessM: 0.15,
    });
    doorFrame.position.x = 0;
    doorFrame.position.z = 3.85;
    // createDoorwayMesh already places y at DOORWAY_HEIGHT_M / 2 (2.75 m clear)
    cabin.add(doorFrame);
    
    const cabinX = 0;
    const cabinZ = -15;
    const cabinY = this.terrainData ? this.terrainData.getHeightAt(cabinX, cabinZ) : 0;
    cabin.position.set(cabinX, cabinY, cabinZ);
    this.buildings.push(cabin);
    this.scene.add(cabin);
    
    const portalY = this.terrainData ? this.terrainData.getHeightAt(0, -11) : 0;
    this.createPortal('shop_portal', new THREE.Vector3(0, portalY, -11), 'fantasy_shop');
  }
  
  async placeBuilding(
    type: BuildingType, 
    x: number, 
    z: number, 
    rotation: number = 0
  ): Promise<THREE.Group | null> {
    const modelPath = getBuildingModelPath(type, "first", 1);
    const config = glbBuildingConfigs[type] || { scale: 1.0, yOffset: 0 };
    
    return new Promise((resolve) => {
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          const building = gltf.scene;
          building.scale.setScalar(config.scale);
          
          const terrainY = this.terrainData ? this.terrainData.getHeightAt(x, z) : 0;
          building.position.set(x, terrainY + config.yOffset, z);
          building.rotation.y = rotation;
          
          building.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          building.userData = { type, buildingType: type };
          this.buildings.push(building);
          this.scene.add(building);
          
          resolve(building);
        },
        undefined,
        (error) => {
          console.error(`Failed to load building ${type}:`, error);
          resolve(null);
        }
      );
    });
  }
  
  async placeStarterBuildings(): Promise<void> {
    const hutX = -20;
    const hutZ = 10;
    await this.placeBuilding("hut", hutX, hutZ, Math.PI * 0.25);
    
    const farmX = 25;
    const farmZ = -5;
    await this.placeBuilding("farm", farmX, farmZ, -Math.PI * 0.1);
    
    const barricadeX = 15;
    const barricadeZ = 20;
    await this.placeBuilding("barricade", barricadeX, barricadeZ, Math.PI * 0.5);
  }
  
  createPortal(id: string, position: THREE.Vector3, destination: string): Portal {
    const portalGroup = new THREE.Group();
    
    const circleGeometry = new THREE.CircleGeometry(1.5, 32);
    const circleMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0.3,
      emissive: 0x0044aa,
      emissiveIntensity: 0.5
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.02;
    portalGroup.add(circle);
    
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0x00aaff) },
        intensity: { value: 1.5 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vec2(0.5);
          float dist = distance(vUv, center);
          
          float ring = abs(0.4 - dist);
          float glow = 1.0 - smoothstep(0.0, 0.2, ring);
          
          glow *= 0.7 + 0.3 * sin(time * 3.0);
          
          float innerGlow = 1.0 - smoothstep(0.0, 0.5, dist);
          innerGlow *= 0.3 + 0.1 * sin(time * 2.0 + dist * 10.0);
          
          vec3 finalColor = glowColor * (glow + innerGlow) * intensity;
          float alpha = (glow + innerGlow * 0.5) * 0.9;
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    const glowGeometry = new THREE.CircleGeometry(2, 32);
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.y = 0.03;
    portalGroup.add(glowMesh);
    
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 1;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 2;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    portalGroup.add(particles);
    
    portalGroup.position.copy(position);
    this.scene.add(portalGroup);
    
    const portal: Portal = {
      id,
      position: position.clone(),
      destination,
      radius: 1.5,
      mesh: portalGroup,
      glowMesh,
      active: true
    };
    
    this.portals.push(portal);
    return portal;
  }
  
  async loadCharacter(race: Race = 'human', unitClass: UnitClass = 'warrior'): Promise<void> {
    const characterGroup = new THREE.Group();
    
    try {
      const goblinGltf = await new Promise<any>((resolve, reject) => {
        this.gltfLoader.load(
          '/models/goblin_npc.glb',
          (gltf) => resolve(gltf),
          undefined,
          (error) => reject(error)
        );
      });
      
      const goblinModel = goblinGltf.scene;
      goblinModel.scale.setScalar(1.0);
      goblinModel.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      characterGroup.add(goblinModel);
      
      if (goblinGltf.animations && goblinGltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(goblinModel);
        for (const clip of goblinGltf.animations) {
          this.animations.set(clip.name.toLowerCase(), clip);
        }
        const idleClip = this.animations.get('idle') || goblinGltf.animations[0];
        if (idleClip) {
          this.currentAction = this.mixer.clipAction(idleClip);
          this.currentAction.play();
        }
      }
      
      console.log('Loaded goblin character model');
    } catch (error) {
      console.warn('Failed to load goblin model, using placeholder:', error);
      const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7c23 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 1;
      body.castShadow = true;
      characterGroup.add(body);
      
      const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
      const headMaterial = new THREE.MeshStandardMaterial({ color: 0x5a8c33 });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 2;
      head.castShadow = true;
      characterGroup.add(head);
    }
    
    this.character = characterGroup;
    // Tell the unified follow-camera who to track. setTarget is a smooth
    // swap — if the user later picks a different entity (in the editor),
    // the camera will glide rather than teleport.
    this.followCam.setTarget(characterGroup);

    let startX = 0;
    let startZ = 5;
    let startY = 10;
    
    if (this.islandName.toLowerCase().includes('waterfall') && this.terrainData) {
      startX = this.terrainData.radius * 0.3 + 5;
      startZ = 3;
      const terrainY = this.terrainData.getHeightAt(startX, startZ);
      startY = Math.max(isFinite(terrainY) ? terrainY + 1 : 2, 2);
      console.log('Spawning player at coast near camp on Waterfall Island, terrain height:', terrainY);
    } else if (this.terrainData) {
      const terrainY = this.terrainData.getHeightAt(startX, startZ);
      startY = Math.max(isFinite(terrainY) ? terrainY + 1 : 2, 2);
    }
    
    if (startY < 1) startY = 10;
    
    console.log(`Spawning player at (${startX}, ${startY}, ${startZ})`);
    this.character.position.set(startX, startY, startZ);
    this.characterState.position.copy(this.character.position);
    this.characterState.velocity.y = 0;
    this.scene.add(this.character);
  }
  
  async enterHomeInterior(homeType: HomeType, homeId: string): Promise<boolean> {
    const interior = await homeInteriorManager.createThemedInterior(homeType, homeId);
    if (!interior) return false;
    
    this.isInInterior = true;
    this.currentInterior = interior;
    
    if (this.terrain) {
      this.terrain.visible = false;
    }
    
    this.scene.add(interior.scene);
    
    const lighting = homeInteriorManager.createInteriorLighting(interior.theme);
    interior.scene.add(lighting);
    
    if (this.character) {
      this.character.position.copy(interior.entryPoint);
      this.characterState.position.copy(interior.entryPoint);
    }
    
    this.scene.background = new THREE.Color(interior.theme.fogColor);
    this.scene.fog = new THREE.Fog(interior.theme.fogColor, 5, 25);
    
    return true;
  }
  
  exitHomeInterior(): void {
    if (!this.isInInterior || !this.currentInterior) return;
    
    this.scene.remove(this.currentInterior.scene);
    this.isInInterior = false;
    this.currentInterior = null;
    
    if (this.terrain) {
      this.terrain.visible = true;
    }
    
    if (this.character && this.terrainData) {
      const exitX = 0;
      const exitZ = 5;
      const exitY = this.terrainData.getHeightAt(exitX, exitZ);
      this.character.position.set(exitX, exitY, exitZ);
      this.characterState.position.copy(this.character.position);
    }
    
    this.scene.background = new THREE.Color(0x87ceeb);
    const radius = this.terrainData ? this.terrainData.radius : 100;
    this.scene.fog = new THREE.Fog(0x87ceeb, radius * 0.5, radius * 1.5);
  }
  
  getTerrainData(): TerrainData | null {
    return this.terrainData;
  }
  
  private updateCharacter(delta: number): void {
    if (!this.character) return;
    
    let moveX = 0;
    let moveZ = 0;
    
    if (this.keys['w']) moveZ -= 1;
    if (this.keys['s']) moveZ += 1;
    if (this.keys['a']) moveX -= 1;
    if (this.keys['d']) moveX += 1;
    
    this.characterState.isMoving = moveX !== 0 || moveZ !== 0;
    
    if (this.characterState.isMoving) {
      const moveAngle = Math.atan2(moveX, moveZ) + this.cameraAngle;
      
      const speed = this.characterState.isRunning ? this.RUN_SPEED : this.MOVE_SPEED;
      
      this.characterState.velocity.x = Math.sin(moveAngle) * speed;
      this.characterState.velocity.z = Math.cos(moveAngle) * speed;
      
      const targetRotation = moveAngle;
      let rotationDiff = targetRotation - this.characterState.rotation;
      
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
      
      this.characterState.rotation += rotationDiff * this.ROTATION_SPEED * delta;
      
      this.playAnimation('walk');
    } else {
      this.characterState.velocity.x *= 0.9;
      this.characterState.velocity.z *= 0.9;
      this.playAnimation('idle');
    }
    
    this.characterState.position.x += this.characterState.velocity.x * delta;
    this.characterState.position.z += this.characterState.velocity.z * delta;
    
    const maxDistance = this.terrainData ? this.terrainData.radius - 10 : 45;
    const distFromCenter = Math.sqrt(
      this.characterState.position.x ** 2 + 
      this.characterState.position.z ** 2
    );
    
    if (distFromCenter > maxDistance) {
      const scale = maxDistance / distFromCenter;
      this.characterState.position.x *= scale;
      this.characterState.position.z *= scale;
    }
    
    if (!this.isInInterior && this.propColliders.count > 0) {
      this.propColliders.resolve(this.characterState.position, this.PLAYER_RADIUS);
    }
    
    if (this.terrainData && !this.isInInterior) {
      let terrainHeight = this.terrainData.getHeightAt(
        this.characterState.position.x,
        this.characterState.position.z
      );
      
      if (!isFinite(terrainHeight)) {
        terrainHeight = 0;
      }
      
      this.characterState.velocity.y += this.GRAVITY * delta;
      this.characterState.position.y += this.characterState.velocity.y * delta;
      
      if (this.characterState.position.y <= terrainHeight) {
        this.characterState.position.y = terrainHeight;
        this.characterState.velocity.y = 0;
      }
      
      if (this.characterState.position.y < terrainHeight - 2) {
        console.log('Character under terrain, respawning above at height:', terrainHeight + 0.5);
        this.characterState.position.y = terrainHeight + 0.5;
        this.characterState.velocity.y = 0;
      }
    }
    
    this.character.position.copy(this.characterState.position);
    this.character.rotation.y = this.characterState.rotation;
    
    this.checkPortalCollisions();
  }
  
  private playAnimation(name: string): void {
    if (!this.mixer || this.characterState.currentAnimation === name) return;
    
    const clip = this.animations.get(name);
    if (!clip) return;
    
    const newAction = this.mixer.clipAction(clip);
    
    if (this.currentAction) {
      newAction.reset();
      newAction.crossFadeFrom(this.currentAction, 0.2, true);
    }
    
    newAction.play();
    this.currentAction = newAction;
    this.characterState.currentAnimation = name;
  }
  
  private checkPortalCollisions(): void {
    for (const portal of this.portals) {
      if (!portal.active) continue;
      
      const distance = this.characterState.position.distanceTo(portal.position);
      
      if (distance < portal.radius) {
        if (this.config.onPortalEnter) {
          this.config.onPortalEnter(portal.id, portal.destination);
        }
      }
    }
  }
  
  /**
   * Decide whether a scene node is a solid prop the player should collide
   * with. Excludes the character, terrain, water, portals and decorative
   * effects; includes resource nodes, buildings, structures and trees/rocks
   * (by userData flag, tracked-array membership, or name heuristic).
   */
  private isSolidProp(obj: THREE.Object3D): boolean {
    if (obj === this.character || obj === this.terrain || obj === this.waterfall) return false;
    const ud = obj.userData || {};
    if (ud.isPortal || ud.noCollide) return false;
    if (ud.isResourceNode || ud.solid || ud.isBuilding) return true;
    if (this.buildings.includes(obj as THREE.Group)) return true;
    if (this.realisticTrees.includes(obj as THREE.Group)) return true;
    const name = (obj.name || '').toLowerCase();
    if (!name) return false;
    if (/terrain|water|ocean|ground|portal|glow|sky|light|particle|character|player|waterfall|grass|cloud|flower/.test(name)) {
      return false;
    }
    return /rock|boulder|tree|trunk|crystal|ore|cabin|temple|shop|house|hut|building|wall|structure|statue|node|stone|pillar/.test(name);
  }
  
  /** Throttled rebuild of the prop collider set from the current scene graph. */
  private rebuildPropColliders(): void {
    if (this.isInInterior) {
      this.propColliders.clear();
      return;
    }
    this.propColliders.rebuildFromScene(
      this.scene,
      (o) => this.isSolidProp(o),
      (obj) => {
        // Harvestable nodes must stay tight: harvesting uses a center-distance
        // cutoff of 3m (getNearestResource), so the push-out radius
        // (collider radius + PLAYER_RADIUS 0.6) must stay below that or large
        // nodes become unreachable. Cap node colliders so push-out <= 2.4m.
        if (obj.userData?.isResourceNode) {
          return { tightness: 0.5, minRadius: 0.3, maxRadius: 1.8 };
        }
        return { tightness: 0.62, minRadius: 0.3, maxRadius: 10 };
      },
    );
  }
  
  private updateCamera(delta: number): void {
    if (!this.character) return;
    // Delegate to the unified follow-camera rig. We pass the character's
    // logical position vector so the camera always tracks the simulation
    // state, not whatever transform interpolation the mesh might lag behind.
    this.followCam.update(delta, this.characterState.position);
  }
  
  private updatePortals(delta: number, elapsedTime: number): void {
    for (const portal of this.portals) {
      const material = portal.glowMesh.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.time.value = elapsedTime;
      }
      
      const particles = portal.mesh.children.find(c => c instanceof THREE.Points) as THREE.Points;
      if (particles) {
        const positions = particles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] += delta * 0.5;
          if (positions[i + 1] > 2) {
            positions[i + 1] = 0;
          }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.rotation.y += delta * 0.5;
      }
    }
  }
  
  private animate = (): void => {
    if (this.isDisposed) return;
    
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();
    
    this.colliderRebuildTimer -= delta;
    if (this.colliderRebuildTimer <= 0) {
      this.colliderRebuildTimer = 0.4;
      this.rebuildPropColliders();
    }
    
    this.updateCharacter(delta);
    this.updateCamera(delta);
    this.updatePortals(delta, elapsedTime);
    this.updateCombat(delta);
    this.updateHarvesting(delta);
    this.updateAnimals(delta);
    
    if (this.mixer) {
      this.mixer.update(delta);
    }
    
    if (this.waterfall) {
      updateWaterfallAnimation(this.waterfall, delta);
    }
    
    if (this.realisticTrees.length > 0) {
      this.updateWindAnimation(delta);
    }
    
    for (const building of this.buildings) {
      if (building.userData?.mixer) {
        building.userData.mixer.update(delta);
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  };
  
  private updateCombat(delta: number): void {
    if (!this.combatManager) return;
    
    this.combatManager.updatePlayerPosition(this.characterState.position);
    this.combatManager.update(delta);
    
    const collectedLoot = this.combatManager.collectLoot();
    if (collectedLoot > 0) {
      this.playerGold += collectedLoot;
    }
    
    const stats = this.combatManager.getPlayerStats();
    const state = this.combatManager.getPlayerState();
    
    if (this.config.onCombatUpdate) {
      this.config.onCombatUpdate(stats, state, this.playerGold);
    }
    
    if (stats.health <= 0 && this.config.onPlayerDeath) {
      this.config.onPlayerDeath();
    }
  }
  
  start(): void {
    this.clock.start();
    this.animate();
  }
  
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  async initializeCombat(): Promise<void> {
    this.combatManager = new IslandCombatManager(this.scene);
    await this.combatManager.loadEnemyAssets();
  }

  initializeResources(): void {
    this.resourceManager = new ResourceNodeManager(this.scene);
    this.animalManager = new IslandAnimalManager(this.scene, this.resourceManager);
  }

  spawnIslandResources(center: THREE.Vector3, radius: number): void {
    if (!this.resourceManager) {
      this.initializeResources();
    }

    const validResourceTypes = Object.keys(resourceNodeTemplates).filter(
      key => ['oak_tree', 'pine_tree', 'stone_boulder', 'granite_rock',
              'iron_vein', 'copper_vein', 'healing_herb', 'fiber_plant'].includes(key)
    );
    
    if (validResourceTypes.length > 0) {
      this.resourceManager?.spawnRandomNodesOnIsland(center, radius, validResourceTypes, 15);
    }
  }

  spawnIslandAnimals(center: THREE.Vector3, radius: number): void {
    if (!this.animalManager) {
      this.initializeResources();
    }

    if (this.terrainData) {
      const terrain = this.terrainData;
      this.animalManager?.setGroundSampler((x, z) => terrain.getHeightAt(x, z));
    }

    const animalTypes: AnimalType[] = [
      'rabbit', 'deer', 'boar', 'goat', 'fox', 'stag', 'wolf', 'bull', 'lamb',
    ];
    this.animalManager?.spawnRandomAnimalsOnIsland(
      center, radius, animalTypes, 12, ANIMAL_SPAWN_WEIGHTS,
    );
  }

  setupCompleteIsland(center: THREE.Vector3 = new THREE.Vector3(0, 0, 0), radius: number = 40): void {
    this.spawnIslandResources(center, radius);
    this.spawnIslandAnimals(center, radius);
  }

  private getNearestResource(): ResourceNode | null {
    if (!this.resourceManager) return null;
    
    const nodes = this.resourceManager.getAllNodes();
    let nearest: ResourceNode | null = null;
    let nearestDist = Infinity;

    nodes.forEach((node) => {
      if (!node.isActive) return;
      const dist = this.characterState.position.distanceTo(node.position);
      if (dist < nearestDist && dist < 3) {
        nearestDist = dist;
        nearest = node;
      }
    });

    return nearest;
  }

  private getNearestAnimal(): LiveAnimal | null {
    if (!this.animalManager) return null;
    return this.animalManager.getAnimalAtPosition(this.characterState.position, 4);
  }

  tryHarvest(): boolean {
    if (this.isHarvesting) return false;

    const resource = this.getNearestResource();
    if (resource) {
      this.isHarvesting = true;
      this.harvestTarget = resource;
      this.harvestProgress = 0;
      return true;
    }
    return false;
  }

  tryAttackAnimal(): boolean {
    const animal = this.getNearestAnimal();
    if (animal && animal.state !== 'dead') {
      this.targetAnimal = animal;
      const damage = 15;
      const killed = this.animalManager?.damageAnimal(animal.id, damage, this.characterState.position);
      
      if (killed && this.config.onAnimalKilled) {
        this.config.onAnimalKilled(animal);
      }
      return true;
    }
    return false;
  }

  private updateHarvesting(delta: number): void {
    if (!this.isHarvesting || !this.harvestTarget || !this.resourceManager) return;

    this.harvestProgress += delta * 2;

    if (this.harvestProgress >= 1) {
      const node = this.harvestTarget;
      const damage = 10;
      node.health -= damage;

      this.resourceManager.updateNodeVisual(node.id, node.health / node.maxHealth);

      if (node.health <= 0) {
        const yieldAmount = node.yieldMin + Math.floor(Math.random() * (node.yieldMax - node.yieldMin + 1));
        
        const result: HarvestResult = {
          success: true,
          resourceType: node.type,
          amount: yieldAmount,
          xpGained: node.xpReward,
          nodeDestroyed: true,
          message: `Harvested ${yieldAmount} ${node.type}!`
        };

        this.resourceManager.setNodeActive(node.id, false);

        if (this.config.onResourceHarvested) {
          this.config.onResourceHarvested(result);
        }

        this.isHarvesting = false;
        this.harvestTarget = null;
      } else {
        this.harvestProgress = 0;
      }
    }
  }

  private updateAnimals(delta: number): void {
    if (!this.animalManager) return;
    this.animalManager.update(delta, this.characterState.position);
  }

  getResourceManager(): ResourceNodeManager | null {
    return this.resourceManager;
  }

  getAnimalManager(): IslandAnimalManager | null {
    return this.animalManager;
  }

  getHarvestingState(): { isHarvesting: boolean; progress: number; target: ResourceNode | null } {
    return {
      isHarvesting: this.isHarvesting,
      progress: this.harvestProgress,
      target: this.harvestTarget
    };
  }

  cancelHarvesting(): void {
    this.isHarvesting = false;
    this.harvestTarget = null;
    this.harvestProgress = 0;
  }
  
  spawnEnemy(position: THREE.Vector3, patrolPoints?: THREE.Vector3[]): Enemy | null {
    return this.combatManager?.spawnEnemy(position, patrolPoints) || null;
  }
  
  spawnEnemyWave(count: number, centerPosition: THREE.Vector3, radius: number): Enemy[] {
    const enemies: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = centerPosition.x + Math.cos(angle) * radius;
      const z = centerPosition.z + Math.sin(angle) * radius;
      const position = new THREE.Vector3(x, 0, z);
      
      const patrolRadius = 5;
      const patrolPoints = [
        new THREE.Vector3(x + patrolRadius, 0, z),
        new THREE.Vector3(x, 0, z + patrolRadius),
        new THREE.Vector3(x - patrolRadius, 0, z),
        new THREE.Vector3(x, 0, z - patrolRadius),
      ];
      
      const enemy = this.spawnEnemy(position, patrolPoints);
      if (enemy) enemies.push(enemy);
    }
    return enemies;
  }
  
  getCombatManager(): IslandCombatManager | null {
    return this.combatManager;
  }
  
  getPlayerGold(): number {
    return this.playerGold;
  }
  
  addPlayerGold(amount: number): void {
    this.playerGold += amount;
  }
  
  dispose(): void {
    this.isDisposed = true;
    this.stop();

    this.followCam?.dispose();
    this.combatManager?.dispose();
    this.resourceManager?.clearAllNodes();
    this.animalManager?.clearAllAnimals();
    this.propColliders.clear();
    
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('resize', this.handleResize);
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else if (object.material) {
          object.material.dispose();
        }
      }
    });
    
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
  
  getCharacterPosition(): THREE.Vector3 {
    return this.characterState.position.clone();
  }
  
  setCharacterPosition(position: THREE.Vector3): void {
    this.characterState.position.copy(position);
    if (this.character) {
      this.character.position.copy(position);
    }
  }
  
  getRendererStats(): {
    drawCalls: number;
    triangles: number;
    memory: number;
    objectCount: number;
  } {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      memory: (info.memory.geometries + info.memory.textures) * 0.001,
      objectCount: this.scene.children.length
    };
  }
  
  getCameraInfo(): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      rotation: {
        x: this.camera.rotation.x,
        y: this.camera.rotation.y,
        z: this.camera.rotation.z
      }
    };
  }
  
  getSceneObjects(): Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    visible: boolean;
  }> {
    return this.scene.children.slice(0, 20).map((obj, i) => ({
      id: obj.uuid,
      name: obj.name || `Object_${i}`,
      type: obj.type,
      position: {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z
      },
      visible: obj.visible
    }));
  }
  
  getScene(): THREE.Scene {
    return this.scene;
  }
  
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  
  teleportPlayer(x: number, z: number): void {
    if (!this.terrainData) return;
    
    const maxDist = this.terrainData.radius - 5;
    const dist = Math.sqrt(x * x + z * z);
    
    let finalX = x;
    let finalZ = z;
    if (dist > maxDist) {
      const scale = maxDist / dist;
      finalX *= scale;
      finalZ *= scale;
    }
    
    const y = this.terrainData.getHeightAt(finalX, finalZ) + 0.5;
    
    this.characterState.position.set(finalX, y, finalZ);
    this.characterState.velocity.set(0, 0, 0);
    
    if (this.character) {
      this.character.position.set(finalX, y, finalZ);
    }
    
    console.log(`Teleported player to (${finalX.toFixed(1)}, ${y.toFixed(1)}, ${finalZ.toFixed(1)})`);
  }
  
  async spawnObjectAtPosition(
    assetPath: string,
    x: number,
    z: number,
    rotation: number = 0,
    scale: number = 1.0
  ): Promise<THREE.Group | null> {
    if (!this.terrainData) return null;
    
    const snappedPos = snapToTerrain(this.terrainData, x, z, 0);
    
    if (!snappedPos.isOnTerrain) {
      console.warn(`Position (${x}, ${z}) is outside terrain bounds`);
    }
    
    return new Promise((resolve) => {
      this.gltfLoader.load(
        assetPath,
        (gltf) => {
          const object = gltf.scene;
          object.scale.setScalar(scale);
          object.position.set(snappedPos.x, snappedPos.y, snappedPos.z);
          object.rotation.y = rotation;
          
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          object.userData = {
            spawned: true,
            assetPath,
            spawnTime: Date.now(),
            terrainSnapped: true
          };
          
          this.scene.add(object);
          this.buildings.push(object);
          
          console.log(`Spawned object at (${snappedPos.x.toFixed(1)}, ${snappedPos.y.toFixed(1)}, ${snappedPos.z.toFixed(1)}) - terrain snapped`);
          resolve(object);
        },
        undefined,
        (error) => {
          console.error('Failed to spawn object from path:', assetPath, error);
          resolve(null);
        }
      );
    });
  }
  
  removeObject(uuid: string): boolean {
    const object = this.scene.getObjectByProperty('uuid', uuid);
    if (!object) return false;
    
    this.scene.remove(object);
    
    const buildingIdx = this.buildings.findIndex(b => b.uuid === uuid);
    if (buildingIdx >= 0) {
      this.buildings.splice(buildingIdx, 1);
    }
    
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
    
    return true;
  }
  
  getPlacedObjects(): Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  }> {
    return this.buildings.map((building, i) => ({
      id: building.uuid,
      name: building.userData?.type || building.name || `Building_${i}`,
      type: building.userData?.buildingType || 'building',
      position: {
        x: building.position.x,
        y: building.position.y,
        z: building.position.z
      },
      rotation: {
        x: building.rotation.x,
        y: building.rotation.y,
        z: building.rotation.z
      },
      scale: building.scale.x
    }));
  }
  
  alignAllObjectsToTerrain(): void {
    if (!this.terrainData) return;
    
    for (const building of this.buildings) {
      const x = building.position.x;
      const z = building.position.z;
      const y = this.terrainData.getHeightAt(x, z);
      building.position.y = y + (building.userData?.yOffset || 0);
    }
    
    if (this.resourceManager) {
      const nodes = this.resourceManager.getAllNodes();
      for (const node of nodes) {
        if (node.mesh) {
          const x = node.mesh.position.x;
          const z = node.mesh.position.z;
          const y = this.terrainData.getHeightAt(x, z);
          node.mesh.position.y = y;
          node.position.y = y;
        }
      }
    }
    
    console.log('Aligned all objects to terrain');
  }
}
