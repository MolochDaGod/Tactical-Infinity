import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Home, 
  Hammer, 
  Trash2, 
  RotateCw, 
  ArrowUp,
  ArrowDown,
  Mountain,
  Waves,
  Wind,
  Eraser,
  Undo,
  Redo,
  Settings,
  Layers,
  TreeDeciduous,
  Factory,
  Store,
  Castle,
  Fence,
  DoorOpen
} from "lucide-react";
import type { BuildingMode, PlayerResources } from "@/lib/islandBuildingSystem";
import type { TerrainToolType, TerrainBrush } from "@/lib/terrainEditingSystem";

export interface BuildingCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  buildings: BuildingType[];
}

export interface BuildingType {
  id: string;
  name: string;
  description: string;
  cost: Partial<PlayerResources>;
  size: { width: number; depth: number };
}

const BUILDING_CATEGORIES: BuildingCategory[] = [
  {
    id: 'foundations',
    name: 'Foundations',
    icon: <Layers className="h-4 w-4" />,
    buildings: [
      { id: 'foundation_wood', name: 'Wood Foundation', description: 'Basic wooden floor', cost: { wood: 10 }, size: { width: 2, depth: 2 } },
      { id: 'foundation_stone', name: 'Stone Foundation', description: 'Sturdy stone floor', cost: { stone: 15 }, size: { width: 2, depth: 2 } },
    ]
  },
  {
    id: 'walls',
    name: 'Walls',
    icon: <Fence className="h-4 w-4" />,
    buildings: [
      { id: 'wall_wood', name: 'Wood Wall', description: 'Basic wooden wall', cost: { wood: 8 }, size: { width: 2, depth: 1 } },
      { id: 'wall_stone', name: 'Stone Wall', description: 'Strong stone wall', cost: { stone: 12 }, size: { width: 2, depth: 1 } },
      { id: 'wall_window', name: 'Window Wall', description: 'Wall with window', cost: { wood: 6, stone: 4 }, size: { width: 2, depth: 1 } },
      { id: 'doorway', name: 'Doorway', description: 'Wall with door frame', cost: { wood: 10 }, size: { width: 2, depth: 1 } },
    ]
  },
  {
    id: 'roofs',
    name: 'Roofs',
    icon: <Home className="h-4 w-4" />,
    buildings: [
      { id: 'roof_thatch', name: 'Thatch Roof', description: 'Simple roof covering', cost: { wood: 5, fiber: 10 }, size: { width: 2, depth: 2 } },
      { id: 'roof_tile', name: 'Tile Roof', description: 'Durable tile roof', cost: { stone: 8 }, size: { width: 2, depth: 2 } },
    ]
  },
  {
    id: 'crafting',
    name: 'Crafting',
    icon: <Factory className="h-4 w-4" />,
    buildings: [
      { id: 'workbench', name: 'Workbench', description: 'Craft basic items', cost: { wood: 20 }, size: { width: 2, depth: 2 } },
      { id: 'forge', name: 'Forge', description: 'Smelt ores and craft metal', cost: { stone: 30, ore: 10 }, size: { width: 2, depth: 2 } },
      { id: 'tanning_rack', name: 'Tanning Rack', description: 'Process leather', cost: { wood: 15, leather: 5 }, size: { width: 2, depth: 2 } },
    ]
  },
  {
    id: 'storage',
    name: 'Storage',
    icon: <Store className="h-4 w-4" />,
    buildings: [
      { id: 'chest_small', name: 'Small Chest', description: 'Store 20 items', cost: { wood: 15 }, size: { width: 1, depth: 1 } },
      { id: 'chest_large', name: 'Large Chest', description: 'Store 50 items', cost: { wood: 30, ore: 5 }, size: { width: 2, depth: 1 } },
    ]
  },
  {
    id: 'decorations',
    name: 'Decor',
    icon: <TreeDeciduous className="h-4 w-4" />,
    buildings: [
      { id: 'torch', name: 'Torch', description: 'Light source', cost: { wood: 2 }, size: { width: 1, depth: 1 } },
      { id: 'campfire', name: 'Campfire', description: 'Warmth and cooking', cost: { wood: 10, stone: 5 }, size: { width: 2, depth: 2 } },
      { id: 'banner', name: 'Banner', description: 'Decorative flag', cost: { wood: 5, fiber: 8 }, size: { width: 1, depth: 1 } },
    ]
  },
];

