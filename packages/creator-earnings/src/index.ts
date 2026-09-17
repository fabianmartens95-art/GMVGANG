export type CreatorEarningsSourceEntry = {
  campaignId: string;
  campaignName: string;
  gmVCents: number;
  orders: number;
  recordedCommissionCents: number;
  updatedAt: string | null;
};

export type CreatorEarningsCampaign = {
  campaignId: string;
  campaignName: string;
  gmVCents: number;
  orders: number;
  recordedCommissionCents: number;
  updatedAt: string | null;
};

export type CreatorEarningsReadModel = {
  generatedAt: string;
  currency: string;
  settlement: {
    status: "not_available";
    message: string;
  };
  totals: {
    gmVCents: number;
    orders: number;
    recordedCommissionCents: number;
  };
  campaigns: CreatorEarningsCampaign[];
  updatedAt: string | null;
};

function assertNonNegativeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function latestTimestamp(values: readonly (string | null)[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latest = value;
      latestMs = ms;
    }
  }

  return latest;
}

export function buildCreatorEarningsReadModel(
  entries: readonly CreatorEarningsSourceEntry[],
  input: { generatedAt: string; currency: string },
): CreatorEarningsReadModel {
  assertTimestamp(input.generatedAt, "CREATOR_EARNINGS_GENERATED_AT_INVALID");
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("CREATOR_EARNINGS_CURRENCY_INVALID");

  const seen = new Set<string>();
  const campaigns = entries.map((entry): CreatorEarningsCampaign => {
    const campaignId = entry.campaignId.trim();
    const campaignName = entry.campaignName.trim();
    if (!campaignId || !campaignName) throw new Error("CREATOR_EARNINGS_CAMPAIGN_IDENTITY_REQUIRED");
    if (seen.has(campaignId)) throw new Error("CREATOR_EARNINGS_DUPLICATE_CAMPAIGN");
    seen.add(campaignId);

    assertNonNegativeInteger(entry.gmVCents, "CREATOR_EARNINGS_GMV_INVALID");
    assertNonNegativeInteger(entry.orders, "CREATOR_EARNINGS_ORDERS_INVALID");
    assertNonNegativeInteger(entry.recordedCommissionCents, "CREATOR_EARNINGS_COMMISSION_INVALID");
    if (entry.updatedAt) assertTimestamp(entry.updatedAt, "CREATOR_EARNINGS_UPDATED_AT_INVALID");

    return {
      campaignId,
      campaignName,
      gmVCents: entry.gmVCents,
      orders: entry.orders,
      recordedCommissionCents: entry.recordedCommissionCents,
      updatedAt: entry.updatedAt,
    };
  });

  campaigns.sort((left, right) =>
    right.recordedCommissionCents - left.recordedCommissionCents ||
    right.gmVCents - left.gmVCents ||
    left.campaignName.localeCompare(right.campaignName)
  );

  return {
    generatedAt: input.generatedAt,
    currency,
    settlement: {
      status: "not_available",
      message: "Aufgezeichnete Provisionen sind noch kein bestätigter oder ausgezahlter Betrag.",
    },
    totals: {
      gmVCents: campaigns.reduce((sum, item) => sum + item.gmVCents, 0),
      orders: campaigns.reduce((sum, item) => sum + item.orders, 0),
      recordedCommissionCents: campaigns.reduce((sum, item) => sum + item.recordedCommissionCents, 0),
    },
    campaigns,
    updatedAt: latestTimestamp(campaigns.map((item) => item.updatedAt)),
  };
}
