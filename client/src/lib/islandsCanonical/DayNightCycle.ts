/**
 * Continuous day/night cycle for /islands (and any buildIslandScene consumer).
 *
 * Discrete presets (dawn/noon/dusk/night) still exist for UI pins; this module
 * drives a smooth 0..1 dayProgress that orbits the sun, lerps sky colours, and
 * reports a nearest SkyTimeOfDay label for badges / weather coupling.
 *
 * World-map parity: dayProgress matches weatherSystem EnvironmentState.dayProgress
 * so sailing + islands can share the same clock later.
 */

import * as THREE from 'three';
import type { SkyTimeOfDay } from './IslandSky';

export interface DayNightSample {
  /** 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk, 1 = next midnight. */
  dayProgress: number;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  zenith: THREE.Color;
  horizon: THREE.Color;
  intensity: number;
  /** Nearest named band for UI / discrete APIs. */
  band: SkyTimeOfDay;
  /** 0..1 how “night-like” the sky is (stars / dim ambient). */
  nightFactor: number;
}

interface Keyframe {
  t: number;
  band: SkyTimeOfDay;
  sunElev: number; // radians elevation
  sunAz: number;   // radians azimuth
  sunColor: THREE.Color;
  zenith: THREE.Color;
  horizon: THREE.Color;
  intensity: number;
}

/** Authoring keyframes around the day. */
const KEYS: Keyframe[] = [
  {
    t: 0.0,
    band: 'night',
    sunElev: -0.55,
    sunAz: Math.PI * 0.15,
    sunColor: new THREE.Color(0x506070),
    zenith: new THREE.Color(0x04060c),
    horizon: new THREE.Color(0x0c1020),
    intensity: 0.12,
  },
  {
    t: 0.20,
    band: 'dawn',
    sunElev: 0.12,
    sunAz: Math.PI * 0.05,
    sunColor: new THREE.Color(0xffb37a),
    zenith: new THREE.Color(0x3a5a90),
    horizon: new THREE.Color(0xff9a55),
    intensity: 0.75,
  },
  {
    t: 0.35,
    band: 'noon',
    sunElev: 0.95,
    sunAz: Math.PI * 0.25,
    sunColor: new THREE.Color(0xfff6e0),
    zenith: new THREE.Color(0x4a8ad8),
    horizon: new THREE.Color(0xa9d8ff),
    intensity: 1.25,
  },
  {
    t: 0.55,
    band: 'noon',
    sunElev: 0.85,
    sunAz: Math.PI * 0.45,
    sunColor: new THREE.Color(0xfff2d0),
    zenith: new THREE.Color(0x4580d0),
    horizon: new THREE.Color(0xb0dcff),
    intensity: 1.15,
  },
  {
    t: 0.72,
    band: 'dusk',
    sunElev: 0.1,
    sunAz: Math.PI * 0.85,
    sunColor: new THREE.Color(0xff7855),
    zenith: new THREE.Color(0x382858),
    horizon: new THREE.Color(0xff6655),
    intensity: 0.7,
  },
  {
    t: 0.88,
    band: 'night',
    sunElev: -0.35,
    sunAz: Math.PI * 1.05,
    sunColor: new THREE.Color(0x6080a0),
    zenith: new THREE.Color(0x05080f),
    horizon: new THREE.Color(0x121830),
    intensity: 0.18,
  },
  {
    t: 1.0,
    band: 'night',
    sunElev: -0.55,
    sunAz: Math.PI * 1.15 + Math.PI * 2,
    sunColor: new THREE.Color(0x506070),
    zenith: new THREE.Color(0x04060c),
    horizon: new THREE.Color(0x0c1020),
    intensity: 0.12,
  },
];

/** Map discrete TOD → dayProgress pin. */
export const TOD_PROGRESS: Record<SkyTimeOfDay, number> = {
  dawn: 0.22,
  noon: 0.45,
  dusk: 0.72,
  night: 0.0,
};

function wrap01(t: number): number {
  return ((t % 1) + 1) % 1;
}

function elevAzToDir(elev: number, az: number, out: THREE.Vector3): THREE.Vector3 {
  const ce = Math.cos(elev);
  out.set(Math.sin(az) * ce, Math.sin(elev), Math.cos(az) * ce).normalize();
  return out;
}

function sampleAt(progress: number): DayNightSample {
  const t = wrap01(progress);
  let i0 = 0;
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
      i0 = i;
      break;
    }
  }
  const a = KEYS[i0];
  const b = KEYS[i0 + 1];
  const span = Math.max(1e-6, b.t - a.t);
  const u = THREE.MathUtils.clamp((t - a.t) / span, 0, 1);
  // Smoothstep for softer transitions at dawn/dusk
  const s = u * u * (3 - 2 * u);

  const elev = THREE.MathUtils.lerp(a.sunElev, b.sunElev, s);
  const az = THREE.MathUtils.lerp(a.sunAz, b.sunAz, s);
  const sunDir = elevAzToDir(elev, az, new THREE.Vector3());
  const sunColor = a.sunColor.clone().lerp(b.sunColor, s);
  const zenith = a.zenith.clone().lerp(b.zenith, s);
  const horizon = a.horizon.clone().lerp(b.horizon, s);
  const intensity = THREE.MathUtils.lerp(a.intensity, b.intensity, s);
  const band = s < 0.5 ? a.band : b.band;
  // Night factor peaks when sun is below horizon
  const nightFactor = THREE.MathUtils.clamp(1 - (elev + 0.15) / 0.55, 0, 1);

  return {
    dayProgress: t,
    sunDir,
    sunColor,
    zenith,
    horizon,
    intensity,
    band,
    nightFactor,
  };
}

export interface DayNightCycleOptions {
  /** Starting day progress 0..1. Default noon-ish. */
  startProgress?: number;
  /** Real-time seconds for a full in-game day. Default 480s (8 min). */
  dayLengthSec?: number;
  /** When true, progress advances each tick. */
  auto?: boolean;
}

/**
 * Mutable day clock. Call `tick(dt)` from the scene update loop; apply
 * `sample()` to IslandSky via `setDaySample`.
 */
export class DayNightCycle {
  dayProgress: number;
  dayLengthSec: number;
  auto: boolean;
  private _scratch = sampleAt(0.45);

  constructor(opts: DayNightCycleOptions = {}) {
    this.dayProgress = opts.startProgress ?? TOD_PROGRESS.noon;
    this.dayLengthSec = Math.max(30, opts.dayLengthSec ?? 480);
    this.auto = opts.auto ?? false;
  }

  /** Advance clock when auto-enabled. */
  tick(dt: number): DayNightSample {
    if (this.auto && this.dayLengthSec > 0) {
      this.dayProgress = wrap01(this.dayProgress + dt / this.dayLengthSec);
    }
    return this.sample();
  }

  sample(): DayNightSample {
    this._scratch = sampleAt(this.dayProgress);
    return this._scratch;
  }

  setProgress(p: number): DayNightSample {
    this.dayProgress = wrap01(p);
    return this.sample();
  }

  pinBand(band: SkyTimeOfDay): DayNightSample {
    return this.setProgress(TOD_PROGRESS[band]);
  }

  setDayLength(sec: number): void {
    this.dayLengthSec = Math.max(30, sec);
  }

  setAuto(on: boolean): void {
    this.auto = on;
  }
}

export { sampleAt as sampleDayNight };
