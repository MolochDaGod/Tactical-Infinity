import * as THREE from 'three';
import { materialColorsHex } from './gameData';

export interface IndoorShopConfig {
  container: HTMLElement;
  onExitShop?: () => void;
}

export class IndoorShopManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private clock: THREE.Clock;
  
  private character: THREE.Group | null = null;
  private characterPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 3);
  private characterRotation: number = 0;
  private characterVelocity: THREE.Vector3 = new THREE.Vector3();
  
  private exitPortal: THREE.Group | null = null;
  private shopkeeper: THREE.Group | null = null;
  
  private keys: { [key: string]: boolean } = {};
  private cameraAngle: number = 0;
  
  private config: IndoorShopConfig;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  
  private readonly MOVE_SPEED = 5;
  // Ceiling clears 2.75 m doorway architecture with headroom.
  private readonly ROOM_SIZE = { width: 14, depth: 12, height: 3.6 };
  
  constructor(config: IndoorShopConfig) {
    this.config = config;
    this.container = config.container;
    this.clock = new THREE.Clock();
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(materialColorsHex.woodDark);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 4, 8);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    this.setupLighting();
    this.createShopRoom();
    this.createShopkeeper();
    this.createExitPortal();
    this.createCharacter();
    this.setupEventListeners();
  }
  
  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffd4a3, 0.3);
    this.scene.add(ambientLight);
    
    const torchPositions = [
      { x: -5, z: -4 },
      { x: 5, z: -4 },
      { x: -5, z: 2 },
      { x: 5, z: 2 }
    ];
    
    for (const pos of torchPositions) {
      const torchLight = new THREE.PointLight(0xff6600, 1, 8);
      torchLight.position.set(pos.x, 3, pos.z);
      torchLight.castShadow = true;
      this.scene.add(torchLight);
      
      const torchGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 8);
      const torchMaterial = new THREE.MeshStandardMaterial({ color: materialColorsHex.woodLight });
      const torch = new THREE.Mesh(torchGeometry, torchMaterial);
      torch.position.set(pos.x, 2.75, pos.z);
      this.scene.add(torch);
      
      const flameGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
      const flameMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4400,
        emissive: 0xff4400,
        emissiveIntensity: 2
      });
      const flame = new THREE.Mesh(flameGeometry, flameMaterial);
      flame.position.set(pos.x, 3.15, pos.z);
      this.scene.add(flame);
    }
  }
  
  private createShopRoom(): void {
    const { width, depth, height } = this.ROOM_SIZE;
    
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: materialColorsHex.woodLight,
      roughness: 0.9
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    const ceilingGeometry = new THREE.PlaneGeometry(width, depth);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d1810,
      roughness: 0.95
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.scene.add(ceiling);
    
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4030,
      roughness: 0.85
    });
    
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wallMaterial
    );
    backWall.position.set(0, height / 2, -depth / 2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);
    
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMaterial.clone()
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);
    
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMaterial.clone()
    );
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);
    
    this.createShopFurniture();
  }
  
  private createShopFurniture(): void {
    const counterGeometry = new THREE.BoxGeometry(4, 1.2, 1);
    const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const counter = new THREE.Mesh(counterGeometry, counterMaterial);
    counter.position.set(0, 0.6, -3);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.scene.add(counter);
    
    const shelfPositions = [
      { x: -5.5, z: -2 },
      { x: -5.5, z: 0 },
      { x: 5.5, z: -2 },
      { x: 5.5, z: 0 }
    ];
    
    for (const pos of shelfPositions) {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 3, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x4a3728 })
      );
      shelf.position.set(pos.x, 1.5, pos.z);
      shelf.castShadow = true;
      this.scene.add(shelf);
      
      const itemColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44];
      for (let i = 0; i < 3; i++) {
        const item = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.3, 0.2),
          new THREE.MeshStandardMaterial({
            color: itemColors[Math.floor(Math.random() * itemColors.length)],
            emissive: itemColors[Math.floor(Math.random() * itemColors.length)],
            emissiveIntensity: 0.2
          })
        );
        item.position.set(
          pos.x + (Math.random() - 0.5) * 0.4,
          0.5 + i * 1,
          pos.z
        );
        this.scene.add(item);
      }
    }
    
    for (let i = 0; i < 5; i++) {
      const potion = new THREE.Group();
      
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8),
        new THREE.MeshStandardMaterial({
          color: 0x88ff88,
          transparent: true,
          opacity: 0.7
        })
      );
      potion.add(bottle);
      
      const cork = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
      );
      cork.position.y = 0.15;
      potion.add(cork);
      
      potion.position.set(
        -1.5 + i * 0.8,
        1.35,
        -3
      );
      this.scene.add(potion);
    }
  }
  
  private createShopkeeper(): void {
    const shopkeeper = new THREE.Group();
    
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.4, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.1;
    shopkeeper.add(body);
    
    const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.2;
    shopkeeper.add(head);
    
    const hatGeometry = new THREE.ConeGeometry(0.4, 0.6, 8);
    const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x4b0082 });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = 2.7;
    shopkeeper.add(hat);
    
    shopkeeper.position.set(0, 0, -4);
    this.shopkeeper = shopkeeper;
    this.scene.add(shopkeeper);
  }
  
  private createExitPortal(): void {
    const portal = new THREE.Group();
    
    const archGeometry = new THREE.TorusGeometry(1.2, 0.15, 8, 32, Math.PI);
    const archMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const arch = new THREE.Mesh(archGeometry, archMaterial);
    arch.position.y = 1.2;
    arch.rotation.x = Math.PI / 2;
    portal.add(arch);
    
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0x00ff88) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        varying vec2 vUv;
        
        void main() {
          float glow = 0.5 + 0.5 * sin(time * 2.0);
          vec3 color = glowColor * glow;
          float alpha = 0.6 + 0.2 * sin(time * 3.0 + vUv.y * 5.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const portalSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2.4),
      glowMaterial
    );
    portalSurface.position.y = 1.2;
    portal.add(portalSurface);
    
    portal.position.set(0, 0, 4.5);
    this.exitPortal = portal;
    this.scene.add(portal);
  }
  
  private createCharacter(): void {
    const character = new THREE.Group();
    
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4169e1 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    character.add(body);
    
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.6;
    head.castShadow = true;
    character.add(head);
    
    character.position.copy(this.characterPosition);
    this.character = character;
    this.scene.add(character);
  }
  
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('resize', this.handleResize);
  }
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = true;
    
    if (e.key === 'Escape' && this.config.onExitShop) {
      this.config.onExitShop();
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = false;
  };
  
  private handleMouseMove = (e: MouseEvent): void => {
    if (e.buttons === 2) {
      this.cameraAngle -= e.movementX * 0.005;
    }
  };
  
  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
  
  private updateCharacter(delta: number): void {
    if (!this.character) return;
    
    let moveX = 0;
    let moveZ = 0;
    
    if (this.keys['w']) moveZ -= 1;
    if (this.keys['s']) moveZ += 1;
    if (this.keys['a']) moveX -= 1;
    if (this.keys['d']) moveX += 1;
    
    if (moveX !== 0 || moveZ !== 0) {
      const moveAngle = Math.atan2(moveX, moveZ) + this.cameraAngle;
      
      this.characterVelocity.x = Math.sin(moveAngle) * this.MOVE_SPEED;
      this.characterVelocity.z = Math.cos(moveAngle) * this.MOVE_SPEED;
      
      this.characterRotation = moveAngle;
    } else {
      this.characterVelocity.x *= 0.9;
      this.characterVelocity.z *= 0.9;
    }
    
    this.characterPosition.x += this.characterVelocity.x * delta;
    this.characterPosition.z += this.characterVelocity.z * delta;
    
    const halfWidth = this.ROOM_SIZE.width / 2 - 0.5;
    const halfDepth = this.ROOM_SIZE.depth / 2 - 0.5;
    
    this.characterPosition.x = Math.max(-halfWidth, Math.min(halfWidth, this.characterPosition.x));
    this.characterPosition.z = Math.max(-halfDepth, Math.min(halfDepth, this.characterPosition.z));
    
    this.character.position.copy(this.characterPosition);
    this.character.rotation.y = this.characterRotation;
    
    this.checkExitPortal();
  }
  
  private checkExitPortal(): void {
    if (!this.exitPortal) return;
    
    const distance = this.characterPosition.distanceTo(this.exitPortal.position);
    
    if (distance < 1.5 && this.config.onExitShop) {
      this.config.onExitShop();
    }
  }
  
  private updateCamera(delta: number): void {
    const cameraDistance = 6;
    const cameraHeight = 4;
    
    const targetX = this.characterPosition.x - Math.sin(this.cameraAngle) * cameraDistance;
    const targetY = this.characterPosition.y + cameraHeight;
    const targetZ = this.characterPosition.z - Math.cos(this.cameraAngle) * cameraDistance;
    
    this.camera.position.x += (targetX - this.camera.position.x) * 0.1;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.1;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;
    
    this.camera.lookAt(
      this.characterPosition.x,
      this.characterPosition.y + 1,
      this.characterPosition.z
    );
  }
  
  private updatePortalEffect(elapsedTime: number): void {
    if (this.exitPortal) {
      const portalMesh = this.exitPortal.children.find(
        c => c instanceof THREE.Mesh && (c.material as THREE.ShaderMaterial).uniforms
      ) as THREE.Mesh;
      
      if (portalMesh) {
        const material = portalMesh.material as THREE.ShaderMaterial;
        if (material.uniforms) {
          material.uniforms.time.value = elapsedTime;
        }
      }
    }
  }
  
  private animate = (): void => {
    if (this.isDisposed) return;
    
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();
    
    this.updateCharacter(delta);
    this.updateCamera(delta);
    this.updatePortalEffect(elapsedTime);
    
    if (this.shopkeeper) {
      this.shopkeeper.rotation.y = Math.sin(elapsedTime * 0.5) * 0.1;
    }
    
    this.renderer.render(this.scene, this.camera);
  };
  
  start(): void {
    this.clock.start();
    this.animate();
  }
  
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  dispose(): void {
    this.isDisposed = true;
    this.stop();
    
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('resize', this.handleResize);
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else if (object.material) {
          object.material.dispose();
        }
      }
    });
    
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
  
  getRendererStats(): {
    drawCalls: number;
    triangles: number;
    memory: number;
    objectCount: number;
  } {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      memory: (info.memory.geometries + info.memory.textures) * 0.001,
      objectCount: this.scene.children.length
    };
  }
  
  getCameraInfo(): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      rotation: {
        x: this.camera.rotation.x,
        y: this.camera.rotation.y,
        z: this.camera.rotation.z
      }
    };
  }
  
  getSceneObjects(): Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    visible: boolean;
  }> {
    return this.scene.children.slice(0, 20).map((obj, i) => ({
      id: obj.uuid,
      name: obj.name || `Object_${i}`,
      type: obj.type,
      position: {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z
      },
      visible: obj.visible
    }));
  }
  
  setCharacterPosition(position: THREE.Vector3): void {
    this.characterPosition.copy(position);
    if (this.character) {
      this.character.position.copy(position);
    }
  }
}
