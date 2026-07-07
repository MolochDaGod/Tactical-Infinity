import * as THREE from 'three';

/**
 * EmoteSystem
 * ───────────
 * Floating Kenney-style emote indicators that pop above an NPC's head to
 * signal mood, reaction, or response. Used by AI controllers, dialogue
 * triggers, and player-action feedback across the game (sailing, island
 * walk, tactical battle, hub villages).
 *
 * Two surfaces:
 *  • showEmote3D(target, kind, opts) — attaches a billboarded THREE.Sprite
 *    above any Object3D, fades in, holds, fades out, then detaches.
 *  • <EmoteIndicator2D kind /> (separate component) for UI/HUD.
 *
 * Asset pack: Kenney "Emotes Pack" (CC0). Vector PNGs at
 * `public/emotes/vector/emote_*.png`, pixel variants at `public/emotes/pixel/`.
 */

// ─── Available emote kinds (matches files in public/emotes/vector/) ─────
export type EmoteKind =
  | 'alert' | 'anger' | 'bars' | 'cash' | 'circle' | 'cloud' | 'cross'
  | 'dots1' | 'dots2' | 'dots3' | 'drop' | 'drops'
  | 'exclamation' | 'exclamations'
  | 'faceAngry' | 'faceHappy' | 'faceSad'
  | 'heart' | 'heartBroken' | 'hearts'
  | 'idea' | 'laugh' | 'music' | 'question'
  | 'sleep' | 'sleeps' | 'star' | 'stars' | 'swirl';

export type EmoteStyle = 'vector' | 'pixel';

// ─── High-level mood → emote mapping (use these from AI code) ───────────
export type Mood =
  | 'happy' | 'sad' | 'angry' | 'enraged'
  | 'alert' | 'curious' | 'confused'
  | 'idea' | 'thinking' | 'sleepy' | 'asleep'
  | 'love' | 'heartbroken'
  | 'laughing' | 'singing'
  | 'hurt' | 'dying' | 'cash' | 'celebrate';

export const MOOD_TO_EMOTE: Record<Mood, EmoteKind> = {
  happy: 'faceHappy',
  sad: 'faceSad',
  angry: 'faceAngry',
  enraged: 'anger',
  alert: 'alert',
  curious: 'question',
  confused: 'dots3',
  idea: 'idea',
  thinking: 'dots1',
  sleepy: 'sleep',
  asleep: 'sleeps',
  love: 'hearts',
  heartbroken: 'heartBroken',
  laughing: 'laugh',
  singing: 'music',
  hurt: 'drop',
  dying: 'cross',
  cash: 'cash',
  celebrate: 'stars',
};

// ─── Loader / cache ─────────────────────────────────────────────────────
const ALL_KINDS: EmoteKind[] = [
  'alert','anger','bars','cash','circle','cloud','cross',
  'dots1','dots2','dots3','drop','drops','exclamation','exclamations',
  'faceAngry','faceHappy','faceSad','heart','heartBroken','hearts',
  'idea','laugh','music','question','sleep','sleeps','star','stars','swirl',
];

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const inflight = new Map<string, Promise<THREE.Texture>>();

export function emoteUrl(kind: EmoteKind, style: EmoteStyle = 'vector'): string {
  return `/emotes/${style}/emote_${kind}.png`;
}

export async function loadEmoteTexture(
  kind: EmoteKind,
  style: EmoteStyle = 'vector',
): Promise<THREE.Texture> {
  const url = emoteUrl(kind, style);
  const cached = textureCache.get(url);
  if (cached) return cached;
  const pending = inflight.get(url);
  if (pending) return pending;

  const p = new Promise<THREE.Texture>((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = style === 'pixel' ? THREE.NearestFilter : THREE.LinearFilter;
        tex.minFilter = style === 'pixel' ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
        tex.anisotropy = 4;
        textureCache.set(url, tex);
        inflight.delete(url);
        resolve(tex);
      },
      undefined,
      (err) => { inflight.delete(url); reject(err); },
    );
  });
  inflight.set(url, p);
  return p;
}

