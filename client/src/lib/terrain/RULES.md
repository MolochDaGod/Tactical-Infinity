# Terrain Rules — Tethical / Grudge Warlords

Canonical conventions for everything that touches terrain in this codebase:
heightmaps, chunks, raycasting, picking, and unit-on-ground placement.

> Why this file exists: the codebase has two terrain pipelines (`terrainV2` and
> `islandsCanonical`), three legacy modules, and a 38 MB asset tree. Without
> rules, ad-hoc raycasts get tacked onto each new feature, every one of them
> O(n), and the frame budget bleeds out one hover-event at a time. These rules
> consolidate the fix.

---

## 1. Pipelines — pick one, don't mix

| Use case                                     | Pipeline                                      |
| -------------------------------------------- | --------------------------------------------- |
| `/islands` route, default island scenes      | `lib/islandsCanonical/IslandSceneBuilder.ts`  |
| Custom heightmap experiments, dock pads,     | `lib/terrainV2/`                              |
| volcano calderas, dev tools                  |                                               |
| `OpenWaterSailing`, `IslandBattlePage` (old) | `lib/terrainGenerator.ts` (deprecated, in use)|
| `BattleGrounds` 2D tactical                  | PixiJS, not relevant here                     |

**Don't introduce a third pipeline.** If you need a new feature, add it to one
of the two canonical paths.

---

## 2. Geometry conventions

- **Up axis**: world +Y. Heightmaps store world-space Y at each cell.
- **Cell layout**: row-major, `data[z * stride + x]`.
- **Chunk size**: `IslandChunks` defaults to 4×4 chunks. Don't go above 8×8 —
  the BVH build cost dominates beyond that for static islands.
- **PlaneGeometry orientation**: built XY-plane then rotated `-PI/2` around X.
  When you write displacement *before* rotation, write to `position.z`. When
  you write *after* rotation, write to `position.y`. `terrainV2/apply.ts`
  takes a `writeAxisY` flag — pick one and stick with it for the lifetime of
  the geometry.
- **Vertex normals**: always call `geom.computeVertexNormals()` after
  displacement. The grass/water/PBR shaders assume per-vertex normals.

---

## 3. Raycasting — must use BVH

Every terrain mesh that will be raycast more than ~3 times in its lifetime
**must** have a BVH attached.

```ts
import { attachBVH, attachBVHToGroup, TerrainPicker } from '@/lib/terrain/raycast';

// After building chunks:
attachBVHToGroup(islandChunks.group);

// In your scene init:
const picker = new TerrainPicker([islandChunks.group]);

// In a click handler:
const hit = picker.pickFromMouse(ev, camera, renderer.domElement);
if (hit) moveUnitTo(hit.point);

// In an update tick (foot-on-ground):
const y = picker.heightAt(unit.position.x, unit.position.z);
if (y !== null) unit.position.y = y;
```

Hard rules:

1. **Never** call `new THREE.Raycaster()` in a per-frame loop. Construct one
   `TerrainPicker` per scene and reuse it. (The picker holds an internal
   raycaster.)
2. **Never** call `intersectObjects` against `scene.children` — it walks the
   whole graph including non-terrain meshes, particles, and HUD billboards.
   Always pass an explicit list of terrain roots.
3. **Always** call `attachBVH(mesh)` (or `attachBVHToGroup(group)`) right after
   you finish mutating the geometry. If you mutate the geometry afterwards
   (e.g. erosion pass, in-game digging), call `detachBVH(mesh)` first then
   re-attach.
4. **Always** call `detachBVH(mesh)` before `mesh.geometry.dispose()` —
   leaving the BVH attached leaks the typed arrays that back the tree.
5. The picker's raycaster has `firstHitOnly = true`. If you actually need every
   intersection along the ray (rare — usually for x-ray vision or projectile
   passthrough), construct your own raycaster.

---

## 4. Heightmap height queries vs. raycasts

