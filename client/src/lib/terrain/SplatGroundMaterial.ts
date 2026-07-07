/**
 * SplatGroundMaterial — biome-aware 4-layer splat-mapping shader for the
 * canonical island terrain.
 *
 * Replaces the flat 3-color blend in `IslandSceneBuilder.makeBiomeMaterial()`
 * with a proper layered material. Layers blend via height + slope masks
 * computed per-fragment, so adding texture fidelity costs zero geometry.
 *
 * Layer roster (per biome):
 *
 *   tropical / grassland → sand · grass · rock · (4th: mud)
 *   volcano              → sand · ash  · rock · LAVA STONE
 *   tundra / snow        → sand · grass · rock · SNOW
 *   desert               → sand · sand2 · rock · driftsand
 *
 * Blend masks:
 *
 *   sand   = smoothstep( 1.5, -0.5, h)              — anything near sea level
 *   grass  = (1 - sand) * (1 - rock) * lowAltMask   — mid altitudes, flat
 *   rock   = slopeMask + smoothstep(18, 28, h)*0.6  — steep OR high
 *   layer4 = biome-specific (lava in caldera bowls, snow above ~28m, etc.)
 *
 * All textures are OPTIONAL. Missing textures fall back to flat colors so a
 * fresh checkout with no PBR pack still renders cleanly. The vertex
 * altitude blend is preserved as a low-fi default.
 *
 * See `.agents/skills/islands-and-terrain/SKILL.md` §14 for the playbook.
 */

import * as THREE from 'three';

export type SplatBiomeId = 'tropical' | 'grassland' | 'volcano' | 'tundra' | 'desert';

export interface SplatLayerColors {
  sand: THREE.Color;
  grass: THREE.Color;
  rock: THREE.Color;
  /** Fourth layer — biome-specific (lava, snow, mud, drift-sand). */
  layer4: THREE.Color;
}

export interface SplatLayerTextures {
  diff?: THREE.Texture;
  nor?: THREE.Texture;
  rough?: THREE.Texture;
  ao?: THREE.Texture;
}

export interface SplatTexturePack {
  sand?: THREE.Texture | SplatLayerTextures;
  grass?: THREE.Texture | SplatLayerTextures;
  rock?: THREE.Texture | SplatLayerTextures;
  layer4?: THREE.Texture | SplatLayerTextures;
}

function asLayerTextures(v: THREE.Texture | SplatLayerTextures | undefined): SplatLayerTextures {
  if (!v) return {};
  if ((v as THREE.Texture).isTexture) return { diff: v as THREE.Texture };
  return v as SplatLayerTextures;
}

export interface SplatMaterialOptions {
  biome: SplatBiomeId;
  /** Fallback flat colors used when a layer texture is missing. */
  colors: SplatLayerColors;
  /** Optional PBR albedo textures, one per layer. */
  textures?: SplatTexturePack;
  /** Sun direction uniform (shared with the sky shader). */
  sunDir: THREE.Vector3;
  /** Sun color uniform (shared with the sky shader). */
  sunCol: THREE.Color;
  /** UV repeat across the whole island side. Default 24 = "tile every ~10m". */
  uvScale?: number;
}

const BIOME_LAYER4_HEIGHT_RANGE: Record<SplatBiomeId, [number, number]> = {
  tropical:  [-2, 2],     // mud near shore
  grassland: [-2, 2],
  volcano:   [-1, 6],     // lava stone in caldera bowl + low slopes
  tundra:    [22, 35],    // snow above 22m
  desert:    [ 6, 14],    // drift-sand on mid plateaus
};

/**
 * Build the splat ground material. Returns a `THREE.ShaderMaterial`
 * compatible with the existing `IslandSceneBuilder` chunk pipeline (replace
 * `makeBiomeMaterial()` callsites with this).
 */
