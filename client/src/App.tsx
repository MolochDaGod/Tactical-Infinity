import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useGameState } from "@/hooks/useGameState";
import Home from "@/pages/home";
import BattlePage from "@/pages/battle";
import RosterPage from "@/pages/roster";
import CodexPage from "@/pages/codex";
import Barracks from "@/pages/Barracks";
import Islands from "@/pages/Islands";
import AdminMap from "@/pages/AdminMap";
import Admin from "@/pages/Admin";
import AdminSpritesPage from "@/pages/admin-sprites";
import WorldMapPage from "@/pages/world-map";

function GameApp() {
  const game = useGameState();

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
        onStartBattle={() => game.startBattle("normal")}
        onViewRoster={() => game.setPhase("roster")}
        onViewCodex={() => game.setPhase("codex")}
        onViewBarracks={() => game.setPhase("barracks")}
        onViewIslands={() => game.setPhase("islands")}
        onViewAdmin={() => game.setPhase("admin")}
        onViewWorldMap={() => game.setPhase("worldmap")}
      />
    );
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
      />
    );
  }

  if (game.phase === "adminsprites") {
    return (
      <AdminSpritesPage onBack={() => game.setPhase("admin")} />
    );
  }

  if (game.phase === "worldmap") {
    return (
      <div className="h-screen flex flex-col bg-background relative">
        <WorldMapPage />
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

  if (game.phase === "battle" && game.currentBattle) {
    return (
      <BattlePage
        battle={game.currentBattle}
        selectedUnit={game.selectedUnit}
        currentUnit={game.currentUnit}
        currentAction={game.currentAction}
        selectedAbility={game.selectedAbility}
        highlightedTiles={game.highlightedTiles}
        hasMovedThisTurn={game.hasMovedThisTurn}
        hasActedThisTurn={game.hasActedThisTurn}
        onSelectUnit={game.selectUnit}
        onSetAction={game.setAction}
        onSelectAbility={game.selectAbility}
        onTileClick={handleTileClick}
        onEndTurn={game.endTurn}
        onVictory={() => game.endBattle(true)}
        onDefeat={() => game.endBattle(false)}
        onMainMenu={() => game.setPhase("menu")}
        calculateDamage={game.calculateDamage}
        battlesWon={game.battlesWon}
      />
    );
  }

  return (
    <Home
      battlesWon={game.battlesWon}
      onStartBattle={() => game.startBattle("normal")}
      onViewRoster={() => game.setPhase("roster")}
      onViewCodex={() => game.setPhase("codex")}
      onViewBarracks={() => game.setPhase("barracks")}
      onViewIslands={() => game.setPhase("islands")}
      onViewAdmin={() => game.setPhase("admin")}
      onViewWorldMap={() => game.setPhase("worldmap")}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <GameApp />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
