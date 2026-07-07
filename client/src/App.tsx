import { useEffect, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PuterAuthProvider } from "@/contexts/PuterAuthContext";
import { useGameState } from "@/hooks/useGameState";
import { getPageBySlug, getPageByPhase, printSiteMap } from "@/lib/pageRegistry";
import {
  resolvePlayPhase,
  getPlayButtonLabel,
  getPlayButtonHint,
  onCaptainCreated,
} from "@/lib/gameStartFlow";
import { canSailWorldMap } from "@/lib/playerProgression";
import LoadingScreen from "@/components/LoadingScreen";

// ── Code-split: every page is its own chunk loaded on demand ────────────────
const Home = lazy(() => import("@/pages/home"));
const BattleGrounds = lazy(() => import("@/pages/BattleGrounds"));
const IslandBattlePage = lazy(() => import("@/pages/IslandBattlePage"));
const RosterPage = lazy(() => import("@/pages/roster"));
const CodexPage = lazy(() => import("@/pages/codex"));
const Barracks = lazy(() => import("@/pages/Barracks"));
const Islands = lazy(() => import("@/pages/Islands"));
const AdminMap = lazy(() => import("@/pages/AdminMap"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminSpritesPage = lazy(() => import("@/pages/admin-sprites"));
const AdminAssets = lazy(() => import("@/pages/AdminAssets"));
const WorldMapPage = lazy(() => import("@/pages/world-map"));
const CaptainCreation = lazy(() => import("@/pages/CaptainCreation"));
const GrudgeControllerTest = lazy(() => import("@/pages/GrudgeControllerTest"));
const ShipEditor = lazy(() => import("@/pages/ShipEditor"));
const IntroScene = lazy(() => import("@/components/IntroScene"));
const BeachSpawnScene = lazy(() => import("@/components/BeachSpawnScene"));
const PuterVideoGenerator = lazy(() => import("@/components/PuterVideoGenerator"));
const Chat = lazy(() => import("@/pages/Chat"));
const PolygonJSDemo = lazy(() => import("@/pages/PolygonJSDemo"));
const PixyFxShowcase = lazy(() => import("@/pages/PixyFxShowcase"));
const AssetRegistry = lazy(() => import("@/pages/AssetRegistry"));
const BuilderTest = lazy(() => import("@/pages/BuilderTest"));
const RaceCharacterViewer = lazy(() => import("@/pages/RaceCharacterViewer"));
const UnitViewer = lazy(() => import("@/pages/UnitViewer"));
const TurretDemo = lazy(() => import("@/pages/TurretDemo"));
const PlayerArena = lazy(() => import("@/pages/PlayerArena"));
const IslandEditorPage = lazy(() => import("@/pages/IslandEditorPage"));
const ProductionIsland = lazy(() => import("@/pages/ProductionIsland"));
const EquipmentDemo = lazy(() => import("@/pages/EquipmentDemo"));
const ClassTree = lazy(() => import("@/pages/ClassTree"));

// Themed splash while a page chunk is being downloaded
const PageFallback = () => <LoadingScreen />;

function GameApp() {
  const game = useGameState();

  const handlePlayGame = () => game.setPhase(resolvePlayPhase() as any);
  const handleWorldMap = () => {
    game.setPhase((canSailWorldMap() ? "worldmap" : "productionisland") as any);
  };

  // ── URL ↔ phase sync ────────────────────────────────────────────────────
  // Source of truth = phase machine. We mirror it into the URL bar (so every
  // page has a slug and is bookmarkable) and we also accept slugs from the
  // pathname or `?phase=` param on first load.
  useEffect(() => {
    try {
      const path = window.location.pathname;
      const search = new URLSearchParams(window.location.search);

      // 1. ?phase=equipment legacy / dev-friendly param wins if present.
      const explicitPhase = search.get("phase");
      if (explicitPhase) {
        game.setPhase(explicitPhase as any);
        return;
      }

      // 2. Otherwise resolve the pathname against the registry.
      const page = getPageBySlug(path);
      if (page && page.phase !== game.phase) {
        game.setPhase(page.phase as any);
      }
    } catch { /* ignore */ }

    // Surface the site map in the dev console.
    if (import.meta.env.DEV) {
      printSiteMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever phase changes, push the matching slug + title into the URL bar.
  useEffect(() => {
    const page = getPageByPhase(game.phase);
    if (!page) return;
    try {
      const url = page.slug + window.location.search + window.location.hash;
      if (window.location.pathname !== page.slug) {
        window.history.replaceState({ phase: game.phase }, "", url);
      }
      document.title = page.title;
    } catch { /* ignore */ }
  }, [game.phase]);

  // Browser back / forward navigation.
  useEffect(() => {
    const onPop = () => {
      const page = getPageBySlug(window.location.pathname);
      if (page && page.phase !== game.phase) game.setPhase(page.phase as any);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  // Global "M" key — toggle the world map from any in-game screen, like
  // most modern open-world RPGs. Pressing M from the world map closes it
  // back to the previous gameplay phase.
  useEffect(() => {
    const lastGameplayPhaseRef = { current: "menu" as string };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "m" && e.key !== "M") return;
      // Ignore when typing in an input/textarea/contenteditable.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as any).isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (game.phase === "worldmap") {
        // Toggle off — return to last gameplay phase, defaulting to menu.
        const back = lastGameplayPhaseRef.current && lastGameplayPhaseRef.current !== "worldmap"
          ? lastGameplayPhaseRef.current
          : "menu";
        game.setPhase(back as any);
      } else if (canSailWorldMap()) {
        lastGameplayPhaseRef.current = game.phase;
        game.setPhase("worldmap");
      } else {
        game.setPhase("productionisland");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  useEffect(() => {
    if (game.currentBattle?.phase === "enemy_turn") {
      const timer = setTimeout(() => {
        game.performEnemyTurn();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [game.currentBattle?.phase, game.currentBattle?.currentTurnIndex]);

  const handleTileClick = (x: number, y: number) => {
    if (game.currentAction === "move") {
      game.moveUnit(x, y);
    } else if (game.currentAction === "attack") {
      game.performAttack(x, y);
    } else if (game.currentAction === "ability" && game.selectedAbility) {
      if (game.selectedAbility.type === "heal" || game.selectedAbility.type === "buff") {
        game.performHeal(x, y);
      } else {
        game.performAttack(x, y);
      }
    }
  };

  if (game.phase === "menu") {
    return (
      <Home
        battlesWon={game.battlesWon}
        onPlayGame={handlePlayGame}
        playLabel={getPlayButtonLabel()}
        playHint={getPlayButtonHint()}
        onStartBattle={() => game.startBattle("normal")}
        onViewRoster={() => game.setPhase("roster")}
        onViewCodex={() => game.setPhase("codex")}
        onViewBarracks={() => game.setPhase("barracks")}
        onViewIslands={() => game.setPhase("islands")}
        onViewAdmin={() => game.setPhase("admin")}
        onViewWorldMap={canSailWorldMap() ? handleWorldMap : undefined}
        onViewProductionIsland={() => game.setPhase("productionisland")}
      />
    );
  }

  if (game.phase === "productionisland") {
    return (
      <ProductionIsland
        onBack={() => game.setPhase(canSailWorldMap() ? "worldmap" : "menu")}
        onSetSail={() => game.setPhase("worldmap")}
      />
    );
  }

  if (game.phase === "equipment") {
    return <EquipmentDemo onBack={() => game.setPhase("menu")} />;
  }

  if (game.phase === "islands") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Islands />
        <div className="absolute top-4 left-4 z-10">
          <button 
            onClick={() => game.setPhase("menu")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-menu-islands"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "adminmap") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AdminMap />
        <div className="absolute top-4 left-4 z-10">
          <button 
            onClick={() => game.setPhase("menu")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-menu-adminmap"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "admin") {
    return (
      <Admin 
        onBack={() => game.setPhase("menu")} 
        onViewSprites={() => game.setPhase("adminsprites")}
        onViewAssets={() => game.setPhase("adminassets")}
        onViewPolygonJS={() => game.setPhase("polygonjs")}
        onViewVideoGen={() => game.setPhase("videogen")}
        onViewPixyFx={() => game.setPhase("pixyfx")}
        onViewAssetRegistry={() => game.setPhase("assetregistry")}
        onViewBuilderTest={() => game.setPhase("buildertest")}
        onViewTurretDemo={() => game.setPhase("turretdemo")}
        onViewIslandEditor={() => game.setPhase("islandeditor")}
        onViewRaceViewer={() => game.setPhase("raceviewer")}
      />
    );
  }

  if (game.phase === "adminassets") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AdminAssets />
        <div className="absolute top-4 left-4 z-10">
          <button 
            onClick={() => game.setPhase("admin")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-admin-assets"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "adminsprites") {
    return (
      <AdminSpritesPage onBack={() => game.setPhase("admin")} />
    );
  }

  if (game.phase === "classtree") {
    return (
      <ClassTree
        onBack={() => game.setPhase("menu")}
        onForgeCaptain={() => game.setPhase("barracks")}
      />
    );
  }

  if (game.phase === "captain") {
    return (
      <CaptainCreation
        onBack={() => game.setPhase("menu")}
        onCaptainCreated={(captainData) => {
          try {
            localStorage.setItem("tethical_captain", JSON.stringify({
              name: captainData.name,
              race: captainData.race,
              characterClass: captainData.characterClass,
            }));
          } catch { /* ignore storage errors */ }
          game.setPhase(onCaptainCreated() as any);
        }}
      />
    );
  }

  if (game.phase === "grudgetest") {
    return <GrudgeControllerTest onBack={() => game.setPhase("menu")} />;
  }

  if (game.phase === "shipeditor") {
    return <ShipEditor onBack={() => game.setPhase("menu")} />;
  }

  if (game.phase === "intro") {
    return (
      <div className="h-screen w-full bg-black">
        <IntroScene 
          onComplete={() => game.setPhase("beachSpawn")}
          heroName="Rac'al'vin Gruda"
        />
      </div>
    );
  }

  if (game.phase === "beachSpawn") {
    return (
      <div className="h-screen flex flex-col bg-background relative">
        <BeachSpawnScene 
          onExitToWorldMap={() => game.setPhase("worldmap")}
          onBackToMenu={() => game.setPhase("menu")}
        />
      </div>
    );
  }

  if (game.phase === "videogen") {
    return (
      <div className="h-screen w-full bg-background">
        <PuterVideoGenerator />
        <div className="absolute top-4 left-4 z-10">
          <button 
            onClick={() => game.setPhase("admin")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-admin-videogen"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "chat") {
    return <Chat onBack={() => game.setPhase("menu")} />;
  }

  if (game.phase === "worldmap") {
    if (!canSailWorldMap()) {
      return (
        <ProductionIsland
          onBack={() => game.setPhase("menu")}
          onSetSail={() => game.setPhase("worldmap")}
        />
      );
    }
    return (
      <div className="h-screen flex flex-col bg-background relative">
        <WorldMapPage phase={game.phase} onBackToMenu={() => game.setPhase("menu")} />
        <div className="absolute top-4 left-4 z-10">
          <button 
            onClick={() => game.setPhase("menu")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-menu-worldmap"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "islandlanding" || game.phase === "islandexplore") {
    return <WorldMapPage phase={game.phase} onBackToMenu={() => game.setPhase("menu")} />;
  }

  if (game.phase === "barracks") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Barracks />
        <div className="absolute top-4 left-4">
          <button 
            onClick={() => game.setPhase("menu")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back-menu"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "polygonjs") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <PolygonJSDemo />
        <div className="absolute top-4 left-4 z-10">
          <button 
            onClick={() => game.setPhase("admin")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-admin-polygonjs"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "assetregistry") {
    return (
      <div className="min-h-screen overflow-auto bg-background">
        <AssetRegistry />
        <button
          onClick={() => game.setPhase("admin")}
          className="fixed top-4 left-4 z-50 text-muted-foreground hover:text-foreground transition-colors bg-background/90 backdrop-blur-sm px-3 py-1 rounded-md text-sm"
          data-testid="button-back-admin-assetregistry"
        >
          ← Back to Admin
        </button>
      </div>
    );
  }

  if (game.phase === "pixyfx") {
    return (
      <div className="h-screen overflow-auto bg-background">
        <PixyFxShowcase />
        <button
          onClick={() => game.setPhase("admin")}
          className="fixed top-4 left-4 z-50 text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm px-3 py-1 rounded-md text-sm"
          data-testid="button-back-admin-pixyfx"
        >
          ← Back to Admin
        </button>
      </div>
    );
  }

  if (game.phase === "buildertest") {
    return <BuilderTest />;
  }

  if (game.phase === "islandeditor") {
    return <IslandEditorPage />;
  }

  if (game.phase === "turretdemo") {
    return <TurretDemo />;
  }

  if (game.phase === "playerarena") {
    return <PlayerArena onBack={() => game.setPhase("menu")} />;
  }

  if (game.phase === "sailing") {
    // Open Water Sailing page retired — sailing now happens directly on the World Map.
    if (!canSailWorldMap()) {
      return (
        <ProductionIsland
          onBack={() => game.setPhase("menu")}
          onSetSail={() => game.setPhase("worldmap")}
        />
      );
    }
    return (
      <div className="h-screen flex flex-col bg-background relative">
        <WorldMapPage phase={game.phase} onBackToMenu={() => game.setPhase("menu")} />
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => game.setPhase("menu")}
            className="text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-3 py-1 rounded-md"
            data-testid="button-back-menu-sailing"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "raceviewer") {
    return <RaceCharacterViewer onBack={() => game.setPhase("admin")} />;
  }

  if (game.phase === "unitviewer") {
    return <UnitViewer onBack={() => game.setPhase("menu")} />;
  }

  if (game.phase === "roster") {
    return (
      <RosterPage
        units={game.playerRoster}
        selectedUnits={game.selectedUnitsForBattle}
        onSelectionChange={game.selectUnitsForBattle}
        onBack={() => game.setPhase("menu")}
        onStartBattle={() => game.startBattle("normal")}
      />
    );
  }

  if (game.phase === "codex") {
    return (
      <CodexPage
        onBack={() => game.setPhase("menu")}
      />
    );
  }

  if (game.phase === "battle") {
    return (
      <IslandBattlePage
        onBack={() => game.setPhase("menu")}
      />
    );
  }

  if (game.phase === "battlegrounds") {
    return (
      <BattleGrounds
        onBack={() => game.setPhase("menu")}
      />
    );
  }

  // Fallback — matches the menu render at top to prevent missing handler bugs
  return (
    <Home
      battlesWon={game.battlesWon}
      onPlayGame={handlePlayGame}
      playLabel={getPlayButtonLabel()}
      playHint={getPlayButtonHint()}
      onStartBattle={() => game.startBattle("normal")}
      onViewRoster={() => game.setPhase("roster")}
      onViewCodex={() => game.setPhase("codex")}
      onViewBarracks={() => game.setPhase("barracks")}
      onViewIslands={() => game.setPhase("islands")}
      onViewAdmin={() => game.setPhase("admin")}
      onViewWorldMap={canSailWorldMap() ? handleWorldMap : undefined}
      onViewProductionIsland={() => game.setPhase("productionisland")}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <PuterAuthProvider>
            <Suspense fallback={<PageFallback />}>
              <GameApp />
            </Suspense>
            <Toaster />
          </PuterAuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
