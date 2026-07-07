/**
 * IslandNavMeshV2 — three-pathfinding backed navigation mesh.
 *
 * Workflow:
 *   1. Raycasts terrain meshes to find walkable cells (same as V1).
 *   2. Builds a BufferGeometry of triangles from adjacent walkable quads.
 *   3. Feeds that geometry to Pathfinding.createZone() from three-pathfinding.
 *   4. All path queries delegate to pathfinder.findPath() — much faster & accurate.
 *
 * Drop-in upgrade for IslandNavMesh — same public API.
 */

import * as THREE from 'three';
import { Pathfinding, PathfindingHelper } from 'three-pathfinding';

export interface NavMeshV2Config {
  resolution:   number;
  minWalkableY: number;
  maxWalkableY: number;
  maxSlopeRad:  number;
  agentRadius:  number;
}

export const DEFAULT_NAV_V2_CONFIG: NavMeshV2Config = {
  resolution:   0.8,
  minWalkableY: 0.3,
  maxWalkableY: 40,
  maxSlopeRad:  0.72,
  agentRadius:  0.5,
};

interface WalkableCell {
  gx: number;
  gz: number;
  wx: number;
  wz: number;
  gy: number;
}

const ZONE_ID = 'island';

export class IslandNavMeshV2 {
  private config: NavMeshV2Config;
  private pathfinder = new Pathfinding();
  private helper: PathfindingHelper | null = null;
  private cells = new Map<string, WalkableCell>();
  private raycaster = new THREE.Raycaster();
  private ready = false;

  constructor(cfg: Partial<NavMeshV2Config> = {}) {
    this.config = { ...DEFAULT_NAV_V2_CONFIG, ...cfg };
  }

  // ── 1. Build navmesh from terrain ─────────────────────────────────────────

