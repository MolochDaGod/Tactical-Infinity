import * as THREE from 'three';

interface ClothParticle {
  position: THREE.Vector3;
  previousPosition: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  pinned: boolean;
}

interface ClothConstraint {
  p1: number;
  p2: number;
  restLength: number;
  stiffness: number;
}

export interface WindForce {
  direction: THREE.Vector3;
  strength: number;
  turbulence: number;
}

export class ClothSimulation {
  private particles: ClothParticle[] = [];
  private constraints: ClothConstraint[] = [];
  private width: number;
  private height: number;
  private segmentsX: number;
  private segmentsY: number;
  private damping: number = 0.92; // Stronger damping to prevent oscillation
  private gravity: THREE.Vector3 = new THREE.Vector3(0, -1.5, 0); // Lighter gravity
  private restPositions: THREE.Vector3[] = []; // Store initial positions for recovery
  private maxStretch: number = 2.0; // Maximum allowed stretch before reset (tightened from 2.5 — recovers sooner from gust spikes)
  private stuckFrameCount: number = 0; // Track stuck frames for auto-recovery
  
  constructor(
    width: number = 2,
    height: number = 3,
    segmentsX: number = 10,
    segmentsY: number = 15
  ) {
    this.width = width;
    this.height = height;
    this.segmentsX = segmentsX;
    this.segmentsY = segmentsY;
    
    this.initializeParticles();
    this.initializeConstraints();
  }
  
  private initializeParticles(): void {
    const spacingX = this.width / this.segmentsX;
    const spacingY = this.height / this.segmentsY;
    
    for (let y = 0; y <= this.segmentsY; y++) {
      for (let x = 0; x <= this.segmentsX; x++) {
        const position = new THREE.Vector3(
          (x - this.segmentsX / 2) * spacingX,
          -y * spacingY,
          0
        );
        
        this.particles.push({
          position: position.clone(),
          previousPosition: position.clone(),
          acceleration: new THREE.Vector3(),
          mass: 1,
          pinned: y === 0
        });
        
        // Store rest position for recovery
        this.restPositions.push(position.clone());
      }
    }
  }
  
