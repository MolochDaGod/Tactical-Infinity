import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, Crown, Shirt, Hand, Footprints, Circle, Zap, Wind, Star, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CharacterData, InventoryData, ItemData, EquipmentSlot, GearSkill } from '../MainGamePanel';

interface EquipmentPanelProps {
  characterData?: CharacterData;
  inventoryData?: InventoryData;
  /** Click a slot to cycle/unequip the gear resolved from the catalogue. */
  onSlotClick?: (slotType: string) => void;
}

const SLOT_ICONS: Record<string, any> = {
  head: Crown,
  chest: Shirt,
  hands: Hand,
  legs: Shirt,
  feet: Footprints,
  mainHand: Sword,
  offHand: Shield,
  accessory1: Circle,
  accessory2: Star,
};

const SLOT_LABELS: Record<string, string> = {
  head: 'Helm',
  chest: 'Armor',
  hands: 'Gloves',
  legs: 'Legs',
  feet: 'Boots',
  mainHand: 'Weapon',
  offHand: 'Off-Hand',
  accessory1: 'Ring',
  accessory2: 'Amulet',
};

const RARITY_COLORS: Record<string, string> = {
  common:    'border-slate-500',
  uncommon:  'border-green-500',
  rare:      'border-blue-500',
  epic:      'border-purple-500',
  legendary: 'border-amber-500',
};

const RARITY_GLOW: Record<string, string> = {
  common:    '',
  uncommon:  'shadow-green-900/60',
  rare:      'shadow-blue-900/60',
  epic:      'shadow-purple-900/60',
  legendary: 'shadow-amber-900/80',
};

const RARITY_BG: Record<string, string> = {
  common:    'bg-slate-800/60',
  uncommon:  'bg-green-900/30',
  rare:      'bg-blue-900/30',
  epic:      'bg-purple-900/30',
  legendary: 'bg-amber-900/30',
};

const RARITY_TEXT: Record<string, string> = {
  common:    'text-slate-300',
  uncommon:  'text-green-400',
  rare:      'text-blue-400',
  epic:      'text-purple-400',
  legendary: 'text-amber-300',
};

const SKILL_TYPE_COLORS: Record<string, string> = {
  active:   'bg-amber-900/50 border-amber-500/40 text-amber-300',
  passive:  'bg-purple-900/50 border-purple-500/40 text-purple-300',
  ultimate: 'bg-red-900/50 border-red-500/40 text-red-300',
};

const SKILL_TYPE_ICONS: Record<string, any> = {
  active:   Zap,
  passive:  Wind,
  ultimate: Flame,
};

