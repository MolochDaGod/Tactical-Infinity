export type WeaponAnimSet = 'unarmed' | 'longbow' | 'rifle' | 'pistol' | 'magic' | 'melee_1h' | 'melee_2h' | 'dualwield';
export type LocomotionStyle = 'base' | 'rifle' | 'pistol' | 'longbow' | 'magic';
export type CreatureType = 'mutant';
export type RigSize = 'medium' | 'large';

const ANIM_BASE = '/animations';

export interface AnimationClipRef {
  name: string;
  path: string;
  format: 'fbx' | 'glb';
  clipName?: string;
  loop?: boolean;
  speed?: number;
  blendWeight?: number;
}

export interface LocomotionSet {
  idle: AnimationClipRef;
  walk: DirectionalAnimSet;
  run: DirectionalAnimSet;
  sprint?: DirectionalAnimSet;
  crouch?: CrouchAnimSet;
  jump?: JumpAnimSet;
  turns?: TurnAnimSet;
  strafe?: StrafeAnimSet;
}

export interface DirectionalAnimSet {
  forward: AnimationClipRef;
  backward?: AnimationClipRef;
  left?: AnimationClipRef;
  right?: AnimationClipRef;
  forwardLeft?: AnimationClipRef;
  forwardRight?: AnimationClipRef;
  backwardLeft?: AnimationClipRef;
  backwardRight?: AnimationClipRef;
  stop?: AnimationClipRef;
}

export interface CrouchAnimSet {
  idle: AnimationClipRef;
  walkForward?: AnimationClipRef;
  walkBackward?: AnimationClipRef;
  walkLeft?: AnimationClipRef;
  walkRight?: AnimationClipRef;
  walkForwardLeft?: AnimationClipRef;
  walkForwardRight?: AnimationClipRef;
  walkBackwardLeft?: AnimationClipRef;
  walkBackwardRight?: AnimationClipRef;
}

export interface JumpAnimSet {
  start?: AnimationClipRef;
  loop?: AnimationClipRef;
  land?: AnimationClipRef;
  up?: AnimationClipRef;
  down?: AnimationClipRef;
  full?: AnimationClipRef;
  fullLong?: AnimationClipRef;
  runningJump?: AnimationClipRef;
  runningLand?: AnimationClipRef;
}

export interface TurnAnimSet {
  left90?: AnimationClipRef;
  right90?: AnimationClipRef;
  left?: AnimationClipRef;
  right?: AnimationClipRef;
}

export interface StrafeAnimSet {
  leftRun?: AnimationClipRef;
  rightRun?: AnimationClipRef;
  leftWalk?: AnimationClipRef;
  rightWalk?: AnimationClipRef;
}

export interface RangedCombatSet {
  aim?: AnimationClipRef;
  aimIdle?: AnimationClipRef;
  shoot?: AnimationClipRef;
  shooting?: AnimationClipRef;
  reload?: AnimationClipRef;
  draw?: AnimationClipRef;
  drawUp?: AnimationClipRef;
  release?: AnimationClipRef;
  releaseUp?: AnimationClipRef;
  bowIdle?: AnimationClipRef;
}

export interface MagicCombatSet {
  raise?: AnimationClipRef;
  shoot?: AnimationClipRef;
  spellcast?: AnimationClipRef;
  spellcastLong?: AnimationClipRef;
  summon?: AnimationClipRef;
}

export interface MeleeCombatSet {
  attack1?: AnimationClipRef;
  attack2?: AnimationClipRef;
  attack3?: AnimationClipRef;
  idle?: AnimationClipRef;
  block?: AnimationClipRef;
  blockAttack?: AnimationClipRef;
  blockHit?: AnimationClipRef;
  blocking?: AnimationClipRef;
}

export interface DeathAnimSet {
  deathA?: AnimationClipRef;
  deathAPose?: AnimationClipRef;
  deathB?: AnimationClipRef;
  deathBPose?: AnimationClipRef;
  hitA?: AnimationClipRef;
  hitB?: AnimationClipRef;
}

export interface ActionAdventureSet {
  coverToStand: AnimationClipRef;
  standToCover: AnimationClipRef;
  crouchSneakLeft: AnimationClipRef;
  crouchSneakRight: AnimationClipRef;
  leftCoverSneak: AnimationClipRef;
  rightCoverSneak: AnimationClipRef;
  fallingIdle: AnimationClipRef;
  fallingToRoll: AnimationClipRef;
  hardLanding: AnimationClipRef;
  jumpingUp: AnimationClipRef;
  runToStop: AnimationClipRef;
  idleVariants: AnimationClipRef[];
}

