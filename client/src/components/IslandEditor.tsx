import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  TreePine, Mountain, Building2, Anchor, Waves,
  PanelLeftClose, PanelLeft, Palette, Trees, Home, 
  Settings, Hammer, MapPin, Sparkles, Wind
} from 'lucide-react';

export type TreeStyle = 'palm' | 'pine' | 'birch' | 'normal' | 'dead' | 'mixed';
export type TerrainTexture = 'tropical' | 'forest' | 'volcanic' | 'arctic' | 'desert' | 'haunted';

export interface IslandEditorConfig {
  islandScale: number;
  treeStyle: TreeStyle;
  treeDensity: number;
  terrainTexture: TerrainTexture;
  enableDock: boolean;
  enableDebris: boolean;
  enablePalmTrees: boolean;
  enableRealisticTrees: boolean;
  enableWaypoint: boolean;
  enableSpawnMarker: boolean;
  enableWaterfall: boolean;
  enableTemple: boolean;
  enablePirateShop: boolean;
  buildingMode: 'none' | 'build' | 'delete';
  selectedBuildingType: string;
  ambientOcclusion: number;
  fogDensity: number;
  timeOfDay: number;
}

export const DEFAULT_EDITOR_CONFIG: IslandEditorConfig = {
  islandScale: 2,
  treeStyle: 'mixed',
  treeDensity: 0.7,
  terrainTexture: 'tropical',
  enableDock: true,
  enableDebris: true,
  enablePalmTrees: true,
  enableRealisticTrees: true,
  enableWaypoint: true,
  enableSpawnMarker: true,
  enableWaterfall: false,
  enableTemple: false,
  enablePirateShop: false,
  buildingMode: 'none',
  selectedBuildingType: 'wall',
  ambientOcclusion: 0.5,
  fogDensity: 0.5,
  timeOfDay: 12,
};

export type ElementToggleKey = 
  | 'enableDock' 
  | 'enableDebris' 
  | 'enablePalmTrees' 
  | 'enableRealisticTrees'
  | 'enableWaypoint'
  | 'enableSpawnMarker'
  | 'enableWaterfall'
  | 'enableTemple'
  | 'enablePirateShop';

