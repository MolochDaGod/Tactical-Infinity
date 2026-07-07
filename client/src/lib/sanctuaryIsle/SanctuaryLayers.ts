/**
 * sanctuaryIsle/SanctuaryLayers.ts
 *
 * Deterministic spawners for the lore-canonical Sanctuary Isle layout. Every
 * spawner is a pure function: heightmap + seeded RNG → typed-node array.
 * Spawners only emit nodes that satisfy their placement contract (above water,
 * below cliff slope, within radius, etc.) — they sample the heightmap directly
 * and never raycast.
 */

import type { IslandHeightmap } from '@/lib/islandsCanonical/IslandHeightmap';
import type {
  AllyNode, AnimalNode, BossNode, CampNode, CaveNode, CliffMarker, CoralNode,
  DungeonNode, EventNode, FishNode, ImpactNode, LandPredatorNode, NpcNode,
  OreNode, PathfindingLayer, PlantNode, PlayerSpawnLayer, RewardNode, RockNode,
  TreasureNode, TreeNode, Vec3, VfxNode, WaterPredatorNode,
} from './types';

// ── Tiny mulberry32 RNG so spawners are deterministic per seed ──────────────
function mulberry32(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/**
 * Sample N positions on the island that satisfy a band (min/max altitude)
 * and a max radius from centre. Failed candidates are simply re-rolled —
 * we cap attempts to avoid runaway loops.
 */
function samplePositions(
  rng: () => number,
  heightmap: IslandHeightmap,
  count: number,
  minY: number,
  maxY: number,
  maxRadius: number,
  attemptsPerHit = 16,
): Vec3[] {
  const out: Vec3[] = [];
  let safety = count * attemptsPerHit;
  while (out.length < count && safety-- > 0) {
    const ang = rng() * Math.PI * 2;
    const r   = Math.sqrt(rng()) * maxRadius;       // sqrt → uniform across disk
    const x   = Math.cos(ang) * r;
    const z   = Math.sin(ang) * r;
    const y   = heightmap.getHeightAt(x, z);
    if (y >= minY && y <= maxY) {
      out.push([x, y, z]);
    }
  }
  return out;
}

/** Same as `samplePositions` but on a circular ring (for camps around the centre). */
function sampleRing(
  rng: () => number,
  heightmap: IslandHeightmap,
  count: number,
  minY: number,
  maxY: number,
  innerR: number,
  outerR: number,
  attemptsPerHit = 16,
): Vec3[] {
  const out: Vec3[] = [];
  let safety = count * attemptsPerHit;
  while (out.length < count && safety-- > 0) {
    const ang = rng() * Math.PI * 2;
    const r   = innerR + rng() * (outerR - innerR);
    const x   = Math.cos(ang) * r;
    const z   = Math.sin(ang) * r;
    const y   = heightmap.getHeightAt(x, z);
    if (y >= minY && y <= maxY) {
      out.push([x, y, z]);
    }
  }
  return out;
}

// ── Pathfinding walkable mask ───────────────────────────────────────────────

export function buildPathfindingLayer(
  heightmap: IslandHeightmap,
  maxSlopeRad = Math.PI / 3.5,        // ~51° walkable ceiling
): PathfindingLayer {
  const r    = heightmap.resolution;
  const data = heightmap.data;
  const walkable = new Uint8Array(r * r);
  const cosMaxSlope = Math.cos(maxSlopeRad);

  // Cell spacing in world units. r = size + 1 cells across worldSize.
  const cellW = heightmap.worldSize / (r - 1);

  for (let y = 0; y < r; y++) {
    for (let x = 0; x < r; x++) {
      const i  = y * r + x;
      const h  = data[i];
      if (h <= 0.1) {                                       // under or at water — not walkable
        walkable[i] = 0; continue;
      }
      // Slope from finite-difference (clamped to grid).
      const xL = Math.max(0, x - 1), xR = Math.min(r - 1, x + 1);
      const yU = Math.max(0, y - 1), yD = Math.min(r - 1, y + 1);
      const dx = (data[y * r + xR] - data[y * r + xL]) / ((xR - xL) * cellW);
      const dz = (data[yD * r + x] - data[yU * r + x]) / ((yD - yU) * cellW);
      const ny = 1 / Math.sqrt(dx * dx + dz * dz + 1);     // upward component of normal
      walkable[i] = ny >= cosMaxSlope ? 1 : 0;
    }
  }

  return { walkable, resolution: r, maxSlopeRad };
}

// ── Layer spawners (each takes heightmap + seed) ────────────────────────────

const TREE_KINDS_LOWLAND  = ['oak', 'birch', 'mossy'] as const;
const TREE_KINDS_HIGHLAND = ['pine', 'mossy']         as const;
const PLANT_KINDS         = ['fern', 'flower_field', 'reed', 'mushroom_ring'] as const;
const ROCK_KINDS          = ['boulder', 'standing_stone', 'cairn']            as const;

export function spawnTrees(rng: () => number, heightmap: IslandHeightmap, radius: number): TreeNode[] {
  const out: TreeNode[] = [];
  // Lowland forest (oak/birch/mossy)
  for (const [x, y, z] of samplePositions(rng, heightmap, 60, 1.0, 12.0, radius * 0.85)) {
    out.push({
      id: `tree-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, TREE_KINDS_LOWLAND),
      yawRad: rng() * Math.PI * 2, scale: 0.8 + rng() * 0.6,
    });
  }
  // Highland conifers
  for (const [x, y, z] of samplePositions(rng, heightmap, 25, 12.0, 22.0, radius * 0.7)) {
    out.push({
      id: `tree-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, TREE_KINDS_HIGHLAND),
      yawRad: rng() * Math.PI * 2, scale: 0.7 + rng() * 0.5,
    });
  }
  // A handful of palms on the beach
  for (const [x, y, z] of samplePositions(rng, heightmap, 8, 0.2, 1.4, radius)) {
    out.push({
      id: `tree-${out.length}`, pos: [x, y, z], active: true,
      kind: 'palm', yawRad: rng() * Math.PI * 2, scale: 0.9 + rng() * 0.4,
    });
  }
  return out;
}