export interface ToolAnimSet {
  chop?: AnimationClipRef;
  chopping?: AnimationClipRef;
  dig?: AnimationClipRef;
  digging?: AnimationClipRef;
  hammer?: AnimationClipRef;
  hammering?: AnimationClipRef;
  pickaxe?: AnimationClipRef;
  pickaxing?: AnimationClipRef;
  saw?: AnimationClipRef;
  sawing?: AnimationClipRef;
  lockpick?: AnimationClipRef;
  lockpicking?: AnimationClipRef;
}

export interface FishingAnimSet {
  cast?: AnimationClipRef;
  idle?: AnimationClipRef;
  bite?: AnimationClipRef;
  reeling?: AnimationClipRef;
  struggling?: AnimationClipRef;
  tug?: AnimationClipRef;
  catch?: AnimationClipRef;
}

export interface SimulationAnimSet {
  cheering?: AnimationClipRef;
  waving?: AnimationClipRef;
  pushUps?: AnimationClipRef;
  sitUps?: AnimationClipRef;
  lieDown?: AnimationClipRef;
  lieIdle?: AnimationClipRef;
  lieStandUp?: AnimationClipRef;
  sitChairDown?: AnimationClipRef;
  sitChairIdle?: AnimationClipRef;
  sitChairStandUp?: AnimationClipRef;
  sitFloorDown?: AnimationClipRef;
  sitFloorIdle?: AnimationClipRef;
  sitFloorStandUp?: AnimationClipRef;
  flexing?: AnimationClipRef;
}

export interface CreatureAnimSet {
  idle: AnimationClipRef;
  breathingIdle?: AnimationClipRef;
  walk: AnimationClipRef;
  run: AnimationClipRef;
  attack: AnimationClipRef;
  death: AnimationClipRef;
  jump?: AnimationClipRef;
  turnLeft?: AnimationClipRef;
  turnRight?: AnimationClipRef;
  taunt?: AnimationClipRef;
}

export interface SkeletonAnimSet {
  idle: AnimationClipRef;
  walking: AnimationClipRef;
  awakenFloor: AnimationClipRef;
  awakenFloorLong: AnimationClipRef;
  awakenStanding: AnimationClipRef;
  death: AnimationClipRef;
  deathPose: AnimationClipRef;
  deathResurrect: AnimationClipRef;
  inactiveFloorPose: AnimationClipRef;
  inactiveStandingPose: AnimationClipRef;
  spawnGround: AnimationClipRef;
  taunt: AnimationClipRef;
  tauntLonger: AnimationClipRef;
}

function fbx(dir: string, file: string, opts?: Partial<AnimationClipRef>): AnimationClipRef {
  return { name: file.replace('.fbx', ''), path: `${ANIM_BASE}/${dir}/${file}`, format: 'fbx', ...opts };
}

function glbClip(dir: string, file: string, clipName: string, opts?: Partial<AnimationClipRef>): AnimationClipRef {
  return { name: clipName, path: `${ANIM_BASE}/${dir}/${file}`, format: 'glb', clipName, ...opts };
}

