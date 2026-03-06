import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Unit } from "@shared/schema";
import { classIcons, factionColors } from "@/lib/gameData";
import { Sword, Sparkles, Target, Heart, Skull, Shield, ChevronRight, Dog } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Sword> = {
  Sword,
  Sparkles,
  Target,
  Heart,
  Skull,
  Shield,
  Dog,
};

interface TurnOrderProps {
  units: Unit[];
  currentUnitId?: string;
  turnNumber: number;
}

export function TurnOrder({ units, currentUnitId, turnNumber }: TurnOrderProps) {
  const sortedUnits = [...units]
    .filter((u) => u.stats.hp > 0)
    .sort((a, b) => b.stats.speed - a.stats.speed);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif font-semibold text-sm">Turn Order</h3>
        <Badge variant="outline" className="text-xs">
          Turn {turnNumber}
        </Badge>
      </div>
      
      <div className="space-y-1.5">
        {sortedUnits.map((unit, index) => {
          const IconComponent = iconMap[classIcons[unit.class] as keyof typeof iconMap];
          const isCurrent = unit.id === currentUnitId;
          const factionColor = factionColors[unit.faction];
          
          return (
            <div
              key={unit.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md transition-all",
                isCurrent && "bg-primary/20 ring-1 ring-primary",
                !isCurrent && "hover-elevate"
              )}
              data-testid={`turn-order-unit-${unit.id}`}
            >
              {isCurrent && (
                <ChevronRight className="w-4 h-4 text-primary shrink-0 animate-pulse" />
              )}
              {!isCurrent && (
                <span className="w-4 text-center text-xs text-muted-foreground font-mono">
                  {index + 1}
                </span>
              )}
              
              <div 
                className={cn(
                  "w-7 h-7 rounded flex items-center justify-center shrink-0",
                  unit.isEnemy ? "bg-red-700" : "bg-blue-600"
                )}
              >
                {IconComponent ? (
                  <IconComponent className="w-4 h-4 text-white" />
                ) : (
                  <Sword className="w-4 h-4 text-white" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  isCurrent && "font-semibold"
                )}>
                  {unit.name}
                </p>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full",
                      unit.stats.hp / unit.stats.maxHp > 0.6 && "bg-green-500",
                      unit.stats.hp / unit.stats.maxHp <= 0.6 && unit.stats.hp / unit.stats.maxHp > 0.3 && "bg-amber-500",
                      unit.stats.hp / unit.stats.maxHp <= 0.3 && "bg-red-500"
                    )}
                    style={{ width: `${(unit.stats.hp / unit.stats.maxHp) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
