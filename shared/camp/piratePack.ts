/**
 * Low Poly Pirate Pack (pack 1) — mesh isolation + game roles.
 *
 * Binary: models/pirate/low_poly_pirate_pack_1.glb
 * CDN:    https://assets.grudge-studio.com/models/pirate/low_poly_pirate_pack_1.glb
 *
 * Source: C:\Users\nugye\Documents\low__poly__pirate__pack___pack_1.glb
 *         (same pack as D:\Games\Models\low_poly_pirate_pack__pack_1.glb)
 * Never place the whole multi-mesh pack as one entity — isolate meshName.
 */

export const PIRATE_PACK_R2_KEY = "models/pirate/low_poly_pirate_pack_1.glb";
export const PIRATE_PACK_CDN =
  "https://assets.grudge-studio.com/models/pirate/low_poly_pirate_pack_1.glb";
export const PIRATE_PACK_LOCAL = "/models/pirate/low_poly_pirate_pack_1.glb";

/**
 * Node names in the GLB (parent groups; mesh children append `_Material_0`).
 * Documents re-export `low__poly__pirate__pack___pack_1.glb` uses underscores
 * (`PIRATE_PACK_Cannon`). Play isolates stay on the hyphen pack already on CDN.
 *
 * PIRATE_PACK-RowBoat is a dinghy *visual* only — play hull stays BoatId skiff
 * (`/models/fleet/boats/rowboat.glb`). Do not set playBoatId on the pack hull.
 */
export const PIRATE_MESH = {
  netDock: "PIRATE_PACK-FishingStandNet",
  cannon: "PIRATE_PACK-Cannon",
  cannonBase: "PIRATE_PACK-CannonStand",
  boneChest: "PIRATE_PACK-Death_Chest-Closed",
  chest: "PIRATE_PACK-Chest-Closed",
  smallChestClosed: "PIRATE_PACK-SmallCreate-Closed",
  smallChestOpen: "PIRATE_PACK-SmallCreate-Open",
  barrelClosed: "PIRATE_PACK-Barell",
  barrelOpen: "PIRATE_PACK-Barell_Open",
  fishingRod: "PIRATE_PACK-FishingRod",
  fishingRodLine: "PIRATE_PACK-FishingRodStanding",
  fishingDry: "PIRATE_PACK-FishingDry",
  shovel: "PIRATE_PACK-Shovel",
  rowBoat: "PIRATE_PACK-RowBoat",
  oars: "PIRATE_PACK-RowBoatOars",
  flintlock: "PIRATE_PACK-Gun",
  rifle: "PIRATE_PACK-Gun.001",
  coin: "PIRATE_PACK-Coin",
  coinPileSmall: "PIRATE_PACK-CoinPile_Small",
  coinPileLarge: "PIRATE_PACK-CoinPile_Large",
  coinBag: "PIRATE_PACK-CoinBag",
  moneyBag: "PIRATE_PACK-MoneyBag",
  goldBar: "PIRATE_PACK-GoldBar",
  goldBarPile: "PIRATE_PACK-GoldBar_Pile",
  goldBarWall: "PIRATE_PACK-GoldBar_Wall",
  diamond: "PIRATE_PACK-Diamond",
  ruby: "PIRATE_PACK-Ruby",
  pearls: "PIRATE_PACK-Pearls",
  ring: "PIRATE_PACK-Ring",
  chalice: "PIRATE_PACK-Chalece",
  skull: "PIRATE_PACK-Skull",
  key: "PIRATE_PACK-Key",
  skullKey: "PIRATE_PACK-SkullKey",
  hook: "PIRATE_PACK-HookHand",
  longScope: "PIRATE_PACK-LongScope",
  smallScope: "PIRATE_PACK-SmallScope",
  deadFish: "PIRATE_PACK-DeadFish",
} as const;

export type PirateMeshKey = keyof typeof PIRATE_MESH;

