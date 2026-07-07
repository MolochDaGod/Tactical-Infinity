/**
 * HarvestNodeSystem — mineable resource deposits for the canonical island.
 *
 * Each node is a real GLB mesh (a crystal-cluster scan for gem/mythril/gold
 * veins; a chunky boulder scan for stone/iron/copper), metric-normalized to
 * 1–3 m and tinted per ore type. Nodes have:
 *   • HP — chip away with each `mine()` hit
 *   • chip stages — the visual shrinks as HP drops so a node visibly depletes
 *   • drops — small glowing loot motes float up + fade when a node is emptied
 *   • respawn — depleted nodes come back on a timer at full HP/scale
 *
 * Placement points are supplied by `LandScatter` (mountain-biased) so this
 * module stays purely about node behaviour, not where they spawn.
 */
import * as THREE from 'three';
import type { IslandHeightmap } from './IslandHeightmap';
import type { HarvestSpecies } from './IslandConfig';
import { HARVEST_ASSETS, loadAsset, createTexturedOreMesh } from '@/lib/islandAssetLoader';
import { normalizeToMetricSize, METRIC_TARGETS } from './metricSizing';

/** Per-ore visual tint (clusters glow faintly with this colour too). */
const ORE_TINT: Record<HarvestSpecies, number> = {
  stone:   0x9a9a9a,
  iron:    0xa8b0bd,
  copper:  0xc8794a,
  gold:    0xe8c24a,
  mythril: 0x6fe0d2,
  crystal: 0xa07bff,
};

/** Hits required to deplete a node — rarer ores take longer to mine. */
const ORE_HP: Record<HarvestSpecies, number> = {
  stone: 3, iron: 4, copper: 4, gold: 5, mythril: 6, crystal: 5,
};

/** Which source mesh family an ore uses (crystalline vs rocky). */
function familyFor(t: HarvestSpecies): 'crystal' | 'boulder' {
  return t === 'crystal' || t === 'mythril' || t === 'gold' ? 'crystal' : 'boulder';
}

/**
 * A failed `loadAsset()` now resolves to an EMPTY THREE.Group (defensive guard
 * in islandAssetLoader) rather than rejecting — so a plain truthiness check is
 * always true and would silently produce invisible, un-mineable nodes. Treat a
 * group with no renderable mesh as a load failure so the procedural fallback
 * stays reachable.
 */
function hasRenderableMesh(obj: THREE.Object3D | null | undefined): boolean {
  if (!obj) return false;
  let found = false;
  obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) found = true; });
  return found;
}

export interface HarvestPlacement {
  x: number; y: number; z: number; slope: number; type: HarvestSpecies;
}

export interface MineResult {
  type: HarvestSpecies;
  hp: number;
  maxHp: number;
  depleted: boolean;
}

interface Node {
  /** Wrapper holds the visual at child[0]; we scale the visual for chip stages. */
  group: THREE.Group;
  visual: THREE.Object3D;
  type: HarvestSpecies;
  maxHp: number;
  hp: number;
  baseScale: number;
  /** Seconds until respawn (>0 only while depleted). */
  respawnIn: number;
  active: boolean;
}

interface Drop {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class HarvestNodeSystem {
  readonly group = new THREE.Group();
  private nodes: Node[] = [];
  private drops: Drop[] = [];
  /** Disposables WE created (cloned mats, fallback geom/mat, drop geom/mat). */
  private ownedGeoms: THREE.BufferGeometry[] = [];
  private ownedMats: THREE.Material[] = [];

  private constructor(private readonly hm: IslandHeightmap) {
    this.group.name = 'HarvestNodes';
  }

  get count(): number { return this.nodes.length; }

  static async create(
    hm: IslandHeightmap,
    placements: HarvestPlacement[],
    rng: () => number,
  ): Promise<HarvestNodeSystem> {
    const sys = new HarvestNodeSystem(hm);
    await sys.build(placements, rng);
    return sys;
  }

