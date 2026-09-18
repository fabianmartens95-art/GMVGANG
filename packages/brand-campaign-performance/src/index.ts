export type BrandCampaignPerformanceSource = {
  campaignId: string;
  campaignName: string;
  creatorProfileId: string;
  gmvCents: number;
  orders: number;
  recordedCommissionCents: number;
  contentStatus: "not_started" | "briefed" | "in_progress" | "posted" | "cancelled";
  performanceUpdatedAt: string | null;
};

export type BrandCampaignPerformanceReadModel = {
  generatedAt: string;
  currency: string;
  totals: {
    gmvCents: number;
    orders: number;
    recordedCommissionCents: number;
    assignedCreators: number;
    postedCreators: number;
  };
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    gmvCents: number;
    orders: number;
    recordedCommissionCents: number;
    assignedCreators: number;
    postedCreators: number;
    performanceUpdatedAt: string | null;
  }>;
  economicsNotice: string;
};

function assertNonNegativeSafeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

function validateCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error("BRAND_PERFORMANCE_CURRENCY_INVALID");
  return normalized;
}

function latestTimestamp(values: Array<string | null>): string | null {
  let latest: number | null = null;
  let latestIso: string | null = null;

  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error("BRAND_PERFORMANCE_TIMESTAMP_INVALID");
    if (latest === null || parsed > latest) {
      latest = parsed;
      latestIso = new Date(parsed).toISOString();
    }
  }
  return latestIso;
}

export function buildBrandCampaignPerformance(input: {
  entries: BrandCampaignPerformanceSource[];
  currency: string;
  generatedAt: string;
}): BrandCampaignPerformanceReadModel {
  const generatedAtMs = Date.parse(input.generatedAt);
  if (!Number.isFinite(generatedAtMs)) throw new Error("BRAND_PERFORMANCE_GENERATED_AT_INVALID");

  const currency = validateCurrency(input.currency);
  const assignmentKeys = new Set<string>();
  const campaigns = new Map<string, {
    campaignId: string;
    campaignName: string;
    gmvCents: number;
    orders: number;
    recordedCommissionCents: number;
    creatorIds: Set<string>;
    postedCreatorIds: Set<string>;
    timestamps: Array<string | null>;
  }>();

  for (const entry of input.entries) {
    const campaignId = entry.campaignId.trim();
    const campaignName = entry.campaignName.trim();
    const creatorProfileId = entry.creatorProfileId.trim();

    if (!campaignId || !campaignName || !creatorProfileId) {
      throw new Error("BRAND_PERFORMANCE_IDENTITY_REQUIRED");
    }

    assertNonNegativeSafeInteger(entry.gmvCents, "BRAND_PERFORMANCE_GMV_INVALID");
    assertNonNegativeSafeInteger(entry.orders, "BRAND_PERFORMANCE_ORDERS_INVALID");
    assertNonNegativeSafeInteger(
      entry.recordedCommissionCents,
      "BRAND_PERFORMANCE_COMMISSION_INVALID",
    );

    const assignmentKey = `${campaignId}:${creatorProfileId}`;
    if (assignmentKeys.has(assignmentKey)) {
      throw new Error("BRAND_PERFORMANCE_DUPLICATE_ASSIGNMENT");
    }
    assignmentKeys.add(assignmentKey);

    if (entry.performanceUpdatedAt) {
      const parsed = Date.parse(entry.performanceUpdatedAt);
      if (!Number.isFinite(parsed)) throw new Error("BRAND_PERFORMANCE_TIMESTAMP_INVALID");
    }

    const existing = campaigns.get(campaignId) ?? {
      campaignId,
      campaignName,
      gmvCents: 0,
      orders: 0,
      recordedCommissionCents: 0,
      creatorIds: new Set<string>(),
      postedCreatorIds: new Set<string>(),
      timestamps: [],
    };

    if (existing.campaignName !== campaignName) {
      throw new Error("BRAND_PERFORMANCE_CAMPAIGN_NAME_CONFLICT");
    }

    existing.gmvCents += entry.gmvCents;
    existing.orders += entry.orders;
    existing.recordedCommissionCents += entry.recordedCommissionCents;
    existing.creatorIds.add(creatorProfileId);
    if (entry.contentStatus === "posted") existing.postedCreatorIds.add(creatorProfileId);
    existing.timestamps.push(entry.performanceUpdatedAt);
    campaigns.set(campaignId, existing);
  }

  const campaignRows = [...campaigns.values()].map((campaign) => ({
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    gmvCents: campaign.gmvCents,
    orders: campaign.orders,
    recordedCommissionCents: campaign.recordedCommissionCents,
    assignedCreators: campaign.creatorIds.size,
    postedCreators: campaign.postedCreatorIds.size,
    performanceUpdatedAt: latestTimestamp(campaign.timestamps),
  })).sort((a,b) =>
    b.gmvCents - a.gmvCents ||
    b.orders - a.orders ||
    a.campaignName.localeCompare(b.campaignName)
  );

  return {
    generatedAt: new Date(generatedAtMs).toISOString(),
    currency,
    totals: {
      gmvCents: campaignRows.reduce((sum,row)=>sum+row.gmvCents,0),
      orders: campaignRows.reduce((sum,row)=>sum+row.orders,0),
      recordedCommissionCents: campaignRows.reduce((sum,row)=>sum+row.recordedCommissionCents,0),
      assignedCreators: assignmentKeys.size,
      postedCreators: input.entries.filter((entry)=>entry.contentStatus==="posted").length,
    },
    campaigns: campaignRows,
    economicsNotice:
      "GMV, Orders und aufgezeichnete Creator-Provisionen sind Performance-Kennzahlen. Sie sind keine vollständige Profitabilitätsberechnung und enthalten insbesondere keine Retouren, Rabatte, COGS, Sample-Kosten, Adspend, Zahlungs-/Plattformgebühren oder sonstige Kosten.",
  };
}
