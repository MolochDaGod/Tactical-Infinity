/**
 * sanctuaryIsle — single-mesh terrain + every game-system data layer.
 *
 * Public API:
 *   buildSanctuaryIsle(opts?) → SanctuaryIsle      // one-shot constructor
 *   SanctuaryIsle.terrain.picker                   // BVH raycaster
 *   SanctuaryIsle.terrain.heightmap.getHeightAt    // O(1) ground height
 *   SanctuaryIsle.nodes.{trees, ores, npcs, ...}   // every game-system layer
 *   SanctuaryIsle.update(dt, t) / .dispose()
 *
 * Layer inventory (matches the user's spec):
 *   visual:   seabed, ground, grass, shaders, wind, textures1, textures2,
 *             lighting, terrain raycast (BVH)
 *   pathfinding, collision, destructibles
 *   trees, plants, ores, rocks, cliffs, caves, dungeons
 *   animals, land predators, water predators, fish, sea coral, bosses
 *   npcs, allies, crusade/fabled/legion/pirate camps
 *   events, rewards, treasures, vfx, impacts, player spawn
 */

export { buildSanctuaryIsle, DEFAULT_SANCTUARY_OPTIONS } from './SanctuaryIsleBuilder';
export type { SanctuaryIsleOptions }                     from './SanctuaryIsleBuilder';
export { buildSanctuaryTerrain, DEFAULT_SANCTUARY_TERRAIN } from './SanctuaryTerrain';
export type { SanctuaryTerrainOptions }                  from './SanctuaryTerrain';
export {
  createSanctuaryTerrainMaterial,
  DEFAULT_SANCTUARY_MAT_OPTIONS,
} from './SanctuaryTerrainMaterial';
export {
  buildAllLayers, buildPathfindingLayer, buildPlayerSpawn,
} from './SanctuaryLayers';
export type {
  Faction, Vec3, BaseNode,
  SanctuaryIsle, SanctuaryTerrainLayer, WindLayer, LightingLayer,
  TreeNode, PlantNode, OreNode, RockNode, CliffMarker, CaveNode, DungeonNode,
  AnimalNode, LandPredatorNode, WaterPredatorNode, FishNode, CoralNode, BossNode,
  NpcNode, AllyNode, CampNode,
  EventNode, RewardNode, TreasureNode,
  PlayerSpawnLayer, VfxNode, ImpactNode,
  PathfindingLayer, CollisionLayer, DestructibleLayer,
  TreeKind, PlantKind, OreKind, RockKind,
  AnimalKind, LandPredatorKind, WaterPredatorKind, FishKind, CoralKind, BossKind,
  NpcKind, EventKind,
} from './types';
