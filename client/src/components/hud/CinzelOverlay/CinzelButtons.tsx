import { useEffect } from 'react';

export type CinzelPanel = 'inventory' | 'character' | 'skills';

interface Props {
  active:  CinzelPanel | null;
  onToggle: (panel: CinzelPanel) => void;
}

const BTN_DEFS: Array<{ id: CinzelPanel; label: string; key: string; title: string }> = [
  { id: 'inventory', label: 'I', key: 'i', title: 'Inventory [I]' },
  { id: 'character', label: 'C', key: 'c', title: 'Character [C]' },
  { id: 'skills',    label: 'S', key: 's', title: 'Skills [S]'    },
];

export function CinzelButtons({ active, onToggle }: Props) {
  // Keyboard hotkeys I / C / S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore when user is typing in an input or contenteditable
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      const def = BTN_DEFS.find(b => b.key === e.key.toLowerCase());
      if (!def) return;
      onToggle(def.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggle]);

  return (
    <div className="status-buttons" data-testid="cinzel-buttons">
      {BTN_DEFS.map(b => (
        <div
          key={b.id}
          className={`circle-btn ui-element${active === b.id ? ' active' : ''}`}
          onClick={() => onToggle(b.id)}
          title={b.title}
          data-testid={`button-panel-${b.id}`}
        >
          {b.label}
        </div>
      ))}
    </div>
  );
}
