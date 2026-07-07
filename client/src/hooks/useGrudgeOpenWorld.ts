/**
 * useGrudgeOpenWorld
 *
 * React hook that polls the Grudge Open World Server's `/health` endpoint
 * and exposes a typed live status. Cancels in-flight requests on unmount and
 * pauses polling while the tab is hidden.
 */

import { useEffect, useRef, useState } from 'react';
import {
  getGrudgeOpenWorldClient,
  type OpenWorldHealthSnapshot,
} from '@/lib/grudgeOpenWorldClient';

export type OpenWorldConnectionState = 'idle' | 'connecting' | 'online' | 'offline';

export interface OpenWorldHookState {
  state:     OpenWorldConnectionState;
  snapshot:  OpenWorldHealthSnapshot | null;
  /** Last error message, or null if everything's fine. */
  error:     string | null;
  /** Manually trigger a refresh. */
  refresh:   () => void;
}

export interface UseOpenWorldOptions {
  /** Poll interval in ms while the tab is visible. Default 15 s. */
  intervalMs?: number;
  /** Set false to skip polling entirely (one-shot only). */
  enabled?:    boolean;
}

export function useGrudgeOpenWorld(opts: UseOpenWorldOptions = {}): OpenWorldHookState {
  const intervalMs = opts.intervalMs ?? 15_000;
  const enabled    = opts.enabled    ?? true;

  const [state, setState]       = useState<OpenWorldConnectionState>('idle');
  const [snapshot, setSnap]     = useState<OpenWorldHealthSnapshot | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const refreshTokenRef         = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const client = getGrudgeOpenWorldClient();
    let cancelled = false;
    const controller = new AbortController();

    const tick = async () => {
      if (cancelled) return;
      setState(prev => (prev === 'online' ? 'online' : 'connecting'));
      try {
        const snap = await client.getHealth({ signal: controller.signal });
        if (cancelled) return;
        setSnap(snap);
        setError(null);
        setState('online');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setState('offline');
      }
    };

    tick();
    const timerId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') tick();
    }, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs, refreshTokenRef.current]);

  return {
    state,
    snapshot,
    error,
    refresh: () => { refreshTokenRef.current += 1; setState('connecting'); },
  };
}
