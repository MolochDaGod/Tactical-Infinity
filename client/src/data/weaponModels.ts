/**
 * Weapon Model Registry
 * Maps every weapon category to its FBX model files + shared atlas textures.
 * 192 models across 8 categories, 24 variants each.
 * All paths are relative to /public/.
 */

export type WeaponModelCategory =
  | 'sword'
  | 'axe_1h'
  | 'axe_2h'
  | 'hammer_2h'
  | 'bow'
  | 'crossbow'
  | 'polearm'
  | 'magic_staff';

export interface WeaponModelEntry {
  id: string;
  name: string;
  category: WeaponModelCategory;
  modelPath: string;
  texturePath: string;
  variant: number;
  tier: number;
  handedness: '1h' | '2h';
  ranged: boolean;
  magical: boolean;
}

const BASE = '/assets/weapons';

function buildEntries(
  category: WeaponModelCategory,
  folder: string,
  prefix: string,
  texture: string,
  handedness: '1h' | '2h',
  ranged: boolean,
  magical: boolean,
  displayName: string
): WeaponModelEntry[] {
  const entries: WeaponModelEntry[] = [];
  for (let i = 1; i <= 24; i++) {
    entries.push({
      id: `${category}_${i}`,
      name: `${displayName} ${i}`,
      category,
      modelPath: `${BASE}/${folder}/fbx/${prefix}${i}.fbx`,
      texturePath: `${BASE}/${folder}/${texture}`,
      variant: i,
      tier: Math.ceil(i / 3),
      handedness,
      ranged,
      magical
    });
  }
  return entries;
}

export const SWORD_MODELS: WeaponModelEntry[] = buildEntries(
  'sword', 'FOLDERS', '_sword_', 'texture/Texture_MAp_sword.png', '1h', false, false, 'Sword'
);

export const AXE_1H_MODELS: WeaponModelEntry[] = buildEntries(
  'axe_1h', 'AXES', '_axe_', 'texture/Texture_MAp_axe.png', '1h', false, false, 'Axe'
);

export const AXE_2H_MODELS: WeaponModelEntry[] = buildEntries(
  'axe_2h', 'AXESAND2H', '_axe_', 'texture/Texture_MAp_axe.png', '2h', false, false, 'Greataxe'
);

export const HAMMER_2H_MODELS: WeaponModelEntry[] = buildEntries(
  'hammer_2h', 'HAMMERS2H', '_hammer_', 'texture/Texture_MAp_axHammers.png', '2h', false, false, 'Warhammer'
);

export const BOW_MODELS: WeaponModelEntry[] = (() => {
  const entries: WeaponModelEntry[] = [];
  for (let i = 1; i <= 24; i++) {
    entries.push({
      id: `bow_${i}`,
      name: `Bow ${i}`,
      category: 'bow',
      modelPath: `${BASE}/BOW/fbx/bow_full/_bow_${i}.fbx`,
      texturePath: `${BASE}/BOW/Texture/Texture_MAp_bow.png`,
      variant: i,
      tier: Math.ceil(i / 3),
      handedness: '2h',
      ranged: true,
      magical: false
    });
  }
  return entries;
})();

export const ARROW_MODELS: { id: string; modelPath: string; variant: number }[] = (() => {
  const entries = [];
  for (let i = 1; i <= 24; i++) {
    entries.push({
      id: `arrow_b_${i}`,
      modelPath: `${BASE}/BOW/fbx/bow_full/arrows/_arrow_b_${i}.fbx`,
      variant: i
    });
  }
  return entries;
})();

export const CROSSBOW_MODELS: WeaponModelEntry[] = (() => {
  const entries: WeaponModelEntry[] = [];
  for (let i = 1; i <= 24; i++) {
    entries.push({
      id: `crossbow_${i}`,
      name: `Crossbow ${i}`,
      category: 'crossbow',
      modelPath: `${BASE}/CROSSSBOW/fbx/fbx_full/crossbow/_crossbow_${i}.fbx`,
      texturePath: `${BASE}/CROSSSBOW/texture/Texture_MAp_bow.png`,
      variant: i,
      tier: Math.ceil(i / 3),
      handedness: '2h',
      ranged: true,
      magical: false
    });
  }
  return entries;
})();

export const CROSSBOW_BOLT_MODELS: { id: string; modelPath: string; variant: number }[] = (() => {
  const entries = [];
  for (let i = 1; i <= 24; i++) {
    entries.push({
      id: `arrow_c_${i}`,
      modelPath: `${BASE}/CROSSSBOW/fbx/fbx_full/arrows/_arrow_c_${i}.fbx`,
      variant: i
    });
  }
  return entries;
})();

