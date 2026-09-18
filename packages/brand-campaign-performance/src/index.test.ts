import { describe, expect, it } from "vitest";

import { buildBrandCampaignPerformance } from "./index.js";

describe("Brand Campaign Performance", () => {
  it("aggregates basic Brand Core analytics without claiming profitability", () => {
    const model = buildBrandCampaignPerformance({
      currency: "eur",
      generatedAt: "2026-09-18T12:00:00.000Z",
      entries: [
        {
          campaignId: "campaign-1",
          campaignName: "Launch",
          creatorProfileId: "creator-1",
          gmvCents: 10000,
          orders: 5,
          recordedCommissionCents: 1500,
          contentStatus: "posted",
          performanceUpdatedAt: "2026-09-18T10:00:00.000Z",
        },
        {
          campaignId: "campaign-1",
          campaignName: "Launch",
          creatorProfileId: "creator-2",
          gmvCents: 6000,
          orders: 2,
          recordedCommissionCents: 900,
          contentStatus: "in_progress",
          performanceUpdatedAt: "2026-09-18T11:00:00.000Z",
        },
        {
          campaignId: "campaign-2",
          campaignName: "Always On",
          creatorProfileId: "creator-3",
          gmvCents: 3000,
          orders: 1,
          recordedCommissionCents: 450,
          contentStatus: "posted",
          performanceUpdatedAt: null,
        },
      ],
    });

    expect(model.currency).toBe("EUR");
    expect(model.totals).toEqual({
      gmvCents: 19000,
      orders: 8,
      recordedCommissionCents: 2850,
      assignedCreators: 3,
      postedCreators: 2,
    });
    expect(model.campaigns[0]).toMatchObject({
      campaignId: "campaign-1",
      gmvCents: 16000,
      orders: 7,
      assignedCreators: 2,
      postedCreators: 1,
      performanceUpdatedAt: "2026-09-18T11:00:00.000Z",
    });
    expect(model.economicsNotice).toContain("keine vollständige Profitabilitätsberechnung");
  });

  it("fails closed on duplicate assignment rows", () => {
    const duplicate = {
      campaignId: "campaign-1",
      campaignName: "Launch",
      creatorProfileId: "creator-1",
      gmvCents: 100,
      orders: 1,
      recordedCommissionCents: 10,
      contentStatus: "posted" as const,
      performanceUpdatedAt: null,
    };

    expect(() => buildBrandCampaignPerformance({
      currency: "EUR",
      generatedAt: "2026-09-18T12:00:00.000Z",
      entries: [duplicate, duplicate],
    })).toThrow("BRAND_PERFORMANCE_DUPLICATE_ASSIGNMENT");
  });

  it("fails closed on malformed metrics, timestamps and currency", () => {
    expect(() => buildBrandCampaignPerformance({
      currency: "EU",
      generatedAt: "2026-09-18T12:00:00.000Z",
      entries: [],
    })).toThrow("BRAND_PERFORMANCE_CURRENCY_INVALID");

    expect(() => buildBrandCampaignPerformance({
      currency: "EUR",
      generatedAt: "not-a-date",
      entries: [],
    })).toThrow("BRAND_PERFORMANCE_GENERATED_AT_INVALID");

    expect(() => buildBrandCampaignPerformance({
      currency: "EUR",
      generatedAt: "2026-09-18T12:00:00.000Z",
      entries: [{
        campaignId: "campaign-1",
        campaignName: "Launch",
        creatorProfileId: "creator-1",
        gmvCents: -1,
        orders: 0,
        recordedCommissionCents: 0,
        contentStatus: "not_started",
        performanceUpdatedAt: null,
      }],
    })).toThrow("BRAND_PERFORMANCE_GMV_INVALID");
  });

  it("rejects conflicting names for the same campaign id", () => {
    expect(() => buildBrandCampaignPerformance({
      currency: "EUR",
      generatedAt: "2026-09-18T12:00:00.000Z",
      entries: [
        {
          campaignId: "campaign-1",
          campaignName: "Launch",
          creatorProfileId: "creator-1",
          gmvCents: 0,
          orders: 0,
          recordedCommissionCents: 0,
          contentStatus: "not_started",
          performanceUpdatedAt: null,
        },
        {
          campaignId: "campaign-1",
          campaignName: "Different Name",
          creatorProfileId: "creator-2",
          gmvCents: 0,
          orders: 0,
          recordedCommissionCents: 0,
          contentStatus: "not_started",
          performanceUpdatedAt: null,
        },
      ],
    })).toThrow("BRAND_PERFORMANCE_CAMPAIGN_NAME_CONFLICT");
  });
});
