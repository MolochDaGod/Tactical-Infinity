import * as THREE from 'three';

export type TerrainToolType = 'raise' | 'lower' | 'smooth' | 'flatten' | 'paint';

export interface TerrainBrush {
  radius: number;
  strength: number;
  falloff: 'linear' | 'smooth' | 'constant';
}

export interface TerrainEditingConfig {
  brushRadius: number;
  brushStrength: number;
  brushFalloff: 'linear' | 'smooth' | 'constant';
  minHeight: number;
  maxHeight: number;
  gridResolution: number;
}

interface TerrainVertex {
  index: number;
  originalY: number;
  currentY: number;
}

const DEFAULT_CONFIG: TerrainEditingConfig = {
  brushRadius: 5,
  brushStrength: 0.5,
  brushFalloff: 'smooth',
  minHeight: -10,
  maxHeight: 50,
  gridResolution: 1,
};

export class TerrainEditingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private terrain: THREE.Mesh | null = null;
  private config: TerrainEditingConfig;
  
  private currentTool: TerrainToolType = 'raise';
  private isEditing: boolean = false;
  private isMouseDown: boolean = false;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private brushIndicator: THREE.Mesh | null = null;
  private brushOutline: THREE.LineLoop | null = null;
  
  private undoStack: Float32Array[] = [];
  private redoStack: Float32Array[] = [];
  private maxUndoSteps = 20;
  
  private onTerrainModified?: (position: THREE.Vector3) => void;
  private onToolChange?: (tool: TerrainToolType) => void;
  private onBrushChange?: (brush: TerrainBrush) => void;
  
  private boundHandleMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundHandleMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundHandleMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundHandleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundHandleWheel: ((e: WheelEvent) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: Partial<TerrainEditingConfig> = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.createBrushIndicator();
  }

  private createBrushIndicator(): void {
    const circleGeometry = new THREE.CircleGeometry(this.config.brushRadius, 32);
    circleGeometry.rotateX(-Math.PI / 2);
    
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FF00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    this.brushIndicator = new THREE.Mesh(circleGeometry, indicatorMaterial);
    this.brushIndicator.visible = false;
    this.brushIndicator.renderOrder = 999;
    this.scene.add(this.brushIndicator);
    
    const outlinePoints: THREE.Vector3[] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      outlinePoints.push(new THREE.Vector3(
        Math.cos(angle) * this.config.brushRadius,
        0,
        Math.sin(angle) * this.config.brushRadius
      ));
    }
    
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const outlineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00FF00,
      linewidth: 2,
    });
    
    this.brushOutline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    this.brushOutline.visible = false;
    this.brushOutline.renderOrder = 1000;
    this.scene.add(this.brushOutline);
  }

  private updateBrushIndicatorSize(): void {
    if (this.brushIndicator) {
      this.scene.remove(this.brushIndicator);
      this.brushIndicator.geometry.dispose();
      
      const circleGeometry = new THREE.CircleGeometry(this.config.brushRadius, 32);
      circleGeometry.rotateX(-Math.PI / 2);
      this.brushIndicator.geometry = circleGeometry;
      this.scene.add(this.brushIndicator);
    }
    
    if (this.brushOutline) {
      const outlinePoints: THREE.Vector3[] = [];
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        outlinePoints.push(new THREE.Vector3(
          Math.cos(angle) * this.config.brushRadius,
          0,
          Math.sin(angle) * this.config.brushRadius
        ));
      }
      
      this.brushOutline.geometry.dispose();
      this.brushOutline.geometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    }
  }

  setTerrain(terrain: THREE.Mesh): void {
    this.terrain = terrain;
    this.saveUndoState();
  }

  setCallbacks(callbacks: {
    onTerrainModified?: (position: THREE.Vector3) => void;
    onToolChange?: (tool: TerrainToolType) => void;
    onBrushChange?: (brush: TerrainBrush) => void;
  }): void {
    this.onTerrainModified = callbacks.onTerrainModified;
    this.onToolChange = callbacks.onToolChange;
    this.onBrushChange = callbacks.onBrushChange;
  }

  setTool(tool: TerrainToolType): void {
    this.currentTool = tool;
    
    if (this.brushIndicator) {
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      switch (tool) {
        case 'raise':
          material.color.setHex(0x00FF00);
          break;
        case 'lower':
          material.color.setHex(0xFF0000);
          break;
        case 'smooth':
          material.color.setHex(0x0088FF);
          break;
        case 'flatten':
          material.color.setHex(0xFFFF00);
          break;
        case 'paint':
          material.color.setHex(0xFF00FF);
          break;
      }
    }
    
    if (this.brushOutline) {
      const material = this.brushOutline.material as THREE.LineBasicMaterial;
      switch (tool) {
        case 'raise': material.color.setHex(0x00FF00); break;
        case 'lower': material.color.setHex(0xFF0000); break;
        case 'smooth': material.color.setHex(0x0088FF); break;
        case 'flatten': material.color.setHex(0xFFFF00); break;
        case 'paint': material.color.setHex(0xFF00FF); break;
      }
    }
    
    this.onToolChange?.(tool);
  }

  getTool(): TerrainToolType {
    return this.currentTool;
  }

  setBrushRadius(radius: number): void {
    this.config.brushRadius = Math.max(1, Math.min(50, radius));
    this.updateBrushIndicatorSize();
    this.onBrushChange?.({
      radius: this.config.brushRadius,
      strength: this.config.brushStrength,
      falloff: this.config.brushFalloff,
    });
  }

  setBrushStrength(strength: number): void {
    this.config.brushStrength = Math.max(0.01, Math.min(1, strength));
    this.onBrushChange?.({
      radius: this.config.brushRadius,
      strength: this.config.brushStrength,
      falloff: this.config.brushFalloff,
    });
  }

  setBrushFalloff(falloff: 'linear' | 'smooth' | 'constant'): void {
    this.config.brushFalloff = falloff;
    this.onBrushChange?.({
      radius: this.config.brushRadius,
      strength: this.config.brushStrength,
      falloff: this.config.brushFalloff,
    });
  }

  getBrush(): TerrainBrush {
    return {
      radius: this.config.brushRadius,
      strength: this.config.brushStrength,
      falloff: this.config.brushFalloff,
    };
  }

  enableEditing(): void {
    this.isEditing = true;
    if (this.brushIndicator) this.brushIndicator.visible = true;
    if (this.brushOutline) this.brushOutline.visible = true;
    this.setupEventListeners();
  }

  disableEditing(): void {
    this.isEditing = false;
    if (this.brushIndicator) this.brushIndicator.visible = false;
    if (this.brushOutline) this.brushOutline.visible = false;
    this.removeEventListeners();
  }

  private setupEventListeners(): void {
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleWheel = this.handleWheel.bind(this);
    
    window.addEventListener('mousemove', this.boundHandleMouseMove);
    window.addEventListener('mousedown', this.boundHandleMouseDown);
    window.addEventListener('mouseup', this.boundHandleMouseUp);
    window.addEventListener('keydown', this.boundHandleKeyDown);
    window.addEventListener('wheel', this.boundHandleWheel, { passive: false });
  }

  private removeEventListeners(): void {
    if (this.boundHandleMouseMove) {
      window.removeEventListener('mousemove', this.boundHandleMouseMove);
    }
    if (this.boundHandleMouseDown) {
      window.removeEventListener('mousedown', this.boundHandleMouseDown);
    }
    if (this.boundHandleMouseUp) {
      window.removeEventListener('mouseup', this.boundHandleMouseUp);
    }
    if (this.boundHandleKeyDown) {
      window.removeEventListener('keydown', this.boundHandleKeyDown);
    }
    if (this.boundHandleWheel) {
      window.removeEventListener('wheel', this.boundHandleWheel);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.terrain || !this.isEditing) return;
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.terrain);
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      
      if (this.brushIndicator) {
        this.brushIndicator.position.set(point.x, point.y + 0.1, point.z);
      }
      if (this.brushOutline) {
        this.brushOutline.position.set(point.x, point.y + 0.15, point.z);
      }
      
      if (this.isMouseDown) {
        this.applyBrush(point);
      }
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 0 && this.isEditing) {
      this.isMouseDown = true;
      this.saveUndoState();
      
      if (this.terrain) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.terrain);
        
        if (intersects.length > 0) {
          this.applyBrush(intersects[0].point);
        }
      }
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.isMouseDown = false;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEditing) return;
    
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.undo();
    } else if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      this.redo();
    } else if (event.key === '1') {
      this.setTool('raise');
    } else if (event.key === '2') {
      this.setTool('lower');
    } else if (event.key === '3') {
      this.setTool('smooth');
    } else if (event.key === '4') {
      this.setTool('flatten');
    } else if (event.key === '[') {
      this.setBrushRadius(this.config.brushRadius - 1);
    } else if (event.key === ']') {
      this.setBrushRadius(this.config.brushRadius + 1);
    }
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.isEditing || !event.shiftKey) return;
    
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? -0.5 : 0.5;
    this.setBrushRadius(this.config.brushRadius + delta);
  }

  private applyBrush(center: THREE.Vector3): void {
    if (!this.terrain) return;
    
    const geometry = this.terrain.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;
    
    if (!positions) return;
    
    const worldMatrix = this.terrain.matrixWorld;
    const inverseMatrix = new THREE.Matrix4().copy(worldMatrix).invert();
    
    const localCenter = center.clone().applyMatrix4(inverseMatrix);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      const dx = x - localCenter.x;
      const dz = z - localCenter.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < this.config.brushRadius) {
        const influence = this.calculateFalloff(distance);
        const strength = this.config.brushStrength * influence;
        
        let newY = y;
        
        switch (this.currentTool) {
          case 'raise':
            newY = y + strength;
            break;
          case 'lower':
            newY = y - strength;
            break;
          case 'smooth':
            const avgY = this.getAverageHeight(positions, i, 3);
            newY = y + (avgY - y) * strength * 0.5;
            break;
          case 'flatten':
            newY = y + (localCenter.y - y) * strength;
            break;
        }
        
        newY = Math.max(this.config.minHeight, Math.min(this.config.maxHeight, newY));
        positions.setY(i, newY);
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    
    this.onTerrainModified?.(center);
  }

  private calculateFalloff(distance: number): number {
    const normalizedDistance = distance / this.config.brushRadius;
    
    switch (this.config.brushFalloff) {
      case 'linear':
        return 1 - normalizedDistance;
      case 'smooth':
        const t = 1 - normalizedDistance;
        return t * t * (3 - 2 * t);
      case 'constant':
        return 1;
      default:
        return 1 - normalizedDistance;
    }
  }

  private getAverageHeight(
    positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    centerIndex: number,
    radius: number
  ): number {
    const centerX = positions.getX(centerIndex);
    const centerZ = positions.getZ(centerIndex);
    
    let totalY = 0;
    let count = 0;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2)
      );
      
      if (distance < radius) {
        totalY += positions.getY(i);
        count++;
      }
    }
    
    return count > 0 ? totalY / count : positions.getY(centerIndex);
  }

  private saveUndoState(): void {
    if (!this.terrain) return;
    
    const geometry = this.terrain.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;
    
    if (!positions) return;
    
    const positionsCopy = new Float32Array(positions.array.length);
    positionsCopy.set(positions.array as Float32Array);
    
    this.undoStack.push(positionsCopy);
    
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length < 2 || !this.terrain) return;
    
    const geometry = this.terrain.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;
    
    const currentState = new Float32Array(positions.array.length);
    currentState.set(positions.array as Float32Array);
    this.redoStack.push(currentState);
    
    this.undoStack.pop();
    const previousState = this.undoStack[this.undoStack.length - 1];
    
    positions.array.set(previousState);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  redo(): void {
    if (this.redoStack.length === 0 || !this.terrain) return;
    
    const nextState = this.redoStack.pop()!;
    
    const geometry = this.terrain.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;
    
    const currentState = new Float32Array(positions.array.length);
    currentState.set(positions.array as Float32Array);
    this.undoStack.push(currentState);
    
    positions.array.set(nextState);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getHeightAt(x: number, z: number): number {
    if (!this.terrain) return 0;
    
    const geometry = this.terrain.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;
    
    if (!positions) return 0;
    
    const worldMatrix = this.terrain.matrixWorld;
    const inverseMatrix = new THREE.Matrix4().copy(worldMatrix).invert();
    
    const localPoint = new THREE.Vector3(x, 0, z).applyMatrix4(inverseMatrix);
    
    let closestDistance = Infinity;
    let closestY = 0;
    
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);
      const distance = Math.sqrt(Math.pow(vx - localPoint.x, 2) + Math.pow(vz - localPoint.z, 2));
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestY = positions.getY(i);
      }
    }
    
    return closestY;
  }

  dispose(): void {
    this.disableEditing();
    
    if (this.brushIndicator) {
      this.brushIndicator.geometry.dispose();
      (this.brushIndicator.material as THREE.Material).dispose();
      this.scene.remove(this.brushIndicator);
    }
    
    if (this.brushOutline) {
      this.brushOutline.geometry.dispose();
      (this.brushOutline.material as THREE.Material).dispose();
      this.scene.remove(this.brushOutline);
    }
    
    this.undoStack = [];
    this.redoStack = [];
  }
}

export function createEditableTerrain(
  width: number = 100,
  height: number = 100,
  widthSegments: number = 64,
  heightSegments: number = 64
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
  geometry.rotateX(-Math.PI / 2);
  
  const material = new THREE.MeshStandardMaterial({
    color: 0x4a7c4e,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: false,
    wireframe: false,
  });
  
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  terrain.name = 'EditableTerrain';
  
  return terrain;
}

export function applyNoiseToTerrain(
  terrain: THREE.Mesh,
  scale: number = 0.05,
  amplitude: number = 5
): void {
  const geometry = terrain.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position;
  
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    
    const noise1 = Math.sin(x * scale) * Math.cos(z * scale);
    const noise2 = Math.sin(x * scale * 2) * Math.cos(z * scale * 2) * 0.5;
    const noise3 = Math.sin(x * scale * 4) * Math.cos(z * scale * 4) * 0.25;
    
    const y = (noise1 + noise2 + noise3) * amplitude;
    positions.setY(i, y);
  }
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}
