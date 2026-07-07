/**
 * catalogue.ts — hub-backed gear catalogue with graceful local fallback.
 *
 * `info.grudge-studio.com` is a GitHub-Pages SPA: its `/data/master-*.json`
 * routes fall through to `index.html` (HTTP 200, `text/html`), so
 * `InfoHub.getWeapons()/getArmor()/getItems()` reject on `r.json()`. This
 * loader therefore *tries* the hub, normalises whatever it gets into the
 * canonical `GearItem` shape, and falls back to `LOCAL_GEAR` (real GLB assets)
 * whenever the hub is unavailable or returns nothing usable. The catalogue is
 * always resolvable — it never throws.
 */

import { InfoHub } from '@/lib/infoHubAPI';
import {
  type GearItem,
  type GearSlot,
  type Rarity,
  RARITY_ORDER,
  LOCAL_GEAR,
  weaponStyleFor,
  localWeaponModelForType,
} from '@shared/gameDefinitions/gear';

let cache: GearItem[] | null = null;
let inflight: Promise<GearItem[]> | null = null;

function asRarity(v: unknown): Rarity {
  const s = String(v ?? '').toLowerCase();
  return (RARITY_ORDER as string[]).includes(s) ? (s as Rarity) : 'common';
}

function asNumber(v: unknown, fallback = 1): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce any hub row shape into a canonical weapon GearItem (best effort). */
function normalizeHubWeapon(raw: any, idx: number): GearItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = raw.name ?? raw.title ?? raw.label;
  if (!name) return null;
  const typeKeyword = String(raw.weaponType ?? raw.type ?? raw.category ?? name);
  const style = weaponStyleFor(typeKeyword);
  const model = raw.model ?? raw.modelPath ?? raw.glb ?? localWeaponModelForType(typeKeyword);
  return {
    id: String(raw.id ?? raw.uuid ?? `hub_w_${idx}`),
    name: String(name),
    slot: 'weapon',
    rarity: asRarity(raw.rarity ?? raw.quality),
    tier: asNumber(raw.tier ?? raw.level, 1),
    icon: raw.icon,
    description: raw.description,
    stats: (raw.stats && typeof raw.stats === 'object') ? raw.stats : undefined,
    weaponType: style,
    weaponStyle: style,
    modelPath: model,
    attachBone: 'rightHand',
    source: 'hub',
  };
}

const ARMOR_SLOT_KEYWORDS: Record<string, GearItem['armorSlot']> = {
  head: 'head', helm: 'head', helmet: 'head', hood: 'head',
  shoulder: 'shoulders', pauldron: 'shoulders', spaulder: 'shoulders',
  chest: 'chest', body: 'chest', torso: 'chest', cuirass: 'chest', robe: 'chest',
  hand: 'hands', glove: 'hands', gauntlet: 'hands',
  feet: 'feet', boot: 'feet', greave: 'feet',
  cape: 'cape', cloak: 'cape', back: 'cape',
};

const ACCESSORY_KEYWORDS = /(ring|amulet|necklace|pendant|talisman|trinket|charm|circlet|crown|band|earring|brooch|medallion|relic|artifact)/i;
const WEAPON_KEYWORDS = /(sword|blade|dagger|knife|axe|hammer|mace|maul|club|flail|spear|lance|pike|halberd|glaive|bow|staff|wand|scepter|rod|pistol|revolver|rifle|gun|musket|crossbow)/i;

/**
 * Coerce a generic hub "item" row (from `InfoHub.getItems()`) into a canonical
 * GearItem when it is equippable. Weapons/armor route through the dedicated
 * normalizers; accessories map to the `accessory` slot; anything non-equippable
 * (potions, materials, quest items) is skipped.
 */
function normalizeHubItem(raw: any, idx: number): GearItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = raw.name ?? raw.title ?? raw.label;
  if (!name) return null;
  const key = String(
    raw.slot ?? raw.type ?? raw.category ?? raw.itemType ?? raw.kind ?? name,
  ).toLowerCase();

  if (WEAPON_KEYWORDS.test(key)) return normalizeHubWeapon(raw, idx);
  const armor = normalizeHubArmor(raw, idx);
  if (armor) return armor;
  if (!ACCESSORY_KEYWORDS.test(key)) return null;

  return {
    id: String(raw.id ?? raw.uuid ?? `hub_i_${idx}`),
    name: String(name),
    slot: 'accessory',
    rarity: asRarity(raw.rarity ?? raw.quality),
    tier: asNumber(raw.tier ?? raw.level, 1),
    icon: raw.icon,
    description: raw.description,
    stats: (raw.stats && typeof raw.stats === 'object') ? raw.stats : undefined,
    modelPath: raw.model ?? raw.modelPath ?? raw.glb,
    attachBone: /(crown|circlet)/i.test(key) ? 'head' : undefined,
    source: 'hub',
  };
}

