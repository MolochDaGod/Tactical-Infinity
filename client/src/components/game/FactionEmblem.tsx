import crusadeEmblem from "@/assets/factions/crusade-emblem_1777805801717.png";
import fabledEmblem  from "@/assets/factions/fabled-emblem_1777805801718.png";
import legionEmblem  from "@/assets/factions/legion-emblem_1777805801717.png";
import type { Faction } from "@shared/schema";
import { FACTION_COLORS } from "@/data/toonRTSAssets";

const EMBLEM: Record<Faction, string> = {
  crusade: crusadeEmblem,
  fabled:  fabledEmblem,
  legion:  legionEmblem,
};

const LABEL: Record<Faction, string> = {
  crusade: "Crusade",
  fabled:  "Fabled",
  legion:  "Legion",
};

export const FACTION_EMBLEM_SRC = EMBLEM;

export interface FactionEmblemProps {
  faction: Faction;
  /** Pixel size of the emblem image. */
  size?: number;
  /** Show the faction name next to the emblem. */
  showLabel?: boolean;
  /** Show a soft colored glow behind the emblem. */
  glow?: boolean;
  className?: string;
  title?: string;
}

/**
 * Canonical Grudge Warlords faction emblem + label.
 * Use this everywhere a faction is shown so all three Grudge Land titles
 * stay visually consistent.
 */
export function FactionEmblem({
  faction,
  size = 40,
  showLabel = false,
  glow = false,
  className = "",
  title,
}: FactionEmblemProps) {
  const color = FACTION_COLORS[faction];
  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      title={title ?? LABEL[faction]}
      data-testid={`emblem-faction-${faction}`}
    >
      <div
        className="relative shrink-0"
        style={{
          width: size,
          height: size,
          filter: glow ? `drop-shadow(0 0 ${Math.round(size * 0.15)}px ${color}88)` : undefined,
        }}
      >
        <img
          src={EMBLEM[faction]}
          alt={`${LABEL[faction]} emblem`}
          className="w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />
      </div>
      {showLabel && (
        <span
          className="font-cinzel uppercase tracking-[0.18em] text-sm font-semibold"
          style={{ color }}
        >
          {LABEL[faction]}
        </span>
      )}
    </div>
  );
}

export function FactionEmblemRow({
  size = 36,
  selected,
  onSelect,
  showLabels = true,
}: {
  size?: number;
  selected?: Faction;
  onSelect?: (f: Faction) => void;
  showLabels?: boolean;
}) {
  const factions: Faction[] = ["crusade", "fabled", "legion"];
  return (
    <div className="flex gap-3" data-testid="row-faction-emblems">
      {factions.map((f) => {
        const isSelected = selected === f;
        const interactive = !!onSelect;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onSelect?.(f)}
            disabled={!interactive}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border backdrop-blur-sm transition-all ${
              interactive ? "hover-elevate cursor-pointer" : "cursor-default"
            }`}
            style={{
              borderColor: isSelected ? FACTION_COLORS[f] : `${FACTION_COLORS[f]}55`,
              backgroundColor: isSelected ? `${FACTION_COLORS[f]}25` : `${FACTION_COLORS[f]}10`,
            }}
            data-testid={`button-faction-${f}`}
          >
            <FactionEmblem faction={f} size={size} glow={isSelected} />
            {showLabels && (
              <span
                className="font-cinzel uppercase tracking-[0.18em] text-xs font-semibold"
                style={{ color: FACTION_COLORS[f] }}
              >
                {LABEL[f]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
