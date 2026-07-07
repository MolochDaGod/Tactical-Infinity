# Tethical: Grudge Warlords — Cloudflare Deployment Guide

## Architecture Overview

Tethical is a **React SPA + Express API** application. For Cloudflare deployment, it splits into:

| Layer | Service | What It Serves |
|-------|---------|----------------|
| **Frontend** | Cloudflare Pages | React SPA static files (`dist/public/`) |
| **API** | Cloudflare Workers | Express backend (`dist/index.cjs`) converted to Worker |
| **Game Data** | ObjectStore API | Static JSON from `molochdagod.github.io/ObjectStore` (external, no auth) |
| **Assets** | Cloudflare R2 / Pages | 3D models, textures, sprite sheets |
| **Auth/Storage** | Puter.js | Client-side auth and KV storage (runs in browser, no server needed) |

---

## Quick Start: Cloudflare Pages (Static SPA)

The simplest deployment — serves the frontend as a static site. The Express backend isn't needed if all game data comes from ObjectStore + Puter.js.

### 1. Build the Frontend

```bash
npm run build
```

This produces:
- `dist/public/` — Static SPA files (HTML, JS, CSS, assets)
- `dist/index.cjs` — Server bundle (only needed for Worker deployment)

### 2. Deploy to Cloudflare Pages

**Option A: Wrangler CLI**
```bash
npx wrangler pages deploy dist/public --project-name tethical
```

**Option B: Git Integration (recommended)**
1. Push code to GitHub/GitLab
2. In Cloudflare Dashboard → Pages → Create project → Connect repository
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist/public`
   - Root directory: `/` (project root)

### 3. Environment Variables

Set these in Cloudflare Pages dashboard → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_VERSION` | `20` | For build step |
| `VITE_OBJECTSTORE_URL` | `https://molochdagod.github.io/ObjectStore/api/v1` | Game data API (already hardcoded, optional override) |

### 4. SPA Routing

Create `public/_redirects` for client-side routing:
```
/*    /index.html   200
```

Or use `public/_headers` for caching:
```
/ui/*
  Cache-Control: public, max-age=31536000, immutable

/models/*
  Cache-Control: public, max-age=31536000, immutable

/textures/*
  Cache-Control: public, max-age=86400

/toon_rts/*
  Cache-Control: public, max-age=31536000, immutable
```

---

## Full Stack: Cloudflare Workers (API + Frontend)

If you need the Express API server (battles, roster generation, mesh AI):

### 1. Install Wrangler

```bash
npm install -D wrangler
```

### 2. Create `wrangler.toml`

```toml
name = "tethical"
main = "dist/index.cjs"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[site]
bucket = "./dist/public"

[vars]
NODE_ENV = "production"

# Optional: D1 database binding (replaces in-memory storage)
# [[d1_databases]]
# binding = "DB"
# database_name = "tethical-db"
# database_id = "<your-d1-id>"

# Optional: R2 bucket for large assets
# [[r2_buckets]]
# binding = "ASSETS"
# bucket_name = "tethical-assets"
```

### 3. Adapt Express for Workers

The Express server uses Node.js APIs. For Cloudflare Workers, you have two options:

**Option A: Use `@hono/node-server` adapter** (minimal changes)
```bash
npm install hono @hono/node-server
```

**Option B: Keep Express + use `cloudflare-workers-adapter`**
This wraps Express to work in Workers. Note: some Node.js APIs may not be available.

### 4. Deploy

```bash
npx wrangler deploy
```

---

## ObjectStore Integration

The game fetches all static data from the Grudge Warlords ObjectStore API:

**Base URL**: `https://molochdagod.github.io/ObjectStore/api/v1`

### Endpoints Used

| Endpoint | Data | Count |
|----------|------|-------|
| `weapons.json` | All weapons with stats, abilities, lore | 119 weapons, 17 categories |
| `weaponSkills.json` | Weapon combat skills with icons | 473 skills, 24 weapon types |
| `classes.json` | Class definitions, abilities, starting attributes | 4 classes |
| `races.json` | Race definitions, faction alignment, bonuses | 6 races |
| `attributes.json` | Core attribute definitions with formulas | 8 attributes |
| `factions.json` | Faction lore, race mappings, patrons | 3 factions |
| `armor.json` | Armor sets by profession | 150 items |
| `materials.json` | Crafting materials (ore, wood, cloth, etc.) | 112 materials |
| `consumables.json` | Foods, potions, engineer items | 132 items |
| `professions.json` | Skill trees, recipes, specializations | 5 professions, 363+ recipes |
| `enemies.json` | Enemy definitions with abilities and drops | 38 enemies, 8 tiers |
| `bosses.json` | Boss mechanics, phases, drops | 12 bosses |
| `items-database.json` | Unified item database with icon URLs | 3,425 items |
| `sprite-characters.json` | 2D animated characters | 275 characters |