export interface PiratePackEntry {
  id: string;
  role:
    | "buildable"
    | "tool"
    | "loot"
    | "prop"
    | "treasure";
  name: string;
  meshName: string;
  /** Target height when placed / equipped */
  targetHeightM: number;
  description: string;
  /** Linked recipe ids in production SSOT */
  recipeIds?: string[];
  /** Linked building / tool catalog ids */
  catalogIds?: string[];
}

/** Canonical catalog rows for D1 metadata + loaders. */
export const PIRATE_PACK_CATALOG: PiratePackEntry[] = [
  {
    id: "pirate.net_dock",
    role: "buildable",
    name: "Net Dock",
    meshName: PIRATE_MESH.netDock,
    targetHeightM: 2.2,
    description: "Fishing stand with nets — shore fishing station and light dock.",
    recipeIds: ["craft_net", "cook_fish"],
    catalogIds: ["bld.net_dock", "net_dock"],
  },
  {
    id: "pirate.cannon",
    role: "buildable",
    name: "Pirate Cannon",
    meshName: PIRATE_MESH.cannon,
    targetHeightM: 1.2,
    description: "Naval cannon barrel. Place on cannon base for a full battery.",
    catalogIds: ["bld.pirate_cannon", "pirate_cannon", "cannon"],
  },
  {
    id: "pirate.cannon_base",
    role: "buildable",
    name: "Cannon Base",
    meshName: PIRATE_MESH.cannonBase,
    targetHeightM: 0.9,
    description: "Cannon carriage / stand. Pairs with pirate cannon.",
    catalogIds: ["bld.cannon_base", "cannon_base", "cannon_stand"],
  },
  {
    id: "pirate.bone_chest",
    role: "treasure",
    name: "Bone Chest",
    meshName: PIRATE_MESH.boneChest,
    targetHeightM: 0.85,
    description: "Death / bone chest. Found by shovel dig (buried treasure).",
    catalogIds: ["loot.bone_chest", "bone_chest"],
  },
  {
    id: "pirate.fishing_rod",
    role: "tool",
    name: "Pirate Fishing Pole",
    meshName: PIRATE_MESH.fishingRod,
    targetHeightM: 1.4,
    description: "Hand fishing pole — second visual line for fishing_rod tool (v1).",
    recipeIds: ["craft_pirate_fishing_rod"],
    catalogIds: ["tool.pirate_fishing_rod", "pirate_fishing_rod", "rod_pirate_v1"],
  },
  {
    id: "pirate.fishing_rod_line",
    role: "tool",
    name: "Fishing Pole with Line",
    meshName: PIRATE_MESH.fishingRodLine,
    targetHeightM: 1.5,
    description: "Standing pole with line — fishing_rod tool v2 (better catch rate).",
    recipeIds: ["craft_pirate_fishing_rod_line"],
    catalogIds: [
      "tool.pirate_fishing_rod_line",
      "pirate_fishing_rod_line",
      "rod_pirate_v2",
    ],
  },
  {
    id: "pirate.fish_trap",
    role: "tool",
    name: "Fish Trap",
    meshName: "fish_trap",
    targetHeightM: 1.1,
    description: "Deployable trap — missing fishing-gear prefab filled from author GLB.",
    catalogIds: ["tool.fish_trap", "fish_trap"],
  },
  {
    id: "pirate.shovel",
    role: "tool",
    name: "Pirate Shovel",
    meshName: PIRATE_MESH.shovel,
    targetHeightM: 1.2,
    description: "Dig shovel for terrain + buried treasure (bone chest).",
    recipeIds: ["craft_pirate_shovel"],
    catalogIds: ["tool.pirate_shovel", "pirate_shovel", "shovel_pirate"],
  },
  {
    id: "pirate.chest",
    role: "loot",
    name: "Pirate Chest",
    meshName: PIRATE_MESH.chest,
    targetHeightM: 0.8,
    description: "Closed treasure chest prop / loot container.",
    catalogIds: ["loot.pirate_chest"],
  },
  {
    id: "pirate.small_chest",
    role: "loot",
    name: "Small Chest",
    meshName: PIRATE_MESH.smallChestClosed,
    targetHeightM: 0.45,
    description: "Small crate/chest. E inspect swaps closed → open mesh.",
    catalogIds: ["loot.small_chest", "small_chest"],
  },
  {
    id: "pirate.barrel",
    role: "prop",
    name: "Barrel (closed)",
    meshName: PIRATE_MESH.barrelClosed,
    targetHeightM: 0.7,
    description: "Closed barrel. E inspect swaps to open.",
    catalogIds: ["prop.barrel", "barrel"],
  },
  {
    id: "pirate.flintlock",
    role: "tool",
    name: "Flintlock Pistol",
    meshName: PIRATE_MESH.flintlock,
    targetHeightM: 0.22,
    description: "Deck / nest pistol prop — not a second weapon-skill tree.",
    catalogIds: ["tool.flintlock", "flintlock"],
  },
  {
    id: "pirate.rifle",
    role: "tool",
    name: "Flintlock Rifle",
    meshName: PIRATE_MESH.rifle,
    targetHeightM: 0.85,
    description: "Long gun prop for crow's nest. Weapon skills stay T0 packs.",
    catalogIds: ["tool.pirate_rifle", "pirate_rifle"],
  },
  {
    id: "pirate.oars",
    role: "prop",
    name: "Oar pair",
    meshName: PIRATE_MESH.oars,
    targetHeightM: 0.14,
    description: "Row station loom. Hands IK to this isolate.",
    catalogIds: ["prop.oars", "rowboatoars"],
  },
  {
    id: "pirate.dinghy",
    role: "prop",
    name: "Pack dinghy hull",
    meshName: PIRATE_MESH.rowBoat,
    targetHeightM: 0.7,
    description:
      "Visual dinghy isolate. Play hull is BoatId skiff — do not spawn this as WARLORDS_PLAY_BOATS.",
    catalogIds: ["prop.dinghy_visual"],
  },
  {
    id: "pirate.gold_bar",
    role: "treasure",
    name: "Gold Bar",
    meshName: PIRATE_MESH.goldBar,
    targetHeightM: 0.08,
    description: "Treasure inspect / shovel loot.",
    catalogIds: ["loot.gold_bar"],
  },
  {
    id: "pirate.coin_pile_small",
    role: "treasure",
    name: "Coin Pile (small)",
    meshName: PIRATE_MESH.coinPileSmall,
    targetHeightM: 0.12,
    description: "Gold pile inside open chests.",
    catalogIds: ["loot.coin_pile_small"],
  },
];

