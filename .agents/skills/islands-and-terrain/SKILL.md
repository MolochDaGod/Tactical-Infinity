---
name: islands-and-terrain
description: Build, modify, and extend Tethical's island + terrain system. Covers pipeline choice (canonical vs terrainV2), the layered depth-band model (air → shore → shallow → mid → deep → seabed), BVH raycasting, water shaders, sky-shader backdrops, harbour-node selection, pathfinding heatmaps, asset/texture organization, and Three.js 0.182 / WebGL2 specifics. Use whenever you touch heightmaps, chunks, water, sky, sea creatures, harbours, dock placement, AI pathing on terrain, or any new island biome.
---

# Islands & Terrain — Tethical / Grudge Warlords

This skill consolidates every standing rule, convention, and built-in module
that touches the island and terrain layer. Read it before adding a new biome,
modifying terrain generation, wiring water/sky effects, implementing
pathfinding, or doing anything that traces a ray against the ground.

It is the long-form companion to `client/src/lib/terrain/RULES.md` (which is
the short rule sheet), and supersedes any older convention found in
`client/src/lib/terrainGenerator.ts` or `client/src/lib/weatherSystem.ts`.

---

## TL;DR (read this every time)

| Topic                | Rule                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Three.js version     | **0.182.0** — WebGL2 only (WebGL1 fallback removed in r163+).                                 |
| Pipelines            | **Two only**: `lib/islandsCanonical/` (default) and `lib/terrainV2/` (custom). No third.      |
| Raycasting           | **Always BVH** via `attachBVH` + `TerrainPicker`. Never `new THREE.Raycaster()` per frame.    |
| Per-tick height      | `heightmap.getHeightAt(x, z)` — *not* a raycast.                                              |
| Depth bands          | 6 layers (`AIR_HIGH … DEEP`); creature/dock/asset rules key off these.                        |
| Asset paths          | `/textures/...`, `/toon_rts/...`, `/buildings/FBX/...`, `/fish/...`, `/models/...`.           |
| Forbidden paths      | `/3dassets/...` — removed April 2026, will 404.                                               |
| Harbour requirement  | Every island MUST have ≥1 dock-eligible harbour node. Use `findHarbours()`.                   |
| Pathfinding          | Use `buildIslandHeatmap()` for AI cost grid; A\* over the heatmap, not raw geometry walks.    |
| Shader backdrops     | `lib/shaders/skyShaders/` — opt-in via `?shader=hills|spheroid|elevated|weather`.             |
| IDs                  | `deterministicId()` for procgen, `randomId()` for runtime. **Never** `Math.random()` in procgen. |
| Seeded RNG           | `mulberry32(seed)` in procgen; one stream per subsystem via `childSeed(parent, 'label')`.     |

---

## 1. Three.js 0.182 + WebGL2 implications

Three.js 0.182 ships with the WebGL2-only renderer (the standalone
`WebGL1Renderer` was removed in r163, around mid-2024). On every browser this
project supports (modern Chromium / Firefox / Safari ≥ 15), WebGL2 is
universally available, so this is a non-issue at runtime — but it does change
what you can rely on:

**You get for free under WebGL2:**

- 32-bit float textures, integer textures, 3D textures, sRGB framebuffers.
- `OES_standard_derivatives` (no extension dance).
- `gl_VertexID`, `gl_InstanceID` in vertex shaders.
- `texelFetch`, `textureGrad` in any shader.
- MSAA on render targets via `WebGLMultisampleRenderTarget`.
- Up to 16 vertex attributes guaranteed.

**Shader compatibility:**

- `THREE.ShaderMaterial` defaults to **GLSL ES 1.00 syntax** (`varying`,
  `texture2D`, `gl_FragColor`). Three.js silently translates it to ES 3.00
  before compiling. **All four vendored Shadertoy shaders use ES 1.00 — do
  not "modernise" them.** They will break.
- If you need explicit ES 3.00 (for `texture()`, `out vec4 fragColor`, etc.),
  set `glslVersion: THREE.GLSL3` on the ShaderMaterial.
