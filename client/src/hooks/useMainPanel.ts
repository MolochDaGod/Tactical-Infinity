import { useState, useCallback, useEffect } from 'react';

export type PanelTab = 'equipment' | 'attributes' | 'skills' | 'crafting' | 'quests' | 'guild';

interface UseMainPanelOptions {
  hotKey?: string;
  defaultTab?: PanelTab;
  onOpen?: () => void;
  onClose?: () => void;
}

interface UseMainPanelReturn {
  isOpen: boolean;
  activeTab: PanelTab;
  open: (tab?: PanelTab) => void;
  close: () => void;
  toggle: (tab?: PanelTab) => void;
  setActiveTab: (tab: PanelTab) => void;
}

function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  const tagName = activeElement.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    (activeElement as HTMLElement).contentEditable === 'true'
  );
}

export function useMainPanel(options: UseMainPanelOptions = {}): UseMainPanelReturn {
  const { hotKey = 'c', defaultTab = 'equipment', onOpen, onClose } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>(defaultTab);

  const open = useCallback((tab?: PanelTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback((tab?: PanelTab) => {
    if (isOpen) {
      close();
    } else {
      open(tab);
    }
  }, [isOpen, open, close]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.key.toLowerCase() === hotKey.toLowerCase()) {
        e.preventDefault();
        toggle();
      }

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotKey, isOpen, toggle, close]);

  return {
    isOpen,
    activeTab,
    open,
    close,
    toggle,
    setActiveTab,
  };
}

export interface PanelHotkeys {
  character: string;
  inventory: string;
  skills: string;
  crafting: string;
  quests: string;
  guild: string;
}

export const DEFAULT_PANEL_HOTKEYS: PanelHotkeys = {
  character: 'c',
  inventory: 'i',
  skills: 'k',
  crafting: 'o',
  quests: 'l',
  guild: 'g',
};

interface UsePanelHotkeysOptions {
  hotkeys?: Partial<PanelHotkeys>;
  onOpenPanel?: (tab: PanelTab) => void;
}

export function usePanelHotkeys(options: UsePanelHotkeysOptions = {}): void {
  const { hotkeys = {}, onOpenPanel } = options;
  const mergedHotkeys = { ...DEFAULT_PANEL_HOTKEYS, ...hotkeys };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const key = e.key.toLowerCase();
      
      if (key === mergedHotkeys.character) {
        e.preventDefault();
        onOpenPanel?.('equipment');
      } else if (key === mergedHotkeys.inventory) {
        e.preventDefault();
        onOpenPanel?.('equipment');
      } else if (key === mergedHotkeys.skills) {
        e.preventDefault();
        onOpenPanel?.('skills');
      } else if (key === mergedHotkeys.crafting) {
        e.preventDefault();
        onOpenPanel?.('crafting');
      } else if (key === mergedHotkeys.quests) {
        e.preventDefault();
        onOpenPanel?.('quests');
      } else if (key === mergedHotkeys.guild) {
        e.preventDefault();
        onOpenPanel?.('guild');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mergedHotkeys, onOpenPanel]);
}
