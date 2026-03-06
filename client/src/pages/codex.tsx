import { Button } from "@/components/ui/button";
import { LoreCodex } from "@/components/game/LoreCodex";
import { useTheme } from "@/components/ThemeProvider";
import { ChevronLeft, Book, Sun, Moon } from "lucide-react";

interface CodexPageProps {
  unlockedEntries?: string[];
  onBack: () => void;
}

export default function CodexPage({ unlockedEntries, onBack }: CodexPageProps) {
  const { theme, toggleTheme } = useTheme();

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
              <Book className="w-5 h-5 text-primary" />
              Lore Codex
            </h1>
            <p className="text-sm text-muted-foreground">
              Discover the history and secrets of Aethermoor
            </p>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <LoreCodex unlockedEntries={unlockedEntries} />
      </div>
    </div>
  );
}
