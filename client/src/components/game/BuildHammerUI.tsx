import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Hammer, X, RotateCw, Trash2, Layers, Building2, Cog, Shield, 
  Flower2, Wheat, TreeDeciduous, Mountain, Pickaxe, Coins 
} from 'lucide-react';
import { 
  type PlaceableBuildingType, 
  type PlaceableBuildingDefinition,
  placeableBuildingDefinitions 
} from '@/lib/buildableObjectsRegistry';
import type { BuildingMode, PlayerResources } from '@/lib/islandBuildingSystem';

interface BuildHammerUIProps {
  isActive: boolean;
  buildingMode: BuildingMode;
  selectedType: PlaceableBuildingType;
  currentLevel: number;
  playerResources: PlayerResources;
  onSelectType: (type: PlaceableBuildingType) => void;
  onToggleMode: () => void;
  onRotate: () => void;
  onChangeLevel: (level: number) => void;
  onClose: () => void;
}

const CategoryIcon = ({ category }: { category: PlaceableBuildingDefinition['category'] }) => {
  const iconClass = "w-3.5 h-3.5";
  switch (category) {
    case 'structure': return <Building2 className={iconClass} />;
    case 'production': return <Cog className={iconClass} />;
    case 'defense': return <Shield className={iconClass} />;
    case 'decoration': return <Flower2 className={iconClass} />;
    case 'farming': return <Wheat className={iconClass} />;
    default: return <Building2 className={iconClass} />;
  }
};

const categoryNames: Record<PlaceableBuildingDefinition['category'], string> = {
  structure: 'Structures',
  production: 'Production',
  defense: 'Defense',
  decoration: 'Decoration',
  farming: 'Farming'
};