### Client-Side Integration

All ObjectStore calls go through `client/src/lib/objectStoreAPI.ts`:
- Cached for 24 hours in-memory
- Fetched lazily when the Magic Book UI opens
- Uses React Query for state management
- No API keys or tokens needed

### Tier System

All equipment uses an 8-tier color system:

| Tier | Name | Color |
|------|------|-------|
| T1 | Common | Gray |
| T2 | Uncommon | Green |
| T3 | Rare | Blue |
| T4 | Epic | Purple |
| T5 | Legendary | Orange |
| T6 | Mythic | Red |
| T7 | Ancient | Yellow |
| T8 | Divine | Pink |

---

## Asset Hosting

### Static Assets in `/public/`

These are bundled with the SPA build:
- `/ui/magic_book/` — Magic book UI sprites and icons
- `/models/docks/` — GLB dock models
- `/textures/terrain/` — 6 terrain texture sets
- `/toon_rts/` — FBX character models and TGA textures

### Large Asset Optimization (Optional)

For better performance, move large assets to Cloudflare R2:

```bash
# Upload models to R2
npx wrangler r2 object put tethical-assets/models/docks/wooden_dock.gltf --file public/models/docks/wooden_dock.gltf

# Upload textures
npx wrangler r2 object put tethical-assets/textures/ --file public/textures/ --recursive
```

Then reference via your R2 custom domain or Workers binding.

---

## Data Flow

```
Player's Browser
  ├── Cloudflare Pages (SPA)
  │     ├── React app, Three.js, PixiJS
  │     └── Static assets (models, textures, sprites)
  │
  ├── ObjectStore API (GitHub Pages)
  │     └── GET weapons, skills, classes, races, factions...
  │         (no auth, cached 24h)
  │
  ├── Puter.js (client-side)
  │     ├── Auth (sign in / guest)
  │     ├── KV Storage (save games, stats)
  │     └── AI services (NPC chat, etc.)
  │
  └── [Optional] Cloudflare Worker API
        ├── Battle calculations
        ├── Roster generation
        └── Server-validated actions
```

---

## Puter.js (Client-Side Cloud)

Puter.js handles auth and storage entirely in the browser — no server-side configuration needed:

- **Auth**: `puter.auth.signIn()` — creates user sessions
- **KV Storage**: `puter.kv.set(key, value)` / `puter.kv.get(key)` — persists game saves
- **AI**: `puter.ai.chat()` — powers NPC dialogue and AI features
- **File Storage**: `puter.fs.write()` — uploads user-generated content

The user pays for their own Puter.js usage — no developer API costs.

---

## Custom Domain

After deploying to Cloudflare Pages:

1. Dashboard → Pages → your project → Custom Domains
2. Add your domain (e.g., `tethical.grudge-studio.com`)
3. Cloudflare handles SSL/TLS automatically
4. DNS records are configured automatically if domain is on Cloudflare

---

## Performance Notes

- **WebGL Required**: The game uses Three.js and requires WebGL 2.0
- **Initial Load**: ~5-8 MB (Three.js + models + textures); use code splitting for scene-specific assets
- **ObjectStore Cache**: Responses cached 24h; game data rarely changes
- **3D Models**: FBX models at `/toon_rts/` are ~50-200KB each; loaded on demand per scene
- **Terrain**: Generated procedurally client-side — no terrain data downloaded

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SPA routes return 404 | Add `_redirects` file: `/* /index.html 200` |
| CORS errors on ObjectStore | ObjectStore allows all origins; check browser extensions |
| WebGL not available | Ensure browser supports WebGL 2.0; mobile Safari may need flags |
| Large build size | Enable gzip/brotli in Cloudflare (automatic); split 3D scenes |
| Puter.js not loading | Ensure `https://js.puter.com/v2/` is not blocked by CSP |
