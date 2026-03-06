export interface SpriteDefinition {
  id: string;
  name: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  animations: SpriteAnimation[];
}

export interface SpriteAnimation {
  name: string;
  row: number;
  frameCount: number;
  frameDuration: number;
  loop: boolean;
}

export interface SpellIconDefinition {
  id: string;
  name: string;
  path: string;
  category: string;
  color: string;
}

export const SPRITE_CATEGORIES = {
  characters: 'characters',
  monsters: 'monsters',
  items: 'items',
  effects: 'effects',
  terrain: 'terrain',
  buildings: 'buildings',
  ui: 'ui',
};

export const ANIMATION_STATES = {
  idle: { name: 'idle', row: 0, frameCount: 4, frameDuration: 200, loop: true },
  walk: { name: 'walk', row: 1, frameCount: 6, frameDuration: 100, loop: true },
  run: { name: 'run', row: 2, frameCount: 8, frameDuration: 80, loop: true },
  attack: { name: 'attack', row: 3, frameCount: 6, frameDuration: 100, loop: false },
  cast: { name: 'cast', row: 4, frameCount: 8, frameDuration: 100, loop: false },
  hit: { name: 'hit', row: 5, frameCount: 3, frameDuration: 150, loop: false },
  death: { name: 'death', row: 6, frameCount: 6, frameDuration: 150, loop: false },
};

export const CHARACTER_SPRITES: Record<string, SpriteDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    path: '/2dassets/characters/warrior.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: Object.values(ANIMATION_STATES),
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    path: '/2dassets/characters/mage.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: Object.values(ANIMATION_STATES),
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    path: '/2dassets/characters/rogue.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: Object.values(ANIMATION_STATES),
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    path: '/2dassets/characters/cleric.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: Object.values(ANIMATION_STATES),
  },
};

export const MONSTER_SPRITES: Record<string, SpriteDefinition> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    path: '/2dassets/monsters/goblin.png',
    frameWidth: 48,
    frameHeight: 48,
    animations: Object.values(ANIMATION_STATES),
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    path: '/2dassets/monsters/skeleton.png',
    frameWidth: 48,
    frameHeight: 48,
    animations: Object.values(ANIMATION_STATES),
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    path: '/2dassets/monsters/orc.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: Object.values(ANIMATION_STATES),
  },
  dragon: {
    id: 'dragon',
    name: 'Dragon',
    path: '/2dassets/monsters/dragon.png',
    frameWidth: 128,
    frameHeight: 128,
    animations: Object.values(ANIMATION_STATES),
  },
};

export const SPELL_ICONS: Record<string, SpellIconDefinition> = {
  fireball: { id: 'fireball', name: 'Fireball', path: '/2dassets/icons/spells/fireball.png', category: 'fire', color: '#ff4500' },
  frostbolt: { id: 'frostbolt', name: 'Frost Bolt', path: '/2dassets/icons/spells/frostbolt.png', category: 'frost', color: '#00bfff' },
  heal: { id: 'heal', name: 'Heal', path: '/2dassets/icons/spells/heal.png', category: 'holy', color: '#ffd700' },
  lightning: { id: 'lightning', name: 'Lightning', path: '/2dassets/icons/spells/lightning.png', category: 'storm', color: '#9370db' },
  poison: { id: 'poison', name: 'Poison', path: '/2dassets/icons/spells/poison.png', category: 'nature', color: '#32cd32' },
  shadow: { id: 'shadow', name: 'Shadow Bolt', path: '/2dassets/icons/spells/shadow.png', category: 'shadow', color: '#4b0082' },
  shield: { id: 'shield', name: 'Shield', path: '/2dassets/icons/spells/shield.png', category: 'defense', color: '#c0c0c0' },
  rage: { id: 'rage', name: 'Rage', path: '/2dassets/icons/spells/rage.png', category: 'physical', color: '#dc143c' },
};

export const EFFECT_SPRITES: Record<string, SpriteDefinition> = {
  explosion: {
    id: 'explosion',
    name: 'Explosion',
    path: '/2dassets/effects/explosion.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: [{ name: 'play', row: 0, frameCount: 8, frameDuration: 50, loop: false }],
  },
  heal: {
    id: 'heal',
    name: 'Heal Effect',
    path: '/2dassets/effects/heal.png',
    frameWidth: 48,
    frameHeight: 48,
    animations: [{ name: 'play', row: 0, frameCount: 6, frameDuration: 100, loop: false }],
  },
  slash: {
    id: 'slash',
    name: 'Slash Effect',
    path: '/2dassets/effects/slash.png',
    frameWidth: 64,
    frameHeight: 64,
    animations: [{ name: 'play', row: 0, frameCount: 4, frameDuration: 50, loop: false }],
  },
};

export const TERRAIN_TILES: Record<string, { id: string; name: string; path: string; walkable: boolean; speedModifier: number }> = {
  grass: { id: 'grass', name: 'Grass', path: '/2dassets/terrain/grass.png', walkable: true, speedModifier: 1.0 },
  water: { id: 'water', name: 'Water', path: '/2dassets/terrain/water.png', walkable: false, speedModifier: 0.5 },
  forest: { id: 'forest', name: 'Forest', path: '/2dassets/terrain/forest.png', walkable: true, speedModifier: 0.7 },
  mountain: { id: 'mountain', name: 'Mountain', path: '/2dassets/terrain/mountain.png', walkable: false, speedModifier: 0 },
  sand: { id: 'sand', name: 'Sand', path: '/2dassets/terrain/sand.png', walkable: true, speedModifier: 0.8 },
  stone: { id: 'stone', name: 'Stone', path: '/2dassets/terrain/stone.png', walkable: true, speedModifier: 1.0 },
  lava: { id: 'lava', name: 'Lava', path: '/2dassets/terrain/lava.png', walkable: false, speedModifier: 0 },
  void: { id: 'void', name: 'Void', path: '/2dassets/terrain/void.png', walkable: false, speedModifier: 0 },
};

export function getSpriteById(category: string, id: string): SpriteDefinition | undefined {
  const sprites = category === 'characters' ? CHARACTER_SPRITES :
                  category === 'monsters' ? MONSTER_SPRITES :
                  category === 'effects' ? EFFECT_SPRITES : null;
  return sprites?.[id];
}

export function getSpellIconById(id: string): SpellIconDefinition | undefined {
  return SPELL_ICONS[id];
}
