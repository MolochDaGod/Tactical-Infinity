// Shared "bare loadout" mesh visibility filter for Toon RTS character FBX
// files (BRB / WK / DWF / ELF / ORC / UD `*_Characters_customizable.FBX`).
//
// These FBX bundles ship every cosmetic variant in a single file — bags,
// wood/log resources, helmets, hoods, swords, spears, axes, shields, bows,
// staves, capes, gauntlets, etc. Out of the box every mesh renders, so the
// captain looks like a Christmas tree of every possible piece of kit.
//
// `applyBareLoadout` walks the model and hides anything that looks like
// equipment / a held resource / armor cosmetic, leaving only the bare body
// meshes (head/hands/feet/torso/hair/beard). A class-appropriate weapon is
// then meant to be ATTACHED separately to the hand bone (Barracks already
// does this via `getWeaponFBXForRace`).
//
// For "1 head with no armour" + "1 hair" + "1 beard" type slots where the
// FBX ships multiple naked variants, `keepOnePerSlot` runs after the equip
// hide pass and keeps only the first variant per slot bucket.

import * as THREE from "three";

// Equipment / cosmetic substring patterns (case-insensitive). Anything in
// the mesh's name (or any ancestor's name) matching ONE of these gets hidden.
const EQUIPMENT_PATTERNS: readonly string[] = [
  // Bags / packs / pouches / quivers
  "bag", "sack", "pouch", "pack", "knapsack", "backpack", "satchel", "quiver",
  // Carried resources
  "wood", "log", "lumber", "plank", "stone", "ore", "ingot",
  "fish", "meat", "food", "gold", "coin", "gem", "crystal", "barrel", "basket",
  // Weapons (the built-in cosmetic copies inside the character FBX —
  // class weapons are attached separately to the hand bone)
  "spear", "axe", "shield", "sword", "bow", "staff", "wand",
  "mace", "club", "hammer", "polearm", "halberd", "dagger", "knife",
  "scythe", "pike", "javelin", "crossbow", "arrow",
  "banner", "flag", "torch", "lantern",
  // Headwear / face cover
  "helmet", "hood", "hat", "cap_", "crown", "mask",
  // Armor pieces (the built-in cosmetic copies — equipment system will own these later)
  "gauntlet", "glove", "pauldron", "vambrace", "bracer",
  "breastplate", "chestplate", "cuirass", "platearmor", "armorplate",
  "chainmail", "scalemail", "robe", "tunic_armor",
  "greaves", "bootsarmor",
  // Outerwear
  "cloak", "cape_", "mantle",
];

// "Pick one" buckets — when an FBX ships multiple bare-body variants for the
// same slot we keep the first match and hide the rest. Patterns are tried in
// order; whichever bucket the mesh name falls into, that bucket gets at most
// one visible mesh.
const PICK_ONE_BUCKETS: readonly { id: string; pattern: RegExp }[] = [
  { id: "head",  pattern: /(?:^|[^a-z])head(?:[^a-z]|\d|$)/i },
  { id: "hair",  pattern: /(?:^|[^a-z])hair(?:[^a-z]|\d|$)/i },
  { id: "beard", pattern: /(?:^|[^a-z])beard(?:[^a-z]|\d|$)/i },
];

export interface BareLoadoutReport {
  hidden: string[];
  kept: string[];
  pickedOne: Record<string, string>; // bucket -> chosen mesh name
}

const matchesEquipment = (name: string): string | null => {
  const lower = name.toLowerCase();
  for (const pat of EQUIPMENT_PATTERNS) {
    if (lower.includes(pat)) return pat;
  }
  return null;
};

// Walks ancestors so a mesh inside a "Spear_01" group still gets hidden even
// if its own leaf name is just "Geo" or similar.
const ancestryName = (obj: THREE.Object3D): string => {
  const parts: string[] = [];
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.name) parts.push(cur.name);
    cur = cur.parent;
  }
  return parts.join("/");
};

export interface BareLoadoutOptions {
  // If true, multiple naked head/hair/beard variants are collapsed to one.
  // Default true — Toon RTS ships several head/hair variants per race.
  pickOneVariant?: boolean;
  // If true, the filter logs a single summary line per call. Useful while
  // iterating on the equipment pattern list.
  log?: boolean;
  // Optional label for the log line (e.g. race name).
  label?: string;
}

export function applyBareLoadout(
  model: THREE.Object3D,
  opts: BareLoadoutOptions = {},
): BareLoadoutReport {
  const { pickOneVariant = true, log = false, label = "" } = opts;

  const report: BareLoadoutReport = { hidden: [], kept: [], pickedOne: {} };

  // Pass 1: hide every mesh whose name (or ancestor chain) matches an
  // equipment pattern.
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const ancestry = ancestryName(mesh);
    const hit = matchesEquipment(ancestry);
    if (hit) {
      mesh.visible = false;
      report.hidden.push(`${mesh.name || "<anon>"}  [matched "${hit}"]`);
    }
  });

  // Pass 2: for each bare-body slot bucket (head/hair/beard), keep only the
  // first still-visible mesh and hide the rest.
  if (pickOneVariant) {
    const seen = new Set<string>();
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;

      const name = mesh.name;
      if (!name) return;

      for (const bucket of PICK_ONE_BUCKETS) {
        if (!bucket.pattern.test(name)) continue;
        if (seen.has(bucket.id)) {
          mesh.visible = false;
          report.hidden.push(`${name}  [extra "${bucket.id}" variant]`);
        } else {
          seen.add(bucket.id);
          report.pickedOne[bucket.id] = name;
        }
        break;
      }
    });
  }

  // Pass 3: collect what survived for diagnostics.
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.visible) {
      report.kept.push(mesh.name || "<anon>");
    }
  });

  if (log) {
    const tag = label ? ` [${label}]` : "";
    console.log(
      `[BareLoadout]${tag} kept ${report.kept.length} mesh(es), hid ${report.hidden.length}.`
        + (Object.keys(report.pickedOne).length
            ? `  picked: ${Object.entries(report.pickedOne).map(([k, v]) => `${k}=${v}`).join(", ")}`
            : ""),
    );
    console.log(`[BareLoadout]${tag} kept:  `, report.kept);
    console.log(`[BareLoadout]${tag} hidden:`, report.hidden);
  }

  return report;
}
