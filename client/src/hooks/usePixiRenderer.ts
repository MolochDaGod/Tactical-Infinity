import { useCallback, useRef, useEffect } from "react";
import * as PIXI from "pixi.js";
import type { Unit, Tile } from "@shared/schema";
import { EffectSystem, particlePresets, createProjectileEffect } from "@/renderer/ParticleEffects";
import { characterAssets } from "@/lib/assetManifest";

export interface CombatEvent {
  type: "attack" | "ability" | "heal" | "death" | "move";
  sourceId: string;
  targetId?: string;
  damage?: number;
  healing?: number;
  abilityId?: string;
  fromPosition?: { x: number; y: number };
  toPosition?: { x: number; y: number };
}

export interface RendererState {
  isReady: boolean;
  isAnimating: boolean;
}

export function usePixiRenderer() {
  const appRef = useRef<PIXI.Application | null>(null);
  const effectSystemRef = useRef<EffectSystem | null>(null);
  const animationQueueRef = useRef<CombatEvent[]>([]);
  const isProcessingRef = useRef(false);

  const TILE_SIZE = 48;
  const TILE_PADDING = 2;

  const positionToPixel = useCallback((x: number, y: number) => ({
    px: x * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2,
    py: y * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2,
  }), []);

  const playEffect = useCallback(async (event: CombatEvent): Promise<void> => {
    if (!effectSystemRef.current) return;

    return new Promise((resolve) => {
      const effectSystem = effectSystemRef.current!;

      switch (event.type) {
        case "attack": {
          if (event.fromPosition && event.toPosition) {
            const from = positionToPixel(event.fromPosition.x, event.fromPosition.y);
            const to = positionToPixel(event.toPosition.x, event.toPosition.y);
            
            effectSystem.playEffect("slash", to.px, to.py, {
              scale: 1.2,
              onComplete: () => {
                effectSystem.playEffect("hit", to.px, to.py, {
                  onComplete: resolve,
                });
              },
            });
          } else {
            resolve();
          }
          break;
        }

        case "ability": {
          if (event.toPosition) {
            const to = positionToPixel(event.toPosition.x, event.toPosition.y);
            let effectName = "explosion";
            
            if (event.abilityId?.includes("fire")) effectName = "fireball";
            else if (event.abilityId?.includes("lightning")) effectName = "lightning";
            else if (event.abilityId?.includes("poison")) effectName = "poison";
            
            effectSystem.playEffect(effectName, to.px, to.py, {
              onComplete: resolve,
            });
          } else {
            resolve();
          }
          break;
        }

        case "heal": {
          if (event.toPosition) {
            const to = positionToPixel(event.toPosition.x, event.toPosition.y);
            effectSystem.playEffect("heal", to.px, to.py, {
              onComplete: resolve,
            });
          } else {
            resolve();
          }
          break;
        }

        case "death": {
          if (event.toPosition) {
            const to = positionToPixel(event.toPosition.x, event.toPosition.y);
            effectSystem.playEffect("death", to.px, to.py, {
              duration: 2000,
              onComplete: resolve,
            });
          } else {
            resolve();
          }
          break;
        }

        default:
          resolve();
      }
    });
  }, [positionToPixel]);

  const processAnimationQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (animationQueueRef.current.length > 0) {
      const event = animationQueueRef.current.shift();
      if (event) {
        await playEffect(event);
      }
    }

    isProcessingRef.current = false;
  }, [playEffect]);

  const queueCombatEvent = useCallback((event: CombatEvent) => {
    animationQueueRef.current.push(event);
    processAnimationQueue();
  }, [processAnimationQueue]);

  const initEffectSystem = useCallback((container: PIXI.Container) => {
    if (!effectSystemRef.current) {
      effectSystemRef.current = new EffectSystem(container);
    }
  }, []);

  const cleanup = useCallback(() => {
    effectSystemRef.current?.destroy();
    effectSystemRef.current = null;
    animationQueueRef.current = [];
    isProcessingRef.current = false;
  }, []);

  return {
    queueCombatEvent,
    initEffectSystem,
    cleanup,
    positionToPixel,
    TILE_SIZE,
    TILE_PADDING,
  };
}

export function getAttackEffect(unitClass: string): string {
  switch (unitClass) {
    case "mage":
      return "fireball";
    case "archer":
      return "arrow";
    case "healer":
      return "heal";
    case "rogue":
      return "poison";
    case "knight":
      return "shieldBash";
    default:
      return "slash";
  }
}

export function getAbilityEffect(abilityId: string): string {
  if (abilityId.includes("fire") || abilityId.includes("blast")) return "fireball";
  if (abilityId.includes("lightning") || abilityId.includes("thunder")) return "lightning";
  if (abilityId.includes("heal") || abilityId.includes("cure")) return "heal";
  if (abilityId.includes("poison") || abilityId.includes("toxic")) return "poison";
  if (abilityId.includes("shield") || abilityId.includes("bash")) return "shieldBash";
  return "explosion";
}
