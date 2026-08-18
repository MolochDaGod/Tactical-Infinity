/**
 * Island editor + terrain splat textures.
 *
 * SSOT: Poly Haven CC0 packs staged under public/textures/terrain/
 * (downloaded 2026-08-01, magic-byte JPEG verified).
 * Broken legacy paths (grass_3_albedo.png etc. on R2 404) removed.
 */

import * as THREE from 'three';

export interface TerrainTextureSet {
  id: string;
  label: string;
  albedoPath: string;
  normalPath?: string;
  heightPath?: string;
  tileScale: number;
  /** Attribution for UI */
  source?: string;
}

/** Real staged PBR albedos — sand + stone included. */
export const TERRAIN_TEXTURES: TerrainTextureSet[] = [
  {
    id: 'grass',
    label: 'Grass',
    albedoPath: '/textures/terrain/grass_albedo.jpg',
    normalPath: '/textures/terrain/grass_normal.jpg',
    tileScale: 10,
    source: 'Poly Haven aerial_grass_rock · CC0',
  },
  {
    id: 'soil',
    label: 'Soil / Forest Floor',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
    normalPath: '/textures/terrain/soil_normal.jpg',
    tileScale: 10,
    source: 'Poly Haven forrest_ground_01 · CC0',
  },
  {
    id: 'sand',
    label: 'Coast Sand',
    albedoPath: '/textures/terrain/sand_albedo.jpg',
    normalPath: '/textures/terrain/sand_normal.jpg',
    tileScale: 12,
    source: 'Poly Haven coast_sand_01 · CC0',
  },
  {
    id: 'stone',
    label: 'Stone / Rock',
    albedoPath: '/textures/terrain/stone_albedo.jpg',
    normalPath: '/textures/terrain/stone_normal.jpg',
    tileScale: 8,
    source: 'Poly Haven rock_pitted_mossy · CC0',
  },
  // Aliases so older call sites that passed grass_3 / mud_1 / tile_2 still resolve
  {
    id: 'grass_3',
    label: 'Grass (legacy id)',
    albedoPath: '/textures/terrain/grass_albedo.jpg',
    normalPath: '/textures/terrain/grass_normal.jpg',
    tileScale: 10,
  },
  {
    id: 'mud_1',
    label: 'Mud (legacy → soil)',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
    normalPath: '/textures/terrain/soil_normal.jpg',
    tileScale: 10,
  },
  {
    id: 'dark_mud_1',
    label: 'Dark Mud (legacy → soil)',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
    normalPath: '/textures/terrain/soil_normal.jpg',
    tileScale: 8,
  },
  {
    id: 'dark_mud_2',
    label: 'Dark Mud 2 (legacy → soil)',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
    tileScale: 8,
  },
  {
    id: 'mud_6',
    label: 'Wet Mud (legacy → soil)',
    albedoPath: '/textures/terrain/soil_albedo.jpg',
    normalPath: '/textures/terrain/soil_normal.jpg',
    tileScale: 8,
  },
  {
    id: 'tile_2',
    label: 'Stone Tile (legacy → stone)',
    albedoPath: '/textures/terrain/stone_albedo.jpg',
    normalPath: '/textures/terrain/stone_normal.jpg',
    tileScale: 6,
  },
];

/** Canonical 4-channel editor pack: grass · soil · sand · stone */
export const EDITOR_SPLAT_CHANNELS: [string, string, string, string] = [
  'grass',
  'soil',
  'sand',
  'stone',
];

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

