import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, Save, Sword, Users, Wand2, Shield, Crosshair, Zap, Eye, Move, Moon, Sun, Image, Sparkles, MapPin, Layers, Mountain, Palette, Video, Hammer, FlaskConical, Ship as ShipIcon, Waves, Fish } from "lucide-react";
import { ShipTester } from "@/components/admin/testers/ShipTester";
import { OceanTester } from "@/components/admin/testers/OceanTester";
import { FishingTester } from "@/components/admin/testers/FishingTester";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

import { RACES, CLASSES, FACTIONS } from "@shared/gameDefinitions/racesClasses";
import { ALL_WEAPONS, WEAPON_TYPES, type Weapon } from "@shared/gameDefinitions/weapons";
import { 
  CHARACTER_SPRITES, 
  MONSTER_SPRITES, 
  EFFECT_SPRITES, 
  SPELL_ICONS,
  ANIMATION_STATES,
  type SpriteDefinition 
} from "@shared/gameDefinitions/sprites";

import {
  saveSpriteOverrides,
  saveWeaponEffects,
  loadSpriteOverrides,
  loadWeaponEffects,
  type SpriteAssignment,
  type WeaponEffectConfig,
} from "@/lib/adminOverrides";
import { useToast } from "@/hooks/use-toast";

const ALL_SPRITES: SpriteDefinition[] = [
  ...Object.values(CHARACTER_SPRITES),
  ...Object.values(MONSTER_SPRITES),
  ...Object.values(EFFECT_SPRITES),
];

const EFFECT_TYPES = [
  "slash", "explosion", "heal", "fire", "frost", "lightning", "poison", "shadow",
  "phase", "flash_step", "dash_trail", "teleport",
  "spell_fire", "spell_ice", "spell_lightning", "spell_arcane", "spell_holy", "spell_shadow",
  "aoe_fire", "aoe_ice", "aoe_poison", "channel_beam", "summon_portal"
];

const EFFECT_CATEGORIES = {
  "Combat": ["slash", "explosion", "heal"],
  "Elements": ["fire", "frost", "lightning", "poison", "shadow"],
  "Movement": ["phase", "flash_step", "dash_trail", "teleport"],
  "Spell Cast": ["spell_fire", "spell_ice", "spell_lightning", "spell_arcane", "spell_holy", "spell_shadow"],
  "Area Effects": ["aoe_fire", "aoe_ice", "aoe_poison", "channel_beam", "summon_portal"],
};

const ANIMATION_TYPES = ["slash", "thrust", "swing", "projectile", "spell", "phase", "flash", "channel"];

interface SpriteCanvasProps {
  spritePath: string;
  spriteId: string;
  frameWidth?: number;
  frameHeight?: number;
  size?: number;
  animate?: boolean;
}

