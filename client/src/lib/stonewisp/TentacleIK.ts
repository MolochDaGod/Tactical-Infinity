/**
 * Tentacle tip IK — FABRIK-lite + sine whip overlay for Stonewisp.
 *
 * Runs AFTER the AnimationMixer each frame so baked Swim/Intimidate drive the
 * bulk motion while tip bones reach toward the ship / attack target.
 */
import * as THREE from 'three';
import type { StonewispTentacleChain } from './stonewispAsset';

export interface TentacleIKOptions {
  /** 0..1 blend of IK vs animation pose */
  weight?: number;
  /** How many FABRIK iterations */
  iterations?: number;
  /** Extra sin whip on mid joints (radians) */
  whipAmp?: number;
  /** Whip frequency */
  whipFreq?: number;
  /** Max tip reach stretch vs rest length (1 = no stretch) */
  maxStretch?: number;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _target = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

export class TentacleIKSolver {
  private chains: StonewispTentacleChain[];
  private restLocalPos: Map<string, THREE.Vector3[]> = new Map();
  private segmentLens: Map<string, number[]> = new Map();
  private weight: number;
  private iterations: number;
  private whipAmp: number;
  private whipFreq: number;
  private maxStretch: number;
  private enabled = true;
  private phase = 0;

  constructor(chains: StonewispTentacleChain[], opts: TentacleIKOptions = {}) {
    this.chains = chains;
    this.weight = opts.weight ?? 0.55;
    this.iterations = opts.iterations ?? 6;
    this.whipAmp = opts.whipAmp ?? 0.12;
    this.whipFreq = opts.whipFreq ?? 2.4;
    this.maxStretch = opts.maxStretch ?? 1.08;
    this.captureRest();
  }

  setWeight(w: number) {
    this.weight = Math.max(0, Math.min(1, w));
  }

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  getChains(): StonewispTentacleChain[] {
    return this.chains;
  }

  private captureRest() {
    for (const chain of this.chains) {
      const locals: THREE.Vector3[] = [];
      const lens: number[] = [];
      for (let i = 0; i < chain.bones.length; i++) {
        const b = chain.bones[i];
        locals.push(b.position.clone());
        if (i > 0) {
          lens.push(b.position.length() || 0.15);
        }
      }
      // World-space rest segment lengths for FABRIK
      chain.bones[0].updateWorldMatrix(true, true);
      const worldLens: number[] = [];
      for (let i = 1; i < chain.bones.length; i++) {
        const a = new THREE.Vector3();
        const c = new THREE.Vector3();
        chain.bones[i - 1].getWorldPosition(a);
        chain.bones[i].getWorldPosition(c);
        worldLens.push(Math.max(0.05, a.distanceTo(c)));
      }
      this.restLocalPos.set(chain.id, locals);
      this.segmentLens.set(chain.id, worldLens.length ? worldLens : lens);
    }
  }

  /**
   * @param targetWorld — e.g. ship deck world position
   * @param dt — frame dt for whip phase
   * @param intensity — 0..1 fight intensity (boosts IK + whip)
   */
  update(targetWorld: THREE.Vector3, dt: number, intensity = 0.5): void {
    if (!this.enabled || this.weight <= 0.001) return;
    this.phase += dt * this.whipFreq * (0.7 + intensity);
    const w = this.weight * (0.35 + 0.65 * intensity);

    for (let ci = 0; ci < this.chains.length; ci++) {
      const chain = this.chains[ci];
      if (chain.bones.length < 2) continue;

      // Per-tentacle target offset so they fan out around the ship
      const fan = (ci / Math.max(1, this.chains.length - 1) - 0.5) * 14;
      _target.copy(targetWorld);
      _target.x += fan + Math.sin(this.phase + ci) * 2.5;
      _target.y += Math.sin(this.phase * 0.7 + ci * 0.9) * 1.8 * intensity;
      _target.z += Math.cos(this.phase * 0.5 + ci) * 1.2;

      this.solveChain(chain, _target, w, ci);
    }
  }

  /**
   * Wrap tentacles around a hull — each chain aims at a spline sample on the
   * ship surface so limbs coil the boat before the break beat.
   */
  updateMulti(targets: THREE.Vector3[], dt: number, intensity = 0.5): void {
    if (!this.enabled || this.weight <= 0.001 || targets.length === 0) return;
    this.phase += dt * this.whipFreq * (0.9 + intensity);
    const w = Math.min(1, this.weight * (0.5 + 0.55 * intensity));

    for (let ci = 0; ci < this.chains.length; ci++) {
      const chain = this.chains[ci];
      if (chain.bones.length < 2) continue;
      const t = targets[ci % targets.length];
      _target.copy(t);
      // Subtle thrash so coils feel alive
      _target.x += Math.sin(this.phase * 1.3 + ci * 1.1) * 1.4 * intensity;
      _target.y += Math.cos(this.phase * 0.9 + ci) * 1.1 * intensity;
      this.solveChain(chain, _target, w, ci);
    }
  }

