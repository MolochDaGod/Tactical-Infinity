# Base character animation pipeline (1 · 2 · 3)

Source: `D:\Games\Models\Animated Base Character.glb`  
Staged (water / TI): `client/public/animations/base/animated-base-character.glb`  
Play shell (gameopen): `artifacts/animator/public/anim/base/animated-base-character.glb`

## 1 — Semantic registry + strip/rootLock

| File | Role |
|------|------|
| `client/src/lib/animation/baseCharacterClips.ts` | Role → GLB clip name + `base/*` keys |
| `client/src/lib/animation/BaseClipPack.ts` | Load once, strip root, upper variants |
| `client/src/lib/animation/rootLock.ts` | Freeze hips local XYZ after mixer (controller owns world) |
| `client/src/lib/animation/AnimGraph.ts` | State machine + short fades + rootLock |
| `client/src/lib/character/UnitGLBLoader.ts` | Loads base pack + optional `createAnimGraph()` |

```ts
import { loadBaseCharacterPack, AnimGraph } from '@/lib/animation';

await loadBaseCharacterPack();
const graph = new AnimGraph({ mixer, skeletonRoot: model });
graph.setLocomotion(speed, sprinting);
graph.playRoll();
graph.playAttack({ moving: true });
graph.playCast('shoot');
// per frame:
graph.update(dt, speed, sprinting);
```

Or via unit:

```ts
const unit = await UnitCharacter.load(path);
const graph = unit.createAnimGraph();
graph.setLocomotion(0.5, false);
graph.update(dt, 0.5, false);
```

## 2 — Offline / static retarget maps

| File | Role |
|------|------|
| `client/src/lib/animation/boneRemapBase.ts` | DEF-* → Mixamo / Bip001 names |
| `scripts/bake-base-character-clips.mjs` | Writes `base-roles.json` + `bone-maps.json` |
| `BaseClipPack.retargetBaseRole(role, skeletonRoot)` | Live semantic retarget (preferred) |
| `BaseClipPack.bakeBaseRole(role, 'mixamo'\|'bip001')` | Static name-remap bake |
| `public/animations/base/bone-maps.json` | Shipped maps for tools / play shell |

```bash
node scripts/bake-base-character-clips.mjs
# → 18 roles mapped, 0 missing (45 GLB clips, 53 bones)
```

Full T-pose mathematical retarget: use `retargetClipTPose` from `animationRetargeting.ts` when you have a source rest pose scene.

## 3 — Anim graph (loco / roll / attack / cast)

| API | Fade | Notes |
|-----|------|--------|
| `setLocomotion(speed, sprint)` | 0.14s | idle/walk/jog/sprint |
| `playRoll()` | 0.08s | full body one-shot |
| `playAttack({ moving })` | 0.09s | upper overlay if moving |
| `playCast(phase)` | 0.09s | enter/loop/shoot/exit |
| `playHit` / `playDeath` | 0.09s | reactions |

Resolve order for production skills (`resolveRoleClip`):

```text
weaponPack[role] ?? classPack[role] ?? base/* ?? idle
```

## Play shell wiring (gameopen)

| File | Role |
|------|------|
| `artifacts/animator/public/anim/base/*.glb` | Staged multi-clip pack |
| `artifacts/animator/src/three/explorer/clipCatalog.ts` | `BASE_PACK_FALLBACKS`, `base/*` ids |
| `artifacts/animator/src/three/explorer/loader.ts` | `loadBasePackClips()` DEF→mixamorig |
| `artifacts/animator/src/three/explorer/Animator.ts` | style → unarmed → `base/*` resolve |

## Root-motion policy

- Default: **strip** hip translation at load + **rootLock** hips local XYZ after `mixer.update`.
- Optional RM one-shots: `base/roll_rm`, `base/attack_melee_rm` keep tracks (`stripRoot: false`).
- Controller always owns the character Group world XYZ.

## Next (optional)

- Bake full GLBs with retargeted tracks for Mixamo + Bip001 (headless three + SkeletonUtils).
- Point weapon skill kit `clip` fields at `base/attack_melee` when style missing.
- Drive island NPCs with `unit.createAnimGraph()` end-to-end.
