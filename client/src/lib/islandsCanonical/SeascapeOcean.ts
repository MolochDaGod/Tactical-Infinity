/**
 * SeascapeOcean — production water material adapted from Alexander Alekseev's
 * "Seascape" shader (Shadertoy Ms2SD1, CC BY-NC-SA 3.0). The original is a
 * full-screen ray-marcher. We can't use it as-is because the canonical island
 * scene also has terrain, ships and creatures rendered into the same depth
 * buffer. Instead we keep all of Alekseev's iconic math — `sea_octave`,
 * `map_detailed` for normals, `getSeaColor` with fresnel + Beer-style
 * extinction — and apply it to a real `PlaneGeometry` so it composites
 * correctly with the rest of the scene.
 *
 *  • Vertex stage runs `map()` with ITER_GEOMETRY = 3 octaves to displace.
 *  • Fragment stage runs `map_detailed()` with ITER_FRAGMENT = 5 octaves
 *    for the normal, then Alekseev's `getSeaColor` with our scene-supplied
 *    sun direction and sky-tint colour.
 *
 * Seafloor bottom and depth-band lookup helpers live in `SeaCreatures`.
 *
 * © Original GLSL: Alexander Alekseev (CC BY-NC-SA 3.0). Port + integration:
 *   Tethical, MIT-licensed against everything the project's licence permits.
 */

import * as THREE from 'three';

