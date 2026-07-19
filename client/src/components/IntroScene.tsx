import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Button } from '@/components/ui/button';
import { SkipForward, Volume2, VolumeX } from 'lucide-react';
import { oceanVertexShader, oceanFragmentShader } from '@/lib/oceanShader';
import VideoOverlayLayer from '@/components/VideoOverlayLayer';
import { getStormAudio, disposeStormAudio } from '@/lib/proceduralAudio';
import { applyShipTextures } from '@/lib/shipPrefabs';
import { ClothSimulation, WindForce } from '@/lib/clothPhysics';
import { StonewispController } from '@/lib/stonewisp/StonewispController';
import { getMonsterAudio } from '@/lib/monsterAudio';

/** Production hero mesh — CDN GRUDGE6 (same as Warlords / Character Studio). */
const HERO_GLB_CANDIDATES = [
  'https://assets.grudge-studio.com/models/heroes/grudge6/western-kingdoms_warrior.glb',
  'https://assets.grudge-studio.com/models/heroes/grudge6/orcs_warrior.glb',
  '/models/characters/meshy_character.glb',
  '/animations/base/animated-base-character.glb',
];

interface IntroSceneProps {
  onComplete: () => void;
  heroName?: string;
  /** Optional race hint for hero model (human|orc|elf|dwarf|barbarian|undead) */
  heroRace?: string;
  debugMode?: boolean;
}

const INTRO_DURATION = 58000; // Total intro: 5s video + extended dramatic ending with zoom
const VIDEO_INTRO_DURATION = 5000; // 5 second video intro (race-specific)
const DEATH_FLOAT_START = 35000; // When floating body appears (earlier for longer sequence)
const ZOOM_TO_CHARACTER_START = 45000; // Slow zoom into floating character
const SPLASH_SCREEN_START = 53000; // When splash screen begins (later for extended zoom)

const STORY_TEXTS = [
  { time: 5000, text: "The Shattered Seas...", duration: 3000 },
  { time: 8500, text: "Where reality fractures at the edge of the world...", duration: 3500 },
  { time: 12000, text: "A young orc, bound in chains...", duration: 3000 },
  { time: 15500, text: "Destined for slavery at Waterfall Isle...", duration: 3500 },
  { time: 19000, text: "", duration: 1000 },
  { time: 20000, text: "From the depths, IT rises...", duration: 2500 },
  { time: 23000, text: "The Stonewisp... ancient terror of the deep...", duration: 3000 },
  { time: 26500, text: "Into the abyss...", duration: 2500 },
  { time: 29500, text: "", duration: 2500 }, // Underwater descent
  { time: 32000, text: "Fate has other plans...", duration: 3000 },
  { time: 35000, text: "", duration: 10000 }, // Extended death float - silent, wide shot
  { time: 45000, text: "", duration: 8000 }, // Zoom into character - silent, intimate
];

