import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FollowCamera } from '@/lib/camera/FollowCamera';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Zap, Heart, Star, X, Skull, Anchor, TreePine, Pickaxe, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameHUD } from '@/components/game/GameHUD';
import { CinzelOverlay, buildHudOverride, isCinzelHudEnabled } from '@/components/hud/CinzelOverlay';
import {
  generateIslandTerrain,
  buildHarvestableNode,
  type HarvestableNode,
  type IslandTerrainResult,
} from '@/lib/islandTerrainGen';
import { YukaAISystem, type AIEnemy, type AIEnemyConfig } from '@/lib/yukaEnemyAI';
import { preloadAnimatedEnemyAssets } from '@/lib/animatedEnemyLoader';
import { UnifiedNavSystem } from '@/lib/nav';
import { PropColliderSystem } from '@/lib/PropColliderSystem';
import { ARMOR_SLOTS, type ArmorSlot } from '@/lib/character/CharacterBuilder';
import { UnitCharacter } from '@/lib/character/UnitGLBLoader';
import { resolveUnitModel } from '@/lib/character/unitModel';
import { loadCaptainBuild } from '@/lib/captainBuild';
import { loadGearCatalogue, localCatalogue, gearForSlot } from '@/lib/gear/catalogue';
import { getLoadout, resolveLoadout, ensureLoadout, setSlot, subscribeLoadout, PLAYER_LOADOUT_ID, type Loadout, type ResolvedLoadout } from '@/lib/gear/loadout';
import { GEAR_SLOTS, type GearItem, type GearSlot } from '@shared/gameDefinitions/gear';
import { applyLoadout3D, findHandBone, findHeadBone, type Rig3D } from '@/lib/gear/rig3d';
import type { Race, WeaponStyle } from '@/data/toonRTSAssets';
import {
  createDefaultGameFlow,
  grantPlayerXp,
  grantProfessionXp,
  SKILL_TREE,
  PROFESSION_RESOURCES,
  type GameFlowState,
  type Profession,
} from '@/lib/gameFlowSystem';

interface IslandBattlePageProps { onBack?: () => void; }

interface SkillDef {
  key: string; label: string; icon: string; cooldown: number;
  dmgMult?: number; range?: number; aoeRadius?: number; color?: number;
}

interface DamageNumber { id: number; text: string; x: number; y: number; color: string; expiry: number; }
interface KillEntry    { id: number; text: string; ts: number; }

const SKILLS: SkillDef[] = [
  { key: '1', label: 'Cleave',      icon: '⚔',  cooldown: 4,  dmgMult: 1.8, range: 3.5, aoeRadius: 2.5, color: 0xFF6B35 },
  { key: '2', label: 'Shield Bash', icon: '🛡',  cooldown: 6,  dmgMult: 1.2, range: 2.5, color: 0x4488FF },
  { key: '3', label: 'Whirlwind',   icon: '🌀',  cooldown: 8,  dmgMult: 2.0, range: 4,   aoeRadius: 4,   color: 0xFFCC00 },
  { key: '4', label: 'War Cry',     icon: '💥',  cooldown: 12, dmgMult: 0.5, range: 8,   aoeRadius: 8,   color: 0xFF4444 },
  { key: '5', label: 'Execute',     icon: '💀',  cooldown: 15, dmgMult: 3.5, range: 2.5, color: 0xAA00FF },
  { key: 'r', label: 'Recover',     icon: '💚',  cooldown: 10, dmgMult: 0,   range: 0,   color: 0x00FF88 },
  { key: 'f', label: 'Flurry',      icon: '⚡',  cooldown: 7,  dmgMult: 1.5, range: 3,   aoeRadius: 1.5, color: 0xFFFF44 },
  { key: 'z', label: 'Leap Strike', icon: '🗡',  cooldown: 9,  dmgMult: 2.5, range: 6,   color: 0xFF8800 },
];
const SKILL_KEY_ORDER = ['1','2','3','4','5','r','f','z'];
const ENEMY_NAMES = ['Raider','Skullbane','Cutthroat','Marauder','Pillager','Wretched','Deckhand','Corsair'];
const FACTIONS: AIEnemyConfig['faction'][] = ['raider','undead','beast','bandit'];

// Reusable gear applied to spawned enemies (ids from the local gear catalogue).
const ENEMY_LOADOUTS: Record<string, Loadout> = {
  raider: { weapon: 'w_axe', offhand: 'o_shield', chest: 'a_chest' },
  undead: { weapon: 'w_staff', head: 'a_helm' },
  beast:  { weapon: 'w_spear' },
  bandit: { weapon: 'w_dagger', head: 'a_helm' },
  legion: { weapon: 'w_greatsword', chest: 'a_chest', head: 'a_helm' },
};

// Persistent loadout key + default gear for the player's ally companion. Uses
// the SAME key an equip UI would (mirrors the PLAYER_LOADOUT_ID pattern) so a
// change persists across spawns. Sword + shield attach to hand bones; the chest
// piece exercises the built-in armor-mesh toggle path.
const ALLY_LOADOUT_ID = 'ally:companion';
const ALLY_LOADOUT: Loadout = { weapon: 'w_sword', offhand: 'o_shield', chest: 'a_chest', head: 'a_helm' };

const HARVEST_PROFESSION: Record<string, Profession> = {
  tree: 'woodcutting', rock: 'mining', goldmine: 'mining', plant: 'herbalism', animal: 'skinning',
};

class IslandPlayer {
  group: THREE.Group;
  position: THREE.Vector3;
  hp = 500; maxHp = 500;
  mp = 200; maxMp = 200;
  velocity = new THREE.Vector3();
  facing = 0;
  state: 'idle' | 'walk' | 'run' | 'attack_light' | 'attack_heavy' | 'skill' | 'harvest' = 'idle';
  attackTimer = 0;
  attackDuration = 0;
  isAttacking = false;
  speedMult = 1;
  private capsuleVis: THREE.Group;
  private weapon: THREE.Group;
  private glow: THREE.PointLight;
  private scene: THREE.Scene;
  // Body pivots — drive procedural attack/idle/walk animation. Right arm
  // owns the weapon, so rotating its pivot rotates arm + weapon as a unit.
  private rightArmPivot!: THREE.Group;
  private leftArmPivot!: THREE.Group;
  private upperBodyPivot!: THREE.Group;
  private headPivot!: THREE.Group;
  // Animation drivers
  private animTime = 0;
  private bodyLeanZ = 0;
  private bodyTwistY = 0;
  private lungeForward = 0;
  heightAt: (x: number, z: number) => number;
  // Canonical 3D race character (replaces the box-mesh knight visual when loaded)
  unit: UnitCharacter | null = null;
  private currentRace: Race | null = null;
  private currentStyle: WeaponStyle | null = null;
  private currentAnimKey: string | null = null;
  private charLoadToken = 0;
  private disposed = false;