export const LOCOMOTION_SETS: Record<LocomotionStyle, LocomotionSet> = {
  base: {
    idle: fbx('locomotion/base', 'idle.fbx', { loop: true }),
    walk: {
      forward: fbx('locomotion/base', 'walking.fbx', { loop: true }),
    },
    run: {
      forward: fbx('locomotion/base', 'running.fbx', { loop: true }),
    },
    jump: {
      full: fbx('locomotion/base', 'jump.fbx'),
    },
    turns: {
      left90: fbx('locomotion/base', 'left turn 90.fbx'),
      right90: fbx('locomotion/base', 'right turn 90.fbx'),
      left: fbx('locomotion/base', 'left turn.fbx'),
      right: fbx('locomotion/base', 'right turn.fbx'),
    },
    strafe: {
      leftRun: fbx('locomotion/base', 'left strafe.fbx', { loop: true }),
      rightRun: fbx('locomotion/base', 'right strafe.fbx', { loop: true }),
      leftWalk: fbx('locomotion/base', 'left strafe walking.fbx', { loop: true }),
      rightWalk: fbx('locomotion/base', 'right strafe walking.fbx', { loop: true }),
    },
  },

  rifle: {
    idle: fbx('locomotion/rifle', 'idle.fbx', { loop: true }),
    walk: {
      forward: fbx('locomotion/rifle', 'walk forward.fbx', { loop: true }),
      backward: fbx('locomotion/rifle', 'walk backward.fbx', { loop: true }),
      left: fbx('locomotion/rifle', 'walk left.fbx', { loop: true }),
      right: fbx('locomotion/rifle', 'walk right.fbx', { loop: true }),
      forwardLeft: fbx('locomotion/rifle', 'walk forward left.fbx', { loop: true }),
      forwardRight: fbx('locomotion/rifle', 'walk forward right.fbx', { loop: true }),
      backwardLeft: fbx('locomotion/rifle', 'walk backward left.fbx', { loop: true }),
      backwardRight: fbx('locomotion/rifle', 'walk backward right.fbx', { loop: true }),
    },
    run: {
      forward: fbx('locomotion/rifle', 'run forward.fbx', { loop: true }),
      backward: fbx('locomotion/rifle', 'run backward.fbx', { loop: true }),
      left: fbx('locomotion/rifle', 'run left.fbx', { loop: true }),
      right: fbx('locomotion/rifle', 'run right.fbx', { loop: true }),
      forwardLeft: fbx('locomotion/rifle', 'run forward left.fbx', { loop: true }),
      forwardRight: fbx('locomotion/rifle', 'run forward right.fbx', { loop: true }),
      backwardLeft: fbx('locomotion/rifle', 'run backward left.fbx', { loop: true }),
      backwardRight: fbx('locomotion/rifle', 'run backward right.fbx', { loop: true }),
    },
    sprint: {
      forward: fbx('locomotion/rifle', 'sprint forward.fbx', { loop: true }),
      backward: fbx('locomotion/rifle', 'sprint backward.fbx', { loop: true }),
      left: fbx('locomotion/rifle', 'sprint left.fbx', { loop: true }),
      right: fbx('locomotion/rifle', 'sprint right.fbx', { loop: true }),
      forwardLeft: fbx('locomotion/rifle', 'sprint forward left.fbx', { loop: true }),
      forwardRight: fbx('locomotion/rifle', 'sprint forward right.fbx', { loop: true }),
      backwardLeft: fbx('locomotion/rifle', 'sprint backward left.fbx', { loop: true }),
      backwardRight: fbx('locomotion/rifle', 'sprint backward right.fbx', { loop: true }),
    },
    crouch: {
      idle: fbx('locomotion/rifle', 'idle crouching.fbx', { loop: true }),
      walkForward: fbx('locomotion/rifle', 'walk crouching forward.fbx', { loop: true }),
      walkBackward: fbx('locomotion/rifle', 'walk crouching backward.fbx', { loop: true }),
      walkLeft: fbx('locomotion/rifle', 'walk crouching left.fbx', { loop: true }),
      walkRight: fbx('locomotion/rifle', 'walk crouching right.fbx', { loop: true }),
      walkForwardLeft: fbx('locomotion/rifle', 'walk crouching forward left.fbx', { loop: true }),
      walkForwardRight: fbx('locomotion/rifle', 'walk crouching forward right.fbx', { loop: true }),
      walkBackwardLeft: fbx('locomotion/rifle', 'walk crouching backward left.fbx', { loop: true }),
      walkBackwardRight: fbx('locomotion/rifle', 'walk crouching backward right.fbx', { loop: true }),
    },
    jump: {
      up: fbx('locomotion/rifle', 'jump up.fbx'),
      loop: fbx('locomotion/rifle', 'jump loop.fbx', { loop: true }),
      down: fbx('locomotion/rifle', 'jump down.fbx'),
    },
    turns: {
      left90: fbx('locomotion/rifle', 'turn 90 left.fbx'),
      right90: fbx('locomotion/rifle', 'turn 90 right.fbx'),
    },
  },

  pistol: {
    idle: fbx('locomotion/pistol', 'pistol idle.fbx', { loop: true }),
    walk: {
      forward: fbx('locomotion/pistol', 'pistol walk.fbx', { loop: true }),
      backward: fbx('locomotion/pistol', 'pistol walk backward.fbx', { loop: true }),
    },
    run: {
      forward: fbx('locomotion/pistol', 'pistol run.fbx', { loop: true }),
      backward: fbx('locomotion/pistol', 'pistol run backward.fbx', { loop: true }),
    },
    crouch: {
      idle: fbx('locomotion/pistol', 'pistol kneeling idle.fbx', { loop: true }),
    },
    jump: {
      full: fbx('locomotion/pistol', 'pistol jump.fbx'),
    },
  },

  longbow: {
    idle: fbx('locomotion/longbow', 'standing idle 01.fbx', { loop: true }),
    walk: {
      forward: fbx('locomotion/longbow', 'standing walk forward.fbx', { loop: true }),
      backward: fbx('locomotion/longbow', 'standing walk back.fbx', { loop: true }),
      left: fbx('locomotion/longbow', 'standing walk left.fbx', { loop: true }),
      right: fbx('locomotion/longbow', 'standing walk right.fbx', { loop: true }),
    },
    run: {
      forward: fbx('locomotion/longbow', 'standing run forward.fbx', { loop: true }),
      backward: fbx('locomotion/longbow', 'standing run back.fbx', { loop: true }),
      left: fbx('locomotion/longbow', 'standing run left.fbx', { loop: true }),
      right: fbx('locomotion/longbow', 'standing run right.fbx', { loop: true }),
      stop: fbx('locomotion/longbow', 'standing run forward stop.fbx'),
    },
    turns: {
      left90: fbx('locomotion/longbow', 'standing turn 90 left.fbx'),
      right90: fbx('locomotion/longbow', 'standing turn 90 right.fbx'),
    },
  },

  magic: {
    idle: fbx('locomotion/magic', 'standing idle.fbx', { loop: true }),
    walk: {
      forward: fbx('locomotion/magic', 'Standing Walk Forward.fbx', { loop: true }),
      backward: fbx('locomotion/magic', 'Standing Walk Back.fbx', { loop: true }),
      left: fbx('locomotion/magic', 'Standing Walk Left.fbx', { loop: true }),
      right: fbx('locomotion/magic', 'Standing Walk Right.fbx', { loop: true }),
    },
    run: {
      forward: fbx('locomotion/magic', 'Standing Run Forward.fbx', { loop: true }),
      backward: fbx('locomotion/magic', 'Standing Run Back.fbx', { loop: true }),
      left: fbx('locomotion/magic', 'Standing Run Left.fbx', { loop: true }),
      right: fbx('locomotion/magic', 'Standing Run Right.fbx', { loop: true }),
    },
    sprint: {
      forward: fbx('locomotion/magic', 'Standing Sprint Forward.fbx', { loop: true }),
    },
    jump: {
      full: fbx('locomotion/magic', 'Standing Jump.fbx'),
      runningJump: fbx('locomotion/magic', 'Standing Jump Running.fbx'),
      runningLand: fbx('locomotion/magic', 'Standing Jump Running Landing.fbx'),
      land: fbx('locomotion/magic', 'Standing Land To Standing Idle.fbx'),
    },
    turns: {
      left90: fbx('locomotion/magic', 'Standing Turn Left 90.fbx'),
      right90: fbx('locomotion/magic', 'Standing Turn Right 90.fbx'),
    },
  },
};

