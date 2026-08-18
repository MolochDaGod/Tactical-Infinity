/**
 * Island seed archetypes — one-click procedural islands for the admin editor.
 *
 * Types (fleet SSOT):
 *   home | event | conquerable | faction | boss
 *
 * Each seed is deterministic: same archetype + seed → same heightmap + nodes.
 * Node palette matches production island roles (wood, rock, flowers, ore, scrap,
 * fishing, animals, evil mountain, PvE, dock, flat build zone).
 */

import { mulberry32, childSeed, deterministicId } from '@/lib/ids';

export type IslandArchetype =
  | 'home'
  | 'event'
  | 'conquerable'
  | 'faction'
  | 'boss';

/** Placeable editor node kinds — map to stylized CDN packs in editorStylizedAssets. */
export type EditorNodeKind =
  | 'palm_tree'
  | 'pine_tree'
  | 'dead_tree'
  | 'rock'
  | 'ore_iron'
  | 'ore_gold'
  | 'ore_copper'
  | 'crystal'
  | 'herb_bush'
  | 'flowers'
  | 'deer'
  | 'boar'
  | 'goldmine_node'
  | 'evil_mountain'
  | 'cliff'
  | 'scrap'
  | 'fishing_spot'
  | 'pve_camp'
  | 'dock'
  | 'flat_zone'
  | 'house'
  | 'tower'
  | 'barracks'
  | 'forge'
  | 'farm'
  | 'warehouse'
  | 'market'
  | 'wall'
  | 'sawmill'
  | 'campfire'
  | 'lantern';

export interface SeedPlacement {
  id: string;
  kind: EditorNodeKind;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  /** Optional scale override (evil mountain / cliff). */
  scale?: number;
  /** Harvest metadata for regrow nodes. */
  harvest?: {
    profession: 'woodcutting' | 'mining' | 'herbalism' | 'fishing' | 'skinning' | 'salvage';
    yieldId: string;
    maxHp: number;
    respawnMs: number;
  };
}

export interface IslandSeedResult {
  seed: number;
  archetype: IslandArchetype;
  name: string;
  biome: string;
  waterLevel: number;
  /** Vertex Y heights for a SIZE×SIZE plane with SEGS segments (SEGS+1)² verts. */
  heightmap: number[];
  gridSize: number;
  segments: number;
  placements: SeedPlacement[];
  notes: string[];
}

export interface ArchetypeDef {
  id: IslandArchetype;
  label: string;
  description: string;
  defaultBiome: string;
  waterLevel: number;
  /** Peak height bias (m). */
  peakBias: number;
  /** Count ranges per node kind (min–max inclusive via rng). */
  counts: Partial<Record<EditorNodeKind, [number, number]>>;
  /** Force-include landmarks. */
  landmarks: EditorNodeKind[];
  notes: string[];
}