export const POLEARM_MODELS: WeaponModelEntry[] = buildEntries(
  'polearm', 'STAFFS', '_polearm_', 'texture/Texture_MAp_polearms.png', '2h', false, false, 'Polearm'
);

export const MAGIC_STAFF_MODELS: WeaponModelEntry[] = buildEntries(
  'magic_staff', 'magicstaffs', '_Cane_', 'texture/Texture_MAp_cane.png', '2h', false, true, 'Magic Staff'
);

export const ALL_WEAPON_MODELS: WeaponModelEntry[] = [
  ...SWORD_MODELS,
  ...AXE_1H_MODELS,
  ...AXE_2H_MODELS,
  ...HAMMER_2H_MODELS,
  ...BOW_MODELS,
  ...CROSSBOW_MODELS,
  ...POLEARM_MODELS,
  ...MAGIC_STAFF_MODELS
];

export const WEAPON_MODELS_BY_CATEGORY: Record<WeaponModelCategory, WeaponModelEntry[]> = {
  sword:       SWORD_MODELS,
  axe_1h:      AXE_1H_MODELS,
  axe_2h:      AXE_2H_MODELS,
  hammer_2h:   HAMMER_2H_MODELS,
  bow:         BOW_MODELS,
  crossbow:    CROSSBOW_MODELS,
  polearm:     POLEARM_MODELS,
  magic_staff: MAGIC_STAFF_MODELS
};

export function getWeaponModel(category: WeaponModelCategory, variant: number): WeaponModelEntry | undefined {
  const list = WEAPON_MODELS_BY_CATEGORY[category];
  return list.find(m => m.variant === variant) ?? list[0];
}

export function getWeaponModelsForTier(tier: number): WeaponModelEntry[] {
  return ALL_WEAPON_MODELS.filter(m => m.tier === tier);
}

export function getWeaponModelsByClass(cls: 'warrior' | 'ranger' | 'mage' | 'worge'): WeaponModelEntry[] {
  switch (cls) {
    case 'warrior': return [...SWORD_MODELS, ...AXE_1H_MODELS, ...AXE_2H_MODELS];
    case 'ranger':  return [...BOW_MODELS, ...CROSSBOW_MODELS];
    case 'mage':    return [...MAGIC_STAFF_MODELS, ...POLEARM_MODELS];
    case 'worge':   return [...HAMMER_2H_MODELS, ...POLEARM_MODELS];
  }
}

export const GOLDMINE_TEXTURE_PATH = '/assets/buildings/goldmine/texture/Texture_MAp_mines.png';
export const PROPS_TEXTURE_PATH    = '/assets/buildings/buildablkes/texture/Texture_map_props.png';
export const BUILDINGS_TEXTURE_PATH = '/assets/buildings/buildingmodels/Texture/Texture.png';

export type GoldmineAssetKey =
  | 'crystal_1' | 'crystal_2' | 'crystal_3' | 'crystal_4' | 'crystal_5' | 'crystal_6'
  | 'gold_1' | 'gold_2'
  | 'coal_1'
  | 'sapphire_1' | 'sapphire_2'
  | 'stone_2' | 'stone_3' | 'stone_4'
  | 'stone_coal' | 'stone_diamond' | 'stone_emerald' | 'stone_gold' | 'stone_mineral'
  | 'pick_1' | 'pick_2'
  | 'wood_house' | 'for_wood' | 'samwill';