export const RIFLE_DEATH_ANIMS = {
  crouchingHeadshotFront: fbx('locomotion/rifle', 'death crouching headshot front.fbx'),
  fromBackHeadshot: fbx('locomotion/rifle', 'death from back headshot.fbx'),
  fromFrontHeadshot: fbx('locomotion/rifle', 'death from front headshot.fbx'),
  fromRight: fbx('locomotion/rifle', 'death from right.fbx'),
  fromBack: fbx('locomotion/rifle', 'death from the back.fbx'),
  fromFront: fbx('locomotion/rifle', 'death from the front.fbx'),
};

export const RIFLE_AIMING = {
  idleAiming: fbx('locomotion/rifle', 'idle aiming.fbx', { loop: true }),
  crouchAiming: fbx('locomotion/rifle', 'idle crouching aiming.fbx', { loop: true }),
  crouchTurnLeft: fbx('locomotion/rifle', 'crouching turn 90 left.fbx'),
  crouchTurnRight: fbx('locomotion/rifle', 'crouching turn 90 right.fbx'),
};

export const PISTOL_EXTRAS = {
  walkArcLeft: fbx('locomotion/pistol', 'pistol walk arc.fbx', { loop: true }),
  walkArcRight: fbx('locomotion/pistol', 'pistol walk arc (2).fbx', { loop: true }),
  walkBackwardArcLeft: fbx('locomotion/pistol', 'pistol walk backward arc.fbx', { loop: true }),
  walkBackwardArcRight: fbx('locomotion/pistol', 'pistol walk backward arc (2).fbx', { loop: true }),
  runArcLeft: fbx('locomotion/pistol', 'pistol run arc.fbx', { loop: true }),
  runArcRight: fbx('locomotion/pistol', 'pistol run arc (2).fbx', { loop: true }),
  runBackwardArcLeft: fbx('locomotion/pistol', 'pistol run backward arc.fbx', { loop: true }),
  runBackwardArcRight: fbx('locomotion/pistol', 'pistol run backward arc (2).fbx', { loop: true }),
  strafeLeft: fbx('locomotion/pistol', 'pistol strafe.fbx', { loop: true }),
  strafeRight: fbx('locomotion/pistol', 'pistol strafe (2).fbx', { loop: true }),
  standToKneel: fbx('locomotion/pistol', 'pistol stand to kneel.fbx'),
  kneelToStand: fbx('locomotion/pistol', 'pistol kneel to stand.fbx'),
};

