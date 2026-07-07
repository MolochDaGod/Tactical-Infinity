import type { UnitClass, WeaponType, TerrainType } from "@shared/schema";

export interface SpriteSheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AsepriteMeta {
  app: string;
  version: string;
  image: string;
  format: string;
  size: { w: number; h: number };
  scale: string;
  frameTags?: AsepriteFrameTag[];
  layers?: AsepriteLayer[];
  slices?: AsepriteSlice[];
}

export interface AsepriteFrameTag {
  name: string;
  from: number;
  to: number;
  direction: "forward" | "reverse" | "pingpong";
}

export interface AsepriteLayer {
  name: string;
  opacity: number;
  blendMode: string;
}

export interface AsepriteSlice {
  name: string;
  color: string;
  keys: { frame: number; bounds: { x: number; y: number; w: number; h: number } }[];
}

export interface AsepriteFrame {
  frame: SpriteSheetFrame;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: SpriteSheetFrame;
  sourceSize: { w: number; h: number };
  duration: number;
}

export interface AsepriteJSON {
  frames: Record<string, AsepriteFrame> | AsepriteFrame[];
  meta: AsepriteMeta;
}

export interface AnimationDefinition {
  name: string;
  frames: number[];
  frameRate: number;
  loop: boolean;
}

export interface CharacterSpriteAsset {
  id: string;
  name: string;
  spritesheetPath: string;
  jsonPath?: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, AnimationDefinition>;
  defaultAnimation: string;
}

export interface WeaponSpriteAsset {
  id: string;
  type: WeaponType;
  tier: number;
  spritePath: string;
  attackAnimationPath?: string;
  attackFrames?: number;
}

export interface TerrainTileAsset {
  id: string;
  type: TerrainType;
  tilePath: string;
  variants?: string[];
  animated?: boolean;
  animationFrames?: number;
  animationSpeed?: number;
}

export interface EffectAsset {
  id: string;
  name: string;
  spritesheetPath: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
  loop: boolean;
  blendMode?: "normal" | "add" | "multiply" | "screen";
}

export const ASSET_BASE_PATH = "/2dassets";

