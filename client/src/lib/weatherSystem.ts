import * as THREE from 'three';

export type WeatherState = 
  | 'clear' 
  | 'partly_cloudy' 
  | 'cloudy' 
  | 'light_rain' 
  | 'rain' 
  | 'heavy_rain' 
  | 'storm' 
  | 'hurricane';

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night' | 'midnight';

export interface CelestialEvent {
  type: 'meteor_shower' | 'aurora' | 'eclipse' | 'blood_moon' | 'shooting_star';
  intensity: number;
  duration: number;
  startTime: number;
}

export interface LightningBolt {
  id: string;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  branches: LightningBranch[];
  intensity: number;
  createdAt: number;
  duration: number;
  propagationProgress: number;
  flashIntensity: number;
}

export interface LightningBranch {
  points: THREE.Vector3[];
  intensity: number;
  delay: number;
}

export interface LightningFlash {
  intensity: number;
  startTime: number;
  duration: number;
  fadeProgress: number;
}

export interface WeatherConfig {
  state: WeatherState;
  windDirection: number;
  windStrength: number;
  waveHeight: number;
  waveFrequency: number;
  rainIntensity: number;
  cloudDensity: number;
  visibility: number;
  lightningFrequency: number;
  fogDensity: number;
}

export interface EnvironmentState {
  weather: WeatherConfig;
  timeOfDay: TimeOfDay;
  gameTime: number;
  dayProgress: number;
  sunPosition: THREE.Vector3;
  moonPosition: THREE.Vector3;
  moonPhase: number;
  ambientLight: THREE.Color;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  horizonColor: THREE.Color;
  celestialEvents: CelestialEvent[];
}

const WEATHER_PRESETS: Record<WeatherState, Partial<WeatherConfig>> = {
  clear: {
    // Glass-flat tropical baseline — the "see straight through to the seabed" look
    waveHeight: 0.08,
    waveFrequency: 0.55,
    rainIntensity: 0,
    cloudDensity: 0.04,
    visibility: 1.0,
    lightningFrequency: 0,
    fogDensity: 0,
  },
  partly_cloudy: {
    // Lazy scattered clouds, gentle swell — still a beautiful day
    waveHeight: 0.22,
    waveFrequency: 0.8,
    rainIntensity: 0,
    cloudDensity: 0.28,
    visibility: 0.97,
    lightningFrequency: 0,
    fogDensity: 0.01,
  },
  cloudy: {
    waveHeight: 0.6,
    waveFrequency: 1.2,
    rainIntensity: 0,
    cloudDensity: 0.65,
    visibility: 0.85,
    lightningFrequency: 0,
    fogDensity: 0.05,
  },
  light_rain: {
    waveHeight: 0.9,
    waveFrequency: 1.5,
    rainIntensity: 0.35,
    cloudDensity: 0.75,
    visibility: 0.7,
    lightningFrequency: 0,
    fogDensity: 0.12,
  },
  rain: {
    waveHeight: 1.4,
    waveFrequency: 1.8,
    rainIntensity: 0.65,
    cloudDensity: 0.85,
    visibility: 0.5,
    lightningFrequency: 0.08,
    fogDensity: 0.2,
  },
  heavy_rain: {
    waveHeight: 2.0,
    waveFrequency: 2.2,
    rainIntensity: 0.9,
    cloudDensity: 0.95,
    visibility: 0.3,
    lightningFrequency: 0.25,
    fogDensity: 0.35,
  },
  storm: {
    waveHeight: 3.5,
    waveFrequency: 2.8,
    rainIntensity: 1.0,
    cloudDensity: 1.0,
    visibility: 0.15,
    lightningFrequency: 0.5,
    fogDensity: 0.45,
  },
  hurricane: {
    waveHeight: 6.0,
    waveFrequency: 3.5,
    rainIntensity: 1.0,
    cloudDensity: 1.0,
    visibility: 0.05,
    lightningFrequency: 0.8,
    fogDensity: 0.6,
  },
};

