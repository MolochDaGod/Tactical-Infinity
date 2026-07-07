import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Target, Crosshair, Flame, Zap, Anchor, Castle, Sword } from "lucide-react";
import { Link } from "wouter";
import { 
  TurretManager, 
  ScriptableTurret,
  type TurretType,
  type ProjectileType,
  type TrajectoryType,
  type Target as TurretTarget,
  createTurretConfig,
  createCharacterRangedAttack,
  createShipCannon,
  createGuardTower
} from "@/lib/scriptableTurret";
import { 
  PolygonJSEffectsManager,
  createProjectileMuzzleEffect,
  createProjectileImpactEffect,
  createProjectileTrailEffect,
} from "@/lib/polygonJSEffects";

interface DummyTarget {
  id: string;
  mesh: THREE.Mesh;
  health: number;
  maxHealth: number;
  velocity: THREE.Vector3;
  isAirborne: boolean;
}

const TURRET_TYPES: { value: TurretType; label: string; icon: React.ReactNode }[] = [
  { value: 'bow', label: 'Bow', icon: <Target className="w-4 h-4" /> },
  { value: 'crossbow', label: 'Crossbow', icon: <Crosshair className="w-4 h-4" /> },
  { value: 'gun', label: 'Gun', icon: <Zap className="w-4 h-4" /> },
  { value: 'cannon', label: 'Cannon', icon: <Anchor className="w-4 h-4" /> },
  { value: 'magic_staff', label: 'Magic Staff', icon: <Flame className="w-4 h-4" /> },
  { value: 'magic_tome', label: 'Magic Tome', icon: <Sword className="w-4 h-4" /> },
  { value: 'guard_tower', label: 'Guard Tower', icon: <Castle className="w-4 h-4" /> },
  { value: 'ship_cannon', label: 'Ship Cannon', icon: <Anchor className="w-4 h-4" /> },
];

const PROJECTILE_TYPES: { value: ProjectileType; label: string }[] = [
  { value: 'arrow', label: 'Arrow' },
  { value: 'bolt', label: 'Crossbow Bolt' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'cannonball', label: 'Cannonball' },
  { value: 'magic_missile', label: 'Magic Missile' },
  { value: 'fireball', label: 'Fireball' },
  { value: 'ice_shard', label: 'Ice Shard' },
  { value: 'lightning', label: 'Lightning' },
];