  constructor(scene: THREE.Scene, heightAt: (x: number, z: number) => number) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.group = new THREE.Group();
    this.group.position.set(0, heightAt(0, 0) + 0.05, 0);
    this.position = this.group.position;
    this.capsuleVis = new THREE.Group();
    this._buildCapsule();
    this.group.add(this.capsuleVis);
    this.glow = new THREE.PointLight(0xFFAA44, 0, 3);
    this.group.add(this.glow);
    this.weapon = new THREE.Group();
    this.weapon.position.set(0.42, 1.15, 0.1);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xD0D8E8, flatShading: true, roughness: 0.2, metalness: 0.9 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.03), bladeMat);
    blade.castShadow = true;
    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.15, 4), bladeMat);
    bladeTip.position.y = 0.42;
    bladeTip.rotation.y = Math.PI / 4;
    const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.005), new THREE.MeshStandardMaterial({ color: 0xEEF0FF, roughness: 0.1, metalness: 1.0 }));
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, flatShading: true, roughness: 0.3, metalness: 0.7 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), guardMat);
    guard.position.y = -0.36;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), guardMat);
    pommel.position.y = -0.52;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0x4A2A10, roughness: 0.8 }));
    grip.position.y = -0.44;
    this.weapon.add(blade, bladeTip, bladeEdge, guard, pommel, grip);
    this.capsuleVis.add(this.weapon);
    // Now that the weapon Group exists, re-parent it under the right-arm
    // pivot built inside `_buildCapsule()`. `attach` preserves the world
    // transform so the sword stays in the same hand position.
    this.capsuleVis.updateMatrixWorld(true);
    this.rightArmPivot.attach(this.weapon);
    scene.add(this.group);
  }

  private _buildCapsule() {
    const lam = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7 });
    const skinMat = lam(0xD4A574);
    const armorMat = lam(0x4A5A70);
    const darkArmor = lam(0x2A3548);
    const leatherMat = lam(0x6B4226);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, flatShading: true, roughness: 0.3, metalness: 0.7 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 8), armorMat);
    torso.position.y = 1.08;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.35, 0.26), armorMat);
    chest.position.y = 1.18;

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.1, 8), leatherMat);
    belt.position.y = 0.82;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.14), goldMat);
    buckle.position.set(0, 0.82, 0.13);

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.2, 8), darkArmor);
    waist.position.y = 0.72;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 6), skinMat);
    neck.position.y = 1.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skinMat);
    head.position.y = 1.64;
    head.scale.set(1, 1.1, 0.95);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), armorMat);
    helm.position.y = 1.72;
    const helmRim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 4, 12), goldMat);
    helmRim.position.y = 1.62;
    helmRim.rotation.x = Math.PI / 2;

    const noseguard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.05), goldMat);
    noseguard.position.set(0, 1.65, 0.18);

    const shoulderGeo = new THREE.SphereGeometry(0.14, 6, 4);
    const lShoulder = new THREE.Mesh(shoulderGeo, armorMat);
    lShoulder.position.set(-0.36, 1.3, 0);
    lShoulder.scale.set(1.2, 0.8, 1);
    const rShoulder = new THREE.Mesh(shoulderGeo, armorMat);
    rShoulder.position.set(0.36, 1.3, 0);
    rShoulder.scale.set(1.2, 0.8, 1);

    const armGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6);
    const lUpperArm = new THREE.Mesh(armGeo, skinMat);
    lUpperArm.position.set(-0.38, 1.1, 0);
    lUpperArm.rotation.z = 0.3;
    const rUpperArm = new THREE.Mesh(armGeo, skinMat);
    rUpperArm.position.set(0.38, 1.1, 0);
    rUpperArm.rotation.z = -0.3;

    const forearmGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.35, 6);
    const lForearm = new THREE.Mesh(forearmGeo, skinMat);
    lForearm.position.set(-0.42, 0.82, 0.08);
    lForearm.rotation.z = 0.15;
    const rForearm = new THREE.Mesh(forearmGeo, skinMat);
    rForearm.position.set(0.42, 0.82, 0.08);
    rForearm.rotation.z = -0.15;

    const bracerGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.15, 6);
    const lBracer = new THREE.Mesh(bracerGeo, leatherMat);
    lBracer.position.set(-0.42, 0.88, 0.08);
    const rBracer = new THREE.Mesh(bracerGeo, leatherMat);
    rBracer.position.set(0.42, 0.88, 0.08);

    const handGeo = new THREE.SphereGeometry(0.06, 5, 4);
    const lHand = new THREE.Mesh(handGeo, skinMat);
    lHand.position.set(-0.42, 0.68, 0.12);
    const rHand = new THREE.Mesh(handGeo, skinMat);
    rHand.position.set(0.42, 0.68, 0.12);

    const thighGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.42, 6);
    const lThigh = new THREE.Mesh(thighGeo, darkArmor);
    lThigh.position.set(-0.13, 0.5, 0);
    const rThigh = new THREE.Mesh(thighGeo, darkArmor);
    rThigh.position.set(0.13, 0.5, 0);

    const shinGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.38, 6);
    const lShin = new THREE.Mesh(shinGeo, armorMat);
    lShin.position.set(-0.13, 0.18, 0);
    const rShin = new THREE.Mesh(shinGeo, armorMat);
    rShin.position.set(0.13, 0.18, 0);

    const bootGeo = new THREE.BoxGeometry(0.14, 0.08, 0.2);
    const lBoot = new THREE.Mesh(bootGeo, leatherMat);
    lBoot.position.set(-0.13, 0.02, 0.03);
    const rBoot = new THREE.Mesh(bootGeo, leatherMat);
    rBoot.position.set(0.13, 0.02, 0.03);

    const kneeGeo = new THREE.SphereGeometry(0.07, 5, 4);
    const lKnee = new THREE.Mesh(kneeGeo, armorMat);
    lKnee.position.set(-0.13, 0.32, 0.04);
    const rKnee = new THREE.Mesh(kneeGeo, armorMat);
    rKnee.position.set(0.13, 0.32, 0.04);

    const capeGeo = new THREE.PlaneGeometry(0.5, 0.7);
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x8B0000, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 });
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 1.0, -0.16);
    cape.rotation.x = 0.1;

    const allParts = [
      torso, chest, belt, buckle, waist, neck, head, helm, helmRim, noseguard,
      lShoulder, rShoulder, lUpperArm, rUpperArm, lForearm, rForearm,
      lBracer, rBracer, lHand, rHand,
      lThigh, rThigh, lShin, rShin, lBoot, rBoot, lKnee, rKnee, cape
    ];
    allParts.forEach(m => { m.castShadow = true; this.capsuleVis.add(m); });

    // --- Animation pivots ---------------------------------------------------
    // The blocky body looks "kinda cute" but every prior frame the arms were
    // FROZEN — only the weapon prop rotated, which read as wooden. Wrap the
    // arm meshes (and the weapon) in shoulder pivots so the actual arm
    // swings with the sword. `pivot.attach` preserves world transform so the
    // rest pose is unchanged.

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.36, 1.3, 0);
    this.capsuleVis.add(this.rightArmPivot);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.36, 1.3, 0);
    this.capsuleVis.add(this.leftArmPivot);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.42, 0); // base of neck
    this.capsuleVis.add(this.headPivot);

    // upperBodyPivot is anchored at the waist (y=0.85). Anything inside it
    // leans/twists with the body without lifting the legs off the ground.
    this.upperBodyPivot = new THREE.Group();
    this.upperBodyPivot.position.set(0, 0.85, 0);
    this.capsuleVis.add(this.upperBodyPivot);

    // Make sure world matrices are populated before re-parenting so attach()
    // can compute correct local transforms.
    this.capsuleVis.updateMatrixWorld(true);

    // Right arm + weapon move together — rotating the pivot rotates the
    // whole sword arm as a unit, exactly how a swing actually works.
    // NOTE: the weapon Group is built in the constructor *after* this
    // method returns, so attaching it here would re-parent `undefined`
    // and crash with "Cannot read properties of undefined (reading
    // 'parent')". The constructor handles that attach itself once the
    // weapon exists; only the body parts get attached here.
    const rightArmParts = [rShoulder, rUpperArm, rForearm, rBracer, rHand];
    rightArmParts.forEach(m => this.rightArmPivot.attach(m));

    // Left arm pivot for opposite-side swing during locomotion / heavy attack.
    const leftArmParts = [lShoulder, lUpperArm, lForearm, lBracer, lHand];
    leftArmParts.forEach(m => this.leftArmPivot.attach(m));

    // Head + helmet move with head pivot (look up during skill cast).
    [head, helm, helmRim, noseguard, neck].forEach(m => this.headPivot.attach(m));

    // Upper-body pivot owns the torso/chest/belt + the arm pivots + head pivot
    // so a single body-lean / body-twist drives everything above the waist.
    [torso, chest, belt, buckle].forEach(m => this.upperBodyPivot.attach(m));
    this.upperBodyPivot.attach(this.rightArmPivot);
    this.upperBodyPivot.attach(this.leftArmPivot);
    this.upperBodyPivot.attach(this.headPivot);
    this.upperBodyPivot.attach(cape);
  }

  update(dt: number, keys: Set<string>, camera: THREE.PerspectiveCamera, targetDir?: number) {
    const SPEED = 6 * this.speedMult;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));
    let moveX = 0, moveZ = 0;
    if (keys.has('w') || keys.has('arrowup'))    { moveX += camDir.x;  moveZ += camDir.z; }
    if (keys.has('s') || keys.has('arrowdown'))  { moveX -= camDir.x;  moveZ -= camDir.z; }
    if (keys.has('a') || keys.has('arrowleft'))  { moveX -= camRight.x; moveZ -= camRight.z; }
    if (keys.has('d') || keys.has('arrowright')) { moveX += camRight.x; moveZ += camRight.z; }
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const moving = len > 0.01;
    if (moving) {
      const nx = moveX / len, nz = moveZ / len;
      this.group.position.x += nx * SPEED * dt;
      this.group.position.z += nz * SPEED * dt;
      this.facing = Math.atan2(nx, nz);
      if (keys.has('shift')) { this.state = 'run'; this.speedMult = 1.6; }
      else { this.state = 'walk'; this.speedMult = 1; }
    } else if (!this.isAttacking) {
      this.state = 'idle'; this.speedMult = 1;
    }
    if (moving) { this.capsuleVis.rotation.y = this.facing; this.weapon.rotation.y = 0; }
    else if (targetDir !== undefined) { this.capsuleVis.rotation.y = targetDir; }

    const px = this.group.position.x, pz = this.group.position.z;
    const r2 = px * px + pz * pz;
    if (r2 > 22 * 22) { const r = Math.sqrt(r2); this.group.position.x = px / r * 22; this.group.position.z = pz / r * 22; }
    this.group.position.y = this.heightAt(this.group.position.x, this.group.position.z) + 0.03;

    // -----------------------------------------------------------------------
    // Procedural body animation. The arms used to be frozen during attacks —
    // only the weapon prop rotated, which read as wooden. Now we drive the
    // shoulder pivots, body lean / twist, head tilt, and a small forward
    // lunge for a real swing. Heavy attack is a whirlwind spin; skill is an
    // arms-overhead cast pose.
    // -----------------------------------------------------------------------
    this.animTime += dt;

    // Per-frame target rest pose — overridden below when an action is active.
    let armRX = 0;       // right shoulder rotation X (negative = up/back, positive = forward/down)
    let armRZ = 0;
    let armLX = 0;
    let armLZ = 0;
    let bodyTwistY = 0;  // upper-body twist around vertical axis
    let bodyLeanZ = 0;   // upper-body side lean (used by heavy spin)
    let bodyLeanX = 0;   // upper-body forward lean (chop follow-through)
    let headTiltX = 0;   // negative = look up
    let lunge = 0;       // forward push along facing
    let glowTarget = 0;

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      this.isAttacking = true;
      const dur = this.attackDuration > 0 ? this.attackDuration : 0.45;
      const t = THREE.MathUtils.clamp(1 - this.attackTimer / dur, 0, 1);
      const ease = (a: number, b: number, k: number) => a + (b - a) * (k * k * (3 - 2 * k)); // smoothstep

      if (this.state === 'attack_light') {
        // 3-phase chop: windup (0..0.3) → swing (0.3..0.7) → recover (0.7..1)
        if (t < 0.3) {
          const k = t / 0.3;
          armRX = ease(0, -2.1, k);     // raise sword behind/above head
          bodyTwistY = ease(0, 0.45, k); // coil shoulders right
          armLX = ease(0, 0.5, k);      // off-hand counterbalance forward
        } else if (t < 0.7) {
          const k = (t - 0.3) / 0.4;
          armRX = ease(-2.1, 1.3, k);   // explosive downward swing
          bodyTwistY = ease(0.45, -0.35, k);
          armLX = ease(0.5, -0.6, k);
          bodyLeanX = Math.sin(k * Math.PI) * 0.25;
          lunge = Math.sin(k * Math.PI) * 0.35;
        } else {
          const k = (t - 0.7) / 0.3;
          armRX = ease(1.3, 0, k);      // arm settles back to rest
          bodyTwistY = ease(-0.35, 0, k);
          armLX = ease(-0.6, 0, k);
        }
        glowTarget = Math.sin(t * Math.PI) * 2.0;
      } else if (this.state === 'attack_heavy') {
        // Whirlwind: both arms extended out to the sides, body spins ~360°
        // through the swing window then settles.
        const spinT = t < 0.85 ? t / 0.85 : 1;
        bodyTwistY = ease(0, Math.PI * 2.0, spinT);
        const armOut = ease(0, -1.55, Math.min(t / 0.2, 1)) * (1 - Math.max(0, (t - 0.8) / 0.2));
        armRX = armOut;
        armLX = armOut;
        armRZ = -0.55 + Math.sin(t * Math.PI) * -0.2;
        armLZ =  0.55 + Math.sin(t * Math.PI) *  0.2;
        bodyLeanZ = Math.sin(t * Math.PI * 2) * 0.12;
        glowTarget = Math.sin(t * Math.PI) * 3.0;
      } else if (this.state === 'skill') {
        // Cast pose: both arms shoot overhead, head tilts up, glow pulses.
        const k = Math.sin(t * Math.PI); // 0 → 1 → 0
        armRX = -2.6 * k;
        armLX = -2.6 * k;
        armRZ = -0.25 * k;
        armLZ =  0.25 * k;
        headTiltX = -0.45 * k;
        bodyLeanX = -0.12 * k; // slight back-arch
        glowTarget = 4.0 * k;
      } else if (this.state === 'harvest') {
        // Repeated chopping — sine on right arm + small body bob.
        const k = Math.sin(t * Math.PI * 2);
        armRX = -0.6 + k * 0.9;
        bodyTwistY = k * 0.15;
        glowTarget = 0;
      }
    } else {
      this.isAttacking = false;
      this.attackDuration = 0;
    }

    // Locomotion overlay — only when NOT mid-attack so swings always read.
    if (!this.isAttacking) {
      if (this.state === 'walk' || this.state === 'run') {
        const freq = this.state === 'run' ? 9 : 6;
        const amp = this.state === 'run' ? 0.65 : 0.42;
        const phase = this.animTime * freq;
        armRX = Math.sin(phase) * amp;
        armLX = -Math.sin(phase) * amp;
        bodyTwistY = Math.sin(phase) * 0.08;
        bodyLeanX = (this.state === 'run' ? 0.12 : 0.05); // slight forward lean while moving
      } else {
        // Idle breathing — torso rises subtly, arms sway.
        const breath = Math.sin(this.animTime * 1.8);
        bodyLeanX = breath * 0.025;
        armRX = breath * 0.06 + Math.sin(this.animTime * 0.6) * 0.04;
        armLX = -breath * 0.06 + Math.sin(this.animTime * 0.6 + Math.PI) * 0.04;
      }
    }

    // Apply with small smoothing so transitions don't snap.
    const k = Math.min(1, dt * 18);
    this.rightArmPivot.rotation.x += (armRX - this.rightArmPivot.rotation.x) * k;
    this.rightArmPivot.rotation.z += (armRZ - this.rightArmPivot.rotation.z) * k;
    this.leftArmPivot.rotation.x  += (armLX - this.leftArmPivot.rotation.x)  * k;
    this.leftArmPivot.rotation.z  += (armLZ - this.leftArmPivot.rotation.z)  * k;
    this.upperBodyPivot.rotation.y += (bodyTwistY - this.upperBodyPivot.rotation.y) * k;
    this.upperBodyPivot.rotation.z += (bodyLeanZ - this.upperBodyPivot.rotation.z) * k;
    this.upperBodyPivot.rotation.x += (bodyLeanX - this.upperBodyPivot.rotation.x) * k;
    this.headPivot.rotation.x      += (headTiltX  - this.headPivot.rotation.x)      * k;
    this.lungeForward += (lunge - this.lungeForward) * k;
    this.glow.intensity += (glowTarget - this.glow.intensity) * k;

    // Apply forward lunge in the player's facing direction (capsule local).
    const fwdSin = Math.sin(this.facing);
    const fwdCos = Math.cos(this.facing);
    const lungeX = fwdSin * this.lungeForward;
    const lungeZ = fwdCos * this.lungeForward;
    if (moving) {
      this.capsuleVis.position.set(lungeX, Math.sin(Date.now() * 0.012) * 0.04, lungeZ);
    } else {
      this.capsuleVis.position.x = lungeX;
      this.capsuleVis.position.z = lungeZ;
      this.capsuleVis.position.y *= 0.9;
    }

    // Drive the canonical 3D character (skinned anim) if it has loaded.
    if (this.unit) {
      this.unit.update(dt);
      this.syncAnim();
    }
  }

  doLightAttack() {
    if (this.isAttacking) return false;
    this.state = 'attack_light';
    this.attackDuration = 0.45;
    this.attackTimer = this.attackDuration;
    return true;
  }
  doHeavyAttack() {
    if (this.isAttacking) return false;
    this.state = 'attack_heavy';
    this.attackDuration = 0.85;
    this.attackTimer = this.attackDuration;
    return true;
  }
  startSkillAnimation(color: number) {
    this.glow.color.setHex(color);
    this.state = 'skill';
    this.attackDuration = 0.65;
    this.attackTimer = this.attackDuration;
  }
  // ── Canonical 3D character ───────────────────────────────────────────────
  /**
   * Drive the baked-GLB unit's OWN clips from the player state. Deduped on the
   * resolved clip key — UnitCharacter.play() re-seeks the action on every call,
   * so it must only be invoked when the target clip actually changes.
   */
  private syncAnim(): void {
    if (!this.unit) return;
    let candidates: string[];
    let loop: boolean;
    switch (this.state) {
      case 'walk':         candidates = ['walk', 'run'];                                  loop = true;  break;
      case 'run':          candidates = ['run', 'walk'];                                  loop = true;  break;
      case 'harvest':      candidates = ['harvest', 'attack'];                            loop = true;  break;
      case 'attack_light': candidates = ['sword_attack_a', 'attack', 'unarmed_uppercut']; loop = false; break;
      case 'attack_heavy': candidates = ['sword_attack_c', 'sword_combo_finisher', 'attack']; loop = false; break;
      case 'skill':        candidates = ['shield_bash', 'sword_dash_attack', 'attack'];   loop = false; break;
      default:             candidates = ['idle'];                                         loop = true;
    }
    const key = candidates.find((k) => this.unit!.hasClip(k)) ?? 'idle';
    if (key === this.currentAnimKey) return;
    this.unit.play(key, { loop, fade: loop ? 0.25 : 0.12 });
    this.currentAnimKey = key;
  }

  /** Swap the player's visual to its canonical faction GLB (async load). */
  async setCharacter(race: Race, style: WeaponStyle): Promise<void> {
    if (this.disposed) return;
    this.currentRace = race;
    this.currentStyle = style;
    const token = ++this.charLoadToken;
    const resolved = resolveUnitModel(race, { weaponStyle: style });
    if (!resolved) return;

    let unit: UnitCharacter;
    try {
      // Weapon comes BAKED from the mesh — no external attach. Root motion is
      // stripped because the battle player is driven by game code, not by clips.
      unit = await UnitCharacter.load(resolved.path, {
        targetHeight: 1.8,
        includeBank: false,
        stripRootMotion: true,
      });
    } catch (e) {
      console.warn('[IslandBattle] unit GLB load failed:', e);
      return;
    }
    // A newer request superseded this one, or the player was disposed, while
    // loading — discard the freshly built character.
    if (this.disposed || token !== this.charLoadToken) { unit.dispose(); return; }

    const old = this.unit;
    if (old) old.dispose();

    // Hide the procedural box-knight fallback, then attach the GLB so its own
    // meshes (with baked weapon) become the visible character.
    this.capsuleVis.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.visible = false;
    });
    this.capsuleVis.add(unit.object);
    this.unit = unit;
    this.currentAnimKey = null;
    this.syncAnim();
  }

  /** Weapon is baked per class GLB, so a style change reloads the matching build. */
  setWeaponStyle(style: WeaponStyle): void {
    this.currentStyle = style;
    if (this.currentRace) void this.setCharacter(this.currentRace, style);
  }
  // Armor variants were FBX-submesh toggles; GLB armor is baked into the mesh.
  equipArmorVariant(_slot: ArmorSlot, _index: number | null): void { /* baked into GLB */ }
  listArmor(_slot: ArmorSlot): string[] { return []; }

  /** Apply a resolved LOOT gear loadout on top of the baked build (hand bones). */
  applyGearLoadout(resolved: ResolvedLoadout): void { this.unit?.applyGearLoadout(resolved); }

  dispose() {
    this.disposed = true;
    this.charLoadToken++; // invalidate any in-flight setCharacter() load
    this.unit?.dispose();
    this.unit = null;
    this.scene.remove(this.group);
  }
}