/** Preload a set of emotes (e.g. on level entry). */
export async function preloadEmotes(
  kinds: EmoteKind[] = ALL_KINDS,
  style: EmoteStyle = 'vector',
): Promise<void> {
  await Promise.allSettled(kinds.map((k) => loadEmoteTexture(k, style)));
}

// ─── 3D sprite indicator ────────────────────────────────────────────────
export interface EmoteOptions {
  /** World-space height above the target's origin. Default 2.2 (head height). */
  yOffset?: number;
  /** Sprite size in world units. Default 0.6. */
  size?: number;
  /** How long to stay fully visible, milliseconds. Default 1500. */
  holdMs?: number;
  /** Fade in/out duration, milliseconds. Default 200. */
  fadeMs?: number;
  /** Style — vector (default) or pixel. */
  style?: EmoteStyle;
  /**
   * Subtle bob animation while visible. Amplitude in world units.
   * Set 0 to disable. Default 0.06.
   */
  bobAmplitude?: number;
}

export interface ActiveEmote {
  /** The Sprite that was added to target. */
  sprite: THREE.Sprite;
  /** Manual cancel — fades out and removes immediately. */
  cancel: () => void;
  /** Resolves when the emote has fully detached. */
  done: Promise<void>;
}

/**
 * Show an emote sprite above `target` for a short time.
 * Safe to call repeatedly — each call returns its own ActiveEmote handle.
 * Call before adding `target` to a scene is fine; the sprite is parented
 * to `target`, so it follows automatically. The sprite is auto-removed on
 * fade-out, including its material/texture references (the texture itself
 * stays in the cache for reuse).
 */
export async function showEmote3D(
  target: THREE.Object3D,
  kind: EmoteKind | Mood,
  opts: EmoteOptions = {},
): Promise<ActiveEmote> {
  const emoteKind: EmoteKind = (MOOD_TO_EMOTE as Record<string, EmoteKind>)[kind] ?? (kind as EmoteKind);
  const {
    yOffset = 2.2,
    size = 0.6,
    holdMs = 1500,
    fadeMs = 200,
    style = 'vector',
    bobAmplitude = 0.06,
  } = opts;

  const tex = await loadEmoteTexture(emoteKind, style);
  const material = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `emote_${emoteKind}`;
  sprite.scale.set(size, size, 1);
  sprite.position.set(0, yOffset, 0);
  // Render after most opaque geometry so emote is visible against bright skies.
  sprite.renderOrder = 999;
  target.add(sprite);

  const startedAt = performance.now();
  let cancelled = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => { resolveDone = r; });

  const tick = () => {
    if (cancelled) return; // cancel() handles cleanup
    const t = performance.now() - startedAt;
    const fadeIn = Math.min(1, t / fadeMs);
    const holdEnd = fadeMs + holdMs;
    const fadeOut = t > holdEnd ? Math.max(0, 1 - (t - holdEnd) / fadeMs) : 1;
    const alpha = Math.min(fadeIn, fadeOut);
    material.opacity = alpha;
    if (bobAmplitude > 0) {
      sprite.position.y = yOffset + Math.sin(t * 0.004) * bobAmplitude;
    }
    if (t >= holdEnd + fadeMs) {
      detach();
      return;
    }
    requestAnimationFrame(tick);
  };

  const detach = () => {
    if (sprite.parent) sprite.parent.remove(sprite);
    material.dispose();
    resolveDone();
  };

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    // Quick fade-out then detach.
    const fadeStart = performance.now();
    const startAlpha = material.opacity;
    const fadeTick = () => {
      const t = performance.now() - fadeStart;
      const a = Math.max(0, startAlpha * (1 - t / fadeMs));
      material.opacity = a;
      if (a > 0) requestAnimationFrame(fadeTick);
      else detach();
    };
    requestAnimationFrame(fadeTick);
  };

  requestAnimationFrame(tick);
  return { sprite, cancel, done };
}

/** Convenience: show one of the three face emotes for a mood pulse. */
export function showMoodFace(
  target: THREE.Object3D,
  mood: 'happy' | 'sad' | 'angry',
  opts?: EmoteOptions,
): Promise<ActiveEmote> {
  return showEmote3D(target, mood, opts);
}
