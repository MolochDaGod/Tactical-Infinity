/**
 * Mine entrance harvest — character enters mine, hides 4s, exits with bag.
 * Loot: miner (stone/ore/gems) + engineer (scrap) + mystic (dust/crystals).
 * Assets: craftpix 692030 mines on R2 models/buildings/mines/*
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';
import { normalizeToMetres } from '@/lib/modelNormalize';

export const MINE_CDN = 'https://assets.grudge-studio.com/models/buildings/mines';
export const MINE_ATLAS = `${MINE_CDN}/Texture_MAp_mines.png`;
export const MINE_ENTER_MS = 4000;

export const MINE_ENTRANCE_URLS = [
  `${MINE_CDN}/mine_1.fbx`,
  `${MINE_CDN}/mine_2.fbx`,
  `${MINE_CDN}/mine_3.fbx`,
  `${MINE_CDN}/mine_4.fbx`,
] as const;

export const MOUNTAIN_CAVE_URL =
  'https://assets.grudge-studio.com/models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb';

export interface MineLootItem {
  itemId: string;
  name: string;
  amount: number;
  profession: 'miner' | 'engineer' | 'mystic';
}

const LOOT: Array<{
  profession: MineLootItem['profession'];
  drops: Array<{ itemId: string; name: string; weight: number; min: number; max: number }>;
}> = [
  {
    profession: 'miner',
    drops: [
      { itemId: 'stone-fragments', name: 'Stone Fragments', weight: 30, min: 2, max: 6 },
      { itemId: 'copper-ore', name: 'Copper Ore', weight: 20, min: 1, max: 3 },
      { itemId: 'iron-ore', name: 'Iron Ore', weight: 12, min: 1, max: 2 },
      { itemId: 'coal', name: 'Coal', weight: 15, min: 1, max: 4 },
      { itemId: 'junk-ore', name: 'Junk Ore', weight: 18, min: 1, max: 3 },
      { itemId: 'rough-gem', name: 'Rough Gem', weight: 5, min: 1, max: 1 },
    ],
  },
  {
    profession: 'engineer',
    drops: [
      { itemId: 'scrap-metal', name: 'Scrap Metal', weight: 25, min: 1, max: 4 },
      { itemId: 'junk-ore', name: 'Junk Ore', weight: 20, min: 1, max: 3 },
      { itemId: 'stone-fragments', name: 'Stone Fragments', weight: 15, min: 1, max: 3 },
      { itemId: 'charcoal', name: 'Charcoal', weight: 12, min: 1, max: 2 },
    ],
  },
  {
    profession: 'mystic',
    drops: [
      { itemId: 'arcane-dust', name: 'Arcane Dust', weight: 20, min: 1, max: 3 },
      { itemId: 'rough-gem', name: 'Rough Gem', weight: 12, min: 1, max: 2 },
      { itemId: 'crystal-shard', name: 'Crystal Shard', weight: 15, min: 1, max: 2 },
    ],
  },
];

export function rollMineBag(rng = Math.random): MineLootItem[] {
  const bag: MineLootItem[] = [];
  for (const table of LOOT) {
    const rolls = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < rolls; i++) {
      const total = table.drops.reduce((s, d) => s + d.weight, 0);
      let r = rng() * total;
      let pick = table.drops[0]!;
      for (const d of table.drops) {
        r -= d.weight;
        if (r <= 0) { pick = d; break; }
      }
      bag.push({
        itemId: pick.itemId,
        name: pick.name,
        amount: pick.min + Math.floor(rng() * (pick.max - pick.min + 1)),
        profession: table.profession,
      });
    }
  }
  return bag;
}

/** Ultimate Fantasy RTS Mine.fbx — stone quarry, miner only */
export const UF_QUARRY_URL =
  'https://assets.grudge-studio.com/models/rts/ultimate-fantasy/fbx/Mine.fbx';
export const UF_QUARRY_TEX =
  'https://assets.grudge-studio.com/models/rts/ultimate-fantasy/tex/Mine.png';

