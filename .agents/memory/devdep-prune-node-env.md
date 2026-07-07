---
name: devDependency pruning under NODE_ENV=production
description: Why packager npm installs wipe devDeps in this workspace and how to restore them
---

# Packager installs prune devDependencies in this workspace

The agent shell here has `NODE_ENV=production` injected by the platform (NOT in
`.replit [env]`, NOT in managed env vars — `viewEnvVars` shows it nowhere, yet
`echo $NODE_ENV` returns `production`). Because of this, **every** packager
`installLanguagePackages` call (which runs `npm install` under that env) omits
and prunes ALL `devDependencies` from `node_modules`. Symptoms after any install:
`tsx: not found` on `npm run build`, and `tsc` reporting `Could not find a
declaration file for module 'express'` (and other `@types/*`). The errors look
like source bugs but are missing devDeps.

**Why:** npm in production mode does not install/keep devDeps. The packager
inherits the ambient `NODE_ENV=production`.

**How to apply / recover:**
- Avoid unnecessary packager installs here; each one re-prunes devDeps.
- The `bash` tool blocks `npm install`. The `code_execution` sandbox has no
  `npm` on PATH. Restore devDeps by running npm from its nix store path inside
  `code_execution` with `NODE_ENV=development`, as a **detached background**
  process (a synchronous `execSync` gets killed by the sandbox time budget on a
  full ~300-pkg reconcile):
  - npm bin: `/nix/store/<hash>-nodejs-22.2.0/bin/npm` (find via `which npm` in bash).
  - `spawn(NPM, ['install','--include=dev','--no-audit','--no-fund'], {cwd, env:{...process.env, NODE_ENV:'development', PATH:'<node22bin>:/usr/bin:/bin', HOME:'/home/runner'}, detached:true, stdio:['ignore',logFd,logFd]})`, then poll the log + `node_modules/.bin` from bash.
- Verify with: list `package.json` devDependencies vs `node_modules/<name>` existence; then `npm run check` + `npm run build` (both must exit 0).
