import { describe, expect, it } from "vitest";
import type {
  AffiliatePerformanceRecord,
  PerformanceProvider
} from "@gmvgang/affiliate-performance";
import {
  createAffiliatePerformanceStore,
  type AffiliatePerformancePersistenceDriver,
  type AffiliatePerformanceQuery,
  type PersistedAffiliatePerformanceMeasurement
} from "./index.js";

function record(overrides: Partial<AffiliatePerformanceRecord> = {}): AffiliatePerformanceRecord {
  return {
    source: {
      provider: "tiktok-shop-seller-analytics",
      externalRecordId: "record-1",
      connectionId: "connection-1"
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
      gmv: 300,
      orders: 3,
      impressions: 3000,
      clicks: 300
    },
    observedAt: "2026-09-09T06:00:00.000Z",
    ...overrides
  };
}

class MemoryDriver implements AffiliatePerformancePersistenceDriver {
  private readonly identity = new Map<string, PersistedAffiliatePerformanceMeasurement>();
  private readonly coverage = new Map<string, string>();

  private identityKey(provider: PerformanceProvider, externalRecordId: string) {
    return `${provider}:${externalRecordId}`;
  }

  async insert(measurement: PersistedAffiliatePerformanceMeasurement) {
    const identityKey = this.identityKey(measurement.provider, measurement.externalRecordId);
    if (this.identity.has(identityKey) || this.coverage.has(measurement.coverageKey)) return "unique_conflict" as const;
    this.identity.set(identityKey, structuredClone(measurement));
    this.coverage.set(measurement.coverageKey, identityKey);
    return "inserted" as const;
  }

  async findByIdentity(provider: PerformanceProvider, externalRecordId: string) {
    const value = this.identity.get(this.identityKey(provider, externalRecordId));
    return value ? structuredClone(value) : null;
  }

  async findByCoverage(coverageKey: string) {
    const identityKey = this.coverage.get(coverageKey);
    if (!identityKey) return null;
    const value = this.identity.get(identityKey);
    return value ? structuredClone(value) : null;
  }

  async touchLastObservedAt(provider: PerformanceProvider, externalRecordId: string, observedAt: string) {
    const key = this.identityKey(provider, externalRecordId);
    const value = this.identity.get(key);
    if (!value) throw new Error("TEST_MEASUREMENT_MISSING");
    if (Date.parse(observedAt) > Date.parse(value.lastObservedAt)) value.lastObservedAt = observedAt;
  }

  async list(query: AffiliatePerformanceQuery) {
    return [...this.identity.values()]
      .filter((row) => row.organizationId === query.organizationId)
      .filter((row) => !query.brandId || row.brandId === query.brandId)
      .filter((row) => !query.campaignId || row.campaignId === query.campaignId)
      .filter((row) => !query.grain || row.grain === query.grain)
      .filter((row) => !query.channel || row.channel === query.channel)
      .filter((row) => !query.startDateOnOrAfter || row.startDate >= query.startDateOnOrAfter)
      .filter((row) => !query.endDateExclusiveOnOrBefore || row.endDateExclusive <= query.endDateExclusiveOnOrBefore)
      .slice(0, query.limit ?? 200)
      .map((row) => structuredClone(row));
  }
}

describe("affiliate performance persistence", () => {
  it("inserts and round-trips a canonical tenant-scoped measurement", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    const result = await store.saveBatch([record()]);

    expect(result).toEqual({
      inputRecords: 1,
      normalizedRecords: 1,
      insertedRecords: 1,
      duplicateRecords: 0,
      duplicateRecordsDroppedInBatch: 0
    });

    const rows = await store.list({ organizationId: "org-1", brandId: "brand-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: { provider: "tiktok-shop-seller-analytics", externalRecordId: "record-1" },
      dimensions: { organizationId: "org-1", brandId: "brand-1", productId: "product-1" },
      metrics: { gmv: 300, orders: 3 }
    });
  });

  it("treats a later observation of unchanged business values as an idempotent duplicate", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    await store.saveBatch([record()]);

    const result = await store.saveBatch([
      record({ observedAt: "2026-09-10T06:00:00.000Z" })
    ]);

    expect(result.insertedRecords).toBe(0);
    expect(result.duplicateRecords).toBe(1);
    const [saved] = await store.list({ organizationId: "org-1" });
    expect(saved?.observedAt).toBe("2026-09-10T06:00:00.000Z");
  });

  it("deduplicates same-semantic records with different observation timestamps inside one batch", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    const result = await store.saveBatch([
      record(),
      record({ observedAt: "2026-09-10T06:00:00.000Z" })
    ]);

    expect(result.normalizedRecords).toBe(1);
    expect(result.insertedRecords).toBe(1);
    expect(result.duplicateRecordsDroppedInBatch).toBe(1);
  });

  it("rejects a reused provider identity when business metrics change", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    await store.saveBatch([record()]);

    await expect(store.saveBatch([
      record({ metrics: { gmv: 301, orders: 3 } })
    ])).rejects.toThrow(/AFFILIATE_PERFORMANCE_IDENTITY_CONFLICT/);
  });

  it("rejects a different provider record claiming the same dimensional coverage", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    await store.saveBatch([record()]);

    await expect(store.saveBatch([
      record({ source: { provider: "tiktok-shop-seller-analytics", externalRecordId: "record-2" } })
    ])).rejects.toThrow(/AFFILIATE_PERFORMANCE_COVERAGE_CONFLICT/);
  });

  it("allows exactly one insert when identical writes race", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    const [first, second] = await Promise.all([
      store.saveBatch([record()]),
      store.saveBatch([record()])
    ]);

    expect(first.insertedRecords + second.insertedRecords).toBe(1);
    expect(first.duplicateRecords + second.duplicateRecords).toBe(1);
  });

  it("fails closed for tenantless measurements", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    await expect(store.saveBatch([
      record({ dimensions: { shopId: "shop-1", productId: "product-1" } })
    ])).rejects.toThrow("AFFILIATE_PERFORMANCE_ORGANIZATION_REQUIRED");
  });

  it("validates tenant query limits", async () => {
    const store = createAffiliatePerformanceStore(new MemoryDriver());
    await expect(store.list({ organizationId: "org-1", limit: 1001 })).rejects.toThrow(
      "AFFILIATE_PERFORMANCE_QUERY_LIMIT_INVALID"
    );
  });
});
