/**
 * Warlords asset database client — bridges static catalog ↔ D1 asset_registry.
 *
 * Runtime resolution order:
 *   1. Static WARLORDS_* catalog (always available, offline-safe)
 *   2. Live D1 via api.grudge-studio.com (optional hydrate — fills cdnUrl/uuid)
 *   3. resolveGrudgeAssetUrl for local public/ fallbacks
 *
 * Does NOT invent meshes. Missing CDN keys should be re-uploaded + re-seeded.
 */

import {
  ASSET_API,
  WARLORDS_ALL_ASSETS,
  WARLORDS_BY_ID,
  WARLORDS_BY_R2,
  WARLORDS_CDN,
  assetsForLayer,
  cdnUrl,
  resolveWarlordsUrl,
  type WarlordsAssetEntry,
  type WarlordsGameLayer,
  HOME_ISLAND_SEED_LAYERS,
} from './warlordsAssetCatalog';
import { resolveGrudgeAssetUrl } from './grudgeAssetConfig';

export interface D1AssetRow {
  id: string;
  name: string;
  category: string;
  r2Key: string;
  grudgeUuid?: string;
  cdnUrl?: string;
  fileSize?: number;
}

export interface ResolvedAsset extends WarlordsAssetEntry {
  cdnUrl: string;
  grudgeUuid?: string;
  inD1?: boolean;
  fileSize?: number;
}

let d1ByR2: Map<string, D1AssetRow> | null = null;
let d1HydratePromise: Promise<void> | null = null;

/** Optional: pull a page of D1 assets and index by r2Key (best-effort). */
export async function hydrateWarlordsFromD1(maxPages = 3): Promise<number> {
  if (d1HydratePromise) {
    await d1HydratePromise;
    return d1ByR2?.size ?? 0;
  }

  d1HydratePromise = (async () => {
    const map = new Map<string, D1AssetRow>();
    const pageSize = 200;
    for (let page = 0; page < maxPages; page++) {
      try {
        const url = `${ASSET_API}/assets?limit=${pageSize}&offset=${page * pageSize}`;
        const res = await fetch(url);
        if (!res.ok) break;
        const data = (await res.json()) as { assets?: D1AssetRow[]; total?: number };
        const list = data.assets ?? [];
        for (const a of list) {
          if (a.r2Key) map.set(a.r2Key, a);
        }
        if (list.length < pageSize) break;
      } catch (e) {
        console.warn('[WarlordsAssetDb] D1 hydrate failed', e);
        break;
      }
    }
    // Prefer /assets/category for creature + building + environment if list is huge
    for (const cat of ['creature', 'building', 'environment', 'character', 'terrain', 'prop']) {
      try {
        const res = await fetch(`${ASSET_API}/assets/category/${cat}?limit=500`);
        if (!res.ok) continue;
        const data = (await res.json()) as { assets?: D1AssetRow[] };
        for (const a of data.assets ?? []) {
          if (a.r2Key) map.set(a.r2Key, a);
        }
      } catch {
        /* ignore */
      }
    }
    d1ByR2 = map;
    console.log(`[WarlordsAssetDb] D1 index size=${map.size}`);
  })();

  await d1HydratePromise;
  return d1ByR2?.size ?? 0;
}

export function resolveAsset(idOrR2: string): ResolvedAsset | null {
  const entry =
    WARLORDS_BY_ID[idOrR2] ??
    WARLORDS_BY_R2[idOrR2.replace(/^\//, '')] ??
    null;
  if (!entry) return null;

  const d1 = d1ByR2?.get(entry.r2Key);
  return {
    ...entry,
    cdnUrl: d1?.cdnUrl || cdnUrl(entry.r2Key),
    grudgeUuid: d1?.grudgeUuid,
    inD1: !!d1,
    fileSize: d1?.fileSize,
  };
}

/** URL for loaders — catalog first, then CDN join, then local resolve */
export function warlordsUrl(idOrR2: string): string {
  const resolved = resolveAsset(idOrR2);
  if (resolved) return resolved.cdnUrl;
  if (/^https?:\/\//i.test(idOrR2)) return idOrR2;
  const asCdn = resolveWarlordsUrl(idOrR2);
  if (asCdn.startsWith(WARLORDS_CDN)) return asCdn;
  return resolveGrudgeAssetUrl(idOrR2.startsWith('/') ? idOrR2 : `/${idOrR2}`);
}

export function layerAssets(layer: WarlordsGameLayer): ResolvedAsset[] {
  return assetsForLayer(layer).map((e) => resolveAsset(e.id)!).filter(Boolean);
}

/** Audit: which catalog keys are missing from D1 (after hydrate). */
export function auditCatalogVsD1(): {
  total: number;
  inD1: number;
  missing: WarlordsAssetEntry[];
} {
  const missing: WarlordsAssetEntry[] = [];
  let inD1 = 0;
  for (const e of WARLORDS_ALL_ASSETS) {
    if (d1ByR2?.has(e.r2Key)) inD1++;
    else missing.push(e);
  }
  return { total: WARLORDS_ALL_ASSETS.length, inD1, missing };
}

export function getHomeIslandSeedPlan() {
  return HOME_ISLAND_SEED_LAYERS;
}

export function getWarlordsCatalogSnapshot() {
  return {
    cdn: WARLORDS_CDN,
    api: ASSET_API,
    count: WARLORDS_ALL_ASSETS.length,
    layers: HOME_ISLAND_SEED_LAYERS,
    d1Indexed: d1ByR2?.size ?? 0,
  };
}

// Re-exports for convenience
export {
  WARLORDS_ALL_ASSETS,
  WARLORDS_CDN,
  ASSET_API,
  assetsForLayer,
  HOME_ISLAND_SEED_LAYERS,
};
