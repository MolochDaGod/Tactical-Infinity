/**
 * Stonewisp Beast — asset inventory + runtime discovery helpers.
 *
 * Canonical path (TI public / CDN):
 *   /models/scenes/stonewisp_beast/scene.gltf  (+ scene.bin + textures/)
 *
 * Described in IntroScene as a "mutant stingray" sea terror.
 * Materials (from cdnManifest texture names):
 *   Body · Eyes · Teeth · Tentacles
 *   maps: baseColor, normal, metallicRoughness, emissive
 *
 * Animations used by intro (name includes):
 *   Swim · Intimidate · Inspect  (+ any others in the GLB)
 *
 * NOTE: Binary may be LFS/CDN-only. When the GLB is present, call
 * `analyzeStonewisp(root, clips)` after load for live skeleton dump.
 */

import * as THREE from 'three';

export const STONEWISP_GLTF_PATH = '/models/scenes/stonewisp_beast/scene.gltf';
export const STONEWISP_CDN_PATH =
  'https://assets.grudge-studio.com/models/scenes/stonewisp_beast/scene.gltf';

/** Material / mesh groups expected on the asset */
export const STONEWISP_MESH_GROUPS = [
  'Body',
  'Eyes',
  'Teeth',
  'Tentacles',
] as const;

/** Intro fight clip matchers (substring, case-insensitive) */
export const STONEWISP_ANIM_MATCHERS = {
  swim: /swim|swim_fwd|locomotion|idle_swim/i,
  intimidate: /intimidate|roar|threat|scream|attack|strike/i,
  inspect: /inspect|look|curious|idle/i,
  hit: /hit|react|flinch|damage/i,
  death: /death|die|sink/i,
} as const;

export type StonewispAnimRole = keyof typeof STONEWISP_ANIM_MATCHERS;

export interface StonewispBoneInfo {
  name: string;
  index: number;
  depth: number;
  parentName: string | null;
  childNames: string[];
  worldPos: [number, number, number];
}

export interface StonewispTentacleChain {
  id: string;
  /** Root → tip (bones only) */
  bones: THREE.Bone[];
  boneNames: string[];
  length: number;
  /** Tip bone for IK end effector */
  tip: THREE.Bone;
  root: THREE.Bone;
}

export interface StonewispAnalysis {
  meshNames: string[];
  materialNames: string[];
  boneNames: string[];
  bones: StonewispBoneInfo[];
  skeletons: number;
  skinnedMeshes: string[];
  tentacleChains: StonewispTentacleChain[];
  animationNames: string[];
  animRoles: Partial<Record<StonewispAnimRole, string>>;
  hasSkin: boolean;
  notes: string[];
}

const TENTACLE_BONE_RE =
  /tentacle|tent|arm|limb|appendage|tendril|whip|feeler|spine|tail|fin_?arm/i;
const TIP_RE = /tip|end|end_?bone|ik|effector|nub|finger|digit/i;

function boneDepth(bone: THREE.Bone): number {
  let d = 0;
  let p: THREE.Object3D | null = bone.parent;
  while (p) {
    d++;
    p = p.parent;
  }
  return d;
}

/**
 * Discover tentacle-like chains from skeleton.
 * Prefers bones whose names match tentacle/arm/tendril; builds root→tip paths.
 */
export function discoverTentacleChains(root: THREE.Object3D): StonewispTentacleChain[] {
  const chains: StonewispTentacleChain[] = [];
  const bones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });

  if (bones.length === 0) {
    // Unskinned fallback: chain Object3Ds named tentacle*
    const nodes: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (TENTACLE_BONE_RE.test(o.name) && o.children.length >= 0) nodes.push(o);
    });
    // Group by top-level tentacle root
    const roots = nodes.filter(
      (n) => !n.parent || !TENTACLE_BONE_RE.test(n.parent.name),
    );
    roots.forEach((r, i) => {
      const chain: THREE.Object3D[] = [];
      let cur: THREE.Object3D | null = r;
      while (cur) {
        chain.push(cur);
        const next = cur.children.find((c) => TENTACLE_BONE_RE.test(c.name) || TIP_RE.test(c.name));
        cur = next ?? null;
        if (chain.length > 24) break;
      }
      if (chain.length >= 2) {
        // Fake as bones via Object3D cast — IK will use Object3D rotation
        chains.push({
          id: `obj_tentacle_${i}`,
          bones: chain as unknown as THREE.Bone[],
          boneNames: chain.map((c) => c.name),
          length: chain.length,
          tip: chain[chain.length - 1] as unknown as THREE.Bone,
          root: chain[0] as unknown as THREE.Bone,
        });
      }
    });
    return chains;
  }

  // Find tips: tentacle bones with no tentacle children (or name tip)
  const tentBones = bones.filter((b) => TENTACLE_BONE_RE.test(b.name));
  const tips = tentBones.filter((b) => {
    if (TIP_RE.test(b.name)) return true;
    const tentKids = b.children.filter(
      (c) => (c as THREE.Bone).isBone && TENTACLE_BONE_RE.test(c.name),
    );
    return tentKids.length === 0;
  });

  const used = new Set<string>();
  tips.forEach((tip, i) => {
    const chain: THREE.Bone[] = [];
    let cur: THREE.Object3D | null = tip;
    while (cur && (cur as THREE.Bone).isBone) {
      const b = cur as THREE.Bone;
      if (TENTACLE_BONE_RE.test(b.name) || TIP_RE.test(b.name) || chain.length > 0) {
        chain.unshift(b);
      }
      // Stop at body/root once we leave tentacle region
      const parent = b.parent;
      if (!parent || !(parent as THREE.Bone).isBone) break;
      if (
        chain.length > 1
        && !TENTACLE_BONE_RE.test(parent.name)
        && !TIP_RE.test(parent.name)
      ) {
        break;
      }
      cur = parent;
      if (chain.length > 20) break;
    }
    if (chain.length < 2) return;
    const id = chain.map((b) => b.name).join('>') || `tentacle_${i}`;
    if (used.has(id)) return;
    used.add(id);
    chains.push({
      id: `tentacle_${i}_${chain[0].name}`,
      bones: chain,
      boneNames: chain.map((b) => b.name),
      length: chain.length,
      tip: chain[chain.length - 1],
      root: chain[0],
    });
  });

  // If no tips found, split tentacle bones by root name prefix
  if (chains.length === 0 && tentBones.length >= 2) {
    const byRoot = new Map<string, THREE.Bone[]>();
    for (const b of tentBones) {
      const key = b.name.replace(/[_\.]?\d+$/, '').slice(0, 12);
      if (!byRoot.has(key)) byRoot.set(key, []);
      byRoot.get(key)!.push(b);
    }
    let i = 0;
    for (const [, group] of byRoot) {
      group.sort((a, b) => boneDepth(a) - boneDepth(b));
      if (group.length < 2) continue;
      chains.push({
        id: `tentacle_group_${i++}`,
        bones: group,
        boneNames: group.map((b) => b.name),
        length: group.length,
        tip: group[group.length - 1],
        root: group[0],
      });
    }
  }

  return chains;
}

