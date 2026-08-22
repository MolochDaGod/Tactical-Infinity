/**
 * Land-building interiors — same XZ as the exterior, Y below seafloor.
 * Extends captainsQuartersInstance + homeInteriorManager. Not a second scene.
 */
import * as THREE from 'three';
import { loadGltfProduction } from '@/lib/threeProductionLoader';
import {
  applyFamilyToObject,
  getMaterialFamily,
  loadFamilyMaps,
  type EditorMaterialFamilyId,
} from '@/lib/editorTools/materialFamilies';
import {
  INTERIOR_WORLD_Y,
  interiorUuid,
  warlordsInterior,
  type WarlordsInteriorDef,
  type WarlordsInteriorId,
} from '@shared/gameDefinitions/warlordsInteriorKit';
import { WORLD_SI } from '@shared/gameDefinitions/worldBuildRules';

export { INTERIOR_WORLD_Y };

function stamp(obj: THREE.Object3D, uuid: string): void {
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

const WALL_T = 0.12;
const DOOR_W = 0.9;
const DOOR_H = WORLD_SI.doorClearanceM;

export interface BuildingInteriorHandle {
  group: THREE.Group;
  door: THREE.Object3D;
  standInside: THREE.Vector3;
  standOutside: THREE.Vector3;
  floorY: number;
  interiorUuid: string;
  typeId?: WarlordsInteriorId;
}

function box(
  name: string,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function mats() {
  return {
    floor: new THREE.MeshStandardMaterial({ name: 'floor', color: 0x3d2817, roughness: 0.94 }),
    wall: new THREE.MeshStandardMaterial({ name: 'wall', color: 0x6b4f32, roughness: 0.88 }),
    ceil: new THREE.MeshStandardMaterial({ name: 'ceiling', color: 0x5c4033, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ name: 'furniture', color: 0x5c4033, roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ name: 'trim', color: 0xc4a35a, roughness: 0.55, metalness: 0.2 }),
    stone: new THREE.MeshStandardMaterial({ name: 'hearth', color: 0x6a6860, roughness: 0.92 }),
    cloth: new THREE.MeshStandardMaterial({ name: 'cloth', color: 0x6a3030, roughness: 0.85 }),
  };
}

function addWalls(g: THREE.Group, w: number, l: number, h: number, wall: THREE.Material): void {
  const y = h / 2;
  g.add(box('wall_north', w, h, WALL_T, 0, y, l / 2 - WALL_T / 2, wall));
  g.add(box('wall_east', WALL_T, h, l, w / 2 - WALL_T / 2, y, 0, wall));
  g.add(box('wall_west', WALL_T, h, l, -w / 2 + WALL_T / 2, y, 0, wall));
  const southZ = -l / 2 + WALL_T / 2;
  const wing = (w - DOOR_W) / 2;
  g.add(box('wall_south_l', wing, h, WALL_T, -w / 2 + wing / 2, y, southZ, wall));
  g.add(box('wall_south_r', wing, h, WALL_T, w / 2 - wing / 2, y, southZ, wall));
  const lintelH = Math.max(0.2, h - DOOR_H);
  g.add(box('wall_south_lintel', DOOR_W, lintelH, WALL_T, 0, DOOR_H + lintelH / 2, southZ, wall));
}

function addLayout(g: THREE.Group, def: WarlordsInteriorDef, m: ReturnType<typeof mats>): void {
  const { w, l, layout } = def;
  if (layout === 'hut') {
    g.add(box('furniture_table', 1.0, 0.08, 0.65, 0, 0.74, 0.2, m.wood));
    for (const [lx, lz] of [[-0.4, -0.05], [0.4, -0.05], [-0.4, 0.45], [0.4, 0.45]] as const) {
      g.add(box('furniture_leg', 0.07, 0.7, 0.07, lx, 0.35, lz, m.wood));
    }
    g.add(box('furniture_crate', 0.55, 0.5, 0.55, -w / 2 + 0.7, 0.31, -0.4, m.wood));
  } else if (layout === 'shop') {
    g.add(box('furniture_counter', 2.4, 0.9, 0.55, 0, 0.5, l / 2 - 1.1, m.wood));
    g.add(box('furniture_shelf', 1.6, 1.4, 0.28, -w / 2 + 0.55, 0.9, 0.2, m.wood));
    g.add(box('furniture_shelf_2', 1.6, 1.4, 0.28, w / 2 - 0.55, 0.9, 0.2, m.wood));
    g.add(box('furniture_crate', 0.5, 0.45, 0.5, w / 2 - 0.7, 0.28, -l / 2 + 1.1, m.wood));
  } else if (layout === 'cottage') {
    g.add(box('furniture_table', 1.3, 0.08, 0.8, 0.4, 0.76, 0.3, m.wood));
    g.add(box('furniture_bunk', 0.95, 0.28, 1.9, -w / 2 + 0.85, 0.42, -0.2, m.wood));
    g.add(box('cloth_blanket', 0.9, 0.05, 1.6, -w / 2 + 0.85, 0.58, -0.15, m.cloth));
    g.add(box('hearth', 0.9, 1.1, 0.4, w / 2 - 0.7, 0.6, l / 2 - 0.55, m.stone));
  } else if (layout === 'tavern') {
    g.add(box('furniture_bar', 3.2, 0.95, 0.6, 0, 0.52, l / 2 - 1.05, m.wood));
    g.add(box('furniture_table', 1.15, 0.08, 0.75, -1.4, 0.74, -0.4, m.wood));
    g.add(box('furniture_table_2', 1.15, 0.08, 0.75, 1.4, 0.74, -0.4, m.wood));
    for (const [x, z] of [[-1.4, 0.15], [-1.4, -0.95], [1.4, 0.15], [1.4, -0.95]] as const) {
      g.add(box('furniture_stool', 0.32, 0.48, 0.32, x, 0.28, z, m.wood));
    }
    g.add(box('hearth', 1.1, 1.2, 0.45, w / 2 - 0.75, 0.65, l / 2 - 0.6, m.stone));
  } else {
    g.add(box('furniture_table_long', 4.2, 0.1, 1.1, 0, 0.78, 0, m.wood));
    g.add(box('furniture_bench', 4.0, 0.4, 0.4, 0, 0.28, 0.85, m.wood));
    g.add(box('furniture_bench_2', 4.0, 0.4, 0.4, 0, 0.28, -0.85, m.wood));
    g.add(box('hearth_pillar', 0.45, def.h - 0.2, 0.45, -w / 2 + 1.1, def.h / 2, l / 2 - 1.0, m.stone));
    g.add(box('hearth_pillar_2', 0.45, def.h - 0.2, 0.45, w / 2 - 1.1, def.h / 2, l / 2 - 1.0, m.stone));
  }
}

/** Geometry-only SI room (named mats). Used at runtime and by the GLB export. */
export function buildInteriorShell(typeId: WarlordsInteriorId): THREE.Group {
  const def = warlordsInterior(typeId);
  const { w, l, h } = def;
  const m = mats();
  const g = new THREE.Group();
  g.name = `interior_${typeId}`;
  g.add(box('floor', w, 0.12, l, 0, 0.06, 0, m.floor));
  g.add(box('ceiling', w, 0.1, l, 0, h, 0, m.ceil));
  addWalls(g, w, l, h, m.wall);
  addLayout(g, def, m);
  const pad = box('interior_exit_pad', 0.9, 0.04, 0.9, 0, 0.14, -l / 2 + 0.7, m.trim);
  g.add(pad);
  const lantern = new THREE.PointLight(0xffcc88, 3.2, Math.max(w, l) * 1.4, 2);
  lantern.name = 'interior_lamp';
  lantern.position.set(0, h - 0.35, 0);
  g.add(lantern);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      name: 'trim',
      color: 0xffaa44,
      emissive: 0xffaa44,
      emissiveIntensity: 1.3,
    }),
  );
  glow.name = 'interior_lamp_glow';
  glow.position.copy(lantern.position);
  g.add(glow);
  g.userData.interiorType = typeId;
  g.userData.interiorSize = { w, l, h };
  return g;
}

