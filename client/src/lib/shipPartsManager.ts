import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ShipPartType = 'hull' | 'deck' | 'bow' | 'stern' | 'mast' | 'foremast' | 'mainmast' | 'mizzenmast' | 'cannon' | 'unknown';

export interface ShipPart {
  id: string;
  type: ShipPartType;
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  damagedMaterial: THREE.Material;
  destroyedMaterial: THREE.Material;
  maxHealth: number;
  currentHealth: number;
  isDestroyed: boolean;
}

export interface DamageableShip {
  id: string;
  shipType: string;
  group: THREE.Group;
  parts: Map<string, ShipPart>;
  maxHealth: number;
  currentHealth: number;
  isSinking: boolean;
  sinkProgress: number;
}

const PART_KEYWORDS: Record<ShipPartType, string[]> = {
  hull: ['hull', 'body', 'base', 'main', 'ship'],
  deck: ['deck', 'floor', 'platform', 'plank'],
  bow: ['bow', 'front', 'nose', 'figurehead', 'prow'],
  stern: ['stern', 'back', 'rear', 'aft', 'quarter', 'cabin'],
  mast: ['mast', 'pole', 'spar'],
  foremast: ['fore', 'front_mast'],
  mainmast: ['main_mast', 'mainmast', 'center_mast'],
  mizzenmast: ['mizzen', 'rear_mast', 'back_mast'],
  cannon: ['cannon', 'gun', 'weapon', 'artillery'],
  unknown: []
};

const SHIP_TIER_HEALTH: Record<string, { total: number; partMultipliers: Partial<Record<ShipPartType, number>> }> = {
  raft: { 
    total: 50, 
    partMultipliers: { hull: 0.6, deck: 0.2, mast: 0.2 } 
  },
  skiff: { 
    total: 100, 
    partMultipliers: { hull: 0.5, deck: 0.2, bow: 0.1, stern: 0.1, mast: 0.1 } 
  },
  sloop: { 
    total: 200, 
    partMultipliers: { hull: 0.4, deck: 0.2, bow: 0.1, stern: 0.15, mast: 0.1, cannon: 0.05 } 
  },
  brigantine: { 
    total: 350, 
    partMultipliers: { hull: 0.35, deck: 0.15, bow: 0.1, stern: 0.15, foremast: 0.1, mainmast: 0.1, cannon: 0.05 } 
  },
  galleon: { 
    total: 500, 
    partMultipliers: { hull: 0.3, deck: 0.15, bow: 0.1, stern: 0.15, foremast: 0.08, mainmast: 0.1, mizzenmast: 0.07, cannon: 0.05 } 
  }
};

