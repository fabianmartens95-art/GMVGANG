export type BrandCampaignAnalyticsCampaign = {
  campaignId: string;
  campaignName: string;
  gmvCents: number;
  orders: number;
  recordedCommissionCents: number;
  assignedCreators: number;
  postedCreators: number;
  performanceUpdatedAt: string | null;
};

export type BrandCampaignAnalyticsModel = {
  generatedAt: string;
  currency: string;
  totals: {
    gmvCents: number;
    orders: number;
    recordedCommissionCents: number;
    assignedCreators: number;
    postedCreators: number;
  };
  campaigns: BrandCampaignAnalyticsCampaign[];
  economicsNotice: string;
};

export type BrandCampaignAnalyticsResponse = { model: BrandCampaignAnalyticsModel };

export interface BrandCampaignAnalyticsPort {
  getAnalytics(): Promise<BrandCampaignAnalyticsResponse | null>;
}

type AnalyticsFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const FORBIDDEN_PROFIT_FIELDS = new Set([
  "profitCents",
  "profit",
  "netProfitCents",
  "contributionCents",
  "contributionMargin",
  "netRevenueCents",
]);

const CANONICAL_ECONOMICS_NOTICE =
  "GMV, Orders und aufgezeichnete Creator-Provisionen sind Performance-Kennzahlen. Sie sind keine vollständige Profitabilitätsberechnung und enthalten insbesondere keine Retouren, Rabatte, COGS, Sample-Kosten, Adspend, Zahlungs-/Plattformgebühren oder sonstige Kosten.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
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

function nonNegativeInteger(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function isoTimestamp(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function optionalTimestamp(value: unknown, code: string): string | null {
  if (value === null) return null;
  return isoTimestamp(value, code);
}

function assertNoProfitClaims(value: unknown): void {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PROFIT_FIELDS.has(key)) {
      throw new Error("BRAND_CAMPAIGN_ANALYTICS_PROFIT_CLAIM_FORBIDDEN");
    }
  }
}

function parseCampaign(value: unknown): BrandCampaignAnalyticsCampaign {
  if (!isRecord(value)) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID");
  }
  assertNoProfitClaims(value);
  if (
    !hasExactlyKeys(value, [
      "campaignId",
      "campaignName",
      "gmvCents",
      "orders",
      "recordedCommissionCents",
      "assignedCreators",
      "postedCreators",
      "performanceUpdatedAt",
    ])
  ) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID");
  }
  return {
    campaignId: requiredText(value.campaignId, "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID"),
    campaignName: requiredText(value.campaignName, "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID"),
    gmvCents: nonNegativeInteger(value.gmvCents, "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID"),
    orders: nonNegativeInteger(value.orders, "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID"),
    recordedCommissionCents: nonNegativeInteger(
      value.recordedCommissionCents,
      "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID",
    ),
    assignedCreators: nonNegativeInteger(
      value.assignedCreators,
      "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID",
    ),
    postedCreators: nonNegativeInteger(
      value.postedCreators,
      "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID",
    ),
    performanceUpdatedAt: optionalTimestamp(
      value.performanceUpdatedAt,
      "BRAND_CAMPAIGN_ANALYTICS_CAMPAIGN_INVALID",
    ),
  };
}

