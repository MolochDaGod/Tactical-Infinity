import * as PIXI from "pixi.js";
import type { AnimationDefinition } from "@/lib/assetManifest";

export type AnimationState = "idle" | "walk" | "attack" | "cast" | "shoot" | "heal" | "block" | "hit" | "death";

interface SpriteAnimatorOptions {
  spritesheet: PIXI.Texture;
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, AnimationDefinition>;
  defaultAnimation: string;
  onAnimationComplete?: (animationName: string) => void;
}

export class SpriteAnimator {
  private container: PIXI.Container;
  private currentSprite: PIXI.AnimatedSprite | null = null;
  private animations: Map<string, PIXI.Texture[]> = new Map();
  private animationDefs: Record<string, AnimationDefinition>;
  private currentAnimation: string = "";
  private onAnimationComplete?: (animationName: string) => void;

  constructor(options: SpriteAnimatorOptions) {
    this.container = new PIXI.Container();
    this.animationDefs = options.animations;
    this.onAnimationComplete = options.onAnimationComplete;

    this.buildAnimations(
      options.spritesheet,
      options.frameWidth,
      options.frameHeight,
      options.animations
    );

    this.play(options.defaultAnimation);
  }

  private buildAnimations(
    spritesheet: PIXI.Texture,
    frameWidth: number,
    frameHeight: number,
    animations: Record<string, AnimationDefinition>
  ) {
    const cols = Math.floor(spritesheet.width / frameWidth);

    for (const [name, def] of Object.entries(animations)) {
      const textures: PIXI.Texture[] = [];

      for (const frameIndex of def.frames) {
        const col = frameIndex % cols;
        const row = Math.floor(frameIndex / cols);

        const rect = new PIXI.Rectangle(
          col * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight
        );

        const texture = new PIXI.Texture({
          source: spritesheet.source,
          frame: rect,
        });
        textures.push(texture);
      }

      this.animations.set(name, textures);
    }
  }

  play(animationName: string, force: boolean = false) {
    if (this.currentAnimation === animationName && !force) return;

    const textures = this.animations.get(animationName);
    if (!textures || textures.length === 0) {
      console.warn(`Animation "${animationName}" not found`);
      return;
    }

    if (this.currentSprite) {
      this.container.removeChild(this.currentSprite);
      this.currentSprite.destroy();
    }

    this.currentSprite = new PIXI.AnimatedSprite(textures);
    this.currentSprite.anchor.set(0.5);

    const def = this.animationDefs[animationName];
    if (def) {
      this.currentSprite.animationSpeed = def.frameRate / 60;
      this.currentSprite.loop = def.loop;
    }

    this.currentSprite.onComplete = () => {
      this.onAnimationComplete?.(animationName);
      if (!def?.loop) {
        this.play("idle");
      }
    };

    this.container.addChild(this.currentSprite);
    this.currentSprite.play();
    this.currentAnimation = animationName;
  }

  stop() {
    this.currentSprite?.stop();
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  getCurrentAnimation(): string {
    return this.currentAnimation;
  }

  setPosition(x: number, y: number) {
    this.container.position.set(x, y);
  }

  setScale(scale: number) {
    this.container.scale.set(scale);
  }

  setTint(color: number) {
    if (this.currentSprite) {
      this.currentSprite.tint = color;
    }
  }

  setAlpha(alpha: number) {
    this.container.alpha = alpha;
  }

  destroy() {
    this.currentSprite?.destroy();
    this.container.destroy({ children: true });
    this.animations.clear();
  }
}

export class AnimationStateMachine {
  private animator: SpriteAnimator;
  private state: AnimationState = "idle";
  private queuedState: AnimationState | null = null;
  private isTransitioning: boolean = false;

  constructor(animator: SpriteAnimator) {
    this.animator = animator;
  }

  transition(newState: AnimationState) {
    if (this.state === newState) return;

    const interruptible = ["idle", "walk"];
    if (interruptible.includes(this.state) || !this.isTransitioning) {
      this.state = newState;
      this.isTransitioning = !["idle", "walk"].includes(newState);
      
      const animationName = this.mapStateToAnimation(newState);
      this.animator.play(animationName);
    } else {
      this.queuedState = newState;
    }
  }

  onAnimationComplete(animationName: string) {
    this.isTransitioning = false;
    
    if (this.queuedState) {
      const next = this.queuedState;
      this.queuedState = null;
      this.transition(next);
    } else if (!["idle", "walk"].includes(this.state)) {
      this.state = "idle";
      this.animator.play("idle");
    }
  }

  private mapStateToAnimation(state: AnimationState): string {
    const mapping: Record<AnimationState, string> = {
      idle: "idle",
      walk: "walk",
      attack: "attack",
      cast: "cast",
      shoot: "shoot",
      heal: "heal",
      block: "block",
      hit: "hit",
      death: "death",
    };
    return mapping[state] || "idle";
  }

  getState(): AnimationState {
    return this.state;
  }
}

export async function createAnimatorFromSpritesheet(
  spritesheetPath: string,
  frameWidth: number,
  frameHeight: number,
  animations: Record<string, AnimationDefinition>,
  defaultAnimation: string,
  onComplete?: (name: string) => void
): Promise<SpriteAnimator | null> {
  try {
    const texture = await PIXI.Assets.load(spritesheetPath);
    
    return new SpriteAnimator({
      spritesheet: texture,
      frameWidth,
      frameHeight,
      animations,
      defaultAnimation,
      onAnimationComplete: onComplete,
    });
  } catch (error) {
    console.warn(`Failed to load spritesheet: ${spritesheetPath}`, error);
    return null;
  }
}
