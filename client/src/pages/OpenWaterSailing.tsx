import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { DynamicOcean, createOceanGeometry, createOceanMaterial } from '@/lib/oceanShader';
import { ShipPhysics, calculateWaveHeightAt, getWeatherSeverityLevel } from '@/lib/shipPhysics';
import { SHIP_MODEL_PATHS, applyShipTextures } from '@/lib/shipPrefabs';
import { SHIP_TYPES, calculatePolarSpeed, CANNON_SKILLS, SHIP_CANNON_CONFIGS, getEligibleMounts } from '@shared/gameDefinitions/sailing';
import type { CannonSkillId, CannonMount } from '@shared/gameDefinitions/sailing';
import type { WeatherConfig } from '@/lib/weatherSystem';
import { globalWeather } from '@/lib/weatherSystem';
import { SkySystem, CelestialRenderer } from '@/lib/skySystem';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BoatBoardingSystem, type BoardingMode } from '@/lib/BoatBoardingSystem';
import { Minimap, type MinimapMarker } from '@/components/game/Minimap';
import { IslandGenerator, type IslandConfig } from '@/lib/islandGenerator';
import { createIslandDefenses, type IslandDefenseSystem, type DefenseHitResult } from '@/lib/islandDefenseSystem';
import { CannonballEffects } from '@/lib/cannonballEffects';
import { GameHUD } from '@/components/game/GameHUD';
import type { SlotDef } from '@/components/game/GameHUD';
import { CinzelOverlay, buildHudOverride, isCinzelHudEnabled } from '@/components/hud/CinzelOverlay';
import { loadCaptainBuild, CLASS_LABELS, resolvePlayerBoatId } from '@/lib/captainBuild';
import { getBoat } from '@shared/gameDefinitions/boatRegistry';
import type { Race } from '@/components/hud/CinzelOverlay/types';
import { WindCompass } from '@/components/game/WindCompass';
import { shipAudio } from '@/lib/shipAudio';
import '@/styles/sailingFx.css';
import { SailingScenics } from '@/lib/sailingScenics';
import { makeMoisturePass } from '@/lib/moisturePass';
import { ShipDeckRig } from '@/lib/shipDeckPhysics';
import { SeaCreaturesScatter } from '@/lib/seaCreaturesScatter';

interface OpenWaterSailingProps {
  onBack: () => void;
  onLandOnIsland?: () => void;
}

type AmmoType = CannonSkillId;
type GamePhase = 'sailing' | 'dead' | 'victory';

let _projIdCounter = 0;
function nextProjId(): string { return `proj_${++_projIdCounter}`; }

interface AmmoConfig {
  name: string;
  speed: number;
  damage: number;
  ttl: number;
  color: number;
  count: number;
  spread: number;
  description: string;
  key: string;
}

const AMMO_TYPES: Record<string, AmmoConfig> = Object.fromEntries(
  Object.entries(CANNON_SKILLS).map(([k, s]) => [k, {
    name: s.name, speed: s.speed, damage: s.damage, ttl: s.ttl,
    color: s.color, count: s.count, spread: s.spread,
    description: s.description, key: s.key,
  }])
);

interface Ability {
  name: string;
  cooldown: number;
  maxCooldown: number;
  key: string;
  description: string;
  icon: string;
}

interface SailingState {
  speed: number;
  heading: number;
  windAngle: number;
  windSpeed: number;
  playerHealth: number;
  playerMaxHealth: number;
  position: { x: number; z: number };
  sailAngle: number;
  portCooldown: number;
  starboardCooldown: number;
  currentAmmo: AmmoType;
  kills: number;
  waveNumber: number;
  gamePhase: GamePhase;
  abilities: { repair: number; fullsail: number; broadside: number; sniperShot: number };
  fullSailActive: boolean;
  enemies: { id: number; health: number; maxHealth: number; dist: number }[];
  aimMode: boolean;
  aimTarget: { dist: number; bearing: number; side: 'port' | 'starboard'; hp: number; maxHp: number } | null;
  eligibleMounts: CannonMount[];
  mountCooldowns: Record<string, number>;
  currentShipId: string;
  steeringAngle: number;
  nearIslandName: string | null;
  autoFireEnabled: boolean;
  sniperScopeActive: boolean;
  sniperScopeRange: number;
}

interface EnemyShip {
  id: number;
  mesh: THREE.Object3D;
  physics: ShipPhysics;
  position: THREE.Vector3;
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
  shipType: string;
  clothSail?: ClothSail;
  allClothSails?: ClothSail[];
  fireCooldown: number;
  burning: number;
  slowed: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  ttl: number;
  owner: 'player' | 'enemy';
  damage: number;
  ammoType: AmmoType;
}

const OCEAN_SIZE = 2000;
const OCEAN_SEGMENTS = 256;
const MAX_SPEED = 20;
const TURN_RATE = 0.8;
const ACCELERATION = 3;
const DECELERATION = 1.2;
const WIND_PUSH_FACTOR = 0.6;
const BUOYANCY_OFFSET = 1.5;
const PORT_COOLDOWN_MAX = 2.5;
const STARBOARD_COOLDOWN_MAX = 2.5;
const CANNON_RANGE = 80;
const PLAYER_MAX_HEALTH = 200;
const ENEMY_FIRE_RATE_BASE = 6.0;
const BURN_DAMAGE_PER_SEC = 5;
const SLOW_FACTOR = 0.4;
const FULL_SAIL_MULTIPLIER = 2.0;
const FULL_SAIL_DURATION = 8.0;
const WAVE_ESCALATION = 0.3;

let _enemyIdCounter = 0;

// Shared cached canvas-cloth texture for the cloth sail shader
let _sharedSailTexturePromise: Promise<THREE.Texture | null> | null = null;
function loadSharedSailTexture(): Promise<THREE.Texture | null> {
  if (_sharedSailTexturePromise) return _sharedSailTexturePromise;
  _sharedSailTexturePromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/ship/canvas_sail_cloth_fabric_texture.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  });
  return _sharedSailTexturePromise;
}

const CLOTH_SAIL_VERTEX = `
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uWindDirection;
  uniform float uSailTrim;
  uniform float uWindFill;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vBillow;

  void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;

    vec3 pos = position;

    // UV shape factors
    float heightFactor = uv.y;                        // 0=top(pinned gaff), 1=bottom(boom)
    float widthFactor  = sin(uv.x * 3.14159);         // 0 at edges, 1 at centre - natural belly
    float freeLeech    = uv.x;                         // 0=luff(mast), 1=leech(trailing edge)
    float catShape     = sin(uv.y * 3.14159);          // catenary: max belly at mid-height

    // Wind fill: how much the sail is aerodynamically pressured
    float fill   = uWindFill * uSailTrim;
    float speed  = uWindStrength;

    // Primary billow - belly of sail presses out along +Z (into wind)
    float billow = fill * speed * 0.055 * widthFactor * (0.5 + 0.5 * catShape);

    // Catenary droop: deeper belly at mid-height with full wind
    float catenary = fill * speed * 0.018 * widthFactor * catShape;

    // Leech flutter (trailing edge flaps in strong wind or when eased)
    float leechMask = freeLeech * freeLeech * (0.3 + (1.0 - uSailTrim) * 0.7);
    float flutter1 = sin(uTime * 3.7  + uv.y * 5.2 + uv.x * 2.1) * leechMask * speed * 0.009;
    float flutter2 = sin(uTime * 6.1  + uv.y * 9.0 - uv.x * 3.3) * leechMask * speed * 0.006;
    float flutter3 = sin(uTime * 10.3 + uv.y * 14.0)               * leechMask * speed * 0.004;

    // Luff flutter (leading edge flaps when under-trimmed or pinching into wind)
    float luffMask  = max(0.0, 1.0 - uSailTrim * 1.3 - fill * 0.6) * (1.0 - uv.x);
    float luff      = luffMask * sin(uTime * 11.0 + uv.y * 16.0) * speed * 0.007;

    // Gravity sag: sail hangs down more when slack
    float sag = heightFactor * heightFactor * 0.07 * (1.2 - uSailTrim * 0.8);

    // Apply all displacements
    pos.z += billow + catenary + flutter1 * 0.5;
    pos.x += flutter1 + flutter2 + flutter3 + luff;
    pos.y -= sag;

    vBillow = billow + catenary;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CLOTH_SAIL_FRAGMENT = `
  uniform vec3 uSailColor;
  uniform float uTime;
  uniform float uWindStrength;
  uniform sampler2D uSailTexture;
  uniform float uHasTexture;
  uniform vec2  uTextureRepeat;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vBillow;

  void main() {
    vec3 norm = normalize(vNormal);

    // ---- Diffuse + half-Lambert + subtle SSS for translucent canvas ----
    vec3 lightDir = normalize(vec3(0.45, 0.85, 0.28));
    float ndl = dot(norm, lightDir);
    float diff = max(ndl, 0.0) * 0.85 + 0.25;
    float backLight = max(-ndl, 0.0) * 0.22;       // sun shining THROUGH thin canvas
    float wrapLight = (ndl * 0.5 + 0.5);            // soft wrap shading
    diff = mix(diff, wrapLight, 0.35);

    // ---- Sample real canvas-cloth texture if provided ----
    vec3 fabricCol = vec3(1.0);
    float fabricLum = 1.0;
    if (uHasTexture > 0.5) {
      vec3 tex = texture2D(uSailTexture, vUv * uTextureRepeat).rgb;
      fabricLum = mix(0.85, 1.05, dot(tex, vec3(0.299, 0.587, 0.114)));
      fabricCol = mix(vec3(1.0), tex, 0.55); // subtle tint from texture, base stays sail color
    }

    // ---- Procedural weave (also used as detail when no texture) ----
    float freqH = 22.0;
    float freqV = 30.0;
    float tw = 0.018;
    float hThread = smoothstep(0.0, tw, fract(vUv.x * freqH))
                  * smoothstep(0.0, tw, 1.0 - fract(vUv.x * freqH));
    float vThread = smoothstep(0.0, tw, fract(vUv.y * freqV))
                  * smoothstep(0.0, tw, 1.0 - fract(vUv.y * freqV));
    float proceduralWeave = mix(0.88, 1.0, hThread * vThread);
    float overUnder = 1.0 + 0.025 * sin(vUv.x * freqH * 3.14159) * sin(vUv.y * freqV * 3.14159);
    // When we have a real texture, only use very subtle procedural weave on top
    float weave = mix(proceduralWeave * overUnder, fabricLum, uHasTexture);

    // ---- Horizontal panel seams (sail is sewn from horizontal strips) ----
    float seamW = 0.006;
    float s1 = 1.0 - smoothstep(seamW * 0.3, seamW, abs(vUv.y - 0.25)) * 0.25;
    float s2 = 1.0 - smoothstep(seamW * 0.3, seamW, abs(vUv.y - 0.50)) * 0.25;
    float s3 = 1.0 - smoothstep(seamW * 0.3, seamW, abs(vUv.y - 0.75)) * 0.25;
    float seams = s1 * s2 * s3;

    // ---- Bolt rope: dark reinforcing rope sewn around all 4 edges ----
    float boltW = 0.022;
    float boltEdge = 1.0
      - smoothstep(boltW * 0.2, boltW, vUv.x)           * 0.22   // luff (left)
      - smoothstep(boltW * 0.2, boltW, 1.0 - vUv.x)     * 0.18   // leech (right)
      - smoothstep(boltW * 0.2, boltW, vUv.y)            * 0.15   // head (top)
      - smoothstep(boltW * 0.2, boltW, 1.0 - vUv.y)     * 0.15;  // foot (bottom)

    // ---- Weathering: staining, salt deposits, sun fading ----
    float wear1 = fract(sin(vUv.x * 17.4 + vUv.y *  9.1) * 43758.5);
    float wear2 = fract(sin(vUv.x *  5.3 - vUv.y * 23.7) * 21341.2);
    float wearPatch = mix(wear1, wear2, 0.5) * 0.08 + 0.94; // subtle noise
    float sunFade  = 1.0 - 0.10 * vUv.y * vUv.y;           // top of sail slightly more faded
    float saltRing = 1.0 - 0.08 * smoothstep(0.35, 0.55, length(vUv - vec2(0.5, 0.5))); // subtle ring

    // ---- Billow self-shadow: curved belly casts slight shadow near valleys ----
    float shadow = 0.86 + 0.14 * smoothstep(-0.3, 0.4, vBillow);

    // ---- Combine everything ----
    float luminance = diff + backLight;
    vec3 col = uSailColor * luminance * weave * seams * boltEdge * wearPatch * sunFade * saltRing * shadow;

    // Slight warm tint at seams
    col += vec3(0.015, 0.010, 0.005) * (1.0 - seams);

    // Alpha: very slightly transparent in middle, opaque at edges
    float alpha = 0.88 + 0.12 * (boltEdge);

    gl_FragColor = vec4(col, alpha);
  }
