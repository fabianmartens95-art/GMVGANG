import {
  campaignActionRequired,
  type CampaignLifecycleState,
  type CampaignStatus,
} from "@gmvgang/brand-campaign-lifecycle";
import {
  recommendBrandNextBestAction,
  type BrandNextBestAction,
  type BrandTikTokState,
  type BrandWorkspaceMode,
} from "@gmvgang/brand-next-action";
import {
  evaluateBrandProductReadiness,
  type BrandProductReadinessInput,
  type BrandProductStatus,
} from "@gmvgang/brand-product-readiness";

const PRODUCT_STATUSES = new Set<BrandProductStatus>(["draft", "active", "archived"]);
const CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  "draft",
  "approved",
  "active",
  "paused",
  "completed",
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

function nullableText(value: unknown, code: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(code);
  return value;
}

function nullableTimestamp(value: unknown, code: string): string | null {
  const text = nullableText(value, code);
  if (text === null) return null;
  if (!Number.isFinite(Date.parse(text))) throw new Error(code);
  return text;
}

function productReadiness(value: unknown): { status: BrandProductStatus; readiness: ReturnType<typeof evaluateBrandProductReadiness> } {
  if (!isRecord(value)) throw new Error("BRAND_NBA_PRODUCT_ROW_INVALID");
  const status = requiredText(value.status, "BRAND_NBA_PRODUCT_STATUS_INVALID") as BrandProductStatus;
  if (!PRODUCT_STATUSES.has(status)) throw new Error("BRAND_NBA_PRODUCT_STATUS_INVALID");

  const readinessInput: BrandProductReadinessInput = {
    name: requiredText(value.name, "BRAND_NBA_PRODUCT_IDENTITY_INVALID"),
    sku: requiredText(value.sku, "BRAND_NBA_PRODUCT_IDENTITY_INVALID"),
    salePriceCents: nonNegativeInteger(value.sale_price_cents, "BRAND_NBA_PRODUCT_MONEY_INVALID"),
    cogsCents: nonNegativeInteger(value.cogs_cents, "BRAND_NBA_PRODUCT_MONEY_INVALID"),
    affiliateCommissionBps: nonNegativeInteger(
      value.affiliate_commission_bps,
      "BRAND_NBA_PRODUCT_MONEY_INVALID",
    ),
    sampleCostCents: nonNegativeInteger(value.sample_cost_cents, "BRAND_NBA_PRODUCT_MONEY_INVALID"),
    inventoryUnits: nonNegativeInteger(value.inventory_units, "BRAND_NBA_PRODUCT_INVENTORY_INVALID"),
    tiktokShopUrl: nullableText(value.tiktok_shop_url, "BRAND_NBA_PRODUCT_URL_INVALID"),
    imageUrl: nullableText(value.image_url, "BRAND_NBA_PRODUCT_URL_INVALID"),
  };

  return { status, readiness: evaluateBrandProductReadiness(readinessInput) };
}

function campaignState(value: unknown): CampaignLifecycleState {
  if (!isRecord(value)) throw new Error("BRAND_NBA_CAMPAIGN_ROW_INVALID");
  const status = requiredText(value.status, "BRAND_NBA_CAMPAIGN_STATUS_INVALID") as CampaignStatus;
  if (!CAMPAIGN_STATUSES.has(status)) throw new Error("BRAND_NBA_CAMPAIGN_STATUS_INVALID");
  if (typeof value.client_approved !== "boolean") {
    throw new Error("BRAND_NBA_CAMPAIGN_APPROVAL_INVALID");
  }

  return {
    status,
    clientApproved: value.client_approved,
    approvedAt: nullableTimestamp(value.approved_at, "BRAND_NBA_CAMPAIGN_TIMESTAMP_INVALID"),
    launchedAt: nullableTimestamp(value.launched_at, "BRAND_NBA_CAMPAIGN_TIMESTAMP_INVALID"),
    completedAt: nullableTimestamp(value.completed_at, "BRAND_NBA_CAMPAIGN_TIMESTAMP_INVALID"),
  };
}

export type NativeBrandNextActionInput = {
  onboardingComplete: boolean;
  workspaceMode: BrandWorkspaceMode;
  tiktokState: BrandTikTokState;
  pendingCreatorMatches: number;
  products: readonly unknown[];
  campaigns: readonly unknown[];
};

export function recommendNativeBrandNextAction(
  input: NativeBrandNextActionInput,
): BrandNextBestAction {
  const pendingCreatorMatches = nonNegativeInteger(
    input.pendingCreatorMatches,
    "BRAND_NBA_CREATOR_MATCH_COUNT_INVALID",
  );

  let activeProducts = 0;
  for (const value of input.products) {
    const product = productReadiness(value);
    if (product.status === "active" && product.readiness.canActivate) activeProducts += 1;
  }

  let activeCampaigns = 0;
  let campaignActionsRequired = 0;
  for (const value of input.campaigns) {
    const state = campaignState(value);
    if (state.status === "active") activeCampaigns += 1;
    if (campaignActionRequired(state) !== "none") campaignActionsRequired += 1;
  }

  return recommendBrandNextBestAction({
    onboardingComplete: input.onboardingComplete,
    workspaceMode: input.workspaceMode,
    tiktokState: input.tiktokState,
    activeProducts,
    activeCampaigns,
    pendingCreatorMatches,
    campaignActionsRequired,
  });
}