function familyForMeshName(name: string, def: WarlordsInteriorDef): EditorMaterialFamilyId {
  const n = name.toLowerCase();
  if (n.startsWith('floor')) return def.floorFamily;
  if (n.startsWith('wall') || n.startsWith('ceiling')) return def.wallFamily;
  if (n.startsWith('hearth')) return 'stone';
  if (n.startsWith('cloth')) return 'cloth';
  if (n.startsWith('trim') || n.includes('lamp')) return 'oak';
  return 'oak';
}

/** Bind existing editor PBR families onto named interior meshes. */
export async function paintInterior(group: THREE.Group, typeId: WarlordsInteriorId): Promise<void> {
  const def = warlordsInterior(typeId);
  const cache = new Map<EditorMaterialFamilyId, { map: THREE.Texture | null; normal: THREE.Texture | null }>();
  const jobs: Promise<void>[] = [];
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const famId = familyForMeshName(mesh.name, def);
    jobs.push((async () => {
      let maps = cache.get(famId);
      if (!maps) {
        const family = getMaterialFamily(famId);
        maps = family ? await loadFamilyMaps(family) : { map: null, normal: null };
        cache.set(famId, maps);
      }
      const family = getMaterialFamily(famId);
      if (family) applyFamilyToObject(mesh, family, maps.map, maps.normal);
    })());
  });
  await Promise.all(jobs);
}

