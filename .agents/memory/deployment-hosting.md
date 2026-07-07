---
name: Live hosting topology
description: Where this project is actually deployed in production (overrides the .replit config).
---

# Production hosting is NOT Replit-native

Despite `.replit` declaring `deploymentTarget = "autoscale"`, the user does NOT
publish through Replit. Actual production topology:

- **Backend (Express)** → Railway
- **Frontend** → Vercel (static build of the Vite client)
- **Domains / DNS** → Cloudflare

**Why this matters (apply before giving deploy/hosting advice):**
- Do not tell the user to "publish on Replit" or assume a `*.replit.app` URL for
  production. Replit is dev/workspace only.
- Frontend and backend are deployed **separately** (split origin), so CORS + an
  absolute API base URL matter — the single-port Vite+Express dev setup does not
  reflect prod.
- The Replit **Object Storage** asset pipeline (`server/cdnFallback.ts`,
  bucket in `.replit`) depends on Replit's sidecar credentials and will NOT work
  on Railway unmodified. Heavy assets need another CDN/origin (or the bucket must
  be made publicly reachable) for the Railway/Vercel deploy.
- Railway supports long-running processes, so the in-process Open World WS server
  (`server/openWorld.ts`) can be always-on there — but roster/uptime are still
  in-memory (reset on redeploy/crash); persistence needs a real store.
