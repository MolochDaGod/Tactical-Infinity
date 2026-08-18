import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { normalizeToMetres } from '@/lib/modelNormalize';
import { EditorGizmoSession, type EditorGizmoMode, type EditorMaterialFamilyId } from '@/lib/editorTools';
import EditorGizmoHud from '@/components/editor/EditorGizmoHud';
import {
  FLEET_ASSET_CATALOG,
  FLEET_ASSET_KINDS,
  type FleetAssetEntry,
  type FleetAssetKind,
} from '@shared/gameDefinitions/fleetAssetCatalog';

interface Props {
  onBack: () => void;
}

function makeWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 14) {
    ctx.fillStyle = `rgb(${90 + (y % 20)}, ${55 + (y % 12)}, ${28 + (y % 8)})`;
    ctx.fillRect(0, y, 256, 12);
    ctx.strokeStyle = 'rgba(40,22,10,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, y + 12);
    ctx.lineTo(256, y + 12);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function applyHullMaterials(root: THREE.Object3D, wood: THREE.Texture): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mat) => {
      const std = mat as THREE.MeshStandardMaterial;
      const hasMap = !!(std && 'map' in std && std.map);
      const name = `${m.name} ${std?.name ?? ''}`.toLowerCase();
      const isSail = /sail|cloth|canvas/.test(name);
      if (hasMap) {
        if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
        std.needsUpdate = true;
        return std;
      }
      if (isSail) {
        return new THREE.MeshStandardMaterial({
          color: 0xe8dcc4,
          roughness: 0.85,
          side: THREE.DoubleSide,
        });
      }
      return new THREE.MeshStandardMaterial({
        map: wood,
        color: 0xc4a574,
        roughness: 0.88,
        metalness: 0,
      });
    });
    m.material = next.length === 1 ? next[0] : next;
    m.castShadow = true;
    m.receiveShadow = true;
  });
}

function addDeckCollider(parent: THREE.Object3D, asset: FleetAssetEntry): void {
  const spec = asset.deckCollider;
  if (!spec) return;
  const [hx, hy, hz] = spec.half;
  const [ox, oy, oz] = spec.offset;
  const geo = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x3dff8a,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const box = new THREE.Mesh(geo, mat);
  box.name = `deck_collider_${asset.id}`;
  box.position.set(ox, oy, oz);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x7dffb0 }),
  );
  box.add(edges);
  parent.add(box);
}

