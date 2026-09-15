import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateSnapshotFreshness, loadRuntimeSnapshot, type CockpitRuntimeSnapshot } from "./runtime";

afterEach(() => {
  vi.unstubAllGlobals();
});

function snapshot(overrides: Partial<CockpitRuntimeSnapshot> = {}): CockpitRuntimeSnapshot {
  return {
    generatedAt: "2026-09-15T19:30:00.000Z",
    creatorSource: "company-os",
    campaignSource: "company-os",
    creatorPool: { total: 12, active: 4, onboarding: 2, screening: 3, blockers: 1 },
    ledgers: [],
    syncedAt: {
      creators: "2026-09-15T19:20:00.000Z",
      campaigns: "2026-09-15T19:20:00.000Z",
      assignments: "2026-09-15T19:20:00.000Z"
    },
    ...overrides
  };
}

describe("cockpit runtime snapshot", () => {
  it("returns the live runtime payload when the endpoint succeeds", async () => {
    const payload = snapshot({
      generatedAt: "2026-09-15T19:00:00.000Z",
      campaignSource: "demo",
      syncedAt: { creators: "2026-09-15T18:59:00.000Z", campaigns: null, assignments: null }
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));

    await expect(loadRuntimeSnapshot()).resolves.toEqual(payload);
  });

  it("falls back cleanly when the runtime endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    await expect(loadRuntimeSnapshot()).resolves.toBeNull();
  });

  it("treats all live Company OS sources as fresh within 30 minutes", () => {
    expect(evaluateSnapshotFreshness(snapshot())).toEqual({
      fresh: true,
      staleSources: [],
      oldestAgeMinutes: 10,
      thresholdMinutes: 30
    });
  });

  it("flags only stale live sources", () => {
    const result = evaluateSnapshotFreshness(snapshot({
      syncedAt: {
        creators: "2026-09-15T18:55:00.000Z",
        campaigns: "2026-09-15T19:20:00.000Z",
        assignments: "2026-09-15T18:50:00.000Z"
      }
    }));

    expect(result.fresh).toBe(false);
    expect(result.staleSources).toEqual(["creators", "assignments"]);
    expect(result.oldestAgeMinutes).toBe(40);
  });

  it("requires only the creator source while campaign data is still demo", () => {
    const result = evaluateSnapshotFreshness(snapshot({
      campaignSource: "demo",
      syncedAt: { creators: "2026-09-15T19:20:00.000Z", campaigns: null, assignments: null }
    }));
    expect(result.fresh).toBe(true);
    expect(result.staleSources).toEqual([]);
  });

  it("fails closed when a required sync timestamp is missing", () => {
    const result = evaluateSnapshotFreshness(snapshot({
      syncedAt: { creators: null, campaigns: "2026-09-15T19:20:00.000Z", assignments: "2026-09-15T19:20:00.000Z" }
    }));
    expect(result.fresh).toBe(false);
    expect(result.staleSources).toEqual(["creators"]);
  });
});
