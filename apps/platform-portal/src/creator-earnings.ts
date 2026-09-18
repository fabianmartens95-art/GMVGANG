export type CreatorEarningsCampaignView = {
  campaignId: string;
  campaignName: string;
  gmvCents: number;
  orders: number;
  recordedCommissionCents: number;
  updatedAt: string | null;
};

export type CreatorEarningsViewModel = {
  generatedAt: string;
  updatedAt: string | null;
  currency: string;
  totals: {
    gmvCents: number;
    orders: number;
    recordedCommissionCents: number;
  };
  campaigns: CreatorEarningsCampaignView[];
  settlement: {
    status: "not_available";
    message: string;
  };
};

export type CreatorEarningsResponse = {
  model: CreatorEarningsViewModel;
};

export interface CreatorEarningsPort {
  getEarnings(): Promise<CreatorEarningsResponse | null>;
}

type CreatorEarningsFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const FORBIDDEN_SETTLEMENT_FIELDS = new Set([
  "paidCents",
  "withdrawableCents",
  "availableBalanceCents",
  "balanceCents",
  "payoutCents",
]);

const CANONICAL_SETTLEMENT_MESSAGE =
  "Aufgezeichnete Provisionen sind noch kein bestätigter oder ausgezahlter Betrag.";

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

function safeInteger(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function timestamp(value: unknown, code: string): string {
  const text = requiredText(value, code);
  if (!Number.isFinite(Date.parse(text))) throw new Error(code);
  return new Date(Date.parse(text)).toISOString();
}

function nullableTimestamp(value: unknown, code: string): string | null {
  if (value === null) return null;
  return timestamp(value, code);
}

function assertNoSettlementClaims(value: unknown): void {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_SETTLEMENT_FIELDS.has(key)) {
      throw new Error("CREATOR_EARNINGS_SETTLEMENT_CLAIM_FORBIDDEN");
    }
  }
}

function parseCampaign(value: unknown): CreatorEarningsCampaignView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "campaignId",
      "campaignName",
      "gmvCents",
      "orders",
      "recordedCommissionCents",
      "updatedAt",
    ])
  ) {
    throw new Error("CREATOR_EARNINGS_CAMPAIGN_INVALID");
  }
  assertNoSettlementClaims(value);
  return {
    campaignId: requiredText(value.campaignId, "CREATOR_EARNINGS_CAMPAIGN_INVALID"),
    campaignName: requiredText(value.campaignName, "CREATOR_EARNINGS_CAMPAIGN_INVALID"),
    gmvCents: safeInteger(value.gmvCents, "CREATOR_EARNINGS_CAMPAIGN_INVALID"),
    orders: safeInteger(value.orders, "CREATOR_EARNINGS_CAMPAIGN_INVALID"),
    recordedCommissionCents: safeInteger(
      value.recordedCommissionCents,
      "CREATOR_EARNINGS_CAMPAIGN_INVALID",
    ),
    updatedAt: nullableTimestamp(value.updatedAt, "CREATOR_EARNINGS_CAMPAIGN_INVALID"),
  };
}