const TIME_COLORS: Record<TimeOfDay, { sky: number; horizon: number; sun: number; ambient: number }> = {
  dawn: { sky: 0x1a1a4a, horizon: 0xff6b4a, sun: 0xff8c42, ambient: 0x3a3a6a },
  morning: { sky: 0x4a90c4, horizon: 0x87ceeb, sun: 0xfff5d4, ambient: 0x6699cc },
  noon: { sky: 0x66b8ff, horizon: 0xaaddff, sun: 0xffffff, ambient: 0x99ccff },
  afternoon: { sky: 0x5a9ed4, horizon: 0xf5deb3, sun: 0xffd700, ambient: 0x7ab8e6 },
  dusk: { sky: 0x2a2a5a, horizon: 0xff4500, sun: 0xff6347, ambient: 0x4a4a7a },
  night: { sky: 0x0a0a1a, horizon: 0x1a1a3a, sun: 0x333355, ambient: 0x1a1a3a },
  midnight: { sky: 0x050510, horizon: 0x0a0a20, sun: 0x222244, ambient: 0x0a0a2a },
};

export class WeatherSystem {
  private state: EnvironmentState;
  private transitionProgress: number = 1;
  private targetWeather: WeatherConfig | null = null;
  private transitionDuration: number = 5000;
  private lastUpdate: number = 0;
  private timeSpeed: number = 1;
  private celestialEventChance: number = 0.001;
  
  private lightningBolts: LightningBolt[] = [];
  private currentFlash: LightningFlash | null = null;
  private lastLightningTime: number = 0;
  private lightningCooldown: number = 500;
  private onLightningStrike?: (bolt: LightningBolt) => void;

  // Auto weather scheduler — biased heavily toward calm with rare drama.
  // Roll a new weather state every `autoScheduleInterval` seconds.
  private autoScheduleTimer: number = 0;
  private autoScheduleInterval: number = 90;
  private autoScheduleEnabled: boolean = true;

  constructor() {
    this.state = this.createInitialState();
  }

  setOnLightningStrike(callback: (bolt: LightningBolt) => void): void {
    this.onLightningStrike = callback;
  }

  private createInitialState(): EnvironmentState {
    const weather = this.createWeatherConfig('clear', 0, 5);
    return {
      weather,
      timeOfDay: 'noon',
      gameTime: 0.5,
      dayProgress: 0.5,
      sunPosition: new THREE.Vector3(0, 1, 0),
      moonPosition: new THREE.Vector3(0, -1, 0),
      moonPhase: 0.5,
      ambientLight: new THREE.Color(TIME_COLORS.noon.ambient),
      sunColor: new THREE.Color(TIME_COLORS.noon.sun),
      skyColor: new THREE.Color(TIME_COLORS.noon.sky),
      horizonColor: new THREE.Color(TIME_COLORS.noon.horizon),
      celestialEvents: [],
    };
  }

  private createWeatherConfig(state: WeatherState, windDir: number, windStrength: number): WeatherConfig {
    const preset = WEATHER_PRESETS[state];
    return {
      state,
      windDirection: windDir,
      windStrength,
      waveHeight: preset.waveHeight ?? 0.3,
      waveFrequency: preset.waveFrequency ?? 1.0,
      rainIntensity: preset.rainIntensity ?? 0,
      cloudDensity: preset.cloudDensity ?? 0.2,
      visibility: preset.visibility ?? 1.0,
      lightningFrequency: preset.lightningFrequency ?? 0,
      fogDensity: preset.fogDensity ?? 0,
    };
  }

  setWeather(state: WeatherState, transitionTime: number = 5000): void {
    this.targetWeather = this.createWeatherConfig(
      state,
      this.state.weather.windDirection,
      this.getWindStrengthForWeather(state)
    );
    this.transitionDuration = transitionTime;
    this.transitionProgress = 0;
  }

  private getWindStrengthForWeather(state: WeatherState): number {
    const windMap: Record<WeatherState, number> = {
      clear: 5,
      partly_cloudy: 8,
      cloudy: 12,
      light_rain: 18,
      rain: 25,
      heavy_rain: 35,
      storm: 50,
      hurricane: 80,
    };
    return windMap[state];
  }

  setTimeOfDay(time: TimeOfDay): void {
    this.state.timeOfDay = time;
    const timeMap: Record<TimeOfDay, number> = {
      dawn: 0.25,
      morning: 0.35,
      noon: 0.5,
      afternoon: 0.65,
      dusk: 0.75,
      night: 0.85,
      midnight: 0,
    };
    this.state.dayProgress = timeMap[time];
    this.updateCelestialPositions();
    this.updateColors();
  }

  setWindDirection(direction: number): void {
    this.state.weather.windDirection = direction;
  }

  setWindStrength(strength: number): void {
    this.state.weather.windStrength = Math.max(0, Math.min(50, strength));
  }

  setTimeSpeed(speed: number): void {
    this.timeSpeed = speed;
  }

