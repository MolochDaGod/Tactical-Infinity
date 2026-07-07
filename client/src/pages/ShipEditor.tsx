import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, Ship, Wind, Anchor, RotateCcw, Save, 
  Palette, Sun, Moon, ChevronUp, ChevronDown, RotateCw, Cloud,
  Move, Maximize2, RefreshCw, X, Paintbrush, Bone, Download, Trash2, Lock, Unlock, Lightbulb,
  ImageIcon, Crosshair, Shield, Gauge, Package, Swords, ArrowUpCircle, Eye, EyeOff
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { SHIP_MODEL_PATHS, DEFAULT_SHIP_CONFIG, applyShipTextures, TIER_TEXTURE_CONFIGS, createTieredSailMaterial } from '@/lib/shipPrefabs';
import { ClothSimulation, createClothGeometry, updateClothGeometry, type WindForce } from '@/lib/clothPhysics';
import { WeatherSystem, type WeatherState, type TimeOfDay } from '@/lib/weatherSystem';
import { DynamicOcean } from '@/lib/oceanShader';
import { RainSystem, LightningSystem } from '@/lib/rainSystem';
import { SkySystem, CelestialRenderer } from '@/lib/skySystem';
import { WeatherPanel, WeatherHUD } from '@/components/WeatherPanel';
import { AITexturePanel } from '@/components/AITexturePanel';
import { 
  type GridConfig, 
  DEFAULT_GRID_CONFIG, 
  createGridForObject, 
  createGridVisual, 
  snapToGrid,
  formatWorldPosition,
  formatGridPosition 
} from '@/lib/gridSystem';
import { 
  SHIP_TYPES as GAME_SHIP_DEFS,
  SHIP_CANNON_CONFIGS,
  CANNON_SKILLS,
  type CannonMount,
  type CannonMountType,
  type CannonSkillId,
  type ShipCannonConfig
} from '@shared/gameDefinitions/sailing';
import { resolveBoatId, type BoatId } from '@shared/gameDefinitions/boatRegistry';

interface ShipMeshInfo {
  name: string;
  type: ExtendedMeshType;
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  position: THREE.Vector3;
}

interface SailInstance {
  id: string;
  mesh: THREE.Mesh;
  clothSim: ClothSimulation;
  clothGeometry: THREE.BufferGeometry;
  clothMesh: THREE.Mesh;
  deployment: number;
  originalPosition: THREE.Vector3;
  mastMesh: THREE.Mesh | null;
  yOffset: number;           // Vertical offset from original position
  scale: number;             // Scale multiplier (1.0 = original)
  mastAttachHeight: number;  // Where on mast sail bottom attaches (0-100%)
  xOffset: number;           // Horizontal X offset
  zOffset: number;           // Horizontal Z offset
  rotation: number;          // Rotation around Y axis
}

interface MastInstance {
  id: string;
  mesh: THREE.Mesh;
  rotation: number;
  linkedSails: SailInstance[];
}

interface SkeletonPoint {
  id: string;
  position: THREE.Vector3;
  locked: boolean;
  mesh: THREE.Mesh;
  parentMeshName: string;
  connections: string[]; // IDs of connected points
}

interface SkeletonFrame {
  id: string;
  name: string;
  points: SkeletonPoint[];
  parentMeshName: string;
}

// Editor-only model catalog ids. This is a SUPERSET of the 5 canonical
// playable boats — it also exposes cosmetic-only hulls (rowboats, wreck,
// ghost, pirate skins) that can be edited but all map onto a real boat.
const EDITOR_SHIP_IDS = [
  'rowSmall', 'rowLarge',
  'small', 'pirateSmall',
  'medium', 'wreck',
  'pirateMedium', 'ghost',
  'large', 'pirateLarge',
] as const;

// DERIVED from the canonical boat registry — every editable model resolves
// to one real boat via resolveBoatId, so the editor no longer carries its
// own divergent ship-type truth.
const EDITOR_TO_GAME_SHIP: Record<string, BoatId> = Object.fromEntries(
  EDITOR_SHIP_IDS.map((id) => [id, resolveBoatId(id)]),
) as Record<string, BoatId>;

const MOUNT_TYPE_COLORS: Record<CannonMountType, number> = {
  'broadside-port': 0xff4444,
  'broadside-starboard': 0x4444ff,
  'bow': 0x44ff44,
  'stern': 0xffaa44,
  'swivel': 0xffff44,
};

const MOUNT_TYPE_LABELS: Record<CannonMountType, string> = {
  'broadside-port': 'Port',
  'broadside-starboard': 'Starboard',
  'bow': 'Bow',
  'stern': 'Stern',
  'swivel': 'Swivel',
};

interface CannonMeshEntry {
  mount: CannonMount;
  barrel: THREE.Mesh;
  base: THREE.Mesh;
  arcHelper: THREE.Mesh;
  group: THREE.Group;
  equipped: CannonSkillId | null;
}

const SHIP_UPGRADE_PATH = ['raft', 'skiff', 'sloop', 'brigantine', 'galleon'];

// Rowboat model paths
const ROWBOAT_MODEL_PATHS = {
  rowSmall: '/models/props/boat-row-small.glb',
  rowLarge: '/models/props/boat-row-large.glb',
};

// Ship types with proper in-game scale values (not normalized - reflects actual size differences)
// Scale is the target size in world units after loading
// Tier corresponds to game progression: 1=starter, 2=early, 3=mid, 4=late, 5=endgame
const SHIP_TYPES = [
  // Rowboats (smallest)
  { id: 'rowSmall', name: 'Small Rowboat', path: ROWBOAT_MODEL_PATHS.rowSmall, gameScale: 2, tier: 0 },
  { id: 'rowLarge', name: 'Large Rowboat', path: ROWBOAT_MODEL_PATHS.rowLarge, gameScale: 3, tier: 0 },
  // Basic ships
  { id: 'small', name: 'Small Ship (Raft)', path: SHIP_MODEL_PATHS.small, gameScale: 4, tier: 1 },
  { id: 'pirateSmall', name: 'Pirate Sloop', path: SHIP_MODEL_PATHS.pirateSmall, gameScale: 6, tier: 2 },
  { id: 'medium', name: 'Medium Ship (Sloop)', path: SHIP_MODEL_PATHS.medium, gameScale: 8, tier: 3 },
  { id: 'wreck', name: 'Shipwreck', path: SHIP_MODEL_PATHS.wreck, gameScale: 10, tier: 3 },
  { id: 'pirateMedium', name: 'Pirate Brigantine', path: SHIP_MODEL_PATHS.pirateMedium, gameScale: 10, tier: 4 },
  { id: 'ghost', name: 'Ghost Ship', path: SHIP_MODEL_PATHS.ghost, gameScale: 12, tier: 4 },
  // Large ships
  { id: 'large', name: 'Large Ship (Galleon)', path: SHIP_MODEL_PATHS.large, gameScale: 14, tier: 5 },
  { id: 'pirateLarge', name: 'Pirate Galleon', path: SHIP_MODEL_PATHS.pirateLarge, gameScale: 14, tier: 5 },
];

const SAIL_KEYWORDS = ['sail', 'canvas', 'cloth', 'fabric'];
const MAST_KEYWORDS = ['mast', 'pole', 'spar', 'boom', 'yard'];
const HULL_KEYWORDS = ['hull', 'body', 'base', 'ship', 'boat'];
const DECK_KEYWORDS = ['deck', 'floor', 'platform', 'plank'];
const TRIM_KEYWORDS = ['railing', 'rail', 'banister', 'trim', 'edge', 'rim', 'border', 'fence', 'guard', 'handrail', 'balustrade'];
const BOW_KEYWORDS = ['bow', 'front', 'nose', 'prow', 'figurehead'];
const STERN_KEYWORDS = ['stern', 'back', 'rear', 'aft', 'quarter', 'cabin'];
const FLAG_KEYWORDS = ['flag', 'banner', 'pennant', 'ensign'];
const RIGGING_KEYWORDS = ['rope', 'rigging', 'line', 'shroud', 'stay'];

// Extended ship part type for better organization
type ExtendedMeshType = 'sail' | 'mast' | 'hull' | 'deck' | 'trim' | 'bow' | 'stern' | 'flag' | 'rigging' | 'other';

// Intelligent texture prompt templates for each part type
const AI_TEXTURE_PROMPTS: Record<ExtendedMeshType, { base: string; materials: string[]; styles: string[] }> = {
  hull: {
    base: 'ship hull wooden planks exterior curved surface',
    materials: ['oak wood grain', 'mahogany deep red', 'weathered driftwood', 'dark ebony'],
    styles: ['pirate battle-worn', 'royal polished', 'merchant sturdy', 'ghost ethereal'],
  },
  deck: {
    base: 'ship deck flat wooden planks walking surface',
    materials: ['teak planks', 'pine boards', 'bamboo slats', 'aged oak'],
    styles: ['scrubbed clean', 'salt-stained', 'blood-splattered', 'ghostly translucent'],
  },
  mast: {
    base: 'ship mast tall wooden pole vertical beam',
    materials: ['solid oak trunk', 'pine pole', 'bamboo segments', 'bone-white'],
    styles: ['tarred waterproof', 'sun-bleached', 'carved ornate', 'spectral glow'],
  },
  sail: {
    base: 'ship sail billowing canvas cloth fabric',
    materials: ['linen canvas', 'silk smooth', 'leather patched', 'tattered rags'],
    styles: ['skull and crossbones', 'royal crest', 'plain merchant', 'ghostly tattered'],
  },
  trim: {
    base: 'ship trim decorative railing ornamental',
    materials: ['brass metalwork', 'gold leaf', 'iron wrought', 'carved wood'],
    styles: ['baroque ornate', 'minimal functional', 'skull motif', 'celestial symbols'],
  },
  bow: {
    base: 'ship bow front curved prow figurehead area',
    materials: ['reinforced oak', 'bronze plated', 'bone carved', 'coral encrusted'],
    styles: ['dragon figurehead', 'mermaid carving', 'skull and bones', 'angel wings'],
  },
  stern: {
    base: 'ship stern rear cabin windows gallery',
    materials: ['ornate wood panels', 'stained glass', 'gilded frames', 'weathered planks'],
    styles: ['captain quarters', 'treasure room', 'ghost cabin', 'merchant storage'],
  },
  flag: {
    base: 'ship flag banner pennant fabric waving',
    materials: ['silk embroidered', 'cotton dyed', 'leather hide', 'tattered cloth'],
    styles: ['jolly roger skull', 'royal lion crest', 'merchant guild', 'mysterious runes'],
  },
  rigging: {
    base: 'ship rigging rope lines nautical',
    materials: ['hemp rope natural', 'tarred rope black', 'silk lines thin', 'chain metal'],
    styles: ['weathered sailor', 'new pristine', 'ghost spectral', 'barnacle covered'],
  },
  other: {
    base: 'nautical ship part detail',
    materials: ['mixed materials'],
    styles: ['varied style'],
  },
};

// Wood color palette for hull, bow, deck
const WOOD_COLORS = [
  { name: 'Oak Brown', color: 0x8b4513 },
  { name: 'Dark Mahogany', color: 0x4a2c2a },
  { name: 'Teak', color: 0xc19a6b },
  { name: 'Walnut', color: 0x5c4033 },
  { name: 'Cherry', color: 0x7b3f00 },
  { name: 'Ebony', color: 0x1a1110 },
  { name: 'Driftwood Gray', color: 0x8b8682 },
  { name: 'Charred Black', color: 0x2a1a0a },
];

// Legacy alias for backwards compatibility
const SHIP_COLORS = WOOD_COLORS;

// Mast pole colors (typically darker/tarred wood)
const MAST_COLORS = [
  { name: 'Dark Oak', color: 0x5c3a21 },
  { name: 'Tarred Pine', color: 0x2a1a10 },
  { name: 'Weathered Gray', color: 0x6b6b6b },
  { name: 'Mahogany', color: 0x4a2c2a },
  { name: 'Bamboo', color: 0xc4a35a },
  { name: 'Bone White', color: 0xdbd7d2 },
];

// Cloth colors for sails
const SAIL_COLORS = [
  { name: 'White Canvas', color: 0xffffff },
  { name: 'Cream', color: 0xfffdd0 },
  { name: 'Gold', color: 0xffd700 },
  { name: 'Crimson', color: 0xdc143c },
  { name: 'Black', color: 0x1a1a1a },
  { name: 'Ghostly Blue', color: 0x88aacc },
  { name: 'Emerald', color: 0x50c878 },
  { name: 'Royal Purple', color: 0x7b1fa2 },
  { name: 'Navy Blue', color: 0x1a2a4a },
];

// Flag/banner colors (brighter, heraldic)
const FLAG_COLORS = [
  { name: 'Crimson Red', color: 0xdc143c },
  { name: 'Royal Blue', color: 0x1a4ed8 },
  { name: 'Gold', color: 0xffd700 },
  { name: 'Emerald Green', color: 0x2e8b57 },
  { name: 'Pure White', color: 0xffffff },
  { name: 'Jet Black', color: 0x0a0a0a },
  { name: 'Purple', color: 0x800080 },
  { name: 'Orange', color: 0xff8c00 },
];

// Trim/rail colors (metallic)
const TRIM_COLORS = [
  { name: 'Brass', color: 0xb5a642 },
  { name: 'Bronze', color: 0xcd7f32 },
  { name: 'Gold Leaf', color: 0xdaa520 },
  { name: 'Silver', color: 0xc0c0c0 },
  { name: 'Copper', color: 0xb87333 },
  { name: 'Ebony Black', color: 0x2b2b2b },
  { name: 'Ivory White', color: 0xfffff0 },
  { name: 'Iron Gray', color: 0x4a4a4a },
];

// Figurehead/ornament colors (metallic, painted, or gilded)
const FIGUREHEAD_COLORS = [
  { name: 'Gold Leaf', color: 0xdaa520 },
  { name: 'Bronze', color: 0xcd7f32 },
  { name: 'Silver', color: 0xc0c0c0 },
  { name: 'Painted White', color: 0xf5f5f5 },
  { name: 'Ebony', color: 0x1a1110 },
  { name: 'Bone', color: 0xdbd7d2 },
  { name: 'Copper Green', color: 0x2e8b57 },
  { name: 'Blood Red', color: 0x8b0000 },
];

// Ship types that have extra sails (boom/gaff needed)
const SHIPS_WITH_MULTIPLE_SAILS = ['medium', 'large', 'pirateMedium', 'pirateLarge', 'ghost'];
const SHIPS_WITH_SINGLE_SAIL = ['small', 'pirateSmall', 'wreck'];
// Ships that have NO sails at all (rowboats) - skip boom/gaff and cloth simulation
const SHIPS_WITHOUT_SAILS = ['rowSmall', 'rowLarge'];

