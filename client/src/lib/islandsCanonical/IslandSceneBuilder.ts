/**
 * IslandSceneBuilder — high-level orchestrator for the canonical /islands
 * pipeline. Combines:
 *
 *   • IslandHeightmap          — pure-data noise/island shaping
 *   • IslandChunks             — N×N BufferGeometry chunks with LOD
 *   • IslandSky                — cloud + sun shader dome
 *   • DynamicOcean (existing)  — production water shader
 *   • IslandWeatherOverlayPass — screen-space rain + lightning
 *   • LandScatter              — trees/rocks/plants/animals
 *   • BiomeTerrainMaterial     — PBR splat-blended terrain
 *
 * Configuration is driven by the per-biome `IslandConfig` registry — the
 * old hardcoded constants are gone. The scene builder reads world size,
 * water depth, max height, and category-keyed asset lists from the config.
 */

import * as THREE from 'three';
import { generateIslandHeightmap, type IslandHeightmap } from './IslandHeightmap';
import { buildIslandChunks, type IslandChunkSet } from './IslandChunks';
import { IslandSky, type SkyWeather, type SkyTimeOfDay } from './IslandSky';
import { IslandWeatherOverlayPass } from './IslandWeatherOverlay';
import { SeascapeOcean } from './SeascapeOcean';
import { SeaCreatures } from './SeaCreatures';
import { findHarbours, type HarbourNode } from './IslandHarbours';
import { buildIslandHeatmap, type IslandHeatmap as IslandPathHeatmap } from './IslandHeatmap';
import { TerrainPicker } from '../terrain/raycast';
import { getIslandConfig, type IslandConfig } from './IslandConfig';
import { createBiomeTerrainMaterial, type BiomeTerrainMaterialResult } from './BiomeTerrainMaterial';
import { buildLandScatter, type LandScatterResult } from './LandScatter';
import { createSceneLayers, type SceneLayerSet } from './SceneLayers';
import { DayNightCycle, TOD_PROGRESS } from './DayNightCycle';

export type IslandBiomePreset = 'tropical' | 'temperate' | 'volcanic' | 'arctic' | 'desert';

/**
 * Per-biome ground-bounce colour for the ambient HemisphereLight. This is the
 * light that fills shadowed faces, so it should read like the dominant terrain
 * underfoot: lush green for tropical/temperate, ashen red for volcanic, cool
 * blue-white snow glare for arctic, warm sand for desert.
 */
const BIOME_GROUND_BOUNCE: Record<IslandBiomePreset, number> = {
  tropical:  0x2f4a22,
  temperate: 0x35402a,
  volcanic:  0x40231a,
  arctic:    0x8298b4,
  desert:    0x70583a,
};

interface BiomeStyle {
  weather: SkyWeather;
  timeOfDay: SkyTimeOfDay;
  ridgeMix: number;
  shape: 'round' | 'archipelago' | 'horseshoe' | 'volcanic_caldera';
}

const BIOME_STYLES: Record<IslandBiomePreset, BiomeStyle> = {
  tropical:  { weather: 'clear',  timeOfDay: 'noon', ridgeMix: 0.20, shape: 'round' },
  temperate: { weather: 'cloudy', timeOfDay: 'noon', ridgeMix: 0.40, shape: 'round' },
  volcanic:  { weather: 'storm',  timeOfDay: 'dusk', ridgeMix: 0.55, shape: 'volcanic_caldera' },
  arctic:    { weather: 'mist',   timeOfDay: 'dawn', ridgeMix: 0.60, shape: 'horseshoe' },
  desert:    { weather: 'clear',  timeOfDay: 'dusk', ridgeMix: 0.30, shape: 'archipelago' },
};

export interface IslandSceneOptions {
  biome: IslandBiomePreset;
  seed: number;
  /** Override worldSize/resolution from config (rarely needed). */
  worldSize?: number;
  resolution?: number;
  chunksPerSide?: number;
  weatherOverride?: SkyWeather;
  timeOfDayOverride?: SkyTimeOfDay;
  spawnCreatures?: boolean;
  buildHarbours?: boolean;
  harbourCandidates?: number;
  buildHeatmap?: boolean;
  heatmapResolution?: number;
  /** If false, skips land scatter (trees / rocks / plants / animals). */
  spawnLandFeatures?: boolean;
  /** If supplied, scatter avoids a circle of this world-space radius. */
  spawnPad?: { x: number; z: number; radius: number };
  /**
   * Continuous day/night clock (world-map style). When omitted, a cycle is
   * still created and pinned to `timeOfDayOverride` (or biome default).
   */
  dayCycle?: DayNightCycle;
  /** Real-time seconds per in-game day when auto-running. Default 480. */
  dayLengthSec?: number;
  /** Start with auto day/night advance. Default false (manual TOD pins). */
  autoDayNight?: boolean;
}

