---
name: Deploy fails at nix layer caching despite a healthy build
description: How to recognize a Replit-infra deploy failure (nix store corruption) vs a real code/build bug
---

# Deploy "failed to publish" can be infra, not your build

Symptom: a publish fails even though `npm run build` succeeds locally AND in the
deploy logs. In the deploy build log the client + server build complete
(`bundle verified: no unbundled runtime modules`), all layers push, and the
failure is the LAST line:

```
verifying nix store path integrity before caching layer
fatal: failed to push layers: nix layer integrity verification failed,
refusing to cache: corrupt nix store paths:
/nix/store/<hash>-nodejs-22.2.0: expected sha256-... got sha256-...
```

**What it means:** the on-disk content of a cached Nix system package
(here `nodejs-22.2.0`, pulled in via `nodePackages_latest.nodejs` in
`.replit [nix]`) does not match its expected NAR hash — Replit-side nix store
corruption. Not caused by app code, `package.json`, `script/build.ts`, or the
devDep-prune issue.

**How to apply / diagnose:**
- Use the deployment skill callbacks `listDeploymentBuilds()` + `getDeploymentBuild(id)`;
  read the LAST log lines (the asset-chunk listing is long and pushes the real
  error off a truncated tail — slice the very end).
- If the build phase finished and the fatal is at "verifying nix store path
  integrity", stop debugging code.
- Fixes (in order): retry publish once; if it repeats identically (persistent
  corruption), contact Replit support to clear the corrupt cached layer; a
  cache-bust by changing `.replit [nix]` (e.g. dropping redundant node entries —
  this repl declared three: `nodePackages_latest.nodejs`, `nodejs-slim_18`,
  `nodejs-slim`) can force a fresh nix-0 eval, but editing `.replit` affects the
  dev environment so get user consent first.
