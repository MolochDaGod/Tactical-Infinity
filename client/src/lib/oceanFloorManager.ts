import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface IslandProximity {
  position: THREE.Vector3;
  radius: number;
  biome?: string;
}

const TEX_BASE = '/textures/seabed_textures';

const TEXTURE_SETS = {
  coralGround: {
    diff: `${TEX_BASE}/coral_ground_02_2k/textures/coral_ground_02_diff_2k.jpg`,
    nor:  `${TEX_BASE}/coral_ground_02_2k/textures/coral_ground_02_nor_gl_2k.jpg`,
    rough:`${TEX_BASE}/coral_ground_02_2k/textures/coral_ground_02_rough_2k.jpg`,
  },
  coralMud: {
    diff: `${TEX_BASE}/coral_mud_01_2k/textures/coral_mud_01_diff_2k.jpg`,
    nor:  `${TEX_BASE}/coral_mud_01_2k/textures/coral_mud_01_nor_gl_2k.jpg`,
    rough:`${TEX_BASE}/coral_mud_01_2k/textures/coral_mud_01_rough_2k.jpg`,
  },
  gravellySand: {
    diff: `${TEX_BASE}/gravelly_sand_2k/textures/gravelly_sand_diff_2k.jpg`,
    nor:  `${TEX_BASE}/gravelly_sand_2k/textures/gravelly_sand_nor_gl_2k.jpg`,
    rough:`${TEX_BASE}/gravelly_sand_2k/textures/gravelly_sand_arm_2k.jpg`,
  },
};

const PROP_PATHS = {
  rockMossA: `${TEX_BASE}/rock_moss_set_01_2k/rock_moss_set_01_2k.gltf`,
  rockMossB: `${TEX_BASE}/rock_moss_set_02_2k/rock_moss_set_02_2k.gltf`,
  coralAnker: '/models/creatures/coral_anker_kleur_1777027194034.glb',
  coralPlastic: '/models/creatures/coral_plastic_gezond_1777027203802.glb',
  coralReef: '/models/creatures/coral_reef_small_1777027237416.glb',
};

export class OceanFloorManager {
  private scene: THREE.Scene;
  private worldSize: number;
  private floorMesh: THREE.Mesh | null = null;
  private depthData: Float32Array | null = null;
  private gridResolution: number = 128;
  private islands: IslandProximity[] = [];
  private propGroup: THREE.Group | null = null;
  private loader = new GLTFLoader();
  private texLoader = new THREE.TextureLoader();

  private readonly maxDepth = -30;
  private readonly minDepth = -1;
  private readonly shallowZoneRadius = 150;

