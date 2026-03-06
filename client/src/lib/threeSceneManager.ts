import * as THREE from "three";

export class ThreeSceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private animationId: number | null = null;
  private mixers: THREE.AnimationMixer[] = [];
  private clock: THREE.Clock;
  private container: HTMLElement | null = null;
  private webglAvailable: boolean = true;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.clock = new THREE.Clock();
    
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!context) {
        this.webglAvailable = false;
        console.warn("WebGL is not available in this environment");
      } else {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      }
    } catch (e) {
      this.webglAvailable = false;
      console.warn("Failed to create WebGL context:", e);
    }
    
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    this.setupLighting();
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 1, 0);
  }

  isWebGLAvailable(): boolean {
    return this.webglAvailable;
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
  }

  mount(container: HTMLElement) {
    this.container = container;
    
    if (!this.renderer) {
      const fallback = document.createElement("div");
      fallback.className = "flex items-center justify-center h-full text-muted-foreground";
      fallback.textContent = "WebGL is not available in this environment";
      fallback.setAttribute("data-testid", "webgl-fallback");
      container.appendChild(fallback);
      return;
    }
    
    const { width, height } = container.getBoundingClientRect();
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);
    this.startAnimation();
    
    window.addEventListener("resize", this.handleResize);
  }

  private handleResize = () => {
    if (!this.container || !this.renderer) return;
    const { width, height } = this.container.getBoundingClientRect();
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private startAnimation() {
    if (!this.renderer) return;
    
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      const delta = this.clock.getDelta();
      this.mixers.forEach(mixer => mixer.update(delta));
      
      if (this.renderer) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  addMixer(mixer: THREE.AnimationMixer) {
    this.mixers.push(mixer);
  }

  removeMixer(mixer: THREE.AnimationMixer) {
    const index = this.mixers.indexOf(mixer);
    if (index > -1) {
      this.mixers.splice(index, 1);
    }
  }

  addObject(object: THREE.Object3D) {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D) {
    this.scene.remove(object);
  }

  clearScene() {
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      if (child instanceof THREE.Light) {
        this.scene.remove(child);
        continue;
      }
      this.scene.remove(child);
    }
    this.mixers = [];
    this.setupLighting();
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  setBackgroundColor(color: number) {
    this.scene.background = new THREE.Color(color);
  }

  setCameraPosition(x: number, y: number, z: number) {
    this.camera.position.set(x, y, z);
  }

  setCameraTarget(x: number, y: number, z: number) {
    this.camera.lookAt(x, y, z);
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.mixers.forEach(mixer => mixer.stopAllAction());
    this.mixers = [];
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    if (this.renderer) {
      this.renderer.dispose();
      
      if (this.container && this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}

export function createPlaceholderUnit(race: string, color: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  
  const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color,
    roughness: 0.5,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);
  
  const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
  const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffdbac,
    roughness: 0.6,
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.35;
  head.castShadow = true;
  group.add(head);
  
  return group;
}
