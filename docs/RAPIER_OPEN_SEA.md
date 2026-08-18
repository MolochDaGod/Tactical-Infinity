# Rapier open-sea combat (water.grudge-studio.com / World Map)

## Physics SSOT

| Layer | Engine | Notes |
|-------|--------|--------|
| **Combat** (cannonballs, hull colliders, debris) | **`@dimforge/rapier3d-compat`** | `client/src/lib/naval/rapierOpenSeaCombat.ts` |
| **Sailing feel** (swell roll/pitch/heave) | Procedural `ShipPhysics` | Wave response, capsize |
| **Deck crew** | `ShipDeckPhysics` | Glue riders to deck |
| **Part HP / repair** | `ShipPartsManager` | Destroyed masts fall; `repairShip` |

**Never Cannon.js / Ammo** for fleet open water. The [threejs-games physics-cannon](https://threejs-games.github.io/examples/80-scenes/physics-cannon/) demo is **gameplay reference only** (projectiles smash targets). We re-implement that feel on **Rapier**.

[model-viewer](https://github.com/google/model-viewer) is the **presentation** reference (clean framing of ship GLBs / third-person silhouette), not the physics stack.

## Runtime flow (World Map)

1. `ThreeWorldMapManager` constructs → `rapierSea.init(scene)`.
2. Each frame: sync kinematic hulls from player/NPC ship transforms.
3. `createCannonball` → visual mesh + Rapier **dynamic CCD** sphere.
4. `updateCannonballs` → `rapierSea.step` → collision events → hits.
5. Hit → explosion VFX + hull HP + optional `damageShipAtPoint` + **debris** cuboids.
6. **Repair** ability (`R` / slot 1) → `repairShip(amount)` restores HP + parts.

## Third person

`CameraMode = 'third-person' | 'birds-eye' | 'chase'` on World Map. Chase uses Mario64-style captain on deck; third-person follows the ship (open-sea combat framing).

## Files

- `client/src/lib/naval/rapierOpenSeaCombat.ts` — Rapier world
- `client/src/lib/threeWorldMapManager.ts` — integration
- `client/src/lib/shipPartsManager.ts` — destroy / repair meshes
- `client/src/components/WorldMap/WorldMapScene.tsx` — fire / repair UI