export const ARCHETYPE_DEFS: Record<IslandArchetype, ArchetypeDef> = {
  home: {
    id: 'home',
    label: 'Home Island',
    description: 'Player sanctuary: forest, rocks, flowers, ore, dock, flat build zone, evil mountain doorway.',
    defaultBiome: 'tropical',
    waterLevel: 1.2,
    peakBias: 14,
    counts: {
      palm_tree: [18, 28],
      pine_tree: [6, 12],
      rock: [14, 22],
      ore_iron: [4, 7],
      ore_copper: [3, 5],
      crystal: [1, 3],
      herb_bush: [8, 14],
      flowers: [10, 16],
      deer: [2, 4],
      boar: [1, 2],
      fishing_spot: [2, 4],
      scrap: [2, 4],
      campfire: [1, 2],
      lantern: [2, 4],
    },
    landmarks: ['dock', 'flat_zone', 'evil_mountain', 'house', 'farm'],
    notes: [
      'Forest + beach + ore veins + flower clothes nodes',
      'Evil mountain opening scaled ~3 m tall (PvE entry)',
      'Dock + flat build zone for raft/home progression',
    ],
  },
  event: {
    id: 'event',
    label: 'Event Island',
    description: 'Limited-time event shell: denser harvest, scrap, fishing, light combat camp.',
    defaultBiome: 'tropical',
    waterLevel: 1.0,
    peakBias: 10,
    counts: {
      palm_tree: [12, 18],
      rock: [10, 16],
      ore_gold: [3, 6],
      crystal: [2, 4],
      flowers: [6, 10],
      herb_bush: [4, 8],
      scrap: [6, 10],
      fishing_spot: [3, 5],
      deer: [1, 2],
      campfire: [2, 3],
    },
    landmarks: ['dock', 'pve_camp', 'market'],
    notes: ['Event scrap + gold nodes', 'PvE camp for scripted encounters'],
  },
  conquerable: {
    id: 'conquerable',
    label: 'Conquerable Island',
    description: 'Claimable territory: defenses, ore, barracks, contested PvE.',
    defaultBiome: 'forest',
    waterLevel: 1.4,
    peakBias: 16,
    counts: {
      pine_tree: [16, 24],
      dead_tree: [4, 8],
      rock: [12, 18],
      ore_iron: [6, 10],
      ore_gold: [2, 4],
      cliff: [2, 4],
      herb_bush: [4, 8],
      boar: [2, 4],
      scrap: [3, 5],
      fishing_spot: [1, 2],
    },
    landmarks: ['dock', 'barracks', 'tower', 'wall', 'pve_camp', 'flat_zone'],
    notes: ['Military buildings + wall ring', 'Rich iron for conquer economy'],
  },
  faction: {
    id: 'faction',
    label: 'Faction Island',
    description: 'Faction stronghold: forge, warehouse, barracks, themed biome.',
    defaultBiome: 'temperate',
    waterLevel: 1.3,
    peakBias: 12,
    counts: {
      pine_tree: [14, 20],
      palm_tree: [4, 8],
      rock: [10, 14],
      ore_iron: [5, 8],
      ore_copper: [3, 5],
      crystal: [1, 2],
      flowers: [4, 8],
      deer: [2, 3],
      fishing_spot: [2, 3],
      lantern: [4, 6],
    },
    landmarks: ['dock', 'forge', 'warehouse', 'barracks', 'tower', 'house', 'flat_zone'],
    notes: ['Production buildings for faction logistics', 'Lantern ring for night identity'],
  },
  boss: {
    id: 'boss',
    label: 'Boss Island',
    description: 'Arena island: evil mountain, cliffs, sparse harvest, boss camp.',
    defaultBiome: 'volcanic',
    waterLevel: 0.8,
    peakBias: 28,
    counts: {
      dead_tree: [8, 14],
      rock: [16, 24],
      cliff: [4, 7],
      ore_gold: [2, 4],
      crystal: [4, 7],
      ore_iron: [3, 5],
      scrap: [2, 4],
      campfire: [1, 2],
    },
    landmarks: ['evil_mountain', 'pve_camp', 'dock', 'flat_zone'],
    notes: [
      'High peak + evil mountain doorway (~3 m)',
      'Boss arena flat zone ≥14 m clear',
      'Crystal/gold sparse rewards',
    ],
  },
};

const HARVEST_BY_KIND: Partial<
  Record<EditorNodeKind, SeedPlacement['harvest']>
