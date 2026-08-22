/**
 * Assemble /island?entry=dock from the Chicken Gun island kit.
 * Extends ProductionIsland — does not invent a second island page.
 */
import * as THREE from 'three';
import { loadGltfProduction } from '@/lib/threeProductionLoader';
import { normalizeToMetres } from '@/lib/modelNormalize';
import type { TerrainData } from '@/lib/islandHeightmapTerrain';
import type { DockData } from '@/lib/islandDockSystem';
import { mountDeckStations, mountDeckSlotGrid } from '@/lib/deckPlacement';
import { getDeckLoadout } from '@/lib/playerProgression';
import {
  CHICKEN_GUN_ISLAND_URL,
  CHICKEN_GUN_ISLAND_CDN,
  CHICKEN_GUN_PURGE,
  CHICKEN_GUN_DOCK,
  CHICKEN_GUN_EDITOR_BOAT,
  CHICKEN_GUN_HARVEST,
  CHICKEN_GUN_PROPS,
  CHICKEN_GUN_TERRAIN,
  CHICKEN_GUN_HOUSES,
  CHICKEN_GUN_ISLETS,
  CHICKEN_GUN_ROCKS,
  CHICKEN_GUN_TREES,
  FRUZER_GRAVEYARD_URL,
  FRUZER_GRAVEYARD,
  type ChickenGunIsolate,
} from '@shared/gameDefinitions/chickenGunIslandKit';
import { layerForY, WORLD_SI } from '@shared/gameDefinitions/worldBuildRules';
import { bakeHeightmapFromMeshes, heightmapToTerrainData } from '@/lib/islandRapierGround';
import { loadBoatTemplate } from '@/lib/boatAssetLoader';
import { createBuildingInterior, type BuildingInteriorHandle } from '@/lib/buildingInteriorInstance';
import { interiorIdForExterior } from '@shared/gameDefinitions/warlordsInteriorKit';
import { loadKaykitBitsPack, mountResourceWealth } from '@/lib/resourceWealthVisual';
import { CAMP_DEFAULT_WEALTH } from '@shared/gameDefinitions/kaykitResourceBits';
import {
  applyFamilyToObject,
  getMaterialFamily,
  loadFamilyMaps,
  type EditorMaterialFamilyId,
} from '@/lib/editorTools/materialFamilies';

const templateCache = new Map<string, THREE.Object3D>();

function findNamed(root: THREE.Object3D, node: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && o.name === node) hit = o;
  });
  return hit;
}

/**
 * Game-ready location stamp: D1 asset UUID + world Vector3 + Matrix4 (column-major).
 * Not a player grudge_uuid.
 */
export function stampWorldLocation(obj: THREE.Object3D, uuid: string): void {
  obj.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  obj.userData.assetUuid = uuid;
  obj.userData.location = {
    uuid,
    xyz: [p.x, p.y, p.z] as [number, number, number],
    vector3: p.clone(),
    matrix4: obj.matrixWorld.toArray(),
  };
}

