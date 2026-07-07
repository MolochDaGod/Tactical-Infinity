import { useEffect, useRef, useState, useCallback } from 'react';
import { WORLD_ISLANDS, WORLD_ENEMY_SHIPS } from '@/lib/worldMapData';

/**
 * Minimap — MMO-style live corner minimap.
 *
 * North-up, player centered with a heading arrow, mouse-wheel zoom, and
 * labelled markers. Driven by the SAME source-of-truth world data the
 * full-screen map uses (`WORLD_ISLANDS` / `WORLD_ENEMY_SHIPS`) so it is
 * 100% accurate to the deployed game world.
 *
 * The viewer (player/ship) position is read every frame via `getViewer()`
 * inside the component's own requestAnimationFrame loop — it never triggers
 * a React re-render of the 3D scene that owns it.
 */

export interface MinimapViewer {
  x: number;
  z: number;
  /** Heading in radians (same convention as the 3D scenes). */
  rot: number;
}

interface MinimapProps {
  /** Live getter for the viewer's world position + heading. */
  getViewer: () => MinimapViewer | null;
  /** Diameter of the minimap in CSS pixels. */
  size?: number;
  /** Initial world-radius (in world units) shown from center to edge. */
  initialRange?: number;
  /** Corner placement. */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Optional: invoked when the player clicks the minimap (open full map). */
  onExpand?: () => void;
  /**
   * Optional marker set. When omitted, markers are baked from the canonical
   * WORLD_ISLANDS / WORLD_ENEMY_SHIPS data (accurate for the world-map scene).
   * Scenes with their own island roster (e.g. open-water sailing) should pass
   * their own markers so the minimap stays 100% accurate to that scene.
   */
  markers?: MinimapMarker[];
  className?: string;
}

const FACTION_COLORS: Record<string, string> = {
  crusade: '#c9a227',
  fabled: '#4a9eff',
  legion: '#e53935',
  neutral: '#9aa0a6',
  contested: '#b06bd6',
};

const MIN_RANGE = 600;
const MAX_RANGE = 9000;

export interface MinimapMarker {
  name: string;
  x: number;
  z: number;
  color: string;
  /** island | ship | boss | trading */
  kind: 'island' | 'ship' | 'boss' | 'trading';
  radius: number;
}
type BakedMarker = MinimapMarker;

function bakeMarkers(): BakedMarker[] {
  const out: BakedMarker[] = [];
  for (const isle of WORLD_ISLANDS) {
    const color =
      isle.hostility === 'hostile'
        ? FACTION_COLORS.legion
        : isle.hostility === 'contested'
          ? FACTION_COLORS.contested
          : FACTION_COLORS[isle.faction] ?? FACTION_COLORS.neutral;
    out.push({
      name: isle.name,
      x: isle.position.x,
      z: isle.position.z,
      color,
      kind: isle.hasTradingPost ? 'trading' : isle.enemyConfig?.bossType ? 'boss' : 'island',
      radius: (isle.tier ?? 1) * 1.2 + 3,
    });
  }
  for (const ship of WORLD_ENEMY_SHIPS) {
    out.push({
      name: ship.name,
      x: ship.patrolCenter.x,
      z: ship.patrolCenter.z,
      color: FACTION_COLORS[ship.faction] ?? FACTION_COLORS.legion,
      kind: 'ship',
      radius: 3,
    });
  }
  return out;
}

const POSITION_CLASS: Record<NonNullable<MinimapProps['position']>, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

