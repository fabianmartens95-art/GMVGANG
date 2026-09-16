import { describe, expect, it } from "vitest";
import {
  HttpCreatorWorkspaceAdapter,
  parseCreatorWorkspacePayload,
  renderCreatorCampaigns,
  renderCreatorMatches,
  renderCreatorPerformance,
} from "../src/creator-workspace.js";

const PAYLOAD = {
  source: "production",
  model: {
    availability: "available",
    generatedAt: "2026-09-16T18:45:00.000Z",
    syncedAt: "2026-09-16T18:30:00.000Z",
    matches: [{
      campaignId: "campaign-match",
      campaignName: "Visible Match",
      status: "new",
      score: 99,
      blockers: ["internal"],
    }],
    campaigns: [{
      campaignId: "campaign-active",
      campaignName: "Creator Campaign",
      status: "active",
      sampleStatus: "delivered",
      contentStatus: "posted",
      launchedAt: "2026-09-15T12:00:00.000Z",
      completedAt: null,
      postedAt: "2026-09-16T12:00:00.000Z",
      creatorReady: true,
    }],
    performance: {
      source: "company-os-operational",
      verification: "provisional",
      currency: null,
      totals: { gmV: 1500, orders: 12, commission: 140, postedContent: 1 },
      campaigns: [{
        campaignId: "campaign-active",
        campaignName: "Creator Campaign",
        gmV: 1500,
        orders: 12,
        commission: 140,
        updatedAt: "2026-09-16T18:30:00.000Z",
        externalRecordId: "must-not-leak",
      }],
      updatedAt: "2026-09-16T18:30:00.000Z",
    },
  },
};

describe("parseCreatorWorkspacePayload", () => {
  it("accepts the creator-safe contract and drops unexpected internal fields", () => {
    const model = parseCreatorWorkspacePayload(PAYLOAD);
    expect(model).not.toBeNull();
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("blockers");
    expect(serialized).not.toContain("creatorReady");
    expect(serialized).not.toContain("externalRecordId");
  });

  it("rejects currency claims and invalid operational values", () => {
    expect(parseCreatorWorkspacePayload({
      ...PAYLOAD,
      model: {
        ...PAYLOAD.model,
        performance: { ...PAYLOAD.model.performance, currency: "EUR" },
      },
    })).toBeNull();
    expect(parseCreatorWorkspacePayload({
      ...PAYLOAD,
      model: {
        ...PAYLOAD.model,
        performance: {
          ...PAYLOAD.model.performance,
          totals: { ...PAYLOAD.model.performance.totals, gmV: -1 },
        },
      },
    })).toBeNull();
  });
});

describe("HttpCreatorWorkspaceAdapter", () => {
  it("reads through the same-origin creator endpoint", async () => {
    let input: RequestInfo | URL | undefined;
    let init: RequestInit | undefined;
    const adapter = new HttpCreatorWorkspaceAdapter(async (capturedInput, capturedInit) => {
      input = capturedInput;
      init = capturedInit;
      return new Response(JSON.stringify(PAYLOAD), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    await expect(adapter.getWorkspace()).resolves.toMatchObject({ availability: "available" });
    expect(input).toBe("/api/creator/workspace");
    expect(init).toMatchObject({ method: "GET", credentials: "same-origin" });
  });
});

describe("Creator workspace rendering", () => {
  it("renders matches and campaign progress without internal readiness facts", () => {
    const model = parseCreatorWorkspacePayload(PAYLOAD);
    if (!model) throw new Error("expected model");
    const html = `${renderCreatorMatches(model)}${renderCreatorCampaigns(model)}`;
    expect(html).toContain("Visible Match");
    expect(html).toContain("Creator Campaign");
    expect(html).toContain("Geliefert");
    expect(html).not.toContain("creatorReady");
    expect(html).not.toContain("blocker");
  });

  it("labels performance as provisional and makes no currency claim", () => {
    const model = parseCreatorWorkspacePayload(PAYLOAD);
    if (!model) throw new Error("expected model");
    const html = renderCreatorPerformance(model);
    expect(html).toContain("provisional");
    expect(html).toContain("noch nicht als TikTok-verifizierte Affiliate-Performance");
    expect(html).toContain("GMV · operativ");
    expect(html).not.toContain("€");
    expect(html).not.toContain("EUR");
  });

  it("renders an explicit unavailable state instead of demo data", () => {
    const model = parseCreatorWorkspacePayload({
      source: "production",
      model: {
        availability: "unavailable",
        unavailableReason: "source_not_configured",
        generatedAt: "2026-09-16T18:45:00.000Z",
        syncedAt: null,
        matches: [],
        campaigns: [],
        performance: {
          source: "company-os-operational",
          verification: "provisional",
          currency: null,
          totals: { gmV: 0, orders: 0, commission: 0, postedContent: 0 },
          campaigns: [],
          updatedAt: null,
        },
      },
    });
    if (!model) throw new Error("expected unavailable model");
    expect(renderCreatorMatches(model)).toContain("keine Ersatz- oder Demo-Daten");
  });
});
