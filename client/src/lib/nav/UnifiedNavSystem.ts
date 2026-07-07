/**
 * UnifiedNavSystem — multi-layer pathfinding for all game modes.
 *
 *   Layers
 *   ──────
 *     land   — walkable surfaces (slope ≤ walkableMax)
 *     water  — swimmable / sailable surfaces (y ≤ seaLevel)
 *     climb  — vertical surfaces (slope ≥ climbMin)
 *
 *   Each layer is its own three-pathfinding zone, queried independently.
 *   Adjacent cells of different layers become off-mesh links so a path
 *   can transition (water → shore-out → land → climb-up → land).
 *
 *   Used by:
 *     • IslandBattlePage (land enemies)
 *     • IslandExploreScene (hostile NPCs)
 *     • OpenWaterSailing  (NPC ship water nav, future)
 *     • ProductionIsland / BeachSpawnScene (replaces IslandNavMeshV2)
 */

import * as THREE from 'three';
import { Pathfinding } from 'three-pathfinding';
import {
  NavSurfaceClassifier,
  type NavLayerKind,
  type ClassifierConfig,
} from './NavSurfaceClassifier';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface UnifiedNavConfig {
  resolution: number;        // grid cell size in world units
  agentRadius: number;       // erosion margin around blocked cells
  rayHeight: number;         // raycast start altitude above terrain
  classifier?: Partial<ClassifierConfig>;
  enabledLayers?: NavLayerKind[];
}

export const DEFAULT_UNIFIED_NAV_CONFIG: UnifiedNavConfig = {
  resolution: 1.0,
  agentRadius: 0.5,
  rayHeight: 500,
  enabledLayers: ['land', 'water', 'climb'],
};

// ─── Internal types ──────────────────────────────────────────────────────────

interface RawCell {
  gx: number; gz: number; wx: number; wz: number;
  y: number;
  slope: number;
  layer: NavLayerKind | null;
  walkable: boolean;
}

interface OffMeshLink {
  from: THREE.Vector3;
  to: THREE.Vector3;
  fromLayer: NavLayerKind;
  toLayer: NavLayerKind;
  cost: number;
  type: string;
}

interface PathStep {
  position: THREE.Vector3;
  layer: NavLayerKind;
  isLink?: boolean;
  linkType?: string;
}

interface ZoneInfo {
  layer: NavLayerKind;
  cells: Map<string, RawCell>;
  ready: boolean;
  pathfinder: Pathfinding;
}

// ─── BakeInput ───────────────────────────────────────────────────────────────

export interface BakeInput {
  meshes: THREE.Mesh[];
  bounds: THREE.Box3;
  /** Optional explicit per-layer mesh hints (e.g. ocean plane → 'water'). */
  layerHints?: Map<THREE.Object3D, NavLayerKind>;
}

// ─── UnifiedNavSystem ────────────────────────────────────────────────────────

const ZONE_PREFIX = 'unified';

export class UnifiedNavSystem {
  config: UnifiedNavConfig;
  classifier: NavSurfaceClassifier;
  private zones = new Map<NavLayerKind, ZoneInfo>();
  private links: OffMeshLink[] = [];
  private raycaster = new THREE.Raycaster();
  private bakedAt = 0;

  constructor(cfg: Partial<UnifiedNavConfig> = {}) {
    this.config = { ...DEFAULT_UNIFIED_NAV_CONFIG, ...cfg };
    this.classifier = new NavSurfaceClassifier(cfg.classifier);
    const layers = this.config.enabledLayers ?? DEFAULT_UNIFIED_NAV_CONFIG.enabledLayers!;
    layers.forEach(layer => {
      this.zones.set(layer, {
        layer,
        cells: new Map(),
        ready: false,
        pathfinder: new Pathfinding(),
      });
    });
  }

  // ── 1. Bake ──────────────────────────────────────────────────────────────