export function Minimap({
  getViewer,
  size = 200,
  initialRange = 3200,
  position = 'top-right',
  onExpand,
  markers,
  className = '',
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rangeRef = useRef(initialRange);
  const markersRef = useRef<BakedMarker[]>(markers ?? bakeMarkers());
  markersRef.current = markers ?? markersRef.current;
  // Read getViewer through a ref so the RAF effect never tears down when the
  // parent passes a fresh inline getter each render.
  const getViewerRef = useRef(getViewer);
  getViewerRef.current = getViewer;
  const rafRef = useRef(0);
  const [coords, setCoords] = useState({ x: 0, z: 0 });
  const [zoomPct, setZoomPct] = useState(100);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
    rangeRef.current = Math.max(MIN_RANGE, Math.min(MAX_RANGE, rangeRef.current * factor));
    setZoomPct(Math.round((MAX_RANGE / rangeRef.current) * (MIN_RANGE / MAX_RANGE) * 100 + 0.5) || 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    canvas.addEventListener('wheel', onWheel, { passive: false });

    const r = size / 2;
    let frame = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      frame++;
      const viewer = getViewerRef.current();
      if (!viewer) {
        ctx.clearRect(0, 0, size, size);
        return;
      }
      // Throttle React coord readout to ~6Hz.
      if (frame % 10 === 0) setCoords({ x: Math.round(viewer.x), z: Math.round(viewer.z) });

      const range = rangeRef.current;
      const pxPerUnit = r / range;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      // Circular clip.
      ctx.beginPath();
      ctx.arc(r, r, r - 1, 0, Math.PI * 2);
      ctx.clip();

      // Ocean background gradient.
      const g = ctx.createRadialGradient(r, r, r * 0.1, r, r, r);
      g.addColorStop(0, '#0c2c4a');
      g.addColorStop(1, '#051422');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);

      // World grid (every 1000 world units), scrolls with player.
      ctx.strokeStyle = 'rgba(120,170,210,0.10)';
      ctx.lineWidth = 1;
      const grid = 1000;
      const ox = ((-viewer.x % grid) + grid) % grid;
      const oz = ((-viewer.z % grid) + grid) % grid;
      for (let gx = ox; gx <= 2 * range; gx += grid) {
        const sx = r + (gx - range) * pxPerUnit;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, size);
        ctx.stroke();
      }
      for (let gz = oz; gz <= 2 * range; gz += grid) {
        const sy = r + (gz - range) * pxPerUnit;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(size, sy);
        ctx.stroke();
      }

      // Markers (north-up: world +z maps to screen down).
      ctx.font = '9px "Cinzel", serif';
      ctx.textAlign = 'center';
      for (const m of markersRef.current) {
        const dx = (m.x - viewer.x) * pxPerUnit;
        const dz = (m.z - viewer.z) * pxPerUnit;
        const sx = r + dx;
        const sy = r + dz;
        const dist = Math.hypot(dx, dz);
        if (dist > r + 12) continue;

        ctx.beginPath();
        if (m.kind === 'ship') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = m.color;
          ctx.fillRect(-2.5, -2.5, 5, 5);
          ctx.restore();
        } else {
          ctx.fillStyle = m.color;
          ctx.globalAlpha = 0.92;
          ctx.arc(sx, sy, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (m.kind === 'trading') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(sx, sy, m.radius + 2.5, 0, Math.PI * 2);
            ctx.stroke();
          } else if (m.kind === 'boss') {
            ctx.strokeStyle = '#ff5252';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(sx, sy, m.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Labels for non-ship markers when reasonably close to center.
          if (dist < r * 0.92) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            const tw = ctx.measureText(m.name).width;
            ctx.fillRect(sx - tw / 2 - 3, sy - m.radius - 13, tw + 6, 11);
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillText(m.name, sx, sy - m.radius - 4);
          }
        }
      }

      // Player heading arrow at center.
      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(viewer.rot);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // North indicator on the ring.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 11px serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', r, 13);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [onWheel, size]);

  return (
    <div
      className={`absolute z-30 ${POSITION_CLASS[position]} ${className}`}
      data-testid="minimap"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full border-2 pointer-events-none"
          style={{
            borderColor: 'rgba(201,162,39,0.55)',
            boxShadow: '0 0 0 3px rgba(0,0,0,0.55), inset 0 0 18px rgba(0,0,0,0.6)',
          }}
        />
        <canvas
          ref={canvasRef}
          onClick={onExpand}
          style={{ width: size, height: size, borderRadius: '9999px', cursor: onExpand ? 'pointer' : 'ns-resize' }}
          title={onExpand ? 'Open full world map' : undefined}
          data-testid="minimap-canvas"
        />
        {onExpand && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 border border-amber-500/30 text-[9px] text-amber-100/80 pointer-events-none">
            Click to expand
          </div>
        )}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full mt-1 px-2 py-0.5 rounded bg-black/70 border border-amber-500/30 text-[10px] text-amber-100/90 whitespace-nowrap font-mono"
          data-testid="minimap-coords"
        >
          {coords.x}, {coords.z} · {zoomPct}%
        </div>
      </div>
    </div>
  );
}
