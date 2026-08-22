/**
 * /island?entry=arctic|dwarf — mountain fortress shell, tundra textures, harvest, nav.
 * Extends ProductionIsland like chickenGunDockIsland. Not a second island page.
 */
import * as THREE from 'three';
import { loadGltfProduction } from '@/lib/threeProductionLoader';
import type { TerrainData } from '@/lib/islandHeightmapTerrain';
import type { DockData } from '@/lib/islandDockSystem';
import { createDock } from '@/lib/islandDockSystem';
import { mountDeckStations, mountDeckSlotGrid } from '@/lib/deckPlacement';
import { getDeckLoadout } from '@/lib/playerProgression';
import { bakeHeightmapFromMeshes, heightmapToTerrainData } from '@/lib/islandRapierGround';
import { loadBoatTemplate } from '@/lib/boatAssetLoader';
import { stampWorldLocation } from '@/lib/chickenGunDockIsland';
import { prepareFleetParts } from '@/lib/prepareFleetParts';
import { markCabinEntry, stampBoatNavLabels } from '@/lib/boatNavLabels';
import {
  DWARF_HARVEST,
  DWARF_ISLAND_CDN,
  DWARF_ISLAND_SI,
  DWARF_ISLAND_URL,
  dwarfIslandUuid,
  dwarfMeshRole,
  type DwarfIslandSkin,
} from '@shared/gameDefinitions/dwarfIslandKit';
import { CABIN_WORLD_Y } from '@/lib/captainsQuartersInstance';

export interface KeepInteriorHandle {
  group: THREE.Group;
  door: THREE.Object3D;
  standInside: THREE.Vector3;
  standOutside: THREE.Vector3;
  floorY: number;
  interiorUuid: string;
}

export interface DwarfArcticScene {
  group: THREE.Group;
  terrain: TerrainData;
  dock: DockData;
  island: THREE.Group;
  walkMeshes: THREE.Mesh[];
  skin: DwarfIslandSkin;
  camps: Array<{ faction: 'crusade' | 'fabled' | 'legion'; position: THREE.Vector3 }>;
  keepInterior: KeepInteriorHandle | null;
}

const TUNDRA = '/textures/ground/tundra';

async function loadTex(url: string): Promise<THREE.Texture | null> {
  try {
    const t = await new THREE.TextureLoader().loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  } catch {
    return null;
  }
}

async function paintFortress(root: THREE.Object3D, skin: DwarfIslandSkin): Promise<void> {
  const rock = await loadTex(`${TUNDRA}/rock_diff.jpg`);
  const snow = await loadTex(`${TUNDRA}/layer4_diff.jpg`);
  const grass = await loadTex(`${TUNDRA}/grass_diff.jpg`);
  const rockN = await loadTex(`${TUNDRA}/rock_nor.jpg`);
  const snowN = await loadTex(`${TUNDRA}/layer4_nor.jpg`);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const matName = ((m.material as THREE.Material)?.name || '').toLowerCase();
    const role = dwarfMeshRole(m.name) || dwarfMeshRole(m.parent?.name || '');
    const isTerrain = role === 'terrain' || matName.includes('material.00');
    const map = isTerrain ? (skin === 'arctic' ? snow : grass) : rock;
    const nrm = isTerrain ? snowN : rockN;
    const color = skin === 'arctic' && isTerrain ? 0xe8f0f8 : isTerrain ? 0x6a7a5a : 0x8a8680;
    const prev = m.material as THREE.MeshStandardMaterial;
    m.material = new THREE.MeshStandardMaterial({
      color,
      map: map ?? prev?.map ?? null,
      normalMap: nrm ?? prev?.normalMap ?? null,
      roughness: 0.92,
      metalness: role === 'keep' ? 0.08 : 0.02,
    });
  });
}