`;

interface ClothSail {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

function createClothSail(
  width: number,
  height: number,
  color: THREE.Color,
  segmentsW: number = 20,
  segmentsH: number = 28
): ClothSail {
  const geometry = new THREE.PlaneGeometry(width, height, segmentsW, segmentsH);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime:          { value: 0 },
      uWindStrength:  { value: 10 },
      uWindDirection: { value: new THREE.Vector3(0, 0, 1) },
      uSailTrim:      { value: 0.8 },
      uWindFill:      { value: 0.5 },
      uSailColor:     { value: color },
      uSailTexture:   { value: null },
      uHasTexture:    { value: 0 },
      uTextureRepeat: { value: new THREE.Vector2(2, 3) },
    },
    vertexShader: CLOTH_SAIL_VERTEX,
    fragmentShader: CLOTH_SAIL_FRAGMENT,
    side: THREE.DoubleSide,
    transparent: true,
  });

  // Async-load shared canvas-cloth texture and inject when ready
  loadSharedSailTexture().then((tex) => {
    if (tex) {
      material.uniforms.uSailTexture.value = tex;
      material.uniforms.uHasTexture.value = 1;
      material.needsUpdate = true;
    }
  }).catch(() => {});

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return { mesh, material };
}

export default function OpenWaterSailing({ onBack, onLandOnIsland }: OpenWaterSailingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    ocean: DynamicOcean;
    ship: THREE.Object3D | null;
    shipPhysics: ShipPhysics;
    clothSails: ClothSail[];
    enemies: EnemyShip[];
    projectiles: Projectile[];
    clock: THREE.Clock;
    weather: WeatherConfig;
    keys: Set<string>;
    mouse: { x: number; y: number; buttons: number };
    shipPosition: THREE.Vector3;
    shipVelocity: THREE.Vector3;
    shipHeading: number;
    shipSpeed: number;
    sailTrim: number;
    portCooldown: number;
    starboardCooldown: number;
    animFrameId: number;
    sunLight: THREE.DirectionalLight;
    windArrow: THREE.ArrowHelper;
    compassNeedle: THREE.Mesh | null;
    wakeParticles: THREE.Points | null;
    windStreaks: {
      lines: THREE.Line;
      positions: Float32Array;
      speeds: Float32Array;
      lateralAmps: Float32Array;
      streakLengths: Float32Array;
      curvePhases: Float32Array;
      headX: Float32Array;
      headZ: Float32Array;
      headY: Float32Array;
      count: number;
      PPS: number;                  // points per streak (excl. NaN separator)
    } | null;
    skybox: THREE.Mesh;
    sky: SkySystem;
    celestials: CelestialRenderer;
    smoothedY: number;
    camOrbitAngle: number;
    camOrbitPitch: number;
    camOrbitDist: number;
    camDragging: boolean;
    camLastMouseX: number;
    camLastMouseY: number;
    playerHealth: number;
    playerMaxHealth: number;
    currentAmmo: AmmoType;
    kills: number;
    waveNumber: number;
    gamePhase: GamePhase;
    nextWaveTimer: number;
    abilityCooldowns: { repair: number; fullsail: number; broadside: number; sniperShot: number };
    fullSailTimer: number;
    smokeScreenTimer: number;
    abilityKeyLock: Set<string>;
    ammoKeyLock: Set<string>;
  } | null>(null);

  const [sailingState, setSailingState] = useState<SailingState>({
    speed: 0,
    heading: 0,
    windAngle: 45,
    windSpeed: 12,
    playerHealth: PLAYER_MAX_HEALTH,
    playerMaxHealth: PLAYER_MAX_HEALTH,
    position: { x: 0, z: 0 },
    sailAngle: 0,
    portCooldown: 0,
    starboardCooldown: 0,
    currentAmmo: 'heavy_ball',
    kills: 0,
    waveNumber: 0,
    gamePhase: 'sailing',
    abilities: { repair: 0, fullsail: 0, broadside: 0, sniperShot: 0 },
    fullSailActive: false,
    enemies: [],
    aimMode: false,
    aimTarget: null,
    eligibleMounts: [],
    mountCooldowns: {},
    currentShipId: resolvePlayerBoatId(),
    steeringAngle: 0,
    nearIslandName: null,
    autoFireEnabled: false,
    sniperScopeActive: false,
    sniperScopeRange: 0,
  });

  const [debugPanel, setDebugPanel] = useState(false);
  const [stormIntensity, setStormIntensity] = useState(0);
  const [windDirection, setWindDirection] = useState(45);
  const [windStrength, setWindStrength] = useState(12);
  const [waveHeight, setWaveHeight] = useState(1.2);
  const [shipType, setShipType] = useState<string>(() => resolvePlayerBoatId());
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Initializing ocean...');
  const [webglError, setWebglError] = useState(false);
  const [enemyCount, setEnemyCount] = useState(0);

  // Boarding system state
  const boardingSystemRef = useRef<BoatBoardingSystem | null>(null);
  // Weather visuals + ambient sea life, owned by this scene.
  const scenicsRef = useRef<SailingScenics | null>(null);
  const moistureCtlRef = useRef<ReturnType<typeof makeMoisturePass> | null>(null);
  // Generalized deck-rider rig (slip/tilt/balance) — boarding system handles
  // the player; this rig is here for any extra crew/units we add later.
  const deckRigRef = useRef<ShipDeckRig | null>(null);
  const seaCreaturesRef = useRef<SeaCreaturesScatter | null>(null);
  const [boardingActive, setBoardingActive] = useState(false);
  const [boardingMode, setBoardingMode] = useState<BoardingMode>('onShip');
  const [boardingPrompt, setBoardingPrompt] = useState<string | null>(null);

  const initScene = useCallback(async () => {
    if (!containerRef.current) return;

    _enemyIdCounter = 0;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      5000
    );
    camera.position.set(50, 15, 80);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setWebglError(true);
      setLoading(false);
      return;
    }
    if (!renderer.getContext()) {
      setWebglError(true);
      setLoading(false);
      renderer.dispose();
      return;
    }
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x88aacc, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
    sunLight.position.set(100, 80, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a3a5a, 0.4);
    scene.add(hemiLight);

    // Weather visuals + ambient sea life. Creature models stream in async;
    // the scene works fine before they finish loading.
    const scenics = new SailingScenics({ scene, initialCreatures: 16 });
    scenicsRef.current = scenics;

    const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(cw, ch), 0.12, 0.3, 0.92);
    composer.addPass(bloomPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / cw, 1 / ch);
    composer.addPass(fxaaPass);
    const oceanGradeShader = {
      uniforms: { tDiffuse: { value: null }, saturation: { value: 1.18 }, contrast: { value: 1.06 }, brightness: { value: 0.01 }, vignetteIntensity: { value: 0.25 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float saturation; uniform float contrast; uniform float brightness; uniform float vignetteIntensity; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb + brightness;
        float gray = dot(col, vec3(0.299,0.587,0.114)); col = mix(vec3(gray), col, saturation);
        col = (col - 0.5) * contrast + 0.5;
        float d = distance(vUv, vec2(0.5)); col *= 1.0 - d * d * vignetteIntensity;
        gl_FragColor = vec4(col, c.a); }`,
    };
    composer.addPass(new ShaderPass(oceanGradeShader));

    // ── Light moisture pass (opt-in via ?moisture=1) ─────────────────────
    // BigWings "Heartfelt"-derived rain-on-lens effect, dialed way back.
    // Runs continuously but only fades in when weather.rainIntensity is high.
    let moistureCtl: ReturnType<typeof makeMoisturePass> | null = null;
    try {
      const wantMoisture = new URLSearchParams(window.location.search).get('moisture') === '1';
      if (wantMoisture) {
        moistureCtl = makeMoisturePass({ intensity: 0, density: 0.85, refraction: 0.9, blur: 0.8 });
        moistureCtl.setSize(cw, ch);
        composer.addPass(moistureCtl.pass);
      }
    } catch { /* ignore */ }
    moistureCtlRef.current = moistureCtl;

    const skyGeo = new THREE.SphereGeometry(2000, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(0x3366aa) },
        uBottomColor: { value: new THREE.Color(0xaaccee) },
        uHorizonColor: { value: new THREE.Color(0xddeeff) },
        uSunPosition: { value: new THREE.Vector3(100, 80, 60).normalize() },
        uSunColor: { value: new THREE.Color(0xffffcc) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunPosition;
        uniform vec3 uSunColor;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float y = dir.y;
          vec3 color;
          if (y > 0.0) {
            float t = pow(y, 0.4);
            color = mix(uHorizonColor, uTopColor, t);
          } else {
            color = uHorizonColor;
          }
          float sunDot = max(dot(dir, uSunPosition), 0.0);
          float sunGlow = pow(sunDot, 128.0) * 2.0;
          float sunHalo = pow(sunDot, 8.0) * 0.3;
          color += uSunColor * (sunGlow + sunHalo);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    const skybox = new THREE.Mesh(skyGeo, skyMat);
    // Hidden — we now use the proper SkySystem (procedural clouds, sun disc,
    // day/night blend, twinkling stars). Kept around so the legacy manual
    // override useEffect can still mutate its uniforms harmlessly.
    skybox.visible = false;
    scene.add(skybox);

    // ── Mythical sky + celestial bodies ─────────────────────────────────────
    // Volumetric procedural clouds, sun disc/glow/halo, time-of-day blend, and
    // a 2000-star field with moon. All driven per-frame from globalWeather.
    const sky = new SkySystem();
    sky.init(scene);
    const celestials = new CelestialRenderer();
    celestials.init(scene);

    // Default to a calm noon and let the auto-scheduler take over so the
    // player gets long stretches of beautiful clear sailing punctuated by
    // occasional dramatic weather (see WEATHER_PRESETS + tickAutoSchedule).
    globalWeather.setTimeOfDay('morning');
    globalWeather.setWeather('clear', 0);
    globalWeather.setTimeSpeed(8);              // 1 in-game day ≈ 3 real-time minutes
    globalWeather.setAutoScheduleInterval(75);  // re-roll weather every ~75 seconds
    globalWeather.setAutoScheduleEnabled(true);

    setLoadingMsg('Creating ocean...');
    const ocean = new DynamicOcean(OCEAN_SIZE, OCEAN_SEGMENTS);
    ocean.mesh.position.y = 0;
    // Sync sun direction for GGX specular highlight
    ocean.setSunPosition(new THREE.Vector3(100, 80, 60));
    scene.add(ocean.mesh);

    // ── Sea creatures scatter (whales, tuna, schools — like underwater nodes) ─
    // Reuses the SAILING_ISLANDS roster as exclusion zones so creatures don't
    // spawn inside or directly under islands. Bounds are slightly larger than
    // the island spread.
    const seaCreatures = new SeaCreaturesScatter(scene, {
      bounds: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 },
      exclusionPoints: SAILING_ISLANDS.map((isle) => ({
        x: isle.sx,
        z: isle.sz,
        r: isle.sr + 30,
      })),
    });
    seaCreatures.generate().catch((e) =>
      console.warn('[OpenWaterSailing] Sea creatures failed to spawn:', e),
    );
    seaCreaturesRef.current = seaCreatures;

    const weather: WeatherConfig = {
      state: 'clear',
      windDirection: THREE.MathUtils.degToRad(windDirection),
      windStrength: windStrength,
      waveHeight: waveHeight,
      waveFrequency: 1.0,
      rainIntensity: 0,
      cloudDensity: 0.2,
      visibility: 1.0,
      lightningFrequency: 0,
      fogDensity: 0,
    };

    const windDir3 = new THREE.Vector3(
      Math.cos(weather.windDirection),
      0,
      Math.sin(weather.windDirection)
    );
    const windArrow = new THREE.ArrowHelper(
      windDir3,
      new THREE.Vector3(0, 20, 0),
      10,
      0x00ff00,
      2,
      1
    );
    scene.add(windArrow);

    setLoadingMsg('Loading ship model...');
    let ship: THREE.Object3D | null = null;
    const clothSails: ClothSail[] = [];
    let sailYardMesh: THREE.Mesh | null = null;
    let sailBoomMesh: THREE.Mesh | null = null;

    const boat = getBoat(shipType);
    try {
      const loader = new GLTFLoader();
      const modelPath = boat.modelPath;
      console.log(`[Sailing] Spawning boat "${boat.id}" (${boat.name}) → ${modelPath}`);
      // Race the load against a timeout so a hung/stalled GLB can never
      // leave the player floating with no boat — the catch builds a
      // procedural placeholder hull instead.
      const gltf = await new Promise<any>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error(`Ship model load timed out: ${modelPath}`));
          }
        }, 15000);
        loader.load(
          modelPath,
          (g) => { if (!settled) { settled = true; clearTimeout(timer); resolve(g); } },
          undefined,
          (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } },
        );
      });
      ship = gltf.scene;
      ship!.scale.setScalar(boat.modelScale);
      ship!.castShadow = true;

      const existingSails: THREE.Mesh[] = [];
      ship!.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const name = (child.name || '').toLowerCase();
          if (name.includes('sail') || name.includes('canvas')) {
            existingSails.push(child);
          }
        }
      });

      if (existingSails.length > 0) {
        for (const oldSail of existingSails) {
          const bbox = new THREE.Box3().setFromObject(oldSail);
          const size = bbox.getSize(new THREE.Vector3());
          const sailW = Math.max(size.x, size.z, 2.0);
          const sailH = Math.max(size.y, 2.5);
          const sail = createClothSail(sailW, sailH, new THREE.Color(0xfffdd0));
          sail.mesh.position.copy(oldSail.position);
          sail.mesh.rotation.copy(oldSail.rotation);
          oldSail.parent?.add(sail.mesh);
          oldSail.visible = false;
          clothSails.push(sail);
        }
      } else {
        const mainSail = createClothSail(3.0, 4.2, new THREE.Color(0xfffdd0));
        mainSail.mesh.position.set(0, 4.9, 0);
        ship!.add(mainSail.mesh);
        clothSails.push(mainSail);

        const jibSail = createClothSail(1.6, 2.6, new THREE.Color(0xfff8dc));
        jibSail.mesh.position.set(0, 4.0, 3.2);
        jibSail.mesh.rotation.y = Math.PI * 0.08;
        ship!.add(jibSail.mesh);
        clothSails.push(jibSail);
      }

      await applyShipTextures(ship!, 'default', 3);
      scene.add(ship!);
    } catch (err) {
      console.warn('Failed to load ship GLB, using placeholder', err);
      const hullGeo = new THREE.BoxGeometry(2, 1.5, 6);
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.castShadow = true;

      const YARD_Y = 7.0;
      const BOOM_Y = 2.8;
      const MAST_Z = 0.0;
      const SAIL_CENTER_Y = (YARD_Y + BOOM_Y) / 2;
      const SAIL_HEIGHT = YARD_Y - BOOM_Y;

      const mastGeo = new THREE.CylinderGeometry(0.1, 0.14, 9, 8);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.set(0, 4.75, MAST_Z);
      hull.add(mast);

      const yardGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6);
      const yardMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.9 });
      const yard = new THREE.Mesh(yardGeo, yardMat);
      yard.rotation.z = Math.PI / 2;
      yard.position.set(0, YARD_Y, MAST_Z);
      hull.add(yard);
      sailYardMesh = yard;

      const boomGeo = new THREE.CylinderGeometry(0.03, 0.03, 3.0, 6);
      const boom = new THREE.Mesh(boomGeo, yardMat);
      boom.rotation.z = Math.PI / 2;
      boom.position.set(0, BOOM_Y, MAST_Z);
      hull.add(boom);
      sailBoomMesh = boom;

      const mainSail = createClothSail(3.0, SAIL_HEIGHT, new THREE.Color(0xfffdd0));
      mainSail.mesh.position.set(0, SAIL_CENTER_Y, MAST_Z);
      hull.add(mainSail.mesh);
      clothSails.push(mainSail);

      const bowspritLen = 2.0;
      const bowspritGeo = new THREE.CylinderGeometry(0.04, 0.06, bowspritLen, 6);
      const bowsprit = new THREE.Mesh(bowspritGeo, yardMat);
      bowsprit.rotation.x = Math.PI / 4;
      bowsprit.position.set(0, 1.5, 3.2);
      hull.add(bowsprit);

      const jibSail = createClothSail(1.4, 2.2, new THREE.Color(0xfff8dc));
      jibSail.mesh.position.set(0, 3.6, 3.0);
      jibSail.mesh.rotation.y = 0;
      hull.add(jibSail.mesh);
      clothSails.push(jibSail);

      ship = hull;
      scene.add(ship);
    }

    // ── Helmsman + Steering Wheel ────────────────────────────────────────────
    if (ship) {
      const helmGroup = new THREE.Group();
      helmGroup.position.set(0, 1.8, -1.2);

      // Seated figure body
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
      const coatMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4956a, roughness: 0.7 });
      const hatMat  = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8), coatMat);
      torso.position.set(0, 0.35, 0);
      helmGroup.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skinMat);
      head.position.set(0, 0.82, 0);
      helmGroup.add(head);

      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), hatMat);
      hatBrim.position.set(0, 0.96, 0);
      helmGroup.add(hatBrim);
      const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.28, 10), hatMat);
      hatTop.position.set(0, 1.1, 0);
      helmGroup.add(hatTop);

      // Arms reaching to wheel
      const armGeo = new THREE.CapsuleGeometry(0.06, 0.35, 4, 6);
      const armL = new THREE.Mesh(armGeo, coatMat);
      armL.position.set(-0.28, 0.62, 0.22);
      armL.rotation.set(-0.7, 0, 0.4);
      helmGroup.add(armL);
      const armR = new THREE.Mesh(armGeo, coatMat);
      armR.position.set(0.28, 0.62, 0.22);
      armR.rotation.set(-0.7, 0, -0.4);
      helmGroup.add(armR);

      // Legs
      const legGeo = new THREE.CapsuleGeometry(0.09, 0.38, 4, 6);
      const legL = new THREE.Mesh(legGeo, bodyMat);
      legL.position.set(-0.14, -0.15, 0.1);
      legL.rotation.set(1.1, 0, 0);
      helmGroup.add(legL);
      const legR = new THREE.Mesh(legGeo, bodyMat);
      legR.position.set(0.14, -0.15, 0.1);
      legR.rotation.set(1.1, 0, 0);
      helmGroup.add(legR);

      // Stool
      const stoolGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.08, 8);
      const stoolMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1a, roughness: 0.85 });
      const stool = new THREE.Mesh(stoolGeo, stoolMat);
      stool.position.set(0, -0.05, 0);
      helmGroup.add(stool);

      // Steering wheel
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(0, 0.82, 0.55);
      const rimGeo = new THREE.TorusGeometry(0.42, 0.035, 8, 28);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e10, roughness: 0.85, metalness: 0.05 });
      const rim = new THREE.Mesh(rimGeo, woodMat);
      wheelGroup.add(rim);
      const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8);
      const hub = new THREE.Mesh(hubGeo, woodMat);
      hub.rotation.x = Math.PI / 2;
      wheelGroup.add(hub);
      for (let sp = 0; sp < 8; sp++) {
        const a = (sp / 8) * Math.PI * 2;
        const spokeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6);
        const spoke = new THREE.Mesh(spokeGeo, woodMat);
        spoke.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0);
        spoke.rotation.z = a;
        wheelGroup.add(spoke);
        // Handle knob
        const knobGeo = new THREE.SphereGeometry(0.045, 6, 5);
        const knob = new THREE.Mesh(knobGeo, woodMat);
        knob.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0);
        wheelGroup.add(knob);
      }
      helmGroup.add(wheelGroup);
      ship.add(helmGroup);
      // steeringWheel/helmsmanGroup assigned to state below after state is created
      (ship as any).__steeringWheel = wheelGroup;
      (ship as any).__helmsmanGroup = helmGroup;
    }

    // ── Aim Trajectory (3D arc + ring) ───────────────────────────────────────
    let _aimTrajectoryData: { arc: THREE.Line; ring: THREE.Mesh; dots: THREE.Mesh[] } | null = null;
    {
      const ARC_PTS = 24;
      const arcPositions = new Float32Array((ARC_PTS + 1) * 3);
      const arcGeo = new THREE.BufferGeometry();
      arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xff4422, transparent: true, opacity: 0, depthTest: false,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      arcLine.renderOrder = 999;
      scene.add(arcLine);

      const ringGeo = new THREE.RingGeometry(0.5, 2.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff2200, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 998;
      scene.add(ring);

      const dots: THREE.Mesh[] = [];
      for (let d = 0; d < 5; d++) {
        const dMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xff6633, transparent: true, opacity: 0, depthTest: false })
        );
        dMesh.renderOrder = 1000;
        scene.add(dMesh);
        dots.push(dMesh);
      }
      _aimTrajectoryData = { arc: arcLine, ring, dots };
    }

    const shipPhysics = new ShipPhysics(shipType);

    const wakeGeo = new THREE.BufferGeometry();
    const wakePositions = new Float32Array(300 * 3);
    const wakeSizes = new Float32Array(300);
    const wakeOpacities = new Float32Array(300);
    for (let i = 0; i < 300; i++) {
      wakePositions[i * 3] = 0;
      wakePositions[i * 3 + 1] = 0.1;
      wakePositions[i * 3 + 2] = 0;
      wakeSizes[i] = 0;
      wakeOpacities[i] = 0;
    }
    wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3));
    wakeGeo.setAttribute('size', new THREE.BufferAttribute(wakeSizes, 1));
    wakeGeo.setAttribute('opacity', new THREE.BufferAttribute(wakeOpacities, 1));

    const wakeMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const wakeParticles = new THREE.Points(wakeGeo, wakeMat);
    wakeParticles.frustumCulled = false;
    // Manual bounding sphere so a single NaN/late-init position can't poison
    // the whole scene's culling and produce a black screen.
    wakeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
    scene.add(wakeParticles);

    // ── Curved wispy wind streaks ─────────────────────────────────────────────
    // 175 streaks (50% of old 350), each a 5-point CatmullRom-style curve
    // drawn as a single THREE.Line using NaN separators for discontinuities.
    const STREAK_COUNT = 175;
    const PPS = 5;                   // control points per streak (excl. NaN)
    const STRIDE = PPS + 1;          // points per streak including NaN separator
    const STREAK_RANGE = 300;        // wider spread area
    const streakPositions = new Float32Array(STREAK_COUNT * STRIDE * 3);
    const streakSpeeds    = new Float32Array(STREAK_COUNT);
    const lateralAmps     = new Float32Array(STREAK_COUNT);
    const streakLengths   = new Float32Array(STREAK_COUNT);
    const curvePhases     = new Float32Array(STREAK_COUNT);
    const headX           = new Float32Array(STREAK_COUNT);
    const headZ           = new Float32Array(STREAK_COUNT);
    const headY           = new Float32Array(STREAK_COUNT);

    const wdx = Math.cos(weather.windDirection);
    const wdz = Math.sin(weather.windDirection);
    const perpX = -wdz, perpZ = wdx;   // perpendicular to wind (for curve bow)

    for (let i = 0; i < STREAK_COUNT; i++) {
      headX[i] = (Math.random() - 0.5) * STREAK_RANGE;
      headZ[i] = (Math.random() - 0.5) * STREAK_RANGE;
      headY[i] = 0.5 + Math.random() * 20;
      streakSpeeds[i]  = 0.4 + Math.random() * 1.6;
      lateralAmps[i]   = 1.5 + Math.random() * 7.5;     // wispy — big lateral curves
      streakLengths[i] = 6.0 + Math.random() * 16.0;    // long, airy streaks
      curvePhases[i]   = Math.random() < 0.5 ? 1 : -1;  // bow left or right

      const base = i * STRIDE * 3;
      for (let p = 0; p < PPS; p++) {
        const t = p / (PPS - 1);
        const lat = Math.sin(t * Math.PI) * lateralAmps[i] * curvePhases[i];
        streakPositions[base + p * 3 + 0] = headX[i] + wdx * streakLengths[i] * t + perpX * lat;
        streakPositions[base + p * 3 + 1] = headY[i];
        streakPositions[base + p * 3 + 2] = headZ[i] + wdz * streakLengths[i] * t + perpZ * lat;
      }
      // NaN separator — causes THREE.Line to break connectivity here
      streakPositions[base + PPS * 3 + 0] = NaN;
      streakPositions[base + PPS * 3 + 1] = NaN;
      streakPositions[base + PPS * 3 + 2] = NaN;
    }

    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    const streakMat = new THREE.LineBasicMaterial({
      color: 0xc8e8ff,
      transparent: true,
      opacity: 0.08,
    });
    const windStreakLine = new THREE.Line(streakGeo, streakMat);
    windStreakLine.frustumCulled = false;
    // NaN separators in the position attribute would poison computeBoundingSphere
    // (radius=NaN → frustum culling fails → black screen). Provide a manual
    // sphere big enough to encompass the streak field so culling stays sane.
    streakGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), STREAK_RANGE * 2);
    scene.add(windStreakLine);
    const windStreaks = {
      lines: windStreakLine, positions: streakPositions,
      speeds: streakSpeeds, lateralAmps, streakLengths, curvePhases,
      headX, headZ, headY,
      count: STREAK_COUNT, PPS,
    };

    // ── World map island meshes (proximity LOD) ───────────────────────────────
    // Populated lazily in the animation loop via updateIslandLOD()

    const clock = new THREE.Clock();

    const state = {
      scene,
      camera,
      renderer,
      ocean,
      ship,
      shipPhysics,
      clothSails,
      enemies: [] as EnemyShip[],
      projectiles: [] as Projectile[],
      cannonballFx: new CannonballEffects(scene),
      clock,
      weather,
      keys: new Set<string>(),
      mouse: { x: 0, y: 0, buttons: 0 },
      shipPosition: new THREE.Vector3(50, 2, 50),
      shipVelocity: new THREE.Vector3(0, 0, 0),
      shipHeading: Math.PI * 0.25,
      shipSpeed: 2,
      sailTrim: 0.8,
      sailYardAngle: 0,
      sailYardMesh,
      sailBoomMesh,
      sailBaseRotations: clothSails.map(s => s.mesh.rotation.y),
      portCooldown: 0,
      starboardCooldown: 0,
      animFrameId: 0,
      sunLight,
      windArrow,
      compassNeedle: null as THREE.Mesh | null,
      wakeParticles,
      windStreaks,
      skybox,
      sky,
      celestials,
      smoothedY: 2,
      camOrbitAngle: Math.PI,
      camOrbitPitch: 0.35,
      camOrbitDist: 30,
      camDragging: false,
      camLastMouseX: 0,
      camLastMouseY: 0,
      playerHealth: PLAYER_MAX_HEALTH,
      playerMaxHealth: PLAYER_MAX_HEALTH,
      currentAmmo: 'heavy_ball' as AmmoType,
      kills: 0,
      waveNumber: 0,
      gamePhase: 'sailing' as GamePhase,
      nextWaveTimer: 5,
      abilityCooldowns: { repair: 0, fullsail: 0, broadside: 0, sniperShot: 0 },
      fullSailTimer: 0,
      smokeScreenTimer: 0,
      abilityKeyLock: new Set<string>(),
      ammoKeyLock: new Set<string>(),
      aimMode: false,
      camDragStartX: 0,
      camDragStartY: 0,
      camDragMoved: 0,
      islandPool: new Map<string, IslandPoolEntry>(),
      mountCooldowns: {} as Record<string, number>,
      currentShipId: shipType as string,
      steeringWheel: (ship as any)?.__steeringWheel ?? null,
      helmsmanGroup: (ship as any)?.__helmsmanGroup ?? null,
      aimTrajectory: _aimTrajectoryData,
      aimBearingDeg: 0,
    };

    // Initialise island pool (cheap placeholders into scene, generator runs lazily)
    initIslandPool(scene, state);

    sceneRef.current = state;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      state.keys.add(key);
      if (e.key === 'Tab') {
        e.preventDefault();
        setDebugPanel((p) => !p);
      }
      if (key === 'f' && onLandOnIsland && state.islandPool) {
        const _p = new THREE.Vector3();
        for (const [, entry] of state.islandPool as Map<string, IslandPoolEntry>) {
          _p.set(entry.def.sx, 0, entry.def.sz);
          if (state.shipPosition.distanceTo(_p) <= CLOSE_DIST) {
            onLandOnIsland();
            return;
          }
        }
      }
      if (key === 't' && !state.abilityKeyLock.has('t')) {
        state.abilityKeyLock.add('t');
        (state as any)._autoFireEnabled = !(state as any)._autoFireEnabled;
      }
      if ((key === 'z' || key === 'escape') && !state.abilityKeyLock.has('z')) {
        state.abilityKeyLock.add('z');
        if (key === 'escape' && (state as any)._sniperScopeActive) {
          (state as any)._sniperScopeActive = false;
        } else if (key === 'z') {
          (state as any)._sniperScopeActive = !(state as any)._sniperScopeActive;
          if ((state as any)._sniperScopeActive) {
            (state as any)._sniperScopeYaw = state.shipHeading;
            (state as any)._sniperScopePitch = 0;
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      state.keys.delete(key);
      state.abilityKeyLock.delete(key);
      state.ammoKeyLock.delete(key);
    };
    // Only treat clicks as canvas input when target is the Three.js canvas itself.
    // This prevents right-click on UI panels/buttons/sliders from toggling aim mode
    // or starting a camera drag.
    const isCanvasTarget = (e: MouseEvent) => e.target === renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (!isCanvasTarget(e)) return;
      state.mouse.buttons = e.buttons;
      if (e.button === 0 && (state as any)._sniperScopeActive) {
        fireSniperScopeShot(state);
        return;
      }
      if (e.button === 2 || e.button === 1) {
        state.camDragging = true;
        state.camLastMouseX = e.clientX;
        state.camLastMouseY = e.clientY;
        state.camDragStartX = e.clientX;
        state.camDragStartY = e.clientY;
        state.camDragMoved = 0;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1) {
        // Only toggle aim mode if drag was started on canvas (camDragging was set)
        if (state.camDragging) {
          state.camDragging = false;
          // Right-click without meaningful drag → toggle aim mode
          if (e.button === 2 && state.camDragMoved < 5) {
            state.aimMode = !state.aimMode;
          }
        }
      }
      if (isCanvasTarget(e)) {
        state.mouse.buttons = 0;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      state.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      state.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      if ((state as any)._sniperScopeActive) {
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;
        (state as any)._sniperScopeYaw -= dx * 0.002;
        (state as any)._sniperScopePitch = Math.max(-0.6, Math.min(0.4,
          ((state as any)._sniperScopePitch || 0) - dy * 0.002
        ));
        return;
      }
      if (state.camDragging) {
        const dx = e.clientX - state.camLastMouseX;
        const dy = e.clientY - state.camLastMouseY;
        state.camDragMoved += Math.abs(dx) + Math.abs(dy);
        state.camOrbitAngle -= dx * 0.005;
        state.camOrbitPitch = Math.max(0.05, Math.min(1.2, state.camOrbitPitch + dy * 0.005));
        state.camLastMouseX = e.clientX;
        state.camLastMouseY = e.clientY;
      }
    };
    const onWheel = (e: WheelEvent) => {
      // Only zoom when the wheel is over the canvas, not over UI sliders/panels
      if (!isCanvasTarget(e)) return;
      state.camOrbitDist = Math.max(10, Math.min(80, state.camOrbitDist + e.deltaY * 0.03));
    };
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      moistureCtlRef.current?.setSize(w, h);
      fxaaPass.uniforms['resolution'].value.set(1 / w, 1 / h);
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);
    containerRef.current.addEventListener('contextmenu', onContextMenu);

    // ── Boarding system ─────────────────────────────────────────────────────
    const boarding = new BoatBoardingSystem(scene, camera, {
      onModeChange: (m) => setBoardingMode(m),
      onPrompt:     (msg) => setBoardingPrompt(msg),
      onLoaded:     () => {
        if (ship) {
          const deckY = boarding.probeDeckHeight(ship);
          boarding.setDeckY(deckY > 0 ? deckY : 1.0);
        }
      },
    });
    boarding.setShip(ship);
    boarding.setWeather(weather);
    // Place character on deck at ship start position
    boarding.worldPos.copy(state.shipPosition).add(new THREE.Vector3(0, BUOYANCY_OFFSET + 1.2, 0));
    boarding.setupInput(containerRef.current!);
    // Load asynchronously — character appears once ready
    boarding.load();
    boardingSystemRef.current = boarding;

    setLoading(false);

    // Stream creature models in the background; spawns once ready.
    scenicsRef.current?.warmup(state.shipPosition).catch(() => {});

    const animate = () => {
      state.animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(state.clock.getDelta(), 0.05);
      const elapsed = state.clock.getElapsedTime();

      // ── Drive the unified weather + sky + celestial pipeline ───────────────
      // Calm baseline (~62% clear seas), occasional dramatic weather, smooth
      // day/night cycle, mythical sky with twinkling stars + moon at night.
      globalWeather.update(delta);
      globalWeather.tickAutoSchedule(delta);
      globalWeather.updateLightning(delta);
      const env = globalWeather.getState();

      // Mirror live weather into the scene state so ocean shader, scenics
      // (rain/lightning/sea creatures), boarding system, and HUD all stay in
      // sync with the auto-scheduler.
      state.weather.state            = env.weather.state;
      state.weather.waveHeight       = env.weather.waveHeight;
      state.weather.waveFrequency    = env.weather.waveFrequency;
      state.weather.rainIntensity    = env.weather.rainIntensity;
      state.weather.cloudDensity     = env.weather.cloudDensity;
      state.weather.visibility       = env.weather.visibility;
      state.weather.lightningFrequency = env.weather.lightningFrequency;
      state.weather.fogDensity       = env.weather.fogDensity;

      // Sky uniforms — clouds, sun, day/night, stars
      state.sky.followCamera(camera.position);
      state.sky.update(elapsed);
      state.sky.setSkyColors(env.skyColor, env.horizonColor);
      state.sky.setSunPosition(env.sunPosition);
      state.sky.setSunColor(env.sunColor, 1.0);
      state.sky.setCloudDensity(env.weather.cloudDensity);
      state.sky.setStormIntensity(globalWeather.getStormIntensity());
      state.sky.setDayProgress(env.dayProgress);

      // Moon + star field — fade in at dusk, full brightness at midnight
      state.celestials.update(elapsed);
      state.celestials.setMoonPosition(env.moonPosition);
      state.celestials.setMoonPhase(env.moonPhase);
      const isNight = env.dayProgress < 0.22 || env.dayProgress > 0.78;
      const nightAmount = isNight
        ? Math.min(1, env.dayProgress < 0.22
            ? (0.22 - env.dayProgress) / 0.12
            : (env.dayProgress - 0.78) / 0.12)
        : 0;
      state.celestials.setNightVisibility(nightAmount);

      // Sun directional light follows the actual sun, dims at dawn/dusk and
      // when storm clouds thicken
      const sunHeight = Math.max(0, env.sunPosition.y / 100);
      state.sunLight.position.copy(env.sunPosition).normalize().multiplyScalar(150);
      state.sunLight.color.copy(env.sunColor);
      state.sunLight.intensity = 0.3 + sunHeight * 1.6 * (1 - globalWeather.getStormIntensity() * 0.65);

      // Atmospheric fog scales with storm + visibility
      if (state.scene.fog instanceof THREE.FogExp2) {
        state.scene.fog.density = 0.0003 + env.weather.fogDensity * 0.004;
        state.scene.fog.color.copy(env.horizonColor);
      }

      // Ocean shader — push live weather into wave + wind + storm uniforms so
      // the auto-scheduled weather actually animates the sea (not just the sky).
      state.ocean.setStormIntensity(globalWeather.getStormIntensity());
      state.ocean.setWaveParameters(env.weather.waveHeight, env.weather.waveFrequency);
      const windRad = THREE.MathUtils.degToRad(env.weather.windDirection);
      const windDir3 = new THREE.Vector3(Math.sin(windRad), 0, Math.cos(windRad));
      state.ocean.setWindDirection(windDir3);
      if (state.ocean.material.uniforms.uVisibility) {
        state.ocean.material.uniforms.uVisibility.value = env.weather.visibility;
      }
      if (state.ocean.material.uniforms.uSunColor) {
        state.ocean.material.uniforms.uSunColor.value = env.sunColor;
      }
      // Wind compass arrow follows the actual wind too
      if (state.windArrow) state.windArrow.setDirection(windDir3);
      // Sun direction for GGX specular (also redundantly synced in updateOcean)
      state.ocean.setSunPosition(env.sunPosition);

      if (state.gamePhase === 'sailing') {
        updateShip(state, delta, elapsed);
        updateProjectiles(state, delta, elapsed);
        updateEnemies(state, delta, elapsed);
        updateWaveSpawner(state, delta);
        updateAutoFire(state, delta);
        updateIslandDefenses(state, delta);
        if (state.cannonballFx) state.cannonballFx.update(delta);
      }

      // Weather + sea life — safe to run regardless of game phase so visuals
      // don't snap when the player dies/respawns.
      if (scenicsRef.current) {
        scenicsRef.current.update(
          delta,
          elapsed,
          state.weather,
          state.shipPosition,
          state.shipVelocity,
        );
      }
      // ── Lens moisture (opt-in via ?moisture=1) ────────────────────────
      // Only kicks in when rain crosses ~0.35; max ~0.45 even in a downpour
      // so the camera stays readable. Light, "when necessary" — exactly
      // what the user asked for.
      if (moistureCtlRef.current) {
        const rain = state.weather?.rainIntensity ?? 0;
        const target = rain < 0.35 ? 0 : Math.min(0.45, (rain - 0.35) * 0.85);
        moistureCtlRef.current.rampTo(target, 0.35); // 0.35/sec ramp = ~3s in/out
        moistureCtlRef.current.update(delta);
      }
      // Generalized deck rig — drives any extra crew bolted to the ship.
      // No-op when no riders have been added.
      if (deckRigRef.current) deckRigRef.current.update(delta);
      seaCreaturesRef.current?.update(delta, elapsed);

      // ── Boarding character update ───────────────────────────────────────
      const bs = boardingSystemRef.current;
      const boardingOn = (state as any)._boardingActive;
      if ((state as any)._sniperScopeActive) {
        updateSniperScopeCamera(state);
      } else if (bs && bs.isLoaded && boardingOn) {
        bs.setShip(state.ship);
        bs.setWeather(state.weather);
        bs.update(delta, elapsed);
      } else {
        updateCamera(state, delta);
      }

      updateOcean(state, elapsed);
      updateWake(state, delta);
      updateWindStreaks(state, delta, elapsed);
      updateIslandLOD(state, scene, delta, elapsed);

      // Compute aim target (nearest enemy) & update aim bearing
      let aimTarget: SailingState['aimTarget'] = null;
      if (state.aimMode && state.enemies.length > 0) {
        let nearest: any = null;
        let nearestDist = Infinity;
        for (let _i = 0; _i < state.enemies.length; _i++) {
          const _e = state.enemies[_i];
          const _d = state.shipPosition.distanceTo(_e.position);
          if (_d < nearestDist) { nearestDist = _d; nearest = _e; }
        }
        if (nearest) {
          const dx = nearest.position.x - state.shipPosition.x;
          const dz = nearest.position.z - state.shipPosition.z;
          const worldBearing = Math.atan2(dx, dz);
          const relBearing = ((worldBearing - state.shipHeading) * 180 / Math.PI + 540) % 360 - 180;
          state.aimBearingDeg = relBearing;
          aimTarget = {
            dist: Math.round(nearestDist),
            bearing: relBearing,
            side: relBearing > 0 ? 'port' : 'starboard',
            hp: nearest.health,
            maxHp: nearest.maxHealth,
          };

          // ── Update 3D aim trajectory ──────────────────────────────────────
          if (state.aimTrajectory) {
            const traj = state.aimTrajectory;
            const ammo = AMMO_TYPES[state.currentAmmo as string] || AMMO_TYPES['heavy_ball'];
            const fireBearing = worldBearing;
            const ARC_PTS = 24;
            const pts: number[] = [];
            const speed = ammo.speed;
            const g = 9.8;
            const vy0 = speed * 0.18;
            const vx = Math.sin(fireBearing) * speed;
            const vz = Math.cos(fireBearing) * speed;
            const timeRange = ammo.ttl;
            for (let pi = 0; pi <= ARC_PTS; pi++) {
              const t = (pi / ARC_PTS) * timeRange;
              pts.push(
                state.shipPosition.x + vx * t,
                state.shipPosition.y + 3 + vy0 * t - 0.5 * g * t * t,
                state.shipPosition.z + vz * t
              );
            }
            const posAttr = traj.arc.geometry.attributes.position as THREE.BufferAttribute;
            for (let pi = 0; pi <= ARC_PTS; pi++) {
              posAttr.setXYZ(pi, pts[pi * 3], pts[pi * 3 + 1], pts[pi * 3 + 2]);
            }
            posAttr.needsUpdate = true;
            (traj.arc.material as THREE.LineBasicMaterial).opacity = 0.9;

            // Place hit ring at trajectory end
            const endX = pts[(ARC_PTS) * 3];
            const endZ = pts[(ARC_PTS) * 3 + 2];
            traj.ring.position.set(endX, 0.3, endZ);
            const pulse = 0.9 + 0.1 * Math.sin(elapsed * 6);
            traj.ring.scale.set(pulse, pulse, pulse);
            (traj.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.2 * Math.sin(elapsed * 8);

            // Animate dots along arc
            for (let d = 0; d < traj.dots.length; d++) {
              const frac = ((d / traj.dots.length) + (elapsed * 0.5)) % 1;
              const idx = Math.floor(frac * ARC_PTS);
              traj.dots[d].position.set(pts[idx * 3], pts[idx * 3 + 1], pts[idx * 3 + 2]);
              (traj.dots[d].material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(elapsed * 4 + d);
            }
          }
        }
      } else {
        // Hide trajectory when not aiming
        if (state.aimTrajectory) {
          (state.aimTrajectory.arc.material as THREE.LineBasicMaterial).opacity = 0;
          (state.aimTrajectory.ring.material as THREE.MeshBasicMaterial).opacity = 0;
          state.aimTrajectory.dots.forEach((d: THREE.Mesh) => {
            (d.material as THREE.MeshBasicMaterial).opacity = 0;
          });
        }
      }

      // Animate steering wheel rotation based on turning
      if (state.steeringWheel) {
        const turnInput = (state.keys.has('a') || state.keys.has('arrowleft') ? 1 : 0) -
                         (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0);
        state.steeringWheel.rotation.z += turnInput * delta * 2;
      }

      // Compute eligible mounts for HUD display
      const eligibleMounts = getEligibleMounts(state.currentShipId, state.aimBearingDeg ?? 90);

      setSailingState({
        speed: state.shipSpeed,
        heading: THREE.MathUtils.radToDeg(state.shipHeading) % 360,
        windAngle: THREE.MathUtils.radToDeg(state.weather.windDirection) % 360,
        windSpeed: state.weather.windStrength,
        playerHealth: state.playerHealth,
        playerMaxHealth: state.playerMaxHealth,
        position: { x: state.shipPosition.x, z: state.shipPosition.z },
        sailAngle: state.sailTrim * 100,
        portCooldown: state.portCooldown,
        starboardCooldown: state.starboardCooldown,
        currentAmmo: state.currentAmmo,
        kills: state.kills,
        waveNumber: state.waveNumber,
        gamePhase: state.gamePhase,
        abilities: { ...state.abilityCooldowns },
        fullSailActive: state.fullSailTimer > 0,
        enemies: state.enemies.map(e => ({
          id: e.id,
          health: e.health,
          maxHealth: e.maxHealth,
          dist: Math.round(state.shipPosition.distanceTo(e.position)),
        })),
        aimMode: state.aimMode,
        aimTarget,
        eligibleMounts,
        mountCooldowns: { ...state.mountCooldowns },
        currentShipId: state.currentShipId,
        steeringAngle: state.steeringWheel?.rotation.z ?? 0,
        nearIslandName: (() => {
          if (!state.islandPool) return null;
          const _p = new THREE.Vector3();
          for (const [, entry] of state.islandPool as Map<string, IslandPoolEntry>) {
            _p.set(entry.def.sx, 0, entry.def.sz);
            if (state.shipPosition.distanceTo(_p) <= CLOSE_DIST) return entry.def.name;
          }
          return null;
        })(),
        autoFireEnabled: !!(state as any)._autoFireEnabled,
        sniperScopeActive: !!(state as any)._sniperScopeActive,
        sniperScopeRange: (state as any)._sniperScopeRange || 0,
      });

      composer.render();
    };

    animate();

    return () => {
      cancelAnimationFrame(state.animFrameId);
      boardingSystemRef.current?.dispose();
      boardingSystemRef.current = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      for (const sail of clothSails) {
        sail.mesh.geometry.dispose();
        sail.material.dispose();
      }
      for (const enemy of state.enemies) {
        const sails: ClothSail[] = enemy.allClothSails || (enemy.clothSail ? [enemy.clothSail] : []);
        for (const sail of sails) {
          sail.mesh.geometry.dispose();
          sail.material.dispose();
        }
      }
      if (state.windStreaks) {
        state.windStreaks.lines.geometry.dispose();
        (state.windStreaks.lines.material as THREE.Material).dispose();
      }
      deckRigRef.current?.dispose();
      seaCreaturesRef.current?.dispose();
      seaCreaturesRef.current = null;
      deckRigRef.current = null;
      scenicsRef.current = null;
      sky.dispose();
      celestials.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      ocean.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const cleanup = initScene();
    return () => {
      cleanup?.then((fn) => fn?.());
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animFrameId);
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const s = sceneRef.current;

    const stormState = stormIntensity > 0.7 ? 'storm' : stormIntensity > 0.4 ? 'heavy_rain' : stormIntensity > 0.2 ? 'rain' : 'clear';
    s.weather = {
      state: stormState as any,
      windDirection: THREE.MathUtils.degToRad(windDirection),
      windStrength: windStrength,
      waveHeight: waveHeight * (1 + stormIntensity * 2),
      waveFrequency: 1.0 + stormIntensity * 0.5,
      rainIntensity: stormIntensity,
      cloudDensity: 0.2 + stormIntensity * 0.6,
      visibility: 1.0 - stormIntensity * 0.5,
      lightningFrequency: stormIntensity > 0.6 ? stormIntensity * 2 : 0,
      fogDensity: stormIntensity * 0.3,
    };

    s.ocean.setStormIntensity(stormIntensity);
    s.ocean.setWaveParameters(waveHeight * (1 + stormIntensity * 2), 1.0 + stormIntensity * 0.5);
    const windDir3 = new THREE.Vector3(
      Math.cos(THREE.MathUtils.degToRad(windDirection)),
      0,
      Math.sin(THREE.MathUtils.degToRad(windDirection))
    );
    s.ocean.setWindDirection(windDir3);
    s.windArrow.setDirection(windDir3);

    if (s.scene.fog instanceof THREE.FogExp2) {
      s.scene.fog.density = 0.0008 + stormIntensity * 0.003;
    }

    const skyMat = s.skybox.material as THREE.ShaderMaterial;
    if (skyMat.uniforms) {
      const stormGrey = stormIntensity * 0.7;
      skyMat.uniforms.uTopColor.value.setRGB(
        0.2 * (1 - stormGrey) + 0.2 * stormGrey,
        0.4 * (1 - stormGrey) + 0.2 * stormGrey,
        0.67 * (1 - stormGrey) + 0.25 * stormGrey
      );
      skyMat.uniforms.uHorizonColor.value.setRGB(
        0.87 * (1 - stormGrey) + 0.4 * stormGrey,
        0.93 * (1 - stormGrey) + 0.4 * stormGrey,
        1.0 * (1 - stormGrey) + 0.45 * stormGrey
      );
    }

    s.sunLight.intensity = 1.8 * (1 - stormIntensity * 0.6);
  }, [stormIntensity, windDirection, windStrength, waveHeight]);

  const fireCannon = useCallback((side: 'port' | 'starboard') => {
    const s = sceneRef.current;
    if (!s || s.gamePhase !== 'sailing') return;
    const cooldown = side === 'port' ? s.portCooldown : s.starboardCooldown;
    if (cooldown > 0) return;
    fireCannonFromState(s, side);
    shipAudio.playFire();
  }, []);

  const spawnEnemy = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    spawnEnemyFromState(s);
    setEnemyCount(s.enemies.length);
  }, []);

  const handleUnstick = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    const fwd = new THREE.Vector3(Math.sin(s.shipHeading), 0, Math.cos(s.shipHeading));
    s.shipPosition.add(fwd.multiplyScalar(30));
    s.shipPosition.y = BUOYANCY_OFFSET + 1;
    s.shipSpeed = 2;
    s.shipVelocity.set(0, 0, 0);
    if (s.ship) s.ship.position.copy(s.shipPosition);
  }, []);

  const handleRespawn = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.playerHealth = PLAYER_MAX_HEALTH;
    s.gamePhase = 'sailing';
    s.kills = 0;
    s.waveNumber = 0;
    s.nextWaveTimer = 5;
    s.abilityCooldowns = { repair: 0, fullsail: 0, broadside: 0, sniperShot: 0 };
    s.fullSailTimer = 0;
    s.shipPosition.set(50, BUOYANCY_OFFSET, 50);
    s.shipSpeed = 2;
    s.shipVelocity.set(0, 0, 0);
    for (const e of s.enemies) {
      s.scene.remove(e.mesh);
    }
    s.enemies = [];
    for (const p of s.projectiles) {
      s.scene.remove(p.mesh);
    }
    s.projectiles = [];
    setEnemyCount(0);
  }, []);

  const handleAbility = useCallback((ability: 'repair' | 'fullsail' | 'broadside') => {
    const s = sceneRef.current;
    if (!s || s.gamePhase !== 'sailing') return;
    activateAbility(s, ability);
  }, []);

  const handleSniperShot = useCallback(() => {
    const s = sceneRef.current;
    if (!s || s.gamePhase !== 'sailing') return;
    if (s.abilityCooldowns.sniperShot > 0) return;
    fireSniperShot(s);
    s.abilityCooldowns.sniperShot = 12;
    spawnAbilityEffect(s, s.shipPosition.clone(), 0xff0000);
  }, []);

  const toggleBoarding = useCallback(() => {
    const s = sceneRef.current;
    const bs = boardingSystemRef.current;
    if (!s || !bs) return;
    const next = !boardingActive;
    (s as any)._boardingActive = next;
    setBoardingActive(next);
    if (next) {
      // Start character on ship deck at current ship position
      bs.worldPos.copy(s.shipPosition).add(new THREE.Vector3(0, BUOYANCY_OFFSET + 1.5, 0));
    }
  }, [boardingActive]);

  const healthPct = (sailingState.playerHealth / sailingState.playerMaxHealth) * 100;
  const healthColor = healthPct > 60 ? 'bg-green-500' : healthPct > 30 ? 'bg-yellow-400' : 'bg-red-500';

  // ── CSS-driven HUD reactivity ────────────────────────────────────────
  // Damage flash: bump a counter whenever HP drops; the data-attribute
  // change re-triggers the keyframe animation defined in sailingFx.css.
  const prevHpRef = useRef(sailingState.playerHealth);
  const [damageTick, setDamageTick] = useState(0);
  useEffect(() => {
    if (sailingState.playerHealth < prevHpRef.current - 0.5) {
      setDamageTick(t => t + 1);
    }
    prevHpRef.current = sailingState.playerHealth;
  }, [sailingState.playerHealth]);

  // Audio bus: boot once, drive engine + sail loops every animation tick,
  // stop on unmount. Burning state plays when shore-defense burn lands.
  useEffect(() => {
    shipAudio.boot();
    let raf = 0;
    const tick = () => {
      const s = sceneRef.current;
      if (s) shipAudio.driveSailing(s.shipSpeed, s.sailTrim);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      shipAudio.stop();
    };
  }, []);

  const isLowHp   = healthPct > 0 && healthPct < 30;
  const isBurning = !!(sceneRef.current && (sceneRef.current as any)._playerBurning > 0);
  const fxRootCls = `sailing-fx-root${isLowHp ? ' is-low-hp' : ''}${isBurning ? ' is-burning' : ''}`;

  return (
    <div className={`h-screen w-full relative overflow-hidden bg-black ${fxRootCls}`} data-testid="page-open-water-sailing">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="sailing-fx-damage" data-hit={damageTick} data-testid="fx-damage-flash" />

      <Minimap
        getViewer={() =>
          sceneRef.current
            ? {
                x: sceneRef.current.shipPosition.x,
                z: sceneRef.current.shipPosition.z,
                rot: sceneRef.current.shipHeading,
              }
            : null
        }
        markers={SAILING_MINIMAP_MARKERS}
        initialRange={2200}
        position="top-right"
      />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black z-50" data-testid="webgl-error-screen">
          <div className="text-center max-w-md mx-4 space-y-6">
            <div className="text-5xl">⚓</div>
            <h1 className="text-3xl font-serif text-amber-400">WebGL Required</h1>
            <p className="text-white/70 leading-relaxed">
              Tethical's 3D ocean, sky, and ship rendering requires WebGL which isn't available in this viewer.
              Open the game in a full browser tab to set sail.
            </p>
            <div className="space-y-3">
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-amber-600 hover:bg-amber-500 text-black font-bold py-3 px-6 rounded-lg transition-colors"
                data-testid="link-open-in-browser"
              >
                Open in Browser Tab
              </a>
              <div>
                <button
                  onClick={onBack}
                  className="text-white/50 hover:text-white/80 text-sm underline transition-colors"
                  data-testid="button-back-to-menu-webgl"
                >
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && !webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center">
            <div className="text-2xl font-serif text-amber-400 mb-2">Setting Sail...</div>
            <div className="text-white/60">{loadingMsg}</div>
            <div className="mt-4 w-48 h-1 bg-white/20 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-amber-400 animate-pulse w-2/3 rounded-full" />
            </div>
          </div>
        </div>
      )}

      {sailingState.gamePhase === 'dead' && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/70">
          <div className="bg-gray-900/95 border border-red-800 rounded-xl p-8 text-center max-w-sm w-full mx-4">
            <div className="text-4xl mb-2">💀</div>
            <div className="text-3xl font-serif text-red-400 mb-1">Ship Sunk</div>
            <div className="text-white/60 text-sm mb-4">Your vessel has been sent to Davy Jones' locker.</div>
            <div className="flex justify-center gap-8 mb-6">
              <div>
                <div className="text-2xl font-bold text-amber-400" data-testid="text-kills-final">{sailingState.kills}</div>
                <div className="text-xs text-white/50">Ships Sunk</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">{sailingState.waveNumber}</div>
                <div className="text-xs text-white/50">Waves Survived</div>
              </div>
            </div>
            <Button
              onClick={handleRespawn}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold"
              data-testid="button-respawn"
            >
              Set Sail Again
            </Button>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={onBack}
          className="text-white/70 hover:text-white transition-colors bg-black/50 backdrop-blur px-3 py-1.5 rounded-md text-sm"
          data-testid="button-back-menu-sailing"
        >
          ← Menu
        </button>
        <button
          onClick={toggleBoarding}
          data-testid="button-toggle-boarding"
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all backdrop-blur ${
            boardingActive
              ? 'bg-amber-600/90 text-black hover:bg-amber-500'
              : 'bg-black/50 text-white/70 hover:text-white'
          }`}
        >
          {boardingActive ? '⚓ Captain Mode' : '⚓ Board Ship'}
        </button>
      </div>

      {/* Boarding mode HUD */}
      {boardingActive && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-2">
          <div className="bg-black/75 backdrop-blur rounded-full px-4 py-1.5 flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${
              boardingMode === 'onShip' ? 'bg-amber-400' :
              boardingMode === 'swimming' ? 'bg-blue-400' : 'bg-green-400'
            }`} />
            <span className="text-white/80 text-sm font-medium capitalize">
              {boardingMode === 'onShip' ? '🚢 On Deck' :
               boardingMode === 'swimming' ? '🌊 Swimming' : '⬆ Boarding'}
            </span>
          </div>
          {boardingPrompt && (
            <div className="bg-black/60 backdrop-blur rounded-md px-4 py-2 text-white/90 text-xs tracking-wide">
              {boardingPrompt}
            </div>
          )}
          <div className="text-white/40 text-xs mt-1">
            WASD move &nbsp;|&nbsp; right-drag orbit &nbsp;|&nbsp; E jump off &nbsp;|&nbsp; F board (when swimming)
          </div>
        </div>
      )}

      {sailingState.autoFireEnabled && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-green-900/80 border border-green-500/60 backdrop-blur rounded-full px-4 py-1 flex items-center gap-2" data-testid="indicator-autofire">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-200 text-xs font-bold tracking-widest uppercase">Auto-Fire ON</span>
            <span className="text-green-400/60 text-[10px] ml-1">[T]</span>
          </div>
        </div>
      )}

      {sailingState.sniperScopeActive && (
        <div className="absolute inset-0 z-30 pointer-events-none" data-testid="overlay-sniper-scope">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.85) 45%)',
          }} />

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg width="400" height="400" viewBox="-200 -200 400 400" className="opacity-80">
              <circle cx="0" cy="0" r="150" fill="none" stroke="#ff2222" strokeWidth="1.5" opacity="0.6" />
              <circle cx="0" cy="0" r="80" fill="none" stroke="#ff3333" strokeWidth="0.8" opacity="0.4" />
              <circle cx="0" cy="0" r="3" fill="#ff0000" opacity="0.9" />
              <line x1="-180" y1="0" x2="-10" y2="0" stroke="#ff2222" strokeWidth="1" opacity="0.7" />
              <line x1="10" y1="0" x2="180" y2="0" stroke="#ff2222" strokeWidth="1" opacity="0.7" />
              <line x1="0" y1="-180" x2="0" y2="-10" stroke="#ff2222" strokeWidth="1" opacity="0.7" />
              <line x1="0" y1="10" x2="0" y2="180" stroke="#ff2222" strokeWidth="1" opacity="0.7" />

              {[-120, -80, -40, 40, 80, 120].map(x => (
                <line key={`h${x}`} x1={x} y1="-4" x2={x} y2="4" stroke="#ff4444" strokeWidth="0.5" opacity="0.5" />
              ))}
              {[-120, -80, -40, 40, 80, 120].map(y => (
                <line key={`v${y}`} x1="-4" y1={y} x2="4" y2={y} stroke="#ff4444" strokeWidth="0.5" opacity="0.5" />
              ))}

              <text x="160" y="-8" fill="#ff5555" fontSize="8" textAnchor="end" fontFamily="monospace">MIL</text>
            </svg>
          </div>

          <div className="absolute top-8 left-1/2 -translate-x-1/2">
            <div className="bg-red-900/90 border border-red-600/60 backdrop-blur rounded-full px-5 py-1.5 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-200 text-sm font-bold tracking-widest uppercase">Sniper Scope</span>
            </div>
          </div>

          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="bg-black/85 border border-red-700/50 backdrop-blur rounded-lg px-5 py-3 text-center space-y-1">
              {sailingState.sniperScopeRange > 0 ? (
                <>
                  <div className="text-red-400 text-xs font-bold tracking-widest">RANGE</div>
                  <div className="text-white font-mono text-lg">{sailingState.sniperScopeRange}m</div>
                  <div className={`text-xs ${sailingState.sniperScopeRange <= 200 ? 'text-green-400' : 'text-red-400'}`}>
                    {sailingState.sniperScopeRange <= 200 ? '● IN RANGE' : '● OUT OF RANGE'}
                  </div>
                </>
              ) : (
                <div className="text-white/50 text-sm">No targets detected</div>
              )}
            </div>
            <div className="text-white/30 text-[10px]">Click to fire · Z / ESC to exit</div>
          </div>

          <div className="absolute top-1/2 right-8 -translate-y-1/2 flex flex-col items-end gap-0.5">
            {[0, 50, 100, 150, 200, 250, 300].map(d => (
              <div key={d} className="flex items-center gap-1">
                <span className="text-red-400/50 text-[8px] font-mono">{d}</span>
                <div className="w-3 h-px bg-red-500/30" />
              </div>
            ))}
          </div>
        </div>
      )}

      {sailingState.nearIslandName && onLandOnIsland && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 z-30 pointer-events-none" style={{ transform: 'translate(-50%, -120%)' }}>
          <div className="bg-black/70 backdrop-blur-md rounded-xl px-6 py-3 border border-amber-500/40 shadow-lg shadow-amber-500/10 text-center animate-pulse">
            <div className="text-amber-300 font-bold text-base tracking-wide mb-1">{sailingState.nearIslandName}</div>
            <div className="text-white/90 text-sm">Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-amber-300 font-mono font-bold">F</kbd> to dock</div>
          </div>
        </div>
      )}

      {/* Aim mode overlay */}
      {sailingState.aimMode && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Subtle red vignette border */}
          <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 80px 20px rgba(200,20,20,0.25)' }} />

          {/* Center crosshair with animated trajectory */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
            {/* SVG trajectory arc (2D overlay, actual 3D arc rendered in scene) */}
            <svg width="240" height="120" viewBox="-120 -10 240 130" className="overflow-visible opacity-90">
              {/* Parabolic arc */}
              <path d="M -100 90 Q 0 -5 100 90" fill="none" stroke="#ff4422" strokeWidth="2.5" strokeDasharray="8 4">
                <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.6s" repeatCount="indefinite" />
              </path>
              {/* Animated dots along arc */}
              {[0.15, 0.32, 0.5, 0.68, 0.85].map((t, idx) => {
                const x = -100 + t * 200;
                const y = 90 - Math.sin(t * Math.PI) * 95;
                return (
                  <circle key={idx} cx={x} cy={y} r="3.5" fill="#ff6644" opacity="0.9">
                    <animate attributeName="opacity" values="0.4;1;0.4" dur="0.8s" begin={`${idx * 0.16}s`} repeatCount="indefinite" />
                  </circle>
                );
              })}
              {/* Hit zone ring at end */}
              <ellipse cx="0" cy="90" rx="18" ry="6" fill="none" stroke="#ff2200" strokeWidth="2" opacity="0.8">
                <animate attributeName="rx" values="14;22;14" dur="0.9s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite" />
              </ellipse>
              {/* Target marker */}
              {sailingState.aimTarget && (
                <>
                  <line x1={sailingState.aimTarget.side === 'port' ? -85 : 85} y1="45"
                        x2={sailingState.aimTarget.side === 'port' ? -85 : 85} y2="92"
                        stroke="#ff2222" strokeWidth="2" strokeDasharray="4 2" />
                  <text x={sailingState.aimTarget.side === 'port' ? -85 : 85} y="38"
                        fill="#ff5555" fontSize="9" textAnchor="middle" fontWeight="bold">TARGET</text>
                </>
              )}
            </svg>

            {/* Crosshair reticle */}
            <div className="relative w-12 h-12 -mt-2">
              <div className="absolute inset-0 border-2 border-red-500/80 rounded-full" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500/60 -translate-y-1/2" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/60 -translate-x-1/2" />
              <div className="absolute inset-[7px] border border-red-400/50 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Aim info panel */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-12 translate-y-16 flex flex-col items-center gap-2">
            {sailingState.aimTarget ? (
              <div className="bg-black/85 border border-red-700/60 backdrop-blur rounded-lg px-5 py-3 text-center space-y-1.5 min-w-[220px]">
                <div className="text-red-400 text-xs font-bold tracking-widest uppercase">Cannon Targeting</div>
                <div className="text-white text-sm font-mono">
                  {sailingState.aimTarget.side === 'port' ? '◀ PORT' : 'STARBOARD ▶'} &nbsp;
                  <span className="text-red-300">{Math.abs(sailingState.aimTarget.bearing).toFixed(0)}°</span>
                </div>
                <div className="text-white/70 text-sm">
                  Range <span className="text-amber-300 font-mono">{sailingState.aimTarget.dist}m</span>
                  {sailingState.aimTarget.dist <= 80
                    ? <span className="ml-2 text-green-400 text-xs">● IN RANGE</span>
                    : <span className="ml-2 text-red-400 text-xs">● OUT OF RANGE</span>}
                </div>
                {/* Eligible mounts display */}
                {sailingState.eligibleMounts.length > 0 && (
                  <div className="flex gap-1 justify-center flex-wrap pt-0.5">
                    {sailingState.eligibleMounts.map(m => (
                      <span key={m.id} className={`text-[9px] px-1.5 py-0.5 rounded border ${
                        (sailingState.mountCooldowns[m.id] ?? 0) <= 0
                          ? 'bg-green-900/60 border-green-600/60 text-green-300'
                          : 'bg-red-900/40 border-red-700/40 text-red-400'
                      }`}>
                        {m.id} {(sailingState.mountCooldowns[m.id] ?? 0) > 0
                          ? `${sailingState.mountCooldowns[m.id].toFixed(1)}s`
                          : '✓'}
                      </span>
                    ))}
                  </div>
                )}
                {/* Enemy HP bar */}
                <div className="w-36 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto">
                  <div className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${(sailingState.aimTarget.hp / sailingState.aimTarget.maxHp) * 100}%` }} />
                </div>
                <div className="text-[10px] text-white/40">
                  Hull {Math.ceil(sailingState.aimTarget.hp)} / {sailingState.aimTarget.maxHp}
                </div>
              </div>
            ) : (
              <div className="bg-black/70 border border-white/10 backdrop-blur rounded-lg px-4 py-2 text-white/50 text-sm">
                No enemies detected
              </div>
            )}
            <div className="text-white/30 text-[10px]">SPACE to fire · RMB to exit aim</div>
          </div>

          {/* Aim mode top badge */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2">
            <div className="bg-red-900/80 border border-red-600/60 backdrop-blur rounded-full px-4 py-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-200 text-xs font-bold tracking-widest uppercase">Aim Mode</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-black/60 backdrop-blur rounded-lg px-6 py-2 text-center">
          <div className="text-amber-400 font-serif text-lg" data-testid="text-ship-speed">
            {sailingState.speed.toFixed(1)} kts
            {sailingState.fullSailActive && <span className="ml-2 text-yellow-300 text-sm animate-pulse">⚡ FULL SAIL</span>}
          </div>
          <div className="flex gap-4 text-xs text-white/60 mt-0.5">
            <span data-testid="text-heading">HDG {((sailingState.heading % 360 + 360) % 360).toFixed(0)}°</span>
            <span data-testid="text-wind">WIND {((sailingState.windAngle % 360 + 360) % 360).toFixed(0)}° @ {sailingState.windSpeed.toFixed(0)}kts</span>
            <span>WAVE {sailingState.waveNumber}</span>
            <span data-testid="text-kills" className="text-amber-300">⚔ {sailingState.kills}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-16 left-4 z-10 space-y-2 origin-top-left scale-[0.82]" style={{ width: 240 }}>
        <WindCompass
          windAngleDeg={sailingState.windAngle}
          windSpeedKts={sailingState.windSpeed}
          shipHeadingDeg={sailingState.heading}
          shipSpeedKts={sailingState.speed}
          sailTrim01={Math.max(0, Math.min(1, sailingState.sailAngle / 100))}
          fullSailActive={sailingState.fullSailActive}
        />
        <div className="bg-black/70 backdrop-blur rounded-lg p-3">
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span>Hull Integrity</span>
            <span data-testid="text-health">{Math.ceil(sailingState.playerHealth)} / {sailingState.playerMaxHealth}</span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${healthColor}`}
              style={{ width: `${Math.max(0, healthPct)}%` }}
              data-testid="bar-health"
            />
          </div>
        </div>

        <div className="bg-black/70 backdrop-blur rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1.5">Cannon Reload</div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-white/40 w-6">Port</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full transition-all"
                style={{ width: `${sailingState.portCooldown <= 0 ? 100 : (1 - sailingState.portCooldown / PORT_COOLDOWN_MAX) * 100}%` }}
                data-testid="bar-port-reload"
              />
            </div>
            {sailingState.portCooldown <= 0 && <span className="text-green-400 text-xs">✓</span>}
          </div>
          <div className="flex gap-2 items-center mt-1">
            <span className="text-xs text-white/40 w-6">Stbd</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full transition-all"
                style={{ width: `${sailingState.starboardCooldown <= 0 ? 100 : (1 - sailingState.starboardCooldown / STARBOARD_COOLDOWN_MAX) * 100}%` }}
                data-testid="bar-starboard-reload"
              />
            </div>
            {sailingState.starboardCooldown <= 0 && <span className="text-green-400 text-xs">✓</span>}
          </div>
        </div>

        <div className="bg-black/70 backdrop-blur rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Enemies: {sailingState.enemies.length}</div>
          {sailingState.enemies.slice(0, 4).map(e => (
            <div key={e.id} className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/40 w-10 shrink-0">{e.dist}m</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${(e.health / e.maxHealth) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {sailingState.enemies.length > 4 && (
            <div className="text-xs text-white/30 mt-1">+{sailingState.enemies.length - 4} more</div>
          )}
        </div>
      </div>

      {/* ── Bottom combat HUD ────────────────────────────────────────────── */}
      <GameHUD
        mode="ship"
        slots={(() => {
          const abilityDefs: SlotDef[] = [
            { id: 'repair',     label: 'Repair',      icon: '🔧', hotkey: 'R', cooldown: sailingState.abilities.repair,     maxCooldown: 45, onClick: () => handleAbility('repair'), disabled: sailingState.gamePhase !== 'sailing' },
            { id: 'fullsail',   label: 'Full Sail',   icon: '💨', hotkey: 'V', cooldown: sailingState.abilities.fullsail,   maxCooldown: 30, onClick: () => handleAbility('fullsail'), disabled: sailingState.gamePhase !== 'sailing' },
            { id: 'broadside',  label: 'Broadside',   icon: '💥', hotkey: 'G', cooldown: sailingState.abilities.broadside,  maxCooldown: 20, onClick: () => handleAbility('broadside'), disabled: sailingState.gamePhase !== 'sailing' },
            { id: 'sniperShot', label: "Crow's Nest", icon: '🎯', hotkey: 'F', cooldown: sailingState.abilities.sniperShot, maxCooldown: 12, onClick: handleSniperShot, disabled: sailingState.gamePhase !== 'sailing' },
          ];
          return abilityDefs;
        })()}
        secondarySlots={(() => {
          return (Object.entries(CANNON_SKILLS) as [CannonSkillId, typeof CANNON_SKILLS[CannonSkillId]][]).map(([id, skill]) => ({
            id,
            label: skill.name,
            icon: skill.icon,
            hotkey: skill.key,
            active: sailingState.currentAmmo === id,
            description: skill.description,
            onClick: () => {
              const s = sceneRef.current;
              if (s) s.currentAmmo = id;
              setSailingState(prev => ({ ...prev, currentAmmo: id }));
            },
          }));
        })()}
        secondaryLabel="Cannon Skills"
        vitals={[
          { id: "hull", label: "Hull", current: sailingState.playerHealth, max: sailingState.playerMaxHealth, color: "#f59e0b", icon: "shield" },
        ]}
        sideLeft={{
          id: "port", label: "PORT", icon: "💥", hotkey: "Space",
          cooldown: sailingState.portCooldown, maxCooldown: PORT_COOLDOWN_MAX,
          description: "Port",
          disabled: sailingState.gamePhase !== 'sailing',
          onClick: () => fireCannon('port'),
        }}
        sideRight={{
          id: "starboard", label: "STBD", icon: "💥", hotkey: "Space",
          cooldown: sailingState.starboardCooldown, maxCooldown: STARBOARD_COOLDOWN_MAX,
          description: "Stbd",
          disabled: sailingState.gamePhase !== 'sailing',
          onClick: () => fireCannon('starboard'),
        }}
        hint="WASD sail · A/D turn · Q/E trim · Space fire · 1-6 skills · R/V/G/F abilities · T auto-fire · Z sniper · RMB aim · Tab debug"
      />

      {isCinzelHudEnabled() && (() => {
        const WEAPON_NAMES: Record<string, { name: string; icon: string }> = {
          staff: { name: 'Arcane Staff', icon: '🪄' },
          sword_shield: { name: 'Longsword & Shield', icon: '⚔' },
          bow: { name: 'Recurve Bow', icon: '🏹' },
          axe: { name: 'War Axe', icon: '🪓' },
        };
        let fallback = { name: 'Captain', race: 'human' as Race, className: 'Sea Lord', level: 5 };
        let equipped: Array<{ slot: 'weapon' | 'armor'; name: string; icon: string }> | undefined;
        try {
          const build = loadCaptainBuild();
          if (build) {
            fallback = {
              name: build.race.charAt(0).toUpperCase() + build.race.slice(1) + ' Captain',
              race: build.race as Race,
              className: CLASS_LABELS[build.classKey] ?? 'Warlord',
              level: 5,
            };
            const wpn = WEAPON_NAMES[build.weaponStyle] ?? { name: 'Fists', icon: '👊' };
            equipped = [
              { slot: 'weapon', name: wpn.name, icon: wpn.icon },
              { slot: 'armor', name: 'Sailor\'s Garb', icon: '🛡' },
            ];
          } else {
            const saved = localStorage.getItem('tethical_captain');
            if (saved) {
              const data = JSON.parse(saved);
              fallback = {
                name: data.name || 'Captain',
                race: (data.race || 'human') as Race,
                className: data.characterClass || 'Warlord',
                level: 5,
              };
            }
          }
        } catch {}
        const override = buildHudOverride({
          hp: { current: sailingState.playerHealth, max: sailingState.playerMaxHealth },
          fallback,
        });
        if (equipped) override.equipped = equipped;
        return (
          <CinzelOverlay
            state={override}
            hideChat
            hideHotbar
          />
        );
      })()}

      {debugPanel && (
        <div className="absolute top-16 left-4 z-10 bg-black/85 backdrop-blur rounded-lg p-4 w-64 space-y-3 pointer-events-auto">
          <div className="text-amber-400 font-serif text-sm border-b border-white/10 pb-1">Debug Controls</div>

          <div>
            <label className="text-xs text-white/60 block mb-1">Storm Intensity: {stormIntensity.toFixed(2)}</label>
            <Slider value={[stormIntensity * 100]} onValueChange={(v) => setStormIntensity(v[0] / 100)} max={100} step={1} className="w-full" data-testid="slider-storm" />
          </div>

          <div>
            <label className="text-xs text-white/60 block mb-1">Wind Direction: {windDirection}°</label>
            <Slider value={[windDirection]} onValueChange={(v) => setWindDirection(v[0])} max={360} step={1} className="w-full" data-testid="slider-wind-dir" />
          </div>

          <div>
            <label className="text-xs text-white/60 block mb-1">Wind Speed: {windStrength} kts</label>
            <Slider value={[windStrength]} onValueChange={(v) => setWindStrength(v[0])} max={40} step={1} className="w-full" data-testid="slider-wind-speed" />
          </div>

          <div>
            <label className="text-xs text-white/60 block mb-1">Wave Height: {waveHeight.toFixed(1)}m</label>
            <Slider value={[waveHeight * 10]} onValueChange={(v) => setWaveHeight(v[0] / 10)} max={50} step={1} className="w-full" data-testid="slider-wave-height" />
          </div>

          <div>
            <label className="text-xs text-white/60 block mb-1">Ship Type</label>
            <select
              value={shipType}
              onChange={(e) => setShipType(e.target.value)}
              className="w-full bg-white/10 text-white text-xs rounded px-2 py-1"
              data-testid="select-ship-type"
            >
              {Object.entries(SHIP_TYPES).map(([key, ship]) => (
                <option key={key} value={key} className="bg-gray-900">
                  {ship.name} (T{ship.tier})
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-white/10 pt-2 space-y-1">
            <div className="text-xs text-white/40">Position: {sailingState.position.x.toFixed(0)}, {sailingState.position.z.toFixed(0)}</div>
            <div className="text-xs text-white/40">Enemies: {sailingState.enemies.length} | Kills: {sailingState.kills}</div>
            <Button onClick={handleUnstick} size="sm" variant="outline" className="w-full text-xs mt-1 border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30" data-testid="button-unstick">
              ⚠ Unstick Ship [X]
            </Button>
            <Button onClick={spawnEnemy} size="sm" variant="outline" className="w-full text-xs border-purple-700/50 text-purple-400 hover:bg-purple-900/30" data-testid="button-spawn-enemy">
              + Spawn Enemy [F]
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function updateShip(state: any, delta: number, elapsed: number) {
  const { keys, ship, shipPhysics, weather, clothSails } = state;
  if (!ship) return;

  const ammos = Object.entries(AMMO_TYPES) as [AmmoType, AmmoConfig][];
  for (const [type, cfg] of ammos) {
    if (keys.has(cfg.key) && !state.ammoKeyLock.has(cfg.key)) {
      state.ammoKeyLock.add(cfg.key);
      state.currentAmmo = type;
    }
  }

  if (keys.has('r') && !state.abilityKeyLock.has('r')) {
    state.abilityKeyLock.add('r');
    activateAbility(state, 'repair');
  }
  if (keys.has('v') && !state.abilityKeyLock.has('v')) {
    state.abilityKeyLock.add('v');
    activateAbility(state, 'fullsail');
  }
  if (keys.has('g') && !state.abilityKeyLock.has('g')) {
    state.abilityKeyLock.add('g');
    activateAbility(state, 'broadside');
  }
  if (keys.has('f') && !state.abilityKeyLock.has('f')) {
    state.abilityKeyLock.add('f');
    if (state.abilityCooldowns.sniperShot <= 0) {
      fireSniperShot(state);
      state.abilityCooldowns.sniperShot = 12;
      spawnAbilityEffect(state, state.shipPosition.clone(), 0xff0000);
    }
  }
  if (keys.has('x') && !state.abilityKeyLock.has('x')) {
    state.abilityKeyLock.add('x');
    const fwd = new THREE.Vector3(Math.sin(state.shipHeading), 0, Math.cos(state.shipHeading));
    state.shipPosition.add(fwd.multiplyScalar(30));
    state.shipPosition.y = BUOYANCY_OFFSET + 1;
    state.shipSpeed = 2;
  }

  for (const key of ['r', 't', 'g', 'f', 'x']) {
    if (!keys.has(key)) state.abilityKeyLock.delete(key);
  }

  for (const ab of Object.keys(state.abilityCooldowns)) {
    if (state.abilityCooldowns[ab] > 0) {
      state.abilityCooldowns[ab] = Math.max(0, state.abilityCooldowns[ab] - delta);
    }
  }
  if (state.fullSailTimer > 0) {
    state.fullSailTimer = Math.max(0, state.fullSailTimer - delta);
  }

  // Suppress sailing movement controls when captain boarding mode is active
  const boardingActive = !!(state as any)._boardingActive;

  const speedFactor = Math.max(0.3, 1.0 - state.shipSpeed * 0.03);
  const turnInput = !boardingActive
    ? (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0)
    : (keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0);
  state.shipHeading += turnInput * TURN_RATE * speedFactor * delta;

  // Q/E spin the sail yard left / right around the mast
  const YARD_SPEED = 1.8;
  const YARD_LIMIT = Math.PI * 0.65;
  if (keys.has('q')) state.sailYardAngle = Math.max(-YARD_LIMIT, state.sailYardAngle - YARD_SPEED * delta);
  if (!boardingActive && keys.has('e')) state.sailYardAngle = Math.min(YARD_LIMIT, state.sailYardAngle + YARD_SPEED * delta);

  // Apply yard rotation to the physical yard/boom meshes (fallback ship)
  if (state.sailYardMesh) state.sailYardMesh.rotation.y = state.sailYardAngle;
  if (state.sailBoomMesh) state.sailBoomMesh.rotation.y = state.sailYardAngle;

  // Apply yard rotation to cloth sail visuals (preserving their base orientations)
  const baseRots: number[] = state.sailBaseRotations || [];
  (clothSails as ClothSail[]).forEach((sail: ClothSail, idx: number) => {
    sail.mesh.rotation.y = (baseRots[idx] ?? 0) + state.sailYardAngle;
  });

  // Derive sailTrim from how well the yard faces the wind:
  // 1.0 = perpendicular to wind (full power), 0.0 = pointing into wind (luffing)
  const relWindAngle = state.sailYardAngle + state.shipHeading - weather.windDirection;
  const windCross = Math.abs(Math.sin(relWindAngle));
  state.sailTrim = Math.max(0.08, Math.min(1.0, windCross));

  const angleToWind = state.shipHeading - weather.windDirection;
  const normalizedAngle = ((angleToWind % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const polarSpeed = calculatePolarSpeed('sloop', THREE.MathUtils.radToDeg(normalizedAngle), weather.windStrength);
  const baseSpeed = (SHIP_TYPES.sloop?.speed || 12) * polarSpeed * state.sailTrim;

  const severityInfo = getWeatherSeverityLevel(weather);
  const fullSailMult = state.fullSailTimer > 0 ? FULL_SAIL_MULTIPLIER : 1.0;
  const effectiveMaxSpeed = Math.max(baseSpeed * severityInfo.speedLimit, 1.0) * fullSailMult;

  const windPushX = Math.cos(weather.windDirection) * weather.windStrength * WIND_PUSH_FACTOR * 0.01;
  const windPushZ = Math.sin(weather.windDirection) * weather.windStrength * WIND_PUSH_FACTOR * 0.01;

  const throttle = !boardingActive && (keys.has('w') || keys.has('arrowup')) ? 1
    : !boardingActive && (keys.has('s') || keys.has('arrowdown')) ? -0.3
    : keys.has('arrowup') ? 1 : keys.has('arrowdown') ? -0.3 : 0;

  const naturalSpeed = Math.max(0, baseSpeed * severityInfo.speedLimit);

  if (throttle > 0) {
    const accelCurve = 1.0 - Math.min(1, state.shipSpeed / Math.max(effectiveMaxSpeed, 0.1)) * 0.7;
    state.shipSpeed = Math.min(
      effectiveMaxSpeed,
      state.shipSpeed + throttle * ACCELERATION * accelCurve * delta
    );
  } else if (throttle < 0) {
    state.shipSpeed = Math.max(-2, state.shipSpeed + throttle * ACCELERATION * delta);
  } else {
    if (state.shipSpeed > naturalSpeed + 0.1) {
      state.shipSpeed -= DECELERATION * delta * 0.5;
    } else if (state.shipSpeed < naturalSpeed - 0.5) {
      state.shipSpeed += ACCELERATION * 0.25 * delta;
    }
    state.shipSpeed = Math.max(0, state.shipSpeed);
  }

  const forward = new THREE.Vector3(
    Math.sin(state.shipHeading),
    0,
    Math.cos(state.shipHeading)
  );

  state.shipVelocity.copy(forward.multiplyScalar(state.shipSpeed));
  state.shipVelocity.x += windPushX * state.sailTrim;
  state.shipVelocity.z += windPushZ * state.sailTrim;
  state.shipPosition.add(state.shipVelocity.clone().multiplyScalar(delta));

  const waveY = calculateWaveHeightAt(state.shipPosition, elapsed, weather);
  const targetY = waveY + BUOYANCY_OFFSET;
  state.smoothedY += (targetY - state.smoothedY) * Math.min(1, 2.5 * delta);
  state.shipPosition.y = state.smoothedY;

  ship.position.copy(state.shipPosition);
  ship.rotation.y = state.shipHeading;

  shipPhysics.update(
    delta,
    weather,
    state.shipPosition,
    state.shipHeading,
    state.shipVelocity,
    state.playerHealth,
    state.playerMaxHealth
  );

  shipPhysics.applyMeshTransforms(ship, state.smoothedY);

  for (const sail of clothSails) {
    const windLocal = new THREE.Vector3(
      Math.cos(weather.windDirection - state.shipHeading),
      0,
      Math.sin(weather.windDirection - state.shipHeading)
    );
    // Wind fill: how much the sail faces into the wind
    // Sail normal is +Z in ship-local space; windLocal.z = component along ship's forward
    // Clamp to [0,1] — negative means headwind, zero fill
    const windFill = Math.max(0, Math.min(1, windLocal.z + 0.35));
    sail.material.uniforms.uTime.value = elapsed;
    sail.material.uniforms.uWindStrength.value = weather.windStrength;
    sail.material.uniforms.uWindDirection.value.copy(windLocal);
    sail.material.uniforms.uSailTrim.value = state.sailTrim;
    sail.material.uniforms.uWindFill.value = windFill;
  }

  if (state.portCooldown > 0) state.portCooldown = Math.max(0, state.portCooldown - delta);
  if (state.starboardCooldown > 0) state.starboardCooldown = Math.max(0, state.starboardCooldown - delta);

  // Tick mount cooldowns
  for (const id of Object.keys(state.mountCooldowns)) {
    if (state.mountCooldowns[id] > 0) {
      state.mountCooldowns[id] = Math.max(0, state.mountCooldowns[id] - delta);
    }
  }

  // Space = smart-fire all eligible mounts (aim bearing)
  if (keys.has(' ') && !state.abilityKeyLock.has(' ')) {
    state.abilityKeyLock.add(' ');
    const mounts = getEligibleMounts(state.currentShipId, state.aimBearingDeg ?? 90);
    let fired = false;
    for (const mount of mounts) {
      if ((state.mountCooldowns[mount.id] ?? 0) <= 0) {
        fireCannonMount(state, mount);
        const skill = CANNON_SKILLS[state.currentAmmo as CannonSkillId];
        state.mountCooldowns[mount.id] = (skill?.cooldown ?? 4) * mount.cooldownMultiplier;
        fired = true;
      }
    }
    // Fallback: if no mounts (e.g. raft), fire nearest side
    if (!fired) {
      const relDeg = THREE.MathUtils.radToDeg(state.aimBearingDeg);
      const side = relDeg >= 0 ? 'port' : 'starboard';
      const cd = side === 'port' ? state.portCooldown : state.starboardCooldown;
      if (cd <= 0) fireCannonFromState(state, side);
    }
  }
  if (!keys.has(' ')) state.abilityKeyLock.delete(' ');
  if (keys.has('f') && !boardingActive) {
    keys.delete('f');
    spawnEnemyFromState(state);
  }

  state.windArrow.position.copy(state.shipPosition);
  state.windArrow.position.y = state.shipPosition.y + 15;
}

function activateAbility(state: any, ability: 'repair' | 'fullsail' | 'broadside') {
  if (state.abilityCooldowns[ability] > 0) return;

  if (ability === 'repair') {
    state.playerHealth = Math.min(state.playerMaxHealth, state.playerHealth + 40);
    state.abilityCooldowns.repair = 45;
    spawnAbilityEffect(state, state.shipPosition.clone(), 0x00ff88);
  } else if (ability === 'fullsail') {
    state.fullSailTimer = FULL_SAIL_DURATION;
    state.abilityCooldowns.fullsail = 30;
    spawnAbilityEffect(state, state.shipPosition.clone(), 0xffff00);
  } else if (ability === 'broadside') {
    for (let i = -1; i <= 1; i++) {
      const offset = i * 0.35;
      const portAngle = state.shipHeading + Math.PI / 2;
      const stbdAngle = state.shipHeading - Math.PI / 2;
      fireCannonAtAngle(state, portAngle + offset, 'player');
      fireCannonAtAngle(state, stbdAngle + offset, 'player');
    }
    state.portCooldown = PORT_COOLDOWN_MAX;
    state.starboardCooldown = STARBOARD_COOLDOWN_MAX;
    state.abilityCooldowns.broadside = 20;
    spawnAbilityEffect(state, state.shipPosition.clone(), 0xff4400);
  }
}

function spawnAbilityEffect(state: any, position: THREE.Vector3, color: number) {
  const geo = new THREE.SphereGeometry(3, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, wireframe: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  state.scene.add(mesh);
  let t = 0;
  const animate = () => {
    t += 0.04;
    mesh.scale.setScalar(1 + t * 4);
    mat.opacity = Math.max(0, 0.7 - t * 1.2);
    if (t < 0.6) requestAnimationFrame(animate);
    else {
      state.scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    }
  };
  animate();
}

function fireCannonFromState(state: any, side: 'port' | 'starboard') {
  const angle = state.shipHeading + (side === 'port' ? Math.PI / 2 : -Math.PI / 2);
  fireCannonAtAngle(state, angle, 'player');
  if (side === 'port') {
    state.portCooldown = PORT_COOLDOWN_MAX;
  } else {
    state.starboardCooldown = STARBOARD_COOLDOWN_MAX;
  }
  state.shipPhysics.applyImpact(2, (side === 'port' ? -1 : 1) * Math.PI / 2);
}

function fireCannonMount(state: any, mount: CannonMount) {
  // Convert mount local position to world position using ship heading
  const heading = state.shipHeading;
  const [lpx, lpy, lpz] = mount.localPosition;
  const worldOff = new THREE.Vector3(
    lpx * Math.cos(heading) + lpz * Math.sin(heading),
    lpy,
    -lpx * Math.sin(heading) + lpz * Math.cos(heading)
  );
  const origin = state.shipPosition.clone().add(worldOff);
  origin.y += 3;

  // Fire bearing = ship heading + arc center of mount
  const fireBearing = heading + THREE.MathUtils.degToRad(mount.arcCenter);
  const ammo = AMMO_TYPES[state.currentAmmo as string] || AMMO_TYPES['heavy_ball'];
  const count = ammo.count;
  const spread = ammo.spread;

  const ammoType = state.currentAmmo as CannonSkillId;
  for (let i = 0; i < count; i++) {
    const spreadAngle = count > 1 ? fireBearing + (Math.random() - 0.5) * spread : fireBearing;
    const dir = new THREE.Vector3(Math.sin(spreadAngle), 0.12 + Math.random() * 0.06, Math.cos(spreadAngle));
    dir.normalize().multiplyScalar(ammo.speed);

    const ballGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const ballMat = new THREE.MeshStandardMaterial({
      color: ammo.color, metalness: 0.7, roughness: 0.3,
      emissive: (ammoType === 'fire_bomb' || ammoType === 'explosive_shell')
        ? new THREE.Color(0xff3300) : new THREE.Color(0x000000),
      emissiveIntensity: (ammoType === 'fire_bomb' || ammoType === 'explosive_shell') ? 0.5 : 0,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.copy(origin);
    ball.castShadow = true;
    state.scene.add(ball);

    const pid = nextProjId();
    state.projectiles.push({
      mesh: ball, velocity: dir.clone(), ttl: ammo.ttl,
      owner: 'player', damage: ammo.damage, ammoType,
      projId: pid,
    });
    if (state.cannonballFx) state.cannonballFx.startTrail(pid, ammoType);
  }

  if (state.cannonballFx) {
    state.cannonballFx.createAmmoMuzzleFlash(origin.clone(), ammoType);
  } else {
    createMuzzleFlash(state, origin.clone());
  }
}

function fireCannonAtAngle(state: any, angle: number, owner: 'player' | 'enemy') {
  const ammo = AMMO_TYPES[state.currentAmmo as string] || AMMO_TYPES['heavy_ball'];
  const count = owner === 'enemy' ? 1 : ammo.count;
  const spread = ammo.spread;

  const ammoType = (state.currentAmmo || 'heavy_ball') as CannonSkillId;
  for (let i = 0; i < count; i++) {
    const spreadAngle = count > 1 ? angle + (Math.random() - 0.5) * spread : angle;
    const dir = new THREE.Vector3(Math.sin(spreadAngle), 0.12 + Math.random() * 0.06, Math.cos(spreadAngle));
    dir.normalize().multiplyScalar(ammo.speed);

    const ballGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const ballMat = new THREE.MeshStandardMaterial({
      color: ammo.color,
      metalness: 0.7,
      roughness: 0.3,
      emissive: (ammoType === 'fire_bomb' || ammoType === 'explosive_shell') ? new THREE.Color(0xff3300) : new THREE.Color(0x000000),
      emissiveIntensity: (ammoType === 'fire_bomb' || ammoType === 'explosive_shell') ? 0.5 : 0,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);

    const origin = owner === 'player' ? state.shipPosition.clone() : state.enemies.find((e: any) => e.fireCooldown === 0)?.position?.clone() || state.shipPosition.clone();
    ball.position.copy(origin);
    ball.position.y += 3;
    ball.position.x += Math.sin(angle) * 3;
    ball.position.z += Math.cos(angle) * 3;
    ball.castShadow = true;
    state.scene.add(ball);

    const pid = nextProjId();
    state.projectiles.push({
      mesh: ball,
      velocity: dir.clone(),
      ttl: ammo.ttl,
      owner,
      damage: ammo.damage,
      ammoType,
      projId: pid,
    });
    if (state.cannonballFx) state.cannonballFx.startTrail(pid, ammoType);
  }

  const muzzlePos = new THREE.Vector3(
    state.shipPosition.x + Math.sin(angle) * 4,
    state.shipPosition.y + 3,
    state.shipPosition.z + Math.cos(angle) * 4
  );
  if (state.cannonballFx) {
    state.cannonballFx.createAmmoMuzzleFlash(muzzlePos, ammoType);
  } else {
    createMuzzleFlash(state, muzzlePos);
  }
}

function createMuzzleFlash(state: any, position: THREE.Vector3) {
  const geo = new THREE.SphereGeometry(0.8, 6, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1 });
  const flash = new THREE.Mesh(geo, mat);
  flash.position.copy(position);
  state.scene.add(flash);
  let t = 0;
  const animate = () => {
    t += 0.1;
    mat.opacity = Math.max(0, 1 - t * 3);
    flash.scale.setScalar(1 + t * 2);
    if (t < 0.35) requestAnimationFrame(animate);
    else {
      state.scene.remove(flash);
      geo.dispose();
      mat.dispose();
    }
  };
  animate();
}

function fireSniperShot(state: any) {
  // Find nearest enemy
  let nearest: any = null;
  let nearestDist = Infinity;
  for (let _i = 0; _i < state.enemies.length; _i++) {
    const _e = state.enemies[_i];
    const _d = state.shipPosition.distanceTo(_e.position);
    if (_d < nearestDist) { nearestDist = _d; nearest = _e; }
  }

  const SNIPER_SPEED = 200;
  const SNIPER_DAMAGE = 60;
  const SNIPER_TTL = 4.0;

  // Direction: toward nearest enemy if found, else straight ahead
  let dir: THREE.Vector3;
  if (nearest) {
    dir = new THREE.Vector3(
      nearest.position.x - state.shipPosition.x,
      0,
      nearest.position.z - state.shipPosition.z
    ).normalize();
  } else {
    dir = new THREE.Vector3(Math.sin(state.shipHeading), 0, Math.cos(state.shipHeading));
  }

  const origin = state.shipPosition.clone().add(new THREE.Vector3(0, 8, 0)); // crow's nest height

  const ballGeo = new THREE.SphereGeometry(0.18, 6, 4);
  const ballMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.copy(origin);
  state.scene.add(ball);

  // Red tracer trail glow
  const trailGeo = new THREE.SphereGeometry(0.35, 4, 3);
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4 });
  const trailBall = new THREE.Mesh(trailGeo, trailMat);
  trailBall.position.copy(origin);
  state.scene.add(trailBall);

  state.projectiles.push({
    mesh: ball,
    velocity: dir.clone().multiplyScalar(SNIPER_SPEED),
    ttl: SNIPER_TTL,
    owner: 'player',
    damage: SNIPER_DAMAGE,
    ammoType: 'heavy_ball', // uses heavy_ball hit detection
    isSniper: true,
    trailMesh: trailBall,
  });
}

// Pool of enemy model paths — randomly chosen for visual variety
const ENEMY_SHIP_MODELS = [
  SHIP_MODEL_PATHS.pirateSmall,
  SHIP_MODEL_PATHS.pirateMedium,
  SHIP_MODEL_PATHS.medium,
];
const ENEMY_SAIL_COLORS = [0xcc2222, 0x991111, 0xaa1133];

async function spawnEnemyFromState(state: any) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 60 + Math.random() * 40;
  const pos = new THREE.Vector3(
    state.shipPosition.x + Math.sin(angle) * dist,
    BUOYANCY_OFFSET,
    state.shipPosition.z + Math.cos(angle) * dist
  );

  let enemyMesh: THREE.Object3D;
  const clothSails: ClothSail[] = [];

  // Try to load a GLB ship model for the enemy
  try {
    const modelIdx  = Math.floor(Math.random() * ENEMY_SHIP_MODELS.length);
    const sailColor = ENEMY_SAIL_COLORS[modelIdx % ENEMY_SAIL_COLORS.length];
    const loader    = new GLTFLoader();
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(ENEMY_SHIP_MODELS[modelIdx], resolve, undefined, reject);
    });
    enemyMesh = gltf.scene;
    enemyMesh.scale.setScalar(2.5);
    enemyMesh.castShadow = true;

    // Detect and replace existing sails
    const existingSails: THREE.Mesh[] = [];
    enemyMesh.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const name = (child.name || '').toLowerCase();
        if (name.includes('sail') || name.includes('canvas')) {
          existingSails.push(child);
        }
      }
    });

    if (existingSails.length > 0) {
      for (const oldSail of existingSails) {
        const bbox  = new THREE.Box3().setFromObject(oldSail);
        const size  = bbox.getSize(new THREE.Vector3());
        const sailW = Math.max(size.x, size.z, 2.0);
        const sailH = Math.max(size.y, 2.5);
        const sail  = createClothSail(sailW, sailH, new THREE.Color(sailColor));
        sail.mesh.position.copy(oldSail.position);
        sail.mesh.rotation.copy(oldSail.rotation);
        oldSail.parent?.add(sail.mesh);
        oldSail.visible = false;
        clothSails.push(sail);
      }
    } else {
      // Fallback: attach a single main sail manually
      const mainSail = createClothSail(3.0, 4.0, new THREE.Color(sailColor));
      mainSail.mesh.position.set(0, 5.2, 0);
      enemyMesh.add(mainSail.mesh);
      clothSails.push(mainSail);
    }

    // Apply dark pirate-style textures
    await applyShipTextures(enemyMesh, 'default', 1);

    // Darken the hull to distinguish from player
    enemyMesh.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.color.multiplyScalar(0.65);
      }
    });

  } catch (_err) {
    const root = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a2010, roughness: 0.85, flatShading: true });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a1508, roughness: 0.9, flatShading: true });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.8 });

    const hullShape = new THREE.Shape();
    const hw = 1.2, hl = 3.5;
    hullShape.moveTo(-hw, -hl);
    hullShape.lineTo(-hw, hl * 0.5);
    hullShape.quadraticCurveTo(-hw * 0.6, hl * 0.85, 0, hl + 0.8);
    hullShape.quadraticCurveTo(hw * 0.6, hl * 0.85, hw, hl * 0.5);
    hullShape.lineTo(hw, -hl);
    hullShape.quadraticCurveTo(hw * 0.5, -hl - 0.4, 0, -hl - 0.5);
    hullShape.quadraticCurveTo(-hw * 0.5, -hl - 0.4, -hw, -hl);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.1, bevelSegments: 2 });
    hullGeo.rotateX(-Math.PI / 2);
    hullGeo.translate(0, 0.8, 0);
    const hull = new THREE.Mesh(hullGeo, woodMat);
    hull.castShadow = true;
    root.add(hull);

    const deckShape = new THREE.Shape();
    const dw = hw * 0.85, dl = hl * 0.88;
    deckShape.moveTo(-dw, -dl);
    deckShape.lineTo(-dw, dl * 0.5);
    deckShape.quadraticCurveTo(-dw * 0.6, dl * 0.8, 0, dl + 0.5);
    deckShape.quadraticCurveTo(dw * 0.6, dl * 0.8, dw, dl * 0.5);
    deckShape.lineTo(dw, -dl);
    deckShape.quadraticCurveTo(0, -dl - 0.2, -dw, -dl);
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.08, bevelEnabled: false });
    deckGeo.rotateX(-Math.PI / 2);
    const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.75, flatShading: true }));
    deck.position.y = 1.6;
    deck.castShadow = true;
    root.add(deck);

    const sternGeo = new THREE.BoxGeometry(hw * 1.6, 1.2, 1.0);
    const stern = new THREE.Mesh(sternGeo, darkWood);
    stern.position.set(0, 2.0, -hl + 0.3);
    stern.castShadow = true;
    root.add(stern);

    const bowspritGeo = new THREE.CylinderGeometry(0.04, 0.06, 2.5, 6);
    bowspritGeo.rotateX(-Math.PI * 0.35);
    const bowsprit = new THREE.Mesh(bowspritGeo, darkWood);
    bowsprit.position.set(0, 1.8, hl + 1.0);
    root.add(bowsprit);

    const mastGeo = new THREE.CylinderGeometry(0.07, 0.1, 7, 8);
    const mast = new THREE.Mesh(mastGeo, darkWood);
    mast.position.y = 5.1;
    mast.castShadow = true;
    root.add(mast);

    const yardGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6);
    const yard = new THREE.Mesh(yardGeo, darkWood);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 7.5, 0);
    root.add(yard);

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 6), darkWood);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(0, 3.0, 0);
    root.add(boom);

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 2; i++) {
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6), metalMat);
        cannon.rotation.z = Math.PI / 2 * side;
        cannon.position.set(side * (hw + 0.15), 1.3, -hl * 0.2 + i * 1.8);
        cannon.castShadow = true;
        root.add(cannon);
      }
    }

    const railGeo = new THREE.BoxGeometry(0.04, 0.35, hl * 1.6);
    for (let side = -1; side <= 1; side += 2) {
      const rail = new THREE.Mesh(railGeo, darkWood);
      rail.position.set(side * hw, 1.95, 0);
      root.add(rail);
    }

    const SAIL_CENTER_Y = (7.5 + 3.0) / 2;
    const SAIL_H = 7.5 - 3.0;
    const mainSail = createClothSail(2.8, SAIL_H, new THREE.Color(0xcc2222));
    mainSail.mesh.position.set(0, SAIL_CENTER_Y, 0.2);
    root.add(mainSail.mesh);
    clothSails.push(mainSail);

    enemyMesh = root;
  }

  enemyMesh.position.copy(pos);
  state.scene.add(enemyMesh);

  // Assign first cloth sail as the primary sail for uniform updates
  const primarySail = clothSails[0];

  const enemyPhysics = new ShipPhysics('sloop');
  const maxHp = 80 + (state.waveNumber || 0) * 20;
  state.enemies.push({
    id: ++_enemyIdCounter,
    mesh: enemyMesh,
    physics: enemyPhysics,
    position: pos.clone(),
    heading: Math.random() * Math.PI * 2,
    speed: 3 + Math.random() * 3 + (state.waveNumber || 0) * 0.3,
    health: maxHp,
    maxHealth: maxHp,
    shipType: 'sloop',
    clothSail: primarySail,
    allClothSails: clothSails,
    fireCooldown: ENEMY_FIRE_RATE_BASE * (0.7 + Math.random() * 0.6),
    burning: 0,
    slowed: 0,
  });
}

