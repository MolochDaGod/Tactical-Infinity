import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TerrainData } from './islandHeightmapTerrain';

export interface DockData {
  group: THREE.Group;
  spawnPoint: THREE.Vector3;
  approachPoint: THREE.Vector3;
  interactionZone: THREE.Box3;
  side: 'north' | 'south' | 'east' | 'west';
}

function findBestBeachPoint(
  terrain: TerrainData,
  side: 'north' | 'south' | 'east' | 'west'
): { x: number; z: number; angle: number } {
  const r = terrain.radius;
  const scanDist = r * 0.42;

  let bestX = 0, bestZ = 0;
  switch (side) {
    case 'south': bestX = 0; bestZ = scanDist; break;
    case 'north': bestX = 0; bestZ = -scanDist; break;
    case 'east':  bestX = scanDist; bestZ = 0; break;
    case 'west':  bestX = -scanDist; bestZ = 0; break;
  }

  const searchRadius = 20;
  const steps = 12;
  let lowestSlope = Infinity;
  let chosenX = bestX, chosenZ = bestZ;

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 0.5 - Math.PI * 0.25;
    let sx: number, sz: number;
    switch (side) {
      case 'south': sx = bestX + Math.sin(t) * searchRadius; sz = bestZ; break;
      case 'north': sx = bestX + Math.sin(t) * searchRadius; sz = bestZ; break;
      case 'east':  sx = bestX; sz = bestZ + Math.sin(t) * searchRadius; break;
      case 'west':  sx = bestX; sz = bestZ + Math.sin(t) * searchRadius; break;
      default: sx = bestX; sz = bestZ;
    }
    const h = terrain.getHeightAt(sx, sz);
    const slope = terrain.getSlopeAt(sx, sz);
    if (h > -1 && h < 6 && slope < lowestSlope) {
      lowestSlope = slope;
      chosenX = sx;
      chosenZ = sz;
    }
  }

  let angle = 0;
  switch (side) {
    case 'south': angle = 0; break;
    case 'north': angle = Math.PI; break;
    case 'east':  angle = -Math.PI / 2; break;
    case 'west':  angle = Math.PI / 2; break;
  }

  return { x: chosenX, z: chosenZ, angle };
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

export function createDock(
  terrain: TerrainData,
  side: 'north' | 'south' | 'east' | 'west' = 'south',
): DockData {
  const beach = findBestBeachPoint(terrain, side);
  const dockGroup = new THREE.Group();
  dockGroup.name = 'island_dock';

  const proceduralDock = buildProceduralDock();
  dockGroup.add(proceduralDock);

  dockGroup.rotation.y = beach.angle;

  const terrainH = terrain.getHeightAt(beach.x, beach.z);
  const dockY = Math.max(terrainH * 0.25, -0.3);
  dockGroup.position.set(beach.x, dockY, beach.z);

  const outwardDir = new THREE.Vector3();
  switch (side) {
    case 'south': outwardDir.set(0, 0, 1); break;
    case 'north': outwardDir.set(0, 0, -1); break;
    case 'east':  outwardDir.set(1, 0, 0); break;
    case 'west':  outwardDir.set(-1, 0, 0); break;
  }

  const spawnPoint = new THREE.Vector3(
    beach.x + outwardDir.x * 2,
    dockY + 0.6,
    beach.z + outwardDir.z * 2,
  );

  const approachPoint = new THREE.Vector3(
    beach.x + outwardDir.x * 22,
    0,
    beach.z + outwardDir.z * 22,
  );

  const zoneCenter = new THREE.Vector3(beach.x, dockY, beach.z);
  const zoneHalf = new THREE.Vector3(5, 3, 12);
  const interactionZone = new THREE.Box3(
    zoneCenter.clone().sub(zoneHalf),
    zoneCenter.clone().add(zoneHalf),
  );

  const glbLoader = new GLTFLoader();
  glbLoader.load(
    '/models/docks/wooden_dock.gltf',
    (gltf) => {
      const model = gltf.scene;
      model.name = 'dock_glb';

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetLength = 16;
      const scaleFactor = targetLength / Math.max(size.x, size.z);
      model.scale.setScalar(scaleFactor);
      model.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor + 0.5, -center.z * scaleFactor);

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      proceduralDock.visible = false;
      dockGroup.add(model);
    },
    undefined,
    () => {
      proceduralDock.visible = true;
    }
  );

  return {
    group: dockGroup,
    spawnPoint,
    approachPoint,
    interactionZone,
    side,
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
