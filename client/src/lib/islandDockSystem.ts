import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  getDockKind,
  type DeckStationKind,
  type DockKind,
} from '@shared/gameDefinitions/waterEngagement';
import { VIKING_FISHERMAN_PACK } from '@shared/nature/vikingFishermanDock';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';
import { normalizeToMetres } from '@/lib/modelNormalize';
import type { TerrainData } from './islandHeightmapTerrain';

export interface DockData {
  group: THREE.Group;
  spawnPoint: THREE.Vector3;
  approachPoint: THREE.Vector3;
  interactionZone: THREE.Box3;
  side: 'north' | 'south' | 'east' | 'west';
  kind: DockKind;
  /** World-space berth points (keel rest), seaward of the pier. */
  berths: THREE.Vector3[];
}

export interface CreateDockOptions {
  kind?: DockKind;
}

function findBestBeachPoint(
  terrain: TerrainData,
  side: 'north' | 'south' | 'east' | 'west'
): { x: number; z: number; angle: number } {
  const r = terrain.radius;
  let ox = 0, oz = 1;
  let angle = 0;
  switch (side) {
    case 'south': ox = 0; oz = 1; angle = 0; break;
    case 'north': ox = 0; oz = -1; angle = Math.PI; break;
    case 'east':  ox = 1; oz = 0; angle = -Math.PI / 2; break;
    case 'west':  ox = -1; oz = 0; angle = Math.PI / 2; break;
  }

  // Walk center → sea and take the last dry cell (real shoreline).
  // Old code pinned at 0.42*radius — that is still inland on a r=200 island.
  let shoreX = ox * r * 0.35;
  let shoreZ = oz * r * 0.35;
  let bestScore = -Infinity;
  const steps = 48;
  for (let i = 8; i < steps; i++) {
    const dist = (i / steps) * r * 0.98;
    const cx = ox * dist;
    const cz = oz * dist;
    const h = terrain.getHeightAt(cx, cz);
    if (h < 0.15 || h > 4.5) continue;
    const slope = terrain.getSlopeAt(cx, cz);
    const nextH = terrain.getHeightAt(cx + ox * 6, cz + oz * 6);
    const seaward = nextH < h ? 1 : 0.2;
    const score = seaward * 2 + (1 - Math.min(1, slope)) + (h < 2 ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      shoreX = cx;
      shoreZ = cz;
    }
  }

  // Nudge sideways along the coast for a flatter pad
  const tx = -oz, tz = ox;
  for (const lat of [-16, -8, 8, 16]) {
    const sx = shoreX + tx * lat;
    const sz = shoreZ + tz * lat;
    const h = terrain.getHeightAt(sx, sz);
    if (h < 0.15 || h > 3.5) continue;
    const slope = terrain.getSlopeAt(sx, sz);
    if (slope < terrain.getSlopeAt(shoreX, shoreZ)) {
      shoreX = sx;
      shoreZ = sz;
    }
  }

  return { x: shoreX, z: shoreZ, angle };
}

