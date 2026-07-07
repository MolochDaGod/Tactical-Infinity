import * as THREE from 'three';

export type EffectType = 
  | 'harvest_wood' 
  | 'harvest_stone' 
  | 'harvest_ore' 
  | 'harvest_plant'
  | 'combat_hit'
  | 'combat_blood'
  | 'combat_magic'
  | 'environment_fire'
  | 'environment_smoke'
  | 'environment_dust'
  | 'environment_sparkle'
  | 'environment_water_splash'
  | 'skill_heal'
  | 'skill_buff'
  | 'skill_debuff'
  | 'levelup'
  | 'loot_drop'
  | 'projectile_muzzle_flash'
  | 'projectile_cannon_smoke'
  | 'projectile_arrow_trail'
  | 'projectile_magic_trail'
  | 'projectile_fire_trail'
  | 'projectile_impact_arrow'
  | 'projectile_impact_bullet'
  | 'projectile_explosion'
  | 'projectile_arcane_burst'
  | 'projectile_fire_explosion'
  | 'projectile_ice_shatter'
  | 'projectile_lightning_strike'
  | 'movement_phase'
  | 'movement_flash_step'
  | 'movement_dash_trail'
  | 'movement_teleport'
  | 'spell_cast_fire'
  | 'spell_cast_ice'
  | 'spell_cast_lightning'
  | 'spell_cast_arcane'
  | 'spell_cast_holy'
  | 'spell_cast_shadow'
  | 'spell_impact_fire'
  | 'spell_impact_ice'
  | 'spell_impact_lightning'
  | 'spell_aoe_fire'
  | 'spell_aoe_ice'
  | 'spell_aoe_poison'
  | 'spell_channel_beam'
  | 'spell_summon_portal';

export interface EffectConfig {
  particleCount: number;
  particleSize: number;
  duration: number;
  color: THREE.Color;
  secondaryColor?: THREE.Color;
  velocity: THREE.Vector3;
  gravity: number;
  spread: number;
  fadeOut: boolean;
  emissionShape: 'point' | 'sphere' | 'cone' | 'box';
  useGPUInstancing: boolean;
}

export interface ActiveEffect {
  id: string;
  type: EffectType;
  group: THREE.Group;
  startTime: number;
  duration: number;
  config: EffectConfig;
  particleData: ParticleData[];
}

interface ParticleData {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  rotationSpeed: THREE.Vector3;
  scale: number;
}

