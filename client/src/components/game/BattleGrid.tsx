import { useMemo } from "react";
import type { Tile, Unit } from "@shared/schema";
import { terrainInfo } from "@/lib/gameData";
import { AnimatedUnitSpriteWithHealth } from "./AnimatedUnitSprite";
import { CombatEffects } from "./CombatEffects";
import type { CombatEffect } from "@/hooks/useBattleAnimations";
import type { AnimationState } from "./AnimatedSprite";
import { cn } from "@/lib/utils";

interface BattleGridProps {
  tiles: Tile[];
  width: number;
  height: number;
  units: Unit[];
  selectedUnitId?: string;
  highlightedTiles?: { x: number; y: number; type: "movement" | "attack" | "ability" }[];
  unitAnimations?: Map<string, AnimationState>;
  combatEffects?: CombatEffect[];
  onTileClick: (x: number, y: number) => void;
  onUnitClick: (unit: Unit) => void;
}

export function BattleGrid({
  tiles,
  width,
  height,
  units,
  selectedUnitId,
  highlightedTiles = [],
  unitAnimations = new Map(),
  combatEffects = [],
  onTileClick,
  onUnitClick,
}: BattleGridProps) {
  const tileMap = useMemo(() => {
    const map = new Map<string, Tile>();
    tiles.forEach((tile) => {
      map.set(`${tile.x},${tile.y}`, tile);
    });
    return map;
  }, [tiles]);

  const unitMap = useMemo(() => {
    const map = new Map<string, Unit>();
    units.forEach((unit) => {
      if (unit.position) {
        map.set(`${unit.position.x},${unit.position.y}`, unit);
      }
    });
    return map;
  }, [units]);

  const highlightMap = useMemo(() => {
    const map = new Map<string, "movement" | "attack" | "ability">();
    highlightedTiles.forEach((h) => {
      map.set(`${h.x},${h.y}`, h.type);
    });
    return map;
  }, [highlightedTiles]);

  const getHighlightColor = (type: "movement" | "attack" | "ability" | undefined) => {
    switch (type) {
      case "movement":
        return "ring-2 ring-blue-400 ring-inset bg-blue-400/30";
      case "attack":
        return "ring-2 ring-red-400 ring-inset bg-red-400/30";
      case "ability":
        return "ring-2 ring-purple-400 ring-inset bg-purple-400/30";
      default:
        return "";
    }
  };

  return (
    <div className="relative overflow-auto p-4">
      <div 
        className="grid gap-0.5 mx-auto"
        style={{ 
          gridTemplateColumns: `repeat(${width}, minmax(48px, 64px))`,
          width: "fit-content"
        }}
      >
        {Array.from({ length: height }).map((_, y) =>
          Array.from({ length: width }).map((_, x) => {
            const key = `${x},${y}`;
            const tile = tileMap.get(key);
            const unit = unitMap.get(key);
            const highlightType = highlightMap.get(key);
            const terrain = tile ? terrainInfo[tile.terrain] : terrainInfo.grass;
            const isSelected = unit && unit.id === selectedUnitId;
            const unitAnimation = unit ? (unitAnimations.get(unit.id) || "idle") : "idle";
            const unitEffects = unit 
              ? combatEffects.filter(e => e.targetUnitId === unit.id)
              : [];

            return (
              <div
                key={key}
                onClick={() => {
                  if (unit) {
                    onUnitClick(unit);
                  } else {
                    onTileClick(x, y);
                  }
                }}
                className={cn(
                  "relative aspect-square cursor-pointer transition-all",
                  "border border-black/10 dark:border-white/10",
                  terrain.color,
                  getHighlightColor(highlightType),
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
                data-testid={`tile-${x}-${y}`}
              >
                {tile && tile.elevation > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                )}
                
                {unit && (
                  <div
                    className="absolute inset-0.5 flex items-center justify-center"
                    data-testid={`unit-on-grid-${unit.id}`}
                  >
                    <AnimatedUnitSpriteWithHealth 
                      unit={unit} 
                      size="md"
                      showWeapon={true}
                      showGlow={true}
                      isSelected={isSelected}
                      showHealth={true}
                      animation={unitAnimation}
                      effects={unitEffects}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-400/50 ring-1 ring-blue-400" />
          <span>Movement</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-400/50 ring-1 ring-red-400" />
          <span>Attack</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-400/50 ring-1 ring-purple-400" />
          <span>Ability</span>
        </div>
      </div>
    </div>
  );
}
