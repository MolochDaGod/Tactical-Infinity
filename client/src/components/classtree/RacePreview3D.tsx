import { useEffect, useRef } from "react";
import * as THREE from "three";
import { UnitCharacter } from "@/lib/character/UnitGLBLoader";
import { resolveUnitModel } from "@/lib/character/unitModel";
import type { Race, WeaponStyle } from "@/data/toonRTSAssets";

interface Props {
  race: Race | null;
  weaponStyle: WeaponStyle | null;
  pedestalTint?: string;
}

export default function RacePreview3D({ race, weaponStyle, pedestalTint = "#f6c945" }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 220;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 1.55, 3.6);
    camera.lookAt(0, 1.0, 0);

    // lighting — keyed warm gold + cool fill
    const key = new THREE.DirectionalLight(0xfff1c8, 1.6);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec1ff, 0.5);
    fill.position.set(-3, 2, -1);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0x303040, 0.7));

    // pedestal
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.18, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(pedestalTint),
        metalness: 0.65,
        roughness: 0.35,
        emissive: new THREE.Color(pedestalTint).multiplyScalar(0.15),
      })
    );
    ped.position.y = 0.09;
    scene.add(ped);
    const pedRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.03, 8, 48),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(pedestalTint),
        emissive: new THREE.Color(pedestalTint),
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.2,
      })
    );
    pedRing.rotation.x = Math.PI / 2;
    pedRing.position.y = 0.18;
    scene.add(pedRing);

    const charGroup = new THREE.Group();
    charGroup.position.y = 0.18;
    scene.add(charGroup);

    let unit: UnitCharacter | null = null;
    let frameId = 0;
    const clock = new THREE.Clock();

    // load the faction GLB (baked weapon + baked idle) — no external attach.
    (async () => {
      if (!race) {
        animate();
        return;
      }
      const resolved = resolveUnitModel(race, { weaponStyle });
      if (!resolved) {
        animate();
        return;
      }
      try {
        const loaded = await UnitCharacter.load(resolved.path, {
          targetHeight: 1.7,
          includeBank: false,
          stripRootMotion: true,
        });
        if (disposed) {
          loaded.dispose();
          return;
        }
        unit = loaded;
        charGroup.add(unit.object);
        unit.playFirstAvailable(["idle"], { loop: true });
      } catch (e) {
        console.warn("[RacePreview3D] load failed:", e);
      }
      animate();
    })();

    function animate() {
      if (disposed) return;
      const dt = clock.getDelta();
      if (unit) unit.update(dt);
      charGroup.rotation.y += dt * 0.6;
      pedRing.rotation.z += dt * 0.4;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    // resize
    const ro = new ResizeObserver(() => {
      if (disposed || !host) return;
      const W = host.clientWidth, H = host.clientHeight;
      if (!W || !H) return;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      unit?.dispose();
      unit = null;
      renderer.forceContextLoss();
      renderer.dispose();
      scene.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
      host.innerHTML = "";
    };
  }, [race, weaponStyle, pedestalTint]);

  return (
    <div
      ref={hostRef}
      style={{ width: "100%", height: "100%", borderRadius: 16, overflow: "hidden" }}
      data-testid="race-preview-3d"
    />
  );
}
