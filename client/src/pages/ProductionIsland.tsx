import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import * as YUKA from 'yuka';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Sword, Heart, Shield, Target,
  TreePine, Mountain, Waves, Eye, Crosshair,
  Anchor, Ship
} from 'lucide-react';
import { GameHUD } from '@/components/game/GameHUD';
import type { SlotDef, VitalBarDef } from '@/components/game/GameHUD';
import {
  generateIslandTerrain,
  createWaterPlane,
  updateIslandWater,
  snapToTerrain,
  generateResourceNodePositions,
  getNodeZone,
  selectNodeTypeForZone,
  type TerrainData,
} from '@/lib/islandHeightmapTerrain';
import { IslandNavMeshV2 } from '@/lib/IslandNavMeshV2';
import { YukaAISystem, type AIEnemyConfig, type AIEnemy } from '@/lib/yukaEnemyAI';
import MagicBookUI from '@/components/game/MagicBookUI';
import {
  createGrassSystem,
  createAmbientParticles,
  createShoreSplashes,
  createAtmosphericFog,
  animateTreeSway,
  ColorGradingShader,
  type GrassSystem,
  type ParticleSystem,
  type ShoreSplashSystem,
} from '@/lib/islandVisualEffects';
import type { Race } from '@/data/toonRTSAssets';
import { UnitCharacter } from '@/lib/character/UnitGLBLoader';
import { resolveUnitModel } from '@/lib/character/unitModel';
import { createDock, isPlayerNearDock, type DockData } from '@/lib/islandDockSystem';
import { ResourceNodeManager } from '@/lib/resourceNodes';
import { IslandAnimalManager, ANIMAL_SPAWN_WEIGHTS, type AnimalType } from '@/lib/islandAnimals';
import { HarvestingSystem } from '@/lib/harvestingProfessions';
import { PropColliderSystem } from '@/lib/PropColliderSystem';
import { CinzelOverlay, buildHudOverride, isCinzelHudEnabled } from '@/components/hud/CinzelOverlay';
import {
  preloadIslandAssets,
  loadRandomTree,
  loadRandomFlower,
  loadRandomPlant,
  loadRandomRock,
  createTexturedOreMesh,
  createTexturedRockMesh,
} from '@/lib/islandAssetLoader';

interface Props {
  onBack: () => void;
}

const PLAYER_SPEED = 12;
const PLAYER_RADIUS = 0.5;
const ATTACK_RANGE = 3.5;
const ATTACK_DAMAGE = 18;
const ATTACK_CD = 0.8;
const PLAYER_MAX_HP = 100;

const NODE_VISUALS: Record<string, { color: number; icon: string; scale: number; kind?: string }> = {
  oak_tree:      { color: 0x2d5a1e, icon: '🌳', scale: 3.5, kind: 'tree' },
  pine_tree:     { color: 0x1e4a2a, icon: '🌲', scale: 4.0, kind: 'tree' },
  fiber_plant:   { color: 0x6ca830, icon: '🌿', scale: 1.0, kind: 'plant' },
  healing_herb:  { color: 0x4caf50, icon: '🌱', scale: 0.8, kind: 'plant' },
  mana_flower:   { color: 0x7c4dff, icon: '🌸', scale: 0.9, kind: 'flower' },
  wild_flower:   { color: 0xff6090, icon: '🌺', scale: 0.7, kind: 'flower' },
  sunbloom:      { color: 0xffb300, icon: '🌻', scale: 0.8, kind: 'flower' },
  stone_boulder: { color: 0x757575, icon: '🪨', scale: 2.0, kind: 'rock' },
  granite_rock:  { color: 0x616161, icon: '⛰️', scale: 2.5, kind: 'rock' },
  copper_vein:   { color: 0xcd7f32, icon: '🔶', scale: 1.5, kind: 'ore' },
  iron_vein:     { color: 0x78909c, icon: '⬛', scale: 1.5, kind: 'ore' },
  gold_vein:     { color: 0xffd700, icon: '🟡', scale: 1.5, kind: 'ore' },
  mythril_vein:  { color: 0x64b5f6, icon: '💎', scale: 1.5, kind: 'ore' },
};

