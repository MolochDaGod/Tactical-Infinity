/**
 * Editor stylized asset factory — real Warlords CDN packs (never primitives-first).
 * Isolates meshName from multipacks; falls back to simple meshes only if CDN fails.
 *
 * HARD RULE: multi-mesh packs are NEVER placed whole.
 */

import * as THREE from 'three';
import {
  loadIsolatedMesh,
  loadRandomTree,
  loadRandomRock,
  loadRandomOre,
  loadRandomFlower,
  loadRandomPlant,
  loadAnimal,
} from '@/lib/islandAssetLoader';
import { STYLIZED as CDN, STYLIZED_VARIANTS } from '@/lib/warlordsNatureCDN';
import type { EditorNodeKind } from './islandSeedArchetypes';

export interface EditorAssetMeta {
  kind: EditorNodeKind;
  isHarvestable: boolean;
  profession?: 'woodcutting' | 'mining' | 'herbalism' | 'fishing' | 'skinning' | 'salvage';
  yieldId?: string;
  maxHp: number;
  respawnMs: number;
  /** Tool required in play mode (none = bare hands ok). */
  tool?: 'axe' | 'pickaxe' | 'knife' | 'rod' | 'none';
  label: string;
  source: 'cdn' | 'fallback';
}

const META: Record<string, Omit<EditorAssetMeta, 'kind' | 'source'>> = {
  palm_tree: { isHarvestable: true, profession: 'woodcutting', yieldId: 'wood', maxHp: 4, respawnMs: 90_000, tool: 'axe', label: 'Palm Tree' },
  pine_tree: { isHarvestable: true, profession: 'woodcutting', yieldId: 'wood', maxHp: 5, respawnMs: 100_000, tool: 'axe', label: 'Pine Tree' },
  dead_tree: { isHarvestable: true, profession: 'woodcutting', yieldId: 'wood', maxHp: 3, respawnMs: 70_000, tool: 'axe', label: 'Dead Tree' },
  rock: { isHarvestable: true, profession: 'mining', yieldId: 'stone', maxHp: 3, respawnMs: 80_000, tool: 'pickaxe', label: 'Rock' },
  ore_iron: { isHarvestable: true, profession: 'mining', yieldId: 'iron_ore', maxHp: 5, respawnMs: 120_000, tool: 'pickaxe', label: 'Iron Ore' },
  ore_gold: { isHarvestable: true, profession: 'mining', yieldId: 'gold_ore', maxHp: 6, respawnMs: 180_000, tool: 'pickaxe', label: 'Gold Ore' },
  ore_copper: { isHarvestable: true, profession: 'mining', yieldId: 'copper_ore', maxHp: 4, respawnMs: 110_000, tool: 'pickaxe', label: 'Copper Ore' },
  crystal: { isHarvestable: true, profession: 'mining', yieldId: 'crystal_shard', maxHp: 5, respawnMs: 150_000, tool: 'pickaxe', label: 'Crystal' },
  herb_bush: { isHarvestable: true, profession: 'herbalism', yieldId: 'herbs', maxHp: 2, respawnMs: 60_000, tool: 'knife', label: 'Herb Bush' },
  flowers: { isHarvestable: true, profession: 'herbalism', yieldId: 'cloth_fiber', maxHp: 2, respawnMs: 55_000, tool: 'knife', label: 'Flowers' },
  deer: { isHarvestable: true, profession: 'skinning', yieldId: 'hide', maxHp: 3, respawnMs: 140_000, tool: 'knife', label: 'Deer' },
  boar: { isHarvestable: true, profession: 'skinning', yieldId: 'meat', maxHp: 4, respawnMs: 140_000, tool: 'knife', label: 'Boar' },
  goldmine_node: { isHarvestable: true, profession: 'mining', yieldId: 'gold_ore', maxHp: 8, respawnMs: 240_000, tool: 'pickaxe', label: 'Gold Mine' },
  scrap: { isHarvestable: true, profession: 'salvage', yieldId: 'scrap_metal', maxHp: 3, respawnMs: 90_000, tool: 'none', label: 'Scrap' },
  fishing_spot: { isHarvestable: true, profession: 'fishing', yieldId: 'raw_fish', maxHp: 2, respawnMs: 45_000, tool: 'rod', label: 'Fishing Spot' },
  evil_mountain: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Evil Mountain' },
  cliff: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Cliff' },
  pve_camp: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'PvE Camp' },
  dock: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Dock' },
  flat_zone: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Flat Build Zone' },
  house: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'House' },
  tower: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Tower' },
  barracks: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Barracks' },
  forge: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Forge' },
  farm: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Farm' },
  warehouse: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Warehouse' },
  market: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Market' },
  wall: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Wall' },
  sawmill: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Sawmill' },
  campfire: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Campfire' },
  lantern: { isHarvestable: false, maxHp: 0, respawnMs: 0, tool: 'none', label: 'Lantern' },
};

