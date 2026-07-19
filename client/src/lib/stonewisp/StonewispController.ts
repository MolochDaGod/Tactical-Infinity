/**
 * StonewispController — load, analyze, animate fight, tentacle tip IK.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  STONEWISP_GLTF_PATH,
  STONEWISP_CDN_PATH,
  analyzeStonewisp,
  formatStonewispReport,
  matchAnimRole,
  type StonewispAnalysis,
} from './stonewispAsset';
import { TentacleIKSolver } from './TentacleIK';

export type StonewispFightPhase =
  | 'hidden'
  | 'approach'
  | 'emerge'
  | 'lunge'
  | 'strike'
  | 'retreat';

export interface StonewispControllerOpts {
  scene: THREE.Scene;
  scale?: number;
  path?: string;
  onAnalyzed?: (report: string, analysis: StonewispAnalysis) => void;
}

export class StonewispController {
  readonly root = new THREE.Group();
  private _mixer: THREE.AnimationMixer | null = null;
  private clips: THREE.AnimationClip[] = [];
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction: THREE.AnimationAction | null = null;
  private ik: TentacleIKSolver | null = null;
  private analysis: StonewispAnalysis | null = null;
  private loaded = false;
  private phase: StonewispFightPhase = 'hidden';
  private fightT = 0;
  private opts: Required<Pick<StonewispControllerOpts, 'scale' | 'path'>> & StonewispControllerOpts;

  constructor(opts: StonewispControllerOpts) {
    this.opts = {
      scale: 36,
      path: STONEWISP_GLTF_PATH,
      ...opts,
    };
    this.root.name = 'StonewispBeast';
    this.root.visible = false;
    opts.scene.add(this.root);
  }

  get isLoaded() {
    return this.loaded;
  }

  get analysisReport() {
    return this.analysis;
  }

  /** Exposed for intro debug panel */
  get mixer(): THREE.AnimationMixer | null {
    return this._mixer;
  }

  async load(): Promise<boolean> {
    const loader = new GLTFLoader();
    const paths = [this.opts.path, STONEWISP_CDN_PATH];
    for (const path of paths) {
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(path!, resolve, undefined, reject);
        });
        this.mount(gltf);
        return true;
      } catch (e) {
        console.warn('[Stonewisp] load failed', path, e);
      }
    }
    this.mountFallback();
    return false;
  }

  private mount(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) {
    const model = gltf.scene;
    model.scale.setScalar(this.opts.scale);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const m = mat as THREE.MeshStandardMaterial;
            const n = `${mesh.name} ${m.name}`.toLowerCase();
            m.roughness = 0.55;
            m.metalness = 0.12;
            if (n.includes('tentacle')) {
              m.emissive = new THREE.Color(0x2a5a6a);
              m.emissiveIntensity = 0.28;
            } else if (n.includes('eye')) {
              m.emissive = new THREE.Color(0xaaccdd);
              m.emissiveIntensity = 0.85;
            } else {
              m.emissive = new THREE.Color(0x1a4a5a);
              m.emissiveIntensity = 0.18;
            }
          }
        }
      }
    });

    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.root.add(model);
    this.root.visible = true;
    this.loaded = true;

    this.clips = gltf.animations || [];
    this.analysis = analyzeStonewisp(model, this.clips);
    const report = formatStonewispReport(this.analysis);
    console.info(report);
    this.opts.onAnalyzed?.(report, this.analysis);

    if (this.clips.length) {
      this._mixer = new THREE.AnimationMixer(model);
      for (const clip of this.clips) {
        this.actions.set(clip.name, this._mixer.clipAction(clip));
      }
      this.playRole('swim', { loop: true, fade: 0.4, timeScale: 0.55 });
    }

    if (this.analysis.tentacleChains.length > 0) {
      this.ik = new TentacleIKSolver(this.analysis.tentacleChains, {
        weight: 0.45,
        iterations: 8,
        whipAmp: 0.14,
        whipFreq: 2.2,
      });
      console.info(
        `[Stonewisp] Tentacle IK on ${this.analysis.tentacleChains.length} chains:`,
        this.analysis.tentacleChains.map((c) => c.boneNames.join('→')),
      );
    } else {
      console.warn('[Stonewisp] No tentacle chains for IK — check bone naming');
    }
  }

  private mountFallback() {
    // Cinematic procedural sea-terror when GLTF is missing from CDN/public.
    // Mutant stingray body + long segmented tentacles (bone chains for IK wrap).
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0e2432,
      emissive: 0x1a4a5c,
      emissiveIntensity: 0.35,
      roughness: 0.62,
      metalness: 0.18,
    });
    const tentMat = new THREE.MeshStandardMaterial({
      color: 0x163848,
      emissive: 0x2a6a7a,
      emissiveIntensity: 0.45,
      roughness: 0.55,
      metalness: 0.12,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xaaffff,
      emissive: 0x66eeff,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(10, 28, 18), bodyMat);
    body.scale.set(2.8, 0.48, 2.1);
    body.name = 'Body';
    body.castShadow = true;
    this.root.add(body);

    // Wing / fin plates
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.ConeGeometry(7, 18, 8, 1, true),
        bodyMat,
      );
      wing.rotation.z = side * 1.15;
      wing.rotation.x = 0.35;
      wing.position.set(side * 14, 0, -2);
      wing.scale.set(0.45, 1, 0.35);
      wing.castShadow = true;
      this.root.add(wing);
    }

    // Eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), eyeMat);
      eye.position.set(side * 5.5, 1.2, 12);
      eye.name = 'Eyes';
      this.root.add(eye);
    }

    // Mouth plate
    const mouth = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 5, 8),
      new THREE.MeshStandardMaterial({
        color: 0x081018,
        emissive: 0x331122,
        emissiveIntensity: 0.25,
      }),
    );
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, -1.5, 14);
    mouth.name = 'Teeth';
    this.root.add(mouth);

    // 8 long tentacles with bones for FABRIK wrap-around
    const tentacleCount = 8;
    const segs = 8;
    for (let t = 0; t < tentacleCount; t++) {
      const ang = (t / tentacleCount) * Math.PI * 2 + 0.2;
      let parent: THREE.Object3D = this.root;
      for (let s = 0; s < segs; s++) {
        const bone = new THREE.Bone();
        bone.name = s === segs - 1 ? `Tentacle_${t}_tip` : `Tentacle_${t}_${s}`;
        if (s === 0) {
          bone.position.set(Math.cos(ang) * 9, -3.2, Math.sin(ang) * 6 - 2);
        } else {
          bone.position.set(0, -2.15, 0);
        }
        parent.add(bone);
        parent = bone;
        const r0 = 1.05 - s * 0.1;
        const r1 = 0.9 - s * 0.1;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(Math.max(0.12, r1), Math.max(0.18, r0), 2.2, 7),
          tentMat,
        );
        seg.position.y = -1.05;
        seg.name = 'Tentacles';
        seg.castShadow = true;
        bone.add(seg);
      }
    }

    // Subtle bioluminescent particles near body
    const pCount = 40;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 30;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const sparks = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0x66ddee,
        size: 0.55,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.root.add(sparks);

    this.root.visible = true;
    this.loaded = true;
    this.analysis = analyzeStonewisp(this.root, []);
    this.ik = new TentacleIKSolver(this.analysis.tentacleChains, {
      weight: 0.78,
      whipAmp: 0.22,
      iterations: 10,
      maxStretch: 1.18,
    });
    console.warn(
      '[Stonewisp] Procedural sea-terror fallback (GLTF missing). ' +
        'Upload scene.gltf to public/models/scenes/stonewisp_beast/ or CDN.',
    );
    this.opts.onAnalyzed?.(formatStonewispReport(this.analysis), this.analysis);
  }

  playRole(
    role: 'swim' | 'intimidate' | 'inspect' | 'hit' | 'death',
    opts: { loop?: boolean; fade?: number; timeScale?: number } = {},
  ) {
    if (!this._mixer) return;
    const clip = matchAnimRole(this.clips, role) || this.clips[0];
    if (!clip) return;
    const next = this.actions.get(clip.name);
    if (!next) return;
    const fade = opts.fade ?? 0.6;
    if (this.currentAction && this.currentAction !== next) {
      this.currentAction.fadeOut(fade);
    }
    next.reset();
    next.setLoop(opts.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, opts.loop === false ? 1 : Infinity);
    next.clampWhenFinished = opts.loop === false;
    next.timeScale = opts.timeScale ?? 1;
    next.fadeIn(fade);
    next.play();
    this.currentAction = next;
  }

  /**
   * Drive cinematic fight from intro adjustedT (0..1 of 3D portion).
   * shipWorld = ship deck position for tentacle reach.
   */
  updateFight(
    adjustedT: number,
    dt: number,
    shipWorld: THREE.Vector3 | null,
  ) {
    if (!this.loaded) return;

    this._mixer?.update(dt);

    let phase: StonewispFightPhase = 'hidden';
    let ikIntensity = 0.2;
    let ikWeight = 0.35;

    if (adjustedT < 0.12) {
      phase = 'approach';
      const p = adjustedT / 0.12;
      this.root.position.set(0, -12 + p * 6, 85 - p * 12);
      this.root.rotation.set(0.05, Math.PI + Math.sin(adjustedT * 20) * 0.06, Math.sin(adjustedT * 15) * 0.04);
      ikIntensity = 0.25;
    } else if (adjustedT < 0.45) {
      phase = 'emerge';
      const p = (adjustedT - 0.12) / 0.33;
      this.root.position.set(
        Math.sin(p * Math.PI) * 4,
        -6 + p * 18,
        73 - p * 38,
      );
      this.root.rotation.set(-p * 0.15, Math.PI + Math.sin(p * 8) * 0.1, Math.sin(p * 6) * 0.05);
      ikIntensity = 0.45 + p * 0.25;
      ikWeight = 0.5;
      if (this.phase !== 'emerge') {
        this.playRole('intimidate', { loop: true, fade: 0.9, timeScale: 0.75 });
      }
    } else if (adjustedT < 0.62) {
      phase = 'lunge';
      const p = (adjustedT - 0.45) / 0.17;
      // Ease-in lunge
      const e = p * p;
      this.root.position.set(
        Math.sin(p * 12) * 2,
        12 + Math.sin(p * Math.PI) * 8,
        35 - e * 28,
      );
      this.root.rotation.set(-0.2 - p * 0.2, Math.PI + Math.sin(p * 10) * 0.15, Math.sin(p * 14) * 0.08);
      ikIntensity = 0.85;
      ikWeight = 0.72;
      if (this.phase !== 'lunge' && this.phase !== 'emerge') {
        this.playRole('intimidate', { loop: true, fade: 0.35, timeScale: 1.05 });
      }
    } else if (adjustedT < 0.78) {
      phase = 'strike';
      const p = (adjustedT - 0.62) / 0.16;
      // Impact hold + thrash
      this.root.position.set(
        Math.sin(p * 30) * 3.5 * (1 - p * 0.3),
        8 + Math.sin(p * 20) * 2,
        7 + p * 3,
      );
      this.root.rotation.set(
        -0.35 + Math.sin(p * 25) * 0.12,
        Math.PI + Math.sin(p * 18) * 0.2,
        Math.sin(p * 22) * 0.15,
      );
      ikIntensity = 1;
      ikWeight = 0.85;
    } else {
      phase = 'retreat';
      const p = (adjustedT - 0.78) / 0.22;
      this.root.position.set(
        Math.sin(p * 4) * 6,
        8 - p * 70,
        10 + p * 25,
      );
      this.root.rotation.set(-0.2 + p * 0.3, Math.PI + p * 0.4, Math.sin(p * 8) * 0.1);
      ikIntensity = Math.max(0, 0.7 - p);
      ikWeight = 0.4 * (1 - p);
      if (this.phase !== 'retreat') {
        this.playRole('swim', { loop: true, fade: 1.0, timeScale: 0.45 });
      }
    }

    this.phase = phase;
    this.ik?.setWeight(ikWeight);
    if (shipWorld && this.ik) {
      // Wrap phase: tentacles spiral around hull (strike) vs reach for deck
      if (phase === 'strike' || phase === 'lunge') {
        // Multiple hull wrap points so tentacles coil the ship, not just poke the deck
        const wrapPts: THREE.Vector3[] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + adjustedT * 9;
          const r = 10 + (i % 3) * 2.5;
          wrapPts.push(
            new THREE.Vector3(
              shipWorld.x + Math.cos(a) * r,
              shipWorld.y + 2 + Math.sin(a * 1.7) * 4 + (phase === 'strike' ? 3 : 0),
              shipWorld.z + Math.sin(a) * r * 0.55,
            ),
          );
        }
        this.ik.updateMulti(wrapPts, dt, ikIntensity);
      } else {
        const aim = shipWorld.clone();
        aim.y += 6;
        this.ik.update(aim, dt, ikIntensity);
      }
    }

    this.fightT = adjustedT;
  }

  /** Current fight phase for intro SFX / ship break triggers */
  get fightPhase(): StonewispFightPhase {
    return this.phase;
  }

  setVisible(v: boolean) {
    this.root.visible = v;
  }

  dispose() {
    this._mixer?.stopAllAction();
    this.opts.scene.remove(this.root);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat?.dispose?.());
      }
    });
  }
}