- `RawShaderMaterial` does *not* translate — write what you mean.

**Pitfall:** any code that calls `renderer.capabilities.isWebGL2` should be
deleted; it is always `true` and dead branches confuse future-you.

---

## 2. Pipeline choice — pick one, don't mix

| Use case                                               | Pipeline                                       |
| ------------------------------------------------------ | ---------------------------------------------- |
| `/islands` route, default island generation, `IslandSceneBuilder` callers | **`lib/islandsCanonical/`**         |
| Custom heightmaps, dev tools, dock pads, calderas      | **`lib/terrainV2/`**                           |
| `OpenWaterSailing`, `IslandBattlePage` (legacy)        | `lib/terrainGenerator.ts` (deprecated, in use) |
| `BattleGrounds` 2D tactical                            | PixiJS — out of scope here                     |

**Don't add a third pipeline.** New features go into one of the two canonical
paths.

`lib/islandsCanonical/` modules:

- `IslandHeightmap.ts` — pure-data heightmap synthesis (Simplex fBm + ridge +
  radial falloff). Shape variants: `round`, `archipelago`, `horseshoe`,
  `volcanic_caldera`. Default sea-floor `minHeight = -22ft`.
- `IslandChunks.ts` — splits the heightmap into N×N `BufferGeometry` tiles,
  each with AABB for frustum culling and a far-LOD billboard quad swap. Calls
  `attachBVHToGroup` automatically.
- `IslandSky.ts` — back-side sky dome with FBM cloud shader, weather presets
  (Clear / Cloudy / Rain / Tempest / Mist), time-of-day presets (Dawn / Noon
  / Dusk / Night), randomised lightning flashes for storms.
- `IslandWeatherOverlay.ts` — `EffectComposer` ShaderPass for screen-space
  rain streaks + lightning whiteflash.
- `SeascapeOcean.ts` — Alekseev "Seascape" production water material adapted
  to a real `PlaneGeometry` so it depth-composites with terrain/ships.
  ITER_GEOMETRY = 3 vertex octaves, ITER_FRAGMENT = 5 fragment octaves.
- `SeaCreatures.ts` — depth-banded marine-life spawner (see §3).
- `IslandHarbours.ts` — coastal harbour-node finder (see §6).
- `IslandHeatmap.ts` — pathfinding cost grid (see §7).
- `IslandSceneBuilder.ts` — orchestrator. **Always call this**, never reach
  for `terrainGenerator` / `weatherSystem` / `oceanShader` directly when
  building a new scene.

---

## 3. The layered depth-band model

Every island in this game has the same Z-stack of named layers. Code that
spawns assets, scatters vegetation, places creatures, enforces dock depth,
and routes pathfinding all key off these bands. **Use the constants from
`lib/islandsCanonical/depthBands.ts`** (create the file if it isn't there
yet — the band table below is the source of truth).

| Band ID       | Y range (world ft) | Use                                                    |
| ------------- | ------------------ | ------------------------------------------------------ |
| `AIR_HIGH`    | `+30 … +∞`         | Mountain peaks, snow line, cloud shadows.              |
| `AIR_LOW`     | `0 … +30`          | Walkable ground. Vegetation, units, harvest nodes.     |
| `SHORE`       | `-1 … 0`           | Splash zone. Crabs, beach props, dock pier base.       |
| `SHALLOW`     | `-10 … -1`         | Single fish, squid, dock pile depth, kelp.             |
| `MID`         | `-30 … -10`        | Schools of fish, whale band, anchored ship draft.      |
| `DEEP`        | `-110 … -30`       | Open seabed. Dark ambient, no light penetration.       |

Notes:

- The previous repo used a sea-floor of `-22`. The new band table extends to
  `-110`. **Do not lower seabed Y values without also moving the corresponding
  open-water generators.** `IslandHeightmap.minHeight` should be at most
  `-110` for islands that compose with this band table.
- Asset placement helper: `placeAssetInBand(asset, BAND.SHORE)` — picks a
  random Y inside the band and snaps X/Z to the heightmap. See
  `IslandSceneBuilder.placeProp` for the canonical implementation.
