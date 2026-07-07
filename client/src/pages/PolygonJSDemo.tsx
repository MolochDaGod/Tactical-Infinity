import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles, Layers, Droplets, Wind, Flame, Sword, Heart, Zap, TreeDeciduous, Mountain } from "lucide-react";
import { Link } from "wouter";
import { 
  PolygonJSEffectsManager, 
  type EffectType,
  createHarvestEffect,
  createCombatEffect,
  createEnvironmentEffect,
  createSkillEffect
} from "@/lib/polygonJSEffects";

type EffectCategory = 'harvest' | 'combat' | 'environment' | 'skill';

interface EffectOption {
  type: EffectType;
  label: string;
  category: EffectCategory;
}

const EFFECT_OPTIONS: EffectOption[] = [
  { type: 'harvest_wood', label: 'Wood Chips', category: 'harvest' },
  { type: 'harvest_stone', label: 'Stone Fragments', category: 'harvest' },
  { type: 'harvest_ore', label: 'Ore Sparks', category: 'harvest' },
  { type: 'harvest_plant', label: 'Plant Leaves', category: 'harvest' },
  { type: 'combat_hit', label: 'Hit Impact', category: 'combat' },
  { type: 'combat_blood', label: 'Blood Splatter', category: 'combat' },
  { type: 'combat_magic', label: 'Magic Burst', category: 'combat' },
  { type: 'environment_fire', label: 'Fire', category: 'environment' },
  { type: 'environment_smoke', label: 'Smoke', category: 'environment' },
  { type: 'environment_dust', label: 'Dust Cloud', category: 'environment' },
  { type: 'environment_sparkle', label: 'Sparkles', category: 'environment' },
  { type: 'environment_water_splash', label: 'Water Splash', category: 'environment' },
  { type: 'skill_heal', label: 'Heal', category: 'skill' },
  { type: 'skill_buff', label: 'Buff', category: 'skill' },
  { type: 'skill_debuff', label: 'Debuff', category: 'skill' },
  { type: 'levelup', label: 'Level Up', category: 'skill' },
  { type: 'loot_drop', label: 'Loot Drop', category: 'skill' },
];