interface IslandEditorProps {
  config: IslandEditorConfig;
  onConfigChange: (config: Partial<IslandEditorConfig>) => void;
  onPlaceBuilding?: (type: string) => void;
  onToggleBuildMode?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const TREE_STYLES: { value: TreeStyle; label: string; icon: string }[] = [
  { value: 'palm', label: 'Palm Trees', icon: '🌴' },
  { value: 'pine', label: 'Pine Forest', icon: '🌲' },
  { value: 'birch', label: 'Birch Woods', icon: '🌳' },
  { value: 'normal', label: 'Deciduous', icon: '🍂' },
  { value: 'dead', label: 'Dead/Haunted', icon: '🪵' },
  { value: 'mixed', label: 'Mixed Forest', icon: '🌿' },
];

const TERRAIN_TEXTURES: { value: TerrainTexture; label: string; color: string }[] = [
  { value: 'tropical', label: 'Tropical Paradise', color: '#4ade80' },
  { value: 'forest', label: 'Forest Glade', color: '#22c55e' },
  { value: 'volcanic', label: 'Volcanic Island', color: '#7c3aed' },
  { value: 'arctic', label: 'Frozen Tundra', color: '#93c5fd' },
  { value: 'desert', label: 'Desert Oasis', color: '#fbbf24' },
  { value: 'haunted', label: 'Haunted Swamp', color: '#6b7280' },
];

const BUILDING_CATEGORIES = [
  { 
    name: 'Structures',
    items: [
      { type: 'wall', label: 'Wall', icon: Building2 },
      { type: 'floor', label: 'Floor', icon: Building2 },
      { type: 'ramp', label: 'Ramp', icon: Building2 },
      { type: 'spiked_wall', label: 'Spiked Wall', icon: Building2 },
    ]
  },
  { 
    name: 'Crafting',
    items: [
      { type: 'workbench', label: 'Workbench', icon: Hammer },
      { type: 'forge', label: 'Forge', icon: Sparkles },
      { type: 'alchemy_table', label: 'Alchemy Table', icon: Sparkles },
      { type: 'loom', label: 'Loom', icon: Settings },
    ]
  },
  { 
    name: 'Storage',
    items: [
      { type: 'storage_chest', label: 'Chest', icon: Building2 },
      { type: 'weapons_rack', label: 'Weapons Rack', icon: Building2 },
      { type: 'armor_stand', label: 'Armor Stand', icon: Building2 },
    ]
  },
  { 
    name: 'Functional',
    items: [
      { type: 'campfire', label: 'Campfire', icon: Sparkles },
      { type: 'torch', label: 'Torch', icon: Sparkles },
      { type: 'bed', label: 'Bed', icon: Home },
      { type: 'cooking_pot', label: 'Cooking Pot', icon: Hammer },
    ]
  },
  { 
    name: 'Harbor',
    items: [
      { type: 'dock', label: 'Dock', icon: Anchor },
      { type: 'dock_pillar', label: 'Dock Pillar', icon: Anchor },
      { type: 'boat_small', label: 'Small Boat', icon: Waves },
    ]
  },
];

export default function IslandEditor({
  config,
  onConfigChange,
  onPlaceBuilding,
  onToggleBuildMode,
  isCollapsed = false,
  onToggleCollapse,
}: IslandEditorProps) {
  const [activeTab, setActiveTab] = useState('terrain');

  const handleToggle = useCallback((key: keyof IslandEditorConfig) => {
    onConfigChange({ [key]: !config[key] });
  }, [config, onConfigChange]);

  if (isCollapsed) {
    return (
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleCollapse}
          className="bg-black/60 backdrop-blur-sm border-white/30 text-white hover:bg-black/80"
          data-testid="button-expand-editor"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-20 w-80 max-h-[calc(100vh-8rem)]">
      <Card className="bg-black/80 backdrop-blur-md border-white/20 text-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-400" />
            Island Editor
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-collapse-editor"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4 bg-white/10 p-1 m-2 rounded-lg">
              <TabsTrigger 
                value="terrain" 
                className="data-[state=active]:bg-amber-600 text-xs"
                data-testid="tab-terrain"
              >
                <Mountain className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger 
                value="trees" 
                className="data-[state=active]:bg-green-600 text-xs"
                data-testid="tab-trees"
              >
                <Trees className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger 
                value="buildings" 
                className="data-[state=active]:bg-blue-600 text-xs"
                data-testid="tab-buildings"
              >
                <Home className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:bg-purple-600 text-xs"
                data-testid="tab-settings"
              >
                <Settings className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] px-3 pb-3">
              <TabsContent value="terrain" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <Label className="text-white/80">Terrain Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TERRAIN_TEXTURES.map(({ value, label, color }) => (
                      <Button
                        key={value}
                        variant={config.terrainTexture === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onConfigChange({ terrainTexture: value })}
                        className={`text-xs justify-start ${
                          config.terrainTexture === value 
                            ? 'bg-amber-600 hover:bg-amber-700' 
                            : 'bg-white/5 border-white/20 hover:bg-white/10'
                        }`}
                        data-testid={`button-terrain-${value}`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: color }}
                        />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Island Scale</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[config.islandScale]}
                      onValueChange={([v]) => onConfigChange({ islandScale: v })}
                      min={0.5}
                      max={4}
                      step={0.5}
                      className="flex-1"
                      data-testid="slider-island-scale"
                    />
                    <Badge variant="secondary" className="w-12 justify-center">
                      {config.islandScale}x
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-white/80">Island Features</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Anchor className="h-4 w-4" /> Dock
                      </Label>
                      <Switch
                        checked={config.enableDock}
                        onCheckedChange={() => handleToggle('enableDock')}
                        data-testid="switch-dock"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Waves className="h-4 w-4" /> Debris
                      </Label>
                      <Switch
                        checked={config.enableDebris}
                        onCheckedChange={() => handleToggle('enableDebris')}
                        data-testid="switch-debris"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Waterfall
                      </Label>
                      <Switch
                        checked={config.enableWaterfall}
                        onCheckedChange={() => handleToggle('enableWaterfall')}
                        data-testid="switch-waterfall"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Temple
                      </Label>
                      <Switch
                        checked={config.enableTemple}
                        onCheckedChange={() => handleToggle('enableTemple')}
                        data-testid="switch-temple"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Home className="h-4 w-4" /> Pirate Shop
                      </Label>
                      <Switch
                        checked={config.enablePirateShop}
                        onCheckedChange={() => handleToggle('enablePirateShop')}
                        data-testid="switch-pirate-shop"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trees" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <Label className="text-white/80">Tree Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TREE_STYLES.map(({ value, label, icon }) => (
                      <Button
                        key={value}
                        variant={config.treeStyle === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onConfigChange({ treeStyle: value })}
                        className={`text-xs justify-start ${
                          config.treeStyle === value 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-white/5 border-white/20 hover:bg-white/10'
                        }`}
                        data-testid={`button-tree-${value}`}
                      >
                        <span className="mr-2">{icon}</span>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Tree Density</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[config.treeDensity * 100]}
                      onValueChange={([v]) => onConfigChange({ treeDensity: v / 100 })}
                      min={0}
                      max={100}
                      step={10}
                      className="flex-1"
                      data-testid="slider-tree-density"
                    />
                    <Badge variant="secondary" className="w-12 justify-center">
                      {Math.round(config.treeDensity * 100)}%
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-white/80">Vegetation</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <TreePine className="h-4 w-4" /> Palm Trees
                      </Label>
                      <Switch
                        checked={config.enablePalmTrees}
                        onCheckedChange={() => handleToggle('enablePalmTrees')}
                        data-testid="switch-palm-trees"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Trees className="h-4 w-4" /> Realistic Trees
                      </Label>
                      <Switch
                        checked={config.enableRealisticTrees}
                        onCheckedChange={() => handleToggle('enableRealisticTrees')}
                        data-testid="switch-realistic-trees"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="buildings" className="mt-0 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-white/80">Build Mode</Label>
                  <Button
                    variant={config.buildingMode === 'build' ? 'default' : 'outline'}
                    size="sm"
                    onClick={onToggleBuildMode}
                    className={config.buildingMode === 'build' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                    }
                    data-testid="button-toggle-build-mode"
                  >
                    <Hammer className="h-4 w-4 mr-2" />
                    {config.buildingMode === 'build' ? 'Building...' : 'Start Building'}
                  </Button>
                </div>