export function spawnPlants(rng: () => number, heightmap: IslandHeightmap, radius: number): PlantNode[] {
  const out: PlantNode[] = [];
  for (const [x, y, z] of samplePositions(rng, heightmap, 40, 0.5, 14.0, radius)) {
    out.push({
      id: `plant-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, PLANT_KINDS), radius: 0.8 + rng() * 1.6,
    });
  }
  return out;
}

export function spawnOres(rng: () => number, heightmap: IslandHeightmap, radius: number): OreNode[] {
  const out: OreNode[] = [];
  // Ores prefer mid/high altitudes — they're rare on the meadow.
  const specs: Array<{ kind: OreNode['kind']; count: number; band: [number, number]; respawnSec: number }> = [
    { kind: 'iron_vein',   count: 4, band: [10, 22], respawnSec: 600  },
    { kind: 'gold_vein',   count: 2, band: [14, 22], respawnSec: 1500 },
    { kind: 'crystal_vein',count: 3, band: [12, 22], respawnSec: 1200 },
    { kind: 'mossy_stone', count: 8, band: [4,  16], respawnSec: 400  },
    { kind: 'mana_font',   count: 1, band: [2,  10], respawnSec: 0    },
  ];
  for (const s of specs) {
    for (const [x, y, z] of samplePositions(rng, heightmap, s.count, s.band[0], s.band[1], radius * 0.85)) {
      out.push({
        id: `ore-${out.length}`, pos: [x, y, z], active: true,
        kind: s.kind, respawnSec: s.respawnSec,
      });
    }
  }
  return out;
}

export function spawnRocks(rng: () => number, heightmap: IslandHeightmap, radius: number): RockNode[] {
  const out: RockNode[] = [];
  for (const [x, y, z] of samplePositions(rng, heightmap, 30, 1.0, 22.0, radius)) {
    const destructible = rng() < 0.2;
    out.push({
      id: `rock-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, ROCK_KINDS),
      yawRad: rng() * Math.PI * 2, scale: 0.6 + rng() * 1.6,
      destructible, hp: destructible ? 80 : undefined,
    });
  }
  return out;
}