export default function IntroScene({
  onComplete,
  heroName = "Rac'al'vin Gruda",
  heroRace = 'human',
  debugMode = false,
}: IntroSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const animationRef = useRef<number>(0);
  
  const [currentText, setCurrentText] = useState('');
  const [isTitle, setIsTitle] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [lightningFlash, setLightningFlash] = useState(0);
  const [showSkip, setShowSkip] = useState(false);
  const [showVideoIntro, setShowVideoIntro] = useState(true);
  const [showDebug, setShowDebug] = useState(debugMode);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [enableVideoOverlays, setEnableVideoOverlays] = useState(true);
  const [overlayStatus, setOverlayStatus] = useState('');
  
  // GIF overlay states for cinematic transitions
  const [gifOverlayPhase, setGifOverlayPhase] = useState<'none' | 'transition' | 'underwater' | 'zoomout'>('none');
  const [gifOverlayOpacity, setGifOverlayOpacity] = useState(0);
  
  // Launch from wreck video overlay state (plays during ship destruction before going underwater)
  const [launchVideoOpacity, setLaunchVideoOpacity] = useState(0);
  const launchVideoRef = useRef<HTMLVideoElement | null>(null);
  const launchVideoStartedRef = useRef(false);
  
  // Debug info state
  const [debugInfo, setDebugInfo] = useState({
    stoneWispLoaded: false,
    currentAnimation: 'none',
    animationTime: 0,
    stoneWispPosition: { x: 0, y: 0, z: 0 },
    phase: 'video',
    mixerActive: false,
  });
  
  // Use refs for animation values that shouldn't trigger re-renders
  const underwaterPhaseRef = useRef(false);
  const fadeToBlackRef = useRef(0);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const currentAnimationRef = useRef('none');
  
  const stoneWispRef = useRef<THREE.Group | null>(null);
  const stoneWispMixerRef = useRef<THREE.AnimationMixer | null>(null);
  /** Improved fight + tentacle tip IK controller */
  const stoneWispCtrlRef = useRef<StonewispController | null>(null);
  const crushedKingRef = useRef<THREE.Group | null>(null);
  const crushedKingMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const shipRef = useRef<THREE.Group | null>(null);
  const oceanRef = useRef<THREE.Mesh | null>(null);
  const shipLightRef = useRef<THREE.PointLight | null>(null);
  const waterfallIslandRef = useRef<THREE.Group | null>(null);
  const skyMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rainRef = useRef<THREE.Points | null>(null);
  const rainVelocitiesRef = useRef<Float32Array | null>(null);
  const bubblesRef = useRef<THREE.Points | null>(null);
  const fallingCrewRef = useRef<THREE.Group | null>(null);
  const startTimeRef = useRef(0);
  const lightningTimerRef = useRef(0);
  
  // Ship destruction enhancement refs
  const woodDebrisRef = useRef<THREE.Group | null>(null);
  const debrisModelsRef = useRef<THREE.Object3D[]>([]);
  const sailMeshRef = useRef<THREE.Mesh | null>(null);
  const mastMeshRef = useRef<THREE.Object3D | null>(null);
  const brokenMastRef = useRef<THREE.Group | null>(null);
  const mastBrokenRef = useRef(false);
  const sailTornRef = useRef(0); // 0-1 tear progress
  const sailOriginalPositionsRef = useRef<Float32Array | null>(null);
  const clothSimRef = useRef<ClothSimulation | null>(null);
  const sailGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const hullMeshesRef = useRef<THREE.Mesh[]>([]);
  const hullDamageProgressRef = useRef(0);
  const floatingBodyRef = useRef<THREE.Group | null>(null);
  const floatingBodyMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const shipwreckRef = useRef<THREE.Group | null>(null);
  const deathFloatStartedRef = useRef(false);
  const waveEscapeProgressRef = useRef(0);
  const characterStartPosRef = useRef(new THREE.Vector3(0, -5, 30)); // Near shipwreck
  const characterEscapePosRef = useRef(new THREE.Vector3(-60, 2, -40)); // Far from danger
  const [showSplashScreen, setShowSplashScreen] = useState(false);
  const [splashOpacity, setSplashOpacity] = useState(0);
  const activeDebrisRef = useRef<Array<{
    mesh: THREE.Object3D;
    velocity: THREE.Vector3;
    angularVel: THREE.Vector3;
    startTime: number;
  }>>([]);
  const stormAudioRef = useRef(getStormAudio());
  const audioStartedRef = useRef(false);

  // Cinematic polish — light refs for per-frame animation
  const moonLightRef = useRef<THREE.DirectionalLight | null>(null);
  const stormLightRef = useRef<THREE.PointLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const krakenSpotlightRef = useRef<THREE.SpotLight | null>(null);
  const underwaterLightRef = useRef<THREE.PointLight | null>(null);
  const dangerLightRef = useRef<THREE.PointLight | null>(null);
  
  const krakenSound1Ref = useRef<HTMLAudioElement | null>(null);
  const krakenSound2Ref = useRef<HTMLAudioElement | null>(null);
  const krakenSound1PlayedRef = useRef(false);
  const krakenSound2PlayedRef = useRef(false);
  const monsterAudioRef = useRef(getMonsterAudio());
  const deckCrewRef = useRef<THREE.Group | null>(null);
  const heroOnDeckRef = useRef<THREE.Group | null>(null);
  const camLookSmoothed = useRef(new THREE.Vector3(0, 8, 0));
  const camPosSmoothed = useRef(new THREE.Vector3(0, 10, 100));
  const shipBreakTriggeredRef = useRef(false);
  const shipBreakVelRef = useRef(new THREE.Vector3());
  const shipBreakAngRef = useRef(new THREE.Vector3());

  // Enhanced chaotic ocean shader with FBM noise + Gerstner waves hybrid
  // Creates organic, unpredictable wave patterns that don't look mathematically obvious
  const createOceanMaterial = useCallback(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaveHeight: { value: 4.0 },
        uDeepColor: { value: new THREE.Color(0x0a2535) },      // Slightly lighter deep ocean
        uMidColor: { value: new THREE.Color(0x1a5575) },       // Brighter mid-depth turquoise
        uShallowColor: { value: new THREE.Color(0x4090b0) },   // Much brighter shallow areas
        uFoamColor: { value: new THREE.Color(0xd8f0ff) },      // Bright white-blue foam
        uSSSColor: { value: new THREE.Color(0x6ab8d8) },       // Brighter SSS tint for see-through effect
        uStormIntensity: { value: 0.0 },
        uLightningFlash: { value: 0.0 },
        uUnderwaterFade: { value: 0.0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWaveHeight;
        uniform float uStormIntensity;
        
        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying float vFoamFactor;
        varying float vChaosFactor;
        
        // Simplex noise functions for organic chaos
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        // Fractal Brownian Motion for chaotic organic waves
        float fbm(vec2 p, float time) {
          float value = 0.0;
          float amplitude = 0.6;
          float frequency = 1.0;
          vec2 offset = vec2(time * 0.15, time * 0.08);
          for (int i = 0; i < 6; i++) {
            value += amplitude * snoise(p * frequency + offset);
            amplitude *= 0.52;
            frequency *= 1.93;
            offset += vec2(0.37, 0.21);
          }
          return value;
        }
        
        // Gerstner wave for primary structure
        vec3 gerstnerWave(vec2 pos, float wavelength, float steepness, vec2 dir, float time) {
          float k = 6.28318 / wavelength;
          float c = sqrt(9.8 / k);
          float a = steepness / k;
          vec2 d = normalize(dir);
          float f = k * (dot(d, pos) - c * time);
          return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
        }
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          float storm = 1.0 + uStormIntensity * 2.0;
          
          // HYBRID APPROACH: Gerstner for macro waves + FBM for chaos
          // Layer 1: Large swells (Gerstner)
          vec3 wave1 = gerstnerWave(pos.xz, 85.0 * storm, 0.18, vec2(1.0, 0.3), uTime * 0.45);
          vec3 wave2 = gerstnerWave(pos.xz, 55.0 * storm, 0.14, vec2(-0.5, 0.9), uTime * 0.6);
          
          // Layer 2: Medium waves with randomized directions
          vec3 wave3 = gerstnerWave(pos.xz, 30.0 * storm, 0.09, vec2(0.7, -0.7), uTime * 0.9);
          vec3 wave4 = gerstnerWave(pos.xz, 18.0 * storm, 0.05, vec2(-0.85, 0.35), uTime * 1.4);
          
          // Layer 3: Chaotic FBM displacement - makes waves unpredictable
          float chaos1 = fbm(pos.xz * 0.012 + uTime * 0.1, uTime * 0.3) * storm;
          float chaos2 = fbm(pos.xz * 0.025 - uTime * 0.15, uTime * 0.5) * storm * 0.6;
          float chaos3 = fbm(pos.xz * 0.05 + vec2(uTime * 0.2, -uTime * 0.1), uTime * 0.8) * storm * 0.3;
          
          // Combine all wave systems
          vec3 totalWave = wave1 + wave2 + wave3 + wave4;
          float chaoticHeight = (chaos1 + chaos2 + chaos3) * 1.5;
          
          // Horizontal displacement from waves + chaos
          pos.xz += totalWave.xz * 0.4;
          pos.xz += vec2(chaos1, chaos2) * 0.3 * storm;
          
          // Vertical displacement with chaotic modulation
          pos.y += totalWave.y * uWaveHeight;
          pos.y += chaoticHeight * uWaveHeight * 0.5;
          
          vElevation = pos.y;
          vChaosFactor = abs(chaos1 + chaos2);
          
          // Dynamic foam based on wave interference + chaos peaks
          float wavePeak = (wave1.y + wave2.y + chaos1 * 0.3) / 2.5;
          vFoamFactor = smoothstep(0.5, 1.0, wavePeak) + smoothstep(0.6, 1.0, chaos3 + 0.3) * 0.4;
          vFoamFactor += smoothstep(0.7, 1.0, abs(chaos1 - chaos2)) * 0.3;
          
          // Improved normal calculation from combined displacement
          vec3 tangent = vec3(1.0 + totalWave.x * 0.6 + chaos1 * 0.2, totalWave.y * 0.4, totalWave.z * 0.6);
          vec3 bitangent = vec3(totalWave.x * 0.6, totalWave.y * 0.4 + chaos2 * 0.15, 1.0 + totalWave.z * 0.6);
          vWorldNormal = normalize(cross(bitangent, tangent));
          
          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uDeepColor;
        uniform vec3 uMidColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSSSColor;
        uniform float uStormIntensity;
        uniform float uLightningFlash;
        uniform float uUnderwaterFade;
        
        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying float vFoamFactor;
        varying float vChaosFactor;
        
        void main() {
          // Enhanced depth-based coloring with more vibrant transitions
          float depthT = smoothstep(-5.0, 5.0, vElevation);
          vec3 baseColor = mix(uDeepColor, uMidColor, smoothstep(0.0, 0.35, depthT));
          baseColor = mix(baseColor, uShallowColor, smoothstep(0.35, 0.85, depthT));
          
          // Chaos-based color variation for organic look
          baseColor = mix(baseColor, baseColor * 1.15, vChaosFactor * 0.3);
          
          // Enhanced fresnel with chaos variation
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(vWorldNormal, viewDir), 0.0), 2.5);
          fresnel = fresnel * (1.0 + vChaosFactor * 0.2);
          
          // Rich subsurface scattering
          float sss = smoothstep(0.4, 1.0, depthT) * fresnel * 0.7;
          baseColor = mix(baseColor, uSSSColor, sss);
          
          // Dynamic foam with chaos influence
          float foam = vFoamFactor * (0.6 + fresnel * 0.4);
          foam = smoothstep(0.15, 0.75, foam);
          baseColor = mix(baseColor, uFoamColor, foam * 0.8);
          
          // Dramatic rim lighting
          float rim = pow(fresnel, 1.8) * 0.35;
          baseColor += vec3(rim * 0.5, rim * 0.6, rim * 0.8);
          
          // Subtle storm influence (less darkening for brighter scene)
          float stormDarken = uStormIntensity * 0.15;
          baseColor = mix(baseColor, vec3(0.04, 0.08, 0.12), stormDarken);
          
          // Lightning flash illumination
          baseColor += vec3(0.4, 0.45, 0.5) * uLightningFlash * 0.9;
          
          // Underwater fade to deep blue
          vec3 underwaterColor = vec3(0.02, 0.08, 0.15);
          baseColor = mix(baseColor, underwaterColor, uUnderwaterFade);
          
          gl_FragColor = vec4(baseColor, 0.97);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  const createLightningBolt = useCallback((scene: THREE.Scene, start: THREE.Vector3, end: THREE.Vector3, intensity: number = 1.0) => {
    const points: THREE.Vector3[] = [start.clone()];
    const segments = 10;
    const direction = end.clone().sub(start);
    
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const point = start.clone().add(direction.clone().multiplyScalar(t));
      point.x += (Math.random() - 0.5) * 30 * intensity;
      point.z += (Math.random() - 0.5) * 30 * intensity;
      points.push(point);
    }
    points.push(end.clone());
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      linewidth: 4,
      transparent: true,
      opacity: 1.0
    });
    
    const lightning = new THREE.Line(geometry, material);
    scene.add(lightning);
    
    for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
      const branchStart = points[Math.floor(Math.random() * (points.length - 2)) + 1];
      const branchEnd = branchStart.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          -Math.random() * 30 - 15,
          (Math.random() - 0.5) * 50
        )
      );
      
      const branchPoints = [branchStart.clone()];
      for (let j = 0; j < 4; j++) {
        const t = (j + 1) / 5;
        const p = branchStart.clone().lerp(branchEnd, t);
        p.x += (Math.random() - 0.5) * 15;
        branchPoints.push(p);
      }
      branchPoints.push(branchEnd);
      
      const branchGeom = new THREE.BufferGeometry().setFromPoints(branchPoints);
      const branchMat = material.clone();
      branchMat.opacity = 0.7;
      const branch = new THREE.Line(branchGeom, branchMat);
      scene.add(branch);
      
      setTimeout(() => {
        scene.remove(branch);
        branchGeom.dispose();
        branchMat.dispose();
      }, 180);
    }
    
    setLightningFlash(1.0);
    setTimeout(() => setLightningFlash(0.6), 40);
    setTimeout(() => setLightningFlash(0.3), 80);
    setTimeout(() => setLightningFlash(0.1), 120);
    setTimeout(() => setLightningFlash(0), 180);
    
    setTimeout(() => {
      scene.remove(lightning);
      geometry.dispose();
      material.dispose();
    }, 220);
  }, []);


  useEffect(() => {
    if (!containerRef.current) return;
    
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030810, 0.002);
    sceneRef.current = scene;
    
    // Create dramatic stormy skybox with procedural clouds
    const skyGeometry = new THREE.SphereGeometry(1200, 64, 48);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uZenithColor: { value: new THREE.Color(0x010408) }, // Near black at top
        uHorizonColor: { value: new THREE.Color(0x0a1525) }, // Dark blue-gray horizon
        uStormColor: { value: new THREE.Color(0x1a2540) }, // Storm cloud color
        uLightningFlash: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uStormColor;
        uniform float uLightningFlash;
        
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        
        // Simplex noise function for cloud generation
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for (int i = 0; i < 5; i++) {
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          return value;
        }
        
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float elevation = dir.y;
          
          // Base gradient from zenith to horizon
          float horizonMix = 1.0 - pow(max(elevation, 0.0), 0.5);
          vec3 baseColor = mix(uZenithColor, uHorizonColor, horizonMix);
          
          // Storm clouds with animated movement
          vec3 cloudPos = dir * 2.0 + vec3(uTime * 0.02, 0.0, uTime * 0.015);
          float cloudDensity = fbm(cloudPos * 1.5);
          cloudDensity = smoothstep(-0.2, 0.6, cloudDensity);
          
          // Add rolling cloud layers
          float clouds2 = fbm(cloudPos * 0.8 + vec3(0.0, uTime * 0.01, 0.0));
          cloudDensity = max(cloudDensity, smoothstep(0.0, 0.8, clouds2) * 0.7);
          
          // Darker clouds at the horizon
          cloudDensity *= 1.0 + (1.0 - elevation) * 0.5;
          
          // Mix storm clouds with base sky
          vec3 color = mix(baseColor, uStormColor, cloudDensity * 0.8);
          
          // Add subtle cloud highlights
          float highlights = snoise(cloudPos * 4.0 + uTime * 0.1) * 0.5 + 0.5;
          color += vec3(0.02, 0.03, 0.05) * highlights * cloudDensity;
          
          // Lightning flash illumination
          color += uLightningFlash * vec3(0.6, 0.65, 0.8) * (1.0 + cloudDensity);
          
          // Ethereal glow at the horizon (waterfall in the distance)
          float horizonGlow = pow(1.0 - abs(elevation), 8.0);
          color += vec3(0.05, 0.08, 0.15) * horizonGlow * 0.5;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    skyMaterialRef.current = skyMaterial;
    
    const camera = new THREE.PerspectiveCamera(
      65,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      3000
    );
    camera.position.set(0, 10, 100);
    cameraRef.current = camera;
    
    // Create canvas with WebGL2 context for better performance and features
    const canvas = document.createElement('canvas');
    let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
    
    // Try WebGL2 first (better performance, wider feature set)
    gl = canvas.getContext('webgl2', { 
      antialias: true, 
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    });
    
    // Fallback to WebGL1 if WebGL2 not available
    if (!gl) {
      gl = canvas.getContext('webgl', { 
        antialias: true, 
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
    }
    
    if (!gl) {
      console.warn('WebGL not available, skipping intro cinematic');
      setTimeout(() => onComplete(), 1000);
      return;
    }
    
    console.log('Using WebGL version:', gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1');
    
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        canvas,
        context: gl,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
    } catch (error) {
      console.warn('WebGL renderer creation failed, skipping intro cinematic:', error);
      setTimeout(() => onComplete(), 1000);
      return;
    }
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    // Cap DPR slightly lower for smoother frame pacing on mid GPUs
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Enhanced lighting for brighter, more dramatic scene
    const ambientLight = new THREE.AmbientLight(0x2a3a4a, 0.5); // Brighter ambient
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;
    
    const moonLight = new THREE.DirectionalLight(0x6688cc, 0.8); // Brighter moon
    moonLight.position.set(100, 300, 100);
    scene.add(moonLight);
    moonLightRef.current = moonLight;
    
    const stormLight = new THREE.PointLight(0x4477bb, 1.2, 1000); // Brighter storm light
    stormLight.position.set(0, 180, -150);
    scene.add(stormLight);
    stormLightRef.current = stormLight;
    
    // Secondary fill light from front
    const frontFill = new THREE.DirectionalLight(0x557799, 0.4);
    frontFill.position.set(0, 50, 150);
    scene.add(frontFill);
    
    // Rim light for beast visibility
    const rimLight = new THREE.PointLight(0x88aacc, 0.8, 400);
    rimLight.position.set(-80, 30, 100);
    scene.add(rimLight);
    
    const shipMastLight = new THREE.PointLight(0xffaa55, 4.0, 250); // Brighter ship light
    shipMastLight.position.set(0, 40, 0);
    scene.add(shipMastLight);
    shipLightRef.current = shipMastLight;
    
    const krakenSpotlight = new THREE.SpotLight(0xffdd88, 3.5, 350, Math.PI / 4, 0.5, 1);
    krakenSpotlight.position.set(0, 60, 0);
    krakenSpotlight.target.position.set(0, 0, 80);
    scene.add(krakenSpotlight);
    scene.add(krakenSpotlight.target);
    krakenSpotlightRef.current = krakenSpotlight;

    // Cinematic polish — danger rim light grows in during kraken attack
    const dangerLight = new THREE.PointLight(0xff3322, 0.0, 600);
    dangerLight.position.set(40, 35, 80);
    scene.add(dangerLight);
    dangerLightRef.current = dangerLight;
    
    // Underwater light for descent phase
    const underwaterLight = new THREE.PointLight(0x2288aa, 0.0, 300);
    underwaterLight.position.set(0, -50, 0);
    underwaterLightRef.current = underwaterLight;
    scene.add(underwaterLight);
    
    const oceanGeometry = new THREE.PlaneGeometry(1500, 1500, 192, 192);
    oceanGeometry.rotateX(-Math.PI / 2);
    const oceanMaterial = createOceanMaterial();
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.position.y = 0;
    scene.add(ocean);
    oceanRef.current = ocean;
    
    // Create stylized rain using line segments for elongated streaks (not pixelated points)
    const rainCount = 8000; // Fewer but more visible streaks
    const rainGeometry = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 6); // 2 vertices per line (start & end)
    const rainVelocities = new Float32Array(rainCount);
    
    const streakLength = 3.5; // Length of each rain streak
    const windAngle = 0.15; // Slight wind angle
    
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * 500;
      const y = Math.random() * 180;
      const z = (Math.random() - 0.5) * 500;
      const speed = 2.0 + Math.random() * 2.0;
      
      // Start point
      rainPositions[i * 6] = x;
      rainPositions[i * 6 + 1] = y;
      rainPositions[i * 6 + 2] = z;
      // End point (streak going down with slight wind)
      rainPositions[i * 6 + 3] = x + windAngle * streakLength;
      rainPositions[i * 6 + 4] = y - streakLength;
      rainPositions[i * 6 + 5] = z;
      
      rainVelocities[i] = speed;
    }
    
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    
    // Stylized rain shader material - creates smooth gradient streaks
    const rainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xaaccee) },
        uOpacity: { value: 0.6 },
      },
      vertexShader: `
        varying float vAlpha;
        void main() {
          // Alternate alpha for gradient effect along streak
          vAlpha = mod(float(gl_VertexID), 2.0) == 0.0 ? 1.0 : 0.2;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
    scene.add(rain);
    rainRef.current = rain as unknown as THREE.Points; // Type cast for ref compatibility
    rainVelocitiesRef.current = rainVelocities;
    
    const gltfLoader = new GLTFLoader();
    
    // Load wood debris models for ship destruction
    gltfLoader.load('/models/scenes/wood_debris_extracted/scene.gltf', (gltf) => {
      const debrisScene = gltf.scene;
      debrisScene.visible = false; // Keep hidden, used as template
      scene.add(debrisScene);
      woodDebrisRef.current = debrisScene;
      
      // Extract individual plank meshes as templates
      debrisScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          debrisModelsRef.current.push(mesh);
        }
      });
      console.log(`Loaded ${debrisModelsRef.current.length} wood debris models`);
    }, undefined, (error) => {
      console.log('Wood debris loading error:', error);
    });
    
    gltfLoader.load('/models/ships/ship-pirate-large.glb', async (gltf) => {
      const ship = gltf.scene;
      ship.scale.set(8, 8, 8);
      ship.position.set(0, 3, 0);
      
      // Apply realistic wood, cloth, and metal textures to all ship parts
      await applyShipTextures(ship, 'pirateLarge');
      
      // Helper to detect sail-like geometry (thin vertical planes)
      const isSailLikeGeometry = (mesh: THREE.Mesh): boolean => {
        const geometry = mesh.geometry;
        if (!geometry) return false;
        geometry.computeBoundingBox();
        if (!geometry.boundingBox) return false;
        
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        
        // Sails are thin in one dimension and taller than wide
        const minDim = Math.min(size.x, size.y, size.z);
        const maxDim = Math.max(size.x, size.y, size.z);
        const thinRatio = maxDim / (minDim + 0.001);
        const isVertical = size.y > size.x * 0.5;
        
        return thinRatio > 10 && isVertical && size.y > 0.5;
      };
      
      // Identify sail, mast, and hull meshes for destruction animation
      hullMeshesRef.current = [];
      ship.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const meshName = mesh.name.toLowerCase();
          
          // Identify sail mesh for cloth animation - by name OR by geometry
          const isSailByName = meshName.includes('sail') || meshName.includes('cloth') || meshName.includes('canvas');
          const isSailByGeometry = isSailLikeGeometry(mesh);
          
          if (isSailByName || isSailByGeometry) {
            sailMeshRef.current = mesh;
            // Make sail material cloth-like: double-sided, cloth texture, slightly transparent
            if (mesh.material) {
              const sailMat = mesh.material as THREE.MeshStandardMaterial;
              if (sailMat.isMeshStandardMaterial) {
                sailMat.side = THREE.DoubleSide;
                sailMat.transparent = true;
                sailMat.roughness = 0.95;
                sailMat.metalness = 0;
                // Ensure cream/canvas color for sails (not wood)
                sailMat.color.setHex(0xfffdd0);
              }
            }
            // Store original vertex positions for deformation
            const geo = mesh.geometry as THREE.BufferGeometry;
            const posAttr = geo.getAttribute('position');
            if (posAttr) {
              sailOriginalPositionsRef.current = new Float32Array(posAttr.array);
            }
          }
          
          // Identify mast mesh for breaking animation
          if (meshName.includes('mast') || meshName.includes('pole') || meshName.includes('boom')) {
            mastMeshRef.current = mesh;
          }
          
          // Identify hull meshes for destruction damage (make parts invisible)
          if (meshName.includes('hull') || meshName.includes('plank') || meshName.includes('board') || 
              meshName.includes('side') || meshName.includes('deck') || meshName.includes('rail') ||
              meshName.includes('wood') || meshName.includes('body')) {
            // Make hull material support transparency for damage effect
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat.isMeshStandardMaterial) {
                mat.transparent = true;
                mat.opacity = 1.0;
              }
            }
            hullMeshesRef.current.push(mesh);
          }
        }
      });
      
      // If no hull meshes found by name, collect all non-sail/mast meshes as potential hull parts
      if (hullMeshesRef.current.length === 0) {
        ship.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const meshName = mesh.name.toLowerCase();
            if (!meshName.includes('sail') && !meshName.includes('mast') && !meshName.includes('flag')) {
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.isMeshStandardMaterial) {
                  mat.transparent = true;
                  mat.opacity = 1.0;
                }
              }
              hullMeshesRef.current.push(mesh);
            }
          }
        });
      }
      
      // If no sail found in model, create an animated sail with cloth physics
      if (!sailMeshRef.current) {
        // Create cloth simulation with matching segments
        const sailWidth = 14;
        const sailHeight = 24;
        const segmentsX = 20;
        const segmentsY = 30;
        const clothSim = new ClothSimulation(sailWidth, sailHeight, segmentsX, segmentsY);
        clothSim.pinForGaffRig(); // Pin left, top, bottom edges - trailing edge flows in wind
        clothSimRef.current = clothSim;
        
        const sailGeometry = new THREE.PlaneGeometry(sailWidth, sailHeight, segmentsX, segmentsY);
        sailGeometryRef.current = sailGeometry;
        
        // Create procedural canvas cloth texture with pirate skull symbol
        const createClothTexture = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d')!;
          
          // Base dark canvas color (weathered black)
          ctx.fillStyle = '#0a0808';
          ctx.fillRect(0, 0, 512, 512);
          
          // Draw woven fabric pattern (horizontal and vertical threads)
          const threadSpacing = 3;
          const threadWidth = 1;
          
          // Horizontal threads (weft) - subtle cloth weave
          for (let y = 0; y < 512; y += threadSpacing) {
            const shade = 12 + Math.random() * 8;
            ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
            ctx.fillRect(0, y, 512, threadWidth);
          }
          
          // Vertical threads (warp) - slightly lighter for depth
          for (let x = 0; x < 512; x += threadSpacing) {
            const shade = 15 + Math.random() * 8;
            ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.5)`;
            ctx.fillRect(x, 0, threadWidth, 512);
          }
          
          // Draw pirate skull and crossbones symbol
          const centerX = 256;
          const centerY = 220;
          
          // Skull - white/cream color
          ctx.fillStyle = '#e8dcc8';
          ctx.strokeStyle = '#c4b8a4';
          ctx.lineWidth = 3;
          
          // Skull oval shape
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, 70, 85, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          // Jaw
          ctx.beginPath();
          ctx.ellipse(centerX, centerY + 55, 50, 30, 0, 0, Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Eye sockets - dark
          ctx.fillStyle = '#0a0808';
          ctx.beginPath();
          ctx.ellipse(centerX - 28, centerY - 10, 22, 28, -0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(centerX + 28, centerY - 10, 22, 28, 0.1, 0, Math.PI * 2);
          ctx.fill();
          
          // Nose cavity (triangle)
          ctx.beginPath();
          ctx.moveTo(centerX, centerY + 15);
          ctx.lineTo(centerX - 12, centerY + 40);
          ctx.lineTo(centerX + 12, centerY + 40);
          ctx.closePath();
          ctx.fill();
          
          // Teeth
          ctx.fillStyle = '#d4c8b4';
          for (let i = 0; i < 6; i++) {
            const toothX = centerX - 35 + i * 14;
            ctx.fillRect(toothX, centerY + 60, 10, 18);
          }
          ctx.strokeStyle = '#0a0808';
          ctx.lineWidth = 1;
          for (let i = 0; i < 6; i++) {
            const toothX = centerX - 35 + i * 14;
            ctx.strokeRect(toothX, centerY + 60, 10, 18);
          }
          
          // Crossbones behind skull
          ctx.strokeStyle = '#e8dcc8';
          ctx.lineWidth = 18;
          ctx.lineCap = 'round';
          
          // First bone (top-left to bottom-right)
          ctx.beginPath();
          ctx.moveTo(centerX - 100, centerY - 80);
          ctx.lineTo(centerX + 100, centerY + 120);
          ctx.stroke();
          
          // Second bone (top-right to bottom-left)
          ctx.beginPath();
          ctx.moveTo(centerX + 100, centerY - 80);
          ctx.lineTo(centerX - 100, centerY + 120);
          ctx.stroke();
          
          // Bone ends (knobs)
          ctx.fillStyle = '#e8dcc8';
          const boneEnds = [
            { x: centerX - 100, y: centerY - 80 },
            { x: centerX + 100, y: centerY - 80 },
            { x: centerX - 100, y: centerY + 120 },
            { x: centerX + 100, y: centerY + 120 },
          ];
          boneEnds.forEach(({ x, y }) => {
            ctx.beginPath();
            ctx.arc(x - 8, y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 8, y, 12, 0, Math.PI * 2);
            ctx.fill();
          });
          
          // Add subtle wear/stain patches for realism
          for (let i = 0; i < 12; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const radius = 15 + Math.random() * 30;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(20, 18, 15, 0.2)');
            gradient.addColorStop(1, 'rgba(20, 18, 15, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          }
          
          return new THREE.CanvasTexture(canvas);
        };
        
        // Create normal map for cloth texture depth
        const createClothNormalMap = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d')!;
          
          // Neutral normal map base (pointing up)
          ctx.fillStyle = 'rgb(128, 128, 255)';
          ctx.fillRect(0, 0, 256, 256);
          
          // Add thread pattern normals
          const threadSpacing = 4;
          for (let y = 0; y < 256; y += threadSpacing) {
            // Horizontal thread bumps
            ctx.fillStyle = 'rgb(128, 140, 255)';
            ctx.fillRect(0, y, 256, 1);
            ctx.fillStyle = 'rgb(128, 116, 255)';
            ctx.fillRect(0, y + 1, 256, 1);
          }
          for (let x = 0; x < 256; x += threadSpacing) {
            // Vertical thread bumps
            ctx.fillStyle = 'rgb(140, 128, 255)';
            ctx.fillRect(x, 0, 1, 256);
            ctx.fillStyle = 'rgb(116, 128, 255)';
            ctx.fillRect(x + 1, 0, 1, 256);
          }
          
          return new THREE.CanvasTexture(canvas);
        };
        
        const clothTexture = createClothTexture();
        clothTexture.wrapS = THREE.RepeatWrapping;
        clothTexture.wrapT = THREE.RepeatWrapping;
        clothTexture.repeat.set(3, 4);
        
        const normalMap = createClothNormalMap();
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(3, 4);
        
        const sailMaterial = new THREE.MeshStandardMaterial({
          map: clothTexture,
          normalMap: normalMap,
          normalScale: new THREE.Vector2(0.3, 0.3),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          roughness: 0.85,
          metalness: 0.0,
        });
        
        const sail = new THREE.Mesh(sailGeometry, sailMaterial);
        sail.position.set(0, 3.2, 0);
        sail.rotation.y = Math.PI / 2;
        sail.castShadow = true;
        sail.receiveShadow = true;
        ship.add(sail);
        sailMeshRef.current = sail;
        
        // Store original positions for the custom sail
        const posAttr = sailGeometry.getAttribute('position');
        if (posAttr) {
          sailOriginalPositionsRef.current = new Float32Array(posAttr.array);
        }
      }
      
      scene.add(ship);
      shipRef.current = ship;
      
      if (shipLightRef.current) {
        shipLightRef.current.position.set(0, 45, 5);
      }
    }, undefined, (error) => {
      console.log('Ship loading error, using fallback:', error);
      const fallbackShip = createFallbackShip();
      scene.add(fallbackShip);
      shipRef.current = fallbackShip;
    });
    
    function createFallbackShip() {
      const group = new THREE.Group();
      
      const hullGeometry = new THREE.BoxGeometry(20, 10, 50);
      const hullMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3d2817,
        roughness: 0.8,
        metalness: 0.1
      });
      const hull = new THREE.Mesh(hullGeometry, hullMaterial);
      hull.position.y = 3;
      group.add(hull);
      
      const mastGeometry = new THREE.CylinderGeometry(0.6, 0.8, 40, 8);
      const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
      const mast = new THREE.Mesh(mastGeometry, mastMaterial);
      mast.position.set(0, 25, 0);
      mast.castShadow = true;
      group.add(mast);
      
      // Create cloth texture for fallback sail
      const sailCanvas = document.createElement('canvas');
      sailCanvas.width = 512;
      sailCanvas.height = 512;
      const sailCtx = sailCanvas.getContext('2d')!;
      sailCtx.fillStyle = '#0a0a0a';
      sailCtx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 4) {
        sailCtx.fillStyle = `rgb(${12 + Math.random() * 8}, ${12 + Math.random() * 8}, ${12 + Math.random() * 8})`;
        sailCtx.fillRect(0, y, 512, 2);
      }
      for (let x = 0; x < 512; x += 4) {
        sailCtx.fillStyle = `rgba(${15 + Math.random() * 8}, ${15 + Math.random() * 8}, ${15 + Math.random() * 8}, 0.6)`;
        sailCtx.fillRect(x, 0, 2, 512);
      }
      const sailTexture = new THREE.CanvasTexture(sailCanvas);
      sailTexture.wrapS = THREE.RepeatWrapping;
      sailTexture.wrapT = THREE.RepeatWrapping;
      sailTexture.repeat.set(3, 4);
      
      const sailGeometry = new THREE.PlaneGeometry(16, 28, 20, 20);
      const sailMaterial = new THREE.MeshStandardMaterial({ 
        map: sailTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        roughness: 0.85,
        metalness: 0.0,
      });
      const sail = new THREE.Mesh(sailGeometry, sailMaterial);
      sail.position.set(0, 28, 0);
      sail.rotation.y = Math.PI / 2;
      sail.castShadow = true;
      sail.receiveShadow = true;
      group.add(sail);
      
      return group;
    }
    
    // Hero + deck crew — GRUDGE6 CDN first so the intro shows the player's race
    const raceHeroUrl = (() => {
      const map: Record<string, string> = {
        human: 'https://assets.grudge-studio.com/models/heroes/grudge6/western-kingdoms_warrior.glb',
        orc: 'https://assets.grudge-studio.com/models/heroes/grudge6/orcs_warrior.glb',
        elf: 'https://assets.grudge-studio.com/models/heroes/grudge6/high-elves_ranger.glb',
        dwarf: 'https://assets.grudge-studio.com/models/heroes/grudge6/dwarves_mage.glb',
        barbarian: 'https://assets.grudge-studio.com/models/heroes/grudge6/barbarians_worge.glb',
        undead: 'https://assets.grudge-studio.com/models/heroes/grudge6/undead_worge.glb',
      };
      return map[heroRace.toLowerCase()] ?? map.human;
    })();

    const fitCharacterRoot = (root: THREE.Object3D, targetH = 2.0) => {
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const h = Math.max(size.y, 0.01);
      // cm exports
      let s = targetH / h;
      if (h > 20) s = targetH / (h * 0.01);
      root.scale.multiplyScalar(THREE.MathUtils.clamp(s, 0.002, 8));
      root.updateWorldMatrix(true, true);
      const b2 = new THREE.Box3().setFromObject(root);
      root.position.y -= b2.min.y;
    };

    const styleCharacter = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            const m = mat as THREE.MeshStandardMaterial;
            if (m?.isMeshStandardMaterial) {
              m.roughness = Math.min(0.85, m.roughness ?? 0.7);
              m.metalness = Math.min(0.25, m.metalness ?? 0.05);
              m.emissive = new THREE.Color(0x0a1820);
              m.emissiveIntensity = 0.12;
            }
          }
        }
      });
    };

    const loadHeroGlb = (urls: string[], onOk: (scene: THREE.Group, anims: THREE.AnimationClip[]) => void, onFail: () => void) => {
      let i = 0;
      const tryNext = () => {
        if (i >= urls.length) {
          onFail();
          return;
        }
        const url = urls[i++];
        gltfLoader.load(
          url,
          (gltf) => onOk(gltf.scene as THREE.Group, gltf.animations || []),
          undefined,
          () => tryNext(),
        );
      };
      tryNext();
    };

    // Player hero on deck (visible during storm) + floating body after wreck
    loadHeroGlb([raceHeroUrl, ...HERO_GLB_CANDIDATES], (model, anims) => {
      const hero = model.clone(true);
      fitCharacterRoot(hero, 1.9);
      styleCharacter(hero);
      hero.position.set(-2.5, 0, 4);
      hero.rotation.y = Math.PI * 0.85;
      hero.visible = true;
      // Parent to ship when available
      const attach = () => {
        if (shipRef.current) {
          shipRef.current.add(hero);
          hero.position.set(-2.5, 2.2, 3.5);
        } else {
          scene.add(hero);
          hero.position.set(-2.5, 4, 8);
        }
      };
      attach();
      // re-try attach after ship loads
      setTimeout(attach, 1200);
      heroOnDeckRef.current = hero;

      // Floating body = second instance for wash-up beat
      const floater = model.clone(true);
      fitCharacterRoot(floater, 2.1);
      styleCharacter(floater);
      floater.position.copy(characterStartPosRef.current);
      floater.rotation.x = -Math.PI / 6;
      floater.rotation.y = Math.PI / 4;
      floater.rotation.z = Math.PI / 8;
      floater.visible = false;
      scene.add(floater);
      floatingBodyRef.current = floater;
      if (anims.length > 0) {
        const mixer = new THREE.AnimationMixer(floater);
        floatingBodyMixerRef.current = mixer;
        const floatAnim =
          anims.find((a) => /idle|float|swim|death|injured/i.test(a.name)) || anims[0];
        const action = mixer.clipAction(floatAnim);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.timeScale = 0.35;
        action.play();
      }
      console.log('[Intro] Hero + float body loaded for', heroName);
    }, () => {
      console.warn('[Intro] Hero GLB failed — capsule fallback');
      const bodyGroup = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d6b4f, roughness: 0.7 });
      bodyGroup.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 8, 16), bodyMat));
      bodyGroup.scale.set(2.5, 2.5, 2.5);
      bodyGroup.position.copy(characterStartPosRef.current);
      bodyGroup.visible = false;
      scene.add(bodyGroup);
      floatingBodyRef.current = bodyGroup;
    });

    // Deck crew silhouettes (additional heroes) for cinematic density
    const deckCrew = new THREE.Group();
    deckCrew.name = 'DeckCrew';
    const crewUrls = [
      'https://assets.grudge-studio.com/models/heroes/grudge6/orcs_warrior.glb',
      'https://assets.grudge-studio.com/models/heroes/grudge6/western-kingdoms_warrior.glb',
      'https://assets.grudge-studio.com/models/heroes/grudge6/high-elves_ranger.glb',
    ];
    crewUrls.forEach((url, idx) => {
      gltfLoader.load(url, (gltf) => {
        const c = gltf.scene;
        fitCharacterRoot(c, 1.75);
        styleCharacter(c);
        c.position.set((idx - 1) * 3.2, 2.1, -1.5 + idx * 0.8);
        c.rotation.y = Math.PI * (0.4 + idx * 0.25);
        deckCrew.add(c);
      }, undefined, () => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0x1a2030, emissive: 0x102030, emissiveIntensity: 0.2 }),
        );
        g.add(m);
        g.position.set((idx - 1) * 3.2, 2.6, -1.5);
        deckCrew.add(g);
      });
    });
    scene.add(deckCrew);
    deckCrewRef.current = deckCrew;
    // Parent crew to ship when ready
    setTimeout(() => {
      if (shipRef.current && deckCrewRef.current) {
        shipRef.current.add(deckCrewRef.current);
        deckCrewRef.current.position.set(0, 0, 0);
      }
    }, 1500);
    
    // Load shipwreck model - destroyed ship for monster to attack during zoom out
    const loadShipwreck = () => {
      gltfLoader.load('/models/ships/ship-wreck.glb', (gltf) => {
        const wreck = gltf.scene;
        wreck.scale.set(8, 8, 8); // Large wreck
        wreck.position.set(15, -8, 50); // Behind character, partially submerged
        wreck.rotation.y = -Math.PI / 3; // Angled
        wreck.rotation.z = Math.PI / 5; // Capsizing/sinking
        wreck.rotation.x = 0.15; // Bow up
        wreck.visible = false;
        
        // Enhanced materials for dramatic wreck appearance
        wreck.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat.isMeshStandardMaterial) {
                // Darken and weather the wreck
                mat.roughness = 0.9;
                mat.metalness = 0.1;
                mat.color.multiplyScalar(0.6); // Darker, waterlogged
              }
            }
          }
        });
        
        scene.add(wreck);
        shipwreckRef.current = wreck;
        console.log('Shipwreck loaded');
      }, undefined, (error) => {
        console.warn('Failed to load shipwreck:', error);
      });
    };
    loadShipwreck();
    
    // Stonewisp — controller discovers skeleton/tentacles, Swim→Intimidate, tip IK
    const stoneCtrl = new StonewispController({
      scene,
      scale: 36,
      path: '/models/scenes/stonewisp_beast/scene.gltf',
      onAnalyzed: (report, analysis) => {
        console.info('[IntroScene] Stonewisp analysis\n', report);
        setDebugInfo((prev) => ({
          ...prev,
          stoneWispLoaded: true,
          currentAnimation: analysis.animRoles.swim
            || analysis.animRoles.intimidate
            || analysis.animationNames[0]
            || 'none',
        }));
        setOverlayStatus(
          analysis.tentacleChains.length
            ? `Stonewisp IK: ${analysis.tentacleChains.length} tentacle chains`
            : 'Stonewisp loaded (no tentacle bones by name — check skeleton)',
        );
      },
    });
    stoneWispCtrlRef.current = stoneCtrl;
    void stoneCtrl.load().then((ok) => {
      stoneWispRef.current = stoneCtrl.root;
      stoneWispMixerRef.current = stoneCtrl.mixer;
      if (!ok) {
        setDebugInfo((prev) => ({ ...prev, stoneWispLoaded: true }));
        setOverlayStatus('Stonewisp procedural fallback — place scene.gltf under public/models/scenes/stonewisp_beast/');
      }
    });
    
    // Create falling crew silhouettes (orcs and humans falling into ocean)
    const crewGroup = new THREE.Group();
    const crewMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1520,
      emissive: 0x102030,
      emissiveIntensity: 0.1,
    });
    
    for (let i = 0; i < 8; i++) {
      // Simple humanoid shape (capsule body + sphere head)
      const bodyGeom = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
      const headGeom = new THREE.SphereGeometry(0.25, 8, 8);
      
      const body = new THREE.Mesh(bodyGeom, crewMaterial);
      const head = new THREE.Mesh(headGeom, crewMaterial);
      head.position.y = 0.85;
      
      const crewMember = new THREE.Group();
      crewMember.add(body);
      crewMember.add(head);
      
      // Random starting positions around the ship
      crewMember.position.set(
        (Math.random() - 0.5) * 15,
        20 + Math.random() * 30, // Start above water
        (Math.random() - 0.5) * 20
      );
      // Random tumbling rotation
      crewMember.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      crewMember.userData = {
        fallSpeed: 0.8 + Math.random() * 0.6,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        delay: Math.random() * 3000, // Staggered falling
      };
      crewMember.visible = false; // Hidden until attack phase
      crewGroup.add(crewMember);
    }
    scene.add(crewGroup);
    fallingCrewRef.current = crewGroup;
    
    // Create underwater bubble system
    const bubbleCount = 500;
    const bubbleGeometry = new THREE.BufferGeometry();
    const bubblePositions = new Float32Array(bubbleCount * 3);
    const bubbleSizes = new Float32Array(bubbleCount);
    
    for (let i = 0; i < bubbleCount; i++) {
      bubblePositions[i * 3] = (Math.random() - 0.5) * 100;
      bubblePositions[i * 3 + 1] = -80 - Math.random() * 60; // Deep underwater
      bubblePositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      bubbleSizes[i] = 0.5 + Math.random() * 2;
    }
    
    bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
    bubbleGeometry.setAttribute('size', new THREE.BufferAttribute(bubbleSizes, 1));
    
    const bubbleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x88ccee) },
      },
      vertexShader: `
        attribute float size;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          vec3 pos = position;
          pos.y += uTime * 2.0 + sin(uTime * 2.0 + position.x) * 0.5;
          pos.x += sin(uTime + position.z) * 0.3;
          vAlpha = 0.3 + 0.3 * sin(uTime * 3.0 + position.y);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float alpha = vAlpha * (1.0 - d * 2.0);
          gl_FragColor = vec4(uColor, alpha * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    const bubbles = new THREE.Points(bubbleGeometry, bubbleMaterial);
    bubbles.visible = false; // Hidden until underwater phase
    scene.add(bubbles);
    bubblesRef.current = bubbles;
    
    // Load The Crushed King boss - prominently visible attacking in background
    // Now featured as a dramatic presence from the start
    gltfLoader.load('/crushed_king/scene.gltf', (gltf) => {
      const crushedKing = gltf.scene;
      // Larger scale for dramatic presence - visible attacking
      crushedKing.scale.set(0.25, 0.25, 0.25); // Much larger - 3x previous size
      crushedKing.position.set(-120, -20, -180); // Much closer and higher for visibility
      crushedKing.rotation.y = Math.PI * 0.6; // Facing more toward camera/ship
      
      // Enhanced materials - dark but with visible menacing glow
      crushedKing.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Visible dark coloring with purple/blue emissive glow
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0x1a1528,
            emissive: 0x4422aa,
            emissiveIntensity: 0.5, // Strong emissive glow to be visible
            roughness: 0.7,
            metalness: 0.3,
          });
        }
      });
      
      scene.add(crushedKing);
      crushedKingRef.current = crushedKing;
      
      // Set up animation for the Crushed King
      console.log('Crushed King loaded with animations:', gltf.animations.map(a => a.name));
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(crushedKing);
        crushedKingMixerRef.current = mixer;
        
        // Find attack or threatening animation
        const attackAnim = gltf.animations.find(a => 
          a.name.toLowerCase().includes('attack') || 
          a.name.toLowerCase().includes('intimidate') ||
          a.name.toLowerCase().includes('threat')
        );
        const idleAnim = gltf.animations.find(a => a.name.toLowerCase().includes('idle'));
        const anyAnim = attackAnim || idleAnim || gltf.animations[0];
        
        if (anyAnim) {
          console.log('Playing Crushed King animation:', anyAnim.name);
          const action = mixer.clipAction(anyAnim);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.timeScale = 0.6; // Slow menacing movement
          action.play();
        }
      }
    }, undefined, (error) => {
      console.log('Crushed King loading skipped:', error);
    });
    
    // Waterfall Isle in the distance - the destination
    const waterfallLight = new THREE.PointLight(0x66aaff, 4, 600);
    waterfallLight.position.set(0, 100, -350);
    scene.add(waterfallLight);
    
    // Try to load the real waterfall diorama asset
    gltfLoader.load('/models/scenes/waterfall_diorama/scene.gltf', (gltf) => {
      const waterfallIsland = gltf.scene;
      waterfallIsland.scale.set(15, 15, 15);
      waterfallIsland.position.set(0, -30, -450); // Far in the distance
      waterfallIsland.rotation.y = Math.PI * 0.1;
      
      // Darken the island since it's in the distance during a storm
      waterfallIsland.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.isMeshStandardMaterial) {
              // Add a dark, mysterious look
              mat.color.multiplyScalar(0.4);
              mat.emissive = new THREE.Color(0x112233);
              mat.emissiveIntensity = 0.1;
            }
          }
        }
      });
      
      scene.add(waterfallIsland);
      waterfallIslandRef.current = waterfallIsland;
    }, undefined, () => {
      // Fallback to procedural island if asset fails
      const islandGeometry = new THREE.ConeGeometry(100, 150, 10);
      const islandMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a3a2e,
        roughness: 0.95
      });
      const island = new THREE.Mesh(islandGeometry, islandMaterial);
      island.position.set(0, -50, -350);
      scene.add(island);
      
      const floatingIslandGeometry = new THREE.SphereGeometry(40, 20, 16);
      const floatingIsland = new THREE.Mesh(floatingIslandGeometry, islandMaterial);
      floatingIsland.position.set(0, 130, -350);
      floatingIsland.scale.set(1, 0.5, 1);
      scene.add(floatingIsland);
    });
    
    // Animated waterfall effect (visible even with real island)
    const waterfallGeometry = new THREE.PlaneGeometry(40, 180, 4, 40);
    const waterfallMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x88ccff) }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          // More dramatic waterfall motion
          pos.x += sin(uv.y * 20.0 + uTime * 5.0) * 4.0;
          pos.z += cos(uv.y * 15.0 + uTime * 4.0) * 3.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          // Cascading water effect
          float cascade = sin(vUv.y * 30.0 - uTime * 8.0) * 0.5 + 0.5;
          float mist = sin(vUv.y * 50.0 - uTime * 12.0) * 0.3;
          float alpha = 0.4 + cascade * 0.3;
          
          // Glowing water
          float glow = pow(cascade, 2.0) * 0.5;
          vec3 color = uColor + vec3(glow * 0.4, glow * 0.3, glow * 0.2);
          color += mist * 0.2;
          
          // Fade at edges
          float edge = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);
          alpha *= edge;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const waterfall = new THREE.Mesh(waterfallGeometry, waterfallMaterial);
    waterfall.position.set(0, 70, -440);
    scene.add(waterfall);
    
    // Additional mist particles at the base of the waterfall
    const mistGeometry = new THREE.SphereGeometry(60, 16, 16);
    const mistMaterial = new THREE.MeshStandardMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0.15,
      emissive: 0x4488cc,
      emissiveIntensity: 0.3,
    });
    const mist = new THREE.Mesh(mistGeometry, mistMaterial);
    mist.position.set(0, -10, -440);
    mist.scale.set(1, 0.3, 1);
    scene.add(mist);
    
    startTimeRef.current = Date.now();
    clockRef.current.start();
    
    // Prefer file SFX; fall back to procedural monster audio (CDN files often SPA-404)
    krakenSound1Ref.current = new Audio('/audio/kraen_1768615924100.m4a');
    krakenSound2Ref.current = new Audio('/audio/kraken2_1768615924100.m4a');
    krakenSound1Ref.current.volume = 0.85;
    krakenSound2Ref.current.volume = 1.00;
    krakenSound1Ref.current.preload = 'auto';
    krakenSound2Ref.current.preload = 'auto';
    krakenSound1PlayedRef.current = false;
    krakenSound2PlayedRef.current = false;
    shipBreakTriggeredRef.current = false;
    monsterAudioRef.current.reset();
    monsterAudioRef.current.setMuted(isMuted);
    
    setTimeout(() => setShowSkip(true), 3000);
    setTimeout(() => setShowVideoIntro(false), VIDEO_INTRO_DURATION);
    
    // Track previous frame time for animation mixer
    let lastFrameTime = performance.now();
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // Calculate delta time for animations (independent of clock)
      const currentFrameTime = performance.now();
      const frameDelta = (currentFrameTime - lastFrameTime) / 1000; // Convert to seconds
      lastFrameTime = currentFrameTime;
      
      const elapsed = Date.now() - startTimeRef.current;
      const t = elapsed / INTRO_DURATION;
      const time = clockRef.current.getElapsedTime();
      
      // Update animation mixers EVERY frame with proper delta
      // Mixer + tentacle IK driven by StonewispController (see updateFight below)
      if (stoneWispMixerRef.current && !stoneWispCtrlRef.current) {
        stoneWispMixerRef.current.update(frameDelta);
      }
      if (crushedKingMixerRef.current) {
        crushedKingMixerRef.current.update(frameDelta);
      }
      
      // Update floating character animation mixer
      if (floatingBodyMixerRef.current) {
        floatingBodyMixerRef.current.update(frameDelta);
      }
      
      // Update debug info every 10 frames to avoid performance hit
      if (showDebug && animationRef.current % 10 === 0) {
        const stoneWisp = stoneWispRef.current;
        const adjustedT = elapsed > VIDEO_INTRO_DURATION 
          ? (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION)
          : 0;
        let phase = 'video';
        if (elapsed > VIDEO_INTRO_DURATION) {
          if (adjustedT < 0.15) phase = 'swimming';
          else if (adjustedT < 0.5) phase = 'emergence';
          else if (adjustedT < 0.75) phase = 'attack';
          else phase = 'sinking';
        }
        setDebugInfo({
          stoneWispLoaded: !!stoneWisp,
          currentAnimation: currentAnimationRef.current,
          animationTime: stoneWispMixerRef.current?.time ?? 0,
          stoneWispPosition: stoneWisp 
            ? { x: stoneWisp.position.x, y: stoneWisp.position.y, z: stoneWisp.position.z }
            : { x: 0, y: 0, z: 0 },
          phase,
          mixerActive: !!stoneWispMixerRef.current,
        });
      }
      
      setProgress(Math.min(t * 100, 100));
      setElapsedTime(elapsed); // Track for video overlays
      
      // GIF overlay control - three distinct phases with fade in/out
      // Phase 1: Transition - when video intro ends and 3D ocean starts (5s-8s)
      // Phase 2: Underwater - during underwater descent phase
      // Phase 3: Zoom out - during death float and splash screen
      const adjustedTGif = elapsed > VIDEO_INTRO_DURATION 
        ? (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION)
        : 0;
      
      if (elapsed >= VIDEO_INTRO_DURATION && elapsed < VIDEO_INTRO_DURATION + 3000) {
        // Phase 1: Transition overlay (3 seconds after video intro ends)
        if (gifOverlayPhase !== 'transition') {
          setGifOverlayPhase('transition');
        }
        const transitionProgress = (elapsed - VIDEO_INTRO_DURATION) / 3000;
        // Fade in then fade out
        setGifOverlayOpacity(transitionProgress < 0.5 ? transitionProgress * 1.2 : Math.max(0, 0.6 - (transitionProgress - 0.5) * 1.2));
      } else if (adjustedTGif > 0.85 && adjustedTGif < 0.94) {
        // Phase 2: Underwater overlay during sinking
        if (gifOverlayPhase !== 'underwater') {
          setGifOverlayPhase('underwater');
        }
        const underwaterGifProgress = (adjustedTGif - 0.85) / 0.09;
        // Quick fade in and out
        setGifOverlayOpacity(underwaterGifProgress < 0.5 ? underwaterGifProgress * 1.4 : Math.max(0, 0.7 - (underwaterGifProgress - 0.5) * 1.4));
      } else if (elapsed >= DEATH_FLOAT_START && elapsed < SPLASH_SCREEN_START + 3000) {
        // Phase 3: Zoom out overlay during death float and splash screen
        if (gifOverlayPhase !== 'zoomout') {
          setGifOverlayPhase('zoomout');
        }
        const zoomProgress = Math.min(1, (elapsed - DEATH_FLOAT_START) / 8000);
        // Fade in then gradually fade out
        setGifOverlayOpacity(zoomProgress < 0.2 ? zoomProgress * 2.5 : Math.max(0, 0.5 - (zoomProgress - 0.2) * 0.6));
      } else if (gifOverlayPhase !== 'none') {
        setGifOverlayPhase('none');
        setGifOverlayOpacity(0);
      }
      
      // Launch from wreck video overlay - plays during ship destruction before underwater descent
      // Timing: 23-30 seconds (adjustedT ~0.42-0.58) - right as ship is being destroyed and character is launched
      const LAUNCH_VIDEO_START = 23000 + VIDEO_INTRO_DURATION; // 28s total
      const LAUNCH_VIDEO_DURATION = 7000; // 7 seconds overlay
      
      if (elapsed >= LAUNCH_VIDEO_START && elapsed < LAUNCH_VIDEO_START + LAUNCH_VIDEO_DURATION) {
        // Start video playback if not already started
        if (!launchVideoStartedRef.current && launchVideoRef.current) {
          launchVideoStartedRef.current = true;
          launchVideoRef.current.currentTime = 0;
          launchVideoRef.current.play().catch(e => console.warn('Launch video play failed:', e));
        }
        
        // Fade in/out timing for the overlay
        const launchProgress = (elapsed - LAUNCH_VIDEO_START) / LAUNCH_VIDEO_DURATION;
        // Quick fade in (first 15%), sustain (middle 70%), fade out (last 15%)
        if (launchProgress < 0.15) {
          setLaunchVideoOpacity(launchProgress / 0.15 * 0.7); // Fade in to 70% opacity
        } else if (launchProgress < 0.85) {
          setLaunchVideoOpacity(0.7); // Sustain at 70%
        } else {
          setLaunchVideoOpacity((1 - launchProgress) / 0.15 * 0.7); // Fade out
        }
      } else if (elapsed >= LAUNCH_VIDEO_START + LAUNCH_VIDEO_DURATION && launchVideoStartedRef.current) {
        // End video after duration
        setLaunchVideoOpacity(0);
        if (launchVideoRef.current) {
          launchVideoRef.current.pause();
        }
      } else if (elapsed < LAUNCH_VIDEO_START) {
        // Before start - ensure opacity is 0
        setLaunchVideoOpacity(0);
      }
      
      // Start storm audio when 3D scene begins (after video intro)
      if (elapsed > VIDEO_INTRO_DURATION && !audioStartedRef.current) {
        audioStartedRef.current = true;
        stormAudioRef.current.start();
        if (isMuted) {
          stormAudioRef.current.mute();
        }
        
        if (!krakenSound1PlayedRef.current) {
          krakenSound1PlayedRef.current = true;
          if (krakenSound1Ref.current) {
            krakenSound1Ref.current.muted = isMuted;
            krakenSound1Ref.current.play().catch(() => {
              monsterAudioRef.current.setMuted(isMuted);
              monsterAudioRef.current.playApproach();
            });
          } else {
            monsterAudioRef.current.setMuted(isMuted);
            monsterAudioRef.current.playApproach();
          }
          // Always fire procedural layer so the roar is heard even if m4a is HTML
          monsterAudioRef.current.setMuted(isMuted);
          monsterAudioRef.current.playApproach();
        }
      }
      
      const adjustedTSound = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
      if (adjustedTSound > 0.55 && adjustedTSound < 0.70 && !krakenSound2PlayedRef.current) {
        krakenSound2PlayedRef.current = true;
        if (krakenSound2Ref.current) {
          krakenSound2Ref.current.muted = isMuted;
          krakenSound2Ref.current.play().catch(() => {
            monsterAudioRef.current.setMuted(isMuted);
            monsterAudioRef.current.playStrike();
          });
        }
        monsterAudioRef.current.setMuted(isMuted);
        monsterAudioRef.current.playStrike();
      }
      
      // Update storm intensity based on timeline
      if (elapsed > VIDEO_INTRO_DURATION) {
        const adjustedT = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
        // Storm builds up during sailing, peaks during attack, fades during sinking
        let stormIntensity = 0.3;
        if (adjustedT < 0.55) {
          // Building storm
          stormIntensity = 0.3 + adjustedT * 0.8;
        } else if (adjustedT < 0.75) {
          // Peak storm during attack
          stormIntensity = 0.9 + Math.sin(Date.now() / 200) * 0.1;
        } else {
          // Fading underwater
          stormIntensity = 0.9 - (adjustedT - 0.75) * 2;
        }
        // Cinematic polish — duck during dialog text, deep hush after the sink
        const hasDialog = STORY_TEXTS.some(it =>
          it.text.length > 0 && elapsed >= it.time && elapsed < it.time + it.duration
        );
        if (hasDialog) stormIntensity *= 0.55;
        if (elapsed >= DEATH_FLOAT_START && elapsed < SPLASH_SCREEN_START) {
          stormIntensity = Math.min(stormIntensity, 0.18); // wind-only ambience
        }
        if (elapsed >= SPLASH_SCREEN_START) {
          // Fade storm under the splash for a dignified ending
          const splashProgress = Math.min(1, (elapsed - SPLASH_SCREEN_START) / (INTRO_DURATION - SPLASH_SCREEN_START));
          stormIntensity = Math.max(0, 0.18 * (1 - splashProgress));
        }
        stormAudioRef.current.setIntensity(Math.max(0, Math.min(1, stormIntensity)));
      }
      
      const storyItem = STORY_TEXTS.find(
        item => elapsed >= item.time && elapsed < item.time + item.duration
      );
      if (storyItem) {
        setCurrentText(storyItem.text);
        setIsTitle(false); // Title now only shown in splash screen
      } else {
        setCurrentText('');
        setIsTitle(false);
      }
      
      // Underwater phase trigger (aligned with updated camera phases)
      const adjustedTPhase = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
      if (adjustedTPhase > 0.85 && adjustedTPhase < 0.94) {
        // Underwater descent phase
        underwaterPhaseRef.current = true;
        const underwaterProgress = (adjustedTPhase - 0.85) / 0.09;
        // Smoother fade using ease function
        const easedFade = underwaterProgress * underwaterProgress * (3 - 2 * underwaterProgress);
        fadeToBlackRef.current = easedFade * 0.7;
        setOverlayOpacity(fadeToBlackRef.current);
      } else if (adjustedTPhase >= 0.94) {
        // Rising from abyss to splash screen
        underwaterPhaseRef.current = false;
        const riseProgress = (adjustedTPhase - 0.94) / 0.06;
        // Fade out the underwater overlay as we rise
        fadeToBlackRef.current = Math.max(0, 0.7 - riseProgress * 1.2);
        setOverlayOpacity(fadeToBlackRef.current);
      } else {
        underwaterPhaseRef.current = false;
        if (fadeToBlackRef.current !== 0) {
          fadeToBlackRef.current = 0;
          setOverlayOpacity(0);
        }
      }
      
      if (oceanRef.current) {
        const oceanMat = oceanRef.current.material as THREE.ShaderMaterial;
        oceanMat.uniforms.uTime.value = time;
        
        const adjustedT = Math.max(0, (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION));
        const stormIntensity = adjustedT > 0.3 ? Math.min((adjustedT - 0.3) * 2.5, 1) : 0;
        oceanMat.uniforms.uStormIntensity.value = stormIntensity;
        oceanMat.uniforms.uLightningFlash.value = lightningFlash;
        
        // Underwater fade effect
        if (oceanMat.uniforms.uUnderwaterFade) {
          oceanMat.uniforms.uUnderwaterFade.value = underwaterPhaseRef.current ? fadeToBlackRef.current : 0;
        }
      }
      
      // Animate falling crew during attack phase (synced with beast collision at 0.55-0.70)
      if (fallingCrewRef.current && elapsed > VIDEO_INTRO_DURATION) {
        const adjustedT = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
        const attackStart = 0.58; // Start falling after beast collision impact
        
        fallingCrewRef.current.children.forEach((crewMember) => {
          const delay = (crewMember.userData.delay || 0) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
          const fallStart = attackStart + delay * 0.05; // Faster stagger for dramatic effect
          
          if (adjustedT > fallStart) {
            crewMember.visible = true;
            const fallProgress = adjustedT - fallStart;
            const speed = crewMember.userData.fallSpeed || 1;
            const rotSpeed = crewMember.userData.rotSpeed || new THREE.Vector3();
            
            // Falling animation with gravity acceleration
            const gravity = 1 + fallProgress * 0.5; // Accelerate as they fall
            crewMember.position.y -= speed * 0.35 * gravity;
            crewMember.rotation.x += rotSpeed.x * 1.2;
            crewMember.rotation.y += rotSpeed.y * 1.2;
            crewMember.rotation.z += rotSpeed.z * 1.2;
            
            // Slow down when entering water with splash deceleration
            if (crewMember.position.y < 0) {
              crewMember.userData.fallSpeed = speed * 0.92; // Faster deceleration in water
              // Sink slowly underwater with drift
              if (crewMember.position.y > -90) {
                crewMember.position.y -= speed * 0.04;
                crewMember.position.x += (Math.random() - 0.5) * 0.1; // Drift in water
              }
            }
          }
        });
      }
      
      // Animate bubbles during underwater phase
      if (bubblesRef.current && underwaterPhaseRef.current) {
        bubblesRef.current.visible = true;
        const bubbleMat = bubblesRef.current.material as THREE.ShaderMaterial;
        if (bubbleMat.uniforms.uTime) {
          bubbleMat.uniforms.uTime.value = time;
        }
      } else if (bubblesRef.current) {
        bubblesRef.current.visible = false;
      }
      
      if (shipRef.current && elapsed > VIDEO_INTRO_DURATION) {
        const adjustedT = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
        
        if (adjustedT < 0.55) {
          // Normal sailing with increasing storm intensity
          const stormIntensity = Math.min(adjustedT * 2, 1);
          shipRef.current.rotation.z = Math.sin(time * 0.7) * (0.08 + stormIntensity * 0.08);
          shipRef.current.rotation.x = Math.sin(time * 0.5) * (0.04 + stormIntensity * 0.04);
          shipRef.current.position.y = 3 + Math.sin(time * 0.8) * (1.5 + stormIntensity * 1.5);
          
          if (shipLightRef.current) {
            shipLightRef.current.intensity = 2.5 + Math.sin(time * 2) * 0.5;
          }
        } else if (adjustedT < 0.70) {
          // Beast attack impact phase - violent shaking
          const impactProgress = (adjustedT - 0.55) / 0.15;
          const shakeIntensity = Math.sin(impactProgress * Math.PI) * 0.8; // Peak at middle
          
          shipRef.current.rotation.z = Math.sin(time * 4) * 0.25 * (1 + shakeIntensity);
          shipRef.current.rotation.x = Math.sin(time * 3.5) * 0.15 + impactProgress * 0.1;
          shipRef.current.position.y = 3 - impactProgress * 5 + Math.sin(time * 2) * 1.5;
          
          // Add horizontal displacement from impact
          shipRef.current.position.x = Math.sin(time * 5) * 2 * shakeIntensity;
          
          if (shipLightRef.current) {
            shipLightRef.current.intensity = 3 - impactProgress * 0.5;
          }
          
          // Mast breaking at 50% through impact phase
          if (impactProgress > 0.5 && !mastBrokenRef.current) {
            mastBrokenRef.current = true;
            
            // Hide the original mast if it exists
            if (mastMeshRef.current) {
              mastMeshRef.current.visible = false;
            }
            
            // Create broken mast piece that falls - clone from original or create fallback
            const brokenMast = new THREE.Group();
            if (mastMeshRef.current) {
              // Clone the actual mast mesh for realistic breaking
              const clonedMast = mastMeshRef.current.clone();
              clonedMast.visible = true;
              brokenMast.add(clonedMast);
            } else {
              // Fallback: create a simple mast piece
              const mastGeo = new THREE.CylinderGeometry(0.4, 0.5, 5, 8);
              const mastMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
              const mastPiece = new THREE.Mesh(mastGeo, mastMat);
              mastPiece.castShadow = true;
              brokenMast.add(mastPiece);
            }
            
            // Get ship world position for the broken mast
            const shipWorldPos = new THREE.Vector3();
            shipRef.current.getWorldPosition(shipWorldPos);
            brokenMast.position.copy(shipWorldPos);
            brokenMast.position.y += 25;
            
            brokenMast.userData.velocity = new THREE.Vector3(
              (Math.random() - 0.5) * 8,
              5,
              (Math.random() - 0.5) * 5
            );
            brokenMast.userData.angularVel = new THREE.Vector3(
              (Math.random() - 0.5) * 3,
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 4
            );
            scene.add(brokenMast);
            brokenMastRef.current = brokenMast;
          }
          
          // Spawn wood debris during impact
          if (impactProgress > 0.3 && debrisModelsRef.current.length > 0 && Math.random() < 0.15) {
            const templateIndex = Math.floor(Math.random() * debrisModelsRef.current.length);
            const template = debrisModelsRef.current[templateIndex];
            const debris = template.clone();
            debris.scale.setScalar(0.8 + Math.random() * 0.6);
            
            const shipPos = shipRef.current.position.clone();
            debris.position.set(
              shipPos.x + (Math.random() - 0.5) * 15,
              shipPos.y + 10 + Math.random() * 15,
              shipPos.z + (Math.random() - 0.5) * 15
            );
            
            scene.add(debris);
            activeDebrisRef.current.push({
              mesh: debris,
              velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                Math.random() * 10 + 5,
                (Math.random() - 0.5) * 12
              ),
              angularVel: new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6
              ),
              startTime: time,
            });
          }
          
          // Update sail tear progress
          sailTornRef.current = Math.min(1, impactProgress * 1.5);
          
          // Update hull damage - make parts invisible progressively during attack
          hullDamageProgressRef.current = impactProgress;
          if (hullMeshesRef.current.length > 0) {
            const damageCount = Math.floor(impactProgress * hullMeshesRef.current.length * 0.4);
            hullMeshesRef.current.forEach((mesh, idx) => {
              if (idx < damageCount) {
                // Make damaged hull parts fade out
                if (mesh.material) {
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  if (mat.isMeshStandardMaterial) {
                    mat.opacity = Math.max(0, 1 - (impactProgress - idx / hullMeshesRef.current.length) * 3);
                  }
                }
              }
            });
          }
        } else {
          // Ship sinking phase
          const sinkProgress = (adjustedT - 0.70) / 0.30;
          const easeIn = sinkProgress * sinkProgress; // Accelerating sink
          
          shipRef.current.position.y = -2 - easeIn * 45;
          shipRef.current.position.x *= 0.98; // Gradually center
          shipRef.current.rotation.z = Math.sin(time * 1.5) * 0.2 + easeIn * 0.7; // Tilting as it sinks
          shipRef.current.rotation.x = easeIn * 0.4; // Bow dipping
          
          if (shipLightRef.current) {
            shipLightRef.current.intensity = Math.max(0, 2.5 - easeIn * 3.5);
          }
          
          // Continue hull damage during sinking - more parts fade/disappear
          if (hullMeshesRef.current.length > 0) {
            const totalDamage = 0.4 + sinkProgress * 0.5; // 40% from attack + up to 50% more from sinking
            hullMeshesRef.current.forEach((mesh, idx) => {
              const threshold = idx / hullMeshesRef.current.length;
              if (threshold < totalDamage) {
                if (mesh.material) {
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  if (mat.isMeshStandardMaterial) {
                    // Some parts completely disappear, others just fade
                    if (threshold < totalDamage - 0.2) {
                      mesh.visible = false;
                    } else {
                      mat.opacity = Math.max(0, 1 - (totalDamage - threshold) * 5);
                    }
                  }
                }
              }
            });
          }
          
          // Continue spawning debris as ship sinks
          if (debrisModelsRef.current.length > 0 && Math.random() < 0.08) {
            const templateIndex = Math.floor(Math.random() * debrisModelsRef.current.length);
            const template = debrisModelsRef.current[templateIndex];
            const debris = template.clone();
            debris.scale.setScalar(0.5 + Math.random() * 0.4);
            
            const shipPos = shipRef.current.position.clone();
            debris.position.set(
              shipPos.x + (Math.random() - 0.5) * 20,
              Math.max(-10, shipPos.y + Math.random() * 10),
              shipPos.z + (Math.random() - 0.5) * 20
            );
            
            scene.add(debris);
            activeDebrisRef.current.push({
              mesh: debris,
              velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 3,
                (Math.random() - 0.5) * 5
              ),
              angularVel: new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3
              ),
              startTime: time,
            });
          }
        }
        
        // Animate sail cloth with physics simulation
        if (sailMeshRef.current && clothSimRef.current) {
          const sail = sailMeshRef.current;
          const geometry = sail.geometry as THREE.BufferGeometry;
          const positionAttr = geometry.getAttribute('position');
          const clothSim = clothSimRef.current;
          const stormIntensity = Math.min(adjustedT * 2.5, 1);
          const tearProgress = sailTornRef.current;
          
          // Apply wind force to cloth simulation
          const windForce: WindForce = {
            direction: new THREE.Vector3(0, 0, 1), // Wind blowing into sail
            strength: 2.0 + stormIntensity * 4.0, // Stronger in storm
            turbulence: 0.3 + stormIntensity * 1.5, // More chaotic in storm
          };
          clothSim.applyWind(windForce);
          
          // Update cloth physics simulation
          clothSim.update(Math.min(frameDelta, 0.016));
          
          // Apply cloth positions to geometry
          if (positionAttr) {
            const clothPositions = clothSim.getPositions();
            const positions = positionAttr.array as Float32Array;
            
            // Copy cloth particle positions to geometry vertices
            for (let i = 0; i < Math.min(clothPositions.length, positions.length); i++) {
              positions[i] = clothPositions[i];
            }
            
            positionAttr.needsUpdate = true;
            geometry.computeVertexNormals();
          }
          
          // Fade sail opacity as it tears
          if (sail.material && tearProgress > 0) {
            const mat = sail.material as THREE.MeshStandardMaterial;
            if (mat.isMeshStandardMaterial) {
              mat.opacity = Math.max(0.3, 1 - tearProgress * 0.7);
            }
          }
        } else if (sailMeshRef.current && !clothSimRef.current) {
          // Fallback for GLB model sails without cloth simulation - simple wave animation
          const sail = sailMeshRef.current;
          const geometry = sail.geometry as THREE.BufferGeometry;
          const positionAttr = geometry.getAttribute('position');
          const originalPositions = sailOriginalPositionsRef.current;
          const stormIntensity = Math.min(adjustedT * 2.5, 1);
          const tearProgress = sailTornRef.current;
          
          if (positionAttr && originalPositions) {
            const positions = positionAttr.array as Float32Array;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            const bbox = geometry.boundingBox!;
            const height = bbox.max.y - bbox.min.y;
            const width = bbox.max.x - bbox.min.x;
            
            for (let i = 0; i < positionAttr.count; i++) {
              const origX = originalPositions[i * 3];
              const origY = originalPositions[i * 3 + 1];
              const origZ = originalPositions[i * 3 + 2];
              
              const normalizedY = height > 0 ? (origY - bbox.min.y) / height : 0.5;
              const normalizedX = width > 0 ? (origX - bbox.min.x) / width : 0.5;
              
              const windForce = Math.sin(time * 3 + normalizedY * 4) * (0.5 + stormIntensity * 1.5) * normalizedY;
              const verticalWave = Math.sin(time * 2.5 + normalizedX * 3) * (0.3 + stormIntensity * 0.8);
              const tearFactor = tearProgress * normalizedY;
              const tearDisplacement = tearFactor * Math.sin(time * 8 + normalizedY * 6) * 2;
              
              positions[i * 3] = origX;
              positions[i * 3 + 1] = origY;
              positions[i * 3 + 2] = origZ + windForce + verticalWave + tearDisplacement;
            }
            
            positionAttr.needsUpdate = true;
            geometry.computeVertexNormals();
            
            if (sail.material && tearProgress > 0) {
              const mat = sail.material as THREE.MeshStandardMaterial;
              if (mat.isMeshStandardMaterial) {
                mat.opacity = Math.max(0.3, 1 - tearProgress * 0.7);
              }
            }
          }
        }
        
        // Update falling broken mast
        if (brokenMastRef.current) {
          const mast = brokenMastRef.current;
          const vel = mast.userData.velocity as THREE.Vector3;
          const angVel = mast.userData.angularVel as THREE.Vector3;
          
          vel.y -= 0.4; // Gravity
          mast.position.add(vel.clone().multiplyScalar(frameDelta));
          mast.rotation.x += angVel.x * frameDelta;
          mast.rotation.y += angVel.y * frameDelta;
          mast.rotation.z += angVel.z * frameDelta;
          
          // Water resistance when below surface
          if (mast.position.y < 0) {
            vel.multiplyScalar(0.95);
            angVel.multiplyScalar(0.9);
          }
          
          // Remove when too deep
          if (mast.position.y < -80) {
            scene.remove(mast);
            brokenMastRef.current = null;
          }
        }
        
        // Update all active debris
        for (let i = activeDebrisRef.current.length - 1; i >= 0; i--) {
          const debris = activeDebrisRef.current[i];
          
          debris.velocity.y -= 0.25; // Gravity
          debris.mesh.position.add(debris.velocity.clone().multiplyScalar(frameDelta));
          debris.mesh.rotation.x += debris.angularVel.x * frameDelta;
          debris.mesh.rotation.y += debris.angularVel.y * frameDelta;
          debris.mesh.rotation.z += debris.angularVel.z * frameDelta;
          
          // Water resistance
          if (debris.mesh.position.y < 0) {
            debris.velocity.multiplyScalar(0.92);
            debris.angularVel.multiplyScalar(0.85);
          }
          
          // Remove old debris
          if (time - debris.startTime > 12 || debris.mesh.position.y < -100) {
            scene.remove(debris.mesh);
            activeDebrisRef.current.splice(i, 1);
          }
        }
      }
      
      // Stonewisp fight: approach → emerge → lunge → strike → retreat + tentacle tip IK
      if (elapsed > VIDEO_INTRO_DURATION) {
        const adjustedT = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
        const shipWorld = new THREE.Vector3();
        if (shipRef.current) {
          shipRef.current.getWorldPosition(shipWorld);
          shipWorld.y += 8;
        } else {
          shipWorld.set(0, 6, 0);
        }

        if (stoneWispCtrlRef.current?.isLoaded) {
          stoneWispCtrlRef.current.setVisible(adjustedT > 0.05);
          stoneWispCtrlRef.current.updateFight(adjustedT, frameDelta, shipWorld);

          // Hide deck hero as ship breaks; show floating body later
          if (heroOnDeckRef.current) {
            heroOnDeckRef.current.visible = adjustedT < 0.72;
          }
          if (deckCrewRef.current) {
            deckCrewRef.current.visible = adjustedT < 0.74;
          }

          // Tentacle wrap → ship break physics
          if (shipRef.current && adjustedT > 0.55 && adjustedT < 0.82) {
            const shake = (adjustedT - 0.55) / 0.27;
            // Damped thrash (not pure random — smoother cinematic)
            const t = elapsed * 0.001;
            shipRef.current.rotation.z += Math.sin(t * 18) * 0.025 * shake;
            shipRef.current.rotation.x += Math.sin(t * 11) * 0.018 * shake;
            shipRef.current.position.x += Math.sin(t * 14) * 0.22 * shake;
            shipRef.current.position.y += Math.abs(Math.sin(t * 9)) * 0.08 * shake;
          }

          // Break beat: once tentacles clamp, hull snaps and begins sinking
          if (
            shipRef.current
            && !shipBreakTriggeredRef.current
            && adjustedT > 0.64
          ) {
            shipBreakTriggeredRef.current = true;
            shipBreakVelRef.current.set(
              (Math.random() - 0.5) * 4,
              2.5,
              (Math.random() - 0.5) * 3,
            );
            shipBreakAngRef.current.set(0.35, 0.15, 0.55);
            // Kick debris / mast if helpers exist
            if (!mastBrokenRef.current && typeof (window as any) !== 'undefined') {
              // Trigger existing tear/break systems via damage progress
              hullDamageProgressRef.current = 1;
              sailTornRef.current = 1;
            }
            monsterAudioRef.current.setMuted(isMuted);
            monsterAudioRef.current.playStrike();
          }

          if (shipRef.current && shipBreakTriggeredRef.current && adjustedT > 0.64) {
            const ship = shipRef.current;
            const vel = shipBreakVelRef.current;
            const ang = shipBreakAngRef.current;
            vel.y -= 2.8 * frameDelta;
            ship.position.addScaledVector(vel, frameDelta);
            ship.rotation.x += ang.x * frameDelta;
            ship.rotation.y += ang.y * frameDelta;
            ship.rotation.z += ang.z * frameDelta;
            // Water drag
            if (ship.position.y < 0) {
              vel.multiplyScalar(0.96);
              ang.multiplyScalar(0.94);
            }
          }
        } else if (stoneWispRef.current) {
          // Legacy path if controller not ready
          if (adjustedT < 0.15) {
            const swimProgress = adjustedT / 0.15;
            stoneWispRef.current.position.y = -10 + swimProgress * 5;
            stoneWispRef.current.position.z = 80 - swimProgress * 10;
            stoneWispRef.current.rotation.y = Math.PI + Math.sin(time * 0.4) * 0.08;
          } else if (adjustedT < 0.5) {
            const emergeProgress = (adjustedT - 0.15) / 0.35;
            stoneWispRef.current.position.y = -5 + emergeProgress * 15;
            stoneWispRef.current.position.z = 70 - emergeProgress * 40;
            stoneWispRef.current.rotation.y = Math.PI + Math.sin(time * 0.4) * 0.08;
          } else if (adjustedT < 0.75) {
            const attackProgress = (adjustedT - 0.5) / 0.25;
            stoneWispRef.current.position.z = 30 - attackProgress * 25;
            stoneWispRef.current.position.y = 10 + Math.sin(attackProgress * Math.PI) * 10;
            stoneWispRef.current.rotation.x = -attackProgress * 0.25;
            stoneWispRef.current.rotation.y = Math.PI + Math.sin(time * 0.8) * 0.12;
          } else {
            const sinkProgress = (adjustedT - 0.75) / 0.25;
            stoneWispRef.current.position.y = 20 - sinkProgress * 75;
            stoneWispRef.current.position.z = 5 + sinkProgress * 20;
          }
        }
      }
      
      if (elapsed > VIDEO_INTRO_DURATION) {
        const adjustedT = (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION);
        lightningTimerRef.current += 1;
        
        // Much more dramatic lightning - higher chance and frequency
        const baseChance = 0.04; // Base chance per frame
        const stormMultiplier = adjustedT > 0.2 && adjustedT < 0.85 ? 3.0 : 1.0; // 3x during storm peak
        const lightningChance = baseChance * stormMultiplier;
        
        if (Math.random() < lightningChance || lightningTimerRef.current > 20) {
          if (Math.random() < 0.45 || lightningTimerRef.current > 20) {
            lightningTimerRef.current = 0;
            
            // Trigger screen flash effect
            setLightningFlash(0.8 + Math.random() * 0.2);
            setTimeout(() => setLightningFlash(0), 80);
            setTimeout(() => setLightningFlash(0.3), 120);
            setTimeout(() => setLightningFlash(0), 180);
            
            // Create dramatic lightning bolt
            const start = new THREE.Vector3(
              (Math.random() - 0.5) * 400,
              200 + Math.random() * 80,
              (Math.random() - 0.5) * 200 - 100
            );
            const end = new THREE.Vector3(
              start.x + (Math.random() - 0.5) * 100,
              -10,
              start.z + (Math.random() - 0.5) * 100
            );
            createLightningBolt(scene, start, end, 1.2 + Math.random() * 0.8);
            
            // Chain lightning - multiple bolts in quick succession
            if (Math.random() < 0.6) {
              setTimeout(() => {
                const start2 = new THREE.Vector3(
                  (Math.random() - 0.5) * 350,
                  190,
                  (Math.random() - 0.5) * 150 - 80
                );
                const end2 = new THREE.Vector3(
                  start2.x + (Math.random() - 0.5) * 80,
                  -5,
                  start2.z
                );
                createLightningBolt(scene, start2, end2, 1.0);
                setLightningFlash(0.4);
                setTimeout(() => setLightningFlash(0), 60);
              }, 80 + Math.random() * 120);
            }
            
            // Third strike for extra drama during peak storm
            if (Math.random() < 0.3 && adjustedT > 0.4 && adjustedT < 0.7) {
              setTimeout(() => {
                const start3 = new THREE.Vector3(
                  (Math.random() - 0.5) * 300,
                  185,
                  (Math.random() - 0.5) * 120 - 60
                );
                const end3 = new THREE.Vector3(
                  start3.x + (Math.random() - 0.5) * 60,
                  0,
                  start3.z
                );
                createLightningBolt(scene, start3, end3, 0.9);
              }, 200 + Math.random() * 150);
            }
          }
        }
      }
      
      // ── Cinematic polish: per-frame light + exposure ramps ──────────────────
      {
        const adjT = Math.max(0, (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION));
        const stormRamp = adjT < 0.55 ? adjT / 0.55 : adjT < 0.75 ? 1.0 : Math.max(0, 1 - (adjT - 0.75) / 0.25);
        const inUnderwater = adjT >= 0.85 && adjT < 0.94;
        const inRise = adjT >= 0.94;
        const inDeathFloat = elapsed >= DEATH_FLOAT_START && elapsed < SPLASH_SCREEN_START;

        // Tonemap exposure: dim through sinking → near-dark underwater → lift for splash + death float
        if (rendererRef.current) {
          let targetExposure = 1.2;
          if (adjT >= 0.55 && adjT < 0.85) targetExposure = 1.2 - (adjT - 0.55) / 0.30 * 0.45; // 1.2 → 0.75
          else if (inUnderwater) targetExposure = 0.55;
          else if (inRise) targetExposure = 0.75 + (adjT - 0.94) / 0.06 * 0.55; // 0.75 → 1.30
          if (inDeathFloat && !inUnderwater && !inRise) targetExposure = 1.05; // calmer hush
          if (elapsed >= SPLASH_SCREEN_START) targetExposure = 1.35; // triumphant
          // Smooth lerp toward target
          const cur = rendererRef.current.toneMappingExposure;
          rendererRef.current.toneMappingExposure = cur + (targetExposure - cur) * 0.08;
        }

        // Danger rim — red glow pulsing in during kraken approach + attack (0.30–0.75)
        if (dangerLightRef.current) {
          const dangerRamp = adjT < 0.30 ? 0 : adjT < 0.55 ? (adjT - 0.30) / 0.25 : adjT < 0.75 ? 1 - (adjT - 0.55) / 0.40 : 0;
          const flicker = 1 + Math.sin(time * 4.7) * 0.15 + Math.sin(time * 11.3) * 0.08;
          dangerLightRef.current.intensity = dangerRamp * 4.5 * flicker;
        }

        // Storm light pulses with lightning + storm intensity
        if (stormLightRef.current) {
          stormLightRef.current.intensity = (1.0 + stormRamp * 1.8) * (1 + lightningFlash * 1.5);
        }

        // Moon dims as storm peaks then returns gently for death float
        if (moonLightRef.current) {
          const moonDim = adjT < 0.55 ? 0.8 - stormRamp * 0.3 : adjT < 0.85 ? 0.5 : inDeathFloat ? 0.7 : 0.5;
          moonLightRef.current.intensity = moonDim;
        }

        // Underwater light — pulsing teal-green, with caustic-style flicker
        if (underwaterLightRef.current) {
          if (inUnderwater) {
            const u = (adjT - 0.85) / 0.09;
            const pulse = 0.6 + Math.sin(time * 1.7) * 0.25 + Math.sin(time * 5.3) * 0.15;
            underwaterLightRef.current.intensity = u * 2.2 * pulse;
            underwaterLightRef.current.color.setHSL(0.45 + Math.sin(time * 0.8) * 0.04, 0.85, 0.45);
          } else if (inRise) {
            underwaterLightRef.current.intensity = Math.max(0, underwaterLightRef.current.intensity - 0.05);
          } else {
            underwaterLightRef.current.intensity = 0;
          }
        }

        // Kraken spotlight intensifies during attack
        if (krakenSpotlightRef.current) {
          const k = adjT > 0.30 && adjT < 0.75 ? Math.min(1, (adjT - 0.30) / 0.20) * (1 - Math.max(0, (adjT - 0.55) / 0.20)) : 0;
          krakenSpotlightRef.current.intensity = 1.5 + k * 4.0;
        }
      }

      // Cinematic handheld jitter helper — tiny organic shake scaled by storm
      const handheld = (intensityScale: number = 1) => {
        if (!cameraRef.current) return;
        const adjT = Math.max(0, (elapsed - VIDEO_INTRO_DURATION) / (INTRO_DURATION - VIDEO_INTRO_DURATION));
        const stormRamp = adjT < 0.55 ? adjT / 0.55 : adjT < 0.75 ? 1.0 : Math.max(0, 1 - (adjT - 0.75) / 0.25);
        const amp = (0.12 + stormRamp * 0.55) * intensityScale;
        const t = time;
        cameraRef.current.position.x += Math.sin(t * 1.7) * amp * 0.5 + Math.sin(t * 5.3) * amp * 0.18;
        cameraRef.current.position.y += Math.cos(t * 2.3) * amp * 0.35 + Math.sin(t * 7.1) * amp * 0.15;
        cameraRef.current.position.z += Math.sin(t * 1.1) * amp * 0.25;
      };

      if (cameraRef.current) {
        const adjustedElapsed = Math.max(0, elapsed - VIDEO_INTRO_DURATION);
        const adjustedT = adjustedElapsed / (INTRO_DURATION - VIDEO_INTRO_DURATION);
        
        // Get beast's actual position for camera tracking
        const beastPos = stoneWispRef.current?.position || new THREE.Vector3(0, -35, 120);
        
        // Camera phases redesigned for dramatic zoom-out from video and beast reveal
        // All camera positions raised by +15 for better overview
        if (elapsed < VIDEO_INTRO_DURATION) {
          // Phase 0: During video - close intimate shot that will zoom out
          cameraRef.current.position.set(0, 20, 25);
          cameraRef.current.lookAt(0, 5, 0);
        } else if (adjustedT < 0.12) {
          // Phase 1: ZOOM OUT from video - dramatic pull back revealing the scene
          const camT = adjustedT / 0.12;
          const easeOut = 1 - Math.pow(1 - camT, 5); // Quintic ease out — slower, more awe
          cameraRef.current.position.set(
            -20 * easeOut,                    // Pan left
            20 + easeOut * 20,                // Rise up higher
            25 + easeOut * 75                 // Pull back dramatically
          );
          cameraRef.current.lookAt(0, 5, 30); // Look towards beast area
          handheld(0.6);
        } else if (adjustedT < 0.25) {
          // Phase 2: Wide establishing shot - show both ship and beast
          const camT = (adjustedT - 0.12) / 0.13;
          cameraRef.current.position.set(
            -20 - camT * 30,
            40 + camT * 10,     // Higher position
            100 + camT * 20
          );
          cameraRef.current.lookAt(0, 0, 40); // Look between ship and beast
          handheld(0.7);
        } else if (adjustedT < 0.40) {
          // Phase 3: Beast reveal - position camera to clearly show monster
          const camT = (adjustedT - 0.25) / 0.15;
          cameraRef.current.position.set(
            -40 + camT * 30,    // Arc from left
            45 + camT * 10,     // High for overview
            90 + camT * 20      // Position to see beast
          );
          cameraRef.current.lookAt(beastPos.x, beastPos.y + 10, beastPos.z);
          cameraRef.current.rotation.z = Math.sin(time * 1.2) * 0.02;
          handheld(0.9);
        } else if (adjustedT < 0.55) {
          // Phase 4: Beast attack close-up - dramatic angle as it lunges
          const camT = (adjustedT - 0.40) / 0.15;
          cameraRef.current.position.set(
            -30 + camT * 80,     // Sweep around to side
            40 - camT * 5,       // Stay high
            80 - camT * 30       // Move in closer
          );
          // Track between beast and ship during collision
          const lookTarget = new THREE.Vector3(
            beastPos.x * 0.7,
            (beastPos.y + 5) * (1 - camT * 0.5),
            beastPos.z * 0.5
          );
          cameraRef.current.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
          cameraRef.current.rotation.z = Math.sin(time * 3) * 0.04 * (1 + camT * 0.5);
          handheld(1.4);
        } else if (adjustedT < 0.70) {
          // Phase 5: Ship being attacked - higher side view showing destruction
          const camT = (adjustedT - 0.55) / 0.15;
          cameraRef.current.position.set(
            50 - camT * 20,
            35 - camT * 10,      // Stay higher
            50 - camT * 15
          );
          cameraRef.current.lookAt(0, 5, 20);
          cameraRef.current.rotation.z = camT * 0.04;
          handheld(1.5);
        } else if (adjustedT < 0.85) {
          // Phase 6: Ship sinking, crew falling into water
          const camT = (adjustedT - 0.70) / 0.15;
          cameraRef.current.position.set(
            30 - camT * 25,
            30 - camT * 35,      // Start higher, camera descends with sinking ship
            40 - camT * 15
          );
          cameraRef.current.lookAt(0, -10 - camT * 25, 30);
          cameraRef.current.rotation.z = camT * 0.03;
          handheld(1.2);

          // Cinematic polish — once the death float starts, gently re-target the camera
          // toward the floating survivor so the wide shot has a foreground hero,
          // and override entirely during the intimate "zoom to character" beat.
          if (elapsed >= DEATH_FLOAT_START && floatingBodyRef.current) {
            const fb = floatingBodyRef.current.position;
            if (elapsed >= ZOOM_TO_CHARACTER_START) {
              // Tight, low-angle, slowly drifting in toward the body
              const z = Math.min(1, (elapsed - ZOOM_TO_CHARACTER_START) / 8000);
              const eased = 1 - Math.pow(1 - z, 3);
              const orbitAngle = -0.55 + eased * 0.35;
              const radius = 28 - eased * 12;
              cameraRef.current.position.set(
                fb.x + Math.sin(orbitAngle) * radius,
                fb.y + 5.5 - eased * 2.0,
                fb.z + Math.cos(orbitAngle) * radius
              );
              cameraRef.current.lookAt(fb.x, fb.y + 0.4, fb.z);
              cameraRef.current.rotation.z = Math.sin(time * 0.6) * 0.02;
              handheld(0.5);
            } else {
              // Wide shot — bias lookAt halfway between wreck/kraken and the survivor
              const wreckLook = new THREE.Vector3(0, -10 - camT * 25, 30);
              const heroLook  = new THREE.Vector3(fb.x, fb.y + 1.5, fb.z);
              const blend = Math.min(1, (elapsed - DEATH_FLOAT_START) / 6000);
              const target = wreckLook.lerp(heroLook, 0.45 * blend);
              cameraRef.current.lookAt(target.x, target.y, target.z);
            }
          }
        } else if (adjustedT < 0.94) {
          // Phase 7: Underwater descent - smooth transition into the abyss
          const camT = (adjustedT - 0.85) / 0.09;
          const easeInOut = camT < 0.5 ? 2 * camT * camT : 1 - Math.pow(-2 * camT + 2, 2) / 2;
          cameraRef.current.position.set(
            3 * Math.sin(time * 0.25),
            -15 - easeInOut * 45,    // Smooth descent underwater
            25 - easeInOut * 10
          );
          cameraRef.current.lookAt(0, -50 - easeInOut * 20, beastPos.z * 0.3);
          cameraRef.current.rotation.z = Math.sin(time * 0.4) * 0.015;
          // Underwater drift — slow tumble feel, no storm jitter
          if (cameraRef.current) {
            cameraRef.current.position.x += Math.sin(time * 0.55) * 0.4;
            cameraRef.current.position.y += Math.sin(time * 0.7) * 0.3;
          }
        } else {
          // Phase 8: Rise from abyss to splash screen - bubbles rising
          const camT = (adjustedT - 0.94) / 0.06;
          const easeOut = 1 - Math.pow(1 - camT, 5); // Quintic — triumphant
          cameraRef.current.position.set(
            0,
            -60 + easeOut * 85,    // Smooth rise through bubbles
            15
          );
          cameraRef.current.lookAt(0, 25, 0);
          cameraRef.current.rotation.z = 0;
        }
      }
      
      scene.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
          if (child.material.uniforms.uTime) {
            child.material.uniforms.uTime.value = time;
          }
        }
      });
      
      // Update sky shader with time and lightning flash
      if (skyMaterialRef.current) {
        skyMaterialRef.current.uniforms.uTime.value = time;
        skyMaterialRef.current.uniforms.uLightningFlash.value = lightningFlash;
      }
      
      // Animate stylized rain streaks (line segments - pairs of vertices)
      if (rainRef.current && rainVelocitiesRef.current && elapsed > VIDEO_INTRO_DURATION) {
        const positions = rainRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = rainVelocitiesRef.current;
        const streakLength = 3.5;
        const windAngle = 0.15;
        
        // Each rain streak has 2 vertices (6 floats: start xyz, end xyz)
        const numStreaks = velocities.length;
        for (let i = 0; i < numStreaks; i++) {
          const speed = velocities[i] * 2.0;
          const baseIdx = i * 6;
          
          // Move both start and end points together
          positions[baseIdx + 1] -= speed; // start y
          positions[baseIdx + 4] -= speed; // end y
          positions[baseIdx] -= speed * 0.15; // start x (wind)
          positions[baseIdx + 3] -= speed * 0.15; // end x (wind)
          
          // Reset streak when it falls below water
          if (positions[baseIdx + 4] < -5) {
            const newX = (Math.random() - 0.5) * 500;
            const newY = 180 + Math.random() * 40;
            const newZ = (Math.random() - 0.5) * 500;
            
            positions[baseIdx] = newX;
            positions[baseIdx + 1] = newY;
            positions[baseIdx + 2] = newZ;
            positions[baseIdx + 3] = newX + windAngle * streakLength;
            positions[baseIdx + 4] = newY - streakLength;
            positions[baseIdx + 5] = newZ;
          }
        }
        rainRef.current.geometry.attributes.position.needsUpdate = true;
      }
      
      // Death float phase - Character tossed from destroyed ship, carried by wave away from monster
      // Shows: Shipwreck with monster attacking it, character escaping on wave, camera follows
      // Now split into 2 phases: wide shot (35-45s) and zoom to character (45-53s)
      if (elapsed >= DEATH_FLOAT_START && floatingBodyRef.current) {
        const isZoomPhase = elapsed >= ZOOM_TO_CHARACTER_START;
        const floatDuration = (isZoomPhase ? ZOOM_TO_CHARACTER_START : SPLASH_SCREEN_START) - DEATH_FLOAT_START;
        const floatProgress = isZoomPhase 
          ? 1 
          : Math.min(1, (elapsed - DEATH_FLOAT_START) / (ZOOM_TO_CHARACTER_START - DEATH_FLOAT_START));
        
        if (!deathFloatStartedRef.current) {
          deathFloatStartedRef.current = true;
          floatingBodyRef.current.visible = true;
          
          // Show shipwreck - the destroyed ship
          if (shipwreckRef.current) {
            shipwreckRef.current.visible = true;
          }
          
          // Hide the intact ship
          if (shipRef.current) {
            shipRef.current.visible = false;
          }
          
          // Calm the rain
          if (rainRef.current) {
            rainRef.current.visible = false;
          }
          
          // Position monster to attack the shipwreck - raised higher for full visibility
          if (stoneWispRef.current) {
            stoneWispRef.current.position.set(20, 8, 50);
            stoneWispRef.current.rotation.y = -Math.PI / 3;
            stoneWispRef.current.rotation.x = -0.2; // Slight tilt down toward wreck
            stoneWispRef.current.visible = true;
          }
        }
        
        // Wave escape animation - chaotic storm motion, not uniform mathematical bumps
        // Layered frequencies create organic, unpredictable wave behavior
        const waveT = floatProgress;
        const easeWave = waveT < 0.5 
          ? 4 * waveT * waveT * waveT 
          : 1 - Math.pow(-2 * waveT + 2, 3) / 2;
        
        // Character path: starts near wreck, carried by wave to safety
        const startPos = characterStartPosRef.current;
        const endPos = characterEscapePosRef.current;
        
        // Chaotic storm wave motion - layered frequencies with phase offsets
        // Simulates real ocean chaos with multiple interfering wave patterns
        const chaos = (1 - waveT * 0.7); // Decreasing intensity as escaping
        const t = time * 1.5; // Use actual time for continuous variation
        
        // Primary swell - big slow waves
        const swell = Math.sin(t * 0.7 + waveT * 5) * 3 * chaos;
        // Secondary chop - faster irregular motion
        const chop = Math.sin(t * 2.3 + 1.7) * Math.cos(t * 1.1) * 2 * chaos;
        // Tertiary turbulence - rapid small variations
        const turbulence = (Math.sin(t * 5.7 + 3.2) + Math.sin(t * 4.1 - 1.5) * 0.5) * 0.8 * chaos;
        // Sudden drops and lifts - storm surges
        const surge = Math.pow(Math.sin(t * 0.9 + waveT * 3), 3) * 4 * chaos;
        
        const waveHeight = swell + chop + turbulence + surge;
        
        // Sideways chaos - being tossed left and right unpredictably
        const sidewaysSwell = Math.sin(t * 0.5 + 2.1) * 2.5 * chaos;
        const sidewaysChop = Math.cos(t * 1.9) * Math.sin(t * 0.8 + 0.7) * 1.5 * chaos;
        const sidewaysTurbulence = Math.sin(t * 3.3 - 1.2) * 0.6 * chaos;
        const waveSideways = sidewaysSwell + sidewaysChop + sidewaysTurbulence;
        
        // Forward/back surge - waves pushing and pulling
        const forwardSurge = Math.sin(t * 0.6 + 0.9) * Math.cos(t * 1.4) * 2 * chaos;
        
        // Interpolate position along escape path with chaotic wave motion
        const charX = THREE.MathUtils.lerp(startPos.x, endPos.x, easeWave) + waveSideways;
        const charY = THREE.MathUtils.lerp(startPos.y, endPos.y, easeWave) + waveHeight;
        const charZ = THREE.MathUtils.lerp(startPos.z, endPos.z, easeWave) + forwardSurge;
        
        floatingBodyRef.current.position.set(charX, charY, charZ);
        
        // Character rotation - chaotic tumbling from storm, not uniform spinning
        const tumbleIntensity = 1 - easeWave;
        // Layered rotation chaos matching wave motion
        const rollChaos = Math.sin(t * 1.7 + 0.5) * 0.4 + Math.sin(t * 3.2) * 0.2;
        const pitchChaos = Math.sin(t * 1.3 - 0.8) * 0.35 + Math.cos(t * 2.1) * 0.15;
        const yawDrift = waveT * Math.PI * 0.5 + Math.sin(t * 0.4) * 0.3;
        
        floatingBodyRef.current.rotation.x = -Math.PI / 4 + pitchChaos * tumbleIntensity;
        floatingBodyRef.current.rotation.y = Math.PI / 4 + yawDrift;
        floatingBodyRef.current.rotation.z = rollChaos * tumbleIntensity;
        
        // Monster attacks shipwreck - dramatic looming presence above wreck
        if (stoneWispRef.current && shipwreckRef.current) {
          // Monster rises dramatically and looms over the wreck
          const attackProgress = Math.min(1, floatProgress * 1.2);
          const riseEase = 1 - Math.pow(1 - attackProgress, 3); // Ease out
          
          // Monster rises higher and moves closer to wreck
          stoneWispRef.current.position.x = THREE.MathUtils.lerp(20, 10, riseEase);
          stoneWispRef.current.position.y = THREE.MathUtils.lerp(8, 18, riseEase); // Rise up dramatically
          stoneWispRef.current.position.z = THREE.MathUtils.lerp(50, 35, riseEase * 0.5);
          
          // Aggressive undulating motion - like a massive creature breathing
          stoneWispRef.current.rotation.x = -0.2 + Math.sin(time * 1.5) * 0.15;
          stoneWispRef.current.rotation.z = Math.sin(time * 2.2) * 0.08;
          stoneWispRef.current.rotation.y = -Math.PI / 3 + Math.sin(time * 0.8) * 0.1;
          
          // Pulsing scale for breathing effect
          const breathScale = 36 + Math.sin(time * 2) * 1.5;
          stoneWispRef.current.scale.setScalar(breathScale);
          
          // Shipwreck sinks slowly as monster pulls it down
          shipwreckRef.current.position.y = THREE.MathUtils.lerp(-8, -18, attackProgress * 0.8);
          shipwreckRef.current.rotation.z = Math.PI / 5 + attackProgress * 0.4; // More dramatic capsizing
          shipwreckRef.current.rotation.x = attackProgress * 0.15; // Bow tilting down
        }
        
        // Camera behavior depends on phase
        if (!isZoomPhase) {
          // Phase 1: Epic wide shot - camera follows character while showing monster and wreck
          const cameraOffset = new THREE.Vector3(
            charX * 0.15 - 35,  // Further to side for wide composition
            Math.max(30, charY + 35 + floatProgress * 25), // High angle to see monster looming
            charZ * 0.3 + 60 + floatProgress * 40  // Far back to capture full scene
          );
          camera.position.copy(cameraOffset);
          
          // Camera looks at midpoint between character and monster for dramatic framing
          const monsterPos = stoneWispRef.current?.position || new THREE.Vector3(15, 15, 40);
          const lookTarget = new THREE.Vector3(
            THREE.MathUtils.lerp(charX, monsterPos.x, 0.3), // Bias toward character
            THREE.MathUtils.lerp(charY, monsterPos.y * 0.5, 0.25) - 3, // Show more scene
            THREE.MathUtils.lerp(charZ, monsterPos.z, 0.2)
          );
          camera.lookAt(lookTarget);
        } else {
          // Phase 2: Slow zoom into floating character - intimate, emotional shot
          const zoomDuration = SPLASH_SCREEN_START - ZOOM_TO_CHARACTER_START; // 8 seconds
          const zoomProgress = Math.min(1, (elapsed - ZOOM_TO_CHARACTER_START) / zoomDuration);
          const easeZoom = zoomProgress * zoomProgress * (3 - 2 * zoomProgress); // Smooth ease
          
          // Start position (wide shot end) to close-up on floating character
          const startCamPos = new THREE.Vector3(
            charX * 0.15 - 35,
            charY + 60,
            charZ * 0.3 + 100
          );
          
          // End position - close and low, almost water level, looking at floating body
          const endCamPos = new THREE.Vector3(
            charX - 8,  // Slightly to side for composition
            charY + 4,  // Just above water
            charZ + 15  // Close to character
          );
          
          camera.position.lerpVectors(startCamPos, endCamPos, easeZoom);
          
          // Look directly at the floating character
          camera.lookAt(charX, charY + 1, charZ);
        }
        
        // Gradually calm the ocean as character escapes
        if (oceanRef.current && (oceanRef.current.material as THREE.ShaderMaterial).uniforms) {
          const oceanMat = oceanRef.current.material as THREE.ShaderMaterial;
          oceanMat.uniforms.uStormIntensity.value = Math.max(0.2, 1 - floatProgress * 1.2);
          oceanMat.uniforms.uWaveHeight.value = THREE.MathUtils.lerp(4.0, 2.0, floatProgress);
        }
      }
      
      // Splash screen phase - character now safe, camera pulls back for title
      if (elapsed >= SPLASH_SCREEN_START) {
        const splashDuration = INTRO_DURATION - SPLASH_SCREEN_START;
        const splashProgress = Math.min(1, (elapsed - SPLASH_SCREEN_START) / splashDuration);
        
        if (!showSplashScreen) {
          setShowSplashScreen(true);
        }
        
        // Fade in the splash screen overlay
        setSplashOpacity(Math.min(1, splashProgress * 1.5));
        
        // Character drifts to final safe position
        if (floatingBodyRef.current) {
          const finalPos = characterEscapePosRef.current;
          floatingBodyRef.current.position.x = finalPos.x + Math.sin(time * 0.5) * 0.5;
          floatingBodyRef.current.position.y = finalPos.y + Math.sin(time * 0.8) * 0.3;
          floatingBodyRef.current.position.z = finalPos.z;
          
          // Gentle floating motion
          floatingBodyRef.current.rotation.x = -Math.PI / 6 + Math.sin(time * 0.3) * 0.05;
          floatingBodyRef.current.rotation.z = Math.sin(time * 0.4) * 0.08;
        }
        
        // Keep monster animated during splash screen - continues looming over wreck
        if (stoneWispRef.current) {
          // Monster continues aggressive motion, slowly rising higher
          stoneWispRef.current.position.y = 18 + splashProgress * 5 + Math.sin(time * 0.8) * 2;
          stoneWispRef.current.rotation.x = -0.15 + Math.sin(time * 1.2) * 0.12;
          stoneWispRef.current.rotation.z = Math.sin(time * 1.8) * 0.06;
          
          // Breathing scale continues
          const breathScale = 36 + Math.sin(time * 2) * 1.2;
          stoneWispRef.current.scale.setScalar(breathScale);
        }
        
        // Shipwreck continues sinking
        if (shipwreckRef.current) {
          shipwreckRef.current.position.y = -18 - splashProgress * 5;
        }
        
        // Epic zoom out showing the scene - monster at wreck, character escaped
        const charPos = floatingBodyRef.current?.position || characterEscapePosRef.current;
        const monsterPos = stoneWispRef.current?.position || new THREE.Vector3(10, 20, 35);
        
        camera.position.set(
          THREE.MathUtils.lerp(charPos.x, monsterPos.x, 0.2) - 40 - splashProgress * 40,
          45 + splashProgress * 50,
          THREE.MathUtils.lerp(charPos.z, monsterPos.z, 0.3) + 70 + splashProgress * 60
        );
        
        // Look at scene center to keep both monster and character in frame
        const sceneCenterX = (charPos.x + monsterPos.x) * 0.4;
        const sceneCenterY = (charPos.y + monsterPos.y) * 0.3;
        const sceneCenterZ = (charPos.z + monsterPos.z) * 0.4;
        camera.lookAt(sceneCenterX, sceneCenterY, sceneCenterZ);
      }

      // Cinematic damp — soft follow so hard camera cuts read as film moves
      if (cameraRef.current) {
        const cam = cameraRef.current;
        const damp = 1 - Math.exp(-8 * Math.min(0.05, frameDelta));
        camPosSmoothed.current.lerp(cam.position, damp);
        // Don't fully replace position on splash/zoom (keep authored path strength)
        cam.position.lerp(camPosSmoothed.current, 0.35);
        camPosSmoothed.current.copy(cam.position);
      }
      
      renderer.render(scene, camera);
      
      if (elapsed >= INTRO_DURATION) {
        onComplete();
      }
    };
    
    animate();
    
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
      
      // Stop storm audio
      disposeStormAudio();
      audioStartedRef.current = false;
      
      if (krakenSound1Ref.current) {
        krakenSound1Ref.current.pause();
        krakenSound1Ref.current = null;
      }
      if (krakenSound2Ref.current) {
        krakenSound2Ref.current.pause();
        krakenSound2Ref.current = null;
      }
      krakenSound1PlayedRef.current = false;
      krakenSound2PlayedRef.current = false;
      
      shipRef.current = null;
      oceanRef.current = null;
      stoneWispRef.current = null;
      stoneWispMixerRef.current = null;
      crushedKingRef.current = null;
      crushedKingMixerRef.current = null;
      waterfallIslandRef.current = null;
      shipLightRef.current = null;
      bubblesRef.current = null;
      fallingCrewRef.current = null;
      floatingBodyRef.current = null;
      floatingBodyMixerRef.current = null;
      shipwreckRef.current = null;
      deathFloatStartedRef.current = false;
      waveEscapeProgressRef.current = 0;
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.forceContextLoss();
        rendererRef.current.dispose();
      }
    };
  }, [createOceanMaterial, createLightningBolt, onComplete]);

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* AI-Generated Video Overlays (Puter.ai) */}
      <VideoOverlayLayer
        elapsedMs={elapsedTime}
        isPlaying={!showVideoIntro}
        enabled={enableVideoOverlays}
        onGenerationProgress={setOverlayStatus}
      />
      
      {}
      {showVideoIntro && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            playsInline
            onEnded={() => setShowVideoIntro(false)}
            onError={() => setShowVideoIntro(false)}
            data-testid="video-intro"
          >
            <source src="/video/vidu-video-3123345404172935_1768470748871.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
          <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
            <p className="text-white/70 text-sm font-mono tracking-wider uppercase">
              The Shattered Seas await...
            </p>
          </div>
        </div>
      )}
      
      {/* Lightning flash overlay */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-75 z-10"
        style={{ 
          backgroundColor: `rgba(180, 200, 255, ${lightningFlash * 0.7})`,
          mixBlendMode: 'screen'
        }}
      />
      
      
      {/* Launch from wreck video overlay - dramatic transition during ship destruction */}
      <div 
        className="absolute inset-0 pointer-events-none z-13 flex items-center justify-center"
        style={{ 
          opacity: launchVideoOpacity,
          mixBlendMode: 'screen',
          display: launchVideoOpacity > 0 ? 'flex' : 'none'
        }}
        data-testid="launch-video-overlay"
      >
        <video
          ref={launchVideoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          loop
          preload="auto"
          data-testid="launch-video"
        >
          <source src="/video/Video_Project_9_1768624160562.mp4" type="video/mp4" />
        </video>
      </div>
      
      {/* Underwater fade overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-15 transition-opacity duration-300"
        style={{ 
          background: `linear-gradient(to bottom, 
            rgba(2, 20, 40, ${overlayOpacity * 0.3}), 
            rgba(5, 30, 60, ${overlayOpacity * 0.7}), 
            rgba(0, 10, 25, ${overlayOpacity * 0.9}))`,
          opacity: overlayOpacity
        }}
      />
      
      {/* Splash screen overlay - loading into Waterfall Isle */}
      {showSplashScreen && (
        <div 
          className="absolute inset-0 z-25 flex flex-col items-center justify-center transition-opacity duration-1000"
          style={{ 
            opacity: splashOpacity,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(10,20,30,0.85) 50%, rgba(0,0,0,0.95) 100%)'
          }}
          data-testid="splash-screen"
        >
          {/* Game title */}
          <h1 
            className="text-6xl md:text-9xl font-serif font-bold tracking-[0.2em] mb-8 text-center"
            style={{
              color: '#d4af37',
              textShadow: '0 0 40px rgba(212, 175, 55, 0.9), 0 0 80px rgba(212, 175, 55, 0.5), 0 0 120px rgba(212, 175, 55, 0.3), 4px 4px 8px rgba(0,0,0,0.95)',
              animation: 'pulse 3s ease-in-out infinite'
            }}
          >
            GRUDGE WARLORDS
          </h1>
          
          {/* Subtitle */}
          <p 
            className="text-xl md:text-3xl font-serif italic text-white/80 mb-12 tracking-wider"
            style={{
              textShadow: '2px 2px 8px rgba(0,0,0,0.9)'
            }}
          >
            Islands of the Shattered Seas
          </p>
          
          {/* Loading indicator */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-64 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 rounded-full"
                style={{ 
                  width: `${Math.min(100, splashOpacity * 100)}%`,
                  animation: 'shimmer 2s ease-in-out infinite'
                }}
              />
            </div>
            <p className="text-white/60 text-sm font-mono uppercase tracking-widest">
              Arriving at Waterfall Isle...
            </p>
          </div>
          
          {/* Floating survivor hint */}
          <div className="absolute bottom-20 left-0 right-0 text-center">
            <p className="text-white/40 text-xs font-mono">
              Against all odds, you survived...
            </p>
          </div>
        </div>
      )}
      
      {/* Story text overlay */}
      <div className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none z-20">
        <div 
          className={`text-center transition-all duration-500 ${
            currentText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {isTitle ? (
            <h1 
              className="text-5xl md:text-8xl font-serif font-bold tracking-[0.3em]"
              style={{
                color: '#d4af37',
                textShadow: '0 0 30px rgba(212, 175, 55, 0.9), 0 0 60px rgba(212, 175, 55, 0.5), 0 0 90px rgba(212, 175, 55, 0.3), 3px 3px 6px rgba(0,0,0,0.9)'
              }}
            >
              {currentText}
            </h1>
          ) : (
            <p 
              className="text-xl md:text-3xl font-serif italic text-white/90"
              style={{
                textShadow: '3px 3px 10px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.8)'
              }}
            >
              {currentText}
            </p>
          )}
        </div>
      </div>
      
      {}
      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4 z-10">
        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-white/60 text-sm font-mono min-w-[60px]">
          {Math.ceil((INTRO_DURATION - (progress / 100 * INTRO_DURATION)) / 1000)}s
        </span>
      </div>
      
      {}
      {showSkip && (
        <div className="absolute top-4 right-4 flex gap-2 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              if (newMuted) {
                stormAudioRef.current.mute();
              } else {
                stormAudioRef.current.unmute();
              }
              if (krakenSound1Ref.current) krakenSound1Ref.current.muted = newMuted;
              if (krakenSound2Ref.current) krakenSound2Ref.current.muted = newMuted;
              monsterAudioRef.current.setMuted(newMuted);
            }}
            className="text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-mute-toggle"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
          <Button
            variant="outline"
            onClick={handleSkip}
            className="text-white border-white/30 hover:bg-white/10"
            data-testid="button-skip-intro"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Skip
          </Button>
        </div>
      )}
      
      {}
      <div className="absolute top-4 left-4 text-white/50 text-sm font-mono z-10">
        {heroName}
      </div>
      
      {/* Debug Panel Toggle */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="absolute bottom-20 left-4 text-white/40 hover:text-white/80 text-xs z-30"
        data-testid="button-toggle-debug"
      >
        {showDebug ? 'Hide Debug' : 'Debug'}
      </button>
      
      {/* Debug Panel - Stonewisp Info */}
      {showDebug && (
        <div className="absolute top-16 left-4 bg-black/80 text-white p-3 rounded-lg z-30 font-mono text-xs space-y-1 max-w-xs">
          <div className="text-amber-400 font-bold mb-2">Stonewisp Debug</div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Loaded:</span>
            <span className={debugInfo.stoneWispLoaded ? 'text-green-400' : 'text-red-400'}>
              {debugInfo.stoneWispLoaded ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Mixer Active:</span>
            <span className={debugInfo.mixerActive ? 'text-green-400' : 'text-red-400'}>
              {debugInfo.mixerActive ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Phase:</span>
            <span className="text-cyan-400">{debugInfo.phase}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Animation:</span>
            <span className="text-yellow-400 truncate max-w-[120px]">{debugInfo.currentAnimation}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Anim Time:</span>
            <span className="text-white">{debugInfo.animationTime.toFixed(2)}s</span>
          </div>
          <div className="text-white/40 mt-2 border-t border-white/20 pt-1">Position:</div>
          <div className="text-white/80 pl-2">
            X: {debugInfo.stoneWispPosition.x.toFixed(1)} | 
            Y: {debugInfo.stoneWispPosition.y.toFixed(1)} | 
            Z: {debugInfo.stoneWispPosition.z.toFixed(1)}
          </div>
          <div className="text-white/40 mt-2 border-t border-white/20 pt-1 text-[10px]">
            Asset: stonewisp_beast/scene.gltf
          </div>
          <div className="text-white/40 text-[10px]">
            Anims: Swim → Intimidate · Tentacle tip IK (FABRIK)
          </div>
          <div className="text-cyan-400/80 text-[10px] mt-1">
            {overlayStatus || 'loading stonewisp…'}
          </div>
          
          {/* Video Overlay Section */}
          <div className="text-purple-400 font-bold mt-3 border-t border-white/20 pt-2">
            Puter AI Overlays
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Enabled:</span>
            <button 
              onClick={() => setEnableVideoOverlays(!enableVideoOverlays)}
              className={enableVideoOverlays ? 'text-green-400' : 'text-red-400'}
            >
              {enableVideoOverlays ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Status:</span>
            <span className="text-cyan-400 truncate max-w-[120px]">{overlayStatus || 'idle'}</span>
          </div>
          <div className="text-white/40 text-[10px] mt-1">
            4 atmospheric overlays: storm, mist, underwater, energy
          </div>
        </div>
      )}
    </div>
  );
}
