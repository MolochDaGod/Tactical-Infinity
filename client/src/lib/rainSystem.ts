import * as THREE from 'three';

export interface RainConfig {
  count: number;
  speed: number;
  size: number;
  intensity: number;
  windDirection: THREE.Vector3;
  windStrength: number;
  areaSize: number;
  height: number;
}

// Vertex shader notes:
//  • `dropIndex` (per-particle 0..1 ratio) gates visibility against
//    `uIntensity` so light rain hides most drops without rebuilding the
//    geometry. The previous code disposed and recreated the whole BufferGeometry
//    whenever intensity drifted by 5% — visible pop and GC churn.
//  • gl_PointSize bumped (and floored) so the streak fragment actually has
//    enough pixels to read as a streak; the previous 0.03 base produced
//    ~1px squares at typical camera distances.
const rainVertexShader = `
attribute float size;
attribute float velocity;
attribute float dropIndex;

uniform float uTime;
uniform float uHeight;
uniform float uAreaSize;
uniform float uIntensity;
uniform vec3 uWindDirection;
uniform float uWindStrength;

varying float vAlpha;

void main() {
  vec3 pos = position;

  // Hide drops above the active fraction by collapsing them to the camera
  // (alpha 0 + tiny size = effectively culled, no branches needed).
  float visible = step(dropIndex, uIntensity);

  float fallDistance = mod(uTime * velocity + position.y, uHeight);
  pos.y = uHeight - fallDistance;

  pos.xz += uWindDirection.xz * uWindStrength * (1.0 - fallDistance / uHeight) * 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Bigger base point so the streak fragment has pixels to work with.
  gl_PointSize = size * (900.0 / -mvPosition.z) * visible;
  gl_Position = projectionMatrix * mvPosition;

  vAlpha = (0.35 + 0.35 * (1.0 - fallDistance / uHeight)) * visible;
}
`;

// Streak-shaped fragment: render each point as a vertical teardrop instead of
// a circular splat. The previous version discarded everything outside a 0.5
// radius — that turned the stretched gl_PointSize back into a round dot. Now
// we keep a thin vertical column with a soft top→bottom gradient so the drop
// reads as motion-blurred rain.
const rainFragmentShader = `
varying float vAlpha;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  // Thin vertical streak: tight on X, full height on Y.
  float xMask = smoothstep(0.30, 0.10, abs(coord.x));
  if (xMask <= 0.001) discard;
  // Brighter at the head, fading at the tail.
  float yFade = smoothstep(0.5, -0.5, coord.y);
  float alpha = vAlpha * xMask * yFade;
  gl_FragColor = vec4(0.72, 0.78, 0.92, alpha);
}
`;

export class RainSystem {
  private particles: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private config: RainConfig;
  private scene: THREE.Scene | null = null;
  private active: boolean = false;

  constructor(config?: Partial<RainConfig>) {
    this.config = {
      count: 5000,
      speed: 15,
      size: 0.03,
      intensity: 0.5,
      windDirection: new THREE.Vector3(1, 0, 0),
      windStrength: 5,
      areaSize: 100,
      height: 50,
      ...config,
    };
  }

  init(scene: THREE.Scene): void {
    this.scene = scene;
    this.createRain();
  }

  // Allocate the full pool once. Per-particle visibility is then driven by
  // the uIntensity uniform inside the vertex shader (cheaper than rebuilding
  // BufferGeometry on every weather tick, and eliminates the visible pop
  // when storms ramp up/down).
  private createRain(): void {
    if (!this.scene) return;

    this.dispose();

    const count = this.config.count;
    if (count === 0) return;

    const positions   = new Float32Array(count * 3);
    const sizes       = new Float32Array(count);
    const velocities  = new Float32Array(count);
    const dropIndex   = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3]     = (Math.random() - 0.5) * this.config.areaSize;
      positions[i3 + 1] = Math.random() * this.config.height;
      positions[i3 + 2] = (Math.random() - 0.5) * this.config.areaSize;

