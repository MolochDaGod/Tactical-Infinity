import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import {
  Race, RACE_PREFIXES, FACTION_COLORS, RACE_DISPLAY_NAMES,
  type Faction, type WeaponStyle,
} from "@/data/toonRTSAssets";
import {
  FACTION_UNIT_RACES, unitGLBPath, type UnitClass,
  isLoopingClip, animCategoriesForClass, LOCOMOTION_KEYMAP,
} from "@/data/factionUnits";
import { UnitCharacter } from "@/lib/character/UnitGLBLoader";
import { loadCaptainBuild } from "@/lib/captainBuild";
import ProfessionsPanel from "@/components/character/ProfessionsPanel";
import { FactionEmblemRow } from "@/components/game/FactionEmblem";

// ── The six canonical races, shown together in the lineup ──────────────────
const RACE_ORDER: Race[] = ['human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead'];

// Map each canonical race → its faction + GLB filename slug, derived from the
// single faction-unit registry so the barracks and Unit Viewer stay in lockstep.
const RACE_TO_UNIT: Record<Race, { faction: Faction; slug: string }> = (() => {
  const m = {} as Record<Race, { faction: Faction; slug: string }>;
  (Object.keys(FACTION_UNIT_RACES) as Faction[]).forEach((f) => {
    FACTION_UNIT_RACES[f].forEach((r) => { m[r.race] = { faction: f, slug: r.slug }; });
  });
  return m;
})();

// ── The four class builds. Each is a distinct baked GLB per race, carrying its
//    OWN weapon (baked into the mesh) and its OWN animation clips. Selecting a
//    class reloads every race to that class's GLB. ───────────────────────────
const CLASS_ORDER: UnitClass[] = ['knight', 'mage', 'ranger', 'warrior'];

interface ClassUI { name: string; gearLabel: string; tint: string; }
const CLASS_UI: Record<UnitClass, ClassUI> = {
  knight:  { name: 'Knight',  gearLabel: 'Sword & Shield', tint: '#cfd8e3' },
  mage:    { name: 'Mage',    gearLabel: 'Staff',          tint: '#a78bfa' },
  ranger:  { name: 'Ranger',  gearLabel: 'Bow',            tint: '#86efac' },
  warrior: { name: 'Warrior', gearLabel: 'Two-Handed',     tint: '#f0a35c' },
};

/** Map a stored captain build's weaponStyle to one of the four class GLBs. */
function unitClassFromWeaponStyle(style: WeaponStyle): UnitClass {
  switch (style) {
    case 'staff': return 'mage';
    case 'bow':
    case 'gun': return 'ranger';
    case 'axe':
    case 'greatsword':
    case 'spear': return 'warrior';
    default: return 'knight'; // sword_shield, mace_shield
  }
}

const LINEUP_SPACING = 3.6;
const LINEUP_Z = 0;
const CHAR_HEIGHT = 2.2;
const PEDESTAL_TOP = 0.3;

// Small outward tilt for the right-hand/weapon bone so baked weapons don't clip
// into the body. Local-frame degrees — flip a sign or swap axis if the weapon
// tilts the wrong way.
const RIGHT_HAND_OUTWARD_DEG = { z: 3 };

// ── Shield placement (knights) ─────────────────────────────────────────────
// The shield is a rigid mesh on the (non-animated) `L_shield_container` node,
// so this local offset holds it once and persists. `rot` is local degrees,
// `pos` a local-space nudge in the model's own (pre-fit) units. Tune live in
// the Barracks "Shield" panel; the dialed-in values persist to localStorage.
interface ShieldOffset {
  rot: { x: number; y: number; z: number };
  pos: { x: number; y: number; z: number };
}
const DEFAULT_SHIELD_OFFSET: ShieldOffset = {
  rot: { x: 0, y: 0, z: 0 },
  pos: { x: 0, y: 0, z: 0 },
};
const SHIELD_OFFSET_KEY = 'gw-shield-offset';

function loadShieldOffset(): ShieldOffset {
  try {
    const raw = localStorage.getItem(SHIELD_OFFSET_KEY);
    if (!raw) return DEFAULT_SHIELD_OFFSET;
    const p = JSON.parse(raw) as Partial<ShieldOffset>;
    return {
      rot: { ...DEFAULT_SHIELD_OFFSET.rot, ...(p.rot ?? {}) },
      pos: { ...DEFAULT_SHIELD_OFFSET.pos, ...(p.pos ?? {}) },
    };
  } catch {
    return DEFAULT_SHIELD_OFFSET;
  }
}


