import * as THREE from 'three';
import type { ResourceNode, ResourceType, HarvestingProfession, HarvestResult } from './harvestingProfessions';
import { professionDefinitions, resourceDefinitions } from './harvestingProfessions';
import { PolygonJSEffectsManager, EffectType } from './polygonJSEffects';

export interface HarvestableObject {
  id: string;
  mesh: THREE.Object3D;
  type: 'tree' | 'rock' | 'ore' | 'plant';
  resourceType: ResourceType;
  profession: HarvestingProfession;
  health: number;
  maxHealth: number;
  yieldMin: number;
  yieldMax: number;
  xpReward: number;
  tier: number;
  isBeingDestroyed: boolean;
  originalRotation?: THREE.Euler;
  originalPosition?: THREE.Vector3;
  originalScale?: THREE.Vector3;
  hitAnimationId?: number;
  breakAnimationId?: number;
}

export interface HitEffect {
  particles: THREE.Group;
  startTime: number;
}

export interface PlayerReference {
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  canPerformToolHit: () => boolean;
  playToolHitAnimation: (toolType: 'axe' | 'pickaxe' | 'knife') => boolean;
  getEquippedTool: () => { id: string; type: string } | null;
}

export interface InventoryReference {
  addResource: (type: ResourceType, amount: number) => boolean;
  getEquippedTool: () => { id: string; type: string } | null;
}

