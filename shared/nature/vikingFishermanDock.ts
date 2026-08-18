/**
 * Viking Fisherman House — island dock / town prefab for neutral NPCs.
 *
 * Binary: models/buildings/docks/viking_fisherman_house.glb
 * CDN:    https://assets.grudge-studio.com/models/buildings/docks/viking_fisherman_house.glb
 *
 * Source is a Maya village export (DAE_Villages) with generic mesh names.
 * We treat the whole pack as one **compound prefab** and annotate semantic
 * roles + a walkable nav graph for neutral NPC pathfinding (dock patrol,
 * house ↔ boat berth, fish rack work).
 *
 * Pathfinding is a pure waypoint graph (no THREE) so it runs in vitest and
 * on the server; engines sample mesh floors separately for height.
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

export const VIKING_FISHERMAN_PACK = {
  key: "viking_fisherman_house",
  r2Key: "models/buildings/docks/viking_fisherman_house.glb",
  cdn: `${WARLORDS_CDN}/models/buildings/docks/viking_fisherman_house.glb`,
  local: "/models/buildings/docks/viking_fisherman_house.glb",
  rootGroup: "DAE_Villages",
  /** Whole compound height when placed as town dock landmark */
  targetHeightM: 8,
  roles: ["dock", "town", "npc", "neutral", "boat", "island", "prefab"],
} as const;

/**
 * Semantic mesh roles — isolate by group name under DAE_Villages.
 * Classification is by Maya primitive family (planes = deck/path, cylinders =
 * piles, large polySurfaces = house shell). Refine after visual pass in editor.
 */
export type VikingDockPartRole =
  | "house"
  | "dock_deck"
  | "dock_pile"
  | "boat"
  | "prop"
  | "path"
  | "fish_rack"
  | "roof"
  | "unknown";

export interface VikingDockPart {
  /** Group node name (parent of *_TEXTURE_0 mesh) */
  meshName: string;
  role: VikingDockPartRole;
  /** Optional human label for prefab UI */
  label?: string;
  /** Prefer for walkable sampling */
  walkable?: boolean;
}

/** Curated isolations for prefab palette + NPC systems. */
export const VIKING_DOCK_PARTS: VikingDockPart[] = [
  // Walkable planes — dock deck / ground / path
  { meshName: "pPlane1", role: "path", label: "Ground path A", walkable: true },
  { meshName: "pPlane2", role: "path", label: "Ground path B", walkable: true },
  { meshName: "pPlane64", role: "dock_deck", label: "Dock deck", walkable: true },
  { meshName: "pPlane76", role: "dock_deck", label: "Pier planks", walkable: true },
  { meshName: "pPlane97", role: "path", label: "Yard path", walkable: true },
  { meshName: "pPlane100", role: "dock_deck", label: "Dock edge", walkable: true },
  { meshName: "pPlane104", role: "dock_deck", label: "Main pier", walkable: true },
  { meshName: "pPlane128", role: "path", label: "Approach path", walkable: true },
  // Piles / posts
  { meshName: "pCylinder54", role: "dock_pile", label: "Dock pile A" },
  { meshName: "pCylinder55", role: "dock_pile", label: "Dock pile B" },
  { meshName: "pCylinder56", role: "dock_pile", label: "Dock pile C" },
  { meshName: "pCylinder44", role: "dock_pile", label: "Dock pile D" },
  { meshName: "pCylinder122", role: "dock_pile", label: "Dock pile E" },
  // House shell clusters (largest polySurfaces — fishing house)
  { meshName: "polySurface1346", role: "house", label: "House body A" },
  { meshName: "polySurface1363", role: "house", label: "House body B" },
  { meshName: "polySurface1329", role: "house", label: "House wall" },
  { meshName: "polySurface1330", role: "house", label: "House wall B" },
  { meshName: "polySurface1333", role: "roof", label: "Roof A" },
  { meshName: "polySurface5562", role: "house", label: "House annex" },
  // Boat-like elongated hull candidates (refine in scene)
  { meshName: "polySurface5508", role: "boat", label: "Boat hull A" },
  { meshName: "polySurface5520", role: "boat", label: "Boat hull B" },
  { meshName: "polySurface5484", role: "boat", label: "Boat hull C" },
  { meshName: "polySurface5521", role: "boat", label: "Boat detail" },
  // Fish rack / hanging props
  { meshName: "polySurface4870", role: "fish_rack", label: "Fish rack A" },
  { meshName: "polySurface4892", role: "fish_rack", label: "Fish rack B" },
  { meshName: "polySurface4868", role: "fish_rack", label: "Fish rack C" },
  // Generic props
  { meshName: "pCube214", role: "prop", label: "Crate A" },
  { meshName: "pCube215", role: "prop", label: "Crate B" },
  { meshName: "pCube216", role: "prop", label: "Crate C" },
  { meshName: "pSphere6", role: "prop", label: "Barrel A" },
  { meshName: "pSphere8", role: "prop", label: "Barrel B" },
];

