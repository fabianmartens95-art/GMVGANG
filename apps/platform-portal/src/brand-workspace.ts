import { buildBrandPortalReadModel, type BrandPortalDataStatus, type BrandPortalReadModel } from "./brand-read-model.js";

export type BrandOverviewResponse = {
  model: BrandPortalReadModel;
  source: "production" | "synthetic-development";
};

export interface BrandOverviewPort {
  getOverview(): Promise<BrandOverviewResponse | null>;
}

export type BrandOverviewHttpResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type BrandOverviewFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<BrandOverviewHttpResponse>;

const STATUS_VALUES: readonly BrandPortalDataStatus[] = ["ready", "partial", "unavailable"];
const PERFORMANCE_PROVIDERS = ["tiktok-shop-seller-analytics", "csv-import", "notion", "manual"] as const;
const PERFORMANCE_GRAINS = ["shop", "campaign", "creator", "product", "content"] as const;
const PERFORMANCE_CHANNELS = [
  "total", "affiliate-total", "affiliate-video", "affiliate-live", "seller-video", "seller-live",
  "seller-product-card", "shop-tab", "unknown",
] as const;
const PERFORMANCE_METRICS = [
  "gmv", "orders", "unitsSold", "commission", "refunds", "refundedItems", "impressions", "clicks",
  "addToCart", "views", "creatorPosts",
] as const;
const PERFORMANCE_RATIOS = ["ctr", "clickOrderRate", "aov", "refundRate", "gmvPerThousandViews"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validStatus(value: unknown): value is BrandPortalDataStatus {
  return typeof value === "string" && STATUS_VALUES.includes(value as BrandPortalDataStatus);
}

function optionalText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error("BRAND_OVERVIEW_PERFORMANCE_SCOPE_INVALID");
  return value;
}

function parseCostBreakdown(value: unknown): NonNullable<BrandPortalReadModel["profitability"]>["costBreakdown"] {
  if (!isRecord(value)) throw new Error("BRAND_OVERVIEW_COST_BREAKDOWN_INVALID");
  const keys = [
    "cogs", "fulfillmentCost", "affiliateCommissionCost", "paidMediaCost", "agencyFees", "paymentFees",
    "platformFees", "otherVariableCosts",
  ] as const;
  const parsed = {} as NonNullable<BrandPortalReadModel["profitability"]>["costBreakdown"];
  for (const key of keys) {
    if (!finiteNumber(value[key])) throw new Error("BRAND_OVERVIEW_COST_BREAKDOWN_INVALID");
    parsed[key] = value[key];
  }
  return parsed;
}

function parseProfitability(value: unknown): BrandPortalReadModel["profitability"] {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("BRAND_OVERVIEW_PROFITABILITY_INVALID");
  const numericKeys = [
    "grossMerchandiseValue", "realizedGrossRevenue", "netRevenue", "totalVariableCosts", "contribution", "contributionMargin",
  ] as const;
  for (const key of numericKeys) {
    if (!finiteNumber(value[key])) throw new Error("BRAND_OVERVIEW_PROFITABILITY_INVALID");
  }
  return {
    grossMerchandiseValue: value.grossMerchandiseValue as number,
    realizedGrossRevenue: value.realizedGrossRevenue as number,
    netRevenue: value.netRevenue as number,
    totalVariableCosts: value.totalVariableCosts as number,
    contribution: value.contribution as number,
    contributionMargin: value.contributionMargin as number,
    costBreakdown: parseCostBreakdown(value.costBreakdown),
  };
}

function parseActions(value: unknown): BrandPortalReadModel["nextBestActions"] {
  if (!Array.isArray(value)) throw new Error("BRAND_OVERVIEW_ACTIONS_INVALID");
  return value.map((candidate) => {
    if (
      !isRecord(candidate) || typeof candidate.id !== "string" ||
      !["critical", "high", "medium"].includes(String(candidate.priority)) || typeof candidate.category !== "string" ||
      typeof candidate.title !== "string" || typeof candidate.reason !== "string" ||
      typeof candidate.suggestedAction !== "string" || !isRecord(candidate.evidence)
    ) throw new Error("BRAND_OVERVIEW_ACTIONS_INVALID");

    const evidence: Record<string, number> = {};
    for (const [key, evidenceValue] of Object.entries(candidate.evidence)) {
      if (!finiteNumber(evidenceValue)) throw new Error("BRAND_OVERVIEW_ACTIONS_INVALID");
      evidence[key] = evidenceValue;
    }
    return {
      id: candidate.id,
      priority: candidate.priority as "critical" | "high" | "medium",
      category: candidate.category as BrandPortalReadModel["nextBestActions"][number]["category"],
      title: candidate.title,
      reason: candidate.reason,
      suggestedAction: candidate.suggestedAction,
      evidence,
    };
  });
}

