import * as THREE from 'three';
import { landscapeAssets, ENVIRONMENT_TEXTURE_PATHS } from './landscapeAssets';
import { populateIsland, getGenerationManifest } from './generationLibrary';
import { enhanceWithGrassShader } from './grassTerrainMaterial';

let _manifestLogged = false;
function logManifestOnce() {
  if (_manifestLogged) return;
  _manifestLogged = true;
  try {
    const m = getGenerationManifest();
    console.log('[GenerationLibrary] Biome inventory:', m);
  } catch (e) { /* ignore */ }
}

export interface IslandConfig {
  seed: number;
  radius: number;
  biome: string;
  position: THREE.Vector3;
}

export interface GeneratedIsland {
  terrainMesh: THREE.Mesh;
  propMeshes: THREE.Group;
  collisionRadius: number;
  underwaterBase: THREE.Mesh;
  collisionMesh: THREE.Mesh;
}

const BIOME_COLORS: Record<string, { grass: number; sand: number; rock: number; accent: number }> = {
  tropical: { grass: 0x4a7c23, sand: 0xe8d4a8, rock: 0x8b7355, accent: 0x2d5016 },
  volcanic: { grass: 0x3d3d3d, sand: 0x2a2a2a, rock: 0x1a1a1a, accent: 0xff4500 },
  arctic: { grass: 0xf0f8ff, sand: 0xe6f3ff, rock: 0xd4e5f7, accent: 0x87ceeb },
  desert: { grass: 0xdeb887, sand: 0xf4d03f, rock: 0xcd853f, accent: 0xffa500 },
  haunted: { grass: 0x4a4a6a, sand: 0x3d3d5c, rock: 0x2d2d4d, accent: 0x800080 },
  forest: { grass: 0x3d6b21, sand: 0xc4a86a, rock: 0x6b5b4d, accent: 0x1d4a0d },
  beach: { grass: 0x6b8e23, sand: 0xf5deb3, rock: 0x8b7355, accent: 0x32cd32 }
};

class SimplexNoise {
  private perm: number[];
  private grad3: number[][];

  constructor(seed: number) {
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = Math.floor(this.seededRandom(seed + i) * 256);
    }
    
    this.perm = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    
    let n0 = 0, n1 = 0, n2 = 0;
    
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    
    let i1 = 0, j1 = 0;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }
    
    return 70 * (n0 + n1 + n2);
  }
}

export class IslandGenerator {
  private assetsPreloaded: boolean = false;
  private preloadPromise: Promise<void> | null = null;

  constructor() {
    this.preloadPromise = this.preloadAssets();
  }

  async ensureAssetsLoaded(): Promise<void> {
    if (this.preloadPromise) {
      await this.preloadPromise;
    }
  }

  isReady(): boolean {
    return this.assetsPreloaded;
  }

  private async preloadAssets(): Promise<void> {
    try {
      await landscapeAssets.preloadAllAssets();
      this.assetsPreloaded = true;
      console.log('[IslandGenerator] Stylized landscape assets preloaded');
    } catch (e) {
      console.warn('[IslandGenerator] Failed to preload landscape assets:', e);
    }
  }

