/**
 * sanctuaryIsle/SanctuaryTerrainMaterial.ts
 *
 * Single-mesh terrain material for Sanctuary Isle. Splats four user-supplied
 * textures by altitude and slope, then animates the grass-band UVs to give a
 * subtle wind effect WITHOUT adding a second mesh layer.
 *
 *   altitude < seaLevel        →  seabed (existing sand albedo)
 *   altitude in beach band     →  blend seabed → grass
 *   altitude in meadow band    →  grass.png (with wind UV shift)
 *   altitude in highlands band →  grass_old.png blended with grass.png
 *   altitude in cliff band     →  grass_rock.png
 *   slope above cliffSlope     →  tile_dark.png overrides everything
 *
 * Lighting goes through THREE's built-in lights_pars chunks so the material
 * still respects the scene's hemisphere + directional + rim lights.
 */

import * as THREE from 'three';
import {
  GROUND_LAYER_REGISTRY,
  loadGroundLayer,
  DEFAULT_SANCTUARY_GROUND_SLOTS,
  type LoadedGroundLayer,
  type GroundLayerDef,
} from './groundLayers';

// Stylised vegetation overlays (kept as flat colour PNGs, not PBR).
const GRASS_URL     = '/textures/sanctuary/grass.png';
const GRASS_OLD_URL = '/textures/sanctuary/grass_old.png';