export const GOLDMINE_MODELS: Record<GoldmineAssetKey, string> = {
  crystal_1:      '/assets/buildings/goldmine/fbx/full/_crystal_1.fbx',
  crystal_2:      '/assets/buildings/goldmine/fbx/full/_crystal_2.fbx',
  crystal_3:      '/assets/buildings/goldmine/fbx/full/_crystal_3.fbx',
  crystal_4:      '/assets/buildings/goldmine/fbx/full/_crystal_4.fbx',
  crystal_5:      '/assets/buildings/goldmine/fbx/full/_crystal_5.fbx',
  crystal_6:      '/assets/buildings/goldmine/fbx/full/_crystal_6.fbx',
  gold_1:         '/assets/buildings/goldmine/fbx/full/_gold_1.fbx',
  gold_2:         '/assets/buildings/goldmine/fbx/full/_gold_2.fbx',
  coal_1:         '/assets/buildings/goldmine/fbx/full/_coal_1.fbx',
  sapphire_1:     '/assets/buildings/goldmine/fbx/full/_sapfir_1.fbx',
  sapphire_2:     '/assets/buildings/goldmine/fbx/full/_sapfir_2.fbx',
  stone_2:        '/assets/buildings/goldmine/fbx/full/_stone_2.fbx',
  stone_3:        '/assets/buildings/goldmine/fbx/full/_stone_3.fbx',
  stone_4:        '/assets/buildings/goldmine/fbx/full/_stone_4.fbx',
  stone_coal:     '/assets/buildings/goldmine/fbx/full/_stone_coal.fbx',
  stone_diamond:  '/assets/buildings/goldmine/fbx/full/_stone_diamond.fbx',
  stone_emerald:  '/assets/buildings/goldmine/fbx/full/_stone_emerald.fbx',
  stone_gold:     '/assets/buildings/goldmine/fbx/full/_stone_gold.fbx',
  stone_mineral:  '/assets/buildings/goldmine/fbx/full/_stone_mineral.fbx',
  pick_1:         '/assets/buildings/goldmine/fbx/full/_pick_1.fbx',
  pick_2:         '/assets/buildings/goldmine/fbx/full/_pick_2.fbx',
  wood_house:     '/assets/buildings/goldmine/fbx/full/_wood_house.fbx',
  for_wood:       '/assets/buildings/goldmine/fbx/full/_for_wood.fbx',
  samwill:        '/assets/buildings/goldmine/fbx/full/_samwill.fbx'
};

export const PROP_MODELS = {
  barrel_1:    '/assets/buildings/buildablkes/fbx/_barrel_1.fbx',
  barrel_2:    '/assets/buildings/buildablkes/fbx/_barrel_2.fbx',
  torch_1:     '/assets/buildings/buildablkes/fbx/_torch_1.fbx',
  torch_2:     '/assets/buildings/buildablkes/fbx/_torch_2.fbx',
  pot_1:       '/assets/buildings/buildablkes/fbx/_pot_1.fbx',
  pot_2:       '/assets/buildings/buildablkes/fbx/_pot_2.fbx',
  pot_3:       '/assets/buildings/buildablkes/fbx/_pot_3.fbx',
  chair:       '/assets/buildings/buildablkes/fbx/_chair1.fbx',
  table:       '/assets/buildings/buildablkes/fbx/_table.fbx',
  throne:      '/assets/buildings/buildablkes/fbx/_throne.fbx',
  waterwheel:  '/assets/buildings/buildablkes/fbx/_waterwheel.fbx',
  flag:        '/assets/buildings/buildablkes/fbx/_flag.fbx',
  drum_1:      '/assets/buildings/buildablkes/fbx/_drum_1.fbx',
  drum_2:      '/assets/buildings/buildablkes/fbx/_drum_2.fbx',
  alarm_horn:  '/assets/buildings/buildablkes/fbx/_alarm_horn.fbx',
  box:         '/assets/buildings/buildablkes/fbx/_box.fbx',
  bake:        '/assets/buildings/buildablkes/fbx/_bake.fbx'
};

export const STRUCTURE_MODELS = {
  bridge:         '/assets/buildings/buildingmodels/fbx/bridge.fbx',
  gate_1:         '/assets/buildings/buildingmodels/fbx/gate_1.fbx',
  gate_2:         '/assets/buildings/buildingmodels/fbx/gate_2.fbx',
  fence_1:        '/assets/buildings/buildingmodels/fbx/Fense_1.fbx',
  fence_2:        '/assets/buildings/buildingmodels/fbx/Fense_2.fbx',
  gallows:        '/assets/buildings/buildingmodels/fbx/gallows.fbx',
  cart_1:         '/assets/buildings/buildingmodels/fbx/cart_1.fbx',
  cart_2:         '/assets/buildings/buildingmodels/fbx/cart_2.fbx',
  cart_3:         '/assets/buildings/buildingmodels/fbx/cart_3.fbx',
  bulletin_board: '/assets/buildings/buildingmodels/fbx/Bulletin_board.fbx',
  warning_bell:   '/assets/buildings/buildingmodels/fbx/warning_bell.fbx',
  ladder:         '/assets/buildings/buildingmodels/fbx/Ledder.fbx',
  pointer_1:      '/assets/buildings/buildingmodels/fbx/pointer_1.fbx',
  pointer_2:      '/assets/buildings/buildingmodels/fbx/pointer_2.fbx',
  barrel:         '/assets/buildings/buildingmodels/fbx/barrel.fbx',
  boat:           '/assets/buildings/buildingmodels/fbx/boat.fbx',
  bucket:         '/assets/buildings/buildingmodels/fbx/bucket.fbx',
  pads:           '/assets/buildings/buildingmodels/fbx/pads.fbx'
};
