import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createToonOceanPlane, updateToonWater } from './toonWaterShader';

export interface IslandElementConfig {
  enabled: boolean;
  position?: THREE.Vector3;
  rotation?: number;
  scale?: number;
}

export interface WaterfallIsleConfig {
  coreIsland: IslandElementConfig;
  beachTerrain: IslandElementConfig;
  surroundingWater: IslandElementConfig;
  debris: IslandElementConfig;
  palmTrees: IslandElementConfig;
  dock: IslandElementConfig;
  signpost: IslandElementConfig;
  realisticTrees: IslandElementConfig;
  waterfallDiorama: IslandElementConfig;
  loopingWaterfalls: IslandElementConfig;
  epicTemple: IslandElementConfig;
  pirateShop: IslandElementConfig;
  waypoint: IslandElementConfig;
  spawnMarker: IslandElementConfig;
}

export const DEFAULT_WATERFALL_ISLE_CONFIG: WaterfallIsleConfig = {
  coreIsland: { enabled: true, scale: 1 },
  beachTerrain: { enabled: false },
  surroundingWater: { enabled: true },
  debris: { enabled: false },
  palmTrees: { enabled: false },
  dock: { enabled: false },
  signpost: { enabled: false },
  realisticTrees: { enabled: true },
  waterfallDiorama: { enabled: false },
  loopingWaterfalls: { enabled: false },
  epicTemple: { enabled: false },
  pirateShop: { enabled: false },
  waypoint: { enabled: true },
  spawnMarker: { enabled: true },
};

export interface LoadedIslandElements {
  coreIsland: THREE.Group | null;
  beachTerrain: THREE.Mesh | null;
  surroundingWater: THREE.Mesh | THREE.Group | null;
  debris: THREE.Group | null;
  palmTrees: THREE.Group | null;
  dock: THREE.Group | null;
  edgeDocks: THREE.Group | null;
  signpost: THREE.Group | null;
  realisticTrees: THREE.Group[];
  waterfallDiorama: THREE.Group | null;
  loopingWaterfalls: THREE.Group[];
  epicTemple: THREE.Group | null;
  pirateShop: THREE.Group | null;
  waypoint: THREE.Group | null;
  spawnMarker: THREE.Group | null;
  terrainMeshes: THREE.Mesh[];
  spawnPosition: THREE.Vector3;
  islandBounds: THREE.Box3;
}

export function getDefaultSpawnPosition(): THREE.Vector3 {
  return new THREE.Vector3(5, 8, -5);
}

export function findIslandTopSpawnPoint(terrainMeshes: THREE.Mesh[], preferredX = 5, preferredZ = -5): THREE.Vector3 {
  const raycaster = new THREE.Raycaster();
  
  // Try multiple spawn point candidates to find a good beach location
  const spawnCandidates = [
    { x: preferredX, z: preferredZ },
    { x: 8, z: -8 },   // Beach area
    { x: 10, z: 0 },   // East beach
    { x: 0, z: 10 },   // South beach
    { x: -5, z: 5 },   // Southwest
  ];
  
  for (const candidate of spawnCandidates) {
    raycaster.set(new THREE.Vector3(candidate.x, 100, candidate.z), new THREE.Vector3(0, -1, 0));
    const intersects = raycaster.intersectObjects(terrainMeshes, true);
    
    if (intersects.length > 0) {
      const hitPoint = intersects[0].point.clone();
      // Check if this is a valid spawn (above water level and not too high)
      if (hitPoint.y > 0.5 && hitPoint.y < 20) {
        hitPoint.y += 0.5; // Higher offset to ensure above terrain
        console.log(`[WaterfallIsle] Found spawn point at (${candidate.x}, ${hitPoint.y.toFixed(2)}, ${candidate.z})`);
        return hitPoint;
      }
    }
  }
  
  // Fallback to a safe elevated position
  console.log('[WaterfallIsle] Using fallback spawn position');
  return new THREE.Vector3(preferredX, 8, preferredZ);
}

export class WaterfallIsleLoader {
  private scene: THREE.Scene;
  private gltfLoader: GLTFLoader;
  private config: WaterfallIsleConfig;
  private elements: LoadedIslandElements;
  
