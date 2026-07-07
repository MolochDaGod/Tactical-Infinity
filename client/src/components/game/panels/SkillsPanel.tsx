import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Wind, Flame, Shield, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SkillData, GearSkill } from '../MainGamePanel';

interface SkillsPanelProps {
  skills?: SkillData[];
  gearSkills?: (GearSkill & { sourceSlot: string; sourceName: string })[];
  skillExperience?: number;
  onUpgradeSkill?: (skillId: string) => void;
  onUseSkill?: (skillId: string) => void;
}

const SKILL_TYPE_ICON: Record<string, any> = {
  active:   Zap,
  passive:  Wind,
  ultimate: Flame,
};

const SKILL_TYPE_STYLE: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  active:   { border: 'border-amber-500/40', bg: 'bg-amber-900/20', text: 'text-amber-300', badge: 'bg-amber-900/60 text-amber-300' },
  passive:  { border: 'border-purple-500/40', bg: 'bg-purple-900/20', text: 'text-purple-300', badge: 'bg-purple-900/60 text-purple-300' },
  ultimate: { border: 'border-red-500/50', bg: 'bg-red-900/20', text: 'text-red-300', badge: 'bg-red-900/60 text-red-300' },
};

const SLOT_DISPLAY: Record<string, string> = {
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

function GearSkillRow({
  skill,
  sourceName,
  sourceSlot,
  onUse,
}: {
  skill: GearSkill;
  sourceName: string;
  sourceSlot: string;
  onUse?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const style = SKILL_TYPE_STYLE[skill.type] || SKILL_TYPE_STYLE.active;
  const Icon = SKILL_TYPE_ICON[skill.type] || Zap;
  const isActive = skill.type === 'active' || skill.type === 'ultimate';

  return (
    <motion.div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        style.border, style.bg,
        hovered && 'brightness-110'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`gear-skill-row-${skill.id}`}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-lg border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all',
          style.border, style.bg,
          isActive && 'hover:scale-105'
        )}
        onClick={() => isActive && onUse?.()}
      >
        <Icon className={cn('w-5 h-5', style.text)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <h4 className={cn('font-bold text-sm', style.text)}>{skill.name}</h4>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium capitalize', style.badge)}>
            {skill.type}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-1.5 line-clamp-2">{skill.description}</p>
        <div className="flex items-center gap-3 text-[11px]">
          {skill.cooldown && (
            <span className="text-slate-500">{skill.cooldown}s cd</span>
          )}
          {skill.manaCost && (
            <span className="text-blue-400">{skill.manaCost} mana</span>
          )}
          {skill.damage && (
            <span className="text-red-400">{skill.damage} dmg</span>
          )}
          {skill.range && (
            <span className="text-slate-500">{skill.range}m range</span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[10px] text-slate-500 mb-0.5">from</div>
        <div className="text-[11px] text-amber-400 font-medium leading-tight">{sourceName}</div>
        <div className="text-[10px] text-slate-600">{SLOT_DISPLAY[sourceSlot] || sourceSlot}</div>
      </div>
    </motion.div>
  );
}

function CharacterSkillRow({
  skill,
  onUpgrade,
  onUse,
}: {
  skill: SkillData;
  onUpgrade?: () => void;
  onUse?: () => void;
}) {
  const isLocked = skill.level === 0;
  const isMaxLevel = skill.level >= skill.maxLevel;
  const isOnCooldown = skill.cooldownRemaining > 0;
  const cooldownPercent = skill.cooldown > 0 ? (skill.cooldownRemaining / skill.cooldown) : 0;

  return (
    <motion.div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isLocked
          ? 'bg-slate-800/20 border-slate-700/50 opacity-60'
          : 'bg-slate-800/40 border-slate-600/50 hover:border-slate-500/50'
      )}
      data-testid={`skill-row-${skill.id}`}
    >
      <div
        className={cn(
          'relative w-12 h-12 rounded-lg border-2 flex items-center justify-center flex-shrink-0 cursor-pointer',
          isLocked ? 'border-slate-600 bg-slate-800' : 'border-slate-500 bg-slate-700 hover:scale-105',
        )}
        onClick={() => !isLocked && !skill.isPassive && !isOnCooldown && onUse?.()}
      >
        {skill.icon ? (
          <img src={skill.icon} alt={skill.name} className={cn('w-8 h-8 object-contain', isLocked && 'grayscale')} />
        ) : (
          <Sparkles className={cn('w-5 h-5', isLocked ? 'text-slate-600' : 'text-slate-300')} />
        )}
        {isOnCooldown && !isLocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden bg-black/60">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="50%" cy="50%" r="45%" fill="none"
                stroke="rgba(239,191,64,0.5)" strokeWidth="3"
                strokeDasharray={`${(1 - cooldownPercent) * 100} 100`}
              />
            </svg>
            <span className="relative text-xs font-bold text-white z-10">{Math.ceil(skill.cooldownRemaining)}</span>
          </div>
        )}
        {skill.level > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-600 border border-slate-500 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-200">
            {skill.level}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className={cn('font-bold text-sm', isLocked ? 'text-slate-500' : 'text-slate-200')}>{skill.name}</h4>
          {skill.isPassive && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">Passive</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-1.5 line-clamp-2">{skill.description}</p>
        <div className="flex items-center gap-3 text-[11px]">
          {skill.manaCost > 0 && <span className="text-blue-400">{skill.manaCost} mp</span>}
          {skill.cooldown > 0 && <span className="text-slate-500">{skill.cooldown}s cd</span>}
          <span className="text-slate-600">Lv {skill.level}/{skill.maxLevel}</span>
        </div>
      </div>

      {skill.canUpgrade && !isMaxLevel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onUpgrade}
          className="flex-shrink-0 text-xs text-slate-400 border-slate-600 hover:text-slate-200 hover:border-slate-400"
          data-testid={`button-upgrade-${skill.id}`}
        >
          {isLocked ? 'Learn' : 'Upgrade'}
        </Button>
      )}
    </motion.div>
  );
}

