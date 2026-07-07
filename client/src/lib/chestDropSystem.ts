/**
 * chestDropSystem — Sprite-animated reward chests for the 3D island/battle scenes.
 *
 * Features:
 *  • THREE.Sprite billboard using the Animated_Chests sprite sheet (240×256, 8col×8row)
 *  • Frame-by-frame opening animation via texture UV repeat/offset
 *  • Proximity E-key interaction (fires callback when player presses E nearby)
 *  • 8 chest tiers (common→legendary→boss) mapped to sprite rows
 *  • Loot table with weighted random rewards
 *  • Particle burst on open (uses Three.js Points)
 *  • Floating bob animation, glowing light halo, and "nearby" pulse
 */

import * as THREE from 'three';

export type ChestTier =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'boss'
  | 'boss_rare'
  | 'ancient';

export interface LootItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'gold' | 'gem' | 'rune';
  tier: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  quantity: number;
  icon?: string;
}

export interface ChestReward {
  chestId: string;
  tier: ChestTier;
  gold: number;
  xp: number;
  items: LootItem[];
}

export interface ChestDrop {
  id: string;
  tier: ChestTier;
  position: THREE.Vector3;
  sprite: THREE.Sprite;
  halo: THREE.Mesh;
  light: THREE.PointLight;
  opened: boolean;
  opening: boolean;
  animFrame: number;
  animTimer: number;
  bobOffset: number;
  nearbyPulse: number;
  reward?: ChestReward;
}

const SPRITE_SHEET   = '/sprites/chests/chests.png';
const SPRITE_COLS    = 8;
const SPRITE_ROWS    = 8;
const FRAME_DURATION = 0.09;
const OPEN_FRAMES    = 8;

const TIER_ROW: Record<ChestTier, number> = {
  common:    0,
  uncommon:  1,
  rare:      2,
  epic:      3,
  legendary: 4,
  boss:      5,
  boss_rare: 6,
  ancient:   7
};

const TIER_HALO_COLOR: Record<ChestTier, number> = {
  common:    0xaa7733,
  uncommon:  0x33aa55,
  rare:      0x3366ff,
  epic:      0xaa33ff,
  legendary: 0xffaa00,
  boss:      0xff2222,
  boss_rare: 0xff44aa,
  ancient:   0x00ffee
};