  // Reset sail to rest position - call when physics gets stuck
  public resetToRest(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].position.copy(this.restPositions[i]);
      this.particles[i].previousPosition.copy(this.restPositions[i]);
      this.particles[i].acceleration.set(0, 0, 0);
    }
    this.stuckFrameCount = 0;
  }
  
  // Check if cloth is in invalid/stuck state
  public checkStability(): boolean {
    let maxDistance = 0;
    const expectedSpacing = this.width / this.segmentsX;
    
    for (const constraint of this.constraints) {
      const p1 = this.particles[constraint.p1];
      const p2 = this.particles[constraint.p2];
      const dist = p1.position.distanceTo(p2.position);
      const stretch = dist / constraint.restLength;
      
      if (stretch > maxDistance) {
        maxDistance = stretch;
      }
      
      // Check for NaN or Infinity
      if (!isFinite(p1.position.x) || !isFinite(p1.position.y) || !isFinite(p1.position.z)) {
        return false;
      }
    }
    
    // If any constraint is stretched beyond max, cloth is unstable
    return maxDistance < this.maxStretch;
  }
  
  private initializeConstraints(): void {
    const cols = this.segmentsX + 1;
    
    for (let y = 0; y <= this.segmentsY; y++) {
      for (let x = 0; x <= this.segmentsX; x++) {
        const index = y * cols + x;
        
        if (x < this.segmentsX) {
          this.addConstraint(index, index + 1, 1.0);
        }
        
        if (y < this.segmentsY) {
          this.addConstraint(index, index + cols, 1.0);
        }
        
        if (x < this.segmentsX && y < this.segmentsY) {
          this.addConstraint(index, index + cols + 1, 0.5);
          this.addConstraint(index + 1, index + cols, 0.5);
        }
        
        if (x < this.segmentsX - 1) {
          this.addConstraint(index, index + 2, 0.3);
        }
        if (y < this.segmentsY - 1) {
          this.addConstraint(index, index + cols * 2, 0.3);
        }
      }
    }
  }
  
  private addConstraint(p1: number, p2: number, stiffness: number): void {
    const restLength = this.particles[p1].position.distanceTo(
      this.particles[p2].position
    );
    
    this.constraints.push({
      p1,
      p2,
      restLength,
      stiffness
    });
  }
  
  public applyWind(wind: WindForce): void {
    const windDir = wind.direction.clone().normalize();
    const time = Date.now() * 0.001;
    
    const cols = this.segmentsX + 1;
    
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].pinned) continue;
      
      const xIdx = i % cols;
      const yIdx = Math.floor(i / cols);
      
      // Leech factor: trailing edge (high xIdx) moves more freely
      const leechFactor = xIdx / this.segmentsX;
      // Height factor: bottom of sail has more natural belly
      const heightFactor = yIdx / this.segmentsY;
      
      // Multi-octave turbulence for organic cloth behaviour
      const t = time;
      const wave1 = Math.sin(t * 2.8 + xIdx * 0.35 + yIdx * 0.22);
      const wave2 = Math.sin(t * 5.1 + xIdx * 0.62 - yIdx * 0.41) * 0.5;
      const wave3 = Math.sin(t * 9.3 - xIdx * 0.91 + yIdx * 0.73) * 0.25;
      const turbNoise = (wave1 + wave2 + wave3) * wind.turbulence;

      // Leech flutter: trailing edge flaps more
      const leechFlutter = leechFactor * leechFactor * Math.sin(t * 7.0 + yIdx * 0.8) * wind.turbulence * 0.6;

      const turbX = turbNoise * leechFactor * 0.8 + leechFlutter;
      const turbY = Math.sin(t * 1.9 + xIdx * 0.2) * wind.turbulence * 0.2 * leechFactor;
      const turbZ = Math.cos(t * 3.4 + yIdx * 0.3) * wind.turbulence * leechFactor;
      
      // Wind force increases toward leech and belly (natural aerodynamic pressure)
      const pressureMultiplier = 0.4 + leechFactor * 0.8 + heightFactor * 0.3;
      
      const force = windDir.clone()
        .multiplyScalar(wind.strength * pressureMultiplier)
        .add(new THREE.Vector3(turbX, turbY, turbZ));
      
      this.particles[i].acceleration.add(
        force.divideScalar(this.particles[i].mass)
      );
    }
  }
  
  public update(deltaTime: number): void {
    // Auto-recovery: check stability and reset if needed
    if (!this.checkStability()) {
      this.stuckFrameCount++;
      if (this.stuckFrameCount > 5) {
        console.log('Cloth physics unstable, resetting to rest position');
        this.resetToRest();
        return;
      }
    } else {
      this.stuckFrameCount = 0;
    }
    
    // Tight dt clamp = no exploding cloth on hitches/tab-switches.
    // Cap at 1/60 so a 200ms frame still only advances 16ms of sim.
    const dt = Math.min(deltaTime, 1 / 60);
    const subSteps = 4;
    const subDt = dt / subSteps;
    
    for (let step = 0; step < subSteps; step++) {
      for (const particle of this.particles) {
        if (particle.pinned) continue;
        
        particle.acceleration.add(this.gravity);
      }
      
      for (const particle of this.particles) {
        if (particle.pinned) continue;
        
        const velocity = particle.position.clone()
          .sub(particle.previousPosition)
          .multiplyScalar(this.damping);
        
        // Clamp velocity to prevent explosive forces
        const maxVel = 2.0;
        if (velocity.length() > maxVel) {
          velocity.normalize().multiplyScalar(maxVel);
        }
        
        const newPosition = particle.position.clone()
          .add(velocity)
          .add(particle.acceleration.clone().multiplyScalar(subDt * subDt));
        
        particle.previousPosition.copy(particle.position);
        particle.position.copy(newPosition);
        particle.acceleration.set(0, 0, 0);
      }
      
      // More constraint iterations for stiffer cloth
      for (let i = 0; i < 8; i++) {
        this.satisfyConstraints();
      }
    }
  }
  
  private satisfyConstraints(): void {
    for (const constraint of this.constraints) {
      const p1 = this.particles[constraint.p1];
      const p2 = this.particles[constraint.p2];
      
      const diff = p2.position.clone().sub(p1.position);
      const currentLength = diff.length();
      
      if (currentLength === 0) continue;
      
      const correction = diff.multiplyScalar(
        (currentLength - constraint.restLength) / currentLength * constraint.stiffness
      );
      
      if (!p1.pinned && !p2.pinned) {
        p1.position.add(correction.clone().multiplyScalar(0.5));
        p2.position.sub(correction.clone().multiplyScalar(0.5));
      } else if (!p1.pinned) {
        p1.position.add(correction);
      } else if (!p2.pinned) {
        p2.position.sub(correction);
      }
    }
  }
  
  public getPositions(): Float32Array {
    const positions = new Float32Array(this.particles.length * 3);
    
    for (let i = 0; i < this.particles.length; i++) {
      positions[i * 3] = this.particles[i].position.x;
      positions[i * 3 + 1] = this.particles[i].position.y;
      positions[i * 3 + 2] = this.particles[i].position.z;
    }
    
    return positions;
  }
  
  public getParticleCount(): number {
    return this.particles.length;
  }
  
  public getSegments(): { x: number; y: number } {
    return { x: this.segmentsX, y: this.segmentsY };
  }
  
  public pinParticle(index: number, pinned: boolean = true): void {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].pinned = pinned;
    }
  }
  
  public setParticlePosition(index: number, position: THREE.Vector3): void {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].position.copy(position);
      this.particles[index].previousPosition.copy(position);
    }
  }
  
  public reset(): void {
    const spacingX = this.width / this.segmentsX;
    const spacingY = this.height / this.segmentsY;
    const cols = this.segmentsX + 1;
    
    for (let i = 0; i < this.particles.length; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      
      const position = new THREE.Vector3(
        (x - this.segmentsX / 2) * spacingX,
        -y * spacingY,
        0
      );
      
      this.particles[i].position.copy(position);
      this.particles[i].previousPosition.copy(position);
      this.particles[i].acceleration.set(0, 0, 0);
    }
  }
  
  public pinEdge(edge: 'top' | 'bottom' | 'left' | 'right', pinned: boolean = true): void {
    const cols = this.segmentsX + 1;
    const rows = this.segmentsY + 1;
    
    for (let i = 0; i < this.particles.length; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      
      let shouldPin = false;
      switch (edge) {
        case 'top':
          shouldPin = (y === 0);
          break;
        case 'bottom':
          shouldPin = (y === this.segmentsY);
          break;
        case 'left':
          shouldPin = (x === 0);
          break;
        case 'right':
          shouldPin = (x === this.segmentsX);
          break;
      }
      
      if (shouldPin) {
        this.particles[i].pinned = pinned;
      }
    }
  }
  
  public pinForGaffRig(): void {
    // Gaff rig: pin mast side (left edge), top (gaff), and bottom (boom)
    // This keeps the sail attached to the wooden bars while allowing the middle to billow
    this.pinEdge('left', true);   // Attached to mast
    this.pinEdge('top', true);    // Attached to gaff (top bar)
    this.pinEdge('bottom', true); // Attached to boom (bottom bar)
    // Right edge (trailing edge) is FREE to flow in wind
  }
  
  public pinForSquareRig(): void {
    this.pinEdge('top', true);
    this.pinEdge('bottom', true);
  }
  
  public unpinAll(): void {
    for (const particle of this.particles) {
      particle.pinned = false;
    }
  }
  
  public setGaffRigPositions(gaffY: number, boomY: number): void {
    const cols = this.segmentsX + 1;
    const spacingX = this.width / this.segmentsX;
    
    for (let i = 0; i < this.particles.length; i++) {
      const xIdx = i % cols;
      const yIdx = Math.floor(i / cols);
      
      // Interpolate Y from gaff (top row) to boom (bottom row)
      const t = yIdx / this.segmentsY;
      const particleY = gaffY * (1 - t) + boomY * t;
      
      // Local X becomes world Z after mesh rotation.y = PI/2
      // Sail extends from mast (X=0) outward to sail width (negative X for correct direction after rotation)
      const particleX = -xIdx * spacingX; // Negative so after PI/2 rotation it extends along +Z
      
      const particle = this.particles[i];
      particle.position.set(particleX, particleY, 0);
      particle.previousPosition.copy(particle.position);
    }
  }
  
  public updateBoomPosition(boomY: number): void {
    const cols = this.segmentsX + 1;
    
    const firstTopParticle = this.particles[0];
    const gaffY = firstTopParticle.position.y;
    
    for (let i = 0; i < this.particles.length; i++) {
      const yIdx = Math.floor(i / cols);
      
      if (this.particles[i].pinned) {
        const t = yIdx / this.segmentsY;
        const particleY = gaffY * (1 - t) + boomY * t;
        
        this.particles[i].position.y = particleY;
        this.particles[i].previousPosition.y = particleY;
      }
    }
  }
  
  public getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}

export function createClothGeometry(cloth: ClothSimulation): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const segments = cloth.getSegments();
  
  const indices: number[] = [];
  const cols = segments.x + 1;
  
  for (let y = 0; y < segments.y; y++) {
    for (let x = 0; x < segments.x; x++) {
      const a = y * cols + x;
      const b = y * cols + x + 1;
      const c = (y + 1) * cols + x;
      const d = (y + 1) * cols + x + 1;
      
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  geometry.setIndex(indices);
  
  const positions = cloth.getPositions();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const uvs = new Float32Array(cloth.getParticleCount() * 2);
  for (let y = 0; y <= segments.y; y++) {
    for (let x = 0; x <= segments.x; x++) {
      const i = y * cols + x;
      uvs[i * 2] = x / segments.x;
      uvs[i * 2 + 1] = 1 - y / segments.y;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  
  geometry.computeVertexNormals();
  
  return geometry;
}

export function updateClothGeometry(geometry: THREE.BufferGeometry, cloth: ClothSimulation): void {
  const positions = cloth.getPositions();
  const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
  
  for (let i = 0; i < positions.length; i++) {
    positionAttribute.array[i] = positions[i];
  }
  
  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
}
