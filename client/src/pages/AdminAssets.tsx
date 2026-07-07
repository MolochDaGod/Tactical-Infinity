import { useState, useEffect, useRef, useMemo } from 'react';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  ASSET_REGISTRY, 
  ANIMATION_REGISTRY, 
  RACE_ICONS,
  getAssetsByCategory,
  getAnimationsByType,
  type Asset3D,
  type AssetAnimation 
} from '@/lib/assetRegistry';
import { 
  RACE_MODELS,
  RACE_EQUIPMENT,
  RACE_TEXTURES,
  RACE_PREFIXES,
  FACTION_RACES,
  type Race,
  type Faction
} from '@/data/toonRTSAssets';
import { 
  User, 
  Swords, 
  Bug, 
  Box, 
  Sparkles, 
  Search,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
  FileCheck,
  FileX,
  Layers,
  Bone,
  Image as ImageIcon,
  Shield,
  Wand2
} from 'lucide-react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';

const categoryIcons: Record<string, typeof User> = {
  character: User,
  animation: Play,
  npc: Bug,
  creature: Bug,
  prop: Box,
  effect: Sparkles
};

const categoryColors: Record<string, string> = {
  character: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  animation: 'bg-green-500/20 text-green-400 border-green-500/30',
  npc: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  creature: 'bg-red-500/20 text-red-400 border-red-500/30',
  prop: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  effect: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
};

