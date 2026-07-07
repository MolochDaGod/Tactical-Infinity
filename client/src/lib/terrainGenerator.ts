import * as THREE from 'three';

export interface TerrainOptions {
  xSegments: number;
  ySegments: number;
  xSize: number;
  ySize: number;
  maxHeight: number;
  minHeight: number;
  frequency: number;
  stretch: boolean;
  steps: number;
  turbulent: boolean;
  easing: (x: number) => number;
  seed: number;
}

const DEFAULT_OPTIONS: TerrainOptions = {
  xSegments: 127,
  ySegments: 127,
  xSize: 200,
  ySize: 200,
  maxHeight: 30,
  minHeight: -8,
  frequency: 2.5,
  stretch: true,
  steps: 1,
  turbulent: false,
  easing: easeInOut,
  seed: Math.random() * 65536,
};

export function easeLinear(x: number): number { return x; }
export function easeIn(x: number): number { return x * x; }
export function easeOut(x: number): number { return -x * (x - 2); }
export function easeInOut(x: number): number { return x * x * (3 - 2 * x); }
export function easeInStrong(x: number): number { return x ** 7; }

const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,
  30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,
  252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,
  168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
  60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,
  1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,
  86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,
  118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,
  170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,
  22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
  107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,
  150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,
  61,156,180];

function createNoise(seed: number) {
  const perm = new Uint8Array(512);
  const gradP = new Array(512);

  let s = Math.floor(seed);
  if (s < 256) s |= s << 8;

  for (let i = 0; i < 256; i++) {
    const v = (i & 1) ? p[i] ^ (s & 255) : p[i] ^ ((s >> 8) & 255);
    perm[i] = perm[i + 256] = v;
    gradP[i] = gradP[i + 256] = grad3[v % 12];
  }

  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  function simplex2(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255, jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi = gradP[ii + perm[jj]];
      t0 *= t0;
      n0 = t0 * t0 * (gi[0] * x0 + gi[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi = gradP[ii + i1 + perm[jj + j1]];
      t1 *= t1;
      n1 = t1 * t1 * (gi[0] * x1 + gi[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi = gradP[ii + 1 + perm[jj + 1]];
      t2 *= t2;
      n2 = t2 * t2 * (gi[0] * x2 + gi[1] * y2);
    }
    return 70.0 * (n0 + n1 + n2);
  }

  return { simplex2 };
}

function toArray1D(posArray: Float32Array): Float32Array {
  const count = posArray.length / 3;
  const result = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = posArray[i * 3 + 2];
  }
  return result;
}

function fromArray1D(posArray: Float32Array, src: Float32Array): void {
  const l = Math.min(posArray.length / 3, src.length);
  for (let i = 0; i < l; i++) {
    posArray[i * 3 + 2] = src[i];
  }
}

function clamp(g: Float32Array, options: TerrainOptions): void {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < g.length; i++) {
    if (g[i] < min) min = g[i];
    if (g[i] > max) max = g[i];
  }
  const actualRange = max - min || 1;
  const targetMax = options.stretch ? options.maxHeight : Math.min(max, options.maxHeight);
  const targetMin = options.stretch ? options.minHeight : Math.max(min, options.minHeight);
  const range = targetMax - targetMin;
  for (let i = 0; i < g.length; i++) {
    g[i] = options.easing((g[i] - min) / actualRange) * range + targetMin;
  }
}

function smooth(g: Float32Array, options: TerrainOptions): void {
  const xl = options.xSegments + 1;
  const yl = options.ySegments + 1;
  const smoothed = new Float32Array(g.length);
  for (let i = 0; i < xl; i++) {
    for (let j = 0; j < yl; j++) {
      let sum = 0, count = 0;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && ni < xl && nj >= 0 && nj < yl) {
            sum += g[nj * xl + ni];
            count++;
          }
        }
      }
      smoothed[j * xl + i] = sum / count;
    }
  }
  for (let i = 0; i < g.length; i++) g[i] = smoothed[i];
}

