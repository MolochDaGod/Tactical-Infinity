# Production water engagement

## Design

| Piece | How players get it |
|-------|--------------------|
| **Sailed Raft** | **Main panel → Ships** quick craft (+ multi-attachments). Not an RTS placeable. |
| **Boat Dock** | **RTS building** (hammer → Harbor → Boat Dock). Unlocks shipyard. |
| **5 dock hulls** | Built **at a Boat Dock**: Skiff → Sloop → Brigantine → Galleon → Man o’ War |
| **9 ocean sectors** | 3×3 world grid; each sector shows matching ship-tier showcase assets |

## Ladder

```
raft (quick craft)
  └─ boat_dock (RTS)
       ├─ skiff
       ├─ sloop
       ├─ brigantine
       ├─ galleon
       └─ manOWar
```

## Raft attachments (main panel)

Slots: `sail` · `mast` · `storage` · `utility` · `mooring` · `canopy`  
SSOT: `shared/gameDefinitions/waterEngagement.ts` (`RAFT_ATTACHMENTS`).

## Key files

| File | Role |
|------|------|
| `shared/gameDefinitions/waterEngagement.ts` | Recipes, attachments, 9 sectors |
| `shared/gameDefinitions/boatRegistry.ts` | Runtime boats (+ manOWar) |
| `client/src/lib/playerProgression.ts` | raft / dock / hull unlocks |
| `client/src/components/game/panels/ShipCraftPanel.tsx` | Main panel Ships tab |
| `client/src/lib/buildableObjectsRegistry.ts` | `boat_dock` placeable |
| `client/src/lib/lobbyShipYard.ts` | Production island hull showcase |
| `client/src/lib/oceanSectorAssets.ts` | Sector ship props on world map |

## Lobby map

`ProductionIsland` loads `createLobbyShipYard` after the south dock — lined tier hulls + raft so home island reads as a shipyard lobby.

## Sectors

`OCEAN_SECTORS` in `waterEngagement.ts` (nw…se). World map calls `spawnAllSectorShipAssets` during `initializeOceanLife`.
