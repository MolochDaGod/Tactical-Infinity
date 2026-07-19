# Stonewisp Beast — Asset & Intro Fight

## Location

| Field | Value |
|-------|--------|
| **Path** | `/models/scenes/stonewisp_beast/scene.gltf` |
| **Companion** | `scene.bin` + `textures/*` |
| **CDN manifest** | `shared/cdnManifest.json` (paths listed) |
| **Runtime load** | `IntroScene.tsx` via `StonewispController` |
| **Code** | `client/src/lib/stonewisp/*` |

**Status:** Manifest lists textures/bin, but binary may be **missing from local checkout and public CDN** (404). Place files under:

```
client/public/models/scenes/stonewisp_beast/
  scene.gltf
  scene.bin
  textures/
    Body_baseColor.png / Body_normal.png / Body_metallicRoughness.png / Body_emissive.jpeg
    Eyes_*  Teeth_*  Tentacles_*  (same map set)
```

Until present, controller uses a **procedural tentacle fallback** so IK still runs.

## Identity

- **Role:** Ancient deep-sea terror (“Stonewisp”) — storm intro antagonist  
- **Design note (IntroScene):** “mutant stingray”  
- **Scale in intro:** `36` world units  
- **Facing:** `rotation.y = π` toward the pirate ship  

## Mesh / materials (from texture names)

| Group | Maps |
|-------|------|
| **Body** | baseColor, normal, metallicRoughness, emissive |
| **Eyes** | baseColor, normal, metallicRoughness, emissive (strong glow) |
| **Teeth** | baseColor, normal, metallicRoughness, emissive |
| **Tentacles** | baseColor, normal, metallicRoughness, emissive |

Runtime enhances emissive on tentacles/eyes for storm readability.

## Skeleton

Discovered at runtime by `analyzeStonewisp()`:

1. Prefer `THREE.Bone` / skinned mesh  
2. Tentacle chains = bones matching  
   `/tentacle|tent|arm|limb|appendage|tendril|whip|feeler|spine|tail/i`  
3. Tip = leaf bone or name matching `/tip|end|ik|effector/`  
4. Chains logged: `Tentacle_0_Root → … → Tip`

**If your rig uses different names**, rename tips to include `Tip` or `Tentacle` so discovery works, or extend `TENTACLE_BONE_RE` in `stonewispAsset.ts`.

## Animations (clip name includes)

| Role | Matcher | Intro use |
|------|---------|-----------|
| **Swim** | `Swim` | Approach / retreat |
| **Intimidate** | `Intimidate` / attack | Emerge → lunge → strike |
| **Inspect** | `Inspect` | Fallback idle |
| Hit / Death | optional | Future combat |

Crossfade Swim ⇄ Intimidate is phase-driven (not a fixed 12s timeout).

## Tentacle tip IK

`TentacleIKSolver` (FABRIK-lite + sine whip):

- Runs **after** mixer each frame  
- Tips reach toward **ship deck** world position  
- Weight ramps with fight intensity (strike ≈ 0.85)  
- Mid-chain whip for wet thrash  

## Fight phases (adjustedT 0–1 of 3D intro)

| Phase | t range | Motion |
|-------|---------|--------|
| approach | 0–0.12 | Deep swim in |
| emerge | 0.12–0.45 | Rise + close (→ Intimidate) |
| lunge | 0.45–0.62 | Arc surge to hull |
| strike | 0.62–0.78 | Thrash + max IK + ship shake |
| retreat | 0.78–1 | Sink/drift (→ Swim) |

Ship impact shake, mast break, debris remain in `IntroScene` ship track.

## Debug

Intro debug panel: loaded flag, mixer, current clip, position, tentacle chain count in overlay status. Console prints full bone report on load.
