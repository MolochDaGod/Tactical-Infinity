/**
 * sanctuaryIsle/types.ts
 *
 * Type definitions for every Sanctuary-Isle data layer that hangs off the
 * single terrain mesh. Each layer is a plain typed array — the rendering and
 * gameplay systems consume these registries; the layers themselves do not own
 * Three.js objects (with the obvious exception of `terrain.mesh`).
 *
 * The single source of truth for ground height is `terrain.heightmap.getHeightAt(x,z)`.
 * The single source of truth for raycasts is `terrain.picker` (BVH-backed).
 */

import type * as THREE from 'three';
import type { IslandHeightmap } from '@/lib/islandsCanonical/IslandHeightmap';
import type { TerrainPicker } from '@/lib/terrain/raycast';

export type Faction = 'crusade' | 'fabled' | 'legion' | 'pirates' | 'neutral';

export type Vec3 = [number, number, number];

// ── Generic node shape every registry derives from ──────────────────────────

export interface BaseNode {
  id: string;
  pos: Vec3;
  /** Optional yaw in radians around Y. */
  yawRad?: number;
  /** Whether the node is currently active in the world. */
  active: boolean;
}

// ── Visual / world layers ───────────────────────────────────────────────────

export interface SanctuaryTerrainLayer {
  /** The single terrain mesh covering seabed → mountain peak. */
  mesh:        THREE.Mesh;
  /** Pure-data heightmap behind the mesh. */
  heightmap:   IslandHeightmap;
  /** BVH-backed picker bound to this single mesh. */
  picker:      TerrainPicker;
  /** Material reference, exposed so wind/lighting layers can re-tune at runtime. */
  material:    THREE.ShaderMaterial;
  /** Sea-level Y (always 0 in our world; here for clarity at call sites). */
  seaLevelY:   number;
}

export interface WindLayer {
  /** Direction the wind is blowing toward, normalised in XZ. */
  direction:   { x: number; z: number };
  /** 0..1 wind speed scalar consumed by the grass shader. */
  strength:    number;
  /** Hz of the gust modulation. */
  gustHz:      number;
}

export interface LightingLayer {
  hemi:        THREE.HemisphereLight;
  sun:         THREE.DirectionalLight;
  /** Optional rim light. */
  rim?:        THREE.DirectionalLight;
}

// ── Resource / scenery node layers ──────────────────────────────────────────

export type TreeKind   = 'oak' | 'pine' | 'palm' | 'birch' | 'mossy';
export type PlantKind  = 'fern' | 'flower_field' | 'reed' | 'mushroom_ring';
export type OreKind    = 'iron_vein' | 'gold_vein' | 'crystal_vein' | 'mossy_stone' | 'mana_font';
export type RockKind   = 'boulder' | 'standing_stone' | 'cairn';

export interface TreeNode    extends BaseNode { kind: TreeKind;  scale?: number; }
export interface PlantNode   extends BaseNode { kind: PlantKind; radius?: number; }
export interface OreNode     extends BaseNode { kind: OreKind;   respawnSec: number; }
export interface RockNode    extends BaseNode { kind: RockKind;  scale?: number; destructible?: boolean; hp?: number; }
export interface CliffMarker extends BaseNode { length: number; height: number; }
export interface CaveNode    extends BaseNode { depth: number; lootTable?: string; }
export interface DungeonNode extends BaseNode { tier: 1 | 2 | 3 | 4 | 5; bossId?: string; }

// ── Living-creature node layers ─────────────────────────────────────────────

export type AnimalKind        = 'rabbit' | 'deer' | 'fox' | 'crab' | 'seagull';
export type LandPredatorKind  = 'wolf' | 'bear' | 'wild_boar' | 'spider';
export type WaterPredatorKind = 'shark' | 'eel' | 'sea_serpent';
export type FishKind          = 'clownfish' | 'tuna' | 'koi' | 'angler' | 'lionfish' | 'piranha';
export type CoralKind         = 'brain_coral' | 'fan_coral' | 'kelp_forest';
export type BossKind          = 'sea_serpent_alpha' | 'forest_warden' | 'pirate_king' | 'undead_lord';

export interface AnimalNode        extends BaseNode { kind: AnimalKind;        roamRadius: number; level: number; }
export interface LandPredatorNode  extends BaseNode { kind: LandPredatorKind;  roamRadius: number; level: number; faction: Faction; aggroRadius: number; }
export interface WaterPredatorNode extends BaseNode { kind: WaterPredatorKind; roamRadius: number; level: number; aggroRadius: number; }
export interface FishNode          extends BaseNode { kind: FishKind;          schoolSize: number; }
export interface CoralNode         extends BaseNode { kind: CoralKind;         radius: number; }
export interface BossNode          extends BaseNode { kind: BossKind;          tier: 1 | 2 | 3 | 4 | 5; faction: Faction; arenaRadius: number; }

