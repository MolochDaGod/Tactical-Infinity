/**
 * sailingScenics — bundles weather visuals + ambient sea life into one
 * mountable system for OpenWaterSailing (and any other open-water scene
 * that wants the same vibe).
 *
 * Composes existing modules — does not reinvent them:
 *   - RainSystem           (rainSystem.ts)
 *   - LightningSystem      (rainSystem.ts)
 *   - SeaCreatureSystem    (seaCreatureSystem.ts)
 *
 * Drives them every frame from the live `WeatherConfig` already produced
 * by OpenWaterSailing's storm controller, plus the player position.
 *
 * Lightning uses a Poisson-style trigger gated on rain intensity so storms
 * crackle naturally instead of on a fixed schedule.
 */

import * as THREE from 'three';
import { RainSystem, LightningSystem } from './rainSystem';
import { SeaCreatureSystem } from './seaCreatureSystem';
import type { WeatherConfig } from './weatherSystem';

export interface SailingScenicsOpts {
  scene:  THREE.Scene;
  /** Initial spawn count for ambient sea creatures. */
  initialCreatures?: number;
  /** Seconds between top-up spawns when creature count drops. */
  respawnIntervalSec?: number;
}

export class SailingScenics {
  private rain      = new RainSystem({ count: 8000, areaSize: 200, height: 60 });
  private lightning = new LightningSystem();
  private creatures: SeaCreatureSystem;
  private opts:      Required<SailingScenicsOpts>;
  private respawnTimer = 0;
  private lightningCooldown = 0;
  private creaturesPreloaded = false;

  constructor(opts: SailingScenicsOpts) {
    this.opts = {
      initialCreatures:    14,
      respawnIntervalSec:  20,
      ...opts,
    };
    this.creatures = new SeaCreatureSystem(this.opts.scene);
    this.rain.init(this.opts.scene);
    this.lightning.init(this.opts.scene);
  }

  /**
   * Lazy-load creature models, then spawn the initial school. Safe to call
   * multiple times — only the first call does work.
   */
  async warmup(playerPos: THREE.Vector3): Promise<void> {
    if (this.creaturesPreloaded) return;
    this.creaturesPreloaded = true;
    try {
      await this.creatures.preloadModels();
      this.creatures.spawnRandomCreatures(this.opts.initialCreatures, playerPos);
    } catch (e) {
      console.warn('[SailingScenics] creature preload failed', e);
    }
  }

  /** Drive all subsystems for one frame. */
  update(
    delta:    number,
    elapsed:  number,
    weather:  WeatherConfig,
    playerPos: THREE.Vector3,
    playerVel?: THREE.Vector3,
  ): void {
    // Rain — keep it centred on the player so particles always surround them.
    this.rain.setIntensity(weather.rainIntensity ?? 0);
    this.rain.update(elapsed, playerPos);

    // Lightning — poisson-ish trigger gated on rain.  Average ~one strike
    // every ~6 seconds at full storm intensity, none below 0.4.
    this.lightning.update(delta);
    this.lightningCooldown -= delta;
    const stormPower = Math.max(0, (weather.rainIntensity ?? 0) - 0.4) / 0.6;
    if (stormPower > 0 && this.lightningCooldown <= 0) {
      const strikeChancePerSec = stormPower * 0.18;
      if (Math.random() < strikeChancePerSec * delta * 60) {
        this.lightning.triggerLightning(0.7 + stormPower * 0.6);
        this.lightningCooldown = 0.6 + Math.random() * 1.2;
      }
    }

    // Sea creatures — feed player kinematics, advance behaviours, top up
    // population periodically so the seas never feel barren.
    this.creatures.setPlayerPosition(playerPos, playerVel);
    this.creatures.update(delta);
    this.respawnTimer += delta;
    if (this.respawnTimer >= this.opts.respawnIntervalSec) {
      this.respawnTimer = 0;
      const current = this.creatures.getCreatures().length;
      const want    = this.opts.initialCreatures;
      if (current < want) {
        this.creatures.spawnRandomCreatures(want - current, playerPos);
      }
    }
  }

  /**
   * Wire scene-specific seabed/land getters into the creature system.
   * When provided, fish-class creatures will be hard-clamped to never beach
   * themselves or sink below the seabed.  Safe to call any time.
   */
  setSeabedGetter(getter: (x: number, z: number) => number): void {
    this.creatures.setOceanFloorDepth(getter);
  }

  setLandCheck(check: (x: number, z: number) => boolean): void {
    this.creatures.setIsPointOnLand(check);
  }

  /** Expose the underlying systems for advanced hosts (kraken events etc). */
  getCreatureSystem() { return this.creatures; }
  getRainSystem()     { return this.rain; }
  getLightningSystem(){ return this.lightning; }
}
