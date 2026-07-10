/**
 * Fleet character sync — persists Tactical captains to GrudgeBuilder
 * `/api/characters` (Railway Postgres SSOT) via same-origin Vercel rewrites.
 */
import { FLEET_API_PATHS } from '@shared/grudgeFleetBridge';
import { LS_KEYS } from '@/lib/grudge-sdk';
import {
  type CaptainBuild,
  type ClassKey,
  CLASS_TO_ARCHETYPE,
  CLASS_TO_WEAPON_STYLE,
  saveCaptainBuild,
  loadCaptainBuild,
} from '@/lib/captainBuild';
import type { Race } from '@/data/toonRTSAssets';
import { RACE_PREFIXES } from '@/data/toonRTSAssets';
import { markCaptainReady } from '@/lib/playerProgression';

export const FLEET_CHARACTER_KEY = 'gruda_active_character';
export const TACTICAL_CAPTAIN_KEY = 'tethical_captain';
export const GAME_ERA = 'warlords' as const;

const API_BASE = '';

export interface FleetCharacter {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  gameEra?: string;
  activeForEra?: boolean;
  avatarUrl?: string | null;
  model3d?: Record<string, unknown>;
  attributes?: Record<string, number>;
}

export interface CaptainPersistInput {
  name: string;
  race: string;
  characterClass: string;
  hairColor?: string;
  build?: string;
  headModelUrl?: string;
  fallbackModelPath?: string;
  useFallbackModel?: boolean;
}

interface AuthResponse {
  token?: string;
  sessionToken?: string;
  grudgeId?: string;
  username?: string;
  user?: { grudgeId?: string; username?: string; displayName?: string };
}

// ── Token / device ───────────────────────────────────────────────────────────

