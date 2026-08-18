# Camp / RTS Building SSOT

Consolidated pattern for **Tactical Infinity** + **RTS-Grudge** camp systems:

buildings UI · selection · costs · delivery (units / vehicles / food) · auto-harvest · AI · claim · defense buildings · defense brain.

## Authority map

| Concern | SSOT location | Runtime engine |
|---------|---------------|----------------|
| Building defs / costs / functions | `shared/camp/masterBuildings.ts` | TI place + RTS place |
| Units train table | `shared/camp/units.ts` | RTS allies / TI roster |
| Item production recipes | `shared/camp/production.ts` | Station queues |
| Defense AI pure logic | `shared/camp/defenseBrain.ts` | TI turrets + RTS defend |
| Claim flag state | `types.ClaimFlagState` (Railway later) | Both |
| Mesh binaries | `assets.grudge-studio.com` | loaders |
| Player bag / placed / roster | Railway Postgres | game APIs |

**Not SSOT:** modular Kenney palette pieces (structure kits), voxel Mine-Loader blocks.

## Canonical building id

```
bld.<family>[.<faction>][.<age>].l<level>
```

Examples: `bld.barracks.crusade.first.l1`, `bld.farm.first.l1`, `bld.claim_flag`

Legacy adapters via `aliases[]`: `barracks_1a_l1`, `rts_barracks`, `campfire`, …

## Building functions (gameplay)

| Function | Delivery |
|----------|----------|
| `spawn_units` | Train queue → unit mesh + ally AI |
| `produce_items` | Timed recipes → inventory / stockpile |
| `spawn_resources` | Auto-harvest node ring |
| `turret` | Defense brain target pick + fire |
| `storage` | Camp stockpile slots |
| `assign_role` | harvest / craft / defend / patrol |
| `claim_anchor` | Build rights radius |
| `food` | Passive generation |
| `vehicle` | Raft / boat dock delivery |

## Claim rules

- **Field quick-craft** (`fieldQuickCraft: true`): campfire, claim flag — never claim-gated.
- **Structures / train / economy**: `claimGated: true` — must be inside `ClaimFlagState.radiusM` with `buildRights`.
- Ghost validity: blue in claim, red outside (`inClaimBuildRadius`).

## Defense brain

`tickDefenderBehavior` + `pickBestThreat` + `leadTargetPoint`:

- Workers: harvest / craft until threat → `return_to_camp`
- Military: combat near threat, else defend / garrison
- Turrets: prefer threats inside claim

## UI tabs

`camp | military | economy | defense | housing | special` — use `buildingPaletteRows(faction)`.

## Import paths

```ts
// Tactical Infinity
import { buildingPaletteRows, getBuilding, pickBestThreat } from "@/lib/campSsot";

// RTS-Grudge
import { campBuildingsAsRtsDefs, enqueueUnitJob } from "@/lib/campSsot";
```

## Fleet mirror

- ObjectStore: `data/master-buildings.json` (generated)
- Re-generate: run node export from `shared/camp` after edits
- Copy TS package: `tactical-infinity/shared/camp` ↔ `RTS-Grudge/shared/camp`

## Migration status

| Step | Status |
|------|--------|
| Shared types + catalog + production + defense brain | **Done** |
| TI / RTS `campSsot` adapters | **Done** |
| BuildMenu / BuildHammerUI SSOT palette | **Done** |
| Claim flag place + ghost gate | **Done** |
| Train UI (`TrainPanel` + queue) | **Done** |
| Ally `tickDefenderBehavior` | **Done** |
| Claim/production local persist + Railway PUT shape | **Done** |
| Open claim-flag hub panel | **Done** (gameopen) |
| Replace full `BUILDING_REGISTRY` / placeable list | Incremental |
| Railway route implementation | Client ready; server may 404 until shipped |

## Product loop (target)

```
Claim flag → Camp / Town Center
    → Farm / Lumber / Mine (auto-harvest workers)
    → Workbench / Forge (craft + food)
    → Barracks / Archery (train)
    → Watchtower / Wall / Cannon (defense brain)
    → Dock (vehicles)
    → Warehouse (stockpile)
```