const EFFECT_PRESETS: Record<EffectType, Partial<EffectConfig>> = {
  harvest_wood: {
    particleCount: 15,
    particleSize: 0.08,
    duration: 1.5,
    color: new THREE.Color(0x8B4513),
    secondaryColor: new THREE.Color(0x228B22),
    gravity: -9.8,
    spread: 0.5,
    velocity: new THREE.Vector3(0, 3, 0),
    emissionShape: 'cone',
  },
  harvest_stone: {
    particleCount: 20,
    particleSize: 0.1,
    duration: 1.2,
    color: new THREE.Color(0x808080),
    secondaryColor: new THREE.Color(0x505050),
    gravity: -12,
    spread: 0.8,
    velocity: new THREE.Vector3(0, 2.5, 0),
    emissionShape: 'sphere',
  },
  harvest_ore: {
    particleCount: 25,
    particleSize: 0.06,
    duration: 1.5,
    color: new THREE.Color(0xB87333),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: -8,
    spread: 0.6,
    velocity: new THREE.Vector3(0, 3.5, 0),
    emissionShape: 'sphere',
  },
  harvest_plant: {
    particleCount: 12,
    particleSize: 0.1,
    duration: 2.0,
    color: new THREE.Color(0x32CD32),
    secondaryColor: new THREE.Color(0x90EE90),
    gravity: -3,
    spread: 0.4,
    velocity: new THREE.Vector3(0, 1.5, 0),
    emissionShape: 'cone',
  },
  combat_hit: {
    particleCount: 30,
    particleSize: 0.05,
    duration: 0.8,
    color: new THREE.Color(0xFFFFFF),
    gravity: -15,
    spread: 1.2,
    velocity: new THREE.Vector3(0, 4, 0),
    emissionShape: 'sphere',
  },
  combat_blood: {
    particleCount: 25,
    particleSize: 0.04,
    duration: 1.0,
    color: new THREE.Color(0x8B0000),
    secondaryColor: new THREE.Color(0xFF0000),
    gravity: -12,
    spread: 0.8,
    velocity: new THREE.Vector3(0, 2, 0),
    emissionShape: 'sphere',
  },
  combat_magic: {
    particleCount: 40,
    particleSize: 0.08,
    duration: 1.5,
    color: new THREE.Color(0x9400D3),
    secondaryColor: new THREE.Color(0x00FFFF),
    gravity: 0,
    spread: 1.5,
    velocity: new THREE.Vector3(0, 0.5, 0),
    emissionShape: 'sphere',
  },
  environment_fire: {
    particleCount: 50,
    particleSize: 0.15,
    duration: 2.0,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 5,
    spread: 0.3,
    velocity: new THREE.Vector3(0, 2, 0),
    emissionShape: 'cone',
  },
  environment_smoke: {
    particleCount: 30,
    particleSize: 0.25,
    duration: 3.0,
    color: new THREE.Color(0x505050),
    secondaryColor: new THREE.Color(0x808080),
    gravity: 2,
    spread: 0.5,
    velocity: new THREE.Vector3(0, 1, 0),
    emissionShape: 'cone',
  },
  environment_dust: {
    particleCount: 40,
    particleSize: 0.05,
    duration: 2.5,
    color: new THREE.Color(0xD2B48C),
    gravity: -2,
    spread: 2,
    velocity: new THREE.Vector3(0, 0.3, 0),
    emissionShape: 'box',
  },
  environment_sparkle: {
    particleCount: 20,
    particleSize: 0.03,
    duration: 1.5,
    color: new THREE.Color(0xFFFFFF),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 0,
    spread: 1,
    velocity: new THREE.Vector3(0, 0.5, 0),
    emissionShape: 'sphere',
  },
  environment_water_splash: {
    particleCount: 35,
    particleSize: 0.06,
    duration: 1.2,
    color: new THREE.Color(0x4169E1),
    secondaryColor: new THREE.Color(0x87CEEB),
    gravity: -10,
    spread: 1,
    velocity: new THREE.Vector3(0, 5, 0),
    emissionShape: 'cone',
  },
  skill_heal: {
    particleCount: 30,
    particleSize: 0.08,
    duration: 2.0,
    color: new THREE.Color(0x00FF00),
    secondaryColor: new THREE.Color(0x90EE90),
    gravity: 3,
    spread: 0.5,
    velocity: new THREE.Vector3(0, 1, 0),
    emissionShape: 'sphere',
  },
  skill_buff: {
    particleCount: 25,
    particleSize: 0.06,
    duration: 1.5,
    color: new THREE.Color(0xFFD700),
    secondaryColor: new THREE.Color(0xFFFF00),
    gravity: 2,
    spread: 0.8,
    velocity: new THREE.Vector3(0, 1.5, 0),
    emissionShape: 'sphere',
  },
  skill_debuff: {
    particleCount: 25,
    particleSize: 0.06,
    duration: 1.5,
    color: new THREE.Color(0x800080),
    secondaryColor: new THREE.Color(0x4B0082),
    gravity: -1,
    spread: 0.8,
    velocity: new THREE.Vector3(0, -0.5, 0),
    emissionShape: 'sphere',
  },
  levelup: {
    particleCount: 60,
    particleSize: 0.1,
    duration: 3.0,
    color: new THREE.Color(0xFFD700),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: 1,
    spread: 2,
    velocity: new THREE.Vector3(0, 3, 0),
    emissionShape: 'sphere',
  },
  loot_drop: {
    particleCount: 15,
    particleSize: 0.05,
    duration: 1.0,
    color: new THREE.Color(0xFFD700),
    gravity: 0,
    spread: 0.3,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'point',
  },
  projectile_muzzle_flash: {
    particleCount: 20,
    particleSize: 0.15,
    duration: 0.15,
    color: new THREE.Color(0xFFAA00),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: 0,
    spread: 0.8,
    velocity: new THREE.Vector3(0, 0, 5),
    emissionShape: 'cone',
  },
  projectile_cannon_smoke: {
    particleCount: 40,
    particleSize: 0.4,
    duration: 2.0,
    color: new THREE.Color(0x555555),
    secondaryColor: new THREE.Color(0x888888),
    gravity: 1,
    spread: 1.5,
    velocity: new THREE.Vector3(0, 2, 3),
    emissionShape: 'cone',
  },
  projectile_arrow_trail: {
    particleCount: 5,
    particleSize: 0.03,
    duration: 0.3,
    color: new THREE.Color(0x8B4513),
    gravity: 0,
    spread: 0.1,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'point',
  },
  projectile_magic_trail: {
    particleCount: 15,
    particleSize: 0.08,
    duration: 0.5,
    color: new THREE.Color(0x9B59B6),
    secondaryColor: new THREE.Color(0xE8DAEF),
    gravity: 0,
    spread: 0.2,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'sphere',
  },
  projectile_fire_trail: {
    particleCount: 20,
    particleSize: 0.12,
    duration: 0.4,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 2,
    spread: 0.3,
    velocity: new THREE.Vector3(0, 1, 0),
    emissionShape: 'sphere',
  },
  projectile_impact_arrow: {
    particleCount: 8,
    particleSize: 0.05,
    duration: 0.5,
    color: new THREE.Color(0x8B4513),
    gravity: -8,
    spread: 0.4,
    velocity: new THREE.Vector3(0, 2, 0),
    emissionShape: 'sphere',
  },
  projectile_impact_bullet: {
    particleCount: 15,
    particleSize: 0.03,
    duration: 0.3,
    color: new THREE.Color(0xFFD700),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: -15,
    spread: 0.6,
    velocity: new THREE.Vector3(0, 3, 0),
    emissionShape: 'sphere',
  },
  projectile_explosion: {
    particleCount: 60,
    particleSize: 0.25,
    duration: 1.5,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0x2F2F2F),
    gravity: -5,
    spread: 3.0,
    velocity: new THREE.Vector3(0, 8, 0),
    emissionShape: 'sphere',
  },
  projectile_arcane_burst: {
    particleCount: 35,
    particleSize: 0.12,
    duration: 0.8,
    color: new THREE.Color(0x9B59B6),
    secondaryColor: new THREE.Color(0xE8DAEF),
    gravity: 0,
    spread: 1.5,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'sphere',
  },
  projectile_fire_explosion: {
    particleCount: 50,
    particleSize: 0.2,
    duration: 1.2,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 3,
    spread: 2.5,
    velocity: new THREE.Vector3(0, 5, 0),
    emissionShape: 'sphere',
  },
  projectile_ice_shatter: {
    particleCount: 30,
    particleSize: 0.1,
    duration: 1.0,
    color: new THREE.Color(0x00CED1),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: -10,
    spread: 1.8,
    velocity: new THREE.Vector3(0, 4, 0),
    emissionShape: 'sphere',
  },
  projectile_lightning_strike: {
    particleCount: 25,
    particleSize: 0.08,
    duration: 0.4,
    color: new THREE.Color(0xFFFF00),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: 0,
    spread: 0.5,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'point',
  },
  movement_phase: {
    particleCount: 40,
    particleSize: 0.06,
    duration: 0.8,
    color: new THREE.Color(0x00BFFF),
    secondaryColor: new THREE.Color(0xE0FFFF),
    gravity: 0,
    spread: 1.2,
    velocity: new THREE.Vector3(0, 0.5, 0),
    emissionShape: 'box',
  },
  movement_flash_step: {
    particleCount: 60,
    particleSize: 0.04,
    duration: 0.3,
    color: new THREE.Color(0xFFFFFF),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 0,
    spread: 0.5,
    velocity: new THREE.Vector3(0, 2, 0),
    emissionShape: 'sphere',
  },
  movement_dash_trail: {
    particleCount: 30,
    particleSize: 0.08,
    duration: 0.6,
    color: new THREE.Color(0x4169E1),
    secondaryColor: new THREE.Color(0x87CEEB),
    gravity: 0,
    spread: 0.3,
    velocity: new THREE.Vector3(0, 0, -3),
    emissionShape: 'cone',
  },
  movement_teleport: {
    particleCount: 80,
    particleSize: 0.1,
    duration: 1.0,
    color: new THREE.Color(0x9400D3),
    secondaryColor: new THREE.Color(0xDA70D6),
    gravity: 0,
    spread: 2.0,
    velocity: new THREE.Vector3(0, 3, 0),
    emissionShape: 'sphere',
  },
  spell_cast_fire: {
    particleCount: 45,
    particleSize: 0.12,
    duration: 0.8,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 3,
    spread: 0.8,
    velocity: new THREE.Vector3(0, 4, 0),
    emissionShape: 'cone',
  },
  spell_cast_ice: {
    particleCount: 35,
    particleSize: 0.1,
    duration: 0.8,
    color: new THREE.Color(0x00CED1),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: -2,
    spread: 0.6,
    velocity: new THREE.Vector3(0, 2, 0),
    emissionShape: 'cone',
  },
  spell_cast_lightning: {
    particleCount: 50,
    particleSize: 0.06,
    duration: 0.4,
    color: new THREE.Color(0xFFFF00),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: 0,
    spread: 1.0,
    velocity: new THREE.Vector3(0, 8, 0),
    emissionShape: 'point',
  },
  spell_cast_arcane: {
    particleCount: 40,
    particleSize: 0.1,
    duration: 1.0,
    color: new THREE.Color(0x9B59B6),
    secondaryColor: new THREE.Color(0xE8DAEF),
    gravity: 0,
    spread: 1.2,
    velocity: new THREE.Vector3(0, 1, 0),
    emissionShape: 'sphere',
  },
  spell_cast_holy: {
    particleCount: 50,
    particleSize: 0.08,
    duration: 1.2,
    color: new THREE.Color(0xFFD700),
    secondaryColor: new THREE.Color(0xFFFACD),
    gravity: 2,
    spread: 1.5,
    velocity: new THREE.Vector3(0, 3, 0),
    emissionShape: 'sphere',
  },
  spell_cast_shadow: {
    particleCount: 35,
    particleSize: 0.12,
    duration: 1.0,
    color: new THREE.Color(0x2F1B41),
    secondaryColor: new THREE.Color(0x800080),
    gravity: -1,
    spread: 1.0,
    velocity: new THREE.Vector3(0, -1, 0),
    emissionShape: 'sphere',
  },
  spell_impact_fire: {
    particleCount: 60,
    particleSize: 0.18,
    duration: 1.0,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0xFFD700),
    gravity: 4,
    spread: 2.0,
    velocity: new THREE.Vector3(0, 6, 0),
    emissionShape: 'sphere',
  },
  spell_impact_ice: {
    particleCount: 45,
    particleSize: 0.12,
    duration: 1.2,
    color: new THREE.Color(0x00CED1),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: -8,
    spread: 1.8,
    velocity: new THREE.Vector3(0, 5, 0),
    emissionShape: 'sphere',
  },
  spell_impact_lightning: {
    particleCount: 40,
    particleSize: 0.08,
    duration: 0.5,
    color: new THREE.Color(0xFFFF00),
    secondaryColor: new THREE.Color(0x00BFFF),
    gravity: 0,
    spread: 2.5,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'sphere',
  },
  spell_aoe_fire: {
    particleCount: 100,
    particleSize: 0.2,
    duration: 2.0,
    color: new THREE.Color(0xFF4500),
    secondaryColor: new THREE.Color(0xFF8C00),
    gravity: 2,
    spread: 4.0,
    velocity: new THREE.Vector3(0, 2, 0),
    emissionShape: 'box',
  },
  spell_aoe_ice: {
    particleCount: 80,
    particleSize: 0.15,
    duration: 2.5,
    color: new THREE.Color(0x00CED1),
    secondaryColor: new THREE.Color(0xADD8E6),
    gravity: -1,
    spread: 3.5,
    velocity: new THREE.Vector3(0, 0.5, 0),
    emissionShape: 'box',
  },
  spell_aoe_poison: {
    particleCount: 70,
    particleSize: 0.18,
    duration: 3.0,
    color: new THREE.Color(0x32CD32),
    secondaryColor: new THREE.Color(0x228B22),
    gravity: 0.5,
    spread: 3.0,
    velocity: new THREE.Vector3(0, 1, 0),
    emissionShape: 'box',
  },
  spell_channel_beam: {
    particleCount: 30,
    particleSize: 0.06,
    duration: 0.2,
    color: new THREE.Color(0x00FFFF),
    secondaryColor: new THREE.Color(0xFFFFFF),
    gravity: 0,
    spread: 0.1,
    velocity: new THREE.Vector3(0, 0, 10),
    emissionShape: 'cone',
  },
  spell_summon_portal: {
    particleCount: 60,
    particleSize: 0.15,
    duration: 2.0,
    color: new THREE.Color(0x9400D3),
    secondaryColor: new THREE.Color(0x4B0082),
    gravity: 0,
    spread: 1.5,
    velocity: new THREE.Vector3(0, 0, 0),
    emissionShape: 'sphere',
  },
};

