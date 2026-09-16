import { describe, expect, it } from "vitest";
import type { AffiliatePerformanceRecord } from "@gmvgang/affiliate-performance";
import type { AffiliatePerformanceQuery, AffiliatePerformanceStore } from "@gmvgang/affiliate-performance-supabase";

import {
  brandAffiliatePerformanceWindow,
  createAffiliatePerformanceBrandOverviewReadPort,
  type BrandAffiliatePerformancePolicy,
} from "../src/brand-performance.js";

const NOW = "2026-09-16T16:30:00.000Z";

const policy: BrandAffiliatePerformancePolicy = {
  lookbackDays: 30,
  maxRecords: 200,
  minimumCoverageRatio: 1,
  maxSourceAgeMinutes: 60,
  requiredMetrics: ["gmv", "orders"],
};

function record(overrides: Partial<AffiliatePerformanceRecord> = {}): AffiliatePerformanceRecord {
  return {
    source: {
      provider: "tiktok-shop-seller-analytics",
      externalRecordId: "record-1",
    },
    grain: "product",
    channel: "affiliate-total",
    dimensions: {
      organizationId: "brand-1",
      productId: "product-1",
    },
    window: {
      startDate: "2026-09-15",
      endDateExclusive: "2026-09-16",
      timeZone: "Europe/Berlin",
    },
    currency: "EUR",
    status: "final",
    metrics: {
      gmv: 100,
      orders: 2,
    },
    observedAt: "2026-09-16T16:00:00.000Z",
    ...overrides,
  };
}

function store(records: readonly AffiliatePerformanceRecord[], captures: AffiliatePerformanceQuery[] = []): AffiliatePerformanceStore {
  return {
    async saveBatch() {
      throw new Error("not used");
    },
    async list(query) {
      captures.push(query);
      return [...records];
    },
  };
}

describe("brandAffiliatePerformanceWindow", () => {
  it("creates a deterministic UTC calendar window ending after the current day", () => {
    expect(brandAffiliatePerformanceWindow(NOW, 30)).toEqual({
      startDate: "2026-08-18",
      endDateExclusive: "2026-09-17",
    });
  });

  it("rejects invalid timestamps and lookbacks", () => {
    expect(() => brandAffiliatePerformanceWindow("not-a-date", 30)).toThrow("BRAND_AFFILIATE_PERFORMANCE_NOW_INVALID");
    expect(() => brandAffiliatePerformanceWindow(NOW, 0)).toThrow("BRAND_AFFILIATE_PERFORMANCE_LOOKBACK_INVALID");
  });
});

describe("createAffiliatePerformanceBrandOverviewReadPort", () => {
  it("queries only the authenticated organization window and returns ready final complete slices", async () => {
    const queries: AffiliatePerformanceQuery[] = [];
    const port = createAffiliatePerformanceBrandOverviewReadPort(store([record()], queries), policy);

    const overview = await port.getOverview({
      organizationId: "brand-1",
      userId: "user-1",
      now: NOW,
    });

    expect(queries).toEqual([{
      organizationId: "brand-1",
      startDateOnOrAfter: "2026-08-18",
      endDateExclusiveOnOrBefore: "2026-09-17",
      limit: 200,
    }]);
    expect(overview.organizationId).toBe("brand-1");
    expect(overview.performance?.scope).toEqual({ organizationId: "brand-1" });
    expect(overview.performance?.slices).toHaveLength(1);
    expect(overview.performance?.slices[0]?.metrics.gmv).toBe(100);
    expect(overview.performance?.slices[0]?.completeness.gmv).toBe(1);
    expect(overview.dataStatus.affiliatePerformance).toBe("ready");
    expect(overview.readiness).toEqual({
      availableSections: 1,
      partialSections: 0,
      unavailableSections: 5,
    });
  });

  it("keeps the section unavailable when the store has no measurements", async () => {
    const port = createAffiliatePerformanceBrandOverviewReadPort(store([]), policy);
    const overview = await port.getOverview({ organizationId: "brand-1", userId: "user-1", now: NOW });

    expect(overview.performance).toBeNull();
    expect(overview.dataStatus.affiliatePerformance).toBe("unavailable");
    expect(overview.readiness.unavailableSections).toBe(6);
  });

  it("marks provisional, stale, incomplete, or potentially truncated measurements as partial", async () => {
    const incomplete = record({ metrics: { gmv: 100 } });
    const incompletePort = createAffiliatePerformanceBrandOverviewReadPort(store([incomplete]), policy);
    const incompleteOverview = await incompletePort.getOverview({ organizationId: "brand-1", userId: "user-1", now: NOW });
    expect(incompleteOverview.dataStatus.affiliatePerformance).toBe("partial");

    const provisionalPort = createAffiliatePerformanceBrandOverviewReadPort(
      store([record({ status: "provisional" })]),
      policy,
    );
    const provisionalOverview = await provisionalPort.getOverview({ organizationId: "brand-1", userId: "user-1", now: NOW });
    expect(provisionalOverview.dataStatus.affiliatePerformance).toBe("partial");

    const stalePort = createAffiliatePerformanceBrandOverviewReadPort(
      store([record({ observedAt: "2026-09-16T14:00:00.000Z" })]),
      policy,
    );
    const staleOverview = await stalePort.getOverview({ organizationId: "brand-1", userId: "user-1", now: NOW });
    expect(staleOverview.dataStatus.affiliatePerformance).toBe("partial");

    const truncatedPort = createAffiliatePerformanceBrandOverviewReadPort(
      store([record()]),
      { ...policy, maxRecords: 1 },
    );
    const truncatedOverview = await truncatedPort.getOverview({ organizationId: "brand-1", userId: "user-1", now: NOW });
    expect(truncatedOverview.dataStatus.affiliatePerformance).toBe("partial");
  });

  it("fails closed if a persistence implementation leaks another organization", async () => {
    const port = createAffiliatePerformanceBrandOverviewReadPort(
      store([record({ dimensions: { organizationId: "brand-2", productId: "product-1" } })]),
      policy,
    );

    await expect(port.getOverview({ organizationId: "brand-1", userId: "user-1", now: NOW }))
      .rejects.toThrow("AFFILIATE_PERFORMANCE_SCOPE_ORGANIZATION_MISMATCH");
  });

  it("rejects unsafe or ambiguous policies before any query is executed", () => {
    expect(() => createAffiliatePerformanceBrandOverviewReadPort(store([]), { ...policy, lookbackDays: 0 }))
      .toThrow("BRAND_AFFILIATE_PERFORMANCE_LOOKBACK_INVALID");
    expect(() => createAffiliatePerformanceBrandOverviewReadPort(store([]), { ...policy, maxRecords: 1001 }))
      .toThrow("BRAND_AFFILIATE_PERFORMANCE_MAX_RECORDS_INVALID");
    expect(() => createAffiliatePerformanceBrandOverviewReadPort(store([]), { ...policy, minimumCoverageRatio: 0 }))
      .toThrow("BRAND_AFFILIATE_PERFORMANCE_COVERAGE_INVALID");
    expect(() => createAffiliatePerformanceBrandOverviewReadPort(store([]), { ...policy, requiredMetrics: [] }))
      .toThrow("BRAND_AFFILIATE_PERFORMANCE_REQUIRED_METRICS_INVALID");
  });
});
