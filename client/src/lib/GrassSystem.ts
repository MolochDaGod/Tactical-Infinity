/**
 * GrassSystem — Sketchbook 0.3-style procedural grass.
 *
 * Renders thousands of animated grass blades using THREE.InstancedMesh.
 * Each blade is a 4-segment triangle strip geometry. Wind sway is applied
 * via onBeforeCompile vertex shader injection, matching the Sketchbook
 * aesthetic (dark roots, bright tips, subtle lateral sway).
 */

import * as THREE from 'three';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GrassConfig {
  bladeCount:       number;   // total blade instances (e.g. 80000)
  bladeHeight:      number;   // metres, default 0.35
  bladeWidth:       number;   // metres, default 0.04
  bladeSegments:    number;   // vertical segments per blade (2-4)
  patchRadius:      number;   // max spread radius around island centre
  colorBase:        THREE.Color;
  colorTip:         THREE.Color;
  windStrength:     number;
  windSpeed:        number;
  sampleStep:       number;   // grid cell size for point sampling
  // ── Cluster mode (sparse global, dense local) ──────────────────────────
  /** Cluster centre count. 0 = uniform legacy distribution. */
  clusterCount:     number;
  /** Cluster radius — blades spawn within this radius around each centre. */
  clusterRadius:    number;
  /** Probability [0..1] that any sampled point is kept. Lower = sparser. */
  globalDensity:    number;
  /** Local density boost inside a cluster (multiplies kept-probability). */
  clusterDensity:   number;
}

export const DEFAULT_GRASS_CONFIG: GrassConfig = {
  bladeCount:    60_000,
  bladeHeight:   0.38,
  bladeWidth:    0.042,
  bladeSegments: 3,
  patchRadius:   55,
  colorBase:     new THREE.Color(0x2d5a1b),
  colorTip:      new THREE.Color(0x88c060),
  windStrength:  0.14,
  windSpeed:     1.4,
  sampleStep:    0.4,
  // ── Cluster defaults ──────────────────────────────────────────────────
  // Realistic distribution: most ground is bare, but where grass IS present
  // it forms dense patches (like real wildflower meadows). Tuned for an
  // island ~110 units across.
  clusterCount:    14,    // ~14 lush clearings per island
  clusterRadius:   8,     // each clearing is ~16 units wide
  globalDensity:   0.05,  // 5% chance to keep a sampled point outside clusters
  clusterDensity:  16,    // 16x boost inside a cluster (so clusters fill)
};

// ─── Main class ───────────────────────────────────────────────────────────────

export class GrassSystem {
  private mesh:    THREE.InstancedMesh | null = null;
  private scene:   THREE.Scene;
  private config:  GrassConfig;
  private timeUniform = { value: 0 };
  private raycaster   = new THREE.Raycaster();