const factionColors: Record<Faction, string> = {
  crusade: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  fabled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  legion: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ALL_RACES: Race[] = ['human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead'];

/**
 * Real on-disk Toon-RTS standard-unit textures (verified against
 * `public/toon_rts/Toon_RTS/<folder>/models/Materials/*.tga`).
 * The previous map pointed at `Materials/textures/*` and `*Standard_Units.tga`
 * filenames that don't exist for some races — leading to silent black
 * meshes. These paths match what the working RaceCharacterViewer uses.
 */
const TOON_RTS_TEXTURE_MAP: Record<string, string> = {
  WesternKingdoms: '/toon_rts/Toon_RTS/WesternKingdoms/models/Materials/WK_Standard_Units.tga',
  Barbarians:      '/toon_rts/Toon_RTS/Barbarians/models/Materials/BRB_StandardUnits_texture.tga',
  Dwarves:         '/toon_rts/Toon_RTS/Dwarves/models/Materials/DWF_Standard_Units.tga',
  Elves:           '/toon_rts/Toon_RTS/Elves/models/Materials/ELF_DarkElves_Texture.tga',
  Orcs:            '/toon_rts/Toon_RTS/Orcs/models/Materials/ORC_StandardUnits.tga',
  Undead:          '/toon_rts/Toon_RTS/Undead/models/Materials/UD_Standard_Units.tga',
};

const FACTION_HEX: Record<Faction, number> = {
  crusade: 0xc8a020,
  fabled:  0x20a8c8,
  legion:  0xc82020,
};

/**
 * Per-race compatible foot-rig animations (curated against the Toon-RTS asset
 * pack). The pack ships humanoid foot-rig clips only for Dwarves, Orcs and
 * Barbarians; Cavalry/Catapult/BoltThrower rigs are NOT compatible with the
 * `*_Characters_customizable.FBX` foot models. Mismatched clips deform the
 * skeleton catastrophically, so we keep this list deliberately conservative.
 */
const RACE_NATIVE_ANIMATIONS: Record<Race, { name: string; path: string }[]> = {
  human:     [],
  barbarian: [
    { name: 'Spearman Attack', path: '/toon_rts/Toon_RTS/Barbarians/animation/Spearman/BRB_spearman_07_attack.FBX' },
  ],
  dwarf: [
    { name: 'Worker Idle',   path: '/toon_rts/Toon_RTS/Dwarves/animation/Worker/_idle.FBX' },
    { name: 'Worker Attack', path: '/toon_rts/Toon_RTS/Dwarves/animation/Worker/DWF_worker_07_attack.FBX' },
  ],
  elf: [],
  orc: [
    { name: 'Worker Working', path: '/toon_rts/Toon_RTS/Orcs/animation/Worker/ORC_worker_12_working_A.FBX' },
  ],
  undead: [],
};

/**
 * Normalize an asset path so it can be fetched by the browser. Registry paths
 * are all public-served from `public/` (e.g. `/toon_rts/...`, `/models/...`,
 * `/animations/...`); any rare bare path just gets a leading slash.
 */
function normalizeAssetUrl(p: string): string {
  if (!p) return p;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (p.startsWith('/')) return p;
  return '/' + p;
}

/** Build a synthetic Asset3D for a Toon-RTS race so the main viewer can preview it. */
function buildRaceAsset(race: Race): Asset3D {
  const info  = RACE_PREFIXES[race];
  const model = RACE_MODELS[race];
  const texturePath = TOON_RTS_TEXTURE_MAP[info.folder];
  return {
    id: `toonrts-${race}`,
    name: `${race.charAt(0).toUpperCase()}${race.slice(1)} (Toon RTS)`,
    category: 'character',
    sourcePath: model.character,
    glbPath: undefined,
    textures: texturePath
      ? [{ name: `${info.code}_StandardUnits`, path: texturePath, type: 'diffuse' }]
      : [],
    animations: RACE_NATIVE_ANIMATIONS[race].map(a => ({ name: a.name, path: a.path, loop: true })),
    hasSkeleton: true,
    skeletonType: 'humanoid',
    scale: 1.2, // 0.012 in the multiplier convention used by the viewer
    tags: [race, info.faction, info.code, 'toon_rts'],
    license: 'Toon RTS (commercial pack)',
    converted: false,
  };
}

interface ToonRTSCharacterPanelProps {
  onSelectRace: (race: Race) => void;
  selectedRaceFromAsset: Race | null;
}

function ToonRTSCharacterPanel({ onSelectRace, selectedRaceFromAsset }: ToonRTSCharacterPanelProps) {
  const [selectedRace, setSelectedRaceState] = useState<Race>(selectedRaceFromAsset ?? 'human');
  const [selectedWeapon, setSelectedWeapon] = useState<string>('none');
  const [selectedShield, setSelectedShield] = useState<string>('none');
  const [selectedColor, setSelectedColor] = useState<string>('standard');

  // Reflect external selection back into local state
  useEffect(() => {
    if (selectedRaceFromAsset && selectedRaceFromAsset !== selectedRace) {
      setSelectedRaceState(selectedRaceFromAsset);
    }
  }, [selectedRaceFromAsset, selectedRace]);

  const setSelectedRace = (race: Race) => {
    setSelectedRaceState(race);
    onSelectRace(race);
  };
  
  const raceInfo = RACE_PREFIXES[selectedRace];
  const raceEquipment = RACE_EQUIPMENT[selectedRace];
  const raceTextures = RACE_TEXTURES[selectedRace];
  const raceModel = RACE_MODELS[selectedRace];
  
  const availableWeapons = Object.keys(raceEquipment.weapons);
  const availableStaffs = Object.keys(raceEquipment.staffs);
  const availableShields = Object.keys(raceEquipment.shields);
  const availableColors = Object.keys(raceTextures.colors);
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Swords className="w-4 h-4" />
            Toon RTS Characters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Faction</Label>
            <div className="flex gap-2">
              {(['crusade', 'fabled', 'legion'] as Faction[]).map((faction) => (
                <Badge 
                  key={faction}
                  variant="outline"
                  className={`cursor-pointer capitalize ${
                    FACTION_RACES[faction].includes(selectedRace) 
                      ? factionColors[faction] 
                      : 'opacity-50'
                  }`}
                  onClick={() => setSelectedRace(FACTION_RACES[faction][0])}
                  data-testid={`badge-faction-${faction}`}
                >
                  {faction}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Race</Label>
            <Select value={selectedRace} onValueChange={(v) => setSelectedRace(v as Race)}>
              <SelectTrigger data-testid="select-race">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_RACES.map((race) => (
                  <SelectItem key={race} value={race} className="capitalize">
                    {race} ({RACE_PREFIXES[race].code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Main Hand</Label>
            <Select value={selectedWeapon} onValueChange={setSelectedWeapon}>
              <SelectTrigger data-testid="select-weapon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {availableWeapons.map((weapon) => (
                  <SelectItem key={weapon} value={weapon} className="capitalize">
                    {weapon.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
                {availableStaffs.map((staff) => (
                  <SelectItem key={staff} value={`staff_${staff}`} className="capitalize">
                    {staff.replace(/_/g, ' ')} (Staff)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Off Hand</Label>
            <Select value={selectedShield} onValueChange={setSelectedShield}>
              <SelectTrigger data-testid="select-shield">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {availableShields.map((shield) => (
                  <SelectItem key={shield} value={shield} className="capitalize">
                    {shield.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Color Variant</Label>
            <Select value={selectedColor} onValueChange={setSelectedColor}>
              <SelectTrigger data-testid="select-color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                {availableColors.map((color) => (
                  <SelectItem key={color} value={color} className="capitalize">
                    {color}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Selected: {selectedRace}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Code:</span>
            <span className="font-mono">{raceInfo.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Faction:</span>
            <Badge variant="outline" className={`text-xs ${factionColors[raceInfo.faction]}`}>
              {raceInfo.faction}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Weapons:</span>
            <span>{availableWeapons.length + availableStaffs.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shields:</span>
            <span>{availableShields.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Colors:</span>
            <span>{availableColors.length + 1}</span>
          </div>
          <div className="pt-2 border-t mt-2">
            <p className="text-muted-foreground truncate" title={raceModel.character}>
              Model: {raceModel.character.split('/').pop()}
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-3 gap-2">
        {ALL_RACES.map((race) => (
          <Card 
            key={race}
            className={`cursor-pointer transition-all hover-elevate p-2 text-center ${
              selectedRace === race ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedRace(race)}
            data-testid={`card-race-${race}`}
          >
            <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
              factionColors[RACE_PREFIXES[race].faction]
            }`}>
              <User className="w-4 h-4" />
            </div>
            <p className="text-xs mt-1 capitalize">{race}</p>
            <p className="text-[10px] text-muted-foreground">{RACE_PREFIXES[race].code}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface Asset3DViewerProps {
  asset: Asset3D | null;
  /** Optional external animation FBX to retarget onto the loaded skeleton. */
  animation: AssetAnimation | null;
  isPlaying: boolean;
  onPlayingChange: (v: boolean) => void;
  /** Reports the available animation clip names for the loaded model. */
  onClipsChanged?: (clipNames: string[]) => void;
}

function Asset3DViewer({ asset, animation, isPlaying, onPlayingChange, onClipsChanged }: Asset3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const modelRef     = useRef<THREE.Object3D | null>(null);
  const mixerRef     = useRef<THREE.AnimationMixer | null>(null);
  const baseClipsRef = useRef<THREE.AnimationClip[]>([]);
  const externalClipRef = useRef<THREE.AnimationClip | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Sync the prop into a ref so the (single) animate loop closure sees it.
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── One-shot scene boot ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Probe WebGL up-front so a missing-context error doesn't crash the whole
    // admin page (e.g. when running in a headless browser without a GPU).
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!probeCtx) {
      setWebglFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12141d);
    scene.fog = new THREE.FogExp2(0x12141d, 0.018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      1000,
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      console.warn('[AdminAssets] WebGL renderer unavailable:', e);
      setWebglFailed(true);
      return;
    }
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1, 0);
    controls.minDistance = 0.5;
    controls.maxDistance = 30;
    controlsRef.current = controls;

    // Hemisphere + key + fill — same look as the working RaceCharacterViewer.
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x1a1a2e, 0.6));
    const key = new THREE.DirectionalLight(0xfff0d6, 1.2);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6688ff, 0.4);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    // Subtle ground + grid for scale reference
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(10, 64),
      new THREE.MeshStandardMaterial({ color: 0x1d2030, roughness: 0.95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(new THREE.GridHelper(10, 10, 0x445064, 0x222633));

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (mixerRef.current && isPlayingRef.current) {
        mixerRef.current.update(dt);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      controls.dispose();
      if (modelRef.current) scene.remove(modelRef.current);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []);

  // ── Asset loading: texture → model → embedded clips ────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!asset || !scene) return;

    // Clear previous model + animation state
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }
    baseClipsRef.current = [];
    externalClipRef.current = null;

    setLoading(true);
    setError(null);

    const loader     = new FBXLoader();
    const tgaLoader  = new TGALoader();
    const sourceUrl  = normalizeAssetUrl(asset.sourcePath);

    // Pick a texture: prefer registry entry, then fall back to Toon-RTS map by folder.
    let texturePath: string | null = null;
    if (asset.textures && asset.textures.length > 0) {
      const diffuse = asset.textures.find(t => t.type === 'diffuse') ?? asset.textures[0];
      texturePath = normalizeAssetUrl(diffuse.path);
    } else if (asset.sourcePath.includes('Toon_RTS') || asset.sourcePath.includes('toon_rts')) {
      for (const [folder, path] of Object.entries(TOON_RTS_TEXTURE_MAP)) {
        if (asset.sourcePath.includes(folder)) { texturePath = path; break; }
      }
    }

    // Faction colour fallback for tinted-flat shading when no texture exists
    const tagFaction = (['crusade', 'fabled', 'legion'] as Faction[]).find(f => asset.tags.includes(f));
    const fallbackColor = tagFaction ? FACTION_HEX[tagFaction] : 0x9aa6c2;

    const applyMaterials = (root: THREE.Object3D, texture: THREE.Texture | null) => {
      root.traverse(child => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const replace = (old: THREE.Material): THREE.Material => {
          const std = new THREE.MeshStandardMaterial({
            map: texture ?? null,
            color: texture ? 0xffffff : fallbackColor,
            roughness: 0.7,
            metalness: 0.15,
            side: THREE.DoubleSide,
          });
          old.dispose();
          return std;
        };
        if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(replace);
        else if (mesh.material)            mesh.material = replace(mesh.material);
      });
    };

    const onModelReady = (raw: THREE.Group) => {
      // Use SkeletonUtils so external animations can rebind to this skeleton later.
      const cloned = (raw.animations.length > 0 || asset.hasSkeleton)
        ? (SkeletonUtils.clone(raw) as THREE.Group)
        : raw;
      // Carry embedded clips onto the cloned tree (SkeletonUtils.clone strips them).
      cloned.animations = raw.animations;

      // The Toon-RTS scale convention is 0.01 * asset.scale; non-Toon assets pass scale=1.
      const baseScale = (asset.sourcePath.includes('toon_rts') || asset.sourcePath.includes('Toon_RTS'))
        ? 0.01
        : 1;
      cloned.scale.setScalar(baseScale * asset.scale);
      cloned.position.set(0, 0, 0);

      scene.add(cloned);
      modelRef.current = cloned;

      const mixer = new THREE.AnimationMixer(cloned);
      mixerRef.current = mixer;
      baseClipsRef.current = raw.animations.slice();

      if (raw.animations.length > 0) {
        const action = mixer.clipAction(raw.animations[0]);
        action.play();
      }

      onClipsChanged?.(raw.animations.map(c => c.name || `Clip ${c.uuid.slice(0, 6)}`));

      // Frame the camera to fit the model
      const box = new THREE.Box3().setFromObject(cloned);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      if (controlsRef.current) controlsRef.current.target.copy(center);
      if (cameraRef.current) {
        cameraRef.current.position.set(
          center.x + maxDim * 1.6,
          center.y + maxDim * 0.6,
          center.z + maxDim * 1.6,
        );
      }

      setLoading(false);
    };

    const loadFbx = (texture: THREE.Texture | null) => {
      loader.load(
        sourceUrl,
        (raw) => {
          applyMaterials(raw, texture);
          onModelReady(raw);
        },
        undefined,
        (err) => {
          console.error('[AdminAssets] Failed to load model:', sourceUrl, err);
          setError(`Failed to load model: ${sourceUrl.split('/').pop()}`);
          setLoading(false);
        },
      );
    };

    if (texturePath) {
      tgaLoader.load(
        texturePath,
        (tex) => {
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          loadFbx(tex as unknown as THREE.Texture);
        },
        undefined,
        () => {
          console.warn('[AdminAssets] TGA texture failed, falling back to faction colour:', texturePath);
          loadFbx(null);
        },
      );
    } else {
      loadFbx(null);
    }
  }, [asset, onClipsChanged]);

  // ── External animation FBX → retarget onto current skeleton ────────────
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    // Stop current actions; replay base or external below.
    mixer.stopAllAction();
    externalClipRef.current = null;

    if (!animation) {
      // Resume the model's first embedded clip (if any).
      const clip = baseClipsRef.current[0];
      if (clip) mixer.clipAction(clip).reset().play();
      return;
    }

    const url = normalizeAssetUrl(animation.path);
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx) => {
        // Pick the first non-empty clip.
        const clip = fbx.animations.find(c => c.tracks.length > 0) ?? fbx.animations[0];
        if (!clip) {
          console.warn('[AdminAssets] Animation file has no clips:', url);
          return;
        }
        if (!mixerRef.current) return; // model was unloaded
        externalClipRef.current = clip;
        const action = mixerRef.current.clipAction(clip);
        action.reset();
        action.setLoop(animation.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = animation.loop === false;
        action.play();
      },
      undefined,
      (err) => {
        console.error('[AdminAssets] Failed to load animation:', url, err);
      },
    );
  }, [animation]);

  const handleReset = () => {
    if (cameraRef.current && controlsRef.current && modelRef.current) {
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      controlsRef.current.target.copy(center);
      cameraRef.current.position.set(
        center.x + maxDim * 1.6,
        center.y + maxDim * 0.6,
        center.z + maxDim * 1.6,
      );
    }
  };

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white flex items-center gap-2">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
            Loading model...
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-4">
          <div className="text-red-400 text-sm text-center">{error}</div>
        </div>
      )}

      {!asset && !loading && !webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-muted-foreground text-center">
            <Box className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Select an asset to preview</p>
          </div>
        </div>
      )}

      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6">
          <div className="text-center max-w-sm">
            <FileX className="w-10 h-10 mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-300 font-medium mb-1">3D preview unavailable</p>
            <p className="text-xs text-muted-foreground">
              This browser can't create a WebGL context. The asset list, animation registry and metadata panels still work; pick an asset on the left to inspect it.
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => onPlayingChange(!isPlaying)}
          data-testid="button-toggle-animation"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleReset}
          data-testid="button-reset-camera"
          title="Reset camera"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {animation && (
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded bg-black/60 border border-white/10 text-xs">
          <span className="text-muted-foreground">Anim:</span>{' '}
          <span className="text-amber-300 font-medium">{animation.name}</span>
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset, isSelected, onSelect }: { 
  asset: Asset3D; 
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = categoryIcons[asset.category] || Box;
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover-elevate ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
      data-testid={`card-asset-${asset.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${categoryColors[asset.category]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{asset.name}</h4>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="outline" className="text-xs">
                {asset.category}
              </Badge>
              {asset.hasSkeleton && (
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30">
                  <Bone className="w-3 h-3 mr-1" />
                  {asset.skeletonType}
                </Badge>
              )}
              {asset.converted ? (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                  <FileCheck className="w-3 h-3 mr-1" />
                  GLB
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                  <FileX className="w-3 h-3 mr-1" />
                  FBX
                </Badge>
              )}
            </div>
            {asset.textures.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <ImageIcon className="w-3 h-3" />
                {asset.textures.length} texture{asset.textures.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnimationCard({ animation, isSelected, onSelect }: {
  animation: AssetAnimation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover-elevate ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
      data-testid={`card-animation-${animation.name.replace(/\s/g, '-').toLowerCase()}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
            <Play className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{animation.name}</h4>
            <div className="flex gap-1 mt-1">
              <Badge variant="outline" className="text-xs">
                {animation.loop ? 'Loop' : 'Once'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAssets() {
  const [selectedAsset, setSelectedAsset] = useState<Asset3D | null>(null);
  const [selectedAnimation, setSelectedAnimation] = useState<AssetAnimation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('characters');
  const [isPlaying, setIsPlaying] = useState(true);
  const [embeddedClipNames, setEmbeddedClipNames] = useState<string[]>([]);

  const characters    = useMemo(() => getAssetsByCategory('character'), []);
  const creatures     = useMemo(() => getAssetsByCategory('creature'), []);
  const combatAnims   = useMemo(() => getAnimationsByType('combat'), []);
  const movementAnims = useMemo(() => getAnimationsByType('movement'), []);
  const emoteAnims    = useMemo(() => getAnimationsByType('emote'), []);

  // Selecting a new asset clears any external animation override so its embedded
  // clip plays first. (External clip is rebound to the new skeleton on next pick.)
  const handleSelectAsset = (asset: Asset3D) => {
    setSelectedAsset(asset);
    setSelectedAnimation(null);
    setIsPlaying(true);
  };

  // Toon-RTS panel → main viewer bridge
  const handleSelectRace = (race: Race) => {
    handleSelectAsset(buildRaceAsset(race));
  };
  const selectedRaceFromAsset: Race | null = (() => {
    if (!selectedAsset) return null;
    const m = selectedAsset.id.match(/^toonrts-(human|barbarian|dwarf|elf|orc|undead)$/);
    return (m?.[1] as Race) ?? null;
  })();

  const filterAssets = (assets: Asset3D[]) => {
    if (!searchQuery) return assets;
    const query = searchQuery.toLowerCase();
    return assets.filter(a => 
      a.name.toLowerCase().includes(query) ||
      a.tags.some(t => t.toLowerCase().includes(query))
    );
  };

  const filterAnimations = (anims: AssetAnimation[]) => {
    if (!searchQuery) return anims;
    const query = searchQuery.toLowerCase();
    return anims.filter(a => a.name.toLowerCase().includes(query));
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-admin-assets">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold mb-4">3D Asset Manager</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-assets"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-4 mx-4 mt-4">
            <TabsTrigger value="characters" data-testid="tab-characters">
              <User className="w-4 h-4 mr-1" />
              Chars
            </TabsTrigger>
            <TabsTrigger value="creatures" data-testid="tab-creatures">
              <Bug className="w-4 h-4 mr-1" />
              NPCs
            </TabsTrigger>
            <TabsTrigger value="animations" data-testid="tab-animations">
              <Play className="w-4 h-4 mr-1" />
              Anims
            </TabsTrigger>
            <TabsTrigger value="toonrts" data-testid="tab-toonrts">
              <Swords className="w-4 h-4 mr-1" />
              Toon
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-4">
            <TabsContent value="characters" className="mt-0 space-y-2">
              {filterAssets(characters).map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => handleSelectAsset(asset)}
                />
              ))}
            </TabsContent>

            <TabsContent value="creatures" className="mt-0 space-y-2">
              {filterAssets(creatures).map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => handleSelectAsset(asset)}
                />
              ))}
            </TabsContent>

            <TabsContent value="animations" className="mt-0 space-y-4">
              {!selectedAsset && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  Pick a character first — animations are retargeted onto the loaded skeleton.
                </div>
              )}
              {selectedAsset && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  Active rig: <strong>{selectedAsset.name}</strong>
                  {embeddedClipNames.length > 0 && (
                    <div className="mt-1 text-[10px] text-emerald-200/80">
                      {embeddedClipNames.length} embedded clip{embeddedClipNames.length === 1 ? '' : 's'}: {embeddedClipNames.slice(0, 3).join(', ')}{embeddedClipNames.length > 3 ? '…' : ''}
                    </div>
                  )}
                </div>
              )}
              {selectedAnimation && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedAnimation(null)}
                  data-testid="button-clear-animation"
                >
                  Clear override (back to embedded clip)
                </Button>
              )}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Combat ({filterAnimations(combatAnims).length})</h3>
                <div className="space-y-2">
                  {filterAnimations(combatAnims).map(anim => (
                    <AnimationCard
                      key={anim.name}
                      animation={anim}
                      isSelected={selectedAnimation?.name === anim.name}
                      onSelect={() => setSelectedAnimation(anim)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Movement ({filterAnimations(movementAnims).length})</h3>
                <div className="space-y-2">
                  {filterAnimations(movementAnims).map(anim => (
                    <AnimationCard
                      key={anim.name}
                      animation={anim}
                      isSelected={selectedAnimation?.name === anim.name}
                      onSelect={() => setSelectedAnimation(anim)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Emotes ({filterAnimations(emoteAnims).length})</h3>
                <div className="space-y-2">
                  {filterAnimations(emoteAnims).map(anim => (
                    <AnimationCard
                      key={anim.name}
                      animation={anim}
                      isSelected={selectedAnimation?.name === anim.name}
                      onSelect={() => setSelectedAnimation(anim)}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="toonrts" className="mt-0 space-y-2">
              <ToonRTSCharacterPanel
                onSelectRace={handleSelectRace}
                selectedRaceFromAsset={selectedRaceFromAsset}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-4 border-t">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Total Assets:</div>
            <div className="text-right font-medium">{ASSET_REGISTRY.length}</div>
            <div className="text-muted-foreground">Animations:</div>
            <div className="text-right font-medium">{ANIMATION_REGISTRY.length}</div>
            <div className="text-muted-foreground">Converted:</div>
            <div className="text-right font-medium text-green-400">
              {ASSET_REGISTRY.filter(a => a.converted).length}/{ASSET_REGISTRY.length}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b flex items-center justify-between px-6">
          <div>
            {selectedAsset ? (
              <div>
                <h2 className="font-semibold">{selectedAsset.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedAsset.sourcePath}</p>
              </div>
            ) : (
              <h2 className="text-muted-foreground">No asset selected</h2>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!selectedAsset} data-testid="button-convert-asset">
              <Download className="w-4 h-4 mr-2" />
              Convert to GLB
            </Button>
          </div>
        </div>

        <div className="flex-1 p-6">
          <Asset3DViewer
            asset={selectedAsset}
            animation={selectedAnimation}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
            onClipsChanged={setEmbeddedClipNames}
          />
        </div>

        {selectedAsset && (
          <div className="h-48 border-t p-4">
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="textures">Textures ({selectedAsset.textures.length})</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="mt-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-medium capitalize">{selectedAsset.category}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skeleton:</span>
                    <p className="font-medium">{selectedAsset.hasSkeleton ? selectedAsset.skeletonType : 'None'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scale:</span>
                    <p className="font-medium">{selectedAsset.scale}x</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">License:</span>
                    <p className="font-medium">{selectedAsset.license || 'Unknown'}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="textures" className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedAsset.textures.map(tex => (
                    <Badge key={tex.name} variant="outline">
                      <ImageIcon className="w-3 h-3 mr-1" />
                      {tex.name} ({tex.type})
                    </Badge>
                  ))}
                  {selectedAsset.textures.length === 0 && (
                    <p className="text-muted-foreground text-sm">No textures found</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="tags" className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedAsset.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <div className="w-48 border-l p-4">
        <h3 className="font-medium mb-4">Race Icons</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(RACE_ICONS).map(([race, path]) => (
            <div key={race} className="text-center">
              <img
                src={`/${path}`}
                alt={race}
                className="w-12 h-12 mx-auto rounded-lg bg-card"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.png';
                }}
              />
              <span className="text-xs text-muted-foreground capitalize">{race}</span>
            </div>
          ))}
        </div>

        <h3 className="font-medium mt-6 mb-4">Quick Stats</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Characters</span>
            <span>{characters.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creatures</span>
            <span>{creatures.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Combat Anims</span>
            <span>{combatAnims.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Movement</span>
            <span>{movementAnims.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Emotes</span>
            <span>{emoteAnims.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