export class ResourceHarvestingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private player: PlayerReference | null = null;
  private effectsManager: PolygonJSEffectsManager | null = null;
  
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  private harvestableObjects = new Map<string, HarvestableObject>();
  private hitEffects: HitEffect[] = [];
  
  private harvestingRange = 4.0;
  private mouseIndicator: HTMLDivElement | null = null;
  private hoveredObject: HarvestableObject | null = null;
  
  private onHarvest?: (result: HarvestResult) => void;
  private onResourceDrop?: (position: THREE.Vector3, resourceType: ResourceType, amount: number) => void;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    
    this.effectsManager = new PolygonJSEffectsManager(scene);
    
    this.createMouseIndicator();
    this.handleMouseMove = this.handleMouseMove.bind(this);
    window.addEventListener('mousemove', this.handleMouseMove);
    
    console.log('ResourceHarvestingSystem initialized with PolygonJS effects');
  }
  
  setPlayer(player: PlayerReference) {
    this.player = player;
    console.log('Player reference set for harvesting system');
  }
  
  setOnHarvest(callback: (result: HarvestResult) => void) {
    this.onHarvest = callback;
  }
  
  setOnResourceDrop(callback: (position: THREE.Vector3, resourceType: ResourceType, amount: number) => void) {
    this.onResourceDrop = callback;
  }
  
  registerHarvestableObject(
    id: string,
    mesh: THREE.Object3D,
    type: 'tree' | 'rock' | 'ore' | 'plant',
    config: {
      resourceType: ResourceType;
      profession: HarvestingProfession;
      health: number;
      yieldMin: number;
      yieldMax: number;
      xpReward: number;
      tier: number;
    }
  ) {
    const harvestable: HarvestableObject = {
      id,
      mesh,
      type,
      resourceType: config.resourceType,
      profession: config.profession,
      health: config.health,
      maxHealth: config.health,
      yieldMin: config.yieldMin,
      yieldMax: config.yieldMax,
      xpReward: config.xpReward,
      tier: config.tier,
      isBeingDestroyed: false
    };
    
    mesh.userData.harvestableId = id;
    mesh.userData.isHarvestable = true;
    mesh.userData.harvestableType = type;
    
    this.harvestableObjects.set(id, harvestable);
    console.log(`Registered harvestable: ${id} (${type})`);
  }
  
  unregisterHarvestableObject(id: string) {
    this.harvestableObjects.delete(id);
  }
  
  handleClick(event: MouseEvent) {
    if (!this.player || !this.player.mesh) {
      return;
    }
    
    const equippedTool = this.player.getEquippedTool?.();
    if (!equippedTool) {
      return;
    }
    
    if (!this.player.canPerformToolHit()) {
      console.log('Cannot harvest - tool animation in progress');
      return;
    }
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const harvestables = this.getAllHarvestableMeshes();
    const intersects = this.raycaster.intersectObjects(harvestables, true);
    
    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const harvestable = this.findHarvestableFromMesh(hitObject);
      
      if (harvestable) {
        const playerPosition = this.player.mesh.position;
        const objectPosition = harvestable.mesh.position;
        const distance = playerPosition.distanceTo(objectPosition);
        
        if (distance <= this.harvestingRange) {
          const requiredTool = this.getRequiredToolForType(harvestable.type);
          
          if (equippedTool.type === requiredTool) {
            const toolType = requiredTool === 'axe' ? 'axe' : requiredTool === 'pickaxe' ? 'pickaxe' : 'knife';
            const animationStarted = this.player.playToolHitAnimation(toolType);
            
            if (animationStarted) {
              setTimeout(() => {
                this.harvestObject(harvestable, intersects[0].point);
              }, 300);
            }
          } else {
            console.log(`Wrong tool! Need ${requiredTool} for ${harvestable.type}`);
          }
        } else {
          console.log(`Object too far! Distance: ${distance.toFixed(2)}, Max: ${this.harvestingRange}`);
        }
      }
    }
  }
  
  private getRequiredToolForType(type: 'tree' | 'rock' | 'ore' | 'plant'): string {
    switch (type) {
      case 'tree': return 'axe';
      case 'rock': return 'pickaxe';
      case 'ore': return 'pickaxe';
      case 'plant': return 'none';
      default: return 'none';
    }
  }
  
  private getAllHarvestableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    
    this.harvestableObjects.forEach(obj => {
      if (!obj.isBeingDestroyed) {
        meshes.push(obj.mesh);
      }
    });
    
    return meshes;
  }
  
  private findHarvestableFromMesh(mesh: THREE.Object3D): HarvestableObject | null {
    let current: THREE.Object3D | null = mesh;
    
    while (current) {
      if (current.userData.harvestableId) {
        return this.harvestableObjects.get(current.userData.harvestableId) || null;
      }
      current = current.parent;
    }
    
    return null;
  }
  
  private harvestObject(harvestable: HarvestableObject, hitPoint: THREE.Vector3) {
    if (harvestable.isBeingDestroyed) {
      return;
    }
    
    harvestable.health--;
    
    const yieldAmount = Math.floor(Math.random() * (harvestable.yieldMax - harvestable.yieldMin + 1)) + harvestable.yieldMin;
    const hitYield = Math.ceil(yieldAmount / harvestable.maxHealth);
    
    if (this.onResourceDrop) {
      this.onResourceDrop(hitPoint, harvestable.resourceType, hitYield);
    }
    
    this.createHitEffect(hitPoint, harvestable.type);
    this.playHitAnimation(harvestable);
    this.applyDamageEffect(harvestable);
    
    if (harvestable.health <= 0) {
      this.destroyHarvestable(harvestable);
    }
    
    if (this.onHarvest) {
      this.onHarvest({
        success: true,
        resourceType: harvestable.resourceType,
        amount: hitYield,
        xpGained: Math.ceil(harvestable.xpReward / harvestable.maxHealth),
        nodeDestroyed: harvestable.health <= 0,
        message: `Harvested ${hitYield} ${resourceDefinitions[harvestable.resourceType]?.name || harvestable.resourceType}`
      });
    }
  }
  
  private createHitEffect(position: THREE.Vector3, type: 'tree' | 'rock' | 'ore' | 'plant') {
    if (this.effectsManager) {
      const effectType = (type === 'tree' ? 'woodChips' :
                          type === 'rock' ? 'rockDebris' :
                          type === 'ore' ? 'oreSparkle' : 'leafBurst') as any;
      
      (this.effectsManager as any).playEffect(effectType, position);
      return;
    }
    
    const particleCount = 10;
    const particles = new THREE.Group();
    
    const color = type === 'tree' ? 0x8B4513 : 
                  type === 'rock' ? 0x808080 :
                  type === 'ore' ? 0xB87333 : 0x32CD32;
    
    for (let i = 0; i < particleCount; i++) {
      const chipGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      const chipMaterial = new THREE.MeshLambertMaterial({ color });
      const chip = new THREE.Mesh(chipGeometry, chipMaterial);
      
      chip.position.copy(position);
      chip.position.x += (Math.random() - 0.5) * 0.5;
      chip.position.y += (Math.random() - 0.5) * 0.5;
      chip.position.z += (Math.random() - 0.5) * 0.5;
      
      chip.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      chip.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2 + 1,
        (Math.random() - 0.5) * 2
      );
      
      chip.userData.life = 1.0;
      
      particles.add(chip);
    }
    
    this.scene.add(particles);
    this.hitEffects.push({
      particles,
      startTime: Date.now()
    });
  }
  
  private playHitAnimation(harvestable: HarvestableObject) {
    if (!harvestable.originalRotation) {
      harvestable.originalRotation = harvestable.mesh.rotation.clone();
    }
    
    if (harvestable.hitAnimationId) {
      cancelAnimationFrame(harvestable.hitAnimationId);
    }
    
    const hitIntensity = harvestable.type === 'tree' ? 0.1 : 0.05;
    const hitDuration = 300;
    const startTime = Date.now();
    
    const animateHit = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / hitDuration;
      
      if (progress < 1) {
        const currentIntensity = hitIntensity * (1 - progress);
        const shakeX = (Math.random() - 0.5) * currentIntensity;
        const shakeZ = (Math.random() - 0.5) * currentIntensity;
        
        harvestable.mesh.rotation.x = harvestable.originalRotation!.x + shakeX;
        harvestable.mesh.rotation.z = harvestable.originalRotation!.z + shakeZ;
        
        harvestable.hitAnimationId = requestAnimationFrame(animateHit);
      } else {
        harvestable.mesh.rotation.copy(harvestable.originalRotation!);
        harvestable.hitAnimationId = undefined;
      }
    };
    
    animateHit();
  }
  
  private applyDamageEffect(harvestable: HarvestableObject) {
    const damageRatio = 1 - (harvestable.health / harvestable.maxHealth);
    
    harvestable.mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).color) {
          const material = mesh.material as THREE.MeshStandardMaterial;
          
          if (!mesh.userData.originalColor) {
            mesh.userData.originalColor = material.color.clone();
          }
          
          const darkenColor = harvestable.type === 'tree' ? 0x4A3A2A : 0x3A3A3A;
          const damagedColor = mesh.userData.originalColor.clone().lerp(new THREE.Color(darkenColor), damageRatio * 0.5);
          material.color.copy(damagedColor);
          
          if (damageRatio > 0.6) {
            material.transparent = true;
            material.opacity = 1 - (damageRatio - 0.6) * 0.5;
          } else {
            material.transparent = false;
            material.opacity = 1.0;
          }
        }
      }
    });
  }
  
  private destroyHarvestable(harvestable: HarvestableObject) {
    console.log(`Destroyed ${harvestable.type}: ${harvestable.id}`);
    
    harvestable.isBeingDestroyed = true;
    
    const bonusYield = Math.floor(Math.random() * 3) + 1;
    if (this.onResourceDrop) {
      this.onResourceDrop(harvestable.mesh.position, harvestable.resourceType, bonusYield);
    }
    
    this.playBreakAnimation(harvestable, () => {
      this.createDestructionEffect(harvestable.mesh.position, harvestable.type);
      this.scene.remove(harvestable.mesh);
      this.harvestableObjects.delete(harvestable.id);
    });
  }
  
  private playBreakAnimation(harvestable: HarvestableObject, onComplete: () => void) {
    if (!harvestable.originalScale) {
      harvestable.originalScale = harvestable.mesh.scale.clone();
    }
    if (!harvestable.originalPosition) {
      harvestable.originalPosition = harvestable.mesh.position.clone();
    }
    if (!harvestable.originalRotation) {
      harvestable.originalRotation = harvestable.mesh.rotation.clone();
    }
    
    if (harvestable.breakAnimationId) {
      cancelAnimationFrame(harvestable.breakAnimationId);
    }
    
    const fallDuration = harvestable.type === 'tree' ? 800 : 400;
    const startTime = Date.now();
    const fallDirection = Math.random() * Math.PI * 2;
    const fallIntensity = harvestable.type === 'tree' ? 1.2 : 0.3;
    
    const animateBreak = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fallDuration, 1);
      
      if (progress < 1) {
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        if (harvestable.type === 'tree') {
          harvestable.mesh.rotation.z = harvestable.originalRotation!.z + (easeOutQuart * fallIntensity * Math.cos(fallDirection));
          harvestable.mesh.rotation.x = harvestable.originalRotation!.x + (easeOutQuart * fallIntensity * Math.sin(fallDirection));
          harvestable.mesh.position.y = harvestable.originalPosition!.y - (easeOutQuart * 0.5);
        } else {
          harvestable.mesh.position.y = harvestable.originalPosition!.y - (easeOutQuart * 0.3);
        }
        
        const scaleMultiplier = 1 - (progress * 0.3);
        harvestable.mesh.scale.copy(harvestable.originalScale!).multiplyScalar(scaleMultiplier);
        
        harvestable.breakAnimationId = requestAnimationFrame(animateBreak);
      } else {
        harvestable.breakAnimationId = undefined;
        onComplete();
      }
    };
    
    animateBreak();
  }
  
  private createDestructionEffect(position: THREE.Vector3, type: 'tree' | 'rock' | 'ore' | 'plant') {
    const particleCount = 25;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const isSecondary = Math.random() < 0.4;
      
      let geometry: THREE.BufferGeometry;
      let material: THREE.MeshLambertMaterial;
      
      if (type === 'tree') {
        if (isSecondary) {
          geometry = new THREE.PlaneGeometry(0.1, 0.1);
          material = new THREE.MeshLambertMaterial({ 
            color: 0x228B22,
            transparent: true,
            opacity: 0.8
          });
        } else {
          geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
          material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        }
      } else {
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const color = type === 'rock' ? 0x808080 : 0xB87333;
        material = new THREE.MeshLambertMaterial({ color });
      }
      
      const particle = new THREE.Mesh(geometry, material);
      
      particle.position.copy(position);
      particle.position.x += (Math.random() - 0.5) * 3;
      particle.position.y += Math.random() * 2;
      particle.position.z += (Math.random() - 0.5) * 3;
      
      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 2,
        (Math.random() - 0.5) * 4
      );
      
      particle.userData.life = 2.0;
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    this.hitEffects.push({
      particles,
      startTime: Date.now()
    });
  }
  
  private createMouseIndicator() {
    this.mouseIndicator = document.createElement('div');
    this.mouseIndicator.style.cssText = `
      position: absolute;
      color: white;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      display: none;
      background: rgba(0,0,0,0.7);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,215,0,0.5);
    `;
    document.body.appendChild(this.mouseIndicator);
  }
  
  private handleMouseMove(event: MouseEvent) {
    if (!this.player || !this.player.mesh) {
      this.hideMouseIndicator();
      return;
    }
    
    const equippedTool = this.player.getEquippedTool?.();
    if (!equippedTool) {
      this.hideMouseIndicator();
      return;
    }
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const harvestables = this.getAllHarvestableMeshes();
    const intersects = this.raycaster.intersectObjects(harvestables, true);
    
    if (intersects.length > 0) {
      const harvestable = this.findHarvestableFromMesh(intersects[0].object);
      if (harvestable) {
        const distance = this.player.mesh.position.distanceTo(harvestable.mesh.position);
        if (distance <= this.harvestingRange) {
          const requiredTool = this.getRequiredToolForType(harvestable.type);
          const hasCorrectTool = equippedTool.type === requiredTool;
          
          this.showMouseIndicator(
            event.clientX, 
            event.clientY, 
            harvestable,
            hasCorrectTool
          );
          this.hoveredObject = harvestable;
          return;
        }
      }
    }
    
    this.hideMouseIndicator();
    this.hoveredObject = null;
  }
  
  private showMouseIndicator(x: number, y: number, harvestable: HarvestableObject, hasCorrectTool: boolean) {
    if (!this.mouseIndicator) return;
    
    const healthPercent = Math.round((harvestable.health / harvestable.maxHealth) * 100);
    const resourceName = resourceDefinitions[harvestable.resourceType]?.name || harvestable.resourceType;
    
    let text = `${harvestable.type === 'tree' ? '🌳' : harvestable.type === 'rock' ? '🪨' : '⛏️'} `;
    text += `${resourceName} (${healthPercent}%)`;
    
    if (!hasCorrectTool) {
      const requiredTool = this.getRequiredToolForType(harvestable.type);
      text += `\n⚠️ Need ${requiredTool}`;
    } else {
      text += '\nClick to harvest';
    }
    
    this.mouseIndicator.textContent = text;
    this.mouseIndicator.style.display = 'block';
    this.mouseIndicator.style.left = `${x + 15}px`;
    this.mouseIndicator.style.top = `${y + 15}px`;
    this.mouseIndicator.style.whiteSpace = 'pre-line';
    this.mouseIndicator.style.borderColor = hasCorrectTool ? 'rgba(255,215,0,0.5)' : 'rgba(255,100,100,0.5)';
  }
  
  private hideMouseIndicator() {
    if (this.mouseIndicator) {
      this.mouseIndicator.style.display = 'none';
    }
  }
  
  update(deltaTime: number) {
    this.cleanupOldEffects(deltaTime);
    
    if (this.effectsManager) {
      this.effectsManager.update(deltaTime);
    }
  }
  
  private cleanupOldEffects(deltaTime: number) {
    const currentTime = Date.now();
    
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      const age = (currentTime - effect.startTime) / 1000;
      
      if (age > 3) {
        this.scene.remove(effect.particles);
        this.hitEffects.splice(i, 1);
      } else {
        effect.particles.children.forEach((particle) => {
          const p = particle as THREE.Mesh;
          if (p.userData.velocity) {
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
            p.userData.velocity.y -= 0.05;
            p.userData.life -= 0.016;
            
            if (p.material && (p.material as THREE.MeshLambertMaterial).transparent) {
              (p.material as THREE.MeshLambertMaterial).opacity = Math.max(0, p.userData.life);
            }
          }
        });
      }
    }
  }
  
  dispose() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    
    if (this.mouseIndicator && this.mouseIndicator.parentNode) {
      this.mouseIndicator.parentNode.removeChild(this.mouseIndicator);
    }
    
    this.hitEffects.forEach(effect => {
      this.scene.remove(effect.particles);
    });
    this.hitEffects = [];
    
    if (this.effectsManager) {
      this.effectsManager.dispose();
      this.effectsManager = null;
    }
    
    this.harvestableObjects.clear();
  }
}
