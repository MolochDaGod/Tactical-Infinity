import { useState, useEffect, useRef, useCallback } from 'react';
import { CharacterSprite, SpriteAnimation, getSpriteUrl } from '@/lib/spriteManifest';

interface SpriteAnimatorProps {
  character: CharacterSprite;
  animation: string;
  scale?: number;
  fps?: number;
  playing?: boolean;
  onAnimationEnd?: () => void;
}

export function SpriteAnimator({
  character,
  animation,
  scale = 2,
  fps = 10,
  playing = true,
  onAnimationEnd
}: SpriteAnimatorProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  
  const animData = character.animations[animation];
  const spriteUrl = getSpriteUrl(character, animation);
  
  const frameWidth = animData?.frameWidth || 100;
  const frameHeight = animData?.frameHeight || 100;
  const totalFrames = animData?.frames || 6;
  const isLooping = animData?.loop ?? true;
  
  useEffect(() => {
    setCurrentFrame(0);
    setImageLoaded(false);
    setImageError(false);
  }, [character.id, animation]);
  
  const animate = useCallback((timestamp: number) => {
    if (!playing || !animData) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }
    
    const frameDuration = 1000 / fps;
    
    if (timestamp - lastFrameTimeRef.current >= frameDuration) {
      lastFrameTimeRef.current = timestamp;
      
      setCurrentFrame(prev => {
        const nextFrame = prev + 1;
        if (nextFrame >= totalFrames) {
          if (isLooping) {
            return 0;
          } else {
            onAnimationEnd?.();
            return prev;
          }
        }
        return nextFrame;
      });
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, [playing, fps, totalFrames, isLooping, animData, onAnimationEnd]);
  
  useEffect(() => {
    if (imageLoaded && playing) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [imageLoaded, playing, animate]);
  
  if (!animData) {
    return (
      <div 
        className="flex items-center justify-center bg-muted/50 rounded"
        style={{ width: frameWidth * scale, height: frameHeight * scale }}
      >
        <span className="text-xs text-muted-foreground">No anim</span>
      </div>
    );
  }
  
  if (imageError) {
    return (
      <div 
        className="flex items-center justify-center bg-destructive/20 rounded"
        style={{ width: frameWidth * scale, height: frameHeight * scale }}
      >
        <span className="text-xs text-destructive">Failed</span>
      </div>
    );
  }
  
  return (
    <div 
      className="overflow-hidden relative"
      style={{ 
        width: frameWidth * scale, 
        height: frameHeight * scale,
        imageRendering: 'pixelated'
      }}
      data-testid={`sprite-${character.id}-${animation}`}
    >
      <img
        src={spriteUrl}
        alt={`${character.name} ${animation}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        style={{
          position: 'absolute',
          left: -currentFrame * frameWidth * scale,
          top: 0,
          height: frameHeight * scale,
          width: 'auto',
          imageRendering: 'pixelated',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
        draggable={false}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      )}
    </div>
  );
}

interface SpritePreviewCardProps {
  character: CharacterSprite;
  selectedAnimation: string;
  onAnimationChange: (anim: string) => void;
}

export function SpritePreviewCard({ character, selectedAnimation, onAnimationChange }: SpritePreviewCardProps) {
  const animationKeys = Object.keys(character.animations);
  
  return (
    <div className="flex flex-col gap-2 p-4 bg-card rounded-lg border" data-testid={`card-sprite-${character.id}`}>
      <h3 className="font-semibold text-sm">{character.name}</h3>
      
      <div className="flex justify-center py-2 bg-slate-800 rounded">
        <SpriteAnimator 
          character={character} 
          animation={selectedAnimation}
          scale={1.5}
          fps={8}
        />
      </div>
      
      <div className="flex flex-wrap gap-1">
        {animationKeys.map(animKey => (
          <button
            key={animKey}
            onClick={() => onAnimationChange(animKey)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              selectedAnimation === animKey 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            }`}
            data-testid={`button-anim-${character.id}-${animKey}`}
          >
            {animKey}
          </button>
        ))}
      </div>
    </div>
  );
}
