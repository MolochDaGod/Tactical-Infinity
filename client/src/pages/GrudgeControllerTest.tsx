import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { RacalvinController } from '@/lib/racalvinController';
import { WorkbenchManager, WorkbenchInteractionState } from '@/lib/workbenchSystem';
import { WorkbenchInteractionUI } from '@/components/game/WorkbenchInteractionUI';
import { ProfessionWorkbench } from '@/data/assetManifest';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RACALVIN_PATH = "/models/characters/RacalvinDaWarrior";

const ANIMATION_FILES: Record<string, string> = {
  Idle: "sword and shield idle.fbx",
  Walk: "sword and shield walk.fbx",
  Run: "sword and shield run.fbx",
  Jump: "sword and shield jump.fbx",
  Attack: "sword and shield attack.fbx",
  Attack2: "sword and shield attack (2).fbx",
  Attack3: "sword and shield attack (3).fbx",
  Block: "sword and shield block.fbx",
  Death: "sword and shield death.fbx",
  Roll: "sword and shield crouch.fbx",
  Fall: "sword and shield jump.fbx",
  HitFront: "sword and shield impact.fbx",
  HitBack: "sword and shield impact.fbx",
  HitLeft: "sword and shield impact.fbx",
  HitRight: "sword and shield impact.fbx",
};

interface GrudgeControllerTestProps {
  onBack?: () => void;
}