function buildProceduralDock(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'dock_procedural';

  const wood = new THREE.MeshStandardMaterial({
    color: 0x8B6F47,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
  });
  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x5C3D1E,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  const rope = new THREE.MeshStandardMaterial({
    color: 0xA09070,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.6,
    metalness: 0.4,
    flatShading: true,
  });

  const DOCK_LENGTH = 18;
  const DOCK_WIDTH = 3.5;
  const PLANK_H = 0.12;
  const PILE_HEIGHT = 4.0;

  const deckPlanks = new THREE.Group();
  deckPlanks.name = 'deck_planks';
  const plankCount = 14;
  const plankW = DOCK_WIDTH / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankW * 0.92, PLANK_H, DOCK_LENGTH),
      wood.clone()
    );
    (plank.material as THREE.MeshStandardMaterial).color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
    plank.position.set(-DOCK_WIDTH / 2 + plankW * (i + 0.5), 0.5, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    deckPlanks.add(plank);
  }
  g.add(deckPlanks);

  const crossbeamCount = 4;
  for (let i = 0; i < crossbeamCount; i++) {
    const t = (i / (crossbeamCount - 1)) * DOCK_LENGTH - DOCK_LENGTH / 2;
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(DOCK_WIDTH + 0.4, 0.2, 0.18),
      darkWood
    );
    beam.position.set(0, 0.3, t);
    beam.castShadow = true;
    g.add(beam);
  }

  const pilePairs = 5;
  for (let i = 0; i < pilePairs; i++) {
    const z = -DOCK_LENGTH / 2 + (i / (pilePairs - 1)) * DOCK_LENGTH;
    for (const side of [-1, 1]) {
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, PILE_HEIGHT, 6),
        darkWood
      );
      pile.position.set(side * DOCK_WIDTH * 0.45, -PILE_HEIGHT / 2 + 0.5, z);
      pile.castShadow = true;
      g.add(pile);
    }
  }

  const railHeight = 0.8;
  for (const side of [-1, 1]) {
    const railing = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, DOCK_LENGTH),
      darkWood
    );
    railing.position.set(side * DOCK_WIDTH * 0.48, 0.5 + railHeight, 0);
    railing.castShadow = true;
    g.add(railing);

    const postCount = 7;
    for (let i = 0; i < postCount; i++) {
      const z = -DOCK_LENGTH / 2 + (i / (postCount - 1)) * DOCK_LENGTH;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, railHeight + 0.15, 0.08),
        darkWood
      );
      post.position.set(side * DOCK_WIDTH * 0.48, 0.5 + railHeight / 2, z);
      post.castShadow = true;
      g.add(post);
    }
  }

  for (let i = 0; i < 3; i++) {
    const z = -DOCK_LENGTH * 0.4 + i * DOCK_LENGTH * 0.35;
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8),
      darkWood
    );
    bollard.position.set(i % 2 === 0 ? -DOCK_WIDTH * 0.35 : DOCK_WIDTH * 0.35, 0.8, z);
    bollard.castShadow = true;
    g.add(bollard);

    const roopLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.02, 6, 12),
      rope
    );
    roopLoop.position.set(bollard.position.x, 1.05, z);
    roopLoop.rotation.x = Math.PI * 0.4;
    g.add(roopLoop);
  }

  const lanternPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6),
    metal
  );
  lanternPole.position.set(DOCK_WIDTH * 0.42, 0.5 + 0.9, -DOCK_LENGTH * 0.45);
  lanternPole.castShadow = true;
  g.add(lanternPole);

  const lanternGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffcc66,
      emissive: 0xffaa33,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    })
  );
  lanternGlow.position.set(DOCK_WIDTH * 0.42, 0.5 + 1.85, -DOCK_LENGTH * 0.45);
  g.add(lanternGlow);

  const lanternLight = new THREE.PointLight(0xffaa44, 1.5, 15, 2);
  lanternLight.position.copy(lanternGlow.position);
  g.add(lanternLight);

  const signPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.4, 0.1),
    darkWood
  );
  signPost.position.set(-DOCK_WIDTH * 0.35, 0.5 + 0.7, DOCK_LENGTH * 0.44);
  signPost.castShadow = true;
  g.add(signPost);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.6, 0.06),
    wood
  );
  signBoard.position.set(-DOCK_WIDTH * 0.35, 0.5 + 1.5, DOCK_LENGTH * 0.44);
  signBoard.castShadow = true;
  g.add(signBoard);

  return g;
}

const WOOD = () =>
  new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.85, flatShading: true });
const DARK_WOOD = () =>
  new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.9, flatShading: true });
const STONE = () =>
  new THREE.MeshStandardMaterial({ color: 0x6a6860, roughness: 0.92, flatShading: true });