const KK_MED = 'kaykit/medium';
const KK_LRG = 'kaykit/large';

export const KAYKIT_RANGED_COMBAT: Record<string, RangedCombatSet> = {
  oneHand: {
    aim: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_1H_Aiming', { loop: true }),
    shoot: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_1H_Shoot'),
    shooting: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_1H_Shooting', { loop: true }),
    reload: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_1H_Reload'),
  },
  twoHand: {
    aim: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_2H_Aiming', { loop: true }),
    shoot: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_2H_Shoot'),
    shooting: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_2H_Shooting', { loop: true }),
    reload: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_2H_Reload'),
  },
  bow: {
    aimIdle: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Bow_Aiming_Idle', { loop: true }),
    bowIdle: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Bow_Idle', { loop: true }),
    draw: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Bow_Draw'),
    drawUp: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Bow_Draw_Up'),
    release: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Bow_Release'),
    releaseUp: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Bow_Release_Up'),
  },
};

export const KAYKIT_MAGIC_COMBAT: MagicCombatSet = {
  raise: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Magic_Raise'),
  shoot: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Magic_Shoot'),
  spellcast: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Magic_Spellcasting'),
  spellcastLong: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Magic_Spellcasting_Long'),
  summon: glbClip(KK_MED, 'Rig_Medium_CombatRanged.glb', 'Ranged_Magic_Summon'),
};

export const KAYKIT_MELEE_MEDIUM: Record<string, MeleeCombatSet> = {
  oneHand: {
    attack1: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_1H_Attack_Chop'),
    attack2: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_1H_Attack_Slice_Diagonal'),
    attack3: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_1H_Attack_Stab'),
    block: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Block'),
    blockAttack: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Block_Attack'),
    blockHit: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Block_Hit'),
    blocking: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Blocking', { loop: true }),
  },
  twoHand: {
    attack1: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_2H_Attack_Chop'),
    attack2: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_2H_Attack_Slice'),
    attack3: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_2H_Attack_Spin'),
    idle: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_2H_Idle', { loop: true }),
  },
  dualwield: {
    attack1: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Dualwield_Attack_Chop'),
    attack2: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Dualwield_Attack_Slice'),
    attack3: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Dualwield_Attack_Stab'),
  },
  unarmed: {
    attack1: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Unarmed_Attack_Kick'),
    attack2: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Unarmed_Attack_Punch_A'),
    idle: glbClip(KK_MED, 'Rig_Medium_CombatMelee.glb', 'Melee_Unarmed_Idle', { loop: true }),
  },
};

export const KAYKIT_MELEE_LARGE: Record<string, MeleeCombatSet> = {
  oneHand: {
    attack1: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_1H_Slash'),
    attack2: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_1H_Stab'),
    block: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Block'),
    blockAttack: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Block_Attack'),
    blockHit: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Block_Hit'),
    blocking: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Blocking', { loop: true }),
  },
  twoHand: {
    attack1: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_2H_Attack'),
    attack2: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_2H_Slam'),
    idle: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_2H_Idle', { loop: true }),
  },
  dualwield: {
    attack1: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Dualwield_Slash'),
    attack2: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Dualwield_SlashCombo'),
  },
  unarmed: {
    attack1: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Unarmed_Kick'),
    attack2: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Unarmed_Punch'),
    attack3: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Unarmed_Smash'),
    idle: glbClip(KK_LRG, 'Rig_Large_CombatMelee.glb', 'Melee_Unarmed_Idle', { loop: true }),
  },
};

