import * as YUKA from 'yuka';
import * as THREE from 'three';

export const FACTION_COLORS = {
  crusade: { primary: 0xc9a227, secondary: 0x8b0000, accent: 0xffd700 },
  fabled: { primary: 0x228b22, secondary: 0x4169e1, accent: 0x00ff7f },
  legion: { primary: 0x4a0080, secondary: 0x1a1a1a, accent: 0x9400d3 }
} as const;

export const RACE_TINTS = {
  human: 0xf5deb3,
  barbarian: 0xcd853f,
  dwarf: 0xd2691e,
  elf: 0xfaf0e6,
  orc: 0x6b8e23,
  undead: 0x708090
} as const;

export type Faction = keyof typeof FACTION_COLORS;
export type Race = keyof typeof RACE_TINTS;

export interface CharacterEntity {
  position: YUKA.Vector3;
  rotation: YUKA.Quaternion;
  mesh?: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  currentAction?: THREE.AnimationAction;
  stateMachine?: YUKA.StateMachine<CharacterEntity>;
  speed: number;
  faction: Faction;
  race: Race;
  health: number;
  maxHealth: number;
  isAttacking: boolean;
  isDead: boolean;
}

class IdleState extends YUKA.State<CharacterEntity> {
  enter(entity: CharacterEntity) {
    crossfadeToAction(entity, 'idle', 0.3);
  }

  execute(entity: CharacterEntity) {
    if (entity.isDead) {
      entity.stateMachine?.changeTo('dead');
      return;
    }
    if (entity.isAttacking) {
      entity.stateMachine?.changeTo('attack');
      return;
    }
    if (entity.speed > 0.1 && entity.speed < 2) {
      entity.stateMachine?.changeTo('walk');
    } else if (entity.speed >= 2) {
      entity.stateMachine?.changeTo('run');
    }
  }

  exit(_entity: CharacterEntity) {}
}

class WalkState extends YUKA.State<CharacterEntity> {
  enter(entity: CharacterEntity) {
    crossfadeToAction(entity, 'walk', 0.3);
  }

  execute(entity: CharacterEntity) {
    if (entity.isDead) {
      entity.stateMachine?.changeTo('dead');
      return;
    }
    if (entity.isAttacking) {
      entity.stateMachine?.changeTo('attack');
      return;
    }
    if (entity.speed < 0.1) {
      entity.stateMachine?.changeTo('idle');
    } else if (entity.speed >= 2) {
      entity.stateMachine?.changeTo('run');
    }
  }

  exit(_entity: CharacterEntity) {}
}

class RunState extends YUKA.State<CharacterEntity> {
  enter(entity: CharacterEntity) {
    crossfadeToAction(entity, 'run', 0.2);
  }

  execute(entity: CharacterEntity) {
    if (entity.isDead) {
      entity.stateMachine?.changeTo('dead');
      return;
    }
    if (entity.isAttacking) {
      entity.stateMachine?.changeTo('attack');
      return;
    }
    if (entity.speed < 0.1) {
      entity.stateMachine?.changeTo('idle');
    } else if (entity.speed < 2) {
      entity.stateMachine?.changeTo('walk');
    }
  }

  exit(_entity: CharacterEntity) {}
}

class AttackState extends YUKA.State<CharacterEntity> {
  private attackDuration = 0;
  private attackTime = 1.0;

  enter(entity: CharacterEntity) {
    crossfadeToAction(entity, 'attack', 0.15);
    this.attackDuration = 0;
    const action = entity.actions.get('attack');
    if (action) {
      this.attackTime = action.getClip().duration;
    }
  }

  execute(entity: CharacterEntity) {
    if (entity.isDead) {
      entity.stateMachine?.changeTo('dead');
      return;
    }
    this.attackDuration += 0.016;
    if (this.attackDuration >= this.attackTime * 0.9) {
      entity.isAttacking = false;
      entity.stateMachine?.changeTo('idle');
    }
  }

  exit(_entity: CharacterEntity) {
    _entity.isAttacking = false;
  }
}

class DeadState extends YUKA.State<CharacterEntity> {
  enter(entity: CharacterEntity) {
    crossfadeToAction(entity, 'death', 0.3);
    const action = entity.actions.get('death');
    if (action) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
  }

  execute(_entity: CharacterEntity) {}

  exit(_entity: CharacterEntity) {}
}

class HitState extends YUKA.State<CharacterEntity> {
  private hitDuration = 0;

  enter(entity: CharacterEntity) {
    crossfadeToAction(entity, 'hit', 0.1);
    this.hitDuration = 0;
  }

  execute(entity: CharacterEntity) {
    if (entity.isDead) {
      entity.stateMachine?.changeTo('dead');
      return;
    }
    this.hitDuration += 0.016;
    if (this.hitDuration >= 0.5) {
      entity.stateMachine?.changeTo('idle');
    }
  }

  exit(_entity: CharacterEntity) {}
}

function crossfadeToAction(entity: CharacterEntity, actionName: string, duration: number) {
  const newAction = entity.actions.get(actionName);
  if (!newAction) return;

  if (entity.currentAction && entity.currentAction !== newAction) {
    entity.currentAction.fadeOut(duration);
  }

  newAction.reset().fadeIn(duration).play();
  entity.currentAction = newAction;
}