function hasMesh(g: THREE.Object3D): boolean {
  let ok = false;
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) ok = true;
  });
  return ok;
}

function groundAndTag(
  root: THREE.Object3D | THREE.Group | null | undefined,
  kind: EditorNodeKind,
  source: 'cdn' | 'fallback',
  scale = 1,
): THREE.Group {
  // Always return a real THREE.Group — never GLTF wrapper / null
  let g: THREE.Group;
  if (root && (root as THREE.Object3D).isObject3D === true) {
    if ((root as THREE.Group).type === 'Group' || root instanceof THREE.Group) {
      g = root as THREE.Group;
    } else {
      g = new THREE.Group();
      g.add(root as THREE.Object3D);
    }
  } else {
    g = proceduralFallback(kind);
  }
  if (scale !== 1) g.scale.multiplyScalar(scale);
  const box = new THREE.Box3().setFromObject(g);
  if (isFinite(box.min.y)) g.position.y -= box.min.y;

  const m = META[kind] ?? {
    isHarvestable: false,
    maxHp: 0,
    respawnMs: 0,
    tool: 'none' as const,
    label: kind,
  };
  const meta: EditorAssetMeta = { kind, source, ...m };
  g.userData.isAsset = true;
  g.userData.assetType = kind;
  g.userData.editorMeta = meta;
  g.userData.isHarvestable = meta.isHarvestable;
  g.userData.harvestHp = meta.maxHp;
  g.userData.harvestMaxHp = meta.maxHp;
  g.userData.harvestRespawnMs = meta.respawnMs;
  g.userData.harvestYield = meta.yieldId;
  g.userData.harvestProfession = meta.profession;
  g.userData.harvestTool = meta.tool;
  g.userData.depleted = false;
  g.userData.respawnAt = 0;
  g.userData.baseScale = g.scale.x;

  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return g;
}

