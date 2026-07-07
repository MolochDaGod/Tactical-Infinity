import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import * as YUKA from 'yuka';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ship, Gamepad2, Eye, EyeOff, MousePointer2, Map, Users, Gauge } from 'lucide-react';
import { WaterfallIsleLoader, type WaterfallIsleConfig } from '@/lib/waterfallIsleElements';
import { buildSanctuaryIsle, type SanctuaryIsle } from '@/lib/sanctuaryIsle';
import { SketchbookIslandController, type IslandCharacterState } from '@/lib/SketchbookIslandController';
import { IslandNavMeshV2 } from '@/lib/IslandNavMeshV2';
import { GrassSystem } from '@/lib/GrassSystem';
import IslandEditor, { type IslandEditorConfig, DEFAULT_EDITOR_CONFIG } from '@/components/IslandEditor';
import { IslandBuildingSystem, type BuildingMode, type PlayerResources } from '@/lib/islandBuildingSystem';
import { BuildHammerUI } from '@/components/game/BuildHammerUI';
import { type PlaceableBuildingType } from '@/lib/buildableObjectsRegistry';
import { IslandStarterMission, type MissionResources, RAFT_RECIPE } from '@/lib/islandStarterMission';

// ── NPC patrol agent ─────────────────────────────────────────────────────────
interface NpcAgent {
  vehicle: YUKA.Vehicle;
  mesh: THREE.Group;
  path: THREE.Vector3[];
  pathIndex: number;
  idleTimer: number;
  color: number;
}

interface BeachSpawnSceneProps {
  onExitToWorldMap: () => void;
  onBackToMenu: () => void;
}

type SpawnState = 'loading' | 'ready' | 'exploring';

const STATE_ICONS: Record<IslandCharacterState, string> = {
  idle:        '🧍',
  walk:        '🚶',
  sprint:      '💨',
  jumpIdle:    '⬆️',
  jumpRunning: '🦘',
  falling:     '⬇️',
  dropIdle:    '🦵',
  land:        '💥',
};

