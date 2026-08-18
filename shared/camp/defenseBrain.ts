/**
 * Defense AI brain — pure logic for camp turrets + assigned defenders.
 * Used by TI islandDefenseSystem and RTS-Grudge ally defend assignment.
 */
import type { AllyBehavior, ClaimFlagState, DefenseBrainConfig, TurretProfile } from "./types";

export const DEFAULT_DEFENSE_BRAIN: DefenseBrainConfig = {
  preferClaimThreats: true,
  workerFleeHp: 0.35,
  holdRangeMult: 1.25,
  autoGarrison: true,
};

export const TURRET_PROFILES: Record<string, TurretProfile> = {
  shore_cannon: {
    id: "shore_cannon",
    name: "Shore Cannon",
    range: 120,
    fireRate: 0.2,
    damage: 30,
    projectileSpeed: 55,
    rotationSpeed: 25,
    warmupTime: 0.8,
    burstCount: 1,
    leadTarget: true,
  },
  watchtower_bow: {
    id: "watchtower_bow",
    name: "Watchtower Bow",
    range: 80,
    fireRate: 1.0,
    damage: 8,
    projectileSpeed: 45,
    rotationSpeed: 90,
    warmupTime: 0.3,
    burstCount: 3,
    leadTarget: true,
  },
  fire_catapult: {
    id: "fire_catapult",
    name: "Fire Catapult",
    range: 100,
    fireRate: 0.12,
    damage: 18,
    projectileSpeed: 35,
    rotationSpeed: 15,
    warmupTime: 1.5,
    burstCount: 1,
    leadTarget: true,
  },
  guard_tower: {
    id: "guard_tower",
    name: "Guard Tower",
    range: 70,
    fireRate: 0.8,
    damage: 12,
    projectileSpeed: 40,
    rotationSpeed: 60,
    warmupTime: 0.4,
    burstCount: 2,
    leadTarget: true,
  },
};

export interface ThreatSample {
  id: string;
  x: number;
  z: number;
  hpFrac: number;
  isHostile: boolean;
}

export interface DefenderSample {
  id: string;
  x: number;
  z: number;
  role: "worker" | "military";
  hpFrac: number;
  behavior: AllyBehavior;
  assignedBuildingId?: string;
}

/** Score threats for a turret at (tx,tz) with range. Higher = better target. */
export function scoreThreatForTurret(
  tx: number,
  tz: number,
  range: number,
  threat: ThreatSample,
  claim: ClaimFlagState | null,
  cfg: DefenseBrainConfig = DEFAULT_DEFENSE_BRAIN,
): number {
  if (!threat.isHostile) return -Infinity;
  const dist = Math.hypot(threat.x - tx, threat.z - tz);
  if (dist > range) return -Infinity;
  let score = (range - dist) / range;
  // Prefer lower HP (finish kills)
  score += (1 - threat.hpFrac) * 0.25;
  if (cfg.preferClaimThreats && claim) {
    const inClaim =
      Math.hypot(threat.x - claim.pos.x, threat.z - claim.pos.z) <= claim.radiusM;
    if (inClaim) score += 0.5;
  }
  return score;
}

export function pickBestThreat(
  tx: number,
  tz: number,
  range: number,
  threats: ThreatSample[],
  claim: ClaimFlagState | null,
  cfg?: DefenseBrainConfig,
): ThreatSample | null {
  let best: ThreatSample | null = null;
  let bestScore = -Infinity;
  for (const t of threats) {
    const s = scoreThreatForTurret(tx, tz, range, t, claim, cfg);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return bestScore > -Infinity ? best : null;
}

/**
 * Decide defender behavior each tick.
 * Workers harvest until threatened; military hold defend near claim/towers.
 */
export function tickDefenderBehavior(
  unit: DefenderSample,
  threats: ThreatSample[],
  claim: ClaimFlagState | null,
  cfg: DefenseBrainConfig = DEFAULT_DEFENSE_BRAIN,
): AllyBehavior {
  const nearThreat = threats.find((t) => {
    if (!t.isHostile) return false;
    const d = Math.hypot(t.x - unit.x, t.z - unit.z);
    return d < 18;
  });

  if (unit.role === "worker") {
    if (unit.hpFrac < cfg.workerFleeHp || nearThreat) {
      return "return_to_camp";
    }
    if (unit.behavior === "craft") return "craft";
    return "harvest";
  }

  // military
  if (nearThreat) return "combat";
  if (unit.assignedBuildingId) return "defend";
  if (cfg.autoGarrison) return "defend";
  return unit.behavior === "patrol" ? "patrol" : "idle";
}

/** Lead aim point for projectile (simple constant-velocity lead). */
export function leadTargetPoint(
  from: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  targetVel: { x: number; z: number },
  projectileSpeed: number,
): { x: number; y: number; z: number } {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dist = Math.hypot(dx, dz);
  const t = projectileSpeed > 0.01 ? dist / projectileSpeed : 0;
  return {
    x: target.x + targetVel.x * t,
    y: target.y,
    z: target.z + targetVel.z * t,
  };
}

/** Point inside claim build radius? */
export function inClaimBuildRadius(
  claim: ClaimFlagState | null,
  x: number,
  z: number,
): boolean {
  if (!claim || !claim.buildRights) return false;
  return Math.hypot(x - claim.pos.x, z - claim.pos.z) <= claim.radiusM;
}
