/**
 * Warlords-era nature packs — CDN SSOT (D1/R2).
 * Mirrors grudge-studio-games StylizedNatureCDN + skill grudge-warlords-assets.
 *
 * HARD RULE: multi-mesh packs are NEVER placed whole. Always isolate meshName.
 * Never use Meshy characters or primitive ore/tree stand-ins when these packs load.
 */

export const WARLORDS_CDN = 'https://assets.grudge-studio.com';

export const STYLIZED = {
  snow: `${WARLORDS_CDN}/models/nature/stylized/biome/snowbiomes.glb`,
  volcanic: `${WARLORDS_CDN}/models/nature/stylized/biome/volcanicnature.glb`,
  tropical: `${WARLORDS_CDN}/models/nature/stylized/biome/tropical_plants.glb`,
  plainsTrees: `${WARLORDS_CDN}/models/nature/stylized/biome/realistic_trees.glb`,
  vegetation: `${WARLORDS_CDN}/models/nature/stylized/biome/nature_vegetation.glb`,
  /** Redwood multipack — isolate Wood/Branch pairs, scatter 4–8 m tall */
  redwoods: `${WARLORDS_CDN}/models/nature/stylized/biome/stylised_redwood_trees.glb`,
  exampleIsland: `${WARLORDS_CDN}/models/nature/stylized/concept/example_home_island.glb`,
  rocks: `${WARLORDS_CDN}/models/nature/stylized/rocks/stylised_rocks.glb`,
  /** Compact 70-rock pack — dig/mine debris pebbles (Object_2…Object_71) */
  rocks70: `${WARLORDS_CDN}/models/nature/stylized/rocks/70_stylized_rocks.glb`,
  volcanicRocks: `${WARLORDS_CDN}/models/nature/stylized/rocks/volcanic_rocks.glb`,
  cliff: `${WARLORDS_CDN}/models/nature/stylized/cliffs/stylized_cliff_face.glb`,
  flowers: `${WARLORDS_CDN}/models/nature/stylized/harvest/flowers_pack.glb`,
  foliage: `${WARLORDS_CDN}/models/nature/stylized/harvest/foliage_pack.glb`,
  /** Green-area plant multipack (Object_2…Object_17) */
  plants: `${WARLORDS_CDN}/models/nature/stylized/harvest/plants_asset_set.glb`,
  /** Florida ferns / palm plants / understory */
  floridaFoliage: `${WARLORDS_CDN}/models/nature/stylized/harvest/florida_foliage.glb`,
  /** Ivy leaf generation — tree regrow canopy + moss creep on rocks */
  leafGeneration: `${WARLORDS_CDN}/models/nature/stylized/harvest/plant_generation_only_leaves.glb`,
  /** House-in-the-woods rocks + grass/bush planes (isolate meshName). */
  woodsRocksFoliage: `${WARLORDS_CDN}/models/nature/stylized/harvest/rocks_and_foliage_woods.glb`,
  minerals: `${WARLORDS_CDN}/models/nature/stylized/harvest/minerals_pack.glb`,
  oreNodes: `${WARLORDS_CDN}/models/nature/stylized/harvest/ore_nodes.glb`,
  pond: `${WARLORDS_CDN}/models/nature/stylized/harvest/pond_pack.glb`,
  // Fleet island shells
  tropicalIsland: `${WARLORDS_CDN}/models/islands/shells/tropical_island.glb`,
  lowPolyIsland: `${WARLORDS_CDN}/models/islands/shells/low_poly_island.glb`,
  islandsPack: `${WARLORDS_CDN}/models/islands/shells/islands_pack.glb`,
  chickenGunIslands: `${WARLORDS_CDN}/models/islands/shells/chicken_gun_islands.glb`,
  pirateTavern: `${WARLORDS_CDN}/models/islands/landmarks/shallowstead_pirate_tavern.glb`,
  // Underwater / nature expansion
  alienPlants: `${WARLORDS_CDN}/models/nature/stylized/underwater/alien_plants_kit.glb`,
  natureVol1: `${WARLORDS_CDN}/models/nature/stylized/biome/stylized_nature_pack_vol1.glb`,
  gamereadyIvy: `${WARLORDS_CDN}/models/nature/stylized/harvest/gameready_ivy.glb`,
  asiaticLily: `${WARLORDS_CDN}/models/nature/stylized/harvest/asiatic_lily.glb`,
  mountainCave: `${WARLORDS_CDN}/models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb`,
  smeltery: `${WARLORDS_CDN}/models/buildings/smeltery/stylized_smeltery_setup.glb`,
  /** LOTR-style elven treehouse — Fabled islands + dark-elf events */
  elvenTreehouse: `${WARLORDS_CDN}/models/buildings/elven/elven_treehouse.glb`,
  /** A'Tuin turtle event + disc islands (rise from water) */
  turtleEvent: `${WARLORDS_CDN}/models/events/turtle/turtle_event.glb`,
  arena3: `${WARLORDS_CDN}/models/events/arena/arena3.glb`,
} as const;

