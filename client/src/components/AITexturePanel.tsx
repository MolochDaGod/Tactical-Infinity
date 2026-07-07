import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, Image, Download, AlertCircle } from 'lucide-react';
import {
  loadPuterAI,
  isPuterAvailable,
  generateShipTexture,
  generateDamageOverlay,
  type ShipTextureRequest,
  type DamageTextureRequest,
} from '@/lib/puterAI';

interface AITexturePanelProps {
  onTextureGenerated?: (texture: HTMLImageElement, type: string) => void;
}

const SHIP_PARTS = [
  { value: 'hull', label: 'Hull' },
  { value: 'deck', label: 'Deck' },
  { value: 'sail', label: 'Sail' },
  { value: 'mast', label: 'Mast' },
  { value: 'cannon', label: 'Cannon' },
] as const;

const MATERIALS = [
  { value: 'wood', label: 'Wood' },
  { value: 'metal', label: 'Metal' },
  { value: 'cloth', label: 'Cloth' },
  { value: 'rope', label: 'Rope' },
] as const;

const CONDITIONS = [
  { value: 'pristine', label: 'Pristine', color: 'text-green-500' },
  { value: 'weathered', label: 'Weathered', color: 'text-yellow-500' },
  { value: 'battle_damaged', label: 'Battle Damaged', color: 'text-orange-500' },
  { value: 'burning', label: 'Burning', color: 'text-red-500' },
  { value: 'ghost', label: 'Ghost', color: 'text-blue-400' },
] as const;

const DAMAGE_TYPES = [
  { value: 'cannon_hit', label: 'Cannon Hit' },
  { value: 'fire_damage', label: 'Fire Damage' },
  { value: 'water_damage', label: 'Water Damage' },
  { value: 'age_wear', label: 'Age & Wear' },
] as const;

const COLORS = [
  { name: 'Natural', color: undefined },
  { name: 'Dark Oak', color: 'dark brown' },
  { name: 'Mahogany', color: 'reddish brown' },
  { name: 'Ebony', color: 'black' },
  { name: 'Ghost Blue', color: 'ethereal blue' },
  { name: 'Blood Red', color: 'deep crimson' },
  { name: 'Royal Purple', color: 'royal purple' },
  { name: 'Sea Green', color: 'sea green' },
];

export function AITexturePanel({ onTextureGenerated }: AITexturePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [puterStatus, setPuterStatus] = useState<'unknown' | 'loading' | 'ready' | 'error'>('unknown');
  const [generatedTextures, setGeneratedTextures] = useState<{image: HTMLImageElement, type: string}[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [partType, setPartType] = useState<ShipTextureRequest['partType']>('hull');
  const [material, setMaterial] = useState<ShipTextureRequest['material']>('wood');
  const [condition, setCondition] = useState<ShipTextureRequest['condition']>('weathered');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

  const [damageType, setDamageType] = useState<DamageTextureRequest['damageType']>('cannon_hit');
  const [damageSeverity, setDamageSeverity] = useState<DamageTextureRequest['severity']>('medium');
  const [damageMaterial, setDamageMaterial] = useState<DamageTextureRequest['material']>('wood');

  const initializePuter = async () => {
    setPuterStatus('loading');
    const success = await loadPuterAI();
    setPuterStatus(success ? 'ready' : 'error');
  };

  const generateTexture = async () => {
    if (!isPuterAvailable()) {
      setError('Puter.ai is not loaded. Click Initialize to load it first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: ShipTextureRequest = {
        partType,
        material,
        condition,
        color: selectedColor,
      };

      const image = await generateShipTexture(request);
      
      if (image) {
        const textureInfo = { image, type: `${condition} ${material} ${partType}` };
        setGeneratedTextures(prev => [...prev.slice(-2), textureInfo]);
        onTextureGenerated?.(image, textureInfo.type);
      } else {
        setError('Failed to generate texture. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during texture generation.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateDamage = async () => {
    if (!isPuterAvailable()) {
      setError('Puter.ai is not loaded. Click Initialize to load it first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: DamageTextureRequest = {
        damageType,
        severity: damageSeverity,
        material: damageMaterial,
      };

      const image = await generateDamageOverlay(request);
      
      if (image) {
        const textureInfo = { image, type: `${damageSeverity} ${damageType}` };
        setGeneratedTextures(prev => [...prev.slice(-2), textureInfo]);
        onTextureGenerated?.(image, textureInfo.type);
      } else {
        setError('Failed to generate damage overlay. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during damage generation.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm p-3 bg-muted/50 rounded-md">
        <Sparkles className="w-4 h-4 text-primary" />
        <div>
          <div className="font-medium">AI Texture Generation</div>
          <div className="text-muted-foreground text-xs">
            Powered by Puter.ai - Free, no API keys needed
          </div>
        </div>
      </div>

      {puterStatus === 'unknown' && (
        <Button onClick={initializePuter} className="w-full" data-testid="button-init-puter">
          <Sparkles className="w-4 h-4 mr-2" />
          Initialize AI
        </Button>
      )}

      {puterStatus === 'loading' && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span>Loading Puter.ai...</span>
        </div>
      )}

      {puterStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load AI service</span>
        </div>
      )}

      {puterStatus === 'ready' && (
        <>
          <div className="space-y-3">
            <Label>Ship Part</Label>
            <Select value={partType} onValueChange={(v) => setPartType(v as ShipTextureRequest['partType'])}>
              <SelectTrigger data-testid="select-part-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIP_PARTS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Material</Label>
            <Select value={material} onValueChange={(v) => setMaterial(v as ShipTextureRequest['material'])}>
              <SelectTrigger data-testid="select-material">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIALS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as ShipTextureRequest['condition'])}>
              <SelectTrigger data-testid="select-condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className={c.color}>{c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Color Tint</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  className={`text-xs p-2 rounded-md border-2 transition-all ${
                    selectedColor === c.color ? 'border-primary' : 'border-transparent bg-muted/50'
                  }`}
                  onClick={() => setSelectedColor(c.color)}
                  title={c.name}
                  data-testid={`color-tint-${c.name}`}
                >
                  {c.name.slice(0, 6)}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={generateTexture}
            disabled={isLoading}
            className="w-full"
            data-testid="button-generate-texture"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Image className="w-4 h-4 mr-2" />
                Generate Texture
              </>
            )}
          </Button>

          <Separator />

          <div className="space-y-3">
            <Label>Damage Overlay</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={damageType} onValueChange={(v) => setDamageType(v as DamageTextureRequest['damageType'])}>
                <SelectTrigger data-testid="select-damage-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_TYPES.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={damageSeverity} onValueChange={(v) => setDamageSeverity(v as DamageTextureRequest['severity'])}>
                <SelectTrigger data-testid="select-damage-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateDamage}
              disabled={isLoading}
              variant="outline"
              className="w-full"
              data-testid="button-generate-damage"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Damage Overlay'
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {generatedTextures.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Generated Textures</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {generatedTextures.map((t, idx) => (
                    <div key={idx} className="flex-shrink-0 relative group">
                      <img
                        src={t.image.src}
                        alt={t.type}
                        className="w-16 h-16 rounded-md object-cover border border-border"
                      />
                      <Badge variant="secondary" className="absolute -bottom-1 -right-1 text-[10px]">
                        {idx + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
