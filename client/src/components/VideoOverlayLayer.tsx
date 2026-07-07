import { useEffect, useRef, useState, useCallback } from 'react';
import {
  INTRO_VIDEO_OVERLAYS,
  VideoOverlayConfig,
  generateVideoOverlay,
  calculateOverlayOpacity,
  isPuterAvailable,
  loadPuterScript
} from '@/lib/puterVideoOverlays';

interface VideoOverlayLayerProps {
  elapsedMs: number;
  isPlaying: boolean;
  enabled?: boolean;
  onGenerationProgress?: (status: string) => void;
}

interface OverlayState {
  config: VideoOverlayConfig;
  video: HTMLVideoElement | null;
  status: 'pending' | 'generating' | 'ready' | 'failed';
}

export default function VideoOverlayLayer({
  elapsedMs,
  isPlaying,
  enabled = true,
  onGenerationProgress
}: VideoOverlayLayerProps) {
  const [overlays, setOverlays] = useState<OverlayState[]>([]);
  const [puterReady, setPuterReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  
  // Initialize overlay states
  useEffect(() => {
    if (!enabled) return;
    
    setOverlays(INTRO_VIDEO_OVERLAYS.map(config => ({
      config,
      video: null,
      status: 'pending'
    })));
  }, [enabled]);
  
  // Load Puter.js
  useEffect(() => {
    if (!enabled) return;
    
    loadPuterScript()
      .then(() => {
        setPuterReady(true);
        onGenerationProgress?.('Puter.ai ready');
      })
      .catch(err => {
        console.warn('Puter.js failed to load:', err);
        onGenerationProgress?.('Video generation unavailable');
      });
  }, [enabled, onGenerationProgress]);
  
  // Generate videos when Puter is ready
  useEffect(() => {
    if (!puterReady || !enabled) return;
    
    overlays.forEach(async (overlay, index) => {
      if (overlay.status !== 'pending') return;
      
      // Update status to generating
      setOverlays(prev => prev.map((o, i) => 
        i === index ? { ...o, status: 'generating' } : o
      ));
      
      onGenerationProgress?.(`Generating ${overlay.config.id}...`);
      
      try {
        const video = await generateVideoOverlay(overlay.config, onGenerationProgress);
        
        if (video) {
          videoRefs.current.set(overlay.config.id, video);
          setOverlays(prev => prev.map((o, i) => 
            i === index ? { ...o, video, status: 'ready' } : o
          ));
          onGenerationProgress?.(`${overlay.config.id} ready`);
        } else {
          setOverlays(prev => prev.map((o, i) => 
            i === index ? { ...o, status: 'failed' } : o
          ));
        }
      } catch (error) {
        console.error(`Failed to generate ${overlay.config.id}:`, error);
        setOverlays(prev => prev.map((o, i) => 
          i === index ? { ...o, status: 'failed' } : o
        ));
      }
    });
  }, [puterReady, overlays, enabled, onGenerationProgress]);
  
  // Control video playback based on timing
  useEffect(() => {
    if (!isPlaying) return;
    
    overlays.forEach(overlay => {
      const video = videoRefs.current.get(overlay.config.id);
      if (!video || overlay.status !== 'ready') return;
      
      const { startTime, endTime } = overlay.config;
      const isActive = elapsedMs >= startTime && elapsedMs <= endTime;
      
      if (isActive && video.paused) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else if (!isActive && !video.paused) {
        video.pause();
      }
    });
  }, [elapsedMs, isPlaying, overlays]);
  
  if (!enabled) return null;
  
  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {overlays.map(overlay => {
        const opacity = calculateOverlayOpacity(overlay.config, elapsedMs);
        const isVisible = opacity > 0;
        
        if (!isVisible || overlay.status !== 'ready' || !overlay.video) {
          return null;
        }
        
        return (
          <div
            key={overlay.config.id}
            className="absolute inset-0"
            style={{
              opacity,
              zIndex: overlay.config.zIndex,
              mixBlendMode: overlay.config.blendMode,
              transition: 'opacity 0.3s ease'
            }}
          >
            <video
              ref={el => {
                if (el && overlay.video) {
                  el.srcObject = null;
                  el.src = overlay.video.src;
                }
              }}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>
        );
      })}
      
      {/* Generation status indicator */}
      <div className="absolute bottom-28 right-4 text-xs text-white/40 font-mono">
        {overlays.filter(o => o.status === 'ready').length}/{overlays.length} overlays
      </div>
    </div>
  );
}
