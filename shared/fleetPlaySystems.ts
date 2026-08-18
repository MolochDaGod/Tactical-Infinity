/**
 * Fleet play systems bridge for Tactical-Infinity / water.grudge-studio.com
 *
 * Mirrors GrudgeBuilder `shared/fleet/playSystems.ts` FLEET_PLAY_SYSTEMS 1.3.0
 * so water SPA does not redefine hotkeys, mounts, or cursor contracts.
 *
 * Canonical source of truth: GrudgeBuilder shared/fleet + definitions.
 * When monorepo package `@grudge-studio/sdk` publishes playSystems, prefer that.
 */

export const FLEET_PLAY_SYSTEMS_VERSION = '1.6.0';

/** Three.js system node rules (mirror GrudgeBuilder threeGameSystem.ts) */
export const THREE_GAME_STACK = {
  node: '>=20',
  threeMin: '0.170.0',
  units: 'meters',
  time: 'seconds',
  colorSpace: 'SRGBColorSpace',
  maxPixelRatio: 1.5,
  noAllocInUpdate: true,
} as const;

/** Ground steed — never E (interact) */
export const MOUNT_SUMMON_KEY = 'n';
export const MOUNT_SUMMON_CAST_SEC = 2.0;

/** Dragon flight mount */
export const DRAGON_SUMMON_HOTKEY = 'Shift+N';
export const DRAGON_SUMMON_CAST_SEC = 2.0;
export const DRAGON_FLIGHT_TOGGLE = 'Space';

export const ALL_MOUNT_IDS = [
  'human',
  'barbarian',
  'elf',
  'dwarf',
  'orc',
  'undead',
] as const;

export type FleetMountId = (typeof ALL_MOUNT_IDS)[number];

const CDN = 'https://assets.grudge-studio.com';

export const TOON_RTS_MOUNT_URLS: Record<FleetMountId, string> = {
  human: `${CDN}/models/vehicles/mounts/human/cavalry.glb`,
  barbarian: `${CDN}/models/vehicles/mounts/barbarian/cavalry.glb`,
  elf: `${CDN}/models/vehicles/mounts/elf/cavalry.glb`,
  dwarf: `${CDN}/models/vehicles/mounts/dwarf/cavalry.glb`,
  orc: `${CDN}/models/vehicles/mounts/orc/cavalry.glb`,
  undead: `${CDN}/models/vehicles/mounts/undead/cavalry.glb`,
};

/** Production combat / play hotkeys (shared with client + Danger Room) */
export const FLEET_PLAY_HOTKEYS = {
  move: 'WASD',
  sprint: 'Shift',
  jump: 'Space',
  attack: 'LMB',
  heavy: 'V / MMB',
  block: 'Ctrl',
  dodge: 'F / X',
  skillSlots: '1-5',
  sheath: 'Z',
  softLockCycle: 'Tab',
  softLockCycleReverse: 'Shift+Tab',
  hardFocusToggle: 'RMB',
  interact: 'E',
  mountSummon: 'N',
  dragonSummon: 'Shift+N',
  toggleHarvestCombat: 'Q',
} as const;

export const FLEET_PLAY_RULES = {
  mountHotkey: 'n',
  mountNot: ['e'] as const,
  mountCastSec: 2,
  anyUnitMountsAnyOf6: true,
  dragonShiftN: true,
  softLock: 'Tab',
  hardFocus: 'RMB',
  cursorsPublicDir: '/cursors/',
  cursorsCdnDir: `${CDN}/ui/cursors/`,
  noMeshyPlaceholders: true,
} as const;

export const FLEET_PLAY_SYSTEMS = {
  version: FLEET_PLAY_SYSTEMS_VERSION,
  assetsCdn: CDN,
  hotkeys: FLEET_PLAY_HOTKEYS,
  mounts: {
    allIds: ALL_MOUNT_IDS,
    urls: TOON_RTS_MOUNT_URLS,
    hotkey: MOUNT_SUMMON_KEY,
    castSec: MOUNT_SUMMON_CAST_SEC,
    anyUnitAnyMount: true as const,
  },
  dragons: {
    hotkey: DRAGON_SUMMON_HOTKEY,
    castSec: DRAGON_SUMMON_CAST_SEC,
    flightToggle: DRAGON_FLIGHT_TOGGLE,
  },
  stack: THREE_GAME_STACK,
  rules: FLEET_PLAY_RULES,
} as const;

export function defaultMountForRace(riderRaceId: string): FleetMountId {
  const id = (riderRaceId || 'human').toLowerCase();
  return (ALL_MOUNT_IDS as readonly string[]).includes(id)
    ? (id as FleetMountId)
    : 'human';
}

export function resolveMountUrl(mountId: string): string {
  const id = defaultMountForRace(mountId);
  return TOON_RTS_MOUNT_URLS[id];
}
