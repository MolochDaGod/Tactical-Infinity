/**
 * bloodEffects.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Post-processing blood & impact FX for BattleGrounds using pmndrs/postprocessing.
 *
 * Features
 *  • BloodVignetteEffect   — custom GLSL full-screen blood vignette that flashes
 *    red then drips down on player-damage and fades back to clear health.
 *  • BloodParticleSystem   — world-space GPU-friendly instanced blood droplets
 *    that arc under gravity and fade out at enemy kill positions.
 *  • BloodDecalSystem      — flat screen-space blood "smear" quads that appear
 *    over time (damage accumulation) and slowly fade.
 *  • CameraShake           — spring-damped camera shake triggered on damage.
 *  • KillBloom             — golden bloom pulse emitted briefly on enemy kills.
 *  • buildComposer()       — wires EffectComposer with RenderPass + all passes.
 */

import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  Effect,
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
} from 'postprocessing';

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Blood Vignette GLSL Effect
// ─────────────────────────────────────────────────────────────────────────────

const BLOOD_VIGNETTE_FRAG = /* glsl */ `
uniform float uIntensity;
uniform float uPulse;
uniform float uDrip;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 cUV = uv - 0.5;

  /* ── radial vignette ── */
  float r = length(cUV);
  float vign = smoothstep(0.28, 1.0, r * 1.6);

  /* ── drip columns (vertical streaks from top edge) ── */
  float col = abs(sin(uv.x * 23.7 + 0.4)) * 0.4 + abs(sin(uv.x * 11.3)) * 0.6;
  float dripMask = smoothstep(0.0, 0.25, uv.y) * (1.0 - smoothstep(0.25, 0.7, uv.y));
  float streak = col * dripMask * uDrip;

  /* ── pulsing bright red on fresh hit ── */
  float pulse = uPulse * (1.0 - r * 1.2);
  pulse = max(pulse, 0.0);

  vec3 bloodDeep  = vec3(0.50, 0.00, 0.00);
  vec3 bloodBright= vec3(0.90, 0.05, 0.05);
  vec3 bloodColor = mix(bloodDeep, bloodBright, pulse);

  float alpha = (vign * uIntensity + streak * uIntensity * 0.6 + pulse * 0.55);
  alpha = clamp(alpha, 0.0, 0.72);

  outputColor = vec4(mix(inputColor.rgb, bloodColor, alpha * 0.8), inputColor.a);
}
`;

export class BloodVignetteEffect extends Effect {
  private _intensity: THREE.Uniform;
  private _pulse:     THREE.Uniform;
  private _drip:      THREE.Uniform;

