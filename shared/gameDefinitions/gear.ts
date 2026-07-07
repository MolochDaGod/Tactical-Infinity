/**
 * gear.ts — canonical equipment/gear data model (single source of truth).
 *
 * Before this module, equipment was fragmented across three mismatched slot
 * schemas:
 *   • game panel  `EquipmentSlot`  (head/chest/hands/legs/feet/mainHand/offHand/accessory1/2)
 *   • paperdoll   `SlotId`         (helmet/chest/gloves/legs/boots/weapon/offhand/amulet/belt/cloak/ring)
 *   • 3D rig      `ArmorSlot`      (head/shoulders/chest/hands/feet/cape)
 *
 * `GearSlot` below is the unifying enum; the three `*_TO_GEAR_SLOT` maps let the
 * legacy UIs keep their own vocabulary while resolving to canonical gear.
 *
 * This file is import-safe from both client and server (no client-only deps).
 * The concrete weapon-attach offsets live client-side in
 * `client/src/lib/gear/rig3d.ts` (needs THREE); here we only carry the
 * rig-independent descriptor (`weaponStyle`, `modelPath`, `armorSlot`).
 */

export type GearSlot =
  | 'weapon'
  | 'offhand'
  | 'head'
  | 'shoulders'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'cape'
  | 'accessory';

export const GEAR_SLOTS: GearSlot[] = [
  'weapon', 'offhand', 'head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'cape', 'accessory',
];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Mirrors the client `WeaponStyle` union (kept as a plain string union so
 *  shared code stays free of client imports). */
export type WeaponStyleId =
  | 'sword_shield'
  | 'greatsword'
  | 'bow'
  | 'spear'
  | 'staff'
  | 'gun'
  | 'axe'
  | 'mace_shield';

/** Armor slots that map to a built-in, skinned submesh on the character model
 *  (toggled on/off — never a new mesh). Subset of GearSlot. */
export type ArmorMeshSlot = 'head' | 'shoulders' | 'chest' | 'hands' | 'feet' | 'cape';

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  tier: number;
  icon?: string;
  description?: string;
  stats?: Record<string, number>;

  // ── Weapon / hand-attached prop fields ──────────────────────────────
  /** Canonical weapon family (sword, bow, staff, …) — from the hub weapon type. */
  weaponType?: string;
  /** Drives the character animation set + hand-attach offsets. */
  weaponStyle?: WeaponStyleId;
  /** Public GLB path for a real 3D model attached to a bone. */
  modelPath?: string;
  /** Which bone a prop model attaches to (weapons → right hand by default). */
  attachBone?: 'rightHand' | 'leftHand' | 'head';

  // ── Armor fields ────────────────────────────────────────────────────
  /** Built-in submesh slot this armor toggles on the character model. */
  armorSlot?: ArmorMeshSlot;

  source?: 'hub' | 'local';
}

// ── Legacy slot vocabularies → canonical GearSlot ──────────────────────────

/** game panel `EquipmentSlot.slotType` → GearSlot */
export const PANEL_SLOT_TO_GEAR: Record<string, GearSlot> = {
  head: 'head',
  chest: 'chest',
  hands: 'hands',
  legs: 'legs',
  feet: 'feet',
  mainHand: 'weapon',
  offHand: 'offhand',
  accessory1: 'accessory',
  accessory2: 'accessory',
};

/** paperdoll `SlotId` → GearSlot */
export const PAPERDOLL_SLOT_TO_GEAR: Record<string, GearSlot> = {
  helmet: 'head',
  chest: 'chest',
  gloves: 'hands',
  legs: 'legs',
  boots: 'feet',
  weapon: 'weapon',
  offhand: 'offhand',
  amulet: 'accessory',
  belt: 'accessory',
  cloak: 'cape',
  ring: 'accessory',
};

/** Slots that resolve to a toggle-able built-in armor submesh. */
export const ARMOR_MESH_SLOTS: ArmorMeshSlot[] = ['head', 'shoulders', 'chest', 'hands', 'feet', 'cape'];

export function isArmorMeshSlot(slot: GearSlot): slot is ArmorMeshSlot {
  return (ARMOR_MESH_SLOTS as string[]).includes(slot);
}

// ── Weapon GLB → style map (real assets under public/models/weapons) ────────

const WEAPONS_BASE = '/models/weapons';
const GEAR_BASE = '/models/gear';

/** Map a weapon filename/type keyword to its animation+attach style. */
export function weaponStyleFor(keyword: string): WeaponStyleId {
  const k = keyword.toLowerCase();
  if (/(great ?sword|claymore|zwei)/.test(k)) return 'greatsword';
  if (/(bow|longbow|shortbow)/.test(k)) return 'bow';
  if (/(spear|javelin|pike|lance|halberd|polearm|glaive|trident)/.test(k)) return 'spear';
  if (/(staff|cane|wand|scepter|rod)/.test(k)) return 'staff';
  if (/(pistol|revolver|rifle|gun|musket|blunderbuss|crossbow)/.test(k)) return 'gun';
  if (/(axe|hatchet|cleaver)/.test(k)) return 'axe';
  if (/(hammer|mace|maul|club|flail|morningstar)/.test(k)) return 'mace_shield';
  // sword / dagger / knife / sickle / gladius → 1H sword & shield family
  return 'sword_shield';
}

// ── Local fallback catalogue (used when the hub is unavailable) ─────────────
// Built from real GLBs that already exist in public/models/weapons + the
// modular built-in armor slots (toggled, not authored) + a crown accessory.

interface WeaponSeed { id: string; name: string; file: string; tier: number; rarity: Rarity; slot?: GearSlot; }

