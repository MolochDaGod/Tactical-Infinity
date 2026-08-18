/**
 * Production share pin for water.grudge-studio.com / Tactical-Infinity.
 * Canonical: GrudgeBuilder shared/fleet/productionShare.ts
 */
export { FLEET_PLAY_SYSTEMS, FLEET_PLAY_SYSTEMS_VERSION } from './fleetPlaySystems';

export const PRODUCTION_SHARE = {
  version: '1.1.0',
  playSystemsVersion: '1.6.0',
  loader: {
    note: 'Use SharedGltf-equivalent Draco/Meshopt loader; no bare GLTFLoader',
  },
  physics: {
    island3dAuthority: 'CharacterController3D',
    dualPhysics: false,
  },
  combat: {
    skillRuntime: 'ProductionSkillCombatRuntime',
    lmb: 'tryBasicMeleeAttack / skill slot 1',
  },
  mounts: {
    ground: 'MountSummonSystem',
    hotkey: 'n',
    castSec: 2,
  },
  purgeList: [
    'new GLTFLoader() outside shared pipeline',
    'flat LMB damage without skill catalog',
    'land harvest in water columns',
  ],
} as const;
