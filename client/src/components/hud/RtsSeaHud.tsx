/**
 * RTS-Grudge (5) open-sea HUD — command card, not the old sailing overlay.
 *
 * Visual language from RTS-Grudge HUD.tsx (Cinzel / gold / dark wood).
 * Five commands = deck-station SSOT: cannon · harpoon · nest · mage · repair.
 */

import { getHullDeckBudget, type BoatId } from '@shared/gameDefinitions/waterEngagement';
import { resolveBoatId } from '@shared/gameDefinitions/boatRegistry';

const GOLD = '#c5a059';
const GOLD_BRIGHT = '#e8c868';
const PANEL = 'rgba(12, 8, 5, 0.92)';
const BORDER = 'rgba(197, 160, 89, 0.45)';

export type RtsSeaCommandId = 'cannon' | 'harpoon' | 'sniper_nest' | 'mage_spot' | 'repair';

export interface RtsSeaCommand {
  id: RtsSeaCommandId;
  label: string;
  crew: 'gunner' | 'sailor' | 'weatherman' | 'captain';
  hotkey: string;
  cooldown?: number;
  maxCooldown?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export interface RtsSeaHudProps {
  boatId?: string;
  boatName?: string;
  hull: number;
  hullMax: number;
  stability?: number;
  headingDeg: number;
  speedKts: number;
  windDeg: number;
  windKts: number;
  commands: RtsSeaCommand[];
  targetName?: string | null;
  targetHp?: number;
  targetHpMax?: number;
}

const CREW_TINT: Record<RtsSeaCommand['crew'], string> = {
  gunner: '#c45c3a',
  sailor: '#6a9e6e',
  weatherman: '#6a7ec8',
  captain: GOLD_BRIGHT,
};

export const DEFAULT_SEA_COMMANDS: Omit<RtsSeaCommand, 'onClick' | 'cooldown' | 'disabled'>[] = [
  { id: 'cannon', label: 'Cannon', crew: 'gunner', hotkey: '1' },
  { id: 'harpoon', label: 'Harpoon', crew: 'sailor', hotkey: '2' },
  { id: 'sniper_nest', label: 'Nest', crew: 'sailor', hotkey: '3' },
  { id: 'mage_spot', label: 'Wind', crew: 'weatherman', hotkey: '4' },
  { id: 'repair', label: 'Repair', crew: 'sailor', hotkey: '5' },
];

export function commandEnabledOnHull(boatId: string | undefined, id: RtsSeaCommandId): boolean {
  const hull = resolveBoatId(boatId) as BoatId;
  const b = getHullDeckBudget(hull);
  switch (id) {
    case 'cannon':
      return b.cannon > 0;
    case 'harpoon':
      return b.harpoon > 0;
    case 'sniper_nest':
      return b.sniperNest > 0;
    case 'mage_spot':
      return b.mageSpot > 0;
    case 'repair':
      return true;
  }
}

export function RtsSeaHud({
  boatId,
  boatName,
  hull,
  hullMax,
  stability,
  headingDeg,
  speedKts,
  windDeg,
  windKts,
  commands,
  targetName,
  targetHp,
  targetHpMax,
}: RtsSeaHudProps) {
  const hpPct = hullMax > 0 ? Math.max(0, Math.min(100, (hull / hullMax) * 100)) : 0;
  const stab = stability ?? 100;
  const hdg = ((headingDeg % 360) + 360) % 360;
  const wnd = ((windDeg % 360) + 360) % 360;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-testid="rts-sea-hud">
      {/* Unit frame — top left */}
      <div
        className="pointer-events-none absolute top-3 left-3 w-[240px] rounded-md px-3 py-2"
        style={{ background: PANEL, border: `1px solid ${BORDER}`, fontFamily: "'Cinzel', serif" }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] tracking-widest uppercase" style={{ color: GOLD_BRIGHT }}>
            {boatName ?? resolveBoatId(boatId)}
          </span>
          <span className="text-[10px] font-mono" style={{ color: '#8a7e6a' }}>
            {speedKts.toFixed(1)} kts
          </span>
        </div>
        <Bar label="Hull" pct={hpPct} fill={hpPct < 30 ? '#b91c1c' : '#7f1d1d'} />
        <Bar label="Hold" pct={stab} fill="#1e3a5f" />
        <div className="mt-1 flex justify-between text-[9px] font-mono" style={{ color: '#8a7e6a' }}>
          <span>HDG {hdg.toFixed(0)}°</span>
          <span>WIND {wnd.toFixed(0)}° · {windKts.toFixed(0)}</span>
        </div>
      </div>

      {/* Target frame */}
      {targetName && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 min-w-[200px] rounded-md px-3 py-1.5 text-center"
          style={{ background: PANEL, border: `1px solid ${BORDER}` }}
          data-testid="rts-sea-target"
        >
          <div className="text-[11px] tracking-wide uppercase" style={{ color: '#e0d8c8', fontFamily: "'Cinzel', serif" }}>
            {targetName}
          </div>
          {targetHpMax != null && targetHp != null && (
            <Bar pct={(targetHp / Math.max(1, targetHpMax)) * 100} fill="#c45c3a" />
          )}
        </div>
      )}

      {/* 5-command RTS card */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {commands.slice(0, 5).map((cmd) => {
          const locked = cmd.disabled || !commandEnabledOnHull(boatId, cmd.id);
          const cd = cmd.cooldown && cmd.maxCooldown ? cmd.cooldown / cmd.maxCooldown : 0;
          const cooling = cd > 0;
          return (
            <button
              key={cmd.id}
              type="button"
              disabled={locked || cooling}
              onClick={() => !locked && !cooling && cmd.onClick?.()}
              data-testid={`rts-cmd-${cmd.id}`}
              title={`${cmd.label} · ${cmd.crew}`}
              className="relative w-[68px] h-[72px] rounded-sm flex flex-col items-center justify-end pb-1 disabled:opacity-40"
              style={{
                background: 'linear-gradient(180deg, rgba(50,36,24,0.95) 0%, rgba(14,10,6,0.98) 100%)',
                border: `1px solid ${locked ? 'rgba(80,70,50,0.4)' : GOLD}`,
                boxShadow: cmd.disabled ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                fontFamily: "'Cinzel', serif",
              }}
            >
              {cooling && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-black/55"
                  style={{ height: `${Math.min(100, cd * 100)}%` }}
                />
              )}
              <span className="text-[10px] uppercase tracking-wide relative z-10" style={{ color: CREW_TINT[cmd.crew] }}>
                {cmd.label}
              </span>
              <span className="text-[9px] font-mono relative z-10" style={{ color: GOLD }}>
                {cooling ? `${Math.ceil(cmd.cooldown ?? 0)}s` : cmd.hotkey}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ label, pct, fill }: { label?: string; pct: number; fill: string }) {
  return (
    <div className="mb-0.5">
      {label && (
        <div className="flex justify-between text-[8px] uppercase tracking-wider" style={{ color: '#8a7e6a' }}>
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: fill }} />
      </div>
    </div>
  );
}