export function getDeviceId(): string {
  let id = localStorage.getItem(LS_KEYS.DEVICE_ID);
  if (!id) {
    id = `ti_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LS_KEYS.DEVICE_ID, id);
  }
  return id;
}

export function getAuthToken(): string | null {
  return (
    localStorage.getItem(LS_KEYS.AUTH_TOKEN) ||
    localStorage.getItem(LS_KEYS.SESSION_TOKEN) ||
    localStorage.getItem(LS_KEYS.SYNC_TOKEN)
  );
}

function setAuthToken(token: string, meta?: { grudgeId?: string; username?: string }): void {
  localStorage.setItem(LS_KEYS.AUTH_TOKEN, token);
  localStorage.setItem(LS_KEYS.SESSION_TOKEN, token);
  if (meta?.grudgeId) localStorage.setItem(LS_KEYS.USER_ID, meta.grudgeId);
  if (meta?.username) localStorage.setItem(LS_KEYS.USERNAME, meta.username);
}

export function isFleetAuthenticated(): boolean {
  return !!getAuthToken();
}

function storeFleetCharacterId(id: string): void {
  localStorage.setItem(FLEET_CHARACTER_KEY, id);
}

export function getFleetCharacterId(): string | null {
  return localStorage.getItem(FLEET_CHARACTER_KEY);
}

// ── Race / class mapping ─────────────────────────────────────────────────────

const VALID_RACES = new Set(['human', 'barbarian', 'dwarf', 'elf', 'orc', 'undead']);

export function mapTacticalRaceToFleet(race: string): string {
  const r = race.toLowerCase();
  return VALID_RACES.has(r) ? r : 'human';
}

export function mapTacticalClassToFleet(classKey: string): string {
  const c = classKey.toLowerCase();
  if (c === 'worge' || c === 'worges' || c === 'worg') return 'worge';
  if (c === 'mage' || c === 'ranger' || c === 'warrior') return c;
  return 'warrior';
}

export function mapFleetClassToTactical(classId: string): ClassKey {
  const c = classId.toLowerCase();
  if (c === 'worge' || c === 'worges' || c === 'worg') return 'worge';
  if (c === 'mage') return 'mage';
  if (c === 'ranger') return 'ranger';
  return 'warrior';
}

// ── model3d payload (grudge6=true bypasses character-token gate) ─────────────

export function buildModel3dForCaptain(race: string, opts?: { headModelUrl?: string }): Record<string, unknown> {
  const raceId = mapTacticalRaceToFleet(race);
  const prefix = RACE_PREFIXES[raceId as Race]?.code ?? 'WK';
  return {
    grudge6: true,
    renderPipeline: 'grudge6',
    gameEra: GAME_ERA,
    baseModelId: `${prefix}_Characters_customizable`,
    equippedMeshes: {},
    weaponSlots: {},
    faceVariant: 'A',
    skinColor: '#ffffff',
    armorColor: '#ffffff',
    capeEnabled: false,
    scale: 1,
    sourceApp: 'tactical-infinity',
    ...(opts?.headModelUrl ? { headModelUrl: opts.headModelUrl } : {}),
  };
}

function defaultAttributes(): Record<string, number> {
  const base = 10;
  return {
    Strength: base,
    Vitality: base,
    Endurance: base,
    Intellect: base,
    Wisdom: base,
    Dexterity: base,
    Agility: base,
    Tactics: base,
  };
}

// ── Authenticated fetch ──────────────────────────────────────────────────────

async function fleetFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.auth !== false) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const ct = res.headers.get('content-type') || '';
    let data: T | null = null;
    if (ct.includes('application/json')) {
      data = (await res.json()) as T;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ── Auth bootstrap ───────────────────────────────────────────────────────────

async function handleAuthResponse(res: Response): Promise<boolean> {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || ct.includes('text/html')) return false;
  const data = (await res.json()) as AuthResponse;
  const token = data.sessionToken || data.token;
  if (!token) return false;
  setAuthToken(token, {
    grudgeId: data.grudgeId || data.user?.grudgeId,
    username: data.username || data.user?.displayName || data.user?.username,
  });
  window.dispatchEvent(new CustomEvent('grudge:auth:ready'));
  return true;
}

export async function bridgeGrudgeLaunchToken(launchToken: string): Promise<boolean> {
  const body = JSON.stringify({ token: launchToken, audience: window.location.origin });
  for (const path of [`${FLEET_API_PATHS.auth}/grudge-bridge`, `${FLEET_API_PATHS.auth}/session/exchange`]) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (await handleAuthResponse(res)) return true;
    } catch { /* try next */ }
  }
  return false;
}

function cleanSsoParams(keys: string[]): void {
  const params = new URLSearchParams(window.location.search);
  let changed = false;
  for (const k of keys) {
    if (params.has(k)) { params.delete(k); changed = true; }
  }
  if (!changed) return;
  const qs = params.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  window.history.replaceState(null, '', url);
}

/**
 * Consume fleet SSO return params.
 * Canonical return: id.grudge-studio.com → https://water.grudge-studio.com/auth/callback?sso_token=…
 * Previously skipped when on /auth/callback — that blocked login completion.
 */
export async function pickupSsoFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);

  const launchToken = params.get('grudge_token');
  if (launchToken) {
    const ok = await bridgeGrudgeLaunchToken(launchToken);
    if (ok) cleanSsoParams(['grudge_token']);
    return ok;
  }

  const ssoToken = params.get('sso_token') || params.get('token');
  if (ssoToken) {
    setAuthToken(ssoToken, {
      grudgeId: params.get('grudge_id') || params.get('grudgeId') || undefined,
      username: params.get('grudge_username') || params.get('username') || undefined,
    });
    cleanSsoParams(['sso_token', 'token', 'grudge_id', 'grudgeId', 'grudge_username', 'username', 'provider']);
    window.dispatchEvent(new CustomEvent('grudge:auth:ready'));
    return true;
  }

  return false;
}

export async function loginAsGuest(): Promise<boolean> {
  const res = await fetch(`${FLEET_API_PATHS.auth}/puter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      puterId: `guest_${getDeviceId()}`,
      displayName: 'Guest Captain',
    }),
  });
  return handleAuthResponse(res);
}

export async function ensureFleetAuth(): Promise<boolean> {
  if (isFleetAuthenticated()) return true;
  if (await pickupSsoFromUrl()) return true;
  return loginAsGuest();
}

// ── Local captain mirror ─────────────────────────────────────────────────────

export function mirrorCaptainLocally(
  input: CaptainPersistInput,
  fleetChar?: FleetCharacter | null,
): CaptainBuild {
  const race = mapTacticalRaceToFleet(input.race) as Race;
  const classKey = mapFleetClassToTactical(input.characterClass);
  const existing = loadCaptainBuild();
  const build: CaptainBuild = {
    race,
    classKey,
    weaponStyle: CLASS_TO_WEAPON_STYLE[classKey],
    archetypeId: CLASS_TO_ARCHETYPE[classKey],
    picks: existing?.picks ?? {},
    lockedAt: Date.now(),
    boatId: existing?.boatId,
  };
  saveCaptainBuild(build);
  try {
    localStorage.setItem(
      TACTICAL_CAPTAIN_KEY,
      JSON.stringify({
        name: input.name,
        race,
        characterClass: classKey,
        fleetCharacterId: fleetChar?.id ?? getFleetCharacterId(),
        hairColor: input.hairColor,
        build: input.build,
      }),
    );
  } catch { /* ignore */ }
  markCaptainReady();
  return build;
}

