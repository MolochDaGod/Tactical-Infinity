---
name: Gear/equipment loadout system
description: How the reusable hub-driven gear system is keyed and wired across UI and 3D rigs.
---

# Gear loadout system

Reusable equipment: `shared/gameDefinitions/gear.ts` (GearItem model + slot maps + LOCAL_GEAR fallback),
`client/src/lib/gear/{catalogue,loadout,rig3d}.ts`, applied via `applyGearLoadout` on BOTH rig types
(`CharacterBuilder` FBX rig, `UnitGLBLoader`/`UnitCharacter` GLB rig).

## Loadout key contract
Loadouts persist to localStorage (`gw-loadouts-v1`) keyed by a per-character id. The equipment-editor
UI and the in-game 3D consumer MUST use the SAME key or edits won't propagate.
- **Rule:** the local player uses the exported `PLAYER_LOADOUT_ID` (`'player'`) from `loadout.ts`. Both
  `EquipmentDemo.tsx` (editor) and `IslandBattlePage.tsx` (3D player) import it — never hardcode `'player'`.
- **Why:** an early version had the editor writing `preview:<race>` while the battle player read `player`,
  so equipping in the UI silently did nothing in-game. Caught in code review.
- **How to apply:** any new gear editor or new character consumer must resolve via the same character-id
  key. For allies/enemies, pick a deterministic id and use it in BOTH the equip UI and the spawn path.

## Weapon attach is rig-independent
`rig3d.ts` normalizes each weapon GLB to a per-weaponStyle world size (via `bone.getWorldScale` + native
bbox) so the same asset sizes correctly on the differently-scaled FBX and GLB rigs. Weapons attach to hand
bones; armor is TOGGLED on built-in character submeshes (no new armor meshes are created).

## Watch-outs
- STYLE_ATTACH rotation offsets in `rig3d.ts` are estimated — verify visually in a live 3D session before trusting them.
- Enemy/ally rigs come from `animatedEnemyLoader`/`yukaEnemyAI` (GLB via UnitCharacter-style loader); confirm hand-bone
  names resolve (`findHandBone` supports Bip001 + common conventions) before assuming gear attaches.
