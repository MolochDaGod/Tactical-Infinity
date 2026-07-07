import * as THREE from 'three';

export interface BodyPartConfig {
  boneNamePatterns: string[];
  meshNamePatterns: string[];
  fallbackPosition?: THREE.Vector3;
}

export interface CharacterBodyParts {
  head: THREE.Object3D | null;
  chest: THREE.Object3D | null;
  leftHand: THREE.Object3D | null;
  rightHand: THREE.Object3D | null;
  leftFoot: THREE.Object3D | null;
  rightFoot: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  hips: THREE.Object3D | null;
}

export interface BodyPartHitbox {
  part: keyof CharacterBodyParts;
  collider: THREE.Box3 | THREE.Sphere;
  damageMultiplier: number;
}

export interface GroundContact {
  isGrounded: boolean;
  groundHeight: number;
  groundNormal: THREE.Vector3;
  surfaceType: 'terrain' | 'water' | 'deck' | 'island' | 'none';
  waterDepth: number;
}

export interface WaterContact {
  inWater: boolean;
  waterSurfaceY: number;
  submersionDepth: number;
  submersionRatio: number;
  swimState: 'none' | 'wading' | 'swimming' | 'diving';
}

const BONE_NAME_PATTERNS: Record<keyof CharacterBodyParts, string[]> = {
  head: ['head', 'Head', 'HEAD', 'Bip01_Head', 'mixamorig:Head', 'Armature|Head'],
  chest: ['chest', 'Chest', 'CHEST', 'spine2', 'Spine2', 'Bip01_Spine2', 'mixamorig:Spine2', 'UpperChest'],
  leftHand: ['lefthand', 'LeftHand', 'LEFT_HAND', 'Bip01_L_Hand', 'mixamorig:LeftHand', 'Hand_L', 'hand.L'],
  rightHand: ['righthand', 'RightHand', 'RIGHT_HAND', 'Bip01_R_Hand', 'mixamorig:RightHand', 'Hand_R', 'hand.R'],
  leftFoot: ['leftfoot', 'LeftFoot', 'LEFT_FOOT', 'Bip01_L_Foot', 'mixamorig:LeftFoot', 'Foot_L', 'foot.L', 'LeftToeBase'],
  rightFoot: ['rightfoot', 'RightFoot', 'RIGHT_FOOT', 'Bip01_R_Foot', 'mixamorig:RightFoot', 'Foot_R', 'foot.R', 'RightToeBase'],
  spine: ['spine', 'Spine', 'SPINE', 'Bip01_Spine', 'mixamorig:Spine', 'Spine1'],
  hips: ['hips', 'Hips', 'HIPS', 'pelvis', 'Pelvis', 'Bip01_Pelvis', 'mixamorig:Hips', 'Root'],
};

export function findBodyParts(model: THREE.Object3D): CharacterBodyParts {
  const parts: CharacterBodyParts = {
    head: null,
    chest: null,
    leftHand: null,
    rightHand: null,
    leftFoot: null,
    rightFoot: null,
    spine: null,
    hips: null,
  };

  model.traverse((child) => {
    const name = child.name.toLowerCase();
    
    for (const [partKey, patterns] of Object.entries(BONE_NAME_PATTERNS)) {
      const key = partKey as keyof CharacterBodyParts;
      if (parts[key] !== null) continue;
      
      for (const pattern of patterns) {
        if (name.includes(pattern.toLowerCase())) {
          parts[key] = child;
          child.userData.bodyPart = key;
          break;
        }
      }
    }
  });

  return parts;
}

export function getWorldPosition(part: THREE.Object3D | null, target?: THREE.Vector3): THREE.Vector3 {
  const result = target || new THREE.Vector3();
  if (!part) return result.set(0, 0, 0);
  part.getWorldPosition(result);
  return result;
}

export function createBodyPartHitboxes(
  parts: CharacterBodyParts,
  characterHeight: number = 1.8
): BodyPartHitbox[] {
  const hitboxes: BodyPartHitbox[] = [];
  const headRadius = characterHeight * 0.08;
  const torsoSize = characterHeight * 0.2;
  const limbRadius = characterHeight * 0.04;

  if (parts.head) {
    hitboxes.push({
      part: 'head',
      collider: new THREE.Sphere(new THREE.Vector3(), headRadius),
      damageMultiplier: 2.0,
    });
  }

  if (parts.chest) {
    const min = new THREE.Vector3(-torsoSize * 0.5, -torsoSize * 0.5, -torsoSize * 0.3);
    const max = new THREE.Vector3(torsoSize * 0.5, torsoSize * 0.5, torsoSize * 0.3);
    hitboxes.push({
      part: 'chest',
      collider: new THREE.Box3(min, max),
      damageMultiplier: 1.0,
    });
  }

  const limbParts: (keyof CharacterBodyParts)[] = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'];
  for (const limbKey of limbParts) {
    if (parts[limbKey]) {
      hitboxes.push({
        part: limbKey,
        collider: new THREE.Sphere(new THREE.Vector3(), limbRadius),
        damageMultiplier: 0.5,
      });
    }
  }

  return hitboxes;
}

