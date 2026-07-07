/**
 * factionUnits — registry for the baked-GLB starting-build character system.
 *
 * A NEW character pipeline (parallel to the FBX Toon-RTS system in
 * `toonRTSAssets.ts`). Each of the 3 factions ships 2 races × 4 class-builds =
 * 24 self-contained GLBs. Every GLB carries its OWN Bip001 (3ds Max Biped)
 * skeleton PLUS 47-55 baked animation clips (idle/walk/run/attack/sprint/…).
 *
 * The extended moveset lives in ONE shared library — `anim-bank.glb` (123
 * clips, mesh-less, same Bip001 bone names) — so any unit can play any bank
 * clip on its own mixer with no retargeting.
 *
 * GLB filenames: `public/models/characters/<faction>/<raceSlug>_<class>.glb`.
 */

import type { Faction, Race } from './toonRTSAssets';

export type UnitClass = 'knight' | 'mage' | 'ranger' | 'warrior';

export interface UnitRace {
  /** Slug used in the GLB filename (e.g. `western-kingdoms`). */
  slug: string;
  /** Human-readable label. */
  label: string;
  /** Corresponding canonical game `Race` id. */
  race: Race;
}

/** Faction → its two races, matching the shipped GLB filename slugs. */
export const FACTION_UNIT_RACES: Record<Faction, [UnitRace, UnitRace]> = {
  crusade: [
    { slug: 'barbarians', label: 'Barbarians', race: 'barbarian' },
    { slug: 'western-kingdoms', label: 'Western Kingdoms', race: 'human' },
  ],
  fabled: [
    { slug: 'dwarves', label: 'Dwarves', race: 'dwarf' },
    { slug: 'high-elves', label: 'High Elves', race: 'elf' },
  ],
  legion: [
    { slug: 'orcs', label: 'Orcs', race: 'orc' },
    { slug: 'undead', label: 'Undead', race: 'undead' },
  ],
};

export const UNIT_CLASSES: { id: UnitClass; label: string }[] = [
  { id: 'knight', label: 'Knight' },
  { id: 'mage', label: 'Mage' },
  { id: 'ranger', label: 'Ranger' },
  { id: 'warrior', label: 'Warrior' },
];

export const FACTIONS: { id: Faction; label: string }[] = [
  { id: 'crusade', label: 'Crusade' },
  { id: 'fabled', label: 'Fabled' },
  { id: 'legion', label: 'Legion' },
];

/** Canonical faction colours (see replit.md — steel blue / emerald / blood red). */
export const FACTION_UNIT_COLORS: Record<Faction, number> = {
  crusade: 0x3b82f6,
  fabled: 0x22c55e,
  legion: 0xdc2626,
};

const CHAR_BASE = '/models/characters';

/** Absolute public path to a unit's starting-build GLB. */
export function unitGLBPath(faction: Faction, raceSlug: string, cls: UnitClass): string {
  return `${CHAR_BASE}/${faction}/${raceSlug}_${cls}.glb`;
}

/** Shared animation library GLB (Bip001-rigged, mesh-less). */
export const ANIM_BANK_PATH = '/anim/anim-bank.glb';

export interface UnitDescriptor {
  faction: Faction;
  raceSlug: string;
  raceLabel: string;
  race: Race;
  cls: UnitClass;
  classLabel: string;
  path: string;
  /** Stable id, e.g. `legion/orcs/knight`. */
  id: string;
}

/** Flattened list of all 24 starting-build units. */
export const ALL_UNITS: UnitDescriptor[] = (Object.keys(FACTION_UNIT_RACES) as Faction[]).flatMap(
  (faction) =>
    FACTION_UNIT_RACES[faction].flatMap((r) =>
      UNIT_CLASSES.map((c) => ({
        faction,
        raceSlug: r.slug,
        raceLabel: r.label,
        race: r.race,
        cls: c.id,
        classLabel: c.label,
        path: unitGLBPath(faction, r.slug, c.id),
        id: `${faction}/${r.slug}/${c.id}`,
      })),
    ),
);