> = {
  palm_tree: { profession: 'woodcutting', yieldId: 'wood', maxHp: 4, respawnMs: 90_000 },
  pine_tree: { profession: 'woodcutting', yieldId: 'wood', maxHp: 5, respawnMs: 100_000 },
  dead_tree: { profession: 'woodcutting', yieldId: 'wood', maxHp: 3, respawnMs: 70_000 },
  rock: { profession: 'mining', yieldId: 'stone', maxHp: 3, respawnMs: 80_000 },
  ore_iron: { profession: 'mining', yieldId: 'iron_ore', maxHp: 5, respawnMs: 120_000 },
  ore_gold: { profession: 'mining', yieldId: 'gold_ore', maxHp: 6, respawnMs: 180_000 },
  ore_copper: { profession: 'mining', yieldId: 'copper_ore', maxHp: 4, respawnMs: 110_000 },
  crystal: { profession: 'mining', yieldId: 'crystal_shard', maxHp: 5, respawnMs: 150_000 },
  herb_bush: { profession: 'herbalism', yieldId: 'herbs', maxHp: 2, respawnMs: 60_000 },
  flowers: { profession: 'herbalism', yieldId: 'cloth_fiber', maxHp: 2, respawnMs: 55_000 },
  deer: { profession: 'skinning', yieldId: 'hide', maxHp: 3, respawnMs: 140_000 },
  boar: { profession: 'skinning', yieldId: 'meat', maxHp: 4, respawnMs: 140_000 },
  goldmine_node: { profession: 'mining', yieldId: 'gold_ore', maxHp: 8, respawnMs: 240_000 },
  scrap: { profession: 'salvage', yieldId: 'scrap_metal', maxHp: 3, respawnMs: 90_000 },
  fishing_spot: { profession: 'fishing', yieldId: 'raw_fish', maxHp: 2, respawnMs: 45_000 },
};

function randRange(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Heightmap for editor plane: SIZE world units, SEGS segments → (SEGS+1)² verts.
 * Y in metres; radial island falloff into sea.
 */
export function synthesizeHeightmap(
  seed: number,
  segments: number,
  size: number,
  peakBias: number,
  archetype: IslandArchetype,
): number[] {
  const rng = mulberry32(childSeed(seed, 'height'));
  const n = segments + 1;
  const half = size / 2;
  const out = new Array<number>(n * n);

  // Simple value-noise grid
  const noiseRes = 8;
  const noise: number[][] = [];
  for (let j = 0; j <= noiseRes; j++) {
    noise[j] = [];
    for (let i = 0; i <= noiseRes; i++) {
      noise[j][i] = rng();
    }
  }
  /** Bilinear sample. Accepts any real u/v (callers pass frequency-scaled coords). */
  const sampleNoise = (u: number, v: number) => {
    // Wrap into [0, noiseRes) so u*1.7 etc. never OOB on the noise grid
    const wrap = (t: number) => {
      const m = ((t % noiseRes) + noiseRes) % noiseRes;
      return m;
    };
    const x = wrap(u * noiseRes);
    const z = wrap(v * noiseRes);
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    // noise grid is (noiseRes+1) on each side → indices 0..noiseRes
    const x1 = x0 === noiseRes ? 0 : x0 + 1;
    const z1 = z0 === noiseRes ? 0 : z0 + 1;
    const fx = x - x0;
    const fz = z - z0;
    const a = noise[z0]?.[x0] ?? 0.5;
    const b = noise[z0]?.[x1] ?? 0.5;
    const c = noise[z1]?.[x0] ?? 0.5;
    const d = noise[z1]?.[x1] ?? 0.5;
    const ab = a + (b - a) * fx;
    const cd = c + (d - c) * fx;
    return ab + (cd - ab) * fz;
  };

  const ridgeBoost = archetype === 'boss' ? 1.35 : archetype === 'home' ? 1.0 : 1.1;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const u = col / segments;
      const v = row / segments;
      const x = (u - 0.5) * size;
      const z = (v - 0.5) * size;
      const dist = Math.sqrt(x * x + z * z);
      const edge = half * 0.92;
      // Smooth island mask
      let mask = 1 - Math.min(1, dist / edge);
      mask = mask * mask * (3 - 2 * mask);

      const n1 = sampleNoise(u * 1.7 + 0.1, v * 1.7 + 0.2);
      const n2 = sampleNoise(u * 3.3 + 0.4, v * 3.1 + 0.6);
      let h = (n1 * 0.65 + n2 * 0.35) * peakBias * ridgeBoost;

      // Boss / volcanic: central caldera peak ring
      if (archetype === 'boss') {
        const r = dist / (half * 0.45);
        const ring = Math.exp(-Math.pow(r - 0.55, 2) * 8) * peakBias * 0.55;
        const crater = Math.max(0, 1 - r * r) * -peakBias * 0.25;
        h += ring + crater;
      }
      // Home: gentle central plateau + NE mountain pad for evil mountain
      if (archetype === 'home' || archetype === 'boss') {
        const mx = x - half * 0.28;
        const mz = z + half * 0.22;
        const md = Math.sqrt(mx * mx + mz * mz);
        h += Math.max(0, 1 - md / (half * 0.35)) * peakBias * 0.45;
      }
      // Flat zone depression near south for build pad
      {
        const fx = x;
        const fz = z - half * 0.15;
        const fd = Math.sqrt(fx * fx + fz * fz);
        if (fd < half * 0.18) {
          h = h * 0.35 + peakBias * 0.12;
        }
      }

      h *= mask;
      // Shore beach band
      if (mask > 0.05 && mask < 0.25) h = Math.min(h, 1.2 + n1 * 0.8);
      if (mask <= 0.02) h = -2 - n1 * 4;

      out[row * n + col] = h;
    }
  }
  return out;
}

