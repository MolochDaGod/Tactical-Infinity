/**
 * Lightweight animation graph for player / NPC / captain controllers.
 *
 * States: idle | walk | jog | sprint | roll | attack | cast | hit | death | air
 * Layers: full-body (base) + optional upper-body overlay for attack/cast while moving.
 *
 * Uses SharedClipLibrary `base/*` keys by default; override via resolveClip.
 */

import * as THREE from "three";
import type { BaseSemanticRole } from "./baseCharacterClips";
import { baseLibraryKey } from "./baseCharacterClips";
import { getClip } from "./SharedClipLibrary";

export type AnimGraphState =
  | "idle"
  | "walk"
  | "jog"
  | "sprint"
  | "roll"
  | "attack"
  | "cast"
  | "hit"
  | "death"
  | "air";

export type CastPhase = "enter" | "loop" | "shoot" | "exit";

/** Fade defaults — combat snappy, loco smooth. */
export const ANIM_FADE = {
  loco: 0.14,
  combatIn: 0.09,
  combatOut: 0.14,
  roll: 0.08,
  upper: 0.07,
} as const;

export interface AnimGraphOptions {
  mixer: THREE.AnimationMixer;
  /** Resolve semantic role → clip (default: SharedClipLibrary base/*). */
  resolveClip?: (role: BaseSemanticRole) => THREE.AnimationClip | null;
  /** Called when a one-shot finishes (roll/attack/cast shoot). */
  onOneShotEnd?: (state: AnimGraphState) => void;
}

function defaultResolve(role: BaseSemanticRole): THREE.AnimationClip | null {
  return getClip(baseLibraryKey(role));
}

/**
 * Map locomotion intensity 0..1 → loco state.
 * Aligns with play-shell Controller: walk ~0.45, sprint = 1.
 */
export function locoStateFromSpeed(speed: number, sprinting = false): AnimGraphState {
  if (sprinting || speed >= 0.82) return "sprint";
  if (speed >= 0.55) return "jog";
  if (speed >= 0.08) return "walk";
  return "idle";
}

export class AnimGraph {
  readonly mixer: THREE.AnimationMixer;
  private resolveClip: (role: BaseSemanticRole) => THREE.AnimationClip | null;
  private onOneShotEnd?: (state: AnimGraphState) => void;

  private full: THREE.AnimationAction | null = null;
  private fullKey: string | null = null;
  private upper: THREE.AnimationAction | null = null;
  private upperKey: string | null = null;

  private state: AnimGraphState = "idle";
  private oneShotUntil = 0;
  private castPhase: CastPhase | null = null;
  private time = 0;
  private actionCache = new Map<string, THREE.AnimationAction>();

  constructor(opts: AnimGraphOptions) {
    this.mixer = opts.mixer;
    this.resolveClip = opts.resolveClip ?? defaultResolve;
    this.onOneShotEnd = opts.onOneShotEnd;
  }

  get currentState(): AnimGraphState {
    return this.state;
  }

  /** Per-frame: advance mixer + expire one-shots back to loco intent. */
  update(dt: number, locoSpeed = 0, sprinting = false): void {
    this.time += dt;
    this.mixer.update(dt);

    if (this.oneShotUntil > 0 && this.time >= this.oneShotUntil) {
      const finished = this.state;
      this.oneShotUntil = 0;
      this.castPhase = null;
      this.clearUpper();
      this.onOneShotEnd?.(finished);
      // Resume locomotion
      if (finished !== "death") {
        this.setLocomotion(locoSpeed, sprinting);
      }
    } else if (this.oneShotUntil <= 0 && this.state !== "death" && this.state !== "air") {
      // Only drive loco when not in a one-shot
      if (
        this.state === "idle" ||
        this.state === "walk" ||
        this.state === "jog" ||
        this.state === "sprint"
      ) {
        this.setLocomotion(locoSpeed, sprinting);
      }
    }
  }

  /** Continuous locomotion intent (ignored while one-shot owns full body). */
  setLocomotion(speed: number, sprinting = false): void {
    if (this.oneShotUntil > 0) return;
    if (this.state === "death") return;
    const next = locoStateFromSpeed(speed, sprinting);
    const role = this.locoRole(next);
    this.playFull(role, ANIM_FADE.loco, true);
    this.state = next;
  }

  /** Dodge / roll one-shot (full body). */
  playRoll(): number {
    const dur = this.playFull("roll", ANIM_FADE.roll, false);
    this.state = "roll";
    this.oneShotUntil = this.time + dur;
    this.clearUpper();
    return dur;
  }

