import { describe, expect, it } from "vitest";
import {
  buildAffiliatePerformanceReadModel,
  findAffiliatePerformanceSlice,
  performanceSourceAgeMinutes,
  type AffiliatePerformanceRecord
} from "./index.js";

function record(overrides: Partial<AffiliatePerformanceRecord> = {}): AffiliatePerformanceRecord {
  return {
    source: {
      provider: "tiktok-shop-seller-analytics",
      externalRecordId: "record-1",
      connectionId: "conn-1"
    },
    grain: "product",
    channel: "affiliate-total",
    dimensions: {
      organizationId: "org-1",
      brandId: "brand-1",
      shopId: "shop-1",
      productId: "product-1"
    },
    window: {
      startDate: "2026-09-01",
      endDateExclusive: "2026-09-08",
      timeZone: "Europe/Berlin"
    },
    currency: "EUR",
    status: "final",
    metrics: {
      gmv: 100,
      orders: 2,
      unitsSold: 2,
      impressions: 1000,
      clicks: 100
    },
    observedAt: "2026-09-09T06:00:00.000Z",
    ...overrides
  };
}

describe("affiliate performance read model", () => {
  it("aggregates only exact provider/grain/channel/window/currency slices", () => {
    const model = buildAffiliatePerformanceReadModel([
      record(),
      record({
        source: { provider: "tiktok-shop-seller-analytics", externalRecordId: "record-2", connectionId: "conn-1" },
        dimensions: { organizationId: "org-1", brandId: "brand-1", shopId: "shop-1", productId: "product-2" },
        metrics: { gmv: 200, orders: 3, unitsSold: 4, impressions: 2000, clicks: 200 },
        observedAt: "2026-09-09T07:00:00.000Z"
      })
    ], { organizationId: "org-1", brandId: "brand-1" });

    expect(model.slices).toHaveLength(1);
    expect(model.slices[0]).toMatchObject({
      recordCount: 2,
      grain: "product",
      channel: "affiliate-total",
      status: "final",
      firstObservedAt: "2026-09-09T06:00:00.000Z",
      lastObservedAt: "2026-09-09T07:00:00.000Z",
      metrics: {
        gmv: 300,
        orders: 5,
        unitsSold: 6,
        impressions: 3000,
        clicks: 300
      },
      ratios: {
        ctr: 0.1,
        clickOrderRate: 5 / 300,
        aov: 60
      }
    });
  });

  it("keeps overlapping affiliate-total product data and affiliate-video content data separate", () => {
    const model = buildAffiliatePerformanceReadModel([
      record(),
      record({
        source: { provider: "tiktok-shop-seller-analytics", externalRecordId: "video-1", connectionId: "conn-1" },
        grain: "content",
        channel: "affiliate-video",
        dimensions: {
          organizationId: "org-1",
          brandId: "brand-1",
          shopId: "shop-1",
          creatorId: "creator-1",
          contentId: "content-1"
        },
        metrics: { gmv: 80, orders: 1, unitsSold: 1, views: 5000 }
      })
    ], { organizationId: "org-1", brandId: "brand-1" });

    expect(model.slices).toHaveLength(2);
    expect(model.slices.map((slice) => `${slice.grain}:${slice.channel}`)).toEqual([
      "content:affiliate-video",
      "product:affiliate-total"
    ]);
  });

  it("fails closed when a record crosses the requested tenant or brand scope", () => {
    expect(() => buildAffiliatePerformanceReadModel([
      record({ dimensions: { organizationId: "org-2", brandId: "brand-1", shopId: "shop-1", productId: "product-1" } })
    ], { organizationId: "org-1", brandId: "brand-1" })).toThrow("AFFILIATE_PERFORMANCE_SCOPE_ORGANIZATION_MISMATCH");

    expect(() => buildAffiliatePerformanceReadModel([
      record({ dimensions: { organizationId: "org-1", brandId: "brand-2", shopId: "shop-1", productId: "product-1" } })
    ], { organizationId: "org-1", brandId: "brand-1" })).toThrow("AFFILIATE_PERFORMANCE_SCOPE_BRAND_MISMATCH");
  });

  it("keeps different time windows separate and marks a slice provisional if any source row is provisional", () => {
    const model = buildAffiliatePerformanceReadModel([
      record({ status: "provisional" }),
      record({
        source: { provider: "tiktok-shop-seller-analytics", externalRecordId: "record-next", connectionId: "conn-1" },
        window: { startDate: "2026-09-08", endDateExclusive: "2026-09-15", timeZone: "Europe/Berlin" }
      })
    ], { organizationId: "org-1" });

    expect(model.slices).toHaveLength(2);
    expect(model.slices.find((slice) => slice.window.startDate === "2026-09-01")?.status).toBe("provisional");
  });

  it("finds an exact slice without choosing between overlapping grains or channels", () => {
    const model = buildAffiliatePerformanceReadModel([record()], { organizationId: "org-1" });
    const slice = findAffiliatePerformanceSlice(model, {
      provider: "tiktok-shop-seller-analytics",
      grain: "product",
      channel: "affiliate-total",
      window: { startDate: "2026-09-01", endDateExclusive: "2026-09-08", timeZone: "Europe/Berlin" },
      currency: "eur"
    });
    expect(slice?.metrics.gmv).toBe(100);
  });

  it("calculates source age from the latest observation and never returns a negative age", () => {
    const model = buildAffiliatePerformanceReadModel([record()], { organizationId: "org-1" });
    expect(performanceSourceAgeMinutes(model.slices[0]!, "2026-09-09T06:30:00.000Z")).toBe(30);
    expect(performanceSourceAgeMinutes(model.slices[0]!, "2026-09-09T05:30:00.000Z")).toBe(0);
  });
});