/** Closed/open mesh pairs — one interactable, E toggles visibility (no second mixer). */
export interface PirateLidPair {
  id: string;
  name: "small_chest" | "barrel" | "chest";
  closed: string;
  open: string;
  heightM: number;
  prompt: string;
  lootIds: string[];
}

export const PIRATE_LID_PAIRS: readonly PirateLidPair[] = [
  {
    id: "prefab.small_chest",
    name: "small_chest",
    closed: PIRATE_MESH.smallChestClosed,
    open: PIRATE_MESH.smallChestOpen,
    heightM: 0.45,
    prompt: "E — look in chest",
    lootIds: ["pirate.coin_pile_small", "pirate.gold_bar", "pirate.chest"],
  },
  {
    id: "prefab.barrel",
    name: "barrel",
    closed: PIRATE_MESH.barrelClosed,
    open: PIRATE_MESH.barrelOpen,
    heightM: 0.7,
    prompt: "E — look in barrel",
    lootIds: ["pirate.gold_bar"],
  },
];

export type PiratePrefabRole =
  | "cannon"
  | "inspect"
  | "fishing"
  | "dinghy"
  | "weapon_prop"
  | "tool"
  | "treasure";

export interface PiratePrefabPart {
  meshName: string;
  role: string;
  /** Local metres after isolate ground. */
  offset?: [number, number, number];
}

