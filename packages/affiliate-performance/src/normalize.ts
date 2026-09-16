import {
  PERFORMANCE_METRIC_FIELDS,
  type AffiliatePerformanceMetrics,
  type AffiliatePerformanceRecord,
  type NormalizedPerformanceBatch,
  type PerformanceDimensions,
  type PerformanceGrain
} from "./types.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

function requireText(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function requireDate(value: string, label: string): string {
  if (!DATE_ONLY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be an ISO date (YYYY-MM-DD)`);
  }
  return value;
}

function requireTimestamp(value: string, label: string): string {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp`);
  return value;
}

function normalizeDimensions(input: PerformanceDimensions): PerformanceDimensions {
  const result: PerformanceDimensions = {};
  const set = (key: keyof PerformanceDimensions, value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) result[key] = trimmed;
  };
  set("organizationId", input.organizationId);
  set("brandId", input.brandId);
  set("campaignId", input.campaignId);
  set("shopId", input.shopId);
  set("productId", input.productId);
  set("creatorId", input.creatorId);
  set("contentId", input.contentId);
  return result;
}

const REQUIRED_DIMENSION: Record<PerformanceGrain, keyof PerformanceDimensions> = {
  shop: "shopId",
  campaign: "campaignId",
  creator: "creatorId",
  product: "productId",
  content: "contentId"
};

function normalizeMetrics(input: AffiliatePerformanceMetrics): AffiliatePerformanceMetrics {
  const metrics: AffiliatePerformanceMetrics = {};
  for (const field of PERFORMANCE_METRIC_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`metrics.${field} must be a finite non-negative number`);
    }
    metrics[field] = value;
  }
  if (Object.keys(metrics).length === 0) throw new Error("at least one performance metric is required");
  return metrics;
}

export function normalizePerformanceRecord(input: AffiliatePerformanceRecord): AffiliatePerformanceRecord {
  const startDate = requireDate(input.window.startDate, "window.startDate");
  const endDateExclusive = requireDate(input.window.endDateExclusive, "window.endDateExclusive");
  if (startDate >= endDateExclusive) throw new Error("performance window must end after it starts");

  const currency = requireText(input.currency, "currency").toUpperCase();
  if (!CURRENCY.test(currency)) throw new Error("currency must be a three-letter ISO-style code");

  const dimensions = normalizeDimensions(input.dimensions ?? {});
  const requiredDimension = REQUIRED_DIMENSION[input.grain];
  if (!dimensions[requiredDimension]) {
    throw new Error(`${requiredDimension} is required for ${input.grain} grain`);
  }

  const connectionId = input.source.connectionId?.trim();
  return {
    source: {
      provider: input.source.provider,
      externalRecordId: requireText(input.source.externalRecordId, "source.externalRecordId"),
      ...(connectionId ? { connectionId } : {})
    },
    grain: input.grain,
    channel: input.channel,
    dimensions,
    window: {
      startDate,
      endDateExclusive,
      timeZone: requireText(input.window.timeZone, "window.timeZone")
    },
    currency,
    status: input.status,
    metrics: normalizeMetrics(input.metrics),
    observedAt: requireTimestamp(input.observedAt, "observedAt")
  };
}

export function performanceRecordIdentity(record: AffiliatePerformanceRecord): string {
  return `${record.source.provider}:${record.source.externalRecordId}`;
}

export function performanceCoverageKey(record: AffiliatePerformanceRecord): string {
  const dimensions = record.dimensions;
  return [
    record.source.provider,
    record.grain,
    record.channel,
    record.window.startDate,
    record.window.endDateExclusive,
    record.window.timeZone,
    record.currency,
    dimensions.organizationId ?? "",
    dimensions.brandId ?? "",
    dimensions.campaignId ?? "",
    dimensions.shopId ?? "",
    dimensions.productId ?? "",
    dimensions.creatorId ?? "",
    dimensions.contentId ?? ""
  ].join("|");
}

/**
 * Semantic fingerprint intentionally excludes observedAt. Re-fetching the same
 * provider measurement later is a duplicate observation, not a changed business value.
 */
export function performanceSemanticFingerprint(record: AffiliatePerformanceRecord): string {
  const { observedAt: _observedAt, ...semantic } = record;
  return JSON.stringify(semantic);
}

export function normalizePerformanceBatch(input: readonly AffiliatePerformanceRecord[]): NormalizedPerformanceBatch {
  const byIdentity = new Map<string, string>();
  const byCoverage = new Map<string, string>();
  const records: AffiliatePerformanceRecord[] = [];
  let duplicateRecordsDropped = 0;

  for (const raw of input) {
    const record = normalizePerformanceRecord(raw);
    const key = performanceRecordIdentity(record);
    const fingerprint = performanceSemanticFingerprint(record);
    const existingFingerprint = byIdentity.get(key);

    if (existingFingerprint) {
      if (existingFingerprint !== fingerprint) {
        throw new Error(`conflicting performance record for ${key}`);
      }
      duplicateRecordsDropped += 1;
      continue;
    }

    const coverage = performanceCoverageKey(record);
    const existingCoverageIdentity = byCoverage.get(coverage);
    if (existingCoverageIdentity && existingCoverageIdentity !== key) {
      throw new Error(`overlapping performance coverage for ${coverage}`);
    }

    byIdentity.set(key, fingerprint);
    byCoverage.set(coverage, key);
    records.push(record);
  }

  return { records, duplicateRecordsDropped };
}