  bake(input: BakeInput): void {
    const { meshes, bounds, layerHints } = input;
    const { resolution, rayHeight, agentRadius } = this.config;
    this.links = [];
    this.zones.forEach(z => { z.cells.clear(); z.ready = false; });

    const minX = Math.floor(bounds.min.x / resolution);
    const maxX = Math.ceil(bounds.max.x / resolution);
    const minZ = Math.floor(bounds.min.z / resolution);
    const maxZ = Math.ceil(bounds.max.z / resolution);

    // Step A — sample heights + classify
    const rawCells = new Map<string, RawCell>();
    const downDir = new THREE.Vector3(0, -1, 0);

    for (let gx = minX; gx <= maxX; gx++) {
      for (let gz = minZ; gz <= maxZ; gz++) {
        const wx = gx * resolution;
        const wz = gz * resolution;
        const sample = this._sampleSurface(wx, wz, meshes, rayHeight, downDir, layerHints);
        if (!sample) {
          rawCells.set(`${gx},${gz}`, {
            gx, gz, wx, wz, y: 0, slope: 0, layer: null, walkable: false,
          });
          continue;
        }
        const layer = sample.hintedLayer ?? this.classifier.classify({
          y: sample.y,
          slopeRad: sample.slope,
          normal: sample.normal,
        });
        rawCells.set(`${gx},${gz}`, {
          gx, gz, wx, wz,
          y: sample.y,
          slope: sample.slope,
          layer,
          walkable: layer != null,
        });
      }
    }

    // Step B — agent-radius erosion (only land+climb; water doesn't need it
    // because swimmers are smaller and don't snag on geometry edges)
    const erosion = Math.ceil(agentRadius / resolution);
    if (erosion > 0) {
      const toErode: string[] = [];
      rawCells.forEach((cell) => {
        if (cell.walkable) return;
        if (cell.layer === 'water') return;
        for (let ex = -erosion; ex <= erosion; ex++) {
          for (let ez = -erosion; ez <= erosion; ez++) {
            toErode.push(`${cell.gx + ex},${cell.gz + ez}`);
          }
        }
      });
      toErode.forEach(k => {
        const c = rawCells.get(k);
        if (c && c.layer !== 'water') c.walkable = false;
      });
    }

    // Step C — bucket into per-layer cell maps
    rawCells.forEach((cell, key) => {
      if (!cell.walkable || !cell.layer) return;
      const zone = this.zones.get(cell.layer);
      if (zone) zone.cells.set(key, cell);
    });

    // Step D — build per-layer triangle geometries + zones
    this.zones.forEach((zone, layer) => {
      const geo = this._buildZoneGeometry(rawCells, layer, minX, maxX, minZ, maxZ);
      if (geo.attributes.position.count < 3) return;
      const zoneId = `${ZONE_PREFIX}-${layer}`;
      const z = Pathfinding.createZone(geo, 1e-3);
      zone.pathfinder.setZoneData(zoneId, z);
      zone.ready = true;
    });

    // Step E — auto-detect off-mesh links at layer boundaries
    this._buildOffMeshLinks(rawCells);

    this.bakedAt = performance.now();
    const summary = Array.from(this.zones.entries())
      .map(([k, z]) => `${k}:${z.cells.size}c${z.ready ? '✓' : '·'}`).join(' ');
    console.log(`[UnifiedNav] baked → ${summary}, ${this.links.length} links`);
  }

  // ── 2. Path query ────────────────────────────────────────────────────────

  findPath(
    from: THREE.Vector3,
    to: THREE.Vector3,
    opts: { layer?: NavLayerKind; allowCrossLayer?: boolean } = {},
  ): PathStep[] {
    const fromLayer = opts.layer ?? this._nearestLayer(from);
    const toLayer = opts.layer ?? this._nearestLayer(to);
    if (!fromLayer || !toLayer) return [{ position: to.clone(), layer: 'land' }];

    if (fromLayer === toLayer) {
      const raw = this._zonePath(fromLayer, from, to);
      return raw.map(p => ({ position: p, layer: fromLayer }));
    }

    if (opts.allowCrossLayer === false) {
      const raw = this._zonePath(fromLayer, from, to);
      return raw.map(p => ({ position: p, layer: fromLayer }));
    }

    // Cross-layer: find the cheapest off-mesh link bridging fromLayer→toLayer.
    const link = this._findBestLink(from, to, fromLayer, toLayer);
    if (!link) {
      // Fallback: degenerate straight line
      return [{ position: to.clone(), layer: toLayer }];
    }

    const segA = this._zonePath(fromLayer, from, link.from);
    const segB = this._zonePath(toLayer, link.to, to);
    const out: PathStep[] = [];
    segA.forEach(p => out.push({ position: p, layer: fromLayer }));
    out.push({ position: link.to.clone(), layer: toLayer, isLink: true, linkType: link.type });
    segB.forEach(p => out.push({ position: p, layer: toLayer }));
    return out;
  }

  // ── 3. Clamp step (real-time confinement) ────────────────────────────────

