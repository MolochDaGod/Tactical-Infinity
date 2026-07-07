/**
 * UnitViewer — browse the baked-GLB starting builds.
 *
 * Pick a faction → race → class and preview the self-contained unit GLB with
 * its baked animations, plus the shared anim-bank library (123 clips) applied
 * to the same Bip001 rig. Proves "units starting build for each class with
 * baked animations" + "shared library for all the other animations".
 *
 * WebGL cleanup: the renderer is created via `createOptimalRenderer`, whose
 * `dispose()` calls `renderer.forceContextLoss()` before `dispose()` (per the
 * project's WebGL rule).
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Play, Pause, RotateCw, Loader2, Sparkles } from 'lucide-react';
import {
  createOptimalRenderer,
  createSceneDefaults,
  createCharacterLights,
  buildProcEnvMap,
  createGroundPlane,
  createFactionPedestal,
} from '@/lib/threeWebGLSetup';
import {
  FACTIONS,
  FACTION_UNIT_RACES,
  UNIT_CLASSES,
  FACTION_UNIT_COLORS,
  unitGLBPath,
  type UnitClass,
} from '@/data/factionUnits';
import type { Faction } from '@/data/toonRTSAssets';
import { UnitCharacter, type ClipInfo } from '@/lib/character/UnitGLBLoader';

interface Props {
  onBack: () => void;
}

const FACTION_BADGE: Record<Faction, string> = {
  crusade: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  fabled: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  legion: 'bg-red-500/20 text-red-300 border-red-500/40',
};

/** Detach a pedestal group and free all its geometries/materials/textures. */
function disposePedestal(group: THREE.Group | null): void {
  if (!group) return;
  group.removeFromParent();
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      const anyMat = m as unknown as Record<string, unknown>;
      for (const key of Object.keys(anyMat)) {
        const val = anyMat[key];
        if (val && val instanceof THREE.Texture) val.dispose();
      }
      m.dispose();
    }
  });
}

