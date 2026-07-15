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
  exampleIsland: `${WARLORDS_CDN}/models/nature/stylized/concept/example_home_island.glb`,
  rocks: `${WARLORDS_CDN}/models/nature/stylized/rocks/stylised_rocks.glb`,
  volcanicRocks: `${WARLORDS_CDN}/models/nature/stylized/rocks/volcanic_rocks.glb`,
  cliff: `${WARLORDS_CDN}/models/nature/stylized/cliffs/stylized_cliff_face.glb`,
  flowers: `${WARLORDS_CDN}/models/nature/stylized/harvest/flowers_pack.glb`,
  foliage: `${WARLORDS_CDN}/models/nature/stylized/harvest/foliage_pack.glb`,
  minerals: `${WARLORDS_CDN}/models/nature/stylized/harvest/minerals_pack.glb`,
  oreNodes: `${WARLORDS_CDN}/models/nature/stylized/harvest/ore_nodes.glb`,
  pond: `${WARLORDS_CDN}/models/nature/stylized/harvest/pond_pack.glb`,
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
  stylizedRocks: [
    'Plain_Rock1', 'Plain_Rock2', 'Plain_Rock3', 'Plain_Rock4', 'Plain_Rock5',
    'Plain_Rock6', 'Plain_Rock7', 'Plain_Rock8', 'Plain_Rock9', 'Plain_Rock10',
    'Plain_Rock11', 'Plain_Rock12', 'Plain_Rock13', 'Plain_Rock14', 'Plain_Rock15',
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
