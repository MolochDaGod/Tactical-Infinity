/**
 * grudgeOpenWorldClient.ts
 *
 * Typed client for the Grudge Open World server. The world now runs
 * **in-process** inside this app's Express server (see `server/openWorld.ts`),
 * served on the same origin/port as the page — so the browser talks to it via
 * relative URLs with no CORS or external Railway dependency.
 *
 * Surface:
 *   GET  /api/openworld/health  → { status, worlds, players, uptime }
 *   GET  /api/openworld/world   → world metadata + roster
 *   GET  /api/worlds            → { worlds: [...] }
 *   WS   /api/openworld/ws      → live presence: welcome / roster / say / state
 *
 * This module exposes:
 *   • `GrudgeOpenWorldClient` — REST helpers (health poll, world list).
 *   • `OpenWorldSocket`       — a resilient WebSocket wrapper (auto-reconnect,
 *     typed events, roster tracking) for live multiplayer presence.
 */

/**
 * Default base for REST calls. The world is same-origin, so a relative path is
 * all we need; everything is proxied by our own Express app.
 */
export const GRUDGE_OPENWORLD_BASE = '/api/openworld';

export interface OpenWorldHealth {
  status:  'ok' | string;
  worlds:  number;
  players: number;
  /** Server uptime in seconds. */
  uptime:  number;
}

export interface OpenWorldHealthSnapshot extends OpenWorldHealth {
  /** Round-trip ms for the /health call that produced this snapshot. */
  latencyMs: number;
  /** Wall-clock when the snapshot was captured. */
  fetchedAt: number;
}

export interface OpenWorldRosterEntry {
  slot:     number;
  id:       string;
  name:     string;
  joinedAt: number;
}

export interface OpenWorldSummary {
  id:       string;
  name:     string;
  capacity: number;
  players:  number;
}

export interface OpenWorldClientOptions {
  baseUrl?:    string;
  /** AbortSignal forwarded to every fetch. */
  signal?:     AbortSignal;
  /** Per-request timeout (ms). Default 8s. */
  timeoutMs?:  number;
}

export class OpenWorldNetworkError extends Error {
  readonly code = 'OPENWORLD_NETWORK' as const;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

export class GrudgeOpenWorldClient {
  readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private lastHealth: OpenWorldHealthSnapshot | null = null;

  constructor(opts: OpenWorldClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? GRUDGE_OPENWORLD_BASE).replace(/\/$/, '');
    this.defaultTimeout = opts.timeoutMs ?? 8000;
  }

  /** Last successful snapshot, or null if we have never reached the server. */
  get cached(): OpenWorldHealthSnapshot | null {
    return this.lastHealth;
  }

  /**
   * Hit `/health`. Always measures round-trip latency. Throws
   * `OpenWorldNetworkError` on transport failure or non-2xx.
   */
  async getHealth(opts: { signal?: AbortSignal } = {}): Promise<OpenWorldHealthSnapshot> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeout);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method:  'GET',
        headers: { Accept: 'application/json' },
        signal:  controller.signal,
        cache:   'no-store',
      });
      if (!res.ok) {
        throw new OpenWorldNetworkError(`/health returned HTTP ${res.status}`);
      }
      const body = await res.json() as OpenWorldHealth;

      const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const snap: OpenWorldHealthSnapshot = {
        status:    body.status,
        worlds:    body.worlds,
        players:   body.players,
        uptime:    body.uptime,
        latencyMs: Math.max(0, Math.round(t1 - t0)),
        fetchedAt: Date.now(),
      };
      this.lastHealth = snap;
      return snap;
    } catch (err) {
      if (err instanceof OpenWorldNetworkError) throw err;
      throw new OpenWorldNetworkError(
        err instanceof Error ? err.message : 'Open World fetch failed',
        err,
      );
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }

  /** Convenience boolean liveness check that swallows network errors. */
  async ping(): Promise<boolean> {
    try {
      const s = await this.getHealth();
      return s.status === 'ok';
    } catch {
      return false;
    }
  }

  /** `GET /api/worlds` → the list of available worlds. */
  async listWorlds(opts: { signal?: AbortSignal } = {}): Promise<OpenWorldSummary[]> {
    try {
      const res = await fetch('/api/worlds', {
        method:  'GET',
        headers: { Accept: 'application/json' },
        signal:  opts.signal,
        cache:   'no-store',
      });
      if (!res.ok) throw new OpenWorldNetworkError(`/api/worlds returned HTTP ${res.status}`);
      const body = await res.json() as { worlds: OpenWorldSummary[] };
      return Array.isArray(body.worlds) ? body.worlds : [];
    } catch (err) {
      if (err instanceof OpenWorldNetworkError) throw err;
      throw new OpenWorldNetworkError(
        err instanceof Error ? err.message : 'listWorlds failed', err,
      );
    }
  }

  /**
   * Open a live presence socket to the world. The returned `OpenWorldSocket`
   * connects immediately and auto-reconnects on transient drops.
   */
  connectSocket(opts: OpenWorldSocketOptions = {}): OpenWorldSocket {
    return new OpenWorldSocket(opts);
  }
}

