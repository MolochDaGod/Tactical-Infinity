import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThreeSceneManager } from "@/lib/threeSceneManager";
import { fbxLoader } from "@/lib/fbxModelLoader";
import { 
  buildingDefinitions, 
  buildingColors, 
  getBuildingModelPath,
  getBuildingCost,
  type BuildingType,
  type BuildingInstance,
  type BuildingAge,
  houseVariants,
} from "@/lib/buildingManifest";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { 
  HarvestableNode, 
  Harvester, 
  HarvesterAssignment, 
  HarvestResult,
  ProfessionLevels 
} from "@shared/schema";
import { TIER_MULTIPLIERS, nodeTypeToProfession } from "@shared/schema";
import { useRTSControls, InputMode } from "@/hooks/useRTSControls";
import { RTSContextMenu } from "@/components/game/RTSContextMenu";
import { DragBoxOverlay } from "@/components/game/DragBoxOverlay";
import { 
  Home, 
  Hammer, 
  Castle, 
  Store, 
  Ship, 
  Warehouse, 
  Shield,
  Plus,
  RotateCcw,
  Trash2,
  Coins,
  TreePine,
  Mountain,
  ChevronLeft,
  Pickaxe,
  Leaf,
  Fish,
  Gem,
  Timer,
  UserPlus,
  X,
  Sparkles,
  Package,
  MousePointer,
  Move,
  Hand,
} from "lucide-react";

const buildingIcons: Record<BuildingType, typeof Home> = {
  house: Home,
  barracks: Castle,
  archery: Shield,
  market: Store,
  port: Ship,
  storage: Warehouse,
  wall_tower: Shield,
};

interface PlayerResources {
  gold: number;
  wood: number;
  stone: number;
}

const NODE_ICONS: Record<string, typeof Pickaxe> = {
  ore: Pickaxe,
  rare_ore: Gem,
  crystal: Gem,
  herb: Leaf,
  wood: TreePine,
  ancient_tree: TreePine,
  fish: Fish,
  ley_line: Sparkles,
};

const TIER_COLORS: Record<number, string> = {
  1: "text-gray-400",
  2: "text-green-400",
  3: "text-blue-400",
  4: "text-purple-400",
  5: "text-orange-400",
};

const HARVEST_INTERVAL_MS = 12000;

