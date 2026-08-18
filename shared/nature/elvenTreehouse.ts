/**
 * Elven treehouse (LOTR-style) — landmark for Fabled / elven islands
 * and dark-elf event zones.
 *
 * Binary: models/buildings/elven/elven_treehouse.glb
 * CDN:    https://assets.grudge-studio.com/models/buildings/elven/elven_treehouse.glb
 *
 * Isolations:
 *   Stairs_and_Treehouse — platform + stairs (walk / town pad)
 *   Tree                 — host trunk / canopy support
 *   defaultMaterial      — material mesh leaf (usually skip as isolate root)
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

export const ELVEN_TREEHOUSE_PACK = {
  key: "elven_treehouse",
  r2Key: "models/buildings/elven/elven_treehouse.glb",
  cdn: `${WARLORDS_CDN}/models/buildings/elven/elven_treehouse.glb`,
  local: "/models/buildings/elven/elven_treehouse.glb",
  targetHeightM: 14,
  roles: [
    "elven",
    "fabled",
    "dark_elf",
    "island",
    "event",
    "landmark",
    "housing",
  ],
  meshNames: {
    compound: "Stairs_and_Treehouse",
    tree: "Tree",
    platform: "Stairs_and_Treehouse",
  },
} as const;

/** Faction zone uses */
export type ElvenZoneKind = "fabled_island" | "elven_event" | "dark_elf_event";

export function elvenTreehouseForZone(kind: ElvenZoneKind) {
  const base = {
    pack: ELVEN_TREEHOUSE_PACK.key,
    path: ELVEN_TREEHOUSE_PACK.cdn,
    targetHeightM: ELVEN_TREEHOUSE_PACK.targetHeightM,
    meshName: ELVEN_TREEHOUSE_PACK.meshNames.compound,
    buildingId: "bld.elven_treehouse",
  };
  switch (kind) {
    case "dark_elf_event":
      return {
        ...base,
        tint: "#4a3060",
        faction: "fabled" as const, // shared mesh; dark-elf event uses cooler tint
        eventTags: ["dark_elf", "event", "treehouse"],
        ivyGrowth: 0.7,
      };
    case "elven_event":
      return {
        ...base,
        tint: "#7ecb8a",
        faction: "fabled" as const,
        eventTags: ["elven", "event", "treehouse"],
        ivyGrowth: 0.55,
      };
    default:
      return {
        ...base,
        tint: "#c9e8b8",
        faction: "fabled" as const,
        eventTags: ["elven", "island", "housing"],
        ivyGrowth: 0.4,
      };
  }
}

/** NPC activity pads relative to treehouse pivot (local m). */
export const ELVEN_TREEHOUSE_NAV = {
  ground_spawn: { x: 0, y: 0.1, z: -6 },
  stair_base: { x: 0, y: 0.15, z: -2 },
  platform: { x: 0, y: 4.5, z: 0 },
  lookout: { x: 1.5, y: 4.8, z: 1.2 },
} as const;