export function updateHitboxPositions(
  parts: CharacterBodyParts,
  hitboxes: BodyPartHitbox[]
): void {
  const tempPos = new THREE.Vector3();
  
  for (const hitbox of hitboxes) {
    const part = parts[hitbox.part];
    if (!part) continue;
    
    part.getWorldPosition(tempPos);
    
    if (hitbox.collider instanceof THREE.Sphere) {
      hitbox.collider.center.copy(tempPos);
    } else if (hitbox.collider instanceof THREE.Box3) {
      const size = new THREE.Vector3();
      hitbox.collider.getSize(size);
      hitbox.collider.setFromCenterAndSize(tempPos, size);
    }
  }
}

export function checkHitboxCollision(
  hitboxes: BodyPartHitbox[],
  attackPoint: THREE.Vector3,
  attackRadius: number = 0.1
): { hit: boolean; part: keyof CharacterBodyParts | null; damageMultiplier: number } {
  const attackSphere = new THREE.Sphere(attackPoint, attackRadius);
  
  for (const hitbox of hitboxes) {
    let intersects = false;
    
    if (hitbox.collider instanceof THREE.Sphere) {
      intersects = attackSphere.intersectsSphere(hitbox.collider);
    } else if (hitbox.collider instanceof THREE.Box3) {
      intersects = hitbox.collider.intersectsSphere(attackSphere);
    }
    
    if (intersects) {
      return {
        hit: true,
        part: hitbox.part,
        damageMultiplier: hitbox.damageMultiplier,
      };
    }
  }
  
  return { hit: false, part: null, damageMultiplier: 1.0 };
}

export class GroundDetector {
  private raycaster: THREE.Raycaster;
  private rayDirection: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  private rayOrigin: THREE.Vector3 = new THREE.Vector3();
  private maxRayDistance: number;
  private groundLayers: THREE.Object3D[] = [];
  private waterSurfaceY: number = 0;

  constructor(maxRayDistance: number = 10) {
    this.raycaster = new THREE.Raycaster();
    this.maxRayDistance = maxRayDistance;
  }

  setGroundLayers(layers: THREE.Object3D[]): void {
    this.groundLayers = layers;
  }

  addGroundLayer(layer: THREE.Object3D): void {
    if (!this.groundLayers.includes(layer)) {
      this.groundLayers.push(layer);
    }
  }

  removeGroundLayer(layer: THREE.Object3D): void {
    const index = this.groundLayers.indexOf(layer);
    if (index !== -1) {
      this.groundLayers.splice(index, 1);
    }
  }

  setWaterSurfaceY(y: number): void {
    this.waterSurfaceY = y;
  }

  checkGroundFromFeet(
    leftFootPos: THREE.Vector3 | null,
    rightFootPos: THREE.Vector3 | null,
    fallbackPosition: THREE.Vector3,
    groundOffset: number = 0.1
  ): GroundContact {
    const feetPosition = new THREE.Vector3();
    
    if (leftFootPos && rightFootPos) {
      feetPosition.lerpVectors(leftFootPos, rightFootPos, 0.5);
      feetPosition.y = Math.min(leftFootPos.y, rightFootPos.y);
    } else if (leftFootPos) {
      feetPosition.copy(leftFootPos);
    } else if (rightFootPos) {
      feetPosition.copy(rightFootPos);
    } else {
      feetPosition.copy(fallbackPosition);
    }
    
    return this.checkGround(feetPosition, 0, groundOffset);
  }

