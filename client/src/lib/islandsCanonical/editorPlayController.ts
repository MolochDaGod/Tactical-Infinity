/**
 * Island Editor play mode — human unarmed grudge6/Toon RTS captain + tools for harvest QA.
 */

import * as THREE from 'three';
import { CharacterBuilder, CHAR_SCALE } from '@/lib/character/CharacterBuilder';
import { applyHarvestChip, setHarvestDepleted } from './editorStylizedAssets';
import { CUTE_ROD_URLS, FISHING_POLE_LENGTH_M } from '@/lib/quaterniusFish';

export type PlayTool = 'none' | 'axe' | 'pickaxe' | 'knife' | 'rod';

export const PLAY_TOOLS: { id: PlayTool; label: string; icon: string }[] = [
  { id: 'none', label: 'Unarmed', icon: '✊' },
  { id: 'axe', label: 'Axe', icon: '🪓' },
  { id: 'pickaxe', label: 'Pickaxe', icon: '⛏️' },
  { id: 'knife', label: 'Knife', icon: '🔪' },
  { id: 'rod', label: 'Fishing Pole', icon: '🎣' },
];

const TOOL_MATCH: Record<string, PlayTool[]> = {
  axe: ['axe', 'none'],
  pickaxe: ['pickaxe'],
  knife: ['knife', 'none'],
  rod: ['rod'],
  none: ['none', 'axe', 'pickaxe', 'knife', 'rod'],
};

export interface HarvestLogEntry {
  at: number;
  yieldId: string;
  amount: number;
  remainingHp: number;
  depleted: boolean;
}

export class EditorPlayController {
  readonly group = new THREE.Group();
  builder: CharacterBuilder | null = null;
  tool: PlayTool = 'none';
  keys = new Set<string>();
  velocity = new THREE.Vector3();
  yaw = 0;
  speed = 6.5;
  harvestRange = 3.8;
  log: HarvestLogEntry[] = [];
  private heightSample: ((x: number, z: number) => number) | null = null;
  private disposed = false;

  constructor() {
    this.group.name = 'EditorPlayCaptain';
  }

  setHeightSample(fn: (x: number, z: number) => number) {
    this.heightSample = fn;
  }

  async spawn(scene: THREE.Scene, position: THREE.Vector3): Promise<void> {
    this.disposeCharacter();
    try {
      // Human RTS toon, bare loadout (CharacterBuilder applies bare mesh filter).
      // sword_shield style loads idle clips; we strip weapons for unarmed harvest test.
      const builder = new CharacterBuilder({
        race: 'human',
        weaponStyle: 'sword_shield',
        scale: CHAR_SCALE,
      });
      await builder.load();
      if (this.disposed) {
        builder.dispose?.();
        return;
      }
      this.builder = builder;
      // Remove equipped weapons → unarmed visual
      builder.group.traverse((c) => {
        const n = c.name.toLowerCase();
        if (/weapon|sword|shield|axe|bow|spear|staff|gun|mace/i.test(n) && c !== builder.group) {
          // don't hide body; only detach if parent is hand container
        }
      });
      // Hide weapon meshes under hand containers if present
      builder.group.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const path: string[] = [];
          let p: THREE.Object3D | null = c;
          while (p) {
            path.push(p.name);
            p = p.parent;
          }
          const joined = path.join('/');
          if (/hand_container|weapon|shield_container/i.test(joined) && /weapon|sword|shield|axe|bow/i.test(c.name)) {
            c.visible = false;
          }
        }
      });

      this.group.clear();
      this.group.add(builder.group);
      this.group.position.copy(position);
      this.group.position.y = this.sampleY(position.x, position.z);
      scene.add(this.group);
      builder.play('idle');
    } catch (e) {
      console.warn('[EditorPlay] CharacterBuilder failed — metric human capsule', e);
      const capsule = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.32, 1.15, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xd4a868, roughness: 0.75 }),
      );
      capsule.position.y = 0.9;
      capsule.castShadow = true;
      this.group.clear();
      this.group.add(capsule);
      this.group.position.copy(position);
      this.group.position.y = this.sampleY(position.x, position.z);
      scene.add(this.group);
    }
  }

  private sampleY(x: number, z: number): number {
    if (!this.heightSample) return 0;
    return this.heightSample(x, z);
  }

  setTool(tool: PlayTool) {
    this.tool = tool;
    if (tool === 'rod') {
      void this.builder?.equipHarvestTool(CUTE_ROD_URLS.lvl1, FISHING_POLE_LENGTH_M);
    } else {
      this.builder?.clearHarvestTool();
    }
  }

  onKeyDown(code: string) {
    this.keys.add(code);
  }
  onKeyUp(code: string) {
    this.keys.delete(code);
  }

  update(dt: number, camera: THREE.Camera): void {
    if (!this.group.parent) return;
    let mx = 0;
    let mz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;

    // Camera-relative move on XZ
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(forward, -mz);
    move.addScaledVector(right, mx);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      this.group.position.x += move.x;
      this.group.position.z += move.z;
      this.group.position.y = this.sampleY(this.group.position.x, this.group.position.z);
      this.yaw = Math.atan2(move.x, move.z);
      this.group.rotation.y = this.yaw;
      this.builder?.play('run');
    } else {
      this.builder?.play('idle');
    }

    this.builder?.update(dt);
  }

  /**
   * Attempt harvest on nearest harvestable within range that accepts current tool.
   */
  tryHarvest(targets: THREE.Object3D[]): HarvestLogEntry | null {
    const origin = this.group.position;
    let best: THREE.Object3D | null = null;
    let bestD = this.harvestRange;

    for (const t of targets) {
      if (!t.userData?.isHarvestable || t.userData.depleted) continue;
      const d = origin.distanceTo(t.getWorldPosition(new THREE.Vector3()));
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (!best) return null;

    const required = (best.userData.harvestTool as string) || 'none';
    const allowed = TOOL_MATCH[required] ?? ['none'];
    if (!allowed.includes(this.tool) && required !== 'none') {
      return null;
    }

    let hp = (best.userData.harvestHp as number) ?? 1;
    const maxHp = (best.userData.harvestMaxHp as number) ?? 1;
    hp = Math.max(0, hp - 1);
    best.userData.harvestHp = hp;
    applyHarvestChip(best, hp, maxHp);

    const yieldId = (best.userData.harvestYield as string) || 'resource';
    const depleted = hp <= 0;
    if (depleted) {
      const respawn = (best.userData.harvestRespawnMs as number) || 60_000;
      best.userData.respawnAt = performance.now() + respawn;
      setHarvestDepleted(best, true);
    }

    try {
      this.builder?.play('attack');
    } catch {
      /* clip may be missing */
    }

    const entry: HarvestLogEntry = {
      at: Date.now(),
      yieldId,
      amount: depleted ? 1 + Math.floor(Math.random() * 2) : 0,
      remainingHp: hp,
      depleted,
    };
    if (depleted) this.log.unshift(entry);
    if (this.log.length > 40) this.log.length = 40;
    return entry;
  }

  private disposeCharacter() {
    if (this.builder) {
      try {
        this.builder.dispose();
      } catch {
        /* ignore */
      }
      this.builder = null;
    }
    this.group.clear();
  }

  dispose(scene?: THREE.Scene) {
    this.disposed = true;
    this.disposeCharacter();
    if (scene) scene.remove(this.group);
    this.keys.clear();
  }
}