- Sea creatures already conform: crabs ∈ SHORE, single fish/squid ∈ SHALLOW,
  schools/whales ∈ MID. If you add a new creature type, **declare its band**.

---

## 4. Raycasting — must use BVH

Hard rules (reproduced from `client/src/lib/terrain/RULES.md`):

1. Every terrain mesh that will be raycast more than ~3 times in its lifetime
   **must** have a BVH attached via `attachBVH(mesh)` /
   `attachBVHToGroup(group)`. `IslandChunks` does this for every chunk;
   `terrainV2.buildMesh()` does it for the simple-plane path.
2. **Never** `new THREE.Raycaster()` in a per-frame loop. Construct one
   `TerrainPicker([roots])` per scene and reuse it. `buildIslandScene()`
   exposes a pre-bound `picker`.
3. **Never** `intersectObjects(scene.children)` — it walks the whole graph.
   Always pass an explicit array of terrain roots.
4. Per-tick "what's the ground height at (x, z)?" goes through
   `heightmap.getHeightAt()` — **not** a raycast. Raycasts are for click
   events, AI line-of-sight, and non-terrain picks.
5. **Always** `detachBVH(mesh)` before `geometry.dispose()`. Forgetting this
   leaks the BVH's internal buffers.
6. The only module allowed to `import 'three-mesh-bvh'` is
   `lib/terrain/raycast.ts`. Anything else imports the wrappers from there.

---

## 5. Water — modern shader stack

Two production water materials co-exist; **don't add a third**:

- **`SeascapeOcean`** (`lib/islandsCanonical/SeascapeOcean.ts`) — adapted
  Alekseev "Seascape". Ray-marched octaves on the vertex stage (3) +
  fragment stage (5), Beer-style extinction, sky reflection, sun specular.
  Used by `/islands`. Composites with the same depth buffer as terrain so
  ships and creatures slot in correctly.
- **`DynamicOcean`** (`lib/oceanShader.ts`) — Gerstner-wave surface used by
  `OpenWaterSailing` and the legacy island scenes. Has bespoke buoyancy
  hooks for ship physics.

Sky and weather overlays:

- `IslandSky` — the dome. Always present.
- `IslandWeatherOverlay` — screen-space rain + lightning, attached as the
  *last but one* pass in the EffectComposer (FXAA stays last).
- **Optional Shadertoy backdrops** — `lib/shaders/skyShaders/` registry.
  Mounted on `/islands` via `?shader=hills|spheroid|elevated|weather`.
  These render on a clip-space quad with `depthTest:false` and
  `renderOrder = -1000` (i.e. behind the real geometry). Don't try to put
  them on a hemisphere — they're screen-space ray-marchers, not sky shaders.

---

## 6. Harbour nodes — every island needs at least one

The user's spec (see project image): each island carries a set of harbour
candidate nodes around its perimeter (like the diamond markers on a compass
rose). **At least one of these MUST be flat enough and have the right water
depth for a dock to be deployed there.**

Use `lib/islandsCanonical/IslandHarbours.ts`:

```ts
import { findHarbours } from '@/lib/islandsCanonical/IslandHarbours';

const harbours = findHarbours({
  heightmap,            // from IslandHeightmap
  worldSize: 256,
  numCandidates: 12,    // 12 spokes around the island
  flatnessThreshold: 0.18,  // max heightmap gradient (rise/run) for dock-eligible
  minDockDepth: 3,      // ft of water 8m seaward of pier base
  maxDockDepth: 8,
});

// harbours[0..N] sorted by total score; harbours.filter(h => h.isDockEligible)
// is guaranteed to be non-empty (the algorithm relaxes thresholds if needed).
```

What it returns per node:

- `position: Vector3` — world-space, on the shoreline (heightmap ≈ 0).
- `approachDir: Vector3` — unit vector pointing seaward, normal to the coast.
- `flatnessScore: 0..1` — local gradient inverse, 1 = perfectly flat.
- `depthScore: 0..1` — water depth at pier head matches `[minDockDepth,
  maxDockDepth]` window.
