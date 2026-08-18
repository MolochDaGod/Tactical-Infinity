/**
 * Play-mode deck station placement — consumes waterEngagement DECK_STATIONS
 * + ShipRig anchors. Visual pads for cannon / harpoon / sniper nest / mage / helm.
 *
 * SI: 1 unit = 1 m. Layouts are ship-local (+Z bow, +X starboard).
 */

import * as THREE from 'three';
import type { BoatId } from '@shared/gameDefinitions/boatRegistry';
import {
  defaultDeckLoadout,
  getDeckStation,
  getHullDeckBudget,
  type DeckStationKind,
  type PlacedDeckStation,
} from '@shared/gameDefinitions/waterEngagement';

const STATION_COLOR: Record<DeckStationKind, number> = {
  helm: 0xc4a35a,
  cannon: 0x3a3a3a,
  harpoon: 0x6b5344,
  sniper_nest: 0x4a6b4a,
  mage_spot: 0x4a4a88,
};

/** Typical hull size (metres) used when the GLB has no named anchors. */
const HULL_SI: Record<BoatId, { length: number; beam: number; deckY: number; nestY: number }> = {
  raft: { length: 5.5, beam: 2.4, deckY: 0.7, nestY: 2.4 },
  skiff: { length: 8, beam: 2.8, deckY: 0.95, nestY: 3.6 },
  sloop: { length: 12, beam: 3.6, deckY: 1.15, nestY: 5.2 },
  brigantine: { length: 18, beam: 4.6, deckY: 1.35, nestY: 6.4 },
  galleon: { length: 28, beam: 6.2, deckY: 1.55, nestY: 8.0 },
  manOWar: { length: 36, beam: 7.2, deckY: 1.7, nestY: 9.2 },
};

export interface DeckStationPose {
  kind: DeckStationKind;
  slotIndex: number;
  /** Ship-local metres. */
  position: [number, number, number];
  /** Yaw radians; 0 = bow (+Z). */
  yaw: number;
}

