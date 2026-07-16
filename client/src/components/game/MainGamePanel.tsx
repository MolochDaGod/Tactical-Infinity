import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { X, Shield, Swords, Sparkles, Hammer, Scroll, Users, Package, Ship } from 'lucide-react';

import { EquipmentPanel } from './panels/EquipmentPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { CraftingPanel } from './panels/CraftingPanel';
import { AttributesPanel } from './panels/AttributesPanel';
import { GuildPanel } from './panels/GuildPanel';
import { ShipCraftPanel } from './panels/ShipCraftPanel';

import { loadGearCatalogue, localCatalogue, gearForSlot } from '@/lib/gear/catalogue';
import {
  getLoadout, setSlot, resolveLoadout, subscribeLoadout, PLAYER_LOADOUT_ID,
} from '@/lib/gear/loadout';
import { PANEL_SLOT_TO_GEAR, type GearItem } from '@shared/gameDefinitions/gear';

interface MainGamePanelProps {
  isOpen: boolean;
  onClose: () => void;
  hotKey?: string;
  defaultTab?: string;
  characterData?: CharacterData;
  inventoryData?: InventoryData;
  skillsData?: SkillData[];
  guildData?: GuildData;
}

export interface GearSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'active' | 'passive' | 'ultimate';
  cooldown?: number;
  manaCost?: number;
  staminaCost?: number;
  damage?: string;
  range?: number;
}

export interface CharacterData {
  id: string;
  name: string;
  level: number;
  experience: number;
  maxExperience: number;
  faction: 'Crusade' | 'Fabled' | 'Legion';
  race: string;
  class: string;
  gold: number;
  stats: CharacterStats;
  equipment: EquipmentSlot[];
}

export interface CharacterStats {
  strength: number;
  agility: number;
  dexterity: number;
  intellect: number;
  vitality: number;
  endurance: number;
  wisdom: number;
  tactics: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
}

export interface EquipmentSlot {
  slotType: 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'mainHand' | 'offHand' | 'accessory1' | 'accessory2';
  item: ItemData | null;
}

export interface ItemData {
  id: string;
  name: string;
  type: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  tier: number;
  icon: string;
  stackSize: number;
  amount: number;
  durability?: number;
  maxDurability?: number;
  stats?: Record<string, number>;
  description: string;
  isUsable?: boolean;
  cooldown?: number;
  cooldownRemaining?: number;
  itemPower?: number;
  grantedSkills?: GearSkill[];
}

export interface InventoryData {
  slots: (ItemData | null)[];
  maxSlots: number;
  gold: number;
  trash: ItemData | null;
}

export interface SkillData {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  icon: string;
  description: string;
  cooldown: number;
  cooldownRemaining: number;
  manaCost: number;
  isPassive: boolean;
  canUpgrade: boolean;
  upgradeCost: number;
}

export interface GuildData {
  id: string;
  name: string;
  master: string;
  notice: string;
  memberCount: number;
  maxMembers: number;
  members: GuildMember[];
  rank: number;
}

export interface GuildMember {
  name: string;
  level: number;
  rank: number;
  online: boolean;
}

const FACTION_COLORS: Record<string, string> = {
  Crusade: 'text-amber-400 bg-amber-900/30 border-amber-600/50',
  Fabled: 'text-emerald-400 bg-emerald-900/30 border-emerald-600/50',
  Legion: 'text-red-400 bg-red-900/30 border-red-600/50',
};

const PANEL_TABS = [
  { id: 'equipment', label: 'Equipment', icon: Shield },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'attributes', label: 'Attributes', icon: Sparkles },
  { id: 'skills', label: 'Skills', icon: Swords },
  { id: 'crafting', label: 'Crafting', icon: Hammer },
  { id: 'ships', label: 'Ships', icon: Ship },
  { id: 'quests', label: 'Quests', icon: Scroll },
  { id: 'guild', label: 'Guild', icon: Users },
] as const;

function deriveGearSkills(equipment: EquipmentSlot[]): (GearSkill & { sourceSlot: string; sourceName: string })[] {
  const result: (GearSkill & { sourceSlot: string; sourceName: string })[] = [];
  for (const slot of equipment) {
    if (!slot.item?.grantedSkills) continue;
    for (const skill of slot.item.grantedSkills) {
      result.push({ ...skill, sourceSlot: slot.slotType, sourceName: slot.item.name });
    }
  }
  return result;
}