export default function FleetAssetViewer({ onBack }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<FleetAssetKind>('raft');
  const [selected, setSelected] = useState<FleetAssetEntry>(
    FLEET_ASSET_CATALOG.find((a) => a.kind === 'raft') ?? FLEET_ASSET_CATALOG[0],
  );
  const [status, setStatus] = useState('idle');
  const [measured, setMeasured] = useState('');
  const [gizmoMode, setGizmoMode] = useState<EditorGizmoMode>('translate');
  const [selName, setSelName] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const gizmoRef = useRef<EditorGizmoSession | null>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    root: THREE.Group;
    wood: THREE.Texture;
    raf: number;
  } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1612);
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 200);
    camera.position.set(6, 4, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.8, 0);
    scene.add(new THREE.HemisphereLight(0xffe6c8, 0x223344, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.35);
    sun.position.set(8, 12, 5);
    sun.castShadow = true;
    scene.add(sun);
    const grid = new THREE.GridHelper(24, 24, 0xc5a059, 0x3a3024);
    grid.userData.editorIgnore = true;
    scene.add(grid);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x1a6a78, roughness: 0.35, metalness: 0.08 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.02;
    water.userData.editorIgnore = true;
    scene.add(water);
    const root = new THREE.Group();
    scene.add(root);
    const wood = makeWoodTexture();
    const gizmo = new EditorGizmoSession({
      scene,
      camera,
      domElement: renderer.domElement,
      orbit: controls,
      pickRoots: () => [root],
      onSelect: (obj) => {
        setSelName(obj ? obj.name || obj.type : null);
        if (!obj) setFamilyId(null);
      },
      onMode: setGizmoMode,
    });
    gizmoRef.current = gizmo;
    let raf = 0;
    const tick = () => {
      controls.update();
      gizmo.updateOutline();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    sceneRef.current = { scene, camera, renderer, controls, root, wood, raf };
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      gizmo.dispose();
      gizmoRef.current = null;
      wood.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    let cancelled = false;
    setStatus('loading');
    setMeasured('');
    gizmoRef.current?.detach();
    ctx.root.clear();
    const loader = new GLTFLoader();
    const isolate = (scene: THREE.Group, node: string): THREE.Group => {
      let hit: THREE.Object3D | null = null;
      scene.traverse((o) => {
        if (o.name === node) hit = o;
      });
      if (!hit) return scene;
      const g = new THREE.Group();
      const c = hit.clone(true);
      c.position.set(0, 0, 0);
      c.rotation.set(0, 0, 0);
      g.add(c);
      return g;
    };
    const place = (raw: THREE.Group, tag: string) => {
      const g = selected.isolateNode ? isolate(raw, selected.isolateNode) : raw;
      const target =
        selected.fitAxis === 'height' ? selected.heightM : selected.lengthM;
      const fit = normalizeToMetres(g, {
        targetSizeM: target,
        axis: selected.fitAxis,
        ground: true,
        centerXZ: true,
      });
      applyHullMaterials(g, ctx.wood);
      addDeckCollider(g, selected);
      ctx.root.add(g);
      setMeasured(
        `${fit.size.z.toFixed(2)}×${fit.size.x.toFixed(2)}×${fit.size.y.toFixed(2)} m`,
      );
      setStatus(tag);
    };
    loader.load(
      selected.url,
      (gltf) => {
        if (!cancelled) place(gltf.scene, 'ok');
      },
      undefined,
      () => {
        if (cancelled) return;
        if (selected.cdn && selected.cdn !== selected.url) {
          loader.load(
            selected.cdn,
            (gltf) => {
              if (!cancelled) place(gltf.scene, 'ok (cdn)');
            },
            undefined,
            () => setStatus('missing mesh'),
          );
        } else {
          setStatus('missing mesh');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const list = FLEET_ASSET_CATALOG.filter((a) => a.kind === kind);
  const dc = selected.deckCollider;

  return (
    <div className="h-screen w-full flex bg-[#0a0705] text-[#e0d8c8]" data-testid="fleet-asset-viewer">
      <aside className="w-80 border-r border-amber-900/40 p-3 overflow-y-auto">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3">
          Back
        </Button>
        <h1 className="font-serif text-amber-300 text-sm tracking-widest uppercase mb-2">Fleet assets</h1>
        <div className="flex flex-wrap gap-1 mb-3">
          {FLEET_ASSET_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                const first = FLEET_ASSET_CATALOG.find((a) => a.kind === k);
                if (first) setSelected(first);
              }}
              className={`text-[10px] uppercase px-2 py-1 rounded border ${
                kind === k ? 'border-amber-400 bg-amber-900/40' : 'border-white/10'
              }`}
            >
              {k.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded border ${
                selected.id === a.id ? 'border-amber-400 bg-amber-950/50' : 'border-white/10 hover:border-amber-700/50'
              }`}
            >
              <div>{a.name}</div>
              <div className="text-[10px] text-slate-500">
                {a.lengthM.toFixed(1)} m L
                {a.beamM ? ` · ${a.beamM.toFixed(1)} m beam` : ''}
                {a.deckCollider ? ' · deck' : ''}
              </div>
            </button>
          ))}
        </div>
      </aside>
      <div className="flex-1 relative">
        <div ref={wrapRef} className="absolute inset-0" />
        <EditorGizmoHud
          mode={gizmoMode}
          selectedName={selName}
          familyId={familyId}
          onMode={(m) => {
            setGizmoMode(m);
            gizmoRef.current?.setMode(m);
          }}
          onFamily={async (id: EditorMaterialFamilyId) => {
            await gizmoRef.current?.applyFamily(id);
            setFamilyId(id);
          }}
          onTint={(hex) => gizmoRef.current?.tint(hex)}
          onRoughness={(v) => gizmoRef.current?.setPbr({ roughness: v })}
          onMetalness={(v) => gizmoRef.current?.setPbr({ metalness: v })}
          onRepeat={(v) => gizmoRef.current?.setPbr({ repeat: v })}
          onTextureFile={(file) => void gizmoRef.current?.applyAlbedoFile(file)}
          onDeselect={() => gizmoRef.current?.detach()}
        />
        <div className="absolute bottom-3 left-3 max-w-md text-[11px] bg-black/70 border border-amber-800/40 px-3 py-2 rounded space-y-0.5">
          <div className="text-amber-200 font-serif tracking-wide uppercase">{selected.name}</div>
          <div>
            SI spec {selected.lengthM} m L × {selected.beamM ?? '—'} m beam × {selected.heightM} m H
          </div>
          <div>Measured {measured || '…'} · {status}</div>
          {dc && (
            <div className="text-emerald-300">
              Deck collider {(dc.half[0] * 2).toFixed(2)} × {(dc.half[2] * 2).toFixed(2)} m @ y=
              {dc.offset[1].toFixed(2)}
            </div>
          )}
          {selected.notes && <div className="text-slate-500">{selected.notes}</div>}
        </div>
      </div>
    </div>
  );
}