function isolate(root: THREE.Object3D, spec: ChickenGunIsolate): THREE.Group {
  const src = findNamed(root, spec.node);
  const g = new THREE.Group();
  g.name = spec.id;
  g.userData.assetUuid = spec.assetUuid;
  g.userData.layer = spec.layer;
  g.userData.kitKind = spec.kind;
  if (!src) return g;
  const c = src.clone(true);
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  c.scale.set(1, 1, 1);
  g.add(c);
  normalizeToMetres(g, {
    targetSizeM: spec.sizeM,
    axis: spec.fitAxis,
    ground: true,
    centerXZ: true,
  });
  if (spec.kind === 'dock' || spec.kind === 'boat') {
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    if (size.y > Math.max(size.x, size.z) * 1.15) {
      g.rotation.x = -Math.PI / 2;
      g.updateMatrixWorld(true);
      normalizeToMetres(g, {
        targetSizeM: spec.sizeM,
        axis: spec.fitAxis,
        ground: true,
        centerXZ: true,
      });
    }
  }
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

/** SeascapeOcean vertex waves peak ~0.48 m — land min must sit above that. */
const SHORE_FREEBOARD_M = 0.85;

export interface KitHarvestable {
  object: THREE.Object3D;
  id: string;
  type: 'tree' | 'rock' | 'hemp';
  hits: number;
  resource: 'wood' | 'stone' | 'hemp';
  amount: number;
}

function familyForMesh(mesh: THREE.Mesh): EditorMaterialFamilyId {
  const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
  const matName = (Array.isArray(mat) ? mat[0]?.name : mat?.name) || '';
  const n = `${mesh.name} ${matName}`.toLowerCase();
  if (/green|grass|leaf/.test(n)) return 'grass';
  if (/sand|brown_lightest|skin_light/.test(n)) return 'sand';
  if (/grey|gray|stone|rock/.test(n)) return 'stone';
  if (/brown|bark|wood|oak/.test(n)) return 'soil';
  return 'grass';
}

function planarXzUvs(mesh: THREE.Mesh, metresPerTile: number): void {
  const src = mesh.geometry;
  const pos = src.getAttribute('position');
  if (!pos) return;
  const geo = src.clone();
  mesh.geometry = geo;
  mesh.updateMatrixWorld(true);
  const attr = geo.getAttribute('position');
  const uv = new Float32Array(attr.count * 2);
  const tile = Math.max(metresPerTile, 0.5);
  const v = new THREE.Vector3();
  for (let i = 0; i < attr.count; i++) {
    v.set(attr.getX(i), attr.getY(i), attr.getZ(i)).applyMatrix4(mesh.matrixWorld);
    uv[i * 2] = v.x / tile;
    uv[i * 2 + 1] = v.z / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv2', new THREE.BufferAttribute(uv.slice(), 2));
}

const familyMapCache = new Map<
  EditorMaterialFamilyId,
  { map: THREE.Texture | null; normal: THREE.Texture | null }
>();

async function mapsFor(id: EditorMaterialFamilyId) {
  const hit = familyMapCache.get(id);
  if (hit) return hit;
  const family = getMaterialFamily(id);
  if (!family) return { map: null, normal: null };
  const maps = await loadFamilyMaps(family);
  familyMapCache.set(id, maps);
  return maps;
}

/** Bind existing editor ground families + planar XZ UVs. Sketchfab isolates are factor-only. */
async function paintShell(obj: THREE.Object3D, fallback: EditorMaterialFamilyId): Promise<void> {
  const buckets = new Map<EditorMaterialFamilyId, THREE.Mesh[]>();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fam = familyForMesh(m) || fallback;
    const list = buckets.get(fam) ?? [];
    list.push(m);
    buckets.set(fam, list);
  });
  const entries = Array.from(buckets.entries());
  for (let i = 0; i < entries.length; i++) {
    const id = entries[i]![0];
    const meshes = entries[i]![1];
    const family = getMaterialFamily(id);
    if (!family) continue;
    const maps = await mapsFor(id);
    const tile = family.tileRepeat ? 12 / family.tileRepeat : 8;
    for (const mesh of meshes) {
      planarXzUvs(mesh, tile);
      applyFamilyToObject(mesh, family, maps.map, maps.normal);
    }
  }
}

function liftAboveSea(obj: THREE.Object3D, freeboardM: number): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (!isFinite(box.min.y)) return;
  obj.position.y += freeboardM - box.min.y;
  obj.updateMatrixWorld(true);
}

function snapToHeight(obj: THREE.Object3D, heightAt: (x: number, z: number) => number): void {
  const y = heightAt(obj.position.x, obj.position.z);
  if (y > WORLD_SI.waterSurfaceY - 0.2) obj.position.y = y;
}

export interface HomeCamp {
  faction: 'crusade' | 'fabled' | 'legion';
  position: THREE.Vector3;
}

export interface ChickenGunDockScene {
  group: THREE.Group;
  terrain: TerrainData;
  dock: DockData;
  editorBoat: THREE.Group;
  island: THREE.Group;
  camps: HomeCamp[];
  layers: Record<string, THREE.Group>;
  harvestables: KitHarvestable[];
  vendorStand: THREE.Vector3;
  interiors: BuildingInteriorHandle[];
  dockWealth: THREE.Group;
}

function layerGroup(id: string): THREE.Group {
  const g = new THREE.Group();
  g.name = `layer_${id}`;
  g.userData.layer = id;
  return g;
}

export async function loadPack(url: string, purge = false): Promise<THREE.Object3D> {
  const hit = templateCache.get(url);
  if (hit) return hit;
  let gltf;
  try {
    gltf = await loadGltfProduction(url);
  } catch (err) {
    if (url === CHICKEN_GUN_ISLAND_URL) {
      gltf = await loadGltfProduction(CHICKEN_GUN_ISLAND_CDN);
    } else {
      throw err;
    }
  }
  const pack = gltf.scene;
  if (purge) {
    pack.traverse((o) => {
      if (CHICKEN_GUN_PURGE.test(o.name)) o.visible = false;
    });
  }
  templateCache.set(url, pack);
  return pack;
}