export function spawnCliffs(rng: () => number, heightmap: IslandHeightmap, radius: number): CliffMarker[] {
  // Mark a few high-altitude lookout cliffs.
  const out: CliffMarker[] = [];
  for (const [x, y, z] of samplePositions(rng, heightmap, 6, 16.0, 24.0, radius * 0.55)) {
    out.push({
      id: `cliff-${out.length}`, pos: [x, y, z], active: true,
      length: 8 + rng() * 8, height: 4 + rng() * 6,
    });
  }
  return out;
}

export function spawnCaves(rng: () => number, heightmap: IslandHeightmap, radius: number): CaveNode[] {
  const out: CaveNode[] = [];
  for (const [x, y, z] of samplePositions(rng, heightmap, 3, 6.0, 18.0, radius * 0.7)) {
    out.push({
      id: `cave-${out.length}`, pos: [x, y, z], active: true,
      depth: 6 + rng() * 12, lootTable: 'cave_basic',
    });
  }
  return out;
}

export function spawnDungeons(rng: () => number, heightmap: IslandHeightmap, radius: number): DungeonNode[] {
  const out: DungeonNode[] = [];
  // Sanctuary is a hub — only one tier-1 dungeon, deep on the lookout cliff.
  const positions = samplePositions(rng, heightmap, 1, 14.0, 22.0, radius * 0.4);
  for (const [x, y, z] of positions) {
    out.push({
      id: `dungeon-${out.length}`, pos: [x, y, z], active: true,
      tier: 1, bossId: 'forest_warden',
    });
  }
  return out;
}

export function spawnAnimals(rng: () => number, heightmap: IslandHeightmap, radius: number): AnimalNode[] {
  const out: AnimalNode[] = [];
  const specs: Array<{ kind: AnimalNode['kind']; count: number; band: [number, number] }> = [
    { kind: 'rabbit',  count: 12, band: [1, 14] },
    { kind: 'deer',    count: 6,  band: [2, 16] },
    { kind: 'fox',     count: 4,  band: [2, 14] },
    { kind: 'crab',    count: 8,  band: [0.1, 1.0] },
    { kind: 'seagull', count: 6,  band: [0.1, 4.0] },
  ];
  for (const s of specs) {
    for (const [x, y, z] of samplePositions(rng, heightmap, s.count, s.band[0], s.band[1], radius)) {
      out.push({
        id: `animal-${out.length}`, pos: [x, y, z], active: true,
        kind: s.kind, roamRadius: 6 + rng() * 8, level: 1,
      });
    }
  }
  return out;
}

export function spawnLandPredators(rng: () => number, heightmap: IslandHeightmap, radius: number): LandPredatorNode[] {
  const out: LandPredatorNode[] = [];
  // Sanctuary is a safe-zone hub: only a few low-level predators on the back ridge.
  const specs: Array<{ kind: LandPredatorNode['kind']; count: number; band: [number, number]; level: number }> = [
    { kind: 'wolf',      count: 3, band: [8, 18], level: 4 },
    { kind: 'wild_boar', count: 2, band: [4, 12], level: 3 },
    { kind: 'spider',    count: 4, band: [10, 20], level: 5 },
  ];
  for (const s of specs) {
    for (const [x, y, z] of samplePositions(rng, heightmap, s.count, s.band[0], s.band[1], radius * 0.85)) {
      out.push({
        id: `lpred-${out.length}`, pos: [x, y, z], active: true,
        kind: s.kind, faction: 'neutral',
        roamRadius: 10, aggroRadius: 8, level: s.level,
      });
    }
  }
  return out;
}

export function spawnWaterPredators(rng: () => number, heightmap: IslandHeightmap, radius: number): WaterPredatorNode[] {
  const out: WaterPredatorNode[] = [];
  const specs: Array<{ kind: WaterPredatorNode['kind']; count: number; level: number }> = [
    { kind: 'shark',       count: 3, level: 6 },
    { kind: 'eel',         count: 4, level: 4 },
    { kind: 'sea_serpent', count: 1, level: 8 },
  ];
  for (const s of specs) {
    for (const [x, y, z] of samplePositions(rng, heightmap, s.count, -16, -2, radius * 1.3)) {
      out.push({
        id: `wpred-${out.length}`, pos: [x, y, z], active: true,
        kind: s.kind, roamRadius: 14, aggroRadius: 10, level: s.level,
      });
    }
  }
  return out;
}

