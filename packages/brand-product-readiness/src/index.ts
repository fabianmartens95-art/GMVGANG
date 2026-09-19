export type BrandProductStatus = "draft" | "active" | "archived";

export type BrandProductReadinessInput = {
  name: string;
  sku: string;
  salePriceCents: number;
  cogsCents: number;
  affiliateCommissionBps: number;
  sampleCostCents: number;
  inventoryUnits: number;
  tiktokShopUrl?: string | null;
  imageUrl?: string | null;
};

export type BrandProductReadiness = {
  canActivate: boolean;
  blockers: Array<
    | "name_required"
    | "name_too_long"
    | "sku_required"
    | "sku_too_long"
    | "sale_price_required"
    | "invalid_economics"
    | "invalid_tiktok_shop_url"
    | "invalid_image_url"
  >;
  warnings: Array<
    | "inventory_zero"
    | "cogs_zero"
    | "affiliate_commission_zero"
    | "tiktok_shop_url_missing"
  >;
};

export type BrandProductTransitionDecision =
  | { ok: true; status: BrandProductStatus }
  | {
      ok: false;
      error:
        | "PRODUCT_TRANSITION_DENIED"
        | "PRODUCT_NOT_READY_FOR_ACTIVATION";
    };

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const PRODUCT_NAME_MAX = 200;
const PRODUCT_SKU_MAX = 128;
const URL_MAX = 2048;

function isNonNegativeDbInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= POSTGRES_INTEGER_MAX;
}

function isSafeHttpsUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw || raw.length > URL_MAX) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function evaluateBrandProductReadiness(
  input: BrandProductReadinessInput,
): BrandProductReadiness {
  const blockers: BrandProductReadiness["blockers"] = [];
  const warnings: BrandProductReadiness["warnings"] = [];

  const name = input.name.trim();
  const sku = input.sku.trim();

  if (!name) blockers.push("name_required");
  else if (name.length > PRODUCT_NAME_MAX) blockers.push("name_too_long");

  if (!sku) blockers.push("sku_required");
  else if (sku.length > PRODUCT_SKU_MAX) blockers.push("sku_too_long");

  if (!Number.isInteger(input.salePriceCents) || input.salePriceCents <= 0) {
    blockers.push("sale_price_required");
  }

  const economicsValid =
    isNonNegativeDbInteger(input.salePriceCents) &&
    input.salePriceCents > 0 &&
    isNonNegativeDbInteger(input.cogsCents) &&
    isNonNegativeDbInteger(input.sampleCostCents) &&
    Number.isInteger(input.affiliateCommissionBps) &&
    input.affiliateCommissionBps >= 0 &&
    input.affiliateCommissionBps <= 10_000 &&
    isNonNegativeDbInteger(input.inventoryUnits);

  if (!economicsValid && !blockers.includes("sale_price_required")) {
    blockers.push("invalid_economics");
  } else if (
    !isNonNegativeDbInteger(input.cogsCents) ||
    !isNonNegativeDbInteger(input.sampleCostCents) ||
    !Number.isInteger(input.affiliateCommissionBps) ||
    input.affiliateCommissionBps < 0 ||
    input.affiliateCommissionBps > 10_000 ||
    !isNonNegativeDbInteger(input.inventoryUnits)
  ) {
    blockers.push("invalid_economics");
  }

  if (economicsValid) {
    if (input.inventoryUnits === 0) warnings.push("inventory_zero");
    if (input.cogsCents === 0) warnings.push("cogs_zero");
    if (input.affiliateCommissionBps === 0) warnings.push("affiliate_commission_zero");
  }

  if (!input.tiktokShopUrl?.trim()) {
    warnings.push("tiktok_shop_url_missing");
  } else if (!isSafeHttpsUrl(input.tiktokShopUrl)) {
    blockers.push("invalid_tiktok_shop_url");
  }

  if (input.imageUrl?.trim() && !isSafeHttpsUrl(input.imageUrl)) {
    blockers.push("invalid_image_url");
  }

  return {
    canActivate: blockers.length === 0,
    blockers,
    warnings,
  };
}

const ALLOWED_TRANSITIONS: Record<BrandProductStatus, readonly BrandProductStatus[]> = {
  draft: ["active", "archived"],
  active: ["draft", "archived"],
  archived: ["draft"],
};

export function authorizeBrandProductTransition(input: {
  currentStatus: BrandProductStatus;
  targetStatus: BrandProductStatus;
  readiness: BrandProductReadiness;
}): BrandProductTransitionDecision {
  if (!ALLOWED_TRANSITIONS[input.currentStatus].includes(input.targetStatus)) {
    return { ok: false, error: "PRODUCT_TRANSITION_DENIED" };
  }

  if (input.targetStatus === "active" && !input.readiness.canActivate) {
    return { ok: false, error: "PRODUCT_NOT_READY_FOR_ACTIVATION" };
  }

  return { ok: true, status: input.targetStatus };
}

export type ProductCampaignSetupDecision =
  | {
      ok: true;
      productId: string;
      organizationId: string;
      warnings: BrandProductReadiness["warnings"];
    }
  | {
      ok: false;
      error:
        | "PRODUCT_ID_REQUIRED"
        | "PRODUCT_ORGANIZATION_REQUIRED"
        | "CAMPAIGN_ORGANIZATION_REQUIRED"
        | "PRODUCT_CAMPAIGN_ORGANIZATION_MISMATCH"
        | "PRODUCT_CAMPAIGN_REQUIRES_ACTIVE_PRODUCT"
        | "PRODUCT_CAMPAIGN_REQUIRES_READY_PRODUCT";
    };

export function authorizeProductForCampaignSetup(input: {
  productId: string;
  productOrganizationId: string;
  campaignOrganizationId: string;
  productStatus: BrandProductStatus;
  readiness: BrandProductReadiness;
}): ProductCampaignSetupDecision {
  const productId = input.productId.trim();
  const productOrganizationId = input.productOrganizationId.trim();
  const campaignOrganizationId = input.campaignOrganizationId.trim();

  if (!productId) return { ok: false, error: "PRODUCT_ID_REQUIRED" };
  if (!productOrganizationId) {
    return { ok: false, error: "PRODUCT_ORGANIZATION_REQUIRED" };
  }
  if (!campaignOrganizationId) {
    return { ok: false, error: "CAMPAIGN_ORGANIZATION_REQUIRED" };
  }
  if (productOrganizationId !== campaignOrganizationId) {
    return { ok: false, error: "PRODUCT_CAMPAIGN_ORGANIZATION_MISMATCH" };
  }
  if (input.productStatus !== "active") {
    return { ok: false, error: "PRODUCT_CAMPAIGN_REQUIRES_ACTIVE_PRODUCT" };
  }
  if (!input.readiness.canActivate || input.readiness.blockers.length > 0) {
    return { ok: false, error: "PRODUCT_CAMPAIGN_REQUIRES_READY_PRODUCT" };
  }

  return {
    ok: true,
    productId,
    organizationId: productOrganizationId,
    warnings: [...input.readiness.warnings],
  };
}
