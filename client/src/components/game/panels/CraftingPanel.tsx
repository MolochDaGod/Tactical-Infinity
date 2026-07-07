import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Hammer, Plus, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InventoryData, ItemData } from '../MainGamePanel';

interface CraftingPanelProps {
  inventoryData?: InventoryData;
  onCraft?: (recipeId: string, ingredientIndices: number[]) => void;
}

interface Recipe {
  id: string;
  name: string;
  resultIcon: string;
  resultName: string;
  ingredients: { itemId: string; amount: number }[];
  craftingTime: number;
  probability: number;
}

interface CraftingState {
  status: 'idle' | 'crafting' | 'success' | 'failed';
  progress: number;
  message: string;
}

const MAX_INGREDIENT_SLOTS = 6;

const RARITY_COLORS: Record<string, string> = {
  common: 'border-slate-400',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-amber-500',
};

const RARITY_BG: Record<string, string> = {
  common: 'bg-slate-800/50',
  uncommon: 'bg-green-900/30',
  rare: 'bg-blue-900/30',
  epic: 'bg-purple-900/30',
  legendary: 'bg-amber-900/30',
};

function IngredientSlot({
  index,
  item,
  onRemove,
  onDrop,
}: {
  index: number;
  item: ItemData | null;
  onRemove: () => void;
  onDrop: (itemIndex: number) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <motion.div
      className={cn(
        'w-16 h-16 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all relative',
        item ? RARITY_COLORS[item.rarity] : 'border-dashed border-slate-600',
        item ? RARITY_BG[item.rarity] : 'bg-slate-800/30',
        isDragOver && 'border-amber-400 bg-amber-900/20'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const itemIndex = parseInt(e.dataTransfer.getData('itemIndex'), 10);
        if (!isNaN(itemIndex)) {
          onDrop(itemIndex);
        }
      }}
      data-testid={`crafting-ingredient-${index}`}
    >
      {item ? (
        <div className="relative w-full h-full p-1">
          {item.icon ? (
            <img src={item.icon} alt={item.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-slate-700 rounded" />
          )}
          {item.amount > 1 && (
            <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/80 px-1 rounded">
              {item.amount}
            </span>
          )}
          <button
            className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <Plus className="w-6 h-6 text-slate-500" />
      )}
    </motion.div>
  );
}

function ResultSlot({
  recipe,
  craftingState,
}: {
  recipe: Recipe | null;
  craftingState: CraftingState;
}) {
  return (
    <motion.div
      className={cn(
        'w-20 h-20 rounded-lg border-2 flex items-center justify-center transition-all relative',
        recipe ? 'border-amber-500 bg-amber-900/30' : 'border-slate-600 bg-slate-800/30'
      )}
      data-testid="crafting-result"
    >
      {recipe ? (
        <div className="relative w-full h-full p-2">
          {recipe.resultIcon ? (
            <img src={recipe.resultIcon} alt={recipe.resultName} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-600 to-amber-800 rounded flex items-center justify-center">
              <Hammer className="w-8 h-8 text-amber-200" />
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-500 text-center text-xs px-2">
          Add ingredients
        </div>
      )}
      
      {craftingState.status === 'crafting' && (
        <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      )}
      
      {craftingState.status === 'success' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute inset-0 bg-green-500/30 rounded-lg flex items-center justify-center"
        >
          <Check className="w-8 h-8 text-green-400" />
        </motion.div>
      )}
      
      {craftingState.status === 'failed' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute inset-0 bg-red-500/30 rounded-lg flex items-center justify-center"
        >
          <X className="w-8 h-8 text-red-400" />
        </motion.div>
      )}
    </motion.div>
  );
}

export function CraftingPanel({
  inventoryData,
  onCraft,
}: CraftingPanelProps) {
  const [ingredientSlots, setIngredientSlots] = useState<(number | null)[]>(
    Array(MAX_INGREDIENT_SLOTS).fill(null)
  );
  const [craftingState, setCraftingState] = useState<CraftingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [matchedRecipe, setMatchedRecipe] = useState<Recipe | null>(null);

  const handleAddIngredient = useCallback((slotIndex: number, itemIndex: number) => {
    setIngredientSlots((prev) => {
      const next = [...prev];
      if (!next.includes(itemIndex)) {
        next[slotIndex] = itemIndex;
      }
      return next;
    });
  }, []);

  const handleRemoveIngredient = useCallback((slotIndex: number) => {
    setIngredientSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    setMatchedRecipe(null);
  }, []);

  const handleCraft = useCallback(() => {
    if (!matchedRecipe) return;
    
    const validIndices = ingredientSlots.filter((i): i is number => i !== null);
    
    setCraftingState({ status: 'crafting', progress: 0, message: 'Crafting...' });
    
    const duration = matchedRecipe.craftingTime * 1000;
    const startTime = Date.now();
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      
      if (progress < 100) {
        setCraftingState((prev) => ({ ...prev, progress }));
        requestAnimationFrame(updateProgress);
      } else {
        const success = Math.random() < matchedRecipe.probability;
        setCraftingState({
          status: success ? 'success' : 'failed',
          progress: 100,
          message: success ? 'Success!' : 'Failed :(',
        });
        
        if (success) {
          onCraft?.(matchedRecipe.id, validIndices);
        }
        
        setTimeout(() => {
          setCraftingState({ status: 'idle', progress: 0, message: '' });
          if (success) {
            setIngredientSlots(Array(MAX_INGREDIENT_SLOTS).fill(null));
            setMatchedRecipe(null);
          }
        }, 1500);
      }
    };
    
    requestAnimationFrame(updateProgress);
  }, [matchedRecipe, ingredientSlots, onCraft]);

  const getIngredientItem = (slotIndex: number): ItemData | null => {
    const itemIndex = ingredientSlots[slotIndex];
    if (itemIndex === null || !inventoryData?.slots) return null;
    return inventoryData.slots[itemIndex] || null;
  };

  const canCraft = matchedRecipe !== null && craftingState.status === 'idle';

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-cinzel font-bold text-amber-200 flex items-center gap-2">
          <Hammer className="w-5 h-5" />
          Crafting
        </h3>
      </div>

      <div className="flex items-center justify-center gap-4 p-6 bg-slate-800/30 rounded-lg border border-slate-700">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_INGREDIENT_SLOTS }).map((_, i) => (
            <IngredientSlot
              key={i}
              index={i}
              item={getIngredientItem(i)}
              onRemove={() => handleRemoveIngredient(i)}
              onDrop={(itemIndex) => handleAddIngredient(i, itemIndex)}
            />
          ))}
        </div>

        <div className="flex items-center px-4">
          <ArrowRight className="w-8 h-8 text-slate-500" />
        </div>

        <ResultSlot recipe={matchedRecipe} craftingState={craftingState} />
      </div>

      {craftingState.status === 'crafting' && (
        <div className="space-y-2">
          <Progress value={craftingState.progress} className="h-2" />
          <p className="text-center text-sm text-slate-400">{craftingState.message}</p>
        </div>
      )}

      {craftingState.status !== 'idle' && craftingState.status !== 'crafting' && (
        <p className={cn(
          'text-center text-lg font-bold',
          craftingState.status === 'success' ? 'text-green-400' : 'text-red-400'
        )}>
          {craftingState.message}
        </p>
      )}

      <Button
        onClick={handleCraft}
        disabled={!canCraft}
        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold"
        data-testid="button-craft"
      >
        {matchedRecipe && matchedRecipe.probability < 1 ? 'Try Craft' : 'Craft'}
      </Button>

      <div className="flex-1 bg-slate-800/30 rounded-lg border border-slate-700 p-4">
        <h4 className="text-sm font-bold text-amber-200 mb-3">Inventory (Drag to add)</h4>
        <ScrollArea className="h-[200px]">
          <div className="grid grid-cols-8 gap-1">
            {inventoryData?.slots?.map((item, index) => {
              if (!item) return null;
              const isUsed = ingredientSlots.includes(index);
              return (
                <motion.div
                  key={index}
                  className={cn(
                    'aspect-square rounded border-2 flex items-center justify-center cursor-grab transition-all',
                    RARITY_COLORS[item.rarity],
                    RARITY_BG[item.rarity],
                    isUsed && 'opacity-30 cursor-not-allowed'
                  )}
                  draggable={!isUsed}
                  onDragStart={(e) => {
                    if (!isUsed) {
                      (e as any).dataTransfer?.setData('itemIndex', index.toString());
                    }
                  }}
                  whileHover={!isUsed ? { scale: 1.1 } : {}}
                >
                  {item.icon ? (
                    <img src={item.icon} alt={item.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="w-8 h-8 bg-slate-700 rounded" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
