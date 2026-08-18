/**
 * Keep authored fish materials (Kd / vertex color / maps).
 * Quaternius FBX often has no maps — Lambert fallback only then.
 */

import * as THREE from 'three';

export function preserveFishMaterials(root: THREE.Object3D, fallbackHex = 0x2ec4b6): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const hasVertexColor = !!mesh.geometry?.getAttribute?.('color');
    const next = src.map((mat) => {
      if (!mat) {
        return new THREE.MeshLambertMaterial({
          color: fallbackHex,
          vertexColors: hasVertexColor,
        });
      }
      const anyMat = mat as THREE.MeshStandardMaterial;
      if (anyMat.map) {
        anyMat.map.colorSpace = THREE.SRGBColorSpace;
        anyMat.needsUpdate = true;
        return anyMat;
      }
      if (hasVertexColor) {
        return new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xffffff });
      }
      if (anyMat.color) {
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && anyMat.type === 'MeshStandardMaterial') {
          return new THREE.MeshLambertMaterial({ color: anyMat.color.getHex() });
        }
        return mat;
      }
      return new THREE.MeshLambertMaterial({ color: fallbackHex });
    });
    mesh.material = next.length === 1 ? next[0] : next;
  });
}
