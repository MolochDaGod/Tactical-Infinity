import { getGrudgeSDK, GrudgeSDK } from './grudge-sdk';

const sdk = getGrudgeSDK();

export interface WeaponDef {
  id: string;
  name: string;
  primaryStat: string;
  secondaryStat: string;
  emoji: string;
  lore: string;
  category: string;
  stats: {
    damageBase: number;
    damagePerTier: number;
    speedBase: number;
    speedPerTier: number;
    critBase: number;
    critPerTier: number;
    blockBase: number;
    blockPerTier: number;
    defenseBase: number;
    defensePerTier: number;
  };
  basicAbility: string;
  abilities: string[];
  signatureAbility: string;
  passives: string[];
  craftedBy: string;
  spritePath?: string;
}

export interface WeaponsResponse {
  version: string;
  total: number;
  tiers: number;
  categories: Record<string, {
    iconBase: string;
    iconMax: number;
    items: WeaponDef[];
  }>;
}

export interface WeaponSkillDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cooldown: number;
  manaCost: number;
  damageMultiplier: number;
  effect?: string;
  slot: string;
  slotLabel: string;
}

export interface WeaponSkillsResponse {
  version: string;
  weaponTypes: Record<string, {
    name: string;
    emoji: string;
    sharedSkills: Record<string, WeaponSkillDef[]>;
  }>;
}

export interface ClassAbility {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: string;
  damage: number;
  manaCost: number;
  staminaCost: number;
  cooldown: number;
  target: string;
  manaGain?: number;
  staminaGain?: number;
  effect?: Record<string, unknown>;
}

export interface ClassDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  lore: string;
  startingAttributes: Record<string, number>;
  weaponTypes: string[];
  armorTypes: string[];
  abilities: ClassAbility[];
}

export interface ClassesResponse {
  version: string;
  total: number;
  classes: Record<string, ClassDef>;
}

export interface RaceDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  faction: string;
  trait: string;
  description: string;
  lore: string;
  bonuses: Record<string, number>;
  passive: string;
  emoji: string;
}

export interface RacesResponse {
  version: string;
  total: number;
  races: Record<string, RaceDef>;
}

export interface AttributeDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  formula: string;
  emoji: string;
}

export interface AttributesResponse {
  version: string;
  total: number;
  attributes: AttributeDef[];
}

export interface FactionDef {
  id: string;
  name: string;
  patron: string;
  color: string;
  races: string[];
  description: string;
  lore: string;
  emoji: string;
}

export interface FactionsResponse {
  version: string;
  total: number;
  factions: Record<string, FactionDef>;
}

export const ObjectStore = {
  getWeapons: () => sdk.getWeapons() as Promise<WeaponsResponse>,
  getWeaponSkills: () => sdk.getWeaponSkills() as Promise<WeaponSkillsResponse>,
  getClasses: () => sdk.getClasses() as Promise<ClassesResponse>,
  getRaces: () => sdk.getRaces() as Promise<RacesResponse>,
  getAttributes: () => sdk.getAttributes() as Promise<AttributesResponse>,
  getFactions: () => sdk.getFactions() as Promise<FactionsResponse>,
  getArmor: () => sdk.getArmor(),
  getMaterials: () => sdk.getMaterials(),
  getConsumables: () => sdk.getConsumables(),
  getSkills: () => sdk.getSkills(),
  getProfessions: () => sdk.getProfessions(),
  getEnemies: () => sdk.getEnemies(),
  getBosses: () => sdk.getBosses(),
  getEffectSprites: () => sdk.getEffectSprites(),
  getItemsDatabase: () => sdk.fetch('/api/v1/items-database.json'),
  getSpriteCharacters: () => sdk.fetch('/api/v1/sprite-characters.json'),
};

export function calcWeaponDamage(weapon: WeaponDef, tier: number): number {
  return weapon.stats.damageBase + weapon.stats.damagePerTier * (tier - 1);
}

export function calcWeaponSpeed(weapon: WeaponDef, tier: number): number {
  return weapon.stats.speedBase + weapon.stats.speedPerTier * (tier - 1);
}

export const TIER_NAMES = [
  "", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Ancient", "Divine"
];

export const TIER_COLORS: Record<number, string> = {
  1: "#9ca3af", 2: "#22c55e", 3: "#3b82f6", 4: "#a855f7",
  5: "#f97316", 6: "#ef4444", 7: "#eab308", 8: "#f472b6",
};

export function getSlotColor(slot: string): string {
  switch (slot) {
    case "slot1": return "#22c55e";
    case "slot2": return "#3b82f6";
    case "slot3": return "#eab308";
    case "slot4": return "#a855f7";
    case "slot5": return "#ef4444";
    default: return "#9ca3af";
  }
}

export function getSlotLabel(slot: string): string {
  switch (slot) {
    case "slot1": return "Attack";
    case "slot2": return "Core";
    case "slot3": return "Defense";
    case "slot4": return "Special";
    case "slot5": return "Ultimate";
    default: return slot;
  }
}

export { GrudgeSDK, getGrudgeSDK } from './grudge-sdk';