  /**
   * Melee attack. If `moving`, uses upper-body overlay when available so legs
   * keep walking/sprinting.
   */
  playAttack(opts?: { moving?: boolean; punch?: boolean }): number {
    const role: BaseSemanticRole = opts?.punch ? "attack_punch" : "attack_melee";
    if (opts?.moving) {
      const upperKey = `${baseLibraryKey(role)}/upper`;
      const upperClip = getClip(upperKey) ?? this.resolveClip(role);
      if (upperClip && opts.moving) {
        const dur = this.playUpperClip(upperClip, upperKey, ANIM_FADE.upper);
        this.state = "attack";
        this.oneShotUntil = this.time + dur;
        return dur;
      }
    }
    const dur = this.playFull(role, ANIM_FADE.combatIn, false);
    this.state = "attack";
    this.oneShotUntil = this.time + dur;
    this.clearUpper();
    return dur;
  }

  /** Casting pipeline: enter → loop (optional hold) → shoot → exit. */
  playCast(phase: CastPhase = "shoot"): number {
    const role: BaseSemanticRole =
      phase === "enter"
        ? "cast_enter"
        : phase === "loop"
          ? "cast_loop"
          : phase === "exit"
            ? "cast_exit"
            : "cast_shoot";
    const defLoop = phase === "loop";
    // Prefer upper for shoot/enter so caster can still face/move slowly
    const upperKey = `${baseLibraryKey(role)}/upper`;
    const upperClip = getClip(upperKey);
    let dur: number;
    if (upperClip && (phase === "shoot" || phase === "enter" || phase === "loop")) {
      dur = this.playUpperClip(upperClip, upperKey, ANIM_FADE.upper, defLoop);
    } else {
      dur = this.playFull(role, ANIM_FADE.combatIn, defLoop);
      this.clearUpper();
    }
    this.state = "cast";
    this.castPhase = phase;
    if (!defLoop) this.oneShotUntil = this.time + dur;
    else this.oneShotUntil = 0;
    return dur;
  }

  /** Full cast sequence total duration estimate (enter+shoot+exit). */
  async playCastSequence(): Promise<number> {
    const a = this.playCast("enter");
    await wait(a * 0.85);
    const b = this.playCast("shoot");
    await wait(b);
    const c = this.playCast("exit");
    return a + b + c;
  }

  playHit(): number {
    const dur = this.playFull("hit", ANIM_FADE.combatIn, false);
    this.state = "hit";
    this.oneShotUntil = this.time + dur;
    this.clearUpper();
    return dur;
  }

  playDeath(): number {
    const dur = this.playFull("death", ANIM_FADE.combatIn, false);
    this.state = "death";
    this.oneShotUntil = Number.POSITIVE_INFINITY;
    this.clearUpper();
    return dur;
  }

  playJump(): number {
    const dur = this.playFull("jump_start", ANIM_FADE.roll, false);
    this.state = "air";
    this.oneShotUntil = this.time + Math.max(0.2, dur);
    return dur;
  }

  // ── internals ────────────────────────────────────────────────────────────

  private locoRole(s: AnimGraphState): BaseSemanticRole {
    switch (s) {
      case "sprint":
        return "sprint";
      case "jog":
        return "jog";
      case "walk":
        return "walk";
      default:
        return "idle";
    }
  }

  private playFull(role: BaseSemanticRole, fade: number, loop: boolean): number {
    const clip = this.resolveClip(role);
    if (!clip) return 0;
    const key = baseLibraryKey(role);
    const action = this.getAction(key, clip, loop);
    this.crossfade(this.full, action, fade);
    this.full = action;
    this.fullKey = key;
    return clip.duration / Math.max(0.05, action.getEffectiveTimeScale());
  }

  private playUpperClip(
    clip: THREE.AnimationClip,
    key: string,
    fade: number,
    loop = false,
  ): number {
    const action = this.getAction(key, clip, loop);
    // Additive-ish: play at high weight without killing legs
    action.setEffectiveWeight(1);
    this.crossfade(this.upper, action, fade);
    this.upper = action;
    this.upperKey = key;
    return clip.duration / Math.max(0.05, action.getEffectiveTimeScale());
  }

  private clearUpper(): void {
    if (this.upper) {
      this.upper.fadeOut(ANIM_FADE.upper);
      this.upper = null;
      this.upperKey = null;
    }
  }

  private getAction(
    key: string,
    clip: THREE.AnimationClip,
    loop: boolean,
  ): THREE.AnimationAction {
    let a = this.actionCache.get(key);
    if (!a) {
      a = this.mixer.clipAction(clip);
      this.actionCache.set(key, a);
    }
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.enabled = true;
    return a;
  }

  private crossfade(
    from: THREE.AnimationAction | null,
    to: THREE.AnimationAction,
    fade: number,
  ): void {
    to.reset();
    to.setEffectiveWeight(1);
    to.play();
    if (from && from !== to) {
      to.crossFadeFrom(from, fade, true);
    } else {
      to.fadeIn(fade);
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actionCache.clear();
    this.full = null;
    this.upper = null;
  }
}

function wait(sec: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.max(0, sec) * 1000));
}
