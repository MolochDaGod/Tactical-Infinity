import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Unit } from "@shared/schema";
import { Trophy, Skull, Swords, Heart, Star, RotateCcw, Home, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface VictoryDefeatScreenProps {
  isVictory: boolean;
  turnsTaken: number;
  unitsLost: number;
  enemiesDefeated: number;
  survivingUnits: Unit[];
  onContinue: () => void;
  onRetry: () => void;
  onMainMenu: () => void;
}

export function VictoryDefeatScreen({
  isVictory,
  turnsTaken,
  unitsLost,
  enemiesDefeated,
  survivingUnits,
  onContinue,
  onRetry,
  onMainMenu,
}: VictoryDefeatScreenProps) {
  const rating = isVictory
    ? unitsLost === 0
      ? 3
      : unitsLost <= 1
      ? 2
      : 1
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="w-full max-w-lg p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={cn(
              "w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center",
              isVictory
                ? "bg-gradient-to-br from-amber-400 to-amber-600"
                : "bg-gradient-to-br from-red-600 to-red-800"
            )}
          >
            {isVictory ? (
              <Trophy className="w-10 h-10 text-white" />
            ) : (
              <Skull className="w-10 h-10 text-white" />
            )}
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "font-serif text-4xl font-bold mb-2",
              isVictory ? "text-amber-500" : "text-red-500"
            )}
          >
            {isVictory ? "VICTORY" : "DEFEAT"}
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground mb-6"
          >
            {isVictory
              ? "Your tactical prowess has won the day!"
              : "Your forces have been vanquished..."}
          </motion.p>

          {isVictory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center gap-1 mb-6"
            >
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "w-8 h-8 transition-all",
                    star <= rating
                      ? "text-amber-400 fill-amber-400"
                      : "text-muted"
                  )}
                />
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-4 mb-6"
          >
            <div className="p-3 bg-muted/50 rounded-md">
              <Swords className="w-5 h-5 mx-auto mb-1 text-orange-500" />
              <p className="text-2xl font-bold font-mono">{enemiesDefeated}</p>
              <p className="text-xs text-muted-foreground">Enemies Defeated</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-md">
              <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
              <p className="text-2xl font-bold font-mono">{unitsLost}</p>
              <p className="text-xs text-muted-foreground">Units Lost</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-md">
              <RotateCcw className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold font-mono">{turnsTaken}</p>
              <p className="text-xs text-muted-foreground">Turns Taken</p>
            </div>
          </motion.div>

          {survivingUnits.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mb-6"
            >
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                SURVIVING UNITS
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                {survivingUnits.slice(0, 6).map((unit) => (
                  <Badge key={unit.id} variant="secondary" className="gap-1">
                    {unit.name}
                    <span className="text-green-500">
                      {Math.round((unit.stats.hp / unit.stats.maxHp) * 100)}%
                    </span>
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col gap-2"
          >
            {isVictory ? (
              <Button onClick={onContinue} size="lg" data-testid="button-continue">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={onRetry} size="lg" data-testid="button-retry">
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button
              onClick={onMainMenu}
              variant="ghost"
              data-testid="button-main-menu"
            >
              <Home className="w-4 h-4 mr-2" />
              Main Menu
            </Button>
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
