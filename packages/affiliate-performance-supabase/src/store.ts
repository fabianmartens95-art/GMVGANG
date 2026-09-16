import { createHash } from "node:crypto";
import {
  normalizePerformanceBatch,
  normalizePerformanceRecord,
  performanceCoverageKey,
  performanceSemanticFingerprint,
  type AffiliatePerformanceMetrics,
  type AffiliatePerformanceRecord
} from "@gmvgang/affiliate-performance";
import type {
  AffiliatePerformancePersistenceDriver,
  AffiliatePerformanceQuery,
  AffiliatePerformanceStore,
  PersistedAffiliatePerformanceMeasurement
} from "./types.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireText(value: string | undefined, code: string): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function optionalText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

export function persistenceFingerprint(record: AffiliatePerformanceRecord): string {
  return sha256(performanceSemanticFingerprint(record));
}

export function persistenceCoverageKey(record: AffiliatePerformanceRecord): string {
  return sha256(performanceCoverageKey(record));
}

export function toPersistedAffiliatePerformanceMeasurement(
  input: AffiliatePerformanceRecord
): PersistedAffiliatePerformanceMeasurement {
  const record = normalizePerformanceRecord(input);
  const organizationId = requireText(
    record.dimensions.organizationId,
    "AFFILIATE_PERFORMANCE_ORGANIZATION_REQUIRED"
  );

  return {
    provider: record.source.provider,
    externalRecordId: record.source.externalRecordId,
    ...(record.source.connectionId ? { connectionId: record.source.connectionId } : {}),
    grain: record.grain,
    channel: record.channel,
    organizationId,
    ...(record.dimensions.brandId ? { brandId: record.dimensions.brandId } : {}),
    ...(record.dimensions.campaignId ? { campaignId: record.dimensions.campaignId } : {}),
    ...(record.dimensions.shopId ? { shopId: record.dimensions.shopId } : {}),
    ...(record.dimensions.productId ? { productId: record.dimensions.productId } : {}),
    ...(record.dimensions.creatorId ? { creatorId: record.dimensions.creatorId } : {}),
    ...(record.dimensions.contentId ? { contentId: record.dimensions.contentId } : {}),
    startDate: record.window.startDate,
    endDateExclusive: record.window.endDateExclusive,
    timeZone: record.window.timeZone,
    currency: record.currency,
    status: record.status,
    ...record.metrics,
    recordFingerprint: persistenceFingerprint(record),
    coverageKey: persistenceCoverageKey(record),
    firstObservedAt: record.observedAt,
    lastObservedAt: record.observedAt
  };
}

function metricsFromPersisted(row: PersistedAffiliatePerformanceMeasurement): AffiliatePerformanceMetrics {
  const metrics: AffiliatePerformanceMetrics = {};
  const set = (key: keyof AffiliatePerformanceMetrics, value: number | undefined) => {
    if (value !== undefined) metrics[key] = value;
  };
  set("gmv", row.gmv);
  set("orders", row.orders);
  set("unitsSold", row.unitsSold);
  set("commission", row.commission);
  set("refunds", row.refunds);
  set("refundedItems", row.refundedItems);
  set("impressions", row.impressions);
  set("clicks", row.clicks);
  set("addToCart", row.addToCart);
  set("views", row.views);
  set("creatorPosts", row.creatorPosts);
  return metrics;
}

export function fromPersistedAffiliatePerformanceMeasurement(
  row: PersistedAffiliatePerformanceMeasurement
): AffiliatePerformanceRecord {
  return normalizePerformanceRecord({
    source: {
      provider: row.provider,
      externalRecordId: row.externalRecordId,
      ...(row.connectionId ? { connectionId: row.connectionId } : {})
    },
    grain: row.grain,
    channel: row.channel,
    dimensions: {
      organizationId: row.organizationId,
      ...(row.brandId ? { brandId: row.brandId } : {}),
      ...(row.campaignId ? { campaignId: row.campaignId } : {}),
      ...(row.shopId ? { shopId: row.shopId } : {}),
      ...(row.productId ? { productId: row.productId } : {}),
      ...(row.creatorId ? { creatorId: row.creatorId } : {}),
      ...(row.contentId ? { contentId: row.contentId } : {})
    },
    window: {
      startDate: row.startDate,
      endDateExclusive: row.endDateExclusive,
      timeZone: row.timeZone
    },
    currency: row.currency,
    status: row.status,
    metrics: metricsFromPersisted(row),
    observedAt: row.lastObservedAt
  });
}

