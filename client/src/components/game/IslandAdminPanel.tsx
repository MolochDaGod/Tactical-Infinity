import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  TreeDeciduous, 
  Mountain, 
  Home, 
  Package, 
  Move3D,
  RotateCw,
  Maximize2,
  Trash2,
  Plus,
  Save,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  MapPin,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlacedObject {
  id: string;
  type: 'building' | 'resource' | 'prop' | 'npc';
  assetPath: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface AdminPanelCallbacks {
  onSpawnObject?: (type: string, assetPath: string, position: { x: number; z: number }) => void;
  onDeleteObject?: (id: string) => void;
  onUpdateObject?: (id: string, updates: Partial<PlacedObject>) => void;
  onGetPlayerPosition?: () => { x: number; y: number; z: number };
  onTeleportPlayer?: (x: number, z: number) => void;
  onSaveIsland?: () => void;
  onLoadIsland?: () => void;
}

interface AssetCategory {
  name: string;
  icon: React.ReactNode;
  assets: AssetItem[];
}

interface AssetItem {
  id: string;
  name: string;
  path: string;
  type: 'building' | 'resource' | 'prop' | 'npc';
  thumbnail?: string;
}

const ASSET_LIBRARY: AssetCategory[] = [
  {
    name: 'Buildings',
    icon: <Home className="w-4 h-4" />,
    assets: [
      { id: 'barracks', name: 'Barracks', path: '/models/buildings/barracks.glb', type: 'building' },
      { id: 'barricade', name: 'Barricade', path: '/models/buildings/barricade.glb', type: 'building' },
      { id: 'farm', name: 'Farm', path: '/models/buildings/farm.glb', type: 'building' },
      { id: 'fantasy_house', name: 'Fantasy House', path: '/models/buildings/fantasy_house.glb', type: 'building' },
      { id: 'hut', name: 'Hut', path: '/models/buildings/hut.glb', type: 'building' },
      { id: 'log_cabin', name: 'Log Cabin', path: '/models/buildings/log_cabin.glb', type: 'building' },
    ]
  },
  {
    name: 'Props',
    icon: <Mountain className="w-4 h-4" />,
    assets: [
      { id: 'barrel', name: 'Barrel', path: '/models/props/barrel.glb', type: 'prop' },
      { id: 'crate', name: 'Crate', path: '/models/props/crate.glb', type: 'prop' },
      { id: 'chest', name: 'Chest', path: '/models/props/chest.glb', type: 'prop' },
      { id: 'cannon', name: 'Cannon', path: '/models/props/cannon.glb', type: 'prop' },
      { id: 'workbench', name: 'Workbench', path: '/models/props/workbench.glb', type: 'prop' },
      { id: 'flag_pirate', name: 'Pirate Flag', path: '/models/props/flag-pirate.glb', type: 'prop' },
    ]
  },
  {
    name: 'Characters',
    icon: <Package className="w-4 h-4" />,
    assets: [
      { id: 'goblin', name: 'Goblin', path: '/models/characters/goblin_npc.glb', type: 'npc' },
      { id: 'elf_knight', name: 'Elf Knight', path: '/models/characters/elf_knight.glb', type: 'npc' },
      { id: 'meshy_character', name: 'Meshy Character', path: '/models/characters/meshy_character.glb', type: 'npc' },
      { id: 'undead_necro', name: 'Undead Necromancer', path: '/models/characters/undead_necro.glb', type: 'npc' },
    ]
  },
  {
    name: 'Ships',
    icon: <Package className="w-4 h-4" />,
    assets: [
      { id: 'ship_ghost', name: 'Ghost Ship', path: '/models/ships/ship-ghost.glb', type: 'prop' },
      { id: 'ship_large', name: 'Large Ship', path: '/models/ships/ship-large.glb', type: 'prop' },
      { id: 'ship_medium', name: 'Medium Ship', path: '/models/ships/ship-medium.glb', type: 'prop' },
      { id: 'ship_small', name: 'Small Ship', path: '/models/ships/ship-small.glb', type: 'prop' },
      { id: 'ship_pirate_large', name: 'Pirate Ship (Large)', path: '/models/ships/ship-pirate-large.glb', type: 'prop' },
      { id: 'ship_pirate_medium', name: 'Pirate Ship (Medium)', path: '/models/ships/ship-pirate-medium.glb', type: 'prop' },
      { id: 'ship_pirate_small', name: 'Pirate Ship (Small)', path: '/models/ships/ship-pirate-small.glb', type: 'prop' },
      { id: 'ship_wreck', name: 'Shipwreck', path: '/models/ships/ship-wreck.glb', type: 'prop' },
    ]
  },
  {
    name: 'Sea Creatures',
    icon: <Package className="w-4 h-4" />,
    assets: [
      { id: 'octopus', name: 'Octopus', path: '/models/sea_creatures/octopus.glb', type: 'npc' },
      { id: 'shark', name: 'Shark', path: '/models/sea_creatures/shark.glb', type: 'npc' },
      { id: 'tentacle', name: 'Kraken Tentacle', path: '/models/sea_creatures/tentacle.glb', type: 'npc' },
    ]
  }
];

interface IslandAdminPanelProps {
  isVisible: boolean;
  onClose: () => void;
  placedObjects: PlacedObject[];
  callbacks: AdminPanelCallbacks;
}

export function IslandAdminPanel({ 
  isVisible, 
  onClose, 
  placedObjects, 
  callbacks 
}: IslandAdminPanelProps) {
  const [selectedObject, setSelectedObject] = useState<PlacedObject | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Buildings']);
  const [spawnPosition, setSpawnPosition] = useState({ x: 0, z: 0 });
  const [activeTab, setActiveTab] = useState('assets');
  
  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };
  
  const handleSpawnAtPlayer = useCallback(() => {
    if (!selectedAsset || !callbacks.onGetPlayerPosition || !callbacks.onSpawnObject) return;
    
    const pos = callbacks.onGetPlayerPosition();
    callbacks.onSpawnObject(selectedAsset.type, selectedAsset.path, { x: pos.x + 3, z: pos.z });
  }, [selectedAsset, callbacks]);
  
  const handleSpawnAtPosition = useCallback(() => {
    if (!selectedAsset || !callbacks.onSpawnObject) return;
    callbacks.onSpawnObject(selectedAsset.type, selectedAsset.path, spawnPosition);
  }, [selectedAsset, spawnPosition, callbacks]);
  
  const handleDeleteObject = useCallback((id: string) => {
    if (callbacks.onDeleteObject) {
      callbacks.onDeleteObject(id);
    }
    if (selectedObject?.id === id) {
      setSelectedObject(null);
    }
  }, [callbacks, selectedObject]);
  
  const handleTeleport = useCallback(() => {
    if (callbacks.onTeleportPlayer) {
      callbacks.onTeleportPlayer(spawnPosition.x, spawnPosition.z);
    }
  }, [callbacks, spawnPosition]);
  
  if (!isVisible) return null;
  
  return (
    <Card className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] bg-background/95 backdrop-blur-sm border-primary/20 z-50">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Admin Panel</h3>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          data-testid="button-close-admin"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full justify-start px-3 pt-2 bg-transparent">
          <TabsTrigger value="assets" className="text-xs" data-testid="tab-assets">
            <Package className="w-3 h-3 mr-1" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="objects" className="text-xs" data-testid="tab-objects">
            <Layers className="w-3 h-3 mr-1" />
            Objects
          </TabsTrigger>
          <TabsTrigger value="tools" className="text-xs" data-testid="tab-tools">
            <Move3D className="w-3 h-3 mr-1" />
            Tools
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="assets" className="m-0">
          <ScrollArea className="h-[400px]">
            <div className="p-3 space-y-2">
              {ASSET_LIBRARY.map(category => (
                <div key={category.name} className="border border-border rounded-md overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.name)}
                    className="w-full flex items-center justify-between p-2 bg-muted/50 hover-elevate"
                    data-testid={`category-${category.name.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-2">
                      {category.icon}
                      <span className="text-sm font-medium">{category.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {category.assets.length}
                      </Badge>
                    </div>
                    {expandedCategories.includes(category.name) 
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />
                    }
                  </button>
                  
                  {expandedCategories.includes(category.name) && (
                    <div className="p-2 grid grid-cols-2 gap-1">
                      {category.assets.map(asset => (
                        <button
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={cn(
                            "p-2 rounded text-left text-xs hover-elevate",
                            selectedAsset?.id === asset.id 
                              ? "bg-primary/20 border border-primary" 
                              : "bg-card border border-transparent"
                          )}
                          data-testid={`asset-${asset.id}`}
                        >
                          {asset.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {selectedAsset && (
                <Card className="p-3 bg-muted/30">
                  <div className="text-sm font-medium mb-2">
                    Selected: {selectedAsset.name}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">X</Label>
                        <Input
                          type="number"
                          value={spawnPosition.x}
                          onChange={(e) => setSpawnPosition(p => ({ ...p, x: parseFloat(e.target.value) || 0 }))}
                          className="h-8 text-xs"
                          data-testid="input-spawn-x"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Z</Label>
                        <Input
                          type="number"
                          value={spawnPosition.z}
                          onChange={(e) => setSpawnPosition(p => ({ ...p, z: parseFloat(e.target.value) || 0 }))}
                          className="h-8 text-xs"
                          data-testid="input-spawn-z"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSpawnAtPosition}
                        className="flex-1 text-xs"
                        data-testid="button-spawn-position"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Spawn
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={handleSpawnAtPlayer}
                        className="flex-1 text-xs"
                        data-testid="button-spawn-player"
                      >
                        <MapPin className="w-3 h-3 mr-1" />
                        At Player
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="objects" className="m-0">
          <ScrollArea className="h-[400px]">
            <div className="p-3 space-y-2">
              {placedObjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No objects placed yet
                </div>
              ) : (
                placedObjects.map(obj => (
                  <Card 
                    key={obj.id}
                    className={cn(
                      "p-2 cursor-pointer hover-elevate",
                      selectedObject?.id === obj.id && "border-primary"
                    )}
                    onClick={() => setSelectedObject(obj)}
                    data-testid={`object-${obj.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{obj.name}</div>
                        <div className="text-xs text-muted-foreground">
                          X:{obj.position.x.toFixed(1)} Y:{obj.position.y.toFixed(1)} Z:{obj.position.z.toFixed(1)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteObject(obj.id);
                        }}
                        data-testid={`button-delete-${obj.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
          
          {selectedObject && (
            <div className="p-3 border-t border-border space-y-3">
              <div className="text-sm font-medium">Transform: {selectedObject.name}</div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Move3D className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs w-12">Position</span>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    <Input 
                      type="number" 
                      value={selectedObject.position.x.toFixed(1)} 
                      className="h-6 text-xs"
                      readOnly 
                    />
                    <Input 
                      type="number" 
                      value={selectedObject.position.y.toFixed(1)} 
                      className="h-6 text-xs"
                      readOnly 
                    />
                    <Input 
                      type="number" 
                      value={selectedObject.position.z.toFixed(1)} 
                      className="h-6 text-xs"
                      readOnly 
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs w-12">Rotation</span>
                  <Slider
                    value={[selectedObject.rotation.y * (180 / Math.PI)]}
                    min={0}
                    max={360}
                    step={15}
                    className="flex-1"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs w-12">Scale</span>
                  <Slider
                    value={[selectedObject.scale * 100]}
                    min={25}
                    max={200}
                    step={25}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="tools" className="m-0">
          <div className="p-3 space-y-4">
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">Teleport</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <Label className="text-xs">X</Label>
                  <Input
                    type="number"
                    value={spawnPosition.x}
                    onChange={(e) => setSpawnPosition(p => ({ ...p, x: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs"
                    data-testid="input-teleport-x"
                  />
                </div>
                <div>
                  <Label className="text-xs">Z</Label>
                  <Input
                    type="number"
                    value={spawnPosition.z}
                    onChange={(e) => setSpawnPosition(p => ({ ...p, z: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs"
                    data-testid="input-teleport-z"
                  />
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={handleTeleport}
                className="w-full text-xs"
                data-testid="button-teleport"
              >
                <MapPin className="w-3 h-3 mr-1" />
                Teleport Player
              </Button>
            </Card>
            
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">Island Data</div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={callbacks.onSaveIsland}
                  className="flex-1 text-xs"
                  data-testid="button-save-island"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={callbacks.onLoadIsland}
                  className="flex-1 text-xs"
                  data-testid="button-load-island"
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Load
                </Button>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">Quick Stats</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objects:</span>
                  <span>{placedObjects.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buildings:</span>
                  <span>{placedObjects.filter(o => o.type === 'building').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resources:</span>
                  <span>{placedObjects.filter(o => o.type === 'resource').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NPCs:</span>
                  <span>{placedObjects.filter(o => o.type === 'npc').length}</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
