import { describe, expect, it } from "vitest";
import {
  getBuilding,
  buildingsForTab,
  canAfford,
  spendCost,
  getUnit,
  unitsTrainedAt,
  recipesForBuilding,
  enqueueUnitJob,
  tickProduction,
  pickBestThreat,
  tickDefenderBehavior,
  inClaimBuildRadius,
  buildingPaletteRows,
} from "./index";

describe("master buildings", () => {
  it("resolves aliases", () => {
    expect(getBuilding("rts_barracks")?.id).toBe("bld.barracks.crusade.first.l1");
    expect(getBuilding("campfire")?.fieldQuickCraft).toBe(true);
    expect(getBuilding("bld.claim_flag")?.functions[0]?.kind).toBe("claim_anchor");
  });

  it("groups by UI tab", () => {
    expect(buildingsForTab("defense").length).toBeGreaterThan(0);
    expect(buildingsForTab("military").some((b) => b.id.includes("barracks"))).toBe(
      true,
    );
  });

  it("spend cost", () => {
    const bag = { wood: 100, stone: 50, gold: 20 };
    const next = spendCost({ wood: 30, stone: 10, gold: 5 }, bag);
    expect(next?.wood).toBe(70);
    expect(canAfford({ wood: 200 }, bag)).toBe(false);
  });
});

describe("units + production", () => {
  it("trains from barracks", () => {
    const list = unitsTrainedAt("bld.barracks.crusade.first.l1");
    expect(list.map((u) => u.id)).toContain("unit.soldier");
  });

  it("workbench recipes", () => {
    const r = recipesForBuilding("workbench");
    expect(r.some((x) => x.id === "craft_stone_axe")).toBe(true);
  });

  it("unit job completes", () => {
    const job = enqueueUnitJob("inst1", "unit.farmer", 1000)!;
    const mid = tickProduction([job], 1000 + 5000);
    expect(mid.running.length).toBe(1);
    const done = tickProduction([job], job.endsAt + 1);
    expect(done.completed[0]?.kind).toBe("unit");
  });
});

describe("defense + claim", () => {
  it("picks nearest threat in range", () => {
    const t = pickBestThreat(0, 0, 50, [
      { id: "a", x: 10, z: 0, hpFrac: 1, isHostile: true },
      { id: "b", x: 5, z: 0, hpFrac: 0.5, isHostile: true },
    ], null);
    expect(t?.id).toBe("b");
  });

  it("workers flee when threatened", () => {
    const b = tickDefenderBehavior(
      {
        id: "w1",
        x: 0,
        z: 0,
        role: "worker",
        hpFrac: 0.9,
        behavior: "harvest",
      },
      [{ id: "e", x: 5, z: 0, hpFrac: 1, isHostile: true }],
      null,
    );
    expect(b).toBe("return_to_camp");
  });

  it("claim radius gate", () => {
    const claim = {
      claimId: "c1",
      ownerAccountId: "a1",
      islandId: "i1",
      pos: { x: 0, y: 0, z: 0 },
      radiusM: 20,
      buildRights: true,
      skills: { logistics: 1, fortify: 1, muster: 1, husbandry: 1, drill: 1 },
      placedBuildingIds: [],
      rosterUnitIds: [],
    };
    expect(inClaimBuildRadius(claim, 5, 5)).toBe(true);
    expect(inClaimBuildRadius(claim, 50, 0)).toBe(false);
  });
});

describe("palette", () => {
  it("exports UI rows", () => {
    const rows = buildingPaletteRows("crusade");
    expect(rows.some((r) => r.emoji === "🚩")).toBe(true);
    expect(rows.some((r) => r.name === "Barracks")).toBe(true);
  });
});
