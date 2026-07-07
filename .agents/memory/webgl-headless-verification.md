---
name: WebGL pages can't be verified headlessly
description: Why 3D/Three.js + PixiJS pages can't be screenshot/Playwright-tested in this env
---

The Replit headless screenshot + Playwright/testing tooling **cannot create a WebGL
context** in this environment. Any page that mounts a `THREE.WebGLRenderer` or a
PixiJS canvas (sailing, /islands, /world-map, battle, etc.) renders blank/black
headlessly and cannot be visually verified by the agent.

**How to apply:** For 3D/canvas work, verify via `npm run check` (tsc), `npm run build`,
and the dev-server console logs (no runtime JS errors) instead of screenshots. State
plainly that visual confirmation needs the human in a real browser — do not claim a
3D scene "looks correct" from a screenshot you couldn't actually capture.
