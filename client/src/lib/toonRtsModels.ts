import type { Race, UnitClass } from "@shared/schema";

export interface ToonRTSModelInfo {
  race: Race;
  modelPath: string;
  texturePath: string;
  prefix: string;
  animations: Record<string, string>;
}

const TOON_RTS_BASE = "/3dassets/toon_rts/Toon_RTS";

export const raceToToonRTS: Record<Race, { folder: string; prefix: string }> = {
  human: { folder: "WesternKingdoms", prefix: "WK" },
  barbarian: { folder: "Barbarians", prefix: "BRB" },
  dwarf: { folder: "Dwarves", prefix: "DWF" },
  elf: { folder: "Elves", prefix: "ELV" },
  orc: { folder: "Orcs", prefix: "ORC" },
  undead: { folder: "Undead", prefix: "UND" },
};

export const classToUnitType: Record<UnitClass, string> = {
  warrior: "worker",
  mage: "mage",
  archer: "archer",
  healer: "mage",
  rogue: "worker",
  knight: "cavalry",
};

export function getModelPath(race: Race): string {
  const raceInfo = raceToToonRTS[race];
  return `${TOON_RTS_BASE}/${raceInfo.folder}/models/${raceInfo.prefix}_Characters_customizable.FBX`;
}

export function getCavalryModelPath(race: Race): string {
  const raceInfo = raceToToonRTS[race];
  return `${TOON_RTS_BASE}/${raceInfo.folder}/models/${raceInfo.prefix}_Cavalry_customizable.FBX`;
}

export function getTexturePath(race: Race, color: string = "Standard"): string {
  const raceInfo = raceToToonRTS[race];
  if (color === "Standard") {
    return `${TOON_RTS_BASE}/${raceInfo.folder}/models/Materials/${raceInfo.prefix}_Standard_Units.tga`;
  }
  return `${TOON_RTS_BASE}/${raceInfo.folder}/models/Materials/Colors/textures/${raceInfo.prefix}_StandardUnits_${color.toLowerCase()}.tga`;
}

export function getAnimationPath(race: Race, unitType: string, animName: string): string {
  const raceInfo = raceToToonRTS[race];
  const animFolder = unitType.charAt(0).toUpperCase() + unitType.slice(1);
  return `${TOON_RTS_BASE}/${raceInfo.folder}/animation/${animFolder}/${animName}.FBX`;
}

export function getWeaponPath(race: Race, weaponType: string): string {
  const raceInfo = raceToToonRTS[race];
  return `${TOON_RTS_BASE}/${raceInfo.folder}/models/extra models/Equipment/${raceInfo.prefix}_weapon_${weaponType}.FBX`;
}

export function getAvailableColors(race: Race): string[] {
  return ["Standard", "Black", "Blue", "Brown", "Green", "Red", "White"];
}

export function getModel3DConfig(race: Race, unitClass: UnitClass) {
  const unitType = classToUnitType[unitClass];
  const isCalvary = unitClass === "knight";
  
  return {
    race,
    modelPath: isCalvary ? getCavalryModelPath(race) : getModelPath(race),
    texturePath: getTexturePath(race),
    scale: 0.01,
    animations: {
      idle: `${raceToToonRTS[race].prefix}_${unitType}_01_idle`,
      run: `${raceToToonRTS[race].prefix}_${unitType}_03_run`,
      attack: `${raceToToonRTS[race].prefix}_${unitType}_07_attack`,
      death: `${raceToToonRTS[race].prefix}_${unitType}_10_death_B`,
    },
  };
}

export const availableRaces: Race[] = ["human", "barbarian", "dwarf", "elf", "orc", "undead"];
