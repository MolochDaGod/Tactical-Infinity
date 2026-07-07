import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { IslandCombatManager, type Enemy } from '@/lib/islandCombat';
import { generateIslandTerrain, type TerrainData } from '@/lib/islandHeightmapTerrain';
import { createToonOceanPlane, updateToonWater } from '@/lib/toonWaterShader';
import { buildBattleBloodFX, type BattleBloodFX } from '@/lib/bloodEffects';
import { buildTerrainBVH, type TerrainBVH } from '@/lib/terrainBVH';
import { createArenaScatter, type ArenaScatter } from '@/lib/instancedScatter';
import { ChestDropSystem, type ChestReward } from '@/lib/chestDropSystem';
import { ChestInteractionUI } from '@/components/ChestInteractionUI';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shield, Heart, Zap, ArrowLeft, Trophy, Skull, ChevronRight } from 'lucide-react';
import { GameHUD } from '@/components/game/GameHUD';
import { Button } from '@/components/ui/button';

interface BattleGroundsProps {
  onBack?: () => void;
}

interface KillFeedEntry {
  id: number;
  text: string;
  timestamp: number;
}

interface DmgIndicator {
  id: number;
  angle: number;
  expiry: number;
}

type GamePhase = 'loading' | 'intro' | 'fighting' | 'wave_clear' | 'victory' | 'defeat';

const WAVES = [
  { count: 3,  enemyHpMult: 1.0, enemyDmgMult: 1.0, label: 'Scout Party' },
  { count: 5,  enemyHpMult: 1.1, enemyDmgMult: 1.1, label: 'Raider Squad' },
  { count: 6,  enemyHpMult: 1.3, enemyDmgMult: 1.25, label: 'Warband' },
  { count: 8,  enemyHpMult: 1.5, enemyDmgMult: 1.4, label: 'Warband Elite' },
  { count: 10, enemyHpMult: 1.8, enemyDmgMult: 1.6, label: 'BOSS WAVE — Warlord Assault' },
];

// ── Toon RTS asset paths ──────────────────────────────────────────────────────
const TOON_BASE = '/toon_rts/Toon_RTS';
const WK_CHAR_FBX   = `${TOON_BASE}/WesternKingdoms/models/WK_Characters_customizable.FBX`;
const WK_SWORD_FBX  = `${TOON_BASE}/WesternKingdoms/models/extra models/equipment/WK_weapon_sword_A.FBX`;

// ── SimpleToonPlayer ─────────────────────────────────────────────────────────
// Self-contained capsule controller with Toon RTS character visual loaded async.
// Exposes the same interface used by the BattleGrounds game loop.

class SimpleToonPlayer {
  readonly isLoaded = true;               // always ready — capsule is instant
  position: THREE.Vector3;
  state = 'idle';

  private group: THREE.Group;            // capsule placeholder (shown immediately)
  private toonGroup: THREE.Group | null = null;  // FBX visual (async)
  private capsuleVis: THREE.Group;       // the actual capsule meshes
  private mixer: THREE.AnimationMixer | null = null;
  private anims: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimKey = '';

  private keys = new Set<string>();
  private yaw = Math.PI;
  private pitch = 0.45;
  private cameraTarget = new THREE.Vector3();
  private cameraPos    = new THREE.Vector3(0, 6, 10);
  private readonly CAM_DIST = 7;
  private readonly CAM_HEIGHT = 2.6;

