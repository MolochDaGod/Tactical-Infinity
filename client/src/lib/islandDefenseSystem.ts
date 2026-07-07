import * as THREE from 'three';
import type { CannonSkillId } from '@shared/gameDefinitions/sailing';
import { CANNON_SKILLS } from '@shared/gameDefinitions/sailing';

export type DefenseTurretType = 'shore_cannon' | 'watchtower_bow' | 'fire_catapult';

export interface DefenseTurretConfig {
  type: DefenseTurretType;
  range: number;
  fireRate: number;
  damage: number;
  projectileSpeed: number;
  projectileGravity: number;
  projectileColor: number;
  projectileScale: number;
  ammoType: CannonSkillId;
  leadTarget: boolean;
  elevation: { min: number; max: number };
  rotationSpeed: number;
  warmupTime: number;
  burstCount: number;
  burstDelay: number;
}

const DEFENSE_TURRET_CONFIGS: Record<DefenseTurretType, DefenseTurretConfig> = {
  shore_cannon: {
    type: 'shore_cannon',
    range: 120,
    fireRate: 0.2,
    damage: 30,
    projectileSpeed: 55,
    projectileGravity: 12,
    projectileColor: 0x333333,
    projectileScale: 0.6,
    ammoType: 'heavy_ball',
    leadTarget: true,
    elevation: { min: 5, max: 45 },
    rotationSpeed: 25,
    warmupTime: 0.8,
    burstCount: 1,
    burstDelay: 0,
  },
  watchtower_bow: {
    type: 'watchtower_bow',
    range: 80,
    fireRate: 1.0,
    damage: 8,
    projectileSpeed: 45,
    projectileGravity: 9,
    projectileColor: 0x8B4513,
    projectileScale: 0.25,
    ammoType: 'grapeshot',
    leadTarget: true,
    elevation: { min: -10, max: 55 },
    rotationSpeed: 90,
    warmupTime: 0.3,
    burstCount: 3,
    burstDelay: 0.15,
  },
  fire_catapult: {
    type: 'fire_catapult',
    range: 100,
    fireRate: 0.12,
    damage: 18,
    projectileSpeed: 35,
    projectileGravity: 6,
    projectileColor: 0xff6600,
    projectileScale: 0.8,
    ammoType: 'fire_bomb',
    leadTarget: true,
    elevation: { min: 30, max: 70 },
    rotationSpeed: 15,
    warmupTime: 1.5,
    burstCount: 1,
    burstDelay: 0,
  },
};

interface ActiveDefenseProjectile {
  id: string;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  damage: number;
  ammoType: CannonSkillId;
  trail: THREE.Mesh[];
  owner: string;
}

interface DefenseTurret {
  id: string;
  config: DefenseTurretConfig;
  group: THREE.Group;
  barrel: THREE.Mesh;
  base: THREE.Mesh;
  position: THREE.Vector3;
  currentTarget: THREE.Vector3 | null;
  currentAzimuth: number;
  currentElevation: number;
  cooldownTimer: number;
  warmupTimer: number;
  state: 'idle' | 'acquiring' | 'tracking' | 'firing' | 'cooldown';
  burstRemaining: number;
  burstTimer: number;
  islandId: string;
}

export interface IslandDefenseSystem {
  turrets: DefenseTurret[];
  projectiles: ActiveDefenseProjectile[];
  update: (delta: number, targetPositions: { id: string; position: THREE.Vector3; velocity: THREE.Vector3 }[]) => DefenseHitResult[];
  dispose: () => void;
  setHostile: (hostile: boolean) => void;
  isHostile: boolean;
}

export interface DefenseHitResult {
  targetId: string;
  damage: number;
  ammoType: CannonSkillId;
  position: THREE.Vector3;
  effects?: { type: 'burn' | 'slow' | 'stun'; duration: number; value: number }[];
}

const _tmpVec = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _leadPos = new THREE.Vector3();