- `totalScore: 0..1` — weighted sum.
- `isDockEligible: boolean` — passes thresholds, dock can be deployed here.

The algorithm:

1. Cast N evenly-spaced rays from the island center outward (every `360 / N`
   degrees).
2. For each ray, walk outward in heightmap coords until height crosses 0 —
   that's the shoreline point.
3. At the shoreline, compute the local gradient via 4-cell central
   differences → flatness.
4. Sample the water depth `pierHeadDist` units further along the ray →
   depth score.
5. Score, sort, mark top-K eligible. If zero pass thresholds, halve them and
   re-mark.

---

## 7. Pathfinding heatmap

Use `lib/islandsCanonical/IslandHeatmap.ts`:

```ts
import { buildIslandHeatmap } from '@/lib/islandsCanonical/IslandHeatmap';

const heat = buildIslandHeatmap({
  heightmap,
  worldSize: 256,
  resolution: 128,        // cost grid resolution (≤ heightmap.resolution)
  slopePenalty: 4.0,      // multiplier for slope-based cost
  waterPenalty: 50.0,     // cost for cells where height < 0
  beachBonus:  -0.3,      // SHORE band cells get a discount (preferred path)
});

const cost = heat.costAt(playerX, playerZ); // Infinity if out of bounds
```

What it returns:

- `data: Float32Array` — row-major `[z * resolution + x]` cost values.
- `resolution`, `worldSize` for grid → world transforms.
- `costAt(x, z): number` — bilinear-sampled cost at world position.

Use this as input to A*, Yuka NavMesh, or any cost-aware pathing system.
Don't walk the heightmap directly per AI tick — you'll thrash the cache and
duplicate work.

---

## 8. Asset & texture organization

The browser-shipped runtime root is `public/` (≈851 MB). Canonical asset URLs
(do not invent new prefixes):

| URL prefix             | Contents                                          |
| ---------------------- | ------------------------------------------------- |
| `/toon_rts/Toon_RTS/…` | ToonRTS character/animation FBX pack              |
| `/buildings/FBX/…`     | Building FBX models                               |
| `/gltf/…`              | Generic GLTF models                               |
| `/fish/…`              | Sea-creature GLBs                                 |
| `/models/…`            | Engine character/prop models                      |
| `/textures/terrain/…`  | Terrain PBR sets — sand, sand_2, grass, rock, etc.|
| `/textures/islands/…`  | Single-channel albedos for legacy callers         |
| `/textures/ore/…`      | Mossy rock, overgrown stone tiles                 |
| `/animations/…`        | Mixamo-style FBX animation clips                  |
| `/sprites/…`           | 2D PixiJS sprites                                 |

**Never** use `/3dassets/...` — the duplicate 555 MB tree was deleted in
April 2026. Code pointing at it 404s. See `CONSOLIDATION_NOTES.md` for the
full audit.

Texture pack naming convention:

```
public/textures/terrain/<material>_<channel>.<ext>
  e.g. sand_albedo.png, sand_normal.jpg, sand_height.jpg, sand_ao.jpg
       rock_moss_baseColor.jpg, rock_moss_normal.jpg, rock_moss_metallicRoughness.png
```

Loading helpers:

- `loadTerrainPBR(name)` in `lib/textureLoader.ts` — loads the four channels
  in parallel, caches by name.
- `loadKTX2(url)` for compressed cubemaps and large diffuse — uses the
  KTX2Loader bound at app boot.

---

## 9. Sky shader backdrops (vendored Shadertoy)

`lib/shaders/skyShaders/` registers four vendored Shadertoy fragments:

- `hills`     — D. Hoskins "Rolling Hills" (terrain + grass blades + flares)
- `spheroid`  — noise-displaced sphere over a starfield
- `elevated`  — IQ "Elevated" mountain ray-march
- `weather`   — D. Hoskins "Weather" (sea + clouds + rain + lightning)

Mount via URL flag on `/islands`:

```
/islands?shader=weather
```