export function generateSimplexLayers(g: Float32Array, options: TerrainOptions): void {
  const noise = createNoise(options.seed);
  const xl = options.xSegments + 1;
  const yl = options.ySegments + 1;
  const range = options.maxHeight - options.minHeight;

  const layers = [
    { freq: 2.5, amp: 1.0 },
    { freq: 5.0, amp: 0.3 },
    { freq: 10.0, amp: 0.1 },
    { freq: 20.0, amp: 0.05 },
    { freq: 40.0, amp: 0.02 },
  ];

  for (let i = 0; i < xl; i++) {
    for (let j = 0; j < yl; j++) {
      const sx = i / xl;
      const sy = j / yl;
      let h = 0;
      for (const layer of layers) {
        h += noise.simplex2(sx * layer.freq, sy * layer.freq) * layer.amp;
      }
      g[j * xl + i] += h * range * 0.5;
    }
  }
}

export function generateDiamondSquare(g: Float32Array, options: TerrainOptions): void {
  const maxSeg = Math.max(options.xSegments, options.ySegments) + 1;
  let segments = 1;
  while (segments < maxSeg) segments *= 2;

  const size = segments + 1;
  const heightmap: number[][] = [];
  let smoothing = options.maxHeight - options.minHeight;

  for (let i = 0; i <= segments; i++) {
    heightmap[i] = new Array(size).fill(0);
  }

  for (let l = segments; l >= 2; l /= 2) {
    const half = Math.round(l * 0.5);
    const whole = Math.round(l);
    smoothing /= 2;

    for (let x = 0; x < segments; x += whole) {
      for (let y = 0; y < segments; y += whole) {
        const d = Math.random() * smoothing * 2 - smoothing;
        const avg = (heightmap[x][y] + heightmap[x + whole][y] +
                     heightmap[x][y + whole] + heightmap[x + whole][y + whole]) * 0.25;
        heightmap[x + half][y + half] = avg + d;
      }
    }

    for (let x = 0; x < segments; x += half) {
      for (let y = (x + half) % l; y < segments; y += l) {
        const d = Math.random() * smoothing * 2 - smoothing;
        const avg = (heightmap[(x - half + size) % size][y] +
                     heightmap[(x + half) % size][y] +
                     heightmap[x][(y + half) % size] +
                     heightmap[x][(y - half + size) % size]) * 0.25 + d;
        heightmap[x][y] = avg;
        if (x === 0) heightmap[segments][y] = avg;
        if (y === 0) heightmap[x][segments] = avg;
      }
    }
  }

  const xl = options.xSegments + 1;
  const yl = options.ySegments + 1;
  for (let i = 0; i < xl; i++) {
    for (let j = 0; j < yl; j++) {
      g[j * xl + i] += heightmap[i][j];
    }
  }
}

export function applyIslandMask(g: Float32Array, options: TerrainOptions): void {
  const xl = options.xSegments + 1;
  const yl = options.ySegments + 1;
  const cx = (xl - 1) * 0.5;
  const cy = (yl - 1) * 0.5;
  const maxDist = Math.min(cx, cy);
  const waterLevel = options.minHeight;

  for (let i = 0; i < xl; i++) {
    for (let j = 0; j < yl; j++) {
      const dx = (i - cx) / maxDist;
      const dy = (j - cy) / maxDist;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = 1.0 - easeInOut(Math.min(dist * 1.1, 1.0));
      const idx = j * xl + i;
      g[idx] = g[idx] * falloff + waterLevel * (1.0 - falloff);
    }
  }
}

export function applyBeachSmoothing(g: Float32Array, options: TerrainOptions): void {
  const xl = options.xSegments + 1;
  const yl = options.ySegments + 1;
  const waterLevel = 0;
  const beachMax = options.maxHeight * 0.08;

  for (let i = 0; i < xl; i++) {
    for (let j = 0; j < yl; j++) {
      const idx = j * xl + i;
      if (g[idx] > waterLevel && g[idx] < beachMax) {
        const t = g[idx] / beachMax;
        g[idx] = easeIn(t) * beachMax * 0.5;
      }
    }
  }
}

export type BiomeType = 'tropical' | 'volcanic' | 'temperate' | 'arctic' | 'desert';

