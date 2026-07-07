import * as THREE from 'three';

export const toonWaterVertex = /* glsl */ `
uniform float uTime;
uniform float uWaveAmp;
uniform float uWaveSpeed;
uniform float uIslandRadius;

varying vec3  vWorldPos;
varying float vDist;
varying float vElevation;
varying vec2  vUv;
varying vec3  vNormal;

vec3 gerstnerWave(vec2 pos, float amp, float freq, float speed, vec2 dir, float steep, float t) {
  float phase = dot(dir, pos) * freq + t * speed;
  float s = sin(phase);
  float c = cos(phase);
  float q = steep / (freq * amp * 6.0 + 0.001);
  return vec3(
    q * amp * dir.x * c,
    amp * s,
    q * amp * dir.y * c
  );
}

void main() {
  vUv = uv;
  vec3 pos = position;
  float r = length(pos.xz);
  vDist = r;

  float blend = smoothstep(uIslandRadius, uIslandRadius + 10.0, r);
  float calmZone = smoothstep(uIslandRadius, uIslandRadius + 55.0, r);
  float ampScale = blend * mix(0.06, 1.0, calmZone);

  float spd = uWaveSpeed;
  float amp = uWaveAmp;
  float t = uTime;

  vec3 d = vec3(0.0);
  d += gerstnerWave(pos.xz, amp * 1.0,  0.04,  spd * 0.7, normalize(vec2(1.0, 0.3)),  0.6, t);
  d += gerstnerWave(pos.xz, amp * 0.5,  0.07,  spd * 1.1, normalize(vec2(-0.4, 1.0)), 0.5, t);
  d += gerstnerWave(pos.xz, amp * 0.25, 0.12,  spd * 1.5, normalize(vec2(0.7, -0.6)), 0.4, t);
  d += gerstnerWave(pos.xz, amp * 0.12, 0.22,  spd * 2.0, normalize(vec2(-0.8, -0.3)),0.3, t);
  d += gerstnerWave(pos.xz, amp * 0.06, 0.35,  spd * 2.8, normalize(vec2(0.3, 0.9)),  0.2, t);

  d *= ampScale;
  pos += d;
  vElevation = d.y;

  float eps = 0.5;
  vec3 dX = vec3(0.0);
  dX += gerstnerWave(pos.xz + vec2(eps, 0.0), amp*1.0, 0.04, spd*0.7, normalize(vec2(1.0,0.3)), 0.6, t);
  dX += gerstnerWave(pos.xz + vec2(eps, 0.0), amp*0.5, 0.07, spd*1.1, normalize(vec2(-0.4,1.0)),0.5, t);
  dX += gerstnerWave(pos.xz + vec2(eps, 0.0), amp*0.25,0.12, spd*1.5, normalize(vec2(0.7,-0.6)),0.4, t);
  vec3 dZ = vec3(0.0);
  dZ += gerstnerWave(pos.xz + vec2(0.0, eps), amp*1.0, 0.04, spd*0.7, normalize(vec2(1.0,0.3)), 0.6, t);
  dZ += gerstnerWave(pos.xz + vec2(0.0, eps), amp*0.5, 0.07, spd*1.1, normalize(vec2(-0.4,1.0)),0.5, t);
  dZ += gerstnerWave(pos.xz + vec2(0.0, eps), amp*0.25,0.12, spd*1.5, normalize(vec2(0.7,-0.6)),0.4, t);

  vec3 tangent  = normalize(vec3(eps, (dX.y - d.y), 0.0));
  vec3 binormal = normalize(vec3(0.0, (dZ.y - d.y), eps));
  vNormal = normalize(cross(binormal, tangent));

  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const toonWaterFragment = /* glsl */ `
uniform float uTime;
uniform vec3  uColorDeep;
uniform vec3  uColorMid;
uniform vec3  uColorShallow;
uniform vec3  uColorFoam;
uniform vec3  uColorCrest;
uniform float uIslandRadius;
uniform float uFoamWidth;
uniform float uToonBands;

