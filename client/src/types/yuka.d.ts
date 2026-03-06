declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    length(): number;
    normalize(): this;
    distanceTo(v: Vector3): number;
  }

  export class Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    set(x: number, y: number, z: number, w: number): this;
    copy(q: Quaternion): this;
  }

  export class GameEntity {
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    forward: Vector3;
    up: Vector3;
    velocity: Vector3;
    boundingRadius: number;
    active: boolean;
    constructor();
    start(): this;
    update(delta: number): this;
  }

  export class Vehicle extends GameEntity {
    mass: number;
    maxSpeed: number;
    maxForce: number;
    maxTurnRate: number;
    steering: SteeringManager;
    smoother: Smoother | null;
    constructor();
  }

  export class SteeringManager {
    add(behavior: SteeringBehavior): this;
    remove(behavior: SteeringBehavior): this;
    clear(): this;
  }

  export class Smoother {
    constructor(count: number);
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;
  }

  export class SeekBehavior extends SteeringBehavior {
    target: Vector3;
    constructor(target?: Vector3);
  }

  export class FleeBehavior extends SteeringBehavior {
    target: Vector3;
    panicDistance: number;
    constructor(target?: Vector3, panicDistance?: number);
  }

  export class ArriveBehavior extends SteeringBehavior {
    target: Vector3;
    deceleration: number;
    tolerance: number;
    constructor(target?: Vector3, deceleration?: number, tolerance?: number);
  }

  export class WanderBehavior extends SteeringBehavior {
    radius: number;
    distance: number;
    jitter: number;
    constructor(radius?: number, distance?: number, jitter?: number);
  }

  export class PursuitBehavior extends SteeringBehavior {
    evader: Vehicle | null;
    predictionFactor: number;
    constructor(evader?: Vehicle, predictionFactor?: number);
  }

  export class EvadeBehavior extends SteeringBehavior {
    pursuer: Vehicle | null;
    panicDistance: number;
    predictionFactor: number;
    constructor(pursuer?: Vehicle, panicDistance?: number, predictionFactor?: number);
  }

  export class FollowPathBehavior extends SteeringBehavior {
    path: any;
    nextWaypointDistance: number;
    constructor(path?: any, nextWaypointDistance?: number);
  }

  export class ObstacleAvoidanceBehavior extends SteeringBehavior {
    obstacles: GameEntity[];
    brakingWeight: number;
    dBoxMinLength: number;
    constructor(obstacles?: GameEntity[]);
  }

  export class SeparationBehavior extends SteeringBehavior {
    constructor();
  }

  export class AlignmentBehavior extends SteeringBehavior {
    constructor();
  }

  export class CohesionBehavior extends SteeringBehavior {
    constructor();
  }

  export class EntityManager {
    entities: GameEntity[];
    constructor();
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    clear(): this;
    update(delta: number): this;
  }

  export class Time {
    constructor();
    update(): this;
    getDelta(): number;
    getElapsed(): number;
  }

  export class State<T = GameEntity> {
    constructor();
    enter(entity: T): void;
    execute(entity: T): void;
    exit(entity: T): void;
  }

  export class StateMachine<T = GameEntity> {
    owner: T;
    currentState: State<T> | null;
    previousState: State<T> | null;
    globalState: State<T> | null;
    states: Map<string, State<T>>;
    constructor(owner: T);
    add(name: string, state: State<T>): this;
    remove(name: string): this;
    changeTo(name: string): this;
    revert(): this;
    in(name: string): boolean;
    update(): this;
  }

  export class Graph {
    digraph: boolean;
    constructor();
    addNode(node: NavNode): number;
    getNode(index: number): NavNode;
    addEdge(edge: NavEdge): this;
    hasNode(index: number): boolean;
    clear(): this;
  }

  export class NavNode {
    index: number;
    position: Vector3;
    constructor(index?: number, position?: Vector3);
  }

  export class NavEdge {
    from: number;
    to: number;
    cost: number;
    constructor(from?: number, to?: number, cost?: number);
  }

  export class AStar {
    graph: Graph;
    source: number;
    target: number;
    constructor(graph: Graph, source: number, target: number);
    search(): number[];
  }

  export class NavMesh {
    regions: any[];
    constructor();
    fromPolygons(polygons: any[]): this;
    findPath(from: Vector3, to: Vector3): Vector3[];
    getClosestRegion(point: Vector3): any;
  }

  export class Path {
    loop: boolean;
    constructor();
    add(point: Vector3): this;
    clear(): this;
    current(): Vector3;
    advance(): this;
    finished(): boolean;
  }

  export class Trigger extends GameEntity {
    region: any;
    constructor(region?: any);
    check(entity: GameEntity): void;
    execute(entity: GameEntity): void;
  }
}
