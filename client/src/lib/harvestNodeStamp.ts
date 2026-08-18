/**
 * Every harvestable is a node — stamp + band + terrain snap.
 * Used by IslandStarterMission and HarvestNodeSystem.
 */

import * as THREE from 'three';
import { bandFor, type DepthBand } from '@/lib/islandsCanonical/depthBands';

export function professionForHarvestKind(kind: string): string {
  if (kind === 'tree') return 'woodcutting';
  if (kind === 'rock' || kind === 'stone') return 'quarrying';
  if (kind === 'mushroom' || kind === 'flower' || kind === 'fern' || kind === 'bush' || kind === 'hemp') {
    return 'herbalism';
  }
  return 'mining';
}

export function stampHarvestNode(
  obj: THREE.Object3D,
  spec: { id: string; kind: string },
): DepthBand | null {
  const band = bandFor(obj.position.y);
  obj.userData.harvestNode = true;
  obj.userData.harvestId = spec.id;
  obj.userData.harvestKind = spec.kind;
  obj.userData.harvestProfession = professionForHarvestKind(spec.kind);
  obj.userData.band = band;
  return band;
}

export function snapHarvestToTerrain(
  obj: THREE.Object3D,
  x: number,
  z: number,
  getHeightAt: (x: number, z: number) => number,
): number {
  const y = getHeightAt(x, z);
  obj.position.set(x, y, z);
  return y;
}
