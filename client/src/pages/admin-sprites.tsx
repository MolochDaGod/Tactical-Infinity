import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SpriteAnimator, SpritePreviewCard, SpriteColorTints } from '@/components/SpriteAnimator';
import { SPRITE_CHARACTERS, CharacterSprite, getAnimationCategories, getTotalAnimationCount, getTotalFrameCount } from '@/lib/spriteManifest';
import { ArrowLeft, Play, Pause, Grid3X3, LayoutGrid, Sword, Sparkles, Target, Bug, Palette, RotateCcw } from 'lucide-react';

type ViewMode = 'grid' | 'detail';

interface AdminSpritesPageProps {
  onBack?: () => void;
}

const COLOR_PRESETS = [
  { name: 'Default', hue: 0, saturate: 100, brightness: 100 },
  { name: 'Crusade Red', hue: 0, saturate: 140, brightness: 100 },
  { name: 'Fabled Blue', hue: 200, saturate: 120, brightness: 105 },
  { name: 'Legion Green', hue: 90, saturate: 130, brightness: 95 },
  { name: 'Royal Purple', hue: 270, saturate: 120, brightness: 100 },
  { name: 'Elite Gold', hue: 40, saturate: 150, brightness: 115 },
  { name: 'Shadow', hue: 0, saturate: 60, brightness: 55 },
  { name: 'Ghost', hue: 180, saturate: 40, brightness: 140 },
  { name: 'Fire', hue: 20, saturate: 160, brightness: 110 },
  { name: 'Ice', hue: 190, saturate: 100, brightness: 120 },
  { name: 'Poison', hue: 100, saturate: 150, brightness: 90 },
  { name: 'Undead', hue: 60, saturate: 50, brightness: 80 },
];

