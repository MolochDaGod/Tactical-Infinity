/**
 * server/openWorld.ts
 *
 * In-memory Grudge Open World server.
 *
 *   • 1 fixed world ("aethermoor-1"), capacity 4 players.
 *   • REST /api/openworld/health  → { status, worlds, players, uptime }
 *   • REST /api/openworld/world   → world metadata + roster
 *   • REST /api/worlds            → array form for legacy/typed-stub callers
 *   • WS   /api/openworld/ws      → player slot, broadcasts, heartbeat
 *
 * No persistence between server restarts. Intended to run on a Reserved VM
 * deployment so the world stays up; on autoscale (Cloud Run) it resets every
 * cold start, which is fine for status-pill purposes but not for real play.
 */

import type { Server as HttpServer } from "http";
import type { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";

const WORLD_ID = "aethermoor-1";
const WORLD_NAME = "Aethermoor — Open World";
const MAX_PLAYERS = 4;
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 2;

interface PlayerSlot {
  slot: number;
  id: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
  ws: WebSocket;
}

interface RosterEntry {
  slot: number;
  id: string;
  name: string;
  joinedAt: number;
}

class WorldRoom {
  readonly id = WORLD_ID;
  readonly name = WORLD_NAME;
  readonly capacity = MAX_PLAYERS;
  readonly bootTime = Date.now();

  private slots: (PlayerSlot | null)[] = Array(MAX_PLAYERS).fill(null);

  get playerCount(): number {
    let n = 0;
    for (const s of this.slots) if (s) n++;
    return n;
  }

  get roster(): RosterEntry[] {
    const out: RosterEntry[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) out.push({ slot: i, id: s.id, name: s.name, joinedAt: s.joinedAt });
    }
    return out;
  }

  uptimeSeconds(): number {
    return Math.floor((Date.now() - this.bootTime) / 1000);
  }

  admit(name: string, ws: WebSocket): PlayerSlot | null {
    const slot = this.slots.findIndex(s => s === null);
    if (slot === -1) return null;
    const trimmed = (name || "").trim().slice(0, 32);
    const player: PlayerSlot = {
      slot,
      id: randomUUID(),
      name: trimmed || `Player-${slot + 1}`,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      ws,
    };
    this.slots[slot] = player;
    return player;
  }

  release(playerId: string): PlayerSlot | null {
    const idx = this.slots.findIndex(s => s?.id === playerId);
    if (idx === -1) return null;
    const player = this.slots[idx];
    this.slots[idx] = null;
    return player;
  }

  forEachPlayer(cb: (p: PlayerSlot) => void) {
    for (const s of this.slots) if (s) cb(s);
  }

  broadcast(msg: object, exceptWs?: WebSocket) {
    const payload = JSON.stringify(msg);
    this.forEachPlayer(p => {
      if (p.ws === exceptWs) return;
      if (p.ws.readyState !== WebSocket.OPEN) return;
      try { p.ws.send(payload); } catch { /* dropped */ }
    });
  }
}

export const worldRoom = new WorldRoom();

/** Mount HTTP REST routes for Open World. Call from registerRoutes(). */
export function mountOpenWorldRoutes(app: Express): void {
  app.get("/api/openworld/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      status:  "ok",
      worlds:  1,
      players: worldRoom.playerCount,
      uptime:  worldRoom.uptimeSeconds(),
    });
  });

  app.get("/api/openworld/world", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      id:       worldRoom.id,
      name:     worldRoom.name,
      capacity: worldRoom.capacity,
      players:  worldRoom.playerCount,
      roster:   worldRoom.roster,
      uptime:   worldRoom.uptimeSeconds(),
    });
  });

  app.get("/api/worlds", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      worlds: [{
        id:       worldRoom.id,
        name:     worldRoom.name,
        capacity: worldRoom.capacity,
        players:  worldRoom.playerCount,
      }],
    });
  });
}

/**
 * Mount a WebSocketServer on the existing HTTP server at /api/openworld/ws.
 * Sharing the HTTP server keeps the deployment to a single port.
 */
export function mountOpenWorldWebSocket(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/api/openworld/ws")) return;
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/api/openworld/ws", "http://localhost");
    const requestedName = url.searchParams.get("name") ?? "";

    const player = worldRoom.admit(requestedName, ws);
    if (!player) {
      try {
        ws.send(JSON.stringify({
          type: "rejected",
          reason: "world_full",
          capacity: MAX_PLAYERS,
        }));
      } catch { /* ignore */ }
      ws.close(4000, "world_full");
      return;
    }

    ws.send(JSON.stringify({
      type:    "welcome",
      world:   { id: worldRoom.id, name: worldRoom.name, capacity: worldRoom.capacity },
      slot:    player.slot,
      playerId: player.id,
      playerName: player.name,
      roster:  worldRoom.roster,
      t:       Date.now(),
    }));

    worldRoom.broadcast(
      { type: "player_joined", slot: player.slot, id: player.id, name: player.name },
      ws,
    );

    ws.on("pong", () => { player.lastSeen = Date.now(); });

    ws.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      player.lastSeen = Date.now();
      switch (msg?.type) {
        case "ping":
          try { ws.send(JSON.stringify({ type: "pong", t: Date.now() })); } catch { /* ignore */ }
          break;
        case "say":
          worldRoom.broadcast({
            type: "say",
            from: player.id,
            name: player.name,
            text: String(msg.text ?? "").slice(0, 240),
            t:    Date.now(),
          });
          break;
        case "state":
          // Generic relay — clients echo position/animation deltas; capped at
          // 4 players so naive broadcast is fine.
          worldRoom.broadcast({
            type: "state",
            from: player.id,
            data: msg.data,
            t:    Date.now(),
          }, ws);
          break;
        default:
          // unknown message → ignore
      }
    });

    const drop = () => {
      const released = worldRoom.release(player.id);
      if (released) {
        worldRoom.broadcast({ type: "player_left", slot: player.slot, id: player.id });
      }
    };
    ws.on("close", drop);
    ws.on("error", () => {
      try { ws.terminate(); } catch { /* ignore */ }
      drop();
    });
  });

  // Heartbeat — pings every player; disconnects zombie sockets.
  const heartbeat = setInterval(() => {
    const now = Date.now();
    worldRoom.forEachPlayer(p => {
      if (p.ws.readyState !== WebSocket.OPEN) return;
      if (now - p.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        try { p.ws.terminate(); } catch { /* ignore */ }
        return;
      }
      try { p.ws.ping(); } catch { /* ignore */ }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeat));
  return wss;
}
