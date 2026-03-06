import * as THREE from 'three';

export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'none';

export interface TransformState {
  position: THREE.Vector3;
  rotation: number;
  scale: THREE.Vector3;
  isValid: boolean;
}

type TransformListener = (state: TransformState) => void;

export class TransformGizmo {
  private gizmoGroup: THREE.Group;
  private translateHandles: THREE.Group;
  private rotateHandle: THREE.Mesh;
  
  private mode: GizmoMode = 'none';
  private target: THREE.Object3D | null = null;
  private camera: THREE.Camera | null = null;
  private container: HTMLElement | null = null;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private plane: THREE.Plane;
  
  private isDragging = false;
  private dragAxis: 'x' | 'z' | 'xz' | 'rotate' | null = null;
  private dragStartPoint: THREE.Vector3 = new THREE.Vector3();
  private dragStartPosition: THREE.Vector3 = new THREE.Vector3();
  private dragStartRotation = 0;
  
  private gridSnap = 1;
  private rotationSnap = Math.PI / 8;
  
  private transformListeners: Set<TransformListener> = new Set();
  
  private xAxisMaterial: THREE.MeshBasicMaterial;
  private zAxisMaterial: THREE.MeshBasicMaterial;
  private centerMaterial: THREE.MeshBasicMaterial;
  private rotateMaterial: THREE.MeshBasicMaterial;
  
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    this.xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    this.zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x4444ff });
    this.centerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff44 });
    this.rotateMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x44ff44, 
      transparent: true, 
      opacity: 0.5 
    });
    
    this.gizmoGroup = new THREE.Group();
    this.gizmoGroup.visible = false;
    
    this.translateHandles = this.createTranslateHandles();
    this.rotateHandle = this.createRotateHandle();
    
    this.gizmoGroup.add(this.translateHandles);
    this.gizmoGroup.add(this.rotateHandle);
  }
  
  private createTranslateHandles(): THREE.Group {
    const group = new THREE.Group();
    
    const arrowLength = 1.5;
    const arrowRadius = 0.05;
    const coneHeight = 0.3;
    const coneRadius = 0.12;
    
    const xCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(arrowRadius, arrowRadius, arrowLength, 8),
      this.xAxisMaterial
    );
    xCylinder.rotation.z = -Math.PI / 2;
    xCylinder.position.x = arrowLength / 2;
    xCylinder.userData.axis = 'x';
    group.add(xCylinder);
    
    const xCone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 8),
      this.xAxisMaterial
    );
    xCone.rotation.z = -Math.PI / 2;
    xCone.position.x = arrowLength + coneHeight / 2;
    xCone.userData.axis = 'x';
    group.add(xCone);
    
    const zCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(arrowRadius, arrowRadius, arrowLength, 8),
      this.zAxisMaterial
    );
    zCylinder.rotation.x = Math.PI / 2;
    zCylinder.position.z = arrowLength / 2;
    zCylinder.userData.axis = 'z';
    group.add(zCylinder);
    
    const zCone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 8),
      this.zAxisMaterial
    );
    zCone.rotation.x = Math.PI / 2;
    zCone.position.z = arrowLength + coneHeight / 2;
    zCone.userData.axis = 'z';
    group.add(zCone);
    
    const centerBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.3),
      this.centerMaterial
    );
    centerBox.position.y = 0.05;
    centerBox.userData.axis = 'xz';
    group.add(centerBox);
    
    return group;
  }
  
  private createRotateHandle(): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(1.2, 0.05, 8, 32);
    const mesh = new THREE.Mesh(geometry, this.rotateMaterial);
    mesh.rotation.x = Math.PI / 2;
    mesh.userData.axis = 'rotate';
    return mesh;
  }
  
  getGizmoObject(): THREE.Group {
    return this.gizmoGroup;
  }
  
  initialize(camera: THREE.Camera, container: HTMLElement) {
    this.camera = camera;
    this.container = container;
    
    container.addEventListener('mousedown', this.handleMouseDown);
    container.addEventListener('mousemove', this.handleMouseMove);
    container.addEventListener('mouseup', this.handleMouseUp);
  }
  
  dispose() {
    if (this.container) {
      this.container.removeEventListener('mousedown', this.handleMouseDown);
      this.container.removeEventListener('mousemove', this.handleMouseMove);
      this.container.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    this.gizmoGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
  
  attach(target: THREE.Object3D) {
    this.target = target;
    this.gizmoGroup.visible = true;
    this.updateGizmoPosition();
  }
  
  detach() {
    this.target = null;
    this.gizmoGroup.visible = false;
  }
  
  setMode(mode: GizmoMode) {
    this.mode = mode;
    this.translateHandles.visible = mode === 'translate';
    this.rotateHandle.visible = mode === 'rotate';
  }
  
  setGridSnap(snap: number) {
    this.gridSnap = snap;
  }
  
  setRotationSnap(snap: number) {
    this.rotationSnap = snap;
  }
  
  onTransformChange(listener: TransformListener) {
    this.transformListeners.add(listener);
    return () => this.transformListeners.delete(listener);
  }
  
  update() {
    if (this.target && this.gizmoGroup.visible) {
      this.updateGizmoPosition();
    }
  }
  
  private updateGizmoPosition() {
    if (!this.target) return;
    this.gizmoGroup.position.copy(this.target.position);
  }
  
  private handleMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || !this.target || this.mode === 'none') return;
    
    const hit = this.raycastGizmo(event);
    if (!hit) return;
    
    this.isDragging = true;
    this.dragAxis = hit.axis;
    this.dragStartPosition.copy(this.target.position);
    this.dragStartRotation = this.target.rotation.y;
    
    const intersectPoint = this.getPlaneIntersection(event);
    if (intersectPoint) {
      this.dragStartPoint.copy(intersectPoint);
    }
    
    event.stopPropagation();
  };
  
  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isDragging || !this.target || !this.dragAxis) return;
    
    const intersectPoint = this.getPlaneIntersection(event);
    if (!intersectPoint) return;
    
    if (this.dragAxis === 'rotate') {
      const center = this.target.position.clone();
      center.y = 0;
      
      const startAngle = Math.atan2(
        this.dragStartPoint.x - center.x,
        this.dragStartPoint.z - center.z
      );
      const currentAngle = Math.atan2(
        intersectPoint.x - center.x,
        intersectPoint.z - center.z
      );
      
      let rotation = this.dragStartRotation + (currentAngle - startAngle);
      
      if (this.rotationSnap > 0) {
        rotation = Math.round(rotation / this.rotationSnap) * this.rotationSnap;
      }
      
      this.target.rotation.y = rotation;
    } else {
      const delta = intersectPoint.clone().sub(this.dragStartPoint);
      const newPosition = this.dragStartPosition.clone();
      
      if (this.dragAxis === 'x' || this.dragAxis === 'xz') {
        newPosition.x += delta.x;
      }
      if (this.dragAxis === 'z' || this.dragAxis === 'xz') {
        newPosition.z += delta.z;
      }
      
      if (this.gridSnap > 0) {
        newPosition.x = Math.round(newPosition.x / this.gridSnap) * this.gridSnap;
        newPosition.z = Math.round(newPosition.z / this.gridSnap) * this.gridSnap;
      }
      
      this.target.position.copy(newPosition);
    }
    
    this.updateGizmoPosition();
    this.notifyTransformChange();
  };
  
  private handleMouseUp = () => {
    if (this.isDragging) {
      this.notifyTransformChange();
    }
    this.isDragging = false;
    this.dragAxis = null;
  };
  
  private raycastGizmo(event: MouseEvent): { axis: 'x' | 'z' | 'xz' | 'rotate' } | null {
    if (!this.container || !this.camera) return null;
    
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const objects: THREE.Object3D[] = [];
    if (this.mode === 'translate') {
      this.translateHandles.traverse(obj => {
        if (obj instanceof THREE.Mesh) objects.push(obj);
      });
    } else if (this.mode === 'rotate') {
      objects.push(this.rotateHandle);
    }
    
    const intersects = this.raycaster.intersectObjects(objects, false);
    
    if (intersects.length > 0) {
      const axis = intersects[0].object.userData.axis;
      if (axis) return { axis };
    }
    
    return null;
  }
  
  private getPlaneIntersection(event: MouseEvent): THREE.Vector3 | null {
    if (!this.container || !this.camera) return null;
    
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, point);
    
    return point;
  }
  
  private notifyTransformChange() {
    if (!this.target) return;
    
    const state: TransformState = {
      position: this.target.position.clone(),
      rotation: this.target.rotation.y,
      scale: this.target.scale.clone(),
      isValid: true,
    };
    
    this.transformListeners.forEach(listener => listener(state));
  }
}
