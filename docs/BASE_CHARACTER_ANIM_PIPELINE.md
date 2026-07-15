# Base character animation pipeline (1 · 2 · 3)

Source: `D:\Games\Models\Animated Base Character.glb`  
Staged: `client/public/animations/base/animated-base-character.glb`  
Play shell: `artifacts/animator/public/anim/base/animated-base-character.glb`

## 1 — Semantic registry + strip/rootLock

| File | Role |
|------|------|
| `client/src/lib/animation/baseCharacterClips.ts` | Role → GLB clip name + `base/*` keys |
| `client/src/lib/animation/BaseClipPack.ts` | Load once, strip root, upper variants |
| `client/src/lib/animation/AnimGraph.ts` | State machine + short fades |

```ts
import { loadBaseCharacterPack, AnimGraph } from '@/lib/animation';

await loadBaseCharacterPack();
const graph = new AnimGraph({ mixer });
graph.setLocomotion(speed, sprinting);
graph.playRoll();
graph.playAttack({ moving: true });
graph.playCast('shoot');
```

## 2 — Offline / static retarget maps

| File | Role |
|------|------|
| `client/src/lib/animation/boneRemapBase.ts` | DEF-* → Mixamo / Bip001 names |
| `scripts/bake-base-character-clips.mjs` | Writes `base-roles.json` + `bone-maps.json` |
| `BaseClipPack.retargetBaseRole(role, skeletonRoot)` | Live semantic retarget (preferred) |
| `BaseClipPack.bakeBaseRole(role, 'mixamo'\|'bip001')` | Static name-remap bake |

```bash
node scripts/bake-base-character-clips.mjs
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

Resolve order for production skills:

```text
weaponPack[role] ?? classPack[role] ?? base/* ?? idle
```

## Play shell wiring

- `loader.ts` merges base pack into every Explorer clip Map after Mixamo load.
- `BASE_PACK_FALLBACKS` in `clipCatalog.ts` documents semantic ids.
- `AnimGraph` + `BaseClipPack` under `explorer/` for NPC/player graphs.

## Next (optional)

- Bake full GLBs with retargeted tracks for Mixamo + Bip001 (headless three + SkeletonUtils).
- Point weapon skill kit `clip` fields at `base/attack_melee` when style missing.
- NPC spawner: `loadBaseCharacterPack` + `new AnimGraph({ mixer })` per unit.