function spawnSkillVFX(scene: THREE.Scene, pos: THREE.Vector3, skill: SkillDef): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos).add(new THREE.Vector3(0, 0.8, 0));
  const c = skill.color ?? 0xFFAA00;
  const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 });
  if (skill.aoeRadius) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(skill.aoeRadius * 0.5, 0.12, 8, 32), mat.clone());
    ring.rotation.x = -Math.PI / 2; g.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }));
    p.position.set(Math.cos(angle) * 0.6, 0, Math.sin(angle) * 0.6); g.add(p);
  }
  scene.add(g);
  const start = Date.now();
  const tick = () => {
    const t = (Date.now() - start) / 600;
    if (t >= 1) { scene.remove(g); return; }
    g.scale.setScalar(1 + t * (skill.aoeRadius ? 2 : 1));
    g.children.forEach(ch => { const m = ch as THREE.Mesh; if (m.material) ((m.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85); });
    requestAnimationFrame(tick);
  };
  tick();
  return g;
}

function seededRng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; }

export default function IslandBattlePage({ onBack }: IslandBattlePageProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const playerRef  = useRef<IslandPlayer | null>(null);
  const aiRef      = useRef<YukaAISystem | null>(null);
  const navRef     = useRef<UnifiedNavSystem | null>(null);
  const terrainRef = useRef<IslandTerrainResult | null>(null);
  const harvestRef = useRef<HarvestableNode[]>([]);
  const propCollidersRef = useRef(new PropColliderSystem());
  const colliderTimerRef = useRef(0);
  const gameFlowRef = useRef<GameFlowState>(createDefaultGameFlow());
  const cameraRef  = useRef<THREE.PerspectiveCamera | null>(null);
  const keysRef    = useRef<Set<string>>(new Set());
  const targetRef  = useRef<AIEnemy | null>(null);
  const skillCoolRef   = useRef<Map<string, number>>(new Map());
  const attackCoolRef  = useRef<{ light: number; heavy: number }>({ light: 0, heavy: 0 });
  const dmgIdRef       = useRef(0);
  const killIdRef      = useRef(0);
  const yawRef   = useRef(Math.PI);
  const pitchRef = useRef(0.42);
  // Unified follow-camera rig — one of three call sites of FollowCamera
  // (the other two: CharacterController.ThirdPersonCamera and
  // islandExploreManager). Built inside the scene-setup effect once the
  // camera + container exist.
  const followCamRef = useRef<FollowCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const harvestTargetRef = useRef<HarvestableNode | null>(null);

  const [playerHp,  setPlayerHp]  = useState(500);
  const [playerMp,  setPlayerMp]  = useState(200);
  const [targetInfo, setTargetInfo] = useState<{ name: string; hp: number; maxHp: number; level: number } | null>(null);
  const [skillCools, setSkillCools]  = useState<Record<string, number>>({});
  const [dmgNums,   setDmgNums]   = useState<DamageNumber[]>([]);
  const [kills,     setKills]     = useState<KillEntry[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [wave,      setWave]      = useState(1);
  const [phase,     setPhase]     = useState<'playing' | 'victory' | 'defeat'>('playing');
  const [dockPrompt, setDockPrompt] = useState(false);
  const [harvestInfo, setHarvestInfo] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [resources, setResources] = useState<Record<string, number>>({});
  const [xpGained, setXpGained] = useState(0);
  const [gameFlow, setGameFlow] = useState<GameFlowState>(gameFlowRef.current);
  // Warband / character loadout panel state
  const [charRace, setCharRace] = useState<Race>('human');
  const [charStyle, setCharStyle] = useState<WeaponStyle>('sword_shield');
  const [charLoading, setCharLoading] = useState(false);
  const [showWarband, setShowWarband] = useState(false);
  const [armorOpts, setArmorOpts] = useState<Record<string, number>>({});
  const [equippedArmor, setEquippedArmor] = useState<Partial<Record<ArmorSlot, number | null>>>({});
  // Catalogue-driven equipment (player loadout) surfaced in the in-game C panel.
  const [gearCatalogue, setGearCatalogue] = useState<GearItem[]>(() => localCatalogue());
  const [playerLoadout, setPlayerLoadout] = useState<Loadout>(() => getLoadout(PLAYER_LOADOUT_ID));
  // Ally companion loadout — same shared store, keyed by ALLY_LOADOUT_ID. Seeded
  // with the default build so the panel shows real gear even before the ally spawns.
  const [allyLoadout, setAllyLoadout] = useState<Loadout>(() => ensureLoadout(ALLY_LOADOUT_ID, ALLY_LOADOUT));
  const [showAllyGear, setShowAllyGear] = useState(false);

  // Hydrate the full catalogue (hub + local) once, then keep the local player
  // and ally loadouts in sync with the shared store so other surfaces stay consistent.
  useEffect(() => {
    let alive = true;
    loadGearCatalogue().then((c) => { if (alive) setGearCatalogue(c); }).catch(() => {});
    const unsub = subscribeLoadout((id, lo) => {
      if (id === PLAYER_LOADOUT_ID) setPlayerLoadout(lo);
      else if (id === ALLY_LOADOUT_ID) setAllyLoadout(lo);
    });
    return () => { alive = false; unsub(); };
  }, []);

  // Click a slot to cycle equipped gear (empty → item0 → … → empty). Each change
  // persists to the shared store AND re-applies to the live 3D player model.
  const cycleGearSlot = useCallback((slot: GearSlot) => {
    const options = gearForSlot(gearCatalogue, slot);
    if (options.length === 0) return;
    const currentId = playerLoadout[slot];
    const idx = options.findIndex((g) => g.id === currentId);
    const next = options[idx + 1]; // undefined past the end → unequip
    setSlot(PLAYER_LOADOUT_ID, slot, next ? next.id : null);
    const p = playerRef.current;
    if (p) {
      try {
        p.applyGearLoadout(resolveLoadout(getLoadout(PLAYER_LOADOUT_ID), gearCatalogue));
      } catch { /* keep current visuals if re-apply fails */ }
    }
  }, [gearCatalogue, playerLoadout]);

  // Cycle a slot on the ally companion's loadout. Persists to the SAME shared key
  // used at spawn (ALLY_LOADOUT_ID) so changes survive re-spawns, and re-applies
  // live to every currently spawned ally mesh (weapon attach / armor toggle).
  const cycleAllyGearSlot = useCallback((slot: GearSlot) => {
    const options = gearForSlot(gearCatalogue, slot);
    if (options.length === 0) return;
    const currentId = allyLoadout[slot];
    const idx = options.findIndex((g) => g.id === currentId);
    const next = options[idx + 1]; // undefined past the end → unequip
    setSlot(ALLY_LOADOUT_ID, slot, next ? next.id : null);
    const resolved = resolveLoadout(getLoadout(ALLY_LOADOUT_ID), gearCatalogue);
    for (const ally of aiRef.current?.aliveAllies ?? []) {
      try {
        const rig: Rig3D = {
          root: ally.mesh,
          rightHand: findHandBone(ally.mesh, 'right'),
          leftHand: findHandBone(ally.mesh, 'left'),
          headBone: findHeadBone(ally.mesh),
        };
        applyLoadout3D(rig, resolved);
      } catch { /* keep current ally visuals if re-apply fails */ }
    }
  }, [gearCatalogue, allyLoadout]);

  const refreshArmorOpts = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const opts: Record<string, number> = {};
    for (const slot of ARMOR_SLOTS) opts[slot] = p.listArmor(slot).length;
    setArmorOpts(opts);
  }, []);

  const applyRace = useCallback(async (race: Race) => {
    const p = playerRef.current;
    if (!p) return;
    setCharRace(race);
    setCharLoading(true);
    await p.setCharacter(race, charStyle);
    // The player may have been disposed/replaced (unmount, scene rebuild) or a
    // newer race swap may now be in flight — only commit UI state if still live.
    if (playerRef.current !== p) return;
    // Apply any persisted gear loadout for the player: GLB weapons attach to the
    // hand bones and armor toggles built-in submeshes. Non-fatal on failure.
    try {
      const catalogue = await loadGearCatalogue();
      if (playerRef.current === p) {
        p.applyGearLoadout(resolveLoadout(getLoadout(PLAYER_LOADOUT_ID), catalogue));
      }
    } catch { /* keep default FBX weapon if gear load fails */ }
    refreshArmorOpts();
    setEquippedArmor({});
    setCharLoading(false);
  }, [charStyle, refreshArmorOpts]);

  const applyStyle = useCallback((style: WeaponStyle) => {
    const p = playerRef.current;
    if (!p) return;
    setCharStyle(style);
    p.setWeaponStyle(style);
  }, []);

  const cycleArmor = useCallback((slot: ArmorSlot) => {
    const p = playerRef.current;
    if (!p) return;
    const count = armorOpts[slot] ?? 0;
    const cur = equippedArmor[slot] ?? null;
    let next: number | null;
    if (cur === null) next = count > 0 ? 0 : null;
    else if (cur + 1 < count) next = cur + 1;
    else next = null;
    p.equipArmorVariant(slot, next);
    setEquippedArmor(e => ({ ...e, [slot]: next }));
  }, [armorOpts, equippedArmor]);

  const addDmgNum = useCallback((text: string, color: string, x: number, y: number) => {
    const id = dmgIdRef.current++;
    setDmgNums(prev => [...prev.filter(d => d.expiry > Date.now()), { id, text, color, x, y: y - Math.random() * 20, expiry: Date.now() + 1400 }]);
  }, []);

  const addKill = useCallback((text: string) => {
    const id = killIdRef.current++;
    setKills(prev => [...prev.slice(-4), { id, text, ts: Date.now() }]);
  }, []);

  const spawnWave = useCallback((scene: THREE.Scene, waveNum: number, ai: YukaAISystem, heightAt: (x: number, z: number) => number) => {
    const count = 3 + waveNum * 2;
    const rng = seededRng(waveNum * 77777);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const r = 12 + rng() * 8;
      const px = Math.cos(angle) * r, pz = Math.sin(angle) * r;
      const y = heightAt(px, pz);
      if (y < 0) continue;
      const name = ENEMY_NAMES[i % ENEMY_NAMES.length];
      const level = waveNum + Math.floor(rng() * 2);
      const cfg: AIEnemyConfig = {
        name, level,
        position: new THREE.Vector3(px, y + 0.03, pz),
        faction: FACTIONS[Math.floor(rng() * FACTIONS.length)],
        aggroRange: 12, attackRange: 2.0,
        attackDamage: 8 + level * 2,
        attackCooldown: 1.8 - level * 0.05,
        moveSpeed: 2.8 + level * 0.15,
        hp: 80 + level * 25,
      };
      const enemy = ai.spawnEnemy(cfg);
      // Gear is a reusable library: apply a faction-assigned loadout so enemies
      // visibly carry real 3D weapons (+ armor toggles where the rig supports
      // them). Non-fatal — the primitive fallback mesh simply has no hand bones.
      try {
        const loadout = ensureLoadout(`enemy:${cfg.faction}`, ENEMY_LOADOUTS[cfg.faction] ?? ENEMY_LOADOUTS.raider);
        const rig: Rig3D = {
          root: enemy.mesh,
          rightHand: findHandBone(enemy.mesh, 'right'),
          leftHand: findHandBone(enemy.mesh, 'left'),
          headBone: findHeadBone(enemy.mesh),
        };
        applyLoadout3D(rig, resolveLoadout(loadout, localCatalogue()));
      } catch { /* keep default enemy appearance if gear attach fails */ }
    }
  }, []);

  // Spawn the player's ally companion(s). Same gear pipeline as the player +
  // enemies: resolve the persisted ally loadout against the catalogue, then
  // apply it to the (rigged) ally so its weapon attaches to a hand bone and
  // its armor submesh toggles on. Requires the animated rig to be preloaded so
  // the hand bones exist — call after `preloadAnimatedEnemyAssets()` resolves.
  const spawnAllies = useCallback((scene: THREE.Scene, ai: YukaAISystem, heightAt: (x: number, z: number) => number) => {
    const px = 2.5, pz = 2.5;
    const y = heightAt(px, pz);
    if (y < 0) return;
    const cfg: AIEnemyConfig = {
      name: 'Companion', level: 3,
      position: new THREE.Vector3(px, y + 0.03, pz),
      faction: 'bandit', // Crusade human rig for a heroic look
      aggroRange: 12, attackRange: 2.0,
      attackDamage: 14,
      attackCooldown: 1.4,
      moveSpeed: 3.2,
      hp: 200,
    };
    const ally = ai.spawnAlly(cfg);
    try {
      const loadout = ensureLoadout(ALLY_LOADOUT_ID, ALLY_LOADOUT);
      const rig: Rig3D = {
        root: ally.mesh,
        rightHand: findHandBone(ally.mesh, 'right'),
        leftHand: findHandBone(ally.mesh, 'left'),
        headBone: findHeadBone(ally.mesh),
      };
      applyLoadout3D(rig, resolveLoadout(loadout, localCatalogue()));
    } catch { /* keep default ally appearance if gear attach fails */ }
  }, []);

  const cycleTarget = useCallback(() => {
    const ai = aiRef.current;
    if (!ai) return;
    const currentId = targetRef.current?.id ?? -1;
    const next = ai.cycleTarget(currentId);
    targetRef.current = next;
    if (next) setTargetInfo({ name: next.config.name, hp: next.hp, maxHp: next.maxHp, level: next.config.level });
    else setTargetInfo(null);
  }, []);

  const getTarget = useCallback((): AIEnemy | null => {
    const t = targetRef.current;
    return t?.alive ? t : null;
  }, []);

  const attackEnemy = useCallback((enemy: AIEnemy, dmg: number, color: string) => {
    const ai = aiRef.current;
    if (!ai || !enemy.alive) return;
    const killed = ai.damageEnemy(enemy, dmg);
    const canvas = mountRef.current;
    if (canvas && cameraRef.current) {
      const v = enemy.mesh.position.clone().project(cameraRef.current);
      const x = (v.x + 1) / 2 * canvas.clientWidth;
      const y = (1 - v.y) / 2 * canvas.clientHeight;
      addDmgNum(`-${dmg}`, color, x, y);
    }
    if (killed) {
      const gold = 15 + enemy.config.level * 8;
      const xp = 20 + enemy.config.level * 10;
      addKill(`⚔ ${enemy.config.name} slain! +${gold}g +${xp}xp`);
      const gf = gameFlowRef.current;
      gf.gold += gold;
      const result = grantPlayerXp(gf.player, xp);
      if (result.leveledUp) addKill(`🎉 Level Up! Now Lv.${result.newLevel}`);
      setXpGained(prev => prev + xp);
      setGameFlow({ ...gf });
      targetRef.current = null; setTargetInfo(null);
      const nextAlive = ai.aliveEnemies[0];
      if (nextAlive) {
        ai.setTarget(nextAlive);
        targetRef.current = nextAlive;
        setTargetInfo({ name: nextAlive.config.name, hp: nextAlive.hp, maxHp: nextAlive.maxHp, level: nextAlive.config.level });
      }
    } else {
      setTargetInfo(t => t ? { ...t, hp: enemy.hp } : null);
    }
  }, [addDmgNum, addKill]);

  const harvestNode = useCallback((node: HarvestableNode) => {
    if (node.hp <= 0) return;
    const dmg = 15 + Math.floor(Math.random() * 10);
    node.hp -= dmg;
    const canvas = mountRef.current;
    if (canvas && cameraRef.current) {
      const v = node.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)).project(cameraRef.current);
      const x = (v.x + 1) / 2 * canvas.clientWidth;
      const y = (1 - v.y) / 2 * canvas.clientHeight;
      addDmgNum(`-${dmg}`, '#88CCFF', x, y);
    }
    if (node.hp <= 0) {
      node.mesh.visible = false;
      const gained = node.yieldAmount + Math.floor(Math.random() * 3);
      const gf = gameFlowRef.current;
      const prof = HARVEST_PROFESSION[node.type];
      if (prof) {
        const profXp = 15 + Math.floor(Math.random() * 10);
        const result = grantProfessionXp(gf.player, prof, profXp);
        if (result.leveledUp) addKill(`⭐ ${prof} Lv.${result.newLevel}!`);
      }
      setResources(prev => ({ ...prev, [node.resource]: (prev[node.resource] || 0) + gained }));
      addKill(`🪓 +${gained} ${node.resource.replace(/_/g, ' ')}`);
      setHarvestInfo(null);
      harvestTargetRef.current = null;
      setGameFlow({ ...gf });
    } else {
      setHarvestInfo({ name: `${node.subType} (${node.type})`, hp: node.hp, maxHp: node.maxHp });
    }
  }, [addDmgNum, addKill]);

  const useSkill = useCallback((skillKey: string) => {
    const skill = SKILLS.find(s => s.key === skillKey);
    const scene = sceneRef.current;
    if (!skill || !scene) return;
    const now = Date.now() / 1000;
    const lastUsed = skillCoolRef.current.get(skillKey) ?? 0;
    if (now - lastUsed < skill.cooldown) return;
    skillCoolRef.current.set(skillKey, now);
    setSkillCools(prev => ({ ...prev, [skillKey]: skill.cooldown }));
    const player = playerRef.current;
    if (!player) return;
    if (skillKey === 'r') {
      const heal = 60 + Math.random() * 40;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      setPlayerHp(player.hp);
      addDmgNum(`+${Math.round(heal)}`, '#44FF88', mountRef.current ? mountRef.current.clientWidth / 2 : 400, mountRef.current ? mountRef.current.clientHeight * 0.4 : 300);
      player.startSkillAnimation(skill.color ?? 0x00FF88);
      return;
    }
    player.startSkillAnimation(skill.color ?? 0xFFAA00);
    const ai = aiRef.current;
    if (!ai) return;
    if (skill.aoeRadius) {
      const ppos = player.position.clone();
      spawnSkillVFX(scene, ppos, skill);
      ai.aliveEnemies.forEach(e => {
        const dist = ppos.distanceTo(e.mesh.position);
        if (dist <= (skill.aoeRadius! + skill.range!)) {
          const dmg = Math.round((30 + Math.random() * 20) * (skill.dmgMult ?? 1));
          attackEnemy(e, dmg, '#FFB833');
        }
      });
    } else {
      const target = getTarget();
      if (!target) return;
      const dist = player.position.distanceTo(target.mesh.position);
      if (dist > (skill.range ?? 5)) return;
      spawnSkillVFX(scene, target.mesh.position, skill);
      const dmg = Math.round((35 + Math.random() * 25) * (skill.dmgMult ?? 1));
      attackEnemy(target, dmg, '#FF9933');
    }
  }, [getTarget, attackEnemy, addDmgNum]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0xA8E0F0, 50, 150);
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 8, 12);
    cameraRef.current = camera;

    // Build the unified follow-camera rig. We use 'none' input mode because
    // this page already owns the right-mouse-drag handler below (it shares
    // the gesture with target picking) — we drive yaw/pitch by writing
    // followCam.yaw/pitch directly. Smooth lerp + zoom still work.
    const followCam = new FollowCamera(camera, {
      yaw: yawRef.current,
      pitch: pitchRef.current,
      distance: 9,
      lookAtHeight: 1.2,
      smoothness: 0.18,
      minPitch: 0.15,
      maxPitch: 0.85,
      minDistance: 4,
      maxDistance: 18,
      inputMode: 'none',
      keyboardYaw: false,
    });
    followCamRef.current = followCam;

    const ambLight = new THREE.AmbientLight(0xFFF4E0, 0.65);
    scene.add(ambLight);
    const sun = new THREE.DirectionalLight(0xFFF8D4, 1.35);
    sun.position.set(15, 28, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024);
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top  =  30; sun.shadow.camera.bottom = -30;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xC5E8FF, 0xD4C090, 0.5));

    const rimLight = new THREE.DirectionalLight(0xFFDDBB, 0.4);
    rimLight.position.set(-10, 15, -8);
    scene.add(rimLight);

    const w = container.clientWidth, h = container.clientHeight;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.5, 0.88);
    composer.addPass(bloomPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / w, 1 / h);
    composer.addPass(fxaaPass);
    const colorGradeShader = {
      uniforms: { tDiffuse: { value: null }, saturation: { value: 1.15 }, contrast: { value: 1.08 }, brightness: { value: 0.02 }, vignetteIntensity: { value: 0.35 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float saturation; uniform float contrast; uniform float brightness; uniform float vignetteIntensity; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb + brightness;
        float gray = dot(col, vec3(0.299,0.587,0.114)); col = mix(vec3(gray), col, saturation);
        col = (col - 0.5) * contrast + 0.5;
        float d = distance(vUv, vec2(0.5)); col *= 1.0 - d * d * vignetteIntensity;
        gl_FragColor = vec4(col, c.a); }`,
    };
    const colorPass = new ShaderPass(colorGradeShader);
    composer.addPass(colorPass);
    (composer as any)._composerRef = true;

    const islandSeed = Math.floor(Math.random() * 100000);
    const terrainResult = generateIslandTerrain({ seed: islandSeed, hasDock: true, dockSide: 'south', size: 48, segments: 48, maxHeight: 4.5 });
    terrainRef.current = terrainResult;
    scene.add(terrainResult.terrain);
    scene.add(terrainResult.water);
    if (terrainResult.dock) scene.add(terrainResult.dock);

    const harvestableNodes: HarvestableNode[] = [];
    terrainResult.harvestableSpots.forEach((spot, i) => {
      const node = buildHarvestableNode(spot, terrainResult.heightAt, islandSeed + i * 13);
      harvestableNodes.push(node);
      scene.add(node.mesh);
    });
    harvestRef.current = harvestableNodes;

    const player = new IslandPlayer(scene, terrainResult.heightAt);
    playerRef.current = player;

    // Load the canonical 3D race character. Honour a locked captain build from
    // the barracks / class-tree if present, else default to a human warrior.
    const cb = loadCaptainBuild();
    const initRace: Race = cb?.race ?? 'human';
    const initStyle: WeaponStyle = cb?.weaponStyle ?? 'sword_shield';
    setCharRace(initRace);
    setCharStyle(initStyle);
    setCharLoading(true);
    player.setCharacter(initRace, initStyle).then(async () => {
      if (playerRef.current !== player) return;
      const opts: Record<string, number> = {};
      for (const slot of ARMOR_SLOTS) opts[slot] = player.listArmor(slot).length;
      setArmorOpts(opts);
      // Apply the persisted player loadout on first spawn so equipped GLB weapons
      // / armor toggles show immediately (not just after a manual race swap).
      try {
        const catalogue = await loadGearCatalogue();
        if (playerRef.current === player) {
          player.applyGearLoadout(resolveLoadout(getLoadout(PLAYER_LOADOUT_ID), catalogue));
        }
      } catch { /* keep default FBX weapon if gear load fails */ }
      setCharLoading(false);
    });

    const ai = new YukaAISystem(scene);
    aiRef.current = ai;

    // ── Unified navmesh: bake land/water/climb zones from terrain + ocean.
    // Enemies use the land layer to route around hills instead of chasing
    // straight-line through them. Bake is ~30 ms for a 48-unit island so
    // we run it inline here; for larger worlds wrap in queueMicrotask.
    try {
      const nav = new UnifiedNavSystem({
        resolution: 1.0,
        agentRadius: 0.5,
        classifier: { seaLevel: 0.05 },
      });
      const navMeshes: THREE.Mesh[] = [];
      terrainResult.terrain.traverse(o => { if ((o as THREE.Mesh).isMesh) navMeshes.push(o as THREE.Mesh); });
      const waterMesh = terrainResult.water as THREE.Mesh;
      navMeshes.push(waterMesh);
      const layerHints = new Map<THREE.Object3D, 'land' | 'water' | 'climb'>();
      layerHints.set(waterMesh, 'water');
      const bounds = new THREE.Box3().setFromObject(terrainResult.terrain);
      bounds.expandByScalar(2);
      nav.bake({ meshes: navMeshes, bounds, layerHints });
      ai.setNavSystem(nav, 'land');
      navRef.current = nav;
    } catch (err) {
      console.warn('[IslandBattle] navmesh bake failed, enemies fall back to direct steering', err);
    }

    // Kick off the Toon-RTS rig + animation preload off the main thread.
    // Until it resolves, `cloneAnimatedEnemy` returns null and `spawnEnemy`
    // falls back to the primitive mesh — so the first wave is never blocked
    // and later waves automatically pick up the rigged characters.
    preloadAnimatedEnemyAssets()
      .then(() => {
        console.log('[IslandBattle] animated enemy assets ready');
        // Spawn the geared ally companion once the rig is available so its
        // weapon can attach to a real hand bone (the primitive fallback has none).
        if (aiRef.current === ai) spawnAllies(scene, ai, terrainResult.heightAt);
      })
      .catch((err) => console.warn('[IslandBattle] enemy preload failed:', err));

    spawnWave(scene, 1, ai, terrainResult.heightAt);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if (k === 'c') { setShowPanel(p => !p); return; }
      if (k === 'tab') { e.preventDefault(); cycleTarget(); return; }
      if (k === 'e') {
        if (dockPrompt) { addKill('⚓ Captain Mode — set sail!'); return; }
        const ht = harvestTargetRef.current;
        if (ht && ht.hp > 0) {
          player.state = 'harvest'; player.attackTimer = 0.5;
          harvestNode(ht);
        }
        return;
      }
      if (SKILL_KEY_ORDER.includes(k)) { useSkill(k); return; }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());

    const onPointerDown = (e: MouseEvent) => {
      if (e.button === 2) {
        const c = attackCoolRef.current;
        if (c.heavy <= 0 && player.doHeavyAttack()) {
          c.heavy = 1.2;
          const target = getTarget();
          if (target) {
            const dist = player.position.distanceTo(target.mesh.position);
            if (dist < 3.0) {
              const dmg = Math.round(50 + Math.random() * 30);
              setTimeout(() => attackEnemy(target, dmg, '#FF4444'), 400);
            }
          }
        }
      } else if (e.button === 0) {
        const c = attackCoolRef.current;
        if (c.light <= 0 && player.doLightAttack()) {
          c.light = 0.55;
          const target = getTarget();
          if (target) {
            const dist = player.position.distanceTo(target.mesh.position);
            if (dist < 2.5) {
              const dmg = Math.round(22 + Math.random() * 15);
              setTimeout(() => attackEnemy(target, dmg, '#FFDD44'), 220);
            }
          }
        }
        const raycaster = new THREE.Raycaster();
        const rect = container.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        const enemyMeshes = ai.aliveEnemies.map(en => en.mesh);
        const hits = raycaster.intersectObjects(enemyMeshes, true);
        if (hits.length > 0) {
          let hitEnemy: AIEnemy | undefined;
          for (const e of ai.aliveEnemies) {
            if (e.mesh === hits[0].object.parent || e.mesh.children.includes(hits[0].object)) { hitEnemy = e; break; }
            let p = hits[0].object.parent;
            while (p) { if (p === e.mesh) { hitEnemy = e; break; } p = p.parent; }
            if (hitEnemy) break;
          }
          if (hitEnemy?.alive) {
            ai.setTarget(hitEnemy);
            targetRef.current = hitEnemy;
            setTargetInfo({ name: hitEnemy.config.name, hp: hitEnemy.hp, maxHp: hitEnemy.maxHp, level: hitEnemy.config.level });
          }
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons & 2) {
        yawRef.current   -= e.movementX * 0.0035;
        pitchRef.current -= e.movementY * 0.0035;
        pitchRef.current  = Math.max(0.15, Math.min(0.85, pitchRef.current));
        // Push the new yaw/pitch into the unified follow-cam rig so that
        // the smoothed camera position next frame reflects the input.
        const fc = followCamRef.current;
        if (fc) { fc.yaw = yawRef.current; fc.pitch = pitchRef.current; }
      }
    };
    const onWheel = (e: WheelEvent) => {
      // Wheel zoom — mirrors the FollowCamera default but in 'none' input
      // mode we own all listeners, so do it here.
      const fc = followCamRef.current;
      if (!fc) return;
      fc.distance = Math.max(4, Math.min(18, fc.distance + e.deltaY * 0.01));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    container.addEventListener('mousedown', onPointerDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('contextmenu', e => e.preventDefault());

    const coolTick = setInterval(() => {
      setSkillCools(prev => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const k in prev) { next[k] = Math.max(0, prev[k] - 0.1); if (next[k] !== prev[k]) changed = true; }
        return changed ? next : prev;
      });
    }, 100);

    let animId = 0, last = performance.now();
    let gameWave = 1, waveCheckTimer = 0, mpRegen = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now * 0.001;
      (terrainResult.water.material as THREE.MeshLambertMaterial).color.setHSL(0.52 + Math.sin(t * 0.3) * 0.01, 0.6, 0.52 + Math.sin(t * 0.5) * 0.02);

      const ac = attackCoolRef.current;
      ac.light = Math.max(0, ac.light - dt);
      ac.heavy = Math.max(0, ac.heavy - dt);

      const tgt = getTarget();
      let targetDir: number | undefined;
      if (tgt) {
        const dx = tgt.mesh.position.x - player.position.x;
        const dz = tgt.mesh.position.z - player.position.z;
        targetDir = Math.atan2(dx, dz);
      }
      player.update(dt, keysRef.current, camera, targetDir);

      // Keep harvestable trees/rocks solid. Rebuild throttled from the live
      // node list (skip depleted nodes), resolve the player out, then re-snap
      // to terrain height since player.update() already snapped y once.
      colliderTimerRef.current -= dt;
      if (colliderTimerRef.current <= 0) {
        colliderTimerRef.current = 0.4;
        const cols = propCollidersRef.current;
        cols.clear();
        for (const h of harvestRef.current) {
          if (h.hp <= 0) continue;
          // maxRadius stays under the d<3 harvest cutoff (radius+playerRadius
          // must be < 3) so nodes remain reachable for E-to-harvest.
          cols.addFromObject3D(h.mesh.uuid, h.mesh, { tightness: 0.6, minRadius: 0.3, maxRadius: 1.8 });
        }
      }
      if (propCollidersRef.current.count > 0) {
        propCollidersRef.current.resolve(player.position, 0.5);
        player.position.y = terrainResult.heightAt(player.position.x, player.position.z) + 0.03;
      }

      const aiResult = ai.update(dt, player.position);
      aiResult.attackingEnemies.forEach(e => {
        player.hp = Math.max(0, player.hp - e.config.attackDamage);
        setPlayerHp(player.hp);
        if (player.hp <= 0) setPhase('defeat');
      });

      if (tgt) setTargetInfo(prev => prev ? { ...prev, hp: tgt.hp } : null);

      mpRegen += dt;
      if (mpRegen > 2) { mpRegen = 0; player.mp = Math.min(player.maxMp, player.mp + 5); setPlayerMp(player.mp); }

      const dockPos = terrainResult.dockPosition;
      if (dockPos) {
        const dockDist = player.position.distanceTo(dockPos);
        setDockPrompt(dockDist < 5);
      }

      let nearestHarvest: HarvestableNode | null = null;
      let nearestDist = Infinity;
      harvestRef.current.forEach(h => {
        if (h.hp <= 0) return;
        const d = player.position.distanceTo(h.mesh.position);
        if (d < 3 && d < nearestDist) { nearestDist = d; nearestHarvest = h; }
      });
      harvestTargetRef.current = nearestHarvest;
      if (nearestHarvest) setHarvestInfo({ name: `${(nearestHarvest as HarvestableNode).subType} (${(nearestHarvest as HarvestableNode).type})`, hp: (nearestHarvest as HarvestableNode).hp, maxHp: (nearestHarvest as HarvestableNode).maxHp });
      else if (harvestInfo) setHarvestInfo(null);

      waveCheckTimer += dt;
      if (waveCheckTimer > 2) {
        waveCheckTimer = 0;
        if (ai.aliveCount === 0) {
          gameWave++;
          if (gameWave > 5) setPhase('victory');
          else { setWave(gameWave); spawnWave(scene, gameWave, ai, terrainResult.heightAt); addKill(`🌊 Wave ${gameWave} incoming!`); }
        }
      }

      // Unified follow-cam — replaces the inline spherical math that used
      // to live here. Smooth-lerps to the player's position so quick dodges
      // don't yank the camera. Yaw/pitch refs stay authoritative; we
      // already pushed user input into the rig in onMouseMove above.
      followCam.update(dt, player.position);
      composer.render();
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      composer.setSize(container.clientWidth, container.clientHeight);
      fxaaPass.uniforms['resolution'].value.set(1 / container.clientWidth, 1 / container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(coolTick);
      window.removeEventListener('keydown',  onKeyDown);
      window.removeEventListener('keyup',    onKeyUp);
      window.removeEventListener('resize',   onResize);
      container.removeEventListener('mousedown', onPointerDown);
      container.removeEventListener('mousemove', onMouseMove);
      player.dispose();
      ai.dispose();
      navRef.current?.dispose();
      navRef.current = null;
      renderer.forceContextLoss();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [spawnWave, spawnAllies, cycleTarget, getTarget, attackEnemy, addDmgNum, addKill, useSkill, harvestNode]);

  const gf = gameFlowRef.current;
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none" data-testid="island-battle-page">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-30">
        <Button size="sm" variant="ghost" className="bg-slate-900/80 border border-slate-600/50 text-white hover:bg-slate-800" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* ── Warband loadout panel: swap race / weapon style / armor ─────────── */}
      <div className="absolute top-3 right-3 z-40 w-64">
        <Button
          size="sm"
          variant="ghost"
          className="w-full bg-slate-900/85 border border-amber-600/50 text-amber-200 hover:bg-slate-800 font-serif"
          onClick={() => setShowWarband(v => !v)}
          data-testid="button-toggle-warband"
        >
          {showWarband ? 'Hide Warband' : 'Warband'}{charLoading ? ' …' : ''}
        </Button>
        {showWarband && (
          <div className="mt-2 bg-slate-900/92 border border-slate-700/60 rounded-lg p-3 space-y-3 text-xs max-h-[80vh] overflow-y-auto" data-testid="panel-warband">
            <div>
              <div className="text-slate-400 uppercase tracking-wide text-[10px] mb-1">Race</div>
              <div className="grid grid-cols-3 gap-1">
                {(['human','barbarian','dwarf','elf','orc','undead'] as Race[]).map(r => (
                  <button
                    key={r}
                    onClick={() => { void applyRace(r); }}
                    disabled={charLoading}
                    className={`px-1.5 py-1 rounded border capitalize transition-colors disabled:opacity-50 ${charRace === r ? 'bg-amber-700/80 border-amber-400 text-white' : 'bg-slate-800/70 border-slate-600/50 text-slate-300 hover:bg-slate-700'}`}
                    data-testid={`button-race-${r}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-slate-400 uppercase tracking-wide text-[10px] mb-1">Weapon Style</div>
              <div className="grid grid-cols-2 gap-1">
                {([
                  ['sword_shield','Sword & Shield'],
                  ['greatsword','Greatsword'],
                  ['axe','Axe'],
                  ['mace_shield','Mace & Shield'],
                  ['spear','Spear'],
                  ['bow','Bow'],
                  ['staff','Staff'],
                  ['gun','Firearm'],
                ] as [WeaponStyle, string][]).map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => applyStyle(s)}
                    disabled={charLoading}
                    className={`px-1.5 py-1 rounded border transition-colors disabled:opacity-50 ${charStyle === s ? 'bg-blue-700/80 border-blue-400 text-white' : 'bg-slate-800/70 border-slate-600/50 text-slate-300 hover:bg-slate-700'}`}
                    data-testid={`button-style-${s}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-slate-400 uppercase tracking-wide text-[10px] mb-1">Armor</div>
              <div className="space-y-1">
                {ARMOR_SLOTS.map(slot => {
                  const count = armorOpts[slot] ?? 0;
                  const cur = equippedArmor[slot] ?? null;
                  return (
                    <button
                      key={slot}
                      onClick={() => cycleArmor(slot)}
                      disabled={charLoading || count === 0}
                      className="w-full flex items-center justify-between px-2 py-1 rounded border border-slate-600/50 bg-slate-800/70 text-slate-300 hover:bg-slate-700 disabled:opacity-40 capitalize"
                      data-testid={`button-armor-${slot}`}
                    >
                      <span>{slot}</span>
                      <span className="text-[10px] text-slate-400">
                        {count === 0 ? 'none' : cur === null ? 'off' : `${cur + 1}/${count}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">Equipment changes apply to your live 3D character.</div>
          </div>
        )}

        {/* ── Ally companion gear: cycle each slot on the shared ally loadout ─── */}
        <Button
          size="sm"
          variant="ghost"
          className="w-full mt-2 bg-slate-900/85 border border-emerald-600/50 text-emerald-200 hover:bg-slate-800 font-serif"
          onClick={() => setShowAllyGear(v => !v)}
          data-testid="button-toggle-ally-gear"
        >
          {showAllyGear ? 'Hide Companion' : 'Companion Gear'}
        </Button>
        {showAllyGear && (
          <div className="mt-2 bg-slate-900/92 border border-slate-700/60 rounded-lg p-3 space-y-2 text-xs max-h-[80vh] overflow-y-auto" data-testid="panel-ally-gear">
            <div className="text-slate-400 uppercase tracking-wide text-[10px]">Companion Equipment</div>
            <div className="grid grid-cols-2 gap-1">
              {GEAR_SLOTS.map(slot => {
                const equipped = allyLoadout[slot]
                  ? gearCatalogue.find(g => g.id === allyLoadout[slot])
                  : undefined;
                const hasOptions = gearForSlot(gearCatalogue, slot).length > 0;
                return (
                  <button
                    key={slot}
                    onClick={() => cycleAllyGearSlot(slot)}
                    disabled={!hasOptions}
                    data-testid={`slot-ally-gear-${slot}`}
                    className={`flex flex-col items-start rounded px-2 py-1 text-left transition-colors ${
                      hasOptions
                        ? 'bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer'
                        : 'bg-slate-900/30 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-[9px] text-slate-500 uppercase capitalize">{slot}</span>
                    <span className={`text-[11px] truncate w-full ${equipped ? 'text-emerald-300' : 'text-slate-600'}`}>
                      {equipped ? equipped.name : '— empty —'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">Click a slot to cycle your companion's gear. Changes apply live and persist.</div>
          </div>
        )}
      </div>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex gap-2 items-center">
        <div className="bg-slate-900/80 border border-amber-600/50 rounded px-4 py-1 text-amber-300 font-serif text-sm" data-testid="text-wave-counter">
          Wave {wave} / 5
        </div>
        <div className="bg-slate-900/80 border border-yellow-600/50 rounded px-3 py-1 text-yellow-300 text-xs flex items-center gap-1" data-testid="text-gold">
          <Gem className="w-3 h-3" /> {gf.gold}g
        </div>
        <div className="bg-slate-900/80 border border-blue-600/50 rounded px-3 py-1 text-blue-300 text-xs" data-testid="text-level">
          Lv.{gf.player.level} ({gf.player.xp}/{gf.player.xpToNext} XP)
        </div>
      </div>

      <div className="absolute top-12 left-3 z-30 w-52">
        <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded bg-amber-900/60 border border-amber-700/50 flex items-center justify-center text-lg">🗡</div>
            <div className="flex-1">
              <p className="text-xs text-amber-300 font-serif font-bold">Your Captain</p>
              <p className="text-[10px] text-slate-400">Lv.{gf.player.level} Warlord</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-red-400 flex items-center gap-1"><Heart className="w-2.5 h-2.5" />HP</span>
              <span className="text-slate-300">{playerHp} / 500</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full transition-all duration-300" style={{ width: `${(playerHp / 500) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-blue-400 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />MP</span>
              <span className="text-slate-300">{playerMp} / 200</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full transition-all duration-300" style={{ width: `${(playerMp / 200) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {targetInfo && (
          <motion.div key="target" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-30 w-56">
            <div className="bg-slate-900/92 border border-red-800/60 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-red-950/60 border border-red-800/50 flex items-center justify-center text-base">☠</div>
                <div className="flex-1">
                  <p className="text-xs text-red-300 font-serif font-bold">{targetInfo.name}</p>
                  <p className="text-[10px] text-slate-400">Lv.{targetInfo.level} Enemy</p>
                </div>
                <button onClick={() => { setTargetInfo(null); aiRef.current?.setTarget(null); targetRef.current = null; }}
                  className="text-slate-500 hover:text-slate-300 text-xs" data-testid="button-deselect-target"><X className="w-3 h-3" /></button>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-red-400">HP</span>
                  <span className="text-slate-300">{targetInfo.hp} / {targetInfo.maxHp}</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-800 to-red-500 rounded-full transition-all duration-200" style={{ width: `${(targetInfo.hp / targetInfo.maxHp) * 100}%` }} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {harvestInfo && !targetInfo && (
          <motion.div key="harvest" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-30 w-52">
            <div className="bg-slate-900/92 border border-green-800/60 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2">
                <TreePine className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-300 font-bold">{harvestInfo.name}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-700 to-green-400 rounded-full transition-all duration-200" style={{ width: `${(harvestInfo.hp / harvestInfo.maxHp) * 100}%` }} />
              </div>
              <p className="text-[9px] text-green-400/60">Press E to harvest</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dockPrompt && (
          <motion.div key="dock" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30">
            <div className="bg-slate-900/90 border border-cyan-600/60 rounded-lg px-5 py-2 flex items-center gap-2">
              <Anchor className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-300 text-sm font-serif">Press E — Board Ship / Captain Mode</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-12 right-3 z-30 w-52 space-y-1">
        <AnimatePresence>
          {kills.slice(-4).map(k => (
            <motion.div key={k.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="bg-slate-900/80 border border-slate-700/40 rounded px-2 py-1 text-xs text-amber-200">{k.text}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      {Object.keys(resources).length > 0 && (
        <div className="absolute top-28 right-3 z-30 w-40">
          <div className="bg-slate-900/85 border border-slate-700/40 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 uppercase mb-1 flex items-center gap-1"><Pickaxe className="w-3 h-3" /> Resources</p>
            {Object.entries(resources).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px] py-0.5">
                <span className="text-slate-300">{k.replace(/_/g, ' ')}</span>
                <span className="text-amber-300 font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-20 pointer-events-none">
        <AnimatePresence>
          {dmgNums.map(d => (
            <motion.div key={d.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -50 }} transition={{ duration: 1.4 }}
              style={{ position: 'absolute', left: d.x, top: d.y, color: d.color, pointerEvents: 'none' }}
              className="font-bold text-base drop-shadow-lg select-none">{d.text}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Legacy GameHUD only renders with the dev escape hatch ?legacyhud=1 — */}
      {/* otherwise the Cinzel overlay below is the single character HUD.    */}
      {!isCinzelHudEnabled() && (
        <GameHUD
          mode="combat"
          slots={SKILLS.map(skill => ({
            id: skill.key,
            label: skill.label,
            icon: skill.icon,
            hotkey: skill.key.toUpperCase(),
            cooldown: skillCools[skill.key] ?? 0,
            maxCooldown: skill.cooldown,
            onClick: () => useSkill(skill.key),
          }))}
          secondarySlots={[
            { id: "lmb", label: "Attack", icon: "⚔", hotkey: "LMB" },
            { id: "rmb", label: "Heavy",  icon: "💥", hotkey: "RMB" },
          ]}
          secondaryLabel="Attacks"
          vitals={[
            { id: "hp", label: "HP", current: playerHp, max: 500, color: playerHp < 150 ? "#ef4444" : "#22c55e", icon: "heart" },
            { id: "mp", label: "MP", current: playerMp, max: 200, color: "#3b82f6", icon: "zap" },
          ]}
          hint="WASD Move · RMB Camera · Tab Target · C Panel · E Interact · 1-5 R F Z Skills"
        />
      )}

      {isCinzelHudEnabled() && (
        <CinzelOverlay
          state={buildHudOverride({
            hp: { current: playerHp, max: 500 },
            mp: { current: playerMp, max: 200 },
            fallback: { name: 'Captain', race: 'human', className: 'Warrior', level: gf.player.level },
          })}
          hideChat
        />
      )}

      <AnimatePresence>
        {showPanel && (
          <motion.div key="panel" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="absolute top-0 left-0 bottom-0 w-80 z-40 bg-slate-950/95 border-r border-amber-900/50 p-4 space-y-3 overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-amber-400 text-lg">Character</h2>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-white" data-testid="button-close-panel"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-slate-900/80 rounded-lg p-3 space-y-2">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-900/40 border-2 border-amber-700/50 flex items-center justify-center text-3xl mb-2">🗡</div>
                <p className="font-serif text-amber-300">Your Captain</p>
                <p className="text-xs text-slate-400">Warrior · Level {gf.player.level}</p>
                <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(gf.player.xp / gf.player.xpToNext) * 100}%` }} />
                </div>
                <p className="text-[9px] text-slate-500 mt-0.5">{gf.player.xp} / {gf.player.xpToNext} XP</p>
              </div>
            </div>
            <div className="space-y-1">
              {[
                { label: 'Attack', val: `${42 + gf.player.level * 3}-${68 + gf.player.level * 4}`, icon: '⚔' },
                { label: 'Defense', val: `${28 + gf.player.level * 2}`, icon: '🛡' },
                { label: 'Speed', val: '14', icon: '⚡' },
                { label: 'Crit', val: `${12 + gf.player.level}%`, icon: '💥' },
                { label: 'Gold', val: `${gf.gold}`, icon: '💰' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between bg-slate-900/60 rounded px-3 py-1">
                  <span className="text-xs text-slate-400">{s.icon} {s.label}</span>
                  <span className="text-xs text-amber-300 font-bold">{s.val}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs text-slate-400 uppercase mb-1">Equipment</h3>
              <div className="grid grid-cols-2 gap-1">
                {GEAR_SLOTS.map(slot => {
                  const equipped = playerLoadout[slot]
                    ? gearCatalogue.find(g => g.id === playerLoadout[slot])
                    : undefined;
                  const hasOptions = gearForSlot(gearCatalogue, slot).length > 0;
                  return (
                    <button
                      key={slot}
                      onClick={() => cycleGearSlot(slot)}
                      disabled={!hasOptions}
                      data-testid={`slot-gear-${slot}`}
                      className={`flex flex-col items-start rounded px-2 py-1 text-left transition-colors ${
                        hasOptions
                          ? 'bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer'
                          : 'bg-slate-900/30 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-[9px] text-slate-500 uppercase capitalize">{slot}</span>
                      <span className={`text-[11px] truncate w-full ${equipped ? 'text-amber-300' : 'text-slate-600'}`}>
                        {equipped ? equipped.name : '— empty —'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-600 mt-1">Click a slot to cycle gear</p>
            </div>
            <div>
              <h3 className="text-xs text-slate-400 uppercase mb-1">Skills</h3>
              <div className="space-y-0.5">
                {SKILLS.map(s => (
                  <div key={s.key} className="flex items-center gap-2 bg-slate-900/60 rounded px-2 py-0.5">
                    <span className="text-base">{s.icon}</span>
                    <span className="text-xs text-slate-300 flex-1">{s.label}</span>
                    <span className="text-[10px] text-slate-500">[{s.key.toUpperCase()}] {s.cooldown}s</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-slate-400 uppercase mb-1">Professions</h3>
              <div className="space-y-1">
                {(['mining','woodcutting','herbalism','skinning','fishing'] as Profession[]).map(prof => {
                  const p = gf.player.professions[prof];
                  return (
                    <div key={prof} className="bg-slate-900/60 rounded px-3 py-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 capitalize">{prof}</span>
                        <span className="text-amber-300">Lv.{p.level}</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${(p.xp / p.xpToNext) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {Object.keys(resources).length > 0 && (
              <div>
                <h3 className="text-xs text-slate-400 uppercase mb-1">Inventory</h3>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(resources).map(([k, v]) => (
                    <div key={k} className="bg-slate-900/60 rounded px-2 py-1 flex justify-between text-[10px]">
                      <span className="text-slate-300">{k.replace(/_/g, ' ')}</span>
                      <span className="text-amber-300 font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase !== 'playing' && (
          <motion.div key="endscreen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70">
            {phase === 'victory' ? (
              <>
                <Star className="w-16 h-16 text-amber-400 mb-4" />
                <h1 className="font-serif text-5xl text-amber-300 mb-2">Victory!</h1>
                <p className="text-slate-400 mb-2">All waves cleared!</p>
                <p className="text-amber-300 text-sm mb-6">+{xpGained} XP · {gf.gold}g earned</p>
              </>
            ) : (
              <>
                <Skull className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="font-serif text-5xl text-red-400 mb-2">Defeated</h1>
                <p className="text-slate-400 mb-6">You have fallen in battle.</p>
              </>
            )}
            <Button onClick={onBack} className="bg-amber-700 hover:bg-amber-600 text-white font-serif px-8" data-testid="button-return-menu">
              Return to Menu
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
