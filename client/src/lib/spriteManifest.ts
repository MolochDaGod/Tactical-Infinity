export interface SpriteAnimation {
  name: string;
  fileName: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  loop: boolean;
  isEffect?: boolean;
  isProjectile?: boolean;
}

export interface CharacterSprite {
  id: string;
  name: string;
  folder: string;
  effectsFolder?: string;
  projectileFolder?: string;
  animations: Record<string, SpriteAnimation>;
}

function anim(name: string, fileName: string, frames: number = 6, loop: boolean = false, width: number = 100, height: number = 100): SpriteAnimation {
  return { name, fileName, frames, frameWidth: width, frameHeight: height, loop };
}

function effect(name: string, fileName: string, frames: number = 6, width: number = 100, height: number = 100): SpriteAnimation {
  return { name, fileName, frames, frameWidth: width, frameHeight: height, loop: false, isEffect: true };
}

function projectile(name: string, fileName: string, frames: number = 4, width: number = 100, height: number = 100): SpriteAnimation {
  return { name, fileName, frames, frameWidth: width, frameHeight: height, loop: true, isProjectile: true };
}

export const SPRITE_CHARACTERS: CharacterSprite[] = [
  {
    id: 'archer',
    name: 'Archer',
    folder: 'Archer/Archer',
    effectsFolder: 'Archer/Archer(Split Effects)',
    projectileFolder: 'Archer/Arrow(projectile)',
    animations: {
      'idle': anim('Idle', 'Archer-Idle', 6, true),
      'walk': anim('Walk', 'Archer-Walk', 8, true),
      'attack01': anim('Attack 1', 'Archer-Attack01', 9),
      'attack02': anim('Attack 2', 'Archer-Attack02', 12),
      'death': anim('Death', 'Archer-Death', 4),
      'hurt': anim('Hurt', 'Archer-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Archer-Attack01_Effect', 9),
      'attack02_effect': effect('Attack 2 Effect', 'Archer-Attack02_Effect', 12),
      'arrow': projectile('Arrow', 'Arrow02(100x100)', 1),
    }
  },
  {
    id: 'armored-axeman',
    name: 'Armored Axeman',
    folder: 'Armored Axeman/Armored Axeman',
    effectsFolder: 'Armored Axeman/Armored Axeman(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Armored Axeman-Idle', 6, true),
      'walk': anim('Walk', 'Armored Axeman-Walk', 8, true),
      'attack01': anim('Attack 1', 'Armored Axeman-Attack01', 9),
      'attack02': anim('Attack 2', 'Armored Axeman-Attack02', 9),
      'attack03': anim('Attack 3', 'Armored Axeman-Attack03', 12),
      'death': anim('Death', 'Armored Axeman-Death', 4),
      'hurt': anim('Hurt', 'Armored Axeman-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Armored Axeman-Attack01_Effect', 9),
      'attack02_effect': effect('Attack 2 Effect', 'Armored Axeman-Attack02_Effect', 9),
      'attack03_effect': effect('Attack 3 Effect', 'Armored Axeman-Attack03_Effect', 12),
    }
  },
  {
    id: 'armored-orc',
    name: 'Armored Orc',
    folder: 'Armored Orc/Armored Orc',
    effectsFolder: 'Armored Orc/Armored Orc(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Armored Orc-Idle', 6, true),
      'walk': anim('Walk', 'Armored Orc-Walk', 8, true),
      'attack01': anim('Attack 1', 'Armored Orc-Attack01', 7),
      'attack02': anim('Attack 2', 'Armored Orc-Attack02', 8),
      'attack03': anim('Attack 3', 'Armored Orc-Attack03', 9),
      'block': anim('Block', 'Armored Orc-Block', 4),
      'death': anim('Death', 'Armored Orc-Death', 4),
      'hurt': anim('Hurt', 'Armored Orc-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Armored Orc-Attack01_Effect', 7),
      'attack02_effect': effect('Attack 2 Effect', 'Armored Orc-Attack02_Effect', 8),
      'attack03_effect': effect('Attack 3 Effect', 'Armored Orc-Attack03_Effect', 9),
    }
  },
  {
    id: 'armored-skeleton',
    name: 'Armored Skeleton',
    folder: 'Armored Skeleton/Armored Skeleton',
    effectsFolder: 'Armored Skeleton/Armored Skeleton(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Armored Skeleton-Idle', 6, true),
      'walk': anim('Walk', 'Armored Skeleton-Walk', 8, true),
      'attack01': anim('Attack 1', 'Armored Skeleton-Attack01', 8),
      'attack02': anim('Attack 2', 'Armored Skeleton-Attack02', 9),
      'death': anim('Death', 'Armored Skeleton-Death', 4),
      'hurt': anim('Hurt', 'Armored Skeleton-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Armored Skeleton-Attack01_Effect', 8),
      'attack02_effect': effect('Attack 2 Effect', 'Armored Skeleton-Attack02_Effect', 9),
    }
  },
  {
    id: 'elite-orc',
    name: 'Elite Orc',
    folder: 'Elite Orc/Elite Orc',
    effectsFolder: 'Elite Orc/Elite Orc(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Elite Orc-Idle', 6, true),
      'walk': anim('Walk', 'Elite Orc-Walk', 8, true),
      'attack01': anim('Attack 1', 'Elite Orc-Attack01', 7),
      'attack02': anim('Attack 2', 'Elite Orc-Attack02', 11),
      'attack03': anim('Attack 3', 'Elite Orc-Attack03', 9),
      'death': anim('Death', 'Elite Orc-Death', 4),
      'hurt': anim('Hurt', 'Elite Orc-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Elite Orc-Attack01_Effect', 7),
      'attack02_effect': effect('Attack 2 Effect', 'Elite Orc-Attack02_Effect', 11),
      'attack03_effect': effect('Attack 3 Effect', 'Elite Orc-Attack03_Effect', 9),
    }
  },
  {
    id: 'greatsword-skeleton',
    name: 'Greatsword Skeleton',
    folder: 'Greatsword Skeleton/Greatsword Skeleton',
    effectsFolder: 'Greatsword Skeleton/Greatsword Skeleton(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Greatsword Skeleton-Idle', 6, true),
      'walk': anim('Walk', 'Greatsword Skeleton-Walk', 9, true),
      'attack01': anim('Attack 1', 'Greatsword Skeleton-Attack01', 9),
      'attack02': anim('Attack 2', 'Greatsword Skeleton-Attack02', 12),
      'attack03': anim('Attack 3', 'Greatsword Skeleton-Attack03', 8),
      'death': anim('Death', 'Greatsword Skeleton-Death', 4),
      'hurt': anim('Hurt', 'Greatsword Skeleton-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Greatsword Skeleton-Attack01_Effect', 9),
      'attack02_effect': effect('Attack 2 Effect', 'Greatsword Skeleton-Attack02_Effect', 12),
      'attack03_effect': effect('Attack 3 Effect', 'Greatsword Skeleton-Attack03_Effect', 8),
    }
  },
  {
    id: 'knight',
    name: 'Knight',
    folder: 'Knight/Knight',
    effectsFolder: 'Knight/Knight(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Knight-Idle', 6, true),
      'walk': anim('Walk', 'Knight-Walk', 8, true),
      'attack01': anim('Attack 1', 'Knight-Attack01', 7),
      'attack02': anim('Attack 2', 'Knight-Attack02', 10),
      'attack03': anim('Attack 3', 'Knight-Attack03', 11),
      'block': anim('Block', 'Knight-Block', 4),
      'death': anim('Death', 'Knight-Death', 4),
      'hurt': anim('Hurt', 'Knight-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Knight-Attack01_Effect', 7),
      'attack02_effect': effect('Attack 2 Effect', 'Knight-Attack02_Effect', 10),
      'attack03_effect': effect('Attack 3 Effect', 'Knight-Attack03_Effect', 11),
    }
  },
  {
    id: 'knight-templar',
    name: 'Knight Templar',
    folder: 'Knight Templar/Knight Templar',
    effectsFolder: 'Knight Templar/Knight Templar(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Knight Templar-Idle', 6, true),
      'walk01': anim('Walk 1', 'Knight Templar-Walk01', 8, true),
      'walk02': anim('Walk 2', 'Knight Templar-Walk02', 8, true),
      'attack01': anim('Attack 1', 'Knight Templar-Attack01', 7),
      'attack02': anim('Attack 2', 'Knight Templar-Attack02', 8),
      'attack03': anim('Attack 3', 'Knight Templar-Attack03', 11),
      'block': anim('Block', 'Knight Templar-Block', 4),
      'death': anim('Death', 'Knight Templar-Death', 4),
      'hurt': anim('Hurt', 'Knight Templar-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Knight Templar-Attack01_Effect', 7),
      'attack02_effect': effect('Attack 2 Effect', 'Knight Templar-Attack02_Effect', 8),
      'attack03_effect': effect('Attack 3 Effect', 'Knight Templar-Attack03_Effect', 11),
    }
  },
  {
    id: 'lancer',
    name: 'Lancer',
    folder: 'Lancer/Lancer',
    effectsFolder: 'Lancer/Lancer(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Lancer-Idle', 6, true),
      'walk01': anim('Walk 1', 'Lancer-Walk01', 8, true),
      'walk02': anim('Walk 2', 'Lancer-Walk02', 8, true),
      'attack01': anim('Attack 1', 'Lancer-Attack01', 6),
      'attack02': anim('Attack 2', 'Lancer-Attack02', 9),
      'attack03': anim('Attack 3', 'Lancer-Attack03', 8),
      'death': anim('Death', 'Lancer-Death', 4),
      'hurt': anim('Hurt', 'Lancer-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Lancer-Attack01_Effect', 6),
      'attack02_effect': effect('Attack 2 Effect', 'Lancer-Attack02_Effect', 9),
      'attack03_effect': effect('Attack 3 Effect', 'Lancer-Attack03_Effect', 8),
    }
  },
  {
    id: 'orc',
    name: 'Orc',
    folder: 'Orc/Orc',
    effectsFolder: 'Orc/Orc(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Orc-Idle', 6, true),
      'walk': anim('Walk', 'Orc-Walk', 8, true),
      'attack01': anim('Attack 1', 'Orc-Attack01', 6),
      'attack02': anim('Attack 2', 'Orc-Attack02', 6),
      'death': anim('Death', 'Orc-Death', 4),
      'hurt': anim('Hurt', 'Orc-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Orc-attack01_Effect', 6),
      'attack02_effect': effect('Attack 2 Effect', 'Orc-attack02_Effect', 6),
    }
  },
  {
    id: 'orc-rider',
    name: 'Orc Rider',
    folder: 'Orc rider/Orc rider',
    effectsFolder: 'Orc rider/Orc rider(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Orc rider-Idle', 6, true),
      'walk': anim('Walk', 'Orc rider-Walk', 8, true),
      'attack01': anim('Attack 1', 'Orc rider-Attack01', 8),
      'attack02': anim('Attack 2', 'Orc rider-Attack02', 9),
      'attack03': anim('Attack 3', 'Orc rider-Attack03', 11),
      'block': anim('Block', 'Orc rider-Block', 4),
      'death': anim('Death', 'Orc rider-Death', 4),
      'hurt': anim('Hurt', 'Orc rider-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Orc rider-Attack01_Effect', 8),
      'attack02_effect': effect('Attack 2 Effect', 'Orc rider-Attack02_Effect', 9),
      'attack03_effect': effect('Attack 3 Effect', 'Orc rider-Attack03_Effect', 11),
    }
  },
  {
    id: 'priest',
    name: 'Priest',
    folder: 'Priest/Priest',
    effectsFolder: 'Priest/Priest(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Priest-Idle', 6, true),
      'walk': anim('Walk', 'Priest-Walk', 8, true),
      'attack': anim('Attack', 'Priest-Attack', 9),
      'heal': anim('Heal', 'Priest-Heal', 6),
      'death': anim('Death', 'Priest-Death', 4),
      'hurt': anim('Hurt', 'Priest-Hurt', 4),
      'attack_effect': effect('Attack Effect', 'Priest-Attack_Effect', 5),
      'heal_effect': effect('Heal Effect', 'Priest-Heal_Effect', 4),
    }
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    folder: 'Skeleton/Skeleton',
    effectsFolder: 'Skeleton/Skeleton(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Skeleton-Idle', 6, true),
      'walk': anim('Walk', 'Skeleton-Walk', 8, true),
      'attack01': anim('Attack 1', 'Skeleton-Attack01', 7),
      'attack02': anim('Attack 2', 'Skeleton-Attack02', 8),
      'death': anim('Death', 'Skeleton-Death', 4),
      'hurt': anim('Hurt', 'Skeleton-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Skeleton-Attack01_Effect', 7),
      'attack02_effect': effect('Attack 2 Effect', 'Skeleton-Attack02_Effect', 8),
    }
  },
  {
    id: 'skeleton-archer',
    name: 'Skeleton Archer',
    folder: 'Skeleton Archer/Skeleton Archer',
    effectsFolder: 'Skeleton Archer/Skeleton Archer(Split Effects)',
    projectileFolder: 'Skeleton Archer/Arrow(projectile)',
    animations: {
      'idle': anim('Idle', 'Skeleton Archer-Idle', 6, true),
      'walk': anim('Walk', 'Skeleton Archer-Walk', 8, true),
      'attack01': anim('Attack 1', 'Skeleton Archer-Attack01', 9),
      'attack02': anim('Attack 2', 'Skeleton Archer-Attack02', 12),
      'death': anim('Death', 'Skeleton Archer-Death', 4),
      'hurt': anim('Hurt', 'Skeleton Archer-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Skeleton Archer-Attack01_Effect', 9),
      'attack02_effect': effect('Attack 2 Effect', 'Skeleton Archer-Attack02_Effect', 12),
      'arrow': projectile('Arrow', 'Arrow02(100x100)', 1),
    }
  },
  {
    id: 'slime',
    name: 'Slime',
    folder: 'Slime/Slime',
    effectsFolder: 'Slime/Slime(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Slime-Idle', 6, true),
      'walk': anim('Walk', 'Slime-Walk', 6, true),
      'attack01': anim('Attack 1', 'Slime-Attack01', 6),
      'attack02': anim('Attack 2', 'Slime-Attack02', 11),
      'death': anim('Death', 'Slime-Death', 4),
      'hurt': anim('Hurt', 'Slime-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Slime-Attack01_Effect', 6),
      'attack02_effect': effect('Attack 2 Effect', 'Slime-Attack02_Effect', 11),
    }
  },
  {
    id: 'soldier',
    name: 'Soldier',
    folder: 'Soldier/Soldier',
    effectsFolder: 'Soldier/Soldier(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Soldier-Idle', 6, true),
      'walk': anim('Walk', 'Soldier-Walk', 8, true),
      'attack01': anim('Attack 1', 'Soldier-Attack01', 8),
      'attack02': anim('Attack 2', 'Soldier-Attack02', 9),
      'attack03': anim('Attack 3', 'Soldier-Attack03', 10),
      'block': anim('Block', 'Soldier-Block', 4),
      'death': anim('Death', 'Soldier-Death', 4),
      'hurt': anim('Hurt', 'Soldier-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Soldier-Attack01_Effect', 8),
      'attack02_effect': effect('Attack 2 Effect', 'Soldier-Attack02_Effect', 9),
      'attack03_effect': effect('Attack 3 Effect', 'Soldier-Attack03_Effect', 10),
    }
  },
  {
    id: 'swordsman',
    name: 'Swordsman',
    folder: 'Swordsman/Swordsman',
    effectsFolder: 'Swordsman/Swordsman(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Swordsman-Idle', 6, true),
      'walk': anim('Walk', 'Swordsman-Walk', 8, true),
      'attack01': anim('Attack 1', 'Swordsman-Attack01', 7),
      'attack02': anim('Attack 2', 'Swordsman-Attack02', 15),
      'attack03': anim('Attack 3', 'Swordsman-Attack3', 12),
      'death': anim('Death', 'Swordsman-Death', 4),
      'hurt': anim('Hurt', 'Swordsman-Hurt', 5),
      'attack01_effect': effect('Attack 1 Effect', 'Swordsman-Attack01_Effect', 7),
      'attack02_effect': effect('Attack 2 Effect', 'Swordsman-Attack02_Effect', 15),
      'attack03_effect': effect('Attack 3 Effect', 'Swordsman-Attack3_Effect', 12),
    }
  },
  {
    id: 'werebear',
    name: 'Werebear',
    folder: 'Werebear/Werebear',
    effectsFolder: 'Werebear/Werebear(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Werebear-Idle', 6, true),
      'walk': anim('Walk', 'Werebear-Walk', 8, true),
      'attack01': anim('Attack 1', 'Werebear-Attack01', 9),
      'attack02': anim('Attack 2', 'Werebear-Attack02', 13),
      'attack03': anim('Attack 3', 'Werebear-Attack03', 9),
      'death': anim('Death', 'Werebear-Death', 4),
      'hurt': anim('Hurt', 'Werebear-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Werebear-Attack01_Effect', 9),
      'attack02_effect': effect('Attack 2 Effect', 'Werebear-Attack02_Effect', 13),
      'attack03_effect': effect('Attack 3 Effect', 'Werebear-Attack03_Effect', 9),
    }
  },
  {
    id: 'werewolf',
    name: 'Werewolf',
    folder: 'Werewolf/Werewolf',
    effectsFolder: 'Werewolf/Werewolf(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Werewolf-Idle', 6, true),
      'walk': anim('Walk', 'Werewolf-Walk', 8, true),
      'attack01': anim('Attack 1', 'Werewolf-Attack01', 9),
      'attack02': anim('Attack 2', 'Werewolf-Attack02', 13),
      'death': anim('Death', 'Werewolf-Death', 4),
      'hurt': anim('Hurt', 'Werewolf-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Werewolf-Attack01_Effect', 9),
      'attack02_effect': effect('Attack 2 Effect', 'Werewolf-Attack02_Effect', 13),
    }
  },
  {
    id: 'wizard',
    name: 'Wizard',
    folder: 'Wizard/Wizard',
    effectsFolder: 'Wizard/Wizard(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Wizard-Idle', 6, true),
      'walk': anim('Walk', 'Wizard-Walk', 8, true),
      'attack01': anim('Attack 1', 'Wizard-Attack01', 6),
      'attack02': anim('Attack 2', 'Wizard-Attack02', 6),
      'death': anim('Death', 'Wizard-DEATH', 4),
      'hurt': anim('Hurt', 'Wizard-Hurt', 4),
      'attack01_effect': effect('Attack 1 Effect', 'Wizard-Attack01_Effect', 10),
      'attack02_effect': effect('Attack 2 Effect', 'Wizard-Attack02_Effect', 7),
    }
  }
];