export default function BeachSpawnScene({ onExitToWorldMap, onBackToMenu }: BeachSpawnSceneProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef    = useRef<EffectComposer | null>(null);
  const fxaaPassRef    = useRef<FXAAPass | null>(null);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef       = useRef(new THREE.Clock());
  const animationRef   = useRef<number>(0);
  const islandLoaderRef = useRef<WaterfallIsleLoader | null>(null);
  const sanctuaryRef    = useRef<SanctuaryIsle | null>(null);
  const controllerRef  = useRef<SketchbookIslandController | null>(null);
  const navMeshRef     = useRef<IslandNavMeshV2 | null>(null);
  const grassSystemRef = useRef<GrassSystem | null>(null);
  const boatsRef       = useRef<THREE.Group[]>([]);
  const buildingSystemRef = useRef<IslandBuildingSystem | null>(null);
  // AI NPC system
  const yukaManagerRef = useRef<YUKA.EntityManager | null>(null);
  const npcAgentsRef   = useRef<NpcAgent[]>([]);
  const timeScaleRef   = useRef(1.0);
  // Starter mission
  const missionRef     = useRef<IslandStarterMission | null>(null);

  const [spawnState, setSpawnState]   = useState<SpawnState>('loading');
  const [charState, setCharState]     = useState<IslandCharacterState>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [showDebug, setShowDebug]     = useState(false);
  const [debugInfo, setDebugInfo]     = useState('');
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [navMeshReady, setNavMeshReady] = useState(false);
  const [timeScale, setTimeScale]     = useState(1.0);
  const [npcCount, setNpcCount]       = useState(0);
  const [missionRes, setMissionRes]   = useState<MissionResources>({ wood: 0, hemp: 0, stone: 0 });
  const [raftBuilt, setRaftBuilt]     = useState(false);
  const [editorConfig, setEditorConfig] = useState<IslandEditorConfig>(DEFAULT_EDITOR_CONFIG);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [isBuildMode, setIsBuildMode]   = useState(false);
  const [buildingMode, setBuildingMode] = useState<BuildingMode>('none');
  const [selectedBuildingType, setSelectedBuildingType] = useState<PlaceableBuildingType>('wall');
  const [currentBuildLevel, setCurrentBuildLevel] = useState(0);
  const [playerResources, setPlayerResources] = useState<PlayerResources>({
    wood: 200, stone: 100, ore: 50, gold: 100, leather: 30, fiber: 50,
  });

  const spawnStateRef = useRef<SpawnState>('loading');
  useEffect(() => { spawnStateRef.current = spawnState; }, [spawnState]);

  // Track pointer lock for HUD
  useEffect(() => {
    const onPLChange = () => setIsPointerLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onPLChange);
    return () => document.removeEventListener('pointerlockchange', onPLChange);
  }, []);

  // ── Main 3D setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // ── Renderer ──────────────────────────────────────────────────────────────
    // antialias: false — FXAA post-process pass handles AA at lower GPU cost
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled       = true;
    renderer.shadowMap.type          = THREE.PCFSoftShadowMap;
    renderer.toneMapping             = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure     = 1.25;
    renderer.outputColorSpace        = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Yuka entity manager (for Character AI) ────────────────────────────────
    const yukaManager = new YUKA.EntityManager();
    yukaManagerRef.current = yukaManager;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5eafd4);
    scene.fog = new THREE.FogExp2(0x88c8e8, 0.006);
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.1, 600);
    camera.position.set(0, 12, 20);
    cameraRef.current = camera;

    // ── FXAA post-processing (EffectComposer) ─────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const fxaaPass = new FXAAPass();
    fxaaPass.material.uniforms['resolution'].value.set(
      1 / (container.clientWidth  * Math.min(window.devicePixelRatio, 2)),
      1 / (container.clientHeight * Math.min(window.devicePixelRatio, 2))
    );
    composer.addPass(fxaaPass);
    composerRef.current = composer;
    fxaaPassRef.current = fxaaPass;

    // ── Lighting ──────────────────────────────────────────────────────────────
    // Hemisphere IBL (sky + ground)
    const hemi = new THREE.HemisphereLight(0x7ec8f5, 0x4a6030, 0.7);
    scene.add(hemi);

    // Sun — warm afternoon angle
    const sun = new THREE.DirectionalLight(0xffd28a, 2.2);
    sun.position.set(80, 160, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(4096);
    sun.shadow.camera.near  = 1;
    sun.shadow.camera.far   = 400;
    sun.shadow.camera.left  = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top   = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.bias = -0.0003;
    scene.add(sun);

    // Rim light for definition
    const rim = new THREE.DirectionalLight(0xaad4ff, 0.45);
    rim.position.set(-50, 80, -80);
    scene.add(rim);

    // ── Island ────────────────────────────────────────────────────────────────
    // Opt-in single-mesh sanctuary path: append `?sanctuary=v2` to the URL.
    // Defaults to the legacy multi-mesh GLTF WaterfallIsleLoader.
    const useSanctuaryV2 = new URLSearchParams(window.location.search).get('sanctuary') === 'v2';

    const startWithElements = async (elements: { terrainMeshes: THREE.Mesh[]; spawnPosition: THREE.Vector3; islandBounds: THREE.Box3 }) => {
      const spawnPos = elements.spawnPosition.clone();

      // ── Sketchbook-style controller (faithful 0.3 port) ─────────────────────
      const ctrl = new SketchbookIslandController({
        moveSpeed:      4.5,
        jumpForce:      9.0,
        mass:           70,
        capsuleRadius:  0.30,
        capsuleHeight:  0.50,
        velSimMass:     50,
        velSimDamping:  0.8,
        rotSimMass:     10,
        rotSimDamping:  0.5,
        cameraRadius:   5.0,
        cameraSensX:    0.30,
        cameraSensY:    0.25,
        cameraMinPhi:   -30,
        cameraMaxPhi:   70,
        rayCastLength:  0.60,
        raySafeOffset:  0.03,
        modelScale:     0.013,
        spawnY:         spawnPos.y,
      });

      ctrl.onProgress((pct) => setLoadProgress(Math.round(pct * 100)));
      ctrl.onStateChange((s) => setCharState(s));

      ctrl.setTerrainMeshes(elements.terrainMeshes);
      ctrl.setSpawnPosition(spawnPos);

      try {
        await ctrl.load(scene);
        ctrl.setupInput(container);
        controllerRef.current = ctrl;

        setSpawnState('ready');
        setTimeout(() => setSpawnState('exploring'), 500);
      } catch (err) {
        console.error('[BeachSpawnScene] Controller load failed:', err);
        // Even on failure we can explore the island without a character
        setSpawnState('exploring');
      }

      // ── Starter Mission (harvest trees/rocks/hemp → build raft) ──────────────
      try {
        const mission = new IslandStarterMission(scene, elements.islandBounds);
        mission.setPlayerPosition(spawnPos);
        mission.onUpdate((r) => setMissionRes({ ...r }));
        mission.onComplete(() => setRaftBuilt(true));
        mission.setupInput();
        // Give the mission access to the controller for hand-bone tool attachment
        if (controllerRef.current?.isLoaded) mission.setController(controllerRef.current);
        missionRef.current = mission;

        // Make the mission's harvestable trees & rocks solid by registering
        // them as static bodies in the controller's Cannon.js world, and drop
        // each collider the instant its node is harvested out.
        const ctrl2 = controllerRef.current;
        if (ctrl2) {
          for (const spec of mission.getColliderSpecs()) {
            ctrl2.addStaticProp(spec.id, spec.x, spec.z, spec.radius, spec.yBase, spec.height);
          }
          mission.onNodeDepleted((id) => ctrl2.removeStaticProp(id));
        }
        console.log('[BeachSpawnScene] Starter mission initialised');
      } catch (e) {
        console.warn('[BeachSpawnScene] Starter mission init failed:', e);
      }

      // ── Sketchbook 0.3 Grass System ─────────────────────────────────────────
      setTimeout(async () => {
        try {
          const grass = new GrassSystem(scene, {
            bladeCount:   55_000,
            bladeHeight:  0.38,
            bladeWidth:   0.042,
            bladeSegments: 3,
            patchRadius:  52,
            windStrength: 0.13,
            windSpeed:    1.3,
          });
          await grass.generate(elements.terrainMeshes, elements.islandBounds);
          grassSystemRef.current = grass;
          console.log('[BeachSpawnScene] Grass system ready');
        } catch (e) {
          console.warn('[BeachSpawnScene] Grass generation failed:', e);
        }
      }, 600);

      // ── NavMesh V2 (three-pathfinding backed, generated async, non-blocking) ─
      setTimeout(() => {
        try {
          const nav = new IslandNavMeshV2({ resolution: 1.0, minWalkableY: 0.3 });
          nav.generate(elements.terrainMeshes, elements.islandBounds);
          navMeshRef.current = nav;
          setNavMeshReady(true);
          console.log('[BeachSpawnScene] NavMesh V2 ready, pathfinding:', nav.isReady);

          // ── Spawn NPC patrol agents using navmesh ──────────────────────────
          if (nav.isReady) {
            const NPC_COUNT  = 3;
            const NPC_COLORS = [0xe8a020, 0x2090e8, 0xe82060]; // gold, blue, red
            const agents: NpcAgent[] = [];
            const yukaMan = yukaManagerRef.current;

            for (let i = 0; i < NPC_COUNT; i++) {
              const startPt = nav.getRandomWalkable();
              if (!startPt) continue;

              // Yuka vehicle (position only — we drive path manually)
              const vehicle = new YUKA.Vehicle();
              vehicle.position.set(startPt.x, startPt.y, startPt.z);
              vehicle.maxSpeed = 1.8;
              if (yukaMan) yukaMan.add(vehicle);

              // Simple capsule mesh for the NPC
              const npcGroup = new THREE.Group();
              const bodyGeo  = new THREE.CylinderGeometry(0.22, 0.22, 1.0, 8);
              const headGeo  = new THREE.SphereGeometry(0.25, 8, 6);
              const mat      = new THREE.MeshStandardMaterial({ color: NPC_COLORS[i], roughness: 0.7 });
              const body     = new THREE.Mesh(bodyGeo, mat);
              const head     = new THREE.Mesh(headGeo, mat);
              body.castShadow = true;
              head.castShadow = true;
              head.position.y = 0.75;
              npcGroup.add(body, head);
              npcGroup.position.copy(startPt);
              scene.add(npcGroup);

              const agent: NpcAgent = {
                vehicle,
                mesh: npcGroup,
                path: [],
                pathIndex: 0,
                idleTimer: i * 1.5,  // stagger initial movement
                color: NPC_COLORS[i],
              };
              agents.push(agent);
            }

            npcAgentsRef.current = agents;
            setNpcCount(agents.length);
            console.log('[BeachSpawnScene] Spawned', agents.length, 'NPC patrol agents');
          }
        } catch (e) {
          console.warn('[BeachSpawnScene] NavMesh V2 generation failed:', e);
        }
      }, 1000);

      // ── Building system ──────────────────────────────────────────────────────
      const terrainGroundLevel = spawnPos.y - 0.5;
      const bs = new IslandBuildingSystem(scene, camera, {
        gridSize: 2.0, gridExtent: 100, groundLevel: terrainGroundLevel,
      });
      bs.initialize();
      bs.setCallbacks({
        onBuildingPlaced:  (b) => {
          console.log('[Build] Placed:', b);
          // Make placed buildings solid in the Cannon.js world.
          const ctrl3 = controllerRef.current;
          if (ctrl3 && b.mesh) {
            const box = new THREE.Box3().setFromObject(b.mesh);
            if (!box.isEmpty()) {
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());
              const radius = Math.max(size.x, size.z) * 0.5;
              ctrl3.addStaticProp(`building_${b.id}`, center.x, center.z, radius, box.min.y, size.y);
            }
          }
        },
        onBuildingRemoved: (b) => {
          controllerRef.current?.removeStaticProp(`building_${b.id}`);
        },
        onModeChange:      (m) => { setBuildingMode(m); setIsBuildMode(m !== 'none'); },
        onResourcesChanged: (r) => setPlayerResources({ ...r }),
      });
      buildingSystemRef.current = bs;

      // ── Ambient floating boats ───────────────────────────────────────────────
      const boatConfigs = [
        { angle: Math.PI * 0.3,  distance: 38 },
        { angle: Math.PI * 0.85, distance: 50 },
        { angle: Math.PI * 1.4,  distance: 42 },
        { angle: Math.PI * 1.8,  distance: 55 },
      ];
      boatConfigs.forEach(({ angle, distance }) => {
        const boat = createBoat(angle, distance);
        scene.add(boat);
        boatsRef.current.push(boat);
      });

    };  // end startWithElements

    if (useSanctuaryV2) {
      // Single-mesh Sanctuary Isle. Builds heightmap → one mesh → BVH → all
      // node registries in one shot, then synthesizes the elements shape that
      // the existing controller / grass / navmesh / mission pipeline expects.
      try {
        const sanctuary = buildSanctuaryIsle({});
        sanctuaryRef.current = sanctuary;
        scene.add(sanctuary.group);

        const [px, py, pz] = sanctuary.player.primary;
        const elements = {
          terrainMeshes: [sanctuary.terrain.mesh],
          spawnPosition: new THREE.Vector3(px, py + 0.6, pz),
          islandBounds:  new THREE.Box3().setFromObject(sanctuary.terrain.mesh),
        };

        const total = sanctuary.nodes;
        console.log(
          '[BeachSpawnScene] Sanctuary Isle v2 ready — single mesh +',
          'trees:', total.trees.length,
          'plants:', total.plants.length,
          'ores:', total.ores.length,
          'rocks:', total.rocks.length,
          'cliffs:', total.cliffs.length,
          'caves:', total.caves.length,
          'dungeons:', total.dungeons.length,
          'animals:', total.animals.length,
          'landPredators:', total.landPredators.length,
          'waterPredators:', total.waterPredators.length,
          'fish:', total.fish.length,
          'seacoral:', total.seacoral.length,
          'bosses:', total.bosses.length,
          'npcs:', total.npcs.length,
          'allies:', total.allies.length,
          'camps:', total.crusadeCamps.length + total.fabledCamps.length + total.legionCamps.length + total.pirateCamps.length,
          'events:', total.events.length,
          'rewards:', total.rewards.length,
          'treasures:', total.treasures.length,
          'vfx:', total.vfx.length,
          'impacts:', total.impacts.length,
        );

        startWithElements(elements).catch((err: Error) => {
          console.error('[BeachSpawnScene] Sanctuary v2 startup failed:', err);
          setSpawnState('exploring');
        });
      } catch (err) {
        console.error('[BeachSpawnScene] Sanctuary v2 build failed:', err);
        setSpawnState('exploring');
      }
    } else {
      const islandConfig: Partial<WaterfallIsleConfig> = {
        coreIsland:       { enabled: true, scale: 2 },
        surroundingWater: { enabled: true },
        waypoint:         { enabled: true },
        spawnMarker:      { enabled: true },
        realisticTrees:   { enabled: true },
        waterfallDiorama: { enabled: true },
        debris:           { enabled: true },
        signpost:         { enabled: true },
      };
      const islandLoader = new WaterfallIsleLoader(scene, islandConfig);
      islandLoaderRef.current = islandLoader;

      islandLoader.loadAll().then((elements) => {
        console.log('[BeachSpawnScene] Island loaded,', elements.terrainMeshes.length, 'terrain meshes');
        islandLoader.applyNatureUpgrade();
        return startWithElements(elements);
      }).catch((err: Error) => {
        console.error('[BeachSpawnScene] Island load failed:', err);
        setSpawnState('exploring');
      });
    }

    // ── Build-mode keys ────────────────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyB' && !e.repeat) buildingSystemRef.current?.toggleBuildingMode();
      if (e.code === 'BracketRight') setCurrentBuildLevel(p => Math.min(p + 1, 10));
      if (e.code === 'BracketLeft')  setCurrentBuildLevel(p => Math.max(p - 1, 1));
    };
    window.addEventListener('keydown', onKey);

    // ── NPC patrol update helper ───────────────────────────────────────────────
    const NPC_ARRIVE_DIST = 1.2;
    const NPC_IDLE_DUR    = 2.0;  // seconds to wait at each waypoint
    const updateNpcs = (dt: number) => {
      const nav   = navMeshRef.current;
      const agents = npcAgentsRef.current;
      if (!nav || agents.length === 0) return;

      agents.forEach((agent) => {
        // Idle countdown before requesting next path
        if (agent.path.length === 0 || agent.pathIndex >= agent.path.length) {
          agent.idleTimer -= dt;
          if (agent.idleTimer > 0) return;
          // Pick new random destination and pathfind
          const dest = nav.getRandomWalkable();
          if (!dest) return;
          const current = new THREE.Vector3(
            agent.vehicle.position.x,
            agent.vehicle.position.y,
            agent.vehicle.position.z
          );
          const newPath = nav.findPath(current, dest);
          if (newPath && newPath.length > 1) {
            agent.path      = newPath;
            agent.pathIndex = 1;  // index 0 = current pos
          }
          agent.idleTimer = NPC_IDLE_DUR;
          return;
        }

        // Move toward next waypoint
        const target = agent.path[agent.pathIndex];
        const pos    = new THREE.Vector3(
          agent.vehicle.position.x,
          agent.vehicle.position.y,
          agent.vehicle.position.z
        );
        const toTarget = new THREE.Vector3().subVectors(target, pos);
        toTarget.y = 0;  // ignore vertical difference for direction
        const dist = toTarget.length();

        if (dist < NPC_ARRIVE_DIST) {
          agent.pathIndex++;
          return;
        }

        // Step agent position
        const speed = agent.vehicle.maxSpeed * dt;
        const dir   = toTarget.normalize();
        agent.vehicle.position.x += dir.x * speed;
        agent.vehicle.position.z += dir.z * speed;
        // Snap Y to terrain via simple approach: use target waypoint Y
        agent.vehicle.position.y = THREE.MathUtils.lerp(
          agent.vehicle.position.y, target.y, 0.1
        );

        // Sync Three.js mesh
        agent.mesh.position.set(
          agent.vehicle.position.x,
          agent.vehicle.position.y + 0.5,  // half capsule height offset
          agent.vehicle.position.z
        );
        // Face direction of travel
        if (dist > 0.05) {
          const angle = Math.atan2(dir.x, dir.z);
          agent.mesh.rotation.y = THREE.MathUtils.lerp(agent.mesh.rotation.y, angle, 0.15);
        }
      });
    };

    // ── Render loop ────────────────────────────────────────────────────────────
    let frameCount = 0;
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      // Raw dt — clamped inside controller; apply timescale for nature/NPCs here too
      const rawDt  = clockRef.current.getDelta();
      const ts     = timeScaleRef.current;
      const dt     = Math.min(rawDt, 1 / 20) * ts;   // frame-skip + timescale
      const elapsed = clockRef.current.getElapsedTime();
      frameCount++;

      const ctrl = controllerRef.current;
      if (ctrl && ctrl.isLoaded) {
        ctrl.update(rawDt);   // controller has its own timescale applied internally
        ctrl.applyCamera(camera);
      }

      // Update NPC patrol AI
      updateNpcs(dt);

      // Update starter mission (highlight rings, shake, depletion anim, raft bob)
      const mission = missionRef.current;
      if (mission) {
        if (ctrl?.isLoaded) mission.setPlayerPosition(ctrl.position);
        mission.update(dt);
        mission.updateRaft(elapsed);
      }

      // Animate nature (wind + water) — scaled by timescale
      islandLoaderRef.current?.updateNatureAnimations(elapsed * ts);

      // Single-mesh sanctuary path: tick the terrain shader (wind + time uniforms).
      sanctuaryRef.current?.update(dt, elapsed * ts);

      // Tick grass wind animation
      grassSystemRef.current?.update(elapsed * ts);

      // Boat rocking
      boatsRef.current.forEach((b, i) => {
        b.position.y    = Math.sin(elapsed * 0.8 + i * 1.5) * 0.3;
        b.rotation.z    = Math.sin(elapsed * 0.5 + i * 2.0) * 0.05;
        b.rotation.x    = Math.sin(elapsed * 0.4 + i * 1.2) * 0.02;
      });

      // Debug every 15 frames
      if (ctrl && frameCount % 15 === 0) {
        const p = ctrl.position;
        const v = ctrl.velocity;
        setDebugInfo(
          `State:   ${ctrl.state}\n` +
          `Pos:     (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})\n` +
          `Speed:   ${v.length().toFixed(2)} m/s\n` +
          `Theta:   ${ctrl.cameraTheta.toFixed(0)}°  Phi: ${ctrl.cameraPhi.toFixed(0)}°\n` +
          `Ground:  ${ctrl.isGrounded ? '✓' : '✗'}  Grass: ${grassSystemRef.current ? '✓' : '…'}\n` +
          `NavMesh: ${navMeshRef.current ? '✓ ready' : '…generating'}\n` +
          `NPCs:    ${npcAgentsRef.current.length}  TimeScale: ${ts.toFixed(2)}x`
        );
      }

      // FXAA composer render (replaces plain renderer.render)
      composerRef.current ? composerRef.current.render() : renderer.render(scene, camera);
    };
    clockRef.current.start();
    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth, h = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      // Update composer + FXAA resolution uniform
      composerRef.current?.setSize(w, h);
      if (fxaaPassRef.current) {
        fxaaPassRef.current.material.uniforms['resolution'].value.set(
          1 / (w * dpr), 1 / (h * dpr)
        );
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(animationRef.current);
      controllerRef.current?.dispose();
      controllerRef.current = null;
      grassSystemRef.current?.dispose();
      grassSystemRef.current = null;
      islandLoaderRef.current?.dispose();
      islandLoaderRef.current = null;
      if (sanctuaryRef.current) {
        scene.remove(sanctuaryRef.current.group);
        sanctuaryRef.current.dispose();
        sanctuaryRef.current = null;
      }
      buildingSystemRef.current?.dispose();
      buildingSystemRef.current = null;
      // Remove NPC meshes from scene
      npcAgentsRef.current.forEach(a => scene.remove(a.mesh));
      npcAgentsRef.current = [];
      yukaManagerRef.current = null;
      missionRef.current?.dispose();
      missionRef.current = null;
      composerRef.current?.dispose();
      composerRef.current = null;
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []);

  // ── Timescale sync ────────────────────────────────────────────────────────
  // Keep the ref current so the render loop (closed over in useEffect) can read it.
  const handleTimeScaleChange = useCallback((val: number) => {
    timeScaleRef.current = val;
    setTimeScale(val);
    controllerRef.current?.setTimeScale(val);
  }, []);

  // ── Editor change handler ──────────────────────────────────────────────────
  const handleEditorConfigChange = useCallback((changes: Partial<IslandEditorConfig>) => {
    setEditorConfig(prev => ({ ...prev, ...changes }));
    const loader = islandLoaderRef.current;
    if (sceneRef.current && 'fogDensity' in changes && changes.fogDensity !== undefined) {
      const fog = sceneRef.current.fog as THREE.FogExp2;
      if (fog) fog.density = changes.fogDensity * 0.002 + 0.002;
    }
    if (loader) {
      if ('enableDock' in changes)          loader.toggleElement('dock',          changes.enableDock ?? false);
      if ('enableDebris' in changes)        loader.toggleElement('debris',        changes.enableDebris ?? false);
      if ('enablePalmTrees' in changes)     loader.toggleElement('palmTrees',     changes.enablePalmTrees ?? false);
      if ('enableRealisticTrees' in changes) loader.toggleElement('realisticTrees', changes.enableRealisticTrees ?? false);
      if ('enableWaypoint' in changes)      loader.toggleElement('waypoint',      changes.enableWaypoint ?? false);
      if ('enableSpawnMarker' in changes)   loader.toggleElement('spawnMarker',   changes.enableSpawnMarker ?? false);
      if ('enableWaterfall' in changes) {
        loader.toggleElement('waterfallDiorama', changes.enableWaterfall ?? false);
        loader.toggleElement('loopingWaterfalls', changes.enableWaterfall ?? false);
      }
      if ('enableTemple' in changes)       loader.toggleElement('epicTemple',    changes.enableTemple ?? false);
      if ('enablePirateShop' in changes)   loader.toggleElement('pirateShop',    changes.enablePirateShop ?? false);
    }
  }, []);

  const handleToggleBuildMode = useCallback(() => {
    setEditorConfig(prev => ({ ...prev, buildingMode: prev.buildingMode === 'build' ? 'none' : 'build' }));
  }, []);
  const handlePlaceBuilding = useCallback((type: string) => {
    console.log('[IslandEditor] Selected:', type);
  }, []);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full select-none">
      <div ref={containerRef} className="w-full h-full cursor-crosshair" data-testid="beach-spawn-canvas" />

      {/* Loading overlay */}
      {spawnState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 text-center space-y-4">
            <p className="text-3xl font-serif italic text-white/90 animate-pulse"
               style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)', fontFamily: 'Cinzel, serif' }}>
              Arriving at Waterfall Isle…
            </p>
            <div className="w-64 bg-white/20 rounded-full h-2 mx-auto overflow-hidden">
              <div className="h-full bg-amber-400 transition-all duration-200 rounded-full"
                   style={{ width: `${loadProgress}%` }} />
            </div>
            <p className="text-sm text-white/60">
              {loadProgress < 30  ? 'Loading island…'
             : loadProgress < 60  ? 'Loading character model…'
             : loadProgress < 90  ? 'Loading animations…'
             : 'Finalising…'}
            </p>
          </div>
        </div>
      )}

      {/* Welcome banner */}
      {spawnState === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-2xl text-amber-300 font-serif italic animate-pulse"
             style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.95)', fontFamily: 'Cinzel, serif' }}>
            Welcome to Waterfall Isle
          </p>
        </div>
      )}

      {/* Island Editor (right panel, only while exploring) */}
      {spawnState === 'exploring' && (
        <IslandEditor
          config={editorConfig}
          onConfigChange={handleEditorConfigChange}
          onToggleBuildMode={handleToggleBuildMode}
          onPlaceBuilding={handlePlaceBuilding}
          isCollapsed={isEditorCollapsed}
          onToggleCollapse={() => setIsEditorCollapsed(!isEditorCollapsed)}
        />
      )}

      {/* Build Hammer UI */}
      <BuildHammerUI
        isActive={isBuildMode}
        buildingMode={buildingMode}
        selectedType={selectedBuildingType}
        currentLevel={currentBuildLevel}
        playerResources={playerResources}
        onSelectType={(type) => {
          setSelectedBuildingType(type);
          buildingSystemRef.current?.setSelectedBuildingType(type);
        }}
        onToggleMode={() => buildingSystemRef.current?.toggleBuildDeleteMode()}
        onRotate={() => buildingSystemRef.current?.rotatePreview()}
        onChangeLevel={(level) => {
          setCurrentBuildLevel(level);
          buildingSystemRef.current?.changeLevel(level - currentBuildLevel);
        }}
        onClose={() => {
          buildingSystemRef.current?.exitBuildingMode();
          setIsBuildMode(false);
          setBuildingMode('none');
        }}
      />

      {/* Timescale + NPC panel (bottom-left) */}
      {spawnState === 'exploring' && !isBuildMode && (
        <div className="absolute bottom-6 left-4 flex flex-col gap-2">
          {/* Timescale slider */}
          <div className="bg-black/55 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10
                          text-white/90 text-xs font-mono flex items-center gap-3"
               data-testid="timescale-panel">
            <Gauge className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-amber-300 font-bold w-14">
              {timeScale === 1 ? 'Normal' : `${timeScale.toFixed(1)}×`}
            </span>
            <input
              type="range" min="0.1" max="3" step="0.1"
              value={timeScale}
              onChange={e => handleTimeScaleChange(parseFloat(e.target.value))}
              className="w-24 accent-amber-400 cursor-pointer"
              data-testid="input-timescale"
            />
          </div>
          {/* NPC AI badge */}
          {npcCount > 0 && (
            <div className="bg-black/55 backdrop-blur-sm px-4 py-1.5 rounded-xl border border-emerald-500/30
                            text-xs font-mono flex items-center gap-2 pointer-events-none">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">{npcCount} AI Patrols</span>
            </div>
          )}
        </div>
      )}

      {/* Character status bar (bottom centre) */}
      {spawnState === 'exploring' && !isBuildMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3
                        bg-black/55 backdrop-blur-sm px-5 py-2 rounded-2xl border border-white/10
                        text-white/90 text-sm font-mono pointer-events-none">
          <span className="text-xl">{STATE_ICONS[charState]}</span>
          <span className="uppercase tracking-wider text-amber-300 text-xs font-bold w-12">{charState}</span>
          {navMeshReady && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Map className="w-3 h-3" /> Nav
            </span>
          )}
        </div>
      )}

      {/* Pointer-lock hint */}
      {spawnState === 'exploring' && !isPointerLocked && !isBuildMode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none">
          <p className="text-white/50 text-xs flex items-center gap-1.5 animate-pulse">
            <MousePointer2 className="w-3 h-3" /> Click canvas to capture mouse
          </p>
        </div>
      )}

      {/* Controls cheat-sheet (bottom-right, only when pointer locked) */}
      {isPointerLocked && !isBuildMode && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm p-3 rounded-lg
                        text-white/85 text-xs space-y-0.5 pointer-events-none border border-white/10">
          <p className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1.5">
            <Gamepad2 className="w-3.5 h-3.5" /> Controls
          </p>
          <p><span className="text-white/50">WASD</span> — Move</p>
          <p><span className="text-white/50">Shift</span> — Sprint</p>
          <p><span className="text-white/50">Space</span> — Jump</p>
          <p><span className="text-white/50">Mouse</span> — Look around</p>
          <p><span className="text-white/50">B</span> — Build Mode</p>
          <p><span className="text-white/50">Esc</span> — Release mouse</p>
        </div>
      )}

      {/* Top-right HUD: debug / back / set sail */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button variant="outline" size="sm"
          onClick={() => setShowDebug(s => !s)}
          className="bg-black/50 backdrop-blur-sm border-white/30 text-white hover:bg-black/70"
          data-testid="button-toggle-debug">
          {showDebug ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
        <Button variant="outline" size="sm"
          onClick={onBackToMenu}
          className="bg-black/50 backdrop-blur-sm border-white/30 text-white hover:bg-black/70"
          data-testid="button-back-menu">
          <ArrowLeft className="w-4 h-4 mr-1" /> Menu
        </Button>
        {spawnState === 'exploring' && (
          <Button variant="default" size="sm"
            onClick={onExitToWorldMap}
            className="bg-amber-600 hover:bg-amber-700"
            data-testid="button-set-sail">
            <Ship className="w-4 h-4 mr-1" /> Set Sail
          </Button>
        )}
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="absolute top-16 right-4 bg-black/75 backdrop-blur-sm p-3 rounded-lg
                        text-white/90 text-xs font-mono whitespace-pre border border-white/10">
          {debugInfo}
        </div>
      )}

      {/* ── Starter Mission Panel ── */}
      {spawnState === 'exploring' && (
        <div className="absolute top-4 left-4 w-64 bg-black/70 backdrop-blur-sm rounded-xl
                        border border-amber-500/40 overflow-hidden shadow-xl"
             data-testid="mission-panel">
          {/* Header */}
          <div className="bg-amber-700/50 px-4 py-2 flex items-center gap-2">
            <span className="text-amber-300 font-bold text-sm" style={{ fontFamily: 'Cinzel, serif' }}>
              ⚓ Build Your First Boat
            </span>
          </div>

          {/* Resources */}
          <div className="px-4 py-3 space-y-2">
            {/* Wood */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🪵</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-white/80 mb-0.5">
                  <span>Wood</span>
                  <span className={missionRes.wood >= RAFT_RECIPE.wood ? 'text-emerald-400' : 'text-white/60'}>
                    {missionRes.wood}/{RAFT_RECIPE.wood}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-300"
                       style={{ width: `${Math.min(missionRes.wood / RAFT_RECIPE.wood, 1) * 100}%` }} />
                </div>
              </div>
            </div>
            {/* Hemp */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🌿</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-white/80 mb-0.5">
                  <span>Hemp</span>
                  <span className={missionRes.hemp >= RAFT_RECIPE.hemp ? 'text-emerald-400' : 'text-white/60'}>
                    {missionRes.hemp}/{RAFT_RECIPE.hemp}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                       style={{ width: `${Math.min(missionRes.hemp / RAFT_RECIPE.hemp, 1) * 100}%` }} />
                </div>
              </div>
            </div>
            {/* Stone */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🪨</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-white/80 mb-0.5">
                  <span>Stone</span>
                  <span className={missionRes.stone >= RAFT_RECIPE.stone ? 'text-emerald-400' : 'text-white/60'}>
                    {missionRes.stone}/{RAFT_RECIPE.stone}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full transition-all duration-300"
                       style={{ width: `${Math.min(missionRes.stone / RAFT_RECIPE.stone, 1) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Craft button / completion */}
          <div className="px-4 pb-3">
            {raftBuilt ? (
              <div className="text-center text-emerald-400 font-bold text-sm py-1 animate-pulse"
                   data-testid="mission-complete">
                ✓ Raft Built! Head to the dock!
              </div>
            ) : (
              <button
                onClick={() => missionRef.current?.buildRaft()}
                disabled={
                  missionRes.wood  < RAFT_RECIPE.wood ||
                  missionRes.hemp  < RAFT_RECIPE.hemp ||
                  missionRes.stone < RAFT_RECIPE.stone
                }
                className="w-full py-1.5 rounded-lg text-sm font-bold transition-all duration-200
                           disabled:opacity-30 disabled:cursor-not-allowed
                           enabled:bg-amber-600 enabled:hover:bg-amber-500 enabled:text-white
                           disabled:bg-white/10 disabled:text-white/40"
                data-testid="button-craft-raft">
                ⚒ Craft Raft
              </button>
            )}
            {!raftBuilt && (
              <p className="text-white/35 text-[10px] text-center mt-1.5">
                Press <kbd className="text-white/55 bg-white/10 px-1 rounded">E</kbd> near trees, rocks &amp; hemp
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Boat factory ──────────────────────────────────────────────────────────────
function createBoat(angle: number, distance: number): THREE.Group {
  const boat = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2, 0);
  hullShape.lineTo(-1.8, -0.8);
  hullShape.lineTo(1.8, -0.8);
  hullShape.lineTo(2, 0);
  hullShape.lineTo(1.6, 0.1);
  hullShape.lineTo(-1.6, 0.1);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.2, bevelEnabled: false });
  hullGeo.center();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.9 });
  const hull    = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.y = Math.PI / 2;
  hull.castShadow = true;
  boat.add(hull);

  const mastMat  = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.85 });
  const mast     = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8), mastMat);
  mast.position.set(0, 1.6, 0);
  mast.castShadow = true;
  boat.add(mast);

  const sailGeo  = new THREE.PlaneGeometry(1.5, 2.0);
  const sailMat  = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.6, side: THREE.DoubleSide });
  const sail     = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0.8, 2.1, 0);
  sail.rotation.y = 0.18;
  boat.add(sail);

  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mastMat);
  crossbar.position.set(0, 2.9, 0);
  crossbar.rotation.z = Math.PI / 2;
  boat.add(crossbar);

  boat.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
  boat.rotation.y = angle + Math.PI / 2;
  return boat;
}
