/**
 * arenaCombat — lightweight, self-contained combat targets for the Player Arena.
 *
 * Lesson borrowed from the "annihilate" action-game prototype: the controller is
 * only fun when there's something to fight. This module spawns reactive training
 * dummies that:
 *   • take directional damage from the player's attack hit-window,
 *   • stagger + get knocked back on hit (with a brief emissive flash),
 *   • topple, fade out and respawn when destroyed,
 *   • show a billboarded HP bar that always faces the camera.
 *
 * It also provides nearest-target lookup for lock-on and a small hit-spark
 * particle burst for impact feedback. No external AI/physics deps — pure Three.js
 * so it disposes cleanly alongside the page's WebGL context.
 */
import * as THREE from 'three';

export interface DummyHitResult {
  dummy: TrainingDummy;
  point: THREE.Vector3;
  killed: boolean;
}

const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();

class TrainingDummy {
  readonly group = new THREE.Group();
  readonly hitTarget: THREE.Object3D; // torso — the lock-on / facing anchor
  maxHp = 100;
  hp = 100;
  alive = true;

  private home = new THREE.Vector3();
  private baseColor: THREE.Color;
  private knockback = new THREE.Vector3();
  private stagger = 0;
  private flash = 0;
  private deadTimer = 0;
  private respawnTimer = 0;
  private toppleAngle = 0;
  private materials: THREE.MeshStandardMaterial[] = [];
  private hpBarGroup = new THREE.Group();
  private hpFill: THREE.Mesh;
  private hpFillMat: THREE.MeshBasicMaterial;
  private bodyParts: THREE.Mesh[] = [];