const DEFAULT_CONFIG: EffectConfig = {
  particleCount: 20,
  particleSize: 0.1,
  duration: 1.5,
  color: new THREE.Color(0xFFFFFF),
  velocity: new THREE.Vector3(0, 2, 0),
  gravity: -9.8,
  spread: 1.0,
  fadeOut: true,
  emissionShape: 'sphere',
  useGPUInstancing: false,
};

export class PolygonJSEffectsManager {
  private scene: THREE.Scene;
  private activeEffects: Map<string, ActiveEffect> = new Map();
  private effectIdCounter = 0;
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private materialCache: Map<string, THREE.Material> = new Map();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initGeometryCache();
  }
  
  private initGeometryCache(): void {
    this.geometryCache.set('chip', new THREE.BoxGeometry(1, 1, 1));
    this.geometryCache.set('sphere', new THREE.SphereGeometry(0.5, 8, 6));
    this.geometryCache.set('leaf', new THREE.PlaneGeometry(1, 1));
    this.geometryCache.set('shard', new THREE.TetrahedronGeometry(0.5));
    this.geometryCache.set('spark', new THREE.OctahedronGeometry(0.5));
  }
  
  private getGeometry(type: EffectType): THREE.BufferGeometry {
    switch (type) {
      case 'harvest_wood':
      case 'harvest_stone':
      case 'harvest_ore':
        return this.geometryCache.get('chip')!;
      case 'harvest_plant':
        return this.geometryCache.get('leaf')!;
      case 'combat_hit':
      case 'combat_blood':
        return this.geometryCache.get('spark')!;
      case 'combat_magic':
      case 'skill_heal':
      case 'skill_buff':
      case 'skill_debuff':
        return this.geometryCache.get('sphere')!;
      case 'environment_fire':
      case 'environment_smoke':
      case 'environment_dust':
        return this.geometryCache.get('sphere')!;
      case 'environment_sparkle':
      case 'levelup':
      case 'loot_drop':
        return this.geometryCache.get('spark')!;
      case 'environment_water_splash':
        return this.geometryCache.get('sphere')!;
      default:
        return this.geometryCache.get('sphere')!;
    }
  }
  
  private getMaterial(color: THREE.Color, transparent: boolean = true): THREE.MeshLambertMaterial {
    const key = `${color.getHexString()}_${transparent}`;
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, new THREE.MeshLambertMaterial({
        color,
        transparent,
        opacity: 1.0,
      }));
    }
    return (this.materialCache.get(key) as THREE.MeshLambertMaterial).clone();
  }
  
  private getEmissionPoint(shape: EffectConfig['emissionShape'], spread: number): THREE.Vector3 {
    const point = new THREE.Vector3();
    
    switch (shape) {
      case 'point':
        break;
      case 'sphere':
        point.set(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        );
        break;
      case 'cone':
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spread * 0.5;
        point.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        break;
      case 'box':
        point.set(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread * 0.5,
          (Math.random() - 0.5) * spread
        );
        break;
    }
    
    return point;
  }
  
  private getInitialVelocity(config: EffectConfig): THREE.Vector3 {
    const velocity = config.velocity.clone();
    const spreadFactor = config.spread;
    
    velocity.x += (Math.random() - 0.5) * spreadFactor * 2;
    velocity.y += (Math.random() - 0.5) * spreadFactor;
    velocity.z += (Math.random() - 0.5) * spreadFactor * 2;
    
    return velocity;
  }
  
  spawnEffect(
    type: EffectType,
    position: THREE.Vector3,
    configOverride?: Partial<EffectConfig>
  ): string {
    const preset = EFFECT_PRESETS[type] || {};
    const config: EffectConfig = { ...DEFAULT_CONFIG, ...preset, ...configOverride };
    
    const effectId = `effect_${++this.effectIdCounter}`;
    const group = new THREE.Group();
    group.position.copy(position);
    
    const particleData: ParticleData[] = [];
    const geometry = this.getGeometry(type);
    
    for (let i = 0; i < config.particleCount; i++) {
      const useSecondary = config.secondaryColor && Math.random() > 0.6;
      const color = useSecondary ? config.secondaryColor! : config.color;
      const material = this.getMaterial(color, config.fadeOut);
      
      const mesh = new THREE.Mesh(geometry, material);
      
      const emissionPoint = this.getEmissionPoint(config.emissionShape, config.spread);
      mesh.position.copy(emissionPoint);
      
      const sizeFactor = config.particleSize * (0.5 + Math.random() * 0.5);
      mesh.scale.setScalar(sizeFactor);
      
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      group.add(mesh);
      
      particleData.push({
        mesh,
        velocity: this.getInitialVelocity(config),
        life: 1.0,
        maxLife: 1.0,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5
        ),
        scale: sizeFactor,
      });
    }
    
    this.scene.add(group);
    
    const activeEffect: ActiveEffect = {
      id: effectId,
      type,
      group,
      startTime: performance.now(),
      duration: config.duration * 1000,
      config,
      particleData,
    };
    
    this.activeEffects.set(effectId, activeEffect);
    
    return effectId;
  }
  
  spawnEffectAtObject(
    type: EffectType,
    object: THREE.Object3D,
    offset: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    configOverride?: Partial<EffectConfig>
  ): string {
    const worldPosition = new THREE.Vector3();
    object.getWorldPosition(worldPosition);
    worldPosition.add(offset);
    return this.spawnEffect(type, worldPosition, configOverride);
  }
  
  update(deltaTime: number): void {
    const currentTime = performance.now();
    const effectsToRemove: string[] = [];
    
    this.activeEffects.forEach((effect, id) => {
      const elapsed = currentTime - effect.startTime;
      const progress = elapsed / effect.duration;
      
      if (progress >= 1) {
        effectsToRemove.push(id);
        return;
      }
      
      const { config, particleData } = effect;
      
      particleData.forEach((particle) => {
        particle.velocity.y += config.gravity * deltaTime;
        
        particle.mesh.position.x += particle.velocity.x * deltaTime;
        particle.mesh.position.y += particle.velocity.y * deltaTime;
        particle.mesh.position.z += particle.velocity.z * deltaTime;
        
        particle.mesh.rotation.x += particle.rotationSpeed.x * deltaTime;
        particle.mesh.rotation.y += particle.rotationSpeed.y * deltaTime;
        particle.mesh.rotation.z += particle.rotationSpeed.z * deltaTime;
        
        if (config.fadeOut) {
          particle.life = 1.0 - progress;
          const material = particle.mesh.material as THREE.MeshLambertMaterial;
          if (material && material.opacity !== undefined) {
            material.opacity = Math.max(0, particle.life);
            material.transparent = true;
          }
        }
        
        const scaleFactor = 1.0 - progress * 0.5;
        particle.mesh.scale.setScalar(particle.scale * scaleFactor);
      });
    });
    
    effectsToRemove.forEach((id) => this.removeEffect(id));
  }
  
  removeEffect(effectId: string): void {
    const effect = this.activeEffects.get(effectId);
    if (effect) {
      effect.particleData.forEach((particle) => {
        if (particle.mesh.material) {
          (particle.mesh.material as THREE.Material).dispose();
        }
      });
      this.scene.remove(effect.group);
      this.activeEffects.delete(effectId);
    }
  }
  
  removeAllEffects(): void {
    this.activeEffects.forEach((_, id) => this.removeEffect(id));
  }
  
  getActiveEffectCount(): number {
    return this.activeEffects.size;
  }
  
  dispose(): void {
    this.removeAllEffects();
    
    this.geometryCache.forEach((geo) => geo.dispose());
    this.geometryCache.clear();
    
    this.materialCache.forEach((mat) => mat.dispose());
    this.materialCache.clear();
  }
}

