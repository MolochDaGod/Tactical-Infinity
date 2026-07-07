import * as THREE from 'three';

export interface IslandTerrainConfig {
  size: number;
  segments: number;
  seed: number;
  maxHeight: number;
  waterLevel: number;
  beachWidth: number;
  hasDock: boolean;
  dockSide: 'north' | 'south' | 'east' | 'west';
}

export interface IslandTerrainResult {
  terrain: THREE.Mesh;
  water: THREE.Mesh;
  dock: THREE.Group | null;
  heightAt: (x: number, z: number) => number;
  harvestableSpots: { x: number; z: number; type: string }[];
  buildableSpots: { x: number; z: number }[];
  dockPosition: THREE.Vector3 | null;
}

export interface HarvestableNode {
  id: string;
  type: 'tree' | 'rock' | 'goldmine' | 'plant' | 'animal';
  subType: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  resource: string;
  yieldAmount: number;
}

const DEFAULT_CONFIG: IslandTerrainConfig = {
  size: 48,
  segments: 48,
  seed: 12345,
  maxHeight: 4.5,
  waterLevel: 0.05,
  beachWidth: 0.18,
  hasDock: true,
  dockSide: 'south',
};

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function perlin2D(x: number, z: number, freq: number, seed: number): number {
  const px = x * freq, pz = z * freq;
  const ix = Math.floor(px), iz = Math.floor(pz);
  const fx = px - ix, fz = pz - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const hash = (a: number, b: number) => {
    let h = ((a * 374761393 + b * 668265263 + seed) ^ (seed >> 13)) * 1274126177;
    h = (h ^ (h >> 16)) & 0x7fffffff;
    return (h / 0x7fffffff) * 2 - 1;
  };
  const n00 = hash(ix, iz), n10 = hash(ix + 1, iz);
  const n01 = hash(ix, iz + 1), n11 = hash(ix + 1, iz + 1);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sz) + (n01 * (1 - sx) + n11 * sx) * sz;
}

function fbmNoise(x: number, z: number, octaves: number, seed: number): number {
  let val = 0, amp = 1, freq = 0.08, total = 0;
  for (let i = 0; i < octaves; i++) {
    val += perlin2D(x, z, freq, seed + i * 31) * amp;
    total += amp; freq *= 2.1; amp *= 0.48;
  }
  return val / total;
}

function ridgeNoise(x: number, z: number, seed: number): number {
  let v = Math.abs(perlin2D(x, z, 0.06, seed));
  v += Math.abs(perlin2D(x, z, 0.12, seed + 77)) * 0.5;
  return (1 - v) * 0.6;
}

function islandFalloff(x: number, z: number, size: number): number {
  const nx = (x / size) * 2, nz = (z / size) * 2;
  const r = Math.sqrt(nx * nx + nz * nz);
  return Math.max(0, 1 - Math.pow(r, 2.2));
}