const LOOT_POOLS: Record<ChestTier, LootItem[][]> = {
  common: [
    [
      { id: 'gold_pouch', name: 'Gold Pouch', type: 'gold', tier: 1, rarity: 'common', quantity: 50 },
      { id: 'herb_01', name: 'Healing Herb', type: 'consumable', tier: 1, rarity: 'common', quantity: 2 }
    ],
    [
      { id: 'iron_ore', name: 'Iron Ore', type: 'material', tier: 1, rarity: 'common', quantity: 5 },
      { id: 'potion_minor', name: 'Minor Health Potion', type: 'consumable', tier: 1, rarity: 'common', quantity: 1 }
    ],
    [
      { id: 'sword_t1', name: 'Rusty Sword', type: 'weapon', tier: 1, rarity: 'common', quantity: 1 },
      { id: 'gold_coin', name: 'Gold Coins', type: 'gold', tier: 1, rarity: 'common', quantity: 30 }
    ]
  ],
  uncommon: [
    [
      { id: 'silver_ore', name: 'Silver Ore', type: 'material', tier: 2, rarity: 'uncommon', quantity: 3 },
      { id: 'axe_t2', name: 'Steel Axe', type: 'weapon', tier: 2, rarity: 'uncommon', quantity: 1 }
    ],
    [
      { id: 'potion_standard', name: 'Health Potion', type: 'consumable', tier: 2, rarity: 'uncommon', quantity: 2 },
      { id: 'chainmail_t2', name: 'Chain Armor', type: 'armor', tier: 2, rarity: 'uncommon', quantity: 1 }
    ]
  ],
  rare: [
    [
      { id: 'gold_ore', name: 'Gold Ore', type: 'material', tier: 3, rarity: 'rare', quantity: 4 },
      { id: 'sword_t3', name: 'Knight Sword', type: 'weapon', tier: 3, rarity: 'rare', quantity: 1 },
      { id: 'sapphire', name: 'Sapphire Gem', type: 'gem', tier: 3, rarity: 'rare', quantity: 1 }
    ],
    [
      { id: 'elixir_rare', name: 'Stamina Elixir', type: 'consumable', tier: 3, rarity: 'rare', quantity: 2 },
      { id: 'plate_t3', name: 'Plate Armor', type: 'armor', tier: 3, rarity: 'rare', quantity: 1 }
    ]
  ],
  epic: [
    [
      { id: 'diamond', name: 'Diamond Crystal', type: 'gem', tier: 4, rarity: 'epic', quantity: 2 },
      { id: 'staff_t4', name: 'Arcane Staff', type: 'weapon', tier: 4, rarity: 'epic', quantity: 1 },
      { id: 'rune_power', name: 'Rune of Power', type: 'rune', tier: 4, rarity: 'epic', quantity: 1 }
    ]
  ],
  legendary: [
    [
      { id: 'sword_legendary', name: "Aethermoor's Edge", type: 'weapon', tier: 6, rarity: 'legendary', quantity: 1 },
      { id: 'rune_ancient', name: 'Ancient Rune', type: 'rune', tier: 6, rarity: 'legendary', quantity: 2 },
      { id: 'emerald_lg', name: 'Grand Emerald', type: 'gem', tier: 6, rarity: 'legendary', quantity: 3 }
    ]
  ],
  boss: [
    [
      { id: 'boss_weapon', name: 'Warlord Greataxe', type: 'weapon', tier: 5, rarity: 'epic', quantity: 1 },
      { id: 'boss_gem', name: 'Dragon Eye Gem', type: 'gem', tier: 5, rarity: 'epic', quantity: 1 },
      { id: 'boss_gold', name: 'Boss Gold Hoard', type: 'gold', tier: 5, rarity: 'epic', quantity: 500 },
      { id: 'boss_rune', name: 'Rune of Conquest', type: 'rune', tier: 5, rarity: 'epic', quantity: 1 }
    ]
  ],
  boss_rare: [
    [
      { id: 'boss_rare_weapon', name: "Skywarden's Bow", type: 'weapon', tier: 7, rarity: 'legendary', quantity: 1 },
      { id: 'boss_rare_gem', name: 'Sky Terror Scale', type: 'material', tier: 7, rarity: 'legendary', quantity: 2 },
      { id: 'boss_rare_rune', name: 'Rune of Dominion', type: 'rune', tier: 7, rarity: 'legendary', quantity: 2 }
    ]
  ],
  ancient: [
    [
      { id: 'ancient_weapon', name: 'Void Blade', type: 'weapon', tier: 8, rarity: 'legendary', quantity: 1 },
      { id: 'ancient_gem', name: 'Void Crystal', type: 'gem', tier: 8, rarity: 'legendary', quantity: 3 },
      { id: 'ancient_rune', name: 'Rune of the Ancients', type: 'rune', tier: 8, rarity: 'legendary', quantity: 3 },
      { id: 'ancient_gold', name: 'Ancient Treasury', type: 'gold', tier: 8, rarity: 'legendary', quantity: 2000 }
    ]
  ]
};

const TIER_GOLD: Record<ChestTier, [number, number]> = {
  common:    [20, 80],
  uncommon:  [80, 200],
  rare:      [200, 500],
  epic:      [500, 1200],
  legendary: [1200, 3000],
  boss:      [400, 800],
  boss_rare: [800, 2000],
  ancient:   [2000, 5000]
};

const TIER_XP: Record<ChestTier, number> = {
  common:    50,
  uncommon:  120,
  rare:      300,
  epic:      600,
  legendary: 1500,
  boss:      1000,
  boss_rare: 2500,
  ancient:   5000
};

function generateReward(chestId: string, tier: ChestTier): ChestReward {
  const pool    = LOOT_POOLS[tier];
  const items   = pool[Math.floor(Math.random() * pool.length)];
  const [gMin, gMax] = TIER_GOLD[tier];
  const gold    = gMin + Math.floor(Math.random() * (gMax - gMin));
  const xp      = TIER_XP[tier] + Math.floor(Math.random() * TIER_XP[tier] * 0.3);
  return { chestId, tier, gold, xp, items };
}