  checkGround(
    feetPosition: THREE.Vector3,
    characterHeight: number = 1.8,
    groundOffset: number = 0.1
  ): GroundContact {
    this.rayOrigin.copy(feetPosition);
    this.rayOrigin.y += groundOffset;
    
    this.raycaster.set(this.rayOrigin, this.rayDirection);
    this.raycaster.far = this.maxRayDistance;
    
    const result: GroundContact = {
      isGrounded: false,
      groundHeight: 0,
      groundNormal: new THREE.Vector3(0, 1, 0),
      surfaceType: 'none',
      waterDepth: 0,
    };

    if (this.groundLayers.length === 0) {
      return result;
    }

    const intersects = this.raycaster.intersectObjects(this.groundLayers, true);
    
    if (intersects.length > 0) {
      const closest = intersects[0];
      const groundDistance = closest.distance - groundOffset;
      
      result.isGrounded = groundDistance <= groundOffset * 2;
      result.groundHeight = feetPosition.y - groundDistance;
      
      if (closest.face) {
        result.groundNormal.copy(closest.face.normal);
        const worldMatrix = new THREE.Matrix3().getNormalMatrix(closest.object.matrixWorld);
        result.groundNormal.applyMatrix3(worldMatrix).normalize();
      }
      
      const objName = closest.object.name.toLowerCase();
      const userData = closest.object.userData;
      
      if (userData.surfaceType) {
        result.surfaceType = userData.surfaceType;
      } else if (objName.includes('deck') || objName.includes('ship') || objName.includes('boat')) {
        result.surfaceType = 'deck';
      } else if (objName.includes('island')) {
        result.surfaceType = 'island';
      } else if (objName.includes('water') || objName.includes('ocean') || objName.includes('sea')) {
        result.surfaceType = 'water';
      } else {
        result.surfaceType = 'terrain';
      }
    }
    
    if (feetPosition.y < this.waterSurfaceY) {
      result.waterDepth = this.waterSurfaceY - feetPosition.y;
      if (result.surfaceType === 'none') {
        result.surfaceType = 'water';
      }
    }

    return result;
  }
}

export class WaterInteraction {
  private waterSurfaceY: number = 0;
  private wadingThreshold: number = 0.3;
  private swimmingThreshold: number = 1.0;
  private divingThreshold: number = 1.8;

  constructor(waterSurfaceY: number = 0) {
    this.waterSurfaceY = waterSurfaceY;
  }

  setWaterSurface(y: number): void {
    this.waterSurfaceY = y;
  }

  setThresholds(wading: number, swimming: number, diving: number): void {
    this.wadingThreshold = wading;
    this.swimmingThreshold = swimming;
    this.divingThreshold = diving;
  }

  checkWaterContact(
    characterPosition: THREE.Vector3,
    characterHeight: number = 1.8
  ): WaterContact {
    const feetY = characterPosition.y;
    const chestY = characterPosition.y + characterHeight * 0.6;
    const headY = characterPosition.y + characterHeight * 0.9;
    
    const result: WaterContact = {
      inWater: false,
      waterSurfaceY: this.waterSurfaceY,
      submersionDepth: 0,
      submersionRatio: 0,
      swimState: 'none',
    };

    if (feetY >= this.waterSurfaceY) {
      return result;
    }

    result.inWater = true;
    result.submersionDepth = this.waterSurfaceY - feetY;
    result.submersionRatio = Math.min(result.submersionDepth / characterHeight, 1.0);

    if (headY < this.waterSurfaceY) {
      result.swimState = 'diving';
    } else if (chestY < this.waterSurfaceY) {
      result.swimState = 'swimming';
    } else if (result.submersionDepth > this.wadingThreshold) {
      result.swimState = 'wading';
    } else {
      result.swimState = 'none';
    }

    return result;
  }

  getSwimForce(
    waterContact: WaterContact,
    inputDirection: THREE.Vector3,
    swimSpeed: number = 2.0
  ): THREE.Vector3 {
    const force = new THREE.Vector3();
    
    if (!waterContact.inWater || waterContact.swimState === 'none') {
      return force;
    }

    const speedMultiplier = waterContact.swimState === 'diving' ? 0.6 :
                           waterContact.swimState === 'swimming' ? 0.8 : 0.5;
    
    force.copy(inputDirection).multiplyScalar(swimSpeed * speedMultiplier);
    
    return force;
  }

  getBuoyancy(
    waterContact: WaterContact,
    characterMass: number = 80,
    gravity: number = 9.81
  ): THREE.Vector3 {
    const buoyancy = new THREE.Vector3(0, 0, 0);
    
    if (!waterContact.inWater) {
      return buoyancy;
    }

    const displacedVolume = waterContact.submersionRatio;
    const buoyancyForce = displacedVolume * characterMass * gravity * 1.02;
    
    buoyancy.y = buoyancyForce;
    
    return buoyancy;
  }
}

export class CharacterPhysicsBody {
  private parts: CharacterBodyParts;
  private hitboxes: BodyPartHitbox[] = [];
  private groundDetector: GroundDetector;
  private waterInteraction: WaterInteraction;
  private characterHeight: number;
  private characterRadius: number;
  
  private groundContact: GroundContact;
  private waterContact: WaterContact;
  private lastGroundHeight: number = 0;

