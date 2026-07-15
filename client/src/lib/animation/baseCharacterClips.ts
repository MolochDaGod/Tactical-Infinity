/**
 * Semantic registry for `Animated Base Character.glb` (Rigify DEF-* skeleton).
 *
 * Layer A of the fleet animation stack:
 *   style packs (Mixamo / grudge6) → base pack fallback → idle
 *
 * GLB path (staged):
 *   /animations/base/animated-base-character.glb
 */

/** Absolute or site-root URL for the staged pack. */
export const BASE_CHARACTER_GLB = "/animations/base/animated-base-character.glb";

/** Exact clip.name strings inside the GLB. */
export const BASE_GLB_CLIPS = {
  crouchFwd: "Rig|Crouch_Fwd_Loop",
  crouchIdle: "Rig|Crouch_Idle_Loop",
  dance: "Rig|Dance_Loop",
  death: "Rig|Death01",
  driving: "Rig|Driving_Loop",
  fixing: "Rig|Fixing_Kneeling",
  hitChest: "Rig|Hit_Chest",
  hitHead: "Rig|Hit_Head",
  idle: "Rig|Idle_Loop",
  idleTalk: "Rig|Idle_Talking_Loop",
  idleTorch: "Rig|Idle_Torch_Loop",
  interact: "Rig|Interact",
  jog: "Rig|Jog_Fwd_Loop",
  jumpLand: "Rig|Jump_Land",
  jumpLoop: "Rig|Jump_Loop",
  jumpStart: "Rig|Jump_Start",
  pickUp: "Rig|PickUp_Table",
  pistolAimDown: "Rig|Pistol_Aim_Down",
  pistolAim: "Rig|Pistol_Aim_Neutral",
  pistolAimUp: "Rig|Pistol_Aim_Up",
  pistolIdle: "Rig|Pistol_Idle_Loop",
  pistolReload: "Rig|Pistol_Reload",
  pistolShoot: "Rig|Pistol_Shoot",
  punchCross: "Rig|Punch_Cross",
  punchEnter: "Rig|Punch_Enter",
  punchJab: "Rig|Punch_Jab",
  push: "Rig|Push_Loop",
  roll: "Rig|Roll",
  rollRm: "Rig|Roll_RM",
  sitEnter: "Rig|Sitting_Enter",
  sitExit: "Rig|Sitting_Exit",
  sitIdle: "Rig|Sitting_Idle_Loop",
  sitTalk: "Rig|Sitting_Talking_Loop",
  castEnter: "Rig|Spell_Simple_Enter",
  castExit: "Rig|Spell_Simple_Exit",
  castLoop: "Rig|Spell_Simple_Idle_Loop",
  castShoot: "Rig|Spell_Simple_Shoot",
  sprint: "Rig|Sprint_Loop",
  swimFwd: "Rig|Swim_Fwd_Loop",
  swimIdle: "Rig|Swim_Idle_Loop",
  swordAttack: "Rig|Sword_Attack",
  swordAttackRm: "Rig|Sword_Attack_RM",
  swordIdle: "Rig|Sword_Idle",
  walkFormal: "Rig|Walk_Formal_Loop",
  walk: "Rig|Walk_Loop",
} as const;

export type BaseGlbClipKey = keyof typeof BASE_GLB_CLIPS;

/**
 * Semantic roles used by AnimGraph / weapon skills / NPCs.
 * Library registration uses keys like `base/idle`.
 */
export type BaseSemanticRole =
  | "idle"
  | "walk"
  | "jog"
  | "sprint"
  | "crouch_idle"
  | "crouch_walk"
  | "jump_start"
  | "jump_loop"
  | "jump_land"
  | "roll"
  | "roll_rm"
  | "attack_melee"
  | "attack_melee_rm"
  | "attack_punch"
  | "attack_punch_cross"
  | "sword_idle"
  | "cast_enter"
  | "cast_loop"
  | "cast_shoot"
  | "cast_exit"
  | "pistol_idle"
  | "pistol_aim"
  | "pistol_shoot"
  | "pistol_reload"
  | "hit"
  | "death"
  | "swim"
  | "swim_idle";

export interface BaseRoleDef {
  /** Exact name inside the GLB. */
  glbName: string;
  /** Library key after registration (`base/idle`). */
  libraryKey: string;
  /** Strip root position tracks (treadmill). False for intentional RM clips. */
  stripRoot: boolean;
  /** Prefer upper-body-only binding for moving combat. */
  upperBody?: boolean;
  /** Default loop for graph. */
  loop: boolean;
}