function buildTurretMesh(type: DefenseTurretType): { group: THREE.Group; barrel: THREE.Mesh; base: THREE.Mesh } {
  const group = new THREE.Group();

  if (type === 'shore_cannon') {
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 1.0, 8), baseMat);
    base.castShadow = true;
    group.add(base);

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.3, 8), baseMat);
    platform.position.y = 0.65;
    group.add(platform);

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.3, metalness: 0.7 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8), barrelMat);
    barrel.rotation.x = -Math.PI / 6;
    barrel.position.set(0, 1.0, 0.8);
    barrel.castShadow = true;
    group.add(barrel);

    const wheel1 = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 6, 12), baseMat);
    wheel1.position.set(-0.9, 0.4, 0);
    wheel1.rotation.y = Math.PI / 2;
    group.add(wheel1);

    const wheel2 = wheel1.clone();
    wheel2.position.set(0.9, 0.4, 0);
    group.add(wheel2);

    return { group, barrel, base };
  }

  if (type === 'watchtower_bow') {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8, metalness: 0.1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), woodMat);
    base.position.y = 3;
    base.castShadow = true;
    group.add(base);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.5, 4), roofMat);
    roof.position.y = 6.75;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    const platformMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.8 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 2.5), platformMat);
    platform.position.y = 5.9;
    group.add(platform);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.7 })
    );
    barrel.rotation.x = -Math.PI / 8;
    barrel.position.set(0, 6.2, 0.8);
    group.add(barrel);

    return { group, barrel, base };
  }

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9, metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), stoneMat);
  base.position.y = 1;
  base.castShadow = true;
  group.add(base);

  const armMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.7 });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), armMat);
  arm.position.set(0, 3.5, 0);
  arm.rotation.z = Math.PI / 12;
  group.add(arm);

  const bucket = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 })
  );
  bucket.position.set(0.5, 5.5, 0);
  group.add(bucket);

  const barrel = arm;

  return { group, barrel: barrel as THREE.Mesh, base };
}

function computeLeadPosition(
  turretPos: THREE.Vector3,
  targetPos: THREE.Vector3,
  targetVel: THREE.Vector3,
  projectileSpeed: number
): THREE.Vector3 {
  const dist = turretPos.distanceTo(targetPos);
  const tof = dist / projectileSpeed;
  _leadPos.copy(targetPos).add(_tmpVec.copy(targetVel).multiplyScalar(tof * 0.8));
  return _leadPos;
}

function computeBallisticVelocity(
  from: THREE.Vector3,
  to: THREE.Vector3,
  speed: number,
  gravity: number
): THREE.Vector3 {
  _tmpDir.copy(to).sub(from);
  const dx = Math.sqrt(_tmpDir.x * _tmpDir.x + _tmpDir.z * _tmpDir.z);
  const dy = _tmpDir.y;

  const angle = Math.atan2(dy, dx) * 0.5 + Math.PI / 6;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const horizontal = _tmpDir.clone();
  horizontal.y = 0;
  horizontal.normalize().multiplyScalar(speed * cosA);

  return new THREE.Vector3(horizontal.x, speed * sinA, horizontal.z);
}

