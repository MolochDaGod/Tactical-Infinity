/**
 * Bridge between Tethical (Tactical-Infinity) and the Grudge Warlords fleet.
 * Maps world-map islands, boats, and navigation to grudgewarlords.com routes.
 */

/** Canonical fleet URLs — mirrors GrudgeBuilder `shared/fleet/manifest.ts`. */
export const GRUDGE_FLEET = {
  /** Grudge ID auth gateway — full-page login only at /login?redirect_uri= */
  auth: 'https://id.grudge-studio.com',
  /** Game state SSOT (characters, island, wallet, inventory) — Railway Postgres */
  gameData: 'https://grudge-api-production-0d46.up.railway.app',
  /** Legacy alias — prefer gameData. NEVER api.grudge-studio.com (dead). */
  gameApi: 'https://grudge-api-production-0d46.up.railway.app',
  assetsCdn: 'https://assets.grudge-studio.com',
  /** JSON catalogs — NEVER github.io/ObjectStore (legacy static). */
  objectStore: 'https://objectstore.grudge-studio.com/api/v1',
  infoHub: 'https://info.grudge-studio.com',
  ai: 'https://ai.grudge-studio.com',
  client: 'https://client.grudge-studio.com',
  warlords: 'https://grudgewarlords.com',
  /** Tactical-Infinity-specific APIs (battles, meshy, harvest) */
  tacticalApi: 'https://api.tactical-infinity.up.railway.app',
  /** Production Tactical-Infinity SPA (Vercel project tactical-infinity + CF DNS) */
  tacticalClient: 'https://water.grudge-studio.com',
} as const;

/** Build fleet SSO login URL for this origin (water / vercel / localhost). */
export function buildFleetSsoLoginUrl(returnOrigin?: string): string {
  const origin =
    returnOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : GRUDGE_FLEET.tacticalClient);
  const redirectUri = `${origin.replace(/\/$/, '')}/auth/callback`;
  return `${GRUDGE_FLEET.auth}/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/** Same-origin API paths when deployed on Vercel (rewrites handle routing). */
export const FLEET_API_PATHS = {
  characters: '/api/characters',
  island: '/api/island',
  wallet: '/api/wallet',
  auth: '/api/auth',
  battles: '/api/battles',
} as const;

/** Grudge Warlords production routes players can deep-link into. */
export const WARLORDS_ROUTES = {
  homeIsland: '/island',
  worldMap: '/world-map',
  character: '/character',
  crafting: '/crafting',
  dashboard: '/dashboard',
  admin: '/admin',
} as const;

/** Map Tethical world-map island ids → Grudge home / zone ids. */
export const ISLAND_FLEET_MAP: Record<string, { warlordsRoute: string; zoneId?: string; label: string }> = {
  waterfall_isle: { warlordsRoute: WARLORDS_ROUTES.homeIsland, zoneId: 'haven_shore', label: 'Home Island (Waterfall Isle)' },
  crusade_capital: { warlordsRoute: WARLORDS_ROUTES.worldMap, zoneId: 'crusade_capital', label: 'Crusade Capital' },
  legion_volcano: { warlordsRoute: WARLORDS_ROUTES.worldMap, zoneId: 'legion_volcano', label: 'Legion Volcanic Reach' },
  fabled_sanctuary: { warlordsRoute: WARLORDS_ROUTES.worldMap, zoneId: 'fabled_sanctuary', label: 'Fabled Sanctuary' },
};

/** Canonical boat ids shared with GrudgeBuilder shipCatalog prefab keys. */
export const BOAT_TO_WARLORDS_PREFAB: Record<string, string> = {
  raft: 'skiff',
  skiff: 'skiff',
  sloop: 'sloop',
  brigantine: 'brigantine',
  galleon: 'galleon',
  manOWar: 'galleon',
};

export function resolveWarlordsUrl(path: string): string {
  const base = (import.meta.env.VITE_WARLORDS_URL as string | undefined) || GRUDGE_FLEET.warlords;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getIslandFleetHandoff(islandId: string): { url: string; label: string } | null {
  const entry = ISLAND_FLEET_MAP[islandId];
  if (!entry) return null;
  const url = resolveWarlordsUrl(entry.warlordsRoute);
  const qs = entry.zoneId ? `?zone=${encodeURIComponent(entry.zoneId)}` : '';
  return { url: `${url}${qs}`, label: entry.label };
}

export function openWarlordsHandoff(islandId: string, newTab = true): boolean {
  const handoff = getIslandFleetHandoff(islandId);
  if (!handoff) return false;
  if (newTab) window.open(handoff.url, '_blank', 'noopener,noreferrer');
  else window.location.href = handoff.url;
  return true;
}