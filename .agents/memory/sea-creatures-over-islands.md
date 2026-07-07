---
name: Sea creatures sitting on top of islands
description: Why big non-fish sea creatures rendered on top of islands, and the two-part invariant that prevents it.
---

# Sea creatures rendering on top of islands

**Symptom:** a "huge massive fish" (whale / kraken / manta) sits on top of an
island (e.g. Waterfall Isle at world origin) on the world map.

**Root cause (two compounding bugs in the per-frame creature physics clamp):**
1. The horizontal "can't beach on land" constraint was gated to `isFish`
   creatures only. Whale/manta/dolphin/kraken are NOT flagged `isFish`, so they
   could drift horizontally over an island's XZ footprint.
2. The seabed clamp uses an ocean-floor-depth getter. **Over land that getter
   returns the island's terrain height (positive, above the waterline).** The
   clamp pushes the creature UP to `floor + 1.5`, and it runs AFTER the surface
   cap, so it wins — planting the creature on top of the terrain.

**Invariants to keep (both required):**
- Land avoidance / bounce-off-land must apply to EVERY sea creature, not just
  fish. None of them should breach or beach.
- Any seabed clamp built on an ocean-floor-depth getter must cap its effective
  floor at the surface ceiling (`Math.min(floor, surfaceCap)`), because the
  getter conflates seabed depth with island terrain height over land.
- Spawn placement (`spawnRandomCreatures`, `spawnKrakenEncounter`) must reject
  `isPointOnLand` points, or a creature spawned inside terrain bounce-locks in
  place.

**Why:** ocean-floor getters in this codebase double as terrain-height getters
over islands; treating their output as always-underwater is the trap.
