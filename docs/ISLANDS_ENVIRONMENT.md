# /islands — sky, weather, day/night, assets

**Live:** https://water.grudge-studio.com/islands  
**Code:** `client/src/pages/Islands.tsx` + `client/src/lib/islandsCanonical/*`

## Systems

| System | Module | Role |
|--------|--------|------|
| Terrain | `IslandHeightmap` + `IslandChunks` | Procedural island + LOD tiles |
| Skybox | `IslandSky` | Dome shader: sun disc, FBM clouds, lightning flash |
| Day/night | `DayNightCycle` | Continuous 0..1 dayProgress, sun orbit, colour lerp |
| Weather overlay | `IslandWeatherOverlay` | Rain streaks, mist, lightning shake (post) |
| Water | `SeascapeOcean` | Seascape shader + sun/sky tint |
| Nature assets | `islandAssetLoader` + `warlordsNatureCDN` | Stylized packs (isolate meshName) |
| Captain (walk) | grudge6 `WK_Characters.glb` CDN | **No Meshy** |

## UI controls

- **Biome** — tropical / temperate / volcanic / arctic / desert  
- **Weather** — clear / cloudy / rain / storm / mist  
- **Time of day** pins — dawn / noon / dusk / night (pauses auto cycle)  
- **Auto day/night** — continuous sun orbit (default on)  
- **Day progress** slider — manual time of day  
- **Day length** — real-time minutes per in-game day  

## Canonical assets (HARD RULE)

From `grudge-warlords-assets` skill:

- Nature: `https://assets.grudge-studio.com/models/nature/stylized/...`  
- Characters: grudge6 race GLB/FBX — never Meshy capsules  
- Multi-mesh packs → isolate `meshName` only  

## Dependencies (runtime)

Already in `package.json`:

- `three` + `three-mesh-bvh` + postprocessing via `EffectComposer`  
- `OrbitControls`, bloom, FXAA  
- CDN assets (no extra npm for sky/weather)

Build env (`vercel.json`):

```
VITE_USE_ASSETS_CDN=true
VITE_ASSETS_CDN_URL=https://assets.grudge-studio.com
VITE_OBJECTSTORE_URL=https://objectstore.grudge-studio.com
VITE_APP_ORIGIN=https://water.grudge-studio.com
```

## Deploy

```bash
cd F:\GitHub\Tactical-Infinity
npm run build
npx vercel deploy --prod --yes
# Domain: water.grudge-studio.com
```
