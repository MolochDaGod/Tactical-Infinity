/**
 * Easing curves for shaping terrain heightmaps.
 *
 * Inspired by THREE.Terrain's easing functions (MIT, IceCreamYou).
 * All functions take a normalized input in [0, 1] and return a value in [0, 1].
 *
 * Use them to remap a raw fBm/Diamond-Square heightmap into a more
 * island-friendly profile (sharp shores + plateau peaks, etc.).
 */

export type EasingFn = (t: number) => number;

export const Easing = {
  Linear: ((t) => t) as EasingFn,

  EaseIn: ((t) => t * t) as EasingFn,

  EaseOut: ((t) => t * (2 - t)) as EasingFn,

  EaseInOut: ((t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)) as EasingFn,

  // Gentle inflection — useful for rolling hill terrain
  EaseInWeak: ((t) => Math.pow(t, 1.55)) as EasingFn,

  // Strong shore + plateau — squashes low values, holds high ground flat
  EaseInStrong: ((t) => Math.pow(t, 2.6)) as EasingFn,

  // Inverse — pushes low ground higher, rare but useful for atolls
  InverseEaseIn: ((t) => 1 - Math.pow(1 - t, 2)) as EasingFn,

  // Smoothstep (perlin-style) — soft S-curve, removes harsh banding
  Smoothstep: ((t) => t * t * (3 - 2 * t)) as EasingFn,

  // Smootherstep — even softer S-curve (Ken Perlin's improved variant)
  Smootherstep: ((t) => t * t * t * (t * (t * 6 - 15) + 10)) as EasingFn,

  // Turbulence-style — emphasizes mid-range, good for ridge-heavy biomes
  Turbulent: ((t) => 0.5 - 0.5 * Math.cos(Math.PI * t)) as EasingFn,
};

export function applyEasing(
  data: Float32Array,
  ease: EasingFn,
  min = 0,
  max = 1,
): void {
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    const t = Math.min(1, Math.max(0, (data[i] - min) / range));
    data[i] = min + ease(t) * range;
  }
}
