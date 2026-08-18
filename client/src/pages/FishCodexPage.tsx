/**
 * Ocean bestiary — Cute Fish Pack + Quaternius fauna (fishui frame).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { FishCodexFrame } from '@/components/hud/FishCodexFrame';
import { ALL_OCEAN_FISH, FISH_DISPLAY_COLOR } from '@/lib/quaterniusFish';
import { buildFishCard } from '@shared/gameDefinitions/fishCodex';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { preserveFishMaterials } from '@/lib/fishMaterials';
import { SeascapeOcean } from '@/lib/islandsCanonical/SeascapeOcean';

interface Props {
  onBack: () => void;
}

export default function FishCodexPage({ onBack }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cards = useMemo(() => ALL_OCEAN_FISH.map(buildFishCard), []);
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? 'fish1');
  const [status, setStatus] = useState('idle');
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    mixer: THREE.AnimationMixer | null;
    root: THREE.Group;
    ocean: SeascapeOcean;
    clock: THREE.Clock;
    raf: number;
  } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x7ec8d4, 0.018);
    scene.background = new THREE.Color(0x7ec8d4);
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 80);
    camera.position.set(1.8, 0.6, 2.8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x7ec8d4, 1);
    el.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0x88c8ff, 0x042018, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe8c8, 1.4);
    sun.position.set(4, 6, 2);
    scene.add(sun);

    const ocean = new SeascapeOcean({ size: 40, segments: 96, sunDirection: sun.position });
    ocean.mesh.position.y = -0.55;
    scene.add(ocean.mesh);

    const root = new THREE.Group();
    root.position.y = 0.35;
    scene.add(root);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.15, 0);
    controls.minDistance = 1.2;
    controls.maxDistance = 6;

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      sceneRef.current?.mixer?.update(dt);
      root.rotation.y += dt * 0.25;
      ocean.update(t, camera);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    sceneRef.current = { scene, camera, renderer, controls, mixer: null, root, ocean, clock, raf };

    const onResize = () => {
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const ctx = sceneRef.current;
    const card = cards.find((c) => c.id === selectedId);
    if (!ctx || !card) return;
    let cancelled = false;
    setStatus('loading');
    ctx.root.clear();
    ctx.mixer = null;
    const loader = new FBXLoader();
    const tryUrl = (url: string) =>
      new Promise<THREE.Group>((res, rej) => loader.load(url, (o) => res(o as THREE.Group), undefined, rej));

    (async () => {
      const urls = [card.modelUrl, card.modelUrlAlt].filter(Boolean) as string[];
      for (const url of urls) {
        try {
          const obj = await tryUrl(url);
          if (cancelled) return;
          const wrap = new THREE.Group();
          wrap.add(obj);
          normalizeToMetres(wrap, { targetSizeM: 1.15, axis: 'max', center: true });
          preserveFishMaterials(wrap, FISH_DISPLAY_COLOR[card.name]);
          ctx.root.add(wrap);
          const clips = (obj as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations ?? [];
          if (clips[0]) {
            const mixer = new THREE.AnimationMixer(obj);
            mixer.clipAction(clips[0]).play();
            ctx.mixer = mixer;
          }
          setStatus('ok');
          return;
        } catch {
          /* next url */
        }
      }
      if (!cancelled) setStatus('missing pack');
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, cards]);

  return (
    <div className="h-screen w-full bg-[#5ec8d4] text-amber-100 flex flex-col" data-testid="fish-codex-page">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-amber-900/40">
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <h1 className="font-serif tracking-widest uppercase text-sm text-amber-300">Ocean bestiary</h1>
        <span className="text-[10px] text-slate-500">{status} · {cards.length} species</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <FishCodexFrame
          cards={cards}
          selectedId={selectedId}
          onSelect={setSelectedId}
          portrait={<div ref={wrapRef} className="w-full h-full" />}
        />
      </div>
    </div>
  );
}