  private attackTimer = 0;
  private cleanupFns: Array<() => void> = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, startPos = new THREE.Vector3(0, 2, 0)) {
    this.scene = scene;

    this.group = new THREE.Group();
    this.group.position.copy(startPos);
    this.position = this.group.position;

    // ── Capsule placeholder (human warrior look) ──────────────────────────
    this.capsuleVis = new THREE.Group();

    const mat  = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const skin = mat(0xC8956A);   // skin tone
    const cloth= mat(0x5A3E2B);   // tunic
    const metal= mat(0xB0B0B0);
    const gold = mat(0xD4AA30);

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.65, 6, 12), cloth);
    torso.position.y = 1.05; torso.castShadow = true;
    this.capsuleVis.add(torso);

    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), skin);
    head.position.y = 1.75; head.castShadow = true;
    this.capsuleVis.add(head);

    // legs
    [-0.14, 0.14].forEach((x, i) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.52, 4, 8), mat(i === 0 ? 0x4A3525 : 0x4A3525));
      leg.position.set(x, 0.45, 0); leg.castShadow = true;
      this.capsuleVis.add(leg);
    });

    // pauldrons
    [-0.38, 0.38].forEach(x => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), metal);
      p.position.set(x, 1.22, 0); p.scale.set(1, 0.55, 0.85);
      this.capsuleVis.add(p);
    });

    // sword
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.04), metal);
    blade.position.set(0.42, 1.15, 0.1); blade.rotation.z = -0.15;
    blade.castShadow = true;
    this.capsuleVis.add(blade);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.07), gold);
    guard.position.set(0.42, 0.75, 0.1); guard.rotation.z = -0.15;
    this.capsuleVis.add(guard);

    this.group.add(this.capsuleVis);
    scene.add(this.group);

    // load Toon RTS FBX async
    this.loadToonVisual();
  }

  private async loadToonVisual() {
    try {
      const loader = new FBXLoader();
      const fbx = await new Promise<THREE.Group>((res, rej) =>
        loader.load(WK_CHAR_FBX, res, undefined, rej)
      );

      fbx.scale.setScalar(0.012);
      fbx.traverse(c => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          if (Array.isArray(m.material)) {
            m.material = m.material.map(mat => new THREE.MeshStandardMaterial({
              color: (mat as THREE.MeshStandardMaterial).color ?? 0x8B7355,
              roughness: 0.72, metalness: 0.1,
            }));
          } else {
            m.material = new THREE.MeshStandardMaterial({
              color: (m.material as THREE.MeshStandardMaterial).color ?? 0x8B7355,
              roughness: 0.72, metalness: 0.1,
            });
          }
        }
      });

      this.toonGroup = fbx;
      this.toonGroup.position.copy(this.position);
      this.toonGroup.rotation.y = this.group.rotation.y;
      this.scene.add(this.toonGroup);

      // Try to load sword and attach
      try {
        const swordFbx = await new Promise<THREE.Group>((res, rej) =>
          (new FBXLoader()).load(WK_SWORD_FBX, res, undefined, rej)
        );
        swordFbx.scale.setScalar(0.012);
        // Attach to right-hand bone
        let attached = false;
        this.toonGroup.traverse(child => {
          if (!attached && child.name.toLowerCase().includes('hand_r')) {
            child.add(swordFbx);
            attached = true;
          }
        });
        if (!attached) this.toonGroup.add(swordFbx); // fallback: just add to group
      } catch (_) { /* no sword — fine */ }

      this.capsuleVis.visible = false;

      // Set up animation mixer
      if (fbx.animations?.length > 0) {
        this.mixer = new THREE.AnimationMixer(fbx);
        fbx.animations.forEach(clip => {
          const action = this.mixer!.clipAction(clip);
          this.anims.set(clip.name.toLowerCase(), action);
        });
        this.playAnim('idle');
      }

      console.log('[BattleGrounds] Toon RTS captain loaded ✓');
    } catch (err) {
      console.warn('[BattleGrounds] Toon RTS FBX load failed — capsule used', err);
    }
  }

  private playAnim(keyword: string) {
    const key = Array.from(this.anims.keys()).find(k => k.includes(keyword));
    if (!key || key === this.currentAnimKey) return;

    const prev = this.anims.get(this.currentAnimKey);
    if (prev) prev.fadeOut(0.2);
    const next = this.anims.get(key)!;
    next.reset().fadeIn(0.2).play();
    this.currentAnimKey = key;
  }

  setupInput(container: HTMLElement) {
    const onDown = (e: KeyboardEvent) => { this.keys.add(e.code); e.preventDefault(); };
    const onUp   = (e: KeyboardEvent) => this.keys.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === container) {
        this.yaw   -= e.movementX * 0.0025;
        this.pitch  = Math.max(0.08, Math.min(0.72, this.pitch + e.movementY * 0.002));
      }
    };
    window.addEventListener('mousemove', onMove);

    const onClick = () => {
      if (document.pointerLockElement === container) {
        this.attackTimer = 0.45;
        this.state = 'attack';
        this.playAnim('attack');
      } else {
        container.requestPointerLock();
      }
    };
    container.addEventListener('click', onClick);

    this.cleanupFns = [
      () => window.removeEventListener('keydown', onDown),
      () => window.removeEventListener('keyup', onUp),
      () => window.removeEventListener('mousemove', onMove),
      () => container.removeEventListener('click', onClick),
    ];
  }

  update(dt: number, _camera: THREE.Camera, terrain?: TerrainData) {
    // Attack timer
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && this.state === 'attack') {
        this.state = 'idle';
        this.playAnim('idle');
      }
    }

    if (document.pointerLockElement) {
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const speed  = sprint ? 10.5 : 6.5;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);

      let dx = 0, dz = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    { dx -= sin; dz -= cos; }
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  { dx += sin; dz += cos; }
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  { dx -= cos; dz += sin; }
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) { dx += cos; dz -= sin; }

      const moving = Math.abs(dx) + Math.abs(dz) > 0.05;
      if (moving) {
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len; dz /= len;
        this.position.x += dx * speed * dt;
        this.position.z += dz * speed * dt;
        if (this.state !== 'attack') {
          this.state = sprint ? 'sprint' : 'run';
          this.playAnim('run');
        }
        const faceY = Math.atan2(dx, dz) + Math.PI;
        this.group.rotation.y = faceY;
        if (this.toonGroup) this.toonGroup.rotation.y = faceY;
      } else if (this.state === 'run' || this.state === 'sprint') {
        this.state = 'idle';
        this.playAnim('idle');
      }
    }

    // Terrain height follow
    if (terrain) {
      const gy = terrain.getHeightAt(this.position.x, this.position.z);
      this.position.y = gy;
    }

    // Island boundary clamp
    const R = 40;
    const d = Math.sqrt(this.position.x ** 2 + this.position.z ** 2);
    if (d > R) { this.position.x *= R / d; this.position.z *= R / d; }

    this.group.position.copy(this.position);
    if (this.toonGroup) this.toonGroup.position.copy(this.position);

    if (this.mixer) this.mixer.update(dt);
  }

  applyCamera(camera: THREE.PerspectiveCamera) {
    const { CAM_DIST, CAM_HEIGHT } = this;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const cosP = Math.cos(this.pitch * 0.7);
    const sinP = Math.sin(this.pitch * 0.7);

    const tx = this.position.x + sin * CAM_DIST * cosP;
    const ty = this.position.y + CAM_HEIGHT + sinP * CAM_DIST * 0.6;
    const tz = this.position.z + cos * CAM_DIST * cosP;

    this.cameraPos.lerp(new THREE.Vector3(tx, ty, tz), 0.1);
    camera.position.copy(this.cameraPos);

    this.cameraTarget.lerp(
      this.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0.12
    );
    camera.lookAt(this.cameraTarget);
  }

  dispose() {
    this.cleanupFns.forEach(f => f());
    if (this.toonGroup) this.scene.remove(this.toonGroup);
    this.scene.remove(this.group);
    document.exitPointerLock?.();
  }
}

