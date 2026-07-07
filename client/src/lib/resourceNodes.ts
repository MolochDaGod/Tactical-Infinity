import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { ResourceNode, ResourceType, HarvestingProfession } from './harvestingProfessions';

export interface ResourceNodeTemplate {
  type: ResourceType;
  profession: HarvestingProfession;
  name: string;
  tier: number;
  health: number;
  respawnTimeSeconds: number;
  yieldMin: number;
  yieldMax: number;
  xpReward: number;
  modelUrl?: string;
  fbxModelUrl?: string;
  fbxTexturePath?: string;
  fallbackColor: number;
  fallbackGeometry: 'tree' | 'rock' | 'ore' | 'plant' | 'animal';
  scale: number;
  spawnZone: 'inner' | 'mid' | 'outer';
  yOffset: number;
}

export interface HarvestNodePlacement {
  templateKey: string;
  position: THREE.Vector3;
  rotation: number;
  zone: 'inner' | 'mid' | 'outer';
}

const GOLDMINE_BASE = '/assets/buildings/goldmine/fbx/full';
const GOLDMINE_TEX  = '/assets/buildings/goldmine/texture/Texture_MAp_mines.png';

export const resourceNodeTemplates: Record<string, ResourceNodeTemplate> = {
  // ── Trees ─────────────────────────────────────────────────────────────────
  oak_tree: {
    type: 'wood', profession: 'woodcutting', name: 'Oak Tree',
    tier: 1, health: 50, respawnTimeSeconds: 120, yieldMin: 3, yieldMax: 6, xpReward: 15,
    modelUrl: '/models/island/palm-detailed-straight.glb',
    fallbackColor: 0x228B22, fallbackGeometry: 'tree', scale: 2.0,
    spawnZone: 'mid', yOffset: 0
  },
  pine_tree: {
    type: 'wood', profession: 'woodcutting', name: 'Pine Tree',
    tier: 2, health: 75, respawnTimeSeconds: 180, yieldMin: 5, yieldMax: 10, xpReward: 25,
    modelUrl: '/models/trees/forest_pack_4/scene.gltf',
    fallbackColor: 0x006400, fallbackGeometry: 'tree', scale: 1.5,
    spawnZone: 'mid', yOffset: 0
  },
  palm_bend: {
    type: 'wood', profession: 'woodcutting', name: 'Bent Palm',
    tier: 1, health: 35, respawnTimeSeconds: 120, yieldMin: 3, yieldMax: 5, xpReward: 15,
    modelUrl: '/models/island/palm-detailed-bend.glb',
    fallbackColor: 0x3a8c30, fallbackGeometry: 'tree', scale: 2.2,
    spawnZone: 'outer', yOffset: 0
  },
  palm_straight: {
    type: 'wood', profession: 'woodcutting', name: 'Palm',
    tier: 1, health: 35, respawnTimeSeconds: 100, yieldMin: 2, yieldMax: 4, xpReward: 12,
    modelUrl: '/models/island/palm-straight.glb',
    fallbackColor: 0x4aac3a, fallbackGeometry: 'tree', scale: 2.2,
    spawnZone: 'outer', yOffset: 0
  },
  tropical_tree: {
    type: 'wood', profession: 'woodcutting', name: 'Tropical Palm',
    tier: 1, health: 35, respawnTimeSeconds: 120, yieldMin: 3, yieldMax: 5, xpReward: 15,
    modelUrl: '/models/tropical_trees/scene.gltf',
    fallbackColor: 0x228B22, fallbackGeometry: 'tree', scale: 0.8,
    spawnZone: 'mid', yOffset: 0
  },
  forest_tree: {
    type: 'wood', profession: 'woodcutting', name: 'Forest Tree',
    tier: 2, health: 60, respawnTimeSeconds: 180, yieldMin: 4, yieldMax: 8, xpReward: 25,
    modelUrl: '/models/trees/forest_pack_5/scene.gltf',
    fallbackColor: 0x2E8B57, fallbackGeometry: 'tree', scale: 1.8,
    spawnZone: 'mid', yOffset: 0
  },

  // ── Rocks & Stone ─────────────────────────────────────────────────────────
  stone_boulder: {
    type: 'stone', profession: 'quarrying', name: 'Stone Boulder',
    tier: 1, health: 60, respawnTimeSeconds: 150, yieldMin: 2, yieldMax: 5, xpReward: 20,
    modelUrl: '/models/island/rocks-a.glb',
    fallbackColor: 0x808080, fallbackGeometry: 'rock', scale: 1.5,
    spawnZone: 'mid', yOffset: -0.2
  },
  granite_rock: {
    type: 'stone', profession: 'quarrying', name: 'Granite Rock',
    tier: 2, health: 100, respawnTimeSeconds: 240, yieldMin: 4, yieldMax: 8, xpReward: 35,
    modelUrl: '/models/island/rocks-b.glb',
    fallbackColor: 0x696969, fallbackGeometry: 'rock', scale: 1.8,
    spawnZone: 'mid', yOffset: -0.2
  },
  sandstone_rock: {
    type: 'stone', profession: 'quarrying', name: 'Sandstone Rock',
    tier: 1, health: 40, respawnTimeSeconds: 130, yieldMin: 2, yieldMax: 4, xpReward: 18,
    modelUrl: '/models/island/rocks-sand-a.glb',
    fallbackColor: 0xc2a06a, fallbackGeometry: 'rock', scale: 1.4,
    spawnZone: 'outer', yOffset: -0.2
  },

  // ── Ore Veins (FBX from goldmine pack) ───────────────────────────────────
  iron_vein: {
    type: 'ore_iron', profession: 'mining', name: 'Iron Ore Vein',
    tier: 1, health: 80, respawnTimeSeconds: 300, yieldMin: 2, yieldMax: 4, xpReward: 30,
    fbxModelUrl: `${GOLDMINE_BASE}/_stone_2.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x8B4513, fallbackGeometry: 'ore', scale: 1.2,
    spawnZone: 'outer', yOffset: -0.3
  },
  copper_vein: {
    type: 'ore_copper', profession: 'mining', name: 'Copper Ore Vein',
    tier: 1, health: 60, respawnTimeSeconds: 240, yieldMin: 2, yieldMax: 5, xpReward: 25,
    fbxModelUrl: `${GOLDMINE_BASE}/_stone_3.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0xB87333, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: -0.3
  },
  gold_vein: {
    type: 'ore_gold', profession: 'mining', name: 'Gold Ore Vein',
    tier: 3, health: 120, respawnTimeSeconds: 600, yieldMin: 1, yieldMax: 3, xpReward: 75,
    fbxModelUrl: `${GOLDMINE_BASE}/_stone_gold.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0xFFD700, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: -0.3
  },
  coal_vein: {
    type: 'ore_iron', profession: 'mining', name: 'Coal Deposit',
    tier: 2, health: 90, respawnTimeSeconds: 400, yieldMin: 3, yieldMax: 6, xpReward: 40,
    fbxModelUrl: `${GOLDMINE_BASE}/_stone_coal.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x2c2c2c, fallbackGeometry: 'ore', scale: 1.1,
    spawnZone: 'outer', yOffset: -0.3
  },
  mythril_vein: {
    type: 'ore_mythril', profession: 'mining', name: 'Mythril Ore Vein',
    tier: 5, health: 200, respawnTimeSeconds: 1200, yieldMin: 1, yieldMax: 2, xpReward: 150,
    fbxModelUrl: `${GOLDMINE_BASE}/_stone_mineral.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x00CED1, fallbackGeometry: 'ore', scale: 0.9,
    spawnZone: 'outer', yOffset: -0.3
  },

  // ── Crystal Clusters (FBX from goldmine pack) ─────────────────────────────
  crystal_blue: {
    type: 'ore_mythril', profession: 'mining', name: 'Blue Crystal Cluster',
    tier: 3, health: 80, respawnTimeSeconds: 600, yieldMin: 1, yieldMax: 3, xpReward: 80,
    fbxModelUrl: `${GOLDMINE_BASE}/_crystal_1.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x4488ff, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: 0
  },
  crystal_purple: {
    type: 'ore_mythril', profession: 'mining', name: 'Amethyst Cluster',
    tier: 4, health: 100, respawnTimeSeconds: 800, yieldMin: 1, yieldMax: 2, xpReward: 100,
    fbxModelUrl: `${GOLDMINE_BASE}/_crystal_2.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x8844cc, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: 0
  },
  crystal_green: {
    type: 'ore_mythril', profession: 'mining', name: 'Emerald Crystal',
    tier: 4, health: 100, respawnTimeSeconds: 800, yieldMin: 1, yieldMax: 2, xpReward: 100,
    fbxModelUrl: `${GOLDMINE_BASE}/_crystal_3.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x44cc88, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: 0
  },
  crystal_red: {
    type: 'ore_mythril', profession: 'mining', name: 'Ruby Crystal',
    tier: 5, health: 150, respawnTimeSeconds: 1000, yieldMin: 1, yieldMax: 2, xpReward: 130,
    fbxModelUrl: `${GOLDMINE_BASE}/_crystal_4.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0xcc2244, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: 0
  },
  crystal_gold: {
    type: 'ore_gold', profession: 'mining', name: 'Gold Crystal',
    tier: 4, health: 120, respawnTimeSeconds: 900, yieldMin: 1, yieldMax: 2, xpReward: 110,
    fbxModelUrl: `${GOLDMINE_BASE}/_crystal_5.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0xffcc22, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: 0
  },
  crystal_white: {
    type: 'ore_mythril', profession: 'mining', name: 'Diamond Crystal',
    tier: 6, health: 200, respawnTimeSeconds: 1500, yieldMin: 1, yieldMax: 1, xpReward: 200,
    fbxModelUrl: `${GOLDMINE_BASE}/_crystal_6.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0xffffff, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: 0
  },
  sapphire_vein: {
    type: 'ore_mythril', profession: 'mining', name: 'Sapphire Vein',
    tier: 4, health: 130, respawnTimeSeconds: 900, yieldMin: 1, yieldMax: 2, xpReward: 120,
    fbxModelUrl: `${GOLDMINE_BASE}/_sapfir_1.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0x0055ee, fallbackGeometry: 'ore', scale: 0.9,
    spawnZone: 'outer', yOffset: -0.2
  },
  diamond_vein: {
    type: 'ore_mythril', profession: 'mining', name: 'Diamond Vein',
    tier: 6, health: 250, respawnTimeSeconds: 2000, yieldMin: 1, yieldMax: 1, xpReward: 250,
    fbxModelUrl: `${GOLDMINE_BASE}/_stone_diamond.fbx`, fbxTexturePath: GOLDMINE_TEX,
    fallbackColor: 0xaaddff, fallbackGeometry: 'ore', scale: 1.0,
    spawnZone: 'outer', yOffset: -0.3
  },

  // ── Herbs & Plants ────────────────────────────────────────────────────────
  healing_herb: {
    type: 'herb_healing', profession: 'herbalism', name: 'Healing Herb',
    tier: 2, health: 10, respawnTimeSeconds: 180, yieldMin: 1, yieldMax: 3, xpReward: 20,
    modelUrl: '/models/island/patch-grass-foliage.glb',
    fallbackColor: 0x32CD32, fallbackGeometry: 'plant', scale: 1.0,
    spawnZone: 'inner', yOffset: 0
  },
  mana_flower: {
    type: 'herb_mana', profession: 'herbalism', name: 'Mana Flower',
    tier: 2, health: 10, respawnTimeSeconds: 180, yieldMin: 1, yieldMax: 2, xpReward: 25,
    modelUrl: '/models/island/grass-plant.glb',
    fallbackColor: 0x9370DB, fallbackGeometry: 'plant', scale: 1.0,
    spawnZone: 'inner', yOffset: 0
  },
  fiber_plant: {
    type: 'fiber', profession: 'herbalism', name: 'Fiber Plant',
    tier: 1, health: 5, respawnTimeSeconds: 60, yieldMin: 2, yieldMax: 5, xpReward: 10,
    modelUrl: '/models/island/grass.glb',
    fallbackColor: 0x9ACD32, fallbackGeometry: 'plant', scale: 1.2,
    spawnZone: 'inner', yOffset: 0
  },

  // ── Animal Carcasses ──────────────────────────────────────────────────────
  wild_boar: {
    type: 'hide', profession: 'skinning', name: 'Wild Boar',
    tier: 1, health: 30, respawnTimeSeconds: 300, yieldMin: 2, yieldMax: 4, xpReward: 25,
    fallbackColor: 0x8B4513, fallbackGeometry: 'animal', scale: 0.6,
    spawnZone: 'mid', yOffset: 0
  },
  deer_carcass: {
    type: 'leather', profession: 'skinning', name: 'Deer',
    tier: 2, health: 40, respawnTimeSeconds: 360, yieldMin: 2, yieldMax: 5, xpReward: 35,
    fallbackColor: 0xA0522D, fallbackGeometry: 'animal', scale: 0.8,
    spawnZone: 'mid', yOffset: 0
  },
  rabbit_carcass: {
    type: 'hide', profession: 'skinning', name: 'Rabbit',
    tier: 1, health: 10, respawnTimeSeconds: 120, yieldMin: 1, yieldMax: 2, xpReward: 10,
    fallbackColor: 0xD2B48C, fallbackGeometry: 'animal', scale: 0.3,
    spawnZone: 'inner', yOffset: 0
  },
  goat_carcass: {
    type: 'hide', profession: 'skinning', name: 'Mountain Goat',
    tier: 1, health: 25, respawnTimeSeconds: 240, yieldMin: 2, yieldMax: 3, xpReward: 20,
    fallbackColor: 0xC8B79E, fallbackGeometry: 'animal', scale: 0.55,
    spawnZone: 'mid', yOffset: 0
  },
  lamb_carcass: {
    type: 'hide', profession: 'skinning', name: 'Lamb',
    tier: 1, health: 12, respawnTimeSeconds: 180, yieldMin: 1, yieldMax: 2, xpReward: 12,
    fallbackColor: 0xFFFFE0, fallbackGeometry: 'animal', scale: 0.4,
    spawnZone: 'inner', yOffset: 0
  },
  fox_carcass: {
    type: 'hide', profession: 'skinning', name: 'Fox',
    tier: 1, health: 20, respawnTimeSeconds: 300, yieldMin: 1, yieldMax: 3, xpReward: 18,
    fallbackColor: 0xD2691E, fallbackGeometry: 'animal', scale: 0.5,
    spawnZone: 'inner', yOffset: 0
  },
  stag_carcass: {
    type: 'leather', profession: 'skinning', name: 'Stag',
    tier: 3, health: 55, respawnTimeSeconds: 480, yieldMin: 3, yieldMax: 6, xpReward: 50,
    fallbackColor: 0x8B5A2B, fallbackGeometry: 'animal', scale: 0.9,
    spawnZone: 'mid', yOffset: 0
  },
  wolf_carcass: {
    type: 'hide', profession: 'skinning', name: 'Wolf',
    tier: 2, health: 35, respawnTimeSeconds: 360, yieldMin: 2, yieldMax: 4, xpReward: 40,
    fallbackColor: 0x6B7280, fallbackGeometry: 'animal', scale: 0.6,
    spawnZone: 'mid', yOffset: 0
  },
  bull_carcass: {
    type: 'leather', profession: 'skinning', name: 'Wild Bull',
    tier: 3, health: 70, respawnTimeSeconds: 540, yieldMin: 4, yieldMax: 8, xpReward: 60,
    fallbackColor: 0x4B3621, fallbackGeometry: 'animal', scale: 1.0,
    spawnZone: 'mid', yOffset: 0
  }
};