export function generateIslandTerrain(config: Partial<IslandTerrainConfig> = {}): IslandTerrainResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { size, segments, seed, maxHeight, waterLevel, hasDock, dockSide } = cfg;
  const rng = seeded(seed);
  const half = size / 2;

  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const heightMap: number[][] = [];
  for (let i = 0; i < segments + 1; i++) {
    heightMap[i] = [];
    for (let j = 0; j < segments + 1; j++) {
      heightMap[i][j] = 0;
    }
  }

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const falloff = islandFalloff(x, z, half * 0.85);
    const base  = fbmNoise(x, z, 5, seed) * 0.6 + 0.5;
    const ridge = ridgeNoise(x + 50, z + 50, seed + 999) * 0.4;
    const detail = perlin2D(x, z, 0.3, seed + 444) * 0.08;
    let h = (base + ridge + detail) * falloff * maxHeight;
    h = Math.max(-0.3, h);

    const ix = Math.round((x / size + 0.5) * segments);
    const iz = Math.round((z / size + 0.5) * segments);
    if (ix >= 0 && ix <= segments && iz >= 0 && iz <= segments) {
      heightMap[ix][iz] = h;
    }

    pos.setY(i, h);

    const ci = i * 3;
    if (h < waterLevel + 0.15) {
      colors[ci] = 0.88; colors[ci + 1] = 0.82; colors[ci + 2] = 0.62;
    } else if (h < maxHeight * 0.25) {
      colors[ci] = 0.60; colors[ci + 1] = 0.72; colors[ci + 2] = 0.35;
    } else if (h < maxHeight * 0.55) {
      colors[ci] = 0.32; colors[ci + 1] = 0.55; colors[ci + 2] = 0.25;
    } else if (h < maxHeight * 0.8) {
      colors[ci] = 0.45; colors[ci + 1] = 0.42; colors[ci + 2] = 0.38;
    } else {
      colors[ci] = 0.6; colors[ci + 1] = 0.58; colors[ci + 2] = 0.55;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  terrain.name = 'island_terrain';

  const heightAt = (wx: number, wz: number): number => {
    const ix = Math.round((wx / size + 0.5) * segments);
    const iz = Math.round((wz / size + 0.5) * segments);
    if (ix < 0 || ix > segments || iz < 0 || iz > segments) return -0.5;
    return heightMap[ix]?.[iz] ?? -0.5;
  };

  const waterGeo = new THREE.PlaneGeometry(size * 4, size * 4, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x4DC8D4, transparent: true, opacity: 0.78, flatShading: true,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = waterLevel;
  water.name = 'ocean_water';

  const harvestableSpots: { x: number; z: number; type: string }[] = [];
  const buildableSpots: { x: number; z: number }[] = [];

  for (let attempt = 0; attempt < 300; attempt++) {
    const x = (rng() - 0.5) * size * 0.8;
    const z = (rng() - 0.5) * size * 0.8;
    const h = heightAt(x, z);
    if (h <= waterLevel + 0.1 || h > maxHeight * 0.85) continue;

    const r = rng();
    if (r < 0.35) harvestableSpots.push({ x, z, type: 'tree' });
    else if (r < 0.55) harvestableSpots.push({ x, z, type: 'rock' });
    else if (r < 0.62) harvestableSpots.push({ x, z, type: 'goldmine' });
    else if (r < 0.75) harvestableSpots.push({ x, z, type: 'plant' });
    else if (r < 0.82) harvestableSpots.push({ x, z, type: 'animal' });
    else buildableSpots.push({ x, z });

    if (harvestableSpots.length > 50) break;
  }

  let dock: THREE.Group | null = null;
  let dockPosition: THREE.Vector3 | null = null;

  if (hasDock) {
    dock = buildDock(dockSide, size, heightAt);
    dockPosition = dock.position.clone();
  }

  return { terrain, water, dock, heightAt, harvestableSpots, buildableSpots, dockPosition };
}

function buildDock(side: string, size: number, heightAt: (x: number, z: number) => number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7A5030, flatShading: true });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x5A3820, flatShading: true });
  const rope = new THREE.MeshLambertMaterial({ color: 0xA09070, flatShading: true });

  const DOCK_LENGTH = 12, DOCK_WIDTH = 3, PLANK_H = 0.15;
  const planks = new THREE.Mesh(new THREE.BoxGeometry(DOCK_WIDTH, PLANK_H, DOCK_LENGTH), wood);
  planks.position.y = 0.35; planks.castShadow = true;
  g.add(planks);

  const PILES = 6;
  for (let i = 0; i < PILES; i++) {
    const row = (i % 2) === 0 ? -DOCK_WIDTH * 0.4 : DOCK_WIDTH * 0.4;
    const col = -DOCK_LENGTH * 0.4 + (i / (PILES - 1)) * DOCK_LENGTH * 0.8;
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.0, 6), darkWood);
    pile.position.set(row, -0.6, col);
    pile.castShadow = true;
    g.add(pile);
  }

  for (let i = 0; i < 3; i++) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 8), darkWood);
    bollard.position.set(i === 1 ? 0 : (i === 0 ? -1 : 1), 0.55, -DOCK_LENGTH * 0.45 + i * DOCK_LENGTH * 0.4);
    g.add(bollard);
  }

  const ropeLoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 12), rope);
  ropeLoop.position.set(-1, 0.65, -DOCK_LENGTH * 0.45);
  ropeLoop.rotation.x = Math.PI * 0.5;
  g.add(ropeLoop);

  let dx = 0, dz = 0;
  switch (side) {
    case 'south': dx = 0; dz = size * 0.42;  g.rotation.y = 0;           break;
    case 'north': dx = 0; dz = -size * 0.42; g.rotation.y = Math.PI;     break;
    case 'east':  dx = size * 0.42;  dz = 0; g.rotation.y = -Math.PI / 2; break;
    case 'west':  dx = -size * 0.42; dz = 0; g.rotation.y = Math.PI / 2;  break;
  }
  g.position.set(dx, heightAt(dx, dz) * 0.3, dz);
  g.name = 'dock';
  return g;
}

