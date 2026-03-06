import type { UnitClass, Faction, WeaponType, ArmorType, EquipmentItem, CharacterEquipment, SpriteConfig } from "@shared/schema";

export const SPRITE_BASE_PATH = "/sprites";
export const CHARACTER_SPRITE_PATH = "/sprites/characters";

export const tierColors: Record<number, string> = {
  0: "tier-common",
  1: "tier-uncommon", 
  2: "tier-rare",
  3: "tier-epic",
  4: "tier-legendary",
  5: "tier-mythic",
  6: "tier-ancient",
  7: "tier-celestial",
  8: "tier-divine",
};

export const tierNames: Record<number, string> = {
  0: "Rusty",
  1: "Copper",
  2: "Iron",
  3: "Steel",
  4: "Mithril",
  5: "Adamantine",
  6: "Orichalcum",
  7: "Starmetal",
  8: "Divine",
};

export const tierGlowColors: Record<number, string> = {
  0: "rgba(128, 128, 128, 0.3)",
  1: "rgba(184, 115, 51, 0.4)",
  2: "rgba(192, 192, 192, 0.5)",
  3: "rgba(70, 130, 180, 0.5)",
  4: "rgba(138, 43, 226, 0.6)",
  5: "rgba(255, 140, 0, 0.6)",
  6: "rgba(255, 215, 0, 0.7)",
  7: "rgba(135, 206, 250, 0.7)",
  8: "rgba(255, 255, 255, 0.8)",
};

export const classDefaultWeapons: Record<UnitClass, WeaponType> = {
  warrior: "sword",
  ranger: "bow",
  mage: "staff",
  worge: "dagger",
};

export const classDefaultArmor: Record<UnitClass, ArmorType> = {
  warrior: "plate",
  ranger: "leather",
  mage: "cloth",
  worge: "leather",
};