      sizes[i]      = this.config.size * (0.8 + Math.random() * 0.4);
      velocities[i] = this.config.speed * (0.7 + Math.random() * 0.6);
      // Uniform 0..1 ratio — vertex shader compares against uIntensity.
      // Pre-shuffled so densities scale evenly across the area.
      dropIndex[i]  = (i + 0.5) / count;
    }
    // Fisher-Yates shuffle of dropIndex so the visible subset isn't spatially
    // biased toward early-allocated points.
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = dropIndex[i]; dropIndex[i] = dropIndex[j]; dropIndex[j] = tmp;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position',  new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('size',      new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('velocity',  new THREE.BufferAttribute(velocities, 1));
    this.geometry.setAttribute('dropIndex', new THREE.BufferAttribute(dropIndex, 1));

    // Manual bounding sphere — the position attribute is centred on origin and
    // the rain box never moves relative to its parent (we move the Points group
    // instead). Setting it explicitly avoids `computeBoundingSphere()` ever
    // trying to walk the buffer (cheap + future-proof against any NaN drift,
    // mirroring the OpenWaterSailing wake/wind-streak fix).
    const r = Math.hypot(this.config.areaSize * 0.5, this.config.height * 0.5, this.config.areaSize * 0.5);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, this.config.height * 0.5, 0), r);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:          { value: 0 },
        uHeight:        { value: this.config.height },
        uAreaSize:      { value: this.config.areaSize },
        uIntensity:     { value: this.config.intensity },
        uWindDirection: { value: this.config.windDirection },
        uWindStrength:  { value: this.config.windStrength },
      },
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.active = true;
  }

  update(time: number, cameraPosition?: THREE.Vector3): void {
    if (!this.material || !this.particles || !this.active) return;

    this.material.uniforms.uTime.value = time;

    if (cameraPosition) {
      this.particles.position.x = cameraPosition.x;
      this.particles.position.z = cameraPosition.z;
    }
  }

  setIntensity(intensity: number): void {
    const newIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
    this.config.intensity = newIntensity;
    // Cheap path — just push to the uniform; the vertex shader culls drops
    // above the active fraction. No geometry rebuild, no GC, no pop.
    if (this.material) {
      this.material.uniforms.uIntensity.value = newIntensity;
    } else if (newIntensity > 0 && this.scene) {
      // Cold start case — pool wasn't built yet (init() with intensity=0).
      this.createRain();
    }
  }

  setWindDirection(direction: THREE.Vector3): void {
    this.config.windDirection.copy(direction);
    if (this.material) {
      this.material.uniforms.uWindDirection.value = this.config.windDirection;
    }
  }

  setWindStrength(strength: number): void {
    this.config.windStrength = strength;
    if (this.material) {
      this.material.uniforms.uWindStrength.value = strength;
    }
  }

  setSpeed(speed: number): void {
    this.config.speed = speed;
    if (this.geometry && this.config.intensity > 0) {
      const velocities = this.geometry.getAttribute('velocity');
      const count = velocities.count;
      for (let i = 0; i < count; i++) {
        velocities.setX(i, speed * (0.7 + Math.random() * 0.6));
      }
      velocities.needsUpdate = true;
    }
  }

  start(): void {
    if (!this.active && this.scene) {
      this.createRain();
    }
  }

  stop(): void {
    this.dispose();
    this.active = false;
  }

  dispose(): void {
    if (this.particles && this.scene) {
      this.scene.remove(this.particles);
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    this.particles = null;
  }

  isActive(): boolean {
    return this.active;
  }
}

export class LightningSystem {
  private scene: THREE.Scene | null = null;
  private flashLight: THREE.PointLight | null = null;
  private isFlashing: boolean = false;
  private flashDuration: number = 0;
  private flashIntensity: number = 0;

  init(scene: THREE.Scene): void {
    this.scene = scene;
    
    this.flashLight = new THREE.PointLight(0xaaccff, 0, 500);
    this.flashLight.position.set(0, 100, 0);
    scene.add(this.flashLight);
  }

  triggerLightning(intensity: number = 1): void {
    if (this.isFlashing || !this.flashLight) return;
    
    this.isFlashing = true;
    this.flashDuration = 0;
    this.flashIntensity = intensity * (2 + Math.random() * 3);
    this.flashLight.intensity = this.flashIntensity;
    
    this.flashLight.position.set(
      (Math.random() - 0.5) * 200,
      80 + Math.random() * 40,
      (Math.random() - 0.5) * 200
    );
  }

  update(deltaTime: number): void {
    if (!this.isFlashing || !this.flashLight) return;
    
    this.flashDuration += deltaTime;
    
    const flickerPattern = [
      { time: 0, intensity: 1 },
      { time: 0.05, intensity: 0.3 },
      { time: 0.1, intensity: 0.8 },
      { time: 0.15, intensity: 0.1 },
      { time: 0.2, intensity: 0.6 },
      { time: 0.3, intensity: 0 },
    ];
    
    for (let i = 0; i < flickerPattern.length - 1; i++) {
      if (this.flashDuration >= flickerPattern[i].time && this.flashDuration < flickerPattern[i + 1].time) {
        const t = (this.flashDuration - flickerPattern[i].time) / (flickerPattern[i + 1].time - flickerPattern[i].time);
        const intensity = THREE.MathUtils.lerp(
          flickerPattern[i].intensity,
          flickerPattern[i + 1].intensity,
          t
        );
        this.flashLight.intensity = intensity * this.flashIntensity;
        return;
      }
    }
    
    if (this.flashDuration >= 0.3) {
      this.isFlashing = false;
      this.flashLight.intensity = 0;
    }
  }

  dispose(): void {
    if (this.flashLight && this.scene) {
      this.scene.remove(this.flashLight);
      this.flashLight.dispose();
    }
    this.flashLight = null;
  }
}