function normalizeQuery(input: AffiliatePerformanceQuery): AffiliatePerformanceQuery {
  const organizationId = requireText(input.organizationId, "AFFILIATE_PERFORMANCE_QUERY_ORGANIZATION_REQUIRED");
  const limit = input.limit ?? 200;
  if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
    throw new Error("AFFILIATE_PERFORMANCE_QUERY_LIMIT_INVALID");
  }
  if (
    input.startDateOnOrAfter &&
    input.endDateExclusiveOnOrBefore &&
    input.startDateOnOrAfter >= input.endDateExclusiveOnOrBefore
  ) {
    throw new Error("AFFILIATE_PERFORMANCE_QUERY_WINDOW_INVALID");
  }

  return {
    organizationId,
    ...(optionalText(input.brandId) ? { brandId: optionalText(input.brandId)! } : {}),
    ...(optionalText(input.campaignId) ? { campaignId: optionalText(input.campaignId)! } : {}),
    ...(input.grain ? { grain: input.grain } : {}),
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.startDateOnOrAfter ? { startDateOnOrAfter: input.startDateOnOrAfter } : {}),
    ...(input.endDateExclusiveOnOrBefore ? { endDateExclusiveOnOrBefore: input.endDateExclusiveOnOrBefore } : {}),
    limit
  };
}

export function createAffiliatePerformanceStore(
  driver: AffiliatePerformancePersistenceDriver
): AffiliatePerformanceStore {
  return {
    async saveBatch(inputRecords) {
      const normalized = normalizePerformanceBatch(inputRecords);
      let insertedRecords = 0;
      let duplicateRecords = 0;

      for (const record of normalized.records) {
        const measurement = toPersistedAffiliatePerformanceMeasurement(record);
        const insertResult = await driver.insert(measurement);
        if (insertResult === "inserted") {
          insertedRecords += 1;
          continue;
        }

        const existingIdentity = await driver.findByIdentity(
          measurement.provider,
          measurement.externalRecordId
        );
        if (existingIdentity) {
          if (existingIdentity.recordFingerprint !== measurement.recordFingerprint) {
            throw new Error(
              `AFFILIATE_PERFORMANCE_IDENTITY_CONFLICT:${measurement.provider}:${measurement.externalRecordId}`
            );
          }
          if (existingIdentity.coverageKey !== measurement.coverageKey) {
            throw new Error(
              `AFFILIATE_PERFORMANCE_IDENTITY_COVERAGE_CONFLICT:${measurement.provider}:${measurement.externalRecordId}`
            );
          }
          if (Date.parse(measurement.lastObservedAt) > Date.parse(existingIdentity.lastObservedAt)) {
            await driver.touchLastObservedAt(
              measurement.provider,
              measurement.externalRecordId,
              measurement.lastObservedAt
            );
          }
          duplicateRecords += 1;
          continue;
        }

        const existingCoverage = await driver.findByCoverage(measurement.coverageKey);
        if (existingCoverage) {
          throw new Error(
            `AFFILIATE_PERFORMANCE_COVERAGE_CONFLICT:${existingCoverage.provider}:${existingCoverage.externalRecordId}`
          );
        }

        throw new Error("AFFILIATE_PERFORMANCE_UNIQUE_CONFLICT_UNRESOLVED");
      }

      return {
        inputRecords: inputRecords.length,
        normalizedRecords: normalized.records.length,
        insertedRecords,
        duplicateRecords,
        duplicateRecordsDroppedInBatch: normalized.duplicateRecordsDropped
      };
    },

    async list(input) {
      const query = normalizeQuery(input);
      const rows = await driver.list(query);
      return rows.map(fromPersistedAffiliatePerformanceMeasurement);
    }
  };
}