export function parseBrandCampaignAnalytics(
  payload: unknown,
): BrandCampaignAnalyticsResponse {
  if (
    !isRecord(payload) ||
    !hasExactlyKeys(payload, ["model"]) ||
    !isRecord(payload.model)
  ) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_PAYLOAD_INVALID");
  }

  const model = payload.model;
  assertNoProfitClaims(model);
  if (isRecord(model.totals)) assertNoProfitClaims(model.totals);

  if (
    !hasExactlyKeys(model, [
      "generatedAt",
      "currency",
      "totals",
      "campaigns",
      "economicsNotice",
    ]) ||
    !isRecord(model.totals) ||
    !hasExactlyKeys(model.totals, [
      "gmvCents",
      "orders",
      "recordedCommissionCents",
      "assignedCreators",
      "postedCreators",
    ]) ||
    !Array.isArray(model.campaigns)
  ) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_MODEL_INVALID");
  }

  const generatedAt = isoTimestamp(
    model.generatedAt,
    "BRAND_CAMPAIGN_ANALYTICS_GENERATED_AT_INVALID",
  );

  const currency = requiredText(
    model.currency,
    "BRAND_CAMPAIGN_ANALYTICS_CURRENCY_INVALID",
  ).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_CURRENCY_INVALID");
  }

  const campaigns = model.campaigns.map(parseCampaign);
  const ids = new Set<string>();
  for (const campaign of campaigns) {
    if (ids.has(campaign.campaignId)) {
      throw new Error("BRAND_CAMPAIGN_ANALYTICS_DUPLICATE_CAMPAIGN");
    }
    ids.add(campaign.campaignId);
    if (campaign.postedCreators > campaign.assignedCreators) {
      throw new Error("BRAND_CAMPAIGN_ANALYTICS_CREATOR_COUNTS_INVALID");
    }
    if (
      campaign.performanceUpdatedAt !== null &&
      Date.parse(campaign.performanceUpdatedAt) > Date.parse(generatedAt)
    ) {
      throw new Error("BRAND_CAMPAIGN_ANALYTICS_FRESHNESS_INVALID");
    }
  }

  const totals = {
    gmvCents: nonNegativeInteger(
      model.totals.gmvCents,
      "BRAND_CAMPAIGN_ANALYTICS_TOTALS_INVALID",
    ),
    orders: nonNegativeInteger(
      model.totals.orders,
      "BRAND_CAMPAIGN_ANALYTICS_TOTALS_INVALID",
    ),
    recordedCommissionCents: nonNegativeInteger(
      model.totals.recordedCommissionCents,
      "BRAND_CAMPAIGN_ANALYTICS_TOTALS_INVALID",
    ),
    assignedCreators: nonNegativeInteger(
      model.totals.assignedCreators,
      "BRAND_CAMPAIGN_ANALYTICS_TOTALS_INVALID",
    ),
    postedCreators: nonNegativeInteger(
      model.totals.postedCreators,
      "BRAND_CAMPAIGN_ANALYTICS_TOTALS_INVALID",
    ),
  };
  if (totals.postedCreators > totals.assignedCreators) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_CREATOR_COUNTS_INVALID");
  }

  const campaignTotals = campaigns.reduce(
    (sum, campaign) => ({
      gmvCents: sum.gmvCents + campaign.gmvCents,
      orders: sum.orders + campaign.orders,
      recordedCommissionCents:
        sum.recordedCommissionCents + campaign.recordedCommissionCents,
      assignedCreators: sum.assignedCreators + campaign.assignedCreators,
      postedCreators: sum.postedCreators + campaign.postedCreators,
    }),
    {
      gmvCents: 0,
      orders: 0,
      recordedCommissionCents: 0,
      assignedCreators: 0,
      postedCreators: 0,
    },
  );

  if (
    !Number.isSafeInteger(campaignTotals.gmvCents) ||
    !Number.isSafeInteger(campaignTotals.orders) ||
    !Number.isSafeInteger(campaignTotals.recordedCommissionCents) ||
    campaignTotals.gmvCents !== totals.gmvCents ||
    campaignTotals.orders !== totals.orders ||
    campaignTotals.recordedCommissionCents !== totals.recordedCommissionCents
  ) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_TOTALS_INCONSISTENT");
  }

  const maxCampaignAssignedCreators = campaigns.reduce(
    (max, campaign) => Math.max(max, campaign.assignedCreators),
    0,
  );
  const maxCampaignPostedCreators = campaigns.reduce(
    (max, campaign) => Math.max(max, campaign.postedCreators),
    0,
  );

  if (
    !Number.isSafeInteger(campaignTotals.assignedCreators) ||
    !Number.isSafeInteger(campaignTotals.postedCreators) ||
    totals.assignedCreators < maxCampaignAssignedCreators ||
    totals.assignedCreators > campaignTotals.assignedCreators ||
    totals.postedCreators < maxCampaignPostedCreators ||
    totals.postedCreators > campaignTotals.postedCreators
  ) {
    throw new Error("BRAND_CAMPAIGN_ANALYTICS_CREATOR_COUNTS_INVALID");
  }

  requiredText(
    model.economicsNotice,
    "BRAND_CAMPAIGN_ANALYTICS_NOTICE_REQUIRED",
  );

  return {
    model: {
      generatedAt,
      currency,
      totals,
      campaigns,
      economicsNotice: CANONICAL_ECONOMICS_NOTICE,
    },
  };
}

export class HttpBrandCampaignAnalyticsAdapter implements BrandCampaignAnalyticsPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/campaign-performance",
    private readonly request: AnalyticsFetch = (input, init) => fetch(input, init),
  ) {}

  async getAnalytics(): Promise<BrandCampaignAnalyticsResponse | null> {
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
      return parseBrandCampaignAnalytics(await response.json());
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

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function renderBrandCampaignAnalytics(
  response: BrandCampaignAnalyticsResponse | null,
): string {
  if (!response) {
    return `<section class="brand-core-analytics brand-core-analytics--empty"><span class="eyebrow">CAMPAIGN ANALYTICS</span><h2>Noch keine Campaign-Daten verfügbar</h2><p>Der Bereich bleibt leer, bis organization-bound Performance serverseitig verfügbar ist.</p></section>`;
  }

  const { model } = response;
  const campaigns = model.campaigns.length
    ? model.campaigns.map((campaign) => `<article class="brand-core-analytics__campaign">
        <div><strong>${escapeHtml(campaign.campaignName)}</strong><span>${campaign.performanceUpdatedAt ? escapeHtml(campaign.performanceUpdatedAt) : "Noch kein Performance-Zeitstempel"}</span></div>
        <div><span>GMV ${money(campaign.gmvCents, model.currency)}</span><span>${campaign.orders} Orders</span><span>Recorded Commission ${money(campaign.recordedCommissionCents, model.currency)}</span><span>${campaign.postedCreators}/${campaign.assignedCreators} Creator posted</span></div>
      </article>`).join("")
    : `<p class="brand-core-analytics__empty-state">Noch keine Campaign-Zeilen vorhanden.</p>`;

  return `<section class="brand-core-analytics">
    <div class="brand-core-analytics__header"><div><span class="eyebrow">CAMPAIGN ANALYTICS</span><h2>Commerce-Performance</h2></div><span>${escapeHtml(model.currency)}</span></div>
    <div class="brand-core-analytics__totals">
      <article><span>GMV</span><strong>${money(model.totals.gmvCents, model.currency)}</strong></article>
      <article><span>Orders</span><strong>${model.totals.orders}</strong></article>
      <article><span>Recorded Commission</span><strong>${money(model.totals.recordedCommissionCents, model.currency)}</strong></article>
      <article><span>Posted Creators</span><strong>${model.totals.postedCreators}/${model.totals.assignedCreators}</strong></article>
    </div>
    <div class="brand-core-analytics__notice"><strong>Performance ≠ Profit</strong><span>${escapeHtml(model.economicsNotice)}</span></div>
    <div class="brand-core-analytics__campaigns">${campaigns}</div>
  </section>`;
}
