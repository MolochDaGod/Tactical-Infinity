/**
 * Bridge between Tethical (Tactical-Infinity) and the Grudge Warlords fleet.
 * Maps world-map islands, boats, and navigation to grudgewarlords.com routes.
 */

export const GRUDGE_FLEET = {
  gameApi: 'https://api.grudge-studio.com',
  auth: 'https://id.grudge-studio.com',
  assetsCdn: 'https://assets.grudge-studio.com',
  client: 'https://client.grudge-studio.com',
  warlords: 'https://grudgewarlords.com',
  objectStore: 'https://molochdagod.github.io/ObjectStore/api/v1',
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