function updateWaveSpawner(state: any, delta: number) {
  if (state.enemies.length === 0 && state.nextWaveTimer > 0) {
    state.nextWaveTimer -= delta;
    if (state.nextWaveTimer <= 0) {
      state.waveNumber++;
      const count = 1 + Math.floor(state.waveNumber * 1.2);
      for (let i = 0; i < count; i++) {
        spawnEnemyFromState(state);
      }
      state.nextWaveTimer = 999;
    }
  } else if (state.enemies.length === 0 && state.waveNumber > 0) {
    state.nextWaveTimer = 8;
  }
}

function updateProjectiles(state: any, delta: number, elapsed: number) {
  const toRemove: number[] = [];

  for (let i = 0; i < state.projectiles.length; i++) {
    const proj = state.projectiles[i];
    proj.ttl -= delta;

    if (!(proj as any).isSniper) {
      proj.velocity.y -= 9.8 * delta;
    }
    proj.mesh.position.add(proj.velocity.clone().multiplyScalar(delta));

    if ((proj as any).projId && state.cannonballFx) {
      state.cannonballFx.updateTrail((proj as any).projId, proj.mesh.position, proj.velocity);
    }

    // Update sniper trail
    if ((proj as any).trailMesh) {
      (proj as any).trailMesh.position.copy(proj.mesh.position).sub(
        proj.velocity.clone().normalize().multiplyScalar(0.8)
      );
    }

    if (proj.mesh.position.y < -2 || proj.ttl <= 0) {
      if (proj.mesh.position.y < 0.5 && !(proj as any).isSniper) {
        const at = (proj.ammoType || 'heavy_ball') as CannonSkillId;
        if (state.cannonballFx) {
          state.cannonballFx.createSplash(proj.mesh.position.clone(), true, at);
        } else {
          createSplash(state, proj.mesh.position.clone());
        }
      }
      toRemove.push(i);
      continue;
    }

    if (proj.owner === 'player') {
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];
        const dist = proj.mesh.position.distanceTo(enemy.position);
        if (dist < 5) {
          enemy.health -= proj.damage;
          enemy.physics.applyImpact(proj.damage * 0.5, state.shipHeading);
          toRemove.push(i);

          const at = (proj.ammoType || 'heavy_ball') as CannonSkillId;
          if (state.cannonballFx) {
            state.cannonballFx.createSplash(proj.mesh.position.clone(), false, at);
            if (at === 'explosive_shell') {
              state.cannonballFx.createImpactExplosion(proj.mesh.position.clone(), at);
            }
          } else {
            createSplash(state, proj.mesh.position.clone());
          }

          if (proj.ammoType === 'chain_shot') {
            enemy.slowed = 4.0;
          } else if (proj.ammoType === 'fire_bomb') {
            enemy.burning = 5.0;
          }

          if (enemy.health <= 0) {
            killEnemy(state, j);
            state.kills++;
          }
          break;
        }
      }
    } else if (proj.owner === 'enemy') {
      const dist = proj.mesh.position.distanceTo(state.shipPosition);
      if (dist < 5) {
        state.playerHealth -= proj.damage;
        if (state.cannonballFx) {
          state.cannonballFx.createSplash(proj.mesh.position.clone(), false, 'heavy_ball');
        } else {
          createSplash(state, proj.mesh.position.clone());
        }
        shipAudio.playHullHit();
        toRemove.push(i);

        if (state.playerHealth <= 0) {
          state.playerHealth = 0;
          state.gamePhase = 'dead';
        }
      } else if (proj.mesh.position.y < 1) {
        // Splash-down (water impact) before reaching ship
        shipAudio.playWaterHit();
      }
    }
  }

  const seen = new Set<number>();
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    if (seen.has(idx)) continue;
    seen.add(idx);
    if (idx < state.projectiles.length) {
      const p = state.projectiles[idx];
      if ((p as any).projId && state.cannonballFx) {
        state.cannonballFx.endTrail((p as any).projId);
      }
      state.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      if ((p as any).trailMesh) {
        state.scene.remove((p as any).trailMesh);
        (p as any).trailMesh.geometry.dispose();
        ((p as any).trailMesh.material as THREE.Material).dispose();
      }
      state.projectiles.splice(idx, 1);
    }
  }
}

