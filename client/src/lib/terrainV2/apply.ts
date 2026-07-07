/**
 * Apply a Heightmap to a THREE.PlaneGeometry's vertex displacement.
 *
 * The plane is assumed to be created on the XZ plane (rotation -PI/2 around X
 * applied AFTER calling this — we write displacement into the y-component of
 * each vertex in the plane's local space, which is the +Z axis pre-rotation).
 *
 * Conventions match THREE.PlaneGeometry: vertices are laid out row by row,
 * and we modify position.z (the local plane's "up" before the X rotation).
 */

import * as THREE from 'three';
import { Heightmap } from './heightmap';

export function applyHeightmapToPlane(
  geometry: THREE.PlaneGeometry,
  heightmap: Heightmap,
  /** If true, write to position.y; else write to position.z (default). */
  writeAxisY = false,
): void {
  const params = (geometry.parameters as any) as {
    width: number; height: number;
    widthSegments: number; heightSegments: number;
  };
  const segX = params.widthSegments;
  const segZ = params.heightSegments;
  const stride = heightmap.stride;

  if (segX + 1 !== stride || segZ + 1 !== stride) {
    // Resample bilinearly (rarely needed since we usually match)
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let z = 0; z <= segZ; z++) {
      const sv = (z / segZ) * (stride - 1);
      const iz = Math.floor(sv);
      const fz = sv - iz;
      for (let x = 0; x <= segX; x++) {
        const su = (x / segX) * (stride - 1);
        const ix = Math.floor(su);
        const fx = su - ix;
        const ix1 = Math.min(stride - 1, ix + 1);
        const iz1 = Math.min(stride - 1, iz + 1);
        const a = heightmap.data[iz  * stride + ix ];
        const b = heightmap.data[iz  * stride + ix1];
        const c = heightmap.data[iz1 * stride + ix ];
        const d = heightmap.data[iz1 * stride + ix1];
        const v =
          a * (1 - fx) * (1 - fz) +
          b * fx       * (1 - fz) +
          c * (1 - fx) * fz +
          d * fx       * fz;
        const i = z * (segX + 1) + x;
        if (writeAxisY) pos.setY(i, v);
        else            pos.setZ(i, v);
      }
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return;
  }

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  // Plane vertex order matches heightmap row-major
  for (let i = 0; i < heightmap.data.length; i++) {
    if (writeAxisY) pos.setY(i, heightmap.data[i]);
    else            pos.setZ(i, heightmap.data[i]);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}