function createHalo(color: number, radius: number): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, 0.04, 8, 32);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

function createParticleBurst(scene: THREE.Scene, position: THREE.Vector3, color: number): void {
  const count  = 24;
  const geo    = new THREE.BufferGeometry();
  const pos    = new Float32Array(count * 3);
  const vel    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2;
    pos[i * 3]     = position.x;
    pos[i * 3 + 1] = position.y + 0.5;
    pos[i * 3 + 2] = position.z;
    vel[i * 3]     = Math.cos(angle) * speed;
    vel[i * 3 + 1] = 2 + Math.random() * 3;
    vel[i * 3 + 2] = Math.sin(angle) * speed;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.15,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let t = 0;
  const tick = () => {
    t += 1 / 60;
    const positions = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      positions[i * 3]     += vel[i * 3]     * 0.016;
      positions[i * 3 + 1] += (vel[i * 3 + 1] - t * 6) * 0.016;
      positions[i * 3 + 2] += vel[i * 3 + 2] * 0.016;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - t * 1.2);

    if (t < 1.2) {
      requestAnimationFrame(tick);
    } else {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    }
  };
  tick();
}

const sheetTextureCache = new Map<string, THREE.Texture>();

function loadSheetTexture(url: string): THREE.Texture {
  if (sheetTextureCache.has(url)) return sheetTextureCache.get(url)!;
  const loader  = new THREE.TextureLoader();
  const texture = loader.load(url);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1 / SPRITE_COLS, 1 / SPRITE_ROWS);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  sheetTextureCache.set(url, texture);
  return texture;
}

function setFrame(texture: THREE.Texture, col: number, row: number): void {
  texture.offset.set(
    col / SPRITE_COLS,
    (SPRITE_ROWS - 1 - row) / SPRITE_ROWS
  );
  texture.needsUpdate = true;
}

export class ChestDropSystem {
  private scene:    THREE.Scene;
  private chests:   Map<string, ChestDrop> = new Map();
  private nextId    = 0;
  private texture:  THREE.Texture;
  private snowTex:  THREE.Texture;
  private onOpenCb: ((reward: ChestReward) => void) | null = null;

  readonly INTERACT_RADIUS = 2.5;

  constructor(scene: THREE.Scene) {
    this.scene   = scene;
    this.texture = loadSheetTexture(SPRITE_SHEET);
    this.snowTex = loadSheetTexture('/sprites/chests/chests_snow.png');
  }

  setOnOpen(cb: (reward: ChestReward) => void): void {
    this.onOpenCb = cb;
  }

  spawnChest(position: THREE.Vector3, tier: ChestTier = 'common', useSnow = false): ChestDrop {
    const id      = `chest-${this.nextId++}`;
    const tex     = useSnow ? this.snowTex.clone() : this.texture.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1 / SPRITE_COLS, 1 / SPRITE_ROWS);
    setFrame(tex, 0, TIER_ROW[tier]);