export function makeSplatGroundMaterial(opts: SplatMaterialOptions): THREE.ShaderMaterial {
  const {
    biome,
    colors,
    textures = {},
    sunDir,
    sunCol,
    uvScale = 24,
  } = opts;

  const layer4Range = BIOME_LAYER4_HEIGHT_RANGE[biome];

  // Normalise: every layer becomes a {diff, nor, rough, ao} bag.
  const layers = {
    sand:   asLayerTextures(textures.sand),
    grass:  asLayerTextures(textures.grass),
    rock:   asLayerTextures(textures.rock),
    layer4: asLayerTextures(textures.layer4),
  };

  // Texture flags as #defines so unused samplers are dead-stripped.
  const defines: Record<string, string | number | boolean> = {};
  for (const [k, l] of Object.entries(layers)) {
    if (l.diff)  defines[`HAS_TEX_${k.toUpperCase()}`]      = '';
    if (l.nor)   defines[`HAS_NOR_${k.toUpperCase()}`]      = '';
    if (l.rough) defines[`HAS_ROUGH_${k.toUpperCase()}`]    = '';
    if (l.ao)    defines[`HAS_AO_${k.toUpperCase()}`]       = '';
  }

  // Configure all supplied textures with proper colour-space + tiling.
  const configureTexture = (tex: THREE.Texture | undefined, sRGB: boolean) => {
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = Math.max(tex.anisotropy ?? 1, 8);
    tex.needsUpdate = true;
  };
  for (const l of Object.values(layers)) {
    configureTexture(l.diff,  true);
    configureTexture(l.nor,   false);
    configureTexture(l.rough, false);
    configureTexture(l.ao,    false);
  }

  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      uColSand:   { value: colors.sand.clone()  },
      uColGrass:  { value: colors.grass.clone() },
      uColRock:   { value: colors.rock.clone()  },
      uColLayer4: { value: colors.layer4.clone() },
      uTexSand:    { value: layers.sand.diff   ?? null },
      uTexGrass:   { value: layers.grass.diff  ?? null },
      uTexRock:    { value: layers.rock.diff   ?? null },
      uTexLayer4:  { value: layers.layer4.diff ?? null },
      uNorSand:    { value: layers.sand.nor    ?? null },
      uNorGrass:   { value: layers.grass.nor   ?? null },
      uNorRock:    { value: layers.rock.nor    ?? null },
      uNorLayer4:  { value: layers.layer4.nor  ?? null },
      uRoughSand:  { value: layers.sand.rough  ?? null },
      uRoughGrass: { value: layers.grass.rough ?? null },
      uRoughRock:  { value: layers.rock.rough  ?? null },
      uRoughLayer4:{ value: layers.layer4.rough?? null },
      uAoSand:     { value: layers.sand.ao     ?? null },
      uAoGrass:    { value: layers.grass.ao    ?? null },
      uAoRock:     { value: layers.rock.ao     ?? null },
      uAoLayer4:   { value: layers.layer4.ao   ?? null },
      uUvScale:   { value: uvScale },
      uLayer4Lo:  { value: layer4Range[0] },
      uLayer4Hi:  { value: layer4Range[1] },
      uSunDir:    { value: sunDir },     // shared reference — updates from sky
      uSunCol:    { value: sunCol },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal   = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      #extension GL_OES_standard_derivatives : enable
      precision highp float;
      uniform vec3  uColSand, uColGrass, uColRock, uColLayer4;
      uniform sampler2D uTexSand,   uTexGrass,   uTexRock,   uTexLayer4;
      uniform sampler2D uNorSand,   uNorGrass,   uNorRock,   uNorLayer4;
      uniform sampler2D uRoughSand, uRoughGrass, uRoughRock, uRoughLayer4;
      uniform sampler2D uAoSand,    uAoGrass,    uAoRock,    uAoLayer4;
      uniform float uUvScale;
      uniform float uLayer4Lo, uLayer4Hi;
      uniform vec3  uSunDir;
      uniform vec3  uSunCol;
      varying vec3  vWorldPos;
      varying vec3  vNormal;

      // Tangent-space normal perturbation reconstructed from screen-space
      // derivatives — works without per-vertex tangent attributes.
      vec3 perturbNormal(vec3 N, vec3 viewPos, vec2 uv, vec3 mapN) {
        vec3 q0 = dFdx(viewPos), q1 = dFdy(viewPos);
        vec2 st0 = dFdx(uv),     st1 = dFdy(uv);
        vec3 q1perp = cross(q1, N);
        vec3 q0perp = cross(N, q0);
        vec3 T = q1perp * st0.x + q0perp * st1.x;
        vec3 B = q1perp * st0.y + q0perp * st1.y;
        float det = max(dot(T, T), dot(B, B));
        float scale = (det == 0.0) ? 0.0 : inversesqrt(det);
        return normalize(T * (mapN.x * scale) + B * (mapN.y * scale) + N * mapN.z);
      }

      vec3 sampleAlbedo(vec3 fallback, sampler2D t, vec2 uv, bool has) {
        return has ? texture2D(t, uv).rgb * fallback : fallback;
      }
      vec3 sampleNormal(sampler2D t, vec2 uv, bool has) {
        return has ? (texture2D(t, uv).xyz * 2.0 - 1.0) : vec3(0.0, 0.0, 1.0);
      }
      float sampleScalar(sampler2D t, vec2 uv, bool has, float fallback) {
        return has ? texture2D(t, uv).r : fallback;
      }

      void main() {
        vec2 uv = vWorldPos.xz / uUvScale;
        float h = vWorldPos.y;
        vec3  n = normalize(vNormal);
        float upDot = max(0.0, dot(n, vec3(0.0, 1.0, 0.0)));
        float slope = 1.0 - upDot;

        // Layer masks ---------------------------------------------------
        float mSand   = smoothstep(1.5, -0.5, h);
        float mRock   = clamp(smoothstep(0.4, 0.85, slope) +
                              smoothstep(18.0, 28.0, h) * 0.6, 0.0, 1.0);
        float mLayer4 = smoothstep(uLayer4Lo, (uLayer4Lo + uLayer4Hi) * 0.5, h)
                      * (1.0 - smoothstep((uLayer4Lo + uLayer4Hi) * 0.5, uLayer4Hi, h) * 0.5);
        float mGrass  = clamp(1.0 - mSand - mRock - mLayer4, 0.0, 1.0);

        // Texture availability flags ------------------------------------
        bool hSand=false,  hGrass=false,  hRock=false,  hL4=false;
        bool nSand=false,  nGrass=false,  nRock=false,  nL4=false;
        bool rSand=false,  rGrass=false,  rRock=false,  rL4=false;
        bool aSand=false,  aGrass=false,  aRock=false,  aL4=false;
        #ifdef HAS_TEX_SAND   hSand=true;  #endif
        #ifdef HAS_TEX_GRASS  hGrass=true; #endif
        #ifdef HAS_TEX_ROCK   hRock=true;  #endif
        #ifdef HAS_TEX_LAYER4 hL4=true;    #endif
        #ifdef HAS_NOR_SAND   nSand=true;  #endif
        #ifdef HAS_NOR_GRASS  nGrass=true; #endif
        #ifdef HAS_NOR_ROCK   nRock=true;  #endif
        #ifdef HAS_NOR_LAYER4 nL4=true;    #endif
        #ifdef HAS_ROUGH_SAND   rSand=true;  #endif
        #ifdef HAS_ROUGH_GRASS  rGrass=true; #endif
        #ifdef HAS_ROUGH_ROCK   rRock=true;  #endif
        #ifdef HAS_ROUGH_LAYER4 rL4=true;    #endif
        #ifdef HAS_AO_SAND   aSand=true;  #endif
        #ifdef HAS_AO_GRASS  aGrass=true; #endif
        #ifdef HAS_AO_ROCK   aRock=true;  #endif
        #ifdef HAS_AO_LAYER4 aL4=true;    #endif

        vec2 uvR = uv * 0.6; // rocks tile coarser

        // Albedo ---------------------------------------------------------
        vec3 cSand   = sampleAlbedo(uColSand,   uTexSand,   uv,  hSand);
        vec3 cGrass  = sampleAlbedo(uColGrass,  uTexGrass,  uv,  hGrass);
        vec3 cRock   = sampleAlbedo(uColRock,   uTexRock,   uvR, hRock);
        vec3 cLayer4 = sampleAlbedo(uColLayer4, uTexLayer4, uv,  hL4);

        // Normals (tangent-space, blended by mask) ----------------------
        vec3 mapN = sampleNormal(uNorSand,   uv,  nSand)  * mSand
                  + sampleNormal(uNorGrass,  uv,  nGrass) * mGrass
                  + sampleNormal(uNorRock,   uvR, nRock)  * mRock
                  + sampleNormal(uNorLayer4, uv,  nL4)    * mLayer4;
        // If no normals supplied at all, mapN ≈ vec3(0,0,1) per layer mix.
        vec3 N = perturbNormal(n, vWorldPos, uv, normalize(mapN + vec3(1e-5)));

        // AO blend ------------------------------------------------------
        float ao = sampleScalar(uAoSand,   uv,  aSand,  1.0) * mSand
                 + sampleScalar(uAoGrass,  uv,  aGrass, 1.0) * mGrass
                 + sampleScalar(uAoRock,   uvR, aRock,  1.0) * mRock
                 + sampleScalar(uAoLayer4, uv,  aL4,    1.0) * mLayer4;

        // Roughness blend (currently only used to tint specular peak) ---
        float rough = sampleScalar(uRoughSand,   uv,  rSand,  0.95) * mSand
                    + sampleScalar(uRoughGrass,  uv,  rGrass, 0.92) * mGrass
                    + sampleScalar(uRoughRock,   uvR, rRock,  0.85) * mRock
                    + sampleScalar(uRoughLayer4, uv,  rL4,    0.9 ) * mLayer4;

        vec3 color = cSand * mSand + cGrass * mGrass + cRock * mRock + cLayer4 * mLayer4;

        // Bumpy Lambert + tiny specular sheen on wet/smooth patches.
        vec3  L     = normalize(uSunDir);
        float ndl   = clamp(dot(N, L), 0.0, 1.0);
        vec3  V     = normalize(cameraPosition - vWorldPos);
        vec3  H     = normalize(L + V);
        float spec  = pow(max(0.0, dot(N, H)), mix(64.0, 4.0, rough)) * (1.0 - rough) * 0.25;
        vec3  lit   = color * (0.30 + 0.85 * ndl) * uSunCol * ao + uSunCol * spec;

        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });
}

