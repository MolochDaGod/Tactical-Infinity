import { useEffect, useState } from 'react';
import { emoteUrl, type EmoteKind, type EmoteStyle, MOOD_TO_EMOTE, type Mood } from '@/lib/emoteSystem';

export interface EmoteIndicator2DProps {
  kind: EmoteKind | Mood;
  style?: EmoteStyle;
  size?: number;
  /** If set, the indicator auto-hides itself after this many ms. */
  autoHideMs?: number;
  className?: string;
}

/**
 * Lightweight 2D emote chip for HUD overlays, dialogue bubbles, roster
 * tiles, and any place a React component is more convenient than parenting
 * a THREE.Sprite in 3D. Mirrors the icon set of `emoteSystem.ts`.
 */
export function EmoteIndicator2D({
  kind,
  style = 'vector',
  size = 32,
  autoHideMs,
  className,
}: EmoteIndicator2DProps) {
  const resolved: EmoteKind =
    (MOOD_TO_EMOTE as Record<string, EmoteKind>)[kind] ?? (kind as EmoteKind);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHideMs) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), autoHideMs);
    return () => window.clearTimeout(id);
  }, [kind, autoHideMs]);

  if (!visible) return null;

  return (
    <img
      src={emoteUrl(resolved, style)}
      alt={`emote ${resolved}`}
      width={size}
      height={size}
      className={className}
      style={{
        imageRendering: style === 'pixel' ? 'pixelated' : 'auto',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
      data-testid={`emote-${resolved}`}
    />
  );
}