export interface IslandScene {
  group: THREE.Group;
  /** Canonical scene-layer hierarchy (ground/water/vegetation/rock/animal/npc/player/item/building/node/effect). */
  layers: SceneLayerSet;
  heightmap: IslandHeightmap;
  chunks: IslandChunkSet;
  sky: IslandSky;
  ocean: SeascapeOcean;
  creatures: SeaCreatures | null;
  weatherPass: IslandWeatherOverlayPass;
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
  picker: TerrainPicker;
  harbours: HarbourNode[];
  heatmap: IslandPathHeatmap | null;
  /** Per-biome configuration that drove this scene. */
  config: IslandConfig;
  /** Land scatter (trees / rocks / plants / animals). Resolves async. */
  landScatter: Promise<LandScatterResult | null>;
  /** Suggested player spawn point — flat, above-sea-level, away from water. */
  spawnPoint: THREE.Vector3;
  /** Continuous day/night clock (auto or manual). */
  dayCycle: DayNightCycle;
  update(camera: THREE.Camera, elapsedSec: number, dt: number): void;
  setWeather(w: SkyWeather): void;
  setTimeOfDay(t: SkyTimeOfDay): void;
  setDayProgress(p: number): void;
  setAutoDayNight(on: boolean): void;
  heightAt(x: number, z: number): number;
  dispose(): void;
}

/**
 * Find a flat, above-sea-level location on the terrain by scanning a sparse
 * grid for cells that pass altitude + slope thresholds. Falls back to the
 * island center elevated to a safe height if nothing matches (shouldn't
 * happen for any of our biomes).
 */
function findPlayerSpawn(hm: IslandHeightmap, world: number): THREE.Vector3 {
  const half = world * 0.35;
  const samples = 28;
  let best: { x: number; y: number; z: number; score: number } | null = null;
  // Comfortable walk band scales with larger map peaks (was hard-capped at 12 m).
  const maxSpawnY = Math.max(14, hm.bounds?.max ? Math.min(hm.bounds.max * 0.35, 28) : 18);
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const x = -half + (i / (samples - 1)) * 2 * half;
      const z = -half + (j / (samples - 1)) * 2 * half;
      const y = hm.getHeightAt(x, z);
      if (y < 2 || y > maxSpawnY) continue;
      const eps = 2;
      const slope = Math.hypot(
        (hm.getHeightAt(x + eps, z) - hm.getHeightAt(x - eps, z)) / (2 * eps),
        (hm.getHeightAt(x, z + eps) - hm.getHeightAt(x, z - eps)) / (2 * eps),
      );
      if (slope > 0.25) continue;
      // Prefer near-center, low-slope, comfortable elevation 2..6.
      const distC = Math.hypot(x, z);
      const score = -slope * 5 - Math.abs(y - 4) * 0.4 - distC * 0.005;
      if (!best || score > best.score) best = { x, y, z, score };
    }
  }
  if (best) return new THREE.Vector3(best.x, best.y, best.z);
  return new THREE.Vector3(0, hm.getHeightAt(0, 0) + 1, 0);
}

