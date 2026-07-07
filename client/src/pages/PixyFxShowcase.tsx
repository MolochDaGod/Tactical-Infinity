import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PIXY_EFFECTS_CATALOGUE, type PixyEffect, spawnExplosion, spawnWaterRipple } from "@/lib/pixy/pixyFxManager";

// ── Single effect canvas cell ─────────────────────────────────────────────────
function EffectCell({ id, label, desc, create }: {
  id: string; label: string; desc: string;
  create: () => PixyEffect;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const fxRef    = useRef<PixyEffect | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth  || 200;
    const H = mount.clientHeight || 200;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a14, 1);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 1;

    const fx = create();
    fx.mesh.position.set(0, 0, 0);
    scene.add(fx.mesh);
    fxRef.current = fx;

    let animId = 0;
    let last   = performance.now();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      fx.update(dt);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      fx.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <Card className="overflow-hidden bg-[#0a0a14] border-border">
      <div
        ref={mountRef}
        className="w-full aspect-square"
        data-testid={`pixy-cell-${id}`}
      />
      <div className="px-3 py-2 space-y-0.5 bg-card/80">
        <p className="font-semibold text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </Card>
  );
}

// ── One-shot demo canvas (explosion + water ripple) ───────────────────────────
function DemoCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const ticksRef = useRef<Array<(dt: number) => void>>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth  || 600;
    const H = mount.clientHeight || 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050510, 1);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0, 20);
    camera.position.z = 1;

    const amb = new THREE.AmbientLight(0x334466, 0.5);
    scene.add(amb);

    let animId = 0;
    let last   = performance.now();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      ticksRef.current = ticksRef.current.filter(tick => {
        tick(dt);
        return true;
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.forceContextLoss();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const fireExplosion = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const x = (Math.random() - 0.5) * 5;
    const y = (Math.random() - 0.5) * 2.5;
    const pos = new THREE.Vector3(x, y, 0);
    const tick = spawnExplosion(scene, pos, 2.5, 1.4, 0.6);
    ticksRef.current.push(tick);
  };

  const fireRipple = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const x = (Math.random() - 0.5) * 5;
    const pos = new THREE.Vector3(x, -0.5, 0);
    const tick = spawnWaterRipple(scene, pos, 3, 1.8);
    ticksRef.current.push(tick);
  };

  return (
    <div className="space-y-3">
      <div
        ref={mountRef}
        className="w-full h-48 rounded-xl overflow-hidden border border-border"
        data-testid="pixy-demo-canvas"
      />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={fireExplosion} data-testid="button-spawn-explosion">
          Spawn Explosion
        </Button>
        <Button size="sm" variant="outline" onClick={fireRipple} data-testid="button-spawn-ripple">
          Spawn Water Ripple
        </Button>
        <Button size="sm" variant="outline" onClick={() => { fireExplosion(); fireRipple(); }}>
          Fire Both
        </Button>
      </div>
    </div>
  );
}

// ── Main showcase page ────────────────────────────────────────────────────────
export default function PixyFxShowcase() {
  const [tab, setTab] = useState<'grid'|'demo'>('grid');

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-cinzel text-3xl text-primary">Pixy.js Effects</h1>
            <Badge variant="outline" className="font-mono text-xs">mebiusbox/pixy.js</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            80+ procedural GLSL shaders adapted for Three.js — ready to drop into any scene.
            GPU particles, area lights, post-processing, and procedural texture generation.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tab === 'grid' ? 'default' : 'outline'}
            onClick={() => setTab('grid')}
            data-testid="button-tab-grid"
          >
            Effect Gallery
          </Button>
          <Button
            size="sm"
            variant={tab === 'demo' ? 'default' : 'outline'}
            onClick={() => setTab('demo')}
            data-testid="button-tab-demo"
          >
            Interactive Demo
          </Button>
        </div>

        {tab === 'grid' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {PIXY_EFFECTS_CATALOGUE.map(entry => (
                <EffectCell key={entry.id} {...entry} />
              ))}
            </div>

            {/* Usage info */}
            <Card className="p-4 bg-muted/30">
              <h3 className="font-semibold text-sm mb-3 text-foreground">Using in your scenes</h3>
              <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Drop into any Three.js scene</p>
                  <pre className="bg-background/60 rounded p-2 font-mono overflow-x-auto text-[10px]">{
`import { createBonfire } from '@/lib/pixy/pixyFxManager';

const fire = createBonfire({ size: 1.5 });
scene.add(fire.mesh);

// in animation loop:
fire.update(deltaTime);`
                  }</pre>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">One-shot explosion on impact</p>
                  <pre className="bg-background/60 rounded p-2 font-mono overflow-x-auto text-[10px]">{
`import { spawnExplosion } from '@/lib/pixy/pixyFxManager';

const tick = spawnExplosion(
  scene, hitPosition, 3, 1.2
);
// call tick(dt) each frame
// auto-removes when done`
                  }</pre>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Magic circle for spell casts</p>
                  <pre className="bg-background/60 rounded p-2 font-mono overflow-x-auto text-[10px]">{
`import { createMagicCircle } from '@/lib/pixy/pixyFxManager';

const circle = createMagicCircle({
  size: 2, tint: new THREE.Color(0.4, 0.7, 1)
});
circle.mesh.rotation.x = -Math.PI/2;
scene.add(circle.mesh);`
                  }</pre>
                </div>
              </div>
            </Card>
          </>
        )}

        {tab === 'demo' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the buttons below to spawn one-shot effects. These demonstrate
              the auto-lifetime system used for combat hits, cannon impacts, and water splashes.
            </p>
            <DemoCanvas />
          </div>
        )}
      </div>
    </div>
  );
}
