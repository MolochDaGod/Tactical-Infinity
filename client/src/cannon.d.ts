declare module 'cannon' {
  export class Vec3 {
    x: number; y: number; z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vec3): this;
    clone(): Vec3;
    vadd(v: Vec3, target?: Vec3): Vec3;
    vsub(v: Vec3, target?: Vec3): Vec3;
    scale(s: number, target?: Vec3): Vec3;
    dot(v: Vec3): number;
    cross(v: Vec3, target?: Vec3): Vec3;
    normalize(): Vec3;
    length(): number;
  }
  export class Quaternion {
    x: number; y: number; z: number; w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    set(x: number, y: number, z: number, w: number): this;
    setFromEuler(x: number, y: number, z: number, order?: string): this;
    setFromAxisAngle(axis: Vec3, angle: number): this;
    mult(q: Quaternion, target?: Quaternion): Quaternion;
    normalize(): this;
    toEuler(target: Vec3, order?: string): void;
    vmult(v: Vec3, target?: Vec3): Vec3;
  }
  export class Shape { type: number; }
  export class Sphere extends Shape { constructor(radius: number); radius: number; }
  export class Box extends Shape { constructor(halfExtents: Vec3); halfExtents: Vec3; }
  export class Plane extends Shape { constructor(); }
  export class Cylinder extends Shape {
    constructor(radiusTop?: number, radiusBottom?: number, height?: number, numSegments?: number);
  }
  export class Heightfield extends Shape {
    constructor(data: number[][], options?: { minValue?: number; maxValue?: number; elementSize?: number });
  }
  export class Material {
    friction: number;
    restitution: number;
    constructor(options?: string | { name?: string; friction?: number; restitution?: number });
  }
  export class ContactMaterial {
    constructor(m1: Material, m2: Material, options?: {
      friction?: number; restitution?: number; contactEquationStiffness?: number;
    });
  }
  export class Body {
    position: Vec3;
    quaternion: Quaternion;
    velocity: Vec3;
    angularVelocity: Vec3;
    mass: number;
    linearDamping: number;
    angularDamping: number;
    type: number;
    sleepState: number;
    allowSleep: boolean;
    material: Material | null;
    shapes: Shape[];
    shapeOffsets: Vec3[];
    shapeOrientations: Quaternion[];
    constructor(options?: {
      mass?: number; position?: Vec3; quaternion?: Quaternion; velocity?: Vec3;
      linearDamping?: number; angularDamping?: number; type?: number; material?: Material;
      fixedRotation?: boolean; isTrigger?: boolean; shape?: Shape;
    });
    addShape(shape: Shape, offset?: Vec3, orientation?: Quaternion): void;
    applyForce(force: Vec3, worldPoint?: Vec3): void;
    applyImpulse(impulse: Vec3, worldPoint?: Vec3): void;
    wakeUp(): void;
    sleep(): void;
    updateMassProperties(): void;
  }
  export class RaycastResult {
    hasHit: boolean;
    body: Body | null;
    shape: Shape | null;
    distance: number;
    hitPointWorld: Vec3;
    hitNormalWorld: Vec3;
    reset(): void;
  }
  export class Broadphase {}
  export class NaiveBroadphase extends Broadphase {}
  export class SAPBroadphase extends Broadphase {}
  export class Solver {}
  export class GSSolver extends Solver { iterations: number; }
  export class World {
    gravity: Vec3;
    broadphase: Broadphase;
    solver: Solver;
    bodies: Body[];
    addBody(body: Body): void;
    removeBody(body: Body): void;
    addContactMaterial(m: ContactMaterial): void;
    step(dt: number, timeSinceLastCalled?: number, maxSubSteps?: number): void;
    raycastClosest(from: Vec3, to: Vec3, options: object, result: RaycastResult): boolean;
    raycastAll(from: Vec3, to: Vec3, options: object, callback: (result: RaycastResult) => void): boolean;
  }
  export const BODY_TYPES: { DYNAMIC: number; STATIC: number; KINEMATIC: number };
}
