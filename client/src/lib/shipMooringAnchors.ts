/**
 * Ship mooring anchors — visual iron anchors from the canonical anchors.glb pack.
 *
 * Pack layout (models/ships/anchors.glb on R2 CDN):
 *   Anchor1  → standard admiralty
 *   Acnhor2  → complex (source typo preserved)
 *   Anchor3  → cross
 *   Anchor4  → quadruple
 *   Anchor5  → spiral
 *
 * Used on open-world ships as stowed bow/stern mooring gear. When a ship is
 * near-stationary (docked / at rest), the anchor lowers under the bow; when
 * under way it stows against the hull.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveGrudgeAssetUrl } from '@/lib/grudgeAssetConfig';

export const SHIP_ANCHORS_R2_KEY = 'models/ships/anchors.glb';
export const SHIP_ANCHORS_LOCAL_PATH = '/models/ships/anchors.glb';

export type MooringAnchorVariant =
  | 'standard'
  | 'complex'
  | 'cross'
  | 'quadruple'
  | 'spiral';

/** Mesh-name substrings used to isolate each variant from the multi-mesh pack. */
export const MOORING_VARIANT_MESH: Record<MooringAnchorVariant, string> = {
  standard: 'Anchor1',
  complex: 'Acnhor2', // source typo in GLB
  cross: 'Anchor3',
  quadruple: 'Anchor4',
  spiral: 'Anchor5',
};

export const MOORING_VARIANT_IDS: MooringAnchorVariant[] = [
  'standard',
  'complex',
  'cross',
  'quadruple',
  'spiral',
];

/** Ship-type → preferred mooring look (small boats get simpler hooks). */
export const SHIP_TYPE_MOORING: Record<string, MooringAnchorVariant> = {
  skiff: 'standard',
  sloop: 'standard',
  cutter: 'cross',
  schooner: 'complex',
  brigantine: 'quadruple',
  galleon: 'spiral',
  frigate: 'quadruple',
  small: 'standard',
  medium: 'complex',
  large: 'quadruple',
  ghost: 'spiral',
  pirateSmall: 'standard',
  pirateMedium: 'complex',
  pirateLarge: 'spiral',
};

const templateCache = new Map<MooringAnchorVariant, THREE.Group>();
let packRoot: THREE.Group | null = null;
let loadPromise: Promise<void> | null = null;

function getLoader(): GLTFLoader {
  return new GLTFLoader();
}

export function resolveShipAnchorsUrl(): string {
  return resolveGrudgeAssetUrl(SHIP_ANCHORS_LOCAL_PATH);
}

function isolateVariant(root: THREE.Object3D, variant: MooringAnchorVariant): THREE.Group {
  const needle = MOORING_VARIANT_MESH[variant].toLowerCase();
  const group = new THREE.Group();
  group.name = `mooring_anchor_${variant}`;

  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (found) return;
    const n = (child.name || '').toLowerCase();
    if (n.includes(needle) && child instanceof THREE.Mesh) {
      found = child;
    }
  });

  if (!found) {
    // Fallback: first mesh in pack if name match fails
    root.traverse((child) => {
      if (!found && child instanceof THREE.Mesh) found = child;
    });
  }

  if (found) {
    const clone = (found as THREE.Object3D).clone(true);
    // Normalize: center XZ, sit stock/ring at local origin top
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    clone.position.sub(center);
    // Lift so the top of the ring is near y=0 (hangs down when parent at waterline)
    clone.position.y += size.y / 2;
    clone.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        c.frustumCulled = true;
      }
    });
    group.add(clone);
    // Store natural height for scale fitting
    (group.userData as { naturalHeight?: number }).naturalHeight = size.y || 1;
  }

  return group;
}