export function spawnFish(
  rng: () => number,
  heightmap: IslandHeightmap,
  radius: number,
  center: { x: number; z: number } = { x: 0, z: 0 },
): FishNode[] {
  const out: FishNode[] = [];
  const kinds: FishNode['kind'][] = ['clownfish','tuna','koi','angler','lionfish','piranha'];
  for (const [x, y, z] of samplePositions(rng, heightmap, 24, -10, -1, radius * 1.2)) {
    out.push({
      id: `fish-${out.length}`, pos: [center.x + x, y, center.z + z], active: true,
      kind: pick(rng, kinds), schoolSize: 6 + Math.floor(rng() * 10),
    });
  }
  return out;
}

export function spawnSeaCoral(rng: () => number, heightmap: IslandHeightmap, radius: number): CoralNode[] {
  const out: CoralNode[] = [];
  const kinds: CoralNode['kind'][] = ['brain_coral', 'fan_coral', 'kelp_forest'];
  for (const [x, y, z] of samplePositions(rng, heightmap, 18, -8, -1, radius * 1.1)) {
    out.push({
      id: `coral-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, kinds), radius: 1.5 + rng() * 3.5,
    });
  }
  return out;
}

export function spawnBosses(rng: () => number, heightmap: IslandHeightmap, radius: number): BossNode[] {
  // Hub island — one boss, deep in the dungeon area.
  const out: BossNode[] = [];
  const positions = samplePositions(rng, heightmap, 1, 14.0, 22.0, radius * 0.35);
  for (const [x, y, z] of positions) {
    out.push({
      id: 'boss-forest-warden', pos: [x, y, z], active: true,
      kind: 'forest_warden', tier: 2, faction: 'fabled', arenaRadius: 12,
    });
  }
  return out;
}

export function spawnNpcs(rng: () => number, heightmap: IslandHeightmap, _radius: number): NpcNode[] {
  // Hand-placed at lore-canonical spots near sea level, then snapped to the heightmap.
  const places: Array<{ kind: NpcNode['kind']; pos: [number, number]; faction: NpcNode['faction'] }> = [
    { kind: 'innkeeper',  pos: [  6,  -4 ], faction: 'neutral' },
    { kind: 'shipwright', pos: [ 36,   0 ], faction: 'neutral' },
    { kind: 'merchant',   pos: [-12, -16 ], faction: 'neutral' },
    { kind: 'priestess',  pos: [  0,  18 ], faction: 'neutral' },
    { kind: 'questgiver', pos: [-22,   4 ], faction: 'neutral' },
    { kind: 'guard',      pos: [ 14,   8 ], faction: 'crusade' },
    { kind: 'guard',      pos: [-14, -10 ], faction: 'fabled'  },
    { kind: 'wandering_scholar', pos: [-4, 12 ], faction: 'neutral' },
    { kind: 'blacksmith', pos: [ 22,  -4 ], faction: 'neutral' },
  ];
  return places.map((p, i) => {
    const y = heightmap.getHeightAt(p.pos[0], p.pos[1]);
    return {
      id: `npc-${i}`, pos: [p.pos[0], y, p.pos[1]], active: true,
      kind: p.kind, faction: p.faction, yawRad: rng() * Math.PI * 2,
    } satisfies NpcNode;
  });
}

export function spawnAllies(rng: () => number, heightmap: IslandHeightmap, _radius: number): AllyNode[] {
  // A small honour-guard around the priestess.
  const out: AllyNode[] = [];
  const ringPositions = sampleRing(rng, heightmap, 6, 1, 14, 8, 14);
  const races   = ['human', 'elf', 'dwarf'] as const;
  const classes = ['knight', 'ranger', 'cleric'] as const;
  for (let i = 0; i < ringPositions.length; i++) {
    const [x, y, z] = ringPositions[i];
    out.push({
      id: `ally-${i}`, pos: [x, y, z], active: true,
      faction: pick(rng, ['crusade', 'fabled', 'legion'] as const),
      race:    pick(rng, races),
      class:   pick(rng, classes),
      level:   3 + Math.floor(rng() * 3),
    });
  }
  return out;
}

export function spawnFactionCamps(
  rng: () => number, heightmap: IslandHeightmap, radius: number,
): { crusade: CampNode[]; fabled: CampNode[]; legion: CampNode[]; pirates: CampNode[] } {
  // Sanctuary holds neutral-ground embassies for each major faction, plus one
  // exiled pirate cove on the leeward shore.
  function camp(id: string, faction: CampNode['faction'], pos: Vec3, size: CampNode['size'], garrison: number): CampNode {
    return { id, pos, active: true, faction, size, garrison };
  }
  const ringMid    = sampleRing(rng, heightmap, 3, 2, 12, 30, 50);
  const piratePos  = sampleRing(rng, heightmap, 1, 0.5, 4, 60, 90);
  const result = { crusade: [] as CampNode[], fabled: [] as CampNode[], legion: [] as CampNode[], pirates: [] as CampNode[] };
  if (ringMid[0]) result.crusade.push(camp('camp-crusade', 'crusade', ringMid[0], 'medium', 6));
  if (ringMid[1]) result.fabled .push(camp('camp-fabled',  'fabled',  ringMid[1], 'medium', 6));
  if (ringMid[2]) result.legion .push(camp('camp-legion',  'legion',  ringMid[2], 'small',  4));
  if (piratePos[0]) result.pirates.push(camp('camp-pirate', 'pirates', piratePos[0], 'small', 5));
  return result;
}

export function spawnEvents(rng: () => number, heightmap: IslandHeightmap, radius: number): EventNode[] {
  const out: EventNode[] = [];
  const specs: EventNode['kind'][] = [
    'shrine_blessing', 'merchant_caravan', 'random_encounter', 'meteor_shower', 'tide_event',
  ];
  for (const [x, y, z] of samplePositions(rng, heightmap, 5, 2, 16, radius * 0.85)) {
    out.push({
      id: `event-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, specs), triggerRadius: 8 + rng() * 6, cooldownSec: 300 + rng() * 600,
    });
  }
  return out;
}

