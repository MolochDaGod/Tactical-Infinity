import * as THREE from 'three';
import type { CannonSkillId } from '@shared/gameDefinitions/sailing';
import { createCannonFlashTexture, createExplosionTexture, createSmokeTexture } from '@/lib/islandAssetLoader';

let _flashTex: THREE.Texture | null = null;
let _explosionTex: THREE.Texture | null = null;
let _smokeTex: THREE.Texture | null = null;

function getFlashTex(): THREE.Texture {
  if (!_flashTex) _flashTex = createCannonFlashTexture();
  return _flashTex;
}
function getExplosionTex(): THREE.Texture {
  if (!_explosionTex) _explosionTex = createExplosionTexture();
  return _explosionTex;
}
function getSmokeTex(): THREE.Texture {
  if (!_smokeTex) _smokeTex = createSmokeTexture();
  return _smokeTex;
}

interface TrailParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
}

interface SplashParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface FireParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseY: number;
}

interface ShipFire {
  shipId: string;
  position: THREE.Vector3;
  intensity: number;
  particles: FireParticle[];
  smokeParticles: FireParticle[];
}

interface AmmoTrailConfig {
  color: number;
  emissive: number;
  trailColor: number;
  trailRate: number;
  trailLife: number;
  trailScale: number;
  maxTrail: number;
  gravity: number;
}

const AMMO_TRAIL_CONFIGS: Record<CannonSkillId, AmmoTrailConfig> = {
  heavy_ball: {
    color: 0x555555, emissive: 0x000000,
    trailColor: 0x555555, trailRate: 0.3, trailLife: 0.35, trailScale: 0.25, maxTrail: 6, gravity: 1,
  },
  chain_shot: {
    color: 0x888888, emissive: 0x111111,
    trailColor: 0x999999, trailRate: 0.5, trailLife: 0.3, trailScale: 0.15, maxTrail: 8, gravity: 0.5,
  },
  grapeshot: {
    color: 0xaaaaaa, emissive: 0x000000,
    trailColor: 0x888888, trailRate: 0.2, trailLife: 0.2, trailScale: 0.1, maxTrail: 4, gravity: 0.3,
  },
  fire_bomb: {
    color: 0xff6600, emissive: 0xff3300,
    trailColor: 0xff4400, trailRate: 0.7, trailLife: 0.5, trailScale: 0.35, maxTrail: 10, gravity: 2,
  },
  explosive_shell: {
    color: 0xff4400, emissive: 0xff2200,
    trailColor: 0xff6600, trailRate: 0.6, trailLife: 0.4, trailScale: 0.3, maxTrail: 8, gravity: 1.5,
  },
  scatter_shot: {
    color: 0xcccc00, emissive: 0x444400,
    trailColor: 0xaaaa00, trailRate: 0.15, trailLife: 0.2, trailScale: 0.08, maxTrail: 3, gravity: 0.2,
  },
};

export class CannonballEffects {
  private scene: THREE.Scene;
  private trails: Map<string, { particles: TrailParticle[]; ammoType: CannonSkillId }> = new Map();
  private splashes: SplashParticle[] = [];
  private shipFires: Map<string, ShipFire> = new Map();

  private smokeGeometry: THREE.SphereGeometry;
  private smokeMaterial: THREE.MeshBasicMaterial;
  private splashGeometry: THREE.SphereGeometry;
  private splashMaterial: THREE.MeshBasicMaterial;
  private waterRingGeometry: THREE.RingGeometry;
  private waterRingMaterial: THREE.MeshBasicMaterial;
  private fireGeometry: THREE.SphereGeometry;
  private fireMaterials: THREE.MeshBasicMaterial[];
  private smokeDarkGeometry: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.smokeGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    this.smokeMaterial = new THREE.MeshBasicMaterial({
      color: 0x555555, transparent: true, opacity: 0.7,
    });

    this.splashGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    this.splashMaterial = new THREE.MeshBasicMaterial({
      color: 0x87ceeb, transparent: true, opacity: 0.8,
    });

