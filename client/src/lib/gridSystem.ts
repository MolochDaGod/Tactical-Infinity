import * as THREE from 'three';

/**
 * Universal Grid System for Tethical
 * Used across Ship Editor, Island Building, World Map positioning
 */

export interface GridConfig {
  cellSize: number;      // Size of each grid cell
  gridSize: number;      // Total grid dimensions (gridSize x gridSize cells)
  snapEnabled: boolean;  // Whether to snap positions to grid
  plane: 'xy' | 'xz' | 'yz';  // Which plane the grid is on
  offset: number;        // Offset along the perpendicular axis
  origin: THREE.Vector3; // World position of grid origin (center)
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  cellSize: 0.5,
  gridSize: 20,
  snapEnabled: true,
  plane: 'xz',
  offset: 0,
  origin: new THREE.Vector3(0, 0, 0),
};

/**
 * Snap a position to the nearest grid point
 */
export function snapToGrid(position: THREE.Vector3, config: GridConfig): THREE.Vector3 {
  if (!config.snapEnabled) return position.clone();
  
  const snapped = position.clone();
  const cellSize = config.cellSize;
  const origin = config.origin;
  
  // Snap relative to grid origin
  snapped.x = Math.round((position.x - origin.x) / cellSize) * cellSize + origin.x;
  snapped.y = Math.round((position.y - origin.y) / cellSize) * cellSize + origin.y;
  snapped.z = Math.round((position.z - origin.z) / cellSize) * cellSize + origin.z;
  
  // Lock the axis perpendicular to the grid plane
  switch (config.plane) {
    case 'xy':
      snapped.z = origin.z + config.offset;
      break;
    case 'xz':
      snapped.y = origin.y + config.offset;
      break;
    case 'yz':
      snapped.x = origin.x + config.offset;
      break;
  }
  
  return snapped;
}

/**
 * Convert world position to grid coordinates
 */
export function worldToGrid(position: THREE.Vector3, config: GridConfig): { x: number; y: number; z: number } {
  const origin = config.origin;
  const cellSize = config.cellSize;
  
  return {
    x: Math.round((position.x - origin.x) / cellSize),
    y: Math.round((position.y - origin.y) / cellSize),
    z: Math.round((position.z - origin.z) / cellSize),
  };
}

/**
 * Convert grid coordinates to world position
 */
export function gridToWorld(gridX: number, gridY: number, gridZ: number, config: GridConfig): THREE.Vector3 {
  const origin = config.origin;
  const cellSize = config.cellSize;
  
  return new THREE.Vector3(
    gridX * cellSize + origin.x,
    gridY * cellSize + origin.y,
    gridZ * cellSize + origin.z
  );
}

/**
 * Get the bounding box of a 3D object in world space
 */
export function getObjectBounds(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(object);
  return box;
}

/**
 * Get the center of an object's bounding box
 */