  constructor(scene: THREE.Scene, cfg: Partial<GrassConfig> = {}) {
    this.scene  = scene;
    this.config = { ...DEFAULT_GRASS_CONFIG, ...cfg };
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  async generate(terrainMeshes: THREE.Mesh[], islandBounds: THREE.Box3): Promise<void> {
    const cfg = this.config;

    // 1. Sample walkable positions from terrain
    const positions = this._samplePoints(terrainMeshes, islandBounds);
    if (positions.length === 0) { console.warn('[GrassSystem] No grass positions found'); return; }

    const actual = Math.min(positions.length, cfg.bladeCount);
    console.log(`[GrassSystem] Placing ${actual} grass blades`);

    // 2. Build blade geometry (Sketchbook-style: tapered quad strip)
    const geo = this._buildBladeGeometry();

    // 3. Material with Sketchbook-style wind shader
    const mat = this._buildGrassMaterial();

    // 4. InstancedMesh
    this.mesh = new THREE.InstancedMesh(geo, mat, actual);
    this.mesh.castShadow    = true;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < actual; i++) {
      const p   = positions[i % positions.length];
      const rot = Math.random() * Math.PI * 2;
      const scale = 0.7 + Math.random() * 0.6;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    this.scene.add(this.mesh);
  }

  // ── Update (call every frame with elapsed time) ───────────────────────────

  update(elapsed: number): void {
    this.timeUniform.value = elapsed;
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) this.mesh.material.forEach(m => m.dispose());
      else this.mesh.material.dispose();
      this.mesh = null;
    }
  }

  // ── Private: terrain point sampling ──────────────────────────────────────

  private _samplePoints(meshes: THREE.Mesh[], bounds: THREE.Box3): THREE.Vector3[] {
    const cfg = this.config;
    const { patchRadius, sampleStep, clusterCount, clusterRadius, globalDensity, clusterDensity } = cfg;
    const cx = (bounds.min.x + bounds.max.x) * 0.5;
    const cz = (bounds.min.z + bounds.max.z) * 0.5;

    // ── 1. Pick cluster centres on the walkable XZ region ───────────────
    // Each centre is a circular "lush patch" — blades preferentially spawn
    // inside one of these. This produces real-world meadow distributions
    // instead of a uniform green carpet.
    const clusters: { x: number; z: number; r: number }[] = [];
    for (let i = 0; i < clusterCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * patchRadius * 0.85;
      clusters.push({
        x: cx + Math.cos(a) * r,
        z: cz + Math.sin(a) * r,
        r: clusterRadius * (0.7 + Math.random() * 0.6),
      });
    }

    const results: THREE.Vector3[] = [];
    const down = new THREE.Vector3(0, -1, 0);
    const xMin = cx - patchRadius, xMax = cx + patchRadius;
    const zMin = cz - patchRadius, zMax = cz + patchRadius;

    for (let x = xMin; x < xMax; x += sampleStep) {
      for (let z = zMin; z < zMax; z += sampleStep) {
        // Jitter within cell
        const jx = x + (Math.random() - 0.5) * sampleStep;
        const jz = z + (Math.random() - 0.5) * sampleStep;

        // ── Cluster gating: keep this point with sparse global density,
        // boosted heavily when the point falls inside a lush cluster.
        let keepProb = globalDensity;
        for (const cl of clusters) {
          const d = Math.hypot(jx - cl.x, jz - cl.z);
          if (d < cl.r) {
            // Smooth falloff toward the cluster edge so patches blend out.
            const falloff = 1 - (d / cl.r);
            keepProb = Math.min(1, keepProb + globalDensity * clusterDensity * falloff * falloff);
          }
        }
        if (Math.random() > keepProb) continue;

        this.raycaster.set(new THREE.Vector3(jx, 200, jz), down);
        this.raycaster.far = 400;
        const hits = this.raycaster.intersectObjects(meshes, true);

        if (hits.length > 0) {
          const y = hits[0].point.y;
          // Only grass on relatively flat, above-water ground
          if (y > 0.25 && y < 30) {
            // Slope check (use normal if available)
            const normal = hits[0].face?.normal;
            if (normal) {
              const worldNormal = normal.clone().transformDirection(hits[0].object.matrixWorld);
              if (worldNormal.y < 0.6) continue; // too steep
            }
            results.push(new THREE.Vector3(jx, y, jz));
          }
        }
      }
    }
    // Shuffle for even instance assignment
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return results;
  }

  // ── Private: blade geometry ───────────────────────────────────────────────

  private _buildBladeGeometry(): THREE.BufferGeometry {
    const { bladeHeight: H, bladeWidth: W, bladeSegments: S } = this.config;
    const { colorBase: cb, colorTip: ct } = this.config;

    const verts: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Build S+1 rows of 2 vertices each (tapered toward tip)
    for (let i = 0; i <= S; i++) {
      const t      = i / S;                      // 0 at base, 1 at tip
      const y      = t * H;
      const halfW  = W * 0.5 * (1 - t * 0.8);   // taper
      const u      = t;

      // Left vertex
      verts.push(-halfW, y, 0);
      normals.push(0, 0, 1);
      uvs.push(0, u);
      // Right vertex
      verts.push( halfW, y, 0);
      normals.push(0, 0, 1);
      uvs.push(1, u);

      // Vertex colour: blend base→tip
      const col = new THREE.Color().lerpColors(cb, ct, t);
      colors.push(col.r, col.g, col.b);
      colors.push(col.r, col.g, col.b);
    }

    // Quad indices between adjacent rows
    for (let i = 0; i < S; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  // ── Private: grass material with Sketchbook wind shader ──────────────────

  private _buildGrassMaterial(): THREE.MeshLambertMaterial {
    const mat = new THREE.MeshLambertMaterial({
      vertexColors:   true,
      side:           THREE.DoubleSide,
      alphaTest:      0.1,
    });

    const timeUniform   = this.timeUniform;
    const windStrength  = { value: this.config.windStrength };
    const windSpeed     = { value: this.config.windSpeed };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time        = timeUniform;
      shader.uniforms.windStrength = windStrength;
      shader.uniforms.windSpeed    = windSpeed;

      // Prepend uniform declarations to vertex shader
      shader.vertexShader = `
        uniform float time;
        uniform float windStrength;
        uniform float windSpeed;
      ` + shader.vertexShader;

      // Inject wind displacement into <begin_vertex>
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>

        // World-space position for spatially-varying wind
        vec4 wsPos4 = instanceMatrix * vec4(position, 1.0);
        vec3 wsPos  = (modelMatrix * wsPos4).xyz;

        // Height factor — only sway upper portions of the blade
        float heightFactor = max(0.0, position.y / ${this.config.bladeHeight.toFixed(3)});
        float hSq = heightFactor * heightFactor;  // quadratic for natural look

        // Sketchbook-style dual-frequency wind
        float freq1 = windSpeed;
        float freq2 = windSpeed * 0.73;
        float sway  = sin(wsPos.x * 0.52 + time * freq1) * windStrength * hSq;
        sway       += sin(wsPos.z * 0.43 + time * freq2) * windStrength * 0.6 * hSq;

        // Additional micro-turbulence per-blade (using wsPos as seed)
        float micro = sin(wsPos.x * 3.1 + wsPos.z * 2.7 + time * 2.2) * 0.015 * hSq;
        sway += micro;

        transformed.x += sway;
        transformed.z += sway * 0.3;
        `
      );
    };

    return mat;
  }
}
