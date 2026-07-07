import { useMemo } from "react";

interface WindCompassProps {
  windAngleDeg: number;       // True wind direction, 0=N, 90=E (where wind blows FROM)
  windSpeedKts: number;       // True wind speed in knots
  shipHeadingDeg: number;     // Ship bow heading, 0=N
  shipSpeedKts: number;       // Forward speed in knots
  sailTrim01: number;         // 0..1 sail efficiency (1 = full power)
  fullSailActive?: boolean;
}

const POINTS_OF_SAIL = [
  { max: 30,  name: "In Irons",      color: "#ef4444", desc: "Pointing into wind — no power" },
  { max: 60,  name: "Close-Hauled",  color: "#f59e0b", desc: "Sailing as close to wind as possible" },
  { max: 100, name: "Beam Reach",    color: "#22c55e", desc: "Wind across the beam — fastest" },
  { max: 150, name: "Broad Reach",   color: "#3b82f6", desc: "Wind off the rear quarter" },
  { max: 180, name: "Running",       color: "#a855f7", desc: "Dead downwind — sail eased fully" },
];

function beaufort(kts: number): { force: number; name: string } {
  const table: [number, string][] = [
    [1,  "Calm"], [3,  "Light Air"], [6,  "Light Breeze"],
    [10, "Gentle"], [16, "Moderate"], [21, "Fresh"],
    [27, "Strong"], [33, "Near Gale"], [40, "Gale"],
    [47, "Strong Gale"], [55, "Storm"], [63, "Violent Storm"],
    [Infinity, "Hurricane"],
  ];
  const idx = table.findIndex(([k]) => kts < k);
  return { force: idx, name: table[idx][1] };
}