function killEnemy(state: any, index: number) {
  const enemy = state.enemies[index];
  createSplash(state, enemy.position.clone(), 3);
  const sails: ClothSail[] = enemy.allClothSails || (enemy.clothSail ? [enemy.clothSail] : []);
  for (const sail of sails) {
    sail.mesh.geometry.dispose();
    sail.material.dispose();
  }
  state.scene.remove(enemy.mesh);
  state.enemies.splice(index, 1);
}

function createSplash(state: any, position: THREE.Vector3, scale: number = 1) {
  const splashGeo = new THREE.SphereGeometry(1 * scale, 8, 4);
  const splashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
  });
  const splash = new THREE.Mesh(splashGeo, splashMat);
  splash.position.copy(position);
  splash.position.y = 0.5;
  state.scene.add(splash);

  let elapsed = 0;
  const splashAnimate = () => {
    elapsed += 0.016;
    splash.scale.setScalar(1 + elapsed * 3);
    splashMat.opacity = Math.max(0, 0.6 - elapsed);
    if (elapsed < 0.6) {
      requestAnimationFrame(splashAnimate);
    } else {
      state.scene.remove(splash);
      splashGeo.dispose();
      splashMat.dispose();
    }
  };
  splashAnimate();
}

function updateEnemies(state: any, delta: number, elapsed: number) {
  for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
    const enemy = state.enemies[ei];

    if (enemy.burning > 0) {
      enemy.burning = Math.max(0, enemy.burning - delta);
      enemy.health -= BURN_DAMAGE_PER_SEC * delta;
      if (enemy.health <= 0) {
        killEnemy(state, ei);
        state.kills++;
        continue;
      }
    }

    if (enemy.slowed > 0) {
      enemy.slowed = Math.max(0, enemy.slowed - delta);
    }

    const toPlayer = new THREE.Vector3().subVectors(state.shipPosition, enemy.position);
    const distToPlayer = toPlayer.length();

    if (distToPlayer > 20 && distToPlayer < 150) {
      const targetHeading = Math.atan2(toPlayer.x, toPlayer.z);
      let headingDiff = targetHeading - enemy.heading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      enemy.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), TURN_RATE * 0.5 * delta);
    } else if (distToPlayer <= 20) {
      const perpAngle = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI / 2;
      let headingDiff = perpAngle - enemy.heading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      enemy.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), TURN_RATE * 0.3 * delta);
    }

    const speedMult = enemy.slowed > 0 ? SLOW_FACTOR : 1;
    const forward = new THREE.Vector3(Math.sin(enemy.heading), 0, Math.cos(enemy.heading));
    enemy.position.add(forward.multiplyScalar(enemy.speed * speedMult * delta));

    const waveY = calculateWaveHeightAt(enemy.position, elapsed, state.weather);
    enemy.position.y = waveY + BUOYANCY_OFFSET;

    enemy.mesh.position.copy(enemy.position);
    enemy.mesh.rotation.y = enemy.heading;

    const vel = new THREE.Vector3(
      Math.sin(enemy.heading) * enemy.speed,
      0,
      Math.cos(enemy.heading) * enemy.speed
    );
    enemy.physics.update(delta, state.weather, enemy.position, enemy.heading, vel, enemy.health, enemy.maxHealth);
    enemy.physics.applyMeshTransforms(enemy.mesh, enemy.position.y);

    {
      const windLocal = new THREE.Vector3(
        Math.cos(state.weather.windDirection - enemy.heading),
        0,
        Math.sin(state.weather.windDirection - enemy.heading)
      );
      const windFill = Math.max(0, Math.min(1, windLocal.z + 0.35));
      const enemySails: ClothSail[] = enemy.allClothSails || (enemy.clothSail ? [enemy.clothSail] : []);
      for (const sail of enemySails) {
        sail.material.uniforms.uTime.value = elapsed;
        sail.material.uniforms.uWindStrength.value = state.weather.windStrength;
        sail.material.uniforms.uWindDirection.value.copy(windLocal);
        sail.material.uniforms.uSailTrim.value = 0.75;
        sail.material.uniforms.uWindFill.value = windFill;
      }
    }

    enemy.fireCooldown -= delta;
    if (enemy.fireCooldown <= 0 && distToPlayer < CANNON_RANGE && distToPlayer > 8) {
      const fireRate = ENEMY_FIRE_RATE_BASE - (state.waveNumber || 0) * WAVE_ESCALATION;
      enemy.fireCooldown = Math.max(3.0, fireRate) * (0.8 + Math.random() * 0.4);

      const toPlayerAngle = Math.atan2(toPlayer.x, toPlayer.z);
      const headingToPlayer = toPlayerAngle - enemy.heading;
      const normDiff = ((headingToPlayer % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const broadsideAngle = Math.abs(normDiff) > Math.PI / 4 && Math.abs(normDiff) < Math.PI * 3 / 4;

      const savedAmmo = state.currentAmmo;
      state.currentAmmo = 'heavy_ball';

      if (broadsideAngle || distToPlayer < 35) {
        const portAngle = enemy.heading + Math.PI / 2;
        const stbdAngle = enemy.heading - Math.PI / 2;
        const portDist = Math.abs(normDiff - Math.PI / 2);
        const stbdDist = Math.abs(normDiff + Math.PI / 2);
        const fireAngle = portDist < stbdDist ? portAngle : stbdAngle;

        const dir = new THREE.Vector3(Math.sin(fireAngle), 0.15, Math.cos(fireAngle));
        dir.normalize().multiplyScalar(AMMO_TYPES['heavy_ball'].speed * 0.85);

        const ballGeo = new THREE.SphereGeometry(0.25, 6, 6);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 });
        const ball = new THREE.Mesh(ballGeo, ballMat);
        ball.position.copy(enemy.position);
        ball.position.y += 3;
        ball.position.x += Math.sin(fireAngle) * 3;
        ball.position.z += Math.cos(fireAngle) * 3;
        state.scene.add(ball);

        state.projectiles.push({
          mesh: ball,
          velocity: dir.clone(),
          ttl: AMMO_TYPES['heavy_ball'].ttl,
          owner: 'enemy',
          damage: 15 + (state.waveNumber || 0) * 2,
          ammoType: 'heavy_ball',
        });

        createMuzzleFlash(state, ball.position.clone());
      }

      state.currentAmmo = savedAmmo;
    }
  }
}

