/**
 * Fleet island shell seeds — SSOT for sector → CDN shell mapping.
 * Data: public/models/islands/island_fleet_seeds.json (also mirrored on CDN path).
 *
 * Production rule: use water.grudge-studio.com world map sectors with these shells.
 * Always isolate multipack meshNames when present.
 */

import { WARLORDS_CDN } from '@/lib/warlordsNatureCDN';

export type FleetShellDef = {
  r2Key: string;
  cdn: string;
  roles: string[];
  isolate?: string[];
};

export type IslandFleetSeedsFile = {
  version: number;
  shells: Record<string, FleetShellDef>;
  scatter?: Record<string, unknown>;
  sectorShells: Record<string, string>;
};

let cached: IslandFleetSeedsFile | null = null;

const FALLBACK: IslandFleetSeedsFile = {
  version: 1,
  shells: {
    tropical_island: {
      r2Key: 'models/islands/shells/tropical_island.glb',
      cdn: `${WARLORDS_CDN}/models/islands/shells/tropical_island.glb`,
      roles: ['sector', 'event', 'beach'],
    },
    low_poly_island: {
      r2Key: 'models/islands/shells/low_poly_island.glb',
      cdn: `${WARLORDS_CDN}/models/islands/shells/low_poly_island.glb`,
      roles: ['sector', 'event'],
    },
    islands_pack: {
      r2Key: 'models/islands/shells/islands_pack.glb',
      cdn: `${WARLORDS_CDN}/models/islands/shells/islands_pack.glb`,
      isolate: ['Island 1', 'Island 2', 'Island 3', 'Island 4', 'Island 5', 'Island 6'],
      roles: ['sector', 'beach', 'event'],
    },
    chicken_gun_islands: {
      r2Key: 'models/islands/shells/chicken_gun_islands.glb',
      cdn: `${WARLORDS_CDN}/models/islands/shells/chicken_gun_islands.glb`,
      isolate: ['island_base', 'island_small', 'island_tiny', 'island_vulcano'],
      roles: ['sector', 'beach', 'event'],
    },
  },
  sectorShells: {
    '1': 'islands_pack',
    '2': 'tropical_island',
    '3': 'low_poly_island',
    '4': 'chicken_gun_islands',
    '5': 'low_poly_island',
    '6': 'tropical_island',
    '7': 'low_poly_island',
    '8': 'chicken_gun_islands',
    '9': 'islands_pack',
  },
};

/** Load fleet seeds (once). Falls back to inlined SSOT if JSON missing. */
export async function loadIslandFleetSeeds(): Promise<IslandFleetSeedsFile> {
  if (cached) return cached;
  try {
    const res = await fetch('/models/islands/island_fleet_seeds.json', {
      credentials: 'same-origin',
    });
    if (res.ok) {
      const data = (await res.json()) as IslandFleetSeedsFile;
      if (data?.shells && data?.sectorShells) {
        cached = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('[islandFleetSeeds] fetch failed, using fallback', e);
  }
  cached = FALLBACK;
  return FALLBACK;
}

export type SectorShellResolve = {
  sectorId: string | number;
  shellKey: string;
  shell: FleetShellDef;
  /** When multipack: pick isolate mesh by sector hash for determinism */
  meshName?: string;
  /** Deterministic seed for heightmap/scatter on this sector island */
  seed: number;
};

/** Map ocean sector 1–9 → shell + optional meshName + seed. */
export function resolveSectorShell(
  data: IslandFleetSeedsFile,
  sectorId: string | number,
): SectorShellResolve | null {
  const key = String(sectorId);
  const raw = data.sectorShells[key];
  if (!raw) return null;
  // Support "shell+landmark" compound — use first shell id
  const shellKey = raw.split('+')[0]!.trim();
  const shell = data.shells[shellKey];
  if (!shell) return null;

  const sid = typeof sectorId === 'number' ? sectorId : parseInt(key, 10) || 0;
  const seed = (0x5eed ^ (sid * 0x9e3779b9)) >>> 0;

  let meshName: string | undefined;
  if (shell.isolate?.length) {
    meshName = shell.isolate[sid % shell.isolate.length];
  }

  return { sectorId, shellKey, shell, meshName, seed };
}

/** All sector resolves for world-map placement. */
export function listSectorShells(data: IslandFleetSeedsFile): SectorShellResolve[] {
  return Object.keys(data.sectorShells)
    .map((id) => resolveSectorShell(data, id))
    .filter((x): x is SectorShellResolve => !!x);
}
