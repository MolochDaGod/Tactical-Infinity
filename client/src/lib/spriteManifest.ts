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

function anim(name: string, fileName: string, frames: number = 6, loop: boolean = false): SpriteAnimation {
  return { name, fileName, frames, frameWidth: 100, frameHeight: 100, loop };
}

function effect(name: string, fileName: string, frames: number = 6): SpriteAnimation {
  return { name, fileName, frames, frameWidth: 100, frameHeight: 100, loop: false, isEffect: true };
}

function projectile(name: string, fileName: string, frames: number = 4): SpriteAnimation {
  return { name, fileName, frames, frameWidth: 100, frameHeight: 100, loop: true, isProjectile: true };
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
      'walk': anim('Walk', 'Archer-Walk', 6, true),
      'attack01': anim('Attack01', 'Archer-Attack01', 6),
      'attack02': anim('Attack02', 'Archer-Attack02', 6),
      'death': anim('Death', 'Archer-Death', 6),
      'hurt': anim('Hurt', 'Archer-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Archer-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Archer-Attack02_Effect', 6),
      'arrow': projectile('Arrow', 'Arrow02(100x100)', 4),
    }
  },
  {
    id: 'armored-axeman',
    name: 'Armored Axeman',
    folder: 'Armored Axeman/Armored Axeman',
    effectsFolder: 'Armored Axeman/Armored Axeman(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Armored Axeman-Idle', 6, true),
      'walk': anim('Walk', 'Armored Axeman-Walk', 6, true),
      'attack01': anim('Attack01', 'Armored Axeman-Attack01', 6),
      'attack02': anim('Attack02', 'Armored Axeman-Attack02', 6),
      'attack03': anim('Attack03', 'Armored Axeman-Attack03', 6),
      'death': anim('Death', 'Armored Axeman-Death', 6),
      'hurt': anim('Hurt', 'Armored Axeman-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Armored Axeman-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Armored Axeman-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Armored Axeman-Attack03_Effect', 6),
    }
  },
  {
    id: 'armored-orc',
    name: 'Armored Orc',
    folder: 'Armored Orc/Armored Orc',
    effectsFolder: 'Armored Orc/Armored Orc(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Armored Orc-Idle', 6, true),
      'walk': anim('Walk', 'Armored Orc-Walk', 6, true),
      'attack01': anim('Attack01', 'Armored Orc-Attack01', 6),
      'attack02': anim('Attack02', 'Armored Orc-Attack02', 6),
      'attack03': anim('Attack03', 'Armored Orc-Attack03', 6),
      'block': anim('Block', 'Armored Orc-Block', 4),
      'death': anim('Death', 'Armored Orc-Death', 6),
      'hurt': anim('Hurt', 'Armored Orc-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Armored Orc-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Armored Orc-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Armored Orc-Attack03_Effect', 6),
    }
  },
  {
    id: 'armored-skeleton',
    name: 'Armored Skeleton',
    folder: 'Armored Skeleton/Armored Skeleton',
    effectsFolder: 'Armored Skeleton/Armored Skeleton(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Armored Skeleton-Idle', 6, true),
      'walk': anim('Walk', 'Armored Skeleton-Walk', 6, true),
      'attack01': anim('Attack01', 'Armored Skeleton-Attack01', 6),
      'attack02': anim('Attack02', 'Armored Skeleton-Attack02', 6),
      'death': anim('Death', 'Armored Skeleton-Death', 6),
      'hurt': anim('Hurt', 'Armored Skeleton-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Armored Skeleton-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Armored Skeleton-Attack02_Effect', 6),
    }
  },
  {
    id: 'elite-orc',
    name: 'Elite Orc',
    folder: 'Elite Orc/Elite Orc',
    effectsFolder: 'Elite Orc/Elite Orc(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Elite Orc-Idle', 6, true),
      'walk': anim('Walk', 'Elite Orc-Walk', 6, true),
      'attack01': anim('Attack01', 'Elite Orc-Attack01', 6),
      'attack02': anim('Attack02', 'Elite Orc-Attack02', 6),
      'attack03': anim('Attack03', 'Elite Orc-Attack03', 6),
      'death': anim('Death', 'Elite Orc-Death', 6),
      'hurt': anim('Hurt', 'Elite Orc-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Elite Orc-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Elite Orc-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Elite Orc-Attack03_Effect', 6),
    }
  },
  {
    id: 'greatsword-skeleton',
    name: 'Greatsword Skeleton',
    folder: 'Greatsword Skeleton/Greatsword Skeleton',
    effectsFolder: 'Greatsword Skeleton/Greatsword Skeleton(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Greatsword Skeleton-Idle', 6, true),
      'walk': anim('Walk', 'Greatsword Skeleton-Walk', 6, true),
      'attack01': anim('Attack01', 'Greatsword Skeleton-Attack01', 6),
      'attack02': anim('Attack02', 'Greatsword Skeleton-Attack02', 6),
      'attack03': anim('Attack03', 'Greatsword Skeleton-Attack03', 6),
      'death': anim('Death', 'Greatsword Skeleton-Death', 6),
      'hurt': anim('Hurt', 'Greatsword Skeleton-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Greatsword Skeleton-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Greatsword Skeleton-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Greatsword Skeleton-Attack03_Effect', 6),
    }
  },
  {
    id: 'knight',
    name: 'Knight',
    folder: 'Knight/Knight',
    effectsFolder: 'Knight/Knight(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Knight-Idle', 6, true),
      'walk': anim('Walk', 'Knight-Walk', 6, true),
      'attack01': anim('Attack01', 'Knight-Attack01', 6),
      'attack02': anim('Attack02', 'Knight-Attack02', 6),
      'attack03': anim('Attack03', 'Knight-Attack03', 6),
      'block': anim('Block', 'Knight-Block', 4),
      'death': anim('Death', 'Knight-Death', 6),
      'hurt': anim('Hurt', 'Knight-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Knight-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Knight-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Knight-Attack03_Effect', 6),
    }
  },
  {
    id: 'knight-templar',
    name: 'Knight Templar',
    folder: 'Knight Templar/Knight Templar',
    effectsFolder: 'Knight Templar/Knight Templar(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Knight Templar-Idle', 6, true),
      'walk01': anim('Walk01', 'Knight Templar-Walk01', 6, true),
      'walk02': anim('Walk02', 'Knight Templar-Walk02', 6, true),
      'attack01': anim('Attack01', 'Knight Templar-Attack01', 6),
      'attack02': anim('Attack02', 'Knight Templar-Attack02', 6),
      'attack03': anim('Attack03', 'Knight Templar-Attack03', 6),
      'block': anim('Block', 'Knight Templar-Block', 4),
      'death': anim('Death', 'Knight Templar-Death', 6),
      'hurt': anim('Hurt', 'Knight Templar-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Knight Templar-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Knight Templar-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Knight Templar-Attack03_Effect', 6),
    }
  },
  {
    id: 'lancer',
    name: 'Lancer',
    folder: 'Lancer/Lancer',
    effectsFolder: 'Lancer/Lancer(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Lancer-Idle', 6, true),
      'walk01': anim('Walk01', 'Lancer-Walk01', 6, true),
      'walk02': anim('Walk02', 'Lancer-Walk02', 6, true),
      'attack01': anim('Attack01', 'Lancer-Attack01', 6),
      'attack02': anim('Attack02', 'Lancer-Attack02', 6),
      'attack03': anim('Attack03', 'Lancer-Attack03', 6),
      'death': anim('Death', 'Lancer-Death', 6),
      'hurt': anim('Hurt', 'Lancer-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Lancer-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Lancer-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Lancer-Attack03_Effect', 6),
    }
  },
  {
    id: 'orc',
    name: 'Orc',
    folder: 'Orc/Orc',
    effectsFolder: 'Orc/Orc(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Orc-Idle', 6, true),
      'walk': anim('Walk', 'Orc-Walk', 6, true),
      'attack01': anim('Attack01', 'Orc-Attack01', 6),
      'attack02': anim('Attack02', 'Orc-Attack02', 6),
      'death': anim('Death', 'Orc-Death', 6),
      'hurt': anim('Hurt', 'Orc-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Orc-attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Orc-attack02_Effect', 6),
    }
  },
  {
    id: 'orc-rider',
    name: 'Orc Rider',
    folder: 'Orc rider/Orc rider',
    effectsFolder: 'Orc rider/Orc rider(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Orc rider-Idle', 6, true),
      'walk': anim('Walk', 'Orc rider-Walk', 6, true),
      'attack01': anim('Attack01', 'Orc rider-Attack01', 6),
      'attack02': anim('Attack02', 'Orc rider-Attack02', 6),
      'attack03': anim('Attack03', 'Orc rider-Attack03', 6),
      'block': anim('Block', 'Orc rider-Block', 4),
      'death': anim('Death', 'Orc rider-Death', 6),
      'hurt': anim('Hurt', 'Orc rider-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Orc rider-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Orc rider-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Orc rider-Attack03_Effect', 6),
    }
  },
  {
    id: 'priest',
    name: 'Priest',
    folder: 'Priest/Priest',
    effectsFolder: 'Priest/Priest(Split Effects)',
    projectileFolder: 'Priest/Magic(projectile)',
    animations: {
      'idle': anim('Idle', 'Priest-Idle', 6, true),
      'walk': anim('Walk', 'Priest-Walk', 6, true),
      'attack': anim('Attack', 'Priest-Attack', 6),
      'heal': anim('Heal', 'Priest-Heal', 6),
      'death': anim('Death', 'Priest-Death', 6),
      'hurt': anim('Hurt', 'Priest-Hurt', 4),
      'attack_effect': effect('Attack Effect', 'Priest-Attack_Effect', 6),
      'heal_effect': effect('Heal Effect', 'Priest-Heal_Effect', 6),
    }
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    folder: 'Skeleton/Skeleton',
    effectsFolder: 'Skeleton/Skeleton(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Skeleton-Idle', 6, true),
      'walk': anim('Walk', 'Skeleton-Walk', 6, true),
      'attack01': anim('Attack01', 'Skeleton-Attack01', 6),
      'attack02': anim('Attack02', 'Skeleton-Attack02', 6),
      'block': anim('Block', 'Skeleton-Block', 4),
      'death': anim('Death', 'Skeleton-Death', 6),
      'hurt': anim('Hurt', 'Skeleton-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Skeleton-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Skeleton-Attack02_Effect', 6),
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
      'walk': anim('Walk', 'Skeleton Archer-Walk', 6, true),
      'attack': anim('Attack', 'Skeleton Archer-Attack', 6),
      'death': anim('Death', 'Skeleton Archer-Death', 6),
      'hurt': anim('Hurt', 'Skeleton Archer-Hurt', 4),
      'attack_effect': effect('Attack Effect', 'Skeleton Archer-Attack_Effect', 6),
      'arrow': projectile('Arrow', 'Arrow03(100x100)', 4),
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
      'attack01': anim('Attack01', 'Slime-Attack01', 6),
      'attack02': anim('Attack02', 'Slime-Attack02', 6),
      'death': anim('Death', 'Slime-Death', 6),
      'hurt': anim('Hurt', 'Slime-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Slime-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Slime-Attack02_Effect', 6),
    }
  },
  {
    id: 'soldier',
    name: 'Soldier',
    folder: 'Soldier/Soldier',
    effectsFolder: 'Soldier/Soldier(Split Effects)',
    projectileFolder: 'Soldier/Arrow(projectile)',
    animations: {
      'idle': anim('Idle', 'Soldier-Idle', 6, true),
      'walk': anim('Walk', 'Soldier-Walk', 6, true),
      'attack01': anim('Attack01', 'Soldier-Attack01', 6),
      'attack02': anim('Attack02', 'Soldier-Attack02', 6),
      'attack03': anim('Attack03', 'Soldier-Attack03', 6),
      'death': anim('Death', 'Soldier-Death', 6),
      'hurt': anim('Hurt', 'Soldier-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Soldier-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Soldier-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Soldier-Attack03_Effect', 6),
      'arrow': projectile('Arrow', 'Arrow01(100x100)', 4),
    }
  },
  {
    id: 'swordsman',
    name: 'Swordsman',
    folder: 'Swordsman/Swordsman',
    effectsFolder: 'Swordsman/Swordsman(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Swordsman-Idle', 6, true),
      'walk': anim('Walk', 'Swordsman-Walk', 6, true),
      'attack01': anim('Attack01', 'Swordsman-Attack01', 6),
      'attack02': anim('Attack02', 'Swordsman-Attack02', 6),
      'attack03': anim('Attack03', 'Swordsman-Attack3', 6),
      'death': anim('Death', 'Swordsman-Death', 6),
      'hurt': anim('Hurt', 'Swordsman-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Swordsman-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Swordsman-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Swordsman-Attack3_Effect', 6),
    }
  },
  {
    id: 'werebear',
    name: 'Werebear',
    folder: 'Werebear/Werebear',
    effectsFolder: 'Werebear/Werebear(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Werebear-Idle', 6, true),
      'walk': anim('Walk', 'Werebear-Walk', 6, true),
      'attack01': anim('Attack01', 'Werebear-Attack01', 6),
      'attack02': anim('Attack02', 'Werebear-Attack02', 6),
      'attack03': anim('Attack03', 'Werebear-Attack03', 6),
      'death': anim('Death', 'Werebear-Death', 6),
      'hurt': anim('Hurt', 'Werebear-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Werebear-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Werebear-Attack02_Effect', 6),
      'attack03_effect': effect('Attack03 Effect', 'Werebear-Attack03_Effect', 6),
    }
  },
  {
    id: 'werewolf',
    name: 'Werewolf',
    folder: 'Werewolf/Werewolf',
    effectsFolder: 'Werewolf/Werewolf(Split Effects)',
    animations: {
      'idle': anim('Idle', 'Werewolf-Idle', 6, true),
      'walk': anim('Walk', 'Werewolf-Walk', 6, true),
      'attack01': anim('Attack01', 'Werewolf-Attack01', 6),
      'attack02': anim('Attack02', 'Werewolf-Attack02', 6),
      'death': anim('Death', 'Werewolf-Death', 6),
      'hurt': anim('Hurt', 'Werewolf-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Werewolf-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Werewolf-Attack02_Effect', 6),
    }
  },
  {
    id: 'wizard',
    name: 'Wizard',
    folder: 'Wizard/Wizard',
    effectsFolder: 'Wizard/Wizard(Split Effects)',
    projectileFolder: 'Wizard/Magic(projectile)',
    animations: {
      'idle': anim('Idle', 'Wizard-Idle', 6, true),
      'walk': anim('Walk', 'Wizard-Walk', 6, true),
      'attack01': anim('Attack01', 'Wizard-Attack01', 6),
      'attack02': anim('Attack02', 'Wizard-Attack02', 6),
      'death': anim('Death', 'Wizard-DEATH', 6),
      'hurt': anim('Hurt', 'Wizard-Hurt', 4),
      'attack01_effect': effect('Attack01 Effect', 'Wizard-Attack01_Effect', 6),
      'attack02_effect': effect('Attack02 Effect', 'Wizard-Attack02_Effect', 6),
    }
  }
];

export function getSpriteUrl(character: CharacterSprite, animationKey: string): string {
  const animation = character.animations[animationKey];
  if (!animation) return '';
  
  if (animation.isEffect && character.effectsFolder) {
    return `/sprites/characters/${character.effectsFolder}/${animation.fileName}.png`;
  }
  
  if (animation.isProjectile && character.projectileFolder) {
    return `/sprites/characters/${character.projectileFolder}/${animation.fileName}.png`;
  }
  
  return `/sprites/characters/${character.folder}/${animation.fileName}.png`;
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