export class ShipPartsManager {
  private loader: GLTFLoader;
  private ships: Map<string, DamageableShip> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
  }

  identifyPartType(meshName: string): ShipPartType {
    const lowerName = meshName.toLowerCase();
    
    for (const [partType, keywords] of Object.entries(PART_KEYWORDS)) {
      if (partType === 'unknown') continue;
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          return partType as ShipPartType;
        }
      }
    }
    
    return 'unknown';
  }

  createDamageMaterial(baseMaterial: THREE.Material, damageLevel: 'light' | 'heavy' | 'destroyed'): THREE.Material {
    const damagedMat = (baseMaterial as THREE.MeshStandardMaterial).clone();
    
    if (damagedMat instanceof THREE.MeshStandardMaterial) {
      switch (damageLevel) {
        case 'light':
          damagedMat.color.lerp(new THREE.Color(0x4a3728), 0.2);
          damagedMat.roughness = Math.min(1, damagedMat.roughness + 0.2);
          break;
        case 'heavy':
          damagedMat.color.lerp(new THREE.Color(0x2a1a10), 0.5);
          damagedMat.roughness = Math.min(1, damagedMat.roughness + 0.4);
          damagedMat.metalness = Math.max(0, damagedMat.metalness - 0.3);
          break;
        case 'destroyed':
          damagedMat.color.set(0x1a0a05);
          damagedMat.roughness = 1;
          damagedMat.metalness = 0;
          damagedMat.opacity = 0.6;
          damagedMat.transparent = true;
          break;
      }
    }
    
    return damagedMat;
  }

  async loadShipFromUrl(url: string, shipId: string, shipType: string): Promise<DamageableShip | null> {
    try {
      const gltf = await this.loader.loadAsync(url);
      return this.processLoadedShip(gltf.scene, shipId, shipType);
    } catch (error) {
      console.error(`Failed to load ship from ${url}:`, error);
      return null;
    }
  }

  processLoadedShip(model: THREE.Group, shipId: string, shipType: string): DamageableShip {
    const parts = new Map<string, ShipPart>();
    const healthConfig = SHIP_TIER_HEALTH[shipType] || SHIP_TIER_HEALTH.sloop;
    
    let partIndex = 0;
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const partType = this.identifyPartType(child.name);
        const partId = `${shipId}_part_${partIndex++}`;
        
        const healthMultiplier = healthConfig.partMultipliers[partType] || 0.1;
        const partMaxHealth = Math.floor(healthConfig.total * healthMultiplier);
        
        const originalMaterial = child.material;
        const baseMat = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial;
        
        const part: ShipPart = {
          id: partId,
          type: partType,
          mesh: child,
          originalMaterial: originalMaterial,
          damagedMaterial: this.createDamageMaterial(baseMat, 'heavy'),
          destroyedMaterial: this.createDamageMaterial(baseMat, 'destroyed'),
          maxHealth: partMaxHealth,
          currentHealth: partMaxHealth,
          isDestroyed: false
        };
        
        parts.set(partId, part);
        
        console.log(`Ship part identified: ${child.name} -> ${partType} (HP: ${partMaxHealth})`);
      }
    });
    
    const ship: DamageableShip = {
      id: shipId,
      shipType,
      group: model,
      parts,
      maxHealth: healthConfig.total,
      currentHealth: healthConfig.total,
      isSinking: false,
      sinkProgress: 0
    };
    
    this.ships.set(shipId, ship);
    return ship;
  }

  damagePart(shipId: string, partId: string, damage: number): { partDestroyed: boolean; shipSinking: boolean } {
    const ship = this.ships.get(shipId);
    if (!ship) return { partDestroyed: false, shipSinking: false };
    
    const part = ship.parts.get(partId);
    if (!part || part.isDestroyed) return { partDestroyed: false, shipSinking: false };
    
    part.currentHealth = Math.max(0, part.currentHealth - damage);
    ship.currentHealth = Math.max(0, ship.currentHealth - damage);
    
    const healthPercent = part.currentHealth / part.maxHealth;
    
    if (healthPercent <= 0) {
      part.isDestroyed = true;
      part.mesh.material = part.destroyedMaterial;
      
      if (part.type === 'mast' || part.type === 'foremast' || part.type === 'mainmast' || part.type === 'mizzenmast') {
        this.animateMastFall(part.mesh);
      }
    } else if (healthPercent <= 0.3) {
      part.mesh.material = part.damagedMaterial;
    } else if (healthPercent <= 0.6) {
      const baseMat = Array.isArray(part.originalMaterial) ? part.originalMaterial[0] : part.originalMaterial;
      part.mesh.material = this.createDamageMaterial(baseMat, 'light');
    }
    
    const shipSinking = ship.currentHealth <= 0 && !ship.isSinking;
    if (shipSinking) {
      ship.isSinking = true;
    }
    
    return { partDestroyed: part.isDestroyed, shipSinking };
  }

  damageShipAtPoint(shipId: string, hitPoint: THREE.Vector3, damage: number): { partHit: string | null; partDestroyed: boolean; shipSinking: boolean } {
    const ship = this.ships.get(shipId);
    if (!ship) return { partHit: null, partDestroyed: false, shipSinking: false };
    
    let closestPart: ShipPart | null = null;
    let closestDist = Infinity;
    
    for (const part of Array.from(ship.parts.values())) {
      if (part.isDestroyed) continue;
      
      const partWorldPos = new THREE.Vector3();
      part.mesh.getWorldPosition(partWorldPos);
      
      const dist = partWorldPos.distanceTo(hitPoint);
      if (dist < closestDist) {
        closestDist = dist;
        closestPart = part;
      }
    }
    
    if (closestPart && closestDist < 20) {
      const result = this.damagePart(shipId, closestPart.id, damage);
      return { partHit: closestPart.id, ...result };
    }
    
    return { partHit: null, partDestroyed: false, shipSinking: false };
  }

  animateMastFall(mastMesh: THREE.Mesh): void {
    const fallDuration = 2000;
    const startTime = performance.now();
    const startRotation = mastMesh.rotation.x;
    const targetRotation = Math.PI / 2;
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / fallDuration);
      
      const eased = 1 - Math.pow(1 - progress, 3);
      mastMesh.rotation.x = startRotation + (targetRotation - startRotation) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  updateSinkingShips(delta: number): void {
    for (const ship of Array.from(this.ships.values())) {
      if (ship.isSinking) {
        ship.sinkProgress += delta * 0.3;
        
        ship.group.position.y -= delta * 2;
        
        ship.group.rotation.z = Math.sin(ship.sinkProgress * 2) * 0.1 + ship.sinkProgress * 0.3;
        ship.group.rotation.x = ship.sinkProgress * 0.2;
        
        if (ship.sinkProgress >= 1) {
          ship.group.visible = false;
        }
      }
    }
  }

  getShip(shipId: string): DamageableShip | undefined {
    return this.ships.get(shipId);
  }

  getShipHealth(shipId: string): { current: number; max: number; percent: number } | null {
    const ship = this.ships.get(shipId);
    if (!ship) return null;
    
    return {
      current: ship.currentHealth,
      max: ship.maxHealth,
      percent: ship.currentHealth / ship.maxHealth
    };
  }

  getPartHealth(shipId: string, partId: string): { current: number; max: number; percent: number } | null {
    const ship = this.ships.get(shipId);
    if (!ship) return null;
    
    const part = ship.parts.get(partId);
    if (!part) return null;
    
    return {
      current: part.currentHealth,
      max: part.maxHealth,
      percent: part.currentHealth / part.maxHealth
    };
  }

  repairShip(shipId: string, amount: number): void {
    const ship = this.ships.get(shipId);
    if (!ship || ship.isSinking) return;
    
    const repairPerPart = amount / ship.parts.size;
    
    for (const part of Array.from(ship.parts.values())) {
      if (part.isDestroyed) continue;
      
      part.currentHealth = Math.min(part.maxHealth, part.currentHealth + repairPerPart);
      
      const healthPercent = part.currentHealth / part.maxHealth;
      if (healthPercent > 0.6) {
        part.mesh.material = part.originalMaterial;
      }
    }
    
    ship.currentHealth = Math.min(ship.maxHealth, ship.currentHealth + amount);
  }

  removeShip(shipId: string): void {
    const ship = this.ships.get(shipId);
    if (ship) {
      this.scene.remove(ship.group);
      ship.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this.ships.delete(shipId);
    }
  }

  parseModelHierarchy(model: THREE.Group): { name: string; type: string; children: string[] }[] {
    const hierarchy: { name: string; type: string; children: string[] }[] = [];
    
    model.traverse((child) => {
      const entry = {
        name: child.name || 'unnamed',
        type: child.type,
        children: child.children.map(c => c.name || 'unnamed')
      };
      hierarchy.push(entry);
    });
    
    return hierarchy;
  }

  dispose(): void {
    for (const shipId of Array.from(this.ships.keys())) {
      this.removeShip(shipId);
    }
    this.ships.clear();
  }
}
