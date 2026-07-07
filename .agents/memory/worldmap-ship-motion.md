---
name: World-map ship motion & sail deployment
description: Design constraints for player-ship swell motion and keyboard sail deployment on /world-map (threeWorldMapManager + shipPhysics).
---

# World-map player-ship: swell motion vs weather, and sail deployment cap

## Rule 1 — cosmetic swell must be decoupled from weather-damage waveHeight
In `shipPhysics.ts` `update()`, the visual roll/pitch/heave use a floored
`swell = max(floor, weather.waveHeight * waveResponseScale)` (and a floored
`swellFreq`) so the boat ALWAYS visibly rides the ocean, even in calm/clear
weather (the ocean surface always has Gerstner waves). The capsize /
water-intake / weather-damage paths must keep using the RAW weather-driven
`waveHeight`, never the floored `swell`.

**Why:** users read a dead-flat boat as "the water isn't affecting my boat."
But if calm-weather damage/capsize used the floored value, an idle boat could
take spurious damage or capsize. Keep the two amplitudes separate.

**How to apply:** the floor only affects the sinusoidal roll/pitch/heave visual
terms. It is safe because roll is clamped to `maxRollAngle` (~PI/4) and the
floored swell's damped roll (~0.15–0.25 rad) stays well below the smallest
hull's capsize accumulation point (`capsizeThreshold * 0.7`, smallest hull
≈ 0.63 rad). If you raise the floor, re-check against that margin.

## Rule 2 — keyboard sail cap must map to full deployment range
`WorldMapScene` S-key raises `sailPosition` only 0→1→2 (capped via
`Math.min(2, ...)`; W lowers it). Movement is wind-driven, not key-driven —
the sail keys only set deployment. `setSailPosition()`'s `deploymentTargets` array therefore
must let indices 0/1/2 span furled→half→full (e.g. `[0, 0.5, 1.0, 1.0]`).
Index 3 is wind-magic only. `speedMultiplier` is multiplied by deployment, so a
table that caps index 2 below 1.0 silently halves top speed and reads as
"the boat barely moves."

**Why:** this exact mismatch (`[0,0.25,0.5,1.0]` with a cap of 2) shipped once
and made keyboard sailing top out at 50% thrust.
