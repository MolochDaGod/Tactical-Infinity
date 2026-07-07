---
name: Shared envMap disposal in UnitCharacter
description: Why UnitCharacter.dispose() must skip the envMap texture when many characters share one PMREM env map.
---

`UnitCharacter.dispose()` (client/src/lib/character/UnitGLBLoader.ts) walks every
material and disposes each `THREE.Texture` it finds. It MUST skip the `envMap`
key.

**Why:** Callers (e.g. Barracks lineup) pass ONE shared PMREM env map into every
`UnitCharacter.load({ envMap })`. If dispose() disposes that texture, tearing down
a single character (class swap, or a stale async load) invalidates the env map for
all remaining characters and the scene environment. The env map is externally
owned — the loader did not create it, so it must not free it.

**How to apply:** Any shared/externally-owned texture handed to a per-instance
loader must be excluded from that instance's dispose loop. When adding new texture
slots that can be shared (e.g. a shared lightmap or IBL), exclude them too.
