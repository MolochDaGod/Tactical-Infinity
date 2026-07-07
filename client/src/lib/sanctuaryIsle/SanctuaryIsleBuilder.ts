/**
 * sanctuaryIsle/SanctuaryIsleBuilder.ts
 *
 * Top-level orchestrator. Builds the entire Sanctuary Isle as a single mesh
 * (one terrain layer) with every other system mounted as data registries.
 *
 *   const sanctuary = buildSanctuaryIsle(scene);
 *   sanctuary.update(dt, t);                          // per-frame
 *   sanctuary.terrain.picker.pickFromMouse(ev, cam, canvas); // raycast
 *   sanctuary.terrain.heightmap.getHeightAt(x, z);     // foot-on-ground
 *   sanctuary.nodes.bosses[0];                         // any data layer
 *   sanctuary.dispose();                               // tears down GPU + BVH
 */

import * as THREE from 'three';
import { buildSanctuaryTerrain, type SanctuaryTerrainOptions } from './SanctuaryTerrain';
import {
  buildAllLayers, buildPathfindingLayer, buildPlayerSpawn,
} from './SanctuaryLayers';
import type {
  CollisionLayer, DestructibleLayer, LightingLayer, SanctuaryIsle, WindLayer,
} from './types';

export interface SanctuaryIsleOptions {
  id:        string;
  label:     string;
  seed:      number;
  /** Effective gameplay radius — used to clamp spawners. */
  radius:    number;
  /** Terrain overrides. Defaults to a hub-sized round island. */
  terrain:   Partial<SanctuaryTerrainOptions>;
  /** Add the existing scene's lights (caller-managed) instead of building new ones. */
  lights?:   { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; rim?: THREE.DirectionalLight };
}

export const DEFAULT_SANCTUARY_OPTIONS: SanctuaryIsleOptions = {
  id:     'sanctuary_isle',
  label:  'Sanctuary Isle',
  seed:   0x5ACC1A,
  radius: 96,
  terrain: { worldSize: 256, segments: 192 },
};

/**
 * Compose the whole island.
 *
 * The caller supplies the scene/group attachment point. We return a single
 * `THREE.Group` containing the one terrain mesh — gameplay systems read the
 * node registries to spawn their own representations (NPCs, mobs, etc).
 */
export function buildSanctuaryIsle(
  partial: Partial<SanctuaryIsleOptions> = {},
): SanctuaryIsle {
  const opts: SanctuaryIsleOptions = { ...DEFAULT_SANCTUARY_OPTIONS, ...partial };

  // ── 1. Terrain (one mesh) ─────────────────────────────────────────────────
  const terrain = buildSanctuaryTerrain({
    ...opts.terrain,
    heightmap: { ...opts.terrain.heightmap, seed: opts.seed },
  });

  const group = new THREE.Group();
  group.name  = `sanctuary-isle-${opts.id}`;
  group.add(terrain.mesh);

  // ── 2. Lighting (reuse caller's lights if provided, else build sensible defaults) ─
  let lighting: LightingLayer;
  if (opts.lights) {
    lighting = { hemi: opts.lights.hemi, sun: opts.lights.sun, rim: opts.lights.rim };
  } else {
    const hemi = new THREE.HemisphereLight(0x9bc8e6, 0x4a6030, 0.65);
    const sun  = new THREE.DirectionalLight(0xffd28a, 2.2);
    sun.position.set(80, 160, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;   sun.shadow.camera.bottom = -100;
    sun.shadow.bias = -0.0003;
    const rim  = new THREE.DirectionalLight(0xaad4ff, 0.4);
    rim.position.set(-50, 80, -80);
    group.add(hemi, sun, rim);
    lighting = { hemi, sun, rim };
  }

  // ── 3. Wind (data only — drives the terrain shader and any future grass) ─
  const wind: WindLayer = { direction: { x: 1, z: 0.3 }, strength: 0.4, gustHz: 0.6 };
  terrain.matCtl.setWind(wind.direction.x, wind.direction.z, wind.strength, wind.gustHz);

  // ── 4. All node registries (deterministic by seed) ────────────────────────
  const nodes = buildAllLayers(opts.seed, terrain.heightmap, opts.radius);

  // ── 5. Functional layers built off the node data ──────────────────────────
  const pathfinding = buildPathfindingLayer(terrain.heightmap);
  const collision: CollisionLayer = {
    terrainMesh: terrain.mesh,
    staticBodies: nodes.rocks.map(r => ({
      id:     r.id,
      pos:    r.pos,
      radius: 0.6 * (r.scale ?? 1),
      height: 1.2 * (r.scale ?? 1),
    })),
  };
  const destructible: DestructibleLayer = {
    entries: nodes.rocks
      .filter(r => r.destructible && r.hp != null)
      .map(r => ({ id: r.id, pos: r.pos, hp: r.hp! })),
  };

  const player = buildPlayerSpawn(terrain.heightmap);

  // ── 6. Per-frame update — only the terrain shader needs ticking. ──────────
  function update(_dt: number, totalSec: number) {
    terrain.matCtl.setTime(totalSec);
  }

  function dispose() {
    group.remove(terrain.mesh);
    if (lighting && !opts.lights) {
      group.remove(lighting.hemi, lighting.sun);
      if (lighting.rim) group.remove(lighting.rim);
    }
    terrain.dispose();
  }

  return {
    id:        opts.id,
    label:     opts.label,
    group,
    terrain,
    wind,
    lighting,
    update,
    pathfinding,
    collision,
    destructible,
    player,
    nodes,
    dispose,
  };
}