                {BUILDING_CATEGORIES.map((category) => (
                  <div key={category.name} className="space-y-2">
                    <Label className="text-sm text-white/60 uppercase tracking-wider">
                      {category.name}
                    </Label>
                    <div className="grid grid-cols-2 gap-1">
                      {category.items.map(({ type, label, icon: Icon }) => (
                        <Button
                          key={type}
                          variant={config.selectedBuildingType === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            onConfigChange({ selectedBuildingType: type });
                            onPlaceBuilding?.(type);
                          }}
                          className={`text-xs justify-start ${
                            config.selectedBuildingType === type 
                              ? 'bg-blue-600 hover:bg-blue-700' 
                              : 'bg-white/5 border-white/20 hover:bg-white/10'
                          }`}
                          data-testid={`button-building-${type}`}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="settings" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <Label className="text-white/80">Environment</Label>
                  
                  <div className="space-y-2">
                    <Label className="text-sm text-white/70">Time of Day</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[config.timeOfDay]}
                        onValueChange={([v]) => onConfigChange({ timeOfDay: v })}
                        min={0}
                        max={24}
                        step={1}
                        className="flex-1"
                        data-testid="slider-time-of-day"
                      />
                      <Badge variant="secondary" className="w-16 justify-center">
                        {config.timeOfDay}:00
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-white/70">Fog Density</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[config.fogDensity * 100]}
                        onValueChange={([v]) => onConfigChange({ fogDensity: v / 100 })}
                        min={0}
                        max={100}
                        step={10}
                        className="flex-1"
                        data-testid="slider-fog"
                      />
                      <Badge variant="secondary" className="w-12 justify-center">
                        {Math.round(config.fogDensity * 100)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-white/80">Markers</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Spawn Marker
                      </Label>
                      <Switch
                        checked={config.enableSpawnMarker}
                        onCheckedChange={() => handleToggle('enableSpawnMarker')}
                        data-testid="switch-spawn-marker"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white/70 flex items-center gap-2">
                        <Wind className="h-4 w-4" /> Waypoint
                      </Label>
                      <Switch
                        checked={config.enableWaypoint}
                        onCheckedChange={() => handleToggle('enableWaypoint')}
                        data-testid="switch-waypoint"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
