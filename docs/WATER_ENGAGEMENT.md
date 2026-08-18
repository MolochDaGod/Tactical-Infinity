# Production water engagement

## Design

| Piece | How players get it |
|-------|--------------------|
| **Sailed Raft** | **Main panel → Ships** quick craft (+ multi-attachments). Not an RTS placeable. |
| **Harbor docks** | RTS Harbor: Fishing · Boat Dock · War Dock · Capital Dock |
| **5 dock hulls** | Built at a **shipyard dock** (Boat / War / Capital): Skiff → Sloop → Brigantine → Galleon → Man o’ War |
| **Deck stations** | Place on the active hull: helm, cannon, harpoon, sniper nest, mage spot |
| **9 ocean sectors** | 3×3 world grid; each sector shows matching ship-tier showcase assets |

## Ladder

```
raft (quick craft)
  └─ harbor docks
       ├─ fishing_dock   (viking house — no hull build)
       ├─ boat_dock      (shipyard)
       ├─ war_dock       (battery + shipyard)
       └─ capital_dock   (home lobby + 6 berths)
            ├─ skiff
            ├─ sloop
            ├─ brigantine
            ├─ galleon
            └─ manOWar
```

## Forest harvest pack

`low_poly_forest_pack` → `/models/fleet/harvest/low_poly_forest_pack.glb`  
Isolate by node name. **5 tree types × 3 examples** (oak, oak_old, pine, spruce, birch).  
Cut-down: shake → fall → `FOREST_STUMPS` + `FOREST_LOGS`.  
Also: mushrooms, ferns, dandelion, minable stone/moss, light/dark bushes (cloth/fiber).

Fat rafts **not** copied: `stylized_orc_raft.glb` (148 MB), `argon_raft.glb` (70 MB), `raft (2)/(3)`.  
Play ladder: short_plank → short_logs → short_sail → long_complete at `/dock-workshop`.

## Open-sea HUD

Old WindCompass / captain card / GameHUD ship overlay is **removed**.
Play HUD is **RTS-Grudge (5)** — `client/src/components/hud/RtsSeaHud.tsx`:

| Key | Command | Crew |
|-----|---------|------|
| 1 | Cannon | gunner |
| 2 | Harpoon | sailor |
| 3 | Nest | sailor |
| 4 | Wind | weatherman |
| 5 | Repair | sailor |

Slots lock from `HULL_DECK_BUDGETS` (raft has no guns).

Fleet viewing folder: `client/public/models/fleet/` · page `/fleet-assets`.

## Deck stations (open sea)

| Station | Crew | Anchor family |
|---------|------|----------------|
| Helm | captain | `captain` |
| Cannon | gunner | `cannon1…6` |
| Harpoon | sailor | `harpoon1…2` |
| Sniper nest | sailor | `crowsnest` |
| Mage spot | weatherman | `caster1…2` |

Per-hull budgets live in `HULL_DECK_BUDGETS`. Raft is helm-only. Man o’ War: 6 cannon · 2 harpoon · nest · 2 mage.

## Raft attachments (main panel)

Slots: `sail` · `mast` · `storage` · `utility` · `mooring` · `canopy`  
SSOT: `shared/gameDefinitions/waterEngagement.ts` (`RAFT_ATTACHMENTS`).

## Key files

| File | Role |
|------|------|
| `shared/gameDefinitions/waterEngagement.ts` | Recipes, attachments, deck stations, dock kinds, 9 sectors |
| `shared/gameDefinitions/boatRegistry.ts` | Runtime boats (+ manOWar) |
| `client/src/lib/playerProgression.ts` | raft / dock / hull / deck loadouts |
| `client/src/lib/deckPlacement.ts` | SI station meshes on hulls |
| `client/src/lib/islandDockSystem.ts` | Dock kinds + viking prefab + berths |
| `client/src/components/game/panels/ShipCraftPanel.tsx` | Main panel Ships tab |
| `client/src/lib/buildableObjectsRegistry.ts` | Harbor placeables |
| `client/src/lib/lobbyShipYard.ts` | Production island hull showcase |
| `client/src/lib/oceanSectorAssets.ts` | Sector ship props on world map |

## Lobby map

`ProductionIsland` places a **capital dock** on the south shore, then `createLobbyShipYard(..., existingDock)` berths the 5 hulls on that pier (no second dock). Each hull gets default deck stations.

## Sectors

`OCEAN_SECTORS` in `waterEngagement.ts` (nw…se). World map calls `spawnAllSectorShipAssets` during `initializeOceanLife`.

