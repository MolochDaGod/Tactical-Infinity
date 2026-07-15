import * as THREE from 'three';
import { 
  buildableObjectsRegistry, 
  type PlaceableBuildingType, 
  type PlacedBuilding,
  type BuildingCost,
  placeableBuildingDefinitions 
} from './buildableObjectsRegistry';
import { 
  snapToGrid as gridSnapToGrid, 
  type GridConfig,
  setMeshShadows,
  setPreviewMaterial,
  cloneMeshMaterials
} from './gridSystem';
import { FarmLivestockManager, FARM_LIVESTOCK } from './farmLivestock';

export type BuildingMode = 'none' | 'build' | 'delete';

export interface GridCell {
  x: number;
  z: number;
  isOccupied: boolean;
  buildingId: string | null;
}

export interface PlayerResources {
  wood: number;
  stone: number;
  ore: number;
  gold: number;
  leather: number;
  fiber: number;
}

export interface BuildingSystemConfig {
  gridSize: number;
  gridExtent: number;
  groundLevel: number;
  levelHeight: number;
  maxLevels: number;
}

const DEFAULT_CONFIG: BuildingSystemConfig = {
  // 2 m grid cells; storey height clears 2.75 m doorways (+ lintel/plate).
  gridSize: 2.0,
  gridExtent: 80,
  groundLevel: 0,
  levelHeight: 3.2,
  maxLevels: 5
};

