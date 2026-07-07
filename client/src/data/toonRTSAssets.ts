/**
 * Toon RTS Character Asset Manifest
 * 
 * Maps 6 races across 3 factions with their models, equipment, armor, and animations.
 * 
 * Factions:
 * - Crusade: Human (WesternKingdoms/WK) + Barbarian (Barbarians/BRB)
 * - Fabled: Dwarf (Dwarves/DWF) + Elf (Elves/ELF)
 * - Legion: Orc (Orcs/ORC) + Undead (Undead/UD)
 */

export type Faction = 'crusade' | 'fabled' | 'legion';
export type Race = 'human' | 'barbarian' | 'dwarf' | 'elf' | 'orc' | 'undead';

export type ArmorTier = 'leather' | 'chainmail' | 'plate';
export type WeaponType = 'sword' | 'axe' | 'hammer' | 'spear' | 'staff' | 'bow';
export type ShieldType = 'buckler' | 'kite' | 'tower';
export type ToolType = 'pickaxe' | 'woodaxe' | 'hammer' | 'shovel';

export interface RaceAssetPrefix {
  code: string;           // Asset prefix (WK, BRB, DWF, ELF, ORC, UD)
  folder: string;         // Folder name in Toon_RTS
  faction: Faction;
}

export const RACE_PREFIXES: Record<Race, RaceAssetPrefix> = {
  human: { code: 'WK', folder: 'WesternKingdoms', faction: 'crusade' },
  barbarian: { code: 'BRB', folder: 'Barbarians', faction: 'crusade' },
  dwarf: { code: 'DWF', folder: 'Dwarves', faction: 'fabled' },
  elf: { code: 'ELF', folder: 'Elves', faction: 'fabled' },
  orc: { code: 'ORC', folder: 'Orcs', faction: 'legion' },
  undead: { code: 'UD', folder: 'Undead', faction: 'legion' },
};

export const FACTION_RACES: Record<Faction, Race[]> = {
  crusade: ['human', 'barbarian'],
  fabled: ['dwarf', 'elf'],
  legion: ['orc', 'undead'],
};

const BASE_PATH = '/toon_rts/Toon_RTS';

// Model paths for each race
export interface RaceModels {
  character: string;      // Main character model (customizable)
  cavalry: string;        // Mounted unit model
}

export const RACE_MODELS: Record<Race, RaceModels> = {
  human: {
    character: `${BASE_PATH}/WesternKingdoms/models/WK_Characters_customizable.FBX`,
    cavalry: `${BASE_PATH}/WesternKingdoms/models/WK_Cavalry_customizable.FBX`,
  },
  barbarian: {
    character: `${BASE_PATH}/Barbarians/models/BRB_Characters_customizable.FBX`,
    cavalry: `${BASE_PATH}/Barbarians/models/BRB_Cavalry_customizable.FBX`,
  },
  dwarf: {
    character: `${BASE_PATH}/Dwarves/models/DWF_Characters_customizable.FBX`,
    cavalry: `${BASE_PATH}/Dwarves/models/DWF_Cavalry_customizable.FBX`,
  },
  elf: {
    character: `${BASE_PATH}/Elves/models/ELF_Characters_customizable.FBX`,
    cavalry: `${BASE_PATH}/Elves/models/ELF_Cavalry_customizable.FBX`,
  },
  orc: {
    character: `${BASE_PATH}/Orcs/models/ORC_Characters_Customizable.FBX`,
    cavalry: `${BASE_PATH}/Orcs/models/ORC_Cavalry_Customizable.FBX`,
  },
  undead: {
    character: `${BASE_PATH}/Undead/models/UD_Characters_customizable.FBX`,
    cavalry: `${BASE_PATH}/Undead/models/UD_Cavalry_customizable.FBX`,
  },
};

// Equipment organized by race
export interface RaceEquipment {
  weapons: Record<string, string>;  // weapon name -> FBX path
  shields: Record<string, string>;  // shield name -> FBX path
  staffs: Record<string, string>;   // staff name -> FBX path
  tools: Record<string, string>;    // tool name -> FBX path
  misc: Record<string, string>;     // other equipment
}

