/**
 * IslandNavMesh — grid-based navigation mesh with A* pathfinding.
 * Samples terrain height from Three.js meshes, marks walkable cells,
 * and provides findPath() for NPC/agent navigation.
 */

import * as THREE from 'three';

export interface NavCell {
  x: number;
  z: number;
  worldX: number;
  worldZ: number;
  groundY: number;
  walkable: boolean;
}

interface AStarNode {
  cell: NavCell;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

export interface NavMeshConfig {
  resolution:     number;  // metres per grid cell (default 0.75)
  minWalkableY:   number;  // min ground Y to be walkable (above water)
  maxWalkableY:   number;  // max ground Y to be walkable (no cliff teleport)
  maxSlopeRad:    number;  // max slope in radians (default ~40°)
  agentRadius:    number;  // agent clearance radius for erosion
}

export const DEFAULT_NAV_CONFIG: NavMeshConfig = {
  resolution:   0.8,
  minWalkableY: 0.3,
  maxWalkableY: 40,
  maxSlopeRad:  0.72,   // ~41 degrees
  agentRadius:  0.5,
};

export class IslandNavMesh {
  private cells: Map<string, NavCell> = new Map();
  private config: NavMeshConfig;
  private bounds: THREE.Box3 | null = null;
  private raycaster = new THREE.Raycaster();

  // Grid index helpers
  private gridW = 0;
  private gridH = 0;
  private minGX = 0;
  private minGZ = 0;

  constructor(cfg: Partial<NavMeshConfig> = {}) {
    this.config = { ...DEFAULT_NAV_CONFIG, ...cfg };
  }

  // ── Build the navmesh from terrain meshes ──────────────────────────────────

  generate(terrainMeshes: THREE.Mesh[], islandBounds: THREE.Box3): void {
    this.cells.clear();
    this.bounds = islandBounds.clone();

    const { resolution, minWalkableY, maxWalkableY } = this.config;

    const minX = Math.floor(islandBounds.min.x / resolution);
    const maxX = Math.ceil(islandBounds.max.x  / resolution);
    const minZ = Math.floor(islandBounds.min.z / resolution);
    const maxZ = Math.ceil(islandBounds.max.z  / resolution);

    this.minGX = minX;
    this.minGZ = minZ;
    this.gridW = maxX - minX + 1;
    this.gridH = maxZ - minZ + 1;

    // Step 1 — Height sample every grid point
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gz = minZ; gz <= maxZ; gz++) {
        const wx = gx * resolution;
        const wz = gz * resolution;

        const groundY = this._sampleHeight(wx, wz, terrainMeshes);
        const walkable = groundY !== null && groundY > minWalkableY && groundY < maxWalkableY;

        const key = `${gx},${gz}`;
        this.cells.set(key, { x: gx, z: gz, worldX: wx, worldZ: wz, groundY: groundY ?? 0, walkable });
      }
    }

    // Step 2 — Slope check: discard cells with steep height difference vs neighbours
    for (const [key, cell] of this.cells) {
      if (!cell.walkable) continue;
      const neighbours = this._getNeighbours(cell.x, cell.z);
      for (const nb of neighbours) {
        if (!nb.walkable) continue;
        const dY   = Math.abs(cell.groundY - nb.groundY);
        const dist = resolution;
        const slope = Math.atan2(dY, dist);
        if (slope > this.config.maxSlopeRad) {
          cell.walkable = false;
          break;
        }
      }
    }

    // Step 3 — Erode walkable area by agent radius
    const erosionCells = Math.ceil(this.config.agentRadius / resolution);
    if (erosionCells > 0) {
      const toErode = new Set<string>();
      for (const [key, cell] of this.cells) {
        if (!cell.walkable) {
          // Mark neighbours as non-walkable
          for (let ex = -erosionCells; ex <= erosionCells; ex++) {
            for (let ez = -erosionCells; ez <= erosionCells; ez++) {
              const nk = `${cell.x + ex},${cell.z + ez}`;
              if (this.cells.has(nk)) toErode.add(nk);
            }
          }
        }
      }
      for (const k of toErode) {
        const c = this.cells.get(k);
        if (c) c.walkable = false;
      }
    }