const _autoFireTmpVec = new THREE.Vector3();
const _autoFireLeadVec = new THREE.Vector3();

function updateAutoFire(state: any, delta: number) {
  if (!(state as any)._autoFireEnabled) return;
  if (state.enemies.length === 0) return;

  let nearestEnemy: any = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = state.shipPosition.distanceTo(enemy.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }

  if (!nearestEnemy || nearestDist > CANNON_RANGE * 1.2) return;

  const dx = nearestEnemy.position.x - state.shipPosition.x;
  const dz = nearestEnemy.position.z - state.shipPosition.z;
  const worldBearing = Math.atan2(dx, dz);
  const relBearing = ((worldBearing - state.shipHeading) * 180 / Math.PI + 540) % 360 - 180;

  const mounts = getEligibleMounts(state.currentShipId, relBearing);
  if (mounts.length === 0) {
    const side = relBearing > 0 ? 'port' : 'starboard';
    const cd = side === 'port' ? state.portCooldown : state.starboardCooldown;
    if (cd <= 0 && nearestDist <= CANNON_RANGE) {
      fireCannonFromState(state, side);
    }
    return;
  }

  for (const mount of mounts) {
    if ((state.mountCooldowns[mount.id] ?? 0) > 0) continue;

    const leadTime = nearestDist / (AMMO_TYPES[state.currentAmmo as string]?.speed || 60);
    const enemyVel = new THREE.Vector3(
      Math.sin(nearestEnemy.heading) * nearestEnemy.speed,
      0,
      Math.cos(nearestEnemy.heading) * nearestEnemy.speed
    );
    _autoFireLeadVec.copy(nearestEnemy.position).add(
      _autoFireTmpVec.copy(enemyVel).multiplyScalar(leadTime * 0.7)
    );

    fireCannonMount(state, mount);
    const skill = CANNON_SKILLS[state.currentAmmo as CannonSkillId];
    state.mountCooldowns[mount.id] = (skill?.cooldown ?? 4) * mount.cooldownMultiplier;
  }
}

