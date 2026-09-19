export type InsightSourceType =
  | "competitor_public_content"
  | "category_observation"
  | "brand_owned_performance";

export type InsightEvidenceClass = "observed" | "verified_internal";

export type InsightMetricKey =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "orders"
  | "gmv_cents"
  | "conversion_rate";

export type InsightMetric = {
  key: InsightMetricKey;
  value: number;
};

export type CreativeInsight = {
  id: string;
  sourceType: InsightSourceType;
  evidenceClass: InsightEvidenceClass;
  sourceRef: string;
  observedAt: string;
  pattern: {
    hook: string;
    angle: string;
    format: string;
  };
  metrics?: readonly InsightMetric[];
};

export type InsightBriefDraft = {
  sourceInsightId: string;
  provenance: {
    sourceType: InsightSourceType;
    evidenceClass: InsightEvidenceClass;
    sourceRef: string;
    observedAt: string;
  };
  evidenceLabel: "observed_signal" | "verified_internal_performance";
  hookDirection: string;
  angleDirection: string;
  formatDirection: string;
  referenceMetrics: readonly (InsightMetric & {
    evidenceClass: InsightEvidenceClass;
    use: "context_only" | "verified_internal";
  })[];
};

export type PrepareInsightBriefResult =
  | { ok: true; brief: InsightBriefDraft }
  | {
      ok: false;
      error:
        | "INSIGHT_ID_INVALID"
        | "INSIGHT_PROVENANCE_INVALID"
        | "INSIGHT_TIMESTAMP_INVALID"
        | "INSIGHT_PATTERN_INVALID"
        | "INSIGHT_METRIC_INVALID"
        | "INSIGHT_METRIC_NOT_VERIFIED";
    };

const OBSERVABLE_PUBLIC_METRICS = new Set<InsightMetricKey>([
  "views",
  "likes",
  "comments",
  "shares",
]);

const INTERNAL_COMMERCE_METRICS = new Set<InsightMetricKey>([
  "orders",
  "gmv_cents",
  "conversion_rate",
]);

function boundedText(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function validMetric(metric: InsightMetric): boolean {
  if (!Number.isFinite(metric.value) || metric.value < 0) return false;
  if (metric.key === "conversion_rate" && metric.value > 1) return false;
  return true;
}

export function prepareBriefFromInsight(
  insight: CreativeInsight,
): PrepareInsightBriefResult {
  const id = boundedText(insight.id, 128);
  if (!id) return { ok: false, error: "INSIGHT_ID_INVALID" };

  const sourceRef = boundedText(insight.sourceRef, 2048);
  const observedAt = Date.parse(insight.observedAt);
  if (!sourceRef) return { ok: false, error: "INSIGHT_PROVENANCE_INVALID" };
  if (!Number.isFinite(observedAt)) {
    return { ok: false, error: "INSIGHT_TIMESTAMP_INVALID" };
  }

  const sourceIsInternal = insight.sourceType === "brand_owned_performance";
  if (
    (insight.evidenceClass === "verified_internal" && !sourceIsInternal) ||
    (insight.evidenceClass === "observed" && sourceIsInternal)
  ) {
    return { ok: false, error: "INSIGHT_PROVENANCE_INVALID" };
  }

  const hook = boundedText(insight.pattern.hook, 500);
  const angle = boundedText(insight.pattern.angle, 500);
  const format = boundedText(insight.pattern.format, 200);
  if (!hook || !angle || !format) {
    return { ok: false, error: "INSIGHT_PATTERN_INVALID" };
  }

  const metrics = insight.metrics ?? [];
  for (const metric of metrics) {
    if (!validMetric(metric)) {
      return { ok: false, error: "INSIGHT_METRIC_INVALID" };
    }
    if (
      insight.evidenceClass === "observed" &&
      (!OBSERVABLE_PUBLIC_METRICS.has(metric.key) ||
        INTERNAL_COMMERCE_METRICS.has(metric.key))
    ) {
      return { ok: false, error: "INSIGHT_METRIC_NOT_VERIFIED" };
    }
  }

  return {
    ok: true,
    brief: {
      sourceInsightId: id,
      provenance: {
        sourceType: insight.sourceType,
        evidenceClass: insight.evidenceClass,
        sourceRef,
        observedAt: new Date(observedAt).toISOString(),
      },
      evidenceLabel:
        insight.evidenceClass === "verified_internal"
          ? "verified_internal_performance"
          : "observed_signal",
      hookDirection: hook,
      angleDirection: angle,
      formatDirection: format,
      referenceMetrics: metrics.map((metric) => ({
        ...metric,
        evidenceClass: insight.evidenceClass,
        use:
          insight.evidenceClass === "verified_internal"
            ? "verified_internal"
            : "context_only",
      })),
    },
  };
}
