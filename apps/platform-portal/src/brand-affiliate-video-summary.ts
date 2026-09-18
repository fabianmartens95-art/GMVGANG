export type BrandAffiliateVideoMetric =
  | "gmv"
  | "orders"
  | "unitsSold"
  | "commission"
  | "refunds"
  | "refundedItems"
  | "impressions"
  | "clicks"
  | "addToCart"
  | "views"
  | "creatorPosts";

export type BrandAffiliateVideoMetrics = Record<
  BrandAffiliateVideoMetric,
  number | null
>;

export type BrandAffiliateVideoCompleteness = Record<
  BrandAffiliateVideoMetric,
  number
>;

export type BrandAffiliateVideoRatios = {
  ctr: number | null;
  clickOrderRate: number | null;
  aov: number | null;
  refundRate: number | null;
  gmvPerThousandViews: number | null;
};

export type BrandAffiliateVideoSummary = {
  scope: {
    organizationId: string;
    brandId?: string;
    campaignId?: string;
    shopId?: string;
  };
  slice: {
    sliceKey: string;
    provider: "tiktok-shop-seller-analytics";
    grain: "content";
    channel: "affiliate-video";
    window: {
      startDate: string;
      endDateExclusive: string;
      timeZone: string;
    };
    currency: string;
    recordCount: number;
    metrics: BrandAffiliateVideoMetrics;
    completeness: BrandAffiliateVideoCompleteness;
    status: "provisional" | "final";
    firstObservedAt: string;
    lastObservedAt: string;
    ratios: BrandAffiliateVideoRatios;
  };
};

export interface BrandAffiliateVideoSummaryPort {
  getSummary(): Promise<BrandAffiliateVideoSummary | null>;
}

type SummaryFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const METRICS: readonly BrandAffiliateVideoMetric[] = [
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
];

const RATIOS = [
  "ctr",
  "clickOrderRate",
  "aov",
  "refundRate",
  "gmvPerThousandViews",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasExactlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return hasOnlyKeys(value, keys) && Object.keys(value).length === keys.length;
}

function requiredText(
  value: unknown,
  maxLength: number,
  code: string,
): string {
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error(code);
  return cleaned;
}

function optionalText(
  value: unknown,
  maxLength: number,
  code: string,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, maxLength, code);
}

function currency(value: unknown): string {
  const normalized = requiredText(
    value,
    3,
    "BRAND_AFFILIATE_VIDEO_CURRENCY_INVALID",
  ).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_CURRENCY_INVALID");
  }
  return normalized;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_AFFILIATE_VIDEO_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

function dateOnly(value: unknown): string {
  const text = requiredText(
    value,
    10,
    "BRAND_AFFILIATE_VIDEO_WINDOW_INVALID",
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_WINDOW_INVALID");
  }
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_WINDOW_INVALID");
  }
  return text;
}

function nonNegativeNumberOrNull(
  value: unknown,
  code: string,
): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function parseMetrics(
  value: unknown,
): BrandAffiliateVideoMetrics {
  if (!isRecord(value) || !hasExactlyKeys(value, METRICS)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_METRICS_INVALID");
  }

  const result = {} as BrandAffiliateVideoMetrics;
  for (const key of METRICS) {
    result[key] = nonNegativeNumberOrNull(
      value[key],
      "BRAND_AFFILIATE_VIDEO_METRICS_INVALID",
    );
  }
  return result;
}

function parseCompleteness(
  value: unknown,
): BrandAffiliateVideoCompleteness {
  if (!isRecord(value) || !hasExactlyKeys(value, METRICS)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_COMPLETENESS_INVALID");
  }

  const result = {} as BrandAffiliateVideoCompleteness;
  for (const key of METRICS) {
    const current = value[key];
    if (
      typeof current !== "number" ||
      !Number.isFinite(current) ||
      current < 0 ||
      current > 1
    ) {
      throw new Error("BRAND_AFFILIATE_VIDEO_COMPLETENESS_INVALID");
    }
    result[key] = current;
  }
  return result;
}

