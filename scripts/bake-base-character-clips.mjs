#!/usr/bin/env node
/**
 * Offline-ish bake: parse Animated Base Character.glb and write semantic
 * clip manifests for mixamo / bip001 bone-name remaps.
 *
 * Full T-pose mathematical retarget still needs a live skeleton in-engine
 * (BaseClipPack.retargetBaseRole). This script ships:
 *   - public/animations/base/base-roles.json  (semantic map)
 *   - public/animations/base/bone-maps.json   (DEF → mixamo / bip001)
 *
 * Usage:
 *   node scripts/bake-base-character-clips.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GLB = path.join(ROOT, "client/public/animations/base/animated-base-character.glb");
const OUT_DIR = path.join(ROOT, "client/public/animations/base");

const DEF_TO_MIXAMO = {
  root: "mixamorigHips",
  "DEF-hips": "mixamorigHips",
  "DEF-spine.001": "mixamorigSpine",
  "DEF-spine.002": "mixamorigSpine1",
  "DEF-spine.003": "mixamorigSpine2",
  "DEF-neck": "mixamorigNeck",
  "DEF-head": "mixamorigHead",
  "DEF-shoulder.L": "mixamorigLeftShoulder",
  "DEF-upper_arm.L": "mixamorigLeftArm",
  "DEF-forearm.L": "mixamorigLeftForeArm",
  "DEF-hand.L": "mixamorigLeftHand",
  "DEF-shoulder.R": "mixamorigRightShoulder",
  "DEF-upper_arm.R": "mixamorigRightArm",
  "DEF-forearm.R": "mixamorigRightForeArm",
  "DEF-hand.R": "mixamorigRightHand",
  "DEF-thigh.L": "mixamorigLeftUpLeg",
  "DEF-shin.L": "mixamorigLeftLeg",
  "DEF-foot.L": "mixamorigLeftFoot",
  "DEF-toe.L": "mixamorigLeftToeBase",
  "DEF-thigh.R": "mixamorigRightUpLeg",
  "DEF-shin.R": "mixamorigRightLeg",
  "DEF-foot.R": "mixamorigRightFoot",
  "DEF-toe.R": "mixamorigRightToeBase",
};

const DEF_TO_BIP001 = {
  root: "Bip001",
  "DEF-hips": "Bip001 Pelvis",
  "DEF-spine.001": "Bip001 Spine",
  "DEF-spine.002": "Bip001 Spine1",
  "DEF-spine.003": "Bip001 Spine2",
  "DEF-neck": "Bip001 Neck",
  "DEF-head": "Bip001 Head",
  "DEF-shoulder.L": "Bip001 L Clavicle",
  "DEF-upper_arm.L": "Bip001 L UpperArm",
  "DEF-forearm.L": "Bip001 L Forearm",
  "DEF-hand.L": "Bip001 L Hand",
  "DEF-shoulder.R": "Bip001 R Clavicle",
  "DEF-upper_arm.R": "Bip001 R UpperArm",
  "DEF-forearm.R": "Bip001 R Forearm",
  "DEF-hand.R": "Bip001 R Hand",
  "DEF-thigh.L": "Bip001 L Thigh",
  "DEF-shin.L": "Bip001 L Calf",
  "DEF-foot.L": "Bip001 L Foot",
  "DEF-toe.L": "Bip001 L Toe0",
  "DEF-thigh.R": "Bip001 R Thigh",
  "DEF-shin.R": "Bip001 R Calf",
  "DEF-foot.R": "Bip001 R Foot",
  "DEF-toe.R": "Bip001 R Toe0",
};

const ROLES = {
  idle: { glb: "Rig|Idle_Loop", stripRoot: true, loop: true },
  walk: { glb: "Rig|Walk_Loop", stripRoot: true, loop: true },
  jog: { glb: "Rig|Jog_Fwd_Loop", stripRoot: true, loop: true },
  sprint: { glb: "Rig|Sprint_Loop", stripRoot: true, loop: true },
  roll: { glb: "Rig|Roll", stripRoot: true, loop: false },
  roll_rm: { glb: "Rig|Roll_RM", stripRoot: false, loop: false },
  jump_start: { glb: "Rig|Jump_Start", stripRoot: true, loop: false },
  jump_loop: { glb: "Rig|Jump_Loop", stripRoot: true, loop: true },
  jump_land: { glb: "Rig|Jump_Land", stripRoot: true, loop: false },
  attack_melee: { glb: "Rig|Sword_Attack", stripRoot: true, loop: false, upperBody: true },
  attack_punch: { glb: "Rig|Punch_Jab", stripRoot: true, loop: false, upperBody: true },
  cast_enter: { glb: "Rig|Spell_Simple_Enter", stripRoot: true, loop: false, upperBody: true },
  cast_loop: { glb: "Rig|Spell_Simple_Idle_Loop", stripRoot: true, loop: true, upperBody: true },
  cast_shoot: { glb: "Rig|Spell_Simple_Shoot", stripRoot: true, loop: false, upperBody: true },
  cast_exit: { glb: "Rig|Spell_Simple_Exit", stripRoot: true, loop: false, upperBody: true },
  hit: { glb: "Rig|Hit_Chest", stripRoot: true, loop: false },
  death: { glb: "Rig|Death01", stripRoot: true, loop: false },
  pistol_shoot: { glb: "Rig|Pistol_Shoot", stripRoot: true, loop: false, upperBody: true },
};

function parseGlbJson(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const length = dv.getUint32(8, true);
  let offset = 12;
  while (offset < length) {
    const chunkLen = dv.getUint32(offset, true);
    offset += 4;
    const chunkType = dv.getUint32(offset, true);
    offset += 4;
    const chunk = buf.subarray(offset, offset + chunkLen);
    offset += chunkLen;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(new TextDecoder().decode(chunk));
    }
  }
  throw new Error("No JSON chunk in GLB");
}

if (!fs.existsSync(GLB)) {
  console.error("Missing GLB:", GLB);
  process.exit(1);
}

const buf = fs.readFileSync(GLB);
const json = parseGlbJson(buf);
const animNames = (json.animations || []).map((a) => a.name || "(unnamed)");
const nodes = json.nodes || [];
const jointIndices = json.skins?.[0]?.joints || [];
const bones = jointIndices.map((i) => nodes[i]?.name).filter(Boolean);

const rolesOut = {};
for (const [role, def] of Object.entries(ROLES)) {
  const found = animNames.includes(def.glb);
  rolesOut[role] = {
    libraryKey: `base/${role}`,
    glbName: def.glb,
    stripRoot: !!def.stripRoot,
    upperBody: !!def.upperBody,
    loop: !!def.loop,
    presentInGlb: found,
  };
}

const manifest = {
  source: "animated-base-character.glb",
  bakedAt: new Date().toISOString(),
  animationCount: animNames.length,
  animations: animNames,
  bonesSample: bones.slice(0, 40),
  roles: rolesOut,
  note:
    "Runtime: loadBaseCharacterPack() registers base/* with stripRoot. " +
    "Retarget live via retargetBaseRole(role, skeletonRoot). " +
    "Static maps DEF_TO_MIXAMO / DEF_TO_BIP001 for name-remap bake.",
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "base-roles.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(
  path.join(OUT_DIR, "bone-maps.json"),
  JSON.stringify({ mixamo: DEF_TO_MIXAMO, bip001: DEF_TO_BIP001 }, null, 2),
);

const missing = Object.entries(rolesOut).filter(([, v]) => !v.presentInGlb);
console.log(`Wrote ${path.join(OUT_DIR, "base-roles.json")}`);
console.log(`Wrote ${path.join(OUT_DIR, "bone-maps.json")}`);
console.log(`GLB animations: ${animNames.length}, bones: ${bones.length}`);
console.log(`Roles mapped: ${Object.keys(rolesOut).length}, missing: ${missing.length}`);
if (missing.length) console.warn("Missing:", missing.map(([k]) => k).join(", "));
