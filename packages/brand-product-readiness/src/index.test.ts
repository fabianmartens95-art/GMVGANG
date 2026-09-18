import { describe, expect, it } from "vitest";
import { authorizeBrandProductTransition, evaluateBrandProductReadiness } from "./index.js";

const readyInput = {
  name: "Creator Bundle",
  sku: "CB-001",
  salePriceCents: 4999,
  cogsCents: 1500,
  affiliateCommissionBps: 1500,
  sampleCostCents: 1500,
  inventoryUnits: 100,
  tiktokShopUrl: "https://shop.tiktok.com/product/123",
  imageUrl: "https://cdn.example.com/product.jpg",
};

describe("Brand Product readiness", () => {
  it("allows activation with complete core commerce data", () => {
    expect(evaluateBrandProductReadiness(readyInput)).toEqual({
      canActivate: true,
      blockers: [],
      warnings: [],
    });
  });

  it("blocks missing identity or sale price", () => {
    expect(evaluateBrandProductReadiness({
      ...readyInput,
      name: " ",
      sku: "",
      salePriceCents: 0,
    })).toMatchObject({
      canActivate: false,
      blockers: ["name_required", "sku_required", "sale_price_required"],
    });
  });

  it("aligns name, SKU and integer bounds with brand_products persistence", () => {
    expect(evaluateBrandProductReadiness({
      ...readyInput,
      name: "n".repeat(201),
      sku: "s".repeat(129),
      salePriceCents: 2_147_483_648,
    })).toMatchObject({
      canActivate: false,
      blockers: ["name_too_long", "sku_too_long", "invalid_economics"],
    });

    expect(evaluateBrandProductReadiness({
      ...readyInput,
      cogsCents: 2_147_483_648,
    })).toMatchObject({
      canActivate: false,
      blockers: ["invalid_economics"],
    });

    expect(evaluateBrandProductReadiness({
      ...readyInput,
      inventoryUnits: 2_147_483_647,
    }).canActivate).toBe(true);
  });

  it("fails readiness on malformed money/inventory inputs", () => {
    expect(evaluateBrandProductReadiness({ ...readyInput, cogsCents: -1 })).toMatchObject({
      canActivate: false,
      blockers: ["invalid_economics"],
    });
    expect(evaluateBrandProductReadiness({ ...readyInput, affiliateCommissionBps: 10001 })).toMatchObject({
      canActivate: false,
      blockers: ["invalid_economics"],
    });
  });

  it("blocks unsafe or persistence-oversized external URLs", () => {
    expect(evaluateBrandProductReadiness({
      ...readyInput,
      tiktokShopUrl: "javascript:alert(1)",
    })).toMatchObject({
      canActivate: false,
      blockers: ["invalid_tiktok_shop_url"],
    });

    expect(evaluateBrandProductReadiness({
      ...readyInput,
      imageUrl: "https://user:pass@example.com/product.jpg",
    })).toMatchObject({
      canActivate: false,
      blockers: ["invalid_image_url"],
    });

    expect(evaluateBrandProductReadiness({
      ...readyInput,
      tiktokShopUrl: `https://example.com/${"x".repeat(2040)}`,
    })).toMatchObject({
      canActivate: false,
      blockers: ["invalid_tiktok_shop_url"],
    });
  });

  it("uses warnings rather than blockers for zero inventory/economics and missing TikTok URL", () => {
    expect(evaluateBrandProductReadiness({
      ...readyInput,
      cogsCents: 0,
      affiliateCommissionBps: 0,
      inventoryUnits: 0,
      tiktokShopUrl: null,
    })).toEqual({
      canActivate: true,
      blockers: [],
      warnings: [
        "inventory_zero",
        "cogs_zero",
        "affiliate_commission_zero",
        "tiktok_shop_url_missing",
      ],
    });
  });
});

describe("Brand Product lifecycle", () => {
  it("requires readiness before draft can become active", () => {
    const notReady = evaluateBrandProductReadiness({ ...readyInput, salePriceCents: 0 });
    expect(authorizeBrandProductTransition({
      currentStatus: "draft",
      targetStatus: "active",
      readiness: notReady,
    })).toEqual({ ok: false, error: "PRODUCT_NOT_READY_FOR_ACTIVATION" });

    expect(authorizeBrandProductTransition({
      currentStatus: "draft",
      targetStatus: "active",
      readiness: evaluateBrandProductReadiness(readyInput),
    })).toEqual({ ok: true, status: "active" });
  });

  it("supports deactivation/archive and requires archived products to return through draft", () => {
    const readiness = evaluateBrandProductReadiness(readyInput);
    expect(authorizeBrandProductTransition({ currentStatus: "active", targetStatus: "draft", readiness }))
      .toEqual({ ok: true, status: "draft" });
    expect(authorizeBrandProductTransition({ currentStatus: "active", targetStatus: "archived", readiness }))
      .toEqual({ ok: true, status: "archived" });
    expect(authorizeBrandProductTransition({ currentStatus: "archived", targetStatus: "active", readiness }))
      .toEqual({ ok: false, error: "PRODUCT_TRANSITION_DENIED" });
    expect(authorizeBrandProductTransition({ currentStatus: "archived", targetStatus: "draft", readiness }))
      .toEqual({ ok: true, status: "draft" });
  });
});