    const material = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.2, 1.2, 1.2);

    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y += 0.6;
    group.add(sprite);

    const color  = TIER_HALO_COLOR[tier];
    const halo   = createHalo(color, 0.6);
    group.add(halo);

    const light = new THREE.PointLight(color, 1.2, 4);
    light.position.y = 0.5;
    group.add(light);

    this.scene.add(group);

    const chest: ChestDrop = {
      id,
      tier,
      position: group.position.clone(),
      sprite,
      halo,
      light,
      opened:      false,
      opening:     false,
      animFrame:   0,
      animTimer:   0,
      bobOffset:   Math.random() * Math.PI * 2,
      nearbyPulse: 0,
      reward:      undefined
    };

    this.chests.set(id, chest);

    (sprite as THREE.Sprite & { _group?: THREE.Group })._group = group;
    (sprite as THREE.Sprite & { _group?: THREE.Group; _tex?: THREE.Texture })._tex = tex;

    return chest;
  }

  tryOpenNearby(playerPos: THREE.Vector3): ChestDrop | null {
    let closest: ChestDrop | null = null;
    let minDist = this.INTERACT_RADIUS;

    this.chests.forEach(chest => {
      if (chest.opened || chest.opening) return;
      const dist = playerPos.distanceTo(new THREE.Vector3(
        chest.position.x,
        playerPos.y,
        chest.position.z
      ));
      if (dist < minDist) {
        minDist = dist;
        closest = chest;
      }
    });

    if (closest) this.beginOpen(closest);
    return closest;
  }

  getNearbyCandidates(playerPos: THREE.Vector3): ChestDrop[] {
    const results: ChestDrop[] = [];
    this.chests.forEach(chest => {
      if (chest.opened || chest.opening) return;
      const dist = playerPos.distanceTo(new THREE.Vector3(
        chest.position.x,
        playerPos.y,
        chest.position.z
      ));
      if (dist < this.INTERACT_RADIUS) results.push(chest);
    });
    return results;
  }

  private beginOpen(chest: ChestDrop): void {
    if (chest.opening || chest.opened) return;
    chest.opening  = true;
    chest.animFrame = 0;
    chest.animTimer = 0;
    chest.reward   = generateReward(chest.id, chest.tier);
  }

  update(dt: number, playerPos: THREE.Vector3, time: number): void {
    this.chests.forEach((chest) => {
      const group = (chest.sprite as THREE.Sprite & { _group?: THREE.Group })._group;
      const tex   = (chest.sprite as THREE.Sprite & { _tex?: THREE.Texture })._tex;
      if (!group || !tex) return;

      const dist = playerPos.distanceTo(new THREE.Vector3(
        chest.position.x,
        playerPos.y,
        chest.position.z
      ));
      const nearby = dist < this.INTERACT_RADIUS && !chest.opened && !chest.opening;

      if (!chest.opened && !chest.opening) {
        group.position.y = chest.position.y + Math.sin(time * 1.8 + chest.bobOffset) * 0.08;
        chest.nearbyPulse = nearby ? (chest.nearbyPulse + dt * 4) : 0;

        const haloMat = (chest.halo.material as THREE.MeshBasicMaterial);
        haloMat.opacity = nearby
          ? 0.3 + Math.sin(chest.nearbyPulse) * 0.3
          : 0.2 + Math.sin(time * 2 + chest.bobOffset) * 0.1;

        chest.light.intensity = nearby
          ? 1.5 + Math.sin(chest.nearbyPulse) * 0.5
          : 0.8 + Math.sin(time * 2 + chest.bobOffset) * 0.3;

        const row = TIER_ROW[chest.tier];
        setFrame(tex, 0, row);

      } else if (chest.opening && !chest.opened) {
        chest.animTimer += dt;
        if (chest.animTimer >= FRAME_DURATION) {
          chest.animTimer -= FRAME_DURATION;
          chest.animFrame++;

          if (chest.animFrame >= OPEN_FRAMES) {
            chest.opened  = true;
            chest.opening = false;
            setFrame(tex, OPEN_FRAMES - 1, TIER_ROW[chest.tier]);
            createParticleBurst(this.scene, group.position, TIER_HALO_COLOR[chest.tier]);
            chest.light.intensity = 3;

            if (chest.reward && this.onOpenCb) {
              this.onOpenCb(chest.reward);
            }

            setTimeout(() => {
              this.scene.remove(group);
              this.chests.delete(chest.id);
            }, 3000);

          } else {
            setFrame(tex, chest.animFrame, TIER_ROW[chest.tier]);
          }
        }

        chest.light.intensity = 1 + chest.animFrame * 0.4;

      } else if (chest.opened) {
        const haloMat = (chest.halo.material as THREE.MeshBasicMaterial);
        haloMat.opacity = Math.max(0, haloMat.opacity - dt * 0.5);
        chest.light.intensity = Math.max(0, chest.light.intensity - dt * 2);
      }
    });
  }

  removeAll(): void {
    this.chests.forEach(chest => {
      const group = (chest.sprite as THREE.Sprite & { _group?: THREE.Group })._group;
      if (group) this.scene.remove(group);
    });
    this.chests.clear();
  }

  getChestCount(): number { return this.chests.size; }
}
