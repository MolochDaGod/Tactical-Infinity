import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { IslandExploreManager } from '@/lib/islandExploreManager';
import { IndoorShopManager } from '@/lib/indoorShopManager';
import { IslandBuildingSystem, type BuildingMode, type PlayerResources } from '@/lib/islandBuildingSystem';
import { type PlaceableBuildingType } from '@/lib/buildableObjectsRegistry';
import { AdminDebugPanel } from './AdminDebugPanel';
import { BuildHammerUI, BuildHammerPrompt } from './BuildHammerUI';
import { IslandAdminPanel, type PlacedObject, type AdminPanelCallbacks } from './IslandAdminPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Map } from 'lucide-react';

type SceneMode = 'island' | 'shop';

interface IslandExploreSceneProps {
  islandId?: string;
  islandName?: string;
  onExitIsland: () => void;
}

export function IslandExploreScene({ 
  islandId = 'default',
  islandName = 'Mysterious Island',
  onExitIsland 
}: IslandExploreSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const islandManagerRef = useRef<IslandExploreManager | null>(null);
  const shopManagerRef = useRef<IndoorShopManager | null>(null);
  const buildingSystemRef = useRef<IslandBuildingSystem | null>(null);
  
  const [sceneMode, setSceneMode] = useState<SceneMode>('island');
  const [isLoading, setIsLoading] = useState(true);
  const [debugOpen, setDebugOpen] = useState(false);
  
  const [buildingMode, setBuildingMode] = useState<BuildingMode>('none');
  const [selectedBuildingType, setSelectedBuildingType] = useState<PlaceableBuildingType>('wall');
  const [currentBuildLevel, setCurrentBuildLevel] = useState(0);
  const [playerResources, setPlayerResources] = useState<PlayerResources>({
    wood: 100,
    stone: 50,
    ore: 20,
    gold: 50,
    leather: 10,
    fiber: 20
  });
  const [debugStats, setDebugStats] = useState({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    memory: 0,
    objectCount: 0
  });
  
  const lastFrameTime = useRef(performance.now());
  const frameCount = useRef(0);
  const [cameraInfo, setCameraInfo] = useState<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } | undefined>(undefined);
  const [sceneObjects, setSceneObjects] = useState<Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    visible: boolean;
  }>>([]);
  
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  
  const adminCallbacks: AdminPanelCallbacks = {
    onSpawnObject: async (type, assetPath, position) => {
      if (islandManagerRef.current) {
        const result = await islandManagerRef.current.spawnObjectAtPosition(
          assetPath,
          position.x,
          position.z
        );
        if (result) {
          const newObj: PlacedObject = {
            id: result.uuid,
            type: type as PlacedObject['type'],
            assetPath,
            name: assetPath.split('/').pop()?.replace('.glb', '') || 'Object',
            position: { x: result.position.x, y: result.position.y, z: result.position.z },
            rotation: { x: result.rotation.x, y: result.rotation.y, z: result.rotation.z },
            scale: result.scale.x
          };
          setPlacedObjects(prev => [...prev, newObj]);
        }
      }
    },
    onDeleteObject: (id) => {
      if (islandManagerRef.current) {
        const success = islandManagerRef.current.removeObject(id);
        if (success) {
          setPlacedObjects(prev => prev.filter(o => o.id !== id));
        }
      }
    },
    onGetPlayerPosition: () => {
      if (islandManagerRef.current) {
        const pos = islandManagerRef.current.getCharacterPosition();
        return { x: pos.x, y: pos.y, z: pos.z };
      }
      return { x: 0, y: 0, z: 0 };
    },
    onTeleportPlayer: (x, z) => {
      if (islandManagerRef.current) {
        islandManagerRef.current.teleportPlayer(x, z);
      }
    },
    onSaveIsland: () => {
      const data = {
        islandId,
        placedObjects,
        timestamp: Date.now()
      };
      localStorage.setItem(`island_${islandId}`, JSON.stringify(data));
      console.log('Island data saved');
    },
    onLoadIsland: () => {
      const saved = localStorage.getItem(`island_${islandId}`);
      if (saved) {
        const data = JSON.parse(saved);
        console.log('Loaded island data:', data);
      }
    }
  };
  
  const handlePortalEnter = useCallback((portalId: string, destination: string) => {
    console.log(`Entering portal ${portalId} to ${destination}`);
    
    if (destination === 'fantasy_shop') {
      if (islandManagerRef.current) {
        islandManagerRef.current.stop();
      }
      setSceneMode('shop');
    }
  }, []);
  
  const handleExitShop = useCallback(() => {
    if (shopManagerRef.current) {
      shopManagerRef.current.stop();
      shopManagerRef.current.dispose();
      shopManagerRef.current = null;
    }
    setSceneMode('island');
  }, []);
  
  useEffect(() => {
    const updateStats = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastFrameTime.current;
      
      if (elapsed >= 500) {
        const fps = (frameCount.current / elapsed) * 1000;
        
        const manager = sceneMode === 'island' 
          ? islandManagerRef.current 
          : shopManagerRef.current;
        
        if (manager) {
          const rendererStats = manager.getRendererStats();
          const camInfo = manager.getCameraInfo();
          const objects = manager.getSceneObjects();
          
          setDebugStats({
            fps,
            drawCalls: rendererStats.drawCalls,
            triangles: rendererStats.triangles,
            memory: rendererStats.memory,
            objectCount: rendererStats.objectCount
          });
          setCameraInfo(camInfo);
          setSceneObjects(objects);
        } else {
          setDebugStats(prev => ({ ...prev, fps }));
        }
        
        frameCount.current = 0;
        lastFrameTime.current = now;
      }
      
      requestAnimationFrame(updateStats);
    };
    
    const frameId = requestAnimationFrame(updateStats);
    return () => cancelAnimationFrame(frameId);
  }, [sceneMode]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    if (sceneMode === 'island') {
      if (shopManagerRef.current) {
        shopManagerRef.current.dispose();
        shopManagerRef.current = null;
      }
      
      const initIsland = async () => {
        if (!containerRef.current) return;
        
        setIsLoading(true);
        
        const manager = new IslandExploreManager({
          container: containerRef.current,
          onPortalEnter: handlePortalEnter,
          onExitIsland
        });
        
        islandManagerRef.current = manager;
        
        manager.setIslandName(islandName);
        await manager.loadIslandTerrain();
        await manager.loadCharacter('human', 'warrior');
        
        const scene = manager.getScene();
        const camera = manager.getCamera();
        
        if (scene && camera) {
          const buildingSystem = new IslandBuildingSystem(scene, camera);
          buildingSystem.setPlayerResources(playerResources);
          buildingSystem.setCallbacks({
            onModeChange: (mode) => setBuildingMode(mode),
            onResourcesChanged: (resources) => setPlayerResources(resources),
            onBuildingPlaced: (building) => {
              console.log('Building placed:', building.type);
            },
            onBuildingRemoved: (building) => {
              console.log('Building removed:', building.type);
            }
          });
          buildingSystem.initialize();
          buildingSystemRef.current = buildingSystem;
        }

        // Spawn harvestable resource nodes AND huntable/skinnable animals through
        // the manager's own systems so they wire into the harvest/attack loop
        // (keydown 'e'). Uses terrain height sampling to seat everything.
        manager.setupCompleteIsland(new THREE.Vector3(0, 0, 0), 40);
        
        manager.start();
        setIsLoading(false);
        
        const existingObjects = manager.getPlacedObjects();
        const syncedObjects: PlacedObject[] = existingObjects.map(obj => ({
          id: obj.id,
          type: 'building' as const,
          assetPath: '',
          name: obj.name,
          position: obj.position,
          rotation: obj.rotation,
          scale: obj.scale
        }));
        setPlacedObjects(syncedObjects);
      };
      
      initIsland();
      
      return () => {
        if (buildingSystemRef.current) {
          buildingSystemRef.current.dispose();
          buildingSystemRef.current = null;
        }
        if (islandManagerRef.current) {
          islandManagerRef.current.dispose();
          islandManagerRef.current = null;
        }
      };
    } else if (sceneMode === 'shop') {
      if (islandManagerRef.current) {
        islandManagerRef.current.dispose();
        islandManagerRef.current = null;
      }
      
      const initShop = () => {
        if (!containerRef.current) return;
        
        setIsLoading(true);
        
        const manager = new IndoorShopManager({
          container: containerRef.current,
          onExitShop: handleExitShop
        });
        
        shopManagerRef.current = manager;
        manager.start();
        setIsLoading(false);
      };
      
      initShop();
      
      return () => {
        if (shopManagerRef.current) {
          shopManagerRef.current.dispose();
          shopManagerRef.current = null;
        }
      };
    }
  }, [sceneMode, handlePortalEnter, handleExitShop, onExitIsland]);
  
  return (
    <div className="w-full h-screen relative bg-background" data-testid="island-explore-scene">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        data-testid="container-3d-scene"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {sceneMode === 'island' ? 'Loading Island...' : 'Entering Shop...'}
            </p>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 left-4 z-10 flex items-center gap-4">
        <Button 
          variant="outline" 
          onClick={onExitIsland}
          className="bg-background/80 backdrop-blur"
          data-testid="button-exit-island"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Return to Sea
        </Button>
        
        <div className="bg-background/80 backdrop-blur rounded-md px-4 py-2">
          <h2 className="font-semibold" data-testid="text-island-name">
            {sceneMode === 'island' ? islandName : "Mystic Shop"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {sceneMode === 'island' 
              ? 'WASD to move, Right-click drag to rotate camera' 
              : 'WASD to move, Walk to door to exit'}
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur rounded-md p-3 max-w-xs">
        <h3 className="font-medium text-sm mb-2">Controls</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between gap-4">
            <span>Move</span>
            <span className="font-mono">W A S D</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Run</span>
            <span className="font-mono">Shift</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Camera</span>
            <span className="font-mono">Right-Click Drag</span>
          </div>
          {sceneMode === 'island' && (
            <div className="flex justify-between gap-4">
              <span>Enter Portal</span>
              <span className="font-mono">Walk into glow</span>
            </div>
          )}
        </div>
      </div>
      
      {sceneMode === 'island' && (
        <div className="absolute bottom-4 right-4 z-10 bg-blue-500/20 backdrop-blur rounded-md p-3 border border-blue-500/50">
          <div className="flex items-center gap-2 text-blue-400">
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-sm font-medium">Portal Active</span>
          </div>
          <p className="text-xs text-blue-300/80 mt-1">
            Walk to the cabin door to enter the shop
          </p>
        </div>
      )}
      
      {sceneMode === 'shop' && (
        <div className="absolute bottom-4 right-4 z-10 bg-green-500/20 backdrop-blur rounded-md p-3 border border-green-500/50">
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium">Exit Portal</span>
          </div>
          <p className="text-xs text-green-300/80 mt-1">
            Walk to the green doorway to exit
          </p>
        </div>
      )}
      
      {sceneMode === 'island' && buildingMode === 'none' && (
        <BuildHammerPrompt onPress={() => buildingSystemRef.current?.enterBuildingMode()} />
      )}
      
      {sceneMode === 'island' && (
        <BuildHammerUI
          isActive={buildingMode !== 'none'}
          buildingMode={buildingMode}
          selectedType={selectedBuildingType}
          currentLevel={currentBuildLevel}
          playerResources={playerResources}
          onSelectType={(type) => {
            setSelectedBuildingType(type);
            buildingSystemRef.current?.setSelectedBuildingType(type);
          }}
          onToggleMode={() => buildingSystemRef.current?.toggleBuildDeleteMode()}
          onRotate={() => buildingSystemRef.current?.rotatePreview()}
          onChangeLevel={(level) => {
            setCurrentBuildLevel(level);
            const delta = level - currentBuildLevel;
            if (delta !== 0) {
              buildingSystemRef.current?.changeLevel(delta > 0 ? 1 : -1);
            }
          }}
          onClose={() => buildingSystemRef.current?.exitBuildingMode()}
        />
      )}
      
      <AdminDebugPanel
        isOpen={debugOpen}
        onToggle={() => setDebugOpen(!debugOpen)}
        stats={debugStats}
        cameraInfo={cameraInfo}
        sceneObjects={sceneObjects}
        onTeleport={(pos) => {
          const manager = sceneMode === 'island' 
            ? islandManagerRef.current 
            : shopManagerRef.current;
          if (manager) {
            manager.setCharacterPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
          }
        }}
      />
      
      {sceneMode === 'island' && (
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAdminPanelOpen(!adminPanelOpen)}
            className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur"
            data-testid="button-toggle-admin"
          >
            <Map className="w-4 h-4" />
          </Button>
          
          <IslandAdminPanel
            isVisible={adminPanelOpen}
            onClose={() => setAdminPanelOpen(false)}
            placedObjects={placedObjects}
            callbacks={adminCallbacks}
          />
        </>
      )}
    </div>
  );
}
