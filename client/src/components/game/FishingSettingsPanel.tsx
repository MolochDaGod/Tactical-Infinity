import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Fish, Settings, ChevronDown, Palette, Waves } from 'lucide-react';
import { 
  FISH_BEHAVIORS, 
  LURE_TYPES, 
  type FishBehavior,
  type LureDefinition 
} from '@shared/gameDefinitions/fishing';
import { OCEAN_PRESETS, DEFAULT_FISHING_CONFIG, type FishingConfig } from '@shared/gameDefinitions/oceanConfig';

interface FishingSettingsPanelProps {
  onOceanPresetChange?: (presetId: string) => void;
  currentOceanPreset?: string;
  availablePresets?: string[];
}

export function FishingSettingsPanel({
  onOceanPresetChange,
  currentOceanPreset = 'caribbean',
  availablePresets = Object.keys(OCEAN_PRESETS),
}: FishingSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFishList, setShowFishList] = useState(false);
  const [showLureList, setShowLureList] = useState(false);
  const [config, setConfig] = useState<FishingConfig>(DEFAULT_FISHING_CONFIG);
  
  const updateConfig = (key: keyof FishingConfig, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const fishList = Object.values(FISH_BEHAVIORS);
  const lureList = Object.values(LURE_TYPES);
  
  const getSkittishnessColor = (skittishness: string) => {
    switch (skittishness) {
      case 'bold': return 'bg-green-600';
      case 'curious': return 'bg-blue-500';
      case 'cautious': return 'bg-yellow-500';
      case 'timid': return 'bg-orange-500';
      case 'paranoid': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  return (
    <Card className="absolute top-60 left-4 w-80 bg-background/95 backdrop-blur-sm z-50 max-h-[70vh] overflow-hidden">
      <CardHeader 
        className="py-2 px-3 cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm flex items-center gap-2">
          <Fish className="w-4 h-4 text-primary" />
          Fishing & Ocean
        </CardTitle>
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="py-2 px-3 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Waves className="w-3 h-3 text-blue-400" />
              <Label className="text-xs font-medium">Ocean Style</Label>
            </div>
            <Select 
              value={currentOceanPreset} 
              onValueChange={(value) => onOceanPresetChange?.(value)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-ocean-preset">
                <SelectValue placeholder="Select ocean style" />
              </SelectTrigger>
              <SelectContent>
                {availablePresets.map((presetId) => (
                  <SelectItem key={presetId} value={presetId}>
                    {OCEAN_PRESETS[presetId]?.name || presetId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {OCEAN_PRESETS[currentOceanPreset] && (
              <div className="flex gap-1 flex-wrap">
                <div 
                  className="w-6 h-6 rounded border" 
                  style={{ backgroundColor: '#' + OCEAN_PRESETS[currentOceanPreset].waterColor.toString(16).padStart(6, '0') }}
                  title="Water Color"
                />
                <div 
                  className="w-6 h-6 rounded border" 
                  style={{ backgroundColor: '#' + OCEAN_PRESETS[currentOceanPreset].waterColorDeep.toString(16).padStart(6, '0') }}
                  title="Deep Water Color"
                />
                <div 
                  className="w-6 h-6 rounded border" 
                  style={{ backgroundColor: '#' + OCEAN_PRESETS[currentOceanPreset].fogColor.toString(16).padStart(6, '0') }}
                  title="Fog Color"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <Settings className="w-3 h-3" />
              <Label className="text-xs font-medium">Fishing Settings</Label>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cast Distance</Label>
                <span className="text-xs text-muted-foreground">{config.rodCastDistance}m</span>
              </div>
              <Slider
                value={[config.rodCastDistance]}
                onValueChange={([v]) => updateConfig('rodCastDistance', v)}
                min={10}
                max={60}
                step={5}
                className="h-4"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Difficulty</Label>
                <span className="text-xs text-muted-foreground">{config.catchDifficulty.toFixed(1)}x</span>
              </div>
              <Slider
                value={[config.catchDifficulty * 10]}
                onValueChange={([v]) => updateConfig('catchDifficulty', v / 10)}
                min={5}
                max={20}
                step={1}
                className="h-4"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Reel Speed</Label>
                <span className="text-xs text-muted-foreground">{config.reelSpeed.toFixed(1)}x</span>
              </div>
              <Slider
                value={[config.reelSpeed * 10]}
                onValueChange={([v]) => updateConfig('reelSpeed', v / 10)}
                min={5}
                max={20}
                step={1}
                className="h-4"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Fish Names</Label>
              <Switch
                checked={config.showFishNames}
                onCheckedChange={(v) => updateConfig('showFishNames', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Highlight Nearby Fish</Label>
              <Switch
                checked={config.highlightNearbyFish}
                onCheckedChange={(v) => updateConfig('highlightNearbyFish', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto Reel</Label>
              <Switch
                checked={config.autoReel}
                onCheckedChange={(v) => updateConfig('autoReel', v)}
              />
            </div>
          </div>

          <Collapsible open={showFishList} onOpenChange={setShowFishList}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 border-t pt-3">
              <span className="text-xs font-medium flex items-center gap-1">
                <Fish className="w-3 h-3" />
                Fish Species ({fishList.length})
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showFishList ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {fishList.map((fish) => (
                <div 
                  key={fish.name} 
                  className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs"
                >
                  <span className="font-medium">{fish.name}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] ${getSkittishnessColor(fish.skittishness)} text-white`}
                  >
                    {fish.skittishness}
                  </Badge>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showLureList} onOpenChange={setShowLureList}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 border-t pt-3">
              <span className="text-xs font-medium flex items-center gap-1">
                <Palette className="w-3 h-3" />
                Lure Types ({lureList.length})
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showLureList ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {lureList.map((lure) => (
                <div 
                  key={lure.id} 
                  className="p-1.5 rounded bg-muted/50 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{lure.name}</span>
                    <Badge variant="outline" className="text-[10px]">T{lure.tier}</Badge>
                  </div>
                  <p className="text-muted-foreground text-[10px]">{lure.description}</p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
