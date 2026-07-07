import type { BoatId } from '@shared/gameDefinitions/boatRegistry';
import { BOAT_IDS, getBoat } from '@shared/gameDefinitions/boatRegistry';
import { SHIP_TIERS, type ShipTierId } from '@shared/gameDefinitions/shipTiers';
import { loadCaptainBuild, saveCaptainBuild } from '@/lib/captainBuild';
import { getFleetCharacterId, TACTICAL_CAPTAIN_KEY } from '@/lib/grudgeCharacterSync';

const STORAGE_KEY = 'gw-player-progression';

/** Ordered build ladder — raft MUST be built before any other boat. */
export const BOAT_BUILD_ORDER: readonly BoatId[] = BOAT_IDS;

export type OnboardingStep = 'needs_captain' | 'needs_raft' | 'ready';

export interface PlayerProgression {
  /** Captain creation complete. */
  captainReady: boolean;
  /** First sailed raft built on home island. */
  raftBuilt: boolean;
  /** Canonical boats the player has constructed (always includes raft when ready). */
  builtBoats: BoatId[];
  /** Active hull for world-map sailing. */
  activeBoatId: BoatId | null;
  /** Home island tutorial harvest mission finished. */
  homeIslandTutorialDone: boolean;
}

const DEFAULT: PlayerProgression = {
  captainReady: false,
  raftBuilt: false,
  builtBoats: [],
  activeBoatId: null,
  homeIslandTutorialDone: false,
};

function normalizeBoats(boats: string[] | undefined): BoatId[] {
  if (!boats?.length) return [];
  return boats.filter((id): id is BoatId => (BOAT_IDS as readonly string[]).includes(id));
}

export function loadProgression(): PlayerProgression {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT, captainReady: !!loadCaptainBuild() };
    const parsed = JSON.parse(raw) as Partial<PlayerProgression>;
    const builtBoats = normalizeBoats(parsed.builtBoats as string[]);
    const raftBuilt = parsed.raftBuilt ?? builtBoats.includes('raft');
    const captainReady = parsed.captainReady ?? !!loadCaptainBuild();
    return {
      captainReady,
      raftBuilt,
      builtBoats: raftBuilt && !builtBoats.includes('raft') ? ['raft', ...builtBoats] : builtBoats,
      activeBoatId: (parsed.activeBoatId as BoatId) ?? (raftBuilt ? 'raft' : null),
      homeIslandTutorialDone: parsed.homeIslandTutorialDone ?? raftBuilt,
    };
  } catch {
    return { ...DEFAULT, captainReady: !!loadCaptainBuild() };
  }
}

export function saveProgression(p: PlayerProgression): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}

function hasCaptainLocally(): boolean {
  if (loadCaptainBuild()) return true;
  if (getFleetCharacterId()) return true;
  try {
    return !!localStorage.getItem(TACTICAL_CAPTAIN_KEY);
  } catch {
    return false;
  }
}

export function getOnboardingStep(): OnboardingStep {
  const p = loadProgression();
  const captainDone = p.captainReady || hasCaptainLocally();
  if (!captainDone) return 'needs_captain';
  if (!p.raftBuilt) return 'needs_raft';
  return 'ready';
}

export function markCaptainReady(): void {
  const p = loadProgression();
  p.captainReady = true;
  saveProgression(p);
}

/** Called when the player completes the home-island raft build. */
export function markRaftBuilt(): void {
  const p = loadProgression();
  p.captainReady = true;
  p.raftBuilt = true;
  p.homeIslandTutorialDone = true;
  if (!p.builtBoats.includes('raft')) p.builtBoats = ['raft', ...p.builtBoats];
  p.activeBoatId = 'raft';
  saveProgression(p);

  const build = loadCaptainBuild();
  if (build) saveCaptainBuild({ ...build, boatId: 'raft' });
}

export function isRaftBuilt(): boolean {
  return loadProgression().raftBuilt;
}

export function canSailWorldMap(): boolean {
  return loadProgression().raftBuilt;
}

export function canBuildBoat(boatId: BoatId): boolean {
  const p = loadProgression();
  if (p.builtBoats.includes(boatId)) return false;
  const idx = BOAT_BUILD_ORDER.indexOf(boatId);
  if (idx <= 0) return boatId === 'raft' && !p.raftBuilt;
  const prev = BOAT_BUILD_ORDER[idx - 1];
  return p.builtBoats.includes(prev);
}

export function getNextBuildableBoat(): BoatId | null {
  for (const id of BOAT_BUILD_ORDER) {
    if (canBuildBoat(id)) return id;
  }
  return null;
}

export function getBuildCostForBoat(boatId: BoatId): readonly { material: string; qty: number }[] {
  const tierMap: Record<BoatId, ShipTierId> = {
    raft: 'raft',
    skiff: 'dinghy',
    sloop: 'sloop',
    brigantine: 'brigantine',
    galleon: 'galleon',
  };
  return SHIP_TIERS[tierMap[boatId]]?.buildCost ?? getBoat(boatId).stats.buildMaterials.map((m) => ({
    material: m.material,
    qty: m.quantity,
  }));
}

export function resolveActiveBoatId(): BoatId {
  const p = loadProgression();
  if (p.activeBoatId && p.builtBoats.includes(p.activeBoatId)) return p.activeBoatId;
  if (p.raftBuilt) return 'raft';
  return 'raft';
}