const _islandDefenses: Map<string, IslandDefenseSystem> = new Map();

function updateIslandDefenses(state: any, delta: number) {
  if (!state.islandPool) return;

  const shipTarget = {
    id: 'player',
    position: state.shipPosition as THREE.Vector3,
    velocity: state.shipVelocity as THREE.Vector3,
  };

  for (const [islandId, entry] of state.islandPool as Map<string, IslandPoolEntry>) {
    const def = entry.def;
    const dist = state.shipPosition.distanceTo(
      _autoFireTmpVec.set(def.sx, 0, def.sz)
    );

    if (dist < 150 && !_islandDefenses.has(islandId)) {
      const hostileFactions = [0xff4422, 0xcc8833];
      const isHostile = hostileFactions.includes(def.faction);
      if (isHostile) {
        const difficulty = def.sr > 70 ? 3 : def.sr > 50 ? 2 : 1;
        const defenses = createIslandDefenses(
          state.scene,
          new THREE.Vector3(def.sx, 0, def.sz),
          def.sr * 0.7,
          difficulty,
          islandId
        );
        _islandDefenses.set(islandId, defenses);
      }
    }

    if (dist > 250 && _islandDefenses.has(islandId)) {
      _islandDefenses.get(islandId)!.dispose();
      _islandDefenses.delete(islandId);
    }
  }

  for (const [, defenses] of _islandDefenses) {
    const hits = defenses.update(delta, [shipTarget]);
    for (const hit of hits) {
      if (hit.targetId === 'player') {
        state.playerHealth -= hit.damage;
        createSplash(state, hit.position);
        shipAudio.playHullHit();
        if (hit.effects) {
          for (const eff of hit.effects) {
            if (eff.type === 'burn') {
              (state as any)._playerBurning = eff.duration;
              shipAudio.playBurn();
            }
          }
        }
        if (state.playerHealth <= 0) {
          state.playerHealth = 0;
          state.gamePhase = 'dead';
        }
      }
    }
  }
}