  private solveChain(
    chain: StonewispTentacleChain,
    target: THREE.Vector3,
    weight: number,
    chainIndex: number,
  ) {
    const bones = chain.bones;
    const n = bones.length;
    const lens = this.segmentLens.get(chain.id) ?? [];

    // World positions snapshot
    const pos: THREE.Vector3[] = bones.map((b) => {
      const p = new THREE.Vector3();
      b.getWorldPosition(p);
      return p;
    });

    const rootPos = pos[0].clone();
    let totalLen = lens.reduce((a, b) => a + b, 0);
    if (totalLen < 0.01) totalLen = pos[0].distanceTo(pos[n - 1]) || 1;

    // Clamp target to max reach
    const toT = target.clone().sub(rootPos);
    const dist = toT.length();
    const maxR = totalLen * this.maxStretch;
    if (dist > maxR) {
      toT.setLength(maxR);
      target = rootPos.clone().add(toT);
    }

    // FABRIK
    for (let iter = 0; iter < this.iterations; iter++) {
      // Backward
      pos[n - 1].copy(target);
      for (let i = n - 2; i >= 0; i--) {
        const seg = lens[i] ?? pos[i].distanceTo(pos[i + 1]) ?? 0.2;
        _v.copy(pos[i]).sub(pos[i + 1]);
        if (_v.lengthSq() < 1e-8) _v.set(0, 1, 0);
        _v.setLength(seg);
        pos[i].copy(pos[i + 1]).add(_v);
      }
      // Forward
      pos[0].copy(rootPos);
      for (let i = 0; i < n - 1; i++) {
        const seg = lens[i] ?? pos[i].distanceTo(pos[i + 1]) ?? 0.2;
        _v.copy(pos[i + 1]).sub(pos[i]);
        if (_v.lengthSq() < 1e-8) _v.set(0, -1, 0);
        _v.setLength(seg);
        pos[i + 1].copy(pos[i]).add(_v);
      }
    }

    // Whip overlay on mid segments
    for (let i = 1; i < n - 1; i++) {
      const t = i / (n - 1);
      const whip =
        Math.sin(this.phase * 1.7 + i * 0.8 + chainIndex) *
        this.whipAmp *
        t *
        (1 - t) *
        4;
      pos[i].x += whip * 0.6;
      pos[i].y += Math.cos(this.phase + i) * this.whipAmp * 0.4;
    }

    // Apply rotations toward solved positions (blend with animation)
    for (let i = 0; i < n - 1; i++) {
      const bone = bones[i];
      const parent = bone.parent;
      if (!parent) continue;

      parent.updateWorldMatrix(true, false);
      const parentWorld = parent.matrixWorld;

      // Desired world direction
      _v.copy(pos[i + 1]).sub(pos[i]).normalize();

      // Current bone forward in world (local +Y or +Z — try +Y first for animal rigs)
      _w.set(0, 1, 0).transformDirection(bone.matrixWorld);

      // World quaternion that rotates current forward to desired
      const qWorld = new THREE.Quaternion().setFromUnitVectors(_w, _v);

      // Convert to local
      const parentQ = new THREE.Quaternion().setFromRotationMatrix(parentWorld);
      const parentQInv = parentQ.clone().invert();
      const boneWorldQ = new THREE.Quaternion().setFromRotationMatrix(bone.matrixWorld);
      const desiredWorldQ = qWorld.multiply(boneWorldQ);
      const desiredLocal = parentQInv.multiply(desiredWorldQ);

      // Blend animation local quat with IK
      bone.quaternion.slerp(desiredLocal, weight);
    }

    // Tip aim — extra blend for last bone
    const tip = bones[n - 1];
    if (tip.parent) {
      tip.parent.updateWorldMatrix(true, false);
      const parentWorld = tip.parent.matrixWorld;
      _v.copy(target).sub(pos[n - 1]).normalize();
      if (_v.lengthSq() > 1e-6) {
        _w.set(0, 1, 0).transformDirection(tip.matrixWorld);
        const qWorld = new THREE.Quaternion().setFromUnitVectors(_w, _v);
        const parentQ = new THREE.Quaternion().setFromRotationMatrix(parentWorld);
        const boneWorldQ = new THREE.Quaternion().setFromRotationMatrix(tip.matrixWorld);
        const desiredLocal = parentQ.clone().invert().multiply(qWorld.multiply(boneWorldQ));
        tip.quaternion.slerp(desiredLocal, Math.min(1, weight * 1.25));
      }
    }
  }
}