export function buildIslandScene(parent: THREE.Scene, options: IslandSceneOptions): IslandScene {
  const config = getIslandConfig(options.biome);
  const style = BIOME_STYLES[options.biome];
  const worldSize = options.worldSize ?? config.worldSize;
  const resolution = options.resolution ?? 256;
  const chunksPerSide = options.chunksPerSide ?? 4;

  const layers = createSceneLayers(parent, `IslandScene:${options.biome}:${options.seed}`);
  const group = layers.root;

  // 1. Heightmap (pure data) — water depth driven by config.
  const heightmap = generateIslandHeightmap({
    size: resolution,
    worldSize,
    seed: options.seed,
    maxHeight: config.maxHeight,
    minHeight: -(config.waterDepth + 2),
    ridgeMix: style.ridgeMix,
    shape: style.shape,
  });

  // 2. Sky + ocean uniforms + continuous day/night clock (world-map style).
  const initialTod = options.timeOfDayOverride ?? style.timeOfDay;
  const skyWeather = options.weatherOverride ?? style.weather;
  const dayCycle =
    options.dayCycle ??
    new DayNightCycle({
      startProgress: TOD_PROGRESS[initialTod],
      dayLengthSec: options.dayLengthSec ?? 480,
      auto: options.autoDayNight ?? false,
    });
  const sky = new IslandSky({
    weather: skyWeather,
    timeOfDay: initialTod,
    radius: Math.max(800, worldSize * 4),
  });
  // Continuous sun orbit sample (smooth day/night); weather still discrete.
  sky.setDaySample(dayCycle.sample());
  layers.sky.add(sky.mesh);

  const ocean = new SeascapeOcean({
    size: worldSize * 4,
    segments: 256,
    sunDirection: sky.sunDirection,
  });
  ocean.setSkyTint(sky.material.uniforms.uHorizon.value as THREE.Color);
  ocean.mesh.position.y = 0;
  layers.water.add(ocean.mesh);

  // Sea creatures — counts/species/sizes are now driven by `IslandConfig`,
  // not hardcoded. Each biome can dial its own population (e.g. volcanic has
  // few fish; tropical is busy).
  let creatures: SeaCreatures | null = null;
  if (options.spawnCreatures !== false) {
    creatures = new SeaCreatures({
      crabs:      config.seaCreatures.crabs,
      singles:    config.seaCreatures.singles,
      schools:    config.seaCreatures.schools,
      schoolSize: config.seaCreatures.schoolSize,
      squid:      config.seaCreatures.squid,
      whales:     config.seaCreatures.whales,
      spawnCenter: config.seaCreatures.spawnCenter,
      heightmap,
    });
    layers.water.add(creatures.group);
    void creatures.build(worldSize * 0.5);
  }

  // 3. PBR splat terrain material driven by per-biome PolyHaven packs.
  const biomeMat: BiomeTerrainMaterialResult = createBiomeTerrainMaterial(
    config,
    sky.sunDirection,
    sky.sunColor,
  );

  // 4. Chunks.
  const chunks = buildIslandChunks(heightmap, {
    chunksPerSide,
    material: biomeMat.material,
    computeNormals: true,
    buildBillboard: true,
  });
  layers.ground.add(chunks.group);

  // 5. Lights driven by the sky's sun.
  const sun = new THREE.DirectionalLight(sky.sunColor, sky.sunIntensity);
  sun.position.copy(sky.sunDirection).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const shadowExtent = Math.min(worldSize * 0.35, 400);
  sun.shadow.camera.left = -shadowExtent;
  sun.shadow.camera.right = shadowExtent;
  sun.shadow.camera.top = shadowExtent;
  sun.shadow.camera.bottom = -shadowExtent;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = worldSize * 3;
  sun.shadow.bias = -0.0005;
  group.add(sun);

  // Ambient is a hemisphere light whose SKY colour tracks the sun (warm at
  // dawn/dusk, neutral at noon, deep blue at night) and whose GROUND bounce is
  // tinted per-biome so shadowed faces pick up a believable colour cast
  // (green forest floor, red volcanic ash, cool arctic snow, sandy desert).
  const groundBounce = new THREE.Color(BIOME_GROUND_BOUNCE[options.biome] ?? 0x3a2e26);
  const ambient = new THREE.HemisphereLight(0xffffff, groundBounce, 1);
  // Reusable temporaries so the per-frame updater allocates nothing.
  const _skyTint = new THREE.Color();
  const _skyCool = new THREE.Color(0xbcd2ff);
  // Drives intensity + sky tint from the live sky so it matches time-of-day.
  const updateAmbient = () => {
    _skyTint.set(sky.sunColor).lerp(_skyCool, 0.45);
    ambient.color.copy(_skyTint);
    // Floor at 0.18 so even night keeps shapes readable; scale with the sun.
    ambient.intensity = 0.22 + sky.sunIntensity * 0.5;
  };
  updateAmbient();
  group.add(ambient);
  // Lights remain on the root (not a layer sub-group) so they illuminate
  // every layer uniformly — Three.js skips layer-checks for global lights.

  // A dim sky-blue fill from the anti-sun side lifts the terminator so the
  // unlit side of mountains doesn't crush to pure black under ACES tonemap.
  const fill = new THREE.DirectionalLight(0x9fb6d8, 0.18);
  fill.position.copy(sky.sunDirection).multiplyScalar(-200);
  group.add(fill);

  const baseFogDensity = 256 / worldSize * 0.0008;
  // Warmer grey-green fog tint (iq Msf3zX cloud palette ≈ vec3(0.70, 0.72, 0.70))
  // so the distance fog tonally matches the new mist post-process layer instead
  // of pulling the scene toward cool blue. Old colour: 0x9fb6c8.
  parent.fog = new THREE.FogExp2(0xb6c0b4, baseFogDensity * sky.fogStrength);

  // 7. Weather post-process pass.
  const weatherPass = new IslandWeatherOverlayPass();
  weatherPass.setWeather(sky.currentWeather);

  // 8. Terrain picker.
  const picker = new TerrainPicker([chunks.group]);

  // 9. Harbours.
  const harbours: HarbourNode[] = options.buildHarbours === false
    ? []
    : findHarbours({
        heightmap, worldSize,
        numCandidates: options.harbourCandidates ?? 12,
        namespace: `${options.biome}:${options.seed}`,
      });

  // 10. Pathfinding heatmap.
  const heatmap: IslandPathHeatmap | null = options.buildHeatmap === false
    ? null
    : buildIslandHeatmap({
        heightmap, worldSize,
        resolution: options.heatmapResolution ?? Math.min(128, resolution),
      });

  // 11. Player spawn — flat, above sea level, near island center if possible.
  const spawnPoint = findPlayerSpawn(heightmap, worldSize);
  const spawnPad = options.spawnPad ?? { x: spawnPoint.x, z: spawnPoint.z, radius: 4.5 };

  // 12. Land scatter (async — trees, rocks, plants, animals, ore nodes).
  // The scatter writes directly into the canonical layer sub-groups so a
  // late-resolving load still lands in the right bucket. A `disposed`
  // sentinel guards the race where `dispose()` runs before the promise
  // resolves — the scatter result is then disposed immediately instead of
  // being attached to a detached layer tree.
  let scatterRef: LandScatterResult | null = null;
  let disposed = false;
  const landScatter: Promise<LandScatterResult | null> = options.spawnLandFeatures === false
    ? Promise.resolve(null)
    : buildLandScatter({ heightmap, config, spawnPad, seed: options.seed, layers })
        .then((r) => {
          if (disposed) { r.dispose(); return null; }
          scatterRef = r;
          // Re-stamp layer channels so the freshly-added scatter children
          // pick up their canonical SceneLayer.* channel for camera/raycast
          // masking. Cheap enough (one traverse per layer) to run again.
          layers.applyLayerChannels();
          return r;
        })
        .catch((e) => {
          console.warn('[IslandSceneBuilder] LandScatter failed:',
            e instanceof Error ? `${e.message}\n${e.stack}` : e);
          return null;
        });

  // Initial channel stamp covers sky/ground/water/creatures added synchronously
  // above. Scatter re-stamps after its own async resolves.
  layers.applyLayerChannels();

  function update(camera: THREE.Camera, elapsedSec: number, dt: number) {
    // Continuous day/night (auto or pinned) drives sky + lights every frame.
    const sample = dayCycle.tick(dt);
    sky.setDaySample(sample);
    sky.update(elapsedSec, dt);
    ocean.update(elapsedSec, camera);
    chunks.updateLOD((camera as THREE.PerspectiveCamera).position);
    creatures?.update(elapsedSec);
    weatherPass.setTime(elapsedSec);
    weatherPass.setLightning(sky.material.uniforms.uLightning.value as number);
    sun.color.copy(sky.sunColor);
    sun.intensity = sky.sunIntensity;
    sun.position.copy(sky.sunDirection).multiplyScalar(120);
    // Night: dim shadows / ambient for readable moonsky.
    sun.castShadow = sample.nightFactor < 0.85;
    updateAmbient();
    fill.position.copy(sky.sunDirection).multiplyScalar(-200);
    biomeMat.setSun(sky.sunDirection, sky.sunColor);
    biomeMat.tick(elapsedSec);
    ocean.setSunPosition(sky.sunDirection);
    ocean.setSkyTint(sky.material.uniforms.uHorizon.value as THREE.Color);
    scatterRef?.update(dt, elapsedSec);
  }

  function setWeather(w: SkyWeather) {
    sky.setWeather(w);
    weatherPass.setWeather(w);
    const baseFogDensity = 256 / worldSize * 0.0008;
    if (parent.fog instanceof THREE.FogExp2) parent.fog.density = baseFogDensity * sky.fogStrength;
  }

  function setTimeOfDay(t: SkyTimeOfDay) {
    dayCycle.pinBand(t);
    sky.setDaySample(dayCycle.sample());
  }

  function setDayProgress(p: number) {
    dayCycle.setProgress(p);
    sky.setDaySample(dayCycle.sample());
  }

  function setAutoDayNight(on: boolean) {
    dayCycle.setAuto(on);
  }

  function heightAt(x: number, z: number): number {
    return heightmap.getHeightAt(x, z);
  }

  function dispose() {
    disposed = true;
    chunks.dispose();
    sky.dispose();
    ocean.dispose();
    creatures?.dispose();
    biomeMat.dispose();
    scatterRef?.dispose();
    layers.dispose();
    if (parent.fog) parent.fog = null;
  }

  return {
    group, layers, heightmap, chunks, sky, ocean, creatures, weatherPass, sun, ambient,
    picker, harbours, heatmap, config, landScatter, spawnPoint, dayCycle,
    update, setWeather, setTimeOfDay, setDayProgress, setAutoDayNight, heightAt, dispose,
  };
}