function loadTex(path: string, repeat: number): THREE.Texture {
  const key = `${path}@${repeat}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const tex = loader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
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

  // Normalize splat weights so missing paint still looks solid
  float sum = splat.r + splat.g + splat.b + splat.a + 1e-4;
  vec4 w = splat / sum;
  vec4 color = c0 * w.r + c1 * w.g + c2 * w.b + c3 * w.a;

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

export function createSplatmapTexture(width: number, height: number): {
  texture: THREE.DataTexture;
  data: Uint8Array;
} {
  // Own the Uint8Array — never read splatMap.image.data (Three Source proxy can be undefined).
  const data = createSplatmapData(width, height);
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return { texture, data };
}

export interface TerrainSplatMaterial {
  material: THREE.ShaderMaterial;
  splatMap: THREE.DataTexture;
  splatData: Uint8Array;
  paintSplat: (u: number, v: number, channel: number, radius: number, strength: number) => void;
}

export function createTerrainSplatMaterial(
  texIds?: [string, string, string, string] | string[] | null,
): TerrainSplatMaterial {
  const ids = (texIds && texIds.length >= 4
    ? texIds
    : EDITOR_SPLAT_CHANNELS) as [string, string, string, string];

  const fallback: TerrainTextureSet = TERRAIN_TEXTURES[0] ?? {
    id: 'grass',
    label: 'Grass',
    albedoPath: '/textures/terrain/grass_albedo.jpg',
    tileScale: 10,
  };

  const sets = ids.map(
    (id) => TERRAIN_TEXTURES.find((t) => t.id === id) || fallback,
  );
  const textures = sets.map((s) => loadTerrainTexture(s));

  const splatSize = 128;
  const { texture: splatMap, data: splatData } = createSplatmapTexture(splatSize, splatSize);

  const tile = (i: number) => {
    const ts = Math.max(0.5, sets[i]?.tileScale ?? 8);
    return new THREE.Vector2(1.0 / ts, 1.0 / ts);
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: splatVertShader,
    fragmentShader: splatFragShader,
    uniforms: {
      uTex0: { value: textures[0].albedo },
      uTex1: { value: textures[1].albedo },
      uTex2: { value: textures[2].albedo },
      uTex3: { value: textures[3].albedo },
      uSplatMap: { value: splatMap },
      uTile0: { value: tile(0) },
      uTile1: { value: tile(1) },
      uTile2: { value: tile(2) },
      uTile3: { value: tile(3) },
    },
  });

  function paintSplat(u: number, v: number, channel: number, radius: number, strength: number) {
    if (!splatData || splatData.length < 4) return;
    const cx = Math.floor(u * splatSize);
    const cy = Math.floor(v * splatSize);
    const r = Math.max(1, Math.ceil(radius * splatSize));
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

/**
 * Height → splat: beach=sand (ch2), lowland=grass (ch0), mid=soil (ch1), high=stone (ch3).
 */
export function autoSplatFromHeight(
  splatData: Uint8Array | null | undefined,
  splatMap: THREE.DataTexture | null | undefined,
  geometry: THREE.BufferGeometry | null | undefined,
  splatSize: number,
) {
  if (!splatData || !splatMap || !geometry?.attributes?.position) {
    console.warn('[terrainTextures] autoSplatFromHeight skipped — missing splat/geometry');
    return;
  }
  const pos = geometry.attributes.position;
  const N = Math.max(2, Math.round(Math.sqrt(pos.count)));
  const size = Math.max(2, splatSize | 0);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const vRow = Math.floor((row * (N - 1)) / (size - 1));
      const vCol = Math.floor((col * (N - 1)) / (size - 1));
      const vi = vRow * N + vCol;
      const h = vi < pos.count ? pos.getY(vi) : 0;
      const idx = (row * size + col) * 4;
      if (idx + 3 >= splatData.length) continue;

      // ch0 grass, ch1 soil, ch2 sand, ch3 stone
      if (h <= 1.8) {
        splatData[idx] = 0;
        splatData[idx + 1] = 0;
        splatData[idx + 2] = 255;
        splatData[idx + 3] = 0;
      } else if (h < 10) {
        splatData[idx] = 255;
        splatData[idx + 1] = 0;
        splatData[idx + 2] = 0;
        splatData[idx + 3] = 0;
      } else if (h < 22) {
        splatData[idx] = 0;
        splatData[idx + 1] = 255;
        splatData[idx + 2] = 0;
        splatData[idx + 3] = 0;
      } else {
        splatData[idx] = 0;
        splatData[idx + 1] = 0;
        splatData[idx + 2] = 0;
        splatData[idx + 3] = 255;
      }
    }
  }
  splatMap.needsUpdate = true;
}
