/**
 * Warlords-era asset catalog — SSOT for game layers + R2 keys.
 *
 * Database model (grudge-assets-db / asset_registry):
 *   id, name, category, r2_key, grudge_uuid, file_size, animation_packs(JSON metadata)
 * CDN: https://assets.grudge-studio.com/{r2_key}
 * API: https://api.grudge-studio.com/assets | /assets/category/:cat | /assets/:id
 *
 * Pipeline: R2 upload → seed D1 (scripts/seed-warlords-d1.mjs) → runtime resolve here.
 * Games MUST prefer catalog r2Key / cdnUrl over inventing paths.
 *
 * Game layers (home island / open water):
 *   terrain, water, nature, harvest, fauna_land, fauna_ocean, buildings, mines,
 *   mountains, farm, chain, characters, survival
 */

export const WARLORDS_CDN = 'https://assets.grudge-studio.com';
export const ASSET_API = 'https://api.grudge-studio.com';

/** D1 category values (asset_registry.category) */
export type WarlordsAssetCategory =
  | 'character'
  | 'creature'
  | 'environment'
  | 'terrain'
  | 'building'
  | 'item'
  | 'texture'
  | 'prop';

/** Which gameplay layer consumes this asset */
export type WarlordsGameLayer =
  | 'characters'
  | 'terrain'
  | 'water'
  | 'nature'
  | 'harvest'
  | 'fauna_land'
  | 'fauna_ocean'
  | 'buildings_rts'
  | 'mines'
  | 'mountains'
  | 'farm'
  | 'chain'
  | 'survival'
  | 'props';

export interface WarlordsAssetEntry {
  /** Stable id → also D1 `id` (sanitized) */
  id: string;
  name: string;
  category: WarlordsAssetCategory;
  /** R2 object key (no leading slash) */
  r2Key: string;
  layer: WarlordsGameLayer;
  /** World target size metres after normalize (height or length) */
  targetSizeM?: number;
  /** Multipack: isolate these node names only */
  meshNames?: readonly string[];
  tags?: readonly string[];
  /** Soft notes for seeders / agents */
  notes?: string;
}

