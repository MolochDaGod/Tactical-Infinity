import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LoreEntry } from "@shared/schema";
import { loreEntries } from "@/lib/gameData";
import { Book, Scroll, Users, MapPin, Skull, ChevronLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryIcons = {
  history: Scroll,
  factions: Users,
  characters: Users,
  bestiary: Skull,
  locations: MapPin,
};

const categoryLabels = {
  history: "History",
  factions: "Factions",
  characters: "Characters",
  bestiary: "Bestiary",
  locations: "Locations",
};

interface LoreCodexProps {
  unlockedEntries?: string[];
}

export function LoreCodex({ unlockedEntries }: LoreCodexProps) {
  const [selectedEntry, setSelectedEntry] = useState<LoreEntry | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("history");

  const categories = Object.keys(categoryLabels) as (keyof typeof categoryLabels)[];
  
  const entriesByCategory = categories.reduce((acc, category) => {
    acc[category] = loreEntries.filter((entry) => entry.category === category);
    return acc;
  }, {} as Record<string, LoreEntry[]>);

  const isUnlocked = (entry: LoreEntry) => {
    if (!unlockedEntries) return entry.unlocked;
    return unlockedEntries.includes(entry.id) || entry.unlocked;
  };

  if (selectedEntry) {
    return (
      <Card className="h-full flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEntry(null)}
            data-testid="button-back-to-codex"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Badge variant="secondary" className="capitalize">
            {selectedEntry.category}
          </Badge>
        </div>
        
        <ScrollArea className="flex-1 p-6">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <h1 className="font-serif text-2xl mb-4">{selectedEntry.title}</h1>
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {selectedEntry.content}
            </div>
          </article>
        </ScrollArea>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Book className="w-5 h-5 text-primary" />
          <h2 className="font-serif text-xl font-bold">Codex</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Discover the lore and history of Aethermoor
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0">
            {categories.map((category) => {
              const Icon = categoryIcons[category];
              const count = entriesByCategory[category].length;
              
              return (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 px-3"
                  data-testid={`tab-${category}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{categoryLabels[category]}</span>
                  <Badge variant="outline" className="text-xs px-1.5 ml-1">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {entriesByCategory[category].map((entry) => {
                  const unlocked = isUnlocked(entry);
                  
                  return (
                    <button
                      key={entry.id}
                      onClick={() => unlocked && setSelectedEntry(entry)}
                      disabled={!unlocked}
                      className={cn(
                        "w-full text-left p-4 rounded-md transition-all",
                        unlocked && "hover-elevate active-elevate-2 bg-card",
                        !unlocked && "opacity-50 cursor-not-allowed bg-muted/50"
                      )}
                      data-testid={`lore-entry-${entry.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={cn(
                            "font-serif font-semibold",
                            !unlocked && "blur-sm select-none"
                          )}>
                            {unlocked ? entry.title : "??? Unknown Entry ???"}
                          </h3>
                          <p className={cn(
                            "text-sm text-muted-foreground mt-1 line-clamp-2",
                            !unlocked && "blur-sm select-none"
                          )}>
                            {unlocked 
                              ? entry.content.substring(0, 120) + "..."
                              : "This entry has not been unlocked yet. Continue your journey to discover more."
                            }
                          </p>
                        </div>
                        {!unlocked && (
                          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
                
                {entriesByCategory[category].length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Book className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No entries in this category yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
