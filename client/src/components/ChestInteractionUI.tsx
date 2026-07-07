/**
 * ChestInteractionUI — E-key prompt and animated reward popup for chest drops.
 *
 * Usage:
 *   <ChestInteractionUI
 *     canInteract={hasCandidates}
 *     openReward={currentReward}
 *     onRewardClaimed={() => setCurrentReward(null)}
 *   />
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Star, Zap, Gem, Shield, Sword, Package, Flame, X } from 'lucide-react';
import type { ChestReward, LootItem } from '@/lib/chestDropSystem';

const RARITY_COLORS: Record<string, string> = {
  common:    'text-gray-300 border-gray-500/50 bg-gray-800/60',
  uncommon:  'text-green-300 border-green-500/50 bg-green-900/40',
  rare:      'text-blue-300 border-blue-500/50 bg-blue-900/40',
  epic:      'text-purple-300 border-purple-500/50 bg-purple-900/40',
  legendary: 'text-amber-300 border-amber-500/40 bg-amber-900/40'
};

const RARITY_GLOW: Record<string, string> = {
  common:    '',
  uncommon:  'drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]',
  rare:      'drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]',
  epic:      'drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]',
  legendary: 'drop-shadow-[0_0_14px_rgba(251,191,36,0.9)]'
};

const CHEST_TIER_LABEL: Record<string, string> = {
  common:    'Wooden Chest',
  uncommon:  'Iron Chest',
  rare:      'Gold Chest',
  epic:      'Ornate Chest',
  legendary: 'Legendary Chest',
  boss:      'Boss Chest',
  boss_rare: 'Rare Boss Chest',
  ancient:   'Ancient Vault'
};

const CHEST_TIER_BG: Record<string, string> = {
  common:    'from-gray-900 to-gray-800 border-gray-600/50',
  uncommon:  'from-green-950 to-gray-900 border-green-600/40',
  rare:      'from-blue-950 to-gray-900 border-blue-600/40',
  epic:      'from-purple-950 to-gray-900 border-purple-600/50',
  legendary: 'from-amber-950 to-gray-900 border-amber-500/50',
  boss:      'from-red-950 to-gray-900 border-red-600/50',
  boss_rare: 'from-pink-950 to-gray-900 border-pink-600/50',
  ancient:   'from-cyan-950 to-gray-900 border-cyan-500/50'
};

function ItemTypeIcon({ type }: { type: LootItem['type'] }) {
  const cls = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'weapon':     return <Sword className={cls} />;
    case 'armor':      return <Shield className={cls} />;
    case 'consumable': return <Flame className={cls} />;
    case 'material':   return <Package className={cls} />;
    case 'gold':       return <Coins className={cls} />;
    case 'gem':        return <Gem className={cls} />;
    case 'rune':       return <Star className={cls} />;
    default:           return <Package className={cls} />;
  }
}

interface Props {
  canInteract: boolean;
  openReward:  ChestReward | null;
  onRewardClaimed: () => void;
  interactKey?: string;
}

export function ChestInteractionUI({
  canInteract,
  openReward,
  onRewardClaimed,
  interactKey = 'E'
}: Props) {
  const [closing, setClosing] = useState(false);
  const [goldAnimated, setGoldAnimated] = useState(false);

  useEffect(() => {
    if (openReward) {
      setClosing(false);
      setGoldAnimated(false);
      const t = setTimeout(() => setGoldAnimated(true), 200);
      return () => clearTimeout(t);
    }
  }, [openReward]);

  const handleClaim = useCallback(() => {
    setClosing(true);
    setTimeout(onRewardClaimed, 350);
  }, [onRewardClaimed]);

  const tierBg = openReward ? CHEST_TIER_BG[openReward.tier] : CHEST_TIER_BG.common;

  return (
    <>
      <AnimatePresence>
        {canInteract && !openReward && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none z-30"
            data-testid="chest-interact-prompt"
          >
            <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-xl">
              <kbd
                className="w-7 h-7 flex items-center justify-center rounded-md bg-amber-500 text-black font-bold text-sm shadow-[0_0_8px_rgba(245,158,11,0.7)]"
              >
                {interactKey}
              </kbd>
              <span className="text-white/90 text-sm font-medium">Open Chest</span>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openReward && !closing && (
          <motion.div
            key={openReward.chestId}
            initial={{ opacity: 0, scale: 0.82, y: 30 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{   opacity: 0, scale: 0.88,  y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
            data-testid="chest-reward-popup"
          >
            <div
              className={`
                pointer-events-auto relative w-[380px] max-h-[540px] overflow-y-auto
                rounded-2xl border bg-gradient-to-b ${tierBg} shadow-2xl
              `}
            >
              <button
                onClick={handleClaim}
                className="absolute top-3 right-3 text-white/50 hover:text-white/90 transition-colors z-10"
                data-testid="button-close-reward"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-5 pb-2">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src="/sprites/chests/chests_preview.gif"
                    alt="chest"
                    className="w-10 h-10 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div>
                    <h2 className="text-lg font-bold text-white font-['Cinzel'] leading-tight">
                      {CHEST_TIER_LABEL[openReward.tier]}
                    </h2>
                    <p className="text-xs text-white/50 uppercase tracking-wider">Rewards Claimed</p>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: 'auto' }}
                    className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-1.5"
                    data-testid="reward-gold"
                  >
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300 font-bold text-sm">
                      {goldAnimated ? openReward.gold.toLocaleString() : 0}
                    </span>
                    <span className="text-amber-400/60 text-xs">gold</span>
                  </motion.div>

                  <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-1.5"
                    data-testid="reward-xp"
                  >
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-300 font-bold text-sm">
                      +{openReward.xp.toLocaleString()}
                    </span>
                    <span className="text-blue-400/60 text-xs">xp</span>
                  </div>
                </div>

                {openReward.items.length > 0 && (
                  <div className="space-y-2" data-testid="reward-items">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Items</p>
                    {openReward.items.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 + 0.1 }}
                        className={`
                          flex items-center gap-3 rounded-xl px-3 py-2.5 border
                          ${RARITY_COLORS[item.rarity]}
                        `}
                        data-testid={`reward-item-${item.id}`}
                      >
                        <div className={RARITY_GLOW[item.rarity]}>
                          <ItemTypeIcon type={item.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm leading-tight truncate ${RARITY_GLOW[item.rarity]}`}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 border-0 ${RARITY_COLORS[item.rarity]}`}
                            >
                              {item.rarity}
                            </Badge>
                            <span className="text-white/30 text-xs">T{item.tier}</span>
                          </div>
                        </div>
                        {item.quantity > 1 && (
                          <span className="text-white/60 text-sm font-bold flex-shrink-0">
                            ×{item.quantity}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 pt-3">
                <Button
                  onClick={handleClaim}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
                  data-testid="button-claim-reward"
                >
                  Collect Rewards
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
