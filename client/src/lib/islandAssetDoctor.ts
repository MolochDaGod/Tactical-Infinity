/**
 * Island boot check — SI size + best-asset HEADs.
 * Race kit GLB on assets.grudge-studio.com is the play mesh (not extra FBX).
 */

import * as THREE from 'three';

const HUMAN_HEIGHT_M = 1.8;

const BEST_KIT = 'https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/human.glb';

export interface IslandDoctorReport {
  kitOk: boolean;
  captainHeightM: number | null;
  harvestNodes: number;
  ok: boolean;
}

export async function runIslandAssetDoctor(opts: {
  captain?: THREE.Object3D | null;
  harvestCount: number;
}): Promise<IslandDoctorReport> {
  let kitOk = false;
  try {
    const r = await fetch(BEST_KIT, { method: 'HEAD' });
    kitOk = r.ok;
  } catch {
    kitOk = false;
  }

  let captainHeightM: number | null = null;
  if (opts.captain) {
    const box = new THREE.Box3().setFromObject(opts.captain);
    captainHeightM = box.getSize(new THREE.Vector3()).y;
  }

  const heightOk =
    captainHeightM == null ||
    (captainHeightM >= HUMAN_HEIGHT_M * 0.7 && captainHeightM <= HUMAN_HEIGHT_M * 1.4);

  const report: IslandDoctorReport = {
    kitOk,
    captainHeightM,
    harvestNodes: opts.harvestCount,
    ok: kitOk && heightOk,
  };
  console.info(
    '[island-doctor]',
    report.ok ? 'ok' : 'WARN',
    `kit=${kitOk}`,
    `captain=${captainHeightM?.toFixed(2) ?? 'n/a'}m (want ~${HUMAN_HEIGHT_M})`,
    `harvestNodes=${opts.harvestCount}`,
  );
  return report;
}
