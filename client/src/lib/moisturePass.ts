// Light Moisture Pass — a heavily dialed-back adaptation of
// "Heartfelt" by Martijn Steinrucken (BigWings), 2017.
//   https://www.shadertoy.com/view/ltffzl
//   License: Creative Commons BY-NC-SA 3.0
//
// We use the technique (per-cell drop placement, sawtooth fall, trail blur,
// drop-derivative refraction) but strip out the heavy parts:
//   - no static drops layer (kills the "always-foggy glass" feel)
//   - no second drop layer
//   - no zoom oscillation, no lightning, no vignette, no full post-FX
//   - blur range halved (0.5..1.5 instead of 2..6)
//   - rain amount clamped low by default (0.18) and exposed as a uniform
// Result: a *light* moisture pass meant to sit on the camera "when
// necessary" — splash on the lens during heavy weather, near a waterfall,
// etc. Cheap enough to run continuously at 60fps.
//
// Usage:
//   import { MoisturePass, makeMoisturePass } from "@/lib/moisturePass";
//   const composer = new EffectComposer(renderer);
//   composer.addPass(new RenderPass(scene, camera));
//   const moisture = makeMoisturePass({ intensity: 0.2 });
//   composer.addPass(moisture);
//   // each frame: moisture.update(dt, { intensity });
//   composer.render();

import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export interface MoisturePassOptions {
  /** 0..1. 0 = dry, 1 = soaked. Default 0.2. Recommended <= 0.4 for "light moisture". */
  intensity?: number;
  /** Multiplier on drop count. Default 1. Halve for very subtle, double for heavier. */
  density?: number;
  /** Multiplier on refraction strength. Default 1. */
  refraction?: number;
  /** Multiplier on blur. Default 1. */
  blur?: number;
  /** Camera "lens" tint applied multiplicatively. Default white. */
  tint?: THREE.ColorRepresentation;
}