function hydrateCaptainFromFleet(char: FleetCharacter): void {
  const race = mapTacticalRaceToFleet(char.raceId) as Race;
  const classKey = mapFleetClassToTactical(char.classId);
  const existing = loadCaptainBuild();
  saveCaptainBuild({
    race,
    classKey,
    weaponStyle: CLASS_TO_WEAPON_STYLE[classKey],
    archetypeId: CLASS_TO_ARCHETYPE[classKey],
    picks: existing?.picks ?? {},
    lockedAt: existing?.lockedAt ?? Date.now(),
    boatId: existing?.boatId,
  });
  try {
    localStorage.setItem(
      TACTICAL_CAPTAIN_KEY,
      JSON.stringify({
        name: char.name,
        race,
        characterClass: classKey,
        fleetCharacterId: char.id,
      }),
    );
  } catch { /* ignore */ }
  storeFleetCharacterId(char.id);
  markCaptainReady();
}

// ── Fleet character API ──────────────────────────────────────────────────────

export async function listFleetCharacters(era = GAME_ERA): Promise<FleetCharacter[]> {
  const { ok, data } = await fleetFetch<FleetCharacter[] | { characters: FleetCharacter[] }>(
    `${FLEET_API_PATHS.characters}?era=${encodeURIComponent(era)}`,
  );
  if (!ok || !data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.characters) ? data.characters : [];
}

export async function activateFleetCharacter(id: string, era = GAME_ERA): Promise<boolean> {
  const { ok } = await fleetFetch(`${FLEET_API_PATHS.characters}/${id}/activate`, {
    method: 'PUT',
    body: JSON.stringify({ gameEra: era }),
  });
  return ok;
}

export async function persistCaptainToFleet(input: CaptainPersistInput): Promise<FleetCharacter | null> {
  const authed = await ensureFleetAuth();
  if (!authed) {
    mirrorCaptainLocally(input, null);
    return null;
  }

  const raceId = mapTacticalRaceToFleet(input.race);
  const classId = mapTacticalClassToFleet(input.characterClass);

  const body = {
    name: input.name.trim(),
    raceId,
    classId,
    gameEra: GAME_ERA,
    gameOrigin: 'tactical-infinity',
    skipStartingGear: true,
    skipAvatarGeneration: !!input.headModelUrl,
    attributes: defaultAttributes(),
    model3d: buildModel3dForCaptain(raceId, { headModelUrl: input.headModelUrl }),
  };

  const { ok, status, data } = await fleetFetch<FleetCharacter>(FLEET_API_PATHS.characters, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!ok || !data?.id) {
    console.warn('[grudgeCharacterSync] POST /api/characters failed', status, data);
    mirrorCaptainLocally(input, null);
    return null;
  }

  await activateFleetCharacter(data.id);
  storeFleetCharacterId(data.id);
  mirrorCaptainLocally(input, data);
  return data;
}

/** Sync captain build from ClassTree (no name) — uses stored name or guest label. */
export async function persistCaptainBuildToFleet(build: CaptainBuild, name?: string): Promise<FleetCharacter | null> {
  let captainName = name?.trim();
  if (!captainName) {
    try {
      const saved = JSON.parse(localStorage.getItem(TACTICAL_CAPTAIN_KEY) || '{}');
      captainName = saved.name;
    } catch { /* ignore */ }
  }
  if (!captainName) {
    captainName = localStorage.getItem(LS_KEYS.USERNAME) || 'Guest Captain';
  }
  return persistCaptainToFleet({
    name: captainName,
    race: build.race,
    characterClass: build.classKey,
  });
}

export async function hydrateFromFleet(): Promise<FleetCharacter | null> {
  const authed = await ensureFleetAuth();
  if (!authed) return null;

  const chars = await listFleetCharacters(GAME_ERA);
  if (!chars.length) return null;

  const storedId = getFleetCharacterId();
  let active =
    (storedId ? chars.find((c) => c.id === storedId) : null) ??
    chars.find((c) => c.activeForEra) ??
    chars[0];

  if (!active) return null;

  if (!active.activeForEra) await activateFleetCharacter(active.id);
  storeFleetCharacterId(active.id);
  hydrateCaptainFromFleet(active);
  return active;
}

/** Auth pickup + fleet character hydrate — call once on app boot. */
export async function bootstrapFleetSession(): Promise<FleetCharacter | null> {
  await pickupSsoFromUrl();
  if (!isFleetAuthenticated()) await loginAsGuest();
  return hydrateFromFleet();
}