export class IslandBuildingSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private config: BuildingSystemConfig;
  
  private buildingMode: BuildingMode = 'none';
  private selectedBuildingType: PlaceableBuildingType = 'wall';
  private currentRotation: number = 0;
  private currentLevel: number = 0;
  
  private previewMesh: THREE.Group | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private occupiedCells: Set<string> = new Set();
  private cellToBuildingMap: Map<string, string> = new Map();
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private playerResources: PlayerResources;
  private placedBuildings: Map<string, PlacedBuilding> = new Map();
  
  private boundHandleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundHandleKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundHandleMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundHandleClick: ((e: MouseEvent) => void) | null = null;
  
  private keyStates: Record<string, boolean> = {};
  
  private onBuildingPlaced?: (building: PlacedBuilding) => void;
  private onBuildingRemoved?: (building: PlacedBuilding) => void;
  private onModeChange?: (mode: BuildingMode) => void;
  private onResourcesChanged?: (resources: PlayerResources) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    config: Partial<BuildingSystemConfig> = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.playerResources = {
      wood: 100,
      stone: 50,
      ore: 20,
      gold: 50,
      leather: 10,
      fiber: 20
    };
  }

  setCallbacks(callbacks: {
    onBuildingPlaced?: (building: PlacedBuilding) => void;
    onBuildingRemoved?: (building: PlacedBuilding) => void;
    onModeChange?: (mode: BuildingMode) => void;
    onResourcesChanged?: (resources: PlayerResources) => void;
  }): void {
    this.onBuildingPlaced = callbacks.onBuildingPlaced;
    this.onBuildingRemoved = callbacks.onBuildingRemoved;
    this.onModeChange = callbacks.onModeChange;
    this.onResourcesChanged = callbacks.onResourcesChanged;
  }

  setPlayerResources(resources: Partial<PlayerResources>): void {
    this.playerResources = { ...this.playerResources, ...resources };
    this.onResourcesChanged?.(this.playerResources);
  }

  addResources(resources: Partial<PlayerResources>): void {
    for (const [key, value] of Object.entries(resources)) {
      if (value && key in this.playerResources) {
        this.playerResources[key as keyof PlayerResources] += value;
      }
    }
    this.onResourcesChanged?.(this.playerResources);
  }

  getPlayerResources(): PlayerResources {
    return { ...this.playerResources };
  }

  initialize(): void {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);

    window.addEventListener('keydown', this.boundHandleKeyDown);
    window.addEventListener('keyup', this.boundHandleKeyUp);
    window.addEventListener('mousemove', this.boundHandleMouseMove);
    window.addEventListener('click', this.boundHandleClick);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.keyStates[e.code]) return;
    this.keyStates[e.code] = true;

    if (e.code === 'KeyB') {
      e.preventDefault();
      e.stopPropagation();
      this.toggleBuildingMode();
    }

    if (this.buildingMode !== 'none') {
      if (e.code === 'KeyR') {
        e.preventDefault();
        this.rotatePreview();
      }
      
      if (e.code === 'KeyX') {
        e.preventDefault();
        this.toggleBuildDeleteMode();
      }
      
      if (e.code === 'Escape') {
        e.preventDefault();
        this.exitBuildingMode();
      }

      if (e.code === 'BracketLeft') {
        e.preventDefault();
        this.changeLevel(-1);
      }
      
      if (e.code === 'BracketRight') {
        e.preventDefault();
        this.changeLevel(1);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keyStates[e.code] = false;
  }

  private handleMouseMove(e: MouseEvent): void {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (this.buildingMode === 'build') {
      this.updatePreview();
    }
  }

  private handleClick(e: MouseEvent): void {
    if (this.buildingMode === 'none') return;
    if (this.isCursorOverUI(e)) return;

    if (this.buildingMode === 'build') {
      this.attemptPlaceBuilding();
    } else if (this.buildingMode === 'delete') {
      this.attemptDeleteBuilding();
    }
  }

  private isCursorOverUI(e: MouseEvent): boolean {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return false;

    const uiSelectors = ['#buildHammerUI', '#buildingSelection', '.build-ui'];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      for (const selector of uiSelectors) {
        if (selector.startsWith('#') && current.id === selector.substring(1)) return true;
        if (selector.startsWith('.') && current.classList.contains(selector.substring(1))) return true;
      }
      current = current.parentElement;
    }
    
    return false;
  }

  toggleBuildingMode(): void {
    if (this.buildingMode === 'none') {
      this.enterBuildingMode();
    } else {
      this.exitBuildingMode();
    }
  }

  enterBuildingMode(): void {
    this.buildingMode = 'build';
    this.createGridHelper();
    this.createPreview();
    this.onModeChange?.(this.buildingMode);
  }

  exitBuildingMode(): void {
    this.buildingMode = 'none';
    this.removeGridHelper();
    this.removePreview();
    this.onModeChange?.(this.buildingMode);
  }

  toggleBuildDeleteMode(): void {
    if (this.buildingMode === 'build') {
      this.buildingMode = 'delete';
      this.removePreview();
    } else if (this.buildingMode === 'delete') {
      this.buildingMode = 'build';
      this.createPreview();
    }
    this.onModeChange?.(this.buildingMode);
  }

  setSelectedBuildingType(type: PlaceableBuildingType): void {
    this.selectedBuildingType = type;
    if (this.buildingMode === 'build') {
      this.removePreview();
      this.createPreview();
    }
  }

  rotatePreview(): void {
    this.currentRotation = (this.currentRotation + Math.PI / 2) % (Math.PI * 2);
    if (this.previewMesh) {
      this.previewMesh.rotation.y = this.currentRotation;
    }
  }

  changeLevel(delta: number): void {
    const newLevel = Math.max(0, Math.min(this.config.maxLevels - 1, this.currentLevel + delta));
    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      this.updateGridPosition();
    }
  }

  private createGridHelper(): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }

    const gridDivisions = Math.floor(this.config.gridExtent * 2 / this.config.gridSize);
    this.gridHelper = new THREE.GridHelper(
      this.config.gridExtent * 2,
      gridDivisions,
      0x00aaff,  // Brighter cyan color for visibility
      0x0088cc
    );
    this.gridHelper.position.y = this.config.groundLevel + (this.currentLevel * this.config.levelHeight) + 0.05;
    
    // Make grid render on top of terrain by disabling depth test
    const materials = Array.isArray(this.gridHelper.material) 
      ? this.gridHelper.material 
      : [this.gridHelper.material];
    
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.6;
      material.depthTest = false;  // Render on top of terrain
      material.depthWrite = false;
    });
    
    // Set render order to ensure grid draws after terrain
    this.gridHelper.renderOrder = 999;
    
    this.scene.add(this.gridHelper);
  }

  private removeGridHelper(): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper = null;
    }
  }

  private updateGridPosition(): void {
    if (this.gridHelper) {
      this.gridHelper.position.y = this.config.groundLevel + (this.currentLevel * this.config.levelHeight) + 0.01;
    }
  }

  private async createPreview(): Promise<void> {
    this.removePreview();

    const definition = placeableBuildingDefinitions[this.selectedBuildingType];
    this.previewMesh = await buildableObjectsRegistry.loadBuildingMesh(this.selectedBuildingType);
    
    // Use shared utilities for material setup
    cloneMeshMaterials(this.previewMesh);
    setMeshShadows(this.previewMesh, false, false);
    setPreviewMaterial(this.previewMesh, true, 0.6);

    this.previewMesh.rotation.y = this.currentRotation;
    this.scene.add(this.previewMesh);
  }

  private removePreview(): void {
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }
  }

  private updatePreview(): void {
    if (!this.previewMesh || this.buildingMode !== 'build') return;

    const gridPos = this.getGridPositionFromMouse();
    if (!gridPos) {
      this.previewMesh.visible = false;
      return;
    }

    this.previewMesh.position.copy(gridPos);
    this.previewMesh.visible = true;

    const canPlace = this.canPlaceBuilding(gridPos);
    const hasResources = this.hasRequiredResources(this.selectedBuildingType);

    // Use shared utility for preview material update
    setPreviewMaterial(this.previewMesh, canPlace && hasResources, canPlace && hasResources ? 0.6 : 0.5);
  }

  private getGridPositionFromMouse(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const levelY = this.config.groundLevel + (this.currentLevel * this.config.levelHeight);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -levelY);
    const intersectPoint = new THREE.Vector3();

    if (!this.raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
      return null;
    }

    return this.snapToGrid(intersectPoint);
  }

  private snapToGrid(position: THREE.Vector3): THREE.Vector3 {
    // Use centralized grid system with local building config
    const gridConfig: GridConfig = {
      cellSize: this.config.gridSize,
      gridSize: this.config.gridExtent * 2,
      snapEnabled: true,
      plane: 'xz',
      offset: this.config.groundLevel + (this.currentLevel * this.config.levelHeight),
      origin: new THREE.Vector3(0, 0, 0)
    };
    return gridSnapToGrid(position, gridConfig);
  }

  private getOccupiedCells(position: THREE.Vector3, rotation: number): string[] {
    const definition = placeableBuildingDefinitions[this.selectedBuildingType];
    const cells: string[] = [];
    
    const isRotated90 = Math.abs(rotation % Math.PI) > 0.1;
    const width = isRotated90 ? definition.cellSize.height : definition.cellSize.width;
    const height = isRotated90 ? definition.cellSize.width : definition.cellSize.height;

    const startX = position.x - ((width - 1) * this.config.gridSize) / 2;
    const startZ = position.z - ((height - 1) * this.config.gridSize) / 2;

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < height; z++) {
        const cellX = Math.round((startX + x * this.config.gridSize) / this.config.gridSize);
        const cellZ = Math.round((startZ + z * this.config.gridSize) / this.config.gridSize);
        cells.push(`${this.currentLevel}_${cellX}_${cellZ}`);
      }
    }

    return cells;
  }

  private canPlaceBuilding(position: THREE.Vector3): boolean {
    const cells = this.getOccupiedCells(position, this.currentRotation);
    return !cells.some(cell => this.occupiedCells.has(cell));
  }

  hasRequiredResources(type: PlaceableBuildingType): boolean {
    const cost = buildableObjectsRegistry.getCost(type);
    
    for (const [resource, amount] of Object.entries(cost)) {
      if (amount && this.playerResources[resource as keyof PlayerResources] < amount) {
        return false;
      }
    }
    
    return true;
  }

  private consumeResources(type: PlaceableBuildingType): void {
    const cost = buildableObjectsRegistry.getCost(type);
    
    for (const [resource, amount] of Object.entries(cost)) {
      if (amount) {
        this.playerResources[resource as keyof PlayerResources] -= amount;
      }
    }
    
    this.onResourcesChanged?.(this.playerResources);
  }

  private returnResources(type: PlaceableBuildingType): void {
    const cost = buildableObjectsRegistry.getCost(type);
    
    for (const [resource, amount] of Object.entries(cost)) {
      if (amount) {
        this.playerResources[resource as keyof PlayerResources] += Math.floor(amount / 2);
      }
    }
    
    this.onResourcesChanged?.(this.playerResources);
  }

  private async attemptPlaceBuilding(): Promise<void> {
    const position = this.getGridPositionFromMouse();
    if (!position) return;

    if (!this.canPlaceBuilding(position)) return;
    if (!this.hasRequiredResources(this.selectedBuildingType)) return;

    this.consumeResources(this.selectedBuildingType);

    const mesh = await buildableObjectsRegistry.loadBuildingMesh(this.selectedBuildingType);
    mesh.position.copy(position);
    mesh.rotation.y = this.currentRotation;
    
    const definition = placeableBuildingDefinitions[this.selectedBuildingType];
    
    const buildingId = `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cells = this.getOccupiedCells(position, this.currentRotation);
    
    cells.forEach(cell => {
      this.occupiedCells.add(cell);
      this.cellToBuildingMap.set(cell, buildingId);
    });

    mesh.userData = {
      buildingId,
      buildingType: this.selectedBuildingType,
      isPlacedBuilding: true
    };

    this.scene.add(mesh);

    const placedBuilding: PlacedBuilding = {
      id: buildingId,
      type: this.selectedBuildingType,
      position: position.clone(),
      rotation: this.currentRotation,
      mesh,
      cellsOccupied: cells,
      isConstructing: false,
      health: 100,
      maxHealth: 100
    };

    this.placedBuildings.set(buildingId, placedBuilding);
    buildableObjectsRegistry.registerPlacedBuilding(placedBuilding);

    // UF Farm: auto-seed livestock pens (Llama / Pig / Sheep) for raise loop
    if (this.selectedBuildingType === 'rts_farm') {
      void this.seedFarmLivestock(buildingId, position);
    }

    this.onBuildingPlaced?.(placedBuilding);

    this.playPlacementAnimation(mesh);
  }

  private livestockManager: FarmLivestockManager | null = null;

  /** Lazy-init farm animals manager for raise-at-farm gameplay. */
  getFarmLivestockManager(): FarmLivestockManager {
    if (!this.livestockManager) {
      this.livestockManager = new FarmLivestockManager(this.scene);
    }
    return this.livestockManager;
  }

  private async seedFarmLivestock(farmBuildingId: string, farmPos: THREE.Vector3): Promise<void> {
    try {
      const mgr = this.getFarmLivestockManager();
      const offsets = [
        new THREE.Vector3(2.5, 0, 1.5),
        new THREE.Vector3(-2.0, 0, 2.0),
        new THREE.Vector3(0.5, 0, -2.5),
      ];
      for (let i = 0; i < FARM_LIVESTOCK.length; i++) {
        const def = FARM_LIVESTOCK[i]!;
        const pos = farmPos.clone().add(offsets[i] ?? new THREE.Vector3(i * 2, 0, 0));
        await mgr.spawn(def.id, pos, farmBuildingId, Math.random() * Math.PI * 2);
      }
    } catch (e) {
      console.warn('[IslandBuild] farm livestock seed failed', e);
    }
  }

  private attemptDeleteBuilding(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const buildingMeshes = Array.from(this.placedBuildings.values()).map(b => b.mesh);
    const intersects = this.raycaster.intersectObjects(buildingMeshes, true);

    if (intersects.length === 0) return;

    let targetMesh = intersects[0].object;
    while (targetMesh.parent && !targetMesh.userData.isPlacedBuilding) {
      targetMesh = targetMesh.parent as THREE.Object3D;
    }

    const buildingId = targetMesh.userData.buildingId;
    if (!buildingId) return;

    const building = this.placedBuildings.get(buildingId);
    if (!building) return;

    this.returnResources(building.type);

    building.cellsOccupied.forEach(cell => {
      this.occupiedCells.delete(cell);
      this.cellToBuildingMap.delete(cell);
    });

    this.playDestructionAnimation(building.mesh, () => {
      this.scene.remove(building.mesh);
    });

    this.placedBuildings.delete(buildingId);
    buildableObjectsRegistry.removePlacedBuilding(buildingId);

    this.onBuildingRemoved?.(building);
  }

  private playPlacementAnimation(mesh: THREE.Group): void {
    const originalScale = mesh.scale.clone();
    const originalY = mesh.position.y;
    
    mesh.scale.setScalar(0.1);
    mesh.position.y = originalY + 2;

    const startTime = Date.now();
    const duration = 400;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const eased = 1 - Math.pow(1 - progress, 3);
      
      mesh.scale.lerpVectors(
        new THREE.Vector3(0.1, 0.1, 0.1),
        originalScale,
        eased
      );
      mesh.position.y = originalY + 2 * (1 - eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private playDestructionAnimation(mesh: THREE.Group, onComplete: () => void): void {
    const startTime = Date.now();
    const duration = 300;
    const originalScale = mesh.scale.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      mesh.scale.setScalar(originalScale.x * (1 - progress));
      mesh.position.y += 0.1;
      mesh.rotation.y += 0.1;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    animate();
  }

  getBuildingMode(): BuildingMode {
    return this.buildingMode;
  }

  getSelectedBuildingType(): PlaceableBuildingType {
    return this.selectedBuildingType;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getPlacedBuildings(): PlacedBuilding[] {
    return Array.from(this.placedBuildings.values());
  }

  update(deltaTime: number): void {
    this.livestockManager?.update(deltaTime);
  }

  dispose(): void {
    this.livestockManager?.dispose();
    this.livestockManager = null;
    if (this.boundHandleKeyDown) {
      window.removeEventListener('keydown', this.boundHandleKeyDown);
    }
    if (this.boundHandleKeyUp) {
      window.removeEventListener('keyup', this.boundHandleKeyUp);
    }
    if (this.boundHandleMouseMove) {
      window.removeEventListener('mousemove', this.boundHandleMouseMove);
    }
    if (this.boundHandleClick) {
      window.removeEventListener('click', this.boundHandleClick);
    }

    this.removeGridHelper();
    this.removePreview();
    
    Array.from(this.placedBuildings.values()).forEach((building) => {
      this.scene.remove(building.mesh);
    });
    this.placedBuildings.clear();
    this.occupiedCells.clear();
    this.cellToBuildingMap.clear();
  }
}
