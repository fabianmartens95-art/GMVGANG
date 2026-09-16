import { describe, expect, it } from "vitest";

import { buildBrandPortalReadModel } from "../src/brand-read-model.js";
import { parseBrandOverview } from "../src/brand-workspace.js";

const completeness = {
  gmv: 1,
  orders: 1,
  unitsSold: 0,
  commission: 0,
  refunds: 0,
  refundedItems: 0,
  impressions: 0,
  clicks: 0,
  addToCart: 0,
  views: 0,
  creatorPosts: 0,
} as const;

function overviewPayload() {
  const model = buildBrandPortalReadModel({
    organizationId: "brand-1",
    asOf: "2026-09-16T16:30:00.000Z",
    performance: {
      scope: { organizationId: "brand-1" },
      slices: [{
        sliceKey: "tiktok-shop-seller-analytics|product|affiliate-total|2026-09-15|2026-09-16|Europe/Berlin|EUR",
        provider: "tiktok-shop-seller-analytics",
        grain: "product",
        channel: "affiliate-total",
        window: {
          startDate: "2026-09-15",
          endDateExclusive: "2026-09-16",
          timeZone: "Europe/Berlin",
        },
        currency: "EUR",
        recordCount: 1,
        metrics: {
          gmv: 100,
          orders: 2,
          unitsSold: null,
          commission: null,
          refunds: null,
          refundedItems: null,
          impressions: null,
          clicks: null,
          addToCart: null,
          views: null,
          creatorPosts: null,
        },
        completeness: { ...completeness },
        status: "final",
        firstObservedAt: "2026-09-16T16:00:00.000Z",
        lastObservedAt: "2026-09-16T16:00:00.000Z",
        ratios: {
          ctr: null,
          clickOrderRate: null,
          aov: 50,
          refundRate: null,
          gmvPerThousandViews: null,
        },
      }],
    },
    policy: {
      targetContributionMargin: 0.2,
      minimumInventoryDays: 14,
      rightsExpiryWarningDays: 14,
      maxDataAgeMinutes: 30,
    },
    dataStatus: {
      profitability: "unavailable",
      creatorOperations: "unavailable",
      rights: "unavailable",
      inventory: "unavailable",
      paidPerformance: "unavailable",
      affiliatePerformance: "ready",
    },
  });

  return { source: "production" as const, model };
}

describe("affiliate performance response parsing", () => {
  it("accepts the canonical numeric completeness ratios emitted by the core read model", () => {
    const parsed = parseBrandOverview(overviewPayload());
    const slice = parsed.model.performance?.slices[0];

    expect(slice?.completeness.gmv).toBe(1);
    expect(slice?.completeness.orders).toBe(1);
    expect(slice?.completeness.views).toBe(0);
    expect(slice?.ratios.aov).toBe(50);
  });

  it("rejects legacy object-shaped completeness payloads", () => {
    const payload = overviewPayload();
    const slice = payload.model.performance!.slices[0]! as unknown as Record<string, unknown>;
    slice.completeness = {
      ...completeness,
      gmv: { records: 1, totalRecords: 1, ratio: 1 },
    };

    expect(() => parseBrandOverview(payload)).toThrow("BRAND_OVERVIEW_PERFORMANCE_INVALID");
  });

  it("rejects completeness ratios outside the canonical zero-to-one range", () => {
    const payload = overviewPayload();
    payload.model.performance!.slices[0]!.completeness.gmv = 1.01;

    expect(() => parseBrandOverview(payload)).toThrow("BRAND_OVERVIEW_PERFORMANCE_INVALID");
  });
});
