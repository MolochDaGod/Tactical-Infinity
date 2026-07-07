---
name: Sailing wind direction convention
description: What wind.direction means in the world-map sailing system and how to orient wind-driven visuals.
---

# Wind direction is "wind FROM", not "wind toward"

In the open-water sailing manager (`threeWorldMapManager.ts`), `this.wind.direction`
is the heading the wind blows **FROM** (the upwind/source direction).

**Why:** `calculateWindEffect` treats a small `wind.direction - shipRotation`
(bow pointing along `wind.direction`) as the **no-sail zone** — i.e. sailing
directly *into* the wind. Thrust is applied along the ship's facing
`(sin(shipRotation), cos(shipRotation))`. So pointing the bow at `wind.direction`
means heading into the wind ⇒ `wind.direction` is where wind comes from.

**How to apply:**
- Downwind world heading = `wind.direction + π`.
- A streamer/pennant/flag that should trail downwind, parented in a frame that
  carries the ship heading (e.g. `shipGroup`, whose `rotation.y = ship.rotation`),
  gets local `rotation.y = wind.direction + π - ship.rotation`. Its local **+Z is
  the bow**.
- The inner ship visual group is flipped (`innerGroup.rotation.y = Math.PI`);
  attach heading-relative indicators to the un-flipped `shipGroup` to avoid a
  hidden π offset.
- Angle convention throughout: heading θ → direction vector `(sin θ, 0, cos θ)`.
