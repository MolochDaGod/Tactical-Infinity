import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { CombatEffect } from "@/hooks/useBattleAnimations";
import { Sword, Sparkles, Heart, Flame, Snowflake, Zap, Shield, Skull } from "lucide-react";

interface CombatEffectsProps {
  effects: CombatEffect[];
  className?: string;
}

const effectIcons: Record<string, typeof Sword> = {
  slash: Sword,
  fireball: Flame,
  frostbolt: Snowflake,
  lightning: Zap,
  heal: Heart,
  shield: Shield,
  poison: Skull,
  casting: Sparkles,
  default: Sparkles,
};

export function CombatEffects({ effects, className }: CombatEffectsProps) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-visible z-50", className)}>
      <AnimatePresence>
        {effects.map((effect) => (
          <CombatEffectDisplay key={effect.id} effect={effect} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CombatEffectDisplayProps {
  effect: CombatEffect;
}

function CombatEffectDisplay({ effect }: CombatEffectDisplayProps) {
  const Icon = effectIcons[effect.effectName] || effectIcons.default;

  if (effect.type === "damage") {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 0.5, y: 0 }}
        animate={{ opacity: 0, scale: 1.5, y: -30 }}
        exit={{ opacity: 0 }}
        transition={{ duration: effect.duration / 1000 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="relative">
          <SlashEffect color={effect.color} />
          {effect.value !== undefined && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 font-bold text-lg"
              style={{ 
                color: effect.color,
                textShadow: `0 0 8px ${effect.color}, 0 2px 4px rgba(0,0,0,0.8)` 
              }}
            >
              -{effect.value}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  if (effect.type === "heal") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.2 }}
        transition={{ duration: effect.duration / 1000 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="relative">
          <HealEffect color={effect.color} />
          {effect.value !== undefined && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 font-bold text-lg"
              style={{ 
                color: effect.color,
                textShadow: `0 0 8px ${effect.color}, 0 2px 4px rgba(0,0,0,0.8)` 
              }}
            >
              +{effect.value}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  if (effect.type === "spell") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.3, rotate: -180 }}
        animate={{ opacity: 1, scale: 1.2, rotate: 0 }}
        exit={{ opacity: 0, scale: 1.5 }}
        transition={{ duration: effect.duration / 1000, ease: "easeOut" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="relative">
          <SpellEffect effectName={effect.effectName} color={effect.color} />
          {effect.value !== undefined && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 font-bold text-xl"
              style={{ 
                color: effect.color,
                textShadow: `0 0 12px ${effect.color}, 0 2px 4px rgba(0,0,0,0.8)` 
              }}
            >
              -{effect.value}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  if (effect.type === "projectile") {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 0.5, x: -50 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ duration: effect.duration / 1000, ease: "easeIn" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Icon 
          className="w-8 h-8" 
          style={{ 
            color: effect.color,
            filter: `drop-shadow(0 0 8px ${effect.color})` 
          }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <Icon 
        className="w-6 h-6" 
        style={{ 
          color: effect.color,
          filter: `drop-shadow(0 0 6px ${effect.color})` 
        }}
      />
    </motion.div>
  );
}

function SlashEffect({ color }: { color: string }) {
  return (
    <motion.div
      className="relative w-12 h-12"
      initial={{ rotate: -45, scale: 0.5 }}
      animate={{ rotate: 45, scale: 1.2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <motion.path
          d="M 8 40 Q 24 24 40 8"
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2 }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <motion.path
          d="M 12 36 Q 24 24 36 12"
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.8 }}
          animate={{ pathLength: 1, opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        />
      </svg>
    </motion.div>
  );
}

function HealEffect({ color }: { color: string }) {
  return (
    <motion.div className="relative w-16 h-16">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{ 
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
            left: "50%",
            bottom: "0%",
          }}
          initial={{ y: 0, x: 0, opacity: 1, scale: 1 }}
          animate={{ 
            y: -40 - Math.random() * 20, 
            x: (Math.random() - 0.5) * 30,
            opacity: 0,
            scale: 0.5,
          }}
          transition={{ 
            duration: 0.8, 
            delay: i * 0.1,
            ease: "easeOut" 
          }}
        />
      ))}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.2, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Heart 
          className="w-8 h-8" 
          style={{ 
            color,
            filter: `drop-shadow(0 0 8px ${color})` 
          }} 
        />
      </motion.div>
    </motion.div>
  );
}

function SpellEffect({ effectName, color }: { effectName: string; color: string }) {
  const Icon = effectIcons[effectName] || effectIcons.default;
  
  return (
    <motion.div className="relative w-16 h-16">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ 
          backgroundColor: `${color}20`,
          boxShadow: `0 0 20px ${color}, inset 0 0 20px ${color}40`,
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1.5, opacity: [0, 1, 0] }}
        transition={{ duration: 0.6 }}
      />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0.5, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.3, type: "spring" }}
      >
        <Icon 
          className="w-10 h-10" 
          style={{ 
            color,
            filter: `drop-shadow(0 0 12px ${color})` 
          }} 
        />
      </motion.div>
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ 
            backgroundColor: color,
            left: "50%",
            top: "50%",
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ 
            x: Math.cos((i * Math.PI * 2) / 8) * 30, 
            y: Math.sin((i * Math.PI * 2) / 8) * 30,
            opacity: 0,
          }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
      ))}
    </motion.div>
  );
}

export function DamageNumber({ value, color, position }: { 
  value: number; 
  color: string;
  position?: { x: number; y: number };
}) {
  return (
    <motion.div
      className="absolute font-bold text-xl pointer-events-none z-50"
      style={{
        color,
        textShadow: `0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.8)`,
        left: position?.x ?? "50%",
        top: position?.y ?? "50%",
        transform: "translate(-50%, -50%)",
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -50, scale: 1.5 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      {value > 0 ? `-${value}` : `+${Math.abs(value)}`}
    </motion.div>
  );
}
