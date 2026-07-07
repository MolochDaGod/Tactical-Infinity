import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, Plus, Minus, RotateCcw, Save, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { CharacterData, CharacterStats } from '../MainGamePanel';

interface AttributesPanelProps {
  characterData?: CharacterData;
  availablePoints?: number;
  onAllocatePoints?: (allocations: Record<string, number>) => void;
}

interface AttributeConfig {
  key: keyof CharacterStats;
  label: string;
  description: string;
  color: string;
  icon: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  {
    key: 'strength',
    label: 'Strength',
    description: 'Increases physical damage and carry capacity',
    color: 'red',
    icon: '/icons/attributes/strength.png',
  },
  {
    key: 'agility',
    label: 'Agility',
    description: 'Increases dodge chance and movement speed',
    color: 'cyan',
    icon: '/icons/attributes/agility.png',
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    description: 'Increases ranged accuracy, critical chance, and attack speed',
    color: 'amber',
    icon: '/icons/attributes/dexterity.png',
  },
  {
    key: 'intellect',
    label: 'Intellect',
    description: 'Increases magic damage and mana pool',
    color: 'blue',
    icon: '/icons/attributes/intellect.png',
  },
  {
    key: 'vitality',
    label: 'Vitality',
    description: 'Increases maximum health and health regeneration',
    color: 'green',
    icon: '/icons/attributes/vitality.png',
  },
  {
    key: 'endurance',
    label: 'Endurance',
    description: 'Increases physical resistance and block chance',
    color: 'slate',
    icon: '/icons/attributes/endurance.png',
  },
  {
    key: 'wisdom',
    label: 'Wisdom',
    description: 'Increases mana regeneration and magic resistance',
    color: 'purple',
    icon: '/icons/attributes/wisdom.png',
  },
  {
    key: 'tactics',
    label: 'Tactics',
    description: 'Increases experience gain and grants combat bonuses',
    color: 'indigo',
    icon: '/icons/attributes/tactics.png',
  },
];

