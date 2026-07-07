/**
 * /islands — canonical island generator demo and source-of-truth pattern.
 *
 * This page is intentionally the *one* place where the canonical pipeline
 * lives end-to-end so that other scenes (ProductionIsland, IslandBattlePage,
 * OpenWaterSailing) can be migrated to it incrementally. The pipeline is
 * exposed as a single composable: `buildIslandScene()` from
 * `lib/islandsCanonical`. See that module's barrel for the full pieces:
 *
 *   IslandHeightmap      — multi-octave Simplex + ridges + island shaping
 *   IslandChunks         — N×N BufferGeometry tiles with per-chunk LOD
 *   IslandSky            — cloud-shader dome with weather + time-of-day
 *   IslandWeatherOverlay — screen-space rain + lightning post-process
 *   DynamicOcean         — existing high-quality water shader, reused
 *
 * UI controls: biome, weather, time-of-day, regenerate, chunk-debug toggle.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import {
  buildIslandScene,
  type IslandScene,
  type IslandBiomePreset,
  type SkyWeather,
  type SkyTimeOfDay,
} from "@/lib/islandsCanonical";
import { ShaderBackdrop, isSkyShaderId, SKY_SHADERS, type SkyShaderId } from "@/lib/shaders/skyShaders";
import { CharacterController } from "@/lib/CharacterController";
import { FollowCamera } from "@/lib/camera/FollowCamera";
import { TerrainEditor, type BrushMode } from "@/lib/islandsCanonical/TerrainEditor";
import type { LandScatterResult } from "@/lib/islandsCanonical/LandScatter";

type IslandTool = "orbit" | "mine" | "shovel";
const BRUSH_MODES: BrushMode[] = ["raise", "lower", "level", "smooth"];

const BIOME_LABELS: Record<IslandBiomePreset, string> = {
  tropical:  "Tropical Paradise",
  temperate: "Temperate Highlands",
  volcanic:  "Volcanic Wastes",
  arctic:    "Frozen Expanse",
  desert:    "Scorched Sands",
};

const WEATHER_LABELS: Record<SkyWeather, string> = {
  clear:  "Clear",
  cloudy: "Cloudy",
  rain:   "Rain",
  storm:  "Tempest",
  mist:   "Mist",
};

const TOD_LABELS: Record<SkyTimeOfDay, string> = {
  dawn:  "Dawn",
  noon:  "Noon",
  dusk:  "Dusk",
  night: "Night",
};

export default function Islands() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef  = useRef<EffectComposer | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const islandRef    = useRef<IslandScene | null>(null);
  const backdropRef  = useRef<ShaderBackdrop | null>(null);
  const clockRef     = useRef(new THREE.Clock());
  const animFrameRef = useRef<number>(0);
  const playerRef    = useRef<CharacterController | null>(null);
  const tpCamRef     = useRef<FollowCamera | null>(null);
  const walkModeRef  = useRef<boolean>(false);
  const landScatterRef  = useRef<LandScatterResult | null>(null);
  const terrainEditorRef = useRef<TerrainEditor | null>(null);
  const toolRef        = useRef<IslandTool>("orbit");
  const brushModeRef   = useRef<BrushMode>("raise");
  const brushRadiusRef = useRef<number>(14);
  const brushingRef    = useRef<boolean>(false);

  // Read ?shader=hills|spheroid|elevated|weather once at mount. When set, a
  // fullscreen Shadertoy backdrop is drawn behind the procedural island.
  const initialShaderId: SkyShaderId | null = (() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search).get("shader");
    return isSkyShaderId(q) ? q : null;
  })();

  const [biome,   setBiome]   = useState<IslandBiomePreset>("tropical");
  const [weather, setWeather] = useState<SkyWeather>("clear");
  const [tod,     setTod]     = useState<SkyTimeOfDay>("noon");
  const [seed,    setSeed]    = useState(Math.floor(Math.random() * 65536));
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showChunks,   setShowChunks]   = useState(false);
  const [walkMode,     setWalkMode]     = useState(false);
  const [tool,         setTool]         = useState<IslandTool>("orbit");
  const [brushMode,    setBrushMode]    = useState<BrushMode>("raise");
  const [brushRadius,  setBrushRadius]  = useState(14);
  const [debugCounts,  setDebugCounts]  = useState<{ trees: number; rocks: number; plants: number; flowers: number; animals: number } | null>(null);

  // Rebuild the entire island when biome/seed changes; weather/TOD swap live.
  const rebuild = useCallback((b: IslandBiomePreset, s: number, w: SkyWeather, t: SkyTimeOfDay) => {
    const scene = sceneRef.current;
    const composer = composerRef.current;
    if (!scene || !composer) return;

    if (islandRef.current) {
      const passes = (composer as unknown as { passes: ShaderPass[] }).passes;
      const idx = passes.indexOf(islandRef.current.weatherPass);
      if (idx >= 0) passes.splice(idx, 1);
      islandRef.current.dispose();
    }
    landScatterRef.current = null;
    terrainEditorRef.current = null;

    // Tear down any old player on rebuild.
    if (playerRef.current) {
      const old = playerRef.current;
      if (old.model) scene.remove(old.model);
      old.dispose();
      playerRef.current = null;
    }

    const island = buildIslandScene(scene, {
      biome: b,
      seed: s,
      resolution: 512,
      chunksPerSide: 8,
      weatherOverride: w,
      timeOfDayOverride: t,
    });
    const passes = (composer as unknown as { passes: ShaderPass[] }).passes;
    passes.splice(passes.length - 1, 0, island.weatherPass);
    islandRef.current = island;
    terrainEditorRef.current = new TerrainEditor(island.heightmap, island.chunks);
    setIsReady(true);
    island.landScatter.then((r) => {
      if (r) {
        setDebugCounts(r.counts);
        landScatterRef.current = r;
      }
    });
  }, []);

  // Live-tweak helpers — no rebuild, just push to uniforms.
  const applyWeather = useCallback((w: SkyWeather) => {
    setWeather(w);
    islandRef.current?.setWeather(w);
  }, []);
  const applyTod = useCallback((t: SkyTimeOfDay) => {
    setTod(t);
    islandRef.current?.setTimeOfDay(t);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.5, 8000);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 1200;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.08;
    controlsRef.current = controls;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.18, 0.5, 0.85,
    ));
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(
      1 / (container.clientWidth  * renderer.getPixelRatio()),
      1 / (container.clientHeight * renderer.getPixelRatio()),
    );
    composer.addPass(fxaaPass);
    composerRef.current = composer;

    rebuild(biome, seed, weather, tod);

    // Optional Shadertoy backdrop. Mounted before camera positioning so it
    // is visible from the very first rendered frame.
    if (initialShaderId) {
      const backdrop = new ShaderBackdrop(initialShaderId);
      backdrop.setSize(container.clientWidth, container.clientHeight);
      scene.add(backdrop.mesh);
      backdropRef.current = backdrop;
      // eslint-disable-next-line no-console
      console.log(`[Islands] Shader backdrop active: ${SKY_SHADERS[initialShaderId].label}`);
    }

    camera.position.set(400, 180, 400);
    camera.lookAt(0, 5, 0);
    controls.target.set(0, 5, 0);
    controls.update();

    // Build a third-person follow rig — used when walk-mode is enabled.
    // We use FollowCamera directly (the legacy ThirdPersonCamera wrapper uses
    // CommonJS `require()` which fails in Vite/ESM browser bundles).
    tpCamRef.current = new FollowCamera(camera, {
      distance: 7,
      lookAtHeight: 1.4,
      smoothness: 0.18,
      inputMode: 'right-drag',
    });

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = clockRef.current.getDelta();
      const elapsed = clockRef.current.elapsedTime;

      const player = playerRef.current;
      const island = islandRef.current;
      if (walkModeRef.current && player && tpCamRef.current && island) {
        player.update(dt, tpCamRef.current.yaw);
        const grounded = island.heightAt(player.position.x, player.position.z);
        player.setGroundY(grounded);
        if (player.model) player.model.position.copy(player.position);
        const followTarget = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        tpCamRef.current.update(dt, followTarget);
      } else {
        controls.update();
      }

      island?.update(camera, elapsed, dt);
      backdropRef.current?.update(elapsed);
      island?.weatherPass.setResolution(container.clientWidth, container.clientHeight);
      composer.render();
    };
    animate();

    // ── Tool interaction: mine harvest nodes / shovel terrain ──────────────
    const mineRay = new THREE.Raycaster();
    (mineRay as unknown as { firstHitOnly: boolean }).firstHitOnly = true;

    const applyToolAt = (ev: { clientX: number; clientY: number }) => {
      const island = islandRef.current;
      const cam = cameraRef.current;
      if (!island || !cam) return;
      // Mining works both in orbit and on-foot (walk) mode — harvesting is part
      // of on-foot exploration. The shovel terrain brush is editor-only: editing
      // the heightmap under the character's own feet would drop them through the
      // ground, so it is suppressed while walking.
      if (walkModeRef.current && toolRef.current !== "mine") return;

      if (toolRef.current === "mine") {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1,
        );
        mineRay.setFromCamera(ndc, cam);
        landScatterRef.current?.tryMine(mineRay, 1);
      } else if (toolRef.current === "shovel") {
        const hit = island.picker.pickFromMouse(ev, cam, renderer.domElement);
        if (hit?.point) {
          const soft = brushModeRef.current === "level" || brushModeRef.current === "smooth";
          terrainEditorRef.current?.applyAt(hit.point.x, hit.point.z, {
            mode: brushModeRef.current,
            radius: brushRadiusRef.current,
            strength: soft ? 1.0 : 0.6,
          });
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (toolRef.current === "orbit") return;
      // Allow mining on-foot; the shovel stays orbit-only (see applyToolAt).
      if (walkModeRef.current && toolRef.current !== "mine") return;
      brushingRef.current = true;
      applyToolAt(e);
    };
    const onPointerMove = (e: PointerEvent) => {
      // Mining is per-click; the shovel paints continuously while dragging.
      if (brushingRef.current && toolRef.current === "shovel") applyToolAt(e);
    };
    const onPointerUp = () => { brushingRef.current = false; };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fxaaPass.uniforms['resolution'].value.set(
        1 / (w * renderer.getPixelRatio()),
        1 / (h * renderer.getPixelRatio()),
      );
      backdropRef.current?.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      landScatterRef.current = null;
      terrainEditorRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      // Order matters: dispose the player + follow camera FIRST so any rig
      // meshes / mixers / shadow buffers they own are released before we
      // tear down the renderer & scene. Otherwise their geometries leak.
      try { playerRef.current?.dispose(); } catch (e) { console.warn(e); }
      playerRef.current = null;
      try { tpCamRef.current?.dispose(); } catch (e) { console.warn(e); }
      tpCamRef.current = null;
      controls.dispose();
      islandRef.current?.dispose();
      if (backdropRef.current) {
        scene.remove(backdropRef.current.mesh);
        backdropRef.current.dispose();
        backdropRef.current = null;
      }
      renderer.forceContextLoss();
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    walkModeRef.current = walkMode;
    if (controlsRef.current) controlsRef.current.enabled = !walkMode && toolRef.current === "orbit";
    const scene = sceneRef.current;
    const island = islandRef.current;

    if (walkMode && scene && island) {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
      const player = new CharacterController(scene, {
        modelPath: '/models/characters/meshy_character.glb',
        animationsPath: '/models/characters/meshy_animations.glb',
        stripRootMotion: true,
        scale: 1.0,
        position: island.spawnPoint.clone(),
        enableShadows: true,
        animationMap: {
          idle: ['armature|clip0|baselayer', 'idle', 'breathing', 'stand'],
          walk: ['walking', 'walk'],
          run: ['running', 'run', 'sprint'],
          jump: ['jump_rope', 'jumping_jacks', 'jumping_punch', 'jumping'],
          attack: ['punch_combo_1', 'charged_ground_slam', 'charged_upward_slash'],
        },
      });
      playerRef.current = player;
      if (controlsRef.current) controlsRef.current.target.copy(island.spawnPoint);
    } else if (!walkMode) {
      if (playerRef.current && scene) {
        const old = playerRef.current;
        if (old.model) scene.remove(old.model);
        old.dispose();
        playerRef.current = null;
      }
      if (controlsRef.current) controlsRef.current.target.set(0, 5, 0);
    }
  }, [walkMode]);

  // Sync the active tool / brush mode into refs read by the (mount-once)
  // pointer handlers, and lock orbit controls while a tool is active.
  useEffect(() => {
    toolRef.current = tool;
    brushModeRef.current = brushMode;
    brushRadiusRef.current = brushRadius;
    brushingRef.current = false;
    if (controlsRef.current) controlsRef.current.enabled = !walkMode && tool === "orbit";
  }, [tool, brushMode, brushRadius, walkMode]);

  // Toggle chunk debug — wireframe overlay on every chunk material.
  useEffect(() => {
    if (!islandRef.current) return;
    for (const chunk of islandRef.current.chunks.chunks) {
      const mat = chunk.mesh.material as THREE.Material & { wireframe?: boolean };
      if ('wireframe' in mat) (mat as THREE.MeshStandardMaterial).wireframe = showChunks;
    }
  }, [showChunks]);

  const handleRegenerate = useCallback(() => {
    const next = Math.floor(Math.random() * 65536);
    setSeed(next);
    rebuild(biome, next, weather, tod);
  }, [biome, weather, tod, rebuild]);

  const handleBiomeChange = useCallback((b: IslandBiomePreset) => {
    setBiome(b);
    rebuild(b, seed, weather, tod);
  }, [seed, weather, tod, rebuild]);

  return (
    <div className="relative w-full h-full" data-testid="islands-page">
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2" data-testid="island-controls">
        <button
          onClick={() => setShowControls(!showControls)}
          className="self-end px-3 py-1.5 rounded-lg text-xs font-medium bg-black/60 text-white/90 hover:bg-black/80 backdrop-blur-sm border border-white/10 transition-all"
          data-testid="button-toggle-controls"
        >
          {showControls ? "Hide" : "Show"} Controls
        </button>

        {showControls && (
          <div className="bg-black/65 backdrop-blur-md rounded-xl p-4 border border-white/10 text-white min-w-[260px] space-y-4">
            <div>
              <h3 className="text-sm font-bold text-amber-300 tracking-wide uppercase">Island Generator</h3>
              <p className="text-[10px] text-white/40">Canonical pipeline · chunked + LOD · weather overlay</p>
            </div>

            <ControlGroup label="Biome">
              {(Object.keys(BIOME_LABELS) as IslandBiomePreset[]).map((b) => (
                <PillButton key={b} active={biome === b} onClick={() => handleBiomeChange(b)} testid={`button-biome-${b}`}>
                  {BIOME_LABELS[b]}
                </PillButton>
              ))}
            </ControlGroup>

            <ControlGroup label="Weather">
              {(Object.keys(WEATHER_LABELS) as SkyWeather[]).map((w) => (
                <PillButton key={w} active={weather === w} onClick={() => applyWeather(w)} testid={`button-weather-${w}`}>
                  {WEATHER_LABELS[w]}
                </PillButton>
              ))}
            </ControlGroup>

            <ControlGroup label="Time of Day">
              {(Object.keys(TOD_LABELS) as SkyTimeOfDay[]).map((t) => (
                <PillButton key={t} active={tod === t} onClick={() => applyTod(t)} testid={`button-tod-${t}`}>
                  {TOD_LABELS[t]}
                </PillButton>
              ))}
            </ControlGroup>

            <button
              onClick={handleRegenerate}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold text-sm hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg"
              data-testid="button-regenerate"
            >
              Regenerate Island
            </button>

            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={walkMode}
                onChange={(e) => setWalkMode(e.target.checked)}
                data-testid="checkbox-walk-mode"
              />
              Walk Mode (WASD + Shift run + Space jump)
            </label>

            <ControlGroup label="Tool">
              {(["orbit", "mine", "shovel"] as IslandTool[]).map((tl) => (
                <PillButton
                  key={tl}
                  active={tool === tl}
                  onClick={() => setTool(tl)}
                  testid={`button-tool-${tl}`}
                >
                  {tl === "orbit" ? "Orbit" : tl === "mine" ? "Mine" : "Shovel"}
                </PillButton>
              ))}
            </ControlGroup>

            {tool === "shovel" && (
              <ControlGroup label="Shovel Brush">
                {BRUSH_MODES.map((bm) => (
                  <PillButton
                    key={bm}
                    active={brushMode === bm}
                    onClick={() => setBrushMode(bm)}
                    testid={`button-brush-${bm}`}
                  >
                    {bm.charAt(0).toUpperCase() + bm.slice(1)}
                  </PillButton>
                ))}
              </ControlGroup>
            )}

            {tool === "shovel" && (
              <label className="flex items-center gap-2 text-xs text-white/70">
                <span className="w-20 shrink-0">Brush size</span>
                <input
                  type="range"
                  min={4}
                  max={48}
                  step={1}
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(Number(e.target.value))}
                  className="flex-1 accent-amber-400"
                  data-testid="slider-brush-size"
                />
                <span className="w-8 text-right tabular-nums" data-testid="text-brush-size">{brushRadius}m</span>
              </label>
            )}

            {tool === "mine" && (
              <p className="text-[10px] text-amber-300/70" data-testid="text-mine-hint">
                Click ore / crystal nodes to mine them. They chip, drop loot, then respawn.
              </p>
            )}
            {tool === "shovel" && (
              <p className="text-[10px] text-amber-300/70" data-testid="text-shovel-hint">
                Click-drag on terrain to sculpt. Level/Smooth flatten; Raise/Lower dig.
              </p>
            )}

            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={showChunks}
                onChange={(e) => setShowChunks(e.target.checked)}
                data-testid="checkbox-chunk-debug"
              />
              Show chunk wireframe
            </label>

            <div className="text-[10px] text-white/30 pt-2 border-t border-white/10 space-y-0.5" data-testid="text-debug-counts">
              <div>Seed: {seed}</div>
              {debugCounts && (
                <div>
                  Trees {debugCounts.trees} · Rocks {debugCounts.rocks} · Plants {debugCounts.plants} · Flowers {debugCounts.flowers} · Animals {debugCounts.animals}{"harvestNodes" in debugCounts ? ` · Nodes ${(debugCounts as { harvestNodes: number }).harvestNodes}` : ""}{"birds" in debugCounts ? ` · Birds ${(debugCounts as { birds: number }).birds}` : ""}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white/60 text-xs border border-white/5 flex items-center gap-4">
          <span>Orbit: Left-drag</span>
          <span>Zoom: Scroll</span>
          <span>Pan: Right-drag</span>
        </div>
      </div>

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/70 text-sm">Generating island...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-wider text-white/50">{label}</label>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </div>
  );
}

function PillButton({ active, onClick, children, testid }: {
  active: boolean; onClick: () => void; children: React.ReactNode; testid: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`text-[11px] px-2.5 py-1 rounded-md transition-all border ${
        active
          ? "bg-amber-500/30 border-amber-400/50 text-amber-100"
          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
      }`}
    >{children}</button>
  );
}