// ── NPC / faction camp layers ───────────────────────────────────────────────

export type NpcKind = 'innkeeper' | 'shipwright' | 'merchant' | 'priestess'
                    | 'questgiver' | 'guard' | 'wandering_scholar' | 'blacksmith';

export interface NpcNode    extends BaseNode { kind: NpcKind; faction: Faction; dialogue?: string; }
export interface AllyNode   extends BaseNode { faction: Exclude<Faction, 'pirates'>; race: string; class: string; level: number; }
export interface CampNode   extends BaseNode { faction: Faction; size: 'small' | 'medium' | 'large'; garrison: number; }

// ── Event / reward / treasure layers ────────────────────────────────────────

export type EventKind = 'ambush' | 'shrine_blessing' | 'random_encounter'
                      | 'merchant_caravan' | 'meteor_shower' | 'tide_event';

export interface EventNode    extends BaseNode { kind: EventKind; triggerRadius: number; cooldownSec: number; }
export interface RewardNode   extends BaseNode { kind: 'cache' | 'rune' | 'relic'; rarity: 1 | 2 | 3 | 4 | 5; }
export interface TreasureNode extends BaseNode { goldMin: number; goldMax: number; rarity: 1 | 2 | 3 | 4 | 5; locked?: boolean; }

// ── Player / VFX / impact layers ────────────────────────────────────────────

export interface PlayerSpawnLayer {
  primary:   Vec3;
  fallback:  Vec3;
  /** Yaw the player is facing on spawn. */
  facingRad: number;
}

export interface VfxNode    extends BaseNode { kind: 'fountain' | 'firefly_swarm' | 'godrays' | 'mist' | 'lantern' | 'glyph_circle'; radius: number; }
export interface ImpactNode extends BaseNode { kind: 'crater' | 'scorch' | 'shipwreck'; radius: number; }

// ── Functional layers (no visual) ───────────────────────────────────────────

export interface PathfindingLayer {
  /** Walkable mask sampled on the heightmap grid. true = walkable, false = blocked. */
  walkable:    Uint8Array;
  /** Resolution of the walkable grid (matches heightmap.resolution). */
  resolution:  number;
  /** Slope above which terrain is considered un-walkable, in radians. */
  maxSlopeRad: number;
}

export interface CollisionLayer {
  /** Reference to the BVH-bearing terrain mesh (the only mesh we have). */
  terrainMesh:  THREE.Mesh;
  /** Static colliders (rocks, cliff segments, destructibles). */
  staticBodies: { id: string; pos: Vec3; radius: number; height: number }[];
}

export interface DestructibleLayer {
  /** Subset of rocks/props that have HP and can be broken. */
  entries: { id: string; pos: Vec3; hp: number; lootTable?: string }[];
}

// ── Top-level Sanctuary Isle aggregate ──────────────────────────────────────

export interface SanctuaryIsle {
  id:           string;
  label:        string;
  /** The one and only world group this builder owns — add to scene, dispose to tear down. */
  group:        THREE.Group;

  // Visual / world
  terrain:      SanctuaryTerrainLayer;
  wind:         WindLayer;
  lighting:     LightingLayer;

  // Per-frame update for shader uniforms (wind, time).
  update:       (deltaSec: number, totalSec: number) => void;

  // Functional
  pathfinding:  PathfindingLayer;
  collision:    CollisionLayer;
  destructible: DestructibleLayer;

  // Player
  player:       PlayerSpawnLayer;

  // Node registries (keyed by the strict layer list the user requested).
  nodes: {
    trees:           TreeNode[];
    plants:          PlantNode[];
    ores:            OreNode[];
    rocks:           RockNode[];
    cliffs:          CliffMarker[];
    caves:           CaveNode[];
    dungeons:        DungeonNode[];

    animals:         AnimalNode[];
    landPredators:   LandPredatorNode[];
    waterPredators:  WaterPredatorNode[];
    fish:            FishNode[];
    seacoral:        CoralNode[];
    bosses:          BossNode[];

    npcs:            NpcNode[];
    allies:          AllyNode[];
    crusadeCamps:    CampNode[];
    fabledCamps:     CampNode[];
    legionCamps:     CampNode[];
    pirateCamps:     CampNode[];

    events:          EventNode[];
    rewards:         RewardNode[];
    treasures:       TreasureNode[];

    vfx:             VfxNode[];
    impacts:         ImpactNode[];
  };

  /** Releases GPU resources and detaches the BVH. */
  dispose:      () => void;
}