function calcTotalItemPower(equipment: EquipmentSlot[]): number {
  let total = 0;
  let count = 0;
  for (const slot of equipment) {
    if (slot.item?.itemPower) {
      total += slot.item.itemPower;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

const PANEL_EQUIP_SLOTS: EquipmentSlot['slotType'][] = [
  'head', 'chest', 'hands', 'legs', 'feet', 'mainHand', 'offHand', 'accessory1', 'accessory2',
];

const DEFAULT_STATS: CharacterStats = {
  strength: 10, agility: 10, dexterity: 10, intellect: 10, vitality: 10,
  endurance: 10, wisdom: 10, tactics: 10,
  health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100,
};

function gearToItemData(g: GearItem): ItemData {
  return {
    id: g.id,
    name: g.name,
    type: g.slot,
    rarity: g.rarity,
    tier: g.tier,
    icon: g.icon ?? '',
    stackSize: 1,
    amount: 1,
    stats: g.stats,
    description: g.description ?? '',
    isUsable: true,
  };
}

/**
 * Sources the in-game Equipment + Inventory panels from the canonical gear
 * catalogue and the persisted player loadout, and returns equip/unequip
 * handlers. Used whenever the host does not pass explicit `characterData` /
 * `inventoryData`, so these panels stay consistent with the 3D gear the player
 * actually carries (EquipmentDemo, IslandBattlePage) rather than showing stubs.
 */
function usePlayerGearPanels(): {
  characterData: CharacterData;
  inventoryData: InventoryData;
  onSlotClick: (slotType: string) => void;
  onUseItem: (index: number) => void;
} {
  const [catalogue, setCatalogue] = useState<GearItem[]>(() => localCatalogue());
  const [, forceTick] = useState(0);

  useEffect(() => {
    let live = true;
    loadGearCatalogue().then((c) => { if (live) setCatalogue(c); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => subscribeLoadout(() => forceTick((n) => n + 1)), []);

  const loadout = getLoadout(PLAYER_LOADOUT_ID);
  const resolved = resolveLoadout(loadout, catalogue);

  const equipment: EquipmentSlot[] = PANEL_EQUIP_SLOTS.map((slotType) => {
    const gearSlot = PANEL_SLOT_TO_GEAR[slotType];
    // Both accessory panel slots map to the single canonical `accessory` slot —
    // only surface it once (in accessory1) so it isn't duplicated.
    const g = slotType === 'accessory2' ? undefined : resolved[gearSlot];
    return { slotType, item: g ? gearToItemData(g) : null };
  });

  const equippedIds = new Set(Object.values(loadout).filter(Boolean) as string[]);
  const invGear = catalogue.filter((g) => !equippedIds.has(g.id));
  const inventorySlots = invGear.map(gearToItemData);

  const characterData: CharacterData = {
    id: PLAYER_LOADOUT_ID,
    name: 'Player',
    level: 1,
    experience: 0,
    maxExperience: 100,
    faction: 'Crusade',
    race: '—',
    class: '—',
    gold: 0,
    stats: DEFAULT_STATS,
    equipment,
  };

  const inventoryData: InventoryData = {
    slots: inventorySlots,
    maxSlots: Math.max(40, inventorySlots.length),
    gold: 0,
    trash: null,
  };

  const onSlotClick = useCallback((slotType: string) => {
    const gearSlot = PANEL_SLOT_TO_GEAR[slotType];
    if (!gearSlot) return;
    const options = gearForSlot(catalogue, gearSlot);
    if (options.length === 0) return;
    const currentId = getLoadout(PLAYER_LOADOUT_ID)[gearSlot];
    const idx = options.findIndex((g) => g.id === currentId);
    const next = options[idx + 1]; // undefined past the end → unequip
    setSlot(PLAYER_LOADOUT_ID, gearSlot, next ? next.id : null);
  }, [catalogue]);

  const onUseItem = useCallback((index: number) => {
    const g = invGear[index];
    if (!g) return;
    setSlot(PLAYER_LOADOUT_ID, g.slot, g.id);
  }, [invGear]);

  return { characterData, inventoryData, onSlotClick, onUseItem };
}

export function MainGamePanel({
  isOpen,
  onClose,
  hotKey = 'C',
  defaultTab = 'equipment',
  characterData,
  inventoryData,
  skillsData,
  guildData,
}: MainGamePanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const derived = usePlayerGearPanels();
  const effectiveCharacter = characterData ?? derived.characterData;
  const effectiveInventory = inventoryData ?? derived.inventoryData;
  const slotClickHandler = characterData ? undefined : derived.onSlotClick;
  const useItemHandler = inventoryData ? undefined : derived.onUseItem;

  const isInputFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).contentEditable === 'true';
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === hotKey.toLowerCase() && !isInputFocused()) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotKey, isOpen, onClose, isInputFocused]);

  if (!isOpen) return null;

  const xpPercent = effectiveCharacter
    ? Math.round((effectiveCharacter.experience / effectiveCharacter.maxExperience) * 100)
    : 0;
  const totalItemPower = effectiveCharacter ? calcTotalItemPower(effectiveCharacter.equipment) : 0;
  const gearSkills = effectiveCharacter ? deriveGearSkills(effectiveCharacter.equipment) : [];
  const factionColor = FACTION_COLORS[effectiveCharacter?.faction || 'Crusade'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        data-testid="main-game-panel-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 16, scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 16, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          className="relative w-[960px] max-w-[96vw] h-[720px] max-h-[92vh] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          data-testid="main-game-panel"
        >
          <div className="absolute inset-0 bg-[url('/textures/paper_texture.png')] opacity-[0.03] pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center gap-4 px-5 pt-4 pb-3 border-b border-amber-500/20 bg-gradient-to-r from-slate-800/80 to-transparent flex-shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Character name + badges */}
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <h2 className="font-cinzel font-bold text-amber-100 text-lg truncate">
                  {effectiveCharacter?.name || 'Character'}
                </h2>
                <span className="text-sm text-amber-300/70 font-bold flex-shrink-0">
                  Lv.{effectiveCharacter?.level || 1}
                </span>
              </div>
              {effectiveCharacter && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${factionColor}`}>
                    {effectiveCharacter.faction}
                  </span>
                  <span className="text-xs text-slate-400">
                    {effectiveCharacter.race} {effectiveCharacter.class}
                  </span>
                </div>
              )}
              {totalItemPower > 0 && (
                <span className="text-xs text-amber-300 bg-amber-900/30 border border-amber-600/30 px-2 py-0.5 rounded font-mono font-bold flex-shrink-0">
                  IP {totalItemPower}
                </span>
              )}
            </div>

            {/* XP bar */}
            {effectiveCharacter && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-xs text-slate-400">{xpPercent}% XP</div>
                <div className="w-28 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {effectiveCharacter && (
                <div className="flex items-center gap-1 text-sm text-amber-400">
                  <span className="text-yellow-400">◆</span>
                  <span className="font-bold">{effectiveCharacter.gold.toLocaleString()}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="w-7 h-7 text-slate-400 hover:text-amber-100 hover:bg-amber-900/30"
                data-testid="button-close-panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="flex gap-0.5 px-4 py-1.5 bg-slate-900/60 border-b border-amber-500/15 flex-shrink-0">
              {PANEL_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-amber-200 data-[state=active]:text-amber-100 data-[state=active]:bg-amber-900/30 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 rounded-t transition-all"
                    data-testid={`tab-${tab.id}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 min-h-0 overflow-hidden">
              <TabsContent value="equipment" className="h-full m-0 p-4">
                <EquipmentPanel
                  characterData={effectiveCharacter}
                  inventoryData={effectiveInventory}
                  onSlotClick={slotClickHandler}
                />
              </TabsContent>

              <TabsContent value="inventory" className="h-full m-0 p-4">
                <InventoryPanel
                  inventoryData={effectiveInventory}
                  onUseItem={useItemHandler}
                />
              </TabsContent>

              <TabsContent value="attributes" className="h-full m-0 p-4">
                <AttributesPanel characterData={effectiveCharacter} />
              </TabsContent>

              <TabsContent value="skills" className="h-full m-0 p-4">
                <SkillsPanel
                  skills={skillsData}
                  gearSkills={gearSkills}
                  skillExperience={0}
                />
              </TabsContent>

              <TabsContent value="crafting" className="h-full m-0 p-4">
                <CraftingPanel inventoryData={effectiveInventory} />
              </TabsContent>

              <TabsContent value="ships" className="h-full m-0 p-4">
                <ShipCraftPanel />
              </TabsContent>

              <TabsContent value="quests" className="h-full m-0 p-4">
                <div className="flex items-center justify-center h-full text-slate-500 font-cinzel">
                  Quest journal coming soon...
                </div>
              </TabsContent>

              <TabsContent value="guild" className="h-full m-0 p-4">
                <GuildPanel guildData={guildData} />
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
