import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MixamoPlayerController, PLAYER_ANIMATION_MAP, type PlayerLoadProgress } from '@/lib/mixamoPlayerController';
import { ArenaCombat } from '@/lib/arenaCombat';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Gamepad2, Swords, Shield, Zap, Footprints, Eye, EyeOff, Target, Crosshair } from 'lucide-react';

interface PlayerArenaProps {
  onBack?: () => void;
}

export default function PlayerArena({ onBack }: PlayerArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MixamoPlayerController | null>(null);
  const combatRef = useRef<ArenaCombat | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());

  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingFile, setLoadingFile] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [showHUD, setShowHUD] = useState(true);
  const [showAnimPanel, setShowAnimPanel] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    state: 'idle' as string,
    position: { x: 0, y: 0, z: 0 },
    velocity: 0,
    isGrounded: true,
    isCrouching: false,
    isSprinting: false,
    isBlocking: false,
    attackCombo: 0,
    currentAnim: '',
    cameraYaw: 0,
    stamina: 1,
    lockedOn: false,
  });
  const [enemiesAlive, setEnemiesAlive] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

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
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffd4a0, 1.4);
    mainLight.position.set(40, 80, 30);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096;
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 200;
    mainLight.shadow.camera.left = -40;
    mainLight.shadow.camera.right = 40;
    mainLight.shadow.camera.top = 40;
    mainLight.shadow.camera.bottom = -40;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6088c0, 0.4);
    fillLight.position.set(-30, 40, -20);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff8844, 0.3);
    rimLight.position.set(-10, 20, -40);
    scene.add(rimLight);

    const groundRadius = 60;
    const groundGeom = new THREE.CircleGeometry(groundRadius, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d3a1e,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(120, 60, 0x3a4a2a, 0x2a3a1a);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const ringGeom = new THREE.RingGeometry(14.5, 15, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xaa8844, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    const obstacles: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillarGeom = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x665544,
        roughness: 0.7,
        metalness: 0.2,
      });
      const pillar = new THREE.Mesh(pillarGeom, pillarMat);
      pillar.position.set(Math.cos(angle) * 16, 2, Math.sin(angle) * 16);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
      obstacles.push(pillar);

      const fireLight = new THREE.PointLight(0xff6622, 0.8, 10);
      fireLight.position.set(Math.cos(angle) * 16, 4.5, Math.sin(angle) * 16);
      scene.add(fireLight);

      const fireGeom = new THREE.SphereGeometry(0.15, 8, 8);
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
      const fireMesh = new THREE.Mesh(fireGeom, fireMat);
      fireMesh.position.copy(fireLight.position);
      scene.add(fireMesh);
    }

    for (let i = 0; i < 6; i++) {
      const angle = ((i + 0.5) / 6) * Math.PI * 2;
      const r = 22 + Math.random() * 10;
      const h = 1.5 + Math.random() * 3;
      const rockGeom = new THREE.DodecahedronGeometry(h * 0.5, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, 0.15, 0.2 + Math.random() * 0.15),
        roughness: 0.9,
      });
      const rock = new THREE.Mesh(rockGeom, rockMat);
      rock.position.set(Math.cos(angle) * r, h * 0.3, Math.sin(angle) * r);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.set(1 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.5);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
      obstacles.push(rock);
    }

    const combat = new ArenaCombat(scene);
    combatRef.current = combat;
    setEnemiesAlive(combat.aliveCount);

    const controller = new MixamoPlayerController({
      cameraDistance: 6,
      cameraHeight: 2.5,
    });
    controllerRef.current = controller;

    controller.onProgress((progress: PlayerLoadProgress) => {
      setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
      setLoadingFile(progress.currentFile);
    });

    controller.onLoaded(() => {
      setIsLoading(false);
      controller.setupInput(container);
      controller.registerGroundMeshes([ground]);
      controller.registerCameraObstacles(obstacles);
    });

    // Combat: the controller fires onAttackHit during the swing's active frames.
    controller.onAttackHit(() => {
      const c = combatRef.current;
      if (!c) return;
      const origin = new THREE.Vector3(controller.position.x, 0, controller.position.z);
      const hits = c.resolveHit(origin, controller.rotation);
      if (hits.length > 0) {
        const killed = hits.some((h) => h.killed);
        controller.addCameraShake(killed ? 0.5 : 0.28);
        setEnemiesAlive(c.aliveCount);
      }
    });

    controller.load(scene).catch((err) => {
      console.error('Failed to load player:', err);
      setIsLoading(false);
    });

    const handlePointerLockChange = () => {
      setIsLocked(document.pointerLockElement === container);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Tab → toggle lock-on to the nearest living dummy (clears if already locked).
    const handleLockOn = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      e.preventDefault();
      const c = combatRef.current;
      if (!c) return;
      if (controller.lockTarget) {
        controller.setLockTarget(null);
      } else {
        const near = c.nearest(controller.position);
        controller.setLockTarget(near ? near.hitTarget : null);
      }
    };
    window.addEventListener('keydown', handleLockOn);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let debugCounter = 0;
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = clockRef.current.getDelta();

      if (controller.isLoaded && camera) {
        controller.update(dt, camera);
        controller.applyCamera(camera);
      }

      combat.update(dt, camera);

      if (controller.isLoaded) {
        debugCounter++;
        if (debugCounter % 6 === 0) {
          setDebugInfo(controller.getDebugInfo());
          setEnemiesAlive(combat.aliveCount);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleLockOn);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      combat.dispose();
      combatRef.current = null;
      controller.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handlePlayAnimation = useCallback((name: string) => {
    controllerRef.current?.playAnimationByName(name);
  }, []);

  const animCategories = Object.entries(PLAYER_ANIMATION_MAP).reduce((acc, [name, info]) => {
    if (!acc[info.category]) acc[info.category] = [];
    acc[info.category].push(name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="h-screen w-full relative bg-black">
      <div ref={containerRef} className="w-full h-full" data-testid="player-arena-canvas" />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50" data-testid="loading-screen">
          <Gamepad2 className="w-12 h-12 text-amber-400 mb-4 animate-pulse" />
          <p className="text-lg text-amber-200 font-cinzel mb-2">Loading Warrior</p>
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-200"
              style={{ width: `${loadProgress}%` }}
              data-testid="loading-progress-bar"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 truncate max-w-xs">{loadingFile}</p>
          <p className="text-sm text-gray-400 mt-1">{loadProgress}%</p>
        </div>
      )}

      {!isLoading && !isLocked && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <Card className="pointer-events-auto bg-black/70 border-amber-800/50 text-center max-w-sm">
            <CardContent className="p-6">
              <Gamepad2 className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <p className="text-amber-200 text-lg font-semibold mb-1">Click to Play</p>
              <p className="text-gray-400 text-sm">Click anywhere to lock your mouse and control the character</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="absolute top-4 left-4 z-30 flex gap-2">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="bg-black/50 text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowHUD(!showHUD)}
          className="bg-black/50 text-white"
          data-testid="button-toggle-hud"
        >
          {showHUD ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowAnimPanel(!showAnimPanel)}
          className="bg-black/50 text-white"
          data-testid="button-toggle-anim-panel"
        >
          <Swords className="w-5 h-5" />
        </Button>
      </div>

      {!isLoading && (
        <>
          {/* Top-center: enemies remaining + lock-on status */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none flex flex-col items-center gap-1">
            <Badge
              variant="outline"
              className="bg-black/60 text-red-300 border-red-800/60 gap-1"
              data-testid="badge-enemies-remaining"
            >
              <Swords className="w-3 h-3" /> Dummies standing: {enemiesAlive}
            </Badge>
            {debugInfo.lockedOn && (
              <Badge
                variant="outline"
                className="bg-black/60 text-amber-300 border-amber-700/60 gap-1 animate-pulse"
                data-testid="badge-lock-on"
              >
                <Target className="w-3 h-3" /> Locked On
              </Badge>
            )}
          </div>

          {/* Center crosshair (combat readability) */}
          {isLocked && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <Crosshair className={`w-6 h-6 ${debugInfo.lockedOn ? 'text-amber-400' : 'text-white/40'}`} />
            </div>
          )}

          {/* Stamina bar (bottom-center) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none w-64" data-testid="stamina-bar">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
              <div className="h-2.5 flex-1 bg-gray-900/80 rounded-full overflow-hidden border border-yellow-900/40">
                <div
                  className={`h-full transition-[width] duration-100 ${
                    debugInfo.stamina < 0.25
                      ? 'bg-gradient-to-r from-red-700 to-red-500'
                      : 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                  }`}
                  style={{ width: `${Math.round(debugInfo.stamina * 100)}%` }}
                  data-testid="stamina-fill"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {showHUD && !isLoading && (
        <>
          <div className="absolute bottom-4 left-4 z-30 pointer-events-none select-none" data-testid="debug-panel">
            <Card className="bg-black/60 border-gray-700/50 w-56">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-amber-300 border-amber-700" data-testid="badge-state">
                    {debugInfo.state}
                  </Badge>
                  <Badge variant="outline" className="text-blue-300 border-blue-700" data-testid="badge-anim">
                    {debugInfo.currentAnim}
                  </Badge>
                </div>
                <p className="text-[10px] text-gray-400">
                  Pos: {debugInfo.position.x}, {debugInfo.position.y}, {debugInfo.position.z}
                </p>
                <p className="text-[10px] text-gray-400">
                  Vel: {debugInfo.velocity} | Yaw: {debugInfo.cameraYaw}
                </p>
                <div className="flex gap-1 flex-wrap">
                  {debugInfo.isGrounded && <Badge variant="secondary" className="text-[9px] px-1 py-0">GND</Badge>}
                  {debugInfo.isCrouching && <Badge variant="secondary" className="text-[9px] px-1 py-0">CRC</Badge>}
                  {debugInfo.isSprinting && <Badge variant="secondary" className="text-[9px] px-1 py-0">SPR</Badge>}
                  {debugInfo.isBlocking && <Badge variant="secondary" className="text-[9px] px-1 py-0">BLK</Badge>}
                  {debugInfo.attackCombo > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0">CMB:{debugInfo.attackCombo}</Badge>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="absolute bottom-4 right-4 z-30 pointer-events-none select-none" data-testid="controls-panel">
            <Card className="bg-black/60 border-gray-700/50 w-72">
              <CardContent className="p-3">
                <p className="text-xs text-amber-300 font-semibold mb-2 flex items-center gap-1">
                  <Gamepad2 className="w-3 h-3" /> Controls
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-300">
                  <span className="flex items-center gap-1"><Footprints className="w-3 h-3 text-green-400" /> WASD</span>
                  <span>Move</span>
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> Shift</span>
                  <span>Sprint</span>
                  <span className="flex items-center gap-1"><Footprints className="w-3 h-3 text-blue-400" /> Space</span>
                  <span>Jump</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-cyan-400" /> Ctrl</span>
                  <span>Dodge / Roll</span>
                  <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-red-400" /> LMB</span>
                  <span>Attack (combo)</span>
                  <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-orange-400" /> RMB</span>
                  <span>Slash (heavy)</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-purple-400" /> RMB hold</span>
                  <span>Block</span>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3 text-amber-400" /> Tab</span>
                  <span>Lock-on toggle</span>
                  <span className="text-gray-500">C</span>
                  <span>Crouch toggle</span>
                  <span className="text-amber-500">1-0</span>
                  <span>Special anims</span>
                </div>
                <div className="mt-2 pt-1 border-t border-gray-700/50">
                  <p className="text-[9px] text-gray-500 mb-1">Hotkeys (1-0):</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0 text-[9px] text-gray-400">
                    <span>1: Cast Spell</span>
                    <span>2: Cast Spell 2</span>
                    <span>3: Power Up</span>
                    <span>4: Kick</span>
                    <span>5: Draw Sword</span>
                    <span>6: Sheath Sword</span>
                    <span>7: Death 1</span>
                    <span>8: Death 2</span>
                    <span>9: Turn 180</span>
                    <span>0: Hit React</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {showAnimPanel && !isLoading && (
        <div className="absolute top-16 right-4 z-30 w-64" data-testid="animation-panel">
          <Card className="bg-black/80 border-gray-700/50">
            <CardContent className="p-2">
              <p className="text-xs text-amber-300 font-semibold mb-2">Animations ({Object.keys(PLAYER_ANIMATION_MAP).length})</p>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-2">
                  {Object.entries(animCategories).map(([category, anims]) => (
                    <div key={category}>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{category}</p>
                      <div className="flex flex-wrap gap-1">
                        {anims.map((name) => (
                          <Button
                            key={name}
                            variant="ghost"
                            className={`text-[10px] h-6 px-2 ${
                              debugInfo.currentAnim === name
                                ? 'bg-amber-900/50 text-amber-300'
                                : 'text-gray-300 bg-gray-800/50'
                            }`}
                            onClick={() => handlePlayAnimation(name)}
                            data-testid={`button-anim-${name}`}
                          >
                            {name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