export async function mountChickenGunDockIsland(scene: THREE.Scene): Promise<ChickenGunDockScene> {
  const pack = await loadPack(CHICKEN_GUN_ISLAND_URL, true);

  const root = new THREE.Group();
  root.name = 'chicken_gun_dock_island';
  const layers = {
    terrain: layerGroup('land'),
    harvest: layerGroup('harvest'),
    shore: layerGroup('shore'),
    water: layerGroup('water'),
    effects: layerGroup('air'),
    ai: layerGroup('land'),
  };
  Object.values(layers).forEach((g) => root.add(g));

  const island = isolate(pack, CHICKEN_GUN_TERRAIN[0]);
  island.position.set(0, 0, 0);
  island.userData.ident = 'tree-island';
  layers.terrain.add(island);
  liftAboveSea(island, SHORE_FREEBOARD_M);
  await paintShell(island, 'grass');

  const sand = isolate(pack, CHICKEN_GUN_TERRAIN[1]);
  sand.position.set(8, 0, 22);
  layers.shore.add(sand);
  liftAboveSea(sand, 0.35);
  await paintShell(sand, 'sand');

  const islandBox = new THREE.Box3().setFromObject(island);

  const dockMesh = isolate(pack, CHICKEN_GUN_DOCK);
  const southZ = islandBox.max.z + 1.2;
  dockMesh.position.set(0, WORLD_SI.waterSurfaceY, southZ);
  dockMesh.rotation.y = Math.PI;
  layers.shore.add(dockMesh);
  await paintShell(dockMesh, 'oak');

  const editorBoat = isolate(pack, CHICKEN_GUN_EDITOR_BOAT);
  editorBoat.position.set(2.4, 0, southZ + 4.2);
  editorBoat.rotation.y = Math.PI * 0.5;
  editorBoat.userData.playBoatId = 'sloop';
  mountDeckStations(editorBoat, 'sloop', getDeckLoadout('sloop'), { name: 'editor_deck_sloop' });
  mountDeckSlotGrid(editorBoat, 'sloop');
  layers.water.add(editorBoat);

  const raft = await loadBoatTemplate('raft');
  if (raft) {
    raft.position.set(-5.5, 0.05, southZ + 5.5);
    raft.userData.playBoatId = 'raft';
    raft.userData.assetUuid = 'c5c246f1-6f29-56e6-a8ea-4f9cc32925f4';
    mountDeckStations(raft, 'raft', getDeckLoadout('raft'), { name: 'dock_deck_raft' });
    mountDeckSlotGrid(raft, 'raft');
    layers.water.add(raft);
  }
  const skiff = await loadBoatTemplate('skiff');
  if (skiff) {
    skiff.position.set(-8.2, 0.05, southZ + 3.2);
    skiff.rotation.y = 0.4;
    skiff.userData.playBoatId = 'skiff';
    skiff.userData.assetUuid = '3bc46ca3-47b3-5609-9882-d98604198911';
    mountDeckStations(skiff, 'skiff', getDeckLoadout('skiff'), { name: 'dock_deck_skiff' });
    mountDeckSlotGrid(skiff, 'skiff');
    layers.water.add(skiff);
  }

  const harvestables: KitHarvestable[] = [];
  CHICKEN_GUN_TREES.forEach((spec, i) => {
    const m = isolate(pack, spec);
    const a = (i / CHICKEN_GUN_TREES.length) * Math.PI * 2;
    m.position.set(Math.cos(a) * 14, SHORE_FREEBOARD_M, Math.sin(a) * 12);
    m.userData.ident = 'tree';
    layers.harvest.add(m);
    void paintShell(m, 'bark');
    harvestables.push({ object: m, id: `cg-tree-${i}`, type: 'tree', hits: 3, resource: 'wood', amount: 2 });
  });
  CHICKEN_GUN_ROCKS.forEach((spec, i) => {
    const m = isolate(pack, spec);
    m.position.set(-6 + i * 5, SHORE_FREEBOARD_M, -8);
    m.userData.ident = 'rock';
    layers.harvest.add(m);
    void paintShell(m, 'stone');
    harvestables.push({ object: m, id: `cg-rock-${i}`, type: 'rock', hits: 2, resource: 'stone', amount: 1 });
  });
  const harvestSpots: Array<[number, number]> = [[-10, 4], [11, 5], [-4, 12], [5, -11]];
  harvestSpots.forEach((xz, i) => {
    const spec = CHICKEN_GUN_HARVEST[i % CHICKEN_GUN_HARVEST.length];
    const m = isolate(pack, spec);
    m.position.set(xz[0], SHORE_FREEBOARD_M, xz[1]);
    m.rotation.y = i * 0.7;
    layers.harvest.add(m);
    const hemp = /grass|shrub|flower/.test(spec.node);
    harvestables.push({
      object: m,
      id: `cg-harvest-${i}`,
      type: hemp ? 'hemp' : spec.kind === 'harvest' && /stone/.test(spec.node) ? 'rock' : 'tree',
      hits: hemp ? 1 : 2,
      resource: hemp ? 'hemp' : /stone/.test(spec.node) ? 'stone' : 'wood',
      amount: 1,
    });
  });

  CHICKEN_GUN_PROPS.forEach((spec, i) => {
    const m = isolate(pack, spec);
    m.position.set(-1.4 + i * 1.3, 0.15, southZ - 0.4);
    layers.shore.add(m);
  });

  const landBuildings: Array<{ obj: THREE.Object3D; prefer: 'hut' | 'cottage' | 'shop' }> = [];
  const hut = isolate(pack, CHICKEN_GUN_HOUSES[0]);
  hut.position.set(-9, SHORE_FREEBOARD_M, -4);
  hut.userData.vendor = 'shipwright';
  hut.userData.doorClearanceM = 2.1;
  layers.ai.add(hut);
  landBuildings.push({ obj: hut, prefer: 'hut' });
  const yard = new THREE.Group();
  yard.name = 'player_2m_yardstick';
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0x553300, emissiveIntensity: 0.3 }),
  );
  pole.position.y = 1.0;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe08a }),
  );
  head.position.y = 1.9;
  yard.add(pole, head);
  yard.position.set(-7.4, 0, -4);
  layers.ai.add(yard);

  const camps: HomeCamp[] = [];
  const campDefs: Array<{ spec: typeof CHICKEN_GUN_ISLETS[number]; xz: [number, number]; faction: HomeCamp['faction']; color: number }> = [
    { spec: CHICKEN_GUN_ISLETS[0], xz: [38, 8], faction: 'crusade', color: 0xffd700 },
    { spec: CHICKEN_GUN_ISLETS[1], xz: [-34, 16], faction: 'fabled', color: 0x00ced1 },
    { spec: CHICKEN_GUN_ISLETS[2], xz: [12, -36], faction: 'legion', color: 0x8b0000 },
  ];
  campDefs.forEach((c, i) => {
    const islet = isolate(pack, c.spec);
    islet.position.set(c.xz[0], 0, c.xz[1]);
    liftAboveSea(islet, SHORE_FREEBOARD_M);
    void paintShell(islet, c.faction === 'legion' ? 'soil' : 'grass');
    layers.terrain.add(islet);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.1),
      new THREE.MeshStandardMaterial({ color: c.color, side: THREE.DoubleSide, emissive: c.color, emissiveIntensity: 0.25 }),
    );
    flag.position.set(c.xz[0], 2.2, c.xz[1]);
    layers.ai.add(flag);
    const house = isolate(pack, CHICKEN_GUN_HOUSES[i % CHICKEN_GUN_HOUSES.length]);
    house.position.set(c.xz[0] + 2, 0, c.xz[1] + 1);
    house.userData.doorClearanceM = 2.1;
    layers.ai.add(house);
    landBuildings.push({ obj: house, prefer: i === 0 ? 'shop' : 'cottage' });
    camps.push({ faction: c.faction, position: new THREE.Vector3(c.xz[0], 0.6, c.xz[1]) });
  });

  const gyPack = await loadPack(FRUZER_GRAVEYARD_URL, false);
  const legion = camps.find((c) => c.faction === 'legion');
  const gx = legion?.position.x ?? 12;
  const gz = legion?.position.z ?? -36;
  const gyLayout: Array<{ spec: (typeof FRUZER_GRAVEYARD)[number]; dx: number; dz: number; yaw?: number }> = [
    { spec: FRUZER_GRAVEYARD[0], dx: 0, dz: 0 },
    { spec: FRUZER_GRAVEYARD[2], dx: -3.2, dz: 2.4, yaw: Math.PI * 0.5 },
    { spec: FRUZER_GRAVEYARD[3], dx: 2.8, dz: -1.6 },
    { spec: FRUZER_GRAVEYARD[5], dx: -4.5, dz: -2.2 },
    { spec: FRUZER_GRAVEYARD[6], dx: 4.0, dz: 1.5 },
    { spec: FRUZER_GRAVEYARD[8], dx: 1.2, dz: -3.4 },
    { spec: FRUZER_GRAVEYARD[12], dx: -1.5, dz: 2.0 },
  ];
  gyLayout.forEach((row) => {
    const m = isolate(gyPack, row.spec);
    m.position.set(gx + row.dx, 0.05, gz + row.dz);
    if (row.yaw) m.rotation.y = row.yaw;
    m.userData.ident = row.spec.name.toLowerCase().includes('tree') ? 'tree' : row.spec.name.toLowerCase().includes('rock') || row.spec.name.toLowerCase().includes('cliff') ? 'rock' : 'grave';
    layers.ai.add(m);
  });

  scene.add(root);

  const walkMeshes: THREE.Mesh[] = [];
  const collectWalk = (node: THREE.Object3D) => {
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.visible) walkMeshes.push(m);
    });
  };
  collectWalk(layers.terrain);
  collectWalk(layers.shore);
  layers.ai.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (o.userData?.ident === 'grave' || (m.parent as THREE.Object3D)?.userData?.ident === 'grave')) {
      walkMeshes.push(m);
    }
  });
  root.updateMatrixWorld(true);
  const mapBounds = new THREE.Box3().setFromObject(root);
  const grid = bakeHeightmapFromMeshes(walkMeshes, mapBounds, 1);
  const terrain = heightmapToTerrainData(grid);
  (terrain as TerrainData & { walkMeshes?: THREE.Mesh[] }).walkMeshes = walkMeshes;

  const heightAt = (x: number, z: number) => terrain.getHeightAt(x, z);
  harvestables.forEach((h) => snapToHeight(h.object, heightAt));
  snapToHeight(hut, heightAt);
  snapToHeight(yard, heightAt);
  landBuildings.forEach((b) => snapToHeight(b.obj, heightAt));
  camps.forEach((c) => {
    c.position.y = Math.max(SHORE_FREEBOARD_M, heightAt(c.position.x, c.position.z) + 0.05);
  });

  dockMesh.updateMatrixWorld(true);
  const dockBox = new THREE.Box3().setFromObject(dockMesh);
  const spawnX = dockMesh.position.x;
  const spawnZ = dockMesh.position.z - 1.2;
  const dockY = heightAt(spawnX, spawnZ);
  const spawn = new THREE.Vector3(
    spawnX,
    Math.max(0.45, Number.isFinite(dockY) && dockY > -1 ? dockY + 0.05 : Math.min(1.1, dockBox.max.y + 0.05)),
    spawnZ,
  );
  const approach = spawn.clone().add(new THREE.Vector3(0, 0, 8));
  const dock: DockData = {
    group: dockMesh,
    spawnPoint: spawn,
    approachPoint: approach,
    interactionZone: dockBox.clone().expandByScalar(2),
    side: 'south',
    kind: 'fishing_dock',
    berths: [editorBoat.position.clone()],
  };

  const bitsPack = await loadKaykitBitsPack();
  camps.forEach((camp) => {
    const stash = CAMP_DEFAULT_WEALTH[camp.faction] ?? {};
    layers.ai.add(mountResourceWealth(bitsPack, camp.position.clone(), stash, 'camp'));
  });
  const dockWealth = mountResourceWealth(
    bitsPack,
    spawn.clone().add(new THREE.Vector3(-3.2, 0, 1.4)),
    { wood: 0, stone: 0, hemp: 0 },
    'dock',
  );
  layers.shore.add(dockWealth);
  layers.water.add(mountResourceWealth(
    bitsPack,
    editorBoat.position.clone().add(new THREE.Vector3(1.6, 0.2, 0)),
    { wood: 3, hemp: 2, fuel: 4, gold: 0 },
    'boat',
  ));

  root.userData.layer = layerForY(0.2);
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const uuid = o.userData.assetUuid as string | undefined;
    if (uuid) stampWorldLocation(o, uuid);
  });
  const vendorStand = hut.position.clone();
  vendorStand.y = heightAt(vendorStand.x, vendorStand.z);
  const interiors: BuildingInteriorHandle[] = [];
  for (const b of landBuildings) {
    b.obj.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(b.obj).getSize(new THREE.Vector3());
    const typeId = b.prefer ?? interiorIdForExterior(size.x, size.z);
    interiors.push(await createBuildingInterior({ typeId, exterior: b.obj, parent: root }));
  }
  return { group: root, terrain, dock, editorBoat, island, camps, layers, harvestables, vendorStand, interiors, dockWealth };
}

