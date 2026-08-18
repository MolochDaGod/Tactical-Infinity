/**
 * Rapier ground for the baked home island — heightfield + sea plane.
 * Player still snaps via getHeightAt; this is the physics world ships/debris use.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { TerrainData } from '@/lib/islandHeightmapTerrain';

const GRID = 48;

export interface IslandRapierGround {
  world: RAPIER.World;
  update(dt: number): void;
  dispose(): void;
}

export async function createIslandRapierGround(
  terrain: TerrainData,
): Promise<IslandRapierGround | null> {
  try {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;

    const r = terrain.radius;
    const nrows = GRID;
    const ncols = GRID;
    const heights = new Float32Array(nrows * ncols);
    for (let j = 0; j < nrows; j++) {
      for (let i = 0; i < ncols; i++) {
        const x = -r + (i / (ncols - 1)) * r * 2;
        const z = -r + (j / (nrows - 1)) * r * 2;
        heights[j * ncols + i] = terrain.getHeightAt(x, z);
      }
    }
    const hf = RAPIER.ColliderDesc.heightfield(nrows, ncols, heights, {
      x: r * 2,
      y: 1,
      z: r * 2,
    });
    world.createCollider(hf);

    const water = RAPIER.ColliderDesc.cuboid(r * 2, 0.25, r * 2)
      .setTranslation(0, -0.25, 0)
      .setSensor(true);
    world.createCollider(water);

    let acc = 0;
    return {
      world,
      update(dt: number) {
        acc += dt;
        while (acc >= 1 / 60) {
          world.step();
          acc -= 1 / 60;
        }
      },
      dispose() {
        world.free();
      },
    };
  } catch (e) {
    console.warn('[islandRapierGround] skipped', e);
    return null;
  }
}