/** Deterministic SI poses for a hull budget. */
export function defaultStationPoses(hull: BoatId): DeckStationPose[] {
  const si = HULL_SI[hull];
  const halfL = si.length * 0.38;
  const halfB = si.beam * 0.38;
  const y = si.deckY;
  const out: DeckStationPose[] = [];
  const b = getHullDeckBudget(hull);

  out.push({ kind: 'helm', slotIndex: 0, position: [0, y, -halfL * 0.72], yaw: 0 });

  const portStarboard = (count: number, kind: DeckStationKind, z0: number, zStep: number) => {
    for (let i = 0; i < count; i++) {
      const port = i % 2 === 0;
      const row = Math.floor(i / 2);
      out.push({
        kind,
        slotIndex: i,
        position: [port ? -halfB : halfB, y, z0 - row * zStep],
        yaw: port ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  };

  if (b.cannon === 1) {
    out.push({ kind: 'cannon', slotIndex: 0, position: [0, y, halfL * 0.55], yaw: 0 });
  } else {
    portStarboard(b.cannon, 'cannon', halfL * 0.25, Math.max(1.8, si.length * 0.12));
  }

  if (b.harpoon === 1) {
    out.push({ kind: 'harpoon', slotIndex: 0, position: [0, y, halfL * 0.82], yaw: 0 });
  } else {
    portStarboard(b.harpoon, 'harpoon', halfL * 0.7, 1.6);
  }

  if (b.sniperNest) {
    out.push({ kind: 'sniper_nest', slotIndex: 0, position: [0, si.nestY, 0], yaw: 0 });
  }

  if (b.mageSpot === 1) {
    out.push({ kind: 'mage_spot', slotIndex: 0, position: [-halfB * 0.35, y, -halfL * 0.35], yaw: 0 });
  } else {
    for (let i = 0; i < b.mageSpot; i++) {
      const port = i % 2 === 0;
      out.push({
        kind: 'mage_spot',
        slotIndex: i,
        position: [port ? -halfB * 0.4 : halfB * 0.4, y, -halfL * 0.28],
        yaw: 0,
      });
    }
  }

  return out;
}

export function poseForStation(
  hull: BoatId,
  kind: DeckStationKind,
  slotIndex: number,
): DeckStationPose | null {
  return defaultStationPoses(hull).find((p) => p.kind === kind && p.slotIndex === slotIndex) ?? null;
}

function makeStationMesh(kind: DeckStationKind, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = `deck_station_${kind}`;
  const def = getDeckStation(kind);
  const c = STATION_COLOR[kind];
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.55 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x4a6b88, roughness: 0.75 });
  const rune = new THREE.MeshStandardMaterial({
    color: 0x6677ff,
    emissive: 0x3344aa,
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });

  const w = def.footprintM.width * scale;
  const d = def.footprintM.depth * scale;
  const h = def.footprintM.height * scale;

  const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), wood);
  pad.position.y = 0.04;
  pad.castShadow = true;
  pad.receiveShadow = true;
  g.add(pad);

  if (kind === 'cannon') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.28, d * 0.45), wood);
    base.position.y = h * 0.2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.13 * scale, d * 0.85, 8), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, h * 0.45, d * 0.15);
    base.castShadow = barrel.castShadow = true;
    g.add(base, barrel);
  } else if (kind === 'harpoon') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, h, 6), wood);
    post.position.y = h * 0.5;
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, d * 0.9, 6), metal);
    spear.rotation.x = Math.PI / 2;
    spear.position.set(0, h * 0.75, d * 0.2);
    post.castShadow = spear.castShadow = true;
    g.add(post, spear);
  } else if (kind === 'sniper_nest') {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.4, 0.25 * scale, 8), wood);
    basket.position.y = 0.2;
    const rail = new THREE.Mesh(new THREE.TorusGeometry(w * 0.42, 0.03 * scale, 6, 12), metal);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.45 * scale;
    basket.castShadow = true;
    g.add(basket, rail);
  } else if (kind === 'mage_spot') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.38, 0.04 * scale, 8, 16), rune);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 10, 8), rune);
    orb.position.y = 0.28 * scale;
    g.add(ring, orb);
  } else if (kind === 'helm') {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 0.9 * scale, 8), wood);
    column.position.y = 0.5 * scale;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28 * scale, 0.035 * scale, 8, 14), wood);
    wheel.position.y = 0.95 * scale;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.04 * scale, 0.04 * scale), cloth);
    spoke.position.y = 0.95 * scale;
    column.castShadow = wheel.castShadow = true;
    g.add(column, wheel, spoke);
  }

  g.userData = { deckStation: kind, crewRole: def.crewRole };
  return g;
}

export interface MountedDeckStations {
  group: THREE.Group;
  meshes: THREE.Group[];
}

/**
 * Attach enabled stations to a ship (or dock) group. Positions are ship-local.
 */
export function mountDeckStations(
  parent: THREE.Object3D,
  hull: BoatId,
  loadout: PlacedDeckStation[] = defaultDeckLoadout(hull),
  opts?: { scale?: number; name?: string },
): MountedDeckStations {
  const group = new THREE.Group();
  group.name = opts?.name ?? `deck_stations_${hull}`;
  const scale = opts?.scale ?? 1;
  const meshes: THREE.Group[] = [];

  for (const placed of loadout) {
    if (!placed.enabled) continue;
    const pose = poseForStation(hull, placed.kind, placed.slotIndex);
    if (!pose) continue;
    const mesh = makeStationMesh(placed.kind, scale);
    mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
    mesh.rotation.y = pose.yaw;
    mesh.userData.slotIndex = placed.slotIndex;
    group.add(mesh);
    meshes.push(mesh);
  }

  parent.add(group);
  return { group, meshes };
}

export function disposeDeckStations(mounted: MountedDeckStations | null | undefined): void {
  if (!mounted) return;
  mounted.group.parent?.remove(mounted.group);
  mounted.group.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else (mat as THREE.Material | undefined)?.dispose();
    }
  });
}
