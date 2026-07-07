---
name: Sailing render path & player-boat spawn
description: Which component actually renders the "sailing" phase, and that the player boat is procedural (not GLB-dependent).
---

The `sailing` phase renders the **World Map page**, not `OpenWaterSailing.tsx`
(that page is retired — reachable only via ShipTester / page registry). "Fix
sailing / fix the boat" work often lands wrongly in the retired page; edit the
world-map render path for anything the player actually experiences.

**Player boat is procedural.** It is built from procedural geometry (box hull +
cloth sail), so it is always visible and does NOT depend on a GLB load
succeeding. A GLB overlay can replace visuals later, but never make visibility
depend on the load.

**Why:** the procedural + world-map split is not obvious from the phase name,
and the two ship layers are easy to confuse.

**How to apply:** canonical boat id / physics / cannon come from
`shared/gameDefinitions/boatRegistry.ts` (`resolveBoatId` / `getBoat`) — the
single source of truth. A separate procedural-geometry config layer still keys
its meshes off the ship's *type*, never its display name (that's the captain
name).
