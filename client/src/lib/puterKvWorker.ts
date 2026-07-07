import { isPuterAvailable, type SaveGameData } from "./puterAuth";

const KV_PREFIX      = "tethical_";
const SESSION_KEY    = `${KV_PREFIX}session`;
const STATS_KEY      = `${KV_PREFIX}lifetime_stats`;
const AUTOSAVE_KEY   = (id: string) => `${KV_PREFIX}autosave_${id}`;

const AUTOSAVE_INTERVAL_MS = 60_000;

export interface LifetimeStats {
  battlesWon: number;
  battlesLost: number;
  totalGoldEarned: number;
  totalResourcesHarvested: number;
  totalIslandsVisited: number;
  totalPlaytimeMs: number;
  lastUpdated: string;
}

export interface SessionRecord {
  startedAt: string;
  playerId: string;
  battlesThisSession: number;
  goldThisSession: number;
  resourcesThisSession: number;
}

export interface BattleResult {
  won: boolean;
  goldEarned: number;
  enemyFaction: string;
  mapName: string;
  durationMs: number;
  timestamp: string;
}

export interface ResourceHarvestEvent {
  resource: string;
  amount: number;
  islandId: string;
  timestamp: string;
}

type WorkerState = "idle" | "running" | "stopped";

class PuterKvWorker {
  private state: WorkerState = "idle";
  private timer: ReturnType<typeof setInterval> | null = null;
  private saveData: SaveGameData | null = null;
  private sessionRecord: SessionRecord | null = null;
  private sessionStart: number = 0;
  private dirtyFlag = false;

  get isRunning() { return this.state === "running"; }

  async start(save: SaveGameData): Promise<void> {
    if (this.state === "running") {
      this.saveData = save;
      return;
    }
    if (!isPuterAvailable()) {
      console.warn("[KvWorker] Puter not available — worker not started");
      return;
    }

    this.saveData = save;
    this.sessionStart = Date.now();
    this.state = "running";

    this.sessionRecord = {
      startedAt: new Date().toISOString(),
      playerId: save.player.id,
      battlesThisSession: 0,
      goldThisSession: 0,
      resourcesThisSession: 0,
    };

    try {
      await window.puter.kv.set(SESSION_KEY, this.sessionRecord);
    } catch { /* non-fatal */ }

    this.timer = setInterval(() => this._tick(), AUTOSAVE_INTERVAL_MS);
    console.log("[KvWorker] Started for player:", save.player.id);
  }

  async stop(): Promise<void> {
    if (this.state !== "running") return;
    this.state = "stopped";

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this._flush();
    await this._updateLifetimePlaytime();
    console.log("[KvWorker] Stopped.");
  }

  updateSaveData(save: SaveGameData): void {
    this.saveData = save;
    this.dirtyFlag = true;
  }

  async recordBattle(result: BattleResult): Promise<void> {
    if (!isPuterAvailable() || !this.sessionRecord) return;

    if (result.won) {
      this.sessionRecord.battlesThisSession++;
    }
    this.sessionRecord.goldThisSession += result.goldEarned;
    this.dirtyFlag = true;

    try {
      const stats = await this._loadLifetimeStats();
      if (result.won) stats.battlesWon++;
      else stats.battlesLost++;
      stats.totalGoldEarned += result.goldEarned;
      stats.lastUpdated = new Date().toISOString();
      await window.puter.kv.set(STATS_KEY, stats);

      const historyKey = `${KV_PREFIX}battle_history`;
      let history: BattleResult[] = [];
      try {
        const raw = await window.puter.kv.get(historyKey);
        if (Array.isArray(raw)) history = raw as BattleResult[];
      } catch { /* no history yet */ }
      history.unshift(result);
      if (history.length > 50) history = history.slice(0, 50);
      await window.puter.kv.set(historyKey, history);

      console.log("[KvWorker] Battle recorded. Won:", result.won);
    } catch (err) {
      console.error("[KvWorker] Battle record failed:", err);
    }
  }