export default function GrudgeControllerTest({ onBack }: GrudgeControllerTestProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controllerRef = useRef<RacalvinController | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentAnimRef = useRef<string>('Idle');
  const animationIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  const workbenchManagerRef = useRef<WorkbenchManager | null>(null);
  
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [workbenchState, setWorkbenchState] = useState<WorkbenchInteractionState>({
    nearestWorkbench: null,
    activeWorkbench: null,
    isInRange: false,
    holdProgress: 0,
    isModalOpen: false,
  });
  const [debugInfo, setDebugInfo] = useState({
    position: { x: 0, y: 0, z: 0 },
    velocity: 0,
    state: 'idle',
    cameraYaw: 0,
    bodyTilt: 0,
  });
  
  const { toast } = useToast();
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 300;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a7c4e,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    for (let i = 0; i < 10; i++) {
      const size = 1 + Math.random() * 2;
      const boxGeometry = new THREE.BoxGeometry(size, size * 2, size);
      const boxMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, 0.4, 0.3 + Math.random() * 0.3),
        roughness: 0.8,
      });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(
        (Math.random() - 0.5) * 60 + ((Math.random() > 0.5) ? 20 : -20),
        size,
        (Math.random() - 0.5) * 60 + ((Math.random() > 0.5) ? 20 : -20)
      );
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
    }
    
    const workbenchManager = new WorkbenchManager(scene);
    workbenchManagerRef.current = workbenchManager;
    
    workbenchManager.onStateChange((state) => {
      setWorkbenchState(state);
    });
    
    workbenchManager.onInteraction((workbench, action) => {
      if (action === 'quick') {
        toast({
          title: `Opening ${workbench.name}`,
          description: 'Quick crafting menu would open here.',
        });
      }
    });
    
    const workbenchPositions: Array<{ profession: 'mystic' | 'forester' | 'miner' | 'engineer' | 'chef', pos: THREE.Vector3, rot: number }> = [
      { profession: 'mystic', pos: new THREE.Vector3(-8, 0, 5), rot: Math.PI / 4 },
      { profession: 'forester', pos: new THREE.Vector3(-4, 0, 8), rot: 0 },
      { profession: 'miner', pos: new THREE.Vector3(4, 0, 8), rot: -Math.PI / 6 },
      { profession: 'engineer', pos: new THREE.Vector3(8, 0, 5), rot: -Math.PI / 4 },
      { profession: 'chef', pos: new THREE.Vector3(0, 0, 10), rot: Math.PI },
    ];
    
    workbenchPositions.forEach(({ profession, pos, rot }) => {
      workbenchManager.loadWorkbench(profession, pos, rot);
    });
    
    const controller = new RacalvinController({
      cameraDistance: 6,
      cameraHeight: 2.5,
      maxSpeed: 6,
      walkSpeed: 2.5,
      jumpVelocity: 8,
    });
    controller.setupInputListeners(container);
    controller.setPosition(0, 0, 0);
    controllerRef.current = controller;
    
    const fbxLoader = new FBXLoader();
    let loadedAnimations = 0;
    const totalAnimations = Object.keys(ANIMATION_FILES).length;
    
    fbxLoader.load(
      `${RACALVIN_PATH}/Meshy_AI_Orc_Warlord_Render_1220104017_texture_fbx.fbx`,
      (fbx) => {
        fbx.scale.setScalar(0.012);
        fbx.position.set(0, 0, 0);
        
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        scene.add(fbx);
        characterRef.current = fbx;
        
        const mixer = new THREE.AnimationMixer(fbx);
        mixerRef.current = mixer;
        
        Object.entries(ANIMATION_FILES).forEach(([name, file]) => {
          fbxLoader.load(
            `${RACALVIN_PATH}/${file}`,
            (animFbx) => {
              if (animFbx.animations.length > 0) {
                const clip = animFbx.animations[0];
                clip.name = name;
                const action = mixer.clipAction(clip);
                animationsRef.current.set(name, action);
              }
              loadedAnimations++;
              setLoadProgress(Math.round((loadedAnimations / totalAnimations) * 100));
              
              if (loadedAnimations >= totalAnimations) {
                setIsLoading(false);
                const idleAction = animationsRef.current.get('Idle');
                if (idleAction) {
                  idleAction.play();
                }
              }
            },
            undefined,
            () => {
              loadedAnimations++;
              setLoadProgress(Math.round((loadedAnimations / totalAnimations) * 100));
              if (loadedAnimations >= totalAnimations) {
                setIsLoading(false);
              }
            }
          );
        });
      },
      (progress) => {
        if (progress.total > 0) {
          setLoadProgress(Math.round((progress.loaded / progress.total) * 50));
        }
      },
      (error) => {
        console.error('Failed to load Racalvin model:', error);
        setIsLoading(false);
      }
    );
    
    const handlePointerLockChange = () => {
      setIsLocked(document.pointerLockElement === container);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    
    const handleFKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') {
        workbenchManagerRef.current?.handleKeyDown('f');
      }
    };
    const handleFKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') {
        workbenchManagerRef.current?.handleKeyUp('f');
      }
    };
    window.addEventListener('keydown', handleFKeyDown);
    window.addEventListener('keyup', handleFKeyUp);
    
    const playAnimation = (name: string, fadeIn: number = 0.2) => {
      const action = animationsRef.current.get(name);
      if (!action || currentAnimRef.current === name) return;
      
      const current = animationsRef.current.get(currentAnimRef.current);
      if (current) {
        current.fadeOut(fadeIn);
      }
      
      action.reset().fadeIn(fadeIn).play();
      currentAnimRef.current = name;
    };
    
    const animate = (time: number) => {
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      
      if (controllerRef.current) {
        controllerRef.current.update(delta, 0);
        
        if (cameraRef.current) {
          controllerRef.current.applyToCamera(cameraRef.current);
        }
        
        if (characterRef.current) {
          controllerRef.current.applyToCharacter(characterRef.current);
        }
        
        const animName = controllerRef.current.getAnimationName();
        playAnimation(animName);
        
        const char = controllerRef.current.character;
        const cam = controllerRef.current.camera;
        setDebugInfo({
          position: {
            x: Math.round(char.position.x * 10) / 10,
            y: Math.round(char.position.y * 10) / 10,
            z: Math.round(char.position.z * 10) / 10,
          },
          velocity: Math.round(char.forwardVel * 10) / 10,
          state: char.state,
          cameraYaw: Math.round(cam.yaw * 180 / Math.PI),
          bodyTilt: Math.round(char.bodyTilt * 180 / Math.PI * 10) / 10,
        });
        
        if (workbenchManagerRef.current) {
          const playerPos = new THREE.Vector3(char.position.x, char.position.y, char.position.z);
          workbenchManagerRef.current.update(playerPos, delta);
        }
      }
      
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      animationIdRef.current = requestAnimationFrame(animate);
    };
    
    animationIdRef.current = requestAnimationFrame(animate);
    
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationIdRef.current);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('keydown', handleFKeyDown);
      window.removeEventListener('keyup', handleFKeyUp);
      window.removeEventListener('resize', handleResize);
      workbenchManagerRef.current?.dispose();
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.forceContextLoss();
      rendererRef.current?.dispose();
    };
  }, []);
  
  return (
    <div className="relative w-full h-screen bg-black">
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-pointer"
        data-testid="grudge-controller-scene"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-center">
            <div className="text-white text-xl mb-4">Loading Racalvin...</div>
            <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all duration-200"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <div className="text-gray-400 text-sm mt-2">{loadProgress}%</div>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-background/80 backdrop-blur" 
          data-testid="button-back"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Game
        </Button>
      </div>
      
      <Card className="absolute top-4 right-4 z-10 w-72 bg-background/90 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            Grudge Controls (Mario64 + OpenLara)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Move</span>
            <span>WASD / Arrows</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jump</span>
            <span>Space (1x/2x/3x combo)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Attack</span>
            <span>Left Click (3-hit combo)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Block</span>
            <span>Right Click</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Roll/Dodge</span>
            <span>Shift (has i-frames)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Camera</span>
            <span>Mouse (click to lock)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">C-Buttons</span>
            <span>I/J/K/L</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interact</span>
            <span>F (hold for options)</span>
          </div>
          <div className="border-t pt-1 mt-2">
            <div className={`text-center ${isLocked ? 'text-green-500' : 'text-yellow-500'}`}>
              {isLocked ? 'Mouse Locked (ESC to unlock)' : 'Click scene to lock mouse'}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="absolute bottom-4 left-4 z-10 w-52 bg-background/90 backdrop-blur">
        <CardHeader className="pb-1 pt-2">
          <CardTitle className="text-xs text-muted-foreground">Debug Info</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-0.5 pb-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position</span>
            <span className="font-mono">{debugInfo.position.x}, {debugInfo.position.y}, {debugInfo.position.z}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Speed</span>
            <span className="font-mono">{debugInfo.velocity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">State</span>
            <span className="font-mono">{debugInfo.state}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cam Yaw</span>
            <span className="font-mono">{debugInfo.cameraYaw}deg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Body Tilt</span>
            <span className="font-mono">{debugInfo.bodyTilt}deg</span>
          </div>
        </CardContent>
      </Card>
      
      {!isLocked && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-5 pointer-events-none">
          <div className="text-white text-xl font-bold bg-black/50 px-6 py-3 rounded-lg">
            Click to start
          </div>
        </div>
      )}
      
      <WorkbenchInteractionUI
        interactionState={workbenchState}
        onCloseModal={() => workbenchManagerRef.current?.closeModal()}
        onQuickAction={(workbench) => {
          toast({
            title: `Opening ${workbench.name}`,
            description: 'Quick crafting menu would open here.',
          });
          workbenchManagerRef.current?.closeModal();
        }}
        onAssignAllies={(workbench) => {
          toast({
            title: 'Assign Allies',
            description: `You can assign NPCs to work at ${workbench.name}.`,
          });
          workbenchManagerRef.current?.closeModal();
        }}
        onOpenInventory={(workbench) => {
          toast({
            title: 'Workbench Inventory',
            description: `Viewing stored items at ${workbench.name}.`,
          });
          workbenchManagerRef.current?.closeModal();
        }}
        onConfigure={(workbench) => {
          if (workbench.animationType === 'fire') {
            const wb = workbenchState.activeWorkbench || workbenchState.nearestWorkbench;
            if (wb) {
              const newState = !wb.isActive;
              workbenchManagerRef.current?.toggleWorkbenchAnimation(wb.id, newState);
              toast({
                title: newState ? 'Fire Started' : 'Fire Extinguished',
                description: `The ${workbench.name} fire is now ${newState ? 'burning' : 'off'}.`,
              });
            }
          } else {
            toast({
              title: 'Configure',
              description: `Configuration options for ${workbench.name}.`,
            });
          }
          workbenchManagerRef.current?.closeModal();
        }}
      />
    </div>
  );
}