export default function Islands() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);
  const buildingsRef = useRef<Map<string, THREE.Group>>(new Map());
  
  const [placedBuildings, setPlacedBuildings] = useState<BuildingInstance[]>([]);
  const [selectedBuildingType, setSelectedBuildingType] = useState<BuildingType | null>(null);
  const [selectedPlacedBuilding, setSelectedPlacedBuilding] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [resources, setResources] = useState<PlayerResources>({
    gold: 1000,
    wood: 500,
    stone: 300,
  });
  const [loadingBuildings, setLoadingBuildings] = useState<Set<string>>(new Set());
  
  const [mainTab, setMainTab] = useState<"build" | "orders">("build");
  const [selectedNodeForAssign, setSelectedNodeForAssign] = useState<string | null>(null);
  const [harvestCountdown, setHarvestCountdown] = useState(HARVEST_INTERVAL_MS / 1000);
  const [recentHarvests, setRecentHarvests] = useState<HarvestResult[]>([]);
  
  const [threeCamera, setThreeCamera] = useState<THREE.Camera | null>(null);
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);
  
  const rtsControls = useRTSControls({
    camera: threeCamera,
    scene: threeScene,
    container: containerRef.current,
    enabled: mainTab === "build",
  });
  
  const { data: nodes = [] } = useQuery<HarvestableNode[]>({
    queryKey: ["/api/nodes"],
  });
  
  const { data: harvesters = [] } = useQuery<Harvester[]>({
    queryKey: ["/api/harvesters"],
  });
  
  const { data: assignments = [] } = useQuery<HarvesterAssignment[]>({
    queryKey: ["/api/assignments"],
  });
  
  const { data: professions } = useQuery<ProfessionLevels>({
    queryKey: ["/api/professions"],
  });
  
  const { data: harvestedResources = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/resources"],
  });
  
  const assignHarvester = useMutation({
    mutationFn: async ({ harvesterId, nodeId }: { harvesterId: string; nodeId: string }) => {
      const response = await apiRequest("POST", "/api/assignments", { harvesterId, nodeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/harvesters"] });
      setSelectedNodeForAssign(null);
    },
  });
  
  const unassignHarvester = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await apiRequest("DELETE", `/api/assignments/${assignmentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/harvesters"] });
    },
  });
  
  const performHarvest = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/harvest");
      return response.json();
    },
    onSuccess: (data: { harvests: HarvestResult[]; resources: Record<string, number>; professions: ProfessionLevels }) => {
      if (data.harvests && data.harvests.length > 0) {
        setRecentHarvests(prev => [...data.harvests, ...prev].slice(0, 20));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    },
  });
  
  useEffect(() => {
    if (mainTab !== "orders") return;
    
    const interval = setInterval(() => {
      setHarvestCountdown(prev => {
        if (prev <= 1) {
          performHarvest.mutate();
          return HARVEST_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [mainTab]);
  
  const availableHarvesters = harvesters.filter(h => !h.isAssigned);
  const assignedNodes = new Set(assignments.map(a => a.nodeId));

  useEffect(() => {
    if (!containerRef.current) return;

    const sceneManager = new ThreeSceneManager();
    sceneManager.mount(containerRef.current);
    sceneManager.setBackgroundColor(0x87CEEB);
    sceneManager.setCameraPosition(15, 20, 15);
    sceneManager.setCameraTarget(0, 0, 0);
    sceneManagerRef.current = sceneManager;
    
    setThreeCamera(sceneManager.getCamera());
    setThreeScene(sceneManager.getScene());

    const gridHelper = new THREE.GridHelper(20, 10, 0x444444, 0x666666);
    sceneManager.addObject(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x7CFC00,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    sceneManager.addObject(ground);

    return () => {
      sceneManager.dispose();
      setThreeCamera(null);
      setThreeScene(null);
    };
  }, []);

  const createPlaceholderMesh = useCallback((building: BuildingInstance): THREE.Group => {
    const group = new THREE.Group();
    const def = buildingDefinitions[building.type];
    const color = new THREE.Color(buildingColors[building.type]);
    
    const baseWidth = def.gridSize.width * 0.8;
    const baseDepth = def.gridSize.height * 0.8;
    const height = 1 + (building.level * 0.5);
    
    const baseGeometry = new THREE.BoxGeometry(baseWidth, height, baseDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.6,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = height / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    if (building.type !== "house" && building.type !== "wall_tower") {
      const roofGeometry = new THREE.ConeGeometry(
        Math.max(baseWidth, baseDepth) * 0.7, 
        1, 
        4
      );
      const roofMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.7,
      });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = height + 0.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
    }
    
    return group;
  }, []);

  const loadBuildingModel = useCallback(async (building: BuildingInstance): Promise<THREE.Group> => {
    const ageStr = building.age === "second" ? "second" : "first";
    const variant = building.type === "house" ? 1 : undefined;
    
    try {
      setLoadingBuildings(prev => new Set(prev).add(building.id));
      const model = await fbxLoader.loadBuildingModel(
        building.type,
        ageStr,
        building.level,
        variant
      );
      
      model.position.set(building.position.x * 2, 0, building.position.y * 2);
      model.rotation.y = building.rotation * (Math.PI / 2);
      
      setLoadingBuildings(prev => {
        const next = new Set(prev);
        next.delete(building.id);
        return next;
      });
      
      return model;
    } catch (error) {
      console.warn(`Failed to load FBX for ${building.type}, using placeholder`, error);
      setLoadingBuildings(prev => {
        const next = new Set(prev);
        next.delete(building.id);
        return next;
      });
      
      const placeholder = createPlaceholderMesh(building);
      placeholder.position.set(building.position.x * 2, 0, building.position.y * 2);
      placeholder.rotation.y = building.rotation * (Math.PI / 2);
      return placeholder;
    }
  }, [createPlaceholderMesh]);

  const registeredMeshesRef = useRef<Map<string, THREE.Group>>(new Map());

  const registerBuildingMesh = useCallback((id: string, mesh: THREE.Group, building: BuildingInstance) => {
    const oldMesh = registeredMeshesRef.current.get(id);
    if (oldMesh !== mesh) {
      if (oldMesh) {
        rtsControls.unregisterSelectable(id);
      }
      rtsControls.registerSelectable({
        id: building.id,
        mesh,
        type: 'building',
        data: building,
      });
      registeredMeshesRef.current.set(id, mesh);
    }
  }, [rtsControls.registerSelectable, rtsControls.unregisterSelectable]);

  useEffect(() => {
    if (!sceneManagerRef.current) return;

    buildingsRef.current.forEach((mesh, id) => {
      if (!placedBuildings.find(b => b.id === id)) {
        sceneManagerRef.current?.removeObject(mesh);
        buildingsRef.current.delete(id);
        rtsControls.unregisterSelectable(id);
        registeredMeshesRef.current.delete(id);
      }
    });

    placedBuildings.forEach(async (building) => {
      if (buildingsRef.current.has(building.id)) {
        const mesh = buildingsRef.current.get(building.id)!;
        mesh.position.set(building.position.x * 2, 0, building.position.y * 2);
        mesh.rotation.y = building.rotation * (Math.PI / 2);
        return;
      }
      
      const placeholder = createPlaceholderMesh(building);
      placeholder.position.set(building.position.x * 2, 0, building.position.y * 2);
      placeholder.rotation.y = building.rotation * (Math.PI / 2);
      sceneManagerRef.current?.addObject(placeholder);
      buildingsRef.current.set(building.id, placeholder);
      registerBuildingMesh(building.id, placeholder, building);
      
      try {
        const model = await loadBuildingModel(building);
        
        const oldMesh = buildingsRef.current.get(building.id);
        if (oldMesh) {
          sceneManagerRef.current?.removeObject(oldMesh);
        }
        
        sceneManagerRef.current?.addObject(model);
        buildingsRef.current.set(building.id, model);
        registerBuildingMesh(building.id, model, building);
      } catch (error) {
        console.warn(`Failed to load building model for ${building.type}`, error);
      }
    });
  }, [placedBuildings, createPlaceholderMesh, loadBuildingModel, registerBuildingMesh, rtsControls.unregisterSelectable]);

  useEffect(() => {
    if (!rtsControls.transformState) return;
    
    const selected = rtsControls.selection.selected;
    if (selected.length !== 1) return;
    
    const buildingId = selected[0].id;
    const { position, rotation } = rtsControls.transformState;
    
    const mesh = buildingsRef.current.get(buildingId);
    if (mesh) {
      mesh.position.copy(position);
      mesh.rotation.y = rotation;
    }
    
    rtsControls.updateGizmo();
  }, [rtsControls.transformState, rtsControls.selection.selected, rtsControls.updateGizmo]);

  const finishTransform = useCallback(() => {
    const selected = rtsControls.selection.selected;
    if (selected.length !== 1) return;
    
    const buildingId = selected[0].id;
    const mesh = buildingsRef.current.get(buildingId);
    if (!mesh) return;
    
    setPlacedBuildings(prev => prev.map(b => {
      if (b.id === buildingId) {
        return {
          ...b,
          position: { 
            x: Math.round(mesh.position.x / 2), 
            y: Math.round(mesh.position.z / 2) 
          },
          rotation: Math.round(mesh.rotation.y / (Math.PI / 2)) % 4,
        };
      }
      return b;
    }));
    
    rtsControls.detachGizmo();
    rtsControls.setInputMode('select');
  }, [rtsControls.selection.selected, rtsControls.detachGizmo, rtsControls.setInputMode]);

  const removeBuilding = useCallback((id: string) => {
    const building = placedBuildings.find(b => b.id === id);
    if (!building) return;
    
    const cost = getBuildingCost(building.type, building.level);
    setPlacedBuildings(prev => prev.filter(b => b.id !== id));
    setResources(prev => ({
      gold: prev.gold + Math.floor(cost.gold * 0.5),
      wood: prev.wood + Math.floor(cost.wood * 0.5),
      stone: prev.stone + Math.floor(cost.stone * 0.5),
    }));
    setSelectedPlacedBuilding(null);
  }, [placedBuildings]);

  const upgradeBuilding = useCallback((id: string) => {
    const building = placedBuildings.find(b => b.id === id);
    if (!building) return;
    
    const nextLevel = building.level + 1;
    const def = buildingDefinitions[building.type];
    if (nextLevel > def.maxLevel) return;
    
    const cost = getBuildingCost(building.type, nextLevel);
    const canAffordUpgrade = resources.gold >= cost.gold && resources.wood >= cost.wood && resources.stone >= cost.stone;
    if (!canAffordUpgrade) return;
    
    setPlacedBuildings(prev => prev.map(b => 
      b.id === id ? { ...b, level: nextLevel } : b
    ));
    setResources(prev => ({
      gold: prev.gold - cost.gold,
      wood: prev.wood - cost.wood,
      stone: prev.stone - cost.stone,
    }));
  }, [placedBuildings, resources]);

  const handleContextAction = useCallback((actionId: string, selection: { id: string; type: string }[]) => {
    if (selection.length === 0) return;
    
    switch (actionId) {
      case 'move':
        rtsControls.setInputMode('build');
        if (selection.length === 1) {
          const mesh = buildingsRef.current.get(selection[0].id);
          if (mesh) {
            rtsControls.attachGizmo(mesh);
          }
        }
        break;
      case 'rotate':
        rtsControls.setInputMode('build');
        rtsControls.setGizmoMode('rotate');
        if (selection.length === 1) {
          const mesh = buildingsRef.current.get(selection[0].id);
          if (mesh) {
            rtsControls.attachGizmo(mesh);
          }
        }
        break;
      case 'demolish':
        selection.forEach(s => {
          if (s.type === 'building') {
            removeBuilding(s.id);
          }
        });
        break;
      case 'upgrade':
        selection.forEach(s => {
          if (s.type === 'building') {
            upgradeBuilding(s.id);
          }
        });
        break;
    }
  }, [rtsControls, removeBuilding, upgradeBuilding]);

  const canAfford = (type: BuildingType, level: number = 1): boolean => {
    const cost = getBuildingCost(type, level);
    return (
      resources.gold >= cost.gold &&
      resources.wood >= cost.wood &&
      resources.stone >= cost.stone
    );
  };

  const placeBuilding = (type: BuildingType) => {
    if (!canAfford(type)) return;
    
    const cost = getBuildingCost(type, 1);
    const gridSize = Math.ceil(Math.sqrt(placedBuildings.length + 1));
    const x = (placedBuildings.length % 5) - 2;
    const y = Math.floor(placedBuildings.length / 5) - 2;
    
    const newBuilding: BuildingInstance = {
      id: `building-${Date.now()}`,
      type,
      age: "first",
      level: 1,
      position: { x, y },
      rotation: 0,
      isConstructing: false,
      constructionProgress: 100,
      productionQueue: [],
    };
    
    setPlacedBuildings(prev => [...prev, newBuilding]);
    setResources(prev => ({
      gold: prev.gold - cost.gold,
      wood: prev.wood - cost.wood,
      stone: prev.stone - cost.stone,
    }));
    setSelectedBuildingType(null);
    setPlacementMode(false);
  };

  const selectedBuildingDef = selectedBuildingType ? buildingDefinitions[selectedBuildingType] : null;
  const selectedPlaced = selectedPlacedBuilding 
    ? placedBuildings.find(b => b.id === selectedPlacedBuilding)
    : null;

  return (
    <div className="flex flex-col h-full gap-4 p-4" data-testid="page-islands">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-cinzel font-bold">Home Island</h1>
          <Badge variant="outline">Building Mode</Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-500" />
            <span className="font-medium" data-testid="text-gold">{resources.gold}</span>
          </div>
          <div className="flex items-center gap-2">
            <TreePine className="h-4 w-4 text-green-600" />
            <span className="font-medium" data-testid="text-wood">{resources.wood}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-gray-500" />
            <span className="font-medium" data-testid="text-stone">{resources.stone}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "build" | "orders")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="build" data-testid="tab-main-build">
              <Hammer className="h-4 w-4 mr-2" />
              Build
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-main-orders">
              <Timer className="h-4 w-4 mr-2" />
              Harvest Orders
              {assignments.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {assignments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mainTab === "build" && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg">Island View</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  size="icon"
                  variant={rtsControls.inputMode === 'select' ? 'default' : 'ghost'}
                  onClick={() => {
                    rtsControls.setInputMode('select');
                    rtsControls.detachGizmo();
                  }}
                  data-testid="button-mode-select"
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={rtsControls.inputMode === 'build' ? 'default' : 'ghost'}
                  onClick={() => rtsControls.setInputMode('build')}
                  data-testid="button-mode-build"
                >
                  <Move className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={rtsControls.inputMode === 'command' ? 'default' : 'ghost'}
                  onClick={() => rtsControls.setInputMode('command')}
                  data-testid="button-mode-command"
                >
                  <Hand className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="secondary">
                {placedBuildings.length} Buildings
              </Badge>
              {rtsControls.selection.selected.length > 0 && (
                <Badge variant="outline">
                  {rtsControls.selection.selected.length} selected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 relative">
            <div 
              ref={containerRef} 
              className="w-full h-full min-h-[400px] rounded-md overflow-hidden"
              data-testid="canvas-island-viewer"
            />
            <DragBoxOverlay dragBox={rtsControls.dragBox} />
            {rtsControls.inputMode === 'build' && rtsControls.selection.selected.length === 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/90 p-2 rounded-md border shadow-lg">
                <Button 
                  onClick={finishTransform}
                  data-testid="button-confirm-transform"
                >
                  Confirm Position
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    rtsControls.detachGizmo();
                    rtsControls.setInputMode('select');
                  }}
                  data-testid="button-cancel-transform"
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-1 ml-2 border-l pl-2">
                  <Button
                    size="icon"
                    variant={rtsControls.gizmoMode === 'translate' ? 'default' : 'ghost'}
                    onClick={() => rtsControls.setGizmoMode('translate')}
                    data-testid="button-gizmo-translate"
                  >
                    <Move className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={rtsControls.gizmoMode === 'rotate' ? 'default' : 'ghost'}
                    onClick={() => rtsControls.setGizmoMode('rotate')}
                    data-testid="button-gizmo-rotate"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {rtsControls.contextMenuPosition && (
              <RTSContextMenu
                position={rtsControls.contextMenuPosition}
                selection={rtsControls.selection.selected}
                onClose={rtsControls.closeContextMenu}
                onAction={handleContextAction}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Hammer className="h-5 w-5" />
                Build
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="military" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="military" data-testid="tab-military">Military</TabsTrigger>
                  <TabsTrigger value="economy" data-testid="tab-economy">Economy</TabsTrigger>
                </TabsList>
                <TabsContent value="military" className="space-y-2 mt-2">
                  {(["barracks", "archery", "wall_tower"] as BuildingType[]).map((type) => {
                    const def = buildingDefinitions[type];
                    const Icon = buildingIcons[type];
                    const affordable = canAfford(type);
                    return (
                      <Button
                        key={type}
                        variant={selectedBuildingType === type ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedBuildingType(type);
                          setSelectedPlacedBuilding(null);
                        }}
                        disabled={!affordable}
                        data-testid={`button-build-${type}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {def.name}
                      </Button>
                    );
                  })}
                </TabsContent>
                <TabsContent value="economy" className="space-y-2 mt-2">
                  {(["house", "market", "port", "storage"] as BuildingType[]).map((type) => {
                    const def = buildingDefinitions[type];
                    const Icon = buildingIcons[type];
                    const affordable = canAfford(type);
                    return (
                      <Button
                        key={type}
                        variant={selectedBuildingType === type ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedBuildingType(type);
                          setSelectedPlacedBuilding(null);
                        }}
                        disabled={!affordable}
                        data-testid={`button-build-${type}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {def.name}
                      </Button>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {selectedBuildingDef && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{selectedBuildingDef.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {selectedBuildingDef.description}
                </p>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost:</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3 text-yellow-500" />
                      {getBuildingCost(selectedBuildingType!, 1).gold}
                    </span>
                    <span className="flex items-center gap-1">
                      <TreePine className="h-3 w-3 text-green-600" />
                      {getBuildingCost(selectedBuildingType!, 1).wood}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mountain className="h-3 w-3 text-gray-500" />
                      {getBuildingCost(selectedBuildingType!, 1).stone}
                    </span>
                  </div>
                </div>

                {selectedBuildingDef.produces?.units && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Produces:</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {selectedBuildingDef.produces.units.map(unit => (
                        <Badge key={unit} variant="secondary" className="text-xs capitalize">
                          {unit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full"
                  onClick={() => placeBuilding(selectedBuildingType!)}
                  disabled={!canAfford(selectedBuildingType!)}
                  data-testid="button-place-building"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Place Building
                </Button>
              </CardContent>
            </Card>
          )}

          {placedBuildings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Placed Buildings</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {placedBuildings.map((building) => {
                      const def = buildingDefinitions[building.type];
                      const Icon = buildingIcons[building.type];
                      return (
                        <div
                          key={building.id}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                            selectedPlacedBuilding === building.id 
                              ? "bg-accent" 
                              : "hover:bg-muted"
                          }`}
                          onClick={() => {
                            setSelectedPlacedBuilding(building.id);
                            setSelectedBuildingType(null);
                          }}
                          data-testid={`building-item-${building.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{def.name}</span>
                            <Badge variant="outline" className="text-xs">
                              Lvl {building.level}
                            </Badge>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBuilding(building.id);
                            }}
                            data-testid={`button-remove-${building.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {selectedPlaced && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {buildingDefinitions[selectedPlaced.type].name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge>Level {selectedPlaced.level}</Badge>
                  <Badge variant="outline" className="capitalize">
                    {selectedPlaced.age} Age
                  </Badge>
                </div>
                
                {selectedPlaced.level < buildingDefinitions[selectedPlaced.type].maxLevel && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => upgradeBuilding(selectedPlaced.id)}
                    disabled={!canAfford(selectedPlaced.type, selectedPlaced.level + 1)}
                    data-testid="button-upgrade-building"
                  >
                    Upgrade to Level {selectedPlaced.level + 1}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      )}

      {mainTab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Pickaxe className="h-5 w-5" />
                Resource Nodes
              </CardTitle>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Next Harvest: {harvestCountdown}s</span>
                <Progress value={((HARVEST_INTERVAL_MS / 1000 - harvestCountdown) / (HARVEST_INTERVAL_MS / 1000)) * 100} className="w-20 h-2" />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {nodes.map((node) => {
                    const NodeIcon = NODE_ICONS[node.nodeType] || Pickaxe;
                    const tierInfo = TIER_MULTIPLIERS[node.tier] || TIER_MULTIPLIERS[1];
                    const assignment = assignments.find(a => a.nodeId === node.id);
                    const profession = nodeTypeToProfession[node.nodeType];
                    
                    return (
                      <Card key={node.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-md bg-muted ${TIER_COLORS[node.tier]}`}>
                              <NodeIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{node.nodeType.replace(/_/g, ' ')}</span>
                                <Badge variant="outline" className={TIER_COLORS[node.tier]}>
                                  T{node.tier} {tierInfo.name}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Yields: {node.harvestYield.replace(/_/g, ' ')} | +{node.xpReward} {profession} XP
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Multiplier: {tierInfo.yieldMultiplier}x yield, {tierInfo.xpMultiplier}x XP
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {assignment ? (
                              <div className="space-y-1">
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <UserPlus className="h-3 w-3" />
                                  {assignment.harvesterName}
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  Harvested: {assignment.totalHarvested}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => unassignHarvester.mutate(assignment.id)}
                                  disabled={unassignHarvester.isPending}
                                  data-testid={`button-unassign-${node.id}`}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Unassign
                                </Button>
                              </div>
                            ) : (
                              <div>
                                {selectedNodeForAssign === node.id ? (
                                  <div className="space-y-2">
                                    <Select
                                      onValueChange={(harvesterId) => {
                                        assignHarvester.mutate({ harvesterId, nodeId: node.id });
                                      }}
                                    >
                                      <SelectTrigger className="w-[140px]" data-testid={`select-harvester-${node.id}`}>
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableHarvesters.map((h) => (
                                          <SelectItem key={h.id} value={h.id}>
                                            {h.name} (Lvl {h.level})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setSelectedNodeForAssign(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedNodeForAssign(node.id)}
                                    disabled={availableHarvesters.length === 0}
                                    data-testid={`button-assign-${node.id}`}
                                  >
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Assign
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {Object.entries(harvestedResources)
                      .filter(([_, count]) => count > 0)
                      .map(([resource, count]) => (
                        <div key={resource} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{resource.replace(/_/g, ' ')}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    {Object.values(harvestedResources).every(v => v === 0) && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No resources harvested yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Professions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {professions && Object.values(professions).map((prof) => (
                  <div key={prof.profession} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm capitalize">{prof.profession}</span>
                      <Badge variant="outline">Lvl {prof.level}</Badge>
                    </div>
                    <Progress value={prof.xp} className="h-1" />
                    <div className="text-xs text-muted-foreground text-right">
                      {prof.xp}/100 XP
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Available Workers</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {availableHarvesters.length > 0 ? (
                      availableHarvesters.map((h) => (
                        <div key={h.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{h.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{h.type}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Skill: {h.harvestingSkill}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        All workers assigned
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Recent Harvests</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[100px]">
                  <div className="space-y-1">
                    {recentHarvests.length > 0 ? (
                      recentHarvests.slice(0, 5).map((harvest, idx) => (
                        <div key={idx} className="text-xs flex items-center justify-between py-1">
                          <span className="capitalize">{harvest.resourceType.replace(/_/g, ' ')}</span>
                          <span className="text-green-500">+{harvest.totalYield}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No harvests yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