export function getSpriteUrl(character: CharacterSprite, animationKey: string): string {
  const animation = character.animations[animationKey];
  if (!animation) return '';
  
  // URL-encode the path components to handle spaces and special characters
  const encodePathComponent = (path: string) => path.split('/').map(part => encodeURIComponent(part)).join('/');
  
  if (animation.isEffect && character.effectsFolder) {
    return `/sprites/characters/${encodePathComponent(character.effectsFolder)}/${encodeURIComponent(animation.fileName)}.png`;
  }
  
  if (animation.isProjectile && character.projectileFolder) {
    return `/sprites/characters/${encodePathComponent(character.projectileFolder)}/${encodeURIComponent(animation.fileName)}.png`;
  }
  
  return `/sprites/characters/${encodePathComponent(character.folder)}/${encodeURIComponent(animation.fileName)}.png`;
}

export function getCharacterById(id: string): CharacterSprite | undefined {
  return SPRITE_CHARACTERS.find(c => c.id === id);
}

export function getAnimationCategories(character: CharacterSprite): {
  base: string[];
  attacks: string[];
  effects: string[];
  projectiles: string[];
} {
  const base: string[] = [];
  const attacks: string[] = [];
  const effects: string[] = [];
  const projectiles: string[] = [];
  
  for (const key of Object.keys(character.animations)) {
    const anim = character.animations[key];
    if (anim.isProjectile) {
      projectiles.push(key);
    } else if (anim.isEffect) {
      effects.push(key);
    } else if (key.startsWith('attack') || key === 'heal') {
      attacks.push(key);
    } else {
      base.push(key);
    }
  }
  
  return { base, attacks, effects, projectiles };
}

export function getAllCharacterIds(): string[] {
  return SPRITE_CHARACTERS.map(c => c.id);
}

export function getTotalAnimationCount(): number {
  return SPRITE_CHARACTERS.reduce((acc, c) => acc + Object.keys(c.animations).length, 0);
}

export function getTotalFrameCount(): number {
  return SPRITE_CHARACTERS.reduce((acc, c) => 
    acc + Object.values(c.animations).reduce((a, anim) => a + anim.frames, 0), 0
  );
}
