/**
 * Harvest profession radial — unarmed / axe / pick / knife / fishing pole.
 * Used by island editor play mode and home-island.
 */

import type { PlayTool } from '@/lib/islandsCanonical/editorPlayController';
import { PLAY_TOOLS } from '@/lib/islandsCanonical/editorPlayController';

interface Props {
  value: PlayTool;
  onChange: (tool: PlayTool) => void;
}

const ANGLES = [-90, -18, 54, 126, 198];

export default function HarvestToolRadial({ value, onChange }: Props) {
  return (
    <div
      className="relative w-40 h-40 pointer-events-auto"
      data-testid="harvest-tool-radial"
    >
      <div className="absolute inset-0 rounded-full border border-amber-700/50 bg-black/55" />
      {PLAY_TOOLS.map((t, i) => {
        const a = ((ANGLES[i] ?? i * 72) * Math.PI) / 180;
        const r = 52;
        const x = 80 + Math.cos(a) * r - 22;
        const y = 80 + Math.sin(a) * r - 22;
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onChange(t.id)}
            className={`absolute w-11 h-11 rounded-full text-[10px] leading-tight border ${
              on ? 'border-amber-300 bg-amber-800 text-amber-50' : 'border-white/20 bg-black/70 text-amber-100/80'
            }`}
            style={{ left: x, top: y }}
            data-testid={`harvest-tool-${t.id}`}
          >
            <div>{t.icon}</div>
            <div className="text-[8px] truncate px-0.5">{t.label.split(' ')[0]}</div>
          </button>
        );
      })}
      <div className="absolute inset-0 flex items-center justify-center text-[9px] text-amber-300/80 pointer-events-none">
        Harvest
      </div>
    </div>
  );
}