You almost always want `heightmap.sampleWorld(x, z)` instead of a raycast:

| When to use a raycast (BVH)                       | When to use the heightmap          |
| ------------------------------------------------- | ---------------------------------- |
| User clicked on the canvas — need a world point   | Per-tick foot-on-ground for units  |
| AI line-of-sight against deformed/loaded geometry | Drawing the minimap                |
| Picking against ships, props, NPCs (non-terrain)  | Spawning vegetation                |
| Geometry that diverges from the heightmap         | Pathfinding cost from slope        |

Raycasts are O(log n) but still allocate intersection objects and sample the
GPU-side mesh. Heightmap lookups are a single bilinear sample of a Float32Array.
Use the heightmap path whenever the answer is "what's the ground height at
(x, z)" and you trust the heightmap to match the rendered geometry.

`generateIslandTerrainV2()` returns `getHeightAt`, `getSlopeAt`, `getNormalAt`
that read from the source heightmap directly — use those.

---

## 5. Asset rules

- Browser-shipped runtime root is `public/`.
- Use canonical URLs (`/toon_rts/...`, `/buildings/FBX/...`, `/animations/...`,
  `/fish/...`, `/models/...`, `/textures/...`). The legacy `/3dassets/...`
  prefix is **gone** as of April 2026 — pointing new code at it will 404.
- A 502 on a large GLB/FBX from the dev server usually means the Express
  static middleware was busy serving another large asset on the same
  connection. It is **not** a missing-file bug. Verify with `ls public/...`
  before chasing it. Fix is to defer non-critical loads and/or split asset
  loads across separate requests rather than bursting in parallel.

---

## 6. Adding a new terrain feature — checklist

Before you ship a PR that adds a new island scene, biome, or terrain effect:

- [ ] Heights flow through one of the two canonical pipelines, not a fresh
      private generator.
- [ ] Every terrain mesh has a BVH attached (use `attachBVHToGroup`).
- [ ] Every scene exposes a `TerrainPicker` to its consumers (don't make them
      build their own).
- [ ] Per-tick height queries use `heightmap.sampleWorld()`, not raycasts.
- [ ] Geometry disposal calls `detachBVH(mesh)` before `geom.dispose()`.
- [ ] No new path under `/3dassets/`; assets live in `public/`.
- [ ] If you added a terrain knob (max height, biome, dock), it's surfaced in
      `terrainV2`'s `IslandTerrainV2Options` or in the canonical
      `IslandSceneBuilder` options — not as a magic constant in a scene.

---

## 7. Reference module map

```
lib/terrain/
  raycast.ts                ← THIS FILE — only place that imports three-mesh-bvh
  RULES.md                  ← you are reading it

lib/terrainV2/
  index.ts                  ← generateIslandTerrainV2()
  heightmap.ts              ← Heightmap class with sampleWorld / slopeAtWorld
  algorithms.ts             ← diamondSquare, hill, layeredPerlin, ridged, ...
  influences.ts             ← raise/flatten/blend regions (dock pads, calderas)
  easing.ts                 ← shared easing curves
  apply.ts                  ← Heightmap → PlaneGeometry vertex displacement

lib/islandsCanonical/
  IslandSceneBuilder.ts     ← buildIslandScene() — composes everything below
  IslandHeightmap.ts        ← multi-octave fBm + ridge + radial falloff
  IslandChunks.ts           ← chunk grid + per-chunk LOD billboards
  IslandSky.ts              ← sky dome + weather/time presets
  IslandWeatherOverlay.ts   ← rain/lightning post-process pass
  SeascapeOcean.ts          ← Seascape-derived water material
  SeaCreatures.ts           ← depth-banded marine life spawner
```

The rule is: **callers stay in their lane.** A scene file should call
`buildIslandScene()` or `generateIslandTerrainV2()` plus `attachBVHToGroup()`
plus `new TerrainPicker(...)` and that's it. Anything beyond that is a
candidate for promotion into one of the canonical modules.