function ItemTooltip({ item }: { item: ItemData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="absolute z-[60] left-full ml-3 top-0 w-56 bg-slate-900/98 border border-amber-500/30 rounded-lg shadow-2xl pointer-events-none"
      style={{ minWidth: 200 }}
    >
      <div className="p-3">
        <div className={cn('font-cinzel font-bold text-sm mb-0.5', RARITY_TEXT[item.rarity])}>
          {item.name}
        </div>
        <div className="text-xs text-slate-400 mb-2">
          {SLOT_LABELS[item.type] || item.type} · Tier {item.tier}
          {item.itemPower ? ` · IP ${item.itemPower}` : ''}
        </div>
        {item.stats && Object.entries(item.stats).length > 0 && (
          <div className="border-t border-slate-700 pt-2 mb-2 space-y-0.5">
            {Object.entries(item.stats).map(([stat, val]) => (
              <div key={stat} className="flex justify-between text-xs">
                <span className="text-slate-400 capitalize">{stat}</span>
                <span className="text-green-400 font-bold">+{val}</span>
              </div>
            ))}
          </div>
        )}
        {item.grantedSkills && item.grantedSkills.length > 0 && (
          <div className="border-t border-slate-700 pt-2 mb-2">
            <div className="text-xs text-amber-400 mb-1 font-bold">Grants:</div>
            {item.grantedSkills.map((skill) => {
              const Icon = SKILL_TYPE_ICONS[skill.type] || Zap;
              return (
                <div key={skill.id} className={cn('flex items-center gap-1.5 rounded px-1.5 py-1 border mb-1', SKILL_TYPE_COLORS[skill.type])}>
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold leading-tight">{skill.name}</div>
                    <div className="text-[10px] opacity-70 leading-tight">{skill.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {item.durability !== undefined && item.maxDurability && (
          <div className="text-xs text-slate-500 border-t border-slate-700 pt-2">
            Durability {item.durability}/{item.maxDurability}
          </div>
        )}
        <div className="text-[10px] text-slate-500 italic mt-1">{item.description}</div>
      </div>
    </motion.div>
  );
}

function GearSlot({
  slotType,
  item,
  size = 'md',
  onSlotClick,
}: {
  slotType: string;
  item: ItemData | null;
  size?: 'sm' | 'md' | 'lg';
  onSlotClick?: (slotType: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = SLOT_ICONS[slotType] || Circle;
  const label = SLOT_LABELS[slotType] || slotType;
  const sizeClasses = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-11 h-11' : 'w-14 h-14';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <motion.div
          className={cn(
            sizeClasses,
            'relative rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all',
            item ? RARITY_COLORS[item.rarity] : 'border-slate-600/50',
            item ? RARITY_BG[item.rarity] : 'bg-slate-800/40',
            item && RARITY_GLOW[item.rarity] && `shadow-lg ${RARITY_GLOW[item.rarity]}`,
            hovered && 'scale-105',
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => onSlotClick?.(slotType)}
          data-testid={`equipment-slot-${slotType}`}
          whileHover={{ scale: 1.06 }}
        >
          {item ? (
            item.icon ? (
              <img src={item.icon} alt={item.name} className="w-10 h-10 object-contain" />
            ) : (
              <Icon className={cn('w-6 h-6', RARITY_TEXT[item.rarity])} />
            )
          ) : (
            <Icon className="w-5 h-5 text-slate-600" />
          )}

          {item?.durability !== undefined && item.maxDurability && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
              />
            </div>
          )}

          {hovered && item && (
            <ItemTooltip item={item} />
          )}
        </motion.div>

        {item && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-800 border border-amber-600/50 rounded-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-amber-400">{item.tier}</span>
          </div>
        )}
      </div>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function GearSkillBadge({
  skill,
  sourceName,
}: {
  skill: GearSkill;
  sourceName: string;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = SKILL_TYPE_ICONS[skill.type] || Zap;

  return (
    <div className="relative">
      <motion.div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer',
          SKILL_TYPE_COLORS[skill.type],
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.04 }}
        data-testid={`gear-skill-${skill.id}`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-bold leading-tight truncate">{skill.name}</div>
          <div className="text-[10px] opacity-60 leading-tight capitalize">{skill.type}</div>
        </div>
        {skill.cooldown && (
          <span className="text-[9px] opacity-60 flex-shrink-0">{skill.cooldown}s</span>
        )}
      </motion.div>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full mb-2 left-0 z-50 w-52 bg-slate-900 border border-amber-500/30 rounded-lg p-3 shadow-2xl pointer-events-none"
          >
            <div className={cn('font-bold text-sm mb-1', SKILL_TYPE_COLORS[skill.type].split(' ')[2])}>
              {skill.name}
            </div>
            <div className="text-xs text-slate-400 mb-1">{skill.description}</div>
            <div className="text-[10px] text-slate-500">From: <span className="text-amber-400">{sourceName}</span></div>
            {skill.cooldown && <div className="text-[10px] text-slate-500">Cooldown: {skill.cooldown}s</div>}
            {skill.manaCost && <div className="text-[10px] text-blue-400">Mana: {skill.manaCost}</div>}
            {skill.damage && <div className="text-[10px] text-red-400">Damage: {skill.damage}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EquipmentPanel({ characterData, inventoryData, onSlotClick }: EquipmentPanelProps) {
  const defaultSlots: EquipmentSlot[] = [
    { slotType: 'head', item: null },
    { slotType: 'chest', item: null },
    { slotType: 'hands', item: null },
    { slotType: 'legs', item: null },
    { slotType: 'feet', item: null },
    { slotType: 'mainHand', item: null },
    { slotType: 'offHand', item: null },
    { slotType: 'accessory1', item: null },
    { slotType: 'accessory2', item: null },
  ];

  const equipment = characterData?.equipment || defaultSlots;
  const slotMap = Object.fromEntries(equipment.map((s) => [s.slotType, s.item]));

  const grantedSkills: (GearSkill & { sourceName: string })[] = [];
  for (const slot of equipment) {
    if (!slot.item?.grantedSkills) continue;
    for (const skill of slot.item.grantedSkills) {
      grantedSkills.push({ ...skill, sourceName: slot.item.name });
    }
  }

  const activeSkills = grantedSkills.filter((s) => s.type === 'active' || s.type === 'ultimate');
  const passiveSkills = grantedSkills.filter((s) => s.type === 'passive');

  const equippedCount = equipment.filter((s) => s.item !== null).length;
  const totalItems = equipment.length;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Main layout: paperdoll area */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Left column: weapon hand + armor sides */}
        <div className="flex flex-col gap-3 justify-center items-center w-20 flex-shrink-0">
          <GearSlot slotType="mainHand" item={slotMap['mainHand']} onSlotClick={onSlotClick} />
          <GearSlot slotType="hands" item={slotMap['hands']} onSlotClick={onSlotClick} />
          <GearSlot slotType="accessory1" item={slotMap['accessory1']} onSlotClick={onSlotClick} />
        </div>

        {/* Center: character silhouette + stacked armor */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <GearSlot slotType="head" item={slotMap['head']} size="lg" onSlotClick={onSlotClick} />

          {/* Silhouette placeholder */}
          <div className="relative flex-1 min-h-0 w-32 flex items-center justify-center">
            <div className="w-20 h-full max-h-36 border border-dashed border-slate-700/60 rounded-xl flex items-center justify-center bg-slate-800/20">
              <div className="text-slate-700 text-xs font-cinzel text-center leading-tight px-2">
                Character<br/>Preview
              </div>
            </div>
          </div>

          <GearSlot slotType="chest" item={slotMap['chest']} onSlotClick={onSlotClick} />
          <GearSlot slotType="legs" item={slotMap['legs']} onSlotClick={onSlotClick} />
          <GearSlot slotType="feet" item={slotMap['feet']} size="sm" onSlotClick={onSlotClick} />
        </div>

        {/* Right column: off-hand + accessories */}
        <div className="flex flex-col gap-3 justify-center items-center w-20 flex-shrink-0">
          <GearSlot slotType="offHand" item={slotMap['offHand']} onSlotClick={onSlotClick} />
          <GearSlot slotType="accessory2" item={slotMap['accessory2']} onSlotClick={onSlotClick} />
          <div className="w-14 h-11 rounded-lg border-2 border-dashed border-slate-700/30 flex items-center justify-center">
            <span className="text-[9px] text-slate-600 text-center">Mount</span>
          </div>
        </div>

        {/* Stats column */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3 flex-1">
            <div className="text-xs font-bold text-amber-400 mb-2 font-cinzel">Character Stats</div>
            {characterData?.stats ? (
              <div className="space-y-1.5">
                <MiniStatBar label="HP" current={characterData.stats.health} max={characterData.stats.maxHealth} color="bg-red-500" />
                <MiniStatBar label="MP" current={characterData.stats.mana} max={characterData.stats.maxMana} color="bg-blue-500" />
                <MiniStatBar label="SP" current={characterData.stats.stamina} max={characterData.stats.maxStamina} color="bg-green-500" />
                <div className="pt-1.5 border-t border-slate-700 grid grid-cols-2 gap-1">
                  <StatPill label="STR" value={characterData.stats.strength} />
                  <StatPill label="AGI" value={characterData.stats.agility} />
                  <StatPill label="DEX" value={characterData.stats.dexterity} />
                  <StatPill label="INT" value={characterData.stats.intellect} />
                  <StatPill label="VIT" value={characterData.stats.vitality} />
                  <StatPill label="END" value={characterData.stats.endurance} />
                  <StatPill label="WIS" value={characterData.stats.wisdom} />
                  <StatPill label="TAC" value={characterData.stats.tactics} />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">No data</div>
            )}
          </div>

          <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3">
            <div className="text-xs font-bold text-slate-400 mb-1">Equipment</div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Slots filled</span>
              <span className="text-amber-400 font-bold">{equippedCount}/{totalItems}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Granted Skills Section */}
      {grantedSkills.length > 0 ? (
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 font-cinzel">Skills from Equipment</span>
            <span className="text-xs text-slate-500">({grantedSkills.length} total)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeSkills.map((skill) => (
              <GearSkillBadge key={skill.id} skill={skill} sourceName={skill.sourceName} />
            ))}
            {passiveSkills.map((skill) => (
              <GearSkillBadge key={skill.id} skill={skill} sourceName={skill.sourceName} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/20 rounded-lg border border-dashed border-slate-700/40 p-3 flex-shrink-0 text-center">
          <div className="text-xs text-slate-600">Equip items to gain skills — each piece of gear grants unique abilities</div>
        </div>
      )}
    </div>
  );
}

function MiniStatBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-500 w-5 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min((current / max) * 100, 100)}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 w-12 text-right flex-shrink-0">{current}/{max}</span>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-700/50 rounded text-[10px]">
      <span className="text-amber-500 font-bold">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
