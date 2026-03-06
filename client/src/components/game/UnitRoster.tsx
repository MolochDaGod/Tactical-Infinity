import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Unit, UnitClass } from "@shared/schema";
import { UnitCard } from "./UnitCard";
import { classIcons, factionColors } from "@/lib/gameData";
import { Users, Filter, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitRosterProps {
  units: Unit[];
  selectedUnits: string[];
  maxSelection?: number;
  onSelectionChange: (unitIds: string[]) => void;
  mode?: "view" | "select";
}

export function UnitRoster({
  units,
  selectedUnits,
  maxSelection = 4,
  onSelectionChange,
  mode = "view",
}: UnitRosterProps) {
  const [filterClass, setFilterClass] = useState<UnitClass | "all">("all");
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  const filteredUnits = units.filter((unit) => {
    if (filterClass === "all") return true;
    return unit.class === filterClass;
  });

  const toggleUnit = (unitId: string) => {
    if (mode !== "select") {
      setExpandedUnitId(expandedUnitId === unitId ? null : unitId);
      return;
    }

    if (selectedUnits.includes(unitId)) {
      onSelectionChange(selectedUnits.filter((id) => id !== unitId));
    } else if (selectedUnits.length < maxSelection) {
      onSelectionChange([...selectedUnits, unitId]);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-xl font-bold">Unit Roster</h2>
          </div>
          {mode === "select" && (
            <Badge variant={selectedUnits.length === maxSelection ? "default" : "secondary"}>
              {selectedUnits.length}/{maxSelection} Selected
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 flex-wrap">
            <Button
              size="sm"
              variant={filterClass === "all" ? "default" : "ghost"}
              onClick={() => setFilterClass("all")}
              className="text-xs"
              data-testid="filter-all"
            >
              All
            </Button>
            {(["warrior", "ranger", "mage", "worge"] as UnitClass[]).map((unitClass) => (
              <Button
                key={unitClass}
                size="sm"
                variant={filterClass === unitClass ? "default" : "ghost"}
                onClick={() => setFilterClass(unitClass)}
                className="text-xs capitalize"
                data-testid={`filter-${unitClass}`}
              >
                {unitClass}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredUnits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No units match your filter</p>
            </div>
          ) : (
            filteredUnits.map((unit) => {
              const isSelected = selectedUnits.includes(unit.id);
              const isExpanded = expandedUnitId === unit.id;
              
              return (
                <div
                  key={unit.id}
                  className={cn(
                    "relative transition-all",
                    mode === "select" && isSelected && "ring-2 ring-primary rounded-lg"
                  )}
                >
                  {mode === "select" && (
                    <div className="absolute -top-1 -right-1 z-10">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : selectedUnits.length >= maxSelection ? (
                        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                          <X className="w-4 h-4" />
                        </div>
                      ) : null}
                    </div>
                  )}
                  <UnitCard
                    unit={unit}
                    isSelected={mode === "select" ? isSelected : isExpanded}
                    onClick={() => toggleUnit(unit.id)}
                    showAbilities={mode === "view" && isExpanded}
                  />
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
