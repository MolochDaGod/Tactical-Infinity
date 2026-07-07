import type { CannonSkillId } from '@shared/gameDefinitions/sailing';

const DEFAULT_BASE_URL      = 'https://molochdagod.github.io/ObjectStore';
const DEFAULT_ID_URL        = 'https://id.grudge-studio.com';
const DEFAULT_GAME_URL      = 'https://api.grudge-studio.com';
const DEFAULT_ACCOUNT_URL   = 'https://account.grudge-studio.com';
const DEFAULT_LAUNCHER_URL  = 'https://launcher.grudge-studio.com';
const DEFAULT_WS_URL        = 'https://ws.grudge-studio.com';
const DEFAULT_ASSETS_API_URL = 'https://assets-api.grudge-studio.com';
const DEFAULT_ASSETS_CDN_URL = 'https://assets.grudge-studio.com';
const DEFAULT_AI_URL        = 'https://ai.grudge-studio.com';
const DEFAULT_STATUS_URL    = 'https://status.grudge-studio.com';

export const TIER_COLORS: Record<number, { name: string; hex: string; label: string }> = {
  1: { name: 'Bronze',  hex: '#8b7355', label: 'Common' },
  2: { name: 'Silver',  hex: '#a8a8a8', label: 'Uncommon' },
  3: { name: 'Blue',    hex: '#4a9eff', label: 'Rare' },
  4: { name: 'Purple',  hex: '#9d4dff', label: 'Epic' },
  5: { name: 'Red',     hex: '#ff4d4d', label: 'Legendary' },
  6: { name: 'Orange',  hex: '#ffaa00', label: 'Mythic' },
  7: { name: 'Gold',    hex: '#d4a84b', label: 'Ancient' },
  8: { name: 'Shimmer', hex: '#f0d890', label: 'Legendary Artifact' },
};

export const LS_KEYS = {
  AUTH_TOKEN:    'grudge_auth_token',
  USER_ID:       'grudge_user_id',
  USERNAME:      'grudge_username',
  DEVICE_ID:     'grudge_device_id',
  SESSION_TOKEN: 'grudge_session_token',
  SYNC_TOKEN:    'grudge_sync_token',
  SESSION_BLOB:  'grudge-session',
  API_KEY:       'grudge-api-key',
} as const;

export const PREFIX_MAP: Record<string, string> = {
  hero: 'HERO', item: 'ITEM', equipment: 'EQIP', ability: 'ABIL',
  material: 'MATL', recipe: 'RECP', node: 'NODE', mob: 'MOBS',
  boss: 'BOSS', mission: 'MISS', infusion: 'INFU', loot: 'LOOT',
  consumable: 'CONS', quest: 'QUST', zone: 'ZONE', save: 'SAVE',
};

let _sequenceCounter = 0;

function _fnv1aHash8(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash = hash >>> 0;
  const h2 = (hash ^ (hash >>> 16)) >>> 0;
  return h2.toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
}

export function generateGrudgeUuid(entityType: string, metadata = ''): string {
  const prefix = PREFIX_MAP[entityType] || entityType.slice(0, 4).toUpperCase();
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  _sequenceCounter++;
  const sequence = _sequenceCounter.toString(16).toUpperCase().padStart(6, '0');
  const hashInput = `${prefix}-${timestamp}-${sequence}-${metadata}-${Math.random()}`;
  const hash = _fnv1aHash8(hashInput);
  return `${prefix}-${timestamp}-${sequence}-${hash}`;
}

export interface ParsedGrudgeUuid {
  prefix: string;
  timestamp: string;
  sequence: string;
  hash: string;
  entityType: string;
  createdAt: Date;
}

export function parseGrudgeUuid(uuid: string): ParsedGrudgeUuid | null {
  if (!uuid || typeof uuid !== 'string') return null;
  const parts = uuid.split('-');
  if (parts.length !== 4) return null;
  return {
    prefix: parts[0],
    timestamp: parts[1],
    sequence: parts[2],
    hash: parts[3],
    entityType: Object.entries(PREFIX_MAP).find(([, v]) => v === parts[0])?.[0] || 'unknown',
    createdAt: new Date(
      parseInt(parts[1].slice(0, 4)),
      parseInt(parts[1].slice(4, 6)) - 1,
      parseInt(parts[1].slice(6, 8)),
      parseInt(parts[1].slice(8, 10)),
      parseInt(parts[1].slice(10, 12)),
      parseInt(parts[1].slice(12, 14))
    ),
  };
}

export function isValidGrudgeUuid(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return /^[A-Z]{4}-\d{14}-[0-9A-F]{6}-[0-9A-F]{8}$/.test(uuid);
}