/** A short curated set of core states for quick-play toolbars. */
export const CORE_STATES = ['idle', 'walk', 'run', 'sprint', 'attack', 'jump', 'dodge'] as const;

/**
 * Canonical baked-clip catalog for the faction GLBs — the single source of truth
 * for animation names, whether a clip loops, and which classes carry it.
 *
 * Names were audited against all 24 GLBs: the 44-clip "core" set is present in
 * EVERY unit; the class-scoped groups (`classes`) only exist on those builds
 * (sword/greatsword → knight+warrior, magic → mage, ranged → ranger). Always
 * gate playback on `UnitCharacter.hasClip()` so a build missing a clip is a
 * no-op rather than an error.
 */
export interface AnimClipDef {
  key: string;
  label: string;
  /** true → THREE.LoopRepeat (steady-state locomotion); false/undefined → one-shot. */
  loop?: boolean;
}

export interface AnimCategory {
  id: string;
  label: string;
  /** If set, only these classes carry the clips in this group. */
  classes?: readonly UnitClass[];
  clips: AnimClipDef[];
}

export const ANIM_CATEGORIES: AnimCategory[] = [
  {
    id: 'locomotion',
    label: 'Locomotion',
    clips: [
      { key: 'idle', label: 'Idle', loop: true },
      { key: 'walk', label: 'Walk', loop: true },
      { key: 'run', label: 'Run', loop: true },
      { key: 'sprint', label: 'Sprint', loop: true },
      { key: 'sprint_start', label: 'Sprint Start' },
      { key: 'crawl', label: 'Crawl', loop: true },
      { key: 'swim', label: 'Swim', loop: true },
      { key: 'jump', label: 'Jump' },
    ],
  },
  {
    id: 'strafe-turn',
    label: 'Strafe & Turn',
    clips: [
      { key: 'strafe_left', label: 'Strafe L (run)', loop: true },
      { key: 'strafe_right', label: 'Strafe R (run)', loop: true },
      { key: 'strafe_left_walk', label: 'Strafe L (walk)', loop: true },
      { key: 'strafe_right_walk', label: 'Strafe R (walk)', loop: true },
      { key: 'turn_left', label: 'Turn L' },
      { key: 'turn_right', label: 'Turn R' },
    ],
  },
  {
    id: 'evade',
    label: 'Evade & Slide',
    clips: [
      { key: 'dodge', label: 'Dodge' },
      { key: 'aerial_evade', label: 'Aerial Evade' },
      { key: 'front_flip', label: 'Front Flip' },
      { key: 'slide_start', label: 'Slide Start' },
      { key: 'slide_exit', label: 'Slide Exit' },
    ],
  },
  {
    id: 'stealth',
    label: 'Stealth & Cover',
    clips: [
      { key: 'crouch_idle', label: 'Crouch Idle', loop: true },
      { key: 'sneak_l', label: 'Sneak L', loop: true },
      { key: 'sneak_r', label: 'Sneak R', loop: true },
      { key: 'cover_sneak_l', label: 'Cover Sneak L', loop: true },
      { key: 'cover_sneak_r', label: 'Cover Sneak R', loop: true },
      { key: 'stand_to_cover', label: 'Take Cover' },
      { key: 'cover_to_stand', label: 'Leave Cover' },
    ],
  },
  {
    id: 'traversal',
    label: 'Traversal',
    clips: [
      { key: 'ascend_stairs', label: 'Stairs Up', loop: true },
      { key: 'descend_stairs', label: 'Stairs Down', loop: true },
      { key: 'climb_ladder', label: 'Climb Ladder', loop: true },
      { key: 'climbup_1m', label: 'Climb Up (1m)' },
      { key: 'wall_climb', label: 'Wall Climb', loop: true },
      { key: 'wall_run', label: 'Wall Run', loop: true },
      { key: 'wall_grab', label: 'Wall Grab' },
      { key: 'wall_jump_start', label: 'Wall Jump' },
      { key: 'wall_jump_land', label: 'Wall Jump Land' },
    ],
  },
  {
    id: 'torch',
    label: 'Torch',
    clips: [
      { key: 'torch_run', label: 'Torch Run', loop: true },
      { key: 'torch_run_stop', label: 'Torch Stop' },
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    clips: [
      { key: 'harvest', label: 'Harvest' },
      { key: 'plant_seed', label: 'Plant Seed' },
      { key: 'fishing_idle', label: 'Fishing Idle', loop: true },
      { key: 'fishing_cast', label: 'Fishing Cast' },
    ],
  },
  {
    id: 'combat',
    label: 'Combat',
    clips: [
      { key: 'attack', label: 'Attack' },
      { key: 'unarmed_uppercut', label: 'Uppercut' },
      { key: 'run_jump_attack', label: 'Run Jump Attack' },
    ],
  },
  {
    id: 'sword-shield',
    label: 'Sword & Shield',
    classes: ['knight', 'warrior'],
    clips: [
      { key: 'sword_attack_a', label: 'Sword Attack A' },
      { key: 'sword_attack_c', label: 'Sword Attack C' },
      { key: 'sword_combo_finisher', label: 'Combo Finisher' },
      { key: 'sword_dash_attack', label: 'Dash Attack' },
      { key: 'sword_block', label: 'Block', loop: true },
      { key: 'shield_bash', label: 'Shield Bash' },
    ],
  },
  {
    id: 'greatsword',
    label: 'Greatsword',
    classes: ['knight', 'warrior'],
    clips: [
      { key: 'gs_idle', label: 'GS Idle', loop: true },
      { key: 'gs_walk', label: 'GS Walk', loop: true },
      { key: 'gs_run', label: 'GS Run', loop: true },
    ],
  },
  {
    id: 'magic',
    label: 'Magic',
    classes: ['mage'],
    clips: [{ key: 'magic_walk_fwd', label: 'Magic Walk', loop: true }],
  },
  {
    id: 'ranged',
    label: 'Ranged',
    classes: ['ranger'],
    clips: [
      { key: 'bow_walk_fwd', label: 'Bow Walk', loop: true },
      { key: 'bow_aim_walk_fwd', label: 'Bow Aim Walk', loop: true },
      { key: 'aim_strafe_l', label: 'Aim Strafe L', loop: true },
      { key: 'aim_strafe_r', label: 'Aim Strafe R', loop: true },
      { key: 'aim_strafe_b', label: 'Aim Strafe Back', loop: true },
      { key: 'dodge_fwd', label: 'Dodge Fwd' },
      { key: 'dodge_back', label: 'Dodge Back' },
      { key: 'dodge_l', label: 'Dodge L' },
      { key: 'dodge_r', label: 'Dodge R' },
    ],
  },
];

/** Set of every clip key that should loop (THREE.LoopRepeat). */
export const LOOPING_CLIPS: ReadonlySet<string> = new Set(
  ANIM_CATEGORIES.flatMap((cat) => cat.clips.filter((c) => c.loop).map((c) => c.key)),
);

/** True if the given clip key is a steady-state looping animation. */
export function isLoopingClip(key: string): boolean {
  return LOOPING_CLIPS.has(key);
}

/** Categories whose clips apply to the given class (class-scoped groups filtered out). */
export function animCategoriesForClass(cls: UnitClass): AnimCategory[] {
  return ANIM_CATEGORIES.filter((cat) => !cat.classes || cat.classes.includes(cls));
}

/** Number-key quick-play bindings (Digit1..Digit9) focused on locomotion. */
export const LOCOMOTION_KEYMAP: Record<string, string> = {
  '1': 'idle',
  '2': 'walk',
  '3': 'run',
  '4': 'sprint',
  '5': 'jump',
  '6': 'crawl',
  '7': 'swim',
  '8': 'dodge',
  '9': 'attack',
};
