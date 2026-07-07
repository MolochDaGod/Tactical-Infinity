/**
 * ShipRig — single source of truth for everything anchored to a ship.
 *
 * Every ship — procedural or GLB-loaded — registers a ShipRig.  All other
 * systems (sail/wind physics, cannons, crew placement, VFX spawn points,
 * captain camera, flag rendering, hull damage shaders, ability hotbar)
 * consume the rig instead of hardcoding offsets into the scene.
 *
 * Ship-local coordinate convention (matches the existing OpenWaterSailing
 * forward vector and yard math):
 *   +Z = bow (forward)         −Z = stern
 *   +Y = up                    −Y = bilge / under keel
 *   +X = starboard             −X = port
 *
 * The ship's world matrix projects every anchor to world space each frame.
 * Anchors are *declarative*: they describe **where** something belongs on
 * the hull. Behaviour (how a cannon fires, what a caster casts, what a
 * camera does) is owned by the consumer system, keyed by anchor id.
 */

import * as THREE from 'three';

// ─── Anchor catalogue ──────────────────────────────────────────────────────
//
// User-defined slot taxonomy. Not every ship will populate every slot —
// a rowboat has no crowsnest and probably one cannon at most. Consumers
// must tolerate `undefined` for any given id.

export type ShipAnchorId =
  // Structural reference points
  | 'deck'                                   // canonical deck-centre origin
  | 'woodhp'                                 // hull-condition probe; drives damaged-wood shader

  // Crew & captain
  | 'captain'                                // at the wheel — the player mounts here
  | 'crew1' | 'crew2' | 'crew3' | 'crew4'    // up to 4 NPC crew (loaders, riggers, lookouts)
  | 'caster1' | 'caster2'                    // 2 magic-users — bound to effect2/effect3 visuals
  | 'crowsnest'                              // lookout perch high on the main mast

  // Combat — cannons
  | 'cannon1' | 'cannon2' | 'cannon3'
  | 'cannon4' | 'cannon5' | 'cannon6'        // up to 6 cannons; metadata in CannonSpec

  // Cameras
  | 'cameraCaptainOnDeck'                    // 3rd-person captain cam (silent until rotated to)

  // VFX — bound to gameplay events, not to anchors directly
  | 'effect1' | 'effect2' | 'effect3'        // shield aura / sail-wind boost / charged spell
  | 'animation1' | 'animation2'              // anim1 = incoming hit anims, anim2 = outgoing event anims

  // Boat-level abilities — wired to UI hotbar slots 1/2/3/4
  | 'special1' | 'special2' | 'special3' | 'special4'

  // Customization
  | 'flag';                                  // top of main mast — drawable Jolly Roger

/** Roles classify anchors so consumers can iterate semantically. */
export type ShipAnchorRole =
  | 'structural' | 'crew' | 'captain' | 'caster' | 'crowsnest'
  | 'cannon' | 'camera' | 'effect' | 'animation' | 'special' | 'flag';

export const ANCHOR_ROLE: Readonly<Record<ShipAnchorId, ShipAnchorRole>> = Object.freeze({
  deck: 'structural', woodhp: 'structural',
  captain: 'captain',
  crew1: 'crew', crew2: 'crew', crew3: 'crew', crew4: 'crew',
  caster1: 'caster', caster2: 'caster',
  crowsnest: 'crowsnest',
  cannon1: 'cannon', cannon2: 'cannon', cannon3: 'cannon',
  cannon4: 'cannon', cannon5: 'cannon', cannon6: 'cannon',
  cameraCaptainOnDeck: 'camera',
  effect1: 'effect', effect2: 'effect', effect3: 'effect',
  animation1: 'animation', animation2: 'animation',
  special1: 'special', special2: 'special', special3: 'special', special4: 'special',
  flag: 'flag',
});

/** A named local-space transform on the ship. */
export interface ShipAnchor {
  id:        ShipAnchorId;
  position:  THREE.Vector3;                  // ship-local
  rotation?: THREE.Euler;                    // optional facing (Y-yaw most common)
  scale?:    number;                         // optional scale hint (flag/effect sizing)
}

