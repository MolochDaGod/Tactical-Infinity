import { useMemo, useState, useEffect } from "react";
import type { Unit, UnitClass, WeaponType } from "@shared/schema";
import { AnimatedSprite, type AnimationState, type SpriteSheetConfig, createSpriteConfig } from "./AnimatedSprite";
import { CombatEffects } from "./CombatEffects";
import type { CombatEffect } from "@/hooks/useBattleAnimations";
import { 
  classDefaultWeapons, 
  tierGlowColors, 
  tierNames,
  factionSpriteVariants,
  getWeaponSprite,
  SPRITE_BASE_PATH
} from "@/lib/spriteData";
import { Sword, Sparkles, Target, Heart, Skull, Shield, Axe, Crosshair, Wand2, Book } from "lucide-react";
import { cn } from "@/lib/utils";

const classIconMap: Record<UnitClass, typeof Sword> = {
  warrior: Sword,
  mage: Sparkles,
  ranger: Target,
  worge: Skull,
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

const CLASS_SPRITE_CONFIGS: Record<UnitClass, SpriteSheetConfig> = {
  warrior: createSpriteConfig(`${SPRITE_BASE_PATH}/characters/warrior.png`, 64, 64, {
    attack: { frames: 6, fps: 12, row: 3, loop: false },
  }),
  mage: createSpriteConfig(`${SPRITE_BASE_PATH}/characters/mage.png`, 64, 64, {
    cast: { frames: 8, fps: 10, row: 4, loop: false },
  }),
  ranger: createSpriteConfig(`${SPRITE_BASE_PATH}/characters/ranger.png`, 64, 64, {
    attack: { frames: 5, fps: 10, row: 3, loop: false },
  }),
  worge: createSpriteConfig(`${SPRITE_BASE_PATH}/characters/worge.png`, 64, 64, {
    attack: { frames: 6, fps: 12, row: 3, loop: false },
  }),
};

interface AnimatedUnitSpriteProps {
  unit: Unit;
  size?: "sm" | "md" | "lg";
  showWeapon?: boolean;
  showGlow?: boolean;
  isSelected?: boolean;
  animation?: AnimationState;
  effects?: CombatEffect[];
  onAnimationComplete?: () => void;
  className?: string;
}

export function AnimatedUnitSprite({ 
  unit, 
  size = "md", 
  showWeapon = true,
  showGlow = true,
  isSelected = false,
  animation = "idle",
  effects = [],
  onAnimationComplete,
  className 
}: AnimatedUnitSpriteProps) {
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
  };

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
    return CLASS_SPRITE_CONFIGS[unit.class] || CLASS_SPRITE_CONFIGS.warrior;
  }, [unit.class]);

  const weaponSpritePath = useMemo(() => {
    if (unit.equipment?.weapon?.spritePath) {
      return unit.equipment.weapon.spritePath;
    }
    return getWeaponSprite(weaponType, equipmentTier);
  }, [unit.equipment, weaponType, equipmentTier]);

  const glowColor = tierGlowColors[equipmentTier];
  const factionVariant = factionSpriteVariants[unit.faction] || { hue: 200, saturation: 100 };

  const ClassIcon = classIconMap[unit.class] || Sword;
  const WeaponIcon = weaponIconMap[weaponType] || Sword;

  const baseGradient = unit.isEnemy 
    ? "from-red-700 to-red-900" 
    : "from-blue-600 to-blue-800";

  const tintColor = unit.isEnemy ? "#ff6b6b" : "#6b9fff";

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setSpriteLoaded(true);
      setUseFallback(false);
    };
    img.onerror = () => {
      setUseFallback(true);
    };
    img.src = spriteConfig.src;
  }, [spriteConfig.src]);

  const unitEffects = effects.filter(e => e.targetUnitId === unit.id);

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center rounded-lg transition-all overflow-visible",
        `bg-gradient-to-br ${baseGradient}`,
        sizeClasses[size],
        showGlow && equipmentTier >= 3 && "ring-1",
        tierBorderColors[equipmentTier],
        isSelected && "scale-110 z-10",
        animation === "death" && "opacity-50",
        animation === "hit" && "animate-pulse",
        className
      )}
      style={{
        boxShadow: showGlow && equipmentTier >= 2 
          ? `0 0 ${6 + equipmentTier * 2}px ${glowColor}` 
          : isSelected 
            ? `0 0 12px ${unit.isEnemy ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)"}`
            : undefined,
      }}
      data-testid={`animated-unit-sprite-${unit.id}`}
    >
      {spriteLoaded && !useFallback ? (
        <AnimatedSprite
          config={spriteConfig}
          animation={animation}
          size={sizePixels[size]}
          flipX={unit.isEnemy}
          tint={tintColor}
          onAnimationComplete={onAnimationComplete}
          className="rounded-lg"
          style={{
            filter: `hue-rotate(${factionVariant.hue - 200}deg) saturate(${factionVariant.saturation}%)`,
          }}
        />
      ) : (
        <ClassIcon 
          className={cn(
            "text-white transition-transform",
            iconSizes[size],
            animation === "attack" && "animate-bounce",
            animation === "hit" && "text-red-300",
          )} 
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

      {unitEffects.length > 0 && (
        <CombatEffects effects={unitEffects} />
      )}
    </div>
  );
}

interface AnimatedUnitSpriteWithHealthProps extends AnimatedUnitSpriteProps {
  showHealth?: boolean;
}

export function AnimatedUnitSpriteWithHealth({ 
  unit, 
  showHealth = true,
  ...props 
}: AnimatedUnitSpriteWithHealthProps) {
  const healthPercent = (unit.stats.hp / unit.stats.maxHp) * 100;
  const isDead = unit.stats.hp <= 0;
  
  return (
    <div className="relative">
      <AnimatedUnitSprite 
        unit={unit} 
        animation={isDead ? "death" : props.animation}
        {...props} 
      />
      
      {showHealth && !isDead && (
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
