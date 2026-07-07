import { useEffect, useState } from 'react';
import type { HotbarSlot } from './types';

interface Props {
  slots: HotbarSlot[];
}

export function CinzelHotbar({ slots }: Props) {
  // Track which slot is currently "pressed" for the visual feedback.
  const [pressed, setPressed] = useState<number | null>(null);

  // Bind 1..9 keys → activate matching slot.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = parseInt(e.key, 10);
      if (!Number.isFinite(k) || k < 1 || k > 9) return;
      const slot = slots.find(s => s.key === k);
      if (!slot || slot.disabled) return;
      slot.onActivate?.();
      setPressed(k);
      window.setTimeout(() => setPressed(p => (p === k ? null : p)), 140);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots]);

  return (
    <div
      className="ui-element panel-style"
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 10px 10px' }}
      data-testid="cinzel-hotbar"
    >
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {slots.map(slot => {
          const cls = ['hotbar-slot'];
          if (pressed === slot.key) cls.push('pressed');
          if (slot.disabled)        cls.push('disabled');
          const cd = slot.cooldown && slot.cooldown > 0 ? Math.ceil(slot.cooldown) : null;
          return (
            <div
              key={slot.key}
              className={cls.join(' ')}
              title={slot.name}
              data-testid={`hotbar-slot-${slot.key}`}
              onClick={() => {
                if (slot.disabled) return;
                slot.onActivate?.();
                setPressed(slot.key);
                window.setTimeout(() => setPressed(p => (p === slot.key ? null : p)), 140);
              }}
            >
              <span className="hotbar-num">{slot.key}</span>
              <span style={{ fontSize: 22 }}>{slot.icon}</span>
              {cd !== null && <div className="hotbar-cd">{cd}s</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