/** World-map home visual — SI Fruzer shell, no waterfall lighthouse/runes. */
export async function mountFruzerWorldMapHome(parent: THREE.Object3D): Promise<{
  group: THREE.Group;
  radius: number;
}> {
  let pack = templateCache.get(CHICKEN_GUN_ISLAND_URL);
  if (!pack) {
    const gltf = await loadGltfProduction(CHICKEN_GUN_ISLAND_URL);
    pack = gltf.scene;
    pack.traverse((o) => {
      if (CHICKEN_GUN_PURGE.test(o.name)) o.visible = false;
    });
    templateCache.set(CHICKEN_GUN_ISLAND_URL, pack);
  }

  const root = new THREE.Group();
  root.name = 'fruzer_world_home';

  const islandSpec = { ...CHICKEN_GUN_TERRAIN[0], sizeM: 80 };
  const island = isolate(pack, islandSpec);
  island.position.set(0, 0, 0);
  root.add(island);

  const box = new THREE.Box3().setFromObject(island);
  const radius = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).z) * 0.5;

  const dock = isolate(pack, { ...CHICKEN_GUN_DOCK, sizeM: 10 });
  dock.position.set(0, 0, box.max.z + 1.4);
  dock.rotation.y = Math.PI;
  root.add(dock);

  const palms = [CHICKEN_GUN_HARVEST[0], CHICKEN_GUN_HARVEST[1], CHICKEN_GUN_HARVEST[2]];
  const spots: Array<[number, number]> = [[-12, -8], [14, -6], [-8, 10], [10, 8]];
  spots.forEach((xz, i) => {
    const m = isolate(pack, palms[i % palms.length]);
    m.position.set(xz[0], 0, xz[1]);
    m.rotation.y = i * 0.8;
    root.add(m);
  });

  const campIslets: Array<[number, number, number]> = [
    [48, 10, 0xffd700],
    [-44, 18, 0x00ced1],
    [16, -46, 0x8b0000],
  ];
  campIslets.forEach((row, i) => {
    const islet = isolate(pack, CHICKEN_GUN_ISLETS[i % CHICKEN_GUN_ISLETS.length]);
    islet.position.set(row[0], 0, row[1]);
    root.add(islet);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.4),
      new THREE.MeshStandardMaterial({ color: row[2], side: THREE.DoubleSide, emissive: row[2], emissiveIntensity: 0.3 }),
    );
    flag.position.set(row[0], 3.2, row[1]);
    root.add(flag);
  });

  parent.add(root);
  return { group: root, radius };
}