  generate(terrainMeshes: THREE.Mesh[], islandBounds: THREE.Box3): void {
    this.cells.clear();
    this.ready = false;

    const { resolution, minWalkableY, maxWalkableY, maxSlopeRad, agentRadius } = this.config;

    const minX = Math.floor(islandBounds.min.x / resolution);
    const maxX = Math.ceil(islandBounds.max.x  / resolution);
    const minZ = Math.floor(islandBounds.min.z / resolution);
    const maxZ = Math.ceil(islandBounds.max.z  / resolution);

    // Step A — height sample every grid point
    const rawCells = new Map<string, WalkableCell & { walkable: boolean }>();
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gz = minZ; gz <= maxZ; gz++) {
        const wx = gx * resolution;
        const wz = gz * resolution;
        const gy = this._sampleHeight(wx, wz, terrainMeshes);
        const walkable = gy !== null && gy > minWalkableY && gy < maxWalkableY;
        rawCells.set(`${gx},${gz}`, { gx, gz, wx, wz, gy: gy ?? 0, walkable });
      }
    }

    // Step B — slope culling
    rawCells.forEach((cell) => {
      if (!cell.walkable) return;
      for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
        const nb = rawCells.get(`${cell.gx+dx},${cell.gz+dz}`);
        if (!nb?.walkable) continue;
        const slope = Math.atan2(Math.abs(cell.gy - nb.gy), resolution);
        if (slope > maxSlopeRad) { cell.walkable = false; break; }
      }
    });

    // Step C — erode by agent radius
    const erosion = Math.ceil(agentRadius / resolution);
    if (erosion > 0) {
      const toErode: string[] = [];
      rawCells.forEach((cell) => {
        if (cell.walkable) return;
        for (let ex = -erosion; ex <= erosion; ex++) {
          for (let ez = -erosion; ez <= erosion; ez++) {
            toErode.push(`${cell.gx+ex},${cell.gz+ez}`);
          }
        }
      });
      toErode.forEach(k => {
        const c = rawCells.get(k);
        if (c) c.walkable = false;
      });
    }

    // Collect walkable cells
    rawCells.forEach((cell, k) => {
      if (cell.walkable) this.cells.set(k, { gx: cell.gx, gz: cell.gz, wx: cell.wx, wz: cell.wz, gy: cell.gy });
    });

    // Step D — build triangle geometry from walkable quads
    const geo = this._buildNavGeometry(rawCells, minX, maxX, minZ, maxZ);

    if (geo.attributes.position.count < 3) {
      console.warn('[NavMeshV2] Not enough walkable triangles — keeping old pathfinder');
      return;
    }

    // Step E — create zone with three-pathfinding
    const zone = Pathfinding.createZone(geo, 1e-3);
    this.pathfinder.setZoneData(ZONE_ID, zone);
    this.ready = true;

    console.log(`[NavMeshV2] Built zone with ${this.cells.size} walkable cells, ${geo.attributes.position.count / 3} triangles`);
  }

  // ── 2. Path query ──────────────────────────────────────────────────────────

  findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    if (!this.ready) return [end];

    const groupId = this.pathfinder.getGroup(ZONE_ID, start);
    if (groupId === null || groupId === undefined) return [end];

    const raw = this.pathfinder.findPath(start, end, ZONE_ID, groupId as number);
    if (!raw || raw.length === 0) return [end];

    // Ensure Y coordinates are grounded
    return raw.map(p => {
      const gy = this.getGroundY(p.x, p.z);
      return new THREE.Vector3(p.x, gy ?? p.y, p.z);
    });
  }

  // ── 3. Clamp step (for real-time character confinement) ───────────────────

  clampStep(from: THREE.Vector3, to: THREE.Vector3, node: any): { position: THREE.Vector3; node: any } {
    if (!this.ready) return { position: to, node };
    const groupId = this.pathfinder.getGroup(ZONE_ID, from);
    const clamped = new THREE.Vector3();
    const newNode = this.pathfinder.clampStep(from, to, node, ZONE_ID, groupId as number, clamped);
    const gy = this.getGroundY(clamped.x, clamped.z);
    clamped.y = gy ?? clamped.y;
    return { position: clamped, node: newNode };
  }

  // ── 4. Nearest walkable position ──────────────────────────────────────────

  getNearestWalkable(worldPos: THREE.Vector3): THREE.Vector3 | null {
    const res = this.config.resolution;
    const gx0 = Math.round(worldPos.x / res);
    const gz0 = Math.round(worldPos.z / res);
    for (let r = 0; r <= 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const cell = this.cells.get(`${gx0+dx},${gz0+dz}`);
          if (cell) return new THREE.Vector3(cell.wx, cell.gy, cell.wz);
        }
      }
    }
    return null;
  }

  // ── 5. Ground height at world XZ ──────────────────────────────────────────

  getGroundY(wx: number, wz: number): number | null {
    const res = this.config.resolution;
    const cell = this.cells.get(`${Math.round(wx/res)},${Math.round(wz/res)}`);
    return cell?.gy ?? null;
  }

  // ── 6. Random walkable position (for NPC spawning) ────────────────────────

  getRandomWalkable(): THREE.Vector3 | null {
    if (!this.ready) return null;
    const groupId = 0;
    const node = this.pathfinder.getRandomNode(ZONE_ID, groupId, new THREE.Vector3(), 0);
    if (!node) return null;
    const gy = this.getGroundY((node as any).x, (node as any).z);
    return new THREE.Vector3((node as any).x, gy ?? 0, (node as any).z);
  }

  get isReady() { return this.ready; }

  // ── 7. Debug helpers ──────────────────────────────────────────────────────

  createDebugMesh(scene: THREE.Scene): THREE.InstancedMesh {
    const walkable = Array.from(this.cells.values());
    const res = this.config.resolution;
    const geo = new THREE.PlaneGeometry(res * 0.8, res * 0.8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, walkable.length);
    const dummy = new THREE.Object3D();
    walkable.forEach((cell, i) => {
      dummy.position.set(cell.wx, cell.gy + 0.05, cell.wz);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  }

  attachPathHelper(scene: THREE.Scene): PathfindingHelper {
    this.helper = new PathfindingHelper();
    scene.add(this.helper as unknown as THREE.Object3D);
    return this.helper;
  }

  visualizePath(path: THREE.Vector3[], start: THREE.Vector3, end: THREE.Vector3): void {
    if (!this.helper) return;
    this.helper.reset();
    this.helper.setPlayerPosition(start);
    this.helper.setTargetPosition(end);
    this.helper.setPath(path);
  }

  // ── Private: build triangle geometry from walkable quad grid ─────────────

  private _buildNavGeometry(
    rawCells: Map<string, WalkableCell & { walkable: boolean }>,
    minX: number, maxX: number, minZ: number, maxZ: number
  ): THREE.BufferGeometry {
    const positions: number[] = [];

    const get = (gx: number, gz: number) => rawCells.get(`${gx},${gz}`);

    for (let gx = minX; gx < maxX; gx++) {
      for (let gz = minZ; gz < maxZ; gz++) {
        const c00 = get(gx,   gz);
        const c10 = get(gx+1, gz);
        const c01 = get(gx,   gz+1);
        const c11 = get(gx+1, gz+1);

        if (!c00?.walkable || !c10?.walkable || !c01?.walkable || !c11?.walkable) continue;

        // Triangle 1: (00, 10, 01)
        positions.push(c00.wx, c00.gy, c00.wz);
        positions.push(c10.wx, c10.gy, c10.wz);
        positions.push(c01.wx, c01.gy, c01.wz);

        // Triangle 2: (10, 11, 01)
        positions.push(c10.wx, c10.gy, c10.wz);
        positions.push(c11.wx, c11.gy, c11.wz);
        positions.push(c01.wx, c01.gy, c01.wz);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }

  private _sampleHeight(wx: number, wz: number, meshes: THREE.Mesh[]): number | null {
    this.raycaster.set(new THREE.Vector3(wx, 200, wz), new THREE.Vector3(0, -1, 0));
    const hits = this.raycaster.intersectObjects(meshes, true);
    return hits.length > 0 ? hits[0].point.y : null;
  }
}
