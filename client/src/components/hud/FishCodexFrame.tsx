/**
 * Fish species frame — layout from Desktop/fishui.png
 * Left rail thumbs · center portrait · 5+5 stat cells · bottom plate.
 */

import type { ReactNode } from 'react';
import type { FishCodexCard } from '@shared/gameDefinitions/fishCodex';

const GOLD = '#c5a059';
const INK = '#1a140e';
const PANEL = 'rgba(18, 12, 8, 0.92)';

function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function FishCodexFrame({
  cards,
  selectedId,
  onSelect,
  portrait,
}: {
  cards: FishCodexCard[];
  selectedId: string;
  onSelect: (id: string) => void;
  portrait: ReactNode;
}) {
  const card = cards.find((c) => c.id === selectedId) ?? cards[0];
  if (!card) return null;

  const left = [
    { k: 'Size', v: `${card.bodyLengthM.toFixed(2)} m` },
    { k: 'Weight', v: `${card.weightKg} kg` },
    { k: 'Difficulty', v: stars(card.difficulty) },
    { k: 'Depth', v: `${card.depthHi.toFixed(0)}…${card.depthLo.toFixed(0)} m` },
    { k: 'Rarity', v: card.rarity },
  ];
  const right = [
    { k: 'Fav. lure', v: card.favoriteLureName },
    { k: 'Catch XP', v: String(card.catchXp) },
    { k: 'Speed', v: `${card.swimSpeed.toFixed(1)} m/s` },
    { k: 'Take', v: card.catchable ? 'Hook' : card.harpoonable ? 'Harpoon' : 'Observe' },
    { k: 'Temper', v: card.temperament },
  ];

  return (
    <div
      className="pointer-events-auto flex gap-3 items-stretch"
      data-testid="fish-codex-frame"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      <div className="flex flex-col gap-2 justify-center">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            title={c.label}
            className="w-12 h-12 rounded-sm text-[9px] leading-tight px-0.5"
            style={{
              border: `1px solid ${c.id === card.id ? GOLD : 'rgba(197,160,89,0.35)'}`,
              background: c.id === card.id ? 'rgba(80,50,20,0.85)' : PANEL,
              color: GOLD,
            }}
          >
            {c.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <div
        className="relative w-[min(720px,86vw)] h-[min(420px,70vh)] rounded-sm"
        style={{
          border: `2px solid ${GOLD}`,
          background: 'linear-gradient(180deg, #1c2830 0%, #0b1520 55%, #081018 100%)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55), inset 0 0 0 6px rgba(12,8,5,0.85)',
        }}
      >
        <div className="absolute inset-y-6 left-5 w-[88px] flex flex-col justify-between py-1">
          {left.map((s) => (
            <StatCell key={s.k} label={s.k} value={s.v} />
          ))}
        </div>
        <div className="absolute inset-y-6 right-5 w-[88px] flex flex-col justify-between py-1">
          {right.map((s) => (
            <StatCell key={s.k} label={s.k} value={s.v} />
          ))}
        </div>

        <div className="absolute inset-[72px_108px_72px_108px] overflow-hidden rounded-sm">
          {portrait}
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-3 w-[58%] text-center px-3 py-1.5 rounded-sm"
          style={{ background: PANEL, border: `1px solid ${GOLD}`, color: GOLD }}
        >
          <div className="text-sm tracking-widest uppercase">{card.label}</div>
          <div className="text-[10px] text-amber-200/70">
            {card.favoriteLureName} · {card.valueGold}g · {stars(card.difficulty)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="h-[52px] px-1.5 py-1 flex flex-col justify-center"
      style={{
        border: '1px solid rgba(197,160,89,0.4)',
        background: 'rgba(12,8,5,0.72)',
        color: GOLD,
      }}
    >
      <div className="text-[8px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[10px] leading-tight">{value}</div>
    </div>
  );
}