export function createHarvestEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: 'tree' | 'rock' | 'ore' | 'plant'
): string {
  const effectType: EffectType = 
    type === 'tree' ? 'harvest_wood' :
    type === 'rock' ? 'harvest_stone' :
    type === 'ore' ? 'harvest_ore' : 'harvest_plant';
  
  return effectsManager.spawnEffect(effectType, position);
}

export function createCombatEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: 'hit' | 'blood' | 'magic'
): string {
  const effectType: EffectType = 
    type === 'hit' ? 'combat_hit' :
    type === 'blood' ? 'combat_blood' : 'combat_magic';
  
  return effectsManager.spawnEffect(effectType, position);
}

export function createEnvironmentEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: 'fire' | 'smoke' | 'dust' | 'sparkle' | 'water_splash'
): string {
  const effectType: EffectType = `environment_${type}` as EffectType;
  return effectsManager.spawnEffect(effectType, position);
}

export function createSkillEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: 'heal' | 'buff' | 'debuff'
): string {
  const effectType: EffectType = `skill_${type}` as EffectType;
  return effectsManager.spawnEffect(effectType, position);
}

export type ProjectileMuzzleType = 'muzzle_flash' | 'cannon_smoke';
export type ProjectileTrailType = 'arrow_trail' | 'magic_trail' | 'fire_trail';
export type ProjectileImpactType = 'impact_arrow' | 'impact_bullet' | 'explosion' | 'arcane_burst' | 'fire_explosion' | 'ice_shatter' | 'lightning_strike';

export function createProjectileMuzzleEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: ProjectileMuzzleType
): string {
  const effectType: EffectType = `projectile_${type}` as EffectType;
  return effectsManager.spawnEffect(effectType, position);
}

export function createProjectileTrailEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: ProjectileTrailType
): string {
  const effectType: EffectType = `projectile_${type}` as EffectType;
  return effectsManager.spawnEffect(effectType, position);
}

export function createProjectileImpactEffect(
  effectsManager: PolygonJSEffectsManager,
  position: THREE.Vector3,
  type: ProjectileImpactType
): string {
  const effectType: EffectType = `projectile_${type}` as EffectType;
  return effectsManager.spawnEffect(effectType, position);
}