function labelRoles(root: THREE.Object3D): THREE.Mesh[] {
  const walk: THREE.Mesh[] = [];
  root.traverse((o) => {
    const role = dwarfMeshRole(o.name);
    o.userData.islandRole = role;
    if (role === 'ignore') {
      o.visible = false;
      return;
    }
    if (o.name) stampWorldLocation(o, dwarfIslandUuid(o.name));
    const m = o as THREE.Mesh;
    if (m.isMesh && (role === 'terrain' || role === 'keep')) walk.push(m);
  });
  return walk;
}

function buildKeepInterior(keepBox: THREE.Box3, parent: THREE.Group): KeepInteriorHandle {
  const cx = (keepBox.min.x + keepBox.max.x) * 0.5;
  const cz = (keepBox.min.z + keepBox.max.z) * 0.5;
  const span = keepBox.getSize(new THREE.Vector3());
  const w = THREE.MathUtils.clamp(span.x - 1.2, 3.2, 8);
  const l = THREE.MathUtils.clamp(span.z - 1.2, 3.2, 6);
  const h = 2.6;
  const g = new THREE.Group();
  g.name = 'keep_interior';
  const interiorUuid = dwarfIslandUuid('keep#interior');
  stampWorldLocation(g, interiorUuid);

  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.88 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, l), floorMat);
  floor.position.y = 0.06;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), wallMat);
  ceil.position.y = h;
  g.add(ceil);
  const t = 0.12;
  const walls: Array<[number, number, number, number, number, number]> = [
    [0, h / 2, l / 2 - t / 2, w, h, t],
    [0, h / 2, -l / 2 + t / 2, w, h, t],
    [w / 2 - t / 2, h / 2, 0, t, h, l],
    [-w / 2 + t / 2, h / 2, 0, t, h, l],
  ];
  for (const [x, y, z, sx, sy, sz] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMat);
    m.position.set(x, y, z);
    g.add(m);
  }
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), wood);
  table.position.set(0, 0.78, 0.2);
  g.add(table);
  g.position.set(cx, CABIN_WORLD_Y, cz);
  parent.add(g);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.1, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0x224466, emissiveIntensity: 0.35 }),
  );
  door.name = 'keep_door';
  door.userData.cabinEntry = true;
  stampWorldLocation(door, dwarfIslandUuid('keep_door'));
  door.position.set(cx, keepBox.min.y + 1.05, keepBox.max.z + 0.2);
  parent.add(door);

  return {
    group: g,
    door,
    standInside: new THREE.Vector3(cx, CABIN_WORLD_Y + 0.2, cz - l * 0.25),
    standOutside: new THREE.Vector3(cx, keepBox.min.y + 0.15, keepBox.max.z + 1.4),
    floorY: CABIN_WORLD_Y + 0.12,
    interiorUuid,
  };
}

function scatterHarvest(
  parent: THREE.Group,
  skin: DwarfIslandSkin,
  box: THREE.Box3,
  heightAt: (x: number, z: number) => number,
): void {
  const size = box.getSize(new THREE.Vector3());
  const min = box.min;
  let i = 0;
  for (const row of DWARF_HARVEST[skin]) {
    for (let n = 0; n < row.count; n++) {
      const g = new THREE.Mesh(
        new THREE.DodecahedronGeometry(row.ident.includes('ore') ? 0.45 : 0.55, 0),
        new THREE.MeshStandardMaterial({
          color: row.ident.includes('gold') ? 0xc4a035 : row.ident.includes('iron') ? 0x5a5a62 : 0x6e6a64,
          roughness: 0.9,
        }),
      );
      const t = (i * 1.618) % 1;
      const u = (i * 2.414) % 1;
      const x = min.x + 4 + t * Math.max(4, size.x - 8);
      const z = min.z + 4 + u * Math.max(4, size.z - 8);
      g.position.set(x, heightAt(x, z) + 0.35, z);
      g.userData.ident = row.ident;
      g.userData.harvestYield = row.yield;
      g.name = `harvest_${row.ident}_${n}`;
      stampWorldLocation(g, dwarfIslandUuid(g.name));
      g.castShadow = true;
      parent.add(g);
      i++;
    }
  }
}

