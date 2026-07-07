import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Anchor, Ship, Crosshair, Sparkles, Wind, Loader2, User } from 'lucide-react';
import { SHIP_TYPES } from '@shared/gameDefinitions/sailing';
import { SHIP_PREFAB_CONFIGS } from '@/lib/shipPrefabs';
import { useMeshyModels, useShipTypes } from '@/hooks/useMeshyModels';
import { CharacterAnimationPanel, type AnimationMapping } from './CharacterAnimationPanel';
import type { Race } from '@shared/schema';

interface ShipTestingPanelProps {
  currentShipType: string;
  onSelectShip: (shipType: string) => void;
  onFireCannons: () => void;
  onSetSailDeployment: (deployment: number) => void;
  sailDeployment: number;
  onLoadMeshyShip?: (glbUrl: string, shipType: string) => Promise<{ success: boolean; parts: string[]; error?: string }>;
  captainRace?: Race;
  onCycleCaptainRace?: () => void;
  useMeshyCharacter?: boolean;
  onToggleMeshyCharacter?: () => void;
  onAnimationMappingsChange?: (mappings: AnimationMapping[]) => void;
}

const SHIP_ORDER = ['raft', 'skiff', 'sloop', 'brigantine', 'galleon'];

const RACE_NAMES: Record<Race, string> = {
  human: 'Human',
  barbarian: 'Barbarian',
  dwarf: 'Dwarf',
  elf: 'Elf',
  orc: 'Orc',
  undead: 'Undead',
};

export function ShipTestingPanel({
  currentShipType,
  onSelectShip,
  onFireCannons,
  onSetSailDeployment,
  sailDeployment,
  onLoadMeshyShip,
  captainRace,
  onCycleCaptainRace,
  useMeshyCharacter,
  onToggleMeshyCharacter,
  onAnimationMappingsChange,
}: ShipTestingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadedParts, setLoadedParts] = useState<string[]>([]);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { shipTypes } = useShipTypes();
  const {
    isConfigured: meshyConfigured,
    isLoading: meshyLoading,
    error: meshyError,
    progress: meshyProgress,
    modelUrl,
    generateShipModel,
    cancelPolling,
  } = useMeshyModels();

  const handleGenerateMeshyShip = async (shipType: string) => {
    setLoadedParts([]);
    setLoadError(null);
    await generateShipModel(shipType);
  };

  const handleLoadMeshyModel = async () => {
    if (!modelUrl || !onLoadMeshyShip) return;
    
    setIsLoadingModel(true);
    setLoadError(null);
    
    try {
      const result = await onLoadMeshyShip(modelUrl, currentShipType);
      if (result.success) {
        setLoadedParts(result.parts);
      } else {
        setLoadError(result.error || 'Failed to load model');
      }
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setIsLoadingModel(false);
    }
  };

  return (
    <Card className="absolute top-60 right-4 w-80 bg-background/95 backdrop-blur-sm z-50">
      <CardHeader 
        className="pb-2 cursor-pointer flex flex-row items-center justify-between gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm flex items-center gap-2">
          <Ship className="w-4 h-4" />
          Ship Testing
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {SHIP_TYPES[currentShipType]?.name || currentShipType}
        </Badge>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Select Ship Type</p>
            <div className="grid grid-cols-5 gap-1">
              {SHIP_ORDER.map((shipType) => {
                const ship = SHIP_TYPES[shipType];
                const config = SHIP_PREFAB_CONFIGS[shipType];
                if (!ship || !config) return null;
                
                return (
                  <Button
                    key={shipType}
                    size="sm"
                    variant={currentShipType === shipType ? 'default' : 'outline'}
                    className="p-1 h-auto flex flex-col items-center gap-1"
                    onClick={() => onSelectShip(shipType)}
                    data-testid={`button-select-ship-${shipType}`}
                  >
                    <Anchor className="w-3 h-3" />
                    <span className="text-[10px]">T{ship.tier}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Sail Deployment</p>
              <span className="text-xs font-mono">{sailDeployment}%</span>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetSailDeployment(0)}
                data-testid="button-sail-0"
              >
                0%
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetSailDeployment(50)}
                data-testid="button-sail-50"
              >
                50%
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetSailDeployment(100)}
                data-testid="button-sail-100"
              >
                100%
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Current Ship Stats</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-muted-foreground" />
                <span>Cannons: {SHIP_TYPES[currentShipType]?.cannons || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Wind className="w-3 h-3 text-muted-foreground" />
                <span>Speed: {SHIP_TYPES[currentShipType]?.speed || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={onFireCannons}
              disabled={(SHIP_TYPES[currentShipType]?.cannons || 0) === 0}
              data-testid="button-fire-cannons"
            >
              <Crosshair className="w-4 h-4 mr-1" />
              Fire Cannons
            </Button>
          </div>

          {(onCycleCaptainRace || onToggleMeshyCharacter) && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-primary" />
                <p className="text-xs text-muted-foreground">Character (Tab to enter chase mode)</p>
              </div>
              
              {onToggleMeshyCharacter && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={useMeshyCharacter ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={onToggleMeshyCharacter}
                    data-testid="button-toggle-meshy-character"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    {useMeshyCharacter ? 'Meshy AI Character' : 'Race Captain'}
                  </Button>
                </div>
              )}
              
              {!useMeshyCharacter && onCycleCaptainRace && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={onCycleCaptainRace}
                    data-testid="button-cycle-captain-race"
                  >
                    <User className="w-4 h-4 mr-1" />
                    {captainRace ? RACE_NAMES[captainRace] : 'Human'}
                  </Button>
                  <Badge variant="secondary" className="text-xs">
                    Press R
                  </Badge>
                </div>
              )}
            </div>
          )}

          {meshyConfigured && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                <p className="text-xs text-muted-foreground">Meshy AI Ship Generation</p>
              </div>
              
              {meshyLoading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Generating 3D model...</span>
                  </div>
                  <Progress value={meshyProgress} className="h-2" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelPolling}
                    data-testid="button-cancel-meshy"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleGenerateMeshyShip(currentShipType)}
                  data-testid="button-generate-meshy-ship"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate {SHIP_TYPES[currentShipType]?.name}
                </Button>
              )}
              
              {meshyError && (
                <p className="text-xs text-destructive">{meshyError}</p>
              )}
              
              {modelUrl && !loadedParts.length && (
                <div className="space-y-2">
                  <p className="text-xs text-green-600">Model ready!</p>
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={handleLoadMeshyModel}
                    disabled={isLoadingModel}
                    data-testid="button-load-meshy-ship"
                  >
                    {isLoadingModel ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Ship className="w-4 h-4 mr-1" />
                        Load on Ship
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {loadError && (
                <p className="text-xs text-destructive">{loadError}</p>
              )}
              
              {loadedParts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-600">Ship Parts Loaded:</p>
                  <div className="max-h-24 overflow-y-auto space-y-0.5">
                    {loadedParts.map((part, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] mr-1">
                        {part}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <CharacterAnimationPanel 
            onAnimationMappingsChange={onAnimationMappingsChange}
          />
        </CardContent>
      )}
    </Card>
  );
}

export default ShipTestingPanel;