function updateSniperScopeCamera(state: any) {
  const { camera, shipPosition } = state;
  if (!camera) return;

  const crowsNestHeight = 12;
  const yaw = (state as any)._sniperScopeYaw || state.shipHeading;
  const pitch = (state as any)._sniperScopePitch || 0;

  camera.position.set(
    shipPosition.x,
    shipPosition.y + crowsNestHeight,
    shipPosition.z
  );

  const lookDist = 100;
  const lookTarget = new THREE.Vector3(
    shipPosition.x + Math.sin(yaw) * lookDist * Math.cos(pitch),
    shipPosition.y + crowsNestHeight + Math.sin(pitch) * lookDist,
    shipPosition.z + Math.cos(yaw) * lookDist * Math.cos(pitch)
  );
  camera.lookAt(lookTarget);
  camera.fov = 20;
  camera.updateProjectionMatrix();

  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const d = shipPosition.distanceTo(enemy.position);
    if (d < nearestDist) nearestDist = d;
  }
  (state as any)._sniperScopeRange = nearestDist < 999 ? Math.round(nearestDist) : 0;
}

function fireSniperScopeShot(state: any) {
  if (state.gamePhase !== 'sailing') return;

  const yaw = (state as any)._sniperScopeYaw || state.shipHeading;
  const pitch = (state as any)._sniperScopePitch || 0;

  const SNIPER_SPEED = 200;
  const SNIPER_DAMAGE = 75;
  const SNIPER_TTL = 5.0;

  const origin = state.shipPosition.clone().add(new THREE.Vector3(0, 12, 0));

  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ).normalize();

  const ballGeo = new THREE.SphereGeometry(0.15, 6, 4);
  const ballMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.copy(origin);
  state.scene.add(ball);

  const trailGeo = new THREE.SphereGeometry(0.3, 4, 3);
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4 });
  const trailBall = new THREE.Mesh(trailGeo, trailMat);
  trailBall.position.copy(origin);
  state.scene.add(trailBall);

  state.projectiles.push({
    mesh: ball,
    velocity: dir.clone().multiplyScalar(SNIPER_SPEED),
    ttl: SNIPER_TTL,
    owner: 'player',
    damage: SNIPER_DAMAGE,
    ammoType: 'heavy_ball',
    isSniper: true,
    trailMesh: trailBall,
  });

  spawnAbilityEffect(state, origin, 0xff2200);
}