  constructor() {
    const uniforms = new Map<string, THREE.Uniform>([
      ['uIntensity', new THREE.Uniform(0.0)],
      ['uPulse',     new THREE.Uniform(0.0)],
      ['uDrip',      new THREE.Uniform(0.0)],
    ]);
    super('BloodVignetteEffect', BLOOD_VIGNETTE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms,
    });
    this._intensity = uniforms.get('uIntensity')!;
    this._pulse     = uniforms.get('uPulse')!;
    this._drip      = uniforms.get('uDrip')!;
  }

  /** 0 → 1 base blood overlay (tied to damage taken / low HP) */
  set intensity(v: number) { this._intensity.value = v; }
  get intensity()           { return this._intensity.value as number; }

  /** 0 → 1 bright flash on fresh hit (decays quickly) */
  set pulse(v: number)      { this._pulse.value = v; }
  get pulse()               { return this._pulse.value as number; }

  /** 0 → 1 drip intensity (accumulates with damage) */
  set drip(v: number)       { this._drip.value = v; }
  get drip()                { return this._drip.value as number; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  Camera Shake
// ─────────────────────────────────────────────────────────────────────────────

export class CameraShake {
  private trauma = 0;           // 0..1, squared for feel
  private readonly decay = 5.5;
  private readonly maxOffset = new THREE.Vector3(0.12, 0.08, 0);

  /** trigger(1) = big hit, trigger(0.4) = minor glance */
  trigger(amount = 1.0) {
    this.trauma = Math.min(1.0, this.trauma + amount * 0.55);
  }

  /** call AFTER applyCamera — applies additive offset */
  update(camera: THREE.Camera, dt: number) {
    if (this.trauma < 0.001) return;
    const sq = this.trauma * this.trauma;  // squared trauma feels better
    const { maxOffset: m } = this;
    camera.position.x += (Math.random() * 2 - 1) * m.x * sq;
    camera.position.y += (Math.random() * 2 - 1) * m.y * sq;
    this.trauma = Math.max(0, this.trauma - dt * this.decay);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Blood Particle System  (instanced InstancedMesh for performance)
// ─────────────────────────────────────────────────────────────────────────────

interface BloodParticle {
  index:   number;
  pos:     THREE.Vector3;
  vel:     THREE.Vector3;
  life:    number;
  maxLife: number;
}

export class BloodParticleSystem {
  private readonly POOL = 128;
  private mesh: THREE.InstancedMesh;
  private particles: BloodParticle[] = [];
  private freeSlots: number[] = [];
  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geo = new THREE.SphereGeometry(0.07, 3, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0xAA0000 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.POOL);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;  // shown progressively
    // hide all
    this.dummy.scale.setScalar(0);
    for (let i = 0; i < this.POOL; i++) {
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.freeSlots.push(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  spawnBlood(pos: THREE.Vector3, count = 16, deathBurst = false) {
    const n = Math.min(count, this.freeSlots.length);
    for (let i = 0; i < n; i++) {
      const slot = this.freeSlots.pop()!;
      const speed  = deathBurst ? 10 : 5;
      const life   = deathBurst ? 1.2 + Math.random() * 0.6 : 0.6 + Math.random() * 0.5;
      const p: BloodParticle = {
        index: slot,
        pos:   pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.3 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.3,
        )),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          (deathBurst ? 4 : 2) + Math.random() * (deathBurst ? 8 : 4),
          (Math.random() - 0.5) * speed,
        ),
        life, maxLife: life,
      };
      this.particles.push(p);
    }
    this.mesh.count = this.POOL;
  }

  update(dt: number) {
    const G = 18;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= G * dt;
      p.pos.addScaledVector(p.vel, dt);

      const t = Math.max(0, p.life / p.maxLife);
      const s = t * (0.55 + p.maxLife * 0.25);

      this.dummy.position.copy(p.pos);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(p.index, this.dummy.matrix);

      if (p.life <= 0) {
        // hide slot
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(p.index, this.dummy.matrix);
        this.freeSlots.push(p.index);
        this.particles.splice(i, 1);
      }
    }
    if (this.particles.length > 0 || this.mesh.count > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.particles.length === 0) this.mesh.count = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Kill Bloom controller  (modulates BloomEffect intensity on kills)
// ─────────────────────────────────────────────────────────────────────────────

export class KillBloom {
  private timer = 0;
  private readonly PEAK = 4.5;
  private readonly BASE = 0.5;
  private readonly DURATION = 0.45;
  bloom: BloomEffect;

  constructor(bloom: BloomEffect) {
    this.bloom = bloom;
    bloom.intensity = this.BASE;
  }

  trigger() { this.timer = this.DURATION; }

  update(dt: number) {
    if (this.timer > 0) {
      this.timer -= dt;
      const t = this.timer / this.DURATION;
      this.bloom.intensity = this.BASE + this.PEAK * Math.pow(t, 0.6);
    } else {
      this.bloom.intensity = THREE.MathUtils.lerp(this.bloom.intensity, this.BASE, dt * 6);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Unified BattleBloodFX facade
// ─────────────────────────────────────────────────────────────────────────────

export interface BattleBloodFX {
  composer:    EffectComposer;
  vignette:    BloodVignetteEffect;
  particles:   BloodParticleSystem;
  shake:       CameraShake;
  killBloom:   KillBloom;
  /** Call per-frame with elapsed seconds */
  update(dt: number, camera: THREE.Camera, hpFraction: number): void;
  /** Flash triggered when player takes damage (damage 0..1 relative to max) */
  onPlayerDamage(damage: number): void;
  /** Burst triggered at world position when an enemy is killed */
  onEnemyKill(pos: THREE.Vector3, isBoss?: boolean): void;
  dispose(): void;
}

export function buildBattleBloodFX(
  renderer: THREE.WebGLRenderer,
  scene:    THREE.Scene,
  camera:   THREE.PerspectiveCamera,
): BattleBloodFX {
  // ── composer ──────────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // ── effects ───────────────────────────────────────────────────────────────
  const bloodVig = new BloodVignetteEffect();

  const bloom = new BloomEffect({
    intensity:    0.5,
    luminanceThreshold: 0.72,
    luminanceSmoothing: 0.08,
    mipmapBlur:   true,
  });

  const chromAb = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0, 0.0),
    radialModulation: true,
    modulationOffset: 0.0,
  });

  const subtleVignette = new VignetteEffect({
    eskil: false,
    offset: 0.35,
    darkness: 0.55,
  });

  // passes (order matters for compositing)
  composer.addPass(new EffectPass(camera, subtleVignette, bloom));
  composer.addPass(new EffectPass(camera, bloodVig, chromAb));

  // ── sub-systems ───────────────────────────────────────────────────────────
  const particles = new BloodParticleSystem(scene);
  const shake     = new CameraShake();
  const killBloom = new KillBloom(bloom);

  // internal state
  let vigDecay    = 0;   // timer for pulse decay
  let aberTimer   = 0;   // chromatic aberration timer

  // ── facade ────────────────────────────────────────────────────────────────
  return {
    composer, vignette: bloodVig, particles, shake, killBloom,

    update(dt: number, camera: THREE.Camera, hpFraction: number) {
      particles.update(dt);
      shake.update(camera, dt);
      killBloom.update(dt);

      // Vignette pulse fades out
      vigDecay = Math.max(0, vigDecay - dt * 3.2);
      bloodVig.pulse     = vigDecay;
      bloodVig.intensity = (1.0 - hpFraction) * 0.6 + vigDecay * 0.4;
      bloodVig.drip      = Math.max(0, 1.0 - hpFraction - 0.3) * 1.3;

      // Chromatic aberration fades
      aberTimer = Math.max(0, aberTimer - dt * 4.5);
      const aberStr = aberTimer * 0.006;
      (chromAb.offset as THREE.Vector2).set(aberStr, aberStr * 0.4);
    },

    onPlayerDamage(damage: number) {
      vigDecay  = Math.min(1.0, vigDecay + damage * 1.5);
      aberTimer = Math.min(1.0, aberTimer + damage);
      shake.trigger(damage);
    },

    onEnemyKill(pos: THREE.Vector3, isBoss = false) {
      particles.spawnBlood(pos, isBoss ? 40 : 18, isBoss);
      killBloom.trigger();
    },

    dispose() {
      particles.dispose();
      composer.dispose();
    },
  };
}