export class ResourceNodeManager {
  private scene: THREE.Scene;
  private loader: GLTFLoader;
  private nodes: Map<string, ResourceNode> = new Map();
  private nodeMeshes: Map<string, THREE.Group> = new Map();
  private nodeIdCounter: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
  }

  private generateNodeId(): string {
    return `node_${++this.nodeIdCounter}_${Date.now()}`;
  }

  async spawnNode(
    templateKey: string,
    position: THREE.Vector3,
    rotation: number = 0
  ): Promise<ResourceNode | null> {
    const template = resourceNodeTemplates[templateKey];
    if (!template) {
      console.warn(`Resource node template not found: ${templateKey}`);
      return null;
    }

    const id = this.generateNodeId();
    const mesh = await this.createNodeMesh(template);
    
    mesh.position.copy(position);
    mesh.rotation.y = rotation;
    this.scene.add(mesh);
    
    const node: ResourceNode = {
      id,
      type: template.type,
      profession: template.profession,
      position: position.clone(),
      rotation,
      mesh,
      health: template.health,
      maxHealth: template.health,
      respawnTime: template.respawnTimeSeconds * 1000,
      lastHarvested: 0,
      isActive: true,
      yieldMin: template.yieldMin,
      yieldMax: template.yieldMax,
      tier: template.tier,
      xpReward: template.xpReward
    };

    this.nodes.set(id, node);
    this.nodeMeshes.set(id, mesh);

    return node;
  }

  private async createNodeMesh(template: ResourceNodeTemplate): Promise<THREE.Group> {
    if (template.fbxModelUrl) {
      try {
        const fbxLoader = new FBXLoader();
        const fbx = await fbxLoader.loadAsync(template.fbxModelUrl);
        const group = new THREE.Group();
        group.add(fbx);
        fbx.scale.setScalar(template.scale * 0.01);
        if (template.fbxTexturePath) {
          const tex = new THREE.TextureLoader().load(template.fbxTexturePath);
          tex.colorSpace = THREE.SRGBColorSpace;
          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mat = new THREE.MeshStandardMaterial({
                map: tex, roughness: 0.85, metalness: 0.05
              });
              (child as THREE.Mesh).material = mat;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        } else {
          this.setupMeshShadows(group);
        }
        group.userData = { isResourceNode: true, resourceType: template.type, templateKey: template.name };
        return group;
      } catch (err) {
        console.warn(`Failed to load FBX for ${template.name}`, err);
      }
    }

    if (template.modelUrl) {
      try {
        const gltf = await this.loader.loadAsync(template.modelUrl);
        const mesh = gltf.scene;
        mesh.scale.setScalar(template.scale);
        this.setupMeshShadows(mesh);
        mesh.userData = { isResourceNode: true, resourceType: template.type, templateKey: template.name };
        return mesh;
      } catch (error) {
        console.warn(`Failed to load GLB model for ${template.name}, using fallback`);
      }
    }

    return this.createFallbackNodeMesh(template);
  }

  sampleTerrainY(x: number, z: number, terrainMeshes: THREE.Mesh[]): number {
    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
    const hits = raycaster.intersectObjects(terrainMeshes, true);
    if (hits.length > 0) return hits[0].point.y;
    return 0;
  }

  private createFallbackNodeMesh(template: ResourceNodeTemplate): THREE.Group {
    const group = new THREE.Group();
    group.name = template.name;

    const material = new THREE.MeshStandardMaterial({
      color: template.fallbackColor,
      roughness: 0.8,
      metalness: 0.1
    });

    switch (template.fallbackGeometry) {
      case 'tree':
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3 * template.scale, 0.4 * template.scale, 4 * template.scale, 8),
          new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
        );
        trunk.position.y = 2 * template.scale;
        trunk.castShadow = true;
        group.add(trunk);

        const foliage = new THREE.Mesh(
          new THREE.SphereGeometry(2 * template.scale, 8, 8),
          material
        );
        foliage.position.y = 5 * template.scale;
        foliage.castShadow = true;
        group.add(foliage);
        break;

      case 'rock':
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.5 * template.scale, 1),
          material
        );
        rock.position.y = 0.8 * template.scale;
        rock.rotation.set(
          Math.random() * 0.3,
          Math.random() * Math.PI,
          Math.random() * 0.3
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
        break;

      case 'ore':
        const oreBase = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.2 * template.scale, 0),
          new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.7 })
        );
        oreBase.position.y = 0.6 * template.scale;
        oreBase.castShadow = true;
        group.add(oreBase);

        for (let i = 0; i < 4; i++) {
          const crystal = new THREE.Mesh(
            new THREE.ConeGeometry(0.15 * template.scale, 0.5 * template.scale, 4),
            new THREE.MeshStandardMaterial({
              color: template.fallbackColor,
              roughness: 0.3,
              metalness: 0.6,
              emissive: template.fallbackColor,
              emissiveIntensity: 0.1
            })
          );
          const angle = (i / 4) * Math.PI * 2;
          crystal.position.set(
            Math.cos(angle) * 0.5 * template.scale,
            0.8 * template.scale + Math.random() * 0.3,
            Math.sin(angle) * 0.5 * template.scale
          );
          crystal.rotation.set(
            Math.random() * 0.5 - 0.25,
            Math.random() * Math.PI,
            Math.random() * 0.5 - 0.25
          );
          crystal.castShadow = true;
          group.add(crystal);
        }
        break;

      case 'plant':
        for (let i = 0; i < 5; i++) {
          const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.2 * template.scale, 0.8 * template.scale, 4),
            material
          );
          const angle = (i / 5) * Math.PI * 2;
          leaf.position.set(
            Math.cos(angle) * 0.2 * template.scale,
            0.4 * template.scale,
            Math.sin(angle) * 0.2 * template.scale
          );
          leaf.rotation.set(0.3, angle, 0);
          leaf.castShadow = true;
          group.add(leaf);
        }
        
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.15 * template.scale, 6, 6),
          new THREE.MeshStandardMaterial({
            color: template.fallbackColor,
            emissive: template.fallbackColor,
            emissiveIntensity: 0.2
          })
        );
        flower.position.y = 0.6 * template.scale;
        group.add(flower);
        break;

      case 'animal':
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.5 * template.scale, 1.5 * template.scale, 4, 8),
          material
        );
        body.position.y = 0.5 * template.scale;
        body.rotation.z = Math.PI / 2;
        body.castShadow = true;
        group.add(body);
        
        for (let i = 0; i < 4; i++) {
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08 * template.scale, 0.1 * template.scale, 0.4 * template.scale, 4),
            material
          );
          const xOffset = (i < 2 ? -0.4 : 0.4) * template.scale;
          const zOffset = (i % 2 === 0 ? -0.25 : 0.25) * template.scale;
          leg.position.set(xOffset, 0.2 * template.scale, zOffset);
          leg.rotation.x = Math.PI / 6;
          group.add(leg);
        }
        break;
    }

    group.userData = { 
      isResourceNode: true, 
      resourceType: template.type,
      templateKey: template.name 
    };

    return group;
  }

  private setupMeshShadows(mesh: THREE.Group): void {
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  getNode(id: string): ResourceNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): ResourceNode[] {
    return Array.from(this.nodes.values());
  }

  removeNode(id: string): void {
    const mesh = this.nodeMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.nodeMeshes.delete(id);
    }
    this.nodes.delete(id);
  }

  updateNodeVisual(id: string, healthPercent: number): void {
    const mesh = this.nodeMeshes.get(id);
    if (!mesh) return;

    if (healthPercent < 0.3) {
      mesh.scale.setScalar(0.7 + healthPercent);
    }
  }

  setNodeActive(id: string, active: boolean): void {
    const node = this.nodes.get(id);
    const mesh = this.nodeMeshes.get(id);
    
    if (node && mesh) {
      node.isActive = active;
      mesh.visible = active;
    }
  }

  spawnRandomNodesOnIsland(
    center: THREE.Vector3,
    radius: number,
    nodeTypes: string[],
    count: number,
    terrainMeshes: THREE.Mesh[] = []
  ): void {
    const spawnedPositions: THREE.Vector3[] = [];
    const minDistance = 5;

    for (let i = 0; i < count; i++) {
      const templateKey = nodeTypes[Math.floor(Math.random() * nodeTypes.length)];
      const template = resourceNodeTemplates[templateKey];
      if (!template) continue;

      let position: THREE.Vector3;
      let attempts = 0;
      const maxAttempts = 30;

      const zoneRanges: Record<string, [number, number]> = {
        inner: [5,  radius * 0.3],
        mid:   [radius * 0.3, radius * 0.7],
        outer: [radius * 0.7, radius * 0.95]
      };
      const [minDist, maxDist] = zoneRanges[template.spawnZone] ?? [10, radius - 5];

      do {
        const angle = Math.random() * Math.PI * 2;
        const distance = minDist + Math.random() * (maxDist - minDist);
        const wx = center.x + Math.cos(angle) * distance;
        const wz = center.z + Math.sin(angle) * distance;
        const wy = terrainMeshes.length > 0
          ? this.sampleTerrainY(wx, wz, terrainMeshes) + template.yOffset
          : center.y + template.yOffset;
        position = new THREE.Vector3(wx, wy, wz);
        attempts++;
      } while (
        attempts < maxAttempts &&
        spawnedPositions.some(p => p.distanceTo(position) < minDistance)
      );

      if (attempts < maxAttempts) {
        spawnedPositions.push(position);
        this.spawnNode(templateKey, position, Math.random() * Math.PI * 2);
      }
    }
  }

  spawnZonedNodesOnIsland(
    center: THREE.Vector3,
    radius: number,
    terrainMeshes: THREE.Mesh[] = []
  ): void {
    const zoneConfig: Array<{ types: string[]; count: number }> = [
      { types: ['healing_herb', 'mana_flower', 'fiber_plant', 'rabbit_carcass'], count: 6 },
      { types: ['oak_tree', 'tropical_tree', 'forest_tree', 'stone_boulder', 'granite_rock', 'wild_boar', 'deer_carcass'], count: 14 },
      { types: ['palm_bend', 'palm_straight', 'iron_vein', 'copper_vein', 'coal_vein', 'sandstone_rock', 'crystal_blue', 'crystal_purple', 'crystal_green'], count: 12 }
    ];

    for (const cfg of zoneConfig) {
      this.spawnRandomNodesOnIsland(center, radius, cfg.types, cfg.count, terrainMeshes);
    }
  }

  clearAllNodes(): void {
    this.nodeMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.nodes.clear();
    this.nodeMeshes.clear();
  }
}