export default function PolygonJSDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const effectsManagerRef = useRef<PolygonJSEffectsManager | null>(null);
  const animationIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  const [currentCategory, setCurrentCategory] = useState<EffectCategory>('harvest');
  const [selectedEffect, setSelectedEffect] = useState<EffectType>('harvest_wood');
  const [particleScale, setParticleScale] = useState(1.0);
  const [effectDuration, setEffectDuration] = useState(1.5);
  const [activeEffects, setActiveEffects] = useState(0);
  const [autoSpawn, setAutoSpawn] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.update();
    controlsRef.current = controls;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d4a3e,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    
    const targetGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const targetMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      emissive: 0x331111,
      roughness: 0.3,
    });
    const targetSphere = new THREE.Mesh(targetGeometry, targetMaterial);
    targetSphere.position.set(0, 1, 0);
    targetSphere.castShadow = true;
    targetSphere.name = 'EffectTarget';
    scene.add(targetSphere);
    
    const effectsManager = new PolygonJSEffectsManager(scene);
    effectsManagerRef.current = effectsManager;
    
    lastTimeRef.current = performance.now();
    
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      controls.update();
      
      if (effectsManager) {
        effectsManager.update(deltaTime);
        setActiveEffects(effectsManager.getActiveEffectCount());
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);
      
      if (effectsManager) {
        effectsManager.dispose();
      }
      
      if (controls) {
        controls.dispose();
      }
      
      if (renderer) {
        renderer.forceContextLoss();
        renderer.dispose();
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoSpawn || !effectsManagerRef.current) return;
    
    const interval = setInterval(() => {
      spawnEffect();
    }, 500);
    
    return () => clearInterval(interval);
  }, [autoSpawn, selectedEffect, particleScale, effectDuration]);

  const spawnEffect = useCallback(() => {
    if (!effectsManagerRef.current) return;
    
    const randomOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 2
    );
    
    const position = new THREE.Vector3(0, 1, 0).add(randomOffset);
    
    effectsManagerRef.current.spawnEffect(selectedEffect, position, {
      particleSize: 0.1 * particleScale,
      duration: effectDuration,
    });
  }, [selectedEffect, particleScale, effectDuration]);

  const spawnMultipleEffects = useCallback(() => {
    if (!effectsManagerRef.current) return;
    
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const radius = 1.5;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        1,
        Math.sin(angle) * radius
      );
      
      setTimeout(() => {
        effectsManagerRef.current?.spawnEffect(selectedEffect, position, {
          particleSize: 0.1 * particleScale,
          duration: effectDuration,
        });
      }, i * 100);
    }
  }, [selectedEffect, particleScale, effectDuration]);

  const clearAllEffects = useCallback(() => {
    if (effectsManagerRef.current) {
      effectsManagerRef.current.removeAllEffects();
    }
  }, []);

  const filteredEffects = EFFECT_OPTIONS.filter(e => e.category === currentCategory);

  const getCategoryIcon = (category: EffectCategory) => {
    switch (category) {
      case 'harvest': return <TreeDeciduous className="h-4 w-4" />;
      case 'combat': return <Sword className="h-4 w-4" />;
      case 'environment': return <Wind className="h-4 w-4" />;
      case 'skill': return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">PolygonJS Effects System</h1>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Active Effects: {activeEffects}
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  3D Viewport
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={containerRef}
                  className="w-full h-[500px] bg-card rounded-lg border overflow-hidden"
                  data-testid="viewport-container"
                />
                <div className="flex gap-2 mt-4 flex-wrap">
                  <Button 
                    onClick={spawnEffect}
                    data-testid="button-spawn-effect"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Spawn Effect
                  </Button>
                  <Button 
                    onClick={spawnMultipleEffects}
                    variant="secondary"
                    data-testid="button-spawn-multiple"
                  >
                    Spawn Ring (5x)
                  </Button>
                  <Button 
                    onClick={() => setAutoSpawn(!autoSpawn)}
                    variant={autoSpawn ? "destructive" : "outline"}
                    data-testid="button-auto-spawn"
                  >
                    {autoSpawn ? "Stop Auto" : "Auto Spawn"}
                  </Button>
                  <Button 
                    onClick={clearAllEffects}
                    variant="ghost"
                    data-testid="button-clear-effects"
                  >
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Effect Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={currentCategory} onValueChange={(v) => setCurrentCategory(v as EffectCategory)}>
                  <TabsList className="grid grid-cols-4 gap-1">
                    <TabsTrigger value="harvest" className="flex flex-col items-center gap-1 py-2">
                      <TreeDeciduous className="h-4 w-4" />
                      <span className="text-xs">Harvest</span>
                    </TabsTrigger>
                    <TabsTrigger value="combat" className="flex flex-col items-center gap-1 py-2">
                      <Sword className="h-4 w-4" />
                      <span className="text-xs">Combat</span>
                    </TabsTrigger>
                    <TabsTrigger value="environment" className="flex flex-col items-center gap-1 py-2">
                      <Wind className="h-4 w-4" />
                      <span className="text-xs">Environ</span>
                    </TabsTrigger>
                    <TabsTrigger value="skill" className="flex flex-col items-center gap-1 py-2">
                      <Zap className="h-4 w-4" />
                      <span className="text-xs">Skills</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Select Effect</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {filteredEffects.map((effect) => (
                    <Button
                      key={effect.type}
                      variant={selectedEffect === effect.type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedEffect(effect.type)}
                      className="justify-start text-xs"
                      data-testid={`button-effect-${effect.type}`}
                    >
                      {effect.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Effect Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Particle Scale: {particleScale.toFixed(1)}x</Label>
                  <Slider
                    value={[particleScale]}
                    onValueChange={([v]) => setParticleScale(v)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    data-testid="slider-particle-scale"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration: {effectDuration.toFixed(1)}s</Label>
                  <Slider
                    value={[effectDuration]}
                    onValueChange={([v]) => setEffectDuration(v)}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    data-testid="slider-duration"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Integration Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-2 text-muted-foreground font-mono">
                  <div className="bg-muted p-2 rounded">
                    <code>{`import { PolygonJSEffectsManager } from '@/lib/polygonJSEffects';`}</code>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <code>{`const effects = new PolygonJSEffectsManager(scene);`}</code>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <code>{`effects.spawnEffect('harvest_wood', position);`}</code>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <code>{`// In animation loop:`}</code><br/>
                    <code>{`effects.update(deltaTime);`}</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
