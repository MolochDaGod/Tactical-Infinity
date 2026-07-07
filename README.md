# Tactical Infinity (Tethical)

Open-world tactical RPG satellite for the [Grudge Warlords](https://grudgewarlords.com) fleet — captain creation, home-island raft building, wind-driven sailing, and world-map exploration in Three.js.

**Production:** [https://water.grudge-studio.com](https://water.grudge-studio.com)

## Live URLs

| Surface | URL | Platform |
|---------|-----|----------|
| **Game client (production)** | [water.grudge-studio.com](https://water.grudge-studio.com) | Vercel (Nexus Server) |
| **Preview / CI** | `tactical-infinity-*.vercel.app` | Vercel |
| **Tactical game API** | `api.tactical-infinity.up.railway.app` | Railway |
| **Characters / island / wallet SSOT** | `grudge-api-production-0d46.up.railway.app` | Railway (GrudgeBuilder) |
| **Auth gateway** | [id.grudge-studio.com](https://id.grudge-studio.com) | Vercel |
| **Asset CDN** | [assets.grudge-studio.com](https://assets.grudge-studio.com) | Cloudflare R2 |
| **Production shell** | [grudgewarlords.com](https://grudgewarlords.com) | Vercel |

## Architecture

Tactical-Infinity is the **3D engine front-end**. Persistent player data lives on the GrudgeBuilder Railway Postgres API; Tactical-specific APIs (battles, Meshy, roster, harvest) live on a separate Tactical Railway service.

```
Browser @ water.grudge-studio.com (Vercel SPA)
  │
  ├─ /api/auth/*        → id.grudge-studio.com          (Grudge ID / guest / SSO)
  ├─ /api/characters/*  → GrudgeBuilder Railway           (captain SSOT)
  ├─ /api/island/*      → GrudgeBuilder Railway           (home island state)
  ├─ /api/wallet/*      → GrudgeBuilder Railway
  ├─ /api/battles/*     → Tactical Railway                (battle sim)
  ├─ /api/meshy/*       → Tactical Railway                (AI captain heads)
  ├─ /models/*          → assets.grudge-studio.com        (R2 CDN)
  └─ /toon_rts/*        → assets.grudge-studio.com        (Toon-RTS FBX tree)
```

Rewrites are defined in [`vercel.json`](vercel.json). The browser always calls same-origin `/api/*`; Vercel routes each prefix to the correct backend.

### Onboarding flow

```
Menu → Create Captain → Home Island (build raft) → World Map
```

- **Captain** persists to `POST /api/characters` (warlords era, `grudge6` model3d) via [`client/src/lib/grudgeCharacterSync.ts`](client/src/lib/grudgeCharacterSync.ts).
- **Raft** is the first buildable boat (`BOAT_BUILD_ORDER` in `playerProgression.ts`).
- **World map** unlocks after the home-island raft is built.

### Boat ladder

`raft` → `skiff` → `sloop` → `brigantine` → `galleon`

## Repository layout

| Path | Purpose |
|------|---------|
| `client/` | React + Three.js SPA (Vite) |
| `server/` | Express game server (Railway) — battles, Meshy, open-world WS |
| `shared/` | Boat registry, fleet bridge, game definitions |
| `vercel.json` | Production rewrites + build env |
| `railway.toml` | Tactical Railway deploy config |

## Local development

```bash
git clone https://github.com/MolochDaGod/Tactical-Infinity.git
cd Tactical-Infinity
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:5000`. For CDN assets in dev, set `VITE_USE_ASSETS_CDN=true` in `.env`.

## Deployment

### Vercel (frontend → water.grudge-studio.com)

| Setting | Value |
|---------|-------|
| Team | Nexus Server (`grudgenexus`) |
| Project | `tactical-infinity` |
| Framework | Other |
| Build command | `npm run build` |
| Output directory | `dist/public` |
| Install command | `npm install --legacy-peer-deps` |
| Production branch | `main` |

**Build-time env vars** (Vercel → Project → Environment Variables):

```
VITE_USE_ASSETS_CDN=true
VITE_ASSETS_CDN_URL=https://assets.grudge-studio.com
VITE_WARLORDS_URL=https://grudgewarlords.com
```

**DNS** (Cloudflare `grudge-studio.com` zone):

| Type | Name | Target | Proxied |
|------|------|--------|---------|
| CNAME | `water` | `cname.vercel-dns.com` | Yes |

Pushes to `main` auto-deploy via the GitHub → Vercel integration.

### Railway (Tactical game API)

Deploy this repo as a Railway service (separate from GrudgeBuilder):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Tactical Postgres (battles, roster, harvest) |
| `CORS_ORIGINS` | Must include `https://water.grudge-studio.com` |
| `MESHY_API_KEY` | Optional AI captain head generation |
| `PORT` | `5000` (default) |

Health check: `GET /api/health` (see `railway.toml`).

GrudgeBuilder Railway (`grudge-api-production-0d46.up.railway.app`) is **not** deployed from this repo — it is owned by [GrudgeBuilder](https://github.com/MolochDaGod/GrudgeBuilder). Tactical-Infinity reaches it through Vercel rewrites only.

## Fleet integration checklist

When adding a new Grudge Studio subdomain:

1. Add CNAME in Cloudflare → `cname.vercel-dns.com`
2. Add domain in Vercel project settings
3. Append origin to Railway `CORS_ORIGINS` (Tactical service)
4. Append origin to GrudgeBuilder `CORS_ORIGINS` if calling Railway directly in dev

## Key modules

| Module | Role |
|--------|------|
| `client/src/lib/grudgeCharacterSync.ts` | Auth bootstrap + captain POST/activate/hydrate |
| `client/src/lib/grudgeFleetBridge.ts` | Canonical fleet URLs + API paths |
| `client/src/lib/grudgeAssetConfig.ts` | CDN resolution, IslandSky backdrops |
| `client/src/lib/playerProgression.ts` | Onboarding steps, boat build ladder |
| `client/src/pages/ProductionIsland.tsx` | Home island (Waterfall Isle) |
| `shared/gameDefinitions/boatRegistry.ts` | Canonical boat IDs |

## Grudge Studio fleet

Part of the [Grudge Studio](https://grudge-studio.com) game fleet. Characters and island state are shared with Grudge Warlords — a captain created in Tactical-Infinity appears in the warlords roster for the same Grudge ID account.

## License

MIT