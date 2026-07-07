/**
 * RaceCharacterViewer — Three.js showcase of all 6 Tethical races.
 *
 * Features:
 *  • Loads real Toon-RTS FBX models (human/barbarian/dwarf/elf/orc/undead)
 *  • TGA texture support via TGALoader
 *  • AnimationMixer with idle/attack animation playback
 *  • SkeletonHelper bone visualisation toggle
 *  • SelectiveBloom post-processing (glow on pedestals + rim light)
 *  • Faction-coloured pedestals (Crusade gold, Fabled teal, Legion crimson)
 *  • Orbit camera + auto-rotate showcase mode
 *  • SkeletonUtils for proper skinned-mesh cloning
 *  • Optimised WebGL2 renderer (ACES tone mapping, PCFSoft shadows)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Skull, Sword, Shield, Eye, EyeOff,
  Play, Pause, Users, Zap, RefreshCw, Sun, Moon, Droplets,
  Camera, Video, Mountain, ArrowDown, Film, Move3D
} from 'lucide-react';
import {
  createOptimalRenderer,
  createSceneDefaults,
  createCharacterLights,
  buildProcEnvMap,
  optimiseMesh,
  createGroundPlane,
  createFactionPedestal
} from '@/lib/threeWebGLSetup';

interface RaceInfo {
  id: string;
  label: string;
  faction: 'crusade' | 'fabled' | 'legion';
  modelPath: string;
  texturePath: string;
  animPaths: string[];
  scale: number;
  yOffset: number;
}

const BASE = '/toon_rts/Toon_RTS';

// Anim/model rig compatibility notes (Toon RTS asset pack):
//   - "Cavalry/*"        → mounted rig with horse bones (use ONLY with *_Cavalry_customizable.FBX)
//   - "Catapult/*"       → siege-vehicle rig (use ONLY with *_Catapult.FBX)
//   - "BoltThrower/*"    → siege-weapon rig (use ONLY with the bolt thrower model)
//   - "Worker/*", "Spearman/*", "Mage/*", "Infantry/*" → humanoid foot rig (compatible with *_Characters_customizable.FBX)
// The shipping asset pack does NOT include humanoid foot-rig anims for WK (Human), Elves, or Undead.
// Those rows therefore have empty animPaths — they will display in T-pose until we author or
// import compatible foot-soldier animations.
const RACES: RaceInfo[] = [
  {
    id: 'human',
    label: 'Human',
    faction: 'crusade',
    modelPath: `${BASE}/WesternKingdoms/models/WK_Characters_customizable.FBX`,
    texturePath: `${BASE}/WesternKingdoms/models/Materials/Colors/textures/WK_StandardUnits_blue.tga`,
    // Asset pack only ships Cavalry + Catapult anims for WK — neither matches the foot rig.
    animPaths: [],
    scale: 0.012,
    yOffset: 0.13
  },
  {
    id: 'barbarian',
    label: 'Barbarian',
    faction: 'crusade',
    modelPath: `${BASE}/Barbarians/models/BRB_Characters_customizable.FBX`,
    texturePath: `${BASE}/Barbarians/models/Materials/BRB_StandardUnits_texture.tga`,
    animPaths: [`${BASE}/Barbarians/animation/Spearman/BRB_spearman_07_attack.FBX`],
    scale: 0.012,
    yOffset: 0.13
  },
  {
    id: 'dwarf',
    label: 'Dwarf',
    faction: 'fabled',
    modelPath: `${BASE}/Dwarves/models/DWF_Characters_customizable.FBX`,
    texturePath: `${BASE}/Dwarves/models/Materials/DWF_Standard_Units.tga`,
    animPaths: [
      `${BASE}/Dwarves/animation/Worker/_idle.FBX`,
      `${BASE}/Dwarves/animation/Worker/DWF_worker_07_attack.FBX`
    ],
    scale: 0.011,
    yOffset: 0.13
  },
  {
    id: 'elf',
    label: 'Elf',
    faction: 'fabled',
    modelPath: `${BASE}/Elves/models/ELF_Characters_customizable.FBX`,
    texturePath: `${BASE}/Elves/models/Materials/ELF_DarkElves_Texture.tga`,
    // BoltThrower is a siege-weapon rig (not humanoid). Cavalry_* rigs include horse bones.
    // Elves/animation/Infantry/ ships only a .controller, no FBX clips. → no compatible anim.
    animPaths: [],
    scale: 0.012,
    yOffset: 0.13
  },
  {
    id: 'orc',
    label: 'Orc',
    faction: 'legion',
    modelPath: `${BASE}/Orcs/models/ORC_Characters_Customizable.FBX`,
    texturePath: `${BASE}/Orcs/models/Materials/textures/ORC_StandardUnits.tga`,
    animPaths: [
      // Worker is the only foot-rig animation Orcs ship. Cavalry/Catapult are wrong-rig.
      `${BASE}/Orcs/animation/Worker/ORC_worker_12_working_A.FBX`,
    ],
    scale: 0.013,
    yOffset: 0.13
  },
  {
    id: 'undead',
    label: 'Undead',
    faction: 'legion',
    modelPath: `${BASE}/Undead/models/UD_Characters_customizable.FBX`,
    texturePath: `${BASE}/Undead/models/Materials/UD_Standard_Units.tga`,
    animPaths: [],
    scale: 0.012,
    yOffset: 0.13
  }
];

const FACTION_COLORS: Record<string, number> = {
  crusade: 0xc8a020,
  fabled:  0x20a8c8,
  legion:  0xc82020
};

const FACTION_LABELS: Record<string, string> = {
  crusade: 'Crusade',
  fabled:  'Fabled',
  legion:  'Legion'
};

const FACTION_BADGE_CLASSES: Record<string, string> = {
  crusade: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  fabled:  'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  legion:  'bg-red-500/20 text-red-300 border-red-500/40'
};

interface LoadedRace {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: THREE.AnimationAction[];
  skeleton: THREE.SkeletonHelper | null;
  pedestal: THREE.Group;
  info: RaceInfo;
  loadError?: string;
}

// Camera modes — V cycles through them.
type CameraMode = 'orbit' | 'hero' | 'closeup' | 'top' | 'cinematic' | 'free';
const CAMERA_MODE_ORDER: CameraMode[] = ['orbit', 'hero', 'closeup', 'top', 'cinematic', 'free'];

const CAMERA_MODE_LABEL: Record<CameraMode, string> = {
  orbit:     'Orbit',
  hero:      'Hero',
  closeup:   'Close-up',
  top:       'Top-Down',
  cinematic: 'Cinematic',
  free:      'Free',
};

interface CameraTargetState {
  position: THREE.Vector3;
  lookAt:   THREE.Vector3;
  autoRotate: boolean;
  autoRotateSpeed: number;
  enablePan: boolean;
  maxPolarAngle: number;
  minDistance: number;
  maxDistance: number;
  /** When false, the per-frame lerp is skipped — user has full control. */
  tween: boolean;
}