`ShaderBackdrop` mounts a clip-space quad with `depthTest: false`,
`depthWrite: false`, `renderOrder = -1000`, so it sits behind the procedural
island geometry as a moving painted backdrop. Don't try to put any of these
on a sky dome — they're screen-space ray-marchers and the result is gibberish
on a curved surface.

License: all four are CC BY-NC-SA 3.0. Attribution is preserved in each
shader file header. **Do not use commercially without re-licensing.**

---

## 10. Dispose ordering — common pitfalls

The runtime guards in `lib/runtimeGuards.ts` paper over the worst dispose
races (Skeleton.update bone-stale, FBXLoader.load no-onError) but they are a
safety net, not a license to be sloppy. The correct order is:

1. Cancel any animation frames / mixers ticking the mesh.
2. Detach BVH if the mesh has terrain-like geometry.
3. Remove the mesh from its parent group.
4. Dispose the geometry.
5. Dispose all materials (and their map textures, if owned).
6. Dispose any RenderTargets you allocated.

`buildIslandScene()` returns an `IslandScene` whose `dispose()` does this in
the right order for every component it owns. Reuse it.

---

## 11. UUIDs & generation best practices

The procgen pipeline lives or dies on **reproducibility**. A player's "Bone
Skerry" must look identical in their save file three months from now and on
their friend's machine. The rules below make that possible.

### 11.1 Two flavours of ID — pick by intent

Use `client/src/lib/ids.ts`:

```ts
import { randomId, deterministicId, mulberry32, childSeed } from '@/lib/ids';
```

| Function            | When to use                                                                     | Reproducible? |
| ------------------- | ------------------------------------------------------------------------------- | ------------- |
| `randomId()`        | Runtime / session entities — sockets, in-memory caches, ephemeral UI state.     | **No**        |
| `deterministicId()` | Procgen content — islands, harbours, resource nodes, NPC spawns, prop placements. | **Yes**     |

**Procgen content MUST use `deterministicId`.** Save/reload depends on it:
the game stores only the seed and recomputes everything; if ids drift between
runs the player loses references.

**Runtime ephemera SHOULD use `randomId`.** It's `crypto.randomUUID()` (v4
UUID) under the hood — guaranteed-unique across sessions, secure RNG, no
dependency. Falls back to a manual v4 from `crypto.getRandomValues` on the
ancient browsers we don't support but defend against anyway.

### 11.2 Hierarchical, namespaced ids

Procgen ids should encode their lineage so they're greppable in logs and
collision-safe across categories:

```
deterministicId('island', 12345)
  → 'island:12345:5b3d9f01'

deterministicId('harbour', 'tropical:12345', 3)
  → 'harbour:tropical:12345:3:9c0e7d12'

deterministicId('resource', 'tropical:12345', 'iron-vein', 7)
  → 'resource:tropical:12345:iron-vein:7:a4f02d80'
```

The trailing 8-char hash makes collisions astronomically unlikely (≈ 0.01%
chance of one collision per million entities per namespace), while the
human-readable prefix means you can `rg 'harbour:tropical:12345'` and find
every harbour on a specific island in your save data.

`buildIslandScene()` already does the right thing: it passes
`namespace: \`${biome}:${seed}\`` into `findHarbours()`, so harbour ids look
like `harbour:tropical:12345:3:<hash>` and stay stable across reloads.

### 11.3 NEVER `Math.random()` in procgen

Procgen with `Math.random()` is a footgun: same input → different output every
run, save files become noise. Use `mulberry32` (a small, fast, seedable PRNG)
instead:

```ts
import { mulberry32, childSeed } from '@/lib/ids';

const islandSeed = 12345;
const rng        = mulberry32(islandSeed);

const x      = rng();              // [0, 1)
const angle  = rng() * Math.PI*2;  // [0, 2π)
const choice = arr[Math.floor(rng() * arr.length)];
```

`Math.random()` is fine for one-off UI sparkle, ephemeral particle jitter,
and anything the player cannot save/reload. Anywhere a save file's contents
depend on the value, **use a seeded RNG**.

### 11.4 Subsystem RNG isolation via `childSeed`