export function BuildHammerUI({
  isActive,
  buildingMode,
  selectedType,
  currentLevel,
  playerResources,
  onSelectType,
  onToggleMode,
  onRotate,
  onChangeLevel,
  onClose
}: BuildHammerUIProps) {
  const [activeCategory, setActiveCategory] = useState<PlaceableBuildingDefinition['category']>('structure');

  if (!isActive) return null;

  const getBuildingsForCategory = (category: PlaceableBuildingDefinition['category']) => {
    return Object.values(placeableBuildingDefinitions).filter(d => d.category === category);
  };

  const canAfford = (type: PlaceableBuildingType): boolean => {
    const def = placeableBuildingDefinitions[type];
    for (const [resource, amount] of Object.entries(def.cost)) {
      if (amount && playerResources[resource as keyof PlayerResources] < amount) {
        return false;
      }
    }
    return true;
  };

  const formatCost = (cost: PlaceableBuildingDefinition['cost']): { icon: ReactNode; amount: number }[] => {
    const parts: { icon: ReactNode; amount: number }[] = [];
    if (cost.wood) parts.push({ icon: <TreeDeciduous className="w-3 h-3" />, amount: cost.wood });
    if (cost.stone) parts.push({ icon: <Mountain className="w-3 h-3" />, amount: cost.stone });
    if (cost.ore) parts.push({ icon: <Pickaxe className="w-3 h-3" />, amount: cost.ore });
    if (cost.gold) parts.push({ icon: <Coins className="w-3 h-3" />, amount: cost.gold });
    return parts;
  };

  return (
    <div 
      id="buildHammerUI" 
      className="fixed right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-auto"
      data-testid="build-hammer-ui"
    >
      <Card className="w-80 bg-gradient-to-br from-amber-900/95 to-amber-800/90 border-2 border-amber-600 shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Hammer className="w-5 h-5 text-amber-300" />
              <CardTitle className="text-amber-100 text-lg">Build Hammer</CardTitle>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onClose}
              className="text-amber-300 hover:text-amber-100 hover:bg-amber-700/50"
              data-testid="button-close-build"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={buildingMode === 'build' ? 'default' : 'secondary'} className="bg-green-600">
              {buildingMode === 'build' ? (
                <><Hammer className="w-3 h-3 mr-1" /> Building</>
              ) : (
                <><Trash2 className="w-3 h-3 mr-1" /> Deleting</>
              )}
            </Badge>
            <Badge variant="outline" className="border-amber-500 text-amber-200">
              <Layers className="w-3 h-3 mr-1" />
              Level {currentLevel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap bg-amber-950/50 p-2 rounded-lg">
            <span className="text-amber-200 text-xs flex items-center gap-1">
              <TreeDeciduous className="w-3 h-3" /> {playerResources.wood}
            </span>
            <span className="text-amber-200 text-xs flex items-center gap-1">
              <Mountain className="w-3 h-3" /> {playerResources.stone}
            </span>
            <span className="text-amber-200 text-xs flex items-center gap-1">
              <Pickaxe className="w-3 h-3" /> {playerResources.ore}
            </span>
            <span className="text-amber-200 text-xs flex items-center gap-1">
              <Coins className="w-3 h-3" /> {playerResources.gold}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={buildingMode === 'build' ? 'default' : 'outline'}
              onClick={onToggleMode}
              className="flex-1"
              data-testid="button-toggle-build-mode"
            >
              {buildingMode === 'build' ? <Hammer className="w-4 h-4 mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {buildingMode === 'build' ? 'Build' : 'Delete'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRotate}
              disabled={buildingMode !== 'build'}
              data-testid="button-rotate"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-1 justify-center">
            {[0, 1, 2, 3, 4].map((level) => (
              <Button
                key={level}
                size="sm"
                variant={currentLevel === level ? 'default' : 'outline'}
                onClick={() => onChangeLevel(level)}
                className="w-8 h-8 p-0"
                data-testid={`button-level-${level}`}
              >
                {level}
              </Button>
            ))}
          </div>

          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as PlaceableBuildingDefinition['category'])}>
            <TabsList className="w-full grid grid-cols-5 h-8 bg-amber-950/50">
              {(Object.keys(categoryNames) as PlaceableBuildingDefinition['category'][]).map((cat) => (
                <TabsTrigger 
                  key={cat} 
                  value={cat} 
                  className="text-xs p-1 data-[state=active]:bg-amber-600"
                  title={categoryNames[cat]}
                >
                  <CategoryIcon category={cat} />
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(categoryNames) as PlaceableBuildingDefinition['category'][]).map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-2">
                <ScrollArea className="h-48">
                  <div className="grid grid-cols-2 gap-2">
                    {getBuildingsForCategory(cat).map((def) => {
                      const affordable = canAfford(def.type);
                      const isSelected = selectedType === def.type;
                      const costItems = formatCost(def.cost);
                      
                      return (
                        <button
                          key={def.type}
                          onClick={() => onSelectType(def.type)}
                          disabled={!affordable}
                          className={`
                            p-2 rounded-lg text-left transition-all
                            ${isSelected 
                              ? 'bg-amber-600 border-2 border-amber-300' 
                              : 'bg-amber-800/50 border border-amber-700 hover:bg-amber-700/50'
                            }
                            ${!affordable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                          data-testid={`button-select-${def.type}`}
                        >
                          <div className="text-amber-100 text-sm font-medium truncate">
                            {def.name}
                          </div>
                          <div className="text-amber-300/80 text-xs mt-1 flex items-center gap-1 flex-wrap">
                            {costItems.map((item, i) => (
                              <span key={i} className="flex items-center gap-0.5">
                                {item.icon}{item.amount}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>

          <div className="text-xs text-amber-300/60 text-center space-y-1">
            <div><kbd className="px-1 bg-amber-800 rounded">B</kbd> Toggle Build Mode</div>
            <div><kbd className="px-1 bg-amber-800 rounded">R</kbd> Rotate | <kbd className="px-1 bg-amber-800 rounded">X</kbd> Build/Delete</div>
            <div><kbd className="px-1 bg-amber-800 rounded">[</kbd> <kbd className="px-1 bg-amber-800 rounded">]</kbd> Change Level</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BuildHammerPrompt({ onPress }: { onPress: () => void }) {
  return (
    <div 
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      data-testid="build-hammer-prompt"
    >
      <div className="bg-amber-900/90 border-2 border-amber-600 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
        <Hammer className="w-4 h-4 text-amber-300" />
        <span className="text-amber-100 text-sm">
          Press <kbd className="px-1.5 py-0.5 bg-amber-700 rounded text-amber-200 font-mono">B</kbd> to build
        </span>
      </div>
    </div>
  );
}
