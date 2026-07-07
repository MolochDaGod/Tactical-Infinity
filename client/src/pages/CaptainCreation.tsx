import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Anchor, Sword, Sparkles, Shield, Zap, RefreshCw, CheckCircle2, User, ImagePlus, Wand2 } from "lucide-react";
import { RACE_PALETTES, type RaceId } from "@/lib/raceColorPalettes";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadPuterAI } from "@/lib/puterAI";

// ── Inline Three.js GLTF head viewer ─────────────────────────────────────────
function GltfHeadViewer({ modelUrl }: { modelUrl: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 260;
    const h = mount.clientHeight || 220;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 0, 1.8);

    const amb  = new THREE.AmbientLight(0xffffff, 0.6);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(2, 3, 4);
    const dir2 = new THREE.DirectionalLight(0x88aaff, 0.4);
    dir2.position.set(-2, -1, -2);
    scene.add(amb, dir1, dir2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.enablePan = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 5;

    let animId = 0;
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        model.position.sub(center);
        const scale = 1.2 / maxDim;
        model.scale.setScalar(scale);
        scene.add(model);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      undefined,
      (err) => console.warn("GLTF load error:", err),
    );

    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [modelUrl]);

  return <div ref={mountRef} className="w-full h-56 rounded-lg overflow-hidden" />;
}

import humanImg from "@/assets/races/human.png";
import orcImg from "@/assets/races/orc.png";
import undeadImg from "@/assets/races/undead.png";
import barbarianImg from "@/assets/races/barbarian.png";
import dwarfImg from "@/assets/races/dwarf.png";
import elfImg from "@/assets/races/elf.png";
import { FactionEmblem } from "@/components/game/FactionEmblem";

const RACE_IMAGES: Record<string, string> = {
  human: humanImg,
  orc: orcImg,
  undead: undeadImg,
  barbarian: barbarianImg,
  dwarf: dwarfImg,
  elf: elfImg,
};

const RACE_INFO: Record<string, { name: string; faction: string; description: string; bonuses: string[] }> = {
  human: {
    name: "Human",
    faction: "Crusade",
    description: "Versatile adventurers with balanced attributes and strong leadership.",
    bonuses: ["+5% Experience gain", "+2 Tactics", "Balanced stats"]
  },
  barbarian: {
    name: "Barbarian", 
    faction: "Crusade",
    description: "Fierce warriors from the northern wastes, favoring raw strength.",
    bonuses: ["+10% Melee damage", "+3 Strength", "+2 Vitality"]
  },
  dwarf: {
    name: "Dwarf",
    faction: "Fabled",
    description: "Stout craftsmen and warriors with unmatched endurance.",
    bonuses: ["+15% Block chance", "+3 Endurance", "+2 Vitality"]
  },
  elf: {
    name: "Elf",
    faction: "Fabled", 
    description: "Ancient and graceful, masters of magic and precision.",
    bonuses: ["+10% Magic damage", "+3 Dexterity", "+2 Intellect"]
  },
  orc: {
    name: "Orc",
    faction: "Legion",
    description: "Brutal warriors who thrive in combat and conquest.",
    bonuses: ["+15% Critical damage", "+3 Strength", "+2 Agility"]
  },
  undead: {
    name: "Undead",
    faction: "Legion",
    description: "Risen warriors immune to fear and resistant to poison.",
    bonuses: ["Immune to poison", "+20% Resistance", "+2 Wisdom"]
  }
};

const CLASS_INFO: Record<string, { name: string; icon: typeof Sword; description: string; role: string }> = {
  warrior: { name: "Warrior", icon: Shield,    description: "Heavy armor, sword and shield",    role: "Tank / Melee DPS" },
  ranger:  { name: "Ranger",  icon: Sword,     description: "Ranged attacks, bow and arrows",   role: "Ranged DPS" },
  mage:    { name: "Mage",    icon: Sparkles,  description: "Powerful spells, mystical staff",  role: "Magic DPS" },
  worge:   { name: "Worge",   icon: Zap,       description: "Forge weapons, deploy turrets",    role: "Forge / Engineer" },
};

const HAIR_COLORS = ["black", "brown", "dark_brown", "blonde", "red", "white", "gray", "bald"];
const BUILDS = ["athletic", "slim", "stocky", "muscular", "average"];