export const weaponSprites: Record<WeaponType, Record<number, string>> = {
  sword: {
    0: `${SPRITE_BASE_PATH}/sword/rusty-sword.png`,
    1: `${SPRITE_BASE_PATH}/sword/copper-sword.png`,
    2: `${SPRITE_BASE_PATH}/sword/iron-sword.png`,
    3: `${SPRITE_BASE_PATH}/sword/steel-sword.png`,
    4: `${SPRITE_BASE_PATH}/sword/mithril-sword.png`,
    5: `${SPRITE_BASE_PATH}/sword/adamantine-sword.png`,
    6: `${SPRITE_BASE_PATH}/sword/orichalcum-sword.png`,
    7: `${SPRITE_BASE_PATH}/sword/starmetal-sword.png`,
    8: `${SPRITE_BASE_PATH}/sword/divine-sword.png`,
  },
  axe: {
    0: `${SPRITE_BASE_PATH}/axe/chipped-axe.png`,
    1: `${SPRITE_BASE_PATH}/axe/copper-axe.png`,
    2: `${SPRITE_BASE_PATH}/axe/iron-axe.png`,
    3: `${SPRITE_BASE_PATH}/axe/steel-axe.png`,
    4: `${SPRITE_BASE_PATH}/axe/mithril-axe.png`,
    5: `${SPRITE_BASE_PATH}/axe/adamantine-axe.png`,
    6: `${SPRITE_BASE_PATH}/axe/orichalcum-axe.png`,
    7: `${SPRITE_BASE_PATH}/axe/starmetal-axe.png`,
    8: `${SPRITE_BASE_PATH}/axe/divine-axe.png`,
  },
  dagger: {
    0: `${SPRITE_BASE_PATH}/dagger/blunt-dagger.png`,
    1: `${SPRITE_BASE_PATH}/dagger/nightfang.png`,
    2: `${SPRITE_BASE_PATH}/dagger/shadowpiercer.png`,
    3: `${SPRITE_BASE_PATH}/dagger/venombite.png`,
    4: `${SPRITE_BASE_PATH}/dagger/whisperwind.png`,
    5: `${SPRITE_BASE_PATH}/dagger/adamantine-dagger.png`,
    6: `${SPRITE_BASE_PATH}/dagger/orichalcum-dagger.png`,
    7: `${SPRITE_BASE_PATH}/dagger/starmetal-dagger.png`,
    8: `${SPRITE_BASE_PATH}/dagger/divine-dagger.png`,
  },
  hammer: {
    0: `${SPRITE_BASE_PATH}/hammer/worn-hammer.png`,
    1: `${SPRITE_BASE_PATH}/hammer/bloodfeud-hammer.png`,
    2: `${SPRITE_BASE_PATH}/hammer/wraithfang-mace.png`,
    3: `${SPRITE_BASE_PATH}/hammer/oathbreaker-maul.png`,
    4: `${SPRITE_BASE_PATH}/hammer/kinrend-crusher.png`,
    5: `${SPRITE_BASE_PATH}/hammer/adamantine-hammer.png`,
    6: `${SPRITE_BASE_PATH}/hammer/orichalcum-hammer.png`,
    7: `${SPRITE_BASE_PATH}/hammer/starmetal-hammer.png`,
    8: `${SPRITE_BASE_PATH}/hammer/divine-hammer.png`,
  },
  bow: {
    0: `${SPRITE_BASE_PATH}/bow/simple-bow.png`,
    1: `${SPRITE_BASE_PATH}/bow/copper-bow.png`,
    2: `${SPRITE_BASE_PATH}/bow/iron-bow.png`,
    3: `${SPRITE_BASE_PATH}/bow/steel-bow.png`,
    4: `${SPRITE_BASE_PATH}/bow/mithril-bow.png`,
    5: `${SPRITE_BASE_PATH}/bow/adamantine-bow.png`,
    6: `${SPRITE_BASE_PATH}/bow/orichalcum-bow.png`,
    7: `${SPRITE_BASE_PATH}/bow/starmetal-bow.png`,
    8: `${SPRITE_BASE_PATH}/bow/divine-bow.png`,
  },
  crossbow: {
    0: `${SPRITE_BASE_PATH}/crossbow/makeshift-crossbow.png`,
    1: `${SPRITE_BASE_PATH}/crossbow/ironveil-repeater.png`,
    2: `${SPRITE_BASE_PATH}/crossbow/iron-crossbow.png`,
    3: `${SPRITE_BASE_PATH}/crossbow/steel-crossbow.png`,
    4: `${SPRITE_BASE_PATH}/crossbow/mithril-crossbow.png`,
    5: `${SPRITE_BASE_PATH}/crossbow/adamantine-crossbow.png`,
    6: `${SPRITE_BASE_PATH}/crossbow/orichalcum-crossbow.png`,
    7: `${SPRITE_BASE_PATH}/crossbow/starmetal-crossbow.png`,
    8: `${SPRITE_BASE_PATH}/crossbow/divine-crossbow.png`,
  },
  gun: {
    0: `${SPRITE_BASE_PATH}/gun/rusty-gun.png`,
    1: `${SPRITE_BASE_PATH}/gun/blackpowder-blaster.png`,
    2: `${SPRITE_BASE_PATH}/gun/iron-gun.png`,
    3: `${SPRITE_BASE_PATH}/gun/steel-gun.png`,
    4: `${SPRITE_BASE_PATH}/gun/mithril-gun.png`,
    5: `${SPRITE_BASE_PATH}/gun/adamantine-gun.png`,
    6: `${SPRITE_BASE_PATH}/gun/orichalcum-gun.png`,
    7: `${SPRITE_BASE_PATH}/gun/starmetal-gun.png`,
    8: `${SPRITE_BASE_PATH}/gun/divine-gun.png`,
  },
  staff: {
    0: `${SPRITE_BASE_PATH}/staff/gnarled-staff.png`,
    1: `${SPRITE_BASE_PATH}/staff/bloodfeud-staff.png`,
    2: `${SPRITE_BASE_PATH}/staff/wraithfang-staff.png`,
    3: `${SPRITE_BASE_PATH}/staff/oathbreaker-staff.png`,
    4: `${SPRITE_BASE_PATH}/staff/kinrend-staff.png`,
    5: `${SPRITE_BASE_PATH}/staff/glacial-spire-staff.png`,
    6: `${SPRITE_BASE_PATH}/staff/orichalcum-staff.png`,
    7: `${SPRITE_BASE_PATH}/staff/starmetal-staff.png`,
    8: `${SPRITE_BASE_PATH}/staff/divine-staff.png`,
  },
  tome: {
    0: `${SPRITE_BASE_PATH}/tome/tattered-tome.png`,
    1: `${SPRITE_BASE_PATH}/tome/fire-tome.png`,
    2: `${SPRITE_BASE_PATH}/tome/frost-tome.png`,
    3: `${SPRITE_BASE_PATH}/tome/nature-tome.png`,
    4: `${SPRITE_BASE_PATH}/tome/holy-tome.png`,
    5: `${SPRITE_BASE_PATH}/tome/arcane-tome.png`,
    6: `${SPRITE_BASE_PATH}/tome/lightning-tome.png`,
    7: `${SPRITE_BASE_PATH}/tome/starmetal-tome.png`,
    8: `${SPRITE_BASE_PATH}/tome/divine-tome.png`,
  },
};