interface BuildingSystemUIProps {
  mode: 'building' | 'terrain' | 'none';
  buildingMode: BuildingMode;
  currentBuilding: string | null;
  currentRotation: number;
  currentLevel: number;
  playerResources: PlayerResources;
  terrainTool: TerrainToolType;
  terrainBrush: TerrainBrush;
  canUndo: boolean;
  canRedo: boolean;
  onModeChange: (mode: 'building' | 'terrain' | 'none') => void;
  onBuildingModeChange: (mode: BuildingMode) => void;
  onBuildingSelect: (buildingId: string) => void;
  onRotate: () => void;
  onLevelChange: (level: number) => void;
  onTerrainToolChange: (tool: TerrainToolType) => void;
  onBrushRadiusChange: (radius: number) => void;
  onBrushStrengthChange: (strength: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function BuildingSystemUI({
  mode,
  buildingMode,
  currentBuilding,
  currentRotation,
  currentLevel,
  playerResources,
  terrainTool,
  terrainBrush,
  canUndo,
  canRedo,
  onModeChange,
  onBuildingModeChange,
  onBuildingSelect,
  onRotate,
  onLevelChange,
  onTerrainToolChange,
  onBrushRadiusChange,
  onBrushStrengthChange,
  onUndo,
  onRedo,
}: BuildingSystemUIProps) {
  const [selectedCategory, setSelectedCategory] = useState('foundations');

  const canAfford = useCallback((cost: Partial<PlayerResources>): boolean => {
    for (const [resource, amount] of Object.entries(cost)) {
      if (amount && playerResources[resource as keyof PlayerResources] < amount) {
        return false;
      }
    }
    return true;
  }, [playerResources]);

  const formatCost = (cost: Partial<PlayerResources>): string => {
    return Object.entries(cost)
      .filter(([_, amount]) => amount && amount > 0)
      .map(([resource, amount]) => `${amount} ${resource}`)
      .join(', ');
  };

  const getTerrainToolIcon = (tool: TerrainToolType) => {
    switch (tool) {
      case 'raise': return <ArrowUp className="h-4 w-4" />;
      case 'lower': return <ArrowDown className="h-4 w-4" />;
      case 'smooth': return <Waves className="h-4 w-4" />;
      case 'flatten': return <Mountain className="h-4 w-4" />;
      case 'paint': return <Wind className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed left-4 top-20 w-80 z-40">
      <Card className="bg-background/95 backdrop-blur">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Build Mode</CardTitle>
            <div className="flex gap-1">
              <Button
                variant={mode === 'building' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange(mode === 'building' ? 'none' : 'building')}
                data-testid="button-toggle-building"
              >
                <Hammer className="h-4 w-4" />
              </Button>
              <Button
                variant={mode === 'terrain' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange(mode === 'terrain' ? 'none' : 'terrain')}
                data-testid="button-toggle-terrain"
              >
                <Mountain className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {mode !== 'none' && (
          <CardContent className="pt-0 px-4 pb-4">
            {mode === 'building' && (
              <>
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={buildingMode === 'build' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onBuildingModeChange('build')}
                    data-testid="button-mode-build"
                  >
                    <Hammer className="h-4 w-4 mr-1" />
                    Build
                  </Button>
                  <Button
                    variant={buildingMode === 'delete' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => onBuildingModeChange('delete')}
                    data-testid="button-mode-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRotate}
                    data-testid="button-rotate"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Building Level</Label>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((level) => (
                      <Button
                        key={level}
                        variant={currentLevel === level ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onLevelChange(level)}
                        className="flex-1"
                        data-testid={`button-level-${level}`}
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator className="my-3" />

                <ScrollArea className="h-[300px]">
                  <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                    <TabsList className="grid grid-cols-6 gap-1 mb-3">
                      {BUILDING_CATEGORIES.map((cat) => (
                        <TabsTrigger 
                          key={cat.id} 
                          value={cat.id}
                          className="p-2"
                          title={cat.name}
                        >
                          {cat.icon}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {BUILDING_CATEGORIES.map((category) => (
                      <TabsContent key={category.id} value={category.id} className="mt-0">
                        <div className="space-y-2">
                          {category.buildings.map((building) => {
                            const affordable = canAfford(building.cost);
                            const isSelected = currentBuilding === building.id;
                            
                            return (
                              <div
                                key={building.id}
                                className={`p-2 rounded border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary/10'
                                    : affordable
                                    ? 'border-border hover:border-primary/50'
                                    : 'border-border opacity-50'
                                }`}
                                onClick={() => affordable && onBuildingSelect(building.id)}
                                data-testid={`building-${building.id}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">{building.name}</span>
                                  {!affordable && (
                                    <Badge variant="destructive" className="text-xs">
                                      Need More
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">
                                  {building.description}
                                </p>
                                <p className="text-xs text-amber-500">
                                  {formatCost(building.cost)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </ScrollArea>
              </>
            )}

            {mode === 'terrain' && (
              <>
                <div className="grid grid-cols-5 gap-1 mb-4">
                  {(['raise', 'lower', 'smooth', 'flatten', 'paint'] as TerrainToolType[]).map((tool) => (
                    <Button
                      key={tool}
                      variant={terrainTool === tool ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onTerrainToolChange(tool)}
                      title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                      data-testid={`button-terrain-${tool}`}
                    >
                      {getTerrainToolIcon(tool)}
                    </Button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Brush Size: {terrainBrush.radius.toFixed(1)}</Label>
                    <Slider
                      value={[terrainBrush.radius]}
                      onValueChange={([v]) => onBrushRadiusChange(v)}
                      min={1}
                      max={20}
                      step={0.5}
                      data-testid="slider-brush-radius"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Strength: {(terrainBrush.strength * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[terrainBrush.strength]}
                      onValueChange={([v]) => onBrushStrengthChange(v)}
                      min={0.01}
                      max={1}
                      step={0.01}
                      data-testid="slider-brush-strength"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUndo}
                    disabled={!canUndo}
                    data-testid="button-undo"
                  >
                    <Undo className="h-4 w-4 mr-1" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRedo}
                    disabled={!canRedo}
                    data-testid="button-redo"
                  >
                    <Redo className="h-4 w-4 mr-1" />
                    Redo
                  </Button>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  <p>Hotkeys:</p>
                  <ul className="mt-1 space-y-1">
                    <li>1-4: Select tool</li>
                    <li>[ ]: Adjust brush size</li>
                    <li>Shift+Scroll: Resize brush</li>
                    <li>Ctrl+Z/Y: Undo/Redo</li>
                  </ul>
                </div>
              </>
            )}

            <Separator className="my-3" />

            <div className="text-xs">
              <p className="text-muted-foreground mb-2">Resources:</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-amber-600">Wood:</span>
                  <span>{playerResources.wood}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Stone:</span>
                  <span>{playerResources.stone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-orange-400">Ore:</span>
                  <span>{playerResources.ore}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">Gold:</span>
                  <span>{playerResources.gold}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-700">Leather:</span>
                  <span>{playerResources.leather}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-green-400">Fiber:</span>
                  <span>{playerResources.fiber}</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default BuildingSystemUI;