/**
 * Default flat-color palette per biome. Used when no PBR texture pack is
 * loaded — produces the same look-and-feel the project shipped before, but
 * with the 4th biome-specific layer painted in.
 */
export const DEFAULT_BIOME_PALETTES: Record<SplatBiomeId, SplatLayerColors> = {
  tropical: {
    sand:   new THREE.Color(0xE8D9A8),
    grass:  new THREE.Color(0x4F8B3C),
    rock:   new THREE.Color(0x6F6457),
    layer4: new THREE.Color(0x6B4A2A), // mud
  },
  grassland: {
    sand:   new THREE.Color(0xD9C58A),
    grass:  new THREE.Color(0x5A8C3F),
    rock:   new THREE.Color(0x71665A),
    layer4: new THREE.Color(0x4A3826), // earth
  },
  volcano: {
    sand:   new THREE.Color(0x8C7A66),
    grass:  new THREE.Color(0x4F4A40), // dead grass / ash
    rock:   new THREE.Color(0x3A332E),
    layer4: new THREE.Color(0x2A1814), // LAVA STONE — basalt with cooled lava tinge
  },
  tundra: {
    sand:   new THREE.Color(0xBFB7A8),
    grass:  new THREE.Color(0x6E7A60),
    rock:   new THREE.Color(0x77716A),
    layer4: new THREE.Color(0xF0F4F7), // snow
  },
  desert: {
    sand:   new THREE.Color(0xE6CC91),
    grass:  new THREE.Color(0xB6A66A), // dry scrub
    rock:   new THREE.Color(0x8C7656),
    layer4: new THREE.Color(0xD8B97A), // drift sand
  },
};

