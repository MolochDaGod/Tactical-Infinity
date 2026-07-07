import * as THREE from 'three';

const skyVertexShader = `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const skyFragmentShader = `
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunPosition;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform float uCloudDensity;
uniform float uTime;
uniform float uStormIntensity;
uniform float uDayProgress;

varying vec3 vWorldPosition;
varying vec2 vUv;

#define PI 3.14159265359

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float clouds(vec2 uv, float time) {
  vec2 motion = vec2(time * 0.02, time * 0.01);
  float n1 = fbm(uv * 2.0 + motion);
  float n2 = fbm(uv * 4.0 - motion * 1.5);
  float n3 = fbm(uv * 8.0 + motion * 0.5);
  return (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
}

float stars(vec2 uv) {
  vec2 gridUv = fract(uv * 100.0);
  vec2 gridId = floor(uv * 100.0);
  float starRand = hash(gridId);
  
  if (starRand > 0.98) {
    float dist = length(gridUv - 0.5);
    float twinkle = sin(uTime * (3.0 + starRand * 5.0) + starRand * 100.0) * 0.3 + 0.7;
    return smoothstep(0.05, 0.0, dist) * twinkle * starRand;
  }
  return 0.0;
}

void main() {
  vec3 viewDir = normalize(vWorldPosition);
  float horizonMix = smoothstep(-0.1, 0.4, viewDir.y);
  
  vec3 skyGradient = mix(uHorizonColor, uSkyColor, horizonMix);
  
  if (uCloudDensity > 0.0) {
    vec2 cloudUv = viewDir.xz / max(0.1, viewDir.y) * 0.5;
    float cloudNoise = clouds(cloudUv, uTime);
    
    float cloudThreshold = 1.0 - uCloudDensity;
    float cloudAmount = smoothstep(cloudThreshold - 0.1, cloudThreshold + 0.2, cloudNoise);
    
    vec3 cloudColor = mix(vec3(1.0), vec3(0.3, 0.35, 0.4), uStormIntensity);
    vec3 cloudShadow = mix(vec3(0.7, 0.75, 0.8), vec3(0.15, 0.18, 0.22), uStormIntensity);
    
    float cloudShading = smoothstep(0.3, 0.7, cloudNoise);
    vec3 finalCloud = mix(cloudShadow, cloudColor, cloudShading);
    
    skyGradient = mix(skyGradient, finalCloud, cloudAmount * 0.8);
  }
  
  vec3 sunDir = normalize(uSunPosition);
  float sunAngle = max(0.0, dot(viewDir, sunDir));
  
  float sunDisc = smoothstep(0.995, 0.9999, sunAngle);
  float sunGlow = pow(sunAngle, 32.0) * 0.5 * uSunIntensity;
  float sunHalo = pow(sunAngle, 8.0) * 0.2 * uSunIntensity;
  
  sunGlow *= (1.0 - uCloudDensity * 0.7);
  sunDisc *= (1.0 - uCloudDensity * 0.9);
  
  skyGradient += uSunColor * (sunDisc + sunGlow + sunHalo);
  
  float isNight = smoothstep(0.25, 0.1, uDayProgress) + smoothstep(0.75, 0.9, uDayProgress);
  isNight = min(1.0, isNight);
  
  if (isNight > 0.0 && viewDir.y > 0.0 && uCloudDensity < 0.7) {
    vec2 starUv = viewDir.xz / max(0.1, viewDir.y);
    float starBrightness = stars(starUv) * isNight * (1.0 - uCloudDensity);
    skyGradient += vec3(starBrightness);
  }
  
  gl_FragColor = vec4(skyGradient, 1.0);
}
`;

export class SkySystem {
  private skyMesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private scene: THREE.Scene | null = null;

  init(scene: THREE.Scene): void {
    this.scene = scene;
    
    const geometry = new THREE.SphereGeometry(450, 32, 32);
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSkyColor: { value: new THREE.Color(0x66b8ff) },
        uHorizonColor: { value: new THREE.Color(0xaaddff) },
        uSunPosition: { value: new THREE.Vector3(100, 100, 50) },
        uSunColor: { value: new THREE.Color(0xffffff) },
        uSunIntensity: { value: 1.0 },
        uCloudDensity: { value: 0.2 },
        uTime: { value: 0 },
        uStormIntensity: { value: 0 },
        uDayProgress: { value: 0.5 },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });
    
    this.skyMesh = new THREE.Mesh(geometry, this.material);
    scene.add(this.skyMesh);
  }

  update(time: number): void {
    if (!this.material) return;
    this.material.uniforms.uTime.value = time;
  }

  setSkyColors(sky: THREE.Color, horizon: THREE.Color): void {
    if (!this.material) return;
    this.material.uniforms.uSkyColor.value = sky;
    this.material.uniforms.uHorizonColor.value = horizon;
  }

  setSunPosition(position: THREE.Vector3): void {
    if (!this.material) return;
    this.material.uniforms.uSunPosition.value = position;
  }

  setSunColor(color: THREE.Color, intensity: number): void {
    if (!this.material) return;
    this.material.uniforms.uSunColor.value = color;
    this.material.uniforms.uSunIntensity.value = intensity;
  }

  setCloudDensity(density: number): void {
    if (!this.material) return;
    this.material.uniforms.uCloudDensity.value = Math.max(0, Math.min(1, density));
  }

  setStormIntensity(intensity: number): void {
    if (!this.material) return;
    this.material.uniforms.uStormIntensity.value = Math.max(0, Math.min(1, intensity));
  }

  setDayProgress(progress: number): void {
    if (!this.material) return;
    this.material.uniforms.uDayProgress.value = progress;
  }

  getCameraPosition(): THREE.Vector3 {
    return this.skyMesh?.position || new THREE.Vector3();
  }

  followCamera(cameraPosition: THREE.Vector3): void {
    if (this.skyMesh) {
      this.skyMesh.position.copy(cameraPosition);
    }
  }

  dispose(): void {
    if (this.skyMesh && this.scene) {
      this.scene.remove(this.skyMesh);
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.skyMesh) {
      (this.skyMesh.geometry as THREE.BufferGeometry).dispose();
    }
  }
}

export class CelestialRenderer {
  private moonMesh: THREE.Mesh | null = null;
  private starField: THREE.Points | null = null;
  private scene: THREE.Scene | null = null;

  init(scene: THREE.Scene): void {
    this.scene = scene;
    this.createMoon();
    this.createStarField();
  }

  private createMoon(): void {
    if (!this.scene) return;
    
    const geometry = new THREE.SphereGeometry(8, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      transparent: true,
      opacity: 0.9,
    });
    
    this.moonMesh = new THREE.Mesh(geometry, material);
    this.moonMesh.position.set(-100, 50, 0);
    this.scene.add(this.moonMesh);
  }

  private createStarField(): void {
    if (!this.scene) return;
    
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 400;
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi));
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      
      sizes[i] = Math.random() * 2 + 0.5;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false,
    });
    
    this.starField = new THREE.Points(geometry, material);
    this.scene.add(this.starField);
  }

  setMoonPosition(position: THREE.Vector3): void {
    if (this.moonMesh) {
      this.moonMesh.position.copy(position);
    }
  }

  setMoonPhase(phase: number): void {
    if (this.moonMesh) {
      const brightness = 0.5 + Math.sin(phase * Math.PI * 2) * 0.4;
      (this.moonMesh.material as THREE.MeshBasicMaterial).opacity = brightness;
    }
  }

  setNightVisibility(visibility: number): void {
    if (this.starField) {
      (this.starField.material as THREE.PointsMaterial).opacity = visibility * 0.8;
    }
    if (this.moonMesh) {
      this.moonMesh.visible = visibility > 0.1;
    }
  }

  update(time: number): void {
    if (this.starField) {
      this.starField.rotation.y = time * 0.001;
    }
  }

  dispose(): void {
    if (this.moonMesh && this.scene) {
      this.scene.remove(this.moonMesh);
      (this.moonMesh.geometry as THREE.BufferGeometry).dispose();
      (this.moonMesh.material as THREE.Material).dispose();
    }
    if (this.starField && this.scene) {
      this.scene.remove(this.starField);
      (this.starField.geometry as THREE.BufferGeometry).dispose();
      (this.starField.material as THREE.Material).dispose();
    }
  }
}
