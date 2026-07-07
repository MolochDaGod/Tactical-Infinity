/**
 * useOpenWorldSocket
 *
 * Connects to the live Grudge Open World server (`/api/openworld/ws`) for the
 * lifetime of the mounted component and keeps a resilient presence session.
 *
 * Design notes:
 *   • Connection status + roster are React state (they change rarely — on
 *     join/leave/reconnect) so consumers can render a status pill or list.
 *   • Other players' high-frequency position updates land in `othersRef`
 *     (a Map) WITHOUT triggering re-renders — read it from an animation loop
 *     (e.g. the minimap) so the heavy host scene never re-renders per packet.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  OpenWorldSocket,
  type OpenWorldRosterEntry,
  type OpenWorldSelf,
  type OpenWorldSocketStatus,
} from '@/lib/grudgeOpenWorldClient';

export interface OpenWorldPeer {
  id:   string;
  name: string;
  x:    number;
  z:    number;
  rot:  number;
  /** Wall-clock of the last state packet. */
  lastUpdate: number;
}

export interface UseOpenWorldSocketOptions {
  /** Set false to skip connecting entirely. Default true. */
  enabled?: boolean;
  /** Display name to claim. Falls back to a persisted/generated captain name. */
  name?: string;
}

export interface OpenWorldSocketState {
  status:   OpenWorldSocketStatus | 'idle';
  self:     OpenWorldSelf | null;
  roster:   OpenWorldRosterEntry[];
  /** Live map of other players' latest poses — read in a RAF loop, not React. */
  othersRef: React.MutableRefObject<Map<string, OpenWorldPeer>>;
  /** Number of OTHER players currently connected (excludes self). */
  peerCount: number;
  say:       (text: string) => void;
  sendState: (data: object) => void;
}

const NAME_KEY = 'gw-player-name';

function resolvePlayerName(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 32);
  try {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored && stored.trim()) return stored.trim().slice(0, 32);
    const generated = `Captain-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(NAME_KEY, generated);
    return generated;
  } catch {
    return `Captain-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

export function useOpenWorldSocket(opts: UseOpenWorldSocketOptions = {}): OpenWorldSocketState {
  const enabled = opts.enabled ?? true;

  const [status, setStatus]   = useState<OpenWorldSocketStatus | 'idle'>('idle');
  const [self, setSelf]       = useState<OpenWorldSelf | null>(null);
  const [roster, setRoster]   = useState<OpenWorldRosterEntry[]>([]);

  const socketRef  = useRef<OpenWorldSocket | null>(null);
  const othersRef  = useRef<Map<string, OpenWorldPeer>>(new Map());
  const selfIdRef  = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) { setStatus('idle'); return; }

    const name = resolvePlayerName(opts.name);
    const others = othersRef.current;
    others.clear();

    const socket = new OpenWorldSocket({
      name,
      handlers: {
        onStatus: (s) => setStatus(s),
        onWelcome: (me) => { selfIdRef.current = me.id; setSelf(me); },
        onRoster: (r) => {
          setRoster(r);
          // Prune peers that left so the minimap drops their blip.
          const live = new Set(r.map(p => p.id));
          for (const id of Array.from(others.keys())) {
            if (!live.has(id) || id === selfIdRef.current) others.delete(id);
          }
        },
        onState: (msg) => {
          if (!msg || msg.from === selfIdRef.current) return;
          const d = msg.data ?? {};
          if (typeof d.x !== 'number' || typeof d.z !== 'number') return;
          const prev = others.get(msg.from);
          others.set(msg.from, {
            id:   msg.from,
            name: typeof d.name === 'string' ? d.name : (prev?.name ?? 'Captain'),
            x:    d.x,
            z:    d.z,
            rot:  typeof d.rot === 'number' ? d.rot : (prev?.rot ?? 0),
            lastUpdate: msg.t ?? Date.now(),
          });
        },
      },
    });
    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
      selfIdRef.current = null;
      others.clear();
      setStatus('idle');
      setSelf(null);
      setRoster([]);
    };
  }, [enabled, opts.name]);

  const say = useCallback((text: string) => { socketRef.current?.say(text); }, []);
  const sendState = useCallback((data: object) => { socketRef.current?.sendState(data); }, []);

  const peerCount = roster.filter(r => r.id !== self?.id).length;

  return { status, self, roster, othersRef, peerCount, say, sendState };
}