function _resolveAuth(explicitToken?: string | null): { headers: Record<string, string>; token: string | null } {
  const headers: Record<string, string> = {};
  if (explicitToken) {
    headers['Authorization'] = `Bearer ${explicitToken}`;
    return { headers, token: explicitToken };
  }
  if (typeof localStorage === 'undefined') return { headers, token: null };

  const main = localStorage.getItem(LS_KEYS.AUTH_TOKEN);
  if (main) { headers['Authorization'] = `Bearer ${main}`; return { headers, token: main }; }

  const sync = localStorage.getItem(LS_KEYS.SYNC_TOKEN);
  if (sync) { headers['Authorization'] = `Bearer ${sync}`; return { headers, token: sync }; }

  try {
    const sess = JSON.parse(localStorage.getItem(LS_KEYS.SESSION_BLOB) || '{}');
    if (sess.token) { headers['Authorization'] = `Bearer ${sess.token}`; return { headers, token: sess.token }; }
    if (sess.discordId) { headers['x-discord-id'] = sess.discordId; return { headers, token: null }; }
  } catch { /* ignore */ }

  const apiKey = localStorage.getItem(LS_KEYS.API_KEY);
  if (apiKey) { headers['x-api-key'] = apiKey; return { headers, token: null }; }

  return { headers, token: null };
}

async function _authFetch<T = unknown>(baseUrl: string, path: string, token?: string | null, opts: RequestInit & { headers?: Record<string, string> } = {}): Promise<T | null> {
  const { headers: authHeaders } = _resolveAuth(token);
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...(opts.headers || {}) },
    });
    if (res.status === 401 && typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_KEYS.SYNC_TOKEN);
    }
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json() as Promise<T>;
    return null;
  } catch { return null; }
}

async function _authFetchList<T = unknown>(baseUrl: string, path: string, token?: string | null, opts?: RequestInit & { headers?: Record<string, string> }): Promise<T[]> {
  const data = await _authFetch<T[]>(baseUrl, path, token, opts);
  return Array.isArray(data) ? data : [];
}

export class GrudgeAuthClient {
  private _url: string;
  private _getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._getToken = getToken;
  }

  async loginWeb3Auth(idToken: string, wallet: string) { return _authFetch(this._url, '/auth/web3auth', null, { method: 'POST', body: JSON.stringify({ idToken, wallet }) }); }
  async loginDiscord(code: string, redirectUri: string) { return _authFetch(this._url, '/auth/discord/exchange', null, { method: 'POST', body: JSON.stringify({ code, redirect_uri: redirectUri }) }); }
  async login(username: string, password: string) { return _authFetch(this._url, '/auth/login', null, { method: 'POST', body: JSON.stringify({ username, password }) }); }
  async register(username: string, password: string, email?: string) { return _authFetch(this._url, '/auth/register', null, { method: 'POST', body: JSON.stringify({ username, password, email }) }); }
  async guest(deviceId: string) { return _authFetch(this._url, '/auth/guest', null, { method: 'POST', body: JSON.stringify({ deviceId }) }); }
  async puter(puterUuid: string, puterUsername: string) { return _authFetch(this._url, '/auth/puter', null, { method: 'POST', body: JSON.stringify({ puterUuid, puterUsername }) }); }
  async wallet(walletAddress: string, web3authToken: string) { return _authFetch(this._url, '/auth/wallet', null, { method: 'POST', body: JSON.stringify({ wallet_address: walletAddress, web3auth_token: web3authToken }) }); }
  async verify(token?: string) { return _authFetch(this._url, '/auth/verify', null, { method: 'POST', body: JSON.stringify({ token: token || this._getToken() }) }); }
  async getMe() { return _authFetch(this._url, '/identity/me', this._getToken()); }
  async updateMe(data: Record<string, unknown>) { return _authFetch(this._url, '/identity/me', this._getToken(), { method: 'PATCH', body: JSON.stringify(data) }); }
  async lookup(grudgeId: string) { return _authFetch(this._url, `/identity/${encodeURIComponent(grudgeId)}`, null); }

  async loginAndStore(method: 'login' | 'register' | 'guest' | 'puter' | 'wallet' | 'loginDiscord' | 'loginWeb3Auth', ...args: string[]) {
    const res = await (this as any)[method](...args) as any;
    if (!res) return null;
    const token = res.token || res.data?.token;
    const grudgeId = res.grudge_id || res.grudgeId || res.data?.grudge_id;
    const username = res.username || res.data?.username;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(LS_KEYS.AUTH_TOKEN, token);
      if (grudgeId) localStorage.setItem(LS_KEYS.USER_ID, grudgeId);
      if (username) localStorage.setItem(LS_KEYS.USERNAME, username);
    }
    return res;
  }

  static clearSession() {
    if (typeof localStorage === 'undefined') return;
    Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
  }
}

