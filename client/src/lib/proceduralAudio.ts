// Procedural Storm Audio System using Web Audio API
// Generates dynamic storm sounds: thunder, rain, wind, waves

export class ProceduralStormAudio {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private isMuted = false;
  
  // Sound layer nodes
  private windOsc: OscillatorNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  
  private rainNoise: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  
  private waveOsc: OscillatorNode | null = null;
  private waveGain: GainNode | null = null;
  private waveLfo: OscillatorNode | null = null;
  private waveLfoGain: GainNode | null = null;
  
  private thunderTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Storm intensity (0-1)
  private stormIntensity = 0.5;
  
  constructor() {
    // AudioContext created on user interaction
  }
  
  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }
  
  // Create white noise buffer for rain
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ensureContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
  
  // Create brown noise for deeper wind sounds
  private createBrownNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ensureContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Boost volume
    }
    return buffer;
  }
  
  private startWind(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    
    // Brown noise for wind base
    const brownBuffer = this.createBrownNoiseBuffer(4);
    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = brownBuffer;
    brownNoise.loop = true;
    
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400 + this.stormIntensity * 600;
    this.windFilter.Q.value = 1;
    
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.15 + this.stormIntensity * 0.2;
    
    brownNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    
    brownNoise.start();
    this.windOsc = brownNoise as unknown as OscillatorNode;
    
    // Modulate wind filter for gusts
    this.modulateWind();
  }
  
  private modulateWind(): void {
    if (!this.windFilter || !this.isPlaying) return;
    
    const gustDuration = 2000 + Math.random() * 4000;
    const targetFreq = 300 + Math.random() * 800 * this.stormIntensity;
    
    this.windFilter.frequency.linearRampToValueAtTime(
      targetFreq,
      this.audioContext!.currentTime + gustDuration / 1000
    );
    
    if (this.windGain) {
      const targetGain = 0.1 + Math.random() * 0.25 * this.stormIntensity;
      this.windGain.gain.linearRampToValueAtTime(
        targetGain,
        this.audioContext!.currentTime + gustDuration / 1000
      );
    }
    
    setTimeout(() => this.modulateWind(), gustDuration);
  }
  
  private startRain(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    
    const noiseBuffer = this.createNoiseBuffer(2);
    this.rainNoise = ctx.createBufferSource();
    this.rainNoise.buffer = noiseBuffer;
    this.rainNoise.loop = true;
    
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'highpass';
    this.rainFilter.frequency.value = 1000;
    this.rainFilter.Q.value = 0.5;
    
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000;
    
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.08 + this.stormIntensity * 0.12;
    
    this.rainNoise.connect(this.rainFilter);
    this.rainFilter.connect(lowpass);
    lowpass.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    
    this.rainNoise.start();
  }
  
  private startWaves(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    
    // Low frequency oscillator for wave swoosh
    this.waveOsc = ctx.createOscillator();
    this.waveOsc.type = 'sine';
    this.waveOsc.frequency.value = 0.15; // Very slow wave cycle
    
    this.waveLfoGain = ctx.createGain();
    this.waveLfoGain.gain.value = 200;
    
    // Noise source filtered for wave sound
    const waveBuffer = this.createBrownNoiseBuffer(4);
    const waveNoise = ctx.createBufferSource();
    waveNoise.buffer = waveBuffer;
    waveNoise.loop = true;
    
    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.value = 300;
    
    // LFO modulates filter for wave rhythm
    this.waveOsc.connect(this.waveLfoGain);
    this.waveLfoGain.connect(waveFilter.frequency);
    
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0.12 + this.stormIntensity * 0.15;
    
    waveNoise.connect(waveFilter);
    waveFilter.connect(this.waveGain);
    this.waveGain.connect(this.masterGain);
    
    this.waveOsc.start();
    waveNoise.start();
    
    this.waveLfo = waveNoise as unknown as OscillatorNode;
  }
  
  private scheduleThunder(): void {
    if (!this.isPlaying) return;
    
    // Random thunder timing based on storm intensity
    const minDelay = 8000 / (this.stormIntensity + 0.5);
    const maxDelay = 25000 / (this.stormIntensity + 0.5);
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    
    this.thunderTimeout = setTimeout(() => {
      this.playThunder();
      this.scheduleThunder();
    }, delay);
  }
  
  private playThunder(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain || this.isMuted) return;
    
    const now = ctx.currentTime;
    
    // Thunder rumble using brown noise
    const rumbleBuffer = this.createBrownNoiseBuffer(3);
    const rumble = ctx.createBufferSource();
    rumble.buffer = rumbleBuffer;
    
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 150 + Math.random() * 100;
    
    const rumbleGain = ctx.createGain();
    const thunderVolume = 0.3 + Math.random() * 0.4 * this.stormIntensity;
    
    // Thunder envelope: quick attack, long decay
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(thunderVolume, now + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(thunderVolume * 0.6, now + 0.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
    
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    
    rumble.start(now);
    rumble.stop(now + 3);
    
    // Add some crackle at the start
    const crackleBuffer = this.createNoiseBuffer(0.5);
    const crackle = ctx.createBufferSource();
    crackle.buffer = crackleBuffer;
    
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.value = 2000 + Math.random() * 2000;
    crackleFilter.Q.value = 2;
    
    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0, now);
    crackleGain.gain.linearRampToValueAtTime(0.15 * this.stormIntensity, now + 0.01);
    crackleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(this.masterGain);
    
    crackle.start(now);
    crackle.stop(now + 0.5);
  }
  
  public setIntensity(intensity: number): void {
    this.stormIntensity = Math.max(0, Math.min(1, intensity));
    
    if (this.windGain) {
      this.windGain.gain.value = 0.15 + this.stormIntensity * 0.2;
    }
    if (this.windFilter) {
      this.windFilter.frequency.value = 400 + this.stormIntensity * 600;
    }
    if (this.rainGain) {
      this.rainGain.gain.value = 0.08 + this.stormIntensity * 0.12;
    }
    if (this.waveGain) {
      this.waveGain.gain.value = 0.12 + this.stormIntensity * 0.15;
    }
  }
  
  public setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  public mute(): void {
    this.isMuted = true;
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }
  
  public unmute(): void {
    this.isMuted = false;
    if (this.masterGain) {
      this.masterGain.gain.value = 0.3;
    }
  }
  
  public toggleMute(): boolean {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }
  
  public start(): void {
    if (this.isPlaying) return;
    
    this.ensureContext();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.isPlaying = true;
    this.startWind();
    this.startRain();
    this.startWaves();
    this.scheduleThunder();
    
    console.log('Storm audio started');
  }
  
  public stop(): void {
    this.isPlaying = false;
    
    if (this.thunderTimeout) {
      clearTimeout(this.thunderTimeout);
      this.thunderTimeout = null;
    }
    
    // Fade out before stopping
    if (this.masterGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }
    
    setTimeout(() => {
      try {
        if (this.windOsc) {
          (this.windOsc as any).stop?.();
          this.windOsc = null;
        }
        if (this.rainNoise) {
          this.rainNoise.stop();
          this.rainNoise = null;
        }
        if (this.waveOsc) {
          this.waveOsc.stop();
          this.waveOsc = null;
        }
        if (this.waveLfo) {
          (this.waveLfo as any).stop?.();
          this.waveLfo = null;
        }
      } catch (e) {
        // Ignore already stopped errors
      }
      
      console.log('Storm audio stopped');
    }, 600);
  }
  
  public dispose(): void {
    this.stop();
    
    setTimeout(() => {
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    }, 700);
  }
}

// Singleton instance for easy access
let stormAudioInstance: ProceduralStormAudio | null = null;

export function getStormAudio(): ProceduralStormAudio {
  if (!stormAudioInstance) {
    stormAudioInstance = new ProceduralStormAudio();
  }
  return stormAudioInstance;
}

export function disposeStormAudio(): void {
  if (stormAudioInstance) {
    stormAudioInstance.dispose();
    stormAudioInstance = null;
  }
}
