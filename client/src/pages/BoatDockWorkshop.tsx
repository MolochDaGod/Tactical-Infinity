/**
 * Interactive boat dock — pick a raft hull, attach, upgrade, load the player's boat.
 * Backdrop is the boatbuilder scene: sea shack + wooden docks + island (1).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { EditorGizmoSession, type EditorGizmoMode, type EditorMaterialFamilyId } from '@/lib/editorTools';
import EditorGizmoHud from '@/components/editor/EditorGizmoHud';
import {
  RAFT_ATTACHMENTS,
  RAFT_HULLS,
  attachmentsForSlot,
  getRaftHull,
  type RaftAttachmentId,
  type RaftAttachmentSlot,
  type RaftHullDef,
} from '@shared/gameDefinitions/waterEngagement';
import {
  awardBoatCraftXp,
  discoverRecipe,
  getBoatCraftXp,
  getHarvestLevel,
  getRaftLoadout,
  isBoatDockBuilt,
  isFishermansBoatLearned,
  isRecipeDiscovered,
  loadProgression,
  markBoatDockBuilt,
  markRaftBuilt,
  setActiveRaftHull,
  setRaftAttachment,
} from '@/lib/playerProgression';
import {
  FISHERMANS_BOAT_PATH,
  FISHERMANS_BOAT_UNLOCK,
  HARVEST_TREES,
} from '@shared/gameDefinitions/professions';
import { loadDockWorkshopScene } from '@/lib/dockWorkshopScene';
import {
  attachDeckXyz,
  bindWorkshopCreatures,
  bobCreatures,
  playSceneClips,
  type DeckXyzRow,
} from '@/lib/dockWorkshopRuntime';
import { MarineYukaSystem } from '@/lib/ai/MarineYukaSystem';
import { CharacterBuilder } from '@/lib/character/CharacterBuilder';
import { loadCaptainBuild } from '@/lib/captainBuild';
import type { BoatId } from '@shared/gameDefinitions/boatRegistry';

const SLOTS: RaftAttachmentSlot[] = ['sail', 'mast', 'storage', 'utility', 'mooring', 'canopy'];

interface Props {
  onBack: () => void;
  onLaunch?: () => void;
}

export default function BoatDockWorkshop({ onBack, onLaunch }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hullMeshRef = useRef<THREE.Group | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const dockRef = useRef<THREE.Object3D | null>(null);
  const berthRef = useRef(new THREE.Vector3(6.2, 0.28, 7.4));
  const oceanRef = useRef<{ update: (t: number, cam?: THREE.Camera) => void } | null>(null);
  const gizmoRef = useRef<EditorGizmoSession | null>(null);
  const [hullId, setHullId] = useState(() => loadProgression().activeRaftHullId || 'short_plank');
  const [viewFisherman, setViewFisherman] = useState(false);
  const [xp, setXp] = useState(() => getBoatCraftXp());
  const [, tick] = useState(0);
  const [status, setStatus] = useState('dock');
  const [gizmoMode, setGizmoMode] = useState<EditorGizmoMode>('translate');
  const [selName, setSelName] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [deckRows, setDeckRows] = useState<DeckXyzRow[]>([]);
  const [testerOn, setTesterOn] = useState(
    () => new URLSearchParams(window.location.search).has('tester'),
  );
  const marineRef = useRef<MarineYukaSystem | null>(null);
  const mixersRef = useRef<THREE.AnimationMixer[]>([]);
  const sceneRootRef = useRef<THREE.Object3D | null>(null);
  const testerRef = useRef<CharacterBuilder | null>(null);
  const keysRef = useRef(new Set<string>());

  const hull = getRaftHull(hullId);
  const loadout = getRaftLoadout();
  const dockReady = isBoatDockBuilt();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b8d4);
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.08, 220);
    camera.position.set(9, 3.2, 11);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(2.5, 1.2, 3.5);
    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 1));
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.3);
    sun.position.set(12, 20, 8);
    scene.add(sun);

    const root = new THREE.Group();
    root.name = 'workshop_hull';
    scene.add(root);
    rootRef.current = root;

    const gizmo = new EditorGizmoSession({
      scene,
      camera,
      domElement: renderer.domElement,
      orbit: controls,
      pickRoots: () => [root, dockRef.current].filter(Boolean) as THREE.Object3D[],
      onSelect: (obj) => {
        setSelName(obj ? obj.name || obj.type : null);
        if (!obj) setFamilyId(null);
      },
      onMode: setGizmoMode,
    });
    gizmoRef.current = gizmo;

    let disposed = false;
    let workshopDispose: (() => void) | null = null;
    void loadDockWorkshopScene(scene).then((ws) => {
      if (disposed) {
        ws.dispose();
        return;
      }
      dockRef.current = ws.group;
      sceneRootRef.current = ws.root;
      berthRef.current.copy(ws.berth);
      oceanRef.current = ws.ocean;
      controls.target.copy(ws.lookAt);
      camera.position.set(ws.lookAt.x + 8, 3.4, ws.lookAt.z + 10);
      camera.lookAt(ws.lookAt);
      controls.minDistance = 2;
      controls.maxDistance = 48;
      workshopDispose = () => ws.dispose();
      if (hullMeshRef.current) hullMeshRef.current.position.copy(ws.berth);
      const marine = new MarineYukaSystem('dock-workshop');
      marineRef.current = marine;
      const fishN = bindWorkshopCreatures(ws.root, marine, mixersRef.current);
      playSceneClips(ws.root, ws.clips, mixersRef.current);
      const [sx, sy, sz] = ws.report.sceneSizeM;
      setStatus(
        `SI ${ws.report.playerHeightM}m · water y=0 · fish ${fishN} · dropped ${ws.report.dropped.length} · pad ${sx.toFixed(0)}×${sz.toFixed(0)}m`,
      );
      if (testerOn) {
        ws.player.visible = false;
        const cap = loadCaptainBuild();
        const b = new CharacterBuilder({ race: cap?.race ?? 'human', weaponStyle: cap?.weaponStyle ?? 'sword_shield' });
        b.group.position.copy(ws.player.position);
        scene.add(b.group);
        testerRef.current = b;
        void b.load();
      }
    });

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (down) keysRef.current.add(k);
      else keysRef.current.delete(k);
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const clock = new THREE.Clock();
    let raf = 0;
    const tickLoop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      controls.update();
      oceanRef.current?.update(t, camera);
      marineRef.current?.update(dt);
      for (const m of mixersRef.current) m.update(dt);
      if (sceneRootRef.current) bobCreatures(sceneRootRef.current, t);
      const tb = testerRef.current;
      if (tb?.ready) {
        const keys = keysRef.current;
        const moving = keys.has('w') || keys.has('a') || keys.has('s') || keys.has('d');
        const spd = 3.2 * dt;
        if (keys.has('w')) tb.group.position.z -= spd;
        if (keys.has('s')) tb.group.position.z += spd;
        if (keys.has('a')) tb.group.position.x -= spd;
        if (keys.has('d')) tb.group.position.x += spd;
        tb.play(moving ? 'walk' : 'idle');
        tb.update(dt);
      }
      gizmo.updateOutline();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tickLoop);
    };
    tickLoop();
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      testerRef.current?.dispose();
      gizmo.dispose();
      gizmoRef.current = null;
      workshopDispose?.();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (hullMeshRef.current) {
      gizmoRef.current?.detach();
      root.remove(hullMeshRef.current);
      hullMeshRef.current = null;
    }
    const loader = new GLTFLoader();
    setStatus('loading hull');
    const path = viewFisherman ? FISHERMANS_BOAT_PATH : hull.modelPath;
    const lengthM = viewFisherman ? 4.8 : hull.lengthM;
    loader.load(
      path,
      (gltf) => {
        const g = gltf.scene;
        normalizeToMetres(g, { targetSizeM: lengthM, axis: 'length', ground: true, centerXZ: true });
        g.position.copy(berthRef.current);
        root.add(g);
        hullMeshRef.current = g;
        const boatId: BoatId = viewFisherman ? 'skiff' : 'raft';
        setDeckRows(attachDeckXyz(g, boatId).rows);
        setStatus('ok');
      },
      undefined,
      () => setStatus('missing mesh'),
    );
  }, [hull.modelPath, hull.heightM, viewFisherman]);

  const buildHull = (def: RaftHullDef) => {
    if (def.requiresDock && !dockReady) {
      markBoatDockBuilt();
    }
    markRaftBuilt();
    setActiveRaftHull(def.id);
    const total = awardBoatCraftXp(def.craftXp);
    setXp(total);
    setHullId(def.id);
    setViewFisherman(false);
    tick((n) => n + 1);
  };

  const equip = (slot: RaftAttachmentSlot, id: RaftAttachmentId) => {
    setRaftAttachment(slot, id);
    tick((n) => n + 1);
  };

  return (
    <div className="h-screen w-full flex bg-[#0a0705] text-[#e0d8c8]" data-testid="boat-dock-workshop">
      <aside className="w-80 border-r border-amber-900/40 p-3 overflow-y-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const u = new URL(window.location.href);
            u.searchParams.set('tester', '1');
            window.location.href = u.toString();
          }}
        >
          Character tester
        </Button>
        <h1 className="font-serif text-amber-300 text-sm tracking-widest uppercase">Boat dock</h1>
        <p className="text-[11px] text-amber-200/60">
          1.8 m player yardstick. One scene, no stacked oceans. Craft XP:{' '}
          <span className="text-amber-300">{xp}</span>
        </p>

        {deckRows.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">Deck XYZ (m)</h2>
            <table className="w-full text-[10px] text-slate-400">
              <thead>
                <tr className="text-amber-500/80">
                  <th className="text-left">pad</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Z</th>
                </tr>
              </thead>
              <tbody>
                {deckRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td className="text-center">{r.x.toFixed(2)}</td>
                    <td className="text-center">{r.y.toFixed(2)}</td>
                    <td className="text-center">{r.z.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[9px] text-slate-500 mt-1">+Z bow · +X starboard · 1.8 m axes</p>
          </section>
        )}

        <section>
          <h2 className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">Short rafts</h2>
          {RAFT_HULLS.filter((h) => h.cls === 'short').map((h) => (
            <HullRow key={h.id} def={h} active={hullId === h.id} onBuild={() => buildHull(h)} />
          ))}
        </section>
        <section>
          <h2 className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">Long rafts</h2>
          {RAFT_HULLS.filter((h) => h.cls === 'long').map((h) => (
            <HullRow
              key={h.id}
              def={h}
              active={hullId === h.id}
              locked={!!h.discoverable && !isRecipeDiscovered(h.id)}
              onBuild={() => {
                if (h.discoverable && !isRecipeDiscovered(h.id)) return;
                buildHull(h);
              }}
            />
          ))}
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">
            Fishing hull · {HARVEST_TREES.fishing.profession.name} Lv {getHarvestLevel('fishing')}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!isFishermansBoatLearned()) return;
              setViewFisherman(true);
              discoverRecipe(FISHERMANS_BOAT_UNLOCK);
              awardBoatCraftXp(80);
              tick((n) => n + 1);
            }}
            disabled={!isFishermansBoatLearned()}
            className={`w-full text-left text-xs px-2 py-1.5 rounded border mb-1 ${
              !isFishermansBoatLearned()
                ? 'border-white/10 opacity-50'
                : viewFisherman
                  ? 'border-sky-400 bg-sky-950/50'
                  : 'border-white/10 hover:border-sky-700/40'
            }`}
          >
            <div className="flex justify-between">
              <span>Fisherman's Boat</span>
              <span className="text-sky-300/80">
                {isFishermansBoatLearned() ? '+80 xp' : 'Lv 26'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              {isFishermansBoatLearned()
                ? '4.8 m fishing hull · learned on the fishing tree'
                : 'Journeyman fishing unlock — same 1/11/26/51/76 ladder as mining'}
            </div>
          </button>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">Attachments</h2>
          {SLOTS.map((slot) => (
            <div key={slot} className="mb-2">
              <div className="text-[10px] text-slate-400 mb-0.5">{slot}</div>
              <div className="flex flex-wrap gap-1">
                {attachmentsForSlot(slot).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => equip(slot, a.id)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      loadout[slot] === a.id
                        ? 'border-amber-400 bg-amber-900/40'
                        : 'border-white/15'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <Button className="w-full" onClick={onLaunch} data-testid="button-load-boat">
          Load boat · set sail
        </Button>
        <p className="text-[10px] text-slate-500">{status} · {RAFT_ATTACHMENTS.length} attachments</p>
      </aside>
      <div className="flex-1 relative">
        <div ref={wrapRef} className="absolute inset-0" />
        <EditorGizmoHud
          mode={gizmoMode}
          selectedName={selName}
          familyId={familyId}
          onMode={(m) => {
            setGizmoMode(m);
            gizmoRef.current?.setMode(m);
          }}
          onFamily={async (id: EditorMaterialFamilyId) => {
            await gizmoRef.current?.applyFamily(id);
            setFamilyId(id);
          }}
          onTint={(hex) => gizmoRef.current?.tint(hex)}
          onRoughness={(v) => gizmoRef.current?.setPbr({ roughness: v })}
          onMetalness={(v) => gizmoRef.current?.setPbr({ metalness: v })}
          onRepeat={(v) => gizmoRef.current?.setPbr({ repeat: v })}
          onTextureFile={(file) => void gizmoRef.current?.applyAlbedoFile(file)}
          onDeselect={() => gizmoRef.current?.detach()}
        />
        <div className="absolute bottom-3 left-3 text-[11px] bg-black/55 border border-amber-800/40 px-2 py-1 rounded">
          {viewFisherman
            ? "Fisherman's Boat · 4.8 m · fishing"
            : `${hull.name} · ${hull.lengthM} m · ${hull.cls}`}
        </div>
      </div>
    </div>
  );
}

function HullRow({
  def,
  active,
  onBuild,
  locked,
}: {
  def: RaftHullDef;
  active: boolean;
  onBuild: () => void;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onBuild}
      disabled={locked}
      className={`w-full text-left text-xs px-2 py-1.5 rounded border mb-1 ${
        locked
          ? 'border-white/10 opacity-50'
          : active
            ? 'border-amber-400 bg-amber-950/50'
            : 'border-white/10 hover:border-amber-700/40'
      }`}
    >
      <div className="flex justify-between">
        <span>{def.name}</span>
        <span className="text-amber-400/70">{locked ? '???' : `+${def.craftXp} xp`}</span>
      </div>
      <div className="text-[10px] text-slate-500">
        {locked
          ? (def.discoverHint ?? 'Discover this recipe')
          : `${def.lengthM} m · wood ${def.cost.wood} · hemp ${def.cost.hemp}${def.requiresDock ? ' · dock' : ' · beach'}`}
      </div>
    </button>
  );
}