/** Semantic role → pack definition. */
export const BASE_ROLE_DEFS: Record<BaseSemanticRole, BaseRoleDef> = {
  idle: {
    glbName: BASE_GLB_CLIPS.idle,
    libraryKey: "base/idle",
    stripRoot: true,
    loop: true,
  },
  walk: {
    glbName: BASE_GLB_CLIPS.walk,
    libraryKey: "base/walk",
    stripRoot: true,
    loop: true,
  },
  jog: {
    glbName: BASE_GLB_CLIPS.jog,
    libraryKey: "base/jog",
    stripRoot: true,
    loop: true,
  },
  sprint: {
    glbName: BASE_GLB_CLIPS.sprint,
    libraryKey: "base/sprint",
    stripRoot: true,
    loop: true,
  },
  crouch_idle: {
    glbName: BASE_GLB_CLIPS.crouchIdle,
    libraryKey: "base/crouch_idle",
    stripRoot: true,
    loop: true,
  },
  crouch_walk: {
    glbName: BASE_GLB_CLIPS.crouchFwd,
    libraryKey: "base/crouch_walk",
    stripRoot: true,
    loop: true,
  },
  jump_start: {
    glbName: BASE_GLB_CLIPS.jumpStart,
    libraryKey: "base/jump_start",
    stripRoot: true,
    loop: false,
  },
  jump_loop: {
    glbName: BASE_GLB_CLIPS.jumpLoop,
    libraryKey: "base/jump_loop",
    stripRoot: true,
    loop: true,
  },
  jump_land: {
    glbName: BASE_GLB_CLIPS.jumpLand,
    libraryKey: "base/jump_land",
    stripRoot: true,
    loop: false,
  },
  roll: {
    glbName: BASE_GLB_CLIPS.roll,
    libraryKey: "base/roll",
    stripRoot: true,
    loop: false,
  },
  roll_rm: {
    glbName: BASE_GLB_CLIPS.rollRm,
    libraryKey: "base/roll_rm",
    stripRoot: false,
    loop: false,
  },
  attack_melee: {
    glbName: BASE_GLB_CLIPS.swordAttack,
    libraryKey: "base/attack_melee",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  attack_melee_rm: {
    glbName: BASE_GLB_CLIPS.swordAttackRm,
    libraryKey: "base/attack_melee_rm",
    stripRoot: false,
    loop: false,
  },
  attack_punch: {
    glbName: BASE_GLB_CLIPS.punchJab,
    libraryKey: "base/attack_punch",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  attack_punch_cross: {
    glbName: BASE_GLB_CLIPS.punchCross,
    libraryKey: "base/attack_punch_cross",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  sword_idle: {
    glbName: BASE_GLB_CLIPS.swordIdle,
    libraryKey: "base/sword_idle",
    stripRoot: true,
    loop: true,
  },
  cast_enter: {
    glbName: BASE_GLB_CLIPS.castEnter,
    libraryKey: "base/cast_enter",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  cast_loop: {
    glbName: BASE_GLB_CLIPS.castLoop,
    libraryKey: "base/cast_loop",
    stripRoot: true,
    upperBody: true,
    loop: true,
  },
  cast_shoot: {
    glbName: BASE_GLB_CLIPS.castShoot,
    libraryKey: "base/cast_shoot",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  cast_exit: {
    glbName: BASE_GLB_CLIPS.castExit,
    libraryKey: "base/cast_exit",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  pistol_idle: {
    glbName: BASE_GLB_CLIPS.pistolIdle,
    libraryKey: "base/pistol_idle",
    stripRoot: true,
    loop: true,
  },
  pistol_aim: {
    glbName: BASE_GLB_CLIPS.pistolAim,
    libraryKey: "base/pistol_aim",
    stripRoot: true,
    upperBody: true,
    loop: true,
  },
  pistol_shoot: {
    glbName: BASE_GLB_CLIPS.pistolShoot,
    libraryKey: "base/pistol_shoot",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  pistol_reload: {
    glbName: BASE_GLB_CLIPS.pistolReload,
    libraryKey: "base/pistol_reload",
    stripRoot: true,
    upperBody: true,
    loop: false,
  },
  hit: {
    glbName: BASE_GLB_CLIPS.hitChest,
    libraryKey: "base/hit",
    stripRoot: true,
    loop: false,
  },
  death: {
    glbName: BASE_GLB_CLIPS.death,
    libraryKey: "base/death",
    stripRoot: true,
    loop: false,
  },
  swim: {
    glbName: BASE_GLB_CLIPS.swimFwd,
    libraryKey: "base/swim",
    stripRoot: true,
    loop: true,
  },
  swim_idle: {
    glbName: BASE_GLB_CLIPS.swimIdle,
    libraryKey: "base/swim_idle",
    stripRoot: true,
    loop: true,
  },
};

/** Lookup library key for a role. */
export function baseLibraryKey(role: BaseSemanticRole): string {
  return BASE_ROLE_DEFS[role].libraryKey;
}

/** Invert GLB name → role (first match). */
export function roleFromGlbName(name: string): BaseSemanticRole | null {
  for (const [role, def] of Object.entries(BASE_ROLE_DEFS) as [BaseSemanticRole, BaseRoleDef][]) {
    if (def.glbName === name) return role;
  }
  return null;
}
