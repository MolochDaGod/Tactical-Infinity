/**
 * IslandSky — large sky dome with FBM-noise-driven clouds, lightning flash
 * uniform, time-of-day sun colour and a soft horizon gradient.
 *
 * Inspired by David Hoskins' "Weather" Shadertoy (CC BY-NC-SA), but rewritten
 * as a forward-shaded sky dome instead of a screen-space ray-march so it
 * composites cleanly with the rest of the scene at near-zero cost. The clouds
 * use cheap 2D FBM (procedural Hash + smoothed value noise), modulated by the
 * `uCloudCover` uniform.
 *
 * Public API:
 *   const sky = new IslandSky();
 *   scene.add(sky.mesh);
 *   sky.update(elapsedSeconds);
 *   sky.setWeather('storm');
 *   sky.setTimeOfDay('dusk');
 */

import * as THREE from 'three';

export type SkyWeather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'mist';
export type SkyTimeOfDay = 'dawn' | 'noon' | 'dusk' | 'night';

interface WeatherProfile {
  cloudCover: number;     // 0..1
  cloudSpeed: number;
  lightningChance: number;
  fog: number;
}

const WEATHER: Record<SkyWeather, WeatherProfile> = {
  clear:  { cloudCover: 0.10, cloudSpeed: 0.04, lightningChance: 0.0,  fog: 0.6 },
  cloudy: { cloudCover: 0.55, cloudSpeed: 0.08, lightningChance: 0.0,  fog: 0.9 },
  rain:   { cloudCover: 0.75, cloudSpeed: 0.12, lightningChance: 0.0,  fog: 1.4 },
  storm:  { cloudCover: 0.90, cloudSpeed: 0.20, lightningChance: 0.04, fog: 2.0 },
  mist:   { cloudCover: 0.30, cloudSpeed: 0.03, lightningChance: 0.0,  fog: 2.6 },
};

interface TodProfile {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  zenith: THREE.Color;
  horizon: THREE.Color;
  intensity: number;
}

const TOD: Record<SkyTimeOfDay, TodProfile> = {
  dawn:  { sunDir: new THREE.Vector3(0.9, 0.2, 0.4).normalize(), sunColor: new THREE.Color(0xffb37a), zenith: new THREE.Color(0x4b6aa0), horizon: new THREE.Color(0xff9a55), intensity: 0.85 },
  noon:  { sunDir: new THREE.Vector3(0.2, 0.95, 0.25).normalize(), sunColor: new THREE.Color(0xfff6e0), zenith: new THREE.Color(0x4a8ad8), horizon: new THREE.Color(0xa9d8ff), intensity: 1.30 },
  dusk:  { sunDir: new THREE.Vector3(-0.9, 0.2, 0.4).normalize(), sunColor: new THREE.Color(0xff7855), zenith: new THREE.Color(0x382858), horizon: new THREE.Color(0xff6655), intensity: 0.75 },
  night: { sunDir: new THREE.Vector3(0.2, -0.7, 0.6).normalize(), sunColor: new THREE.Color(0x6080a0), zenith: new THREE.Color(0x05080f), horizon: new THREE.Color(0x121830), intensity: 0.20 },
};

const VERT = `
  varying vec3 vWorldDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAG = `
  precision highp float;
  uniform float uTime;
  uniform float uCloudCover;
  uniform float uCloudSpeed;
  uniform float uLightning;
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform vec3  uZenith;
  uniform vec3  uHorizon;
  varying vec3  vWorldDir;

  // ── procedural value noise (cheap, good enough for clouds) ────────
  float hash(vec2 p)  { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

    // Sky gradient.
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, t));

    // Sun disc + halo.
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    sky += uSunColor * pow(sunDot, 800.0) * 4.0;
    sky += uSunColor * pow(sunDot,   8.0) * 0.35;

    // Clouds — flat-ish layer projected onto upper hemisphere.
    if (dir.y > 0.0) {
      vec2 puv = dir.xz / max(0.05, dir.y) * 0.6;
      puv += vec2(uTime * uCloudSpeed, uTime * uCloudSpeed * 0.6);
      float n = fbm(puv);
      float coverage = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover * 0.5, n);
      vec3  cloudCol = mix(vec3(0.18, 0.20, 0.24), vec3(1.0, 1.0, 1.0), 0.6);
      cloudCol += uSunColor * pow(sunDot, 4.0) * coverage * 0.6;
      sky = mix(sky, cloudCol, coverage * smoothstep(0.0, 0.3, dir.y));
    }

    // Lightning flash — a uniform additive term, driven by JS.
    sky += vec3(0.7, 0.8, 1.0) * uLightning;

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export interface IslandSkyOptions {
  radius?: number;
  weather?: SkyWeather;
  timeOfDay?: SkyTimeOfDay;
}

export class IslandSky {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private weather: SkyWeather;
  private tod: SkyTimeOfDay;
  private nextLightningT = 0;
  private flashUntil = 0;

  constructor(opts: IslandSkyOptions = {}) {
    const radius = opts.radius ?? 800;
    this.weather = opts.weather ?? 'clear';
    this.tod = opts.timeOfDay ?? 'noon';

    const w = WEATHER[this.weather];
    const t = TOD[this.tod];

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime:        { value: 0 },
        uCloudCover:  { value: w.cloudCover },
        uCloudSpeed:  { value: w.cloudSpeed },
        uLightning:   { value: 0 },
        uSunDir:      { value: t.sunDir.clone() },
        uSunColor:    { value: t.sunColor.clone() },
        uZenith:      { value: t.zenith.clone() },
        uHorizon:     { value: t.horizon.clone() },
      },
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  /** Returns a unit vector pointing at the sun for use by directional lights. */
  get sunDirection(): THREE.Vector3 { return this.material.uniforms.uSunDir.value as THREE.Vector3; }
  get sunColor():     THREE.Color   { return this.material.uniforms.uSunColor.value as THREE.Color; }
  get sunIntensity(): number        { return TOD[this.tod].intensity; }
  get cloudCover():   number        { return WEATHER[this.weather].cloudCover; }
  get fogStrength():  number        { return WEATHER[this.weather].fog; }
  get currentWeather(): SkyWeather  { return this.weather; }
  get currentTimeOfDay(): SkyTimeOfDay { return this.tod; }

  setWeather(w: SkyWeather) {
    this.weather = w;
    const p = WEATHER[w];
    this.material.uniforms.uCloudCover.value = p.cloudCover;
    this.material.uniforms.uCloudSpeed.value = p.cloudSpeed;
  }

  setTimeOfDay(tod: SkyTimeOfDay) {
    this.tod = tod;
    const t = TOD[tod];
    (this.material.uniforms.uSunDir.value   as THREE.Vector3).copy(t.sunDir);
    (this.material.uniforms.uSunColor.value as THREE.Color).copy(t.sunColor);
    (this.material.uniforms.uZenith.value   as THREE.Color).copy(t.zenith);
    (this.material.uniforms.uHorizon.value  as THREE.Color).copy(t.horizon);
  }

  update(elapsedSec: number, dt: number) {
    this.material.uniforms.uTime.value = elapsedSec;

    // Lightning state machine.
    const chance = WEATHER[this.weather].lightningChance;
    if (chance > 0) {
      if (elapsedSec >= this.nextLightningT) {
        this.flashUntil = elapsedSec + 0.18;
        this.nextLightningT = elapsedSec + 4 + Math.random() * 6 / Math.max(0.01, chance / 0.04);
      }
    }
    const flash = Math.max(0, this.flashUntil - elapsedSec) / 0.18;
    this.material.uniforms.uLightning.value = flash;
    void dt;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