    console.log(`[NavMesh] Generated ${this.cells.size} cells, ` +
      `${Array.from(this.cells.values()).filter(c => c.walkable).length} walkable`);
  }

  // ── A* pathfinding ─────────────────────────────────────────────────────────

  findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    const res = this.config.resolution;
    const startGX = Math.round(start.x / res);
    const startGZ = Math.round(start.z / res);
    const endGX   = Math.round(end.x   / res);
    const endGZ   = Math.round(end.z   / res);

    const startCell = this.cells.get(`${startGX},${startGZ}`);
    const endCell   = this.cells.get(`${endGX},${endGZ}`);

    if (!startCell || !endCell || !endCell.walkable) return [end];

    const open: AStarNode[] = [];
    const closed = new Set<string>();
    const nodeMap = new Map<string, AStarNode>();

    const h = (c: NavCell) =>
      Math.sqrt((c.x - endGX) ** 2 + (c.z - endGZ) ** 2);

    const startNode: AStarNode = { cell: startCell, g: 0, h: h(startCell), f: 0, parent: null };
    startNode.f = startNode.g + startNode.h;
    open.push(startNode);
    nodeMap.set(`${startGX},${startGZ}`, startNode);

    let iterations = 0;
    const MAX_ITER = 5000;

    while (open.length > 0 && iterations++ < MAX_ITER) {
      // Pop lowest f
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      const ck = `${current.cell.x},${current.cell.z}`;

      if (current.cell.x === endGX && current.cell.z === endGZ) {
        return this._reconstructPath(current);
      }

      closed.add(ck);

      for (const nb of this._getNeighbours(current.cell.x, current.cell.z)) {
        if (!nb.walkable) continue;
        const nk = `${nb.x},${nb.z}`;
        if (closed.has(nk)) continue;

        const isDiag = Math.abs(nb.x - current.cell.x) + Math.abs(nb.z - current.cell.z) === 2;
        const stepCost = isDiag ? 1.414 : 1.0;
        const gNew = current.g + stepCost;

        const existing = nodeMap.get(nk);
        if (!existing || gNew < existing.g) {
          const node: AStarNode = {
            cell: nb,
            g: gNew,
            h: h(nb),
            f: gNew + h(nb),
            parent: current,
          };
          nodeMap.set(nk, node);
          if (!existing) open.push(node);
        }
      }
    }

    // No path found — return straight line
    return [end];
  }

  // ── Get walkable cell nearest to world position ────────────────────────────

  getNearestWalkable(worldPos: THREE.Vector3): THREE.Vector3 | null {
    const res = this.config.resolution;
    const gx = Math.round(worldPos.x / res);
    const gz = Math.round(worldPos.z / res);

    for (let r = 0; r <= 5; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const cell = this.cells.get(`${gx + dx},${gz + dz}`);
          if (cell?.walkable) {
            return new THREE.Vector3(cell.worldX, cell.groundY, cell.worldZ);
          }
        }
      }
    }
    return null;
  }

  // ── Ground height at position ──────────────────────────────────────────────

  getGroundY(worldX: number, worldZ: number): number | null {
    const res = this.config.resolution;
    const gx  = Math.round(worldX / res);
    const gz  = Math.round(worldZ / res);
    return this.cells.get(`${gx},${gz}`)?.groundY ?? null;
  }

  // ── Debug visualization ────────────────────────────────────────────────────

  createDebugMesh(scene: THREE.Scene): THREE.InstancedMesh {
    const walkable = Array.from(this.cells.values()).filter(c => c.walkable);
    const geo = new THREE.PlaneGeometry(this.config.resolution * 0.8, this.config.resolution * 0.8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.35, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, walkable.length);

    const dummy = new THREE.Object3D();
    walkable.forEach((cell, i) => {
      dummy.position.set(cell.worldX, cell.groundY + 0.05, cell.worldZ);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _sampleHeight(wx: number, wz: number, meshes: THREE.Mesh[]): number | null {
    this.raycaster.set(
      new THREE.Vector3(wx, 200, wz),
      new THREE.Vector3(0, -1, 0)
    );
    const hits = this.raycaster.intersectObjects(meshes, true);
    return hits.length > 0 ? hits[0].point.y : null;
  }

  private _getNeighbours(gx: number, gz: number): NavCell[] {
    const result: NavCell[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const cell = this.cells.get(`${gx + dx},${gz + dz}`);
        if (cell) result.push(cell);
      }
    }
    return result;
  }

  private _reconstructPath(end: AStarNode): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    let node: AStarNode | null = end;
    while (node) {
      path.unshift(new THREE.Vector3(node.cell.worldX, node.cell.groundY, node.cell.worldZ));
      node = node.parent;
    }
    return this._smoothPath(path);
  }

  private _smoothPath(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;
    const smoothed: THREE.Vector3[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const prev = smoothed[smoothed.length - 1];
      const curr = path[i];
      const next = path[i + 1];
      // Skip redundant collinear points
      const d1 = new THREE.Vector2(curr.x - prev.x, curr.z - prev.z).normalize();
      const d2 = new THREE.Vector2(next.x - curr.x, next.z - curr.z).normalize();
      if (d1.dot(d2) < 0.99) smoothed.push(curr);
    }
    smoothed.push(path[path.length - 1]);
    return smoothed;
  }
}
