---
name: Ship sail cloth-rig full-span
description: How the world-map ship sails are rigged (deck→crow's-nest) and the multi-mast pitfall to avoid.
---

# Sail cloth rig (world-map ships)

`ClothSimulation(width, height, segX, segY)` derives its vertical rest-length from
`height`. `setGaffRigPositions(gaffY, boomY)` interpolates the pinned Y from the top
row (gaff) down to the bottom row (boom). `updateBoomPosition(boomY)` moves ONLY the
pinned bottom particles; the top stays where `setGaffRigPositions` put it.

## Rule: a full-span sail change touches FOUR consistent sites
1. Main-sail setup (build cloth with `height = gaffY - boomY`, call `setGaffRigPositions`).
2. Crow's-nest setup (reuse the single `crowsNestY`; do NOT redeclare it — a second
   `const crowsNestY` in the same function scope is a hard esbuild/vite error even
   though `tsc` may momentarily lag behind HMR).
3. Multi-mast additional-sail setup.
4. Per-frame `updateSailVisuals` deployment block (recomputes gaff/boomDeployed/boomFurled).

Keep the per-frame `boomDeployedY` equal to the setup `boomY`, so at full deployment
the cloth returns to its construction rest span (no stretch).

## Pitfall: additional (multi-mast) sails must use their OWN rig anchors
**Why:** outer masts on brigantines/galleons are shorter (`mastScale < 1`). If their
per-frame boom lerp borrows the MAIN mast's `boomFurledY`/`boomDeployedY`, the furled
boom can rise ABOVE the shorter mast's own gaff → cloth inverts / over-stretches.
**How to apply:** store `gaffY`, `boomDeployedY`, `boomFurledY` on each `AdditionalSail`
at creation and drive the per-frame lerp from those, clamped `<= gaffY - epsilon`.