function heightAt(
  heightmap: number[],
  segments: number,
  size: number,
  x: number,
  z: number,
): number {
  const n = segments + 1;
  const half = size / 2;
  const u = (x + half) / size;
  const v = (z + half) / size;
  if (u < 0 || u > 1 || v < 0 || v > 1) return -2;
  const col = u * segments;
  const row = v * segments;
  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  const c1 = Math.min(segments, c0 + 1);
  const r1 = Math.min(segments, r0 + 1);
  const fc = col - c0;
  const fr = row - r0;
  const h00 = heightmap[r0 * n + c0];
  const h10 = heightmap[r0 * n + c1];
  const h01 = heightmap[r1 * n + c0];
  const h11 = heightmap[r1 * n + c1];
  const h0 = h00 + (h10 - h00) * fc;
  const h1 = h01 + (h11 - h01) * fc;
  return h0 + (h1 - h0) * fr;
}

function pickLandPoint(
  rng: () => number,
  heightmap: number[],
  segments: number,
  size: number,
  opts: { minH?: number; maxH?: number; maxTries?: number; preferShore?: boolean },
): { x: number; y: number; z: number } | null {
  const minH = opts.minH ?? 0.4;
  const maxH = opts.maxH ?? 80;
  const maxTries = opts.maxTries ?? 40;
  const half = size * 0.42;
  for (let t = 0; t < maxTries; t++) {
    const ang = rng() * Math.PI * 2;
    const rad = opts.preferShore
      ? half * (0.55 + rng() * 0.35)
      : half * Math.sqrt(rng());
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const y = heightAt(heightmap, segments, size, x, z);
    if (y >= minH && y <= maxH) return { x, y, z };
  }
  return null;
}

