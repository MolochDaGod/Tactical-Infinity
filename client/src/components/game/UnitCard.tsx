import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Unit } from "@shared/schema";
import { classIcons, factionColors } from "@/lib/gameData";
import { Sword, Sparkles, Target, Heart, Skull, Shield, Zap, Eye, Move, Dog } from "lucide-react";

const iconMap = {
  Sword,
  Sparkles,
  Target,
  Heart,
  Skull,
  Shield,
  Dog,
};

interface UnitCardProps {
  unit: Unit;
  isSelected?: boolean;
  isCompact?: boolean;
  onClick?: () => void;
  showAbilities?: boolean;
}

export function UnitCard({ unit, isSelected, isCompact, onClick, showAbilities }: UnitCardProps) {
  const IconComponent = iconMap[classIcons[unit.class] as keyof typeof iconMap];
  const factionColor = factionColors[unit.faction];
  const hpPercent = (unit.stats.hp / unit.stats.maxHp) * 100;
  
  const getHpColor = () => {
    if (hpPercent > 60) return "bg-green-500";
    if (hpPercent > 30) return "bg-amber-500";
    return "bg-red-500";
  };

  if (isCompact) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all hover-elevate active-elevate-2 ${
          isSelected ? "bg-primary/20 ring-2 ring-primary" : "bg-card"
        }`}
        data-testid={`unit-card-compact-${unit.id}`}
      >
        <div 
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: factionColor.primary }}
        >
          <IconComponent className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-sm font-semibold truncate">{unit.name}</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${getHpColor()}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Lv.{unit.level}</span>
      </div>
    );
  }

  return (
    <Card 
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all hover-elevate active-elevate-2 ${
        isSelected ? "ring-2 ring-primary" : ""
      } ${unit.isEnemy ? "border-destructive/50" : ""}`}
      data-testid={`unit-card-${unit.id}`}
    >
      <div className="flex gap-4">
        <div 
          className="w-16 h-16 rounded-md flex items-center justify-center shrink-0"
          style={{ 
            background: `linear-gradient(135deg, ${factionColor.primary} 0%, ${factionColor.secondary} 100%)` 
          }}
        >
          <IconComponent className="w-8 h-8 text-white drop-shadow-md" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-serif text-lg font-bold leading-tight">{unit.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs capitalize">
                  {unit.class}
                </Badge>
                <span className="text-xs text-muted-foreground">Lv.{unit.level}</span>
              </div>
            </div>
            <Badge 
              className="text-xs capitalize shrink-0"
              style={{ 
                backgroundColor: factionColor.primary,
                color: "white"
              }}
            >
              {unit.faction}
            </Badge>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-red-500" />
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getHpColor()}`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
              <span className="text-xs font-mono w-14 text-right">
                {unit.stats.hp}/{unit.stats.maxHp}
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-1" title="Attack">
                <Sword className="w-3 h-3 text-orange-500" />
                <span className="font-mono">{unit.stats.attack}</span>
              </div>
              <div className="flex items-center gap-1" title="Defense">
                <Shield className="w-3 h-3 text-blue-500" />
                <span className="font-mono">{unit.stats.defense}</span>
              </div>
              <div className="flex items-center gap-1" title="Speed">
                <Zap className="w-3 h-3 text-yellow-500" />
                <span className="font-mono">{unit.stats.speed}</span>
              </div>
              <div className="flex items-center gap-1" title="Movement">
                <Move className="w-3 h-3 text-green-500" />
                <span className="font-mono">{unit.stats.movement}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showAbilities && unit.abilities.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">ABILITIES</p>
          <div className="space-y-1.5">
            {unit.abilities.map((ability) => (
              <div 
                key={ability.id}
                className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ability.name}</span>
                  {ability.damage && (
                    <span className="text-orange-500">DMG:{ability.damage}</span>
                  )}
                  {ability.healing && (
                    <span className="text-green-500">HEAL:{ability.healing}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  <span>{ability.range}</span>
                  {ability.cooldown > 0 && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span>CD:{ability.cooldown}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