export const KAYKIT_GENERAL_MEDIUM: DeathAnimSet & { idle: AnimationClipRef; idleB: AnimationClipRef; interact: AnimationClipRef; pickUp: AnimationClipRef; spawnAir: AnimationClipRef; spawnGround: AnimationClipRef; throwItem: AnimationClipRef; useItem: AnimationClipRef } = {
  deathA: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Death_A'),
  deathAPose: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Death_A_Pose'),
  deathB: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Death_B'),
  deathBPose: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Death_B_Pose'),
  hitA: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Hit_A'),
  hitB: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Hit_B'),
  idle: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Idle_A', { loop: true }),
  idleB: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Idle_B', { loop: true }),
  interact: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Interact'),
  pickUp: glbClip(KK_MED, 'Rig_Medium_General.glb', 'PickUp'),
  spawnAir: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Spawn_Air'),
  spawnGround: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Spawn_Ground'),
  throwItem: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Throw'),
  useItem: glbClip(KK_MED, 'Rig_Medium_General.glb', 'Use_Item'),
};

export const KAYKIT_GENERAL_LARGE = {
  deathA: glbClip(KK_LRG, 'Rig_Large_General.glb', 'Death_A'),
  deathAPose: glbClip(KK_LRG, 'Rig_Large_General.glb', 'Death_A_Pose'),
  hitA: glbClip(KK_LRG, 'Rig_Large_General.glb', 'Hit_A'),
  idle: glbClip(KK_LRG, 'Rig_Large_General.glb', 'Idle_A', { loop: true }),
  idleB: glbClip(KK_LRG, 'Rig_Large_General.glb', 'Idle_B', { loop: true }),
};

export const KAYKIT_MOVEMENT_MEDIUM = {
  basic: {
    runA: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Running_A', { loop: true }),
    runB: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Running_B', { loop: true }),
    walkA: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Walking_A', { loop: true }),
    walkB: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Walking_B', { loop: true }),
    walkC: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Walking_C', { loop: true }),
    jumpFull: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Jump_Full_Short'),
    jumpFullLong: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Jump_Full_Long'),
    jumpIdle: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Jump_Idle'),
    jumpLand: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Jump_Land'),
    jumpStart: glbClip(KK_MED, 'Rig_Medium_MovementBasic.glb', 'Jump_Start'),
  },
  advanced: {
    crawling: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Crawling', { loop: true }),
    crouching: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Crouching', { loop: true }),
    dodgeBackward: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Dodge_Backward'),
    dodgeForward: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Dodge_Forward'),
    dodgeLeft: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Dodge_Left'),
    dodgeRight: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Dodge_Right'),
    runHoldingBow: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Running_HoldingBow', { loop: true }),
    runHoldingRifle: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Running_HoldingRifle', { loop: true }),
    runStrafeLeft: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Running_Strafe_Left', { loop: true }),
    runStrafeRight: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Running_Strafe_Right', { loop: true }),
    sneaking: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Sneaking', { loop: true }),
    walkBackwards: glbClip(KK_MED, 'Rig_Medium_MovementAdvanced.glb', 'Walking_Backwards', { loop: true }),
  },
};

export const KAYKIT_MOVEMENT_LARGE = {
  basic: {
    runA: glbClip(KK_LRG, 'Rig_Large_MovementBasic.glb', 'Running_A', { loop: true }),
    walkA: glbClip(KK_LRG, 'Rig_Large_MovementBasic.glb', 'Walking_A', { loop: true }),
  },
  advanced: {
    dodgeBackward: glbClip(KK_LRG, 'Rig_Large_MovementAdvanced.glb', 'Dodge_Backwards'),
    dodgeForward: glbClip(KK_LRG, 'Rig_Large_MovementAdvanced.glb', 'Dodge_Forward'),
    dodgeLeft: glbClip(KK_LRG, 'Rig_Large_MovementAdvanced.glb', 'Dodge_Left'),
    dodgeRight: glbClip(KK_LRG, 'Rig_Large_MovementAdvanced.glb', 'Dodge_Right'),
  },
};

export const KAYKIT_TOOLS: ToolAnimSet = {
  chop: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Chop'),
  chopping: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Chopping', { loop: true }),
  dig: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Dig'),
  digging: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Digging', { loop: true }),
  hammer: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Hammer'),
  hammering: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Hammering', { loop: true }),
  pickaxe: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Pickaxe'),
  pickaxing: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Pickaxing', { loop: true }),
  saw: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Saw'),
  sawing: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Sawing', { loop: true }),
  lockpick: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Lockpick'),
  lockpicking: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Lockpicking', { loop: true }),
};