  constructor(
    parts: CharacterBodyParts,
    characterHeight: number = 1.8,
    characterRadius: number = 0.3
  ) {
    this.parts = parts;
    this.characterHeight = characterHeight;
    this.characterRadius = characterRadius;
    
    this.hitboxes = createBodyPartHitboxes(parts, characterHeight);
    this.groundDetector = new GroundDetector();
    this.waterInteraction = new WaterInteraction();
    
    this.groundContact = {
      isGrounded: false,
      groundHeight: 0,
      groundNormal: new THREE.Vector3(0, 1, 0),
      surfaceType: 'none',
      waterDepth: 0,
    };
    
    this.waterContact = {
      inWater: false,
      waterSurfaceY: 0,
      submersionDepth: 0,
      submersionRatio: 0,
      swimState: 'none',
    };
  }

  setGroundLayers(layers: THREE.Object3D[]): void {
    this.groundDetector.setGroundLayers(layers);
  }

  addGroundLayer(layer: THREE.Object3D): void {
    this.groundDetector.addGroundLayer(layer);
  }

  setWaterSurface(y: number): void {
    this.groundDetector.setWaterSurfaceY(y);
    this.waterInteraction.setWaterSurface(y);
  }

  update(characterPosition: THREE.Vector3): void {
    updateHitboxPositions(this.parts, this.hitboxes);
    
    let leftFootPos: THREE.Vector3 | null = null;
    let rightFootPos: THREE.Vector3 | null = null;
    
    if (this.parts.leftFoot) {
      leftFootPos = new THREE.Vector3();
      this.parts.leftFoot.getWorldPosition(leftFootPos);
    }
    if (this.parts.rightFoot) {
      rightFootPos = new THREE.Vector3();
      this.parts.rightFoot.getWorldPosition(rightFootPos);
    }
    
    if (leftFootPos || rightFootPos) {
      this.groundContact = this.groundDetector.checkGroundFromFeet(
        leftFootPos,
        rightFootPos,
        characterPosition
      );
    } else {
      this.groundContact = this.groundDetector.checkGround(characterPosition, this.characterHeight);
    }
    
    this.waterContact = this.waterInteraction.checkWaterContact(characterPosition, this.characterHeight);
    
    if (this.groundContact.isGrounded) {
      this.lastGroundHeight = this.groundContact.groundHeight;
    }
  }

  getGroundContact(): GroundContact {
    return this.groundContact;
  }

  getWaterContact(): WaterContact {
    return this.waterContact;
  }

  checkDamage(attackPoint: THREE.Vector3, attackRadius: number = 0.1): {
    hit: boolean;
    part: keyof CharacterBodyParts | null;
    damageMultiplier: number;
  } {
    return checkHitboxCollision(this.hitboxes, attackPoint, attackRadius);
  }

  getHandPosition(hand: 'left' | 'right', target?: THREE.Vector3): THREE.Vector3 {
    const part = hand === 'left' ? this.parts.leftHand : this.parts.rightHand;
    return getWorldPosition(part, target);
  }

  getFootPosition(foot: 'left' | 'right', target?: THREE.Vector3): THREE.Vector3 {
    const part = foot === 'left' ? this.parts.leftFoot : this.parts.rightFoot;
    return getWorldPosition(part, target);
  }

  getHeadPosition(target?: THREE.Vector3): THREE.Vector3 {
    return getWorldPosition(this.parts.head, target);
  }

  getChestPosition(target?: THREE.Vector3): THREE.Vector3 {
    return getWorldPosition(this.parts.chest, target);
  }

  getMinFeetY(): number {
    const leftPos = new THREE.Vector3();
    const rightPos = new THREE.Vector3();
    
    if (this.parts.leftFoot) {
      this.parts.leftFoot.getWorldPosition(leftPos);
    }
    if (this.parts.rightFoot) {
      this.parts.rightFoot.getWorldPosition(rightPos);
    }
    
    if (this.parts.leftFoot && this.parts.rightFoot) {
      return Math.min(leftPos.y, rightPos.y);
    } else if (this.parts.leftFoot) {
      return leftPos.y;
    } else if (this.parts.rightFoot) {
      return rightPos.y;
    }
    
    return 0;
  }

  enforceGroundConstraint(characterPosition: THREE.Vector3): THREE.Vector3 {
    const result = characterPosition.clone();
    
    if (this.groundContact.isGrounded) {
      const minY = this.groundContact.groundHeight;
      if (result.y < minY) {
        result.y = minY;
      }
    }
    
    return result;
  }

  getSwimForce(inputDirection: THREE.Vector3, swimSpeed: number = 2.0): THREE.Vector3 {
    return this.waterInteraction.getSwimForce(this.waterContact, inputDirection, swimSpeed);
  }