If `trees`, `harbours`, and `enemies` all share one RNG stream, adding a tree
will shift every subsequent harbour and enemy roll. Bug magnet. Derive a
child seed per subsystem:

```ts
const islandSeed   = 12345;
const treeRng      = mulberry32(childSeed(islandSeed, 'trees'));
const harbourRng   = mulberry32(childSeed(islandSeed, 'harbours'));
const enemyRng     = mulberry32(childSeed(islandSeed, 'enemies'));
```

Now adding a tree changes only the tree stream; harbours and enemies are
unchanged. `childSeed(parent, label)` is FNV-1a of `${parent}:${label}` —
deterministic, fast, no collisions for label-spaces under ~10⁵ entries.

### 11.5 Seeds are 32-bit ints, not floats

Floats survive JSON roundtrips poorly (precision loss past 2⁵³, locale
issues). Heightmap, biome, harbour, and enemy seeds are all `number` typed
but **must** be 32-bit unsigned integers in practice. The `IslandHeightmap`
options enforce this; `mulberry32` and `fnv1a` both accept any number but
internally `>>> 0` to a uint32.

If you need to derive a seed from a string (level name, faction id, user
input), pass it through `fnv1a()` first.

### 11.6 ID stability across sorts/filters

A common bug: assign id by array index, then sort the array → ids no longer
match the entities you saved. **Bind the id to a stable property of the
entity, not its current position in a list.**

`HarbourNode.id` is bound to `spokeIndex` (the original CCW spoke around the
perimeter), not to the score-sorted rank. The array gets re-sorted by score,
but `nodes.find(n => n.id === savedId)` keeps working.

### 11.7 Do not introduce a UUID dependency

`uuid`, `nanoid`, and `@paralleldrive/cuid2` are all NOT installed and
should not be added. `crypto.randomUUID()` is built into every browser this
project supports and into Node 18+. The 30-line `randomId()` in `lib/ids.ts`
is the only abstraction you need.

---

## 12. Where to add new code

| You want to…                                | Add it here                                              |
| ------------------------------------------- | -------------------------------------------------------- |
| New biome (visual-only)                     | New entry in `IslandSceneBuilder.BIOMES`                 |
| New heightmap shape                         | `IslandHeightmap.ts` — extend `shape` union              |
| New sea creature                            | `SeaCreatures.ts` — pick the band                        |
| New harvest resource node                   | `landscapeAssets.ts`, scatter via `instancedScatter.ts`  |
| New harbour scoring metric                  | `IslandHarbours.scoreNode()`                             |
| New pathfinding cost factor                 | `IslandHeatmap` options                                  |
| New water shader                            | DON'T — extend `SeascapeOcean` or `DynamicOcean`         |
| New sky backdrop                            | `lib/shaders/skyShaders/` — drop in a vendored fragment  |
| Custom terrain (not an island)              | `lib/terrainV2/` — `Hill` / `DiamondSquare` / `Layered`  |
| New marine AI behavior                      | `lib/ai/MarineYukaSystem.ts` — extend `MarineRole`       |
| New land animal                             | `lib/islandAnimals.ts` — extend `AnimalType` + carcass   |
| New ground texture layer                    | `lib/terrain/SplatGroundMaterial.ts` — biome layer pack  |

---

## 13. Water Nodes & Marine AI

The seabed is covered by a deterministic grid of **WaterNodes**, parallel to
land-side **HarbourNodes**. Each node sits inside one of three underwater
bands (SHALLOW / MID / DEEP) and serves as an anchor for marine AI:

```ts
import { buildWaterNodes, nodesByBand } from '@/lib/islandsCanonical';

const nodes = buildWaterNodes({
  heightmap, worldSize: 512,
  namespace: `${biome}:${seed}`,         // deterministic ids
  perBand: { SHALLOW: 8, MID: 12, DEEP: 6 },
});
const midNodes = nodesByBand(nodes, 'MID');
```

Yuka-driven marine AI lives in `client/src/lib/ai/MarineYukaSystem.ts`,
parallel to `yukaEnemyAI.ts` for land enemies. Two roles:

- **`wanderer`** — `WanderBehavior` + auto-reseeded anchor when the entity
  reaches its current WaterNode. Result: fish drift purposefully toward
  random points in their band, repeat.
- **`predator`** — same wander base, BUT every `HUNT_ROLL_INTERVAL_MS`
  (5 minutes) rolls a `HUNT_ROLL_CHANCE` (5 %) chance to enter a hunt:
  pick the nearest non-predator entity inside `huntRadius`, switch to
  Seek, fire `onPredatorHit` on contact, return to wander. These two
  numbers match `seaCreatureSystem.ts` exactly so dual systems behave
  identically — change them in **both** files or neither.

```ts
import { MarineYukaSystem } from '@/lib/ai/MarineYukaSystem';

const marine = new MarineYukaSystem(`${biome}:${seed}`);
marine.setWaterNodes(nodes);

// Spawn 30 random fish in MID band
for (const fishMesh of fishMeshes) {
  marine.register({
    mesh: fishMesh, role: 'wanderer', band: 'MID', maxSpeed: 2.5,
  });
}

// Spawn 2 sharks in DEEP, 5 % / 5 min hunt roll
for (const sharkMesh of sharkMeshes) {
  marine.register({
    mesh: sharkMesh, role: 'predator', band: 'DEEP',
    maxSpeed: 6, huntRadius: 80,
    onPredatorHit: (prey) => damageSystem.kill(prey.id),
  });
}

// Tick in your render loop
marine.update(deltaSec);
```

Y is auto-clamped per band — a SHALLOW reef fish can never drift down into
the abyss even if Yuka steers it there.

---

## 14. Splat Ground Textures

The canonical `IslandSceneBuilder.makeBiomeMaterial()` produces a
3-zone altitude blend (beach / ground / cliff). For richer surfaces, use
`client/src/lib/terrain/SplatGroundMaterial.ts` — a 4-layer splat shader
with biome-specific layer rosters:

| Biome      | Layer 1 | Layer 2 | Layer 3 | Layer 4 (biome-specific) |
| ---------- | ------- | ------- | ------- | ------------------------ |
| tropical   | sand    | grass   | rock    | mud                      |
| grassland  | sand    | grass   | rock    | earth                    |
| volcano    | sand    | ash     | rock    | **lava stone**           |
| tundra     | sand    | grass   | rock    | **snow**                 |
| desert     | sand    | scrub   | rock    | drift sand               |

Blend masks per fragment:

```
sand   = smoothstep( 1.5, -0.5, h)              // anything near sea level
rock   = slope > ~0.4  OR  h > 18..28           // steep OR high
grass  = 1 - sand - rock - layer4               // fills the rest
layer4 = smoothstep around biome-specific Y range
```

Usage:

```ts
import {
  makeSplatGroundMaterial, loadBiomeSplatTextures, DEFAULT_BIOME_PALETTES,
} from '@/lib/terrain/SplatGroundMaterial';

const textures = await loadBiomeSplatTextures('volcano');   // optional
const mat = makeSplatGroundMaterial({
  biome:    'volcano',
  colors:   DEFAULT_BIOME_PALETTES.volcano,
  textures,                      // {} → flat-color fallback, no error
  sunDir:   sky.material.uniforms.uSunDir.value,   // shared ref!
  sunCol:   sky.material.uniforms.uSunColor.value, // shared ref!
});
```

Texture pack convention (relative to `public/`):

```
/textures/ground/<biome>/sand.jpg
/textures/ground/<biome>/grass.jpg
/textures/ground/<biome>/rock.jpg
/textures/ground/<biome>/layer4.jpg     ← lava-stone for volcano,
                                          snow for tundra, etc.
```

Missing files **don't** crash — the layer silently falls back to its
flat color. A fresh checkout with no PBR pack still renders cleanly.

---

## References

- `client/src/lib/terrain/RULES.md` — the short rule sheet.
- `client/src/lib/islandsCanonical/` — every canonical module.
- `replit.md` — top-level project memory; tracks user prefs and stack.
- `CONSOLIDATION_NOTES.md` — asset path audit and migration log.