function parsePerformance(value: unknown, organizationId: string): BrandPortalReadModel["performance"] {
  if (value === null) return null;
  if (!isRecord(value) || !isRecord(value.scope) || !Array.isArray(value.slices)) {
    throw new Error("BRAND_OVERVIEW_PERFORMANCE_INVALID");
  }
  if (value.scope.organizationId !== organizationId) throw new Error("BRAND_OVERVIEW_PERFORMANCE_TENANT_MISMATCH");
  const scope: NonNullable<BrandPortalReadModel["performance"]>["scope"] = {
    organizationId,
    ...(optionalText(value.scope, "brandId") ? { brandId: optionalText(value.scope, "brandId")! } : {}),
    ...(optionalText(value.scope, "campaignId") ? { campaignId: optionalText(value.scope, "campaignId")! } : {}),
    ...(optionalText(value.scope, "shopId") ? { shopId: optionalText(value.scope, "shopId")! } : {}),
  };

  const slices = value.slices.map((candidate) => {
    if (
      !isRecord(candidate) || typeof candidate.sliceKey !== "string" || !candidate.sliceKey ||
      !PERFORMANCE_PROVIDERS.includes(candidate.provider as (typeof PERFORMANCE_PROVIDERS)[number]) ||
      !PERFORMANCE_GRAINS.includes(candidate.grain as (typeof PERFORMANCE_GRAINS)[number]) ||
      !PERFORMANCE_CHANNELS.includes(candidate.channel as (typeof PERFORMANCE_CHANNELS)[number]) ||
      !isRecord(candidate.window) || typeof candidate.window.startDate !== "string" ||
      typeof candidate.window.endDateExclusive !== "string" || typeof candidate.window.timeZone !== "string" ||
      typeof candidate.currency !== "string" || !/^[A-Z]{3}$/.test(candidate.currency) ||
      !finiteNumber(candidate.recordCount) || candidate.recordCount < 0 ||
      !["final", "provisional"].includes(String(candidate.status)) ||
      typeof candidate.firstObservedAt !== "string" || typeof candidate.lastObservedAt !== "string" ||
      !isRecord(candidate.metrics) || !isRecord(candidate.completeness) || !isRecord(candidate.ratios)
    ) throw new Error("BRAND_OVERVIEW_PERFORMANCE_INVALID");

    const metrics: Record<string, number | null> = {};
    const completeness: Record<string, { records: number; totalRecords: number; ratio: number }> = {};
    for (const key of PERFORMANCE_METRICS) {
      const metric = candidate.metrics[key];
      if (metric !== null && !finiteNumber(metric)) throw new Error("BRAND_OVERVIEW_PERFORMANCE_INVALID");
      metrics[key] = metric as number | null;
      const coverage = candidate.completeness[key];
      if (!isRecord(coverage) || !finiteNumber(coverage.records) || !finiteNumber(coverage.totalRecords) || !finiteNumber(coverage.ratio)) {
        throw new Error("BRAND_OVERVIEW_PERFORMANCE_INVALID");
      }
      completeness[key] = {
        records: coverage.records as number,
        totalRecords: coverage.totalRecords as number,
        ratio: coverage.ratio as number,
      };
    }

    const ratios: Record<string, number | null> = {};
    for (const key of PERFORMANCE_RATIOS) {
      const ratio = candidate.ratios[key];
      if (ratio !== null && !finiteNumber(ratio)) throw new Error("BRAND_OVERVIEW_PERFORMANCE_INVALID");
      ratios[key] = ratio as number | null;
    }

    return {
      sliceKey: candidate.sliceKey,
      provider: candidate.provider,
      grain: candidate.grain,
      channel: candidate.channel,
      window: {
        startDate: candidate.window.startDate,
        endDateExclusive: candidate.window.endDateExclusive,
        timeZone: candidate.window.timeZone,
      },
      currency: candidate.currency,
      recordCount: candidate.recordCount,
      metrics,
      completeness,
      status: candidate.status,
      firstObservedAt: candidate.firstObservedAt,
      lastObservedAt: candidate.lastObservedAt,
      ratios,
    } as NonNullable<BrandPortalReadModel["performance"]>["slices"][number];
  });

  return { scope, slices };
}