export interface BiomeConfig {
  waterColor: number;
  sandColor: number;
  grassColor: number;
  rockColor: number;
  peakColor: number;
  fogColor: number;
  fogDensity: number;
  skyColor: number;
  ambientColor: number;
  sunColor: number;
  sunIntensity: number;
  maxHeight: number;
  treeCount: number;
  rockCount: number;
}

export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  tropical: {
    waterColor: 0x006994, sandColor: 0xC2B280, grassColor: 0x3B7A3B,
    rockColor: 0x6B6B6B, peakColor: 0x4A7A4A, fogColor: 0x87CEEB,
    fogDensity: 0.003, skyColor: 0x87CEEB, ambientColor: 0x8899AA,
    sunColor: 0xFFDD88, sunIntensity: 1.8, maxHeight: 25,
    treeCount: 80, rockCount: 30,
  },
  volcanic: {
    waterColor: 0x1A3A4A, sandColor: 0x3A3A3A, grassColor: 0x2A4A2A,
    rockColor: 0x4A3A2A, peakColor: 0xFF4400, fogColor: 0x554433,
    fogDensity: 0.006, skyColor: 0x443322, ambientColor: 0x443322,
    sunColor: 0xFF8844, sunIntensity: 1.2, maxHeight: 45,
    treeCount: 20, rockCount: 60,
  },
  temperate: {
    waterColor: 0x2266AA, sandColor: 0xB8A080, grassColor: 0x558833,
    rockColor: 0x888888, peakColor: 0xBBBBBB, fogColor: 0xAABBCC,
    fogDensity: 0.004, skyColor: 0x8899CC, ambientColor: 0x889999,
    sunColor: 0xFFEECC, sunIntensity: 1.5, maxHeight: 30,
    treeCount: 60, rockCount: 40,
  },
  arctic: {
    waterColor: 0x1A3050, sandColor: 0xCCDDEE, grassColor: 0x99AABB,
    rockColor: 0xAABBCC, peakColor: 0xFFFFFF, fogColor: 0xCCDDEE,
    fogDensity: 0.005, skyColor: 0xAABBDD, ambientColor: 0xAABBCC,
    sunColor: 0xCCDDFF, sunIntensity: 1.0, maxHeight: 35,
    treeCount: 15, rockCount: 50,
  },
  desert: {
    waterColor: 0x114466, sandColor: 0xDDCC88, grassColor: 0xAA9955,
    rockColor: 0xBB8844, peakColor: 0xCC9966, fogColor: 0xDDCC99,
    fogDensity: 0.002, skyColor: 0xDDCC99, ambientColor: 0xBBAA88,
    sunColor: 0xFFDD66, sunIntensity: 2.2, maxHeight: 20,
    treeCount: 10, rockCount: 40,
  },
};

export interface GeneratedTerrain {
  mesh: THREE.Mesh;
  heightData: Float32Array;
  options: TerrainOptions;
  heightAt: (x: number, z: number) => number;
}

export function generateTerrain(userOptions: Partial<TerrainOptions> = {}): GeneratedTerrain {
  const options: TerrainOptions = { ...DEFAULT_OPTIONS, ...userOptions };

  const geometry = new THREE.PlaneGeometry(
    options.xSize, options.ySize,
    options.xSegments, options.ySegments
  );

  const posArray = geometry.attributes.position.array as Float32Array;
  const heightData = toArray1D(posArray);

  generateSimplexLayers(heightData, options);
  applyIslandMask(heightData, options);
  applyBeachSmoothing(heightData, options);

  if (options.turbulent) {
    for (let i = 0; i < heightData.length; i++) {
      heightData[i] = Math.abs(heightData[i]);
    }
  }

  if (options.steps > 1) {
    const step = (options.maxHeight - options.minHeight) / options.steps;
    for (let i = 0; i < heightData.length; i++) {
      heightData[i] = Math.floor(heightData[i] / step) * step;
    }
    smooth(heightData, options);
  }

  clamp(heightData, options);
  fromArray1D(posArray, heightData);

  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = createTerrainMaterial(heightData, options);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const xl = options.xSegments + 1;
  const yl = options.ySegments + 1;

  function heightAt(worldX: number, worldZ: number): number {
    const fx = (worldX / options.xSize + 0.5) * (xl - 1);
    const fy = (worldZ / options.ySize + 0.5) * (yl - 1);
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    if (ix < 0 || ix >= xl - 1 || iy < 0 || iy >= yl - 1) return options.minHeight;
    const tx = fx - ix;
    const ty = fy - iy;
    const h00 = heightData[iy * xl + ix];
    const h10 = heightData[iy * xl + ix + 1];
    const h01 = heightData[(iy + 1) * xl + ix];
    const h11 = heightData[(iy + 1) * xl + ix + 1];
    return (h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) +
            h01 * (1 - tx) * ty + h11 * tx * ty);
  }

  return { mesh, heightData, options, heightAt };
}

