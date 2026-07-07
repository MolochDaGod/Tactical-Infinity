import { useCallback, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, MapPin, Ship, Anchor, Skull, Crown, Store, Swords, Users, Gem, TreePine, Mountain, Fish, Compass, Flag, Target } from 'lucide-react';
import { WORLD_ISLANDS, WORLD_ENEMY_SHIPS, type WorldIslandData, type EnemyShipData } from '@/lib/worldMapData';

interface WorldMapOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  playerPosition: { x: number; z: number };
  playerRotation: number;
}

interface MapMarker {
  id: string;
  name: string;
  x: number;
  z: number;
  type: 'island' | 'ship' | 'player' | 'poi' | 'boss' | 'trading';
  faction?: string;
  tier?: number;
  hostility?: string;
  description?: string;
}

const FACTION_COLORS: Record<string, string> = {
  crusade: '#c9a227',
  fabled: '#4a9eff',
  legion: '#e53935',
  neutral: '#888888',
  contested: '#9c27b0'
};

const WORLD_SIZE = 9000;
const MAP_SIZE = 600;

export function WorldMapOverlay({ isOpen, onClose, playerPosition, playerRotation }: WorldMapOverlayProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapFilter, setMapFilter] = useState<'all' | 'islands' | 'ships' | 'trading' | 'hostile'>('all');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const worldToMapCoord = useCallback((worldX: number, worldZ: number) => {
    const scale = MAP_SIZE / WORLD_SIZE;
    return {
      x: (worldX + WORLD_SIZE / 2) * scale * zoom + panOffset.x,
      y: (worldZ + WORLD_SIZE / 2) * scale * zoom + panOffset.y
    };
  }, [zoom, panOffset]);

  const markers = useMemo(() => {
    const result: MapMarker[] = [];

    for (const island of WORLD_ISLANDS) {
      if (mapFilter === 'trading' && !island.hasTradingPost) continue;
      if (mapFilter === 'hostile' && island.hostility === 'friendly') continue;
      if (mapFilter === 'ships') continue;

      result.push({
        id: island.id,
        name: island.name,
        x: island.position.x,
        z: island.position.z,
        type: island.hasTradingPost ? 'trading' : island.enemyConfig?.bossType ? 'boss' : 'island',
        faction: island.faction,
        tier: island.tier,
        hostility: island.hostility,
        description: island.description
      });
    }

    if (mapFilter === 'all' || mapFilter === 'ships') {
      for (const ship of WORLD_ENEMY_SHIPS) {
        result.push({
          id: ship.id,
          name: ship.name,
          x: ship.patrolCenter.x,
          z: ship.patrolCenter.z,
          type: 'ship',
          faction: ship.faction,
          tier: ship.level
        });
      }
    }

    return result;
  }, [mapFilter]);

  const getMarkerIcon = (marker: MapMarker) => {
    switch (marker.type) {
      case 'trading': return <Store className="w-3 h-3" />;
      case 'boss': return <Skull className="w-3 h-3" />;
      case 'ship': return <Ship className="w-3 h-3" />;
      case 'poi': return <Gem className="w-3 h-3" />;
      default: return <MapPin className="w-3 h-3" />;
    }
  };

  const getMarkerColor = (marker: MapMarker) => {
    if (marker.hostility === 'hostile') return '#e53935';
    if (marker.hostility === 'contested') return '#ff9800';
    return FACTION_COLORS[marker.faction || 'neutral'] || '#888888';
  };

  const playerMapPos = worldToMapCoord(playerPosition.x, playerPosition.z);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      data-testid="world-map-overlay"
    >
      <Card 
        className="relative w-[700px] h-[700px] bg-background/95 border-2 border-primary/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            <span className="font-cinzel text-lg text-foreground">Aethermoor World Map</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Target className="w-3 h-3 mr-1" />
              {Math.round(playerPosition.x)}, {Math.round(playerPosition.z)}
            </Badge>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-map">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="absolute top-12 left-2 z-10 flex flex-col gap-1">
          {(['all', 'islands', 'ships', 'trading', 'hostile'] as const).map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={mapFilter === filter ? 'default' : 'outline'}
              className="text-xs capitalize"
              onClick={() => setMapFilter(filter)}
              data-testid={`button-filter-${filter}`}
            >
              {filter}
            </Button>
          ))}
        </div>

        <div className="absolute top-12 right-2 z-10 flex flex-col gap-1">
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(2, z + 0.25))} data-testid="button-zoom-in">+</Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} data-testid="button-zoom-out">-</Button>
          <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} data-testid="button-zoom-reset">R</Button>
        </div>

        <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FACTION_COLORS.crusade }} />
            <span className="text-muted-foreground">Crusade</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FACTION_COLORS.fabled }} />
            <span className="text-muted-foreground">Fabled</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FACTION_COLORS.legion }} />
            <span className="text-muted-foreground">Legion</span>
          </div>
        </div>

        <svg 
          width={MAP_SIZE} 
          height={MAP_SIZE} 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ transform: `translate(-50%, -50%) scale(${zoom})` }}
        >
          <defs>
            <radialGradient id="oceanGradient">
              <stop offset="0%" stopColor="#0a2a4a" />
              <stop offset="100%" stopColor="#051525" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <rect width={MAP_SIZE} height={MAP_SIZE} fill="url(#oceanGradient)" />

          <g opacity={0.3}>
            {Array.from({ length: 10 }).map((_, i) => (
              <line
                key={`grid-h-${i}`}
                x1={0}
                y1={(i + 1) * (MAP_SIZE / 10)}
                x2={MAP_SIZE}
                y2={(i + 1) * (MAP_SIZE / 10)}
                stroke="#1a3a5a"
                strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <line
                key={`grid-v-${i}`}
                x1={(i + 1) * (MAP_SIZE / 10)}
                y1={0}
                x2={(i + 1) * (MAP_SIZE / 10)}
                y2={MAP_SIZE}
                stroke="#1a3a5a"
                strokeWidth={0.5}
              />
            ))}
          </g>

          {markers.map((marker) => {
            const pos = worldToMapCoord(marker.x, marker.z);
            const color = getMarkerColor(marker);
            const isSelected = selectedMarker?.id === marker.id;
            const size = marker.type === 'island' ? (marker.tier || 1) * 4 + 4 : 6;

            return (
              <g
                key={marker.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedMarker(isSelected ? null : marker)}
              >
                <circle
                  r={size}
                  fill={color}
                  opacity={0.8}
                  stroke={isSelected ? '#ffffff' : color}
                  strokeWidth={isSelected ? 2 : 1}
                  filter={isSelected ? 'url(#glow)' : undefined}
                />
                {marker.type === 'trading' && (
                  <circle r={size + 3} fill="none" stroke="#ffd700" strokeWidth={1} strokeDasharray="2,2" />
                )}
                {marker.type === 'boss' && (
                  <circle r={size + 4} fill="none" stroke="#e53935" strokeWidth={1.5} opacity={0.6}>
                    <animate attributeName="r" values={`${size + 2};${size + 6};${size + 2}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}

          <g transform={`translate(${playerMapPos.x}, ${playerMapPos.y})`}>
            <circle r={8} fill="#22c55e" opacity={0.3}>
              <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
            <polygon
              points="0,-8 5,6 -5,6"
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth={1}
              transform={`rotate(${(playerRotation * 180 / Math.PI) + 180})`}
            />
          </g>
        </svg>

        {selectedMarker && (
          <Card className="absolute bottom-2 right-2 w-64 p-3 z-20 bg-background/95">
            <div className="flex items-center justify-between mb-2">
              <span className="font-cinzel text-sm font-medium">{selectedMarker.name}</span>
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: getMarkerColor(selectedMarker) }}
              >
                T{selectedMarker.tier || 1}
              </Badge>
            </div>
            {selectedMarker.faction && (
              <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <Flag className="w-3 h-3" style={{ color: FACTION_COLORS[selectedMarker.faction] }} />
                <span className="capitalize">{selectedMarker.faction}</span>
              </div>
            )}
            {selectedMarker.hostility && (
              <div className="flex items-center gap-2 mb-1 text-xs">
                {selectedMarker.hostility === 'hostile' && <Swords className="w-3 h-3 text-red-500" />}
                {selectedMarker.hostility === 'contested' && <Users className="w-3 h-3 text-orange-500" />}
                {selectedMarker.hostility === 'friendly' && <Anchor className="w-3 h-3 text-green-500" />}
                <span className="capitalize text-muted-foreground">{selectedMarker.hostility}</span>
              </div>
            )}
            {selectedMarker.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{selectedMarker.description}</p>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              Distance: {Math.round(Math.sqrt(
                Math.pow(selectedMarker.x - playerPosition.x, 2) + 
                Math.pow(selectedMarker.z - playerPosition.z, 2)
              ))}m
            </div>
          </Card>
        )}

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
          <kbd className="px-1 bg-muted rounded">Esc</kbd> or click outside to close
        </div>
      </Card>
    </div>
  );
}
