import { describe, expect, it } from "vitest";
import {
  pathfindDock,
  neutralDockPatrolPath,
  dockLocalToWorld,
  partsByRole,
  walkableParts,
  VIKING_DOCK_PREFAB,
} from "./vikingFishermanDock";

describe("viking fisherman dock", () => {
  it("has walkable deck parts and boat isolations", () => {
    expect(walkableParts().length).toBeGreaterThan(3);
    expect(partsByRole("boat").length).toBeGreaterThan(0);
    expect(partsByRole("house").length).toBeGreaterThan(0);
    expect(VIKING_DOCK_PREFAB.buildingId).toBe("bld.viking_fisherman_dock");
  });

  it("pathfinds yard to boat berth", () => {
    const path = pathfindDock("spawn_yard", "boat_berth");
    expect(path).not.toBeNull();
    expect(path!.nodes[0]).toBe("spawn_yard");
    expect(path!.nodes[path!.nodes.length - 1]).toBe("boat_berth");
    expect(path!.lengthM).toBeGreaterThan(1);
  });

  it("builds neutral patrol loop", () => {
    const loop = neutralDockPatrolPath();
    expect(loop.points.length).toBeGreaterThan(4);
    expect(loop.lengthM).toBeGreaterThan(5);
  });

  it("transforms local dock points to world", () => {
    const w = dockLocalToWorld({ x: 1, y: 0, z: 0 }, { x: 10, y: 2, z: 5 }, 0, 1);
    expect(w.x).toBeCloseTo(11);
    expect(w.z).toBeCloseTo(5);
    expect(w.y).toBeCloseTo(2);
  });
});