export function createCharacterEntity(
  faction: Faction,
  race: Race,
  position: THREE.Vector3 = new THREE.Vector3()
): CharacterEntity {
  const entity: CharacterEntity = {
    position: new YUKA.Vector3(position.x, position.y, position.z),
    rotation: new YUKA.Quaternion(),
    actions: new Map(),
    speed: 0,
    faction,
    race,
    health: 100,
    maxHealth: 100,
    isAttacking: false,
    isDead: false
  };

  const stateMachine = new YUKA.StateMachine(entity);
  stateMachine.add('idle', new IdleState());
  stateMachine.add('walk', new WalkState());
  stateMachine.add('run', new RunState());
  stateMachine.add('attack', new AttackState());
  stateMachine.add('dead', new DeadState());
  stateMachine.add('hit', new HitState());
  stateMachine.changeTo('idle');
  entity.stateMachine = stateMachine;

  return entity;
}

export function attachMeshToEntity(
  entity: CharacterEntity,
  mesh: THREE.Object3D,
  animations: THREE.AnimationClip[]
) {
  entity.mesh = mesh;
  entity.mixer = new THREE.AnimationMixer(mesh);

  const animationNames = ['idle', 'walk', 'run', 'attack', 'death', 'hit'];
  
  for (const clip of animations) {
    const clipNameLower = clip.name.toLowerCase();
    for (const name of animationNames) {
      if (clipNameLower.includes(name)) {
        const action = entity.mixer.clipAction(clip);
        entity.actions.set(name, action);
        break;
      }
    }
  }

  if (!entity.actions.has('idle') && animations.length > 0) {
    entity.actions.set('idle', entity.mixer.clipAction(animations[0]));
  }

  applyCharacterColors(entity);
  
  const idleAction = entity.actions.get('idle');
  if (idleAction) {
    idleAction.play();
    entity.currentAction = idleAction;
  }
}

export function applyCharacterColors(entity: CharacterEntity) {
  if (!entity.mesh) return;

  const factionColor = FACTION_COLORS[entity.faction];
  const raceTint = RACE_TINTS[entity.race];

  entity.mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      
      materials.forEach((mat, index) => {
        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
          const clonedMat = mat.clone();
          
          const meshName = child.name.toLowerCase();
          if (meshName.includes('armor') || meshName.includes('cloth') || meshName.includes('body')) {
            clonedMat.color.setHex(factionColor.primary);
          } else if (meshName.includes('skin') || meshName.includes('face')) {
            clonedMat.color.setHex(raceTint);
          } else if (meshName.includes('accent') || meshName.includes('trim')) {
            clonedMat.color.setHex(factionColor.accent);
          }
          
          if (Array.isArray(child.material)) {
            child.material[index] = clonedMat;
          } else {
            child.material = clonedMat;
          }
        }
      });
    }
  });
}

export function updateCharacterEntity(entity: CharacterEntity, delta: number) {
  if (entity.mixer) {
    entity.mixer.update(delta);
  }

  if (entity.mesh) {
    entity.mesh.position.set(
      entity.position.x,
      entity.position.y,
      entity.position.z
    );
    entity.mesh.quaternion.set(
      entity.rotation.x,
      entity.rotation.y,
      entity.rotation.z,
      entity.rotation.w
    );
  }
}

export function triggerAttack(entity: CharacterEntity) {
  if (!entity.isDead && !entity.isAttacking) {
    entity.isAttacking = true;
  }
}

export function takeDamage(entity: CharacterEntity, damage: number) {
  if (entity.isDead) return;

  entity.health = Math.max(0, entity.health - damage);
  
  if (entity.health <= 0) {
    entity.isDead = true;
    entity.stateMachine?.changeTo('dead');
  } else {
    entity.stateMachine?.changeTo('hit');
  }
}

export function healCharacter(entity: CharacterEntity, amount: number) {
  if (entity.isDead) return;
  entity.health = Math.min(entity.maxHealth, entity.health + amount);
}

export function setCharacterSpeed(entity: CharacterEntity, speed: number) {
  entity.speed = speed;
}

export class CharacterManager {
  private time: YUKA.Time;
  private characters: Map<string, CharacterEntity>;

  constructor() {
    this.time = new YUKA.Time();
    this.characters = new Map();
  }

  addCharacter(id: string, entity: CharacterEntity) {
    this.characters.set(id, entity);
  }

  removeCharacter(id: string) {
    const entity = this.characters.get(id);
    if (entity) {
      this.characters.delete(id);
      
      if (entity.mesh && entity.mesh.parent) {
        entity.mesh.parent.remove(entity.mesh);
      }
      if (entity.mixer) {
        entity.mixer.stopAllAction();
      }
    }
  }

  getCharacter(id: string): CharacterEntity | undefined {
    return this.characters.get(id);
  }

  getAllCharacters(): CharacterEntity[] {
    return Array.from(this.characters.values());
  }

  update(): number {
    const delta = this.time.update().getDelta();
    
    const entities = Array.from(this.characters.values());
    for (const entity of entities) {
      entity.stateMachine?.update();
      updateCharacterEntity(entity, delta);
    }
    
    return delta;
  }

  dispose() {
    const ids = Array.from(this.characters.keys());
    for (const id of ids) {
      this.removeCharacter(id);
    }
    this.characters.clear();
  }
}

export function createHealthBar(entity: CharacterEntity): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, 64, 8);
  
  const healthPercent = entity.health / entity.maxHealth;
  const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillStyle = healthColor;
  ctx.fillRect(1, 1, 62 * healthPercent, 6);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1, 0.125, 1);
  
  return sprite;
}

export function updateHealthBar(sprite: THREE.Sprite, entity: CharacterEntity) {
  const material = sprite.material as THREE.SpriteMaterial;
  if (material.map) {
    const canvas = (material.map.image as HTMLCanvasElement);
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 64, 8);
    
    const healthPercent = entity.health / entity.maxHealth;
    const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.fillRect(1, 1, 62 * healthPercent, 6);
    
    material.map.needsUpdate = true;
  }
}