let _instance: GrudgeOpenWorldClient | null = null;
export function getGrudgeOpenWorldClient(opts?: OpenWorldClientOptions): GrudgeOpenWorldClient {
  if (!_instance) _instance = new GrudgeOpenWorldClient(opts);
  return _instance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live presence socket
// ─────────────────────────────────────────────────────────────────────────────

export type OpenWorldSocketStatus =
  | 'connecting'
  | 'open'
  | 'closed'
  | 'rejected';

export interface OpenWorldSelf {
  id:   string;
  name: string;
  slot: number;
}

export interface OpenWorldSocketHandlers {
  /** Connection state changes. `info` carries reject reason / close code. */
  onStatus?(status: OpenWorldSocketStatus, info?: { reason?: string; code?: number }): void;
  /** Sent once on a successful join. */
  onWelcome?(self: OpenWorldSelf): void;
  /** Fired whenever the roster changes (join/leave/initial). */
  onRoster?(roster: OpenWorldRosterEntry[]): void;
  /** Chat relay from another player. */
  onSay?(msg: { from: string; name: string; text: string; t: number }): void;
  /** Generic state relay from another player (position, etc.). */
  onState?(msg: { from: string; data: any; t: number }): void;
}

export interface OpenWorldSocketOptions {
  /** Display name to claim in the world. */
  name?: string;
  handlers?: OpenWorldSocketHandlers;
  /** Set false to disable auto-reconnect. Default true. */
  reconnect?: boolean;
}

function buildWsUrl(name: string): string {
  const proto = (typeof location !== 'undefined' && location.protocol === 'https:') ? 'wss:' : 'ws:';
  const host = typeof location !== 'undefined' ? location.host : 'localhost';
  const q = name ? `?name=${encodeURIComponent(name)}` : '';
  return `${proto}//${host}/api/openworld/ws${q}`;
}

/**
 * Resilient wrapper around the world WebSocket. Tracks the live roster, emits
 * typed events, and reconnects with exponential backoff on unexpected drops.
 * A `world_full` rejection stops reconnection (the world has no free slot).
 */
export class OpenWorldSocket {
  private ws: WebSocket | null = null;
  private readonly name: string;
  private readonly handlers: OpenWorldSocketHandlers;
  private readonly autoReconnect: boolean;
  private intentionalClose = false;
  private rejected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private _status: OpenWorldSocketStatus = 'connecting';
  private _self: OpenWorldSelf | null = null;
  private _roster: OpenWorldRosterEntry[] = [];

  constructor(opts: OpenWorldSocketOptions = {}) {
    this.name = opts.name ?? '';
    this.handlers = opts.handlers ?? {};
    this.autoReconnect = opts.reconnect ?? true;
    this.open();
  }

  get status(): OpenWorldSocketStatus { return this._status; }
  get self(): OpenWorldSelf | null { return this._self; }
  get roster(): OpenWorldRosterEntry[] { return this._roster; }

  private setStatus(s: OpenWorldSocketStatus, info?: { reason?: string; code?: number }) {
    this._status = s;
    try { this.handlers.onStatus?.(s, info); } catch { /* ignore */ }
  }

  private open() {
    if (typeof WebSocket === 'undefined') return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(buildWsUrl(this.name));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('open');
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      this.handleMessage(msg);
    };

    ws.onerror = () => {
      // onclose will follow; nothing actionable here.
    };

    ws.onclose = (ev) => {
      this.ws = null;
      if (this.intentionalClose || this.rejected) {
        this.setStatus(this.rejected ? 'rejected' : 'closed', { code: ev.code, reason: ev.reason });
        return;
      }
      this.setStatus('closed', { code: ev.code, reason: ev.reason });
      this.scheduleReconnect();
    };
  }

  private handleMessage(msg: any) {
    switch (msg?.type) {
      case 'welcome': {
        this._self = { id: msg.playerId, name: msg.playerName, slot: msg.slot };
        this._roster = Array.isArray(msg.roster) ? msg.roster : [];
        try { this.handlers.onWelcome?.(this._self); } catch { /* ignore */ }
        try { this.handlers.onRoster?.(this._roster); } catch { /* ignore */ }
        break;
      }
      case 'rejected': {
        // World full (or other server refusal) — do not reconnect.
        this.rejected = true;
        this.setStatus('rejected', { reason: msg.reason });
        break;
      }
      case 'player_joined': {
        if (!this._roster.some(r => r.id === msg.id)) {
          this._roster = [...this._roster, {
            slot: msg.slot, id: msg.id, name: msg.name, joinedAt: Date.now(),
          }];
          try { this.handlers.onRoster?.(this._roster); } catch { /* ignore */ }
        }
        break;
      }
      case 'player_left': {
        const next = this._roster.filter(r => r.id !== msg.id);
        if (next.length !== this._roster.length) {
          this._roster = next;
          try { this.handlers.onRoster?.(this._roster); } catch { /* ignore */ }
        }
        break;
      }
      case 'say':
        try { this.handlers.onSay?.(msg); } catch { /* ignore */ }
        break;
      case 'state':
        try { this.handlers.onState?.(msg); } catch { /* ignore */ }
        break;
      case 'pong':
        // liveness — nothing to do (browser auto-pongs server WS pings too).
        break;
      default:
        break;
    }
  }

  private scheduleReconnect() {
    if (!this.autoReconnect || this.intentionalClose || this.rejected) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(15_000, 1000 * 2 ** Math.min(this.reconnectAttempts - 1, 4));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  /** Send a raw JSON message (no-op if the socket is not open). */
  send(msg: object): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try { ws.send(JSON.stringify(msg)); return true; } catch { return false; }
  }

  /** Broadcast a chat line to everyone in the world. */
  say(text: string): boolean {
    return this.send({ type: 'say', text: String(text ?? '').slice(0, 240) });
  }

  /** Relay arbitrary state (e.g. ship pose) to other players. */
  sendState(data: object): boolean {
    return this.send({ type: 'state', data });
  }

  /** Permanently close the socket and stop reconnecting. */
  close() {
    this.intentionalClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    const ws = this.ws;
    this.ws = null;
    if (ws) { try { ws.close(1000, 'client_closed'); } catch { /* ignore */ } }
  }
}