  generateIsland(config: IslandConfig): GeneratedIsland {
    const noise = new SimplexNoise(config.seed);
    const colors = BIOME_COLORS[config.biome] || BIOME_COLORS.tropical;
    
    const segments = Math.max(16, Math.floor(config.radius / 2));
    const geometry = new THREE.BufferGeometry();
    
    const vertices: number[] = [];
    const colors_arr: number[] = [];
    const indices: number[] = [];
    
    const colorGrass = new THREE.Color(colors.grass);
    const colorSand = new THREE.Color(colors.sand);
    const colorRock = new THREE.Color(colors.rock);
    
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const u = i / segments;
        const v = j / segments;
        
        const x = (u - 0.5) * config.radius * 2;
        const z = (v - 0.5) * config.radius * 2;
        
        const distFromCenter = Math.sqrt(x * x + z * z);
        const normalizedDist = distFromCenter / config.radius;
        
        let height = 0;
        if (normalizedDist < 1) {
          const edgeFalloff = Math.pow(1 - normalizedDist, 2);
          
          const noiseScale = 0.05;
          const noiseVal = noise.noise2D(x * noiseScale, z * noiseScale);
          const detailNoise = noise.noise2D(x * 0.1, z * 0.1) * 0.3;
          
          height = (noiseVal + detailNoise + 1) * 0.5 * config.radius * 0.3 * edgeFalloff;
          
          if (normalizedDist > 0.7) {
            height *= Math.pow((1 - normalizedDist) / 0.3, 0.5);
          }
        } else {
          // Vertices outside the island circle: drop them well below sea level
          // so the ocean plane hides them. Without this they sit at y=0 and
          // form a flat square "beach" footprint around every island.
          height = -12 - (normalizedDist - 1) * config.radius * 0.4;
        }
        
        vertices.push(x, height, z);
        
        let vertexColor: THREE.Color;
        if (normalizedDist >= 1) {
          // Underwater skirt — color matches the sunken rock so any peek-through
          // reads as submerged shelf rather than mystery beach.
          vertexColor = colorRock;
        } else if (normalizedDist > 0.88) {
          vertexColor = colorSand;
        } else if (height > config.radius * 0.15) {
          vertexColor = colorRock;
        } else {
          vertexColor = colorGrass;
        }
        
        colors_arr.push(vertexColor.r, vertexColor.g, vertexColor.b);
      }
    }
    
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors_arr, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });
    // Voronoi grass-blade-tip overlay: breaks up the flat biome green tint
    // with cell-based root→tip shading + soil patches + wind shimmer in the
    // grass areas only. Sand / rock / snow vertex colours pass through.
    enhanceWithGrassShader(material);
    
    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.position.copy(config.position);
    terrainMesh.receiveShadow = true;
    
    const propMeshes = this.generateProps(config, noise, vertices, segments);
    propMeshes.position.copy(config.position);

    // Stylized biome features (gems, ice clusters, ice spires, frozen logs,
    // fire vents, fire tornadoes). Async/best-effort — landmarks pop in once
    // their lazy packs arrive. Sample y from the vertex grid we just built.
    const segCount = segments + 1;
    const sampleHeight = (worldX: number, worldZ: number): number => {
      const localX = worldX - config.position.x;
      const localZ = worldZ - config.position.z;
      const u = (localX / (config.radius * 2)) + 0.5;
      const v = (localZ / (config.radius * 2)) + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
      const i = Math.floor(u * segments);
      const j = Math.floor(v * segments);
      const idx = (i * segCount + j) * 3 + 1; // y component
      return vertices[idx] ?? 0;
    };
    logManifestOnce();
    populateIsland({
      group: propMeshes,
      centerX: 0,           // propMeshes is already positioned at config.position
      centerZ: 0,
      radius: config.radius,
      biome: config.biome,
      getHeightAt: (x, z) => sampleHeight(x + config.position.x, z + config.position.z),
    });
    
    // Create underwater base to prevent clipping through island
    const underwaterDepth = 30;
    const baseColors = BIOME_COLORS[config.biome] || BIOME_COLORS.tropical;
    const underwaterGeometry = new THREE.CylinderGeometry(
      config.radius * 1.1,  // Top radius
      config.radius * 0.7,  // Bottom radius (tapers down)
      underwaterDepth,
      16,
      4,
      false
    );
    const underwaterMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(baseColors.rock).multiplyScalar(0.6),
      side: THREE.DoubleSide
    });
    const underwaterBase = new THREE.Mesh(underwaterGeometry, underwaterMaterial);
    underwaterBase.position.copy(config.position);
    underwaterBase.position.y = -underwaterDepth / 2;
    underwaterBase.receiveShadow = true;
    
    // Create invisible collision mesh (cylinder around island for solid collision)
    const collisionGeometry = new THREE.CylinderGeometry(
      config.radius,
      config.radius,
      underwaterDepth + 10,
      16,
      1,
      false
    );
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      transparent: true,
      opacity: 0
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.copy(config.position);
    collisionMesh.position.y = -underwaterDepth / 2 + 5;
    collisionMesh.userData.isCollision = true;
    collisionMesh.userData.islandId = 'island-collision';
    
    return {
      terrainMesh,
      propMeshes,
      collisionRadius: config.radius,
      underwaterBase,
      collisionMesh
    };
  }

  private generateProps(
    config: IslandConfig, 
    noise: SimplexNoise, 
    vertices: number[], 
    segments: number
  ): THREE.Group {
    const group = new THREE.Group();
    const propCount = Math.floor(config.radius * 0.6);
    const colors = BIOME_COLORS[config.biome] || BIOME_COLORS.tropical;
    
    for (let i = 0; i < propCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * config.radius * 0.7;
      
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      
      const gridX = Math.floor((x / (config.radius * 2) + 0.5) * segments);
      const gridZ = Math.floor((z / (config.radius * 2) + 0.5) * segments);
      
      const idx = (gridX * (segments + 1) + gridZ) * 3;
      const y = vertices[idx + 1] || 0;
      
      if (y < 0.5) continue;
      
      const propType = Math.random();
      const position = new THREE.Vector3(x, y, z);
      const rotation = Math.random() * Math.PI * 2;
      
      if (this.assetsPreloaded) {
        this.addRealisticPropSync(group, config.biome, propType, position, rotation);
      } else {
        this.addFallbackProp(group, config, propType, position, rotation, colors);
      }
    }
    
    return group;
  }
  
  private addRealisticPropSync(
    group: THREE.Group,
    biome: string,
    propType: number,
    position: THREE.Vector3,
    rotation: number
  ): void {
    let propMesh: THREE.Group | null = null;
    let scale = 1;
    
    if (biome === 'tropical' || biome === 'beach') {
      if (propType < 0.25) {
        propMesh = landscapeAssets.getTreeModelSync('palm');
        scale = 2 + Math.random() * 1.5;
      } else if (propType < 0.45) {
        propMesh = landscapeAssets.getTreeModelSync('birch');
        scale = 1.5 + Math.random();
      } else if (propType < 0.6) {
        const vegType = landscapeAssets.getRandomVegetationTypeForBiome(biome);
        propMesh = landscapeAssets.getVegetationModelSync(vegType);
        scale = 1 + Math.random() * 0.5;
      } else if (propType < 0.75) {
        propMesh = landscapeAssets.getVegetationModelSync('bushLargeFlowers');
        scale = 1.2 + Math.random() * 0.8;
      } else if (propType < 0.9) {
        propMesh = landscapeAssets.getVegetationModelSync('grassLarge');
        scale = 0.8 + Math.random() * 0.4;
      } else {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.8 + Math.random() * 1.2;
      }
    } else if (biome === 'forest') {
      if (propType < 0.35) {
        propMesh = landscapeAssets.getTreeModelSync('normal');
        scale = 2 + Math.random() * 1.5;
      } else if (propType < 0.55) {
        propMesh = landscapeAssets.getTreeModelSync('pine');
        scale = 2.5 + Math.random() * 2;
      } else if (propType < 0.7) {
        propMesh = landscapeAssets.getTreeModelSync('birch');
        scale = 1.8 + Math.random();
      } else if (propType < 0.85) {
        propMesh = landscapeAssets.getVegetationModelSync('bushLarge');
        scale = 1 + Math.random() * 0.5;
      } else {
        propMesh = landscapeAssets.getVegetationModelSync('flower2Clump');
        scale = 0.8 + Math.random() * 0.3;
      }
    } else if (biome === 'volcanic' || biome === 'haunted') {
      if (propType < 0.5) {
        propMesh = landscapeAssets.getTreeModelSync('dead');
        scale = 1.5 + Math.random() * 2;
      } else if (propType < 0.8) {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 1 + Math.random() * 2;
      } else {
        propMesh = landscapeAssets.getVegetationModelSync('grassSmall');
        scale = 0.5 + Math.random() * 0.3;
      }
    } else if (biome === 'arctic') {
      if (propType < 0.4) {
        propMesh = landscapeAssets.getTreeModelSync('pine');
        scale = 2 + Math.random() * 1.5;
      } else if (propType < 0.7) {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.5 + Math.random();
      } else {
        propMesh = landscapeAssets.getVegetationModelSync('bushSmall');
        scale = 0.6 + Math.random() * 0.3;
      }
    } else if (biome === 'desert') {
      if (propType < 0.35) {
        propMesh = landscapeAssets.getTreeModelSync('palm');
        scale = 2 + Math.random();
      } else if (propType < 0.5) {
        propMesh = landscapeAssets.getTreeModelSync('dead');
        scale = 1 + Math.random();
      } else if (propType < 0.8) {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.5 + Math.random() * 1.5;
      } else {
        propMesh = landscapeAssets.getVegetationModelSync('grassSmall');
        scale = 0.4 + Math.random() * 0.2;
      }
    } else {
      const treeType = landscapeAssets.getRandomTreeTypeForBiome(biome);
      if (propType < 0.4) {
        propMesh = landscapeAssets.getTreeModelSync(treeType);
        scale = 1.5 + Math.random() * 1.5;
      } else if (propType < 0.6) {
        const vegType = landscapeAssets.getRandomVegetationTypeForBiome(biome);
        propMesh = landscapeAssets.getVegetationModelSync(vegType);
        scale = 0.8 + Math.random() * 0.5;
      } else if (propType < 0.85) {
        propMesh = landscapeAssets.getVegetationModelSync('bush');
        scale = 1 + Math.random() * 0.5;
      } else {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.8 + Math.random();
      }
    }
    
    if (propMesh) {
      propMesh.position.copy(position);
      propMesh.rotation.y = rotation;
      propMesh.scale.setScalar(scale);
      propMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      group.add(propMesh);
    }
  }
  
  private addFallbackProp(
    group: THREE.Group,
    config: IslandConfig,
    propType: number,
    position: THREE.Vector3,
    rotation: number,
    colors: { grass: number; sand: number; rock: number; accent: number }
  ): void {
    let propMesh: THREE.Group | null = null;
    let scale = 1;
    
    if (config.biome === 'tropical' || config.biome === 'haunted') {
      if (propType < 0.3) {
        propMesh = landscapeAssets.getTreeModelSync('palm');
        scale = 2 + Math.random() * 1.5;
      } else if (propType < 0.6) {
        propMesh = landscapeAssets.getTreeModelSync('normal');
        scale = 1.5 + Math.random();
      } else if (propType < 0.8) {
        propMesh = landscapeAssets.getVegetationModelSync('bush');
        scale = 1.2 + Math.random() * 0.5;
      } else {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.8 + Math.random() * 0.5;
      }
    } else if (config.biome === 'volcanic') {
      propMesh = landscapeAssets.getRockModelSync();
      scale = 1 + Math.random() * 2;
    } else if (config.biome === 'arctic') {
      if (propType < 0.5) {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.5 + Math.random();
      } else {
        propMesh = landscapeAssets.getTreeModelSync('pine');
        scale = 1.5 + Math.random();
      }
    } else if (config.biome === 'desert') {
      if (propType < 0.3) {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.5 + Math.random() * 1.5;
      } else if (propType < 0.5) {
        propMesh = landscapeAssets.getTreeModelSync('palm');
        scale = 1.5 + Math.random();
      }
    } else if (config.biome === 'forest') {
      if (propType < 0.4) {
        const treeType = landscapeAssets.getRandomTreeTypeForBiome('forest');
        propMesh = landscapeAssets.getTreeModelSync(treeType);
        scale = 1.5 + Math.random();
      } else if (propType < 0.7) {
        propMesh = landscapeAssets.getVegetationModelSync('bushLarge');
        scale = 1 + Math.random() * 0.5;
      } else {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.6 + Math.random() * 0.6;
      }
    } else if (config.biome === 'beach') {
      if (propType < 0.4) {
        propMesh = landscapeAssets.getTreeModelSync('palm');
        scale = 2 + Math.random() * 1.5;
      } else if (propType < 0.6) {
        propMesh = landscapeAssets.getVegetationModelSync('grassSmall');
        scale = 0.8 + Math.random() * 0.4;
      } else {
        propMesh = landscapeAssets.getRockModelSync();
        scale = 0.4 + Math.random() * 0.4;
      }
    }
    
    if (!propMesh) {
      propMesh = landscapeAssets.getRockModelSync();
      scale = 0.5 + Math.random() * 0.5;
    }
    
    propMesh.position.copy(position);
    propMesh.rotation.y = rotation;
    propMesh.scale.setScalar(scale);
    propMesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    group.add(propMesh);
  }
}