export function createIslandDefenses(
  scene: THREE.Scene,
  islandPosition: THREE.Vector3,
  islandRadius: number,
  difficulty: number = 1,
  islandId: string = 'island'
): IslandDefenseSystem {
  const turrets: DefenseTurret[] = [];
  const projectiles: ActiveDefenseProjectile[] = [];
  let hostile = true;
  let projIdCounter = 0;

  const turretCount = Math.min(2 + Math.floor(difficulty * 1.5), 8);

  const turretDistribution: DefenseTurretType[] = [];
  for (let i = 0; i < turretCount; i++) {
    if (i === 0) turretDistribution.push('shore_cannon');
    else if (i === 1 && difficulty >= 2) turretDistribution.push('fire_catapult');
    else if (i % 3 === 0) turretDistribution.push('shore_cannon');
    else if (i % 3 === 1) turretDistribution.push('watchtower_bow');
    else turretDistribution.push('shore_cannon');
  }

  turretDistribution.forEach((type, index) => {
    const angle = (index / turretCount) * Math.PI * 2 + Math.random() * 0.3;
    const dist = islandRadius * (0.85 + Math.random() * 0.15);
    const x = islandPosition.x + Math.cos(angle) * dist;
    const z = islandPosition.z + Math.sin(angle) * dist;
    const y = islandPosition.y + 2 + Math.random() * 3;

    const config = DEFENSE_TURRET_CONFIGS[type];
    const { group, barrel, base } = buildTurretMesh(type);
    group.position.set(x, y, z);
    group.rotation.y = -angle + Math.PI;
    scene.add(group);

    turrets.push({
      id: `${islandId}_turret_${index}`,
      config,
      group,
      barrel,
      base,
      position: new THREE.Vector3(x, y, z),
      currentTarget: null,
      currentAzimuth: 0,
      currentElevation: 0,
      cooldownTimer: Math.random() * 2,
      warmupTimer: 0,
      state: 'idle',
      burstRemaining: 0,
      burstTimer: 0,
      islandId,
    });
  });

  function createProjectile(turret: DefenseTurret, targetPos: THREE.Vector3): ActiveDefenseProjectile {
    const config = turret.config;
    const projId = `${turret.id}_proj_${projIdCounter++}`;

    const muzzlePos = new THREE.Vector3();
    turret.barrel.getWorldPosition(muzzlePos);

    const velocity = computeBallisticVelocity(muzzlePos, targetPos, config.projectileSpeed, config.projectileGravity);

    const geo = config.type === 'fire_catapult'
      ? new THREE.SphereGeometry(config.projectileScale, 8, 8)
      : new THREE.SphereGeometry(config.projectileScale * 0.5, 6, 6);

    const mat = new THREE.MeshBasicMaterial({
      color: config.projectileColor,
      emissive: config.type === 'fire_catapult' ? new THREE.Color(0xff4400) : undefined,
    } as any);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(muzzlePos);
    mesh.castShadow = true;
    scene.add(mesh);

    const ammoSkill = CANNON_SKILLS[config.ammoType];

    return {
      id: projId,
      mesh,
      velocity,
      age: 0,
      maxAge: ammoSkill?.ttl || 4.0,
      damage: config.damage,
      ammoType: config.ammoType,
      trail: [],
      owner: turret.islandId,
    };
  }

  function spawnMuzzleFlash(turret: DefenseTurret) {
    const muzzlePos = new THREE.Vector3();
    turret.barrel.getWorldPosition(muzzlePos);

    const flashGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(muzzlePos);
    scene.add(flash);

    let life = 0.15;
    const flashUpdate = () => {
      life -= 0.016;
      if (life <= 0) {
        scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
        return;
      }
      flashMat.opacity = life / 0.15;
      flash.scale.setScalar(1 + (1 - life / 0.15) * 2);
      requestAnimationFrame(flashUpdate);
    };
    requestAnimationFrame(flashUpdate);

    for (let i = 0; i < 4; i++) {
      const smokeGeo = new THREE.SphereGeometry(0.3, 4, 4);
      const smokeMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.copy(muzzlePos);
      scene.add(smoke);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 3
      );
      let smokeLife = 0.5 + Math.random() * 0.3;
      const maxSmokeLife = smokeLife;
      const smokeUpdate = () => {
        smokeLife -= 0.016;
        if (smokeLife <= 0) {
          scene.remove(smoke);
          smokeGeo.dispose();
          smokeMat.dispose();
          return;
        }
        smoke.position.add(vel.clone().multiplyScalar(0.016));
        vel.y -= 0.5 * 0.016;
        smokeMat.opacity = (smokeLife / maxSmokeLife) * 0.5;
        smoke.scale.setScalar(1 + (1 - smokeLife / maxSmokeLife) * 1.5);
        requestAnimationFrame(smokeUpdate);
      };
      requestAnimationFrame(smokeUpdate);
    }
  }

  function updateTurret(
    turret: DefenseTurret,
    delta: number,
    targets: { id: string; position: THREE.Vector3; velocity: THREE.Vector3 }[]
  ) {
    if (!hostile) {
      turret.state = 'idle';
      return;
    }

    let nearestTarget: typeof targets[0] | null = null;
    let nearestDist = Infinity;

    for (const target of targets) {
      const dist = turret.position.distanceTo(target.position);
      if (dist <= turret.config.range && dist < nearestDist) {
        nearestDist = dist;
        nearestTarget = target;
      }
    }

    switch (turret.state) {
      case 'idle':
        if (nearestTarget) {
          turret.currentTarget = nearestTarget.position.clone();
          turret.state = 'acquiring';
          turret.warmupTimer = turret.config.warmupTime;
        }
        break;

      case 'acquiring':
        if (!nearestTarget) { turret.state = 'idle'; break; }
        turret.warmupTimer -= delta;

        const targetAngle = Math.atan2(
          nearestTarget.position.x - turret.position.x,
          nearestTarget.position.z - turret.position.z
        );
        const angleDiff = ((targetAngle - turret.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const rotStep = turret.config.rotationSpeed * (Math.PI / 180) * delta;
        turret.group.rotation.y += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), rotStep);

        if (turret.warmupTimer <= 0 && Math.abs(angleDiff) < 0.15) {
          turret.state = 'firing';
          turret.burstRemaining = turret.config.burstCount;
          turret.burstTimer = 0;
        }
        break;

      case 'firing':
        if (!nearestTarget) { turret.state = 'idle'; break; }

        turret.burstTimer -= delta;
        if (turret.burstTimer <= 0 && turret.burstRemaining > 0) {
          const aimPos = turret.config.leadTarget
            ? computeLeadPosition(turret.position, nearestTarget.position, nearestTarget.velocity, turret.config.projectileSpeed)
            : nearestTarget.position;

          const proj = createProjectile(turret, aimPos);
          projectiles.push(proj);
          spawnMuzzleFlash(turret);

          turret.burstRemaining--;
          turret.burstTimer = turret.config.burstDelay;
        }

        if (turret.burstRemaining <= 0) {
          turret.state = 'cooldown';
          turret.cooldownTimer = 1 / turret.config.fireRate;
        }
        break;

      case 'cooldown':
        turret.cooldownTimer -= delta;
        if (turret.cooldownTimer <= 0) {
          turret.state = nearestTarget ? 'acquiring' : 'idle';
          turret.warmupTimer = turret.config.warmupTime * 0.5;
        }

        if (nearestTarget) {
          const ta2 = Math.atan2(
            nearestTarget.position.x - turret.position.x,
            nearestTarget.position.z - turret.position.z
          );
          const ad2 = ((ta2 - turret.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const rs2 = turret.config.rotationSpeed * (Math.PI / 180) * delta;
          turret.group.rotation.y += Math.sign(ad2) * Math.min(Math.abs(ad2), rs2);
        }
        break;
    }
  }

  function updateProjectiles(
    delta: number,
    targets: { id: string; position: THREE.Vector3; velocity: THREE.Vector3 }[]
  ): DefenseHitResult[] {
    const hits: DefenseHitResult[] = [];

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.age += delta;

      proj.velocity.y -= DEFENSE_TURRET_CONFIGS[
        turrets.find(t => proj.owner === t.islandId)?.config.type || 'shore_cannon'
      ].projectileGravity * delta;

      proj.mesh.position.add(_tmpVec.copy(proj.velocity).multiplyScalar(delta));

      if (proj.ammoType === 'fire_bomb') {
        if (proj.trail.length < 6 && Math.random() > 0.5) {
          const trailGeo = new THREE.SphereGeometry(0.15, 4, 4);
          const trailMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 });
          const trailMesh = new THREE.Mesh(trailGeo, trailMat);
          trailMesh.position.copy(proj.mesh.position);
          scene.add(trailMesh);
          proj.trail.push(trailMesh);
        }
      }

      for (let t = proj.trail.length - 1; t >= 0; t--) {
        const trail = proj.trail[t];
        const mat = trail.material as THREE.MeshBasicMaterial;
        mat.opacity -= delta * 1.5;
        trail.scale.multiplyScalar(0.96);
        if (mat.opacity <= 0) {
          scene.remove(trail);
          trail.geometry.dispose();
          mat.dispose();
          proj.trail.splice(t, 1);
        }
      }

      let shouldRemove = false;

      if (proj.mesh.position.y < 0 || proj.age > proj.maxAge) {
        shouldRemove = true;
      }

      for (const target of targets) {
        const dist = proj.mesh.position.distanceTo(target.position);
        if (dist < 6) {
          const ammoSkill = CANNON_SKILLS[proj.ammoType];
          hits.push({
            targetId: target.id,
            damage: proj.damage,
            ammoType: proj.ammoType,
            position: proj.mesh.position.clone(),
            effects: ammoSkill?.effects,
          });
          shouldRemove = true;
          break;
        }
      }

      if (shouldRemove) {
        scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        (proj.mesh.material as THREE.Material).dispose();
        proj.trail.forEach(t => {
          scene.remove(t);
          t.geometry.dispose();
          (t.material as THREE.Material).dispose();
        });
        projectiles.splice(i, 1);
      }
    }

    return hits;
  }

  return {
    turrets,
    projectiles,

    update(delta, targets) {
      for (const turret of turrets) {
        updateTurret(turret, delta, targets);
      }
      return updateProjectiles(delta, targets);
    },

    dispose() {
      for (const turret of turrets) {
        scene.remove(turret.group);
        turret.group.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
      }
      turrets.length = 0;

      for (const proj of projectiles) {
        scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        (proj.mesh.material as THREE.Material).dispose();
        proj.trail.forEach(t => {
          scene.remove(t);
          t.geometry.dispose();
          (t.material as THREE.Material).dispose();
        });
      }
      projectiles.length = 0;
    },

    setHostile(h: boolean) { hostile = h; },
    get isHostile() { return hostile; },
  };
}