export function spawnRewards(rng: () => number, heightmap: IslandHeightmap, radius: number): RewardNode[] {
  const out: RewardNode[] = [];
  const kinds: RewardNode['kind'][] = ['cache', 'rune', 'relic'];
  for (const [x, y, z] of samplePositions(rng, heightmap, 6, 1, 18, radius)) {
    out.push({
      id: `reward-${out.length}`, pos: [x, y, z], active: true,
      kind: pick(rng, kinds), rarity: (1 + Math.floor(rng() * 5)) as RewardNode['rarity'],
    });
  }
  return out;
}

export function spawnTreasures(rng: () => number, heightmap: IslandHeightmap, radius: number): TreasureNode[] {
  const out: TreasureNode[] = [];
  for (const [x, y, z] of samplePositions(rng, heightmap, 4, 1, 22, radius)) {
    const rarity = (1 + Math.floor(rng() * 5)) as TreasureNode['rarity'];
    out.push({
      id: `treasure-${out.length}`, pos: [x, y, z], active: true,
      goldMin: 50 * rarity, goldMax: 150 * rarity, rarity, locked: rng() < 0.5,
    });
  }
  return out;
}

export function spawnVfx(rng: () => number, heightmap: IslandHeightmap, _radius: number): VfxNode[] {
  // Hand-placed atmospheric VFX near hub points, plus one godrays patch deep in the woods.
  const out: VfxNode[] = [];
  const placements: Array<{ kind: VfxNode['kind']; pos: [number, number]; radius: number }> = [
    { kind: 'fountain',      pos: [  0,  -6 ], radius: 3 },
    { kind: 'firefly_swarm', pos: [-14,   8 ], radius: 6 },
    { kind: 'godrays',       pos: [-30,  20 ], radius: 14 },
    { kind: 'mist',          pos: [ 32,  16 ], radius: 18 },
    { kind: 'lantern',       pos: [  6,  -2 ], radius: 1.5 },
    { kind: 'lantern',       pos: [-10,  -8 ], radius: 1.5 },
    { kind: 'glyph_circle',  pos: [  0,  18 ], radius: 4 },
  ];
  for (const p of placements) {
    const y = heightmap.getHeightAt(p.pos[0], p.pos[1]) + 0.4;
    out.push({
      id: `vfx-${out.length}`, pos: [p.pos[0], y, p.pos[1]], active: true,
      kind: p.kind, radius: p.radius,
    });
  }
  // Small jitter pass for a few extra fireflies/mist patches around the meadow.
  for (const [x, y, z] of samplePositions(rng, heightmap, 6, 2, 14, 60)) {
    out.push({
      id: `vfx-${out.length}`, pos: [x, y + 0.5, z], active: true,
      kind: rng() < 0.5 ? 'firefly_swarm' : 'mist', radius: 4 + rng() * 4,
    });
  }
  return out;
}