export const characterAssets: Record<string, CharacterSpriteAsset> = {
  warrior: {
    id: "char-warrior",
    name: "Warrior",
    spritesheetPath: `${ASSET_BASE_PATH}/sprites/characters/warrior/spritesheet.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: { name: "idle", frames: [0, 1, 2, 3], frameRate: 4, loop: true },
      walk: { name: "walk", frames: [4, 5, 6, 7, 8, 9], frameRate: 8, loop: true },
      attack: { name: "attack", frames: [10, 11, 12, 13, 14, 15], frameRate: 12, loop: false },
      hit: { name: "hit", frames: [16, 17], frameRate: 8, loop: false },
      death: { name: "death", frames: [18, 19, 20, 21, 22, 23], frameRate: 6, loop: false },
    },
    defaultAnimation: "idle",
  },
  mage: {
    id: "char-mage",
    name: "Mage",
    spritesheetPath: `${ASSET_BASE_PATH}/sprites/characters/mage/spritesheet.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: { name: "idle", frames: [0, 1, 2, 3], frameRate: 4, loop: true },
      walk: { name: "walk", frames: [4, 5, 6, 7, 8, 9], frameRate: 8, loop: true },
      cast: { name: "cast", frames: [10, 11, 12, 13, 14, 15, 16, 17], frameRate: 10, loop: false },
      hit: { name: "hit", frames: [18, 19], frameRate: 8, loop: false },
      death: { name: "death", frames: [20, 21, 22, 23, 24, 25], frameRate: 6, loop: false },
    },
    defaultAnimation: "idle",
  },
  archer: {
    id: "char-archer",
    name: "Archer",
    spritesheetPath: `${ASSET_BASE_PATH}/sprites/characters/archer/spritesheet.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: { name: "idle", frames: [0, 1, 2, 3], frameRate: 4, loop: true },
      walk: { name: "walk", frames: [4, 5, 6, 7, 8, 9], frameRate: 8, loop: true },
      shoot: { name: "shoot", frames: [10, 11, 12, 13, 14], frameRate: 10, loop: false },
      hit: { name: "hit", frames: [15, 16], frameRate: 8, loop: false },
      death: { name: "death", frames: [17, 18, 19, 20, 21, 22], frameRate: 6, loop: false },
    },
    defaultAnimation: "idle",
  },
  healer: {
    id: "char-healer",
    name: "Healer",
    spritesheetPath: `${ASSET_BASE_PATH}/sprites/characters/healer/spritesheet.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: { name: "idle", frames: [0, 1, 2, 3], frameRate: 4, loop: true },
      walk: { name: "walk", frames: [4, 5, 6, 7, 8, 9], frameRate: 8, loop: true },
      heal: { name: "heal", frames: [10, 11, 12, 13, 14, 15], frameRate: 8, loop: false },
      hit: { name: "hit", frames: [16, 17], frameRate: 8, loop: false },
      death: { name: "death", frames: [18, 19, 20, 21, 22, 23], frameRate: 6, loop: false },
    },
    defaultAnimation: "idle",
  },
  rogue: {
    id: "char-rogue",
    name: "Rogue",
    spritesheetPath: `${ASSET_BASE_PATH}/sprites/characters/rogue/spritesheet.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: { name: "idle", frames: [0, 1, 2, 3], frameRate: 4, loop: true },
      walk: { name: "walk", frames: [4, 5, 6, 7, 8, 9], frameRate: 10, loop: true },
      attack: { name: "attack", frames: [10, 11, 12, 13, 14], frameRate: 14, loop: false },
      hit: { name: "hit", frames: [15, 16], frameRate: 8, loop: false },
      death: { name: "death", frames: [17, 18, 19, 20, 21, 22], frameRate: 6, loop: false },
    },
    defaultAnimation: "idle",
  },
  knight: {
    id: "char-knight",
    name: "Knight",
    spritesheetPath: `${ASSET_BASE_PATH}/sprites/characters/knight/spritesheet.png`,
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: { name: "idle", frames: [0, 1, 2, 3], frameRate: 3, loop: true },
      walk: { name: "walk", frames: [4, 5, 6, 7, 8, 9], frameRate: 6, loop: true },
      attack: { name: "attack", frames: [10, 11, 12, 13, 14, 15, 16], frameRate: 10, loop: false },
      block: { name: "block", frames: [17, 18, 19], frameRate: 8, loop: false },
      hit: { name: "hit", frames: [20, 21], frameRate: 8, loop: false },
      death: { name: "death", frames: [22, 23, 24, 25, 26, 27], frameRate: 6, loop: false },
    },
    defaultAnimation: "idle",
  },
};

export const terrainAssets: Record<TerrainType, TerrainTileAsset> = {
  grass: {
    id: "terrain-grass",
    type: "grass",
    tilePath: `${ASSET_BASE_PATH}/tiles/grass.png`,
    variants: ["grass_1.png", "grass_2.png", "grass_3.png"],
  },
  forest: {
    id: "terrain-forest",
    type: "forest",
    tilePath: `${ASSET_BASE_PATH}/tiles/forest.png`,
    variants: ["forest_1.png", "forest_2.png"],
  },
  water: {
    id: "terrain-water",
    type: "water",
    tilePath: `${ASSET_BASE_PATH}/tiles/water.png`,
    animated: true,
    animationFrames: 4,
    animationSpeed: 0.15,
  },
  mountain: {
    id: "terrain-mountain",
    type: "mountain",
    tilePath: `${ASSET_BASE_PATH}/tiles/mountain.png`,
  },
  sand: {
    id: "terrain-sand",
    type: "sand",
    tilePath: `${ASSET_BASE_PATH}/tiles/sand.png`,
    variants: ["sand_1.png", "sand_2.png"],
  },
  stone: {
    id: "terrain-stone",
    type: "stone",
    tilePath: `${ASSET_BASE_PATH}/tiles/stone.png`,
  },
};

export const effectAssets: Record<string, EffectAsset> = {
  slash: {
    id: "effect-slash",
    name: "Slash",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/slash.png`,
    frameWidth: 64,
    frameHeight: 64,
    frames: 6,
    frameRate: 16,
    loop: false,
    blendMode: "add",
  },
  fireball: {
    id: "effect-fireball",
    name: "Fireball",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/fireball.png`,
    frameWidth: 48,
    frameHeight: 48,
    frames: 8,
    frameRate: 12,
    loop: true,
    blendMode: "add",
  },
  explosion: {
    id: "effect-explosion",
    name: "Explosion",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/explosion.png`,
    frameWidth: 96,
    frameHeight: 96,
    frames: 12,
    frameRate: 20,
    loop: false,
    blendMode: "add",
  },
  heal: {
    id: "effect-heal",
    name: "Heal",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/heal.png`,
    frameWidth: 64,
    frameHeight: 64,
    frames: 10,
    frameRate: 12,
    loop: false,
    blendMode: "add",
  },
  arrow: {
    id: "effect-arrow",
    name: "Arrow",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/arrow.png`,
    frameWidth: 32,
    frameHeight: 16,
    frames: 1,
    frameRate: 1,
    loop: false,
  },
  lightning: {
    id: "effect-lightning",
    name: "Lightning",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/lightning.png`,
    frameWidth: 64,
    frameHeight: 128,
    frames: 6,
    frameRate: 18,
    loop: false,
    blendMode: "add",
  },
  shieldBash: {
    id: "effect-shield-bash",
    name: "Shield Bash",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/shield_bash.png`,
    frameWidth: 80,
    frameHeight: 80,
    frames: 5,
    frameRate: 14,
    loop: false,
    blendMode: "add",
  },
  poison: {
    id: "effect-poison",
    name: "Poison",
    spritesheetPath: `${ASSET_BASE_PATH}/effects/poison.png`,
    frameWidth: 48,
    frameHeight: 48,
    frames: 6,
    frameRate: 8,
    loop: true,
    blendMode: "multiply",
  },
};

