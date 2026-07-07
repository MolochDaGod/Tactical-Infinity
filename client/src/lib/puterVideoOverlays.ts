/**
 * Puter.ai Text-to-Video Overlay System
 * Generates atmospheric video overlays for intro cinematic enhancement
 */

export interface VideoOverlayConfig {
  id: string;
  prompt: string;
  startTime: number;  // When to start showing (ms from intro start)
  endTime: number;    // When to end showing (ms from intro start)
  opacity: number;    // 0-1, recommend 0.3-0.6 for overlays
  blendMode: 'screen' | 'overlay' | 'multiply' | 'soft-light' | 'color-dodge';
  zIndex: number;
}

// 4 atmospheric overlay configurations optimized for the intro phases
export const INTRO_VIDEO_OVERLAYS: VideoOverlayConfig[] = [
  {
    id: 'storm-clouds',
    prompt: 'Dark thunderstorm clouds churning violently, dramatic lightning bolts illuminating purple-black sky, rain streaking through frame, cinematic slow motion, atmospheric horror film style, 4K quality',
    startTime: 5000,   // After video intro ends
    endTime: 20000,    // Through storm/emergence phase
    opacity: 0.35,
    blendMode: 'screen',
    zIndex: 5
  },
  {
    id: 'ocean-mist',
    prompt: 'Heavy rain falling on dark turbulent ocean at night, sea spray and mist particles, moonlight breaking through storm clouds, ethereal fog rising, dark fantasy atmosphere, slow motion',
    startTime: 8000,   // Overlaps with storm
    endTime: 26000,    // Through attack phase
    opacity: 0.25,
    blendMode: 'overlay',
    zIndex: 4
  },
  {
    id: 'underwater-caustics',
    prompt: 'Deep ocean underwater scene, blue-green caustic light rays filtering down through murky water, particles and debris floating slowly, bioluminescent glow, mysterious abyss descent, cinematic',
    startTime: 26000,  // Underwater descent phase
    endTime: 35000,    // Until title reveal
    opacity: 0.5,
    blendMode: 'screen',
    zIndex: 6
  },
  {
    id: 'mystical-energy',
    prompt: 'Golden ethereal particles swirling in darkness, magical energy wisps, ancient fantasy spell effects, amber and gold light rays against pure black void, cinematic dust particles, 4K',
    startTime: 32000,  // Title reveal phase
    endTime: 38000,    // End of intro
    opacity: 0.45,
    blendMode: 'color-dodge',
    zIndex: 7
  }
];

// Cache for generated videos
const videoCache = new Map<string, HTMLVideoElement>();
const generationPromises = new Map<string, Promise<HTMLVideoElement>>();

/**
 * Check if Puter.js is available
 */
export function isPuterAvailable(): boolean {
  return typeof window !== 'undefined' && 'puter' in window;
}

/**
 * Load Puter.js script dynamically
 */
export async function loadPuterScript(): Promise<void> {
  if (isPuterAvailable()) return;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Puter.js'));
    document.head.appendChild(script);
  });
}

/**
 * Generate a single video overlay using Puter.ai txt2vid
 */
export async function generateVideoOverlay(
  config: VideoOverlayConfig,
  onProgress?: (status: string) => void
): Promise<HTMLVideoElement | null> {
  // Check cache first
  if (videoCache.has(config.id)) {
    return videoCache.get(config.id)!;
  }
  
  // Check if already generating
  if (generationPromises.has(config.id)) {
    return generationPromises.get(config.id)!;
  }
  
  const promise = (async () => {
    try {
      await loadPuterScript();
      
      if (!isPuterAvailable()) {
        console.warn('Puter.js not available for video generation');
        return null;
      }
      
      onProgress?.(`Generating ${config.id}...`);
      
      // Use Puter's txt2vid API
      // @ts-ignore - puter is loaded dynamically
      const videoElement = await window.puter.ai.txt2vid(config.prompt, {
        model: 'ByteDance/Seedance-1.0-lite' // Fast generation for overlays
      });
      
      if (videoElement) {
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoCache.set(config.id, videoElement);
        onProgress?.(`${config.id} ready!`);
      }
      
      return videoElement;
    } catch (error) {
      console.error(`Failed to generate overlay ${config.id}:`, error);
      onProgress?.(`${config.id} failed`);
      return null;
    } finally {
      generationPromises.delete(config.id);
    }
  })();
  
  generationPromises.set(config.id, promise);
  return promise;
}

/**
 * Pre-generate all video overlays (call early to warm cache)
 */
export async function preGenerateAllOverlays(
  onProgress?: (completed: number, total: number, status: string) => void
): Promise<Map<string, HTMLVideoElement>> {
  const results = new Map<string, HTMLVideoElement>();
  const total = INTRO_VIDEO_OVERLAYS.length;
  
  for (let i = 0; i < total; i++) {
    const config = INTRO_VIDEO_OVERLAYS[i];
    onProgress?.(i, total, `Generating ${config.id}...`);
    
    const video = await generateVideoOverlay(config);
    if (video) {
      results.set(config.id, video);
    }
    
    onProgress?.(i + 1, total, `${config.id} complete`);
  }
  
  return results;
}

/**
 * Get active overlays for a given timestamp
 */
export function getActiveOverlays(elapsedMs: number): VideoOverlayConfig[] {
  return INTRO_VIDEO_OVERLAYS.filter(
    overlay => elapsedMs >= overlay.startTime && elapsedMs <= overlay.endTime
  );
}

/**
 * Calculate overlay opacity with fade in/out
 */
export function calculateOverlayOpacity(
  config: VideoOverlayConfig,
  elapsedMs: number,
  fadeInDuration: number = 1000,
  fadeOutDuration: number = 1500
): number {
  const { startTime, endTime, opacity } = config;
  
  if (elapsedMs < startTime || elapsedMs > endTime) {
    return 0;
  }
  
  // Fade in
  if (elapsedMs < startTime + fadeInDuration) {
    const progress = (elapsedMs - startTime) / fadeInDuration;
    return opacity * easeInOut(progress);
  }
  
  // Fade out
  if (elapsedMs > endTime - fadeOutDuration) {
    const progress = (endTime - elapsedMs) / fadeOutDuration;
    return opacity * easeInOut(progress);
  }
  
  // Full opacity
  return opacity;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
