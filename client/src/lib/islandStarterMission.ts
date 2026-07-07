/**
 * IslandStarterMission
 *
 * "Build Your First Boat" — the player's opening quest on Waterfall Isle.
 *
 * Spawns:
 *   • 8 harvestable trees  (E to chop, 3 hits → 1–2 wood each)
 *   • 5 harvestable rocks  (E to mine, 2 hits → 1 stone each)
 *   • 4 hemp plants        (E to pick,  1 hit → 1 hemp each)
 *   • One wooden dock at the island's south-west water edge
 *
 * Recipe: 5 wood + 2 hemp + 1 stone → raft (raft.glb)
 *
 * Harvest mechanic: press E while within HARVEST_RANGE metres of a node.
 * The node shows a highlight ring when close enough.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HARVEST_TOOL_MAP, CHESTS } from '@/lib/assetRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HarvestableType = 'tree' | 'rock' | 'hemp';

export interface MissionResources {
  wood:  number;
  hemp:  number;
  stone: number;
}

export const RAFT_RECIPE: MissionResources = { wood: 5, hemp: 2, stone: 1 };

export interface HarvestNode {
  id:       string;
  mesh:     THREE.Group;
  ring:     THREE.Mesh;       // hover/range highlight ring
  type:     HarvestableType;
  health:   number;
  maxHealth: number;
  yield:    { resource: keyof MissionResources; amount: number };
  depleted: boolean;
  shakeTimer:        number;
  depletionElapsed:  number;  // > 0 while depletion shrink animation runs
  depletionDuration: number;
  startScale:        THREE.Vector3;
  startY:            number;
}

const HARVEST_RANGE = 4.0;    // metres
const HARVEST_COOLDOWN = 0.4; // seconds between hits

// ─── Main class ───────────────────────────────────────────────────────────────

export class IslandStarterMission {
  private scene:   THREE.Scene;
  private bounds:  THREE.Box3;
  private nodes:   HarvestNode[]   = [];
  private dock:    THREE.Group | null = null;
  private raft:    THREE.Group | null = null;

  private resources:  MissionResources = { wood: 0, hemp: 0, stone: 0 };
  private raftBuilt = false;

  private playerPos: THREE.Vector3 | null = null;
  private cooldownTimer = 0;

  private onResourceUpdate?: (r: MissionResources) => void;
  private onRaftBuilt?: () => void;
  private onHarvestEffect?: (pos: THREE.Vector3, type: HarvestableType) => void;
  private onNodeDepletedCb?: (id: string) => void;

  private _keyDown?: (e: KeyboardEvent) => void;

  // Optional reference to the player controller for hand-bone prop attachment.
  // Typed loosely so we don't create a circular dependency.
  private _ctrl: {
    attachToHandBone(prop: THREE.Object3D, offset?: THREE.Vector3, rotation?: THREE.Euler, scale?: number): void;
    detachFromHandBone(): void;
    isLoaded: boolean;
  } | null = null;
  private _fbxLoader = new FBXLoader();
  private _toolMesh: THREE.Group | null = null;

  // ── Construction ─────────────────────────────────────────────────────────

  constructor(scene: THREE.Scene, bounds: THREE.Box3) {
    this.scene  = scene;
    this.bounds = bounds;

    this._spawnNodes();
    this.dock = this._createDock();
    this.scene.add(this.dock);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setPlayerPosition(pos: THREE.Vector3): void { this.playerPos = pos; }

  /** Pass the Sketchbook controller so tool props can be parented to the hand bone. */
  setController(ctrl: typeof this._ctrl): void { this._ctrl = ctrl; }

  onUpdate(cb: (r: MissionResources) => void): void { this.onResourceUpdate = cb; }
  onComplete(cb: () => void): void { this.onRaftBuilt = cb; }
  /** Fired with a node id the moment it is harvested out, so external
   *  collision systems can drop its solid collider. */
  onNodeDepleted(cb: (id: string) => void): void { this.onNodeDepletedCb = cb; }

  /**
   * Solid collider specs for the mission's harvestable trees & rocks (hemp is
   * tiny/pickable, so it is left walk-through). Radii are kept well under
   * HARVEST_RANGE (4m) so nodes stay reachable for the E-to-harvest check.
   */
  getColliderSpecs(): Array<{ id: string; x: number; z: number; radius: number; yBase: number; height: number }> {
    return this.nodes
      .filter(n => !n.depleted && n.type !== 'hemp')
      .map(n => ({
        id: n.id,
        x: n.mesh.position.x,
        z: n.mesh.position.z,
        radius: n.type === 'tree' ? 0.55 : 0.75,
        yBase: this.bounds.min.y - 1,
        height: n.type === 'tree' ? 4.0 : 1.4,
      }));
  }
  onEffect(cb: (pos: THREE.Vector3, type: HarvestableType) => void): void {
    this.onHarvestEffect = cb;
  }

  getResources(): MissionResources { return { ...this.resources }; }
  isComplete(): boolean { return this.raftBuilt; }

  /** Must be called before setupInput so existing key handlers don't conflict. */
  setupInput(): void {
    this._keyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) this._tryHarvest();
    };
    window.addEventListener('keydown', this._keyDown);
  }

  /** Called every frame from BeachSpawnScene's animate loop. */
  update(dt: number): void {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    const pPos = this.playerPos;
    this.nodes.forEach((node) => {
      // Drive depletion shrink/sink animation
      if (node.depletionElapsed > 0) {
        node.depletionElapsed += dt;
        const t = Math.min(node.depletionElapsed / node.depletionDuration, 1);
        node.mesh.scale.lerpVectors(node.startScale, new THREE.Vector3(0.001, 0.001, 0.001), t);
        node.mesh.position.y = node.startY - t * 1.5;
        if (t >= 1) {
          this.scene.remove(node.mesh);
          node.depletionElapsed = -1; // mark done
        }
        return;
      }
      if (node.depleted) return;

      // Highlight ring: visible when player is in range
      const dist = pPos ? pPos.distanceTo(node.mesh.position) : Infinity;
      const inRange = dist < HARVEST_RANGE;
      node.ring.visible = inRange;

      // Shake animation on hit
      if (node.shakeTimer > 0) {
        node.shakeTimer -= dt;
        node.mesh.position.x += Math.sin(node.shakeTimer * 80) * 0.004;
        if (node.shakeTimer <= 0) {
          node.mesh.position.x = node.mesh.userData.baseX ?? node.mesh.position.x;
        }
      }
    });
  }

  /** Attempt to build the raft once recipe is satisfied. */
  buildRaft(): void {
    if (this.raftBuilt) return;
    if (!this._canBuild()) return;

    this.raftBuilt = true;
    this._loadRaftAtDock();
    this.onRaftBuilt?.();
  }

  dispose(): void {
    if (this._keyDown) window.removeEventListener('keydown', this._keyDown);
    this.nodes.forEach(n => this.scene.remove(n.mesh));
    if (this.dock) this.scene.remove(this.dock);
    if (this.raft) this.scene.remove(this.raft);
    this.nodes = [];
  }

  // ── Harvesting ────────────────────────────────────────────────────────────

  // ── Hand-bone tool attachment ─────────────────────────────────────────────

  /** Load the appropriate FBX tool and attach it to the controller's hand bone. */
  private _loadAndAttachTool(nodeType: HarvestableType): void {
    const ctrl = this._ctrl;
    if (!ctrl?.isLoaded) return;
    const path = HARVEST_TOOL_MAP[nodeType];
    if (!path) return;

    this._fbxLoader.load(
      path,
      (fbx) => {
        // Apply shared atlas texture if available
        fbx.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const mat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
            (c as THREE.Mesh).material = mat;
            (c as THREE.Mesh).castShadow = true;
          }
        });
        // Offsets tuned per tool type
        const offsets: Record<HarvestableType, [THREE.Vector3, THREE.Euler, number]> = {
          tree: [new THREE.Vector3(0, 0.06, 0.08), new THREE.Euler(-Math.PI / 2, 0, Math.PI / 4), 0.011],
          rock: [new THREE.Vector3(0, 0.04, 0.06), new THREE.Euler(-Math.PI / 2, 0, 0),           0.013],
          hemp: [new THREE.Vector3(0, 0.05, 0.1),  new THREE.Euler(-Math.PI / 2, 0, Math.PI / 6), 0.010],
        };
        const [offset, rotation, scale] = offsets[nodeType];
        this._toolMesh = fbx;
        ctrl.attachToHandBone(fbx, offset, rotation, scale);
      },
      undefined,
      (err) => console.warn('[IslandStarterMission] Tool FBX load error:', err),
    );
  }

  private _detachTool(): void {
    this._ctrl?.detachFromHandBone();
    this._toolMesh = null;
  }

  private _tryHarvest(): void {
    if (this.cooldownTimer > 0) return;
    const pPos = this.playerPos;
    if (!pPos) return;

    // Find nearest live node within range
    let nearest: HarvestNode | null = null;
    let nearDist = HARVEST_RANGE;

    this.nodes.forEach(node => {
      if (node.depleted) return;
      const d = pPos.distanceTo(node.mesh.position);
      if (d < nearDist) { nearDist = d; nearest = node; }
    });

    if (!nearest) return;
    this.cooldownTimer = HARVEST_COOLDOWN;

    const node = nearest as HarvestNode;

    // Attach the correct tool to the hand bone on first hit of this node type
    if (!this._toolMesh) this._loadAndAttachTool(node.type);

    node.health--;
    node.shakeTimer = 0.25;

    this.onHarvestEffect?.(node.mesh.position.clone(), node.type);

    if (node.health <= 0) {
      // Give resource
      const amount = node.yield.amount;
      this.resources[node.yield.resource] = Math.min(
        this.resources[node.yield.resource] + amount,
        RAFT_RECIPE[node.yield.resource]   // cap to recipe requirement for clarity
      );
      this.onResourceUpdate?.({ ...this.resources });
      this._depleteNode(node);
      // Detach tool 0.5s after depletion so the swing animation completes
      setTimeout(() => this._detachTool(), 500);
    }
  }

  private _depleteNode(node: HarvestNode): void {
    node.depleted = true;
    node.ring.visible = false;
    this.onNodeDepletedCb?.(node.id);
    // Record animation start state, then update() drives the tween
    node.startScale        = node.mesh.scale.clone();
    node.startY            = node.mesh.position.y;
    node.depletionElapsed  = 0.001; // small positive value starts the tween
    node.depletionDuration = 0.6;
  }

  // ── Resource node factories ────────────────────────────────────────────────

  private _spawnNodes(): void {
    const trees: Array<[number, number]> = [
      [ 8, -12], [-10,  -8], [ 15,   5], [-6,  14],
      [12,  10], [ -14,  2], [  5, -18], [-8, -20],
    ];
    const rocks: Array<[number, number]> = [
      [-16, -12], [18, -6], [-4, 20], [13, -18], [-18, 8],
    ];
    const hemp: Array<[number, number]> = [
      [6, 8], [-12, -18], [16, 15], [-5, -4],
    ];

    // We'll derive Y from island bounds mid-height + a small offset
    const midY = (this.bounds.max.y + this.bounds.min.y) / 2 + 2;

    trees.forEach(([x, z], i) => {
      const node = this._makeTree(i);
      node.mesh.position.set(x, midY, z);
      node.mesh.userData.baseX = x;
      this.scene.add(node.mesh);
      this.nodes.push(node);
    });

    rocks.forEach(([x, z], i) => {
      const node = this._makeRock(i);
      node.mesh.position.set(x, midY - 0.5, z);
      node.mesh.userData.baseX = x;
      this.scene.add(node.mesh);
      this.nodes.push(node);
    });

    hemp.forEach(([x, z], i) => {
      const node = this._makeHemp(i);
      node.mesh.position.set(x, midY - 0.2, z);
      node.mesh.userData.baseX = x;
      this.scene.add(node.mesh);
      this.nodes.push(node);
    });
  }

  private _highlightRing(r: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(r, r + 0.12, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffdd44, side: THREE.DoubleSide, transparent: true, opacity: 0.72,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.visible = false;
    return ring;
  }

  private _makeTree(idx: number): HarvestNode {
    const g = new THREE.Group();
    g.name = `harvest_tree_${idx}`;

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.25, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.95 })
    );
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    g.add(trunk);

    // Foliage (2 stacked spheres for low-poly feel)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d, roughness: 0.85 });
    const leafBot = new THREE.Mesh(new THREE.SphereGeometry(1.35, 7, 5), leafMat);
    leafBot.position.y = 2.7;
    leafBot.castShadow = true;
    g.add(leafBot);
    const leafTop = new THREE.Mesh(new THREE.SphereGeometry(0.9, 7, 5), leafMat);
    leafTop.position.y = 3.9;
    leafTop.castShadow = true;
    g.add(leafTop);

    const ring = this._highlightRing(1.6);
    g.add(ring);

    return {
      id: `tree_${idx}`, mesh: g, ring, type: 'tree',
      health: 3, maxHealth: 3,
      yield: { resource: 'wood', amount: 2 },
      depleted: false, shakeTimer: 0,
      depletionElapsed: 0, depletionDuration: 0.6,
      startScale: new THREE.Vector3(1, 1, 1), startY: 0,
    };
  }

  private _makeRock(idx: number): HarvestNode {
    const g = new THREE.Group();
    g.name = `harvest_rock_${idx}`;

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9, metalness: 0.05 });
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), rockMat);
    main.scale.set(1, 0.7, 1.1);
    main.position.y = 0.55;
    main.castShadow = true;
    g.add(main);

    const small = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), rockMat);
    small.position.set(0.7, 0.3, 0.3);
    small.rotation.y = 0.8;
    small.castShadow = true;
    g.add(small);

    const ring = this._highlightRing(1.2);
    g.add(ring);

    return {
      id: `rock_${idx}`, mesh: g, ring, type: 'rock',
      health: 2, maxHealth: 2,
      yield: { resource: 'stone', amount: 1 },
      depleted: false, shakeTimer: 0,
      depletionElapsed: 0, depletionDuration: 0.6,
      startScale: new THREE.Vector3(1, 1, 1), startY: 0,
    };
  }

  private _makeHemp(idx: number): HarvestNode {
    const g = new THREE.Group();
    g.name = `harvest_hemp_${idx}`;

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4db34d, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.8, side: THREE.DoubleSide });

    // Multiple stems
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.9 + i * 0.15, 5), stemMat);
      stem.position.set((i - 1) * 0.2, 0.45 + i * 0.07, (i % 2) * 0.15);
      stem.rotation.z = (Math.random() - 0.5) * 0.25;
      g.add(stem);

      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), leafMat);
      leaf.position.set((i - 1) * 0.2, 0.8 + i * 0.15, (i % 2) * 0.15);
      leaf.rotation.y = Math.random() * Math.PI;
      g.add(leaf);
    }

    // Purple flower head
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xaa66cc, roughness: 0.7 })
    );
    flower.position.set(0, 1.35, 0);
    g.add(flower);

    const ring = this._highlightRing(0.9);
    g.add(ring);

    return {
      id: `hemp_${idx}`, mesh: g, ring, type: 'hemp',
      health: 1, maxHealth: 1,
      yield: { resource: 'hemp', amount: 1 },
      depleted: false, shakeTimer: 0,
      depletionElapsed: 0, depletionDuration: 0.4,
      startScale: new THREE.Vector3(1, 1, 1), startY: 0,
    };
  }

  // ── Dock ─────────────────────────────────────────────────────────────────

  private _createDock(): THREE.Group {
    const dock = new THREE.Group();
    dock.name = 'starter_dock';

    const woodMat  = new THREE.MeshStandardMaterial({ color: 0x8b6340, roughness: 0.9 });
    const postMat  = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.95 });
    const PLANKS   = 7;
    const PLANK_W  = 1.4;
    const PLANK_T  = 0.12;
    const PLANK_L  = 2.2;

    // Dock extends in +Z direction (into water)
    for (let i = 0; i < PLANKS; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(PLANK_W, PLANK_T, PLANK_L),
        woodMat
      );
      plank.position.set(0, 0, i * (PLANK_L + 0.05));
      plank.receiveShadow = true;
      plank.castShadow    = true;
      dock.add(plank);
    }

    // Side rails
    const RAIL_LEN = PLANKS * (PLANK_L + 0.05);
    const railGeo = new THREE.BoxGeometry(0.08, 0.35, RAIL_LEN);
    [-0.68, 0.68].forEach(x => {
      const rail = new THREE.Mesh(railGeo, postMat);
      rail.position.set(x, 0.23, RAIL_LEN / 2 - PLANK_L / 2);
      rail.castShadow = true;
      dock.add(rail);
    });

    // Support posts beneath
    for (let i = 0; i < 4; i++) {
      const z = (i / 3) * (RAIL_LEN - PLANK_L);
      [-0.6, 0.6].forEach(x => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.0, 6), postMat);
        post.position.set(x, -1.0, z);
        post.castShadow = true;
        dock.add(post);
      });
    }

    // "BUILD HERE" marker — amber glow plane
    const markerGeo = new THREE.PlaneGeometry(1.2, PLANK_L * 1.5);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xffd700, side: THREE.DoubleSide, transparent: true, opacity: 0.25,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.name = 'raft_marker';
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0.08, RAIL_LEN * 0.65);
    dock.add(marker);

    // Place dock at island south-west edge
    const b = this.bounds;
    const cx = (b.min.x + b.max.x) / 2 - 8;
    const cz = b.max.z + 2;
    const cy = (b.min.y + b.max.y) / 2 - 1;
    dock.position.set(cx, cy, cz);

    return dock;
  }

  // ── Raft loading ──────────────────────────────────────────────────────────

  private _canBuild(): boolean {
    return (
      this.resources.wood  >= RAFT_RECIPE.wood &&
      this.resources.hemp  >= RAFT_RECIPE.hemp &&
      this.resources.stone >= RAFT_RECIPE.stone
    );
  }

  private _loadRaftAtDock(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/models/raft.glb',
      (gltf) => {
        const raft = gltf.scene;
        raft.name  = 'player_raft';
        raft.scale.setScalar(1.5);

        // Position raft at the end of the dock
        if (this.dock) {
          const dockEnd = new THREE.Vector3();
          this.dock.getWorldPosition(dockEnd);
          // Roughly at the tip of the dock (PLANKS * spacing ≈ 16 units in Z)
          raft.position.set(dockEnd.x, dockEnd.y + 0.1, dockEnd.z + 10);
        }

        raft.traverse(c => {
          if ((c as THREE.Mesh).isMesh) {
            (c as THREE.Mesh).castShadow = true;
            (c as THREE.Mesh).receiveShadow = true;
          }
        });

        // Gentle bob animation via userData
        raft.userData.bobOffset = 0;
        raft.userData.isRaft    = true;

        this.raft = raft;
        this.scene.add(raft);
        console.log('[StarterMission] Raft built and placed at dock!');

        // Also spawn a reward chest next to the dock marker
        this._spawnRewardChest();
      },
      undefined,
      (err) => console.warn('[StarterMission] Raft GLB load failed:', err)
    );
  }

  private _spawnRewardChest(): void {
    if (!this.dock) return;
    const dockPos = new THREE.Vector3();
    this.dock.getWorldPosition(dockPos);

    this._fbxLoader.load(
      CHESTS.trunk1,
      (fbx) => {
        fbx.scale.setScalar(0.018);
        fbx.position.set(dockPos.x + 2.5, dockPos.y + 0.05, dockPos.z + 2);
        fbx.rotation.y = Math.PI / 4;
        fbx.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            (c as THREE.Mesh).castShadow = true;
            (c as THREE.Mesh).receiveShadow = true;
          }
        });
        this.scene.add(fbx);

        // Floating amber glow above the chest to attract player attention
        const glowGeo  = new THREE.SphereGeometry(0.25, 8, 8);
        const glowMat  = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.6 });
        const glow     = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(dockPos.x + 2.5, dockPos.y + 2, dockPos.z + 2);
        this.scene.add(glow);
        console.log('[StarterMission] Reward chest placed at dock!');
      },
      undefined,
      (err) => console.warn('[StarterMission] Chest FBX load failed (non-fatal):', err),
    );
  }

  /** Call from render loop to animate the raft bob. */
  updateRaft(elapsed: number): void {
    if (!this.raft) return;
    this.raft.position.y += Math.sin(elapsed * 1.2) * 0.0015;
    this.raft.rotation.z  = Math.sin(elapsed * 0.8) * 0.015;
  }
}
