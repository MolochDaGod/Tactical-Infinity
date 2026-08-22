/**
 * Captains quarters — hidden interior instance under the map seafloor.
 *
 * Same map XZ as the ship. On hatch enter, teleport the player into this
 * room (Y below seabed). Not a second scene / portal map.
 *
 * Rapier: interior floor is a fixed cuboid (trimesh only on static world).
 * Extends homeInteriorManager pattern; does not invent a second interior stack.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { boatHasCabin, type BoatId } from '@shared/gameDefinitions/boatRegistry';
import { WORLD_SI } from '@shared/gameDefinitions/worldBuildRules';

/** Below seabed layer (seabed yMin = -80, yMax = -15). Hidden from open-sea camera. */
export const CABIN_WORLD_Y = -36;

const CABIN_GLB = '/models/fleet/interiors/captains-quarters.glb';

export interface CaptainsQuartersHandle {
  group: THREE.Group;
  /** Local hatch on the *deck* (stern). World position follows the ship. */
  hatchLocal: THREE.Vector3;
  floorY: number;
  half: { x: number; z: number };
  boatId: BoatId;
}

function cabinSize(boatId: BoatId): { w: number; l: number; h: number } {
  if (boatId === 'manOWar' || boatId === 'galleon') return { w: 5.2, l: 6.4, h: 2.6 };
  if (boatId === 'brigantine') return { w: 4.4, l: 5.2, h: 2.4 };
  return { w: 3.4, l: 4.2, h: 2.2 };
}

function buildProceduralCabin(boatId: BoatId): THREE.Group {
  const { w, l, h } = cabinSize(boatId);
  const g = new THREE.Group();
  g.name = 'captains_quarters';

  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 0.88 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.55, metalness: 0.2 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, l), floorMat);
  floor.position.y = 0.06;
  floor.receiveShadow = true;
  g.add(floor);

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), wallMat);
  ceil.position.y = h;
  g.add(ceil);

  const wallT = 0.12;
  const walls: Array<[number, number, number, number, number, number]> = [
    [0, h / 2, l / 2 - wallT / 2, w, h, wallT],
    [0, h / 2, -l / 2 + wallT / 2, w, h, wallT],
    [w / 2 - wallT / 2, h / 2, 0, wallT, h, l],
    [-w / 2 + wallT / 2, h / 2, 0, wallT, h, l],
  ];
  for (const [x, y, z, sx, sy, sz] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMat);
    m.position.set(x, y, z);
    g.add(m);
  }

  const table = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.7), wood);
  table.position.set(0, 0.78, 0.4);
  g.add(table);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.08), wood);
  for (const [lx, lz] of [[-0.45, 0.2], [0.45, 0.2], [-0.45, 0.6], [0.45, 0.6]] as const) {
    const p = leg.clone();
    p.position.set(lx, 0.37, lz);
    g.add(p);
  }

  const bunk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.9), wood);
  bunk.position.set(-w / 2 + 0.7, 0.42, -0.4);
  g.add(bunk);

  const hatchPad = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), trim);
  hatchPad.name = 'cabin_exit_pad';
  hatchPad.position.set(0, 0.14, -l / 2 + 0.7);
  g.add(hatchPad);

  const lantern = new THREE.PointLight(0xffcc88, 4, 8, 2);
  lantern.position.set(0, h - 0.35, 0);
  g.add(lantern);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 1.4 }),
  );
  glow.position.copy(lantern.position);
  g.add(glow);

  return g;
}

function makeDeckHatch(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.08, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }),
  );
  m.name = 'cabin_hatch';
  return m;
}

export function createCaptainsQuarters(boatId: BoatId): CaptainsQuartersHandle | null {
  if (!boatHasCabin(boatId)) return null;
  const { w, l } = cabinSize(boatId);
  const group = buildProceduralCabin(boatId);
  group.position.set(0, CABIN_WORLD_Y, 0);
  group.visible = true;
  const handle: CaptainsQuartersHandle = {
    group,
    hatchLocal: new THREE.Vector3(0, 0.42, -l * 0.32),
    floorY: CABIN_WORLD_Y + 0.12,
    half: { x: w * 0.45, z: l * 0.45 },
    boatId,
  };
  void trySwapCabinGlb(group);
  return handle;
}

async function trySwapCabinGlb(group: THREE.Group): Promise<void> {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(CABIN_GLB);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const target = 4.2;
    const s = target / Math.max(size.z, size.x, 0.1);
    model.scale.setScalar(s);
    box.setFromObject(model);
    model.position.y = -box.min.y;
    while (group.children.length) group.remove(group.children[0]);
    group.add(model);
    const light = new THREE.PointLight(0xffcc88, 4, 8, 2);
    light.position.set(0, 1.8, 0);
    group.add(light);
  } catch {
    /* procedural cabin stays — no quarters GLB on disk yet */
  }
}

export function syncQuartersToShip(
  handle: CaptainsQuartersHandle,
  shipX: number,
  shipZ: number,
): void {
  handle.group.position.set(shipX, CABIN_WORLD_Y, shipZ);
}

export function hatchWorldOnDeck(
  handle: CaptainsQuartersHandle,
  shipPos: THREE.Vector3,
  shipYaw: number,
): THREE.Vector3 {
  const c = Math.cos(shipYaw);
  const s = Math.sin(shipYaw);
  const lx = handle.hatchLocal.x;
  const lz = handle.hatchLocal.z;
  return new THREE.Vector3(
    shipPos.x + lx * c + lz * s,
    shipPos.y + handle.hatchLocal.y,
    shipPos.z - lx * s + lz * c,
  );
}

export function nearHatch(
  player: THREE.Vector3,
  hatch: THREE.Vector3,
  radius = 1.15,
): boolean {
  const dx = player.x - hatch.x;
  const dz = player.z - hatch.z;
  const dy = player.y - hatch.y;
  return dx * dx + dz * dz < radius * radius && Math.abs(dy) < 1.4;
}

export function cabinStandPosition(handle: CaptainsQuartersHandle): THREE.Vector3 {
  return new THREE.Vector3(
    handle.group.position.x,
    handle.floorY + WORLD_SI.humanHeightM * 0.08,
    handle.group.position.z - handle.half.z * 0.35,
  );
}

export function attachDeckHatch(deckParent: THREE.Object3D, handle: CaptainsQuartersHandle): THREE.Mesh {
  const hatch = makeDeckHatch();
  hatch.position.copy(handle.hatchLocal);
  deckParent.add(hatch);
  return hatch;
}
