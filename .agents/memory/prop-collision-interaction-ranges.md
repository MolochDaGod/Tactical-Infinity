---
name: Prop collision vs interaction ranges
description: Why prop-collider push-out radius must stay below any center-distance interaction cutoff (harvest, talk, loot).
---

# Prop collision push-out must stay under interaction center-distances

When adding horizontal "you can't walk through that model" collision (e.g.
`PropColliderSystem` wired into `islandExploreManager`), the player is pushed
out to `colliderRadius + playerRadius` from the prop's **center**.

Many interaction checks measure distance to the prop's **center** with a hard
cutoff (island harvesting: `getNearestResource` requires `dist < 3`). If a
prop's collider push-out distance exceeds that cutoff, the player can never
get close enough to interact — large trees/rocks become unharvestable.

**Rule:** for any prop that is also interactable, cap its collider so
`colliderRadius + playerRadius < interactionCutoff`. For island resource
nodes (`userData.isResourceNode`, harvest cutoff 3m, playerRadius 0.6) cap the
node collider radius at ~1.8 (push-out 2.4m < 3m).

**Why:** collision and interaction were designed independently; bbox-derived
collider radii can be much larger than the interaction range, silently
breaking gameplay. Caught in code review, not at compile time.

**How to apply:** when introducing collision near any center-distance
interaction system, give interactable props a tighter collider (per-object
options) rather than one global radius. `rebuildFromScene` accepts a
per-object options function for exactly this.

## Two collision backends across island scenes (pick by movement model)

`PropColliderSystem` (position push-out) is correct only for scenes whose
player is moved by directly writing a position vector (`ProductionIsland`,
`IslandBattlePage`, `islandExploreManager`): resolve just before the
terrain-height snap, and in battle re-snap `y` afterwards since `player.update()`
already snapped once.

Scenes whose player is driven by a physics capsule (`BeachSpawnScene` via
`SketchbookIslandController`'s Cannon.js world) must NOT use push-out — it fights
the integrator. Register mass-0 `CANNON.Box` static bodies instead
(`addStaticProp`/`removeStaticProp`/`clearStaticProps` on the controller).

**Why:** overwriting a physics body's position each frame causes jitter/tunneling.
**How to apply:** for depletable/removable props, drive `removeStaticProp` from the
same event that hides the mesh (mission `onNodeDepleted`, building
`onBuildingRemoved`) so stale colliders don't linger.