    this.waterRingGeometry = new THREE.RingGeometry(1.0, 8, 24);
    this.waterRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });

    this.fireGeometry = new THREE.SphereGeometry(0.4, 6, 6);
    this.fireMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 }),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 }),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 }),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 }),
    ];
    this.smokeDarkGeometry = new THREE.SphereGeometry(0.6, 6, 6);
  }

  startTrail(cannonballId: string, ammoType: CannonSkillId = 'heavy_ball') {
    this.trails.set(cannonballId, { particles: [], ammoType });
  }

  updateTrail(cannonballId: string, position: THREE.Vector3, velocity: THREE.Vector3) {
    const entry = this.trails.get(cannonballId);
    if (!entry) return;

    const config = AMMO_TRAIL_CONFIGS[entry.ammoType];
    const speed = velocity.length();
    if (speed < 15) return;

    if (Math.random() > config.trailRate) return;

    const particle: TrailParticle = {
      mesh: new THREE.Mesh(
        this.smokeGeometry,
        new THREE.MeshBasicMaterial({
          color: config.trailColor,
          transparent: true,
          opacity: 0.7,
          ...(config.emissive ? { emissive: new THREE.Color(config.emissive) } as any : {}),
        })
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1,
        Math.random() * config.gravity,
        (Math.random() - 0.5) * 1
      ),
      life: config.trailLife,
      maxLife: config.trailLife,
      scale: config.trailScale + Math.random() * 0.1,
    };

    particle.mesh.position.copy(position);
    particle.mesh.scale.setScalar(particle.scale);
    this.scene.add(particle.mesh);
    entry.particles.push(particle);

    if (entry.particles.length > config.maxTrail) {
      const old = entry.particles.shift()!;
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      (old.mesh.material as THREE.Material).dispose();
    }

    if (entry.ammoType === 'fire_bomb' && Math.random() > 0.5) {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 1 })
      );
      ember.position.copy(position);
      this.scene.add(ember);
      this.splashes.push({
        mesh: ember,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          1 + Math.random() * 3,
          (Math.random() - 0.5) * 4
        ),
        life: 0.4 + Math.random() * 0.3,
      });
    }

    if (entry.ammoType === 'chain_shot') {
      const spinMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4),
        new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 })
      );
      spinMesh.position.copy(position);
      spinMesh.rotation.z = Math.random() * Math.PI;
      this.scene.add(spinMesh);
      this.splashes.push({
        mesh: spinMesh,
        velocity: new THREE.Vector3(0, 0.5, 0),
        life: 0.25,
      });
    }
  }

  endTrail(cannonballId: string) {
    const entry = this.trails.get(cannonballId);
    if (!entry) return;
    this.trails.delete(cannonballId);
  }

  createAmmoMuzzleFlash(position: THREE.Vector3, ammoType: CannonSkillId = 'heavy_ball') {
    const configs: Record<CannonSkillId, { color: number; size: number; smokeColor: number; smokeCount: number }> = {
      heavy_ball: { color: 0xffaa00, size: 1.0, smokeColor: 0x555555, smokeCount: 5 },
      chain_shot: { color: 0xddddaa, size: 0.8, smokeColor: 0x666666, smokeCount: 3 },
      grapeshot: { color: 0xffcc44, size: 1.4, smokeColor: 0x444444, smokeCount: 8 },
      fire_bomb: { color: 0xff4400, size: 1.2, smokeColor: 0x333333, smokeCount: 6 },
      explosive_shell: { color: 0xff6600, size: 1.5, smokeColor: 0x222222, smokeCount: 7 },
      scatter_shot: { color: 0xffdd00, size: 1.3, smokeColor: 0x555555, smokeCount: 10 },
    };

    const cfg = configs[ammoType];

    const flashSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getFlashTex(),
        color: cfg.color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    flashSprite.scale.setScalar(cfg.size * 4);
    flashSprite.position.copy(position);
    this.scene.add(flashSprite);
    this.splashes.push({ mesh: flashSprite as any, velocity: new THREE.Vector3(0, 0, 0), life: 0.15 });

    const coreGeo = new THREE.SphereGeometry(cfg.size * 0.5, 6, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.9 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(position);
    this.scene.add(core);
    this.splashes.push({ mesh: core, velocity: new THREE.Vector3(0, 0, 0), life: 0.1 });

    for (let i = 0; i < cfg.smokeCount; i++) {
      const smokeSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getSmokeTex(),
          color: cfg.smokeColor,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })
      );
      smokeSprite.scale.setScalar(1.0 + Math.random() * 0.8);
      smokeSprite.position.copy(position);
      this.scene.add(smokeSprite);
      this.splashes.push({
        mesh: smokeSprite as any,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          1.5 + Math.random() * 2.5,
          (Math.random() - 0.5) * 4
        ),
        life: 0.6 + Math.random() * 0.4,
      });
    }

    if (ammoType === 'grapeshot' || ammoType === 'scatter_shot') {
      for (let i = 0; i < 8; i++) {
        const spark = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: getFlashTex(),
            color: 0xffee88,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        spark.scale.setScalar(0.15 + Math.random() * 0.1);
        spark.position.copy(position);
        this.scene.add(spark);
        this.splashes.push({
          mesh: spark as any,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 14,
            2 + Math.random() * 6,
            (Math.random() - 0.5) * 14
          ),
          life: 0.3 + Math.random() * 0.25,
        });
      }
    }
  }

  createSplash(position: THREE.Vector3, isWater: boolean = true, ammoType: CannonSkillId = 'heavy_ball') {
    const splashPosition = position.clone();
    splashPosition.y = 0;

    if (ammoType === 'explosive_shell') {
      this.createExplosiveWaterImpact(splashPosition);
      return;
    }

    if (ammoType === 'fire_bomb') {
      this.createFireWaterImpact(splashPosition);
      return;
    }

    const ringScale = ammoType === 'grapeshot' || ammoType === 'scatter_shot' ? 0.5 : 1.0;
    const ring = new THREE.Mesh(
      this.waterRingGeometry,
      this.waterRingMaterial.clone()
    );
    ring.position.copy(splashPosition);
    ring.position.y = 0.1;
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(ringScale);
    this.scene.add(ring);
    this.splashes.push({ mesh: ring, velocity: new THREE.Vector3(0, 0, 0), life: 1.0 });

    const particleCount = isWater ? (ammoType === 'grapeshot' ? 8 : 20) : 12;
    const color = isWater ? 0x87ceeb : 0x8b4513;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 6 + Math.random() * 8;

      const material = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
      });

      const particle: SplashParticle = {
        mesh: new THREE.Mesh(this.splashGeometry, material),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          4 + Math.random() * 4,
          Math.sin(angle) * speed
        ),
        life: 0.7 + Math.random() * 0.3,
      };

      particle.mesh.position.copy(splashPosition);
      particle.mesh.scale.setScalar(0.25 + Math.random() * 0.25);
      this.scene.add(particle.mesh);
      this.splashes.push(particle);
    }

    if (ammoType === 'chain_shot') {
      for (let i = 0; i < 4; i++) {
        const debris = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.6, 0.08),
          new THREE.MeshBasicMaterial({ color: 0x8B6914, transparent: true, opacity: 0.8 })
        );
        debris.position.copy(splashPosition);
        debris.position.y += 1;
        debris.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.scene.add(debris);
        this.splashes.push({
          mesh: debris,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            3 + Math.random() * 5,
            (Math.random() - 0.5) * 8
          ),
          life: 1.0 + Math.random() * 0.5,
        });
      }
    }
  }

  private createExplosiveWaterImpact(position: THREE.Vector3) {
    const explosionSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getExplosionTex(),
        color: 0xff6600,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    explosionSprite.scale.setScalar(10);
    explosionSprite.position.copy(position);
    explosionSprite.position.y = 2;
    this.scene.add(explosionSprite);
    this.splashes.push({ mesh: explosionSprite as any, velocity: new THREE.Vector3(0, 0.5, 0), life: 0.35 });

    const coreFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getFlashTex(),
        color: 0xffffcc,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coreFlash.scale.setScalar(6);
    coreFlash.position.copy(position);
    coreFlash.position.y = 1;
    this.scene.add(coreFlash);
    this.splashes.push({ mesh: coreFlash as any, velocity: new THREE.Vector3(0, 0, 0), life: 0.15 });

    for (let i = 0; i < 8; i++) {
      const smoke = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getSmokeTex(),
          color: 0x333333,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        })
      );
      smoke.scale.setScalar(2 + Math.random() * 2);
      smoke.position.copy(position);
      smoke.position.y = 1;
      this.scene.add(smoke);
      this.splashes.push({
        mesh: smoke as any,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          3 + Math.random() * 4,
          (Math.random() - 0.5) * 6
        ),
        life: 0.8 + Math.random() * 0.5,
      });
    }

    const shockGeo = new THREE.RingGeometry(0.5, 12, 32);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });
    const shockwave = new THREE.Mesh(shockGeo, shockMat);
    shockwave.position.copy(position);
    shockwave.position.y = 0.3;
    shockwave.rotation.x = -Math.PI / 2;
    this.scene.add(shockwave);
    this.splashes.push({ mesh: shockwave, velocity: new THREE.Vector3(0, 0, 0), life: 0.6 });

    const bigRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 15, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    bigRing.position.copy(position);
    bigRing.position.y = 0.15;
    bigRing.rotation.x = -Math.PI / 2;
    this.scene.add(bigRing);
    this.splashes.push({ mesh: bigRing, velocity: new THREE.Vector3(0, 0, 0), life: 1.2 });

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 10 + Math.random() * 15;
      const splash = new THREE.Mesh(
        this.splashGeometry,
        new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.9 })
      );
      splash.position.copy(position);
      splash.scale.setScalar(0.4 + Math.random() * 0.3);
      this.scene.add(splash);
      this.splashes.push({
        mesh: splash,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          8 + Math.random() * 8,
          Math.sin(angle) * speed
        ),
        life: 1.0 + Math.random() * 0.5,
      });
    }

    for (let i = 0; i < 15; i++) {
      const smoke = new THREE.Mesh(
        this.smokeDarkGeometry,
        new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8 })
      );
      smoke.position.copy(position);
      smoke.position.y += 0.5;
      smoke.scale.setScalar(0.8 + Math.random() * 0.6);
      this.scene.add(smoke);
      this.splashes.push({
        mesh: smoke,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          4 + Math.random() * 6,
          (Math.random() - 0.5) * 10
        ),
        life: 1.5 + Math.random() * 0.5,
      });
    }

    for (let i = 0; i < 10; i++) {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 1 })
      );
      ember.position.copy(position);
      ember.position.y += 1;
      this.scene.add(ember);
      this.splashes.push({
        mesh: ember,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 18,
          6 + Math.random() * 12,
          (Math.random() - 0.5) * 18
        ),
        life: 0.8 + Math.random() * 0.5,
      });
    }
  }

  private createFireWaterImpact(position: THREE.Vector3) {
    const fireFlash = new THREE.Mesh(
      new THREE.SphereGeometry(2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 })
    );
    fireFlash.position.copy(position);
    fireFlash.position.y = 0.5;
    this.scene.add(fireFlash);
    this.splashes.push({ mesh: fireFlash, velocity: new THREE.Vector3(0, 0, 0), life: 0.4 });

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const fireMat = this.fireMaterials[Math.floor(Math.random() * this.fireMaterials.length)].clone();
      const fire = new THREE.Mesh(this.fireGeometry, fireMat);
      fire.position.copy(position);
      fire.position.y = 0.3;
      this.scene.add(fire);
      this.splashes.push({
        mesh: fire,
        velocity: new THREE.Vector3(
          Math.cos(angle) * (3 + Math.random() * 4),
          2 + Math.random() * 4,
          Math.sin(angle) * (3 + Math.random() * 4)
        ),
        life: 0.8 + Math.random() * 0.6,
      });
    }

    for (let i = 0; i < 8; i++) {
      const smoke = new THREE.Mesh(
        this.smokeDarkGeometry,
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 })
      );
      smoke.position.copy(position);
      smoke.position.y += 0.5;
      smoke.scale.setScalar(0.5 + Math.random() * 0.4);
      this.scene.add(smoke);
      this.splashes.push({
        mesh: smoke,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          3 + Math.random() * 4,
          (Math.random() - 0.5) * 5
        ),
        life: 1.5 + Math.random() * 1.0,
      });
    }

    const fireRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 4, 16),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    fireRing.position.copy(position);
    fireRing.position.y = 0.2;
    fireRing.rotation.x = -Math.PI / 2;
    this.scene.add(fireRing);
    this.splashes.push({ mesh: fireRing, velocity: new THREE.Vector3(0, 0, 0), life: 2.0 });
  }

  createImpactExplosion(position: THREE.Vector3, ammoType: CannonSkillId = 'heavy_ball') {
    if (ammoType === 'explosive_shell') {
      this.createExplosiveWaterImpact(position);
      return;
    }

    if (ammoType === 'fire_bomb') {
      this.createFireWaterImpact(position);
      return;
    }

    const explosionCenter = position.clone();

    if (ammoType === 'grapeshot' || ammoType === 'scatter_shot') {
      for (let i = 0; i < 8; i++) {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 3, 3),
          new THREE.MeshBasicMaterial({
            color: ammoType === 'scatter_shot' ? 0xffdd44 : 0xcccccc,
            transparent: true, opacity: 1,
          })
        );
        spark.position.copy(explosionCenter);
        this.scene.add(spark);
        this.splashes.push({
          mesh: spark,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            2 + Math.random() * 5,
            (Math.random() - 0.5) * 10
          ),
          life: 0.3 + Math.random() * 0.2,
        });
      }

      for (let i = 0; i < 4; i++) {
        const splinter = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.3, 0.05),
          new THREE.MeshBasicMaterial({ color: 0x8B6914, transparent: true, opacity: 0.7 })
        );
        splinter.position.copy(explosionCenter);
        splinter.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.scene.add(splinter);
        this.splashes.push({
          mesh: splinter,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            3 + Math.random() * 4,
            (Math.random() - 0.5) * 8
          ),
          life: 0.6 + Math.random() * 0.4,
        });
      }
      return;
    }

    if (ammoType === 'chain_shot') {
      for (let i = 0; i < 6; i++) {
        const debris = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.5 + Math.random() * 0.5, 0.08),
          new THREE.MeshBasicMaterial({ color: 0x8B6914, transparent: true, opacity: 0.8 })
        );
        debris.position.copy(explosionCenter);
        debris.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.scene.add(debris);
        this.splashes.push({
          mesh: debris,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            4 + Math.random() * 6,
            (Math.random() - 0.5) * 12
          ),
          life: 1.0 + Math.random() * 0.5,
        });
      }

      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4),
        new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 })
      );
      chain.position.copy(explosionCenter);
      this.scene.add(chain);
      this.splashes.push({
        mesh: chain,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          3 + Math.random() * 3,
          (Math.random() - 0.5) * 5
        ),
        life: 0.8,
      });
      return;
    }

    const impactFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getExplosionTex(),
        color: 0xff6600,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    impactFlash.scale.setScalar(6);
    impactFlash.position.copy(explosionCenter);
    this.scene.add(impactFlash);
    this.splashes.push({ mesh: impactFlash as any, velocity: new THREE.Vector3(0, 0.3, 0), life: 0.25 });

    for (let i = 0; i < 10; i++) {
      const smokeSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getSmokeTex(),
          color: 0x444444,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        })
      );
      smokeSprite.scale.setScalar(1.2 + Math.random() * 0.8);
      smokeSprite.position.copy(explosionCenter);
      this.scene.add(smokeSprite);
      this.splashes.push({
        mesh: smokeSprite as any,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          2 + Math.random() * 4,
          (Math.random() - 0.5) * 6
        ),
        life: 1.0,
      });
    }

    for (let i = 0; i < 6; i++) {
      const ember = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getFlashTex(),
          color: 0xff3300,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ember.scale.setScalar(0.2 + Math.random() * 0.15);
      ember.position.copy(explosionCenter);
      this.scene.add(ember);
      this.splashes.push({
        mesh: ember as any,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          4 + Math.random() * 8,
          (Math.random() - 0.5) * 12
        ),
        life: 0.7 + Math.random() * 0.4,
      });
    }
  }

  update(delta: number) {
    this.trails.forEach((entry) => {
      for (let i = entry.particles.length - 1; i >= 0; i--) {
        const p = entry.particles[i];
        p.life -= delta;

        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          (p.mesh.material as THREE.Material).dispose();
          entry.particles.splice(i, 1);
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        p.velocity.y -= 1 * delta;

        const scale = p.scale * (0.5 + lifeRatio * 0.5);
        p.mesh.scale.setScalar(scale);

        (p.mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.6;
      }
    });

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const p = this.splashes[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.splashes.splice(i, 1);
        continue;
      }

      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.y -= 15 * delta;

      if (p.mesh.geometry.type === 'RingGeometry') {
        const scale = 1 + (1 - p.life) * 3;
        p.mesh.scale.setScalar(scale);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life * 0.6;
      } else {
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(p.life, 0.8);

        if (p.mesh.position.y < 0 && p.velocity.y < 0) {
          p.velocity.y *= -0.3;
          p.mesh.position.y = 0;
        }
      }
    }
  }

  dispose() {
    this.trails.forEach((entry) => {
      entry.particles.forEach(p => {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
      });
    });
    this.trails.clear();

    this.splashes.forEach(p => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.splashes = [];

    this.smokeGeometry.dispose();
    this.smokeMaterial.dispose();
    this.splashGeometry.dispose();
    this.splashMaterial.dispose();
    this.waterRingGeometry.dispose();
    this.waterRingMaterial.dispose();
  }
}
