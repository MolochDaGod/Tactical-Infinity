import { useState } from "react";
import managementScroll from "@/assets/icons/management_icon_1777102585610.png";
import chefIcon from "@/assets/icons/chef_profession_game_icon_1777102585606.png";
import engineerIcon from "@/assets/icons/engineer_profession_game_icon_1777102585607.png";
import foresterIcon from "@/assets/icons/forester_profession_game_icon_1777102585609.png";
import minerIcon from "@/assets/icons/miner_profession_game_icon_1777102585611.png";
import mysticIcon from "@/assets/icons/mystic_profession_game_icon_1777102585613.png";

export type ProfessionId = "forester" | "miner" | "chef" | "engineer" | "mystic";

export interface ProfessionEntry {
  id: ProfessionId;
  name: string;
  blurb: string;
  icon: string;
  level: number;
  xp: number;
  xpToNext: number;
  tint: string;
}

const TIER_NAMES: Array<{ min: number; name: string }> = [
  { min: 76, name: "Master" },
  { min: 51, name: "Expert" },
  { min: 26, name: "Journeyman" },
  { min: 11, name: "Apprentice" },
  { min: 1, name: "Novice" },
];

function tierFor(level: number): string {
  return TIER_NAMES.find((t) => level >= t.min)?.name ?? "Novice";
}

export const DEFAULT_PROFESSIONS: ProfessionEntry[] = [
  {
    id: "forester",
    name: "Forester",
    blurb: "Bow, vines, woodcraft",
    icon: foresterIcon,
    level: 14,
    xp: 240,
    xpToNext: 600,
    tint: "#86efac",
  },
  {
    id: "miner",
    name: "Miner",
    blurb: "Ore veins & gemstones",
    icon: minerIcon,
    level: 22,
    xp: 980,
    xpToNext: 1500,
    tint: "#fcd34d",
  },
  {
    id: "chef",
    name: "Chef",
    blurb: "Cookpot & feast buffs",
    icon: chefIcon,
    level: 9,
    xp: 120,
    xpToNext: 400,
    tint: "#fb923c",
  },
  {
    id: "engineer",
    name: "Engineer",
    blurb: "Gears, contraptions, siege",
    icon: engineerIcon,
    level: 17,
    xp: 560,
    xpToNext: 900,
    tint: "#7dd3fc",
  },
  {
    id: "mystic",
    name: "Mystic",
    blurb: "Runes, enchantments, glyphs",
    icon: mysticIcon,
    level: 5,
    xp: 80,
    xpToNext: 200,
    tint: "#d8b4fe",
  },
];

export interface ProfessionsPanelProps {
  professions?: ProfessionEntry[];
  onSelect?: (id: ProfessionId) => void;
  className?: string;
}

export default function ProfessionsPanel({
  professions = DEFAULT_PROFESSIONS,
  onSelect,
  className = "",
}: ProfessionsPanelProps) {
  const [active, setActive] = useState<ProfessionId | null>(null);

  return (
    <div
      className={`relative bg-black/55 backdrop-blur-md border border-amber-400/20 rounded-xl p-3 w-[260px] text-white shadow-[0_0_30px_-12px_rgba(251,191,36,0.4)] ${className}`}
      data-testid="panel-professions"
    >
      <div className="flex items-center gap-2 pb-2 border-b border-amber-400/20">
        <img
          src={managementScroll}
          alt=""
          className="w-9 h-9 object-contain drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
          data-testid="img-professions-header"
        />
        <div className="flex-1 min-w-0">
          <h3
            className="text-[13px] font-semibold tracking-[0.18em] uppercase text-amber-200"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            Professions
          </h3>
          <p className="text-[10px] text-amber-100/40 truncate">
            Account-wide artisan progression
          </p>
        </div>
      </div>

      <ul className="mt-2 space-y-1.5" data-testid="list-professions">
        {professions.map((p) => {
          const pct = Math.max(0, Math.min(100, (p.xp / p.xpToNext) * 100));
          const isActive = active === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setActive(p.id);
                  onSelect?.(p.id);
                }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors border ${
                  isActive
                    ? "bg-amber-400/10 border-amber-400/40"
                    : "bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-amber-400/20"
                }`}
                data-testid={`button-profession-${p.id}`}
              >
                <div
                  className="relative shrink-0 w-10 h-10 rounded-md overflow-hidden border"
                  style={{
                    borderColor: `${p.tint}55`,
                    boxShadow: isActive
                      ? `0 0 12px -2px ${p.tint}80`
                      : `0 0 6px -2px ${p.tint}40`,
                  }}
                >
                  <img
                    src={p.icon}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    data-testid={`img-profession-${p.id}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-[12px] font-semibold tracking-wide truncate"
                      style={{ color: p.tint, fontFamily: "Cinzel, serif" }}
                      data-testid={`text-profession-name-${p.id}`}
                    >
                      {p.name}
                    </span>
                    <span
                      className="text-[10px] font-mono text-white/70 shrink-0"
                      data-testid={`text-profession-level-${p.id}`}
                    >
                      Lv {p.level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 -mt-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-white/40 truncate">
                      {tierFor(p.level)}
                    </span>
                    <span className="text-[9px] font-mono text-white/40 shrink-0">
                      {p.xp}/{p.xpToNext}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: p.tint,
                        boxShadow: `0 0 6px ${p.tint}80`,
                      }}
                      data-testid={`bar-profession-xp-${p.id}`}
                    />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