/** Load the multi-mesh pack once and cache per-variant templates. */
export async function preloadMooringAnchors(): Promise<void> {
  if (templateCache.size === MOORING_VARIANT_IDS.length) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const url = resolveShipAnchorsUrl();
    try {
      const gltf = await getLoader().loadAsync(url);
      packRoot = gltf.scene;
      for (const variant of MOORING_VARIANT_IDS) {
        templateCache.set(variant, isolateVariant(packRoot, variant));
      }
      console.log(
        `[shipMooringAnchors] loaded ${templateCache.size} variants from ${url}`,
      );
    } catch (err) {
      console.warn(`[shipMooringAnchors] failed to load ${url}`, err);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function getMooringVariantForShip(shipType: string): MooringAnchorVariant {
  return SHIP_TYPE_MOORING[shipType] ?? 'standard';
}

/**
 * Clone a mooring anchor mesh sized for a hull.
 * @param targetHeightMeters desired hanging length (~0.6–1.4 for sloop–galleon)
 */
export function cloneMooringAnchor(
  variant: MooringAnchorVariant,
  targetHeightMeters = 1.0,
): THREE.Group | null {
  const tpl = templateCache.get(variant);
  if (!tpl) return null;
  const clone = tpl.clone(true);
  const natural = (tpl.userData as { naturalHeight?: number }).naturalHeight || 1;
  const scale = targetHeightMeters / Math.max(natural, 0.01);
  clone.scale.setScalar(scale);
  return clone;
}

export interface MooringAttachment {
  group: THREE.Group;
  mesh: THREE.Group;
  variant: MooringAnchorVariant;
  /** 0 = fully stowed against hull, 1 = fully lowered into water */
  deployment: number;
  targetDeployment: number;
  stowedLocal: THREE.Vector3;
  loweredLocal: THREE.Vector3;
}

/**
 * Attach a visual mooring anchor under the bow of a ship mesh.
 * Ship-local coords: +Z bow, +Y up (matches ShipRig convention).
 * Call after the ship's innerGroup exists; attach to the ship root so the
 * PI-flip on inner hull doesn't invert the hanging pose twice.
 */
export function attachMooringAnchorToShip(
  shipRoot: THREE.Object3D,
  shipType: string,
  hullLength = 10,
  hullHeight = 2,
): MooringAttachment | null {
  const variant = getMooringVariantForShip(shipType);
  const targetH = Math.max(0.55, Math.min(1.6, hullHeight * 0.55));
  const mesh = cloneMooringAnchor(variant, targetH);
  if (!mesh) return null;

  const group = new THREE.Group();
  group.name = 'mooring_anchor_rig';
  group.add(mesh);

  // Stowed: tucked under bowsprit / bow flare, slightly forward of center
  const bowZ = hullLength * 0.42;
  const stowedLocal = new THREE.Vector3(0, hullHeight * 0.35, bowZ);
  // Lowered: hanging below waterline at the bow
  const loweredLocal = new THREE.Vector3(0, -targetH * 0.85, bowZ * 0.95);

  group.position.copy(stowedLocal);
  // Hang chain-down: rotate so flukes point slightly aft when stowed
  mesh.rotation.set(0.15, 0, 0);

  shipRoot.add(group);

  return {
    group,
    mesh,
    variant,
    deployment: 0,
    targetDeployment: 0,
    stowedLocal,
    loweredLocal,
  };
}

/** Smoothly blend stowed ↔ lowered based on ship speed / dock intent. */
export function updateMooringDeployment(
  att: MooringAttachment,
  dt: number,
  shipSpeed: number,
  forceLowered = false,
): void {
  // Lower when nearly stopped or explicitly docking; raise under way
  const nearStop = shipSpeed < 0.35;
  att.targetDeployment = forceLowered || nearStop ? 1 : 0;

  const rate = 1.4; // ~0.7s full travel
  if (att.deployment < att.targetDeployment) {
    att.deployment = Math.min(att.targetDeployment, att.deployment + rate * dt);
  } else if (att.deployment > att.targetDeployment) {
    att.deployment = Math.max(att.targetDeployment, att.deployment - rate * dt);
  }

  att.group.position.lerpVectors(att.stowedLocal, att.loweredLocal, att.deployment);
  // Slight swing when lowering
  const swing = Math.sin(att.deployment * Math.PI) * 0.12;
  att.mesh.rotation.z = swing;
  att.mesh.rotation.x = 0.15 + att.deployment * 0.35;
}

/** Async helper: preload pack then attach. Safe to call fire-and-forget. */
export async function ensureMooringOnShip(
  shipRoot: THREE.Object3D,
  shipType: string,
  hullLength = 10,
  hullHeight = 2,
): Promise<MooringAttachment | null> {
  await preloadMooringAnchors();
  // Avoid double-attach
  if (shipRoot.getObjectByName('mooring_anchor_rig')) {
    return null;
  }
  return attachMooringAnchorToShip(shipRoot, shipType, hullLength, hullHeight);
}

export function clearMooringCache(): void {
  templateCache.clear();
  packRoot = null;
  loadPromise = null;
}