export function WindCompass({
  windAngleDeg, windSpeedKts, shipHeadingDeg, shipSpeedKts,
  sailTrim01, fullSailActive,
}: WindCompassProps) {
  // Apparent wind angle relative to bow (0 = directly off the bow, 180 = dead astern)
  const { apparentDeg, pointOfSail } = useMemo(() => {
    let rel = ((windAngleDeg - shipHeadingDeg) % 360 + 540) % 360 - 180; // -180..180
    const abs = Math.abs(rel);
    const pos = POINTS_OF_SAIL.find(p => abs <= p.max) || POINTS_OF_SAIL[POINTS_OF_SAIL.length - 1];
    return { apparentDeg: rel, pointOfSail: pos };
  }, [windAngleDeg, shipHeadingDeg]);

  const bf = beaufort(windSpeedKts);
  const efficiencyPct = Math.round(sailTrim01 * 100);
  // Boom angle (rough): trim where boom is along the wind on a run, ~45° on a reach, ~10° close-hauled
  const boomDeg = Math.sign(apparentDeg || 1) * Math.min(80, Math.abs(apparentDeg) * 0.55);

  // Compass: wind arrow points where wind goes TO (i.e. windAngle + 180), but heading is relative to north.
  // We'll render compass card fixed (N up). Ship bow points up (heading) so we rotate the card by -heading.
  const cardRotation = -shipHeadingDeg;
  const windCardAngle = windAngleDeg + 180; // direction wind is moving

  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const p0 = polar(cx, cy, r, a0);
    const p1 = polar(cx, cy, r, a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };
  const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <div
      data-testid="wind-compass"
      className="bg-black/75 backdrop-blur-md border border-amber-700/40 rounded-lg p-3 text-white shadow-2xl"
      style={{ width: 240 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-amber-400 font-serif text-[11px] tracking-[0.2em] uppercase">Wind &amp; Sail</span>
        {fullSailActive && (
          <span className="text-yellow-300 text-[9px] font-bold animate-pulse" data-testid="badge-full-sail">⚡ FULL SAIL</span>
        )}
      </div>

      {/* Compass */}
      <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
        <svg viewBox="0 0 200 200" className="absolute inset-0">
          {/* Outer ring */}
          <circle cx="100" cy="100" r="92" fill="rgba(0,0,0,0.4)" stroke="#92400e" strokeWidth="1" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(217,119,6,0.25)" strokeWidth="1" strokeDasharray="2 4" />

          {/* Compass card (rotates with ship so bow stays up) */}
          <g transform={`rotate(${cardRotation} 100 100)`}>
            {/* Tick marks every 15° */}
            {Array.from({ length: 24 }).map((_, i) => {
              const a = i * 15;
              const p0 = polar(100, 100, 88, a);
              const p1 = polar(100, 100, i % 6 === 0 ? 78 : 83, a);
              return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}
                stroke={i % 6 === 0 ? "#fbbf24" : "rgba(255,255,255,0.3)"} strokeWidth={i % 6 === 0 ? 1.5 : 0.7} />;
            })}
            {/* Cardinals */}
            {(["N", "E", "S", "W"] as const).map((c, i) => {
              const a = i * 90;
              const p = polar(100, 100, 68, a);
              return <text key={c} x={p.x} y={p.y + 4} textAnchor="middle"
                fontSize={c === "N" ? "13" : "11"}
                fontFamily="Cinzel, serif"
                fontWeight="700"
                fill={c === "N" ? "#ef4444" : "#fbbf24"}
                transform={`rotate(${-cardRotation} ${p.x} ${p.y})`}>
                {c}
              </text>;
            })}

            {/* True wind arrow (points where wind is going TO) */}
            <g transform={`rotate(${windCardAngle} 100 100)`}>
              <line x1="100" y1="100" x2="100" y2="22" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
              <polygon points="100,16 94,30 106,30" fill="#38bdf8" />
              <polygon points="100,178 94,170 106,170" fill="rgba(56,189,248,0.45)" />
            </g>
          </g>

          {/* Ship bow indicator (always points up) */}
          <g>
            <polygon points="100,28 94,46 106,46" fill="#fde047" stroke="#a16207" strokeWidth="1" />
            <line x1="100" y1="46" x2="100" y2="154" stroke="rgba(253,224,71,0.4)" strokeWidth="1.5" />
            <polygon points="100,170 96,158 104,158" fill="rgba(253,224,71,0.5)" />
          </g>

          {/* Sail boom (rotates around mast based on apparent wind) */}
          <g transform={`rotate(${boomDeg} 100 110)`}>
            <line x1="100" y1="110" x2="100" y2="148" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="100" cy="130" rx="14" ry="4"
              fill={pointOfSail.color} opacity="0.6"
              transform={`rotate(${-boomDeg} 100 130)`} />
          </g>
          <circle cx="100" cy="110" r="3" fill="#fbbf24" />

          {/* Point of sail arc */}
          <path d={arc(100, 100, 60, -pointOfSail.max, pointOfSail.max)}
            fill="none" stroke={pointOfSail.color} strokeWidth="2" opacity="0.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Readouts */}
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
        <div className="col-span-2 text-center py-1 px-2 rounded mb-1"
          style={{ backgroundColor: `${pointOfSail.color}22`, border: `1px solid ${pointOfSail.color}66` }}
          data-testid="text-point-of-sail">
          <span className="font-serif tracking-wider" style={{ color: pointOfSail.color }}>
            {pointOfSail.name.toUpperCase()}
          </span>
        </div>

        <div className="text-white/50">True Wind</div>
        <div className="text-right text-sky-300 font-mono" data-testid="text-true-wind">
          {Math.round(((windAngleDeg % 360) + 360) % 360)}° · {windSpeedKts.toFixed(0)}kt
        </div>

        <div className="text-white/50">Apparent</div>
        <div className="text-right text-cyan-200 font-mono" data-testid="text-apparent-wind">
          {apparentDeg >= 0 ? "S" : "P"} {Math.abs(apparentDeg).toFixed(0)}°
        </div>

        <div className="text-white/50">Beaufort</div>
        <div className="text-right text-amber-200 font-mono" data-testid="text-beaufort">
          F{bf.force} · {bf.name}
        </div>

        <div className="text-white/50">Heading</div>
        <div className="text-right text-yellow-300 font-mono" data-testid="text-heading-compass">
          {Math.round(((shipHeadingDeg % 360) + 360) % 360)}°
        </div>

        <div className="text-white/50">Boat Speed</div>
        <div className="text-right text-emerald-300 font-mono" data-testid="text-boat-speed">
          {shipSpeedKts.toFixed(1)}kt
        </div>

        <div className="text-white/50">Sail Trim</div>
        <div className="text-right font-mono" data-testid="text-sail-trim"
          style={{ color: efficiencyPct > 75 ? "#22c55e" : efficiencyPct > 40 ? "#f59e0b" : "#ef4444" }}>
          {efficiencyPct}%
        </div>

        {/* Trim bar */}
        <div className="col-span-2 mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full transition-all rounded-full"
            style={{
              width: `${efficiencyPct}%`,
              background: efficiencyPct > 75
                ? "linear-gradient(90deg,#10b981,#22c55e)"
                : efficiencyPct > 40
                ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                : "linear-gradient(90deg,#dc2626,#ef4444)",
            }}
            data-testid="bar-sail-trim"
          />
        </div>
      </div>
    </div>
  );
}