export interface PiratePrefabDef {
  id: string;
  name: string;
  role: PiratePrefabRole;
  stationKind?: "oar" | "cannon" | "harpoon" | "sniper_nest" | "mage_spot" | "helm";
  parts: PiratePrefabPart[];
  lid?: PirateLidPair;
  lengthM: number;
  heightM: number;
  notes: string;
  /** D1 definition key fragment (pack#prefab:id). */
  d1Key: string;
}

/**
 * Gameplay prefabs — composed isolates, not a second pack.
 * First cannon = independent base + barrel parented together.
 */
export const PIRATE_PREFABS: readonly PiratePrefabDef[] = [
  {
    id: "prefab.deck_cannon_t0",
    name: "T0 Deck Cannon",
    role: "cannon",
    stationKind: "cannon",
    parts: [
      { meshName: PIRATE_MESH.cannonBase, role: "base" },
      { meshName: PIRATE_MESH.cannon, role: "barrel" },
    ],
    lengthM: 1.4,
    heightM: 0.85,
    notes: "First play cannon. Recoil on barrel isolate (name contains Cannon).",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:deck_cannon_t0`,
  },
  {
    id: "prefab.small_chest",
    name: "Small Chest (E inspect)",
    role: "inspect",
    stationKind: "mage_spot",
    parts: [
      { meshName: PIRATE_MESH.smallChestClosed, role: "closed" },
      { meshName: PIRATE_MESH.smallChestOpen, role: "open" },
    ],
    lid: PIRATE_LID_PAIRS[0],
    lengthM: 0.55,
    heightM: 0.45,
    notes: "One asset. Closed visible until E, then open + loot peek.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:small_chest`,
  },
  {
    id: "prefab.barrel",
    name: "Barrel (E inspect)",
    role: "inspect",
    stationKind: "mage_spot",
    parts: [
      { meshName: PIRATE_MESH.barrelClosed, role: "closed" },
      { meshName: PIRATE_MESH.barrelOpen, role: "open" },
    ],
    lid: PIRATE_LID_PAIRS[1],
    lengthM: 0.55,
    heightM: 0.7,
    notes: "Closed/open barrel pair. E looks inside.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:barrel`,
  },
  {
    id: "prefab.fishing_rod",
    name: "Fishing Pole",
    role: "fishing",
    stationKind: "harpoon",
    parts: [{ meshName: PIRATE_MESH.fishingRod, role: "rod" }],
    lengthM: 1.6,
    heightM: 0.08,
    notes: "Hand pole (no line).",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:fishing_rod`,
  },
  {
    id: "prefab.fishing_rod_line",
    name: "Fishing Pole with Line",
    role: "fishing",
    stationKind: "harpoon",
    parts: [{ meshName: PIRATE_MESH.fishingRodLine, role: "rod_line" }],
    lengthM: 1.6,
    heightM: 1.5,
    notes: "Standing pole with line in the water.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:fishing_rod_line`,
  },
  {
    id: "prefab.net_dock",
    name: "Net stand",
    role: "fishing",
    stationKind: "harpoon",
    parts: [{ meshName: PIRATE_MESH.netDock, role: "net" }],
    lengthM: 1.4,
    heightM: 2.2,
    notes: "Fishing nets / stand.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:net_dock`,
  },
  {
    id: "prefab.oars",
    name: "Oar pair",
    role: "tool",
    stationKind: "oar",
    parts: [{ meshName: PIRATE_MESH.oars, role: "oar" }],
    lengthM: 2.2,
    heightM: 0.14,
    notes: "Row station.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:oars`,
  },
  {
    id: "prefab.dinghy",
    name: "Pack dinghy (visual)",
    role: "dinghy",
    parts: [
      { meshName: PIRATE_MESH.rowBoat, role: "hull" },
      { meshName: PIRATE_MESH.oars, role: "oar", offset: [0.55, 0.12, 0] },
    ],
    lengthM: 3.2,
    heightM: 0.7,
    notes: "Not a play BoatId. Skiff play mesh stays models/fleet/boats/rowboat.glb.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:dinghy_visual`,
  },
  {
    id: "prefab.flintlock",
    name: "Flintlock pistol",
    role: "weapon_prop",
    stationKind: "sniper_nest",
    parts: [{ meshName: PIRATE_MESH.flintlock, role: "pistol" }],
    lengthM: 0.35,
    heightM: 0.22,
    notes: "Prop only.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:flintlock`,
  },
  {
    id: "prefab.rifle",
    name: "Flintlock rifle",
    role: "weapon_prop",
    stationKind: "sniper_nest",
    parts: [{ meshName: PIRATE_MESH.rifle, role: "rifle" }],
    lengthM: 1.1,
    heightM: 0.18,
    notes: "Crow's nest prop.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:rifle`,
  },
  {
    id: "prefab.shovel",
    name: "Shovel",
    role: "tool",
    stationKind: "mage_spot",
    parts: [{ meshName: PIRATE_MESH.shovel, role: "shovel" }],
    lengthM: 1.2,
    heightM: 1.2,
    notes: "Dig / buried treasure.",
    d1Key: `${PIRATE_PACK_R2_KEY}#prefab:shovel`,
  },
];