  clampStep(
    from: THREE.Vector3,
    to: THREE.Vector3,
    layer: NavLayerKind,
    node: any,
  ): { position: THREE.Vector3; node: any } {
    const zone = this.zones.get(layer);
    if (!zone?.ready) return { position: to.clone(), node };
    const zoneId = `${ZONE_PREFIX}-${layer}`;
    const groupId = zone.pathfinder.getGroup(zoneId, from);
    if (groupId === null || groupId === undefined) return { position: to.clone(), node };
    const clamped = new THREE.Vector3();
    const newNode = zone.pathfinder.clampStep(from, to, node, zoneId, groupId as number, clamped);
    const gy = this.getGroundY(clamped.x, clamped.z, layer);
    if (gy != null) clamped.y = gy;
    return { position: clamped, node: newNode };
  }

  // ── 4. Surface lookups ───────────────────────────────────────────────────

  getGroundY(wx: number, wz: number, layer?: NavLayerKind): number | null {
    const res = this.config.resolution;
    const key = `${Math.round(wx / res)},${Math.round(wz / res)}`;
    if (layer) {
      return this.zones.get(layer)?.cells.get(key)?.y ?? null;
    }
    for (const zone of this.zones.values()) {
      const c = zone.cells.get(key);
      if (c) return c.y;
    }
    return null;
  }

