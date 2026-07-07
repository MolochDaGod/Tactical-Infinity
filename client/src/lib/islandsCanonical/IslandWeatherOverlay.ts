/**
 * IslandWeatherOverlay — full-screen post-process pass that paints rain
 * streaks (in `rain`/`storm`) and a brief white flash (lightning) on top of
 * whatever the main scene rendered. Adapted from David Hoskins' "Weather"
 * Shadertoy rain term, simplified for runtime and rewritten as a Three.js
 * `ShaderPass`.
 *
 * Add it to an `EffectComposer` *after* the RenderPass and *before* tone
 * mapping/FXAA. Drive `uIntensity` and `uLightning` from the IslandSky.
 *
 * Pure render-state: doesn't read/modify anything outside its uniforms.
 */

import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { SkyWeather } from './IslandSky';

const SHADER = {
  uniforms: {
    tDiffuse:    { value: null as THREE.Texture | null },
    uTime:       { value: 0 },
    uIntensity:  { value: 0 },
    uLightning:  { value: 0 },
    uWindAngle:  { value: 0 },     // radians; tilt of streaks toward wind dir
    uMistAmount: { value: 0 },     // 0..1 — ground-hugging mist layer strength
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  // Rain post-process. Improvements over the previous flat-streak version,
  // adapting techniques from iq's "lightning storm" shader (Shadertoy Xd23zh):
  //  • Three parallax layers of wind-tilted streaks for depth, each with its
  //    own scale/speed/density, so the field reads as 3D rather than a 2D mesh.
  //  • Hash-based per-pixel dithering on the alpha to break visible banding.
  //  • Wind-driven shear: streaks lean toward uWindAngle instead of falling
  //    straight down (current overlay had zero wind response).
  //  • Lightning UV jitter (iq's `ro += ani.x*ani.x * shake` ported to screen
  //    space) — the whole frame trembles briefly during a strike.
  //  • Saturation + contrast pulse during lightning (iq's `mix(col, gray, -0.5)`
  //    combined with a vignette darken so storms feel cinematic.
  //  • Cool atmospheric tint that deepens with rain intensity, so heavy rain
  //    reads grey-blue-overcast even on bright sky frames.
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uLightning;
    uniform float uWindAngle;
    uniform float uMistAmount;
    uniform vec2  uResolution;
    varying vec2 vUv;

    float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float hash11(float n){ return fract(sin(n) * 43758.5453); }

    // Value-noise + 5-octave fBm — port of iq's \`noises()\` from the mountains
    // shader (Shadertoy Msf3zX). The original sampled a noise texture; we use
    // a procedural smoothstep-interpolated hash so the post-process stays
    // self-contained (no extra texture binding, no extra GPU memory).
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) - 0.5;
    }
    float fbm(vec2 p) {
      // iq loop: a += noise(p)/i; p = p*2.0 + tiny offset.
      float a = 0.0;
      float w = 0.5;
      for (int i = 0; i < 5; i++) {
        a += vnoise(p) * w;
        p  = p * 2.03 + vec2(0.13, 0.31);
        w *= 0.5;
      }
      return a;
    }

    // One layer of wind-tilted streaks. Returns added luminance for this pixel.
    // 'depth' controls scale (further = smaller, fewer drops, slower) so the
    // three layers stack into apparent parallax.
    float rainLayer(vec2 uv, float depth, float windTan) {
      // Shear UV so cells lean with the wind. Negative because rain falls down.
      uv.x += uv.y * windTan;
      // Scroll vertically — speed scales with intensity and inversely with depth.
      uv.y += uTime * (8.0 + 14.0 * uIntensity) / depth;
      // Lateral micro-jitter per row so streaks don't form perfect columns.
      uv.x += hash11(floor(uv.y)) * 0.5;

      vec2 cell  = floor(uv);
      vec2 fcell = fract(uv);
      float r = hash21(cell + depth * 7.31);
      // Density per layer — front layer is sparsest (big visible streaks),
      // back layers are denser (visual noise floor).
      float thresh = 0.96 - 0.07 * uIntensity - 0.015 * depth;
      float drop   = step(thresh, r);
      // Sharp top, soft bottom — gives a teardrop streak instead of a bar.
      float streak = drop
                   * smoothstep(0.00, 0.04, fcell.y)
                   * smoothstep(0.00, 0.45, 1.0 - fcell.y);
      // Horizontal sharpness — keep streaks thin.
      streak *= smoothstep(0.55, 0.32, abs(fcell.x - 0.5));
      return streak;
    }

    void main() {
      // Lightning camera-shake UV jitter (iq Xd23zh: \`ro += ani.x*ani.x*0.05*noise\`).
      // Cheap procedural shake — two decorrelated sin sums shifted by hash.
      vec2 sampleUv = vUv;
      if (uLightning > 0.001) {
        float k  = uLightning * uLightning;
        vec2 jit = vec2(
          sin(uTime * 47.0 + vUv.y * 13.0),
          cos(uTime * 53.0 + vUv.x * 11.0)
        ) * 0.0035 * k;
        sampleUv += jit;
      }
      vec4 col = texture2D(tDiffuse, sampleUv);

      if (uIntensity > 0.001) {
        // Aspect-corrected base UV space. 80 = front-layer cell density.
        vec2 base = vUv * vec2(uResolution.x / uResolution.y, 1.0) * 80.0;
        float windTan = tan(uWindAngle) * 0.55; // clamp the wildest tilts visually

        // Three parallax layers — front is biggest/slowest, back is smallest/fastest.
        float l0 = rainLayer(base * 1.00, 1.0, windTan);
        float l1 = rainLayer(base * 1.55 + 17.0, 1.6, windTan);
        float l2 = rainLayer(base * 2.30 + 41.0, 2.4, windTan);
        float streaks = (l0 * 1.0 + l1 * 0.65 + l2 * 0.45);

        // Per-pixel dither so the streak field doesn't band on dark backdrops.
        streaks *= 0.85 + 0.15 * hash21(gl_FragCoord.xy);

        vec3 streakCol = vec3(0.62, 0.72, 0.92);
        col.rgb += streakCol * streaks * uIntensity * 0.85;

        // Cool atmospheric tint: heavy rain pushes the whole frame toward
        // overcast grey-blue. iq's bgc * 0.2 idea, applied to the rendered scene.
        float wash = uIntensity * 0.18;
        col.rgb = mix(col.rgb, col.rgb * vec3(0.78, 0.85, 0.95), wash);
      }

      // Ground-hugging mist layer (port of iq Msf3zX \`clouds()\` + \`fog\`).
      //  • iq accumulated \`fog += test*clouds(p1)\` along a ray, then mapped
      //    it through \`f = smoothstep(0, 800, fog)\`. We can't raymarch in a
      //    post-pass, so we approximate: 5-octave fBm in screen space drifts
      //    horizontally with time (iq's \`time*8.0\` z-scroll), then a vertical
      //    weight pushes density toward the bottom of the screen — that's the
      //    \`-max(p.y, 0) * 0.00009\` height falloff in 2D form. Result reads
      //    as low-altitude mist sitting on the ground, exactly the failure
      //    mode the previous overlay had (mist did literally nothing).
      if (uMistAmount > 0.001) {
        // Aspect-corrected coordinates so swirls aren't egg-shaped on widescreens.
        vec2 mUv = vUv * vec2(uResolution.x / uResolution.y, 1.0);
        // Two scrolling fBm samples beat against each other for a billowing feel.
        float n1 = fbm(mUv * 3.0  + vec2(uTime * 0.040, uTime * 0.013));
        float n2 = fbm(mUv * 1.3  + vec2(-uTime * 0.018, uTime * 0.025));
        float swirl = 0.5 + 0.55 * n1 + 0.35 * n2;
        // Height falloff — strongest along the bottom 60% of the frame, fading
        // out toward the sky. Mirrors iq's altitude attenuation in 2D.
        float ground = smoothstep(0.85, 0.05, vUv.y);
        // Distance falloff — mist is a touch denser away from the screen
        // centre (proxy for "further from the camera through the depth axis").
        vec2 cUv = vUv - 0.5;
        float dist = smoothstep(0.0, 0.6, length(cUv));
        float density = clamp(swirl * (0.55 + 0.45 * dist) * ground, 0.0, 1.0);
        density *= uMistAmount;
        // iq's cloud palette \`vec3(0.70, 0.72, 0.70)\` plus a subtle warm rim
        // along the horizon line so morning mist catches a glow.
        vec3 mistCol = vec3(0.78, 0.80, 0.78);
        float horizon = exp(-pow((vUv.y - 0.55) * 6.0, 2.0));
        mistCol += vec3(0.06, 0.05, 0.03) * horizon;
        // Soft over-blend (avoids the additive blowout the rain streaks need).
        col.rgb = mix(col.rgb, mistCol, density);
        // Tiny luminance lift on the brightest mist pockets so they pop.
        col.rgb += mistCol * pow(density, 3.0) * 0.08;
      }

      // Lightning pulse: blue-white wash + saturation boost + vignette pulse.
      // Mirrors iq's \`col = mix(col, vec3(dot(col,.33)), -0.5)\` (inverse-mix
      // with luma is a saturation boost) and his vignette darken envelope.
      if (uLightning > 0.001) {
        col.rgb += vec3(0.9, 0.95, 1.0) * uLightning * 0.45;
        // Saturation boost.
        float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
        col.rgb = mix(col.rgb, vec3(lum), -0.4 * uLightning);
        // Vignette pulse — borders darken so the centre flash reads brighter.
        vec2 vUvC = vUv - 0.5;
        float vig = 1.0 - dot(vUvC, vUvC) * 1.4 * uLightning;
        col.rgb *= clamp(vig, 0.6, 1.0);
      }

      gl_FragColor = col;
    }
  `,
};

const INTENSITY: Record<SkyWeather, number> = {
  clear: 0, mist: 0, cloudy: 0, rain: 0.55, storm: 1.0,
};

// Mist amount per weather state. Mist weather is the headline case (0.85);
// other states get a faint baseline so transitions blend smoothly and
// overcast/storm scenes pick up a touch of low ground fog "for free".
const MIST_AMOUNT: Record<SkyWeather, number> = {
  clear: 0, mist: 0.85, cloudy: 0.18, rain: 0.25, storm: 0.40,
};

export class IslandWeatherOverlayPass extends ShaderPass {
  constructor() {
    super(SHADER);
  }

  setWeather(w: SkyWeather) {
    this.uniforms.uIntensity.value  = INTENSITY[w];
    this.uniforms.uMistAmount.value = MIST_AMOUNT[w];
  }

  /** Manual override for the mist layer (0..1). Ignored until next setWeather. */
  setMist(amount: number) {
    this.uniforms.uMistAmount.value = THREE.MathUtils.clamp(amount, 0, 1);
  }

  setLightning(v: number) {
    this.uniforms.uLightning.value = v;
  }

  setTime(t: number) {
    this.uniforms.uTime.value = t;
  }

  setResolution(w: number, h: number) {
    (this.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  /**
   * Set the wind direction so streaks lean with it. Accepts a 2D direction in
   * world XZ (any non-zero magnitude). Internally converted to a tilt angle
   * the shader uses to shear the streak UVs.
   */
  setWind(dirX: number, dirZ: number, strength = 1) {
    const mag = Math.hypot(dirX, dirZ);
    if (mag < 1e-4) {
      this.uniforms.uWindAngle.value = 0;
      return;
    }
    // Map XZ wind to a screen-space lean. Strong wind ≈ ±35°.
    const tilt = Math.atan2(dirX, -dirZ) * Math.min(1, strength);
    this.uniforms.uWindAngle.value = THREE.MathUtils.clamp(tilt * 0.35, -0.6, 0.6);
  }
}
