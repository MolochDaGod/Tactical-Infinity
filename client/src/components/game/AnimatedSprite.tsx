import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export type AnimationState = 
  | "idle" 
  | "walk" 
  | "run" 
  | "attack" 
  | "cast" 
  | "hit" 
  | "death";

export interface AnimationConfig {
  frames: number;
  fps: number;
  row: number;
  loop?: boolean;
}

export interface SpriteSheetConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<AnimationState, AnimationConfig>;
}

interface AnimatedSpriteProps {
  config: SpriteSheetConfig;
  animation: AnimationState;
  size?: number;
  flipX?: boolean;
  tint?: string;
  opacity?: number;
  onAnimationComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedSprite({
  config,
  animation,
  size = 64,
  flipX = false,
  tint,
  opacity = 1,
  onAnimationComplete,
  className,
  style,
}: AnimatedSpriteProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef(0);
  const animationStateRef = useRef(animation);

  const animConfig = config.animations[animation] || config.animations.idle;
  const shouldLoop = animConfig.loop !== false;
  const frameDuration = 1000 / animConfig.fps;

  useEffect(() => {
    animationStateRef.current = animation;
    frameRef.current = 0;
    setCurrentFrame(0);
  }, [animation]);

  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const elapsed = timestamp - lastTimeRef.current;

    if (elapsed >= frameDuration) {
      const currentAnimConfig = config.animations[animationStateRef.current] || config.animations.idle;
      const nextFrame = frameRef.current + 1;
      
      if (nextFrame >= currentAnimConfig.frames) {
        if (shouldLoop) {
          frameRef.current = 0;
          setCurrentFrame(0);
        } else {
          frameRef.current = currentAnimConfig.frames - 1;
          setCurrentFrame(currentAnimConfig.frames - 1);
          onAnimationComplete?.();
          return;
        }
      } else {
        frameRef.current = nextFrame;
        setCurrentFrame(nextFrame);
      }
      
      lastTimeRef.current = timestamp;
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [config.animations, frameDuration, shouldLoop, onAnimationComplete]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  const backgroundPositionX = -(currentFrame * config.frameWidth);
  const backgroundPositionY = -(animConfig.row * config.frameHeight);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        className
      )}
      style={{
        width: size,
        height: size,
        opacity,
        transform: flipX ? "scaleX(-1)" : undefined,
        ...style,
      }}
    >
      <div
        className={cn(
          "absolute inset-0 bg-no-repeat transition-opacity",
          !spriteLoaded && "opacity-0"
        )}
        style={{
          backgroundImage: `url(${config.src})`,
          backgroundPosition: `${backgroundPositionX}px ${backgroundPositionY}px`,
          backgroundSize: `${config.frameWidth * (config.animations.idle?.frames || 8)}px auto`,
          width: "100%",
          height: "100%",
          imageRendering: "pixelated",
          filter: tint ? `drop-shadow(0 0 2px ${tint}) hue-rotate(0deg)` : undefined,
        }}
      />
      <img
        src={config.src}
        alt=""
        className="hidden"
        onLoad={() => setSpriteLoaded(true)}
        onError={() => setSpriteLoaded(false)}
      />
    </div>
  );
}

export const DEFAULT_SPRITE_CONFIG: SpriteSheetConfig = {
  src: "/2dassets/characters/warrior.png",
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    idle: { frames: 4, fps: 4, row: 0, loop: true },
    walk: { frames: 6, fps: 8, row: 1, loop: true },
    run: { frames: 8, fps: 12, row: 2, loop: true },
    attack: { frames: 6, fps: 10, row: 3, loop: false },
    cast: { frames: 8, fps: 8, row: 4, loop: false },
    hit: { frames: 3, fps: 6, row: 5, loop: false },
    death: { frames: 6, fps: 4, row: 6, loop: false },
  },
};

export function createSpriteConfig(
  src: string,
  frameWidth = 64,
  frameHeight = 64,
  overrides?: Partial<Record<AnimationState, Partial<AnimationConfig>>>
): SpriteSheetConfig {
  const defaultAnimations = DEFAULT_SPRITE_CONFIG.animations;
  
  return {
    src,
    frameWidth,
    frameHeight,
    animations: {
      idle: { ...defaultAnimations.idle, ...overrides?.idle },
      walk: { ...defaultAnimations.walk, ...overrides?.walk },
      run: { ...defaultAnimations.run, ...overrides?.run },
      attack: { ...defaultAnimations.attack, ...overrides?.attack },
      cast: { ...defaultAnimations.cast, ...overrides?.cast },
      hit: { ...defaultAnimations.hit, ...overrides?.hit },
      death: { ...defaultAnimations.death, ...overrides?.death },
    },
  };
}
