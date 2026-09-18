import {
  buildCreatorEarningsReadModel,
  type CreatorEarningsReadModel,
  type CreatorEarningsSourceEntry,
} from "@gmvgang/creator-earnings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function nonNegativeInteger(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("CREATOR_NATIVE_EARNINGS_UPDATED_AT_INVALID");
  }
  return value;
}

function campaignJoin(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!isRecord(candidate)) throw new Error("CREATOR_NATIVE_EARNINGS_CAMPAIGN_JOIN_INVALID");
  return candidate;
}

export type NativeCreatorEarningsInput = {
  creatorProfileId: string;
  generatedAt: string;
  currency: string;
  rows: readonly unknown[];
};

export function buildNativeCreatorEarnings(
  input: NativeCreatorEarningsInput,
): CreatorEarningsReadModel {
  const creatorProfileId = input.creatorProfileId.trim();
  if (!creatorProfileId) throw new Error("CREATOR_NATIVE_EARNINGS_CREATOR_REQUIRED");

  const entries: CreatorEarningsSourceEntry[] = input.rows.map((value) => {
    if (!isRecord(value)) throw new Error("CREATOR_NATIVE_EARNINGS_ROW_INVALID");

    const rowCreatorProfileId = requiredText(
      value.creator_profile_id,
      "CREATOR_NATIVE_EARNINGS_CREATOR_REQUIRED",
    );
    if (rowCreatorProfileId !== creatorProfileId) {
      throw new Error("CREATOR_NATIVE_EARNINGS_OWNERSHIP_MISMATCH");
    }

    const campaignId = requiredText(
      value.campaign_id,
      "CREATOR_NATIVE_EARNINGS_CAMPAIGN_ID_REQUIRED",
    );
    const campaign = campaignJoin(value.campaigns);
    const joinedCampaignId = requiredText(
      campaign.id,
      "CREATOR_NATIVE_EARNINGS_CAMPAIGN_JOIN_INVALID",
    );
    if (joinedCampaignId !== campaignId) {
      throw new Error("CREATOR_NATIVE_EARNINGS_CAMPAIGN_JOIN_INVALID");
    }

    return {
      campaignId,
      campaignName: requiredText(
        campaign.name,
        "CREATOR_NATIVE_EARNINGS_CAMPAIGN_JOIN_INVALID",
      ),
      gmVCents: nonNegativeInteger(value.gmv_cents, "CREATOR_NATIVE_EARNINGS_GMV_INVALID"),
      orders: nonNegativeInteger(value.orders, "CREATOR_NATIVE_EARNINGS_ORDERS_INVALID"),
      recordedCommissionCents: nonNegativeInteger(
        value.commission_cents,
        "CREATOR_NATIVE_EARNINGS_COMMISSION_INVALID",
      ),
      updatedAt: nullableTimestamp(value.performance_updated_at ?? value.updated_at),
    };
  });

  return buildCreatorEarningsReadModel(entries, {
    generatedAt: input.generatedAt,
    currency: input.currency,
  });
}