const VERT = `
  // ── Seascape geometry pass ──────────────────────────────────────────
  precision highp float;

  uniform float uTime;
  varying vec3  vWorldPos;
  varying vec2  vSeaUv;

  const int   ITER_GEOMETRY = 3;
  const float SEA_HEIGHT    = 0.6;
  const float SEA_CHOPPY    = 4.0;
  const float SEA_SPEED     = 0.8;
  const float SEA_FREQ      = 0.16;

  #define SEA_TIME (1.0 + uTime * SEA_SPEED)
  const mat2 octave_m = mat2(1.6, 1.2, -1.2, 1.6);

  float hash(vec2 p)  { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float sea_octave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv  = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(abs(1.0 - pow(abs(wv.x * wv.y), 0.65)), choppy);
  }
  float seaHeight(vec2 worldXz) {
    float freq = SEA_FREQ, amp = SEA_HEIGHT, choppy = SEA_CHOPPY;
    vec2 uv = worldXz; uv.x *= 0.75;
    float h = 0.0;
    for (int i = 0; i < ITER_GEOMETRY; i++) {
      float d  = sea_octave((uv + SEA_TIME) * freq, choppy);
            d += sea_octave((uv - SEA_TIME) * freq, choppy);
      h  += d * amp;
      uv  *= octave_m;
      freq *= 1.9;
      amp  *= 0.22;
      choppy = mix(choppy, 1.0, 0.2);
    }
    return h;
  }

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = seaHeight(wp.xz);
    wp.y += h;
    vWorldPos = wp.xyz;
    vSeaUv    = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = `
  // ── Seascape fragment pass ──────────────────────────────────────────
  precision highp float;

  uniform float uTime;
  uniform vec3  uSunDir;
  uniform vec3  uSeaBase;
  uniform vec3  uSeaTint;
  uniform vec3  uSkyTint;
  uniform vec3  uCameraPos;

  varying vec3 vWorldPos;
  varying vec2 vSeaUv;

  const int   ITER_FRAGMENT = 5;
  const float SEA_HEIGHT    = 0.6;
  const float SEA_CHOPPY    = 4.0;
  const float SEA_SPEED     = 0.8;
  const float SEA_FREQ      = 0.16;

  #define SEA_TIME (1.0 + uTime * SEA_SPEED)
  const mat2 octave_m = mat2(1.6, 1.2, -1.2, 1.6);

  float hash(vec2 p)  { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float sea_octave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv  = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(abs(1.0 - pow(abs(wv.x * wv.y), 0.65)), choppy);
  }
  float mapDetailed(vec3 p) {
    float freq = SEA_FREQ, amp = SEA_HEIGHT, choppy = SEA_CHOPPY;
    vec2 uv = p.xz; uv.x *= 0.75;
    float h = 0.0;
    for (int i = 0; i < ITER_FRAGMENT; i++) {
      float d  = sea_octave((uv + SEA_TIME) * freq, choppy);
            d += sea_octave((uv - SEA_TIME) * freq, choppy);
      h  += d * amp;
      uv  *= octave_m;
      freq *= 1.9;
      amp  *= 0.22;
      choppy = mix(choppy, 1.0, 0.2);
    }
    return p.y - h;
  }
  vec3 getNormal(vec3 p, float eps) {
    vec3 n;
    n.y = mapDetailed(p);
    n.x = mapDetailed(vec3(p.x + eps, p.y, p.z)) - n.y;
    n.z = mapDetailed(vec3(p.x, p.y, p.z + eps)) - n.y;
    n.y = eps;
    return normalize(n);
  }
  float diffuse(vec3 n, vec3 l, float p) { return pow(abs(dot(n, l) * 0.4 + 0.6), p); }
  float specular(vec3 n, vec3 l, vec3 e, float s) {
    float nrm = (s + 8.0) / (3.1415 * 8.0);
    return pow(abs(max(dot(reflect(e, n), l), 0.0)), s) * nrm;
  }
  vec3 skyTint(vec3 e) {
    e.y = max(e.y, 0.0);
    vec3 ret;
    ret.x = pow(1.0 - e.y, 2.0);
    ret.y = 1.0 - e.y;
    ret.z = 0.6 + (1.0 - e.y) * 0.4;
    return mix(ret, uSkyTint, 0.4);
  }
  vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {
    float fresnel = 1.0 - max(dot(n, -eye), 0.0);
    fresnel = pow(abs(fresnel), 3.0) * 0.65;
    vec3 reflected = skyTint(reflect(eye, n));
    vec3 refracted = uSeaBase + diffuse(n, l, 80.0) * uSeaTint * 0.12;
    vec3 color = mix(refracted, reflected, fresnel);
    float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
    color += uSeaTint * (p.y - SEA_HEIGHT) * 0.18 * atten;
    color += vec3(specular(n, l, eye, 60.0));
    return color;
  }

  void main() {
    vec3 eye  = normalize(vWorldPos - uCameraPos);
    vec3 dist = vWorldPos - uCameraPos;
    float epsNrm = max(0.0008, 0.0006 * length(dist));
    vec3 n = getNormal(vWorldPos, epsNrm);
    vec3 light = normalize(uSunDir);
    vec3 col = getSeaColor(vWorldPos, n, light, eye, dist);
    col = pow(abs(col), vec3(0.75));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface SeascapeOceanOptions {
  size: number;
  segments: number;
  sunDirection?: THREE.Vector3;
}

/**
 * SeascapeOcean — drop-in replacement for `DynamicOcean` that uses the
 * full Seascape colour model. Exposes the same `mesh` / `material` /
 * `update(time)` / `setSunPosition(dir)` / `dispose()` surface so it
 * slots into the existing `IslandSceneBuilder` wiring.
 */
export class SeascapeOcean {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly geometry: THREE.PlaneGeometry;

  constructor(opts: SeascapeOceanOptions) {
    this.geometry = new THREE.PlaneGeometry(opts.size, opts.size, opts.segments, opts.segments);
    this.geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: false,
      uniforms: {
        uTime:      { value: 0 },
        uSunDir:    { value: (opts.sunDirection ?? new THREE.Vector3(0, 1, 0.4)).clone().normalize() },
        uCameraPos: { value: new THREE.Vector3() },
        // Seascape's iconic teal-base + warm-foam tint, slightly desaturated
        // so it composites with our island sky and weather pass without
        // overpowering them.
        uSeaBase:   { value: new THREE.Color(0.10, 0.19, 0.22) },
        uSeaTint:   { value: new THREE.Color(0.80, 0.90, 0.60) },
        uSkyTint:   { value: new THREE.Color(0.55, 0.70, 0.95) },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'SeascapeOcean';
  }

  /** Per-frame update — call once with `(elapsedSec, camera)`. */
  update(timeSec: number, camera?: THREE.Camera) {
    this.material.uniforms.uTime.value = timeSec;
    if (camera) (this.material.uniforms.uCameraPos.value as THREE.Vector3).copy(camera.position);
  }

  /** Sync sun direction with the sky for matching specular highlights. */
  setSunPosition(direction: THREE.Vector3) {
    (this.material.uniforms.uSunDir.value as THREE.Vector3).copy(direction).normalize();
  }

  /** Tint sky reflection — pass the sky horizon colour so it matches. */
  setSkyTint(c: THREE.Color) {
    (this.material.uniforms.uSkyTint.value as THREE.Color).copy(c);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
