---
name: Stylized & landscape asset packs are absent by design
description: Why public/models/stylized and public/textures/landscape are empty and the console logs "asset unavailable" fallbacks
---

The stylized vegetation/rock GLB packs (`/models/stylized/*.glb`, registered in
`stylizedAssetRegistry.ts`) and the legacy landscape tree textures
(`/textures/landscape/*.png`, in `landscapeAssets.ts`) are **not present** in the
repo — the dirs are empty and the files are not in `shared/cdnManifest.json`
(so absent in prod too). They were imported into `attached_assets/` in a past
session and later rotated out. The world **intentionally** falls back to
procedural geometry/textures via each loader's `knownDead` HEAD-probe set.

**Do not** treat the "asset unavailable, using fallback" logs as a bug or chase
the missing files unless the user re-provides them. If they want the nicer
stylized trees/rocks/textures back, they must re-upload the packs (then run
`scripts/uploadAssetsToBucket.ts` to push to the CDN bucket).

**Why:** avoids re-diagnosing empty asset dirs as breakage. The loaders are
built to degrade gracefully; the only real symptom is console noise, which is
now consolidated into one summary line per loader instead of one line per asset.
