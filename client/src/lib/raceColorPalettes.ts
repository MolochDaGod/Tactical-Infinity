import * as THREE from 'three';

export type RaceId = 'human' | 'barbarian' | 'dwarf' | 'elf' | 'orc' | 'undead';
export type ClassId = 'warrior' | 'ranger' | 'mage' | 'worge';

export interface RacePalette {
  skin:        number;
  skinShade:   number;
  hair:        number;
  clothPrimary:   number;
  clothSecondary: number;
  belt:        number;
  boots:       number;
  metal:       number;
  trim:        number;
  eye:         number;
}

export interface ClassColorLayer {
  armorPrimary:   number;
  armorSecondary: number;
  accent:         number;
  glow:           number;
}

export const RACE_PALETTES: Record<RaceId, RacePalette> = {
  human: {
    skin:           0xC4956A,
    skinShade:      0xA87850,
    hair:           0x3A2010,
    clothPrimary:   0xD4B890,
    clothSecondary: 0x6B4A2A,
    belt:           0x2A1A0A,
    boots:          0x4A3020,
    metal:          0x909090,
    trim:           0xF0EAD6,
    eye:            0x5A8080,
  },
  barbarian: {
    skin:           0xD4A870,
    skinShade:      0xB88848,
    hair:           0x8B5A28,
    clothPrimary:   0xD4853A,
    clothSecondary: 0x5C3A1A,
    belt:           0x3A2A1A,
    boots:          0xF0F0E0,
    metal:          0x909090,
    trim:           0xE8C890,
    eye:            0x7A5040,
  },
  dwarf: {
    skin:           0xB8865A,
    skinShade:      0x9A6A3A,
    hair:           0x4A2E14,
    clothPrimary:   0xB09070,
    clothSecondary: 0x8B6A40,
    belt:           0x2A1A0A,
    boots:          0x4A3020,
    metal:          0xC0A030,
    trim:           0xC8A860,
    eye:            0x605030,
  },
  elf: {
    skin:           0xD4B090,
    skinShade:      0xBB9070,
    hair:           0xE0C050,
    clothPrimary:   0xD4A840,
    clothSecondary: 0x6B4A2A,
    belt:           0x3A4060,
    boots:          0xA08060,
    metal:          0x4A5A7A,
    trim:           0xE8D090,
    eye:            0x30A070,
  },
  orc: {
    skin:           0x5C7A32,
    skinShade:      0x3A5018,
    hair:           0x2A3A14,
    clothPrimary:   0x8B5A28,
    clothSecondary: 0x3A3A1A,
    belt:           0x2A2A3A,
    boots:          0x5C7A32,
    metal:          0x5A6070,
    trim:           0xC04010,
    eye:            0xFF4400,
  },
  undead: {
    skin:           0xE8E0C8,
    skinShade:      0xB0A890,
    hair:           0xC8C0B0,
    clothPrimary:   0x7A7060,
    clothSecondary: 0x3A3020,
    belt:           0x2A2018,
    boots:          0x4A4030,
    metal:          0xC8C8C8,
    trim:           0xE0D8C0,
    eye:            0x8800CC,
  },
};

export const CLASS_LAYERS: Record<ClassId, ClassColorLayer> = {
  warrior: {
    armorPrimary:   0x5A6A7A,
    armorSecondary: 0x8A9AA8,
    accent:         0xC8A830,
    glow:           0xFFCC40,
  },
  ranger: {
    armorPrimary:   0x4A6A3A,
    armorSecondary: 0x7A9A60,
    accent:         0x80C040,
    glow:           0xA0FF60,
  },
  mage: {
    armorPrimary:   0x3A3A7A,
    armorSecondary: 0x6A6AAA,
    accent:         0x8040C0,
    glow:           0xB060FF,
  },
  worge: {
    armorPrimary:   0x5A3A2A,
    armorSecondary: 0x8A6A50,
    accent:         0xFF8020,
    glow:           0xFF9940,
  },
};

export interface MaterialTargetKeywords {
  skin:        string[];
  hair:        string[];
  cloth:       string[];
  leather:     string[];
  metal:       string[];
  eye:         string[];
}

export const MATERIAL_KEYWORDS: MaterialTargetKeywords = {
  skin:    ['skin', 'body', 'flesh', 'face', 'head', 'arm', 'hand', 'leg', 'foot', 'torso'],
  hair:    ['hair', 'beard', 'eyebrow', 'brow', 'moustache', 'fur'],
  cloth:   ['cloth', 'tunic', 'shirt', 'robe', 'coat', 'fabric', 'garment', 'cape', 'hood', 'loin', 'skirt', 'pants', 'trouser'],
  leather: ['boot', 'belt', 'strap', 'buckle', 'glove', 'gauntlet', 'bracer', 'pouch', 'bag', 'holster'],
  metal:   ['metal', 'iron', 'steel', 'plate', 'chain', 'mail', 'armor', 'armour', 'sword', 'axe', 'shield', 'helm', 'helmet', 'guard', 'knee', 'shoulder', 'pauldron', 'visor', 'ring'],
  eye:     ['eye', 'pupil', 'iris', 'cornea', 'eyeball'],
};

