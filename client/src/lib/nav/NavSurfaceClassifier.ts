import * as THREE from 'three';

export type NavLayerKind = 'land' | 'water' | 'climb';

export interface ClassifierConfig {
  seaLevel: number;
  walkableMaxSlopeRad: number;
  climbMinSlopeRad: number;
  climbMaxSlopeRad: number;
  waterMaxDepth: number;
  minLandY: number;
  maxLandY: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  seaLevel: 0,
  walkableMaxSlopeRad: THREE.MathUtils.degToRad(40),
  climbMinSlopeRad: THREE.MathUtils.degToRad(70),
  climbMaxSlopeRad: THREE.MathUtils.degToRad(95),
  waterMaxDepth: 30,
  minLandY: 0.05,
  maxLandY: 200,
};

export interface SurfaceSample {
  y: number;
  slopeRad: number;
  normal?: THREE.Vector3;
}

export class NavSurfaceClassifier {
  config: ClassifierConfig;

  constructor(cfg: Partial<ClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...cfg };
  }

  classify(sample: SurfaceSample): NavLayerKind | null {
    const { y, slopeRad } = sample;
    const c = this.config;

    if (y <= c.seaLevel) {
      const depth = c.seaLevel - y;
      if (depth > c.waterMaxDepth) return null;
      return 'water';
    }

    if (slopeRad >= c.climbMinSlopeRad && slopeRad <= c.climbMaxSlopeRad) {
      return 'climb';
    }

    if (slopeRad <= c.walkableMaxSlopeRad && y >= c.minLandY && y <= c.maxLandY) {
      return 'land';
    }

    return null;
  }

  isCrossLayerTransition(a: NavLayerKind, b: NavLayerKind): boolean {
    if (a === b) return false;
    if ((a === 'land' && b === 'water') || (a === 'water' && b === 'land')) return true;
    if ((a === 'land' && b === 'climb') || (a === 'climb' && b === 'land')) return true;
    if ((a === 'water' && b === 'climb') || (a === 'climb' && b === 'water')) return true;
    return false;
  }

  describeTransition(a: NavLayerKind, b: NavLayerKind): string {
    if (a === 'land' && b === 'water') return 'enter-water';
    if (a === 'water' && b === 'land') return 'shore-out';
    if (a === 'land' && b === 'climb') return 'climb-up';
    if (a === 'climb' && b === 'land') return 'top-out';
    if (a === 'water' && b === 'climb') return 'climb-from-water';
    if (a === 'climb' && b === 'water') return 'drop-into-water';
    return 'transition';
  }
}