function AttributeRow({
  config,
  baseValue,
  bonusValue,
  pendingChange,
  canIncrease,
  canDecrease,
  onIncrease,
  onDecrease,
}: {
  config: AttributeConfig;
  baseValue: number;
  bonusValue: number;
  pendingChange: number;
  canIncrease: boolean;
  canDecrease: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const totalValue = baseValue + bonusValue + pendingChange;

  return (
    <motion.div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border transition-all',
        isHovered ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800/30 border-slate-700'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`attribute-${config.key}`}
    >
      <div className="w-12 h-12 rounded-lg bg-slate-900/60 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
        <img
          src={config.icon}
          alt={config.label}
          className="w-full h-full object-cover"
          style={{ imageRendering: 'pixelated' }}
          data-testid={`icon-attribute-${config.key}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-amber-100">{config.label}</span>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-white">{totalValue}</span>
            {bonusValue > 0 && (
              <span className="text-sm text-green-400">(+{bonusValue})</span>
            )}
            {pendingChange !== 0 && (
              <span className={cn(
                'text-sm font-bold',
                pendingChange > 0 ? 'text-cyan-400' : 'text-red-400'
              )}>
                ({pendingChange > 0 ? '+' : ''}{pendingChange})
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 truncate">{config.description}</p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canDecrease}
          onClick={onDecrease}
          className="w-8 h-8 text-red-400 hover:bg-red-900/30 disabled:opacity-30"
          data-testid={`decrease-${config.key}`}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canIncrease}
          onClick={onIncrease}
          className="w-8 h-8 text-green-400 hover:bg-green-900/30 disabled:opacity-30"
          data-testid={`increase-${config.key}`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function DerivedStat({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  const percent = max > 0 ? (current / max) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-medium">{current} / {max}</span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full', `bg-${color}-500`)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

export function AttributesPanel({
  characterData,
  availablePoints = 5,
  onAllocatePoints,
}: AttributesPanelProps) {
  const [pendingAllocations, setPendingAllocations] = useState<Record<string, number>>({});
  
  const stats = characterData?.stats;
  const totalPending = Object.values(pendingAllocations).reduce((a, b) => a + b, 0);
  const remainingPoints = availablePoints - totalPending;

  const handleIncrease = (key: string) => {
    if (remainingPoints > 0) {
      setPendingAllocations((prev) => ({
        ...prev,
        [key]: (prev[key] || 0) + 1,
      }));
    }
  };

  const handleDecrease = (key: string) => {
    const current = pendingAllocations[key] || 0;
    if (current > 0) {
      setPendingAllocations((prev) => ({
        ...prev,
        [key]: current - 1,
      }));
    }
  };

  const handleReset = () => {
    setPendingAllocations({});
  };

  const handleSave = () => {
    if (totalPending > 0) {
      onAllocatePoints?.(pendingAllocations);
      setPendingAllocations({});
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-cinzel font-bold text-amber-200 flex items-center gap-2">
          <ChevronUp className="w-5 h-5" />
          Attributes
        </h3>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-cyan-400">{remainingPoints}</span>
          <span className="text-sm text-slate-400">Points Available</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1">
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Primary Attributes</h4>
          <div className="space-y-2">
            {ATTRIBUTES.map((config) => (
              <AttributeRow
                key={config.key}
                config={config}
                baseValue={stats?.[config.key] as number || 10}
                bonusValue={0}
                pendingChange={pendingAllocations[config.key] || 0}
                canIncrease={remainingPoints > 0}
                canDecrease={(pendingAllocations[config.key] || 0) > 0}
                onIncrease={() => handleIncrease(config.key)}
                onDecrease={() => handleDecrease(config.key)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Derived Stats</h4>
          
          <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4 space-y-4">
            <DerivedStat
              label="Health"
              current={stats?.health || 100}
              max={stats?.maxHealth || 100}
              color="red"
            />
            <DerivedStat
              label="Mana"
              current={stats?.mana || 50}
              max={stats?.maxMana || 50}
              color="blue"
            />
            <DerivedStat
              label="Stamina"
              current={stats?.stamina || 100}
              max={stats?.maxStamina || 100}
              color="green"
            />
          </div>

          <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
            <h5 className="text-sm font-bold text-amber-200 mb-3">Combat Stats</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Physical DMG</span>
                <span className="text-white font-medium">{10 + (stats?.strength || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Magic DMG</span>
                <span className="text-white font-medium">{10 + (stats?.intellect || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Attack Speed</span>
                <span className="text-white font-medium">{(1 + (stats?.agility || 0) * 0.01).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Critical %</span>
                <span className="text-white font-medium">{(5 + (stats?.dexterity || 0) * 0.5).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phys Resist</span>
                <span className="text-white font-medium">{(stats?.endurance || 0) * 2}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Magic Resist</span>
                <span className="text-white font-medium">{(stats?.wisdom || 0) * 2}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">HP Regen</span>
                <span className="text-white font-medium">+{((stats?.vitality || 0) * 0.2).toFixed(1)}/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">XP Bonus</span>
                <span className="text-white font-medium">+{((stats?.tactics || 0) * 1.0).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {characterData && (
            <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
              <h5 className="text-sm font-bold text-amber-200 mb-3">Character Info</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Faction</span>
                  <span className="text-amber-400">{characterData.faction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Race</span>
                  <span className="text-white">{characterData.race}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Class</span>
                  <span className="text-white">{characterData.class}</span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Experience</span>
                    <span className="text-slate-300">
                      {characterData.experience} / {characterData.maxExperience}
                    </span>
                  </div>
                  <Progress
                    value={(characterData.experience / characterData.maxExperience) * 100}
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {totalPending > 0 && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-slate-400 border-slate-600"
            data-testid="button-reset-attributes"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-500 text-white"
            data-testid="button-save-attributes"
          >
            <Save className="w-4 h-4 mr-2" />
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
}
