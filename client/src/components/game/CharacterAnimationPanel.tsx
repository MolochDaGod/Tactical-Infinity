import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User, Play, Square, Save, RotateCcw } from 'lucide-react';

export type AnimationEventType = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'death' | 'jump' | 'block' | 'cast' | 'celebrate';

export interface AnimationMapping {
  event: AnimationEventType;
  animationName: string;
}

interface CharacterAnimationPanelProps {
  onAnimationMappingsChange?: (mappings: AnimationMapping[]) => void;
  initialMappings?: AnimationMapping[];
}

const EVENT_TYPES: { value: AnimationEventType; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'attack', label: 'Attack' },
  { value: 'hit', label: 'Take Hit' },
  { value: 'death', label: 'Death' },
  { value: 'jump', label: 'Jump' },
  { value: 'block', label: 'Block' },
  { value: 'cast', label: 'Cast Spell' },
  { value: 'celebrate', label: 'Celebrate' },
];

export function CharacterAnimationPanel({
  onAnimationMappingsChange,
  initialMappings = [],
}: CharacterAnimationPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const animationFrameRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [animationNames, setAnimationNames] = useState<string[]>([]);
  const [currentAnimation, setCurrentAnimation] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [mappings, setMappings] = useState<AnimationMapping[]>(initialMappings);
  const [selectedEvent, setSelectedEvent] = useState<AnimationEventType>('idle');

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = 200;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 3);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 10;
    controls.minDistance = 1;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(4, 8, 0x444444, 0x222222);
    scene.add(gridHelper);

    loadCharacter();
  }, []);

  const loadCharacter = async () => {
    if (!sceneRef.current) return;

    const loader = new GLTFLoader();

    try {
      const [characterGltf, animationsGltf] = await Promise.all([
        loader.loadAsync('/models/characters/meshy_character.glb'),
        loader.loadAsync('/models/characters/meshy_animations.glb')
      ]);

      const model = characterGltf.scene;
      model.scale.setScalar(1);
      model.position.set(0, 0, 0);

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      sceneRef.current.add(model);
      modelRef.current = model;

      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;

      const allClips = [...characterGltf.animations, ...animationsGltf.animations];
      const names: string[] = [];

      allClips.forEach((clip) => {
        const action = mixer.clipAction(clip);
        actionsRef.current.set(clip.name, action);
        names.push(clip.name);
      });

      setAnimationNames(names);
      setIsLoaded(true);

      if (names.length > 0) {
        playAnimation(names[0]);
        setCurrentAnimation(names[0]);
      }
    } catch (error) {
      console.error('Failed to load character for animation panel:', error);
    }
  };

  const playAnimation = (name: string) => {
    const action = actionsRef.current.get(name);
    if (!action || !mixerRef.current) return;

    if (currentActionRef.current && currentActionRef.current !== action) {
      currentActionRef.current.fadeOut(0.3);
    }

    action.reset();
    action.fadeIn(0.3);
    action.play();
    currentActionRef.current = action;
    setCurrentAnimation(name);
    setIsPlaying(true);
  };

  const stopAnimation = () => {
    if (currentActionRef.current) {
      currentActionRef.current.stop();
      setIsPlaying(false);
    }
  };

  const resetPose = () => {
    if (modelRef.current) {
      modelRef.current.rotation.set(0, 0, 0);
      modelRef.current.position.set(0, 0, 0);
    }
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 1.5, 3);
      controlsRef.current.target.set(0, 1, 0);
      controlsRef.current.update();
    }
  };

  const assignAnimationToEvent = (event: AnimationEventType, animationName: string) => {
    const newMappings = mappings.filter(m => m.event !== event);
    newMappings.push({ event, animationName });
    setMappings(newMappings);
    onAnimationMappingsChange?.(newMappings);
  };

  const getMappedAnimation = (event: AnimationEventType): string => {
    const mapping = mappings.find(m => m.event === event);
    return mapping?.animationName || '';
  };

  const animate = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    const delta = clockRef.current.getDelta();

    if (mixerRef.current && isPlaying) {
      mixerRef.current.update(delta);
    }

    if (controlsRef.current) {
      controlsRef.current.update();
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isExpanded && containerRef.current && !sceneRef.current) {
      initScene();
    }
  }, [isExpanded, initScene]);

  useEffect(() => {
    if (isExpanded && sceneRef.current) {
      animate();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isExpanded, animate]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.forceContextLoss();
        rendererRef.current.dispose();
      }
      actionsRef.current.clear();
    };
  }, []);

  return (
    <Card className="bg-background/95 backdrop-blur-sm">
      <CardHeader 
        className="pb-2 cursor-pointer flex flex-row items-center justify-between gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="w-4 h-4" />
          Character Animations
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {animationNames.length} clips
        </Badge>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div 
            ref={containerRef} 
            className="w-full h-[200px] rounded-md overflow-hidden border"
            data-testid="character-preview-canvas"
          />

          {isLoaded && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Play Animation</Label>
                <div className="flex gap-2">
                  <Select value={currentAnimation} onValueChange={playAnimation}>
                    <SelectTrigger className="flex-1" data-testid="select-animation">
                      <SelectValue placeholder="Select animation" />
                    </SelectTrigger>
                    <SelectContent>
                      {animationNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant={isPlaying ? 'default' : 'outline'}
                    onClick={() => isPlaying ? stopAnimation() : playAnimation(currentAnimation)}
                    data-testid="button-toggle-play"
                  >
                    {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={resetPose}
                    data-testid="button-reset-pose"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs">Map Animation to Event</Label>
                <div className="flex gap-2">
                  <Select value={selectedEvent} onValueChange={(v) => setSelectedEvent(v as AnimationEventType)}>
                    <SelectTrigger className="flex-1" data-testid="select-event-type">
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          {event.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={() => assignAnimationToEvent(selectedEvent, currentAnimation)}
                    disabled={!currentAnimation}
                    data-testid="button-assign-animation"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Current Mappings</Label>
                <div className="flex flex-wrap gap-1">
                  {EVENT_TYPES.map((event) => {
                    const mapped = getMappedAnimation(event.value);
                    return (
                      <Badge
                        key={event.value}
                        variant={mapped ? 'default' : 'outline'}
                        className="text-xs cursor-pointer"
                        onClick={() => {
                          if (mapped) {
                            playAnimation(mapped);
                          }
                        }}
                        data-testid={`badge-mapping-${event.value}`}
                      >
                        {event.label}: {mapped || 'None'}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!isLoaded && (
            <div className="text-center text-muted-foreground text-sm py-4">
              Loading character...
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