const QUARRY_DROPS = [
  { itemId: 'stone-fragments', name: 'Stone Fragments', weight: 40, min: 3, max: 8 },
  { itemId: 'rock', name: 'Rock', weight: 25, min: 1, max: 4 },
  { itemId: 'coal', name: 'Coal', weight: 15, min: 1, max: 3 },
  { itemId: 'junk-ore', name: 'Junk Ore', weight: 12, min: 1, max: 2 },
  { itemId: 'copper-ore', name: 'Copper Ore', weight: 8, min: 1, max: 2 },
];

export function rollQuarryBag(rng = Math.random): MineLootItem[] {
  const bag: MineLootItem[] = [];
  const rolls = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < rolls; i++) {
    const total = QUARRY_DROPS.reduce((s, d) => s + d.weight, 0);
    let r = rng() * total;
    let pick = QUARRY_DROPS[0]!;
    for (const d of QUARRY_DROPS) {
      r -= d.weight;
      if (r <= 0) { pick = d; break; }
    }
    bag.push({
      itemId: pick.itemId,
      name: pick.name,
      amount: pick.min + Math.floor(rng() * (pick.max - pick.min + 1)),
      profession: 'miner',
    });
  }
  return bag;
}

const fbxLoader = new FBXLoader();
const texLoader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Group>();

export async function loadUfQuarry(targetH = 5): Promise<THREE.Group> {
  const url = UF_QUARRY_URL;
  if (cache.has(url)) return cache.get(url)!.clone();
  try {
    const fbx = await fbxLoader.loadAsync(url);
    const g = new THREE.Group();
    g.add(fbx);
    try {
      const tex = await new Promise<THREE.Texture>((res, rej) => {
        texLoader.load(UF_QUARRY_TEX, res, undefined, rej);
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      fbx.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.castShadow = true;
          m.receiveShadow = true;
          m.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0.02 });
        }
      });
    } catch { /* optional */ }
    normalizeToMetres(g, { targetSizeM: targetH, axis: 'height', ground: true, centerXZ: true });
    g.userData.mineEntrance = true;
    g.userData.quarryStoneOnly = true;
    cache.set(url, g.clone());
    return g;
  } catch (e) {
    console.warn('[Quarry] load failed', e);
    return new THREE.Group();
  }
}

export async function loadMineEntrance(index: number, targetH = 4.5): Promise<THREE.Group> {
  const url = MINE_ENTRANCE_URLS[index % MINE_ENTRANCE_URLS.length]!;
  if (cache.has(url)) return cache.get(url)!.clone();
  try {
    const fbx = await fbxLoader.loadAsync(url);
    const g = new THREE.Group();
    g.add(fbx);
    try {
      const tex = await new Promise<THREE.Texture>((res, rej) => {
        texLoader.load(MINE_ATLAS, res, undefined, rej);
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      fbx.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.castShadow = true;
          m.receiveShadow = true;
          m.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
        }
      });
    } catch { /* texture optional */ }
    normalizeToMetres(g, { targetSizeM: targetH, axis: 'height', ground: true, centerXZ: true });
    g.userData.mineEntrance = true;
    cache.set(url, g.clone());
    return g;
  } catch (e) {
    console.warn('[Mine] load failed', url, e);
    return new THREE.Group();
  }
}

export interface ActiveMine {
  id: string;
  group: THREE.Group;
  pos: THREE.Vector3;
  busyUntil: number;
}

/**
 * If player is near a mine and presses interact, hide player for MINE_ENTER_MS
 * then award bag loot.
 */
export function tryEnterMine(
  playerPos: THREE.Vector3,
  mines: ActiveMine[],
  nowMs: number,
  range = 4.5,
): ActiveMine | null {
  let best: ActiveMine | null = null;
  let bestD = range;
  for (const m of mines) {
    if (m.busyUntil > nowMs) continue;
    const d = playerPos.distanceTo(m.pos);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}
