import { describe, expect, it } from "vitest";
import {
  aggregateAffiliatePerformance,
  buildTikTokSellerAnalyticsRequestPlan,
  derivePerformanceRatios,
  normalizePerformanceBatch,
  normalizePerformanceRecord,
  TIKTOK_SELLER_ANALYTICS_CONTRACT,
  TIKTOK_SELLER_ANALYTICS_ENDPOINTS,
  type AffiliatePerformanceMetrics,
  type AffiliatePerformanceRecord
} from "./index.js";

function productRecord(
  externalRecordId: string,
  productId: string,
  metrics: AffiliatePerformanceMetrics,
  currency = "EUR"
): AffiliatePerformanceRecord {
  return {
    source: {
      provider: "tiktok-shop-seller-analytics",
      externalRecordId,
      connectionId: "seller-connection-1"
    },
    grain: "product",
    channel: "affiliate-total",
    dimensions: {
      organizationId: "org-1",
      brandId: "brand-1",
      shopId: "shop-1",
      productId
    },
    window: {
      startDate: "2026-09-01",
      endDateExclusive: "2026-09-08",
      timeZone: "Europe/Berlin"
    },
    currency,
    status: "final",
    metrics,
    observedAt: "2026-09-09T06:00:00.000Z"
  };
}

describe("affiliate performance normalization", () => {
  it("normalizes currency and trims identifiers", () => {
    const normalized = normalizePerformanceRecord({
      ...productRecord(" row-1 ", " product-1 ", { gmv: 100 }),
      currency: "eur"
    });

    expect(normalized.currency).toBe("EUR");
    expect(normalized.source.externalRecordId).toBe("row-1");
    expect(normalized.dimensions.productId).toBe("product-1");
  });

  it("drops exact retry duplicates idempotently", () => {
    const input = productRecord("row-1", "product-1", { gmv: 100, orders: 2 });
    const batch = normalizePerformanceBatch([input, input]);

    expect(batch.records).toHaveLength(1);
    expect(batch.duplicateRecordsDropped).toBe(1);
  });

  it("rejects a reused provider identity with conflicting metrics", () => {
    const first = productRecord("row-1", "product-1", { gmv: 100 });
    const changed = productRecord("row-1", "product-1", { gmv: 101 });

    expect(() => normalizePerformanceBatch([first, changed])).toThrow(/conflicting performance record/);
  });

  it("rejects two different records covering the same dimensional window", () => {
    const first = productRecord("row-1", "product-1", { gmv: 100 });
    const duplicateCoverage = productRecord("row-2", "product-1", { gmv: 100 });

    expect(() => normalizePerformanceBatch([first, duplicateCoverage])).toThrow(/overlapping performance coverage/);
  });

  it("fails closed on missing grain identity and invalid metrics", () => {
    const missingProduct = productRecord("row-1", "product-1", { gmv: 100 });
    missingProduct.dimensions = { shopId: "shop-1" };
    expect(() => normalizePerformanceRecord(missingProduct)).toThrow(/productId is required/);

    const negative = productRecord("row-2", "product-2", { gmv: -1 });
    expect(() => normalizePerformanceRecord(negative)).toThrow(/non-negative/);
  });
});

describe("affiliate performance aggregation", () => {
  it("sums only complete additive metrics and exposes completeness", () => {
    const first = productRecord("row-1", "product-1", {
      gmv: 100,
      orders: 1,
      impressions: 1000,
      clicks: 100,
      refunds: 10,
      views: 10000
    });
    const second = productRecord("row-2", "product-2", {
      gmv: 200,
      orders: 2,
      impressions: 2000,
      clicks: 200,
      refunds: 20
    });

    const aggregate = aggregateAffiliatePerformance([first, second]);
    expect(aggregate.metrics.gmv).toBe(300);
    expect(aggregate.metrics.orders).toBe(3);
    expect(aggregate.metrics.views).toBeNull();
    expect(aggregate.completeness.views).toBe(0.5);

    const ratios = derivePerformanceRatios(aggregate.metrics);
    expect(ratios.ctr).toBeCloseTo(0.1);
    expect(ratios.aov).toBeCloseTo(100);
    expect(ratios.refundRate).toBeCloseTo(0.1);
    expect(ratios.gmvPerThousandViews).toBeNull();
  });

  it("rejects mixed currencies instead of silently converting", () => {
    expect(() => aggregateAffiliatePerformance([
      productRecord("row-1", "product-1", { gmv: 100 }, "EUR"),
      productRecord("row-2", "product-2", { gmv: 100 }, "USD")
    ])).toThrow(/mixed currencies/);
  });
});

describe("TikTok Seller Analytics request contract", () => {
  it("builds a secret-free request plan for the current analytics family", () => {
    const plan = buildTikTokSellerAnalyticsRequestPlan({
      connectionId: "seller-connection-1",
      shopId: "shop-1",
      shopTimeZone: "Europe/Berlin",
      startDate: "2026-09-01",
      endDateExclusive: "2026-09-08",
      currency: "LOCAL"
    });

    expect(plan.pageSize).toBe(100);
    expect(plan.endpoints).toEqual(TIKTOK_SELLER_ANALYTICS_ENDPOINTS);
    expect(TIKTOK_SELLER_ANALYTICS_CONTRACT.apiVersion).toBe("202605");
    expect(JSON.stringify(plan)).not.toMatch(/token|secret|sign/i);
  });
});