// ─── Per-cannon metadata ───────────────────────────────────────────────────

export type CannonSide = 'port' | 'starboard' | 'bow' | 'stern';

export interface CannonSpec {
  /** Anchor id this cannon mounts to: 'cannon1'…'cannon6'. */
  anchor:       ShipAnchorId;
  side:         CannonSide;
  /** Yaw range in radians from the side-out direction; clamps aim. */
  traverseRad:  [min: number, max: number];
  /** Pitch range in radians from horizontal. */
  elevationRad: [min: number, max: number];
  /** Bore-line muzzle offset from the anchor in local space. */
  muzzleOffset: THREE.Vector3;
  /** Hotbar slot this cannon belongs to (1..4) or null for "broadside". */
  hotbarSlot:   1 | 2 | 3 | 4 | null;
}

// ─── Per-crew metadata ─────────────────────────────────────────────────────

export type CrewStation =
  | 'gunner' | 'rigger' | 'lookout' | 'helmsman' | 'navigator' | 'idle';

export interface CrewSpec {
  anchor:  ShipAnchorId;                     // 'crew1'…'crew4' or 'caster1'/'caster2'
  station: CrewStation;
  /**
   * Optional grip override for ShipDeckRig; lower values let crew slide
   * realistically when the deck heels hard. Default 0.85.
   */
  grip?: number;
}

// ─── Sail rig (the "rule of sails") ────────────────────────────────────────

export type SailType = 'square' | 'fore-aft' | 'jib' | 'staysail' | 'gaff';

export interface MastSpec {
  id:         string;                        // 'fore' | 'main' | 'mizzen' | 'bowsprit' | …
  basePos:    THREE.Vector3;                 // mast foot in deck-local space
  height:     number;                        // metres
  /** True for bowsprits etc. that lie horizontal. */
  horizontal?: boolean;
}

export interface SailSpec {
  id:        string;                         // 'mainsail' | 'foresail' | 'jib' | …
  mastId:    string;
  type:      SailType;
  /** Sail area in m² — drives wind force magnitude. */
  area:      number;
  /** Local offsets along the mast for the sail's head and foot. */
  headLocal: THREE.Vector3;                  // top corner offset from mast base
  footLocal: THREE.Vector3;                  // bottom corner offset from mast base
  /**
   * Allowed yard/boom yaw range in radians (deviation from ship-forward).
   * Square sails: ~[-1.0, +1.0]. Fore-aft sails: full ~[-π/2, +π/2].
   */
  trimRange: [min: number, max: number];
  /** Resting / furled angle. */
  restYaw:   number;
  /**
   * If true, this sail is auto-trimmed to the optimal angle for the current
   * wind unless the player has grabbed manual control. Defaults to true.
   */
  autoTrim?: boolean;
}

// ─── Damage-zone metadata (drives the hull damage shader at woodhp) ────────

export interface DamageZoneSpec {
  /** Anchor id whose mesh subtree this zone covers — defaults to 'woodhp'. */
  anchor:    ShipAnchorId;
  /** Maximum visual damage — at hp=0 the shader saturates here. */
  maxDamage: number;
}

// ─── Flag (Jolly Roger) ────────────────────────────────────────────────────

export interface FlagSpec {
  anchor: ShipAnchorId;                      // always 'flag' in practice
  width:  number;
  height: number;
  /**
   * Storage key into the player's drawable-flag library. The flag editor
   * writes a 256×256 RGBA canvas under this key; the cloth shader samples it
   * each frame so live flag edits reflect immediately.
   */
  designKey: string;                         // e.g. 'guild:warlords' or 'player:abc123:default'
}

// ─── The rig itself ────────────────────────────────────────────────────────

export interface ShipRig {
  shipType: string;                          // 'sloop' | 'brigantine' | 'galleon' | …
  /** Hull bounds — used by camera framing, LOD, and fallback anchor placement. */
  hull: { length: number; beam: number; draft: number };

