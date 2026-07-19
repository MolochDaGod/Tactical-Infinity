/**
 * Procedural deep-sea creature audio for the storm intro.
 * Used when CDN /audio/kraken*.m4a is missing (SPA HTML 404).
 */
export class ProceduralMonsterAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private approachPlayed = false;
  private strikePlayed = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  reset() {
    this.approachPlayed = false;
    this.strikePlayed = false;
  }

  /** Low sub-rumble + wet growl — beast rising */
  playApproach() {
    if (this.muted || this.approachPlayed) return;
    this.approachPlayed = true;
    try {
      const ctx = this.ensure();
      if (!this.master) return;
      const now = ctx.currentTime;
      this.roar(now, {
        dur: 2.8,
        baseFreq: 48,
        peak: 0.55,
        growl: true,
      });
      this.splash(now + 0.4, 0.25);
    } catch (e) {
      console.warn('[MonsterAudio] approach failed', e);
    }
  }

  /** Hard impact roar — tentacles hit the ship */
  playStrike() {
    if (this.muted || this.strikePlayed) return;
    this.strikePlayed = true;
    try {
      const ctx = this.ensure();
      if (!this.master) return;
      const now = ctx.currentTime;
      this.roar(now, {
        dur: 1.8,
        baseFreq: 72,
        peak: 0.85,
        growl: true,
      });
      this.roar(now + 0.12, {
        dur: 1.2,
        baseFreq: 110,
        peak: 0.45,
        growl: false,
      });
      this.crack(now, 0.5);
      this.splash(now + 0.05, 0.4);
    } catch (e) {
      console.warn('[MonsterAudio] strike failed', e);
    }
  }

  private noiseBuffer(sec: number, brown = false): AudioBuffer {
    const ctx = this.ensure();
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.2;
      } else {
        d[i] = white;
      }
    }
    return buf;
  }

  private roar(
    when: number,
    opts: { dur: number; baseFreq: number; peak: number; growl: boolean },
  ) {
    const ctx = this.ensure();
    if (!this.master) return;

    // Sub oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(opts.baseFreq, when);
    osc.frequency.exponentialRampToValueAtTime(opts.baseFreq * 0.55, when + opts.dur);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(180, when);
    filt.frequency.linearRampToValueAtTime(90, when + opts.dur);
    filt.Q.value = 2.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(opts.peak, when + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, when + opts.dur);

    osc.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + opts.dur + 0.05);

    if (opts.growl) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer(opts.dur, true);
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 220;
      nf.Q.value = 0.8;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, when);
      ng.gain.exponentialRampToValueAtTime(opts.peak * 0.35, when + 0.1);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + opts.dur);
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(this.master);
      noise.start(when);
      noise.stop(when + opts.dur);
    }
  }

  private crack(when: number, peak: number) {
    const ctx = this.ensure();
    if (!this.master) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.35, false);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    noise.connect(f);
    f.connect(g);
    g.connect(this.master);
    noise.start(when);
    noise.stop(when + 0.35);
  }

  private splash(when: number, peak: number) {
    const ctx = this.ensure();
    if (!this.master) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.8, false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 650;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.7);
    noise.connect(f);
    f.connect(g);
    g.connect(this.master);
    noise.start(when);
    noise.stop(when + 0.8);
  }
}

let singleton: ProceduralMonsterAudio | null = null;
export function getMonsterAudio(): ProceduralMonsterAudio {
  if (!singleton) singleton = new ProceduralMonsterAudio();
  return singleton;
}