  // ── Auto weather scheduler ────────────────────────────────────────────────
  // Call once per frame from the render loop (with deltaTime in seconds).
  // Picks a new weather state every `autoScheduleInterval` seconds using a
  // weighted table heavily biased toward "clear" — calm sailing baseline with
  // occasional dramatic weather. Long, eased transitions handle blending.
  setAutoScheduleEnabled(enabled: boolean): void {
    this.autoScheduleEnabled = enabled;
  }

  setAutoScheduleInterval(seconds: number): void {
    this.autoScheduleInterval = Math.max(10, seconds);
  }

  tickAutoSchedule(deltaTime: number): void {
    if (!this.autoScheduleEnabled) return;
    this.autoScheduleTimer += deltaTime;
    if (this.autoScheduleTimer < this.autoScheduleInterval) return;
    this.autoScheduleTimer = 0;
    if (this.targetWeather && this.transitionProgress < 1) return; // mid-transition

    const roll = Math.random();
    let next: WeatherState;
    if (roll < 0.62)       next = 'clear';          // 62%  glass-flat tropical
    else if (roll < 0.82)  next = 'partly_cloudy';  // 20%  scattered cloud
    else if (roll < 0.92)  next = 'cloudy';         // 10%  overcast
    else if (roll < 0.97)  next = 'light_rain';     //  5%  light rain
    else if (roll < 0.992) next = 'rain';           //  2.2% rain + lightning
    else if (roll < 0.999) next = 'storm';          //  0.7% rare storm
    else                   next = 'hurricane';      //  0.1% mythic event

    // Slow, dramatic transitions; bigger swings take longer to feel natural.
    const swing = Math.abs(this.weatherStateRank(next) - this.weatherStateRank(this.state.weather.state));
    const transitionMs = 8000 + swing * 4000;
    this.setWeather(next, transitionMs);
  }

  private weatherStateRank(s: WeatherState): number {
    const order: WeatherState[] = ['clear', 'partly_cloudy', 'cloudy', 'light_rain', 'rain', 'heavy_rain', 'storm', 'hurricane'];
    return order.indexOf(s);
  }

  update(deltaTime: number): void {
    const now = performance.now();
    
    if (this.targetWeather && this.transitionProgress < 1) {
      this.transitionProgress += (deltaTime * 1000) / this.transitionDuration;
      this.transitionProgress = Math.min(1, this.transitionProgress);
      this.lerpWeather();
      
      if (this.transitionProgress >= 1) {
        this.state.weather = { ...this.targetWeather };
        this.targetWeather = null;
      }
    }

    this.state.dayProgress += (deltaTime * this.timeSpeed) / (24 * 60);
    if (this.state.dayProgress > 1) this.state.dayProgress -= 1;
    if (this.state.dayProgress < 0) this.state.dayProgress += 1;
    
    this.updateTimeOfDay();
    this.updateCelestialPositions();
    this.updateColors();
    this.updateCelestialEvents(deltaTime);
    
    this.state.moonPhase = (this.state.moonPhase + deltaTime * 0.001 * this.timeSpeed) % 1;
    
    this.lastUpdate = now;
  }

