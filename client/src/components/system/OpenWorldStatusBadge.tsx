/**
 * OpenWorldStatusBadge — small live status pill for the Grudge Open World
 * Server. Polls /health every 15s, shows online/offline + worlds/players
 * counts + round-trip latency. Drop anywhere; it positions itself absolutely.
 */

import { Globe2, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useGrudgeOpenWorld } from '@/hooks/useGrudgeOpenWorld';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OpenWorldStatusBadgeProps {
  className?: string;
}

export function OpenWorldStatusBadge({ className }: OpenWorldStatusBadgeProps) {
  const { state, snapshot, error, refresh } = useGrudgeOpenWorld({ intervalMs: 15_000 });

  const dotColor =
    state === 'online'    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
    state === 'connecting'? 'bg-amber-400 animate-pulse' :
    state === 'offline'   ? 'bg-rose-500' :
                            'bg-slate-500';

  const label =
    state === 'online'     ? 'Open World · Online' :
    state === 'connecting' ? 'Open World · Connecting…' :
    state === 'offline'    ? 'Open World · Offline' :
                             'Open World · Idle';

  const upH = snapshot ? Math.floor(snapshot.uptime / 3600) : 0;
  const upM = snapshot ? Math.floor((snapshot.uptime % 3600) / 60) : 0;

  return (
    <div
      data-testid="badge-openworld-status"
      title={error ?? `Grudge Open World Server`}
      className={cn(
        'pointer-events-auto inline-flex items-center gap-2 rounded-full',
        'border border-white/15 bg-slate-950/70 px-3 py-1.5 text-xs',
        'text-slate-200 shadow-lg backdrop-blur-md',
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dotColor)} />
      {state === 'connecting'
        ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
        : state === 'offline'
          ? <WifiOff className="h-3.5 w-3.5 text-rose-400" />
          : <Globe2 className="h-3.5 w-3.5 text-emerald-300/90" />}
      <span className="font-medium tracking-wide">{label}</span>
      {snapshot && (
        <span className="text-slate-400" data-testid="text-openworld-stats">
          · <span className="text-slate-200">{snapshot.worlds}</span> worlds
          · <span className="text-slate-200">{snapshot.players}</span> players
          · <span className="text-slate-200">{snapshot.latencyMs}ms</span>
          {upH || upM
            ? <> · up {upH ? `${upH}h` : ''}{upM ? `${upM}m` : ''}</>
            : null}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={refresh}
        className="ml-1 h-5 w-5 text-slate-400 hover:text-slate-100 hover:bg-white/10"
        data-testid="button-openworld-refresh"
        aria-label="Refresh Open World status"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
}