export default function AdminSpritesPage({ onBack }: AdminSpritesPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSprite>(SPRITE_CHARACTERS[0]);
  const [selectedAnimation, setSelectedAnimation] = useState<string>('idle');
  const [globalAnimation, setGlobalAnimation] = useState<string>('idle');
  const [fps, setFps] = useState<number>(8);
  const [scale, setScale] = useState<number>(2);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  
  const [colorTints, setColorTints] = useState<SpriteColorTints>({
    hueRotate: 0,
    saturate: 100,
    brightness: 100,
  });
  
  const commonAnimations = ['idle', 'walk', 'attack01', 'attack02', 'attack03', 'block', 'death', 'hurt'];
  const effectAnimations = ['attack01_effect', 'attack02_effect', 'attack03_effect', 'attack_effect', 'heal_effect'];
  const allAnimationTypes = [...commonAnimations, ...effectAnimations, 'arrow', 'heal', 'walk01', 'walk02'];
  
  const categories = getAnimationCategories(selectedCharacter);
  
  const totalEffects = SPRITE_CHARACTERS.reduce((acc, c) => {
    const cats = getAnimationCategories(c);
    return acc + cats.effects.length;
  }, 0);
  
  const totalProjectiles = SPRITE_CHARACTERS.reduce((acc, c) => {
    const cats = getAnimationCategories(c);
    return acc + cats.projectiles.length;
  }, 0);
  
  const resetColors = () => {
    setColorTints({ hueRotate: 0, saturate: 100, brightness: 100 });
  };
  
  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setColorTints({
      hueRotate: preset.hue,
      saturate: preset.saturate,
      brightness: preset.brightness,
    });
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-2xl font-bold">2D Sprite Viewer</h1>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              data-testid="button-view-grid"
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'detail' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('detail')}
              data-testid="button-view-detail"
            >
              <LayoutGrid className="w-4 h-4 mr-1" />
              Detail
            </Button>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Global Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm">Character:</label>
                <Select 
                  value={selectedCharacter.id} 
                  onValueChange={(id) => {
                    const char = SPRITE_CHARACTERS.find(c => c.id === id);
                    if (char) {
                      setSelectedCharacter(char);
                      if (!char.animations[selectedAnimation]) {
                        setSelectedAnimation(Object.keys(char.animations)[0]);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-48" data-testid="select-character">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPRITE_CHARACTERS.map(char => (
                      <SelectItem key={char.id} value={char.id}>
                        {char.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                  data-testid="button-play-pause"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {isPlaying ? 'Playing' : 'Paused'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm">Animation:</label>
                <Select value={globalAnimation} onValueChange={(v) => {
                  setGlobalAnimation(v);
                  setSelectedAnimation(v);
                }}>
                  <SelectTrigger className="w-40" data-testid="select-global-animation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idle">idle</SelectItem>
                    <SelectItem value="walk">walk</SelectItem>
                    <SelectItem value="attack01">attack01</SelectItem>
                    <SelectItem value="attack02">attack02</SelectItem>
                    <SelectItem value="attack03">attack03</SelectItem>
                    <SelectItem value="block">block</SelectItem>
                    <SelectItem value="death">death</SelectItem>
                    <SelectItem value="hurt">hurt</SelectItem>
                    <SelectItem value="attack01_effect">attack01 effect</SelectItem>
                    <SelectItem value="attack02_effect">attack02 effect</SelectItem>
                    <SelectItem value="attack03_effect">attack03 effect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2 min-w-[150px]">
                <label className="text-sm whitespace-nowrap">FPS: {fps}</label>
                <Slider
                  value={[fps]}
                  onValueChange={([v]) => setFps(v)}
                  min={1}
                  max={24}
                  step={1}
                  className="w-24"
                  data-testid="slider-fps"
                />
              </div>
              
              <div className="flex items-center gap-2 min-w-[150px]">
                <label className="text-sm whitespace-nowrap">Scale: {scale}x</label>
                <Slider
                  value={[scale]}
                  onValueChange={([v]) => setScale(v)}
                  min={1}
                  max={4}
                  step={0.5}
                  className="w-24"
                  data-testid="slider-scale"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="debug-mode"
                  checked={showDebug}
                  onCheckedChange={setShowDebug}
                  data-testid="switch-debug"
                />
                <Label htmlFor="debug-mode" className="text-sm flex items-center gap-1">
                  <Bug className="w-3 h-3" />
                  Debug
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Color Customization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(preset => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="text-xs"
                    data-testid={`button-preset-${preset.name.toLowerCase()}`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full mr-1 border"
                      style={{ 
                        backgroundColor: `hsl(${preset.hue}, ${preset.saturate}%, 50%)`,
                        filter: `brightness(${preset.brightness}%)`
                      }}
                    />
                    {preset.name}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetColors}
                  className="text-xs"
                  data-testid="button-reset-colors"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Hue Rotation: {colorTints.hueRotate}°</Label>
                  <Slider
                    value={[colorTints.hueRotate || 0]}
                    onValueChange={([v]) => setColorTints(prev => ({ ...prev, hueRotate: v }))}
                    min={0}
                    max={360}
                    step={5}
                    data-testid="slider-hue"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0° (Original)</span>
                    <span>180° (Inverse)</span>
                    <span>360°</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Saturation: {colorTints.saturate}%</Label>
                  <Slider
                    value={[colorTints.saturate || 100]}
                    onValueChange={([v]) => setColorTints(prev => ({ ...prev, saturate: v }))}
                    min={0}
                    max={200}
                    step={5}
                    data-testid="slider-saturate"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0% (Gray)</span>
                    <span>100% (Normal)</span>
                    <span>200% (Vivid)</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Brightness: {colorTints.brightness}%</Label>
                  <Slider
                    value={[colorTints.brightness || 100]}
                    onValueChange={([v]) => setColorTints(prev => ({ ...prev, brightness: v }))}
                    min={20}
                    max={200}
                    step={5}
                    data-testid="slider-brightness"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>20% (Dark)</span>
                    <span>100% (Normal)</span>
                    <span>200% (Bright)</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center gap-8 p-4 bg-slate-800 rounded-lg">
                <div className="text-center">
                  <div className="mb-2">
                    <SpriteAnimator
                      character={selectedCharacter}
                      animation={selectedAnimation}
                      scale={2}
                      fps={fps}
                      playing={isPlaying}
                      showDebug={false}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Original</span>
                </div>
                <div className="text-center">
                  <div className="mb-2">
                    <SpriteAnimator
                      character={selectedCharacter}
                      animation={selectedAnimation}
                      scale={2}
                      fps={fps}
                      playing={isPlaying}
                      showDebug={false}
                      colorTints={colorTints}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">With Tint</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {SPRITE_CHARACTERS.map(character => (
              <SpritePreviewCard
                key={character.id}
                character={character}
                selectedAnimation={globalAnimation}
                onAnimationChange={setGlobalAnimation}
                showDebug={showDebug}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Select Character</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {SPRITE_CHARACTERS.map(character => (
                    <Button
                      key={character.id}
                      variant={selectedCharacter.id === character.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedCharacter(character);
                        if (!character.animations[selectedAnimation]) {
                          setSelectedAnimation(Object.keys(character.animations)[0]);
                        }
                      }}
                      className="text-xs"
                      data-testid={`button-select-${character.id}`}
                    >
                      {character.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{selectedCharacter.name} - Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <SpriteAnimator
                      character={selectedCharacter}
                      animation={selectedAnimation}
                      scale={scale}
                      fps={fps}
                      playing={isPlaying}
                      showDebug={showDebug}
                      colorTints={colorTints}
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Frame size: {selectedCharacter.animations[selectedAnimation]?.frameWidth || 100}x
                    {selectedCharacter.animations[selectedAnimation]?.frameHeight || 100}px | 
                    Frames: {selectedCharacter.animations[selectedAnimation]?.frames || 0} | 
                    Loop: {selectedCharacter.animations[selectedAnimation]?.loop ? 'Yes' : 'No'}
                    {selectedCharacter.animations[selectedAnimation]?.isEffect && ' | Type: Effect'}
                    {selectedCharacter.animations[selectedAnimation]?.isProjectile && ' | Type: Projectile'}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  Base Animations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.base.map(key => {
                    const anim = selectedCharacter.animations[key];
                    return (
                      <Button
                        key={key}
                        variant={selectedAnimation === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAnimation(key)}
                        data-testid={`button-anim-${key}`}
                      >
                        {anim.name}
                        <span className="ml-1 text-xs opacity-70">({anim.frames}f)</span>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sword className="w-4 h-4" />
                  Attack Animations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.attacks.map(key => {
                    const anim = selectedCharacter.animations[key];
                    return (
                      <Button
                        key={key}
                        variant={selectedAnimation === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAnimation(key)}
                        data-testid={`button-anim-${key}`}
                      >
                        {anim.name}
                        <span className="ml-1 text-xs opacity-70">({anim.frames}f)</span>
                      </Button>
                    );
                  })}
                  {categories.attacks.length === 0 && (
                    <span className="text-sm text-muted-foreground">No attack animations</span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Attack Effects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.effects.map(key => {
                    const anim = selectedCharacter.animations[key];
                    return (
                      <Button
                        key={key}
                        variant={selectedAnimation === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAnimation(key)}
                        data-testid={`button-anim-${key}`}
                      >
                        <Badge variant="secondary" className="mr-1 text-xs">FX</Badge>
                        {anim.name}
                      </Button>
                    );
                  })}
                  {categories.effects.length === 0 && (
                    <span className="text-sm text-muted-foreground">No effect animations</span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Projectiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.projectiles.map(key => {
                    const anim = selectedCharacter.animations[key];
                    return (
                      <Button
                        key={key}
                        variant={selectedAnimation === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAnimation(key)}
                        data-testid={`button-anim-${key}`}
                      >
                        <Badge variant="secondary" className="mr-1 text-xs">PROJ</Badge>
                        {anim.name}
                      </Button>
                    );
                  })}
                  {categories.projectiles.length === 0 && (
                    <span className="text-sm text-muted-foreground">No projectiles</span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">All Animations Gallery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {Object.entries(selectedCharacter.animations).map(([key, anim]) => (
                    <div 
                      key={key} 
                      className={`flex flex-col items-center gap-1 p-2 rounded cursor-pointer hover-elevate ${selectedAnimation === key ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedAnimation(key)}
                    >
                      <div className="bg-slate-800 p-2 rounded">
                        <SpriteAnimator
                          character={selectedCharacter}
                          animation={key}
                          scale={1}
                          fps={fps}
                          playing={isPlaying}
                          showDebug={showDebug}
                          colorTints={colorTints}
                        />
                      </div>
                      <span className="text-xs text-center">{anim.name}</span>
                      {anim.isEffect && <Badge variant="outline" className="text-[10px]">Effect</Badge>}
                      {anim.isProjectile && <Badge variant="outline" className="text-[10px]">Projectile</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Sprite Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{SPRITE_CHARACTERS.length}</div>
                <div className="text-xs text-muted-foreground">Characters</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{getTotalAnimationCount()}</div>
                <div className="text-xs text-muted-foreground">Total Animations</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">{totalEffects}</div>
                <div className="text-xs text-muted-foreground">Attack Effects</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-500">{totalProjectiles}</div>
                <div className="text-xs text-muted-foreground">Projectiles</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{getTotalFrameCount()}</div>
                <div className="text-xs text-muted-foreground">Total Frames</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
