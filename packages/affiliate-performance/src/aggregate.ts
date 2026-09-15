import { normalizePerformanceBatch } from "./normalize.js";
import {
  PERFORMANCE_METRIC_FIELDS,
  type AffiliatePerformanceRecord,
  type AggregatedPerformance,
  type DerivedPerformanceRatios,
  type PerformanceMetricField
} from "./types.js";

function sameWindow(a: AffiliatePerformanceRecord, b: AffiliatePerformanceRecord): boolean {
  return (
    a.window.startDate === b.window.startDate &&
    a.window.endDateExclusive === b.window.endDateExclusive &&
    a.window.timeZone === b.window.timeZone
  );
}

export function aggregateAffiliatePerformance(input: readonly AffiliatePerformanceRecord[]): AggregatedPerformance {
  const normalized = normalizePerformanceBatch(input).records;
  const first = normalized[0];
  if (!first) throw new Error("at least one performance record is required");

  for (const record of normalized.slice(1)) {
    if (record.source.provider !== first.source.provider) throw new Error("cannot aggregate mixed providers");
    if (record.grain !== first.grain) throw new Error("cannot aggregate mixed grains");
    if (record.channel !== first.channel) throw new Error("cannot aggregate mixed channels");
    if (record.currency !== first.currency) throw new Error("cannot aggregate mixed currencies");
    if (!sameWindow(record, first)) throw new Error("cannot aggregate different performance windows");
  }

  const metrics = {} as Record<PerformanceMetricField, number | null>;
  const completeness = {} as Record<PerformanceMetricField, number>;

  for (const field of PERFORMANCE_METRIC_FIELDS) {
    const values = normalized
      .map((record) => record.metrics[field])
      .filter((value): value is number => value !== undefined);
    completeness[field] = values.length / normalized.length;
    metrics[field] = values.length === normalized.length
      ? values.reduce((sum, value) => sum + value, 0)
      : null;
  }

  return {
    provider: first.source.provider,
    grain: first.grain,
    channel: first.channel,
    window: { ...first.window },
    currency: first.currency,
    recordCount: normalized.length,
    metrics,
    completeness
  };
}

function divide(numerator: number | null, denominator: number | null, multiplier = 1): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return (numerator / denominator) * multiplier;
}

export function derivePerformanceRatios(
  metrics: Record<PerformanceMetricField, number | null>
): DerivedPerformanceRatios {
  return {
    ctr: divide(metrics.clicks, metrics.impressions),
    clickOrderRate: divide(metrics.orders, metrics.clicks),
    aov: divide(metrics.gmv, metrics.orders),
    refundRate: divide(metrics.refunds, metrics.gmv),
    gmvPerThousandViews: divide(metrics.gmv, metrics.views, 1000)
  };
}