/**
 * Compute the desired camera position+target for a given mode + focus point.
 *
 * For non-orbit modes we approach the race from OUTSIDE the wheel of pedestals
 * so the character reads against the wider scene rather than against the
 * other pedestals behind it. The camera offset is built from a unit vector
 * pointing radially out from world centre through the race position.
 */
function computeCameraTarget(mode: CameraMode, focused: THREE.Vector3 | null): CameraTargetState {
  const center = focused ? focused.clone() : new THREE.Vector3(0, 1.2, 0);
  const radial = focused
    ? new THREE.Vector3(focused.x, 0, focused.z).normalize()
    : new THREE.Vector3(0, 0, 1);
  if (radial.lengthSq() < 1e-6) radial.set(0, 0, 1);
  const tangent = new THREE.Vector3(-radial.z, 0, radial.x); // 90° around Y

  switch (mode) {
    case 'hero': {
      const offset = radial.clone().multiplyScalar(3.6).add(tangent.clone().multiplyScalar(1.4));
      offset.y = 1.9;
      return {
        position: center.clone().add(offset),
        lookAt:   center.clone().add(new THREE.Vector3(0, 1.4, 0)),
        autoRotate: false, autoRotateSpeed: 0.8,
        enablePan: false, maxPolarAngle: Math.PI / 2,
        minDistance: 1.5, maxDistance: 30,
        tween: true,
      };
    }
    case 'closeup': {
      const offset = radial.clone().multiplyScalar(2.4);
      offset.y = 1.7;
      return {
        position: center.clone().add(offset),
        lookAt:   center.clone().add(new THREE.Vector3(0, 1.55, 0)),
        autoRotate: false, autoRotateSpeed: 0.4,
        enablePan: false, maxPolarAngle: Math.PI / 2,
        minDistance: 1.2, maxDistance: 30,
        tween: true,
      };
    }
    case 'top': {
      return {
        position: center.clone().add(new THREE.Vector3(0.001, 9, 0.001)),
        lookAt:   center.clone(),
        autoRotate: false, autoRotateSpeed: 0,
        enablePan: false, maxPolarAngle: Math.PI / 2,
        minDistance: 3, maxDistance: 30,
        tween: true,
      };
    }
    case 'cinematic': {
      const offset = radial.clone().multiplyScalar(5.0).add(tangent.clone().multiplyScalar(2.5));
      offset.y = 2.4;
      return {
        position: center.clone().add(offset),
        lookAt:   center.clone().add(new THREE.Vector3(0, 1.3, 0)),
        autoRotate: true, autoRotateSpeed: 0.6,
        enablePan: false, maxPolarAngle: Math.PI / 2,
        minDistance: 2, maxDistance: 30,
        tween: true,
      };
    }
    case 'free': {
      // Don't yank the camera around — keep current position. User flies it.
      return {
        position: center, // not used (tween=false)
        lookAt:   center, // not used (tween=false)
        autoRotate: false, autoRotateSpeed: 0,
        enablePan: true,  maxPolarAngle: Math.PI - 0.05,
        minDistance: 0.5, maxDistance: 200,
        tween: false,
      };
    }
    case 'orbit':
    default: {
      // Original behaviour — wide orbit, optional auto-rotate handled by user toggle.
      const offset = focused
        ? radial.clone().multiplyScalar(7).add(new THREE.Vector3(0, 2.5, 0))
        : new THREE.Vector3(0, 2.5, 14);
      return {
        position: focused ? center.clone().add(offset) : new THREE.Vector3(0, 2.5, 14),
        lookAt:   focused ? center.clone().add(new THREE.Vector3(0, 1.2, 0)) : new THREE.Vector3(0, 1.2, 0),
        autoRotate: true, autoRotateSpeed: 0.8,
        enablePan: true, maxPolarAngle: Math.PI / 2,
        minDistance: 2, maxDistance: 30,
        tween: true,
      };
    }
  }
}

