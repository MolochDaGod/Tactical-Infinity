/**
 * Farm livestock raise system — Llama / Pig / Sheep at UF RTS farms.
 * Models: Quaternius Farm Animals (CDN models/fauna/farm/).
 * Scale: FBX → targetHeightM metres via shared normalize (not raw 0.01 hacks).
 * Feed: wheat.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { normalizeToMetres } from './modelNormalize';
import { resolveWarlordsUrl } from './warlordsAssetCatalog';

export const FAUNA_FARM_CDN = resolveWarlordsUrl('models/fauna/farm');

export interface FarmAnimalDef {
  id: 'llama' | 'pig' | 'sheep';
  label: string;
  modelUrl: string;
  /** Standing height metres after normalize */
  targetHeightM: number;
  products: Array<{ itemId: string; name: string; amount: number }>;
  raiseTimeSec: number;
  feedItemId: string;
  feedAmount: number;
}

export const FARM_LIVESTOCK: FarmAnimalDef[] = [
  {
    id: 'llama',
    label: 'Llama',
    modelUrl: resolveWarlordsUrl('models/fauna/farm/Llama.fbx'),
    targetHeightM: 1.55,
    products: [
      { itemId: 'wool', name: 'Wool', amount: 2 },
      { itemId: 'animal-hide', name: 'Animal Hide', amount: 1 },
    ],
    raiseTimeSec: 180,
    feedItemId: 'wheat',
    feedAmount: 2,
  },
  {
    id: 'pig',
    label: 'Pig',
    modelUrl: resolveWarlordsUrl('models/fauna/farm/Pig.fbx'),
    targetHeightM: 0.85,
    products: [
      { itemId: 'raw-meat', name: 'Raw Meat', amount: 3 },
      { itemId: 'animal-hide', name: 'Animal Hide', amount: 1 },
    ],
    raiseTimeSec: 150,
    feedItemId: 'wheat',
    feedAmount: 2,
  },
  {
    id: 'sheep',
    label: 'Sheep',
    modelUrl: resolveWarlordsUrl('models/fauna/farm/Sheep.fbx'),
    targetHeightM: 1.05,
    products: [
      { itemId: 'wool', name: 'Wool', amount: 3 },
      { itemId: 'raw-meat', name: 'Raw Meat', amount: 1 },
    ],
    raiseTimeSec: 160,
    feedItemId: 'wheat',
    feedAmount: 2,
  },
];

export type LivestockState = 'hungry' | 'raising' | 'ready';

export interface RaisedAnimal {
  id: string;
  defId: FarmAnimalDef['id'];
  mesh: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  state: LivestockState;
  progress: number;
  raiseStartedAt: number;
  farmBuildingId: string;
  /** Feet ground Y — bob is additive around this, never drifts */
  baseY: number;
}

const fbxLoader = new FBXLoader();
const modelCache = new Map<
  string,
  { root: THREE.Group; animations: THREE.AnimationClip[]; heightM: number }
>();

async function loadAnimalTemplate(def: FarmAnimalDef): Promise<{
  root: THREE.Group;
  animations: THREE.AnimationClip[];
}> {
  const cached = modelCache.get(def.id);
  if (cached) return { root: cached.root, animations: cached.animations };

  const fbx = await new Promise<THREE.Group>((resolve, reject) => {
    fbxLoader.load(def.modelUrl, (obj) => resolve(obj as THREE.Group), undefined, reject);
  });
  const animations =
    (fbx as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations ?? [];

  const wrap = new THREE.Group();
  wrap.name = `farm_${def.id}_tpl`;
  wrap.add(fbx);

  normalizeToMetres(wrap, {
    targetSizeM: def.targetHeightM,
    axis: 'height',
    ground: true,
    centerXZ: true,
  });

  wrap.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = c as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  modelCache.set(def.id, { root: wrap, animations, heightM: def.targetHeightM });
  return { root: wrap, animations };
}

function cloneAnimal(root: THREE.Group): THREE.Group {
  let skinned = false;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
  });
  return (skinned ? cloneSkinned(root) : root.clone(true)) as THREE.Group;
}

export class FarmLivestockManager {
  private scene: THREE.Scene;
  private animals: RaisedAnimal[] = [];
  private now = () => performance.now() / 1000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getAnimals(): readonly RaisedAnimal[] {
    return this.animals;
  }

  getDef(id: FarmAnimalDef['id']): FarmAnimalDef | undefined {
    return FARM_LIVESTOCK.find((d) => d.id === id);
  }

  async spawn(
    defId: FarmAnimalDef['id'],
    position: THREE.Vector3,
    farmBuildingId: string,
    yaw = 0,
  ): Promise<RaisedAnimal | null> {
    const def = this.getDef(defId);
    if (!def) return null;

    let mesh: THREE.Group;
    let animations: THREE.AnimationClip[] = [];
    try {
      const tpl = await loadAnimalTemplate(def);
      mesh = cloneAnimal(tpl.root);
      animations = tpl.animations;
    } catch (e) {
      console.warn('[FarmLivestock] model load failed', def.modelUrl, e);
      mesh = this.fallbackMesh(def);
    }

    mesh.position.copy(position);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);

    const mixer = new THREE.AnimationMixer(mesh);
    if (animations.length > 0) {
      const action = mixer.clipAction(animations[0]!);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }

    const animal: RaisedAnimal = {
      id: `livestock_${defId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      defId,
      mesh,
      mixer,
      state: 'raising',
      progress: 0,
      raiseStartedAt: this.now(),
      farmBuildingId,
      baseY: position.y,
    };
    this.animals.push(animal);
    return animal;
  }

  private fallbackMesh(def: FarmAnimalDef): THREE.Group {
    const g = new THREE.Group();
    const color =
      def.id === 'pig' ? 0xe8a0a0 : def.id === 'sheep' ? 0xf0f0f0 : 0xc4a574;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, def.targetHeightM * 0.6, 1.0),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = def.targetHeightM * 0.35;
    g.add(body);
    return g;
  }

  update(delta: number): void {
    const t = this.now();
    for (const a of this.animals) {
      a.mixer.update(delta);
      if (a.state === 'raising') {
        const def = this.getDef(a.defId);
        if (def) {
          a.progress = Math.min(1, (t - a.raiseStartedAt) / def.raiseTimeSec);
          if (a.progress >= 1) a.state = 'ready';
        }
      }
      // Bob around baseY only — no unbounded drift
      a.mesh.position.y = a.baseY + Math.sin(t * 2 + a.mesh.position.x) * 0.02;
    }
  }

  harvest(animalId: string): Array<{ itemId: string; name: string; amount: number }> | null {
    const a = this.animals.find((x) => x.id === animalId);
    if (!a || a.state !== 'ready') return null;
    const def = this.getDef(a.defId);
    if (!def) return null;
    a.state = 'hungry';
    a.progress = 0;
    a.raiseStartedAt = 0;
    return def.products.map((p) => ({ ...p }));
  }

  feed(animalId: string): boolean {
    const a = this.animals.find((x) => x.id === animalId);
    if (!a || a.state !== 'hungry') return false;
    a.state = 'raising';
    a.progress = 0;
    a.raiseStartedAt = this.now();
    return true;
  }

  remove(animalId: string): void {
    const idx = this.animals.findIndex((a) => a.id === animalId);
    if (idx < 0) return;
    const a = this.animals[idx]!;
    a.mixer.stopAllAction();
    this.scene.remove(a.mesh);
    this.animals.splice(idx, 1);
  }

  dispose(): void {
    for (const a of [...this.animals]) this.remove(a.id);
    modelCache.clear();
  }
}
