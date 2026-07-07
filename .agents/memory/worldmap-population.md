---
name: World-map ocean population vs render distance
description: Why /world-map reads "empty" near spawn and the rule for fixing it
---

# World-map ocean feels empty near spawn

**Rule:** to make the `/world-map` ocean feel alive, POPULATE AROUND THE PLAYER
— do not push the far plane out. Cluster fish/creatures/boats within a few
hundred units of the spawn/harbour rather than smearing authored content across
the full ~9k world.

**Why:** content (lore NPC ships, fish schools) is pre-placed across the whole
world while fog/far cull at ~800-900 units, so the spawn area sits in dead
water and the nearest authored ships are 800-3200 units away. Extending
cameraFar/fogFar just renders more empty water and costs perf. (User complaint:
"it's bland, we render too far and hide things.")

## Non-obvious gotchas
- `updateSeaCreatures` is minified to `n(delta)` and IS called from the
  manager's own update loop — don't trust a report that it's "uncalled" without
  checking minified aliases. `fishManager.ts`/`oceanFloorManager.ts` also have
  mangled identifiers; grep by comments/strings, not clean names.
- NPC ship disposition (`aggressive`/`faction`) is stored on `ship.mesh` (the
  group), not on the Ship3D itself. The generic world-map NPC AI chases + fires
  on ALL ships unless it gates on `aggressive`, so "friendly/fishing" boats will
  attack the player unless the AI reads that flag.
- Coral is tropical-island-only and sparse by default, so non-tropical starter
  waters have no reef.