function createTerrainMaterial(heightData: Float32Array, options: TerrainOptions): THREE.ShaderMaterial {
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < heightData.length; i++) {
    if (heightData[i] < minH) minH = heightData[i];
    if (heightData[i] > maxH) maxH = heightData[i];
  }

  return new THREE.ShaderMaterial({
    uniforms: {
      uMinHeight: { value: minH },
      uMaxHeight: { value: maxH },
      uWaterLevel: { value: 0.0 },
      uSandColor: { value: new THREE.Color(0xC2B280) },
      uGrassColor: { value: new THREE.Color(0x3B7A3B) },
      uRockColor: { value: new THREE.Color(0x6B6B6B) },
      uPeakColor: { value: new THREE.Color(0xEEEEEE) },
      uBeachColor: { value: new THREE.Color(0xE8D8A0) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xFFDD88) },
      uAmbientColor: { value: new THREE.Color(0x445566) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(normalMatrix * normal);
        vHeight = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uMinHeight;
      uniform float uMaxHeight;
      uniform float uWaterLevel;
      uniform vec3 uSandColor;
      uniform vec3 uGrassColor;
      uniform vec3 uRockColor;
      uniform vec3 uPeakColor;
      uniform vec3 uBeachColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vHeight;

      void main() {
        float range = uMaxHeight - uMinHeight;
        float t = clamp((vHeight - uMinHeight) / range, 0.0, 1.0);
        float slope = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));

        vec3 color;
        if (t < 0.05) {
          color = uBeachColor;
        } else if (t < 0.15) {
          float bt = smoothstep(0.05, 0.15, t);
          color = mix(uBeachColor, uSandColor, bt);
        } else if (t < 0.35) {
          float gt = smoothstep(0.15, 0.35, t);
          color = mix(uSandColor, uGrassColor, gt);
        } else if (t < 0.65) {
          color = uGrassColor;
        } else if (t < 0.85) {
          float rt = smoothstep(0.65, 0.85, t);
          color = mix(uGrassColor, uRockColor, rt);
        } else {
          float pt = smoothstep(0.85, 1.0, t);
          color = mix(uRockColor, uPeakColor, pt);
        }

        if (slope > 0.5) {
          float slopeT = smoothstep(0.5, 0.8, slope);
          color = mix(color, uRockColor * 0.8, slopeT);
        }

        float NdotL = max(dot(vNormal, uSunDir), 0.0);
        vec3 lighting = uAmbientColor + uSunColor * NdotL;
        color *= lighting;

        float ao = smoothstep(uMinHeight, uMinHeight + range * 0.3, vHeight) * 0.3 + 0.7;
        color *= ao;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function setTerrainBiome(terrain: GeneratedTerrain, biome: BiomeConfig): void {
  const mat = terrain.mesh.material as THREE.ShaderMaterial;
  if (!mat.uniforms) return;
  mat.uniforms.uSandColor.value.set(biome.sandColor);
  mat.uniforms.uGrassColor.value.set(biome.grassColor);
  mat.uniforms.uRockColor.value.set(biome.rockColor);
  mat.uniforms.uPeakColor.value.set(biome.peakColor);
  mat.uniforms.uSunColor.value.set(biome.sunColor);
  mat.needsUpdate = true;
}

export function scatterObjects(
  terrain: GeneratedTerrain,
  count: number,
  minHeight: number,
  maxHeight: number,
  builder: () => THREE.Object3D
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  const halfX = terrain.options.xSize * 0.5;
  const halfY = terrain.options.ySize * 0.5;

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * terrain.options.xSize * 0.85;
    const z = (Math.random() - 0.5) * terrain.options.ySize * 0.85;
    const h = terrain.heightAt(x, z);

    if (h >= minHeight && h <= maxHeight) {
      const obj = builder();
      obj.position.set(x, h, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      objects.push(obj);
    }
  }
  return objects;
}

export function createWaterPlane(size: number, color: number = 0x006994): THREE.Mesh {
  const waterGeo = new THREE.PlaneGeometry(size * 2, size * 2);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uDeepColor: { value: new THREE.Color(color).multiplyScalar(0.3) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 0.5 + uTime * 1.5) * 0.15;
        pos.z += cos(pos.y * 0.3 + uTime * 1.0) * 0.1;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uDeepColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        float dist = length(vWorldPos.xz) * 0.01;
        vec3 color = mix(uColor, uDeepColor, clamp(dist, 0.0, 1.0));
        float wave = sin(vWorldPos.x * 2.0 + uTime * 2.0) * 0.5 + 0.5;
        wave *= sin(vWorldPos.z * 1.5 + uTime * 1.5) * 0.5 + 0.5;
        color += vec3(wave * 0.08);
        float fresnel = pow(1.0 - abs(dot(normalize(vec3(0.0, 1.0, 0.0)), normalize(cameraPosition - vWorldPos))), 3.0);
        color = mix(color, vec3(0.7, 0.85, 0.95), fresnel * 0.4);
        gl_FragColor = vec4(color, 0.85 - fresnel * 0.15);
      }
    `,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.2;
  return water;
}

export function buildPalmTree(scale: number = 1): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2D8B2D, roughness: 0.7, side: THREE.DoubleSide });

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.1, 1.5, 0.05),
    new THREE.Vector3(-0.05, 3.0, -0.1),
    new THREE.Vector3(0.15, 4.5, 0.05),
  ]);
  const trunkGeo = new THREE.TubeGeometry(curve, 12, 0.12, 6, false);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  tree.add(trunk);

  const leafCount = 7;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2;
    const leafLen = 2.5 + Math.random() * 1.0;
    const leafCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(angle) * leafLen * 0.4, 0.3, Math.sin(angle) * leafLen * 0.4),
      new THREE.Vector3(Math.cos(angle) * leafLen * 0.8, -0.2, Math.sin(angle) * leafLen * 0.8),
      new THREE.Vector3(Math.cos(angle) * leafLen, -0.8, Math.sin(angle) * leafLen),
    ]);
    const leafGeo = new THREE.TubeGeometry(leafCurve, 8, 0.15, 3, false);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(0.15, 4.5, 0.05);
    leaf.castShadow = true;
    tree.add(leaf);
  }

  tree.scale.setScalar(scale);
  return tree;
}

export function buildRock(scale: number = 1): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.5, 1);
  const posArr = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < posArr.length; i += 3) {
    posArr[i] += (Math.random() - 0.5) * 0.15;
    posArr[i + 1] += (Math.random() - 0.5) * 0.15;
    posArr[i + 2] += (Math.random() - 0.5) * 0.15;
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x777777 + Math.floor(Math.random() * 0x222222),
    roughness: 0.9,
    flatShading: true,
  });
  const rock = new THREE.Mesh(geo, mat);
  rock.castShadow = true;
  rock.scale.set(scale, scale * (0.5 + Math.random() * 0.5), scale);
  return rock;
}

export function buildPineTree(scale: number = 1): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1A5C1A, roughness: 0.7 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2, 6), trunkMat);
  trunk.position.y = 1;
  trunk.castShadow = true;
  tree.add(trunk);

  for (let layer = 0; layer < 4; layer++) {
    const r = 1.2 - layer * 0.25;
    const h = 0.8;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leafMat);
    cone.position.y = 2.2 + layer * 0.6;
    cone.castShadow = true;
    tree.add(cone);
  }

  tree.scale.setScalar(scale);
  return tree;
}
