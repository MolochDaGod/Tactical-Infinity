import { WorldMapScene } from "@/components/WorldMap/WorldMapScene";
import { IslandExploreScene } from "@/components/game/IslandExploreScene";
import { resolveLandedIsland } from "@/lib/worldMapData";
import { getIslandFleetHandoff } from "@shared/grudgeFleetBridge";
import { Footprints, Ship, Package, Flag, Store, ExternalLink } from "lucide-react";

type WorldMapPhase = "worldmap" | "sailing" | "islandlanding" | "islandexplore";

// URL slugs for the sailing/landing/explore steps. Landing on an island is a
// real, shareable game step: the island id lives in the `?island=` query param
// so back/forward + refresh + bookmarks all work.
const SEA_SLUG = "/world-map";
const LANDING_SLUG = "/island-landing";
const EXPLORE_SLUG = "/island-explore";

// Navigate by pushing the target URL and dispatching popstate — App.tsx's
// popstate handler resolves the pathname against the page registry and drives
// the phase machine. This keeps the URL (incl. the island query param) as the
// single source of truth instead of local-only view state.
function navigate(url: string) {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getIslandIdFromUrl(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get("island") || undefined;
  } catch {
    return undefined;
  }
}

interface WorldMapPageProps {
  phase: WorldMapPhase;
  onBackToMenu?: () => void;
}

export default function WorldMapPage({ phase, onBackToMenu }: WorldMapPageProps) {
  const islandId = getIslandIdFromUrl();
  const landedIsland = resolveLandedIsland(islandId);

  const handleLandOnIsland = (id: string) => {
    navigate(`${LANDING_SLUG}?island=${encodeURIComponent(id)}`);
  };

  const handleReturnToSea = () => {
    navigate(SEA_SLUG);
  };

  const handleExploreIsland = () => {
    if (!landedIsland) return;
    navigate(`${EXPLORE_SLUG}?island=${encodeURIComponent(landedIsland.id)}`);
  };

  const handleExitExplore = () => {
    if (!landedIsland) return;
    navigate(`${LANDING_SLUG}?island=${encodeURIComponent(landedIsland.id)}`);
  };

  // 3D on-foot exploration of a landed island.
  if (phase === "islandexplore") {
    if (!landedIsland) {
      // Stale / invalid link — fall back to the sea.
      handleReturnToSea();
      return null;
    }
    return (
      <IslandExploreScene
        islandId={landedIsland.id}
        islandName={landedIsland.name}
        onExitIsland={handleExitExplore}
      />
    );
  }

  // Docked at an island — the port/actions menu.
  if (phase === "islandlanding") {
    if (!landedIsland) {
      handleReturnToSea();
      return null;
    }
    return (
      <div className="w-full h-screen bg-background flex flex-col" data-testid="page-island-view">
        <div className="bg-card border-b p-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-island-name">{landedIsland.name}</h1>
            <p className="text-sm text-muted-foreground">
              {landedIsland.biome.charAt(0).toUpperCase() + landedIsland.biome.slice(1)} Island
              {landedIsland.hasPort && " - Has Port"}
            </p>
          </div>
          <button
            onClick={handleReturnToSea}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors flex items-center gap-2"
            data-testid="button-return-to-sea"
          >
            <Ship className="w-4 h-4" />
            Set Sail
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-card rounded-lg p-6 border" data-testid="panel-island-info">
              <h2 className="text-lg font-semibold mb-4">Island Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Biome:</span>
                  <span className="ml-2 font-medium capitalize">{landedIsland.biome}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2 font-medium">
                    {landedIsland.isOwned ? "Owned" : "Unclaimed"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Port:</span>
                  <span className="ml-2 font-medium">{landedIsland.hasPort ? "Available" : "None"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <span className="ml-2 font-medium">{Math.round(landedIsland.radius * 2)}m</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border" data-testid="panel-resources">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Available Resources
              </h2>
              <div className="flex flex-wrap gap-2">
                {landedIsland.resources.map((resource, i) => (
                  <span
                    key={i}
                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm capitalize"
                  >
                    {resource}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border" data-testid="panel-actions">
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button 
                  onClick={handleExploreIsland}
                  className="bg-amber-600 hover:bg-amber-700 text-white py-3 px-4 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  data-testid="button-explore-3d"
                >
                  <Footprints className="w-4 h-4" />
                  Explore Island (3D)
                </button>
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  data-testid="button-deploy-harvesters"
                >
                  <Package className="w-4 h-4" />
                  Deploy Harvesters
                </button>
                {landedIsland.hasPort && (
                  <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    data-testid="button-trade"
                  >
                    <Store className="w-4 h-4" />
                    Trade at Port
                  </button>
                )}
                {getIslandFleetHandoff(landedIsland.id) && (
                  <button
                    onClick={() => {
                      const handoff = getIslandFleetHandoff(landedIsland.id);
                      if (handoff) window.open(handoff.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="bg-amber-700 hover:bg-amber-800 text-white py-3 px-4 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    data-testid="button-open-warlords"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Grudge Warlords
                  </button>
                )}
                {!landedIsland.isOwned && (
                  <button 
                    className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    data-testid="button-claim"
                  >
                    <Flag className="w-4 h-4" />
                    Claim Island
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-lg p-6 border border-blue-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Footprints className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">3D Island Exploration</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Walk around the island in third-person view! Visit the cabin and step on the 
                    blue glowing portal to enter the Fantasy Shop.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>WASD - Move your character</li>
                    <li>Shift - Run</li>
                    <li>Right-click drag - Rotate camera</li>
                    <li>Blue portal - Enter the shop</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: open-water sailing on the world map.
  return (
    <div className="w-full h-screen" data-testid="page-world-map">
      <WorldMapScene 
        onLandOnIsland={handleLandOnIsland}
        onBackToMenu={() => {
          if (onBackToMenu) {
            onBackToMenu();
            return;
          }
          // Phase is URL-driven in App (popstate -> getPageBySlug). Navigate to
          // the menu slug and dispatch popstate so App restores the menu phase
          // reliably (history.back() is unsafe because phase sync uses replaceState).
          navigate("/");
        }}
      />
    </div>
  );
}
