/**
 * SketchbookSpringMath — faithful port of swift502/Sketchbook spring simulation.
 * Sources: VectorSpringSimulator.ts, RelativeSpringSimulator.ts, FunctionLibrary.ts
 */

import * as THREE from 'three';

// ─── Core spring functions (from Sketchbook/FunctionLibrary.ts) ───────────────

export interface SimulationFrame {
  position: number;
  velocity: number;
}

export interface SimulationFrameVector {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

/** Scalar spring — returns next frame for a 1D spring */
export function spring(
  source:   number,
  dest:     number,
  velocity: number,
  mass:     number,
  damping:  number
): SimulationFrame {
  let acceleration = (dest - source) / mass;
  velocity = (velocity + acceleration) * damping;
  return { position: source + velocity, velocity };
}

/** Vector spring — mutates source in-place (matches Sketchbook springV) */
export function springV(
  source:   THREE.Vector3,
  dest:     THREE.Vector3,
  velocity: THREE.Vector3,
  mass:     number,
  damping:  number
): void {
  const acc = new THREE.Vector3().subVectors(dest, source).divideScalar(mass);
  velocity.add(acc).multiplyScalar(damping);
  source.add(velocity);
}

// ─── SimulatorBase ────────────────────────────────────────────────────────────

abstract class SimulatorBase<CacheT> {
  public mass:      number;
  public damping:   number;
  public frameTime: number;
  public offset:    number;
  public abstract cache: CacheT[];

  constructor(fps: number, mass: number, damping: number) {
    this.mass      = mass;
    this.damping   = damping;
    this.frameTime = 1 / fps;
    this.offset    = 0;
  }

  protected lastFrame(): CacheT { return this.cache[this.cache.length - 1]; }

  protected generateFrames(timeStep: number): void {
    const total = this.offset + timeStep;
    const frames = Math.floor(total / this.frameTime);
    this.offset = total % this.frameTime;
    if (frames > 0) {
      for (let i = 0; i < frames; i++) this.cache.push(this.getFrame(i + 1 === frames));
      this.cache = this.cache.slice(-2);
    }
  }

  abstract getFrame(isLastFrame: boolean): CacheT;
  abstract simulate(timeStep: number): void;
}

// ─── VectorSpringSimulator ────────────────────────────────────────────────────

export class VectorSpringSimulator extends SimulatorBase<SimulationFrameVector> {
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public target:   THREE.Vector3 = new THREE.Vector3();
  public cache:    SimulationFrameVector[];

  constructor(fps: number, mass: number, damping: number) {
    super(fps, mass, damping);
    this.cache = [
      { position: new THREE.Vector3(), velocity: new THREE.Vector3() },
      { position: new THREE.Vector3(), velocity: new THREE.Vector3() },
    ];
  }

  getFrame(_isLast: boolean): SimulationFrameVector {
    const prev = this.lastFrame();
    const frame: SimulationFrameVector = {
      position: prev.position.clone(),
      velocity: prev.velocity.clone(),
    };
    springV(frame.position, this.target, frame.velocity, this.mass, this.damping);
    return frame;
  }

  simulate(timeStep: number): void {
    this.generateFrames(timeStep);
    const t = this.offset / this.frameTime;
    this.position.lerpVectors(this.cache[0].position, this.cache[1].position, t);
    this.velocity.lerpVectors(this.cache[0].velocity, this.cache[1].velocity, t);
  }
}

// ─── RelativeSpringSimulator ──────────────────────────────────────────────────

export class RelativeSpringSimulator extends SimulatorBase<SimulationFrame> {
  public position: number;
  public velocity: number;
  public target:   number;
  public lastLerp: number;
  public cache:    SimulationFrame[];

  constructor(fps: number, mass: number, damping: number, startPos = 0, startVel = 0) {
    super(fps, mass, damping);
    this.position = startPos;
    this.velocity = startVel;
    this.target   = 0;
    this.lastLerp = 0;
    this.cache    = [
      { position: startPos, velocity: startVel },
      { position: startPos, velocity: startVel },
    ];
  }

  getFrame(isLastFrame: boolean): SimulationFrame {
    const prev = { ...this.lastFrame() };
    if (isLastFrame) {
      prev.position = 0;
      this.lastLerp = this.lastLerp - this.lastFrame().position;
    }
    return spring(prev.position, this.target, prev.velocity, this.mass, this.damping);
  }

  simulate(timeStep: number): void {
    this.generateFrames(timeStep);
    const t    = this.offset / this.frameTime;
    const lerp = THREE.MathUtils.lerp(0, this.cache[1].position, t);
    this.position = lerp - this.lastLerp;
    this.lastLerp = lerp;
    this.velocity = THREE.MathUtils.lerp(this.cache[0].velocity, this.cache[1].velocity, t);
  }
}
