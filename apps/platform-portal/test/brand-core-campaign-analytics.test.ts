import { describe, expect, it } from "vitest";
import {
  HttpBrandCampaignAnalyticsAdapter,
  parseBrandCampaignAnalytics,
  renderBrandCampaignAnalytics,
} from "../src/brand-core-campaign-analytics.js";

const payload = {
  model: {
    generatedAt: "2026-09-18T06:00:00.000Z",
    currency: "eur",
    totals: {
      gmvCents: 25000,
      orders: 10,
      recordedCommissionCents: 3750,
      assignedCreators: 4,
      postedCreators: 3,
    },
    campaigns: [{
      campaignId: "campaign-1",
      campaignName: "Launch <A>",
      gmvCents: 25000,
      orders: 10,
      recordedCommissionCents: 3750,
      assignedCreators: 4,
      postedCreators: 3,
      performanceUpdatedAt: "2026-09-18T05:30:00.000Z",
    }],
    economicsNotice: "GMV und recorded commission sind keine vollständige Profitabilitätsberechnung.",
  },
};

describe("Brand Campaign Core analytics surface", () => {
  it("parses the safe performance contract", () => {
    const result = parseBrandCampaignAnalytics(payload);
    expect(result.model.currency).toBe("EUR");
    expect(result.model.totals.postedCreators).toBe(3);
  });

  it("rejects unknown fields instead of silently widening the browser contract", () => {
    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        creatorEmail: "private@example.com",
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_MODEL_INVALID");

    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        campaigns: [{
          ...payload.model.campaigns[0],
          internalCreatorIds: ["creator-1"],
        }],
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID");
  });

  it("rejects profit/contribution fields on this performance-only boundary", () => {
    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        totals: { ...payload.model.totals, profitCents: 9999 },
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_PROFIT_CLAIM_FORBIDDEN");
  });

  it("rejects impossible Creator counts and duplicate Campaigns", () => {
    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        totals: { ...payload.model.totals, postedCreators: 5 },
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_CREATOR_COUNTS_INVALID");

    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: { ...payload.model, campaigns: [payload.model.campaigns[0], payload.model.campaigns[0]] },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_DUPLICATE_CAMPAIGN");
  });

  it("fails closed when financial totals or freshness contradict Campaign rows", () => {
    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        totals: {
          ...payload.model.totals,
          gmvCents: 25001,
        },
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_TOTALS_INCONSISTENT");

    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        generatedAt: "2026-09-18T05:00:00.000Z",
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_FRESHNESS_INVALID");
  });

  it("bounds deduplicated Creator totals between max Campaign count and summed Campaign counts", () => {
    const secondCampaign = {
      ...payload.model.campaigns[0],
      campaignId: "campaign-2",
      campaignName: "Launch B",
      gmvCents: 5000,
      orders: 2,
      recordedCommissionCents: 750,
      assignedCreators: 3,
      postedCreators: 2,
      performanceUpdatedAt: "2026-09-18T05:45:00.000Z",
    };

    const sharedCreatorTotals = parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        totals: {
          gmvCents: 30000,
          orders: 12,
          recordedCommissionCents: 4500,
          assignedCreators: 5,
          postedCreators: 4,
        },
        campaigns: [payload.model.campaigns[0], secondCampaign],
      },
    });
    expect(sharedCreatorTotals.model.totals.assignedCreators).toBe(5);

    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        totals: {
          ...payload.model.totals,
          assignedCreators: 3,
        },
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_CREATOR_COUNTS_INVALID");

    expect(() => parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        totals: {
          ...payload.model.totals,
          assignedCreators: 5,
        },
      },
    })).toThrow("BRAND_CAMPAIGN_ANALYTICS_CREATOR_COUNTS_INVALID");
  });

  it("renders canonical economics copy instead of trusting arbitrary server wording", () => {
    const response = parseBrandCampaignAnalytics({
      ...payload,
      model: {
        ...payload.model,
        economicsNotice: "Guaranteed profit.",
      },
    });

    expect(response.model.economicsNotice).toContain(
      "keine vollständige Profitabilitätsberechnung",
    );
    expect(response.model.economicsNotice).not.toContain("Guaranteed profit");
  });

  it("renders Performance ≠ Profit and escapes Campaign names", () => {
    const html = renderBrandCampaignAnalytics(parseBrandCampaignAnalytics(payload));
    expect(html).toContain("Performance ≠ Profit");
    expect(html).toContain("Launch &lt;A&gt;");
    expect(html).toContain("Recorded Commission");
  });

  it("sends the verified workspace selector as an organization header", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandCampaignAnalyticsAdapter("org-1", "/api/brand/campaign-performance", async (input, init) => {
      calls.push({ input, init });
      return { ok: true, async json() { return payload; } };
    });
    await expect(adapter.getAnalytics()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/campaign-performance",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "X-GMVGANG-Organization-Id": "org-1" },
      },
    }]);
  });
});