  private lerpWeather(): void {
    if (!this.targetWeather) return;
    
    const t = this.easeInOutCubic(this.transitionProgress);
    const current = this.state.weather;
    const target = this.targetWeather;
    
    current.waveHeight = THREE.MathUtils.lerp(current.waveHeight, target.waveHeight, t);
    current.waveFrequency = THREE.MathUtils.lerp(current.waveFrequency, target.waveFrequency, t);
    current.rainIntensity = THREE.MathUtils.lerp(current.rainIntensity, target.rainIntensity, t);
    current.cloudDensity = THREE.MathUtils.lerp(current.cloudDensity, target.cloudDensity, t);
    current.visibility = THREE.MathUtils.lerp(current.visibility, target.visibility, t);
    current.lightningFrequency = THREE.MathUtils.lerp(current.lightningFrequency, target.lightningFrequency, t);
    current.fogDensity = THREE.MathUtils.lerp(current.fogDensity, target.fogDensity, t);
    current.windStrength = THREE.MathUtils.lerp(current.windStrength, target.windStrength, t);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private updateTimeOfDay(): void {
    const p = this.state.dayProgress;
    
    if (p >= 0 && p < 0.2) this.state.timeOfDay = 'midnight';
    else if (p >= 0.2 && p < 0.3) this.state.timeOfDay = 'dawn';
    else if (p >= 0.3 && p < 0.45) this.state.timeOfDay = 'morning';
    else if (p >= 0.45 && p < 0.55) this.state.timeOfDay = 'noon';
    else if (p >= 0.55 && p < 0.7) this.state.timeOfDay = 'afternoon';
    else if (p >= 0.7 && p < 0.8) this.state.timeOfDay = 'dusk';
    else this.state.timeOfDay = 'night';
  }

  private updateCelestialPositions(): void {
    const sunAngle = (this.state.dayProgress - 0.25) * Math.PI * 2;
    this.state.sunPosition.set(
      Math.cos(sunAngle) * 100,
      Math.sin(sunAngle) * 100,
      Math.sin(sunAngle * 0.5) * 30
    );
    
    const moonAngle = sunAngle + Math.PI;
    this.state.moonPosition.set(
      Math.cos(moonAngle) * 80,
      Math.sin(moonAngle) * 80,
      Math.sin(moonAngle * 0.3) * 20
    );
  }

  private updateColors(): void {
    const colors = TIME_COLORS[this.state.timeOfDay];
    const weatherMod = 1 - (this.state.weather.cloudDensity * 0.5);
    
    this.state.skyColor.setHex(colors.sky);
    this.state.horizonColor.setHex(colors.horizon);
    this.state.sunColor.setHex(colors.sun);
    this.state.ambientLight.setHex(colors.ambient);
    
    if (this.state.weather.cloudDensity > 0.5) {
      const stormGray = new THREE.Color(0x333340);
      this.state.skyColor.lerp(stormGray, this.state.weather.cloudDensity - 0.5);
      this.state.horizonColor.lerp(stormGray, (this.state.weather.cloudDensity - 0.5) * 0.7);
    }
  }

  private updateCelestialEvents(deltaTime: number): void {
    this.state.celestialEvents = this.state.celestialEvents.filter(event => {
      event.duration -= deltaTime;
      return event.duration > 0;
    });

    if (this.state.timeOfDay === 'night' || this.state.timeOfDay === 'midnight') {
      if (Math.random() < this.celestialEventChance * deltaTime) {
        this.triggerCelestialEvent();
      }
    }
  }

  private triggerCelestialEvent(): void {
    const events: CelestialEvent['type'][] = ['shooting_star', 'meteor_shower', 'aurora'];
    const type = events[Math.floor(Math.random() * events.length)];
    
    this.state.celestialEvents.push({
      type,
      intensity: 0.5 + Math.random() * 0.5,
      duration: type === 'shooting_star' ? 2 : (10 + Math.random() * 20),
      startTime: performance.now(),
    });
  }

  getState(): EnvironmentState {
    return this.state;
  }

  getOceanUniforms(): Record<string, { value: number | THREE.Vector3 | THREE.Color }> {
    const windRad = (this.state.weather.windDirection * Math.PI) / 180;
    return {
      uTime: { value: 0 },
      uWaveHeight: { value: this.state.weather.waveHeight },
      uWaveFrequency: { value: this.state.weather.waveFrequency },
      uWindDirection: { value: new THREE.Vector3(Math.sin(windRad), 0, Math.cos(windRad)) },
      uWindStrength: { value: this.state.weather.windStrength },
      uDeepColor: { value: new THREE.Color(0x0a1a2a) },
      uShallowColor: { value: new THREE.Color(0x1e90ff) },
      uFoamColor: { value: new THREE.Color(0xffffff) },
      uSunDirection: { value: this.state.sunPosition.clone().normalize() },
      uSunColor: { value: this.state.sunColor.clone() },
      uVisibility: { value: this.state.weather.visibility },
      uStormIntensity: { value: this.getStormIntensity() },
    };
  }

  getStormIntensity(): number {
    const intensityMap: Record<WeatherState, number> = {
      clear: 0,
      partly_cloudy: 0,
      cloudy: 0.1,
      light_rain: 0.2,
      rain: 0.4,
      heavy_rain: 0.6,
      storm: 0.85,
      hurricane: 1.0,
    };
    return intensityMap[this.state.weather.state];
  }

  shouldTriggerLightning(): boolean {
    return this.state.weather.lightningFrequency > 0 && 
           Math.random() < this.state.weather.lightningFrequency * 0.016;
  }

  getRainConfig(): { intensity: number; count: number; speed: number; size: number } {
    const intensity = this.state.weather.rainIntensity;
    return {
      intensity,
      count: Math.floor(intensity * 5000),
      speed: 10 + intensity * 20,
      size: 0.02 + intensity * 0.03,
    };
  }

  triggerLightning(centerPosition?: THREE.Vector3): LightningBolt | null {
    const now = performance.now();
    if (now - this.lastLightningTime < this.lightningCooldown) return null;
    
    this.lastLightningTime = now;
    const center = centerPosition || new THREE.Vector3(0, 0, 0);
    
    const startPos = new THREE.Vector3(
      center.x + (Math.random() - 0.5) * 200,
      80 + Math.random() * 40,
      center.z + (Math.random() - 0.5) * 200
    );
    
    const endPos = new THREE.Vector3(
      startPos.x + (Math.random() - 0.5) * 30,
      0,
      startPos.z + (Math.random() - 0.5) * 30
    );
    
    const branches = this.generateLightningBranches(startPos, endPos);
    
    const bolt: LightningBolt = {
      id: `lightning-${now}`,
      startPosition: startPos,
      endPosition: endPos,
      branches,
      intensity: 0.8 + Math.random() * 0.2,
      createdAt: now,
      duration: 150 + Math.random() * 100,
      propagationProgress: 0,
      flashIntensity: 1.0
    };
    
    this.lightningBolts.push(bolt);
    
    this.currentFlash = {
      intensity: bolt.intensity,
      startTime: now,
      duration: 300 + Math.random() * 200,
      fadeProgress: 0
    };
    
    if (this.onLightningStrike) {
      this.onLightningStrike(bolt);
    }
    
    return bolt;
  }

  private generateLightningBranches(start: THREE.Vector3, end: THREE.Vector3): LightningBranch[] {
    const branches: LightningBranch[] = [];
    const mainPoints = this.generateBoltPath(start, end, 8, 0.15);
    
    branches.push({
      points: mainPoints,
      intensity: 1.0,
      delay: 0
    });
    
    const branchCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < branchCount; i++) {
      const splitIndex = 2 + Math.floor(Math.random() * (mainPoints.length - 4));
      const splitPoint = mainPoints[splitIndex];
      
      const branchDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        -0.5 - Math.random() * 0.5,
        (Math.random() - 0.5) * 2
      ).normalize();
      
      const branchLength = 15 + Math.random() * 25;
      const branchEnd = splitPoint.clone().add(branchDir.multiplyScalar(branchLength));
      
      const branchPoints = this.generateBoltPath(splitPoint, branchEnd, 4, 0.1);
      
      branches.push({
        points: branchPoints,
        intensity: 0.4 + Math.random() * 0.3,
        delay: 10 + Math.random() * 30
      });
    }
    