export function parseBrandOverview(payload: unknown): BrandOverviewResponse {
  if (!isRecord(payload) || !isRecord(payload.model)) throw new Error("BRAND_OVERVIEW_PAYLOAD_INVALID");
  const model = payload.model;
  if (typeof model.organizationId !== "string" || !model.organizationId.trim() || typeof model.asOf !== "string" || !model.asOf.trim()) {
    throw new Error("BRAND_OVERVIEW_IDENTITY_INVALID");
  }
  if (!isRecord(model.dataStatus) || !isRecord(model.readiness)) throw new Error("BRAND_OVERVIEW_STATUS_INVALID");

  const statusKeys = ["profitability", "creatorOperations", "rights", "inventory", "paidPerformance", "affiliatePerformance"] as const;
  const dataStatus = {} as BrandPortalReadModel["dataStatus"];
  for (const key of statusKeys) {
    if (!validStatus(model.dataStatus[key])) throw new Error("BRAND_OVERVIEW_STATUS_INVALID");
    dataStatus[key] = model.dataStatus[key];
  }

  const readinessKeys = ["availableSections", "partialSections", "unavailableSections"] as const;
  for (const key of readinessKeys) {
    if (!finiteNumber(model.readiness[key]) || model.readiness[key] < 0) throw new Error("BRAND_OVERVIEW_READINESS_INVALID");
  }

  const source = payload.source === "synthetic-development" ? "synthetic-development" : payload.source === "production" ? "production" : null;
  if (!source) throw new Error("BRAND_OVERVIEW_SOURCE_INVALID");

  return {
    source,
    model: {
      organizationId: model.organizationId,
      asOf: model.asOf,
      profitability: parseProfitability(model.profitability),
      performance: parsePerformance(model.performance, model.organizationId),
      nextBestActions: parseActions(model.nextBestActions),
      dataStatus,
      readiness: {
        availableSections: model.readiness.availableSections as number,
        partialSections: model.readiness.partialSections as number,
        unavailableSections: model.readiness.unavailableSections as number,
      },
    },
  };
}

export class HttpBrandOverviewAdapter implements BrandOverviewPort {
  constructor(
    private readonly endpoint = "/api/brand/overview",
    private readonly fetchOverview: BrandOverviewFetch = (input, init) => fetch(input, init),
    private readonly organizationId?: string,
  ) {}

  async getOverview(): Promise<BrandOverviewResponse | null> {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.organizationId) headers["X-GMVGANG-Organization-Id"] = this.organizationId;
      const response = await this.fetchOverview(this.endpoint, { credentials: "include", cache: "no-store", headers });
      if (!response.ok) return null;
      return parseBrandOverview(await response.json());
    } catch {
      return null;
    }
  }
}

export class DevelopmentBrandOverviewAdapter implements BrandOverviewPort {
  constructor(private readonly organizationId: string) {}

