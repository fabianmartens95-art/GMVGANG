import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRuntimeSnapshot } from "./runtime";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cockpit runtime snapshot", () => {
  it("returns the live runtime payload when the endpoint succeeds", async () => {
    const payload = {
      generatedAt: "2026-09-15T19:00:00.000Z",
      creatorSource: "company-os",
      campaignSource: "demo",
      creatorPool: { total: 12, active: 4, onboarding: 2, screening: 3, blockers: 1 },
      ledgers: [],
      syncedAt: { creators: "2026-09-15T18:59:00.000Z", campaigns: null, assignments: null }
    };

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
});
