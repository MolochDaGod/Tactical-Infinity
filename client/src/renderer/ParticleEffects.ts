import * as PIXI from "pixi.js";
import { Emitter, upgradeConfig } from "@pixi/particle-emitter";

export interface ParticleConfig {
  alpha: { start: number; end: number };
  scale: { start: number; end: number; minimumScaleMultiplier?: number };
  color: { start: string; end: string };
  speed: { start: number; end: number; minimumSpeedMultiplier?: number };
  acceleration: { x: number; y: number };
  maxSpeed: number;
  startRotation: { min: number; max: number };
  noRotation: boolean;
  rotationSpeed: { min: number; max: number };
  lifetime: { min: number; max: number };
  blendMode: string;
  frequency: number;
  emitterLifetime: number;
  maxParticles: number;
  pos: { x: number; y: number };
  addAtBack: boolean;
  spawnType: string;
  spawnRect?: { x: number; y: number; w: number; h: number };
  spawnCircle?: { x: number; y: number; r: number; minR?: number };
}

export const particlePresets: Record<string, Partial<ParticleConfig>> = {
  slash: {
    alpha: { start: 1, end: 0 },
    scale: { start: 0.4, end: 0.1 },
    color: { start: "#ffffff", end: "#888888" },
    speed: { start: 200, end: 50 },
    lifetime: { min: 0.2, max: 0.4 },
    blendMode: "add",
    frequency: 0.01,
    emitterLifetime: 0.3,
    maxParticles: 50,
    spawnType: "point",
  },
  fireball: {
    alpha: { start: 0.9, end: 0 },
    scale: { start: 0.5, end: 0.2 },
    color: { start: "#ff6600", end: "#ffcc00" },
    speed: { start: 100, end: 20 },
    lifetime: { min: 0.3, max: 0.6 },
    blendMode: "add",
    frequency: 0.02,
    emitterLifetime: -1,
    maxParticles: 100,
    spawnType: "circle",
    spawnCircle: { x: 0, y: 0, r: 10 },
  },
  explosion: {
    alpha: { start: 1, end: 0 },
    scale: { start: 0.8, end: 0.1 },
    color: { start: "#ff4400", end: "#ffff00" },
    speed: { start: 300, end: 0 },
    lifetime: { min: 0.5, max: 1 },
    blendMode: "add",
    frequency: 0.001,
    emitterLifetime: 0.1,
    maxParticles: 100,
    spawnType: "burst",
  },
  heal: {
    alpha: { start: 0.8, end: 0 },
    scale: { start: 0.3, end: 0.6 },
    color: { start: "#00ff88", end: "#88ffcc" },
    speed: { start: 50, end: 20 },
    acceleration: { x: 0, y: -50 },
    lifetime: { min: 0.8, max: 1.2 },
    blendMode: "add",
    frequency: 0.05,
    emitterLifetime: 1,
    maxParticles: 30,
    spawnType: "circle",
    spawnCircle: { x: 0, y: 0, r: 20 },
  },
  lightning: {
    alpha: { start: 1, end: 0 },
    scale: { start: 0.2, end: 0.1 },
    color: { start: "#88ddff", end: "#ffffff" },
    speed: { start: 400, end: 100 },
    lifetime: { min: 0.1, max: 0.2 },
    blendMode: "add",
    frequency: 0.005,
    emitterLifetime: 0.2,
    maxParticles: 50,
    spawnType: "rect",
    spawnRect: { x: -5, y: -50, w: 10, h: 100 },
  },
  poison: {
    alpha: { start: 0.6, end: 0 },
    scale: { start: 0.2, end: 0.4 },
    color: { start: "#00aa00", end: "#88ff88" },
    speed: { start: 20, end: 10 },
    acceleration: { x: 0, y: -20 },
    lifetime: { min: 1, max: 2 },
    blendMode: "normal",
    frequency: 0.1,
    emitterLifetime: 2,
    maxParticles: 20,
    spawnType: "circle",
    spawnCircle: { x: 0, y: 0, r: 15 },
  },
  hit: {
    alpha: { start: 1, end: 0 },
    scale: { start: 0.3, end: 0.05 },
    color: { start: "#ff0000", end: "#ff8800" },
    speed: { start: 150, end: 0 },
    lifetime: { min: 0.2, max: 0.4 },
    blendMode: "add",
    frequency: 0.01,
    emitterLifetime: 0.15,
    maxParticles: 30,
    spawnType: "burst",
  },
  death: {
    alpha: { start: 0.8, end: 0 },
    scale: { start: 0.4, end: 0.8 },
    color: { start: "#444444", end: "#000000" },
    speed: { start: 30, end: 5 },
    acceleration: { x: 0, y: -30 },
    lifetime: { min: 1, max: 2 },
    blendMode: "normal",
    frequency: 0.02,
    emitterLifetime: 1,
    maxParticles: 50,
    spawnType: "circle",
    spawnCircle: { x: 0, y: 0, r: 20 },
  },
};

export class EffectSystem {
  private container: PIXI.Container;
  private activeEmitters: Map<string, Emitter> = new Map();
  private particleTexture: PIXI.Texture | null = null;

  constructor(container: PIXI.Container) {
    this.container = container;
    this.createParticleTexture();
  }

  private createParticleTexture() {
    this.particleTexture = this.getDefaultParticleTexture();
  }

