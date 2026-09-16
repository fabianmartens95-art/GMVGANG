import { aggregateAffiliatePerformance, derivePerformanceRatios } from "./aggregate.js";
import { normalizePerformanceBatch } from "./normalize.js";
import type {
  AffiliatePerformanceRecord,
  AggregatedPerformance,
  DerivedPerformanceRatios,
  PerformanceChannel,
  PerformanceGrain,
  PerformanceProvider,
  PerformanceWindow
} from "./types.js";

export interface AffiliatePerformanceReadScope {
  organizationId: string;
  brandId?: string;
  campaignId?: string;
  shopId?: string;
}

export interface AffiliatePerformanceReadSlice extends AggregatedPerformance {
  sliceKey: string;
  status: "provisional" | "final";
  firstObservedAt: string;
  lastObservedAt: string;
  ratios: DerivedPerformanceRatios;
}

export interface AffiliatePerformanceReadModel {
  scope: AffiliatePerformanceReadScope;
  slices: AffiliatePerformanceReadSlice[];
}

export interface AffiliatePerformanceSliceSelector {
  provider: PerformanceProvider;
  grain: PerformanceGrain;
  channel: PerformanceChannel;
  window: PerformanceWindow;
  currency: string;
}

function requireText(value: string | undefined, code: string): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function normalizeScope(input: AffiliatePerformanceReadScope): AffiliatePerformanceReadScope {
  return {
    organizationId: requireText(input.organizationId, "AFFILIATE_PERFORMANCE_SCOPE_ORGANIZATION_REQUIRED"),
    ...(input.brandId ? { brandId: requireText(input.brandId, "AFFILIATE_PERFORMANCE_SCOPE_BRAND_INVALID") } : {}),
    ...(input.campaignId ? { campaignId: requireText(input.campaignId, "AFFILIATE_PERFORMANCE_SCOPE_CAMPAIGN_INVALID") } : {}),
    ...(input.shopId ? { shopId: requireText(input.shopId, "AFFILIATE_PERFORMANCE_SCOPE_SHOP_INVALID") } : {})
  };
}

function assertRecordInScope(record: AffiliatePerformanceRecord, scope: AffiliatePerformanceReadScope): void {
  if (!record.dimensions.organizationId) throw new Error("AFFILIATE_PERFORMANCE_RECORD_ORGANIZATION_MISSING");
  if (record.dimensions.organizationId !== scope.organizationId) {
    throw new Error("AFFILIATE_PERFORMANCE_SCOPE_ORGANIZATION_MISMATCH");
  }
  if (scope.brandId && record.dimensions.brandId !== scope.brandId) {
    throw new Error("AFFILIATE_PERFORMANCE_SCOPE_BRAND_MISMATCH");
  }
  if (scope.campaignId && record.dimensions.campaignId !== scope.campaignId) {
    throw new Error("AFFILIATE_PERFORMANCE_SCOPE_CAMPAIGN_MISMATCH");
  }
  if (scope.shopId && record.dimensions.shopId !== scope.shopId) {
    throw new Error("AFFILIATE_PERFORMANCE_SCOPE_SHOP_MISMATCH");
  }
}

function sliceKey(record: AffiliatePerformanceRecord): string {
  return [
    record.source.provider,
    record.grain,
    record.channel,
    record.window.startDate,
    record.window.endDateExclusive,
    record.window.timeZone,
    record.currency
  ].join("|");
}

function minIso(values: readonly string[]): string {
  return [...values].sort((a, b) => Date.parse(a) - Date.parse(b))[0]!;
}

function maxIso(values: readonly string[]): string {
  return [...values].sort((a, b) => Date.parse(b) - Date.parse(a))[0]!;
}

export function buildAffiliatePerformanceReadModel(
  records: readonly AffiliatePerformanceRecord[],
  inputScope: AffiliatePerformanceReadScope
): AffiliatePerformanceReadModel {
  const scope = normalizeScope(inputScope);
  const normalized = normalizePerformanceBatch(records).records;
  const grouped = new Map<string, AffiliatePerformanceRecord[]>();

  for (const record of normalized) {
    assertRecordInScope(record, scope);
    const key = sliceKey(record);
    const group = grouped.get(key) ?? [];
    group.push(record);
    grouped.set(key, group);
  }

  const slices = [...grouped.entries()].map(([key, group]): AffiliatePerformanceReadSlice => {
    const aggregate = aggregateAffiliatePerformance(group);
    const observedAt = group.map((record) => record.observedAt);
    return {
      ...aggregate,
      sliceKey: key,
      status: group.every((record) => record.status === "final") ? "final" : "provisional",
      firstObservedAt: minIso(observedAt),
      lastObservedAt: maxIso(observedAt),
      ratios: derivePerformanceRatios(aggregate.metrics)
    };
  });

  slices.sort((a, b) => a.sliceKey.localeCompare(b.sliceKey));
  return { scope, slices };
}

export function findAffiliatePerformanceSlice(
  model: AffiliatePerformanceReadModel,
  selector: AffiliatePerformanceSliceSelector
): AffiliatePerformanceReadSlice | null {
  const currency = requireText(selector.currency, "AFFILIATE_PERFORMANCE_SELECTOR_CURRENCY_REQUIRED").toUpperCase();
  const matches = model.slices.filter((slice) =>
    slice.provider === selector.provider &&
    slice.grain === selector.grain &&
    slice.channel === selector.channel &&
    slice.currency === currency &&
    slice.window.startDate === selector.window.startDate &&
    slice.window.endDateExclusive === selector.window.endDateExclusive &&
    slice.window.timeZone === selector.window.timeZone
  );

  if (matches.length > 1) throw new Error("AFFILIATE_PERFORMANCE_SLICE_AMBIGUOUS");
  return matches[0] ?? null;
}

export function performanceSourceAgeMinutes(slice: AffiliatePerformanceReadSlice, asOf: string): number {
  const asOfMs = Date.parse(asOf);
  const observedMs = Date.parse(slice.lastObservedAt);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(observedMs)) {
    throw new Error("AFFILIATE_PERFORMANCE_SOURCE_AGE_TIMESTAMP_INVALID");
  }
  return Math.max(0, (asOfMs - observedMs) / 60_000);
}