/** Sync visual for a dock kind (RTS placeable + island). Viking overlays async. */
export function buildDockVisual(kind: DockKind): THREE.Group {
  const def = getDockKind(kind);
  const g = new THREE.Group();
  g.name = `dock_${kind}`;
  g.userData.dockKind = kind;

  const length = def.lengthM;
  const width = def.widthM;
  const plankH = 0.14;
  const pileH = 4.2;
  const deckY = 0.55;

  const wood = WOOD();
  const dark = DARK_WOOD();
  const stone = STONE();

  const plankCount = Math.max(8, Math.round(width / 0.28));
  const plankW = width / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankW * 0.9, plankH, length),
      wood.clone(),
    );
    (plank.material as THREE.MeshStandardMaterial).color.offsetHSL(0, 0, ((i % 5) - 2) * 0.015);
    plank.position.set(-width / 2 + plankW * (i + 0.5), deckY, 0);
    plank.castShadow = plank.receiveShadow = true;
    g.add(plank);
  }

  const beams = kind === 'fishing_dock' ? 3 : kind === 'war_dock' || kind === 'capital_dock' ? 6 : 5;
  for (let i = 0; i < beams; i++) {
    const z = (i / (beams - 1)) * length - length / 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, 0.18, 0.2), dark);
    beam.position.set(0, deckY - 0.16, z);
    beam.castShadow = true;
    g.add(beam);
  }

  const pilePairs = Math.max(4, Math.round(length / 4.5));
  for (let i = 0; i < pilePairs; i++) {
    const z = -length / 2 + (i / (pilePairs - 1)) * length;
    for (const side of [-1, 1] as const) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, pileH, 6), dark);
      pile.position.set(side * width * 0.46, deckY - pileH / 2 + 0.05, z);
      pile.castShadow = true;
      g.add(pile);
    }
  }

  if (kind === 'war_dock' || kind === 'capital_dock') {
    for (const side of [-1, 1] as const) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, length * 0.92), stone);
      parapet.position.set(side * (width * 0.5 + 0.1), deckY + 0.4, 0);
      parapet.castShadow = true;
      g.add(parapet);
    }
  } else {
    for (const side of [-1, 1] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, length), dark);
      rail.position.set(side * width * 0.48, deckY + 0.85, 0);
      g.add(rail);
    }
  }

  // Berth notches along starboard — hulls rest here
  for (let i = 0; i < def.berths; i++) {
    const z = -length * 0.35 + (i / Math.max(1, def.berths - 1)) * length * 0.7;
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.18), dark);
    cleat.position.set(width * 0.42, deckY + 0.12, z);
    cleat.name = `berth_cleat_${i}`;
    g.add(cleat);
  }

  addPierStationPads(g, def.stationPads, length, width, deckY);

  if (kind === 'boat_dock' || kind === 'capital_dock') {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 3.2), wood);
    shed.position.set(-width * 0.15, deckY + 0.95, -length * 0.38);
    shed.castShadow = true;
    g.add(shed);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.12, 3.5),
      new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.85 }),
    );
    roof.position.set(shed.position.x, deckY + 1.95, shed.position.z);
    roof.rotation.z = 0.08;
    g.add(roof);
  }

  return g;
}

function addPierStationPads(
  g: THREE.Group,
  pads: readonly DeckStationKind[],
  length: number,
  width: number,
  deckY: number,
): void {
  pads.forEach((kind, i) => {
    const z = -length * 0.28 + (i / Math.max(1, pads.length - 1)) * length * 0.55;
    const x = i % 2 === 0 ? -width * 0.28 : width * 0.22;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.08, 10),
      new THREE.MeshStandardMaterial({
        color: kind === 'mage_spot' ? 0x4455aa : kind === 'cannon' ? 0x333333 : 0x6b5344,
        roughness: 0.7,
        emissive: kind === 'mage_spot' ? 0x223366 : 0x000000,
        emissiveIntensity: kind === 'mage_spot' ? 0.35 : 0,
      }),
    );
    pad.position.set(x, deckY + 0.08, z);
    pad.name = `pier_pad_${kind}_${i}`;
    pad.userData.deckStation = kind;
    g.add(pad);
  });
}

function defInlandOffset(parent: THREE.Object3D): number {
  const kind = (parent.userData.dockKind as DockKind | undefined) ?? 'capital_dock';
  return getDockKind(kind).lengthM * 0.42;
}

function loadVikingDockInto(parent: THREE.Group, hideWhenReady: THREE.Object3D): void {
  const loader = new GLTFLoader();
  const url = resolveGrudgeAssetUrl(VIKING_FISHERMAN_PACK.local);
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'viking_fisherman_dock';
      normalizeToMetres(model, {
        targetSizeM: VIKING_FISHERMAN_PACK.targetHeightM,
        axis: 'height',
        ground: true,
        centerXZ: true,
      });
      // House sits inland of the pier — never hide the playable dock.
      model.position.set(0, 0.05, -defInlandOffset(parent));
      model.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      hideWhenReady.visible = true;
      parent.add(model);
    },
    undefined,
    () => {
      hideWhenReady.visible = true;
    },
  );
}

