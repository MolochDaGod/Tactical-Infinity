# Production water SPA deploy (water.grudge-studio.com)

**Product host:** https://water.grudge-studio.com  
**Repo:** Tactical-Infinity (legacy name)  
**Do not** use tactical-infinity.vercel.app or Replit as production.

## 2026-07 production pass (grudge6 · sail · seeds)

| Fix | Detail |
|-----|--------|
| Boat boarding | grudge6 `CharacterBuilder` — Meshy removed |
| World map Meshy | Default **off** |
| `/api/meshy` | Removed from production vercel rewrites |
| Sail polar | Uses player boat id (not hardcoded sloop) |
| Home island nodes | Seeded rotations / waves (seed 42) |
| Fleet shells | `islandFleetSeeds.ts` + world map tags from `island_fleet_seeds.json` |

## Deploy checklist

```bash
cd F:\GitHub\Tactical-Infinity

# 1. Typecheck / build
npm run build

# 2. Production deploy (Vercel project linked to water.grudge-studio.com)
npx vercel deploy --prod --yes

# Or: git push origin main  (if Git integration deploys this project)

# 3. Smoke
# HEAD https://water.grudge-studio.com/
# HEAD https://water.grudge-studio.com/island
# GET  https://water.grudge-studio.com/api/health
# Play: captain on deck = grudge6 race; world map M; wind sail polar
```

## Env (Vercel production)

| Var | Value |
|-----|--------|
| `VITE_USE_ASSETS_CDN` | `true` |
| `VITE_ASSETS_CDN_URL` | `https://assets.grudge-studio.com` |
| `VITE_APP_ORIGIN` | `https://water.grudge-studio.com` |
| `VITE_ENABLE_MESHY` | unset / false (production) |

## Skills

- `grudge-warlords-assets` — CDN + no Meshy  
- `grudge6-modular-characters` — Bip001 captains  
- `docs/WATER_SPA_SKILLS_REVIEW.md` (gameopen) — prior audit  
