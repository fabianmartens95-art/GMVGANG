import { describe, expect, it } from "vitest";
import {
  buildCreatorWorkspaceReadModel,
  unavailableCreatorWorkspaceReadModel,
  type CreatorWorkspaceSourceAssignment,
} from "../src/index.js";

const NOW = "2026-09-16T18:30:00.000Z";

function assignment(overrides: Partial<CreatorWorkspaceSourceAssignment> = {}): CreatorWorkspaceSourceAssignment {
  const base: CreatorWorkspaceSourceAssignment = {
    campaign: {
      id: "campaign-1",
      name: "Approved Creator Campaign",
      status: "approved",
      clientApproved: true,
      launchedAt: null,
      completedAt: null,
      updatedAt: "2026-09-16T18:00:00.000Z",
    },
    creatorReady: true,
    outreachStatus: "queued",
    sampleStatus: "not_requested",
    contentStatus: "not_started",
    postedAt: null,
    operationalPerformance: {
      gmV: 0,
      orders: 0,
      commission: 0,
      updatedAt: null,
    },
  };
  return {
    ...base,
    ...overrides,
    campaign: { ...base.campaign, ...(overrides.campaign ?? {}) },
    operationalPerformance: {
      ...base.operationalPerformance,
      ...(overrides.operationalPerformance ?? {}),
    },
  };
}

describe("buildCreatorWorkspaceReadModel", () => {
  it("exposes a ready, client-approved assignment as a match without internal scoring", () => {
    const model = buildCreatorWorkspaceReadModel({ assignments: [assignment()], syncedAt: NOW }, NOW);
    expect(model.matches).toEqual([{
      campaignId: "campaign-1",
      campaignName: "Approved Creator Campaign",
      status: "new",
    }]);
    expect(model.campaigns).toEqual([]);
    expect(JSON.stringify(model)).not.toContain("creatorReady");
    expect(JSON.stringify(model)).not.toContain("blocker");
    expect(JSON.stringify(model)).not.toContain("score");
  });

  it("fails closed for draft, unapproved or not-ready opportunities", () => {
    const model = buildCreatorWorkspaceReadModel({
      assignments: [
        assignment({ campaign: { ...assignment().campaign, id: "draft", status: "draft" } }),
        assignment({ campaign: { ...assignment().campaign, id: "not-approved", clientApproved: false } }),
        assignment({ campaign: { ...assignment().campaign, id: "not-ready" }, creatorReady: false }),
      ],
      syncedAt: NOW,
    }, NOW);
    expect(model.matches).toEqual([]);
    expect(model.campaigns).toEqual([]);
  });

  it("shows accepted participation history without requiring current readiness", () => {
    const model = buildCreatorWorkspaceReadModel({
      assignments: [assignment({
        creatorReady: false,
        outreachStatus: "accepted",
        sampleStatus: "delivered",
        contentStatus: "in_progress",
        campaign: {
          ...assignment().campaign,
          status: "active",
          launchedAt: "2026-09-16T15:00:00.000Z",
        },
      })],
      syncedAt: NOW,
    }, NOW);
    expect(model.matches).toHaveLength(0);
    expect(model.campaigns).toMatchObject([{
      campaignId: "campaign-1",
      status: "active",
      sampleStatus: "delivered",
      contentStatus: "in_progress",
    }]);
  });

  it("aggregates only creator-visible participating campaign performance as provisional operational data", () => {
    const model = buildCreatorWorkspaceReadModel({
      assignments: [
        assignment({
          campaign: { ...assignment().campaign, id: "campaign-a", name: "A", status: "active" },
          outreachStatus: "accepted",
          contentStatus: "posted",
          postedAt: "2026-09-16T17:00:00.000Z",
          operationalPerformance: { gmV: 1250, orders: 10, commission: 125, updatedAt: "2026-09-16T18:00:00.000Z" },
        }),
        assignment({
          campaign: { ...assignment().campaign, id: "campaign-b", name: "B", status: "completed", completedAt: NOW },
          sampleStatus: "delivered",
          contentStatus: "posted",
          operationalPerformance: { gmV: 750, orders: 5, commission: 80, updatedAt: NOW },
        }),
        assignment({
          campaign: { ...assignment().campaign, id: "hidden", name: "Hidden", clientApproved: false },
          outreachStatus: "accepted",
          operationalPerformance: { gmV: 99999, orders: 999, commission: 9999, updatedAt: NOW },
        }),
      ],
      syncedAt: NOW,
    }, NOW);

    expect(model.performance).toEqual({
      source: "company-os-operational",
      verification: "provisional",
      currency: null,
      totals: { gmV: 2000, orders: 15, commission: 205, postedContent: 2 },
      campaigns: [
        { campaignId: "campaign-a", campaignName: "A", gmV: 1250, orders: 10, commission: 125, updatedAt: "2026-09-16T18:00:00.000Z" },
        { campaignId: "campaign-b", campaignName: "B", gmV: 750, orders: 5, commission: 80, updatedAt: NOW },
      ],
      updatedAt: NOW,
    });
  });

  it("rejects duplicate campaign assignments instead of double counting", () => {
    expect(() => buildCreatorWorkspaceReadModel({
      assignments: [assignment(), assignment()],
      syncedAt: NOW,
    }, NOW)).toThrow("CREATOR_WORKSPACE_DUPLICATE_CAMPAIGN_ASSIGNMENT");
  });
});

describe("unavailableCreatorWorkspaceReadModel", () => {
  it("returns an explicit empty fail-closed model", () => {
    const model = unavailableCreatorWorkspaceReadModel(NOW, "source_not_configured");
    expect(model).toMatchObject({
      availability: "unavailable",
      unavailableReason: "source_not_configured",
      matches: [],
      campaigns: [],
    });
  });
});
