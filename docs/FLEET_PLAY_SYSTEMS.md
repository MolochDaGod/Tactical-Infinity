# Fleet play systems SSOT

**Version:** `FLEET_PLAY_SYSTEMS_VERSION` in `shared/fleet/playSystems.ts` (currently **1.4.0**)  
**Three.js system nodes:** [THREE_GAME_SYSTEMS.md](./THREE_GAME_SYSTEMS.md) (`FLEET_PLAY_SYSTEMS.three`)

One contract for mounts, dragons, cursors, and combat hotkeys across **all** Grudge Studio games.

## Import

```ts
// Preferred — full snapshot
import { FLEET_PLAY_SYSTEMS, FLEET_PLAY_HOTKEYS, FLEET_PLAY_MOUNTS } from '@shared/fleet';

// Or leaf modules
import { MOUNT_SUMMON_KEY, MOUNT_SUMMON_CAST_SEC, TOON_RTS_MOUNTS } from '@shared/definitions/mountSummon';
import { FLEET_DRAGON_CONTRACT, DRAGON_MOUNTS } from '@shared/definitions/mountDragons';
import { PRODUCTION_COMBAT_HOTKEYS } from '@shared/definitions/productionCombatHotkeys';
import { setGrudgeCursorFromMode } from '@/lib/grudgeCursor'; // client
```

## Rules (do not fork)

| Rule | Value |
|------|--------|
| Ground mount hotkey | **N** (never E — E is interact/harvest) |
| Mount cast | **2.0s** (flash + approach + hop) |
| Mount selection | **Any unit** may ride **any of the 6** Toon RTS cavalry |
| Default mount | Rider race → matching cavalry (`defaultMountForRace`) |
| Dragon summon | **Shift+N**, 2.0s cast |
| Dragon flight toggle | **Space** while dragon-mounted |
| Soft lock | **Tab** (not mode switch) |
| Hard focus | **RMB** |
| Cursors | Toon RTS 01–20 pack — see `FLEET_CURSORS.md` |
| Equipment | grudge6 mesh visibility only — no Meshy placeholders |

## 6 Toon RTS mounts

CDN: `https://assets.grudge-studio.com/models/vehicles/mounts/{race}/cavalry.glb`

| id | Label | Race default |
|----|--------|--------------|
| human | Warhorse | WK_ |
| barbarian | Clan Steed | BRB_ |
| elf | Elven Steed | ELF_ |
| dwarf | Mountain Pony | DWF_ |
| orc | Warg | ORC_ |
| undead | Skeletal Steed | UD_ |

## Runtime (GrudgeBuilder / client)

| Mode | Character | Mounts |
|------|-----------|--------|
| lobby | yes | `initMountSystem` + Grudge6 race |
| procedural (home-island) | yes | `initMountSystem` |
| zone | yes | `initMountSystem` (same N / 2s) |

```ts
// Island3DEngine
engine.setPlayerMount({ raceId: 'orc', mountId: 'human' }); // orc rider on warhorse
// N → ground steed · Shift+N → dragon · Space → flight toggle
```

Classes:

- `client/src/island3d/mounts/MountSummonSystem.ts`
- `client/src/island3d/mounts/DragonSummonSystem.ts`

Dispose on engine destroy (key listeners + systems).

## Surfaces that must share this contract

| Surface | Domain | Wiring |
|---------|--------|--------|
| Warlords client | client.grudge-studio.com | Island3DEngine + GrudgeCursorRoot |
| Open launcher | open.grudge-studio.com | Import `FLEET_PLAY_*` + cursors pack |
| Water / TI | water.grudge-studio.com | Same hotkeys + cursors under `public/cursors/` |
| Danger Room / animator | threejs-rapier… | Soft-lock Tab + production combat hotkeys |
| Home island | /home-island | procedural path |
| Zone open-world | /zones | zone path |

## Cursor pack

See **`docs/FLEET_CURSORS.md`**. Public dir `/cursors/`, CDN `assets.grudge-studio.com/ui/cursors/`.

## Combat skills

- Catalog: `shared/definitions/weaponSkillCombatCatalog.ts`
- Runtime: `client/src/island3d/combat/ProductionSkillCombatRuntime.ts`
- Hotkeys: `1–5` skill slots, LMB attack, V/MMB heavy, Tab soft-lock

## Publishing for other repos

Pin against:

```ts
FLEET_PLAY_SYSTEMS.version  // '1.3.0'
FLEET_PLAY_SYSTEMS.rules    // mountHotkey, mountCastSec, anyUnitMountsAnyOf6, …
```

When adding a new game: load `grudge-game-onboarding` skill + import `@shared/fleet` (or copy `playSystems.ts` + leaf definitions until the monorepo package is published).

## Related docs

- `FLEET_CURSORS.md`
- `PRODUCTION_PLAY_STACK_REVIEW.md`
- `PRODUCTION_WEAPON_SKILL_COMBAT.md`
- Skills: `grudge6-toon-rts-mounts-siege`, `grudge-combat-targeting`, `character-select-systems`