function updateCamera(state: any, delta: number) {
  const { camera, shipPosition, shipSpeed } = state;
  if (!camera) return;

  if (camera.fov !== 60) {
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }

  if (!state.camDragging) {
    const targetAngle = state.shipHeading + Math.PI;
    let angleDiff = targetAngle - state.camOrbitAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    state.camOrbitAngle += angleDiff * 1.5 * delta;
  }

  const dist = state.camOrbitDist + shipSpeed * 0.3;
  const pitch = state.camOrbitPitch;

  const camX = shipPosition.x + Math.sin(state.camOrbitAngle) * dist * Math.cos(pitch);
  const camZ = shipPosition.z + Math.cos(state.camOrbitAngle) * dist * Math.cos(pitch);
  const camY = shipPosition.y + dist * Math.sin(pitch) + 3;

  const smoothing = state.camDragging ? 8 : 4;
  camera.position.x += (camX - camera.position.x) * smoothing * delta;
  camera.position.y += (camY - camera.position.y) * smoothing * delta;
  camera.position.z += (camZ - camera.position.z) * smoothing * delta;

  const lookTarget = new THREE.Vector3(shipPosition.x, shipPosition.y + 2, shipPosition.z);
  camera.lookAt(lookTarget);
}

function updateOcean(state: any, elapsed: number) {
  const { ocean, shipPosition } = state;
  // Follow ship smoothly — ocean covers 2000 units so it's always underfoot
  ocean.mesh.position.x = shipPosition.x;
  ocean.mesh.position.z = shipPosition.z;
  // Sync sun direction from light for GGX specular accuracy
  if (state.sunLight) {
    ocean.setSunPosition(state.sunLight.position);
  }
  ocean.update(elapsed);
}

function updateWake(state: any, delta: number) {
  if (!state.wakeParticles || state.shipSpeed < 0.5) return;

  const positions = state.wakeParticles.geometry.attributes.position;
  const arr = positions.array as Float32Array;

  for (let i = 299; i > 0; i--) {
    arr[i * 3] = arr[(i - 1) * 3];
    arr[i * 3 + 1] = arr[(i - 1) * 3 + 1];
    arr[i * 3 + 2] = arr[(i - 1) * 3 + 2];
  }

  const spread = 1.5;
  const behind = -3;
  // Guard against NaN ship pose (early frames before physics init) — a single
  // NaN here propagates through the shift loop and poisons the geometry's
  // bounding sphere, causing scene-wide frustum culling failure (black screen).
  const sx = state.shipPosition.x, sy = state.shipPosition.y, sz = state.shipPosition.z;
  const sh = state.shipHeading;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz) || !Number.isFinite(sh)) {
    return;
  }
  arr[0] = sx - Math.sin(sh) * behind + (Math.random() - 0.5) * spread;
  arr[1] = sy + 0.2;
  arr[2] = sz - Math.cos(sh) * behind + (Math.random() - 0.5) * spread;

  positions.needsUpdate = true;
}

function updateWindStreaks(state: any, delta: number, elapsed: number) {
  const ws = state.windStreaks;
  if (!ws) return;

  const {
    positions, speeds, lateralAmps, streakLengths, curvePhases,
    headX, headZ, headY, count, PPS, lines,
  } = ws;
  const { weather, shipPosition } = state;

  const windX    = Math.cos(weather.windDirection);
  const windZ    = Math.sin(weather.windDirection);
  const perpX    = -windZ;
  const perpZ    =  windX;
  const windSpeed = weather.windStrength * 0.50;
  const STREAK_RANGE = 300;
  const HALF = STREAK_RANGE / 2;
  const STRIDE = PPS + 1;

  for (let i = 0; i < count; i++) {
    const spd = windSpeed * speeds[i] * delta;
    headX[i] += windX * spd;
    headZ[i] += windZ * spd;

    // Gentle vertical drift — streaks rise and fall organically
    headY[i] += Math.sin(elapsed * 0.6 + i * 1.37) * delta * 1.2;
    headY[i]  = Math.max(0.3, Math.min(22, headY[i]));

    // Respawn upwind of ship when out of range
    const relX = headX[i] - shipPosition.x;
    const relZ = headZ[i] - shipPosition.z;
    if (Math.abs(relX) > HALF || Math.abs(relZ) > HALF) {
      // Spawn on the upwind side so streaks always travel toward the camera/ship
      headX[i] = shipPosition.x - windX * HALF * 0.80 + (Math.random() - 0.5) * 120;
      headZ[i] = shipPosition.z - windZ * HALF * 0.80 + (Math.random() - 0.5) * 120;
      headY[i] = 0.5 + Math.random() * 20;
      lateralAmps[i]   = 1.5 + Math.random() * 7.5;    // wispy
      streakLengths[i] = 6.0 + Math.random() * 16.0;   // long
      curvePhases[i]   = Math.random() < 0.5 ? 1 : -1;
    }

    // Time-varying oscillation — the curve wobbles left/right as wind gusts
    const wobble = Math.sin(elapsed * 1.3 + i * 0.91) * 1.2;
    const lat0 = (lateralAmps[i] + wobble) * curvePhases[i];

    // Recompute curved control points with vertical undulation
    const base = i * STRIDE * 3;
    const slen = streakLengths[i];
    for (let p = 0; p < PPS; p++) {
      const t   = p / (PPS - 1);
      const lat = Math.sin(t * Math.PI) * lat0;
      // Vertical undulation: slight sine ripple along the streak length
      const yWave = Math.sin(t * Math.PI * 2 + elapsed * 1.1 + i * 0.6) * 1.1;
      positions[base + p * 3 + 0] = headX[i] + windX * slen * t + perpX * lat;
      positions[base + p * 3 + 1] = headY[i] + yWave;
      positions[base + p * 3 + 2] = headZ[i] + windZ * slen * t + perpZ * lat;
    }
    // NaN separator stays constant
  }

  const mat = lines.material as THREE.LineBasicMaterial;
  const targetOpacity = Math.min(0.18, 0.06 + weather.windStrength * 0.004);
  mat.opacity += (targetOpacity - mat.opacity) * 2.5 * delta;

  lines.geometry.attributes.position.needsUpdate = true;
}

// ── World-map island LOD system ───────────────────────────────────────────────
// Islands are generated on-demand by IslandGenerator when the ship is close.
// LOD thresholds (distance from ship to island center):
//   > SPAWN_DIST  → nothing in scene
//   ≤ SPAWN_DIST  → cheap silhouette placeholder visible
//   ≤ VIS_DIST    → real IslandGenerator mesh fades in, placeholder hides
//   ≤ CLOSE_DIST  → name label at full opacity, props shown

const WORLD_SCALE   = 600 / 4200;  // world coords → sailing coords
const SPAWN_DIST    = 200;          // generate / show placeholder within this distance
const VIS_DIST      = 150;          // switch to full mesh
const CLOSE_DIST    = 50;           // clearly visible / high detail

// MMO-scale island definitions  (sx/sz already in sailing-space units)
const SAILING_ISLANDS = [
  { id: 'waterfall_isle', name: 'Waterfall Isle', sx:    0 * WORLD_SCALE, sz:    0 * WORLD_SCALE, sr: 110, faction: 0xffd700, biome: 'forest',   seed: 1001 },
  { id: 'valheim_port',   name: 'Valheim Port',   sx: -1800 * WORLD_SCALE, sz: -2200 * WORLD_SCALE, sr:  80, faction: 0x4488ff, biome: 'forest',   seed: 1002 },
  { id: 'ravens_perch',   name: "Raven's Perch",  sx: -2200 * WORLD_SCALE, sz: -1600 * WORLD_SCALE, sr:  55, faction: 0x4488ff, biome: 'beach',    seed: 1003 },
  { id: 'berserker_bay',  name: 'Berserker Bay',  sx: -1200 * WORLD_SCALE, sz: -2600 * WORLD_SCALE, sr:  65, faction: 0x4488ff, biome: 'forest',   seed: 1004 },
  { id: 'shadowmere',     name: 'Shadowmere',     sx:  1800 * WORLD_SCALE, sz:  2200 * WORLD_SCALE, sr:  90, faction: 0xff4422, biome: 'volcanic', seed: 1005 },
  { id: 'iron_shelf',     name: 'Iron Shelf',     sx:  2400 * WORLD_SCALE, sz:  1200 * WORLD_SCALE, sr:  60, faction: 0xff4422, biome: 'desert',   seed: 1006 },
  { id: 'elven_canopy',   name: 'Elven Canopy',   sx: -1500 * WORLD_SCALE, sz:  2000 * WORLD_SCALE, sr:  70, faction: 0x44cc88, biome: 'forest',   seed: 1007 },
  { id: 'dwarven_forge',  name: 'Dwarven Forge',  sx:  -800 * WORLD_SCALE, sz:  2800 * WORLD_SCALE, sr:  75, faction: 0x44cc88, biome: 'desert',   seed: 1008 },
  { id: 'pirate_cove',    name: 'Pirate Cove',    sx:   600 * WORLD_SCALE, sz: -2800 * WORLD_SCALE, sr:  50, faction: 0xcc8833, biome: 'tropical', seed: 1009 },
];

type IslandDef = typeof SAILING_ISLANDS[0];

// Minimap markers built from the SAME roster the sailing scene renders, so the
// corner minimap is 100% accurate to what the player actually sails past.
const SAILING_MINIMAP_MARKERS: MinimapMarker[] = SAILING_ISLANDS.map((isle) => ({
  name: isle.name,
  x: isle.sx,
  z: isle.sz,
  color: '#' + (isle.faction >>> 0).toString(16).padStart(6, '0').slice(-6),
  kind: isle.id === 'pirate_cove' ? 'trading' : isle.biome === 'volcanic' ? 'boss' : 'island',
  radius: Math.max(3, isle.sr / 18),
}));

interface IslandPoolEntry {
  def: IslandDef;
  placeholder: THREE.Group;         // always in scene; visible at LOD-1
  generated:   THREE.Group | null;  // IslandGenerator mesh; shown at LOD-2+
  nameSprite:  THREE.Sprite;
  lodLevel: 0 | 1 | 2 | 3;
}

// Module-level generator singleton (creates fallback props if assets not loaded)
const _islandGen = new IslandGenerator();

// ── Build a lightweight silhouette placeholder (no generator cost) ─────────────
function buildIslandPlaceholder(def: IslandDef): THREE.Group {
  const g   = new THREE.Group();
  const sr  = def.sr;
  const sh  = sr * 0.45;          // proportional height

  const biome   = def.biome;
  const isVol   = biome === 'volcanic';
  const capCol  = isVol ? 0x6b2211 : biome === 'tropical' ? 0x3a7a28
                         : biome === 'desert'  ? 0xc4a060
                         : 0x4a6a34;
  const sumCol  = isVol ? 0xff3300 : biome === 'arctic' ? 0xeef4ff : 0x5a8040;

  // Underwater skirt
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(sr * 1.05, sr * 0.70, 28, 14),
    new THREE.MeshLambertMaterial({ color: 0x28221e }),
  );
  skirt.position.set(0, -14, 0);
  g.add(skirt);

  // Base cone
  const base = new THREE.Mesh(
    new THREE.ConeGeometry(sr, sh * 0.5, 12, 1),
    new THREE.MeshLambertMaterial({ color: 0x3a3028 }),
  );
  base.position.y = sh * 0.25;
  g.add(base);

  // Terrain cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(sr * 0.72, sr * 0.92, sh * 0.35, 12, 1),
    new THREE.MeshLambertMaterial({ color: capCol }),
  );
  cap.position.y = sh * 0.52;
  g.add(cap);

  // Summit peak
  const summit = new THREE.Mesh(
    new THREE.ConeGeometry(sr * 0.34, sh * 0.42, 8, 1),
    new THREE.MeshLambertMaterial({ color: sumCol }),
  );
  summit.position.y = sh * 0.9;
  g.add(summit);

  // Faction beacon
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 8, 8),
    new THREE.MeshBasicMaterial({ color: def.faction }),
  );
  beacon.position.set(0, sh * 1.25, 0);
  g.add(beacon);

  return g;
}

// ── Build a canvas-sprite name label ──────────────────────────────────────────
function buildNameSprite(name: string, factionColor: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 72;
  const ctx = canvas.getContext('2d')!;
  const hex  = '#' + factionColor.toString(16).padStart(6, '0');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.roundRect(4, 4, 312, 64, 10); ctx.fill();
  ctx.strokeStyle = hex; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(4, 4, 312, 64, 10); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 160, 44);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }),
  );
  sprite.renderOrder = 999;
  return sprite;
}

// ── Initialise pool: add cheap placeholders to scene now ──────────────────────
function initIslandPool(scene: THREE.Scene, state: any): void {
  for (const def of SAILING_ISLANDS) {
    const placeholder = buildIslandPlaceholder(def);
    placeholder.position.set(def.sx, 0, def.sz);
    placeholder.visible = false;
    scene.add(placeholder);

    const sh         = def.sr * 0.45;
    const nameSprite = buildNameSprite(def.name, def.faction);
    nameSprite.scale.set(36, 9, 1);
    nameSprite.position.set(def.sx, sh * 1.8, def.sz);
    nameSprite.visible = false;
    scene.add(nameSprite);

    const entry: IslandPoolEntry = { def, placeholder, generated: null, nameSprite, lodLevel: 0 };
    state.islandPool.set(def.id, entry);
  }
}

// ── Per-frame LOD update ───────────────────────────────────────────────────────
function updateIslandLOD(state: any, scene: THREE.Scene, _delta: number, elapsed: number): void {
  if (!state.islandPool) return;
  const ship = state.shipPosition as THREE.Vector3;
  const _tmp = new THREE.Vector3();

  for (const [, entry] of state.islandPool as Map<string, IslandPoolEntry>) {
    const { def } = entry;
    _tmp.set(def.sx, 0, def.sz);
    const dist = ship.distanceTo(_tmp);

    // ── Determine LOD level ────────────────────────────────────────────────
    const newLod: 0|1|2|3 =
      dist <= CLOSE_DIST  ? 3 :
      dist <= VIS_DIST    ? 2 :
      dist <= SPAWN_DIST  ? 1 : 0;

    // ── Generate full mesh once when crossing into LOD-2 ──────────────────
    if (newLod >= 2 && !entry.generated) {
      const result = _islandGen.generateIsland({
        seed:     def.seed,
        radius:   def.sr,
        biome:    def.biome,
        position: new THREE.Vector3(def.sx, 0, def.sz),
      } as IslandConfig);

      const grp = new THREE.Group();
      grp.add(result.terrainMesh, result.propMeshes, result.underwaterBase);
      grp.visible = false;
      scene.add(grp);
      entry.generated = grp;
    }

    // ── Apply visibility based on LOD ─────────────────────────────────────
    entry.placeholder.visible = (newLod === 1);
    if (entry.generated)   entry.generated.visible   = (newLod >= 2);

    // Name label: visible when in range, scale with LOD
    entry.nameSprite.visible = (newLod >= 1);
    if (newLod >= 1) {
      const labelScale = newLod >= 2 ? 36 : 24;
      entry.nameSprite.scale.setX(labelScale);
      // Gently pulse the beacon tint (optional eye-candy)
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 1.8);
      entry.placeholder.traverse(c => {
        if ((c as THREE.Mesh).isMesh) {
          const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
          if (mat.type === 'MeshBasicMaterial') mat.opacity = pulse;
        }
      });
    }

    entry.lodLevel = newLod;
  }
}