    return branches;
  }

  private generateBoltPath(start: THREE.Vector3, end: THREE.Vector3, segments: number, jitter: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [start.clone()];
    const direction = end.clone().sub(start);
    const length = direction.length();
    
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const basePoint = start.clone().add(direction.clone().multiplyScalar(t));
      
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * length * jitter,
        (Math.random() - 0.5) * length * jitter * 0.3,
        (Math.random() - 0.5) * length * jitter
      );
      
      points.push(basePoint.add(offset));
    }
    
    points.push(end.clone());
    return points;
  }

  updateLightning(deltaTime: number): void {
    const now = performance.now();
    
    this.lightningBolts = this.lightningBolts.filter(bolt => {
      const age = now - bolt.createdAt;
      bolt.propagationProgress = Math.min(1, age / (bolt.duration * 0.3));
      bolt.flashIntensity = Math.max(0, 1 - (age / bolt.duration));
      return age < bolt.duration;
    });
    
    if (this.currentFlash) {
      const flashAge = now - this.currentFlash.startTime;
      this.currentFlash.fadeProgress = Math.min(1, flashAge / this.currentFlash.duration);
      
      if (this.currentFlash.fadeProgress >= 1) {
        this.currentFlash = null;
      }
    }
    
    if (this.shouldTriggerLightning()) {
      this.triggerLightning();
    }
  }

  getLightningBolts(): LightningBolt[] {
    return this.lightningBolts;
  }

  getCurrentFlash(): LightningFlash | null {
    return this.currentFlash;
  }

  getFlashIntensity(): number {
    if (!this.currentFlash) return 0;
    const flashCurve = 1 - Math.pow(this.currentFlash.fadeProgress, 0.5);
    return this.currentFlash.intensity * flashCurve;
  }
}

export const globalWeather = new WeatherSystem();