  constructor(scene: THREE.Scene, worldSize: number) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.depthData = new Float32Array(this.gridResolution * this.gridResolution);
  }

  setIslands(islands: IslandProximity[]): void {
    this.islands = islands;
    this.recalculateDepth();
    this.updateFloorMesh();
  }

  private recalculateDepth(): void {
    if (!this.depthData) return;

    for (let z = 0; z < this.gridResolution; z++) {
      for (let x = 0; x < this.gridResolution; x++) {
        const worldX = (x / this.gridResolution - 0.5) * this.worldSize;
        const worldZ = (z / this.gridResolution - 0.5) * this.worldSize;

        let depth = this.maxDepth;

        for (const island of this.islands) {
          const dx = worldX - island.position.x;
          const dz = worldZ - island.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const shallowRadius = island.radius + this.shallowZoneRadius;

          if (distance < shallowRadius) {
            let localDepth: number;
            if (distance < island.radius * 0.8) {
              localDepth = this.minDepth;
            } else {
              const t = (distance - island.radius * 0.8) / (shallowRadius - island.radius * 0.8);
              const smoothT = t * t * (3 - 2 * t);
              localDepth = THREE.MathUtils.lerp(this.minDepth, this.maxDepth, smoothT);
            }
            depth = Math.max(depth, localDepth);
          }
        }

        const noiseX = Math.sin(worldX * 0.01) * Math.cos(worldZ * 0.015) * 3;
        const noiseZ = Math.sin(worldZ * 0.012 + worldX * 0.008) * 2;
        depth = Math.max(this.maxDepth, Math.min(this.minDepth, depth + noiseX + noiseZ));

        this.depthData[z * this.gridResolution + x] = depth;
      }
    }
  }

  getDepthAt(x: number, z: number): number {
    if (!this.depthData) return this.maxDepth;

    const gridX = ((x / this.worldSize) + 0.5) * this.gridResolution;
    const gridZ = ((z / this.worldSize) + 0.5) * this.gridResolution;

    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, this.gridResolution - 1);
    const z1 = Math.min(z0 + 1, this.gridResolution - 1);

    const fx = gridX - x0;
    const fz = gridZ - z0;

    const cx0 = Math.max(0, Math.min(this.gridResolution - 1, x0));
    const cz0 = Math.max(0, Math.min(this.gridResolution - 1, z0));
    const cx1 = Math.max(0, Math.min(this.gridResolution - 1, x1));
    const cz1 = Math.max(0, Math.min(this.gridResolution - 1, z1));

    const d00 = this.depthData[cz0 * this.gridResolution + cx0];
    const d10 = this.depthData[cz0 * this.gridResolution + cx1];
    const d01 = this.depthData[cz1 * this.gridResolution + cx0];
    const d11 = this.depthData[cz1 * this.gridResolution + cx1];

    const d0 = THREE.MathUtils.lerp(d00, d10, fx);
    const d1 = THREE.MathUtils.lerp(d01, d11, fx);

    return THREE.MathUtils.lerp(d0, d1, fz);
  }

  /** Distance to nearest island shore — used by texture blending and prop placement. */
  private distanceToNearestShore(x: number, z: number): { dist: number; islandRadius: number } {
    let best = Infinity;
    let bestRadius = 0;
    for (const isl of this.islands) {
      const dx = x - isl.position.x;
      const dz = z - isl.position.z;
      const d = Math.sqrt(dx * dx + dz * dz) - isl.radius;
      if (d < best) {
        best = d;
        bestRadius = isl.radius;
      }
    }
    return { dist: best, islandRadius: bestRadius };
  }

  private loadTextureSet(set: { diff: string; nor: string; rough: string }, repeat: number) {
    const load = (url: string, srgb: boolean) => {
      const t = this.texLoader.load(url, undefined, undefined, () => {
        // silent fail — material will still render in flat color
      });
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return {
      map:           load(set.diff, true),
      normalMap:     load(set.nor,  false),
      roughnessMap:  load(set.rough, false),
    };
  }

  createFloorMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      this.worldSize,
      this.worldSize,
      this.gridResolution - 1,
      this.gridResolution - 1
    );

    this.updateGeometryHeights(geometry);
    this.applyVertexBlendColors(geometry);

    // Neutral seabed: gravelly_sand as the dominant base (works for every
    // biome — temperate, arctic, volcanic, swamp, etc.) with coral_mud as
    // mottled darker patches blended via vertex colors. The old setup used
    // coral_ground everywhere which made the entire world look like a
    // tropical reef even under arctic / mountain / haunted islands.
    const baseTex = this.loadTextureSet(TEXTURE_SETS.gravellySand, this.worldSize / 40);
    const altTex  = this.loadTextureSet(TEXTURE_SETS.coralMud,     this.worldSize / 32);

    const material = new THREE.MeshStandardMaterial({
      map: baseTex.map,
      normalMap: baseTex.normalMap,
      roughnessMap: baseTex.roughnessMap,
      vertexColors: true,
      color: 0xa9b9b3,
      metalness: 0.05,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });

    // Inject a second-texture blend driven by vertex color .r → mix to coral_mud
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uMudMap = { value: altTex.map };
      shader.uniforms.uMudNormal = { value: altTex.normalMap };
      shader.uniforms.uMudRough = { value: altTex.roughnessMap };

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D uMudMap;
           uniform sampler2D uMudNormal;
           uniform sampler2D uMudRough;`
        )
        .replace(
          '#include <map_fragment>',
          `
          vec4 baseColor = texture2D( map, vMapUv );
          vec4 mudColor  = texture2D( uMudMap, vMapUv * 1.31 );
          float blend = clamp(vColor.r, 0.0, 1.0);
          vec4 sampledDiffuseColor = mix(baseColor, mudColor, blend);
          #ifdef DECODE_VIDEO_TEXTURE
            sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
          #endif
          diffuseColor *= sampledDiffuseColor;
          `
        );
    };

    this.floorMesh = new THREE.Mesh(geometry, material);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0;
    this.floorMesh.receiveShadow = true;
    this.floorMesh.name = 'OceanFloor';

    this.scene.add(this.floorMesh);

    this.addOceanFloorProps();

    return this.floorMesh;
  }

  /**
   * Vertex-color blend mask: red channel drives "coral mud patch" amount.
   * Uses smooth pseudo-noise so patches feel organic.
   */
  private applyVertexBlendColors(geometry: THREE.PlaneGeometry): void {
    const positions = geometry.attributes.position.array as Float32Array;
    const count = positions.length / 3;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1]; // pre-rotation z

      // Two-frequency cosine "noise" — cheap, deterministic, smooth.
      const n1 = Math.sin(x * 0.013) * Math.cos(y * 0.011);
      const n2 = Math.sin(x * 0.041 + y * 0.027) * 0.5;
      const blend = THREE.MathUtils.smoothstep((n1 + n2) * 0.6 + 0.5, 0.25, 0.85);

      colors[i * 3] = blend;     // R = mud-blend amount
      colors[i * 3 + 1] = 1;     // G/B unused for now
      colors[i * 3 + 2] = 1;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  private updateGeometryHeights(geometry: THREE.PlaneGeometry): void {
    if (!this.depthData) return;

    const positions = geometry.attributes.position.array as Float32Array;
    const vertexCount = positions.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];

      const gridX = Math.floor(((x / this.worldSize) + 0.5) * (this.gridResolution - 1));
      const gridZ = Math.floor(((y / this.worldSize) + 0.5) * (this.gridResolution - 1));

      const clampX = Math.max(0, Math.min(this.gridResolution - 1, gridX));
      const clampZ = Math.max(0, Math.min(this.gridResolution - 1, gridZ));

      const depth = this.depthData[clampZ * this.gridResolution + clampX];
      positions[i * 3 + 2] = depth;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private updateFloorMesh(): void {
    if (!this.floorMesh) return;
    const geometry = this.floorMesh.geometry as THREE.PlaneGeometry;
    this.updateGeometryHeights(geometry);
    this.applyVertexBlendColors(geometry);
  }

  /**
   * Async-loads rock_moss + coral GLB props and instances them across the
   * seabed. Falls back silently if any model is missing — the seabed still
   * looks fine without them.
   */
  private async addOceanFloorProps(): Promise<void> {
    if (!this.propGroup) {
      this.propGroup = new THREE.Group();
      this.propGroup.name = 'OceanFloorProps';
      this.scene.add(this.propGroup);
    }

    const tryLoad = async (url: string): Promise<GLTF | null> => {
      try { return await this.loader.loadAsync(url); }
      catch { return null; }
    };

    const [rockA, rockB, coralAnker, coralPlastic, coralReef] = await Promise.all([
      tryLoad(PROP_PATHS.rockMossA),
      tryLoad(PROP_PATHS.rockMossB),
      tryLoad(PROP_PATHS.coralAnker),
      tryLoad(PROP_PATHS.coralPlastic),
      tryLoad(PROP_PATHS.coralReef),
    ]);

    const rockTemplates = [rockA, rockB].filter((x): x is GLTF => !!x).map(g => g.scene);
    const coralTemplates = [coralAnker, coralPlastic, coralReef]
      .filter((x): x is GLTF => !!x)
      .map(g => g.scene);

    // Rocks scattered uniformly across the floor (avoid shores).
    if (rockTemplates.length > 0) {
      const rockCount = 80;
      for (let i = 0; i < rockCount; i++) {
        const x = (Math.random() - 0.5) * this.worldSize * 0.9;
        const z = (Math.random() - 0.5) * this.worldSize * 0.9;
        const { dist } = this.distanceToNearestShore(x, z);
        if (dist < 10) continue; // skip near-shore where they'd poke out
        const depth = this.getDepthAt(x, z);

        const template = rockTemplates[Math.floor(Math.random() * rockTemplates.length)];
        const rock = template.clone();
        rock.position.set(x, depth + 0.2, z);
        rock.rotation.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.4
        );
        const s = 0.5 + Math.random() * 1.6;
        rock.scale.setScalar(s);
        rock.traverse(c => {
          if (c instanceof THREE.Mesh) {
            c.castShadow = false;
            c.receiveShadow = true;
          }
        });
        this.propGroup.add(rock);
      }
    }

    // Corals cluster around tropical islands' shallow zones only — coral
    // reefs don't grow under arctic / volcanic / mountain / haunted seas.
    if (coralTemplates.length > 0) {
      for (const island of this.islands) {
        if (island.biome !== 'tropical') continue;
        const clusterCount = 14;
        for (let i = 0; i < clusterCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = island.radius + 15 + Math.random() * 70;
          const x = island.position.x + Math.cos(angle) * distance;
          const z = island.position.z + Math.sin(angle) * distance;
          const depth = this.getDepthAt(x, z);
          if (depth > -2) continue; // skip beach line

          const template = coralTemplates[Math.floor(Math.random() * coralTemplates.length)];
          const coral = template.clone();
          coral.position.set(x, depth + 0.1, z);
          coral.rotation.y = Math.random() * Math.PI * 2;
          const s = 0.4 + Math.random() * 1.2;
          coral.scale.setScalar(s);
          coral.traverse(c => {
            if (c instanceof THREE.Mesh) {
              c.castShadow = false;
              c.receiveShadow = true;
            }
          });
          this.propGroup.add(coral);
        }
      }
    }
  }

  dispose(): void {
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      (this.floorMesh.material as THREE.Material).dispose();
    }
    if (this.propGroup) {
      this.scene.remove(this.propGroup);
      this.propGroup.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material?.dispose();
        }
      });
    }
    this.depthData = null;
  }
}