export default function UnitViewer({ onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(false);

  // Scene handles that outlive individual unit loads.
  const sceneRef = useRef<THREE.Scene | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  const pedestalRef = useRef<THREE.Group | null>(null);
  const unitRef = useRef<UnitCharacter | null>(null);
  const clockRef = useRef(new THREE.Clock());

  const [faction, setFaction] = useState<Faction>('crusade');
  const [raceSlug, setRaceSlug] = useState<string>(FACTION_UNIT_RACES.crusade[0].slug);
  const [cls, setCls] = useState<UnitClass>('knight');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [webglError, setWebglError] = useState(false);

  const controlsRef = useRef<OrbitControls | null>(null);

  const raceLabel = useMemo(
    () => FACTION_UNIT_RACES[faction].find((r) => r.slug === raceSlug)?.label ?? raceSlug,
    [faction, raceSlug],
  );

  // Group clips for the browser panel.
  const bakedClips = useMemo(() => clips.filter((c) => c.source === 'baked'), [clips]);
  const bankByCategory = useMemo(() => {
    const map = new Map<string, ClipInfo[]>();
    for (const c of clips) {
      if (c.source !== 'bank') continue;
      (map.get(c.category) ?? map.set(c.category, []).get(c.category)!).push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [clips]);

  // ── One-time scene / renderer setup ────────────────────────────────────────
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const canvas = canvasRef.current!;
    let rendererBundle: ReturnType<typeof createOptimalRenderer>;
    try {
      rendererBundle = createOptimalRenderer({ canvas });
    } catch (err) {
      console.error('[UnitViewer] WebGL unavailable:', err);
      setWebglError(true);
      setLoading(false);
      mountedRef.current = false;
      return;
    }
    const { renderer, pmremGenerator, dispose: disposeRenderer } = rendererBundle;

    const scene = createSceneDefaults();
    sceneRef.current = scene;
    const envMap = buildProcEnvMap(pmremGenerator);
    envMapRef.current = envMap;
    scene.environment = envMap;

    createCharacterLights(scene);
    scene.add(createGroundPlane(30));

    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    camera.position.set(0, 1.7, 4.2);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 1.0, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.1;
    controlsRef.current = controls;

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
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      unitRef.current?.update(dt);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      unitRef.current?.dispose();
      unitRef.current = null;
      disposePedestal(pedestalRef.current);
      pedestalRef.current = null;
      envMap.dispose();
      disposeRenderer(); // → forceContextLoss() then dispose()
    };
  }, []);

  // Keep auto-rotate in sync.
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  // ── (Re)load unit whenever the selection changes ───────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setClips([]);
    setActiveClip(null);

    // Swap the faction pedestal.
    disposePedestal(pedestalRef.current);
    const pedestal = createFactionPedestal(FACTION_UNIT_COLORS[faction]);
    pedestal.position.set(0, 0.125, 0);
    scene.add(pedestal);
    pedestalRef.current = pedestal;

    const path = unitGLBPath(faction, raceSlug, cls);

    UnitCharacter.load(path, { envMap: envMapRef.current })
      .then((unit) => {
        if (cancelled) {
          unit.dispose();
          return;
        }
        unitRef.current?.dispose();
        unitRef.current = unit;
        unit.object.position.y += 0.25; // stand on the pedestal top
        scene.add(unit.object);

        setClips(unit.clips);
        // Default to an idle-like clip.
        const started =
          unit.playFirstAvailable(['idle', 'bank/unarmed/fight_idle', 'bank/locomotion/idle']);
        if (started) {
          const firstIdle = unit.clips.find((c) => c.key === 'idle') ?? unit.clips[0];
          setActiveClip(firstIdle?.key ?? null);
        } else if (unit.clips[0]) {
          unit.play(unit.clips[0].key);
          setActiveClip(unit.clips[0].key);
        }
        setPaused(false);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[UnitViewer] load failed:', msg);
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [faction, raceSlug, cls]);

  const handleFaction = useCallback((f: Faction) => {
    setFaction(f);
    setRaceSlug(FACTION_UNIT_RACES[f][0].slug);
  }, []);

  const handlePlayClip = useCallback((key: string, loop: boolean) => {
    const unit = unitRef.current;
    if (!unit) return;
    unit.play(key, { loop });
    unit.setPaused(false);
    setPaused(false);
    setActiveClip(key);
  }, []);

  const togglePause = useCallback(() => {
    const unit = unitRef.current;
    if (!unit) return;
    setPaused((p) => {
      unit.setPaused(!p);
      return !p;
    });
  }, []);

  const clipButton = (c: ClipInfo, loop = true) => (
    <button
      key={c.key}
      onClick={() => handlePlayClip(c.key, loop)}
      data-testid={`button-clip-${c.key.replace(/[^a-z0-9]/gi, '-')}`}
      className={`text-left text-xs px-2 py-1 rounded border transition-colors truncate ${
        activeClip === c.key
          ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
      }`}
      title={c.label}
    >
      {c.label}
    </button>
  );

  return (
    <div className="w-full h-screen flex bg-[#0b0b14] text-slate-200 overflow-hidden">
      {/* ── Left control rail ──────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-white/10 flex flex-col bg-black/30">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-back"
            className="text-slate-300"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <span className="font-semibold text-sm tracking-wide">Unit Builds</span>
        </div>

        <div className="p-3 space-y-4 overflow-y-auto">
          {/* Faction */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Faction</div>
            <div className="grid grid-cols-3 gap-1">
              {FACTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFaction(f.id)}
                  data-testid={`button-faction-${f.id}`}
                  className={`text-xs py-1.5 rounded border transition-colors ${
                    faction === f.id
                      ? FACTION_BADGE[f.id]
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Race */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Race</div>
            <div className="grid grid-cols-2 gap-1">
              {FACTION_UNIT_RACES[faction].map((r) => (
                <button
                  key={r.slug}
                  onClick={() => setRaceSlug(r.slug)}
                  data-testid={`button-race-${r.slug}`}
                  className={`text-xs py-1.5 px-1 rounded border transition-colors truncate ${
                    raceSlug === r.slug
                      ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Class */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Class</div>
            <div className="grid grid-cols-2 gap-1">
              {UNIT_CLASSES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCls(c.id)}
                  data-testid={`button-class-${c.id}`}
                  className={`text-xs py-1.5 rounded border transition-colors ${
                    cls === c.id
                      ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Baked animations */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              Baked animations
              <Badge variant="outline" className="text-[10px] py-0 px-1 border-white/20">
                {bakedClips.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {bakedClips.map((c) => clipButton(c, c.key !== 'idle'))}
            </div>
          </div>
        </div>

        {/* Shared bank (scrolls) */}
        <div className="flex-1 min-h-0 border-t border-white/10 flex flex-col">
          <div className="p-3 pb-1 text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Shared library
            <Badge variant="outline" className="text-[10px] py-0 px-1 border-white/20">
              {clips.filter((c) => c.source === 'bank').length}
            </Badge>
          </div>
          <ScrollArea className="flex-1 px-3 pb-3">
            <div className="space-y-2">
              {bankByCategory.map(([cat, list]) => (
                <div key={cat}>
                  <div className="text-[10px] uppercase text-slate-500 mb-0.5">{cat}</div>
                  <div className="grid grid-cols-1 gap-1">{list.map((c) => clipButton(c, false))}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* ── Viewport ───────────────────────────────────────────────────────── */}
      <main className="relative flex-1 min-w-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        {webglError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 text-slate-300"
            data-testid="status-webgl-error"
          >
            <p className="text-lg font-semibold text-amber-400">3D preview unavailable</p>
            <p className="text-sm text-slate-400 max-w-sm">
              This browser or session could not create a WebGL context. The unit registry and
              animation list below still work.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Badge className={FACTION_BADGE[faction]}>{FACTIONS.find((f) => f.id === faction)?.label}</Badge>
          <span className="text-sm font-medium" data-testid="text-unit-name">
            {raceLabel} · {UNIT_CLASSES.find((c) => c.id === cls)?.label}
          </span>
        </div>

        {/* Playback controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={togglePause}
            data-testid="button-toggle-pause"
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <Button
            variant={autoRotate ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setAutoRotate((r) => !r)}
            data-testid="button-toggle-rotate"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Active clip readout */}
        {activeClip && (
          <div className="absolute bottom-3 left-3 text-xs text-slate-400" data-testid="text-active-clip">
            Playing: <span className="text-amber-300">{activeClip}</span>
          </div>
        )}

        {loading && !webglError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading unit…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-300 text-sm max-w-md text-center" data-testid="text-error">
              Failed to load unit: {error}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
