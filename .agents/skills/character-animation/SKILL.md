---
name: character-animation
description: |
  Tethical's character + animation pipeline. Read before touching FBX/GLB
  loaders, AnimationMixer setup, retargeting, root-motion handling, or
  upper-body additive layers. Codifies the sbcode "shared AnimationClip"
  pattern that ALL character controllers must follow — load each clip
  ONCE, share across every mixer, crossfade with `lastAction.fadeOut →
  newAction.reset().fadeIn().play()`.
---

# Character & Animation Skill

## TL;DR — the rules

| Rule | Why |
| ---- | --- |
| Load each AnimationClip **once**, into `SharedClipLibrary`, keyed by SEMANTIC name. | sbcode pattern. Avoids reloading and re-parsing the same FBX/GLB per character. |
| Each character gets its **own** `THREE.AnimationMixer`. | Mixer state (time, fade, weights) is per-character. Sharing a mixer = every character animates in lockstep. |
| Each character gets its **own** `AnimationAction` per clip via `mixer.clipAction(clip)`. | three.js keys actions by `(mixer, clip)`. Same clip on N mixers → N independent actions. |
| Crossfade with `prev.fadeOut(0.5)` → `new.reset().fadeIn(0.5).play()`. | Idiomatic. Don't `stop()` and re-`play()`; you'll see a snap. |
| **Never** `tracks.shift()` to remove root motion. | Assumes track[0] is the hips translation. It often isn't. Use `stripRootMotion(clip)`. |
| Filter partial-body clips with `filterClipToBones()` or `filterClipToNormalizedBones()`. | sbcode "clonedRightArm" pattern, made safe + reusable. |
| Cross-rig animations go through `animationRetargeting.ts`. | BRB→ToonRTS→Mixamo bone vocabularies all differ; raw playback drops every track silently. |

## 1. The sbcode pattern, verbatim

