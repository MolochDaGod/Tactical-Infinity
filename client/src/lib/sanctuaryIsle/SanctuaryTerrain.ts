/**
 * sanctuaryIsle/SanctuaryTerrain.ts
 *
 * Builds the ONE mesh that is Sanctuary Isle. No chunks, no LOD, no GLTF.
 *
 *   1. Generate the heightmap with `generateIslandHeightmap`.
 *   2. Build a single PlaneGeometry sized to `worldSize`.
 *   3. Displace vertex Y by the heightmap (XZ plane after rotation).
 *   4. Apply the multi-texture splat material.
 *   5. Attach a BVH to the mesh and bind a TerrainPicker over it.
 *
 * That's it — every other system on the island consumes the picker for raycasts
 * and the heightmap for cheap height queries.
 */

import * as THREE from 'three';
import {
  generateIslandHeightmap,
  type IslandHeightmap,
  type IslandHeightmapOptions,
} from '@/lib/islandsCanonical/IslandHeightmap';
import { attachBVH, detachBVH, TerrainPicker } from '@/lib/terrain/raycast';
import {
  createSanctuaryTerrainMaterial,
  type SanctuaryTerrainMaterial,
} from './SanctuaryTerrainMaterial';
import type { SanctuaryTerrainLayer } from './types';

export interface SanctuaryTerrainOptions {
  /** Side length of the world plane, metres. */
  worldSize:    number;
  /** Vertex resolution per side. Single mesh — keep this reasonable (≤ 256). */
  segments:     number;
  /** Heightmap shape + noise overrides. */
  heightmap:    Partial<IslandHeightmapOptions>;
  /** Base UV tiling for splat textures. */
  textureRepeat: number;
}

export const DEFAULT_SANCTUARY_TERRAIN: SanctuaryTerrainOptions = {
  worldSize: 256,
  segments:  192,
  heightmap: {
    shape:        'round',
    maxHeight:    24,
    minHeight:    -18,
    ridgeMix:     0.25,
    baseFrequency: 1.2,
    seed:         0x5ACC1A,
  },
  textureRepeat: 28,
};

export interface BuiltSanctuaryTerrain extends SanctuaryTerrainLayer {
  /** Live material handle exposed for wind/time updates. */
  matCtl:    SanctuaryTerrainMaterial;
  /** Releases GPU resources and detaches BVH. */
  dispose:   () => void;
}

export function buildSanctuaryTerrain(
  partial: Partial<SanctuaryTerrainOptions> = {},
): BuiltSanctuaryTerrain {
  const opts: SanctuaryTerrainOptions = {
    ...DEFAULT_SANCTUARY_TERRAIN,
    ...partial,
    heightmap: { ...DEFAULT_SANCTUARY_TERRAIN.heightmap, ...partial.heightmap },
  };

  // 1. Heightmap (pure data).
  const heightmap: IslandHeightmap = generateIslandHeightmap({
    ...opts.heightmap,
    size:      opts.segments,
    worldSize: opts.worldSize,
  });

  // 2. Single PlaneGeometry.
  const geometry = new THREE.PlaneGeometry(
    opts.worldSize,
    opts.worldSize,
    opts.segments,
    opts.segments,
  );

  // PlaneGeometry vertices arrive on XY; we need XZ. Rotate -90° around X so
  // the geometry's local +Y becomes world +Z, then displace what is now Y
  // (the plane's normal direction) using the heightmap.
  geometry.rotateX(-Math.PI / 2);

  const pos  = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightmap.getHeightAt(x, z));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // 3. Material.
  const matCtl = createSanctuaryTerrainMaterial({
    worldSize:     opts.worldSize,
    seaLevelY:     0,
    textureRepeat: opts.textureRepeat,
  });

  // 4. The one mesh.
  const mesh = new THREE.Mesh(geometry, matCtl.material);
  mesh.name         = 'sanctuary-isle-terrain';
  mesh.castShadow   = false;     // terrain is too heavy to cast — accepts only.
  mesh.receiveShadow = true;
  mesh.userData.sanctuaryTerrain = true;

  // 5. BVH + picker. The single mesh is the ONLY collider for the island.
  attachBVH(mesh, { strategy: 'SAH' });
  const picker = new TerrainPicker([mesh]);

  return {
    mesh,
    heightmap,
    picker,
    material: matCtl.material,
    seaLevelY: 0,
    matCtl,
    dispose() {
      // TerrainPicker holds no GPU resources of its own; just drop our refs.
      picker.clear();
      detachBVH(mesh);
      geometry.dispose();
      matCtl.dispose();
    },
  };
}
