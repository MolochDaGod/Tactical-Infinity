import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BattleGrid } from "@/components/game/BattleGrid";
import { TurnOrder } from "@/components/game/TurnOrder";
import { ActionBar } from "@/components/game/ActionBar";
import { UnitCard } from "@/components/game/UnitCard";
import { CombatPreview } from "@/components/game/CombatPreview";
import { VictoryDefeatScreen } from "@/components/game/VictoryDefeatScreen";
import { useTheme } from "@/components/ThemeProvider";
import { useBattleAnimations } from "@/hooks/useBattleAnimations";
import type { BattleState, Unit, Ability } from "@shared/schema";
import { Home, Sun, Moon, Map } from "lucide-react";
import { cn } from "@/lib/utils";

interface BattlePageProps {
  battle: BattleState;
  selectedUnit: Unit | null;
  currentUnit: Unit | null;
  currentAction: "idle" | "move" | "attack" | "ability";
  selectedAbility: Ability | null;
  highlightedTiles: { x: number; y: number; type: "movement" | "attack" | "ability" }[];
  hasMovedThisTurn: boolean;
  hasActedThisTurn: boolean;
  onSelectUnit: (unitId: string | undefined) => void;
  onSetAction: (action: "idle" | "move" | "attack" | "ability") => void;
  onSelectAbility: (ability: Ability | null) => void;
  onTileClick: (x: number, y: number) => void;
  onEndTurn: () => void;
  onVictory: () => void;
  onDefeat: () => void;
  onMainMenu: () => void;
  calculateDamage: (attacker: Unit, defender: Unit, ability?: Ability) => number;
  battlesWon: number;
}