/** Simple fallback when CDN mesh isolation fails — never Meshy. */
function proceduralFallback(kind: EditorNodeKind): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x2d7a1a });
  const rock = new THREE.MeshLambertMaterial({ color: 0x7a7060 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3028 });

  if (kind.includes('tree') || kind === 'palm_tree' || kind === 'pine_tree' || kind === 'dead_tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.28, 4, 7), wood);
    trunk.position.y = 2;
    g.add(trunk);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 7), leaf);
    canopy.position.y = 4.2;
    g.add(canopy);
  } else if (kind.includes('ore') || kind === 'crystal' || kind === 'goldmine_node' || kind === 'rock') {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), kind === 'rock' ? rock : dark);
    b.position.y = 0.4;
    b.scale.y = 0.7;
    g.add(b);
    if (kind !== 'rock') {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshBasicMaterial({
          color: kind.includes('gold') ? 0xffcc00 : kind === 'crystal' ? 0x88ddff : 0xcc8844,
        }),
      );
      gem.position.y = 0.7;
      g.add(gem);
    }
  } else if (kind === 'evil_mountain') {
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(8, 16, 6), dark);
    mtn.position.y = 8;
    g.add(mtn);
    const cave = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 2),
      new THREE.MeshBasicMaterial({ color: 0x050508 }),
    );
    cave.position.set(0, 1.5, 6);
    g.add(cave);
  } else if (kind === 'cliff') {
    const c = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 2), rock);
    c.position.y = 3;
    g.add(c);
  } else if (kind === 'dock') {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 10), wood);
    pier.position.y = 0.15;
    g.add(pier);
  } else if (kind === 'flat_zone') {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 0.15, 24),
      new THREE.MeshLambertMaterial({ color: 0x8a7a55, transparent: true, opacity: 0.55 }),
    );
    pad.position.y = 0.08;
    g.add(pad);
  } else if (kind === 'fishing_spot') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.08, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0x44aaff }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    g.add(ring);
  } else if (kind === 'scrap') {
    for (let i = 0; i < 4; i++) {
      const bit = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.15, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x6a6a70 }),
      );
      bit.position.set((i - 1.5) * 0.35, 0.1, (i % 2) * 0.3);
      bit.rotation.y = i * 0.5;
      g.add(bit);
    }
  } else if (kind === 'pve_camp') {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 4), new THREE.MeshLambertMaterial({ color: 0x8b3a2a }));
    tent.position.y = 1.1;
    g.add(tent);
  } else if (kind === 'flowers' || kind === 'herb_bush') {
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), leaf);
      stem.position.set((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6);
      g.add(stem);
    }
  } else if (kind === 'deer' || kind === 'boar') {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.25, 0.5, 4, 6),
      new THREE.MeshLambertMaterial({ color: kind === 'deer' ? 0xa08060 : 0x6a4a3a }),
    );
    body.position.y = 0.45;
    body.rotation.z = Math.PI / 2;
    g.add(body);
  } else {
    // Generic building box
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4, 3, 4),
      new THREE.MeshLambertMaterial({ color: 0xa08050 }),
    );
    body.position.y = 1.5;
    g.add(body);
  }
  return g;
}

/**
 * Load a real stylized mesh for an editor node kind.
 * Prefer CDN multipack isolation; fall back to procedural only if empty.
 */
