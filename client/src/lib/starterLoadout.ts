// Starter Loadout — Grudge Warlords Rules
//
// Every new captain begins with EXACTLY:
//   1. ONE weapon, chosen from { sword, bow, staff }
//   2. ONE simple shirt    (chest slot)
//   3. ONE simple pants    (legs slot)
//   4. NOTHING else equipped — helmet, gloves, boots, offhand, amulet,
//      belt, cloak, ring slots are all empty.
//
// Inventory rule: at most ONE of each item exists at start. The starter set
// lives in `getStarterInventory` so the inventory system can initialize from
// a single source of truth and refuse to add duplicates.

import type { SlotId, EquippedItem, EquippedMap } from "@/components/EquipmentPanel";

// Raise to module-public so callers can branch on rarity without redeclaring.
export type Rarity = NonNullable<EquippedItem["rarity"]>;

// ── The three legal starting weapons ──────────────────────────────────────
export type StarterWeapon = "sword" | "bow" | "staff";

export const STARTER_WEAPONS: ReadonlyArray<StarterWeapon> = ["sword", "bow", "staff"];

export const STARTER_WEAPON_LABEL: Record<StarterWeapon, string> = {
  sword: "Worn Iron Sword",
  bow:   "Hunter's Bow",
  staff: "Apprentice Staff",
};

// ── Equipment policy ──────────────────────────────────────────────────────
// Slots that may be filled for a brand-new captain.
export const STARTER_ALLOWED_SLOTS: ReadonlySet<SlotId> = new Set<SlotId>([
  "chest",
  "legs",
  "weapon",
]);

// Slots guaranteed empty for a brand-new captain. ("add" is a UI affordance,
// not a real equipment slot, so it's intentionally excluded here.)
export const STARTER_EMPTY_SLOTS: ReadonlyArray<SlotId> = [
  "helmet",
  "gloves",
  "boots",
  "offhand",
  "amulet",
  "belt",
  "cloak",
  "ring",
];

// ── Item factory ──────────────────────────────────────────────────────────
const COMMON: Rarity = "common";

function shirt(): EquippedItem {
  return { name: "Linen Shirt", rarity: COMMON };
}
function pants(): EquippedItem {
  return { name: "Linen Trousers", rarity: COMMON };
}
function weapon(w: StarterWeapon): EquippedItem {
  return { name: STARTER_WEAPON_LABEL[w], rarity: COMMON };
}

/**
 * Build the equipped-slot map for a brand-new captain.
 * Anything not returned here is guaranteed empty by the policy above.
 */
export function getStarterEquipment(w: StarterWeapon): EquippedMap {
  return {
    chest:  shirt(),
    legs:   pants(),
    weapon: weapon(w),
  };
}

// ── Inventory: 1-of-each starter set ──────────────────────────────────────
export interface StarterInventoryItem {
  /** Stable id used to enforce "max 1 of each". */
  id: string;
  slot: SlotId;
  item: EquippedItem;
}

export function getStarterInventory(w: StarterWeapon): StarterInventoryItem[] {
  return [
    { id: "starter.shirt",       slot: "chest",  item: shirt() },
    { id: "starter.pants",       slot: "legs",   item: pants() },
    { id: `starter.weapon.${w}`, slot: "weapon", item: weapon(w) },
  ];
}

/** Validate an equipped map against the starter policy. Pure check, no throw. */
export function validateStarterLoadout(equipped: EquippedMap): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  for (const slot of STARTER_EMPTY_SLOTS) {
    if (equipped[slot]) violations.push(`Slot "${slot}" must be empty for a new captain`);
  }
  if (!equipped.chest)  violations.push(`Missing starter shirt (chest)`);
  if (!equipped.legs)   violations.push(`Missing starter pants (legs)`);
  if (!equipped.weapon) violations.push(`Missing starter weapon (weapon)`);
  return { ok: violations.length === 0, violations };
}