The reference (https://sbcode.net/threejs/sharing-animationclips/) boils down
to:

```ts
const animationClips: { [name: string]: THREE.AnimationClip } = {};

// Load each character once → its own mixer
const xbotMixer = new THREE.AnimationMixer(xbotScene);
const ybotMixer = new THREE.AnimationMixer(ybotScene);

// Load each animation once → store the CLIP (not the action) by name
animationClips['samba']     = sambaGltf.animations[0];
animationClips['bellydance'] = bellyGltf.animations[0];

// Optional: strip root motion or filter to one limb
goofyRunning.tracks.shift();              // ← FRAGILE — see §3
animationClips['goofyRunning'] = goofyRunning;

// Play the SAME clip on EITHER mixer
function play(mixer, lastAction, name) {
  mixer.clipAction(lastAction).fadeOut(0.5);
  mixer.clipAction(animationClips[name]).reset().fadeIn(0.5).play();
  return animationClips[name];
}
```

Two characters, one clip, no duplication, smooth crossfade. We codify this
across the project via the modules in §2.

## 2. The modules

### 2.1 `client/src/lib/animation/SharedClipLibrary.ts`

Process-wide singleton: `name → AnimationClip`. Three loaders:

```ts
import {
  registerClipFromFile,
  registerNamedClipFromFile,
  registerAllClipsFromFile,
  registerClip,
  getClip,
  hasClip,
  listClips,
} from '@/lib/animation';

// Single-clip GLB/FBX
await registerClipFromFile('samba', '/animations/dance/samba.glb');

// Multi-clip file, pick by clip.name
await registerNamedClipFromFile('attack_1h', '/animations/combat.glb', 'mixamo.com_attack');

// Multi-clip file, register all under a prefix
await registerAllClipsFromFile('crusade', '/animations/combat/crusade.glb');
//   → 'crusade/idle', 'crusade/attack_1h', 'crusade/block', ...

// Donate clips you happen to have (e.g., from the GLB that also gave you the mesh)
registerClip('xbot_default', gltf.animations[0]);
```

All loaders are **idempotent and de-duped**: re-registering the same name is
a no-op, and the underlying GLB/FBX is loaded exactly once even if 50
controllers ask for it concurrently.

### 2.2 `CharacterAnimationController.bindLibraryClip()`

Each character pulls library clips into its own action map:

```ts
const ctrl = new CharacterAnimationController(charScene);

ctrl.bindLibraryClip('samba');                          // local key === library name
ctrl.bindLibraryClip('idle_inplace', 'idle', { stripRoot: true });
ctrl.bindLibraryClip('upper_attack', 'attack_1h', {
  filterNormalized: UPPER_BODY_TOKENS,
  loop: false,
});

ctrl.play('samba');           // crossfade in
ctrl.playOnce('upper_attack');// one-shot, snaps back
```

Same library clip, transformed differently for two different controllers,
and the original library entry stays untouched. Per-character actions
maintain their own time/weight/fade.

### 2.3 `client/src/lib/animation/clipUtils.ts`

Pure helpers. Originals are never mutated.

- **`stripRootMotion(clip, rootTokens?)`** — Removes `.position` tracks for
  bones whose normalized name is in `{ hips, pelvis, root, armature }` (or
  your custom set). Rotation tracks are kept so the character can still
  rotate in place. Use this for treadmill-style locomotion and for dance
  clips you want to play in place.

- **`filterClipToBones(clip, prefixes[])`** — Keeps tracks whose RAW bone
  name starts with any of the prefixes. Vocabulary-locked (`'mixamorigRightArm'`).

- **`filterClipToNormalizedBones(clip, normalizedTokens)`** — Keeps tracks
  whose NORMALIZED bone name (via `animationRetargeting.normalizeBoneName`)
  is in the set. Vocabulary-agnostic (`'rightarm'` matches BRB, ToonRTS,
  Mixamo, Sketchfab).

- **`cloneClipWithName(clip, newName)`** — A clone with a new `.name`. Needed
  when you want two distinct AnimationActions of "the same" animation on
  one mixer (three.js dedupes by clip identity).

## 3. Why `tracks.shift()` is wrong (and what to do instead)

The sbcode tutorial line:

```ts
gltf.animations[0].tracks.shift();   // delete the forward-motion track
```

…happens to work for the goofy-running clip used in the tutorial because
the exporter happened to put the hips position track at index 0. **There is
no spec that guarantees this.** The order of tracks in an FBX/GLB depends on:

- The DCC tool that authored it (Maya vs Blender vs Mixamo's online export)
- Whether the clip was retargeted en route
- Whether the rig has IK helpers, root-bone passthroughs, namespaced bones

If the hips position is at `tracks[3]` and you call `shift()`, you delete a
foot rotation. The character's foot then snaps to T-pose for the duration of
the clip — visible as a "broken animation".

Use this instead:

```ts
import { stripRootMotion } from '@/lib/animation';
const inplace = stripRootMotion(rawClip);   // finds hips by NAME
```

`stripRootMotion` looks for tracks whose property is `.position` and whose
bone name normalizes to one of `{ hips, pelvis, root, armature }`. It tolerates
Mixamo (`mixamorigHips`), BRB (`Bip01_Pelvis`), ToonRTS (`WK_Pelvis`),
Sketchfab (`Hips`, `Root`), and Blender's `Armature`.

## 4. Mixer per character — never share

Each character has ONE `THREE.AnimationMixer` bound to their root
`Object3D`. Sharing a mixer between two characters means:

- Both characters' actions live in the same time domain → can't desync
- `mixer.update(dt)` advances both at once → no per-character pause
- Removing one character requires `mixer.uncacheRoot(other)` gymnastics

`CharacterAnimationController` enforces this by constructing the mixer
internally; you give it the root `Object3D`, you get a controller back, you
never touch the mixer directly.

## 5. Crossfade is two lines, not five

```ts
// CORRECT — sbcode idiom, also what CharacterAnimationController.play() does
prevAction.fadeOut(0.5);
nextAction.reset().fadeIn(0.5).play();

// WRONG — visible snap because reset() is missing
prevAction.stop();
nextAction.play();

// WRONG — fading a stopped action does nothing
prevAction.stop();
nextAction.fadeIn(0.5).play();
```

`reset()` rewinds time AND clears any leftover fade weight from a previous
crossfade. Without it, a clip you played, faded out, and now want to play
again will start at the moment you stopped it (not at zero), and its weight
might already be zero.

## 6. Cross-rig retargeting (`animationRetargeting.ts`)

A clip authored on the BRB skeleton has track names like
`Bip01_Spine.quaternion`. Played on a Mixamo skeleton (`mixamorigSpine`),
three.js silently drops every track and the character holds T-pose.

Two layers of fix:

1. **`normalizeBoneName(name)`** — strips namespaces (`mixamorig:`, `Bip01_`,
   `WK_`, `BRB_`) and punctuation, lowercases. Used to build a
   `normalized → actual` map for any target rig.

2. **`retargetClip(clip, targetRoot)`** — rewrites every track name to use
   the target rig's actual bone names. Returns a NEW clip, original is
   untouched and may stay in the shared library for use on other rigs.

3. **`retargetClipTPose(clip, sourceRoot, targetRoot)`** — full mathematical
   rebake using rest-pose offsets. Use when the source and target skeletons
   have different bone proportions or rest poses (e.g., orcs vs dwarves).

If you load a clip via `SharedClipLibrary` and then bind it to a controller
whose character is on a different rig, retarget BEFORE registering:

```ts
const raw = await loadSingleClip({ path: '/animations/...', format: 'glb' });
const dwarfClip = retargetClipTPose(raw, sourceTPoseRoot, dwarfRoot);
registerClip('attack_1h__dwarf', dwarfClip);
```

## 7. Upper-body additive layers (combat overlays)

The sbcode "clonedRightArm" example demonstrates the partial-body filter.
Tethical uses this for combat: locomotion plays on layer 0, attacks/blocks
play on layer 2 with `THREE.AdditiveAnimationBlendMode` and only upper-body
tracks.

```ts
import { filterClipToNormalizedBones } from '@/lib/animation';

const UPPER_BODY = new Set([
  'spine', 'spine1', 'spine2', 'neck', 'head',
  'leftshoulder', 'leftarm', 'leftforearm', 'lefthand',
  'rightshoulder', 'rightarm', 'rightforearm', 'righthand',
]);

const upperOnly = filterClipToNormalizedBones(swordSwing, UPPER_BODY);
const action = mixer.clipAction(upperOnly);
action.blendMode = THREE.AdditiveAnimationBlendMode;
action.weight = 1;
action.play();
// locomotion on layer 0 keeps playing — the upper body adds the swing on top.
```

`mixamoPlayerController.ts` already uses the prefix-string approach. Migrate
it to `filterClipToNormalizedBones` so non-Mixamo rigs (ToonRTS WK/DWF/ELF
etc.) get the same upper-body slice without the bone-fragment list having to
list every vocabulary.

## 8. Asset paths (canonical)

| Kind                       | Path                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| ToonRTS character meshes   | `/toon_rts/Toon_RTS/<RACE>/models/<PREFIX>_*.FBX`                   |
| ToonRTS animations         | `/toon_rts/Toon_RTS/<RACE>/animation/<KIND>/<PREFIX>_*.FBX`         |
| Mixamo player FBX          | `/models/player/*.fbx`                                              |
| GLB animation clip files   | `/animations/<category>/<name>.glb` (e.g. `/animations/dance/samba.glb`) |
| Goblin/NPC GLBs            | `/models/goblin_npc.glb`, `/models/goblin_animations.glb`           |
| Generic GLTF               | `/gltf/...`                                                         |

Forbidden paths (will 404 — removed April 2026):

- `/3dassets/...`

## 9. Common pitfalls

1. **Loading a character GLB N times for N characters.** Use a clip-aware
   GLTF cache or share via `SharedClipLibrary` if you only need the
   animations.
2. **Calling `mixer.clipAction(clip)` twice expecting two actions.** It
   returns the SAME action object both times. Use `cloneClipWithName(clip,
   'foo_b')` if you genuinely need two.
3. **Forgetting `dispose()`.** `CharacterAnimationController.dispose()`
   stops every action and clears the action map. The mixer itself is
   garbage-collected when the root `Object3D` goes out of scope.
4. **Updating the mixer with `Date.now()` deltas.** Use a `THREE.Clock` or
   `THREE.Timer` and pass real `getDelta()` values.
5. **Calling `tracks.shift()` because the tutorial did.** See §3.

## 10. Where to add new code

| Concern                               | File                                            |
| ------------------------------------- | ----------------------------------------------- |
| New shared clip / library entry       | `client/src/lib/animation/SharedClipLibrary.ts` |
| New per-character controller behavior | `client/src/lib/animationLoader.ts`             |
| New clip transform helper             | `client/src/lib/animation/clipUtils.ts`         |
| Cross-rig retarget logic              | `client/src/lib/animationRetargeting.ts`        |
| Mixamo-specific player controller     | `client/src/lib/mixamoPlayerController.ts`      |
| FBX mesh loading + URL rewrites       | `client/src/lib/fbxModelLoader.ts`              |
