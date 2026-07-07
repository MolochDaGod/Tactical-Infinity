import * as THREE from 'three';

export interface TerrainTextureSet {
  id: string;
  label: string;
  albedoPath: string;
  normalPath?: string;
  heightPath?: string;
  tileScale: number;
}

export const TERRAIN_TEXTURES: TerrainTextureSet[] = [
  {
    id: 'grass_3',
    label: 'Grass',
    albedoPath: '/textures/terrain/grass_3_albedo.png',
    normalPath: '/textures/terrain/grass_3_normal.png',
    heightPath: '/textures/terrain/grass_3_height.png',
    tileScale: 8,
  },
  {
    id: 'mud_1',
    label: 'Mud',
    albedoPath: '/textures/terrain/mud_1_albedo.png',
    normalPath: '/textures/terrain/mud_1_normal.png',
    heightPath: '/textures/terrain/mud_1_height.png',
    tileScale: 8,
  },
  {
    id: 'dark_mud_1',
    label: 'Dark Mud',
    albedoPath: '/textures/terrain/dark_mud_1_albedo.png',
    tileScale: 8,
  },
  {
    id: 'dark_mud_2',
    label: 'Dark Mud 2',
    albedoPath: '/textures/terrain/dark_mud_2_albedo.png',
    tileScale: 8,
  },
  {
    id: 'mud_6',
    label: 'Wet Mud',
    albedoPath: '/textures/terrain/mud_6_albedo.png',
    normalPath: '/textures/terrain/mud_6_normal.png',
    heightPath: '/textures/terrain/mud_6_height.png',
    tileScale: 8,
  },
  {
    id: 'tile_2',
    label: 'Stone Tile',
    albedoPath: '/textures/terrain/tile_2_albedo.png',
    normalPath: '/textures/terrain/tile_2_normal.png',
    heightPath: '/textures/terrain/tile_2_height.png',
    tileScale: 6,
  },
];

const loader = new THREE.TextureLoader();

function loadTex(path: string, repeat: number): THREE.Texture {
  const tex = loader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function loadTerrainTexture(set: TerrainTextureSet): {
  albedo: THREE.Texture;
  normal: THREE.Texture | null;
} {
  const albedo = loadTex(set.albedoPath, set.tileScale);
  const normal = set.normalPath ? loadTex(set.normalPath, set.tileScale) : null;
  if (normal) normal.colorSpace = THREE.LinearSRGBColorSpace;
  return { albedo, normal };
}

const splatVertShader = `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const splatFragShader = `
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform sampler2D uSplatMap;
uniform vec2 uTile0;
uniform vec2 uTile1;
uniform vec2 uTile2;
uniform vec2 uTile3;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vec4 splat = texture2D(uSplatMap, vUv);

  vec2 tUv0 = vWorldPos.xz * uTile0;
  vec2 tUv1 = vWorldPos.xz * uTile1;
  vec2 tUv2 = vWorldPos.xz * uTile2;
  vec2 tUv3 = vWorldPos.xz * uTile3;

  vec4 c0 = texture2D(uTex0, tUv0);
  vec4 c1 = texture2D(uTex1, tUv1);
  vec4 c2 = texture2D(uTex2, tUv2);
  vec4 c3 = texture2D(uTex3, tUv3);

  vec4 color = c0 * splat.r + c1 * splat.g + c2 * splat.b + c3 * splat.a;

  float light = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.3))), 0.0);
  float ambient = 0.35;
  color.rgb *= (ambient + light * 0.65);

  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

export function createSplatmapData(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 0;
  }
  return data;
}

export function createSplatmapTexture(width: number, height: number): THREE.DataTexture {
  const data = createSplatmapData(width, height);
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export interface TerrainSplatMaterial {
  material: THREE.ShaderMaterial;
  splatMap: THREE.DataTexture;
  splatData: Uint8Array;
  paintSplat: (u: number, v: number, channel: number, radius: number, strength: number) => void;
}

export function createTerrainSplatMaterial(
  texIds: [string, string, string, string]
): TerrainSplatMaterial {
  const sets = texIds.map(id => TERRAIN_TEXTURES.find(t => t.id === id) || TERRAIN_TEXTURES[0]);
  const textures = sets.map(s => loadTerrainTexture(s));

  const splatSize = 128;
  const splatMap = createSplatmapTexture(splatSize, splatSize);
  const splatData = splatMap.image.data as Uint8Array;

  const material = new THREE.ShaderMaterial({
    vertexShader: splatVertShader,
    fragmentShader: splatFragShader,
    uniforms: {
      uTex0: { value: textures[0].albedo },
      uTex1: { value: textures[1].albedo },
      uTex2: { value: textures[2].albedo },
      uTex3: { value: textures[3].albedo },
      uSplatMap: { value: splatMap },
      uTile0: { value: new THREE.Vector2(1.0 / sets[0].tileScale, 1.0 / sets[0].tileScale) },
      uTile1: { value: new THREE.Vector2(1.0 / sets[1].tileScale, 1.0 / sets[1].tileScale) },
      uTile2: { value: new THREE.Vector2(1.0 / sets[2].tileScale, 1.0 / sets[2].tileScale) },
      uTile3: { value: new THREE.Vector2(1.0 / sets[3].tileScale, 1.0 / sets[3].tileScale) },
    },
  });

  function paintSplat(u: number, v: number, channel: number, radius: number, strength: number) {
    const cx = Math.floor(u * splatSize);
    const cy = Math.floor(v * splatSize);
    const r = Math.ceil(radius * splatSize);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || px >= splatSize || py < 0 || py >= splatSize) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / r;
        if (dist > 1) continue;
        const falloff = 1.0 - dist * dist;
        const idx = (py * splatSize + px) * 4;
        const add = Math.floor(strength * falloff * 255);
        for (let c = 0; c < 4; c++) {
          if (c === channel) {
            splatData[idx + c] = Math.min(255, splatData[idx + c] + add);
          } else {
            splatData[idx + c] = Math.max(0, splatData[idx + c] - add);
          }
        }
      }
    }
    splatMap.needsUpdate = true;
  }

  return { material, splatMap, splatData, paintSplat };
}

export function autoSplatFromHeight(
  splatData: Uint8Array,
  splatMap: THREE.DataTexture,
  geometry: THREE.BufferGeometry,
  splatSize: number
) {
  const pos = geometry.attributes.position;
  const N = Math.round(Math.sqrt(pos.count));
  for (let row = 0; row < splatSize; row++) {
    for (let col = 0; col < splatSize; col++) {
      const vRow = Math.floor(row * (N - 1) / (splatSize - 1));
      const vCol = Math.floor(col * (N - 1) / (splatSize - 1));
      const vi = vRow * N + vCol;
      const h = vi < pos.count ? pos.getY(vi) : 0;
      const idx = (row * splatSize + col) * 4;

      if (h <= 1) {
        splatData[idx] = 0; splatData[idx + 1] = 0;
        splatData[idx + 2] = 255; splatData[idx + 3] = 0;
      } else if (h < 8) {
        splatData[idx] = 255; splatData[idx + 1] = 0;
        splatData[idx + 2] = 0; splatData[idx + 3] = 0;
      } else if (h < 25) {
        splatData[idx] = 0; splatData[idx + 1] = 255;
        splatData[idx + 2] = 0; splatData[idx + 3] = 0;
      } else {
        splatData[idx] = 0; splatData[idx + 1] = 0;
        splatData[idx + 2] = 0; splatData[idx + 3] = 255;
      }
    }
  }
  splatMap.needsUpdate = true;
}
