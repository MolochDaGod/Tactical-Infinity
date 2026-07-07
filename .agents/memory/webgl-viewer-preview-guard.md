---
name: WebGL viewer preview guard
description: Why 3D viewer pages must tolerate WebGL context-creation failure
---

The Replit app-preview/screenshot browser frequently cannot create a WebGL2
context ("Error creating WebGL context." thrown from `new THREE.WebGLRenderer`).
An unguarded `createOptimalRenderer()` call inside a `useEffect` throws, which
unmounts the whole React tree and the page screenshots as a blank background —
looking like a broken page when it is really an environment limitation.

**Rule:** On any page that creates a `WebGLRenderer`, wrap the creation in
try/catch. On failure, set an error flag, clear any `loading` state, and render a
lightweight fallback overlay so the surrounding UI (pickers, lists) still works.
The real browser is unaffected.

**Why:** Repeatedly wasted a screenshot cycle thinking the new page was broken
when the same `createOptimalRenderer` already powers working pages. The blank
screenshot is diagnostic of context exhaustion, not a code bug.

**How to apply:** New Three.js viewer pages (UnitViewer, RaceCharacterViewer,
admin testers) — guard renderer init and don't gate the whole page on a live GL
context.