// Huntable land fauna spawned on the island (real animated glTF via
// IslandAnimalManager). Killing one drops a carcass that can be skinned for
// leather/hide + skinning XP.
const HUNTABLE_ANIMALS: AnimalType[] = [
  'rabbit', 'deer', 'boar', 'goat', 'fox', 'stag', 'wolf', 'bull', 'lamb',
];
const ANIMAL_ATTACK_RANGE = 4;

export default function ProductionIsland({ onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const animIdRef = useRef<number>(0);

  const terrainRef = useRef<TerrainData | null>(null);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const navRef = useRef<IslandNavMeshV2 | null>(null);
  const aiRef = useRef<YukaAISystem | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const playerPosRef = useRef(new THREE.Vector3(0, 5, 0));
  const playerVelRef = useRef(new THREE.Vector3());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const keysRef = useRef(new Set<string>());
  const targetRef = useRef<AIEnemy | null>(null);
  const attackTimerRef = useRef(0);
  const resourceNodesRef = useRef<THREE.Group[]>([]);
  const propCollidersRef = useRef(new PropColliderSystem());
  const colliderTimerRef = useRef(0);
  const grassRef = useRef<GrassSystem | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const splashRef = useRef<ShoreSplashSystem | null>(null);
  const unitRef = useRef<UnitCharacter | null>(null);
  const dockRef = useRef<DockData | null>(null);
  const carcassManagerRef = useRef<ResourceNodeManager | null>(null);
  const animalManagerRef = useRef<IslandAnimalManager | null>(null);
  const harvestSystemRef = useRef<HarvestingSystem | null>(null);
  const skinTimerRef = useRef(0);

  const [playerHP, setPlayerHP] = useState(PLAYER_MAX_HP);
  const [targetInfo, setTargetInfo] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [killCount, setKillCount] = useState(0);
  const [waveNum, setWaveNum] = useState(1);
  const [nodeCount, setNodeCount] = useState(0);
  const [nearDock, setNearDock] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [leather, setLeather] = useState(0);
  const [hide, setHide] = useState(0);
  const [skinningLevel, setSkinningLevel] = useState(1);
  const [huntToast, setHuntToast] = useState<string | null>(null);
  const huntToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHuntToast = useCallback((msg: string) => {
    setHuntToast(msg);
    if (huntToastTimer.current) clearTimeout(huntToastTimer.current);
    huntToastTimer.current = setTimeout(() => setHuntToast(null), 2200);
  }, []);

  const spawnWave = useCallback((ai: YukaAISystem, terrain: TerrainData, wave: number) => {
    const count = 3 + wave * 2;
    const factions: AIEnemyConfig['faction'][] = ['raider', 'undead', 'beast', 'bandit'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 80;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = terrain.getHeightAt(x, z);
      if (y < 1) continue;
      const cfg: AIEnemyConfig = {
        name: `${factions[i % 4]} ${i + 1}`,
        level: wave + Math.floor(Math.random() * 3),
        position: new THREE.Vector3(x, y, z),
        faction: factions[i % 4],
        aggroRange: 18 + wave * 2,
        attackRange: 2.5,
        attackDamage: 5 + wave * 2,
        attackCooldown: 1.5,
        moveSpeed: 3 + wave * 0.5,
        hp: 30 + wave * 15,
      };
      ai.spawnEnemy(cfg);
    }
  }, []);

  const spawnResourceNodes = useCallback(async (scene: THREE.Scene, terrain: TerrainData) => {
    await preloadIslandAssets();
    const positions = generateResourceNodePositions(terrain, 55, 10);
    const nodes: THREE.Group[] = [];

    const loadPromises = positions.map(async (pos) => {
      const zone = getNodeZone(terrain, pos.x, pos.z);
      const type = selectNodeTypeForZone(zone);
      const vis = NODE_VISUALS[type] || { color: 0x888888, scale: 1, kind: 'plant' };
      const kind = vis.kind || 'plant';

      let model: THREE.Group | null = null;

      try {
        if (kind === 'tree') {
          model = await loadRandomTree(type);
        } else if (kind === 'rock') {
          try {
            model = await loadRandomRock();
          } catch {
            model = createTexturedRockMesh(vis.scale);
          }
        } else if (kind === 'ore') {
          model = createTexturedOreMesh(type, vis.scale);
        } else if (kind === 'flower') {
          model = await loadRandomFlower();
        } else {
          model = await loadRandomPlant();
        }
      } catch {
        model = null;
      }

      const grp = new THREE.Group();
      grp.name = `node_${type}`;
      grp.userData.nodeType = type;
      grp.userData.nodeKind = kind;

      if (model && model.children.length > 0) {
        grp.add(model);
      } else {
        const fallbackGeo = new THREE.DodecahedronGeometry(vis.scale * 0.3, 1);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: vis.color, roughness: 0.8 });
        const fallback = new THREE.Mesh(fallbackGeo, fallbackMat);
        fallback.position.y = vis.scale * 0.3;
        fallback.castShadow = true;
        grp.add(fallback);
      }

      const snapped = snapToTerrain(terrain, pos.x, pos.z);
      grp.position.set(snapped.x, snapped.y, snapped.z);

      grp.rotation.y = Math.random() * Math.PI * 2;
      scene.add(grp);
      nodes.push(grp);
    });

    await Promise.allSettled(loadPromises);
    resourceNodesRef.current = nodes;
    setNodeCount(nodes.length);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) { setWebglError(true); return; }

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0025);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.5, 800);
    camera.position.set(0, 30, 50);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.15, 0.4, 0.9);
    composer.addPass(bloomPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / w, 1 / h);
    composer.addPass(fxaaPass);

    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.minDistance = 10;
    controls.maxDistance = 200;
    controls.target.set(0, 5, 0);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0x99bbdd, 0.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xaaddff, 0x445533, 0.4);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    sunLight.position.set(80, 120, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    const terrain = generateIslandTerrain({ seed: 42, segments: 192, radius: 200 });
    terrainRef.current = terrain;
    terrain.mesh.castShadow = true;
    scene.add(terrain.mesh);

    const water = createWaterPlane(200);
    waterRef.current = water;
    scene.add(water);

    const dock = createDock(terrain, 'south');
    scene.add(dock.group);
    dockRef.current = dock;

    const nav = new IslandNavMeshV2({ resolution: 1.2, maxSlopeRad: 0.7 });
    const bounds = new THREE.Box3().setFromObject(terrain.mesh);
    nav.generate([terrain.mesh], bounds);
    navRef.current = nav;

    const ai = new YukaAISystem(scene);
    aiRef.current = ai;
    spawnWave(ai, terrain, 1);

    const playerGroup = new THREE.Group();
    playerGroup.name = 'player';

    const placeholderGeo = new THREE.CapsuleGeometry(0.35, 1.0, 4, 8);
    const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.6, metalness: 0.15, transparent: true, opacity: 0.5 });
    const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    placeholder.position.y = 0.9;
    placeholder.castShadow = true;
    placeholder.name = 'placeholder';
    playerGroup.add(placeholder);

    const spawnPos = dock.spawnPoint;
    playerGroup.position.copy(spawnPos);
    playerPosRef.current.copy(spawnPos);
    scene.add(playerGroup);
    playerRef.current = playerGroup;

    let captainRace: Race = 'human';
    try {
      const saved = localStorage.getItem('tethical_captain');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.race && resolveUnitModel(data.race as Race)) {
          captainRace = data.race;
        }
      }
    } catch {}

    // Canonical baked-GLB captain: OWN skeleton, weapon baked into the mesh, and
    // its OWN idle clip played directly (no retargeting / external weapon attach).
    const resolved = resolveUnitModel(captainRace);
    if (resolved) {
      UnitCharacter.load(resolved.path, { targetHeight: 1.8, includeBank: false })
        .then((unit) => {
          if (!playerRef.current) { unit.dispose(); return; } // scene torn down
          const ph = playerGroup.getObjectByName('placeholder');
          if (ph) playerGroup.remove(ph);
          playerGroup.add(unit.object);
          unit.playFirstAvailable(['idle', 'stand'], { loop: true });
          unitRef.current = unit;
        })
        .catch((err) => {
          console.warn('Player GLB load failed, keeping placeholder:', err);
        });
    }

    spawnResourceNodes(scene, terrain);

    // ── Huntable & skinnable animals ────────────────────────────────────────
    // ResourceNodeManager owns the carcasses; IslandAnimalManager spawns the
    // real animated glTF fauna, seats them on terrain, and spawns a carcass on
    // death. HarvestingSystem tracks skinning XP/level.
    const carcassManager = new ResourceNodeManager(scene);
    carcassManagerRef.current = carcassManager;
    const harvestSystem = new HarvestingSystem();
    harvestSystemRef.current = harvestSystem;
    setSkinningLevel(harvestSystem.getProfessionLevel('skinning').level);
    const animalManager = new IslandAnimalManager(scene, carcassManager);
    animalManager.setGroundSampler((x, z) => terrain.getHeightAt(x, z));
    animalManagerRef.current = animalManager;
    animalManager.spawnRandomAnimalsOnIsland(
      new THREE.Vector3(0, 0, 0), 120, HUNTABLE_ANIMALS, 16, ANIMAL_SPAWN_WEIGHTS,
    );

    const grass = createGrassSystem(terrain, 15000, 42);
    scene.add(grass.mesh);
    grassRef.current = grass;

    const ambientParticles = createAmbientParticles(500, 123);
    scene.add(ambientParticles.points);
    particlesRef.current = ambientParticles;

    const splashes = createShoreSplashes(terrain, 20);
    scene.add(splashes.group);
    splashRef.current = splashes;

    const fog = createAtmosphericFog(200);
    scene.add(fog);

    const colorGradePass = new ShaderPass(ColorGradingShader);
    composer.addPass(colorGradePass);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'f' && dockRef.current && isPlayerNearDock(playerPosRef.current, dockRef.current, 8)) {
        onBack();
      }
      if (e.key.toLowerCase() === 'b') {
        setBookOpen(prev => !prev);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
    };
    const handleClick = () => {
      if (!cameraRef.current || !terrainRef.current || !aiRef.current) return;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const enemyMeshes = aiRef.current.aliveEnemies.map(e => e.mesh);
      const hits = raycasterRef.current.intersectObjects(enemyMeshes, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.enemyId) obj = obj.parent;
        if (obj) {
          const enemy = aiRef.current.aliveEnemies.find(e => e.id === obj!.userData.enemyId);
          if (enemy) {
            targetRef.current = enemy;
            setTargetInfo({ name: enemy.config.name, hp: enemy.hp, maxHp: enemy.maxHp });
          }
        }
      }
    };
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current || !composerRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      cameraRef.current.aspect = nw / nh;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
      composerRef.current.setSize(nw, nh);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clockRef.current.getDelta(), 0.05);
      const elapsed = clockRef.current.elapsedTime;

      // Throttled rebuild of the prop colliders from the current resource
      // nodes (trees/rocks/ore). Animals wander so they stay walk-through;
      // tiny flowers/plants fall under the minRadius filter.
      colliderTimerRef.current -= dt;
      if (colliderTimerRef.current <= 0) {
        colliderTimerRef.current = 0.4;
        const cols = propCollidersRef.current;
        cols.clear();
        for (const node of resourceNodesRef.current) {
          if (node.userData.isAnimal) continue;
          const kind = node.userData.nodeKind;
          if (kind === 'flower' || kind === 'plant') continue;
          cols.addFromObject3D(node.uuid, node, { tightness: 0.6, minRadius: 0.3, maxRadius: 2.5 });
        }
      }

      if (waterRef.current) updateIslandWater(waterRef.current, elapsed);
      if (grassRef.current) grassRef.current.update(elapsed);
      if (particlesRef.current) particlesRef.current.update(elapsed);
      if (splashRef.current) splashRef.current.update(elapsed, dt);
      if (unitRef.current) unitRef.current.update(dt);
      animateTreeSway(resourceNodesRef.current, elapsed);

      // Huntable animals: wander/flee/aggro + baked idle clips, seated on terrain.
      if (animalManagerRef.current) {
        animalManagerRef.current.update(dt, playerPosRef.current);
      }

      const keys = keysRef.current;
      const moveDir = new THREE.Vector3();
      if (keys.has('w') || keys.has('arrowup'))    moveDir.z -= 1;
      if (keys.has('s') || keys.has('arrowdown'))  moveDir.z += 1;
      if (keys.has('a') || keys.has('arrowleft'))  moveDir.x -= 1;
      if (keys.has('d') || keys.has('arrowright')) moveDir.x += 1;

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        camForward.normalize();
        const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), camForward).normalize();
        const worldDir = new THREE.Vector3()
          .addScaledVector(camRight, -moveDir.x)
          .addScaledVector(camForward, -moveDir.z)
          .normalize();

        playerPosRef.current.addScaledVector(worldDir, PLAYER_SPEED * dt);
        if (playerRef.current) {
          playerRef.current.lookAt(
            playerPosRef.current.x + worldDir.x,
            playerPosRef.current.y,
            playerPosRef.current.z + worldDir.z
          );
        }
      }

      // Push the player out of any solid prop (trees/rocks/ore) before the
      // terrain-follow snap so they can't walk through models.
      if (propCollidersRef.current.count > 0) {
        propCollidersRef.current.resolve(playerPosRef.current, PLAYER_RADIUS);
      }

      if (terrainRef.current) {
        const onDock = dockRef.current && isPlayerNearDock(playerPosRef.current, dockRef.current, 5);
        const snapped = snapToTerrain(terrainRef.current, playerPosRef.current.x, playerPosRef.current.z);
        if (onDock) {
          const dockSurface = dockRef.current!.spawnPoint.y;
          const smoothFactor = 1 - Math.exp(-8 * dt);
          playerPosRef.current.y += (dockSurface - playerPosRef.current.y) * smoothFactor;
        } else if (snapped.isOnTerrain && snapped.y > 0.2) {
          const smoothFactor = 1 - Math.exp(-8 * dt);
          playerPosRef.current.y += (snapped.y - playerPosRef.current.y) * smoothFactor;
        }
      }

      if (playerRef.current) {
        playerRef.current.position.copy(playerPosRef.current);
      }

      if (dockRef.current) {
        const near = isPlayerNearDock(playerPosRef.current, dockRef.current, 8);
        setNearDock(near);
      }

      const camSmooth = 1 - Math.exp(-4 * dt);
      controls.target.lerp(playerPosRef.current.clone().add(new THREE.Vector3(0, 3, 0)), camSmooth);
      controls.update();

      if (aiRef.current) {
        aiRef.current.update(dt, playerPosRef.current);

        const enemySmooth = 1 - Math.exp(-6 * dt);
        aiRef.current.aliveEnemies.forEach(enemy => {
          if (terrainRef.current) {
            const ep = enemy.entity.position;
            const ey = terrainRef.current.getHeightAt(ep.x, ep.z);
            if (ey > 0.2) ep.y += (ey - ep.y) * enemySmooth;
          }
          if (enemy.state === 'attack') {
            const dx = playerPosRef.current.x - enemy.entity.position.x;
            const dz = playerPosRef.current.z - enemy.entity.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < enemy.config.attackRange * 1.5) {
              if (enemy.attackTimer <= 0) {
                setPlayerHP(prev => Math.max(0, prev - enemy.config.attackDamage));
                enemy.attackTimer = enemy.config.attackCooldown;
              }
            }
          }
        });

        if (targetRef.current) {
          if (!targetRef.current.alive) {
            targetRef.current = null;
            setTargetInfo(null);
          } else {
            setTargetInfo({ name: targetRef.current.config.name, hp: targetRef.current.hp, maxHp: targetRef.current.maxHp });
          }
        }

        attackTimerRef.current = Math.max(0, attackTimerRef.current - dt);
        if ((keys.has(' ') || keys.has('1')) && attackTimerRef.current <= 0 && targetRef.current?.alive) {
          const tPos = targetRef.current.entity.position;
          const dx = tPos.x - playerPosRef.current.x;
          const dz = tPos.z - playerPosRef.current.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < ATTACK_RANGE) {
            aiRef.current.damageEnemy(targetRef.current, ATTACK_DAMAGE);
            attackTimerRef.current = ATTACK_CD;
            if (!targetRef.current.alive) {
              setKillCount(prev => prev + 1);
              targetRef.current = null;
              setTargetInfo(null);
            }
          }
        }

        if (aiRef.current.aliveCount === 0) {
          setWaveNum(prev => {
            const next = prev + 1;
            setTimeout(() => spawnWave(aiRef.current!, terrainRef.current!, next), 2000);
            return next;
          });
        }
      }

      // ── Hunting: attack nearest live animal with Space/1 ──────────────────
      if (animalManagerRef.current && (keys.has(' ') || keys.has('1')) && attackTimerRef.current <= 0) {
        const animal = animalManagerRef.current.getAnimalAtPosition(playerPosRef.current, ANIMAL_ATTACK_RANGE);
        if (animal && animal.state !== 'dead') {
          const killed = animalManagerRef.current.damageAnimal(animal.id, ATTACK_DAMAGE, playerPosRef.current);
          attackTimerRef.current = ATTACK_CD;
          if (killed) {
            setKillCount(prev => prev + 1);
            showHuntToast(`${animal.template.name} down — press E to skin`);
          }
        }
      }

      // ── Skinning: press E near a carcass ──────────────────────────────────
      skinTimerRef.current = Math.max(0, skinTimerRef.current - dt);
      if (keys.has('e') && skinTimerRef.current <= 0 && carcassManagerRef.current && harvestSystemRef.current) {
        const nodes = carcassManagerRef.current.getAllNodes();
        let nearest: (typeof nodes)[number] | null = null;
        let nearestDist = Infinity;
        for (const node of nodes) {
          if (!node.isActive || node.profession !== 'skinning') continue;
          const d = playerPosRef.current.distanceTo(node.position);
          if (d < 4 && d < nearestDist) { nearest = node; nearestDist = d; }
        }
        if (nearest) {
          skinTimerRef.current = 0.6;
          const yield_ = nearest.yieldMin + Math.floor(Math.random() * (nearest.yieldMax - nearest.yieldMin + 1));
          const isLeather = nearest.type === 'leather';
          if (isLeather) setLeather(prev => prev + yield_); else setHide(prev => prev + yield_);
          const leveledUp = harvestSystemRef.current.addXp('skinning', nearest.xpReward);
          if (leveledUp) setSkinningLevel(harvestSystemRef.current.getProfessionLevel('skinning').level);
          showHuntToast(`+${yield_} ${isLeather ? 'leather' : 'hide'}${leveledUp ? ' · Skinning up!' : ''}`);
          carcassManagerRef.current.removeNode(nearest.id);
        }
      }

      composerRef.current?.render();
    };
    animate();

    return () => {
      cancelAnimationFrame(animIdRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.forceContextLoss();
      renderer.dispose();
      composer.dispose();
      grassRef.current?.dispose();
      particlesRef.current?.dispose();
      splashRef.current?.dispose();
      unitRef.current?.dispose();
      unitRef.current = null;
      animalManagerRef.current?.clearAllAnimals();
      animalManagerRef.current = null;
      carcassManagerRef.current?.clearAllNodes();
      carcassManagerRef.current = null;
      harvestSystemRef.current = null;
      if (huntToastTimer.current) clearTimeout(huntToastTimer.current);
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <Mountain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">WebGL Not Available</h2>
          <p className="text-muted-foreground mb-4">Please use a modern browser with WebGL support.</p>
          <Button onClick={onBack} variant="outline" data-testid="button-back-webgl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </div>
      </div>
    );
  }

  const hpPct = (playerHP / PLAYER_MAX_HP) * 100;

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden" data-testid="production-island">
      <div ref={containerRef} className="w-full h-full" data-testid="island-viewport" />

      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
          onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-sm flex items-center gap-3">
          <span className="flex items-center gap-1"><Sword className="w-3.5 h-3.5 text-red-400" /> {killCount}</span>
          <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-amber-400" /> Wave {waveNum}</span>
          <span className="flex items-center gap-1"><TreePine className="w-3.5 h-3.5 text-green-400" /> {nodeCount}</span>
          <span className="flex items-center gap-1" data-testid="text-leather" title="Leather">🟫 {leather}</span>
          <span className="flex items-center gap-1" data-testid="text-hide" title="Hide">🟤 {hide}</span>
          <span className="flex items-center gap-1 text-amber-300" data-testid="text-skinning-level" title="Skinning level">Skin Lv {skinningLevel}</span>
        </div>
      </div>

      {huntToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none" data-testid="hunt-toast">
          <div className="bg-black/70 backdrop-blur-md rounded-lg px-4 py-2 border border-amber-500/30 text-amber-200 text-sm font-medium">
            {huntToast}
          </div>
        </div>
      )}

      {targetInfo && (
        <div className="absolute bottom-[120px] left-1/2 -translate-x-1/2 z-10 w-[320px] max-w-[90vw]">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 w-full" data-testid="target-frame">
            <div className="flex items-center justify-between text-xs text-white mb-1">
              <span className="flex items-center gap-1"><Crosshair className="w-3 h-3 text-red-400" /> {targetInfo.name}</span>
              <span>{targetInfo.hp}/{targetInfo.maxHp}</span>
            </div>
            <Progress value={(targetInfo.hp / targetInfo.maxHp) * 100} className="h-2 bg-red-950" />
          </div>
        </div>
      )}

      {/* Legacy GameHUD only renders with the dev escape hatch ?legacyhud=1 — */}
      {/* otherwise the Cinzel overlay below is the single character HUD.    */}
      {!isCinzelHudEnabled() && (
        <GameHUD
          mode="combat"
          slots={[
            { id: "attack", label: "Attack", iconUrl: "/ui/magic_book/icons/Icon1_big.png", hotkey: "1" },
            { id: "block",  label: "Block",  iconUrl: "/ui/magic_book/icons/Icon6_big.png", hotkey: "2" },
            { id: "heal",   label: "Heal",   iconUrl: "/ui/magic_book/icons/Icon15_big.png", hotkey: "3" },
            { id: "range",  label: "Range",  iconUrl: "/ui/magic_book/icons/Icon7_big.png", hotkey: "4" },
            { id: "dash",   label: "Dash",   iconUrl: "/ui/magic_book/icons/Icon17_big.png", hotkey: "5" },
          ]}
          vitals={[
            { id: "hp", label: "HP", current: playerHP, max: PLAYER_MAX_HP, color: hpPct < 30 ? "#ef4444" : "#22c55e", icon: "heart" },
          ]}
          hint="WASD move · Click target · Space attack · Tab next · B grimoire"
        />
      )}

      {nearDock && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none" data-testid="dock-prompt">
          <div className="bg-black/70 backdrop-blur-md rounded-xl px-6 py-4 border border-amber-500/40 shadow-lg shadow-amber-500/10 text-center animate-pulse">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Anchor className="w-5 h-5 text-amber-400" />
              <span className="text-amber-300 font-bold text-lg tracking-wide">Dock</span>
            </div>
            <div className="text-white/90 text-sm mb-2">Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-amber-300 font-mono font-bold">F</kbd> to set sail</div>
            <div className="flex items-center justify-center gap-1 text-white/50 text-xs">
              <Ship className="w-3 h-3" />
              <span>Return to the open seas</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10 flex items-start gap-2">
        <button
          data-testid="button-open-book"
          onClick={() => setBookOpen(true)}
          className="w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg border border-amber-500/30 flex items-center justify-center transition-colors group"
          title="Open Grimoire (B)"
        >
          <img src="/ui/magic_book/Open_book.png" alt="Book"
            className="w-7 h-7 object-cover group-hover:scale-110 transition-transform"
            style={{
              imageRendering: "pixelated",
              objectPosition: "0% 0%",
            }}
            draggable={false}
          />
        </button>
      </div>

      <MagicBookUI
        isOpen={bookOpen}
        onClose={() => setBookOpen(false)}
        playerClass="warrior"
        playerRace="human"
        playerName="Captain"
        playerLevel={5}
      />

      {isCinzelHudEnabled() && (
        <CinzelOverlay
          state={buildHudOverride({
            hp: { current: playerHP, max: PLAYER_MAX_HP },
            fallback: { name: 'Captain', race: 'human', className: 'Warrior', level: 5 },
          })}
        />
      )}
    </div>
  );
}