  getBuoyancy(characterMass: number = 80): THREE.Vector3 {
    return this.waterInteraction.getBuoyancy(this.waterContact, characterMass);
  }

  isSwimming(): boolean {
    return this.waterContact.swimState === 'swimming' || this.waterContact.swimState === 'diving';
  }

  isWading(): boolean {
    return this.waterContact.swimState === 'wading';
  }

  isDiving(): boolean {
    return this.waterContact.swimState === 'diving';
  }

  canJump(): boolean {
    return this.groundContact.isGrounded && !this.isSwimming();
  }

  canAttack(): boolean {
    return !this.isDiving();
  }

  getParts(): CharacterBodyParts {
    return this.parts;
  }

  getHitboxes(): BodyPartHitbox[] {
    return this.hitboxes;
  }
}

export function labelTerrainForPhysics(
  terrain: THREE.Object3D,
  surfaceType: 'terrain' | 'water' | 'deck' | 'island'
): void {
  terrain.userData.surfaceType = surfaceType;
  terrain.userData.isPhysicsGround = true;
}

export function createDebugVisualization(
  parts: CharacterBodyParts,
  hitboxes: BodyPartHitbox[]
): THREE.Group {
  const debugGroup = new THREE.Group();
  debugGroup.name = 'BodyPartDebug';
  
  const colors: Record<string, number> = {
    head: 0xff0000,
    chest: 0x00ff00,
    leftHand: 0x0000ff,
    rightHand: 0x00ffff,
    leftFoot: 0xff00ff,
    rightFoot: 0xffff00,
    spine: 0xffffff,
    hips: 0x888888,
  };
  
  for (const hitbox of hitboxes) {
    let geometry: THREE.BufferGeometry;
    
    if (hitbox.collider instanceof THREE.Sphere) {
      geometry = new THREE.SphereGeometry(hitbox.collider.radius, 8, 6);
    } else {
      const size = new THREE.Vector3();
      hitbox.collider.getSize(size);
      geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    }
    
    const material = new THREE.MeshBasicMaterial({
      color: colors[hitbox.part] || 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Debug_${hitbox.part}`;
    mesh.userData.bodyPart = hitbox.part;
    debugGroup.add(mesh);
  }
  
  return debugGroup;
}

export function updateDebugVisualization(
  debugGroup: THREE.Group,
  hitboxes: BodyPartHitbox[]
): void {
  for (const hitbox of hitboxes) {
    const mesh = debugGroup.getObjectByName(`Debug_${hitbox.part}`) as THREE.Mesh;
    if (!mesh) continue;
    
    if (hitbox.collider instanceof THREE.Sphere) {
      mesh.position.copy(hitbox.collider.center);
    } else if (hitbox.collider instanceof THREE.Box3) {
      const center = new THREE.Vector3();
      hitbox.collider.getCenter(center);
      mesh.position.copy(center);
    }
  }
}

const sharedRaycaster = new THREE.Raycaster();
const sharedRayOrigin = new THREE.Vector3();
const sharedRayDirection = new THREE.Vector3(0, -1, 0);

export function getTerrainHeightAt(
  x: number,
  z: number,
  terrainMeshes: THREE.Object3D[],
  rayStartHeight: number = 100
): number {
  if (terrainMeshes.length === 0) return 0;
  
  sharedRayOrigin.set(x, rayStartHeight, z);
  sharedRaycaster.set(sharedRayOrigin, sharedRayDirection);
  sharedRaycaster.far = rayStartHeight * 2;
  
  const intersects = sharedRaycaster.intersectObjects(terrainMeshes, true);
  if (intersects.length > 0) {
    return intersects[0].point.y;
  }
  return 0;
}

export interface GroundEnforcementResult {
  wasUnderground: boolean;
  groundHeight: number;
  correctedPosition: THREE.Vector3;
}

export function enforceGroundConstraint(
  position: THREE.Vector3,
  terrainMeshes: THREE.Object3D[],
  minHeightAboveTerrain: number = 0,
  rayStartHeight: number = 100
): GroundEnforcementResult {
  const groundHeight = getTerrainHeightAt(position.x, position.z, terrainMeshes, rayStartHeight);
  const targetY = groundHeight + minHeightAboveTerrain;
  
  const result: GroundEnforcementResult = {
    wasUnderground: false,
    groundHeight,
    correctedPosition: position.clone(),
  };
  
  if (position.y < targetY) {
    result.wasUnderground = true;
    result.correctedPosition.y = targetY;
    position.y = targetY;
  }
  
  return result;
}
