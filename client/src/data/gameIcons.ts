// Central registry for framed medallion & weapon icons served from public/.
// Element medallions share the ornate gold-frame style (fire/frost/storm/holy
// are hand-authored; the rest are generated to match). Reference by URL so the
// icons stay data-driven and get picked up by the asset uploader / CDN fallback.

export type ElementKey =
  | "fire"
  | "frost"
  | "storm"
  | "holy"
  | "arcane"
  | "nature"
  | "water"
  | "earth"
  | "poison"
  | "shadow"
  | "physical";

export const ELEMENT_ICONS: Record<ElementKey, string> = {
  fire: "/icons/elements/fire.png",
  frost: "/icons/elements/frost.png",
  storm: "/icons/elements/storm.png",
  holy: "/icons/elements/holy.png",
  arcane: "/icons/elements/arcane.png",
  nature: "/icons/elements/nature.png",
  water: "/icons/elements/water.png",
  earth: "/icons/elements/earth.png",
  poison: "/icons/elements/poison.png",
  shadow: "/icons/elements/shadow.png",
  physical: "/icons/elements/physical.png",
};

// Common aliases seen across the game data (frost/ice, storm/lightning, ...).
const ELEMENT_ALIASES: Record<string, ElementKey> = {
  ice: "frost",
  cold: "frost",
  lightning: "storm",
  thunder: "storm",
  light: "holy",
  radiant: "holy",
  divine: "holy",
  spell: "arcane",
  magic: "arcane",
  dark: "shadow",
  death: "shadow",
  necrotic: "shadow",
  void: "shadow",
  toxic: "poison",
  venom: "poison",
  acid: "poison",
  aqua: "water",
  ground: "earth",
  rock: "earth",
  stone: "earth",
  wind: "storm",
  air: "storm",
  melee: "physical",
  blunt: "physical",
  slash: "physical",
  pierce: "physical",
};

/** Resolve any element/damage-type string to a medallion icon URL (falls back to arcane). */
export function elementIcon(name: string | null | undefined): string {
  if (!name) return ELEMENT_ICONS.arcane;
  const key = name.toLowerCase().trim();
  if (Object.hasOwn(ELEMENT_ICONS, key)) return ELEMENT_ICONS[key as ElementKey];
  const alias = ELEMENT_ALIASES[key];
  if (alias) return ELEMENT_ICONS[alias];
  return ELEMENT_ICONS.arcane;
}

export type WeaponIconKey =
  | "ornate-spear"
  | "gray-spear"
  | "flaming-spear"
  | "flaming-staff"
  | "water-sword"
  | "spectral-dagger"
  | "golden-arrow";

export const WEAPON_ICONS: Record<WeaponIconKey, string> = {
  "ornate-spear": "/icons/weapons/ornate-spear.png",
  "gray-spear": "/icons/weapons/gray-spear.png",
  "flaming-spear": "/icons/weapons/flaming-spear.png",
  "flaming-staff": "/icons/weapons/flaming-staff.png",
  "water-sword": "/icons/weapons/water-sword.png",
  "spectral-dagger": "/icons/weapons/spectral-dagger.png",
  "golden-arrow": "/icons/weapons/golden-arrow.png",
};

// Brand / marketing art (logos + hero splash) served from public/.
export const BRAND = {
  logo: "/brand/grudge-logo.png",
  logoVox: "/brand/grudgevox.png",
  helmet: "/brand/voxel-helmet.png",
  legionBoss: "/brand/legion-boss.png",
  pirates: "/brand/pirates.png",
  heroes: "/ui/loadscreen/heroes.png",
} as const;