function makeExteriorDoor(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x3a2414,
      roughness: 0.8,
      emissive: 0x221100,
      emissiveIntensity: 0.25,
    }),
  );
  m.name = 'building_door';
  return m;
}

async function trySwapInteriorGlb(group: THREE.Group, def: WarlordsInteriorDef): Promise<void> {
  try {
    const gltf = await loadGltfProduction(def.localUrl).catch(() => loadGltfProduction(def.cdnUrl));
    const model = gltf.scene;
    const box3 = new THREE.Box3().setFromObject(model);
    const size = box3.getSize(new THREE.Vector3());
    const s = def.w / Math.max(size.x, 0.1);
    model.scale.setScalar(s);
    box3.setFromObject(model);
    model.position.y = -box3.min.y;
    const keep: THREE.Object3D[] = [];
    group.children.forEach((c) => {
      if (c.name === 'interior_exit_pad' || (c as THREE.Light).isLight) keep.push(c);
    });
    while (group.children.length) group.remove(group.children[0]);
    group.add(model);
    keep.forEach((c) => group.add(c));
  } catch {
    /* procedural room stays */
  }
}

export async function createBuildingInterior(opts: {
  typeId: WarlordsInteriorId;
  exterior: THREE.Object3D;
  parent: THREE.Object3D;
}): Promise<BuildingInteriorHandle> {
  const def = warlordsInterior(opts.typeId);
  const group = buildInteriorShell(opts.typeId);
  const uuid = interiorUuid(opts.typeId);
  group.userData.assetUuid = uuid;
  opts.exterior.updateMatrixWorld(true);
  const ext = new THREE.Box3().setFromObject(opts.exterior);
  const cx = (ext.min.x + ext.max.x) / 2;
  const cz = (ext.min.z + ext.max.z) / 2;
  group.position.set(cx, INTERIOR_WORLD_Y, cz);
  opts.parent.add(group);
  stamp(group, uuid);

  const door = makeExteriorDoor();
  door.position.set(cx, ext.min.y + DOOR_H / 2, ext.min.z - 0.08);
  door.userData.assetUuid = interiorUuid(opts.typeId, 'door');
  opts.parent.add(door);
  stamp(door, door.userData.assetUuid as string);

  void (async () => {
    await trySwapInteriorGlb(group, def);
    await paintInterior(group, opts.typeId);
  })();

  const standInside = new THREE.Vector3(cx, INTERIOR_WORLD_Y + 0.2, cz - def.l * 0.22);
  const standOutside = new THREE.Vector3(cx, ext.min.y + 0.05, ext.min.z - 1.4);
  return {
    group,
    door,
    standInside,
    standOutside,
    floorY: INTERIOR_WORLD_Y + 0.12,
    interiorUuid: uuid,
    typeId: opts.typeId,
  };
}
