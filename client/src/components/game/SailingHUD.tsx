import { GameHUD, type SlotDef, type VitalBarDef } from "@/components/game/GameHUD";
import { WindCompass } from "@/components/game/WindCompass";

export interface SailingWindInfo {
  windAngleDeg: number;
  windSpeedKts: number;
  shipHeadingDeg: number;
  shipSpeedKts: number;
  sailTrim01: number;
  fullSailActive?: boolean;
}

export interface SailingSeaState {
  weather: string;
  weatherSeverity: string;
  /** Normalized 0..1 day cycle. */
  timeOfDay: number;
  /** 0..100 hull stability. */
  shipStability: number;
  shipWarnings: string[];
}

export interface SailingHUDProps {
  /** Vital bars (hull, stability, etc.) shown in the bottom-right hotbar cluster. */
  vitals: VitalBarDef[];
  /** Primary ability/ammo hotbar slots. */
  slots: SlotDef[];
  /** Optional cannon / fire side button. */
  cannonSlot?: SlotDef;
  /** Optional left side button. */
  sideLeft?: SlotDef;
  /** Contextual control prompt under the hotbar. */
  hint?: string;
  wind: SailingWindInfo;
  seaState: SailingSeaState;
  /** Hide the hotbar (e.g. while in a cinematic chase cam). Default true. */
  showHotbar?: boolean;
  /** Hide the wind compass + sea-state panel. Default true. */
  showWind?: boolean;
}

function timeLabel(t: number): string {
  if (t < 0.25) return "Night";
  if (t < 0.35) return "Dawn";
  if (t < 0.65) return "Day";
  if (t < 0.75) return "Dusk";
  return "Night";
}

const SEVERITY_CLASS: Record<string, string> = {
  extreme: "text-red-600 font-bold animate-pulse",
  severe: "text-red-500 font-bold",
  rough: "text-orange-500",
  moderate: "text-yellow-500",
  mild: "text-blue-400",
};

const WEATHER_CLASS: Record<string, string> = {
  stormy: "text-purple-400",
  foggy: "text-gray-400",
  cloudy: "text-blue-300",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Unified boat HUD used in every boat context (world-map sailing, open water,
 * boat combat). Composes the shared GameHUD (vitals + ability/ammo hotbar) with
 * the WindCompass and a sea-state readout so there is a single source of truth
 * for the sailing UI rather than per-page JSX.
 */
export function SailingHUD({
  vitals,
  slots,
  cannonSlot,
  sideLeft,
  hint,
  wind,
  seaState,
  showHotbar = true,
  showWind = true,
}: SailingHUDProps) {
  const stabilityClass =
    seaState.shipStability >= 80
      ? "text-green-400"
      : seaState.shipStability >= 60
        ? "text-yellow-400"
        : seaState.shipStability >= 40
          ? "text-orange-500"
          : "text-red-500";

  return (
    <>
      {showWind && (
        <div className="absolute bottom-24 left-4 flex flex-col gap-2" data-testid="panel-wind">
          <WindCompass
            windAngleDeg={wind.windAngleDeg}
            windSpeedKts={wind.windSpeedKts}
            shipHeadingDeg={wind.shipHeadingDeg}
            shipSpeedKts={wind.shipSpeedKts}
            sailTrim01={wind.sailTrim01}
            fullSailActive={wind.fullSailActive}
          />
          <div
            className="bg-black/75 backdrop-blur-md border border-amber-700/40 rounded-lg p-2 text-[10px] text-white space-y-1"
            data-testid="panel-sea-state"
          >
            <div className="flex items-center justify-between">
              <span className="text-white/50">Weather</span>
              <span className={WEATHER_CLASS[seaState.weather] ?? "text-yellow-400"}>
                {cap(seaState.weather)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Time</span>
              <span className="text-white/80">{timeLabel(seaState.timeOfDay)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Sea State</span>
              <span className={SEVERITY_CLASS[seaState.weatherSeverity] ?? "text-green-400"}>
                {cap(seaState.weatherSeverity)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Stability</span>
              <span className={stabilityClass}>{seaState.shipStability.toFixed(0)}%</span>
            </div>
            {seaState.shipWarnings.length > 0 && (
              <div className="mt-1 pt-1 border-t border-red-500/50 space-y-0.5">
                {seaState.shipWarnings.map((warning, i) => (
                  <div key={i} className="text-red-400 font-bold animate-pulse">
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showHotbar && (
        <GameHUD
          mode="ship"
          vitals={vitals}
          slots={slots}
          sideLeft={sideLeft}
          sideRight={cannonSlot}
          hint={hint}
        />
      )}
    </>
  );
}