const WEAPON_SEEDS: WeaponSeed[] = [
  { id: 'w_sword',      name: 'Iron Longsword',   file: 'sword.glb',       tier: 1, rarity: 'common' },
  { id: 'w_dagger',     name: 'Steel Dagger',     file: 'dagger.glb',      tier: 1, rarity: 'common' },
  { id: 'w_sickle',     name: 'Reaper Sickle',    file: 'sickle.glb',      tier: 2, rarity: 'uncommon' },
  { id: 'w_greatsword', name: 'Warlord Greatsword', file: 'greatsword.glb', tier: 3, rarity: 'rare' },
  { id: 'w_axe',        name: 'Battle Axe',       file: 'axe.glb',         tier: 2, rarity: 'uncommon' },
  { id: 'w_hammer',     name: 'War Hammer',       file: 'hammer.glb',      tier: 3, rarity: 'rare' },
  { id: 'w_mace',       name: 'Spiked Mace',      file: 'mace.glb',        tier: 2, rarity: 'uncommon' },
  { id: 'w_spear',      name: 'Ash Spear',        file: 'spear.glb',       tier: 1, rarity: 'common' },
  { id: 'w_javelin',    name: 'Throwing Javelin', file: 'javelin.glb',     tier: 1, rarity: 'common' },
  { id: 'w_bow',        name: 'Hunter Bow',       file: 'bow.glb',         tier: 1, rarity: 'common' },
  { id: 'w_bowcraft',   name: 'Elmwood Warbow',   file: 'bow-craft-5.glb', tier: 3, rarity: 'rare' },
  { id: 'w_staff',      name: 'Arcane Staff',     file: 'staff.glb',       tier: 2, rarity: 'uncommon' },
  { id: 'w_cane',       name: 'Sorcerer Cane',    file: 'cane-1.glb',      tier: 3, rarity: 'epic' },
  { id: 'w_pistol',     name: 'Flintlock Pistol', file: 'pistol.glb',      tier: 2, rarity: 'uncommon' },
  { id: 'w_revolver',   name: 'Hex Revolver',     file: 'revolver.glb',    tier: 3, rarity: 'rare' },
  { id: 'w_rifle',      name: 'Long Rifle',       file: 'rifle.glb',       tier: 3, rarity: 'rare' },
  { id: 'w_gunblade',   name: 'Gunblade',         file: 'gunblade.glb',    tier: 4, rarity: 'epic' },
];

const OFFHAND_SEEDS: WeaponSeed[] = [
  { id: 'o_shield',       name: 'Round Shield',  file: 'shield.glb',        tier: 1, rarity: 'common',   slot: 'offhand' },
  { id: 'o_roman_shield', name: 'Legion Bulwark', file: 'roman-shield.glb', tier: 3, rarity: 'rare',     slot: 'offhand' },
];

interface ArmorSeed { id: string; name: string; slot: ArmorMeshSlot; tier: number; rarity: Rarity; }

const ARMOR_SEEDS: ArmorSeed[] = [
  { id: 'a_helm',      name: 'Iron Helm',       slot: 'head',      tier: 2, rarity: 'uncommon' },
  { id: 'a_pauldrons', name: 'Steel Pauldrons', slot: 'shoulders', tier: 2, rarity: 'uncommon' },
  { id: 'a_chest',     name: 'Plate Cuirass',   slot: 'chest',     tier: 3, rarity: 'rare' },
  { id: 'a_gauntlets', name: 'Battle Gauntlets', slot: 'hands',    tier: 2, rarity: 'uncommon' },
  { id: 'a_boots',     name: 'Greaved Boots',   slot: 'feet',      tier: 1, rarity: 'common' },
  { id: 'a_cape',      name: 'Warlord Cloak',   slot: 'cape',      tier: 3, rarity: 'rare' },
];

function buildLocalGear(): GearItem[] {
  const items: GearItem[] = [];

  for (const w of [...WEAPON_SEEDS, ...OFFHAND_SEEDS]) {
    const style = weaponStyleFor(w.file);
    items.push({
      id: w.id,
      name: w.name,
      slot: w.slot ?? 'weapon',
      rarity: w.rarity,
      tier: w.tier,
      weaponType: style,
      weaponStyle: style,
      modelPath: `${WEAPONS_BASE}/${w.file}`,
      attachBone: (w.slot ?? 'weapon') === 'offhand' ? 'leftHand' : 'rightHand',
      description: `A ${w.rarity} ${w.name.toLowerCase()}.`,
      source: 'local',
    });
  }

  for (const a of ARMOR_SEEDS) {
    items.push({
      id: a.id,
      name: a.name,
      slot: a.slot,
      armorSlot: a.slot,
      rarity: a.rarity,
      tier: a.tier,
      description: `Built-in ${a.slot} armor: ${a.name}.`,
      source: 'local',
    });
  }

  // Crown — a real standalone GLB prop, attaches to the head bone. Demonstrates
  // the reusable "any 3D asset equippable on any character" library.
  items.push({
    id: 'acc_crown',
    name: 'Golden Crown',
    slot: 'accessory',
    rarity: 'legendary',
    tier: 5,
    modelPath: `${GEAR_BASE}/golden-crown.glb`,
    attachBone: 'head',
    description: 'A regal golden crown fit for a warlord.',
    source: 'local',
  });

  return items;
}

/** The canonical local fallback catalogue (real assets only). */
export const LOCAL_GEAR: GearItem[] = buildLocalGear();

/** Best-effort GLB path for a hub weapon that only names its type. */
export function localWeaponModelForType(weaponType: string): string | undefined {
  const style = weaponStyleFor(weaponType);
  const match = LOCAL_GEAR.find((g) => g.slot === 'weapon' && g.weaponStyle === style);
  return match?.modelPath;
}