type FilterMode = 'all' | 'active' | 'passive' | 'gear';

export function SkillsPanel({
  skills = [],
  gearSkills = [],
  skillExperience = 0,
  onUpgradeSkill,
  onUseSkill,
}: SkillsPanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const activeGear = gearSkills.filter((s) => s.type === 'active' || s.type === 'ultimate');
  const passiveGear = gearSkills.filter((s) => s.type === 'passive');

  const showGear = filter === 'all' || filter === 'gear';
  const showChar = filter === 'all' || filter === 'active' || filter === 'passive';

  const filteredSkills = showChar ? skills.filter((s) => {
    if (filter === 'active') return !s.isPassive;
    if (filter === 'passive') return s.isPassive;
    return true;
  }) : [];

  const totalActive = activeGear.length + skills.filter((s) => !s.isPassive && s.level > 0).length;
  const totalPassive = passiveGear.length + skills.filter((s) => s.isPassive && s.level > 0).length;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-base font-cinzel font-bold text-amber-200 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Skills
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">
            <span className="text-amber-400">{totalActive}</span> active &middot; <span className="text-purple-400">{totalPassive}</span> passive
          </div>
          {skillExperience > 0 && (
            <div className="flex items-center gap-1 text-amber-400 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-bold">{skillExperience}</span>
              <span className="text-slate-500">pts</span>
            </div>
          )}
        </div>
      </div>

      {/* Albion info banner if gear skills exist */}
      {gearSkills.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/20 border border-amber-600/30 rounded-lg text-xs text-amber-300/80 flex-shrink-0">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Your skills are determined by your equipment — equip different gear to change your abilities.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 flex-shrink-0">
        {(['all', 'gear', 'active', 'passive'] as FilterMode[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={cn(
              'text-xs h-7 px-3',
              filter === f
                ? 'bg-amber-700 text-white border-amber-600 hover:bg-amber-600'
                : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500'
            )}
            data-testid={`filter-skills-${f}`}
          >
            {f === 'gear' ? 'From Gear' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 pr-1">
          {/* Gear Skills Section */}
          {showGear && gearSkills.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">From Equipment</span>
                <div className="flex-1 h-px bg-amber-900/40" />
              </div>
              <div className="space-y-2">
                {activeGear.map((skill) => (
                  <GearSkillRow
                    key={skill.id}
                    skill={skill}
                    sourceName={skill.sourceName}
                    sourceSlot={skill.sourceSlot}
                    onUse={() => onUseSkill?.(skill.id)}
                  />
                ))}
                {passiveGear.map((skill) => (
                  <GearSkillRow
                    key={skill.id}
                    skill={skill}
                    sourceName={skill.sourceName}
                    sourceSlot={skill.sourceSlot}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No gear skills empty state */}
          {showGear && gearSkills.length === 0 && filter === 'gear' && (
            <div className="text-center py-8 text-slate-600 text-sm">
              No skills from equipment — equip items to unlock abilities
            </div>
          )}

          {/* Character Skills Section */}
          {showChar && filteredSkills.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Character Skills</span>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>
              <div className="space-y-2">
                {filteredSkills.map((skill) => (
                  <CharacterSkillRow
                    key={skill.id}
                    skill={skill}
                    onUpgrade={() => onUpgradeSkill?.(skill.id)}
                    onUse={() => onUseSkill?.(skill.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All empty state */}
          {gearSkills.length === 0 && filteredSkills.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <div className="text-sm">No skills available</div>
              <div className="text-xs mt-1">Equip items or learn skills to see them here</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
