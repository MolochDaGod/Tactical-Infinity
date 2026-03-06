import { useState, useCallback, useRef } from "react";
import type { Unit } from "@shared/schema";
import type { AnimationState } from "@/components/game/AnimatedSprite";

export interface UnitAnimationState {
  unitId: string;
  animation: AnimationState;
  startTime: number;
}

export interface CombatEffect {
  id: string;
  type: "damage" | "heal" | "spell" | "projectile" | "status";
  targetUnitId: string;
  sourceUnitId?: string;
  effectName: string;
  color: string;
  value?: number;
  position?: { x: number; y: number };
  startTime: number;
  duration: number;
}

export interface UseBattleAnimationsReturn {
  unitAnimations: Map<string, AnimationState>;
  effects: CombatEffect[];
  playAttackAnimation: (attackerId: string, targetId: string, damage: number) => Promise<void>;
  playSpellAnimation: (casterId: string, targetId: string, spellName: string, damage: number, spellColor: string) => Promise<void>;
  playHealAnimation: (casterId: string, targetId: string, healAmount: number) => Promise<void>;
  playDeathAnimation: (unitId: string) => Promise<void>;
  playHitAnimation: (unitId: string) => Promise<void>;
  setUnitAnimation: (unitId: string, animation: AnimationState) => void;
  clearEffect: (effectId: string) => void;
  isAnimating: boolean;
}

export function useBattleAnimations(): UseBattleAnimationsReturn {
  const [unitAnimations, setUnitAnimations] = useState<Map<string, AnimationState>>(new Map());
  const [effects, setEffects] = useState<CombatEffect[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationQueue = useRef<Promise<void>>(Promise.resolve());

  const setUnitAnimation = useCallback((unitId: string, animation: AnimationState) => {
    setUnitAnimations(prev => {
      const next = new Map(prev);
      next.set(unitId, animation);
      return next;
    });
  }, []);

  const clearEffect = useCallback((effectId: string) => {
    setEffects(prev => prev.filter(e => e.id !== effectId));
  }, []);

  const addEffect = useCallback((effect: Omit<CombatEffect, "id" | "startTime">) => {
    const newEffect: CombatEffect = {
      ...effect,
      id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      startTime: Date.now(),
    };
    setEffects(prev => [...prev, newEffect]);
    
    setTimeout(() => {
      clearEffect(newEffect.id);
    }, effect.duration);
    
    return newEffect;
  }, [clearEffect]);

  const waitForAnimation = useCallback((duration: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, duration));
  }, []);

  const playAttackAnimation = useCallback(async (attackerId: string, targetId: string, damage: number) => {
    setIsAnimating(true);
    
    setUnitAnimation(attackerId, "attack");
    
    await waitForAnimation(200);
    
    addEffect({
      type: "damage",
      targetUnitId: targetId,
      sourceUnitId: attackerId,
      effectName: "slash",
      color: "#ff4444",
      value: damage,
      duration: 600,
    });
    
    setUnitAnimation(targetId, "hit");
    
    await waitForAnimation(400);
    
    setUnitAnimation(attackerId, "idle");
    setUnitAnimation(targetId, "idle");
    
    setIsAnimating(false);
  }, [setUnitAnimation, addEffect, waitForAnimation]);

  const playSpellAnimation = useCallback(async (
    casterId: string, 
    targetId: string, 
    spellName: string, 
    damage: number,
    spellColor: string
  ) => {
    setIsAnimating(true);
    
    setUnitAnimation(casterId, "cast");
    
    addEffect({
      type: "spell",
      targetUnitId: casterId,
      effectName: "casting",
      color: spellColor,
      duration: 500,
    });
    
    await waitForAnimation(400);
    
    addEffect({
      type: "projectile",
      targetUnitId: targetId,
      sourceUnitId: casterId,
      effectName: spellName,
      color: spellColor,
      duration: 400,
    });
    
    await waitForAnimation(300);
    
    addEffect({
      type: "spell",
      targetUnitId: targetId,
      effectName: spellName,
      color: spellColor,
      value: damage,
      duration: 600,
    });
    
    setUnitAnimation(targetId, "hit");
    
    await waitForAnimation(300);
    
    setUnitAnimation(casterId, "idle");
    setUnitAnimation(targetId, "idle");
    
    setIsAnimating(false);
  }, [setUnitAnimation, addEffect, waitForAnimation]);

  const playHealAnimation = useCallback(async (casterId: string, targetId: string, healAmount: number) => {
    setIsAnimating(true);
    
    setUnitAnimation(casterId, "cast");
    
    await waitForAnimation(300);
    
    addEffect({
      type: "heal",
      targetUnitId: targetId,
      sourceUnitId: casterId,
      effectName: "heal",
      color: "#44ff44",
      value: healAmount,
      duration: 800,
    });
    
    await waitForAnimation(500);
    
    setUnitAnimation(casterId, "idle");
    
    setIsAnimating(false);
  }, [setUnitAnimation, addEffect, waitForAnimation]);

  const playDeathAnimation = useCallback(async (unitId: string) => {
    setIsAnimating(true);
    
    setUnitAnimation(unitId, "death");
    
    await waitForAnimation(1000);
    
    setIsAnimating(false);
  }, [setUnitAnimation, waitForAnimation]);

  const playHitAnimation = useCallback(async (unitId: string) => {
    setIsAnimating(true);
    
    setUnitAnimation(unitId, "hit");
    
    await waitForAnimation(300);
    
    setUnitAnimation(unitId, "idle");
    
    setIsAnimating(false);
  }, [setUnitAnimation, waitForAnimation]);

  return {
    unitAnimations,
    effects,
    playAttackAnimation,
    playSpellAnimation,
    playHealAnimation,
    playDeathAnimation,
    playHitAnimation,
    setUnitAnimation,
    clearEffect,
    isAnimating,
  };
}