export function partsByRole(role: VikingDockPartRole): VikingDockPart[] {
  return VIKING_DOCK_PARTS.filter((p) => p.role === role);
}

export function walkableParts(): VikingDockPart[] {
  return VIKING_DOCK_PARTS.filter((p) => p.walkable);
}

// ── Neutral NPC pathfinding graph (local meters, origin = prefab pivot) ────

export type DockNavNodeId =
  | "spawn_yard"
  | "house_door"
  | "house_interior"
  | "fish_rack"
  | "dock_mid"
  | "dock_end"
  | "boat_berth"
  | "lookout";

export interface DockNavNode {
  id: DockNavNodeId;
  /** Local position relative to prefab origin (Y = walk height) */
  pos: { x: number; y: number; z: number };
  /** What neutrals do when idle here */
  activity: "idle" | "work" | "board_boat" | "patrol" | "enter_house" | "fish";
  label: string;
}

/**
 * Authored walk graph for the viking dock compound.
 * Coordinates assume prefab facing +Z toward water, house inland (−Z).
 * Scale to match targetHeightM after load if the engine rescales the GLB.
 */
export const DOCK_NAV_NODES: DockNavNode[] = [
  {
    id: "spawn_yard",
    pos: { x: 0, y: 0.1, z: -4 },
    activity: "idle",
    label: "Yard spawn",
  },
  {
    id: "house_door",
    pos: { x: 0.5, y: 0.15, z: -1.5 },
    activity: "enter_house",
    label: "House door",
  },
  {
    id: "house_interior",
    pos: { x: 0, y: 0.2, z: 0.2 },
    activity: "idle",
    label: "Inside house",
  },
  {
    id: "fish_rack",
    pos: { x: -2.5, y: 0.15, z: -2 },
    activity: "work",
    label: "Fish rack",
  },
  {
    id: "dock_mid",
    pos: { x: 0, y: 0.12, z: 3 },
    activity: "patrol",
    label: "Dock mid",
  },
  {
    id: "dock_end",
    pos: { x: 0.2, y: 0.1, z: 6.5 },
    activity: "fish",
    label: "Dock end / cast line",
  },
  {
    id: "boat_berth",
    pos: { x: 2.2, y: 0.05, z: 5.5 },
    activity: "board_boat",
    label: "Boat berth",
  },
  {
    id: "lookout",
    pos: { x: -1.8, y: 0.15, z: 4 },
    activity: "patrol",
    label: "Lookout pile",
  },
];

/** Undirected edges (walk connections). */
export const DOCK_NAV_EDGES: [DockNavNodeId, DockNavNodeId][] = [
  ["spawn_yard", "house_door"],
  ["house_door", "house_interior"],
  ["spawn_yard", "fish_rack"],
  ["spawn_yard", "dock_mid"],
  ["fish_rack", "dock_mid"],
  ["house_door", "dock_mid"],
  ["dock_mid", "dock_end"],
  ["dock_mid", "boat_berth"],
  ["dock_end", "boat_berth"],
  ["dock_mid", "lookout"],
  ["lookout", "dock_end"],
];

export interface DockPathResult {
  nodes: DockNavNodeId[];
  points: { x: number; y: number; z: number }[];
  lengthM: number;
}

function nodeMap(): Map<DockNavNodeId, DockNavNode> {
  return new Map(DOCK_NAV_NODES.map((n) => [n.id, n]));
}

function neighbors(id: DockNavNodeId): DockNavNodeId[] {
  const out: DockNavNodeId[] = [];
  for (const [a, b] of DOCK_NAV_EDGES) {
    if (a === id) out.push(b);
    if (b === id) out.push(a);
  }
  return out;
}

