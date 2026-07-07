import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sun, Moon, Cloud, CloudRain, CloudLightning, Wind, 
  Compass, Clock, Droplets, Sparkles, Waves
} from 'lucide-react';
import type { WeatherState, TimeOfDay } from '@/lib/weatherSystem';

interface WeatherPanelProps {
  weatherState: WeatherState;
  timeOfDay: TimeOfDay;
  windDirection: number;
  windStrength: number;
  onWeatherChange: (state: WeatherState) => void;
  onTimeChange: (time: TimeOfDay) => void;
  onWindDirectionChange: (dir: number) => void;
  onWindStrengthChange: (strength: number) => void;
  dayProgress: number;
  stormIntensity: number;
  waveHeight: number;
  visibility: number;
}

const WEATHER_OPTIONS: { value: WeatherState; label: string; icon: typeof Sun }[] = [
  { value: 'clear', label: 'Clear Skies', icon: Sun },
  { value: 'partly_cloudy', label: 'Partly Cloudy', icon: Cloud },
  { value: 'cloudy', label: 'Overcast', icon: Cloud },
  { value: 'light_rain', label: 'Light Rain', icon: Droplets },
  { value: 'rain', label: 'Rain', icon: CloudRain },
  { value: 'heavy_rain', label: 'Heavy Rain', icon: CloudRain },
  { value: 'storm', label: 'Storm', icon: CloudLightning },
  { value: 'hurricane', label: 'Hurricane', icon: CloudLightning },
];

const TIME_OPTIONS: { value: TimeOfDay; label: string; icon: typeof Sun }[] = [
  { value: 'dawn', label: 'Dawn', icon: Sun },
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'noon', label: 'Noon', icon: Sun },
  { value: 'afternoon', label: 'Afternoon', icon: Sun },
  { value: 'dusk', label: 'Dusk', icon: Moon },
  { value: 'night', label: 'Night', icon: Moon },
  { value: 'midnight', label: 'Midnight', icon: Moon },
];

export function WeatherPanel({
  weatherState,
  timeOfDay,
  windDirection,
  windStrength,
  onWeatherChange,
  onTimeChange,
  onWindDirectionChange,
  onWindStrengthChange,
  dayProgress,
  stormIntensity,
  waveHeight,
  visibility,
}: WeatherPanelProps) {
  const getCompassDirection = (degrees: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(degrees / 45) % 8];
  };

  const getBeaufortScale = (strength: number) => {
    if (strength < 1) return 'Calm';
    if (strength < 4) return 'Light';
    if (strength < 7) return 'Gentle';
    if (strength < 11) return 'Moderate';
    if (strength < 17) return 'Fresh';
    if (strength < 22) return 'Strong';
    if (strength < 28) return 'Near Gale';
    if (strength < 34) return 'Gale';
    if (strength < 41) return 'Strong Gale';
    if (strength < 48) return 'Storm';
    return 'Hurricane';
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          Weather Condition
        </Label>
        <Select value={weatherState} onValueChange={(v) => onWeatherChange(v as WeatherState)}>
          <SelectTrigger data-testid="select-weather">
            <SelectValue placeholder="Select weather" />
          </SelectTrigger>
          <SelectContent>
            {WEATHER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`weather-${opt.value}`}>
                <div className="flex items-center gap-2">
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Time of Day
        </Label>
        <Select value={timeOfDay} onValueChange={(v) => onTimeChange(v as TimeOfDay)}>
          <SelectTrigger data-testid="select-time">
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`time-${opt.value}`}>
                <div className="flex items-center gap-2">
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Compass className="w-4 h-4" />
            Wind Direction
          </Label>
          <Badge variant="secondary">
            {windDirection}° {getCompassDirection(windDirection)}
          </Badge>
        </div>
        <Slider
          value={[windDirection]}
          onValueChange={([val]) => onWindDirectionChange(val)}
          max={360}
          step={15}
          data-testid="slider-weather-wind-dir"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Wind className="w-4 h-4" />
            Wind Strength
          </Label>
          <Badge variant="secondary">{getBeaufortScale(windStrength)}</Badge>
        </div>
        <Slider
          value={[windStrength]}
          onValueChange={([val]) => onWindStrengthChange(val)}
          max={50}
          step={1}
          data-testid="slider-weather-wind-strength"
        />
      </div>

      <Separator />

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <Waves className="w-3 h-3" />
            Wave Height
          </span>
          <span>{waveHeight.toFixed(1)}m</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <CloudLightning className="w-3 h-3" />
            Storm Intensity
          </span>
          <span>{Math.round(stormIntensity * 100)}%</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Visibility
          </span>
          <span>{Math.round(visibility * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

export function WeatherHUD({
  weatherState,
  timeOfDay,
  windDirection,
  windStrength,
  waveHeight,
}: {
  weatherState: WeatherState;
  timeOfDay: TimeOfDay;
  windDirection: number;
  windStrength: number;
  waveHeight: number;
}) {
  const getWeatherIcon = () => {
    switch (weatherState) {
      case 'clear':
      case 'partly_cloudy':
        return timeOfDay === 'night' || timeOfDay === 'midnight' ? Moon : Sun;
      case 'cloudy':
        return Cloud;
      case 'light_rain':
      case 'rain':
      case 'heavy_rain':
        return CloudRain;
      case 'storm':
      case 'hurricane':
        return CloudLightning;
      default:
        return Sun;
    }
  };

  const WeatherIcon = getWeatherIcon();
  const compassDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const compassDir = compassDirs[Math.round(windDirection / 45) % 8];

  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/50" data-testid="weather-hud">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <WeatherIcon className="w-5 h-5 text-primary" />
          <span className="font-medium capitalize">{weatherState.replace('_', ' ')}</span>
          <span className="text-muted-foreground">|</span>
          <span className="capitalize">{timeOfDay}</span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Wind className="w-3 h-3" />
            <span>{windStrength} kts {compassDir}</span>
          </div>
          <div className="flex items-center gap-1">
            <Waves className="w-3 h-3" />
            <span>{waveHeight.toFixed(1)}m</span>
          </div>
        </div>

        <div 
          className="relative w-16 h-16 mx-auto"
          style={{
            transform: `rotate(${windDirection}deg)`
          }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-primary" />
          </div>
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold" style={{ transform: `rotate(-${windDirection}deg)` }}>N</span>
        </div>
      </CardContent>
    </Card>
  );
}