export function getPiratePrefab(id: string): PiratePrefabDef | undefined {
  return PIRATE_PREFABS.find((p) => p.id === id);
}

export function pirateMeshUrl(preferCdn = true): string {
  return preferCdn ? PIRATE_PACK_CDN : PIRATE_PACK_LOCAL;
}

export function getPirateEntry(idOrCatalog: string): PiratePackEntry | undefined {
  return PIRATE_PACK_CATALOG.find(
    (e) =>
      e.id === idOrCatalog ||
      e.catalogIds?.includes(idOrCatalog) ||
      e.meshName === idOrCatalog,
  );
}

/** Mesh names list for D1 animation_packs.metadata.meshNames */
export function piratePackMeshNames(): string[] {
  return Object.values(PIRATE_MESH);
}

/** Loot table when shovel dig uncovers buried treasure. */
export const BURIED_TREASURE_LOOT = [
  { itemId: "gold_coin", name: "Gold Coin", emoji: "🪙", qtyMin: 3, qtyMax: 12, weight: 40 },
  { itemId: "pearl", name: "Pearl", emoji: "🤍", qtyMin: 1, qtyMax: 3, weight: 15 },
  { itemId: "ruby", name: "Ruby", emoji: "🔴", qtyMin: 1, qtyMax: 2, weight: 10 },
  { itemId: "gold_bar", name: "Gold Bar", emoji: "🟨", qtyMin: 1, qtyMax: 2, weight: 12 },
  { itemId: "pirate_key", name: "Pirate Key", emoji: "🔑", qtyMin: 1, qtyMax: 1, weight: 8 },
  { itemId: "bone_chest", name: "Bone Chest", emoji: "💀", qtyMin: 1, qtyMax: 1, weight: 5 },
  { itemId: "map_fragment", name: "Map Fragment", emoji: "🗺️", qtyMin: 1, qtyMax: 1, weight: 10 },
] as const;

export function rollBuriedTreasure(rng = Math.random): {
  itemId: string;
  name: string;
  emoji: string;
  qty: number;
} {
  const total = BURIED_TREASURE_LOOT.reduce((s, r) => s + r.weight, 0);
  let roll = rng() * total;
  for (const row of BURIED_TREASURE_LOOT) {
    roll -= row.weight;
    if (roll <= 0) {
      const qty =
        row.qtyMin +
        Math.floor(rng() * (row.qtyMax - row.qtyMin + 1));
      return {
        itemId: row.itemId,
        name: row.name,
        emoji: row.emoji,
        qty,
      };
    }
  }
  const fallback = BURIED_TREASURE_LOOT[0];
  return {
    itemId: fallback.itemId,
    name: fallback.name,
    emoji: fallback.emoji,
    qty: fallback.qtyMin,
  };
}
