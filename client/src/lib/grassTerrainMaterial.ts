/**
 * grassTerrainMaterial.ts
 *
 * Adds a Voronoi grass-blade-tip overlay to any terrain material that uses
 * `vertexColors: true`. Inspired by the David Hoskins "Rolling Hills" Shadertoy
 * (https://www.shadertoy.com/view/Xsf3zX) — we keep just the grass colouring
 * idea (Voronoi cells + per-cell hash + base→tip blend) and skip the volumetric
 * raymarched blades. The vertex-colour-green check means sand / rock / snow
 * pass straight through unchanged; only the green grass tiles get reshaped.
 *
 * Wires by patching the existing material via `onBeforeCompile` so Three's
 * lighting + shadow pipeline is preserved.
 *
 * Usage:
 *   const mat = new THREE.MeshStandardMaterial({ vertexColors: true, ... });
 *   enhanceWithGrassShader(mat, { windSpeed: 1.2 });
 *
 * A singleton RAF loop ticks the `uTime` uniform on every patched material, so
 * callers don't need to plumb per-frame updates.
 */

import * as THREE from 'three';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GrassShaderOptions {
  /** Voronoi cell density. Higher = smaller cells = finer grass detail. */
  cellScale?:    number;   // default 6.0 (cells per world unit)
  /** Soil-noise scale used for darker mossy patches. */
  soilScale?:    number;   // default 0.18
  /** Strength of the Voronoi tip highlight (0..1). */
  tipStrength?:  number;   // default 0.55
  /** Wind speed driving the per-frame hue/brightness wobble. */
  windSpeed?:    number;   // default 0.9
  /** Tip colour for grass blades. */
  tipColor?:     THREE.Color;
  /** Shadow / root colour mixed into the cell base. */
  rootColor?:    THREE.Color;
  /** Maximum tint strength (0..1). 1 = full override of vertex colour. */
  maxTint?:      number;   // default 0.85
}

const DEFAULTS: Required<GrassShaderOptions> = {
  cellScale:   6.0,
  soilScale:   0.18,
  tipStrength: 0.55,
  windSpeed:   0.9,
  tipColor:    new THREE.Color(0xb6d97a),
  rootColor:   new THREE.Color(0x1f3a14),
  maxTint:     0.85,
};

// ─── Singleton time tick ─────────────────────────────────────────────────────

const _timeUniforms: { value: number }[] = [];
let _rafStarted = false;
const _start = performance.now();