function hexToColor(hex: number): THREE.Color {
  return new THREE.Color(hex);
}

export function applyRaceMaterials(
  object: THREE.Object3D,
  race: RaceId,
  unitClass?: ClassId
): void {
  const palette = RACE_PALETTES[race];
  if (!palette) return;
  const classLayer = unitClass ? CLASS_LAYERS[unitClass] : null;

  const skinColor    = hexToColor(palette.skin);
  const hairColor    = hexToColor(palette.hair);
  const clothColor   = hexToColor(palette.clothPrimary);
  const leatherColor = hexToColor(palette.boots);
  const metalColor   = classLayer ? hexToColor(classLayer.armorPrimary) : hexToColor(palette.metal);
  const eyeColor     = hexToColor(palette.eye);
  const trimColor    = classLayer ? hexToColor(classLayer.accent) : hexToColor(palette.trim);

  let meshIndex = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat: any, _matIdx: number) => {
      if (!mat) return;

      const rawName = (mat.name || child.name || '').toLowerCase();

      const isSkin    = MATERIAL_KEYWORDS.skin.some(k => rawName.includes(k));
      const isHair    = MATERIAL_KEYWORDS.hair.some(k => rawName.includes(k));
      const isCloth   = MATERIAL_KEYWORDS.cloth.some(k => rawName.includes(k));
      const isLeather = MATERIAL_KEYWORDS.leather.some(k => rawName.includes(k));
      const isMetal   = MATERIAL_KEYWORDS.metal.some(k => rawName.includes(k));
      const isEye     = MATERIAL_KEYWORDS.eye.some(k => rawName.includes(k));

      if (isEye) {
        mat.color = eyeColor.clone();
        mat.emissive = eyeColor.clone().multiplyScalar(0.4);
        mat.emissiveIntensity = 0.6;
      } else if (isHair) {
        mat.color = hairColor.clone();
        mat.roughness = 0.85;
        mat.metalness = 0.0;
      } else if (isSkin && !isHair) {
        mat.color = skinColor.clone();
        mat.roughness = 0.8;
        mat.metalness = 0.0;
      } else if (isMetal) {
        mat.color = metalColor.clone();
        mat.roughness = 0.4;
        mat.metalness = 0.7;
        if (classLayer) {
          mat.emissive = hexToColor(classLayer.glow).multiplyScalar(0.05);
        }
      } else if (isLeather) {
        mat.color = leatherColor.clone();
        mat.roughness = 0.9;
        mat.metalness = 0.0;
      } else if (isCloth) {
        mat.color = clothColor.clone();
        mat.roughness = 0.95;
        mat.metalness = 0.0;
      } else {
        // Fallback: cycle through slots by mesh index
        const slot = meshIndex % 5;
        if (slot === 0) mat.color = skinColor.clone();
        else if (slot === 1) mat.color = clothColor.clone();
        else if (slot === 2) mat.color = metalColor.clone();
        else if (slot === 3) mat.color = leatherColor.clone();
        else mat.color = trimColor.clone();
      }

      mat.needsUpdate = true;
    });

    meshIndex++;
  });
}

export function getRaceCssFilter(race: RaceId): string {
  const filters: Record<RaceId, string> = {
    human:    'hue-rotate(0deg) saturate(1.1) brightness(1.0)',
    barbarian:'hue-rotate(20deg) saturate(1.3) brightness(1.05)',
    dwarf:    'hue-rotate(10deg) saturate(0.9) brightness(0.95)',
    elf:      'hue-rotate(35deg) saturate(1.2) brightness(1.1)',
    orc:      'hue-rotate(90deg) saturate(1.4) brightness(0.85)',
    undead:   'hue-rotate(200deg) saturate(0.2) brightness(1.3)',
  };
  return filters[race] ?? 'none';
}

export function getRacePrimaryHex(race: RaceId): string {
  const p = RACE_PALETTES[race];
  return `#${p.clothPrimary.toString(16).padStart(6, '0')}`;
}

export function getRaceSkinHex(race: RaceId): string {
  const p = RACE_PALETTES[race];
  return `#${p.skin.toString(16).padStart(6, '0')}`;
}