export default function TurretDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const turretManagerRef = useRef<TurretManager | null>(null);
  const effectsManagerRef = useRef<PolygonJSEffectsManager | null>(null);
  const animationIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const targetsRef = useRef<DummyTarget[]>([]);
  const turretMeshRef = useRef<THREE.Group | null>(null);
  const currentTurretRef = useRef<ScriptableTurret | null>(null);
  
  const [turretType, setTurretType] = useState<TurretType>('bow');
  const [projectileType, setProjectileType] = useState<ProjectileType>('arrow');
  const [trajectoryType, setTrajectoryType] = useState<TrajectoryType>('ballistic');
  const [targetCount, setTargetCount] = useState(5);
  const [showRange, setShowRange] = useState(true);
  const [autoSpawnTargets, setAutoSpawnTargets] = useState(true);
  const [turretState, setTurretState] = useState('idle');
  const [projectileCount, setProjectileCount] = useState(0);
  const [hits, setHits] = useState(0);
  const [kills, setKills] = useState(0);
  const [useSplineTrajectory, setUseSplineTrajectory] = useState(false);
  const [showSplinePath, setShowSplinePath] = useState(true);
  const [splineTension, setSplineTension] = useState(0.5);
  const [splineArcHeight, setSplineArcHeight] = useState(5);
  const [waveAmplitude, setWaveAmplitude] = useState(2);
  const [waveFrequency, setWaveFrequency] = useState(4);
  const [spiralRadius, setSpiralRadius] = useState(1);
  const [spiralSpeed, setSpiralSpeed] = useState(8);
  const [seekingTurnRate, setSeekingTurnRate] = useState(180);
  const [trailEnabled, setTrailEnabled] = useState(true);
  
  const [useScatterShot, setUseScatterShot] = useState(false);
  const [scatterDistance, setScatterDistance] = useState(10);
  const [scatterChildCount, setScatterChildCount] = useState(6);
  const [scatterSpreadAngle, setScatterSpreadAngle] = useState(45);
  const [scatterPattern, setScatterPattern] = useState<'cone' | 'sphere' | 'ring' | 'random'>('cone');
  const [webglError, setWebglError] = useState<string | null>(null);

  const createDummyTarget = useCallback((scene: THREE.Scene, index: number): DummyTarget => {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0x441111,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    const angle = (index / targetCount) * Math.PI * 2;
    const distance = 15 + Math.random() * 10;
    mesh.position.set(
      Math.cos(angle) * distance,
      0.5 + Math.random() * 2,
      Math.sin(angle) * distance
    );
    mesh.castShadow = true;
    scene.add(mesh);
    
    const speed = 1 + Math.random() * 2;
    const moveAngle = Math.random() * Math.PI * 2;
    
    return {
      id: `target_${index}_${Date.now()}`,
      mesh,
      health: 100,
      maxHealth: 100,
      velocity: new THREE.Vector3(
        Math.cos(moveAngle) * speed,
        0,
        Math.sin(moveAngle) * speed
      ),
      isAirborne: mesh.position.y > 2,
    };
  }, [targetCount]);

  const updateTargets = useCallback((deltaTime: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    const toRemove: DummyTarget[] = [];
    
    for (const target of targetsRef.current) {
      target.mesh.position.add(target.velocity.clone().multiplyScalar(deltaTime));
      
      const dist = Math.sqrt(target.mesh.position.x ** 2 + target.mesh.position.z ** 2);
      if (dist > 40 || target.health <= 0) {
        toRemove.push(target);
      }
      
      if (dist > 30) {
        const toCenter = target.mesh.position.clone().negate().normalize();
        target.velocity.lerp(toCenter.multiplyScalar(2), 0.02);
      }
    }
    
    for (const target of toRemove) {
      scene.remove(target.mesh);
      target.mesh.geometry.dispose();
      (target.mesh.material as THREE.Material).dispose();
      const index = targetsRef.current.indexOf(target);
      if (index !== -1) {
        targetsRef.current.splice(index, 1);
      }
      if (target.health <= 0) {
        setKills(k => k + 1);
      }
    }
    
    if (autoSpawnTargets && targetsRef.current.length < targetCount) {
      const newTarget = createDummyTarget(scene, targetsRef.current.length);
      targetsRef.current.push(newTarget);
    }
    
    turretManagerRef.current?.setTargets(targetsRef.current.map(t => ({
      id: t.id,
      position: t.mesh.position.clone(),
      velocity: t.velocity.clone(),
      health: t.health,
      maxHealth: t.maxHealth,
      isAirborne: t.isAirborne,
      radius: 0.5,
    })));
  }, [autoSpawnTargets, targetCount, createDummyTarget]);

  const createTurretMesh = useCallback((scene: THREE.Scene): THREE.Group => {
    const group = new THREE.Group();
    
    const baseGeometry = new THREE.CylinderGeometry(0.8, 1, 0.5, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);
    
    const turretGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const turretMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5 });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 0.7;
    turret.castShadow = true;
    group.add(turret);
    
    const barrelGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 8);
    const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.7, 0.8);
    barrel.castShadow = true;
    barrel.name = 'barrel';
    group.add(barrel);
    
    scene.add(group);
    return group;
  }, []);

  const setupTurret = useCallback((
    type: TurretType, 
    projType: ProjectileType, 
    trajectory: TrajectoryType = 'ballistic',
    splineShowPath = true, 
    tension = 0.5, 
    arcHeight = 5,
    enableScatter = false,
    scatterDist = 10,
    scatterCount = 6,
    scatterAngle = 45,
    scatterPatternType: 'cone' | 'sphere' | 'ring' | 'random' = 'cone',
    waveAmp = 2,
    waveFreq = 4,
    spiralRad = 1,
    spiralSpd = 8,
    seekTurnRate = 180,
    enableTrail = true
  ) => {
    const scene = sceneRef.current;
    const manager = turretManagerRef.current;
    const effectsManager = effectsManagerRef.current;
    
    if (!scene || !manager) return;
    
    if (currentTurretRef.current) {
      manager.removeTurret(currentTurretRef.current);
    }
    
    if (turretMeshRef.current) {
      scene.remove(turretMeshRef.current);
      turretMeshRef.current = null;
    }
    
    const turretMesh = createTurretMesh(scene);
    turretMeshRef.current = turretMesh;
    
    const config = createTurretConfig(type, projType);
    
    config.projectile.trajectory = trajectory;
    config.projectile.trailEnabled = enableTrail;
    config.projectile.trailLength = 15;
    config.projectile.trailWidth = 0.1;
    config.projectile.glowIntensity = 0.5;
    
    if (trajectory === 'spline') {
      config.projectile.splineConfig = {
        curveType: 'centripetal',
        tension: tension,
        arcHeight: arcHeight,
        controlPointOffset: 0.3,
        showPath: splineShowPath,
        pathColor: 0x00ff88,
        pathSegments: 50,
      };
    }
    
    if (trajectory === 'wave') {
      config.projectile.waveConfig = {
        amplitude: waveAmp,
        frequency: waveFreq,
        axis: 'both',
      };
    }
    
    if (trajectory === 'spiral') {
      config.projectile.spiralConfig = {
        radius: spiralRad,
        rotationSpeed: spiralSpd,
        expansionRate: 0.3,
      };
    }
    
    if (trajectory === 'boomerang') {
      config.projectile.boomerangConfig = {
        returnDelay: 0.7,
        curveRadius: 8,
        spinSpeed: 15,
      };
      config.projectile.spinRate = 20;
    }
    
    if (trajectory === 'seeking') {
      config.projectile.seekingConfig = {
        turnRate: seekTurnRate,
        acceleration: 25,
        maxSpeed: 60,
        predictionTime: 0.3,
      };
    }
    
    if (enableScatter) {
      config.projectile.scatterConfig = {
        enabled: true,
        splitDistance: scatterDist,
        childCount: scatterCount,
        spreadAngle: scatterAngle,
        pattern: scatterPatternType,
        childScale: config.projectile.scale * 0.5,
        childDamage: config.projectile.damage * 0.3,
        childSpeed: config.projectile.speed * 0.8,
        childTrajectory: 'ballistic',
        inheritVelocity: true,
        chainScatter: false,
      };
    }
    
    const turret = new ScriptableTurret(scene, config, new THREE.Vector3(0, 0, 0));
    
    const barrel = turretMesh.getObjectByName('barrel');
    turret.setTurretMesh(turretMesh, barrel || undefined);
    
    turret.onFire((projectile) => {
      setProjectileCount(c => c + 1);
      if (effectsManager && projectile.config.muzzleEffect) {
        const muzzlePos = turretMesh.position.clone();
        muzzlePos.y += 0.7;
        muzzlePos.z += 1;
        if (projectile.config.muzzleEffect === 'cannon_smoke') {
          createProjectileMuzzleEffect(effectsManager, muzzlePos, 'cannon_smoke');
        } else {
          createProjectileMuzzleEffect(effectsManager, muzzlePos, 'muzzle_flash');
        }
      }
    });
    
    turret.onHit((projectile, target, position) => {
      setHits(h => h + 1);
      
      if (target) {
        const dummyTarget = targetsRef.current.find(t => t.id === target.id);
        if (dummyTarget) {
          dummyTarget.health -= projectile.config.damage;
          const healthPercent = dummyTarget.health / dummyTarget.maxHealth;
          (dummyTarget.mesh.material as THREE.MeshStandardMaterial).color.setHSL(
            healthPercent * 0.15,
            0.8,
            0.4
          );
        }
      }
      
      if (effectsManager) {
        const impactType = projectile.config.impactEffect;
        if (impactType === 'explosion' || projectile.config.type === 'cannonball') {
          createProjectileImpactEffect(effectsManager, position, 'explosion');
        } else if (impactType === 'fire_explosion' || projectile.config.type === 'fireball') {
          createProjectileImpactEffect(effectsManager, position, 'fire_explosion');
        } else if (impactType === 'arcane_burst' || projectile.config.type === 'magic_missile') {
          createProjectileImpactEffect(effectsManager, position, 'arcane_burst');
        } else if (impactType === 'ice_shatter' || projectile.config.type === 'ice_shard') {
          createProjectileImpactEffect(effectsManager, position, 'ice_shatter');
        } else if (impactType === 'lightning_strike' || projectile.config.type === 'lightning') {
          createProjectileImpactEffect(effectsManager, position, 'lightning_strike');
        } else if (projectile.config.type === 'bullet') {
          createProjectileImpactEffect(effectsManager, position, 'impact_bullet');
        } else {
          createProjectileImpactEffect(effectsManager, position, 'impact_arrow');
        }
      }
    });
    
    turret.onScatter((parent, children) => {
      setProjectileCount(c => c + children.length);
      if (effectsManager) {
        createProjectileImpactEffect(effectsManager, parent.mesh.position.clone(), 'arcane_burst');
      }
    });
    
    manager.addTurret(turret);
    currentTurretRef.current = turret;
  }, [createTurretMesh]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      console.error('Failed to create WebGL renderer:', e);
      setWebglError('WebGL is not available in this browser. Please use a browser with WebGL support.');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.update();
    controlsRef.current = controls;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    scene.add(directionalLight);
    
    const groundGeometry = new THREE.PlaneGeometry(80, 80);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d4a3e,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    const gridHelper = new THREE.GridHelper(80, 40, 0x444444, 0x333333);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    
    const effectsManager = new PolygonJSEffectsManager(scene);
    effectsManagerRef.current = effectsManager;
    
    const turretManager = new TurretManager(scene);
    turretManagerRef.current = turretManager;
    
    for (let i = 0; i < targetCount; i++) {
      const target = createDummyTarget(scene, i);
      targetsRef.current.push(target);
    }
    
    setupTurret(turretType, projectileType);
    
    let trailSpawnTimer = 0;
    const trailSpawnInterval = 0.05;
    
    const animate = (time: number) => {
      const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      
      controls.update();
      
      updateTargets(deltaTime);
      turretManager.update(deltaTime);
      effectsManager.update(deltaTime);
      
      trailSpawnTimer += deltaTime;
      if (trailSpawnTimer >= trailSpawnInterval && currentTurretRef.current) {
        trailSpawnTimer = 0;
        const projectiles = currentTurretRef.current.getProjectiles();
        for (const proj of projectiles) {
          if (proj.config.trailEffect) {
            const trailType = proj.config.trailEffect;
            if (trailType === 'arrow_trail') {
              createProjectileTrailEffect(effectsManager, proj.mesh.position.clone(), 'arrow_trail');
            } else if (trailType === 'magic_trail') {
              createProjectileTrailEffect(effectsManager, proj.mesh.position.clone(), 'magic_trail');
            } else if (trailType === 'fire_trail') {
              createProjectileTrailEffect(effectsManager, proj.mesh.position.clone(), 'fire_trail');
            }
          }
        }
      }
      
      if (currentTurretRef.current) {
        setTurretState(currentTurretRef.current.getState());
      }
      
      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    };
    
    animationIdRef.current = requestAnimationFrame(animate);
    
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('resize', handleResize);
      
      for (const target of targetsRef.current) {
        scene.remove(target.mesh);
        target.mesh.geometry.dispose();
        (target.mesh.material as THREE.Material).dispose();
      }
      targetsRef.current = [];
      
      turretManager.dispose();
      effectsManager.dispose();
      
      controls.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (turretManagerRef.current && sceneRef.current) {
      const effectiveTrajectory = useSplineTrajectory ? 'spline' : trajectoryType;
      setupTurret(
        turretType, 
        projectileType,
        effectiveTrajectory,
        showSplinePath, 
        splineTension, 
        splineArcHeight,
        useScatterShot,
        scatterDistance,
        scatterChildCount,
        scatterSpreadAngle,
        scatterPattern,
        waveAmplitude,
        waveFrequency,
        spiralRadius,
        spiralSpeed,
        seekingTurnRate,
        trailEnabled
      );
    }
  }, [turretType, projectileType, trajectoryType, useSplineTrajectory, showSplinePath, splineTension, splineArcHeight, useScatterShot, scatterDistance, scatterChildCount, scatterSpreadAngle, scatterPattern, waveAmplitude, waveFrequency, spiralRadius, spiralSpeed, seekingTurnRate, trailEnabled, setupTurret]);

  const handleClearStats = () => {
    setProjectileCount(0);
    setHits(0);
    setKills(0);
  };

  if (webglError) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <CardHeader>
            <CardTitle className="text-red-500">WebGL Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{webglError}</p>
            <Link href="/admin">
              <Button variant="outline" data-testid="button-back-webgl-error">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-cinzel font-bold">Scriptable Turret Demo</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Turret: {turretState}</Badge>
          <Badge>Projectiles: {projectileCount}</Badge>
          <Badge variant="secondary">Hits: {hits}</Badge>
          <Badge className="bg-red-600">Kills: {kills}</Badge>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r p-4 overflow-y-auto space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Turret Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Turret Type</Label>
                <Select value={turretType} onValueChange={(v) => setTurretType(v as TurretType)}>
                  <SelectTrigger data-testid="select-turret-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TURRET_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          {t.icon}
                          <span>{t.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Projectile Type</Label>
                <Select value={projectileType} onValueChange={(v) => setProjectileType(v as ProjectileType)}>
                  <SelectTrigger data-testid="select-projectile-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECTILE_TYPES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Trajectory Type</Label>
                <Select value={trajectoryType} onValueChange={(v) => setTrajectoryType(v as TrajectoryType)}>
                  <SelectTrigger data-testid="select-trajectory-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight">Straight</SelectItem>
                    <SelectItem value="ballistic">Ballistic (Arc)</SelectItem>
                    <SelectItem value="homing">Homing</SelectItem>
                    <SelectItem value="spline">Spline Curve</SelectItem>
                    <SelectItem value="wave">Wave (Sinusoidal)</SelectItem>
                    <SelectItem value="spiral">Spiral</SelectItem>
                    <SelectItem value="boomerang">Boomerang</SelectItem>
                    <SelectItem value="seeking">Seeking Missile</SelectItem>
                    <SelectItem value="beam">Beam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Enable Trail</Label>
                <Switch
                  checked={trailEnabled}
                  onCheckedChange={setTrailEnabled}
                  data-testid="switch-trail-enabled"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Trajectory Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trajectoryType === 'wave' && (
                <>
                  <div className="space-y-2">
                    <Label>Wave Amplitude: {waveAmplitude}</Label>
                    <Slider
                      value={[waveAmplitude]}
                      onValueChange={([v]) => setWaveAmplitude(v)}
                      min={0.5}
                      max={5}
                      step={0.5}
                      data-testid="slider-wave-amplitude"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wave Frequency: {waveFrequency}</Label>
                    <Slider
                      value={[waveFrequency]}
                      onValueChange={([v]) => setWaveFrequency(v)}
                      min={1}
                      max={10}
                      step={0.5}
                      data-testid="slider-wave-frequency"
                    />
                  </div>
                </>
              )}
              
              {trajectoryType === 'spiral' && (
                <>
                  <div className="space-y-2">
                    <Label>Spiral Radius: {spiralRadius}</Label>
                    <Slider
                      value={[spiralRadius]}
                      onValueChange={([v]) => setSpiralRadius(v)}
                      min={0.5}
                      max={3}
                      step={0.25}
                      data-testid="slider-spiral-radius"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Spiral Speed: {spiralSpeed}</Label>
                    <Slider
                      value={[spiralSpeed]}
                      onValueChange={([v]) => setSpiralSpeed(v)}
                      min={2}
                      max={15}
                      step={1}
                      data-testid="slider-spiral-speed"
                    />
                  </div>
                </>
              )}
              
              {trajectoryType === 'seeking' && (
                <div className="space-y-2">
                  <Label>Turn Rate: {seekingTurnRate}°/s</Label>
                  <Slider
                    value={[seekingTurnRate]}
                    onValueChange={([v]) => setSeekingTurnRate(v)}
                    min={45}
                    max={360}
                    step={15}
                    data-testid="slider-seeking-turn-rate"
                  />
                </div>
              )}
              
              {trajectoryType === 'spline' && (
                <>
                  <div className="space-y-2">
                    <Label>Arc Height: {splineArcHeight}</Label>
                    <Slider
                      value={[splineArcHeight]}
                      onValueChange={([v]) => setSplineArcHeight(v)}
                      min={1}
                      max={15}
                      step={1}
                      data-testid="slider-spline-arc-height"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tension: {splineTension.toFixed(2)}</Label>
                    <Slider
                      value={[splineTension]}
                      onValueChange={([v]) => setSplineTension(v)}
                      min={0}
                      max={1}
                      step={0.05}
                      data-testid="slider-spline-tension"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Show Path</Label>
                    <Switch
                      checked={showSplinePath}
                      onCheckedChange={setShowSplinePath}
                      data-testid="switch-show-spline-path"
                    />
                  </div>
                </>
              )}
              
              {!['wave', 'spiral', 'seeking', 'spline'].includes(trajectoryType) && (
                <p className="text-muted-foreground text-sm">Select wave, spiral, seeking, or spline trajectory for additional settings</p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Target Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Targets: {targetCount}</Label>
                <Slider
                  value={[targetCount]}
                  onValueChange={([v]) => setTargetCount(v)}
                  min={1}
                  max={20}
                  step={1}
                  data-testid="slider-target-count"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Auto Spawn Targets</Label>
                <Switch
                  checked={autoSpawnTargets}
                  onCheckedChange={setAutoSpawnTargets}
                  data-testid="switch-auto-spawn"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Show Range</Label>
                <Switch
                  checked={showRange}
                  onCheckedChange={setShowRange}
                  data-testid="switch-show-range"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Spline Trajectory (CatmullRom)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Use Spline Path</Label>
                <Switch
                  checked={useSplineTrajectory}
                  onCheckedChange={setUseSplineTrajectory}
                  data-testid="switch-use-spline"
                />
              </div>
              
              {useSplineTrajectory && (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Show Path</Label>
                    <Switch
                      checked={showSplinePath}
                      onCheckedChange={setShowSplinePath}
                      data-testid="switch-show-spline-path"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tension: {splineTension.toFixed(2)}</Label>
                    <Slider
                      value={[splineTension]}
                      onValueChange={([v]) => setSplineTension(v)}
                      min={0}
                      max={1}
                      step={0.05}
                      data-testid="slider-spline-tension"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Arc Height: {splineArcHeight}</Label>
                    <Slider
                      value={[splineArcHeight]}
                      onValueChange={([v]) => setSplineArcHeight(v)}
                      min={1}
                      max={15}
                      step={1}
                      data-testid="slider-spline-arc-height"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Scatter Shot (Mortar/Burst)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Scatter</Label>
                <Switch
                  checked={useScatterShot}
                  onCheckedChange={setUseScatterShot}
                  data-testid="switch-use-scatter"
                />
              </div>
              
              {useScatterShot && (
                <>
                  <div className="space-y-2">
                    <Label>Split Distance: {scatterDistance}m</Label>
                    <Slider
                      value={[scatterDistance]}
                      onValueChange={([v]) => setScatterDistance(v)}
                      min={3}
                      max={25}
                      step={1}
                      data-testid="slider-scatter-distance"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Child Count: {scatterChildCount}</Label>
                    <Slider
                      value={[scatterChildCount]}
                      onValueChange={([v]) => setScatterChildCount(v)}
                      min={2}
                      max={12}
                      step={1}
                      data-testid="slider-scatter-count"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Spread Angle: {scatterSpreadAngle}°</Label>
                    <Slider
                      value={[scatterSpreadAngle]}
                      onValueChange={([v]) => setScatterSpreadAngle(v)}
                      min={15}
                      max={90}
                      step={5}
                      data-testid="slider-scatter-angle"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Pattern</Label>
                    <Select value={scatterPattern} onValueChange={(v) => setScatterPattern(v as 'cone' | 'sphere' | 'ring' | 'random')}>
                      <SelectTrigger data-testid="select-scatter-pattern">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cone">Cone (Forward)</SelectItem>
                        <SelectItem value="ring">Ring (Circle)</SelectItem>
                        <SelectItem value="sphere">Sphere (All Directions)</SelectItem>
                        <SelectItem value="random">Random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Current Turret Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {currentTurretRef.current && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Range:</span>
                    <span>{currentTurretRef.current.config.range}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fire Rate:</span>
                    <span>{currentTurretRef.current.config.fireRate}/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Damage:</span>
                    <span>{currentTurretRef.current.config.projectile.damage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projectile Speed:</span>
                    <span>{currentTurretRef.current.config.projectile.speed}m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trajectory:</span>
                    <span className="capitalize">{currentTurretRef.current.config.projectile.trajectory}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          <Button 
            className="w-full" 
            variant="outline" 
            onClick={handleClearStats}
            data-testid="button-clear-stats"
          >
            Clear Stats
          </Button>
        </aside>
        
        <main className="flex-1 relative">
          <div 
            ref={containerRef} 
            className="w-full h-full"
            data-testid="turret-viewport"
          />
          
          <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm p-3 rounded-lg text-xs">
            <p>Turret auto-targets enemies within range</p>
            <p className="text-muted-foreground">Try different turret and projectile combinations</p>
          </div>
        </main>
      </div>
    </div>
  );
}