function parseRatios(
  value: unknown,
): BrandAffiliateVideoRatios {
  if (!isRecord(value) || !hasExactlyKeys(value, RATIOS)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_RATIOS_INVALID");
  }

  return {
    ctr: nonNegativeNumberOrNull(
      value.ctr,
      "BRAND_AFFILIATE_VIDEO_RATIOS_INVALID",
    ),
    clickOrderRate: nonNegativeNumberOrNull(
      value.clickOrderRate,
      "BRAND_AFFILIATE_VIDEO_RATIOS_INVALID",
    ),
    aov: nonNegativeNumberOrNull(
      value.aov,
      "BRAND_AFFILIATE_VIDEO_RATIOS_INVALID",
    ),
    refundRate: nonNegativeNumberOrNull(
      value.refundRate,
      "BRAND_AFFILIATE_VIDEO_RATIOS_INVALID",
    ),
    gmvPerThousandViews: nonNegativeNumberOrNull(
      value.gmvPerThousandViews,
      "BRAND_AFFILIATE_VIDEO_RATIOS_INVALID",
    ),
  };
}

function assertCompletenessConsistency(
  metrics: BrandAffiliateVideoMetrics,
  completeness: BrandAffiliateVideoCompleteness,
): void {
  for (const key of METRICS) {
    if (
      (completeness[key] === 1 && metrics[key] === null) ||
      (completeness[key] < 1 && metrics[key] !== null)
    ) {
      throw new Error("BRAND_AFFILIATE_VIDEO_COVERAGE_INCONSISTENT");
    }
  }
}