varying vec3  vWorldPos;
varying float vDist;
varying float vElevation;
varying vec2  vUv;
varying vec3  vNormal;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),         hash(i + vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)),hash(i + vec2(1,1)), f.x), f.y);
}
float fbm3(vec2 p) {
  return vnoise(p) * 0.5 + vnoise(p * 2.1 + 5.3) * 0.3 + vnoise(p * 4.3 + 9.7) * 0.2;
}

float ggxSpec(vec3 N, vec3 H, float roughness) {
  float a2 = roughness * roughness;
  a2 *= a2;
  float NdH = max(dot(N, H), 0.0);
  float denom = NdH * NdH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * denom * denom + 0.0001);
}

void main() {
  float t = clamp((vDist - uIslandRadius) / 100.0, 0.0, 1.0);

  vec3 col;
  if (t < 0.3) {
    col = mix(uColorShallow, uColorMid, t / 0.3);
  } else if (t < 0.65) {
    col = mix(uColorMid, uColorDeep, (t - 0.3) / 0.35);
  } else {
    col = uColorDeep;
  }

  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  vec2 fw1 = vWorldPos.xz * 0.04  + vec2(uTime * 0.035, uTime * 0.02);
  vec2 fw2 = vWorldPos.xz * 0.028 - vec2(uTime * 0.018, uTime * 0.03);
  vec2 fw3 = vWorldPos.xz * 0.065 + vec2(uTime * 0.012, -uTime * 0.025);

  float n1 = fbm3(fw1);
  float n2 = fbm3(fw2);
  float n3 = fbm3(fw3);
  float foamNoise = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;

  vec3 N = normalize(vNormal);
  vec3 microN = normalize(vec3(
    (fbm3(fw1 + 0.02) - fbm3(fw1 - 0.02)) * 1.5,
    1.0,
    (fbm3(fw2 + 0.02) - fbm3(fw2 - 0.02)) * 1.5
  ));
  N = normalize(mix(N, microN, 0.35));

  float shoreInner = uIslandRadius;
  float shoreOuter = uIslandRadius + uFoamWidth;

  float shoreDist = smoothstep(shoreInner - 2.0, shoreInner, vDist);
  float shoreEnd  = 1.0 - smoothstep(shoreOuter - 1.0, shoreOuter + 2.0, vDist);
  float shoreMask = shoreDist * shoreEnd;

  float foamDiss = fbm3(vWorldPos.xz * 0.12 + vec2(uTime * 0.04, 0.0));
  float foamEdge = smoothstep(0.35, 0.65, foamDiss);
  float shoreFoam = shoreMask * mix(0.4, 1.0, foamEdge);

  float stripeUv = vDist * 0.08 - uTime * 0.12;
  float stripe = smoothstep(0.45, 0.65, fract(stripeUv)) * smoothstep(0.85, 0.65, fract(stripeUv));
  float stripeFade = smoothstep(shoreOuter + 8.0, shoreInner + 3.0, vDist);
  float foamStripe = stripe * stripeFade * 0.35;

  float crestFoam = smoothstep(0.06, 0.14, vElevation) *
                    smoothstep(uIslandRadius + 10.0, uIslandRadius + 25.0, vDist) * 0.3;
  float scatterFoam = smoothstep(0.65, 0.8, foamNoise) *
                      (1.0 - smoothstep(shoreOuter, shoreOuter + 25.0, vDist)) * 0.25;

  float totalFoam = clamp(shoreFoam + foamStripe + crestFoam + scatterFoam, 0.0, 1.0);
  totalFoam = totalFoam * totalFoam * (3.0 - 2.0 * totalFoam);

  col = mix(col, uColorFoam, totalFoam);

  vec3 sun = normalize(vec3(0.55, 0.90, 0.35));
  vec3 H = normalize(sun + viewDir);
  float spec = ggxSpec(N, H, 0.12) * 0.6;
  float softSpec = ggxSpec(N, H, 0.35) * 0.2;
  col += uColorCrest * (spec + softSpec);

  float NdV = max(dot(N, viewDir), 0.0);
  float fresnel = pow(1.0 - NdV, 4.0) * 0.35;
  vec3 skyCol = vec3(0.45, 0.62, 0.82);
  col = mix(col, skyCol, fresnel);

  float NdL = max(dot(N, sun), 0.0);
  float sss = pow(clamp(dot(viewDir, -sun + N * 0.4), 0.0, 1.0), 3.0) * 0.15;
  vec3 sssColor = vec3(0.05, 0.35, 0.32);
  col += sssColor * sss * smoothstep(uIslandRadius + 5.0, uIslandRadius + 30.0, vDist);

  float causticScale = 0.15;
  float c1 = fbm3(vWorldPos.xz * causticScale + uTime * 0.06);
  float c2 = fbm3(vWorldPos.xz * causticScale * 1.3 - uTime * 0.04);
  float caustic = pow(max(c1 * c2, 0.0), 0.5) * 0.15;
  float causticMask = smoothstep(shoreInner - 3.0, shoreInner + 5.0, vDist) *
                      (1.0 - smoothstep(shoreInner + 5.0, shoreInner + 25.0, vDist));
  col += vec3(0.15, 0.35, 0.30) * caustic * causticMask;

  col += vec3(0.012, 0.008, 0.005) * NdL;

  float alpha = mix(0.82, 0.96, smoothstep(0.0, 50.0, vDist - uIslandRadius));
  alpha = mix(alpha, 0.94, totalFoam);
  alpha = mix(alpha, min(alpha + 0.06, 1.0), fresnel);

  gl_FragColor = vec4(col, alpha);
}
`;

export interface ToonWaterOptions {
  islandRadius?: number;
  foamWidth?: number;
  waveAmp?: number;
  waveSpeed?: number;
  toonBands?: number;
  colorDeep?: THREE.Color | number;
  colorMid?: THREE.Color | number;
  colorShallow?: THREE.Color | number;
  colorFoam?: THREE.Color | number;
  colorCrest?: THREE.Color | number;
}

export function createToonWaterMaterial(opts: ToonWaterOptions = {}): THREE.ShaderMaterial {
  const {
    islandRadius = 20,
    foamWidth    = 8,
    waveAmp      = 0.22,
    waveSpeed    = 1.0,
    toonBands    = 3,
    colorDeep    = 0x052e48,
    colorMid     = 0x0c5a88,
    colorShallow = 0x1e8ab0,
    colorFoam    = 0xd8eff8,
    colorCrest   = 0xf0f8ff,
  } = opts;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:         { value: 0 },
      uWaveAmp:      { value: waveAmp },
      uWaveSpeed:    { value: waveSpeed },
      uIslandRadius: { value: islandRadius },
      uFoamWidth:    { value: foamWidth },
      uToonBands:    { value: toonBands },
      uColorDeep:    { value: new THREE.Color(colorDeep) },
      uColorMid:     { value: new THREE.Color(colorMid) },
      uColorShallow: { value: new THREE.Color(colorShallow) },
      uColorFoam:    { value: new THREE.Color(colorFoam) },
      uColorCrest:   { value: new THREE.Color(colorCrest) },
    },
    vertexShader:   toonWaterVertex,
    fragmentShader: toonWaterFragment,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.FrontSide,
  });
}

export function createToonWaterPlane(
  radius: number,
  segments = 128,
  opts: ToonWaterOptions = {}
): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius * 1.6, segments);
  geo.rotateX(-Math.PI / 2);
  const mat  = createToonWaterMaterial({ islandRadius: radius * 0.18, ...opts });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'toon_water_circle';
  mesh.userData.isToonWater = true;
  return mesh;
}

export function createToonOceanPlane(
  size: number,
  segments = 128,
  opts: ToonWaterOptions = {}
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const mat  = createToonWaterMaterial(opts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'toon_water_plane';
  mesh.userData.isToonWater = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function updateToonWater(mesh: THREE.Mesh, elapsed: number): void {
  if (!mesh.userData.isToonWater) return;
  const mat = mesh.material as THREE.ShaderMaterial;
  if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = elapsed;
}
