/**
 * threeWebGLSetup — Centralised optimal Three.js WebGL2 renderer configuration.
 *
 * Upgrades:
 *  • WebGL2 with proper sRGB / linear colour-space pipeline
 *  • ACESFilmic tone mapping (filmic look, avoids over-blown highlights)
 *  • PCFSoftShadowMap for smooth contact shadows
 *  • PMREM-based environment map from a generated procedural sky
 *  • Configurable pixel-ratio cap (performance vs quality)
 *  • post-processing hook point (returns composer-ready renderer)
 *
 * Usage:
 *   const { renderer, pmremGenerator } = createOptimalRenderer(canvas);
 *   renderer.setAnimationLoop(() => { ... renderer.render(scene, camera) });
 */

import * as THREE from 'three';
// RoomEnvironment lives in the examples/jsm subpath in three 0.182, not on
// the main module — the old `(THREE as any).RoomEnvironment` lookup worked
// at runtime in dev (because Vite forgave the missing export) but Rollup
// fails the production build with "RoomEnvironment is not exported by
// node_modules/three/build/three.module.js".
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface RendererConfig {
  canvas?: HTMLCanvasElement;
  antialias?: boolean;
  shadows?: boolean;
  shadowType?: THREE.ShadowMapType;
  toneMapping?: THREE.ToneMapping;
  toneMappingExposure?: number;
  pixelRatioMax?: number;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

export interface RendererResult {
  renderer: THREE.WebGLRenderer;
  pmremGenerator: THREE.PMREMGenerator;
  dispose: () => void;
}

export function createOptimalRenderer(config: RendererConfig = {}): RendererResult {
  const {
    canvas,
    antialias           = true,
    shadows             = true,
    shadowType          = THREE.PCFSoftShadowMap,
    toneMapping         = THREE.ACESFilmicToneMapping,
    toneMappingExposure = 1.2,
    pixelRatioMax       = 2,
    powerPreference     = 'high-performance'
  } = config;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    powerPreference,
    logarithmicDepthBuffer: true,
    alpha: false
  });

  renderer.shadowMap.enabled  = shadows;
  renderer.shadowMap.type     = shadowType;
  renderer.toneMapping        = toneMapping;
  renderer.toneMappingExposure = toneMappingExposure;
  renderer.outputColorSpace   = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioMax));

  const info = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
  if (info) {
    const gpu = renderer.getContext().getParameter(info.UNMASKED_RENDERER_WEBGL);
    console.log('[ThreeWebGL] GPU:', gpu);
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  return {
    renderer,
    pmremGenerator,
    dispose: () => {
      pmremGenerator.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
    }
  };
}

export function createSceneDefaults(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.FogExp2(0x0d1117, 0.012);
  return scene;
}

export function createCharacterLights(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0x334466, 0.8);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e0, 2.5);
  key.position.set(8, 15, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far  = 80;
  key.shadow.camera.left   = -15;
  key.shadow.camera.right  =  15;
  key.shadow.camera.top    =  15;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x4466aa, 0.6);
  fill.position.set(-5, 8, -5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xff8844, 0.4);
  rim.position.set(0, 5, -10);
  scene.add(rim);
}

export function buildProcEnvMap(pmrem: THREE.PMREMGenerator): THREE.Texture {
  return pmrem.fromScene(new RoomEnvironment()).texture;
}

export function optimiseMaterial(mat: THREE.Material): void {
  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
    mat.envMapIntensity = 1.0;
    mat.roughness = Math.max(mat.roughness, 0.35);
    mat.needsUpdate = true;
  }
}

export function optimiseMesh(mesh: THREE.Object3D, envMap?: THREE.Texture): void {
  mesh.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow    = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach(mat => {
        optimiseMaterial(mat);
        if (envMap && (mat as THREE.MeshStandardMaterial).envMap !== undefined) {
          (mat as THREE.MeshStandardMaterial).envMap = envMap;
        }
      });
    }
  });
}

export function createGroundPlane(size = 30): THREE.Mesh {
  const geo  = new THREE.PlaneGeometry(size, size, 1, 1);
  const mat  = new THREE.MeshStandardMaterial({
    color: 0x1a2233,
    roughness: 0.9,
    metalness: 0.1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

export function createFactionPedestal(color: number, radius = 0.6): THREE.Group {
  const group = new THREE.Group();
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.15, 0.25, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 })
  );
  cylinder.receiveShadow = true;
  cylinder.castShadow = true;
  group.add(cylinder);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.1, 0.04, 8, 32),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.13;
  group.add(ring);

  return group;
}