export function createDock(
  terrain: TerrainData,
  side: 'north' | 'south' | 'east' | 'west' = 'south',
  opts: CreateDockOptions = {},
): DockData {
  const kind: DockKind = opts.kind ?? 'boat_dock';
  const def = getDockKind(kind);
  const beach = findBestBeachPoint(terrain, side);
  const dockGroup = new THREE.Group();
  dockGroup.name = `island_dock_${kind}`;

  const visual = buildDockVisual(kind);
  dockGroup.add(visual);
  dockGroup.userData.dockKind = kind;

  if (def.prefab === 'viking_fisherman' || def.prefab === 'capital') {
    loadVikingDockInto(dockGroup, visual);
  }

  // Modular wooden pier kit — tiles over the box fallback when the pack loads.
  void import('@/lib/pierKit').then(async ({ loadPierKit, assemblePierRun, PIER_PARTS }) => {
    const kit = await loadPierKit();
    if (!kit) return;
    const straight = PIER_PARTS.find((p) => p.id === 'walk_a');
    const end = PIER_PARTS.find((p) => p.id === 'end_a');
    if (!straight || !end) return;
    const tiles = Math.max(1, Math.round(def.lengthM / straight.lengthM) - 1);
    const run = assemblePierRun(kit, tiles, straight, end);
    run.position.y = 0.02;
    visual.visible = false;
    dockGroup.add(run);
  });

  dockGroup.rotation.y = beach.angle;

  // Deck sits just above sea (y=0). Do not bury the pier at 0.25*hill height.
  const dockY = 0.48;
  dockGroup.position.set(beach.x, dockY, beach.z);

  const outwardDir = new THREE.Vector3();
  switch (side) {
    case 'south': outwardDir.set(0, 0, 1); break;
    case 'north': outwardDir.set(0, 0, -1); break;
    case 'east':  outwardDir.set(1, 0, 0); break;
    case 'west':  outwardDir.set(-1, 0, 0); break;
  }

  // Slide the pier seaward so most of the length is over water, land end on the beach.
  dockGroup.position.add(outwardDir.clone().multiplyScalar(def.lengthM * 0.28));

  const spawnPoint = new THREE.Vector3(
    dockGroup.position.x + outwardDir.x * 2,
    dockY + 0.62,
    dockGroup.position.z + outwardDir.z * 2,
  );

  const approachPoint = new THREE.Vector3(
    dockGroup.position.x + outwardDir.x * (def.lengthM * 0.55),
    0,
    dockGroup.position.z + outwardDir.z * (def.lengthM * 0.55),
  );

  const berths: THREE.Vector3[] = [];
  const right = new THREE.Vector3(-outwardDir.z, 0, outwardDir.x);
  for (let i = 0; i < def.berths; i++) {
    const along = -def.lengthM * 0.28 + (i / Math.max(1, def.berths - 1)) * def.lengthM * 0.56;
    berths.push(
      new THREE.Vector3(
        dockGroup.position.x + outwardDir.x * 7 + right.x * along,
        dockY + 0.15,
        dockGroup.position.z + outwardDir.z * 7 + right.z * along,
      ),
    );
  }

  const zoneCenter = new THREE.Vector3(beach.x, dockY, beach.z);
  const zoneHalf = new THREE.Vector3(def.widthM, 3, def.lengthM * 0.55);
  const interactionZone = new THREE.Box3(
    zoneCenter.clone().sub(zoneHalf),
    zoneCenter.clone().add(zoneHalf),
  );

  return {
    group: dockGroup,
    spawnPoint,
    approachPoint,
    interactionZone,
    side,
    kind,
    berths,
  };
}

export function isPlayerNearDock(playerPos: THREE.Vector3, dock: DockData, threshold = 6): boolean {
  const dx = playerPos.x - dock.group.position.x;
  const dz = playerPos.z - dock.group.position.z;
  return Math.sqrt(dx * dx + dz * dz) < threshold;
}

export function getDockInteractionPrompt(dock: DockData): string {
  return `Press [F] to set sail`;
}
