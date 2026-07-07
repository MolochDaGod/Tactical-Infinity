import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/ThemeProvider";
import { Swords, Book, Users, Settings, Play, Moon, Sun, Sparkles, Shield, Trophy, Castle, Map, Wrench, Anchor } from "lucide-react";
import { motion } from "framer-motion";

interface MainMenuProps {
  battlesWon: number;
  onPlayGame?: () => void;
  playLabel?: string;
  playHint?: string;
  onStartBattle: () => void;
  onViewRoster: () => void;
  onViewCodex: () => void;
  onViewBarracks: () => void;
  onViewIslands?: () => void;
  onViewAdmin?: () => void;
  onViewWorldMap?: () => void;
  onViewProductionIsland?: () => void;
}

export function MainMenu({
  battlesWon,
  onPlayGame,
  playLabel = 'Play',
  playHint,
  onStartBattle,
  onViewRoster,
  onViewCodex,
  onViewBarracks,
  onViewIslands,
  onViewAdmin,
  onViewWorldMap,
  onViewProductionIsland,
}: MainMenuProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-accent/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTheme}
          className="text-white/80 hover:text-white hover:bg-white/10"
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Swords className="w-10 h-10 md:w-14 md:h-14 text-primary" />
            <h1 className="font-serif text-5xl md:text-7xl font-bold text-white tracking-wide">
              TETHICAL
            </h1>
            <Shield className="w-10 h-10 md:w-14 md:h-14 text-primary" />
          </div>
          <p className="text-lg md:text-xl text-white/60 font-light tracking-widest uppercase">
            Tactical Strategy in a Fractured World
          </p>
          
          {battlesWon > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              <Badge className="bg-primary/20 text-primary border border-primary/30 text-sm px-4 py-1">
                <Trophy className="w-4 h-4 mr-2" />
                {battlesWon} Battles Won
              </Badge>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md space-y-4"
        >
          {onPlayGame && (
            <>
              <Button
                onClick={onPlayGame}
                size="lg"
                className="w-full h-14 text-lg font-serif relative overflow-hidden group bg-emerald-700 hover:bg-emerald-600"
                data-testid="button-play-game"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  <Anchor className="w-5 h-5" />
                  {playLabel}
                </span>
              </Button>
              {playHint && (
                <p className="text-center text-xs text-white/50 px-2 -mt-1">{playHint}</p>
              )}
            </>
          )}

          <Button
            onClick={onStartBattle}
            size="lg"
            variant="secondary"
            className="w-full h-12 text-base font-serif bg-white/10 hover:bg-white/20 text-white border-white/20"
            data-testid="button-start-battle"
          >
            <span className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
              Tactical Battle
            </span>
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onViewRoster}
              variant="secondary"
              size="lg"
              className="h-12 font-serif bg-white/10 hover:bg-white/20 text-white border-white/20"
              data-testid="button-view-roster"
            >
              <Users className="w-5 h-5 mr-2" />
              Roster
            </Button>
            
            <Button
              onClick={onViewBarracks}
              variant="secondary"
              size="lg"
              className="h-12 font-serif bg-white/10 hover:bg-white/20 text-white border-white/20"
              data-testid="button-view-barracks"
            >
              <Castle className="w-5 h-5 mr-2" />
              Barracks
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onViewCodex}
              variant="secondary"
              size="lg"
              className="h-12 font-serif bg-white/10 hover:bg-white/20 text-white border-white/20"
              data-testid="button-view-codex"
            >
              <Book className="w-5 h-5 mr-2" />
              Codex
            </Button>
            
            {onViewIslands && (
              <Button
                onClick={onViewIslands}
                variant="secondary"
                size="lg"
                className="h-12 font-serif bg-white/10 hover:bg-white/20 text-white border-white/20"
                data-testid="button-view-islands"
              >
                <Map className="w-5 h-5 mr-2" />
                Islands
              </Button>
            )}
          </div>

          {onViewProductionIsland && (
            <Button
              onClick={onViewProductionIsland}
              variant="secondary"
              size="lg"
              className="w-full h-11 font-serif bg-white/10 hover:bg-white/20 text-white border-white/20"
              data-testid="button-home-island"
            >
              <Castle className="w-5 h-5 mr-2" />
              Home Island
            </Button>
          )}

          {onViewWorldMap && (
            <Button
              onClick={onViewWorldMap}
              size="lg"
              className="w-full h-12 text-lg font-serif relative overflow-hidden group bg-blue-600 hover:bg-blue-700"
              data-testid="button-view-worldmap"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                <Anchor className="w-5 h-5" />
                Set Sail - World Map
                <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </Button>
          )}

          {onViewAdmin && (
            <Button
              onClick={onViewAdmin}
              variant="secondary"
              size="lg"
              className="w-full h-10 font-serif bg-white/5 hover:bg-white/15 text-white/70 border-white/10"
              data-testid="button-view-admin"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Admin: Sprite & Weapon Editor
            </Button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-white/30">
            A world shattered by magic. Four factions vie for control.
          </p>
          <p className="text-sm text-white/30 mt-1">
            Lead your forces to victory in endless tactical battles.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        >
          <p className="text-xs text-white/20">
            Procedurally Generated Battles | Rich Lore | Strategic Depth
          </p>
        </motion.div>
      </div>
    </div>
  );
}
