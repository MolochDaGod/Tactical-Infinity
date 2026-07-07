/**
 * rtsShaders.ts — All GLSL shader sources for the RTS/island game effects.
 * Based on stemkoski Three.js examples as catalogued in the effects reference guide.
 *
 * Patterns covered:
 *   1. Animated UV shader  — noise-based UV distortion (lava, portals, fog edges)
 *   2. Fireball shader     — vertex displacement + animated noise layers
 *   3. Glow shader         — view-dependent fresnel (selected units, auras, pickups)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANIMATED UV SHADER  (Shader-Animate Pattern, stemkoski)
// ─────────────────────────────────────────────────────────────────────────────

export const ANIMATED_UV_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ANIMATED_UV_FRAG = /* glsl */`
  uniform sampler2D baseTexture;
  uniform float     baseSpeed;
  uniform sampler2D noiseTexture;
  uniform float     noiseScale;
  uniform float     alpha;
  uniform float     time;
  varying vec2 vUv;

  void main() {
    // Shift UVs over time for flowing base layer
    vec2 uvTimeShift = vUv + vec2(-0.7, 1.5) * time * baseSpeed;
    vec4 noiseColor  = texture2D(noiseTexture, uvTimeShift);

    // Distort final UVs using red+blue channels of noise sample
    vec2 uvNoise     = vUv + noiseScale * vec2(noiseColor.r, noiseColor.b);
    vec4 baseColor   = texture2D(baseTexture, uvNoise);
    baseColor.a      = alpha;
    gl_FragColor     = baseColor;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIREBALL SHADER  (Shader-Fireball Pattern, stemkoski)
// ─────────────────────────────────────────────────────────────────────────────

export const FIREBALL_VERT = /* glsl */`
  uniform sampler2D bumpTexture;
  uniform float     bumpSpeed;
  uniform float     bumpScale;
  uniform float     time;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    // UV time-shift for bump map
    vec2 uvBump    = uv + vec2(0.0, time * bumpSpeed);
    vec4 bumpData  = texture2D(bumpTexture, uvBump);

    // Displace vertices outward along normal using bump value
    vec3 newPos    = position + normal * bumpScale * (bumpData.r - 0.5);
    gl_Position    = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

export const FIREBALL_FRAG = /* glsl */`
  uniform sampler2D baseTexture;
  uniform float     baseSpeed;
  uniform float     repeatS;
  uniform float     repeatT;
  uniform sampler2D noiseTexture;
  uniform float     noiseScale;
  uniform sampler2D blendTexture;
  uniform float     blendSpeed;
  uniform float     blendOffset;
  uniform float     alpha;
  uniform float     time;
  varying vec2 vUv;

  void main() {
    // Tiled, animated base UV
    vec2 uvBase  = vec2(vUv.x * repeatS, vUv.y * repeatT)
                 + vec2(0.0, time * baseSpeed);
    // Noise-distorted layer
    vec2 uvNoise = vUv + vec2(0.0, time * baseSpeed);
    vec4 noise   = texture2D(noiseTexture, uvNoise);
    vec2 uvDistorted = uvBase + noiseScale * vec2(noise.r - 0.5, noise.b - 0.5);
    vec4 baseCol = texture2D(baseTexture, uvDistorted);

    // Blend mask layer
    vec2 uvBlend = vUv + vec2(0.0, time * blendSpeed + blendOffset);
    vec4 blendCol = texture2D(blendTexture, uvBlend);

    // Composite: multiply blend mask onto base
    vec4 result  = baseCol * blendCol;
    result.a     = alpha;
    gl_FragColor = result;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. GLOW / FRESNEL SHADER  (Shader-Glow Pattern, stemkoski)
// ─────────────────────────────────────────────────────────────────────────────

export const GLOW_VERT = /* glsl */`
  uniform vec3  viewVector;
  uniform float c;
  uniform float p;
  varying float intensity;

  void main() {
    vec3 vNormal  = normalize(normalMatrix * normal);
    vec3 vNormel  = normalize(normalMatrix * viewVector);
    intensity     = pow(c - dot(vNormal, vNormel), p);
    gl_Position   = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GLOW_FRAG = /* glsl */`
  uniform vec3  glowColor;
  varying float intensity;

  void main() {
    vec3 glow    = glowColor * intensity;
    gl_FragColor = vec4(glow, intensity);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Preset parameter sets for the glow shader (from reference guide)
// ─────────────────────────────────────────────────────────────────────────────

export interface GlowPreset {
  c: number;
  p: number;
  side: 'front' | 'back';
  label: string;
}

export const GLOW_PRESETS: Record<string, GlowPreset> = {
  // Sphere or round mesh glow (selection highlight)
  glow:  { c: 0.05, p: 4.5, side: 'front', label: 'Glow'  },
  // Cube/box glow
  cube:  { c: 0.20, p: 1.4, side: 'front', label: 'Cube Glow' },
  // Halo (backface, further from mesh)
  halo:  { c: 0.60, p: 6.0, side: 'back',  label: 'Halo'  },
  // Shell (full bright edge)
  shell: { c: 1.00, p: 2.0, side: 'front', label: 'Shell' },
};