function normalizeHubArmor(raw: any, idx: number): GearItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = raw.name ?? raw.title ?? raw.label;
  if (!name) return null;
  const key = String(raw.slot ?? raw.type ?? raw.category ?? name).toLowerCase();
  let armorSlot: GearItem['armorSlot'];
  let slot: GearSlot = 'chest';
  for (const [kw, s] of Object.entries(ARMOR_SLOT_KEYWORDS)) {
    if (key.includes(kw)) { armorSlot = s; slot = s!; break; }
  }
  if (!armorSlot) return null; // only accept armor we can map to a built-in submesh
  return {
    id: String(raw.id ?? raw.uuid ?? `hub_a_${idx}`),
    name: String(name),
    slot,
    armorSlot,
    rarity: asRarity(raw.rarity ?? raw.quality),
    tier: asNumber(raw.tier ?? raw.level, 1),
    icon: raw.icon,
    description: raw.description,
    stats: (raw.stats && typeof raw.stats === 'object') ? raw.stats : undefined,
    source: 'hub',
  };
}

/** Pull an array out of whatever container shape the hub uses. */
function rowsOf(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['weapons', 'armor', 'items', 'entries', 'data', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
    // maybe a map of id -> row
    const vals = Object.values(obj).filter((v) => v && typeof v === 'object');
    if (vals.length && vals.every((v) => !Array.isArray(v))) return vals as any[];
  }
  return [];
}

async function tryHub(): Promise<GearItem[]> {
  const out: GearItem[] = [];
  const [weapons, armor, items] = await Promise.allSettled([
    InfoHub.getWeapons(),
    InfoHub.getArmor(),
    InfoHub.getItems(),
  ]);
  if (weapons.status === 'fulfilled') {
    rowsOf(weapons.value).forEach((r, i) => {
      const g = normalizeHubWeapon(r, i);
      if (g) out.push(g);
    });
  }
  if (armor.status === 'fulfilled') {
    rowsOf(armor.value).forEach((r, i) => {
      const g = normalizeHubArmor(r, i);
      if (g) out.push(g);
    });
  }
  if (items.status === 'fulfilled') {
    rowsOf(items.value).forEach((r, i) => {
      const g = normalizeHubItem(r, i);
      if (g) out.push(g);
    });
  }
  return out;
}

/**
 * Load the gear catalogue. Tries the hub, then falls back to the real-asset
 * local catalogue. Result is cached for the tab session.
 */
export async function loadGearCatalogue(opts?: { force?: boolean }): Promise<GearItem[]> {
  if (cache && !opts?.force) return cache;
  if (inflight && !opts?.force) return inflight;

  inflight = (async () => {
    let hubItems: GearItem[] = [];
    try {
      hubItems = await tryHub();
    } catch {
      hubItems = [];
    }
    // The hub weapon/armor datasets are the source of truth when present, but
    // we always keep the local assets so every weapon still resolves to a GLB.
    const merged = new Map<string, GearItem>();
    for (const g of LOCAL_GEAR) merged.set(g.id, g);
    for (const g of hubItems) merged.set(g.id, g);
    cache = Array.from(merged.values());
    inflight = null;
    return cache;
  })();

  return inflight;
}

/** Synchronous access to the local catalogue (available before the async load). */
export function localCatalogue(): GearItem[] {
  return LOCAL_GEAR;
}

export function gearById(catalogue: GearItem[], id: string | null | undefined): GearItem | undefined {
  if (!id) return undefined;
  return catalogue.find((g) => g.id === id);
}

export function gearForSlot(catalogue: GearItem[], slot: GearSlot): GearItem[] {
  const items = catalogue.filter((g) => g.slot === slot);
  items.sort((a, b) =>
    a.tier - b.tier ||
    RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
    a.name.localeCompare(b.name),
  );
  return items;
}