function loadTiled(loader: THREE.TextureLoader, url: string, repeat: number) {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface SanctuaryTerrainMaterialOptions {
  worldSize:   number;
  seaLevelY:   number;
  beachBand:   [number, number];
  meadowBand:  [number, number];
  highBand:    [number, number];
  cliffSlope:  number;        // cosine threshold; world-space dot(normal, up)
  textureRepeat: number;      // base UV tiling
  /**
   * Override which PBR pack from `groundLayers.ts` fills each splat slot.
   * Defaults are picked for stylistic contrast on Sanctuary Isle.
   */
  seabedPackId?: string;
  rockPackId?:   string;
  cliffPackId?:  string;
}

export const DEFAULT_SANCTUARY_MAT_OPTIONS: SanctuaryTerrainMaterialOptions = {
  worldSize:     256,
  seaLevelY:     0,
  beachBand:    [0.0, 1.5],
  meadowBand:   [1.5, 12.0],
  highBand:     [12.0, 22.0],
  cliffSlope:   0.55,
  textureRepeat: 32,
  seabedPackId: DEFAULT_SANCTUARY_GROUND_SLOTS.seabedPackId,
  rockPackId:   DEFAULT_SANCTUARY_GROUND_SLOTS.rockPackId,
  cliffPackId:  DEFAULT_SANCTUARY_GROUND_SLOTS.cliffPackId,
};

export interface SanctuaryTerrainMaterial {
  material:    THREE.ShaderMaterial;
  textures:    THREE.Texture[];
  /** Resolved PBR ground packs that filled the seabed / rock / cliff slots. */
  groundPacks: { seabed: GroundLayerDef; rock: GroundLayerDef; cliff: GroundLayerDef };
  setWind:     (dirX: number, dirZ: number, strength: number, gustHz: number) => void;
  setTime:     (t: number) => void;
  dispose:     () => void;
}

export function createSanctuaryTerrainMaterial(
  opts: Partial<SanctuaryTerrainMaterialOptions> = {},
): SanctuaryTerrainMaterial {
  const o = { ...DEFAULT_SANCTUARY_MAT_OPTIONS, ...opts };
  const loader = new THREE.TextureLoader();

  // ── PBR ground packs (geology) — sampled from the typed registry. ─────────
  const seabedDef = GROUND_LAYER_REGISTRY[o.seabedPackId!] ?? GROUND_LAYER_REGISTRY[DEFAULT_SANCTUARY_GROUND_SLOTS.seabedPackId];
  const rockDef   = GROUND_LAYER_REGISTRY[o.rockPackId!]   ?? GROUND_LAYER_REGISTRY[DEFAULT_SANCTUARY_GROUND_SLOTS.rockPackId];
  const cliffDef  = GROUND_LAYER_REGISTRY[o.cliffPackId!]  ?? GROUND_LAYER_REGISTRY[DEFAULT_SANCTUARY_GROUND_SLOTS.cliffPackId];

  const seabedPack: LoadedGroundLayer = loadGroundLayer(seabedDef, { loader, repeat: o.textureRepeat });
  const rockPack:   LoadedGroundLayer = loadGroundLayer(rockDef,   { loader, repeat: Math.round(o.textureRepeat * 0.6) });
  const cliffPack:  LoadedGroundLayer = loadGroundLayer(cliffDef,  { loader, repeat: Math.round(o.textureRepeat * 0.8) });

  const texSeabed   = seabedPack.albedo;
  const texRock     = rockPack.albedo;
  const texTile     = cliffPack.albedo;

  // ── Vegetation overlays (stylised, not PBR). ──────────────────────────────
  const texGrass    = loadTiled(loader, GRASS_URL,     o.textureRepeat);
  const texGrassOld = loadTiled(loader, GRASS_OLD_URL, o.textureRepeat * 0.75);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    THREE.UniformsLib.fog,
    {
      uSeabed:      { value: texSeabed },
      uGrass:       { value: texGrass },
      uGrassOld:    { value: texGrassOld },
      uRock:        { value: texRock },
      uTile:        { value: texTile },

      uSeaLevel:    { value: o.seaLevelY },
      uBeachBand:   { value: new THREE.Vector2(o.beachBand[0], o.beachBand[1]) },
      uMeadowBand:  { value: new THREE.Vector2(o.meadowBand[0], o.meadowBand[1]) },
      uHighBand:    { value: new THREE.Vector2(o.highBand[0], o.highBand[1]) },
      uCliffSlope:  { value: o.cliffSlope },

      uWindDir:     { value: new THREE.Vector2(1, 0) },
      uWindStrength:{ value: 0.4 },
      uGustHz:      { value: 0.6 },
      uTime:        { value: 0 },

      uAmbient:     { value: new THREE.Color(0xb6c8d8) },
    },
  ]);

  const vertexShader = /* glsl */`
    #include <common>
    #include <fog_pars_vertex>
    #include <shadowmap_pars_vertex>

    varying vec3  vWorldPos;
    varying vec3  vWorldNormal;
    varying float vAltitude;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos     = worldPos.xyz;
      vWorldNormal  = normalize(mat3(modelMatrix) * normal);
      vAltitude     = worldPos.y;

      vec4 mvPosition = viewMatrix * worldPos;
      gl_Position = projectionMatrix * mvPosition;

      #include <fog_vertex>
      #include <shadowmap_vertex>
    }
  `;

  const fragmentShader = /* glsl */`
    #include <common>
    #include <packing>
    #include <lights_pars_begin>
    #include <fog_pars_fragment>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>

    uniform sampler2D uSeabed;
    uniform sampler2D uGrass;
    uniform sampler2D uGrassOld;
    uniform sampler2D uRock;
    uniform sampler2D uTile;

    uniform float     uSeaLevel;
    uniform vec2      uBeachBand;
    uniform vec2      uMeadowBand;
    uniform vec2      uHighBand;
    uniform float     uCliffSlope;

    uniform vec2      uWindDir;
    uniform float     uWindStrength;
    uniform float     uGustHz;
    uniform float     uTime;

    uniform vec3      uAmbient;

    varying vec3  vWorldPos;
    varying vec3  vWorldNormal;
    varying float vAltitude;

    float smoothBand(float x, vec2 band) {
      return smoothstep(band.x, band.y, x);
    }

    // Cheap procedural variation so adjacent tiles don't look stamped.
    float hash21(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      // World-space UVs so all bands tile consistently regardless of mesh size.
      vec2 baseUV = vWorldPos.xz * 0.05;

      // Wind: subtle UV shift on the grass band only.
      float gust = uWindStrength * (0.6 + 0.4 * sin(uTime * uGustHz * 6.2831 + vWorldPos.x * 0.05));
      vec2 windOff = uWindDir * gust * 0.04 * sin(uTime * 1.3 + vWorldPos.z * 0.07);

      vec3 seabed = texture2D(uSeabed,   baseUV).rgb;
      vec3 grass  = texture2D(uGrass,    baseUV + windOff).rgb;
      vec3 grassO = texture2D(uGrassOld, baseUV * 0.85 + windOff * 0.6).rgb;
      vec3 rock   = texture2D(uRock,     baseUV * 0.6).rgb;
      vec3 tile   = texture2D(uTile,     baseUV * 0.8).rgb;

      // Altitude-based blends.
      float seabedToGrass = smoothBand(vAltitude, vec2(uSeaLevel, uBeachBand.y));
      float grassToHigh   = smoothBand(vAltitude, uMeadowBand);
      float highToCliff   = smoothBand(vAltitude, uHighBand);

      // Variation between the two grass textures using a low-frequency hash.
      float grassMix = clamp(0.35 + 0.5 * hash21(floor(vWorldPos.xz * 0.04)), 0.0, 1.0);
      vec3 grassBlend = mix(grass, grassO, grassMix);

      vec3 albedo = seabed;
      albedo = mix(albedo, grassBlend, seabedToGrass);
      albedo = mix(albedo, grassBlend, 1.0 - grassToHigh);  // re-assert grass through meadow band
      albedo = mix(albedo, rock,       grassToHigh);
      albedo = mix(albedo, tile,       highToCliff);

      // Slope-based cliff override: anywhere too steep to walk gets stone tiles.
      float upDot   = clamp(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
      float slopeK  = 1.0 - smoothstep(uCliffSlope - 0.1, uCliffSlope + 0.1, upDot);
      albedo = mix(albedo, tile, slopeK);

      // Lighting via THREE's built-in lights chunks (manual lambert + hemisphere).
      vec3 N = normalize(vWorldNormal);
      vec3 lit = uAmbient * 0.35;

      #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          vec3  L = normalize(directionalLights[i].direction);
          float d = max(dot(N, L), 0.0);
          lit += directionalLights[i].color * d;
        }
      #endif

      #if NUM_HEMI_LIGHTS > 0
        for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
          float w = N.y * 0.5 + 0.5;
          lit += mix(hemisphereLights[i].groundColor, hemisphereLights[i].skyColor, w);
        }
      #endif

      // Shadows from the sun (first dir light).
      float shadowFactor = getShadowMask();
      lit *= mix(0.55, 1.0, shadowFactor);

      vec3 outColor = albedo * lit;

      gl_FragColor = vec4(outColor, 1.0);
      #include <fog_fragment>
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    lights: true,
    fog:    true,
    side:   THREE.FrontSide,
  });

  return {
    material,
    textures: [texSeabed, texGrass, texGrassOld, texRock, texTile],
    groundPacks: { seabed: seabedDef, rock: rockDef, cliff: cliffDef },
    setWind(dirX, dirZ, strength, gustHz) {
      const len = Math.hypot(dirX, dirZ) || 1;
      uniforms.uWindDir.value.set(dirX / len, dirZ / len);
      uniforms.uWindStrength.value = strength;
      uniforms.uGustHz.value       = gustHz;
    },
    setTime(t) { uniforms.uTime.value = t; },
    dispose() {
      material.dispose();
      // Vegetation textures are owned here.
      [texGrass, texGrassOld].forEach(t => t.dispose());
      // PBR packs own all of their channels.
      seabedPack.dispose();
      rockPack.dispose();
      cliffPack.dispose();
    },
  };
}