export class GrudgeGameClient {
  private _url: string;
  private _gt: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._gt = getToken;
  }

  private _get<T = unknown>(p: string) { return _authFetch<T>(this._url, p, this._gt()); }
  private _getList<T = unknown>(p: string) { return _authFetchList<T>(this._url, p, this._gt()); }
  private _post<T = unknown>(p: string, body: unknown) { return _authFetch<T>(this._url, p, this._gt(), { method: 'POST', body: JSON.stringify(body) }); }
  private _patch<T = unknown>(p: string, body?: unknown) { return _authFetch<T>(this._url, p, this._gt(), { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  private _del<T = unknown>(p: string) { return _authFetch<T>(this._url, p, this._gt(), { method: 'DELETE' }); }

  async health() { return _authFetch(this._url, '/health', null); }

  async listCharacters() { return this._getList('/characters'); }
  async getCharacter(id: string) { return this._get(`/characters/${id}`); }
  async createCharacter(data: unknown) { return this._post('/characters', data); }
  async updateCharacter(id: string, data: unknown) { return this._patch(`/characters/${id}`, data); }
  async deleteCharacter(id: string) { return this._del(`/characters/${id}`); }
  async updateCharacterStats(id: string, stats: unknown) { return this._patch(`/characters/${id}/stats`, stats); }

  async getBalance(charId: string) { return this._get(`/economy/balance?char_id=${charId}`); }
  async spend(data: unknown) { return this._post('/economy/spend', data); }
  async transfer(data: unknown) { return this._post('/economy/transfer', data); }

  async getRecipes(filters: { class?: string; profession?: string; tier?: number } = {}) {
    const p = new URLSearchParams();
    if (filters.class) p.set('class', filters.class);
    if (filters.profession) p.set('profession', filters.profession);
    if (filters.tier) p.set('tier', String(filters.tier));
    const qs = p.toString();
    return this._getList(`/crafting/recipes${qs ? '?' + qs : ''}`);
  }
  async getCraftingQueue(charId?: string) { return this._getList(`/crafting/queue${charId ? '?char_id=' + charId : ''}`); }
  async startCraft(data: unknown) { return this._post('/crafting/start', data); }
  async completeCraft(id: string) { return this._patch(`/crafting/${id}/complete`); }
  async cancelCraft(id: string) { return this._del(`/crafting/${id}`); }

  async getCombatHistory(charId: string) { return this._getList(`/combat/history?char_id=${charId}`); }
  async getCombatLeaderboard() { return this._getList('/combat/leaderboard'); }

  async listLobbies(filters: { mode?: string; limit?: number } = {}) {
    const p = new URLSearchParams();
    if (filters.mode) p.set('mode', filters.mode);
    if (filters.limit) p.set('limit', String(filters.limit));
    return this._getList(`/pvp/lobbies${p.toString() ? '?' + p : ''}`);
  }
  async createLobby(data: unknown) { return this._post('/pvp/lobbies', data); }
  async getLobby(code: string) { return this._get(`/pvp/lobbies/${code}`); }
  async joinLobby(code: string) { return this._post(`/pvp/lobbies/${code}/join`, {}); }
  async readyLobby(code: string) { return this._post(`/pvp/lobbies/${code}/ready`, {}); }
  async leaveLobby(code: string) { return this._post(`/pvp/lobbies/${code}/leave`, {}); }
  async getPvPQueue() { return this._get('/pvp/queue'); }
  async joinPvPQueue(data: unknown) { return this._post('/pvp/queue', data); }
  async leavePvPQueue() { return this._del('/pvp/queue'); }
  async getPvPLeaderboard(filters: { mode?: string; limit?: number } = {}) {
    const p = new URLSearchParams();
    if (filters.mode) p.set('mode', filters.mode);
    if (filters.limit) p.set('limit', String(filters.limit));
    return this._getList(`/pvp/leaderboard${p.toString() ? '?' + p : ''}`);
  }
  async getPvPMatch(id: string) { return this._get(`/pvp/match/${id}`); }

  async listIslands() { return this._getList('/islands'); }
  async getIsland(key: string) { return this._get(`/islands/${key}`); }

  async listMissions() { return this._getList('/missions'); }
  async createMission(data: unknown) { return this._post('/missions', data); }
  async completeMission(id: string) { return this._patch(`/missions/${id}/complete`); }
  async abandonMission(id: string) { return this._del(`/missions/${id}`); }

  async getCrew() { return this._get('/crews'); }
  async createCrew(data: unknown) { return this._post('/crews/create', data); }
  async joinCrew(id: string) { return this._post(`/crews/${id}/join`, {}); }
  async leaveCrew(id: string) { return this._post(`/crews/${id}/leave`, {}); }
  async claimBase(id: string) { return this._post(`/crews/${id}/claim-base`, {}); }

  async listFactions() { return this._getList('/factions/list'); }
  async getFaction(name: string) { return this._get(`/factions/${encodeURIComponent(name)}`); }
  async joinFaction(name: string) { return this._post(`/factions/${encodeURIComponent(name)}/join`, {}); }
  async factionLeaderboard() { return this._getList('/factions/leaderboard'); }

  async listInventory(charId?: string) { return this._getList(`/inventory${charId ? '?char_id=' + charId : ''}`); }
  async addItem(data: unknown) { return this._post('/inventory', data); }
  async equipItem(id: string, data: unknown) { return this._patch(`/inventory/${id}/equip`, data); }
  async unequipItem(id: string) { return this._patch(`/inventory/${id}/unequip`); }
  async removeItem(id: string) { return this._del(`/inventory/${id}`); }

  async getProfessions(charId: string) { return this._getList(`/professions/${charId}`); }
  async addProfessionXP(charId: string, profession: string, xp: number) { return this._post(`/professions/${charId}/xp`, { profession, xp }); }

  async listGouldstones() { return this._getList('/gouldstones'); }
  async cloneGouldstone(charId: string, name: string) { return this._post('/gouldstones/clone', { char_id: charId, name }); }
  async setGouldBehavior(id: string, behavior: string) { return this._patch(`/gouldstones/${id}/behavior`, { behavior_profile: behavior }); }
  async deployGouldstone(id: string, island: string) { return this._patch(`/gouldstones/${id}/deploy`, { island }); }
  async recallGouldstone(id: string) { return this._patch(`/gouldstones/${id}/recall`); }

  async startDungeon(charId: string, dungeonKey: string) { return this._post('/dungeon', { char_id: charId, dungeon_key: dungeonKey }); }
  async getDungeonRun(id: string) { return this._get(`/dungeon/${id}`); }

  async aiGenerateMission(data: unknown) { return this._post('/ai/mission/generate', data); }
  async aiCompanionInteract(data: unknown) { return this._post('/ai/companion/interact', data); }
  async aiGameContext() { return this._get('/ai/context'); }
  async aiFactionIntel() { return this._get('/ai/faction/intel'); }
  async aiCodeReview(data: unknown) { return this._post('/ai/dev/review', data); }
  async aiCodeGenerate(data: unknown) { return this._post('/ai/dev/generate', data); }
  async aiBalanceAnalyze(data: unknown) { return this._post('/ai/balance/analyze', data); }
  async aiLoreGenerate(data: unknown) { return this._post('/ai/lore/generate', data); }
  async aiArtPrompt(data: unknown) { return this._post('/ai/art/prompt', data); }
  async aiLLMStatus() { return this._get('/ai/llm/status'); }
}

export class GrudgeAccountClient {
  private _url: string;
  private _gt: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._gt = getToken;
  }

  private _get<T = unknown>(p: string) { return _authFetch<T>(this._url, p, this._gt()); }
  private _getList<T = unknown>(p: string) { return _authFetchList<T>(this._url, p, this._gt()); }
  private _post<T = unknown>(p: string, body: unknown) { return _authFetch<T>(this._url, p, this._gt(), { method: 'POST', body: JSON.stringify(body) }); }
  private _patch<T = unknown>(p: string, body?: unknown) { return _authFetch<T>(this._url, p, this._gt(), { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  private _del<T = unknown>(p: string) { return _authFetch<T>(this._url, p, this._gt(), { method: 'DELETE' }); }

  async getProfile(grudgeId: string) { return this._get(`/profile/${grudgeId}`); }
  async updateProfile(grudgeId: string, data: unknown) { return this._patch(`/profile/${grudgeId}`, data); }
  async listFriends() { return this._getList('/friends'); }
  async sendFriendRequest(grudgeId: string) { return this._post('/friends/request', { grudge_id: grudgeId }); }
  async respondFriend(id: string, action: string) { return this._patch(`/friends/${id}`, { action }); }
  async removeFriend(grudgeId: string) { return this._del(`/friends/${grudgeId}`); }
  async listNotifications(unreadOnly = false) { return this._getList(`/notifications${unreadOnly ? '?unread=1' : ''}`); }
  async markRead(id: string) { return this._patch(`/notifications/${id}/read`); }
  async markAllRead() { return this._patch('/notifications/read-all'); }
  async getAchievementDefs() { return this._getList('/achievements/defs'); }
  async getMyAchievements() { return this._get('/achievements/mine'); }
  async getUserAchievements(grudgeId: string) { return this._get(`/achievements/${grudgeId}`); }
  async listSessions() { return this._getList('/sessions'); }
  async renameSession(computerId: string, label: string) { return this._patch(`/sessions/${computerId}/label`, { label }); }
  async revokeSession(computerId: string) { return this._del(`/sessions/${computerId}`); }
  async getPuterLink() { return this._get('/puter/link'); }
}

export class GrudgeLauncherClient {
  private _url: string;
  private _gt: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._gt = getToken;
  }

  async getManifest(channel = 'stable') { return _authFetch(this._url, `/manifest?channel=${channel}`, this._gt()); }
  async getEntitlement() { return _authFetch(this._url, '/entitlement', this._gt()); }
  async getVersionHistory() { return _authFetchList(this._url, '/manifest/history', this._gt()); }
}

export class GrudgeAssetServiceClient {
  private _url: string;
  private _gt: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._gt = getToken;
  }

  async health() { return _authFetch(this._url, '/health', null); }

  async upload(file: File, meta: { key?: string; category?: string; tags?: string[]; description?: string } = {}) {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.key) fd.append('key', meta.key);
    if (meta.category) fd.append('category', meta.category);
    if (meta.tags) fd.append('tags', JSON.stringify(meta.tags));
    if (meta.description) fd.append('description', meta.description);
    const { headers: authHeaders } = _resolveAuth(this._gt());
    const res = await fetch(`${this._url}/assets`, { method: 'POST', headers: authHeaders, body: fd });
    if (!res.ok) return null;
    return res.json();
  }

  async listAssets(query: { prefix?: string; limit?: number; cursor?: string; category?: string } = {}) {
    const p = new URLSearchParams();
    if (query.prefix) p.set('prefix', query.prefix);
    if (query.limit) p.set('limit', String(query.limit));
    if (query.cursor) p.set('cursor', query.cursor);
    if (query.category) p.set('category', query.category);
    return _authFetchList(this._url, `/assets${p.toString() ? '?' + p : ''}`, this._gt());
  }

  async getAsset(key: string) { return _authFetch(this._url, `/assets/${encodeURIComponent(key)}`, this._gt()); }
  async deleteAsset(key: string) { return _authFetch(this._url, `/assets/${encodeURIComponent(key)}`, this._gt(), { method: 'DELETE' }); }
  getAssetUrl(key: string) { return `${this._url}/assets/${encodeURIComponent(key)}/file`; }
}

export class GrudgeAIClient {
  private _url: string;
  private _gt: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._gt = getToken;
  }

  private async _post(path: string, body: unknown) {
    const { headers } = _resolveAuth(this._gt());
    headers['Content-Type'] = 'application/json';
    const res = await fetch(`${this._url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`AI API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  async describe(opts: unknown) { return this._post('/v1/ai/describe', opts); }
  async generateSprite(prompt: string, opts: Record<string, unknown> = {}) { return this._post('/v1/ai/generate-sprite', { prompt, ...opts }); }
  async generateIcon(prompt: string, opts: Record<string, unknown> = {}) { return this._post('/v1/ai/generate-icon', { prompt, ...opts }); }
  async tag(assetId: string) { return this._post('/v1/ai/tag', { asset_id: assetId }); }
  async search(query: string, opts: Record<string, unknown> = {}) { return this._post('/v1/ai/search', { query, ...opts }); }
  async chat(prompt: string, opts: Record<string, unknown> = {}) { return this._post('/v1/ai/chat', { prompt, ...opts }); }
  async chatMessages(messages: unknown[], opts: Record<string, unknown> = {}) { return this._post('/v1/ai/chat', { messages, ...opts }); }
  async getJob(jobId: string) { return _authFetch(this._url, `/v1/ai/jobs/${jobId}`, this._gt()); }
  async listJobs(opts: { type?: string; limit?: number } = {}) {
    const p = new URLSearchParams();
    if (opts.type) p.set('type', opts.type);
    if (opts.limit) p.set('limit', String(opts.limit));
    return _authFetch(this._url, `/v1/ai/jobs${p.toString() ? '?' + p : ''}`, this._gt());
  }
  async health() { return _authFetch(this._url, '/health', null); }
}

export class GrudgeWSClient {
  private _url: string;
  private _gt: () => string | null;
  private _sockets: Record<string, any> = {};

  constructor(baseUrl: string, getToken: () => string | null) {
    this._url = baseUrl;
    this._gt = getToken;
  }

  connect(namespace = '/game') {
    if (this._sockets[namespace]) return this._sockets[namespace];
    const io = typeof window !== 'undefined' ? (window as any).io : null;
    if (!io) {
      throw new Error('socket.io-client not available — load socket.io client script in browser');
    }
    const socket = io(`${this._url}${namespace}`, { auth: { token: this._gt() }, transports: ['websocket', 'polling'] });
    this._sockets[namespace] = socket;
    return socket;
  }

  game() { return this.connect('/game'); }
  crew() { return this.connect('/crew'); }
  global() { return this.connect('/global'); }
  pvp() { return this.connect('/pvp'); }

  disconnect(namespace?: string) {
    if (namespace) { this._sockets[namespace]?.disconnect(); delete this._sockets[namespace]; }
    else { Object.values(this._sockets).forEach(s => s.disconnect()); this._sockets = {}; }
  }
}

export interface GrudgeSDKOptions {
  baseUrl?: string;
  workerUrl?: string;
  apiKey?: string;
  token?: string;
  idUrl?: string;
  gameUrl?: string;
  accountUrl?: string;
  launcherUrl?: string;
  wsUrl?: string;
  assetsApiUrl?: string;
  assetsCdnUrl?: string;
  aiUrl?: string;
}

export class GrudgeSDK {
  baseUrl: string;
  cache: Map<string, { data: unknown; timestamp: number }>;
  cacheExpiry: number;
  private _explicitToken: string | null;

  auth: GrudgeAuthClient;
  game: GrudgeGameClient;
  account: GrudgeAccountClient;
  launcher: GrudgeLauncherClient;
  assets: GrudgeAssetServiceClient;
  ai: GrudgeAIClient;
  ws: GrudgeWSClient;
  assetsCdnUrl: string;

  constructor(opts: GrudgeSDKOptions | string = DEFAULT_BASE_URL) {
    if (typeof opts === 'string') opts = { baseUrl: opts };

    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;

    this._explicitToken = opts.token || null;
    const getToken = (): string | null => {
      if (this._explicitToken) return this._explicitToken;
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(LS_KEYS.AUTH_TOKEN) || localStorage.getItem(LS_KEYS.SYNC_TOKEN) || null;
      }
      return null;
    };

    this.auth     = new GrudgeAuthClient(opts.idUrl || DEFAULT_ID_URL, getToken);
    this.game     = new GrudgeGameClient(opts.gameUrl || DEFAULT_GAME_URL, getToken);
    this.account  = new GrudgeAccountClient(opts.accountUrl || DEFAULT_ACCOUNT_URL, getToken);
    this.launcher = new GrudgeLauncherClient(opts.launcherUrl || DEFAULT_LAUNCHER_URL, getToken);
    this.assets   = new GrudgeAssetServiceClient(opts.assetsApiUrl || DEFAULT_ASSETS_API_URL, getToken);
    this.ai       = new GrudgeAIClient(opts.aiUrl || DEFAULT_AI_URL, getToken);
    this.ws       = new GrudgeWSClient(opts.wsUrl || DEFAULT_WS_URL, getToken);

    this.assetsCdnUrl = (opts.assetsCdnUrl || DEFAULT_ASSETS_CDN_URL).replace(/\/$/, '');
  }

  setToken(token: string) { this._explicitToken = token; }
  clearSession() { GrudgeAuthClient.clearSession(); this._explicitToken = null; }

  async fetch<T = unknown>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) return cached.data as T;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
    const data = await response.json();
    this.cache.set(url, { data, timestamp: Date.now() });
    return data as T;
  }

  clearCache() { this.cache.clear(); }

  async getWeapons() { return this.fetch('/api/v1/weapons.json'); }
  async getWeaponsByCategory(category: string) { const d = await this.getWeapons() as any; return d.categories[category] || null; }
  async getWeapon(weaponId: string) { const d = await this.getWeapons() as any; for (const cat of Object.values(d.categories) as any[]) { const w = cat.items.find((w: any) => w.id === weaponId); if (w) return w; } return null; }
  async getWeaponCategories() { return Object.keys((await this.getWeapons() as any).categories); }

  async getMaterials() { return this.fetch('/api/v1/materials.json'); }
  async getMaterialsByCategory(category: string) { const d = await this.getMaterials() as any; return d.categories[category] || null; }
  async getMaterialsByTier(tier: number) { const d = await this.getMaterials() as any; const r: any[] = []; for (const c of Object.values(d.categories) as any[]) r.push(...c.items.filter((m: any) => m.tier === tier)); return r; }

  async getArmor() { return this.fetch('/api/v1/armor.json'); }
  async getArmorByMaterial(material: string) { const d = await this.getArmor() as any; return d.materials[material] || null; }
  async getArmorBySlot(slot: string) { const d = await this.getArmor() as any; const r: any[] = []; for (const m of Object.values(d.materials) as any[]) r.push(...m.items.filter((i: any) => i.type === slot)); return r.length ? r : null; }

  async getConsumables() { return this.fetch('/api/v1/consumables.json'); }
  async getConsumablesByCategory(category: string) { const d = await this.getConsumables() as any; return d.categories[category] || null; }

  async getSkills() { return this.fetch('/api/v1/skills.json'); }
  async getSkillsByWeapon(weaponType: string) { const d = await this.getSkills() as any; return d.categories[weaponType] || null; }
  async getSkill(skillId: string) { const d = await this.getSkills() as any; for (const c of Object.values(d.categories) as any[]) { const s = c.skills.find((s: any) => s.id === skillId); if (s) return s; } return null; }

  async getProfessions() { return this.fetch('/api/v1/professions.json'); }
  async getProfession(professionId: string) { const d = await this.getProfessions() as any; return d.professions[professionId] || null; }

  async getRaces() { return this.fetch('/api/v1/races.json'); }
  async getRace(raceId: string) { const d = await this.getRaces() as any; return d.races[raceId] || null; }
  async getRacesByFaction(factionId: string) { const d = await this.getRaces() as any; return Object.values(d.races).filter((r: any) => r.faction === factionId); }

  async getClasses() { return this.fetch('/api/v1/classes.json'); }
  async getClass(classId: string) { const d = await this.getClasses() as any; return d.classes[classId] || null; }

  async getFactions() { return this.fetch('/api/v1/factions.json'); }
  async getFaction(factionId: string) { const d = await this.getFactions() as any; return d.factions[factionId] || null; }

  async getAttributes() { return this.fetch('/api/v1/attributes.json'); }
  async getAttribute(attributeId: string) { const d = await this.getAttributes() as any; return d.attributes.find((a: any) => a.id === attributeId) || null; }

  async getWeaponSkills() { return this.fetch('/api/v1/weaponSkills.json'); }
  async getWeaponSkillsByType(weaponType: string) { const d = await this.getWeaponSkills() as any; return (d.weaponTypes || []).find((wt: any) => wt.weaponType === weaponType) || null; }
  async getWeaponSkill(skillId: string) { const d = await this.getWeaponSkills() as any; for (const wt of d.weaponTypes || []) { const s = (wt.skills || []).find((s: any) => s.id === skillId); if (s) return { ...s, weaponType: wt.weaponType }; } return null; }

  async getEnemies() { return this.fetch('/api/v1/enemies.json'); }
  async getEnemy(enemyId: string) { const d = await this.getEnemies() as any; return (d.enemies || []).find((e: any) => e.id === enemyId) || null; }
  async getEnemiesByTier(tier: number) { const d = await this.getEnemies() as any; return (d.enemies || []).filter((e: any) => e.tier === tier); }
  async getBosses() { return this.fetch('/api/v1/bosses.json'); }
  async getBoss(bossId: string) { const d = await this.getBosses() as any; return (d.bosses || []).find((b: any) => b.id === bossId) || null; }

  async getSprites2d() { return this.fetch('/api/v1/sprites2d.json'); }
  async getSpritesByCategory(category: string) { const d = await this.getSprites2d() as any; return d.categories?.[category] || null; }
  async getSprites() { return this.fetch('/api/v1/sprites2d.json'); }
  async getSprite(uuid: string) { const d = await this.getSprites() as any; for (const c of Object.values(d.categories) as any[]) { const s = c.items.find((s: any) => s.uuid === uuid); if (s) return s; } return null; }
  async searchSprites(query: string, opts: { category?: string; limit?: number } = {}) {
    const q = (query || '').toLowerCase(); const d = await this.getSprites() as any; let results: any[] = [];
    for (const c of Object.values(d.categories) as any[]) results.push(...c.items);
    if (opts.category) results = results.filter((s: any) => s.category === opts.category);
    if (q) results = results.filter((s: any) => s.name?.toLowerCase().includes(q) || (s.category || '').includes(q) || (s.uuid || '').toLowerCase().includes(q) || (s.subcategory || '').includes(q));
    return results.slice(0, opts.limit || 50);
  }

  async getEffectSprites() { return this.fetch('/api/v1/effectSprites.json'); }
  async getAbilityEffects() { return this.fetch('/api/v1/abilityEffects.json'); }
  async getFactionUnits() { return this.fetch('/api/v1/factionUnits.json'); }

  async getCharacters(opts: { category?: string } = {}) { const d = await this.fetch('/api/v1/sprite-characters.json') as any; let ch = d.characters || []; if (opts.category) ch = ch.filter((c: any) => c.category === opts.category); return ch; }
  async getCharacter(uuid: string) { const d = await this.fetch('/api/v1/sprite-characters.json') as any; return (d.characters || []).find((c: any) => c.uuid === uuid) || null; }
  async getAnimationUrl(charUuid: string, animName: string) { const ch = await this.getCharacter(charUuid); if (!ch) return null; const a = ch.animations.find((a: any) => a.name === animName || a.id === animName); return a ? `${this.baseUrl}${a.path}` : null; }

  async getQuests() { return this.fetch('/api/v1/quests.json'); }
  async getQuestsForZone(zoneId: string) { const d = await this.getQuests() as any; return d.zoneQuests[zoneId] || []; }
  async getMissions() { return this.fetch('/api/v1/missions.json'); }
  async getDialogue() { return this.fetch('/api/v1/dialogue.json'); }
  async getCutscenes() { return this.fetch('/api/v1/cutscenes.json'); }
  async getRandomEvents() { return this.fetch('/api/v1/randomEvents.json'); }

  async getWorldMap() { return this.fetch('/api/v1/worldMap.json'); }
  async getRegions() { return this.fetch('/api/v1/regions.json'); }
  async getBattleFormations() { return this.fetch('/api/v1/battleFormations.json'); }
  async getEquipment() { return this.fetch('/api/v1/equipment.json'); }
  async getSkillTrees() { return this.fetch('/api/v1/skillTrees.json'); }
  async getEnemyTemplates() { return this.fetch('/api/v1/enemyTemplates.json'); }
  async getLore() { return this.fetch('/api/v1/lore.json'); }

  async getAudioRegistry() { return this.fetch('/api/v1/audio.json'); }
  async getVideoRegistry() { return this.fetch('/api/v1/video.json'); }
  async getHeroesRegistry() { return this.fetch('/api/v1/heroes.json'); }
  async getModels3d() { return this.fetch('/api/v1/models3d.json'); }
  async getStudioManifest() { return this.fetch('/api/v1/studio.json'); }

  async serverlessSearch(query: string, type = 'all', limit = 50) { return this.fetch(`/api/search?${new URLSearchParams({ q: query, type, limit: String(limit) })}`); }
  async getServerlessStats() { return this.fetch('/api/stats'); }

  async getIcons() { return this.fetch('/icons/icon-index.json'); }
  getWeaponIconUrl(category: string, index: number, tier = 1) {
    const cfgs: Record<string, { base: string; max: number; lowercase?: boolean; offset?: number }> = {
      swords: { base: 'Sword', max: 40 }, axes1h: { base: 'Axe', max: 30 }, daggers: { base: 'Dagger', max: 30 },
      bows: { base: 'Bow', max: 30 }, crossbows: { base: 'Crossbow', max: 30 }, hammers1h: { base: 'Hammer', max: 25 },
      spears: { base: 'Spear', max: 30 }, fireStaves: { base: 'staff', max: 60, lowercase: true },
      frostStaves: { base: 'staff', max: 60, lowercase: true, offset: 10 },
      holyStaves: { base: 'staff', max: 60, lowercase: true, offset: 20 }
    };
    const c = cfgs[category]; if (!c) return null;
    const idx = ((index + (c.offset || 0) + (tier - 1) * 3) % c.max) + 1;
    const suffix = c.lowercase ? `${idx}.png` : `${String(idx).padStart(2, '0')}.png`;
    return `${this.baseUrl}/icons/weapons/${c.base}_${suffix}`;
  }
  getArmorIconUrl(slot: string, tier = 1) {
    const b: Record<string, string> = { helm: 'Helm', chest: 'Chest', boots: 'Boots', gloves: 'Gloves', pants: 'Pants', belt: 'Belt', shoulder: 'Shoulder', bracer: 'Bracer', ring: 'Ring', necklace: 'necklace', back: 'Back' };
    return b[slot] ? `${this.baseUrl}/icons/armor/${b[slot]}_${String(tier * 5).padStart(2, '0')}.png` : null;
  }
  getMaterialIconUrl(category: string, tier = 1) {
    const b = ['essence', 'gem', 'infusion'].includes(category) ? 'Loot' : 'Res';
    return `${this.baseUrl}/icons/resources/${b}_${String(tier * 5).padStart(2, '0')}.png`;
  }

  async search(query: string) {
    const lower = query.toLowerCase();
    const results: Record<string, any[]> = { weapons: [], armor: [], materials: [], consumables: [], skills: [], races: [], classes: [] };
    const [weapons, armor, materials, consumables, skills, races, classes] = await Promise.all([
      this.getWeapons(), this.getArmor(), this.getMaterials(), this.getConsumables(), this.getSkills(), this.getRaces(), this.getClasses(),
    ]) as any[];
    for (const [cat, data] of Object.entries(weapons.categories) as any[]) results.weapons.push(...data.items.filter((w: any) => w.name.toLowerCase().includes(lower) || w.id.includes(lower)).map((w: any) => ({ ...w, category: cat })));
    for (const [mat, data] of Object.entries(armor.materials) as any[]) results.armor.push(...data.items.filter((a: any) => a.name.toLowerCase().includes(lower) || a.id.includes(lower)).map((a: any) => ({ ...a, materialCategory: mat })));
    for (const [cat, data] of Object.entries(materials.categories) as any[]) results.materials.push(...data.items.filter((m: any) => m.name.toLowerCase().includes(lower) || m.id.includes(lower)).map((m: any) => ({ ...m, category: cat })));
    for (const [cat, data] of Object.entries(consumables.categories) as any[]) results.consumables.push(...data.items.filter((c: any) => c.name.toLowerCase().includes(lower)).map((c: any) => ({ ...c, category: cat })));
    for (const [cat, data] of Object.entries(skills.categories) as any[]) results.skills.push(...data.skills.filter((s: any) => s.name.toLowerCase().includes(lower) || s.id.includes(lower)).map((s: any) => ({ ...s, weaponType: cat })));
    results.races.push(...Object.values(races.races).filter((r: any) => r.name.toLowerCase().includes(lower) || r.id.includes(lower) || r.trait.toLowerCase().includes(lower)));
    results.classes.push(...Object.values(classes.classes).filter((c: any) => c.name.toLowerCase().includes(lower) || c.id.includes(lower)));
    return results;
  }

  static getTierColor(tier: number) { return TIER_COLORS[tier] || null; }
  static get TIER_COLORS() { return { ...TIER_COLORS }; }
  static generateGrudgeUuid(entityType: string, metadata?: string) { return generateGrudgeUuid(entityType, metadata); }
  static parseGrudgeUuid(uuid: string) { return parseGrudgeUuid(uuid); }
  static isValidGrudgeUuid(uuid: string) { return isValidGrudgeUuid(uuid); }
  static get PREFIX_MAP() { return { ...PREFIX_MAP }; }
  static get LS_KEYS() { return { ...LS_KEYS }; }

  getDatabaseInfo() {
    return {
      provider: 'Self-hosted VPS (Docker + Coolify)',
      database: 'MySQL 8.0',
      cache: 'Redis 7',
      vps: '74.208.155.229',
      schemas: {
        users: ['users', 'sessions', 'character_wallets'],
        game: ['characters', 'gold_transactions', 'crafting_recipes', 'crafting_queue', 'combat_log', 'island_state', 'missions', 'crews', 'crew_members'],
      },
      services: {
        identity: DEFAULT_ID_URL, gameApi: DEFAULT_GAME_URL, accountApi: DEFAULT_ACCOUNT_URL,
        launcherApi: DEFAULT_LAUNCHER_URL, wsService: DEFAULT_WS_URL, assetService: DEFAULT_ASSETS_API_URL,
        assetsCdn: DEFAULT_ASSETS_CDN_URL, status: DEFAULT_STATUS_URL,
      },
    };
  }
}

let _sdkInstance: GrudgeSDK | null = null;

export function getGrudgeSDK(opts?: GrudgeSDKOptions): GrudgeSDK {
  if (!_sdkInstance) {
    _sdkInstance = new GrudgeSDK(opts);
  }
  return _sdkInstance;
}

export function resetGrudgeSDK() {
  _sdkInstance = null;
}
