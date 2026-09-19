import { describe, expect, it } from "vitest";

import { prepareBriefFromInsight } from "./insight-brief.js";

const observedInsight = {
  id: "insight-1",
  sourceType: "competitor_public_content" as const,
  evidenceClass: "observed" as const,
  sourceRef: "https://www.tiktok.com/@example/video/123",
  observedAt: "2026-09-19T06:00:00.000Z",
  pattern: {
    hook: "Lead with the concrete problem",
    angle: "Demonstrate the product in use",
    format: "short_demo",
  },
  metrics: [
    { key: "views" as const, value: 125000 },
    { key: "likes" as const, value: 8400 },
  ],
};

describe("Insight to Brief contract", () => {
  it("preserves observed provenance and keeps public metrics context-only", () => {
    expect(prepareBriefFromInsight(observedInsight)).toEqual({
      ok: true,
      brief: {
        sourceInsightId: "insight-1",
        provenance: {
          sourceType: "competitor_public_content",
          evidenceClass: "observed",
          sourceRef: "https://www.tiktok.com/@example/video/123",
          observedAt: "2026-09-19T06:00:00.000Z",
        },
        evidenceLabel: "observed_signal",
        hookDirection: "Lead with the concrete problem",
        angleDirection: "Demonstrate the product in use",
        formatDirection: "short_demo",
        referenceMetrics: [
          {
            key: "views",
            value: 125000,
            evidenceClass: "observed",
            use: "context_only",
          },
          {
            key: "likes",
            value: 8400,
            evidenceClass: "observed",
            use: "context_only",
          },
        ],
      },
    });
  });

  it("rejects competitor GMV, orders and conversion as unverified", () => {
    for (const metric of [
      { key: "gmv_cents" as const, value: 99900 },
      { key: "orders" as const, value: 42 },
      { key: "conversion_rate" as const, value: 0.12 },
    ]) {
      expect(
        prepareBriefFromInsight({
          ...observedInsight,
          metrics: [metric],
        }),
      ).toEqual({ ok: false, error: "INSIGHT_METRIC_NOT_VERIFIED" });
    }
  });

  it("does not allow public competitor evidence to masquerade as verified internal data", () => {
    expect(
      prepareBriefFromInsight({
        ...observedInsight,
        evidenceClass: "verified_internal",
      }),
    ).toEqual({ ok: false, error: "INSIGHT_PROVENANCE_INVALID" });
  });

  it("allows commerce metrics only from verified brand-owned performance", () => {
    const result = prepareBriefFromInsight({
      ...observedInsight,
      sourceType: "brand_owned_performance",
      evidenceClass: "verified_internal",
      sourceRef: "campaign:cmp-123",
      metrics: [
        { key: "gmv_cents", value: 99900 },
        { key: "orders", value: 42 },
        { key: "conversion_rate", value: 0.12 },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      brief: {
        evidenceLabel: "verified_internal_performance",
        referenceMetrics: [
          { key: "gmv_cents", use: "verified_internal" },
          { key: "orders", use: "verified_internal" },
          { key: "conversion_rate", use: "verified_internal" },
        ],
      },
    });
  });

  it("fails closed on missing provenance, malformed timestamps and invalid patterns", () => {
    expect(
      prepareBriefFromInsight({ ...observedInsight, sourceRef: " " }),
    ).toEqual({ ok: false, error: "INSIGHT_PROVENANCE_INVALID" });

    expect(
      prepareBriefFromInsight({ ...observedInsight, observedAt: "not-a-date" }),
    ).toEqual({ ok: false, error: "INSIGHT_TIMESTAMP_INVALID" });

    expect(
      prepareBriefFromInsight({
        ...observedInsight,
        pattern: { ...observedInsight.pattern, hook: " " },
      }),
    ).toEqual({ ok: false, error: "INSIGHT_PATTERN_INVALID" });
  });

  it("rejects invalid metric ranges", () => {
    expect(
      prepareBriefFromInsight({
        ...observedInsight,
        sourceType: "brand_owned_performance",
        evidenceClass: "verified_internal",
        metrics: [{ key: "conversion_rate", value: 1.2 }],
      }),
    ).toEqual({ ok: false, error: "INSIGHT_METRIC_INVALID" });
  });
});