export function spawnImpacts(rng: () => number, heightmap: IslandHeightmap, radius: number): ImpactNode[] {
  // One legacy shipwreck and one meteor crater — lore-flavoured initial state.
  const out: ImpactNode[] = [];
  const wreckPos  = sampleRing(rng, heightmap, 1, 0.2, 1.2, radius * 0.95, radius * 1.1);
  const craterPos = samplePositions(rng, heightmap, 1, 4, 14, radius * 0.6);
  if (wreckPos[0])  out.push({ id: 'wreck-1',  pos: wreckPos[0],  active: true, kind: 'shipwreck', radius: 4 });
  if (craterPos[0]) out.push({ id: 'crater-1', pos: craterPos[0], active: true, kind: 'crater',    radius: 3 });
  return out;
}

// ── Player spawn ────────────────────────────────────────────────────────────

export function buildPlayerSpawn(heightmap: IslandHeightmap): PlayerSpawnLayer {
  // Try a beach landing on the leeward shore (negative-Z side); fall back to centre.
  const candidates: Array<[number, number]> = [
    [  0, -40 ], [  6, -38 ], [-6, -38 ], [ 12, -36 ], [ -12, -36 ],
    [  0, -32 ], [ 18, -28 ], [-18, -28 ],
  ];
  for (const [x, z] of candidates) {
    const y = heightmap.getHeightAt(x, z);
    if (y >= 0.4 && y <= 2.0) {
      return { primary: [x, y, z], fallback: [0, heightmap.getHeightAt(0, 0), 0], facingRad: Math.PI };
    }
  }
  // Total fallback — centre of map at whatever altitude.
  const y = Math.max(0.5, heightmap.getHeightAt(0, 0));
  return { primary: [0, y, 0], fallback: [0, y, 0], facingRad: 0 };
}

// ── Master sampler ──────────────────────────────────────────────────────────

export function buildAllLayers(seed: number, heightmap: IslandHeightmap, radius: number) {
  const rng = mulberry32(seed);
  const camps = spawnFactionCamps(rng, heightmap, radius);
  return {
    trees:           spawnTrees(rng, heightmap, radius),
    plants:          spawnPlants(rng, heightmap, radius),
    ores:            spawnOres(rng, heightmap, radius),
    rocks:           spawnRocks(rng, heightmap, radius),
    cliffs:          spawnCliffs(rng, heightmap, radius),
    caves:           spawnCaves(rng, heightmap, radius),
    dungeons:        spawnDungeons(rng, heightmap, radius),

    animals:         spawnAnimals(rng, heightmap, radius),
    landPredators:   spawnLandPredators(rng, heightmap, radius),
    waterPredators:  spawnWaterPredators(rng, heightmap, radius),
    fish:            spawnFish(rng, heightmap, radius),
    seacoral:        spawnSeaCoral(rng, heightmap, radius),
    bosses:          spawnBosses(rng, heightmap, radius),

    npcs:            spawnNpcs(rng, heightmap, radius),
    allies:          spawnAllies(rng, heightmap, radius),
    crusadeCamps:    camps.crusade,
    fabledCamps:     camps.fabled,
    legionCamps:     camps.legion,
    pirateCamps:     camps.pirates,

    events:          spawnEvents(rng, heightmap, radius),
    rewards:         spawnRewards(rng, heightmap, radius),
    treasures:       spawnTreasures(rng, heightmap, radius),

    vfx:             spawnVfx(rng, heightmap, radius),
    impacts:         spawnImpacts(rng, heightmap, radius),
  };
}
