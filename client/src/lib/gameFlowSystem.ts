export type GameMode = 'ocean_sailing' | 'island_explore' | 'island_combat' | 'island_harvest'
  | 'dock_menu' | 'barracks' | 'ship_builder' | 'captain_creation';

export type Profession = 'mining' | 'herbalism' | 'woodcutting' | 'fishing' | 'skinning' | 'blacksmithing' | 'alchemy' | 'carpentry';

export interface ProfessionProgress {
  profession: Profession;
  level: number;
  xp: number;
  xpToNext: number;
}

export interface CharacterProgression {
  level: number;
  xp: number;
  xpToNext: number;
  statPoints: number;
  skillPoints: number;
  unlockedSkills: string[];
  equippedSkills: string[];
  professions: Record<Profession, ProfessionProgress>;
}

export interface IslandState {
  id: string;
  name: string;
  discovered: boolean;
  dockBuilt: boolean;
  buildings: { type: string; gridX: number; gridZ: number; level: number }[];
  harvestables: { type: string; x: number; z: number; respawnAt: number }[];
  enemies: { faction: string; level: number; spawnX: number; spawnZ: number }[];
  resources: Record<string, number>;
}

export interface ShipState {
  id: string;
  name: string;
  type: 'sloop' | 'brigantine' | 'galleon' | 'man-o-war';
  hull: number;
  maxHull: number;
  cargo: Record<string, number>;
  crew: number;
  maxCrew: number;
  cannons: number;
  speed: number;
  docked: boolean;
  dockedAt: string | null;
}

export interface GameFlowState {
  currentMode: GameMode;
  player: CharacterProgression;
  currentShip: ShipState;
  currentIsland: IslandState | null;
  visitedIslands: string[];
  gold: number;
  combatActive: boolean;
  wave: number;
  maxWaves: number;
}

export const MODE_TRANSITIONS: Record<GameMode, GameMode[]> = {
  ocean_sailing: ['dock_menu', 'island_explore'],
  dock_menu: ['ocean_sailing', 'island_explore', 'barracks', 'ship_builder'],
  island_explore: ['island_combat', 'island_harvest', 'dock_menu'],
  island_combat: ['island_explore'],
  island_harvest: ['island_explore'],
  barracks: ['dock_menu'],
  ship_builder: ['dock_menu'],
  captain_creation: ['ocean_sailing'],
};

export function canTransition(from: GameMode, to: GameMode): boolean {
  return MODE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PROFESSION_RESOURCES: Record<Profession, string[]> = {
  mining: ['stone', 'iron_ore', 'copper_ore', 'mithril_ore', 'rare_ore'],
  herbalism: ['herb_bundle', 'silverleaf', 'mageroyal', 'fadeleaf'],
  woodcutting: ['raw_wood', 'oak_log', 'birch_log', 'ancient_wood'],
  fishing: ['raw_fish', 'deep_fish'],
  skinning: ['raw_hide', 'thick_leather', 'beast_bone', 'rare_pelt'],
  blacksmithing: ['iron_ingot', 'steel_bar', 'mithril_bar'],
  alchemy: ['health_potion', 'mana_potion', 'elixir'],
  carpentry: ['plank', 'beam', 'mast', 'hull_plate'],
};

export function professionXpRequired(level: number): number {
  return Math.floor(100 * Math.pow(1.35, level - 1));
}

export function playerXpRequired(level: number): number {
  return Math.floor(200 * Math.pow(1.5, level - 1));
}

export function grantProfessionXp(
  prog: CharacterProgression, profession: Profession, xp: number,
): { leveledUp: boolean; newLevel: number } {
  const p = prog.professions[profession];
  p.xp += xp;
  let leveledUp = false;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = professionXpRequired(p.level);
    leveledUp = true;
  }
  return { leveledUp, newLevel: p.level };
}

export function grantPlayerXp(
  prog: CharacterProgression, xp: number,
): { leveledUp: boolean; newLevel: number } {
  prog.xp += xp;
  let leveledUp = false;
  while (prog.xp >= prog.xpToNext) {
    prog.xp -= prog.xpToNext;
    prog.level++;
    prog.xpToNext = playerXpRequired(prog.level);
    prog.statPoints += 3;
    prog.skillPoints += 1;
    leveledUp = true;
  }
  return { leveledUp, newLevel: prog.level };
}

export const BUILDING_DEFS: Record<string, { label: string; cost: Record<string, number>; unlockLevel: number }> = {
  dock: { label: 'Dock', cost: { raw_wood: 20, stone: 10 }, unlockLevel: 1 },
  watchtower: { label: 'Watchtower', cost: { raw_wood: 15, stone: 15, iron_ore: 5 }, unlockLevel: 2 },
  workshop: { label: 'Workshop', cost: { raw_wood: 30, stone: 20, iron_ore: 10 }, unlockLevel: 3 },
  forge: { label: 'Forge', cost: { stone: 40, iron_ore: 25, copper_ore: 10 }, unlockLevel: 4 },
  alchemy_lab: { label: 'Alchemy Lab', cost: { raw_wood: 25, herb_bundle: 15, crystal_shard: 5 }, unlockLevel: 4 },
  tavern: { label: 'Tavern', cost: { raw_wood: 40, stone: 20 }, unlockLevel: 3 },
  storehouse: { label: 'Storehouse', cost: { raw_wood: 30, stone: 15 }, unlockLevel: 2 },
  shipyard: { label: 'Shipyard', cost: { raw_wood: 60, iron_ore: 30, stone: 40 }, unlockLevel: 5 },
  barracks: { label: 'Barracks', cost: { raw_wood: 35, stone: 30, iron_ore: 15 }, unlockLevel: 3 },
  market: { label: 'Market', cost: { raw_wood: 25, stone: 20 }, unlockLevel: 2 },
};

