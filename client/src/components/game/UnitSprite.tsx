import { useMemo, useState } from "react";
import type { Unit, UnitClass, WeaponType } from "@shared/schema";
import { 
  classDefaultWeapons, 
  tierGlowColors, 
  tierNames,
  factionSpriteVariants,
  getWeaponSprite,
  getCharacterSprite,
  SPRITE_BASE_PATH
} from "@/lib/spriteData";
import { Sword, Sparkles, Target, Heart, Skull, Shield, Axe, Crosshair, Wand2, Book } from "lucide-react";
import { cn } from "@/lib/utils";

const classIconMap: Record<UnitClass, typeof Sword> = {
  warrior: Sword,
  mage: Sparkles,
  archer: Target,
  healer: Heart,
  rogue: Skull,
  knight: Shield,
};

const weaponIconMap: Record<WeaponType, typeof Sword> = {
  sword: Sword,
  axe: Axe,
  dagger: Sword,
  hammer: Shield,
  bow: Target,
  crossbow: Crosshair,
  gun: Target,
  staff: Wand2,
  tome: Book,
};

const tierBorderColors: Record<number, string> = {
  0: "border-gray-400",
  1: "border-amber-600",
  2: "border-slate-300",
  3: "border-blue-400",
  4: "border-purple-500",
  5: "border-orange-500",
  6: "border-yellow-400",
  7: "border-cyan-300",
  8: "border-white",
};

interface UnitSpriteProps {
  unit: Unit;
  size?: "sm" | "md" | "lg";
  showWeapon?: boolean;
  showGlow?: boolean;
  isSelected?: boolean;
  className?: string;
}

export function UnitSprite({ 
  unit, 
  size = "md", 
  showWeapon = true,
  showGlow = true,
  isSelected = false,
  className 
}: UnitSpriteProps) {
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [spriteError, setSpriteError] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const weaponSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const equipmentTier = useMemo(() => {
    if (unit.equipment?.weapon?.tier !== undefined) {
      return unit.equipment.weapon.tier;
    }
    return Math.min(Math.floor(unit.level / 3), 8);
  }, [unit.equipment, unit.level]);

  const weaponType = useMemo(() => {
    if (unit.equipment?.weapon?.weaponType) {
      return unit.equipment.weapon.weaponType;
    }
    return classDefaultWeapons[unit.class];
  }, [unit.equipment, unit.class]);

  const spriteConfig = useMemo(() => {
    if (unit.spriteConfig) return unit.spriteConfig;
    return getCharacterSprite(unit.class);
  }, [unit.spriteConfig, unit.class]);

  const weaponSpritePath = useMemo(() => {
    if (unit.equipment?.weapon?.spritePath) {
      return unit.equipment.weapon.spritePath;
    }
    return getWeaponSprite(weaponType, equipmentTier);
  }, [unit.equipment, weaponType, equipmentTier]);

  const glowColor = tierGlowColors[equipmentTier];
  const factionVariant = factionSpriteVariants[unit.faction] || { hue: 200, saturation: 100 };

  const ClassIcon = classIconMap[unit.class];
  const WeaponIcon = weaponIconMap[weaponType];

  const baseGradient = unit.isEnemy 
    ? "from-red-700 to-red-900" 
    : "from-blue-600 to-blue-800";

  const shouldShowSprite = spriteConfig && !spriteError;

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center rounded-lg transition-all overflow-visible",
        `bg-gradient-to-br ${baseGradient}`,
        sizeClasses[size],
        showGlow && equipmentTier >= 3 && "ring-1",
        tierBorderColors[equipmentTier],
        isSelected && "scale-110 z-10",
        className
      )}
      style={{
        boxShadow: showGlow && equipmentTier >= 2 
          ? `0 0 ${6 + equipmentTier * 2}px ${glowColor}` 
          : isSelected 
            ? `0 0 12px ${unit.isEnemy ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)"}`
            : undefined,
      }}
      data-testid={`unit-sprite-${unit.id}`}
    >
      {shouldShowSprite && (
        <img
          src={spriteConfig.baseSprite}
          alt={unit.name}
          className={cn(
            "absolute inset-0 w-full h-full object-cover rounded-lg",
            !spriteLoaded && "opacity-0"
          )}
          style={{
            objectPosition: "0 0",
            filter: `hue-rotate(${factionVariant.hue - 200}deg) saturate(${factionVariant.saturation}%)`,
          }}
          onLoad={() => setSpriteLoaded(true)}
          onError={() => setSpriteError(true)}
        />
      )}

      {(!shouldShowSprite || !spriteLoaded) && (
        <ClassIcon 
          className={cn("text-white", iconSizes[size])} 
          style={{
            filter: `hue-rotate(${factionVariant.hue - 200}deg)`,
          }}
        />
      )}
      
      {showWeapon && (
        <div 
          className={cn(
            "absolute -bottom-1 -right-1 rounded-full p-0.5",
            "bg-gradient-to-br",
            equipmentTier >= 4 ? "from-purple-500 to-purple-700" :
            equipmentTier >= 2 ? "from-blue-500 to-blue-700" :
            "from-amber-500 to-amber-700",
            "border",
            equipmentTier >= 4 ? "border-purple-300/50" :
            equipmentTier >= 2 ? "border-blue-300/50" :
            "border-amber-300/50",
          )}
          style={{
            boxShadow: equipmentTier >= 2 ? `0 0 4px ${glowColor}` : undefined,
          }}
          title={unit.equipment?.weapon?.name || `${tierNames[equipmentTier]} ${weaponType}`}
        >
          <WeaponIcon className={cn("text-white", weaponSizes[size])} />
        </div>
      )}
      
      {equipmentTier >= 3 && (
        <div 
          className={cn(
            "absolute -top-1 -left-1 text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border text-white",
            equipmentTier >= 6 ? "bg-gradient-to-br from-yellow-500 to-orange-600 border-yellow-300/50" :
            equipmentTier >= 4 ? "bg-gradient-to-br from-purple-500 to-purple-700 border-purple-300/50" :
            "bg-gradient-to-br from-blue-500 to-blue-700 border-blue-300/50"
          )}
          title={`Tier ${equipmentTier} - ${tierNames[equipmentTier]}`}
        >
          T{equipmentTier}
        </div>
      )}
    </div>
  );
}

interface UnitSpriteWithHealthProps extends UnitSpriteProps {
  showHealth?: boolean;
}

export function UnitSpriteWithHealth({ 
  unit, 
  showHealth = true,
  ...props 
}: UnitSpriteWithHealthProps) {
  const healthPercent = (unit.stats.hp / unit.stats.maxHp) * 100;
  
  return (
    <div className="relative">
      <UnitSprite unit={unit} {...props} />
      
      {showHealth && (
        <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-black/40 rounded-full overflow-hidden mx-0.5">
          <div
            className={cn(
              "h-full transition-all duration-300",
              healthPercent > 60 && "bg-green-400",
              healthPercent <= 60 && healthPercent > 30 && "bg-amber-400",
              healthPercent <= 30 && "bg-red-400"
            )}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