export function parseBrandAffiliateVideoSummary(
  payload: unknown,
): BrandAffiliateVideoSummary {
  if (
    !isRecord(payload) ||
    !hasExactlyKeys(payload, ["scope", "slice"]) ||
    !isRecord(payload.scope) ||
    !hasOnlyKeys(payload.scope, [
      "organizationId",
      "brandId",
      "campaignId",
      "shopId",
    ]) ||
    !isRecord(payload.slice)
  ) {
    throw new Error("BRAND_AFFILIATE_VIDEO_PAYLOAD_INVALID");
  }

  const organizationId = requiredText(
    payload.scope.organizationId,
    128,
    "BRAND_AFFILIATE_VIDEO_SCOPE_INVALID",
  );
  const brandId = optionalText(
    payload.scope.brandId,
    128,
    "BRAND_AFFILIATE_VIDEO_SCOPE_INVALID",
  );
  const campaignId = optionalText(
    payload.scope.campaignId,
    128,
    "BRAND_AFFILIATE_VIDEO_SCOPE_INVALID",
  );
  const shopId = optionalText(
    payload.scope.shopId,
    128,
    "BRAND_AFFILIATE_VIDEO_SCOPE_INVALID",
  );

  const slice = payload.slice;
  if (
    !hasExactlyKeys(slice, [
      "sliceKey",
      "provider",
      "grain",
      "channel",
      "window",
      "currency",
      "recordCount",
      "metrics",
      "completeness",
      "status",
      "firstObservedAt",
      "lastObservedAt",
      "ratios",
    ]) ||
    slice.provider !== "tiktok-shop-seller-analytics" ||
    slice.grain !== "content" ||
    slice.channel !== "affiliate-video" ||
    !isRecord(slice.window) ||
    !hasExactlyKeys(slice.window, [
      "startDate",
      "endDateExclusive",
      "timeZone",
    ]) ||
    (slice.status !== "provisional" && slice.status !== "final") ||
    !Number.isSafeInteger(slice.recordCount) ||
    (slice.recordCount as number) < 1
  ) {
    throw new Error("BRAND_AFFILIATE_VIDEO_SLICE_INVALID");
  }

  const startDate = dateOnly(slice.window.startDate);
  const endDateExclusive = dateOnly(slice.window.endDateExclusive);
  if (
    Date.parse(`${endDateExclusive}T00:00:00.000Z`) <=
    Date.parse(`${startDate}T00:00:00.000Z`)
  ) {
    throw new Error("BRAND_AFFILIATE_VIDEO_WINDOW_INVALID");
  }

  const firstObservedAt = timestamp(slice.firstObservedAt);
  const lastObservedAt = timestamp(slice.lastObservedAt);
  if (Date.parse(lastObservedAt) < Date.parse(firstObservedAt)) {
    throw new Error("BRAND_AFFILIATE_VIDEO_TIMESTAMP_INVALID");
  }

  const metrics = parseMetrics(slice.metrics);
  const completeness = parseCompleteness(slice.completeness);
  assertCompletenessConsistency(metrics, completeness);

  return {
    scope: {
      organizationId,
      ...(brandId ? { brandId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(shopId ? { shopId } : {}),
    },
    slice: {
      sliceKey: requiredText(
        slice.sliceKey,
        1024,
        "BRAND_AFFILIATE_VIDEO_SLICE_INVALID",
      ),
      provider: "tiktok-shop-seller-analytics",
      grain: "content",
      channel: "affiliate-video",
      window: {
        startDate,
        endDateExclusive,
        timeZone: requiredText(
          slice.window.timeZone,
          128,
          "BRAND_AFFILIATE_VIDEO_WINDOW_INVALID",
        ),
      },
      currency: currency(slice.currency),
      recordCount: slice.recordCount as number,
      metrics,
      completeness,
      status: slice.status,
      firstObservedAt,
      lastObservedAt,
      ratios: parseRatios(slice.ratios),
    },
  };
}

export class HttpBrandAffiliateVideoSummaryAdapter
implements BrandAffiliateVideoSummaryPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/performance/affiliate-video",
    private readonly request: SummaryFetch = (input, init) =>
      fetch(input, init),
  ) {}

  async getSummary(): Promise<BrandAffiliateVideoSummary | null> {
    if (!this.organizationId.trim()) return null;
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": this.organizationId,
        },
      });
      if (!response.ok) return null;
      const parsed = parseBrandAffiliateVideoSummary(await response.json());
      return parsed.scope.organizationId === this.organizationId
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number | null, code: string): string {
  if (value === null) return "Nicht verfügbar";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: code,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

function count(value: number | null): string {
  return value === null
    ? "Nicht verfügbar"
    : new Intl.NumberFormat("de-DE").format(value);
}

export function renderBrandAffiliateVideoSummary(
  response: BrandAffiliateVideoSummary | null,
): string {
  if (!response) {
    return `<section class="brand-affiliate-video brand-affiliate-video--empty"><span class="eyebrow">CONTENT PERFORMANCE</span><h2>Affiliate-Video-Performance nicht verfügbar</h2><p>Es werden keine Metriken als 0 interpretiert, wenn der kanonische Performance-Slice nicht vollständig verfügbar ist.</p></section>`;
  }

  const { slice } = response;
  const gpm = slice.ratios.gmvPerThousandViews === null
    ? "Nicht verfügbar"
    : money(slice.ratios.gmvPerThousandViews, slice.currency);

  return `<section class="brand-affiliate-video">
    <div class="brand-affiliate-video__header">
      <div><span class="eyebrow">CONTENT PERFORMANCE</span><h2>Affiliate Video Performance</h2><p>${escapeHtml(slice.window.startDate)} bis ${escapeHtml(slice.window.endDateExclusive)} · ${escapeHtml(slice.window.timeZone)}</p></div>
      <span class="brand-affiliate-video__status">${slice.status === "final" ? "Final" : "Provisional"}</span>
    </div>
    <div class="brand-affiliate-video__metrics">
      <article><span>GMV</span><strong>${escapeHtml(money(slice.metrics.gmv, slice.currency))}</strong></article>
      <article><span>Orders</span><strong>${escapeHtml(count(slice.metrics.orders))}</strong></article>
      <article><span>Units sold</span><strong>${escapeHtml(count(slice.metrics.unitsSold))}</strong></article>
      <article><span>Views</span><strong>${escapeHtml(count(slice.metrics.views))}</strong></article>
      <article><span>GMV / 1.000 Views</span><strong>${escapeHtml(gpm)}</strong></article>
    </div>
    <div class="brand-affiliate-video__meta">
      <span>${slice.recordCount} normalisierte Content-Records</span>
      <span>Letzte Beobachtung: ${escapeHtml(slice.lastObservedAt)}</span>
    </div>
    <p class="brand-affiliate-video__notice">Affiliate-Video-Daten bleiben getrennt von überlappenden Produkt-Total-Slices. Diese Ansicht ist Performance, nicht Profitabilität.</p>
  </section>`;
}