export const SKILL_TREE = {
  warrior: {
    cleave: { level: 1, dmgMult: 1.8, cooldown: 4, desc: 'Sweeping melee attack hitting nearby enemies' },
    shield_bash: { level: 2, dmgMult: 1.2, cooldown: 6, desc: 'Stun target briefly with shield slam' },
    whirlwind: { level: 3, dmgMult: 2.0, cooldown: 8, desc: 'Spin attack damaging all in range' },
    war_cry: { level: 5, dmgMult: 0.5, cooldown: 12, desc: 'Intimidate enemies, reducing their damage' },
    execute: { level: 7, dmgMult: 3.5, cooldown: 15, desc: 'Massive single-target finisher' },
    recover: { level: 2, dmgMult: 0, cooldown: 10, desc: 'Heal yourself for a large amount' },
    flurry: { level: 4, dmgMult: 1.5, cooldown: 7, desc: 'Rapid series of quick strikes' },
    leap_strike: { level: 6, dmgMult: 2.5, cooldown: 9, desc: 'Leap to target and slam down' },
  },
  ranger: {
    aimed_shot: { level: 1, dmgMult: 2.2, cooldown: 5, desc: 'Precise ranged attack' },
    multi_shot: { level: 3, dmgMult: 1.4, cooldown: 7, desc: 'Hit multiple targets in a cone' },
    trap: { level: 2, dmgMult: 1.0, cooldown: 10, desc: 'Place a trap that roots enemies' },
    evasion: { level: 4, dmgMult: 0, cooldown: 15, desc: 'Dodge all attacks for 3 seconds' },
  },
  mage: {
    fireball: { level: 1, dmgMult: 2.5, cooldown: 3, desc: 'Hurl a ball of fire at target' },
    frost_nova: { level: 3, dmgMult: 1.8, cooldown: 8, desc: 'Freeze all nearby enemies' },
    arcane_blast: { level: 5, dmgMult: 3.0, cooldown: 6, desc: 'Concentrated arcane energy burst' },
    mana_shield: { level: 2, dmgMult: 0, cooldown: 20, desc: 'Absorb damage using mana' },
  },
  worge: {
    feral_swipe: { level: 1, dmgMult: 1.6, cooldown: 3, desc: 'Quick claw attack' },
    howl: { level: 2, dmgMult: 0, cooldown: 12, desc: 'Buff attack speed for 8 seconds' },
    pounce: { level: 3, dmgMult: 2.2, cooldown: 7, desc: 'Leap and pin target' },
    rend: { level: 5, dmgMult: 1.0, cooldown: 4, desc: 'Bleeding damage over time' },
  },
};

export function createDefaultProgression(): CharacterProgression {
  const mkProf = (p: Profession): ProfessionProgress => ({
    profession: p, level: 1, xp: 0, xpToNext: professionXpRequired(1),
  });
  return {
    level: 1,
    xp: 0,
    xpToNext: playerXpRequired(1),
    statPoints: 0,
    skillPoints: 0,
    unlockedSkills: ['cleave', 'recover'],
    equippedSkills: ['cleave', 'recover'],
    professions: {
      mining: mkProf('mining'),
      herbalism: mkProf('herbalism'),
      woodcutting: mkProf('woodcutting'),
      fishing: mkProf('fishing'),
      skinning: mkProf('skinning'),
      blacksmithing: mkProf('blacksmithing'),
      alchemy: mkProf('alchemy'),
      carpentry: mkProf('carpentry'),
    },
  };
}

export function createDefaultIsland(id: string, name: string): IslandState {
  return {
    id, name, discovered: true, dockBuilt: false,
    buildings: [], harvestables: [], enemies: [],
    resources: {},
  };
}

export function createDefaultShip(): ShipState {
  return {
    id: `ship_${Date.now()}`,
    name: 'The Wanderer',
    type: 'sloop',
    hull: 100, maxHull: 100,
    cargo: {}, crew: 8, maxCrew: 12,
    cannons: 4, speed: 10,
    docked: false, dockedAt: null,
  };
}

export function createDefaultGameFlow(): GameFlowState {
  return {
    currentMode: 'island_explore',
    player: createDefaultProgression(),
    currentShip: createDefaultShip(),
    currentIsland: createDefaultIsland('starter_isle', 'Haven Isle'),
    visitedIslands: ['starter_isle'],
    gold: 1000,
    combatActive: false,
    wave: 0,
    maxWaves: 5,
  };
}
