import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  BOAT_IDS,
  getBoat,
  getBoatModelPath,
  resolveBoatId,
  type BoatId,
} from '@shared/gameDefinitions/boatRegistry';

const CDN_BASE =
  (import.meta.env.VITE_ASSETS_CDN_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://assets.grudge-studio.com';

/** In-memory template cache — clone per ship instance. */
const templateCache = new Map<string, THREE.Group>();
const inflight = new Map<string, Promise<THREE.Group | null>>();

let sharedLoader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader();
  return sharedLoader;
}

/** Resolve a boat model path: local in dev, CDN in production when configured. */
export function resolveBoatModelUrl(boatId: string): string {
  const localPath = getBoatModelPath(boatId);
  if (import.meta.env.DEV) return localPath;
  const useCdn = import.meta.env.VITE_USE_ASSETS_CDN !== 'false';
  if (!useCdn) return localPath;
  return `${CDN_BASE}${localPath}`;
}

function prepareTemplate(scene: THREE.Object3D, scale: number): THREE.Group {
  const root = new THREE.Group();
  const model = scene.clone(true);
  model.scale.setScalar(scale);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  root.add(model);
  return root;
}

/** Load one boat GLB; returns null on failure (caller keeps procedural hull). */
export async function loadBoatTemplate(boatId: string): Promise<THREE.Group | null> {
  const canonical = resolveBoatId(boatId);
  const cacheKey = canonical;
  const cached = templateCache.get(cacheKey);
  if (cached) return cached.clone(true);

  const existing = inflight.get(cacheKey);
  if (existing) {
    const tpl = await existing;
    return tpl ? tpl.clone(true) : null;
  }

  const boat = getBoat(canonical);
  const url = resolveBoatModelUrl(canonical);

  const promise = (async () => {
    try {
      const gltf = await getLoader().loadAsync(url);
      const template = prepareTemplate(gltf.scene, boat.modelScale);
      templateCache.set(cacheKey, template);
      return template;
    } catch (err) {
      console.warn(`[boatAssetLoader] failed ${canonical} from ${url}`, err);
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  const template = await promise;
  return template ? template.clone(true) : null;
}

/** Preload all canonical playable boats — call before sailing scene mounts. */
export function preloadCanonicalBoats(): Promise<void> {
  return Promise.all(BOAT_IDS.map((id) => loadBoatTemplate(id))).then(() => undefined);
}

/** Preload the player's boat + common NPC hull sizes used near spawn. */
export function preloadSailingBoats(playerBoatId: BoatId = 'sloop'): Promise<void> {
  const ids = new Set<BoatId>([
    resolveBoatId(playerBoatId),
    'skiff',
    'sloop',
    'brigantine',
  ]);
  return Promise.all([...ids].map((id) => loadBoatTemplate(id))).then(() => undefined);
}

export function cloneBoatModel(boatId: string): THREE.Group | null {
  const canonical = resolveBoatId(boatId);
  const template = templateCache.get(canonical);
  return template ? template.clone(true) : null;
}

export function clearBoatCache(): void {
  templateCache.clear();
  inflight.clear();
}