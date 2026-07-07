/**
 * BiomeTerrainMaterial — true-PBR splat-blended terrain material driven by
 * `IslandConfig.terrainPacks`. We use a stock `THREE.MeshStandardMaterial`
 * (so we get correct PBR lighting, IBL, shadow receive, fog, tonemapping for
 * free) and inject the splat-blend logic via `onBeforeCompile`.
 *
 * Three PolyHaven CC0 packs blend by altitude + slope:
 *   • sand   — beach / shore band            (low altitude)
 *   • ground — meadow / inland band          (default)
 *   • cliff  — high-altitude or steep slopes
 *
 * Each pack contributes albedo + normal + roughness. Where a pack has no
 * roughness map we fall back to a constant roughness value so the visual
 * stays grounded. Output is fully PBR — diffuse, normal-perturbed lighting,
 * and roughness all participate in the standard MeshStandardMaterial pipeline,
 * including AO from the renderer's environment map and the per-mesh shadow
 * receive set by the chunks builder.
 */
import * as THREE from 'three';
import { GROUND_LAYER_REGISTRY, loadGroundLayer, type LoadedGroundLayer } from '@/lib/sanctuaryIsle/groundLayers';
import type { IslandConfig } from './IslandConfig';

export interface BiomeTerrainMaterialResult {
  material: THREE.MeshStandardMaterial;
  setSun(direction: THREE.Vector3, color: THREE.Color): void;
  /**
   * Per-frame tick — feed `clock.getElapsedTime()` so animated effects
   * (currently the Scorched Sands ember pulse) advance smoothly. Cheap no-op
   * for biomes that don't use it.
   */
  tick(elapsed: number): void;
  dispose(): void;
}

function safeLoad(packId: string, fallback: string, repeat: number): LoadedGroundLayer {
  const def = GROUND_LAYER_REGISTRY[packId] ?? GROUND_LAYER_REGISTRY[fallback];
  return loadGroundLayer(def, { repeat, anisotropy: 8 });
}

