/**
 * Low Poly Pirate Pack (pack 1) — mesh isolation + game roles.
 *
 * Binary: models/pirate/low_poly_pirate_pack_1.glb
 * CDN:    https://assets.grudge-studio.com/models/pirate/low_poly_pirate_pack_1.glb
 *
 * Source: D:\Games\Models\low_poly_pirate_pack__pack_1.glb
 * Never place the whole multi-mesh pack as one entity — isolate meshName.
 */

export const PIRATE_PACK_R2_KEY = "models/pirate/low_poly_pirate_pack_1.glb";
export const PIRATE_PACK_CDN =
  "https://assets.grudge-studio.com/models/pirate/low_poly_pirate_pack_1.glb";
export const PIRATE_PACK_LOCAL = "/models/pirate/low_poly_pirate_pack_1.glb";

/** Node name prefixes in the GLB (parent groups; mesh children append `_Material_0`). */
export const PIRATE_MESH = {
  /** Net dock / fishing stand with nets */
  netDock: "PIRATE_PACK-FishingStandNet",
  /** Coastal cannon barrel */
  cannon: "PIRATE_PACK-Cannon",
  /** Cannon carriage / base */
  cannonBase: "PIRATE_PACK-CannonStand",
  /** Bone / death chest — buried treasure dig find */
  boneChest: "PIRATE_PACK-Death_Chest-Closed",
  /** Standard pirate chest */
  chest: "PIRATE_PACK-Chest-Closed",
  /** Hand fishing pole (tool v1) */
  fishingRod: "PIRATE_PACK-FishingRod",
  /** Standing fishing pole with line set (tool v2) */
  fishingRodLine: "PIRATE_PACK-FishingRodStanding",
  /** Dig shovel */
  shovel: "PIRATE_PACK-Shovel",
  /** Drying rack (net dock companion prop) */
  fishingDry: "PIRATE_PACK-FishingDry",
  rowBoat: "PIRATE_PACK-RowBoat",
  oars: "PIRATE_PACK-RowBoatOars",
  coinPileSmall: "PIRATE_PACK-CoinPile_Small",
  coinPileLarge: "PIRATE_PACK-CoinPile_Large",
  goldBar: "PIRATE_PACK-GoldBar",
  skull: "PIRATE_PACK-Skull",
  key: "PIRATE_PACK-Key",
  skullKey: "PIRATE_PACK-SkullKey",
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
];

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