export const KAYKIT_TOOL_HOLDS = {
  holdA: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Holding_A', { loop: true }),
  holdB: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Holding_B', { loop: true }),
  holdC: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Holding_C', { loop: true }),
  workA: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Work_A'),
  workB: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Work_B'),
  workC: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Work_C'),
  workingA: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Working_A', { loop: true }),
  workingB: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Working_B', { loop: true }),
  workingC: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Working_C', { loop: true }),
};

export const KAYKIT_FISHING: FishingAnimSet = {
  cast: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Cast'),
  idle: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Idle', { loop: true }),
  bite: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Bite'),
  reeling: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Reeling', { loop: true }),
  struggling: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Struggling', { loop: true }),
  tug: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Tug'),
  catch: glbClip(KK_MED, 'Rig_Medium_Tools.glb', 'Fishing_Catch'),
};

export const KAYKIT_SIMULATION_MEDIUM: SimulationAnimSet = {
  cheering: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Cheering', { loop: true }),
  waving: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Waving'),
  pushUps: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Push_Ups', { loop: true }),
  sitUps: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Ups', { loop: true }),
  lieDown: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Lie_Down'),
  lieIdle: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Lie_Idle', { loop: true }),
  lieStandUp: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Lie_StandUp'),
  sitChairDown: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Chair_Down'),
  sitChairIdle: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Chair_Idle', { loop: true }),
  sitChairStandUp: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Chair_StandUp'),
  sitFloorDown: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Floor_Down'),
  sitFloorIdle: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Floor_Idle', { loop: true }),
  sitFloorStandUp: glbClip(KK_MED, 'Rig_Medium_Simulation.glb', 'Sit_Floor_StandUp'),
};

export const KAYKIT_SIMULATION_LARGE: SimulationAnimSet = {
  flexing: glbClip(KK_LRG, 'Rig_Large_Simulation.glb', 'Flexing', { loop: true }),
};

export const KAYKIT_SKELETON: SkeletonAnimSet = {
  idle: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Idle', { loop: true }),
  walking: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Walking', { loop: true }),
  awakenFloor: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Awaken_Floor'),
  awakenFloorLong: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Awaken_Floor_Long'),
  awakenStanding: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Awaken_Standing'),
  death: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Death'),
  deathPose: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Death_Pose'),
  deathResurrect: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Death_Resurrect'),
  inactiveFloorPose: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Inactive_Floor_Pose'),
  inactiveStandingPose: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Inactive_Standing_Pose'),
  spawnGround: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Spawn_Ground'),
  taunt: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Taunt'),
  tauntLonger: glbClip(KK_MED, 'Rig_Medium_Special.glb', 'Skeletons_Taunt_Longer'),
};

export const CREATURE_MUTANT: CreatureAnimSet = {
  idle: fbx('creatures', 'mutant idle.fbx', { loop: true }),
  breathingIdle: fbx('creatures', 'mutant breathing idle.fbx', { loop: true }),
  walk: fbx('creatures', 'mutant walking.fbx', { loop: true }),
  run: fbx('creatures', 'mutant run.fbx', { loop: true }),
  attack: fbx('creatures', 'mutant swiping.fbx'),
  death: fbx('creatures', 'mutant dying.fbx'),
  jump: fbx('creatures', 'mutant jumping.fbx'),
  turnLeft: fbx('creatures', 'mutant left turn 45.fbx'),
  turnRight: fbx('creatures', 'mutant right turn 45.fbx'),
  taunt: fbx('creatures', 'mutant flexing muscles.fbx'),
};

export const ACTION_ADVENTURE = {
  coverToStand: fbx('action_adventure', 'cover to stand.fbx'),
  standToCover: fbx('action_adventure', 'stand to cover.fbx'),
  crouchSneakLeft: fbx('action_adventure', 'crouched sneaking left.fbx', { loop: true }),
  crouchSneakRight: fbx('action_adventure', 'crouched sneaking right.fbx', { loop: true }),
  leftCoverSneak: fbx('action_adventure', 'left cover sneak.fbx', { loop: true }),
  rightCoverSneak: fbx('action_adventure', 'right cover sneak.fbx', { loop: true }),
  fallingIdle: fbx('action_adventure', 'falling idle.fbx', { loop: true }),
  fallingToRoll: fbx('action_adventure', 'falling to roll.fbx'),
  hardLanding: fbx('action_adventure', 'hard landing.fbx'),
  jumpingUp: fbx('action_adventure', 'jumping up.fbx'),
  running: fbx('action_adventure', 'running.fbx', { loop: true }),
  walking: fbx('action_adventure', 'walking.fbx', { loop: true }),
  runToStop: fbx('action_adventure', 'run to stop.fbx'),
  leftTurn: fbx('action_adventure', 'left turn.fbx'),
  rightTurn: fbx('action_adventure', 'right turn.fbx'),
  idleVariants: [
    fbx('action_adventure', 'idle.fbx', { loop: true }),
    fbx('action_adventure', 'idle (2).fbx', { loop: true }),
    fbx('action_adventure', 'idle (3).fbx', { loop: true }),
    fbx('action_adventure', 'idle (4).fbx', { loop: true }),
    fbx('action_adventure', 'idle (5).fbx', { loop: true }),
  ],
};