export function parseAsepriteJSON(json: AsepriteJSON): {
  frames: AsepriteFrame[];
  animations: Record<string, AnimationDefinition>;
} {
  const framesArray = Array.isArray(json.frames) 
    ? json.frames 
    : Object.values(json.frames);
  
  const animations: Record<string, AnimationDefinition> = {};
  
  if (json.meta.frameTags) {
    for (const tag of json.meta.frameTags) {
      const frameIndices: number[] = [];
      for (let i = tag.from; i <= tag.to; i++) {
        frameIndices.push(i);
      }
      if (tag.direction === "reverse") {
        frameIndices.reverse();
      } else if (tag.direction === "pingpong") {
        const reversed = [...frameIndices].reverse().slice(1);
        frameIndices.push(...reversed);
      }
      
      const avgDuration = framesArray.slice(tag.from, tag.to + 1)
        .reduce((sum, f) => sum + f.duration, 0) / (tag.to - tag.from + 1);
      
      animations[tag.name] = {
        name: tag.name,
        frames: frameIndices,
        frameRate: Math.round(1000 / avgDuration),
        loop: tag.name.includes("idle") || tag.name.includes("walk"),
      };
    }
  }
  
  return { frames: framesArray, animations };
}

export async function loadAsepriteAsset(jsonPath: string): Promise<{
  frames: AsepriteFrame[];
  animations: Record<string, AnimationDefinition>;
  imagePath: string;
} | null> {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) return null;
    
    const json: AsepriteJSON = await response.json();
    const parsed = parseAsepriteJSON(json);
    
    return {
      ...parsed,
      imagePath: json.meta.image,
    };
  } catch (error) {
    console.warn(`Failed to load Aseprite asset: ${jsonPath}`, error);
    return null;
  }
}