/** Center dungeon visual for world-map Graveyard sector (isolate kit, not the 27 MB Map). */
export async function mountGraveyardHeart(parent: THREE.Object3D): Promise<THREE.Group> {
  const pack = await loadPack(FRUZER_GRAVEYARD_URL, false);
  const root = new THREE.Group();
  root.name = 'graveyard_heart';
  const layout: Array<{ spec: (typeof FRUZER_GRAVEYARD)[number]; x: number; z: number; yaw?: number }> = [
    { spec: FRUZER_GRAVEYARD[0], x: 0, z: 0 },
    { spec: FRUZER_GRAVEYARD[1], x: 5, z: -3, yaw: 0.4 },
    { spec: FRUZER_GRAVEYARD[2], x: -6, z: 4, yaw: Math.PI * 0.5 },
    { spec: FRUZER_GRAVEYARD[3], x: 4, z: 5 },
    { spec: FRUZER_GRAVEYARD[4], x: -4, z: -5 },
    { spec: FRUZER_GRAVEYARD[5], x: -8, z: 1 },
    { spec: FRUZER_GRAVEYARD[6], x: 8, z: -2 },
    { spec: FRUZER_GRAVEYARD[7], x: 2, z: 7 },
    { spec: FRUZER_GRAVEYARD[8], x: -2, z: -8 },
    { spec: FRUZER_GRAVEYARD[12], x: 3, z: 2 },
  ];
  layout.forEach((row) => {
    const m = isolate(pack, row.spec);
    m.position.set(row.x, 0.05, row.z);
    if (row.yaw) m.rotation.y = row.yaw;
    root.add(m);
  });
  parent.add(root);
  return root;
}
