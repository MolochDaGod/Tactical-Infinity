import type { OnboardingStep } from '@/lib/playerProgression';
import { getOnboardingStep, markCaptainReady } from '@/lib/playerProgression';
import { loadCaptainBuild } from '@/lib/captainBuild';
import { getFleetCharacterId, TACTICAL_CAPTAIN_KEY } from '@/lib/grudgeCharacterSync';

/**
 * Play island load is a query on ProductionIsland — not a `?file=` GLB dump.
 *
 *   /island?entry=dock     chicken-gun Fruzer kit (home dock, default)
 *   /island?entry=beach    same page, spawn offset toward the beach
 *   /island?entry=arctic   dwarfislands.glb + tundra paint
 *   /island?entry=dwarf    dwarfislands.glb + dwarf-zone paint
 *   /island?entry=workshop still this page (BoatDockWorkshop is its own route)
 *   /island?physicsDebug=1 Rapier collider outlines (existing RapierHelper)
 *
 * Definition UUIDs: fleetMeshUuid / stampWorldLocation. Not player grudge_uuid.
 */
export type IslandEntry = 'dock' | 'beach' | 'workshop' | 'arctic' | 'dwarf';

export function readIslandEntry(): IslandEntry {
  try {
    const q = new URLSearchParams(window.location.search);
    const e = (q.get('entry') || '').toLowerCase();
    if (e === 'beach' || e === 'workshop' || e === 'dock' || e === 'arctic' || e === 'dwarf') return e;
  } catch { /* ignore */ }
  return 'dock';
}

export type GamePhase =
  | 'menu'
  | 'captain'
  | 'intro'
  | 'productionisland'
  | 'worldmap'
  | 'beachSpawn';

/** Resolve the next gameplay phase for the primary Play / Continue action. */
export function resolvePlayPhase(): GamePhase {
  const step = getOnboardingStep();
  switch (step) {
    case 'needs_captain':
      return 'captain';
    case 'needs_raft':
      return 'productionisland';
    case 'ready':
      return 'worldmap';
    default:
      return 'menu';
  }
}

export function getPlayButtonLabel(step: OnboardingStep = getOnboardingStep()): string {
  switch (step) {
    case 'needs_captain':
      return 'Create Captain';
    case 'needs_raft':
      return 'Home Island — Build Your Raft';
    case 'ready':
      return 'Set Sail — World Map';
    default:
      return 'Play';
  }
}

export function getPlayButtonHint(step: OnboardingStep = getOnboardingStep()): string {
  switch (step) {
    case 'needs_captain':
      return 'Choose race, class, and gear before landing on Waterfall Isle.';
    case 'needs_raft':
      return 'Harvest wood, hemp, and stone on your home island to build your first sailed raft.';
    case 'ready':
      return 'Your raft is ready — explore Aethermoor with wind-driven sailing and combat.';
    default:
      return '';
  }
}

/** True when a captain exists locally or on the fleet roster. */
export function hasCaptainProfile(): boolean {
  if (loadCaptainBuild()) return true;
  if (getFleetCharacterId()) return true;
  try {
    return !!localStorage.getItem(TACTICAL_CAPTAIN_KEY);
  } catch {
    return false;
  }
}

/** Call after captain creation locks in. */
export function onCaptainCreated(): GamePhase {
  if (hasCaptainProfile()) markCaptainReady();
  return 'productionisland';
}