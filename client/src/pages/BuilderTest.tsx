import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { BuildingSystemUI } from "@/components/game/BuildingSystemUI";
import { IslandBuildingSystem, type BuildingMode, type PlayerResources } from "@/lib/islandBuildingSystem";
import { TerrainEditingSystem, type TerrainToolType, type TerrainBrush, createEditableTerrain, applyNoiseToTerrain } from "@/lib/terrainEditingSystem";
import { PolygonJSEffectsManager } from "@/lib/polygonJSEffects";

type EditorMode = 'building' | 'terrain' | 'none';

export default function BuilderTest() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const buildingSystemRef = useRef<IslandBuildingSystem | null>(null);
  const terrainSystemRef = useRef<TerrainEditingSystem | null>(null);
  const effectsManagerRef = useRef<PolygonJSEffectsManager | null>(null);
  const animationIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [editorMode, setEditorMode] = useState<EditorMode>('none');
  const [buildingMode, setBuildingMode] = useState<BuildingMode>('build');
  const [currentBuilding, setCurrentBuilding] = useState<string | null>('foundation_wood');
  const [currentRotation, setCurrentRotation] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [playerResources, setPlayerResources] = useState<PlayerResources>({
    wood: 500,
    stone: 300,
    ore: 100,
    gold: 200,
    leather: 50,
    fiber: 100,
  });
  const [terrainTool, setTerrainTool] = useState<TerrainToolType>('raise');
  const [terrainBrush, setTerrainBrush] = useState<TerrainBrush>({
    radius: 5,
    strength: 0.3,
    falloff: 'smooth',
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(30, 30, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(50, 80, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3d5c3d, 0.3);
    scene.add(hemisphereLight);

    const terrain = createEditableTerrain(100, 100, 64, 64);
    applyNoiseToTerrain(terrain, 0.03, 3);
    terrain.position.y = 0;
    scene.add(terrain);

    const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x333333);
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);

    const waterGeometry = new THREE.PlaneGeometry(200, 200);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a5f7a,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.3,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2;
    scene.add(water);

    const buildingSystem = new IslandBuildingSystem(scene, camera, {
      gridSize: 2.0,
      gridExtent: 50,
      groundLevel: 0,
    });
    buildingSystem.setPlayerResources(playerResources);
    buildingSystemRef.current = buildingSystem;

    const terrainSystem = new TerrainEditingSystem(scene, camera, {
      brushRadius: 5,
      brushStrength: 0.3,
      minHeight: -5,
      maxHeight: 20,
    });
    terrainSystem.setTerrain(terrain);
    terrainSystem.setCallbacks({
      onTerrainModified: (pos) => {
        setCanUndo(terrainSystem.canUndo());
        setCanRedo(terrainSystem.canRedo());
      },
      onToolChange: (tool) => setTerrainTool(tool),
      onBrushChange: (brush) => setTerrainBrush(brush),
    });
    terrainSystemRef.current = terrainSystem;

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

      if (buildingSystem) {
        buildingSystem.dispose?.();
      }

      if (terrainSystem) {
        terrainSystem.dispose();
      }

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

  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);

    if (terrainSystemRef.current) {
      if (mode === 'terrain') {
        terrainSystemRef.current.enableEditing();
        if (controlsRef.current) {
          controlsRef.current.enableRotate = true;
          controlsRef.current.enablePan = true;
        }
      } else {
        terrainSystemRef.current.disableEditing();
      }
    }

    if (buildingSystemRef.current) {
      if (mode === 'building') {
        buildingSystemRef.current.enterBuildingMode();
      } else {
        buildingSystemRef.current.exitBuildingMode();
      }
    }
  }, []);

  const handleBuildingModeChange = useCallback((mode: BuildingMode) => {
    setBuildingMode(mode);
    if (buildingSystemRef.current) {
      if (mode === 'delete' && buildingSystemRef.current.getBuildingMode() === 'build') {
        buildingSystemRef.current.toggleBuildDeleteMode();
      } else if (mode === 'build' && buildingSystemRef.current.getBuildingMode() === 'delete') {
        buildingSystemRef.current.toggleBuildDeleteMode();
      }
    }
  }, []);

  const handleBuildingSelect = useCallback((buildingId: string) => {
    setCurrentBuilding(buildingId);
    if (buildingSystemRef.current) {
      buildingSystemRef.current.setSelectedBuildingType(buildingId as any);
    }
  }, []);

  const handleRotate = useCallback(() => {
    setCurrentRotation((prev) => (prev + 90) % 360);
    if (buildingSystemRef.current) {
      buildingSystemRef.current.rotatePreview?.();
    }
  }, []);

  const handleLevelChange = useCallback((level: number) => {
    if (buildingSystemRef.current) {
      const currentBuildLevel = buildingSystemRef.current.getCurrentLevel();
      const delta = level - currentBuildLevel;
      if (delta !== 0) {
        buildingSystemRef.current.changeLevel(delta);
        setCurrentLevel(level);
      }
    } else {
      setCurrentLevel(level);
    }
  }, []);

  const handleTerrainToolChange = useCallback((tool: TerrainToolType) => {
    setTerrainTool(tool);
    if (terrainSystemRef.current) {
      terrainSystemRef.current.setTool(tool);
    }
  }, []);

  const handleBrushRadiusChange = useCallback((radius: number) => {
    setTerrainBrush((prev) => ({ ...prev, radius }));
    if (terrainSystemRef.current) {
      terrainSystemRef.current.setBrushRadius(radius);
    }
  }, []);

  const handleBrushStrengthChange = useCallback((strength: number) => {
    setTerrainBrush((prev) => ({ ...prev, strength }));
    if (terrainSystemRef.current) {
      terrainSystemRef.current.setBrushStrength(strength);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (terrainSystemRef.current) {
      terrainSystemRef.current.undo();
      setCanUndo(terrainSystemRef.current.canUndo());
      setCanRedo(terrainSystemRef.current.canRedo());
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (terrainSystemRef.current) {
      terrainSystemRef.current.redo();
      setCanUndo(terrainSystemRef.current.canUndo());
      setCanRedo(terrainSystemRef.current.canRedo());
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b bg-background/95 backdrop-blur flex items-center px-4 gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-foreground">Builder Test - Terrain & Buildings</h1>
        <div className="ml-auto text-sm text-muted-foreground">
          {editorMode === 'terrain' && 'Terrain Editing Mode - Click and drag to modify'}
          {editorMode === 'building' && 'Building Mode - Select and place structures'}
          {editorMode === 'none' && 'Select a mode to begin editing'}
        </div>
      </header>

      <main className="pt-14 h-screen">
        <div
          ref={containerRef}
          className="w-full h-full"
          data-testid="builder-viewport"
        />
      </main>

      <BuildingSystemUI
        mode={editorMode}
        buildingMode={buildingMode}
        currentBuilding={currentBuilding}
        currentRotation={currentRotation}
        currentLevel={currentLevel}
        playerResources={playerResources}
        terrainTool={terrainTool}
        terrainBrush={terrainBrush}
        canUndo={canUndo}
        canRedo={canRedo}
        onModeChange={handleModeChange}
        onBuildingModeChange={handleBuildingModeChange}
        onBuildingSelect={handleBuildingSelect}
        onRotate={handleRotate}
        onLevelChange={handleLevelChange}
        onTerrainToolChange={handleTerrainToolChange}
        onBrushRadiusChange={handleBrushRadiusChange}
        onBrushStrengthChange={handleBrushStrengthChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}
