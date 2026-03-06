import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UnitRoster } from "@/components/game/UnitRoster";
import { useTheme } from "@/components/ThemeProvider";
import type { Unit } from "@shared/schema";
import { ChevronLeft, Swords, Sun, Moon, Play } from "lucide-react";

interface RosterPageProps {
  units: Unit[];
  selectedUnits: string[];
  onSelectionChange: (unitIds: string[]) => void;
  onBack: () => void;
  onStartBattle: () => void;
}

export default function RosterPage({
  units,
  selectedUnits,
  onSelectionChange,
  onBack,
  onStartBattle,
}: RosterPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"view" | "select">("view");

  const handleStartBattle = () => {
    if (mode === "view") {
      setMode("select");
    } else if (selectedUnits.length > 0) {
      onStartBattle();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-serif text-xl font-bold flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary" />
              Unit Roster
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "view" ? "View and manage your units" : "Select units for battle"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {mode === "select" && (
            <Badge
              variant={selectedUnits.length === 4 ? "default" : "secondary"}
              className="text-sm"
            >
              {selectedUnits.length}/4 Selected
            </Badge>
          )}
          <Button
            variant={mode === "select" && selectedUnits.length > 0 ? "default" : "secondary"}
            onClick={handleStartBattle}
            data-testid="button-start-battle"
          >
            {mode === "view" ? (
              <>
                Select for Battle
                <Swords className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Battle ({selectedUnits.length})
              </>
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <UnitRoster
          units={units}
          selectedUnits={selectedUnits}
          maxSelection={4}
          onSelectionChange={onSelectionChange}
          mode={mode}
        />
      </div>
    </div>
  );
}