  constructor(scene: THREE.Scene, config: Partial<WaterfallIsleConfig> = {}) {
    this.scene = scene;
    this.gltfLoader = new GLTFLoader();
    this.config = { ...DEFAULT_WATERFALL_ISLE_CONFIG, ...config };
    
    this.elements = {
      coreIsland: null,
      beachTerrain: null,
      surroundingWater: null,
      debris: null,
      palmTrees: null,
      dock: null,
      edgeDocks: null,
      signpost: null,
      realisticTrees: [],
      waterfallDiorama: null,
      loopingWaterfalls: [],
      epicTemple: null,
      pirateShop: null,
      waypoint: null,
      spawnMarker: null,
      terrainMeshes: [],
      spawnPosition: getDefaultSpawnPosition(),
      islandBounds: new THREE.Box3(),
    };
  }
  
  async loadAll(): Promise<LoadedIslandElements> {
    const loadPromises: Promise<void>[] = [];
    
    if (this.config.coreIsland.enabled) {
      loadPromises.push(this.loadCoreIsland());
    }
    
    if (this.config.surroundingWater.enabled) {
      this.createSurroundingWater();
    }
    
    await Promise.all(loadPromises);
    
    this.elements.spawnPosition = findIslandTopSpawnPoint(
      this.elements.terrainMeshes, 
      5, 
      -5
    );
    
    if (this.config.waypoint.enabled) {
      this.createWaypoint();
    }
    
    if (this.config.spawnMarker.enabled) {
      this.createSpawnMarker();
    }
    
    // Create docks on island edges
    if (this.config.dock.enabled) {
      this.elements.edgeDocks = this.createEdgeDocks();
    }
    
    // Create floating waterfall island diorama (visible both in world and on island)
    if (this.config.waterfallDiorama.enabled) {
      this.createFloatingWaterfallIsland();
    }
    
    return this.elements;
  }
  
