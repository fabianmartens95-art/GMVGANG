import { describe, expect, it } from "vitest";
import {
  HttpBrandAffiliateVideoSummaryAdapter,
  parseBrandAffiliateVideoSummary,
  renderBrandAffiliateVideoSummary,
} from "../src/brand-affiliate-video-summary.js";

const metricKeys = [
  "gmv",
  "orders",
  "unitsSold",
  "commission",
  "refunds",
  "refundedItems",
  "impressions",
  "clicks",
  "addToCart",
  "views",
  "creatorPosts",
] as const;

const metrics = Object.fromEntries(
  metricKeys.map((key) => [key, null]),
) as Record<(typeof metricKeys)[number], number | null>;
metrics.gmv = 250.5;
metrics.orders = 5;
metrics.unitsSold = 6;
metrics.views = 12000;

const completeness = Object.fromEntries(
  metricKeys.map((key) => [key, metrics[key] === null ? 0 : 1]),
) as Record<(typeof metricKeys)[number], number>;

const SUMMARY = {
  scope: {
    organizationId: "org-1",
    brandId: "brand-1",
    campaignId: "campaign-1",
    shopId: "shop-1",
  },
  slice: {
    sliceKey: "tiktok|content|affiliate-video|window|EUR",
    provider: "tiktok-shop-seller-analytics",
    grain: "content",
    channel: "affiliate-video",
    window: {
      startDate: "2026-09-01",
      endDateExclusive: "2026-09-08",
      timeZone: "Europe/Berlin",
    },
    currency: "EUR",
    recordCount: 2,
    metrics,
    completeness,
    status: "final",
    firstObservedAt: "2026-09-09T06:00:00.000Z",
    lastObservedAt: "2026-09-09T07:00:00.000Z",
    ratios: {
      ctr: null,
      clickOrderRate: null,
      aov: 50.1,
      refundRate: null,
      gmvPerThousandViews: 20.875,
    },
  },
};

describe("Brand Affiliate Video Performance summary", () => {
  it("renders the canonical content × affiliate-video slice without profit claims", () => {
    const html = renderBrandAffiliateVideoSummary(
      parseBrandAffiliateVideoSummary(SUMMARY),
    );

    expect(html).toContain("Affiliate Video Performance");
    expect(html).toContain("12.000");
    expect(html).toContain("Performance, nicht Profitabilität");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-action");
  });

  it("rejects product totals, seller content and non-TikTok providers", () => {
    for (const override of [
      { grain: "product", channel: "affiliate-total" },
      { grain: "content", channel: "seller-video" },
      { provider: "csv-import" },
    ]) {
      expect(() => parseBrandAffiliateVideoSummary({
        ...SUMMARY,
        slice: { ...SUMMARY.slice, ...override },
      })).toThrow("BRAND_AFFILIATE_VIDEO_SLICE_INVALID");
    }
  });

  it("keeps incomplete metrics unavailable instead of converting them to zero", () => {
    const parsed = parseBrandAffiliateVideoSummary(SUMMARY);
    expect(parsed.slice.metrics.clicks).toBeNull();
    expect(renderBrandAffiliateVideoSummary(parsed)).toContain(
      "Nicht verfügbar",
    );

    expect(() => parseBrandAffiliateVideoSummary({
      ...SUMMARY,
      slice: {
        ...SUMMARY.slice,
        metrics: { ...SUMMARY.slice.metrics, clicks: 0 },
        completeness: { ...SUMMARY.slice.completeness, clicks: 0.5 },
      },
    })).toThrow("BRAND_AFFILIATE_VIDEO_COVERAGE_INCONSISTENT");
  });

  it("rejects Creator/video identity or per-record fields", () => {
    for (const extra of [
      { creatorId: "creator-1" },
      { contentId: "content-1" },
      { videoId: "video-1" },
      { creatorOpenId: "provider-open-id" },
      { username: "provider-user" },
    ]) {
      expect(() => parseBrandAffiliateVideoSummary({
        ...SUMMARY,
        slice: { ...SUMMARY.slice, ...extra },
      })).toThrow("BRAND_AFFILIATE_VIDEO_SLICE_INVALID");
    }
  });

  it("validates observation order and exact metric/completeness contracts", () => {
    expect(() => parseBrandAffiliateVideoSummary({
      ...SUMMARY,
      slice: {
        ...SUMMARY.slice,
        firstObservedAt: "2026-09-09T08:00:00.000Z",
      },
    })).toThrow("BRAND_AFFILIATE_VIDEO_TIMESTAMP_INVALID");

    const { views: _views, ...missingMetric } = SUMMARY.slice.metrics;
    expect(() => parseBrandAffiliateVideoSummary({
      ...SUMMARY,
      slice: {
        ...SUMMARY.slice,
        metrics: missingMetric,
      },
    })).toThrow("BRAND_AFFILIATE_VIDEO_METRICS_INVALID");
  });

  it("keeps organization selection in the authenticated workspace header", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandAffiliateVideoSummaryAdapter(
      "org-1",
      "/api/brand/performance/affiliate-video",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return SUMMARY; } };
      },
    );

    await expect(adapter.getSummary()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/performance/affiliate-video",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);
  });

  it("rejects cross-organization response scope", async () => {
    const adapter = new HttpBrandAffiliateVideoSummaryAdapter(
      "org-2",
      "/api/brand/performance/affiliate-video",
      async () => ({ ok: true, async json() { return SUMMARY; } }),
    );
    await expect(adapter.getSummary()).resolves.toBeNull();
  });
});