function dist(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

/**
 * A* path for neutral NPCs on the viking dock graph.
 * Returns world-local points (still in prefab space). Apply prefab
 * world matrix when steering.
 */
export function pathfindDock(
  from: DockNavNodeId,
  to: DockNavNodeId,
): DockPathResult | null {
  if (from === to) {
    const n = nodeMap().get(from)!;
    return { nodes: [from], points: [{ ...n.pos }], lengthM: 0 };
  }
  const nodes = nodeMap();
  if (!nodes.has(from) || !nodes.has(to)) return null;

  const open = new Set<DockNavNodeId>([from]);
  const came = new Map<DockNavNodeId, DockNavNodeId>();
  const gScore = new Map<DockNavNodeId, number>([[from, 0]]);
  const fScore = new Map<DockNavNodeId, number>([
    [from, dist(nodes.get(from)!.pos, nodes.get(to)!.pos)],
  ]);

  while (open.size) {
    let current: DockNavNodeId | null = null;
    let best = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < best) {
        best = f;
        current = id;
      }
    }
    if (!current) break;
    if (current === to) {
      const path: DockNavNodeId[] = [current];
      while (came.has(current)) {
        current = came.get(current)!;
        path.unshift(current);
      }
      const points = path.map((id) => ({ ...nodes.get(id)!.pos }));
      let lengthM = 0;
      for (let i = 1; i < points.length; i++) {
        lengthM += dist(points[i - 1]!, points[i]!);
      }
      return { nodes: path, points, lengthM };
    }
    open.delete(current);
    const gCur = gScore.get(current) ?? Infinity;
    for (const nb of neighbors(current)) {
      const tentative =
        gCur + dist(nodes.get(current)!.pos, nodes.get(nb)!.pos);
      if (tentative < (gScore.get(nb) ?? Infinity)) {
        came.set(nb, current);
        gScore.set(nb, tentative);
        fScore.set(
          nb,
          tentative + dist(nodes.get(nb)!.pos, nodes.get(to)!.pos),
        );
        open.add(nb);
      }
    }
  }
  return null;
}

/** Transform local dock point into world given prefab pose. */
export function dockLocalToWorld(
  local: { x: number; y: number; z: number },
  origin: { x: number; y: number; z: number },
  yaw = 0,
  scale = 1,
): { x: number; y: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = local.x * scale;
  const z = local.z * scale;
  return {
    x: origin.x + x * c - z * s,
    y: origin.y + local.y * scale,
    z: origin.z + x * s + z * c,
  };
}

/** Patrol loop used by neutral fishers / dock workers. */
export const NEUTRAL_DOCK_PATROL: DockNavNodeId[] = [
  "spawn_yard",
  "fish_rack",
  "dock_mid",
  "dock_end",
  "boat_berth",
  "dock_mid",
  "house_door",
  "spawn_yard",
];

/**
 * Expand patrol into a continuous world path (local points).
 */
export function neutralDockPatrolPath(): DockPathResult {
  const points: { x: number; y: number; z: number }[] = [];
  const nodes: DockNavNodeId[] = [];
  let lengthM = 0;
  for (let i = 0; i < NEUTRAL_DOCK_PATROL.length - 1; i++) {
    const seg = pathfindDock(NEUTRAL_DOCK_PATROL[i]!, NEUTRAL_DOCK_PATROL[i + 1]!);
    if (!seg) continue;
    const start = i === 0 ? 0 : 1; // skip duplicate join
    for (let j = start; j < seg.nodes.length; j++) {
      nodes.push(seg.nodes[j]!);
      points.push(seg.points[j]!);
    }
    lengthM += seg.lengthM;
  }
  return { nodes, points, lengthM };
}

/** Prefab catalog entry for town builders / map templates. */
export const VIKING_DOCK_PREFAB = {
  id: "prefab.viking_fisherman_dock",
  name: "Viking Fisherman Dock",
  description:
    "Fisherman house + pier for island towns. Neutral NPCs path yard → rack → dock → boat.",
  pack: VIKING_FISHERMAN_PACK,
  parts: VIKING_DOCK_PARTS,
  nav: {
    nodes: DOCK_NAV_NODES,
    edges: DOCK_NAV_EDGES,
    patrol: NEUTRAL_DOCK_PATROL,
  },
  boats: partsByRole("boat").map((p) => p.meshName),
  buildingId: "bld.viking_fisherman_dock",
} as const;
