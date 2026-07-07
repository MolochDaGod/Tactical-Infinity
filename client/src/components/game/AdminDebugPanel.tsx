import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Settings, 
  Activity,
  Box,
  Layers,
  Camera,
  Wind,
  Zap
} from 'lucide-react';

interface DebugStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  memory: number;
  objectCount: number;
}

interface SceneObject {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  visible: boolean;
  children?: SceneObject[];
}

interface AdminDebugPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  stats?: DebugStats;
  sceneObjects?: SceneObject[];
  cameraInfo?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
  windInfo?: {
    direction: number;
    speed: number;
    gustFactor: number;
  };
  onObjectSelect?: (id: string) => void;
  onObjectToggleVisibility?: (id: string) => void;
  onTeleport?: (position: { x: number; y: number; z: number }) => void;
}

export function AdminDebugPanel({
  isOpen,
  onToggle,
  stats = { fps: 0, drawCalls: 0, triangles: 0, memory: 0, objectCount: 0 },
  sceneObjects = [],
  cameraInfo,
  windInfo,
  onObjectSelect,
  onObjectToggleVisibility,
  onTeleport
}: AdminDebugPanelProps) {
  const [activeTab, setActiveTab] = useState<'performance' | 'scene' | 'camera' | 'physics'>('performance');
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  
  useEffect(() => {
    if (stats.fps > 0) {
      setFpsHistory(prev => [...prev.slice(-59), stats.fps]);
    }
  }, [stats.fps]);
  
  const toggleExpanded = (id: string) => {
    setExpandedObjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const renderSceneTree = (objects: SceneObject[], depth = 0) => {
    return objects.map(obj => (
      <div key={obj.id} style={{ marginLeft: depth * 16 }}>
        <div 
          className="flex items-center gap-1 py-1 hover-elevate rounded px-1 cursor-pointer"
          onClick={() => onObjectSelect?.(obj.id)}
          data-testid={`debug-object-${obj.id}`}
        >
          {obj.children && obj.children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(obj.id);
              }}
              className="p-0.5"
            >
              {expandedObjects.has(obj.id) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          
          <Box className="w-3 h-3 text-muted-foreground" />
          
          <span className="text-xs flex-1 truncate">{obj.name}</span>
          
          <Badge variant="secondary" className="text-[10px] px-1">
            {obj.type}
          </Badge>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onObjectToggleVisibility?.(obj.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {obj.visible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
        
        {obj.children && expandedObjects.has(obj.id) && (
          renderSceneTree(obj.children, depth + 1)
        )}
      </div>
    ));
  };
  
  if (!isOpen) {
    return (
      <Button
        size="icon"
        variant="outline"
        onClick={onToggle}
        className="fixed top-4 right-4 z-50"
        data-testid="button-debug-open"
      >
        <Settings className="w-4 h-4" />
      </Button>
    );
  }
  
  return (
    <Card className="fixed top-4 right-4 z-50 w-72 max-h-[80vh] overflow-hidden flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Debug Panel
        </h3>
        <Button size="icon" variant="ghost" onClick={onToggle} data-testid="button-debug-close">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex border-b">
        {(['performance', 'scene', 'camera', 'physics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs capitalize ${
              activeTab === tab 
                ? 'bg-muted font-medium' 
                : 'hover:bg-muted/50'
            }`}
            data-testid={`tab-debug-${tab}`}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'performance' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase">FPS</div>
                <div className={`text-lg font-bold ${
                  stats.fps >= 55 ? 'text-green-500' : 
                  stats.fps >= 30 ? 'text-yellow-500' : 'text-red-500'
                }`} data-testid="text-fps">
                  {stats.fps.toFixed(0)}
                </div>
              </div>
              
              <div className="bg-muted rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Draw Calls</div>
                <div className="text-lg font-bold" data-testid="text-draw-calls">
                  {stats.drawCalls}
                </div>
              </div>
              
              <div className="bg-muted rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Triangles</div>
                <div className="text-lg font-bold" data-testid="text-triangles">
                  {(stats.triangles / 1000).toFixed(1)}k
                </div>
              </div>
              
              <div className="bg-muted rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Memory</div>
                <div className="text-lg font-bold" data-testid="text-memory">
                  {stats.memory.toFixed(0)}MB
                </div>
              </div>
            </div>
            
            <div className="bg-muted rounded p-2">
              <div className="text-[10px] text-muted-foreground uppercase mb-1">FPS History</div>
              <div className="h-12 flex items-end gap-px">
                {fpsHistory.map((fps, i) => (
                  <div
                    key={i}
                    className={`flex-1 ${
                      fps >= 55 ? 'bg-green-500' : 
                      fps >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${Math.min(100, (fps / 60) * 100)}%` }}
                  />
                ))}
              </div>
            </div>
            
            <div className="bg-muted rounded p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Objects in Scene</div>
              <div className="text-lg font-bold" data-testid="text-object-count">
                {stats.objectCount}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'scene' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4" />
              <span className="text-sm font-medium">Scene Hierarchy</span>
            </div>
            
            {sceneObjects.length > 0 ? (
              <div className="text-xs">
                {renderSceneTree(sceneObjects)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">
                No scene objects available
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4" />
              <span className="text-sm font-medium">Camera Info</span>
            </div>
            
            {cameraInfo ? (
              <>
                <div className="bg-muted rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Position</div>
                  <div className="font-mono text-xs" data-testid="text-camera-pos">
                    X: {cameraInfo.position.x.toFixed(2)}<br />
                    Y: {cameraInfo.position.y.toFixed(2)}<br />
                    Z: {cameraInfo.position.z.toFixed(2)}
                  </div>
                </div>
                
                <div className="bg-muted rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Rotation</div>
                  <div className="font-mono text-xs" data-testid="text-camera-rot">
                    X: {(cameraInfo.rotation.x * 180 / Math.PI).toFixed(1)}deg<br />
                    Y: {(cameraInfo.rotation.y * 180 / Math.PI).toFixed(1)}deg<br />
                    Z: {(cameraInfo.rotation.z * 180 / Math.PI).toFixed(1)}deg
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">
                No camera info available
              </div>
            )}
            
            <div className="space-y-2">
              <div className="text-xs font-medium">Quick Teleport</div>
              <div className="grid grid-cols-2 gap-1">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onTeleport?.({ x: 0, y: 0, z: 0 })}
                  data-testid="button-teleport-origin"
                >
                  Origin
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onTeleport?.({ x: 0, y: 0, z: -15 })}
                  data-testid="button-teleport-cabin"
                >
                  Cabin
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'physics' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4" />
              <span className="text-sm font-medium">Wind System</span>
            </div>
            
            {windInfo ? (
              <>
                <div className="bg-muted rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Direction</div>
                  <div className="font-mono text-sm" data-testid="text-wind-dir">
                    {(windInfo.direction * 180 / Math.PI).toFixed(1)}deg
                  </div>
                </div>
                
                <div className="bg-muted rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Speed</div>
                  <div className="font-mono text-sm" data-testid="text-wind-speed">
                    {windInfo.speed.toFixed(2)} m/s
                  </div>
                </div>
                
                <div className="bg-muted rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Gust Factor</div>
                  <div className="font-mono text-sm" data-testid="text-wind-gust">
                    {windInfo.gustFactor.toFixed(2)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">
                No wind info available
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-4 mb-2">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Physics Debug</span>
            </div>
            
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="rounded" />
                Show Colliders
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="rounded" />
                Show Velocity Vectors
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="rounded" />
                Show Cloth Constraints
              </label>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