export function parseCreatorEarningsResponse(payload: unknown): CreatorEarningsResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["model"]) ||
    !isRecord(payload.model)
  ) {
    throw new Error("CREATOR_EARNINGS_PAYLOAD_INVALID");
  }

  const model = payload.model;
  assertNoSettlementClaims(model);
  if (isRecord(model.totals)) assertNoSettlementClaims(model.totals);
  if (isRecord(model.settlement)) assertNoSettlementClaims(model.settlement);

  if (
    !hasOnlyKeys(model, [
      "generatedAt",
      "updatedAt",
      "currency",
      "totals",
      "campaigns",
      "settlement",
    ]) ||
    !isRecord(model.totals) ||
    !hasOnlyKeys(model.totals, [
      "gmvCents",
      "orders",
      "recordedCommissionCents",
    ]) ||
    !Array.isArray(model.campaigns) ||
    !isRecord(model.settlement) ||
    !hasOnlyKeys(model.settlement, ["status", "message"])
  ) {
    throw new Error("CREATOR_EARNINGS_MODEL_INVALID");
  }

  const currency = requiredText(model.currency, "CREATOR_EARNINGS_CURRENCY_INVALID").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("CREATOR_EARNINGS_CURRENCY_INVALID");

  if (model.settlement.status !== "not_available") {
    throw new Error("CREATOR_EARNINGS_SETTLEMENT_STATE_INVALID");
  }

  const campaigns = model.campaigns.map(parseCampaign);
  const campaignIds = new Set<string>();
  for (const campaign of campaigns) {
    if (campaignIds.has(campaign.campaignId)) {
      throw new Error("CREATOR_EARNINGS_DUPLICATE_CAMPAIGN");
    }
    campaignIds.add(campaign.campaignId);
  }

  const totals = {
    gmvCents: safeInteger(
      model.totals.gmvCents,
      "CREATOR_EARNINGS_TOTALS_INVALID",
    ),
    orders: safeInteger(
      model.totals.orders,
      "CREATOR_EARNINGS_TOTALS_INVALID",
    ),
    recordedCommissionCents: safeInteger(
      model.totals.recordedCommissionCents,
      "CREATOR_EARNINGS_TOTALS_INVALID",
    ),
  };

  const summed = campaigns.reduce(
    (result, campaign) => ({
      gmvCents: result.gmvCents + campaign.gmvCents,
      orders: result.orders + campaign.orders,
      recordedCommissionCents:
        result.recordedCommissionCents + campaign.recordedCommissionCents,
    }),
    { gmvCents: 0, orders: 0, recordedCommissionCents: 0 },
  );
  if (
    !Number.isSafeInteger(summed.gmvCents) ||
    !Number.isSafeInteger(summed.orders) ||
    !Number.isSafeInteger(summed.recordedCommissionCents) ||
    summed.gmvCents !== totals.gmvCents ||
    summed.orders !== totals.orders ||
    summed.recordedCommissionCents !== totals.recordedCommissionCents
  ) {
    throw new Error("CREATOR_EARNINGS_TOTALS_INCONSISTENT");
  }

  const generatedAt = timestamp(
    model.generatedAt,
    "CREATOR_EARNINGS_GENERATED_AT_INVALID",
  );
  const updatedAt = nullableTimestamp(
    model.updatedAt,
    "CREATOR_EARNINGS_UPDATED_AT_INVALID",
  );
  const latestCampaignUpdatedAt = campaigns.reduce<string | null>(
    (latest, campaign) => {
      if (!campaign.updatedAt) return latest;
      if (!latest || Date.parse(campaign.updatedAt) > Date.parse(latest)) {
        return campaign.updatedAt;
      }
      return latest;
    },
    null,
  );
  if (
    updatedAt !== latestCampaignUpdatedAt ||
    (updatedAt !== null && Date.parse(updatedAt) > Date.parse(generatedAt))
  ) {
    throw new Error("CREATOR_EARNINGS_FRESHNESS_INCONSISTENT");
  }

  requiredText(
    model.settlement.message,
    "CREATOR_EARNINGS_SETTLEMENT_STATE_INVALID",
  );

  return {
    model: {
      generatedAt,
      updatedAt,
      currency,
      totals,
      campaigns,
      settlement: {
        status: "not_available",
        message: CANONICAL_SETTLEMENT_MESSAGE,
      },
    },
  };
}

export class HttpCreatorEarningsAdapter implements CreatorEarningsPort {
  constructor(
    private readonly endpoint = "/api/creator/earnings",
    private readonly request: CreatorEarningsFetch = (input, init) => fetch(input, init),
  ) {}

  async getEarnings(): Promise<CreatorEarningsResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorEarningsResponse(await response.json());
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

export function renderCreatorEarnings(response: CreatorEarningsResponse | null): string {
  if (!response) {
    return `<section class="creator-earnings creator-earnings--empty"><span class="eyebrow">EARNINGS</span><h2>Noch keine Earnings-Daten verfügbar</h2><p>Aufgezeichnete Campaign-Performance erscheint hier, sobald sie deinem Account serverseitig zugeordnet werden kann.</p></section>`;
  }

  const { model } = response;
  const campaigns = model.campaigns.length
    ? model.campaigns.map((campaign) => `<article class="creator-earnings__campaign">
        <div><strong>${escapeHtml(campaign.campaignName)}</strong><span>${campaign.updatedAt ? escapeHtml(campaign.updatedAt) : "Noch kein Performance-Zeitstempel"}</span></div>
        <div><span>GMV ${money(campaign.gmvCents, model.currency)}</span><span>${campaign.orders} Orders</span><span>Recorded Commission ${money(campaign.recordedCommissionCents, model.currency)}</span></div>
      </article>`).join("")
    : `<p class="creator-earnings__empty-state">Noch keine Campaign-Earnings aufgezeichnet.</p>`;

  return `<section class="creator-earnings">
    <div class="creator-earnings__header"><div><span class="eyebrow">EARNINGS</span><h2>Aufgezeichnete Commerce-Performance</h2></div><span>${escapeHtml(model.currency)}</span></div>
    <div class="creator-earnings__totals">
      <article><span>GMV</span><strong>${money(model.totals.gmvCents, model.currency)}</strong></article>
      <article><span>Orders</span><strong>${model.totals.orders}</strong></article>
      <article><span>Recorded Commission</span><strong>${money(model.totals.recordedCommissionCents, model.currency)}</strong></article>
    </div>
    <div class="creator-earnings__notice"><strong>Nicht gleich Auszahlung</strong><span>${escapeHtml(model.settlement.message)}</span></div>
    <div class="creator-earnings__campaigns">${campaigns}</div>
  </section>`;
}