export function cdnUrl(r2Key: string): string {
  const key = r2Key.replace(/^\//, '');
  // Encode each path segment (handles "Manta ray.fbx") without encoding slashes
  const encoded = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${WARLORDS_CDN}/${encoded}`;
}

export function catalogIdFromR2Key(r2Key: string): string {
  return r2Key
    .replace(/\//g, '_')
    .replace(/[^A-Za-z0-9_\-.]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

// ── Characters (grudge6) ─────────────────────────────────────────────────────

export const WARLORDS_CHARACTERS: WarlordsAssetEntry[] = (
  [
    ['human', 'WK_Characters.fbx', 'western-kingdoms/WK_Standard_Units.webp'],
    ['barbarian', 'BRB_Characters.fbx', 'barbarians/BRB_StandardUnits_texture.webp'],
    ['dwarf', 'DWF_Characters.fbx', 'dwarves/DWF_Standard_Units.webp'],
    ['elf', 'ELF_Characters.fbx', 'elves/ELF_HighElves_Texture.webp'],
    ['orc', 'ORC_Characters.fbx', 'orcs/ORC_StandardUnits.webp'],
    ['undead', 'UD_Characters.fbx', 'undead/UD_Standard_Units.webp'],
  ] as const
).flatMap(([race, fbx, tex]) => [
  {
    id: catalogIdFromR2Key(`models/grudge6/races/${fbx}`),
    name: `grudge6_${race}`,
    category: 'character' as const,
    r2Key: `models/grudge6/races/${fbx}`,
    layer: 'characters' as const,
    targetSizeM: 1.8,
    tags: ['grudge6', 'player', race],
  },
  {
    id: catalogIdFromR2Key(`textures/grudge6/${tex}`),
    name: `grudge6_tex_${race}`,
    category: 'texture' as const,
    r2Key: `textures/grudge6/${tex}`,
    layer: 'characters' as const,
    tags: ['grudge6', 'texture', race],
  },
]);

// ── Nature multipacks (isolate meshNames) ────────────────────────────────────

export const WARLORDS_NATURE: WarlordsAssetEntry[] = [
  {
    id: 'nature_vegetation',
    name: 'nature_vegetation',
    category: 'environment',
    r2Key: 'models/nature/stylized/biome/nature_vegetation.glb',
    layer: 'nature',
    meshNames: [
      'Tree_Big_a_LOD0_17', 'Tree_Big_b_LOD0_13', 'Tree_Small_a_LOD0_12',
      'Pine_Big_LOD0_7', 'Pine_Medium_LOD0_6', 'Conifer_LOD0_8',
    ],
    targetSizeM: 6,
    tags: ['tree', 'isolate'],
  },
  {
    id: 'nature_tropical',
    name: 'tropical_plants',
    category: 'environment',
    r2Key: 'models/nature/stylized/biome/tropical_plants.glb',
    layer: 'nature',
    meshNames: ['SM_MZRa_Palm_B081', 'SM_MZRa_Palm_B082', 'SM_MZRa_Banana_B091'],
    targetSizeM: 5,
    tags: ['palm', 'isolate'],
  },
  {
    id: 'nature_rocks',
    name: 'stylised_rocks',
    category: 'environment',
    r2Key: 'models/nature/stylized/rocks/stylised_rocks.glb',
    layer: 'nature',
    meshNames: [
      'Plain_Rock1', 'Plain_Rock2', 'Plain_Rock5', 'Plain_Rock10', 'Plain_Rock16',
      'Mossy_Rock1', 'Mossy_Rock4', 'Mossy_Rock8',
      'Snowy_Rock1', 'Desert_Rock1', 'Desert_Rock5',
    ],
    targetSizeM: 2.5,
    tags: ['rock', 'isolate', 'harvest', 'home', 'sector', 'event'],
    notes: 'Island harvest seeds: plain/mossy/snow/desert families — isolate meshName',
  },
  {
    id: 'harvest_woods_rocks_foliage',
    name: 'rocks_and_foliage_woods',
    category: 'environment',
    r2Key: 'models/nature/stylized/harvest/rocks_and_foliage_woods.glb',
    layer: 'harvest',
    meshNames: [
      'Icosphere', 'Icosphere.001', 'Icosphere.003', 'Cube.001', 'Cube.003',
      'grass', 'grass bush', 'Plane.010', 'Plane.012', 'Plane.015',
    ],
    targetSizeM: 1.8,
    tags: ['rock', 'foliage', 'isolate', 'harvest', 'home', 'sector', 'forest'],
    notes: 'House-in-the-woods pack — boulder + grass bush harvest seeds',
  },
  {
    id: 'nature_example_home',
    name: 'example_home_island',
    category: 'environment',
    r2Key: 'models/nature/stylized/concept/example_home_island.glb',
    layer: 'nature',
    meshNames: ['Tree1_171', 'Tree2_173', 'Rock_9', 'Cliffs_2'],
    notes: 'Isolate variants only — never place whole pack',
    tags: ['concept', 'isolate'],
  },
];

export const WARLORDS_HARVEST: WarlordsAssetEntry[] = [
  {
    id: 'harvest_ore_nodes',
    name: 'ore_nodes',
    category: 'environment',
    r2Key: 'models/nature/stylized/harvest/ore_nodes.glb',
    layer: 'harvest',
    meshNames: ['Iron_Node', 'Copper_Node', 'Coal_Node', 'Tin_Node', 'Ore_Iron', 'Ore_Copper'],
    targetSizeM: 1.8,
    tags: ['ore', 'node', 'isolate'],
  },
  {
    id: 'harvest_minerals',
    name: 'minerals_pack',
    category: 'environment',
    r2Key: 'models/nature/stylized/harvest/minerals_pack.glb',
    layer: 'harvest',
    meshNames: ['crystal_basalt_green.007', 'crystal_basalt_green.010'],
    targetSizeM: 1.2,
    tags: ['mineral', 'isolate'],
  },
  {
    id: 'harvest_flowers',
    name: 'flowers_pack',
    category: 'environment',
    r2Key: 'models/nature/stylized/harvest/flowers_pack.glb',
    layer: 'harvest',
    meshNames: ['flower15', 'Plane.001', 'Plane.012'],
    targetSizeM: 0.6,
    tags: ['flower', 'isolate'],
  },
  {
    id: 'harvest_foliage',
    name: 'foliage_pack',
    category: 'environment',
    r2Key: 'models/nature/stylized/harvest/foliage_pack.glb',
    layer: 'harvest',
    targetSizeM: 1.0,
    tags: ['foliage', 'isolate'],
  },
];

// ── Battle Kenney nature (primary land scatter — matches GrudgeBuilder) ──────
// CDN: assets.grudge-studio.com/models/nature/* — prefer .glb over multipacks.

const battleNature = (
  file: string,
  tags: string[],
  h = 4,
): WarlordsAssetEntry => ({
  id: catalogIdFromR2Key(`models/nature/${file}`),
  name: file.replace(/\.(glb|gltf)$/i, ''),
  category: 'environment',
  r2Key: `models/nature/${file}`,
  layer: 'nature',
  targetSizeM: h,
  tags: ['battle', 'kenney', ...tags],
});

export const WARLORDS_BATTLE_NATURE: WarlordsAssetEntry[] = [
  ...[1, 2, 3, 4, 5].map((n) => battleNature(`CommonTree_${n}.glb`, ['tree'], 7)),
  ...[1, 2, 3, 4, 5].map((n) => battleNature(`DeadTree_${n}.glb`, ['tree', 'dead'], 6)),
  ...[1, 2, 3, 4, 5].map((n) => battleNature(`Pine_${n}.glb`, ['tree', 'pine'], 8)),
  ...[1, 2, 3, 4, 5].map((n) => battleNature(`Pebble_Round_${n}.glb`, ['rock', 'pebble'], 0.4)),
  ...[1, 2, 3].map((n) => battleNature(`Rock_Medium_${n}.glb`, ['rock'], 2.2)),
  battleNature('Bush_Common.glb', ['bush'], 1.2),
  battleNature('Bush_Common_Flowers.glb', ['bush', 'flower'], 1.2),
  battleNature('Mushroom_Common.glb', ['mushroom'], 0.35),
  battleNature('Mushroom_Laetiporus.glb', ['mushroom'], 0.4),
  battleNature('Grass_Common_Short.glb', ['grass'], 0.35),
  battleNature('Grass_Common_Tall.glb', ['grass'], 0.55),
  battleNature('Grass_Wispy_Short.glb', ['grass'], 0.3),
  battleNature('Grass_Wispy_Tall.glb', ['grass'], 0.5),
  battleNature('Clover_1.glb', ['groundcover'], 0.15),
  battleNature('Fern_1.glb', ['fern'], 0.6),
  battleNature('Plant_1.glb', ['plant'], 0.5),
  battleNature('Plant_1_Big.glb', ['plant'], 0.9),
];

// ── Land fauna (CreatureManifest CDN GLBs — GrudgeBuilder SSOT) ─────────────
// Short keys match biomeEcosystemCatalog wildlife pools; resolve aliases in GB.

const landFauna = (
  id: string,
  r2Key: string,
  h: number,
  tags: string[] = [],
): WarlordsAssetEntry => ({
  id,
  name: id,
  category: 'creature',
  r2Key,
  layer: 'fauna_land',
  targetSizeM: h,
  tags: ['huntable', ...tags],
});

export const WARLORDS_FAUNA_LAND: WarlordsAssetEntry[] = [
  landFauna('wolf', 'models/creatures/land/wolf.glb', 0.9, ['predator']),
  landFauna('buffalo', 'models/creatures/land/buffalo.glb', 1.6, ['large']),
  landFauna('deer', 'models/creatures/land/cotw/deer.glb', 1.35, ['prey', 'cotw']),
  landFauna('rabbit', 'models/creatures/land/cotw/beaver.glb', 0.38, ['prey', 'hare', 'proxy']),
  landFauna('cotw_boar', 'models/creatures/land/cotw/boar.glb', 0.95, ['prey', 'cotw', 'alias:boar']),
  landFauna('cotw_bear', 'models/creatures/land/cotw/bear.glb', 1.5, ['predator', 'cotw', 'alias:bear']),
  landFauna('cotw_lynx', 'models/creatures/land/cotw/lynx.glb', 0.75, ['predator', 'cotw', 'alias:fox']),
  landFauna('cotw_beaver', 'models/creatures/land/cotw/beaver.glb', 0.45, ['prey', 'cotw']),
  landFauna('cotw_raccoon', 'models/creatures/land/cotw/raccoon.glb', 0.4, ['prey', 'cotw']),
  landFauna('cotw_ibex', 'models/creatures/land/cotw/ibex.glb', 1.0, ['prey', 'cotw', 'alias:ibex']),
  landFauna('cotw_alligator', 'models/creatures/land/cotw/alligator.glb', 0.7, ['predator', 'cotw']),
  landFauna('hawk', 'models/creatures/land/hawk.glb', 0.4, ['bird']),
  // crab uses ObjectStore split pack in runtime; CDN key is documentation-only
  landFauna('crab', 'models/creatures/land/crab.glb', 0.15, ['shore', 'objectstore-preferred']),
];

// ── Ocean fauna (Quaternius FBX + production GLB fish) ───────────────────────

export const WARLORDS_FAUNA_OCEAN: WarlordsAssetEntry[] = [
  { id: 'fish_fish1', name: 'Fish1', category: 'creature', r2Key: 'models/fauna/fish/Fish1.fbx', layer: 'fauna_ocean', targetSizeM: 0.55, tags: ['fish', 'catchable', 'fbx'] },
  { id: 'fish_fish2', name: 'Fish2', category: 'creature', r2Key: 'models/fauna/fish/Fish2.fbx', layer: 'fauna_ocean', targetSizeM: 0.6, tags: ['fish', 'catchable', 'fbx'] },
  { id: 'fish_fish3', name: 'Fish3', category: 'creature', r2Key: 'models/fauna/fish/Fish3.fbx', layer: 'fauna_ocean', targetSizeM: 0.5, tags: ['fish', 'catchable', 'fbx'] },
  { id: 'fish_dolphin', name: 'Dolphin', category: 'creature', r2Key: 'models/fauna/fish/Dolphin.fbx', layer: 'fauna_ocean', targetSizeM: 2.4, tags: ['fish', 'harpoon', 'fbx'] },
  { id: 'fish_shark_fbx', name: 'Shark', category: 'creature', r2Key: 'models/fauna/fish/Shark.fbx', layer: 'fauna_ocean', targetSizeM: 3.2, tags: ['fish', 'harpoon', 'fbx'] },
  { id: 'fish_manta', name: 'Manta-ray', category: 'creature', r2Key: 'models/fauna/fish/Manta-ray.fbx', layer: 'fauna_ocean', targetSizeM: 2.8, tags: ['fish', 'harpoon', 'fbx'] },
  { id: 'fish_manta_space', name: 'Manta ray', category: 'creature', r2Key: 'models/fauna/fish/Manta ray.fbx', layer: 'fauna_ocean', targetSizeM: 2.8, tags: ['fish', 'harpoon', 'alt', 'fbx'] },
  { id: 'fish_whale', name: 'Whale', category: 'creature', r2Key: 'models/fauna/fish/Whale.fbx', layer: 'fauna_ocean', targetSizeM: 7.5, tags: ['fish', 'harpoon', 'fbx'] },
  // Production GLB fish (CreatureManifest / pond water layer)
  { id: 'fish_anglerfish', name: 'Anglerfish', category: 'creature', r2Key: 'models/creatures/fish/anglerfish.glb', layer: 'fauna_ocean', targetSizeM: 0.55, tags: ['fish', 'glb', 'pond'] },
  { id: 'fish_lionfish', name: 'Lionfish', category: 'creature', r2Key: 'models/creatures/fish/lionfish.glb', layer: 'fauna_ocean', targetSizeM: 0.5, tags: ['fish', 'glb', 'pond'] },
  { id: 'fish_goldfish', name: 'Goldfish', category: 'creature', r2Key: 'models/creatures/fish/goldfish.glb', layer: 'fauna_ocean', targetSizeM: 0.25, tags: ['fish', 'glb', 'pond'] },
  { id: 'fish_blobfish', name: 'Blobfish', category: 'creature', r2Key: 'models/creatures/fish/blobfish.glb', layer: 'fauna_ocean', targetSizeM: 0.4, tags: ['fish', 'glb'] },
  { id: 'fish_catfish', name: 'Catfish', category: 'creature', r2Key: 'models/creatures/fish/catfish.glb', layer: 'fauna_ocean', targetSizeM: 0.6, tags: ['fish', 'glb'] },
  { id: 'fish_butterflyfish', name: 'Butterflyfish', category: 'creature', r2Key: 'models/creatures/fish/butterflyfish.glb', layer: 'fauna_ocean', targetSizeM: 0.3, tags: ['fish', 'glb'] },
  { id: 'fish_flatfish', name: 'Flatfish', category: 'creature', r2Key: 'models/creatures/fish/flatfish.glb', layer: 'fauna_ocean', targetSizeM: 0.35, tags: ['fish', 'glb'] },
  { id: 'fish_shark_glb', name: 'Reef Shark', category: 'creature', r2Key: 'models/creatures/predator/shark.glb', layer: 'fauna_ocean', targetSizeM: 2.5, tags: ['fish', 'glb', 'predator'] },
];

// ── Surface layers (land / coast / water / mountain) ─────────────────────────

export const WARLORDS_SURFACE_LAYER: WarlordsAssetEntry[] = [
  {
    id: 'surface_tropical_palms',
    name: 'tropical_plants',
    category: 'environment',
    r2Key: 'models/nature/stylized/biome/tropical_plants.glb',
    layer: 'nature',
    tags: ['coast', 'palm', 'isolate'],
    notes: 'Coast / beach — isolate palm meshNames',
  },
  {
    id: 'surface_pond_pack',
    name: 'pond_pack',
    category: 'environment',
    r2Key: 'models/nature/stylized/harvest/pond_pack.glb',
    layer: 'water',
    tags: ['pond', 'water', 'isolate'],
  },
  {
    id: 'surface_mtn_peak_0',
    name: 'evil_rock_mountain_peak_0',
    category: 'terrain',
    r2Key: 'models/evil_rock_mountain_peak_0.glb',
    layer: 'mountains',
    targetSizeM: 40,
    tags: ['peak', 'event'],
  },
  {
    id: 'surface_mtn_peak_1',
    name: 'evil_rock_mountain_peak_1',
    category: 'terrain',
    r2Key: 'models/evil_rock_mountain_peak_1.glb',
    layer: 'mountains',
    targetSizeM: 40,
    tags: ['peak', 'event'],
  },
  {
    id: 'surface_mtn_peak_2',
    name: 'evil_rock_mountain_peak_2',
    category: 'terrain',
    r2Key: 'models/evil_rock_mountain_peak_2.glb',
    layer: 'mountains',
    targetSizeM: 40,
    tags: ['peak', 'event'],
  },
  {
    id: 'surface_mtn_triad',
    name: 'evil_rock_mountains_triad',
    category: 'terrain',
    r2Key: 'models/evil_rock_mountains_triad.glb',
    layer: 'mountains',
    targetSizeM: 50,
    tags: ['triad', 'portal'],
  },
];

// ── Farm livestock ───────────────────────────────────────────────────────────

export const WARLORDS_FARM_ANIMALS: WarlordsAssetEntry[] = [
  { id: 'farm_llama', name: 'Llama', category: 'creature', r2Key: 'models/fauna/farm/Llama.fbx', layer: 'farm', targetSizeM: 1.55, tags: ['livestock', 'raise'] },
  { id: 'farm_pig', name: 'Pig', category: 'creature', r2Key: 'models/fauna/farm/Pig.fbx', layer: 'farm', targetSizeM: 0.85, tags: ['livestock', 'raise'] },
  { id: 'farm_sheep', name: 'Sheep', category: 'creature', r2Key: 'models/fauna/farm/Sheep.fbx', layer: 'farm', targetSizeM: 1.05, tags: ['livestock', 'raise'] },
];

// ── Ultimate Fantasy RTS buildings ───────────────────────────────────────────

const uf = (file: string, layer: WarlordsGameLayer, h: number, tags: string[]): WarlordsAssetEntry => ({
  id: catalogIdFromR2Key(`models/rts/ultimate-fantasy/fbx/${file}`),
  name: file.replace(/\.fbx$/i, ''),
  category: 'building',
  r2Key: `models/rts/ultimate-fantasy/fbx/${file}`,
  layer,
  targetSizeM: h,
  tags,
});

export const WARLORDS_RTS_BUILDINGS: WarlordsAssetEntry[] = [
  uf('Mine.fbx', 'mines', 5, ['quarry', 'miner']),
  uf('TownCenter_FirstAge_Level1.fbx', 'buildings_rts', 8, ['tc', 'hq']),
  uf('Barracks_FirstAge_Level1.fbx', 'buildings_rts', 5.5, ['barracks', 'melee']),
  uf('Archery_FirstAge_Level1.fbx', 'buildings_rts', 5.5, ['archery', 'ranged']),
  uf('Farm_FirstAge_Level1.fbx', 'farm', 3.5, ['farm']),
  uf('Farm_FirstAge_Level1_Wheat.fbx', 'farm', 2.2, ['wheat', 'crop']),
  uf('Farm_Dirt_Level1.fbx', 'farm', 0.4, ['dirt', 'plot']),
  uf('Temple_FirstAge_Level1.fbx', 'buildings_rts', 7, ['temple']),
  uf('Dock_FirstAge.fbx', 'buildings_rts', 3, ['dock', 'water']),
  uf('Port_FirstAge_Level1.fbx', 'buildings_rts', 5, ['port']),
  uf('Wall_FirstAge.fbx', 'buildings_rts', 3.5, ['wall']),
  uf('WatchTower_FirstAge_Level1.fbx', 'buildings_rts', 8, ['tower']),
  uf('Mountain_Single.fbx', 'mountains', 14, ['mountain']),
  uf('Mountain_Group_1.fbx', 'mountains', 18, ['mountain']),
  uf('MountainLarge_Single.fbx', 'mountains', 22, ['mountain']),
  uf('Resource_node_1.fbx', 'harvest', 2.2, ['resource']),
  uf('Resource_Tree1.fbx', 'nature', 6, ['tree', 'rts']),
  uf('Resource_Rock_1.fbx', 'nature', 2.2, ['rock', 'rts']),
];

// ── Craftpix mines + mountain cave ───────────────────────────────────────────

export const WARLORDS_MINES: WarlordsAssetEntry[] = [
  ...([1, 2, 3, 4] as const).map((n) => ({
    id: `mine_entrance_${n}`,
    name: `mine_${n}`,
    category: 'building' as const,
    r2Key: `models/buildings/mines/mine_${n}.fbx`,
    layer: 'mines' as const,
    targetSizeM: 4.5,
    tags: ['mine', 'craftpix', 'dig'],
  })),
  {
    id: 'mine_atlas',
    name: 'Texture_MAp_mines',
    category: 'texture',
    r2Key: 'models/buildings/mines/Texture_MAp_mines.png',
    layer: 'mines',
    tags: ['texture'],
  },
  {
    id: 'mountain_cave',
    name: 'rock_mountain_with_cave',
    category: 'terrain',
    r2Key: 'models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb',
    layer: 'mountains',
    targetSizeM: 22,
    tags: ['cave', 'mountain'],
  },
];

// ── Survival kit + note_of_arms ──────────────────────────────────────────────

export const WARLORDS_SURVIVAL: WarlordsAssetEntry[] = [
  {
    id: 'survival_kit',
    name: 'free_survival_asset_kit',
    category: 'prop',
    r2Key: 'models/survival/free_survival_asset_kit.glb',
    layer: 'survival',
    meshNames: ['tentHalf', 'tentClosed', 'tent', 'campfire', 'workbench', 'workbenchAnvil', 'workbenchGrind', 'fishingStand'],
    notes: 'Isolate node only',
    tags: ['camp', 'isolate'],
  },
];

export const WARLORDS_CHAIN: WarlordsAssetEntry[] = [
  {
    id: 'note_of_arms_v2',
    name: 'note_of_arms_v2',
    category: 'environment',
    r2Key: 'models/environment/note-of-arms/note_of_arms_v2.glb',
    layer: 'chain',
    meshNames: ['Chain_V1', 'Chain_V2', 'Chain_V3', 'Chain_V4', 'Chain_V5', 'Chain_V6', 'Chain_V7', 'Chain_V8'],
    targetSizeM: 1.0,
    notes: 'Isolate Chain_V* — anchor / build / harpoon trail',
    tags: ['chain', 'isolate', 'anchor', 'harpoon'],
  },
  {
    id: 'note_of_arms_legacy',
    name: 'note_of_arms_legacy',
    category: 'environment',
    r2Key: 'models/environment/note-of-arms/note_of_arms_environment_assets_set_1.glb',
    layer: 'chain',
    meshNames: ['Chain_V1', 'Chain_V2', 'Chain_V3', 'Chain_V4', 'Chain_V5', 'Chain_V6', 'Chain_V7', 'Chain_V8'],
    tags: ['chain', 'isolate', 'legacy'],
  },
];

// ── Master lists ─────────────────────────────────────────────────────────────

export const WARLORDS_ALL_ASSETS: WarlordsAssetEntry[] = [
  ...WARLORDS_CHARACTERS,
  ...WARLORDS_BATTLE_NATURE,
  ...WARLORDS_NATURE,
  ...WARLORDS_HARVEST,
  ...WARLORDS_FAUNA_LAND,
  ...WARLORDS_FAUNA_OCEAN,
  ...WARLORDS_SURFACE_LAYER,
  ...WARLORDS_FARM_ANIMALS,
  ...WARLORDS_RTS_BUILDINGS,
  ...WARLORDS_MINES,
  ...WARLORDS_SURVIVAL,
  ...WARLORDS_CHAIN,
];

export const WARLORDS_BY_ID: Record<string, WarlordsAssetEntry> = Object.fromEntries(
  WARLORDS_ALL_ASSETS.map((a) => [a.id, a]),
);

export const WARLORDS_BY_R2: Record<string, WarlordsAssetEntry> = Object.fromEntries(
  WARLORDS_ALL_ASSETS.map((a) => [a.r2Key, a]),
);

export function assetsForLayer(layer: WarlordsGameLayer): WarlordsAssetEntry[] {
  return WARLORDS_ALL_ASSETS.filter((a) => a.layer === layer);
}

export function resolveWarlordsUrl(r2KeyOrId: string): string {
  if (/^https?:\/\//i.test(r2KeyOrId)) return r2KeyOrId;
  const byId = WARLORDS_BY_ID[r2KeyOrId];
  if (byId) return cdnUrl(byId.r2Key);
  const key = r2KeyOrId.replace(/^\//, '');
  if (WARLORDS_BY_R2[key]) return cdnUrl(key);
  return cdnUrl(key);
}

/**
 * Home-island / production island layer contract (seed order).
 * Each step pulls assets from this catalog + engine terrain.
 */
export const HOME_ISLAND_SEED_LAYERS: Array<{
  layer: WarlordsGameLayer | 'terrain_engine' | 'water_engine';
  source: string;
  usage: string;
}> = [
  { layer: 'terrain_engine', source: 'islandHeightmapTerrain (seeded heightfield)', usage: 'Ground mesh + height samples' },
  { layer: 'water_engine', source: 'SeascapeOcean / open-water shader', usage: 'Sea surface y≈0' },
  { layer: 'nature', source: 'WARLORDS_BATTLE_NATURE (.glb) + WARLORDS_NATURE isolate', usage: 'Trees/rocks/grass scatter' },
  { layer: 'harvest', source: 'WARLORDS_HARVEST + resource nodes', usage: 'Ore/flowers/minerals dig' },
  { layer: 'mines', source: 'WARLORDS_MINES + UF Mine.fbx', usage: '≥2 craftpix mines + quarry' },
  { layer: 'mountains', source: 'WARLORDS_SURFACE_LAYER peaks + UF Mountain_*', usage: 'Event peaks + mountain decor' },
  { layer: 'farm', source: 'UF Farm + wheat + livestock FBX', usage: 'Raise Llama/Pig/Sheep' },
  { layer: 'buildings_rts', source: 'UF TC/Barracks/Archery/…', usage: 'RTS production' },
  { layer: 'survival', source: 'survival kit isolate', usage: 'Camp tent stages + benches' },
  { layer: 'characters', source: 'grudge6 race FBX', usage: 'Player captain' },
  { layer: 'fauna_land', source: 'WARLORDS_FAUNA_LAND (CreatureManifest CDN GLBs)', usage: 'Huntable land fauna per biome pool' },
  { layer: 'fauna_ocean', source: 'Quaternius FBX + creatures/fish/*.glb', usage: 'Open-water + pond fish' },
  { layer: 'water', source: 'pond_pack + seascape shader', usage: 'Ponds / shore water props' },
  { layer: 'chain', source: 'note_of_arms Chain_V*', usage: 'Anchor / build / harpoon trail' },
];

/**
 * Cross-repo SSOT map (do not invent parallel inventories):
 * - Biome animals/trees: GrudgeBuilder/shared/definitions/biomeHarvestAssets.ts
 * - Creature GLBs: GrudgeBuilder/client/src/island3d/creatures/CreatureManifest.ts
 * - Pipeline: GrudgeBuilder/docs/HOME_ISLAND_PIPELINE_CANONICAL.md
 * - This catalog: TI layer → CDN r2Key
 * - Forge palette: RTS-Grudge/studio/src/library/*
 */