export default function BattlePage({
  battle,
  selectedUnit,
  currentUnit,
  currentAction,
  selectedAbility,
  highlightedTiles,
  hasMovedThisTurn,
  hasActedThisTurn,
  onSelectUnit,
  onSetAction,
  onSelectAbility,
  onTileClick,
  onEndTurn,
  onVictory,
  onDefeat,
  onMainMenu,
  calculateDamage,
  battlesWon,
}: BattlePageProps) {
  const { theme, toggleTheme } = useTheme();
  const { 
    unitAnimations, 
    effects, 
    playAttackAnimation,
    playSpellAnimation,
    playHealAnimation,
    playDeathAnimation,
    playHitAnimation,
    isAnimating 
  } = useBattleAnimations();
  
  const allUnits = [...battle.playerUnits, ...battle.enemyUnits];
  
  const isPlayerTurn = battle.phase === "player_turn";
  const canAct = isPlayerTurn && selectedUnit && !selectedUnit.isEnemy && selectedUnit.id === currentUnit?.id && !isAnimating;

  const targetUnit = selectedUnit && currentAction !== "idle" && currentAction !== "move"
    ? allUnits.find((u) => {
        if (!u.position) return false;
        return highlightedTiles.some((t) => t.x === u.position!.x && t.y === u.position!.y);
      }) || null
    : null;

  const hoveredTarget = selectedUnit && targetUnit && currentAction === "attack"
    ? targetUnit
    : null;

  const handleTileClick = async (x: number, y: number) => {
    if (isAnimating) return;
    
    if (currentAction === "move") {
      const isValidMove = highlightedTiles.some((t) => t.x === x && t.y === y);
      if (isValidMove) {
        onTileClick(x, y);
      }
    } else if (currentAction === "attack" || currentAction === "ability") {
      const isValidTarget = highlightedTiles.some((t) => t.x === x && t.y === y);
      if (isValidTarget && selectedUnit) {
        const target = allUnits.find(u => u.position?.x === x && u.position?.y === y);
        if (target) {
          const damage = calculateDamage(selectedUnit, target, selectedAbility || undefined);
          const isMagicClass = selectedUnit.class === "mage" || selectedUnit.class === "healer";
          const isHeal = selectedAbility?.type === "heal" || 
            (selectedUnit.class === "healer" && !target.isEnemy);
          
          if (isHeal) {
            await playHealAnimation(selectedUnit.id, target.id, damage);
          } else if (isMagicClass || selectedAbility) {
            const spellName = selectedAbility?.name?.toLowerCase() || "fireball";
            const spellColor = selectedAbility?.type === "fire" ? "#ff4500" :
                              selectedAbility?.type === "frost" ? "#00bfff" :
                              selectedAbility?.type === "lightning" ? "#9370db" :
                              "#ff4500";
            await playSpellAnimation(selectedUnit.id, target.id, spellName, damage, spellColor);
          } else {
            await playAttackAnimation(selectedUnit.id, target.id, damage);
          }
          
          const newHp = target.stats.hp - damage;
          if (newHp <= 0) {
            await playDeathAnimation(target.id);
          }
        }
        onTileClick(x, y);
      }
    }
  };

  const handleUnitClick = (unit: Unit) => {
    if (isAnimating) return;
    
    if (currentAction === "attack" || currentAction === "ability") {
      if (unit.position) {
        const isValidTarget = highlightedTiles.some(
          (t) => t.x === unit.position!.x && t.y === unit.position!.y
        );
        if (isValidTarget) {
          handleTileClick(unit.position.x, unit.position.y);
          return;
        }
      }
    }
    onSelectUnit(unit.id);
  };

  if (battle.phase === "victory") {
    const unitsLost = battle.playerUnits.filter((u) => u.stats.hp <= 0).length;
    const enemiesDefeated = battle.enemyUnits.filter((u) => u.stats.hp <= 0).length;
    const survivingUnits = battle.playerUnits.filter((u) => u.stats.hp > 0);

    return (
      <VictoryDefeatScreen
        isVictory={true}
        turnsTaken={battle.turnNumber}
        unitsLost={unitsLost}
        enemiesDefeated={enemiesDefeated}
        survivingUnits={survivingUnits}
        onContinue={onVictory}
        onRetry={() => {}}
        onMainMenu={onMainMenu}
      />
    );
  }

  if (battle.phase === "defeat") {
    const unitsLost = battle.playerUnits.filter((u) => u.stats.hp <= 0).length;
    const enemiesDefeated = battle.enemyUnits.filter((u) => u.stats.hp <= 0).length;
    const survivingUnits = battle.enemyUnits.filter((u) => u.stats.hp > 0);

    return (
      <VictoryDefeatScreen
        isVictory={false}
        turnsTaken={battle.turnNumber}
        unitsLost={unitsLost}
        enemiesDefeated={enemiesDefeated}
        survivingUnits={[]}
        onContinue={() => {}}
        onRetry={onDefeat}
        onMainMenu={onMainMenu}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-4 p-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onMainMenu}
            data-testid="button-back-to-menu"
          >
            <Home className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-muted-foreground" />
            <span className="font-serif font-semibold">{battle.map.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={isPlayerTurn ? "default" : "secondary"}
            className={cn(
              "text-sm px-3 py-1",
              !isPlayerTurn && "animate-pulse"
            )}
          >
            {isPlayerTurn ? "Your Turn" : "Enemy Turn"}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle-battle"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-border bg-card/50 flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="font-serif font-semibold text-sm text-muted-foreground mb-2">
              YOUR FORCES
            </h3>
            <div className="space-y-1.5">
              {battle.playerUnits.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  isSelected={selectedUnit?.id === unit.id}
                  isCompact
                  onClick={() => onSelectUnit(unit.id)}
                />
              ))}
            </div>
          </div>

          <div className="p-3 border-b border-border">
            <h3 className="font-serif font-semibold text-sm text-muted-foreground mb-2">
              ENEMIES
            </h3>
            <div className="space-y-1.5">
              {battle.enemyUnits.filter((u) => u.stats.hp > 0).map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  isSelected={selectedUnit?.id === unit.id}
                  isCompact
                  onClick={() => onSelectUnit(unit.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 p-3 overflow-auto">
            <TurnOrder
              units={allUnits}
              currentUnitId={currentUnit?.id}
              turnNumber={battle.turnNumber}
            />
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center overflow-auto bg-muted/30">
            <BattleGrid
              tiles={battle.map.tiles}
              width={battle.map.width}
              height={battle.map.height}
              units={allUnits.filter((u) => u.stats.hp > 0)}
              selectedUnitId={selectedUnit?.id}
              highlightedTiles={highlightedTiles}
              unitAnimations={unitAnimations}
              combatEffects={effects}
              onTileClick={handleTileClick}
              onUnitClick={handleUnitClick}
            />
          </div>
        </main>

        <aside className="w-72 border-l border-border bg-card/50 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <ActionBar
                selectedUnit={selectedUnit}
                currentAction={currentAction}
                selectedAbility={selectedAbility}
                onMove={() => onSetAction("move")}
                onAttack={() => onSetAction("attack")}
                onAbility={(ability) => onSelectAbility(ability)}
                onEndTurn={onEndTurn}
                onCancel={() => onSetAction("idle")}
                canAct={!!canAct}
                isPlayerTurn={isPlayerTurn}
                hasMovedThisTurn={hasMovedThisTurn}
                hasActedThisTurn={hasActedThisTurn}
              />

              {selectedUnit && currentAction === "attack" && hoveredTarget && (
                <CombatPreview
                  attacker={selectedUnit}
                  defender={hoveredTarget}
                  estimatedDamage={calculateDamage(selectedUnit, hoveredTarget)}
                  hitChance={85}
                  critChance={10}
                />
              )}

              {selectedUnit && (
                <Card className="p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                    SELECTED UNIT
                  </h4>
                  <UnitCard unit={selectedUnit} showAbilities />
                </Card>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