  getNearestWalkable(pos: THREE.Vector3, layer: NavLayerKind, maxRing = 8): THREE.Vector3 | null {
    const zone = this.zones.get(layer);
    if (!zone) return null;
    const res = this.config.resolution;
    const gx0 = Math.round(pos.x / res);
    const gz0 = Math.round(pos.z / res);
    for (let r = 0; r <= maxRing; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const cell = zone.cells.get(`${gx0 + dx},${gz0 + dz}`);
          if (cell) return new THREE.Vector3(cell.wx, cell.y, cell.wz);
        }
      }
    }
    return null;
  }

  getRandomWalkable(layer: NavLayerKind): THREE.Vector3 | null {
    const zone = this.zones.get(layer);
    if (!zone?.ready || zone.cells.size === 0) return null;
    const arr = Array.from(zone.cells.values());
    const c = arr[Math.floor(Math.random() * arr.length)];
    return new THREE.Vector3(c.wx, c.y, c.wz);
  }

  isReady(layer?: NavLayerKind): boolean {
    if (layer) return this.zones.get(layer)?.ready ?? false;
    return Array.from(this.zones.values()).some(z => z.ready);
  }

  getLinks(): OffMeshLink[] { return this.links.slice(); }

  // ── 5. Debug helper ──────────────────────────────────────────────────────

  createDebugMesh(scene: THREE.Scene): THREE.Group {
    const group = new THREE.Group();
    group.name = 'UnifiedNavDebug';
    const colors: Record<NavLayerKind, number> = {
      land: 0x00ff66,
      water: 0x00aaff,
      climb: 0xffaa00,
    };
    const res = this.config.resolution;
    this.zones.forEach((zone, layer) => {
      if (zone.cells.size === 0) return;
      const geo = new THREE.PlaneGeometry(res * 0.85, res * 0.85);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[layer], transparent: true, opacity: 0.32, depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, zone.cells.size);
      const dummy = new THREE.Object3D();
      let i = 0;
      zone.cells.forEach(cell => {
        dummy.position.set(cell.wx, cell.y + 0.05, cell.wz);
        dummy.rotation.x = -Math.PI / 2;
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    });
    // Off-mesh links as bright vertical pillars
    if (this.links.length > 0) {
      const linkMat = new THREE.LineBasicMaterial({ color: 0xff00ff });
      const linkGeo = new THREE.BufferGeometry();
      const verts: number[] = [];
      this.links.forEach(l => {
        verts.push(l.from.x, l.from.y + 0.2, l.from.z);
        verts.push(l.to.x, l.to.y + 0.2, l.to.z);
      });
      linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const lines = new THREE.LineSegments(linkGeo, linkMat);
      group.add(lines);
    }
    scene.add(group);
    return group;
  }

  // ── 6. Disposal ──────────────────────────────────────────────────────────

  dispose(): void {
    this.zones.forEach(z => { z.cells.clear(); z.ready = false; });
    this.links = [];
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _sampleSurface(
    wx: number, wz: number, meshes: THREE.Mesh[],
    rayHeight: number, downDir: THREE.Vector3,
    hints?: Map<THREE.Object3D, NavLayerKind>,
  ): { y: number; slope: number; normal: THREE.Vector3; hintedLayer?: NavLayerKind } | null {
    this.raycaster.set(new THREE.Vector3(wx, rayHeight, wz), downDir);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const normal = hit.face?.normal
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);
    const slope = Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1));
    let hintedLayer: NavLayerKind | undefined;
    if (hints) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const h = hints.get(o);
        if (h) { hintedLayer = h; break; }
        o = o.parent;
      }
    }
    return { y: hit.point.y, slope, normal, hintedLayer };
  }

  private _buildZoneGeometry(
    rawCells: Map<string, RawCell>,
    layer: NavLayerKind,
    minX: number, maxX: number, minZ: number, maxZ: number,
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const get = (gx: number, gz: number) => rawCells.get(`${gx},${gz}`);
    const ok = (c?: RawCell) => !!c && c.walkable && c.layer === layer;

    for (let gx = minX; gx < maxX; gx++) {
      for (let gz = minZ; gz < maxZ; gz++) {
        const c00 = get(gx, gz);
        const c10 = get(gx + 1, gz);
        const c01 = get(gx, gz + 1);
        const c11 = get(gx + 1, gz + 1);
        if (!ok(c00) || !ok(c10) || !ok(c01) || !ok(c11)) continue;
        positions.push(c00!.wx, c00!.y, c00!.wz);
        positions.push(c10!.wx, c10!.y, c10!.wz);
        positions.push(c01!.wx, c01!.y, c01!.wz);
        positions.push(c10!.wx, c10!.y, c10!.wz);
        positions.push(c11!.wx, c11!.y, c11!.wz);
        positions.push(c01!.wx, c01!.y, c01!.wz);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }

  private _buildOffMeshLinks(rawCells: Map<string, RawCell>): void {
    const seen = new Set<string>();
    rawCells.forEach((cell) => {
      if (!cell.walkable || !cell.layer) return;
      for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]] as [number, number][]) {
        const nb = rawCells.get(`${cell.gx + dx},${cell.gz + dz}`);
        if (!nb?.walkable || !nb.layer) continue;
        if (nb.layer === cell.layer) continue;

        const key = `${cell.gx},${cell.gz}|${nb.gx},${nb.gz}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const from = new THREE.Vector3(cell.wx, cell.y, cell.wz);
        const to = new THREE.Vector3(nb.wx, nb.y, nb.wz);
        const yDelta = Math.abs(cell.y - nb.y);
        const cost = from.distanceTo(to) + yDelta * 1.5;
        const type = this.classifier.describeTransition(cell.layer, nb.layer);

        // Bidirectional pair
        this.links.push({ from, to: to.clone(), fromLayer: cell.layer, toLayer: nb.layer, cost, type });
        this.links.push({ from: to.clone(), to: from.clone(), fromLayer: nb.layer, toLayer: cell.layer, cost, type: this.classifier.describeTransition(nb.layer, cell.layer) });
      }
    });
  }

  private _zonePath(layer: NavLayerKind, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const zone = this.zones.get(layer);
    if (!zone?.ready) return [to.clone()];
    const zoneId = `${ZONE_PREFIX}-${layer}`;
    const groupId = zone.pathfinder.getGroup(zoneId, from);
    if (groupId === null || groupId === undefined) return [to.clone()];
    const raw = zone.pathfinder.findPath(from, to, zoneId, groupId as number);
    if (!raw || raw.length === 0) return [to.clone()];
    return raw.map(p => {
      const gy = this.getGroundY(p.x, p.z, layer);
      return new THREE.Vector3(p.x, gy ?? p.y, p.z);
    });
  }

  private _nearestLayer(pos: THREE.Vector3): NavLayerKind | null {
    let best: NavLayerKind | null = null;
    let bestDistSq = Infinity;
    this.zones.forEach((zone, layer) => {
      const near = this.getNearestWalkable(pos, layer, 4);
      if (!near) return;
      const d = near.distanceToSquared(pos);
      if (d < bestDistSq) { bestDistSq = d; best = layer; }
    });
    return best;
  }

  private _findBestLink(
    from: THREE.Vector3, to: THREE.Vector3,
    fromLayer: NavLayerKind, toLayer: NavLayerKind,
  ): OffMeshLink | null {
    let best: OffMeshLink | null = null;
    let bestScore = Infinity;
    for (const link of this.links) {
      if (link.fromLayer !== fromLayer || link.toLayer !== toLayer) continue;
      const score = from.distanceTo(link.from) + link.cost + link.to.distanceTo(to);
      if (score < bestScore) { bestScore = score; best = link; }
    }
    return best;
  }
}
