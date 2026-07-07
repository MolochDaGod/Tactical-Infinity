import * as THREE from 'three';
import type { TerrainData } from './islandHeightmapTerrain';

const _v3 = new THREE.Vector3();

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// ─────────────────────────────────────────────────────────────────────────────
// GPU INSTANCED GRASS
// ─────────────────────────────────────────────────────────────────────────────

const grassVertexShader = /* glsl */ `
attribute vec3 offset;
attribute float bladeHeight;
attribute float bladePhase;
attribute vec3 bladeColor;
attribute float bladeAngle;

uniform float uTime;
uniform float uWindStrength;

varying vec3 vColor;
varying float vY;

void main() {
  vColor = bladeColor;

  vec3 pos = position;

  float normalizedY = (pos.y + 0.5);
  vY = clamp(normalizedY, 0.0, 1.0);

  float ca = cos(bladeAngle);
  float sa = sin(bladeAngle);
  float rx = pos.x * ca - pos.z * sa;
  float rz = pos.x * sa + pos.z * ca;
  pos.x = rx;
  pos.z = rz;

  pos.y = normalizedY * bladeHeight;
  pos.x *= 1.0 + bladeHeight * 0.3;

  float windX = sin(uTime * 0.8 + offset.x * 0.05 + bladePhase) * uWindStrength * vY * vY;
  float windZ = cos(uTime * 0.6 + offset.z * 0.04 + bladePhase * 1.3) * uWindStrength * 0.5 * vY * vY;
  float gust = sin(uTime * 0.2 + (offset.x + offset.z) * 0.01) * 0.5 + 0.5;
  windX *= (0.5 + gust * 0.5);
  windZ *= (0.5 + gust * 0.3);

  pos.x += windX;
  pos.z += windZ;

  vec3 worldPos = pos + offset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
`;

const grassFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vY;

void main() {
  float shadow = mix(0.55, 1.0, vY);
  float ao = mix(0.7, 1.0, smoothstep(0.0, 0.3, vY));
  vec3 col = vColor * shadow * ao;
  float tipHighlight = smoothstep(0.7, 1.0, vY) * 0.15;
  col += tipHighlight;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface GrassSystem {
  mesh: THREE.Mesh;
  update: (time: number) => void;
  dispose: () => void;
}

export function createGrassSystem(
  terrain: TerrainData,
  count: number = 12000,
  seed: number = 777
): GrassSystem {
  const rng = seededRand(seed);

  const verts = new Float32Array([
    -0.04, -0.5, 0,
     0.04, -0.5, 0,
    -0.03,  0.0, 0,
     0.03,  0.0, 0,
    -0.01,  0.4, 0,
     0.01,  0.4, 0,
     0.00,  0.5, 0,
  ]);
  const indices = [0,1,2, 1,3,2, 2,3,4, 3,5,4, 4,5,6];
  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  bladeGeo.setIndex(indices);

  const offsets = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const angles = new Float32Array(count);

  const GRASS_COLORS = [
    [0.30, 0.52, 0.18],
    [0.35, 0.58, 0.22],
    [0.28, 0.48, 0.15],
    [0.38, 0.55, 0.25],
    [0.32, 0.45, 0.20],
    [0.25, 0.42, 0.14],
  ];

  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 5;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const dist = Math.pow(rng(), 0.5) * (terrain.radius - 25);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = terrain.getHeightAt(x, z);
    const slope = terrain.getSlopeAt(x, z);

    if (y < 2.0 || y > 28 || slope > 0.45) continue;

    offsets[placed * 3] = x;
    offsets[placed * 3 + 1] = y;
    offsets[placed * 3 + 2] = z;

    heights[placed] = 0.3 + rng() * 0.6;
    phases[placed] = rng() * Math.PI * 2;
    angles[placed] = rng() * Math.PI;

    const ci = Math.floor(rng() * GRASS_COLORS.length);
    const variation = (rng() - 0.5) * 0.05;
    colors[placed * 3] = GRASS_COLORS[ci][0] + variation;
    colors[placed * 3 + 1] = GRASS_COLORS[ci][1] + variation;
    colors[placed * 3 + 2] = GRASS_COLORS[ci][2] + variation;

    placed++;
  }

  const geo = new THREE.InstancedBufferGeometry();
  geo.index = bladeGeo.index;
  geo.attributes.position = bladeGeo.attributes.position;

  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets.slice(0, placed * 3), 3));
  geo.setAttribute('bladeHeight', new THREE.InstancedBufferAttribute(heights.slice(0, placed), 1));
  geo.setAttribute('bladePhase', new THREE.InstancedBufferAttribute(phases.slice(0, placed), 1));
  geo.setAttribute('bladeColor', new THREE.InstancedBufferAttribute(colors.slice(0, placed * 3), 3));
  geo.setAttribute('bladeAngle', new THREE.InstancedBufferAttribute(angles.slice(0, placed), 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.6 },
    },
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.name = 'grass_system';

  return {
    mesh,
    update: (time: number) => { material.uniforms.uTime.value = time; },
    dispose: () => { geo.dispose(); material.dispose(); bladeGeo.dispose(); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT PARTICLE SYSTEM (dust motes, fireflies, pollen)
// ─────────────────────────────────────────────────────────────────────────────

const particleVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aVelocity;
attribute vec3 aColor;

uniform float uTime;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  vec3 pos = position;
  float t = mod(uTime * 0.3 + aPhase, 6.28318);

  pos += aVelocity * uTime;
  pos.x += sin(t * 1.5 + aPhase) * 0.8;
  pos.y += sin(t * 0.7 + aPhase * 2.0) * 0.5 + cos(uTime * 0.2 + aPhase) * 0.3;
  pos.z += cos(t * 1.2 + aPhase * 0.7) * 0.6;

  pos.x = mod(pos.x + 150.0, 300.0) - 150.0;
  pos.z = mod(pos.z + 150.0, 300.0) - 150.0;
  pos.y = mod(pos.y - 1.0, 25.0) + 1.0;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mvPos.z;
  vAlpha = smoothstep(120.0, 40.0, dist) * (0.4 + 0.6 * sin(uTime * 2.0 + aPhase * 5.0) * 0.5 + 0.5);

  gl_PointSize = aSize * uPixelRatio * (80.0 / dist);
  gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);
  gl_Position = projectionMatrix * mvPos;
}
`;

const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float circle = 1.0 - smoothstep(0.6, 1.0, d);
  if (circle < 0.01) discard;
  float glow = exp(-d * d * 2.0);
  vec3 col = vColor * (0.7 + glow * 0.3);
  gl_FragColor = vec4(col, circle * vAlpha);
}
`;

