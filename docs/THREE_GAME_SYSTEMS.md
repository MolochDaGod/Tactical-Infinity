# Three.js game system nodes (fleet)

**Contract:** `shared/fleet/threeGameSystem.ts` · **Runtime:** `client/src/island3d/systems/`  
**Play snapshot:** `FLEET_PLAY_SYSTEMS.three` (version with playSystems)

Every game system is a **system node**: owns scene children, ticks once per frame, disposes cleanly. Same contract on client, open, water/TI, Danger Room, RTS.

## Stack pins (Node + Three)

| Layer | Pin |
|-------|-----|
| Node | `>=20` (22 LTS preferred) — Railway / Vercel / tooling |
| three | `^0.170` min · **prefer r185+** |
| Units | **1 unit = 1 meter** |
| Time | **seconds** (`Clock.getDelta()`, clamp ~0.05) |
| Color | `renderer.outputColorSpace = SRGBColorSpace` |
| Tone | `ACESFilmicToneMapping` |
| DPR | `Math.min(devicePixelRatio, 1.5)` |

Audit: `npm run check:best-practices`

## Rules (must)

1. **No alloc in `update` / `tick`** — reuse `mathScratch` / `ThreeGameSystem._v0` / `SCRATCH`
2. **Pool over destroy** — `.visible = false` for temporary hide
3. **`dispose()` only on permanent teardown** (engine destroy, leave mode)
4. **glTF/GLB production meshes** from `assets.grudge-studio.com`
5. **One physics lib** per game (Rapier preferred for new Warlords)
6. **Share materials/geometries** (clone materials for skinned only)

## Lifecycle

```ts
import { GameSystemRegistry } from '@/island3d/systems/GameSystemRegistry';
import { ThreeGameSystem, type ThreeGameSystemContext } from '@/island3d/systems/ThreeGameSystem';
import { THREE_SYSTEM_PRIORITY } from '@shared/fleet';

class MySystem extends ThreeGameSystem {
  readonly id = 'my_system';
  readonly label = 'My System';
  readonly priority = THREE_SYSTEM_PRIORITY.worldFx;

  update(ctx: ThreeGameSystemContext): void {
    // use this._v0 — never new THREE.Vector3() here
    this._v0.copy(ctx.playerPos ?? this._v0);
  }

  protected onDispose(): void {
    // remove scene children + disposeObject3D
  }
}

const registry = new GameSystemRegistry();
registry.register(new MySystem(scene));
// each frame:
registry.update({ scene, camera, dt, elapsed, player, playerPos });
// teardown:
registry.disposeAll();
```

## Priority order

| Priority | Systems |
|----------|---------|
| 10 | input |
| 20 | character |
| 25 | mount_cavalry / mount_dragon |
| 30 | soft_lock |
| 40 | skill_combat |
| 50–60 | creatures, camps, harvest |
| 80+ | world_fx, water, day_night |
| 100+ | multiplayer, cursors |

## Production systems (Warlords client)

| id | Class | Hotkey |
|----|--------|--------|
| mount_cavalry | `MountSummonSystem` | **N** (2s cast) |
| mount_dragon | `DragonSummonSystem` | **Shift+N** |
| skill_combat | `ProductionSkillCombatRuntime` | 1–5 |
| character | `CharacterController3D` | WASD |

Engine: `Island3DEngine.systemRegistry` registers mounts on init; `destroy()` calls `disposeAll()`.

## Required on every play surface

From `FLEET_THREE_GAME_SYSTEMS.requiredPlay`:

- character · mount_cavalry · soft_lock · skill_combat · world_fx · cursors

## Other games

| App | Bridge |
|-----|--------|
| GrudgeBuilder | `@shared/fleet` + island3d systems |
| Tactical-Infinity | `shared/fleetPlaySystems.ts` + this doc |
| gameopen | `lib/fleet-play-systems.ts` |
| Danger Room | same hotkeys + soft-lock Tab |

Do **not** fork hotkeys or mount cast times — import `FLEET_PLAY_SYSTEMS`.

## Related

- `docs/FLEET_PLAY_SYSTEMS.md`
- `docs/FLEET_CURSORS.md`
- Skill: `threejs-production-best-practices`
- Checker: `scripts/best-practices/check-node-three-react.mjs`
