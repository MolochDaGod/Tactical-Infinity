import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ThreeSceneManager } from "@/lib/threeSceneManager";
import { fbxLoader, type LoadedModel, raceToFolder } from "@/lib/fbxModelLoader";
import { raceColors } from "@/lib/gameData";
import { factionRaces, type Race, type Faction, type UnitClass, unitClasses } from "@shared/schema";
import { Sword, Wand2, Target, Dog, ChevronLeft, ChevronRight, RotateCcw, Play, Pause, Loader2 } from "lucide-react";

const classIcons: Record<UnitClass, typeof Sword> = {
  warrior: Sword,
  ranger: Target,
  mage: Wand2,
  worge: Dog,
};

const factionNames: Record<Faction, string> = {
  crusade: "The Crusade",
  fabled: "The Fabled",
  legion: "The Legion",
};

const raceNames: Record<Race, string> = {
  human: "Human",
  barbarian: "Barbarian",
  dwarf: "Dwarf",
  elf: "Elf",
  orc: "Orc",
  undead: "Undead",
};

export default function Barracks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);
  const loadedModelRef = useRef<LoadedModel | null>(null);
  const rotationRef = useRef<number>(0);
  
  const [selectedFaction, setSelectedFaction] = useState<Faction>("crusade");
  const [selectedRace, setSelectedRace] = useState<Race>("human");
  const [selectedClass, setSelectedClass] = useState<UnitClass>("warrior");
  const [isAnimating, setIsAnimating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string>("idle");

  useEffect(() => {
    const availableRacesForFaction = factionRaces[selectedFaction];
    if (!availableRacesForFaction.includes(selectedRace)) {
      setSelectedRace(availableRacesForFaction[0]);
    }
  }, [selectedFaction, selectedRace]);

  useEffect(() => {
    if (!containerRef.current) return;

    const sceneManager = new ThreeSceneManager();
    sceneManager.mount(containerRef.current);
    sceneManager.setBackgroundColor(0x1a1a2e);
    sceneManager.setCameraPosition(0, 1.5, 3);
    sceneManager.setCameraTarget(0, 0.8, 0);
    sceneManagerRef.current = sceneManager;

    const gridHelper = new THREE.GridHelper(4, 4, 0x444444, 0x222222);
    sceneManager.addObject(gridHelper);

    return () => {
      if (loadedModelRef.current) {
        fbxLoader.disposeInstance(loadedModelRef.current);
      }
      sceneManager.dispose();
    };
  }, []);

  const loadModel = useCallback(async () => {
    if (!sceneManagerRef.current) return;

    setIsLoading(true);
    setLoadProgress(0);
    setLoadError(null);

    if (loadedModelRef.current) {
      sceneManagerRef.current.removeObject(loadedModelRef.current.model);
      sceneManagerRef.current.removeMixer(loadedModelRef.current.mixer);
      fbxLoader.disposeInstance(loadedModelRef.current);
      loadedModelRef.current = null;
    }

    try {
      const loadedModel = await fbxLoader.loadCharacterModel(
        selectedRace,
        selectedClass,
        (progress) => setLoadProgress(progress.percent)
      );

      loadedModel.model.position.set(0, 0, 0);
      loadedModel.model.rotation.y = rotationRef.current;

      sceneManagerRef.current.addObject(loadedModel.model);
      sceneManagerRef.current.addMixer(loadedModel.mixer);
      loadedModelRef.current = loadedModel;

      if (loadedModel.animations.size > 0) {
        const firstAnim = loadedModel.animations.keys().next().value;
        if (firstAnim) {
          fbxLoader.playAnimation(loadedModel, firstAnim, { loop: true });
          setCurrentAnimation(firstAnim);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load model:", error);
      setLoadError("Failed to load 3D model. Using placeholder.");
      setIsLoading(false);

      const colorInfo = raceColors[selectedRace];
      const group = new THREE.Group();
      
      const bodyGeometry = new THREE.CapsuleGeometry(0.15, 0.4, 4, 8);
      const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color().setHSL(
          parseInt(colorInfo.primary.match(/\d+/)?.[0] || "200") / 360,
          0.7,
          0.5
        ),
        roughness: 0.5,
        metalness: 0.3,
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 0.5;
      body.castShadow = true;
      group.add(body);
      
      const headGeometry = new THREE.SphereGeometry(0.12, 16, 16);
      const headMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffdbac,
        roughness: 0.6,
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 0.85;
      head.castShadow = true;
      group.add(head);

      group.rotation.y = rotationRef.current;
      sceneManagerRef.current.addObject(group);
      
      loadedModelRef.current = {
        model: group,
        mixer: new THREE.AnimationMixer(group),
        animations: new Map(),
        currentAction: null,
      };
    }
  }, [selectedRace, selectedClass]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  useEffect(() => {
    if (!loadedModelRef.current || !isAnimating) return;

    let animationId: number;
    const animate = () => {
      if (loadedModelRef.current) {
        loadedModelRef.current.model.rotation.y += 0.01;
        rotationRef.current = loadedModelRef.current.model.rotation.y;
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isAnimating]);

  const resetRotation = () => {
    if (loadedModelRef.current) {
      loadedModelRef.current.model.rotation.y = 0;
      rotationRef.current = 0;
    }
  };

  const rotateLeft = () => {
    if (loadedModelRef.current) {
      loadedModelRef.current.model.rotation.y -= Math.PI / 4;
      rotationRef.current = loadedModelRef.current.model.rotation.y;
    }
  };

  const rotateRight = () => {
    if (loadedModelRef.current) {
      loadedModelRef.current.model.rotation.y += Math.PI / 4;
      rotationRef.current = loadedModelRef.current.model.rotation.y;
    }
  };

  const playSelectedAnimation = (animName: string) => {
    if (loadedModelRef.current && loadedModelRef.current.animations.has(animName)) {
      fbxLoader.crossFadeToAnimation(loadedModelRef.current, animName, 0.3);
      setCurrentAnimation(animName);
    }
  };

  const raceInfo = raceToFolder[selectedRace];
  const availableAnimations = loadedModelRef.current 
    ? Array.from(loadedModelRef.current.animations.keys())
    : [];

  return (
    <div className="flex flex-col h-full gap-4 p-4" data-testid="page-barracks">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-cinzel font-bold">Barracks</h1>
        <Badge variant="outline" className="text-sm">
          3D Unit Viewer
        </Badge>
        {isLoading && (
          <Badge variant="secondary" className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading {Math.round(loadProgress)}%
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg">Unit Preview</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={rotateLeft}
                data-testid="button-rotate-left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsAnimating(!isAnimating)}
                data-testid="button-toggle-animation"
              >
                {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={rotateRight}
                data-testid="button-rotate-right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={resetRotation}
                data-testid="button-reset-rotation"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-md">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <Progress value={loadProgress} className="w-32" />
                  <p className="text-sm text-muted-foreground">Loading model...</p>
                </div>
              </div>
            )}
            {loadError && (
              <div className="absolute top-2 left-2 right-2 z-10">
                <Badge variant="destructive" className="text-xs">
                  {loadError}
                </Badge>
              </div>
            )}
            <div 
              ref={containerRef} 
              className="w-full h-full min-h-[400px] rounded-md overflow-hidden"
              data-testid="canvas-3d-viewer"
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Unit Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Faction</label>
                <Select
                  value={selectedFaction}
                  onValueChange={(v) => setSelectedFaction(v as Faction)}
                >
                  <SelectTrigger data-testid="select-faction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crusade">{factionNames.crusade}</SelectItem>
                    <SelectItem value="fabled">{factionNames.fabled}</SelectItem>
                    <SelectItem value="legion">{factionNames.legion}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Race</label>
                <Select
                  value={selectedRace}
                  onValueChange={(v) => setSelectedRace(v as Race)}
                >
                  <SelectTrigger data-testid="select-race">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {factionRaces[selectedFaction].map((race) => (
                      <SelectItem key={race} value={race}>
                        {raceNames[race]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Class</label>
                <div className="grid grid-cols-3 gap-2">
                  {unitClasses.map((cls) => {
                    const Icon = classIcons[cls];
                    return (
                      <Button
                        key={cls}
                        variant={selectedClass === cls ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedClass(cls)}
                        className="flex flex-col gap-1 h-auto py-2"
                        data-testid={`button-class-${cls}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs capitalize">{cls}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Model Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset Pack:</span>
                <span>Toon RTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Race Folder:</span>
                <span>{raceInfo.folder}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prefix:</span>
                <Badge variant="secondary">{raceInfo.prefix}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model Type:</span>
                <span>Character</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animations:</span>
                <span>{availableAnimations.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Animations</CardTitle>
            </CardHeader>
            <CardContent>
              {availableAnimations.length > 0 ? (
                <div className="space-y-2">
                  {availableAnimations.slice(0, 6).map((animName) => (
                    <Button
                      key={animName}
                      variant={currentAnimation === animName ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => playSelectedAnimation(animName)}
                      data-testid={`button-anim-${animName}`}
                    >
                      {animName}
                    </Button>
                  ))}
                </div>
              ) : (
                <Tabs defaultValue="idle" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="idle" data-testid="tab-anim-idle">Idle</TabsTrigger>
                    <TabsTrigger value="run" data-testid="tab-anim-run">Run</TabsTrigger>
                    <TabsTrigger value="attack" data-testid="tab-anim-attack">Attack</TabsTrigger>
                    <TabsTrigger value="death" data-testid="tab-anim-death">Death</TabsTrigger>
                  </TabsList>
                  <TabsContent value="idle" className="text-sm text-muted-foreground mt-2">
                    {raceInfo.prefix}_worker_01_idle
                  </TabsContent>
                  <TabsContent value="run" className="text-sm text-muted-foreground mt-2">
                    {raceInfo.prefix}_worker_03_run
                  </TabsContent>
                  <TabsContent value="attack" className="text-sm text-muted-foreground mt-2">
                    {raceInfo.prefix}_worker_07_attack
                  </TabsContent>
                  <TabsContent value="death" className="text-sm text-muted-foreground mt-2">
                    {raceInfo.prefix}_worker_10_death
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