export const RACE_EQUIPMENT: Record<Race, RaceEquipment> = {
  human: {
    weapons: {
      sword_a: `${BASE_PATH}/WesternKingdoms/models/extra models/equipment/WK_weapon_sword_A.FBX`,
    },
    shields: {},
    staffs: {
      staff_b: `${BASE_PATH}/WesternKingdoms/models/extra models/equipment/WK_weapon_staff_B.FBX`,
    },
    tools: {},
    misc: {},
  },
  barbarian: {
    weapons: {
      sword_b: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_sword_B.FBX`,
      hammer_b: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_hammer_B.FBX`,
      spear: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_spear.FBX`,
    },
    shields: {},
    staffs: {
      staff_b: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_staff_B.FBX`,
    },
    tools: {},
    misc: {
      bag: `${BASE_PATH}/Barbarians/models/extra models/BRB_bag.FBX`,
    },
  },
  dwarf: {
    weapons: {},
    shields: {},
    staffs: {},
    tools: {},
    misc: {},
  },
  elf: {
    weapons: {
      spear: `${BASE_PATH}/Elves/models/extra models/equipment/ELF_weapon_spear.FBX`,
    },
    shields: {},
    staffs: {
      staff_c: `${BASE_PATH}/Elves/models/extra models/equipment/ELF_weapon_staff_C.FBX`,
    },
    tools: {},
    misc: {
      bolt: `${BASE_PATH}/Elves/models/extra models/ELF_bolt.FBX`,
    },
  },
  orc: {
    weapons: {
      axe_a: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_weapon_Axe_A.FBX`,
    },
    shields: {
      shield_d: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_Shield_D.FBX`,
    },
    staffs: {
      staff_b: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_weapon_staff_B.FBX`,
    },
    tools: {},
    misc: {},
  },
  undead: {
    weapons: {
      sword_c: `${BASE_PATH}/Undead/models/extra_models/Equipment/UD_weapon_Sword_C.FBX`,
      spear: `${BASE_PATH}/Undead/models/extra_models/Equipment/UD_weapon_Spear.FBX`,
    },
    shields: {
      shield_c: `${BASE_PATH}/Undead/models/extra_models/Equipment/UD_Shield_C.FBX`,
    },
    staffs: {
      staff_b: `${BASE_PATH}/Undead/models/extra_models/Equipment/UD_weapon_staff_B.FBX`,
    },
    tools: {},
    misc: {},
  },
};

// Texture paths for materials/colors per race
export interface RaceTextures {
  standard: string;       // Standard texture
  colors: Record<string, string>;  // Color variants (brown, blue, red, etc.)
}

export const RACE_TEXTURES: Record<Race, RaceTextures> = {
  human: {
    standard: `${BASE_PATH}/WesternKingdoms/models/Materials/textures/WK_Standard_Units.tga`,
    colors: {
      black: `${BASE_PATH}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_black.tga`,
      blue: `${BASE_PATH}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_blue.tga`,
      brown: `${BASE_PATH}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_brown.tga`,
      green: `${BASE_PATH}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_green.tga`,
      red: `${BASE_PATH}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_red.tga`,
      white: `${BASE_PATH}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_white.tga`,
    },
  },
  barbarian: {
    standard: `${BASE_PATH}/Barbarians/models/Materials/BRB_StandardUnits_texture.tga`,
    colors: {
      brown: `${BASE_PATH}/Barbarians/models/Materials/Color/textures/BRB_Standard_Units_brown.tga`,
    },
  },
  dwarf: {
    standard: `${BASE_PATH}/Dwarves/models/Materials/DWF_Standard_Units.tga`,
    colors: {
      brown: `${BASE_PATH}/Dwarves/models/Materials/Colors/Textures/DWF_Units_Brown.tga`,
    },
  },
  elf: {
    standard: `${BASE_PATH}/Elves/models/Materials/ELF_DarkElves_Texture.tga`,
    colors: {
      blue: `${BASE_PATH}/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Blue.tga`,
      green: `${BASE_PATH}/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Green.tga`,
      red: `${BASE_PATH}/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Red.tga`,
    },
  },
  orc: {
    standard: `${BASE_PATH}/Orcs/models/Materials/textures/ORC_StandardUnits.tga`,
    colors: {
      brown: `${BASE_PATH}/Orcs/models/Materials/color/textures/ORC_StandardUnits_brown.tga`,
    },
  },
  undead: {
    standard: `${BASE_PATH}/Undead/models/Materials/UD_Standard_Units.tga`,
    colors: {
      brown: `${BASE_PATH}/Undead/models/Materials/Colors/textures/UD_Standard_Units_brown.tga`,
    },
  },
};

// Animation sets per race
export interface RaceAnimations {
  infantry: Record<string, string>;   // Infantry animations
  cavalry: Record<string, string>;    // Mounted animations
  worker: Record<string, string>;     // Worker/civilian animations
  siege: Record<string, string>;      // Siege weapon animations
}

export const RACE_ANIMATIONS: Record<Race, RaceAnimations> = {
  human: {
    infantry: {},
    cavalry: {
      idle: `${BASE_PATH}/WesternKingdoms/animation/Cavalry/WK_cavalry_01_idle.FBX`,
      run: `${BASE_PATH}/WesternKingdoms/animation/Cavalry/WK_cavalry_03_run.FBX`,
      death_b: `${BASE_PATH}/WesternKingdoms/animation/Cavalry/WK_cavalry_10_death_B.FBX`,
    },
    worker: {},
    siege: {
      idle: `${BASE_PATH}/WesternKingdoms/animation/Catapult/WK_catapult_01_idle.FBX`,
      move: `${BASE_PATH}/WesternKingdoms/animation/Catapult/WK_catapult_02_move.FBX`,
      attack: `${BASE_PATH}/WesternKingdoms/animation/Catapult/WK_catapult_03_attack.FBX`,
      death: `${BASE_PATH}/WesternKingdoms/animation/Catapult/WK_catapult_04_death.FBX`,
    },
  },
  barbarian: {
    infantry: {
      mage_cast_b: `${BASE_PATH}/Barbarians/animation/Mage/BRB_mage_11_cast_B.FBX`,
      spearman_attack: `${BASE_PATH}/Barbarians/animation/Spearman/BRB_spearman_07_attack.FBX`,
    },
    cavalry: {},
    worker: {},
    siege: {},
  },
  dwarf: {
    infantry: {},
    cavalry: {
      idle: `${BASE_PATH}/Dwarves/animation/Cavalry/DWF_cavalry_01_idle.FBX`,
      run: `${BASE_PATH}/Dwarves/animation/Cavalry/DWF_cavalry_03_run.FBX`,
      death_b: `${BASE_PATH}/Dwarves/animation/Cavalry/DWF_cavalry_10_death_B.FBX`,
    },
    worker: {
      idle: `${BASE_PATH}/Dwarves/animation/Worker/_idle.FBX`,
      run: `${BASE_PATH}/Dwarves/animation/Worker/run.FBX`,
      run_reverse: `${BASE_PATH}/Dwarves/animation/Worker/run Reverse.FBX`,
      run_diagonal: `${BASE_PATH}/Dwarves/animation/Worker/run diagonal.FBX`,
      run_diagonal_1: `${BASE_PATH}/Dwarves/animation/Worker/run diagonal 1.FBX`,
      attack: `${BASE_PATH}/Dwarves/animation/Worker/DWF_worker_07_attack.FBX`,
      death_b: `${BASE_PATH}/Dwarves/animation/Worker/DWF_worker_10_death_B.FBX`,
    },
    siege: {},
  },
  elf: {
    infantry: {},
    cavalry: {
      mage_attack_b: `${BASE_PATH}/Elves/animation/Cavalry_Mage/ELF_cavalry_mage_08_attack_B.FBX`,
      spear_charge: `${BASE_PATH}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_04_charge.FBX`,
      spear_combat_idle: `${BASE_PATH}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_05_combat_idle.FBX`,
      spear_attack: `${BASE_PATH}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_07_attack.FBX`,
      spear_death_a: `${BASE_PATH}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_10_death_A.FBX`,
    },
    worker: {},
    siege: {
      idle: `${BASE_PATH}/Elves/animation/BoltThrower/ELF_boltthrower_01_idle.FBX`,
      move: `${BASE_PATH}/Elves/animation/BoltThrower/ELF_boltthrower_02_move.FBX`,
      attack: `${BASE_PATH}/Elves/animation/BoltThrower/ELF_boltthrower_03_attack.FBX`,
      death: `${BASE_PATH}/Elves/animation/BoltThrower/ELF_boltthrower_04_death.FBX`,
    },
  },
  orc: {
    infantry: {},
    cavalry: {
      idle: `${BASE_PATH}/Orcs/animation/Cavalry/ORC_cavalry_01_idle.FBX`,
      run: `${BASE_PATH}/Orcs/animation/Cavalry/ORC_cavalry_03_run.FBX`,
      death_b: `${BASE_PATH}/Orcs/animation/Cavalry/ORC_cavalry_10_death_B.FBX`,
    },
    worker: {
      working_a: `${BASE_PATH}/Orcs/animation/Worker/ORC_worker_12_working_A.FBX`,
    },
    siege: {
      idle: `${BASE_PATH}/Orcs/animation/Catapult/ORC_catapult_01_idle.FBX`,
      move: `${BASE_PATH}/Orcs/animation/Catapult/ORC_catapult_02_move.FBX`,
      attack: `${BASE_PATH}/Orcs/animation/Catapult/ORC_catapult_03_attack.FBX`,
      death: `${BASE_PATH}/Orcs/animation/Catapult/ORC_catapult_04_death.FBX`,
    },
  },
  undead: {
    infantry: {},
    cavalry: {},
    worker: {},
    siege: {},
  },
};

// Siege/Special units per race
export interface SpecialUnits {
  catapult?: string;
  boltthrower?: string;
}

export const RACE_SPECIAL_UNITS: Record<Race, SpecialUnits> = {
  human: {
    catapult: `${BASE_PATH}/WesternKingdoms/models/WK_Catapult.FBX`,
  },
  barbarian: {},
  dwarf: {},
  elf: {
    boltthrower: `${BASE_PATH}/Elves/models/ELF_BoltThrower.FBX`,
  },
  orc: {
    catapult: `${BASE_PATH}/Orcs/models/ORC_Catapult.FBX`,
  },
  undead: {},
};

// ============================================================
// CHARACTER CONFIGURATION FOR BARRACKS
// ============================================================

export type UnitClass = 'warrior' | 'mage' | 'archer' | 'rogue';

export interface CharacterEquipmentSlots {
  mainHand: string | null;    // Weapon in main hand
  offHand: string | null;     // Shield or secondary weapon
  armor: ArmorTier;           // Current armor tier
}

export interface BarracksCharacter {
  id: string;
  race: Race;
  faction: Faction;
  unitClass: UnitClass;
  name: string;
  modelPath: string;
  texturePath: string;
  equipment: CharacterEquipmentSlots;
  animations: Record<string, string>;
  scale: number;
}

// Default sword paths for each race (for leather armor default)
const DEFAULT_SWORDS: Record<Race, string | null> = {
  human: `${BASE_PATH}/WesternKingdoms/models/extra models/equipment/WK_weapon_sword_A.FBX`,
  barbarian: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_sword_B.FBX`,
  dwarf: null, // No sword available, will use shared
  elf: null,   // Use spear as default
  orc: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_weapon_Axe_A.FBX`, // Axe for orcs
  undead: `${BASE_PATH}/Undead/models/extra_models/Equipment/UD_weapon_Sword_C.FBX`,
};

// Default shields for each race
const DEFAULT_SHIELDS: Record<Race, string | null> = {
  human: null,
  barbarian: null,
  dwarf: null,
  elf: null,
  orc: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_Shield_D.FBX`,
  undead: `${BASE_PATH}/Undead/models/extra_models/Equipment/UD_Shield_C.FBX`,
};

// Generate default characters for all 6 races with leather armor + sword & shield
export function generateDefaultBarracksCharacters(): BarracksCharacter[] {
  const characters: BarracksCharacter[] = [];
  
  const races: Race[] = ['human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead'];
  
  races.forEach((race, index) => {
    const prefix = RACE_PREFIXES[race];
    const model = RACE_MODELS[race];
    const texture = RACE_TEXTURES[race];
    
    characters.push({
      id: `${race}_warrior_default`,
      race,
      faction: prefix.faction,
      unitClass: 'warrior',
      name: `${race.charAt(0).toUpperCase() + race.slice(1)} Warrior`,
      modelPath: model.character,
      texturePath: texture.standard,
      equipment: {
        mainHand: DEFAULT_SWORDS[race],
        offHand: DEFAULT_SHIELDS[race],
        armor: 'leather',
      },
      animations: {},
      scale: 0.012, // Default scale for Toon RTS models
    });
  });
  
  return characters;
}

// Get all available weapons for a race
export function getAvailableWeapons(race: Race): Record<string, string> {
  return RACE_EQUIPMENT[race].weapons;
}

// Get all available shields for a race
export function getAvailableShields(race: Race): Record<string, string> {
  return RACE_EQUIPMENT[race].shields;
}

// Get all available staffs for a race
export function getAvailableStaffs(race: Race): Record<string, string> {
  return RACE_EQUIPMENT[race].staffs;
}

// Shared equipment that can be used across races (fallback)
export const SHARED_EQUIPMENT = {
  weapons: {
    sword: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_sword_B.FBX`,
    hammer: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_hammer_B.FBX`,
    spear: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_spear.FBX`,
    axe: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_weapon_Axe_A.FBX`,
    bow: `/models/props/weapons/orc/_BOW.fbx`,
    mace: `/models/props/weapons/orc/_MACE.fbx`,
  },
  shields: {
    shield: `${BASE_PATH}/Orcs/models/extra_models/Equipment/ORC_Shield_D.FBX`,
  },
  staffs: {
    staff: `${BASE_PATH}/Barbarians/models/extra models/Equipment/BRB_weapon_staff_B.FBX`,
  },
};

export type WeaponStyle = 'sword_shield' | 'greatsword' | 'bow' | 'spear' | 'staff' | 'gun' | 'axe' | 'mace_shield';

export interface WeaponStyleConfig {
  label: string;
  animationSet: 'melee_1h' | 'melee_2h' | 'ranged_bow' | 'ranged_1h' | 'magic' | 'melee_1h';
  mainHandScale: number;
  mainHandOffset: [number, number, number];
  mainHandRotation: [number, number, number];
  offHandItem: 'shield' | null;
  offHandScale: number;
  offHandOffset: [number, number, number];
  offHandRotation: [number, number, number];
}

export const WEAPON_STYLE_CONFIGS: Record<WeaponStyle, WeaponStyleConfig> = {
  sword_shield: {
    label: 'Sword & Shield',
    animationSet: 'melee_1h',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [Math.PI / 2, 0, 0],
    offHandItem: 'shield',
    offHandScale: 0.012,
    offHandOffset: [0, 0.02, 0],
    offHandRotation: [0, 0, 0],
  },
  greatsword: {
    label: 'Greatsword',
    animationSet: 'melee_2h',
    mainHandScale: 0.014,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [Math.PI / 2, 0, 0],
    offHandItem: null,
    offHandScale: 0,
    offHandOffset: [0, 0, 0],
    offHandRotation: [0, 0, 0],
  },
  bow: {
    label: 'Bow',
    animationSet: 'ranged_bow',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [0, Math.PI / 2, 0],
    offHandItem: null,
    offHandScale: 0,
    offHandOffset: [0, 0, 0],
    offHandRotation: [0, 0, 0],
  },
  spear: {
    label: 'Spear',
    animationSet: 'melee_2h',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [Math.PI / 2, 0, 0],
    offHandItem: null,
    offHandScale: 0,
    offHandOffset: [0, 0, 0],
    offHandRotation: [0, 0, 0],
  },
  staff: {
    label: 'Staff',
    animationSet: 'magic',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [Math.PI / 2, 0, 0],
    offHandItem: null,
    offHandScale: 0,
    offHandOffset: [0, 0, 0],
    offHandRotation: [0, 0, 0],
  },
  gun: {
    label: 'Crossbow',
    animationSet: 'ranged_1h',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0.02],
    mainHandRotation: [0, 0, Math.PI / 2],
    offHandItem: null,
    offHandScale: 0,
    offHandOffset: [0, 0, 0],
    offHandRotation: [0, 0, 0],
  },
  axe: {
    label: 'Axe',
    animationSet: 'melee_1h',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [Math.PI / 2, 0, 0],
    offHandItem: null,
    offHandScale: 0,
    offHandOffset: [0, 0, 0],
    offHandRotation: [0, 0, 0],
  },
  mace_shield: {
    label: 'Mace & Shield',
    animationSet: 'melee_1h',
    mainHandScale: 0.012,
    mainHandOffset: [0, 0.02, 0],
    mainHandRotation: [Math.PI / 2, 0, 0],
    offHandItem: 'shield',
    offHandScale: 0.012,
    offHandOffset: [0, 0.02, 0],
    offHandRotation: [0, 0, 0],
  },
};

export const WEAPON_CYCLE_ORDER: WeaponStyle[] = ['sword_shield', 'greatsword', 'bow', 'spear', 'staff', 'gun', 'axe', 'mace_shield'];

export function getWeaponFBXForRace(race: Race, style: WeaponStyle): { mainHand: string | null; offHand: string | null } {
  const equip = RACE_EQUIPMENT[race];
  const shared = SHARED_EQUIPMENT;

  switch (style) {
    case 'sword_shield': {
      const sword = Object.values(equip.weapons).find(w => w.toLowerCase().includes('sword'))
        || shared.weapons.sword;
      const shield = Object.values(equip.shields)[0] || shared.shields.shield;
      return { mainHand: sword || null, offHand: shield || null };
    }
    case 'greatsword': {
      const sword = Object.values(equip.weapons).find(w => w.toLowerCase().includes('sword'))
        || shared.weapons.sword;
      return { mainHand: sword || null, offHand: null };
    }
    case 'bow': {
      return { mainHand: shared.weapons.bow || null, offHand: null };
    }
    case 'spear': {
      const spear = Object.values(equip.weapons).find(w => w.toLowerCase().includes('spear'))
        || shared.weapons.spear;
      return { mainHand: spear || null, offHand: null };
    }
    case 'staff': {
      const staff = Object.values(equip.staffs)[0] || shared.staffs.staff;
      return { mainHand: staff || null, offHand: null };
    }
    case 'gun': {
      return { mainHand: null, offHand: null };
    }
    case 'axe': {
      const axe = Object.values(equip.weapons).find(w => w.toLowerCase().includes('axe'))
        || shared.weapons.axe;
      return { mainHand: axe || null, offHand: null };
    }
    case 'mace_shield': {
      const mace = shared.weapons.mace;
      const shield = Object.values(equip.shields)[0] || shared.shields.shield;
      return { mainHand: mace || null, offHand: shield || null };
    }
  }
}

export const KAYKIT_ANIM_PATHS = {
  melee_medium: '/animations/kaykit/medium/Rig_Medium_CombatMelee.glb',
  ranged_medium: '/animations/kaykit/medium/Rig_Medium_CombatRanged.glb',
  general_medium: '/animations/kaykit/medium/Rig_Medium_General.glb',
  movement_basic: '/animations/kaykit/medium/Rig_Medium_MovementBasic.glb',
  movement_adv: '/animations/kaykit/medium/Rig_Medium_MovementAdvanced.glb',
  tools_medium: '/animations/kaykit/medium/Rig_Medium_Tools.glb',
  special_medium: '/animations/kaykit/medium/Rig_Medium_Special.glb',
};

// Canonical faction colors — match the official emblems in
// `public/factions/*.png`. Crusade is steel-and-blue, Fabled is emerald,
// Legion is blood red. Every UI surface that tints by faction reads from
// here so the three Grudge Land games stay visually in sync.
export const FACTION_COLORS: Record<Faction, string> = {
  crusade: '#3b82f6',
  fabled:  '#22c55e',
  legion:  '#dc2626',
};

export const RACE_DISPLAY_NAMES: Record<Race, string> = {
  human: 'Human',
  barbarian: 'Barbarian',
  dwarf: 'Dwarf',
  elf: 'Elf',
  orc: 'Orc',
  undead: 'Undead',
};

export function logAssetSummary(): void {
  console.log('=== TOON RTS ASSET SUMMARY ===');
  console.log('');
  console.log('FACTIONS & RACES:');
  Object.entries(FACTION_RACES).forEach(([faction, races]) => {
    console.log(`  ${faction.toUpperCase()}: ${races.join(', ')}`);
  });
  console.log('');
  console.log('MODELS:');
  Object.entries(RACE_MODELS).forEach(([race, models]) => {
    console.log(`  ${race}:`);
    console.log(`    Character: ${models.character}`);
    console.log(`    Cavalry: ${models.cavalry}`);
  });
  console.log('');
  console.log('EQUIPMENT:');
  Object.entries(RACE_EQUIPMENT).forEach(([race, equip]) => {
    const weaponCount = Object.keys(equip.weapons).length;
    const shieldCount = Object.keys(equip.shields).length;
    const staffCount = Object.keys(equip.staffs).length;
    console.log(`  ${race}: ${weaponCount} weapons, ${shieldCount} shields, ${staffCount} staffs`);
  });
}