export const characterSprites: Record<string, SpriteConfig> = {
  baldric: {
    baseSprite: `${SPRITE_BASE_PATH}/characters/baldric/walk.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      walk: { frames: 6, fps: 8, row: 0 },
      idle: { frames: 1, fps: 1, row: 0 },
    },
  },
  mage: {
    baseSprite: `${SPRITE_BASE_PATH}/characters/mage/walk.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      walk: { frames: 8, fps: 8, row: 0 },
      idle: { frames: 1, fps: 1, row: 0 },
    },
  },
};

export const classToCharacterSprite: Record<UnitClass, string> = {
  warrior: "baldric",
  ranger: "baldric",
  mage: "mage",
  worge: "baldric",
};

export const factionSpriteVariants: Record<Faction, { hue: number; saturation: number }> = {
  crusade: { hue: 45, saturation: 100 },
  fabled: { hue: 270, saturation: 80 },
  legion: { hue: 0, saturation: 70 },
};

export function generateEquipment(unitClass: UnitClass, tier: number = 0): CharacterEquipment {
  const weaponType = classDefaultWeapons[unitClass];
  const armorType = classDefaultArmor[unitClass];
  const tierName = tierNames[tier] || "Rusty";
  
  return {
    weapon: {
      id: `${weaponType}-t${tier}`,
      name: `${tierName} ${weaponType.charAt(0).toUpperCase() + weaponType.slice(1)}`,
      slot: "weapon",
      tier,
      weaponType,
      spritePath: weaponSprites[weaponType]?.[tier] || weaponSprites[weaponType]?.[0],
    },
    chest: {
      id: `${armorType}-chest-t${tier}`,
      name: `${tierName} ${armorType.charAt(0).toUpperCase() + armorType.slice(1)} Armor`,
      slot: "chest",
      tier,
      armorType,
    },
    head: {
      id: `${armorType}-head-t${tier}`,
      name: `${tierName} ${armorType.charAt(0).toUpperCase() + armorType.slice(1)} Helm`,
      slot: "head",
      tier,
      armorType,
    },
  };
}

export function getWeaponSprite(weaponType: WeaponType, tier: number): string | undefined {
  return weaponSprites[weaponType]?.[tier] || weaponSprites[weaponType]?.[0];
}

export function getCharacterSprite(unitClass: UnitClass): SpriteConfig | undefined {
  const spriteKey = classToCharacterSprite[unitClass];
  return characterSprites[spriteKey];
}

export function getTierGlow(tier: number): string {
  return tierGlowColors[tier] || tierGlowColors[0];
}