export function generateIslandSeed(opts: {
  archetype: IslandArchetype;
  seed?: number;
  gridSize?: number;
  segments?: number;
  factionHint?: 'crusade' | 'fabled' | 'legion';
}): IslandSeedResult {
  const arch = (opts?.archetype || 'home') as IslandArchetype;
  const def = ARCHETYPE_DEFS[arch] ?? ARCHETYPE_DEFS.home;
  if (!def) {
    throw new Error(`[islandSeed] unknown archetype: ${String(opts?.archetype)}`);
  }
  const seed = (opts.seed ?? (Math.floor(Date.now() % 1_000_000_000) ^ 0x5eed)) >>> 0;
  const gridSize = opts.gridSize ?? 64;
  // Editor PlaneGeometry(size, size, segs, segs) has (segs+1)² verts — match that.
  const segments = opts.segments ?? 64;
  const rng = mulberry32(seed);

  const heightmap = synthesizeHeightmap(
    seed,
    segments,
    gridSize,
    def.peakBias ?? 12,
    arch,
  );

  const placements: SeedPlacement[] = [];
  const place = (kind: EditorNodeKind, pt: { x: number; y: number; z: number }, scale?: number) => {
    placements.push({
      id: deterministicId('node', opts.archetype, seed, kind, placements.length),
      kind,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      rotationY: rng() * Math.PI * 2,
      scale,
      harvest: HARVEST_BY_KIND[kind],
    });
  };

  // Landmarks first (consume footprint)
  const landmarks = def.landmarks ?? [];
  for (const lm of landmarks) {
    let pt: { x: number; y: number; z: number } | null = null;
    if (lm === 'dock' || lm === 'fishing_spot') {
      pt = pickLandPoint(rng, heightmap, segments, gridSize, {
        minH: -0.2,
        maxH: 2.5,
        preferShore: true,
        maxTries: 80,
      });
      // Shore placement can fail on tall seeds — force a beach ring point
      if (!pt) {
        const ang = rng() * Math.PI * 2;
        const rad = gridSize * 0.38;
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        pt = { x, y: Math.max(0.2, heightAt(heightmap, segments, gridSize, x, z)), z };
      }
    } else if (lm === 'evil_mountain') {
      // NE highland pad
      const half = gridSize / 2;
      const x = half * 0.28;
      const z = -half * 0.22;
      const y = heightAt(heightmap, segments, gridSize, x, z);
      pt = { x, y: Math.max(y, 4), z };
    } else if (lm === 'flat_zone') {
      pt = pickLandPoint(rng, heightmap, segments, gridSize, {
        minH: 0.5,
        maxH: 12,
        maxTries: 80,
      }) ?? { x: 0, y: 2, z: gridSize * 0.12 };
    } else if (lm === 'pve_camp') {
      pt = pickLandPoint(rng, heightmap, segments, gridSize, {
        minH: 1,
        maxH: 18,
        maxTries: 80,
      });
    } else {
      pt = pickLandPoint(rng, heightmap, segments, gridSize, {
        minH: 0.8,
        maxH: 22,
        maxTries: 80,
      });
    }
    if (!pt) {
      pt = { x: (rng() - 0.5) * 10, y: 2, z: (rng() - 0.5) * 10 };
    }
    place(lm, pt, lm === 'evil_mountain' ? 1 : undefined);
  }

  const counts = def.counts ?? {};
  for (const [kind, range] of Object.entries(counts) as [EditorNodeKind, [number, number]][]) {
    if (!range || range.length < 2) continue;
    const count = randRange(rng, range[0], range[1]);
    for (let i = 0; i < count; i++) {
      const shore = kind === 'fishing_spot' || kind === 'scrap';
      const highland = kind === 'cliff' || kind === 'ore_gold' || kind === 'crystal';
      let pt = pickLandPoint(rng, heightmap, segments, gridSize, {
        minH: shore ? -0.5 : highland ? 2 : 0.4,
        maxH: shore ? 3 : highland ? 50 : 28,
        preferShore: shore,
        maxTries: 60,
      });
      if (!pt) {
        const ang = rng() * Math.PI * 2;
        const rad = gridSize * 0.15 * Math.sqrt(rng());
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        pt = { x, y: Math.max(0.5, heightAt(heightmap, segments, gridSize, x, z)), z };
      }
      // Footprint avoid: skip if too close to evil_mountain landmark
      const nearMountain = placements.some(
        (p) =>
          p.kind === 'evil_mountain' &&
          (p.x - pt!.x) ** 2 + (p.z - pt!.z) ** 2 < 12 * 12,
      );
      if (nearMountain && kind !== 'cliff' && kind !== 'rock') continue;
      place(kind, pt);
    }
  }

  let biome = def.defaultBiome || 'tropical';
  if (arch === 'faction' && opts.factionHint === 'legion') biome = 'volcanic';
  if (arch === 'faction' && opts.factionHint === 'fabled') biome = 'forest';
  if (arch === 'home') biome = 'tropical';
  // Island editor biome dropdown uses forest (not temperate)
  if (biome === 'temperate') biome = 'forest';

  const name = `${def.label || arch} #${(seed % 10000).toString().padStart(4, '0')}`;

  return {
    seed,
    archetype: arch,
    name,
    biome,
    waterLevel: def.waterLevel ?? 1.2,
    heightmap,
    gridSize,
    segments,
    placements,
    notes: def.notes ?? [],
  };
}

export const ARCHETYPE_LIST = (
  Object.keys(ARCHETYPE_DEFS) as IslandArchetype[]
).map((id) => ARCHETYPE_DEFS[id]);
