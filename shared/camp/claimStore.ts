/**
 * Claim flag runtime state — pure store (no React).
 * Mirror to localStorage; optional Railway push via persistClaimToApi.
 */
import type { ClaimFlagState } from "./types";
import { inClaimBuildRadius } from "./defenseBrain";
import { getBuilding } from "./masterBuildings";

const STORAGE_KEY = "grudge_camp_claim_v1";

let claim: ClaimFlagState | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function subscribeClaim(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getClaim(): ClaimFlagState | null {
  return claim;
}

export function loadClaimFromStorage(): ClaimFlagState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    claim = JSON.parse(raw) as ClaimFlagState;
    notify();
    return claim;
  } catch {
    return null;
  }
}

export function saveClaimToStorage(c: ClaimFlagState | null): void {
  try {
    if (!c) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* private mode */
  }
}

export function plantClaimFlag(opts: {
  ownerAccountId: string;
  islandId: string;
  x: number;
  y: number;
  z: number;
  radiusM?: number;
}): ClaimFlagState {
  claim = {
    claimId: `claim_${Date.now().toString(36)}`,
    ownerAccountId: opts.ownerAccountId,
    islandId: opts.islandId,
    pos: { x: opts.x, y: opts.y, z: opts.z },
    radiusM: opts.radiusM ?? 48,
    buildRights: true,
    skills: {
      logistics: 1,
      fortify: 1,
      muster: 1,
      husbandry: 1,
      drill: 1,
    },
    placedBuildingIds: [],
    rosterUnitIds: [],
  };
  saveClaimToStorage(claim);
  notify();
  return claim;
}

export function clearClaim(): void {
  claim = null;
  saveClaimToStorage(null);
  notify();
}

export function registerPlacedOnClaim(buildingInstanceId: string): void {
  if (!claim) return;
  if (!claim.placedBuildingIds.includes(buildingInstanceId)) {
    claim = {
      ...claim,
      placedBuildingIds: [...claim.placedBuildingIds, buildingInstanceId],
    };
    saveClaimToStorage(claim);
    notify();
  }
}

/**
 * Ghost / place validity for claim-gated buildings.
 * Returns { ok, reason }.
 */
export function validateBuildAt(
  buildingIdOrAlias: string,
  x: number,
  z: number,
): { ok: boolean; reason?: string; inClaim: boolean } {
  const def = getBuilding(buildingIdOrAlias);
  const c = claim;
  const inClaim = inClaimBuildRadius(c, x, z);

  if (!def) {
    // unknown legacy — allow if no claim gate enforced yet, or inside claim
    if (!c) return { ok: true, inClaim: false };
    return inClaim
      ? { ok: true, inClaim: true }
      : { ok: false, reason: "Outside claim radius", inClaim: false };
  }

  if (def.fieldQuickCraft || !def.claimGated) {
    return { ok: true, inClaim };
  }

  if (!c) {
    return {
      ok: false,
      reason: "Plant a Claim Flag first",
      inClaim: false,
    };
  }
  if (!c.buildRights) {
    return { ok: false, reason: "No build rights on this claim", inClaim };
  }
  if (!inClaim) {
    return { ok: false, reason: "Outside claim radius", inClaim: false };
  }
  return { ok: true, inClaim: true };
}

/** Railway-shaped payload (POST /api/island/claim). */
export function claimToApiPayload(c: ClaimFlagState) {
  return {
    claimId: c.claimId,
    ownerAccountId: c.ownerAccountId,
    islandId: c.islandId,
    position: c.pos,
    radiusM: c.radiusM,
    buildRights: c.buildRights,
    skills: c.skills,
    placedBuildingIds: c.placedBuildingIds,
    rosterUnitIds: c.rosterUnitIds,
    schemaVersion: 1,
  };
}

/**
 * Persist claim to Railway when token present.
 * Base URL from env or default production API.
 */
export async function persistClaimToApi(
  token: string | null,
  apiBase = "https://grudge-api-production-0d46.up.railway.app",
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!claim) return { ok: false, error: "no_claim" };
  if (!token) {
    saveClaimToStorage(claim);
    return { ok: true, status: 0 }; // local only
  }
  try {
    const r = await fetch(`${apiBase.replace(/\/$/, "")}/api/island/claim`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(claimToApiPayload(claim)),
    });
    if (!r.ok) {
      // Endpoint may not exist yet — still keep local
      saveClaimToStorage(claim);
      return { ok: false, status: r.status, error: await r.text() };
    }
    saveClaimToStorage(claim);
    return { ok: true, status: r.status };
  } catch (e) {
    saveClaimToStorage(claim);
    return { ok: false, error: String(e) };
  }
}

export async function persistProductionJobsToApi(
  jobs: unknown[],
  token: string | null,
  apiBase = "https://grudge-api-production-0d46.up.railway.app",
): Promise<{ ok: boolean }> {
  try {
    localStorage.setItem("grudge_camp_jobs_v1", JSON.stringify(jobs));
  } catch {
    /* */
  }
  if (!token) return { ok: true };
  try {
    const r = await fetch(
      `${apiBase.replace(/\/$/, "")}/api/island/production`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobs, schemaVersion: 1 }),
      },
    );
    return { ok: r.ok };
  } catch {
    return { ok: false };
  }
}