export async function mountDwarfArcticIsland(
  scene: THREE.Scene,
  skin: DwarfIslandSkin,
): Promise<DwarfArcticScene> {
  let gltf;
  try {
    gltf = await loadGltfProduction(DWARF_ISLAND_URL);
  } catch {
    gltf = await loadGltfProduction(DWARF_ISLAND_CDN);
  }
  const island = gltf.scene;
  island.name = `dwarf_island_${skin}`;
  stampWorldLocation(island, dwarfIslandUuid('shell'));
  island.position.y = DWARF_ISLAND_SI.groundLiftM;
  island.updateMatrixWorld(true);

  const walkMeshes = labelRoles(island);
  if (!walkMeshes.length) {
    island.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) walkMeshes.push(m);
    });
  }
  await paintFortress(island, skin);

  const root = new THREE.Group();
  root.name = `dwarf_arctic_${skin}`;
  root.add(island);

  const box = new THREE.Box3().setFromObject(island);
  const baked = bakeHeightmapFromMeshes(walkMeshes, box, 1);
  const terrain = heightmapToTerrainData(baked);
  (terrain as TerrainData & { walkMeshes?: THREE.Mesh[] }).walkMeshes = walkMeshes;
  scatterHarvest(root, skin, box, (x, z) => terrain.getHeightAt(x, z));

  const dock = createDock(terrain, 'south');
  root.add(dock.group);
  const dockX = dock.group.position.x;
  const southZ = dock.group.position.z;

  const raft = await loadBoatTemplate('raft');
  if (raft) {
    raft.position.set(dockX - 4.5, 0.05, southZ + 4);
    raft.userData.playBoatId = 'raft';
    mountDeckStations(raft, 'raft', getDeckLoadout('raft'), { name: 'dwarf_deck_raft' });
    mountDeckSlotGrid(raft, 'raft');
    prepareFleetParts(raft, '');
    stampBoatNavLabels(raft, 'raft');
    stampWorldLocation(raft, dwarfIslandUuid('dock_raft'));
    root.add(raft);
  }
  const skiff = await loadBoatTemplate('skiff');
  if (skiff) {
    skiff.position.set(dockX + 5.2, 0.05, southZ + 3.4);
    skiff.userData.playBoatId = 'skiff';
    mountDeckStations(skiff, 'skiff', getDeckLoadout('skiff'), { name: 'dwarf_deck_skiff' });
    mountDeckSlotGrid(skiff, 'skiff');
    prepareFleetParts(skiff, '');
    stampBoatNavLabels(skiff, 'skiff');
    stampWorldLocation(skiff, dwarfIslandUuid('dock_skiff'));
    root.add(skiff);
  }
  const sloop = await loadBoatTemplate('sloop');
  if (sloop) {
    sloop.position.set(dockX, 0.08, southZ + 7.5);
    sloop.userData.playBoatId = 'sloop';
    mountDeckStations(sloop, 'sloop', getDeckLoadout('sloop'), { name: 'dwarf_deck_sloop' });
    mountDeckSlotGrid(sloop, 'sloop');
    markCabinEntry(sloop, new THREE.Vector3(0, 0.42, -1.4));
    prepareFleetParts(sloop, '');
    stampBoatNavLabels(sloop, 'sloop');
    stampWorldLocation(sloop, dwarfIslandUuid('dock_sloop'));
    root.add(sloop);
  }

  const keepBox = new THREE.Box3();
  let keepHits = 0;
  island.traverse((o) => {
    if (o.userData.islandRole !== 'keep') return;
    keepBox.expandByObject(o);
    keepHits += 1;
  });
  const keepInterior = keepHits > 2 ? buildKeepInterior(keepBox, root) : null;

  scene.add(root);
  return { group: root, terrain, dock, island, walkMeshes, skin, camps: [], keepInterior };
}
