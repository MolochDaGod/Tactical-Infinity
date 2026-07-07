/**
 * fluffytree/tree.ts
 *
 * Core fluffy-tree generator. Builds a stylized low-poly tree from a tapered
 * trunk (cylinder) plus a cluster of icosphere "puffs" forming the crown.
 *
 * Two output shapes:
 *   - createFluffyTreeGroup(...)  → THREE.Group of separate Meshes (easy to tweak)
 *   - createFluffyTreeMesh(...)   → single THREE.Mesh with merged geometry +
 *                                   material groups (instanceable)
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLUFFY_PRESETS, type FluffyTreeKind, type FluffyTreePreset } from './presets';

// ── Tiny seeded RNG (mulberry32) ────────────────────────────────────────────
function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;
const range = (rng: () => number, [a, b]: [number, number]) => lerp(a, b, rng());

export interface FluffyTreeOptions {
  seed?:       number;
  scale?:      number;
  /** Override base leaf color (else picked from preset palette). */
  leafColor?:  THREE.ColorRepresentation;
  /** Override trunk color. */
  trunkColor?: THREE.ColorRepresentation;
  /** Lock crown radius multiplier (1 = preset). */
  crownScale?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Trunk + crown geometry generation                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function buildTrunk(p: FluffyTreePreset, rng: () => number, height: number) {
  const rTop = range(rng, p.trunkRadiusTop);
  const rBot = range(rng, p.trunkRadiusBot);
  const geo  = new THREE.CylinderGeometry(rTop, rBot, height, p.trunkSegments, 1);
  geo.translate(0, height / 2, 0);
  return geo;
}

function buildBranch(rng: () => number, trunkTopY: number) {
  const len    = 0.6 + rng() * 1.4;
  const radius = 0.04 + rng() * 0.06;
  const geo    = new THREE.CylinderGeometry(radius * 0.4, radius, len, 4, 1);
  geo.translate(0, len / 2, 0);

  // Tilt out from trunk
  const m = new THREE.Matrix4();
  const tilt   = (Math.PI / 4) + rng() * (Math.PI / 5);
  const yaw    = rng() * Math.PI * 2;
  const yStart = trunkTopY * (0.5 + rng() * 0.4);

  m.makeRotationZ(tilt);
  geo.applyMatrix4(m);
  m.makeRotationY(yaw);
  geo.applyMatrix4(m);
  geo.translate(0, yStart, 0);
  return geo;
}

function buildCrownPuffs(p: FluffyTreePreset, rng: () => number, trunkTopY: number, crownScale: number) {
  const count = Math.floor(range(rng, p.puffCount));
  const puffs: THREE.BufferGeometry[] = [];
  if (count === 0) return puffs;

  const baseY = trunkTopY * p.puffYStart;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const r = range(rng, p.puffRadius) * crownScale;

    let x: number, y: number, z: number;
    if (p.conical) {
      // Pine: stack puffs vertically, shrink with height
      const layerR = lerp(r, r * 0.35, t);
      x = (rng() - 0.5) * 0.2;
      z = (rng() - 0.5) * 0.2;
      y = baseY + t * (trunkTopY * 0.55);
      const geo = new THREE.IcosahedronGeometry(layerR, p.puffSegments);
      geo.scale(1.0, 0.85, 1.0);
      geo.translate(x, y, z);
      puffs.push(geo);
    } else if (p.puffSpread[1] > 1.4) {
      // Palm: radial fan around trunk top
      const ang  = (i / count) * Math.PI * 2 + rng() * 0.3;
      const rad  = range(rng, p.puffSpread);
      x = Math.cos(ang) * rad;
      z = Math.sin(ang) * rad;
      y = trunkTopY + range(rng, p.puffYSpread);
      const geo = new THREE.IcosahedronGeometry(r, p.puffSegments);
      geo.scale(1.4, 0.5, 1.4);
      // Tilt outward
      const m = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-z, 0, x).normalize(), 0.35);
      geo.applyMatrix4(m);
      geo.translate(x, y, z);
      puffs.push(geo);
    } else {
      // Round fluffy crown
      const ang  = rng() * Math.PI * 2;
      const rad  = range(rng, p.puffSpread);
      x = Math.cos(ang) * rad;
      z = Math.sin(ang) * rad;
      y = trunkTopY + range(rng, p.puffYSpread);
      const geo = new THREE.IcosahedronGeometry(r, p.puffSegments);
      geo.translate(x, y, z);
      puffs.push(geo);
    }
  }

  return puffs;
}

/** Color the crown puffs by tinting their vertex colors from the leaf palette. */
function applyVertexColors(geo: THREE.BufferGeometry, color: THREE.Color) {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3 + 0] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Public APIs                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface FluffyTreeBuilt {
  /** Single merged geometry: groups[0] = trunk material, groups[1] = leaf material. */
  geometry:       THREE.BufferGeometry;
  trunkMaterial:  THREE.Material;
  leafMaterial:   THREE.Material;
  height:         number;
  crownRadius:    number;
}