// ── Island arena builder ──────────────────────────────────────────────────────

function buildIslandArena(scene: THREE.Scene): {
  terrain: TerrainData;
  terrainBVH: TerrainBVH;
  scatter: ArenaScatter;
  waterMesh: THREE.Mesh;
  torchFlames: THREE.Mesh[];
} {
  // Procedural heightmap island — gentle hills, battle-suitable
  const seed = Math.floor(Math.random() * 99999);
  const terrain = generateIslandTerrain({
    radius:              50,
    segments:            80,
    maxHeight:           8,
    noiseScale:          0.028,
    octaves:             5,
    persistence:         0.42,
    lacunarity:          2.0,
    seed,
    beachWidth:          10,
    waterLevel:          0,
    ridgeStrength:       0.25,
    domainWarpStrength:  0.3,
    terraceCount:        3,
    terraceStrength:     0.2,
  });
  terrain.mesh.receiveShadow = true;
  scene.add(terrain.mesh);

  // Build BVH for fast accurate terrain raycasting
  const terrainBVH = buildTerrainBVH(terrain);

  // Toon ocean
  const waterMesh = createToonOceanPlane(350, 80, {
    islandRadius: 48,
    foamWidth:    10,
    waveAmp:      0.22,
    waveSpeed:    0.9,
    toonBands:    3,
    colorDeep:    0x052540,
    colorMid:     0x0a5070,
    colorShallow: 0x1a8aa0,
    colorFoam:    0xd8f0f5,
    colorCrest:   0xffffff,
  });
  waterMesh.position.y = -0.8;
  scene.add(waterMesh);

  // Atmospheric torches around the arena (use BVH for accurate ground snapping)
  const torchFlames: THREE.Mesh[] = [];
  const torchRing = [
    [22, 0, 22], [-22, 0, 22], [22, 0, -22], [-22, 0, -22],
    [35, 0, 0],  [-35, 0, 0],  [0, 0, 35],   [0, 0, -35],
  ];
  torchRing.forEach(([x, , z]) => {
    const groundY = terrainBVH.getHeightAt(x, z);
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 0.9 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, groundY + 1.25, z);
    pole.castShadow = true;
    scene.add(pole);

    const light = new THREE.PointLight(0xff6622, 1.8, 20);
    light.position.set(x, groundY + 2.8, z);
    scene.add(light);

    const flameGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.copy(light.position);
    flame.name = 'flame';
    scene.add(flame);
    torchFlames.push(flame);
  });

  // GPU-instanced scatter: rocks, trees, palms, boulders — single draw call each
  const scatter = createArenaScatter(scene, terrain, terrainBVH, seed);

  return { terrain, terrainBVH, scatter, waterMesh, torchFlames };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BattleGrounds({ onBack }: BattleGroundsProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const playerRef     = useRef<SimpleToonPlayer | null>(null);
  const combatRef     = useRef<IslandCombatManager | null>(null);
  const rendererRef   = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef      = useRef<THREE.Scene | null>(null);
  const cameraRef     = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef  = useRef<number>(0);
  const clockRef      = useRef(new THREE.Clock());
  const terrainRef    = useRef<TerrainData | null>(null);
  const terrainBVHRef = useRef<TerrainBVH | null>(null);
  const scatterRef    = useRef<ArenaScatter | null>(null);
  const waterRef      = useRef<THREE.Mesh | null>(null);
  const bloodFXRef    = useRef<BattleBloodFX | null>(null);
  const chestRef      = useRef<ChestDropSystem | null>(null);

  const [chestReward, setChestReward]     = useState<ChestReward | null>(null);
  const [canOpenChest, setCanOpenChest]   = useState(false);

  const gameStateRef = useRef({
    wave: 0,
    kills: 0,
    totalKills: 0,
    enemiesAlive: 0,
    phase: 'loading' as GamePhase,
    waveClearTimer: 0,
    introTimer: 0,
    playerHP: 150,
    playerMaxHP: 150,
    playerStamina: 100,
    playerMaxStamina: 100,
    comboCount: 0,
    comboTimer: 0,
    score: 0,
    lastDmgAngle: 0,
    dmgFlashTimer: 0,
    waveTimer: 0,
  });

  const [gamePhase, setGamePhase]         = useState<GamePhase>('loading');
  const [waveNum, setWaveNum]             = useState(1);
  const [waveLabel, setWaveLabel]         = useState('');
  const [kills, setKills]                 = useState(0);
  const [enemiesAlive, setEnemiesAlive]   = useState(0);
  const [playerHP, setPlayerHP]           = useState(150);
  const [playerMaxHP]                     = useState(150);
  const [playerStamina, setPlayerStamina] = useState(100);
  const [comboCount, setComboCount]       = useState(0);
  const [score, setScore]                 = useState(0);
  const [killFeed, setKillFeed]           = useState<KillFeedEntry[]>([]);
  const [dmgIndicators, setDmgIndicators] = useState<DmgIndicator[]>([]);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const nextDmgId  = useRef(0);
  const nextKillId = useRef(0);

  const addKillFeed = useCallback((text: string) => {
    const entry: KillFeedEntry = { id: nextKillId.current++, text, timestamp: Date.now() };
    setKillFeed(prev => [entry, ...prev].slice(0, 5));
  }, []);

  // ── Setup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2535);
    scene.fog = new THREE.FogExp2(0x1a2535, 0.0025);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 500);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Build post-processing blood FX (created after renderer + camera)
    // We defer until after scene/terrain are built so it picks up all meshes.
    // bloodFXRef is assigned below after scene setup.

    // Lighting
    scene.add(new THREE.AmbientLight(0x4a6080, 0.8));
    const sun = new THREE.DirectionalLight(0xffd090, 2.0);
    sun.position.set(60, 120, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 300;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
    sun.shadow.camera.right = sun.shadow.camera.top = 80;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const fillLight = new THREE.DirectionalLight(0x4466ff, 0.3);
    fillLight.position.set(-40, 30, -60);
    scene.add(fillLight);

    // Build island arena (terrain + BVH + instanced scatter + water + torches)
    const { terrain, terrainBVH, scatter, waterMesh, torchFlames } = buildIslandArena(scene);
    terrainRef.current    = terrain;
    terrainBVHRef.current = terrainBVH;
    scatterRef.current    = scatter;
    waterRef.current      = waterMesh;

    // ── Player ────────────────────────────────────────────────────────────
    // Use BVH for accurate spawn height on the actual triangle surface
    const startY = terrainBVH.getHeightAt(0, 0);
    const player = new SimpleToonPlayer(scene, new THREE.Vector3(0, startY, 0));
    playerRef.current = player;
    player.setupInput(container);

    // Immediately transition to intro
    gameStateRef.current.phase = 'intro';
    gameStateRef.current.introTimer = 2.0;
    setGamePhase('intro');
    setGamePhase('loading'); // show loading briefly while combat assets load

    // ── Blood FX (post-processing) ────────────────────────────────────────
    const bloodFX = buildBattleBloodFX(renderer, scene, camera);
    bloodFXRef.current = bloodFX;

    // ── Combat manager ────────────────────────────────────────────────────
    const combat = new IslandCombatManager(scene);
    combatRef.current = combat;

    // ── Chest drop system ─────────────────────────────────────────────────
    const chestSystem = new ChestDropSystem(scene);
    chestRef.current  = chestSystem;
    combat.setChestSystem(chestSystem);
    chestSystem.setOnOpen((reward) => {
      setChestReward(reward);
    });

    // E-key chest interaction
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) {
        const pl = playerRef.current;
        if (pl && chestRef.current) {
          chestRef.current.tryOpenNearby(pl.position);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Load enemy assets (success or fallback — combat always starts)
    combat.loadEnemyAssets().then(() => {
      gameStateRef.current.phase = 'intro';
      gameStateRef.current.introTimer = 1.5;
      setGamePhase('intro');
    }).catch(() => {
      gameStateRef.current.phase = 'intro';
      gameStateRef.current.introTimer = 1.5;
      setGamePhase('intro');
    });

    // Pointer lock listener
    const onLockChange = () => setIsPointerLocked(document.pointerLockElement === container);
    document.addEventListener('pointerlockchange', onLockChange);

    // Resize
    const onResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      bloodFXRef.current?.composer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Game loop ──────────────────────────────────────────────────────────
    const elapsed = { t: 0 };
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clockRef.current.getDelta(), 0.05);
      elapsed.t += dt;
      const gs = gameStateRef.current;

      // Animate torch flames
      const t = performance.now() * 0.003;
      torchFlames.forEach(f => {
        f.position.y += Math.sin(t * 7 + f.position.x) * 0.002;
        f.scale.setScalar(0.9 + Math.sin(t * 11 + f.position.z) * 0.15);
      });

      // Animate toon water
      if (waterRef.current) updateToonWater(waterRef.current, elapsed.t);

      const pl = playerRef.current;
      const cam = cameraRef.current;

      if (pl && cam) {
        pl.update(dt, cam, terrainRef.current ?? undefined);
        pl.applyCamera(cam as THREE.PerspectiveCamera);

        if (combatRef.current && gs.phase === 'fighting') {
          const playerPos = pl.position;
          combatRef.current.update(dt, playerPos);

          // Player attack hit detection
          const ctrlState = pl.state;
          if (ctrlState.startsWith('attack')) {
            const hit = combatRef.current.checkPlayerAttack(playerPos, 2.5);
            if (hit) {
              const dmg = 25 + gs.comboCount * 5;
              const killed = combatRef.current.damageEnemy(hit.id, dmg);
              const isBoss = gs.wave % 5 === 0;
              if (killed) {
                gs.kills++;
                gs.totalKills++;
                gs.score += 100 * gs.wave;
                gs.comboCount = Math.min(gs.comboCount + 1, 8);
                gs.comboTimer = 2.5;
                const wd = WAVES[Math.min(gs.wave - 1, WAVES.length - 1)];
                addKillFeed(`${wd?.label?.includes('BOSS') ? '💀 BOSS ' : '⚔ '}Slain! +${100 * gs.wave}`);
                setKills(gs.kills);
                setScore(gs.score);
                setComboCount(gs.comboCount);
                // Blood burst at enemy position
                bloodFXRef.current?.onEnemyKill(hit.position.clone().add(new THREE.Vector3(0, 0.8, 0)), isBoss);
              } else {
                // Hit but not killed — smaller blood spatter
                bloodFXRef.current?.particles.spawnBlood(hit.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 6);
              }
            }
          }

          // Combo decay
          if (gs.comboTimer > 0) {
            gs.comboTimer -= dt;
            if (gs.comboTimer <= 0) { gs.comboCount = 0; setComboCount(0); }
          }

          // Enemy damage to player
          const dmgResult = combatRef.current.checkEnemyAttack(pl.position, 1.8);
          if (dmgResult && gs.dmgFlashTimer <= 0) {
            const actualDmg = Math.max(0, dmgResult.damage - 5);
            gs.playerHP = Math.max(0, gs.playerHP - actualDmg);
            gs.dmgFlashTimer = 0.4;
            setPlayerHP(gs.playerHP);
            // Blood flash and shake
            bloodFXRef.current?.onPlayerDamage(actualDmg / gs.playerMaxHP);

            const enemyPos = dmgResult.position;
            const playerFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
            const toEnemy = new THREE.Vector3(enemyPos.x - pl.position.x, 0, enemyPos.z - pl.position.z).normalize();
            const dot = playerFwd.dot(toEnemy);
            const cross = playerFwd.cross(toEnemy).y;
            const angle = Math.atan2(cross, dot) * (180 / Math.PI);
            setDmgIndicators(prev => [
              ...prev.filter(d => d.expiry > Date.now()),
              { id: nextDmgId.current++, angle, expiry: Date.now() + 800 }
            ]);

            if (gs.playerHP <= 0) { gs.phase = 'defeat'; setGamePhase('defeat'); }
          }
          if (gs.dmgFlashTimer > 0) gs.dmgFlashTimer -= dt;

          // Stamina regen
          gs.playerStamina = Math.min(gs.playerMaxStamina, gs.playerStamina + 8 * dt);
          setPlayerStamina(Math.round(gs.playerStamina));

          // Enemy count
          const alive = combatRef.current.getAliveCount();
          if (alive !== gs.enemiesAlive) { gs.enemiesAlive = alive; setEnemiesAlive(alive); }

          // Wave clear
          if (alive === 0 && gs.phase === 'fighting') {
            if (gs.wave >= WAVES.length) {
              gs.phase = 'victory'; setGamePhase('victory');
            } else {
              gs.phase = 'wave_clear';
              gs.waveClearTimer = 3.5;
              setGamePhase('wave_clear');
            }
          }
        }

        if (gs.phase === 'wave_clear') {
          gs.waveClearTimer -= dt;
          if (gs.waveClearTimer <= 0) startWave(gs.wave + 1);
        }

        if (gs.phase === 'intro') {
          gs.introTimer -= dt;
          if (gs.introTimer <= 0) startWave(1);
        }
      }

      // Update chest drop system (proximity detection + animations)
      if (pl && chestRef.current) {
        chestRef.current.update(dt, pl.position, elapsed.t);
        const nearby = chestRef.current.getNearbyCandidates(pl.position);
        const hasNearby = nearby.length > 0;
        setCanOpenChest(prev => prev !== hasNearby ? hasNearby : prev);
      }

      // Update blood post-processing effects
      const hpFrac = gs.playerHP / gs.playerMaxHP;
      if (cam) bloodFXRef.current?.update(dt, cam, hpFrac);

      // Render through post-processing composer
      if (bloodFXRef.current) {
        bloodFXRef.current.composer.render(dt);
      } else {
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      playerRef.current?.dispose();
      bloodFXRef.current?.dispose();
      bloodFXRef.current = null;
      chestRef.current?.removeAll();
      chestRef.current = null;
      terrainBVHRef.current?.dispose();
      terrainBVHRef.current = null;
      scatterRef.current?.dispose();
      scatterRef.current = null;
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startWave(waveNumber: number) {
    const gs = gameStateRef.current;
    const combat = combatRef.current;
    const terrain = terrainRef.current;
    if (!combat) return;

    const waveIdx = Math.min(waveNumber - 1, WAVES.length - 1);
    const waveData = WAVES[waveIdx];
    gs.wave = waveNumber;
    gs.kills = 0;
    gs.phase = 'fighting';

    const count = waveData.count + (waveNumber > WAVES.length ? waveNumber - WAVES.length : 0);
    combat.despawnAll?.();

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 18 + Math.random() * 22;
      const ex = Math.cos(angle) * radius;
      const ez = Math.sin(angle) * radius;
      const ey = terrain ? terrain.getHeightAt(ex, ez) : 0;
      const pos = new THREE.Vector3(ex, ey, ez);

      const enemy = combat.spawnEnemy(pos);
      if (enemy) {
        enemy.stats.maxHealth  = Math.round(100 * waveData.enemyHpMult);
        enemy.stats.health     = enemy.stats.maxHealth;
        enemy.stats.attackDamage = Math.round(15 * waveData.enemyDmgMult);
        if (waveNumber % 5 === 0 && i === 0) {
          enemy.mesh.scale.setScalar(1.45);
          enemy.stats.maxHealth  = 500;
          enemy.stats.health     = 500;
          enemy.stats.attackDamage = 40;
          enemy.aggroRadius = 30;
        }
      }
    }

    setWaveNum(waveNumber);
    setWaveLabel(waveData.label);
    setGamePhase('fighting');
    setKills(0);
    setEnemiesAlive(count);
    gs.enemiesAlive = count;
    addKillFeed(`⚡ Wave ${waveNumber}: ${waveData.label}`);
  }

  const hpPct   = (playerHP / playerMaxHP) * 100;
  const stPct   = (playerStamina / 100) * 100;
  const hpColor = hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D canvas */}
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

      {/* Pointer lock hint */}
      {!isPointerLocked && gamePhase === 'fighting' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white/60 text-sm px-6 py-3 rounded-lg backdrop-blur">
            Click to lock cursor · WASD move · Shift sprint · LMB attack · E open chest
          </div>
        </div>
      )}

      {/* ── Chest interaction overlay ──────────────────────────────────── */}
      <ChestInteractionUI
        canInteract={canOpenChest && !chestReward && gamePhase === 'fighting'}
        openReward={chestReward}
        onRewardClaimed={() => setChestReward(null)}
        interactKey="E"
      />

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gamePhase === 'loading' && (
          <motion.div
            initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50"
          >
            <Swords className="w-16 h-16 text-amber-500 animate-pulse" />
            <h1 className="font-serif text-4xl text-white">Generating Island…</h1>
            <div className="flex gap-2 mt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-amber-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-white/40 text-sm">Raising terrain · Toon water · Spawning captain</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Intro flash ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gamePhase === 'intro' && (
          <motion.div
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 2.0 }}
            className="absolute inset-0 bg-black pointer-events-none z-40"
          />
        )}
      </AnimatePresence>

      {/* ── Fighting HUD ────────────────────────────────────────────────── */}
      {(gamePhase === 'fighting' || gamePhase === 'wave_clear') && (
        <>
          {/* Top center — wave info */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
            <div className="bg-black/60 backdrop-blur rounded-lg px-6 py-2">
              <div className="text-amber-400 font-serif text-lg font-bold">Wave {waveNum} / {WAVES.length}</div>
              <div className="text-white/50 text-xs tracking-widest">{waveLabel}</div>
              <div className="text-red-400 text-sm mt-0.5">
                {enemiesAlive > 0 ? `${enemiesAlive} enemies remaining` : 'Wave cleared!'}
              </div>
            </div>
          </div>

          {/* Top right — score */}
          <div className="absolute top-4 right-4 z-10 pointer-events-none text-right">
            <div className="bg-black/60 backdrop-blur rounded-lg px-4 py-2">
              <div className="text-amber-300 font-serif text-xl font-bold" data-testid="text-score">{score.toLocaleString()}</div>
              <div className="text-white/50 text-xs"><Trophy className="w-3 h-3 inline mr-1" />{kills} kills</div>
            </div>
          </div>

          {/* Bottom — vitals */}
          <AnimatePresence>
            {comboCount > 1 && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute bottom-[130px] left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none"
              >
                <span className="text-amber-300 font-serif text-2xl font-bold">{comboCount}× COMBO</span>
                <Swords className="w-4 h-4 inline ml-1 text-amber-400" />
              </motion.div>
            )}
          </AnimatePresence>

          <GameHUD
            mode="combat"
            slots={[
              { id: "attack", label: "Attack", icon: "⚔", hotkey: "LMB" },
              { id: "heavy",  label: "Heavy",  icon: "💥", hotkey: "RMB" },
              { id: "block",  label: "Block",  icon: "🛡", hotkey: "Q" },
              { id: "dodge",  label: "Dodge",  icon: "💨", hotkey: "Shift" },
            ]}
            vitals={[
              { id: "hp", label: "HP", current: playerHP, max: playerMaxHP, color: hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#eab308" : "#ef4444", icon: "heart" },
              { id: "stamina", label: "Stamina", current: playerStamina, max: 100, color: "#eab308", icon: "zap" },
            ]}
            hint="Click to aim · WASD move · Shift sprint · LMB attack"
          />

          {/* Kill feed */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none space-y-1">
            <AnimatePresence>
              {killFeed.map(entry => (
                <motion.div key={entry.id}
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                  className="bg-black/60 backdrop-blur rounded px-3 py-1 text-sm text-white/80"
                >
                  {entry.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Directional damage indicators */}
          {dmgIndicators.filter(d => d.expiry > Date.now()).map(ind => (
            <div key={ind.id} className="absolute w-16 h-16 pointer-events-none z-20"
              style={{ top: '50%', left: '50%',
                transform: `translate(-50%,-50%) rotate(${ind.angle}deg) translateY(-100px)` }}>
              <div className="w-full h-full border-t-4 border-red-500/70 rounded-sm animate-ping" />
            </div>
          ))}
        </>
      )}

      {/* ── Wave Clear Banner ────────────────────────────────────────────── */}
      <AnimatePresence>
        {gamePhase === 'wave_clear' && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div className="text-center">
              <div className="text-amber-400 font-serif text-5xl font-bold drop-shadow-lg">WAVE CLEAR!</div>
              <div className="text-white/60 text-xl mt-2">Next wave incoming…</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Victory ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gamePhase === 'victory' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 gap-6"
          >
            <Trophy className="w-20 h-20 text-amber-400" />
            <h1 className="font-serif text-5xl text-amber-400 font-bold">VICTORY</h1>
            <p className="text-white/70 text-xl">All {WAVES.length} waves defeated</p>
            <div className="bg-white/10 rounded-xl p-6 text-center space-y-2 min-w-[240px]">
              <div className="text-amber-300 font-serif text-3xl font-bold">{score.toLocaleString()}</div>
              <div className="text-white/50 text-sm">Final Score</div>
              <div className="text-white/60 text-sm mt-2">Total Kills: {kills}</div>
            </div>
            <Button onClick={onBack} className="bg-amber-600 hover:bg-amber-500 text-white font-serif text-lg px-8 py-3"
              data-testid="button-back-victory">
              <ArrowLeft className="w-5 h-5 mr-2" />Return to Menu
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Defeat ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gamePhase === 'defeat' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center z-50 gap-6"
          >
            <Skull className="w-20 h-20 text-red-400" />
            <h1 className="font-serif text-5xl text-red-400 font-bold">FALLEN</h1>
            <p className="text-white/60 text-xl">Overwhelmed on Wave {waveNum}</p>
            <div className="bg-white/10 rounded-xl p-6 text-center space-y-2 min-w-[240px]">
              <div className="text-red-300 font-serif text-3xl font-bold">{score.toLocaleString()}</div>
              <div className="text-white/50 text-sm">Score</div>
              <div className="text-white/60 text-sm mt-2">Enemies Slain: {kills}</div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => {
                  gameStateRef.current.playerHP = 150;
                  gameStateRef.current.score = 0;
                  gameStateRef.current.kills = 0;
                  setScore(0); setKills(0); setPlayerHP(150);
                  startWave(1);
                }}
                className="bg-red-700 hover:bg-red-600 text-white font-serif px-6"
                data-testid="button-retry"
              >
                <ChevronRight className="w-4 h-4 mr-1" />Try Again
              </Button>
              <Button onClick={onBack} variant="outline"
                className="border-white/20 text-white/70 hover:bg-white/10 font-serif"
                data-testid="button-back-defeat">
                <ArrowLeft className="w-4 h-4 mr-1" />Menu
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button */}
      {(gamePhase === 'loading' || gamePhase === 'fighting') && (
        <button onClick={onBack}
          className="absolute top-4 left-4 z-20 text-white/30 hover:text-white/70 text-sm flex items-center gap-1 transition-colors"
          data-testid="button-back-battlegrounds">
          <ArrowLeft className="w-4 h-4" />Exit
        </button>
      )}
    </div>
  );
}