export type GameClass = 'warrior' | 'ranger' | 'mage' | 'worge';

export interface ClassAnimationProfile {
  locomotion: LocomotionStyle;
  combatMelee: string;
  combatRanged?: string;
  rigSize: RigSize;
}

export const CLASS_ANIMATION_PROFILES: Record<GameClass, ClassAnimationProfile> = {
  warrior: {
    locomotion: 'base',
    combatMelee: 'oneHand',
    rigSize: 'medium',
  },
  ranger: {
    locomotion: 'longbow',
    combatMelee: 'oneHand',
    combatRanged: 'bow',
    rigSize: 'medium',
  },
  mage: {
    locomotion: 'magic',
    combatMelee: 'unarmed',
    combatRanged: 'oneHand',
    rigSize: 'medium',
  },
  worge: {
    locomotion: 'base',
    combatMelee: 'twoHand',
    rigSize: 'large',
  },
};

export function getLocomotionSet(style: LocomotionStyle): LocomotionSet {
  return LOCOMOTION_SETS[style];
}

export function getMeleeCombatSet(style: string, rigSize: RigSize = 'medium'): MeleeCombatSet | undefined {
  return rigSize === 'large' ? KAYKIT_MELEE_LARGE[style] : KAYKIT_MELEE_MEDIUM[style];
}

export function getRangedCombatSet(style: string): RangedCombatSet | undefined {
  return KAYKIT_RANGED_COMBAT[style];
}

export function getClassAnimations(gameClass: GameClass) {
  const profile = CLASS_ANIMATION_PROFILES[gameClass];
  const locomotion = getLocomotionSet(profile.locomotion);
  const melee = getMeleeCombatSet(profile.combatMelee, profile.rigSize);
  const ranged = profile.combatRanged ? getRangedCombatSet(profile.combatRanged) : undefined;
  const general = profile.rigSize === 'large' ? KAYKIT_GENERAL_LARGE : KAYKIT_GENERAL_MEDIUM;
  const movement = profile.rigSize === 'large' ? KAYKIT_MOVEMENT_LARGE : KAYKIT_MOVEMENT_MEDIUM;

  return { profile, locomotion, melee, ranged, general, movement };
}

export function getAllAnimationPaths(): string[] {
  const paths = new Set<string>();

  function collectFromObj(obj: unknown) {
    if (!obj || typeof obj !== 'object') return;
    if ('path' in (obj as Record<string, unknown>) && typeof (obj as Record<string, unknown>).path === 'string') {
      paths.add((obj as Record<string, string>).path);
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(collectFromObj);
      return;
    }
    Object.values(obj as Record<string, unknown>).forEach(collectFromObj);
  }

  collectFromObj(LOCOMOTION_SETS);
  collectFromObj(RIFLE_DEATH_ANIMS);
  collectFromObj(RIFLE_AIMING);
  collectFromObj(PISTOL_EXTRAS);
  collectFromObj(KAYKIT_RANGED_COMBAT);
  collectFromObj(KAYKIT_MAGIC_COMBAT);
  collectFromObj(KAYKIT_MELEE_MEDIUM);
  collectFromObj(KAYKIT_MELEE_LARGE);
  collectFromObj(KAYKIT_GENERAL_MEDIUM);
  collectFromObj(KAYKIT_GENERAL_LARGE);
  collectFromObj(KAYKIT_MOVEMENT_MEDIUM);
  collectFromObj(KAYKIT_MOVEMENT_LARGE);
  collectFromObj(KAYKIT_TOOLS);
  collectFromObj(KAYKIT_TOOL_HOLDS);
  collectFromObj(KAYKIT_FISHING);
  collectFromObj(KAYKIT_SIMULATION_MEDIUM);
  collectFromObj(KAYKIT_SIMULATION_LARGE);
  collectFromObj(KAYKIT_SKELETON);
  collectFromObj(CREATURE_MUTANT);
  collectFromObj(ACTION_ADVENTURE);

  return Array.from(paths);
}
