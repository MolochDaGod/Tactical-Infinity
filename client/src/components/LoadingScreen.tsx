import { useEffect, useState } from "react";
import { BRAND } from "@/data/gameIcons";

// Full-screen themed loading splash. Kept dependency-light (inline styles +
// injected keyframes) so it renders reliably as a Suspense fallback while page
// chunks are still downloading.

const TIPS = [
  "Three factions vie for Aethermoor: Crusade, Fabled, and the Legion.",
  "Chart open waters, board enemy hulls, and plunder island harbours.",
  "Forge a captain in the Class Tree, then rally your barracks.",
  "Storms swell the seas — trim your sails before the hurricane hits.",
  "Every island is procedurally forged. No two shores are the same.",
];

const FACTION = ["#3b82f6", "#22c55e", "#dc2626"]; // Crusade / Fabled / Legion

export interface LoadingScreenProps {
  /** Optional status line shown under the progress bar. */
  message?: string;
  /** 0–100. When omitted, an indeterminate sweep animation is shown. */
  progress?: number;
}

export default function LoadingScreen({ message, progress }: LoadingScreenProps) {
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3800);
    return () => clearInterval(id);
  }, []);

  const indeterminate = progress == null;
  const pct = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <div
      data-testid="loading-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        overflow: "hidden",
        background: "#05060b",
        fontFamily: "Cinzel, serif",
        color: "#e5e7eb",
      }}
    >
      <style>{`
        @keyframes gw-sweep { 0%{left:-40%} 100%{left:100%} }
        @keyframes gw-spin { to { transform: rotate(360deg) } }
        @keyframes gw-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes gw-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>

      {/* Hero backdrop */}
      <img
        src={BRAND.heroes}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 30%",
          filter: "saturate(1.05)",
        }}
      />
      {/* Cinematic vignette + bottom fade for legibility */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 90% at 50% 20%, rgba(5,6,11,0) 40%, rgba(5,6,11,0.55) 75%, rgba(5,6,11,0.95) 100%), linear-gradient(to bottom, rgba(5,6,11,0.35) 0%, rgba(5,6,11,0) 30%, rgba(5,6,11,0.85) 82%, #05060b 100%)",
        }}
      />

      {/* Logo */}
      <img
        src={BRAND.logo}
        alt="Grudge Warlords"
        data-testid="loading-logo"
        style={{
          position: "relative",
          width: "min(46vw, 420px)",
          maxHeight: "42vh",
          objectFit: "contain",
          marginTop: "auto",
          filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.7))",
          animation: "gw-fade 0.6s ease-out both",
        }}
      />

      {/* Bottom console */}
      <div
        style={{
          position: "relative",
          width: "min(92vw, 560px)",
          padding: "0 16px 44px",
          textAlign: "center",
        }}
      >
        {/* Rotating tip */}
        <div
          key={tip}
          data-testid="loading-tip"
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(0.78rem, 1.6vw, 0.95rem)",
            color: "#c7d2e1",
            minHeight: "2.4em",
            marginBottom: 18,
            animation: "gw-fade 0.5s ease-out both",
          }}
        >
          {TIPS[tip]}
        </div>

        {/* Progress track */}
        <div
          style={{
            position: "relative",
            height: 8,
            borderRadius: 999,
            overflow: "hidden",
            background: "rgba(148,163,184,0.16)",
            border: "1px solid rgba(148,163,184,0.25)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
          }}
        >
          {indeterminate ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "-40%",
                width: "40%",
                borderRadius: 999,
                background: `linear-gradient(90deg, transparent, ${FACTION[0]}, ${FACTION[1]}, ${FACTION[2]}, transparent)`,
                animation: "gw-sweep 1.15s ease-in-out infinite",
              }}
            />
          ) : (
            <div
              data-testid="loading-progress-bar"
              style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${FACTION[0]}, ${FACTION[1]}, ${FACTION[2]})`,
                transition: "width 0.3s ease-out",
              }}
            />
          )}
        </div>

        {/* Status line */}
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 14,
            fontSize: "clamp(0.7rem, 1.4vw, 0.82rem)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#94a3b8",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid rgba(148,163,184,0.35)",
              borderTopColor: "#e5e7eb",
              animation: "gw-spin 0.8s linear infinite",
            }}
          />
          <span data-testid="loading-status" style={{ animation: "gw-pulse 1.8s ease-in-out infinite" }}>
            {message ?? (indeterminate ? "Entering Aethermoor…" : `Loading ${Math.round(pct)}%`)}
          </span>
        </div>
      </div>
    </div>
  );
}