export function matchAnimRole(
  clips: THREE.AnimationClip[],
  role: StonewispAnimRole,
): THREE.AnimationClip | null {
  const re = STONEWISP_ANIM_MATCHERS[role];
  return clips.find((c) => re.test(c.name)) ?? null;
}

/** Full analysis after GLTF load — call once for debug / docs dump */
export function analyzeStonewisp(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[] = [],
): StonewispAnalysis {
  const meshNames: string[] = [];
  const materialNames = new Set<string>();
  const bones: StonewispBoneInfo[] = [];
  const boneNames: string[] = [];
  const skinnedMeshes: string[] = [];
  let skeletons = 0;
  const notes: string[] = [];

  root.updateMatrixWorld(true);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      meshNames.push(m.name || '(unnamed_mesh)');
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes.push(m.name);
        skeletons++;
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (mat?.name) materialNames.add(mat.name);
      });
    }
    if ((o as THREE.Bone).isBone) {
      const b = o as THREE.Bone;
      boneNames.push(b.name);
      const wp = new THREE.Vector3();
      b.getWorldPosition(wp);
      bones.push({
        name: b.name,
        index: bones.length,
        depth: boneDepth(b),
        parentName: b.parent && (b.parent as THREE.Bone).isBone ? b.parent.name : b.parent?.name ?? null,
        childNames: b.children.filter((c) => (c as THREE.Bone).isBone).map((c) => c.name),
        worldPos: [wp.x, wp.y, wp.z],
      });
    }
  });

  const tentacleChains = discoverTentacleChains(root);
  const animationNames = clips.map((c) => c.name);
  const animRoles: Partial<Record<StonewispAnimRole, string>> = {};
  (Object.keys(STONEWISP_ANIM_MATCHERS) as StonewispAnimRole[]).forEach((role) => {
    const clip = matchAnimRole(clips, role);
    if (clip) animRoles[role] = clip.name;
  });

  if (boneNames.length === 0) {
    notes.push('No THREE.Bone nodes — may be morph/rigid hierarchy; tentacle IK uses Object3D chains.');
  }
  if (tentacleChains.length === 0) {
    notes.push('No tentacle chains discovered by name. Check bone names (tentacle/arm/tendril) or mesh groups.');
  }
  if (!animRoles.swim && !animRoles.intimidate) {
    notes.push('Swim/Intimidate clips not matched — will play first available clip.');
  }
  if (skinnedMeshes.length === 0) {
    notes.push('No SkinnedMesh — animations may still drive node transforms.');
  }

  return {
    meshNames,
    materialNames: [...materialNames],
    boneNames,
    bones,
    skeletons,
    skinnedMeshes,
    tentacleChains,
    animationNames,
    animRoles,
    hasSkin: skinnedMeshes.length > 0,
    notes,
  };
}

export function formatStonewispReport(a: StonewispAnalysis): string {
  const lines = [
    '# Stonewisp Beast Analysis',
    '',
    `Meshes (${a.meshNames.length}): ${a.meshNames.join(', ') || '—'}`,
    `Materials: ${a.materialNames.join(', ') || '—'}`,
    `SkinnedMeshes: ${a.skinnedMeshes.join(', ') || '—'}`,
    `Bones (${a.boneNames.length}):`,
    ...a.bones.slice(0, 80).map(
      (b) => `  - ${b.name} (depth ${b.depth}) parent=${b.parentName ?? '∅'} kids=[${b.childNames.join(', ')}]`,
    ),
    a.bones.length > 80 ? `  … +${a.bones.length - 80} more` : '',
    '',
    `Tentacle chains (${a.tentacleChains.length}):`,
    ...a.tentacleChains.map(
      (c) => `  - ${c.id}: ${c.boneNames.join(' → ')} (n=${c.length})`,
    ),
    '',
    `Animations (${a.animationNames.length}): ${a.animationNames.join(', ') || '—'}`,
    `Roles: ${JSON.stringify(a.animRoles)}`,
    '',
    'Notes:',
    ...a.notes.map((n) => `  - ${n}`),
  ];
  return lines.filter(Boolean).join('\n');
}