export function buildHarvestableNode(
  spot: { x: number; z: number; type: string },
  heightAt: (x: number, z: number) => number,
  seed: number,
): HarvestableNode {
  const rng = seeded(seed + spot.x * 1000 + spot.z * 777);
  const g = new THREE.Group();
  const y = heightAt(spot.x, spot.z);
  g.position.set(spot.x, y, spot.z);

  const flatMat = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  let hp = 50, resource = 'wood', yieldAmt = 5, subType = 'oak';

  const stdMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75 });

  switch (spot.type) {
    case 'tree': {
      subType = rng() > 0.4 ? 'palm' : 'oak';
      hp = 60; resource = 'raw_wood'; yieldAmt = 8;
      if (subType === 'palm') {
        const h = 3.5 + rng() * 2;
        const curve = (rng() - 0.5) * 0.15;
        for (let s = 0; s < 4; s++) {
          const sy = h * (s / 4);
          const segH = h / 4;
          const r1 = 0.16 - s * 0.02, r2 = 0.14 - s * 0.02;
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(r2, 0.05), Math.max(r1, 0.06), segH, 7), stdMat(0xB89460 + s * 0x050505));
          seg.position.set(curve * s, sy + segH * 0.5, curve * s * 0.3);
          seg.castShadow = true;
          g.add(seg);
          if (s < 3) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r1 + 0.01, 0.015, 3, 8), stdMat(0x8A6A3A));
            ring.position.set(curve * s, sy + segH, curve * s * 0.3);
            ring.rotation.x = Math.PI / 2;
            g.add(ring);
          }
        }
        const frondCount = 5 + Math.floor(rng() * 3);
        for (let j = 0; j < frondCount; j++) {
          const a = (j / frondCount) * Math.PI * 2 + rng() * 0.4;
          const fLen = 1.8 + rng() * 0.8;
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.3, fLen, 4), stdMat(0x1A7B2C - Math.floor(rng() * 0x101010)));
          frond.position.set(Math.cos(a) * 0.5 + curve * 3, h + 0.1, Math.sin(a) * 0.5);
          frond.rotation.set(-0.5 - rng() * 0.3, a, 0);
          frond.castShadow = true;
          g.add(frond);
        }
        const coconutMat = stdMat(0x5A3A1A);
        for (let c = 0; c < 2 + Math.floor(rng() * 2); c++) {
          const ca = rng() * Math.PI * 2;
          const coco = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), coconutMat);
          coco.position.set(Math.cos(ca) * 0.2, h - 0.15, Math.sin(ca) * 0.2);
          g.add(coco);
        }
      } else {
        const h = 2.5 + rng() * 1.5;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, h, 7), stdMat(0x6B3F1A));
        trunk.position.y = h * 0.5;
        trunk.castShadow = true;
        g.add(trunk);
        const rootMat = stdMat(0x5A3518);
        for (let r = 0; r < 3; r++) {
          const ra = (r / 3) * Math.PI * 2 + rng() * 0.5;
          const root = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.5, 4), rootMat);
          root.position.set(Math.cos(ra) * 0.18, 0.15, Math.sin(ra) * 0.18);
          root.rotation.set(0, ra, 0.5);
          g.add(root);
        }
        const canopyLayers = 2 + Math.floor(rng() * 2);
        for (let c = 0; c < canopyLayers; c++) {
          const cr = 0.8 + rng() * 0.5 - c * 0.15;
          const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(cr, 0), stdMat(0x1A6A2C + Math.floor(rng() * 0x102010)));
          canopy.position.set((rng() - 0.5) * 0.3, h + 0.3 + c * 0.5, (rng() - 0.5) * 0.3);
          canopy.scale.set(1 + rng() * 0.3, 0.7 + rng() * 0.3, 1 + rng() * 0.3);
          canopy.rotation.set(rng(), rng(), rng());
          canopy.castShadow = true;
          g.add(canopy);
        }
      }
      break;
    }
    case 'rock': {
      subType = 'boulder';
      hp = 80; resource = 'stone'; yieldAmt = 6;
      const mainS = 0.5 + rng() * 0.6;
      const rockMat = stdMat(0x7A7A7A);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(mainS, 0), rockMat);
      rock.rotation.set(rng() * 2, rng() * 6, rng() * 2);
      rock.scale.set(1 + rng() * 0.4, 0.6 + rng() * 0.5, 1 + rng() * 0.4);
      rock.position.y = mainS * 0.25;
      rock.castShadow = true;
      g.add(rock);
      for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
        const ss = mainS * (0.25 + rng() * 0.3);
        const sr = new THREE.Mesh(new THREE.DodecahedronGeometry(ss, 0), stdMat(0x6A6A6A + Math.floor(rng() * 0x202020)));
        sr.position.set((rng() - 0.5) * mainS, ss * 0.3, (rng() - 0.5) * mainS);
        sr.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        sr.scale.set(1, 0.6 + rng() * 0.4, 1);
        sr.castShadow = true;
        g.add(sr);
      }
      const mossPatch = new THREE.Mesh(new THREE.SphereGeometry(mainS * 0.4, 4, 3), stdMat(0x3A6A2A));
      mossPatch.position.set(rng() * 0.2, mainS * 0.4, rng() * 0.2);
      mossPatch.scale.set(1.3, 0.3, 1.3);
      g.add(mossPatch);
      break;
    }
    case 'goldmine': {
      subType = 'goldmine';
      hp = 120; resource = 'rare_ore'; yieldAmt = 3;
      const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), stdMat(0x5A4A3A));
      base.position.y = 0.3;
      base.scale.set(1.3, 0.7, 1.3);
      base.rotation.set(rng(), rng(), rng());
      base.castShadow = true;
      g.add(base);
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, flatShading: true, roughness: 0.25, metalness: 0.8 });
      for (let i = 0; i < 4; i++) {
        const ns = 0.1 + rng() * 0.18;
        const nugget = new THREE.Mesh(new THREE.OctahedronGeometry(ns, 0), goldMat);
        nugget.position.set((rng() - 0.5) * 0.6, 0.4 + rng() * 0.3, (rng() - 0.5) * 0.4);
        nugget.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        nugget.castShadow = true;
        g.add(nugget);
      }
      const shimmer = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
      shimmer.position.y = 0.6;
      shimmer.rotation.x = -Math.PI / 2;
      g.add(shimmer);
      break;
    }
    case 'plant': {
      subType = rng() > 0.5 ? 'herb' : 'flower';
      hp = 20; resource = subType === 'herb' ? 'herb_bundle' : 'mageroyal'; yieldAmt = 4;
      const stemCount = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < stemCount; i++) {
        const sh = 0.3 + rng() * 0.35;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.025, sh, 4),
          stdMat(subType === 'herb' ? 0x2A7A2A : 0x3A6A40)
        );
        const sx = (rng() - 0.5) * 0.35, sz = (rng() - 0.5) * 0.35;
        stem.position.set(sx, sh * 0.5, sz);
        stem.rotation.z = (rng() - 0.5) * 0.2;
        g.add(stem);
        const leafW = 0.06 + rng() * 0.04;
        for (let lf = 0; lf < 2; lf++) {
          const leaf = new THREE.Mesh(
            new THREE.PlaneGeometry(leafW, leafW * 2),
            new THREE.MeshStandardMaterial({ color: 0x2A8A2A + Math.floor(rng() * 0x101010), flatShading: true, roughness: 0.8, side: THREE.DoubleSide })
          );
          leaf.position.set(sx + (lf === 0 ? 0.04 : -0.04), sh * (0.3 + rng() * 0.3), sz);
          leaf.rotation.set(0.3 * (lf === 0 ? 1 : -1), rng(), lf * Math.PI * 0.5);
          g.add(leaf);
        }
        if (subType === 'flower') {
          const petalColors = [0xE84488, 0xAA44CC, 0xFF6644, 0xFFAA22, 0x4488FF];
          const pColor = petalColors[Math.floor(rng() * petalColors.length)];
          const center = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), stdMat(0xFFCC00));
          center.position.set(sx, sh + 0.02, sz);
          g.add(center);
          for (let p = 0; p < 5; p++) {
            const pa = (p / 5) * Math.PI * 2;
            const petal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), stdMat(pColor));
            petal.position.set(sx + Math.cos(pa) * 0.06, sh + 0.02, sz + Math.sin(pa) * 0.06);
            petal.scale.set(1, 0.5, 1.5);
            g.add(petal);
          }
        } else {
          const leafTop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3), stdMat(0x1A8A2A));
          leafTop.position.set(sx, sh + 0.02, sz);
          leafTop.scale.set(1.5, 0.6, 1.5);
          g.add(leafTop);
        }
      }
      break;
    }
    case 'animal': {
      const animals = ['deer', 'boar', 'rabbit'];
      subType = animals[Math.floor(rng() * animals.length)];
      hp = 40; resource = 'raw_hide'; yieldAmt = 3;
      const bodyColor = subType === 'boar' ? 0x5A3A2A : subType === 'deer' ? 0x9A7050 : 0xB0A090;
      const bellyColor = subType === 'boar' ? 0x7A5A4A : subType === 'deer' ? 0xC8A880 : 0xD0C8B8;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 5, 8), stdMat(bodyColor));
      body.position.y = 0.42;
      body.rotation.z = Math.PI * 0.5;
      body.castShadow = true;
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 5, 4), stdMat(bellyColor));
      belly.position.set(0, 0.35, 0);
      belly.scale.set(1.2, 0.6, 0.8);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), stdMat(bodyColor));
      head.position.set(0.42, 0.48, 0);
      head.scale.set(1.2, 1, 0.9);
      head.castShadow = true;
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3), stdMat(subType === 'boar' ? 0x8A6A5A : bodyColor));
      snout.position.set(0.54, 0.45, 0);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 3, 3), stdMat(0x3A2A2A));
      nose.position.set(0.58, 0.46, 0);
      const eyeMat = stdMat(0x1A1A1A);
      const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), eyeMat);
      lEye.position.set(0.48, 0.52, 0.08);
      const rEye = lEye.clone();
      rEye.position.set(0.48, 0.52, -0.08);
      const legMat = stdMat(bodyColor);
      const legs: THREE.Mesh[] = [];
      [[-0.15, 0.12], [0.15, 0.12], [-0.15, -0.12], [0.15, -0.12]].forEach(([lx, lz]) => {
        const lh = subType === 'rabbit' ? 0.2 : 0.32;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, lh, 5), legMat);
        leg.position.set(lx, lh * 0.5, lz);
        leg.castShadow = true;
        const hoof = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), stdMat(0x3A2A1A));
        hoof.position.set(lx, 0.02, lz);
        legs.push(leg, hoof);
      });
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), stdMat(subType === 'rabbit' ? 0xE0D8D0 : bodyColor));
      tail.position.set(-0.38, 0.46, 0);
      g.add(body, belly, head, snout, nose, lEye, rEye, tail, ...legs);
      if (subType === 'deer') {
        for (let a = 0; a < 2; a++) {
          const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.25, 4), stdMat(0x8A7A5A));
          antler.position.set(0.4, 0.62, a === 0 ? 0.06 : -0.06);
          antler.rotation.z = (a === 0 ? -0.3 : 0.3);
          g.add(antler);
        }
      }
      if (subType === 'boar') {
        for (let t = 0; t < 2; t++) {
          const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.08, 3), stdMat(0xE8D8C8));
          tusk.position.set(0.52, 0.42, t === 0 ? 0.06 : -0.06);
          tusk.rotation.x = -0.3;
          g.add(tusk);
        }
      }
      if (subType === 'rabbit') {
        for (let e = 0; e < 2; e++) {
          const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.15, 4), stdMat(bodyColor));
          ear.position.set(0.38, 0.6, e === 0 ? 0.04 : -0.04);
          ear.rotation.z = e === 0 ? -0.15 : 0.15;
          g.add(ear);
        }
      }
      break;
    }
  }

  g.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true; });
  g.name = `harvestable_${spot.type}_${seed}`;

  return {
    id: `${spot.type}_${Math.round(spot.x)}_${Math.round(spot.z)}`,
    type: spot.type as HarvestableNode['type'],
    subType,
    mesh: g,
    position: g.position.clone(),
    hp, maxHp: hp,
    resource, yieldAmount: yieldAmt,
  };
}
