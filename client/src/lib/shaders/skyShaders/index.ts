/**
 * skyShaders — registry + Three.js wrapper for four vendored Shadertoy
 * fragments (Hoskins "Rolling Hills" / "Weather", IQ "Elevated", Spheroid).
 *
 * Each fragment is a fullscreen ray-marched / FBM scene that renders its
 * own world. They are NOT sky-dome shaders — wrapping them on a dome would
 * be nonsense. Instead `ShaderBackdrop` draws the chosen fragment on a
 * clip-space quad with `depthTest:false` / `depthWrite:false` and forces
 * `renderOrder = -1000`, so it composites *behind* the real island scene
 * as a moving painted backdrop.
 *
 * Usage on /islands:
 *
 *   const backdrop = new ShaderBackdrop('weather');
 *   scene.add(backdrop.mesh);
 *   // in animate():
 *   backdrop.update(elapsedSec);
 *   backdrop.setSize(w, h);
 *   // on unmount:
 *   backdrop.dispose();
 *
 * URL flag wiring lives in `pages/Islands.tsx` (`?shader=hills|spheroid|
 * elevated|weather`).
 */

import * as THREE from 'three';
import { ROLLING_HILLS_FRAG } from './rollingHills';
import { SPHEROID_FRAG }      from './spheroid';
import { ELEVATED_FRAG }      from './elevated';
import { WEATHER_FRAG }       from './weather';

export type SkyShaderId = 'hills' | 'spheroid' | 'elevated' | 'weather';

export interface SkyShaderDef {
  id: SkyShaderId;
  label: string;
  attribution: string;
  license: string;
  fragment: string;
  /** True if the shader samples iChannel0 (a noise texture). */
  needsNoise: boolean;
  /** True if the shader also samples iChannel2 (Elevated does, for detail). */
  needsNoise2: boolean;
}

export const SKY_SHADERS: Record<SkyShaderId, SkyShaderDef> = {
  hills: {
    id: 'hills',
    label: 'Rolling Hills (Hoskins)',
    attribution: 'David Hoskins, 2013',
    license: 'CC BY-NC-SA 3.0',
    fragment: ROLLING_HILLS_FRAG,
    needsNoise: false,
    needsNoise2: false,
  },
  spheroid: {
    id: 'spheroid',
    label: 'Spheroid Noise Sphere',
    attribution: 'Adapted Shadertoy fragment',
    license: 'CC BY-NC-SA 3.0',
    fragment: SPHEROID_FRAG,
    needsNoise: false,
    needsNoise2: false,
  },
  elevated: {
    id: 'elevated',
    label: 'Elevated Mountains (iq)',
    attribution: 'Inigo Quilez, 2013',
    license: 'CC BY-NC-SA 3.0',
    fragment: ELEVATED_FRAG,
    needsNoise: true,
    needsNoise2: true,
  },
  weather: {
    id: 'weather',
    label: 'Weather: Sea + Storm (Hoskins)',
    attribution: 'David Hoskins, 2014',
    license: 'CC BY-NC-SA 3.0',
    fragment: WEATHER_FRAG,
    needsNoise: true,
    needsNoise2: false,
  },
};

export function isSkyShaderId(s: string | null | undefined): s is SkyShaderId {
  return !!s && s in SKY_SHADERS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertex shader: clip-space fullscreen quad with vUv passthrough.
// position is expected to be in NDC (-1..1) — we use PlaneGeometry(2, 2).
// Skips view/projection so the quad stays fullscreen regardless of camera.
// ─────────────────────────────────────────────────────────────────────────────
const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0); // z = 1.0 → far plane
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Fragment header: declares the Shadertoy-style uniforms + vUv varying that
// the vendored fragments expect. Shadertoy auto-injects these; ShaderMaterial
// does not, so we prepend them ourselves. Sampler declarations are added
// per-shader based on the registry flags (avoid declaring unused samplers
// because some drivers warn).
// ─────────────────────────────────────────────────────────────────────────────
const COMMON_FRAG_HEADER = `
  precision highp float;
  uniform vec3  iResolution;
  uniform float iGlobalTime;
  uniform vec2  iMouse;
  varying vec2  vUv;
`;

function buildFragmentSource(def: SkyShaderDef): string {
  const samplers: string[] = [];
  if (def.needsNoise)  samplers.push('  uniform sampler2D iChannel0;');
  if (def.needsNoise2) samplers.push('  uniform sampler2D iChannel2;');
  return `${COMMON_FRAG_HEADER}${samplers.join('\n')}\n${def.fragment}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared procedural noise texture for shaders that read iChannel0 / iChannel2.
// 256² RGBA, repeating, mip-mapped — matches the typical Shadertoy noise tex.
// Built lazily, then cached for the lifetime of the page.
// ─────────────────────────────────────────────────────────────────────────────
let _noiseTex: THREE.DataTexture | null = null;

function getNoiseTexture(): THREE.DataTexture {
  if (_noiseTex) return _noiseTex;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  // Independent random channels — Shadertoy noise textures are pure RGBA noise.
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = (Math.random() * 256) | 0;
    data[i + 1] = (Math.random() * 256) | 0;
    data[i + 2] = (Math.random() * 256) | 0;
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  _noiseTex = tex;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShaderBackdrop — clip-space fullscreen mesh that renders one of the
// vendored Shadertoy fragments behind the rest of the scene.
// ─────────────────────────────────────────────────────────────────────────────
export class ShaderBackdrop {
  readonly id: SkyShaderId;
  readonly def: SkyShaderDef;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private startMs = performance.now();

  constructor(id: SkyShaderId) {
    this.id = id;
    this.def = SKY_SHADERS[id];

    const uniforms: Record<string, THREE.IUniform> = {
      iResolution: { value: new THREE.Vector3(1024, 1024, 1.0) },
      iGlobalTime: { value: 0.0 },
      iMouse:      { value: new THREE.Vector2(0.5, 0.5) },
    };

    if (this.def.needsNoise) {
      uniforms.iChannel0 = { value: getNoiseTexture() };
    }
    if (this.def.needsNoise2) {
      uniforms.iChannel2 = { value: getNoiseTexture() };
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader:   FULLSCREEN_VERT,
      fragmentShader: buildFragmentSource(this.def),
      uniforms,
      depthTest:  false,
      depthWrite: false,
      side:       THREE.FrontSide,
      transparent: false,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000; // draw first, behind everything
    this.mesh.name = `ShaderBackdrop:${id}`;
  }

  /** Update time (and optional mouse coords). Call once per frame. */
  update(elapsedSec?: number): void {
    const t = elapsedSec ?? (performance.now() - this.startMs) / 1000.0;
    (this.material.uniforms.iGlobalTime as { value: number }).value = t;
  }

  setSize(width: number, height: number): void {
    const res = this.material.uniforms.iResolution as { value: THREE.Vector3 };
    res.value.set(width, height, width / Math.max(1, height));
  }

  setMouse(uvX01: number, uvY01: number): void {
    const m = this.material.uniforms.iMouse as { value: THREE.Vector2 };
    // The shaders multiply by iResolution — convert UV [0..1] to pixel coords.
    const res = (this.material.uniforms.iResolution as { value: THREE.Vector3 }).value;
    m.value.set(uvX01 * res.x, uvY01 * res.y);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    // Note: the noise texture is shared across instances, don't dispose it.
  }
}