export interface ParticleSystem {
  points: THREE.Points;
  update: (time: number) => void;
  dispose: () => void;
}

export function createAmbientParticles(count: number = 600, seed: number = 999): ParticleSystem {
  const rng = seededRand(seed);

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phasesArr = new Float32Array(count);
  const velocities = new Float32Array(count * 3);
  const colorsArr = new Float32Array(count * 3);

  const PARTICLE_COLORS = [
    [1.0, 0.95, 0.7],
    [0.8, 1.0, 0.7],
    [1.0, 0.85, 0.5],
    [0.7, 0.9, 1.0],
    [0.9, 0.8, 0.6],
  ];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rng() - 0.5) * 300;
    positions[i * 3 + 1] = 1 + rng() * 20;
    positions[i * 3 + 2] = (rng() - 0.5) * 300;

    sizes[i] = 1.5 + rng() * 4;
    phasesArr[i] = rng() * Math.PI * 2;

    velocities[i * 3] = (rng() - 0.5) * 0.15;
    velocities[i * 3 + 1] = rng() * 0.05;
    velocities[i * 3 + 2] = (rng() - 0.5) * 0.15;

    const ci = Math.floor(rng() * PARTICLE_COLORS.length);
    colorsArr[i * 3] = PARTICLE_COLORS[ci][0];
    colorsArr[i * 3 + 1] = PARTICLE_COLORS[ci][1];
    colorsArr[i * 3 + 2] = PARTICLE_COLORS[ci][2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phasesArr, 1));
  geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colorsArr, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.name = 'ambient_particles';

  return {
    points,
    update: (time: number) => { material.uniforms.uTime.value = time; },
    dispose: () => { geo.dispose(); material.dispose(); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORE SPLASH PARTICLES
// ─────────────────────────────────────────────────────────────────────────────

export interface ShoreSplashSystem {
  group: THREE.Group;
  update: (time: number, dt: number) => void;
  dispose: () => void;
}

interface SplashParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export function createShoreSplashes(terrain: TerrainData, count: number = 24): ShoreSplashSystem {
  const group = new THREE.Group();
  group.name = 'shore_splashes';
  const rng = seededRand(2345);

  const splashGeo = new THREE.SphereGeometry(0.12, 4, 3);
  const splashMat = new THREE.MeshBasicMaterial({
    color: 0xdff8ff,
    transparent: true,
    opacity: 0.7,
  });

  const particles: SplashParticle[] = [];
  const spawnPoints: THREE.Vector3[] = [];

  for (let i = 0; i < 40; i++) {
    const angle = rng() * Math.PI * 2;
    const r = terrain.radius - 18 + rng() * 12;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = terrain.getHeightAt(x, z);
    if (y > -0.5 && y < 2.0) {
      spawnPoints.push(new THREE.Vector3(x, Math.max(0.2, y), z));
    }
  }

  function spawnSplash() {
    if (spawnPoints.length === 0) return;
    const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const mesh = new THREE.Mesh(splashGeo, splashMat.clone());
    mesh.position.copy(sp);
    mesh.position.x += (Math.random() - 0.5) * 3;
    mesh.position.z += (Math.random() - 0.5) * 3;
    group.add(mesh);
    particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * 1.5
      ),
      life: 0,
      maxLife: 0.8 + Math.random() * 0.6,
    });
  }

  let spawnTimer = 0;

  return {
    group,
    update: (time: number, dt: number) => {
      spawnTimer += dt;
      const spawnInterval = 0.15;
      while (spawnTimer > spawnInterval && particles.length < count) {
        spawnSplash();
        spawnTimer -= spawnInterval;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          group.remove(p.mesh);
          (p.mesh.material as THREE.MeshBasicMaterial).dispose();
          particles.splice(i, 1);
          continue;
        }
        p.velocity.y -= 6 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        const t = p.life / p.maxLife;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
        const s = 1 + t * 0.5;
        p.mesh.scale.setScalar(s);
      }
    },
    dispose: () => { splashGeo.dispose(); splashMat.dispose(); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLIZED COLOR GRADING POST-PROCESSING SHADER
// ─────────────────────────────────────────────────────────────────────────────

export const ColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.15 },
    uContrast: { value: 1.08 },
    uBrightness: { value: 0.02 },
    uVignetteStrength: { value: 0.35 },
    uWarmth: { value: 0.06 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uBrightness;
    uniform float uVignetteStrength;
    uniform float uWarmth;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;

      col += uBrightness;

      col = (col - 0.5) * uContrast + 0.5;

      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, uSaturation);

      col.r += uWarmth;
      col.b -= uWarmth * 0.5;

      vec2 vc = vUv - 0.5;
      float vignette = 1.0 - dot(vc, vc) * uVignetteStrength * 2.0;
      col *= vignette;

      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col, tex.a);
    }
  `,
};

// ─────────────────────────────────────────────────────────────────────────────
// VOLUMETRIC FOG PLANES (depth-based atmospheric layers)
// ─────────────────────────────────────────────────────────────────────────────

export function createAtmosphericFog(radius: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'atmospheric_fog';

  const fogMat = new THREE.MeshBasicMaterial({
    color: 0xc8dff0,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  const layers = [
    { y: 2, scale: 1.0, opacity: 0.04 },
    { y: 8, scale: 0.85, opacity: 0.035 },
    { y: 15, scale: 0.7, opacity: 0.025 },
  ];

  layers.forEach(layer => {
    const geo = new THREE.PlaneGeometry(radius * 2.5 * layer.scale, radius * 2.5 * layer.scale);
    geo.rotateX(-Math.PI / 2);
    const mat = fogMat.clone();
    mat.opacity = layer.opacity;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = layer.y;
    mesh.renderOrder = 999;
    group.add(mesh);
  });

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLIZED TREE ENHANCEMENT (wind sway for existing tree nodes)
// ─────────────────────────────────────────────────────────────────────────────

export function animateTreeSway(nodes: THREE.Group[], time: number): void {
  for (const node of nodes) {
    if (!node.name.includes('tree')) continue;
    const px = node.position.x;
    const pz = node.position.z;
    const swayX = Math.sin(time * 0.8 + px * 0.05) * 0.02;
    const swayZ = Math.cos(time * 0.6 + pz * 0.04) * 0.015;
    node.rotation.x = swayX;
    node.rotation.z = swayZ;
  }
}