  private getDefaultParticleTexture(): PIXI.Texture {
    if (this.particleTexture) return this.particleTexture;
    
    const graphics = new PIXI.Graphics();
    graphics.circle(0, 0, 4).fill({ color: 0xffffff });
    
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(8, 8, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return PIXI.Texture.from(canvas);
  }

  playEffect(
    effectName: string,
    x: number,
    y: number,
    options?: {
      scale?: number;
      duration?: number;
      onComplete?: () => void;
    }
  ): string {
    const preset = particlePresets[effectName];
    if (!preset) {
      console.warn(`Effect "${effectName}" not found`);
      options?.onComplete?.();
      return "";
    }

    const effectId = `${effectName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const effectContainer = new PIXI.Container();
    effectContainer.position.set(x, y);
    if (options?.scale) {
      effectContainer.scale.set(options.scale);
    }
    this.container.addChild(effectContainer);

    const config = {
      lifetime: preset.lifetime || { min: 0.5, max: 1 },
      frequency: preset.frequency || 0.05,
      emitterLifetime: preset.emitterLifetime || 1,
      maxParticles: preset.maxParticles || 50,
      addAtBack: false,
      pos: { x: 0, y: 0 },
      behaviors: [
        {
          type: "alpha",
          config: {
            alpha: {
              list: [
                { value: preset.alpha?.start || 1, time: 0 },
                { value: preset.alpha?.end || 0, time: 1 },
              ],
            },
          },
        },
        {
          type: "scale",
          config: {
            scale: {
              list: [
                { value: preset.scale?.start || 0.5, time: 0 },
                { value: preset.scale?.end || 0.1, time: 1 },
              ],
            },
          },
        },
        {
          type: "color",
          config: {
            color: {
              list: [
                { value: preset.color?.start || "#ffffff", time: 0 },
                { value: preset.color?.end || "#888888", time: 1 },
              ],
            },
          },
        },
        {
          type: "moveSpeed",
          config: {
            speed: {
              list: [
                { value: preset.speed?.start || 100, time: 0 },
                { value: preset.speed?.end || 20, time: 1 },
              ],
            },
          },
        },
        {
          type: "rotationStatic",
          config: {
            min: 0,
            max: 360,
          },
        },
        {
          type: "spawnShape",
          config: {
            type: preset.spawnType || "point",
            data: preset.spawnCircle || preset.spawnRect || { x: 0, y: 0 },
          },
        },
        {
          type: "textureSingle",
          config: {
            texture: this.getDefaultParticleTexture(),
          },
        },
      ],
    };

    const emitter = new Emitter(effectContainer as any, config);
    emitter.emit = true;
    this.activeEmitters.set(effectId, emitter);

    const duration = options?.duration || (preset.emitterLifetime || 1) * 1000 + 500;
    
    let elapsed = 0;
    let lastTime = Date.now();
    
    const update = () => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      elapsed += delta * 1000;
      
      emitter.update(delta);
      
      if (elapsed < duration) {
        requestAnimationFrame(update);
      } else {
        emitter.emit = false;
        emitter.destroy();
        this.container.removeChild(effectContainer);
        effectContainer.destroy({ children: true });
        this.activeEmitters.delete(effectId);
        options?.onComplete?.();
      }
    };
    
    requestAnimationFrame(update);
    
    return effectId;
  }

  stopEffect(effectId: string) {
    const emitter = this.activeEmitters.get(effectId);
    if (emitter) {
      emitter.emit = false;
      emitter.destroy();
      this.activeEmitters.delete(effectId);
    }
  }

  stopAllEffects() {
    this.activeEmitters.forEach((emitter) => {
      emitter.emit = false;
      emitter.destroy();
    });
    this.activeEmitters.clear();
  }

  destroy() {
    this.stopAllEffects();
    this.particleTexture?.destroy();
  }
}

export function createProjectileEffect(
  container: PIXI.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  effectType: "arrow" | "fireball" | "lightning",
  onComplete?: () => void
): void {
  const projectile = new PIXI.Graphics();
  
  switch (effectType) {
    case "arrow":
      projectile.moveTo(-8, 0).lineTo(8, 0).stroke({ color: 0x8b4513, width: 2 });
      projectile.moveTo(6, -3).lineTo(8, 0).lineTo(6, 3).stroke({ color: 0x444444, width: 2 });
      break;
    case "fireball":
      projectile.circle(0, 0, 8).fill({ color: 0xff6600 });
      projectile.circle(0, 0, 5).fill({ color: 0xffcc00 });
      break;
    case "lightning":
      projectile.circle(0, 0, 6).fill({ color: 0x88ddff });
      break;
  }
  
  projectile.position.set(fromX, fromY);
  
  const angle = Math.atan2(toY - fromY, toX - fromX);
  projectile.rotation = angle;
  
  container.addChild(projectile);
  
  const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
  const speed = effectType === "lightning" ? 800 : effectType === "fireball" ? 400 : 600;
  const duration = (distance / speed) * 1000;
  
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    projectile.position.x = fromX + (toX - fromX) * progress;
    projectile.position.y = fromY + (toY - fromY) * progress;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      container.removeChild(projectile);
      projectile.destroy();
      onComplete?.();
    }
  };
  
  requestAnimationFrame(animate);
}