  private async build(placements: HarvestPlacement[], rng: () => number) {
    // Load the two source meshes once; clone per node.
    const [crystalProto, boulderProto] = await Promise.all([
      loadAsset(HARVEST_ASSETS.crystal),
      loadAsset(HARVEST_ASSETS.boulder),
    ]);
    const [mn, mx] = METRIC_TARGETS.crystal; // nodes span 1–3 m

    for (const p of placements) {
      const fam = familyFor(p.type);
      const candidate = fam === 'crystal' ? crystalProto : boulderProto;
      const proto = hasRenderableMesh(candidate) ? candidate : null;
      const targetM = mn + rng() * (mx - mn);
      let visual: THREE.Object3D;

      if (proto) {
        const clone = proto.clone(true) as THREE.Group;
        clone.traverse((c) => {
          const m = c as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          const src = m.material as THREE.Material | THREE.Material[];
          const base = Array.isArray(src) ? src[0] : src;
          const mat = (base as THREE.MeshStandardMaterial)?.clone?.() as THREE.MeshStandardMaterial | undefined;
          if (!mat) return;
          mat.color = new THREE.Color(ORE_TINT[p.type]);
          if ('metalness' in mat) mat.metalness = fam === 'crystal' ? 0.25 : 0.1;
          if ('roughness' in mat) mat.roughness = fam === 'crystal' ? 0.35 : 0.9;
          if (fam === 'crystal') {
            mat.emissive = new THREE.Color(ORE_TINT[p.type]);
            mat.emissiveIntensity = 0.3;
          }
          m.material = mat;
          this.ownedMats.push(mat);
        });
        normalizeToMetricSize(clone, targetM, fam === 'crystal' ? 'y' : 'max');
        visual = clone;
      } else {
        // GLB failed to load — fall back to the procedural ore cluster.
        const fallbackType = p.type === 'crystal' ? 'mythril' : p.type;
        const g = createTexturedOreMesh(fallbackType, 1.4 + rng() * 0.8);
        g.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            if (m.geometry) this.ownedGeoms.push(m.geometry);
            const mm = m.material;
            if (Array.isArray(mm)) mm.forEach((x) => this.ownedMats.push(x));
            else if (mm) this.ownedMats.push(mm);
          }
        });
        visual = g;
      }

      const wrapper = new THREE.Group();
      wrapper.add(visual);
      // Sink into steep ground so deposits read as part of the cliff.
      wrapper.position.set(p.x, p.y - p.slope * 0.4, p.z);
      wrapper.rotation.y = rng() * Math.PI * 2;
      this.group.add(wrapper);

      this.nodes.push({
        group: wrapper,
        visual,
        type: p.type,
        maxHp: ORE_HP[p.type],
        hp: ORE_HP[p.type],
        baseScale: visual.scale.x || 1,
        respawnIn: 0,
        active: true,
      });
    }
  }

  /**
   * Attempt to mine whatever active node the raycaster hits first. The caller
   * configures the raycaster (camera/pointer + `far` reach). Returns the mine
   * result, or null if nothing minable was hit.
   */
  mine(raycaster: THREE.Raycaster, power = 1): MineResult | null {
    const targets: THREE.Object3D[] = [];
    for (const n of this.nodes) if (n.active) targets.push(n.group);
    if (targets.length === 0) return null;
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return null;

    // Walk up to find the owning node wrapper.
    let obj: THREE.Object3D | null = hits[0].object;
    let node: Node | undefined;
    while (obj) {
      node = this.nodes.find((n) => n.group === obj);
      if (node) break;
      obj = obj.parent;
    }
    if (!node || !node.active) return null;

    node.hp = Math.max(0, node.hp - power);
    // Chip stage: shrink toward 50% as HP drains.
    const k = 0.5 + 0.5 * (node.hp / node.maxHp);
    node.visual.scale.setScalar(node.baseScale * k);

    if (node.hp <= 0) {
      node.active = false;
      node.respawnIn = 18 + Math.random() * 12;
      node.group.visible = false;
      this.spawnDrops(node);
      return { type: node.type, hp: 0, maxHp: node.maxHp, depleted: true };
    }
    return { type: node.type, hp: node.hp, maxHp: node.maxHp, depleted: false };
  }

  private spawnDrops(node: Node) {
    const pos = node.group.position;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const geo = new THREE.IcosahedronGeometry(0.18, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: ORE_TINT[node.type],
        emissive: ORE_TINT[node.type],
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.2,
        pos.y + 0.8 + Math.random() * 0.4,
        pos.z + (Math.random() - 0.5) * 1.2,
      );
      mesh.castShadow = false;
      this.group.add(mesh);
      this.ownedGeoms.push(geo);
      this.ownedMats.push(mat);
      this.drops.push({ mesh, life: 1.6, maxLife: 1.6 });
    }
  }

  update(dt: number, _elapsed: number) {
    // Respawn depleted nodes.
    for (const node of this.nodes) {
      if (node.active) continue;
      node.respawnIn -= dt;
      if (node.respawnIn <= 0) {
        node.active = true;
        node.hp = node.maxHp;
        node.visual.scale.setScalar(node.baseScale);
        node.group.visible = true;
      }
    }
    // Animate + retire floating drops.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.mesh.position.y += dt * 0.9;
      d.mesh.rotation.y += dt * 3;
      d.mesh.rotation.x += dt * 1.5;
      const t = Math.max(0, d.life / d.maxLife);
      (d.mesh.material as THREE.MeshStandardMaterial).opacity = t;
      if (d.life <= 0) {
        this.group.remove(d.mesh);
        this.drops.splice(i, 1);
      }
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const g of this.ownedGeoms) g.dispose();
    for (const m of this.ownedMats) m.dispose();
    this.ownedGeoms.length = 0;
    this.ownedMats.length = 0;
    this.nodes.length = 0;
    this.drops.length = 0;
  }
}
