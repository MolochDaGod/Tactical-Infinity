import * as THREE from 'three';

export interface Selectable {
  id: string;
  mesh: THREE.Object3D;
  type: 'unit' | 'building' | 'resource';
  data?: unknown;
}

export interface SelectionState {
  selected: Selectable[];
  hovered: Selectable | null;
}

export interface DragBoxState {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

type SelectionListener = (state: SelectionState) => void;
type DragBoxListener = (state: DragBoxState) => void;

export class SelectionManager {
  private selectables: Map<string, Selectable> = new Map();
  private selected: Set<string> = new Set();
  private hovered: Selectable | null = null;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera | null = null;
  private scene: THREE.Scene | null = null;
  private container: HTMLElement | null = null;
  
  private dragBox: DragBoxState = {
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  };
  
  private isDragging = false;
  private dragStartPos = { x: 0, y: 0 };
  private dragThreshold = 5;
  
  private selectionListeners: Set<SelectionListener> = new Set();
  private dragBoxListeners: Set<DragBoxListener> = new Set();
  
  private highlightMaterial: THREE.MeshBasicMaterial;
  private originalMaterials: Map<string, THREE.Material | THREE.Material[]> = new Map();
  
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.highlightMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x44ff44, 
      transparent: true, 
      opacity: 0.3,
      side: THREE.DoubleSide 
    });
  }
  
  initialize(camera: THREE.Camera, scene: THREE.Scene, container: HTMLElement) {
    this.camera = camera;
    this.scene = scene;
    this.container = container;
    
    container.addEventListener('mousedown', this.handleMouseDown);
    container.addEventListener('mousemove', this.handleMouseMove);
    container.addEventListener('mouseup', this.handleMouseUp);
    container.addEventListener('contextmenu', this.handleContextMenu);
  }
  
  dispose() {
    if (this.container) {
      this.container.removeEventListener('mousedown', this.handleMouseDown);
      this.container.removeEventListener('mousemove', this.handleMouseMove);
      this.container.removeEventListener('mouseup', this.handleMouseUp);
      this.container.removeEventListener('contextmenu', this.handleContextMenu);
    }
    this.selectables.clear();
    this.selected.clear();
    this.originalMaterials.clear();
  }
  
  registerSelectable(selectable: Selectable) {
    this.selectables.set(selectable.id, selectable);
    selectable.mesh.userData.selectableId = selectable.id;
  }
  
  unregisterSelectable(id: string) {
    this.selectables.delete(id);
    this.selected.delete(id);
    this.originalMaterials.delete(id);
  }
  
  onSelectionChange(listener: SelectionListener) {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }
  
  onDragBoxChange(listener: DragBoxListener) {
    this.dragBoxListeners.add(listener);
    return () => this.dragBoxListeners.delete(listener);
  }
  
  getSelection(): Selectable[] {
    return Array.from(this.selected).map(id => this.selectables.get(id)!).filter(Boolean);
  }
  
  select(id: string, additive = false) {
    if (!additive) {
      this.clearSelection();
    }
    this.selected.add(id);
    this.updateHighlights();
    this.notifySelectionChange();
  }
  
  deselect(id: string) {
    this.selected.delete(id);
    this.updateHighlights();
    this.notifySelectionChange();
  }
  
  toggleSelect(id: string) {
    if (this.selected.has(id)) {
      this.deselect(id);
    } else {
      this.select(id, true);
    }
  }
  
  clearSelection() {
    this.selected.clear();
    this.updateHighlights();
    this.notifySelectionChange();
  }
  
  selectAll() {
    this.selectables.forEach((_, id) => this.selected.add(id));
    this.updateHighlights();
    this.notifySelectionChange();
  }
  
  private handleMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    
    this.dragStartPos = { x: event.clientX, y: event.clientY };
    this.isDragging = false;
    
    const rect = this.container!.getBoundingClientRect();
    this.dragBox.startX = event.clientX - rect.left;
    this.dragBox.startY = event.clientY - rect.top;
    this.dragBox.endX = this.dragBox.startX;
    this.dragBox.endY = this.dragBox.startY;
  };
  
  private handleMouseMove = (event: MouseEvent) => {
    if (!this.container || !this.camera) return;
    
    const rect = this.container.getBoundingClientRect();
    
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (event.buttons === 1) {
      const dx = event.clientX - this.dragStartPos.x;
      const dy = event.clientY - this.dragStartPos.y;
      
      if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
        this.isDragging = true;
        this.dragBox.active = true;
      }
      
      if (this.isDragging) {
        this.dragBox.endX = event.clientX - rect.left;
        this.dragBox.endY = event.clientY - rect.top;
        this.notifyDragBoxChange();
      }
    } else {
      this.updateHover();
    }
  };
  
  private handleMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return;
    
    if (this.isDragging) {
      this.performBoxSelection(event.shiftKey);
      this.dragBox.active = false;
      this.notifyDragBoxChange();
    } else {
      this.performClickSelection(event.shiftKey);
    }
    
    this.isDragging = false;
  };
  
  private handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  
  private updateHover() {
    if (!this.camera || !this.scene) return;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.selectables.values()).map(s => s.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, true);
    
    let newHovered: Selectable | null = null;
    
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.selectableId) {
        obj = obj.parent as THREE.Object3D;
      }
      if (obj?.userData.selectableId) {
        newHovered = this.selectables.get(obj.userData.selectableId) || null;
      }
    }
    
    if (newHovered !== this.hovered) {
      this.hovered = newHovered;
      this.notifySelectionChange();
    }
  }
  
  private performClickSelection(additive: boolean) {
    if (!this.camera || !this.scene) return;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.selectables.values()).map(s => s.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, true);
    
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.selectableId) {
        obj = obj.parent as THREE.Object3D;
      }
      if (obj?.userData.selectableId) {
        if (additive) {
          this.toggleSelect(obj.userData.selectableId);
        } else {
          this.select(obj.userData.selectableId);
        }
        return;
      }
    }
    
    if (!additive) {
      this.clearSelection();
    }
  }
  
  private performBoxSelection(additive: boolean) {
    if (!this.camera || !this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    const minX = Math.min(this.dragBox.startX, this.dragBox.endX);
    const maxX = Math.max(this.dragBox.startX, this.dragBox.endX);
    const minY = Math.min(this.dragBox.startY, this.dragBox.endY);
    const maxY = Math.max(this.dragBox.startY, this.dragBox.endY);
    
    if (!additive) {
      this.clearSelection();
    }
    
    this.selectables.forEach((selectable, id) => {
      const screenPos = this.worldToScreen(selectable.mesh.position);
      if (screenPos) {
        const sx = screenPos.x * rect.width;
        const sy = screenPos.y * rect.height;
        
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          this.selected.add(id);
        }
      }
    });
    
    this.updateHighlights();
    this.notifySelectionChange();
  }
  
  private worldToScreen(position: THREE.Vector3): { x: number; y: number } | null {
    if (!this.camera) return null;
    
    const vector = position.clone().project(this.camera);
    
    if (vector.z > 1) return null;
    
    return {
      x: (vector.x + 1) / 2,
      y: (-vector.y + 1) / 2,
    };
  }
  
  private updateHighlights() {
    this.selectables.forEach((selectable, id) => {
      const isSelected = this.selected.has(id);
      
      if (isSelected) {
        this.applySelectionVisual(selectable.mesh);
      } else {
        this.removeSelectionVisual(selectable.mesh);
      }
    });
  }
  
  private applySelectionVisual(mesh: THREE.Object3D) {
    if (mesh.userData.selectionRing) return;
    
    const ringGeometry = new THREE.RingGeometry(0.8, 1, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x44ff44, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    ring.userData.isSelectionRing = true;
    mesh.add(ring);
    mesh.userData.selectionRing = ring;
  }
  
  private removeSelectionVisual(mesh: THREE.Object3D) {
    if (mesh.userData.selectionRing) {
      mesh.remove(mesh.userData.selectionRing);
      (mesh.userData.selectionRing as THREE.Mesh).geometry.dispose();
      ((mesh.userData.selectionRing as THREE.Mesh).material as THREE.Material).dispose();
      mesh.userData.selectionRing = undefined;
    }
  }
  
  private notifySelectionChange() {
    const state: SelectionState = {
      selected: this.getSelection(),
      hovered: this.hovered,
    };
    this.selectionListeners.forEach(listener => listener(state));
  }
  
  private notifyDragBoxChange() {
    this.dragBoxListeners.forEach(listener => listener({ ...this.dragBox }));
  }
}