/**
 * Convenience loader — fetches PBR textures for a biome from the Poly Haven
 * pack downloaded server-side by `server/polyhavenAssets.ts`.
 *
 *   /textures/ground/<biome>/<layer>_diff.jpg   (sRGB albedo)
 *   /textures/ground/<biome>/<layer>_nor.jpg    (linear OpenGL normal)
 *   /textures/ground/<biome>/<layer>_rough.jpg  (linear roughness)
 *   /textures/ground/<biome>/<layer>_ao.jpg     (linear AO)
 *
 * Missing files don't reject; the corresponding sampler is omitted via
 * `#define` so the shader cleanly falls back to flat color and an unbumped
 * Lambert. Idempotent — safe to call before the texture sync completes.
 */
export async function loadBiomeSplatTextures(biome: SplatBiomeId): Promise<SplatTexturePack> {
  const loader = new THREE.TextureLoader();
  const base = `/textures/ground/${biome}`;
  const layers: (keyof SplatTexturePack)[] = ['sand', 'grass', 'rock', 'layer4'];
  const kinds: Array<'diff' | 'nor' | 'rough' | 'ao'> = ['diff', 'nor', 'rough', 'ao'];

  const tryLoad = (url: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      loader.load(url, (t) => resolve(t), undefined, () => resolve(null));
    });

  const result: SplatTexturePack = {};
  await Promise.all(
    layers.map(async (layer) => {
      const bag: SplatLayerTextures = {};
      const [diff, nor, rough, ao] = await Promise.all(
        kinds.map((k) => tryLoad(`${base}/${layer}_${k}.jpg`))
      );
      if (diff)  bag.diff  = diff;
      if (nor)   bag.nor   = nor;
      if (rough) bag.rough = rough;
      if (ao)    bag.ao    = ao;
      // Only attach the layer if at least the diffuse loaded.
      if (bag.diff) result[layer] = bag;
    }),
  );
  return result;
}

/** One-call helper: build a fully-textured splat material for a biome. */
export async function makeBiomePBRGroundMaterial(
  biome: SplatBiomeId,
  sunDir: THREE.Vector3,
  sunCol: THREE.Color,
  uvScale = 24,
): Promise<THREE.ShaderMaterial> {
  const textures = await loadBiomeSplatTextures(biome);
  return makeSplatGroundMaterial({
    biome,
    colors: DEFAULT_BIOME_PALETTES[biome],
    textures,
    sunDir,
    sunCol,
    uvScale,
  });
}