  async getOverview(): Promise<BrandOverviewResponse> {
    const model = buildBrandPortalReadModel({
      organizationId: this.organizationId,
      asOf: new Date().toISOString(),
      profitability: {
        grossMerchandiseValue: 100000,
        vatRate: 0.19,
        refundsGross: 8000,
        discountsGross: 5000,
        cogs: 25000,
        fulfillmentCost: 5000,
        affiliateCommissionCost: 15000,
        paidMediaCost: 12000,
        agencyFees: 5000,
        paymentFees: 1800,
        platformFees: 900,
      },
      signals: {
        inventoryDaysOfCover: 11,
        expiringRights: { count: 3, nearestExpiryDays: 9 },
        reportedRoas: 2.1,
        pendingSampleApprovals: 7,
        stalledCreators: 4,
        sourceAgeMinutes: 8,
      },
      policy: {
        targetContributionMargin: 0.15,
        minimumInventoryDays: 14,
        rightsExpiryWarningDays: 14,
        maxDataAgeMinutes: 30,
        targetRoas: 2.5,
      },
      dataStatus: {
        profitability: "ready",
        creatorOperations: "partial",
        rights: "ready",
        inventory: "ready",
        paidPerformance: "partial",
        affiliatePerformance: "unavailable",
      },
    });
    return { model, source: "synthetic-development" };
  }
}

export async function loadBrandOverview(
  organizationId: string,
  port: BrandOverviewPort,
): Promise<BrandOverviewResponse | null> {
  const overview = await port.getOverview();
  if (!overview || overview.model.organizationId !== organizationId) return null;
  return overview;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function money(value: number, currencyCode = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value);
}

