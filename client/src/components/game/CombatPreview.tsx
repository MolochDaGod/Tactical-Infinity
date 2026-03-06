import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Unit, Ability } from "@shared/schema";
import { classIcons, factionColors } from "@/lib/gameData";
import { Sword, Sparkles, Target, Heart, Skull, Shield, ArrowRight, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  Sword,
  Sparkles,
  Target,
  Heart,
  Skull,
  Shield,
};

interface CombatPreviewProps {
  attacker: Unit;
  defender: Unit;
  ability?: Ability;
  estimatedDamage: number;
  hitChance: number;
  critChance: number;
}

export function CombatPreview({
  attacker,
  defender,
  ability,
  estimatedDamage,
  hitChance,
  critChance,
}: CombatPreviewProps) {
  const AttackerIcon = iconMap[classIcons[attacker.class] as keyof typeof iconMap];
  const DefenderIcon = iconMap[classIcons[defender.class] as keyof typeof iconMap];
  const attackerFaction = factionColors[attacker.faction];
  const defenderFaction = factionColors[defender.faction];
  
  const willKill = defender.stats.hp - estimatedDamage <= 0;
  const defenderHpAfter = Math.max(0, defender.stats.hp - estimatedDamage);

  return (
    <Card className="p-4 bg-card/95 backdrop-blur">
      <div className="flex items-center justify-center gap-1 mb-3">
        <Swords className="w-4 h-4 text-primary" />
        <h3 className="font-serif font-semibold text-sm">Combat Preview</h3>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <div 
            className="w-12 h-12 rounded-md mx-auto flex items-center justify-center mb-2"
            style={{ backgroundColor: attackerFaction.primary }}
          >
            <AttackerIcon className="w-6 h-6 text-white" />
          </div>
          <p className="font-medium text-sm truncate">{attacker.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{attacker.class}</p>
          <div className="mt-2 text-xs">
            <span className="text-orange-500 font-mono">ATK: {attacker.stats.attack}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <p className={cn(
              "text-2xl font-bold font-mono",
              willKill ? "text-red-500" : "text-orange-500"
            )}>
              -{estimatedDamage}
            </p>
            {ability && (
              <Badge variant="secondary" className="text-xs mt-1">
                {ability.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 text-center">
          <div 
            className="w-12 h-12 rounded-md mx-auto flex items-center justify-center mb-2"
            style={{ backgroundColor: defenderFaction.primary }}
          >
            <DefenderIcon className="w-6 h-6 text-white" />
          </div>
          <p className="font-medium text-sm truncate">{defender.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{defender.class}</p>
          <div className="mt-2 text-xs">
            <span className="text-blue-500 font-mono">DEF: {defender.stats.defense}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">Target HP</span>
          <span className="font-mono">
            {defender.stats.hp} <ArrowRight className="w-3 h-3 inline" />{" "}
            <span className={willKill ? "text-red-500" : "text-foreground"}>
              {defenderHpAfter}
            </span>
          </span>
        </div>
        
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div className="h-full flex">
            <div 
              className={cn(
                "transition-all",
                defenderHpAfter / defender.stats.maxHp > 0.6 && "bg-green-500",
                defenderHpAfter / defender.stats.maxHp <= 0.6 && defenderHpAfter / defender.stats.maxHp > 0.3 && "bg-amber-500",
                defenderHpAfter / defender.stats.maxHp <= 0.3 && "bg-red-500",
                willKill && "bg-red-500"
              )}
              style={{ width: `${(defenderHpAfter / defender.stats.maxHp) * 100}%` }}
            />
            <div 
              className="bg-red-300 dark:bg-red-800"
              style={{ width: `${(estimatedDamage / defender.stats.maxHp) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Hit Chance</span>
            <span className={cn(
              "font-mono font-medium",
              hitChance >= 80 && "text-green-500",
              hitChance < 80 && hitChance >= 50 && "text-amber-500",
              hitChance < 50 && "text-red-500"
            )}>
              {hitChance}%
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Crit Chance</span>
            <span className="font-mono font-medium text-purple-500">
              {critChance}%
            </span>
          </div>
        </div>

        {willKill && (
          <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-center">
            <span className="text-red-500 font-semibold text-sm flex items-center justify-center gap-1">
              <Skull className="w-4 h-4" />
              FATAL BLOW
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