function SpriteCanvas({ spritePath, spriteId, frameWidth = 64, frameHeight = 64, size = 128, animate = true }: SpriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      setError(false);
    };
    
    img.onerror = () => {
      setError(true);
      setImageLoaded(false);
    };
    
    img.src = spritePath;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [spritePath]);

  const drawFrame = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;
    
    const frameDuration = 200;
    if (timestamp - lastTimeRef.current > frameDuration && animate) {
      frameRef.current = (frameRef.current + 1) % 4;
      lastTimeRef.current = timestamp;
    }
    
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const sourceX = frameRef.current * frameWidth;
    const sourceY = 0;
    
    const scale = Math.min(size / frameWidth, size / frameHeight);
    const destWidth = frameWidth * scale;
    const destHeight = frameHeight * scale;
    const destX = (size - destWidth) / 2;
    const destY = (size - destHeight) / 2;
    
    ctx.drawImage(
      img,
      sourceX, sourceY, frameWidth, frameHeight,
      destX, destY, destWidth, destHeight
    );
    
    animationRef.current = requestAnimationFrame(drawFrame);
  }, [frameWidth, frameHeight, size, animate]);

  useEffect(() => {
    if (imageLoaded) {
      animationRef.current = requestAnimationFrame(drawFrame);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [imageLoaded, drawFrame]);

  if (error) {
    return (
      <div 
        className="bg-muted rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30"
        style={{ width: size, height: size }}
        data-testid="sprite-preview"
      >
        <Users className="w-8 h-8 mb-2 opacity-50 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center px-2">{spriteId}</p>
        <p className="text-xs text-destructive/70 mt-1">No image</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="bg-muted rounded-lg border border-border"
      style={{ width: size, height: size }}
      data-testid="sprite-preview"
    />
  );
}

export default function Admin({ onBack, onViewSprites, onViewAssets, onViewVideoGen, onViewPolygonJS, onViewBuilderTest, onViewTurretDemo, onViewIslandEditor, onViewPixyFx, onViewAssetRegistry, onViewRaceViewer }: { onBack: () => void; onViewSprites?: () => void; onViewAssets?: () => void; onViewVideoGen?: () => void; onViewPolygonJS?: () => void; onViewBuilderTest?: () => void; onViewTurretDemo?: () => void; onViewIslandEditor?: () => void; onViewPixyFx?: () => void; onViewAssetRegistry?: () => void; onViewRaceViewer?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hub");
  
  const [spriteAssignments, setSpriteAssignments] = useState<SpriteAssignment[]>(() => {
    const overrides = loadSpriteOverrides();
    const assignments: SpriteAssignment[] = [];
    Object.keys(RACES).forEach(raceId => {
      Object.keys(CLASSES).forEach(classId => {
        const saved = overrides[`${raceId}:${classId}`];
        assignments.push({
          raceId,
          classId,
          spriteId: classId,
          spritePath: saved || CHARACTER_SPRITES[classId]?.path || `/2dassets/characters/${classId}.png`,
        });
      });
    });
    return assignments;
  });

  // Only sprite entries the user actually edits get persisted, so clicking
  // Save never overwrites live default sprite paths with the placeholder matrix.
  const [editedSpriteKeys, setEditedSpriteKeys] = useState<Set<string>>(
    () => new Set(Object.keys(loadSpriteOverrides()))
  );
  const [editedWeaponIds, setEditedWeaponIds] = useState<Set<string>>(
    () => new Set(loadWeaponEffects().map(w => w.weaponId))
  );

  const [weaponEffects, setWeaponEffects] = useState<WeaponEffectConfig[]>(() => {
    const savedById = new Map(loadWeaponEffects().map(w => [w.weaponId, w]));
    return ALL_WEAPONS.map(weapon => savedById.get(weapon.id) ?? ({
      weaponId: weapon.id,
      attackEffect: weapon.type.includes("Staff") || weapon.type.includes("Tome") ? "explosion" : "slash",
      effectColor: weapon.type.includes("Fire") ? "#ff4500" : 
                   weapon.type.includes("Frost") ? "#00bfff" :
                   weapon.type.includes("Nature") ? "#32cd32" :
                   weapon.type.includes("Holy") ? "#ffd700" :
                   weapon.type.includes("Arcane") ? "#9370db" :
                   weapon.type.includes("Lightning") ? "#ffff00" :
                   "#ffffff",
      animationType: weapon.category === "Ranged 2h" ? "projectile" : 
                     weapon.type.includes("Staff") || weapon.type.includes("Tome") ? "spell" :
                     weapon.type === "Dagger" ? "thrust" :
                     weapon.type === "Sword" || weapon.type === "Axe" ? "slash" : "swing",
      attackRange: weapon.category === "Ranged 2h" ? 6 : 
                   weapon.type.includes("Staff") ? 4 : 
                   weapon.type.includes("Tome") ? 3 : 1,
      attackSpeed: weapon.stats.speedBase / 100,
      projectileSpeed: weapon.category === "Ranged 2h" ? 500 : 0,
      impactEffect: weapon.type.includes("Fire") ? "explosion" : 
                    weapon.type.includes("Frost") ? "frost" : "slash",
      soundEffect: weapon.type === "Bow" ? "arrow_release" : 
                   weapon.type === "Sword" ? "sword_swing" : "weapon_swing",
    }));
  });

  const [selectedRace, setSelectedRace] = useState<string>("human");
  const [selectedClass, setSelectedClass] = useState<string>("warrior");
  const [selectedWeapon, setSelectedWeapon] = useState<string>(ALL_WEAPONS[0]?.id || "");
  const [selectedWeaponType, setSelectedWeaponType] = useState<string>("All");

  const currentAssignment = useMemo(() => {
    return spriteAssignments.find(a => a.raceId === selectedRace && a.classId === selectedClass);
  }, [spriteAssignments, selectedRace, selectedClass]);

  const currentWeaponEffect = useMemo(() => {
    return weaponEffects.find(w => w.weaponId === selectedWeapon);
  }, [weaponEffects, selectedWeapon]);

  const currentWeapon = useMemo(() => {
    return ALL_WEAPONS.find(w => w.id === selectedWeapon);
  }, [selectedWeapon]);

  const filteredWeapons = useMemo(() => {
    if (selectedWeaponType === "All") return ALL_WEAPONS;
    return ALL_WEAPONS.filter(w => w.type === selectedWeaponType);
  }, [selectedWeaponType]);

  const markSpriteEdited = () =>
    setEditedSpriteKeys(prev => new Set(prev).add(`${selectedRace}:${selectedClass}`));

  const updateSpriteAssignment = (spriteId: string) => {
    markSpriteEdited();
    setSpriteAssignments(prev => prev.map(a => 
      a.raceId === selectedRace && a.classId === selectedClass
        ? { ...a, spriteId, spritePath: ALL_SPRITES.find(s => s.id === spriteId)?.path || a.spritePath }
        : a
    ));
  };

  const updateSpritePath = (path: string) => {
    markSpriteEdited();
    setSpriteAssignments(prev => prev.map(a => 
      a.raceId === selectedRace && a.classId === selectedClass
        ? { ...a, spritePath: path }
        : a
    ));
  };

  const updateWeaponEffect = (field: keyof WeaponEffectConfig, value: string | number) => {
    setEditedWeaponIds(prev => new Set(prev).add(selectedWeapon));
    setWeaponEffects(prev => prev.map(w => 
      w.weaponId === selectedWeapon
        ? { ...w, [field]: value }
        : w
    ));
  };

  const handleSave = () => {
    // Persist ONLY entries the user edited — never the full default matrix, whose
    // placeholder sprite paths would otherwise clobber valid live defaults.
    const editedAssignments = spriteAssignments.filter(a =>
      editedSpriteKeys.has(`${a.raceId}:${a.classId}`)
    );
    const editedWeapons = weaponEffects.filter(w => editedWeaponIds.has(w.weaponId));
    saveSpriteOverrides(editedAssignments);
    saveWeaponEffects(editedWeapons);
    toast({
      title: "Configuration saved",
      description: `${editedAssignments.length} sprite override(s) and ${editedWeapons.length} weapon effect(s) are now live in-game.`,
    });
  };

  const DEV_TOOLS = [
    { id: 'sprites', label: '2D Sprites', desc: 'Preview & animate sprite sheets', icon: Image, color: 'from-indigo-500/20 to-indigo-500/5', border: 'border-indigo-500/30', onClick: onViewSprites },
    { id: '3d', label: '3D Asset Browser', desc: 'Browse weapons, harvestables, buildings', icon: Layers, color: 'from-sky-500/20 to-sky-500/5', border: 'border-sky-500/30', onClick: onViewAssets },
    { id: 'race', label: 'Race Viewer', desc: 'All 6 Toon-RTS FBX race models', icon: Users, color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30', onClick: onViewRaceViewer },
    { id: 'island', label: 'Island Editor', desc: 'Terrain sculpting & object placement', icon: Mountain, color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/30', onClick: onViewIslandEditor },
    { id: 'registry', label: 'Asset Registry', desc: 'All tiered weapons & node templates', icon: Shield, color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/30', onClick: onViewAssetRegistry },
    { id: 'polygonjs', label: 'PolygonJS FX', desc: 'GPU particle & procedural effects', icon: Sparkles, color: 'from-rose-500/20 to-rose-500/5', border: 'border-rose-500/30', onClick: onViewPolygonJS },
    { id: 'pixy', label: 'Pixy.js FX', desc: 'Shader-based VFX lab', icon: Zap, color: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/30', onClick: onViewPixyFx },
    { id: 'video', label: 'Video Generator', desc: 'AI-powered video content pipeline', icon: Video, color: 'from-pink-500/20 to-pink-500/5', border: 'border-pink-500/30', onClick: onViewVideoGen },
    { id: 'builder', label: 'Builder Test', desc: 'Construction placement sandbox', icon: Hammer, color: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/30', onClick: onViewBuilderTest },
    { id: 'turret', label: 'Turret Demo', desc: 'Turret AI targeting & firing test', icon: Crosshair, color: 'from-red-500/20 to-red-500/5', border: 'border-red-500/30', onClick: onViewTurretDemo },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-4 p-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-admin-back">
            <Home className="w-5 h-5" />
          </Button>
          <h1 className="font-serif text-xl font-bold">Dev Tools & Lab</h1>
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">Admin</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} data-testid="button-save-config" variant="outline" size="sm">
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="mb-4">
            <TabsTrigger value="hub" data-testid="tab-hub">
              <FlaskConical className="w-4 h-4 mr-2" />
              Dev Tools Hub
            </TabsTrigger>
            <TabsTrigger value="sprites" data-testid="tab-sprites">
              <Users className="w-4 h-4 mr-2" />
              Character Sprites
            </TabsTrigger>
            <TabsTrigger value="weapons" data-testid="tab-weapons">
              <Sword className="w-4 h-4 mr-2" />
              Weapon Effects
            </TabsTrigger>
            <TabsTrigger value="effects" data-testid="tab-effects">
              <Sparkles className="w-4 h-4 mr-2" />
              Effects Preview
            </TabsTrigger>
            <TabsTrigger value="ship" data-testid="tab-ship">
              <ShipIcon className="w-4 h-4 mr-2" />
              Ship Tester
            </TabsTrigger>
            <TabsTrigger value="ocean" data-testid="tab-ocean">
              <Waves className="w-4 h-4 mr-2" />
              Ocean Tester
            </TabsTrigger>
            <TabsTrigger value="fishing" data-testid="tab-fishing">
              <Fish className="w-4 h-4 mr-2" />
              Fishing Tester
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hub" className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {DEV_TOOLS.filter(t => t.onClick).map(tool => (
                <button key={tool.id}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-gradient-to-br transition-all hover:scale-[1.03] hover:shadow-lg",
                    tool.color, tool.border
                  )}
                  onClick={tool.onClick}
                  data-testid={`devtool-${tool.id}`}>
                  <tool.icon className="w-7 h-7 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm font-semibold">{tool.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{tool.desc}</span>
                </button>
              ))}
              <button
                className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30 transition-all hover:scale-[1.03] hover:shadow-lg"
                onClick={() => window.open('/roygbiv/', '_blank')}
                data-testid="devtool-roygbiv">
                <Palette className="w-7 h-7 opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-sm font-semibold">ROYGBIV Editor</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">3D scene editor (new tab)</span>
              </button>
            </div>

            <Separator className="mb-4" />
            <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-amber-400">{ALL_WEAPONS.length}</div>
                  <div className="text-xs text-muted-foreground">Weapons Defined</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-emerald-400">{Object.keys(RACES).length}</div>
                  <div className="text-xs text-muted-foreground">Playable Races</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-sky-400">{Object.keys(CLASSES).length}</div>
                  <div className="text-xs text-muted-foreground">Unit Classes</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-purple-400">{EFFECT_TYPES.length}</div>
                  <div className="text-xs text-muted-foreground">Effect Types</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sprites" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-3">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Select Race & Class</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Faction</Label>
                        <div className="flex flex-wrap gap-2">
                          {Object.values(FACTIONS).map(faction => (
                            <Badge
                              key={faction.id}
                              variant={(faction.races as readonly string[]).includes(selectedRace) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => setSelectedRace(faction.races[0])}
                              data-testid={`badge-faction-${faction.id}`}
                            >
                              {faction.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Race</Label>
                        <Select value={selectedRace} onValueChange={setSelectedRace}>
                          <SelectTrigger data-testid="select-race">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(RACES).map(race => (
                              <SelectItem key={race.id} value={race.id}>
                                <span className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {race.faction}
                                  </Badge>
                                  {race.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Class</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger data-testid="select-class">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(CLASSES).map(cls => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="text-sm text-muted-foreground">
                        <p><strong>Selected:</strong></p>
                        <p>{RACES[selectedRace]?.name} {CLASSES[selectedClass]?.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-5">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sprite Assignment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Current Sprite</Label>
                        <Select 
                          value={currentAssignment?.spriteId || ""} 
                          onValueChange={updateSpriteAssignment}
                        >
                          <SelectTrigger data-testid="select-sprite">
                            <SelectValue placeholder="Select a sprite" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_SPRITES.map(sprite => (
                              <SelectItem key={sprite.id} value={sprite.id}>
                                {sprite.name} ({sprite.frameWidth}x{sprite.frameHeight})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Custom Sprite Path</Label>
                        <Input
                          value={currentAssignment?.spritePath || ""}
                          onChange={(e) => updateSpritePath(e.target.value)}
                          placeholder="/2dassets/characters/custom.png"
                          data-testid="input-sprite-path"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Animation Settings</Label>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(ANIMATION_STATES).map(([key, anim]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <span className="capitalize">{anim.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {anim.frameCount}f @ {anim.frameDuration}ms
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-4">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center gap-4">
                      <SpriteCanvas
                        spritePath={currentAssignment?.spritePath || ""}
                        spriteId={currentAssignment?.spriteId || "No Sprite"}
                        frameWidth={CHARACTER_SPRITES[currentAssignment?.spriteId || ""]?.frameWidth || 64}
                        frameHeight={CHARACTER_SPRITES[currentAssignment?.spriteId || ""]?.frameHeight || 64}
                        size={128}
                        animate={true}
                      />
                      <div className="text-center text-sm">
                        <p className="font-semibold">
                          {RACES[selectedRace]?.name} {CLASSES[selectedClass]?.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {currentAssignment?.spritePath}
                        </p>
                      </div>

                      <Separator />

                      <div className="w-full">
                        <p className="text-xs font-semibold mb-2">All Race/Class Assignments:</p>
                        <ScrollArea className="h-48">
                          <div className="space-y-1">
                            {spriteAssignments.map(a => (
                              <div
                                key={`${a.raceId}-${a.classId}`}
                                className={cn(
                                  "text-xs p-1.5 rounded flex justify-between",
                                  a.raceId === selectedRace && a.classId === selectedClass
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted"
                                )}
                              >
                                <span>{RACES[a.raceId]?.name} {CLASSES[a.classId]?.name}</span>
                                <span className="text-muted-foreground">{a.spriteId}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="weapons" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-3">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Select Weapon</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden flex flex-col">
                    <div className="space-y-2 mb-3">
                      <Label>Filter by Type</Label>
                      <Select value={selectedWeaponType} onValueChange={setSelectedWeaponType}>
                        <SelectTrigger data-testid="select-weapon-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Types</SelectItem>
                          {WEAPON_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="space-y-1">
                        {filteredWeapons.map(weapon => (
                          <Button
                            key={weapon.id}
                            variant={selectedWeapon === weapon.id ? "default" : "ghost"}
                            className="w-full justify-start text-left h-auto py-2"
                            onClick={() => setSelectedWeapon(weapon.id)}
                            data-testid={`button-weapon-${weapon.id}`}
                          >
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="text-sm">{weapon.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {weapon.type} ({weapon.category})
                              </span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-5">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sword className="w-4 h-4" />
                      {currentWeapon?.name || "Select a Weapon"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentWeaponEffect && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Wand2 className="w-3 h-3" />
                              Attack Effect
                            </Label>
                            <Select 
                              value={currentWeaponEffect.attackEffect} 
                              onValueChange={(v) => updateWeaponEffect("attackEffect", v)}
                            >
                              <SelectTrigger data-testid="select-attack-effect">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(EFFECT_CATEGORIES).map(([category, effects]) => (
                                  <div key={category}>
                                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{category}</div>
                                    {effects.map(effect => (
                                      <SelectItem key={effect} value={effect} className="pl-4 capitalize">
                                        {effect.replace(/_/g, ' ')}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Effect Color
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={currentWeaponEffect.effectColor}
                                onChange={(e) => updateWeaponEffect("effectColor", e.target.value)}
                                className="w-12 h-9 p-1"
                                data-testid="input-effect-color"
                              />
                              <Input
                                value={currentWeaponEffect.effectColor}
                                onChange={(e) => updateWeaponEffect("effectColor", e.target.value)}
                                className="flex-1"
                                data-testid="input-effect-color-hex"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Move className="w-3 h-3" />
                              Animation Type
                            </Label>
                            <Select 
                              value={currentWeaponEffect.animationType} 
                              onValueChange={(v) => updateWeaponEffect("animationType", v)}
                            >
                              <SelectTrigger data-testid="select-animation-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ANIMATION_TYPES.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Crosshair className="w-3 h-3" />
                              Attack Range
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              value={currentWeaponEffect.attackRange}
                              onChange={(e) => updateWeaponEffect("attackRange", parseInt(e.target.value) || 1)}
                              data-testid="input-attack-range"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Attack Speed
                            </Label>
                            <Input
                              type="number"
                              step={0.1}
                              min={0.1}
                              max={3}
                              value={currentWeaponEffect.attackSpeed}
                              onChange={(e) => updateWeaponEffect("attackSpeed", parseFloat(e.target.value) || 1)}
                              data-testid="input-attack-speed"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Move className="w-3 h-3" />
                              Projectile Speed
                            </Label>
                            <Input
                              type="number"
                              step={50}
                              min={0}
                              max={1000}
                              value={currentWeaponEffect.projectileSpeed}
                              onChange={(e) => updateWeaponEffect("projectileSpeed", parseInt(e.target.value) || 0)}
                              disabled={currentWeaponEffect.animationType !== "projectile"}
                              data-testid="input-projectile-speed"
                            />
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Impact Effect
                            </Label>
                            <Select 
                              value={currentWeaponEffect.impactEffect} 
                              onValueChange={(v) => updateWeaponEffect("impactEffect", v)}
                            >
                              <SelectTrigger data-testid="select-impact-effect">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EFFECT_TYPES.map(effect => (
                                  <SelectItem key={effect} value={effect}>{effect}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Sound Effect</Label>
                            <Input
                              value={currentWeaponEffect.soundEffect}
                              onChange={(e) => updateWeaponEffect("soundEffect", e.target.value)}
                              placeholder="sword_swing"
                              data-testid="input-sound-effect"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-4">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Weapon Stats & Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentWeapon && (
                      <div className="space-y-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{currentWeapon.name}</span>
                            <Badge variant="outline">{currentWeapon.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground italic mb-3">
                            {currentWeapon.lore}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span>Damage:</span>
                              <span>{currentWeapon.stats.damageBase} +{currentWeapon.stats.damagePerTier}/tier</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Speed:</span>
                              <span>{currentWeapon.stats.speedBase} +{currentWeapon.stats.speedPerTier}/tier</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Crit:</span>
                              <span>{currentWeapon.stats.critBase}% +{currentWeapon.stats.critPerTier}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Block:</span>
                              <span>{currentWeapon.stats.blockBase}% +{currentWeapon.stats.blockPerTier}%</span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-xs font-semibold mb-2">Effect Preview</p>
                          <div className="flex items-center gap-4">
                            <div 
                              className="w-16 h-16 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: currentWeaponEffect?.effectColor + "33" }}
                            >
                              <Wand2 
                                className="w-8 h-8" 
                                style={{ color: currentWeaponEffect?.effectColor }}
                              />
                            </div>
                            <div className="text-sm">
                              <p><strong>Effect:</strong> {currentWeaponEffect?.attackEffect}</p>
                              <p><strong>Animation:</strong> {currentWeaponEffect?.animationType}</p>
                              <p><strong>Range:</strong> {currentWeaponEffect?.attackRange} tiles</p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-xs font-semibold mb-2">Abilities</p>
                          <div className="flex flex-wrap gap-1">
                            {currentWeapon.abilities.slice(0, 4).map((ability, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {ability.split(" (")[0]}
                              </Badge>
                            ))}
                            {currentWeapon.abilities.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{currentWeapon.abilities.length - 4} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="effects" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-3">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Effect Categories</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="space-y-4">
                        {Object.entries(EFFECT_CATEGORIES).map(([category, effects]) => (
                          <div key={category}>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">{category}</h4>
                            <div className="grid grid-cols-2 gap-1">
                              {effects.map(effect => (
                                <Badge 
                                  key={effect} 
                                  variant="outline" 
                                  className="cursor-pointer text-xs justify-start capitalize hover-elevate"
                                  data-testid={`badge-effect-${effect}`}
                                >
                                  {effect.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-6">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Effects Library
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Fire Spells</p>
                              <p className="text-xs text-muted-foreground">6 effects</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">Cast</Badge>
                            <Badge variant="secondary" className="text-xs">Impact</Badge>
                            <Badge variant="secondary" className="text-xs">AOE</Badge>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Ice Spells</p>
                              <p className="text-xs text-muted-foreground">5 effects</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">Cast</Badge>
                            <Badge variant="secondary" className="text-xs">Impact</Badge>
                            <Badge variant="secondary" className="text-xs">Shatter</Badge>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                              <Zap className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Lightning</p>
                              <p className="text-xs text-muted-foreground">4 effects</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">Cast</Badge>
                            <Badge variant="secondary" className="text-xs">Strike</Badge>
                            <Badge variant="secondary" className="text-xs">Chain</Badge>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                              <Wand2 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Arcane</p>
                              <p className="text-xs text-muted-foreground">5 effects</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">Cast</Badge>
                            <Badge variant="secondary" className="text-xs">Burst</Badge>
                            <Badge variant="secondary" className="text-xs">Portal</Badge>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
                              <Move className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Movement</p>
                              <p className="text-xs text-muted-foreground">4 effects</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">Phase</Badge>
                            <Badge variant="secondary" className="text-xs">Flash</Badge>
                            <Badge variant="secondary" className="text-xs">Teleport</Badge>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-gradient-to-br from-gray-500/20 to-slate-500/20 border border-gray-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                              <Shield className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Combat</p>
                              <p className="text-xs text-muted-foreground">8 effects</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">Hit</Badge>
                            <Badge variant="secondary" className="text-xs">Slash</Badge>
                            <Badge variant="secondary" className="text-xs">Blood</Badge>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-semibold mb-3">Quick Effect Preview</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {["phase", "flash_step", "teleport", "dash_trail"].map(effect => (
                            <div 
                              key={effect}
                              className="p-2 rounded-lg border bg-card text-center cursor-pointer hover-elevate"
                            >
                              <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mb-1">
                                <Sparkles className="w-5 h-5 text-white" />
                              </div>
                              <p className="text-xs capitalize">{effect.replace(/_/g, ' ')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-3">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Effect Parameters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <h4 className="text-xs font-semibold mb-2">Particle Settings</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Count:</span>
                            <span>40 particles</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span>0.08</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration:</span>
                            <span>0.8s</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Spread:</span>
                            <span>1.2</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <h4 className="text-xs font-semibold mb-2">Color Settings</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-cyan-400" />
                            <span className="text-xs">Primary: #00BFFF</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-cyan-100" />
                            <span className="text-xs">Secondary: #E0FFFF</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <h4 className="text-xs font-semibold mb-2">Physics</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gravity:</span>
                            <span>0</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Velocity Y:</span>
                            <span>0.5</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Shape:</span>
                            <span>Box</span>
                          </div>
                        </div>
                      </div>

                      <Button className="w-full" variant="outline" data-testid="button-test-effect">
                        <Eye className="w-4 h-4 mr-2" />
                        Test in 3D Scene
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── Ship / Ocean / Fishing test tabs ────────────────────────── */}
          <TabsContent value="ship" className="flex-1 overflow-hidden">
            <ShipTester onLaunchSailing={() => onBack && onBack()} />
          </TabsContent>
          <TabsContent value="ocean" className="flex-1 overflow-hidden">
            <OceanTester onLaunchSailing={() => onBack && onBack()} />
          </TabsContent>
          <TabsContent value="fishing" className="flex-1 overflow-hidden">
            <FishingTester onLaunchSailing={() => onBack && onBack()} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
