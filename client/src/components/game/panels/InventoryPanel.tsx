import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, Coins, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { InventoryData, ItemData } from '../MainGamePanel';

interface InventoryPanelProps {
  inventoryData?: InventoryData;
  onUseItem?: (index: number) => void;
  onDropItem?: (index: number) => void;
  onTrashItem?: (index: number) => void;
}

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

const DURABILITY_COLORS = {
  broken: 'bg-red-500',
  low: 'bg-orange-500',
  normal: 'bg-green-500',
};

function getDurabilityColor(durability: number, maxDurability: number): string {
  const percent = durability / maxDurability;
  if (percent === 0) return DURABILITY_COLORS.broken;
  if (percent < 0.1) return DURABILITY_COLORS.low;
  return DURABILITY_COLORS.normal;
}

interface InventorySlotProps {
  index: number;
  item: ItemData | null;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDragStart: (item: ItemData, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetIndex: number) => void;
}

function InventorySlot({
  index,
  item,
  isSelected,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDrop,
}: InventorySlotProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={cn(
        'aspect-square rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all relative',
        item ? RARITY_COLORS[item.rarity] : 'border-slate-700',
        item ? RARITY_BG[item.rarity] : 'bg-slate-800/50',
        isSelected && 'ring-2 ring-amber-400',
        isHovered && 'scale-105 shadow-lg z-10'
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable={!!item}
      onDragStart={() => item && onDragStart(item, index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      data-testid={`inventory-slot-${index}`}
    >
      {item ? (
        <div className="relative w-full h-full p-1">
          {item.icon ? (
            <img src={item.icon} alt={item.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 rounded flex items-center justify-center">
              <Package className="w-4 h-4 text-slate-400" />
            </div>
          )}
          
          {item.amount > 1 && (
            <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/80 px-1 rounded">
              {item.amount}
            </span>
          )}
          
          {item.durability !== undefined && item.maxDurability && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900/50 rounded-b overflow-hidden">
              <div
                className={cn('h-full', getDurabilityColor(item.durability, item.maxDurability))}
                style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
              />
            </div>
          )}
          
          {item.cooldownRemaining !== undefined && item.cooldownRemaining > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded">
              <span className="text-xs font-bold text-white">
                {Math.ceil(item.cooldownRemaining)}s
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full rounded bg-slate-800/30" />
      )}
      
      {isHovered && item && (
        <ItemTooltip item={item} />
      )}
    </motion.div>
  );
}

function ItemTooltip({ item }: { item: ItemData }) {
  const rarityTextColor = {
    common: 'text-slate-300',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute z-50 left-full ml-2 top-0 w-52 p-3 bg-slate-900 border border-amber-500/30 rounded-lg shadow-xl pointer-events-none"
    >
      <div className={cn('font-bold mb-1', rarityTextColor[item.rarity])}>
        {item.name}
      </div>
      <div className="text-xs text-slate-400 mb-2 capitalize">
        {item.type} {item.tier > 0 && `- Tier ${item.tier}`}
      </div>
      
      {item.stats && Object.entries(item.stats).length > 0 && (
        <div className="border-t border-slate-700 pt-2 mb-2">
          {Object.entries(item.stats).map(([stat, value]) => (
            <div key={stat} className="text-xs text-green-400 capitalize">
              +{value} {stat.replace(/([A-Z])/g, ' $1').trim()}
            </div>
          ))}
        </div>
      )}
      
      {item.durability !== undefined && item.maxDurability && (
        <div className="text-xs text-slate-400">
          Durability: {item.durability}/{item.maxDurability}
        </div>
      )}
      
      {item.isUsable && (
        <div className="text-xs text-cyan-400 mt-1">
          Double-click to use
        </div>
      )}
      
      <div className="text-xs text-slate-500 mt-2 italic border-t border-slate-700 pt-2">
        {item.description}
      </div>
    </motion.div>
  );
}

export function InventoryPanel({
  inventoryData,
  onUseItem,
  onDropItem,
  onTrashItem,
}: InventoryPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ item: ItemData; index: number } | null>(null);

  const handleDragStart = useCallback((item: ItemData, index: number) => {
    setDraggedItem({ item, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((targetIndex: number) => {
    if (draggedItem && draggedItem.index !== targetIndex) {
      console.log('Swap items:', draggedItem.index, '->', targetIndex);
    }
    setDraggedItem(null);
  }, [draggedItem]);

  const handleUseItem = useCallback((index: number) => {
    const item = inventoryData?.slots?.[index];
    if (item?.isUsable && onUseItem) {
      onUseItem(index);
    }
  }, [inventoryData, onUseItem]);

  const slots = inventoryData?.slots || [];
  const maxSlots = inventoryData?.maxSlots || 40;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-cinzel font-bold text-amber-200 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Inventory
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Coins className="w-4 h-4" />
            <span className="font-bold">{inventoryData?.gold?.toLocaleString() || 0}</span>
          </div>
          <span className="text-sm text-slate-400">
            {slots.filter(Boolean).length} / {maxSlots}
          </span>
        </div>
      </div>

      <div className="flex-1 bg-slate-800/30 rounded-lg border border-slate-700 p-4 overflow-hidden">
        <div className="grid grid-cols-10 gap-2 h-full overflow-y-auto">
          {Array.from({ length: maxSlots }).map((_, i) => (
            <InventorySlot
              key={i}
              index={i}
              item={slots[i] || null}
              isSelected={selectedIndex === i}
              onClick={() => setSelectedIndex(i)}
              onDoubleClick={() => handleUseItem(i)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIndex === null || !slots[selectedIndex]}
            onClick={() => selectedIndex !== null && onDropItem?.(selectedIndex)}
            className="text-amber-400 border-amber-500/30"
            data-testid="button-drop-item"
          >
            Drop
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIndex === null || !slots[selectedIndex]?.isUsable}
            onClick={() => selectedIndex !== null && handleUseItem(selectedIndex)}
            className="text-cyan-400 border-cyan-500/30"
            data-testid="button-use-item"
          >
            Use
          </Button>
        </div>

        <div
          className={cn(
            'w-12 h-12 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all',
            inventoryData?.trash ? RARITY_COLORS[inventoryData.trash.rarity] : 'border-red-900/50',
            inventoryData?.trash ? RARITY_BG[inventoryData.trash.rarity] : 'bg-red-900/20'
          )}
          onDragOver={handleDragOver}
          onDrop={() => {
            if (draggedItem) {
              onTrashItem?.(draggedItem.index);
              setDraggedItem(null);
            }
          }}
          data-testid="inventory-trash"
        >
          {inventoryData?.trash ? (
            <div className="relative w-full h-full p-1">
              {inventoryData.trash.icon ? (
                <img src={inventoryData.trash.icon} alt="Trash" className="w-full h-full object-contain opacity-50" />
              ) : (
                <Package className="w-6 h-6 text-red-400/50" />
              )}
            </div>
          ) : (
            <Trash2 className="w-5 h-5 text-red-400/50" />
          )}
        </div>
      </div>
    </div>
  );
}
