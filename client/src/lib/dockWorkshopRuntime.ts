/**
 * Dock-workshop play extras — deck XYZ, marine Yuka, simple mixers.
 * Extends deckPlacement + MarineYukaSystem. Not a second ocean AI.
 */

import * as THREE from 'three';
import type { BoatId } from '@shared/gameDefinitions/boatRegistry';
import { defaultStationPoses, type DeckStationPose } from '@/lib/deckPlacement';
import { MarineYukaSystem } from '@/lib/ai/MarineYukaSystem';
import type { WaterNode } from '@/lib/islandsCanonical/WaterNodes';
import { normalizeToMetres } from '@/lib/modelNormalize';

export interface DeckXyzRow {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
}

const KIND_COLOR: Record<string, number> = {
  helm: 0xc4a35a,
  cannon: 0xcc5533,
  harpoon: 0x88aa55,
  sniper_nest: 0x55aa88,
  mage_spot: 0x6677ff,
};

function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(8,6,4,0.72)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = color;
  ctx.font = '18px sans-serif';
  ctx.fillText(text, 8, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(1.8, 0.45, 1);
  s.position.y = 1.15;
  s.userData.editorIgnore = true;
  return s;
}

/** World-space deck pads + XYZ labels parented to the working hull. */
export function attachDeckXyz(
  hullObj: THREE.Object3D,
  hullId: BoatId,
): { group: THREE.Group; rows: DeckXyzRow[] } {
  const group = new THREE.Group();
  group.name = 'deck_xyz';
  const poses: DeckStationPose[] = defaultStationPoses(hullId);
  const rows: DeckXyzRow[] = [];
  const axes = new THREE.AxesHelper(1.8);
  axes.name = 'si_xyz_1_8m';
  axes.userData.editorIgnore = true;
  group.add(axes);

  for (const p of poses) {
    const g = new THREE.Group();
    g.position.set(p.position[0], p.position[1], p.position[2]);
    g.rotation.y = p.yaw;
    const col = KIND_COLOR[p.kind] ?? 0xffffff;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.06, 0.45),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 }),
    );
    pad.userData.editorIgnore = true;
    g.add(pad);
    g.add(new THREE.AxesHelper(0.55));
    const [x, y, z] = p.position;
    const id = `${p.kind}-${p.slotIndex}`;
    g.add(makeLabelSprite(`${id}  ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`, '#f0d48a'));
    group.add(g);
    rows.push({ id, kind: p.kind, x, y, z });
  }
  hullObj.add(group);
  return { group, rows };
}

export function workshopWaterNodes(): WaterNode[] {
  const pts: Array<[number, number, number, WaterNode['band']]> = [
    [6, -2.2, 8, 'SHALLOW'],
    [-4, -2.5, 10, 'SHALLOW'],
    [10, -3.0, 4, 'SHALLOW'],
    [8, -7.0, 14, 'MID'],
    [-8, -8.0, 12, 'MID'],
    [0, -9.0, 18, 'MID'],
  ];
  return pts.map((p, i) => ({
    id: `water:workshop:${p[3]}:${i}:0`,
    bandIndex: i,
    band: p[3],
    position: new THREE.Vector3(p[0], p[1], p[2]),
    seabedY: -12,
    nearestShoreDist: 6,
  }));
}

export function bindWorkshopCreatures(
  root: THREE.Object3D,
  marine: MarineYukaSystem,
  mixers: THREE.AnimationMixer[],
): number {
  marine.setWaterNodes(workshopWaterNodes());
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const name = `${mesh.name} ${mesh.parent?.name || ''}`.toLowerCase();
    if (!/fish|shark|whale|manta|dolphin|smol/.test(name)) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > 3.2) {
      normalizeToMetres(mesh, { targetSizeM: 0.45, axis: 'length', center: false });
    }
    const predator = /shark|squalo/.test(name);
    marine.register({
      mesh,
      role: predator ? 'predator' : 'wanderer',
      band: predator ? 'MID' : 'SHALLOW',
      maxSpeed: predator ? 3.2 : 1.6,
    });
    n += 1;
  });
  return n;
}

export function playSceneClips(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
  mixers: THREE.AnimationMixer[],
): void {
  if (!clips.length) return;
  const mixer = new THREE.AnimationMixer(root);
  for (const clip of clips) mixer.clipAction(clip).play();
  mixers.push(mixer);
}

export function bobCreatures(root: THREE.Object3D, t: number): void {
  root.traverse((o) => {
    const name = o.name.toLowerCase();
    if (!/fish|smol/.test(name)) return;
    o.position.y += Math.sin(t * 1.6 + o.uuid.length) * 0.002;
  });
}