function _ensureTickLoop() {
  if (_rafStarted) return;
  _rafStarted = true;
  const tick = () => {
    const t = (performance.now() - _start) * 0.001;
    for (let i = 0; i < _timeUniforms.length; i++) _timeUniforms[i].value = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─── Enhance a material in place ─────────────────────────────────────────────

/**
 * Patch a terrain material so its grass-green vertex-colour areas get a
 * Voronoi grass-blade-tip shader, while non-green areas (sand / rock / snow)
 * pass through untouched. Returns the same material for chaining.
 */
export function enhanceWithGrassShader<
  M extends THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial
>(material: M, opts: GrassShaderOptions = {}): M {
  const o = { ...DEFAULTS, ...opts };

  // Make sure vertex colours are on — required for our green mask.
  material.vertexColors = true;

  const uTime      = { value: 0 };
  const uCellScale = { value: o.cellScale };
  const uSoilScale = { value: o.soilScale };
  const uTipStr    = { value: o.tipStrength };
  const uWindSpeed = { value: o.windSpeed };
  const uTipColor  = { value: o.tipColor.clone() };
  const uRootColor = { value: o.rootColor.clone() };
  const uMaxTint   = { value: o.maxTint };

  _timeUniforms.push(uTime);
  _ensureTickLoop();

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);

    shader.uniforms.uTime      = uTime;
    shader.uniforms.uCellScale = uCellScale;
    shader.uniforms.uSoilScale = uSoilScale;
    shader.uniforms.uTipStr    = uTipStr;
    shader.uniforms.uWindSpeed = uWindSpeed;
    shader.uniforms.uTipColor  = uTipColor;
    shader.uniforms.uRootColor = uRootColor;
    shader.uniforms.uMaxTint   = uMaxTint;

    // ── Vertex: forward world XZ ────────────────────────────────────────────
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vGrassWorldPos;
        varying vec3 vGrassObjectPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vGrassWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vGrassWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        vGrassObjectPos = transformed;`
      );

    // The standard vertex shader chunks include <worldpos_vertex> only when
    // shadows are on. Inject a guaranteed copy before <project_vertex> so we
    // always have vGrassWorldPos populated.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#ifndef USE_SHADOWMAP
        #ifdef USE_INSTANCING
          vGrassWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vGrassWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
      #endif
      #include <project_vertex>`
    );

    // ── Fragment: Voronoi + noise blade-tip overlay on green vertex colour ─
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uCellScale;
      uniform float uSoilScale;
      uniform float uTipStr;
      uniform float uWindSpeed;
      uniform vec3  uTipColor;
      uniform vec3  uRootColor;
      uniform float uMaxTint;
      varying vec3  vGrassWorldPos;
      varying vec3  vGrassObjectPos;

      float gtmHash(vec2 p) {
        p = fract(p / vec2(3.07965, 7.4235));
        p += dot(p.xy, p.yx + 19.19);
        return fract(p.x * p.y);
      }
      float gtmNoise(vec2 x) {
        vec2 p = floor(x);
        vec2 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        float n = p.x + p.y * 57.0;
        return mix(mix(gtmHash(vec2(n, 0.0)), gtmHash(vec2(n + 1.0, 0.0)), f.x),
                   mix(gtmHash(vec2(n + 57.0, 0.0)), gtmHash(vec2(n + 58.0, 0.0)), f.x), f.y);
      }
      float gtmFbm(vec2 p) {
        float w = 0.55;
        float f = 0.0;
        for (int i = 0; i < 3; i++) {
          f += gtmNoise(p) * w;
          w *= 0.55;
          p *= 2.1;
        }
        return f;
      }
      // 2-component Voronoi: x = "tip strength" (0..0.4), y = per-cell hash id.
      vec2 gtmVoronoi(vec2 x) {
        vec2 p = floor(x);
        vec2 f = fract(x);
        float res = 100.0;
        float id  = 0.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 b = vec2(float(i), float(j));
            vec2 r = b - f + gtmHash(p + b);
            float d = dot(r, r);
            if (d < res) {
              res = d;
              id  = gtmHash(p + b);
            }
          }
        }
        return vec2(max(0.4 - sqrt(res), 0.0), id);
      }`
    );

    // Inject right after diffuseColor is assembled from vColor + map.
    // <color_fragment> sets `diffuseColor.rgb *= vColor;` when vertex colours
    // are on. We piggy-back after that.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>

      // Detect grass: vertex colour is green-dominant and not too bright.
      // (Sand is yellow; rock is grey-brown; snow is white. None pass this.)
      float gMask = 0.0;
      {
        vec3 vc = diffuseColor.rgb;
        float green   = vc.g;
        float greenness = green - max(vc.r, vc.b);
        // Strong grass mask in [0..1].
        gMask = smoothstep(0.02, 0.18, greenness)
              * smoothstep(0.05, 0.20, green)
              * (1.0 - smoothstep(0.55, 0.85, max(max(vc.r, vc.g), vc.b))); // skip snow
      }

      if (gMask > 0.001) {
        vec2 wxz = vGrassWorldPos.xz;

        // Animate Voronoi UVs gently with wind so blade tips shimmer / sway.
        float wind = uTime * uWindSpeed;
        vec2 windDrift = vec2(sin(wxz.y * 0.4 + wind), cos(wxz.x * 0.4 + wind * 0.83)) * 0.06;
        vec2 cellUV = wxz * uCellScale + windDrift;

        vec2 vor = gtmVoronoi(cellUV);
        // Distance from cell centre — bright at tips, dark at roots.
        float tipMix = clamp(vor.x * 2.5, 0.0, 1.0);
        // Per-cell hue jitter via the cell ID hash.
        float idShift = (vor.y - 0.5) * 0.18;

        // Soil / moss patches — fbm at lower frequency, darker in valleys.
        float soil = gtmFbm(wxz * uSoilScale + 13.7);
        float soilDark = smoothstep(0.65, 0.95, 1.0 - soil) * 0.35;

        // Build the grass colour: root → tip with per-cell hue shift,
        // then darken the soil dips slightly.
        vec3 grass = mix(uRootColor, uTipColor, tipMix);
        grass.r += idShift * 0.10;
        grass.g += idShift * 0.18;
        grass.b += idShift * 0.05;
        grass *= (1.0 - soilDark);

        // Tip highlight pop driven by uTipStr.
        grass += uTipColor * pow(tipMix, 4.0) * uTipStr;

        // Blend back over the original vertex-coloured diffuse, weighted by
        // the green mask and clamped by uMaxTint so we never fully erase the
        // biome tint underneath.
        float w = gMask * uMaxTint;
        diffuseColor.rgb = mix(diffuseColor.rgb, grass, w);
      }
      `
    );
  };

  material.needsUpdate = true;
  material.userData.isGrassEnhanced = true;
  return material;
}
