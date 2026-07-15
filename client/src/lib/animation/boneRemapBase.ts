/**
 * Static name remaps: Rigify DEF-* (Animated Base Character) → Mixamo / Bip001.
 *
 * Used by the offline bake script and runtime name-remap when a full T-pose
 * retarget is unavailable. Semantic retarget via `retargetClip` is preferred
 * when a live target skeleton exists.
 */

/** Rigify / DEF source leaf → Mixamo bone name. */
export const DEF_TO_MIXAMO: Record<string, string> = {
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
  // Alternate Rigify naming
  "DEF-upper_arm.L.001": "mixamorigLeftArm",
  "DEF-upper_arm.R.001": "mixamorigRightArm",
};

/** DEF → Unity Bip001 (grudge6). */
export const DEF_TO_BIP001: Record<string, string> = {
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

export type BakeTarget = "mixamo" | "bip001";

export function boneMapFor(target: BakeTarget): Record<string, string> {
  return target === "mixamo" ? DEF_TO_MIXAMO : DEF_TO_BIP001;
}

/**
 * Rewrite track names on a clip using a static bone map (leaf only).
 * Returns a NEW clip. Unmatched bones are dropped (fingers etc.).
 */
export function remapClipBoneNames(
  clip: import("three").AnimationClip,
  map: Record<string, string>,
): import("three").AnimationClip {
  // Lazy import type only — implementation uses runtime THREE if available.
  const THREE = (globalThis as unknown as { THREE?: typeof import("three") }).THREE;
  // When called from browser modules, import three normally via caller.
  // This function is re-exported from remapClipTracks below for browser use.
  void THREE;
  return clip; // placeholder replaced by remapClipTracks in BaseClipPack
}

/** Pure track-name rewrite for browser (takes THREE from import site). */
export function remapTracks(
  tracks: { name: string; clone: () => { name: string } }[],
  map: Record<string, string>,
): { name: string }[] {
  const out: { name: string }[] = [];
  for (const track of tracks) {
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) continue;
    const bonePath = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const slash = Math.max(bonePath.lastIndexOf("/"), bonePath.lastIndexOf("|"));
    const leaf = slash >= 0 ? bonePath.slice(slash + 1) : bonePath;
    const target = map[leaf] ?? map[leaf.replace(/^DEF-/, "DEF-")];
    if (!target) continue;
    const cloned = track.clone();
    cloned.name = target + prop;
    out.push(cloned);
  }
  return out;
}