// DEFAULT_SHIP_CONFIG is now imported from @/lib/shipPrefabs for consistency

type TextureEffect = 'none' | 'wood_grain' | 'weathered' | 'polished' | 'barnacles' | 'charred';

const TEXTURE_EFFECTS: { id: TextureEffect; name: string; description: string }[] = [
  { id: 'none', name: 'None', description: 'No texture effect' },
  { id: 'wood_grain', name: 'Wood Grain', description: 'Natural wood grain pattern' },
  { id: 'weathered', name: 'Weathered', description: 'Aged, worn appearance' },
  { id: 'polished', name: 'Polished', description: 'Smooth, shiny finish' },
  { id: 'barnacles', name: 'Barnacles', description: 'Sea-worn with barnacles' },
  { id: 'charred', name: 'Charred', description: 'Fire-damaged look' },
];

export default function ShipEditor({ onBack }: { onBack: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const animationIdRef = useRef<number | null>(null);
  const shipModelRef = useRef<THREE.Group | null>(null);
  const gltfLoaderRef = useRef<GLTFLoader>(new GLTFLoader());
  
  // Use refs to avoid stale closures in animation loop
  const sailsRef = useRef<SailInstance[]>([]);
  const mastsRef = useRef<MastInstance[]>([]);
  
  // Transform gizmo refs
  const transformControlsRef = useRef<TransformControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const selectedObjectRef = useRef<THREE.Object3D | null>(null);
  const outlineHelperRef = useRef<THREE.BoxHelper | null>(null);
  const meshListRef = useRef<ShipMeshInfo[]>([]);

  // Weather system refs
  const weatherSystemRef = useRef<WeatherSystem>(new WeatherSystem());
  const oceanRef = useRef<DynamicOcean | null>(null);
  const rainSystemRef = useRef<RainSystem | null>(null);
  const lightningSystemRef = useRef<LightningSystem | null>(null);
  const skySystemRef = useRef<SkySystem | null>(null);
  const celestialRef = useRef<CelestialRenderer | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);

  const [selectedShipType, setSelectedShipType] = useState<string>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [meshList, setMeshList] = useState<ShipMeshInfo[]>([]);
  const [selectedMesh, setSelectedMesh] = useState<ShipMeshInfo | null>(null);
  const [sails, setSails] = useState<SailInstance[]>([]);
  const [masts, setMasts] = useState<MastInstance[]>([]);
  
  const [windDirection, setWindDirection] = useState(0);
  const [windStrength, setWindStrength] = useState(5);
  const [windTurbulence, setWindTurbulence] = useState(0.3);
  
  // === COMPREHENSIVE COLOR CUSTOMIZATION ===
  // Wood colors (hull, bow, deck, mast pole, figurehead) - using DEFAULT_SHIP_CONFIG
  const [hullColor, setHullColor] = useState<number>(DEFAULT_SHIP_CONFIG.hullColor);
  const [bowColor, setBowColor] = useState<number>(DEFAULT_SHIP_CONFIG.bowColor);
  const [deckColor, setDeckColor] = useState<number>(DEFAULT_SHIP_CONFIG.deckColor);
  const [mastColor, setMastColor] = useState<number>(DEFAULT_SHIP_CONFIG.mastColor);
  const [trimColor, setTrimColor] = useState<number>(DEFAULT_SHIP_CONFIG.trimColor);
  const [figureheadColor, setFigureheadColor] = useState<number>(DEFAULT_SHIP_CONFIG.figureheadColor);
  
  // Cloth colors (sails, flags, front cloth) - using DEFAULT_SHIP_CONFIG
  const [sailColor, setSailColor] = useState<number>(DEFAULT_SHIP_CONFIG.sailColor);
  const [flagColor, setFlagColor] = useState<number>(DEFAULT_SHIP_CONFIG.flagColor);
  const [clothAccentColor, setClothAccentColor] = useState<number>(DEFAULT_SHIP_CONFIG.clothAccentColor);
  
  // Texture effects
  const [hullTextureEffect, setHullTextureEffect] = useState<TextureEffect>('none');
  const [trimTextureEffect, setTrimTextureEffect] = useState<TextureEffect>('none');
  
  // Custom user textures (replaces purple/green hull colors)
  const [customHullTexture1, setCustomHullTexture1] = useState<string | null>(null);
  const [customHullTexture2, setCustomHullTexture2] = useState<string | null>(null);
  
  // Custom sail image (PNG uploader, replaces blue sail)
  const [customSailImage, setCustomSailImage] = useState<string | null>(null);
  
  // Hull depth control for waterline adjustment
  const [hullDepth, setHullDepth] = useState(0);
  const hullDepthRef = useRef(0);
  
  // Shader effects
  const [fresnelIntensity, setFresnelIntensity] = useState(0.3);
  const [emissionIntensity, setEmissionIntensity] = useState(0);
  const [metallicValue, setMetallicValue] = useState(0.1);
  const [roughnessValue, setRoughnessValue] = useState(0.7);
  
  const [activeTab, setActiveTab] = useState('ships');
  const [webglError, setWebglError] = useState<string | null>(null);
  
  // Gizmo state - ENABLED BY DEFAULT for easy part manipulation
  type GizmoMode = 'translate' | 'rotate' | 'scale';
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [gizmoEnabled, setGizmoEnabled] = useState(true);
  const [selectedPartColor, setSelectedPartColor] = useState<string>('#888888');

  // Weather state
  const [weatherState, setWeatherState] = useState<WeatherState>('clear');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('noon');
  const [waveHeight, setWaveHeight] = useState(0.15);
  const [stormIntensity, setStormIntensity] = useState(0);
  const [visibility, setVisibility] = useState(1);

  const keysPressed = useRef<Set<string>>(new Set());

  const [cannonMeshes, setCannonMeshes] = useState<CannonMeshEntry[]>([]);
  const cannonMeshesRef = useRef<CannonMeshEntry[]>([]);
  const [showCannons, setShowCannons] = useState(true);
  const [showCannonArcs, setShowCannonArcs] = useState(false);
  const [selectedCannonId, setSelectedCannonId] = useState<string | null>(null);

  // Figurehead/Bow light state
  const [figureheadLightEnabled, setFigureheadLightEnabled] = useState(true);
  const [figureheadLightColor, setFigureheadLightColor] = useState('#ffcc00');
  const [figureheadLightIntensity, setFigureheadLightIntensity] = useState(2);
  const [figureheadLightDistance, setFigureheadLightDistance] = useState(15);
  const figureheadLightRef = useRef<THREE.PointLight | null>(null);
  const figureheadGlowRef = useRef<THREE.Mesh | null>(null);
  
  // Skeleton/Frame editor state
  const [skeletonMode, setSkeletonMode] = useState(false);
  const [skeletonPoints, setSkeletonPoints] = useState<SkeletonPoint[]>([]);
  const [selectedSkeletonPoint, setSelectedSkeletonPoint] = useState<SkeletonPoint | null>(null);
  const [skeletonParentMesh, setSkeletonParentMesh] = useState<string>('');
  const [skeletonGridPlane, setSkeletonGridPlane] = useState<'xy' | 'xz' | 'yz'>('xz');
  const [skeletonGridOffset, setSkeletonGridOffset] = useState(0);
  const skeletonPointsRef = useRef<SkeletonPoint[]>([]);
  const skeletonGridHelperRef = useRef<THREE.GridHelper | THREE.Mesh | null>(null);
  const skeletonPlaneRef = useRef<THREE.Mesh | null>(null);
  const skeletonLinesRef = useRef<THREE.LineSegments | null>(null);
  const currentGridConfigRef = useRef<GridConfig>(DEFAULT_GRID_CONFIG);
  const shipGroupRef = useRef<THREE.Group | null>(null); // Reference to the loaded ship group

  const identifyMeshType = (name: string): ExtendedMeshType => {
    const lowerName = name.toLowerCase();
    // Check more specific types first
    if (BOW_KEYWORDS.some(k => lowerName.includes(k))) return 'bow';
    if (STERN_KEYWORDS.some(k => lowerName.includes(k))) return 'stern';
    if (FLAG_KEYWORDS.some(k => lowerName.includes(k))) return 'flag';
    if (RIGGING_KEYWORDS.some(k => lowerName.includes(k))) return 'rigging';
    if (SAIL_KEYWORDS.some(k => lowerName.includes(k))) return 'sail';
    if (MAST_KEYWORDS.some(k => lowerName.includes(k))) return 'mast';
    if (TRIM_KEYWORDS.some(k => lowerName.includes(k))) return 'trim';
    if (HULL_KEYWORDS.some(k => lowerName.includes(k))) return 'hull';
    if (DECK_KEYWORDS.some(k => lowerName.includes(k))) return 'deck';
    return 'other';
  };

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    // Check for WebGL support first
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      setWebglError('WebGL is not supported in your browser. Please use a modern browser with WebGL support to use the Ship Editor.');
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x1a1a2e : 0x87ceeb);
    scene.fog = new THREE.Fog(theme === 'dark' ? 0x1a1a2e : 0x87ceeb, 50, 150);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      500
    );
    camera.position.set(10, 8, 15);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      setWebglError('Failed to create WebGL context. Your browser may not support WebGL or it may be disabled.');
      return;
    }
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(30, 50, 30);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.4);
    scene.add(hemisphereLight);

    // Dynamic Ocean with Gerstner waves
    const ocean = new DynamicOcean(300, 128);
    ocean.mesh.position.y = -0.5;
    scene.add(ocean.mesh);
    oceanRef.current = ocean;

    // Sky system
    const skySystem = new SkySystem();
    skySystem.init(scene);
    skySystemRef.current = skySystem;

    // Celestial renderer (stars, moon)
    const celestial = new CelestialRenderer();
    celestial.init(scene);
    celestialRef.current = celestial;

    // Rain system (initially inactive)
    const rainSystem = new RainSystem({ count: 0, intensity: 0 });
    rainSystem.init(scene);
    rainSystemRef.current = rainSystem;

    // Lightning system
    const lightning = new LightningSystem();
    lightning.init(scene);
    lightningSystemRef.current = lightning;

    const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    // Initialize TransformControls (gizmo) for editing individual mesh parts
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.setSize(1.0);
    // Add TransformControls to scene (required for it to work)
    scene.add(transformControls as unknown as THREE.Object3D);
    transformControlsRef.current = transformControls;
    
    // Disable orbit controls while using gizmo
    transformControls.addEventListener('dragging-changed', (event) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
    });
  }, [theme]);

  const loadShipModel = useCallback(async (shipType: string) => {
    if (!sceneRef.current) return;

    setIsLoading(true);
    const shipInfo = SHIP_TYPES.find(s => s.id === shipType);
    if (!shipInfo) {
      setIsLoading(false);
      return;
    }

    // Deselect any selected part before loading new model
    if (selectedObjectRef.current) {
      transformControlsRef.current?.detach();
      selectedObjectRef.current = null;
      if (outlineHelperRef.current) {
        sceneRef.current.remove(outlineHelperRef.current);
        outlineHelperRef.current = null;
      }
    }
    setSelectedMesh(null);
    
    // Cleanup previous model and sail meshes
    if (shipModelRef.current) {
      sceneRef.current.remove(shipModelRef.current);
      shipModelRef.current = null;
    }
    
    // Dispose and remove existing cloth meshes
    sailsRef.current.forEach((sail) => {
      if (sail.clothMesh) {
        sceneRef.current?.remove(sail.clothMesh);
        sail.clothGeometry.dispose();
        (sail.clothMesh.material as THREE.Material).dispose();
      }
      // Show original sail mesh again
      sail.mesh.visible = true;
    });
    
    sailsRef.current = [];
    mastsRef.current = [];
    setSails([]);
    setMasts([]);
    setMeshList([]);

    try {
      const gltf = await gltfLoaderRef.current.loadAsync(shipInfo.path);
      const model = gltf.scene;
      
      model.rotation.y = Math.PI;
      model.position.set(0, 0, 0);
      
      // Use the ship's gameScale to set proper in-game size proportions
      // This ensures ships display at their actual relative sizes
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetScale = shipInfo.gameScale || 8; // Fallback to 8 if no gameScale defined
      const scale = targetScale / maxDim;
      model.scale.setScalar(scale);
      
      console.log(`Ship ${shipInfo.name}: size=${maxDim.toFixed(2)}, targetScale=${targetScale}, finalScale=${scale.toFixed(3)}`);
      
      // Apply realistic wood, cloth, rope and metal textures to all ship parts
      const shipTier = shipInfo.tier || 3;
      await applyShipTextures(model, shipType, shipTier);
      console.log(`Applied ship textures to ${shipInfo.name}`);
      
      const newMeshList: ShipMeshInfo[] = [];
      const newSails: SailInstance[] = [];
      const newMasts: MastInstance[] = [];

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          const meshType = identifyMeshType(child.name);
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          
          newMeshList.push({
            name: child.name,
            type: meshType,
            mesh: child,
            originalMaterial: child.material,
            position: worldPos.clone(),
          });

          if (meshType === 'mast') {
            newMasts.push({
              id: `mast-${newMasts.length}`,
              mesh: child,
              rotation: 0,
              linkedSails: [],
            });
          }
        }
      });

      // Create sails AFTER masts are collected for proper mast linking
      // Skip sail creation for ships without sails (rowboats)
      const shouldSkipSails = SHIPS_WITHOUT_SAILS.includes(shipType);
      const shouldSkipBoomGaff = shouldSkipSails || SHIPS_WITH_SINGLE_SAIL.includes(shipType);
      
      if (!shouldSkipSails) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const meshType = identifyMeshType(child.name);
            if (meshType === 'sail') {
              const sailInstance = createSailPhysics(child, newSails.length, newMasts, !shouldSkipBoomGaff);
              if (sailInstance) {
                newSails.push(sailInstance);
                sceneRef.current?.add(sailInstance.clothMesh);
              }
            }
          }
        });
      }

      // Link sails to their closest masts
      newMasts.forEach((mast) => {
        const mastPos = new THREE.Vector3();
        mast.mesh.getWorldPosition(mastPos);
        
        newSails.forEach((sail) => {
          const sailPos = sail.originalPosition;
          const horizontalDist = Math.sqrt(
            Math.pow(mastPos.x - sailPos.x, 2) + Math.pow(mastPos.z - sailPos.z, 2)
          );
          if (horizontalDist < 5) {
            mast.linkedSails.push(sail);
            sail.mastMesh = mast.mesh;
          }
        });
      });

      setMeshList(newMeshList);
      setSails(newSails);
      setMasts(newMasts);
      
      // Update refs for animation loop (avoids stale closure)
      sailsRef.current = newSails;
      mastsRef.current = newMasts;
      meshListRef.current = newMeshList;
      
      sceneRef.current.add(model);
      shipModelRef.current = model;
      shipGroupRef.current = model; // Store reference for grid centering

      console.log(`Loaded ${shipInfo.name}: ${newMeshList.length} meshes, ${newSails.length} sails, ${newMasts.length} masts`);
      
      // === APPLY DEFAULT SHIP COLORS ===
      // Apply consistent default colors to all ship parts for a polished look
      newMeshList.forEach((info) => {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (!material.color) return;
        
        switch (info.type) {
          case 'hull':
            material.color.setHex(DEFAULT_SHIP_CONFIG.hullColor);
            break;
          case 'bow':
            material.color.setHex(DEFAULT_SHIP_CONFIG.bowColor);
            break;
          case 'deck':
            material.color.setHex(DEFAULT_SHIP_CONFIG.deckColor);
            break;
          case 'mast':
            material.color.setHex(DEFAULT_SHIP_CONFIG.mastColor);
            break;
          case 'sail':
            material.color.setHex(DEFAULT_SHIP_CONFIG.sailColor);
            break;
          case 'flag':
            material.color.setHex(DEFAULT_SHIP_CONFIG.flagColor);
            break;
          case 'rigging':
          case 'trim':
            material.color.setHex(DEFAULT_SHIP_CONFIG.trimColor);
            break;
          default:
            // Other mesh types keep their original colors
            break;
        }
      });
      
      // Apply default sail color to cloth simulation meshes
      const tierTexConfig = TIER_TEXTURE_CONFIGS[Math.min(5, Math.max(1, shipInfo.tier || 3))];
      newSails.forEach((sail) => {
        const material = sail.clothMesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(tierTexConfig?.sailColor || DEFAULT_SHIP_CONFIG.sailColor);
        }
      });
      
      console.log('Applied default ship colors');

      spawnCannonMounts(shipType, model);
      
      // Recreate skeleton grid to center on the newly loaded ship
      if (activeTab === 'skeleton') {
        createSkeletonGridPlane();
      }
    } catch (error) {
      console.error('Failed to load ship model:', error);
    }

    setIsLoading(false);
  }, []);

  const spawnCannonMounts = useCallback((editorShipId: string, shipGroup: THREE.Group) => {
    cannonMeshesRef.current.forEach(c => {
      shipGroup.remove(c.group);
      c.barrel.geometry.dispose();
      c.base.geometry.dispose();
      c.arcHelper.geometry.dispose();
      (c.barrel.material as THREE.Material).dispose();
      (c.base.material as THREE.Material).dispose();
      (c.arcHelper.material as THREE.Material).dispose();
    });
    cannonMeshesRef.current = [];

    const gameId = EDITOR_TO_GAME_SHIP[editorShipId] || 'sloop';
    const config = SHIP_CANNON_CONFIGS[gameId];
    if (!config || config.mounts.length === 0) {
      setCannonMeshes([]);
      return;
    }

    const shipInfo = SHIP_TYPES.find(s => s.id === editorShipId);
    const scaleRatio = (shipInfo?.gameScale || 8) / 14;

    const entries: CannonMeshEntry[] = config.mounts.map(mount => {
      const grp = new THREE.Group();
      grp.name = `cannon_${mount.id}`;

      const barrelGeo = new THREE.CylinderGeometry(0.12 * scaleRatio, 0.15 * scaleRatio, 1.2 * scaleRatio, 8);
      barrelGeo.rotateX(Math.PI / 2);
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.set(0, 0.15 * scaleRatio, 0.4 * scaleRatio);
      barrel.castShadow = true;

      const baseGeo = new THREE.BoxGeometry(0.5 * scaleRatio, 0.25 * scaleRatio, 0.6 * scaleRatio);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.castShadow = true;

      const arcAngle = (mount.arcWidth * Math.PI) / 180;
      const arcGeo = new THREE.RingGeometry(0, 1.5 * scaleRatio, 24, 1, -arcAngle / 2 + Math.PI / 2, arcAngle);
      const arcMat = new THREE.MeshBasicMaterial({
        color: MOUNT_TYPE_COLORS[mount.type],
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.rotation.x = -Math.PI / 2;
      arcMesh.position.y = 0.05;
      arcMesh.visible = false;

      grp.add(barrel);
      grp.add(base);
      grp.add(arcMesh);

      const [px, py, pz] = mount.localPosition;
      grp.position.set(px * scaleRatio, py * scaleRatio, pz * scaleRatio);

      const facingRad = (mount.arcCenter * Math.PI) / 180;
      grp.rotation.y = -facingRad;

      shipGroup.add(grp);

      const saved = JSON.parse(localStorage.getItem('tethical_cannon_loadouts') || '{}');
      const shipLoadout = saved[editorShipId] || {};
      const equipped = shipLoadout[mount.id] || null;

      return { mount, barrel, base, arcHelper: arcMesh, group: grp, equipped };
    });

    cannonMeshesRef.current = entries;
    setCannonMeshes(entries);
    console.log(`Spawned ${entries.length} cannon mounts for ${gameId}`);
  }, []);

  const equipCannon = useCallback((mountId: string, skillId: CannonSkillId | null) => {
    const entry = cannonMeshesRef.current.find(c => c.mount.id === mountId);
    if (!entry) return;
    entry.equipped = skillId;

    if (skillId) {
      const skill = CANNON_SKILLS[skillId];
      (entry.barrel.material as THREE.MeshStandardMaterial).color.setHex(skill.color === 0x222222 ? 0x444444 : skill.color);
      (entry.barrel.material as THREE.MeshStandardMaterial).emissive.setHex(skill.color);
      (entry.barrel.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
    } else {
      (entry.barrel.material as THREE.MeshStandardMaterial).color.setHex(0x333333);
      (entry.barrel.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    }

    setCannonMeshes([...cannonMeshesRef.current]);

    const saved = JSON.parse(localStorage.getItem('tethical_cannon_loadouts') || '{}');
    if (!saved[selectedShipType]) saved[selectedShipType] = {};
    saved[selectedShipType][mountId] = skillId;
    localStorage.setItem('tethical_cannon_loadouts', JSON.stringify(saved));
  }, [selectedShipType]);

  const toggleCannonArcs = useCallback((show: boolean) => {
    setShowCannonArcs(show);
    cannonMeshesRef.current.forEach(c => { c.arcHelper.visible = show; });
  }, []);

  const toggleCannonsVisible = useCallback((show: boolean) => {
    setShowCannons(show);
    cannonMeshesRef.current.forEach(c => { c.group.visible = show; });
  }, []);

  const createSailPhysics = (sailMesh: THREE.Mesh, _index: number, mastList: MastInstance[], createBoomGaff: boolean = true): SailInstance | null => {
    const shipInfoForSail = SHIP_TYPES.find(s => s.id === selectedShipType);
    const shipTierForSail = shipInfoForSail?.tier || 3;
    const box = new THREE.Box3().setFromObject(sailMesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const width = Math.max(size.x, size.z);
    const height = size.y;
    const segmentsX = Math.max(8, Math.floor(width * 4));
    const segmentsY = Math.max(10, Math.floor(height * 4));

    const clothSim = new ClothSimulation(width, height, segmentsX, segmentsY);
    
    // IMPORTANT: Connect the sail to the boom (bottom edge) and gaff (top edge)
    // This pins the foot of the sail to the boom spar
    // Top edge (gaff) - where sail attaches to horizontal spar at top
    // Bottom edge (boom) - the horizontal spar holding the foot of the sail
    // Left edge (mast) - where sail luff attaches to the mast
    clothSim.pinForGaffRig(); // Pins left (mast), top (gaff), and bottom (boom)
    
    // Set proper gaff and boom positions
    // Gaff is at top of sail, boom is at bottom
    const gaffY = center.y + height / 2;  // Top of sail
    const boomY = center.y - height / 2;  // Bottom of sail (boom position)
    clothSim.setGaffRigPositions(gaffY, boomY);
    
    const clothGeometry = createClothGeometry(clothSim);

    const tierConfigForSail = TIER_TEXTURE_CONFIGS[Math.min(5, Math.max(1, shipTierForSail))];

    const clothMaterial = new THREE.MeshStandardMaterial({
      color: tierConfigForSail?.sailColor || sailColor,
      side: THREE.DoubleSide,
      transparent: tierConfigForSail ? tierConfigForSail.sailOpacity < 1.0 : true,
      opacity: tierConfigForSail?.sailOpacity || 0.95,
      roughness: tierConfigForSail?.sailRoughness || 0.8,
      metalness: 0,
    });

    const clothMesh = new THREE.Mesh(clothGeometry, clothMaterial);
    
    // Find the closest mast to position sail at proper height
    let closestMastMesh: THREE.Mesh | undefined = undefined;
    let minDist = Infinity;
    
    for (const mast of mastList) {
      const mastPos = new THREE.Vector3();
      mast.mesh.getWorldPosition(mastPos);
      const horizontalDist = Math.sqrt(
        Math.pow(mastPos.x - center.x, 2) + Math.pow(mastPos.z - center.z, 2)
      );
      if (horizontalDist < minDist) {
        minDist = horizontalDist;
        closestMastMesh = mast.mesh;
      }
    }
    
    // Create visual boom and gaff meshes (spars that hold the sail)
    // Only create for ships that need them (larger sailing vessels)
    if (createBoomGaff) {
      const boomLength = width * 1.1; // Slightly longer than sail width
      const boomRadius = 0.08;
      const boomGeometry = new THREE.CylinderGeometry(boomRadius, boomRadius * 0.9, boomLength, 8);
      boomGeometry.rotateZ(Math.PI / 2); // Rotate to horizontal
      const boomMaterial = new THREE.MeshStandardMaterial({
        color: DEFAULT_SHIP_CONFIG.mastColor, // Use default mast color
        roughness: 0.9,
        metalness: 0.05,
      });
      const boomMesh = new THREE.Mesh(boomGeometry, boomMaterial);
      boomMesh.position.set(center.x, boomY, center.z);
      boomMesh.castShadow = true;
      
      // Create a visual gaff mesh (the spar at the top of the sail)
      const gaffLength = width * 0.9;
      const gaffGeometry = new THREE.CylinderGeometry(boomRadius * 0.8, boomRadius * 0.6, gaffLength, 8);
      gaffGeometry.rotateZ(Math.PI / 2);
      const gaffMesh = new THREE.Mesh(gaffGeometry, boomMaterial.clone());
      gaffMesh.position.set(center.x, gaffY, center.z);
      gaffMesh.castShadow = true;
      
      // Add boom and gaff to scene
      if (sceneRef.current) {
        sceneRef.current.add(boomMesh);
        sceneRef.current.add(gaffMesh);
      }
    }
    
    // Position cloth sail at the ORIGINAL static sail position
    // This preserves the exact placement from the model file
    clothMesh.position.copy(center);
    
    // Rotate sail to face towards the back of the ship (stern)
    // Sails should extend behind the mast, not in front
    clothMesh.rotation.y = Math.PI;
    
    clothMesh.castShadow = true;
    clothMesh.receiveShadow = true;

    // Hide the static sail mesh completely
    sailMesh.visible = false;
    sailMesh.layers.set(1); // Move to invisible layer

    return {
      id: `sail-${_index}`,
      mesh: sailMesh,
      clothSim,
      clothGeometry,
      clothMesh,
      deployment: 100,
      originalPosition: clothMesh.position.clone(),
      mastMesh: closestMastMesh || null,
      yOffset: 0,
      scale: 1.0,
      mastAttachHeight: 50,  // Default: middle of mast
      xOffset: 0,
      zOffset: 0,
      rotation: Math.PI,  // Default: facing stern (back of ship)
    };
  };

  const updateSailDeployment = (sail: SailInstance, deployment: number) => {
    sail.deployment = Math.max(0, Math.min(100, deployment));
    const deployRatio = sail.deployment / 100;
    sail.clothMesh.scale.y = Math.max(0.01, deployRatio) * sail.scale;
    sail.clothMesh.visible = deployment > 5;
  };
  
  const updateSailYOffset = (sail: SailInstance, yOffset: number) => {
    sail.yOffset = yOffset;
    sail.clothMesh.position.y = sail.originalPosition.y + yOffset - hullDepthRef.current;
  };
  
  const updateSailScale = (sail: SailInstance, scale: number) => {
    sail.scale = scale;
    sail.clothMesh.scale.setScalar(scale);
    // Reapply deployment to account for scale
    const deployRatio = sail.deployment / 100;
    sail.clothMesh.scale.y = Math.max(0.01, deployRatio) * scale;
  };
  
  const updateSailXOffset = (sail: SailInstance, xOffset: number) => {
    sail.xOffset = xOffset;
    sail.clothMesh.position.x = sail.originalPosition.x + xOffset;
  };
  
  const updateSailZOffset = (sail: SailInstance, zOffset: number) => {
    sail.zOffset = zOffset;
    sail.clothMesh.position.z = sail.originalPosition.z + zOffset;
  };
  
  const updateSailRotation = (sail: SailInstance, rotation: number) => {
    sail.rotation = rotation;
    sail.clothMesh.rotation.y = rotation;
  };
  
  const updateSailMastAttach = (sail: SailInstance, attachHeight: number) => {
    sail.mastAttachHeight = attachHeight;
    // Calculate Y position based on mast height percentage
    if (sail.mastMesh) {
      const mastBox = new THREE.Box3().setFromObject(sail.mastMesh);
      const mastHeight = mastBox.max.y - mastBox.min.y;
      const attachY = mastBox.min.y + (mastHeight * attachHeight / 100);
      sail.clothMesh.position.y = attachY + sail.yOffset - hullDepthRef.current;
    }
  };

  const rotateMast = (mast: MastInstance, deltaAngle: number) => {
    mast.rotation += deltaAngle;
    mast.mesh.rotation.y = mast.rotation;
    
    mast.linkedSails.forEach((sail) => {
      sail.clothMesh.rotation.y = mast.rotation;
    });
  };

  const updateHullDepth = (depth: number) => {
    setHullDepth(depth);
    hullDepthRef.current = depth;
    
    if (shipModelRef.current) {
      shipModelRef.current.position.y = -depth;
      
      // Update cloth sail positions to follow ship
      sailsRef.current.forEach((sail) => {
        sail.clothMesh.position.y = sail.originalPosition.y - depth;
      });
    }
  };

  const applyShaderEffects = (metallic: number, roughness: number, emission: number) => {
    const applyToMaterial = (material: THREE.Material) => {
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
        material.metalness = metallic;
        material.roughness = roughness;
        if (emission > 0) {
          material.emissive = new THREE.Color(hullColor);
          material.emissiveIntensity = emission;
        } else {
          material.emissiveIntensity = 0;
        }
        material.needsUpdate = true;
      }
    };

    meshList.forEach((info) => {
      const mat = info.mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach(applyToMaterial);
      } else if (mat) {
        applyToMaterial(mat);
      }
    });
  };

  // Store wind settings in refs for animation loop
  const windRef = useRef({ direction: windDirection, strength: windStrength, turbulence: windTurbulence });
  useEffect(() => {
    windRef.current = { direction: windDirection, strength: windStrength, turbulence: windTurbulence };
  }, [windDirection, windStrength, windTurbulence]);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    const delta = Math.min(clockRef.current.getDelta(), 0.05);

    // Use refs to avoid stale closures
    const currentMasts = mastsRef.current;
    const currentSails = sailsRef.current;
    const wind = windRef.current;

    if (keysPressed.current.has('q') || keysPressed.current.has('e')) {
      const rotationSpeed = 1.5 * delta;
      const direction = keysPressed.current.has('q') ? 1 : -1;
      currentMasts.forEach((mast) => {
        mast.rotation += rotationSpeed * direction;
        mast.mesh.rotation.y = mast.rotation;
        mast.linkedSails.forEach((sail) => {
          sail.clothMesh.rotation.y = mast.rotation;
        });
      });
    }

    const windRad = (wind.direction * Math.PI) / 180;
    const windForce: WindForce = {
      direction: new THREE.Vector3(Math.sin(windRad), 0, Math.cos(windRad)),
      strength: wind.strength,
      turbulence: wind.turbulence,
    };

    currentSails.forEach((sail) => {
      if (sail.deployment > 5) {
        sail.clothSim.applyWind(windForce);
        sail.clothSim.update(delta);
        updateClothGeometry(sail.clothGeometry, sail.clothSim);
      }
    });

    // Update weather system
    const weather = weatherSystemRef.current;
    weather.update(delta);
    const envState = weather.getState();
    const elapsedTime = clockRef.current.getElapsedTime();

    // Update ocean with weather
    if (oceanRef.current) {
      const oceanUniforms = weather.getOceanUniforms();
      oceanRef.current.update(elapsedTime, oceanUniforms);
    }

    // Update sky system
    if (skySystemRef.current) {
      skySystemRef.current.update(elapsedTime);
      skySystemRef.current.setSkyColors(envState.skyColor, envState.horizonColor);
      skySystemRef.current.setSunPosition(envState.sunPosition);
      skySystemRef.current.setCloudDensity(envState.weather.cloudDensity);
      skySystemRef.current.setStormIntensity(weather.getStormIntensity());
      skySystemRef.current.setDayProgress(envState.dayProgress);
      if (cameraRef.current) {
        skySystemRef.current.followCamera(cameraRef.current.position);
      }
    }

    // Update celestial objects
    if (celestialRef.current) {
      celestialRef.current.update(elapsedTime);
      celestialRef.current.setMoonPosition(envState.moonPosition);
      celestialRef.current.setMoonPhase(envState.moonPhase);
      const isNight = envState.timeOfDay === 'night' || envState.timeOfDay === 'midnight';
      celestialRef.current.setNightVisibility(isNight ? 1 : 0);
    }

    // Update rain system
    if (rainSystemRef.current && cameraRef.current) {
      rainSystemRef.current.update(elapsedTime, cameraRef.current.position);
      rainSystemRef.current.setWindDirection(windForce.direction);
      rainSystemRef.current.setWindStrength(wind.strength);
    }

    // Update lightning
    if (lightningSystemRef.current) {
      lightningSystemRef.current.update(delta);
      if (weather.shouldTriggerLightning()) {
        lightningSystemRef.current.triggerLightning(weather.getStormIntensity());
      }
    }

    // Update sun light position
    if (directionalLightRef.current) {
      directionalLightRef.current.position.copy(envState.sunPosition);
      directionalLightRef.current.color.copy(envState.sunColor);
      directionalLightRef.current.intensity = 0.5 + (1 - weather.getStormIntensity()) * 0.7;
    }

    controlsRef.current?.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    animationIdRef.current = requestAnimationFrame(animate);
  }, []); // No dependencies - uses refs

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysPressed.current.add(e.key.toLowerCase());
    
    // Gizmo mode shortcuts
    if (e.key === 'g' || e.key === 'G') {
      setGizmoMode('translate');
      transformControlsRef.current?.setMode('translate');
    } else if (e.key === 'r' || e.key === 'R') {
      setGizmoMode('rotate');
      transformControlsRef.current?.setMode('rotate');
    } else if (e.key === 's' || e.key === 'S') {
      if (!e.ctrlKey && !e.metaKey) {
        setGizmoMode('scale');
        transformControlsRef.current?.setMode('scale');
      }
    } else if (e.key === 'Escape') {
      deselectPart();
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysPressed.current.delete(e.key.toLowerCase());
  }, []);
  
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current || !gizmoEnabled) return;
    if (!shipModelRef.current) return;
    
    // Don't select if clicking on gizmo
    if (transformControlsRef.current?.dragging) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    const meshes: THREE.Mesh[] = [];
    shipModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });
    
    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    
    if (intersects.length > 0) {
      const hitObject = intersects[0].object as THREE.Mesh;
      selectPart(hitObject);
    }
  }, [gizmoEnabled]);
  
  const selectPart = useCallback((mesh: THREE.Mesh) => {
    if (!sceneRef.current) return;
    
    // Update state - use ref to avoid stale closure
    const meshInfo = meshListRef.current.find(m => m.mesh === mesh);
    if (meshInfo) {
      setSelectedMesh(meshInfo);
      
      // Get current color
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.color) {
        setSelectedPartColor('#' + material.color.getHexString());
      }
    }
    
    // Attach gizmo
    selectedObjectRef.current = mesh;
    transformControlsRef.current?.attach(mesh);
    
    // Add outline helper
    if (outlineHelperRef.current) {
      sceneRef.current.remove(outlineHelperRef.current);
    }
    const boxHelper = new THREE.BoxHelper(mesh, 0xffff00);
    sceneRef.current.add(boxHelper);
    outlineHelperRef.current = boxHelper;
  }, []);
  
  const deselectPart = () => {
    if (!sceneRef.current) return;
    
    transformControlsRef.current?.detach();
    selectedObjectRef.current = null;
    setSelectedMesh(null);
    
    if (outlineHelperRef.current) {
      sceneRef.current.remove(outlineHelperRef.current);
      outlineHelperRef.current = null;
    }
  };
  
  const changeGizmoMode = (mode: GizmoMode) => {
    setGizmoMode(mode);
    transformControlsRef.current?.setMode(mode);
  };
  
  const applyPartColor = (colorHex: string) => {
    if (!selectedObjectRef.current) return;
    
    setSelectedPartColor(colorHex);
    const mesh = selectedObjectRef.current as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    
    if (material.color) {
      material.color.setStyle(colorHex);
    }
    
    // Update outline
    if (outlineHelperRef.current) {
      outlineHelperRef.current.update();
    }
  };

  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  // === COMPREHENSIVE COLOR APPLICATION FUNCTIONS ===
  
  // Apply color to hull sides/bottom only (not deck)
  const applyHullColor = (color: number) => {
    setHullColor(color);
    meshList.forEach((info) => {
      // Hull = main ship body, not including deck
      if (info.type === 'hull') {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };
  
  // Apply color to bow wood (front area of ship)
  const applyBowColor = (color: number) => {
    setBowColor(color);
    meshList.forEach((info) => {
      if (info.type === 'bow') {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };
  
  // Apply color to deck planks
  const applyDeckColor = (color: number) => {
    setDeckColor(color);
    meshList.forEach((info) => {
      if (info.type === 'deck') {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };
  
  // Apply color to mast poles (not crow's nest or flags)
  const applyMastColor = (color: number) => {
    setMastColor(color);
    meshList.forEach((info) => {
      if (info.type === 'mast') {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
    // Also color the boom and gaff (sail spars)
    // These are created by sail physics, stored in scene
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry) {
          // Boom and gaff meshes use CylinderGeometry
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.color && mat.roughness > 0.8) { // Wood material
            mat.color.setHex(color);
          }
        }
      });
    }
  };
  
  // Apply color to all cloth sails
  const applySailColor = (color: number) => {
    setSailColor(color);
    sailsRef.current.forEach((sail) => {
      const material = sail.clothMesh.material as THREE.MeshStandardMaterial;
      if (material.color) {
        material.color.setHex(color);
      }
    });
  };
  
  // Apply color to flags and pennants
  const applyFlagColor = (color: number) => {
    setFlagColor(color);
    meshList.forEach((info) => {
      if (info.type === 'flag') {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };
  
  // Apply color to cloth accents (front cloth, banners)
  const applyClothAccentColor = (color: number) => {
    setClothAccentColor(color);
    // Apply to any additional cloth meshes that aren't main sails or flags
    meshList.forEach((info) => {
      const name = info.name.toLowerCase();
      if (name.includes('cloth') || name.includes('banner') || name.includes('drape') || name.includes('curtain')) {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };
  
  // Apply color to figurehead/prow carving
  const applyFigureheadColor = (color: number) => {
    setFigureheadColor(color);
    meshList.forEach((info) => {
      const name = info.name.toLowerCase();
      // Match figurehead, prow carvings, dragon heads, etc.
      if (name.includes('figurehead') || name.includes('prow') || name.includes('carving') || 
          name.includes('dragon') || name.includes('ornament') || name.includes('decoration')) {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };
  
  // Handle custom hull texture upload (PNG/JPG)
  const handleCustomHullTextureUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (slot === 1) {
        setCustomHullTexture1(dataUrl);
      } else {
        setCustomHullTexture2(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Apply custom hull texture from slot
  const applyCustomHullTexture = (textureDataUrl: string) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(textureDataUrl, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      
      meshList.forEach((info) => {
        if (info.type === 'hull' || info.type === 'deck' || info.type === 'bow' || info.type === 'stern') {
          const material = info.mesh.material as THREE.MeshStandardMaterial;
          material.map = texture;
          material.needsUpdate = true;
        }
      });
      
      toast({
        title: "Texture Applied",
        description: "Custom hull texture has been applied to the ship.",
      });
    });
  };
  
  // Handle custom sail image upload (PNG)
  const handleCustomSailImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate it's a PNG
    if (!file.type.includes('png') && !file.type.includes('image')) {
      toast({
        title: "Invalid File",
        description: "Please upload a PNG image for the sail.",
        variant: "destructive",
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCustomSailImage(dataUrl);
      applyCustomSailImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };
  
  // Apply custom sail image
  const applyCustomSailImage = (imageDataUrl: string) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageDataUrl, (texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      
      sailsRef.current.forEach((sail) => {
        const material = sail.clothMesh.material as THREE.MeshStandardMaterial;
        material.map = texture;
        material.color.setHex(0xffffff); // Reset to white so texture shows properly
        material.needsUpdate = true;
      });
      
      toast({
        title: "Sail Image Applied",
        description: "Custom sail image has been applied to all sails.",
      });
    });
  };

  const applyTrimColor = (color: number) => {
    setTrimColor(color);
    meshList.forEach((info) => {
      if (info.type === 'trim') {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        if (material.color) {
          material.color.setHex(color);
        }
      }
    });
  };

  const applyTextureEffect = (effect: TextureEffect, targetType: 'hull' | 'trim') => {
    if (targetType === 'hull') {
      setHullTextureEffect(effect);
    } else {
      setTrimTextureEffect(effect);
    }

    const baseColor = targetType === 'hull' ? hullColor : trimColor;

    meshList.forEach((info) => {
      if ((targetType === 'hull' && (info.type === 'hull' || info.type === 'deck')) ||
          (targetType === 'trim' && info.type === 'trim')) {
        const material = info.mesh.material as THREE.MeshStandardMaterial;
        
        material.color.setHex(baseColor);
        material.roughness = roughnessValue;
        material.metalness = metallicValue;
        material.bumpScale = 1;
        material.emissiveIntensity = emissionIntensity;
        
        switch (effect) {
          case 'wood_grain':
            material.roughness = 0.8;
            material.metalness = 0.0;
            material.bumpScale = 0.05;
            break;
          case 'weathered':
            material.roughness = 0.95;
            material.metalness = 0.0;
            material.emissiveIntensity = 0;
            break;
          case 'polished':
            material.roughness = 0.2;
            material.metalness = 0.3;
            break;
          case 'barnacles':
            material.roughness = 0.9;
            material.metalness = 0.1;
            material.bumpScale = 0.1;
            break;
          case 'charred':
            material.roughness = 0.85;
            material.metalness = 0.0;
            const charredColor = new THREE.Color(baseColor);
            charredColor.multiplyScalar(0.4);
            material.color.copy(charredColor);
            break;
          case 'none':
          default:
            break;
        }
        material.needsUpdate = true;
      }
    });
  };

  const raiseSails = () => {
    sailsRef.current.forEach((sail) => {
      updateSailDeployment(sail, 100);
    });
    setSails([...sailsRef.current]);
  };

  const lowerSails = () => {
    sailsRef.current.forEach((sail) => {
      updateSailDeployment(sail, 0);
    });
    setSails([...sailsRef.current]);
  };

  // ========== FIGUREHEAD/BOW LIGHT FUNCTIONS ==========
  
  const createFigureheadLight = useCallback(() => {
    if (!sceneRef.current || !shipModelRef.current) return;
    
    // Remove existing light and glow
    if (figureheadLightRef.current) {
      sceneRef.current.remove(figureheadLightRef.current);
      figureheadLightRef.current.dispose();
    }
    if (figureheadGlowRef.current) {
      sceneRef.current.remove(figureheadGlowRef.current);
      figureheadGlowRef.current.geometry.dispose();
      (figureheadGlowRef.current.material as THREE.Material).dispose();
    }
    
    if (!figureheadLightEnabled) return;
    
    // Find bow position (front of ship)
    const shipBounds = new THREE.Box3().setFromObject(shipModelRef.current);
    const shipCenter = shipBounds.getCenter(new THREE.Vector3());
    const shipSize = shipBounds.getSize(new THREE.Vector3());
    
    // Position light at the bow (front-most point + slightly above deck)
    // Ship models have bow facing +Z in original orientation
    // After 180° rotation (Math.PI), the bow is at max.z in world space
    const bowPosition = new THREE.Vector3(
      shipCenter.x,
      shipCenter.y + shipSize.y * 0.3, // Above deck level
      shipBounds.max.z + 0.5 // Front of ship (bow is at max.z after rotation)
    );
    
    // Create point light
    const color = new THREE.Color(figureheadLightColor);
    const light = new THREE.PointLight(color, figureheadLightIntensity, figureheadLightDistance);
    light.position.copy(bowPosition);
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    sceneRef.current.add(light);
    figureheadLightRef.current = light;
    
    // Create glowing sphere to represent the figurehead light source
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.copy(bowPosition);
    sceneRef.current.add(glowMesh);
    figureheadGlowRef.current = glowMesh;
  }, [figureheadLightEnabled, figureheadLightColor, figureheadLightIntensity, figureheadLightDistance]);
  
  const updateFigureheadLight = useCallback(() => {
    if (!figureheadLightRef.current || !figureheadGlowRef.current) return;
    
    const color = new THREE.Color(figureheadLightColor);
    figureheadLightRef.current.color.copy(color);
    figureheadLightRef.current.intensity = figureheadLightIntensity;
    figureheadLightRef.current.distance = figureheadLightDistance;
    
    (figureheadGlowRef.current.material as THREE.MeshBasicMaterial).color.copy(color);
    
    figureheadLightRef.current.visible = figureheadLightEnabled;
    figureheadGlowRef.current.visible = figureheadLightEnabled;
  }, [figureheadLightEnabled, figureheadLightColor, figureheadLightIntensity, figureheadLightDistance]);
  
  // Update figurehead light when parameters change
  useEffect(() => {
    if (figureheadLightRef.current && figureheadGlowRef.current) {
      updateFigureheadLight();
    }
  }, [figureheadLightEnabled, figureheadLightColor, figureheadLightIntensity, figureheadLightDistance, updateFigureheadLight]);
  
  // Generate intelligent AI texture prompt for a part type
  const generateSmartTexturePrompt = useCallback((partType: ExtendedMeshType, style: string, material: string): string => {
    const templates = AI_TEXTURE_PROMPTS[partType];
    return `${templates.base}, ${material}, ${style}, seamless texture, tileable, game asset, high detail`;
  }, []);

  const resetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(10, 8, 15);
      controlsRef.current.target.set(0, 2, 0);
      controlsRef.current.update();
    }
  };

  // ========== SKELETON/FRAME EDITOR FUNCTIONS ==========
  
  const createSkeletonGridPlane = useCallback(() => {
    if (!sceneRef.current) return;
    
    // Remove existing grid
    if (skeletonGridHelperRef.current) {
      sceneRef.current.remove(skeletonGridHelperRef.current);
    }
    if (skeletonPlaneRef.current) {
      sceneRef.current.remove(skeletonPlaneRef.current);
    }
    
    // Create grid config centered on the ship asset
    let gridConfig: GridConfig;
    
    if (shipGroupRef.current) {
      // Create grid centered on the loaded ship
      gridConfig = createGridForObject(shipGroupRef.current, skeletonGridPlane, 0.5, 3);
      // Apply the manual offset adjustment
      gridConfig.offset += skeletonGridOffset;
    } else {
      // Fallback to default world-space grid
      gridConfig = {
        ...DEFAULT_GRID_CONFIG,
        plane: skeletonGridPlane,
        offset: skeletonGridOffset,
        gridSize: 20,
      };
    }
    
    // Store current config for snapping and coordinate display
    currentGridConfigRef.current = gridConfig;
    
    // Create the visual grid using the universal grid system
    const { gridHelper, plane } = createGridVisual(gridConfig);
    
    sceneRef.current.add(gridHelper);
    sceneRef.current.add(plane);
    
    skeletonGridHelperRef.current = gridHelper;
    skeletonPlaneRef.current = plane;
  }, [skeletonGridPlane, skeletonGridOffset]);
  
  const createSkeletonPoint = useCallback((position: THREE.Vector3): SkeletonPoint => {
    const pointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const pointMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600, // Orange = unlocked
      emissive: 0x331100,
      emissiveIntensity: 0.3,
    });
    const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
    pointMesh.position.copy(position);
    pointMesh.castShadow = true;
    
    if (sceneRef.current) {
      sceneRef.current.add(pointMesh);
    }
    
    const point: SkeletonPoint = {
      id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: position.clone(),
      locked: false,
      mesh: pointMesh,
      parentMeshName: skeletonParentMesh,
      connections: [],
    };
    
    return point;
  }, [skeletonParentMesh]);
  
  const lockSkeletonPoint = useCallback((point: SkeletonPoint) => {
    point.locked = true;
    const material = point.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(0x00ff00); // Green = locked
    material.emissive.setHex(0x003300);
    material.needsUpdate = true;
    
    // Update the points list
    setSkeletonPoints(prev => prev.map(p => p.id === point.id ? { ...p, locked: true } : p));
    skeletonPointsRef.current = skeletonPointsRef.current.map(p => 
      p.id === point.id ? { ...p, locked: true } : p
    );
  }, []);
  
  const unlockSkeletonPoint = useCallback((point: SkeletonPoint) => {
    point.locked = false;
    const material = point.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(0xff6600); // Orange = unlocked
    material.emissive.setHex(0x331100);
    material.needsUpdate = true;
    
    // Detach from transform controls if selected
    if (transformControlsRef.current && selectedObjectRef.current === point.mesh) {
      transformControlsRef.current.detach();
      selectedObjectRef.current = null;
    }
    
    // Update the points list
    setSkeletonPoints(prev => prev.map(p => p.id === point.id ? { ...p, locked: false } : p));
    skeletonPointsRef.current = skeletonPointsRef.current.map(p => 
      p.id === point.id ? { ...p, locked: false } : p
    );
  }, []);
  
  const deleteSkeletonPoint = useCallback((point: SkeletonPoint) => {
    if (sceneRef.current) {
      sceneRef.current.remove(point.mesh);
      point.mesh.geometry.dispose();
      (point.mesh.material as THREE.Material).dispose();
    }
    
    // Detach from transform controls if selected
    if (transformControlsRef.current && selectedObjectRef.current === point.mesh) {
      transformControlsRef.current.detach();
      selectedObjectRef.current = null;
    }
    
    setSkeletonPoints(prev => prev.filter(p => p.id !== point.id));
    skeletonPointsRef.current = skeletonPointsRef.current.filter(p => p.id !== point.id);
    setSelectedSkeletonPoint(null);
  }, []);
  
  const clearAllSkeletonPoints = useCallback(() => {
    skeletonPointsRef.current.forEach(point => {
      if (sceneRef.current) {
        sceneRef.current.remove(point.mesh);
        point.mesh.geometry.dispose();
        (point.mesh.material as THREE.Material).dispose();
      }
    });
    
    if (transformControlsRef.current) {
      transformControlsRef.current.detach();
    }
    selectedObjectRef.current = null;
    
    setSkeletonPoints([]);
    skeletonPointsRef.current = [];
    setSelectedSkeletonPoint(null);
  }, []);
  
  const updateSkeletonLines = useCallback(() => {
    if (!sceneRef.current) return;
    
    // Remove old lines
    if (skeletonLinesRef.current) {
      sceneRef.current.remove(skeletonLinesRef.current);
      skeletonLinesRef.current.geometry.dispose();
      (skeletonLinesRef.current.material as THREE.Material).dispose();
    }
    
    const points = skeletonPointsRef.current;
    if (points.length < 2) return;
    
    // Create line geometry connecting all locked points in order
    const lockedPoints = points.filter(p => p.locked);
    if (lockedPoints.length < 2) return;
    
    const positions: number[] = [];
    for (let i = 0; i < lockedPoints.length - 1; i++) {
      positions.push(
        lockedPoints[i].mesh.position.x,
        lockedPoints[i].mesh.position.y,
        lockedPoints[i].mesh.position.z,
        lockedPoints[i + 1].mesh.position.x,
        lockedPoints[i + 1].mesh.position.y,
        lockedPoints[i + 1].mesh.position.z
      );
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({ 
      color: 0x00ffff, 
      linewidth: 2 
    });
    
    const lines = new THREE.LineSegments(geometry, material);
    sceneRef.current.add(lines);
    skeletonLinesRef.current = lines;
  }, []);
  
  const handleSkeletonClick = useCallback((event: MouseEvent) => {
    if (!skeletonMode || !containerRef.current || !cameraRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    mouseRef.current.set(x, y);
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // Check if we clicked on an existing point
    const pointMeshes = skeletonPointsRef.current.map(p => p.mesh);
    const pointIntersects = raycasterRef.current.intersectObjects(pointMeshes);
    
    if (pointIntersects.length > 0) {
      const clickedMesh = pointIntersects[0].object as THREE.Mesh;
      const clickedPoint = skeletonPointsRef.current.find(p => p.mesh === clickedMesh);
      
      if (clickedPoint) {
        if (event.shiftKey) {
          // Shift+click = lock point
          lockSkeletonPoint(clickedPoint);
          updateSkeletonLines();
          toast({ title: "Point Locked", description: "Point is now locked. Use gizmo to move it." });
        } else if (event.button === 2) {
          // Right-click = unlock point
          unlockSkeletonPoint(clickedPoint);
          updateSkeletonLines();
          toast({ title: "Point Unlocked", description: "Point is now unlocked." });
        } else if (clickedPoint.locked) {
          // Left-click on locked point = select for gizmo
          setSelectedSkeletonPoint(clickedPoint);
          if (transformControlsRef.current) {
            transformControlsRef.current.attach(clickedPoint.mesh);
            selectedObjectRef.current = clickedPoint.mesh;
          }
        }
        return;
      }
    }
    
    // Left-click on grid plane = place new point
    if (event.button === 0 && !event.shiftKey && skeletonPlaneRef.current) {
      const planeIntersects = raycasterRef.current.intersectObject(skeletonPlaneRef.current);
      
      if (planeIntersects.length > 0) {
        const rawPoint = planeIntersects[0].point;
        
        // Use universal grid system for snapping
        const snappedPoint = snapToGrid(rawPoint, currentGridConfigRef.current);
        
        const newPoint = createSkeletonPoint(snappedPoint);
        skeletonPointsRef.current.push(newPoint);
        setSkeletonPoints([...skeletonPointsRef.current]);
        
        // Show both world and grid coordinates
        const gridCoords = formatGridPosition(snappedPoint, currentGridConfigRef.current);
        const worldCoords = formatWorldPosition(snappedPoint);
        
        toast({ 
          title: "Point Added", 
          description: `Grid: ${gridCoords} | World: ${worldCoords}` 
        });
      }
    }
  }, [skeletonMode, createSkeletonPoint, lockSkeletonPoint, unlockSkeletonPoint, updateSkeletonLines, toast]);
  
  const handleSkeletonContextMenu = useCallback((event: MouseEvent) => {
    if (!skeletonMode) return;
    event.preventDefault();
    
    // Handle right-click unlock in the main click handler
    handleSkeletonClick(event);
  }, [skeletonMode, handleSkeletonClick]);
  
  const exportSkeletonData = useCallback(() => {
    const data = {
      name: `skeleton_${skeletonParentMesh || 'custom'}`,
      parentMesh: skeletonParentMesh,
      plane: skeletonGridPlane,
      offset: skeletonGridOffset,
      points: skeletonPointsRef.current.map(p => ({
        id: p.id,
        position: [p.mesh.position.x, p.mesh.position.y, p.mesh.position.z],
        locked: p.locked,
        connections: p.connections,
      })),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Skeleton Exported", description: "Skeleton data saved to JSON file." });
  }, [skeletonParentMesh, skeletonGridPlane, skeletonGridOffset, toast]);
  
  // Toggle skeleton mode
  useEffect(() => {
    if (skeletonMode) {
      createSkeletonGridPlane();
      
      // Add event listeners
      const container = containerRef.current;
      if (container) {
        container.addEventListener('click', handleSkeletonClick);
        container.addEventListener('contextmenu', handleSkeletonContextMenu);
      }
    } else {
      // Remove grid when skeleton mode is off
      if (sceneRef.current) {
        if (skeletonGridHelperRef.current) {
          sceneRef.current.remove(skeletonGridHelperRef.current);
          skeletonGridHelperRef.current = null;
        }
        if (skeletonPlaneRef.current) {
          sceneRef.current.remove(skeletonPlaneRef.current);
          skeletonPlaneRef.current = null;
        }
      }
      
      // Remove event listeners
      const container = containerRef.current;
      if (container) {
        container.removeEventListener('click', handleSkeletonClick);
        container.removeEventListener('contextmenu', handleSkeletonContextMenu);
      }
    }
    
    return () => {
      const container = containerRef.current;
      if (container) {
        container.removeEventListener('click', handleSkeletonClick);
        container.removeEventListener('contextmenu', handleSkeletonContextMenu);
      }
    };
  }, [skeletonMode, createSkeletonGridPlane, handleSkeletonClick, handleSkeletonContextMenu]);
  
  // Update grid when plane/offset changes
  useEffect(() => {
    if (skeletonMode) {
      createSkeletonGridPlane();
    }
  }, [skeletonGridPlane, skeletonGridOffset, skeletonMode, createSkeletonGridPlane]);

  const saveShipCustomization = () => {
    // Collect all mesh transforms and colors
    const meshData = meshListRef.current.map((info) => {
      const material = info.mesh.material as THREE.MeshStandardMaterial;
      return {
        name: info.name,
        type: info.type,
        position: info.mesh.position.toArray(),
        rotation: [info.mesh.rotation.x, info.mesh.rotation.y, info.mesh.rotation.z],
        scale: info.mesh.scale.toArray(),
        color: material.color ? '#' + material.color.getHexString() : null,
      };
    });

    const sailData = sailsRef.current.map((sail) => ({
      id: sail.id,
      deployment: sail.deployment,
      yOffset: sail.yOffset,
      xOffset: sail.xOffset,
      zOffset: sail.zOffset,
      scale: sail.scale,
      rotation: sail.rotation,
      mastAttachHeight: sail.mastAttachHeight,
    }));

    const mastData = mastsRef.current.map((mast) => ({
      id: mast.id,
      rotation: mast.rotation,
    }));

    const saveData = {
      shipType: selectedShipType,
      hullColor,
      sailColor,
      trimColor,
      hullTextureEffect,
      trimTextureEffect,
      hullDepth,
      metallicValue,
      roughnessValue,
      emissionIntensity,
      meshes: meshData,
      sails: sailData,
      masts: mastData,
      // Figurehead light settings
      figureheadLight: {
        enabled: figureheadLightEnabled,
        color: figureheadLightColor,
        intensity: figureheadLightIntensity,
        distance: figureheadLightDistance,
      },
      // Custom user textures
      customTextures: {
        hull1: customHullTexture1,
        hull2: customHullTexture2,
        sailImage: customSailImage,
      },
      cannonLoadout: cannonMeshesRef.current.reduce((acc, c) => {
        if (c.equipped) acc[c.mount.id] = c.equipped;
        return acc;
      }, {} as Record<string, CannonSkillId>),
      savedAt: new Date().toISOString(),
    };

    const savedShips = JSON.parse(localStorage.getItem('tethical_ship_customizations') || '{}');
    savedShips[selectedShipType] = saveData;
    localStorage.setItem('tethical_ship_customizations', JSON.stringify(savedShips));

    toast({
      title: "Ship Saved",
      description: `${SHIP_TYPES.find(s => s.id === selectedShipType)?.name || 'Ship'} customizations saved successfully.`,
    });
  };
  
  const applyShipToGame = () => {
    // Save the customization first
    saveShipCustomization();
    
    // Mark this ship type as the active one for use in the game
    const activeShips = JSON.parse(localStorage.getItem('tethical_active_ships') || '{}');
    activeShips[selectedShipType] = {
      active: true,
      appliedAt: new Date().toISOString(),
    };
    localStorage.setItem('tethical_active_ships', JSON.stringify(activeShips));
    
    // Also save as the player's ship if it's a player-usable type
    if (['small', 'medium', 'large', 'pirateSmall', 'pirateMedium', 'pirateLarge'].includes(selectedShipType)) {
      localStorage.setItem('tethical_player_ship', selectedShipType);
    }
    
    toast({
      title: "Applied to Game!",
      description: `${SHIP_TYPES.find(s => s.id === selectedShipType)?.name || 'Ship'} will now be used in the world map. Reload the game to see changes.`,
    });
  };
  
  const loadSavedCustomization = () => {
    const savedShips = JSON.parse(localStorage.getItem('tethical_ship_customizations') || '{}');
    const savedData = savedShips[selectedShipType];
    if (!savedData) return;
    
    // Apply saved sail data
    if (savedData.sails && sailsRef.current.length > 0) {
      savedData.sails.forEach((savedSail: any, idx: number) => {
        if (idx < sailsRef.current.length) {
          const sail = sailsRef.current[idx];
          if (savedSail.deployment !== undefined) updateSailDeployment(sail, savedSail.deployment);
          if (savedSail.yOffset !== undefined) updateSailYOffset(sail, savedSail.yOffset);
          if (savedSail.xOffset !== undefined) updateSailXOffset(sail, savedSail.xOffset);
          if (savedSail.zOffset !== undefined) updateSailZOffset(sail, savedSail.zOffset);
          if (savedSail.scale !== undefined) updateSailScale(sail, savedSail.scale);
          if (savedSail.rotation !== undefined) updateSailRotation(sail, savedSail.rotation);
          if (savedSail.mastAttachHeight !== undefined) updateSailMastAttach(sail, savedSail.mastAttachHeight);
        }
      });
      setSails([...sailsRef.current]);
    }
    
    // Apply saved colors
    if (savedData.hullColor) {
      setHullColor(savedData.hullColor);
      applyHullColor(savedData.hullColor);
    }
    if (savedData.sailColor) {
      setSailColor(savedData.sailColor);
      applySailColor(savedData.sailColor);
    }
    if (savedData.trimColor) {
      setTrimColor(savedData.trimColor);
      applyTrimColor(savedData.trimColor);
    }
    if (savedData.hullTextureEffect) {
      applyTextureEffect(savedData.hullTextureEffect, 'hull');
    }
    if (savedData.trimTextureEffect) {
      applyTextureEffect(savedData.trimTextureEffect, 'trim');
    }
    if (savedData.hullDepth !== undefined) {
      updateHullDepth(savedData.hullDepth);
    }
    
    // Apply figurehead light settings
    if (savedData.figureheadLight) {
      setFigureheadLightEnabled(savedData.figureheadLight.enabled ?? true);
      setFigureheadLightColor(savedData.figureheadLight.color ?? '#ffcc00');
      setFigureheadLightIntensity(savedData.figureheadLight.intensity ?? 2);
      setFigureheadLightDistance(savedData.figureheadLight.distance ?? 15);
      // Recreate the light with loaded settings after a short delay
      setTimeout(() => createFigureheadLight(), 200);
    }
    
    // Restore custom textures
    if (savedData.customTextures) {
      if (savedData.customTextures.hull1) {
        setCustomHullTexture1(savedData.customTextures.hull1);
      }
      if (savedData.customTextures.hull2) {
        setCustomHullTexture2(savedData.customTextures.hull2);
      }
      if (savedData.customTextures.sailImage) {
        setCustomSailImage(savedData.customTextures.sailImage);
        setTimeout(() => applyCustomSailImage(savedData.customTextures.sailImage), 300);
      }
    }
    
    toast({
      title: "Loaded Saved",
      description: "Previous customizations have been restored.",
    });
  };

  // Weather change handlers
  const handleWeatherChange = (newWeather: WeatherState) => {
    setWeatherState(newWeather);
    weatherSystemRef.current.setWeather(newWeather, 3000);
    
    const envState = weatherSystemRef.current.getState();
    setWaveHeight(envState.weather.waveHeight);
    setStormIntensity(weatherSystemRef.current.getStormIntensity());
    setVisibility(envState.weather.visibility);
    
    // Update rain intensity
    if (rainSystemRef.current) {
      rainSystemRef.current.setIntensity(envState.weather.rainIntensity);
    }
  };

  const handleTimeChange = (newTime: TimeOfDay) => {
    setTimeOfDay(newTime);
    weatherSystemRef.current.setTimeOfDay(newTime);
  };

  const handleWeatherWindDirectionChange = (dir: number) => {
    setWindDirection(dir);
    weatherSystemRef.current.setWindDirection(dir);
  };

  const handleWeatherWindStrengthChange = (strength: number) => {
    setWindStrength(strength);
    weatherSystemRef.current.setWindStrength(strength);
  };

  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    initScene();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);

    clockRef.current.start();
    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      
      // Cleanup transform controls
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
        sceneRef.current?.remove(transformControlsRef.current as unknown as THREE.Object3D);
        transformControlsRef.current.dispose();
      }
      
      // Cleanup outline helper
      if (outlineHelperRef.current) {
        sceneRef.current?.remove(outlineHelperRef.current);
        outlineHelperRef.current = null;
      }
      
      // Cleanup cloth meshes on unmount
      sailsRef.current.forEach((sail) => {
        if (sail.clothMesh) {
          sceneRef.current?.remove(sail.clothMesh);
          sail.clothGeometry.dispose();
          (sail.clothMesh.material as THREE.Material).dispose();
        }
      });
      sailsRef.current = [];
      mastsRef.current = [];
      
      // Cleanup weather systems
      oceanRef.current?.dispose();
      skySystemRef.current?.dispose();
      celestialRef.current?.dispose();
      rainSystemRef.current?.dispose();
      lightningSystemRef.current?.dispose();
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.forceContextLoss();
        rendererRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    loadShipModel(selectedShipType);
  }, [selectedShipType, loadShipModel]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === 'dark' ? 0x1a1a2e : 0x87ceeb);
      if (sceneRef.current.fog) {
        (sceneRef.current.fog as THREE.Fog).color.setHex(theme === 'dark' ? 0x1a1a2e : 0x87ceeb);
      }
    }
  }, [theme]);
  
  // Click handler for selecting parts in gizmo mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('click', handleCanvasClick);
    return () => {
      container.removeEventListener('click', handleCanvasClick);
    };
  }, [handleCanvasClick]);
  
  // Update outline helper when object moves
  useEffect(() => {
    const updateOutline = () => {
      if (outlineHelperRef.current && selectedObjectRef.current) {
        outlineHelperRef.current.update();
      }
    };
    
    transformControlsRef.current?.addEventListener('change', updateOutline);
    return () => {
      transformControlsRef.current?.removeEventListener('change', updateOutline);
    };
  }, []);

  return (
    <div className="h-screen flex bg-background">
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Ship className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Ship Builder</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-5 m-2 mb-0">
            <TabsTrigger value="ships" data-testid="tab-ships">Ship</TabsTrigger>
            <TabsTrigger value="cannons" data-testid="tab-cannons">
              <Crosshair className="w-3 h-3 mr-1" />Cannons
            </TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">
              <Gauge className="w-3 h-3 mr-1" />Stats
            </TabsTrigger>
            <TabsTrigger value="colors" data-testid="tab-colors">Colors</TabsTrigger>
            <TabsTrigger value="sails" data-testid="tab-sails">Sails</TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-4 mx-2 mb-0">
            <TabsTrigger value="wind" data-testid="tab-wind">Wind</TabsTrigger>
            <TabsTrigger value="lights" data-testid="tab-lights">
              <Lightbulb className="w-3 h-3" />
            </TabsTrigger>
            <TabsTrigger value="weather" data-testid="tab-weather">
              <Cloud className="w-3 h-3" />
            </TabsTrigger>
            <TabsTrigger value="skeleton" data-testid="tab-skeleton">
              <Bone className="w-3 h-3" />
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="ships" className="p-4 space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Select Ship Model</Label>
                <Select value={selectedShipType} onValueChange={setSelectedShipType}>
                  <SelectTrigger data-testid="select-ship-type">
                    <SelectValue placeholder="Select ship..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIP_TYPES.map((ship) => (
                      <SelectItem key={ship.id} value={ship.id}>
                        {ship.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Ship Parts ({meshList.length})</Label>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {meshList.map((info, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-md text-sm cursor-pointer transition-colors ${
                        selectedMesh?.name === info.name
                          ? 'bg-primary/20 border border-primary'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                      onClick={() => selectPart(info.mesh)}
                      data-testid={`mesh-item-${idx}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{info.name || `Mesh ${idx}`}</span>
                        <Badge variant="outline" className="text-xs">
                          {info.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Hull Depth (Waterline)</Label>
                  <Badge variant="secondary">{hullDepth.toFixed(1)}m</Badge>
                </div>
                <Slider
                  value={[hullDepth]}
                  onValueChange={([val]) => updateHullDepth(val)}
                  min={-2}
                  max={3}
                  step={0.1}
                  data-testid="slider-hull-depth"
                />
                <p className="text-xs text-muted-foreground">
                  Adjust how deep the hull sits in the water
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Statistics</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 p-2 rounded-md">
                    <div className="text-muted-foreground">Sails</div>
                    <div className="font-bold text-primary">{sails.length}</div>
                  </div>
                  <div className="bg-muted/50 p-2 rounded-md">
                    <div className="text-muted-foreground">Meshes</div>
                    <div className="font-bold text-primary">{meshList.length}</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cannons" className="p-4 space-y-4 mt-0">
              {(() => {
                const gameId = EDITOR_TO_GAME_SHIP[selectedShipType] || 'sloop';
                const config = SHIP_CANNON_CONFIGS[gameId];
                const gameDef = GAME_SHIP_DEFS[gameId];
                if (!config || config.mounts.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Crosshair className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No Cannon Mounts</p>
                      <p className="text-xs mt-1">This vessel is too small for cannons. Upgrade to a larger ship.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Cannon Mounts ({config.mounts.length})</Label>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => toggleCannonsVisible(!showCannons)}
                          title={showCannons ? 'Hide cannons' : 'Show cannons'}
                          data-testid="toggle-cannons-vis">
                          {showCannons ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant={showCannonArcs ? "default" : "ghost"} size="icon" className="h-7 w-7"
                          onClick={() => toggleCannonArcs(!showCannonArcs)}
                          title="Toggle firing arcs"
                          data-testid="toggle-arcs">
                          <Crosshair className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted/50 p-2 rounded-md">
                        <div className="text-muted-foreground text-xs">Armor</div>
                        <div className="font-bold flex items-center gap-1"><Shield className="w-3 h-3" />{config.armor}</div>
                      </div>
                      <div className="bg-muted/50 p-2 rounded-md">
                        <div className="text-muted-foreground text-xs">Turn Bonus</div>
                        <div className="font-bold">{config.turnBonus > 0 ? '+' : ''}{(config.turnBonus * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      {config.mounts.map(mount => {
                        const entry = cannonMeshes.find(c => c.mount.id === mount.id);
                        const isSelected = selectedCannonId === mount.id;
                        return (
                          <div key={mount.id}
                            className={`p-2 rounded-md text-sm cursor-pointer transition-colors border ${isSelected ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/50 hover:bg-muted'}`}
                            onClick={() => {
                              setSelectedCannonId(isSelected ? null : mount.id);
                              if (!isSelected && entry) {
                                const wp = new THREE.Vector3();
                                entry.group.getWorldPosition(wp);
                                controlsRef.current?.target.copy(wp);
                              }
                            }}
                            data-testid={`cannon-mount-${mount.id}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${MOUNT_TYPE_COLORS[mount.type].toString(16).padStart(6, '0')}` }} />
                                <span className="font-medium">{mount.id}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] h-5">{MOUNT_TYPE_LABELS[mount.type]}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">Arc: {mount.arcWidth}° · CD: ×{mount.cooldownMultiplier}</div>
                            {isSelected && (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs font-medium">Equip Ammo:</div>
                                <div className="flex flex-wrap gap-1">
                                  {mount.allowedSkills.map(sid => {
                                    const sk = CANNON_SKILLS[sid];
                                    return (
                                      <button key={sid}
                                        className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${entry?.equipped === sid ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                                        onClick={(e) => { e.stopPropagation(); equipCannon(mount.id, entry?.equipped === sid ? null : sid); }}
                                        data-testid={`equip-${mount.id}-${sid}`}>
                                        {sk.icon} {sk.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs">Ammo Legend</Label>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {Object.values(CANNON_SKILLS).map(sk => (
                          <div key={sk.id} className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span>{sk.icon}</span>
                            <span>{sk.name} — {sk.damage}dmg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="stats" className="p-4 space-y-4 mt-0">
              {(() => {
                const gameId = EDITOR_TO_GAME_SHIP[selectedShipType] || 'sloop';
                const gameDef = GAME_SHIP_DEFS[gameId];
                const cannonConfig = SHIP_CANNON_CONFIGS[gameId];
                const currentTierIdx = SHIP_UPGRADE_PATH.indexOf(gameId);
                const nextTierId = currentTierIdx < SHIP_UPGRADE_PATH.length - 1 ? SHIP_UPGRADE_PATH[currentTierIdx + 1] : null;
                const nextDef = nextTierId ? GAME_SHIP_DEFS[nextTierId] : null;

                if (!gameDef) return <div className="text-center text-muted-foreground py-8">No stats available</div>;
                return (
                  <div className="space-y-4">
                    <div className="text-center">
                      <Badge className="mb-2">Tier {gameDef.tier}</Badge>
                      <h3 className="font-bold text-lg">{gameDef.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{gameDef.description}</p>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Combat Stats</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-muted/50 p-2.5 rounded-md">
                          <div className="text-[10px] text-muted-foreground">Durability</div>
                          <div className="font-bold text-base">{gameDef.durability}</div>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, gameDef.durability / 8)}%` }} />
                          </div>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-md">
                          <div className="text-[10px] text-muted-foreground">Cannons</div>
                          <div className="font-bold text-base">{gameDef.cannons}</div>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, gameDef.cannons / 0.24)}%` }} />
                          </div>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-md">
                          <div className="text-[10px] text-muted-foreground">Speed</div>
                          <div className="font-bold text-base">{gameDef.speed}</div>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, gameDef.speed / 0.15)}%` }} />
                          </div>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-md">
                          <div className="text-[10px] text-muted-foreground">Armor</div>
                          <div className="font-bold text-base">{cannonConfig?.armor || 0}</div>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (cannonConfig?.armor || 0) / 0.35)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Crew & Cargo</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-muted/50 p-2.5 rounded-md">
                          <div className="text-[10px] text-muted-foreground">Crew Capacity</div>
                          <div className="font-bold text-base">{gameDef.crewCapacity}</div>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-md">
                          <div className="text-[10px] text-muted-foreground">Cargo Hold</div>
                          <div className="font-bold text-base">{gameDef.cargoCapacity}</div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Build Materials</Label>
                      <div className="space-y-1.5 mt-2">
                        {gameDef.buildMaterials.map((mat, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                            <div className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm capitalize">{mat.material.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">×{mat.quantity}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {nextDef && (
                      <>
                        <Separator />
                        <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowUpCircle className="w-4 h-4 text-primary" />
                            <Label className="text-xs uppercase tracking-wider">Upgrade to {nextDef.name}</Label>
                            <Badge className="ml-auto text-[10px]">Tier {nextDef.tier}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-xs mb-3">
                            <div className="flex justify-between"><span className="text-muted-foreground">Durability</span><span className="text-green-500">+{nextDef.durability - gameDef.durability}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Cannons</span><span className="text-green-500">+{nextDef.cannons - gameDef.cannons}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Speed</span><span className={nextDef.speed >= gameDef.speed ? 'text-green-500' : 'text-red-400'}>{nextDef.speed >= gameDef.speed ? '+' : ''}{nextDef.speed - gameDef.speed}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Crew</span><span className="text-green-500">+{nextDef.crewCapacity - gameDef.crewCapacity}</span></div>
                          </div>
                          <div className="text-[10px] text-muted-foreground mb-1.5">Required materials:</div>
                          <div className="space-y-1">
                            {nextDef.buildMaterials.map((mat, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="capitalize">{mat.material.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="text-muted-foreground">×{mat.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <Button size="sm" className="w-full mt-3" variant="outline"
                            onClick={() => {
                              const nextEditorShip = Object.entries(EDITOR_TO_GAME_SHIP).find(([_, gid]) => gid === nextTierId);
                              if (nextEditorShip) {
                                setSelectedShipType(nextEditorShip[0]);
                                toast({ title: 'Upgraded!', description: `Now viewing ${nextDef.name}. Customize your new vessel!` });
                              }
                            }}
                            data-testid="button-upgrade-ship">
                            <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />
                            Preview Upgrade
                          </Button>
                        </div>
                      </>
                    )}

                    {currentTierIdx === SHIP_UPGRADE_PATH.length - 1 && (
                      <div className="text-center py-3 text-sm text-muted-foreground">
                        <Swords className="w-8 h-8 mx-auto mb-2 text-primary opacity-50" />
                        <p className="font-medium text-primary">Maximum Tier Reached</p>
                        <p className="text-xs mt-1">This is the mightiest vessel in the fleet.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="sails" className="p-4 space-y-4 mt-0">
              <div className="space-y-3">
                <Label>Sail Controls</Label>
                <div className="flex gap-2">
                  <Button 
                    onClick={raiseSails} 
                    className="flex-1"
                    data-testid="button-raise-sails"
                  >
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Raise All
                  </Button>
                  <Button 
                    onClick={lowerSails}
                    variant="outline" 
                    className="flex-1"
                    data-testid="button-lower-sails"
                  >
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Lower All
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Individual Sails</Label>
                {sails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sails detected in model</p>
                ) : (
                  <div className="space-y-3">
                    {sails.map((sail, idx) => (
                      <div key={sail.id} className="bg-muted/50 p-3 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Sail {idx + 1}</span>
                          <Badge variant="secondary">{sail.deployment}%</Badge>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Deployment</span>
                          </div>
                          <Slider
                            value={[sail.deployment]}
                            onValueChange={([val]) => {
                              updateSailDeployment(sail, val);
                              setSails([...sails]);
                            }}
                            max={100}
                            step={5}
                            data-testid={`slider-sail-deploy-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Height (Y)</span>
                            <span>{sail.yOffset.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[sail.yOffset]}
                            onValueChange={([val]) => {
                              updateSailYOffset(sail, val);
                              setSails([...sails]);
                            }}
                            min={-5}
                            max={5}
                            step={0.1}
                            data-testid={`slider-sail-height-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Scale</span>
                            <span>{sail.scale.toFixed(2)}x</span>
                          </div>
                          <Slider
                            value={[sail.scale]}
                            onValueChange={([val]) => {
                              updateSailScale(sail, val);
                              setSails([...sails]);
                            }}
                            min={0.1}
                            max={3}
                            step={0.05}
                            data-testid={`slider-sail-scale-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">X Position</span>
                            <span>{sail.xOffset.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[sail.xOffset]}
                            onValueChange={([val]) => {
                              updateSailXOffset(sail, val);
                              setSails([...sails]);
                            }}
                            min={-5}
                            max={5}
                            step={0.1}
                            data-testid={`slider-sail-x-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Z Position</span>
                            <span>{sail.zOffset.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[sail.zOffset]}
                            onValueChange={([val]) => {
                              updateSailZOffset(sail, val);
                              setSails([...sails]);
                            }}
                            min={-5}
                            max={5}
                            step={0.1}
                            data-testid={`slider-sail-z-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Rotation</span>
                            <span>{Math.round(sail.rotation * 180 / Math.PI)}°</span>
                          </div>
                          <Slider
                            value={[sail.rotation]}
                            onValueChange={([val]) => {
                              updateSailRotation(sail, val);
                              setSails([...sails]);
                            }}
                            min={-Math.PI}
                            max={Math.PI}
                            step={0.05}
                            data-testid={`slider-sail-rot-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Mast Attach %</span>
                            <span>{sail.mastAttachHeight}%</span>
                          </div>
                          <Slider
                            value={[sail.mastAttachHeight]}
                            onValueChange={([val]) => {
                              updateSailMastAttach(sail, val);
                              setSails([...sails]);
                            }}
                            min={0}
                            max={100}
                            step={5}
                            data-testid={`slider-sail-attach-${idx}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Mast Rotation (Q/E keys)</Label>
                {masts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No masts detected in model</p>
                ) : (
                  <div className="space-y-3">
                    {masts.map((mast, idx) => (
                      <div key={mast.id} className="bg-muted/50 p-3 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Mast {idx + 1}</span>
                          <Badge variant="secondary">
                            {Math.round((mast.rotation * 180) / Math.PI)}°
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              rotateMast(mast, -0.1);
                              setMasts([...masts]);
                            }}
                            data-testid={`button-rotate-left-${idx}`}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              rotateMast(mast, 0.1);
                              setMasts([...masts]);
                            }}
                            data-testid={`button-rotate-right-${idx}`}
                          >
                            <RotateCw className="w-3 h-3" />
                          </Button>
                          <span className="text-xs text-muted-foreground self-center">
                            {mast.linkedSails.length} linked sails
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="colors" className="p-4 space-y-4 mt-0">
              {/* WOOD COLORS SECTION */}
              <div className="p-3 bg-muted/30 rounded-md space-y-3">
                <Label className="text-sm font-semibold">Wood Colors</Label>
                
                {/* Hull (sides/bottom) */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Hull (sides/bottom)</span>
                  <div className="grid grid-cols-8 gap-1">
                    {WOOD_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          hullColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyHullColor(c.color)}
                        title={c.name}
                        data-testid={`color-hull-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Bow (front wood) */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Bow (front area)</span>
                  <div className="grid grid-cols-8 gap-1">
                    {WOOD_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          bowColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyBowColor(c.color)}
                        title={c.name}
                        data-testid={`color-bow-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Deck */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Deck Planks</span>
                  <div className="grid grid-cols-8 gap-1">
                    {WOOD_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          deckColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyDeckColor(c.color)}
                        title={c.name}
                        data-testid={`color-deck-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Mast Poles */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Mast Poles</span>
                  <div className="grid grid-cols-6 gap-1">
                    {MAST_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          mastColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyMastColor(c.color)}
                        title={c.name}
                        data-testid={`color-mast-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Trim/Rails */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Trim & Rails</span>
                  <div className="grid grid-cols-8 gap-1">
                    {TRIM_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          trimColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyTrimColor(c.color)}
                        title={c.name}
                        data-testid={`color-trim-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Figurehead/Ornaments */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Figurehead & Ornaments</span>
                  <div className="grid grid-cols-8 gap-1">
                    {FIGUREHEAD_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          figureheadColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyFigureheadColor(c.color)}
                        title={c.name}
                        data-testid={`color-figurehead-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* CLOTH COLORS SECTION */}
              <div className="p-3 bg-muted/30 rounded-md space-y-3">
                <Label className="text-sm font-semibold">Cloth Colors</Label>
                
                {/* Sails */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Sails</span>
                  <div className="grid grid-cols-9 gap-1">
                    {SAIL_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          sailColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applySailColor(c.color)}
                        title={c.name}
                        data-testid={`color-sail-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Flags */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Flags & Pennants</span>
                  <div className="grid grid-cols-8 gap-1">
                    {FLAG_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          flagColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyFlagColor(c.color)}
                        title={c.name}
                        data-testid={`color-flag-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Cloth Accents */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Cloth Accents (drapes, banners)</span>
                  <div className="grid grid-cols-9 gap-1">
                    {SAIL_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-full aspect-square rounded-sm border-2 transition-all ${
                          clothAccentColor === c.color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: `#${c.color.toString(16).padStart(6, '0')}` }}
                        onClick={() => applyClothAccentColor(c.color)}
                        title={c.name}
                        data-testid={`color-cloth-accent-${c.name}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Separator />
              
              {/* Custom Texture Uploads */}
              <div className="p-3 bg-muted/30 rounded-md space-y-3">
                <Label className="text-sm font-semibold">Custom Textures</Label>
                
                {/* Hull Texture Slots */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Hull Textures</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <input type="file" accept="image/*" onChange={(e) => handleCustomHullTextureUpload(e, 1)} className="hidden" id="hull-texture-1" data-testid="input-hull-texture-1" />
                      <label htmlFor="hull-texture-1" className={`flex flex-col items-center justify-center w-full aspect-square rounded-md border-2 border-dashed cursor-pointer transition-all hover:border-primary ${customHullTexture1 ? 'border-primary' : 'border-muted'}`} style={customHullTexture1 ? { backgroundImage: `url(${customHullTexture1})`, backgroundSize: 'cover' } : {}}>
                        {!customHullTexture1 && <span className="text-xs text-muted-foreground text-center">Slot 1</span>}
                      </label>
                      {customHullTexture1 && <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => applyCustomHullTexture(customHullTexture1)} data-testid="button-apply-hull-texture-1">Apply</Button>}
                    </div>
                    <div className="space-y-1">
                      <input type="file" accept="image/*" onChange={(e) => handleCustomHullTextureUpload(e, 2)} className="hidden" id="hull-texture-2" data-testid="input-hull-texture-2" />
                      <label htmlFor="hull-texture-2" className={`flex flex-col items-center justify-center w-full aspect-square rounded-md border-2 border-dashed cursor-pointer transition-all hover:border-primary ${customHullTexture2 ? 'border-primary' : 'border-muted'}`} style={customHullTexture2 ? { backgroundImage: `url(${customHullTexture2})`, backgroundSize: 'cover' } : {}}>
                        {!customHullTexture2 && <span className="text-xs text-muted-foreground text-center">Slot 2</span>}
                      </label>
                      {customHullTexture2 && <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => applyCustomHullTexture(customHullTexture2)} data-testid="button-apply-hull-texture-2">Apply</Button>}
                    </div>
                  </div>
                </div>
                
                {/* Sail Image Uploader */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Sail Image (PNG)
                  </span>
                  <input type="file" accept="image/png,image/*" onChange={handleCustomSailImageUpload} className="hidden" id="sail-image-upload" data-testid="input-sail-image" />
                  <label htmlFor="sail-image-upload" className={`flex flex-col items-center justify-center w-full h-16 rounded-md border-2 border-dashed cursor-pointer transition-all hover:border-primary ${customSailImage ? 'border-primary' : 'border-muted'}`} style={customSailImage ? { backgroundImage: `url(${customSailImage})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } : {}}>
                    {!customSailImage && <span className="text-xs text-muted-foreground">Upload sail image</span>}
                  </label>
                  {customSailImage && <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setCustomSailImage(null)} data-testid="button-clear-sail-image">Clear</Button>}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Paintbrush className="w-4 h-4" />
                  Texture Effects
                </Label>
                
                <div className="space-y-3">
                  <span className="text-sm text-muted-foreground">Hull Texture</span>
                  <Select
                    value={hullTextureEffect}
                    onValueChange={(val) => applyTextureEffect(val as TextureEffect, 'hull')}
                  >
                    <SelectTrigger data-testid="select-hull-texture">
                      <SelectValue placeholder="Select texture effect" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXTURE_EFFECTS.map((effect) => (
                        <SelectItem key={effect.id} value={effect.id}>
                          {effect.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <span className="text-sm text-muted-foreground">Trim Texture</span>
                  <Select
                    value={trimTextureEffect}
                    onValueChange={(val) => applyTextureEffect(val as TextureEffect, 'trim')}
                  >
                    <SelectTrigger data-testid="select-trim-texture">
                      <SelectValue placeholder="Select texture effect" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXTURE_EFFECTS.map((effect) => (
                        <SelectItem key={effect.id} value={effect.id}>
                          {effect.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Material Effects
                </Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Metallic</span>
                    <Badge variant="secondary">{(metallicValue * 100).toFixed(0)}%</Badge>
                  </div>
                  <Slider
                    value={[metallicValue * 100]}
                    onValueChange={([val]) => {
                      const newVal = val / 100;
                      setMetallicValue(newVal);
                      applyShaderEffects(newVal, roughnessValue, emissionIntensity);
                    }}
                    max={100}
                    step={5}
                    data-testid="slider-metallic"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Roughness</span>
                    <Badge variant="secondary">{(roughnessValue * 100).toFixed(0)}%</Badge>
                  </div>
                  <Slider
                    value={[roughnessValue * 100]}
                    onValueChange={([val]) => {
                      const newVal = val / 100;
                      setRoughnessValue(newVal);
                      applyShaderEffects(metallicValue, newVal, emissionIntensity);
                    }}
                    max={100}
                    step={5}
                    data-testid="slider-roughness"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Emission Glow</span>
                    <Badge variant="secondary">{(emissionIntensity * 100).toFixed(0)}%</Badge>
                  </div>
                  <Slider
                    value={[emissionIntensity * 100]}
                    onValueChange={([val]) => {
                      const newVal = val / 100;
                      setEmissionIntensity(newVal);
                      applyShaderEffects(metallicValue, roughnessValue, newVal);
                    }}
                    max={100}
                    step={5}
                    data-testid="slider-emission"
                  />
                </div>
              </div>

              <Separator />

              <AITexturePanel
                onTextureGenerated={(image, type) => {
                  // Apply AI-generated texture to ship materials based on type
                  const texture = new THREE.Texture(image);
                  texture.needsUpdate = true;
                  texture.wrapS = THREE.RepeatWrapping;
                  texture.wrapT = THREE.RepeatWrapping;
                  texture.repeat.set(2, 2);
                  texture.colorSpace = THREE.SRGBColorSpace;

                  const typeLower = type.toLowerCase();
                  
                  const applyTextureToMesh = (meshInfo: ShipMeshInfo) => {
                    const materials = Array.isArray(meshInfo.mesh.material) 
                      ? meshInfo.mesh.material 
                      : [meshInfo.mesh.material];
                    
                    materials.forEach((mat) => {
                      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                        mat.map = texture.clone();
                        mat.map.needsUpdate = true;
                        mat.needsUpdate = true;
                      } else if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshPhongMaterial) {
                        mat.map = texture.clone();
                        mat.map.needsUpdate = true;
                        mat.needsUpdate = true;
                      } else {
                        // For other material types, create a new MeshStandardMaterial with the texture
                        const existingColor = (mat as any).color || new THREE.Color(0xffffff);
                        const newMat = new THREE.MeshStandardMaterial({
                          map: texture.clone(),
                          color: existingColor,
                          roughness: 0.7,
                          metalness: 0.1,
                        });
                        meshInfo.mesh.material = newMat;
                      }
                    });
                  };
                  
                  meshList.forEach(meshInfo => {
                    const shouldApply = 
                      (typeLower.includes('hull') && meshInfo.type === 'hull') ||
                      (typeLower.includes('deck') && meshInfo.type === 'deck') ||
                      (typeLower.includes('sail') && meshInfo.type === 'sail') ||
                      (typeLower.includes('mast') && meshInfo.type === 'mast') ||
                      (typeLower.includes('wood') && (meshInfo.type === 'hull' || meshInfo.type === 'deck' || meshInfo.type === 'mast'));
                    
                    if (shouldApply) {
                      applyTextureToMesh(meshInfo);
                    }
                  });

                  // Also apply to cloth sails if texture type is sail
                  if (typeLower.includes('sail') || typeLower.includes('cloth')) {
                    sailsRef.current.forEach(sail => {
                      const mat = sail.clothMesh.material;
                      if (mat instanceof THREE.MeshStandardMaterial) {
                        mat.map = texture.clone();
                        mat.map.needsUpdate = true;
                        mat.needsUpdate = true;
                      }
                    });
                  }

                  toast({
                    title: "Texture Applied",
                    description: `AI-generated ${type} texture has been applied to your ship.`,
                  });
                }}
              />
            </TabsContent>

            <TabsContent value="wind" className="p-4 space-y-4 mt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Wind Direction</Label>
                  <Badge variant="secondary">{windDirection}°</Badge>
                </div>
                <Slider
                  value={[windDirection]}
                  onValueChange={([val]) => setWindDirection(val)}
                  max={360}
                  step={15}
                  data-testid="slider-wind-direction"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Wind Strength</Label>
                  <Badge variant="secondary">{windStrength}</Badge>
                </div>
                <Slider
                  value={[windStrength]}
                  onValueChange={([val]) => setWindStrength(val)}
                  max={20}
                  step={1}
                  data-testid="slider-wind-strength"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Turbulence</Label>
                  <Badge variant="secondary">{windTurbulence.toFixed(1)}</Badge>
                </div>
                <Slider
                  value={[windTurbulence * 10]}
                  onValueChange={([val]) => setWindTurbulence(val / 10)}
                  max={10}
                  step={1}
                  data-testid="slider-wind-turbulence"
                />
              </div>

              <Separator />

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                <Wind className="w-5 h-5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium">Wind Preview</div>
                  <div className="text-muted-foreground">
                    Sails respond to wind physics in real-time
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lights" className="p-4 space-y-4 mt-0">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md mb-4">
                <Lightbulb className="w-5 h-5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium">Figurehead Light</div>
                  <div className="text-muted-foreground text-xs">
                    Control the bow lantern/figurehead glow
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Enable Light</Label>
                  <Button
                    variant={figureheadLightEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setFigureheadLightEnabled(!figureheadLightEnabled);
                      setTimeout(createFigureheadLight, 100);
                    }}
                    data-testid="button-figurehead-light"
                  >
                    {figureheadLightEnabled ? "On" : "Off"}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Light Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={figureheadLightColor}
                    onChange={(e) => setFigureheadLightColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    data-testid="input-light-color"
                  />
                  <Input
                    value={figureheadLightColor}
                    onChange={(e) => setFigureheadLightColor(e.target.value)}
                    className="flex-1"
                    placeholder="#ffcc00"
                    data-testid="input-light-color-hex"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Gold', color: '#ffcc00' },
                    { name: 'Lantern', color: '#ff9933' },
                    { name: 'Ghost Blue', color: '#66ccff' },
                    { name: 'Spectral', color: '#99ffcc' },
                    { name: 'Blood Red', color: '#ff3333' },
                    { name: 'White', color: '#ffffff' },
                  ].map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setFigureheadLightColor(preset.color)}
                      style={{ borderColor: preset.color }}
                      data-testid={`button-light-preset-${preset.name.toLowerCase()}`}
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-1" 
                        style={{ backgroundColor: preset.color }}
                      />
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Intensity</Label>
                  <Badge variant="secondary">{figureheadLightIntensity.toFixed(1)}</Badge>
                </div>
                <Slider
                  value={[figureheadLightIntensity]}
                  onValueChange={([val]) => setFigureheadLightIntensity(val)}
                  min={0}
                  max={10}
                  step={0.5}
                  data-testid="slider-light-intensity"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Range</Label>
                  <Badge variant="secondary">{figureheadLightDistance}m</Badge>
                </div>
                <Slider
                  value={[figureheadLightDistance]}
                  onValueChange={([val]) => setFigureheadLightDistance(val)}
                  min={5}
                  max={50}
                  step={5}
                  data-testid="slider-light-distance"
                />
              </div>

              <Separator />

              <Button
                className="w-full"
                onClick={createFigureheadLight}
                data-testid="button-apply-light"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Apply Light Settings
              </Button>
            </TabsContent>

            <TabsContent value="weather" className="p-4 space-y-4 mt-0">
              <WeatherPanel
                weatherState={weatherState}
                timeOfDay={timeOfDay}
                windDirection={windDirection}
                windStrength={windStrength}
                onWeatherChange={handleWeatherChange}
                onTimeChange={handleTimeChange}
                onWindDirectionChange={handleWeatherWindDirectionChange}
                onWindStrengthChange={handleWeatherWindStrengthChange}
                dayProgress={weatherSystemRef.current.getState().dayProgress}
                stormIntensity={stormIntensity}
                waveHeight={waveHeight}
                visibility={visibility}
              />
            </TabsContent>

            <TabsContent value="skeleton" className="p-4 space-y-4 mt-0">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md mb-4">
                <Bone className="w-5 h-5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium">Skeleton/Frame Editor</div>
                  <div className="text-muted-foreground text-xs">
                    Create skeletal structures for rigging
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Skeleton Mode</Label>
                  <Button
                    variant={skeletonMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSkeletonMode(!skeletonMode)}
                    data-testid="button-skeleton-mode"
                  >
                    {skeletonMode ? "Active" : "Inactive"}
                  </Button>
                </div>
                
                {skeletonMode && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-sm">
                    <div className="font-medium text-green-400 mb-1">Controls:</div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li><strong>Left-click</strong> on grid: Place point</li>
                      <li><strong>Shift+click</strong> on point: Lock it</li>
                      <li><strong>Right-click</strong> on point: Unlock it</li>
                      <li><strong>Left-click</strong> on locked point: Select for gizmo</li>
                    </ul>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Parent Mesh</Label>
                <Select value={skeletonParentMesh} onValueChange={setSkeletonParentMesh}>
                  <SelectTrigger data-testid="select-skeleton-parent">
                    <SelectValue placeholder="Select parent mesh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Standalone)</SelectItem>
                    {meshList.map((mesh) => (
                      <SelectItem key={mesh.name} value={mesh.name}>
                        {mesh.name} ({mesh.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Grid Plane</Label>
                <div className="flex gap-2">
                  <Button
                    variant={skeletonGridPlane === 'xy' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSkeletonGridPlane('xy')}
                    data-testid="button-plane-xy"
                  >
                    XY
                  </Button>
                  <Button
                    variant={skeletonGridPlane === 'xz' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSkeletonGridPlane('xz')}
                    data-testid="button-plane-xz"
                  >
                    XZ
                  </Button>
                  <Button
                    variant={skeletonGridPlane === 'yz' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSkeletonGridPlane('yz')}
                    data-testid="button-plane-yz"
                  >
                    YZ
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Grid Offset</Label>
                  <Badge variant="secondary">{skeletonGridOffset.toFixed(1)}</Badge>
                </div>
                <Slider
                  value={[skeletonGridOffset]}
                  onValueChange={([val]) => setSkeletonGridOffset(val)}
                  min={-10}
                  max={10}
                  step={0.5}
                  data-testid="slider-grid-offset"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Points ({skeletonPoints.length})</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {skeletonPoints.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No points yet. Enable skeleton mode and click on the grid to add points.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {skeletonPoints.map((point, idx) => (
                        <div
                          key={point.id}
                          className={`flex items-center justify-between p-2 rounded text-xs ${
                            selectedSkeletonPoint?.id === point.id ? 'bg-primary/20' : 'bg-muted/50'
                          }`}
                        >
                          <span>
                            Point {idx + 1}: ({point.mesh.position.x.toFixed(1)}, {point.mesh.position.y.toFixed(1)}, {point.mesh.position.z.toFixed(1)})
                          </span>
                          <div className="flex gap-1">
                            {point.locked ? (
                              <Lock className="w-3 h-3 text-green-400" />
                            ) : (
                              <Unlock className="w-3 h-3 text-orange-400" />
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => deleteSkeletonPoint(point)}
                              data-testid={`button-delete-point-${idx}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={clearAllSkeletonPoints}
                  disabled={skeletonPoints.length === 0}
                  data-testid="button-clear-points"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear All
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={exportSkeletonData}
                  disabled={skeletonPoints.length === 0}
                  data-testid="button-export-skeleton"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export JSON
                </Button>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-4 border-t border-border space-y-2">
          <Button 
            onClick={resetCamera} 
            variant="outline" 
            className="w-full"
            data-testid="button-reset-camera"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Camera
          </Button>
          <Button 
            className="w-full"
            onClick={saveShipCustomization}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          
          <Button
            className="w-full"
            variant="secondary"
            onClick={loadSavedCustomization}
            data-testid="button-load-saved"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Load Saved
          </Button>
          
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={applyShipToGame}
            data-testid="button-apply-to-game"
          >
            <Ship className="w-4 h-4 mr-2" />
            Apply to Game
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        {webglError ? (
          <div className="w-full h-full flex items-center justify-center bg-muted/20" data-testid="webgl-error">
            <div className="max-w-md text-center p-8 bg-card rounded-lg shadow-lg border border-border">
              <Ship className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">WebGL Not Available</h2>
              <p className="text-muted-foreground mb-4">{webglError}</p>
              <Button onClick={onBack} variant="outline" data-testid="button-back-webgl-error">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Menu
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div 
              ref={containerRef} 
              className={`w-full h-full ${gizmoEnabled ? 'cursor-crosshair' : 'cursor-grab'}`}
              data-testid="three-viewport"
            />
            <div className="absolute bottom-4 left-4 z-10">
              <WeatherHUD
                weatherState={weatherState}
                timeOfDay={timeOfDay}
                windDirection={windDirection}
                windStrength={windStrength}
                waveHeight={waveHeight}
              />
            </div>
          </>
        )}

        {isLoading && !webglError && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="flex items-center gap-3 bg-card p-4 rounded-lg shadow-lg">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading ship model...</span>
            </div>
          </div>
        )}

        {!webglError && (
          <>
            <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm rounded-md p-3 text-sm">
              <div className="font-medium mb-1">Controls</div>
              <div className="text-muted-foreground space-y-1">
                <div>Mouse: Orbit camera</div>
                <div>Scroll: Zoom</div>
                <div>Q/E: Rotate masts</div>
                <div>G/R/S: Move/Rotate/Scale</div>
                <div>Esc: Deselect part</div>
              </div>
            </div>

            <div className="absolute top-4 right-4 flex gap-2">
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                {selectedShipType}
              </Badge>
              {sails.length > 0 && (
                <Badge className="bg-primary/80">
                  {sails.length} Sails
                </Badge>
              )}
            </div>
            
            {/* Gizmo Toolbar */}
            <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-md p-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={gizmoEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGizmoEnabled(!gizmoEnabled)}
                  data-testid="button-toggle-gizmo"
                >
                  <Move className="w-4 h-4 mr-1" />
                  Edit Mode
                </Button>
                {gizmoEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={deselectPart}
                    data-testid="button-deselect"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {gizmoEnabled && (
                <>
                  <div className="flex gap-1">
                    <Button
                      variant={gizmoMode === 'translate' ? "default" : "outline"}
                      size="icon"
                      onClick={() => changeGizmoMode('translate')}
                      title="Move (G)"
                      data-testid="button-gizmo-translate"
                    >
                      <Move className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={gizmoMode === 'rotate' ? "default" : "outline"}
                      size="icon"
                      onClick={() => changeGizmoMode('rotate')}
                      title="Rotate (R)"
                      data-testid="button-gizmo-rotate"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={gizmoMode === 'scale' ? "default" : "outline"}
                      size="icon"
                      onClick={() => changeGizmoMode('scale')}
                      title="Scale (S)"
                      data-testid="button-gizmo-scale"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {selectedMesh && (
                    <div className="bg-muted/50 rounded p-2 space-y-2 min-w-[180px]">
                      <div className="text-xs font-medium truncate">
                        {selectedMesh.name || 'Selected Part'}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {selectedMesh.type}
                      </Badge>
                      <div className="flex items-center gap-2 mt-2">
                        <Paintbrush className="w-3 h-3" />
                        <Input
                          type="color"
                          value={selectedPartColor}
                          onChange={(e) => applyPartColor(e.target.value)}
                          className="w-full h-8 p-1 cursor-pointer"
                          data-testid="input-part-color"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