interface Pedestal { mesh: THREE.Mesh; ring: THREE.Mesh; x: number; z: number; }
interface LoadedCharacter {
  race: Race;
  faction: Faction;
  unit: UnitCharacter;
  pedestal: THREE.Mesh;
  /** Active one-shot "return to idle" listener, so it can be cleared on the next play. */
  finishHandler: ((e: { action: THREE.AnimationAction }) => void) | null;
}

export default function Barracks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const charsRef = useRef<Map<Race, LoadedCharacter>>(new Map());
  const pedestalsRef = useRef<Map<Race, Pedestal>>(new Map());
  const selectedRaceRef = useRef<Race | null>(null);
  // Invalidates in-flight class loads so a rapid class switch can't drop a
  // stale character into the lineup out of order.
  const loadTokenRef = useRef(0);
  // Cross-callback handle to the class-load helper defined inside useEffect.
  const loadClassRef = useRef<((cls: UnitClass) => void) | null>(null);
  const playClipRef = useRef<((char: LoadedCharacter, key: string) => void) | null>(null);
  const selectedClassValueRef = useRef<UnitClass>('knight');

  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [selectedClass, setSelectedClass] = useState<UnitClass>('knight');
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [glError, setGlError] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [, forceUpdate] = useState(0);

  const [shieldOffset, setShieldOffset] = useState<ShieldOffset>(loadShieldOffset);
  const shieldOffsetRef = useRef<ShieldOffset>(shieldOffset);

  const selectRace = useCallback((race: Race | null) => {
    selectedRaceRef.current = race;
    setSelectedRace(race);
  }, []);

  // Apply the current shield offset to a single loaded unit — only knights
  // carry a shield, so other classes are left untouched.
  const applyShieldToUnit = useCallback((unit: UnitCharacter, cls: UnitClass) => {
    if (cls !== 'knight') return;
    unit.setAttachmentOffset('shield', shieldOffsetRef.current);
  }, []);

  // Re-apply live to every loaded knight whenever the offset changes, and
  // persist the dialed-in values so they survive reloads.
  useEffect(() => {
    shieldOffsetRef.current = shieldOffset;
    try { localStorage.setItem(SHIELD_OFFSET_KEY, JSON.stringify(shieldOffset)); } catch { /* ignore */ }
    if (selectedClassValueRef.current !== 'knight') return;
    charsRef.current.forEach((char) => {
      char.unit.setAttachmentOffset('shield', shieldOffset);
    });
  }, [shieldOffset]);

  // ── Set a class on EVERY race at once (the core "they all change" UX) ──────
  const setClassForAll = useCallback((classKey: UnitClass) => {
    setSelectedClass(classKey);
    selectedClassValueRef.current = classKey;
    loadClassRef.current?.(classKey);
    forceUpdate((n) => n + 1);
  }, []);

  // ── Auto-apply the captain build forged on /class-tree (once per mount) ─────
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (isLoading || autoAppliedRef.current) return;
    autoAppliedRef.current = true; // guard BEFORE reloading so the re-triggered load doesn't re-apply
    const build = loadCaptainBuild();
    if (!build) return;
    const classKey = unitClassFromWeaponStyle(build.weaponStyle);
    setClassForAll(classKey);
    if (RACE_TO_UNIT[build.race]) selectRace(build.race);
    console.log(`[Barracks] Captain build → class "${classKey}", race "${build.race}"`);
  }, [isLoading, selectRace, setClassForAll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      console.error('[Barracks] WebGL context creation failed:', err);
      setGlError(true);
      setIsLoading(false);
      return;
    }
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.01);

    // PMREM-baked indoor environment map so MeshStandardMaterials light
    // correctly. Retain the render target (not just .texture) so cleanup can
    // free its underlying GPU framebuffer.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    const envMap = envRT.texture;
    scene.environment = envMap;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 6, 23);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.8, 0);
    controls.minDistance = 6;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.18;
    controlsRef.current = controls;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight), 0.2, 0.3, 0.85
    );
    composer.addPass(bloom);
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.uniforms['resolution'].value.set(
      1 / (container.clientWidth * renderer.getPixelRatio()),
      1 / (container.clientHeight * renderer.getPixelRatio())
    );
    composer.addPass(fxaa);

    scene.add(new THREE.AmbientLight(0x4466aa, 0.4));
    scene.add(new THREE.HemisphereLight(0x88aacc, 0x332211, 0.5));

    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.6);
    keyLight.position.set(10, 20, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 15;
    keyLight.shadow.camera.bottom = -15;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    fillLight.position.set(-10, 8, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff8844, 0.3);
    rimLight.position.set(0, 5, -15);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.95, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(40, 40, 0x333355, 0x222244);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clock = new THREE.Clock();
    let animFrame = 0;

    // Set true on unmount; pending async loader callbacks bail on it so they
    // never touch a torn-down scene.
    let disposed = false;

    // ── Build the six faction pedestals ONCE (characters swap on top) ─────────
    RACE_ORDER.forEach((race, index) => {
      const x = (index - (RACE_ORDER.length - 1) / 2) * LINEUP_SPACING;
      const z = LINEUP_Z;
      const ringColor = FACTION_COLORS[RACE_PREFIXES[race].faction] ?? '#c4a035';

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.05, 0.3, 24),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(ringColor),
          roughness: 0.4, metalness: 0.6,
          emissive: new THREE.Color(ringColor),
          emissiveIntensity: 0.1,
        })
      );
      mesh.position.set(x, 0.15, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.race = race;
      scene.add(mesh);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.1, 48),
        new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.32, z);
      scene.add(ring);

      pedestalsRef.current.set(race, { mesh, ring, x, z });
    });

    // ── Load every race's GLB for one class build (baked weapon + baked anims) ─
    const loadClass = (cls: UnitClass) => {
      const token = ++loadTokenRef.current;
      setIsLoading(true);
      setLoadProgress(0);
      let done = 0;

      RACE_ORDER.forEach((race) => {
        const ped = pedestalsRef.current.get(race);
        if (!ped) return;
        const { faction, slug } = RACE_TO_UNIT[race];
        const path = unitGLBPath(faction, slug, cls);

        UnitCharacter.load(path, { envMap, targetHeight: CHAR_HEIGHT, includeBank: false, stripRootMotion: true })
          .then((unit) => {
            if (disposed || token !== loadTokenRef.current) { unit.dispose(); return; }
            // Swap out the previous build for this race.
            const prev = charsRef.current.get(race);
            if (prev) {
              if (prev.finishHandler) prev.unit.mixer.removeEventListener('finished', prev.finishHandler);
              prev.unit.dispose();
            }

            // Keep the loader's feet-on-floor seating, just place it in the
            // lineup and lift onto the pedestal top.
            unit.object.position.x = ped.x;
            unit.object.position.z = ped.z;
            unit.object.position.y += PEDESTAL_TOP;
            unit.object.rotation.y = 0; // face the camera (+z)
            scene.add(unit.object);

            // Angle the weapon hand slightly outward so baked weapons don't
            // clip into the body/leg. Tweak RIGHT_HAND_OUTWARD_DEG if needed.
            unit.setRightHandOffset(RIGHT_HAND_OUTWARD_DEG);
            // Seat the shield correctly (knights only); no-op for other classes.
            applyShieldToUnit(unit, cls);
            unit.playFirstAvailable(['idle']);
            charsRef.current.set(race, { race, faction, unit, pedestal: ped.mesh, finishHandler: null });
          })
          .catch((err: unknown) => {
            console.warn(`[Barracks] Failed to load ${race}/${cls} (${path}):`, err);
          })
          .finally(() => {
            if (disposed || token !== loadTokenRef.current) return;
            done++;
            setLoadProgress(Math.floor((done / RACE_ORDER.length) * 100));
            if (done >= RACE_ORDER.length) setIsLoading(false);
          });
      });
    };
    loadClassRef.current = loadClass;

    // Kick off the initial (currently-selected) class build.
    loadClass(selectedClassValueRef.current);

    // ── Play a clip on one character; one-shots return to idle ────────────────
    const playClip = (char: LoadedCharacter, key: string) => {
      if (!char.unit.hasClip(key)) return;
      const mixer = char.unit.mixer;
      // Clear any pending one-shot listener from a previous play so it can't fire late.
      if (char.finishHandler) {
        mixer.removeEventListener('finished', char.finishHandler);
        char.finishHandler = null;
      }
      const loop = isLoopingClip(key);
      char.unit.play(key, { loop });
      if (!loop) {
        const onFin = (e: { action: THREE.AnimationAction }) => {
          // Only react to THIS clip finishing, not some other stale one-shot.
          if (e.action.getClip().name !== key) return;
          mixer.removeEventListener('finished', onFin);
          if (char.finishHandler === onFin) char.finishHandler = null;
          char.unit.playFirstAvailable(['idle']);
        };
        char.finishHandler = onFin;
        mixer.addEventListener('finished', onFin);
      }
    };
    playClipRef.current = playClip;

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const chars = Array.from(charsRef.current.values());
      const meshes: THREE.Object3D[] = [];
      pedestalsRef.current.forEach((p) => meshes.push(p.mesh));
      chars.forEach((c) => c.unit.object.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      }));

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length === 0) return;
      const hit = intersects[0].object;
      let race: Race | null = (hit.userData.race as Race) || null;

      if (!race) {
        for (const [r, charData] of charsRef.current.entries()) {
          let found = false;
          charData.unit.object.traverse((child) => { if (child === hit) found = true; });
          if (found) { race = r; break; }
        }
      }

      if (race) {
        selectedRaceRef.current = race;
        setSelectedRace(race);
        const charData = charsRef.current.get(race);
        if (charData) {
          controls.target.set(charData.unit.object.position.x, 2, charData.unit.object.position.z);
          playClip(charData, 'attack');
        }
      }
    };
    container.addEventListener('click', handleClick);

    const handleKeyDown = (e: KeyboardEvent) => {
      const sel = selectedRaceRef.current;
      const charData = sel ? charsRef.current.get(sel) : null;

      if (e.code >= 'Digit1' && e.code <= 'Digit9' && charData) {
        const anim = LOCOMOTION_KEYMAP[e.code.replace('Digit', '')];
        if (anim) playClip(charData, anim);
      }

      if (e.code === 'Escape') {
        selectedRaceRef.current = null;
        setSelectedRace(null);
        controls.target.set(0, 2, 0);
      }

      if (e.code === 'KeyH') setShowUI((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      controls.update();

      const sel = selectedRaceRef.current;
      charsRef.current.forEach((char) => {
        char.unit.update(dt);
        const isSelected = sel === char.race;
        const pedMat = char.pedestal.material as THREE.MeshStandardMaterial;
        const targetEmissive = isSelected ? 0.5 : 0.1;
        pedMat.emissiveIntensity += (targetEmissive - pedMat.emissiveIntensity) * 0.1;
      });

      composer.render();
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fxaa.uniforms['resolution'].value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('click', handleClick);
      cancelAnimationFrame(animFrame);
      controls.dispose();
      pmrem.dispose();
      envRT.dispose();
      loadClassRef.current = null;
      playClipRef.current = null;

      renderer.forceContextLoss();
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);

      charsRef.current.forEach((char) => {
        if (char.finishHandler) char.unit.mixer.removeEventListener('finished', char.finishHandler);
        char.unit.dispose();
      });
      charsRef.current.clear();
      pedestalsRef.current.forEach((p) => {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        p.ring.geometry.dispose();
        (p.ring.material as THREE.Material).dispose();
      });
      pedestalsRef.current.clear();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
    };
  }, []);

  const handleSelectRace = useCallback((race: Race) => {
    selectRace(race);
    const charData = charsRef.current.get(race);
    if (charData && controlsRef.current) {
      controlsRef.current.target.set(charData.unit.object.position.x, 2, charData.unit.object.position.z);
    }
  }, [selectRace]);

  const handlePlayAnim = useCallback((animName: string) => {
    const sel = selectedRaceRef.current;
    if (!sel) return;
    const charData = charsRef.current.get(sel);
    if (!charData || !charData.unit.hasClip(animName)) return;
    playClipRef.current?.(charData, animName);
  }, []);

  // Categorized clip list for the selected class, filtered to clips the loaded
  // unit actually carries (defensive — a build could lack a catalogued clip).
  const availableCategories = useCallback(() => {
    const sel = selectedRaceRef.current;
    const charData = sel ? charsRef.current.get(sel) : null;
    return animCategoriesForClass(selectedClass)
      .map((cat) => ({
        ...cat,
        clips: charData ? cat.clips.filter((c) => charData.unit.hasClip(c.key)) : cat.clips,
      }))
      .filter((cat) => cat.clips.length > 0);
  }, [selectedClass]);

  const classUI = CLASS_UI[selectedClass];

  return (
    <div className="relative w-full h-full" data-testid="barracks-page">
      <div ref={containerRef} className="w-full h-full" />

      {glError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e] z-30 p-8" data-testid="webgl-error">
          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-amber-200 text-lg font-bold" style={{ fontFamily: 'Cinzel, serif' }}>3D unavailable</h2>
            <p className="text-white/60 text-sm">
              Your browser couldn't create a WebGL context for the barracks. This usually
              clears up after closing other 3D tabs and reloading the page.
            </p>
          </div>
        </div>
      )}

      {isLoading && !glError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30" data-testid="loading-overlay">
          <div className="text-center space-y-3 min-w-[240px]">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/70 text-sm">Loading Barracks...</p>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${loadProgress}%` }} />
            </div>
            <p className="text-white/40 text-xs">{loadProgress}%</p>
          </div>
        </div>
      )}

      {showUI && (
        <>
          {/* TOP-LEFT: faction emblems */}
          <div className="absolute top-4 left-4 z-20" data-testid="row-faction-badges">
            <FactionEmblemRow size={36} />
          </div>

          {/* TOP-RIGHT: selected character / animations panel */}
          <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-amber-400/20 text-white w-[230px] space-y-2 shadow-[0_0_30px_-12px_rgba(251,191,36,0.4)]" data-testid="panel-selected-character">
            <div>
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-amber-200" style={{ fontFamily: 'Cinzel, serif' }}>Selected</h3>
              {selectedRace ? (
                <div className="mt-0.5">
                  <p className="text-sm font-semibold" style={{ color: classUI.tint, fontFamily: 'Cinzel, serif' }} data-testid="text-selected-class">
                    {RACE_DISPLAY_NAMES[selectedRace]}
                  </p>
                  <p className="text-[10px] text-white/50">{classUI.name} · {classUI.gearLabel}</p>
                </div>
              ) : (
                <p className="text-[10px] text-white/40 mt-0.5">Click a character below</p>
              )}
            </div>

            {selectedRace && (
              <div className="border-t border-white/10 pt-2 space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-white/50">Animations</label>
                <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                  {availableCategories().map((cat) => (
                    <div key={cat.id} className="space-y-0.5" data-testid={`group-anim-${cat.id}`}>
                      <div className="text-[9px] uppercase tracking-[0.15em] text-amber-200/70 px-0.5">{cat.label}</div>
                      <div className="grid grid-cols-2 gap-0.5">
                        {cat.clips.map((clip) => (
                          <button
                            key={clip.key}
                            onClick={() => handlePlayAnim(clip.key)}
                            title={clip.key}
                            className="text-left text-[10px] px-1.5 py-1 rounded bg-white/5 hover:bg-white/15 text-white/70 truncate border border-white/5"
                            data-testid={`button-anim-${clip.key}`}
                          >
                            {clip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM-LEFT: professions panel */}
          <div className="absolute bottom-4 left-4 z-20" data-testid="row-professions">
            <ProfessionsPanel />
          </div>

          {/* BOTTOM-CENTER: class selector (re-gears all races) + race chips */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2" data-testid="row-barracks-controls">
            {/* Class selector — the four class builds */}
            <div className="bg-black/60 backdrop-blur-md border border-amber-400/25 rounded-xl px-2 py-2 flex gap-2 shadow-[0_0_30px_-12px_rgba(251,191,36,0.5)]" data-testid="row-class-selector">
              {CLASS_ORDER.map((classKey) => {
                const ui = CLASS_UI[classKey];
                const isSel = selectedClass === classKey;
                return (
                  <button
                    key={classKey}
                    onClick={() => setClassForAll(classKey)}
                    disabled={isLoading}
                    className={`w-[120px] flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all border disabled:opacity-40 ${
                      isSel
                        ? 'border-amber-400/60 bg-amber-400/10'
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15'
                    }`}
                    style={isSel ? { boxShadow: `0 0 14px -2px ${ui.tint}99`, borderColor: `${ui.tint}99` } : undefined}
                    data-testid={`button-class-${classKey}`}
                  >
                    <span
                      className="text-[13px] font-semibold leading-tight"
                      style={{ color: ui.tint, fontFamily: 'Cinzel, serif' }}
                      data-testid={`text-class-name-${classKey}`}
                    >
                      {ui.name}
                    </span>
                    <span className="text-[10px] text-white/65 leading-tight whitespace-nowrap">
                      {ui.gearLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Race chips — click to focus a single unit */}
            <div className="bg-black/45 backdrop-blur-sm border border-white/5 rounded-lg px-1.5 py-1.5 flex gap-1" data-testid="row-race-chips">
              {RACE_ORDER.map((race) => {
                const isSel = selectedRace === race;
                const tint = FACTION_COLORS[RACE_PREFIXES[race].faction] ?? '#c4a035';
                return (
                  <button
                    key={race}
                    onClick={() => handleSelectRace(race)}
                    className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all border ${
                      isSel
                        ? 'bg-white/15 text-white border-white/30'
                        : 'bg-white/[0.03] text-white/55 border-white/5 hover:bg-white/10 hover:text-white/80'
                    }`}
                    style={isSel ? { boxShadow: `0 0 10px -3px ${tint}`, borderColor: `${tint}99` } : undefined}
                    data-testid={`button-race-${race}`}
                  >
                    {RACE_DISPLAY_NAMES[race]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: shield placement tuner (knights only) */}
          {selectedClass === 'knight' && (
            <div
              className="absolute top-1/2 right-4 -translate-y-1/2 z-20 w-[220px] bg-black/65 backdrop-blur-md border border-amber-400/25 rounded-xl px-3 py-3 shadow-[0_0_30px_-12px_rgba(251,191,36,0.5)]"
              data-testid="panel-shield-tuner"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-amber-200" style={{ fontFamily: 'Cinzel, serif' }}>
                  Shield Placement
                </span>
                <button
                  onClick={() => setShieldOffset(DEFAULT_SHIELD_OFFSET)}
                  className="text-[10px] text-white/60 hover:text-white border border-white/10 rounded px-1.5 py-0.5"
                  data-testid="button-shield-reset"
                >
                  Reset
                </button>
              </div>
              {([
                ['Rotate X', 'rot', 'x', -180, 180, 1, '°'],
                ['Rotate Y', 'rot', 'y', -180, 180, 1, '°'],
                ['Rotate Z', 'rot', 'z', -180, 180, 1, '°'],
                ['Move X', 'pos', 'x', -10, 10, 0.25, ''],
                ['Move Y', 'pos', 'y', -10, 10, 0.25, ''],
                ['Move Z', 'pos', 'z', -10, 10, 0.25, ''],
              ] as const).map(([label, group, axis, min, max, step, unit]) => {
                const val = shieldOffset[group][axis];
                return (
                  <div key={`${group}-${axis}`} className="mb-1.5">
                    <div className="flex items-center justify-between text-[10px] text-white/60 mb-0.5">
                      <span>{label}</span>
                      <span className="text-white/80 tabular-nums">{val}{unit}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value);
                        setShieldOffset((prev) => ({
                          ...prev,
                          [group]: { ...prev[group], [axis]: next },
                        }));
                      }}
                      className="w-full accent-amber-400"
                      data-testid={`slider-shield-${group}-${axis}`}
                    />
                  </div>
                );
              })}
              <p className="text-[9px] text-white/40 leading-snug mt-1">
                Live-tunes every knight's shield. Values persist automatically.
              </p>
            </div>
          )}

          {/* BOTTOM-RIGHT: compact key hints */}
          <div className="absolute bottom-4 right-4 z-20" data-testid="row-keyhints">
            <div className="bg-black/45 backdrop-blur-sm rounded-lg px-3 py-2 text-white/50 text-[10px] border border-white/5 flex flex-col gap-0.5 leading-snug">
              <span><kbd className="text-amber-200">Click</kbd> select unit</span>
              <span><kbd className="text-amber-200">1</kbd> idle · <kbd className="text-amber-200">2</kbd> walk · <kbd className="text-amber-200">3</kbd> run · <kbd className="text-amber-200">4</kbd> sprint · <kbd className="text-amber-200">5</kbd> jump</span>
              <span><kbd className="text-amber-200">6</kbd> crawl · <kbd className="text-amber-200">7</kbd> swim · <kbd className="text-amber-200">8</kbd> dodge · <kbd className="text-amber-200">9</kbd> attack</span>
              <span><kbd className="text-amber-200">Esc</kbd> deselect · <kbd className="text-amber-200">H</kbd> toggle UI</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