export function getObjectCenter(object: THREE.Object3D): THREE.Vector3 {
  const box = getObjectBounds(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

/**
 * Get the size of an object's bounding box
 */
export function getObjectSize(object: THREE.Object3D): THREE.Vector3 {
  const box = getObjectBounds(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size;
}

/**
 * Create a grid config centered on an object
 */
export function createGridForObject(
  object: THREE.Object3D,
  plane: 'xy' | 'xz' | 'yz' = 'xz',
  cellSize: number = 0.5,
  padding: number = 2
): GridConfig {
  const center = getObjectCenter(object);
  const size = getObjectSize(object);
  
  // Calculate grid size to cover the object with padding
  const maxDim = Math.max(size.x, size.y, size.z);
  const gridSize = Math.ceil((maxDim + padding * 2) / cellSize) * cellSize;
  
  // Calculate offset based on plane and object position
  let offset = 0;
  switch (plane) {
    case 'xy':
      offset = center.z;
      break;
    case 'xz':
      offset = center.y;
      break;
    case 'yz':
      offset = center.x;
      break;
  }
  
  return {
    cellSize,
    gridSize,
    snapEnabled: true,
    plane,
    offset,
    origin: center.clone(),
  };
}

/**
 * Create visual grid helper for Three.js scene
 */
export function createGridVisual(config: GridConfig): {
  gridHelper: THREE.GridHelper;
  plane: THREE.Mesh;
} {
  const gridDivisions = Math.round(config.gridSize / config.cellSize);
  
  // Create grid helper with color scheme
  const gridHelper = new THREE.GridHelper(
    config.gridSize,
    gridDivisions,
    0x00ff00,  // Main lines (green)
    0x004400   // Division lines (dark green)
  );
  
  // Create invisible plane for raycasting
  const planeGeometry = new THREE.PlaneGeometry(config.gridSize, config.gridSize);
  const planeMaterial = new THREE.MeshBasicMaterial({
    visible: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  
  // Position based on grid plane
  const origin = config.origin;
  
  switch (config.plane) {
    case 'xy':
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.position.set(origin.x, origin.y, origin.z + config.offset);
      plane.position.set(origin.x, origin.y, origin.z + config.offset);
      break;
    case 'xz':
      gridHelper.position.set(origin.x, origin.y + config.offset, origin.z);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(origin.x, origin.y + config.offset, origin.z);
      break;
    case 'yz':
      gridHelper.rotation.z = Math.PI / 2;
      gridHelper.position.set(origin.x + config.offset, origin.y, origin.z);
      plane.rotation.y = Math.PI / 2;
      plane.position.set(origin.x + config.offset, origin.y, origin.z);
      break;
  }
  
  return { gridHelper, plane };
}

/**
 * Format grid position as readable string
 */
export function formatGridPosition(position: THREE.Vector3, config: GridConfig): string {
  const grid = worldToGrid(position, config);
  return `(${grid.x}, ${grid.y}, ${grid.z})`;
}

/**
 * Format world position as readable string
 */
export function formatWorldPosition(position: THREE.Vector3): string {
  return `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`;
}

// ============================================
// Shared Three.js Object Utilities
// ============================================

/**
 * Traverse all meshes in an object and apply a callback
 * Consolidates the common pattern: object.traverse((child) => { if (isMesh) ... })
 */
export function traverseMeshes(
  object: THREE.Object3D,
  callback: (mesh: THREE.Mesh, material: THREE.Material | THREE.Material[]) => void
): void {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      callback(mesh, mesh.material);
    }
  });
}

/**
 * Set shadows on all meshes in an object
 */
export function setMeshShadows(
  object: THREE.Object3D,
  cast: boolean = true,
  receive: boolean = true
): void {
  traverseMeshes(object, (mesh) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
}

/**
 * Set material property on all meshes (for MeshStandardMaterial)
 */
export function setMeshMaterialProperty<K extends keyof THREE.MeshStandardMaterial>(
  object: THREE.Object3D,
  property: K,
  value: THREE.MeshStandardMaterial[K]
): void {
  traverseMeshes(object, (mesh, material) => {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((mat) => {
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        (mat as THREE.MeshStandardMaterial)[property] = value;
      }
    });
  });
}

/**
 * Clone materials on all meshes to prevent shared material modifications
 */
export function cloneMeshMaterials(object: THREE.Object3D): void {
  traverseMeshes(object, (mesh) => {
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
  });
}

/**
 * Set visibility preview effect on meshes (for building placement preview)
 */
export function setPreviewMaterial(
  object: THREE.Object3D,
  canPlace: boolean,
  opacity: number = 0.6
): void {
  const color = canPlace ? 0x44ff44 : 0xff4444;
  traverseMeshes(object, (mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const stdMat = mat as THREE.MeshStandardMaterial;
        stdMat.transparent = true;
        stdMat.opacity = opacity;
        stdMat.color.setHex(color);
      }
    });
  });
}