function percent(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function statusLabel(status: BrandPortalDataStatus): string {
  if (status === "ready") return "READY";
  if (status === "partial") return "PARTIAL";
  return "UNAVAILABLE";
}

function priorityClass(priority: "critical" | "high" | "medium"): string {
  return `brand-action__priority brand-action__priority--${priority}`;
}

function renderPerformance(model: BrandPortalReadModel): string {
  const performance = model.performance;
  if (!performance || performance.slices.length === 0) {
    return `<section class="brand-panel"><div class="brand-panel__header"><div><span class="eyebrow">AFFILIATE PERFORMANCE</span><h2>Messwerte</h2></div><span>NO DATA</span></div><p class="brand-panel__empty">Noch keine freigegebenen Affiliate-Performance-Messwerte verfügbar.</p></section>`;
  }

  return `<section class="brand-panel"><div class="brand-panel__header"><div><span class="eyebrow">AFFILIATE PERFORMANCE</span><h2>Getrennte Performance-Slices</h2></div><span>${performance.slices.length}</span></div>
    <p class="brand-panel__empty">Slices können sich überschneiden und werden deshalb nicht zu einer künstlichen Gesamt-GMV addiert.</p>
    <div class="brand-actions">${performance.slices.map((slice) => `<article class="brand-action">
      <div><span class="brand-action__category">${escapeHtml(slice.grain)} · ${escapeHtml(slice.channel)}</span><span>${escapeHtml(slice.status.toUpperCase())}</span></div>
      <h3>${slice.metrics.gmv === null ? "GMV —" : money(slice.metrics.gmv, slice.currency)}</h3>
      <p>${escapeHtml(slice.window.startDate)} bis ${escapeHtml(slice.window.endDateExclusive)} · ${slice.recordCount} Records</p>
      <strong>Orders ${slice.metrics.orders ?? "—"} · Units ${slice.metrics.unitsSold ?? "—"} · Views ${slice.metrics.views ?? "—"}${slice.ratios.aov === null ? "" : ` · AOV ${money(slice.ratios.aov, slice.currency)}`}</strong>
    </article>`).join("")}</div></section>`;
}

export function renderBrandOverview(overview: BrandOverviewResponse | null): string {
  if (!overview) {
    return `<section class="brand-empty"><div class="eyebrow">BRAND DATA BOUNDARY</div><h2>Brand-Daten noch nicht verbunden</h2><p>Der Workspace ist tenant-geschützt. Die Oberfläche zeigt erst Daten, sobald eine verifizierte serverseitige Brand-Datenquelle verfügbar ist.</p></section>`;
  }

  const { model } = overview;
  const profitability = model.profitability;
  const sourceBadge = overview.source === "synthetic-development" ? "BEISPIELDATEN" : "LIVE READ MODEL";
  const demoNotice = overview.source === "synthetic-development"
    ? `<aside class="brand-demo-notice" role="status"><strong>Beispieldaten</strong><span>Diese Werte sind synthetisch und stellen keine Live-Daten deiner Brand dar.</span></aside>` : "";
  const statusEntries: Array<[string, BrandPortalDataStatus]> = [
    ["Profitability", model.dataStatus.profitability],
    ["Creator Ops", model.dataStatus.creatorOperations],
    ["Rights", model.dataStatus.rights],
    ["Inventory", model.dataStatus.inventory],
    ["Paid Performance", model.dataStatus.paidPerformance],
    ["Affiliate Performance", model.dataStatus.affiliatePerformance],
  ];

  return `<section class="brand-overview" data-source="${overview.source}">
    <div class="brand-overview__meta"><span class="brand-overview__source">${sourceBadge}</span><span>As of ${escapeHtml(model.asOf)}</span></div>
    ${demoNotice}
    <section class="brand-kpis" aria-label="Profitability KPIs">
      <article><span>GMV</span><strong>${profitability ? money(profitability.grossMerchandiseValue) : "—"}</strong></article>
      <article><span>Net Revenue</span><strong>${profitability ? money(profitability.netRevenue) : "—"}</strong></article>
      <article><span>Contribution</span><strong>${profitability ? money(profitability.contribution) : "—"}</strong></article>
      <article><span>Contribution Margin</span><strong>${profitability ? percent(profitability.contributionMargin) : "—"}</strong></article>
    </section>
    <div class="brand-layout">
      <section class="brand-panel"><div class="brand-panel__header"><div><span class="eyebrow">PROFITABILITY CENTER</span><h2>Economics</h2></div><span>${profitability ? "CALCULATED" : "NO DATA"}</span></div>
        ${profitability ? `<div class="brand-costs">
          <div><span>COGS</span><strong>${money(profitability.costBreakdown.cogs)}</strong></div>
          <div><span>Fulfillment</span><strong>${money(profitability.costBreakdown.fulfillmentCost)}</strong></div>
          <div><span>Creator Provision</span><strong>${money(profitability.costBreakdown.affiliateCommissionCost)}</strong></div>
          <div><span>Paid Media</span><strong>${money(profitability.costBreakdown.paidMediaCost)}</strong></div>
          <div><span>Agency Fees</span><strong>${money(profitability.costBreakdown.agencyFees)}</strong></div>
          <div class="brand-costs__total"><span>Total Variable Costs</span><strong>${money(profitability.totalVariableCosts)}</strong></div>
        </div>` : `<p class="brand-panel__empty">Keine freigegebenen Profitability-Daten verfügbar.</p>`}
      </section>
      <section class="brand-panel"><div class="brand-panel__header"><div><span class="eyebrow">NEXT BEST ACTION</span><h2>Priorisierte Maßnahmen</h2></div><span>${model.nextBestActions.length}</span></div>
        <div class="brand-actions">${model.nextBestActions.length ? model.nextBestActions.map((action) => `<article class="brand-action">
          <div><span class="${priorityClass(action.priority)}">${action.priority.toUpperCase()}</span><span class="brand-action__category">${escapeHtml(action.category)}</span></div>
          <h3>${escapeHtml(action.title)}</h3><p>${escapeHtml(action.reason)}</p><strong>${escapeHtml(action.suggestedAction)}</strong>
        </article>`).join("") : `<p class="brand-panel__empty">Aktuell keine regelbasierten Maßnahmen.</p>`}</div>
      </section>
      ${renderPerformance(model)}
    </div>
    <section class="brand-coverage"><div><span class="eyebrow">DATA COVERAGE</span><strong>${model.readiness.availableSections} ready · ${model.readiness.partialSections} partial · ${model.readiness.unavailableSections} unavailable</strong></div>
      <div class="brand-coverage__grid">${statusEntries.map(([label, status]) => `<span class="brand-coverage__item brand-coverage__item--${status}"><b>${escapeHtml(label)}</b>${statusLabel(status)}</span>`).join("")}</div>
    </section>
  </section>`;
}

export function createBrandOverviewPort(organizationId: string): BrandOverviewPort {
  if (import.meta.env.DEV && String(import.meta.env.VITE_PLATFORM_DEV_BRAND_DEMO ?? "") === "1") {
    return new DevelopmentBrandOverviewAdapter(organizationId);
  }
  return new HttpBrandOverviewAdapter("/api/brand/overview", undefined, organizationId);
}