  private async loadCoreIsland(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        '/models/scenes/starter_pirates_island/scene.gltf',
        (gltf) => {
          const island = gltf.scene;
          
          const bounds = new THREE.Box3().setFromObject(island);
          const minY = bounds.min.y;
          
          const scale = this.config.coreIsland.scale ?? 1;
          island.scale.setScalar(scale);
          island.position.set(0, -minY, 0);
          
          const terrainMeshes: THREE.Mesh[] = [];
          const waterMeshesToRemove: THREE.Object3D[] = [];
          
          island.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const name = mesh.name.toLowerCase();
              
              const isWater = name.includes('water') || 
                              name.includes('sea') || 
                              name.includes('ocean') ||
                              name.includes('wave');
              
              let materialIsWater = false;
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                const matName = (mat.name || '').toLowerCase();
                if (matName.includes('water') || matName.includes('sea')) {
                  materialIsWater = true;
                }
                if (mat.transparent && mat.opacity < 0.9 && mat.color) {
                  const hsl = { h: 0, s: 0, l: 0 };
                  mat.color.getHSL(hsl);
                  if (hsl.h > 0.5 && hsl.h < 0.7 && hsl.s > 0.3) {
                    materialIsWater = true;
                  }
                }
              }
              
              if (isWater || materialIsWater) {
                waterMeshesToRemove.push(mesh);
                console.log('[WaterfallIsle] Removing water mesh:', mesh.name);
                return;
              }
              
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.userData.isCollider = true;
              mesh.userData.isTerrain = true;
              terrainMeshes.push(mesh);
            }
          });
          
          waterMeshesToRemove.forEach(mesh => {
            if (mesh.parent) {
              mesh.parent.remove(mesh);
            }
          });
          
          this.elements.coreIsland = island;
          this.elements.terrainMeshes = terrainMeshes;
          this.elements.islandBounds = new THREE.Box3().setFromObject(island);
          
          this.scene.add(island);
          console.log('[WaterfallIsle] Core island loaded with', terrainMeshes.length, 'terrain meshes, removed', waterMeshesToRemove.length, 'water meshes');
          
          // Parse island children to extract toggle-able elements
          this.parseIslandElements(island);
          
          if (this.config.beachTerrain.enabled) {
            this.createBeachTerrain();
          }
          
          resolve();
        },
        undefined,
        (error) => {
          console.error('[WaterfallIsle] Failed to load core island:', error);
          reject(error);
        }
      );
    });
  }
  
  private parseIslandElements(island: THREE.Group): void {
    // Create groups to hold categorized elements
    const dockGroup = new THREE.Group();
    dockGroup.name = 'dock_elements';
    const debrisGroup = new THREE.Group();
    debrisGroup.name = 'debris_elements';
    const palmTreeGroup = new THREE.Group();
    palmTreeGroup.name = 'palm_tree_elements';
    const treeGroup = new THREE.Group();
    treeGroup.name = 'tree_elements';
    const houseGroup = new THREE.Group();
    houseGroup.name = 'house_elements';
    const millGroup = new THREE.Group();
    millGroup.name = 'mill_elements';
    
    const categorized: Record<string, THREE.Object3D[]> = {
      dock: [],
      debris: [],
      palm: [],
      tree: [],
      house: [],
      mill: [],
      blades: [],
    };
    
    // Get island bounds for position-based classification
    const islandBounds = new THREE.Box3().setFromObject(island);
    const waterLevel = islandBounds.min.y + 2; // Near bottom of island
    
    // Traverse and categorize children by name patterns AND geometry/position
    island.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const name = mesh.name.toLowerCase();
      
      // Name-based classification (original approach)
      if (name.includes('dock') || name.includes('pier') || name.includes('jetty') || name.includes('plank')) {
        categorized.dock.push(mesh);
        return;
      }
      if (name.includes('debris') || name.includes('wreck') || name.includes('barrel') || name.includes('crate') || name.includes('box')) {
        categorized.debris.push(mesh);
        return;
      }
      if (name.includes('palm')) {
        categorized.palm.push(mesh);
        return;
      }
      if (name.includes('tree') && !name.includes('palm')) {
        categorized.tree.push(mesh);
        return;
      }
      
      // Model-specific name patterns for this pirate island GLTF
      if (name.includes('house')) {
        categorized.house.push(mesh);
        return;
      }
      if (name.includes('mill') && !name.includes('blade')) {
        categorized.mill.push(mesh);
        return;
      }
      if (name.includes('blade')) {
        categorized.blades.push(mesh);
        return;
      }
      
      // Geometry-based classification for unlabeled meshes
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      
      // Get mesh bounds for aspect ratio analysis
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const meshBounds = mesh.geometry.boundingBox;
      if (meshBounds) {
        const height = meshBounds.max.y - meshBounds.min.y;
        const width = Math.max(
          meshBounds.max.x - meshBounds.min.x,
          meshBounds.max.z - meshBounds.min.z
        );
        const aspectRatio = height / Math.max(width, 0.01);
        
        // Dock detection: flat objects near water level
        if (worldPos.y < waterLevel + 3 && aspectRatio < 0.5 && name.includes('cube')) {
          // Check if it's horizontal and near water
          const size = height * width;
          if (size > 0.1 && size < 50) {
            categorized.dock.push(mesh);
            return;
          }
        }
        
        // Debris detection: small scattered objects
        if (name.includes('cube') && height < 2 && width < 2) {
          const volume = height * width * (meshBounds.max.z - meshBounds.min.z);
          if (volume < 5) {
            categorized.debris.push(mesh);
            return;
          }
        }
      }
    });
    
    // Log what we found with improved classification
    console.log('[WaterfallIsle] Parsed island elements:',
      'docks:', categorized.dock.length,
      'debris:', categorized.debris.length,
      'palms:', categorized.palm.length,
      'trees:', categorized.tree.length,
      'houses:', categorized.house.length,
      'mills:', categorized.mill.length,
      'blades:', categorized.blades.length
    );
    
    // Store references - use house+mill as "buildings" that can be toggled
    this.elements.dock = dockGroup;
    this.elements.debris = debrisGroup;
    this.elements.palmTrees = palmTreeGroup;
    
    // Store the found objects in userData for visibility toggling
    dockGroup.userData.linkedObjects = categorized.dock;
    debrisGroup.userData.linkedObjects = [...categorized.debris, ...categorized.blades]; // Include mill blades with debris
    palmTreeGroup.userData.linkedObjects = categorized.palm;
    treeGroup.userData.linkedObjects = categorized.tree;
    houseGroup.userData.linkedObjects = categorized.house;
    millGroup.userData.linkedObjects = categorized.mill;
    
    // Store houses and mill for potential future building toggle
    island.userData.houses = categorized.house;
    island.userData.mills = categorized.mill;
    
    // Add helper groups to scene (invisible, for organization)
    island.add(dockGroup);
    island.add(debrisGroup);
    island.add(palmTreeGroup);
    island.add(treeGroup);
    island.add(houseGroup);
    island.add(millGroup);
  }
  
  private createBeachTerrain(): void {
    // DISABLED: Beach terrain was causing z-fighting with the core island GLTF
    // The core island already has proper terrain from the GLTF model
    // Keeping this method for potential future use with islands that need procedural beach
    console.log('[WaterfallIsle] Beach terrain skipped - using GLTF terrain only');
  }
  
  private createSurroundingWater(): void {
    const waterGroup = new THREE.Group();
    waterGroup.name  = 'surrounding_water';

    // ── Toon-shaded animated ocean ────────────────────────────────────────────
    const ocean = createToonOceanPlane(600, 80, {
      islandRadius: 18.0,
      foamWidth:    9.0,
      waveAmp:      0.18,
      waveSpeed:    0.95,
      toonBands:    3,
      colorDeep:    0x063650,
      colorMid:     0x0d6090,
      colorShallow: 0x2299c0,
      colorFoam:    0xdaf0f8,
      colorCrest:   0xffffff,
    });
    ocean.position.set(0, 0.05, 0);
    ocean.userData.isWater    = true;
    ocean.userData.isAnimated = true;
    waterGroup.add(ocean);

    this.elements.surroundingWater = waterGroup;
    this.scene.add(waterGroup);

    console.log('[WaterfallIsle] Toon water created');
  }

  /** Call once per frame to drive the water animation.  */
  public updateWater(elapsed: number): void {
    const wg = this.elements.surroundingWater;
    if (!wg) return;
    wg.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.isAnimated) {
        const mat = mesh.material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = elapsed;
      }
    });
  }
  
  private createWaypoint(): void {
    const waypoint = new THREE.Group();
    waypoint.name = 'waypoint';
    
    const ringGeo = new THREE.RingGeometry(1.5, 2, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      emissive: 0x2244aa,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    waypoint.add(ring);
    
    const stoneCount = 6;
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const stoneGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6);
      const stoneMat = new THREE.MeshStandardMaterial({ 
        color: 0x666666, 
        roughness: 0.9 
      });
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(angle) * 1.8, 0.6, Math.sin(angle) * 1.8);
      stone.castShadow = true;
      waypoint.add(stone);
    }
    
    const wpPos = findIslandTopSpawnPoint(this.elements.terrainMeshes, 20, 10);
    waypoint.position.copy(wpPos);
    waypoint.userData = { type: 'waypoint', interactable: true, destination: 'world_map' };
    
    this.elements.waypoint = waypoint;
    this.scene.add(waypoint);
    
    console.log('[WaterfallIsle] Waypoint created at', wpPos.toArray());
  }
  
  private createSpawnMarker(): void {
    const marker = new THREE.Group();
    marker.name = 'spawn_marker';
    
    const circleGeo = new THREE.CircleGeometry(1, 32);
    const circleMat = new THREE.MeshStandardMaterial({
      color: 0x44ff44,
      emissive: 0x22aa22,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.05;
    marker.add(circle);
    
    marker.position.copy(this.elements.spawnPosition);
    marker.position.y = this.elements.spawnPosition.y - 0.05;
    marker.userData = { type: 'spawn_marker' };
    
    this.elements.spawnMarker = marker;
    this.scene.add(marker);
    
    console.log('[WaterfallIsle] Spawn marker at', this.elements.spawnPosition.toArray());
  }
  
  createEdgeDocks(): THREE.Group {
    const docksGroup = new THREE.Group();
    docksGroup.name = 'edge_docks';
    
    const bounds = this.elements.islandBounds;
    const centerX = (bounds.max.x + bounds.min.x) / 2;
    const centerZ = (bounds.max.z + bounds.min.z) / 2;
    
    // Create docks at 4 cardinal directions on island edges
    const dockPositions = [
      { x: bounds.max.x + 2, z: centerZ, rotation: Math.PI / 2, name: 'east_dock' },
      { x: bounds.min.x - 2, z: centerZ, rotation: -Math.PI / 2, name: 'west_dock' },
      { x: centerX, z: bounds.max.z + 2, rotation: 0, name: 'south_dock' },
      { x: centerX, z: bounds.min.z - 2, rotation: Math.PI, name: 'north_dock' },
    ];
    
    dockPositions.forEach((dockPos) => {
      const dock = this.createSingleDock();
      dock.position.set(dockPos.x, 0.5, dockPos.z);
      dock.rotation.y = dockPos.rotation;
      dock.name = dockPos.name;
      docksGroup.add(dock);
    });
    
    this.scene.add(docksGroup);
    console.log('[WaterfallIsle] Created 4 edge docks');
    
    return docksGroup;
  }
  
  private createSingleDock(): THREE.Group {
    const dock = new THREE.Group();
    
    // Dock wood texture - weathered planks
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
      metalness: 0.0,
    });
    
    // Main platform
    const platformGeo = new THREE.BoxGeometry(8, 0.3, 3);
    const platform = new THREE.Mesh(platformGeo, woodMaterial);
    platform.position.set(0, 0.15, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    dock.add(platform);
    
    // Support posts
    const postGeo = new THREE.CylinderGeometry(0.15, 0.2, 3, 8);
    const postPositions = [
      { x: -3.5, z: -1.2 },
      { x: -3.5, z: 1.2 },
      { x: 0, z: -1.2 },
      { x: 0, z: 1.2 },
      { x: 3.5, z: -1.2 },
      { x: 3.5, z: 1.2 },
    ];
    
    postPositions.forEach((pos) => {
      const post = new THREE.Mesh(postGeo, woodMaterial);
      post.position.set(pos.x, -1.2, pos.z);
      post.castShadow = true;
      dock.add(post);
    });
    
    // Mooring posts at end
    const mooringGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8);
    const mooringMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.85,
    });
    
    const mooring1 = new THREE.Mesh(mooringGeo, mooringMat);
    mooring1.position.set(4, 0.9, -1);
    mooring1.castShadow = true;
    dock.add(mooring1);
    
    const mooring2 = new THREE.Mesh(mooringGeo, mooringMat);
    mooring2.position.set(4, 0.9, 1);
    mooring2.castShadow = true;
    dock.add(mooring2);
    
    // Rope coil decoration
    const ropeGeo = new THREE.TorusGeometry(0.3, 0.08, 8, 16);
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.95,
    });
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(2, 0.35, 0);
    rope.rotation.x = -Math.PI / 2;
    dock.add(rope);
    
    dock.userData = { type: 'dock', interactable: true };
    
    return dock;
  }
  
  createFloatingWaterfallIsland(): THREE.Group {
    const diorama = new THREE.Group();
    diorama.name = 'floating_waterfall_island';
    
    // Position floating island above and to the side of main island
    const bounds = this.elements.islandBounds;
    const floatX = (bounds.max.x + bounds.min.x) / 2 + 30;
    const floatY = 40;
    const floatZ = (bounds.max.z + bounds.min.z) / 2 - 20;
    
    // Floating island base - irregular rocky shape
    const islandGeo = new THREE.DodecahedronGeometry(12, 1);
    const positions = islandGeo.attributes.position;
    
    // Flatten top and create cliff edges
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y > 0) {
        // Flatten top
        positions.setY(i, Math.min(y, 4));
      } else {
        // Extend bottom for cliff look
        positions.setY(i, y * 1.5);
      }
    }
    islandGeo.computeVertexNormals();
    
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b5b4f,
      roughness: 0.95,
      metalness: 0.0,
    });
    
    const islandMesh = new THREE.Mesh(islandGeo, rockMaterial);
    islandMesh.castShadow = true;
    islandMesh.receiveShadow = true;
    diorama.add(islandMesh);
    
    // Green top layer (grass/moss)
    const grassGeo = new THREE.CylinderGeometry(10, 11, 2, 16);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c3f,
      roughness: 0.9,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = 3;
    grass.castShadow = true;
    grass.receiveShadow = true;
    diorama.add(grass);
    
    // Pool at top where waterfall starts
    const poolGeo = new THREE.CylinderGeometry(4, 4.5, 1, 16);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x2a8fc9,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(-3, 4.2, 0);
    diorama.add(pool);
    
    // Waterfall stream - animated ribbon of water
    const waterfallGeo = new THREE.PlaneGeometry(3, 50, 4, 20);
    const waterfallMat = new THREE.MeshStandardMaterial({
      color: 0x6bc5e8,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    
    // Curve the waterfall geometry
    const wfPositions = waterfallGeo.attributes.position;
    for (let i = 0; i < wfPositions.count; i++) {
      const y = wfPositions.getY(i);
      const normalizedY = (y + 25) / 50; // 0 at bottom, 1 at top
      const curve = Math.sin(normalizedY * Math.PI) * 2;
      wfPositions.setZ(i, curve);
    }
    waterfallGeo.computeVertexNormals();
    
    const waterfall = new THREE.Mesh(waterfallGeo, waterfallMat);
    waterfall.position.set(-8, -20, 0);
    waterfall.rotation.y = 0.2;
    diorama.add(waterfall);
    
    // Mist at waterfall base
    const mistGeo = new THREE.SphereGeometry(5, 16, 16);
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      roughness: 1,
    });
    const mist = new THREE.Mesh(mistGeo, mistMat);
    mist.position.set(-8, -43, 0);
    mist.scale.set(2, 0.5, 2);
    diorama.add(mist);
    
    // Add some trees on the floating island
    for (let i = 0; i < 5; i++) {
      const tree = this.createSimpleTree();
      const angle = (i / 5) * Math.PI * 2;
      const radius = 5 + Math.random() * 3;
      tree.position.set(
        Math.cos(angle) * radius,
        4.5,
        Math.sin(angle) * radius
      );
      tree.scale.setScalar(0.8 + Math.random() * 0.4);
      diorama.add(tree);
    }
    
    // Position the entire diorama
    diorama.position.set(floatX, floatY, floatZ);
    diorama.userData = { type: 'floating_island', animated: true };
    
    this.elements.waterfallDiorama = diorama;
    this.scene.add(diorama);
    
    console.log('[WaterfallIsle] Created floating waterfall island at', floatX, floatY, floatZ);
    
    return diorama;
  }
  
  private createSimpleTree(): THREE.Group {
    const tree = new THREE.Group();
    
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5a3d2b,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);
    
    // Foliage - layered cones
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.8,
    });
    
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3, 8), foliageMat);
    cone1.position.y = 5;
    cone1.castShadow = true;
    tree.add(cone1);
    
    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(2, 2.5, 8), foliageMat);
    cone2.position.y = 7;
    cone2.castShadow = true;
    tree.add(cone2);
    
    const cone3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 8), foliageMat);
    cone3.position.y = 8.5;
    cone3.castShadow = true;
    tree.add(cone3);
    
    return tree;
  }
  
  // ── PBR Nature Upgrade ──────────────────────────────────────────────────────
  // Call after loadAll() to apply upgraded PBR materials and wind shaders
  // to the island meshes.  Pass a THREE.Clock for live wind animation.

  private _windMaterials: Array<{ mat: THREE.MeshStandardMaterial; uniforms: Record<string, any> }> = [];
  private _waterAnimMat: THREE.MeshStandardMaterial | null = null;

  applyNatureUpgrade(): void {
    if (!this.elements.coreIsland) return;

    // Grass material — used for terrain ground meshes
    const grassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x4e8c42),
      roughness: 0.92,
      metalness: 0.0,
    });

    // Sand/beach material
    const sandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd4b87a),
      roughness: 0.85,
      metalness: 0.0,
    });

    // Rock material
    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x7a7060),
      roughness: 0.90,
      metalness: 0.02,
    });

    // Dirt path material
    const dirtMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8b6340),
      roughness: 0.88,
      metalness: 0.0,
    });

    // Wind-sway foliage material factory
    const makeWindMat = (baseColor: number, roughness = 0.85) => {
      const uniforms = {
        time:        { value: 0 },
        windStrength: { value: 0.09 },
        windFreq:     { value: 1.3 },
      };
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.time         = uniforms.time;
        shader.uniforms.windStrength = uniforms.windStrength;
        shader.uniforms.windFreq     = uniforms.windFreq;
        shader.vertexShader = `
          uniform float time;
          uniform float windStrength;
          uniform float windFreq;
        ` + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 wPos = (modelMatrix * vec4(position, 1.0)).xyz;
          float heightFactor = max(0.0, transformed.y * 0.35);
          float sway  = sin(wPos.x * 0.45 + time * windFreq) * windStrength * heightFactor;
          sway       += sin(wPos.z * 0.38 + time * windFreq * 0.73) * windStrength * 0.55 * heightFactor;
          transformed.x += sway;
          transformed.z += sway * 0.28;
          `
        );
      };
      this._windMaterials.push({ mat, uniforms });
      return mat;
    };

    // Apply materials by mesh name heuristics
    this.elements.coreIsland.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const name = mesh.name.toLowerCase();

      // Foliage (leaf, crown, palm frond)
      if (name.includes('leaf') || name.includes('crown') || name.includes('frond') ||
          name.includes('foliage') || name.includes('leaves') || name.includes('canopy')) {
        const hue = name.includes('palm') ? 0x5aaa38 : 0x3d7a2a;
        mesh.material = makeWindMat(hue, 0.82);
        mesh.castShadow = true;
        return;
      }
      // Tree trunk / bark
      if (name.includes('trunk') || name.includes('bark') || name.includes('log')) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x5c3d1e),
          roughness: 0.94,
          metalness: 0.0,
        });
        mesh.castShadow = true;
        return;
      }
      // Grass / terrain ground
      if (name.includes('grass') || name.includes('ground') || name.includes('terrain') ||
          name.includes('land') || name.includes('surface')) {
        mesh.material = grassMat.clone();
        return;
      }
      // Sand / beach
      if (name.includes('sand') || name.includes('beach') || name.includes('shore')) {
        mesh.material = sandMat.clone();
        return;
      }
      // Rock / cliff
      if (name.includes('rock') || name.includes('cliff') || name.includes('stone') ||
          name.includes('boulder')) {
        mesh.material = rockMat.clone();
        return;
      }
      // Path / dirt
      if (name.includes('path') || name.includes('dirt') || name.includes('soil')) {
        mesh.material = dirtMat.clone();
        return;
      }
      // Fallback: use original material but boost PBR quality
      if (mesh.material && !Array.isArray(mesh.material)) {
        const origMat = mesh.material as THREE.MeshStandardMaterial;
        if (origMat.isMeshStandardMaterial) {
          origMat.roughness = Math.max(origMat.roughness, 0.75);
          origMat.metalness = Math.min(origMat.metalness, 0.15);
          origMat.needsUpdate = true;
        }
      }
    });

    // Upgrade the surrounding ocean water to an animated deep-sea shader
    if (this.elements.surroundingWater) {
      const waterMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x0c4d72),
        roughness: 0.12,
        metalness: 0.28,
        transparent: true,
        opacity: 0.88,
      });
      const waterUniforms = { time: { value: 0 } };
      waterMat.onBeforeCompile = (shader) => {
        shader.uniforms.time = waterUniforms.time;
        shader.vertexShader = `uniform float time;\n` + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 wPos = (modelMatrix * vec4(position, 1.0)).xyz;
          float dist = length(wPos.xz);
          if (dist > 28.0) {
            float wave = sin(wPos.x * 0.18 + time * 0.9) * 0.22
                       + sin(wPos.z * 0.15 + time * 0.75) * 0.18
                       + sin((wPos.x + wPos.z) * 0.09 + time * 1.1) * 0.12;
            transformed.y += wave;
          }
          `
        );
      };
      this._windMaterials.push({ mat: waterMat, uniforms: waterUniforms });
      this._waterAnimMat = waterMat;

      this.elements.surroundingWater.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.userData.isWater) {
          mesh.material = waterMat;
        }
      });
    }

    console.log('[WaterfallIsle] PBR nature upgrade applied,', this._windMaterials.length, 'wind materials');
  }

  // Call every frame with current elapsed time to animate wind + water
  updateNatureAnimations(time: number): void {
    for (const entry of this._windMaterials) {
      if (entry.uniforms.time) entry.uniforms.time.value = time;
    }
    // Drive animated surrounding water shader
    this.updateWater(time);
  }

  getSpawnPosition(): THREE.Vector3 {
    return this.elements.spawnPosition.clone();
  }
  
  getTerrainMeshes(): THREE.Mesh[] {
    return this.elements.terrainMeshes;
  }
  
  getElements(): LoadedIslandElements {
    return this.elements;
  }
  
  toggleElement(elementName: keyof WaterfallIsleConfig, visible: boolean): void {
    const elementMap: Record<string, THREE.Object3D | THREE.Object3D[] | null> = {
      coreIsland: this.elements.coreIsland,
      beachTerrain: this.elements.beachTerrain,
      surroundingWater: this.elements.surroundingWater,
      debris: this.elements.debris,
      palmTrees: this.elements.palmTrees,
      dock: this.elements.dock,
      edgeDocks: this.elements.edgeDocks,
      signpost: this.elements.signpost,
      realisticTrees: this.elements.realisticTrees,
      waterfallDiorama: this.elements.waterfallDiorama,
      loopingWaterfalls: this.elements.loopingWaterfalls,
      epicTemple: this.elements.epicTemple,
      pirateShop: this.elements.pirateShop,
      waypoint: this.elements.waypoint,
      spawnMarker: this.elements.spawnMarker,
    };
    
    const element = elementMap[elementName];
    if (element) {
      if (Array.isArray(element)) {
        element.forEach(obj => obj.visible = visible);
      } else {
        element.visible = visible;
        
        // Also toggle linked objects if this is a category group
        const linkedObjects = (element as THREE.Group).userData?.linkedObjects as THREE.Object3D[] | undefined;
        if (linkedObjects && linkedObjects.length > 0) {
          linkedObjects.forEach(obj => {
            obj.visible = visible;
          });
          console.log(`[WaterfallIsle] Toggled ${elementName}:`, visible, 'affecting', linkedObjects.length, 'objects');
        }
      }
    }
    
    // When toggling dock, also toggle edge docks
    if (elementName === 'dock' && this.elements.edgeDocks) {
      this.elements.edgeDocks.visible = visible;
      console.log(`[WaterfallIsle] Also toggled edgeDocks:`, visible);
    }
  }
  
  dispose(): void {
    const disposeObject = (obj: THREE.Object3D | null) => {
      if (!obj) return;
      this.scene.remove(obj);
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    };
    
    disposeObject(this.elements.coreIsland);
    disposeObject(this.elements.beachTerrain);
    disposeObject(this.elements.surroundingWater);
    disposeObject(this.elements.debris);
    disposeObject(this.elements.palmTrees);
    disposeObject(this.elements.dock);
    disposeObject(this.elements.edgeDocks);
    disposeObject(this.elements.signpost);
    disposeObject(this.elements.waterfallDiorama);
    disposeObject(this.elements.epicTemple);
    disposeObject(this.elements.pirateShop);
    disposeObject(this.elements.waypoint);
    disposeObject(this.elements.spawnMarker);
    
    this.elements.realisticTrees.forEach(tree => disposeObject(tree));
    this.elements.loopingWaterfalls.forEach(wf => disposeObject(wf));
    
    this.elements = {
      coreIsland: null,
      beachTerrain: null,
      surroundingWater: null,
      debris: null,
      palmTrees: null,
      dock: null,
      edgeDocks: null,
      signpost: null,
      realisticTrees: [],
      waterfallDiorama: null,
      loopingWaterfalls: [],
      epicTemple: null,
      pirateShop: null,
      waypoint: null,
      spawnMarker: null,
      terrainMeshes: [],
      spawnPosition: getDefaultSpawnPosition(),
      islandBounds: new THREE.Box3(),
    };
  }
}

export function getTerrainHeightAtPoint(
  x: number, 
  z: number, 
  terrainMeshes: THREE.Mesh[]
): number {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
  
  const intersects = raycaster.intersectObjects(terrainMeshes, true);
  
  if (intersects.length > 0) {
    return intersects[0].point.y;
  }
  
  return 0;
}
