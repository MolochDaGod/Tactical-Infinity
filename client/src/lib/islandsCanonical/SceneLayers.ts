/**
 * SceneLayers — canonical layer hierarchy for the /islands pipeline.
 *
 * Every island scene now declares a fixed set of named THREE.Groups so
 * code that adds objects (or wants to toggle visibility, raycast against
 * a subset, or apply post-processing) has a single source of truth. The
 * order below is the *render order* and also the conceptual stack:
 *
 *   ┌─ POST_PROCESS   (screen-space passes — owned by the EffectComposer)
 *   ├─ EFFECTS        (3D VFX: weather particles, splashes, sparkles)
 *   ├─ NODES          (harvest ore deposits, fishing spots, interactables)
 *   ├─ ITEMS          (drops, pickups, chests)
 *   ├─ BUILDINGS      (docks, ruins, camps)
 *   ├─ NPC            (non-player AI characters)
 *   ├─ PLAYER         (the local controlled character)
 *   ├─ ANIMAL         (wandering wildlife — herd-style)
 *   ├─ ROCK           (scattered boulders / stone formations)
 *   ├─ VEGETATION     (trees / plants / flowers — sub-grouped)
 *   ├─ WATER          (ocean, lakes, splashes)
 *   ├─ GROUND         (terrain chunks)
 *   └─ SKY            (sky dome, sun, atmospheric backdrops)
 *
 * Three.js draws Groups bottom-up by add-order so we add them in the
 * reverse of the visual stack: sky first (drawn behind), post-process
 * passes are NOT scene objects (they're applied by the composer).
 *
 * Each layer also gets a `THREE.Layers` channel so raycasters and
 * cameras can mask in/out a whole category at once
 * (`raycaster.layers.enable(SceneLayer.ROCK)`).
 */
import * as THREE from 'three';

/** Numeric `THREE.Layers` channel per category (0 is reserved default). */
export enum SceneLayer {
  DEFAULT = 0,
  SKY = 1,
  GROUND = 2,
  WATER = 3,
  VEGETATION = 4,
  ROCK = 5,
  ANIMAL = 6,
  PLAYER = 7,
  NPC = 8,
  BUILDING = 9,
  ITEM = 10,
  NODE = 11,
  EFFECT = 12,
  POST_PROCESS = 13,
}

export interface SceneLayerSet {
  /** Root container parented to the THREE.Scene. */
  root: THREE.Group;
  sky: THREE.Group;
  ground: THREE.Group;
  water: THREE.Group;
  vegetation: THREE.Group;
  /** Sub-buckets under vegetation so trees / plants / flowers can be toggled independently. */
  trees: THREE.Group;
  plants: THREE.Group;
  flowers: THREE.Group;
  rock: THREE.Group;
  animal: THREE.Group;
  player: THREE.Group;
  npc: THREE.Group;
  building: THREE.Group;
  item: THREE.Group;
  node: THREE.Group;
  effect: THREE.Group;
  /**
   * Set visibility for any layer by name. Useful for debug overlays / a
   * "show only X" toggle in the Islands debug HUD.
   */
  setVisible(layer: keyof SceneLayerSet, visible: boolean): void;
  /** Assign every Object3D under a layer to its THREE.Layers channel. */
  applyLayerChannels(): void;
  /** Walk all groups and dispose materials/geometries; safe for partial setups. */
  dispose(): void;
}

function makeGroup(name: string, channel: SceneLayer): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.layers.set(channel);
  return g;
}

export function createSceneLayers(parent: THREE.Scene, namespace = 'IslandScene'): SceneLayerSet {
  const root = new THREE.Group();
  root.name = `${namespace}:root`;
  parent.add(root);

  // Add in *render-back-to-front* order so transparent passes (effects,
  // water foam) render after opaque geometry.
  const sky        = makeGroup(`${namespace}:sky`,        SceneLayer.SKY);
  const ground     = makeGroup(`${namespace}:ground`,     SceneLayer.GROUND);
  const water      = makeGroup(`${namespace}:water`,      SceneLayer.WATER);

  const vegetation = makeGroup(`${namespace}:vegetation`, SceneLayer.VEGETATION);
  const trees      = makeGroup(`${namespace}:vegetation/trees`,   SceneLayer.VEGETATION);
  const plants     = makeGroup(`${namespace}:vegetation/plants`,  SceneLayer.VEGETATION);
  const flowers    = makeGroup(`${namespace}:vegetation/flowers`, SceneLayer.VEGETATION);
  vegetation.add(trees, plants, flowers);

  const rock      = makeGroup(`${namespace}:rock`,     SceneLayer.ROCK);
  const animal    = makeGroup(`${namespace}:animal`,   SceneLayer.ANIMAL);
  const player    = makeGroup(`${namespace}:player`,   SceneLayer.PLAYER);
  const npc       = makeGroup(`${namespace}:npc`,      SceneLayer.NPC);
  const building  = makeGroup(`${namespace}:building`, SceneLayer.BUILDING);
  const item      = makeGroup(`${namespace}:item`,     SceneLayer.ITEM);
  const node      = makeGroup(`${namespace}:node`,     SceneLayer.NODE);
  const effect    = makeGroup(`${namespace}:effect`,   SceneLayer.EFFECT);

  root.add(sky, ground, water, vegetation, rock, animal, player, npc, building, item, node, effect);

  function setVisible(layer: keyof SceneLayerSet, visible: boolean) {
    const g = (set as unknown as Record<string, unknown>)[layer];
    if (g instanceof THREE.Group) g.visible = visible;
  }

  function applyLayerChannels() {
    const walk = (group: THREE.Group, channel: SceneLayer) => {
      group.traverse((c) => c.layers.set(channel));
    };
    walk(sky, SceneLayer.SKY);
    walk(ground, SceneLayer.GROUND);
    walk(water, SceneLayer.WATER);
    walk(trees, SceneLayer.VEGETATION);
    walk(plants, SceneLayer.VEGETATION);
    walk(flowers, SceneLayer.VEGETATION);
    walk(rock, SceneLayer.ROCK);
    walk(animal, SceneLayer.ANIMAL);
    walk(player, SceneLayer.PLAYER);
    walk(npc, SceneLayer.NPC);
    walk(building, SceneLayer.BUILDING);
    walk(item, SceneLayer.ITEM);
    walk(node, SceneLayer.NODE);
    walk(effect, SceneLayer.EFFECT);
  }

  function dispose() {
    // Detach from parent and let GC reclaim — owning subsystems (sky, ocean,
    // chunks, scatter) dispose their own GPU resources via their own
    // `.dispose()` hooks. We only clear the hierarchy here.
    parent.remove(root);
    root.clear();
  }

  const set: SceneLayerSet = {
    root, sky, ground, water,
    vegetation, trees, plants, flowers,
    rock, animal, player, npc, building, item, node, effect,
    setVisible, applyLayerChannels, dispose,
  };
  return set;
}

/**
 * Tiny seeded RNG (mulberry32) — every scatter pass uses one so two builds
 * with the same seed produce visually identical islands.
 */
export function mulberry32(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