export const STYLIZED_VARIANTS = {
  snowTrees: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'],
  tropicalPalms: [
    'SM_MZRa_Palm_B081', 'SM_MZRa_Palm_B082', 'SM_MZRa_Palm_B083',
  ],
  tropicalPlants: [
    'SM_MZRa_Banana_B091', 'SM_MZRa_Banana_B092',
    'SM_MZRa_Fern_B051', 'SM_MZRa_Fern_B052', 'SM_MZRa_Fern_B053',
  ],
  plainsTrees: ['Tree_Bark_0', 'Tree_Bark.001_1'],
  vegetationTrees: [
    'Tree_Big_a_LOD0_17', 'Tree_Big_b_LOD0_13', 'Tree_Big_c_LOD0_16',
    'Tree_Small_a_LOD0_12', 'Tree_Small_b_LOD0_15', 'Tree_Small_c_LOD0_5',
    'Tree_Small_d_LOD0_4', 'Pine_Big_LOD0_7', 'Pine_Medium_LOD0_6',
    'Pine_Small_LOD0_9', 'Conifer_LOD0_8',
  ],
  vegetationPines: [
    'Pine_Big_LOD0_7', 'Pine_Medium_LOD0_6', 'Pine_Small_LOD0_9', 'Conifer_LOD0_8',
  ],
  vegetationRocks: [
    'Stone_Small_b_LOD0_22', 'Bush_a_20', 'Bush_b_10', 'Bush_c_11',
  ],
  /** Dig/mine debris isolations from 70_stylized_rocks.glb */
  rocks70Chunks: Array.from({ length: 24 }, (_, i) => `Object_${i + 2}`),
  /** Redwood Wood meshes (pair with TreeBranch of same tree id); height 4–8 m */
  redwoodWoods: [
    'TreePackDisplayScene_TreeBig001:Wood_0',
    'TreePackDisplayScene_TreeBig002:Wood_0',
    'TreePackDisplayScene_TreeBig003:Wood_0',
    'TreePackDisplayScene_TreeMedium001:Wood_0',
    'TreePackDisplayScene_TreeMedium002:Wood_0',
    'TreePackDisplayScene_TreeMedium003:Wood_0',
    'TreePackDisplayScene_TreeMedium004:Wood_0',
    'TreePackDisplayScene_TreeSmall001:Wood_0',
  ],
  /** plants_asset_set green scatter */
  greenPlants: Array.from({ length: 16 }, (_, i) => `Object_${i + 2}`),
  floridaFoliage: [
    'fern_3', 'fern1_5', 'leaves02_7', 'palm_plant03_13', 'trunk01_10', 'trunk03_15',
  ],
  /** Leaf regrow stages (sample of 288 ivy meshes) */
  leafRegrow: Array.from({ length: 32 }, (_, i) => `gwIvy001_mesh_2_${i}`),
  alienPlants: Array.from({ length: 11 }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return `Alien Plant_${n}_gameasset`;
  }),
  natureVol1Trees: ['Object_2', 'Object_3', 'Object_4', 'Object_5', 'Object_6'],
  gamereadyIvyCurves: [
    'IVY_Curve_2', 'IVY_Curve.001_4', 'IVY_Curve.002_6', 'IVY_Curve.003_8',
    'IvyLeaf_1', 'IvyLeaf.001_3', 'IvyLeaf.002_5', 'IvyLeaf.003_7',
  ],
  asiaticLily: ['GFAL01', 'GFAL04', 'GFAL05'],
  elvenTreehouse: ['Stairs_and_Treehouse', 'Tree'],
  /** islands_pack shell isolations */
  islandsPackMeshes: [
    'Island 1', 'Island 2', 'Island 3', 'Island 4', 'Island 5', 'Island 6',
  ],
  chickenGunIslandMeshes: [
    'island_base', 'island_small', 'island_tiny', 'island_sand_tiny', 'island_vulcano',
  ],
  chickenGunPalms: ['palm', 'palm_small', 'palm_round', 'palm_high', 'palm_angle'],
  /** Full plain set used for home / sector / harvest seeds (isolate one mesh). */
  stylizedRocks: [
    'Plain_Rock1', 'Plain_Rock2', 'Plain_Rock3', 'Plain_Rock4', 'Plain_Rock5',
    'Plain_Rock6', 'Plain_Rock7', 'Plain_Rock8', 'Plain_Rock9', 'Plain_Rock10',
    'Plain_Rock11', 'Plain_Rock12', 'Plain_Rock13', 'Plain_Rock14', 'Plain_Rock15',
    'Plain_Rock16', 'Plain_Rock17', 'Plain_Rock18', 'Plain_Rock19', 'Plain_Rock20',
    'Plain_Rock21', 'Plain_Rock22', 'Plain_Rock23', 'Plain_Rock24',
  ],
  mossyRocks: [
    'Mossy_Rock1', 'Mossy_Rock2', 'Mossy_Rock3', 'Mossy_Rock4', 'Mossy_Rock5',
    'Mossy_Rock6', 'Mossy_Rock7', 'Mossy_Rock8', 'Mossy_Rock9', 'Mossy_Rock10',
    'Mossy_Rock11', 'Mossy_Rock12', 'Mossy_Rock13', 'Mossy_Rock14', 'Mossy_Rock15',
    'Mossy_Rock16',
  ],
  snowyRocks: [
    'Snowy_Rock1', 'Snowy_Rock2', 'Snowy_Rock3', 'Snowy_Rock4', 'Snowy_Rock5',
    'Snowy_Rock6', 'Snowy_Rock7', 'Snowy_Rock8', 'Snowy_Rock9', 'Snowy_Rock10',
    'Snowy_Rock11', 'Snowy_Rock12',
  ],
  desertRocks: [
    'Desert_Rock1', 'Desert_Rock2', 'Desert_Rock3', 'Desert_Rock4', 'Desert_Rock5',
    'Desert_Rock6', 'Desert_Rock7', 'Desert_Rock8', 'Desert_Rock9', 'Desert_Rock10',
    'Desert_Rock11', 'Desert_Rock12',
  ],
  /** rocks_and_foliage_woods.glb boulder isolations */
  woodsRocks: [
    'Icosphere', 'Icosphere.001', 'Icosphere.002', 'Icosphere.003', 'Icosphere.004',
    'Icosphere.005', 'Icosphere.006', 'Icosphere.007', 'Icosphere.008',
    'Cube.001', 'Cube.002', 'Cube.003', 'Cube.005', 'Cube.008',
  ],
  woodsFoliage: [
    'grass', 'grass bush',
    'Plane.010', 'Plane.011', 'Plane.012', 'Plane.013', 'Plane.014',
    'Plane.015', 'Plane.016', 'Plane.017', 'Plane.018',
    'Plane.037', 'Plane.038', 'Plane.039', 'Plane.040',
  ],
  flowers: [
    'flower15', 'flower15.001', 'flower15.002',
    'Plane.001', 'Plane.012', 'Plane.013', 'Plane.019', 'Plane.021',
  ],
  foliage: [
    'TexturesCom_NaturePlants0032_1_masked_S',
    'TexturesCom_NaturePlants0072_1_masked_S',
    'TexturesCom_NaturePlants0033_9_M',
  ],
  minerals: [
    'crystal_basalt_green.007', 'crystal_basalt_green.008',
    'crystal_basalt_green.010', 'crystal_basalt_green.011',
    'crystal_basalt_green.013', 'crystal_basalt_green.014',
  ],
  oreNodes: [
    'Tin_Node', 'Slatinum_Node', 'Prytonite_Node', 'Iron_Node',
    'Gatnumite_Node', 'Copper_Node', 'Coal_Node',
    'Ore_Tin', 'Ore_Iron', 'Ore_Copper', 'Ore_Coal',
  ],
  exampleTrees: ['Tree1_171', 'Tree2_173', 'Trunk_174'],
  exampleRocks: ['Rock_9', 'Cliffs_2'],
} as const;