// Race-specific fallback model paths (Toon RTS assets)
const RACE_FALLBACK_MODELS: Record<string, string> = {
  human: '/toon_rts/Toon_RTS/WesternKingdoms/models/WK_Characters_customizable.FBX',
  barbarian: '/toon_rts/Toon_RTS/Barbarians/models/BRB_Characters_customizable.FBX',
  dwarf: '/toon_rts/Toon_RTS/Dwarves/models/DWF_Characters_customizable.FBX',
  elf: '/toon_rts/Toon_RTS/Elves/models/ELF_Characters_customizable.FBX',
  orc: '/toon_rts/Toon_RTS/Orcs/models/ORC_Characters_Customizable.FBX',
  undead: '/toon_rts/Toon_RTS/Undead/models/UD_Characters_customizable.FBX',
};

interface CaptainCreationProps {
  onBack: () => void;
  onCaptainCreated?: (captain: CaptainData) => void;
}

interface CaptainData {
  name: string;
  race: string;
  characterClass: string;
  hairColor: string;
  build: string;
  taskId?: string;
  useFallbackModel?: boolean;
  fallbackModelPath?: string;
}

export default function CaptainCreation({ onBack, onCaptainCreated }: CaptainCreationProps) {
  const { toast } = useToast();
  const [captainName, setCaptainName] = useState("");
  const [selectedRace, setSelectedRace] = useState<string>("human");
  const [selectedClass, setSelectedClass] = useState<string>("warrior");
  const [hairColor, setHairColor] = useState<string>("brown");
  const [build, setBuild] = useState<string>("athletic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTaskId, setGenerationTaskId] = useState<string | null>(null);

  // Head generation state
  const [isGeneratingHead, setIsGeneratingHead] = useState(false);
  const [headTaskId, setHeadTaskId] = useState<string | null>(null);
  const [headProgress, setHeadProgress] = useState(0);
  const [headStatus, setHeadStatus] = useState<'idle' | 'queued' | 'generating' | 'done' | 'failed'>('idle');
  const [headModelUrl, setHeadModelUrl] = useState<string | null>(null);
  const [meshyAvailable, setMeshyAvailable] = useState<boolean | null>(null);
  const headPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Avatar + retexture pipeline state
  const [avatarPrompt, setAvatarPrompt] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPublicUrl, setAvatarPublicUrl] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [retextureTaskId, setRetextureTaskId] = useState<string | null>(null);
  const [retextureStatus, setRetextureStatus] = useState<'idle' | 'queued' | 'generating' | 'done' | 'failed'>('idle');
  const [retextureProgress, setRetextureProgress] = useState(0);
  const retexturePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check Meshy availability on mount
  useEffect(() => {
    fetch('/api/meshy/status')
      .then(r => r.json())
      .then(d => setMeshyAvailable(!!d.configured))
      .catch(() => setMeshyAvailable(false));
  }, []);

  // Poll head task when headTaskId is set
  useEffect(() => {
    if (!headTaskId) return;
    headPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/meshy/task/${headTaskId}`);
        const task = await res.json();
        setHeadProgress(task.progress || 0);
        if (task.status === 'SUCCEEDED') {
          clearInterval(headPollRef.current!);
          setHeadStatus('done');
          setIsGeneratingHead(false);
          const url = task.model_urls?.glb || task.model_url || null;
          setHeadModelUrl(url);
          toast({ title: "Face model ready!", description: "Your captain's unique face has been generated." });
        } else if (task.status === 'FAILED') {
          clearInterval(headPollRef.current!);
          setHeadStatus('failed');
          setIsGeneratingHead(false);
          toast({ title: "Generation failed", description: task.task_error?.message || "Meshy could not generate the model.", variant: "destructive" });
        } else {
          setHeadStatus(task.status === 'IN_QUEUE' ? 'queued' : 'generating');
        }
      } catch { /* ignore poll errors */ }
    }, 4000);
    return () => { if (headPollRef.current) clearInterval(headPollRef.current); };
  }, [headTaskId, toast]);

  const generateCaptainHead = async () => {
    if (!captainName.trim()) {
      toast({ title: "Name Required", description: "Enter a name before generating.", variant: "destructive" });
      return;
    }
    setIsGeneratingHead(true);
    setHeadStatus('queued');
    setHeadProgress(0);
    setHeadModelUrl(null);
    setHeadTaskId(null);
    try {
      const res = await fetch('/api/meshy/generate-captain-head', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: captainName, race: selectedRace, characterClass: selectedClass, hairColor }),
      });
      const data = await res.json();
      if (data.success && data.taskId) {
        setHeadTaskId(data.taskId);
        toast({ title: "Generating face…", description: "Meshy is sculpting your captain's face. This takes 1-2 minutes." });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setIsGeneratingHead(false);
      setHeadStatus('failed');
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }
  };

  // ── Avatar → Meshy retexture pipeline ───────────────────────────────────────
  const buildAvatarPrompt = (): string => {
    if (avatarPrompt.trim()) return avatarPrompt.trim();
    const raceInfo = RACE_INFO[selectedRace];
    const classInfo = CLASS_INFO[selectedClass];
    return `portrait of a ${raceInfo?.name || selectedRace} ${classInfo?.name || selectedClass} named ${captainName || 'captain'}, ${hairColor} hair, fantasy RPG character art, painterly, detailed face, expressive eyes, head and shoulders, neutral background`;
  };

  const generateAvatar = async () => {
    setIsGeneratingAvatar(true);
    setAvatarUrl(null);
    setAvatarPublicUrl(null);
    try {
      const ok = await loadPuterAI();
      if (!ok || !window.puter?.ai?.txt2img) {
        throw new Error("Puter.js AI not available");
      }
      const prompt = buildAvatarPrompt();
      const img = (await window.puter.ai.txt2img(prompt)) as HTMLImageElement;
      // Wait for the image to actually decode so the canvas draws non-empty pixels.
      if (!img.complete || !img.naturalWidth) {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Avatar image failed to load"));
        });
      }
      // Convert to data URL via canvas (puter.ai.txt2img can return CDN-hosted images).
      const w = img.naturalWidth || 512;
      const h = img.naturalHeight || 512;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas 2d context unavailable");
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png');
      setAvatarUrl(dataUrl);

      // Upload to our backend so Meshy can fetch it via a public URL.
      const up = await fetch('/api/meshy/upload-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const upJson = await up.json();
      if (!upJson.success) throw new Error(upJson.error || 'Upload failed');
      setAvatarPublicUrl(upJson.url);
      toast({ title: "Avatar ready", description: "Portrait generated. Apply it as a face texture next." });
    } catch (err: any) {
      toast({ title: "Avatar generation failed", description: err.message || String(err), variant: "destructive" });
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // Poll retexture task
  useEffect(() => {
    if (!retextureTaskId) return;
    retexturePollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/meshy/texture-task/${retextureTaskId}`);
        const t = await r.json();
        setRetextureProgress(t.progress || 0);
        if (t.status === 'SUCCEEDED') {
          clearInterval(retexturePollRef.current!);
          setRetextureStatus('done');
          // Meshy returns the retextured model URL on .model_urls.glb
          const url = t.model_urls?.glb || t.model_url || null;
          if (url) setHeadModelUrl(url);
          toast({ title: "Retexture complete!", description: "Your captain's face has been re-skinned." });
        } else if (t.status === 'FAILED' || t.status === 'EXPIRED') {
          clearInterval(retexturePollRef.current!);
          setRetextureStatus('failed');
          toast({ title: "Retexture failed", description: t.task_error?.message || 'Meshy rejected the request.', variant: "destructive" });
        } else {
          setRetextureStatus(t.status === 'PENDING' ? 'queued' : 'generating');
        }
      } catch { /* ignore poll errors */ }
    }, 4000);
    return () => { if (retexturePollRef.current) clearInterval(retexturePollRef.current); };
  }, [retextureTaskId, toast]);

  const startRetexture = async () => {
    if (!headModelUrl) {
      toast({ title: "Generate a face first", description: "You need a head model before applying a texture.", variant: "destructive" });
      return;
    }
    if (!avatarPublicUrl) {
      toast({ title: "Generate the avatar first", description: "Create the 2D portrait, then retexture.", variant: "destructive" });
      return;
    }
    setRetextureStatus('queued');
    setRetextureProgress(0);
    setRetextureTaskId(null);
    try {
      const res = await fetch('/api/meshy/retexture-head', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelUrl: headModelUrl,
          textureImageUrl: avatarPublicUrl,
          name: captainName,
          race: selectedRace,
          characterClass: selectedClass,
          stylePrompt: buildAvatarPrompt(),
        }),
      });
      const data = await res.json();
      if (data.success && data.taskId) {
        setRetextureTaskId(data.taskId);
        toast({ title: "Retexturing face…", description: "Meshy is painting your portrait onto the model. ~1-2 min." });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setRetextureStatus('failed');
      toast({ title: "Retexture failed to start", description: err.message, variant: "destructive" });
    }
  };

  // Quick create with fallback model (no API call needed)
  const handleQuickCreate = () => {
    if (!captainName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your captain.",
        variant: "destructive"
      });
      return;
    }

    const fallbackModelPath = RACE_FALLBACK_MODELS[selectedRace];
    
    toast({
      title: "Captain Created!",
      description: `${captainName} the ${RACE_INFO[selectedRace].name} ${CLASS_INFO[selectedClass].name} is ready to play!`
    });

    if (onCaptainCreated) {
      onCaptainCreated({
        name: captainName,
        race: selectedRace,
        characterClass: selectedClass,
        hairColor,
        build,
        useFallbackModel: true,
        fallbackModelPath
      });
    }
  };

  const handleCreateCaptain = async () => {
    if (!captainName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your captain.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/meshy/generate-custom-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: captainName,
          race: selectedRace,
          characterClass: selectedClass,
          hairColor,
          build
        })
      });

      const data = await response.json();

      if (data.success) {
        setGenerationTaskId(data.taskId);
        toast({
          title: "Captain Created!",
          description: `${captainName} the ${RACE_INFO[selectedRace].name} ${CLASS_INFO[selectedClass].name} is being generated. Task ID: ${data.taskId}`
        });

        if (onCaptainCreated) {
          onCaptainCreated({
            name: captainName,
            race: selectedRace,
            characterClass: selectedClass,
            hairColor,
            build,
            taskId: data.taskId
          });
        }
      } else {
        // API failed - offer fallback option
        toast({
          title: "Generation Unavailable",
          description: "Using race-specific model instead. You can still play!",
        });
        
        // Use fallback model automatically
        handleQuickCreate();
      }
    } catch (error) {
      // Network error - use fallback
      toast({
        title: "Connection Issue",
        description: "Using race-specific model. You can still play!",
      });
      
      handleQuickCreate();
    } finally {
      setIsGenerating(false);
    }
  };

  const raceInfo = RACE_INFO[selectedRace];
  const classInfo = CLASS_INFO[selectedClass];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Anchor className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-cinzel font-bold text-foreground">Create Your Captain</h1>
          </div>
          <Button variant="outline" onClick={onBack} data-testid="button-back-captain">
            Back to Menu
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-cinzel">Captain Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="captain-name">Captain Name</Label>
                <Input
                  id="captain-name"
                  placeholder="Enter your captain's name..."
                  value={captainName}
                  onChange={(e) => setCaptainName(e.target.value)}
                  className="text-lg"
                  data-testid="input-captain-name"
                />
              </div>

              <div className="space-y-3">
                <Label>Choose Your Race</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(RACE_INFO).map(([raceId, info]) => {
                    const palette = RACE_PALETTES[raceId as RaceId];
                    const swatches = palette ? [
                      { label: 'Skin',    hex: palette.skin },
                      { label: 'Hair',    hex: palette.hair },
                      { label: 'Cloth',   hex: palette.clothPrimary },
                      { label: 'Metal',   hex: palette.metal },
                      { label: 'Boots',   hex: palette.boots },
                    ] : [];
                    return (
                      <button
                        key={raceId}
                        onClick={() => setSelectedRace(raceId)}
                        className={`relative p-2 rounded-lg border-2 transition-all hover-elevate text-left ${
                          selectedRace === raceId
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid={`button-race-${raceId}`}
                      >
                        <img
                          src={RACE_IMAGES[raceId]}
                          alt={info.name}
                          className="w-full h-24 object-contain rounded"
                        />
                        <div className="mt-2 text-center">
                          <p className="font-semibold text-sm">{info.name}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {info.faction}
                          </Badge>
                        </div>
                        {/* Color swatches */}
                        <div className="flex gap-1 mt-2 justify-center">
                          {swatches.map(sw => (
                            <div
                              key={sw.label}
                              title={sw.label}
                              className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: `#${sw.hex.toString(16).padStart(6, '0')}` }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Choose Your Class</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(CLASS_INFO).map(([classId, info]) => {
                    const Icon = info.icon;
                    const classColors: Record<string, string> = {
                      warrior: 'border-blue-500/60 bg-blue-950/30',
                      ranger:  'border-green-500/60 bg-green-950/30',
                      mage:    'border-purple-500/60 bg-purple-950/30',
                      worge:   'border-orange-500/60 bg-orange-950/30',
                    };
                    const classIconColors: Record<string, string> = {
                      warrior: 'text-blue-400',
                      ranger:  'text-green-400',
                      mage:    'text-purple-400',
                      worge:   'text-orange-400',
                    };
                    return (
                      <button
                        key={classId}
                        onClick={() => setSelectedClass(classId)}
                        className={`p-4 rounded-lg border-2 transition-all hover-elevate ${
                          selectedClass === classId
                            ? classColors[classId] || "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid={`button-class-${classId}`}
                      >
                        <Icon className={`w-8 h-8 mx-auto mb-2 ${classIconColors[classId] || 'text-primary'}`} />
                        <p className="font-semibold text-sm text-center">{info.name}</p>
                        <p className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">{info.role}</p>
                        <p className="text-xs text-muted-foreground/70 text-center mt-1">{info.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hair Color</Label>
                  <Select value={hairColor} onValueChange={setHairColor}>
                    <SelectTrigger data-testid="select-hair-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HAIR_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Build</Label>
                  <Select value={build} onValueChange={setBuild}>
                    <SelectTrigger data-testid="select-build">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILDS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b.charAt(0).toUpperCase() + b.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-cinzel">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-square bg-card rounded-lg overflow-hidden border">
                <img 
                  src={RACE_IMAGES[selectedRace]} 
                  alt={raceInfo.name}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2">
                <h3 className="font-cinzel text-xl text-primary">
                  {captainName || "Your Captain"}
                </h3>
                <p className="text-muted-foreground">
                  {raceInfo.name} {classInfo.name}
                </p>
                <FactionEmblem
                  faction={raceInfo.faction.toLowerCase() as 'crusade' | 'fabled' | 'legion'}
                  size={44}
                  showLabel
                  glow
                />
              </div>

              {/* Full Race Color Palette */}
              {RACE_PALETTES[selectedRace as RaceId] && (() => {
                const p = RACE_PALETTES[selectedRace as RaceId];
                const slots = [
                  { label: 'Skin',   hex: p.skin },
                  { label: 'Hair',   hex: p.hair },
                  { label: 'Cloth',  hex: p.clothPrimary },
                  { label: 'Cloth2', hex: p.clothSecondary },
                  { label: 'Belt',   hex: p.belt },
                  { label: 'Boots',  hex: p.boots },
                  { label: 'Metal',  hex: p.metal },
                  { label: 'Trim',   hex: p.trim },
                  { label: 'Eye',    hex: p.eye },
                ];
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Race Color Palette</p>
                    <div className="flex gap-1 flex-wrap">
                      {slots.map(s => (
                        <div key={s.label} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-6 h-6 rounded border border-black/30"
                            title={s.label}
                            style={{ backgroundColor: `#${s.hex.toString(16).padStart(6, '0')}` }}
                          />
                          <span className="text-[8px] text-muted-foreground">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{raceInfo.description}</p>
                <div className="space-y-1">
                  {raceInfo.bonuses.map((bonus, i) => (
                    <p key={i} className="text-xs text-green-500">+ {bonus}</p>
                  ))}
                </div>
              </div>

              {/* ── Quick Generate Face panel ── */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">3D Face Generation</span>
                  {meshyAvailable === false && (
                    <Badge variant="destructive" className="text-[10px]">API Key Required</Badge>
                  )}
                  {meshyAvailable === true && (
                    <Badge variant="outline" className="text-[10px] border-green-500 text-green-400">Meshy Ready</Badge>
                  )}
                </div>

                <div className="p-3 space-y-3">
                  {/* Model viewer or placeholder */}
                  {headModelUrl ? (
                    <GltfHeadViewer modelUrl={headModelUrl} />
                  ) : (
                    <div className="w-full h-40 rounded-lg bg-muted/40 border border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <User className="w-10 h-10 opacity-30" />
                      <p className="text-xs">Your unique face will appear here</p>
                    </div>
                  )}

                  {/* Progress bar while generating */}
                  {isGeneratingHead && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {headStatus === 'queued' ? 'In queue…' : `Sculpting ${headProgress}%…`}
                        </span>
                        <span className="font-mono">{headProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700"
                          style={{ width: `${headProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {headStatus === 'done' && (
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Face model ready — drag to rotate
                    </p>
                  )}

                  {/* Generate / Regenerate button */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      variant={headStatus === 'done' ? 'outline' : 'default'}
                      onClick={generateCaptainHead}
                      disabled={isGeneratingHead || meshyAvailable === false || !captainName.trim()}
                      data-testid="button-generate-face"
                    >
                      {isGeneratingHead ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                      ) : headStatus === 'done' ? (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate Face</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Unique Face</>
                      )}
                    </Button>
                    {headStatus === 'done' && (
                      <Button
                        size="sm"
                        onClick={handleQuickCreate}
                        disabled={!captainName.trim()}
                        data-testid="button-accept-face"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Accept
                      </Button>
                    )}
                  </div>

                  {meshyAvailable === false && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Add a MESHY_API_KEY secret to enable AI face generation
                    </p>
                  )}
                  {meshyAvailable === true && headStatus === 'idle' && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Uses Meshy AI to sculpt a unique face for {captainName || 'your captain'} — ~1-2 min
                    </p>
                  )}

                  {/* ── Avatar → Meshy retexture pipeline ────────────────── */}
                  <div className="border-t border-border pt-3 mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Wand2 className="w-3 h-3" /> Avatar Retexture
                      </Label>
                      {avatarPublicUrl && (
                        <Badge variant="outline" className="text-[10px] border-cyan-500 text-cyan-400">
                          Avatar Ready
                        </Badge>
                      )}
                    </div>

                    <Input
                      placeholder="Optional: describe the portrait (or auto-build from race/class)"
                      value={avatarPrompt}
                      onChange={(e) => setAvatarPrompt(e.target.value)}
                      className="h-8 text-xs"
                      data-testid="input-avatar-prompt"
                    />

                    {avatarUrl && (
                      <div className="flex justify-center">
                        <img
                          src={avatarUrl}
                          alt="Generated avatar"
                          className="w-24 h-24 rounded border border-border object-cover"
                          data-testid="img-generated-avatar"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={generateAvatar}
                        disabled={isGeneratingAvatar}
                        data-testid="button-generate-avatar"
                      >
                        {isGeneratingAvatar ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Painting…</>
                        ) : (
                          <><ImagePlus className="w-3.5 h-3.5 mr-1.5" />{avatarUrl ? 'Regenerate Avatar' : 'Generate Avatar'}</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={startRetexture}
                        disabled={!headModelUrl || !avatarPublicUrl || retextureStatus === 'queued' || retextureStatus === 'generating'}
                        data-testid="button-retexture-head"
                      >
                        {retextureStatus === 'queued' || retextureStatus === 'generating' ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{retextureProgress}%</>
                        ) : retextureStatus === 'done' ? (
                          <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Re-Apply</>
                        ) : (
                          <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Apply to Head</>
                        )}
                      </Button>
                    </div>

                    {(retextureStatus === 'queued' || retextureStatus === 'generating') && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                          style={{ width: `${retextureProgress}%` }}
                        />
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Generates a free 2D portrait via Puter.js, then sends it to Meshy to repaint the face model's texture.
                    </p>
                  </div>
                </div>
              </div>

              {generationTaskId && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Generation Task ID:</p>
                  <p className="text-xs font-mono break-all">{generationTaskId}</p>
                </div>
              )}

              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleQuickCreate}
                  disabled={!captainName.trim()}
                  data-testid="button-quick-create"
                >
                  <Sword className="w-4 h-4 mr-2" />
                  Quick Start (Use Race Model)
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  variant="outline"
                  onClick={handleCreateCaptain}
                  disabled={isGenerating || !captainName.trim()}
                  data-testid="button-create-captain"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Custom...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Full AI Body
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Full body generation may take 1-3 minutes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