export const MoistureShader = {
  uniforms: {
    tDiffuse:    { value: null as THREE.Texture | null },
    uTime:       { value: 0 },
    uResolution: { value: new THREE.Vector2(1024, 1024) },
    uIntensity:  { value: 0.2 },
    uDensity:    { value: 1.0 },
    uRefraction: { value: 1.0 },
    uBlur:       { value: 1.0 },
    uTint:       { value: new THREE.Color(1, 1, 1) },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  // Adapted from Martijn Steinrucken's Heartfelt (CC BY-NC-SA 3.0).
  // ASCII-only comments inside the shader to avoid TS template-literal
  // backtick issues.
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float     uTime;
    uniform vec2      uResolution;
    uniform float     uIntensity;
    uniform float     uDensity;
    uniform float     uRefraction;
    uniform float     uBlur;
    uniform vec3      uTint;
    varying vec2      vUv;

    #define S(a, b, t) smoothstep(a, b, t)

    // Hash helpers (Dave Hoskins)
    vec3 N13(float p) {
      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
    }
    float N(float t) { return fract(sin(t * 12345.564) * 7658.76); }
    float Saw(float b, float t) { return S(0.0, b, t) * S(1.0, b, t); }

    // ONE drop layer (Heartfelt has two; we keep one for the "light" version)
    vec2 DropLayer(vec2 uv, float t) {
      vec2 UV = uv;
      uv.y += t * 0.75;
      vec2 a = vec2(6.0, 1.0);
      // Density cuts grid resolution: lower density => larger, sparser cells
      vec2 grid = a * 2.0 * mix(0.6, 1.4, clamp(uDensity, 0.0, 2.0) * 0.5);
      vec2 id = floor(uv * grid);
      float colShift = N(id.x);
      uv.y += colShift;
      id = floor(uv * grid);
      vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
      vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
      float x = n.x - 0.5;
      float y = UV.y * 20.0;
      float wiggle = sin(y + sin(y));
      x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
      x *= 0.7;
      float ti = fract(t + n.z);
      y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
      vec2 p = vec2(x, y);
      float d = length((st - p) * a.yx);
      float mainDrop = S(0.4, 0.0, d);
      float r = sqrt(S(1.0, y, st.y));
      float cd = abs(st.x - x);
      float trail = S(0.23 * r, 0.15 * r * r, cd);
      float trailFront = S(-0.02, 0.02, st.y - y);
      trail *= trailFront * r * r;
      y = UV.y;
      float trail2 = S(0.2 * r, 0.0, cd);
      float droplets = max(0.0, (sin(y * (1.0 - y) * 120.0) - st.y)) * trail2 * trailFront * n.z;
      y = fract(y * 10.0) + (st.y - 0.5);
      float dd = length(st - vec2(x, y));
      droplets = S(0.3, 0.0, dd);
      float m = mainDrop + droplets * r * trailFront;
      return vec2(m, trail);
    }

    void main() {
      // Aspect-correct UV for drop placement, but sample the source with vUv.
      float aspect = uResolution.x / max(uResolution.y, 1.0);
      vec2 uv = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
      vec2 UV = vUv;

      float t        = uTime * 0.18;
      float rain     = clamp(uIntensity, 0.0, 1.0);
      float layer    = S(0.0, 0.7, rain);

      vec2 c = DropLayer(uv, t) * layer;

      // Cheap normals via dFdx/dFdy — we tolerate slightly soft refraction
      // because we are deliberately a "light" pass.
      vec2 n = vec2(dFdx(c.x), dFdy(c.x)) * uRefraction * 0.6;

      float maxBlur = mix(0.5, 1.5, rain) * uBlur;
      float minBlur = 0.25 * uBlur;
      float focus   = mix(maxBlur - c.y, minBlur, S(0.1, 0.2, c.x));

      vec3 col = textureLod(tDiffuse, UV + n, focus).rgb;
      col *= uTint;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface MoisturePassController {
  pass: ShaderPass;
  setIntensity(v: number): void;
  setDensity(v: number): void;
  setRefraction(v: number): void;
  setBlur(v: number): void;
  setSize(w: number, h: number): void;
  update(dt: number, opts?: { intensity?: number }): void;
  /** Smoothly animate intensity toward target (per-second rate). */
  rampTo(target: number, ratePerSec?: number): void;
}

export function makeMoisturePass(opts: MoisturePassOptions = {}): MoisturePassController {
  const pass = new ShaderPass(MoistureShader);
  const u = pass.uniforms;
  u.uIntensity.value  = opts.intensity  ?? 0.2;
  u.uDensity.value    = opts.density    ?? 1.0;
  u.uRefraction.value = opts.refraction ?? 1.0;
  u.uBlur.value       = opts.blur       ?? 1.0;
  if (opts.tint) (u.uTint.value as THREE.Color).set(opts.tint);

  let rampTarget: number | null = null;
  let rampRate = 0.5;

  return {
    pass,
    setIntensity:  (v) => { u.uIntensity.value  = THREE.MathUtils.clamp(v, 0, 1); },
    setDensity:    (v) => { u.uDensity.value    = THREE.MathUtils.clamp(v, 0, 2); },
    setRefraction: (v) => { u.uRefraction.value = THREE.MathUtils.clamp(v, 0, 2); },
    setBlur:       (v) => { u.uBlur.value       = THREE.MathUtils.clamp(v, 0, 2); },
    setSize:       (w, h) => { (u.uResolution.value as THREE.Vector2).set(w, h); },
    rampTo:        (target, ratePerSec = 0.5) => { rampTarget = THREE.MathUtils.clamp(target, 0, 1); rampRate = ratePerSec; },
    update(dt, runtimeOpts) {
      u.uTime.value += dt;
      if (runtimeOpts?.intensity !== undefined) {
        u.uIntensity.value = THREE.MathUtils.clamp(runtimeOpts.intensity, 0, 1);
      } else if (rampTarget !== null) {
        const cur = u.uIntensity.value;
        const step = rampRate * dt;
        if (Math.abs(rampTarget - cur) <= step) {
          u.uIntensity.value = rampTarget;
          rampTarget = null;
        } else {
          u.uIntensity.value = cur + Math.sign(rampTarget - cur) * step;
        }
      }
    },
  };
}

// Backwards-compat alias if anyone wants the raw pass.
export const MoisturePass = ShaderPass;