  anchors:       Map<ShipAnchorId, ShipAnchor>;
  masts:         MastSpec[];
  sails:         SailSpec[];
  cannons:       CannonSpec[];
  crew:          CrewSpec[];
  damageZones:   DamageZoneSpec[];
  flag:          FlagSpec | null;

  /** Free-form provenance — useful for debugging which file produced this rig. */
  source?: 'procedural' | 'glb-convention' | 'manual-spec';
}

// ─── GLB naming convention (for auto-extraction) ───────────────────────────
//
// Modelers name their empties / dummy meshes in the GLB using these names;
// `loadShipRigFromGLB` walks the scene graph and builds a ShipRig
// automatically. Anything not present gets sensible fallbacks from the
// hull bounding box.
//
// Keep this list in lockstep with ShipAnchorId — a CI-style assertion below
// will trip if they ever drift apart.

export const GLB_ANCHOR_NAMES: Readonly<Record<ShipAnchorId, string>> = Object.freeze({
  deck:                'anchor_deck',
  woodhp:              'anchor_woodhp',
  captain:             'anchor_captain',
  crew1:               'anchor_crew1',
  crew2:               'anchor_crew2',
  crew3:               'anchor_crew3',
  crew4:               'anchor_crew4',
  caster1:             'anchor_caster1',
  caster2:             'anchor_caster2',
  crowsnest:           'anchor_crowsnest',
  cannon1:             'anchor_cannon1',
  cannon2:             'anchor_cannon2',
  cannon3:             'anchor_cannon3',
  cannon4:             'anchor_cannon4',
  cannon5:             'anchor_cannon5',
  cannon6:             'anchor_cannon6',
  cameraCaptainOnDeck: 'anchor_cameraCaptainOnDeck',
  effect1:             'anchor_effect1',
  effect2:             'anchor_effect2',
  effect3:             'anchor_effect3',
  animation1:          'anchor_animation1',
  animation2:          'anchor_animation2',
  special1:            'anchor_special1',
  special2:            'anchor_special2',
  special3:            'anchor_special3',
  special4:            'anchor_special4',
  flag:                'anchor_flag',
});

/** Mast empties: 'mast_main', 'mast_fore', 'mast_mizzen', 'mast_bowsprit'. */
export const GLB_MAST_PREFIX = 'mast_';
/**
 * Sail empties:
 *   'sail_<sailId>_head' and 'sail_<sailId>_foot'.
 * Example: a mainsail uses 'sail_main_head' and 'sail_main_foot'.
 */
export const GLB_SAIL_PREFIX = 'sail_';

// ─── Constructors / helpers ────────────────────────────────────────────────

export function createEmptyRig(shipType: string): ShipRig {
  return {
    shipType,
    hull:        { length: 10, beam: 3, draft: 1.2 },
    anchors:     new Map(),
    masts:       [],
    sails:       [],
    cannons:     [],
    crew:        [],
    damageZones: [],
    flag:        null,
  };
}

/** Resolve an anchor's *world* transform given the ship's root object. */
export function getAnchorWorld(
  rig:    ShipRig,
  ship:   THREE.Object3D,
  id:     ShipAnchorId,
  outPos: THREE.Vector3 = new THREE.Vector3(),
  outRot?: THREE.Quaternion,
): THREE.Vector3 | null {
  const a = rig.anchors.get(id);
  if (!a) return null;
  ship.updateMatrixWorld(true);
  outPos.copy(a.position);
  ship.localToWorld(outPos);
  if (outRot && a.rotation) {
    outRot.setFromEuler(a.rotation).premultiply(ship.quaternion);
  }
  return outPos;
}

/** Iterate anchors filtered by role — convenience for consumer systems. */
export function anchorsByRole(rig: ShipRig, role: ShipAnchorRole): ShipAnchor[] {
  const out: ShipAnchor[] = [];
  for (const a of rig.anchors.values()) {
    if (ANCHOR_ROLE[a.id] === role) out.push(a);
  }
  return out;
}