export async function createEditorAsset(
  kind: EditorNodeKind | string,
  opts?: { scale?: number },
): Promise<THREE.Group> {
  const k = kind as EditorNodeKind;
  const scale = opts?.scale ?? 1;
  let mesh: THREE.Group | null = null;

  try {
    switch (k) {
      case 'palm_tree':
        mesh = await loadIsolatedMesh(CDN.tropical, STYLIZED_VARIANTS.tropicalPalms, 1.0);
        if (!hasMesh(mesh)) mesh = await loadRandomTree('palm');
        break;
      case 'pine_tree':
        mesh = await loadIsolatedMesh(CDN.vegetation, STYLIZED_VARIANTS.vegetationPines, 1.05);
        if (!hasMesh(mesh)) mesh = await loadRandomTree('pine');
        break;
      case 'dead_tree':
        mesh = await loadIsolatedMesh(CDN.exampleIsland, STYLIZED_VARIANTS.exampleTrees, 0.95);
        if (!hasMesh(mesh)) mesh = await loadRandomTree('dead');
        break;
      case 'rock':
        mesh = await loadRandomRock();
        break;
      case 'ore_iron':
      case 'ore_gold':
      case 'ore_copper':
      case 'goldmine_node':
        mesh = await loadRandomOre(k);
        break;
      case 'crystal':
        mesh = await loadIsolatedMesh(CDN.minerals, STYLIZED_VARIANTS.minerals, 0.65);
        if (!hasMesh(mesh)) mesh = await loadRandomOre('crystal');
        break;
      case 'herb_bush':
        mesh = await loadRandomPlant();
        break;
      case 'flowers':
        mesh = await loadRandomFlower();
        break;
      case 'deer':
        mesh = await loadAnimal('deer');
        break;
      case 'boar':
        mesh = await loadAnimal('boar');
        break;
      case 'evil_mountain': {
        // rock_mountain_with_cave_realistic_85k.glb ≈ 79 MB — never block seed/editor
        // on a full download. Prefer procedural; optional timed CDN upgrade.
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();
        try {
          const gltf = await Promise.race([
            loader.loadAsync(CDN.mountainCave),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('evil_mountain CDN timeout 12s')), 12_000),
            ),
          ]);
          mesh = new THREE.Group();
          const root = gltf.scene.clone(true);
          // Normalize height: measure Y, scale so ~18–22 m tall mountain → mouth ~3 m
          const box = new THREE.Box3().setFromObject(root);
          const h = Math.max(0.01, box.max.y - box.min.y);
          const targetH = 22; // metres
          root.scale.setScalar(targetH / h);
          const box2 = new THREE.Box3().setFromObject(root);
          root.position.y = -box2.min.y;
          mesh.add(root);
          mesh.userData.evilMountain = true;
          mesh.userData.caveOpeningM = 3;
        } catch {
          mesh = null; // proceduralFallback below
        }
        break;
      }
      case 'cliff':
        mesh = await loadIsolatedMesh(CDN.cliff, ['Cliff', 'cliff', 'Rock', 'mesh'], 1.2);
        if (!hasMesh(mesh)) {
          mesh = await loadIsolatedMesh(CDN.rocks, STYLIZED_VARIANTS.stylizedRocks.slice(0, 6), 1.4);
        }
        break;
      case 'scrap':
        // Engineer scrap — use rocks70 small chunks + metal tint
        mesh = await loadIsolatedMesh(CDN.rocks70, STYLIZED_VARIANTS.rocks70Chunks, 0.45);
        if (hasMesh(mesh)) {
          mesh.traverse((c) => {
            const m = c as THREE.Mesh;
            if (!m.isMesh) return;
            const mat = (m.material as THREE.MeshStandardMaterial)?.clone?.();
            if (mat) {
              mat.color = new THREE.Color(0x6a7078);
              mat.metalness = 0.55;
              mat.roughness = 0.45;
              m.material = mat;
            }
          });
        }
        break;
      case 'fishing_spot':
        mesh = await loadIsolatedMesh(CDN.plants, STYLIZED_VARIANTS.greenPlants.slice(0, 4), 0.35);
        break;
      case 'flat_zone':
        mesh = proceduralFallback('flat_zone');
        return groundAndTag(mesh, k, 'fallback', scale);
      case 'pve_camp':
      case 'dock':
      case 'house':
      case 'tower':
      case 'barracks':
      case 'forge':
      case 'farm':
      case 'warehouse':
      case 'market':
      case 'wall':
      case 'sawmill':
      case 'campfire':
      case 'lantern':
        // Buildings keep lightweight procedural for now (no full building multipack in editor palette)
        mesh = proceduralFallback(k);
        return groundAndTag(mesh, k, 'fallback', scale);
      default:
        mesh = await loadRandomTree(String(k));
        break;
    }
  } catch (e) {
    console.warn(`[editorStylizedAssets] load failed for ${k}`, e);
    mesh = null;
  }

  if (!mesh || !hasMesh(mesh)) {
    mesh = proceduralFallback(k);
    return groundAndTag(mesh, k, 'fallback', scale);
  }
  return groundAndTag(mesh, k, 'cdn', scale);
}

/** Apply harvest chip / respawn visual. */
export function applyHarvestChip(mesh: THREE.Object3D, hp: number, maxHp: number): void {
  const t = Math.max(0.15, hp / Math.max(1, maxHp));
  const base = mesh.userData.baseScale ?? 1;
  mesh.scale.setScalar(base * (0.35 + t * 0.65));
}

export function setHarvestDepleted(mesh: THREE.Object3D, depleted: boolean): void {
  mesh.userData.depleted = depleted;
  mesh.visible = !depleted;
  if (!depleted) {
    mesh.userData.harvestHp = mesh.userData.harvestMaxHp ?? 1;
    const base = mesh.userData.baseScale ?? 1;
    mesh.scale.setScalar(base);
  }
}

/** Tick regrow for all harvestables in a list. */
export function tickHarvestRegrow(
  meshes: THREE.Object3D[],
  nowMs: number,
): void {
  for (const m of meshes) {
    if (!m.userData.isHarvestable) continue;
    if (m.userData.depleted && m.userData.respawnAt > 0 && nowMs >= m.userData.respawnAt) {
      setHarvestDepleted(m, false);
      m.userData.respawnAt = 0;
    }
  }
}
