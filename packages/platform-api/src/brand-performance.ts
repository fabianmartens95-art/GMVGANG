import {
  PERFORMANCE_METRIC_FIELDS,
  buildAffiliatePerformanceReadModel,
  performanceSourceAgeMinutes,
  type PerformanceMetricField,
} from "@gmvgang/affiliate-performance";
import type { AffiliatePerformanceStore } from "@gmvgang/affiliate-performance-supabase";
import {
  unavailableBrandPortalReadModel,
  type BrandPortalDataStatus,
  type BrandPortalDataStatusMap,
  type BrandPortalReadModel,
} from "@gmvgang/brand-intelligence/portal";
import type { BrandOverviewReadPort } from "./types.js";

export type BrandAffiliatePerformancePolicy = {
  lookbackDays: number;
  maxRecords: number;
  minimumCoverageRatio: number;
  maxSourceAgeMinutes: number;
  requiredMetrics: readonly PerformanceMetricField[];
};

function assertPositiveInteger(value: number, code: string, maximum?: number): void {
  if (!Number.isInteger(value) || value <= 0 || (maximum !== undefined && value > maximum)) {
    throw new Error(code);
  }
}

function normalizePolicy(input: BrandAffiliatePerformancePolicy): BrandAffiliatePerformancePolicy {
  assertPositiveInteger(input.lookbackDays, "BRAND_AFFILIATE_PERFORMANCE_LOOKBACK_INVALID", 3650);
  assertPositiveInteger(input.maxRecords, "BRAND_AFFILIATE_PERFORMANCE_MAX_RECORDS_INVALID", 1000);
  if (!Number.isFinite(input.minimumCoverageRatio) || input.minimumCoverageRatio <= 0 || input.minimumCoverageRatio > 1) {
    throw new Error("BRAND_AFFILIATE_PERFORMANCE_COVERAGE_INVALID");
  }
  if (!Number.isFinite(input.maxSourceAgeMinutes) || input.maxSourceAgeMinutes <= 0) {
    throw new Error("BRAND_AFFILIATE_PERFORMANCE_SOURCE_AGE_INVALID");
  }
  if (!Array.isArray(input.requiredMetrics) || input.requiredMetrics.length === 0) {
    throw new Error("BRAND_AFFILIATE_PERFORMANCE_REQUIRED_METRICS_INVALID");
  }

  const requiredMetrics = [...new Set(input.requiredMetrics)];
  for (const metric of requiredMetrics) {
    if (!PERFORMANCE_METRIC_FIELDS.includes(metric)) {
      throw new Error("BRAND_AFFILIATE_PERFORMANCE_REQUIRED_METRICS_INVALID");
    }
  }

  return {
    lookbackDays: input.lookbackDays,
    maxRecords: input.maxRecords,
    minimumCoverageRatio: input.minimumCoverageRatio,
    maxSourceAgeMinutes: input.maxSourceAgeMinutes,
    requiredMetrics,
  };
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function brandAffiliatePerformanceWindow(now: string, lookbackDays: number): {
  startDate: string;
  endDateExclusive: string;
} {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error("BRAND_AFFILIATE_PERFORMANCE_NOW_INVALID");
  assertPositiveInteger(lookbackDays, "BRAND_AFFILIATE_PERFORMANCE_LOOKBACK_INVALID", 3650);

  const todayUtc = new Date(nowMs);
  todayUtc.setUTCHours(0, 0, 0, 0);
  const end = addUtcDays(todayUtc, 1);
  const start = addUtcDays(end, -lookbackDays);
  return { startDate: isoDate(start), endDateExclusive: isoDate(end) };
}

function affiliatePerformanceStatus(
  model: NonNullable<BrandPortalReadModel["performance"]>,
  now: string,
  policy: BrandAffiliatePerformancePolicy,
  potentiallyTruncated: boolean,
): BrandPortalDataStatus {
  if (model.slices.length === 0) return "unavailable";
  if (potentiallyTruncated) return "partial";

  for (const slice of model.slices) {
    if (slice.status !== "final") return "partial";
    if (performanceSourceAgeMinutes(slice, now) > policy.maxSourceAgeMinutes) return "partial";
    for (const metric of policy.requiredMetrics) {
      if (slice.completeness[metric] < policy.minimumCoverageRatio) return "partial";
    }
  }

  return "ready";
}

function readiness(dataStatus: BrandPortalDataStatusMap): BrandPortalReadModel["readiness"] {
  const values = Object.values(dataStatus);
  return {
    availableSections: values.filter((status) => status === "ready").length,
    partialSections: values.filter((status) => status === "partial").length,
    unavailableSections: values.filter((status) => status === "unavailable").length,
  };
}

export function createAffiliatePerformanceBrandOverviewReadPort(
  store: AffiliatePerformanceStore,
  inputPolicy: BrandAffiliatePerformancePolicy,
): BrandOverviewReadPort {
  const policy = normalizePolicy(inputPolicy);

  return {
    async getOverview(input) {
      const base = unavailableBrandPortalReadModel(input.organizationId, input.now);
      const window = brandAffiliatePerformanceWindow(input.now, policy.lookbackDays);
      const records = await store.list({
        organizationId: input.organizationId,
        startDateOnOrAfter: window.startDate,
        endDateExclusiveOnOrBefore: window.endDateExclusive,
        limit: policy.maxRecords,
      });

      if (records.length === 0) return base;

      const performance = buildAffiliatePerformanceReadModel(records, {
        organizationId: input.organizationId,
      });
      const status = affiliatePerformanceStatus(
        performance,
        input.now,
        policy,
        records.length >= policy.maxRecords,
      );
      const dataStatus: BrandPortalDataStatusMap = {
        ...base.dataStatus,
        affiliatePerformance: status,
      };

      return {
        ...base,
        performance,
        dataStatus,
        readiness: readiness(dataStatus),
      };
    },
  };
}
