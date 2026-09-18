import {
  buildBrandCampaignPerformance,
  type BrandCampaignPerformanceReadModel,
  type BrandCampaignPerformanceSource,
} from "@gmvgang/brand-campaign-performance";

const CONTENT_STATUSES = new Set([
  "not_started",
  "briefed",
  "in_progress",
  "posted",
  "cancelled",
]);

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

function optionalTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_NATIVE_PERFORMANCE_TIMESTAMP_INVALID");
  }
  return value;
}

function campaignJoin(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!isRecord(candidate)) throw new Error("BRAND_NATIVE_PERFORMANCE_CAMPAIGN_JOIN_INVALID");
  return candidate;
}

export type NativeBrandCampaignPerformanceInput = {
  organizationId: string;
  generatedAt: string;
  currency: string;
  hasAnalyticsBasic: boolean;
  rows: readonly unknown[];
};

export function buildNativeBrandCampaignPerformance(
  input: NativeBrandCampaignPerformanceInput,
): BrandCampaignPerformanceReadModel {
  const organizationId = input.organizationId.trim();
  if (!organizationId) throw new Error("BRAND_NATIVE_PERFORMANCE_ORGANIZATION_REQUIRED");
  if (!input.hasAnalyticsBasic) throw new Error("BRAND_ANALYTICS_BASIC_REQUIRED");

  const entries: BrandCampaignPerformanceSource[] = input.rows.map((value) => {
    if (!isRecord(value)) throw new Error("BRAND_NATIVE_PERFORMANCE_ROW_INVALID");

    const campaignId = requiredText(value.campaign_id, "BRAND_NATIVE_PERFORMANCE_CAMPAIGN_ID_REQUIRED");
    const creatorProfileId = requiredText(
      value.creator_profile_id,
      "BRAND_NATIVE_PERFORMANCE_CREATOR_ID_REQUIRED",
    );
    const campaign = campaignJoin(value.campaigns);
    const joinedCampaignId = requiredText(
      campaign.id,
      "BRAND_NATIVE_PERFORMANCE_CAMPAIGN_JOIN_INVALID",
    );
    const joinedOrganizationId = requiredText(
      campaign.organization_id,
      "BRAND_NATIVE_PERFORMANCE_CAMPAIGN_JOIN_INVALID",
    );
    const campaignName = requiredText(
      campaign.name,
      "BRAND_NATIVE_PERFORMANCE_CAMPAIGN_JOIN_INVALID",
    );

    if (joinedCampaignId !== campaignId || joinedOrganizationId !== organizationId) {
      throw new Error("BRAND_NATIVE_PERFORMANCE_TENANT_MISMATCH");
    }

    const contentStatus = requiredText(
      value.content_status,
      "BRAND_NATIVE_PERFORMANCE_CONTENT_STATUS_INVALID",
    );
    if (!CONTENT_STATUSES.has(contentStatus)) {
      throw new Error("BRAND_NATIVE_PERFORMANCE_CONTENT_STATUS_INVALID");
    }

    return {
      campaignId,
      campaignName,
      creatorProfileId,
      gmvCents: nonNegativeInteger(value.gmv_cents, "BRAND_NATIVE_PERFORMANCE_GMV_INVALID"),
      orders: nonNegativeInteger(value.orders, "BRAND_NATIVE_PERFORMANCE_ORDERS_INVALID"),
      recordedCommissionCents: nonNegativeInteger(
        value.commission_cents,
        "BRAND_NATIVE_PERFORMANCE_COMMISSION_INVALID",
      ),
      contentStatus: contentStatus as BrandCampaignPerformanceSource["contentStatus"],
      performanceUpdatedAt: optionalTimestamp(value.performance_updated_at),
    };
  });

  return buildBrandCampaignPerformance({
    entries,
    currency: input.currency,
    generatedAt: input.generatedAt,
  });
}
