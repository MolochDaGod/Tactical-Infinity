/**
 * Types describing the live data the Cinzel HUD binds to.
 *
 * Callers populate `PlayerHudState` either from `captainManager`,
 * `gameFlowSystem`, or scene-specific stores. The HUD itself stays
 * dumb-presentation — no game logic.
 */

export type Faction = 'crusade' | 'fabled' | 'legion' | 'neutral' | 'pirate';
export type Race    = 'human' | 'barbarian' | 'dwarf' | 'elf' | 'orc' | 'undead';

export interface ResourceBar {
  current: number;
  max:     number;
}

export interface HotbarSlot {
  /** 1-9 slot index. */
  key:        number;
  /** Display label (skill/item name). */
  name:       string;
  /** Glyph or emoji icon. */
  icon:       string;
  /** Optional remaining cooldown in seconds (0 = ready, undefined = no CD). */
  cooldown?:  number;
  /** When true, slot ignores clicks. */
  disabled?:  boolean;
  /** Optional callback invoked on click / keypress. */
  onActivate?: () => void;
}

export interface EquippedItem {
  slot: 'weapon' | 'armor';
  name: string;
  icon: string;
}

export interface ChatMessage {
  id:        string | number;
  text:      string;
  /** Visual styling tag. */
  kind?:     'system' | 'self' | 'loot' | 'normal';
  /** Sender prefix shown before the text. */
  sender?:   string;
}

export interface PlayerHudState {
  /** Captain or player display name. */
  name:        string;
  /** Lv.X ClassName line ("Lv.42 Warrior"). */
  classLine:   string;
  /** Race used to pick the portrait glyph fallback. */
  race:        Race;
  /** Optional URL for a real portrait image. */
  portraitUrl?: string;
  /** Single-character glyph fallback when no portraitUrl. */
  portraitGlyph: string;
  faction:     Faction;

  hp:          ResourceBar;
  mp:          ResourceBar;
  sp:          ResourceBar;

  hotbar:      HotbarSlot[];
  equipped:    EquippedItem[];
  chat:        ChatMessage[];
}
