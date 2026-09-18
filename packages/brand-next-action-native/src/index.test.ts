import { describe, expect, it } from "vitest";
import { recommendNativeBrandNextAction } from "./index.js";

const readyProduct = {
  name: "Bundle",
  sku: "B-1",
  status: "active",
  sale_price_cents: 4999,
  cogs_cents: 1500,
  affiliate_commission_bps: 1500,
  sample_cost_cents: 1500,
  inventory_units: 100,
  tiktok_shop_url: "https://shop.tiktok.com/product/1",
  image_url: "https://cdn.example.com/p.jpg",
};

const activeCampaign = {
  status: "active",
  client_approved: true,
  approved_at: "2026-09-18T04:00:00.000Z",
  launched_at: "2026-09-18T05:00:00.000Z",
  completed_at: null,
};

function base() {
  return {
    onboardingComplete: true,
    workspaceMode: "full_access" as const,
    tiktokState: "connected" as const,
    pendingCreatorMatches: 0,
    products: [readyProduct],
    campaigns: [activeCampaign],
  };
}

describe("native Brand Next Best Action adapter", () => {
  it("returns monitor when the governed commerce foundation is healthy", () => {
    expect(recommendNativeBrandNextAction(base())).toMatchObject({
      id: "monitor_active_campaigns",
      priority: "normal",
    });
  });

  it("does not count an active Product that fails current readiness", () => {
    expect(recommendNativeBrandNextAction({
      ...base(),
      products: [{ ...readyProduct, sale_price_cents: 0 }],
    })).toMatchObject({
      id: "add_first_product",
      priority: "high",
    });
  });

  it("derives Campaign attention server-side from lifecycle state", () => {
    expect(recommendNativeBrandNextAction({
      ...base(),
      campaigns: [
        activeCampaign,
        {
          status: "draft",
          client_approved: false,
          approved_at: null,
          launched_at: null,
          completed_at: null,
        },
      ],
    })).toMatchObject({
      id: "resolve_campaign_action",
      priority: "high",
    });
  });

  it("preserves onboarding and entitlement priority over downstream counters", () => {
    expect(recommendNativeBrandNextAction({
      ...base(),
      onboardingComplete: false,
      products: [],
      campaigns: [],
    }).id).toBe("complete_brand_onboarding");

    expect(recommendNativeBrandNextAction({
      ...base(),
      workspaceMode: "read_only",
    }).id).toBe("restore_brand_access");
  });

  it("fails closed on malformed persisted state", () => {
    expect(() => recommendNativeBrandNextAction({
      ...base(),
      products: [{ ...readyProduct, affiliate_commission_bps: 10001 }],
    })).not.toThrow();

    expect(() => recommendNativeBrandNextAction({
      ...base(),
      campaigns: [{ ...activeCampaign, client_approved: "yes" }],
    })).toThrow("BRAND_NBA_CAMPAIGN_APPROVAL_INVALID");
  });
});