export function createFluffyTreeMesh(kind: FluffyTreeKind, opts: FluffyTreeOptions = {}): FluffyTreeBuilt {
  const preset = FLUFFY_PRESETS[kind];
  const rng    = makeRng(opts.seed ?? Math.floor(Math.random() * 0x7fffffff));

  const height     = range(rng, preset.trunkHeight) * (opts.scale ?? 1);
  const crownScale = (opts.scale ?? 1) * (opts.crownScale ?? 1);

  const trunkGeo = buildTrunk(preset, rng, height);

  const branchGeos: THREE.BufferGeometry[] = [];
  if (preset.hasBranches) {
    const n = Math.floor(range(rng, preset.branchCount));
    for (let i = 0; i < n; i++) branchGeos.push(buildBranch(rng, height));
  }

  const puffGeos = preset.hasLeaves
    ? buildCrownPuffs(preset, rng, height, crownScale)
    : [];

  // Color leaf puffs from palette (vertex colors so we share one material).
  const palette = preset.leafColors.map(c => new THREE.Color(opts.leafColor ?? c));
  for (let i = 0; i < puffGeos.length; i++) {
    const c = palette.length ? palette[i % palette.length] : new THREE.Color(0x4a8a3a);
    applyVertexColors(puffGeos[i], c);
  }

  // Trunk + branches use a single trunk color (no vertex colors needed, but
  // mergeGeometries requires uniform attributes — give them flat vertex colors).
  const trunkColor = new THREE.Color(opts.trunkColor ?? preset.trunkColor);
  applyVertexColors(trunkGeo, trunkColor);
  for (const b of branchGeos) applyVertexColors(b, trunkColor);

  // mergeGeometries() returns null whenever any two inputs disagree on
  // indexed/non-indexed state OR have mismatched attributes. Trunk uses
  // CylinderGeometry (indexed); crown puffs use IcosahedronGeometry
  // (non-indexed in three.js). Normalize *all* inputs to non-indexed before
  // merging — this is the only layout that's guaranteed compatible across
  // every primitive three.js gives us.
  const trunkParts = [trunkGeo, ...branchGeos].map(g => g.index ? g.toNonIndexed() : g);
  const leafParts  = puffGeos.map(g => g.index ? g.toNonIndexed() : g);

  const trunkMerged  = mergeGeometries(trunkParts, false);
  const leavesMerged = leafParts.length ? mergeGeometries(leafParts, false) : null;

  if (!trunkMerged) {
    // Should never happen now that we normalized — but fail loud, not silent.
    throw new Error('fluffytree: trunk merge failed even after toNonIndexed()');
  }

  let merged: THREE.BufferGeometry;
  if (leavesMerged) {
    const result = mergeGeometries([trunkMerged, leavesMerged], true); // useGroups=true
    if (!result) {
      throw new Error('fluffytree: trunk+leaves merge failed even after toNonIndexed()');
    }
    merged = result;
  } else {
    merged = trunkMerged;
    merged.clearGroups();
    merged.addGroup(0, merged.attributes.position.count, 0);
  }

  // Dispose intermediates — the toNonIndexed() copies as well as the originals.
  trunkGeo.dispose();
  for (const b of branchGeos) b.dispose();
  for (const g of puffGeos) g.dispose();
  for (const g of trunkParts) if (g !== trunkGeo && !branchGeos.includes(g)) g.dispose();
  for (const g of leafParts)  if (!puffGeos.includes(g)) g.dispose();
  if (trunkMerged !== merged) trunkMerged.dispose();
  leavesMerged?.dispose();

  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const trunkMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness:    0.95,
    metalness:    0.0,
    flatShading:  true,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness:    0.85,
    metalness:    0.0,
    flatShading:  true,
    side:         THREE.FrontSide,
  });

  // Approx crown radius for spacing/instancing logic.
  let crownRadius = 0;
  if (puffGeos.length) {
    crownRadius = preset.puffSpread[1] * crownScale + preset.puffRadius[1] * crownScale;
  }

  return { geometry: merged, trunkMaterial, leafMaterial, height, crownRadius };
}

export function createFluffyTreeGroup(kind: FluffyTreeKind, opts: FluffyTreeOptions = {}): THREE.Group {
  const built = createFluffyTreeMesh(kind, opts);
  const mesh  = new THREE.Mesh(built.geometry, [built.trunkMaterial, built.leafMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.name = `fluffy_${kind}`;
  group.add(mesh);

  // userData hooks for downstream systems (instanced scatter, BVH, etc.)
  group.userData.fluffytree = {
    kind,
    height:      built.height,
    crownRadius: built.crownRadius,
  };
  return group;
}