export function createBiomeTerrainMaterial(
  config: IslandConfig,
  _sunDir: THREE.Vector3,
  _sunColor: THREE.Color,
): BiomeTerrainMaterialResult {
  const repeat = 32;
  const sand   = safeLoad(config.terrainPacks.sand,   'coast_sand_01',     repeat);
  const ground = safeLoad(config.terrainPacks.ground, 'rocky_terrain_02',  Math.round(repeat * 0.7));
  const cliff  = safeLoad(config.terrainPacks.cliff,  'rock_pitted_mossy', Math.round(repeat * 0.8));

  // Base: a real PBR material. The "ground" pack drives the default channels;
  // the splat injection in onBeforeCompile then mixes sand/cliff on top.
  const material = new THREE.MeshStandardMaterial({
    map:          ground.albedo,
    normalMap:    ground.normal ?? null,
    roughnessMap: ground.roughness ?? null,
    roughness:    1.0,
    metalness:    0.0,
    // Slight environment AO via renderer.envMap if the host scene supplies one.
    envMapIntensity: 0.6,
  });

  // Scorched Sands biome — port of iq's lava-crack pattern (Shadertoy XsX3RB)
  // baked into the desert terrain material. Cracks glow hot orange in the low
  // shore band and fade out with altitude. Other biomes get uIsScorched=0 and
  // pay zero cost (the GLSL branch dead-strips on the GPU).
  const isScorched = config.id === 'desert';

  // Frozen Expanse biome — port of iq's "Elevated" snow-accumulation pattern
  // (Shadertoy MdX3Rr) + Dave Hoskins' "Frozen Wasteland" ice-absorption tint
  // (Xls3D2). Adds a wavy snow band that thickens with altitude + faces-up
  // slopes, plus a cyan ice tint that pushes shadowed low ground toward blue.
  const isFrozen = config.id === 'arctic';

  // Grassland biomes — Temperate Highlands and Tropical Paradise both need
  // tufted grass blade detail, wind shimmer, and white-tipped highlights
  // (port of David Hoskins' "Rolling Hills" Shadertoy Xsf3zX, simplified to
  // a per-fragment colour modulation since we can't raymarch blade geometry
  // in a baked terrain material). uIsTropical picks the saturated emerald
  // palette; temperate falls back to Hoskins' duller olive.
  const isGrassland = config.id === 'tropical' || config.id === 'temperate';
  const isTropical  = config.id === 'tropical';

  // Custom uniforms for the extra splat layers + per-biome height tuning.
  const uniforms = {
    uSandMap:    { value: sand.albedo },
    uSandNorm:   { value: sand.normal ?? null },
    uSandRough:  { value: sand.roughness ?? null },
    uCliffMap:   { value: cliff.albedo },
    uCliffNorm:  { value: cliff.normal ?? null },
    uCliffRough: { value: cliff.roughness ?? null },
    uHasSandNorm:   { value: sand.normal     ? 1 : 0 },
    uHasCliffNorm:  { value: cliff.normal    ? 1 : 0 },
    uHasSandRough:  { value: sand.roughness  ? 1 : 0 },
    uHasCliffRough: { value: cliff.roughness ? 1 : 0 },
    uMaxHeight:   { value: config.maxHeight },
    uIsScorched:  { value: isScorched   ? 1.0 : 0.0 },
    uIsFrozen:    { value: isFrozen     ? 1.0 : 0.0 },
    uIsGrassland: { value: isGrassland  ? 1.0 : 0.0 },
    uIsTropical:  { value: isTropical   ? 1.0 : 0.0 },
    uTime:        { value: 0 },
  };

  // We need world position + world-normal + world-derived UVs in the fragment
  // for height/slope-driven blending. World-space vectors avoid recomputing
  // them from the model matrix in the fragment shader.
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // Vertex: pass world position and world normal through varyings.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vIslandWorldPos;
         varying vec3 vIslandWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         #ifdef USE_INSTANCING
           vIslandWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
         #else
           vIslandWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         #endif
         vIslandWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    // Fragment: replace the default `map`/`normal`/`roughnessmap` samples
    // with the height/slope-blended splat result. We piggy-back on the
    // standard chunks (`map_fragment`, `normal_fragment_maps`,
    // `roughnessmap_fragment`) so all the rest of MeshStandardMaterial's
    // PBR pipeline (lights, shadows, IBL, fog, tonemapping) runs unchanged.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vIslandWorldPos;
         varying vec3 vIslandWorldNormal;
         uniform sampler2D uSandMap;
         uniform sampler2D uSandNorm;
         uniform sampler2D uSandRough;
         uniform sampler2D uCliffMap;
         uniform sampler2D uCliffNorm;
         uniform sampler2D uCliffRough;
         uniform float uHasSandNorm, uHasCliffNorm;
         uniform float uHasSandRough, uHasCliffRough;
         uniform float uMaxHeight;
         uniform float uIsScorched;
         uniform float uIsFrozen;
         uniform float uIsGrassland;
         uniform float uIsTropical;
         uniform float uTime;

         // Triplanar-flavoured world XZ projection. Three packs are tiled at
         // *different* scales so seams between bands hide naturally.
         vec2 islandUv(float scale) { return vIslandWorldPos.xz * scale; }

         // ── Scorched Sands: ported from iq's "Lava" Shadertoy (XsX3RB) ────
         // Procedural value-noise replacement (no iChannel0 texture available
         // in this pipeline — we hash analytically instead). Output range 0..1.
         float scorchedHash(vec2 p) {
           p = fract(p * vec2(123.34, 456.21));
           p += dot(p, p + 45.32);
           return fract(p.x * p.y);
         }
         float scorchedNoise(vec2 x) {
           vec2 p = floor(x);
           vec2 f = fract(x);
           f = f * f * (3.0 - 2.0 * f);
           float a = scorchedHash(p);
           float b = scorchedHash(p + vec2(1.0, 0.0));
           float c = scorchedHash(p + vec2(0.0, 1.0));
           float d = scorchedHash(p + vec2(1.0, 1.0));
           return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
         }
         // iq's lava() — 4-octave fBm with 2.0x lacunarity, used to define the
         // crack web that hot lava bleeds through. Doubles as the wavy
         // snow-line modulator for the Frozen Expanse biome (same fBm shape,
         // different threshold).
         float scorchedLava(vec2 p) {
           p += vec2(2.0, 4.0);
           float f;
           f  = 0.5000 * scorchedNoise(p); p *= 2.02;
           f += 0.2500 * scorchedNoise(p); p *= 2.03;
           f += 0.1250 * scorchedNoise(p); p *= 2.01;
           f += 0.0625 * scorchedNoise(p);
           return f;
         }

         // ── Hoskins Rolling Hills (Xsf3zX) helpers ───────────────────────
         // Direct port of his Voronoi() — 3x3 cell scan returning vec2(weight, id).
         // Used for tufted grass clumping. Cheap: 9 hash calls, no texture fetch.
         vec2 hoskinsVoronoi(vec2 x) {
           vec2 p = floor(x);
           vec2 f = fract(x);
           float res = 100.0;
           float id  = 0.0;
           for (int j = -1; j <= 1; j++) {
             for (int i = -1; i <= 1; i++) {
               vec2 b = vec2(float(i), float(j));
               vec2 r = b - f + scorchedHash(p + b);
               float d = dot(r, r);
               if (d < res) { res = d; id = scorchedHash(p + b); }
             }
           }
           return vec2(max(0.4 - sqrt(res), 0.0), id);
         }
         // Hoskins' 3-octave FractalNoise — used to break up grass shading
         // so flat fields don't read as a single uniform green.
         float hoskinsFbm(vec2 xy) {
           float w = 0.7;
           float f = 0.0;
           for (int i = 0; i < 3; i++) {
             f += scorchedNoise(xy) * w;
             w *= 0.6;
             xy *= 2.0;
           }
           return f;
         }

         // ── Ben Quantock wet-sand (ldfXzS) helper ────────────────────────
         // Granite() = sum of |noise - 0.5| / 2^i across 5 octaves. Produces
         // ridged "tide-receded puddle" shapes when thresholded. We use it
         // both to mask wet patches in the shore band and to modulate the
         // specular sheen so puddles glint without making the whole beach
         // look plastic.
         float wetGranite(vec2 p) {
           return (
             abs(scorchedNoise(p *  1.0) - 0.5) /  1.0 +
             abs(scorchedNoise(p *  2.0) - 0.5) /  2.0 +
             abs(scorchedNoise(p *  4.0) - 0.5) /  4.0 +
             abs(scorchedNoise(p *  8.0) - 0.5) /  8.0 +
             abs(scorchedNoise(p * 16.0) - 0.5) / 16.0
           ) * (32.0 / 31.0);
         }
         // Combined wet-sand mask: lives in the low shore band, broken into
         // organic puddle shapes by wetGranite. Returns 0..1.
         float wetSandMask() {
           float shore = 1.0 - smoothstep(0.5, 3.2, vIslandWorldPos.y);
           // Puddles are most dramatic right at the wet-line, taper inland.
           float waterEdge = 1.0 - smoothstep(0.0, 1.8, vIslandWorldPos.y);
           float puddles = smoothstep(0.45, 0.62, wetGranite(vIslandWorldPos.xz * 0.18));
           // Always-wet thin band at the very water line + patchy puddles
           // higher up the beach. Multiplied by upDot so vertical sand
           // (rare but possible on undercut shores) doesn't read as wet.
           float upDot = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
           float upMask = smoothstep(0.55, 0.85, upDot);
           return clamp((puddles * shore + waterEdge * 0.85) * upMask, 0.0, 1.0);
         }

         // Returns vec3(beach, ground, cliff) weights summing to 1.
         vec3 islandSplatWeights() {
           float h = vIslandWorldPos.y;
           float beach    = 1.0 - smoothstep(1.5, 3.5, h);
           float upDot    = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
           float cliffAlt = smoothstep(uMaxHeight * 0.45, uMaxHeight * 0.85, h);
           float cliffSlp = 1.0 - smoothstep(0.55, 0.85, upDot);
           float cliff    = clamp(max(cliffAlt, cliffSlp), 0.0, 1.0);
           float groundW  = clamp(1.0 - beach - cliff, 0.0, 1.0);
           // Re-normalise after subtraction in case beach+cliff overflows.
           float total = max(beach + groundW + cliff, 1e-4);
           return vec3(beach, groundW, cliff) / total;
         }`,
      )
      // Albedo splat: replace MeshStandardMaterial's `map_fragment` chunk so
      // the diffuse texel is the blend, not just `texture2D(map, vUv)`.
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
         {
           vec3 wts = islandSplatWeights();
           vec4 sandTx   = texture2D(uSandMap,  islandUv(0.05));
           vec4 groundTx = texture2D(map,       islandUv(0.05 * 0.7));
           vec4 cliffTx  = texture2D(uCliffMap, islandUv(0.05 * 0.8));
           vec4 splat = sandTx * wts.x + groundTx * wts.y + cliffTx * wts.z;
           diffuseColor *= splat;
         }
         // ── Grasslands (Hoskins Xsf3zX) ─────────────────────────────────
         // Tropical Paradise + Temperate Highlands get tufted grass detail
         // painted over the ground splat band. We can't raymarch the actual
         // blade geometry like Hoskins does, but we can faithfully port his
         // colour pipeline: random base mix, FractalNoise shadowing, Voronoi
         // clumping, white-tipped highlights, sin/cos wind sway. The whole
         // block is gated by uIsGrassland so volcanic/arctic/desert pay 0.
         if (uIsGrassland > 0.5) {
           vec3 wts2  = islandSplatWeights();
           // Only paint where the ground splat actually shows through, on
           // upward-facing slopes, and below the cliff/snow line.
           float upDot   = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
           float upMask  = smoothstep(0.55, 0.85, upDot);
           float altOk   = 1.0 - smoothstep(uMaxHeight * 0.40, uMaxHeight * 0.70, vIslandWorldPos.y);
           float coverage = wts2.y * upMask * altOk;
           // Hoskins' wind-driven blade jitter — sin(time*2.3 + p.z) varies
           // the Voronoi sample point over time so clumps appear to sway.
           vec2 swayOffset = vec2(
             sin(uTime * 2.3 + 1.5 * vIslandWorldPos.z),
             sin(uTime * 3.6 + 1.5 * vIslandWorldPos.x)
           ) * 0.06;
           vec2 vor = hoskinsVoronoi(vIslandWorldPos.xz * 2.5 + swayOffset);
           // Per-biome base palette: tropical = saturated emerald (lush),
           // temperate = duller olive (Hoskins' original .0,.3,.0 → .2,.3,.0).
           vec3 grassA = mix(vec3(0.04, 0.22, 0.04), vec3(0.06, 0.30, 0.07), uIsTropical);
           vec3 grassB = mix(vec3(0.20, 0.30, 0.05), vec3(0.16, 0.34, 0.10), uIsTropical);
           vec3 baseGrass = mix(grassA, grassB, scorchedNoise(vIslandWorldPos.xz * 0.025));
           // Hoskins' shadow term: FractalNoise * 0.1 + 0.5, so big patches
           // dim/brighten as if cloud shadows were rolling overhead.
           float shade = hoskinsFbm(vIslandWorldPos.xz * 0.10) * 0.10 + 0.50;
           baseGrass *= shade * 1.6;
           // White-tipped blade highlight — Voronoi.x is the clump weight,
           // so squaring it isolates blade tips. Keeps tropical greener
           // (less white), temperate more sun-bleached.
           float tip = pow(vor.x, 4.0);
           vec3 tipCol = mix(vec3(0.55, 0.55, 0.42), vec3(0.62, 0.65, 0.45), uIsTropical);
           vec3 grassCol = mix(baseGrass, tipCol, tip * 0.55);
           // ID-driven per-clump tint variation — some clumps drier/yellower.
           grassCol *= mix(0.85, 1.10, vor.y);
           diffuseColor.rgb = mix(diffuseColor.rgb, grassCol, coverage * 0.85);
         }
         // ── Wet sand (Quantock ldfXzS) ──────────────────────────────────
         // Universal across biomes — every island has a beach, and a wet
         // shore band sells the water-line dramatically. Darkens the sand
         // (wet quartz is ~40% darker), shifts hue slightly cooler, and
         // breaks itself into puddle shapes via wetGranite().
         {
           float wts_beach = 1.0 - smoothstep(1.5, 3.5, vIslandWorldPos.y);
           float wet = wetSandMask() * wts_beach;
           // Wet sand colour: Quantock's albedo vec3(.5,.3,.13) cooled and
           // multiplied — keeps biome diffuse continuity instead of stamping
           // a brown patch on volcanic/arctic shores.
           vec3 wetTint = vec3(0.45, 0.42, 0.40);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetTint, wet);
         }
         // Frozen Expanse: paint snow over the splat result. Snow accumulates
         // with altitude (iq Elevated lines: smoothstep(55,80, pos.y/SC + 25*fbm))
         // and on upward-facing slopes; the fBm modulation breaks the linear
         // snow-line so it reads as wind-deposited drifts. Then push shadowed /
         // low ground toward cyan-blue (Hoskins' col *= vec3(d,d,1) absorption).
         if (uIsFrozen > 0.5) {
           float upDot   = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
           // Wavy altitude term — fBm broadens the band so it's never a flat ring.
           float altHi   = uMaxHeight * 0.55;
           float altLo   = uMaxHeight * 0.18;
           float wave    = (scorchedLava(vIslandWorldPos.xz * 0.04) - 0.5) * (uMaxHeight * 0.35);
           float altMask = smoothstep(altLo, altHi, vIslandWorldPos.y + wave);
           // Slope mask — flat tops collect snow, cliff faces stay bare rock.
           // Mirrors iq's e = smoothstep(1 - 0.5*h, 1 - 0.1*h, nor.y).
           float slope   = smoothstep(1.0 - 0.5 * altMask, 1.0 - 0.1 * altMask, upDot);
           // Coverage — also push some snow into the very low coastal sand band
           // so the shore reads as ice-rimmed, not bare summer beach.
           float shore   = (1.0 - smoothstep(0.5, 4.0, vIslandWorldPos.y)) * 0.45;
           float snow    = clamp(altMask * slope + shore, 0.0, 1.0);
           // Snow albedo with a faint blue cast (matches iq's 0.29*vec3(.62,.65,.7)).
           vec3 snowCol  = vec3(0.86, 0.90, 0.96);
           diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, snow);
           // Ice absorption tint — bare rock + shadowed crevices read cyan.
           // Stronger where there is no snow yet (rock visible) and on
           // downward-facing geometry (crevice/overhang).
           float crevice  = 1.0 - upDot;
           float iceTint  = (1.0 - snow) * (0.25 + 0.5 * crevice);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.86, 1.0), iceTint);
         }
         #endif`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
         {
           vec3 wts = islandSplatWeights();
           vec3 nSand   = uHasSandNorm  > 0.5 ? texture2D(uSandNorm,  islandUv(0.05)      ).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
           vec3 nGround = texture2D(normalMap, islandUv(0.05 * 0.7)).xyz * 2.0 - 1.0;
           vec3 nCliff  = uHasCliffNorm > 0.5 ? texture2D(uCliffNorm, islandUv(0.05 * 0.8)).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
           vec3 nLocal  = normalize(nSand * wts.x + nGround * wts.y + nCliff * wts.z);
           nLocal.xy *= normalScale;
           normal = normalize(tbn * nLocal);
         }
         #endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
         #ifdef USE_ROUGHNESSMAP
         {
           vec3 wts = islandSplatWeights();
           float rSand   = uHasSandRough  > 0.5 ? texture2D(uSandRough,  islandUv(0.05)).g       : 0.92;
           float rGround = texture2D(roughnessMap, islandUv(0.05 * 0.7)).g;
           float rCliff  = uHasCliffRough > 0.5 ? texture2D(uCliffRough, islandUv(0.05 * 0.8)).g : 0.85;
           roughnessFactor *= rSand * wts.x + rGround * wts.y + rCliff * wts.z;
           // Wet sand (Quantock ldfXzS): puddles in the shore band drop
           // roughness sharply so the sun gets a real specular pop on water-
           // glazed sand. Mixes toward 0.18 instead of 0.0 — true mirror
           // would clip in HDR; 0.18 reads as glossy-but-textured.
           {
             float wts_beach = 1.0 - smoothstep(1.5, 3.5, vIslandWorldPos.y);
             float wet = wetSandMask() * wts_beach;
             roughnessFactor = mix(roughnessFactor, 0.18, wet * 0.85);
           }
           // Frozen Expanse: snow-covered surfaces drop roughness toward 0.55
           // so the sun gets a soft satin highlight (matches Hoskins' SUN_COLOUR
           // rim spec). Recompute the same coverage mask used for the albedo.
           if (uIsFrozen > 0.5) {
             float upDot   = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
             float wave    = (scorchedLava(vIslandWorldPos.xz * 0.04) - 0.5) * (uMaxHeight * 0.35);
             float altMask = smoothstep(uMaxHeight * 0.18, uMaxHeight * 0.55, vIslandWorldPos.y + wave);
             float slope   = smoothstep(1.0 - 0.5 * altMask, 1.0 - 0.1 * altMask, upDot);
             float shore   = (1.0 - smoothstep(0.5, 4.0, vIslandWorldPos.y)) * 0.45;
             float snow    = clamp(altMask * slope + shore, 0.0, 1.0);
             roughnessFactor = mix(roughnessFactor, 0.55, snow);
           }
         }
         #endif`,
      )
      // Scorched Sands hot-crack emissive — adds the iq-lava orange glow into
      // totalEmissiveRadiance after the standard emissive chunk runs. Gated by
      // uIsScorched so non-desert biomes pay nothing visible.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // ── Wet sand fresnel sheen (Quantock ldfXzS) ──────────────────
         // Quantock's \`pow(1+dot(normal,ray), 5)\` Fresnel × sky reflection.
         // We don't have a true sky probe in the baked terrain material,
         // so we emit a soft warm-grey toward the sun-facing zenith colour
         // along the puddle rims. Routed through totalEmissiveRadiance so
         // it survives whatever lighting the scene has set up; capped low
         // (×0.35) so glassy puddles read as wet, not chrome.
         {
           float wts_beach = 1.0 - smoothstep(1.5, 3.5, vIslandWorldPos.y);
           float wet = wetSandMask() * wts_beach;
           if (wet > 0.001) {
             vec3 vDir   = normalize(vViewPosition); // fragment → camera
             vec3 nDir   = normalize(vIslandWorldNormal);
             float fres  = pow(1.0 - clamp(dot(nDir, vDir), 0.0, 1.0), 5.0);
             // Per-puddle specular modulation: drier patches glint less.
             float gloss = smoothstep(0.42, 0.65, wetGranite(vIslandWorldPos.xz * 0.18));
             vec3 skyTint = vec3(0.78, 0.84, 0.92);
             totalEmissiveRadiance += skyTint * fres * gloss * wet * 0.35;
           }
         }
         if (uIsScorched > 0.5) {
           // Crack pattern: iq's lava() at the same 0.1 spatial scale as his
           // shader; threshold smoothstep(0.5, 0.55, ·) gives a thin crack web.
           float lava = scorchedLava(vIslandWorldPos.xz * 0.1);
           float cracks = smoothstep(0.50, 0.58, lava);
           // Cracks are strongest near sea level (heat shimmer rising from the
           // shore band) and fade out by mid altitude. Slight upward-facing
           // bias so the glow sits in the ground plane, not on cliff faces.
           float lowBand   = 1.0 - smoothstep(1.0, 8.0, vIslandWorldPos.y);
           float upDot     = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
           float floorBias = smoothstep(0.55, 0.95, upDot);
           // Subtle pulse — embers brighten + dim on a slow heartbeat.
           float pulse     = 0.7 + 0.3 * sin(uTime * 1.7 + lava * 6.2831);
           // iq's hot-lava colour vec3(3.0, 0.61, 0.0), tempered for a baked
           // emissive contribution rather than a raw raymarched glow.
           vec3  hotColor  = vec3(3.0, 0.61, 0.0);
           vec3  emberCol  = hotColor * (cracks * lowBand * floorBias * pulse);
           totalEmissiveRadiance += emberCol;
           // Slight desaturation of the diffuse where cracks burn through, so
           // the surrounding rock reads as charred carbon, not painted orange.
           diffuseColor.rgb *= mix(vec3(1.0), vec3(0.35, 0.30, 0.28), cracks * lowBand);
         }
         // Frozen Expanse sparkle — high-frequency procedural specks on snow
         // surfaces, modulated by uTime so they twinkle subtly. Tiny additive
         // contribution; uses the same coverage mask as the albedo/roughness.
         if (uIsFrozen > 0.5) {
           float upDot   = clamp(dot(normalize(vIslandWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
           float wave    = (scorchedLava(vIslandWorldPos.xz * 0.04) - 0.5) * (uMaxHeight * 0.35);
           float altMask = smoothstep(uMaxHeight * 0.18, uMaxHeight * 0.55, vIslandWorldPos.y + wave);
           float slope   = smoothstep(1.0 - 0.5 * altMask, 1.0 - 0.1 * altMask, upDot);
           float shore   = (1.0 - smoothstep(0.5, 4.0, vIslandWorldPos.y)) * 0.45;
           float snow    = clamp(altMask * slope + shore, 0.0, 1.0);
           // High-frequency hash sparkle, gated to a tiny fraction of pixels.
           float sparkle = scorchedHash(floor(vIslandWorldPos.xz * 12.0) + floor(uTime * 1.7));
           sparkle = step(0.985, sparkle) * snow;
           totalEmissiveRadiance += vec3(0.55, 0.70, 0.95) * sparkle * 1.4;
         }`,
      );

    // Stash uniforms so setSun / dispose can find them back later.
    (material as unknown as { __islandUniforms: typeof uniforms }).__islandUniforms = uniforms;
  };

  return {
    material,
    // Sun direction/color are unused now (MeshStandardMaterial uses scene
    // lights + IBL automatically). Keep the API for caller compatibility.
    setSun(_dir, _color) { /* no-op — scene's DirectionalLight drives shading */ },
    tick(elapsed) {
      // The uniform object exists from construction; onBeforeCompile only
      // copies references via Object.assign, so writing here propagates to
      // the live shader.
      uniforms.uTime.value = elapsed;
    },
    dispose() {
      material.dispose();
      sand.dispose();
      ground.dispose();
      cliff.dispose();
    },
  };
}