  constructor(pos: THREE.Vector3, color: number) {
    this.home.copy(pos);
    this.group.position.copy(pos);
    this.baseColor = new THREE.Color(color);

    const mk = (geo: THREE.BufferGeometry, y: number, c: number, scaleHit = true) => {
      const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.15 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.materials.push(mat);
      if (scaleHit) this.bodyParts.push(mesh);
      return mesh;
    };

    // Stylized humanoid dummy (boxes + capsule torso).
    mk(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 12), 0.15, 0x3a3326, false); // base
    mk(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8), 0.85, 0x5a4a32, false);  // post
    const torso = mk(new THREE.CapsuleGeometry(0.42, 0.55, 6, 12), 1.65, color); // torso
    mk(new THREE.SphereGeometry(0.26, 14, 12), 2.35, color);                     // head
    mk(new THREE.BoxGeometry(0.9, 0.18, 0.18), 1.85, 0x6b5a3e, false);          // crossbar (arms)
    this.hitTarget = torso;

    // HP bar (two flat planes — bg + fill — billboarded each frame).
    const barW = 1.1, barH = 0.13;
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, depthTest: false });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(barW + 0.06, barH + 0.06), bgMat);
    bg.renderOrder = 998;
    this.hpFillMat = new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, depthTest: false });
    this.hpFill = new THREE.Mesh(new THREE.PlaneGeometry(barW, barH), this.hpFillMat);
    this.hpFill.renderOrder = 999;
    this.hpFill.position.z = 0.001;
    this.hpBarGroup.add(bg, this.hpFill);
    this.hpBarGroup.position.y = 2.9;
    this.group.add(this.hpBarGroup);
  }

  /** Apply damage from a world-space direction. Returns true if this hit killed it. */
  damage(amount: number, fromDir: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.knockback.addScaledVector(fromDir, 4.5);
    this.stagger = 0.28;
    this.flash = 1;
    if (this.hp <= 0) {
      this.alive = false;
      this.group.userData.dead = true;
      this.hitTarget.userData.dead = true; // lock-on points at hitTarget
      this.deadTimer = 2.4;
      return true;
    }
    return false;
  }

  update(dt: number, camera: THREE.Camera): void {
    // Knockback decay + positional clamp around home.
    if (this.knockback.lengthSq() > 0.0001) {
      this.group.position.addScaledVector(this.knockback, dt);
      this.knockback.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
    // Spring back toward home (anchored to its post).
    if (this.alive) {
      TMP_A.copy(this.home).sub(this.group.position);
      TMP_A.y = 0;
      this.group.position.addScaledVector(TMP_A, Math.min(1, dt * 3));
    }

    // Stagger lean (lean back from impact).
    if (this.stagger > 0) this.stagger = Math.max(0, this.stagger - dt);
    const leanTarget = this.alive ? -this.stagger * 0.6 : 0;
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, leanTarget, Math.min(1, dt * 10));

    // Flash decay (emissive pop on hit).
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      const e = this.flash;
      for (const m of this.materials) m.emissive.setRGB(e, e * 0.2, e * 0.15);
    }

    // Death: topple over, sink, fade, then respawn.
    if (!this.alive) {
      this.deadTimer -= dt;
      this.toppleAngle = THREE.MathUtils.lerp(this.toppleAngle, Math.PI / 2, Math.min(1, dt * 4));
      this.group.rotation.x = this.toppleAngle;
      const fade = THREE.MathUtils.clamp(this.deadTimer / 2.4, 0, 1);
      for (const m of this.materials) { m.transparent = true; m.opacity = fade; }
      this.hpBarGroup.visible = false;
      if (this.deadTimer <= 0 && this.respawnTimer <= 0) this.respawnTimer = 1.6;
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this._respawn();
      }
      return;
    }

    // HP bar: billboard toward camera + update fill width/color.
    this.hpBarGroup.quaternion.copy(camera.quaternion);
    const frac = this.hp / this.maxHp;
    this.hpFill.scale.x = Math.max(0.001, frac);
    this.hpFill.position.x = -(1 - frac) * 0.55; // keep left-anchored
    this.hpFillMat.color.setHSL(0.33 * frac, 0.7, 0.5);
    this.hpBarGroup.visible = frac < 0.999;
  }

  private _respawn(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.group.userData.dead = false;
    this.hitTarget.userData.dead = false;
    this.toppleAngle = 0;
    this.group.rotation.set(0, 0, 0);
    this.group.position.copy(this.home);
    this.knockback.set(0, 0, 0);
    for (const m of this.materials) { m.opacity = 1; m.transparent = false; m.emissive.setRGB(0, 0, 0); }
    this.hpBarGroup.visible = false;
  }

  worldPos(out: THREE.Vector3): THREE.Vector3 {
    return this.hitTarget.getWorldPosition(out);
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ArenaCombat {
  readonly dummies: TrainingDummy[] = [];
  private scene: THREE.Scene;
  private sparks: Spark[] = [];
  private sparkGeo = new THREE.TetrahedronGeometry(0.08);

  constructor(scene: THREE.Scene, count = 5, radius = 9, colors: number[] = [0x3b82f6, 0x22c55e, 0xdc2626]) {
    this.scene = scene;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = radius + (i % 2) * 2.5;
      const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const dummy = new TrainingDummy(pos, colors[i % colors.length]);
      this.dummies.push(dummy);
      scene.add(dummy.group);
    }
  }

  /** All dummy root groups (for camera obstacle registration if desired). */
  get meshes(): THREE.Object3D[] {
    return this.dummies.map((d) => d.group);
  }

  get aliveCount(): number {
    return this.dummies.filter((d) => d.alive).length;
  }

  /**
   * Resolve a melee hit: damage every living dummy inside a forward cone.
   * origin = player feet pos, facingRot = player.rotation (model yaw).
   */
  resolveHit(origin: THREE.Vector3, facingRot: number, reach = 2.6, arcDeg = 110, damage = 34): DummyHitResult[] {
    const fwd = TMP_A.set(-Math.sin(facingRot), 0, -Math.cos(facingRot)).normalize();
    const cosArc = Math.cos((arcDeg * 0.5 * Math.PI) / 180);
    const results: DummyHitResult[] = [];

    for (const d of this.dummies) {
      if (!d.alive) continue;
      const dp = d.worldPos(TMP_B).clone();
      const toD = dp.clone().sub(origin);
      toD.y = 0;
      const dist = toD.length();
      if (dist > reach || dist < 0.001) continue;
      toD.normalize();
      if (toD.dot(fwd) < cosArc) continue; // outside attack arc

      const killed = d.damage(damage, toD);
      const hitPoint = dp.clone();
      hitPoint.y = 1.6;
      this._spawnSparks(hitPoint, killed ? 16 : 8);
      results.push({ dummy: d, point: hitPoint, killed });
    }
    return results;
  }

  /** Nearest living dummy to a point within maxDist (for lock-on). */
  nearest(pos: THREE.Vector3, maxDist = 22): TrainingDummy | null {
    let best: TrainingDummy | null = null;
    let bestD = maxDist * maxDist;
    for (const d of this.dummies) {
      if (!d.alive) continue;
      const dd = d.worldPos(TMP_B).distanceToSquared(pos);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  private _spawnSparks(at: THREE.Vector3, n: number): void {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd27f, transparent: true });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(at);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 1,
        (Math.random() - 0.5) * 6,
      );
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel, life: 0.5, maxLife: 0.5 });
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    for (const d of this.dummies) d.update(dt, camera);

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      s.vel.y -= 18 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt * 8;
      s.mesh.rotation.y += dt * 6;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = s.life / s.maxLife;
    }
  }

  dispose(): void {
    for (const d of this.dummies) { this.scene.remove(d.group); d.dispose(); }
    this.dummies.length = 0;
    for (const s of this.sparks) { this.scene.remove(s.mesh); (s.mesh.material as THREE.Material).dispose(); }
    this.sparks.length = 0;
    this.sparkGeo.dispose();
  }
}

export type { TrainingDummy };