/** grudge6 race FBX — verified real on assets CDN (not toon_rts HTML fakes). */
export const GRUDGE6_RACE_FBX: Record<string, string> = {
  human: `${WARLORDS_CDN}/models/grudge6/races/WK_Characters.fbx`,
  barbarian: `${WARLORDS_CDN}/models/grudge6/races/BRB_Characters.fbx`,
  dwarf: `${WARLORDS_CDN}/models/grudge6/races/DWF_Characters.fbx`,
  elf: `${WARLORDS_CDN}/models/grudge6/races/ELF_Characters.fbx`,
  orc: `${WARLORDS_CDN}/models/grudge6/races/ORC_Characters.fbx`,
  undead: `${WARLORDS_CDN}/models/grudge6/races/UD_Characters.fbx`,
};

/**
 * Race body textures — high-quality webp atlases on R2 (grudge-assets bucket).
 * ~4–5 MB each, verified RIFF/webp after 2026-07-10 upload.
 * Cache-bust query clears any prior edge HTML fake-200 cache.
 */
export const GRUDGE6_TEX_REL: Record<string, string> = {
  human: '/textures/grudge6/western-kingdoms/WK_Standard_Units.webp',
  barbarian: '/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp',
  dwarf: '/textures/grudge6/dwarves/DWF_Standard_Units.webp',
  elf: '/textures/grudge6/elves/ELF_HighElves_Texture.webp',
  orc: '/textures/grudge6/orcs/ORC_StandardUnits.webp',
  undead: '/textures/grudge6/undead/UD_Standard_Units.webp',
};

/** CDN root for binary assets (R2 via grudge-asset-cdn worker). */
export const GRUDGE6_TEX_CDN = WARLORDS_CDN;
const TEX_CACHE_BUST = 'v=20260710r2';

export function grudge6TextureUrl(race: string): string {
  const rel = GRUDGE6_TEX_REL[race] || GRUDGE6_TEX_REL.human;
  return `${GRUDGE6_TEX_CDN}${rel}?${TEX_CACHE_BUST}`;
}
