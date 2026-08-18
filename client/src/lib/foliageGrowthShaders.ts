/**
 * Foliage growth shaders:
 *  - MossGrowth on rocks (green over time + wind edge)
 *  - Leaf canopy wind sway for regrow trees
 *
 * Pure GLSL strings + uniform helpers — attach via THREE.ShaderMaterial.
 */

/** Moss creep on rock surfaces — growth 0..1, wind-animated green mask. */
export const mossGrowthVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const mossGrowthFrag = /* glsl */ `
  uniform float uTime;
  uniform float uGrowth;      // 0 bare rock → 1 full moss
  uniform vec3 uRockColor;
  uniform vec3 uMossColor;
  uniform float uWind;
  uniform sampler2D uNoise;   // optional; if unbound, use procedural

  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying vec2 vUv;

  // cheap hash noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Prefer top-facing surfaces for moss
    float up = clamp(vNormalW.y * 0.5 + 0.5, 0.0, 1.0);
    float n = noise(vWorldPos.xz * 1.8 + uTime * 0.05 * uWind);
    float wind = sin(uTime * 1.6 + vWorldPos.x * 0.7 + vWorldPos.z * 0.5) * 0.08 * uWind;
    // Growth threshold expands with uGrowth
    float mask = smoothstep(1.0 - uGrowth - 0.15, 1.0 - uGrowth + 0.25, n * 0.65 + up * 0.55 + wind);
    mask = clamp(mask * uGrowth * 1.15, 0.0, 1.0);

    vec3 col = mix(uRockColor, uMossColor, mask);
    // subtle wet sheen on moss
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), vec3(0.0, 1.0, 0.0))), 2.0);
    col += uMossColor * rim * mask * 0.12;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Leaf / ivy canopy sway for regrow stages. */
export const leafSwayVert = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  uniform float uStage; // 0..1 regrow scale bias
  varying vec3 vColor;
  varying float vY;
  attribute vec3 color;
  void main() {
    vColor = color;
    vY = position.y;
    vec3 pos = position;
    float h = max(pos.y, 0.0);
    float phase = aPhaseSafe(pos);
    float sway = sin(uTime * 1.9 + phase) * uWind * h * h * (0.4 + uStage);
    pos.x += sway;
    pos.z += cos(uTime * 1.4 + phase * 0.8) * uWind * 0.5 * h * h;
    // shrink canopy with stage
    pos *= mix(0.25, 1.0, clamp(uStage, 0.0, 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
  float aPhaseSafe(vec3 p) {
    return p.x * 2.1 + p.z * 1.7;
  }
`;

// Fix: GLSL doesn't allow function after use in some compilers — rewrite leaf sway cleanly
export const leafSwayVertFixed = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  uniform float uStage;
  varying vec3 vColor;
  varying float vY;
  void main() {
    #ifdef USE_COLOR
      vColor = color;
    #else
      vColor = vec3(0.25, 0.55, 0.2);
    #endif
    vY = position.y;
    vec3 pos = position;
    float h = max(pos.y, 0.0);
    float phase = pos.x * 2.1 + pos.z * 1.7;
    float sway = sin(uTime * 1.9 + phase) * uWind * h * h * (0.4 + uStage);
    pos.x += sway;
    pos.z += cos(uTime * 1.4 + phase * 0.8) * uWind * 0.5 * h * h;
    pos *= mix(0.25, 1.0, clamp(uStage, 0.0, 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const leafSwayFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vY;
  uniform float uStage;
  void main() {
    float tip = smoothstep(0.0, 1.0, vY);
    vec3 col = mix(vColor * 0.65, vColor * 1.2, tip);
    float alpha = mix(0.55, 0.95, uStage);
    gl_FragColor = vec4(col, alpha);
  }
`;

export type MossGrowthUniforms = {
  uTime: { value: number };
  uGrowth: { value: number };
  uRockColor: { value: [number, number, number] };
  uMossColor: { value: [number, number, number] };
  uWind: { value: number };
};

export function createMossGrowthUniforms(
  growth = 0,
  mossColor: [number, number, number] = [0.18, 0.42, 0.16],
): MossGrowthUniforms {
  return {
    uTime: { value: 0 },
    uGrowth: { value: growth },
    uRockColor: { value: [0.45, 0.42, 0.38] },
    uMossColor: { value: mossColor },
    uWind: { value: 0.22 },
  };
}

export function createLeafSwayUniforms(stage = 1) {
  return {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
    uStage: { value: stage },
  };
}

/**
 * Map harvest regrow 0..1 → visual leaf stage + moss growth on nearby rocks.
 */
export function growthBands(regrow01: number): {
  stage: number;
  leafCount: number;
  moss: number;
  showFern: boolean;
} {
  const t = Math.max(0, Math.min(1, regrow01));
  return {
    stage: t,
    leafCount: Math.round(t * 16),
    moss: Math.min(1, t * 1.2),
    showFern: t > 0.45,
  };
}