  async recordResourceHarvest(event: ResourceHarvestEvent): Promise<void> {
    if (!isPuterAvailable() || !this.sessionRecord) return;

    this.sessionRecord.resourcesThisSession += event.amount;
    this.dirtyFlag = true;

    try {
      const stats = await this._loadLifetimeStats();
      stats.totalResourcesHarvested += event.amount;
      stats.lastUpdated = new Date().toISOString();
      await window.puter.kv.set(STATS_KEY, stats);
    } catch (err) {
      console.error("[KvWorker] Harvest record failed:", err);
    }
  }

  async recordIslandVisit(islandId: string): Promise<void> {
    if (!isPuterAvailable()) return;
    try {
      const visitedKey = `${KV_PREFIX}visited_islands`;
      let visited: string[] = [];
      try {
        const raw = await window.puter.kv.get(visitedKey);
        if (Array.isArray(raw)) visited = raw as string[];
      } catch { /* empty */ }
      if (!visited.includes(islandId)) {
        visited.push(islandId);
        await window.puter.kv.set(visitedKey, visited);
        const stats = await this._loadLifetimeStats();
        stats.totalIslandsVisited = visited.length;
        stats.lastUpdated = new Date().toISOString();
        await window.puter.kv.set(STATS_KEY, stats);
      }
    } catch (err) {
      console.error("[KvWorker] Island visit record failed:", err);
    }
  }

  async getLifetimeStats(): Promise<LifetimeStats> {
    return this._loadLifetimeStats();
  }

  async getLastAutosave(playerId: string): Promise<SaveGameData | null> {
    if (!isPuterAvailable()) return null;
    try {
      const raw = await window.puter.kv.get(AUTOSAVE_KEY(playerId));
      return raw as SaveGameData | null;
    } catch {
      return null;
    }
  }

  async getBattleHistory(): Promise<BattleResult[]> {
    if (!isPuterAvailable()) return [];
    try {
      const raw = await window.puter.kv.get(`${KV_PREFIX}battle_history`);
      if (Array.isArray(raw)) return raw as BattleResult[];
      return [];
    } catch {
      return [];
    }
  }

  private async _tick(): Promise<void> {
    if (this.state !== "running" || !this.saveData || !this.dirtyFlag) return;
    await this._flush();
  }

  private async _flush(): Promise<void> {
    if (!isPuterAvailable() || !this.saveData) return;
    try {
      const autosave = {
        ...this.saveData,
        player: {
          ...this.saveData.player,
          lastPlayedAt: new Date().toISOString(),
        },
        _autosavedAt: new Date().toISOString(),
      };
      await window.puter.kv.set(AUTOSAVE_KEY(this.saveData.player.id), autosave);
      if (this.sessionRecord) {
        await window.puter.kv.set(SESSION_KEY, this.sessionRecord);
      }
      this.dirtyFlag = false;
      console.log("[KvWorker] Auto-save complete:", new Date().toLocaleTimeString());
    } catch (err) {
      console.error("[KvWorker] Auto-save failed:", err);
    }
  }

  private async _updateLifetimePlaytime(): Promise<void> {
    if (!isPuterAvailable()) return;
    try {
      const elapsed = Date.now() - this.sessionStart;
      const stats = await this._loadLifetimeStats();
      stats.totalPlaytimeMs += elapsed;
      stats.lastUpdated = new Date().toISOString();
      await window.puter.kv.set(STATS_KEY, stats);
    } catch { /* non-fatal */ }
  }

  private async _loadLifetimeStats(): Promise<LifetimeStats> {
    const defaults: LifetimeStats = {
      battlesWon: 0,
      battlesLost: 0,
      totalGoldEarned: 0,
      totalResourcesHarvested: 0,
      totalIslandsVisited: 0,
      totalPlaytimeMs: 0,
      lastUpdated: new Date().toISOString(),
    };
    if (!isPuterAvailable()) return defaults;
    try {
      const raw = await window.puter.kv.get(STATS_KEY);
      if (raw && typeof raw === "object") return { ...defaults, ...(raw as Partial<LifetimeStats>) };
    } catch { /* empty */ }
    return defaults;
  }
}

export const kvWorker = new PuterKvWorker();
