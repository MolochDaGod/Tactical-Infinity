/**
 * islandsCanonical — single canonical island pipeline.
 *
 * This module is the source of truth for how Tethical builds its islands. It
 * supersedes the per-scene water / weather / terrain code that grew up
 * across `Islands.tsx`, `ProductionIsland.tsx`, `IslandBattlePage.tsx` and
 * `OpenWaterSailing.tsx`. New work should compose `buildIslandScene()`
 * instead of reaching for `terrainGenerator`, `weatherSystem` and
 * `oceanShader` directly.
 *
 * Pipeline:
 *   IslandHeightmap     — pure data heightmap (multi-octave Simplex + ridges)
 *   IslandChunks        — split into N×N BufferGeometry tiles with LOD
 *   IslandSky           — cloud-shader sky dome with weather + time-of-day
 *   IslandWeatherOverlay — screen-space rain + lightning (post-process)
 *   IslandSceneBuilder  — orchestrator (drop-in for /islands)
 */

export {
  generateIslandHeightmap,
  DEFAULT_HEIGHTMAP_OPTIONS,
  type IslandHeightmap,
  type IslandHeightmapOptions,
  type IslandShape,
} from './IslandHeightmap';

export {
  buildIslandChunks,
  type IslandChunk,
  type IslandChunkSet,
  type IslandChunkOptions,
} from './IslandChunks';

export {
  IslandSky,
  type SkyWeather,
  type SkyTimeOfDay,
  type IslandSkyOptions,
} from './IslandSky';

export {
  IslandWeatherOverlayPass,
} from './IslandWeatherOverlay';

export {
  SeascapeOcean,
  type SeascapeOceanOptions,
} from './SeascapeOcean';

export {
  SeaCreatures,
  CREATURE_BANDS,
  type SeaCreaturesOptions,
} from './SeaCreatures';

export {
  DEPTH_BANDS,
  DEPTH_BAND_ORDER,
  bandFor,
  randomYInBand,
  type DepthBand,
  type DepthBandSpec,
} from './depthBands';

export {
  findHarbours,
  type HarbourNode,
  type HarbourOptions,
} from './IslandHarbours';

export {
  buildWaterNodes,
  nodesByBand,
  type WaterNode,
  type WaterBand,
  type WaterNodeOptions,
} from './WaterNodes';

export {
  buildIslandHeatmap,
  type IslandHeatmap as IslandPathHeatmap,
  type IslandHeatmapOptions,
} from './IslandHeatmap';

export {
  buildIslandScene,
  type IslandSceneOptions,
  type IslandScene,
  type IslandBiomePreset,
} from './IslandSceneBuilder';

export {
  buildLandScatter,
  type LandScatterResult,
} from './LandScatter';

export {
  HarvestNodeSystem,
  type HarvestPlacement,
  type MineResult,
} from './HarvestNodeSystem';

export {
  TerrainEditor,
  type BrushMode,
  type BrushOptions,
} from './TerrainEditor';