interface Props {
  onBack: () => void;
}

export default function RaceCharacterViewer({ onBack }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(false);
  const disposeRef = useRef<(() => void) | null>(null);

  const [loadingRaces, setLoadingRaces] = useState<Set<string>>(new Set(RACES.map(r => r.id)));
  const [loadedCount, setLoadedCount]   = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [autoRotate, setAutoRotate]     = useState(true);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [animPlaying, setAnimPlaying]   = useState(true);
  const [selectedAnim, setSelectedAnim] = useState(0);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [envPreset, setEnvPreset]       = useState<'default' | 'sunset' | 'night' | 'arena'>('default');
  const [cameraMode, setCameraMode]     = useState<CameraMode>('orbit');
  const sceneRef = useRef<THREE.Scene | null>(null);

  const loadedRacesRef    = useRef<Map<string, LoadedRace>>(new Map());
  const controlsRef       = useRef<OrbitControls | null>(null);
  const cameraRef         = useRef<THREE.PerspectiveCamera | null>(null);
  const mixersRef         = useRef<THREE.AnimationMixer[]>([]);
  const clockRef          = useRef(new THREE.Clock());
  const spotLightRef      = useRef<THREE.SpotLight | null>(null);
  const spotTargetRef     = useRef<THREE.Object3D | null>(null);
  const cameraTargetRef   = useRef<CameraTargetState | null>(null);
  const heldKeysRef       = useRef<Set<string>>(new Set());
  const selectedRaceRef   = useRef<string | null>(null);
  const cameraModeRef     = useRef<CameraMode>('orbit');

  // Keep refs in sync with state so the animation loop (defined once) sees the latest values.
  useEffect(() => { selectedRaceRef.current = selectedRace; }, [selectedRace]);
  useEffect(() => { cameraModeRef.current   = cameraMode;   }, [cameraMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const presets: Record<string, { bg: number; fog: [number, number, number]; intensity: number }> = {
      default: { bg: 0x1a1a2e, fog: [0.10, 0.10, 0.18], intensity: 1.0 },
      sunset:  { bg: 0x2a1510, fog: [0.17, 0.08, 0.05], intensity: 0.8 },
      night:   { bg: 0x0a0a14, fog: [0.04, 0.04, 0.08], intensity: 0.4 },
      arena:   { bg: 0x1a1a1a, fog: [0.10, 0.10, 0.10], intensity: 1.2 },
    };
    const p = presets[envPreset] || presets.default;
    scene.background = new THREE.Color(p.bg);
    scene.fog = new THREE.FogExp2(new THREE.Color(...p.fog).getHex(), 0.015);
    scene.traverse(child => {
      if (child instanceof THREE.DirectionalLight) child.intensity = p.intensity;
    });
  }, [envPreset]);

  /**
   * Re-derive the desired camera target whenever selection or mode change.
   * The actual move is interpolated frame-by-frame inside the animation loop
   * so transitions read as a smooth dolly rather than a teleport.
   */
  const refreshCameraTarget = useCallback(() => {
    const mode = cameraModeRef.current;
    const sel  = selectedRaceRef.current;
    let focused: THREE.Vector3 | null = null;
    if (sel) {
      const loaded = loadedRacesRef.current.get(sel);
      if (loaded) focused = loaded.group.position.clone();
    }
    cameraTargetRef.current = computeCameraTarget(mode, focused);

    // Apply controls config that doesn't need tweening immediately.
    const controls = controlsRef.current;
    if (controls) {
      const t = cameraTargetRef.current;
      controls.enablePan       = t.enablePan;
      controls.maxPolarAngle   = t.maxPolarAngle;
      controls.minDistance     = t.minDistance;
      controls.maxDistance     = t.maxDistance;
      controls.autoRotate      = t.autoRotate && (mode !== 'orbit' || autoRotate);
      controls.autoRotateSpeed = t.autoRotateSpeed;
    }
  }, [autoRotate]);

  const focusRace = useCallback((raceId: string | null) => {
    setSelectedRace(raceId);
    selectedRaceRef.current = raceId;
    // Recompute target on next tick — selectedRaceRef is already up to date.
    setTimeout(refreshCameraTarget, 0);
  }, [refreshCameraTarget]);

  const cycleCameraMode = useCallback(() => {
    setCameraMode(prev => {
      const i = CAMERA_MODE_ORDER.indexOf(prev);
      const next = CAMERA_MODE_ORDER[(i + 1) % CAMERA_MODE_ORDER.length];
      cameraModeRef.current = next;
      setTimeout(refreshCameraTarget, 0);
      return next;
    });
  }, [refreshCameraTarget]);

  const setCameraModeAndRefresh = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    cameraModeRef.current = mode;
    setTimeout(refreshCameraTarget, 0);
  }, [refreshCameraTarget]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const canvas = canvasRef.current!;
    const { renderer, pmremGenerator, dispose: disposeRenderer } = createOptimalRenderer({ canvas });

    const scene  = createSceneDefaults();
    sceneRef.current = scene;
    const envMap = buildProcEnvMap(pmremGenerator);
    scene.environment = envMap;

    createCharacterLights(scene);
    const ground = createGroundPlane(40);
    scene.add(ground);

    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    camera.position.set(0, 2.5, 14);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.08;
    controls.minDistance    = 2;
    controls.maxDistance    = 30;
    controls.maxPolarAngle  = Math.PI / 2;
    controls.target.set(0, 1.2, 0);
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.8;
    controlsRef.current = controls;

    // Spotlight that tracks the focused race. Off by default; intensity ramps
    // up when a race is selected.
    const spotLight = new THREE.SpotLight(0xffeac8, 0, 22, Math.PI / 7, 0.45, 1.4);
    spotLight.position.set(0, 12, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.set(1024, 1024);
    spotLight.shadow.bias = -0.0005;
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotLight);
    scene.add(spotTarget);
    spotLight.target = spotTarget;
    spotLightRef.current  = spotLight;
    spotTargetRef.current = spotTarget;

    // Initial camera target = orbit around scene centre.
    cameraTargetRef.current = computeCameraTarget('orbit', null);

    const fbxLoader = new FBXLoader();
    const tgaLoader = new TGALoader();

    const radius = 5.5;
    const count  = RACES.length;

    const loadRace = async (info: RaceInfo, index: number): Promise<void> => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const x     = Math.cos(angle) * radius;
      const z     = Math.sin(angle) * radius;

      const pedestal  = createFactionPedestal(FACTION_COLORS[info.faction]);
      pedestal.position.set(x, 0.125, z);
      scene.add(pedestal);

      try {
        const raw = await new Promise<THREE.Group>((res, rej) => {
          fbxLoader.load(info.modelPath, res, undefined, rej);
        });

        const cloned = SkeletonUtils.clone(raw) as THREE.Group;
        cloned.scale.setScalar(info.scale);
        cloned.position.set(x, info.yOffset, z);

        try {
          const texture = await new Promise<THREE.DataTexture>((res, rej) => {
            tgaLoader.load(info.texturePath, res, undefined, rej);
          });
          texture.colorSpace  = THREE.SRGBColorSpace;
          texture.needsUpdate = true;

          cloned.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const replaceMat = (old: THREE.Material): THREE.Material => {
                const std = new THREE.MeshStandardMaterial({
                  map: texture,
                  roughness: 0.6,
                  metalness: 0.2,
                  envMap,
                  envMapIntensity: 0.8
                });
                old.dispose();
                return std;
              };
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map(replaceMat);
              } else {
                mesh.material = replaceMat(mesh.material);
              }
            }
          });
        } catch {
          cloned.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const color = FACTION_COLORS[info.faction];
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach(mat => {
                (mat as THREE.MeshStandardMaterial).color = new THREE.Color(color);
                (mat as THREE.MeshStandardMaterial).needsUpdate = true;
              });
            }
          });
        }

        optimiseMesh(cloned, envMap);
        scene.add(cloned);

        const mixer   = new THREE.AnimationMixer(cloned);
        const actions: THREE.AnimationAction[] = [];

        if (raw.animations.length > 0) {
          for (const clip of raw.animations) {
            const action = mixer.clipAction(clip);
            actions.push(action);
          }
        }

        for (const animPath of info.animPaths) {
          try {
            const animFbx = await new Promise<THREE.Group>((res, rej) => {
              fbxLoader.load(animPath, res, undefined, rej);
            });
            for (const clip of animFbx.animations) {
              const retargetedClip = THREE.AnimationClip.findByName(animFbx.animations, clip.name) || clip;
              const action = mixer.clipAction(retargetedClip, cloned);
              actions.push(action);
            }
          } catch {
          }
        }

        if (actions.length > 0) {
          actions[0].play();
        }

        mixersRef.current.push(mixer);

        const skelHelper = new THREE.SkeletonHelper(cloned);
        skelHelper.visible = false;
        scene.add(skelHelper);

        const loaded: LoadedRace = {
          group:    cloned,
          mixer,
          actions,
          skeleton: skelHelper,
          pedestal,
          info
        };
        loadedRacesRef.current.set(info.id, loaded);

        setLoadingRaces(prev => { const n = new Set(prev); n.delete(info.id); return n; });
        setLoadedCount(c => c + 1);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[RaceViewer] Failed to load ${info.id}:`, msg);
        setErrors(prev => ({ ...prev, [info.id]: msg }));
        setLoadingRaces(prev => { const n = new Set(prev); n.delete(info.id); return n; });
        setLoadedCount(c => c + 1);
      }
    };

    Promise.all(RACES.map((r, i) => loadRace(r, i)));

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', resize);
    resize();

    let raf = 0;
    const clock = clockRef.current;

    // ── Keyboard input: V cycles camera modes, WASD/QE flies in Free mode ──
    const onKeyDown = (ev: KeyboardEvent) => {
      // Don't hijack typing in inputs
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (ev.key === 'v' || ev.key === 'V') {
        ev.preventDefault();
        cycleCameraMode();
        return;
      }
      heldKeysRef.current.add(ev.key.toLowerCase());
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      heldKeysRef.current.delete(ev.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const tmpForward = new THREE.Vector3();
    const tmpRight   = new THREE.Vector3();
    const tmpUp      = new THREE.Vector3(0, 1, 0);
    const tmpMove    = new THREE.Vector3();
    const tmpFocus   = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      // ── Camera tween toward computed target ──
      const target = cameraTargetRef.current;
      if (target) {
        if (target.tween) {
          // Critically-damped lerp factor
          const k = 1 - Math.exp(-dt * 4.0);
          camera.position.lerp(target.position, k);
          controls.target.lerp(target.lookAt, k);
        } else if (cameraModeRef.current === 'free') {
          // WASD fly. Move both camera and orbit target together so OrbitControls
          // keeps a sane pivot.
          const speed = (heldKeysRef.current.has('shift') ? 14 : 6) * dt;
          camera.getWorldDirection(tmpForward);
          tmpForward.y = 0; tmpForward.normalize();
          tmpRight.crossVectors(tmpForward, tmpUp).normalize();
          tmpMove.set(0, 0, 0);
          if (heldKeysRef.current.has('w')) tmpMove.add(tmpForward);
          if (heldKeysRef.current.has('s')) tmpMove.sub(tmpForward);
          if (heldKeysRef.current.has('d')) tmpMove.add(tmpRight);
          if (heldKeysRef.current.has('a')) tmpMove.sub(tmpRight);
          if (heldKeysRef.current.has('e') || heldKeysRef.current.has(' ')) tmpMove.y += 1;
          if (heldKeysRef.current.has('q')) tmpMove.y -= 1;
          if (tmpMove.lengthSq() > 0) {
            tmpMove.normalize().multiplyScalar(speed);
            camera.position.add(tmpMove);
            controls.target.add(tmpMove);
          }
        }
      }

      // ── Spotlight tracking ──
      const spot = spotLightRef.current;
      const spotT = spotTargetRef.current;
      if (spot && spotT) {
        const sel = selectedRaceRef.current;
        const loaded = sel ? loadedRacesRef.current.get(sel) : null;
        const k = 1 - Math.exp(-dt * 5.0);
        if (loaded) {
          tmpFocus.copy(loaded.group.position);
          spot.position.lerp(
            new THREE.Vector3(tmpFocus.x, tmpFocus.y + 7, tmpFocus.z),
            k,
          );
          spotT.position.lerp(
            new THREE.Vector3(tmpFocus.x, tmpFocus.y + 1.2, tmpFocus.z),
            k,
          );
          spot.intensity += (6.0 - spot.intensity) * k;
        } else {
          spot.intensity += (0 - spot.intensity) * k;
        }
      }

      controls.update();
      mixersRef.current.forEach(m => m.update(dt));
      renderer.render(scene, camera);
    };
    animate();

    disposeRef.current = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      controls.dispose();
      mixersRef.current.forEach(m => m.stopAllAction());
      loadedRacesRef.current.forEach(r => {
        scene.remove(r.group);
        if (r.skeleton) scene.remove(r.skeleton);
        scene.remove(r.pedestal);
      });
      if (spotLightRef.current)  scene.remove(spotLightRef.current);
      if (spotTargetRef.current) scene.remove(spotTargetRef.current);
      loadedRacesRef.current.clear();
      mixersRef.current = [];
      envMap.dispose();
      disposeRenderer();
    };

    return () => {
      mountedRef.current = false;
      disposeRef.current?.();
    };
  }, []);

  useEffect(() => {
    // In orbit mode the user's auto-rotate toggle drives the controls.
    // In other modes the preset already declared whether autoRotate is on
    // (e.g. Cinematic = always on), so we only override during 'orbit'.
    if (controlsRef.current && cameraModeRef.current === 'orbit') {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    loadedRacesRef.current.forEach(r => {
      if (r.skeleton) r.skeleton.visible = showSkeleton;
    });
  }, [showSkeleton]);

  useEffect(() => {
    loadedRacesRef.current.forEach(r => {
      r.actions.forEach(a => animPlaying ? a.play() : a.paused = true);
    });
  }, [animPlaying]);

  const switchAnimation = useCallback((raceId: string, idx: number) => {
    const loaded = loadedRacesRef.current.get(raceId);
    if (!loaded || !loaded.actions[idx]) return;
    loaded.actions.forEach(a => a.stop());
    loaded.actions[idx].play();
    setSelectedAnim(idx);
  }, []);

  const selectedLoaded = selectedRace ? loadedRacesRef.current.get(selectedRace) : null;

  return (
    <div className="h-screen w-full bg-[#0d1117] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/40 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-back-race-viewer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-semibold text-foreground font-['Cinzel']">Race Character Viewer</h1>
            <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/40">
              {loadedCount}/{RACES.length} Loaded
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showSkeleton ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSkeleton(v => !v)}
            data-testid="button-toggle-skeleton"
            title="Toggle skeleton helper"
          >
            {showSkeleton ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
            Skeleton
          </Button>
          <Button
            variant={autoRotate ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRotate(v => !v)}
            data-testid="button-toggle-autorotate"
            title="Toggle auto-rotate camera"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Rotate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnimPlaying(v => !v)}
            data-testid="button-toggle-animation"
          >
            {animPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {animPlaying ? 'Pause' : 'Play'}
          </Button>
          <div className="h-5 w-px bg-white/20" />
          {CAMERA_MODE_ORDER.map(mode => {
            const Icon =
              mode === 'orbit'     ? RefreshCw :
              mode === 'hero'      ? Camera :
              mode === 'closeup'   ? Video :
              mode === 'top'       ? ArrowDown :
              mode === 'cinematic' ? Film :
                                     Move3D;
            return (
              <Button
                key={mode}
                variant={cameraMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCameraModeAndRefresh(mode)}
                data-testid={`button-camera-${mode}`}
                title={`${CAMERA_MODE_LABEL[mode]} camera (V to cycle)`}
                className="text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {CAMERA_MODE_LABEL[mode]}
              </Button>
            );
          })}
          <div className="h-5 w-px bg-white/20" />
          {(['default', 'sunset', 'night', 'arena'] as const).map(env => (
            <Button
              key={env}
              variant={envPreset === env ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEnvPreset(env)}
              data-testid={`button-env-${env}`}
              className="capitalize text-xs"
            >
              {env === 'default' && <Sun className="w-3 h-3 mr-1" />}
              {env === 'sunset' && <Droplets className="w-3 h-3 mr-1" />}
              {env === 'night' && <Moon className="w-3 h-3 mr-1" />}
              {env === 'arena' && <Zap className="w-3 h-3 mr-1" />}
              {env}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="flex-1 h-full cursor-grab active:cursor-grabbing"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-testid="canvas-race-viewer"
        />

        <div className="w-64 border-l border-white/10 bg-black/60 flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-white/10">
            <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Races</h2>
            <p className="text-xs text-muted-foreground mt-1">Click to focus camera</p>
          </div>

          {RACES.map(race => {
            const isLoading = loadingRaces.has(race.id);
            const hasError  = !!errors[race.id];
            const isSelected = selectedRace === race.id;
            const loaded = loadedRacesRef.current.get(race.id);

            return (
              <div
                key={race.id}
                className={`p-3 border-b border-white/5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'hover:bg-white/5'
                }`}
                onClick={() => focusRace(isSelected ? null : race.id)}
                data-testid={`race-card-${race.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">{race.label}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${FACTION_BADGE_CLASSES[race.faction]}`}
                    data-testid={`badge-faction-${race.id}`}
                  >
                    {FACTION_LABELS[race.faction]}
                  </Badge>
                </div>

                {isLoading && (
                  <div className="space-y-1 mt-2">
                    <Skeleton className="h-2 w-full bg-white/10" />
                    <p className="text-xs text-muted-foreground">Loading model...</p>
                  </div>
                )}
                {hasError && (
                  <p className="text-xs text-red-400 mt-1 break-all" data-testid={`error-${race.id}`}>
                    ⚠ Load failed
                  </p>
                )}
                {!isLoading && !hasError && (
                  <div className="space-y-1 mt-1">
                    <p className="text-xs text-green-400">✓ Ready</p>
                    {loaded && loaded.actions.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {loaded.actions.length} animation{loaded.actions.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                {isSelected && loaded && loaded.actions.length > 1 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">Animations</p>
                    {loaded.actions.map((action, idx) => (
                      <button
                        key={idx}
                        className={`text-xs w-full text-left px-2 py-1 rounded transition-colors ${
                          selectedAnim === idx
                            ? 'bg-amber-500/30 text-amber-300'
                            : 'text-muted-foreground hover:bg-white/10'
                        }`}
                        onClick={(e) => { e.stopPropagation(); switchAnimation(race.id, idx); }}
                        data-testid={`button-anim-${race.id}-${idx}`}
                      >
                        {action.getClip().name || `Clip ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="p-3 mt-auto border-t border-white/10">
            <p className="text-xs text-muted-foreground font-semibold mb-2">Factions</p>
            {(['crusade', 'fabled', 'legion'] as const).map(f => (
              <div key={f} className="flex items-center gap-2 mb-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `#${FACTION_COLORS[f].toString(16).padStart(6, '0')}` }}
                />
                <span className={`text-xs ${FACTION_BADGE_CLASSES[f].split(' ')[1]}`}>
                  {FACTION_LABELS[f]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {RACES.filter(r => r.faction === f).map(r => r.label).join(' · ')}
                </span>
              </div>
            ))}

            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-muted-foreground font-semibold mb-1">Renderer</p>
              <p className="text-xs text-muted-foreground">Three.js r182</p>
              <p className="text-xs text-muted-foreground">WebGL2 · ACES Tone Mapping</p>
              <p className="text-xs text-muted-foreground">PCFSoft Shadows · sRGB</p>
            </div>

            <div className="mt-2">
              <p className="text-xs text-muted-foreground font-semibold mb-1">Models</p>
              <p className="text-xs text-muted-foreground">Toon-RTS FBX Pack</p>
              <p className="text-xs text-muted-foreground">TGA texture pipeline</p>
              <p className="text-xs text-muted-foreground">SkeletonUtils clone</p>
              <p className="text-xs text-muted-foreground">AnimationMixer + clips</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-white/10 bg-black/40 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
        <span><kbd className="px-1 bg-white/10 rounded">LMB drag</kbd> Orbit</span>
        <span><kbd className="px-1 bg-white/10 rounded">RMB drag</kbd> Pan</span>
        <span><kbd className="px-1 bg-white/10 rounded">Scroll</kbd> Zoom</span>
        <span><kbd className="px-1 bg-white/10 rounded">Click card</kbd> Focus race</span>
        <span><kbd className="px-1 bg-white/10 rounded">V</kbd> Cycle camera</span>
        {cameraMode === 'free' && (
          <span className="text-amber-400">
            <kbd className="px-1 bg-amber-500/20 rounded">WASD</kbd> Move ·
            <kbd className="px-1 bg-amber-500/20 rounded ml-1">Q/E</kbd> Down/Up ·
            <kbd className="px-1 bg-amber-500/20 rounded ml-1">Shift</kbd> Sprint
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300" data-testid="badge-camera-mode">
            {CAMERA_MODE_LABEL[cameraMode]}
          </Badge>
          {loadingRaces.size > 0
            ? `Loading ${loadingRaces.size} model${loadingRaces.size > 1 ? 's' : ''}…`
            : `${loadedCount} / ${RACES.length} races ready`}
        </span>
      </div>
    </div>
  );
}
